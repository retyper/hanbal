/**
 * 나라 살림 — 가호 · 곡식 · 철 · 징병 (docs/realm/FLOW.md §1·§2 · SYSTEMS §7-6 의 최소판)
 *
 * 한 해의 흐름이 숫자로 선다:
 *   봄   — 심는다. 봄이 끝날 때의 가호가 `sown` 이 된다 → 가을 수확을 정한다. 봄에 징병하면 그해 농사가 준다
 *   가을 — 거둔다. sown × harvestPerHH 가 국읍 창고로
 *   늘   — 군대는 곡식을 먹는다 (겨울 × winterRation). 바닥나면 사기가 떨어지고 가호가 준다
 *         곡식이 있고 싸움이 없던 고을은 가호가 조금씩 는다
 * 장정(군대 없는 고을을 지키는 사람)도 가호에 비례한다.
 *
 * 순수 함수만 — season.ts 가 부른다. 이 파일은 season.ts 를 부르지 않는다 (고리를 만들지 않는다).
 */
import { P } from '../tune/params.ts'
import type { ReportLine, Realm, Stock } from './types.ts'

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
      const grain = Math.round(sown * R.harvestPerHH)
      if (grain > 0) {
        s.grain += grain
        lines.push({ kind: 'harvest', faction: f, grain })
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
    // 가호 — 굶으면 줄고, 먹고 싸움이 없으면 는다
    for (const n of nodes) {
      if (hungry) n.hh = Math.round(n.hh * (1 - R.hhHunger))
      else if (!fought.has(n.id)) n.hh = Math.round(n.hh * (1 + R.hhGrowth))
    }
  }
  // 봄이 끝날 때 심는다 — 봄 징병(1단계)이 지난 뒤의 가호
  if (season === 0) for (const n of Object.values(r.nodes)) n.sown = n.hh
}
