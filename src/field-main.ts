/**
 * 전장 시험장 진입점 (field.html) — 본편 전투 실시간화 F3. sim(src/field/sim.ts)을 고정 걸음으로 돌리고 화면에 그린다.
 * 주소: ?men=2000 (한 편 사람 수) · ?seed=7 · ?map=meet|cross|stake|high|ambush (ambush=0 이면 기습 실패) · ?hero=<띠 열쇠> · ?gfx=low · ?bench (그리기 재기: window.__fieldBench)
 * 조작은 「눌러서 고르고, 찍어서 보낸다」 (docs/realm/battle-study/50-control-v2.md): 맵 위의 병사·깃·장수를 눌러 고르고, 오른쪽 누름(폰은 땅 누름)으로 보낸다.
 * 숨은 탭에서는 rAF 를 예약하지 않고(규칙 4) 돌아오면 밀린 시간을 몰아 돌리지 않는다.
 */
import { P } from './tune/params.ts'
import { startGfxSafe } from './ui/gfxsafe.ts'
import { guardMedia } from './ui/media-guard.ts'
import { plainSetup } from './field/scenario.ts'
import { crossMap, highMap, ambushMap, meetMap, stakeMap } from './field/map.ts'
import { createField, stepField } from './field/sim.ts'
import { t, type Key } from './i18n/index.ts'
import { aimInput, attackInputs, cmdInput, dashInput, frontInput, rallyInput, heroDirInput, keysDir, mergePlan, nearestFoe, sendInputs, skillInput, BIG_ARTS, CMDS, type CmdGroup, type InputCtx } from './field/input.ts'
import { actionOf, firstKeyLabel, KEYS } from './field/actions.ts'
import { AFTER_ORDER, ALL_GROUPS, aimExpired, aimPress, aimTap, cellWhy, GRP_OF, normalizeSel, pickAt, type PickCand, type UiState } from './field/pickmodel.ts'
import { mountFlags, type FlagsView } from './field/mainFlags.ts'
import { mountArrows, mountPad, type Arrows, type Pad, type PadBtn } from './field/mainPad.ts'
import { mountFirst, mountSteps, type First, type Steps } from './field/mainHelp.ts'
import { mountHelp, type Help } from './field/mainCard.ts'
import { drawMarks, type Band, type Box, type Mark, type MarkShape, type Ring } from './field/mainFlagMarks.ts'
import { LINES, OP_AUTO, OP_MOVE, ORD_CHARGE, ORD_FLANK, ORD_HOLD, ORD_VOLLEY, type FieldInput, type InputGroup } from './field/types.ts'
import { roll } from './core/rng.ts'
import { mountMini, type Mini } from './field/mainMini.ts'
import { serialize } from './field/rec.ts'
import { bladeLeftOf, mountHud, type EndStats, type EndWhy, type Hud } from './field/mainHud.ts'
import { createFieldSound, soundCamOf, soundFrameOf } from './field/mainSound.ts'
import type { FlagKind } from './field/mainSoundModel.ts'
import { advance } from './field/viewLoop.ts'
import { readField, type VLoss, type VModel } from './field/viewRead.ts'
import { clampCenter, clusterCenter, fitZoom, followCam, frameBox, newCam, nextLevel, toField, toScreen, wholeZoom, type Rect, type Viewport } from './field/viewCamera.ts'
import { loadArt } from './field/viewArt.ts'
import { drawField, focusPoints, resetFx, worldSize } from './field/view.ts'

startGfxSafe()
guardMedia()

const query = new URLSearchParams(location.search)
const num = (key: string, dflt: number): number => { const v = Number(query.get(key)); return Number.isFinite(v) && query.has(key) ? Math.trunc(v) : dflt }
const root = document.getElementById('field') as HTMLDivElement
root.innerHTML = `<canvas id="fd-cv"></canvas>
<div id="fd-rotate" hidden><div><span>↻</span><h2>폰을 가로로 돌려 주세요</h2><p>가로 화면에서 전장을 봅니다.<br>돌리는 동안 전투는 멈춰 있습니다.</p></div></div>`
const style = document.createElement('style')
style.textContent = `
html,body{margin:0;height:100%;background:#10140d;overflow:hidden;font-family:system-ui,sans-serif;color:#f3ecd8}
#field{position:fixed;inset:0}
#fd-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
#fd-rotate{position:absolute;inset:0;background:#10140df0;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 16px;box-sizing:border-box}
#fd-rotate[hidden]{display:none}
#fd-rotate span{font-size:44px}
#fd-rotate h2{margin:8px 0;font-size:20px}
#fd-rotate p{margin:0;font-size:14px;line-height:1.5}
`
document.head.append(style)

const cv = document.getElementById('fd-cv') as HTMLCanvasElement
const ctx = cv.getContext('2d', { alpha: false }) as CanvasRenderingContext2D
const rotate = document.getElementById('fd-rotate') as HTMLDivElement

const art = loadArt(import.meta.env.BASE_URL + 'realm/')
const heroPick = query.get('hero')
const makeMap = () => {
  switch (query.get('map')) {
    case 'cross': return crossMap()
    case 'stake': return stakeMap()
    case 'high': return highMap()
    case 'ambush': return ambushMap(query.get('ambush') !== '0')
    default: return meetMap()
  }
}
let low = query.get('gfx') === 'low'
let seed = num('seed', 7)
const men = num('men', 1200)
/** 우리 장수와 적장이 같은 그림이 되지 않게 열쇠를 나눈다 (둘 다 대시 칸이 있는 띠) */
const HERO_KEY_OURS = 'ara', HERO_KEY_FOE = query.get('foehero') ?? 'bakdal'
/** 준비 화면에서 고른 우리 진 (0 방패 벽 · 1 창 쐐기 · 2 넓은 날개) — 「다시」 뒤에도 그대로 */
let lineChoice = 0
/** 적 진 (0~2) — 씨앗이 정한 것(엔진이 같은 굴림으로 고르던 값)을 우리가 미리 고른다. 같은 진이 세 판 연속 나오지 않게 직전 둘을 기억 */
const foeRoll = (s: number): number => Math.floor(roll(s, 0, 'line:1') * LINES)
const foeHist: number[] = []
function nextFoeLine(): number {
  const c = foeRoll(seed + 1), n = foeHist.length
  return n >= 2 && foeHist[n - 1] === c && foeHist[n - 2] === c ? (c + 1) % LINES : c
}
let foeLine = foeRoll(seed)
foeHist.push(foeLine)
function newSetup() {
  const su = plainSetup(seed, men, true, makeMap())
  su.sides[0].form = lineChoice as 0 | 1 | 2
  su.sides[1].form = foeLine as 0 | 1 | 2
  if (su.sides[0].hero !== null) su.sides[0].hero.id = HERO_KEY_OURS
  if (su.sides[1].hero !== null) su.sides[1].hero.id = HERO_KEY_FOE
  return su
}
let state = createField(newSetup())
let cur: VModel = readField(state)
let prev: VModel | null = null
/** 아직 그림이 못 읽은 깎임 사건 (한 프레임에 틱이 여럿 돌아도 안 빠진다) · 위쪽 숫자를 늦춰 보이려는 판 기록 */
let lossAcc: VLoss[] = []
const hist: { t: number; m: VModel }[] = []
let paused = false
/** 그리는 시계 (멈추면 서고 · 끝나면 잠깐 느려진다) · 끝난 시각 · 끌어서 옮긴 카메라 · 목표를 한 번 더 늦춘 자리 */
let viewMs = 0
let endAt = 0
let pan: { x: number; y: number; until: number } | null = null
let tgt: { x: number; y: number } | null = null
let hud: Hud
/** 소리 (F3e) — 첫 손짓 뒤에만 나고 · 멈춤·숨은 탭에서는 안 부른다 */
const fsnd = createFieldSound()
let soundTick = -1, soundEpoch = 0
let hitStopUntil = 0
let acc = 0
let last = 0
let raf = 0
let blocked = false
let introLeft = P.field.introMs
/** 시작 화면(ready)에서는 판 전체를 보며 깃발을 꽂고 · 전투 개시를 누르면 play. 처음부터 장수가 골라져 있다 */
const ui: UiState = { phase: 'ready', sel: [3] }
/** 아직 sim 에 안 들어간 입력 (tick = 다음에 돌 틱) */
let queue: FieldInput[] = []
/** 시작 화면에서 꽂아 둔 입력 (같은 무리·같은 갈래를 다시 꽂으면 바뀐다) */
let plan: FieldInput[] = []
/** 무리마다(0 앞줄 · 1 활 · 2 기병 · 3 장수) 마지막으로 보낸 자리와 깃발 모양 */
const lastGoal: Array<{ u: number; v: number } | null> = [null, null, null, null]
const lastShape: MarkShape[] = ['move', 'move', 'move', 'move']
/** 앞줄 자세 단추의 지금 값 (알아서면 -1) · 무리를 한 번이라도 보냈나 · 장수를 한 번이라도 보냈나 */
const cmdNow: number[] = [-1, -1, -1]
let sentGroup = false
let usedCharge = false
let leadK = 1
let step3Latched = false
let auraUntil = 0
/** 싸움 중 어떤 입력이든 한 번 들어가면 처음 안내는 걷힌다 */
let firstDone = false
/** 이번에 판이 보인 큰 부딪힘의 종류 (상성이 맞음 · 막힘) · 판이 시작할 때의 편별 사람 수 (끝 상자의 숫자) */
let fxGold = false, fxBlocked = false
/** 이번에 다시 선 대 (그 대 위에서 「+N」 이 떠 막대로 날아간다) · 판이 갈린 순간(먼저 무너진 틱)의 편 사기 둘 (끝 상자의 두 숫자) */
const flyQ: { id: number; n: number }[] = []
let breakMor: [number, number] | null = null
/** 찍는 큰 수: 2 화살비 · 3 옆치기 (찍을 때까지 판이 느려진다) · 누르고 있는 동안만 고른 무리(숫자키) · 마우스 올린 무리 */
let aiming = -1, aimSince = 0
/** 찍는 중이 저절로 취소된 직후 이 시각까지는 누름이 장수 공격으로 새지 않게 삼킨다 */
let aimGraceUntil = 0
let heldPick = -1
let hoverG = -1
let aimCur: HTMLImageElement
/** 첫 판 안내 (처음 세 걸음 · 이기는 법 한 줄) — 다 하면 저장하고 다시 안 뜬다 */
const TUT_KEY = 'field.tutorial.v1'
/** 넷째 걸음(밀침)은 뒤에 붙었다 — 앞 셋을 마친 사람에게는 넷째만 뜬다 */
const TUT4_KEY = 'field.tutorial.bash'
const readKey = (k: string): boolean => { try { return localStorage.getItem(k) === '1' } catch { return false } }
const tut3 = readKey(TUT_KEY)
let tutDone = tut3 && readKey(TUT4_KEY)
const stepOk = [tut3, tut3, tut3, false]
/** 이 판에서 우리 장수가 밀친 수 (결과 한 장 · 넷째 걸음) · 넷째 걸음이 떴나 */
let bashN = 0, step4Latched = false
let flashStep = -1, flashAt = 0, playMs = 0
let steps: Steps
let pad: Pad
let arrows: Arrows
/** 장수 걷기: 마지막으로 보낸 방향(없으면 -1) · 손가락 스틱의 방향 · 「적을 쳐라」로 찍힌 적에게 뜨는 표적 테 · 마지막으로 읽은 못 쓴 까닭 */
let heroDirSent = -1, padDir = -1
const foeFlash: { id: number; at: number }[] = []
let lastWhyTick = 0
const lastGrpWhyTick = [0, 0, 0]
let heroOrdered = false
/** 장수가 처음 선 자리 (움직였는지 보려고) · 무리 곁을 지날 때 튀는 고리의 시작 시각 */
let heroStart: { u: number; v: number } | null = null
const nudgeAt = [0, 0, 0, 0]
/** 카메라: 장수를 따라가는 것이 기본 · Tab 은 싸움을 따라감 · Y 는 풀기(화살표·가장자리·휠로 옮긴다) */
let camFree = false
/** 미니맵을 눌러 옮긴 카메라가 풀려 돌아오는 때를 가리는 장수 자리 (장수가 움직이면 곧바로 돌아온다) */
/** 큰 조작표를 이미 본 판 수 (저장 칸) */
const HELP_KEY = 'hanbal.field.helpSeen'
let helpGames = 0
try { helpGames = Math.max(0, Number(localStorage.getItem(HELP_KEY)) || 0) } catch { /* 저장 칸이 막혀도 판은 돈다 */ }
let bigNow = false
let miniHero: { u: number; v: number } | null = null
let mini: Mini
let camFight = false
let helpOpen = false
let slow = false
/** ?touch=1 은 폰 배치를 강제한다 (헤드리스·PC 에서 폰 화면을 볼 때) */
const forceTouch = query.has('touch')
let touchMode = forceTouch || matchMedia('(pointer: coarse)').matches
const keysHeld = new Set<string>()
const mouse = { x: 0, y: 0, in: false, at: 0 }
let flags: FlagsView
let help: Help
let first: First
let vp: Viewport = { w: 1, h: 1 }
let dpr = 1
/** 위 단추·사기 띠 아래 끝과 아래 띠·안내 줄 위 끝 (화면 px) — 실제 DOM 높이를 읽는다. 이만큼은 카메라 여유로 둬서 판 끝 병사가 띠에 안 깔린다 */
let padTop = 0, padBottom = 0, padTick = 0
function measurePads(): void {
  const bottomOf = (id: string): number => { const e = document.getElementById(id); return e === null || e.hidden ? 0 : e.getBoundingClientRect().bottom }
  padTop = Math.ceil(Math.max(bottomOf('fd-hud'), bottomOf('fd-edge')))
  const strip = document.getElementById('fd-strip'), hint = document.getElementById('fd-hint')
  const stripTop = strip === null || strip.hidden ? vp.h : strip.getBoundingClientRect().top
  const hintTop = hint === null || hint.hidden ? stripTop - P.field.hintBandPx : hint.getBoundingClientRect().top
  padBottom = Math.max(0, Math.ceil(vp.h - Math.min(stripTop - P.field.hintBandPx, hintTop)))
}
/** 카메라가 갈 수 있는 곳: 판 둘레에 여유를 둔다 (맨 위·옆 대가 잘리지 않게) */
const bounds = (): Rect => {
  const w = worldSize(cur), c = P.field.cellPx
  const z0 = Math.max(0.05, (vp.h - padTop - padBottom) / w.h)
  return { left: -P.field.camMarginSideCells * c, top: -Math.max(P.field.camMarginTopCells * c, padTop / z0), right: w.w + P.field.camMarginSideCells * c, bottom: w.h + Math.max(P.field.camMarginBottomCells * c, padBottom / z0) }
}
let cam = newCam(vp, bounds())

function resize(): void {
  vp = { w: Math.max(1, innerWidth), h: Math.max(1, innerHeight) }
  dpr = Math.min(devicePixelRatio || 1, low ? 1 : P.field.dprMax)
  // 화소 수 상한: 큰 화면에서 캔버스가 수천만 화소가 되지 않게 (4K 에서 프레임이 20ms 를 넘던 것)
  if (vp.w * vp.h * dpr * dpr > P.field.canvasPixelsMax) dpr = Math.sqrt(P.field.canvasPixelsMax / (vp.w * vp.h))
  paintKey.x = NaN
  cv.width = Math.round(vp.w * dpr); cv.height = Math.round(vp.h * dpr)
  blocked = innerWidth <= P.field.portraitMaxW && innerHeight > innerWidth
  rotate.hidden = !blocked
  hud.hide(blocked)
  measurePads()
  cam = newCam(vp, bounds(), cam.level)
  followTarget(0, true)
}

const heroNow = (m: VModel = cur): VModel['heroes'][number] | undefined => m.heroes.find(e => e.side === 0)

/**
 * 시작 화면: 높이에 맞춰 우리 진영 쪽을 보인다(옆으로 옮겨 적 쪽을 본다).
 * 싸우는 중: 장수를 따라간다(화면 가운데에서 우리 쪽으로 살짝 물러나 서서 앞이 더 보인다). Tab 은 맞붙은 곳을 담고, Y 는 카메라를 푼다.
 */
function followTarget(dt: number, snap = false): void {
  const b = bounds()
  const now = performance.now()
  if (pan !== null && now >= pan.until) pan = null
  { const hh = heroNow(); if (miniHero !== null && (pan === null || hh === undefined || hh.u !== miniHero.u || hh.v !== miniHero.v)) { if (pan !== null && ui.phase !== 'ready') pan = null; miniHero = null } }
  let raw: { x: number; y: number }
  let zt: number | undefined
  let direct = false
  const hero = heroNow()
  if (ui.phase === 'ready') {
    zt = fitZoom(vp, b)
    const ours = cur.squads.filter(q => q.side === 0 && q.men > 0)
    const ox = ours.length === 0 ? (b.left + b.right) / 2 : pxOf(ours.reduce((a, q) => a + q.u, 0) / ours.length)
    const off = (vp.w / 2 - vp.w * P.field.readyAnchorPermille / 1000) / zt
    raw = { x: cur.face === 1 ? ox + off : ox - off, y: (b.top + b.bottom) / 2 }
  } else if (camFree && pan !== null) {
    raw = { x: pan.x, y: pan.y }
  } else if (camFight || hero === undefined) {
    const f = focusPoints(cur)
    const box = frameBox(vp, b, f.xs, f.ys, P.field.frameMarginCells * P.field.cellPx)
    if (box === null) raw = { x: cam.x, y: cam.y }
    else if (cam.level === 0) { raw = { x: box.x, y: box.y }; zt = box.zoom }
    else raw = clusterCenter(f.xs, f.ys, P.field.clusterCells * P.field.cellPx) ?? { x: box.x, y: box.y }
  } else {
    direct = true
    // 맞붙기 전에는 전선 쪽 앞을 비추고, 우리 대가 맞물리거나 적 대가 가까우면 앞쪽 치우침을 풀고 장수에 가장 가까운 싸움을 본다
    const fight = nearestFight(hero)
    leadK += ((fight === null ? 1 : 0) - leadK) * (1 - Math.exp(-dt / P.field.camLeadEaseSec))
    raw = { x: pxOf(hero.u) + cur.face * leadK * vp.w * P.field.camLeadPermille / 1000 / cam.zoom, y: pxOf(hero.v) }
    if (fight !== null) {
      // 장수가 화면 가운데 40% 안에 남게 (싸움이 멀어 화면 밖이면 장수를 따라간다)
      const hx = pxOf(hero.u), hy = pxOf(hero.v), mx = 0.2 * vp.w / cam.zoom, my = 0.2 * vp.h / cam.zoom
      raw = { x: Math.max(hx - mx, Math.min(hx + mx, pxOf(fight.u))), y: Math.max(hy - my, Math.min(hy + my, pxOf(fight.v))) }
    }
  }
  if (pan !== null) raw = { x: pan.x, y: pan.y }
  if (tgt === null || snap || pan !== null || direct) tgt = raw
  else { const k = 1 - Math.exp(-P.field.camTargetRate * dt); tgt = { x: tgt.x + (raw.x - tgt.x) * k, y: tgt.y + (raw.y - tgt.y) * k } }
  followCam(cam, tgt.x, tgt.y, dt, vp, b, snap, zt)
  // 싸우는 동안 우리 장수는 늘 화면 가운데 camHeroBoxPermille 상자 안 — 벗어나면 카메라를 곧바로 그만큼 옮긴다 (손으로 둘러보는 동안은 빼고)
  if (ui.phase === 'play' && hero !== undefined && pan === null && !camFree) {
    const half = P.field.camHeroBoxPermille / 2000, mx = vp.w * half / cam.zoom, my = vp.h * half / cam.zoom
    const hx = pxOf(hero.u), hy = pxOf(hero.v)
    const c = clampCenter(cam.zoom, Math.max(hx - mx, Math.min(hx + mx, cam.x)), Math.max(hy - my, Math.min(hy + my, cam.y)), vp, b)
    cam.x = c.x; cam.y = c.y
  }
}

/** 장수에 가장 가까운 맞물림(우리 대가 싸우는 중이거나 적 대가 engageCells 안)의 가운데 · 없으면 null */
function nearestFight(hero: { u: number; v: number }): { u: number; v: number } | null {
  const r = P.field.engageCells * P.field.unit, r2 = r * r
  let best: VModel['squads'][number] | null = null, bd = Infinity
  for (const q of cur.squads) {
    if (q.side !== 0 || q.men <= 0) continue
    const engaged = q.aim >= 0 || cur.squads.some(e => e.side === 1 && e.men > 0 && (e.u - q.u) * (e.u - q.u) + (e.v - q.v) * (e.v - q.v) <= r2)
    if (!engaged) continue
    const d = (q.u - hero.u) * (q.u - hero.u) + (q.v - hero.v) * (q.v - hero.v)
    if (d < bd) { bd = d; best = q }
  }
  if (best === null) return null
  const c = P.field.clusterCells * P.field.unit, c2 = c * c
  let su = 0, sv = 0, n = 0
  for (const q of cur.squads) if (q.side === 0 && q.men > 0 && (q.u - best.u) * (q.u - best.u) + (q.v - best.v) * (q.v - best.v) <= c2) { su += q.u; sv += q.v; n++ }
  return { u: su / n, v: sv / n }
}

function restart(): void {
  foeLine = nextFoeLine(); foeHist.push(foeLine)
  seed++
  state = createField(newSetup()); cur = readField(state); prev = null; acc = 0
  resetFx()
  introLeft = P.field.introMs
  fsnd.stop(); soundTick = -1; soundEpoch = markEpoch
  endAt = 0; viewMs = 0; pan = null; tgt = null; lossAcc = []; hist.length = 0; flyQ.length = 0; breakMor = null; bashN = 0
  ui.phase = 'ready'; ui.sel = [3]
  queue = []; plan = []
  lastGoal.fill(null); lastShape.fill('move'); nudgeAt.fill(0)
  heroDirSent = -1; padDir = -1; foeFlash.length = 0; lastWhyTick = 0; lastGrpWhyTick.fill(0)
  leadK = 1; cmdNow.fill(-1); sentGroup = false; usedCharge = false; aiming = -1; flashStep = -1; playMs = 0; heroOrdered = false; firstDone = false; heroStart = null
  camFree = false; camFight = false; cam.level = 0; hud.setZoom(0)
  hud.showEnd(null)
  markEpoch++
  followTarget(0, true)
}

const gaps: number[] = []
/** 마지막으로 그린 때의 카메라·고른 것·깃발 표시 (멈춤·끝·가로 안내 중에 같으면 다시 안 그린다) */
const paintKey = { x: NaN, y: NaN, z: NaN, sel: '', epoch: -1 }
let markEpoch = 0
let lowAuto = false, goodMs = 0, noLowUntil = 0
function watchLoad(dtMs: number): void {
  // 긴 프레임(탭이 뒤에 깔렸거나 멈췄던 것)은 세지 않는다
  if (dtMs <= 0 || dtMs > P.field.lowIgnoreMs) return
  const t0 = performance.now()
  if (low) {
    // 자동으로 내려갔다면 좋은 프레임이 lowBackSec 초 이어질 때 되돌린다 (되돌린 뒤 noLowSec 초는 다시 안 내린다)
    if (!lowAuto) return
    goodMs = dtMs <= P.field.lowFrameMs ? goodMs + dtMs : 0
    if (goodMs >= P.field.lowBackSec * 1000) { low = false; lowAuto = false; goodMs = 0; noLowUntil = t0 + P.field.noLowSec * 1000; gaps.length = 0; resetFx(); resize() }
    return
  }
  if (t0 < noLowUntil) return
  gaps.push(dtMs)
  if (gaps.length < 60) return
  const mid = [...gaps].sort((a, b) => a - b)[30]!
  let long = 0
  for (const g of gaps) if (g > P.field.lowLongMs) long++
  gaps.length = 0
  // 가운데값이 느리거나, 긴 프레임이 잦으면(들쭉날쭉) 저사양으로 내린다
  if (mid > P.field.lowFrameMs || long * 1000 > P.field.lowLongPermille * 60) { low = true; lowAuto = true; goodMs = 0; resetFx(); resize() }
}

// ---- 조작 v2: 맵에서 고르고 · 찍어서 보내고 · 자세는 단추 ----
const STANCE_SHAPE: readonly MarkShape[] = ['charge', 'hold', 'open']
const unitsOf = (px: number): number => Math.round(px / P.field.cellPx * P.field.unit)
const pxOf = (u: number): number => u / P.field.unit * P.field.cellPx
const gName = (g: number): string => t(`field.g.${g}`  as Key)
const squadsOf = (g: number): VModel['squads'] => cur.squads.filter(q => q.side === 0 && q.grp === GRP_OF[g] && q.men > 0)
function inputCtx(): InputCtx {
  return { tick: ui.phase === 'ready' ? 0 : state.tick, mapUUnits: cur.mapUUnits, mapVUnits: cur.mapVUnits }
}

/** 고른 것을 바꾼다 (쓰러진 것은 빠지고 비면 장수로 돌아온다) */
function setSel(g: readonly InputGroup[]): void {
  const next = normalizeSel(cur, [...g].sort((a, b) => a - b) as InputGroup[])
  if (next.length === ui.sel.length && next.every((x, i) => x === ui.sel[i])) return
  ui.sel = next
  markEpoch++
}

/** 입력을 줄에 더한다 (시작 화면이면 꽂아 둔 것을 바꾼다) */
function accept(inputs: readonly FieldInput[]): void {
  if (inputs.length === 0) return
  if (ui.phase === 'ready') plan = mergePlan(plan, inputs)
  else { queue.push(...inputs); firstDone = true }
  markEpoch++
}

/** 맵 위에서 눌러 잡을 수 있는 우리 것들 (화면 px) — 대마다 · 장수 · 깃발 */
function pickCands(): PickCand[] {
  const out: PickCand[] = []
  const reach = P.field.spreadVCells * P.field.cellPx * cam.zoom
  for (const q of cur.squads) {
    if (q.side !== 0 || q.men <= 0) continue
    const s = toScreen(cam, vp, pxOf(q.u), pxOf(q.v))
    out.push({ g: GRP_OF.indexOf(q.grp) as InputGroup, x: s.x, y: s.y, reach })
  }
  const h = heroNow()
  if (h !== undefined) { const s = toScreen(cam, vp, pxOf(h.u), pxOf(h.v)); out.push({ g: 3, x: s.x, y: s.y, reach: 0 }) }
  const pole = P.field.markPoleCells * P.field.cellPx / 2
  for (const g of ALL_GROUPS) {
    const goal = lastGoal[g]
    if (goal === null || goal === undefined || !flagShown(g)) continue
    const s = toScreen(cam, vp, pxOf(goal.u), pxOf(goal.v) - pole)
    out.push({ g, x: s.x, y: s.y, reach: P.field.flagPickCells * P.field.cellPx * cam.zoom })
  }
  return out
}

/** 누른 곳(화면 px) 가까이의 적 대·적장의 자리 (sim 단위) · 없으면 null */
function enemyAt(px: number, py: number): { u: number; v: number; id: number } | null {
  let best: { u: number; v: number; id: number } | null = null, bestD2 = Infinity
  const reach = P.field.spreadVCells * P.field.cellPx * cam.zoom
  for (const q of cur.squads) {
    if (q.side !== 1 || q.men <= 0) continue
    const s = toScreen(cam, vp, pxOf(q.u), pxOf(q.v))
    const d2 = (s.x - px) ** 2 + (s.y - py) ** 2, r = P.field.sendAttackPx + reach
    if (d2 <= r * r && d2 < bestD2) { bestD2 = d2; best = { u: q.u, v: q.v, id: q.id } }
  }
  for (const e of cur.heroes) {
    if (e.side !== 1) continue
    const s = toScreen(cam, vp, pxOf(e.u), pxOf(e.v))
    const d2 = (s.x - px) ** 2 + (s.y - py) ** 2, r = P.field.sendAttackPx
    if (d2 <= r * r && d2 < bestD2) { bestD2 = d2; best = { u: e.u, v: e.v, id: -1 } }
  }
  return best
}

/** 고른 것을 누른 곳(화면 px)으로 보낸다 — 적 위면 그 적 쪽으로 (엔진에 「쳐라」가 오면 그것으로 바꾼다) */
function sendAt(px: number, py: number, now: number): void {
  const w = toField(cam, vp, px, py)
  const foe = enemyAt(px, py)
  const u = foe === null ? unitsOf(w.x) : foe.u, v = foe === null ? unitsOf(w.y) : foe.v
  const sel = ui.sel
  if (foe !== null && foe.id >= 0) { accept(attackInputs(sel, foe.id, inputCtx())); foeFlash.push({ id: foe.id, at: now }) }
  else accept(sendInputs(sel, u, v, inputCtx()))
  const goal = { u: Math.max(0, Math.min(cur.mapUUnits, u)), v: Math.max(0, Math.min(cur.mapVUnits, v)) }
  // 적을 찍은 것은 붉은 테만 · 깃은 땅으로 보낼 때만 선다
  if (foe === null || foe.id < 0) for (const g of sel) { lastGoal[g] = goal; if (g !== 0 || cmdNow[0]! < 0) lastShape[g] = 'move' }
  if (sel.includes(3)) heroOrdered = true
  if (sel.some(g => g < 3)) sentGroup = true
  fsnd.order((sel.length === 1 && sel[0] === 2 ? 'horse' : 'move') as FlagKind)
  if (!touchMode) flags.say(sel.length > 1 ? t('field.say.many', { n: sel.length }) : t('field.say', { g: gName(sel[0]!), i: t(foe === null ? 'field.i.move' : 'field.i.chase') }), 'ok', now)
  if (sel.some(g => g < 3)) setSel([3])
}

/** 큰 수 넷 (Z 돌격 · X 방진 · C 화살비 · V 옆치기) — 앞의 둘은 바로 · 뒤의 둘은 누르면 땅을 찍을 때까지 판이 느려진다 */
function pressBig(i: number): void {
  const now = performance.now()
  const r = aimPress(aiming, i)
  if (r.act === 'direct') { cancelAim(); pressCmd(0, i); return }
  if (r.act === 'cancel') { cancelAim(); return }
  const g = i === 2 ? 1 : 2
  const why = cellWhy(cur, g as InputGroup)
  if (why !== null) { flags.say(t(`field.why.${why}` as Key, { g: gName(g) }), 'why', now); return }
  aiming = r.aiming; aimSince = now; markEpoch++
  aimCur.src = `${import.meta.env.BASE_URL}realm/flag/flag-${BIG_ARTS[i]}.png`
  if (!touchMode) cv.style.cursor = 'none'
}
function cancelAim(): void { if (aiming === -1) return; aiming = -1; markEpoch++; cv.style.cursor = ''; aimCur.hidden = true }
/** 찍어서 확정: 그 자리에 가장 가까운 적 대가 표적 (엔진의 OP_AIM 이 오면 그것으로 바꾼다 · 그 전에는 명령을 고르고 그 적을 쳐라) */
function confirmAim(px: number, py: number, now: number): void {
  const g = (aiming === 2 ? 1 : 2) as CmdGroup
  const w = toField(cam, vp, px, py), u = unitsOf(w.x), v = unitsOf(w.y)
  const foeId = nearestFoe(cur.squads, u, v)
  accept([aimInput(g as 1 | 2, u, v, inputCtx())])
  if (foeId >= 0) foeFlash.push({ id: foeId, at: now })
  sentGroup = true
  fsnd.order((g === 2 ? 'horse' : 'move') as FlagKind)
  cancelAim()
  setSel([...AFTER_ORDER])
}

/** 명령 단추 (또는 Z X C V) — g 무리의 idx 번째 명령 · 같은 명령을 다시 누르면 알아서 */
function pressCmd(g: CmdGroup, idx: number): void {
  const now = performance.now()
  const why = cellWhy(cur, g)
  if (why !== null) { flags.say(t(`field.why.${why}` as Key, { g: gName(g) }), 'why', now); return }
  const name = CMDS[g]![idx]
  if (name === undefined) return
  // 앞줄 큰 수는 같은 것을 한 번 더 보내면 엔진이 푼다 (화면이 따로 알아서를 보내지 않는다)
  const i = g === 0 && idx < 2 ? frontInput(idx as 0 | 1, inputCtx()) : cmdInput(g, idx, cmdNow[g]!, inputCtx())
  accept([i])
  if (g === 0 && idx === 0 && ui.phase === 'play') usedCharge = true
  if (i.op === OP_AUTO) {
    cmdNow[g] = -1; if (g === 0) lastShape[0] = 'move'
    lastGoal[g] = null
  } else {
    cmdNow[g] = idx
    if (g === 0) lastShape[0] = STANCE_SHAPE[idx]!
    fsnd.order((g === 0 ? name : g === 2 ? 'horse' : 'move') as FlagKind)
  }
}

/** 장수 입력 (싸우는 중에만 · 입력 줄로) */
function heroInput(i: FieldInput): void {
  if (ui.phase !== 'play') return
  queue.push(i); heroOrdered = true; markEpoch++
}
const artCdSec = (a: string): number => a === 'shout' ? P.field.heroCdShoutSec : a === 'stand' ? P.field.heroCdStandSec : a === 'snipe' ? P.field.heroCdSnipeSec : P.field.heroCdVanguardSec
/** F · 모여라 단추: 전부 장수 곁으로 */
function doRally(): void {
  auraUntil = performance.now() + P.field.auraShowMs; markEpoch++
  accept([rallyInput(inputCtx())])
  cmdNow.fill(-1); lastGoal[0] = null; lastGoal[1] = null; lastGoal[2] = null
}
function doDash(): void { heroInput(dashInput(heroDirSent, inputCtx())) }
function doSkill(): void {
  const h = heroNow()
  if (h === undefined) return
  const foe = cur.heroes.find(e => e.side === 1)
  const at = h.art === 'snipe' && foe !== undefined ? foe : h
  heroInput(skillInput(at.u, at.v, inputCtx()))
}
/** WASD 와 스틱 가운데 지금 가려는 방향 · 바뀔 때만 입력을 보낸다 */
function walkHero(): void {
  if ((ui.phase !== 'play' && ui.phase !== 'ready') || paused || helpOpen) return
  const held = (names: readonly string[]): boolean => names.some(n => keysHeld.has(n))
  const k = keysDir(held(KEYS.heroUp), held(KEYS.heroDown), held(KEYS.heroLeft), held(KEYS.heroRight))
  const want = k >= 0 ? k : padDir
  // 준비 화면에서 장수를 움직이려 하면 곧바로 판이 시작된다 (「전투 개시」 단추는 그대로)
  if (ui.phase === 'ready') { if (want >= 0) goBattle(); return }
  if (want !== heroDirSent) { heroInput(heroDirInput(want, heroDirSent, inputCtx())); heroDirSent = want }
}
/** 장수·무리가 못 받은 까닭을 한 줄로 */
function watchWhy(now: number): void {
  const h = heroNow()
  if (h !== undefined && h.why !== 0 && h.whyTick !== lastWhyTick) { lastWhyTick = h.whyTick; flags.say(t(`field.herowhy.${h.why}` as Key), 'why', now) }
  for (const g of [0, 1, 2] as const) {
    if (cur.grpWhy[g] !== 0 && cur.grpWhyTick[g] !== lastGrpWhyTick[g]) { lastGrpWhyTick[g] = cur.grpWhyTick[g]; flags.say(`${gName(g)} ${t(`field.herowhy.${cur.grpWhy[g]}` as Key)}`, 'why', now) }
  }
}
function padBtns(): { dash: PadBtn; skill: PadBtn; rally: PadBtn } {
  const h = heroNow()
  const hz = P.field.hz
  const dashMax = Math.max(1, P.field.heroDashCdSec * hz)
  const art = h?.art ?? 'none'
  const artMax = Math.max(1, artCdSec(art) * hz)
  // 줄이 싸우는 중이라(앞줄이 맞물린 지 3초 안) 장수를 안 따라온다 — 모여라 단추가 밝아져 글 없이 읽힌다
  const locked = cur.frontLockTick[0] >= 0 && cur.tick - cur.frontLockTick[0] <= P.field.hz * P.field.rallyLitSec
  // 투지: 다 쓰면(gritN) 고리를 끈다 · 차면 쿨과 상관없이 금빛으로 부른다 (장수가 쓰러져 있으면 못 쓰니 안 부른다)
  const gritOn = h !== undefined && h.gritN < P.field.gritUses
  const full = gritOn && h!.grit >= 1000 && h!.stun === 0
  return {
    rally: { lit: locked, frac: 0, sec: 0, label: t('field.rally'), key: firstKeyLabel('rally'), icon: 'flag/flag-guard.png' },
    dash: { frac: h === undefined ? 0 : Math.min(1, h.dashCd / dashMax), sec: h === undefined ? 0 : Math.ceil(h.dashCd / hz), label: t('field.dash'), key: firstKeyLabel('dash'), icon: 'flag/flag-charge.png' },
    skill: { grit: gritOn ? h!.grit : 0, call: full, frac: h === undefined || full ? 0 : Math.min(1, h.artCd / artMax), sec: h === undefined || full ? 0 : Math.ceil(h.artCd / hz), label: art === 'none' ? '-' : t(`war.artName.${art}` as Key), key: firstKeyLabel('skillQ'), icon: art === 'none' ? '' : `flag/flag-art-${art}.png` },
  }
}

/** 준비 화면의 진 카드: 고르면 맵의 우리 진이 그 꼴로 다시 선다 */
function pickLine(i: number): void {
  if (ui.phase !== 'ready' || i === lineChoice) return
  lineChoice = i
  state = createField(newSetup()); cur = readField(state); prev = null; acc = 0
  resetFx(); lossAcc = []; hist.length = 0
  markEpoch++
}

function pickGroup(g: InputGroup): void {
  const why = cellWhy(cur, g)
  if (why !== null) { flags.say(t(`field.why.${why}` as Key, { g: gName(g) }), 'why', performance.now()); return }
  setSel([g])
}

function goBattle(): void {
  if (ui.phase !== 'ready') return
  queue = plan.slice()
  plan = []
  ui.phase = 'play'
  introLeft = 0
  acc = 0
  pan = null; camFree = false; camFight = false
  cam.level = 1; hud.setZoom(1)
  markEpoch++
}

const handlers = {
  onCell: pickGroup,
  onBig: pressBig,
  onLine: pickLine,
  onGo: goBattle,
}

/** 고른 것 발밑 금빛 고리 + 장수가 무리 곁을 지날 때 한 번 튀는 「눌러 봐」 고리 */
/** 대 하나의 몸 네모 (판 px · 가운데 + 가로(앞뒤 u) 세로(줄 v) 크기) — 몸 칸이 없으면 흩어짐 폭으로 */
function bodyRect(q: VModel['squads'][number]): { x: number; y: number; w: number; h: number } {
  const c = P.field.cellPx, pad = 0.6 * c
  const bd = q.bd > 0 ? q.bd / P.field.unit * c : (P.field.spreadUCells * 2 + 1) * c, bw = q.bw > 0 ? q.bw / P.field.unit * c : (P.field.spreadVCells * 2 + 1) * c
  return { x: pxOf(q.u), y: pxOf(q.v), w: bd + pad * 2, h: bw + pad * 2 }
}
/** 한 무리의 둥근 네모 테: 무리 하나에 하나 · 대가 흩어져 무리 폭이 groupSpanCells 를 넘으면 대마다 작은 테 */
function groupRings(squads: VModel['squads'], kind: Ring['kind'], phase: number): Ring[] {
  if (squads.length === 0) return []
  const rs = squads.map(bodyRect)
  const x0 = Math.min(...rs.map(r => r.x - r.w / 2)), x1 = Math.max(...rs.map(r => r.x + r.w / 2)), y0 = Math.min(...rs.map(r => r.y - r.h / 2)), y1 = Math.max(...rs.map(r => r.y + r.h / 2))
  const lim = P.field.groupSpanCells * P.field.cellPx
  if (x1 - x0 <= lim && y1 - y0 <= lim) return [{ x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, rx: 0, ry: 0, kind, phase }]
  return rs.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h, rx: 0, ry: 0, kind, phase }))
}
function ringsNow(now: number): Ring[] {
  const out: Ring[] = []
  const c = P.field.cellPx
  if (!ui.sel.includes(3)) {
    const h = heroNow()
    if (h !== undefined) out.push({ x: pxOf(h.u), y: pxOf(h.v), rx: P.field.ringHeroCells * c, ry: P.field.ringHeroCells * c * 0.45, kind: 'dim', phase: 0 })
  }
  if (hoverG >= 0 && hoverG < 3 && !ui.sel.includes(hoverG as InputGroup)) out.push(...groupRings(squadsOf(hoverG), 'hover', 0))
  for (const g of ui.sel) {
    if (g === 3) {
      const h = heroNow()
      if (h !== undefined) out.push({ x: pxOf(h.u), y: pxOf(h.v), rx: P.field.ringHeroCells * c, ry: P.field.ringHeroCells * c * 0.45, kind: 'sel', phase: 0 })
    } else out.push(...groupRings(squadsOf(g), 'sel', 0))
  }
  for (let i = foeFlash.length - 1; i >= 0; i--) {
    const fl = foeFlash[i]!
    const ph = (now - fl.at) / P.field.foeFlashMs
    const q = cur.squads[fl.id]
    if (ph >= 1 || q === undefined || q.men <= 0) { foeFlash.splice(i, 1); continue }
    out.push(...groupRings([q], 'foe', ph))
  }
  const hh = heroNow()
  if (hh !== undefined && ui.phase === 'play' && hh.stun === 0 && now < auraUntil) {
    const ar = P.field.heroAuraCells * c
    out.push({ x: pxOf(hh.u), y: pxOf(hh.v), rx: ar, ry: ar * 0.6, kind: 'aura', phase: 0 })
  }
  if (ui.phase === 'play' && !sentGroup) {
    for (const g of [0, 1, 2] as const) {
      if (nudgeAt[g]! > 0 && now - nudgeAt[g]! < P.field.nudgeMs) {
        out.push(...groupRings(squadsOf(g), 'nudge', (now - nudgeAt[g]!) / P.field.nudgeMs))
      }
    }
  }
  return out
}
/** 장수가 무리 곁(nudgeCells 안)을 처음 지나면 그 무리 고리가 한 번 튄다 */
function watchNudge(now: number): void {
  const h = heroNow()
  if (h === undefined || sentGroup || ui.phase !== 'play') return
  const r = P.field.nudgeCells * P.field.unit
  for (const g of [0, 1, 2] as const) {
    if (nudgeAt[g]! > 0) continue
    for (const q of squadsOf(g)) if ((q.u - h.u) ** 2 + (q.v - h.v) ** 2 <= r * r) { nudgeAt[g] = now; markEpoch++; break }
  }
}

/** 그 무리의 깃발이 지금 보이나 (싸우는 중에는 움직이는 동안·줄 선 동안만) */
function flagShown(g: number): boolean {
  if (ui.phase === 'ready') return true
  const moving = g === 3 ? cur.heroes.some(e => e.side === 0 && e.goal !== null) : cur.squads.some(q => q.side === 0 && q.grp === GRP_OF[g] && q.men > 0 && q.goal !== null)
  return moving || queue.some(i => i.g === g && i.op === OP_MOVE)
}
/** 고른 칸 무리의 자리(점선 시작) */
function fromOf(g: number): { x: number; y: number } | null {
  if (g === 3) { const e = heroNow(); return e ? { x: pxOf(e.u), y: pxOf(e.v) } : null }
  const mine = squadsOf(g)
  if (mine.length === 0) return null
  return { x: pxOf(mine.reduce((s, q) => s + q.u, 0) / mine.length), y: pxOf(mine.reduce((s, q) => s + q.v, 0) / mine.length) }
}
function marks(): Mark[] {
  const out: Mark[] = []
  const near = P.field.arriveCells * P.field.unit
  for (const g of ALL_GROUPS) {
    const goal = lastGoal[g]
    if (goal == null || !flagShown(g)) continue
    // 닿았으면 걷힌다 (싸움이 아니라 시작 화면의 깃은 늘 보인다)
    if (ui.phase !== 'ready') {
      const at = fromOf(g)
      if (at !== null && (at.x - pxOf(goal.u)) ** 2 + (at.y - pxOf(goal.v)) ** 2 <= (near / P.field.unit * P.field.cellPx) ** 2) continue
    }
    const sel = ui.sel.includes(g)
    // 같은 자리로 보낸 깃은 하나로 (무리 셋을 한 곳에 보내도 깃이 겹쳐 서지 않는다)
    const dup = out.find(k => k.x === pxOf(goal.u) && k.y === pxOf(goal.v))
    if (dup !== undefined) { if (sel) dup.sel = true; continue }
    out.push({ g, x: pxOf(goal.u), y: pxOf(goal.v), shape: lastShape[g]!, sel })
  }
  return out
}

// ---- 포인터: 한 손가락/왼쪽 = 고르기 · 오른쪽(PC) · 땅 누름(폰) = 보내기 · 두 손가락 = 둘러보기 ----
const ptrs = new Map<number, { x: number; y: number }>()
let drag: { id: number; x0: number; y0: number; x: number; y: number; mouse: boolean; box: boolean; moved: boolean } | null = null
let two: { sx: number; sy: number; cx: number; cy: number } | null = null

function midOf(): { x: number; y: number } {
  let sx = 0, sy = 0
  for (const p of ptrs.values()) { sx += p.x; sy += p.y }
  return { x: sx / ptrs.size, y: sy / ptrs.size }
}
function onDown(e: PointerEvent): void {
  if (blocked || ui.phase === 'end' || cur.end !== null || helpOpen) return
  if (!forceTouch) touchMode = e.pointerType !== 'mouse'
  if (aiming === -1 && e.timeStamp < aimGraceUntil) return // 막 취소된 직후의 누름: 적을 찍으려던 손가락이 장수를 보내지 않게
  if (aiming !== -1) {
    const kind = e.pointerType === 'mouse' && e.button === 2 ? 'cancel' : e.pointerType !== 'mouse' || e.button === 0 ? 'confirm' : null
    if (kind !== null) { const r = aimTap(aiming, kind); if (r.act === 'cancel') cancelAim(); else if (r.act === 'confirm') confirmAim(e.clientX, e.clientY, e.timeStamp) }
    return
  }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (e.pointerType !== 'mouse' && ptrs.size >= 2) {
    drag = null
    const m = midOf()
    two = { sx: m.x, sy: m.y, cx: pan?.x ?? tgt?.x ?? cam.x, cy: pan?.y ?? tgt?.y ?? cam.y }
    return
  }
  if (e.pointerType === 'mouse' && e.button === 2) { sendAt(e.clientX, e.clientY, e.timeStamp); return }
  if (e.pointerType === 'mouse' && e.button !== 0) return
  drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, mouse: e.pointerType === 'mouse', box: false, moved: false }
  try { cv.setPointerCapture(e.pointerId) } catch { /* 합성 입력 */ }
}
function onMove(e: PointerEvent): void {
  if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.in = true; mouse.at = e.timeStamp }
  const p = ptrs.get(e.pointerId)
  if (p !== undefined) { p.x = e.clientX; p.y = e.clientY }
  if (two !== null) {
    const m = midOf()
    pan = { x: two.cx - (m.x - two.sx) / cam.zoom, y: two.cy - (m.y - two.sy) / cam.zoom, until: Infinity }
    return
  }
  if (drag !== null && drag.id === e.pointerId) {
    drag.x = e.clientX; drag.y = e.clientY
    const far = (drag.x - drag.x0) ** 2 + (drag.y - drag.y0) ** 2 >= P.field.dragMinPx * P.field.dragMinPx
    if (far) drag.moved = true
  }
}
function onUp(e: PointerEvent): void {
  ptrs.delete(e.pointerId)
  if (two !== null) {
    if (ptrs.size < 2) { two = null; if (pan !== null) pan.until = camFree || ui.phase === 'ready' ? Infinity : performance.now() + P.field.panBackMs }
    return
  }
  if (drag === null || drag.id !== e.pointerId) return
  const d = drag
  drag = null
  const cands = pickCands()
  if (d.moved) return
  const hit = pickAt(cands, d.x, d.y, P.field.pickRadiusPx, P.field.heroPickPermille)
  if (hit !== -1) { setSel([hit]); return }
  if (d.mouse) { setSel([3]); return }
  // 폰: 고른 채로 땅을 누르면 그 자리로 보낸다 (무리는 한 번 보내면 장수로 돌아온다)
  sendAt(d.x, d.y, e.timeStamp)
}
function onCancel(e: PointerEvent): void {
  ptrs.delete(e.pointerId)
  if (ptrs.size < 2) two = null
  if (drag !== null && drag.id === e.pointerId) drag = null
}

/** 쥐고 있는 네모 (판 px) */
function boxNow(): Box | null { return null }

/** 푼 카메라(또 시작 화면)를 화살표·가장자리로 옮긴다 */
function movePan(dt: number): void {
  if (!(camFree || ui.phase === 'ready')) return
  const held = (names: readonly string[]): boolean => names.some(n => keysHeld.has(n))
  let dx = (held(KEYS.camRight) ? 1 : 0) - (held(KEYS.camLeft) ? 1 : 0), dy = (held(KEYS.camDown) ? 1 : 0) - (held(KEYS.camUp) ? 1 : 0)
  if (mouse.in && !touchMode && !blocked) {
    const e = P.field.camEdgePx
    if (mouse.x < e) dx--; else if (mouse.x > vp.w - e) dx++
    if (mouse.y < e) dy--; else if (mouse.y > vp.h - e) dy++
  }
  if (dx === 0 && dy === 0) return
  const base = pan ?? { x: tgt?.x ?? cam.x, y: tgt?.y ?? cam.y }
  const step = P.field.camPanPxPerSec * dt / cam.zoom
  pan = { x: base.x + dx * step, y: base.y + dy * step, until: Infinity }
}

function paint(now: number, alpha: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const box = boxNow()
  const hv = mouse.in && !touchMode && aiming === -1 && ui.phase !== 'end' && now - mouse.at < P.field.hoverRingMs ? pickAt(pickCands(), mouse.x, mouse.y, P.field.pickRadiusPx, P.field.heroPickPermille) : -1
  if (hv !== hoverG) { hoverG = hv; markEpoch++ }
  if (aiming !== -1 && !touchMode) { aimCur.hidden = false; aimCur.style.transform = `translate(${Math.round(mouse.x - 24)}px,${Math.round(mouse.y - 24)}px)` }
  // 멈춤·끝(잠잠해진 뒤)·가로 안내 중에는 바뀐 것이 없으면 다시 안 그린다
  const calm = paused || frozen(now)
  const k = paintKey
  const selKey = ui.sel.join('')
  const same = calm && box === null && k.x === cam.x && k.y === cam.y && k.z === cam.zoom && k.sel === selKey && k.epoch === markEpoch
  if (!blocked && !same) {
    drawField(ctx, vp, cam, cur, prev, alpha, viewMs, art, low, heroPick, lossAcc)
    lossAcc = []
    drawMarks(ctx, vp, cam, marks(), ALL_GROUPS.map(g => ui.sel.includes(g) ? fromOf(g) : null), ringsNow(now), box, bandsNow(), foeMarks())
    k.x = cam.x; k.y = cam.y; k.z = cam.zoom; k.sel = selKey; k.epoch = markEpoch
  }
  flags.frame(now)
  flags.sync(cur, ui, { line: lineChoice, foeLine: cur.lineup[1], front: ordOf('front') === ORD_CHARGE ? 0 : ordOf('front') === ORD_HOLD ? 1 : -1, volley: ordOf('bows') === ORD_VOLLEY, flank: ordOf('horse') === ORD_FLANK, aiming, sentGroup, touch: touchMode })
  tutorial(now)
  root.classList.toggle('touch', touchMode)
  arrows.sync(offscreenArrows())
  const pb = padBtns()
  pad.sync(!blocked && ui.phase === 'play' && cur.end === null, touchMode, touchMode && !heroOrdered && playMs < 3000, pb.dash, pb.skill, pb.rally, !blocked && ui.phase === 'ready')
  mini.sync(cur, cam, vp, !blocked && !(touchMode && ui.phase === 'ready'), now) // 폰의 준비 화면은 판 전체가 이미 보인다
  hud.sync(lagged(now), { gold: fxGold, blocked: fxBlocked, breakSide: cur.breakTick[0] >= 0 ? 0 : cur.breakTick[1] >= 0 ? 1 : -1 })
  fxGold = false; fxBlocked = false
  flyRegroups()
  hud.frame(now)
  hud.showEnd(endAt > 0 && now - endAt >= P.field.endBoxMs ? cur : null, endStats(), endWhy(), { foe: nextFoeLine(), shout: heroNow()?.art === 'shout' })
  if (!blocked) {
    // 처음 화면의 큰 조작표: 첫 판들의 준비 화면에서 가운데에 크게 · 전투 개시나 첫 장수 입력에 ? 단추로 줄어든다
    const wantBig = ui.phase === 'ready' && helpGames < P.field.helpBigGames && !heroOrdered
    if (bigNow && !wantBig) { helpGames++; try { localStorage.setItem(HELP_KEY, String(helpGames)) } catch { /* 저장 못 해도 판은 돈다 */ } }
    bigNow = wantBig
    help.big(wantBig)
  }
  const h = heroNow()
  const s = h === undefined ? null : toScreen(cam, vp, pxOf(h.u), pxOf(h.v))
  first.sync(!blocked && !bigNow && s !== null && !firstDone && !stepOk[0] && !heroOrdered && (ui.phase === 'ready' || playMs < P.field.firstHintMs) && ui.phase !== 'end' && cur.end === null && !helpOpen, s?.x ?? 0, s?.y ?? 0, touchMode, vp.w, vp.h)
}
/** 활 사거리 띠 (활 대마다 반원) — 적 대가 그 안에 들면 밝아지고, 겨눈 적에게는 가는 줄 */
function bandsNow(): Band[] {
  // 평소에는 안 그린다 — 화살비를 찍는 동안과 활 무리를 고른 동안만 · 무리 가운데 기준 호 하나
  if (aiming !== 2 && !ui.sel.includes(1)) return []
  const bows = squadsOf(1)
  if (bows.length === 0) return []
  const u = bows.reduce((a, q) => a + q.u, 0) / bows.length, v = bows.reduce((a, q) => a + q.v, 0) / bows.length
  return [{ x: pxOf(u), y: pxOf(v), r: P.field.bowRangeCells * P.field.cellPx, face: cur.face, sel: true, lit: false, tx: 0, ty: 0, aim: false }]
}
/** 적장 머리 위 표적 자리 (작은 세모) */
function foeMarks(): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  const head = P.field.soldierCells * P.field.cellPx * P.field.heroScale / 100 * 1.05
  for (const e of cur.heroes) if (e.side === 1 && e.stun === 0) out.push({ x: pxOf(e.u), y: pxOf(e.v) - head })
  return out
}
/** 첫 판 안내 — 처음 세 걸음(지금은 둘) 한 줄과 이기는 법 한 줄 */
/** 적 대가 장수 둘레 engageCells 안에 들었는가 (비기를 써 볼 만한 때) */
/** 장수 비기 이름 (큰 외침 …) */
function artLabel(): string {
  const a = heroNow()?.art ?? 'none'
  return a === 'none' ? t('field.step.3.art') : t(`war.artName.${a}` as Key)
}
function step3Ready(): boolean {
  const h = heroNow()
  if (h === undefined) return false
  const r = P.field.engageCells * P.field.unit
  return cur.squads.some(q => q.side === 1 && q.men > 0 && (q.u - h.u) * (q.u - h.u) + (q.v - h.v) * (q.v - h.v) <= r * r)
}
function tutorial(now: number): void {
  if (tutDone) { steps.sync(false, null, false); return }
  const play = ui.phase === 'play'
  if (play && !stepOk[0] && heroOrdered && heroMovedNow()) { stepOk[0] = true; flashStep = 0; flashAt = now }
  if (play && !stepOk[1] && usedCharge) { stepOk[1] = true; stepOk[0] = true; flashStep = 1; flashAt = now }
  const hz0 = heroNow()
  if (play && !stepOk[2] && hz0 !== undefined && hz0.artCd > 0) { stepOk[2] = true; stepOk[0] = true; stepOk[1] = true; flashStep = 2; flashAt = now }
  if (play && !stepOk[3] && bashN > 0) { stepOk[3] = true; stepOk[0] = stepOk[1] = stepOk[2] = true; flashStep = 3; flashAt = now }
  const flashing = flashStep >= 0 && now - flashAt < P.field.stepFlashMs
  const next = stepOk.indexOf(false)
  // 셋째 걸음은 적 대가 비기 범위 안에 든 뒤에야 뜨고, 한 번 뜨면 쓰기 전에는 안 사라진다
  if (next === 2 && !step3Latched && step3Ready()) step3Latched = true
  // 넷째 걸음(밀침)도 적 대가 곁에 들어온 뒤에 뜬다
  if (next === 3 && !step4Latched && step3Ready()) step4Latched = true
  if (next === -1 && !flashing) {
    tutDone = true
    try { localStorage.setItem(TUT_KEY, '1'); localStorage.setItem(TUT4_KEY, '1') } catch { /* 저장 못 해도 이 판에서만 */ }
    steps.sync(false, null, false); return
  }
  const showStep = ui.phase === 'end' || cur.end !== null ? -1 : flashing ? flashStep : (next === 2 && !step3Latched) || (next === 3 && !step4Latched) ? -1 : next
  steps.sync(ui.phase !== 'end' && cur.end === null && playMs < P.field.goalMs, showStep < 0 ? null : showStep === 1 ? t(touchMode ? 'field.step.2.touch' : 'field.step.2', { k: firstKeyLabel('cmd1') }) : showStep === 2 ? t(touchMode ? 'field.step.3.touch' : 'field.step.3', { k: firstKeyLabel('skillQ'), art: artLabel() }) : t(`field.step.${showStep + 1}` as Key), flashing)
}
/** 위쪽 숫자·사기 띠가 읽는 판 — 점이 먼저 쓰러지고 숫자가 따라가도록 numLagMs 전의 것 (판 값은 안 바꾼다) */
function lagged(now: number): VModel {
  if (hist.length === 0 || hist[hist.length - 1]!.m !== cur) hist.push({ t: now, m: cur })
  while (hist.length > 1 && hist[1]!.t <= now - P.field.numLagMs) hist.shift()
  return cur.end !== null ? cur : hist[0]!.m
}
/** 끝 상자의 숫자: 쓰러뜨린 적 · 잃은 우리 병사 (처음 사람 수와 지금 사람 수의 차) */
/** 끝 상자의 까닭: 진 판은 우리 편이 입은 까닭 · 이긴 판은 적 편이 입은 까닭 */
function endWhy(): EndWhy | undefined {
  if (cur.end === null || cur.winner < 0) return undefined
  const won = cur.winner === 0
  noteBreak()
  return { by: cur.stats.moraleBy[won ? 1 : 0], won, morale: breakMor ?? cur.morale }
}
/** 어느 편이 처음 무너진 틱의 두 편 사기를 붙잡는다 (끝 상자는 갈린 순간의 숫자를 보인다 · 달아나는 3초 동안 바뀐 값이 아니라) */
function noteBreak(): void {
  if (breakMor === null && (cur.breakTick[0] >= 0 || cur.breakTick[1] >= 0)) breakMor = [cur.morale[0], cur.morale[1]]
}
/** 다시 선 대: 그 대 몸 위에 「+N」(편 사기가 오른 %p · 반올림 · 적어도 1)을 띄워 그 편 막대로 날려 보낸다 */
function flyRegroups(): void {
  for (const f of flyQ) {
    const q = cur.squads[f.id]
    if (q === undefined || q.morale0 <= 0) continue
    let menMax = 0
    for (const e of cur.squads) if (e.side === q.side) menMax += e.menMax
    const up = Math.max(1, Math.round(f.n * q.menMax * 100 / Math.max(1, menMax) / q.morale0))
    const s = toScreen(cam, vp, pxOf(q.u), pxOf(q.v) - P.field.soldierCells * P.field.cellPx * 1.2)
    if (s.x < 0 || s.x > vp.w || s.y < 0 || s.y > vp.h) continue
    hud.fly(s.x, s.y, up, q.side)
  }
  flyQ.length = 0
}
function endStats(): EndStats | undefined {
  if (cur.end === null) return undefined
  const st = cur.stats
  const h = heroNow()
  return { killed: st.killed[0], lost: st.lost[0], flank: st.flankHits[0], art: Math.round(st.artMorale[0] / 10), stand: cur.stood[0], regroup: cur.squads.filter(q => q.side === 0 && q.regrouped === 1).length, grit: h?.gritN ?? 0, bash: bashN }
}
/** 그 무리의 지금 명령 ORD_* (엔진이 정한 것 · 대마다 같다) */
function ordOf(grp: string): number {
  const q = cur.squads.find(e => e.side === 0 && e.grp === grp && e.men > 0 && e.flee === 0)
  if (q === undefined) return 0
  // 엔진이 끝난 명령을 되돌리기 전에는 「맞물려 있거나 받은 지 orderLitSec 초 안」일 때만 걸린 것으로 본다
  return q.aim >= 0 || cur.tick - q.orderTick <= P.field.hz * P.field.orderLitSec ? q.order : 0
}
/** 화면 밖에 있는 우리 무리의 가장자리 화살표 자리 */
function offscreenArrows(): { g: number; x: number; y: number; rot: number; icon: string }[] {
  const out: { g: number; x: number; y: number; rot: number; icon: string }[] = []
  if (blocked || ui.phase === 'end' || cur.end !== null) return out
  const m = 36, cx = vp.w / 2, cy = vp.h / 2
  for (const g of [0, 1, 2] as const) {
    const mine = squadsOf(g)
    if (mine.length === 0) continue
    const s = toScreen(cam, vp, pxOf(mine.reduce((a, q) => a + q.u, 0) / mine.length), pxOf(mine.reduce((a, q) => a + q.v, 0) / mine.length))
    if (s.x >= -4 && s.x <= vp.w + 4 && s.y >= -4 && s.y <= vp.h + 4) continue
    const dx = s.x - cx, dy = s.y - cy
    const k = Math.min((cx - m) / Math.max(1, Math.abs(dx)), (vp.h / 2 - m) / Math.max(1, Math.abs(dy)))
    out.push({ g, x: cx + dx * k, y: cy + dy * k, rot: Math.atan2(dy, dx), icon: ['icon/unit-spear.png', 'icon/unit-archer.png', 'icon/unit-buyeo-cavalry.png'][g]! })
  }
  return out
}
function heroMovedNow(): boolean {
  const h = heroNow()
  if (h === undefined || heroStart === null) return false
  return h.goal !== null || h.u !== heroStart.u || h.v !== heroStart.v
}

/** 끝나고 쓰러진 병사까지 사라진 뒤에는 그림이 더 안 바뀐다 */
const frozen = (now: number): boolean => endAt > 0 && now - endAt > P.field.endSlowMs + P.field.corpseMs + 600

function frame(now: number): void {
  raf = 0
  if (document.hidden) return
  raf = requestAnimationFrame(frame)
  const dtMs = last === 0 ? 0 : now - last
  last = now
  watchLoad(dtMs)
  const stepMs = 1000 / P.field.hz
  if (heroStart === null) { const h = heroNow(); if (h !== undefined) heroStart = { u: h.u, v: h.v } }
  if (aimExpired(aiming, aimSince, now, touchMode ? P.field.aimTouchMs : P.field.aimMs)) { cancelAim(); aimGraceUntil = now + P.field.aimGraceMs }
  const simMs = (aiming !== -1 ? dtMs * P.field.aimSlowPermille / 1000 : slow ? dtMs * P.field.slowPermille / 1000 : dtMs)
  if (!paused && !helpOpen && !blocked && cur.end === null && ui.phase === 'play') {
    const a = advance(acc, simMs, P.field.hz, P.field.maxCatchUpTicks)
    acc = a.acc
    for (let i = 0; i < a.ticks && state.end === null; i++) {
      stepField(state, queue)
      // 이번 틱에 들어간 입력은 줄에서 뺀다 (sim 이 틱 번호가 같은 것만 받는다)
      if (queue.length > 0) queue = queue.filter(q => q.tick >= state.tick)
      prev = cur; cur = readField(state)
      if (cur.loss.length > 0) lossAcc.push(...cur.loss)
      for (const ev of cur.events) {
        if (ev.kind === 'impact') { if (ev.how === 1) fxGold = true; else if (ev.how === 2) fxBlocked = true }
        else if (ev.kind === 'regroup') flyQ.push({ id: ev.id, n: ev.n })
        else if (ev.kind === 'heroBash' && ev.side === 0) bashN++
      }
      noteBreak()
    }
    if (cur.end !== null) { ui.phase = 'end'; drag = null; endAt = now; fsnd.end(cur.winner === 0) }
  }
  // 틱이 바뀌었거나 깃발을 새로 꽂았을 때 한 번 (시작 화면에서 꽂은 깃발 소리도 바로 나게)
  if (!paused && !blocked && (state.tick !== soundTick || markEpoch !== soundEpoch)) {
    soundTick = state.tick; soundEpoch = markEpoch
    fsnd.frame(soundFrameOf(state, cur.edge, cur.morale, [bladeLeftOf(cur, 0), bladeLeftOf(cur, 1)]), soundCamOf(cam, vp, bounds()), null, now)
  }
  if (ui.phase === 'play' && !paused && !helpOpen) playMs += Math.min(dtMs, 100)
  if (!blocked && ui.phase === 'play' && introLeft > 0) introLeft = Math.max(0, introLeft - Math.min(dtMs, 100))
  const dt = Math.min(dtMs, 100)
  if ((padTick++ & 15) === 0) measurePads()
  // 고른 것이 쓰러지면 장수로 돌아온다 · 장수가 무리 곁을 지나면 그 무리 고리가 튄다
  const keep = normalizeSel(cur, ui.sel)
  if (keep !== ui.sel) { ui.sel = keep; markEpoch++ }
  watchNudge(now)
  walkHero()
  watchWhy(now)
  // 우리 장수가 쓰러지는 틱에 그리는 시계가 잠깐 멈칫한다 (가장 큰 사건)
  const h0 = cur.heroes.find(e => e.side === 0), p0 = prev?.heroes.find(e => e.side === 0)
  if (h0 !== undefined && p0 !== undefined && h0.stun > 0 && p0.stun === 0) hitStopUntil = now + P.field.heroDownStopMs
  if (!paused && !helpOpen && !blocked && !frozen(now) && now >= hitStopUntil) viewMs += endAt > 0 && now - endAt < P.field.endSlowMs ? simMs * P.field.endSlowPermille / 1000 : simMs
  movePan(dt / 1000)
  followTarget(dt / 1000)
  paint(now, blocked ? 1 : Math.min(1, acc / stepMs))
}

function wake(): void {
  if (raf === 0 && !document.hidden) { last = 0; acc = 0; raf = requestAnimationFrame(frame) }
}
// 탭에 돌아오면 밀린 시간을 몰아 돌리지 않는다 (rAF 가 이미 예약돼 있어도 시계를 새로 시작한다)
document.addEventListener('visibilitychange', () => { last = 0; acc = 0; paintKey.x = NaN; keysHeld.clear(); slow = false; wake() })
addEventListener('resize', () => { resize(); wake() })
addEventListener('blur', () => { keysHeld.clear(); slow = false })
addEventListener('pointerdown', () => fsnd.unlock(), true)
addEventListener('keydown', () => fsnd.unlock(), true)
addEventListener('pagehide', () => fsnd.stop())
cv.addEventListener('pointerdown', onDown)
cv.addEventListener('pointermove', onMove)
cv.addEventListener('pointerup', onUp)
cv.addEventListener('pointercancel', onCancel)
cv.addEventListener('pointerleave', () => { mouse.in = false })
cv.addEventListener('contextmenu', e => e.preventDefault())
cv.addEventListener('wheel', e => {
  e.preventDefault()
  if (!(camFree || ui.phase === 'ready') || blocked) return
  const base = pan ?? { x: tgt?.x ?? cam.x, y: tgt?.y ?? cam.y }
  const k = P.field.camWheelMul / 100 / cam.zoom
  pan = { x: base.x + (e.deltaX !== 0 ? e.deltaX : e.deltaY) * k, y: base.y, until: Infinity }
}, { passive: false })

function toggleHelp(): void { help.toggle(); helpOpen = help.isOpen(); paintKey.x = NaN }
addEventListener('keydown', e => {
  if (blocked) return
  keysHeld.add(e.code)
  const a = actionOf(e.code)
  if (a === null) return
  if (a === 'slow') { slow = true; return }
  if (a === 'camLeft' || a === 'camRight' || a === 'camUp' || a === 'camDown') { if (camFree || ui.phase === 'ready') e.preventDefault(); return }
  if (e.repeat) { if (a === 'go') e.preventDefault(); return }
  if (helpOpen && (a === 'pause' || a === 'help')) { e.preventDefault(); toggleHelp(); return }
  e.preventDefault()
  switch (a) {
    case 'pickHero': pickGroup(3); break
    case 'pickFront': case 'pickBows': case 'pickHorse': {
      // 누르고 있는 동안만 그 무리 (떼면 장수로 돌아온다)
      const g = a === 'pickFront' ? 0 : a === 'pickBows' ? 1 : 2
      if (cellWhy(cur, g) === null) { heldPick = g; setSel([g]) } else pickGroup(g)
      break
    }
    case 'rally': doRally(); break
    case 'cmd1': case 'cmd2': case 'cmd3': case 'cmd4': pressBig(Number(a.slice(3)) - 1); break
    case 'pause':
      if (aiming !== -1) { cancelAim(); break }
      paused = !paused; hud.setPaused(paused); break
    case 'go': if (ui.phase === 'end') restart(); else goBattle(); break
    case 'help': toggleHelp(); break
    case 'dash': doDash(); break
    case 'skillQ': doSkill(); break
    case 'skillR': if (ui.phase === 'end') restart(); break // 끝난 뒤 R = 새 판
    default: break // 장수 기술·내닫기·걷기 키는 엔진의 입력 계약이 온 뒤 (묶음 나)
  }
})
addEventListener('keyup', e => {
  const up = actionOf(e.code)
  if (heldPick >= 0 && (up === 'pickFront' || up === 'pickBows' || up === 'pickHorse')) { heldPick = -1; setSel([3]) }
  keysHeld.delete(e.code)
  if (actionOf(e.code) === 'slow') slow = false
  if (e.code === 'Space') e.preventDefault()
})

/** 입력 줄 길이를 재는 손잡이 (시험·보고용): 이번 판에서 받아들인 입력의 기록 */
;(window as unknown as Record<string, unknown>)['__fieldRec'] = (): string => serialize(state.log.accepted)

if (query.has('bench')) {
  /** 그리기 재기: ticks 틱 진행한 판을 draws 번 그리는 데 걸린 평균 ms. whole 이면 판 전체가 한 화면에 드는 배율(점이 다 든다) */
  ;(window as unknown as Record<string, unknown>)['__fieldBench'] = (ticks: number, draws: number, whole = false): { ms: number; dots: number } => {
    for (let i = 0; i < ticks && state.end === null; i++) { stepField(state); prev = cur; cur = readField(state) }
    if (whole) { const b = bounds(); followCam(cam, (b.left + b.right) / 2, (b.top + b.bottom) / 2, 0, vp, b, true, wholeZoom(vp, b)) }
    else { followTarget(0, true) }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    let dots = 0
    const t0 = performance.now()
    for (let i = 0; i < draws; i++) dots = drawField(ctx, vp, cam, cur, prev, 0.5, i * 16, art, low, heroPick)
    return { ms: (performance.now() - t0) / draws, dots }
  }
}

hud = mountHud(root, {
  onZoom: () => { cam.level = nextLevel(cam.level); hud.setZoom(cam.level) },
  onPause: () => { paused = !paused; hud.setPaused(paused) },
  onAgain: restart,
  onNext: (line: number) => { lineChoice = line; restart(); goBattle() },
  onHelp: toggleHelp,
}, import.meta.env.BASE_URL + 'realm/')
hud.setZoom(0)
mini = mountMini(root, { onPan: (x, y) => { const hh = heroNow(); pan = { x, y, until: ui.phase === 'ready' ? Infinity : performance.now() + P.field.miniPanMs }; miniHero = hh === undefined ? null : { u: hh.u, v: hh.v }; paintKey.x = NaN } })
flags = mountFlags(root, import.meta.env.BASE_URL + 'realm/', handlers)
help = mountHelp(root, import.meta.env.BASE_URL + 'realm/')
first = mountFirst(root)
arrows = mountArrows(root, import.meta.env.BASE_URL + 'realm/', g => { const gg = g as InputGroup; if (cellWhy(cur, gg) === null) setSel([gg]) })
aimCur = document.createElement('img')
aimCur.id = 'fd-aimcur'; aimCur.hidden = true; aimCur.alt = ''
aimCur.style.cssText = 'position:absolute;left:0;top:0;width:48px;height:48px;object-fit:contain;pointer-events:none;z-index:7'
root.append(aimCur)
pad = mountPad(root, import.meta.env.BASE_URL + 'realm/', { onDir: d => { padDir = d }, onDash: doDash, onSkill: doSkill, onRally: doRally })
steps = mountSteps(root)
root.append(document.getElementById('fd-rotate') as HTMLElement)
resize()
/** 화면 배율(dpr)이 바뀌면(창을 다른 화면으로 옮김 · 확대) 다시 맞춘다 */
let dprQuery: MediaQueryList | null = null
function watchDpr(): void {
  dprQuery?.removeEventListener('change', onDprChange)
  dprQuery = matchMedia(`(resolution: ${devicePixelRatio}dppx)`)
  dprQuery.addEventListener('change', onDprChange)
}
function onDprChange(): void { resize(); wake(); watchDpr() }
watchDpr()
wake()
;(window as unknown as Record<string, unknown>)['__fieldPads'] = (): { padTop: number; padBottom: number; zoom: number; x: number; y: number; vp: Viewport } => ({ padTop, padBottom, zoom: cam.zoom, x: cam.x, y: cam.y, vp })
