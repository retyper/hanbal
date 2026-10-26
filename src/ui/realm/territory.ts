/**
 * 고을마다의 땅 — 산과 강을 따라 갈린다 (형: "모양이 안이쁨... 고대시대에는 산이나 강같은게 자연국경같은거로 되는거 아닌가?" — 2026-10-19).
 *
 * 판을 고른 눈금(긴 변 260칸쯤)으로 나누고, 고을들에서 한꺼번에 퍼져 나가는 가장 가까운 길(다익스트라)로 칸마다 주인 고을을 정한다.
 *   - 강 칸에 들어서면 큰 값을 더한다 → 두 고을의 땅이 강에서 맞닿는다 (강이 경계가 된다)
 *   - 산줄기 안은 걸음이 무겁다 → 경계가 능선 쪽으로 밀린다
 *   - 뭍이 있는 판은 바다 칸으로 못 건넌다 → 만 건너편까지 땅이 번지지 않는다
 *   - 고을마다 퍼질 수 있는 끝(큰 고을이 조금 멀리) — 빈 들·먼 바다로 끝없이 번지지 않게
 * 칸의 테두리를 이어 고을마다의 고리로 만들고, 이웃이 같은 구간마다 줄여(더글러스-포이커) 매끈하게(차이킨) 다듬는다.
 * 맞닿은 두 고을은 같은 구간을 똑같이 다듬어 쓰므로 땅빛과 금이 꼭 맞물린다. 판·고을 자리마다 한 번만 셈한다.
 *
 * 길은 제 두 고을의 땅으로 미리 묶는다 (형 10-27: "국경이랑 길이 … 서로 꼬이지 않게") — 길 둘레 몇 칸을 가운데 금까지는 앞 고을,
 * 그 너머는 뒤 고을 땅으로 정해 두고 퍼지기 시작한다. 그래서 길은 남의 고을 땅을 지나지 않고, 두 고을 사이 금을 한 번만 건넌다.
 * 가운데 금은 두 끝에서 같은 걸음(산·강 값까지 셈한)이 되는 자리 — 길이 강을 건너면 대개 그 강에서 갈린다.
 */
import { P as TUNE } from '../../tune/params.ts'
import { segCross, type Pt } from './mapgeo.ts'

export interface TerritoryIn {
  /** 고을 자리(그림 좌표) · 크기 배수 */
  readonly seeds: ReadonlyArray<{ readonly x: number; readonly y: number; readonly size: number }>
  /** 강 (그림 좌표 꺾은선) */
  readonly rivers: readonly (readonly Pt[])[]
  /** 산줄기 네모 [x0, y0, x1, y1] (그림 좌표) */
  readonly rough: readonly (readonly [number, number, number, number])[]
  /** 뭍 다각형들 (그림 좌표) — 없으면 온 판이 뭍 */
  readonly land: readonly (readonly Pt[])[] | null
  /** 두 끝 고을(seeds 번호)을 잇는 길 — 그려지는 곡선 위의 촘촘한 점들. 뱃길은 넣지 않는다 (바다는 땅이 아니다) */
  readonly roads?: ReadonlyArray<{ readonly a: number; readonly b: number; readonly pts: readonly Pt[] }>
}

export interface Territory {
  /** 고을마다 땅빛을 칠할 패스 ('' = 땅이 없다) */
  readonly fills: readonly string[]
  /** 금 — i 와 j 사이(j = -1 이면 바깥: 바다·빈 땅). i < j 만 한 번씩 */
  readonly edges: ReadonlyArray<{ readonly i: number; readonly j: number; readonly d: string }>
  /** 고을마다의 칸 수 — 시험용 */
  readonly cells: readonly number[]
}

/** 강을 건너는 값 · 산 속 걸음의 배수 — R(퍼지는 끝)에 대한 몫. 화면의 생김새라 params 가 아니라 여기 */
const RIVER_COST = 0.55
const ROUGH_MUL = 1.9

const cache = new Map<string, Territory>()

export function territory(key: string, W: number, H: number, R: number, inp: TerritoryIn): Territory {
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  // 칸 크기 — 고을 땅 하나의 반지름이 열두 칸 남짓 (판 크기가 아니라 고을 크기에 맞춘다 — 세로로 긴 판은 고을이 빽빽해 칸이 크면 계단이 진다)
  const cs = R / 10
  const cols = Math.ceil(W / cs)
  const rows = Math.ceil(H / cs)
  const N = cols * rows
  const idx = (x: number, y: number): number => y * cols + x

  // 뭍 — 줄마다 다각형 변과의 교점으로 칸을 칠한다 (짝홀 · 조각마다 따로 · 합집합)
  const land = new Uint8Array(N)
  if (inp.land === null) land.fill(1)
  else {
    // 다각형마다 위아래 끝 — 그 줄에 안 걸치는 다각형은 건너뛴다 (섬이 수백 개다)
    const spans = inp.land.map((poly) => {
      let lo = Infinity
      let hi = -Infinity
      for (const q of poly) { lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]) }
      return [lo, hi] as const
    })
    for (let y = 0; y < rows; y++) {
      const py = (y + 0.5) * cs
      for (const [pi, poly] of inp.land.entries()) {
        if (py < spans[pi]![0] || py > spans[pi]![1]) continue
        const xs: number[] = []
        for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
          const [x1, y1] = poly[a]!
          const [x2, y2] = poly[b]!
          if (y1 > py !== y2 > py) xs.push(x1 + ((py - y1) * (x2 - x1)) / (y2 - y1))
        }
        xs.sort((p, q) => p - q)
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const x0 = Math.max(0, Math.ceil(xs[k]! / cs - 0.5))
          const x1 = Math.min(cols - 1, Math.floor(xs[k + 1]! / cs - 0.5))
          for (let x = x0; x <= x1; x++) land[idx(x, y)] = 1
        }
      }
    }
  }
  // 강 — 꺾은선을 반 칸씩 밟아 칸과 그 이웃(대각으로 새지 않게)을 표시
  const river = new Uint8Array(N)
  for (const pl of inp.rivers) {
    for (let k = 1; k < pl.length; k++) {
      const [ax, ay] = pl[k - 1]!
      const [bx, by] = pl[k]!
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (cs * 0.5)))
      for (let s = 0; s <= n; s++) {
        const x = Math.floor((ax + ((bx - ax) * s) / n) / cs)
        const y = Math.floor((ay + ((by - ay) * s) / n) / cs)
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]] as const) {
          const xx = x + dx
          const yy = y + dy
          if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) river[idx(xx, yy)] = 1
        }
      }
    }
  }
  // 산 — 네모 안 칸. 가장자리에서 안쪽으로 갈수록 무거워진다 (네모의 곧은 변이 그대로 경계가 되지 않게)
  const rough = new Float32Array(N)
  const ramp = R * 0.45
  for (const [x0, y0, x1, y1] of inp.rough) {
    for (let y = Math.max(0, Math.floor(y0 / cs)); y <= Math.min(rows - 1, Math.floor(y1 / cs)); y++) {
      for (let x = Math.max(0, Math.floor(x0 / cs)); x <= Math.min(cols - 1, Math.floor(x1 / cs)); x++) {
        const px = (x + 0.5) * cs
        const py = (y + 0.5) * cs
        const w = Math.min(1, Math.max(0, Math.min(px - x0, x1 - px, py - y0, y1 - py)) / ramp)
        const c = idx(x, y)
        rough[c] = Math.max(rough[c]!, w)
      }
    }
  }

  // 여럿에서 한꺼번에 퍼지는 가장 가까운 길 — 이진 더미
  const dist = new Float32Array(N).fill(Infinity)
  const owner = new Int16Array(N).fill(-1)
  const reach = inp.seeds.map((s) => R * (0.85 + 0.25 * s.size))
  const heap: number[] = [] // 칸 번호 — 값은 dist
  const push = (c: number): void => {
    heap.push(c)
    let i = heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (dist[heap[p]!]! <= dist[c]!) break
      heap[i] = heap[p]!
      i = p
    }
    heap[i] = c
  }
  const pop = (): number => {
    const top = heap[0]!
    const last = heap.pop()!
    if (heap.length > 0) {
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        if (l >= heap.length) break
        const rr = l + 1
        const m = rr < heap.length && dist[heap[rr]!]! < dist[heap[l]!]! ? rr : l
        if (dist[heap[m]!]! >= dist[last]!) break
        heap[i] = heap[m]!
        i = m
      }
      heap[i] = last
    }
    return top
  }
  inp.seeds.forEach((s, i) => {
    const x = Math.min(cols - 1, Math.max(0, Math.floor(s.x / cs)))
    const y = Math.min(rows - 1, Math.max(0, Math.floor(s.y / cs)))
    const c = idx(x, y)
    // 큰 고을이 조금 앞에서 출발한다 (거듭제곱 보로노이와 같은 뜻) — 겹치면 먼저 놓인 쪽
    const d0 = -R * 0.3 * (s.size - 1)
    if (d0 < dist[c]!) {
      dist[c] = d0
      owner[c] = i
      land[c] = 1 // 바닷가 고을이 칸 반올림으로 바다에 떨어져도 제 칸은 뭍
      push(c)
    }
  })
  // 길 둘레를 두 끝 고을 땅으로 묶는다 — 묶인 칸은 남이 못 가져간다
  const locked = new Uint8Array(N)
  if (inp.roads !== undefined && inp.roads.length > 0) {
    const rad = cs * TUNE.realm.roadCorridor
    const ri = Math.ceil(rad / cs)
    // 남의 고을 자리 둘레는 묶지 않는다 — 길이 남의 고을 곁을 스쳐도 그 고을 땅은 제 자리에서 난다
    const near = new Int16Array(N).fill(-1)
    const nearD = new Float32Array(N).fill(Infinity)
    const keep = rad * 1.5
    const ki = Math.ceil(keep / cs)
    inp.seeds.forEach((s, i) => {
      const sx = Math.floor(s.x / cs)
      const sy = Math.floor(s.y / cs)
      for (let y = Math.max(0, sy - ki); y <= Math.min(rows - 1, sy + ki); y++) {
        for (let x = Math.max(0, sx - ki); x <= Math.min(cols - 1, sx + ki); x++) {
          const d = Math.hypot((x + 0.5) * cs - s.x, (y + 0.5) * cs - s.y)
          const c = idx(x, y)
          if (d <= keep && d < nearD[c]!) { nearD[c] = d; near[c] = i }
        }
      }
    })
    const lockD = new Float32Array(N).fill(Infinity)
    const lockO = new Int16Array(N).fill(-1)
    const lockS = new Float32Array(N)
    const cellOf = (q: Pt): number => idx(Math.min(cols - 1, Math.max(0, Math.floor(q[0] / cs))), Math.min(rows - 1, Math.max(0, Math.floor(q[1] / cs))))
    for (const rd of inp.roads) {
      // 반 칸씩 다시 찍고, 걸음 값(산 속은 무겁고 강을 건너면 더한다)을 쌓는다
      const q: Pt[] = [rd.pts[0]!]
      for (let k = 1; k < rd.pts.length; k++) {
        const [ax, ay] = rd.pts[k - 1]!
        const [bx, by] = rd.pts[k]!
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (cs * 0.5)))
        for (let s = 1; s <= n; s++) q.push([ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n])
      }
      const cum: number[] = [0]
      for (let k = 1; k < q.length; k++) {
        const c = cellOf(q[k]!)
        let step = Math.hypot(q[k]![0] - q[k - 1]![0], q[k]![1] - q[k - 1]![1]) * (1 + (ROUGH_MUL - 1) * rough[c]!)
        if (river[c] === 1 && river[cellOf(q[k - 1]!)] === 0) step += R * RIVER_COST
        cum.push(cum[k - 1]! + step)
      }
      const total = cum[cum.length - 1]!
      const offA = -R * 0.3 * (inp.seeds[rd.a]!.size - 1)
      const offB = -R * 0.3 * (inp.seeds[rd.b]!.size - 1)
      // 두 끝에서 같은 걸음이 되는 자리 — 너무 한쪽으로 쏠리지 않게
      const split = Math.min(total * 0.8, Math.max(total * 0.2, (total + offB - offA) / 2))
      for (let k = 0; k < q.length; k++) {
        const [px, py] = q[k]!
        const toA = cum[k]! <= split
        const o = toA ? rd.a : rd.b
        const s0 = toA ? offA + cum[k]! : offB + total - cum[k]!
        const cx = Math.floor(px / cs)
        const cy = Math.floor(py / cs)
        for (let y = Math.max(0, cy - ri); y <= Math.min(rows - 1, cy + ri); y++) {
          for (let x = Math.max(0, cx - ri); x <= Math.min(cols - 1, cx + ri); x++) {
            const c = idx(x, y)
            if (land[c] === 0) continue
            if (near[c]! >= 0 && near[c] !== rd.a && near[c] !== rd.b) continue
            const d = Math.hypot((x + 0.5) * cs - px, (y + 0.5) * cs - py)
            if (d > rad || d >= lockD[c]!) continue
            lockD[c] = d
            lockO[c] = o
            // 먼 길은 퍼지는 끝에 걸려 가는 띠만 남지 않게, 묶인 칸의 걸음을 끝의 몫까지만 센다
            lockS[c] = Math.min(s0, reach[o]! * TUNE.realm.roadCorridorReach)
          }
        }
      }
    }
    const seedCell = new Set(inp.seeds.map((s) => cellOf([s.x, s.y])))
    for (let c = 0; c < N; c++) {
      const o = lockO[c]!
      if (o < 0 || seedCell.has(c)) continue // 고을 자리 칸은 그 고을 것
      locked[c] = 1
      dist[c] = lockS[c]!
      owner[c] = o
      push(c)
    }
  }
  // 열여섯 방향 — 여덟 방향만 쓰면 거리가 팔각형이 되어 두 고을의 경계가 가로·세로·대각 곧은 금으로 나온다
  const S5 = Math.sqrt(5)
  const D8: ReadonlyArray<readonly [number, number, number]> = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
    [2, 1, S5], [2, -1, S5], [-2, 1, S5], [-2, -1, S5], [1, 2, S5], [1, -2, S5], [-1, 2, S5], [-1, -2, S5],
  ]
  const done = new Uint8Array(N)
  while (heap.length > 0) {
    const c = pop()
    if (done[c] === 1) continue
    done[c] = 1
    const o = owner[c]!
    const cx = c % cols
    const cy = (c - cx) / cols
    for (const [dx, dy, len] of D8) {
      const x = cx + dx
      const y = cy + dy
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue
      const n = idx(x, y)
      if (done[n] === 1 || land[n] === 0 || locked[n] === 1) continue
      // 말 뜀(2칸)은 건너뛰는 칸도 본다 — 강·바다를 뛰어넘지 않게
      const mid = len > 2 ? idx(cx + Math.trunc(dx / 2), cy + Math.trunc(dy / 2)) : n
      if (land[mid] === 0) continue
      let step = len * cs * (1 + (ROUGH_MUL - 1) * rough[n]!)
      if ((river[n] === 1 || river[mid] === 1) && river[c] === 0) step += R * RIVER_COST
      const nd = dist[c]! + step
      if (nd > reach[o]! || nd >= dist[n]!) continue
      dist[n] = nd
      owner[n] = o
      push(n)
    }
  }

  // 칸 테두리 → 고을마다 시계 방향 고리. 변마다 건너편 주인(없으면 -1)
  const V = cols + 1
  const vid = (x: number, y: number): number => y * V + x
  const own = (x: number, y: number): number => (x < 0 || y < 0 || x >= cols || y >= rows ? -1 : owner[idx(x, y)]!)
  type E = { from: number; to: number; tag: number; used: boolean }
  const byNode: Array<Map<number, E[]>> = inp.seeds.map(() => new Map())
  const cellCount = inp.seeds.map(() => 0)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const o = owner[idx(x, y)]!
      if (o < 0) continue
      cellCount[o]!++
      const add = (from: number, to: number, tag: number): void => {
        const m = byNode[o]!
        const e: E = { from, to, tag, used: false }
        const list = m.get(from)
        if (list === undefined) m.set(from, [e])
        else list.push(e)
      }
      const t = own(x, y - 1)
      if (t !== o) add(vid(x, y), vid(x + 1, y), t)
      const rgt = own(x + 1, y)
      if (rgt !== o) add(vid(x + 1, y), vid(x + 1, y + 1), rgt)
      const b = own(x, y + 1)
      if (b !== o) add(vid(x + 1, y + 1), vid(x, y + 1), b)
      const l = own(x - 1, y)
      if (l !== o) add(vid(x, y + 1), vid(x, y), l)
    }
  }
  const P = (v: number): [number, number] => [(v % V) * cs, Math.floor(v / V) * cs]

  // 이웃이 같은 구간 하나를 다듬는다 — 두 고을이 같은 구간을 같게 쓰도록 바른 방향(작은 꼭짓점 번호에서)으로 셈해 둔다
  type Run = { canon: Pt[]; closed: boolean; tol: number; pts: Pt[] }
  const runs = new Map<string, Run>()
  const smooth = (r: Run): Pt[] => chaikin(r.tol > 0 ? simplify(r.canon, r.tol, r.closed) : r.canon, TUNE.realm.borderSmooth, r.closed)
  /** 구간을 적어 두고 그 열쇠와 이 고을이 그은 쪽(뒤집혔나)을 돌려준다 */
  const runOf = (vs: number[], a: number, b: number, closed: boolean): { key: string; rev: boolean } => {
    let key: string
    let rev: boolean
    let canon: number[]
    if (closed) {
      // 고리 — 가장 작은 꼭짓점에서 시작해 정한 쪽으로
      let mi = 0
      for (let k = 1; k < vs.length; k++) if (vs[k]! < vs[mi]!) mi = k
      const rot = [...vs.slice(mi), ...vs.slice(0, mi)]
      rev = rot.length > 2 && rot[1]! > rot[rot.length - 1]!
      canon = rev ? [rot[0]!, ...rot.slice(1).reverse()] : rot
      key = `c:${Math.min(a, b)}:${Math.max(a, b)}:${canon[0]}:${canon[1]}`
    } else {
      rev = vs[0]! > vs[vs.length - 1]!
      canon = rev ? vs.slice().reverse() : vs
      key = `o:${Math.min(a, b)}:${Math.max(a, b)}:${canon[0]}:${canon[canon.length - 1]}:${canon.length}`
    }
    if (!runs.has(key)) runs.set(key, { canon: canon.map(P), closed, tol: cs * TUNE.realm.borderSimplify, pts: [] })
    return { key, rev }
  }
  /** 이 고을이 그은 쪽으로 돌려 놓은 다듬은 구간 */
  const ptsOf = (key: string, rev: boolean): Pt[] => {
    const r = runs.get(key)!
    if (!rev) return r.pts
    return r.closed ? [r.pts[0]!, ...r.pts.slice(1).reverse()] : r.pts.slice().reverse()
  }

  // 1) 고을마다 고리를 잇고 이웃이 바뀌는 자리에서 구간으로 자른다
  type Ring = Array<{ tag: number; key: string; rev: boolean; one: boolean }>
  const rings: Ring[][] = inp.seeds.map(() => [])
  for (let i = 0; i < inp.seeds.length; i++) {
    for (const [, list] of byNode[i]!) {
      for (const start of list) {
        if (start.used) continue
        // 고리 하나를 잇는다
        const loop: E[] = []
        let e: E | undefined = start
        while (e !== undefined && !e.used) {
          e.used = true
          loop.push(e)
          const next: E[] | undefined = byNode[i]!.get(e.to)
          e = next?.find((x) => !x.used)
        }
        if (loop.length < 3) continue
        // 이웃이 바뀌는 자리에서 자른다
        let s0 = loop.findIndex((x, k) => x.tag !== loop[(k + loop.length - 1) % loop.length]!.tag)
        const one = s0 === -1
        if (one) s0 = 0
        const rot = [...loop.slice(s0), ...loop.slice(0, s0)]
        const segs: Array<{ tag: number; vs: number[] }> = []
        for (const x of rot) {
          const last = segs[segs.length - 1]
          if (last !== undefined && last.tag === x.tag) last.vs.push(x.to)
          else segs.push({ tag: x.tag, vs: [x.from, x.to] })
        }
        rings[i]!.push(segs.map((s) => ({ tag: s.tag, one, ...runOf(one ? s.vs.slice(0, -1) : s.vs, i, s.tag, one) })))
      }
    }
  }
  // 2) 구간마다 줄이고 깎는다
  for (const r of runs.values()) r.pts = smooth(r)
  // 3) 줄이다가 금끼리 엇갈리게 된 구간은 덜 줄인다 (좁은 땅에서 이웃 금을 가로질러 버린다) — 칸 금 그대로면 안 엇갈린다
  const closedPts = (r: Run): Pt[] => (r.closed && r.pts.length > 0 ? [...r.pts, r.pts[0]!] : r.pts)
  for (let round = 0; round < 4; round++) {
    const list = [...runs.values()].filter((r) => r.tol > 0)
    if (list.length === 0) break
    const all = [...runs.values()]
    const box = all.map((r) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (const [x, y] of r.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
      return [x0, y0, x1, y1] as const
    })
    const bad = new Set<Run>()
    for (let a = 0; a < all.length; a++) {
      const pa = closedPts(all[a]!)
      // 한 구간 안에서 — 이웃하지 않은 마디끼리
      for (let s = 1; s < pa.length && !bad.has(all[a]!); s++) {
        for (let t = s + 2; t < pa.length; t++) {
          if (s === 1 && t === pa.length - 1 && all[a]!.closed) continue
          if (segCross(pa[s - 1]!, pa[s]!, pa[t - 1]!, pa[t]!) !== null) { bad.add(all[a]!); break }
        }
      }
      for (let b = a + 1; b < all.length; b++) {
        const A = box[a]!
        const B = box[b]!
        if (A[0] > B[2] || B[0] > A[2] || A[1] > B[3] || B[1] > A[3]) continue
        const pb = closedPts(all[b]!)
        let hit = false
        for (let s = 1; s < pa.length && !hit; s++) for (let t = 1; t < pb.length; t++) {
          if (segCross(pa[s - 1]!, pa[s]!, pb[t - 1]!, pb[t]!) !== null) { hit = true; break }
        }
        if (hit) { bad.add(all[a]!); bad.add(all[b]!) }
      }
    }
    if (bad.size === 0) break
    for (const r of bad) {
      r.tol = r.tol > cs * 0.3 ? r.tol * 0.5 : 0
      r.pts = smooth(r)
    }
  }

  // 4) 땅빛과 금
  const fills: string[] = []
  const edges: Array<{ i: number; j: number; d: string }> = []
  for (let i = 0; i < inp.seeds.length; i++) {
    let fill = ''
    for (const ring of rings[i]!) {
      let d = ''
      for (const run of ring) {
        const pts = ptsOf(run.key, run.rev)
        if (run.tag === -1 || i < run.tag) edges.push({ i, j: run.tag, d: path(pts, run.one) })
        d += d === '' ? `M${f1(pts[0]![0])} ${f1(pts[0]![1])}` : ''
        for (let k = 1; k < pts.length; k++) d += `L${f1(pts[k]![0])} ${f1(pts[k]![1])}`
      }
      fill += `${d}Z`
    }
    fills.push(fill)
  }
  const out: Territory = { fills, edges, cells: cellCount }
  cache.set(key, out)
  return out
}

const f1 = (v: number): string => v.toFixed(1)
const path = (p: readonly Pt[], closed: boolean): string =>
  p.length === 0 ? '' : `M${p.map((q) => `${f1(q[0])} ${f1(q[1])}`).join('L')}${closed ? 'Z' : ''}`

/** 더글러스-포이커 — 칸 계단을 걷어 낸다. 끝점은 둔다 */
function simplify(p: readonly Pt[], tol: number, closed: boolean): Pt[] {
  if (p.length <= 2) return p.slice()
  if (closed) {
    // 고리는 가장 먼 점에서 반으로 갈라 각각 줄인다
    let far = 1
    let best = -1
    for (let k = 1; k < p.length; k++) {
      const d = Math.hypot(p[k]![0] - p[0]![0], p[k]![1] - p[0]![1])
      if (d > best) { best = d; far = k }
    }
    const a = simplify(p.slice(0, far + 1), tol, false)
    const b = simplify([...p.slice(far), p[0]!], tol, false)
    return [...a, ...b.slice(1, -1)]
  }
  const keep = new Uint8Array(p.length)
  keep[0] = 1
  keep[p.length - 1] = 1
  const stack: Array<[number, number]> = [[0, p.length - 1]]
  while (stack.length > 0) {
    const [s, e] = stack.pop()!
    const [ax, ay] = p[s]!
    const [bx, by] = p[e]!
    const L = Math.hypot(bx - ax, by - ay) || 1
    let mi = -1
    let md = tol
    for (let k = s + 1; k < e; k++) {
      const d = Math.abs((bx - ax) * (ay - p[k]![1]) - (ax - p[k]![0]) * (by - ay)) / L
      if (d > md) { md = d; mi = k }
    }
    if (mi !== -1) {
      keep[mi] = 1
      stack.push([s, mi], [mi, e])
    }
  }
  return p.filter((_, k) => keep[k] === 1)
}

/** 차이킨 모서리 깎기 — 열린 꺾은선은 두 끝을 둔다 */
function chaikin(p: readonly Pt[], n: number, closed: boolean): Pt[] {
  let cur = p.slice()
  for (let it = 0; it < n; it++) {
    if (cur.length < 3) return cur
    const out: Pt[] = closed ? [] : [cur[0]!]
    const m = closed ? cur.length : cur.length - 1
    for (let k = 0; k < m; k++) {
      const a = cur[k]!
      const b = cur[(k + 1) % cur.length]!
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    if (!closed) {
      out.splice(1, 1) // 첫 변의 앞 점 대신 끝점을 둔다
      out.splice(out.length - 1, 1, cur[cur.length - 1]!)
    }
    cur = out
  }
  return cur
}
