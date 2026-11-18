/**
 * 도감 (src/realm/dex.ts · VISION §5-4) — 판을 넘어 남는 장수 기록
 *
 *  - 명단: 판마다 한 사람은 한 번 · 같은 id 는 판이 달라도 같은 이름 · 떠돌이도 든다
 *  - 등급: 나쁘지 않은 특성 가운데 가장 좋은 것
 *  - 훑기: 우리 장수는 거느림 · 사로잡으면 사로잡음 · 본 장수는 만남 · 아는 나라 장수는 들음 · 배우는 판은 셈하지 않는다
 *  - 칸은 꺼지지 않는다 (판이 끝나도, 져도 남는다) · 처음 오른 판을 적는다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { DEX_AWOKE, DEX_BOSS, DEX_CAUGHT, DEX_DEMON, DEX_HEARD, DEX_MASK, DEX_MET, DEX_SERVED, dexCatalog, dexCounts, dexLevel, heroGrade, scanDex } from '../../src/realm/dex.ts'
import { sealsOf } from '../../src/realm/person.ts'
import { getParam, setParam } from '../../src/tune/params.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import { HERO_POOL } from '../../src/realm/data/heroes-pool.ts'

describe('도감 — 명단', () => {
  it('한 사람은 한 번 · 판의 장수와 떠돌이가 다 든다', () => {
    const all = dexCatalog()
    const ids = all.map((x) => x.id)
    assert.equal(new Set(ids).size, ids.length)
    for (const region of ['byeonhan-mini', 'yeongnam', 'south', 'world'] as const) {
      const r = startRegion(region, 1, region === 'world' || region === 'south' ? 'saro' : 'us')
      for (const h of Object.values(r.heroes)) assert.ok(ids.includes(h.id), `${region} ${h.id} 가 도감에 없다`)
    }
    for (const h of HERO_POOL) assert.ok(ids.includes(h.id))
    assert.ok(!ids.some((id) => all.find((x) => x.id === id)!.board === 'tutorial'))
  })

  it('같은 id 는 판이 달라도 같은 사람이다', () => {
    const byId = new Map(dexCatalog().map((x) => [x.id, x.name]))
    for (const region of ['byeonhan-mini', 'yeongnam', 'south', 'world'] as const) {
      const r = startRegion(region, 3, region === 'byeonhan-mini' ? 'us' : 'saro')
      for (const h of Object.values(r.heroes)) assert.equal(h.name, byId.get(h.id), `${region} ${h.id}`)
    }
  })

  it('등급은 나쁘지 않은 특성 가운데 가장 좋은 것', () => {
    assert.equal(heroGrade({ traits: [] }), 'common')
    assert.equal(heroGrade({ traits: ['farmer', 'archer'] }), 'rare')
    assert.equal(heroGrade({ traits: ['coward', 'glutton'] }), 'common')
    assert.equal(heroGrade({ traits: ['traitor', 'charm'] }), 'rare')
    assert.equal(heroGrade({ traits: ['ironhand'] }), 'precious')
  })
})

describe('도감 — 한 판 훑기', () => {
  it('우리 장수는 거느림 · 아는 나라 장수는 들음 · 처음 오른 판을 적는다', () => {
    const r = byeonhanMini(7)
    const { dex, fresh } = scanDex({}, r)
    for (const h of Object.values(r.heroes)) {
      if (h.faction === r.player) assert.equal(dexLevel(dex[h.id]!.f), 4, h.id)
      else assert.ok((dex[h.id]?.f ?? 0) & DEX_HEARD, `${h.id} 들음`)
    }
    assert.ok(fresh.length > 0)
    assert.equal(Object.values(dex)[0]!.b, 'byeonhan-mini')
  })

  it('우리 장수로 각성한 이는 각성 칸이 켜진다 — 남의 각성은 안 켜진다 · 단계는 그대로 (형 11-03 영웅전 각성 토글)', () => {
    const r = byeonhanMini(7)
    const mine = Object.values(r.heroes).filter((h) => h.faction === r.player).sort((a, b) => (a.id < b.id ? -1 : 1))[0]!
    const foe = Object.values(r.heroes).filter((h) => h.faction !== r.player).sort((a, b) => (a.id < b.id ? -1 : 1))[0]!
    mine.ascended = true
    foe.ascended = true
    const { dex } = scanDex({}, r)
    assert.ok(dex[mine.id]!.f & DEX_AWOKE)
    assert.equal(dexLevel(dex[mine.id]!.f), 4)
    assert.equal((dex[foe.id]?.f ?? 0) & DEX_AWOKE, 0)
  })

  it('사로잡은 장수는 사로잡음 · 본 장수는 만남', () => {
    const r = byeonhanMini(7)
    const foe = Object.values(r.heroes).filter((h) => h.faction !== r.player).sort((a, b) => (a.id < b.id ? -1 : 1))
    const a = foe[0]!
    const b = foe[1]!
    a.status = 'captive'
    a.captor = r.player
    ;(r.met ??= {})[r.player] = [b.id]
    const { dex } = scanDex({}, r)
    assert.equal(dexLevel(dex[a.id]!.f), 3)
    assert.ok(dex[a.id]!.f & DEX_MET)
    assert.equal(dexLevel(dex[b.id]!.f), 2)
    assert.equal(dex[b.id]!.f & (DEX_CAUGHT | DEX_SERVED), 0)
  })

  it('칸은 꺼지지 않는다 — 다른 판에서 못 봐도 남는다 · 같은 것을 다시 훑으면 새것이 없다', () => {
    const r = byeonhanMini(7)
    const first = scanDex({}, r).dex
    const again = scanDex(first, r)
    assert.equal(again.fresh.length, 0)
    const other = startRegion('yeongnam', 2, 'saro')
    const merged = scanDex(first, other).dex
    for (const [id, e] of Object.entries(first)) assert.equal(merged[id]!.f & e.f, e.f, id)
    // 처음 오른 판은 그대로
    for (const [id, e] of Object.entries(first)) assert.equal(merged[id]!.b, e.b, id)
  })

  it('배우는 판은 셈하지 않는다', () => {
    const r = startRegion('tutorial', 1, 'us')
    assert.equal(scanDex({}, r).fresh.length, 0)
  })

  it('셈 — 칸마다 센다', () => {
    const r = byeonhanMini(7)
    const { dex } = scanDex({}, r)
    const c = dexCounts(dex)
    assert.equal(c.total, dexCatalog().length)
    assert.equal(c.served, Object.values(r.heroes).filter((h) => h.faction === r.player).length)
    assert.ok(c.heard >= c.met && c.met >= c.served)
  })
})

// ───────── 각성 v2 의 바닥 (docs/realm/study-20261118/30-PROPOSAL.md 1절 ⑥ · ⑩ · 7-1 가3)
describe('도감 — 사람 단위 도장 (본편 도장 16 · 도깨비 도장 32 · 두목 만남 64)', () => {
  it('아는 비트는 일곱 · 마스크는 127 · 서로 안 겹친다', () => {
    const bits = [DEX_HEARD, DEX_MET, DEX_CAUGHT, DEX_SERVED, DEX_AWOKE, DEX_DEMON, DEX_BOSS]
    assert.deepEqual(bits, [1, 2, 4, 8, 16, 32, 64])
    assert.equal(DEX_MASK, 127)
    assert.equal(bits.reduce((a, b) => a | b, 0), DEX_MASK)
  })

  it('판을 훑어도 도깨비 도장과 두목 만남은 꺼지지 않는다 · 훑기는 그 둘을 켜지도 않는다', () => {
    const r = byeonhanMini(7)
    const mine = Object.values(r.heroes).filter((h) => h.faction === r.player).sort((a, b) => (a.id < b.id ? -1 : 1))[0]!
    mine.ascended = true
    const { dex } = scanDex({ [mine.id]: { f: DEX_DEMON | DEX_BOSS }, 'tut-haebi': { f: DEX_DEMON } }, r)
    assert.equal(dex[mine.id]!.f, DEX_HEARD | DEX_MET | DEX_SERVED | DEX_AWOKE | DEX_DEMON | DEX_BOSS)
    assert.deepEqual(dex['tut-haebi'], { f: DEX_DEMON }, '명단에 없는 id 의 도장도 그대로 둔다')
    const plain = scanDex({}, r).dex
    for (const [id, e] of Object.entries(plain)) assert.equal(e.f & (DEX_DEMON | DEX_BOSS), 0, id)
  })

  it('본편 도장은 사람으로 읽는다 — 1장의 온조가 불꽃을 채우면 배우는 판의 온조도 같은 사람이다', () => {
    const r = startRegion('mahan', 1, 'us')
    const onjo = r.heroes['mh-onjo']!
    assert.equal(onjo.faction, r.player)
    onjo.ascended = true
    const { dex } = scanDex({}, r)
    assert.deepEqual(sealsOf(dex, 'tut-onjo'), { flame: true, demon: false, both: false })
    assert.equal(dex['tut-onjo'], undefined, '표는 옮기지 않는다')
  })
})

describe('도감 — 배우는 판은 도장의 뒷문이 아니다', () => {
  const KEY = 'realm.ascendTrialOpen'
  const withSwitch = <T>(v: 0 | 1, f: () => T): T => {
    const was = getParam(KEY)!
    setParam(KEY, v)
    try { return f() } finally { setParam(KEY, was) }
  }
  const wokenTutorial = (): ReturnType<typeof startRegion> => {
    const r = startRegion('tutorial', 1, 'us')
    for (const id of ['tut-onjo', 'tut-ogan', 'tut-malgalgi']) {
      assert.equal(r.heroes[id]!.faction, r.player, id)
      r.heroes[id]!.ascended = true
    }
    return r
  }

  it('말갈기의 맛보기 각성은 빌린 힘이다 — 영남 판의 말갈기에게 아무것도 안 적힌다', () => {
    const { dex, fresh } = scanDex({}, wokenTutorial())
    assert.equal(dex['sabeol-1'], undefined)
    assert.equal(dex['tut-malgalgi'], undefined)
    assert.ok(!fresh.some((x) => x.id === 'sabeol-1'))
    assert.deepEqual(sealsOf(dex, 'sabeol-1'), { flame: false, demon: false, both: false })
  })

  it('지금 규칙에서는 오간 · 온조의 각성을 1장의 같은 사람에게 적는다 (형 11-04 · 화면은 지금 그대로)', () => {
    assert.equal(getParam(KEY), 1, '스위치를 켜는 날 이 묶음을 같이 본다')
    const { dex, fresh } = scanDex({}, wokenTutorial())
    assert.deepEqual(dex, { 'mh-ogan': { f: DEX_AWOKE, b: 'mahan' }, 'mh-onjo': { f: DEX_AWOKE, b: 'mahan' } })
    assert.deepEqual(fresh.map((x) => x.id), ['mh-ogan', 'mh-onjo'])
    assert.equal(scanDex(dex, wokenTutorial()).fresh.length, 0, '다시 훑으면 새것이 없다')
  })

  it('옛 기록은 그대로 둔다 — 예전 배우는 판에서 켜진 말갈기의 각성해 봄은 안 꺼진다', () => {
    const old = { 'sabeol-1': { f: DEX_AWOKE, b: 'mahan' as const } }
    assert.deepEqual(scanDex(old, wokenTutorial()).dex['sabeol-1'], { f: DEX_AWOKE, b: 'mahan' })
  })

  it('각성 v2 를 켜면(시련 관문 0) 배우는 판은 영웅전에 아무것도 안 적는다', () => {
    withSwitch(0, () => {
      const { dex, fresh } = scanDex({}, wokenTutorial())
      assert.deepEqual(dex, {})
      assert.equal(fresh.length, 0)
    })
  })

  it('본편의 말갈기는 제 불꽃으로 도장을 받는다 — 막는 것은 배우는 판뿐이다', () => {
    const r = startRegion('yeongnam', 2, 'sabeol')
    const m = r.heroes['sabeol-1']!
    assert.equal(m.faction, r.player)
    m.ascended = true
    assert.ok(scanDex({}, r).dex['sabeol-1']!.f & DEX_AWOKE)
  })
})
