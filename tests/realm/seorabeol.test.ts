/**
 * 캠페인 3장 「서라벌 여섯 마을」 (형 2026-10-25: "3장도 얼른 하고싶다")
 *  - 고을은 틀 안 뭍 위에 · 길은 모두 이어진다 · 얼굴과 깃발이 있다
 *  - 2장을 이기면 3장이 열린다
 *  - 여섯 마을이 모두 따라야(동맹·조공) 이긴다
 *  - 칼을 덜 뽑는 장 — 우리가 마을을 치면 다른 다섯 마을의 호감이 깎인다 (왜인을 치는 건 괜찮다)
 *  - 고허촌은 처음부터 화친 · 왜인은 모두와 싸운다
 *  - 가만히 둬도 첫 해에 나정을 잃지 않는다 (시드 여럿)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders } from '../../src/realm/ai.ts'
import { pairKey, relationOf } from '../../src/realm/diplomacy.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import { SEORA_WORLD } from '../../src/realm/data/regions/seorabeol-geo.ts'
import { SEORA_PLACES, SEORA_VILLAGES } from '../../src/realm/data/regions/seorabeol.ts'
import { HERO_BUST, FACTION_ART } from '../../src/realm/data/art.ts'
import { fewerSwords } from '../../src/realm/scenario.ts'
import { advance, checkOutcome } from '../../src/realm/season.ts'
import { unlockedFrom } from '../../src/ui/realm/unlock.ts'
import { P } from '../../src/tune/params.ts'

const favor = (r: ReturnType<typeof startRegion>, a: string, b: string): number => r.relations[pairKey(a, b)]?.favor ?? 0

describe('캠페인 3장 — 서라벌 여섯 마을', () => {
  it('고을은 틀 안 뭍 위 · 길은 다 이어진다 · 얼굴과 깃발이 있다', () => {
    const r = startRegion('seorabeol', 1, 'saro')
    for (const n of Object.values(r.nodes)) {
      const ll = SEORA_PLACES[n.id]
      assert.ok(ll !== undefined, `${n.id} 자리 없음`)
      const [x, y] = SEORA_WORLD.pos(ll![0], ll![1])
      assert.ok(x > 0 && x < 1 && y > 0 && y < 1, `${n.id} 틀 밖`)
      assert.ok(SEORA_WORLD.onLand(ll![0], ll![1]), `${n.id} (${ll}) 바다 위`)
    }
    const seen = new Set(['sr-najeong-cap'])
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

  it('2장을 이기면 3장이 열린다', () => {
    assert.ok(!unlockedFrom(['tutorial', 'mahan'], true, null).has('seorabeol'))
    assert.ok(unlockedFrom(['tutorial', 'mahan', 'jumong'], true, null).has('seorabeol'))
  })

  it('여섯 마을이 모두 따라야 이긴다', () => {
    const r = startRegion('seorabeol', 1, 'saro')
    for (const v of SEORA_VILLAGES.slice(0, 5)) r.relations[pairKey('saro', v)] = { state: 'ally', until: null }
    assert.equal(checkOutcome(r), null, '한 마을이 모자란다')
    r.relations[pairKey('saro', SEORA_VILLAGES[5]!)] = { state: 'ally', until: null }
    assert.equal(checkOutcome(r), 'win')
  })

  it('마을을 치면 다른 다섯 마을의 마음이 식는다 · 왜인을 치는 건 괜찮다', () => {
    const r = startRegion('seorabeol', 1, 'saro')
    const before = Object.fromEntries(SEORA_VILLAGES.map((v) => [v, favor(r, 'saro', v)]))
    fewerSwords(r, 'saro', 'sr-daesu')
    assert.equal(favor(r, 'saro', 'sr-daesu'), before['sr-daesu'], '친 마을은 전쟁으로 따로 셈한다')
    for (const v of SEORA_VILLAGES) if (v !== 'sr-daesu') assert.equal(favor(r, 'saro', v), before[v]! - P.realm.seoraStrikeFavor, v)
    const mid = favor(r, 'saro', 'sr-goheo')
    fewerSwords(r, 'saro', 'sr-wae')
    assert.equal(favor(r, 'saro', 'sr-goheo'), mid, '왜인을 쳐도 마을은 안 식는다')
    fewerSwords(r, 'sr-wae', 'sr-gari')
    assert.equal(favor(r, 'saro', 'sr-goheo'), mid, '남이 친 것은 우리 탓이 아니다')
  })

  it('고허촌은 처음부터 화친 · 왜인은 모두와 싸운다', () => {
    const r = startRegion('seorabeol', 1, 'saro')
    assert.equal(relationOf(r, 'saro', 'sr-goheo').state, 'truce')
    for (const f of Object.keys(r.factions)) if (f !== 'sr-wae') assert.equal(relationOf(r, f, 'sr-wae').state, 'war', f)
  })

  it('가만히 둬도 첫 해에 나정을 잃지 않는다 (시드 여럿)', () => {
    for (let seed = 1; seed <= 8; seed++) {
      let x = startRegion('seorabeol', seed, 'saro')
      for (let s = 0; s < 4; s++) x = advance(x, aiOrders(x)).next
      assert.equal(x.nodes['sr-najeong-cap']!.owner, 'saro', `시드 ${seed}`)
      assert.notEqual(x.outcome?.kind, 'lose')
    }
  })
})
