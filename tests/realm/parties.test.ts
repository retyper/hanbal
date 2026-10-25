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
import { joinable, partyCost, partyMoves, partySize, partiesOf, stepParties } from '../../src/realm/parties.ts'
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

  it('우리 고을에 선 개척단은 「자리 잡기」로 그 고을 백성이 된다 (이주)', () => {
    let r = rich(byeonhanMini(1))
    const { from } = frontier(r)
    r = advance(r, [{ kind: 'party', faction: r.player, node: from }]).next
    const p = partiesOf(r, r.player)[0]!
    assert.ok(joinable(r, p))
    const hh0 = r.nodes[from]!.hh
    const s = advance(r, [{ kind: 'partyJoin', party: p.id }])
    assert.equal(partiesOf(s.next, r.player).length, 0)
    assert.ok(s.report.lines.some((l) => l.kind === 'migrate' && l.walk === true && l.n === p.hh))
    assert.ok(s.next.nodes[from]!.hh >= hh0 + p.hh - 1)
  })

  it('빈땅·남의 땅에서는 자리 잡기가 안 된다', () => {
    const r = rich(byeonhanMini(1))
    const { to } = frontier(r)
    assert.equal(joinable(r, { id: 'x', faction: r.player, home: to, at: to, hh: 5, march: null }), false)
    const foeNode = Object.values(r.nodes).find((n) => n.owner !== null && n.owner !== r.player && n.kind !== 'sodo')!
    assert.equal(joinable(r, { id: 'y', faction: r.player, home: foeNode.id, at: foeNode.id, hh: 5, march: null }), false)
  })
})

/** 같은 빈땅으로 한 계절 뒤 닿는 우리 개척단 하나와 남의 개척단 하나 (형 10-25: 겹치면 누가 · 가는 사이 먼저 일구면) */
function race(): { r: Realm; to: string; ours: string; theirs: string; foe: string; foeHome: string; from: string } {
  const r = rich(byeonhanMini(1))
  const { from, edge, to } = frontier(r)
  const foe = Object.keys(r.factions).sort().find((f) => f !== r.player)!
  const foeHome = r.factions[foe]!.capital
  // 남의 것이 id 로는 앞선다 — 그래도 우리가 먼저여야 한다
  r.parties = {
    'party-0-aaa': { id: 'party-0-aaa', faction: foe, home: foeHome, at: foeHome, hh: 40, march: { from: foeHome, to, edge, left: 1 } },
    'party-0-zzz': { id: 'party-0-zzz', faction: r.player, home: from, at: from, hh: 50, march: { from, to, edge, left: 1 } },
  }
  return { r, to, ours: 'party-0-zzz', theirs: 'party-0-aaa', foe, foeHome, from }
}

describe('개척단 — 겹치거나 먼저 일궈졌을 때', () => {
  it('같은 계절 같은 빈땅에 닿으면 우리가 먼저 자리 잡고, 남의 개척단은 흩어지지 않고 돌아간다', () => {
    const { r, to, theirs, foe, foeHome } = race()
    const lines: Parameters<typeof stepParties>[1] = []
    stepParties(r, lines)
    assert.equal(r.nodes[to]!.owner, r.player)
    assert.ok(lines.some((l) => l.kind === 'settle' && l.faction === r.player && l.to === to))
    const back = r.parties?.[theirs]
    assert.ok(back !== undefined, '남의 개척단도 흩어지지 않는다')
    assert.equal(back!.at, foeHome)
    assert.equal(back!.hh, 40)
    assert.ok(lines.some((l) => l.kind === 'partyBack' && l.faction === foe && l.by === r.player))
  })

  it('가는 사이 남이 먼저 일궜으면 떠나온 곳으로 돌아와 멈춰 선다 · 가구는 그대로', () => {
    const { r, to, ours, theirs, foe, from } = race()
    delete r.parties![theirs]
    r.nodes[to]!.owner = foe
    const lines: Parameters<typeof stepParties>[1] = []
    stepParties(r, lines)
    const p = r.parties?.[ours]
    assert.ok(p !== undefined)
    assert.equal(p!.at, from)
    assert.equal(p!.march, null)
    assert.equal(p!.hh, 50)
    assert.ok(lines.some((l) => l.kind === 'partyBack' && l.faction === r.player && l.by === foe && l.back === from))
    assert.ok(!lines.some((l) => l.kind === 'partyLost'))
  })
})
