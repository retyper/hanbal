import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createField, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { stakeMap } from '../../src/field/map.ts'
import { P } from '../../src/tune/params.ts'
import type { FieldState, Grp, Squad } from '../../src/field/types.ts'
import { assertInts, keepOnly, pick, place, run, U } from './kit.ts'

/** 두 대만 남기고(나머지는 배열에서 뺀다) 손으로 세운 한 판 — 목표 없이 제자리에서 맞붙는다 */
function duel(a: Partial<Squad> & { grp?: Grp }, b: Partial<Squad> & { grp?: Grp }, men = 1300, hero = false): { s: FieldState; A: Squad; B: Squad } {
  const s = createField(plainSetup(1, 1300, hero))
  const A = pick(s, 0, a.grp ?? 'front'), B = pick(s, 1, b.grp ?? 'front')
  keepOnly(s, [A, B])
  for (const [q, o] of [[A, a], [B, b]] as const) {
    Object.assign(q, { men: men, menMax: men, hp: men * 1000, goal: null, manual: 1 }, o)
    q.hp = q.men * 1000
    q.menMax = q.men
  }
  A.u = U(50); A.v = U(20); B.u = U(50) + (b.u ?? U(1)); B.v = U(20) + (b.v ?? 0)
  if (b.u === undefined) B.u = U(51)
  return { s, A, B }
}
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
  assertInts(t.s)
  assert.ok(lostShare(t.B) > lostShare(t.A))
  assert.ok(t.B.morale < t.A.morale)
})

test('향 (52 §1-1): 맞는 대가 보는 쪽 기준 앞 90° 는 정면 · 옆은 sideHitPermille · 뒤 90° 는 rearHitPermille 로 더 깎고 옆구리를 센다', () => {
  /** 적 앞줄 B (편 1 · −u 를 본다) 를 우리 기병 A2 가 정면 · 옆 · 뒤에서 친다 (몸이 맞닿는 자리) */
  const build = (at: 'front' | 'side' | 'rear') => {
    const s = createField(plainSetup(1, 1300, false))
    const A2 = pick(s, 0, 'horse'), B = pick(s, 1, 'front')
    keepOnly(s, [A2, B])
    for (const q of [A2, B]) Object.assign(q, { goal: null, manual: 1, stance: 1, men: 600, menMax: 600, hp: 600000 })
    B.u = U(50); B.v = U(20)
    if (at === 'front') { A2.u = B.u - U(2.5); A2.v = B.v }
    else if (at === 'side') { A2.u = B.u; A2.v = B.v + U(3) }
    else { A2.u = B.u + U(2.5); A2.v = B.v }
    return { s, B }
  }
  // B 가 돌기 전 몇 틱만 본다 (보병은 turnFrontTicks 마다 한 눈금)
  const ticks = 3
  const front = build('front'), side = build('side'), rear = build('rear')
  run(front.s, ticks); run(side.s, ticks); run(rear.s, ticks)
  assert.equal(front.B.flank, 0)
  assert.equal(side.B.flank, ticks)
  assert.equal(rear.B.flank, ticks)
  const lost = (x: { B: Squad }): number => x.B.menMax * 1000 - x.B.hp
  assert.ok(lost(side) > lost(front) && lost(rear) > lost(side), `${lost(front)} < ${lost(side)} < ${lost(rear)}`)
  assert.ok(side.B.morale < front.B.morale)
})

test('손으로 몬 대(목표 없음)도 옆구리를 맞는다 — 보는 쪽은 가장 가까운 적', () => {
  const s = createField(plainSetup(1, 1300, false))
  const a = pick(s, 0, 'bows'), f = pick(s, 1, 'front'), h = pick(s, 1, 'horse')
  keepOnly(s, [a, f, h])
  place(a, 50, 20); place(f, 51, 20); place(h, 50, 20 + P.field.flankVCells + 0.5)
  a.target = -1
  run(s, 10)
  assert.ok(a.flank > 0, '정면 앞줄을 보는 활이 옆 기병에게 옆구리를 맞는다')
})

test('장수: 곁의 적에 사람 수 비례로 깎여 쓰러지면 몇 초 못 움직이고 죽지 않는다 (그 편 사기가 꺾인다)', () => {
  const d = duel({}, {}, 1300, true)
  const h = d.s.heroes[0]!
  h.u = d.B.u; h.v = d.B.v; h.manual = 1; h.goal = null
  let downs = 0
  for (let i = 0; i < 400 && d.s.end === null; i++) {
    stepField(d.s)
    assert.ok(h.hp > 0, '죽지 않는다')
    if (h.stun === (P.field.heroStunSec * P.field.hz)) { downs++; assert.equal(h.hp, P.field.heroHp) }
  }
  assertInts(d.s)
  assert.ok(downs >= 1, `쓰러졌다 ${downs}`)
  // 사람 수 비례: 곁의 적 100 명과 400 명은 4배
  const hit = (men: number): number => {
    const t = duel({}, { men }, 1300, true)
    const e = t.s.heroes[0]!
    e.u = t.B.u - U(1); e.v = t.B.v; e.manual = 1; e.goal = null; e.mu = 0 // 장수의 칼을 끄고 맞는 몫만 잰다
    t.A.u = U(20)
    run(t.s, 30)
    return P.field.heroHp - e.hp
  }
  // 사람 수 비례 (틱마다 내림이라 ±4 안 · heroHitPerSec 90 부터 100명 몫이 소수)
  assert.ok(Math.abs(hit(400) - 4 * hit(100)) <= 4, `${hit(400)} · 4 × ${hit(100)}`)
  assert.equal(hit(400), Math.trunc(400 * P.field.heroHitPerSec * 30 / (P.field.squadMenRef * P.field.hz)))
})

test('장수는 멀쩡한 목책 너머·잠든 대에게는 안 맞는다', () => {
  const s = createField(plainSetup(1, 1300, true, stakeMap()))
  const wall = s.map.pieces[0]!
  const B = pick(s, 1, 'front')
  keepOnly(s, [pick(s, 0, 'front'), B])
  const h = s.heroes.find(e => e.side === 0)!
  Object.assign(h, { u: U(wall.u0) - 1, v: U(wall.v0 + 2), manual: 1, goal: null })
  place(B, wall.u0 + 1, wall.v0 + 2)
  B.u = U(wall.u1)
  s.squads[0]!.u = U(20)
  run(s, 30)
  assert.equal(h.hp, P.field.heroHp, '목책 너머')
  const t = createField(plainSetup(1, 1300, true))
  const C = pick(t, 1, 'front')
  keepOnly(t, [pick(t, 0, 'front'), C])
  const g = t.heroes.find(e => e.side === 0)!
  Object.assign(g, { u: U(60), v: U(20), manual: 1, goal: null, mu: 0 }) // 칼을 끈다 (치면 깨운다)
  place(C, 61, 20); C.sleep = 100
  t.squads[0]!.u = U(20)
  run(t, 30)
  assert.equal(g.hp, P.field.heroHp, '잠든 대')
})

test('입력: 자세 바꿈은 우리 편 무리만, 범위 밖 자세는 버린다', () => {
  const s = createField(plainSetup(1, 1300))
  stepField(s, [{ tick: 0, g: 0, op: 2, u: 2, v: 0 }, { tick: 0, g: 0, op: 2, u: 9, v: 0 }])
  assert.ok(s.squads.filter(q => q.side === 0 && q.grp === 'front').every(q => q.stance === 2))
  assert.equal(s.log.dropped, 1)
})
