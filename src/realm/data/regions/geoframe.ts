/**
 * 넓어지는 지도의 틀 — 조각 그림을 이어 붙인 판(삼한 남부 · 삼한과 북녘)이 함께 쓰는 꼴 (docs/realm/WORLD-MAP.md §1)
 *
 * 판마다 경위도 틀 · 조각 · 뭍 · 섬 · 강을 한 묶음(WorldGeo)으로 둔다. 화면(mapgeo · mapview · worldmap)은 이 묶음만 읽는다.
 * 판(realm 상태)의 셈에는 안 쓴다 — 시험이 고을이 뭍 위에 있는지 본다.
 */

export type LL = readonly [number, number]

/** 조각 — 그림 파일 · 경위도 틀 · 앞 조각과 겹친 띠(섞는 쪽) */
export interface WorldTile {
  readonly file: string
  readonly lon0: number; readonly lon1: number; readonly lat0: number; readonly lat1: number
  /** 이 조각의 가장자리 가운데 앞 조각과 겹친 띠의 너비(도) — 그 띠는 서서히 비친다 */
  readonly fade: { readonly e?: number; readonly w?: number; readonly s?: number }
}

export interface WorldRiver { readonly name: string; readonly w: number; readonly pts: readonly LL[] }

export interface WorldGeo {
  /** 판의 틀 — 경도 lon0..lon1 이 가로 0..1, 위도 lat1..lat0 이 세로 0..1 */
  readonly proj: { readonly lon0: number; readonly lon1: number; readonly lat0: number; readonly lat1: number }
  /** 앞에서부터 차례로 깐다 — 뒤 조각이 겹친 띠에서 앞 조각을 서서히 덮는다 */
  readonly tiles: readonly WorldTile[]
  /** 뭍 — 조각마다의 뭍을 겹쳐 둔다 (합친 것이 뭍) */
  readonly lands: readonly (readonly LL[])[]
  readonly isles: readonly (readonly LL[])[]
  /** 강 — 이름 · 굵기(1536 폭 기준) · 물길 */
  readonly rivers: readonly WorldRiver[]
  /** 바탕 캔버스의 배율 — 조각 눈금(1024px = 경도 2.9°)의 몇 배로 잇나. 큰 판은 폰 메모리를 위해 줄인다 */
  readonly scale: number
  /** 경위도 → 판 위 비율 */
  pos(lon: number, lat: number): readonly [number, number]
  /** 이 경위도가 뭍(또는 섬) 위인가 */
  onLand(lon: number, lat: number): boolean
}

/** 점이 다각형 안에 있나 (짝홀 규칙) */
export function inside(p: LL, poly: readonly LL[]): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!
    const [xj, yj] = poly[j]!
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

export function makeWorldGeo(g: Omit<WorldGeo, 'pos' | 'onLand'>): WorldGeo {
  const P = g.proj
  return {
    ...g,
    pos: (lon, lat) => [(lon - P.lon0) / (P.lon1 - P.lon0), (P.lat1 - lat) / (P.lat1 - P.lat0)],
    onLand: (lon, lat) => g.lands.some((l) => inside([lon, lat], l)) || g.isles.some((l) => inside([lon, lat], l)),
  }
}
