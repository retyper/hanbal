/**
 * 이주 — 집 자동 분배와 억지 이주 (형: "집 분배하는거 자동으로 분배하기 있었으면 좋겠음. 그게 디폴트이고
 * 자동안하면 본인이 직접 이주시키기 · 전략적으로 전방에 강제이주시키거나 수도에 집중시키는등", 2026-10-19)
 *
 *  - 자동 분배(기본 켜짐): 붐비는 고을에서 길로 맞닿은 한산한 제 고을로 · 같은 판이면 같은 흐름
 *  - 적이 오고 있는 고을로는 안 보낸다 · 끄면 저절로 안 옮긴다
 *  - 억지 이주: 제 땅으로 이어진 제 고을로 · 곡식이 든다 · 두 고을은 한동안 집이 안 는다 · 한도를 넘으면 아무 일도 없다
 *  - 붐비는 고을은 집이 덜 는다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import { autoFlows, crowdOf, hhGrowth, homeRoom, migrateCost, migrateLimit, migratePath } from '../../src/realm/economy.ts'
import { advance, planned } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm } from '../../src/realm/types.ts'

/** 길로 맞닿은 두 제 고을이 있는 나라 하나 — (나라, 고을 a, 고을 b) */
function pairOf(r: Realm): [string, string, string] {
  for (const id of Object.keys(r.edges).sort()) {
    const ed = r.edges[id]!
    const a = r.nodes[ed.a]!
    const b = r.nodes[ed.b]!
    if (a.owner !== null && a.owner === b.owner && a.kind !== 'sodo' && b.kind !== 'sodo' && a.kind !== 'wild' && b.kind !== 'wild') return [a.owner, a.id, b.id]
  }
  throw new Error('맞닿은 제 고을 짝이 없다')
}

/** a 를 붐비게 · b 를 한산하게 */
function crowd(r: Realm, a: string, b: string): void {
  r.nodes[a]!.hh = Math.round(homeRoom(r.nodes[a]!) * 1.6)
  r.nodes[b]!.hh = Math.round(homeRoom(r.nodes[b]!) * 0.3)
}

describe('이주', () => {
  it('자동 분배 — 붐비는 고을에서 맞닿은 한산한 제 고을로 · 결정론', () => {
    const r = byeonhanMini(3)
    const [f, a, b] = pairOf(r)
    crowd(r, a, b)
    const fl = autoFlows(r, f)
    const one = fl.find((x) => x.from === a)
    assert.ok(one !== undefined && one.to === b && one.n >= 1, JSON.stringify(fl))
    assert.ok(one.n <= Math.ceil(r.nodes[a]!.hh * P.realm.migrateAutoShare))
    assert.deepEqual(autoFlows(structuredClone(r), f), fl)
    // 계절을 넘기면 실제로 옮긴다 (보고 줄이 남는다)
    const res = advance(r, [])
    assert.ok(res.report.lines.some((l) => l.kind === 'migrate' && l.auto === true && l.faction === f && l.from === a && l.to === b))
  })

  it('적이 오고 있는 고을로는 안 보낸다', () => {
    const r = byeonhanMini(3)
    const [f, a, b] = pairOf(r)
    crowd(r, a, b)
    const foe = Object.values(r.armies).find((x) => x.faction !== f)!
    foe.march = { from: foe.at, to: b, edge: Object.keys(r.edges)[0]!, left: 2, ambush: false }
    assert.ok(!autoFlows(r, f).some((x) => x.to === b))
  })

  it('자동을 끄면 저절로 안 옮긴다 — 켜고 끄기는 명령', () => {
    const r = byeonhanMini(3)
    const [f, a, b] = pairOf(r)
    crowd(r, a, b)
    const off = planned(r, [{ kind: 'migrateAuto', faction: f, on: false }])
    assert.equal(off.factions[f]!.migrateOff, true)
    assert.deepEqual(autoFlows(off, f), [])
    const res = advance(r, [{ kind: 'migrateAuto', faction: f, on: false }])
    assert.ok(!res.report.lines.some((l) => l.kind === 'migrate' && l.faction === f))
    const on = planned(res.next, [{ kind: 'migrateAuto', faction: f, on: true }])
    assert.equal(on.factions[f]!.migrateOff, undefined)
  })

  it('억지 이주 — 곡식이 들고 두 고을은 한동안 집이 안 는다', () => {
    const r = byeonhanMini(3)
    const [f, a, b] = pairOf(r)
    const lim = migrateLimit(r, f, a, b)
    assert.ok(lim > 0)
    const n = Math.min(lim, 40)
    const ha = r.nodes[a]!.hh
    const hb = r.nodes[b]!.hh
    const g0 = r.stock[f]!.grain
    const p = planned(r, [{ kind: 'migrate', faction: f, from: a, to: b, n }])
    assert.equal(p.nodes[a]!.hh, ha - n)
    assert.equal(p.nodes[b]!.hh, hb + n)
    assert.equal(p.stock[f]!.grain, g0 - migrateCost(n).grain)
    assert.ok(hhGrowth(p, a).why.includes('uprooted') && hhGrowth(p, b).why.includes('uprooted'))
    // 한도를 넘으면 아무 일도 없다
    const over = planned(r, [{ kind: 'migrate', faction: f, from: a, to: b, n: lim + 1 }])
    assert.equal(over.nodes[a]!.hh, ha)
    // 남의 고을로는 못 옮긴다
    const other = Object.values(r.nodes).find((x) => x.owner !== null && x.owner !== f && x.kind !== 'sodo')!
    assert.equal(migrateLimit(r, f, a, other.id), 0)
  })

  it('붐비는 고을은 집이 덜 는다', () => {
    const r = byeonhanMini(3)
    const [, a] = pairOf(r)
    const n = r.nodes[a]!
    n.hh = Math.round(homeRoom(n) * 0.9)
    const calm = hhGrowth(r, a).per / n.hh
    n.hh = Math.round(homeRoom(n) * 1.5)
    assert.ok(crowdOf(n) > 1)
    const g = hhGrowth(r, a)
    assert.ok(g.why.includes('crowded'))
    assert.ok(g.per / n.hh < calm)
  })
  it('억지 이주 — 한 계절 몫은 나눠 눌러도 넘지 않는다 · 억지로 옮긴 고을은 저절로 다시 안 건드린다 (형: "2개씩 계속 쌓임")', () => {
    const r = byeonhanMini(3)
    const [f, a, b] = pairOf(r)
    r.stock[f]!.grain = 100000
    const start = r.nodes[a]!.hh
    const max = migrateLimit(r, f, a, b)
    let p = planned(r, [{ kind: 'migrate', faction: f, from: a, to: b, n: max }])
    assert.equal(p.nodes[a]!.hh, start - max)
    assert.equal(migrateLimit(p, f, a, b), 0, '다 썼으면 더 못 보낸다')
    p = planned(r, [{ kind: 'migrate', faction: f, from: a, to: b, n: max }, { kind: 'migrate', faction: f, from: a, to: b, n: 2 }])
    assert.equal(p.nodes[a]!.hh, start - max, '두 번째는 아무 일도 없다')
    assert.deepEqual(autoFlows(p, f).filter((x) => x.from === a || x.to === a), [])
  })

  it('소도는 지나갈 수 있다 — 가지산 소도로만 이어진 곰골을 쥐면 사로 도읍에서 집을 옮긴다 (머물 곳으로는 안 된다)', () => {
    const r = startYeongnam(3, 'saro')
    r.nodes['y-w-gomgol']!.owner = 'saro'
    r.season = 0 // 봄 — 숲길이 열려 있다
    assert.deepEqual(migratePath(r, 'saro', 'y-saro-cap', 'y-w-gomgol'), ['y-saro-cap', 'y-sodo-east', 'y-w-gomgol'])
    assert.ok(migrateLimit(r, 'saro', 'y-saro-cap', 'y-w-gomgol') > 0)
    assert.equal(migratePath(r, 'saro', 'y-saro-cap', 'y-sodo-east'), null)
  })
})
