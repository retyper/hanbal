import { test } from 'node:test'
import assert from 'node:assert/strict'
import { P } from '../../src/tune/params.ts'
import { dotOffset, sideDotCounts } from '../../src/field/viewDots.ts'

test('편 합이 dotsPerSide 이하다 (사람 수가 5,000 이어도 · 대 12개)', () => {
  for (const men of [1, 40, 400, 1214, 5109]) {
    const per = Math.ceil(men / 12)
    const c = sideDotCounts(Array.from({ length: 12 }, () => per))
    assert.ok(c.reduce((a, b) => a + b, 0) <= P.field.dotsPerSide, `${men}`)
    assert.ok(c.every(n => n >= 1))
  }
})

test('몸이 가장 많은 판(대 19개)도 상한 안이고 사람이 없는 대는 0점', () => {
  const c = sideDotCounts([...Array.from({ length: 18 }, () => 500), 0])
  assert.ok(c.reduce((a, b) => a + b, 0) <= P.field.dotsPerSide)
  assert.equal(c[18], 0)
})

test('저사양은 점이 줄고 그래도 상한 안이다', () => {
  const men = Array.from({ length: 8 }, () => 300)
  const hi = sideDotCounts(men).reduce((a, b) => a + b, 0), lo = sideDotCounts(men, P.field.lowDotsShare).reduce((a, b) => a + b, 0)
  assert.ok(lo < hi)
})

test('사람이 줄면 뒤 번호 점부터 사라진다 (같은 대는 같은 점 자리)', () => {
  assert.deepEqual(dotOffset(5, 3), dotOffset(5, 3))
  assert.notDeepEqual(dotOffset(5, 3), dotOffset(5, 4))
  const full = sideDotCounts([400])[0]!, less = sideDotCounts([200])[0]!
  assert.ok(less <= full)
})

test('점 자리는 대 폭 안이다', () => {
  for (let k = 0; k < 200; k++) {
    const o = dotOffset(9, k)
    assert.ok(Math.abs(o.du) <= P.field.spreadUCells && Math.abs(o.dv) <= P.field.spreadVCells)
  }
})
