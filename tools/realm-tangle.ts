/**
 * 길과 금이 꼬였나 재기 (형 10-27: "국경이랑 길이 조금 더 단순해도 좋으니까 서로 꼬이지 않게, 길도 꼬이지 않게 해 줘")
 *
 *   node --experimental-strip-types tools/realm-tangle.ts [--list]
 *
 * 판마다 — 옛 그림(서로 밀기만 한 물길 · 길을 안 묶은 땅 · 옛 금 다듬기)과 지금 그림(ui/realm/roadlayout.ts)을 견준다.
 *   길×길   고을 밖에서 두 길이 엇갈리는 자리 수 (같은 고을에서 갈라지는 길이 그 고을 그림 밑에서 닿는 것은 뺀다) — 목표 0
 *   스침    길이 두 끝이 아닌 고을 자리 바로 위(고을 그림 밑)를 지나는 수
 *   고을금  길(뱃길 빼고)이 두 끝 고을 사이 금 하나만 한 번 건너는 게 아닌 길 수 — 남의 고을 땅을 지나거나 금을 여러 번 넘나든다
 *   같은나라 같은 나라 두 고을을 잇는 길이 나라 금을 건너는 수 — 목표 0 (처음 판의 주인으로 잰다)
 *   남의나라 다른 나라를 잇는 길이 한 번 넘게 금을 건너는 군더더기 수 — 목표 0
 *   금×금   금끼리(다듬은 뒤) 엇갈리는 자리 수 — 다듬기가 금을 꼬지 않았나
 * --list 는 지금 그림에서 아직 꼬인 길을 낱낱이 적는다. --set realm.borderSimplify=1.3,… 은 params 를 바꿔 지금 그림을 다시 잰다.
 */
import { REGION_ART } from '../src/realm/data/art.ts'
import { regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import type { Realm, RegionId } from '../src/realm/types.ts'
import { P, setParam } from '../src/tune/params.ts'
import { curvePts, routePoints, segCross, separatedRoutes, type Pt } from '../src/ui/realm/mapgeo.ts'
import { boardRoutes, boardTerritory, boardTowns, crossCount, roadScale } from '../src/ui/realm/roadlayout.ts'
import type { Territory } from '../src/ui/realm/territory.ts'

const LIST = process.argv.includes('--list')
const SET = process.argv.includes('--set') ? process.argv[process.argv.indexOf('--set') + 1]!.split(',').map((kv) => kv.split('=') as [string, string]) : []
for (const [k, v] of SET) setParam(k, Number(v))
const ONLY = process.argv.includes('--region') ? process.argv[process.argv.indexOf('--region') + 1] : undefined
const REGIONS = (['yeongnam', 'byeonhan-mini', 'south', 'world', 'mahan', 'jumong', 'tutorial', 'seorabeol'] as RegionId[]).filter((x) => ONLY === undefined || x === ONLY)

/** 금 패스("M x yLx y…Z") → 꺾은선 */
function parse(d: string): Pt[] {
  const pts: Pt[] = []
  for (const m of d.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)) pts.push([Number(m[1]), Number(m[2])])
  if (d.trim().endsWith('Z') && pts.length > 0) pts.push(pts[0]!)
  return pts
}

/** p 가 q 를 건너는 수 (금끼리는 끝이 닿는 것은 segCross 가 뺀다) */
function crosses(p: readonly Pt[], q: readonly Pt[]): number {
  return crossCount(p, q, [], 0)
}

interface Score { rr: number; graze: number; town: number; same: number; foreign: number; bb: number; bad: string[] }

function measure(r: Realm, region: RegionId, routes: Map<string, Pt[]>, t: Territory): Score {
  const { towns, nodes } = boardTowns(r)
  const at = new Map(towns.map((x, i) => [x.id, i] as const))
  const { hub } = roadScale(region)
  const edges = Object.values(r.edges).sort((x, y) => (x.id < y.id ? -1 : 1))
  const curve = new Map(edges.map((ed) => [ed.id, curvePts(routes.get(ed.id)!, 8)] as const))
  const bad: string[] = []
  const name = (id: string): string => r.nodes[id]?.name ?? id
  const label = (ed: { a: string; b: string }): string => `${name(ed.a)}–${name(ed.b)}`
  // 길×길
  let rr = 0
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i]!
      const b = edges[j]!
      const shared = [a.a, a.b].filter((x) => x === b.a || x === b.b).map((x) => towns[at.get(x)!]!.p)
      const n = crossCount(curve.get(a.id)!, curve.get(b.id)!, shared, hub)
      if (n > 0) bad.push(`길×길 ${label(a)} ✕ ${label(b)} (${n})`)
      rr += n
    }
  }
  // 스침 — 고을 그림 밑(hub)을 지나는 남의 길
  let graze = 0
  for (const ed of edges) {
    const c = curve.get(ed.id)!
    for (const tw of towns) {
      if (tw.id === ed.a || tw.id === ed.b) continue
      let dmin = Infinity
      for (let k = 1; k < c.length; k++) {
        const [ax, ay] = c[k - 1]!
        const [bx, by] = c[k]!
        const dx = bx - ax
        const dy = by - ay
        const l2 = dx * dx + dy * dy
        const s = l2 > 0 ? Math.max(0, Math.min(1, ((tw.p[0] - ax) * dx + (tw.p[1] - ay) * dy) / l2)) : 0
        dmin = Math.min(dmin, Math.hypot(tw.p[0] - ax - dx * s, tw.p[1] - ay - dy * s))
      }
      if (dmin < hub) { graze++; bad.push(`스침 ${label(ed)} 이 ${name(tw.id)} 위로`) }
    }
  }
  // 금
  const lines = t.edges.map((e) => ({ i: e.i, j: e.j, p: parse(e.d) }))
  const ownerOf = (k: number): string | null => (k < 0 ? null : nodes[k]!.owner)
  let town = 0
  let same = 0
  let foreign = 0
  for (const ed of edges) {
    if (ed.kind === 'sea') continue
    const ia = at.get(ed.a)!
    const ib = at.get(ed.b)!
    const c = curve.get(ed.id)!
    let own = 0 // 두 끝 사이 금을 건넌 수
    let other = 0 // 다른 금(남의 고을 · 바깥)을 건넌 수
    let nat = 0
    for (const l of lines) {
      const n = crosses(c, l.p)
      if (n === 0) continue
      if ((l.i === ia && l.j === ib) || (l.i === ib && l.j === ia)) own += n
      else other += n
      const o1 = ownerOf(l.i)
      const o2 = ownerOf(l.j)
      if (o1 !== o2 && !(o1 === null && o2 === null)) nat += n
    }
    if (!(own === 1 && other === 0) && !(own === 0 && other === 0 && t.edges.every((e) => !((e.i === ia && e.j === ib) || (e.i === ib && e.j === ia))))) {
      town++
      bad.push(`고을금 ${label(ed)} — 제 금 ${own} · 다른 금 ${other}`)
    }
    const oa = nodes[ia]!.owner
    const ob = nodes[ib]!.owner
    if (oa !== null && oa === ob) {
      same += nat
      if (nat > 0) bad.push(`같은나라 ${label(ed)} — 나라 금 ${nat}번`)
    } else {
      foreign += Math.max(0, nat - 1)
      if (nat > 1) bad.push(`남의나라 ${label(ed)} — 나라 금 ${nat}번`)
    }
  }
  // 금×금
  let bb = 0
  const box = lines.map((l) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [x, y] of l.p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
    return [x0, y0, x1, y1] as const
  })
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = box[i]!
      const b = box[j]!
      if (a[0] > b[2] || b[0] > a[2] || a[1] > b[3] || b[1] > a[3]) continue
      bb += crosses(lines[i]!.p, lines[j]!.p)
    }
    // 한 금 안에서 — 이웃하지 않은 마디끼리
    const p = lines[i]!.p
    for (let a = 1; a < p.length; a++) for (let b = a + 2; b < p.length; b++) {
      if (a === 1 && b === p.length - 1 && p[0]![0] === p[p.length - 1]![0] && p[0]![1] === p[p.length - 1]![1]) continue
      if (segCross(p[a - 1]!, p[a]!, p[b - 1]!, p[b]!) !== null) bb++
    }
  }
  return { rr, graze, town, same, foreign, bb, bad }
}

const row = (s: Score): string => `길×길 ${String(s.rr).padStart(3)} · 스침 ${String(s.graze).padStart(2)} · 고을금 ${String(s.town).padStart(3)} · 같은나라 ${String(s.same).padStart(3)} · 남의나라 ${String(s.foreign).padStart(3)} · 금×금 ${String(s.bb).padStart(3)}`

for (const region of REGIONS) {
  const r = startRegion(region, 1, regionNations(region)[0]!)
  const RA = REGION_ART[region]
  const W = RA.w
  const H = RA.h
  // 옛 그림 — 서로 밀기만 한 물길 · 길을 안 묶은 땅 · 옛 금 다듬기(0.85칸 · 깎기 한 번)
  const { towns } = boardTowns(r)
  const pos = new Map(towns.map((t) => [t.id, t.p] as const))
  const edges = Object.values(r.edges).sort((x, y) => (x.id < y.id ? -1 : 1))
  const { gap, endR } = roadScale(region)
  const old = separatedRoutes(`${region}:old`, edges.map((ed) => [ed.id, routePoints(region, ed, pos.get(ed.a)!, pos.get(ed.b)!, W, H)] as const), gap, endR)
  const keep = [P.realm.borderSimplify, P.realm.borderSmooth] as const
  setParam('realm.borderSimplify', 0.85)
  setParam('realm.borderSmooth', 1)
  const t0 = performance.now()
  const oldT = boardTerritory(r, false).t
  const t1 = performance.now()
  const before = measure(r, region, old, oldT)
  setParam('realm.borderSimplify', keep[0])
  setParam('realm.borderSmooth', keep[1])
  const t2 = performance.now()
  const routes = boardRoutes(r)
  const t3 = performance.now()
  const newT = boardTerritory(r).t
  const t4 = performance.now()
  const after = measure(r, region, routes, newT)
  console.log(`${region} (고을 ${towns.length} · 길 ${edges.length})`)
  console.log(`  전  ${row(before)}`)
  console.log(`  후  ${row(after)}   [길 펴기 ${(t3 - t2).toFixed(0)}ms · 땅 ${(t4 - t3).toFixed(0)}ms (옛 땅 ${(t1 - t0).toFixed(0)}ms)]`)
  if (LIST) for (const b of after.bad) console.log(`     ${b}`)
}
