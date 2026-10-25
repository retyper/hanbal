/**
 * 캠페인 1장 「온조, 마한을 아우르다」 (형 2026-10-25: "튜토리얼은 0장으로 두고 1장은 1:1로 제대로 싸워보게")
 *  - 고을은 틀 안 뭍 위에 · 길은 모두 이어진다 · 얼굴과 깃발이 있다
 *  - 0장(배우는 판)을 끝내면 1장이, 1장을 이기면 2장(주몽)이 열린다 — 이미 깬 장은 그대로 열려 있다
 *  - 목지 도읍·원산성·금현성을 다 쥐어야 이긴다
 *  - 처음부터 싸우는 사이 · 마한이 먼저 올라온다 (1:1 로 제대로 붙는다)
 *  - 가만히 둬도 첫 해에 위례를 잃지는 않는다 (시드 여럿)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders } from '../../src/realm/ai.ts'
import { pairKey } from '../../src/realm/diplomacy.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import { MAHAN_WORLD } from '../../src/realm/data/regions/mahan-geo.ts'
import { MAHAN_PLACES } from '../../src/realm/data/regions/mahan.ts'
import { HERO_BUST, FACTION_ART } from '../../src/realm/data/art.ts'
import { CHAPTERS } from '../../src/realm/data/campaign.ts'
import { advance, checkOutcome } from '../../src/realm/season.ts'
import { unlockedFrom } from '../../src/ui/realm/unlock.ts'

describe('캠페인 1장 — 온조, 마한을 아우르다', () => {
  it('고을은 틀 안 뭍 위 · 길은 다 이어진다 · 얼굴과 깃발이 있다', () => {
    const r = startRegion('mahan', 1, 'baekje')
    for (const n of Object.values(r.nodes)) {
      const ll = MAHAN_PLACES[n.id]
      assert.ok(ll !== undefined, `${n.id} 자리 없음`)
      const [x, y] = MAHAN_WORLD.pos(ll![0], ll![1])
      assert.ok(x > 0 && x < 1 && y > 0 && y < 1, `${n.id} 틀 밖`)
      assert.ok(MAHAN_WORLD.onLand(ll![0], ll![1]), `${n.id} (${ll}) 바다 위`)
    }
    const seen = new Set(['mh-wirye-cap'])
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

  it('장 차례 — 배우는 판이 0장, 마한이 1장, 주몽이 2장', () => {
    assert.deepEqual(CHAPTERS.slice(0, 3).map((c) => [c.n, c.region]), [[0, 'tutorial'], [1, 'mahan'], [2, 'jumong']])
  })

  it('0장을 끝내면 1장 · 1장을 이기면 2장 · 이미 깬 장은 그대로 열려 있다', () => {
    assert.ok(!unlockedFrom([], false, null).has('mahan'))
    assert.ok(unlockedFrom([], true, null).has('mahan'))
    assert.ok(!unlockedFrom([], true, null).has('jumong'), '1장을 건너뛰고 2장이 열리면 안 된다')
    assert.ok(unlockedFrom(['tutorial', 'mahan'], true, null).has('jumong'))
    assert.ok(unlockedFrom(['tutorial', 'jumong'], true, null).has('jumong'), '1장이 생기기 전에 2장을 깬 사람')
    assert.ok(unlockedFrom([], true, 'jumong').has('jumong'), '2장을 하던 사람')
  })

  it('목지 도읍·원산성·금현성을 다 쥐어야 이긴다', () => {
    const r = startRegion('mahan', 1, 'baekje')
    r.nodes['mh-mokji-cap']!.owner = 'baekje'
    r.nodes['mh-wonsan']!.owner = 'baekje'
    assert.equal(checkOutcome(r), null, '금현성이 모자란다')
    r.nodes['mh-geumhyeon']!.owner = 'baekje'
    assert.equal(checkOutcome(r), 'win')
  })

  it('처음부터 싸우는 사이 · 마한이 먼저 올라온다', () => {
    const r = startRegion('mahan', 1, 'baekje')
    assert.equal(r.relations[pairKey('baekje', 'mokji')]?.state, 'war')
    let moved = 0
    for (let seed = 1; seed <= 8; seed++) {
      let x = startRegion('mahan', seed, 'baekje')
      for (let s = 0; s < 6; s++) x = advance(x, aiOrders(x)).next
      const touched = Object.values(x.nodes).some((n) => ['mh-handeul', 'mh-namhan', 'mh-hannaru', 'mh-wirye-cap'].includes(n.id) && n.owner === 'mokji')
        || Object.values(x.armies).some((a) => a.faction === 'mokji' && (a.march !== null || ['mh-handeul', 'mh-namhan', 'mh-hannaru'].includes(a.at)))
      if (touched) moved++
    }
    assert.ok(moved >= 4, `마한이 올라온 시드 ${moved}/8`)
  })

  it('가만히 둬도 첫 해에 위례를 잃지 않는다 (시드 여럿)', () => {
    for (let seed = 1; seed <= 8; seed++) {
      let x = startRegion('mahan', seed, 'baekje')
      for (let s = 0; s < 4; s++) x = advance(x, aiOrders(x)).next
      assert.equal(x.nodes['mh-wirye-cap']!.owner, 'baekje', `시드 ${seed}`)
      assert.notEqual(x.outcome?.kind, 'lose')
    }
  })
})
