/**
 * 정수 수학 (삼각함수·부동소수 누적 없음 — 40-cards.md A-2)
 * 나눗셈은 idiv(= Math.trunc), 길이는 isqrt. 같은 씨앗이 CI 와 폰에서 같은 끝자리를 내려면 이것만 쓴다.
 */
import type { Point } from './types.ts'

/** 0 쪽으로 자르는 정수 나눗셈 (-0 을 내지 않는다). 2^31 을 넘는 값에서는 `|0`·`>>` 와 다르다 — 그쪽으로 바꾸지 말 것 */
export const idiv = (a: number, b: number): number => Math.trunc(a / b) + 0

export const clamp = (n: number, lo: number, hi: number): number => n < lo ? lo : n > hi ? hi : n

/** 두 점 사이 거리의 제곱 (정수) */
export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx, dy = ay - by
  return dx * dx + dy * dy
}

/**
 * floor(√n) — 정수 n ≥ 0 (2^53 아래). Math.sqrt 는 IEEE 로 정확히 둥글어 어느 기기에서나 같다 —
 * 그래도 결과가 정확한 정수 제곱근이 되도록 위아래로 바로잡는다.
 */
export function isqrt(n: number): number {
  if (n < 2) return n < 0 ? 0 : n
  let x = Math.floor(Math.sqrt(n))
  while (x * x > n) x--
  while ((x + 1) * (x + 1) <= n) x++
  return x
}

/** (a) 에서 (b) 쪽으로 speed 만큼 걷는다. 닿을 거리면 (b) 에 선다. 결과는 정수 (벡터 길이는 isqrt) */
export function stepToward(ax: number, ay: number, bx: number, by: number, speed: number): Point {
  const dx = bx - ax, dy = by - ay
  const d2 = dx * dx + dy * dy
  if (d2 <= speed * speed) return { u: bx, v: by }
  const root = isqrt(d2)
  const len = root * root === d2 ? root : root + 1 // 올림: 걸음이 speed 를 넘지 않게
  return { u: ax + idiv(dx * speed, len), v: ay + idiv(dy * speed, len) }
}
