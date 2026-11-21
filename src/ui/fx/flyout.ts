/**
 * 판 밖으로 넘는 꾸밈 (A1 · 형 11-20: 「이펙트가 판 레이아웃 경계를 넘나듦 · 소리와 딱 맞음」).
 *
 * 고른 카드의 그림(룬 · 깃발)이 판 안에서 부풀어 솟고, 판 테두리를 넘어 화면을 가로질러 그것이 쓰이는 자리
 * (열전 HUD 의 그 능력 칸 · 전장의 그 무리)로 날아가 박힌다. 떠날 때 불티 몇 낱이 판 밖까지 흩어지고, 닿는 순간 그 자리가 한 번 튀며 고리가 번진다.
 * 소리는 닿는 그 프레임(onLand)에 — 누를 때나 긴 움직임의 처음이 아니라 (A1 소리 박자).
 *
 *  - 화면 위 한 겹(position: fixed · pointer-events: none)에 작은 것 몇 개만 · Web Animations(transform · opacity) · 다 해서 0.8초 안.
 *  - 글은 없다 (메모리 no-effect-captions). 덩어리 그림을 통째로 밀지 않고 낱낱이 (effects-individual-particles).
 *  - 움직임 줄이기 · 숨은 탭이면 날지 않고 onLand 를 곧바로 (소리는 누른 순간).
 *  - 애니가 멈춰도(숨은 탭 · 깨진 값) 정한 시간의 safety 배 뒤엔 반드시 걷힌다 (메모리 notices-must-dismiss).
 *  - 저사양(.q-low)이면 불티를 줄이고 빛 테(filter)를 뺀다 · 보통(.q-mid)은 불티 반쯤.
 * 숫자는 모두 src/tune/params.ts UI_FLY. 길 셈(flyPath · sparkSpecs)은 순수 — 시험이 잰다.
 */
import { UI_FLY } from '../../tune/params.ts'
import { calmMotion, marked } from './sway.ts'

export type FlyCfg = typeof UI_FLY
/** 화면 좌표의 네모 (getBoundingClientRect 꼴) */
export interface Box { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

/** 고르기 전에 떠 둔 판의 잔상 (아직 안 붙임) — 판은 고르면 곧바로 닫히므로 */
export interface Afterimage { readonly node: HTMLElement; readonly box: Box }

export interface FlyOpts {
  /** 판의 잔상 — 날아가는 그림 밑에서 afterMs 동안 옅어진다 (그림이 판 테두리를 넘어가는 것이 보이게) */
  readonly after?: Afterimage | null
  /** 잔상을 붙일 곳 — 판과 같은 부모(본편은 .ap 안이라야 모양이 산다) · 없으면 화면 위 한 겹의 맨 밑 */
  readonly afterHost?: HTMLElement | null
  /** 떠나는 자리 — 판 안의 그 그림 */
  readonly from: Box
  /** 닿을 자리 — 없거나 화면 밖이면 그 자리에서 부풀었다 사라진다 */
  readonly to?: Box | null
  /** 나는 그림 */
  readonly img?: string | null
  /** 그 그림에 붙은 표 (열전 빌린 그림의 빛깔 tint-*) — 있으면 빛 테를 덧대지 않는다 */
  readonly imgClass?: string
  /** 불티 · 고리 빛깔 */
  readonly color?: string
  /** 닿는 순간 한 번 튀는 칸 (HUD 능력 칸) — 닿기 전엔 흐리게 둔다 */
  readonly pulse?: HTMLElement | null
  /** 닿는 그 프레임 — 화면 쪽 일. 날지 않을 때는 곧바로 */
  readonly onLand?: () => void
  /**
   * 소리 — 날기가 시작되는 그 프레임에 「닿을 때까지 남은 초」를 넘긴다. 소리 시계(AudioContext)에 그만큼 뒤로 걸면
   * 그 사이 화면 일이 밀려도(다음 깃발 판을 그리느라 등) 정확히 닿는 순간에 난다. 날지 않을 때는 0 으로 곧바로
   */
  readonly cue?: (inSec: number) => void
}

/** 화면 안에 보이는 칸인가 */
export function onScreen(q: Box | null | undefined, w: number, h: number): q is Box {
  return q != null && q.width > 0 && q.height > 0 && q.left < w && q.top < h && q.left + q.width > 0 && q.top + q.height > 0
}

/** 길 위의 한 마디 — 떠난 자리에서 비킨 거리(px) · 크기 몫 · 기울기(도) · 때(0~1) */
export interface FlyKey { readonly offset: number; readonly x: number; readonly y: number; readonly s: number; readonly r: number }

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
const lerp = (ab: readonly [number, number] | readonly number[], f: number): number => (ab[0] ?? 0) + ((ab[1] ?? 0) - (ab[0] ?? 0)) * f
const frac = (v: number): number => v - Math.floor(v)
/** 황금비 — 불티를 고르게 흩는 수열 (해바라기 씨처럼 · 겹치지 않게) */
const PHI = (Math.sqrt(5) - 1) / 2
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/**
 * 날아가는 길 — 부풀며 솟고(popMs) 위로 휜 길을 따라 끝에서 빨라지며(ease) 닿는다(flyMs) · 크기는 닿을 칸 크기로 줄어든다.
 * 마지막 마디(offset 1)가 닿는 순간이다
 */
export function flyPath(from: Box, to: Box, c: FlyCfg = UI_FLY): FlyKey[] {
  const size = Math.max(1, Math.min(from.width, from.height))
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  const dist = Math.hypot(dx, dy)
  const end = clamp(Math.min(to.width, to.height) / size, c.fit[0], c.fit[1])
  const total = c.popMs + c.flyMs
  const y0 = -c.popRise
  const keys: FlyKey[] = [{ offset: 0, x: 0, y: 0, s: 1, r: 0 }, { offset: c.popMs / total, x: 0, y: y0, s: c.popScale, r: 0 }]
  // 휜 길 — 처음(솟은 자리) · 가운데 위로 arc·거리만큼 올린 점 · 끝(닿을 칸 가운데)
  const mx = dx / 2
  const my = (y0 + dy) / 2 - c.arc * dist
  const dir = dx < 0 ? -1 : 1
  for (let i = 1; i <= c.steps; i++) {
    const p = i / c.steps
    const e = p ** c.ease
    const u = 1 - e
    keys.push({
      offset: (c.popMs + p * c.flyMs) / total,
      x: 2 * u * e * mx + e * e * dx,
      y: u * u * y0 + 2 * u * e * my + e * e * dy,
      s: c.popScale + (end - c.popScale) * p,
      r: i === c.steps ? 0 : dir * c.spin * Math.sin(Math.PI * p),
    })
  }
  return keys
}

/** 불티 하나 — 날아가는 쪽(라디안) · 거리(px) · 크기(px) · 시간(ms) */
export interface SparkSpec { readonly a: number; readonly d: number; readonly size: number; readonly ms: number }
/** 불티 n 낱 — 위쪽부터 황금각으로 돌려 고르게 · 거리·크기·시간은 황금비 수열로 엇갈린다 (늘 같은 꼴) */
export function sparkSpecs(n: number, c: FlyCfg = UI_FLY): SparkSpec[] {
  const out: SparkSpec[] = []
  for (let i = 0; i < n; i++) {
    out.push({ a: -Math.PI / 2 + i * GOLDEN, d: lerp(c.sparkDist, frac(i * PHI)), size: lerp(c.sparkSize, frac(i * PHI * 2 + PHI)), ms: lerp(c.sparkMs, frac(i * PHI * 3)) })
  }
  return out
}
/** 이 그래픽 단계에서 낼 불티 수 */
export const sparkCount = (low: boolean, mid: boolean, c: FlyCfg = UI_FLY): number =>
  Math.max(c.minSparks, Math.round(c.sparks * (low ? c.lowSparks : mid ? c.midSparks : 1)))

const LAYER = 'flx-layer'
/** 화면 위 한 겹 — 문서마다 하나 (열전은 제 문서) */
function layerOf(doc: Document, c: FlyCfg): HTMLElement {
  if (doc.getElementById('flx-css') === null) {
    const s = doc.createElement('style')
    s.id = 'flx-css'
    s.textContent = `#${LAYER}{position:fixed;inset:0;z-index:${c.z};pointer-events:none;overflow:visible}`
      + `#${LAYER}>.flx{position:absolute;left:0;top:0;margin:0;padding:0;border:0;box-sizing:border-box;pointer-events:none}`
      + `#${LAYER} .flx-g{object-fit:contain}#${LAYER} .flx-r{border-radius:50%;border:${c.ringLine}px solid var(--c)}`
      + `#${LAYER} .flx-s{border-radius:50%;background:${c.sparkCore};box-shadow:0 0 ${c.sparkGlow}px var(--c)}`
    doc.head.appendChild(s)
  }
  let el = doc.getElementById(LAYER)
  if (el === null) {
    el = doc.createElement('div')
    el.id = LAYER
    el.setAttribute('aria-hidden', 'true')
    doc.body.appendChild(el)
  }
  return el
}

/** el 에서 그 안의 node 까지 가는 자식 번호 길 (잔상에서 같은 칸을 찾는다) */
function pathTo(el: Element, node: Element): number[] | null {
  const out: number[] = []
  for (let n: Element | null = node; n !== null && n !== el; n = n.parentElement) {
    const p: Element | null = n.parentElement
    if (p === null) return null
    out.unshift([...p.children].indexOf(n))
  }
  return out
}

/**
 * 판의 잔상을 떠 둔다 — 고르기 전에 (고르면 판이 다시 그려지거나 닫힌다). 고른 그것(picked)은 잔상에서 빈자리 — 그것이 날아간다.
 * 이름표(id)는 지운다 (같은 이름표가 둘이 되지 않게). 화면에 없는 판이면 null
 */
export function takeAfterimage(el: Element | null, picked: Element | null = null): Afterimage | null {
  if (!(el instanceof HTMLElement)) return null
  const q = el.getBoundingClientRect()
  if (q.width <= 0 || q.height <= 0) return null
  const node = el.cloneNode(true) as HTMLElement
  for (const x of [node, ...node.querySelectorAll('[id]')]) x.removeAttribute('id')
  const path = picked !== null && el.contains(picked) ? pathTo(el, picked) : null
  let hit: Element | undefined = node
  for (const i of path ?? []) hit = hit?.children[i]
  if (path !== null && hit instanceof HTMLElement && hit !== node) hit.style.visibility = 'hidden'
  node.setAttribute('aria-hidden', 'true')
  node.inert = true
  return { node, box: { left: q.left, top: q.top, width: q.width, height: q.height } }
}

/**
 * 날린다. 돌려주는 값 = 닿을 때까지(ms · 날지 않으면 0) — 그때 onLand 가 불리고, cue 는 날기가 시작되는 프레임에 남은 초를 받는다.
 * 그림을 넘기지 않으면 떠나는 자리에서 터지기만 하고 onLand · cue(0) 는 곧바로
 */
export function flyOut(o: FlyOpts, doc: Document = document, c: FlyCfg = UI_FLY): number {
  let landed = false
  const land = (): void => {
    if (landed) return
    landed = true
    o.onLand?.()
  }
  let cued = false
  const cue = (sec: number): void => {
    if (cued) return
    cued = true
    o.cue?.(Math.max(0, sec))
  }
  /** 날기가 시작된 그 프레임에 — 닿을 때(시작 + ms)까지 남은 초를 소리에 넘긴다 */
  const cueAt = (a: Animation, ms: number): void => {
    void a.ready.then(() => {
      const st = a.startTime
      const now = doc.timeline.currentTime
      cue(st !== null && now !== null ? (Number(st) + ms - Number(now)) / 1000 : ms / 1000)
    }, () => cue(0))
  }
  const win = doc.defaultView
  if (win === null || doc.hidden || calmMotion(doc) || typeof doc.documentElement.animate !== 'function') { land(); cue(0); return 0 }
  const layer = layerOf(doc, c)
  const low = marked(doc, '.q-low')
  const mid = !low && marked(doc, '.q-mid')
  const color = o.color ?? c.color
  const pulse = o.pulse ?? null
  const made: HTMLElement[] = []
  const runs: Animation[] = []
  let done = false
  const finish = (): void => {
    if (done) return
    done = true
    for (const e of made) e.remove()
    if (pulse !== null) pulse.style.opacity = ''
    land()
    cue(0)
  }
  const settle = (): void => { void Promise.allSettled(runs.map((a) => a.finished)).then(finish) }
  /** 한 겹 위에 작은 것 하나 — 가운데 (x, y) · 크기 w×h */
  const put = <K extends 'i' | 'img'>(tag: K, cls: string, x: number, y: number, w: number, h: number): HTMLElementTagNameMap[K] => {
    const e = doc.createElement(tag)
    e.className = `flx ${cls}`
    e.style.cssText = `left:${(x - w / 2).toFixed(1)}px;top:${(y - h / 2).toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;--c:${color}`
    layer.appendChild(e)
    made.push(e)
    return e
  }
  const ring = (x: number, y: number, d: number): void => {
    const r = put('i', 'flx-r', x, y, d, d)
    runs.push(r.animate([{ transform: `scale(${c.ringScale[0]})`, opacity: c.ringAlpha }, { transform: `scale(${c.ringScale[1]})`, opacity: 0 }], { duration: c.ringMs, easing: c.burstEase, fill: 'both' }))
  }
  // ⓪ 판의 잔상 — 고르자 닫힌 판이 그 자리에서 afterMs 동안 옅어진다 · 눌리지 않는다
  if (o.after != null) {
    const k = o.after.node
    const q = o.after.box
    k.style.cssText += `;position:fixed;left:${q.left.toFixed(1)}px;top:${q.top.toFixed(1)}px;width:${q.width.toFixed(1)}px;height:${q.height.toFixed(1)}px;margin:0;max-height:none;max-width:none;pointer-events:none;animation:none;transition:none`
    const host = o.afterHost ?? null
    if (host !== null) host.appendChild(k)
    else layer.prepend(k)
    made.push(k)
    runs.push(k.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: `scale(${c.afterScale})` }], { duration: c.afterMs, easing: 'ease-in', fill: 'forwards' }))
  }
  const x0 = o.from.left + o.from.width / 2
  const y0 = o.from.top + o.from.height / 2
  const size = Math.max(1, Math.min(o.from.width, o.from.height))
  // ① 떠나는 자리 — 고리 하나와 불티가 판 테두리 너머로 흩어진다
  ring(x0, y0, size * c.ringFrom)
  for (const s of sparkSpecs(sparkCount(low, mid, c), c)) {
    const e = put('i', 'flx-s', x0, y0, s.size, s.size)
    const tx = Math.cos(s.a) * s.d
    const ty = Math.sin(s.a) * s.d
    runs.push(e.animate([
      { transform: 'translate(0px,0px) scale(1)', opacity: 1 },
      { transform: `translate(${(tx * c.sparkMid).toFixed(1)}px,${(ty * c.sparkMid).toFixed(1)}px) scale(${c.sparkMid})`, opacity: 1, offset: c.sparkMid },
      { transform: `translate(${tx.toFixed(1)}px,${(ty + c.sparkFall).toFixed(1)}px) scale(${c.sparkEnd})`, opacity: 0 },
    ], { duration: s.ms, easing: c.burstEase, fill: 'both' }))
  }
  // ② 나는 그림 — 닿는 순간 onLand · 닿을 칸이 튀고 고리가 번진다 (소리는 날기 시작에 cue 로 소리 시계에 걸어 둔다)
  const vw = win.innerWidth
  const vh = win.innerHeight
  const to = onScreen(o.to, vw, vh) ? o.to : null
  let landAt = 0
  if (o.img != null && o.img !== '') {
    const g = put('img', o.imgClass !== undefined && o.imgClass !== '' ? `flx-g ${o.imgClass}` : 'flx-g', x0, y0, size, size)
    g.alt = ''
    g.draggable = false
    g.src = o.img
    if (!low && (o.imgClass === undefined || o.imgClass === '')) g.style.filter = c.glow
    const tf = (k: { x: number; y: number; r: number; s: number }): string => `translate(${k.x.toFixed(1)}px,${k.y.toFixed(1)}px) rotate(${k.r.toFixed(1)}deg) scale(${k.s.toFixed(3)})`
    const after = (k: FlyKey): void => {
      runs.push(g.animate([{ transform: tf({ ...k, s: k.s * c.squash }), opacity: 1 }, { transform: tf(k), opacity: 0 }], { duration: c.landMs, easing: 'ease-out', fill: 'forwards' }))
    }
    if (to !== null) {
      if (pulse !== null) pulse.style.opacity = String(c.hold)
      const keys = flyPath(o.from, to, c)
      const fly = g.animate(keys.map((k) => ({ offset: k.offset, transform: tf(k) })), { duration: c.popMs + c.flyMs, fill: 'forwards' })
      runs.push(fly)
      landAt = c.popMs + c.flyMs
      cueAt(fly, landAt)
      fly.onfinish = (): void => {
        if (done) return
        land() // ★ 닿는 그 프레임
        const k = keys[keys.length - 1]
        if (k !== undefined) after(k)
        ring(to.left + to.width / 2, to.top + to.height / 2, Math.min(to.width, to.height) * c.ringTo)
        if (pulse !== null) {
          pulse.style.opacity = ''
          if (typeof pulse.animate === 'function') runs.push(pulse.animate([{ scale: '1' }, { scale: String(c.pulse), offset: c.pulseAt }, { scale: '1' }], { duration: c.pulseMs, easing: 'ease-out' }))
        }
        settle()
      }
    } else {
      // 갈 곳이 화면에 없다 — 그 자리에서 부풀었다 사라진다 · 부푼 꼭대기가 닿는 때
      const top: FlyKey = { offset: 1, x: 0, y: -c.popRise, s: c.popScale, r: 0 }
      const pop = g.animate([{ transform: tf({ x: 0, y: 0, s: 1, r: 0 }) }, { transform: tf(top) }], { duration: c.popMs, fill: 'forwards' })
      runs.push(pop)
      landAt = c.popMs
      cueAt(pop, landAt)
      pop.onfinish = (): void => {
        if (done) return
        land()
        after(top)
        settle()
      }
    }
  } else {
    land()
    cue(0)
    settle()
  }
  // 애니가 멈춰도(숨은 탭 · 깨진 값) 반드시 걷힌다
  win.setTimeout(finish, (landAt + Math.max(c.landMs, c.ringMs, c.pulseMs, c.sparkMs[1])) * c.safety)
  return landAt
}
