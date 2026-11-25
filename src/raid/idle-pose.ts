/**
 * 가만히 선 장수의 칸 (형 11-25 「단련터나 열전에서 캐릭터 고를 때 idle 이 안 뜸」) — 판 상태 없이 시각(초)만으로.
 * 장수를 고르는 화면(얼굴 링 · ui/realm/hero-ring.ts)이 열전 판 안과 같은 서 있는 움직임(숨쉬기 · 눈 깜빡임 · 개성 동작)을 내도록
 * hero-idle.ts 의 계획(planFrame · usablePlan)과 같은 셈을 한 곳에서 부른다. 계획이 없는 띠는 열전과 같은 예전 서기(HAEBI_ANIM.idle).
 * 20 칸부터는 덧 띠(gen-X-x.png)의 칸 — 아직 못 받았으면 ready = false 로 부르면 본 띠 칸만 돌려준다. 화면만 · 아무것도 쓰지 않는다.
 */
import { HAEBI_ANIM as A } from '../tune/params.ts'
import { idlePlan, idleSeed, planFrame, spriteName, usablePlan, usesCompanion } from './hero-idle.ts'

/** 이 그림 길의 띠가 덧 띠를 쓰나 (고르는 화면이 덧 띠를 미리 받을지 정한다) */
export const standsWithCompanion = (path: string): boolean => usesCompanion(idlePlan(path))

/**
 * 쉬기 시작한 뒤 tau 초의 칸 번호 — 열전 판 위와 같다 (계획이 있으면 planFrame · 없으면 HAEBI_ANIM.idle 을 idleTime 초마다).
 * @param companionReady 덧 띠가 읽혔나 (아니면 20 칸 넘는 칸은 쓰지 않는다)
 * @param calm 움직임 줄이기 (서기 칸만)
 */
export function standingCell(path: string, tau: number, companionReady: boolean, calm = false): number {
  const plan = idlePlan(path)
  if (plan === null) return A.idle[Math.floor(Math.max(0, tau) / A.idleTime) % A.idle.length]!
  return planFrame(usablePlan(plan, companionReady), idleSeed(spriteName(path)), tau, calm)
}
