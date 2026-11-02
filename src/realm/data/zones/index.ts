/**
 * 고을 구역 — 판마다 한 번 구워 둔 고을마다의 땅 다각형 (FOCUS H · 형: "국경이 줌마다 꼬이고 작으면 사라짐").
 *
 * 구역은 고을 자리에서 산·강·뭍을 따라 갈라(tools/zonegeo.ts) 구운 것이라 판을 어떻게 열든 같다.
 * 구역의 주인 = 땅 빛 · 국경 = 주인이 다른 두 이웃 구역이 맞닿은 변. 게임은 셈하지 않고 읽기만 한다 (ui/realm/zones.ts).
 * 고을 자리·종류·길을 바꾸면 `node --experimental-strip-types tools/bake-zones.ts` 로 다시 굽는다 (tests/realm/zones.test.ts 가 낡음을 잡는다).
 */
import type { RegionId } from '../../types.ts'
import { ZONE as BYEONHAN } from './byeonhan-mini.ts'
import { ZONE as JUMONG } from './jumong.ts'
import { ZONE as MAHAN } from './mahan.ts'
import { ZONE as SEORABEOL } from './seorabeol.ts'
import { ZONE as GUJIBONG } from './gujibong.ts'
import { ZONE as DAEMUSIN } from './daemusin.ts'
import { ZONE as SOUTH } from './south.ts'
import { ZONE as TUTORIAL } from './tutorial.ts'
import { ZONE as WORLD } from './world.ts'
import { ZONE as YEONGNAM } from './yeongnam.ts'

export interface ZoneData {
  /** 구운 때의 고을 자리·종류·길 (tools/zonegeo.ts zoneHash) — 다르면 다시 구울 때 */
  readonly hash: string
  /** 그림 좌표의 판 크기 (REGION_ART 의 w·h) */
  readonly w: number
  readonly h: number
  /** 고을마다 구역 크기 배수 (구운 때의 종류) — 길 펴기(roadlayout)도 같은 값을 써서 길과 구역이 맞물린다 */
  readonly size: Readonly<Record<string, number>>
  /** 고을마다 구역 (SVG 패스 · 그림 좌표) — 땅을 못 받은 고을은 없다 */
  readonly fill: Readonly<Record<string, string>>
  /** 맞닿은 변 [고을, 이웃 고을 ('' = 바깥: 바다·빈 데), 패스] — 한 쌍의 같은 변은 한 번만 */
  readonly edge: ReadonlyArray<readonly [string, string, string]>
}

export const ZONES: Readonly<Partial<Record<RegionId, ZoneData>>> = {
  'byeonhan-mini': BYEONHAN, jumong: JUMONG, mahan: MAHAN, seorabeol: SEORABEOL, gujibong: GUJIBONG, daemusin: DAEMUSIN, south: SOUTH, tutorial: TUTORIAL, world: WORLD, yeongnam: YEONGNAM,
}
