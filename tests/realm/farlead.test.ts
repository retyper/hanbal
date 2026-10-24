/**
 * 멀리 있는 군대에 가서 이끈다 (형 2026-10-24: "군대를 맡기려면 그냥 이동도 있어야 · 군대도 직접 가서 맡겨야 함")
 *  - 우리 땅으로 이어진 곳에 서 있는 장수 없는 군대는 멀리서도 이끈다 — 그 계절은 길에 있다
 *  - 이미 길에 있는 장수는 못 간다 · 우리 땅으로 이어지지 않은 군대는 못 간다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { applyHeroOrders } from '../../src/realm/heroes.ts'
import type { Realm } from '../../src/realm/types.ts'

/** 도읍에 선 우리 장수 하나 · 우리 군대를 장수 없이 our-north 로 옮겨 둔다 */
function setup(): { r: Realm, hero: string, army: string } {
  const r = byeonhanMini(1)
  const a = r.armies['a-us']!
  const chief = r.heroes[a.hero!]!
  a.hero = null
  chief.at = 'our-cap'
  a.at = 'our-north'
  return { r, hero: chief.id, army: a.id }
}

describe('멀리 가서 이끈다', () => {
  it('우리 땅으로 이어진 군대는 멀리서도 이끌고, 그 계절은 길에 있다', () => {
    const { r, hero, army } = setup()
    applyHeroOrders(r, [{ kind: 'lead', hero, army }], [])
    assert.equal(r.armies[army]!.hero, hero)
    assert.equal(r.heroes[hero]!.awayUntil, r.season)
    assert.equal(r.heroes[hero]!.at, null)
  })

  it('이미 길에 있는 장수는 못 간다', () => {
    const { r, hero, army } = setup()
    r.heroes[hero]!.awayUntil = r.season
    applyHeroOrders(r, [{ kind: 'lead', hero, army }], [])
    assert.equal(r.armies[army]!.hero, null)
  })

  it('남의 땅에 선 군대에는 못 간다', () => {
    const { r, hero, army } = setup()
    r.nodes['our-north']!.owner = 'them'
    applyHeroOrders(r, [{ kind: 'lead', hero, army }], [])
    assert.equal(r.armies[army]!.hero, null)
  })
})

describe('대기 — 자리를 내려놓는다', () => {
  it('맡기 그만두기(node null)는 이끌던 군대에서도 내린다 · 군대는 그 자리에 남는다', () => {
    const r = byeonhanMini(1)
    const a = r.armies['a-us']!
    const id = a.hero!
    applyHeroOrders(r, [{ kind: 'assign', hero: id, node: null }], [])
    assert.equal(r.armies['a-us']!.hero, null)
    assert.equal(r.heroes[id]!.at, a.at)
    assert.equal(r.heroes[id]!.post, null)
  })
})
