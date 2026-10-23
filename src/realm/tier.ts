/**
 * 난세 단계 — 디아블로의 고통 단계 자리 (docs/realm/VISION §5-2 ④ · PLAY §5).
 *
 * 형의 메모: "최종적으로는 성장해서 최대한 빨리 보스를 잡을때까지 강해지려고함(자동화의 완성, 엔드컨텐츠임)".
 * 판을 n단계에서 이기면 그 판의 n+1단계가 열린다 (ui/realm/unlock.ts). 단계가 오를수록 이웃 나라가 처음부터 세다 —
 * 군대가 크고 창고가 넉넉하고, 해마다 더 거둔다 (economy 가을걷이). 우리 가을걷이는 조금 준다 — 이웃만 세지면 이웃끼리 더 싸워 오히려 쉬워지기도 했다 (BALANCE). 판을 열 때 한 번 정해진다 (판의 `tier`).
 */
import { P } from '../tune/params.ts'
import { scaleMen } from './kit.ts'
import type { Realm } from './types.ts'

export const TIER_MAX = 10

/** 단계의 셈 — 이웃의 군대 · 창고 배수 */
export function tierMul(tier: number): { army: number; stock: number; income: number; ours: number } {
  const t = Math.max(1, Math.min(TIER_MAX, Math.floor(tier))) - 1
  return { army: 1 + P.realm.tierArmy * t, stock: 1 + P.realm.tierStock * t, income: 1 + P.realm.tierIncome * t, ours: Math.max(0.3, 1 - P.realm.tierOurs * t) }
}

/** 판을 열 때 — 이웃 나라를 단계만큼 세게. 1단계면 아무것도 안 한다 */
export function applyTier(r: Realm, tier: number): void {
  const t = Math.max(1, Math.min(TIER_MAX, Math.floor(tier)))
  if (t <= 1 || r.region === 'tutorial') return // 캠페인의 장도 단계를 받는다 (형 10-23: 쉬움·어려움)
  const m = tierMul(t)
  for (const a of Object.values(r.armies)) if (a.faction !== r.player) scaleMen(a, m.army)
  for (const [f, st] of Object.entries(r.stock)) {
    if (f === r.player) continue
    st.grain = Math.round(st.grain * m.stock)
    st.iron = Math.round(st.iron * m.stock)
  }
  r.tier = t
}
