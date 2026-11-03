/**
 * 장터 저울 (merchant.applyScale · 위원회 11-04 림월드 ③)
 *  - 장터 일터가 없으면 없다 · 있으면 상단 없이도 판다/산다 · 값은 상단보다 나쁘다 · 달마다 한도(장터 단만큼)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { goodOf } from '../../src/realm/economy.ts'
import { hasScale, scaleLimit, scaleRoom, scaleSellPrice } from '../../src/realm/merchant.ts'
import { advance, planned } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm } from '../../src/realm/types.ts'

function withMarket(): Realm {
  const r = planned(byeonhanMini(1), [])
  r.nodes['our-cap'] = { ...r.nodes['our-cap']!, work: 'market' }
  r.stock['us']!.salt = 300
  r.stock['us']!.grain = 2000
  return r
}

describe('장터 저울', () => {
  it('장터가 없으면 저울도 없다', () => {
    const r = byeonhanMini(1)
    assert.equal(hasScale(r, 'us'), false)
    assert.equal(scaleLimit(r, 'us', 'salt', false), 0)
  })

  it('팔면 곡식이 들어오고 이번 달 몫이 준다 · 한도를 넘으면 아무 일 없다', () => {
    const r = withMarket()
    assert.equal(scaleRoom(r, 'us'), Math.round(P.realm.scaleCap))
    const lim = scaleLimit(r, 'us', 'salt', false)
    assert.ok(lim > 0)
    const plain = advance(r, []).next
    const { next, report } = advance(r, [{ kind: 'scale', faction: 'us', good: 'salt', n: lim, buy: false }])
    assert.equal(report.lines.filter((l) => l.kind === 'scale').length, 1)
    assert.ok(next.stock['us']!.grain - plain.stock['us']!.grain >= scaleSellPrice('salt', lim) - 1)
    const over = advance(r, [{ kind: 'scale', faction: 'us', good: 'salt', n: lim + 50, buy: false }])
    assert.equal(over.report.lines.filter((l) => l.kind === 'scale').length, 0)
  })

  it('사면 그 물건이 들어온다 · 상단보다 비싸다', () => {
    const r = withMarket()
    const n = scaleLimit(r, 'us', 'wood', true)
    assert.ok(n > 0)
    const before = goodOf(advance(r, []).next.stock['us'], 'wood')
    const after = goodOf(advance(r, [{ kind: 'scale', faction: 'us', good: 'wood', n, buy: true }]).next.stock['us'], 'wood')
    assert.ok(after - before >= n - 1)
    assert.ok(P.realm.scaleBuyMul > P.realm.merchantMarkup && P.realm.scaleSellRate < P.realm.merchantSellRate)
  })
})
