/**
 * 한 군대가 이번 계절에 갈 수 있는 길마다의 셈 — 제 정보로만 (docs/realm/SYSTEMS.md §2-3 · §3 · §11)
 *
 * 화면(view.ts)과 AI(ai.ts)가 **같은 셈**을 쓴다. 둘이 따로 셈하면 플레이어가 보는 승률과 AI 가 믿는 승률이 갈라진다.
 * 승률은 범위로 낸다 — 모르는 입력(적 군세)을 끝에서 끝까지 넣는다. 범위가 좁혀지는 것이 정찰의 보상이다.
 */
import { P } from '../tune/params.ts'
import { ambushChance, ambushSizePenalty, headcount, strength, winChance } from './battle.ts'
import { militiaMen } from './economy.ts'
import { ambushTraitOf } from './heroes.ts'
import { alertRange, visibleRange } from './intel.ts'
import { blockedWhy, conceal, forceOf, fortMul, marchSeasons, otherEnd, seasonOf, seenMarches } from './season.ts'
import type { Army, Realm, REdge } from './types.ts'

export interface Move {
  readonly edge: REdge
  readonly to: string
  /** 길을 지나는 계절 수 */
  readonly seasons: number
  /** 이번 계절에 막혔으면 까닭 */
  readonly blocked: 'winterPass' | 'summerFord' | null
  /** 남이 쥔 땅인가 (싸움이 날 수 있다). 아무도 안 쥔 빈땅·소도는 아니다 */
  readonly hostile: boolean
  /** 정면으로 칠 때의 승률 범위 [최악, 최선] — 남의 땅인데 모르면 null, 제 땅이면 null */
  readonly win: readonly [number, number] | null
  /** 기습이 먹혔을 때 — 성·지형을 안 받고 장정이 없다. 모르면 null */
  readonly winAmbush: readonly [number, number] | null
  /** 기습이 들켰을 때 — 기다리던 적에게 걸린다. 모르면 null */
  readonly winCaught: readonly [number, number] | null
  /** 정보의 나이 (계절). 모르면 Infinity */
  readonly age: number
  /** 기습 확률 (모르는 것은 P.realm.aiAssume* 로 본다). 큰 군대는 낮다 */
  readonly ambushP: number
}

type Range = readonly [number, number]

function byId<T extends { id: string }>(xs: Iterable<T>): T[] {
  return [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * 제 정보로 본 그 고을에 대한 승률 범위 셋 — 정면 · 기습이 먹힘 · 들킴. 모르면 셋 다 null. 도하는 넣지 않는다.
 * 기습이 먹히면 장정이 못 모인다 — 장정 몫은 가호로 셈한다 (땅·가호는 누구나 안다, 모르는 것은 군대뿐이다).
 */
function winVs(r: Realm, faction: string, to: string, myF: number): { win: Range | null; ambush: Range | null; caught: Range | null; age: number } {
  const R = P.realm
  const node = r.nodes[to]!
  const k = (r.intel[faction] ?? {})[to]
  const none = { win: null, ambush: null, caught: null }
  if (node.owner === faction || node.kind === 'sodo' || !k?.force) return { ...none, age: Infinity }
  const age = r.season - k.force.season
  const range = visibleRange({ f0: k.force.f0, src: k.force.src, u: k.force.u }, age)
  if (range === null) return { ...none, age }
  const t = fortMul(node, seasonOf(r.season))
  // 행군은 보인다 (FLOW §7 #2) — 그 고을 주인이 보내는 보인 증원은 범위 위쪽에 더한다 (언제 닿을지는 모른다)
  let extra = 0
  for (const a of seenMarches(r, faction)) if (a.faction === node.owner && a.march!.to === to) extra += strength(forceOf(r, a))
  const mil = strength({ mix: { spear: militiaMen(r, to) }, equip: 'bronze', mu: 1, morale: 1 })
  const lo = range[0]
  const hi = range[1] + extra
  const span = (f: number, dLo: number, dHi: number): Range => [winChance(f, dHi), winChance(f, dLo)]
  return {
    win: span(myF, lo * t, hi * t),
    ambush: span(myF * R.ambushSuccess, Math.max(0, lo - mil), Math.max(0, hi - mil)),
    caught: span(myF * R.ambushCaught, lo * t, hi * t),
    age,
  }
}

/**
 * 협공의 셈 (SYSTEMS §4-5) — 같은 고을로 같은 계절에 닿는 군대들의 합친 승률 범위 (정면).
 * 서로 다른 길이 둘 이상이면 ×pincer. 닿는 계절이 다르면 협공이 아니다 — 부르는 쪽이 고른다.
 */
export function jointWin(r: Realm, faction: string, legs: readonly { army: Army; edge: REdge }[], to: string): Range | null {
  let f = 0
  for (const x of legs) f += strength(forceOf(r, x.army))
  if (new Set(legs.map((x) => x.edge.id)).size >= 2) f *= P.realm.pincer
  return winVs(r, faction, to, f).win
}

/** 기습의 기대 승률 — 먹힐 확률로 기습·들킴 범위의 가운데를 섞는다. AI 가 정면과 견준다. 모르면 null */
export function ambushWorth(m: Move): number | null {
  if (m.winAmbush === null || m.winCaught === null) return null
  const mid = (x: Range): number => (x[0] + x[1]) / 2
  return m.ambushP * mid(m.winAmbush) + (1 - m.ambushP) * mid(m.winCaught)
}

export function movesOf(r: Realm, faction: string, a: Army): Move[] {
  const R = P.realm
  const season = seasonOf(r.season)
  const known = r.intel[faction] ?? {}
  const myF = strength(forceOf(r, a))
  const myRyak = a.hero !== null ? (r.heroes[a.hero]?.ryak ?? 1) : 1
  const size = -ambushSizePenalty(headcount(forceOf(r, a)))
  const out: Move[] = []
  for (const ed of byId(Object.values(r.edges))) {
    const to = otherEnd(ed, a.at)
    if (to === null) continue
    const node = r.nodes[to]!
    // 아무도 안 쥔 빈땅은 칠 데가 아니다 — 장정이 없다. 개척(settle)이나 깃발 꽂기로 쥔다
    const hostile = node.owner !== null && node.owner !== faction && node.kind !== 'sodo'
    const k = known[to]
    const v = winVs(r, faction, to, myF)
    const al = k?.alert ? alertRange(k.alert.v, r.season - k.alert.season) : null
    const ambushP = ambushChance(conceal(ed, node, season), myRyak, R.aiAssumeRyak, size + ambushTraitOf(a.hero !== null ? (r.heroes[a.hero] ?? null) : null, ed.kind), 0, al === null ? R.aiAssumeAlert : al[1])
    out.push({
      edge: ed, to, seasons: marchSeasons(ed.kind, season), blocked: blockedWhy(ed, season), hostile,
      win: v.win, winAmbush: v.ambush, winCaught: v.caught, age: v.age, ambushP,
    })
  }
  return out
}
