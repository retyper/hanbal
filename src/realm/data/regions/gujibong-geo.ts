/**
 * 캠페인 4장의 땅 — 김해 골과 낙동강 어귀, 남쪽 큰 섬까지 (gujibong.ts).
 * 삼한 남부 판의 조각·뭍·강을 그대로 쓰고 틀만 좁힌다. 조각 눈금의 두 배로 잇는다(scale 2, 1장 마한과 같다)
 * 틀은 경도 0.9° × 위도 0.75°
 */
import { makeWorldGeo, type WorldGeo } from './geoframe.ts'
import { SOUTH_ISLES, SOUTH_LANDS, SOUTH_RIVERS, SOUTH_TILES } from './south-geo.ts'
import { GUJI_PLACES } from './gujibong.ts'

export const GUJI_PROJ = { lon0: 128.4, lon1: 129.3, lat0: 34.8, lat1: 35.55 } as const

export const GUJI_WORLD: WorldGeo = makeWorldGeo({
  proj: GUJI_PROJ,
  tiles: SOUTH_TILES.filter((t) => t.lon1 > GUJI_PROJ.lon0 && t.lon0 < GUJI_PROJ.lon1 && t.lat1 > GUJI_PROJ.lat0 && t.lat0 < GUJI_PROJ.lat1),
  lands: SOUTH_LANDS, isles: SOUTH_ISLES, rivers: SOUTH_RIVERS,
  scale: 2,
})

/** 4장의 고을 자리 [경도, 위도] */
export function gujiGeo(id: string): readonly [number, number] | undefined {
  return GUJI_PLACES[id]
}
