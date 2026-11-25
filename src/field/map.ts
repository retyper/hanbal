/**
 * 맵 — 바닥 칸 · 진영 · 조각 (docs/realm/battle-study/40-cards.md F2a · 30-integrated.md §3 첫 조각 다섯)
 *
 * 지어진 것: 대로(meet) · 개울(cross) · 목책(stake) · 기습(ambush) · 높은 터(high) + 비교용 hold(평지에서 한 편이 지킴).
 * 공성·수상·해자·토성은 mapFor 가 null 을 돌려 부르는 쪽이 「아직 안 지었다」를 알게 한다 (그림만 있고 지어진 줄 아는 일을 막는다).
 * 목책 마디·문은 열전 palisade.ts 의 마디·문 틀을 쓰지 않고 자료(Piece)만 새로 둔다 (열전 파일은 안 건드린다 · 마디 깨기는 F2b).
 * 칸 순서: cells[cu * w + cv]. 해시·기록은 cells 를 직접 훑는다 (JSON 을 거치지 않는다).
 */
import { P } from '../tune/params.ts'
import { G_BLOCK, G_DEEP, G_HIGH, G_PLAIN, G_SHALLOW } from './types.ts'
import type { Camp, FieldMap, Ground, MapRule, Piece } from './types.ts'
import { idiv } from './num.ts'

const camp = (u: number, v: number, face: 1 | -1, spread: number, hold = false, over: Partial<Camp> = {}): Camp => ({ u, v, face, spread, axis: 0, hold, ...over })

function blank(rule: MapRule, c0: Camp, c1: Camp, pieces: Piece[] = [], highOwner: -1 | 0 | 1 = -1): FieldMap {
  const u = P.field.mapLenCells, w = P.field.mapWidthCells
  return { v: 1, u, w, cells: new Uint8Array(u * w), camps: [c0, c1], pieces, rule, highOwner }
}

/** 두 진영 기본 자리: 우리(0)는 왼 끝, 적(1)은 오른 끝 · 줄은 폭 전체로 퍼진다 */
function baseCamps(hold1: boolean): [Camp, Camp] {
  const u = P.field.mapLenCells, w = P.field.mapWidthCells, m = P.field.startMarginCells
  return [camp(m, idiv(w, 2), 1, w), camp(u - m, idiv(w, 2), -1, w, hold1)]
}

/** 지키는 편이 있는 맵의 진영: 치는 쪽이 지키는 쪽 앞에서 campGapCells 만큼 떨어져 시작한다 (첫 접촉 ≤ 20초) */
function holdCamps(): [Camp, Camp] {
  const [c0, c1] = baseCamps(true)
  return [{ ...c0, u: c1.u - P.field.campGapCells }, c1]
}

/** u 칸 [a, b) 의 모든 줄을 이 바닥으로 */
function fillCols(map: FieldMap, a: number, b: number, g: Ground): void {
  for (let cu = Math.max(0, a); cu < Math.min(map.u, b); cu++) map.cells.fill(g, cu * map.w, (cu + 1) * map.w)
}

/** 대로에서 만남 — 평지 · 두 진영이 양 끝 · 한가운데서 부딪힘 */
export function meetMap(): FieldMap {
  const [c0, c1] = baseCamps(false)
  return blank('meet', c0, c1)
}

/** 비교용 — 평지에서 적 편이 제자리를 지킨다 (지형의 몫을 가르는 대조군) */
export function holdMap(): FieldMap {
  const [c0, c1] = holdCamps()
  return blank('hold', c0, c1)
}

/** 개울 — 지키는 쪽 앞줄 바로 앞에 얕은 물 띠 + 여울(평지) 몇 칸. 지키는 쪽은 건너편에서 제자리를 지킨다 */
export function crossMap(): FieldMap {
  const [c0, c1] = holdCamps()
  const map = blank('cross', c0, c1)
  const far = c1.u - P.field.streamFromFrontCells
  fillCols(map, far - P.field.streamWidthCells, far, G_SHALLOW)
  const n = P.field.fordCount
  for (let i = 0; i < n; i++) {
    const cv = idiv(map.w * (2 * i + 1), 2 * n) - idiv(P.field.fordCells, 2)
    for (let cu = far - P.field.streamWidthCells; cu < far; cu++) for (let k = 0; k < P.field.fordCells; k++) {
      const v = cv + k
      if (v >= 0 && v < map.w) map.cells[cu * map.w + v] = G_PLAIN
    }
  }
  return map
}

/** 목책 — 지키는 쪽 앞에 막힘 줄 하나, 가운데에 문. 마디·문은 Piece 로 hp 를 들고 부서져야 길이 열린다 (sim 이 판의 지도 사본에서 깬다) */
export function stakeMap(): FieldMap {
  const [c0, c1] = holdCamps()
  const wallU = c1.u - P.field.stakeFromFrontCells
  const mid = idiv(P.field.mapWidthCells, 2), half = idiv(P.field.gateCells, 2)
  const g0 = mid - half, g1 = g0 + P.field.gateCells
  const pieces: Piece[] = [
    { id: 0, kind: 'stake', u0: wallU, v0: 0, u1: wallU + 1, v1: g0, hp: P.field.stakeHp, owner: 1 },
    { id: 1, kind: 'gate', u0: wallU, v0: g0, u1: wallU + 1, v1: g1, hp: P.field.gateHp, owner: 1 },
    { id: 2, kind: 'stake', u0: wallU, v0: g1, u1: wallU + 1, v1: P.field.mapWidthCells, hp: P.field.stakeHp, owner: 1 },
  ]
  const map = blank('stake', c0, c1, pieces)
  for (const p of pieces) for (let v = p.v0; v < p.v1; v++) map.cells[wallU * map.w + v] = G_BLOCK
  return map
}

/** 높은 터 — 지키는 쪽 진영 뒤쪽이 높다. 그 편은 제자리를 지키고, 위에 선 활이 세다 · 올라오는 쪽은 느리다 */
export function highMap(): FieldMap {
  const [c0, c1] = holdCamps()
  const map = blank('high', c0, c1, [], 1)
  fillCols(map, map.u - P.field.highDepthCells, map.u, G_HIGH)
  return map
}

/** 기습 — 치는 쪽(0)이 지키는 쪽(1)의 옆구리(폭 가장자리)에서 줄지어 시작한다. 먹혔으면 지키는 쪽이 잠든 채 시작 */
export function ambushMap(success: boolean): FieldMap {
  const [, c1] = baseCamps(false)
  const c0 = camp(c1.u - P.field.ambushUFromEndCells, P.field.ambushEdgeCells, 1, P.field.ambushSpreadCells, false, { axis: 1 })
  const map = blank('ambush', c0, { ...c1, asleep: success ? P.field.asleepSec : 0 })
  return map
}

/** 본편이 이미 가진 값으로 맵을 고른다 (season.ts fight() 의 값 · 22 §2). 본편 연결은 L2 이므로 시나리오가 손으로 만든다 */
export interface MapMeta {
  edgeKind: string
  nodeKind: string
  tags: { palisade?: boolean; moat?: boolean; earthwall?: boolean; highland?: boolean }
  approach: string
  ambush: 'none' | 'success' | 'fail'
  water: boolean
  field: boolean
}

/** 지어지지 않은 낱말(공성·수상·해자·토성·둘이 겹친 것)은 null — 대로로 떨어뜨리지 않는다 */
export function mapFor(meta: MapMeta): FieldMap | null {
  const t = meta.tags
  if (meta.water || t.moat || t.earthwall) return null
  const kinds = [t.palisade === true, t.highland === true, meta.ambush !== 'none', meta.edgeKind === 'ford' || meta.edgeKind === 'reeds'].filter(Boolean).length
  if (kinds > 1) return null
  if (t.palisade) return stakeMap()
  if (t.highland || meta.edgeKind === 'pass' || meta.edgeKind === 'forest') return highMap()
  if (meta.ambush !== 'none') return ambushMap(meta.ambush === 'success')
  if (meta.edgeKind === 'ford' || meta.edgeKind === 'reeds') return crossMap()
  return meetMap()
}

/**
 * (u, v) 단위 좌표의 바닥 — O(1) · 판 밖은 막힘.
 * 판 안은 [0, 칸 수 × unit - 1] 이다 (칸은 반열림). 그래야 u 를 L-1-u 로 뒤집을 때 칸과 판 끝이 정확히 뒤집힌다 (45 §1-6).
 */
export function groundAt(map: FieldMap, u: number, v: number): Ground {
  const unit = P.field.unit
  if (u < 0 || v < 0 || u >= map.u * unit || v >= map.w * unit) return G_BLOCK
  return map.cells[idiv(u, unit) * map.w + idiv(v, unit)] as Ground
}

/**
 * 진영 경계 u = b(칸 수)의 단위 점 — 경계에서 제 편 뒤쪽 첫 단위 (편 0 은 앞쪽이 +u 라 b × unit - 1 · 편 1 은 b × unit).
 * 1단위 규약 하나 (45 §1-6): u 를 L-1-u 로 뒤집고 편을 바꾸면 경계는 칸 수 - b 로, 이 점도 정확히 그 점으로 간다.
 * 앞의 목책 칸(stakeFromFrontCells)은 늘 진영 점 앞에 남는다. v 는 뒤집지 않으므로 b × unit 그대로.
 */
export function campPointU(b: number, side: 0 | 1): number {
  return b * P.field.unit - (side === 0 ? 1 : 0)
}

export const walkable = (g: Ground): boolean => g !== G_DEEP && g !== G_BLOCK
export { G_HIGH, G_SHALLOW }
