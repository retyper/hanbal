/**
 * 캠페인 4장 「구지봉의 노래」 (형 2026-11-03: "4장 5장도 캠페인 만들어줘 · 시작하자마자 남의 게임 이어서 하는 느낌 들면 안됨")
 *  - 고을은 틀 안 뭍 위에 · 길은 모두 이어진다 · 얼굴과 깃발이 있다 (포구에 머무는 허황옥까지)
 *  - 3장(주몽)을 이기면 4장이 열린다
 *  - 막 선 나라로 시작한다 — 가락은 도읍과 포구뿐, 큰 나라가 없다 · 탈해는 바다 건너에서 뱃길로만 닿는다
 *  - 아홉 간이 모두 따르고(동맹·속국·아우름) 한 해 안에 다섯 나라와 철을 주고받아야 이긴다
 *  - 탈해는 처음 유예 동안 오지 않고, 그 뒤 배를 타고 건너온다
 *  - 가만히 둬도 첫 해에 도읍을 잃지 않는다 (시드 여럿)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders } from '../../src/realm/ai.ts'
import { pairKey, relationOf } from '../../src/realm/diplomacy.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import { GUJI_WORLD } from '../../src/realm/data/regions/gujibong-geo.ts'
import { GUJI_PLACES, NINE_GAN } from '../../src/realm/data/regions/gujibong.ts'
import { HERO_BUST, FACTION_ART } from '../../src/realm/data/art.ts'
import { CHAPTERS } from '../../src/realm/data/campaign.ts'
import { noteIron } from '../../src/realm/paths.ts'
import { advance, checkOutcome } from '../../src/realm/season.ts'
import { unlockedFrom } from '../../src/ui/realm/unlock.ts'
import { P } from '../../src/tune/params.ts'
import { perSeason } from '../../src/realm/calendar.ts'

describe('캠페인 4장 — 구지봉의 노래', () => {
  it('고을은 틀 안 뭍 위 · 길은 다 이어진다 · 얼굴과 깃발이 있다', () => {
    const r = startRegion('gujibong', 1, 'garak')
    for (const n of Object.values(r.nodes)) {
      const ll = GUJI_PLACES[n.id]
      assert.ok(ll !== undefined, `${n.id} 자리 없음`)
      const [x, y] = GUJI_WORLD.pos(ll![0], ll![1])
      assert.ok(x > 0 && x < 1 && y > 0 && y < 1, `${n.id} 틀 밖`)
      assert.ok(GUJI_WORLD.onLand(ll![0], ll![1]), `${n.id} (${ll}) 바다 위`)
    }
    const seen = new Set(['gj-garak-cap'])
    for (let grew = true; grew;) {
      grew = false
      for (const e of Object.values(r.edges)) {
        if (seen.has(e.a) !== seen.has(e.b)) { seen.add(e.a); seen.add(e.b); grew = true }
      }
    }
    assert.equal(seen.size, Object.keys(r.nodes).length, '이어지지 않은 고을이 있다')
    for (const h of [...Object.values(r.heroes), ...(r.wanderers ?? []).map((w) => w.hero)]) assert.ok(HERO_BUST[h.id] !== undefined, `${h.id} 얼굴 없음`)
    for (const f of Object.keys(r.factions)) assert.ok(FACTION_ART[f] !== undefined, `${f} 깃발 없음`)
  })

  it('장 차례 — 3장(주몽)을 이기면 4장이 열린다', () => {
    assert.deepEqual(CHAPTERS.slice(3, 5).map((c) => [c.n, c.region]), [[3, 'jumong'], [4, 'gujibong']])
    assert.ok(!unlockedFrom(['tutorial', 'mahan', 'seorabeol'], true, null).has('gujibong'))
    assert.ok(unlockedFrom(['tutorial', 'mahan', 'seorabeol', 'jumong'], true, null).has('gujibong'))
  })

  it('막 선 나라로 시작한다 — 큰 나라가 없고, 탈해는 뱃길로만 닿는다', () => {
    const r = startRegion('gujibong', 1, 'garak')
    const towns = (f: string): number => Object.values(r.nodes).filter((n) => n.owner === f).length
    assert.ok(towns('garak') <= 2, '가락은 도읍과 포구뿐')
    for (const f of Object.keys(r.factions)) assert.ok(towns(f) <= 2, `${f} 고을 ${towns(f)}`)
    assert.ok(Object.values(r.nodes).filter((n) => n.owner === null).length >= 5, '임자 없는 땅이 넉넉하다')
    const camp = r.factions['tahae']!.capital
    for (const e of Object.values(r.edges)) if (e.a === camp || e.b === camp) assert.equal(e.kind, 'sea', '탈해의 섬은 뱃길로만')
    assert.equal(relationOf(r, 'garak', 'tahae').state, 'war')
    for (const g of NINE_GAN) assert.notEqual(relationOf(r, 'tahae', g).state, 'war', `탈해와 ${g}`)
  })

  it('아홉 간이 모두 따르고 다섯 나라와 철을 주고받아야 이긴다 · 쳐서 아우른 마을도 센다', () => {
    const r = startRegion('gujibong', 1, 'garak')
    for (const g of NINE_GAN.slice(0, 8)) r.relations[pairKey('garak', g)] = { state: 'ally', until: null }
    for (const g of NINE_GAN.slice(0, 5)) noteIron(r, 'garak', g, 2)
    assert.equal(checkOutcome(r), null, '한 간이 모자란다')
    r.nodes[r.factions[NINE_GAN[8]!]!.capital]!.owner = 'garak'
    assert.equal(checkOutcome(r), 'win')
    const q = startRegion('gujibong', 1, 'garak')
    for (const g of NINE_GAN) q.relations[pairKey('garak', g)] = { state: 'ally', until: null }
    for (const g of NINE_GAN.slice(0, 4)) noteIron(q, 'garak', g, 2)
    assert.equal(checkOutcome(q), null, '철을 주고받은 나라가 넷뿐')
  })

  it('탈해는 처음 유예 동안 오지 않고, 그 뒤 배를 타고 건너온다', () => {
    let came = 0
    for (let seed = 1; seed <= 6; seed++) {
      let x = startRegion('gujibong', seed, 'garak')
      const grace = P.realm.aiGrace * perSeason(x)
      for (let t = 0; t < grace + 12; t++) {
        x = advance(x, aiOrders(x)).next
        const away = Object.values(x.armies).some((a) => a.faction === 'tahae' && (a.march !== null || a.at !== 'gj-tahae-camp'))
        if (t < grace - 1) assert.ok(!away, `시드 ${seed}: ${t + 1}달째에 벌써 움직였다`)
        else if (away) { came++; break }
      }
    }
    assert.ok(came >= 4, `탈해가 건너온 시드 ${came}/6`)
  })

  it('가만히 둬도 첫 해에 도읍을 잃지 않는다 (시드 여럿)', () => {
    for (let seed = 1; seed <= 8; seed++) {
      let x = startRegion('gujibong', seed, 'garak')
      for (let s = 0; s < 12; s++) x = advance(x, aiOrders(x)).next
      assert.equal(x.nodes['gj-garak-cap']!.owner, 'garak', `시드 ${seed}`)
      assert.notEqual(x.outcome?.kind, 'lose')
    }
  })
})
