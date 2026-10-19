/**
 * 임무 전 연습 · 건너뛰기 (src/night/mission.ts · 형: "암살은 쏘기전에 연습모드 먼저 할수 있게 해줘. 건너뛰기 버튼도")
 *
 *  - 결과를 칠십팔국으로 보내는 것은 진짜 임무뿐 — 연습장·임무 전 연습은 안 보낸다
 *  - 연습의 지붕은 진짜 지붕과 다르다 (시드가 결코 같지 않다) · 연습마다 다른 지붕 · 같은 값이면 같은 시드
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { rehearsalSeed, reportsResult } from '../src/night/mission.ts'
import { createNight } from '../src/night/sim.ts'

describe('임무 전 연습 · 건너뛰기', () => {
  it('연습은 결과를 안 보낸다 — 진짜 임무만 보낸다', () => {
    assert.equal(reportsResult('mission'), true)
    assert.equal(reportsResult('rehearsal'), false)
    assert.equal(reportsResult('practice'), false)
  })

  it('연습의 지붕은 진짜와 다르다 · 연습마다 다르다 · 같은 값이면 같다', () => {
    for (const mission of [0, 1, 7, 123456789, 0xffffffff]) {
      const seen = new Set<number>()
      for (let n = 0; n < 20; n++) {
        const s = rehearsalSeed(mission, n)
        assert.notEqual(s, mission >>> 0)
        assert.ok(Number.isInteger(s) && s >= 0 && s <= 0xffffffff)
        assert.equal(s, rehearsalSeed(mission, n))
        seen.add(s)
      }
      assert.equal(seen.size, 20)
    }
    // 같은 활·같은 화살 — 다른 지붕 (배치가 다르다)
    const real = createNight({ seed: 7, bowTier: 1, arrows: 6 })
    const rehearse = createNight({ seed: rehearsalSeed(7, 0), bowTier: 1, arrows: 6 })
    assert.equal(real.w.arrowsLeft, rehearse.w.arrowsLeft)
    assert.notDeepEqual(JSON.stringify(real.scene), JSON.stringify(rehearse.scene))
  })
})
