import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'

/** 양쪽이 똑같은 판은 편 0 이 이기는 몫이 반 가까이여야 한다 (처리 차례·동점·시작 굴림이 한 편에 치우치면 여기서 걸린다) */
for (const men of [600, 1300, 2100]) {
  test(`대칭 판 2,000씨앗에서 편 0 승률이 46~54% (${men}명)`, () => {
    let w0 = 0
    for (let seed = 1; seed <= 2000; seed++) if (runField(plainSetup(seed, men)).winner === 0) w0++
    const rate = w0 / 2000
    assert.ok(rate >= 0.46 && rate <= 0.54, `편 0 승률 ${(rate * 100).toFixed(1)}%`)
  })
}

import { createField, stepField } from '../../src/field/sim.ts'
import { P } from '../../src/tune/params.ts'
import type { FieldState } from '../../src/field/types.ts'

const finish = (s: FieldState): FieldState => { while (s.end === null) stepField(s); return s }

/** 거울 판: 같은 씨앗의 시작 판에서 편 이름표를 뒤집고 u 를 거울로 — 엔진이 편 차례에 안 기대면 이긴 편이 정확히 뒤집힌다 */
test('거울 판 50씨앗: 편 이름표와 u 를 뒤집으면 이긴 편이 정확히 뒤집힌다 (비김은 비김)', () => {
  const mirror = (s: FieldState): void => {
    const L = s.map.u * P.field.unit
    for (const q of s.squads) { q.side = (1 - q.side) as 0 | 1; q.u = L - q.u; q.homeU = L - q.homeU }
    for (const h of s.heroes) { h.side = (1 - h.side) as 0 | 1; h.u = L - h.u }
    const c = s.map.camps
    ;(s.map as { camps: unknown }).camps = [{ ...c[1], u: s.map.u - c[1].u }, { ...c[0], u: s.map.u - c[0].u }]
  }
  let bad = 0
  for (const men of [600, 1300]) for (let seed = 1; seed <= 25; seed++) {
    const a = finish(createField(plainSetup(seed, men)))
    const b0 = createField(plainSetup(seed, men)); mirror(b0)
    const b = finish(b0)
    const flipped = a.winner === -1 ? -1 : 1 - a.winner
    if (b.winner !== flipped) bad++
  }
  assert.equal(bad, 0, `거울대로 안 뒤집힌 판 ${bad}/50`)
})

/** 차례 뒤집기: 배열 차례(id)만 바꿔도 결과가 글자 그대로 같아야 한다 */
test('차례 뒤집기 50씨앗: 대·장수 배열 차례만 바꿔도 이긴 편과 끝난 틱이 같다', () => {
  const reorder = (s: FieldState): void => {
    const sq = [...s.squads.filter(q => q.side === 1), ...s.squads.filter(q => q.side === 0)]
    const old = new Map(s.squads.map(q => [q.id, q]))
    sq.forEach((q, i) => { q.id = i })
    for (const q of sq) { if (q.lock >= 0) q.lock = old.get(q.lock)!.id; if (q.target >= 0) q.target = old.get(q.target)!.id }
    s.squads = sq
    s.heroes = [...s.heroes].reverse()
  }
  let bad = 0
  for (const men of [600, 1300]) for (let seed = 1; seed <= 25; seed++) {
    const a = finish(createField(plainSetup(seed, men)))
    const b0 = createField(plainSetup(seed, men)); reorder(b0)
    const b = finish(b0)
    if (a.winner !== b.winner || a.tick !== b.tick || a.end !== b.end) bad++
  }
  assert.equal(bad, 0, `결과가 달라진 판 ${bad}/50`)
})
