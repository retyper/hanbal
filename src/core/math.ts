/**
 * 순수 수학 유틸. 의존 없음. 핫 루프에서 불리므로 할당하지 않는다 (ARCHITECTURE A5).
 */

export const TAU = Math.PI * 2

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** t를 [a,b] 구간에서 0..1로. b<=a면 0. */
export const invLerp = (a: number, b: number, t: number): number =>
  b <= a ? 0 : clamp01((t - a) / (b - a))

/** 부드러운 0..1. 시작·끝에서 미분이 0이라 튀지 않는다. */
export const smoothstep = (t: number): number => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

/** 각도를 (-PI, PI]로 정규화. 각도 비교 전에 반드시 거친다. */
export function normAngle(a: number): number {
  let r = a % TAU
  if (r > Math.PI) r -= TAU
  else if (r <= -Math.PI) r += TAU
  return r
}

/** 두 각의 최단 차이. */
export const angleDelta = (from: number, to: number): number => normAngle(to - from)

/**
 * 프레임레이트 독립 지수 감쇠. `lerp(a, b, rate*dt)` 대신 이걸 쓴다.
 * sim은 고정 스텝이라 필수는 아니지만, 렌더 보간에서 dt가 흔들릴 때 안전하다.
 */
export const damp = (a: number, b: number, rate: number, dt: number): number =>
  b + (a - b) * Math.exp(-rate * dt)

/** 점-선분 최단거리 제곱. 화살 터널링 방지 판정에 쓴다 (sim-lens 체크 항목). */
export function distSqPointSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  // 길이 0인 선분(정지 프레임)은 점 거리로 폴백. 0으로 나누면 NaN이 판 전체를 죽인다.
  const t = lenSq > 0 ? clamp01(((px - ax) * dx + (py - ay) * dy) / lenSq) : 0
  const cx = ax + dx * t - px
  const cy = ay + dy * t - py
  return cx * cx + cy * cy
}

/**
 * 결정론적 값 노이즈 (1D). 떨림 합성에 쓴다.
 * Math.random 없이, 시간(위상)만으로 재현 가능한 부드러운 흔들림을 만든다.
 * seed가 다르면 다른 파형이 나오므로 x축/y축 떨림에 서로 다른 seed를 준다.
 */
export function valueNoise(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  const h = (n: number): number => {
    let t = (n ^ Math.imul(seed, 0x9e3779b9)) >>> 0
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (((t ^ (t >>> 14)) >>> 0) / 2147483648) - 1
  }
  // smoothstep 보간 — 선형이면 미분이 끊겨 떨림에서 각진 느낌이 난다.
  return lerp(h(i), h(i + 1), smoothstep(f))
}

/**
 * 수확체감 곡선. 스탯 효과가 후반에 완만해지는 데 쓴다 (GDD 4장).
 * level <= knee 구간은 선형, 그 위로는 로그로 눕는다.
 */
export function diminish(level: number, knee: number, rate: number): number {
  if (level <= knee) return level
  return knee + Math.log1p((level - knee) / knee) * knee * rate
}
