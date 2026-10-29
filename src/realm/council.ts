/**
 * 길목 — 지키는 쪽이 이번 계절 이 고을에서 지킬 길 하나 (docs/realm/COUNCIL.md 위원회 결정 · 1주 조각 ①).
 *
 * 쳐들어오는 쪽의 실제 길은 보지 않는다 — 같은 계절에 동시에 정한다. 무게는 셋에서 온다:
 *   땅(그 고을로 드는 길에 열린 진군 방식) · 적장의 버릇(특성) · 나라의 성향(mind) · 지난번에 그 나라가 어디로 왔나(되풀이하면 읽힌다).
 * 들어간 길 = 지킨 길목이면 숨어 닿을 가망이 깎이고, 다른 길이면 그만큼 사람을 뺐으니 조금 오른다. 대로를 지켰는데 대로로 오면 성문 앞에 진을 친다.
 * 순수 함수 · 굴림은 이름 있는 roll (A1). 플레이어가 지키는 쪽이어도 같은 셈으로 맡긴다 (지키는 칩은 나중 조각).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { hasTrait } from './heroes.ts'
import { approachOptions } from './season.ts'
import type { Approach, Hero, Realm } from './types.ts'

/** 그 길목을 지킨 까닭 — 드러날 때 한 줄로 말한다 */
export type GuardWhy = 'repeat' | 'trait' | 'mind' | 'land'

export interface GuardPick {
  readonly ap: Approach
  readonly why: GuardWhy
}

/** 이 고을로 드는 모든 길에서 열리는 진군 방식 */
export function guardOptions(r: Realm, node: string): Approach[] {
  const out = new Set<Approach>()
  for (const ed of Object.values(r.edges)) if (ed.a === node || ed.b === node) for (const ap of approachOptions(r, ed, node)) out.add(ap)
  return (['road', 'night', 'ford', 'ridge', 'cliff'] as const).filter((ap) => out.has(ap))
}

/** 그 나라가 그 나라를 마지막으로 칠 때 고른 길의 열쇠 */
export const pathKey = (atk: string, def: string): string => `${atk}>${def}`

/** 길목마다의 무게와 까닭 — 장수의 읽음도 이것을 본다 */
export function guardWeights(r: Realm, node: string, def: string, atk: string, cmd: Hero | null): Array<{ ap: Approach; w: number; why: GuardWhy }> {
  const R = P.realm
  const base: Readonly<Record<Approach, number>> = { road: R.cnWRoad, night: R.cnWNight, ford: R.cnWFord, ridge: R.cnWRidge, cliff: R.cnWCliff }
  const last = r.pathMemo?.[pathKey(atk, def)]
  const mind = r.factions[def]?.mind
  return guardOptions(r, node).map((ap) => {
    let w = base[ap]
    let why: GuardWhy = 'land'
    let best = 1
    const mul = (m: number, y: GuardWhy): void => { w *= m; if (m > best) { best = m; why = y } }
    if (cmd !== null) {
      if (hasTrait(cmd, 'careful') && (ap === 'night' || ap === 'ridge')) mul(R.cnTraitMul, 'trait')
      if (hasTrait(cmd, 'river') && ap === 'ford') mul(R.cnTraitMul, 'trait')
      if (hasTrait(cmd, 'mountain') && (ap === 'ridge' || ap === 'cliff')) mul(R.cnTraitMul, 'trait')
      if (hasTrait(cmd, 'nighteye') && ap === 'night') mul(R.cnTraitMul, 'trait')
    }
    if (mind === 'greedy' && ap === 'road') mul(R.cnMindMul, 'mind')
    if (mind === 'cautious' && (ap === 'night' || ap === 'ridge')) mul(R.cnMindMul, 'mind')
    if (last === ap) mul(R.cnRepeatMul, 'repeat')
    return { ap, w, why }
  })
}

/** 이번 계절 지킬 길목 하나 — 길이 대로뿐이면(빈 땅·소도) 없다 */
export function guardPick(r: Realm, node: string, def: string, atk: string, cmd: Hero | null, season: number): GuardPick | null {
  const ws = guardWeights(r, node, def, atk, cmd)
  if (ws.length < 2) return null
  const sum = ws.reduce((s, x) => s + x.w, 0)
  let t = roll(r.seed, season, `guard:${node}:${atk}`) * sum
  for (const x of ws) {
    t -= x.w
    if (t < 0) return { ap: x.ap, why: x.why }
  }
  const z = ws[ws.length - 1]!
  return { ap: z.ap, why: z.why }
}

/** 숨어 닿을 가망을 길목으로 고친다 — 읽혔으면 크게 깎이고, 비켜 갔으면 조금 오른다 */
export function guardAdjust(p: number, ap: Approach, guarded: Approach): number {
  const R = P.realm
  const q = ap === guarded ? p - R.cnWatchHit : p + R.cnWatchMiss
  return Math.min(R.ambushMax, Math.max(R.ambushMin, q))
}
