import { test } from 'node:test'
import assert from 'node:assert/strict'
import { duelMuOf } from '../src/duel/power.ts'
import { createDuel, judgeWindows, stepDuel } from '../src/duel/sim.ts'
import { P } from '../src/tune/params.ts'

test('손 겨루기는 보검·비파형동검 강화 효과를 더하고 기본 능력치는 보존한다', () => {
  const hero = { mu: 9, relics: ['dagger', 'bipa'], relicLv: { dagger: 3, bipa: 2 } }
  const before = structuredClone(hero)
  const expected = hero.mu + P.realm.relicDaggerDuel + P.realm.relicBipaDuel + 3 * P.realm.relicUpInt
  assert.equal(duelMuOf(hero), expected)
  assert.ok(duelMuOf(hero) > 10, '자동 겨루기처럼 유물의 겨루기 전용 무예는 10에서 자르지 않는다')
  assert.deepEqual(hero, before)
})

test('장착하지 않았거나 일반 무예 유물만 있으면 이미 적용된 무예를 중복해서 더하지 않는다', () => {
  assert.equal(duelMuOf({ mu: 6 }), 6)
  assert.equal(duelMuOf({ mu: 7, relics: ['sehyeong'] }), 7)
  assert.equal(duelMuOf({ mu: 6, relics: ['unknown'] }), 6)
})

test('겨루기 유물은 우리 받아치기 폭과 적의 준비시간에 실제로 반영된다', () => {
  const base = { mu: 5 }
  const equipped = { mu: 5, relics: ['dagger'] }
  assert.ok(judgeWindows(duelMuOf(equipped)).early > judgeWindows(duelMuOf(base)).early)
  const lead = (muFoe: number): number => {
    const duel = createDuel({ seed: 1, muMe: 5, muFoe })
    while (duel.cues.length === 0) stepDuel(duel)
    const cue = duel.cues[0]!
    return cue.hitAt - cue.t0
  }
  assert.ok(lead(duelMuOf(equipped)) < lead(duelMuOf(base)))
})
