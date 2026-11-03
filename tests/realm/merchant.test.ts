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
import { knownOf } from '../../src/realm/discovery.ts'
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

describe('떠돌이 상단 — 판의 다른 자리에 닿는 물건 (형 11-04: "살 게 더 다양하고 많았으면")', () => {
  /** 상단을 세우고 그 물건 하나만 놓는다 */
  const withOffer = (what: 'heal' | 'seed' | 'silk'): Realm => {
    const r = untilMarket(byeonhanMini(1))
    r.stock[r.player]!.grain = 5000
    r.markets![r.player]!.offers.splice(0, Infinity, { id: 'x', what, n: 1, price: 50, left: 1 })
    return r
  }
  it('약초 — 다쳐 누운 우리 장수가 바로 일어난다 · 다친 장수가 없으면 안 산다', () => {
    const r = withOffer('heal')
    assert.equal(advance(r, [{ kind: 'buy', faction: r.player, offer: 'x' }]).report.lines.filter((l) => l.kind === 'buy').length, 0)
    const h = Object.values(r.heroes).find((x) => x.faction === r.player && x.status === 'free')!
    h.woundedUntil = r.season + 5
    const { next, report } = advance(r, [{ kind: 'buy', faction: r.player, offer: 'x' }])
    assert.equal(report.lines.filter((l) => l.kind === 'buy').length, 1)
    assert.ok((next.heroes[h.id]!.woundedUntil ?? -1) <= next.season)
  })
  it('좋은 씨앗 — 그해 가을걷이 곱이 오른다', () => {
    const r = withOffer('seed')
    const { next } = advance(r, [{ kind: 'buy', faction: r.player, offer: 'x' }])
    assert.ok((next.harvestMod?.[r.player]?.mul ?? 1) > (r.harvestMod?.[r.player]?.mul ?? 1))
  })
  it('비단 — 아는 나라의 호감이 오른다', () => {
    const r = withOffer('silk')
    const a = advance(r, []).next
    const b = advance(r, [{ kind: 'buy', faction: r.player, offer: 'x' }]).next
    assert.ok(knownOf(r, r.player).some((x) => x !== r.player))
    assert.notDeepEqual(a.relations, b.relations)
  })
})
