/**
 * 먼 곳으로 — 군대에 갈 곳(Army.goal)을 두면 닿을 때까지 계절마다 한 걸음씩 저절로 간다
 * (형 10-25: "군대들 먼 곳으로도 이동시킬 수 있어야 하는 거 아님? 매번 옆 고을을 선택해 줘야 하는 게 귀찮어").
 *
 *  - 지나는 고을은 우리 땅 · 친한 나라(화친·동맹) 땅 · 주인 없는 땅만 — 적 땅을 지나며 싸우지 않는다. 소도는 지나지 않는다.
 *  - 마지막 고을은 어디든 — 적 고을이면 거기 닿는 걸음이 곧 출정이다.
 *  - 길은 길 계절이 가장 짧은 것 (막힌 길은 더 걸리는 만큼). 같으면 고을 id 순 — 결정론 (A1).
 *  - 길이 끊기면(지날 땅을 잃었다) 갈 곳을 지운다. 그 계절에 이 군대에 다른 명령이 있으면 그 명령이 먼저다.
 */
import { friendly } from './diplomacy.ts'
import { blockedWhy, seasonOf } from './calendar.ts'
import { marchSeasons } from './season.ts'
import { P } from '../tune/params.ts'
import type { Order, Realm } from './types.ts'

/** 닿을 수 있는 곳마다 — 걸리는 계절 · 첫 걸음의 길 · 걸음 수 */
export interface Reach {
  readonly seasons: number
  readonly edge: string
  readonly hops: number
}

/** `from` 에서 갈 수 있는 모든 고을 (from 자신은 빼고) */
export function goalReach(r: Realm, faction: string, from: string): Map<string, Reach> {
  const season = seasonOf(r.season)
  const through = (id: string): boolean => {
    const n = r.nodes[id]
    if (n === undefined || n.kind === 'sodo') return false
    return n.owner === null || n.owner === faction || friendly(r, faction, n.owner)
  }
  const adj = new Map<string, Array<{ to: string; edge: string; w: number }>>()
  for (const e of Object.values(r.edges)) {
    const w = marchSeasons(e.kind, season) + (blockedWhy(e, season) !== null ? P.realm.hardExtra : 0)
    ;(adj.get(e.a) ?? adj.set(e.a, []).get(e.a)!).push({ to: e.b, edge: e.id, w })
    ;(adj.get(e.b) ?? adj.set(e.b, []).get(e.b)!).push({ to: e.a, edge: e.id, w })
  }
  for (const xs of adj.values()) xs.sort((x, y) => (x.to < y.to ? -1 : x.to > y.to ? 1 : x.edge < y.edge ? -1 : 1))
  // 지나갈 수 있는 땅 위의 가장 짧은 길 (다익스트라 — 고을 수가 작아 줄 세우기로 충분하다)
  const best = new Map<string, Reach>()
  const done = new Set<string>([from])
  const open: Array<{ id: string; r: Reach }> = []
  const relax = (at: string, base: Reach | null): void => {
    for (const x of adj.get(at) ?? []) {
      if (x.to === from) continue
      const cand: Reach = { seasons: (base?.seasons ?? 0) + x.w, edge: base?.edge ?? x.edge, hops: (base?.hops ?? 0) + 1 }
      const old = best.get(x.to)
      if (old !== undefined && (old.seasons < cand.seasons || (old.seasons === cand.seasons && old.hops <= cand.hops))) continue
      best.set(x.to, cand)
      // 끝 고을은 어디든 되지만, 그 너머로는 지나갈 수 있는 땅만 이어 간다
      if (through(x.to) && !done.has(x.to)) open.push({ id: x.to, r: cand })
    }
  }
  relax(from, null)
  while (open.length > 0) {
    open.sort((x, y) => x.r.seasons - y.r.seasons || x.r.hops - y.r.hops || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
    const cur = open.shift()!
    if (done.has(cur.id) || best.get(cur.id) !== cur.r) continue
    done.add(cur.id)
    relax(cur.id, cur.r)
  }
  return best
}

/** 갈 곳까지의 걸음들 — [떠나는 고을, 닿는 고을] (지도에 길 전체를 화살로) · 닿지 못하면 빈 줄 */
export function goalRoute(r: Realm, faction: string, from: string, goal: string): Array<readonly [string, string]> {
  const out: Array<readonly [string, string]> = []
  let at = from
  for (let i = 0; i < Object.keys(r.nodes).length && at !== goal; i++) {
    const step = goalReach(r, faction, at).get(goal)
    const e = step !== undefined ? r.edges[step.edge] : undefined
    if (e === undefined) return []
    const to = e.a === at ? e.b : e.a
    out.push([at, to])
    at = to
  }
  return at === goal ? out : []
}

/** 이 계절 군대에 걸린 플레이어의 명령이 있나 — 있으면 저절로 가는 걸음은 쉰다 */
function ordered(orders: readonly Order[], army: string): boolean {
  return orders.some((o) =>
    ((o.kind === 'march' || o.kind === 'assault' || o.kind === 'split' || o.kind === 'disband') && o.army === army)
    || (o.kind === 'merge' && (o.army === army || o.into === army)))
}

/**
 * 계절 처음 — 갈 곳 명령을 싣고(goal), 갈 곳이 있는 군대의 이번 걸음을 명령으로 낸다.
 * 갈 곳 없이 직접 보낸 군대는 갈 곳을 지운다(마음을 바꿨다). 닿았거나 길이 끊긴 군대도 지운다.
 */
export function goalSteps(r: Realm, orders: readonly Order[]): Order[] {
  const set = new Set<string>()
  for (const o of orders) {
    if (o.kind !== 'goal') continue
    const a = r.armies[o.army]
    if (a === undefined) continue
    set.add(a.id)
    if (o.node === null || o.node === a.at || r.nodes[o.node] === undefined) delete a.goal
    else a.goal = o.node
  }
  const out: Order[] = []
  for (const a of Object.values(r.armies).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (a.goal === undefined) continue
    if (a.goal === a.at) { delete a.goal; continue }
    if (ordered(orders, a.id)) {
      // 이번 계절 직접 보냈다 — 갈 곳 명령을 같이 냈으면(첫 걸음) 그대로, 아니면 마음을 바꾼 것
      if (!set.has(a.id)) delete a.goal
      continue
    }
    if (a.march !== null) continue
    const step = goalReach(r, a.faction, a.at).get(a.goal)
    if (step === undefined) { delete a.goal; continue }
    out.push({ kind: 'march', army: a.id, edge: step.edge, ambush: false })
  }
  return out
}
