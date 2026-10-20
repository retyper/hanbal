/**
 * 실제 높이 자료로 한 장짜리 지도 바탕을 그린다 — 조각을 잇지 않으니 이음매가 없다 (형 2026-10-20: "부자연스러운데 원래 있는 한국공식 지리 지도도 참고해봐").
 *
 * 자료: Terrarium 높이 타일 (Mapzen/Tilezen, AWS Open Data — 이 땅은 SRTM · GMTED · ETOPO1, 미국 정부 자료라 퍼블릭 도메인).
 *   https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png · 높이(m) = R×256 + G + B/256 − 32768 · 바다 깊이도 든다.
 * 출처 표기: docs/realm/ART.md — "지형: Mapzen Terrain Tiles (SRTM, GMTED, ETOPO1)".
 *
 * 브라우저(vite)에서 쓴다:  const m = await import('/tools/world-terrain.ts'); const c = await m.renderTerrain()
 * 투영은 게임 지도와 같다 (worldmap.ts — 경도·위도에 곧게, PX0·PY0 × geo.scale).
 */
import { WORLD_GEO } from '../src/realm/data/regions/world-geo.ts'

const PX0 = 1024 / 2.9
const PY0 = 765 / 2.0

/** 0..1 결정적 잡음 (같은 자리 같은 값) */
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** 부드러운 잡음 — 겹친 격자 셋 */
function smooth(x: number, y: number, s: number): number {
  const xi = Math.floor(x / s), yi = Math.floor(y / s)
  const fx = x / s - xi, fy = y / s - yi
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

type RGB = readonly [number, number, number]
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
function ramp(stops: ReadonlyArray<readonly [number, RGB]>, v: number): RGB {
  if (v <= stops[0]![0]) return stops[0]![1]
  for (let i = 1; i < stops.length; i++) {
    const [b, cb] = stops[i]!
    const [a, ca] = stops[i - 1]!
    if (v <= b) {
      const t = (v - a) / (b - a)
      return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]
    }
  }
  return stops[stops.length - 1]![1]
}

// 북쪽 챗지피티 조각들의 빛 — 오커 종이 · 올리브 숲 · 갈색 산 · 회청 바다
const LAND: ReadonlyArray<readonly [number, RGB]> = [
  [0, hex('#d8c48c')], [80, hex('#cdb979')], [300, hex('#b3a663')], [700, hex('#968a52')], [1200, hex('#80704a')], [1900, hex('#8f8070')], [2500, hex('#cfc8bc')],
]
const SEA: ReadonlyArray<readonly [number, RGB]> = [
  [0, hex('#8fb8be')], [30, hex('#6f9fae')], [120, hex('#5a8ca2')], [600, hex('#41738f')], [2000, hex('#2f5d7a')],
]

export interface TerrainOpts {
  /** 높이 타일 확대 단계 — 8 이면 게임 바탕과 해상도가 비슷하다 */
  readonly z?: number
  /** 산 그림자 과장 */
  readonly relief?: number
}

async function loadTile(z: number, x: number, y: number): Promise<HTMLImageElement | null> {
  const im = new Image()
  im.crossOrigin = 'anonymous'
  im.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
  try {
    await im.decode()
    return im
  } catch {
    return null
  }
}

const mercX = (lon: number, n: number): number => ((lon + 180) / 360) * n * 256
const mercY = (lat: number, n: number): number => {
  const p = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(p) + 1 / Math.cos(p)) / Math.PI) / 2) * n * 256
}

/** 게임 판 틀(삼한과 북녘) 그대로의 높이 격자 (m) — 바다는 음수 */
export async function heightGrid(opts: TerrainOpts = {}): Promise<{ W: number; H: number; e: Float32Array; PX: number; PY: number }> {
  const z = opts.z ?? 8
  const n = 2 ** z
  const P = WORLD_GEO.proj
  const PX = PX0 * WORLD_GEO.scale
  const PY = PY0 * WORLD_GEO.scale
  const W = Math.round((P.lon1 - P.lon0) * PX)
  const H = Math.round((P.lat1 - P.lat0) * PY)
  const tx0 = Math.floor(mercX(P.lon0, n) / 256), tx1 = Math.floor(mercX(P.lon1, n) / 256)
  const ty0 = Math.floor(mercY(P.lat1, n) / 256), ty1 = Math.floor(mercY(P.lat0, n) / 256)
  const mw = (tx1 - tx0 + 1) * 256, mh = (ty1 - ty0 + 1) * 256
  const mc = document.createElement('canvas')
  mc.width = mw
  mc.height = mh
  const mg = mc.getContext('2d', { willReadFrequently: true })!
  const jobs: Promise<void>[] = []
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    jobs.push(loadTile(z, tx, ty).then((im) => { if (im !== null) mg.drawImage(im, (tx - tx0) * 256, (ty - ty0) * 256) }))
  }
  await Promise.all(jobs)
  const md = mg.getImageData(0, 0, mw, mh).data
  const at = (x: number, y: number): number => {
    const xi = Math.max(0, Math.min(mw - 1, x | 0)), yi = Math.max(0, Math.min(mh - 1, y | 0))
    const i = (yi * mw + xi) * 4
    return md[i]! * 256 + md[i + 1]! + md[i + 2]! / 256 - 32768
  }
  const e = new Float32Array(W * H)
  for (let j = 0; j < H; j++) {
    const lat = P.lat1 - (j + 0.5) / PY
    const my = mercY(lat, n) - ty0 * 256
    for (let i = 0; i < W; i++) {
      const lon = P.lon0 + (i + 0.5) / PX
      const mx = mercX(lon, n) - tx0 * 256
      // 두 줄 겹침 — 가까운 넷의 가중 평균
      const x0 = Math.floor(mx - 0.5), y0 = Math.floor(my - 0.5)
      const fx = mx - 0.5 - x0, fy = my - 0.5 - y0
      const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1)
      e[j * W + i] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
    }
  }
  return { W, H, e, PX, PY }
}

/** 뭍 가면 — 높이 > 0 을 다수결로 두 번 다듬는다 (갯벌·논의 점점이 깨진 물 · 바다 속 잡음 섬을 걷는다) */
export function landMask(W: number, H: number, e: Float32Array): Uint8Array {
  let m = new Uint8Array(W * H)
  for (let k = 0; k < W * H; k++) m[k] = e[k]! > 0 ? 1 : 0
  for (let pass = 0; pass < 2; pass++) {
    const n = new Uint8Array(W * H)
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      let c = 0, t = 0
      for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
        const x = i + ox, y = j + oy
        if (x < 0 || y < 0 || x >= W || y >= H) continue
        t++
        c += m[y * W + x]!
      }
      n[j * W + i] = c * 2 > t ? 1 : 0
    }
    m = n
  }
  return m
}

/**
 * 물길 — 높이 자료에서 물이 흐르는 길을 셈한다 (우선순위 범람: 바다·판 가장자리에서 거꾸로 차오르며 각 칸이 흘러갈 곳을 정한다).
 * 돌려주는 acc[k] = 그 칸으로 모이는 칸 수 (클수록 큰 강). dir[k] = 흘러가는 칸 (−1 = 바다·가장자리).
 */
export function flow(W: number, H: number, e: Float32Array, land: Uint8Array): { acc: Float32Array; dir: Int32Array } {
  const N = W * H
  const dir = new Int32Array(N).fill(-1)
  const seen = new Uint8Array(N)
  const order = new Int32Array(N)
  let on = 0
  // 이진 힙 (키 = 차오른 높이)
  const hk = new Float64Array(N), hv = new Int32Array(N)
  let hn = 0
  const push = (k: number, v: number): void => {
    let i = hn++
    while (i > 0) {
      const p = (i - 1) >> 1
      if (hk[p]! <= k) break
      hk[i] = hk[p]!; hv[i] = hv[p]!; i = p
    }
    hk[i] = k; hv[i] = v
  }
  const pop = (): number => {
    const top = hv[0]!
    const k = hk[--hn]!, v = hv[hn]!
    let i = 0
    for (;;) {
      let c = 2 * i + 1
      if (c >= hn) break
      if (c + 1 < hn && hk[c + 1]! < hk[c]!) c++
      if (hk[c]! >= k) break
      hk[i] = hk[c]!; hv[i] = hv[c]!; i = c
    }
    hk[i] = k; hv[i] = v
    return top
  }
  const fill = new Float32Array(N)
  // 바다에 닿은 뭍 · 판 가장자리의 뭍이 물이 빠지는 문
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i
    if (!land[k]) { seen[k] = 1; continue }
    let out = i === 0 || j === 0 || i === W - 1 || j === H - 1
    if (!out) for (let oy = -1; oy <= 1 && !out; oy++) for (let ox = -1; ox <= 1; ox++) if (!land[(j + oy) * W + i + ox]) { out = true; break }
    if (out) { seen[k] = 1; fill[k] = e[k]!; push(e[k]!, k) }
  }
  while (hn > 0) {
    const k = pop()
    order[on++] = k
    const i = k % W, j = (k / W) | 0
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (ox === 0 && oy === 0) continue
      const x = i + ox, y = j + oy
      if (x < 0 || y < 0 || x >= W || y >= H) continue
      const q = y * W + x
      if (seen[q]) continue
      seen[q] = 1
      dir[q] = k
      fill[q] = Math.max(e[q]!, fill[k]! + 0.001)
      push(fill[q]!, q)
    }
  }
  const acc = new Float32Array(N)
  for (let t = on - 1; t >= 0; t--) {
    const k = order[t]!
    acc[k] = acc[k]! + 1
    const d = dir[k]!
    if (d >= 0) acc[d] = acc[d]! + acc[k]!
  }
  return { acc, dir }
}

export interface PaintOpts extends TerrainOpts {
  /** 강으로 그릴 문턱 — 모이는 칸 수 */
  readonly riverMin?: number
}

/** 옛 지도 빛으로 칠한다 — 높이 빛 · 산 그림자 · 숲 점 · 해안 먹선과 흰 물결 · 높이 자료로 셈한 강 · 종이결 */
export async function renderTerrain(opts: PaintOpts = {}): Promise<HTMLCanvasElement> {
  const { W, H, e, PX, PY } = await heightGrid(opts)
  const relief = opts.relief ?? 6
  const land = landMask(W, H, e)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const img = g.createImageData(W, H)
  const d = img.data
  const P = WORLD_GEO.proj
  const E = (i: number, j: number): number => e[Math.max(0, Math.min(H - 1, j)) * W + Math.max(0, Math.min(W - 1, i))]!
  const L = (i: number, j: number): number => land[Math.max(0, Math.min(H - 1, j)) * W + Math.max(0, Math.min(W - 1, i))]!
  // 한 칸의 거리(m) — 산 그림자의 기울기
  const dy = 111000 / PY
  for (let j = 0; j < H; j++) {
    const lat = P.lat1 - j / PY
    const dx = (111000 * Math.cos((lat * Math.PI) / 180)) / PX
    for (let i = 0; i < W; i++) {
      const h = Math.max(E(i, j), L(i, j) ? 1 : -1)
      const k = (j * W + i) * 4
      const isLand = L(i, j) === 1
      let edge = false
      let nearLand = 0
      for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
        const v = L(i + ox, j + oy) === 1
        if (v) nearLand++
        if (v !== isLand && Math.abs(ox) <= 1 && Math.abs(oy) <= 1) edge = true
      }
      let col: RGB
      if (isLand) {
        const sx = (E(i + 1, j) - E(i - 1, j)) / (2 * dx) * relief
        const sy = (E(i, j + 1) - E(i, j - 1)) / (2 * dy) * relief
        const len = Math.hypot(sx, sy, 1)
        const shade = Math.max(0, (sx * -0.5 + sy * -0.5 + 0.7) / len)
        let [r, gg, b] = ramp(LAND, h)
        const m = 0.55 + 0.6 * shade
        r *= m; gg *= m; b *= m
        const slope = Math.min(1, Math.hypot(sx, sy) / relief / 0.08)
        const forest = Math.max(0, Math.min(1, (h - 60) / 250)) * (1 - Math.max(0, (h - 1700) / 500)) * (0.35 + 0.65 * slope) * (0.6 + 0.8 * smooth(i, j, 40))
        if (hash(i, j) < forest * 0.55) { r = r * 0.55 + 30; gg = gg * 0.6 + 38; b = b * 0.5 + 12 }
        col = [r, gg, b]
      } else {
        let [r, gg, b] = ramp(SEA, Math.max(0, -E(i, j)))
        const wave = Math.sin((j + smooth(i, j, 18) * 9) * 0.9) * Math.sin(i * 0.11 + smooth(i, j, 30) * 6)
        if (wave > 0.86) { r += 40; gg += 40; b += 36 }
        if (nearLand > 0 && nearLand < 25) { const f = (nearLand / 25) * 0.6; r += (235 - r) * f; gg += (240 - gg) * f; b += (235 - b) * f }
        col = [r, gg, b]
      }
      const paper = 0.93 + 0.07 * smooth(i, j, 6) + 0.03 * (hash(i, j) - 0.5)
      let [r, gg, b] = col
      r *= paper; gg *= paper; b *= paper
      if (edge && isLand) { r = 82; gg = 62; b = 40 }
      d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  // 강 — 높이 자료로 셈한 물길 (골짜기를 따른다). 모이는 땅이 넓을수록 굵다
  const { acc, dir } = flow(W, H, e, land)
  const min = opts.riverMin ?? 2500
  g.lineCap = 'round'
  for (const [col, extra] of [['rgba(70,52,34,0.55)', 1.4], ['#6f9fb4', 0]] as const) {
    g.strokeStyle = col
    for (let k = 0; k < W * H; k++) {
      const a = acc[k]!
      const to = dir[k]!
      if (a < min || to < 0) continue
      const w = Math.min(7, 0.8 + Math.sqrt(a / min) * 0.9)
      g.lineWidth = w + extra
      g.beginPath()
      g.moveTo((k % W) + 0.5, ((k / W) | 0) + 0.5)
      g.lineTo((to % W) + 0.5, ((to / W) | 0) + 0.5)
      g.stroke()
    }
  }
  return c
}
