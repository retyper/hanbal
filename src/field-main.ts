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
import { advance } from './field/viewLoop.ts'
import { readField, type VModel } from './field/viewRead.ts'
import { followCam, frameBox, newCam, nextLevel, wholeZoom, type Rect, type Viewport } from './field/viewCamera.ts'
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
  if (introLeft > 0) {
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

function paint(now: number, alpha: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawField(ctx, vp, cam, cur, prev, alpha, now, art, low, heroPick)
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
  if (!paused && !blocked && cur.end === null) {
    const a = advance(acc, dtMs, P.field.hz, P.field.maxCatchUpTicks)
    acc = a.acc
    for (let i = 0; i < a.ticks && state.end === null; i++) { stepField(state); prev = cur; cur = readField(state) }
  }
  if (!blocked && introLeft > 0) introLeft = Math.max(0, introLeft - Math.min(dtMs, 100))
  followTarget(Math.min(dtMs, 100) / 1000)
  paint(now, paused || blocked ? 1 : Math.min(1, acc / stepMs))
}

function wake(): void {
  if (raf === 0 && !document.hidden) { last = 0; acc = 0; raf = requestAnimationFrame(frame) }
}
document.addEventListener('visibilitychange', wake)
addEventListener('resize', () => { resize(); wake() })
cv.addEventListener('pointerdown', () => { introLeft = 0 })
zoomBtn.addEventListener('click', () => { cam.level = nextLevel(cam.level); zoomBtn.textContent = ZOOM_NAME[cam.level] ?? ''; zoomBtn.classList.toggle('on', cam.level > 0) })
pauseBtn.addEventListener('click', () => { paused = !paused; pauseBtn.classList.toggle('on', paused) })
document.getElementById('fd-again')!.addEventListener('click', restart)
document.getElementById('fd-again2')!.addEventListener('click', restart)

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

resize()
wake()
