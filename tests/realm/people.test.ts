/**
 * 백성 · 군량 · 닿는 때 (형 2026-10-19)
 *  - "골포 도읍에서 빼오는건지 몰랐는데 저런식으로 도읍을 default로 빼와도 되는거야?" — 개척의 보내는 고을 기본값은 도읍이 아니다 (도읍밖에 없으면 도읍)
 *  - "군량은 넉넉히랑 안듦 두개밖에 없는데 이거 기본수치로 주고 줄일수 있게" — 군량은 더 챙길 계절 수 · 옛 'full'/'light' 도 받는다
 *  - "그 턴이 다음턴인지 그다음인지 몰라가지고 헷갈림" — 닿는 계절 말
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { arriveWhen } from '../../src/realm/data/prose.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { settleSource, settleTargets } from '../../src/realm/economy.ts'
import { advance, neighbors, rationCost, rationExtra, rationFor } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm } from '../../src/realm/types.ts'

/** 우리 도읍과 맞닿은 빈땅 하나와, 그 빈땅에 맞닿은 다른 고을 하나 (도읍 아닌) */
function wildBy(r: Realm): { wild: string; other: string | null } {
  const cap = r.factions['us']!.capital
  const caps = new Set(Object.values(r.factions).map((f) => f.capital))
  for (const w of neighbors(r, cap)) {
    const n = r.nodes[w]!
    if (n.kind !== 'wild' || n.owner !== null) continue
    const other = neighbors(r, w).find((x) => !caps.has(x) && r.nodes[x]!.kind !== 'sodo' && r.nodes[x]!.kind !== 'wild') ?? null
    return { wild: w, other }
  }
  throw new Error('도읍 곁 빈땅이 없다')
}

describe('개척의 보내는 고을', () => {
  it('도읍밖에 없으면 도읍', () => {
    const r = byeonhanMini(1)
    const { wild } = wildBy(r)
    const froms = settleTargets(r, 'us').filter((t) => t.to === wild).map((t) => t.from)
    if (froms.length === 1) assert.equal(settleSource(r, 'us', wild), r.factions['us']!.capital)
  })

  it('도읍이 아닌 고을이 맞닿아 있으면 그쪽이 기본 — 도읍이 더 붐벼도', () => {
    const r = byeonhanMini(1)
    const caps = new Set(Object.values(r.factions).map((f) => f.capital))
    // 도읍 하나와 도읍 아닌 고을 하나에 함께 맞닿은 빈땅
    let pick: { w: string; cap: string; other: string } | null = null
    for (const w of Object.keys(r.nodes).sort()) {
      if (r.nodes[w]!.kind !== 'wild' || r.nodes[w]!.owner !== null) continue
      const nb = neighbors(r, w).filter((x) => r.nodes[x]!.kind !== 'sodo' && r.nodes[x]!.kind !== 'wild')
      const cap = nb.find((x) => caps.has(x))
      const other = nb.find((x) => !caps.has(x))
      if (cap !== undefined && other !== undefined) { pick = { w, cap, other }; break }
    }
    assert.ok(pick !== null, '도읍과 다른 고을에 함께 맞닿은 빈땅이 있어야 한다')
    for (const x of [pick.cap, pick.other]) r.nodes[x]!.owner = 'us'
    r.nodes[pick.other]!.hh = 300
    r.nodes[pick.cap]!.hh = 9000
    assert.ok(settleTargets(r, 'us').some((t) => t.to === pick!.w && t.from === pick!.cap))
    assert.equal(settleSource(r, 'us', pick.w), pick.other)
  })
})

describe('군량 — 더 챙길 계절 수', () => {
  it("옛 'light' 는 0, 'full' 은 기본 · 수는 상한까지", () => {
    assert.equal(rationExtra('light'), 0)
    assert.equal(rationExtra('full'), P.realm.rationReserve)
    assert.equal(rationExtra(99), P.realm.rationMaxExtra)
    assert.equal(rationExtra(undefined), undefined)
  })

  it('곡식은 더 챙길수록 늘고 0 이면 안 든다 · 기본값은 옛 넉넉히와 같다', () => {
    const r = byeonhanMini(1)
    const a = r.armies['a-us']!
    assert.equal(rationCost(r, a, 2, 0), 0)
    assert.ok(rationCost(r, a, 2, 1) < rationCost(r, a, 2, 2))
    assert.equal(rationCost(r, a, 2), rationCost(r, a, 2, P.realm.rationReserve))
  })

  it('곡식이 모자라면 대는 만큼만', () => {
    const r = byeonhanMini(1)
    const a = r.armies['a-us']!
    r.stock['us']!.grain = rationCost(r, a, 1, 1)
    assert.equal(rationFor(r, a, 3, 1), 1)
    r.stock['us']!.grain = 0
    assert.equal(rationFor(r, a, 3, 1), 0)
  })

  it('행군에 실린다 — 군량 = 길 계절 + 더 챙긴 계절 (길에서 한 계절 먹는다)', () => {
    const r = byeonhanMini(3)
    r.stock['us']!.grain = 100000
    // 두 계절 걸리는 고갯길 — 한 계절 지나도 아직 길 위다
    const ed = Object.values(r.edges).find((e) => e.kind === 'pass')!
    r.armies['a-us']!.at = ed.a
    const two = advance(r, [{ kind: 'march', army: 'a-us', edge: ed.id, ambush: false, ration: 2 }]).next
    const zero = advance(r, [{ kind: 'march', army: 'a-us', edge: ed.id, ambush: false, ration: 0 }]).next
    assert.ok(two.armies['a-us']!.march !== null)
    assert.equal((two.armies['a-us']!.food ?? 0) - (zero.armies['a-us']!.food ?? 0), 2)
    assert.ok(two.stock['us']!.grain < zero.stock['us']!.grain)
  })
})

describe('닿는 계절 말', () => {
  it('한 계절이면 다음 계절, 둘이면 두 계절 뒤 — 그때의 해·철까지', () => {
    assert.equal(arriveWhen(0, 1), '다음 계절(1년 여름)에 닿는다')
    assert.equal(arriveWhen(0, 2), '두 계절 뒤(1년 가을)에 닿는다')
    assert.equal(arriveWhen(3, 1, true), '다음 계절(2년 봄)')
  })
})
