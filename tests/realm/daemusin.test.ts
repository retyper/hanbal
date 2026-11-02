/**
 * 캠페인 5장 「대무신왕, 부여를 치다」 (형 2026-11-03: "4장 5장도 캠페인 만들어줘 · 되도록이면 주변국 없는 상태로")
 *  - 고을은 틀 안 뭍 위에 · 길은 모두 이어진다 · 얼굴과 깃발이 있다
 *  - 4장(구지봉)을 이기면 5장이 열린다
 *  - 판 위의 나라는 고구려와 부여 둘뿐 · 그 사이는 임자 없는 땅
 *  - 부여 도읍을 쥐고 대소를 쓰러뜨려야(사로잡거나 베거나) 이긴다
 *  - 부여 도읍 앞 수렁 길은 장마(7·8월)에 막힌다
 *  - 가만히 둬도 첫 해에 국내를 잃지 않는다 (시드 여럿)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders } from '../../src/realm/ai.ts'
import { relationOf } from '../../src/realm/diplomacy.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import { DAEMUSIN_WORLD } from '../../src/realm/data/regions/daemusin-geo.ts'
import { DAEMUSIN_PLACES } from '../../src/realm/data/regions/daemusin.ts'
import { HERO_BUST, FACTION_ART } from '../../src/realm/data/art.ts'
import { CHAPTERS } from '../../src/realm/data/campaign.ts'
import { blockedWhy } from '../../src/realm/calendar.ts'
import { advance, checkOutcome } from '../../src/realm/season.ts'
import { unlockedFrom } from '../../src/ui/realm/unlock.ts'

describe('캠페인 5장 — 대무신왕, 부여를 치다', () => {
  it('고을은 틀 안 뭍 위 · 길은 다 이어진다 · 얼굴과 깃발이 있다', () => {
    const r = startRegion('daemusin', 1, 'goguryeo')
    for (const n of Object.values(r.nodes)) {
      const ll = DAEMUSIN_PLACES[n.id]
      assert.ok(ll !== undefined, `${n.id} 자리 없음`)
      const [x, y] = DAEMUSIN_WORLD.pos(ll![0], ll![1])
      assert.ok(x > 0 && x < 1 && y > 0 && y < 1, `${n.id} 틀 밖`)
      assert.ok(DAEMUSIN_WORLD.onLand(ll![0], ll![1]), `${n.id} (${ll}) 바다 위`)
    }
    const seen = new Set(['dm-gungnae-cap'])
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

  it('장 차례 — 4장(구지봉)을 이기면 5장이 열린다', () => {
    assert.deepEqual(CHAPTERS.slice(4, 6).map((c) => [c.n, c.region]), [[4, 'gujibong'], [5, 'daemusin']])
    assert.ok(!unlockedFrom(['tutorial', 'mahan', 'seorabeol', 'jumong'], true, null).has('daemusin'))
    assert.ok(unlockedFrom(['tutorial', 'mahan', 'seorabeol', 'jumong', 'gujibong'], true, null).has('daemusin'))
  })

  it('판 위의 나라는 고구려와 부여 둘뿐 · 사이는 임자 없는 땅', () => {
    const r = startRegion('daemusin', 1, 'goguryeo')
    assert.deepEqual(Object.keys(r.factions).sort(), ['buyeo', 'goguryeo'])
    assert.equal(relationOf(r, 'goguryeo', 'buyeo').state, 'war')
    assert.ok(Object.values(r.nodes).filter((n) => n.owner === null).length >= 4, '임자 없는 땅이 넉넉하다')
    // 국내에서 부여 도읍까지 맞닿은 길이 없다 — 가는 길은 임자 없는 들을 지난다
    for (const e of Object.values(r.edges)) {
      const owners = [r.nodes[e.a]!.owner, r.nodes[e.b]!.owner].sort()
      assert.notDeepEqual(owners, ['buyeo', 'goguryeo'], `${e.id} 가 두 나라를 곧장 잇는다`)
    }
  })

  it('부여 도읍을 쥐고 대소를 쓰러뜨려야 이긴다', () => {
    const r = startRegion('daemusin', 1, 'goguryeo')
    r.nodes['dm-buyeo-cap']!.owner = 'goguryeo'
    assert.equal(checkOutcome(r), null, '대소가 아직 서 있다')
    r.heroes['dm-daeso']!.status = 'captive'
    r.heroes['dm-daeso']!.captor = 'goguryeo'
    assert.equal(checkOutcome(r), 'win')
    const q = startRegion('daemusin', 1, 'goguryeo')
    q.heroes['dm-daeso']!.status = 'dead'
    assert.equal(checkOutcome(q), null, '도읍을 아직 못 쥐었다')
  })

  it('부여 도읍 앞 수렁 길은 장마(7·8월)에 막힌다', () => {
    const r = startRegion('daemusin', 1, 'goguryeo')
    const mire = Object.values(r.edges).find((e) => [e.a, e.b].includes('dm-mire') && [e.a, e.b].includes('dm-buyeo-cap'))!
    assert.ok(mire.tags.includes('reeds'), '갈대 덮인 수렁')
    const months = Array.from({ length: 12 }, (_, t) => blockedWhy(mire, r, t))
    assert.ok(months.some((w) => w === 'summerFord'), '장마엔 막힌다')
    assert.ok(months.some((w) => w === null), '장마가 아니면 건넌다')
  })

  it('가만히 둬도 첫 해에 국내를 잃지 않는다 (시드 여럿)', () => {
    for (let seed = 1; seed <= 8; seed++) {
      let x = startRegion('daemusin', seed, 'goguryeo')
      for (let s = 0; s < 12; s++) x = advance(x, aiOrders(x)).next
      assert.equal(x.nodes['dm-gungnae-cap']!.owner, 'goguryeo', `시드 ${seed}`)
      assert.notEqual(x.outcome?.kind, 'lose')
    }
  })
})
