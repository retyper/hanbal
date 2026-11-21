/**
 * 56-C 목책 (11-21 형: 「3스테이지 목책이 오브젝트도 아니라서 다 그림 밟고 온다」) — 목책 돌파 판을 가로지르는 진짜 목책.
 * 판의 셈 쪽(결정론 · DOM·난수·시계 없음). 수치는 HAEBI_PALISADE.
 *
 * 줄은 판 폭을 빈틈없이 덮는 마디들이다(왼쪽부터 차례 · 문은 두 마디 폭). 마디마다 발밑 띠 [y-depth, y+depth] × [x0, x1] 상자.
 * 성한 마디(hp > 0)는 반지름 r 인 몸을 띠+r 안으로 못 들이고, 부서진 마디와 열린 문은 지나간다.
 * 막힘은 지나간 길로 잰다(한 걸음이 아무리 커도 뚫고 지나가지 못한다): 길이 띠 안을 지나는 가로 구간 ± r 이 성한 마디와 겹치면 막힘.
 */
import { HAEBI_RUN as C, HAEBI_PALISADE as W } from '../tune/params.ts'
import { overlaps, type Shape } from './giant-core.ts'

/** 목책 한 마디 — w 말뚝 마디 · o 열린 문(늘 지나감) · g 큰 문(마지막 문) · flash 맞은 번쩍 남은 초 · hitAt·brokenAt 판 초 */
export interface WallPiece { kind: 'w' | 'o' | 'g'; x0: number; x1: number; hp: number; max: number; flash: number; hitAt?: number; brokenAt?: number }
/** y 줄의 발 자리 · bashCd 장수가 다시 내려치기까지 · gateBrokenAt 큰 문(마지막 문)이 부서진 판 초 */
export interface Palisade { y: number; pieces: WallPiece[]; bashCd: number; gateBrokenAt?: number }

/** 판 폭을 layout 의 마디 수로 나눠 빈틈없이 세운다 (문은 두 마디) */
export function createPalisade(): Palisade {
  const kinds = [...W.layout] as WallPiece['kind'][], units = kinds.reduce((n, k) => n + (k === 'w' ? 1 : 2), 0), unit = C.width / units
  const pieces: WallPiece[] = []
  let at = 0
  for (const kind of kinds) {
    const hp = kind === 'w' ? W.wallHp : kind === 'g' ? W.gateHp : 0, next = at + (kind === 'w' ? 1 : 2)
    pieces.push({ kind, x0: at * unit, x1: next * unit, hp, max: hp, flash: 0 })
    at = next
  }
  return { y: W.y, pieces, bashCd: 0 }
}
/** 마지막 문(가운데 큰 문)이 부서졌나 — 거대 보스를 이을 자리 (56-C · 지금은 알리기만) */
export const lastGateBroken = (P: Palisade | undefined) => P?.gateBrokenAt !== undefined
/** 막는 띠의 반 두께 + 몸 반지름 */
const band = (r: number) => W.depth + r

/** 가로 구간 (a, b) 와 겹치는 성한 마디 — 여럿이면 구간 가운데에 가장 가까운 것 */
function blockedIn(P: Palisade, a: number, b: number): WallPiece | null {
  let best: WallPiece | null = null, bd = Infinity
  const mid = (a + b) / 2
  for (const p of P.pieces) if (p.hp > 0 && p.x0 < b && p.x1 > a) { const d = Math.abs((p.x0 + p.x1) / 2 - mid); if (d < bd) { bd = d; best = p } }
  return best
}
/** (ax,ay)→(bx,by) 를 반지름 r 인 몸이 지날 때 막는 성한 마디 (없으면 null) — 띠 가장자리에 딱 붙어 미끄러지는 것은 막지 않는다 */
export function sweepWall(P: Palisade, ax: number, ay: number, bx: number, by: number, r: number): WallPiece | null {
  const h = band(r), lo = P.y - h, hi = P.y + h
  if (ay <= lo && by <= lo || ay >= hi && by >= hi) return null
  let t0 = 0, t1 = 1
  const dy = by - ay
  if (dy !== 0) {
    let ta = (lo - ay) / dy, tb = (hi - ay) / dy
    if (ta > tb) { const t = ta; ta = tb; tb = t }
    t0 = Math.max(0, ta); t1 = Math.min(1, tb)
    if (t0 > t1) return null
  }
  const xa = ax + (bx - ax) * t0, xb = ax + (bx - ax) * t1
  return blockedIn(P, Math.min(xa, xb) - r, Math.max(xa, xb) + r)
}
/** x 가 든 열린 곳(이어진 지나가는 마디들)의 [왼, 오른] — 판마다 다시 쓰는 그릇 (반지름 r 이 들어갈 폭이 없으면 false) */
const GAP = { a: 0, b: 0 }
function openingAt(P: Palisade, x: number, r: number): boolean {
  const ps = P.pieces
  let i = 0
  while (i < ps.length - 1 && x >= ps[i]!.x1) i++
  if (ps[i]!.hp > 0) return false
  let a = i, b = i
  while (a > 0 && ps[a - 1]!.hp <= 0) a--
  while (b < ps.length - 1 && ps[b + 1]!.hp <= 0) b++
  GAP.a = ps[a]!.x0; GAP.b = ps[b]!.x1
  return GAP.b - GAP.a >= 2 * r
}
/**
 * 움직인 뒤 자리를 고친다 — (x0,y0) 에서 o 로 왔는데 성한 마디가 막으면:
 *  띠 밖에서 왔으면 온 쪽 띠 가장자리에 세운다(가로로는 그대로 미끄러진다) · 띠 안(열린 곳)에서 왔으면 그 열린 곳 안으로 가로를 묶는다 ·
 *  막힌 마디 안에 있었으면(갓 태어남 · 순간 이동) 가까운 쪽 밖으로. 막은 마디를 돌려준다(없으면 null · 자리 그대로).
 */
export function wallMove(P: Palisade, o: { x: number; y: number }, x0: number, y0: number, r: number): WallPiece | null {
  const piece = sweepWall(P, x0, y0, o.x, o.y, r)
  if (!piece) return null
  const h = band(r)
  if (Math.abs(y0 - P.y) >= h) { o.y = y0 < P.y ? P.y - h : P.y + h; return piece }
  if (openingAt(P, x0, r)) { o.x = Math.max(GAP.a + r, Math.min(GAP.b - r, o.x)); return piece }
  o.y = y0 < P.y ? P.y - h : P.y + h
  return piece
}
/** 제자리 고치기 (갓 태어난 적 · 순간 이동한 장수) — 성한 마디 띠 안이면 가까운 쪽 밖으로 */
export const wallSettle = (P: Palisade, o: { x: number; y: number }, r: number) => wallMove(P, o, o.x, o.y, r)
/**
 * 적이 (tx,ty) 로 곧게 못 가면 거쳐 갈 자리를 out 에 적고 true — 길(적→문→쫓는 자리)이 가장 짧은 열린 곳(문 · 부서진 마디)을 골라,
 * 아직 그 문 앞이 아니면 이쪽 띠 밖의 문 앞 자리로 · 문 앞(문 안쪽 x)이면 곧게 줄 너머로 · 띠 안(문 속)이면 쫓는 쪽 너머로.
 * 걸음마다 다시 재므로 문을 지나면 곧게 쫓는다 (길 찾기 없음 · 마디 수만큼만 돈다).
 */
export function wallAim(P: Palisade, ex: number, ey: number, tx: number, ty: number, r: number, out: { x: number; y: number }): boolean {
  if (!sweepWall(P, ex, ey, tx, ty, r)) return false
  const h = band(r), m = W.aimMargin, inBand = Math.abs(ey - P.y) < h
  const far = (inBand ? ty < P.y : ey >= P.y) ? P.y - h - m : P.y + h + m, near = ey < P.y ? P.y - h - m : P.y + h + m
  if (inBand && openingAt(P, ex, r + m)) { out.x = Math.max(GAP.a + r + m, Math.min(GAP.b - r - m, ex)); out.y = far; return true }
  let best = Infinity, ba = 0, bb = 0
  const ps = P.pieces
  for (let i = 0; i < ps.length; i++) {
    if (ps[i]!.hp > 0 || i > 0 && ps[i - 1]!.hp <= 0) continue
    let j = i; while (j < ps.length - 1 && ps[j + 1]!.hp <= 0) j++
    const a = ps[i]!.x0 + r + m, b = ps[j]!.x1 - r - m
    if (b < a) continue
    const gx = Math.max(a, Math.min(b, ex)), cost = Math.hypot(ex - gx, ey - P.y) + Math.hypot(tx - gx, ty - P.y)
    if (cost < best) { best = cost; ba = a; bb = b }
  }
  if (best === Infinity) return false
  if (ex >= ba && ex <= bb) { out.x = ex; out.y = far } else { out.x = Math.max(ba, Math.min(bb, ex)); out.y = inBand ? far : near }
  return true
}
/** 마디를 깎는다 — 부서지면 true (큰 문이면 gateBrokenAt 을 적는다) */
export function damagePiece(P: Palisade, p: WallPiece, amount: number, t: number): boolean {
  if (p.hp <= 0 || !(amount > 0)) return false
  p.hp = Math.max(0, p.hp - amount); p.flash = W.flash; p.hitAt = t
  if (p.hp > 0) return false
  p.brokenAt = t
  if (p.kind === 'g' && P.gateBrokenAt === undefined) P.gateBrokenAt = t
  return true
}
/** 판 시계에 맞춰 번쩍·내려치기 틈을 줄인다 */
export function tickPalisade(P: Palisade, dt: number) {
  P.bashCd = Math.max(0, P.bashCd - dt)
  for (const p of P.pieces) if (p.flash > 0) p.flash = Math.max(0, p.flash - dt)
}
/** 마디의 발밑 상자 (공격 모양과 겹치는지 잴 때) */
export const pieceBox = (P: Palisade, p: WallPiece): Shape => ({ kind: 'box', center: { x: (p.x0 + p.x1) / 2, y: P.y }, halfX: (p.x1 - p.x0) / 2, halfY: W.depth, angle: 0 })
/** 모양을 덮는 원 (멀리 있는 마디를 값싸게 거른다) */
function reach(shape: Shape): { x: number; y: number; r: number } | null {
  switch (shape.kind) {
    case 'circle': case 'cone': case 'diskCap': return { x: shape.center.x, y: shape.center.y, r: shape.radius }
    case 'box': return { x: shape.center.x, y: shape.center.y, r: Math.hypot(shape.halfX, shape.halfY) }
    default: return null
  }
}
/** 한 모양(원 · 부채 · 반원 · 띠 상자)이 마디에 닿나 — 덮는 원으로 먼저 거르고, 원이 아니면 겹침 셈. 닿으면 닿은 가로 자리 */
function touchX(P: Palisade, p: WallPiece, shape: Shape): number | null {
  const c = reach(shape); if (!c) return null
  const dx = Math.max(p.x0 - c.x, 0, c.x - p.x1), dy = Math.max(Math.abs(c.y - P.y) - W.depth, 0)
  if (dx * dx + dy * dy > c.r * c.r) return null
  if (shape.kind !== 'circle' && !overlaps(shape, pieceBox(P, p))) return null
  return Math.max(p.x0, Math.min(p.x1, c.x))
}
/** 공격 하나의 모양에 닿는 성한 마디마다 f 를 한 번 (닿은 가로 자리와 함께 · 여러 조각 모양도 마디마다 한 번) */
export function piecesHit(P: Palisade, shape: Shape, f: (p: WallPiece, x: number) => void) {
  const parts = shape.kind === 'union' ? shape.shapes : [shape]
  for (const p of P.pieces) {
    if (p.hp <= 0) continue
    for (const part of parts) { const x = touchX(P, p, part); if (x !== null) { f(p, x); break } }
  }
}
