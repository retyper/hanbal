import { it } from 'node:test'
import { HAEBI_RUN } from '../src/tune/params.ts'
import assert from 'node:assert/strict'
import { createHaebi, stepHaebi, choose, runDuration } from '../src/raid/haebi.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'
it('vanguard starts awakened and ordinary inputs clear three sequential captains within three minutes', () => {
  const s = createHaebi(7, 'vanguard')
  assert.deepEqual(s.combos, ['cyclone', 'torrent']); assert.equal(runDuration(s), 180)
  let last = 0
  while (s.state === 'playing') {
    if (s.offers.length) choose(s, botChoice(s, 'storm')); else stepHaebi(s, botInput(s), 1 / 120)
    assert.ok(s.breaches >= last && s.breaches <= last + 1); last = s.breaches
  }
  assert.equal(s.state, 'won'); assert.equal(s.breaches, 3); assert.ok(s.t >= 115 && s.t <= 180)
  assert.ok(s.kills > 1000)
  const before = JSON.stringify(s); stepHaebi(s, { x: 0, y: 0 }, .05); assert.equal(JSON.stringify(s), before)
})
it('timeout and defeat preserve secured partial progress; normal trial runs the full raid length (11-16: 10분 → 15분)', () => {
  const s = createHaebi(9, 'vanguard'); s.breaches = 1; s.captains = 1; s.t = 179.99
  stepHaebi(s, { x: 0, y: 0 }, .05); assert.equal(s.state, 'lost'); assert.equal(s.breaches, 1)
  const fail = createHaebi(9, 'vanguard'); fail.hp = -10; fail.breaches = 2; fail.captains = 2
  stepHaebi(fail, { x: 0, y: 0 }, .01); assert.equal(fail.state, 'lost'); assert.equal(fail.breaches, 2)
  const normal = createHaebi(); assert.equal(runDuration(normal), HAEBI_RUN.duration); assert.equal(normal.level, 1); assert.equal(normal.combos.length, 0)
})
