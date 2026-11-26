import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createField, runField, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import type { FieldInput, FieldState, InputGroup } from '../../src/field/types.ts'
import { bothAi, finish, MAPS, mirror, reorder, shuffleWithinSides, squadKey, tag, U } from './kit.ts'

/** 양쪽이 똑같은 판은 편 0 이 이기는 몫이 반 가까이여야 한다 (처리 차례·동점·시작 굴림이 한 편에 치우치면 여기서 걸린다) */
for (const men of [600, 1300, 2100]) {
  test(`대칭 판 2,000씨앗에서 편 0 승률이 46~54% (${men}명)`, () => {
    let w0 = 0
    for (let seed = 1; seed <= 2000; seed++) if (runField(bothAi(plainSetup(seed, men))).winner === 0) w0++
    const rate = w0 / 2000
    assert.ok(rate >= 0.46 && rate <= 0.54, `편 0 승률 ${(rate * 100).toFixed(1)}%`)
  })
}

/**
 * 거울 판: 같은 씨앗의 시작 판에서 편 이름표를 뒤집고 u 를 L-1-u 로 (칸이 정확히 뒤집힌다 · 45 §4) —
 * 엔진이 편 차례·배열 차례에 안 기대면 이긴 편이 정확히 뒤집히고 끝난 틱·까닭이 같다. 모든 맵 · 장수 있음
 */
test('거울 판 (모든 맵 · L-1-u · 장수 있음): 이긴 편이 정확히 뒤집히고 끝난 틱이 같다', () => {
  const bad: string[] = []
  for (const [name, mk] of MAPS) for (const men of [600, 1300, 2100]) for (let seed = 1; seed <= 6; seed++) {
    const a = finish(createField(plainSetup(seed, men, true, mk())), name)
    const b0 = createField(plainSetup(seed, men, true, mk())); mirror(b0)
    const b = finish(b0, `${name} 거울`)
    const flipped = a.winner === -1 ? -1 : 1 - a.winner
    if (b.winner !== flipped || b.tick !== a.tick || b.end !== a.end) bad.push(`${name}/${men}/${seed}`)
  }
  assert.deepEqual(bad, [], `거울대로 안 뒤집힌 판 ${bad.length}`)
})

/** 씨앗마다 다른 손질 열 (자리 · 자세 · 맡김 · 장수) */
function inputsFor(seed: number): FieldInput[] {
  const out: FieldInput[] = []
  for (let k = 0; k < 18; k++) {
    const g = ((seed + k) % 4) as InputGroup
    const stance = k % 5 === 2 && g < 3
    out.push({ tick: 7 + k * 41 + (seed % 9), g, op: stance ? 2 : k % 6 === 5 ? 1 : 0, u: stance ? (seed + k) % 3 : U(30 + ((seed * 11 + k * 17) % 110)), v: stance ? 0 : U((seed * 5 + k * 7) % 40) })
  }
  return out
}

/** 차례 섞기: 같은 편 안에서 대 배열 차례만 섞어도 판이 글자 그대로 같다 — 모든 맵 · 입력 있음 · 장수 있음 (45 §1-2·3 · §4) */
test('같은 편 안 차례 섞기 (모든 맵 · 입력 · 장수): 대 상태·장수·이긴 편·끝난 틱이 같다', () => {
  const bad: string[] = []
  for (const [name, mk] of MAPS) for (const men of [600, 1300, 2100]) for (let seed = 1; seed <= 4; seed++) {
    const inputs = seed % 2 === 0 ? inputsFor(seed) : []
    const play = (shuffle: boolean): FieldState => {
      const s = createField(plainSetup(seed, men, true, mk()))
      tag(s)
      if (shuffle) reorder(s, shuffleWithinSides(seed * 31 + men))
      while (s.end === null) stepField(s, inputs.filter(i => i.tick === s.tick))
      return s
    }
    const a = play(false), b = play(true)
    const heroes = (s: FieldState): string => [...s.heroes].sort((x, y) => x.side - y.side).map(h => [h.side, h.u, h.v, h.hp, h.stun, h.rem].join(':')).join('|')
    if (squadKey(a) !== squadKey(b) || heroes(a) !== heroes(b) || a.winner !== b.winner || a.tick !== b.tick || a.end !== b.end) bad.push(`${name}/${men}/${seed}`)
  }
  assert.deepEqual(bad, [], `차례에 기댄 판 ${bad.length}`)
})

/** 편 덩어리 차례 뒤집기 (옛 시험 — 편 덩어리를 맞바꿔도 같다) */
test('편 덩어리 차례 뒤집기 50씨앗: 이긴 편과 끝난 틱이 같다', () => {
  let bad = 0
  for (const men of [600, 1300]) for (let seed = 1; seed <= 25; seed++) {
    const a = finish(createField(plainSetup(seed, men)))
    const b0 = createField(plainSetup(seed, men)); reorder(b0, qs => [...qs.filter(q => q.side === 1), ...qs.filter(q => q.side === 0)])
    const b = finish(b0)
    if (a.winner !== b.winner || a.tick !== b.tick || a.end !== b.end) bad++
  }
  assert.equal(bad, 0, `결과가 달라진 판 ${bad}/50`)
})
