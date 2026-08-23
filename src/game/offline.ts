/**
 * 오프라인 축적 (GDD 5장 · ARCHITECTURE A3)
 *
 * 자리를 비운 시간을 **산수로만** 자원으로 바꾼다. 시뮬레이션을 몰아 돌리지 않는다.
 * 여기서 지키는 설계 원칙 세 가지:
 *
 *  1. 상한 도달을 경고하지 않는다 (C3). 조용히 가득 차 있을 뿐이다. 이 파일은 문구를 만들지 않는다.
 *  2. **이미 가진 자원을 줄이지 않는다.** 시드는 자원 금지 (GDD 9장). 시계를 뒤로 돌려도 마찬가지다.
 *  3. 축적을 끈 사람에게는 0을 준다. 대신 판 보상이 P.offline.optOutBonus 배가 된다 (progression.ts).
 */
import { P } from '../tune/params.ts'
import type { SaveData } from './save.ts'
import { writeSave } from './save.ts'

export interface OfflineGain {
  arrows: number
  training: number
  requests: number
  seconds: number
  capped: boolean
}

// 반환 값이 둘(지급량·남은 소수부)이라 스칼라로 받는다. 매 호출 객체를 만들 이유가 없다.
let gGained = 0
let gCarry = 0
let gCapped = false

/**
 * 한 자원의 축적. `have`가 이미 상한이면 아무것도 쌓이지 않고 소수부도 버린다 —
 * 상한이 진짜 상한이어야 "가득 찼으니 지금 와야 한다"는 압박이 생기지 않는다.
 */
function accrue(have: number, carry: number, seconds: number, rate: number, cap: number): void {
  const room = Math.floor(cap) - Math.floor(have)
  if (room <= 0) {
    gGained = 0
    gCarry = 0
    gCapped = seconds > 0
    return
  }
  const total = carry + seconds * rate
  let whole = Math.floor(total)
  if (whole < 0) whole = 0
  if (whole >= room) {
    gGained = room
    gCarry = 0
    gCapped = true
    return
  }
  gGained = whole
  gCarry = total - whole
  gCapped = false
}

/**
 * 마지막으로 본 시각부터 now까지를 정산한다. `d`를 제자리에서 갱신하고 저장한다.
 *
 * `now`는 호출자가 넘긴 wallclock ms다 (game 레이어라 Date.now 허용).
 * 이 값이 sim으로 들어가는 일은 없다 — 여기서 자원 개수로 바뀌어 끝난다 (A1).
 *
 * **lastSeen을 옮기는 곳은 이 함수 하나뿐이다.** writeSave는 도장을 찍지 않는다 —
 * 찍으면 정산되지 않은 구간이 조용히 삭제된다(탭을 띄워둔 채 흐른 시간이 그 경로였다).
 * 실제로 판을 돌린 시간을 축적에서 빼는 건 호출자의 몫이다 (game/loop.ts의 playedMs).
 */
export function settleOffline(d: SaveData, now: number): OfflineGain {
  const prev = d.lastSeen
  // 정산 성공 여부와 무관하게 시계를 앞으로 맞춘다. 여기서 안 맞추면
  // 다음 정산이 같은 구간을 또 계산한다.
  d.lastSeen = Number.isFinite(now) ? now : prev

  let seconds = (d.lastSeen - prev) / 1000
  // 시계를 뒤로 돌렸다(음수) / 값이 망가졌다. 크래시하지도, 자원을 뺏지도 않는다. 그냥 0이다.
  if (!Number.isFinite(seconds) || seconds <= 0) seconds = 0

  if (!d.offlineEnabled || seconds <= 0) {
    // 축적을 끈 동안 쌓인 소수부를 들고 있으면 다시 켠 순간 한 번에 터진다.
    if (!d.offlineEnabled) {
      d.carry.arrows = 0
      d.carry.training = 0
      d.carry.requests = 0
    }
    writeSave(d)
    return { arrows: 0, training: 0, requests: 0, seconds, capped: false }
  }

  let capped = false

  accrue(d.arrows, d.carry.arrows, seconds, P.offline.arrowPerSec, P.offline.arrowCap)
  const arrows = gGained
  d.arrows += gGained
  d.carry.arrows = gCarry
  capped = capped || gCapped

  accrue(d.training, d.carry.training, seconds, P.offline.trainingPerSec, P.offline.trainingCap)
  const training = gGained
  d.training += gGained
  d.carry.training = gCarry
  capped = capped || gCapped

  accrue(d.requests, d.carry.requests, seconds, P.offline.requestPerSec, P.offline.requestCap)
  const requests = gGained
  d.requests += gGained
  d.carry.requests = gCarry
  capped = capped || gCapped

  writeSave(d)
  return { arrows, training, requests, seconds, capped }
}
