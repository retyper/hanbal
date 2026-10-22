/**
 * 캠페인의 장(章) — 사료의 사건 하나를 판 하나로 (docs/realm/CAMPAIGN.md · 형 2026-10-22: "문명처럼 … 특수한 승리조건").
 *
 * 판(Realm)에 `scenario` 가 얹히면 이 장의 목표를 모두 이루어야 이긴다. 도읍을 잃으면 지는 것은 그대로 (season.checkOutcome).
 * 맹주 · 철과 뱃길 · 큰 제사로 끝나는 길은 장에서는 닫힌다 — 장의 이김은 그 장의 목표 하나뿐.
 * 셈은 판만 읽는다 (결정론 A1).
 */
import { pairKey } from './diplomacy.ts'
import type { Goal, Realm } from './types.ts'

/** 목표 하나가 어디까지 왔나 — 화면의 막대 (숫자 대신 감: have/need 는 막대 길이로만 쓴다) */
export interface GoalState {
  readonly done: boolean
  readonly have: number
  readonly need: number
}

/** 그 나라가 우리를 따르나 — 동맹이거나 조공하는 사이 */
function follows(r: Realm, f: string, how: 'ally' | 'tribute' | 'either'): boolean {
  const rel = r.relations[pairKey(r.player, f)]
  if (rel === undefined) return false
  const ally = rel.state === 'ally'
  const tribute = rel.vassal !== undefined && rel.vassal.lord === r.player && rel.vassal.until >= r.season
  return how === 'ally' ? ally : how === 'tribute' ? tribute : ally || tribute
}

export function goalState(r: Realm, g: Goal): GoalState {
  switch (g.kind) {
    case 'hold': {
      const have = g.nodes.filter((id) => r.nodes[id]?.owner === r.player).length
      return { done: have >= g.nodes.length, have, need: g.nodes.length }
    }
    case 'submit': {
      const have = g.factions.filter((f) => follows(r, f, g.how)).length
      return { done: have >= g.factions.length, have, need: g.factions.length }
    }
    case 'fell': {
      const h = r.heroes[g.hero]
      const down = h !== undefined && h.status !== 'free'
      return { done: down, have: down ? 1 : 0, need: 1 }
    }
    case 'event': {
      const did = r.scenario?.marks?.includes(g.id) === true
      return { done: did, have: did ? 1 : 0, need: 1 }
    }
    case 'survive': {
      // 이번 계절을 치르고 셈한다 — 지난 계절 수는 season + 1
      const have = Math.min(g.seasons, r.season + 1)
      return { done: have >= g.seasons, have, need: g.seasons }
    }
  }
}

/** 장의 끝 — 목표를 모두 이뤘으면 이김, 기한을 넘겼으면 짐. 장이 아니면 null */
export function scenarioOutcome(r: Realm): 'win' | 'lose' | null {
  const sc = r.scenario
  if (sc === undefined) return null
  if (sc.win.every((g) => goalState(r, g).done)) return 'win'
  if (sc.limit !== undefined && r.season + 1 >= sc.limit) return 'lose'
  return null
}

/** 남은 계절 — 기한이 없으면 null */
export function seasonsLeft(r: Realm): number | null {
  const lim = r.scenario?.limit
  return lim === undefined ? null : Math.max(0, lim - r.season)
}

/** 장의 사건을 이뤘다고 적는다 (활쏘기 겨루기 이김 · 북 찢기 …) — 같은 것은 한 번만 */
export function markEvent(r: Realm, id: string): void {
  const sc = r.scenario
  if (sc === undefined) return
  const marks = sc.marks ?? []
  if (!marks.includes(id)) sc.marks = [...marks, id].sort()
}
