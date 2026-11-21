/**
 * 카드 자석 흔들림 (A1 · 형 11-20: 「하스스톤의 여유 + 살아 있는 화면 · 카드 끌 때 자석처럼 흔들림(관성·기울기)」).
 *
 * 카드를 누르면 살짝 눌려 들어가고, 누른 채 끌면 손가락을 고무줄처럼 조금 늦게 따라오며 움직이는 쪽으로 기울고, 들려 그림자가 진다.
 * 놓으면 용수철로 제자리에 돌아온다(작게 넘쳤다가). 컴퓨터는 마우스를 올리면 커서 쪽으로 살짝 끌리며 들린다.
 *
 *  - 움직이는 것은 그 카드 하나의 translate · rotate · scale 속성뿐 — transform 과 따로 노는 속성이라 원래 CSS 의 transform 움직임
 *    (본편 깃발의 들림·눌림·「탁」, 옛 무덤 상자의 들어옴)과 겹치지 않고 곱해진다. 폰에서도 값싸다.
 *  - rAF 는 누르고 있는 동안 · 제자리로 돌아오는 동안만 돈다. 다 멈추면 끄고 꾸밈을 걷는다. 숨은 탭에선 돌지 않는다 (절대 규칙 4).
 *  - 움직임 줄이기(prefers-reduced-motion · .q-calm)면 아무것도 하지 않는다. 저사양(.q-low)이면 그림자·레이어 힌트를 뺀다.
 *  - 숫자는 모두 src/tune/params.ts UI_SWAY.
 *
 * 순수 셈(tether · swayAim · swayStep · swaySettled)과 DOM 몰이(swayOn)는 DOM 없이도 돌아 시험(tests/ui-sway.test.ts)이 잰다.
 */
import { UI_SWAY } from '../../tune/params.ts'

/** 숫자 · 글 · [hz, zeta] 를 넓혀 — 값 몇 개를 바꾼 셈(얼굴 링의 maxTilt)도 받는다 */
type Loose<T> = T extends number ? number : T extends string ? string : T extends readonly [number, number] ? readonly [number, number] : { readonly [K in keyof T]: Loose<T[K]> }
export type SwayCfg = Loose<typeof UI_SWAY>
/** 용수철 [떨림 수 Hz, 감쇠 몫] */
export type Spring = readonly [number, number]
/** rest 제자리 · hover 마우스가 위에 · press 눌렀다 · drag 누른 채 끈다 */
export type SwayMode = 'rest' | 'hover' | 'press' | 'drag'

/** 카드의 지금 꼴 — 비킨 거리(px) · 기울기(도) · 크기 몫과 그 빠르기 */
export interface SwayBody { x: number; y: number; r: number; s: number; vx: number; vy: number; vr: number; vs: number }
/** 가고 싶은 꼴 */
export interface SwayAim { readonly x: number; readonly y: number; readonly r: number; readonly s: number }

export const SWAY_REST: SwayAim = { x: 0, y: 0, r: 0, s: 1 }
export const swayBody = (): SwayBody => ({ x: 0, y: 0, r: 0, s: 1, vx: 0, vy: 0, vr: 0, vs: 0 })

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)

/** 고무줄 — 끈 거리 d(px) → 카드가 따라오는 거리. 멀리 끌수록 덜 따라와 pull·reach 를 넘지 않는다 (자석에 붙들린 듯) */
export const tether = (d: number, c: SwayCfg = UI_SWAY): number => (d * c.pull) / (1 + Math.abs(d) / c.reach)

/** 손가락 빠르기를 거른다 — 이번 프레임에 움직인 거리 dx(px) · 걸린 시간 dt(초) → 걸러진 빠르기(px/초). 멈추면 0 으로 잦아든다 */
export function pointerVel(prev: number, dx: number, dt: number, c: SwayCfg = UI_SWAY): number {
  if (!(dt > 0)) return prev
  return prev + (dx / dt - prev) * (1 - Math.exp(-dt / c.velTau))
}

/**
 * 손의 자리 — 끈 거리(dx·dy: 누른 곳에서) · 걸러진 손 빠르기 pv · 마우스가 카드 가운데에서 떨어진 거리(hx·hy) · 카드 반폭 · 들림 px ·
 * tiltK 기울기 몫(넓은 카드는 덜 기운다 — 끝이 너무 크게 흔들리지 않게 · tiltScale)
 */
export interface SwayInput { readonly dx: number; readonly dy: number; readonly pv: number; readonly hx: number; readonly hy: number; readonly half: number; readonly lift: number; readonly tiltK?: number }

/** 카드 폭(px)에 따른 기울기 몫 — wideRef 폭까지는 그대로, 넓을수록 줄여 끝이 흔들리는 거리를 비슷하게 (wideMin 까지) */
export const tiltScale = (width: number, c: SwayCfg = UI_SWAY): number => (width > c.wideRef ? Math.max(c.wideMin, c.wideRef / width) : 1)

/** 지금 손의 자리에서 카드가 가고 싶은 꼴 — 기울기는 늘 ±maxTilt 안 */
export function swayAim(mode: SwayMode, p: SwayInput, c: SwayCfg = UI_SWAY): SwayAim {
  const k = clamp(p.tiltK ?? 1, 0, 1)
  if (mode === 'press') return { x: 0, y: 0, r: 0, s: c.pressScale }
  if (mode === 'drag') {
    const x = tether(p.dx, c)
    const y = tether(p.dy, c)
    // 오른쪽으로 끌면 시계 방향(윗머리가 가는 쪽으로) — 손을 따라 끌려가며 아래가 처진다
    return { x, y, r: clamp((p.pv * c.tiltPerSpeed + x * c.tiltPerPull) * k, -c.maxTilt, c.maxTilt), s: c.liftScale }
  }
  if (mode === 'hover') {
    const n = p.half > 0 ? clamp(p.hx / p.half, -1, 1) : 0
    return { x: p.hx * c.hoverPull, y: p.hy * c.hoverPull - p.lift, r: clamp(n * c.hoverTilt * k, -c.maxTilt, c.maxTilt), s: c.hoverScale }
  }
  return SWAY_REST
}

/**
 * 용수철 셈 — dt 초를 step 초씩 잘게 (반쯤 맞춘 오일러 · 튀지 않게). pos 는 비킴·크기, rot 는 기울기의 용수철.
 * 기울기는 끝(maxTilt)을 넘으려 하면 끝에 세우고 바깥쪽 빠르기를 버린다 — 어떤 손놀림에도 maxTilt 를 넘지 않는다
 */
export function swayStep(b: SwayBody, a: SwayAim, dt: number, pos: Spring, rot: Spring, c: SwayCfg = UI_SWAY): void {
  let left = clamp(dt, 0, c.maxDt)
  const wp = 2 * Math.PI * pos[0]
  const kp = wp * wp
  const cp = 2 * pos[1] * wp
  const wr = 2 * Math.PI * rot[0]
  const kr = wr * wr
  const cr = 2 * rot[1] * wr
  while (left > 0) {
    const h = Math.min(c.step, left)
    left -= h
    b.vx += (-kp * (b.x - a.x) - cp * b.vx) * h
    b.x += b.vx * h
    b.vy += (-kp * (b.y - a.y) - cp * b.vy) * h
    b.y += b.vy * h
    b.vs += (-kp * (b.s - a.s) - cp * b.vs) * h
    b.s += b.vs * h
    b.vr += (-kr * (b.r - a.r) - cr * b.vr) * h
    b.r += b.vr * h
    if (b.r > c.maxTilt) { b.r = c.maxTilt; if (b.vr > 0) b.vr = 0 } else if (b.r < -c.maxTilt) { b.r = -c.maxTilt; if (b.vr < 0) b.vr = 0 }
  }
}

/** 다 멈췄나 — 가고 싶은 꼴에 닿았고 빠르기도 잦아들었다 */
export function swaySettled(b: SwayBody, a: SwayAim, c: SwayCfg = UI_SWAY): boolean {
  return Math.abs(b.x - a.x) < c.restPx && Math.abs(b.y - a.y) < c.restPx && Math.abs(b.r - a.r) < c.restDeg && Math.abs(b.s - a.s) < c.restScale
    && Math.abs(b.vx) < c.restSpeed && Math.abs(b.vy) < c.restSpeed && Math.abs(b.vr) < c.restSpin && Math.abs(b.vs) < c.restGrow
}

// ───────── DOM 몰이

/** 꾸밈이 붙는 칸 — HTMLElement (시험에선 흉내 낸 것) */
export interface SwayEl {
  readonly style: { translate: string; rotate: string; scale: string; transformOrigin: string }
  readonly classList: { add(...t: string[]): void; remove(...t: string[]): void }
  getBoundingClientRect(): { readonly left: number; readonly top: number; readonly width: number; readonly height: number }
  readonly isConnected: boolean
}

/** 바깥 — 프레임 · 숨은 탭 · 움직임 줄이기 · 저사양 (시험은 흉내 낸 것을 넣는다) */
export interface SwayEnv {
  raf(cb: (t: number) => void): number
  caf(id: number): void
  hidden(): boolean
  calm(): boolean
  low(): boolean
}

/** 이 문서와 (같은 출처의) 바깥 틀 문서 — 열전은 본편 틀 안에서 돈다 (저사양·움직임 줄이기 표시는 본편 .ap 에 있다) */
function docsOf(doc: Document): Document[] {
  const out = [doc]
  try {
    const w = doc.defaultView
    if (w !== null && w.parent !== w && w.parent.document !== undefined) out.push(w.parent.document)
  } catch { /* 다른 출처 */ }
  return out
}
/** 그 표시(.q-low · .q-calm)가 이 문서나 바깥 틀에 있나 */
export const marked = (doc: Document, sel: string): boolean => docsOf(doc).some((d) => d.querySelector(sel) !== null)

let reduceMq: MediaQueryList | null | undefined
const reduced = (): boolean => {
  if (reduceMq === undefined) reduceMq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
  return reduceMq?.matches === true
}
/** 움직임 줄이기 — 기기 설정이나 본편의 .q-calm */
export const calmMotion = (doc: Document = document): boolean => reduced() || marked(doc, '.q-calm')

export function domEnv(doc: Document = document): SwayEnv {
  return {
    raf: (cb) => requestAnimationFrame(cb),
    caf: (id) => cancelAnimationFrame(id),
    hidden: () => doc.hidden,
    calm: () => calmMotion(doc),
    low: () => marked(doc, '.q-low'),
  }
}

export interface Sway {
  /** 눌렀다 (화면 좌표) */
  grab(x: number, y: number): void
  /** 누른 채 움직였다 */
  move(x: number, y: number): void
  /** 놓았다 — 용수철로 제자리 */
  release(): void
  /** 마우스가 위에 (컴퓨터) */
  hover(x: number, y: number): void
  /** 마우스가 떠났다 */
  leave(): void
  /** 곧바로 멈추고 꾸밈을 걷는다 */
  reset(): void
  /** rAF 가 걸려 있나 (시험 · 재기) */
  readonly busy: boolean
  readonly mode: SwayMode
}

export interface SwayOpts {
  /** 마우스를 올렸을 때 들림(px) — CSS 가 이미 들어 올리는 카드는 UI_SWAY.cssLift */
  readonly hoverLift?: number
  /**
   * 손가락 끌기를 브라우저 굴리기에 뺏기지 않게 — 그 카드들의 touch-action (swayCards 만).
   * 'pan-y' 면 옆으로 끄는 것은 흔들림, 위아래는 판 굴리기 그대로 (굴리기가 시작되면 카드는 제자리로)
   */
  readonly touch?: string
}

/** 붙이는 표 — 이름이 다른 화면과 겹치지 않게 swy- (메모리 css-class-collision) */
const ON = 'swy-on'
const GPU = 'swy-gpu'
const LIFT = 'swy-lift'

/** 카드 하나에 흔들림을 붙인다 — 누름·끌기·놓기·마우스 올림을 넘겨주면 그때만 rAF 를 돌린다 */
export function swayOn(el: SwayEl, opts: SwayOpts = {}, env: SwayEnv = domEnv(), c: SwayCfg = UI_SWAY): Sway {
  const b = swayBody()
  let mode: SwayMode = 'rest'
  let raf = 0
  let last = 0
  // 누른 곳 · 손의 지금 자리 · 지난 프레임의 손 자리 · 걸러진 손 빠르기
  let gx = 0
  let gy = 0
  let px = 0
  let py = 0
  let fx = 0
  let pv = 0
  // 마우스를 올리기 시작할 때의 카드 가운데 · 반폭 (카드가 끌려 움직여도 기준은 그대로)
  let home = { cx: 0, cy: 0, half: 0 }
  // 이 카드의 기울기 몫 (넓은 카드는 덜)
  let tiltK = 1
  // touched — 칸에 무엇이든 썼다(걷을 것이 있다) · lit — 이웃 위로 올리는 표를 붙였다
  let touched = false
  let lit = false
  let low = false
  const lift = opts.hoverLift ?? c.hoverLift

  const stop = (): void => {
    if (raf !== 0) env.caf(raf)
    raf = 0
    last = 0
  }
  const clear = (): void => {
    if (!touched) return
    touched = false
    lit = false
    el.style.translate = ''
    el.style.rotate = ''
    el.style.scale = ''
    el.style.transformOrigin = ''
    el.classList.remove(ON, GPU, LIFT)
  }
  const write = (): void => {
    if (!lit) {
      lit = true
      touched = true
      el.classList.add(ON)
      if (!low) el.classList.add(GPU)
    }
    el.style.translate = `${b.x.toFixed(2)}px ${b.y.toFixed(2)}px`
    el.style.rotate = `${b.r.toFixed(2)}deg`
    el.style.scale = b.s.toFixed(4)
  }
  const reset = (): void => {
    stop()
    mode = 'rest'
    Object.assign(b, swayBody())
    pv = 0
    clear()
  }
  const tick = (t: number): void => {
    raf = 0
    // 카드가 판에서 떨어져 나갔거나(고른 뒤 판이 다시 그려짐) 탭이 가려졌다 — 그 자리에서 멈춘다
    if (!el.isConnected || env.hidden()) { reset(); return }
    const dt = last > 0 ? (t - last) / 1000 : c.step
    last = t
    pv = pointerVel(pv, mode === 'drag' ? px - fx : 0, dt, c)
    fx = px
    const a = swayAim(mode, { dx: px - gx, dy: py - gy, pv, hx: px - home.cx, hy: py - home.cy, half: home.half, lift, tiltK }, c)
    const held = mode !== 'rest'
    swayStep(b, a, dt, held ? c.follow : c.back, held ? c.tilt : c.tiltBack, c)
    if (Math.abs(pv) < c.restSpeed && swaySettled(b, a, c)) {
      // 다 멈췄다 — 제자리면 꾸밈을 걷고, 손이 멈춰 있으면 그 꼴로 두고 rAF 를 끈다 (손이 다시 움직이면 깬다)
      Object.assign(b, a)
      b.vx = 0
      b.vy = 0
      b.vr = 0
      b.vs = 0
      pv = 0
      last = 0
      if (mode === 'rest') clear()
      else write()
      return
    }
    write()
    raf = env.raf(tick)
  }
  const wake = (): void => {
    if (raf === 0 && !env.hidden()) raf = env.raf(tick)
  }
  return {
    grab(x, y) {
      if (env.calm() || env.hidden()) return
      low = env.low()
      const q = el.getBoundingClientRect()
      tiltK = tiltScale(q.width / b.s, c)
      mode = 'press'
      gx = px = fx = x
      gy = py = y
      pv = 0
      // 손가락 자리를 돌림의 축으로 — 자석에 붙들린 곳을 축으로 흔들린다
      el.style.transformOrigin = `${(x - q.left - b.x).toFixed(1)}px ${(y - q.top - b.y).toFixed(1)}px`
      touched = true
      wake()
    },
    move(x, y) {
      if (mode !== 'press' && mode !== 'drag') return
      px = x
      py = y
      if (mode === 'press' && Math.hypot(x - gx, y - gy) > c.slop) {
        mode = 'drag'
        if (!low) { el.classList.add(LIFT); touched = true }
      }
      wake()
    },
    release() {
      if (mode === 'rest') return
      mode = 'rest'
      el.classList.remove(LIFT)
      wake()
    },
    hover(x, y) {
      if (mode === 'press' || mode === 'drag') return
      // 올리기 시작할 때만 묻는다 (마우스가 움직일 때마다 문서를 뒤지지 않게)
      if (mode === 'rest') {
        if (env.calm() || env.hidden()) return
        low = env.low()
        const q = el.getBoundingClientRect()
        home = { cx: q.left + q.width / 2 - b.x, cy: q.top + q.height / 2 - b.y, half: q.width / 2 }
        tiltK = tiltScale(q.width / b.s, c)
      }
      mode = 'hover'
      px = x
      py = y
      wake()
    },
    leave() {
      if (mode !== 'hover') return
      mode = 'rest'
      wake()
    },
    reset,
    get busy() { return raf !== 0 },
    get mode() { return mode },
  }
}

/** 꾸밈 모양 — 한 번만 머리에 (이름은 swy- 로 시작) */
function swayCss(doc: Document, c: SwayCfg = UI_SWAY): void {
  if (doc.getElementById('swy-css') !== null) return
  const s = doc.createElement('style')
  s.id = 'swy-css'
  s.textContent = `.${ON}{z-index:${c.z}}.${GPU}{will-change:translate,rotate,scale}.${LIFT}{filter:drop-shadow(${c.lift})}`
  doc.head.appendChild(s)
}

/**
 * 판 하나(root) 안의 고를 카드(selector)에 흔들림을 붙인다 — 한 번 붙이면 판을 다시 그려 새로 생긴 카드에도 (이어받기 · 카드마다 듣지 않는다).
 * 손가락·마우스로 누르면 누른 채 끄는 동안 흔들리고, 놓으면 돌아온다 (고르기는 원래 click 그대로). 마우스는 올리기만 해도 끌린다.
 * 떼어 낼 때 돌려준 함수를 부른다.
 */
export function swayCards(root: HTMLElement, selector: string, opts: SwayOpts = {}): () => void {
  const doc = root.ownerDocument
  const env = domEnv(doc)
  const ctl = new WeakMap<Element, Sway>()
  const of = (el: HTMLElement): Sway => {
    let s = ctl.get(el)
    if (s === undefined) { s = swayOn(el, opts, env); ctl.set(el, s) }
    return s
  }
  swayCss(doc)
  if (opts.touch !== undefined) {
    const t = doc.createElement('style')
    t.dataset['swyTouch'] = selector
    t.textContent = `${selector}{touch-action:${opts.touch}}`
    doc.head.appendChild(t)
  }
  let hovered: HTMLElement | null = null
  let held: { el: HTMLElement; id: number } | null = null
  const card = (t: EventTarget | null): HTMLElement | null => {
    const e = t instanceof Element ? t.closest<HTMLElement>(selector) : null
    if (e === null || !root.contains(e)) return null
    return (e as HTMLButtonElement).disabled === true || e.getAttribute('aria-disabled') === 'true' ? null : e
  }
  const over = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' || held !== null) return
    const c = card(e.target)
    if (c === hovered) return
    if (hovered !== null) of(hovered).leave()
    hovered = c
    if (c !== null) of(c).hover(e.clientX, e.clientY)
  }
  const hoverMove = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && held === null && hovered !== null) of(hovered).hover(e.clientX, e.clientY)
  }
  const out = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' || held !== null || hovered === null) return
    const to = e.relatedTarget
    if (to instanceof Node && hovered.contains(to)) return
    of(hovered).leave()
    hovered = null
  }
  const heldMove = (e: PointerEvent): void => {
    if (held !== null && e.pointerId === held.id) of(held.el).move(e.clientX, e.clientY)
  }
  const unhold = (): void => {
    const w = doc.defaultView
    if (w === null) return
    w.removeEventListener('pointermove', heldMove, true)
    w.removeEventListener('pointerup', up, true)
    w.removeEventListener('pointercancel', up, true)
  }
  function up(e: PointerEvent): void {
    if (held === null || e.pointerId !== held.id) return
    const el = held.el
    held = null
    unhold()
    of(el).release()
    // 마우스가 아직 그 카드 위면 올림으로 이어진다
    if (e.pointerType === 'mouse' && el.isConnected && el.matches(':hover')) { hovered = el; of(el).hover(e.clientX, e.clientY) } else if (hovered === el) hovered = null
  }
  const down = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const c = card(e.target)
    if (c === null) return
    if (held !== null) { of(held.el).release(); unhold() }
    held = { el: c, id: e.pointerId }
    of(c).grab(e.clientX, e.clientY)
    // 판이 누른 칸에 손을 붙잡아 두어도(setPointerCapture) 놓치지 않게 창에서 먼저 듣는다
    const w = doc.defaultView
    if (w === null) return
    w.addEventListener('pointermove', heldMove, true)
    w.addEventListener('pointerup', up, true)
    w.addEventListener('pointercancel', up, true)
  }
  root.addEventListener('pointerover', over)
  root.addEventListener('pointermove', hoverMove)
  root.addEventListener('pointerout', out)
  root.addEventListener('pointerdown', down)
  return () => {
    root.removeEventListener('pointerover', over)
    root.removeEventListener('pointermove', hoverMove)
    root.removeEventListener('pointerout', out)
    root.removeEventListener('pointerdown', down)
    unhold()
    held = null
    hovered = null
  }
}
