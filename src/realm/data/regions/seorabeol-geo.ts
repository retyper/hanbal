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
  // 앞바다 작은 섬 — 왜인이 머무는 곳 (지음 · 바탕 그림에도 그려 넣었다)
  lands: SOUTH_LANDS, isles: [...SOUTH_ISLES, [[129.555, 35.825], [129.605, 35.825], [129.605, 35.775], [129.555, 35.775]]], rivers: SOUTH_RIVERS,
  scale: 2.5,
  // 판만의 그림 — 조각을 두 배 반으로 늘리면 흐릿했다 (형 10-25) · 같은 틀을 제미나이가 또렷하게 다시 그렸다(2048×1804)
  base: 'map-seorabeol/base.webp',
})

/** 3장의 고을 자리 [경도, 위도] */
export function seoraGeo(id: string): readonly [number, number] | undefined {
  return SEORA_PLACES[id]
}
