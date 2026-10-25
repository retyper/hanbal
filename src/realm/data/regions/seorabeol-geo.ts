/**
 * 캠페인 3장의 땅 — 경주 골짜기와 그 언저리 (seorabeol.ts).
 * 삼한 남부 판의 조각·뭍·강을 그대로 쓰고 틀만 좁힌다. 땅이 작아 조각 눈금의 두 배 반으로 잇는다(scale 2.5)
 * 틀은 경도 0.8° × 위도 0.65°
 */
import { makeWorldGeo, type WorldGeo } from './geoframe.ts'
import { SOUTH_ISLES, SOUTH_LANDS, SOUTH_RIVERS, SOUTH_TILES } from './south-geo.ts'
import { SEORA_PLACES } from './seorabeol.ts'

export const SEORA_PROJ = { lon0: 128.85, lon1: 129.65, lat0: 35.5, lat1: 36.15 } as const

export const SEORA_WORLD: WorldGeo = makeWorldGeo({
  proj: SEORA_PROJ,
  tiles: SOUTH_TILES.filter((t) => t.lon1 > SEORA_PROJ.lon0 && t.lon0 < SEORA_PROJ.lon1 && t.lat1 > SEORA_PROJ.lat0 && t.lat0 < SEORA_PROJ.lat1),
  lands: SOUTH_LANDS, isles: SOUTH_ISLES, rivers: SOUTH_RIVERS,
  scale: 2.5,
})

/** 3장의 고을 자리 [경도, 위도] */
export function seoraGeo(id: string): readonly [number, number] | undefined {
  return SEORA_PLACES[id]
}
