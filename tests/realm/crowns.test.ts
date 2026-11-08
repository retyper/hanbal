/**
 * 결승선 왕관 (src/ui/realm/crowns.ts · 위원회 11-08 loop L4) — 정복이 반을 넘으면 왕관이 뜨고, 쥔 도읍만큼 켜지고, 새로 쥔 도읍에서 날아온다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import { crownCount, crownPhase, crownRowHtml, crownTargets, newCrowns } from '../../src/ui/realm/crowns.ts'
import { P } from '../../src/tune/params.ts'

describe('결승선 왕관', () => {
  it('정복이 crownShowAt 몫을 넘어야 뜬다 · 남은 남의 도읍마다 · 쥔 만큼 켜진다', () => {
    const r = startYeongnam(1, 'saro')
    const me = r.player
    const c0 = crownCount(r, me)!
    assert.ok(c0.need > 1)
    assert.equal(crownPhase(r, me), false, '처음엔 안 뜬다')
    assert.equal(crownRowHtml(r, me, '/'), '')
    // 남의 도읍을 쥐어 crownShowAt 몫을 넘긴다
    const others = Object.values(r.factions).filter((f) => f.id !== me).map((f) => f.capital)
    const want = Math.ceil(c0.need * P.realm.crownShowAt) - c0.held
    for (const cap of others.slice(0, want)) r.nodes[cap]!.owner = me
    assert.equal(crownPhase(r, me), true)
    const t = crownTargets(r, me)
    assert.ok(t.size > 0 && [...t].every((id) => r.nodes[id]!.owner !== me), '왕관은 아직 못 쥔 도읍에만')
    const row = crownRowHtml(r, me, '/')
    assert.equal((row.match(/class="on"/g) ?? []).length, crownCount(r, me)!.held, '쥔 만큼 켜진다')
    assert.equal((row.match(/<img/g) ?? []).length, c0.need)
  })
  it('새로 쥔 남의 도읍만 날아온다 (우리 도읍·옛 것 빼고)', () => {
    const prev = startYeongnam(1, 'saro')
    const next = structuredClone(prev)
    const cap = Object.values(next.factions).find((f) => f.id !== next.player)!.capital
    next.nodes[cap]!.owner = next.player
    assert.deepEqual(newCrowns(prev, next, next.player), [cap])
    assert.deepEqual(newCrowns(next, next, next.player), [])
  })
})
