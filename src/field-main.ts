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
import { advance } from './field/viewLoop.ts'
import { readField, type VModel } from './field/viewRead.ts'
import { followCam, frameBox, newCam, nextLevel, toField, wholeZoom, type Rect, type Viewport } from './field/viewCamera.ts'
import { loadArt } from './field/viewArt.ts'
import { drawField, focusPoints, resetFx, worldSize } from './field/view.ts'

startGfxSafe()
guardMedia()

const query = new URLSearchParams(location.search)
const num = (key: string, dflt: number): number => { const v = Number(query.get(key)); return Number.isFinite(v) && query.has(key) ? Math.trunc(v) : dflt }
const root = document.getElementById('field') as HTMLDivElement
root.innerHTML = `<canvas id="fd-cv"></canvas>
<div id="fd-hud"><span id="fd-info"></span><button id="fd-zoom" type="button">자동</button><button id="fd-pause" type="button">멈춤</button><button id="fd-again" type="button">다시</button></div>
<div id="fd-end" hidden><div><h2 id="fd-endtext"></h2><p id="fd-why" hidden></p><button id="fd-again2" type="button">다시</button></div></div>
<div id="fd-rotate" hidden><div><span>↻</span><h2>폰을 가로로 돌려 주세요</h2><p>가로 화면에서 전장을 봅니다.<br>돌리는 동안 전투는 멈춰 있습니다.</p></div></div>`
const style = document.createElement('style')
style.textContent = `
html,body{margin:0;height:100%;background:#10140d;overflow:hidden;font-family:system-ui,sans-serif;color:#f3ecd8}
#field{position:fixed;inset:0}
#fd-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
#fd-hud{position:absolute;left:8px;top:calc(8px + env(safe-area-inset-top));display:flex;gap:6px;align-items:center;font-size:13px}
#fd-hud[hidden]{display:none}
#fd-hud button,#fd-end button{font:inherit;color:inherit;background:#0009;border:1px solid #fff4;border-radius:6px;padding:6px 10px;min-height:32px}
#fd-hud button.on{border-color:#ffd27a;color:#ffd27a}
#fd-info{background:#0009;border-radius:6px;padding:6px 8px}
#fd-end{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
#fd-end[hidden]{display:none}
#fd-end>div{background:#000c;border:1px solid #ffd27a88;border-radius:10px;padding:14px 26px;text-align:center;pointer-events:auto}
#fd-end h2{margin:0 0 10px;font-size:24px}
#fd-end p{margin:0 0 10px;font-size:14px}
#fd-end button{min-width:96px;min-height:40px;font-size:16px;border-color:#ffd27a;color:#ffd27a}
#fd-rotate{position:absolute;inset:0;background:#10140df0;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 16px;box-sizing:border-box}
#fd-rotate[hidden]{display:none}
#fd-rotate span{font-size:44px}
#fd-rotate h2{margin:8px 0;font-size:20px}
#fd-rotate p{margin:0;font-size:14px;line-height:1.5}
`
document.head.append(style)

const cv = document.getElementById('fd-cv') as HTMLCanvasElement
const ctx = cv.getContext('2d') as CanvasRenderingContext2D
const hud = document.getElementById('fd-hud') as HTMLDivElement
const info = document.getElementById('fd-info') as HTMLSpanElement
const rotate = document.getElementById('fd-rotate') as HTMLDivElement
const endBox = document.getElementById('fd-end') as HTMLDivElement
const endText = document.getElementById('fd-endtext') as HTMLHeadingElement
const zoomBtn = document.getElementById('fd-zoom') as HTMLButtonElement
const pauseBtn = document.getElementById('fd-pause') as HTMLButtonElement
const ZOOM_NAME = ['자동', '가까이', '더 가까이']

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
const bounds = (): Rect => { const w = worldSize(cur); return { left: 0, top: 0, right: w.w, bottom: w.h } }
let cam = newCam(vp, bounds())

function resize(): void {
  vp = { w: Math.max(1, innerWidth), h: Math.max(1, innerHeight) }
  dpr = Math.min(devicePixelRatio || 1, low ? 1 : 2)
  cv.width = Math.round(vp.w * dpr); cv.height = Math.round(vp.h * dpr)
  blocked = innerWidth <= P.field.portraitMaxW && innerHeight > innerWidth
  rotate.hidden = !blocked
  hud.hidden = blocked
  cam = newCam(vp, bounds(), cam.level)
  followTarget(0, true)
}

/** 처음 2초는 판 전체 · 그 뒤는 맞붙은 곳(없으면 우리 진영)을 화면에 담는다. 단추로 고정 배율도 고른다 */
function followTarget(dt: number, snap = false): void {
  const b = bounds()
  if (introLeft > 0 || ui.phase === 'ready') {
    followCam(cam, (b.left + b.right) / 2, (b.top + b.bottom) / 2, dt, vp, b, snap, wholeZoom(vp, b))
    return
  }
  const f = focusPoints(cur)
  const box = frameBox(vp, b, f.xs, f.ys, P.field.frameMarginCells * P.field.cellPx)
  if (box === null) { followCam(cam, cam.x, cam.y, dt, vp, b, snap); return }
  followCam(cam, box.x, box.y, dt, vp, b, snap, cam.level === 0 ? box.zoom : undefined)
}

function restart(): void {
  seed++
  state = createField(plainSetup(seed, men, true, makeMap())); cur = readField(state); prev = null; acc = 0
  resetFx()
  introLeft = P.field.introMs
  ui.phase = 'ready'; ui.sel = -1; ui.popup = false
  queue = []; plan = [[], [], [], []]; lastMove = [-1, -1, -1, -1]; press = null
  lastGoal.fill(null); lastIntent.fill('move')
  endBox.hidden = true
  followTarget(0, true)
}

const gaps: number[] = []
function watchLoad(dtMs: number): void {
  if (low || dtMs <= 0 || dtMs > 500) return
  gaps.push(dtMs)
  if (gaps.length < 60) return
  const mid = [...gaps].sort((a, b) => a - b)[30]!
  gaps.length = 0
  if (mid > P.field.lowFrameMs) { low = true; resize() }
}

function showEnd(): void {
  if (cur.end === null) { endBox.hidden = true; return }
  endBox.hidden = false
  endText.textContent = cur.winner === 0 ? '이겼습니다' : cur.winner === 1 ? '졌습니다' : '비겼습니다'
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
  if (sel === -1) { flags.say(t('field.why.nosel'), 'why', e.timeStamp); return }
  ui.popup = false
  press = { id: e.pointerId, g: sel, x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY, t0: e.timeStamp }
  try { cv.setPointerCapture(e.pointerId) } catch { /* 합성 입력 */ }
}
function onMove(e: PointerEvent): void {
  if (press !== null && press.id === e.pointerId) { press.cx = e.clientX; press.cy = e.clientY }
}
function onUp(e: PointerEvent): void {
  if (press === null || press.id !== e.pointerId) return
  const p = pressNow(e.timeStamp, e.clientX, e.clientY)
  press = null
  flags.live(null)
  if (p === null) return
  commit(p.r, e.timeStamp, p.r.inputs.length > 0 ? { u: Math.max(0, Math.min(cur.mapUUnits, p.ux)), v: Math.max(0, Math.min(cur.mapVUnits, p.vy)) } : null)
}

function paint(now: number, alpha: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawField(ctx, vp, cam, cur, prev, alpha, now, art, low, heroPick)
  const live = press === null ? null : pressNow(now, press.cx, press.cy)
  const from = ui.sel >= 0 ? fromOf(ui.sel) : null
  drawMarks(ctx, vp, cam, marks(), from, live === null ? null : live.mg)
  flags.live(live === null ? null : live.r.why !== null ? whyText(live.r.g, live.r.why) : intentText(live.r.g, live.r.intent))
  flags.frame(now)
  flags.sync(cur, ui, usedNow(), frontStanceNow())
  const side = (s: number): number => cur.squads.reduce((a, q) => a + (q.side === s ? q.men : 0), 0)
  info.textContent = `우리 ${side(0).toLocaleString()} · 적 ${side(1).toLocaleString()}`
  showEnd()
}

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
    if (cur.end !== null) { ui.phase = 'end'; press = null; flags.live(null) }
  }
  if (!blocked && ui.phase === 'play' && introLeft > 0) introLeft = Math.max(0, introLeft - Math.min(dtMs, 100))
  followTarget(Math.min(dtMs, 100) / 1000)
  paint(now, paused || blocked ? 1 : Math.min(1, acc / stepMs))
}

function wake(): void {
  if (raf === 0 && !document.hidden) { last = 0; acc = 0; raf = requestAnimationFrame(frame) }
}
document.addEventListener('visibilitychange', wake)
addEventListener('resize', () => { resize(); wake() })
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
zoomBtn.addEventListener('click', () => { cam.level = nextLevel(cam.level); zoomBtn.textContent = ZOOM_NAME[cam.level] ?? ''; zoomBtn.classList.toggle('on', cam.level > 0) })
pauseBtn.addEventListener('click', () => { paused = !paused; pauseBtn.classList.toggle('on', paused) })
document.getElementById('fd-again')!.addEventListener('click', restart)
document.getElementById('fd-again2')!.addEventListener('click', restart)

/** 입력 줄 길이를 재는 손잡이 (시험·보고용): 이번 판에서 받아들인 입력의 기록 */
;(window as unknown as Record<string, unknown>)['__fieldRec'] = (): string => serialize(state.log.accepted)

if (query.has('bench')) {
  /** 그리기 재기: ticks 틱 진행한 판을 draws 번 그리는 데 걸린 평균 ms. whole 이면 판 전체가 한 화면에 드는 배율(점이 다 든다) */
  ;(window as unknown as Record<string, unknown>)['__fieldBench'] = (ticks: number, draws: number, whole = false): { ms: number; dots: number } => {
    for (let i = 0; i < ticks && state.end === null; i++) { stepField(state); prev = cur; cur = readField(state) }
    if (whole) { const b = bounds(); introLeft = 1; followCam(cam, (b.left + b.right) / 2, (b.top + b.bottom) / 2, 0, vp, b, true, wholeZoom(vp, b)) }
    else { introLeft = 0; followTarget(0, true) }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    let dots = 0
    const t0 = performance.now()
    for (let i = 0; i < draws; i++) dots = drawField(ctx, vp, cam, cur, prev, 0.5, i * 16, art, low, heroPick)
    return { ms: (performance.now() - t0) / draws, dots }
  }
}

flags = mountFlags(root, import.meta.env.BASE_URL + 'realm/', handlers)
root.append(document.getElementById('fd-rotate') as HTMLElement)
resize()
wake()
