import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parse, serialize } from '../../src/field/rec.ts'
import { makeRng } from '../../src/core/rng.ts'
import type { FieldInput, InputGroup } from '../../src/field/types.ts'

const sample = (n: number, seed: number): FieldInput[] => {
  const r = makeRng(seed)
  return Array.from({ length: n }, (_, k) => ({ tick: k * 20 + r.int(0, 15), g: r.int(0, 3) as InputGroup, op: r.int(0, 1), u: r.int(0, 40960), v: r.int(0, 10240) }))
}

test('parse(serialize(x)) 는 같은 배열 · 빈 기록', () => {
  for (let s = 1; s <= 50; s++) {
    const x = sample(s % 70, s)
    assert.deepEqual(parse(serialize(x)), x)
  }
  assert.deepEqual(parse(''), [])
  assert.equal(serialize([]), '')
})

test('깨진 기록은 null (부분 재생 금지)', () => {
  for (const bad of ['1,0,0,a', 'x y,0,0,1,1', '1,9,0,1,1', '1,0,0,1,1;', '1,0,-1,1,1', '1,0,0,1,1;oops']) assert.equal(parse(bad), null, bad)
})

test('한 판 평균 20~60줄이 1KB 안쪽이다', () => {
  for (const n of [20, 40, 60]) {
    const text = serialize(sample(n, 7))
    assert.ok(text.length < 1024, `${n}줄 ${text.length}자`)
  }
})
