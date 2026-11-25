import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clamp, dist2, idiv, isqrt, stepToward } from '../../src/field/num.ts'

test('isqrt: 0~10^6 전부 정확한 정수 제곱근이다', () => {
  for (let n = 0; n <= 1_000_000; n++) {
    const r = isqrt(n)
    assert.ok(r * r <= n && (r + 1) * (r + 1) > n, `n=${n} r=${r}`)
  }
})

test('isqrt: 큰 수(격자 거리 제곱 범위)와 완전제곱 곁', () => {
  for (const r of [46340, 65535, 65536, 1_000_003, 94_906_265]) {
    assert.equal(isqrt(r * r), r)
    assert.equal(isqrt(r * r - 1), r - 1)
    assert.equal(isqrt(r * r + 1), r)
  }
  assert.equal(isqrt(-5), 0)
})

test('idiv 는 0 쪽으로 자르고 -0 을 내지 않는다', () => {
  assert.equal(idiv(7, 2), 3)
  assert.equal(idiv(-7, 2), -3)
  assert.ok(Object.is(idiv(-1, 5), 0))
  assert.ok(Object.is(idiv(0, -5), 0))
})

test('stepToward: 정수 · 닿으면 도착점 · 길이는 speed 이하', () => {
  assert.deepEqual(stepToward(0, 0, 10, 0, 20), { u: 10, v: 0 })
  assert.deepEqual(stepToward(0, 0, 100, 0, 30), { u: 30, v: 0 })
  assert.deepEqual(stepToward(0, 0, 0, -100, 30), { u: 0, v: -30 })
  for (let ax = -300; ax <= 300; ax += 37) for (let ay = -300; ay <= 300; ay += 41) {
    const p = stepToward(ax, ay, 500, -250, 76)
    assert.ok(Number.isInteger(p.u) && Number.isInteger(p.v))
    assert.ok(dist2(ax, ay, p.u, p.v) <= 76 * 76)
    assert.ok(dist2(p.u, p.v, 500, -250) < dist2(ax, ay, 500, -250))
  }
})

test('clamp · dist2', () => {
  assert.equal(clamp(5, 0, 3), 3); assert.equal(clamp(-1, 0, 3), 0); assert.equal(clamp(2, 0, 3), 2)
  assert.equal(dist2(0, 0, 3, 4), 25)
})
