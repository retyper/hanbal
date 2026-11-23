/**
 * 쓰러짐 KO 연출의 셈 (화면만 · 열전 raid 와 겨루기 duel 이 같이 쓴다) — 칸 고르기 · 카메라 다가감 · 막 길이. 수치는 HAEBI_KO.
 * 판 상태는 읽지도 쓰지도 않는다: 시계(쓰러지기 시작한 뒤 초)와 칸 차례만 받는다.
 */
import { HAEBI_KO as K, HAEBI_END as E } from '../tune/params.ts'

/** 쓰러지는 칸 차례 — 띠 계획에 있으면 그것 · 없으면 맞음 18 → 누움 19 (겨루기 옛 띠는 hit → dead) */
export const fallCells = (fall?: readonly number[], hit: number = K.fall[0], dead: number = K.fall[1]): readonly number[] => fall?.length ? fall.slice(0, K.maxCells) : [hit, dead]
/** 다 쓰러지기까지 초 (칸 수 − 1) × fallStep */
export const fallTime = (cells: readonly number[]) => K.fallStep * Math.max(0, cells.length - 1)
/** 쓰러지기 시작한 뒤 t 초의 칸 — 앞 칸은 빨리 넘어가고 마지막 넘어감은 느리다 (1 − (1 − k)^ease) · t < 0(맞은 멈춤)이면 첫 칸 · 끝나면 마지막 칸 */
export function koFrame(cells: readonly number[], t: number): number {
  const n = cells.length, d = fallTime(cells)
  if (n <= 1 || !(t > 0)) return cells[0]!
  if (t >= d) return cells[n - 1]!
  const p = 1 - (1 - t / d) ** K.ease
  return cells[Math.min(n - 1, Math.floor(p * (n - 1)))]!
}
/** 카메라가 다가간 몫 0..1 (쓰러지기 시작한 뒤 t 초 · 부드럽게) · calm(움직임 줄이기)이면 0 */
export function koZoom(t: number, calm = false) {
  if (calm || !(t > 0)) return 0
  const k = Math.min(1, t / K.zoomTime)
  return k * k * (3 - 2 * k)
}
/** 열전 쓰러짐 막 길이 — 맞은 멈춤 + 가장 긴 쓰러짐(maxCells 칸) + 마지막 칸 멈춤 */
export const koDuration = () => E.defeat.freeze + K.fallStep * (K.maxCells - 1) + K.hold
/** 열전 쓰러짐의 「패배」 띠가 찍히는 막 시각 */
export const koStampAt = () => koDuration() - K.stampLead
/** 누름으로 건너뛸 수 있나 (막 시각 elapsed) */
export const koSkippable = (elapsed: number) => elapsed >= K.minSkip
