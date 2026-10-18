/**
 * 판 고르기 — 변한 6국 축소판 · 영남 판 · 삼한 남부 판(넓어지는 지도) (형: "사료대로 키우고 땅도 넓힘" — 2026-10-18 · "발견국가가 많아지면 확장" — 2026-10-19).
 * 옛 저장은 region 이 없다 = 변한 축소판.
 */
import type { Realm, RegionId } from '../../types.ts'
import { NATION_IDS, startRealm } from './byeonhan-mini.ts'
import { SOUTH_NATION_IDS, startSouth } from './south.ts'
import { YEONGNAM_NATION_IDS, startYeongnam } from './yeongnam.ts'

export const REGION_IDS: readonly RegionId[] = ['byeonhan-mini', 'yeongnam', 'south']

/** 그 판의 고를 수 있는 나라 id */
export function regionNations(region: RegionId): readonly string[] {
  return region === 'yeongnam' ? YEONGNAM_NATION_IDS : region === 'south' ? SOUTH_NATION_IDS : NATION_IDS
}

/** 판을 연다 */
export function startRegion(region: RegionId, seed: number, player: string): Realm {
  return region === 'yeongnam' ? startYeongnam(seed, player) : region === 'south' ? startSouth(seed, player) : startRealm(seed, player)
}

/** 이 판은 어느 판인가 (옛 저장 = 변한 축소판) */
export function regionOf(r: Realm): RegionId {
  return r.region ?? 'byeonhan-mini'
}
