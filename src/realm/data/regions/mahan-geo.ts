/**
 * 캠페인 1장의 땅 — 한강 아래에서 차령 남쪽까지 (mahan.ts).
 * 삼한 남부 판의 조각·뭍·강을 그대로 쓰고 틀만 좁힌다 — 그림이 같아 판을 옮겨도 땅이 같다.
 * 틀은 경도 1.3° × 위도 1.35° — 조각 눈금(1024px = 2.9°)의 두 배로 잇는다(scale 2, 배우는 판과 같다)
 */
import { makeWorldGeo, type WorldGeo } from './geoframe.ts'
import { SOUTH_ISLES, SOUTH_LANDS, SOUTH_RIVERS, SOUTH_TILES } from './south-geo.ts'
import { MAHAN_PLACES } from './mahan.ts'

export const MAHAN_PROJ = { lon0: 126.45, lon1: 127.75, lat0: 36.45, lat1: 37.8 } as const

export const MAHAN_WORLD: WorldGeo = makeWorldGeo({
  proj: MAHAN_PROJ,
  tiles: SOUTH_TILES.filter((t) => t.lon1 > MAHAN_PROJ.lon0 && t.lon0 < MAHAN_PROJ.lon1 && t.lat1 > MAHAN_PROJ.lat0 && t.lat0 < MAHAN_PROJ.lat1),
  lands: SOUTH_LANDS, isles: SOUTH_ISLES, rivers: SOUTH_RIVERS,
  scale: 2,
})

/** 1장의 고을 자리 [경도, 위도] */
export function mahanGeo(id: string): readonly [number, number] | undefined {
  return MAHAN_PLACES[id]
}
