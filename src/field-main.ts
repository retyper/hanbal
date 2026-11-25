/**
 * 전장 시험장 진입점 (field.html) — 본편 전투 실시간화 F3. sim(src/field/sim.ts)을 고정 걸음으로 돌리고 화면에 그린다.
 * 주소: ?men=2000 (한 편 사람 수) · ?seed=7 · ?map=meet|cross|stake|high|ambush (ambush=0 이면 기습 실패) · ?hero=<띠 열쇠> · ?gfx=low · ?bench (그리기 재기: window.__fieldBench)
 * 숨은 탭에서는 rAF 를 예약하지 않고(규칙 4) 돌아오면 밀린 시간을 몰아 돌리지 않는다.
 */
import { P } from './tune/params.ts'
import { startGfxSafe } from './ui/gfxsafe.ts'
import { guardMedia } from './ui/media-guard.ts'
import { plainSetup } from './field/scenario.ts'
import { crossMap, highMap, ambushMap, meetMap, stakeMap } from './field/map.ts'
import { createField, stepField } from './field/sim.ts'
import { t, type Key } from './i18n/index.ts'
import { gestureOf, translateAuto, translateMap, translateStance, type InputCtx, type Intent, type Translated } from './field/input.ts'
import { cellWhy, type UiState } from './field/pickmodel.ts'
import { mountFlags, type FlagsView } from './field/mainFlags.ts'
import { drawMarks, type Gesture as MarkGesture, type Mark, type MarkShape } from './field/mainFlagMarks.ts'
import { OP_MOVE, OP_STANCE, STANCE_CHARGE, type FieldInput, type InputGroup } from './field/types.ts'
import { serialize } from './field/rec.ts'
import { mountHud, type Hud } from './field/mainHud.ts'
import { createFieldSound, soundCamOf, soundFrameOf } from './field/mainSound.ts'
import type { FlagKind } from './field/mainSoundModel.ts'
import { advance } from './field/viewLoop.ts'
import { readField, type VModel } from './field/viewRead.ts'
import { clusterCenter, fitZoom, followCam, frameBox, newCam, nextLevel, toField, wholeZoom, type Rect, type Viewport } from './field/viewCamera.ts'
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
let panDrag: { id: number; sx: number; sy: number; cx: number; cy: number } | null = null
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
/** 깃발: 시작 화면(ready)에서는 판 전체를 보며 깃발을 꽂고 · 전투 개시를 누르면 play */
const ui: UiState = { phase: 'ready', sel: -1, popup: false }
/** 아직 sim 에 안 들어간 입력 (tick = 다음에 돌 틱) */
let queue: FieldInput[] = []
/** 시작 화면에서 무리마다 꽂아 둔 입력 (같은 무리를 다시 꽂으면 바뀐다) */
let plan: FieldInput[][] = [[], [], [], []]
let lastMove: [number, number, number, number] = [-1, -1, -1, -1]
const lastIntent: Intent[] = ['move', 'move', 'move', 'move']
const lastGoal: Array<{ u: number; v: number } | null> = [null, null, null, null]
/** 쥐고 있는 손가락 (화면 px · 눌린 시각) */
let press: { id: number; g: InputGroup; x: number; y: number; cx: number; cy: number; t0: number } | null = null
let flags: FlagsView
let vp: Viewport = { w: 1, h: 1 }
let dpr = 1
/** 카메라가 갈 수 있는 곳: 판 둘레에 여유를 둔다 (맨 위·옆 대가 잘리지 않게) */
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

/**
 * 시작 화면: 높이에 맞춰 우리 진영 쪽을 보이고(옆으로 끌어 적 쪽을 본다) · 싸우는 중: 맞붙은 곳을 담는다.
 * 가까이 보기는 두 싸움 사이 빈 땅이 아니라 가장 빽빽한 한 무더기를 따른다. 보는 곳은 한 번 더 늦춘다.
 */
function followTarget(dt: number, snap = false): void {
  const b = bounds()
  const now = performance.now()
  if (pan !== null && now >= pan.until) pan = null
  let raw: { x: number; y: number }
  let zt: number | undefined
  if (ui.phase === 'ready') {
    zt = fitZoom(vp, b)
    const ours = cur.squads.filter(q => q.side === 0 && q.men > 0)
    const ox = ours.length === 0 ? (b.left + b.right) / 2 : pxOf(ours.reduce((a, q) => a + q.u, 0) / ours.length)
    const off = (vp.w / 2 - vp.w * P.field.readyAnchorPermille / 1000) / zt
    raw = { x: cur.face === 1 ? ox + off : ox - off, y: (b.top + b.bottom) / 2 }
  } else {
    const f = focusPoints(cur)
    const box = frameBox(vp, b, f.xs, f.ys, P.field.frameMarginCells * P.field.cellPx)
    if (box === null) raw = { x: cam.x, y: cam.y }
    else if (cam.level === 0) { raw = { x: box.x, y: box.y }; zt = box.zoom }
    else raw = clusterCenter(f.xs, f.ys, P.field.clusterCells * P.field.cellPx) ?? { x: box.x, y: box.y }
  }
  if (pan !== null) raw = { x: pan.x, y: pan.y }
  if (tgt === null || snap || pan !== null) tgt = raw
  else { const k = 1 - Math.exp(-P.field.camTargetRate * dt); tgt = { x: tgt.x + (raw.x - tgt.x) * k, y: tgt.y + (raw.y - tgt.y) * k } }
  followCam(cam, tgt.x, tgt.y, dt, vp, b, snap, zt)
}

function restart(): void {
  seed++
  state = createField(plainSetup(seed, men, true, makeMap())); cur = readField(state); prev = null; acc = 0
  resetFx()
  introLeft = P.field.introMs
  fsnd.stop(); soundTick = -1; soundEpoch = markEpoch
  endAt = 0; viewMs = 0; pan = null; panDrag = null; tgt = null
  ui.phase = 'ready'; ui.sel = -1; ui.popup = false
  queue = []; plan = [[], [], [], []]; lastMove = [-1, -1, -1, -1]; press = null
  lastGoal.fill(null); lastIntent.fill('move')
  hud.showEnd(null)
  followTarget(0, true)
}

const gaps: number[] = []
/** 마지막으로 그린 때의 카메라·고른 칸·깃발 표시 (멈춤·끝·가로 안내 중에 같으면 다시 안 그린다) */
const paintKey = { x: NaN, y: NaN, z: NaN, sel: -2, epoch: -1 }
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

// ---- 깃발 (F5a): 칸 고르기 → 맵 누르기·길게·끌기 → 입력 줄 ----
const SHAPE: Readonly<Record<Intent, MarkShape>> = { move: 'move', hold: 'hold', charge: 'charge', open: 'open', auto: 'move' }
const unitsOf = (px: number): number => Math.round(px / P.field.cellPx * P.field.unit)
const pxOf = (u: number): number => u / P.field.unit * P.field.cellPx
const gName = (g: number): string => t(`field.g.${g}` as Key)
const frontStanceNow = (): number => {
  for (const list of ui.phase === 'ready' ? plan : [queue]) for (let i = list.length - 1; i >= 0; i--) if (list[i]!.op === OP_STANCE && list[i]!.g === 0) return list[i]!.u
  return cur.squads.find(q => q.side === 0 && q.grp === 'front' && q.men > 0)?.stance ?? STANCE_CHARGE
}
/** 무리마다 이번 때에 쓴 입력 수 (시작 화면에서는 꽂아 둔 것 · 싸우는 중에는 sim 이 센 것 + 줄 선 것) */
function usedNow(): [number, number, number, number] {
  if (ui.phase === 'ready') return [plan[0]!.length, plan[1]!.length, plan[2]!.length, plan[3]!.length]
  const u: [number, number, number, number] = [cur.used[0], cur.used[1], cur.used[2], cur.used[3]]
  for (const i of queue) u[i.g]++
  return u
}
function inputCtx(): InputCtx {
  const ready = ui.phase === 'ready'
  return {
    tick: ready ? 0 : state.tick, face: cur.face,
    used: ready ? [0, 0, 0, 0] : usedNow(), lastMove: ready ? [-1, -1, -1, -1] : lastMove,
    frontStance: frontStanceNow(), mapUUnits: cur.mapUUnits, mapVUnits: cur.mapVUnits,
  }
}
const intentText = (g: number, intent: Intent): string => intent === 'auto' ? t('field.say.auto', { g: gName(g) }) : t('field.say', { g: gName(g), i: t(`field.i.${intent}` as Key) })
const whyText = (g: number, why: 'budget' | 'redirect'): string => t(`field.why.${why}` as Key, { g: gName(g) })

/** 번역 결과를 받아 줄에 더하고 말한다. 시작 화면이면 그 무리의 꽂아 둔 것을 바꾼다 */
function commit(r: Translated, now: number, goal: { u: number; v: number } | null): void {
  if (r.why !== null) { flags.say(whyText(r.g, r.why), 'why', now); return }
  if (r.inputs.length === 0) { flags.say(t('field.note.noStance', { g: gName(r.g) }), 'why', now); return }
  if (ui.phase === 'ready') {
    const keepMove = r.inputs.every(i => i.op === OP_STANCE) ? plan[r.g]!.filter(i => i.op === OP_MOVE) : []
    plan[r.g] = [...keepMove, ...r.inputs]
  } else {
    queue.push(...r.inputs)
    if (r.inputs.some(i => i.op === OP_MOVE)) lastMove[r.g] = state.tick
  }
  markEpoch++
  if (r.intent !== 'auto') fsnd.order((r.g === 2 ? 'horse' : r.intent) as FlagKind)
  if (goal !== null) { lastGoal[r.g] = goal; lastIntent[r.g] = r.intent }
  else if (r.intent === 'auto') lastGoal[r.g] = null
  else if (r.intent !== 'move') lastIntent[r.g] = r.intent
  flags.say(intentText(r.g, r.intent) + (r.note !== null ? ` · ${t(`field.note.${r.note}` as Key, { g: gName(r.g) })}` : ''), 'ok', now)
}

const handlers = {
  onCell(g: InputGroup): void {
    const now = performance.now()
    const why = cellWhy(cur, g)
    if (why !== null) { flags.say(t(`field.why.${why}` as Key, { g: gName(g) }), 'why', now); return }
    if (ui.sel === g) ui.popup = !ui.popup
    else { ui.sel = g; ui.popup = false }
  },
  onStance(g: InputGroup, intent: 'charge' | 'hold' | 'open'): void {
    commit(translateStance(g, intent, inputCtx()), performance.now(), null)
    ui.popup = false
  },
  onAuto(g: InputGroup): void {
    commit(translateAuto(g, inputCtx()), performance.now(), null)
    ui.popup = false
  },
  onGo(): void {
    if (ui.phase !== 'ready') return
    queue = plan.flat()
    plan = [[], [], [], []]
    ui.phase = 'play'; ui.popup = false
    introLeft = 0
    acc = 0
  },
}

/** 쥐고 있는 손가락이 지금 무엇으로 읽히나 (놓지 않은 채로 보이는 미리보기) */
function pressNow(now: number, x: number, y: number): { r: Translated; mg: MarkGesture; ux: number; vy: number } | null {
  if (press === null) return null
  const a = toField(cam, vp, press.x, press.y), b = toField(cam, vp, x, y)
  const moved2 = (x - press.x) ** 2 + (y - press.y) ** 2
  const gest = gestureOf(moved2, now - press.t0)
  const ux = unitsOf(a.x), vy = unitsOf(a.y)
  const r = translateMap(press.g, gest, ux, vy, unitsOf(b.x - a.x), unitsOf(b.y - a.y), inputCtx())
  return { r, ux, vy, mg: { x: a.x, y: a.y, tx: b.x, ty: b.y, arrow: gest === 'drag', ring: gest === 'drag' ? 0 : Math.min(1, (now - press.t0) / P.field.holdMs) } }
}

/** 고른 칸 무리의 자리(점선 시작) */
function fromOf(g: number): { x: number; y: number } | null {
  if (g === 3) { const e = cur.heroes.find(h => h.side === 0); return e ? { x: pxOf(e.u), y: pxOf(e.v) } : null }
  const mine = cur.squads.filter(q => q.side === 0 && q.grp === ['front', 'bows', 'horse'][g] && q.men > 0)
  if (mine.length === 0) return null
  return { x: pxOf(mine.reduce((s, q) => s + q.u, 0) / mine.length), y: pxOf(mine.reduce((s, q) => s + q.v, 0) / mine.length) }
}
function marks(): Mark[] {
  const out: Mark[] = []
  for (const g of [0, 1, 2, 3] as const) {
    const goal = lastGoal[g]
    if (goal == null) continue
    if (ui.phase !== 'ready') {
      const moving = g === 3 ? cur.heroes.some(e => e.side === 0 && e.goal !== null) : cur.squads.some(q => q.side === 0 && q.grp === ['front', 'bows', 'horse'][g] && q.men > 0 && q.goal !== null)
      if (!moving && !queue.some(i => i.g === g && i.op === OP_MOVE)) continue
    }
    out.push({ g, x: pxOf(goal.u), y: pxOf(goal.v), shape: SHAPE[lastIntent[g]!], sel: ui.sel === g })
  }
  return out
}

function onDown(e: PointerEvent): void {
  if (blocked || ui.phase === 'end' || cur.end !== null || press !== null) return
  const sel = ui.sel
  if (sel === -1) {
    panDrag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y }
    try { cv.setPointerCapture(e.pointerId) } catch { /* 합성 입력 */ }
    return
  }
  ui.popup = false
  press = { id: e.pointerId, g: sel, x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY, t0: e.timeStamp }
  try { cv.setPointerCapture(e.pointerId) } catch { /* 합성 입력 */ }
}
function onMove(e: PointerEvent): void {
  if (panDrag !== null && panDrag.id === e.pointerId) {
    const dx = e.clientX - panDrag.sx, dy = e.clientY - panDrag.sy
    if (dx * dx + dy * dy >= P.field.dragMinPx * P.field.dragMinPx || pan !== null) pan = { x: panDrag.cx - dx / cam.zoom, y: panDrag.cy - dy / cam.zoom, until: Infinity }
  }
  if (press !== null && press.id === e.pointerId) { press.cx = e.clientX; press.cy = e.clientY }
}
function onUp(e: PointerEvent): void {
  if (panDrag !== null && panDrag.id === e.pointerId) {
    panDrag = null
    if (pan === null) flags.say(t('field.why.nosel'), 'why', e.timeStamp)
    else if (ui.phase !== 'ready') pan.until = performance.now() + P.field.panBackMs
    return
  }
  if (press === null || press.id !== e.pointerId) return
  const p = pressNow(e.timeStamp, e.clientX, e.clientY)
  press = null
  flags.live(null)
  if (p === null) return
  commit(p.r, e.timeStamp, p.r.inputs.length > 0 ? { u: Math.max(0, Math.min(cur.mapUUnits, p.ux)), v: Math.max(0, Math.min(cur.mapVUnits, p.vy)) } : null)
}

function paint(now: number, alpha: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const live = press === null ? null : pressNow(now, press.cx, press.cy)
  // 멈춤·끝(잠잠해진 뒤)·가로 안내 중에는 바뀐 것이 없으면 다시 안 그린다
  const calm = paused || frozen(now)
  const k = paintKey
  const same = calm && live === null && k.x === cam.x && k.y === cam.y && k.z === cam.zoom && k.sel === ui.sel && k.epoch === markEpoch
  if (!blocked && !same) {
    drawField(ctx, vp, cam, cur, prev, alpha, viewMs, art, low, heroPick)
    drawMarks(ctx, vp, cam, marks(), ui.sel >= 0 ? fromOf(ui.sel) : null, live === null ? null : live.mg)
    k.x = cam.x; k.y = cam.y; k.z = cam.zoom; k.sel = ui.sel; k.epoch = markEpoch
  }
  flags.live(live === null ? null : live.r.why !== null ? whyText(live.r.g, live.r.why) : intentText(live.r.g, live.r.intent))
  flags.frame(now)
  flags.sync(cur, ui, usedNow(), frontStanceNow())
  hud.sync(cur)
  hud.frame(now)
  hud.showEnd(endAt > 0 && now - endAt >= P.field.endBoxMs ? cur : null)
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
  if (!paused && !blocked && cur.end === null && ui.phase === 'play') {
    const a = advance(acc, dtMs, P.field.hz, P.field.maxCatchUpTicks)
    acc = a.acc
    for (let i = 0; i < a.ticks && state.end === null; i++) {
      stepField(state, queue)
      // 이번 틱에 들어간 입력은 줄에서 뺀다 (sim 이 틱 번호가 같은 것만 받는다)
      if (queue.length > 0) queue = queue.filter(q => q.tick >= state.tick)
      prev = cur; cur = readField(state)
    }
    if (cur.end !== null) { ui.phase = 'end'; press = null; flags.live(null); endAt = now; fsnd.end(cur.winner === 0) }
  }
  // 틱이 바뀌었거나 깃발을 새로 꽂았을 때 한 번 (시작 화면에서 꽂은 깃발 소리도 바로 나게)
  if (!paused && !blocked && (state.tick !== soundTick || markEpoch !== soundEpoch)) {
    soundTick = state.tick; soundEpoch = markEpoch
    fsnd.frame(soundFrameOf(state, cur.edge), soundCamOf(cam, vp, bounds()), null, now)
  }
  if (!blocked && ui.phase === 'play' && introLeft > 0) introLeft = Math.max(0, introLeft - Math.min(dtMs, 100))
  const dt = Math.min(dtMs, 100)
  if ((padTick++ & 15) === 0) measurePads()
  // 우리 장수가 쓰러지는 틱에 그리는 시계가 잠깐 멈칫한다 (가장 큰 사건)
  const h0 = cur.heroes.find(e => e.side === 0), p0 = prev?.heroes.find(e => e.side === 0)
  if (h0 !== undefined && p0 !== undefined && h0.stun > 0 && p0.stun === 0) hitStopUntil = now + P.field.heroDownStopMs
  if (!paused && !blocked && !frozen(now) && now >= hitStopUntil) viewMs += endAt > 0 && now - endAt < P.field.endSlowMs ? dt * P.field.endSlowPermille / 1000 : dt
  followTarget(dt / 1000)
  paint(now, blocked ? 1 : Math.min(1, acc / stepMs))
}

function wake(): void {
  if (raf === 0 && !document.hidden) { last = 0; acc = 0; raf = requestAnimationFrame(frame) }
}
// 탭에 돌아오면 밀린 시간을 몰아 돌리지 않는다 (rAF 가 이미 예약돼 있어도 시계를 새로 시작한다)
document.addEventListener('visibilitychange', () => { last = 0; acc = 0; paintKey.x = NaN; wake() })
addEventListener('resize', () => { resize(); wake() })
addEventListener('pointerdown', () => fsnd.unlock(), true)
addEventListener('keydown', () => fsnd.unlock(), true)
addEventListener('pagehide', () => fsnd.stop())
cv.addEventListener('pointerdown', onDown)
cv.addEventListener('pointermove', onMove)
cv.addEventListener('pointerup', onUp)
cv.addEventListener('pointercancel', () => { press = null; flags.live(null) })
addEventListener('keydown', e => {
  if (e.repeat || blocked) return
  if (e.key >= '1' && e.key <= '4') handlers.onCell((Number(e.key) - 1) as InputGroup)
  else if (e.key === 'Escape') { ui.popup = false; ui.sel = -1; press = null; flags.live(null) }
  else if ((e.key === 'Enter' || e.key === ' ') && ui.phase === 'ready') { e.preventDefault(); handlers.onGo() }
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
})
hud.setZoom(0)
flags = mountFlags(root, import.meta.env.BASE_URL + 'realm/', handlers)
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
