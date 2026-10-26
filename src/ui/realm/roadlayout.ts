/**
 * 길 펴기 — 길끼리 고을 밖에서 엇갈리지 않고, 길이 남의 고을 땅을 지나지 않게 (형 10-27: "국경이랑 길이 조금 더 단순해도 좋으니까 서로 꼬이지 않게, 길도 꼬이지 않게 해 줘").
 *
 * 판의 길 모양(mapgeo.routePoints — 미리 셈한 물길)을 먼저 서로 밀어 두고(separatedRoutes), 그래도
 *   - 다른 길과 고을 밖에서 엇갈리거나
 *   - 남의 고을 자리를 스치거나
 *   - 두 끝이 아닌 고을의 땅(가까운 고을 셈)으로 한참 들어가는 길은
 * 몇 가지 단순한 모양(물길 · 곧은 길 · 한 구비 휜 길 · 물길을 곧게 편 것)을 대어 보고 가장 덜 꼬이는 것을 고른다.
 * 어느 고을끼리 잇는지(판)는 그대로다 — 그림만 바뀐다. 길이 정해지면 땅 가르기(territory.ts)가 길 둘레를 두 끝 고을 땅으로 묶는다.
 * 판마다 한 번만 셈한다 (고을 자리·길은 안 바뀐다). 재는 것은 tools/realm-tangle.ts.
 */
import { REGION_ART, nodePos } from '../../realm/data/art.ts'
import type { NodeKind, Realm, REdge, RegionId } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { curvePts, ferryAt, naturalLines, routePoints, segCross, separatedRoutes, type Pt } from './mapgeo.ts'
import { territory, type Territory } from './territory.ts'

/** 고을 땅의 크기 배수 — 큰 고을이 조금 넓다 */
export const CELL_SIZE: Readonly<Record<NodeKind, number>> = { capital: 1.3, port: 1.1, fort: 0.95, village: 1, ironMine: 0.9, wild: 0.85, sodo: 0.7 }

/** 판의 생김새 눈금 — 길 굵기 배율 · 길끼리 띄울 틈 · 고을 둘레(엇갈려도 고을 그림 밑이라 안 보이는 자리) */
export function roadScale(region: RegionId): { sw: number; gap: number; endR: number; hub: number; clear: number } {
  const RA = REGION_ART[region]
  const sw = RA.nodeScale < 1 ? 0.6 : 1
  return { sw, gap: 14 * sw, endR: RA.terrR * 0.15, hub: RA.terrR * 0.25, clear: RA.terrR * P.realm.roadClear }
}

/** 땅 가르기의 퍼지는 끝 — 뭍 자료가 없는 판(변한 축소판)은 바다로 번지지 않게 줄인다 */
const terrReach = (region: RegionId, landNull: boolean): number => REGION_ART[region].terrR * (landNull ? 1.15 : 1.5)

export interface Town { readonly id: string; readonly p: Pt; readonly size: number }
interface Road { readonly ed: REdge; readonly ia: number; readonly ib: number; readonly base: readonly Pt[]; readonly sep: readonly Pt[] }

const lenOf = (p: readonly Pt[]): number => {
  let s = 0
  for (let i = 1; i < p.length; i++) s += Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1])
  return s
}

/** 꺾은선을 고른 간격 n+1 점으로 */
function resample(p: readonly Pt[], n: number): Pt[] {
  const L = lenOf(p)
  if (L <= 0 || p.length < 2) return Array.from({ length: n + 1 }, () => p[0]!)
  const out: Pt[] = [p[0]!]
  let i = 1
  let acc = 0
  let seg = Math.hypot(p[1]![0] - p[0]![0], p[1]![1] - p[0]![1])
  for (let k = 1; k < n; k++) {
    const want = (L * k) / n
    while (acc + seg < want && i < p.length - 1) {
      acc += seg
      i++
      seg = Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1])
    }
    const t = seg > 0 ? (want - acc) / seg : 0
    out.push([p[i - 1]![0] + (p[i]![0] - p[i - 1]![0]) * t, p[i - 1]![1] + (p[i]![1] - p[i - 1]![1]) * t])
  }
  out.push(p[p.length - 1]!)
  return out
}

/** 점에서 꺾은선까지 가장 가까운 거리 */
function distTo(q: Pt, p: readonly Pt[]): number {
  let best = Infinity
  for (let i = 1; i < p.length; i++) {
    const [ax, ay] = p[i - 1]!
    const [bx, by] = p[i]!
    const dx = bx - ax
    const dy = by - ay
    const l2 = dx * dx + dy * dy
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - ay) * dy) / l2)) : 0
    best = Math.min(best, Math.hypot(q[0] - ax - dx * t, q[1] - ay - dy * t))
  }
  return best
}

/**
 * 두 길(곡선 위의 점들)이 고을 밖에서 엇갈리는 수 — 같은 고을에서 갈라지는 두 길이 그 고을 둘레(hub) 안에서 닿는 것은 뺀다.
 * `shared` 는 두 길이 함께 쓰는 고을 자리들.
 */
interface BBox { x0: number; y0: number; x1: number; y1: number }
const bboxOf = (p: readonly Pt[], pad = 0): BBox => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad }
}
const meets = (a: BBox, b: BBox): boolean => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1

export function crossCount(p: readonly Pt[], q: readonly Pt[], shared: readonly Pt[], hub: number): number {
  // 마디 열둘씩 묶은 상자끼리 먼저 본다 — 긴 물길은 마디가 수백이다
  const CH = 12
  const boxes = (s: readonly Pt[]): BBox[] => {
    const out: BBox[] = []
    for (let k = 0; k < s.length - 1; k += CH) out.push(bboxOf(s.slice(k, Math.min(s.length, k + CH + 1))))
    return out
  }
  const bp = boxes(p)
  const bq = boxes(q)
  let n = 0
  for (const [ci, A] of bp.entries()) {
    for (const [cj, B] of bq.entries()) {
      if (!meets(A, B)) continue
      for (let i = ci * CH + 1; i <= Math.min(p.length - 1, ci * CH + CH); i++) {
        const a = p[i - 1]!
        const b = p[i]!
        const x0 = Math.min(a[0], b[0])
        const x1 = Math.max(a[0], b[0])
        const y0 = Math.min(a[1], b[1])
        const y1 = Math.max(a[1], b[1])
        for (let j = cj * CH + 1; j <= Math.min(q.length - 1, cj * CH + CH); j++) {
          const c = q[j - 1]!
          const d = q[j]!
          if (Math.max(c[0], d[0]) < x0 || Math.min(c[0], d[0]) > x1 || Math.max(c[1], d[1]) < y0 || Math.min(c[1], d[1]) > y1) continue
          const x = segCross(a, b, c, d)
          if (x === null) continue
          if (shared.some((s) => Math.hypot(x[0] - s[0], x[1] - s[1]) < hub)) continue
          n++
        }
      }
    }
  }
  return n
}

/** 길 하나에 대어 볼 모양들 — 맨 앞이 지금 모양. 판(어느 고을끼리)은 그대로, 두 끝도 그대로 */
function candidates(rd: Road): Pt[][] {
  const a = rd.sep[0]!
  const b = rd.sep[rd.sep.length - 1]!
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const out: Pt[][] = [rd.sep.slice(), rd.base.slice(), [a, b]]
  const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  // 한 구비 — 두 고을을 잇는 줄에 직각으로
  for (const s of [0.06, -0.06, 0.12, -0.12, 0.2, -0.2, 0.3, -0.3, 0.42, -0.42]) out.push([a, [m[0] - dy * s, m[1] + dx * s], b])
  // 두 구비(S) — 엇갈리는 길 사이를 빠져나간다
  for (const s of [0.1, -0.1, 0.18, -0.18]) {
    out.push([a, [a[0] + dx / 3 - dy * s, a[1] + dy / 3 + dx * s], [a[0] + (dx * 2) / 3 + dy * s, a[1] + (dy * 2) / 3 - dx * s], b])
  }
  // 한쪽으로 치우친 구비 — 앞·뒤 고을 가까이서 휜다
  for (const s of [0.15, -0.15]) {
    out.push([a, [a[0] + dx * 0.3 - dy * s, a[1] + dy * 0.3 + dx * s], b])
    out.push([a, [a[0] + dx * 0.7 - dy * s, a[1] + dy * 0.7 + dx * s], b])
  }
  // 물길을 곧은 줄 쪽으로 편 것 — 골짜기를 따르는 맛은 남기고 굽이는 줄인다
  if (rd.sep.length > 2) {
    const L = lenOf(rd.sep)
    for (const f of [0.35, 0.65]) {
      let acc = 0
      out.push(rd.sep.map((p, i) => {
        if (i > 0) acc += Math.hypot(p[0] - rd.sep[i - 1]![0], p[1] - rd.sep[i - 1]![1])
        const t = L > 0 ? acc / L : 0
        return [p[0] + (a[0] + dx * t - p[0]) * f, p[1] + (a[1] + dy * t - p[1]) * f] as const
      }))
    }
  }
  return out
}

const layCache = new Map<string, Map<string, Pt[]>>()

/**
 * 판의 길 모양 (그림 좌표, 길마다 a → b) — 서로 밀어 둔 물길에서 시작해 꼬인 길만 다른 모양으로 바꾼다.
 * `region` 판의 `edges` 를 `towns`(고을 자리) 위에 놓는다. `key` 로 한 번만 셈한다.
 */
export function layRoads(key: string, region: RegionId, edges: readonly REdge[], towns: readonly Town[], W: number, H: number): Map<string, Pt[]> {
  const hit = layCache.get(key)
  if (hit !== undefined) return hit
  const { gap, endR, hub, clear } = roadScale(region)
  const R = terrReach(region, naturalLines(region, W, H).land === null)
  const at = new Map(towns.map((t, i) => [t.id, i] as const))
  const sorted = [...edges].sort((x, y) => (x.id < y.id ? -1 : 1))
  const base = sorted.map((ed) => routePoints(region, ed, towns[at.get(ed.a)!]?.p ?? [0, 0], towns[at.get(ed.b)!]?.p ?? [0, 0], W, H))
  const sep = separatedRoutes(`${key}:sep`, sorted.map((ed, i) => [ed.id, base[i]!] as const), gap, endR)
  const roads: Road[] = sorted.map((ed, i) => ({ ed, ia: at.get(ed.a) ?? -1, ib: at.get(ed.b) ?? -1, base: base[i]!, sep: sep.get(ed.id) ?? base[i]! }))
  const ferry = roads.map((rd) => (rd.ed.kind === 'ford' ? ferryAt(region, rd.ed, W, H) : null))
  // 고을마다 땅을 셈하는 대강 — 걸음이 가장 짧은 고을의 땅 (큰 고을은 조금 앞에서 출발 · territory.ts 와 같은 뜻)
  const off = towns.map((t) => -R * 0.3 * (t.size - 1))

  type Shape = { pts: Pt[]; curve: Pt[]; dense: Pt[]; box: BBox; ref: Pt[] }
  const shapeOf = (pts: Pt[]): Shape => {
    const curve = curvePts(pts, pts.length > 8 ? 2 : 6) // 물길은 점이 이미 촘촘하다
    return { pts, curve, dense: resample(curve, Math.max(6, Math.ceil(lenOf(curve) / gap))), box: bboxOf(curve, gap), ref: resample(curve, 16) }
  }
  const cur: Shape[] = roads.map((rd) => shapeOf(rd.sep.slice()))
  const ref = cur.map((s) => s.ref)
  // 다른 길의 점 눈금 — 바짝 붙어 나란히 가는지 빨리 본다 (길이 바뀌면 그 길 것만 갈아 넣는다)
  const cell = gap
  const gk = (gx: number, gy: number): number => gx * 65536 + gy
  const grid = new Map<number, Array<readonly [number, number, number]>>()
  const put = (ri: number, add: boolean): void => {
    for (const [x, y] of cur[ri]!.dense) {
      const k = gk(Math.floor(x / cell), Math.floor(y / cell))
      const l = grid.get(k)
      if (add) {
        if (l === undefined) grid.set(k, [[ri, x, y]])
        else l.push([ri, x, y])
      } else if (l !== undefined) grid.set(k, l.filter((e) => e[0] !== ri))
    }
  }
  cur.forEach((_, ri) => put(ri, true))

  /** 꼬임의 갈래 — X 엇갈림 · T 남의 고을 스침 · Fy 배 자리를 비낌 · F 남의 땅에 든 몫 · N 바짝 붙은 몫 · D 처음 모양에서 벗어난 몫 */
  const parts = (i: number, s: Shape): { X: number; T: number; Fy: number; F: number; N: number; D: number } => {
    const rd = roads[i]!
    const A = towns[rd.ia]?.p
    const B = towns[rd.ib]?.p
    if (A === undefined || B === undefined) return { X: 0, T: 0, Fy: 0, F: 0, N: 0, D: 0 }
    let X = 0
    for (let j = 0; j < roads.length; j++) {
      if (j === i || !meets(s.box, cur[j]!.box)) continue
      const o = roads[j]!
      const shared: Pt[] = []
      for (const t of [rd.ia, rd.ib]) if (t === o.ia || t === o.ib) shared.push(towns[t]!.p)
      X += crossCount(s.curve, cur[j]!.curve, shared, hub)
    }
    // 바짝 붙어 나란히 가는 점 (두 끝 둘레는 빼고 — 고을에서는 길이 모여야 맞다)
    let near = 0
    const g2 = (gap * 0.6) ** 2
    for (const q of s.dense) {
      if (Math.hypot(q[0] - A[0], q[1] - A[1]) < hub * 1.5 || Math.hypot(q[0] - B[0], q[1] - B[1]) < hub * 1.5) continue
      const cx = Math.floor(q[0] / cell)
      const cy = Math.floor(q[1] / cell)
      let hit = false
      for (let gx = cx - 1; gx <= cx + 1 && !hit; gx++) for (let gy = cy - 1; gy <= cy + 1 && !hit; gy++) {
        for (const [rj, x, y] of grid.get(gk(gx, gy)) ?? []) {
          if (rj !== i && (x - q[0]) ** 2 + (y - q[1]) ** 2 < g2) { hit = true; break }
        }
      }
      if (hit) near++
    }
    // 남의 고을 자리를 스침 · 남의 고을 땅에 들어섬 (뱃길은 바다라 땅을 안 본다)
    const L = Math.max(1, Math.hypot(B[0] - A[0], B[1] - A[1]))
    let T = 0
    const local: number[] = []
    for (let t = 0; t < towns.length; t++) {
      const p = towns[t]!.p
      if (p[0] < s.box.x0 - L || p[0] > s.box.x1 + L || p[1] < s.box.y0 - L || p[1] > s.box.y1 + L) continue
      local.push(t)
      if (t === rd.ia || t === rd.ib) continue
      if (p[0] < s.box.x0 - clear || p[0] > s.box.x1 + clear || p[1] < s.box.y0 - clear || p[1] > s.box.y1 + clear) continue
      if (distTo(p, s.curve) < clear) T++
    }
    let F = 0
    if (rd.ed.kind !== 'sea') {
      for (const q of s.dense) {
        let bi = -1
        let bd = Infinity
        for (const t of local) {
          const d = Math.hypot(q[0] - towns[t]!.p[0], q[1] - towns[t]!.p[1]) + off[t]!
          if (d < bd) { bd = d; bi = t }
        }
        if (bi !== rd.ia && bi !== rd.ib) F++
      }
      F /= s.dense.length
    }
    // 나루는 배 자리를 지나야 하고, 길은 그림 밖으로 나가지 않는다
    const fr = ferry[i]
    const Fy = (fr !== null && fr !== undefined && distTo(fr, s.curve) > gap ? 1 : 0) + (s.curve.some(([x, y]) => x < 0 || y < 0 || x > W || y > H) ? 1 : 0)
    let D = 0
    for (let k = 0; k < s.ref.length; k++) D += Math.hypot(s.ref[k]![0] - ref[i]![k]![0], s.ref[k]![1] - ref[i]![k]![1])
    D /= s.ref.length * L
    return { X, T, Fy, F, N: near / s.dense.length, D }
  }
  const cost = (i: number, s: Shape): number => {
    const c = parts(i, s)
    return 1000 * c.X + 300 * c.T + 200 * c.Fy + 40 * c.F + 40 * c.N + 10 * c.D
  }
  // 꼬인 길만 다른 모양을 대어 본다 — 멀쩡한 길은 물길 그대로
  const tangled = (i: number): boolean => {
    const c = parts(i, cur[i]!)
    return c.X > 0 || c.T > 0 || c.Fy > 0 || c.F > 0.04 || c.N > 0.25
  }
  const cand: Array<Shape[] | undefined> = roads.map(() => undefined)
  for (let pass = 0; pass < 8; pass++) {
    let moved = false
    for (let i = 0; i < roads.length; i++) {
      if (!tangled(i)) continue
      const cs = cand[i] ?? (cand[i] = candidates(roads[i]!).map(shapeOf))
      let best = cost(i, cur[i]!)
      let pick: Shape | null = null
      for (const s of cs) {
        const c = cost(i, s)
        if (c < best - 1e-6) { best = c; pick = s }
      }
      if (pick !== null) { put(i, false); cur[i] = pick; put(i, true); moved = true }
    }
    if (!moved) break
  }
  const res = new Map(roads.map((rd, i) => [rd.ed.id, cur[i]!.pts] as const))
  layCache.set(key, res)
  return res
}

/** 판의 고을(id 순) — 땅 가르기·길 펴기가 같은 차례를 쓴다 */
export function boardTowns(r: Realm): { nodes: Realm['nodes'][string][]; towns: Town[] } {
  const region = r.region ?? 'byeonhan-mini'
  const { w: W, h: H } = REGION_ART[region]
  const nodes = Object.values(r.nodes).sort((x, y) => (x.id < y.id ? -1 : 1))
  const towns = nodes.map((n) => {
    const p = nodePos(region, n.id) ?? [0.5, 0.5]
    return { id: n.id, p: [p[0] * W, p[1] * H] as const, size: CELL_SIZE[n.kind] }
  })
  return { nodes, towns }
}

/** 판의 길 모양 — 지도(mapview)가 그리는 그대로 */
export function boardRoutes(r: Realm): Map<string, Pt[]> {
  const region = r.region ?? 'byeonhan-mini'
  const { w: W, h: H } = REGION_ART[region]
  const edges = Object.values(r.edges)
  const { towns } = boardTowns(r)
  return layRoads(`${region}:${W}x${H}:${edges.length}`, region, edges, towns, W, H)
}

/**
 * 판의 고을(id 순)과 그 땅 — 산·강·뭍을 따라 가르고, 길 둘레는 두 끝 고을 땅으로 묶는다 (territory.ts).
 * 고을 자리는 안 바뀌니 판마다 한 번만 셈한다. `roads: false` 는 길을 안 묶은 옛 땅 (tools/realm-tangle.ts 의 견줌).
 */
export function boardTerritory(r: Realm, roads = true): { nodes: Realm['nodes'][string][]; t: Territory } {
  const region = r.region ?? 'byeonhan-mini'
  const { w: W, h: H } = REGION_ART[region]
  const { nodes, towns } = boardTowns(r)
  const nat = naturalLines(region, W, H)
  const seeds = towns.map((t) => ({ x: t.p[0], y: t.p[1], size: t.size }))
  const at = new Map(towns.map((t, i) => [t.id, i] as const))
  let lock: Array<{ a: number; b: number; pts: Pt[] }> | undefined
  if (roads) {
    const rt = boardRoutes(r)
    lock = Object.values(r.edges).filter((ed) => ed.kind !== 'sea' && at.has(ed.a) && at.has(ed.b)).sort((x, y) => (x.id < y.id ? -1 : 1))
      .map((ed) => ({ a: at.get(ed.a)!, b: at.get(ed.b)!, pts: curvePts(rt.get(ed.id)!, 8) }))
  }
  const key = `${region}:${W}x${H}:${nodes.length}${roads ? ':roads' : ''}`
  return { nodes, t: territory(key, W, H, terrReach(region, nat.land === null), { seeds, ...nat, ...(lock !== undefined ? { roads: lock } : {}) }) }
}
