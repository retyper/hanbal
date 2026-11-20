import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RaidEnding } from '../src/raid/ending.ts'
import { createHaebi } from '../src/raid/haebi.ts'

test('victory waits 3.8 visible seconds; one stamp and no sim mutation', () => {
  const s = createHaebi(49, 'stage', 'bow'), end = new RaidEnding()
  end.observe(s); assert.equal(end.active, false)
  s.state = 'won'; end.observe(s); const snapshot = JSON.stringify(s)
  assert.deepEqual(end.events(), { start: true, stamp: false })
  end.advance(10, false); assert.equal(end.elapsed, 0)
  end.advance(.4, true); assert.equal(end.effectTime, 0)
  end.advance(1.7, true); assert.equal(end.events().stamp, true); assert.equal(end.events().stamp, false)
  assert.equal(end.ready, false); end.advance(1.7, true); assert.equal(end.ready, true)
  assert.equal(JSON.stringify(s), snapshot)
})
test('defeat lasts 3.2s and retreat 2s without stamp; skip and new run reset', () => {
  const s = createHaebi(49, 'stage', 'bow'), end = new RaidEnding()
  s.hp = 0; s.state = 'lost'; end.observe(s); assert.equal(end.kind, 'defeat'); assert.equal(end.duration, 3.2)
  end.skip(); assert.equal(end.ready, true)
  const next = createHaebi(50, 'stage', 'bow'); end.observe(next); assert.equal(end.kind, null)
  next.state = 'lost'; end.observe(next); assert.equal(end.kind, 'retreat')
  end.advance(2, true); assert.equal(end.ready, true); assert.equal(end.events().stamp, false)
})
