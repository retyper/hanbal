/**
 * 지형 — 언덕과 높낮이 (2026-09-03)
 *
 * 형: **"게임 배경 더 강화하고 언덕이랑 높낮이차 이런 것 있는 스테이지들 구현해야지."**
 *
 * 그동안 땅은 y=0 한 줄이었다. 이제 판(StageDef.ground)이 **꺾은선 하나**로 땅의 높이를 적는다:
 * `[{x, y}, …]` — x 오름차순, 사이는 직선으로 잇는다. 첫 점 왼쪽은 첫 점의 높이, 마지막 점
 * 오른쪽은 마지막 점의 높이다. 없으면(대부분의 판) 예전 그대로 평지 0이다.
 *
 * 규칙 셋:
 *  1. **궁수의 발밑은 언제나 0이다.** 첫 점은 궁수 오른쪽(x ≥ 2)에 두고 높이 0에서 시작한다 —
 *     궁수의 자리(ARCHER_X 0)는 저작이 못 건드린다. 검사(tests/terrain.test.ts)가 이걸 지킨다.
 *  2. 저작된 과녁의 y는 **그 자리 땅에서 잰 높이**다 (world.ts loadTarget). 언덕 위의 과녁은
 *     언덕만큼 높다. 그래야 "언덕 위의 사수"를 좌표 계산 없이 적는다.
 *  3. 땅에 닿는 것은 전부 이 함수 하나를 본다 — 내 화살(ballistics) · 적 화살(world) ·
 *     떨어지는 과녁(target) · 달려오는 사람(target charger). 렌더도 같은 함수로 땅을 그린다.
 *     땅의 높이를 아는 곳이 둘이면 화살이 땅 속에 꽂히거나 허공에 선다.
 *
 * 결정론(A1): 순수 함수다. 상태도 난수도 없다.
 */
import type { StageDef } from './types.ts'

export interface GroundPoint {
  x: number
  y: number
}

/** 이 x 자리의 땅 높이 (m). 평지면 0. */
export function groundAt(stage: StageDef, x: number): number {
  const g = stage.ground
  if (g === undefined || g.length === 0) return 0
  const first = g[0] as GroundPoint
  if (x <= first.x) return first.y
  const last = g[g.length - 1] as GroundPoint
  if (x >= last.x) return last.y
  // 점이 열 안팎이라 선형 탐색이 이진 탐색보다 싸다.
  for (let i = 1; i < g.length; i++) {
    const b = g[i] as GroundPoint
    if (x <= b.x) {
      const a = g[i - 1] as GroundPoint
      const span = b.x - a.x
      if (span <= 0) return b.y
      const t = (x - a.x) / span
      return a.y + (b.y - a.y) * t
    }
  }
  return last.y
}

/** 판에 언덕이 있는가. 렌더가 평지 빠른 길을 고를 때 본다. */
export function hasHills(stage: StageDef): boolean {
  const g = stage.ground
  if (g === undefined) return false
  for (const p of g) if (p.y !== 0) return true
  return false
}

/** 판 안의 가장 높은 땅 (m). 카메라가 하늘 여백을 잡을 때 본다. */
export function groundPeak(stage: StageDef): number {
  const g = stage.ground
  if (g === undefined) return 0
  let peak = 0
  for (const p of g) if (p.y > peak) peak = p.y
  return peak
}
