/**
 * 난세 단계 (src/realm/tier.ts · VISION §5-2 ④) — 판을 열 때 이웃이 세진다
 *
 *  - 1단계는 그대로 · 단계가 오르면 이웃의 군대·창고만 커진다 (우리 것은 그대로) · 판에 단계가 적힌다
 *  - 천손(6)을 넘지 않는다 · 배우는 판은 안 바뀐다
 *  - 쉬움(촌장, 0)은 이웃이 약하고 우리 가을걷이가 넉넉하다 · 칭호는 일곱 (형 10-23: "쉬움 단계도 · 더 어려운 단계도 · 인정받을 만한 이름")
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { startRegion } from '../../src/realm/data/regions/index.ts'
import { LEVEL_LINE, LEVEL_NAME, TIER_MAX, applyTier, tierMul } from '../../src/realm/tier.ts'

const men = (r: ReturnType<typeof startRegion>, mine: boolean): number =>
  Object.values(r.armies).filter((a) => (a.faction === r.player) === mine).reduce((s, a) => s + Object.values(a.mix).reduce((x: number, n) => x + (n ?? 0), 0), 0)

describe('난세 단계', () => {
  it('1단계는 그대로', () => {
    const a = startRegion('yeongnam', 3, 'saro')
    const b = startRegion('yeongnam', 3, 'saro')
    applyTier(b, 1)
    assert.deepEqual(b, a)
  })

  it('단계가 오르면 이웃만 세진다 — 우리 군대·창고는 그대로', () => {
    const a = startRegion('yeongnam', 3, 'saro')
    const b = startRegion('yeongnam', 3, 'saro')
    applyTier(b, 5)
    assert.equal(b.tier, 5)
    assert.equal(men(b, true), men(a, true))
    assert.deepEqual(b.stock[b.player], a.stock[a.player])
    const m = tierMul(5)
    const ratio = men(b, false) / men(a, false)
    assert.ok(Math.abs(ratio - m.army) < 0.05, `군대 ${ratio} vs ${m.army}`)
    for (const f of Object.keys(a.stock)) if (f !== a.player) assert.ok(b.stock[f]!.grain >= a.stock[f]!.grain)
  })

  it('쉬움 — 이웃이 약하고 우리 걷이가 넉넉하다 · 칭호와 한 줄이 단계마다', () => {
    const a = startRegion('yeongnam', 3, 'saro')
    const b = startRegion('yeongnam', 3, 'saro')
    applyTier(b, 0)
    assert.equal(b.tier, 0)
    assert.ok(men(b, false) < men(a, false))
    assert.equal(men(b, true), men(a, true))
    assert.ok(tierMul(0).ours > 1 && tierMul(0).army < 1)
    assert.equal(LEVEL_NAME.length, TIER_MAX + 1)
    assert.equal(LEVEL_LINE.length, TIER_MAX + 1)
    // 단계가 오를수록 세다
    for (let t = 1; t < TIER_MAX; t++) assert.ok(tierMul(t + 1).army > tierMul(t).army)
  })

  it('천손을 넘지 않는다 · 배우는 판은 안 바뀐다', () => {
    assert.deepEqual(tierMul(99), tierMul(TIER_MAX))
    const t = startRegion('tutorial', 1, 'us')
    const u = startRegion('tutorial', 1, 'us')
    applyTier(u, 7)
    assert.deepEqual(u, t)
  })
})
