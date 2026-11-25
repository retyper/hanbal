import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createField, runField, stepField } from '../../src/field/sim.ts'
import { hashField } from '../../src/field/state.ts'
import { parse, serialize } from '../../src/field/rec.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { P } from '../../src/tune/params.ts'
import type { FieldInput, FieldState, InputGroup } from '../../src/field/types.ts'

const SIZES = [600, 1300, 2100]
const U = (cells: number): number => cells * P.field.unit

/** 씨앗마다 다른 손질 열 — 한 때 상한(3)을 넘겨 버려지는 것도 섞인다 */
function inputsFor(seed: number): FieldInput[] {
  const out: FieldInput[] = []
  for (let k = 0; k < 24; k++) {
    const g = ((seed + k) % 4) as InputGroup
    out.push({ tick: 10 + k * 53 + (seed % 7), g, op: k % 5 === 4 ? 1 : 0, u: U(20 + ((seed * 7 + k * 13) % 120)), v: U((seed * 3 + k * 5) % 40) })
  }
  return out
}

function integersOnly(s: FieldState): void {
  for (const q of s.squads) for (const n of [q.u, q.v, q.men, q.hp, q.morale, q.target]) assert.ok(Number.isInteger(n) && !Object.is(n, -0))
  for (const e of s.heroes) for (const n of [e.u, e.v, e.hp, e.stun]) assert.ok(Number.isInteger(n) && !Object.is(n, -0))
}

test('빈 판 200씨앗 (1,000씨앗은 tools/field-bench.ts): 같은 씨앗 두 번 = 같은 해시 · 입력 기록 재생 = 같은 해시', () => {
  const seen = new Set<string>()
  for (let seed = 1; seed <= 200; seed++) {
    const setup = plainSetup(seed, SIZES[seed % 3]!)
    const inputs = seed % 2 === 0 ? inputsFor(seed) : []
    const a = runField(setup, inputs)
    const b = runField(setup, inputs)
    assert.ok(a.end !== null && a.end !== 'invalid' && a.tick <= P.field.timesMax * P.field.timeTicks)
    assert.equal(hashField(a), hashField(b), `seed ${seed}`)
    const replay = parse(serialize(a.log.accepted))
    assert.ok(replay)
    assert.equal(hashField(runField(setup, replay)), hashField(a), `재생 seed ${seed}`)
    if (seed <= 3 || seed === 200) integersOnly(a)
    seen.add(hashField(a))
  }
  assert.ok(seen.size > 180, `씨앗이 해시에 닿는다: ${seen.size}`)
})

test('틱을 하나씩 걸어도 runField 와 같다 · 끝난 판은 더 안 걷는다', () => {
  const setup = plainSetup(5, 1300)
  const inputs = inputsFor(5)
  const s = createField(setup)
  for (let t = 0; s.end === null; t++) stepField(s, inputs.filter(i => i.tick === t))
  assert.equal(hashField(s), hashField(runField(setup, inputs)))
  const h = hashField(s)
  stepField(s); stepField(s)
  assert.equal(hashField(s), h)
})

test('두 편이 걸어 서로 다가간다 (대 수는 무리마다 4 이하, 사람 수는 합이 같다)', () => {
  for (const men of SIZES) {
    const setup = plainSetup(1, men)
    const s0 = createField(setup)
    for (const side of [0, 1] as const) for (const grp of ['front', 'bows', 'horse'] as const) {
      const qs = s0.squads.filter(q => q.side === side && q.grp === grp)
      assert.ok(qs.length >= 1 && qs.length <= P.field.squadsPerGroupMax)
      assert.equal(qs.reduce((a, q) => a + q.men, 0), setup.sides[side].men[grp])
    }
    const near = (s: FieldState): number => Math.min(...s.squads.filter(q => q.side === 0).flatMap(q => s.squads.filter(e => e.side === 1).map(e => Math.abs(q.u - e.u))))
    const s = runField(setup, [], 200)
    assert.ok(near(s) < near(s0), '가까워졌다')
    const full = runField(setup)
    assert.ok(full.squads.filter(q => q.side === 0).every(q => q.u > s0.squads[q.id]!.u), '앞으로 나아갔다')
  }
})

test('한 때에 무리당 입력 3개까지 · 넘치면 버리고 센다 · 다음 때에 다시 받는다', () => {
  const setup = plainSetup(2, 1300)
  const mv = (tick: number, k: number): FieldInput => ({ tick, g: 0, op: 0, u: U(30 + k), v: U(10) })
  const s = runField(setup, [mv(1, 0), mv(2, 1), mv(3, 2), mv(4, 3), mv(5, 4), mv(P.field.timeTicks + 1, 5)])
  assert.equal(s.log.dropped, 2)
  assert.equal(s.log.accepted.length, 4)
  const w = runField(setup, [{ tick: 1, g: 0, op: 0, u: U(9999), v: 0 }, { tick: 2, g: 0, op: 7, u: 0, v: 0 }])
  assert.equal(w.log.dropped, 2)
})

test('손으로 몬 무리는 그 자리로 간다', () => {
  const s = runField(plainSetup(3, 1300), [{ tick: 1, g: 0, op: 0, u: U(50), v: U(10) }], 600)
  for (const q of s.squads.filter(q => q.side === 0 && q.grp === 'front')) assert.deepEqual([q.u, q.v], [U(50), U(10)])
})

test('무효 시작은 던지지 않고 invalid 로 끝난다 (음수 · 빈 편 · 소수 · 몸 수 상한)', () => {
  const ok = plainSetup(1, 1300)
  const withMen = (men: { front: number; bows: number; horse: number }) => ({ ...ok, sides: [{ ...ok.sides[0], men }, ok.sides[1]] as typeof ok.sides })
  assert.equal(runField(withMen({ front: -1, bows: 0, horse: 0 })).end, 'invalid')
  assert.equal(runField(withMen({ front: 0, bows: 0, horse: 0 })).end, 'invalid')
  assert.equal(runField(withMen({ front: 1.5, bows: 0, horse: 0 })).end, 'invalid')
  // 대 수는 무리마다 4 로 고정이라 사람이 아무리 많아도 몸 수는 그대로다 (대당 사람 수가 변한다)
  const huge = createField(withMen({ front: 100000, bows: 100000, horse: 100000 }))
  assert.equal(huge.end, null)
  assert.equal(huge.squads.filter(q => q.side === 0).length, 12)
  // 몸 수 상한을 넘는 판 (상한을 낮춰 본다)
  const was = P.field.bodiesMax
  ;(P.field as { bodiesMax: number }).bodiesMax = 5
  try { assert.equal(createField(ok).end, 'invalid') } finally { (P.field as { bodiesMax: number }).bodiesMax = was }
})
