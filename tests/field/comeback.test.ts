/**
 * 뒤집을 손 · 진 고르기 · 돌격의 쾅 (docs/realm/battle-study/52-bodies-and-lines.md §6 · 51 §6·§8) — 엔진 계약이 뜻대로 서는가
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createField, sideMorale, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { hurtHero } from '../../src/field/hero.ts'
import { P } from '../../src/tune/params.ts'
import { LINE_SHIELD, LINE_WEDGE, LINE_WINGS, OP_STANCE, STANCE_CHARGE, STANCE_NONE, type LiveSetup } from '../../src/field/types.ts'

const withForms = (seed: number, f0: 0 | 1 | 2, f1: 0 | 1 | 2): LiveSetup => {
  const su = plainSetup(seed, 1200)
  return { ...su, sides: [{ ...su.sides[0], form: f0 }, { ...su.sides[1], form: f1 }] }
}

test('투지는 제 편 사기가 적보다 낮을 때만 차고 1000 에서 멈춘다', () => {
  const s = createField(plainSetup(1, 1200))
  for (const q of s.squads) if (q.side === 0) q.shock = 150
  for (let i = 0; i < 400 && s.end === null; i++) stepField(s)
  const ours = s.heroes.find(h => h.side === 0)!, foe = s.heroes.find(h => h.side === 1)!
  // 찬 투지는 적 AI 처럼 우리 장수(입력 없음)도 큰 외침에 쓴다 (gritN)
  assert.ok((ours.grit > 0 && ours.grit <= 1000) || ours.gritN > 0, `우리 투지 ${ours.grit} · 쓴 수 ${ours.gritN}`)
  assert.equal(foe.gritN, 0)
  assert.equal(foe.grit, 0)
})

test('적장을 장수가 쓰러뜨리면 그 편 대마다 사기가 heroSlainShock 뚝 (편 사기가 그만큼 내려간다)', () => {
  const s = createField(plainSetup(2, 1200))
  stepField(s)
  const before = sideMorale(s, 1)
  const e = s.heroes.find(h => h.side === 1)!
  hurtHero(s, e, P.field.heroHp + 1, true)
  stepField(s)
  const drop = before - sideMorale(s, 1)
  // 편 사기는 처음 사기에 견준 천분율 — 처음 700 에서 250 이 빠지면 약 357
  assert.ok(drop >= Math.trunc(P.field.heroSlainShock * 1000 / 700) - 20, `편 사기 ${before} → ${sideMorale(s, 1)}`)
})

test('버팀은 편 사기가 문턱 바로 위로 내려온 틱에 한 번', () => {
  const s = createField(plainSetup(3, 1200))
  stepField(s)
  for (const q of s.squads) if (q.side === 0) q.shock = 700 - 420 // 처음 사기의 60%
  stepField(s); stepField(s)
  const st = s.log.events.filter(e => e.kind === 'stand' && e.side === 0)
  assert.equal(st.length, 1)
  assert.equal(s.stood[0], 1)
  for (let i = 0; i < 50; i++) stepField(s)
  assert.equal(s.log.events.filter(e => e.kind === 'stand' && e.side === 0).length, 1, '판마다 한 번')
})

test('다시 섬은 달아나는 대가 장수 곁에 오면 대마다 한 번', () => {
  const s = createField(plainSetup(4, 1200))
  stepField(s)
  const h = s.heroes.find(e => e.side === 0)!
  const q = s.squads.find(x => x.side === 0 && x.grp === 'front')!
  q.shock += 500; q.u = h.u; q.v = h.v
  let seen = false
  for (let i = 0; i < 20 && !seen; i++) { stepField(s); seen = s.log.events.some(e => e.kind === 'regroup' && e.id === q.id) }
  assert.ok(seen, '다시 섬 사건')
  assert.equal(q.regrouped, 1)
})

test('돌격은 달려서 쾅(impact how 1)을 낸다 · 끝나면 기본 자세로', () => {
  const s = createField(withForms(3, LINE_WINGS, LINE_WINGS))
  for (let i = 0; i < 60; i++) stepField(s)
  stepField(s, [{ tick: s.tick, g: 0, op: OP_STANCE, u: STANCE_CHARGE, v: 0 }])
  let bang = false, ran = 0
  for (let i = 0; i < 150 && !bang; i++) {
    stepField(s)
    for (const q of s.squads) if (q.side === 0) ran = Math.max(ran, q.ran)
    bang = s.log.events.some(e => e.kind === 'impact' && e.side === 0 && e.id >= 0 && e.how === 1)
  }
  assert.ok(ran > 0, '달린 거리가 찬다')
  assert.ok(bang, '쾅')
  for (let i = 0; i < 200; i++) stepField(s)
  assert.ok(s.squads.filter(q => q.side === 0 && q.grp === 'front' && q.men > 0 && q.order === 0).every(q => q.stance === STANCE_NONE), '끝난 돌격의 자세')
})

test('진이 앞줄 병종과 기병 자리를 바꾼다 (병종을 안 주면)', () => {
  const kinds = (f: 0 | 1 | 2) => createField(withForms(1, f, f)).squads.filter(q => q.side === 0 && q.grp === 'front').map(q => q.kind)
  assert.deepEqual(kinds(LINE_SHIELD).filter(k => k === 'shield').length, 3)
  assert.deepEqual(kinds(LINE_WEDGE).filter(k => k === 'spear').length, 3)
  assert.deepEqual(kinds(LINE_WINGS).filter(k => k === 'shield').length, 2)
  // 넓은 날개는 기병이 더 바깥 · 더 앞
  const horse = (f: 0 | 1 | 2) => { const s = createField(withForms(1, f, f)); const fr = s.squads.filter(q => q.side === 0 && q.grp === 'front'); const hs = s.squads.filter(q => q.side === 0 && q.grp === 'horse'); return { out: Math.max(...hs.map(q => q.v)), u: Math.max(...hs.map(q => q.u)) - Math.max(...fr.map(q => q.u)) } }
  const a = horse(LINE_SHIELD), b = horse(LINE_WINGS)
  assert.ok(b.out > a.out && b.u > a.u, `날개 ${JSON.stringify(a)} → ${JSON.stringify(b)}`)
})

test('상성에 진 첫 맞물림·첫 화살은 대마다 한 번 kindFirstShock (2차)', () => {
  const s = createField(withForms(2, LINE_WEDGE, LINE_SHIELD))
  const shock0 = s.squads.map(q => q.shock)
  while (s.end === null && s.tick < 400) stepField(s)
  const hit = s.squads.filter(q => q.countered === 1)
  assert.ok(hit.length > 0, '상성 첫 맞음이 난다')
  for (const q of hit) assert.ok(q.shock - shock0[q.id]! >= P.field.kindFirstShock, `대 ${q.id} 충격 ${q.shock}`)
})

test('기병 날개는 장수가 앞서 걸어도 실제 앞줄보다 앞서지 않는다 (우리 기병만 혼자 먼저 닿던 것 · 2차)', () => {
  const s = createField(withForms(1, LINE_SHIELD, LINE_SHIELD))
  // 장수를 적 쪽으로 곧장 몬다 (방향 0 = +u)
  stepField(s, [{ tick: 0, g: 3, op: 5, u: 0, v: 1 }])
  let worst = -Infinity
  while (s.tick < 140) {
    stepField(s)
    const fr = s.squads.filter(q => q.side === 0 && q.grp === 'front' && q.men > 0)
    const fu = fr.reduce((a, q) => a + q.u, 0) / fr.length
    for (const q of s.squads) if (q.side === 0 && q.grp === 'horse' && q.lock < 0) worst = Math.max(worst, q.u - fu)
  }
  assert.ok(worst <= P.field.unit, `기병이 앞줄보다 ${(worst / P.field.unit).toFixed(1)}칸 앞`)
})

test('장수 밀침: 손으로 몰아 heroRunInCells 넘게 걸어 적 줄에 닿으면 heroBash (to · 방향) · 그 대 사기 heroBangShock (3차-나)', () => {
  const s = createField(plainSetup(1, 1200))
  stepField(s, [{ tick: 0, g: 3, op: 5, u: 0, v: 1 }])
  let ev: { to?: number; n: number } | undefined
  const shock0 = s.squads.map(q => q.shock)
  while (s.tick < 400 && !ev) { stepField(s); ev = s.log.events.find(e => e.kind === 'heroBash' && e.side === 0) }
  assert.ok(ev, '밀침이 난다')
  const q = s.squads[ev!.to!]!
  assert.equal(q.side, 1)
  assert.ok(q.shock - shock0[q.id]! >= P.field.heroBangShock)
  assert.ok(ev!.n >= 0 && ev!.n < 16)
  // 입력 없는 장수(적 AI)는 밀치지 않는다
  assert.ok(!s.log.events.some(e => e.kind === 'heroBash' && e.side === 1))
})
