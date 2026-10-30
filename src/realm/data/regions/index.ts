/**
 * 판 고르기 — 변한 6국 축소판 · 영남 판 · 삼한 남부 판 · 삼한과 북녘 판(넓어지는 지도)
 * (형: "사료대로 키우고 땅도 넓힘" — 2026-10-18 · "발견국가가 많아지면 확장" · "고구려도 … 꼭 넣어야함" — 2026-10-19).
 * 옛 저장은 region 이 없다 = 변한 축소판.
 */
import type { Realm, RegionId } from '../../types.ts'
import type { WorldGeo } from './geoframe.ts'
import { NATION_IDS, startRealm } from './byeonhan-mini.ts'
import { capitalOnly, keepRivals } from './rivals.ts'
import { P } from '../../../tune/params.ts'
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
import { SEORA_NATION_IDS, startSeorabeol } from './seorabeol.ts'
import { SEORA_WORLD, seoraGeo } from './seorabeol-geo.ts'
import { JUMONG_WORLD, jumongGeo } from './jumong-geo.ts'
import { startCustoms } from '../../hooks.ts'
import { fogStart } from '../../discovery.ts'

export const REGION_IDS: readonly RegionId[] = ['tutorial', 'mahan', 'jumong', 'seorabeol', 'byeonhan-mini', 'yeongnam', 'south', 'world']

/** 그 판의 고를 수 있는 나라 id */
export function regionNations(region: RegionId): readonly string[] {
  switch (region) {
    case 'yeongnam': return YEONGNAM_NATION_IDS
    case 'south': return SOUTH_NATION_IDS
    case 'world': return WORLD_NATION_IDS
    case 'tutorial': return TUTORIAL_NATION_IDS
    case 'jumong': return JUMONG_NATION_IDS
    case 'mahan': return MAHAN_NATION_IDS
    case 'seorabeol': return SEORA_NATION_IDS
    default: return NATION_IDS
  }
}

/** 판을 연다 */
export function startRegion(region: RegionId, seed: number, player: string, edit?: (r: Realm) => void): Realm {
  // 모든 판은 안개 속에서 연다 — 제 땅과 길로 맞닿은 곳만 (형 10-27 · discovery.fogStart)
  const r = openRegion(region, seed, player, edit)
  fogStart(r)
  return r
}

function openRegion(region: RegionId, seed: number, player: string, edit?: (r: Realm) => void): Realm {
  // 자유 판은 판을 열 때 풍습의 처음 것을 건다 (바닷가 여덟 나라 — hooks.startCustoms). 장(캠페인)은 짜인 대로.
  // edit — 그 앞에 판을 고친다 (짝 씨앗 도구가 나라의 풍습을 더하고 뺀다 · tools/realm-customs.ts)
  // 자유판은 늘 도읍 하나로 시작한다 (rivals.capitalOnly · 형 10-30)
  const free = (r: Realm): Realm => { capitalOnly(r); edit?.(r); startCustoms(r); return r }
  switch (region) {
    case 'yeongnam': return free(keepRivals(startYeongnam(seed, player), P.realm.yeongnamRivals))
    case 'south': return free(keepRivals(startSouth(seed, player), P.realm.southRivals))
    case 'world': return free(keepRivals(startWorld(seed, player), P.realm.worldRivals))
    case 'tutorial': return startTutorial(seed)
    case 'jumong': return startJumong(seed)
    case 'mahan': return startMahan(seed)
    case 'seorabeol': return startSeorabeol(seed)
    // 자유판마다 타국 수가 정해져 있다 — 판마다 무작위 나라, 나머지 나라 땅은 빈 땅 (rivals.ts · FOCUS.md J)
    default: return free(keepRivals(startRealm(seed, player), P.realm.miniRivals))
  }
}

/** 이 판은 어느 판인가 (옛 저장 = 변한 축소판) */
export function regionOf(r: Realm): RegionId {
  return r.region ?? 'byeonhan-mini'
}

/** 조각 지도를 이은 판(넓어지는 지도)이면 그 땅 묶음 — 아니면 null */
export function worldGeoOf(region: RegionId | undefined): WorldGeo | null {
  return region === 'south' ? SOUTH_WORLD : region === 'world' ? WORLD_GEO : region === 'tutorial' ? TUTORIAL_WORLD : region === 'jumong' ? JUMONG_WORLD : region === 'mahan' ? MAHAN_WORLD : region === 'seorabeol' ? SEORA_WORLD : null
}

/** 넓어지는 지도의 고을 자리 [경도, 위도] */
export function placeOf(region: RegionId | undefined, id: string): readonly [number, number] | undefined {
  return region === 'south' ? southGeo(id) : region === 'world' ? worldGeo(id) : region === 'tutorial' ? tutorialGeo(id) : region === 'jumong' ? jumongGeo(id) : region === 'mahan' ? mahanGeo(id) : region === 'seorabeol' ? seoraGeo(id) : undefined
}
