/**
 * 정이 힘이 된다 — 정이 깊은 장수는 공이 빨리 차고, 한마음 장수가 이끄는 군대는 사기가 두 배 (HERO-GROWTH · BONDS)
 * 인연 막대(판 밖)의 셈: 쌓는 몫 · 단 문턱
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { bondMoraleOf, gainXp } from '../../src/realm/heroes.ts'
import { bondTierOf, dexDeed, runDeeds } from '../../src/realm/bonds.ts'
import { DEX_CAUGHT, DEX_MET } from '../../src/realm/dex.ts'
import { planned } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm, ReportLine } from '../../src/realm/types.ts'

const fresh = (seed = 1): Realm => planned(byeonhanMini(seed), [])

describe('정이 힘이 된다', () => {
  it('정이 깊을수록 같은 공이 더 붙는다 (낯섦 1 · 정듦 · 믿음 · 한마음)', () => {
    const R = P.realm
    const cases: Array<[number | undefined, number]> = [[undefined, 1], [R.bondStart, 1], [30, R.bondXpWarm], [R.bondTrust, R.bondXpTrust], [100, R.bondXpSworn]]
    for (const [bond, mul] of cases) {
      const h = fresh().heroes['chief']!
      h.xp = {}
      if (bond === undefined) delete h.bond
      else h.bond = bond
      gainXp(h, 'mu', 2, [] as ReportLine[])
      assert.equal(h.xp?.mu, 2 * mul, `정 ${bond}`)
    }
  })

  it('한마음 장수가 이끄는 군대는 믿는 장수의 두 배 사기 덤', () => {
    const r = fresh()
    const h = r.heroes['chief']!
    h.bond = P.realm.bondTrust
    assert.equal(bondMoraleOf(r, h), P.realm.bondMorale)
    h.bond = 100
    assert.equal(bondMoraleOf(r, h), P.realm.bondMorale * P.realm.bondMoraleSworn)
    assert.equal(P.realm.bondMoraleSworn, 2)
    h.bond = 50
    assert.equal(bondMoraleOf(r, h), 0)
  })
})

describe('인연 막대 셈', () => {
  it('단 문턱 15 · 45 · 100 · 180 · 300', () => {
    const at = [0, 14, 15, 44, 45, 99, 100, 179, 180, 299, 300, 999].map(bondTierOf)
    assert.deepEqual(at, [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
  })

  it('한 판 한 사람 상한 · 도감 칸은 처음 켤 때 한 번', () => {
    const r = fresh()
    const h = r.heroes['chief']!
    h.served = 400
    h.grown = { mu: 30, tong: 30 }
    const d = runDeeds(r, r.player)
    assert.equal(d['chief'], P.realm.metaRunCap)
    assert.equal(dexDeed(0, DEX_MET | DEX_CAUGHT), P.realm.metaDexMet + P.realm.metaDexCaught)
    assert.equal(dexDeed(DEX_MET, DEX_MET), 0)
  })
})
