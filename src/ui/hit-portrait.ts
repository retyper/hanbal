/**
 * 맞은 장수 초상 (11-17 형: 「장수 초상에 맞았을 때 모습」 · 1단계 = 그림 없이 코드로, 모든 장수 · 모든 전투에).
 *
 * 맞으면 초상이 짧게 흔들리고, 붉은 빛이 번쩍이고, 잠깐 빛이 빠졌다(잿빛 막) 돌아오고, 금 간 유리 같은 줄이 스쳤다 사라진다.
 * 큰 피해일수록 조금 세게 · 짧고 가볍게. 수치는 전부 P.render.hitPortrait* (tune/params.ts).
 *
 * 두 길:
 *  - DOM 초상 (열전 왼쪽 판 · 본편 합전 장수 초상): hitPortrait(판, 세기) 가 겉막 하나를 새로 끼우고 작은 흔들림을 한 번 튼다.
 *    선언형 화면(본편 합전)은 hitPortraitHtml(세기, { delay }) 조각을 그림 옆에 넣으면 CSS 가 그때 튼다.
 *  - 캔버스 초상 (겨루기 적장 액자 · 체력 막대 얼굴): HitClock 으로 맞은 때를 기억하고 프레임마다 drawHitPortrait.
 *
 * 폰 그래픽 (메모리 mobile-gpu-layer-limit · ui/gfxsafe.ts): 넓은 판에 filter 애니 금지 · 부드러운 그러데이션 금지.
 * 그래서 채도 빠짐은 잿빛 단색 막의 opacity 로 흉내 내고, 붉은 빛도 단색 + 안쪽 그림자 · 움직이는 것은 opacity 와 작은 transform 한 번뿐.
 *
 * 나중에 장수별 피격 초상 그림(public/realm/hit/<form>/<초상 id>.webp)이 생기면 HIT_ART 에 한 줄 적는다 → 그 그림을 잠깐 바꿔 보여 준다.
 * 없는 그림은 부르지 않는다 (맞을 때마다 404 를 내지 않게).
 *
 * 그리기 쪽만 쓴다 — 판 상태는 읽기만 (절대 규칙 2). 맨 위에서 document 를 만지지 않는다 (node 시험이 이 파일을 읽는다).
 */
import { P } from '../tune/params.ts'

/** 초상 결 — bust(기본 원화) · awaken(각성 원화) */
export type HitForm = 'bust' | 'awaken'
/** 피격 그림이 있는 초상 — `${결}/${초상 id}` (public/realm/hit/<결>/<id>.webp). 지금은 그림 없음 */
export const HIT_ART: ReadonlySet<string> = new Set<string>([])
/** 피격 그림 길 (realm/ 아래) — 없으면 null */
export const hitArtPath = (form: HitForm, bust: string | null | undefined): string | null =>
  bust !== null && bust !== undefined && HIT_ART.has(`${form}/${bust}`) ? `hit/${form}/${bust}.webp` : null

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
const mix = (a: number, b: number, s: number): number => a + (b - a) * s

/** 세기 0~1 — 잃은 체력 ÷ 최대 체력 ÷ hitPortraitBigLoss */
export const hitStrength = (loss: number, max: number): number => (max > 0 && loss > 0 ? clamp01(loss / max / P.render.hitPortraitBigLoss) : 0)

export interface HitLook { readonly ms: number; readonly shake: number; readonly red: number; readonly gray: number; readonly crack: number }
/** 세기 → 길이 · 흔들림 폭(px) · 붉은 빛 · 잿빛 막 · 금 짙기 */
export function hitLook(s: number): HitLook {
  const R = P.render, k = clamp01(s)
  return {
    ms: mix(R.hitPortraitMs, R.hitPortraitMsHard, k), shake: mix(R.hitPortraitShakeMin, R.hitPortraitShakeMax, k),
    red: mix(R.hitPortraitRedMin, R.hitPortraitRedMax, k), gray: mix(R.hitPortraitGrayMin, R.hitPortraitGrayMax, k), crack: mix(R.hitPortraitCrackMin, R.hitPortraitCrackMax, k),
  }
}

// ── 시간표 (u = 0~1) · CSS 키프레임과 같은 꼴
/** 흔들림 — [때, x, y] (폭 1 기준 · 잦아든다) */
const SHAKE: readonly (readonly [number, number, number])[] = [[0, 0, 0], [0.1, -1, 0.4], [0.25, 0.85, -0.3], [0.42, -0.55, 0.25], [0.6, 0.3, -0.1], [0.8, -0.12, 0], [1, 0, 0]]
/** 꺾은선 값 — [때, 값] 들 사이를 곧게 */
const ramp = (pts: readonly (readonly [number, number])[], u: number): number => {
  for (let i = 1; i < pts.length; i++) {
    const [u1, v1] = pts[i]!, [u0, v0] = pts[i - 1]!
    if (u <= u1) return u1 === u0 ? v1 : v0 + (v1 - v0) * ((u - u0) / (u1 - u0))
  }
  return pts[pts.length - 1]![1]
}
const RED: readonly (readonly [number, number])[] = [[0, 0], [0.08, 1], [0.6, 0], [1, 0]]
const GRAY: readonly (readonly [number, number])[] = [[0, 0], [0.12, 1], [0.4, 1], [1, 0]]
const CRACK: readonly (readonly [number, number])[] = [[0, 0], [0.04, 0], [0.08, 1], [0.45, 1], [0.9, 0], [1, 0]]
const ART: readonly (readonly [number, number])[] = [[0, 0], [0.06, 1], [0.7, 1], [1, 0]]
const pct = (u: number): string => `${Math.round(u * 100)}%`
const keyframes = (name: string, pts: readonly (readonly [number, number])[], peak: string): string =>
  `@keyframes ${name}{${pts.map(([u, v]) => `${pct(u)}{opacity:${v === 1 ? peak : v}}`).join('')}}`

// ── 금 (유리처럼 갈라진 줄) — 맞은 자리(가슴께)에서 뻗는 들쭉날쭉한 줄 + 둘레를 잇는 고리 조각 + 잔가지.
// 0~100 정사각 좌표 · 판 비율과 상관없이 가운데를 맞춰 덮는다(slice) · 판 셋을 돌려 쓴다.
// 굵기 세 층: 맞은 자리 가까이는 굵고 밝게, 끝으로 갈수록 가늘고 흐리게 (그러데이션 없이 · 폰 그래픽)
type Tier = 0 | 1 | 2
interface Poly { readonly t: Tier; readonly p: readonly number[] }
function makeCrack(seed: number): readonly Poly[] {
  let r = seed >>> 0
  const rnd = (): number => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296)
  const cx = 36 + rnd() * 28, cy = 48 + rnd() * 18, rays = 7, steps = 5
  const out: Poly[] = [], spokes: [number, number][][] = []
  const seg = (t: Tier, ...pts: [number, number][]): void => { out.push({ t, p: pts.flat() }) }
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + rnd() * 0.6, len = 30 + rnd() * 34
    const pts: [number, number][] = [[cx, cy]]
    for (let k = 1; k <= steps; k++) { const d = (len * k) / steps, aa = a + (rnd() - 0.5) * 0.6; pts.push([cx + Math.cos(aa) * d, cy + Math.sin(aa) * d]) }
    spokes.push(pts)
    seg(0, pts[0]!, pts[1]!, pts[2]!); seg(1, pts[2]!, pts[3]!); seg(2, pts[3]!, pts[4]!, pts[5]!)
    // 잔가지 하나 (반쯤)
    if (rnd() < 0.5) { const b = pts[3]!, ba = a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.5), bl = 5 + rnd() * 7; seg(2, b, [b[0] + Math.cos(ba) * bl, b[1] + Math.sin(ba) * bl]) }
  }
  for (const [ring, t] of [[1, 0], [3, 1]] as const) for (let i = 0; i < rays; i++) {
    if (rnd() < 0.45) continue
    const a = spokes[i]![ring]!, b = spokes[(i + 1) % rays]![ring]!
    seg(t, a, [(a[0] + b[0]) / 2 + (rnd() - 0.5) * 5, (a[1] + b[1]) / 2 + (rnd() - 0.5) * 5], b)
  }
  return out
}
const CRACKS: readonly (readonly Poly[])[] = [makeCrack(17), makeCrack(7919), makeCrack(104729)]
const crackOf = (seed: number): readonly Poly[] => CRACKS[((seed % CRACKS.length) + CRACKS.length) % CRACKS.length]!
/** 층마다 [어두운 테 굵기, 밝은 줄 굵기, 짙기] (px · 캔버스는 짧은 변 300px 기준으로 늘고 준다) */
const TIER: readonly (readonly [number, number, number])[] = [[3.2, 1.4, 1], [2.4, 1, 0.75], [1.8, 0.7, 0.5]]
const crackD = (seed: number, t: Tier): string => crackOf(seed).filter((q) => q.t === t).map((q) => {
  let d = ''
  for (let i = 0; i < q.p.length; i += 2) d += `${i === 0 ? 'M' : 'L'}${q.p[i]!.toFixed(1)} ${q.p[i + 1]!.toFixed(1)}`
  return d
}).join('')
const crackSvg = (seed: number): string => `<svg class="hitp-crack" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${([0, 1, 2] as const).map((t) => {
  const d = crackD(seed, t), [dw, lw, op] = TIER[t]!
  return `<g opacity="${op}"><path class="d" style="stroke-width:${dw}px" d="${d}"/><path class="l" style="stroke-width:${lw}px" d="${d}"/></g>`
}).join('')}</svg>`

// ── DOM
const CSS = `
.hitp{position:absolute;inset:var(--hitp-inset,0);pointer-events:none;overflow:hidden;border-radius:inherit}
.hitp>*{position:absolute;left:0;top:0;width:100%;height:100%;opacity:0;animation-duration:var(--hitp-ms,280ms);animation-timing-function:linear;animation-delay:var(--hitp-delay,0s);animation-fill-mode:both;animation-iteration-count:1}
.hitp>.hitp-gray{background:#454851;animation-name:hitp-gray}
.hitp>.hitp-red{background:#ff2a18;box-shadow:inset 0 0 28px 10px #9a0500;animation-name:hitp-red}
.hitp>.hitp-crack{display:block;animation-name:hitp-crack}
.hitp>.hitp-art{object-fit:cover;object-position:var(--hitp-pos,50% 15%);animation-name:hitp-art;animation-duration:var(--hitp-art-ms,420ms)}
.hitp-crack path{fill:none;vector-effect:non-scaling-stroke;stroke-linejoin:miter;stroke-linecap:square}
.hitp-crack .d{stroke:#1a0503;stroke-opacity:.7}
.hitp-crack .l{stroke:#fff6ee}
${keyframes('hitp-red', RED, 'var(--hitp-red)')}
${keyframes('hitp-gray', GRAY, 'var(--hitp-gray)')}
${keyframes('hitp-crack', CRACK, 'var(--hitp-crack)')}
${keyframes('hitp-art', ART, '1')}
`
let cssDone = false
/** 겉막 CSS 를 한 번 넣는다 (DOM 이 없으면 아무것도 안 함) */
export function ensureHitPortraitCss(): void {
  if (cssDone || typeof document === 'undefined') return
  cssDone = true
  const st = document.createElement('style'); st.id = 'hit-portrait-css'; st.textContent = CSS; document.head.append(st)
}

export interface HitHtmlOpts {
  /** 시작을 늦출 때 (CSS 시간 · 본편 합전은 var(--hd)) */
  readonly delay?: string
  /** 피격 그림 주소 (hitArtPath 앞에 그림 뿌리를 붙인 것) · 없으면 코드 효과만 */
  readonly art?: string | null
  /** 그림 자리 (object-position) */
  readonly pos?: string
  /** 판 안쪽으로 들일 몫 (액자 안 그림만 덮을 때 · CSS 길이) */
  readonly inset?: string
  /** 금 꼴 고르기 */
  readonly seed?: number
}
/** 겉막 조각 — 판(position 있는 칸) 안에 넣으면 들어가는 순간(또는 delay 뒤) 한 번 돈다 */
export function hitPortraitHtml(s: number, o: HitHtmlOpts = {}): string {
  const L = hitLook(s)
  const vars = [`--hitp-ms:${Math.round(L.ms)}ms`, `--hitp-red:${L.red.toFixed(2)}`, `--hitp-gray:${L.gray.toFixed(2)}`, `--hitp-crack:${L.crack.toFixed(2)}`, `--hitp-art-ms:${Math.round(P.render.hitPortraitArtMs)}ms`]
  if (o.delay !== undefined) vars.push(`--hitp-delay:${o.delay}`)
  if (o.pos !== undefined) vars.push(`--hitp-pos:${o.pos}`)
  if (o.inset !== undefined) vars.push(`--hitp-inset:${o.inset}`)
  const art = o.art !== null && o.art !== undefined ? `<img class="hitp-art" src="${o.art.replace(/"/g, '&quot;')}" alt="">` : ''
  return `<span class="hitp" aria-hidden="true" style="${vars.join(';')}">${art}<i class="hitp-gray"></i><i class="hitp-red"></i>${crackSvg(o.seed ?? 0)}</span>`
}

const live = new WeakMap<HTMLElement, { t0: number; seed: number }>()
let seedNext = 0
const calm = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
/**
 * 지금 맞았다 — 판(host · position 있는 칸)에 겉막을 새로 끼우고(애니가 처음부터) 작은 흔들림을 한 번.
 * hitPortraitGapMs 안에 또 오면 무시한다 (연타에 깜빡이지 않게). 흔들림은 shake 칸(기본 host)에 transform 한 번 · 움직임 줄이기면 안 흔든다.
 */
export function hitPortrait(host: HTMLElement, s: number, o: { readonly art?: string | null; readonly pos?: string; readonly shake?: HTMLElement | null } = {}): void {
  ensureHitPortraitCss()
  const now = performance.now(), was = live.get(host)
  if (was !== undefined && now - was.t0 < P.render.hitPortraitGapMs) return
  const seed = seedNext++
  live.set(host, { t0: now, seed })
  host.querySelector(':scope > .hitp')?.remove()
  host.insertAdjacentHTML('beforeend', hitPortraitHtml(s, { seed, ...(o.art !== undefined ? { art: o.art } : {}), ...(o.pos !== undefined ? { pos: o.pos } : {}) }))
  const el = o.shake === undefined ? host : o.shake
  if (el === null || calm() || typeof el.animate !== 'function') return
  const L = hitLook(s), a = L.shake, size = Math.max(1, Math.min(el.clientWidth || 1, el.clientHeight || 1))
  const k = 1 + (2.2 * a) / size   // 가장자리 바탕이 드러나지 않게 아주 조금 키운 채 흔든다
  el.animate(SHAKE.map(([u, x, y]) => ({ offset: u, transform: u === 0 || u === 1 ? 'none' : `translate(${(x * a).toFixed(1)}px,${(y * a).toFixed(1)}px) scale(${k.toFixed(3)})` })), { duration: L.ms, easing: 'linear' })
}

// ── 캔버스
export interface HitFrame {
  /** 흔들림 (px) */
  readonly dx: number; readonly dy: number
  readonly red: number; readonly gray: number; readonly crack: number
  /** 피격 그림 짙기 (0~1) */
  readonly art: number
  readonly seed: number
}
/** 맞은 때 기억 — 그리는 쪽이 쥔다 (판 상태가 아니다) */
export class HitClock {
  private t0 = -1e9
  private s = 0
  private seed = 0
  /** 지금 맞았다 (now = ms) */
  hit(now: number, s: number): void {
    if (now - this.t0 < P.render.hitPortraitGapMs) { this.s = Math.max(this.s, s); return }
    if (now - this.t0 >= hitLook(this.s).ms) this.seed++   // 이어 맞으면 금 꼴은 그대로 (바뀌면 깜빡인다)
    this.t0 = now; this.s = s
  }
  reset(): void { this.t0 = -1e9; this.s = 0 }
  /** 지금 그릴 값 · 끝났으면 null */
  at(now: number, calmMotion = false): HitFrame | null {
    const age = now - this.t0, L = hitLook(this.s), artMs = P.render.hitPortraitArtMs
    if (age < 0 || age >= Math.max(L.ms, artMs)) return null
    const u = age / L.ms
    let dx = 0, dy = 0
    if (u < 1 && !calmMotion) for (let i = 1; i < SHAKE.length; i++) {
      const [u1, x1, y1] = SHAKE[i]!, [u0, x0, y0] = SHAKE[i - 1]!
      if (u <= u1) { const f = (u - u0) / (u1 - u0); dx = (x0 + (x1 - x0) * f) * L.shake; dy = (y0 + (y1 - y0) * f) * L.shake; break }
    }
    const in1 = u < 1
    return { dx, dy, red: in1 ? ramp(RED, u) * L.red : 0, gray: in1 ? ramp(GRAY, u) * L.gray : 0, crack: in1 ? ramp(CRACK, u) * L.crack : 0, art: ramp(ART, Math.min(1, age / artMs)), seed: this.seed }
  }
}

/**
 * 캔버스 초상 위에 겉막 — 잿빛 막 · 붉은 빛 · 금. 흔들림(f.dx·dy)은 그리는 쪽이 초상 자리에 먼저 더한다.
 * shape: 'rect'(모서리 r) 또는 'circle'(x,y,w,h 에 꼭 맞는 원)
 */
export function drawHitPortrait(ctx: CanvasRenderingContext2D, f: HitFrame, x: number, y: number, w: number, h: number, shape: 'rect' | 'circle' = 'rect', r = 0): void {
  if (f.red <= 0.001 && f.gray <= 0.001 && f.crack <= 0.001) return
  const base = ctx.globalAlpha   // 바깥에서 건 투명도(들어오는 암전 등)에 곱한다
  ctx.save()
  ctx.beginPath()
  if (shape === 'circle') ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2)
  else if (r > 0 && typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
  ctx.clip()
  if (f.gray > 0.001) { ctx.globalAlpha = base * f.gray; ctx.fillStyle = '#454851'; ctx.fillRect(x, y, w, h) }
  if (f.red > 0.001) { ctx.globalAlpha = base * f.red; ctx.fillStyle = '#ff2a18'; ctx.fillRect(x, y, w, h) }
  if (f.crack > 0.001) {
    // SVG 의 slice 와 같게: 0~100 정사각을 긴 변에 맞추고 가운데로
    const k = Math.max(w, h) / 100, ox = x + (w - 100 * k) / 2, oy = y + (h - 100 * k) / 2, px = Math.max(0.6, Math.min(w, h) / 300)
    ctx.lineJoin = 'miter'; ctx.lineCap = 'square'
    const polys = crackOf(f.seed)
    for (const t of [0, 1, 2] as const) {
      const [dw, lw, op] = TIER[t]!
      ctx.beginPath()
      for (const q of polys) {
        if (q.t !== t) continue
        ctx.moveTo(ox + q.p[0]! * k, oy + q.p[1]! * k)
        for (let i = 2; i < q.p.length; i += 2) ctx.lineTo(ox + q.p[i]! * k, oy + q.p[i + 1]! * k)
      }
      ctx.globalAlpha = base * f.crack * op * 0.7; ctx.strokeStyle = '#1a0503'; ctx.lineWidth = dw * px; ctx.stroke()
      ctx.globalAlpha = base * f.crack * op; ctx.strokeStyle = '#fff6ee'; ctx.lineWidth = lw * px; ctx.stroke()
    }
  }
  ctx.restore()
}
