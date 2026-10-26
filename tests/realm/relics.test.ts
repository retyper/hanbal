/**
 * 유물 (src/realm/relics.ts · data/relics.ts · docs/realm/HERO-GROWTH.md ★ 둘째 판 §B) — 이긴 판의 껴묻거리를 장수가 지닌다
 *
 *  - 표: id 마다 그림이 있다 · 손잡이는 params 에 있다 · 판마다 상자에 들 유물이 있다 (배우는 판은 없다)
 *  - 상자 셋: 같은 시드 → 같은 셋 · 판의 땅에서 · 가진 것은 되도록 안 놓는다 · 한 판에 하나만 고른다
 *  - 효과: 능력치(+1 · 10 에서 멈춘다) · 덩이쇠 철 · 굽은옥 정 · 간두령 사기 · 천마도 기병 · 겨루기 무예 · 판을 열 때 우리 장수만
 *  - 뒤에 건 아홉: 잔무늬거울 굿 · 팔주령 덜 꺾임 · 오리모양 토기 빠져나옴 · 수레바퀴 길 · 뿔잔 호궤 · 금귀걸이 회유 · 금동대향로 제사 · 진묘수 돌려보냄 · 금동신발 덜 들킴
 *  - 한 장수 한 칸(단련 10 이면 두 칸) · 하나는 한 사람만 지닌다 · 옛 저장(유물 없음)도 돈다 · 결정론
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import { aiOrders, decide } from '../../src/realm/ai.ts'
import { fightHead, headcount } from '../../src/realm/battle.ts'
import { capOf, raiseState, emptyDrill, type DrillStore } from '../../src/realm/drill.ts'
import { nodeYield, resolveRites } from '../../src/realm/economy.ts'
import { movesOf } from '../../src/realm/estimate.ts'
import { addBond, persuadeDropOf, postHero, riteMul, stepHeroes } from '../../src/realm/heroes.ts'
import { riteOf } from '../../src/realm/paths.ts'
import { reportText } from '../../src/realm/data/prose.ts'
import { RELICS, REGION_TAGS, TIER_CHEST, poolOf } from '../../src/realm/data/relics.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import {
  applyRelics, drawChests, emptyRelics, equip, holderOf, openTomb, pickTomb, relicDefs, relicHorseMulOf, relicLine, relicMoraleOf, relicMul, relicRealm, relicRoom, relicSum, slotsFor, unequip,
} from '../../src/realm/relics.ts'
import { advance, battleFates, forceOf, preview, sideOf } from '../../src/realm/season.ts'
import { feastCost, fightRounds, type FightResult, type Side } from '../../src/realm/tactics.ts'
import type { Hero, Order, Realm, RegionId, ReportLine } from '../../src/realm/types.ts'
import { P } from '../../src/tune/params.ts'

const R = P.realm
const bihwa = (seed = 7): Realm => startRegion('yeongnam', seed, 'bihwa')
const ourHeroes = (r: Realm): Hero[] => Object.values(r.heroes).filter((h) => h.faction === r.player).sort((a, b) => (a.id < b.id ? -1 : 1))
const body: Hero = { id: 'h', name: '늪', faction: '', look: 'g', mu: 5, tong: 8, ryak: 9, chi: 3, deok: 10, uiri: 6, traits: [], status: 'free', captor: null, at: null, post: null }
const REGIONS: readonly RegionId[] = ['tutorial', 'mahan', 'jumong', 'seorabeol', 'byeonhan-mini', 'yeongnam', 'south', 'world']

describe('유물 — 표', () => {
  it('id 는 겹치지 않고 그림이 있다 (상자 셋 · 껴묻거리 더미까지)', () => {
    const ids = RELICS.map((x) => x.id)
    assert.equal(new Set(ids).size, ids.length)
    assert.ok(ids.length >= 24)
    for (const id of [...ids, ...Object.values(TIER_CHEST), 'loot']) assert.ok(existsSync(`public/realm/relic/${id}.png`), `${id}.png 가 없다`)
  })

  it('효과의 숫자는 params 손잡이 · 글이 있다', () => {
    for (const d of RELICS) {
      assert.ok(d.fx.length > 0, d.id)
      for (const f of d.fx) assert.equal(typeof R[f.by], 'number', `${d.id} ${f.by}`)
      assert.ok(relicLine(d.id).length > 0)
      assert.ok(!relicLine(d.id).includes('곧 쓰인다'), `${d.id} 는 판에 걸려 있다`)
      assert.ok(d.folk.length > 0 && d.era.includes('·'), d.id)
    }
  })

  it('판마다 상자에 들 유물이 있다 · 배우는 판은 없다', () => {
    for (const reg of REGIONS) {
      if (reg === 'tutorial') assert.equal(poolOf(reg).length, 0)
      else assert.ok(poolOf(reg).length >= R.relicChests, `${reg} 에 ${poolOf(reg).length}`)
      assert.ok(REGION_TAGS[reg] !== undefined)
    }
    // 낙동강은 가야·신라 — 덩이쇠 · 천마도 · 금관 / 삼한은 마한·백제 — 금동신발 · 진묘수
    const yn = poolOf('yeongnam').map((x) => x.id)
    for (const id of ['ingots', 'cheonma', 'crown']) assert.ok(yn.includes(id))
    assert.ok(!yn.includes('guardian'))
    const so = poolOf('south').map((x) => x.id)
    for (const id of ['shoes', 'guardian', 'beads']) assert.ok(so.includes(id))
  })
})

describe('유물 — 옛 무덤의 상자', () => {
  it('같은 시드 → 같은 셋 · 셋은 서로 다르고 그 땅의 것', () => {
    for (const reg of REGIONS.filter((x) => x !== 'tutorial')) {
      for (const seed of [1, 7, 12345, 0xdeadbeef]) {
        const a = drawChests(seed, reg, {})
        assert.deepEqual(a, drawChests(seed, reg, {}))
        assert.equal(a.length, R.relicChests)
        assert.equal(new Set(a).size, a.length)
        const pool = poolOf(reg).map((x) => x.id)
        for (const id of a) assert.ok(pool.includes(id), `${reg} ${id}`)
      }
    }
    // 시드가 다르면 셋도 갈린다 (스무 판 가운데 몇은)
    const sets = new Set(Array.from({ length: 20 }, (_, i) => drawChests(i + 1, 'yeongnam', {}).join(',')))
    assert.ok(sets.size > 5)
  })

  it('가진 것은 되도록 안 놓는다 — 다 가졌으면 가진 것에서 · 그래도 모자라면 다른 땅의 것', () => {
    const pool = poolOf('byeonhan-mini').map((x) => x.id)
    const owned = Object.fromEntries(pool.slice(0, pool.length - 1).map((id) => [id, { n: 1, seed: 1 }]))
    const a = drawChests(9, 'byeonhan-mini', owned)
    assert.ok(a.includes(pool[pool.length - 1]!), '하나 남은 새 것은 반드시 놓인다')
    const all = Object.fromEntries(RELICS.map((x) => [x.id, { n: 1, seed: 1 }]))
    assert.equal(drawChests(9, 'byeonhan-mini', all).length, R.relicChests)
  })

  it('무덤은 한 번 놓이고 · 한 판에 하나만 고른다 · 놓인 것만', () => {
    let s = openTomb(emptyRelics(), 42, 'yeongnam')
    const t = s.tombs['42']!
    assert.equal(t.pick, null)
    assert.equal(openTomb(s, 42, 'yeongnam'), s, '다시 열어도 같은 무덤')
    const not = RELICS.find((x) => !t.ids.includes(x.id))!.id
    assert.equal(pickTomb(s, 42, not), s, '놓이지 않은 것은 못 고른다')
    s = pickTomb(s, 42, t.ids[1]!, 'yeongnam')
    assert.equal(s.tombs['42']!.pick, t.ids[1])
    assert.deepEqual(s.own[t.ids[1]!], { n: 1, seed: 42, region: 'yeongnam' })
    assert.equal(pickTomb(s, 42, t.ids[0]!), s, '두 번은 못 고른다')
    const none = emptyRelics()
    assert.equal(pickTomb(none, 5, t.ids[0]!), none, '열지 않은 무덤은 못 고른다')
  })

  it('오래된 무덤부터 덜어 낸다', () => {
    let s = emptyRelics()
    for (let i = 0; i < R.relicKeepRuns + 5; i++) s = openTomb(s, i + 1, 'south')
    assert.equal(Object.keys(s.tombs).length, R.relicKeepRuns)
    assert.equal(s.tombs['1'], undefined)
  })
})

describe('유물 — 끼우기', () => {
  const owning = (...ids: string[]) => ({ ...emptyRelics(), own: Object.fromEntries(ids.map((id) => [id, { n: 1, seed: 1 }])) })

  it('한 장수 한 칸 · 단련 10 이면 두 칸', () => {
    assert.equal(slotsFor(0), 1)
    assert.equal(slotsFor(R.relicTwoAt - 1), 1)
    assert.equal(slotsFor(R.relicTwoAt), 2)
    let s = owning('gogok', 'ingots')
    s = equip(s, 'a', 0, 'gogok', 3)
    assert.deepEqual(s.wear['a'], ['gogok'])
    assert.equal(equip(s, 'a', 1, 'ingots', 3), s, '둘째 칸은 아직 없다')
    s = equip(s, 'a', 0, 'ingots', 3)
    assert.deepEqual(s.wear['a'], ['ingots'], '같은 칸은 바꿔 끼운다')
    s = equip(s, 'a', 1, 'gogok', 10)
    assert.deepEqual(s.wear['a'], ['ingots', 'gogok'])
  })

  it('가진 것만 · 하나는 한 사람만 — 다른 장수에게서 옮긴다 · 비우기', () => {
    let s = owning('gogok')
    assert.equal(equip(s, 'a', 0, 'crown', 0), s, '없는 유물')
    s = equip(s, 'a', 0, 'gogok', 0)
    s = equip(s, 'b', 0, 'gogok', 0)
    assert.equal(s.wear['a'], undefined)
    assert.deepEqual(s.wear['b'], ['gogok'])
    assert.equal(holderOf(s, 'gogok'), 'b')
    s = unequip(s, 'b', 0)
    assert.equal(holderOf(s, 'gogok'), null)
    assert.equal(unequip(s, 'b', 0), s)
  })
})

describe('유물 — 판 안의 효과', () => {
  it('능력치 — 판을 열 때 +1 · 10 에서 멈추고 덜 든 몫은 안 적는다 · 그릇 유물은 단련 그릇을 넓힌다', () => {
    const a = applyRelics(body, ['goldbelt'])
    assert.equal(a.tong, body.tong + R.relicStat)
    assert.deepEqual(a.relics, ['goldbelt'])
    assert.deepEqual(a.relicAdd, { tong: R.relicStat })
    const b = applyRelics(body, ['beads']) // 매력 10
    assert.equal(b.deok, 10)
    assert.equal(b.relicAdd, undefined)
    assert.equal(body.tong, 8, '받은 몸은 안 바뀐다')
    assert.equal(applyRelics(body, []), body)
    assert.equal(applyRelics(body, ['nothing']), body)
    // 천마도 말다래 — 무예 그릇 +1 (5 + 3 + 1)
    const room = relicRoom(['cheonma'])
    assert.equal(capOf(body, 'mu', room), body.mu + R.drillRoom + R.relicRoom)
    const st: DrillStore = { ...emptyDrill(), h: { h: { points: 99, level: 3, add: { mu: 3 }, runs: 1 } } }
    assert.equal(raiseState(st, 'h', 'mu', body), 'cap')
    assert.equal(raiseState(st, 'h', 'mu', body, room), 'ok')
  })

  it('덩이쇠 — 지닌 장수가 맡은 고을은 철 +1', () => {
    const r = bihwa()
    const cap = r.factions[r.player]!.capital
    // 도읍 말고 사람 사는 고을 하나를 우리 것으로 (비화가야는 처음에 도읍뿐일 수 있다)
    const node = Object.values(r.nodes).filter((n) => n.id !== cap && n.kind !== 'sodo' && n.hh > 0).sort((x, y) => (x.id < y.id ? -1 : 1))[0]!
    node.owner = r.player
    const h = ourHeroes(r).find((x) => x.id !== r.factions[r.player]!.ruler)!
    h.post = node.id
    h.at = node.id
    assert.equal(postHero(r, node.id)?.id, h.id)
    const before = nodeYield(r, node.id).iron ?? 0
    r.heroes[h.id] = applyRelics(h, ['ingots'])
    assert.equal((nodeYield(r, node.id).iron ?? 0) - before, R.relicIron)
  })

  it('굽은옥 — 정이 오를 때 ×1.5 · 깎일 때는 그대로', () => {
    const r = bihwa()
    const hs = ourHeroes(r).filter((x) => x.id !== r.factions[r.player]!.ruler)
    const [a, b] = [hs[0]!, hs[1] ?? hs[0]!]
    a.bond = 40
    const lines: ReportLine[] = []
    addBond(r, a, 2, lines)
    assert.equal(a.bond, 42)
    const g = applyRelics(b, ['gogok'])
    r.heroes[b.id] = g
    g.bond = 40
    addBond(r, g, 2, lines)
    assert.equal(g.bond, 40 + 2 * R.relicBondMul)
    addBond(r, g, -2, lines)
    assert.equal(g.bond, 40 + 2 * R.relicBondMul - 2)
    assert.equal(relicMul(g, 'bond'), R.relicBondMul)
  })

  it('간두령 사기 · 천마도 기병 힘 · 겨루기 무예', () => {
    const r = bihwa()
    const army = Object.values(r.armies).find((x) => x.faction === r.player && x.hero !== null)!
    const was = forceOf(r, army).morale
    r.heroes[army.hero!] = applyRelics(r.heroes[army.hero!]!, ['polebell'])
    assert.ok(Math.abs(forceOf(r, army).morale - was - R.relicMorale) < 1e-9)
    assert.equal(relicMoraleOf(r.heroes[army.hero!]!), R.relicMorale)
    const cav = applyRelics(body, ['cheonma'])
    assert.equal(relicHorseMulOf(cav), R.relicCheonmaHorse)
    const f = { mix: { horse: 100, spear: 100 }, equip: 'bronze' as const, mu: 5, morale: 1 }
    assert.ok(Math.abs(fightHead({ ...f, horseMul: relicHorseMulOf(cav) }) - (200 + 100 * (R.relicCheonmaHorse - 1))) < 1e-9)
    assert.equal(relicSum(applyRelics(body, ['dagger']), 'duel'), R.relicDaggerDuel)
    assert.equal(relicSum(applyRelics(body, ['bipa', 'dagger']), 'duel'), R.relicDaggerDuel + R.relicBipaDuel)
  })

  it('판을 열 때 — 우리 장수만 · 칸 수만큼 · 배우는 판은 안 붙인다', () => {
    const r = bihwa(3)
    const mine = ourHeroes(r)[0]!
    const foe = Object.values(r.heroes).find((h) => h.faction !== r.player && h.faction !== '')!
    const got = relicRealm(r, { [mine.id]: ['goldbelt', 'gogok'], [foe.id]: ['crown'] })
    assert.deepEqual(got, [mine.id])
    assert.deepEqual(r.heroes[mine.id]!.relics, ['goldbelt'], '단련 0 이면 한 칸')
    assert.equal(r.heroes[foe.id]!.relics, undefined)
    assert.deepEqual(relicRealm(r, { [mine.id]: ['gogok'] }), [], '두 번은 안 붙인다')
    const r2 = bihwa(3)
    r2.heroes[mine.id] = { ...r2.heroes[mine.id]!, drill: { lv: R.relicTwoAt, add: {} } }
    relicRealm(r2, { [mine.id]: ['goldbelt', 'gogok'] })
    assert.deepEqual(r2.heroes[mine.id]!.relics, ['goldbelt', 'gogok'])
    const t = startRegion('tutorial', 1, 'baekje')
    assert.deepEqual(relicRealm(t, { [ourHeroes(t)[0]!.id]: ['gogok'] }), [])
  })
})

describe('유물 — 뒤에 건 아홉 (곧 쓰인다던 것)', () => {
  /** 골포국 판 — chief(명궁)가 a-us 를 이끈다 · us-1 은 비기 없는 쉬는 장수 */
  const mini = (seed = 5): Realm => byeonhanMini(seed)
  const wear = (r: Realm, hero: string, ...ids: string[]): Hero => (r.heroes[hero] = applyRelics(r.heroes[hero]!, ids))
  const sideFor = (r: Realm, army: string, F = 100): Side => {
    const a = r.armies[army]!
    return sideOf(r, [a], forceOf(r, a), F, a.faction, { water: false, fire: false, flank: false, seen: true })
  }

  it('잔무늬거울 — 비기가 진중 굿이 되고 · 굿으로 사기가 더 오른다', () => {
    const play = (mirror: boolean) => {
      const r = mini()
      r.armies['a-us']!.hero = 'us-1' // 비기가 없는 장수가 이끈다
      if (mirror) wear(r, 'us-1', 'mirror')
      const sa = sideFor(r, 'a-us')
      return { sa, res: fightRounds(sa, sideFor(r, 'a-guya-1'), 'k', r.seed, r.season, { cmds: [{ lead: 'art' }] }) }
    }
    const no = play(false)
    const yes = play(true)
    assert.equal(no.sa.hero!.art, undefined)
    assert.equal(yes.sa.hero!.art, 'rite')
    assert.equal(yes.sa.hero!.chant, R.relicMirrorChant)
    assert.ok((yes.res.rounds[0]!.acts ?? []).some((x) => x.c === 'art' && x.art === 'rite'))
    assert.ok(yes.res.rounds[0]!.ma > no.res.rounds[0]!.ma, '굿을 친 쪽 사기가 높다')
    assert.deepEqual(play(true).res, yes.res)
    // 명궁(chief)도 지니면 굿이 된다
    const r = mini()
    wear(r, 'chief', 'mirror')
    assert.equal(sideFor(r, 'a-us').hero!.art, 'rite')
    assert.equal(sideFor(mini(), 'a-us').hero!.art, 'snipe')
  })

  it('팔주령 — 지는 합에서 사기가 덜 꺾인다 (잃는 사람은 같다)', () => {
    const play = (bell: boolean) => {
      const r = mini()
      if (bell) wear(r, 'chief', 'eightbell')
      const sa = sideFor(r, 'a-us', 40)
      return { sa, res: fightRounds(sa, sideFor(r, 'a-guya-1', 400), 'k', r.seed, r.season, { cmds: [{ lead: 'drum' }] }) }
    }
    const no = play(false)
    const yes = play(true)
    assert.equal(no.sa.hero!.steady, undefined)
    assert.equal(yes.sa.hero!.steady, R.relicBellSteady)
    const [n0, y0] = [no.res.rounds[0]!, yes.res.rounds[0]!]
    assert.ok(n0.ma < no.sa.morale, '진 합이다')
    assert.equal(y0.na, n0.na)
    assert.ok(y0.ma > n0.ma, '팔주령을 지닌 쪽이 덜 꺾였다')
    assert.deepEqual(play(true).res, yes.res)
  })

  it('오리모양 토기 — 잡히거나 쓰러질 장수가 판마다 한 번 다친 몸으로 빠져나온다', () => {
    const fake = (taken: FightResult['taken'], fell: FightResult['fell']): FightResult =>
      ({ taken, fell, broke: null, chiefA: null, chiefD: null }) as unknown as FightResult
    const fates = (r: Realm, res: FightResult, lines: ReportLine[]) =>
      battleFates(r, res, {} as Side, {} as Side, [r.armies['a-us']!], [r.armies['a-guya-1']!], 'us', 'guya', 'k', lines)
    const caught = fake([{ side: 'a', hero: 'chief' }], [])
    const r0 = mini()
    assert.deepEqual(fates(r0, caught, []).captives, ['chief'])
    assert.equal(r0.heroes['chief']!.status, 'captive')

    const r = mini()
    wear(r, 'chief', 'duck')
    const lines: ReportLine[] = []
    assert.deepEqual(fates(r, caught, lines).captives, [])
    const h = r.heroes['chief']!
    assert.equal(h.status, 'free')
    assert.equal(r.armies['a-us']!.hero, 'chief', '군대는 그대로 이끈다')
    assert.ok((h.woundedUntil ?? -1) >= r.season + 1, '다쳤다')
    assert.deepEqual(h.relicSpent, { escape: R.relicDuckSaves })
    const save = lines.find((l) => l.kind === 'relicSave')!
    assert.deepEqual(save, { kind: 'relicSave', faction: 'us', hero: 'chief', relic: 'duck' })
    assert.ok(reportText(r, r, save, 'us')!.includes('오리모양 토기'))
    assert.equal(reportText(r, r, save, 'guya'), null)
    // 다 썼다 — 겨루기에서 쓰러지면 죽는다
    fates(r, fake([], [{ side: 'a', hero: 'chief', kill: true }]), [])
    assert.equal(r.heroes['chief']!.status, 'dead')
    // 겨루기에서 쓰러질 때도 처음이면 산다
    const r2 = mini()
    wear(r2, 'chief', 'duck')
    assert.deepEqual(fates(r2, fake([], [{ side: 'a', hero: 'chief', kill: true }]), []).fallen, [])
    assert.equal(r2.heroes['chief']!.status, 'free')
  })

  it('수레바퀴모양 토기 — 이끄는 군대가 길에서 한 계절 덜 걸린다 · 길 고르기 화면도 같은 셈', () => {
    const go = (wheel: boolean): Realm => {
      const r = mini()
      r.edges['e01'] = { ...r.edges['e01']!, kind: 'pass' } // 도읍 → 안개골을 고갯길로 (두 계절)
      if (wheel) wear(r, 'chief', 'wheelcup')
      return r
    }
    const order: Order = { kind: 'march', army: 'a-us', edge: 'e01', ambush: false }
    const mv = (r: Realm): number => movesOf(r, 'us', r.armies['a-us']!).find((m) => m.edge.id === 'e01')!.seasons
    assert.equal(mv(go(true)), mv(go(false)) - R.relicWheelMarch)
    // 한 계절 뒤 — 지닌 장수의 군대는 벌써 닿았고, 아닌 군대는 아직 길 위다
    const a = advance(go(true), [order]).next.armies['a-us']!
    const b = advance(go(false), [order]).next.armies['a-us']!
    assert.equal(a.march, null)
    assert.equal(a.at, 'our-north')
    assert.equal(b.march?.left, R.marchSlow - 1, '고갯길은 두 계절 — 아직 한 계절 남았다')
    assert.deepEqual(advance(go(true), [order]), advance(go(true), [order]))
  })

  it('말머리 뿔잔 — 호궤에 드는 곡식이 준다', () => {
    const feast = (horn: boolean): number | undefined => {
      const r = mini()
      if (horn) wear(r, 'chief', 'horncup')
      return sideFor(r, 'a-us').feast
    }
    const n = feast(false)!
    const y = feast(true)!
    const r = mini()
    assert.equal(n, feastCost(headcount(forceOf(r, r.armies['a-us']!))))
    assert.equal(y, Math.max(1, Math.round(n * R.relicHornFeast)))
    assert.ok(y < n)
  })

  it('굵은고리 금귀걸이 — 회유하면 마음의 벽이 빨리 깎인다', () => {
    const woo = (ear: boolean): Realm => {
      const r = mini()
      r.armies['a-guya-1']!.hero = null
      const g = r.heroes['guya-1']!
      g.status = 'captive'
      g.captor = 'us'
      g.persuade = { by: 'us-1', left: 9, resist: 20, tries: 0 }
      if (ear) wear(r, 'us-1', 'earring')
      stepHeroes(r, [])
      return r
    }
    const n = woo(false)
    const y = woo(true)
    assert.ok(Math.abs(persuadeDropOf(y, 'us-1') / persuadeDropOf(n, 'us-1') - R.relicEarringWoo) < 1e-9)
    assert.ok(y.heroes['guya-1']!.persuade!.resist! < n.heroes['guya-1']!.persuade!.resist!)
    assert.deepEqual(woo(true), y)
  })

  it('금동대향로 — 나라 제사가 무당 핏줄처럼 두 배 · 큰 제사 길이 한 번 짧다', () => {
    const rite = (incense: boolean): Realm => {
      const r = mini()
      r.season = 2 // 가을 — 제사가 모든 군대 사기를 올린다
      if (incense) wear(r, 'us-1', 'incense')
      r.stock['us'] = { ...r.stock['us']!, grain: 999, iron: 99 }
      r.armies['a-us']!.morale = 0.5
      resolveRites(r, [{ kind: 'rite', faction: 'us' }], [])
      return r
    }
    const n = rite(false)
    const y = rite(true)
    assert.equal(riteMul(n, 'us'), 1)
    assert.equal(riteMul(y, 'us'), R.relicIncenseRite)
    assert.ok(y.armies['a-us']!.morale > n.armies['a-us']!.morale)
    assert.equal(riteOf(y, 'us').need, riteOf(n, 'us').need - R.relicIncenseStep)
    // 지닌 장수가 잡혀 있으면 없는 셈
    y.heroes['us-1']!.status = 'captive'
    assert.equal(riteMul(y, 'us'), 1)
    assert.equal(riteOf(y, 'us').need, riteOf(n, 'us').need)
  })

  it('진묘수 — 맡은 고을에 쳐들어온 적이 싸움 없이 돌아간다 (판마다 한 번)', () => {
    const raid = (r: Realm): void => {
      const a = r.armies['a-anya-1']!
      a.at = 'anya-cap'
      a.march = { from: 'anya-cap', to: 'our-north', edge: 'e05', left: 1, ambush: false, aim: 'us' }
    }
    const setup = (guard: boolean): Realm => {
      const r = mini()
      const h = r.heroes['us-1']!
      h.post = 'our-north'
      h.at = 'our-north'
      if (guard) wear(r, 'us-1', 'guardian')
      raid(r)
      return r
    }
    const battleAt = (lines: readonly ReportLine[]): boolean => lines.some((l) => l.kind === 'battle' && l.node === 'our-north')
    assert.ok(battleAt(advance(setup(false), []).report.lines))
    assert.equal(preview(setup(false), []).length, 1)
    assert.equal(preview(setup(true), []).length, 0, '저격 판도 안 열린다')
    const y = advance(setup(true), [])
    assert.ok(!battleAt(y.report.lines))
    const save = y.report.lines.find((l) => l.kind === 'relicSave')!
    assert.deepEqual(save, { kind: 'relicSave', faction: 'us', hero: 'us-1', relic: 'guardian', node: 'our-north', foe: 'anya' })
    assert.equal(y.next.armies['a-anya-1']!.march?.to, 'anya-cap')
    assert.deepEqual(y.next.heroes['us-1']!.relicSpent, { ward: 1 })
    assert.ok(reportText(setup(true), y.next, save, 'us')!.includes('진묘수'))
    assert.ok(reportText(setup(true), y.next, save, 'anya')!.includes('진묘수'))
    assert.deepEqual(advance(setup(true), []), y)
    // 두 번째는 못 막는다
    const again = y.next
    raid(again)
    assert.ok(battleAt(advance(again, []).report.lines))
  })

  it('금동신발 — 자객으로 보내면 덜 들킨다 (신고 들킨 판은 안 신어도 들켰다)', () => {
    const kill: Order = { kind: 'plot', faction: 'us', op: 'assassin', target: 'guya', hero: 'guya-1', agent: 'us-1' }
    const caught = (shoes: boolean, seed: number): boolean => {
      const r = mini(seed)
      r.met = { us: ['guya-1'] }
      if (shoes) wear(r, 'us-1', 'shoes')
      const l = advance(r, [kill]).report.lines.find((x) => x.kind === 'plot')
      assert.ok(l !== undefined && l.kind === 'plot')
      return l.caught
    }
    let n = 0
    let y = 0
    for (let seed = 1; seed <= 150; seed++) {
      const a = caught(false, seed)
      const b = caught(true, seed)
      if (b) assert.ok(a, `시드 ${seed}`)
      n += a ? 1 : 0
      y += b ? 1 : 0
    }
    assert.ok(y < n, `신발 ${y} · 맨발 ${n}`)
    assert.equal(caught(true, 9), caught(true, 9))
  })
})

describe('유물 — 옛 판 · 결정론', () => {
  it('유물이 없는 장수 — 효과는 0 · 1', () => {
    assert.deepEqual(relicDefs(body), [])
    assert.equal(relicSum(body, 'iron'), 0)
    assert.equal(relicMul(null, 'horse'), 1)
    assert.equal(relicMoraleOf(null), 0)
  })

  it('옛 저장(relics 없음)도 그대로 돈다 · 같은 판은 같은 끝', () => {
    const play = (withRelics: boolean): string => {
      let r = bihwa(11)
      const ids = ['polebell', 'gogok', 'ingots', 'cheonma', 'goldbelt', 'mirror', 'eightbell', 'duck', 'wheelcup', 'horncup', 'earring', 'incense', 'guardian', 'shoes']
      if (withRelics) relicRealm(r, Object.fromEntries(ourHeroes(r).map((h, i) => [h.id, [ids[i % ids.length]!]])))
      r = JSON.parse(JSON.stringify(r)) as Realm // 저장했다 불러온 판
      for (let s = 0; s < 8 && !r.outcome; s++) r = advance(r, [...decide(r, r.player, 'planner'), ...aiOrders(r)]).next
      return JSON.stringify(r)
    }
    assert.equal(play(false), play(false))
    assert.equal(play(true), play(true))
    assert.ok(play(true).includes('"relics"'))
  })
})
