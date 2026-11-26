/**
 * 맵 — 바닥 칸 · 진영 · 조각 (docs/realm/battle-study/40-cards.md F2a · 30-integrated.md §3 첫 조각 다섯)
 *
 * 지어진 것: 대로(meet) · 개울(cross) · 목책(stake) · 기습(ambush) · 높은 터(high) + 비교용 hold(평지에서 한 편이 지킴).
 * 공성·수상·해자·토성은 mapFor 가 null 을 돌려 부르는 쪽이 「아직 안 지었다」를 알게 한다 (그림만 있고 지어진 줄 아는 일을 막는다).
 * 목책 마디·문은 열전 palisade.ts 의 마디·문 틀을 쓰지 않고 자료(Piece)만 새로 둔다 (열전 파일은 안 건드린다 · 마디 깨기는 F2b).
 * 칸 순서: cells[cu * w + cv]. 해시·기록은 cells 를 직접 훑는다 (JSON 을 거치지 않는다).
 */
import { P } from '../tune/params.ts'
import { G_BLOCK, G_DEEP, G_HIGH, G_PLAIN, G_SHALLOW, G_WOOD } from './types.ts'
import type { Camp, Deco, FieldMap, Ground, MapRule, Piece } from './types.ts'
import { idiv } from './num.ts'
import { roll } from '../core/rng.ts'

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

/** 시험판(field.html?mvp)의 대로 — 두 진영이 판 끝에서 mvpStartMarginCells 에 서서 더 멀리서 시작하고(생각할 틈) · 판이 mvpMapWidthCells 로 넓어 적 날개 바깥에 기병이 돌 길이 남는다 */
export function mvpMap(): FieldMap {
  const u = P.field.mapLenCells, w = P.field.mvpMapWidthCells, m = P.field.mvpStartMarginCells
  return { ...blank('meet', camp(m, idiv(w, 2), 1, w), camp(u - m, idiv(w, 2), -1, w)), w, cells: new Uint8Array(u * w) }
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

/** 실험실의 높은 터 — 지키는 편이 언덕 위에 선다 (높은 터가 지키는 편 앞줄보다 mvpHillFrontCells 앞에서 판 끝까지 · 옛 highMap 은 지키는 편 뒤에만 있었다) */
export function mvpHighMap(): FieldMap {
  const [c0, c1] = holdCamps()
  const map = blank('high', c0, c1, [], 1)
  fillCols(map, c1.u - P.field.mvpHillFrontCells, map.u, G_HIGH)
  return map
}

/**
 * 실험실의 목책 — 지키는 편의 앞줄이 장수 앞에 줄 맞춰 서므로(진 자리) 목책을 그 앞줄 앞 mvpStakeFromCampCells(진영 자리에서)에 세운다.
 * 옛 stakeMap 은 진영 자리 바로 앞이라 앞줄이 목책 바깥에 섰다. 마디·문은 stakeMap 과 같은 꼴.
 */
export function mvpStakeMap(): FieldMap {
  const [c0, c1] = holdCamps()
  const wallU = c1.u - P.field.mvpStakeFromCampCells
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

/** 실험실의 목책 지키기 — 우리(0)가 목책 뒤에서 지키고 적이 친다. 우리 진영 자리에서 앞(적 쪽)으로 mvpStakeFromCampCells 에 목책 줄 · 가운데 문 */
export function mvpStakeDefMap(): FieldMap {
  const u = P.field.mapLenCells, w = P.field.mapWidthCells, m = P.field.mvpStartMarginCells
  const c0 = camp(m, idiv(w, 2), 1, w), c1 = camp(u - m, idiv(w, 2), -1, w)
  const wallU = c0.u + P.field.mvpStakeFromCampCells
  const mid = idiv(w, 2), half = idiv(P.field.gateCells, 2)
  const g0 = mid - half, g1 = g0 + P.field.gateCells
  const pieces: Piece[] = [
    { id: 0, kind: 'stake', u0: wallU, v0: 0, u1: wallU + 1, v1: g0, hp: P.field.stakeHp, owner: 0 },
    { id: 1, kind: 'gate', u0: wallU, v0: g0, u1: wallU + 1, v1: g1, hp: P.field.gateHp, owner: 0 },
    { id: 2, kind: 'stake', u0: wallU, v0: g1, u1: wallU + 1, v1: w, hp: P.field.stakeHp, owner: 0 },
  ]
  const map = blank('stake', c0, c1, pieces)
  for (const p of pieces) for (let v = p.v0; v < p.v1; v++) map.cells[wallU * map.w + v] = G_BLOCK
  return map
}

/**
 * 들판(섞임) — 시험판·실험실의 처음 땅 (씨앗마다 다르게 · roll 이름 'mix:*'). 판은 시험판 대로보다 길이 mixLenPermille · 폭 mixWidthPermille 배.
 * 한 옆에 낮은 언덕(누구 것도 아니다 · 오르면 느리고 위의 활은 멀리) · 비스듬한 개울(얕은 물)과 여울 둘 · 숲 두 덩이(기병 느림 · 활 시선 막음) ·
 * 바위 덩이 몇(막힘) · 가운데는 비운다. deco 는 그리는 소품 자리(판은 안 읽는다).
 */
export function mixMap(seed: number): FieldMap {
  const F = P.field
  const U = idiv(F.mapLenCells * F.mixLenPermille, 1000), W = idiv(F.mvpMapWidthCells * F.mixWidthPermille, 1000)
  const gap = F.mapLenCells - 2 * F.mvpStartMarginCells, m = idiv(U - gap, 2)
  const c0 = camp(m, idiv(W, 2), 1, F.mvpMapWidthCells), c1 = camp(U - m, idiv(W, 2), -1, F.mvpMapWidthCells)
  const cells = new Uint8Array(U * W)
  const r = (k: string): number => roll(seed, 0, `mix:${k}`)
  const set = (cu: number, cv: number, g: Ground): void => { if (cu >= 0 && cv >= 0 && cu < U && cv < W) cells[cu * W + cv] = g }
  const get = (cu: number, cv: number): number => cu < 0 || cv < 0 || cu >= U || cv >= W ? -1 : cells[cu * W + cv]!
  const mid = idiv(U, 2)
  // 개울: 위에서 아래로 비스듬히 (기울기 ±mixStreamSlopePermille) · 가운데에서 ±mixStreamShiftCells
  const slope = (r('slope') < 0.5 ? -1 : 1) * (F.mixStreamSlopePermille / 1000) * (0.6 + 0.4 * r('slopeK'))
  const sx = mid + Math.round((r('shift') * 2 - 1) * F.mixStreamShiftCells)
  const streamU = (cv: number): number => Math.round(sx + (cv - W / 2) * slope)
  for (let cv = 0; cv < W; cv++) for (let k = 0; k < F.mixStreamCells; k++) set(streamU(cv) + k - idiv(F.mixStreamCells, 2), cv, G_SHALLOW)
  // 여울 둘: 위 반·아래 반에 하나씩 (그 줄은 평지 · 디딤돌)
  const fords = [Math.round(W * (0.2 + 0.15 * r('ford0'))), Math.round(W * (0.65 + 0.15 * r('ford1')))]
  for (const fv of fords) for (let cv = fv; cv < fv + F.mixFordCells; cv++) for (let k = -2; k <= F.mixStreamCells; k++) if (get(streamU(cv) + k - idiv(F.mixStreamCells, 2), cv) === G_SHALLOW) set(streamU(cv) + k - idiv(F.mixStreamCells, 2), cv, G_PLAIN)
  // 낮은 언덕: 한 옆(위 또는 아래) · 개울 한쪽에 (타원)
  const top = r('hillSide') < 0.5, hv = top ? F.mixHillRvCells + 1 : W - F.mixHillRvCells - 2
  const hu = mid + (r('hillU') < 0.5 ? -1 : 1) * (F.mixHillRuCells + F.mixStreamShiftCells)
  for (let cu = hu - F.mixHillRuCells; cu <= hu + F.mixHillRuCells; cu++) for (let cv = hv - F.mixHillRvCells; cv <= hv + F.mixHillRvCells; cv++) {
    const du = (cu - hu) / F.mixHillRuCells, dv = (cv - hv) / F.mixHillRvCells
    if (du * du + dv * dv <= 1 && get(cu, cv) === G_PLAIN) set(cu, cv, G_HIGH)
  }
  // 막지 않을 곳: 두 진영 시작 자리 · 가운데 너른 땅
  const keep = (cu: number, cv: number): boolean => Math.abs(cu - c0.u) < F.mixCampClearCells || Math.abs(cu - c1.u) < F.mixCampClearCells || (Math.abs(cu - mid) < F.mixOpenCells && Math.abs(cv - W / 2) < F.mixOpenCells)
  const blob = (u0: number, v0: number, rad: number, g: Ground): void => {
    for (let cu = u0 - rad; cu <= u0 + rad; cu++) for (let cv = v0 - rad; cv <= v0 + rad; cv++) {
      if ((cu - u0) * (cu - u0) + (cv - v0) * (cv - v0) > rad * rad + rad || get(cu, cv) !== G_PLAIN || keep(cu, cv)) continue
      set(cu, cv, g)
    }
  }
  // 숲 두 덩이: 언덕 반대 옆에 하나 · 진영 사이 다른 쪽에 하나
  const ov = top ? W - F.mixWoodCells - 3 : F.mixWoodCells + 2
  blob(mid + Math.round((r('wood0') * 2 - 1) * F.mixHillRuCells), ov, F.mixWoodCells, G_WOOD)
  blob(mid - Math.round((r('wood1u') * 0.5 + 0.5) * F.mixHillRuCells * (hu > mid ? 1 : -1)), Math.round(W / 2 + (top ? 1 : -1) * W * 0.18), F.mixWoodCells - 1, G_WOOD)
  // 바위 덩이: mixRockCount 개 (작은 막힘)
  // 진 사이 줄(두 진영 폭 안)에 두면 진이 바위 앞에서 서고 맞붙음이 늦어진다(봇 판 길이 85 → 117초) — 바깥 옆 띠(기병 길 안쪽)와 두 진영 뒤에만 둔다
  const half = idiv(F.mvpMapWidthCells, 2), edge = Math.max(2, idiv(W, 2) - half - 1)
  for (let i = 0; i < F.mixRockCount; i++) {
    const back = i % 2 === 1, c = i % 4 < 2 ? c0 : c1
    const u = back ? c.u - c.face * Math.round(F.mixCampClearCells + 4 + 16 * r(`rockU${i}`)) : Math.round(c0.u + (c1.u - c0.u) * (0.25 + 0.5 * r(`rockU${i}`)))
    const v = back ? Math.round(W * (0.2 + 0.6 * r(`rockV${i}`))) : (r(`rockV${i}`) < 0.5 ? edge + 1 : W - edge - 2)
    blob(u, v, back ? 1 + Math.floor(r(`rockR${i}`) * 2) : 1, G_BLOCK)
  }
  const map: FieldMap = { v: 1, u: U, w: W, cells, camps: [c0, c1], pieces: [], rule: 'meet', highOwner: -1, sidestep: true, deco: [] }
  map.deco = mixDeco(map, seed, streamU, fords, hu, hv)
  return map
}

/** 들판 소품 자리 (칸 · 소수) — 숲에 나무 · 바위 칸에 바위 · 물가에 갈대 · 여울에 디딤돌 · 언덕에 그루터기·마른 풀 · 들에 풀·꽃 · 진영 뒤에 망루·솟대 */
function mixDeco(map: FieldMap, seed: number, streamU: (cv: number) => number, fords: readonly number[], hu: number, hv: number): Deco[] {
  const F = P.field, U = map.u, W = map.w, out: Deco[] = []
  const h = (k: string): number => roll(seed, 0, `mixd:${k}`)
  const pick = <T,>(xs: readonly T[], k: string): T => xs[Math.floor(h(k) * xs.length) % xs.length]!
  const at = (cu: number, cv: number): number => cu < 0 || cv < 0 || cu >= U || cv >= W ? -1 : map.cells[cu * W + cv]!
  for (let cu = 0; cu < U; cu++) for (let cv = 0; cv < W; cv++) {
    const g = at(cu, cv), key = `${cu}:${cv}`
    if (g === G_WOOD && h(`w${key}`) < 0.42) out.push({ k: pick(['pine', 'pine', 'pine-big', 'pine-small', 'oak', 'tree-autumn'], `wt${key}`), u: cu + h(`wx${key}`), v: cv + h(`wy${key}`) })
    else if (g === G_BLOCK) {
      const lone = at(cu - 1, cv) !== G_BLOCK && at(cu, cv - 1) !== G_BLOCK
      if (lone || h(`b${key}`) < 0.5) out.push({ k: lone ? pick(['rock-big', 'rock-big', 'rock-moss'], `bk${key}`) : pick(['rock', 'rock-small', 'rock-moss'], `bk${key}`), u: cu + 0.5, v: cv + 0.8 })
    } else if (g === G_HIGH && h(`h${key}`) < 0.035) out.push({ k: pick(['stump', 'grass-dry', 'tree-dead', 'grass-dry', 'pebbles'], `hk${key}`), u: cu + h(`hx${key}`), v: cv + h(`hy${key}`) })
    else if (g === G_PLAIN) {
      const wetBy = at(cu - 1, cv) === G_SHALLOW || at(cu + 1, cv) === G_SHALLOW
      if (wetBy && h(`r${key}`) < 0.3) out.push({ k: pick(['reeds', 'cattail', 'reeds-big', 'iris', 'grass'], `rk${key}`), u: cu + h(`rx${key}`), v: cv + h(`ry${key}`) })
      else if (h(`g${key}`) < F.mixGrassPermille / 1000) out.push({ k: pick(['grass-small', 'grass', 'grass-small', 'flowers', 'flower', 'pebbles', 'grass-dry'], `gk${key}`), u: cu + h(`gx${key}`), v: cv + h(`gy${key}`) })
    }
  }
  // 여울의 디딤돌: 물이던 줄을 따라
  for (const fv of fords) for (let cv = fv; cv < fv + F.mixFordCells; cv += 2) for (let k = 0; k < F.mixStreamCells; k++) out.push({ k: `step-${1 + Math.floor(h(`s${cv}:${k}`) * 5)}`, u: streamU(cv) + k - (F.mixStreamCells >> 1) + 0.5, v: cv + 0.5 + h(`sy${cv}:${k}`) })
  // 진영 뒤 망루 하나씩 · 우리 쪽에 솟대
  const [c0, c1] = map.camps
  out.push({ k: 'watchtower', u: c0.u - c0.face * 16, v: c0.v - 20 }, { k: 'watchtower', u: c1.u - c1.face * 16, v: c1.v + 20 }, { k: 'sotdae', u: c0.u - c0.face * 12, v: c0.v + 14 })
  void hu; void hv
  return out
}
