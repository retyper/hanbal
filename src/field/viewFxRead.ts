/**
 * 그리는 쪽이 읽는 덧칸. viewRead.ts 의 VModel 에 아직 없는 칸(order·ran·flee·hitTick · 사건 flankHit·artHit·omen)은
 * 있으면 읽고 없으면 0/빈 값으로 본다 — 엔진 묶음 2 가 viewRead 에 칸을 더하면 저절로 켜진다. 읽기만 한다.
 */
import type { VEvent, VModel, VSquad } from './viewRead.ts'

/** 앞줄 모양 · 무리 명령 · impact 의 how · loss 의 how (types.ts 와 같은 값 — 그리는 쪽이 sim 을 몰라도 되게 여기 둔다) */
export const FORM_CHARGE = 1, FORM_HOLD = 2
/** 그리는 쪽만 쓰는 가짜 모양: 달아나는 대는 흩어진다 (줄 선 덩어리가 풀려) */
export const FORM_SCATTER = 9
/** 방패 대의 방진 = 방패 벽 (그리는 쪽만 쓰는 가짜 모양 · 틈 없이 이어진다) */
export const FORM_WALL = 10
export const ORD_CHARGE = 1, ORD_HOLD = 2, ORD_FLANK = 4
export const HIT_PLAIN = 0, HIT_GOOD = 1, HIT_BLOCKED = 2
export const LOSS_ARROW = 1, LOSS_IMPACT = 4

export const eventsOf = (m: VModel): readonly VEvent[] => m.events

/** 대의 사기 몫 0~1(처음 사기에 대해) */
export const moraleOf = (q: VSquad): number => (q.morale0 > 0 ? q.morale / q.morale0 : 1)
