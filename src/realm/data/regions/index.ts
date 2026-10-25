/**
 * 판 고르기 — 변한 6국 축소판 · 영남 판 · 삼한 남부 판 · 삼한과 북녘 판(넓어지는 지도)
 * (형: "사료대로 키우고 땅도 넓힘" — 2026-10-18 · "발견국가가 많아지면 확장" · "고구려도 … 꼭 넣어야함" — 2026-10-19).
 * 옛 저장은 region 이 없다 = 변한 축소판.
 */
import type { Realm, RegionId } from '../../types.ts'
import type { WorldGeo } from './geoframe.ts'
import { NATION_IDS, startRealm } from './byeonhan-mini.ts'
import { SOUTH_WORLD } from './south-geo.ts'
import { SOUTH_NATION_IDS, southGeo, startSouth } from './south.ts'
import { WORLD_GEO } from './world-geo.ts'
import { WORLD_NATION_IDS, startWorld, worldGeo } from './world.ts'
import { YEONGNAM_NATION_IDS, startYeongnam } from './yeongnam.ts'
import { TUTORIAL_NATION_IDS, startTutorial } from './tutorial.ts'
import { TUTORIAL_WORLD, tutorialGeo } from './tutorial-geo.ts'
import { JUMONG_NATION_IDS, startJumong } from './jumong.ts'
import { MAHAN_NATION_IDS, startMahan } from './mahan.ts'
import { MAHAN_WORLD, mahanGeo } from './mahan-geo.ts'
import { JUMONG_WORLD, jumongGeo } from './jumong-geo.ts'

export const REGION_IDS: readonly RegionId[] = ['tutorial', 'mahan', 'jumong', 'byeonhan-mini', 'yeongnam', 'south', 'world']

/** 그 판의 고를 수 있는 나라 id */
export function regionNations(region: RegionId): readonly string[] {
  switch (region) {
    case 'yeongnam': return YEONGNAM_NATION_IDS
    case 'south': return SOUTH_NATION_IDS
    case 'world': return WORLD_NATION_IDS
    case 'tutorial': return TUTORIAL_NATION_IDS
    case 'jumong': return JUMONG_NATION_IDS
    case 'mahan': return MAHAN_NATION_IDS
    default: return NATION_IDS
  }
}

/** 판을 연다 */
export function startRegion(region: RegionId, seed: number, player: string): Realm {
  switch (region) {
    case 'yeongnam': return startYeongnam(seed, player)
    case 'south': return startSouth(seed, player)
    case 'world': return startWorld(seed, player)
    case 'tutorial': return startTutorial(seed)
    case 'jumong': return startJumong(seed)
    case 'mahan': return startMahan(seed)
    default: return startRealm(seed, player)
  }
}

/** 이 판은 어느 판인가 (옛 저장 = 변한 축소판) */
export function regionOf(r: Realm): RegionId {
  return r.region ?? 'byeonhan-mini'
}

/** 조각 지도를 이은 판(넓어지는 지도)이면 그 땅 묶음 — 아니면 null */
export function worldGeoOf(region: RegionId | undefined): WorldGeo | null {
  return region === 'south' ? SOUTH_WORLD : region === 'world' ? WORLD_GEO : region === 'tutorial' ? TUTORIAL_WORLD : region === 'jumong' ? JUMONG_WORLD : region === 'mahan' ? MAHAN_WORLD : null
}

/** 넓어지는 지도의 고을 자리 [경도, 위도] */
export function placeOf(region: RegionId | undefined, id: string): readonly [number, number] | undefined {
  return region === 'south' ? southGeo(id) : region === 'world' ? worldGeo(id) : region === 'tutorial' ? tutorialGeo(id) : region === 'jumong' ? jumongGeo(id) : region === 'mahan' ? mahanGeo(id) : undefined
}
