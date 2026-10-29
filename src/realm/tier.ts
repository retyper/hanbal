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

/** 0 쉬움(촌장) · 1 보통(군장) · … · 6 가장 어려움(천손). 옛 저장의 7~10 단계는 6 으로 친다 */
export const TIER_MIN = 0
export const TIER_MAX = 6

/**
 * 단계의 이름 — 문명의 개척자·왕·신처럼 칭호가 오른다 (형 10-23: "어려운 건 내가 깰 경우 인정받을 만한 그런 이름").
 * 마을 어른 → 읍락의 군장 → 부여·고구려의 대가 → 왕 → 대왕 → 광개토의 태왕 → 하늘의 자손(주몽·해모수의 천손)
 */
export const LEVEL_NAME: readonly string[] = ['촌장', '군장', '대가', '왕', '대왕', '태왕', '천손']
/** 단계마다 한 줄 */
export const LEVEL_LINE: readonly string[] = [
  '쉬움: 이웃이 약하고 우리 가을걷이가 넉넉하다. 이야기를 따라가고 싶을 때',
  '보통: 처음 그대로',
  '조금 어려움: 이웃의 첫 군대·창고가 크다',
  '어려움: 이웃이 크고 해마다 더 거둔다',
  '매우 어려움: 이웃이 우리 고을을 노린다',
  '혹독함: 우리 가을걷이도 준다',
  '가장 어려움: 하늘의 자손만이 이긴다',
]
export const levelName = (t: number): string => LEVEL_NAME[clampTier(t)]!
export const clampTier = (t: number): number => Math.max(TIER_MIN, Math.min(TIER_MAX, Math.floor(t)))

/** 단계의 셈 — 이웃의 군대 · 창고 · 가을걷이 배수와 우리 가을걷이 배수 */
export function tierMul(tier: number): { army: number; stock: number; income: number; ours: number } {
  const c = clampTier(tier)
  if (c === 0) return { army: P.realm.easyArmy, stock: P.realm.easyStock, income: P.realm.easyIncome, ours: P.realm.easyOurs }
  const t = c - 1
  return { army: 1 + P.realm.tierArmy * t, stock: 1 + P.realm.tierStock * t, income: 1 + P.realm.tierIncome * t, ours: Math.max(0.3, 1 - P.realm.tierOurs * t) }
}

/** 판을 열 때 — 이웃 나라를 단계만큼 세게(쉬움이면 약하게). 보통(1)이면 아무것도 안 한다. 캠페인의 장도 단계를 받는다 */
export function applyTier(r: Realm, tier: number): void {
  const t = clampTier(tier)
  if (t === 1 || r.region === 'tutorial') return
  const m = tierMul(t)
  for (const a of Object.values(r.armies)) if (a.faction !== r.player) scaleMen(a, m.army)
  for (const [f, st] of Object.entries(r.stock)) {
    if (f === r.player) continue
    st.grain = Math.round(st.grain * m.stock)
    st.iron = Math.round(st.iron * m.stock)
  }
  r.tier = t
}
