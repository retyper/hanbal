/**
 * 캠페인 2장 「주몽, 졸본에 서다」 (형 2026-10-23: "1장 깼는데 2장 안 열림")
 *  - 고을은 틀 안 뭍 위에 · 길은 모두 이어진다
 *  - 1장을 끝내면 2장이 열린다 (자유 판 차례와 따로)
 *  - 송양이 따르고 행인·북옥저 도읍을 쥐면 이긴다 · 하나라도 모자라면 아직
 *  - 가만히 둬도 첫 해에 도읍을 잃지 않는다 (추격군은 오되 졸본은 높고 목책이 있다)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders } from '../../src/realm/ai.ts'
import { pairKey } from '../../src/realm/diplomacy.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import { JUMONG_WORLD } from '../../src/realm/data/regions/jumong-geo.ts'
import { JUMONG_PLACES } from '../../src/realm/data/regions/jumong.ts'
import { HERO_BUST, FACTION_ART } from '../../src/realm/data/art.ts'
import { advance, checkOutcome } from '../../src/realm/season.ts'
import { unlockedFrom } from '../../src/ui/realm/unlock.ts'

describe('캠페인 2장 — 주몽', () => {
  it('고을은 틀 안 뭍 위 · 길은 다 이어진다 · 얼굴과 깃발이 있다', () => {
    const r = startRegion('jumong', 1, 'goguryeo')
    for (const n of Object.values(r.nodes)) {
      const ll = JUMONG_PLACES[n.id]
      assert.ok(ll !== undefined, `${n.id} 자리 없음`)
      const [x, y] = JUMONG_WORLD.pos(ll![0], ll![1])
      assert.ok(x > 0 && x < 1 && y > 0 && y < 1, `${n.id} 틀 밖`)
      assert.ok(JUMONG_WORLD.onLand(ll![0], ll![1]), `${n.id} (${ll}) 바다 위`)
    }
    const seen = new Set(['jm-jolbon-cap'])
    for (let grew = true; grew;) {
      grew = false
      for (const e of Object.values(r.edges)) {
        if (seen.has(e.a) !== seen.has(e.b)) { seen.add(e.a); seen.add(e.b); grew = true }
      }
    }
    assert.equal(seen.size, Object.keys(r.nodes).length, '이어지지 않은 고을이 있다')
    for (const h of Object.values(r.heroes)) assert.ok(HERO_BUST[h.id] !== undefined, `${h.id} 얼굴 없음`)
    for (const f of Object.keys(r.factions)) assert.ok(FACTION_ART[f] !== undefined, `${f} 깃발 없음`)
  })

  it('1장을 끝내면 2장이 열린다', () => {
    assert.ok(!unlockedFrom([], false, null).has('jumong'))
    assert.ok(unlockedFrom([], true, null).has('jumong'))
    assert.ok(unlockedFrom(['tutorial'], false, null).has('jumong'))
    assert.ok(unlockedFrom([], false, 'jumong').has('jumong'))
  })

  it('송양이 따르고 행인·북옥저 도읍을 쥐면 이긴다', () => {
    const r = startRegion('jumong', 1, 'goguryeo')
    r.nodes['jm-haengin-cap']!.owner = 'goguryeo'
    r.nodes['jm-okjeo-cap']!.owner = 'goguryeo'
    assert.equal(checkOutcome(r), null, '송양이 아직 안 따른다')
    r.relations[pairKey('goguryeo', 'biryuna')] = { state: 'ally', until: null }
    assert.equal(checkOutcome(r), 'win')
    r.nodes['jm-okjeo-cap']!.owner = 'bukokjeo'
    assert.equal(checkOutcome(r), null, '북옥저 도읍이 모자란다')
  })

  it('가만히 둬도 첫 해에 졸본을 잃지 않는다 (시드 여럿)', () => {
    for (let seed = 1; seed <= 8; seed++) {
      let x = startRegion('jumong', seed, 'goguryeo')
      for (let s = 0; s < 4; s++) x = advance(x, aiOrders(x)).next
      assert.equal(x.nodes['jm-jolbon-cap']!.owner, 'goguryeo', `시드 ${seed}`)
      assert.notEqual(x.outcome?.kind, 'lose')
    }
  })
})
