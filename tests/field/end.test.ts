import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createField, runField, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { hashField } from '../../src/field/state.ts'
import { P } from '../../src/tune/params.ts'
import type { FieldState } from '../../src/field/types.ts'

const MAX = (): number => P.field.timesMax * P.field.timeSec * P.field.hz

test('임시 AI 끼리 판은 사기나 사람으로 때를 다 쓰기 전에 끝나고 이긴 편이 있다 (사람 수 600~9000)', () => {
  let draws = 0, games = 0
  for (const men of [600, 1300, 2100, 5000, 9000]) {
    for (let seed = 1; seed <= 30; seed++) {
      const s = runField(plainSetup(seed, men))
      assert.ok(s.end === 'morale' || s.end === 'men', `${men}/${seed}: ${s.end}`)
      assert.ok(s.tick < MAX())
      assert.ok(s.winner === 0 || s.winner === 1 || s.winner === -1)
      games++
      if (s.winner === -1) draws++
      assert.ok(s.tick > 200, '맞붙기 전에 끝나지 않는다')
    }
  }
  assert.ok(draws <= games * 0.1, `비김이 너무 잦다 ${draws}/${games}`)
})

test('큰 사람 수에서도 값이 정수 범위 안이다 (대당 사람 수가 커진다)', () => {
  const s = runField(plainSetup(7, 9000))
  for (const q of s.squads) for (const n of [q.hp, q.men, q.menMax, q.morale, q.shock, q.u, q.v]) assert.ok(Number.isSafeInteger(n) && Math.abs(n) < 2 ** 31, `${q.id}: ${n}`)
  assert.equal(s.squads.filter(q => q.side === 0).length, 12)
})

test('사기 문턱이 없으면(처음 사기 0) 사람 문턱(남은 사람)으로 끝난다', () => {
  const setup = plainSetup(3, 1300)
  const flat = { ...setup, sides: [{ ...setup.sides[0], morale: 0 }, { ...setup.sides[1], morale: 0 }] as typeof setup.sides }
  const s = runField(flat)
  assert.equal(s.end, 'men')
  const loser = s.winner === 0 ? 1 : 0
  const left = s.squads.filter(q => q.side === loser).reduce((a, q) => a + q.men, 0)
  const start = s.squads.filter(q => q.side === loser).reduce((a, q) => a + q.menMax, 0)
  assert.ok(left * 1000 < start * Math.round(P.realm.tacBreakMen * 1000))
})

test('사기가 문턱 아래로 가면 바로 끝나고 진 쪽은 무너진 쪽이다', () => {
  const s = runField(plainSetup(5, 1300))
  assert.equal(s.end, 'morale')
  const loser = s.winner === 0 ? 1 : 0
  let mw = 0, mn = 0
  for (const q of s.squads) if (q.side === loser) { mw += q.menMax * q.morale; mn += q.menMax }
  assert.ok(mn > 0 && mw / mn < 700 * P.realm.tacBreakMorale + 1)
})

test('때를 다 쓰면 time · 남은 세기 몫으로 이김/비김 (맞붙지 못하면 비긴다)', () => {
  const s = createField(plainSetup(2, 1300))
  for (const q of s.squads) { q.manual = 1; q.goal = null }
  for (let i = 0; i < MAX() + 10; i++) stepField(s)
  assert.equal(s.end, 'time')
  assert.equal(s.tick, MAX())
  assert.equal(s.winner, -1)
})

test('물러남(op 3)은 언제든 바로 끝내고 우리가 진다', () => {
  const setup = plainSetup(4, 1300)
  const s = runField(setup, [{ tick: 50, g: 0, op: 3, u: 0, v: 0 }])
  assert.equal(s.end, 'retreat')
  assert.equal(s.winner, 1)
  assert.equal(s.tick, 50)
  assert.equal(hashField(s), hashField(runField(setup, [{ tick: 50, g: 0, op: 3, u: 0, v: 0 }])))
})

test('끝난 판의 끝 까닭·이긴 편이 같은 씨앗에서 같다', () => {
  const key = (s: FieldState): string => `${s.end}/${s.winner}/${s.tick}`
  for (let seed = 1; seed <= 40; seed++) assert.equal(key(runField(plainSetup(seed, 2100))), key(runField(plainSetup(seed, 2100))))
})
