/**
 * 남의 나라는 어떻게 생각하나 — R1 은 성향 둘 (docs/realm/SYSTEMS.md §11 · BUILD §3-5)
 *
 * AI 도 **같은 정보 규칙**을 따른다: 제 intel 에 없는 것은 모른다 (속이는 AI 는 정보의 계약을 깬다).
 * 그래서 남의 군세는 visibleRange(낡은 범위)로만 보고, 승률도 범위로 셈한다.
 *
 *   탐욕(greedy) — 정찰하지 않는다. 보이는 범위의 **가운데**로 셈해 이길 만해 보이면 친다. 모르면 얕본다.
 *   신중(cautious) — 정보가 새롭고 **최악의 승률**이 높을 때만 친다. 아니면 그 고을을 정찰한다.
 * 같은 함수가 tools/realm-sim.ts 의 봇(무모·신중·무작위)으로도 쓰인다 — 플레이어 자리에 앉혀 판을 돌린다.
 * 문턱 숫자는 전부 P.realm.ai* (A2).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { ambushChance, strength, winChance } from './battle.ts'
import { alertRange, visibleRange } from './intel.ts'
import {
  armiesAt, blockedWhy, conceal, forceOf, fortMul, otherEnd, seasonOf,
} from './season.ts'
import type { Army, Order, Realm, REdge } from './types.ts'

export type Brain = 'greedy' | 'cautious' | 'reckless' | 'random'

interface Target {
  readonly edge: REdge
  readonly node: string
  /** 승률 범위 [최악, 최선] — 모르면 null */
  readonly win: readonly [number, number] | null
  /** 정보의 나이 (계절). 모르면 Infinity */
  readonly age: number
  readonly ambushP: number
}

function sorted<T extends { id: string }>(xs: Iterable<T>): T[] {
  return [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** 이 군대가 이번 계절에 칠 수 있는 이웃 적 고을들 — 제 정보로만 셈한다 */
function targets(r: Realm, faction: string, a: Army): Target[] {
  const R = P.realm
  const season = seasonOf(r.season)
  const known = r.intel[faction] ?? {}
  const myF = strength(forceOf(r, a))
  const myRyak = a.hero !== null ? (r.heroes[a.hero]?.ryak ?? 1) : 1
  const out: Target[] = []
  for (const ed of sorted(Object.values(r.edges))) {
    const to = otherEnd(ed, a.at)
    if (to === null || blockedWhy(ed, season) !== null) continue
    const node = r.nodes[to]!
    if (node.owner === faction || node.kind === 'sodo') continue
    const k = known[to]
    const t = fortMul(node, season)
    let win: readonly [number, number] | null = null
    let age = Infinity
    if (k?.force) {
      age = r.season - k.force.season
      const range = visibleRange({ f0: k.force.f0, src: k.force.src, u: k.force.u }, age)
      if (range !== null) win = [winChance(myF, range[1] * t), winChance(myF, range[0] * t)]
    }
    // 기습 — 적 장수의 략은 모르니 보통으로, 경계는 본 것이 있으면 그 범위의 위쪽으로
    const al = k?.alert ? alertRange(k.alert.v, r.season - k.alert.season) : null
    const ambushP = ambushChance(conceal(ed, node, season), myRyak, R.aiAssumeRyak, 0, 0, al === null ? R.aiAssumeAlert : al[1])
    out.push({ edge: ed, node: to, win, age, ambushP })
  }
  return out
}

/** 이 군대가 떠나면 국읍이 비는가 — 국읍을 지키는 마지막 군대는 웬만해선 안 움직인다 */
function lastGuard(r: Realm, faction: string, a: Army): boolean {
  const cap = r.factions[faction]?.capital
  if (cap === undefined || a.at !== cap) return false
  return armiesAt(r, cap).filter((x) => x.faction === faction).length <= 1
}

function march(a: Army, t: Target): Order {
  return { kind: 'march', army: a.id, edge: t.edge.id, ambush: t.ambushP >= P.realm.aiAmbushWorth }
}

/** 한 세력의 이번 계절 명령 */
export function decide(r: Realm, faction: string, brain: Brain): Order[] {
  const R = P.realm
  const orders: Order[] = []
  const armies = sorted(Object.values(r.armies)).filter((a) => a.faction === faction && a.march === null)
  let scouted = false

  for (const a of armies) {
    const ts = targets(r, faction, a)
    if (ts.length === 0) continue

    if (brain === 'random') {
      if (roll(r.seed, r.season, `ai:${faction}:${a.id}:go`) < 0.5) continue
      orders.push(march(a, ts[Math.floor(roll(r.seed, r.season, `ai:${faction}:${a.id}:pick`) * ts.length)]!))
      continue
    }

    if (brain === 'greedy' || brain === 'reckless') {
      // 가운데로 셈하고, 모르면 얕본다. 무모는 국읍도 비운다
      if (brain === 'greedy' && lastGuard(r, faction, a)) continue
      const est = (t: Target): number => (t.win !== null ? (t.win[0] + t.win[1]) / 2 : R.aiUnknownWin)
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
        orders.push({ kind: 'scout', faction, node: stale.node, hero: null })
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
