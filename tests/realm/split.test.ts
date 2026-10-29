/**
 * 나누고 모은다 · 협공 · 초반 유예 (docs/realm/SYSTEMS.md §4-5 · ai.ts bar)
 *
 *  - 나누기·모으기는 사람 수를 지킨다 · 규칙에 안 맞으면 아무 일도 없다
 *  - 떼어 낸 별동대는 그 계절에 바로 떠난다 · planned() 는 advance 의 1단계와 같다
 *  - 같은 계절에 닿은 한 나라의 군대들은 한 판으로 싸우고, 두 길이면 ×pincer
 *  - 나누기·모으기를 섞어 아무렇게나 돌려도 불변식이 선다
 *  - 판 초반에 이웃은 플레이어 땅에 들어오지 않는다 (먼저 친 나라는 예외)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { roll } from '../../src/core/rng.ts'
import { aiOrders as aiOrdersOf, decide, spared } from '../../src/realm/ai.ts'
import { headcount } from '../../src/realm/battle.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { PEOPLE_SCALE as S } from '../../src/realm/migrate.ts'
import { advance, forceOf, newArmyId, otherEnd, planned } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Army, Order, Realm, ReportLine } from '../../src/realm/types.ts'

const men = (r: Realm, id: string): number => headcount(forceOf(r, r.armies[id]!))
const factionMen = (r: Realm, f: string): number =>
  Object.values(r.armies).filter((a) => a.faction === f).reduce((s, a) => s + headcount(forceOf(r, a)), 0)
const battles = (lines: readonly ReportLine[]) => lines.filter((l): l is Extract<ReportLine, { kind: 'battle' }> => l.kind === 'battle')

describe('나누기 · 모으기', () => {
  it('나누면 사람 수가 그대로고, 장수는 고른 쪽으로 간다', () => {
    const r = byeonhanMini(1)
    const id = newArmyId(r, 'us')
    const { next, report } = advance(r, [{ kind: 'split', army: 'a-us', id, take: { spear: 20 * S, bow: 10 * S }, hero: true }])
    assert.equal(men(next, 'a-us'), 90 * S)
    assert.equal(men(next, id), 30 * S)
    assert.equal(next.armies[id]!.hero, 'chief')
    assert.equal(next.armies['a-us']!.hero, null)
    assert.equal(next.armies[id]!.equip, r.armies['a-us']!.equip)
    assert.ok(report.lines.some((l) => l.kind === 'split' && l.id === id))
  })

  it('규칙에 안 맞는 나누기는 아무 일도 없다', () => {
    const r = byeonhanMini(1)
    const id = newArmyId(r, 'us')
    const bad: Order[] = [
      { kind: 'split', army: 'a-us', id, take: { spear: P.realm.splitMin - 1 }, hero: false }, // 별동대가 너무 작다
      { kind: 'split', army: 'a-us', id, take: { spear: 80 * S, bow: 30 * S, shield: 5 * S }, hero: false }, // 본대가 너무 작다
      { kind: 'split', army: 'a-us', id, take: { spear: 80 * S + 1 }, hero: false }, // 없는 사람
      { kind: 'split', army: 'a-us', id, take: { spear: 12.5 }, hero: false }, // 사람은 쪼개지지 않는다
      { kind: 'split', army: 'a-us', id: 'a-guya-1', take: { spear: 20 * S }, hero: false }, // 이미 있는 이름
    ]
    for (const o of bad) {
      const { next } = advance(r, [o])
      assert.equal(Object.values(next.armies).filter((a) => a.faction === 'us').length, 1, JSON.stringify(o))
      assert.equal(men(next, 'a-us'), 120 * S)
    }
  })

  it(`군대는 나라마다 ${P.realm.armyMax}개까지`, () => {
    let r = planned(byeonhanMini(1), [])
    r.armies['a-us']!.mix = { spear: 400 * S }
    const orders: Order[] = []
    for (let i = 0; i < P.realm.armyMax + 3; i++) {
      const id = newArmyId(r, 'us')
      const o: Order = { kind: 'split', army: 'a-us', id, take: { spear: 20 * S }, hero: false }
      orders.push(o)
      r = planned(r, [o])
    }
    assert.equal(Object.values(r.armies).filter((a) => a.faction === 'us').length, P.realm.armyMax)
  })

  it('모으면 하나로 돌아오고 장수가 남는다 · 장수 둘은 안 모은다', () => {
    const r0 = byeonhanMini(1)
    const id = newArmyId(r0, 'us')
    const r1 = advance(r0, [{ kind: 'split', army: 'a-us', id, take: { spear: 20 * S, bow: 10 * S }, hero: true }]).next
    const r2 = advance(r1, [{ kind: 'merge', army: id, into: 'a-us' }]).next
    assert.equal(r2.armies[id], undefined)
    assert.equal(men(r2, 'a-us'), 120 * S)
    assert.equal(r2.armies['a-us']!.hero, 'chief')

    const g = planned(byeonhanMini(1), [])
    g.armies['a-guya-2']!.at = 'guya-cap'
    const after = advance(g, [{ kind: 'merge', army: 'a-guya-2', into: 'a-guya-1' }]).next
    assert.ok(after.armies['a-guya-2'] !== undefined)
  })

  it('장수를 빼낸 군대는 같은 계절에 합칠 수 있다 (형 10-26: "한 장수를 빼고 … 두 부대 합치기가 안 됨")', () => {
    const g = planned(byeonhanMini(1), [])
    g.armies['a-guya-2']!.at = 'guya-cap'
    const out = g.armies['a-guya-2']!.hero!
    const orders: Order[] = [{ kind: 'assign', hero: out, node: null }, { kind: 'merge', army: 'a-guya-2', into: 'a-guya-1' }]
    const after = advance(g, orders).next
    assert.equal(after.armies['a-guya-2'], undefined)
    assert.equal(after.armies['a-guya-1']!.hero, g.armies['a-guya-1']!.hero)
    assert.deepEqual(advance(g, orders).next.armies, after.armies) // 같은 판 같은 결과
  })

  it('떼어 낸 별동대는 그 계절에 바로 떠난다 · planned 는 advance 의 1단계와 같다', () => {
    const r = byeonhanMini(1)
    const id = newArmyId(r, 'us')
    const orders: Order[] = [
      { kind: 'split', army: 'a-us', id, take: { spear: 30 * S }, hero: false },
      { kind: 'march', army: id, edge: 'e01', ambush: false },
    ]
    const before = JSON.stringify(r)
    const p = planned(r, orders)
    assert.equal(JSON.stringify(r), before, 'planned 는 받은 판을 건드리지 않는다')
    assert.equal(men(p, id), 30 * S)
    const { next } = advance(r, orders)
    assert.equal(next.armies[id]!.at, 'our-north')
    assert.equal(next.armies['a-us']!.at, 'our-cap')
  })
})

describe('협공', () => {
  /** 겨울(언 강 — 도하 없음): 미리미동 여울목 읍락을 두 군대가 친다 */
  function setup(twoRoads: boolean): Realm {
    const r = planned(byeonhanMini(5), [])
    r.season = 3
    r.armies['a-us']!.at = 'our-east'
    r.armies['a-us-x'] = { ...structuredClone(r.armies['a-us']!), id: 'a-us-x', hero: null, at: twoRoads ? 'our-north' : 'our-east' }
    return r
  }
  const go = (r: Realm, twoRoads: boolean) =>
    advance(r, [
      { kind: 'march', army: 'a-us', edge: 'e08', ambush: false },
      { kind: 'march', army: 'a-us-x', edge: twoRoads ? 'e06' : 'e08', ambush: false },
    ])

  it('같은 계절에 닿은 군대들은 한 판으로 싸운다', () => {
    const { report } = go(setup(true), true)
    const bs = battles(report.lines)
    assert.equal(bs.length, 1)
    assert.equal(bs[0]!.attacker, 'a-us')
    assert.deepEqual(bs[0]!.allies, ['a-us-x'])
    assert.equal(bs[0]!.pincer, true)
  })

  it(`두 길로 들어오면 공격 전투력이 ×${P.realm.pincer}`, () => {
    const one = battles(go(setup(false), false).report.lines)[0]!
    const two = battles(go(setup(true), true).report.lines)[0]!
    assert.equal(one.pincer, false)
    // P = Fa²/(Fa²+Fd²) → Fa/Fd = √(P/(1−P)). 지키는 쪽이 같으니 비는 곧 Fa 의 비다
    const ratio = (p: number) => Math.sqrt(p / (1 - p))
    assert.ok(Math.abs(ratio(two.p) / ratio(one.p) - P.realm.pincer) < 1e-9, `${one.p} → ${two.p}`)
    assert.ok(two.p > one.p)
  })

  it('하나만 친 싸움은 allies 가 비고 협공이 아니다', () => {
    const r = setup(true)
    delete r.armies['a-us-x']
    const bs = battles(advance(r, [{ kind: 'march', army: 'a-us', edge: 'e08', ambush: false }]).report.lines)
    assert.equal(bs.length, 1)
    assert.deepEqual(bs[0]!.allies, [])
    assert.equal(bs[0]!.pincer, false)
  })
})

/** 나누기·모으기까지 섞어 명령을 지어내는 봇 */
function messyOrders(r: Realm, tag: string): Order[] {
  const out: Order[] = []
  let plan = r
  const idle = (): Army[] => Object.values(plan.armies).filter((a) => a.march === null).sort((x, y) => (x.id < y.id ? -1 : 1))
  for (const a of idle()) {
    const d = roll(r.seed, r.season, `${tag}:kind:${a.id}`)
    if (d < 0.25) {
      const k = Object.keys(a.mix)[0] as keyof Army['mix'] | undefined
      if (k === undefined) continue
      const o: Order = {
        kind: 'split', army: a.id, id: newArmyId(plan, a.faction),
        take: { [k]: Math.floor((a.mix[k] ?? 0) * roll(r.seed, r.season, `${tag}:n:${a.id}`)) }, hero: d < 0.1,
      }
      out.push(o)
      plan = planned(plan, [o])
    } else if (d < 0.4) {
      const mate = idle().find((b) => b.id !== a.id && b.faction === a.faction && b.at === a.at)
      if (mate === undefined) continue
      const o: Order = { kind: 'merge', army: a.id, into: mate.id }
      out.push(o)
      plan = planned(plan, [o])
    }
  }
  for (const a of idle()) {
    if (roll(r.seed, r.season, `${tag}:go:${a.id}`) < 0.4) continue
    const edges = Object.values(plan.edges).filter((e) => otherEnd(e, a.at) !== null).sort((x, y) => (x.id < y.id ? -1 : 1))
    const ed = edges[Math.floor(roll(r.seed, r.season, `${tag}:edge:${a.id}`) * edges.length)]
    if (ed !== undefined) out.push({ kind: 'march', army: a.id, edge: ed.id, ambush: roll(r.seed, r.season, `${tag}:amb:${a.id}`) < 0.5 })
  }
  return out
}

describe('나누기를 섞어 아무렇게나 돌려도', () => {
  it('같은 시드면 같은 판 · 군대 상한 · 사람은 늘지 않는다 · 한 고을에 두 나라가 머물지 않는다 (100판 × 40계절)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      let r = byeonhanMini(seed)
      let again = byeonhanMini(seed)
      const start: Record<string, number> = {}
      for (const f of Object.keys(r.factions)) start[f] = factionMen(r, f)
      for (let s = 0; s < 40; s++) {
        const o = messyOrders(r, 'mess')
        const prevMen: Record<string, number> = {}
        for (const f of Object.keys(r.factions)) prevMen[f] = factionMen(r, f)
        const adv = advance(r, o)
        r = adv.next
        again = advance(again, messyOrders(again, 'mess')).next
        // 항복한 군사가 이긴 군대에 드는 것만은 늘 수 있다 (season.takeYielded · 형 10-29)
        const joined: Record<string, number> = {}
        for (const l of adv.report.lines) if (l.kind === 'battle' && l.yielded !== undefined) { const w = l.yielded.side === 'a' ? l.atkFaction : l.defender; if (w !== undefined) joined[w] = (joined[w] ?? 0) + l.yielded.join }
        for (const f of Object.keys(r.factions)) {
          assert.ok(Object.values(r.armies).filter((a) => a.faction === f).length <= P.realm.armyMax, `seed ${seed} ${f} 군대 수`)
          assert.ok(factionMen(r, f) <= prevMen[f]! + (joined[f] ?? 0), `seed ${seed} s${s} ${f} 사람이 늘었다`)
        }
        for (const a of Object.values(r.armies)) {
          for (const v of Object.values(a.mix)) assert.ok((v ?? 0) >= 0)
          if (a.march !== null) continue
          const others = Object.values(r.armies).filter((b) => b.march === null && b.at === a.at && b.faction !== a.faction)
          assert.ok(others.length === 0 || r.nodes[a.at]!.kind === 'sodo', `seed ${seed} s${s} ${a.at} 에 두 나라`)
        }
        const heroes = Object.values(r.armies).map((a) => a.hero).filter((h) => h !== null)
        assert.equal(new Set(heroes).size, heroes.length, '장수 하나가 두 군대를 이끈다')
      }
      assert.deepEqual(r, again)
    }
  })
})

describe('봇 계획가 — 나누어 보낸다', () => {
  it('국읍을 비우지 않고 별동대를 떼어 그 계절에 보낸다 · 낸 나누기는 판이 받아들인다 (50판 × 24계절)', () => {
    let splits = 0
    for (let seed = 1; seed <= 50; seed++) {
      let r = byeonhanMini(seed)
      for (let s = 0; s < 24; s++) {
        const mine = decide(r, 'us', 'planner')
        const { next } = advance(r, [...mine, ...aiOrdersOf(r)])
        for (const o of mine) {
          if (o.kind !== 'split') continue
          splits++
          assert.ok(planned(r, mine).armies[o.id] !== undefined, `seed ${seed} s${s} 받아들여지지 않은 나누기`)
          const leaving = mine.some((m) => m.kind === 'march' && m.army === o.id)
          assert.ok(leaving, '떼어 낸 별동대가 떠나지 않았다')
        }
        r = next
      }
    }
    assert.ok(splits > 0, '한 번도 나누지 않았다')
  })
})

describe('초반 유예 — 작은 나라는 아직 눈에 안 띈다', () => {
  it(`첫 ${P.realm.aiGrace}계절은 플레이어 땅을 건드리지 않는다 · 남끼리는 유예가 없다 · 유예가 끝나면 풀린다`, () => {
    const r = byeonhanMini(1)
    assert.equal(spared(r, 'guya', 'our-cap'), true)
    assert.equal(spared(r, 'guya', 'anya-cap'), false)
    r.season = P.realm.aiGrace
    assert.equal(spared(r, 'guya', 'our-cap'), false)
  })

  it('먼저 친 나라에는 유예가 없다 — 빈 땅을 걸어 들어가도 친 것이다', () => {
    const r = planned(byeonhanMini(1), [])
    r.season = 3 // 겨울 — 언 강
    r.armies['a-miri']!.at = 'miri-cap' // 여울목 읍락을 비운다
    r.armies['a-us']!.at = 'wild-dolseom'
    const { next } = advance(r, [{ kind: 'march', army: 'a-us', edge: 'e35', ambush: false }])
    assert.deepEqual(next.provoked, ['guya'])
    assert.equal(spared(next, 'guya', 'our-cap'), false)
    assert.equal(spared(next, 'miri', 'our-cap'), true)
    const r2 = planned(byeonhanMini(1), [])
    r2.armies['a-miri']!.at = 'miri-cap'
    r2.armies['a-us']!.at = 'our-east'
    // 군대가 없어도 장정이 지킨다 (SYSTEMS §4-6) — 싸움이 나고, 친 것이다
    const { next: took, report } = advance(r2, [{ kind: 'march', army: 'a-us', edge: 'e08', ambush: false }])
    assert.equal(battles(report.lines).length, 1)
    assert.deepEqual(took.provoked, ['miri'])
  })

  it('옛 저장(provoked 없음)도 돈다', () => {
    const r = planned(byeonhanMini(1), [])
    delete r.provoked
    assert.equal(spared(r, 'guya', 'our-cap'), true)
    r.armies['a-us']!.at = 'wild-dolseom'
    advance(r, [{ kind: 'march', army: 'a-us', edge: 'e35', ambush: false }])
  })

  it('첫 계절의 탐욕 이웃은 모르는 우리 땅이라도 덤비지 않는다', () => {
    const r = byeonhanMini(1)
    const ours = new Set(Object.values(r.nodes).filter((n) => n.owner === 'us').map((n) => n.id))
    for (const f of ['guya', 'goja', 'dokro']) {
      const orders = decide(r, f, 'greedy')
      const p = planned(r, orders) // 별동대는 같은 명령 안에서 나뉜다
      for (const o of orders) {
        if (o.kind !== 'march') continue
        const a = p.armies[o.army]!
        assert.ok(!ours.has(otherEnd(r.edges[o.edge]!, a.at)!), `${f} 가 첫 계절에 우리 땅을 친다`)
      }
    }
  })
})
