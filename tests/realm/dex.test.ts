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

import { DEX_CAUGHT, DEX_HEARD, DEX_MET, DEX_SERVED, dexCatalog, dexCounts, dexLevel, heroGrade, scanDex } from '../../src/realm/dex.ts'
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
