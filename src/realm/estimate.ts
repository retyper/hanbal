/**
 * 한 군대가 이번 계절에 갈 수 있는 길마다의 셈 — 제 정보로만 (docs/realm/SYSTEMS.md §2-3 · §3 · §11)
 *
 * 화면(view.ts)과 AI(ai.ts)가 **같은 셈**을 쓴다. 둘이 따로 셈하면 플레이어가 보는 승률과 AI 가 믿는 승률이 갈라진다.
 * 승률은 범위로 낸다 — 모르는 입력(적 군세)을 끝에서 끝까지 넣는다. 범위가 좁혀지는 것이 정찰의 보상이다.
 */
import { P } from '../tune/params.ts'
import { ambushChance, strength, winChance } from './battle.ts'
import { alertRange, visibleRange } from './intel.ts'
import { blockedWhy, conceal, forceOf, fortMul, marchSeasons, otherEnd, seasonOf } from './season.ts'
import type { Army, Realm, REdge } from './types.ts'

export interface Move {
  readonly edge: REdge
  readonly to: string
  /** 길을 지나는 계절 수 */
  readonly seasons: number
  /** 이번 계절에 막혔으면 까닭 */
  readonly blocked: 'winterPass' | 'summerFord' | null
  /** 남의 땅인가 (싸움이 날 수 있다) */
  readonly hostile: boolean
  /** 승률 범위 [최악, 최선] — 남의 땅인데 모르면 null, 제 땅이면 null */
  readonly win: readonly [number, number] | null
  /** 정보의 나이 (계절). 모르면 Infinity */
  readonly age: number
  /** 기습 확률 (모르는 것은 P.realm.aiAssume* 로 본다) */
  readonly ambushP: number
}

function byId<T extends { id: string }>(xs: Iterable<T>): T[] {
  return [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function movesOf(r: Realm, faction: string, a: Army): Move[] {
  const R = P.realm
  const season = seasonOf(r.season)
  const known = r.intel[faction] ?? {}
  const myF = strength(forceOf(r, a))
  const myRyak = a.hero !== null ? (r.heroes[a.hero]?.ryak ?? 1) : 1
  const out: Move[] = []
  for (const ed of byId(Object.values(r.edges))) {
    const to = otherEnd(ed, a.at)
    if (to === null) continue
    const node = r.nodes[to]!
    const hostile = node.owner !== faction && node.kind !== 'sodo'
    const k = known[to]
    let win: readonly [number, number] | null = null
    let age = Infinity
    if (hostile && k?.force) {
      age = r.season - k.force.season
      const range = visibleRange({ f0: k.force.f0, src: k.force.src, u: k.force.u }, age)
      const t = fortMul(node, season)
      if (range !== null) win = [winChance(myF, range[1] * t), winChance(myF, range[0] * t)]
    }
    const al = k?.alert ? alertRange(k.alert.v, r.season - k.alert.season) : null
    const ambushP = ambushChance(conceal(ed, node, season), myRyak, R.aiAssumeRyak, 0, 0, al === null ? R.aiAssumeAlert : al[1])
    out.push({ edge: ed, to, seasons: marchSeasons(ed.kind, season), blocked: blockedWhy(ed, season), hostile, win, age, ambushP })
  }
  return out
}
