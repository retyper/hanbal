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
 *  2. filter 의 색 함수(brightness 따위)를 뺀다 (drop-shadow·blur 는 남김)
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

/** 그러데이션 속을 머리말과 색 칸으로 — 자리 빈 칸은 채운다 · 못 읽으면(또는 이미 딱 끊긴 띠면) null */
function parseGradient(inner: string): { prelude: string | null; stops: Stop[] } | null {
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
  return { prelude, stops }
}

/** 그러데이션 속 하나 — 계단으로 바꾼 글, 못 바꾸면 null(그대로 둔다) */
function stepGradient(fn: 'linear' | 'radial', inner: string): string | null {
  const g = parseGradient(inner)
  if (g === null) return null
  const { prelude, stops } = g
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

// ───────── 매끈한 그림으로 (10-29)
// 계단(8칸)은 화면 가득한 흐림에서 층층이 띠가 보였다 (형 10-29: "층층이 흐려지는 게 보인다 · 다시 제대로 복구"). 그 폰은 그러데이션을
// 「그리는」 것만 못 하고 그림(이미지)은 잘 그린다 — 그래서 색을 한 점씩 셈해 작은 PNG 로 굽고, 크기 없는 SVG 로 감싸 그러데이션 자리에 넣는다.
// 크기 없는 SVG 는 그러데이션처럼 칸 크기에 맞춰 늘어난다(preserveAspectRatio none). 못 읽는 것(px 자리·px 원 등)은 계단 그대로.

const smoothCache = new Map<string, string | null>()

/** 칸 0..1 자리(가로 u · 세로 v)의 그러데이션 자리 t 와 구울 그림 크기 — 못 셈하면 null */
function geometry(fn: 'linear' | 'radial', prelude: string | null): { t: (u: number, v: number) => number; w: number; h: number } | null {
  const pre = (prelude ?? '').trim().toLowerCase()
  if (fn === 'linear') {
    let deg = 180
    if (pre !== '') {
      const m = /^(-?[\d.]+)(deg|turn|rad)$/.exec(pre)
      if (m !== null) deg = m[2] === 'turn' ? +m[1]! * 360 : m[2] === 'rad' ? (+m[1]! * 180) / Math.PI : +m[1]!
      else if (pre.startsWith('to ')) {
        const w = pre.slice(3).split(/\s+/)
        const x = w.includes('right') ? 1 : w.includes('left') ? -1 : 0
        const y = w.includes('top') ? 1 : w.includes('bottom') ? -1 : 0
        if (x === 0 && y === 0) return null
        deg = (Math.atan2(x, y) * 180) / Math.PI
      } else return null
    }
    const a = (deg * Math.PI) / 180
    const sx = Math.sin(a)
    const sy = -Math.cos(a)
    const L = Math.abs(sx) + Math.abs(sy)
    const t = (u: number, v: number): number => ((u - 0.5) * sx + (v - 0.5) * sy) / L + 0.5
    // 곧은 방향이면 한 줄짜리 띠로 충분하다
    if (Math.abs(sx) < 1e-6) return { t, w: 1, h: 160 }
    if (Math.abs(sy) < 1e-6) return { t, w: 160, h: 1 }
    return { t, w: 96, h: 96 }
  }
  // radial — [circle|ellipse] [크기] [at x y]
  let shape: 'circle' | 'ellipse' = 'ellipse'
  let size = 'farthest-corner'
  let ex: [number, number] | null = null
  let cx = 0.5
  let cy = 0.5
  const cut = pre.split(/\s*\bat\b\s*/)
  const head = (cut[0] ?? '').trim()
  const pos = (s: string, horiz: boolean): number | null => {
    if (s === 'center') return 0.5
    if (s === (horiz ? 'left' : 'top')) return 0
    if (s === (horiz ? 'right' : 'bottom')) return 1
    const p = pctOf(s)
    return p !== null ? p / 100 : null
  }
  if (cut[1] !== undefined) {
    const w = cut[1].trim().split(/\s+/)
    let x = w[0] ?? 'center'
    let y = w[1] ?? 'center'
    if (x === 'top' || x === 'bottom') { const z = x; x = y; y = z }
    const px = pos(x, true)
    const py = pos(y, false)
    if (px === null || py === null) return null
    cx = px
    cy = py
  }
  for (const w of head.split(/\s+/).filter((x) => x !== '')) {
    if (w === 'circle' || w === 'ellipse') shape = w
    else if (/^(closest|farthest)-(side|corner)$/.test(w)) size = w
    else {
      const p = pctOf(w)
      if (p === null) return null // px 크기 — 늘려 그릴 수 없다
      ex = ex === null ? [p / 100, p / 100] : [ex[0], p / 100]
    }
  }
  let rx: number
  let ry: number
  if (ex !== null) {
    if (shape === 'circle') return null
    rx = ex[0]
    ry = ex[1]
  } else {
    const dx = [cx, 1 - cx]
    const dy = [cy, 1 - cy]
    const side = size.endsWith('side')
    const far = size.startsWith('farthest')
    if (shape === 'circle') {
      const corners = dx.flatMap((a) => dy.map((b) => Math.hypot(a, b)))
      const r = side ? (far ? Math.max(...dx, ...dy) : Math.min(...dx, ...dy)) : (far ? Math.max(...corners) : Math.min(...corners))
      rx = r
      ry = r
    } else {
      const sx = far ? Math.max(...dx) : Math.min(...dx)
      const sy = far ? Math.max(...dy) : Math.min(...dy)
      rx = side ? sx : sx * Math.SQRT2
      ry = side ? sy : sy * Math.SQRT2
    }
  }
  if (!(rx > 0) || !(ry > 0)) return null
  return { t: (u, v) => Math.hypot((u - cx) / rx, (v - cy) / ry), w: 96, h: 96 }
}

/** 그러데이션 → 늘어나는 그림 주소 (blob:) · 못 하면 null */
function smoothGradient(fn: 'linear' | 'radial', inner: string): string | null {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') return null
  const key = `${fn}|${inner}`
  const hit = smoothCache.get(key)
  if (hit !== undefined) return hit
  let out: string | null = null
  try {
    const g = parseGradient(inner)
    const geo = g !== null ? geometry(fn, g.prelude) : null
    const pos = g !== null ? g.stops.map((s) => { const p = pctOf(s.p!); return p !== null ? p / 100 : null }) : []
    if (g !== null && geo !== null && pos.every((p) => p !== null)) {
      const ps = pos as number[]
      // 뒤 칸 자리가 앞 칸보다 앞이면 앞 칸 자리로 (CSS 와 같게)
      for (let i = 1; i < ps.length; i++) if (ps[i]! < ps[i - 1]!) ps[i] = ps[i - 1]!
      const at = (t: number): RGBA => {
        if (t <= ps[0]!) return g.stops[0]!.c
        for (let i = 0; i + 1 < ps.length; i++) {
          if (t <= ps[i + 1]!) {
            const span = ps[i + 1]! - ps[i]!
            return span <= 0 ? g.stops[i + 1]!.c : mix(g.stops[i]!.c, g.stops[i + 1]!.c, (t - ps[i]!) / span)
          }
        }
        return g.stops[g.stops.length - 1]!.c
      }
      const cv = document.createElement('canvas')
      cv.width = geo.w
      cv.height = geo.h
      const x = cv.getContext('2d')
      if (x !== null) {
        const img = x.createImageData(geo.w, geo.h)
        let seed = 7
        const noise = (): number => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296 - 0.5 } // 8비트 띠가 안 지게 반 칸 흩뿌림
        for (let j = 0; j < geo.h; j++) {
          for (let i = 0; i < geo.w; i++) {
            const c = at(geo.t((i + 0.5) / geo.w, (j + 0.5) / geo.h))
            const o = (j * geo.w + i) * 4
            img.data[o] = Math.round(c[0] + noise())
            img.data[o + 1] = Math.round(c[1] + noise())
            img.data[o + 2] = Math.round(c[2] + noise())
            img.data[o + 3] = Math.round(c[3] * 255 + noise())
          }
        }
        x.putImageData(img, 0, 0)
        const png = cv.toDataURL('image/png')
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image width="100%" height="100%" preserveAspectRatio="none" href="${png}" xlink:href="${png}"/></svg>`
        out = `url(${URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))})` // 따옴표 없이 — style="" 속에 들어가도 깨지지 않게
      }
    }
  } catch { out = null }
  if (smoothCache.size > 3000) smoothCache.clear()
  smoothCache.set(key, out)
  return out
}

// ───────── filter 색 함수는 뺀다
// 처음엔 같은 셈의 SVG 필터(feColorMatrix · url(#…))로 바꿨는데, 형 폰에서 움직이는 병사 그림에 걸면 회색 네모가 됐다 (10-28 · 폰을 직접 열어 봄).
// 그래서 색 함수는 빼고 drop-shadow·blur 만 남긴다 — 색이 조금 덜 바래 보일 뿐, 그림은 보인다

const COLOR_FN = new Set(['brightness', 'contrast', 'grayscale', 'sepia', 'saturate', 'hue-rotate', 'opacity', 'invert'])

function fixFilterValue(v: string): string {
  if (v.includes('var(')) return v
  const imp = /!important\s*$/.test(v) ? ' !important' : ''
  const toks = splitTop(v.trim().replace(/\s*!important\s*$/, ''), ' ')
  const out = toks.filter((t) => { const m = /^([a-z-]+)\(/.exec(t); return m === null || !COLOR_FN.has(m[1]!) })
  if (out.length === toks.length) return v
  return ` ${out.length > 0 ? out.join(' ') : 'none'}${imp}`
}

const cssCache = new Map<string, string>()
/** 매끈한 그림으로 바꾸나 — 켜질 때(startGfxSafe) 켠다 · 주소에 ?gfxsmooth=0 이면 옛 계단 */
let smoothOn = false

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
    const fn = m[1] as 'linear' | 'radial'
    const inner = s.slice(open + 1, close)
    const rep = (smoothOn ? smoothGradient(fn, inner) : null) ?? stepGradient(fn, inner)
    if (rep !== null) { out += s.slice(at, start) + rep; at = close + 1 }
    re.lastIndex = close + 1
  }
  s = out + s.slice(at)
  // 2. filter 의 색 함수 — backdrop-filter 는 url 을 못 받으니 빼고
  s = s.replace(/(^|[;{\s"'])((?:-webkit-)?filter\s*:)([^;}"']+)/g, (_, pre: string, prop: string, val: string) => `${pre}${prop}${fixFilterValue(val)}`)
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
  if (smoothOn) patchCanvasSmooth(P)
}

/**
 * 캔버스 그러데이션도 매끈한 그림 무늬로 (10-29) — 하늘·빛 무리가 계단으로 층층이 보였다 (형 10-29).
 * 그러데이션을 만들 때 자리와 색을 적어 두었다가, fillStyle·strokeStyle 에 넣는 순간 점마다 셈해 구운 그림 무늬(CanvasPattern)로 바꿔 넣는다.
 * 곧은 것은 한 줄 띠(양끝 색을 길게 늘여 둠), 둥근 것은 작게 구워 늘린다. 못 하는 것(두 원의 가운데가 다름 등)은 위의 계단 그대로.
 */
function patchCanvasSmooth(P: CanvasRenderingContext2D): void {
  interface Meta { lin: boolean; a: number[]; stops: Array<{ o: number; c: RGBA }> }
  const meta = new WeakMap<CanvasGradient, Meta>()
  const made = new WeakMap<CanvasGradient, CanvasPattern | null>()
  const PAD = 2048
  const remember = (make: (this: CanvasRenderingContext2D, ...a: number[]) => CanvasGradient, lin: boolean) => function (this: CanvasRenderingContext2D, ...a: number[]): CanvasGradient {
    const g = make.apply(this, a)
    const m: Meta = { lin, a, stops: [] }
    meta.set(g, m)
    const add = g.addColorStop.bind(g)
    g.addColorStop = (o: number, color: string): void => { add(o, color); const c = parseColor(color); if (c !== null) m.stops.push({ o, c }) }
    return g
  }
  P.createLinearGradient = remember(P.createLinearGradient as (this: CanvasRenderingContext2D, ...a: number[]) => CanvasGradient, true) as typeof P.createLinearGradient
  P.createRadialGradient = remember(P.createRadialGradient as (this: CanvasRenderingContext2D, ...a: number[]) => CanvasGradient, false) as typeof P.createRadialGradient
  const colorAt = (st: Meta['stops'], t: number): RGBA => {
    if (t <= st[0]!.o) return st[0]!.c
    for (let i = 0; i + 1 < st.length; i++) {
      if (t <= st[i + 1]!.o) { const span = st[i + 1]!.o - st[i]!.o; return span <= 0 ? st[i + 1]!.c : mix(st[i]!.c, st[i + 1]!.c, (t - st[i]!.o) / span) }
    }
    return st[st.length - 1]!.c
  }
  const paint = (w: number, h: number, t: (x: number, y: number) => number, st: Meta['stops']): HTMLCanvasElement | null => {
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const x = cv.getContext('2d')
    if (x === null) return null
    const img = x.createImageData(w, h)
    let seed = 11
    const noise = (): number => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296 - 0.5 }
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const c = colorAt(st, t(i + 0.5, j + 0.5))
        const o = (j * w + i) * 4
        img.data[o] = Math.round(c[0] + noise()); img.data[o + 1] = Math.round(c[1] + noise()); img.data[o + 2] = Math.round(c[2] + noise()); img.data[o + 3] = Math.round(c[3] * 255 + noise())
      }
    }
    x.putImageData(img, 0, 0)
    return cv
  }
  const patternOf = (ctx: CanvasRenderingContext2D, g: CanvasGradient): CanvasPattern | null => {
    if (made.has(g)) return made.get(g)!
    let out: CanvasPattern | null = null
    try {
      const m = meta.get(g)!
      const st = [...m.stops].sort((p, q) => p.o - q.o)
      if (st.length >= 2) {
        if (m.lin) {
          const [x0, y0, x1, y1] = m.a as [number, number, number, number]
          const len = Math.hypot(x1 - x0, y1 - y0)
          if (len > 0.5 && len < 8192) {
            const w = Math.ceil(len) + PAD * 2
            const cv = paint(w, 1, (x) => (x - PAD) / len, st)
            const pat = cv !== null ? ctx.createPattern(cv, 'repeat-y') : null
            if (pat !== null) {
              pat.setTransform(new DOMMatrix().translateSelf(x0, y0).rotateSelf((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI).translateSelf(-PAD, 0))
              out = pat
            }
          }
        } else {
          const [x0, y0, r0, x1, y1, r1] = m.a as [number, number, number, number, number, number]
          if (Math.abs(x0 - x1) < 0.01 && Math.abs(y0 - y1) < 0.01 && r1 > r0 && r1 < 8192) {
            const R = r1 * 3 // 바깥은 끝 색 — 넉넉히 덮는다
            const S = 384
            const k = (2 * R) / S
            const cv = paint(S, S, (x, y) => (Math.hypot(x * k - R, y * k - R) - r0) / (r1 - r0), st)
            const pat = cv !== null ? ctx.createPattern(cv, 'no-repeat') : null
            if (pat !== null) {
              pat.setTransform(new DOMMatrix().translateSelf(x0 - R, y0 - R).scaleSelf(k, k))
              out = pat
            }
          }
        }
      }
    } catch { out = null }
    made.set(g, out)
    return out
  }
  for (const prop of ['fillStyle', 'strokeStyle'] as const) {
    const d = Object.getOwnPropertyDescriptor(P, prop)
    if (d?.set === undefined || d.get === undefined) continue
    const set = d.set
    Object.defineProperty(P, prop, { ...d, set(this: CanvasRenderingContext2D, v: unknown) { set.call(this, v instanceof CanvasGradient && meta.has(v) ? (patternOf(this, v) ?? v) : v) } })
  }
}

// ───────── 알아채기 · 켜기

/** 캔버스에 빨→파 그러데이션을 그려 가운데를 읽는다 — 고장 난 기기는 까맣게 나온다 (gpu-test3 · 형 폰 rgb(0,0,0)) */
function broken(): boolean {
  // 그래픽 이름으로 먼저 — 삼성 Xclipse(AMD RDNA) 는 다 같은 고장으로 본다 (형 폰: Xclipse 950 · 크롬 156)
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    const name = gl !== null && gl !== undefined && ext !== null && ext !== undefined ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''
    if (/xclipse/i.test(name)) return true
  } catch { /* 못 물어보면 그림판으로 */ }
  // 그림판은 크게 — 작은 판은 크롬이 그래픽 칩 대신 CPU 로 그려 고장이 안 드러났다 (10-28 · 형 폰에서 gfxsafe 가 안 켜짐)
  try {
    const cv = document.createElement('canvas')
    cv.width = 512
    cv.height = 512
    const x = cv.getContext('2d')
    if (x === null) return false
    const g = x.createLinearGradient(0, 0, 512, 0)
    g.addColorStop(0, '#ff0000')
    g.addColorStop(1, '#0000ff')
    x.fillStyle = g
    x.fillRect(0, 0, 512, 512)
    const p = x.getImageData(256, 256, 1, 1).data
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

/**
 * 그리기 전에 바꿔 끼운다 — innerHTML · insertAdjacentHTML 로 들어오는 글을 먼저 고친다.
 * 지켜보기(MutationObserver)만 하면 깨진 무늬가 한 번 그려진 뒤 바뀌어, 누를 때마다 다시 그리는 지도가 번쩍였다 (형 10-28: "뭐 터치하기만 하면 엄청 깜빡")
 */
function patchHtml(): void {
  const fix = (v: unknown): unknown => (typeof v === 'string' && /gradient\(|filter/.test(v) ? fixCss(v) : v)
  const d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')
  if (d?.set !== undefined && d.get !== undefined) {
    const set = d.set
    Object.defineProperty(Element.prototype, 'innerHTML', { ...d, set(this: Element, v: string) { set.call(this, fix(v) as string) } })
  }
  const ins = Element.prototype.insertAdjacentHTML
  Element.prototype.insertAdjacentHTML = function (this: Element, where: InsertPosition, html: string): void { ins.call(this, where, fix(html) as string) }
}

/** 켜졌나 — 다른 곳에서 볼 일이 있으면 */
export let gfxSafe = false

export function startGfxSafe(): void {
  if (typeof document === 'undefined' || !wanted()) return
  gfxSafe = true
  try { smoothOn = new URLSearchParams(location.search).get('gfxsmooth') !== '0' } catch { smoothOn = true }
  document.documentElement.classList.add('gfxsafe')
  patchCanvas()
  patchHtml()
  fixTree(document.documentElement)
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'attributes') { fixAttr(m.target as Element); continue }
      if (m.target instanceof HTMLStyleElement) { fixStyleEl(m.target); continue }
      for (const n of m.addedNodes) fixTree(n)
    }
  })
  mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] })
}
