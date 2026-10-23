/**
 * 개척단 — 문명의 개척자처럼 (형 10-23: "백성 배치는 지금 여전히 이해가 안 돼" → 개척단 말).
 *
 * 우리 고을에서 개척단을 꾸리면 그 고을 백성 몇 가구가 곡식·나무를 지고 떠난다 — 지도에 말 하나가 선다.
 * 군대처럼 길을 하나씩 골라 옮기고, 빈땅(아무도 안 쥐었거나 우리가 일구는 중인 땅)에 닿으면 그 자리에 마을이 선다.
 * 우리 땅은 지나갈 수 있고 남의 땅으로는 못 간다. 적 군대가 머무는 곳에 서면 흩어진다(사람을 잃는다).
 * 고을끼리 백성을 옮기는 일은 손에서 뺐다 — 붐비면 저절로 이웃으로 넘친다 (economy.autoFlows).
 *
 * AI 는 예전처럼 맞닿은 빈땅에 곧바로 보낸다 (settle 명령) — 판의 결정론은 이 모듈도 같은 길을 밟는다 (A1).
 */
import { P } from '../tune/params.ts'
import { goodOf, stockOf } from './economy.ts'
import { blockedWhy, seasonOf } from './calendar.ts'
import { marchSeasons } from './season.ts'
import type { Order, Party, Realm, ReportLine } from './types.ts'

/** 고을에서 꾸릴 수 있는 개척단의 가구 수 — 안 되면 0 (곡식·나무·가구·개척단 수) */
export function partySize(r: Realm, faction: string, from: string): number {
  const R = P.realm
  const a = r.nodes[from]
  if (a === undefined || a.owner !== faction || a.kind === 'sodo' || a.kind === 'wild') return 0
  if (Object.values(r.parties ?? {}).filter((p) => p.faction === faction).length >= R.partyMax) return 0
  const want = Math.floor(a.hh * R.partyShare)
  const grain = R.settleGrain > 0 ? Math.floor(stockOf(r, faction).grain / R.settleGrain) : Infinity
  const wood = R.settleWood > 0 ? Math.floor(goodOf(stockOf(r, faction), 'wood') / R.settleWood) : Infinity
  const n = Math.min(want, grain, wood)
  return n >= R.partyMin ? n : 0
}

/** 꾸리는 데 드는 것 — 가구 하나에 곡식·나무 (개척과 같은 셈) */
export function partyCost(n: number): { grain: number; wood: number } {
  return { grain: Math.ceil(n * P.realm.settleGrain), wood: Math.ceil(n * P.realm.settleWood) }
}

/** 마을을 열 수 있는 땅인가 — 빈땅이고, 아무도 안 쥐었거나 제 땅이며 품이 남았다 */
export function foundable(r: Realm, faction: string, node: string): boolean {
  const n = r.nodes[node]
  return n !== undefined && n.kind === 'wild' && (n.owner === null || n.owner === faction) && (n.room ?? 0) - n.hh > 0
}

/** 적 군대가 머문다 — 개척단이 서면 흩어진다 */
function hostileHere(r: Realm, faction: string, node: string): boolean {
  return Object.values(r.armies).some((x) => x.at === node && x.march === null && x.faction !== faction)
}

/** `at` 에서 개척단이 이번 계절 갈 수 있는 곳 — 길 하나씩. found 면 닿자마자 마을이 선다 */
export function partyMoves(r: Realm, faction: string, at: string): Array<{ edge: string; to: string; seasons: number; found: boolean }> {
  const season = seasonOf(r.season)
  const out: Array<{ edge: string; to: string; seasons: number; found: boolean }> = []
  for (const id of Object.keys(r.edges).sort()) {
    const ed = r.edges[id]!
    const to = ed.a === at ? ed.b : ed.b === at ? ed.a : null
    if (to === null || blockedWhy(ed, season) !== null || hostileHere(r, faction, to)) continue
    const n = r.nodes[to]
    if (n === undefined || n.kind === 'sodo') continue
    const found = foundable(r, faction, to)
    if (!found && n.owner !== faction) continue
    out.push({ edge: ed.id, to, seasons: marchSeasons(ed.kind, season), found })
  }
  return out
}

function startMarch(r: Realm, p: Party, edge: string): void {
  const m = partyMoves(r, p.faction, p.at).find((x) => x.edge === edge)
  if (m === undefined) return
  p.march = { from: p.at, to: m.to, edge, left: m.seasons }
}

/** 꾸리기 — 고을의 백성을 떼어 개척단을 세운다. 길을 함께 골랐으면 바로 떠난다 */
export function formParty(r: Realm, o: Extract<Order, { kind: 'party' }>, lines: ReportLine[]): void {
  if (r.factions[o.faction] === undefined) return
  const n = partySize(r, o.faction, o.node)
  if (n <= 0) return
  const c = partyCost(n)
  const node = r.nodes[o.node]!
  node.hh -= n
  const st = stockOf(r, o.faction)
  st.grain -= c.grain
  st.wood = goodOf(st, 'wood') - c.wood
  const ps = (r.parties ??= {})
  let id = `party-${r.season}-${o.node}`
  for (let k = 2; ps[id] !== undefined; k++) id = `party-${r.season}-${o.node}-${k}`
  const p: Party = { id, faction: o.faction, home: o.node, at: o.node, hh: n, march: null }
  ps[id] = p
  if (o.edge !== undefined) startMarch(r, p, o.edge)
  lines.push({ kind: 'party', faction: o.faction, party: id, node: o.node, n })
}

/** 개척단을 길 하나로 보낸다 — 멈춰 선 개척단만 */
export function moveParty(r: Realm, o: Extract<Order, { kind: 'partyGo' }>): void {
  const p = r.parties?.[o.party]
  if (p === undefined || p.march !== null) return
  startMarch(r, p, o.edge)
}

/** 계절마다 — 길 위의 개척단이 한 계절 간다. 빈땅에 닿으면 마을이 서고, 적 군대 곁이면 흩어진다 */
export function stepParties(r: Realm, lines: ReportLine[]): void {
  const ps = r.parties
  if (ps === undefined) return
  for (const id of Object.keys(ps).sort()) {
    const p = ps[id]!
    if (p.march !== null) {
      p.march.left -= 1
      if (p.march.left > 0) continue
      p.at = p.march.to
      p.march = null
    }
    if (hostileHere(r, p.faction, p.at) || (r.nodes[p.at]?.owner !== null && r.nodes[p.at]?.owner !== p.faction)) {
      lines.push({ kind: 'partyLost', faction: p.faction, party: id, node: p.at, n: p.hh })
      delete ps[id]
      continue
    }
    if (foundable(r, p.faction, p.at)) {
      const n = r.nodes[p.at]!
      n.hh += p.hh
      n.owner = p.faction
      lines.push({ kind: 'settle', faction: p.faction, from: p.home, to: p.at, n: p.hh })
      delete ps[id]
    }
  }
}

/** 지금 지도에 선 개척단 — id 순서 */
export function partiesOf(r: Realm, faction: string): Party[] {
  return Object.values(r.parties ?? {}).filter((p) => p.faction === faction).sort((a, b) => (a.id < b.id ? -1 : 1))
}

