/**
 * 판 상태의 해시와 읽기 복사 — 결정론 시험과 입력 재생 비교가 이것으로 같음을 본다.
 * 정수 필드만, 순서 고정 (fnv-1a 꼴 · 32비트).
 */
import type { FieldMap, FieldState } from './types.ts'

const END_CODE = { morale: 1, men: 2, time: 3, retreat: 4, invalid: 5 } as const

const hs = (h: number, str: string): number => { for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193); return h }

/**
 * 32비트 정수는 그대로 섞는다 (`|0` 이 -0 을 0 으로 접는다 — 해시에 -0 이 끼지 않게).
 * 그 밖(소수 · NaN · 무한 · 2^31 넘는 수)은 표지를 붙여 글자로 섞는다 — 0 과 NaN, 1 과 1.5 를 같게 보지 않는다 (45 §2-19)
 */
const mix = (h: number, n: number): number => Number.isInteger(n) && n >= -0x80000000 && n <= 0x7fffffff
  ? Math.imul(h ^ (n | 0), 0x01000193)
  : hs(Math.imul(h ^ 0x5f3759df, 0x01000193), String(n))

/** 지도(바닥 칸 · 진영 · 조각)의 해시 — cells 를 직접 훑는다 (JSON 을 거치면 Uint8Array 가 부푼다). 목책이 부서지면 판의 지도 사본이 바뀐다 */
function hashMap(map: FieldMap): number {
  let h = 0x811c9dc5
  h = mix(h, map.u); h = mix(h, map.w); h = mix(h, map.highOwner)
  for (let i = 0; i < map.cells.length; i++) h = mix(h, map.cells[i]!)
  for (const c of map.camps) { h = mix(h, c.u); h = mix(h, c.v); h = mix(h, c.face); h = mix(h, c.spread); h = mix(h, c.axis); h = mix(h, c.hold ? 1 : 0); h = mix(h, c.asleep ?? 0) }
  for (const p of map.pieces) { h = mix(h, p.id); h = mix(h, p.kind === 'stake' ? 1 : 2); h = mix(h, p.u0); h = mix(h, p.v0); h = mix(h, p.u1); h = mix(h, p.v1); h = mix(h, p.hp); h = mix(h, p.owner); h = mix(h, p.rem ?? 0) }
  return h
}

export function hashField(s: FieldState): string {
  let h = hashMap(s.map)
  h = mix(h, s.tick); h = mix(h, s.seed); h = mix(h, s.end === null ? 0 : END_CODE[s.end])
  // 장부(log.dropped · accepted)는 판 상태가 아니라 해시에 안 넣는다 — 버려진 입력이 있어도 기록 재생이 같은 해시를 낸다
  h = mix(h, s.winner); for (const n of s.used) h = mix(h, n); h = mix(h, s.broken[0]); h = mix(h, s.broken[1])
  for (const p of s.anchor) { h = mix(h, p.u); h = mix(h, p.v) }
  for (const r of s.route) { h = mix(h, r.length); for (const p of r) { h = mix(h, p.u); h = mix(h, p.v) } }
  for (const n of s.grpWhy) h = mix(h, n); for (const n of s.grpWhyTick) h = mix(h, n)
  for (const k of [0, 1] as const) { h = mix(h, s.stats.flankHits[k]); h = mix(h, s.stats.artMorale[k]); h = mix(h, s.stats.killed[k]); h = mix(h, s.stats.lost[k]); h = mix(h, s.planTick[k]); h = mix(h, s.frontLockTick[k])
    const mb = s.stats.moraleBy[k]; h = mix(h, mb.arrows); h = mix(h, mb.melee); h = mix(h, mb.flank); h = mix(h, mb.hero); h = mix(h, mb.domino); h = mix(h, mb.push)
    h = mix(h, s.lineup[k]); h = mix(h, s.breakTick[k]); h = mix(h, s.breakWhy[k]); h = mix(h, s.stood[k]) }
  for (const q of s.squads) {
    h = hs(h, q.kind); h = hs(h, q.grp); h = mix(h, q.morale0); h = mix(h, q.flank); h = mix(h, q.homeU); h = mix(h, q.homeV)
    h = mix(h, q.id); h = mix(h, q.side); h = mix(h, q.men); h = mix(h, q.menMax); h = mix(h, q.fresh)
    h = mix(h, q.u); h = mix(h, q.v); h = mix(h, q.goal ? q.goal.u : -1); h = mix(h, q.goal ? q.goal.v : -1)
    h = mix(h, q.manual); h = mix(h, q.target); h = mix(h, q.hp); h = mix(h, q.morale); h = mix(h, q.stance); h = mix(h, q.shock); h = mix(h, q.lock); h = mix(h, q.sleep)
    h = mix(h, q.daze); h = mix(h, q.rem); h = mix(h, q.held); h = mix(h, q.foe); h = mix(h, q.calm); h = mix(h, q.form); h = mix(h, q.cmd); h = mix(h, q.reach); h = mix(h, q.aim)
    h = mix(h, q.order); h = mix(h, q.orderTick); h = mix(h, q.orderAt ? q.orderAt.u : -1); h = mix(h, q.orderAt ? q.orderAt.v : -1); h = mix(h, q.ran); h = mix(h, q.bonus); h = mix(h, q.hitTick); h = mix(h, q.flee) ; h = mix(h, q.bw); h = mix(h, q.bd); h = mix(h, q.face); h = mix(h, q.pushed); h = mix(h, q.regrouped)
  }
  for (const e of s.heroes) {
    h = hs(h, e.id)
    h = mix(h, e.side); h = mix(h, e.u); h = mix(h, e.v); h = mix(h, e.goal ? e.goal.u : -1); h = mix(h, e.goal ? e.goal.v : -1)
    h = mix(h, e.grp); h = mix(h, e.stun); h = mix(h, e.hp); h = mix(h, e.manual); h = mix(h, e.rem)
    h = mix(h, e.mu); h = mix(h, e.tong); h = mix(h, e.dir); h = mix(h, e.face); h = mix(h, e.foe); h = mix(h, e.atk); h = mix(h, e.dash); h = mix(h, e.dashDir); h = mix(h, e.dashCd)
    h = hs(h, e.art); h = mix(h, e.artCd); h = mix(h, e.artOn); h = mix(h, e.why); h = mix(h, e.whyTick)
    h = mix(h, e.hitIds.length); for (const n of e.hitIds) h = mix(h, n)
    h = mix(h, e.grit)
  }
  return (h >>> 0).toString(16)
}

/** 그림용 읽기 복사 (그리는 쪽이 sim 배열을 쥐고 있다가 망가뜨리지 않게) — 판의 지도 사본(칸 · 조각)과 broken 도 떼어 낸다 (45 §2-13) */
export function snapshot(s: FieldState): FieldState {
  return {
    ...s,
    map: { ...s.map, cells: s.map.cells.slice(), pieces: s.map.pieces.map(p => ({ ...p })) },
    squads: s.squads.map(q => ({ ...q, goal: q.goal ? { ...q.goal } : null, orderAt: q.orderAt ? { ...q.orderAt } : null })),
    heroes: s.heroes.map(e => ({ ...e, goal: e.goal ? { ...e.goal } : null, hitIds: [...e.hitIds] })),
    stats: { flankHits: [...s.stats.flankHits], artMorale: [...s.stats.artMorale], killed: [...s.stats.killed], lost: [...s.stats.lost], moraleBy: [{ ...s.stats.moraleBy[0] }, { ...s.stats.moraleBy[1] }] } as FieldState['stats'],
    lineup: [...s.lineup] as FieldState['lineup'],
    breakTick: [...s.breakTick] as FieldState['breakTick'],
    breakWhy: [...s.breakWhy] as FieldState['breakWhy'],
    stood: [s.stood[0], s.stood[1]],
    planTick: [...s.planTick] as FieldState['planTick'],
    frontLockTick: [...s.frontLockTick] as FieldState['frontLockTick'],
    anchor: s.anchor.map(p => ({ ...p })),
    route: s.route.map(r => r.map(p => ({ ...p }))),
    grpWhy: [...s.grpWhy] as FieldState['grpWhy'],
    grpWhyTick: [...s.grpWhyTick] as FieldState['grpWhyTick'],
    used: [...s.used] as FieldState['used'],
    broken: [s.broken[0], s.broken[1]],
    log: { dropped: s.log.dropped, accepted: [...s.log.accepted], events: [...s.log.events] },
  }
}
