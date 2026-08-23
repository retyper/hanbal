/**
 * 화살 종류가 sim에게 요구하는 것 (docs/HOOK.md ★1)
 *
 * 왜 game/arrows.ts가 아니라 여기인가: 효과를 실제로 적용하는 건 ballistics·target이고,
 * 레이어 방향은 core ← sim ← game 이다 (ARCHITECTURE A1). sim이 game을 import하면 화살표가
 * 뒤집힌다. 그래서 **숫자와 계약은 sim의 것**이고, game/arrows.ts는 이름·설명·아이콘 같은
 * 화면용 메타데이터만 들고 여기를 re-export한다.
 *
 * 값의 단일 출처는 tune/params.ts의 `arrowkind` 그룹이다 (A2). 이 파일은 그걸 종류별로
 * 재배치할 뿐이고, 스스로 숫자를 갖지 않는다.
 *
 * ★ 설계 규칙: **종류마다 다른 필드가 아니라 전 종류가 같은 판을 쓴다.**
 * sim이 `if (kind === 'burst')` 분기를 늘리지 않고 `fx.burstRadius > 0` 만 보면 되게.
 * 분기가 늘면 관통+무거움처럼 효과가 겹치는 종류에서 반드시 한쪽이 빠진다.
 * 모든 값은 "효과 없음"이 0(배수는 1)이라, 기본 살은 sim의 어느 분기도 타지 않는다.
 */
import { P } from '../tune/params.ts'
import type { ArrowKindId } from './types.ts'

export interface ArrowFx {
  /** 원래라면 화살이 멈췄을 과녁을 **몇 개 더** 뚫는가. 0이면 첫 명중에서 멈춘다. */
  pierceExtra: number
  /** 한 번 뚫을 때 잃는 속도 비율. `keep = 1 - 명중도 × pierceLoss`. */
  pierceLoss: number
  /** 명중 지점에서 이 반경(m) 안의 과녁을 같이 친다. 0이면 폭발하지 않는다. */
  burstRadius: number
  /** 명중 후 갈라지는 자식 화살 수. 0이면 갈라지지 않는다. */
  splitCount: number
  /** 자식이 진행 방향에서 벌어지는 각 (rad). ±로 대칭 배분한다. */
  splitAngle: number
  /** 자식이 물려받는 속도 비율. */
  splitSpeedKeep: number
  /** 초당 최대 선회각 (rad/s). 0이면 유도하지 않는다. */
  homingTurn: number
  /** 이 거리(m) 안의 과녁만 빨아들인다. */
  homingRange: number
  /** 발사 후 이만큼(s) 지나야 유도가 시작된다. 즉시 걸리면 조준이 장식이 된다. */
  homingDelay: number
  /** 진행 방향 기준 이 각(rad) 안의 과녁만 노린다. 뒤로 돌아가지 않게 하는 빗장. */
  homingCone: number
  /** 명중 후 다음 과녁으로 튀는 최대 횟수. 0이면 튀지 않는다. */
  chainBounces: number
  /** 튈 수 있는 최대 거리 (m). */
  chainRange: number
  /** 튈 때 물려받는 속도 비율. */
  chainSpeedKeep: number
  /** 발사 초속 배수. */
  speedMul: number
  /** 공기저항 배수. 무거운 살은 같은 항력에 덜 밀린다 — 바람 판에서 이게 성격이 된다. */
  dragMul: number
  /** 이 화살이 만든 점수 전부에 곱해진다 (폭발·연쇄로 딸려 죽은 과녁 포함). */
  scoreMul: number
}

function neutral(): ArrowFx {
  return {
    pierceExtra: 0,
    pierceLoss: 0,
    burstRadius: 0,
    splitCount: 0,
    splitAngle: 0,
    splitSpeedKeep: 0,
    homingTurn: 0,
    homingRange: 0,
    homingDelay: 0,
    homingCone: 0,
    chainBounces: 0,
    chainRange: 0,
    chainSpeedKeep: 0,
    speedMul: 1,
    dragMul: 1,
    scoreMul: 1,
  }
}

/**
 * 종류별 효과판. **모듈 로드 때 한 번 만들고 그 뒤로는 제자리에서 갱신만 한다** —
 * 핫 루프가 매 스텝 읽는 객체라 새로 만들면 프레임당 할당 0이 깨진다 (A5).
 */
const TABLE: Record<ArrowKindId, ArrowFx> = {
  basic: neutral(),
  pierce: neutral(),
  burst: neutral(),
  split: neutral(),
  homing: neutral(),
  chain: neutral(),
  heavy: neutral(),
}

function reset(fx: ArrowFx): void {
  fx.pierceExtra = 0
  fx.pierceLoss = 0
  fx.burstRadius = 0
  fx.splitCount = 0
  fx.splitAngle = 0
  fx.splitSpeedKeep = 0
  fx.homingTurn = 0
  fx.homingRange = 0
  fx.homingDelay = 0
  fx.homingCone = 0
  fx.chainBounces = 0
  fx.chainRange = 0
  fx.chainSpeedKeep = 0
  fx.speedMul = 1
  fx.dragMul = 1
  fx.scoreMul = 1
}

/**
 * P의 현재 값으로 효과판을 다시 굽는다. **판이 시작될 때(resetWorld) 한 번만 부른다** —
 * 그래야 라이브 튜닝 콘솔로 노브를 움직인 게 다음 판부터 먹고(A2), 판 도중에 물리가
 * 바뀌어 리플레이가 갈라지는 일은 없다 (A1).
 */
export function refreshArrowFx(): void {
  const a = P.arrowkind

  reset(TABLE.basic)

  const pierce = TABLE.pierce
  reset(pierce)
  pierce.pierceExtra = a.pierceExtra
  pierce.pierceLoss = a.pierceLoss

  const burst = TABLE.burst
  reset(burst)
  burst.burstRadius = a.burstRadius

  const split = TABLE.split
  reset(split)
  split.splitCount = a.splitCount
  split.splitAngle = a.splitAngle
  split.splitSpeedKeep = a.splitSpeedKeep

  const homing = TABLE.homing
  reset(homing)
  homing.homingTurn = a.homingTurn
  homing.homingRange = a.homingRange
  homing.homingDelay = a.homingDelay
  homing.homingCone = a.homingCone

  const chain = TABLE.chain
  reset(chain)
  chain.chainBounces = a.chainBounces
  chain.chainRange = a.chainRange
  chain.chainSpeedKeep = a.chainSpeedKeep

  const heavy = TABLE.heavy
  reset(heavy)
  heavy.pierceExtra = a.heavyPierceExtra
  heavy.pierceLoss = a.heavyPierceLoss
  heavy.speedMul = a.heavySpeedMul
  heavy.dragMul = a.heavyDragMul
  heavy.scoreMul = a.heavyScoreMul
}

refreshArrowFx()

/**
 * 이 화살이 sim에게 요구하는 것. **새 객체를 만들지 않는다** —
 * 핫 루프에서 매 스텝 불려도 된다 (A5). 모르는 id는 기본 살로 떨어진다.
 */
export function arrowFx(id: ArrowKindId): ArrowFx {
  return TABLE[id] ?? TABLE.basic
}
