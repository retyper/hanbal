/**
 * 남의 나라는 어떻게 생각하나 — R1 은 성향 둘 (docs/realm/SYSTEMS.md §11 · BUILD §3-5)
 *
 * AI 도 **같은 정보 규칙**을 따른다: 제 intel 에 없는 것은 모른다 (속이는 AI 는 정보의 계약을 깬다).
 * 셈은 화면과 같은 estimate.ts 를 쓴다 — 플레이어가 보는 승률과 AI 가 믿는 승률이 같다.
 *
 *   탐욕(greedy) — 정찰하지 않는다. 보이는 범위의 **가운데**로 셈해 이길 만해 보이면 친다. 모르면 얕본다.
 *   신중(cautious) — 정보가 새롭고 **최악의 승률**이 높을 때만 친다. 아니면 그 고을을 정찰한다.
 * 같은 함수가 tools/realm-sim.ts 의 봇(무모·신중·무작위)으로도 쓰인다 — 플레이어 자리에 앉혀 판을 돌린다.
 * 문턱 숫자는 전부 P.realm.ai* (A2).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { movesOf, type Move } from './estimate.ts'
import { armiesAt } from './season.ts'
import type { Army, Order, Realm } from './types.ts'

export type Brain = 'greedy' | 'cautious' | 'reckless' | 'random'

function sorted<T extends { id: string }>(xs: Iterable<T>): T[] {
  return [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** 국읍을 지키는 마지막 군대인가 — 웬만해선 안 움직인다 */
function lastGuard(r: Realm, faction: string, a: Army): boolean {
  const cap = r.factions[faction]?.capital
  if (cap === undefined || a.at !== cap) return false
  return armiesAt(r, cap).filter((x) => x.faction === faction).length <= 1
}

function march(a: Army, t: Move): Order {
  return { kind: 'march', army: a.id, edge: t.edge.id, ambush: t.ambushP >= P.realm.aiAmbushWorth }
}

/** 한 세력의 이번 계절 명령 */
export function decide(r: Realm, faction: string, brain: Brain): Order[] {
  const R = P.realm
  const orders: Order[] = []
  const armies = sorted(Object.values(r.armies)).filter((a) => a.faction === faction && a.march === null)
  let scouted = false

  for (const a of armies) {
    const ts = movesOf(r, faction, a).filter((t) => t.hostile && t.blocked === null)
    if (ts.length === 0) continue

    if (brain === 'random') {
      if (roll(r.seed, r.season, `ai:${faction}:${a.id}:go`) < 0.5) continue
      orders.push(march(a, ts[Math.floor(roll(r.seed, r.season, `ai:${faction}:${a.id}:pick`) * ts.length)]!))
      continue
    }

    if (brain === 'greedy' || brain === 'reckless') {
      // 가운데로 셈하고, 모르면 얕본다. 무모는 국읍도 비운다
      if (brain === 'greedy' && lastGuard(r, faction, a)) continue
      const est = (t: Move): number => (t.win !== null ? (t.win[0] + t.win[1]) / 2 : R.aiUnknownWin)
      const best = ts.reduce((x, y) => (est(y) > est(x) ? y : x))
      if (est(best) >= (brain === 'reckless' ? R.aiRecklessWin : R.aiGreedyWin)) orders.push(march(a, best))
      continue
    }

    // 신중 — 새 정보 · 최악의 승률
    const ready = ts.filter((t) => t.win !== null && t.age <= R.aiCautiousAge && t.win[0] >= R.aiCautiousWin)
    if (ready.length > 0 && !lastGuard(r, faction, a)) {
      orders.push(march(a, ready.reduce((x, y) => (y.win![0] > x.win![0] ? y : x))))
      continue
    }
    if (!scouted) {
      // 가장 오래 못 본 이웃 적 고을을 본다 — 한 계절에 척후 하나
      const stale = ts.reduce((x, y) => (y.age > x.age ? y : x))
      if (stale.age > R.aiCautiousAge) {
        orders.push({ kind: 'scout', faction, node: stale.to, hero: null })
        scouted = true
      }
    }
  }
  return orders
}

/** 플레이어가 아닌 모든 세력의 명령 — 저마다의 성향대로 */
export function aiOrders(r: Realm): Order[] {
  const out: Order[] = []
  for (const f of sorted(Object.values(r.factions))) {
    if (f.mind === 'player') continue
    out.push(...decide(r, f.id, f.mind))
  }
  return out
}
