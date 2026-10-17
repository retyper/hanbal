/**
 * 정보의 계약 — 보이는 범위는 언제나 참값을 품는다 (docs/realm/BUILD.md §3-1 · SYSTEMS §2-2)
 *
 * 1만 번: 참값을 관측하고, 규칙이 허락하는 만큼 아무렇게나 움직이게 둔 뒤, a 계절 낡은 범위가 참값을 품는지 본다.
 * 움직임은 clampUnseenChange 를 지나야 한다 — 그 함수가 지켜지는 한 계약도 지켜진다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { roll } from '../../src/core/rng.ts'
import { winChance } from '../../src/realm/battle.ts'
import {
  alertRange, clampUnseenChange, sight, visibleRange, winRange, type Source,
} from '../../src/realm/intel.ts'
import { P } from '../../src/tune/params.ts'

const SOURCES: Source[] = ['scout', 'spy', 'captive', 'merchant']

describe('정보의 계약', () => {
  it('보이는 범위는 언제나 참값을 품는다 — 1만 번', () => {
    for (let i = 0; i < 10000; i++) {
      const src = SOURCES[i % SOURCES.length]!
      const f0 = 50 + roll(3, i, 'f0') * 500
      const s = sight(f0, src, roll(3, i, 'u'))
      let f = f0
      const ageMax = P.realm.intelBlindAge - 1
      const age = Math.floor(roll(3, i, 'age') * (ageMax + 1))
      for (let a = 1; a <= age; a++) {
        // 규칙이 허락하는 범위 밖까지 마구 흔들어 본다 — clamp 가 막아야 한다
        const wild = f * (0.5 + roll(3, i, `move:${a}`) * 1.5)
        f = clampUnseenChange(f, wild)
      }
      const r = visibleRange(s, age)
      assert.ok(r !== null)
      assert.ok(f >= r[0] - 1e-9 && f <= r[1] + 1e-9, `#${i} ${src} a=${age}: ${f} ∉ [${r[0]}, ${r[1]}]`)
    }
  })

  it('척후가 이번 계절에 본 것은 한 숫자다 (범위 폭 0)', () => {
    const r = visibleRange(sight(240, 'scout', 0.37), 0)
    assert.ok(r !== null && r[0] === 240 && r[1] === 240)
  })

  it('넷째 계절부터는 "모름"', () => {
    assert.equal(visibleRange(sight(100, 'spy', 0.5), P.realm.intelBlindAge), null)
    assert.equal(alertRange(0.2, P.realm.intelBlindAge), null)
  })

  it('u 때문에 범위의 가운데가 참값이 아니다', () => {
    const r = visibleRange(sight(100, 'merchant', 0.9), 0)!
    assert.notEqual((r[0] + r[1]) / 2, 100)
  })

  it('같은 병력 50% 의 승률 범위: a=1 은 12pp 안팎 · a=2 는 22pp 안팎 (SYSTEMS §2-2 검산)', () => {
    const f = 100
    for (const [age, want] of [[1, 0.12], [2, 0.22]] as const) {
      const r = visibleRange(sight(f, 'scout', 0.5), age)!
      const w = winRange(f, r)
      assert.ok(Math.abs((w[1] - w[0]) - want) < 0.02, `a=${age}: ${w[1] - w[0]}`)
      assert.ok(w[0] <= winChance(f, f) && winChance(f, f) <= w[1])
    }
  })

  it('경계의 범위는 [0, 상한] 밖으로 안 나간다', () => {
    for (let a = 0; a < P.realm.intelBlindAge; a++) {
      for (const seen of [0, 0.1, 0.55, 0.6]) {
        const r = alertRange(seen, a)!
        assert.ok(r[0] >= 0 && r[1] <= P.realm.alertMax && r[0] <= seen && seen <= r[1])
      }
    }
  })
})
