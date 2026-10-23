/**
 * 캠페인 2장의 땅 — 혼강·압록 윗줄기에서 두만강 아래까지 (jumong.ts).
 * 삼한과 북녘 판의 조각·뭍·강을 그대로 쓰고 틀만 좁힌다 — 그림이 같아 판을 옮겨도 땅이 같다.
 * 틀은 경도 5.3° × 위도 2.25° — 조각 눈금(1024px = 2.9°) 그대로 (scale 1)
 */
import { makeWorldGeo, type WorldGeo } from './geoframe.ts'
import { WORLD_ISLES, WORLD_LANDS, WORLD_RIVERS, WORLD_TILES } from './world-geo.ts'
import { JUMONG_PLACES } from './jumong.ts'

export const JUMONG_PROJ = { lon0: 124.7, lon1: 130.0, lat0: 40.7, lat1: 42.95 } as const

export const JUMONG_WORLD: WorldGeo = makeWorldGeo({
  proj: JUMONG_PROJ,
  tiles: WORLD_TILES.filter((t) => t.lon1 > JUMONG_PROJ.lon0 && t.lon0 < JUMONG_PROJ.lon1 && t.lat1 > JUMONG_PROJ.lat0 && t.lat0 < JUMONG_PROJ.lat1),
  lands: WORLD_LANDS, isles: WORLD_ISLES, rivers: WORLD_RIVERS,
  scale: 1,
})

/** 2장의 고을 자리 [경도, 위도] */
export function jumongGeo(id: string): readonly [number, number] | undefined {
  return JUMONG_PLACES[id]
}
