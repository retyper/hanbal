/**
 * 계승 가신 (src/realm/legacy.ts · VISION §5-4) — 판이 끝날 때 셋을 골라 다음 판에 데려간다
 *
 *  - 데려갈 수 있는 이: 우리 장수 · 살아 있음 · 군주 아님 · 배우는 판은 없음
 *  - 따라오는 몸: 자란 솜씨·특성(눈뜬 것)·공은 그대로, 자리·정·다친 몸은 내려놓는다
 *  - 새 판: 우리 도읍에 머문다 · 셋까지 · 그 판에서 남의 장수였으면 그 군대에서 빠진다 · 군주는 못 데려간다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { bringRetainers, retainable, snapshot } from '../../src/realm/legacy.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import { P } from '../../src/tune/params.ts'

describe('계승 가신', () => {
  it('데려갈 수 있는 이 — 우리 장수, 살아 있고 군주가 아닌 이', () => {
    const r = byeonhanMini(5)
    const list = retainable(r)
    assert.ok(list.length > 0)
    for (const h of list) {
      assert.equal(h.faction, r.player)
      assert.ok(!h.id.endsWith('-ruler'))
    }
    list[0]!.status = 'dead'
    assert.ok(!retainable(r).some((h) => h.id === list[0]!.id))
    assert.equal(retainable(startRegion('tutorial', 1, 'us')).length, 0)
  })

  it('따라오는 몸 — 솜씨·특성·공은 그대로, 자리와 정은 내려놓는다', () => {
    const r = byeonhanMini(5)
    const h = retainable(r)[0]!
    h.mu = 9
    h.grown = { mu: 2 }
    h.xp = { tong: 3 }
    h.bond = 90
    h.post = h.at
    h.woundedUntil = 99
    ;(h as { traits: readonly string[] }).traits = [...h.traits, 'careful']
    h.awoken = 'careful'
    const s = snapshot(h)
    assert.equal(s.mu, 9)
    assert.deepEqual(s.grown, { mu: 2 })
    assert.deepEqual(s.xp, { tong: 3 })
    assert.ok(s.traits.includes('careful'))
    assert.equal(s.awoken, 'careful')
    assert.equal(s.bond, undefined)
    assert.equal(s.post, null)
    assert.equal(s.woundedUntil, undefined)
    assert.equal(s.status, 'free')
  })

  it('새 판 — 우리 도읍에 · 셋까지 · 남의 군대를 이끌던 사람은 군대에서 빠진다', () => {
    const old = byeonhanMini(5)
    const mine = retainable(old).map(snapshot)
    // 남의 나라 장군 하나를 우리가 거느렸다고 친다
    const foe = Object.values(old.heroes).find((h) => h.faction !== old.player && !h.id.endsWith('-ruler'))!
    const extra = { ...snapshot(foe), mu: 10 }
    const next = startRegion('yeongnam', 9, 'saro')
    const led = Object.values(next.armies).find((a) => a.hero === foe.id)
    const baseMu = next.heroes[foe.id]?.mu
    const got = bringRetainers(next, [extra, ...mine, ...mine])
    assert.ok(got.length <= P.realm.retainMax)
    assert.equal(new Set(got).size, got.length)
    assert.deepEqual(next.retainers, got)
    const cap = next.factions[next.player]!.capital
    for (const id of got) {
      assert.equal(next.heroes[id]!.faction, 'saro')
      assert.equal(next.heroes[id]!.at, cap)
    }
    // 처음 몸으로 — 지난 판에서 자란 솜씨(mu 10)는 따라오지 않는다 (회의 결정 META §7-3)
    if (got.includes(foe.id) && baseMu !== undefined) assert.equal(next.heroes[foe.id]!.mu, baseMu)
    if (led !== undefined) assert.equal(next.armies[led.id]!.hero, null)
  })

  it('군주는 못 데려간다 · 배우는 판엔 안 온다', () => {
    const old = byeonhanMini(5)
    const ruler = Object.values(old.heroes).find((h) => h.id.endsWith('-ruler') && h.faction !== old.player)!
    const next = startRegion('yeongnam', 9, 'saro')
    assert.deepEqual(bringRetainers(next, [snapshot(ruler)]), [])
    assert.equal(next.retainers, undefined)
    const tut = startRegion('tutorial', 1, 'us')
    assert.deepEqual(bringRetainers(tut, retainable(old).map(snapshot)), [])
  })

  it('이야기 장에도 영웅전의 동행이 따라온다 — 배우는 판만 빼고 (형 10-25)', () => {
    const old = byeonhanMini(5)
    const picks = retainable(old).slice(0, 1).map(snapshot)
    const ch = startRegion('mahan', 3, 'baekje')
    const got = bringRetainers(ch, picks)
    assert.equal(got.length, 1)
    assert.equal(ch.heroes[got[0]!]!.faction, 'baekje')
    assert.equal(ch.heroes[got[0]!]!.at, 'mh-wirye-cap')
  })
})
