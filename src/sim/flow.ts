/**
 * 연사(連射)와 몰기(沒技) — **능숙함을 속도로 환전한다** (docs/MEGAHIT.md §1)
 *
 * ★ 왜 생겼나
 *
 *   밸런스 시뮬이 스스로 이렇게 보고했다:
 *     `발당 명중 nov 100.0% / avg 100.0% / exp 100.0%   클리어율 격차 0.0%p`
 *     `챕터 1~5 · 화살 7종 — 소모 화살 2.0 2.0 2.0 2.0 2.0 2.0 2.0`
 *
 *   과녁이 둘이면 두 발, 셋이면 세 발. **"다 맞히기" 위에 아무것도 없었다.**
 *   그래서 이 게임에서 능숙해져도 판이 빨라지지 않았다 — 잘하는 사람에게 줄 것이 없었다.
 *   메가히트 액션 게임은 예외 없이 숙련을 **템포**로 환전한다. 그 환전소가 이 파일이다.
 *
 * ★ 무엇을 바꾸고 무엇을 절대 안 바꾸는가
 *
 *   바꾸는 것은 **활이 손에서 가벼워지는 것** 하나뿐이다.
 *     ① 만작까지의 시간이 짧아진다      (drawTime × mul)
 *     ② 당김의 스태미나 소모가 준다      (drawDrain × mul) — 빨리 쏴도 안 무너진다
 *     ③ 몰기에서는 회복 지연이 없다      (regenDelay 면제)
 *
 *   **정확도와 탄도는 한 톨도 안 건드린다.** 이건 GDD 1장 '빨간 바 계약'의 문제다.
 *   - 산포·떨림에 손대면 계약이 깨진다. 그래서 안 댄다.
 *   - **화살 속도에도 안 댄다.** 속도가 판 도중에 변하면 같은 조준이 다른 탄도를 그린다.
 *     "조준한 그대로 맞는다"가 무너지는 건 산포뿐 아니라 이 경로로도 가능하다.
 *     빠른 화살은 시원해 보이지만, 배운 것을 판 중간에 배신하는 짓이다.
 *
 *   만작에 빨리 닿으면 스태미나를 덜 쓰므로 안전 구간이 **넓어진다**. 이건 이중 보상이지만
 *   벌이 아니라 상이라 계약 위반이 아니다 — 다만 크기는 `npm run balance`가 판정한다.
 *
 * ★ 국궁의 말을 쓴다
 *   콤보가 아니라 **중(中)** — 한 발이 맞은 것. 콤보 최대가 아니라 **몰기(沒技)** —
 *   한 순(5발)을 다 맞힌 것, 국궁에서 그 판의 자랑이다. 이름을 빌리면 시스템이 저작된 것이 된다.
 *   그리고 5중이면 배수가 마침 하한(floor)에 닿는다 — **몰기 = 속도의 천장**이다.
 *
 * ARCHITECTURE A1: 난수도 실시간도 쓰지 않는다. 같은 입력 = 같은 연사.
 */
import type { World } from './types.ts'
import { P } from '../tune/params.ts'

/** 연속 중(中) 수의 상한. 배수는 진작에 하한에 닿으므로 이건 숫자가 폭주하지 않게 하는 뚜껑이다. */
const HITS_MAX = 20

/** 만작 도달 시간 배수. 중(中)이 쌓일수록 작아지고, floor에서 멈춘다. */
export function flowDrawMul(w: World): number {
  const m = Math.pow(P.flow.perHit, w.flowHits)
  return m < P.flow.drawFloor ? P.flow.drawFloor : m
}

/** 당김 스태미나 소모 배수. 빨리 쏘는 사람이 스스로 목을 조르지 않게 한다. */
export function flowDrainMul(w: World): number {
  const m = Math.pow(P.flow.perHitDrain, w.flowHits)
  return m < P.flow.drainFloor ? P.flow.drainFloor : m
}

/**
 * 중(中) — 화살 하나가 **처음** 무언가를 맞혔다.
 *
 * 왜 '처음'인가: 관통·분열·사슬은 한 발이 여럿을 맞힌다. 그걸 다 세면 한 발로 몰기에 닿는다.
 * 세는 것은 과녁의 수가 아니라 **화살의 수**다 (국궁에서도 그렇다).
 */
export function flowHit(w: World): void {
  if (w.flowHits < HITS_MAX) w.flowHits++
  w.flowIdle = 0
  if (!w.molgi && w.flowHits >= P.flow.molgiAt) {
    w.molgi = true
    w.events.push({ t: 'molgi', on: true })
  }
}

/** 실중 — 맞히지 못했다. 연사는 **즉시** 끊긴다. 이게 한 발 한 발에 값을 매긴다. */
export function flowMiss(w: World): void {
  w.flowIdle = 0
  if (w.flowHits === 0 && !w.molgi) return
  w.flowHits = 0
  if (w.molgi) {
    w.molgi = false
    w.events.push({ t: 'molgi', on: false })
  }
}

/**
 * 식음 — **망설여도 식는다.**
 *
 * 활을 잡지도 않고, 내 화살이 날고 있지도 않은 시간만 센다.
 * 비행 시간을 벌로 세면 먼 과녁을 쏘는 게 죄가 된다 — 그건 실력이 아니라 판의 성질이다.
 */
export function stepFlow(w: World): void {
  if (w.flowHits === 0 && !w.molgi) return
  const a = w.archer
  if (a.phase !== 'idle') {
    w.flowIdle = 0
    return
  }
  for (let i = 0; i < w.arrows.length; i++) {
    const ar = w.arrows[i]
    if (ar !== undefined && ar.alive && ar.splitDepth <= 0) {
      w.flowIdle = 0
      return
    }
  }
  w.flowIdle += w.dt
  if (w.flowIdle < P.flow.coolAfter) return
  w.flowIdle = 0
  w.flowHits--
  if (w.molgi && w.flowHits < P.flow.molgiAt) {
    w.molgi = false
    w.events.push({ t: 'molgi', on: false })
  }
}

/**
 * 판이 시작될 때 sim이 부르는 초기화. **여정을 잇는 건 game 레이어의 일이다** —
 * game/loop.ts가 판 경계에서 값을 도로 넣는다 (P.flow.carry). sim은 런의 존재를 모른다.
 */
export function resetFlow(w: World): void {
  w.flowHits = 0
  w.flowIdle = 0
  w.molgi = false
}
