/**
 * 나라 살림 — 가호 · 곡식 · 철 · 징병 (docs/realm/FLOW.md §1·§2 · SYSTEMS §7-6 의 최소판)
 *
 * 한 해의 흐름이 숫자로 선다:
 *   봄   — 심는다. 봄이 끝날 때의 가호가 `sown` 이 된다 → 가을 수확을 정한다. 봄에 징병하면 그해 농사가 준다
 *   가을 — 거둔다. sown × harvestPerHH 가 국읍 창고로
 *   늘   — 군대는 곡식을 먹는다 (겨울 × winterRation). 바닥나면 사기가 떨어지고 가호가 준다
 *         곡식이 있고 싸움이 없던 고을은 가호가 조금씩 는다
 * 장정(군대 없는 고을을 지키는 사람)도 가호에 비례한다.
 * 개척 — 제 고을 사람을 맞닿은 빈땅으로 옮긴다 (settleLimit). 새 마을은 품(room)까지 settleGrow 로 빨리 큰다.
 *
 * 순수 함수만 — season.ts 가 부른다. 이 파일은 season.ts 를 부르지 않는다 (고리를 만들지 않는다).
 */
import { P } from '../tune/params.ts'
import { blockedWhy, seasonOf } from './calendar.ts'
import type { Order, ReportLine, Realm, Stock } from './types.ts'

function menIn(mix: Readonly<Partial<Record<string, number>>>): number {
  let n = 0
  for (const v of Object.values(mix)) n += v ?? 0
  return n
}

/** 한 나라의 군사 수 — 머무는 군대와 길 위의 군대 모두 */
export function menOf(r: Realm, faction: string): number {
  let n = 0
  for (const a of Object.values(r.armies)) if (a.faction === faction) n += menIn(a.mix)
  return n
}

/** 한 나라의 가호 합 */
export function hhOf(r: Realm, faction: string): number {
  let n = 0
  for (const node of Object.values(r.nodes)) if (node.owner === faction) n += node.hh
  return n
}

export function stockOf(r: Realm, faction: string): Stock {
  return (r.stock[faction] ??= { grain: 0, iron: 0 })
}

/** 장정 (SYSTEMS §4-6 · FLOW §2) — 그 고을 가호에 비례. 산성은 사람은 적어도 성이 높다 */
export function militiaMen(r: Realm, node: string): number {
  const R = P.realm
  const n = r.nodes[node]
  if (n === undefined || n.owner === null || n.kind === 'sodo') return 0
  // 매수당한 고을 — 장정이 서지 않는다 (plots.ts bribe)
  const bribed = r.watch[node]?.bribedUntil
  if (bribed !== undefined && bribed >= r.season) return 0
  // 그 나라의 국읍이면 다 나와 막는다 (판이 끝나는 자리)
  const capital = r.factions[n.owner]?.capital === n.id
  return Math.round(n.hh * R.militiaPerHH * (n.kind === 'fort' ? R.militiaFortMul : 1) * (capital ? R.militiaCapitalMul : 1))
}

export function draftCost(n: number): { grain: number } {
  return { grain: Math.ceil(n * P.realm.draftGrain) }
}

/**
 * 이 고을에서 이번 계절에 뽑을 수 있는 수 — 셋 가운데 작은 것:
 * 고을 가호의 draftPerSeason · 나라 상한(가호+군사의 draftCap)까지 남은 몫 · 창고가 대는 채비
 */
export function draftLimit(r: Realm, faction: string, node: string): number {
  const R = P.realm
  const n = r.nodes[node]
  if (n === undefined || n.owner !== faction || n.kind === 'sodo') return 0
  const per = Math.floor(n.hh * R.draftPerSeason)
  const men = menOf(r, faction)
  const cap = Math.floor(R.draftCap * (hhOf(r, faction) + men)) - men
  const grain = R.draftGrain > 0 ? Math.floor(stockOf(r, faction).grain / R.draftGrain) : Infinity
  return Math.max(0, Math.min(per, cap, grain))
}

export function settleCost(n: number): { grain: number } {
  return { grain: Math.ceil(n * P.realm.settleGrain) }
}

/** 이 길이 `from` 과 `to` 를 잇는가 — 이으면 그 길 */
function edgeBetween(r: Realm, from: string, to: string) {
  for (const id of Object.keys(r.edges).sort()) {
    const ed = r.edges[id]!
    if ((ed.a === from && ed.b === to) || (ed.a === to && ed.b === from)) return ed
  }
  return null
}

/**
 * 개척 (FLOW §2) — `from` 에서 빈땅 `to` 로 이번 계절에 보낼 수 있는 가호 수. 안 되면 0.
 * 셋 가운데 작은 것: from 가호의 settleShare · to 에 남은 품(room − hh) · 창고가 대는 곡식.
 * 길로 맞닿고 그 길이 이번 계절에 열려 있어야 하고, to 는 아무도 안 쥐었거나 제 땅이며 남의 군대가 머물지 않아야 한다.
 */
export function settleLimit(r: Realm, faction: string, from: string, to: string): number {
  const R = P.realm
  const a = r.nodes[from]
  const b = r.nodes[to]
  if (a === undefined || b === undefined || a.owner !== faction || a.kind === 'sodo') return 0
  if (b.kind !== 'wild' || (b.owner !== null && b.owner !== faction)) return 0
  const ed = edgeBetween(r, from, to)
  if (ed === null || blockedWhy(ed, seasonOf(r.season)) !== null) return 0
  if (Object.values(r.armies).some((x) => x.at === to && x.march === null && x.faction !== faction)) return 0
  const share = Math.floor(a.hh * R.settleShare)
  const room = Math.max(0, (b.room ?? 0) - b.hh)
  const grain = R.settleGrain > 0 ? Math.floor(stockOf(r, faction).grain / R.settleGrain) : Infinity
  return Math.max(0, Math.min(share, room, grain))
}

/** 지금 개척할 수 있는 짝 — 빈땅 id, 떠나는 고을 id 순서 (결정론) */
export function settleTargets(r: Realm, faction: string): Array<{ from: string; to: string; edge: string }> {
  const out: Array<{ from: string; to: string; edge: string }> = []
  for (const id of Object.keys(r.edges).sort()) {
    const ed = r.edges[id]!
    for (const [from, to] of [[ed.a, ed.b], [ed.b, ed.a]] as const) {
      if (settleLimit(r, faction, from, to) > 0) out.push({ from, to, edge: ed.id })
    }
  }
  return out.sort((x, y) => (x.to < y.to ? -1 : x.to > y.to ? 1 : x.from < y.from ? -1 : x.from > y.from ? 1 : 0))
}

export function riteCost(): { grain: number } {
  return { grain: P.realm.riteGrain }
}

/** 소도와 길로 맞닿은 고을 가운데 이 나라가 쥔 것 — id 순서 */
export function sodoNeighbors(r: Realm, faction: string): string[] {
  const out = new Set<string>()
  for (const ed of Object.values(r.edges)) {
    const a = r.nodes[ed.a]
    const b = r.nodes[ed.b]
    if (a?.kind === 'sodo' && b?.owner === faction) out.add(b.id)
    if (b?.kind === 'sodo' && a?.owner === faction) out.add(a.id)
  }
  return [...out].sort()
}

/**
 * 소도 제사 (「常以五月下種訖祭鬼神…十月農功畢亦復如之」) — 봄·가을에만, 소도와 길로 맞닿은 고을을 쥐고,
 * 곡식이 riteCost 이상이면. 봄 제사는 그해에 한 번만 (이미 지냈으면 안 된다).
 */
export function riteAllowed(r: Realm, faction: string): boolean {
  const season = seasonOf(r.season)
  if (season !== 'spring' && season !== 'autumn') return false
  if (r.factions[faction] === undefined || sodoNeighbors(r, faction).length === 0) return false
  if (season === 'spring' && r.blessed?.[faction] === Math.floor(r.season / 4)) return false
  return stockOf(r, faction).grain >= riteCost().grain
}

/** 2 — 제사: 나라마다 첫 명령 하나만. 봄은 그해 수확에 축복, 가을은 모든 군대 사기 + */
export function resolveRites(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const R = P.realm
  const done = new Set<string>()
  const season = seasonOf(r.season)
  for (const o of orders) {
    if (o.kind !== 'rite' || done.has(o.faction)) continue
    const f = o.faction
    if (!riteAllowed(r, f)) continue
    done.add(f)
    stockOf(r, f).grain -= riteCost().grain
    if (season === 'spring') (r.blessed ??= {})[f] = Math.floor(r.season / 4)
    else for (const a of Object.values(r.armies)) if (a.faction === f) a.morale = Math.min(R.moraleMax, a.morale + R.riteMorale)
    lines.push({ kind: 'rite', faction: f, season: season === 'spring' ? 'spring' : 'autumn' })
  }
}

/** 경계 강화 (형: "우리가 경계를 강화하거나" — 2026-10-18) — 곡식을 내고 그 고을의 경계를 올린다 */
export function guardCost(): { grain: number } {
  return { grain: P.realm.guardGrain }
}

/** 이 고을의 경계를 이번 계절에 강화할 수 있나 — 제 고을 · 이번 계절에 아직 안 함 · 곡식이 있다 */
export function canGuard(r: Realm, faction: string, node: string): boolean {
  const n = r.nodes[node]
  if (n === undefined || n.owner !== faction || n.kind === 'sodo') return false
  if (r.watch[node]?.guarded === r.season) return false
  return stockOf(r, faction).grain >= guardCost().grain
}

/** 1 — 경계 강화. 규칙에 안 맞으면 아무 일도 없다 */
export function applyGuard(r: Realm, o: Extract<Order, { kind: 'guard' }>, lines: ReportLine[]): void {
  if (!canGuard(r, o.faction, o.node)) return
  const w = (r.watch[o.node] ??= { alert: 0, lull: 0 })
  w.alert = Math.min(P.realm.alertMax, w.alert + P.realm.guardAlert)
  w.lull = 0 // 방심도 걷힌다
  w.guarded = r.season
  stockOf(r, o.faction).grain -= guardCost().grain
  lines.push({ kind: 'guard', faction: o.faction, node: o.node })
}

/** 이 계절에 나라가 군대를 먹이는 데 드는 곡식 */
export function upkeepOf(r: Realm, faction: string, winter: boolean): number {
  return Math.ceil(menOf(r, faction) * P.realm.rationPerSoldier * (winter ? P.realm.winterRation : 1))
}

/** 고을을 뺏겼다 — 사람이 흩어진다 */
export function onTake(r: Realm, node: string): void {
  const n = r.nodes[node]
  if (n === undefined) return
  const keep = 1 - P.realm.hhLossOnTake
  n.hh = Math.round(n.hh * keep)
  n.sown = Math.round(n.sown * keep)
}

/**
 * 7 — 생산 · 수확 · 소모 (SYSTEMS §12). `season` 은 0 봄 · 1 여름 · 2 가을 · 3 겨울.
 * `fought` 는 이번 계절에 싸움이 난 고을 — 그 고을의 가호는 늘지 않는다.
 */
export function stepEconomy(r: Realm, season: number, fought: ReadonlySet<string>, lines: ReportLine[]): void {
  const R = P.realm
  const winter = season === 3
  for (const f of Object.keys(r.factions).sort()) {
    const s = stockOf(r, f)
    const fac = r.factions[f]!
    const nodes = Object.values(r.nodes).filter((n) => n.owner === f).sort((x, y) => (x.id < y.id ? -1 : 1))
    // 철 — 철산 · 포구의 교역 · 바깥 교역
    for (const n of nodes) {
      if (n.kind === 'ironMine') s.iron += R.ironPerMine
      if (n.kind === 'port') s.iron += R.ironPerPort
    }
    if (fac.income !== undefined) {
      s.grain += fac.income.grain
      s.iron += fac.income.iron
    }
    // 가을 — 봄에 심은 만큼 거둔다
    if (season === 2) {
      let sown = 0
      for (const n of nodes) sown += n.sown
      const base = Math.round(sown * R.harvestPerHH)
      // 봄 제사를 지낸 해면 더 든다
      const blessed = r.blessed?.[f] === Math.floor(r.season / 4) ? Math.round(base * R.riteHarvest) : 0
      const grain = base + blessed
      if (grain > 0) {
        s.grain += grain
        lines.push(blessed > 0 ? { kind: 'harvest', faction: f, grain, blessed } : { kind: 'harvest', faction: f, grain })
      }
    }
    // 군량
    const need = upkeepOf(r, f, winter)
    let hungry = false
    if (s.grain >= need) s.grain -= need
    else {
      s.grain = 0
      hungry = need > 0
    }
    if (hungry) {
      lines.push({ kind: 'hunger', faction: f })
      for (const a of Object.values(r.armies)) {
        if (a.faction === f) a.morale = Math.max(R.moraleFloor, a.morale - R.hungerMorale)
      }
    }
    // 가호 — 굶으면 줄고, 먹고 싸움이 없으면 는다. 개척한 빈땅은 품(room)까지 빨리 큰다
    for (const n of nodes) {
      if (hungry) n.hh = Math.round(n.hh * (1 - R.hhHunger))
      else if (fought.has(n.id)) continue
      else if (n.kind === 'wild') {
        const room = n.room ?? 0
        if (n.hh > 0 && n.hh < room) n.hh = Math.min(room, Math.max(n.hh + 1, Math.round(n.hh * (1 + R.settleGrow))))
      } else n.hh = Math.round(n.hh * (1 + R.hhGrowth))
    }
  }
  // 봄이 끝날 때 심는다 — 봄 징병(1단계)이 지난 뒤의 가호
  if (season === 0) for (const n of Object.values(r.nodes)) n.sown = n.hh
}
