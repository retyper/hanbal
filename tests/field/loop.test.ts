import { test } from 'node:test'
import assert from 'node:assert/strict'
import { advance } from '../../src/field/viewLoop.ts'

test('작은 dt 는 틱을 쌓아 두었다가 한 틱씩 낸다', () => {
  let a = advance(0, 40, 10, 4)
  assert.deepEqual(a, { ticks: 0, acc: 40 })
  a = advance(a.acc, 70, 10, 4)
  assert.equal(a.ticks, 1)
  assert.ok(Math.abs(a.acc - 10) < 1e-9)
})

test('탭에 돌아와 큰 dt 가 들어와도 틱은 maxCatchUp 이하이고 남은 시간은 버린다', () => {
  const a = advance(0, 60_000, 10, 4)
  assert.equal(a.ticks, 4)
  assert.equal(a.acc, 0)
})

test('음수·NaN dt 는 0 으로 본다', () => {
  assert.equal(advance(50, -5, 10, 4).ticks, 0)
  assert.equal(advance(50, Number.NaN, 10, 4).ticks, 0)
})
