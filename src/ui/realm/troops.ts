/**
 * 전장의 머릿수 — 사람 수를 병사 그림 수로 바꾸는 한 가지 잣대 (형 11-01: "1000명이건 100명이건 눈에 보이는게 의미없다고 생각이들면 전투판을 안봐").
 *
 * 돈처럼 세 단위: 작은 병사 하나 = 10명 · 큰 병사(2배) 하나 = 100명 · 깃발 든 병사 하나 = 1000명.
 * 340명이면 큰 병사 셋 + 작은 병사 넷 — 세어 보면 그대로 숫자가 된다. 잣대는 어느 싸움이든 같다 (전엔 큰 쪽 군대에 맞춰 판마다 달랐다).
 * 그림이 너무 많아지면(폰) 잣대는 그대로 두고 맨 아랫자리만 반올림해 버린다 — 큰 병사·깃발 병사 수는 늘 맞는다. 정확한 수는 무리마다 숫자로 곁에 뜬다.
 *
 * 쓰러질 때는 작은 병사부터, 다 쓰러지면 큰 병사가 — 사람 수가 줄면 그림도 줄기만 한다 (한 번 쓰러진 병사가 다시 일어나지 않는다).
 * 순수 함수만 — 화면(battlefield.ts)이 읽어 그린다.
 */

/** 단위마다 사람 수 — 작은 병사 · 큰 병사 · 깃발 병사 */
export const TIER_MEN = [10, 100, 1000] as const
export type Tier = 0 | 1 | 2
export type Tiers = readonly [number, number, number]

/** 공격(0)·지킴(1) 가운데 어느 쪽이 우리인가 — 싸움의 기록(start.men·mix·heroes)은 늘 [공격, 지킴] 순이다 */
export function sideIdx(weAtk: boolean): { readonly us: 0 | 1; readonly foe: 0 | 1 } {
  return weAtk ? { us: 0, foe: 1 } : { us: 1, foe: 0 }
}

/**
 * 사람 수 → 단위마다 병사 그림 수. prec — 반올림해 버리는 아랫자리 (0: 10명까지 · 1: 100명까지 · 2: 1000명까지).
 * 한 명이라도 있으면 그림은 하나는 선다 (형 10-28: "1명이라도 있으면 그 군대 유닛 1기 반드시").
 */
export function tierCounts(men: number, prec: Tier = 0): [number, number, number] {
  if (!(men > 0)) return [0, 0, 0]
  const u = Math.round(men / TIER_MEN[prec]!)
  if (u <= 0) return [1, 0, 0]
  const out: [number, number, number] = [0, 0, 0]
  let rest = u
  for (let t = prec; t < 2; t++) {
    out[t] = rest % 10
    rest = Math.floor(rest / 10)
  }
  out[2] += rest
  return out
}

export const tierTotal = (c: Tiers): number => c[0] + c[1] + c[2]
export const tierValue = (c: Tiers): number => c[0] * TIER_MEN[0] + c[1] * TIER_MEN[1] + c[2] * TIER_MEN[2]

/**
 * 처음 start 명이던 무리가 left 명 남았을 때 단위마다 서 있는 그림 수.
 * 잃은 몫만큼 작은 병사부터 쓰러지고, 작은 병사가 다 쓰러져야 큰 병사가 쓰러진다 — left 가 줄면 어느 단위도 늘지 않는다.
 * 한 명이라도 남았으면 그림 하나는 선다 (가장 큰 단위 하나).
 */
export function tierStanding(c: Tiers, start: number, left: number): [number, number, number] {
  const out: [number, number, number] = [c[0], c[1], c[2]]
  if (!(start > 0) || tierTotal(c) === 0) return out
  if (!(left > 0)) return [0, 0, 0]
  if (left >= start) return out
  const V = tierValue(c)
  let lost = V - (V * left) / start
  for (let t = 0; t < 3; t++) {
    if (out[t] === 0) continue
    const fall = Math.min(out[t]!, Math.max(0, Math.round(lost / TIER_MEN[t]!)))
    out[t] = out[t]! - fall
    lost -= fall * TIER_MEN[t]!
    if (out[t]! > 0) break
  }
  if (tierTotal(out) === 0) {
    const top = c[2] > 0 ? 2 : c[1] > 0 ? 1 : 0
    out[top] = 1
  }
  return out
}

/**
 * 한 싸움의 아랫자리 — 두 쪽 다 그림이 cap 을 넘지 않는 가장 고운 자리. 두 쪽이 같은 자리를 쓴다 (잣대는 판 안에서 하나).
 * sides: 쪽마다 병종별 사람 수의 목록 (원군은 따로 센 몫도 그 목록에 넣는다).
 */
export function tierPrec(sides: readonly (readonly number[])[], cap: number): Tier {
  for (const p of [0, 1, 2] as const) {
    if (sides.every((ks) => ks.reduce((s, v) => s + tierTotal(tierCounts(v, p)), 0) <= cap)) return p
  }
  return 2
}
