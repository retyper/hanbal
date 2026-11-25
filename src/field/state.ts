/**
 * 판 상태의 해시와 읽기 복사 — 결정론 시험과 입력 재생 비교가 이것으로 같음을 본다.
 * 정수 필드만, 순서 고정 (fnv-1a 꼴 · 32비트).
 */
import type { FieldState } from './types.ts'

const END_CODE = { morale: 1, men: 2, time: 3, retreat: 4, invalid: 5 } as const

/** `|0` 이 -0 과 NaN 을 0 으로 접는다 — 해시에 -0 이 끼지 않게 */
const mix = (h: number, n: number): number => Math.imul(h ^ (n | 0), 0x01000193)

export function hashField(s: FieldState): string {
  let h = 0x811c9dc5
  h = mix(h, s.tick); h = mix(h, s.seed); h = mix(h, s.end === null ? 0 : END_CODE[s.end])
  h = mix(h, s.log.dropped); h = mix(h, s.log.accepted.length)
  for (const q of s.squads) {
    h = mix(h, q.id); h = mix(h, q.side); h = mix(h, q.men); h = mix(h, q.menMax); h = mix(h, q.fresh)
    h = mix(h, q.u); h = mix(h, q.v); h = mix(h, q.goal ? q.goal.u : -1); h = mix(h, q.goal ? q.goal.v : -1)
    h = mix(h, q.manual); h = mix(h, q.target); h = mix(h, q.hp); h = mix(h, q.morale)
  }
  for (const e of s.heroes) {
    h = mix(h, e.side); h = mix(h, e.u); h = mix(h, e.v); h = mix(h, e.goal ? e.goal.u : -1); h = mix(h, e.goal ? e.goal.v : -1)
    h = mix(h, e.grp); h = mix(h, e.stun); h = mix(h, e.hp)
  }
  return (h >>> 0).toString(16)
}

/** 그림용 읽기 복사 (그리는 쪽이 sim 배열을 쥐고 있다가 망가뜨리지 않게) */
export function snapshot(s: FieldState): FieldState {
  return {
    ...s,
    squads: s.squads.map(q => ({ ...q, goal: q.goal ? { ...q.goal } : null })),
    heroes: s.heroes.map(e => ({ ...e, goal: e.goal ? { ...e.goal } : null })),
    used: [...s.used] as FieldState['used'],
    log: { dropped: s.log.dropped, accepted: [...s.log.accepted] },
  }
}
