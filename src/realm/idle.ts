/**
 * 놀고 있는 계절 세기 — 아무 일도 안 시킨 계절이 이어지면 「할 일」을 권한다 (PLAYTEST-1112 TOP 2)
 * 순수한 셈만 둔다. 화면(app.ts 추천 딱지)과 시험이 같이 쓴다.
 */
import { P } from '../tune/params.ts'
import { headcount } from './battle.ts'
import { forceOf } from './season.ts'
import type { Order, Realm } from './types.ts'

/** 판을 바꾸는 명령 — 치기 · 짓기 · 뽑기 · 정찰 · 외교 · 혼인 · 개척 · 공작. 답 · 경계 · 장수 맡기기 같은 살림은 세지 않는다 */
const ACTIVE: ReadonlySet<Order['kind']> = new Set<Order['kind']>([
  'march', 'assault', 'scout', 'draft', 'settle', 'party', 'plot', 'envoy', 'build', 'work', 'wed', 'expedition', 'hire', 'arm', 'call', 'wonder', 'feast',
])

export interface IdleState {
  /** 판을 바꾸는 명령 없이 넘어온 계절 수 */
  seasons: number
  /** 큰 군대(idleArmyMen 이상)가 한 고을에 가만히 있은 계절 수 — 군대 id 마다 */
  army: Record<string, number>
}

export const hasActive = (orders: readonly Order[]): boolean => orders.some((o) => ACTIVE.has(o.kind))

/** 한 계절을 넘길 때 — prev 는 넘기기 전 판, orders 는 우리 명령, prior 는 지금까지의 셈 */
export function nextIdle(prev: Realm, orders: readonly Order[], me: string, prior: IdleState | undefined): IdleState {
  const moving = new Set<string>()
  for (const o of orders) if (o.kind === 'march' || o.kind === 'assault' || (o.kind === 'goal' && o.node !== null)) moving.add(o.army)
  const army: Record<string, number> = {}
  for (const a of Object.values(prev.armies)) {
    if (a.faction !== me || a.march !== null || moving.has(a.id)) continue
    if (headcount(forceOf(prev, a)) < P.realm.idleArmyMen) continue
    army[a.id] = (prior?.army[a.id] ?? 0) + 1
  }
  return { seasons: hasActive(orders) ? 0 : (prior?.seasons ?? 0) + 1, army }
}
