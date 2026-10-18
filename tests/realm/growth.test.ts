/**
 * 정과 성장 (docs/realm/HEROES.md §6) — 형: "장수를 오래쓰면 친밀도? 호감도? 이런게 올라야 하지 않을까? 장수 키우는 맛도 있어야할듯"
 *
 *  - 이끈 싸움을 이기면 무예·통솔에 공이 쌓이고 정이 오른다
 *  - 공이 차면 그 능력치가 한 단계 (10 까지)
 *  - 정이 70 을 넘으면 믿는 장수 · 100 이 차면 특성 하나에 눈뜬다 (한 번만)
 *  - 회유한 포로는 정이 낮게 시작한다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { addBond, bondTier, gainXp, growNeed } from '../../src/realm/heroes.ts'
import { advance, planned } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm, ReportLine } from '../../src/realm/types.ts'

const fresh = (seed = 1): Realm => planned(byeonhanMini(seed), [])

describe('정과 성장', () => {
  it('이끈 싸움을 이기면 공이 쌓이고 정이 오른다', () => {
    for (let seed = 1; seed < 60; seed++) {
      const r = fresh(seed)
      r.armies['a-us']!.mix = { spear: 1500, bow: 400, shield: 200 }
      r.armies['a-us']!.at = 'our-north'
      r.stock['us']!.grain = 5000
      const { next, report } = advance(r, [{ kind: 'march', army: 'a-us', edge: 'e05', ambush: false }])
      const b = report.lines.find((l) => l.kind === 'battle')
      if (b === undefined || b.kind !== 'battle' || (b.outcome !== 'win' && b.outcome !== 'rout')) continue
      const h = next.heroes['chief']!
      assert.equal(h.xp?.mu, P.realm.xpWin)
      assert.equal(h.xp?.tong, P.realm.xpWin)
      assert.equal(h.bond, P.realm.bondStart + P.realm.bondWin + P.realm.bondSeason)
      assert.equal(h.served, 1)
      return
    }
    assert.fail('60 시드 안에 한 번도 이기지 못했다')
  })

  it('공이 차면 그 능력치가 한 단계 오른다 — 10 에서 멈춘다', () => {
    const r = fresh()
    const h = r.heroes['chief']!
    const lines: ReportLine[] = []
    const before = h.tong
    gainXp(h, 'tong', growNeed(h, 'tong'), lines)
    assert.equal(h.tong, before + 1)
    assert.equal(h.grown?.tong, 1)
    assert.ok(lines.some((l) => l.kind === 'grow' && l.stat === 'tong'))
    h.mu = 10
    gainXp(h, 'mu', 99, lines)
    assert.equal(h.mu, 10)
  })

  it('정이 70 을 넘으면 믿는 장수 · 100 이면 특성에 눈뜬다 (한 번만)', () => {
    const r = fresh()
    const h = r.heroes['chief']!
    const lines: ReportLine[] = []
    h.bond = P.realm.bondTrust - 1
    addBond(r, h, 1, lines)
    assert.equal(bondTier(r, h), 'trust')
    assert.ok(lines.some((l) => l.kind === 'bond' && l.hero === 'chief'))
    h.grown = { chi: 2 }
    addBond(r, h, 100, lines)
    assert.equal(bondTier(r, h), 'sworn')
    const aw = lines.find((l) => l.kind === 'awaken')
    assert.ok(aw !== undefined && aw.kind === 'awaken' && aw.trait === 'farmer')
    assert.ok(h.traits.includes('farmer'))
    const n = h.traits.length
    addBond(r, h, -10, lines)
    addBond(r, h, 10, lines)
    assert.equal(h.traits.length, n, '두 번 눈떴다')
    // 군주는 정이 없다
    assert.equal(bondTier(r, r.heroes['us-ruler']!), null)
  })

  it('회유한 포로는 정이 낮게 시작한다', () => {
    const r = fresh()
    const h = r.heroes['anya-1']!
    for (const a of Object.values(r.armies)) if (a.hero === 'anya-1') a.hero = null
    h.status = 'captive'
    h.captor = 'us'
    h.at = null
    h.persuade = { by: null, left: 1 }
    const { next, report } = advance(r, [])
    assert.ok(report.lines.some((l) => l.kind === 'recruit' && l.hero === 'anya-1'))
    const g = next.heroes['anya-1']!
    assert.equal(g.faction, 'us')
    assert.equal(g.bond, P.realm.bondPersuaded + P.realm.bondSeason)
    assert.equal(bondTier(next, g), 'new')
  })
})
