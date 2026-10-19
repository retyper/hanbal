/**
 * 삼한 남부 판의 길 모양을 미리 셈한다 — 마한·충청·경기·강원 쪽 길도 강·고개·바닷가를 따라 휘게 (영남 쪽은 tools/yeongnam-routes.ts 의 길을 그대로 쓴다)
 *
 *   node --experimental-strip-types tools/south-routes.ts
 *
 * 셈법은 yeongnam-routes.ts 와 같다 — 지도를 잘게 쪼갠 칸 위에서 길마다 가장 싼 물길(A*):
 *   뭍의 길 — 바다는 못 간다 · 강은 나루(ford)만 쉽게 건넌다 · 산은 고갯길(pass)·숲길만 덜 비싸다 · 강가 골짜기를 좋아한다 · 남의 고을 곁은 비켜 간다
 *   뱃길 — 뭍은 못 간다(떠나고 닿는 고을 곁만) · 바닷가를 따라간다
 * 결과는 src/realm/data/regions/south-routes.ts 에 남부 판 지도 비율 좌표로 적는다 (화면만 읽는다 — 판의 셈은 그대로).
 */
import { writeFileSync } from 'node:fs'
import { SOUTH_ISLES, SOUTH_LANDS, SOUTH_MOUNTAINS, SOUTH_RIVERS, southPos } from '../src/realm/data/regions/south-geo.ts'
import { southGeo, startSouth } from '../src/realm/data/regions/south.ts'
import { ROUTES as Y_ROUTES } from '../src/realm/data/regions/yeongnam-routes.ts'

type P = readonly [number, number]
const GX = 384
const GY = 284
/** 남부 판 지도 그림의 가로:세로 (1942×1434 — data/art.ts REGION_ART.south) */
const ASPECT = 1942 / 1434

const toXY = (ll: P): P => southPos(ll[0], ll[1])
const lands = SOUTH_LANDS.map((p) => p.map(toXY))
const isles = SOUTH_ISLES.map((p) => p.map(toXY))
const rivers = SOUTH_RIVERS.map((r) => ({ w: r.w, pts: r.pts.map(toXY) }))
const mounts = SOUTH_MOUNTAINS.map(([a, b, c, d]) => {
  const [x0, y1] = toXY([a, c])
  const [x1, y0] = toXY([b, d])
  return [x0, y0, x1, y1] as const
})

function inPoly(x: number, y: number, poly: readonly P[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!
    const [xj, yj] = poly[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const onLand = (x: number, y: number): boolean => lands.some((p) => inPoly(x, y, p)) || isles.some((p) => inPoly(x, y, p))

function segDist(px: number, py: number, a: P, b: P): number {
  const ax = a[0] * ASPECT
  const bx = b[0] * ASPECT
  const x = px * ASPECT
  const dx = bx - ax
  const dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(x - (ax + t * dx), py - (a[1] + t * dy))
}
const riverDist = (x: number, y: number): number => {
  let d = Infinity
  for (const r of rivers) for (let k = 1; k < r.pts.length; k++) d = Math.min(d, segDist(x, y, r.pts[k - 1]!, r.pts[k]!))
  return d
}

// 칸마다 — 뭍인가 · 산인가 · 강에서 얼마나 먼가 · 뭍에서 얼마나 먼가
const N = GX * GY
const isLand = new Uint8Array(N)
const isMount = new Uint8Array(N)
const riverD = new Float32Array(N)
const cx = (i: number): number => ((i % GX) + 0.5) / GX
const cy = (i: number): number => (Math.floor(i / GX) + 0.5) / GY
for (let i = 0; i < N; i++) {
  const x = cx(i)
  const y = cy(i)
  isLand[i] = onLand(x, y) ? 1 : 0
  isMount[i] = mounts.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1) ? 1 : 0
  riverD[i] = riverDist(x, y)
}
const coastD = new Int32Array(N).fill(-1)
{
  const q: number[] = []
  for (let i = 0; i < N; i++) if (isLand[i]) { coastD[i] = 0; q.push(i) }
  for (let h = 0; h < q.length; h++) {
    const i = q[h]!
    const x = i % GX
    const y = Math.floor(i / GX)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= GX || ny >= GY) continue
      const j = ny * GX + nx
      if (coastD[j]! >= 0) continue
      coastD[j] = coastD[i]! + 1
      q.push(j)
    }
  }
}

// 남부 판은 영남 판보다 넓어 같은 땅이 그림에서 작다 — 거리 문턱을 그만큼 줄인다 (영남 높이 2.0° / 남부 3.75°)
const K = 2.0 / 3.75
const RIVER_W = 0.006 * K
const SEA_LAND = 0.07 * K
const CROWD = 0.028 * K
const cellOf = (p: P): number => Math.min(GY - 1, Math.floor(p[1] * GY)) * GX + Math.min(GX - 1, Math.floor(p[0] * GX))

function stepCost(i: number, kind: string, near: (i: number) => number): number {
  if (kind === 'sea') {
    // 판의 아래 끝(위도 34.55)이 해남·고흥 반도를 자른다 — 남해 뱃길은 판의 아래 가장자리를 따라 돈다
    if (Math.floor(i / GX) >= GY - 2) return 2
    if (isLand[i]) return riverD[i]! < RIVER_W * 1.5 ? 1.3 : near(i) < SEA_LAND ? 3 : 400
    const c = coastD[i]!
    return c <= 3 ? 1 : 1 + (c - 3) * 0.25
  }
  if (!isLand[i]) return near(i) < 0.02 * K ? 6 : 600
  let c = 1
  if (isMount[i]) c = kind === 'pass' ? 1.4 : kind === 'forest' ? 1.6 : 3.2
  const rd = riverD[i]!
  if (rd < RIVER_W) c += kind === 'ford' ? 0 : 22
  else if (rd < 0.03 * K && kind !== 'pass') c *= 0.8
  return c
}

/** 작은 힙 (A* 의 열린 칸) */
function heap(): { push(i: number, f: number): void; pop(): number; size(): number } {
  const ids: number[] = []
  const fs: number[] = []
  const swap = (a: number, b: number): void => {
    ;[ids[a], ids[b]] = [ids[b]!, ids[a]!]
    ;[fs[a], fs[b]] = [fs[b]!, fs[a]!]
  }
  return {
    size: () => ids.length,
    push(i, f) {
      ids.push(i)
      fs.push(f)
      for (let k = ids.length - 1; k > 0;) {
        const p = (k - 1) >> 1
        if (fs[p]! <= fs[k]!) break
        swap(p, k)
        k = p
      }
    },
    pop() {
      const top = ids[0]!
      const li = ids.pop()!
      const lf = fs.pop()!
      if (ids.length > 0) {
        ids[0] = li
        fs[0] = lf
        for (let k = 0; ;) {
          const l = 2 * k + 1
          let m = k
          if (l < ids.length && fs[l]! < fs[m]!) m = l
          if (l + 1 < ids.length && fs[l + 1]! < fs[m]!) m = l + 1
          if (m === k) break
          swap(m, k)
          k = m
        }
      }
      return top
    },
  }
}

const dist = (p: P, q: P): number => Math.hypot((p[0] - q[0]) * ASPECT, p[1] - q[1])

function route(a: P, b: P, kind: string, others: readonly P[]): P[] {
  const s = cellOf(a)
  const t = cellOf(b)
  const near = (i: number): number => Math.min(dist([cx(i), cy(i)], a), dist([cx(i), cy(i)], b))
  const crowd = (i: number): number => {
    let c = 0
    for (const o of others) if (dist([cx(i), cy(i)], o) < CROWD) c += 6
    return c
  }
  const g = new Float64Array(N).fill(Infinity)
  const from = new Int32Array(N).fill(-1)
  const h = heap()
  g[s] = 0
  h.push(s, 0)
  const tx = cx(t)
  const ty = cy(t)
  while (h.size() > 0) {
    const i = h.pop()
    if (i === t) break
    const x = i % GX
    const y = Math.floor(i / GX)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= GX || ny >= GY) continue
        const j = ny * GX + nx
        const ng = g[i]! + Math.hypot((dx / GX) * ASPECT, dy / GY) * (stepCost(j, kind, near) + crowd(j))
        if (ng < g[j]!) {
          g[j] = ng
          from[j] = i
          h.push(j, ng + Math.hypot((cx(j) - tx) * ASPECT, cy(j) - ty))
        }
      }
    }
  }
  const cells: number[] = []
  for (let i = t; i !== -1; i = from[i]!) cells.push(i)
  cells.reverse()
  return simplify([a, ...cells.slice(1, -1).map((i) => [cx(i), cy(i)] as const), b], (kind === 'sea' ? 0.0012 : 0.006) * K)
}

/** 더글러스-포이커 — 꺾인 칸 길을 몇 점으로 */
function simplify(pts: readonly P[], tol: number): P[] {
  if (pts.length <= 2) return [...pts]
  let worst = 0
  let wi = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i]![0], pts[i]![1], pts[0]!, pts[pts.length - 1]!)
    if (d > worst) { worst = d; wi = i }
  }
  if (worst <= tol) return [pts[0]!, pts[pts.length - 1]!]
  return [...simplify(pts.slice(0, wi + 1), tol).slice(0, -1), ...simplify(pts.slice(wi), tol)]
}

const realm = startSouth(1, 'baekje')
const pos = (id: string): P => toXY(southGeo(id)!)
const ids = Object.keys(realm.nodes)
const out: string[] = []
const ferries: string[] = []
const r4 = (v: number): number => Math.round(v * 10000) / 10000
let crossings = 0
// 영남 판의 길은 영남 판 셈을 그대로 쓴다 — 나머지(마한·충청·경기·강원, 영남으로 넘어가는 고개)만
for (const ed of Object.values(realm.edges).filter((x) => Y_ROUTES[x.id] === undefined).sort((x, y) => (x.id < y.id ? -1 : 1))) {
  const a = pos(ed.a)
  const b = pos(ed.b)
  const pts = route(a, b, ed.kind, ids.filter((id) => id !== ed.a && id !== ed.b).map(pos))
  out.push(`  ${ed.id}: [${pts.slice(1, -1).map((p) => `[${r4(p[0])}, ${r4(p[1])}]`).join(', ')}],`)
  if (ed.kind === 'ford') {
    let best: P | null = null
    let bd = Infinity
    for (let k = 1; k < pts.length; k++) {
      for (let s = 0; s <= 10; s++) {
        const q: P = [pts[k - 1]![0] + ((pts[k]![0] - pts[k - 1]![0]) * s) / 10, pts[k - 1]![1] + ((pts[k]![1] - pts[k - 1]![1]) * s) / 10]
        const d = riverDist(q[0], q[1])
        if (d < bd) { bd = d; best = q }
      }
    }
    if (best !== null) ferries.push(`  ${ed.id}: [${r4(best[0])}, ${r4(best[1])}],`)
  }
  // 뭍의 길이 바다를 건너거나 뱃길이 뭍을 가로지르면 알린다
  for (let k = 1; k < pts.length; k++) {
    for (let s = 1; s < 10; s++) {
      const x = pts[k - 1]![0] + ((pts[k]![0] - pts[k - 1]![0]) * s) / 10
      const y = pts[k - 1]![1] + ((pts[k]![1] - pts[k - 1]![1]) * s) / 10
      const nearEnd = Math.min(dist([x, y], a), dist([x, y], b)) < (ed.kind === 'sea' ? SEA_LAND : 0.035 * K)
      if (ed.kind === 'sea' && (riverDist(x, y) < RIVER_W * 1.5 || y >= 1 - 2 / GY)) continue
      if (!nearEnd && (ed.kind === 'sea') === onLand(x, y)) { crossings++; console.log('잘못:', ed.id, ed.kind, ed.a, ed.b, x.toFixed(3), y.toFixed(3)); break }
    }
  }
}
const file = `/**
 * 삼한 남부 판의 길 모양 — tools/south-routes.ts 가 만든다. 손으로 고치지 않는다 (다시 돌린다).
 * 영남 판에 없는 길만 (영남 길은 yeongnam-routes.ts 를 남부 판 좌표로 옮겨 쓴다 — ui/realm/mapgeo.ts).
 * 길 id → 두 고을 사이에 지나는 점들 (남부 판 지도 비율 0..1, REdge.a → b). 화면만 읽는다.
 */
export const SOUTH_ROUTES: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
${out.join('\n')}
}

/** 나루 — 길이 강을 건너는 자리 (배 표시) */
export const SOUTH_FERRIES: Readonly<Record<string, readonly [number, number]>> = {
${ferries.join('\n')}
}
`
writeFileSync(new URL('../src/realm/data/regions/south-routes.ts', import.meta.url), file)
console.log(`길 ${out.length} · 나루 ${ferries.length} · 뭍/바다를 잘못 지나는 길 ${crossings}`)
