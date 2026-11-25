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
