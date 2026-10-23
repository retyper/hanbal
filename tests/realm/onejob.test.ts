/**
 * 한 장수 한 계절 한 가지 일 (형 2026-10-23: "원정 보냈는데 조공 요구에 협보를 보낼 수도 있잖아 · 원정이랑 도읍 맡기가 동시에")
 *  - 같은 장수의 두 번째 일은 버린다 (먼저 온 것이 이긴다)
 *  - 원정 중인 장수는 아무 일도 못 맡는다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { oneJobPerHero } from '../../src/realm/heroes.ts'
import type { Order, Realm } from '../../src/realm/types.ts'

const pickHero = (r: Realm): string => Object.values(r.heroes).find((h) => h.faction === r.player && h.status === 'free' && r.factions[r.player]?.ruler !== h.id)!.id

describe('한 장수 한 가지 일', () => {
  it('같은 장수의 두 번째 일은 버린다', () => {
    const r = byeonhanMini(1)
    const id = pickHero(r)
    const cap = r.factions[r.player]!.capital
    const orders: Order[] = [
      { kind: 'expedition', faction: r.player, hero: id, dest: 'wa', len: 1 },
      { kind: 'assign', hero: id, node: cap },
      { kind: 'envoy', from: r.player, to: 'guya', ask: 'gift', give: { grain: 1, iron: 0 }, take: { grain: 0, iron: 0 }, hero: id },
    ]
    const out = oneJobPerHero(r, orders)
    assert.deepEqual(out.map((o) => o.kind), ['expedition'])
  })

  it('원정 중인 장수의 일은 다 버리고, 맡기 그만두기(node null)는 일이 아니다', () => {
    const r = byeonhanMini(1)
    const id = pickHero(r)
    r.expeditions = [{ hero: id, faction: r.player, dest: 'wa', len: 1, back: r.season + 4, got: { kind: 'none' } }]
    const out = oneJobPerHero(r, [{ kind: 'lead', hero: id, army: 'x' }, { kind: 'assign', hero: id, node: null }])
    assert.deepEqual(out.map((o) => o.kind), ['assign'])
  })
})
