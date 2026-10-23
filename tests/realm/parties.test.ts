/**
 * 개척단 (src/realm/parties.ts · 형 2026-10-23: "백성 배치 … 아직도 이해가 안 돼" → 문명의 개척자처럼 말 하나)
 *
 *  - 꾸리면 그 고을 가구·곡식·나무가 빠지고 개척단이 선다 · 길을 함께 주면 바로 떠난다
 *  - 빈땅에 닿으면 마을이 선다(settle 줄) · 우리 땅은 지나간다 · 남의 땅으로는 못 간다
 *  - 적 군대가 머무는 곳에 서면 흩어진다
 *  - 한 나라에 partyMax 까지 · 같은 판이면 같은 결과
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { partyCost, partyMoves, partySize, partiesOf } from '../../src/realm/parties.ts'
import { advance } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm } from '../../src/realm/types.ts'

/** 우리 고을 가운데 빈땅과 맞닿은 곳 하나 — (고을, 그 길, 빈땅) */
function frontier(r: Realm): { from: string; edge: string; to: string } {
  const me = r.player
  for (const n of Object.values(r.nodes).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (n.owner !== me || n.kind === 'wild' || n.kind === 'sodo') continue
    const m = partyMoves(r, me, n.id).find((x) => x.found)
    if (m !== undefined) return { from: n.id, edge: m.edge, to: m.to }
  }
  throw new Error('빈땅과 맞닿은 우리 고을이 없다')
}

const rich = (r: Realm): Realm => {
  r.stock[r.player]!.grain = 2000
  r.stock[r.player]!.wood = 200
  return r
}

describe('개척단', () => {
  it('꾸리면 가구·곡식·나무가 빠지고 개척단이 선다', () => {
    const r = rich(byeonhanMini(1))
    const { from } = frontier(r)
    const n = partySize(r, r.player, from)
    assert.ok(n >= P.realm.partyMin)
    const hh0 = r.nodes[from]!.hh
    const g0 = r.stock[r.player]!.grain
    const { next, report } = advance(r, [{ kind: 'party', faction: r.player, node: from }])
    const ps = partiesOf(next, r.player)
    assert.equal(ps.length, 1)
    assert.equal(ps[0]!.hh, n)
    assert.ok(report.lines.some((l) => l.kind === 'party'))
    assert.ok(next.nodes[from]!.hh <= hh0 - n + hh0 * 0.2) // 꾸린 만큼 빠진다 (그 계절 늘어난 몫은 덤)
    assert.ok(next.stock[r.player]!.grain <= g0 - partyCost(n).grain + 1000)
  })

  it('길을 함께 주면 떠나고, 빈땅에 닿으면 마을이 선다', () => {
    let r = rich(byeonhanMini(1))
    const { from, edge, to } = frontier(r)
    const first = advance(r, [{ kind: 'party', faction: r.player, node: from, edge }])
    let settled = first.report.lines.some((l) => l.kind === 'settle' && l.to === to)
    r = first.next
    for (let i = 0; i < 4 && !settled; i++) {
      const s = advance(r, [])
      settled = s.report.lines.some((l) => l.kind === 'settle' && l.to === to && l.faction === r.player)
      r = s.next
    }
    assert.ok(settled, '닿으면 마을이 서야 한다')
    assert.equal(r.nodes[to]!.owner, r.player)
    assert.ok(r.nodes[to]!.hh > 0)
    assert.equal(partiesOf(r, r.player).length, 0)
  })

  it('적 군대가 머무는 곳에 서면 흩어진다', () => {
    let r = rich(byeonhanMini(1))
    const { from } = frontier(r)
    r = advance(r, [{ kind: 'party', faction: r.player, node: from }]).next
    const foe = Object.values(r.armies).find((a) => a.faction !== r.player)!
    foe.at = from
    foe.march = null
    const s = advance(r, [])
    assert.ok(s.report.lines.some((l) => l.kind === 'partyLost'))
    assert.equal(partiesOf(s.next, r.player).length, 0)
  })

  it('한 나라에 partyMax 까지', () => {
    let r = rich(byeonhanMini(1))
    const { from } = frontier(r)
    for (let i = 0; i < P.realm.partyMax; i++) r = rich(advance(r, [{ kind: 'party', faction: r.player, node: from }]).next)
    assert.equal(partiesOf(r, r.player).length, P.realm.partyMax)
    assert.equal(partySize(r, r.player, from), 0)
  })

  it('같은 판 · 같은 명령이면 같은 결과', () => {
    const run = (): string => {
      let r = rich(byeonhanMini(2))
      const { from, edge } = frontier(r)
      r = advance(r, [{ kind: 'party', faction: r.player, node: from, edge }]).next
      for (let i = 0; i < 3; i++) r = advance(r, []).next
      return JSON.stringify([r.parties, r.nodes])
    }
    assert.equal(run(), run())
  })
})
