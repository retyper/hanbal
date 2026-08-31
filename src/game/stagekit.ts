/**
 * 스테이지 저작 공용 킷 — 좌표 한 점(Spot)을 sim이 먹는 TargetSpec 으로 굽는다.
 *
 * 왜 따로 있나: 앞의 40판은 손으로 적은 배치(`stages.ts`)이고 41판부터는 생성기(`endless.ts`)인데,
 * 둘은 **한 가지 규칙을 반드시 공유해야 한다 — 반경은 각크기 곡선에서 계산한다.**
 * 반경을 손으로 적는 순간 판마다 제각각이 되고, 예전처럼 8.5배 급락하는 난이도 절벽이 생겨도
 * 아무도 눈치채지 못한다 (stages.ts 난이도 정책 2항).
 *
 * 레이어: game 의 leaf 다. sim 의 타입만 읽고 아무것도 import 하지 않는다.
 */
import { clamp } from '../core/math.ts'
import type { StageDef, TargetKind, TargetSpec } from '../sim/types.ts'

/**
 * 이 판에서 **없애야 판이 끝나는 것**의 수 = 적의 수.
 *
 * 기준은 sim/world.ts 의 `anyTargetStanding` 과 **정확히 같다** — 보급(상)과 화약 상자(도구)는
 * 클리어 조건이 아니므로 적이 아니다. 두 곳이 다른 기준을 쓰면 "화살이 적보다 많은데 못 깬다"가
 * 나오고, 그건 규칙이 아니라 배신이다.
 */
export function foeCount(stage: StageDef): number {
  let n = 0
  for (const t of stage.targets) {
    if (t.kind === 'bonus' || t.kind === 'barrel') continue
    n++
  }
  return n
}

/**
 * 화살의 **절대 바닥** — 형의 규칙 (2026-09-01):
 * "어떤 상황에서도 게임 시작했을 때 화살 수는 아무리 적어도 적 수보다 1개 더 많아야 해."
 *
 * 그동안 화살이 적보다 적어지는 길이 셋 있었다. 셋 다 **의도된** 길이라 더 위험했다 —
 * 저작 실수가 아니라 설계였기 때문에 아무도 버그로 신고하지 않았다:
 *   1. 화약 상자 퍼즐판 (1-9·2-6·2-9…) — 정답 발수만 주고 "하나씩 쏘기"의 길을 막았다.
 *   2. 갈림길 '단발' 카드 — 화살을 절반으로 조인다.
 *   3. 화살 보유가 바닥난 사람 — game/progression.ts grantArrows 의 min 지급.
 * 셋이 겹치면 다섯이 서 있는 판에 두 발을 들고 들어가는 일이 실제로 가능했다.
 *
 * 이 바닥은 그 **아래로 못 내려가는 선**이다. 퍼즐은 여전히 퍼즐이다 (적+1 은 한 발밖에 못
 * 빗나가는 수다). 다만 "수학적으로 이길 수 없는 판"은 이제 이 게임에 없다 — GDD 9장이 금지한
 * 에너지 게이트가 화살 저작의 얼굴을 하고 들어오던 마지막 문이 여기였다.
 *
 * ★ 여기가 이 규칙의 **단일 출처**다. 판을 굽는 쪽(game/stages.ts getStage)과 지급하는 쪽
 *   (game/progression.ts grantArrows)이 둘 다 이 함수를 부른다.
 */
export function arrowFloor(stage: StageDef): number {
  return foeCount(stage) + 1
}

/** 궁수의 손. 모든 거리는 여기서 잰다. */
export const HAND_X = 0
export const HAND_Y = 1.4

/** 과녁 기본 점수. 점수 기준선을 "몇 발 맞혀야 하는가"로만 읽히게 전 과녁 동일. */
export const BASE_SCORE = 100

/** 손으로 적은 캠페인의 길이. 이 뒤부터가 무한 구간이다. */
export const CAMPAIGN_STAGES = 50

/** 1판의 각크기. 조준을 반쯤 놓쳐도 맞는다. 1280px 화면에서 반경 약 72px. */
const H_FIRST = 0.056
/** 40판의 각크기. 여전히 반경 15px — 이게 "안 보이는 것 맞히기"가 되지 않는 바닥이다. */
const H_LAST = 0.012
/**
 * 무한 구간의 바닥. 1280px 화면에서 반경 약 10px.
 *
 * 여기서 멈추는 이유: 41판부터는 실력을 가르는 구간이지만(GDD), 형이 이미 한 번
 * **"과녁이 너무 작아서 어렵다"**고 반려한 적이 있다. 무한 구간의 난이도는 크기가 아니라
 * **배치와 메커닉**으로 만든다 (endless.ts). 크기는 여기서 더 내려가지 않는다.
 */
const H_FLOOR = 0.008
/** H_LAST → H_FLOOR 로 내려가는 데 걸리는 판 수. 40판에 걸쳐 천천히. */
const H_RAMP = 40

/**
 * 판 번호(1부터) → 과녁 각크기.
 *
 * 1~40판은 지수 곡선이라 줄어드는 **비율**이 일정하다 (선형이면 앞이 급하고 뒤가 밋밋하다).
 * 41판부터는 같은 성격의 두 번째 지수 구간으로 이어 붙이고 H_FLOOR 에서 멈춘다.
 */
export function angularSize(n: number): number {
  if (n <= CAMPAIGN_STAGES) {
    const t = clamp((n - 1) / (CAMPAIGN_STAGES - 1), 0, 1)
    return H_FIRST * Math.pow(H_LAST / H_FIRST, t)
  }
  const t = clamp((n - CAMPAIGN_STAGES) / H_RAMP, 0, 1)
  return H_LAST * Math.pow(H_FLOOR / H_LAST, t)
}

/** 저작용 한 점. 반경은 적지 않는다 — 각크기 곡선이 계산한다. */
export interface Spot {
  x: number
  y: number
  kind?: TargetKind
  /** 이 판 기준 크기의 배수. 연쇄용 작은 알갱이 등에만 쓴다. */
  size?: number
  ampX?: number
  ampY?: number
  freq?: number
  /** charger 전용 — 다가오는 속도 (m/s). 없으면 P.target.chargeSpeed */
  speed?: number
  /** bonus 전용 — 맞히면 돌려주는 화살 수. 없으면 1 */
  give?: number
  /** 폭탄 — 죽으면 둘레의 과녁을 같이 친다 (P.target.bombRadius, sim/target.ts). */
  bomb?: boolean
}

/** 각크기 h에서 이 자리의 실제 반경을 계산해 sim이 먹는 형태로 굽는다. */
export function specOf(h: number, s: Spot): TargetSpec {
  const d = Math.hypot(s.x - HAND_X, s.y - HAND_Y)
  const kind = s.kind ?? 'static'
  const spec: TargetSpec = {
    kind,
    x: s.x,
    y: s.y,
    r: h * d * (s.size ?? 1),
    // 화약 상자는 점수를 안 준다 — 값은 그 폭발이 끊는 것들이 낸다 (sim/types.ts 'barrel').
    score: kind === 'barrel' ? 0 : BASE_SCORE,
  }
  // 상자는 맞으면 반드시 터진다. 저작할 때 bomb 을 따로 안 적어도 되게 여기서 채운다.
  if (kind === 'barrel') spec.bomb = true
  if (s.ampX !== undefined) spec.ampX = s.ampX
  if (s.ampY !== undefined) spec.ampY = s.ampY
  if (s.freq !== undefined) spec.freq = s.freq
  if (s.speed !== undefined) spec.speed = s.speed
  if (s.give !== undefined) spec.give = s.give
  if (s.bomb !== undefined) spec.bomb = s.bomb
  return spec
}
