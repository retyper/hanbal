/**
 * 장수 열전은 장수마다 본편 한 달에 한 번 (형 11-19 「그래야 자연스럽게 한 달에 장수들 열전 다 하고 다음 달 할 거 같아」).
 *
 * 기록은 판(Realm.raidRuns)에 둔다: 장수 id → 나간 턴(t) · 그 턴에 나간 횟수(n). 판마다 따로다.
 *  - 출전 단추를 눌러 열전 판이 시작된 때 센다 (중간에 나가도 그 달은 쓴 것 · raid-main.ts → app.ts 'hanbal.raid.start')
 *  - 턴이 바뀌면(다음 달) 옛 기록은 저절로 안 맞아 풀린다. 옛 계절 시계 판은 한 턴 = 한 계절이라 한 계절에 한 번이다
 *  - 판의 셈(sim)은 이 기록을 읽지 않는다 (A1). 화면이 읽어 단추를 잠그고 추천에서 뺀다
 */
import type { Realm } from './types.ts'
import { P } from '../tune/params.ts'

/** 한 장수가 한 달에 나갈 수 있는 횟수 (params raidPerMonth · 적어도 1) */
export const raidCap = (): number => Math.max(1, Math.round(P.realm.raidPerMonth))

/** 이번 턴에 이 장수가 열전에 나간 횟수 — 옛 저장·깨진 칸은 0 */
export function raidUsed(r: Pick<Realm, 'season' | 'raidRuns'>, id: string): number {
  const book = r.raidRuns
  if (book === null || typeof book !== 'object') return 0
  const e = book[id]
  return e !== undefined && e !== null && e.t === r.season && typeof e.n === 'number' && e.n > 0 ? e.n : 0
}

/** 이번 턴에 이 장수로 열전에 더 나갈 수 있나 */
export const raidOpen = (r: Pick<Realm, 'season' | 'raidRuns'>, id: string): boolean => raidUsed(r, id) < raidCap()

/** 이 장수가 이번 턴에 열전에 나갔다 — 지난 턴 기록은 걷어 낸다 (판이 끝없이 불지 않게) */
export function markRaid(r: Realm, id: string): void {
  const n = raidUsed(r, id) + 1
  const keep: Record<string, { t: number; n: number }> = {}
  const book = r.raidRuns !== null && typeof r.raidRuns === 'object' ? r.raidRuns : {}
  for (const [k, e] of Object.entries(book)) if (e !== null && typeof e === 'object' && e.t === r.season) keep[k] = { t: e.t, n: e.n }
  keep[id] = { t: r.season, n }
  r.raidRuns = keep
}
