/**
 * 그래픽 고장 피해 가기 (2026-10-28 · 형의 갤럭시 — 삼성 Xclipse 950 · 크롬 156 · Vulkan).
 *
 * 그 폰 크롬은 **부드럽게 이어지는 그러데이션**(linear·radial · CSS 도 캔버스도)을 까맣게 그리고,
 * **filter 의 색 함수**(brightness·saturate·grayscale·contrast·sepia·hue-rotate·opacity·invert)를 건 요소를 하얗게 뒤집거나 지운다.
 * 되는 것: 딱 끊기는 그러데이션(계단) · conic · SVG 의 feColorMatrix 필터(filter: url(#…)) · drop-shadow · blur · opacity · mix-blend-mode.
 * (public/realm/gpu-test2.html · gpu-test3.html 로 형 폰에서 확인)
 *
 * 그래서 켜질 때 캔버스에 그러데이션을 한 번 그려 읽어 보고, 고장 난 기기에서만:
 *  1. 모든 <style> 과 style="" 속의 linear/radial-gradient 를 잘게 끊은 계단 그러데이션으로 바꾸고
 *  2. filter 의 색 함수를 같은 셈의 SVG 필터(url(#gfx-n))로 바꾸고
 *  3. 캔버스의 createLinearGradient/createRadialGradient 도 계단으로 바꾼다 (지도 조각을 잇는 가장자리 흐림이 이걸 쓴다).
 * 멀쩡한 기기는 아무것도 바꾸지 않는다. 손으로 켜고 끄기: 주소 ?gfxsafe=1|0 또는 localStorage hanbal.gfxsafe = '1'|'0'.
 */

type RGBA = [number, number, number, number]

const KEY = 'hanbal.gfxsafe'
/** 그러데이션 한 토막(두 색 사이)을 몇 칸 계단으로 — 많을수록 부드럽고 길다 */
const STEPS = 8
const STEPS_MANY = 4

const NAMED: Readonly<Record<string, RGBA>> = { transparent: [0, 0, 0, 0], black: [0, 0, 0, 1], white: [255, 255, 255, 1] }
let probe: CanvasRenderingContext2D | null | undefined

/** 색 글자 → [r,g,b,a] · 모르는 색(var() 등)은 null */
export function parseColor(s0: string): RGBA | null {
  const s = s0.trim().toLowerCase()
  if (NAMED[s] !== undefined) return [...NAMED[s]!] as RGBA
  let m = /^#([0-9a-f]{3,8})$/.exec(s)
  if (m !== null) {
    const h = m[1]!
    if (h.length === 3 || h.length === 4) {
      const v = [...h].map((c) => parseInt(c + c, 16))
      return [v[0]!, v[1]!, v[2]!, h.length === 4 ? v[3]! / 255 : 1]
    }
    if (h.length === 6 || h.length === 8) {
      const v = [0, 2, 4, 6].map((i) => parseInt(h.slice(i, i + 2) || 'ff', 16))
      return [v[0]!, v[1]!, v[2]!, h.length === 8 ? v[3]! / 255 : 1]
    }
    return null
  }
  m = /^rgba?\(([^)]*)\)$/.exec(s)
  if (m !== null) {
    const p = m[1]!.split(/[\s,/]+/).filter((x) => x !== '')
    if (p.length < 3) return null
    const ch = (x: string): number => (x.endsWith('%') ? (parseFloat(x) * 255) / 100 : parseFloat(x))
    const a = p[3] === undefined ? 1 : p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3])
    const v: RGBA = [ch(p[0]!), ch(p[1]!), ch(p[2]!), a]
    return v.some((x) => Number.isNaN(x)) ? null : v
  }
  if (s.includes('var(') || s.includes('currentcolor')) return null
  // 이름 색·hsl 따위는 캔버스에 물어본다 (브라우저에서만)
  if (probe === undefined) probe = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null
  if (probe === null) return null
  probe.fillStyle = '#010203'
  probe.fillStyle = s
  const a = probe.fillStyle
  probe.fillStyle = '#030201'
  probe.fillStyle = s
  if (probe.fillStyle !== a) return null
  return a.startsWith('#') || a.startsWith('rgb') ? parseColor(a) : null
}

function colorText(c: RGBA): string {
  const r = (x: number): number => Math.max(0, Math.min(255, Math.round(x)))
  return c[3] >= 0.999 ? `rgb(${r(c[0])},${r(c[1])},${r(c[2])})` : `rgba(${r(c[0])},${r(c[1])},${r(c[2])},${Math.max(0, Math.min(1, +c[3].toFixed(3)))})`
}

/** 두 색 사이 t — 브라우저처럼 알파를 곱한 채로 섞는다 (투명→색이 검게 흐려지지 않게) */
function mix(a: RGBA, b: RGBA, t: number): RGBA {
  const al = a[3] + (b[3] - a[3]) * t
  if (al <= 0) return [0, 0, 0, 0]
  const ch = (i: 0 | 1 | 2): number => (a[i] * a[3] + (b[i] * b[3] - a[i] * a[3]) * t) / al
  return [ch(0), ch(1), ch(2), al]
}

/** 괄호 짝 — open 은 '(' 의 자리 */
function closeOf(s: string, open: number): number {
  let d = 0
  for (let i = open; i < s.length; i++) {
    const c = s[i]
    if (c === '(') d++
    else if (c === ')') { d--; if (d === 0) return i }
  }
  return -1
}

/** 맨 바깥 단계에서만 자른다 (괄호 안의 쉼표·빈칸은 그대로) */
function splitTop(s: string, sep: ',' | ' '): string[] {
  const out: string[] = []
  let d = 0
  let cur = ''
  for (const c of s) {
    if (c === '(') d++
    else if (c === ')') d--
    if (d === 0 && (sep === ',' ? c === ',' : /\s/.test(c))) { if (cur.trim() !== '') out.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  if (cur.trim() !== '') out.push(cur.trim())
  return out
}

interface Stop { c: RGBA; p: string | null }

const pctOf = (p: string): number | null => (/^-?[\d.]+%$/.test(p) ? parseFloat(p) : p === '0' ? 0 : null)
const lenOf = (p: string): string => (p === '0' ? '0px' : p)

/** a 와 b 사이 t 자리 — 둘 다 % 면 숫자로, 아니면 calc */
function posAt(a: string, b: string, t: number): string {
  const x = pctOf(a)
  const y = pctOf(b)
  if (x !== null && y !== null) return `${+(x + (y - x) * t).toFixed(3)}%`
  if (t === 0) return a
  if (t === 1) return b
  return `calc(${lenOf(a)} + (${lenOf(b)} - ${lenOf(a)}) * ${+t.toFixed(4)})`
}

/** 그러데이션 속 하나 — 계단으로 바꾼 글, 못 바꾸면 null(그대로 둔다) */
function stepGradient(fn: 'linear' | 'radial', inner: string): string | null {
  const parts = splitTop(inner, ',')
  if (parts.length < 2) return null
  let prelude: string | null = null
  const stops: Stop[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!
    const toks = splitTop(part, ' ')
    const c = toks[0] !== undefined ? parseColor(toks[0]) : null
    if (c === null) {
      if (i === 0) { prelude = part; continue }
      return null // 색이 아닌 칸(색 힌트·var) — 바꾸지 않는다
    }
    if (toks.length === 1) stops.push({ c, p: null })
    else for (const p of toks.slice(1)) stops.push({ c, p })
  }
  if (stops.length < 2) return null
  // 이미 딱 끊긴 띠들(색마다 두 자리)이면 손대지 않는다 — 두 번 돌려도 같게 (손으로 쓴 반반 띠도)
  if (stops.length % 2 === 0 && stops.every((s, i) => s.p !== null && (i % 2 === 1 || stops[i + 1]!.c.join() === s.c.join()))) return null
  // 빈 자리 채우기 — 처음 0% · 끝 100% · 사이는 고르게
  if (stops[0]!.p === null) stops[0]!.p = '0%'
  if (stops[stops.length - 1]!.p === null) stops[stops.length - 1]!.p = '100%'
  for (let i = 1; i < stops.length - 1; i++) {
    if (stops[i]!.p !== null) continue
    let j = i
    while (stops[j]!.p === null) j++
    const a = stops[i - 1]!.p!
    const b = stops[j]!.p!
    for (let k = i; k < j; k++) stops[k]!.p = posAt(a, b, (k - i + 1) / (j - i + 1))
    i = j
  }
  const n = stops.length > 5 ? STEPS_MANY : STEPS
  const bands: string[] = []
  for (let i = 0; i + 1 < stops.length; i++) {
    const a = stops[i]!
    const b = stops[i + 1]!
    if (a.p === b.p || a.c.join() === b.c.join()) { bands.push(`${colorText(a.c)} ${a.p} ${b.p}`); continue }
    for (let k = 0; k < n; k++) bands.push(`${colorText(mix(a.c, b.c, (k + 0.5) / n))} ${posAt(a.p!, b.p!, k / n)} ${posAt(a.p!, b.p!, (k + 1) / n)}`)
  }
  return `${fn}-gradient(${prelude !== null ? `${prelude}, ` : ''}${bands.join(', ')})`
}

// ───────── filter 색 함수 → SVG feColorMatrix (Filter Effects 1 의 셈 그대로)

const COLOR_FN = new Set(['brightness', 'contrast', 'grayscale', 'sepia', 'saturate', 'hue-rotate', 'opacity', 'invert'])

function amountOf(fn: string, arg: string): number {
  const a = arg.trim()
  if (fn === 'hue-rotate') {
    if (a === '') return 0
    const v = parseFloat(a)
    return a.endsWith('rad') ? (v * 180) / Math.PI : a.endsWith('turn') ? v * 360 : v
  }
  if (a === '') return 1
  return a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a)
}

export function colorMatrix(fn: string, x: number): number[] {
  const id = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]
  switch (fn) {
    case 'brightness': return [x, 0, 0, 0, 0, 0, x, 0, 0, 0, 0, 0, x, 0, 0, 0, 0, 0, 1, 0]
    case 'contrast': { const o = 0.5 - 0.5 * x; return [x, 0, 0, 0, o, 0, x, 0, 0, o, 0, 0, x, 0, o, 0, 0, 0, 1, 0] }
    case 'invert': { const s = 1 - 2 * x; return [s, 0, 0, 0, x, 0, s, 0, 0, x, 0, 0, s, 0, x, 0, 0, 0, 1, 0] }
    case 'opacity': return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, x, 0]
    case 'grayscale': {
      const a = 1 - Math.min(1, x)
      return [0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a, 0, 0, 0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a, 0, 0, 0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a, 0, 0, 0, 0, 0, 1, 0]
    }
    case 'sepia': {
      const a = 1 - Math.min(1, x)
      return [0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a, 0, 0, 0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a, 0, 0, 0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a, 0, 0, 0, 0, 0, 1, 0]
    }
    case 'saturate': return [0.213 + 0.787 * x, 0.715 - 0.715 * x, 0.072 - 0.072 * x, 0, 0, 0.213 - 0.213 * x, 0.715 + 0.285 * x, 0.072 - 0.072 * x, 0, 0, 0.213 - 0.213 * x, 0.715 - 0.715 * x, 0.072 + 0.928 * x, 0, 0, 0, 0, 0, 1, 0]
    case 'hue-rotate': {
      const r = (x * Math.PI) / 180
      const c = Math.cos(r)
      const s = Math.sin(r)
      return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0, 0,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283, 0, 0,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0, 0, 0, 0, 0, 1, 0]
    }
  }
  return id
}

/** 만든 SVG 필터들 — 같은 함수 글은 같은 id */
const filterIds = new Map<string, string>()
const pendingDefs: string[] = []
let defsHost: SVGSVGElement | null = null

function filterUrl(fn: string, arg: string): string {
  const key = `${fn}(${arg.trim()})`
  let id = filterIds.get(key)
  if (id === undefined) {
    id = `gfx-${filterIds.size + 1}`
    filterIds.set(key, id)
    const v = colorMatrix(fn, amountOf(fn, arg)).map((x) => +x.toFixed(4)).join(' ')
    pendingDefs.push(`<filter id="${id}" color-interpolation-filters="sRGB" x="0" y="0" width="1" height="1"><feColorMatrix type="matrix" values="${v}"/></filter>`)
    flushDefs()
  }
  return `url(#${id})`
}

function flushDefs(): void {
  if (pendingDefs.length === 0 || typeof document === 'undefined' || document.body === null) return
  if (defsHost === null) {
    defsHost = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    defsHost.setAttribute('width', '0')
    defsHost.setAttribute('height', '0')
    defsHost.setAttribute('aria-hidden', 'true')
    defsHost.style.position = 'absolute'
    document.body.appendChild(defsHost)
  }
  defsHost.insertAdjacentHTML('beforeend', pendingDefs.splice(0).join(''))
}

function fixFilterValue(v: string): string {
  if (v.includes('var(')) return v
  const toks = splitTop(v.trim().replace(/\s*!important\s*$/, ''), ' ')
  const imp = /!important\s*$/.test(v) ? ' !important' : ''
  let changed = false
  const out = toks.map((t) => {
    const m = /^([a-z-]+)\((.*)\)$/s.exec(t)
    if (m === null || !COLOR_FN.has(m[1]!)) return t
    changed = true
    return filterUrl(m[1]!, m[2]!)
  })
  return changed ? ` ${out.join(' ')}${imp}` : v
}

const cssCache = new Map<string, string>()

/** CSS 글 하나(스타일시트든 style="" 이든)를 고장 난 기기에서 되는 꼴로 */
export function fixCss(css: string): string {
  const hit = cssCache.get(css)
  if (hit !== undefined) return hit
  let s = css
  // 1. 그러데이션 — repeating- 은 이미 딱 끊기는 줄무늬라 그대로, conic 도 그대로
  let out = ''
  let at = 0
  const re = /(linear|radial)-gradient\(/g
  for (let m = re.exec(s); m !== null; m = re.exec(s)) {
    const start = m.index
    if (s.slice(Math.max(0, start - 10), start).endsWith('repeating-')) continue
    const open = start + m[0].length - 1
    const close = closeOf(s, open)
    if (close < 0) break
    const rep = stepGradient(m[1] as 'linear' | 'radial', s.slice(open + 1, close))
    if (rep !== null) { out += s.slice(at, start) + rep; at = close + 1 }
    re.lastIndex = close + 1
  }
  s = out + s.slice(at)
  // 2. filter 의 색 함수 — backdrop-filter 는 url 을 못 받으니 빼고
  s = s.replace(/(^|[;{\s])((?:-webkit-)?filter\s*:)([^;}]+)/g, (_, pre: string, prop: string, val: string) => `${pre}${prop}${fixFilterValue(val)}`)
  if (cssCache.size > 4000) cssCache.clear()
  cssCache.set(css, s)
  return s
}

// ───────── 캔버스 그러데이션도 계단으로

function patchCanvas(): void {
  const P = CanvasRenderingContext2D.prototype
  const wrap = (make: (this: CanvasRenderingContext2D, ...a: number[]) => CanvasGradient) => function (this: CanvasRenderingContext2D, ...a: number[]): CanvasGradient {
    const g = make.apply(this, a)
    const add = g.addColorStop.bind(g)
    let last: { o: number; c: RGBA } | null = null
    g.addColorStop = (o: number, color: string): void => {
      const c = parseColor(color)
      if (c === null || last === null || o <= last.o) { add(o, color); if (c !== null) last = { o, c }; return }
      // 앞 색에서 이 색까지 계단 — 칸 경계마다 같은 자리에 두 색(딱 끊김)
      for (let k = 0; k < STEPS; k++) {
        const col = colorText(mix(last.c, c, (k + 0.5) / STEPS))
        add(last.o + ((o - last.o) * k) / STEPS, col)
        add(last.o + ((o - last.o) * (k + 1)) / STEPS, col)
      }
      add(o, color)
      last = { o, c }
    }
    return g
  }
  P.createLinearGradient = wrap(P.createLinearGradient as (this: CanvasRenderingContext2D, ...a: number[]) => CanvasGradient) as typeof P.createLinearGradient
  P.createRadialGradient = wrap(P.createRadialGradient as (this: CanvasRenderingContext2D, ...a: number[]) => CanvasGradient) as typeof P.createRadialGradient
}

// ───────── 알아채기 · 켜기

/** 캔버스에 빨→파 그러데이션을 그려 가운데를 읽는다 — 고장 난 기기는 까맣게 나온다 (gpu-test3 · 형 폰 rgb(0,0,0)) */
function broken(): boolean {
  try {
    const cv = document.createElement('canvas')
    cv.width = 300
    cv.height = 40
    const x = cv.getContext('2d')
    if (x === null) return false
    const g = x.createLinearGradient(0, 0, 300, 0)
    g.addColorStop(0, '#ff0000')
    g.addColorStop(1, '#0000ff')
    x.fillStyle = g
    x.fillRect(0, 0, 300, 40)
    const p = x.getImageData(150, 20, 1, 1).data
    return !(p[0]! > 60 && p[2]! > 60 && p[3]! > 200)
  } catch { return false }
}

function wanted(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('gfxsafe')
    if (q === '1' || q === '0') { localStorage.setItem(KEY, q); return q === '1' }
    const v = localStorage.getItem(KEY)
    if (v === '1' || v === '0') return v === '1'
  } catch { /* 저장이 막혀도 알아채기로 */ }
  return broken()
}

function fixStyleEl(el: HTMLStyleElement): void {
  const t = el.textContent ?? ''
  if (!/gradient\(|filter/.test(t)) return
  const f = fixCss(t)
  if (f !== t) el.textContent = f
}

function fixAttr(el: Element): void {
  const t = el.getAttribute('style')
  if (t === null || !/gradient\(|filter/.test(t)) return
  const f = fixCss(t)
  if (f !== t) el.setAttribute('style', f)
}

function fixTree(n: Node): void {
  if (!(n instanceof Element)) return
  if (n instanceof HTMLStyleElement) { fixStyleEl(n); return }
  fixAttr(n)
  for (const e of n.querySelectorAll('[style]')) fixAttr(e)
  for (const s of n.querySelectorAll('style')) fixStyleEl(s)
}

/** 켜졌나 — 다른 곳에서 볼 일이 있으면 */
export let gfxSafe = false

export function startGfxSafe(): void {
  if (typeof document === 'undefined' || !wanted()) return
  gfxSafe = true
  document.documentElement.classList.add('gfxsafe')
  patchCanvas()
  fixTree(document.documentElement)
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'attributes') { fixAttr(m.target as Element); continue }
      if (m.target instanceof HTMLStyleElement) { fixStyleEl(m.target); continue }
      for (const n of m.addedNodes) fixTree(n)
    }
    flushDefs()
  })
  mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] })
  if (document.body === null) document.addEventListener('DOMContentLoaded', flushDefs, { once: true })
  else flushDefs()
}
