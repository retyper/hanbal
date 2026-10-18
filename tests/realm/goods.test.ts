/**
 * 땅마다 나는 것 · 사람의 눈금 · 첩보 · 사신을 따라가는 장수 (2026-10-18 — 형: "자원들도 다각화" · "사료대로 키우고 땅도 넓힘" ·
 * "속셈은 간접정보로" · "장사꾼 장수는 특별히 뭘 할 수 없잖아")
 *
 *  - 바닷가는 소금·물고기, 숲은 나무, 목장은 말 · 갯마을엔 철이 안 난다
 *  - 겨울엔 소금으로 못 덮은 곡식이 썩는다 · 밖에 나간 군대는 소금이 없으면 더 먹는다
 *  - 목책은 나무·곡식이 들고 그 계절이 끝나면 선다 · 해자는 목책이 먼저 · 수군은 나무, 기병은 말
 *  - 맞바꿈은 모자란 것과 남는 것을 바꾼다 · 없는 것을 더 쳐 준다
 *  - 옛 판(눈금 1)은 사람이 네 배가 된다
 *  - 첩자가 있는 나라의 소식이 그 첩자의 주인에게만 들린다 · 같은 판이면 같은 소식
 *  - 사신에 딸린 장수의 특성이 걸리고, 그 계절엔 맡은 고을에 손이 안 간다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { canEscort, envoyTrueChance, pairKey, tradeOffer } from '../../src/realm/diplomacy.ts'
import {
  awayMen, buildCost, canBuild, draftLimit, goodOf, goodsWorth, isCoast, isWoody, nodeYield, upkeepOf,
} from '../../src/realm/economy.ts'
import { postHero } from '../../src/realm/heroes.ts'
import { PEOPLE_SCALE, migrate } from '../../src/realm/migrate.ts'
import { advance, planned } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, Realm, ReportLine } from '../../src/realm/types.ts'

const fresh = (seed = 1): Realm => planned(byeonhanMini(seed), [])

describe('땅마다 나는 것', () => {
  it('바닷가는 소금·물고기 · 숲은 나무 · 목장은 말 · 갯마을엔 철이 안 난다', () => {
    const r = fresh()
    assert.ok(isCoast(r, 'our-cap'))
    assert.ok(!isCoast(r, 'anya-cap'))
    assert.equal(nodeYield(r, 'our-cap', 'spring').salt, P.realm.saltPerCoast)
    assert.ok(goodOf(nodeYield(r, 'our-cap', 'summer'), 'grain') > 0)
    assert.equal(goodOf(nodeYield(r, 'our-cap', 'winter'), 'grain'), 0, '겨울엔 고기잡이를 못 한다')
    assert.ok(isWoody(r, 'anya-vil')) // 솔숲
    assert.equal(nodeYield(r, 'guya-iron').iron, P.realm.ironPerMine)
    const usIron = Object.values(r.nodes).filter((n) => n.owner === 'us').reduce((s, n) => s + goodOf(nodeYield(r, n.id), 'iron'), 0)
    assert.equal(usIron, 0, '갯마을엔 철이 안 난다')
    // 너른벌 — 사람이 살아야 말이 난다
    assert.equal(goodOf(nodeYield(r, 'wild-neoreun'), 'horse'), 0)
    r.nodes['wild-neoreun'] = { ...r.nodes['wild-neoreun']!, owner: 'guya', hh: 40 }
    assert.equal(nodeYield(r, 'wild-neoreun').horse, P.realm.horsePerPasture)
  })

  it('한 계절이 지나면 창고에 든다', () => {
    const r = fresh()
    const salt0 = goodOf(r.stock['us'], 'salt')
    const next = advance(r, []).next
    assert.ok(goodOf(next.stock['us'], 'salt') > salt0)
    assert.ok(goodOf(next.stock['anya'], 'wood') > goodOf(r.stock['anya'], 'wood'))
  })

  it('겨울엔 소금으로 못 덮은 곡식이 썩는다', () => {
    const r = fresh()
    r.season = 3
    r.stock['miri'] = { grain: 1000, iron: 0, salt: 0 }
    const { next, report } = advance(r, [])
    const rot = report.lines.find((l): l is Extract<ReportLine, { kind: 'spoil' }> => l.kind === 'spoil' && l.faction === 'miri')
    assert.ok(rot !== undefined && rot.grain > 0)
    // 소금이 넉넉하면 안 썩는다
    const s = fresh()
    s.season = 3
    s.stock['miri'] = { grain: 1000, iron: 0, salt: 100 }
    const b = advance(s, [])
    assert.ok(!b.report.lines.some((l) => l.kind === 'spoil' && l.faction === 'miri'))
    assert.ok(goodOf(b.next.stock['miri'], 'salt') < 100, '덮은 만큼 소금을 쓴다')
    assert.ok(next.stock['miri']!.grain < b.next.stock['miri']!.grain)
  })

  it('밖에 나간 군대는 소금이 없으면 더 먹는다', () => {
    const r = fresh()
    r.armies['a-us']!.march = { from: 'our-cap', to: 'goja-vil', edge: 'e03', left: 2, ambush: false }
    assert.ok(awayMen(r, 'us') > 0)
    r.stock['us']!.salt = 0
    const hungry = upkeepOf(r, 'us', false)
    r.stock['us']!.salt = 1000
    assert.ok(upkeepOf(r, 'us', false) < hungry)
  })
})

describe('짓기 · 배 · 말', () => {
  it('목책은 나무·곡식이 들고 그 계절이 끝나면 선다 · 해자는 목책이 먼저', () => {
    const r = fresh()
    assert.ok(!r.nodes['our-north']!.tags.includes('palisade'))
    assert.ok(!canBuild(r, 'us', 'our-north', 'moat'), '목책이 먼저')
    r.stock['us']!.wood = 100
    r.stock['us']!.grain = 500
    assert.ok(canBuild(r, 'us', 'our-north', 'palisade'))
    const o: Order = { kind: 'build', faction: 'us', node: 'our-north', what: 'palisade' }
    const { next, report } = advance(r, [o])
    assert.ok(report.lines.some((l) => l.kind === 'build' && l.done === false))
    assert.ok(report.lines.some((l) => l.kind === 'build' && l.done === true))
    assert.ok(next.nodes['our-north']!.tags.includes('palisade'))
    assert.ok(goodOf(next.stock['us'], 'wood') <= 100 - buildCost('palisade').wood + P.realm.woodPerNode * 3)
    assert.ok(!canBuild(next, 'us', 'our-north', 'palisade'), '이미 있다')
    assert.ok(!canBuild(r, 'us', 'guya-cap', 'palisade'), '남의 고을')
  })

  it('수군은 나무, 기병은 말이 있어야 뽑는다', () => {
    const r = fresh()
    r.stock['goja']!.wood = 0
    assert.equal(draftLimit(r, 'goja', 'goja-cap', 'boat'), 0)
    r.stock['goja']!.wood = 1000
    assert.ok(draftLimit(r, 'goja', 'goja-cap', 'boat') > 0)
    r.stock['us']!.horse = 0
    assert.equal(draftLimit(r, 'us', 'our-cap', 'horse'), 0)
    r.stock['us']!.horse = 5
    assert.equal(draftLimit(r, 'us', 'our-cap', 'horse'), Math.min(5, draftLimit(r, 'us', 'our-cap')))
    const { next } = advance(r, [{ kind: 'draft', faction: 'us', node: 'our-cap', unit: 'horse', n: 5 }])
    assert.equal(goodOf(next.stock['us'], 'horse'), 0)
    assert.equal(next.armies['a-us']!.mix.horse, 5)
  })
})

describe('맞바꿈', () => {
  it('모자란 것과 남는 것을 바꾼다 · 없는 것을 더 쳐 준다', () => {
    const r = fresh()
    r.stock['miri'] = { grain: 900, iron: 0, salt: 0, wood: 0 }
    r.stock['goja'] = { grain: 100, iron: 0, salt: 200, wood: 0 }
    const t = tradeOffer(r, 'miri', 'goja')
    assert.ok(t !== null)
    assert.ok(goodOf(t.take, 'salt') > 0, '미리는 소금을 받는다')
    assert.ok(goodOf(t.give, 'grain') > 0, '곡식을 낸다')
    assert.ok(goodsWorth({ grain: 0, iron: 0, salt: 10 }, r, 'miri') > goodsWorth({ grain: 0, iron: 0, salt: 10 }, r, 'goja'))
    // 교역 사신이 서면 소금이 옮겨 간다
    for (let seed = 1; seed < 200; seed++) {
      const s = fresh(seed)
      s.stock['miri'] = { grain: 900, iron: 0, salt: 0 }
      s.stock['goja'] = { grain: 100, iron: 0, salt: 200 }
      const o: Order = { kind: 'envoy', from: 'goja', to: 'miri', ask: 'trade', give: t.take, take: t.give }
      const { report, next } = advance(s, [o])
      if (!report.lines.some((l) => l.kind === 'envoy' && l.accepted)) continue
      assert.ok(goodOf(next.stock['miri'], 'salt') >= goodOf(t.take, 'salt'))
      return
    }
    assert.fail('200 시드 안에 맞바꿈이 한 번도 안 섰다')
  })
})

describe('사람의 눈금', () => {
  it(`새 판은 사람이 ${PEOPLE_SCALE} 배 · 옛 판(눈금 없음)은 넘길 때 키운다`, () => {
    const r = byeonhanMini(1)
    assert.equal(r.scale, PEOPLE_SCALE)
    assert.equal(r.nodes['our-cap']!.hh, 300 * PEOPLE_SCALE)
    const old = structuredClone(r)
    delete old.scale
    for (const id of Object.keys(old.nodes)) {
      const n = old.nodes[id]!
      old.nodes[id] = { ...n, hh: n.hh / PEOPLE_SCALE, sown: n.sown / PEOPLE_SCALE, ...(n.room !== undefined ? { room: n.room / PEOPLE_SCALE } : {}) }
    }
    old.armies['a-us']!.mix = { spear: 80, bow: 30, shield: 10 }
    delete old.armies['a-us']!.kit
    migrate(old)
    assert.equal(old.scale, PEOPLE_SCALE)
    assert.equal(old.nodes['our-cap']!.hh, r.nodes['our-cap']!.hh)
    assert.equal(old.nodes['wild-dolseom']!.room, r.nodes['wild-dolseom']!.room)
    assert.deepEqual(old.armies['a-us']!.mix, r.armies['a-us']!.mix)
    // 두 번 해도 그대로
    migrate(old)
    assert.equal(old.nodes['our-cap']!.hh, r.nodes['our-cap']!.hh)
  })
})

describe('첩보', () => {
  it('첩자가 있는 나라의 소식이 그 주인에게만 들린다 · 같은 판이면 같은 소식', () => {
    for (let seed = 1; seed < 100; seed++) {
      const r = fresh(seed)
      r.spies = { us: [{ node: 'anya-cap', until: r.season + 4 }] }
      r.stock['anya']!.grain = 0 // 곳간이 빈다
      const a = advance(r, [])
      const rumors = a.report.lines.filter((l): l is Extract<ReportLine, { kind: 'rumor' }> => l.kind === 'rumor')
      if (rumors.length === 0) continue
      assert.ok(rumors.every((l) => l.viewer === 'us' && l.about === 'anya'))
      assert.ok(rumors.length <= 2)
      assert.deepEqual(advance(r, []).report.lines.filter((l) => l.kind === 'rumor'), rumors)
      return
    }
    assert.fail('100 시드 안에 첩보가 한 번도 없었다')
  })
})

describe('사신을 따라가는 장수', () => {
  it('딸린 장수의 매혹이 걸린다 · 이끄는 장수와 군주는 못 따라간다 · 그 계절엔 맡은 고을에 손이 안 간다', () => {
    const r = fresh()
    // 고자의 번예 물새(매혹)
    assert.ok(canEscort(r, 'goja', 'goja-2'))
    assert.ok(!canEscort(r, 'goja', 'goja-ruler'), '군주')
    assert.ok(!canEscort(r, 'goja', 'goja-1'), '군대를 이끈다')
    const none = { grain: 0, iron: 0 }
    const base = envoyTrueChance(r, 'goja', 'anya', 'truce', none, none)
    const withHer = envoyTrueChance(r, 'goja', 'anya', 'truce', none, none, 'goja-2')
    assert.ok(withHer > base)
    // 맡긴 고을 — 따라 나간 계절엔 맡은 장수가 없는 셈
    r.heroes['goja-2']!.post = 'goja-vil'
    r.heroes['goja-2']!.at = 'goja-vil'
    assert.equal(postHero(r, 'goja-vil')?.id, 'goja-2')
    r.relations[pairKey('goja', 'anya')] = { state: 'neutral', until: null }
    const o: Order = { kind: 'envoy', from: 'goja', to: 'anya', ask: 'gift', give: { grain: 10, iron: 0 }, take: none, hero: 'goja-2' }
    const { next, report } = advance(r, [o])
    assert.ok(report.lines.some((l) => l.kind === 'envoy' && l.hero === 'goja-2'))
    assert.equal(next.heroes['goja-2']!.awayUntil, r.season)
    assert.equal(next.heroes['goja-2']!.post, 'goja-vil', '자리는 남는다')
  })
})
