import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createField, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { P } from '../../src/tune/params.ts'
import type { FieldState, Grp, Squad } from '../../src/field/types.ts'

const U = (cells: number): number => cells * P.field.unit

/** 두 대만 남기고(나머지는 사람 0) 손으로 세운 한 판 — 목표 없이 제자리에서 맞붙는다 */
function duel(a: Partial<Squad> & { grp?: Grp }, b: Partial<Squad> & { grp?: Grp }, men = 1300, hero = false): { s: FieldState; A: Squad; B: Squad } {
  const s = createField(plainSetup(1, 1300, hero))
  const pick = (side: 0 | 1, grp: Grp): Squad => s.squads.find(q => q.side === side && q.grp === grp)!
  const A = pick(0, a.grp ?? 'front'), B = pick(1, b.grp ?? 'front')
  for (const q of s.squads) if (q !== A && q !== B) { q.men = 0; q.hp = 0 }
  for (const [q, o] of [[A, a], [B, b]] as const) {
    Object.assign(q, { men: men, menMax: men, hp: men * 1000, goal: null, manual: 1 }, o)
    q.hp = q.men * 1000
    q.menMax = q.men
  }
  A.u = U(50); A.v = U(20); B.u = U(50) + (b.u ?? U(1)); B.v = U(20) + (b.v ?? 0)
  if (b.u === undefined) B.u = U(51)
  return { s, A, B }
}
const run = (s: FieldState, ticks: number): void => { for (let i = 0; i < ticks && s.end === null; i++) stepField(s) }
const lostShare = (q: Squad): number => 1 - q.hp / (q.menMax * 1000)

test('맞붙는 거리 안은 서로 치고 밖은 안 친다', () => {
  const near = duel({}, {}); run(near.s, 20)
  assert.ok(near.A.hp < near.A.menMax * 1000 && near.B.hp < near.B.menMax * 1000)
  const far = duel({}, { u: U(P.field.meleeRangeCells + 3) }); run(far.s, 20)
  assert.equal(far.A.hp, far.A.menMax * 1000)
  assert.equal(far.B.hp, far.B.menMax * 1000)
})

test('활은 쏘는 거리에서 앞줄을 치고 앞줄은 그 거리에서 못 친다', () => {
  const d = duel({ grp: 'bows' }, { grp: 'front', u: U(P.field.bowRangeCells) })
  run(d.s, 20)
  assert.ok(d.B.hp < d.B.menMax * 1000, '활이 맞췄다')
  assert.equal(d.A.hp, d.A.menMax * 1000, '앞줄은 못 닿는다')
  const out = duel({ grp: 'bows' }, { grp: 'front', u: U(P.field.bowRangeCells + 1) }); run(out.s, 20)
  assert.equal(out.B.hp, out.B.menMax * 1000)
})

test('앞줄 세모: 방진 > 돌격 > 길 트기 > 방진 (이긴 쪽이 덜 잃는다)', () => {
  for (const [a, d] of [[1, 0], [0, 2], [2, 1]] as const) {
    const t = duel({ stance: a }, { stance: d })
    run(t.s, 60)
    assert.ok(lostShare(t.A) < lostShare(t.B), `자세 ${a} 가 ${d} 를 이긴다: ${lostShare(t.A).toFixed(3)} < ${lostShare(t.B).toFixed(3)}`)
  }
})

test('많은 쪽이 이기고 사기는 잃은 몫을 따라 줄기만 한다', () => {
  const t = duel({ men: 900 }, { men: 400 })
  let prev = t.B.morale
  for (let i = 0; i < 80; i++) {
    stepField(t.s)
    assert.ok(t.B.morale <= prev, '사기가 오르지 않는다')
    prev = t.B.morale
  }
  assert.ok(lostShare(t.B) > lostShare(t.A))
  assert.ok(t.B.morale < t.A.morale)
})

test('옆구리를 맞으면 더 잃고 사기가 더 꺾인다', () => {
  const front = duel({ stance: 1 }, { stance: 1 })
  const side = duel({ stance: 1 }, { stance: 1 }, 1300)
  side.B.u = side.A.u; side.B.v = side.A.v + U(P.field.flankVCells) + 1
  run(front.s, 40); run(side.s, 40)
  assert.ok(side.B.hp < front.B.hp, '옆에서 친 쪽이 더 깎는다')
  assert.ok(side.B.shock > 0 && front.B.shock === 0)
})

test('장수는 곁의 적 앞줄에 깎여 쓰러지면 몇 초 못 움직이고 죽지 않는다 (그 편 사기가 꺾인다)', () => {
  const d = duel({}, {}, 1300, true)
  const h = d.s.heroes[0]!
  h.u = d.B.u; h.v = d.B.v; h.manual = 1; h.goal = null
  let downs = 0
  for (let i = 0; i < 400 && d.s.end === null; i++) {
    stepField(d.s)
    assert.ok(h.hp > 0, '죽지 않는다')
    if (h.stun === P.field.heroStunTicks) { downs++; assert.equal(h.hp, P.field.heroHp) }
  }
  assert.ok(downs >= 1, `쓰러졌다 ${downs}`)
})

test('입력: 자세 바꿈은 우리 편 무리만, 범위 밖 자세는 버린다', () => {
  const s = createField(plainSetup(1, 1300))
  stepField(s, [{ tick: 0, g: 0, op: 2, u: 2, v: 0 }, { tick: 0, g: 0, op: 2, u: 9, v: 0 }])
  assert.ok(s.squads.filter(q => q.side === 0 && q.grp === 'front').every(q => q.stance === 2))
  assert.equal(s.log.dropped, 1)
})
