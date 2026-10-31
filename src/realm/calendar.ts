/**
 * 달력 — 턴 번호를 철·해·달로 (SYSTEMS §1-1 · §1-3 · 시간 개편 docs/realm/TIME-TABLE-1031.md)
 *
 * 판의 시계는 둘이다.
 *  - 옛 판(`clock` 없음): 한 턴 = 한 계절. `r.season` 이 계절 번호다.
 *  - 새 판(`clock: 'month'`): 한 턴 = 한 달 · 한 계절 = 석 달 (형 10-31: "한 턴에 1달"). `r.season` 은 이름은 그대로 두고 달을 센다.
 *    0 턴 = 1년 3월(봄 첫 달) · 여름 = 6·7·8월 · 장마는 7·8월 · 겨울 = 12·1·2월.
 * 철·해를 셈하는 곳은 모두 여기를 부른다 — `% 4` · `/ 4` 를 따로 셈하지 않는다.
 * 계절 단위로 적힌 수치(params)는 값을 그대로 두고, 기한·나이를 셀 때 `seasons(r, n)` 으로 턴 수로 바꾼다.
 *
 * season.ts 와 economy.ts 가 함께 쓴다. 다른 realm 파일을 부르지 않는다 (고리를 만들지 않으려고 따로 뺐다).
 */
import type { REdge, SeasonOfYear } from './types.ts'

const SEASONS: readonly SeasonOfYear[] = ['spring', 'summer', 'autumn', 'winter']

/** 시계의 갈래만 — 기간 셈에 */
export interface ClockKind {
  readonly clock?: 'month' | undefined
}

/** 판의 시계 — 판(Realm)이든 저장 머리(meta)든 `season` 과 `clock` 만 있으면 된다 */
export interface Clocked {
  readonly season: number
  readonly clock?: 'month' | undefined
}

/** 한 계절의 턴 수 — 달 시계면 석 달 */
export const MONTHS_PER_SEASON = 3

const mod = (n: number, m: number): number => ((n % m) + m) % m

/** 이 판은 달 시계인가 */
export function monthly(c: ClockKind): boolean {
  return c.clock === 'month'
}

/** 한 계절이 몇 턴인가 — 옛 판 1 · 달 시계 3 */
export function perSeason(c: ClockKind): number {
  return c.clock === 'month' ? MONTHS_PER_SEASON : 1
}

/** 계절 단위 기간(params 의 n계절)을 턴 수로 — 기한 `r.season + seasons(r, n)` · 나이 비교 `age >= seasons(r, n)` */
export function seasons(c: ClockKind, n: number): number {
  return n * perSeason(c)
}

/** 판 처음부터 센 계절 번호 (0 = 1년 봄) — 「판 처음 n계절」 같은 절대 문턱은 이것과 견준다 */
export function seasonIdx(c: Clocked, t: number = c.season): number {
  return Math.floor(t / perSeason(c))
}

/** 그 턴의 철 번호 0..3 (봄 0 · 여름 1 · 가을 2 · 겨울 3) */
export function seasonNo(c: Clocked, t: number = c.season): number {
  return mod(seasonIdx(c, t), 4)
}

/** 그 턴의 철 */
export function seasonOf(c: Clocked, t: number = c.season): SeasonOfYear {
  return SEASONS[seasonNo(c, t)]!
}

/** 그 턴의 해 — 0 이 첫해 (봄에 해가 바뀐다) */
export function yearOf(c: Clocked, t: number = c.season): number {
  return Math.floor(seasonIdx(c, t) / 4)
}

/** 그 턴의 달 1..12 — 달 시계면 0 턴이 3월 · 옛 판은 그 철의 가운데 달 (봄 4 · 여름 7 · 가을 10 · 겨울 1) */
export function monthOf(c: Clocked, t: number = c.season): number {
  const m0 = c.clock === 'month' ? mod(t, 12) : mod(t, 4) * MONTHS_PER_SEASON + 1
  return mod(m0 + 2, 12) + 1
}

/** 이 턴이 그 계절의 마지막 달인가 — 계절마다 한 번 도는 일(가을걷이 · 집 늘기 · 정 …)은 이때만. 옛 판은 늘 참 */
export function isSeasonEnd(c: Clocked, t: number = c.season): boolean {
  return c.clock !== 'month' || mod(t, MONTHS_PER_SEASON) === MONTHS_PER_SEASON - 1
}

/** 이 턴이 그 계절의 첫 달인가 — 새 계절의 사건 카드 · 계절 알림. 옛 판은 늘 참 */
export function isSeasonStart(c: Clocked, t: number = c.season): boolean {
  return c.clock !== 'month' || mod(t, MONTHS_PER_SEASON) === 0
}

/** `since` 턴부터 지난 계절 수 — 달 시계면 석 달이 1 (나눈 값 그대로 · 정보의 나이 같은 셈) */
export function ageSeasons(c: Clocked, since: number, t: number = c.season): number {
  return (t - since) / perSeason(c)
}

/** 장마 — 옛 판은 여름 내내, 달 시계는 7·8월만 (형 10-31: "장마로 막히는 건 7·8월쯤") */
export function isMonsoon(c: Clocked, t: number = c.season): boolean {
  if (c.clock !== 'month') return seasonOf(c, t) === 'summer'
  const m = monthOf(c, t)
  return m === 7 || m === 8
}

/** 그 턴에 이 길이 막혔는가 (SYSTEMS §1-1 · §1-3) — 겨울 고개 · 장마 나루 */
export function blockedWhy(ed: REdge, c: Clocked, t: number = c.season): 'winterPass' | 'summerFord' | null {
  if (ed.kind === 'pass' && seasonOf(c, t) === 'winter') return 'winterPass'
  if (ed.kind === 'ford' && isMonsoon(c, t)) return 'summerFord'
  return null
}
