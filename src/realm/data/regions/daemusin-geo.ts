/**
 * 캠페인 5장의 땅 — 압록강 골짜기 국내에서 송화강 가 부여까지 (daemusin.ts).
 * 삼한과 북녘 판의 조각·뭍·강을 그대로 쓰고 틀만 좁힌다 — 2장 주몽과 같은 눈금(scale 1).
 * 틀은 경도 2.4° × 위도 3.3° (세로로 긴 판 — 남에서 북으로 쳐 올라간다)
 */
import { makeWorldGeo, type WorldGeo } from './geoframe.ts'
import { WORLD_ISLES, WORLD_LANDS, WORLD_RIVERS, WORLD_TILES } from './world-geo.ts'
import { DAEMUSIN_PLACES } from './daemusin.ts'

export const DAEMUSIN_PROJ = { lon0: 125.1, lon1: 127.5, lat0: 40.85, lat1: 44.15 } as const

export const DAEMUSIN_WORLD: WorldGeo = makeWorldGeo({
  proj: DAEMUSIN_PROJ,
  tiles: WORLD_TILES.filter((t) => t.lon1 > DAEMUSIN_PROJ.lon0 && t.lon0 < DAEMUSIN_PROJ.lon1 && t.lat1 > DAEMUSIN_PROJ.lat0 && t.lat0 < DAEMUSIN_PROJ.lat1),
  lands: WORLD_LANDS, isles: WORLD_ISLES, rivers: WORLD_RIVERS,
  scale: 1,
})

/** 5장의 고을 자리 [경도, 위도] */
export function daemusinGeo(id: string): readonly [number, number] | undefined {
  return DAEMUSIN_PLACES[id]
}
