/**
 * 떠돌이 상단 (merchant.ts · 형 11-03 "쇼핑")
 *  - merchantEvery 턴에 플레이어 나라에 들러 merchantStay 턴 머물고 떠난다
 *  - 사면 곡식이 줄고 물건이 생긴다 · 개수가 한정 · 곡식이 모자라면 안 산다
 *  - 팔면 곡식이 는다 · 한 번에 merchantSellCap 까지
 *  - 같은 판이면 같은 물건 (A1)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { marketOf, sellLimit } from '../../src/realm/merchant.ts'
import { goodOf } from '../../src/realm/economy.ts'
import { advance } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm } from '../../src/realm/types.ts'

function untilMarket(r0: Realm): Realm {
  let r = r0
  for (let i = 0; i < 40 && marketOf(r, r.player) === null; i++) r = advance(r, []).next
  return r
}

describe('떠돌이 상단', () => {
  it('때가 되면 들르고, 머물다 떠난다', () => {
    const r = untilMarket(byeonhanMini(1))
    const m = marketOf(r, r.player)
    assert.ok(m !== null)
    assert.equal(m!.offers.length, Math.round(P.realm.merchantSlots))
    let x = r
    for (let i = 0; i < Math.round(P.realm.merchantStay); i++) x = advance(x, []).next
    assert.equal(marketOf(x, x.player), null)
  })

  it('사면 곡식이 줄고 물건이 생긴다 · 개수가 한정', () => {
    const r = untilMarket(byeonhanMini(1))
    r.stock[r.player]!.grain = 5000
    const of = marketOf(r, r.player)!.offers.find((o) => o.what === 'good' || o.what === 'ingot') ?? marketOf(r, r.player)!.offers[0]!
    const buys = Array.from({ length: of.left + 1 }, () => ({ kind: 'buy' as const, faction: r.player, offer: of.id }))
    const { next, report } = advance(r, buys)
    assert.equal(report.lines.filter((l) => l.kind === 'buy').length, of.left) // 남은 개수까지만
    if (of.good !== undefined) assert.ok(goodOf(next.stock[r.player], of.good) >= goodOf(r.stock[r.player], of.good) + of.n * of.left - 1)
  })

  it('곡식이 모자라면 못 산다', () => {
    const r = untilMarket(byeonhanMini(1))
    r.stock[r.player]!.grain = 0
    const of = marketOf(r, r.player)!.offers[0]!
    const { report } = advance(r, [{ kind: 'buy', faction: r.player, offer: of.id }])
    assert.equal(report.lines.filter((l) => l.kind === 'buy').length, 0)
  })

  it('팔면 곡식이 는다 · 한도까지', () => {
    const r = untilMarket(byeonhanMini(1))
    r.stock[r.player]!.salt = 1000
    const lim = sellLimit(r, r.player, 'salt')
    assert.ok(lim > 0 && lim < 1000)
    const { report } = advance(r, [{ kind: 'sell', faction: r.player, good: 'salt', n: lim + 1 }])
    assert.equal(report.lines.filter((l) => l.kind === 'sell').length, 0) // 한도 넘으면 아무 일도
    const ok = advance(r, [{ kind: 'sell', faction: r.player, good: 'salt', n: lim }])
    const sold = ok.report.lines.find((l) => l.kind === 'sell')
    assert.ok(sold !== undefined && sold.kind === 'sell' && sold.grain <= P.realm.merchantSellCap)
  })

  it('같은 판이면 같은 물건', () => {
    const a = untilMarket(byeonhanMini(3))
    const b = untilMarket(byeonhanMini(3))
    assert.deepEqual(marketOf(a, a.player)!.offers, marketOf(b, b.player)!.offers)
  })
})
