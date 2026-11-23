/**
 * 덧 띠(gen-X-x.png) 한 칸이 놓일 자리 — 화면만 · 순수 함수 (열전 haebi-view.ts · 겨루기 duel/view.ts 가 같이 쓴다).
 * 본 띠 칸은 「칸 한가운데 · 발 줄(SPRITE_PX feet)」 점이 장수 자리(화면의 한 점)에 놓인다.
 * 덧 띠가 자기 규격(xGeom: 칸 높이 · 뿌리 가로 자리 · 발바닥 줄)을 가지면 그 (뿌리, 발 줄) 점이 같은 자리에 오게 놓는다.
 * 그리는 배율 k(원본 1px 당 화면 px)는 본 띠와 같다 — 몸 크기가 달라지지 않는다. 좌우 뒤집기는 뿌리(x = 0)를 축으로 한다.
 */
import type { XGeom } from './hero-idle.ts'

/** 칸 한 장이 놓일 자리 — 본 띠 칸의 (한가운데, 발 줄) 점을 (0, 0) 으로 한 화면 px · 뒤집지 않은 방향 */
export interface CellPlace { readonly left: number; readonly top: number; readonly w: number; readonly h: number }

/**
 * @param cellW 덧 띠 칸 폭(원본 px = 그림 폭 ÷ 칸 수)  @param cellH 덧 띠 그림 높이(원본 px)
 * @param k 본 띠와 같은 배율(화면 px ÷ 원본 px)  @param mainFeet 본 띠의 발 줄(칸 위에서 px · SPRITE_PX feet)
 * @param geom 덧 띠 자기 규격 — 없으면 본 띠와 같은 칸(뿌리 = 한가운데 · 발 줄 = mainFeet · 높이 = cellH)
 */
export function companionPlace(cellW: number, cellH: number, k: number, mainFeet: number, geom?: XGeom): CellPlace {
  if (!geom) return { left: -cellW * k / 2, top: -mainFeet * k, w: cellW * k, h: cellH * k }
  return { left: -geom.root * k, top: -geom.foot * k, w: cellW * k, h: geom.h * k }
}
/** 가로로 뒤집었을 때 칸의 왼쪽 모서리 (뿌리 x = 0 이 축) */
export const mirroredLeft = (p: CellPlace) => -(p.left + p.w)
/** 이 덧 띠가 본 띠보다 키우는 배율 (그림 높이 ÷ 본 띠 칸 높이 · 규격 없으면 1) — 구움 키·그림 높이를 셈할 때 */
export const companionScale = (mainCellH: number, geom?: XGeom) => geom ? geom.h / mainCellH : 1
