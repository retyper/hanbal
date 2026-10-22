/**
 * 배우는 판의 땅 — 한강 아래(서울–인천)만 좁게 (형 2026-10-22: 익숙한 백제·미추홀로).
 * 삼한 남부 판의 조각·뭍·강을 그대로 쓰고 틀만 좁힌다 — 그림이 같아 판을 옮겨도 땅이 같다.
 * 틀은 경도 1.4° × 위도 0.95° — 조각 눈금(1024px = 2.9°)의 두 배로 잇는다(scale 2)
 */
import { makeWorldGeo, type WorldGeo } from './geoframe.ts'
import { SOUTH_ISLES, SOUTH_LANDS, SOUTH_RIVERS, SOUTH_TILES } from './south-geo.ts'
import { TUTORIAL_PLACES } from './tutorial.ts'

export const TUTORIAL_PROJ = { lon0: 126.3, lon1: 127.7, lat0: 37.0, lat1: 37.95 } as const

export const TUTORIAL_WORLD: WorldGeo = makeWorldGeo({
  proj: TUTORIAL_PROJ,
  tiles: SOUTH_TILES.filter((t) => t.file.startsWith('m2')),
  lands: SOUTH_LANDS, isles: SOUTH_ISLES, rivers: SOUTH_RIVERS,
  scale: 2,
})

/** 배우는 판의 고을 자리 [경도, 위도] */
export function tutorialGeo(id: string): readonly [number, number] | undefined {
  return TUTORIAL_PLACES[id]
}
