/**
 * 영남 판의 길 모양을 미리 셈한다 — 길이 바다·강·산을 따라 휘게 (형: "직선경로만 있는게 이상하지 않냐?" — 2026-10-19)
 *
 *   node --experimental-strip-types tools/yeongnam-routes.ts
 *
 * 지도를 잘게 쪼갠 칸 위에서 길마다 가장 싼 물길을 찾는다 (A*). 칸의 값은 길 종류마다 다르다:
 *   뭍의 길 — 바다는 못 간다 · 강은 나루(ford)만 쉽게 건넌다 · 산은 고갯길(pass)만 쉽게 넘는다 · 강가 골짜기를 좋아한다 · 남의 고을 곁은 비켜 간다
 *   뱃길 — 뭍은 못 간다(떠나고 닿는 고을 곁만) · 바닷가를 따라간다
 * 결과는 src/realm/data/regions/yeongnam-routes.ts 에 지도 비율 좌표로 적는다 (화면만 읽는다 — 판의 셈은 그대로).
 */
import { writeFileSync } from 'node:fs'
import { ISLES, LAND, MOUNTAINS, RIVERS } from '../src/realm/data/regions/yeongnam-geo.ts'
import { GEO, startYeongnam, yeongnamPos } from '../src/realm/data/regions/yeongnam.ts'

type P = readonly [number, number]
const GX = 256
const GY = 192
/** 지도 그림의 가로:세로 (1024×765) — 거리를 그림 위 거리로 */
const ASPECT = 1024 / 765

const toXY = (ll: P): P => yeongnamPos(ll[0], ll[1])
const land = LAND.map(toXY)
const isles = ISLES.map((p) => p.map(toXY))
const rivers = RIVERS.map((r) => ({ w: r.w, pts: r.pts.map(toXY) }))
const mounts = MOUNTAINS.map(([a, b, c, d]) => {
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

function segDist(px: number, py: number, a: P, b: P): number {
  const ax = a[0] * ASPECT
  const bx = b[0] * ASPECT
  const x = px * ASPECT
  const dx = bx - ax
  const dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(x - (ax + t * dx), py - (a[1] + t * dy))
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
  isLand[i] = inPoly(x, y, land) || isles.some((p) => inPoly(x, y, p)) ? 1 : 0
  isMount[i] = mounts.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1) ? 1 : 0
  let d = Infinity
  for (const r of rivers) for (let k = 1; k < r.pts.length; k++) d = Math.min(d, segDist(x, y, r.pts[k - 1]!, r.pts[k]!))
  riverD[i] = d
}
// 뭍까지의 칸 거리 (바닷가를 따라가는 뱃길에) — 너비 우선
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

const RIVER_W = 0.006 // 강 칸으로 치는 거리 (그림 높이의 몫)
const SEA_LAND = 0.07 // 뱃길이 지나도 되는 고을 곁의 뭍
const cellOf = (p: P): number => Math.min(GY - 1, Math.floor(p[1] * GY)) * GX + Math.min(GX - 1, Math.floor(p[0] * GX))

/** 칸 하나를 지나는 값 — 길 종류마다 */
function stepCost(i: number, kind: string, near: (i: number) => number): number {
  if (kind === 'sea') {
    // 배는 강을 거슬러 오른다 · 떠나고 닿는 고을 곁의 뭍은 지난다 (섬 안의 고을 · 조금 들어앉은 항구)
    if (isLand[i]) return riverD[i]! < RIVER_W * 1.5 ? 1.3 : near(i) < SEA_LAND ? 3 : 400
    const c = coastD[i]!
    return c <= 3 ? 1 : 1 + (c - 3) * 0.25
  }
  if (!isLand[i]) return near(i) < 0.02 ? 6 : 600
  let c = 1
  if (isMount[i]) c = kind === 'pass' ? 1.4 : kind === 'forest' ? 1.6 : 3.2
  const rd = riverD[i]!
  if (rd < RIVER_W) c += kind === 'ford' ? 0 : 22 // 강은 나루로 건넌다
  else if (rd < 0.03 && kind !== 'pass') c *= 0.8 // 강가 골짜기 길
  return c
}

interface Heap { push(i: number, f: number): void; pop(): number; size(): number }
function heap(): Heap {
  const ids: number[] = []
  const fs: number[] = []
  return {
    size: () => ids.length,
    push(i, f) {
      ids.push(i)
      fs.push(f)
      let k = ids.length - 1
      while (k > 0) {
        const p = (k - 1) >> 1
        if (fs[p]! <= fs[k]!) break
        ;[ids[p], ids[k]] = [ids[k]!, ids[p]!]
        ;[fs[p], fs[k]] = [fs[k]!, fs[p]!]
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
        let k = 0
        for (;;) {
          const l = 2 * k + 1
          const r = l + 1
          let m = k
          if (l < ids.length && fs[l]! < fs[m]!) m = l
          if (r < ids.length && fs[r]! < fs[m]!) m = r
          if (m === k) break
          ;[ids[m], ids[k]] = [ids[k]!, ids[m]!]
          ;[fs[m], fs[k]] = [fs[k]!, fs[m]!]
          k = m
        }
      }
      return top
    },
  }
}

function route(a: P, b: P, kind: string, others: readonly P[]): P[] {
  const s = cellOf(a)
  const t = cellOf(b)
  const dist = (p: P, q: P): number => Math.hypot((p[0] - q[0]) * ASPECT, p[1] - q[1])
  // 떠나고 닿는 고을과의 거리 (뱃길이 뭍을 떠나고 닿는 자리)
  const near = (i: number): number => Math.min(dist([cx(i), cy(i)], a), dist([cx(i), cy(i)], b))
  // 남의 고을 곁은 비켜 간다 — 길이 다른 고을을 꿰뚫어 보이지 않게
  const crowd = (i: number): number => {
    let c = 0
    for (const o of others) if (dist([cx(i), cy(i)], o) < 0.028) c += 6
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
        const len = Math.hypot((dx / GX) * ASPECT, dy / GY)
        const ng = g[i]! + len * (stepCost(j, kind, near) + crowd(j))
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
  const pts: P[] = [a, ...cells.slice(1, -1).map((i) => [cx(i), cy(i)] as const), b]
  // 뱃길은 곶을 질러가지 않게 촘촘히
  return simplify(pts, kind === 'sea' ? 0.0012 : 0.006)
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
  const l = simplify(pts.slice(0, wi + 1), tol)
  const r = simplify(pts.slice(wi), tol)
  return [...l.slice(0, -1), ...r]
}

const realm = startYeongnam(1, 'saro')
const pos = (id: string): P => toXY(GEO[id]!)
const out: string[] = []
const ferries: string[] = []
const r4 = (v: number): number => Math.round(v * 10000) / 10000
let crossings = 0
for (const ed of Object.values(realm.edges).sort((x, y) => (x.id < y.id ? -1 : 1))) {
  const a = pos(ed.a)
  const b = pos(ed.b)
  const others = Object.keys(GEO).filter((id) => id !== ed.a && id !== ed.b).map(pos)
  const pts = route(a, b, ed.kind, others)
  const via = pts.slice(1, -1).map((p) => `[${r4(p[0])}, ${r4(p[1])}]`)
  out.push(`  ${ed.id}: [${via.join(', ')}],`)
  // 나루 — 길이 강을 지나는 자리에 배 표시
  if (ed.kind === 'ford') {
    let best: P | null = null
    let bd = Infinity
    for (let k = 1; k < pts.length; k++) {
      for (let s = 0; s <= 10; s++) {
        const q: P = [pts[k - 1]![0] + ((pts[k]![0] - pts[k - 1]![0]) * s) / 10, pts[k - 1]![1] + ((pts[k]![1] - pts[k - 1]![1]) * s) / 10]
        let d = Infinity
        for (const rv of rivers) for (let m = 1; m < rv.pts.length; m++) d = Math.min(d, segDist(q[0], q[1], rv.pts[m - 1]!, rv.pts[m]!))
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
      const onLand = inPoly(x, y, land) || isles.some((p) => inPoly(x, y, p))
      const nearEnd = Math.min(Math.hypot((x - a[0]) * ASPECT, y - a[1]), Math.hypot((x - b[0]) * ASPECT, y - b[1])) < (ed.kind === 'sea' ? SEA_LAND : 0.035)
      let rd = Infinity
      for (const rv of rivers) for (let m = 1; m < rv.pts.length; m++) rd = Math.min(rd, segDist(x, y, rv.pts[m - 1]!, rv.pts[m]!))
      if (ed.kind === 'sea' && rd < RIVER_W * 1.5) continue // 강을 거슬러 오르는 배
      if (!nearEnd && (ed.kind === 'sea') === onLand) { crossings++; console.log("잘못:", ed.id, ed.kind, ed.a, ed.b, x.toFixed(3), y.toFixed(3)); break }
    }
  }
}
const file = `/**
 * 영남 판의 길 모양 — tools/yeongnam-routes.ts 가 만든다. 손으로 고치지 않는다 (다시 돌린다).
 * 길 id → 두 고을 사이에 지나는 점들 (지도 비율 0..1, 떠나는 고을 → 닿는 고을 = REdge.a → b). 화면만 읽는다.
 */
export const ROUTES: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
${out.join('\n')}
}

/** 나루 — 길이 강을 건너는 자리 (배 표시) */
export const FERRIES: Readonly<Record<string, readonly [number, number]>> = {
${ferries.join('\n')}
}
`
writeFileSync(new URL('../src/realm/data/regions/yeongnam-routes.ts', import.meta.url), file)
console.log(`길 ${out.length} · 나루 ${ferries.length} · 뭍/바다를 잘못 지나는 길 ${crossings}`)
