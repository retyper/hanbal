/**
 * 남의 나라는 어떻게 생각하나 — R1 은 성향 둘 (docs/realm/SYSTEMS.md §11 · BUILD §3-5)
 *
 * AI 도 **같은 정보 규칙**을 따른다: 제 intel 에 없는 것은 모른다 (속이는 AI 는 정보의 계약을 깬다).
 * 셈은 화면과 같은 estimate.ts 를 쓴다 — 플레이어가 보는 승률과 AI 가 믿는 승률이 같다.
 *
 *   탐욕(greedy) — 정찰하지 않는다. 보이는 범위의 **가운데**로 셈해 이길 만해 보이면 친다. 모르면 얕본다.
 *   신중(cautious) — 정보가 새롭고 **최악의 승률**이 높을 때만 친다. 아니면 그 고을을 정찰한다.
 *                    혼자로 모자라면 같은 계절에 닿는 둘 이상이 협공한다 (SYSTEMS §4-5).
 * 둘 다 판 초반에는 플레이어 땅에 들어오지 않는다 (spared — 초반 유예).
 * 같은 함수가 tools/realm-sim.ts 의 봇(무모·신중·무작위)으로도 쓰인다 — 플레이어 자리에 앉혀 판을 돌린다.
 * 문턱 숫자는 전부 P.realm.ai* (A2).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { jointWin, movesOf, type Move } from './estimate.ts'
import { armiesAt, newArmyId, planned } from './season.ts'
import type { UnitKind } from './battle.ts'
import type { Army, Order, Realm } from './types.ts'

export type Brain = 'greedy' | 'cautious' | 'reckless' | 'random' | 'planner'

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

/**
 * 초반 유예 (SYSTEMS §9-1 의 "긴장도는 국력을 따른다"가 R4 에서 이 자리를 갖는다) — 판 첫 aiGrace 계절에는
 * 남의 나라가 플레이어 땅에 들어오지 않는다. 작은 나라는 아직 눈에 안 띈다: 이웃끼리 먼저 다투고,
 * 우리는 그 사이에 정찰하고 자리를 잡는다. **먼저 친 나라에는 유예가 없다** (realm.provoked).
 * 승률 문턱으로는 못 막는다 — 빈 읍락은 승률 100% 다 (봇 대전: 잃은 땅의 7할이 싸움 없이 빈 고을이었다).
 */
export function spared(r: Realm, faction: string, to: string): boolean {
  const owner = r.nodes[to]?.owner
  if (owner === null || owner === undefined || owner === faction) return false
  if (r.factions[owner]?.mind !== 'player' || r.season >= P.realm.aiGrace) return false
  return !(r.provoked ?? []).includes(faction)
}

/**
 * 신중의 협공 (SYSTEMS §4-5) — 혼자로는 모자란 군대들이 같은 계절에 닿는 길로 같은 고을을 함께 친다.
 * 국읍을 다 비우지는 않는다.
 */
function joint(r: Realm, faction: string, idle: readonly Army[]): Order[] {
  const R = P.realm
  const cap = r.factions[faction]?.capital
  const used = new Set<string>()
  const out: Order[] = []
  const targets = new Set<string>()
  const movesBy = new Map(idle.map((a) => [a.id, movesOf(r, faction, a)] as const))
  for (const ms of movesBy.values()) for (const t of ms) if (t.hostile && t.blocked === null && !spared(r, faction, t.to)) targets.add(t.to)
  for (const to of [...targets].sort()) {
    // 닿는 계절 수가 같은 것끼리만 — 박자가 안 맞으면 따로 맞는다
    const bySeasons = new Map<number, Array<{ army: Army; move: Move }>>()
    let leftAtCap = cap === undefined ? 0 : armiesAt(r, cap).filter((x) => x.faction === faction && !used.has(x.id)).length
    for (const a of idle) {
      if (used.has(a.id)) continue
      const t = movesBy.get(a.id)!.find((m) => m.to === to && m.hostile && m.blocked === null && m.win !== null && m.age <= R.aiCautiousAge)
      if (t === undefined) continue
      if (a.at === cap) {
        if (leftAtCap <= 1) continue
        leftAtCap -= 1
      }
      const list = bySeasons.get(t.seasons) ?? []
      list.push({ army: a, move: t })
      bySeasons.set(t.seasons, list)
    }
    for (const [, legs] of [...bySeasons].sort((x, y) => x[0] - y[0])) {
      if (legs.length < 2) continue
      const w = jointWin(r, faction, legs.map((x) => ({ army: x.army, edge: x.move.edge })), to)
      if (w === null || w[0] < R.aiCautiousWin) continue
      for (const x of legs) {
        out.push(march(x.army, x.move))
        used.add(x.army.id)
      }
      break
    }
  }
  return out
}

/**
 * 봇 계획가 (tools/realm-sim) — 신중처럼 정찰하고 최악의 승률로 고르되, 국읍의 마지막 군대라고 얼어 있지 않는다:
 * plannerKeep 몫을 국읍에 남기고 장수가 별동대를 이끌어 그 계절에 떠난다 (SYSTEMS §4-5 나누기).
 * 같은 고을에 쉬는 군대가 둘 이상이면 먼저 모은다 — 상한 다섯을 쓰고 남기지 않으려고.
 */
function plan(r: Realm, faction: string): Order[] {
  const R = P.realm
  const orders: Order[] = []
  let p = r
  const idle = (): Army[] => sorted(Object.values(p.armies)).filter((a) => a.faction === faction && a.march === null)
  // 모으기 — 장수 없는 쪽을 장수 있는 쪽으로
  for (const a of idle()) {
    if (p.armies[a.id] === undefined || a.hero !== null) continue
    const into = idle().find((b) => b.id !== a.id && b.at === a.at)
    if (into === undefined) continue
    const o: Order = { kind: 'merge', army: a.id, into: into.id }
    const next = planned(p, [o])
    if (next.armies[a.id] !== undefined) continue
    orders.push(o)
    p = next
  }
  let scouted = false
  for (const a of idle()) {
    const ts = movesOf(p, faction, a).filter((t) => t.hostile && t.blocked === null && !spared(p, faction, t.to))
    if (ts.length === 0) continue
    const fresh = ts.filter((t) => t.win !== null && t.age <= R.aiCautiousAge)
    if (!lastGuard(p, faction, a)) {
      const ready = fresh.filter((t) => t.win![0] >= R.aiCautiousWin)
      if (ready.length > 0) {
        orders.push(march(a, ready.reduce((x, y) => (y.win![0] > x.win![0] ? y : x))))
        continue
      }
    } else {
      // 국읍의 마지막 군대 — 몫을 남기고 별동대를 보낸다
      const take: Partial<Record<UnitKind, number>> = {}
      for (const [k, n] of Object.entries(a.mix) as Array<[UnitKind, number]>) take[k] = Math.floor(n * (1 - R.plannerKeep))
      const det = { ...a, mix: take }
      let best: Move | null = null
      let bestW = -1
      for (const t of fresh) {
        const w = jointWin(p, faction, [{ army: det, edge: t.edge }], t.to)
        if (w !== null && w[0] >= R.aiCautiousWin && w[0] > bestW) {
          best = t
          bestW = w[0]
        }
      }
      if (best !== null) {
        const id = newArmyId(p, faction)
        const o: Order = { kind: 'split', army: a.id, id, take, hero: true }
        const next = planned(p, [o])
        if (next.armies[id] !== undefined) {
          orders.push(o, march(next.armies[id]!, best))
          p = next
          continue
        }
      }
    }
    if (!scouted) {
      const stale = ts.reduce((x, y) => (y.age > x.age ? y : x))
      if (stale.age > R.aiCautiousAge) {
        orders.push({ kind: 'scout', faction, node: stale.to, hero: null })
        scouted = true
      }
    }
  }
  return orders
}

/** 한 세력의 이번 계절 명령 */
export function decide(r: Realm, faction: string, brain: Brain): Order[] {
  if (brain === 'planner') return plan(r, faction)
  const R = P.realm
  const orders: Order[] = []
  const armies = sorted(Object.values(r.armies)).filter((a) => a.faction === faction && a.march === null)
  const waiting: Army[] = []
  let scouted = false

  for (const a of armies) {
    const ts = movesOf(r, faction, a).filter((t) => t.hostile && t.blocked === null && !spared(r, faction, t.to))
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
    waiting.push(a)
    if (!scouted) {
      // 가장 오래 못 본 이웃 적 고을을 본다 — 한 계절에 척후 하나
      const stale = ts.reduce((x, y) => (y.age > x.age ? y : x))
      if (stale.age > R.aiCautiousAge) {
        orders.push({ kind: 'scout', faction, node: stale.to, hero: null })
        scouted = true
      }
    }
  }
  if (brain === 'cautious' && waiting.length >= 2) orders.push(...joint(r, faction, waiting))
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
