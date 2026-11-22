/**
 * 59-WIDE 넓은 맵의 땅 셈 (docs/realm/RAID-REWARD-MAP-20261122.md 4장) — 판의 셈 쪽(결정론 · DOM·시계·난수 없음 · 난수는 부르는 쪽이 판의 씨앗에서 뽑아 넘긴다). 수치는 HAEBI_WIDE.
 *
 * 세계는 원래 판(0~width × 0~height · 「결전장」)을 가운데 칸으로 둔 screens × screens 장이다. 원래 판의 좌표는 그대로다.
 * 「안개 문」(gate 0~1)이 닫히면 설 수 있는 땅이 세계에서 결전장으로 줄어든다. 그 땅의 네 끝을 WideState 가 걸음마다 들고 있다.
 * 넓은 맵이 아닌 판(옛 기록 · 시련 · 선봉)은 WideState 가 없고, 설 수 있는 땅은 늘 원래 판(BOARD)이다.
 */
import { HAEBI_RUN as C, HAEBI_WIDE as W } from '../tune/params.ts'

export interface Rect { left: number; top: number; right: number; bottom: number }
/** gate: 안개 문 (0 = 열림 · 1 = 결전장까지 닫힘) · left~bottom: 지금 설 수 있는 땅 · warned: 닫히기 시작했다고 알린 문(0 없음 · 1 중간 보스 · 2 끝 보스) */
export interface WideState extends Rect { gate: number; warned: 0 | 1 | 2 }

/** 원래 판 = 결전장 */
export const BOARD: Readonly<Rect> = Object.freeze({ left: 0, top: 0, right: C.width, bottom: C.height })
const side = (W.screens - 1) / 2
/** 넓은 맵의 세계 */
export const WORLD: Readonly<Rect> = Object.freeze({ left: -C.width * side, top: -C.height * side, right: C.width * (1 + side), bottom: C.height * (1 + side) })

export const newWide = (): WideState => ({ gate: 0, warned: 0, left: WORLD.left, top: WORLD.top, right: WORLD.right, bottom: WORLD.bottom })
/** 지금 설 수 있는 땅 — 넓은 맵이 아니면 원래 판 */
export const fieldBounds = (s: { wide?: WideState }): Readonly<Rect> => s.wide ?? BOARD
/** 세계 전체 (날아가는 것이 사라지는 끝) — 넓은 맵이 아니면 원래 판 */
export const worldBounds = (s: { wide?: WideState }): Readonly<Rect> => s.wide ? WORLD : BOARD

/**
 * 안개 문을 한 걸음 — t 판 시각 · midAt 중간 보스 때(없거나 이미 쓰러졌으면 null) · finalAt 끝 보스 때.
 * 보스 gateWarn 초 전부터 시간에 맞춰 닫히고(보스 때에 꼭 결전장과 같아진다), 닫을 까닭이 없어지면 gateOpen 초에 걸쳐 열린다.
 * 방금 닫히기 시작했으면 그 문(1 중간 · 2 끝)을 돌려준다 (부르는 쪽이 알린다) · 아니면 0.
 */
export function stepGate(w: WideState, t: number, dt: number, midAt: number | null, finalAt: number): 0 | 1 | 2 {
  const share = (at: number | null) => at === null ? 0 : Math.max(0, Math.min(1, (t - (at - W.gateWarn)) / W.gateWarn))
  const closing = t >= finalAt - W.gateWarn ? 2 : midAt !== null && t >= midAt - W.gateWarn ? 1 : 0
  // 중간 보스를 못 잡은 채 끝 보스 때가 와도 닫힌 채로 (둘 중 더 닫힌 쪽)
  const want = Math.max(share(midAt), share(finalAt))
  w.gate = want >= w.gate ? want : Math.max(want, w.gate - dt / W.gateOpen)
  w.left = WORLD.left + (BOARD.left - WORLD.left) * w.gate; w.top = WORLD.top + (BOARD.top - WORLD.top) * w.gate
  w.right = WORLD.right + (BOARD.right - WORLD.right) * w.gate; w.bottom = WORLD.bottom + (BOARD.bottom - WORLD.bottom) * w.gate
  if (!closing) { w.warned = 0; return 0 }
  if (w.warned >= closing) return 0
  w.warned = closing; return closing
}

/** 장수의 화면(1배 · 판 한 장 크기)을 지금 땅 안에 놓는다 — 실제 카메라는 읽지 않는다(앞서 보기·확대는 화면 쪽 일 · 판은 이 틀로만 「화면 안팎」을 가린다) */
export function simView(s: { x: number; y: number; wide?: WideState }, out: Rect): Rect {
  const f = fieldBounds(s), hw = C.width / 2, hh = C.height / 2
  const cx = f.right - f.left <= C.width ? (f.left + f.right) / 2 : Math.max(f.left + hw, Math.min(f.right - hw, s.x))
  const cy = f.bottom - f.top <= C.height ? (f.top + f.bottom) / 2 : Math.max(f.top + hh, Math.min(f.bottom - hh, s.y))
  out.left = cx - hw; out.right = cx + hw; out.top = cy - hh; out.bottom = cy + hh
  return out
}

const VIEW: Rect = { left: 0, top: 0, right: 0, bottom: 0 }, RING: Rect = { left: 0, top: 0, right: 0, bottom: 0 }
/**
 * 적이 나오는 둘레의 한 자리를 out 에 — 장수 화면 밖 spawnMargin 띠(땅 끝에 눌리면 거기까지).
 * side 0 왼 · 1 오른 · 2 위 · 3 아래 · p 그 변 위의 자리(0~1). 고른 변이 화면 안으로 눌렸으면 맞은편 → 다른 축(p 로 고름) 차례로 바꾼다.
 * 네 변이 다 화면 안이면(안개 문이 닫힌 결전장) 고른 변 그대로 = 옛 판의 「판 가장자리」와 같은 자리.
 */
export function ringSpot(s: { x: number; y: number; wide?: WideState }, side: number, p: number, out: { x: number; y: number }) {
  const f = fieldBounds(s), v = simView(s, VIEW), m = W.spawnMargin, need = m * W.spawnOpen
  RING.left = Math.max(f.left, v.left - m); RING.right = Math.min(f.right, v.right + m); RING.top = Math.max(f.top, v.top - m); RING.bottom = Math.min(f.bottom, v.bottom + m)
  const open = [v.left - RING.left >= need, RING.right - v.right >= need, v.top - RING.top >= need, RING.bottom - v.bottom >= need]
  if (!open[side]) {
    const across = side ^ 1, other = side < 2 ? (p < .5 ? 2 : 3) : (p < .5 ? 0 : 1)
    side = open[across] ? across : open[other] ? other : open[other ^ 1] ? other ^ 1 : side
  }
  out.x = side === 0 ? RING.left + 15 : side === 1 ? RING.right - 15 : RING.left + p * (RING.right - RING.left)
  out.y = side === 2 ? RING.top + 24 : side === 3 ? RING.bottom - 15 : RING.top + 40 + p * (RING.bottom - RING.top - 55)
}

/** 큰 놈 사냥 — 정예가 나올 자리: 장수에게서 a 쪽으로 화면 huntNear~huntFar 장(u 0~1) · 땅 밖이면 그 축을 뒤집고 · 그래도 밖이면 땅 끝 안쪽에 */
export function huntSpot(s: { x: number; y: number; wide?: WideState }, a: number, u: number, out: { x: number; y: number }) {
  const f = fieldBounds(s), k = W.huntNear + (W.huntFar - W.huntNear) * u, dx = Math.cos(a) * k * C.width, dy = Math.sin(a) * k * C.height
  const lo = f.left + W.huntInset, hi = f.right - W.huntInset, top = f.top + W.huntInset, bottom = f.bottom - W.huntInset
  let x = s.x + dx, y = s.y + dy
  if (x < lo || x > hi) x = s.x - dx
  if (y < top || y > bottom) y = s.y - dy
  out.x = lo > hi ? (f.left + f.right) / 2 : Math.max(lo, Math.min(hi, x)); out.y = top > bottom ? (f.top + f.bottom) / 2 : Math.max(top, Math.min(bottom, y))
}

/** (x, y) 가 장수 화면 안으로 inset 만큼 들어와 있나 */
export function inSimView(s: { x: number; y: number; wide?: WideState }, x: number, y: number, inset = 0) {
  const v = simView(s, VIEW)
  return x >= v.left + inset && x <= v.right - inset && y >= v.top + inset && y <= v.bottom - inset
}
/** 뒤처졌나 — 장수에게서 화면 strayScreens 장 넘게 */
export const strayed = (s: { x: number; y: number }, x: number, y: number) => Math.abs(x - s.x) > C.width * W.strayScreens || Math.abs(y - s.y) > C.height * W.strayScreens
