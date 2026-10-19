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
 */
import type { Pt } from './mapgeo.ts'

export interface TerritoryIn {
  /** 고을 자리(그림 좌표) · 크기 배수 */
  readonly seeds: ReadonlyArray<{ readonly x: number; readonly y: number; readonly size: number }>
  /** 강 (그림 좌표 꺾은선) */
  readonly rivers: readonly (readonly Pt[])[]
  /** 산줄기 네모 [x0, y0, x1, y1] (그림 좌표) */
  readonly rough: readonly (readonly [number, number, number, number])[]
  /** 뭍 다각형들 (그림 좌표) — 없으면 온 판이 뭍 */
  readonly land: readonly (readonly Pt[])[] | null
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
      if (done[n] === 1 || land[n] === 0) continue
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
  const runCache = new Map<string, Pt[]>()
  const smoothRun = (vs: number[], a: number, b: number, closed: boolean): Pt[] => {
    let key: string
    let rev = false
    if (closed) {
      // 고리 — 가장 작은 꼭짓점에서 시작해 정한 쪽으로
      let mi = 0
      for (let k = 1; k < vs.length; k++) if (vs[k]! < vs[mi]!) mi = k
      const rot = [...vs.slice(mi), ...vs.slice(0, mi)]
      rev = rot.length > 2 && rot[1]! > rot[rot.length - 1]!
      const canon = rev ? [rot[0]!, ...rot.slice(1).reverse()] : rot
      key = `c:${Math.min(a, b)}:${Math.max(a, b)}:${canon[0]}:${canon[1]}`
      const got = runCache.get(key)
      const pts = got ?? chaikin(simplify(canon.map(P), cs * 0.85, true), 1, true)
      if (got === undefined) runCache.set(key, pts)
      // 돌려 놓기 — 이 고을이 그은 쪽으로
      return rev ? [pts[0]!, ...pts.slice(1).reverse()] : pts
    }
    rev = vs[0]! > vs[vs.length - 1]!
    const canon = rev ? vs.slice().reverse() : vs
    key = `o:${Math.min(a, b)}:${Math.max(a, b)}:${canon[0]}:${canon[canon.length - 1]}:${canon.length}`
    let pts = runCache.get(key)
    if (pts === undefined) {
      pts = chaikin(simplify(canon.map(P), cs * 0.85, false), 1, false)
      runCache.set(key, pts)
    }
    return rev ? pts.slice().reverse() : pts
  }

  const fills: string[] = []
  const edges: Array<{ i: number; j: number; d: string }> = []
  for (let i = 0; i < inp.seeds.length; i++) {
    let fill = ''
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
        const runs: Array<{ tag: number; vs: number[] }> = []
        for (const x of rot) {
          const last = runs[runs.length - 1]
          if (last !== undefined && last.tag === x.tag) last.vs.push(x.to)
          else runs.push({ tag: x.tag, vs: [x.from, x.to] })
        }
        let d = ''
        for (const run of runs) {
          const pts = smoothRun(one ? run.vs.slice(0, -1) : run.vs, i, run.tag, one)
          if (run.tag === -1 || i < run.tag) edges.push({ i, j: run.tag, d: path(pts, one) })
          d += d === '' ? `M${f1(pts[0]![0])} ${f1(pts[0]![1])}` : ''
          for (let k = 1; k < pts.length; k++) d += `L${f1(pts[k]![0])} ${f1(pts[k]![1])}`
        }
        fill += `${d}Z`
      }
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
