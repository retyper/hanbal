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
import { cmdInput, mergePlan, sendInputs, CMDS, type CmdGroup, type InputCtx } from './field/input.ts'
import { actionOf, KEYS } from './field/actions.ts'
import { ALL_GROUPS, boxPick, cellWhy, cmdGroup, GRP_OF, normalizeSel, pickAt, type PickCand, type UiState } from './field/pickmodel.ts'
import { mountFlags, type FlagsView } from './field/mainFlags.ts'
import { mountFirst, mountHelp, mountSteps, type First, type Help, type Steps } from './field/mainHelp.ts'
import { drawMarks, type Band, type Box, type Mark, type MarkShape, type Ring } from './field/mainFlagMarks.ts'
import { OP_AUTO, OP_MOVE, type FieldInput, type InputGroup } from './field/types.ts'
import { serialize } from './field/rec.ts'
import { mountHud, type Hud } from './field/mainHud.ts'
import { createFieldSound, soundCamOf, soundFrameOf } from './field/mainSound.ts'
import type { FlagKind } from './field/mainSoundModel.ts'
import { advance } from './field/viewLoop.ts'
import { readField, type VModel } from './field/viewRead.ts'
import { clusterCenter, fitZoom, followCam, frameBox, newCam, nextLevel, toField, toScreen, wholeZoom, type Rect, type Viewport } from './field/viewCamera.ts'
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
const men = num('men', 2000)
let state = createField(plainSetup(seed, men, true, makeMap()))
let cur: VModel = readField(state)
let prev: VModel | null = null
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
let sentFront = false
/** 첫 판 안내 (처음 세 걸음 · 이기는 법 한 줄) — 다 하면 저장하고 다시 안 뜬다 */
const TUT_KEY = 'field.tutorial.v1'
const readTut = (): boolean => { try { return localStorage.getItem(TUT_KEY) === '1' } catch { return false } }
let tutDone = readTut()
const stepOk = [false, false]
let flashStep = -1, flashAt = 0, playMs = 0
let steps: Steps
let heroOrdered = false
/** 장수가 처음 선 자리 (움직였는지 보려고) · 무리 곁을 지날 때 튀는 고리의 시작 시각 */
let heroStart: { u: number; v: number } | null = null
const nudgeAt = [0, 0, 0, 0]
/** 카메라: 장수를 따라가는 것이 기본 · Tab 은 싸움을 따라감 · Y 는 풀기(화살표·가장자리·휠로 옮긴다) */
let camFree = false
let camFight = false
let helpOpen = false
let slow = false
let touchMode = matchMedia('(pointer: coarse)').matches
const keysHeld = new Set<string>()
const mouse = { x: 0, y: 0, in: false }
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
    raw = { x: pxOf(hero.u) + cur.face * vp.w * P.field.camLeadPermille / 1000 / cam.zoom, y: pxOf(hero.v) }
  }
  if (pan !== null) raw = { x: pan.x, y: pan.y }
  if (tgt === null || snap || pan !== null || direct) tgt = raw
  else { const k = 1 - Math.exp(-P.field.camTargetRate * dt); tgt = { x: tgt.x + (raw.x - tgt.x) * k, y: tgt.y + (raw.y - tgt.y) * k } }
  followCam(cam, tgt.x, tgt.y, dt, vp, b, snap, zt)
}

function restart(): void {
  seed++
  state = createField(plainSetup(seed, men, true, makeMap())); cur = readField(state); prev = null; acc = 0
  resetFx()
  introLeft = P.field.introMs
  fsnd.stop(); soundTick = -1; soundEpoch = markEpoch
  endAt = 0; viewMs = 0; pan = null; tgt = null
  ui.phase = 'ready'; ui.sel = [3]
  queue = []; plan = []
  lastGoal.fill(null); lastShape.fill('move'); nudgeAt.fill(0)
  cmdNow.fill(-1); sentGroup = false; sentFront = false; stepOk.fill(false); flashStep = -1; playMs = 0; heroOrdered = false; heroStart = null
  camFree = false; camFight = false; cam.level = 0; hud.setZoom(0)
  hud.showEnd(null)
  markEpoch++
  followTarget(0, true)
}

const gaps: number[] = []
/** 마지막으로 그린 때의 카메라·고른 것·깃발 표시 (멈춤·끝·가로 안내 중에 같으면 다시 안 그린다) */
const paintKey = { x: NaN, y: NaN, z: NaN, sel: '', epoch: -1 }
let markEpoch = 0
function watchLoad(dtMs: number): void {
  if (low || dtMs <= 0 || dtMs > 500) return
  gaps.push(dtMs)
  if (gaps.length < 60) return
  const mid = [...gaps].sort((a, b) => a - b)[30]!
  let long = 0
  for (const g of gaps) if (g > P.field.lowLongMs) long++
  gaps.length = 0
  // 가운데값이 느리거나, 긴 프레임이 잦으면(들쭉날쭉) 저사양으로 내린다
  if (mid > P.field.lowFrameMs || long * 1000 > P.field.lowLongPermille * 60) { low = true; resetFx(); resize() }
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
  else queue.push(...inputs)
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
    out.push({ g, x: s.x, y: s.y, reach: 0 })
  }
  return out
}

/** 누른 곳(화면 px) 가까이의 적 대·적장의 자리 (sim 단위) · 없으면 null */
function enemyAt(px: number, py: number): { u: number; v: number } | null {
  let best: { u: number; v: number } | null = null, bestD2 = Infinity
  const reach = P.field.spreadVCells * P.field.cellPx * cam.zoom
  for (const q of cur.squads) {
    if (q.side !== 1 || q.men <= 0) continue
    const s = toScreen(cam, vp, pxOf(q.u), pxOf(q.v))
    const d2 = (s.x - px) ** 2 + (s.y - py) ** 2, r = P.field.sendAttackPx + reach
    if (d2 <= r * r && d2 < bestD2) { bestD2 = d2; best = { u: q.u, v: q.v } }
  }
  for (const e of cur.heroes) {
    if (e.side !== 1) continue
    const s = toScreen(cam, vp, pxOf(e.u), pxOf(e.v))
    const d2 = (s.x - px) ** 2 + (s.y - py) ** 2, r = P.field.sendAttackPx
    if (d2 <= r * r && d2 < bestD2) { bestD2 = d2; best = { u: e.u, v: e.v } }
  }
  return best
}

/** 고른 것을 누른 곳(화면 px)으로 보낸다 — 적 위면 그 적 쪽으로 (엔진에 「쳐라」가 오면 그것으로 바꾼다) */
function sendAt(px: number, py: number, now: number): void {
  const w = toField(cam, vp, px, py)
  const foe = enemyAt(px, py)
  const u = foe === null ? unitsOf(w.x) : foe.u, v = foe === null ? unitsOf(w.y) : foe.v
  const sel = ui.sel
  accept(sendInputs(sel, u, v, inputCtx()))
  const goal = { u: Math.max(0, Math.min(cur.mapUUnits, u)), v: Math.max(0, Math.min(cur.mapVUnits, v)) }
  for (const g of sel) { lastGoal[g] = goal; if (g !== 0 || cmdNow[0]! < 0) lastShape[g] = 'move' }
  if (sel.includes(0) && ui.phase === 'play') sentFront = true
  if (sel.includes(3)) heroOrdered = true
  if (sel.some(g => g < 3)) sentGroup = true
  fsnd.order((sel.length === 1 && sel[0] === 2 ? 'horse' : 'move') as FlagKind)
  flags.say(sel.length > 1 ? t('field.say.many', { n: sel.length }) : t('field.say', { g: gName(sel[0]!), i: t(foe === null ? 'field.i.move' : 'field.i.chase') }), 'ok', now)
}

/** 명령 단추 (또는 Z X C V) — g 무리의 idx 번째 명령 · 같은 명령을 다시 누르면 알아서 */
function pressCmd(g: CmdGroup, idx: number): void {
  const now = performance.now()
  const why = cellWhy(cur, g)
  if (why !== null) { flags.say(t(`field.why.${why}` as Key, { g: gName(g) }), 'why', now); return }
  const name = CMDS[g]![idx]
  if (name === undefined) return
  const i = cmdInput(g, idx, cmdNow[g]!, inputCtx())
  accept([i])
  if (i.op === OP_AUTO) {
    cmdNow[g] = -1; if (g === 0) lastShape[0] = 'move'
    lastGoal[g] = null
    flags.say(t('field.say.auto', { g: gName(g) }), 'ok', now)
  } else {
    cmdNow[g] = idx
    if (g === 0) lastShape[0] = STANCE_SHAPE[idx]!
    fsnd.order((g === 0 ? name : g === 2 ? 'horse' : 'move') as FlagKind)
    // 엔진이 이 명령을 아직 안 받아도 입력은 보내고, 그 명령의 뜻을 한 줄로 보인다
    flags.say(t('field.say.cmd', { g: gName(g), c: t(`war.cmdName.${name}` as Key), s: t(`war.cmdShort.${name}` as Key) }), 'ok', now)
  }
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
  onCmd: pressCmd,
  onGo: goBattle,
}

/** 고른 것 발밑 금빛 고리 + 장수가 무리 곁을 지날 때 한 번 튀는 「눌러 봐」 고리 */
function ringsNow(now: number): Ring[] {
  const out: Ring[] = []
  const c = P.field.cellPx
  for (const g of ui.sel) {
    if (g === 3) {
      const h = heroNow()
      if (h !== undefined) out.push({ x: pxOf(h.u), y: pxOf(h.v), rx: P.field.ringHeroCells * c, ry: P.field.ringHeroCells * c * 0.45, kind: 'sel', phase: 0 })
    } else for (const q of squadsOf(g)) out.push({ x: pxOf(q.u), y: pxOf(q.v), rx: (P.field.spreadUCells + 2) * c, ry: (P.field.spreadVCells + 1.5) * c, kind: 'sel', phase: 0 })
  }
  if (ui.phase === 'play' && !sentGroup) {
    for (const g of [0, 1, 2] as const) {
      if (nudgeAt[g]! > 0 && now - nudgeAt[g]! < P.field.nudgeMs) {
        for (const q of squadsOf(g)) out.push({ x: pxOf(q.u), y: pxOf(q.v), rx: (P.field.spreadUCells + 2) * c, ry: (P.field.spreadVCells + 1.5) * c, kind: 'nudge', phase: (now - nudgeAt[g]!) / P.field.nudgeMs })
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
  for (const g of ALL_GROUPS) {
    const goal = lastGoal[g]
    if (goal == null || !flagShown(g)) continue
    out.push({ g, x: pxOf(goal.u), y: pxOf(goal.v), shape: lastShape[g]!, sel: ui.sel.includes(g) })
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
  touchMode = e.pointerType !== 'mouse'
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
  if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.in = true }
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
    if (far) { drag.moved = true; if (drag.mouse) drag.box = true }
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
  if (d.box) {
    const got = boxPick(cands, d.x0, d.y0, d.x, d.y)
    if (got.length > 0) setSel(got)
    return
  }
  if (d.moved) return
  const hit = pickAt(cands, d.x, d.y, P.field.pickRadiusPx, P.field.heroPickPermille)
  if (hit !== -1) { setSel([hit]); return }
  if (d.mouse) { setSel([3]); return }
  // 폰: 고른 채로 땅을 누르면 그 자리로 보낸다 (무리는 한 번 보내면 장수로 돌아온다)
  sendAt(d.x, d.y, e.timeStamp)
  if (ui.sel.some(g => g < 3)) setSel([3])
}
function onCancel(e: PointerEvent): void {
  ptrs.delete(e.pointerId)
  if (ptrs.size < 2) two = null
  if (drag !== null && drag.id === e.pointerId) drag = null
}

/** 쥐고 있는 네모 (판 px) */
function boxNow(): Box | null {
  if (drag === null || !drag.box) return null
  const a = toField(cam, vp, drag.x0, drag.y0), b = toField(cam, vp, drag.x, drag.y)
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }
}

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
function setFree(on: boolean): void {
  camFree = on
  if (on) { camFight = false; pan = { x: tgt?.x ?? cam.x, y: tgt?.y ?? cam.y, until: Infinity } } else if (ui.phase !== 'ready') pan = null
  flags.say(t(on ? 'field.cam.free' : camFight ? 'field.cam.fight' : 'field.cam.hero'), 'ok', performance.now())
}

function paint(now: number, alpha: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const box = boxNow()
  // 멈춤·끝(잠잠해진 뒤)·가로 안내 중에는 바뀐 것이 없으면 다시 안 그린다
  const calm = paused || frozen(now)
  const k = paintKey
  const selKey = ui.sel.join('')
  const same = calm && box === null && k.x === cam.x && k.y === cam.y && k.z === cam.zoom && k.sel === selKey && k.epoch === markEpoch
  if (!blocked && !same) {
    drawField(ctx, vp, cam, cur, prev, alpha, viewMs, art, low, heroPick)
    drawMarks(ctx, vp, cam, marks(), ALL_GROUPS.map(g => ui.sel.includes(g) ? fromOf(g) : null), ringsNow(now), box, bandsNow(), foeMarks())
    k.x = cam.x; k.y = cam.y; k.z = cam.zoom; k.sel = selKey; k.epoch = markEpoch
  }
  flags.frame(now)
  flags.sync(cur, ui, { cmd: cmdNow, sentGroup, touch: touchMode })
  tutorial(now)
  hud.sync(cur)
  hud.frame(now)
  hud.showEnd(endAt > 0 && now - endAt >= P.field.endBoxMs ? cur : null)
  const h = heroNow()
  const s = h === undefined ? null : toScreen(cam, vp, pxOf(h.u), pxOf(h.v))
  first.sync(!blocked && s !== null && !heroOrdered && ui.phase !== 'end' && cur.end === null && !helpOpen, s?.x ?? 0, s?.y ?? 0, touchMode, vp.w, vp.h)
}
/** 활 사거리 띠 (활 대마다 반원) — 적 대가 그 안에 들면 밝아지고, 겨눈 적에게는 가는 줄 */
function bandsNow(): Band[] {
  const out: Band[] = []
  const r = P.field.bowRangeCells * P.field.unit, r2 = r * r
  for (const q of cur.squads) {
    if (q.side !== 0 || q.grp !== 'bows' || q.men <= 0) continue
    const tq = q.target >= 0 ? cur.squads[q.target] : undefined
    const aim = tq !== undefined && tq.men > 0 && (tq.u - q.u) ** 2 + (tq.v - q.v) ** 2 <= r2
    const lit = aim || cur.squads.some(e => e.side === 1 && e.men > 0 && (e.u - q.u) ** 2 + (e.v - q.v) ** 2 <= r2)
    out.push({ x: pxOf(q.u), y: pxOf(q.v), r: P.field.bowRangeCells * P.field.cellPx, face: cur.face, sel: ui.sel.includes(1), lit, aim, tx: aim ? pxOf(tq.u) : 0, ty: aim ? pxOf(tq.v) : 0 })
  }
  return out
}
/** 적장 머리 위 표적 자리 (작은 세모) */
function foeMarks(): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  const head = P.field.soldierCells * P.field.cellPx * P.field.heroScale / 100 * 1.05
  for (const e of cur.heroes) if (e.side === 1 && e.stun === 0) out.push({ x: pxOf(e.u), y: pxOf(e.v) - head })
  return out
}
/** 첫 판 안내 — 처음 세 걸음(지금은 둘) 한 줄과 이기는 법 한 줄 */
function tutorial(now: number): void {
  if (tutDone) { steps.sync(false, null, false); return }
  const play = ui.phase === 'play'
  if (play && !stepOk[0] && heroOrdered && heroMovedNow()) { stepOk[0] = true; flashStep = 0; flashAt = now }
  if (play && !stepOk[1] && sentFront) { stepOk[1] = true; flashStep = 1; flashAt = now }
  const flashing = flashStep >= 0 && now - flashAt < P.field.stepFlashMs
  const next = stepOk.indexOf(false)
  if (next === -1 && !flashing) {
    tutDone = true
    try { localStorage.setItem(TUT_KEY, '1') } catch { /* 저장 못 해도 이 판에서만 */ }
    steps.sync(false, null, false); return
  }
  const showStep = ui.phase === 'end' || cur.end !== null ? -1 : flashing ? flashStep : next
  steps.sync(ui.phase !== 'end' && cur.end === null && playMs < P.field.goalMs, showStep < 0 ? null : t(`field.step.${showStep + 1}` as Key), flashing)
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
  const simMs = slow ? dtMs * P.field.slowPermille / 1000 : dtMs
  if (!paused && !helpOpen && !blocked && cur.end === null && ui.phase === 'play') {
    const a = advance(acc, simMs, P.field.hz, P.field.maxCatchUpTicks)
    acc = a.acc
    for (let i = 0; i < a.ticks && state.end === null; i++) {
      stepField(state, queue)
      // 이번 틱에 들어간 입력은 줄에서 뺀다 (sim 이 틱 번호가 같은 것만 받는다)
      if (queue.length > 0) queue = queue.filter(q => q.tick >= state.tick)
      prev = cur; cur = readField(state)
    }
    if (cur.end !== null) { ui.phase = 'end'; drag = null; endAt = now; fsnd.end(cur.winner === 0) }
  }
  // 틱이 바뀌었거나 깃발을 새로 꽂았을 때 한 번 (시작 화면에서 꽂은 깃발 소리도 바로 나게)
  if (!paused && !blocked && (state.tick !== soundTick || markEpoch !== soundEpoch)) {
    soundTick = state.tick; soundEpoch = markEpoch
    fsnd.frame(soundFrameOf(state, cur.edge), soundCamOf(cam, vp, bounds()), null, now)
  }
  if (ui.phase === 'play' && !paused && !helpOpen) playMs += Math.min(dtMs, 100)
  if (!blocked && ui.phase === 'play' && introLeft > 0) introLeft = Math.max(0, introLeft - Math.min(dtMs, 100))
  const dt = Math.min(dtMs, 100)
  if ((padTick++ & 15) === 0) measurePads()
  // 고른 것이 쓰러지면 장수로 돌아온다 · 장수가 무리 곁을 지나면 그 무리 고리가 튄다
  const keep = normalizeSel(cur, ui.sel)
  if (keep !== ui.sel) { ui.sel = keep; markEpoch++ }
  watchNudge(now)
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
  if (e.repeat) { if (a === 'go' || a === 'camFight') e.preventDefault(); return }
  if (helpOpen && (a === 'pause' || a === 'help')) { e.preventDefault(); toggleHelp(); return }
  e.preventDefault()
  switch (a) {
    case 'pickHero': pickGroup(3); break
    case 'pickFront': pickGroup(0); break
    case 'pickBows': pickGroup(1); break
    case 'pickHorse': pickGroup(2); break
    case 'pickAll': {
      const all = ([0, 1, 2] as const).filter(g => cellWhy(cur, g) === null)
      if (all.length > 0) setSel(all)
      break
    }
    case 'cmd1': case 'cmd2': case 'cmd3': case 'cmd4': {
      const g = cmdGroup(cur, ui)
      if (g !== null) pressCmd(g, Number(a.slice(3)) - 1)
      break
    }
    case 'camFree': if (ui.phase !== 'ready') setFree(!camFree); break
    case 'camFight': if (ui.phase !== 'ready') { camFight = !camFight; if (camFree) { camFree = false; pan = null } flags.say(t(camFight ? 'field.cam.fight' : 'field.cam.hero'), 'ok', performance.now()) } break
    case 'pause': paused = !paused; hud.setPaused(paused); break
    case 'go': goBattle(); break
    case 'help': toggleHelp(); break
    default: break // 장수 기술·내닫기·걷기 키는 엔진의 입력 계약이 온 뒤 (묶음 나)
  }
})
addEventListener('keyup', e => {
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
  onHelp: toggleHelp,
})
hud.setZoom(0)
flags = mountFlags(root, import.meta.env.BASE_URL + 'realm/', handlers)
help = mountHelp(root)
first = mountFirst(root)
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
;(window as unknown as Record<string, unknown>)['__fieldPads'] = (): { padTop: number; padBottom: number; zoom: number; vp: Viewport } => ({ padTop, padBottom, zoom: cam.zoom, vp })
