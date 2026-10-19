/**
 * 나라 살림 · 나라 고르기 · 이김·짐 · 행군 목격 (docs/realm/FLOW.md §1~3 · §7)
 *
 *  - 여섯 나라 모두 판을 연다 — 플레이어는 하나, 창고·가호가 있다
 *  - 가을 수확은 봄에 심은 가호가 정한다: 봄 징병은 그해 수확을 깎고, 여름 징병은 안 깎는다
 *  - 군대는 곡식을 먹는다 (겨울 ×1.5) · 바닥나면 굶는다 (사기 −, 가호 −)
 *  - 징병·해산은 (가호 + 군사)를 지킨다 · 한도를 넘으면 아무 일도 없다
 *  - 국읍 셋을 쥐면 이기고, 제 국읍을 잃으면 진다
 *  - 우리 고을에 맞닿은 길 위의 남의 군대는 보인다
 *  - 징병·해산을 섞어 아무렇게나 돌려도 불변식이 선다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { roll } from '../../src/core/rng.ts'
import { NATIONS } from '../../src/realm/data/nations.ts'
import { NATION_IDS, byeonhanMini, startRealm } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { draftCost, draftLimit, goodOf, hhOf, menOf, militiaMen, nodeYield, upkeepOf } from '../../src/realm/economy.ts'
import { harvestMul } from '../../src/realm/heroes.ts'
import { advance, otherEnd, planned, seenMarches } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, Realm, ReportLine } from '../../src/realm/types.ts'

const harvestOf = (lines: readonly ReportLine[], f: string): number =>
  lines.filter((l): l is Extract<ReportLine, { kind: 'harvest' }> => l.kind === 'harvest' && l.faction === f).reduce((s, l) => s + l.grain, 0)

describe('나라 고르기', () => {
  it('여섯 나라 모두 판을 연다 — 플레이어는 고른 나라 하나', () => {
    assert.deepEqual([...NATION_IDS].sort(), NATIONS.map((n) => n.id).sort())
    for (const id of NATION_IDS) {
      const r = startRealm(7, id)
      assert.equal(r.player, id)
      const players = Object.values(r.factions).filter((f) => f.mind === 'player').map((f) => f.id)
      assert.deepEqual(players, [id])
      assert.equal(r.outcome, null)
      assert.deepEqual(r.relations, {})
      for (const f of Object.keys(r.factions)) assert.ok(r.stock[f] !== undefined && r.stock[f]!.grain > 0, `${f} 창고`)
      for (const n of Object.values(r.nodes)) {
        assert.ok(n.hh >= 0)
        assert.equal(n.sown, n.hh)
      }
      for (const a of Object.values(r.armies)) assert.ok(r.factions[a.faction] !== undefined)
      // 한 판을 돌려도 깨지지 않는다
      advance(r, [])
    }
  })

  it('byeonhanMini 는 갯마을 판이다 · 모르는 나라는 갯마을로', () => {
    assert.deepEqual(byeonhanMini(3), startRealm(3, 'us'))
    assert.equal(startRealm(3, 'nowhere').player, 'us')
  })

  it('장정은 가호에 비례하고 국읍·산성은 더 두껍다', () => {
    const r = byeonhanMini(1)
    assert.equal(militiaMen(r, 'our-north'), Math.round(r.nodes['our-north']!.hh * P.realm.militiaPerHH))
    assert.equal(militiaMen(r, 'our-cap'), Math.round(r.nodes['our-cap']!.hh * P.realm.militiaPerHH * P.realm.militiaCapitalMul))
    assert.equal(militiaMen(r, 'anya-fort'), Math.round(r.nodes['anya-fort']!.hh * P.realm.militiaPerHH * P.realm.militiaFortMul))
    assert.equal(militiaMen(r, 'sodo'), 0)
  })
})

describe('한 해의 살림', () => {
  /** AI 없이 빈 명령으로 계절을 넘긴다 — 살림만 본다 */
  const pass = (r: Realm, orders: Order[] = []): { next: Realm; lines: readonly ReportLine[] } => {
    const { next, report } = advance(r, orders)
    return { next, lines: report.lines }
  }

  it('가을 수확 = 봄에 심은 가호 × 군주·맡은 장수의 배수 × harvestPerHH', () => {
    let r = byeonhanMini(1)
    r = pass(r).next // 봄
    r = pass(r).next // 여름
    const sown = Object.values(r.nodes).filter((n) => n.owner === 'us').reduce((s, n) => s + n.sown * harvestMul(r, n.id), 0)
    const { lines } = pass(r) // 가을
    assert.equal(harvestOf(lines, 'us'), Math.round(sown * P.realm.harvestPerHH))
    // 가을이 아니면 거두지 않는다
    assert.equal(harvestOf(pass(byeonhanMini(1)).lines, 'us'), 0)
  })

  it('봄 징병은 그해 수확을 깎고, 여름 징병은 안 깎는다', () => {
    const draft: Order = { kind: 'draft', faction: 'us', node: 'our-cap', unit: 'spear', n: 20 }
    const run = (springDraft: boolean, summerDraft: boolean): number => {
      let r = byeonhanMini(1)
      r = pass(r, springDraft ? [draft] : []).next
      r = pass(r, summerDraft ? [draft] : []).next
      return harvestOf(pass(r).lines, 'us')
    }
    const none = run(false, false)
    assert.ok(run(true, false) < none, '봄 징병')
    assert.equal(run(false, true), none, '여름 징병')
  })

  it('군대는 곡식을 먹는다 — 겨울엔 winterRation 배', () => {
    const r = byeonhanMini(1)
    const g0 = r.stock['us']!.grain
    const { next } = pass(r)
    // 바닷가 고을은 물고기를 낸다 (nodeYield) — 봄에 든 것을 더하고 군량을 뺀다
    const fish = Object.values(r.nodes).filter((n) => n.owner === 'us').reduce((s, n) => s + goodOf(nodeYield(r, n.id, 'spring'), 'grain'), 0)
    assert.equal(next.stock['us']!.grain, g0 + fish - upkeepOf(r, 'us', false))
    assert.equal(upkeepOf(r, 'us', true), Math.ceil(menOf(r, 'us') * P.realm.rationPerSoldier * P.realm.winterRation))
  })

  it('곡식이 바닥나면 굶는다 — 사기가 떨어지고 가호가 준다', () => {
    const r = planned(byeonhanMini(1), [])
    r.stock['us']!.grain = 0
    const hh0 = hhOf(r, 'us')
    const { next, lines } = pass(r)
    assert.ok(lines.some((l) => l.kind === 'hunger' && l.faction === 'us'))
    assert.ok(Math.abs(next.armies['a-us']!.morale - (1 - P.realm.hungerMorale)) < 1e-12)
    assert.ok(hhOf(next, 'us') < hh0)
    assert.equal(next.stock['us']!.grain, 0)
  })

  it('고을을 뺏기면 가호가 흩어진다', () => {
    const r = planned(byeonhanMini(1), [])
    r.season = 3
    r.armies['a-us']!.mix = { spear: 900, bow: 300 }
    const hh0 = r.nodes['guya-cap']!.hh
    r.armies['a-us']!.at = 'wild-dolseom'
    const { next, report } = advance(r, [{ kind: 'march', army: 'a-us', edge: 'e35', ambush: false }])
    if (next.nodes['guya-cap']!.owner === 'us') {
      assert.ok(report.lines.some((l) => l.kind === 'take'))
      // 뺏길 때 hhLossOnTake, 그 뒤 계절의 살림에서 ± 조금
      assert.ok(next.nodes['guya-cap']!.hh <= Math.round(hh0 * (1 - P.realm.hhLossOnTake) * (1 + P.realm.hhGrowth)) + 1)
    }
  })
})

describe('징병 · 해산', () => {
  it('징병은 가호의 일손을 군사로 옮기고 채비 곡식을 쓴다 — 군사 하나에 집 draftHHPerMan 몫', () => {
    const r = byeonhanMini(1)
    const n = 20
    const p = planned(r, [{ kind: 'draft', faction: 'us', node: 'our-cap', unit: 'bow', n }])
    // 집이 통째로 사라지지 않는다 (형: "5명으로 무슨 고을을 어떻게 지켜") — 일손 몫만 빠진다
    assert.equal(hhOf(p, 'us'), hhOf(r, 'us') - Math.round(n * P.realm.draftHHPerMan))
    assert.equal(menOf(p, 'us'), menOf(r, 'us') + n)
    assert.equal(p.stock['us']!.grain, r.stock['us']!.grain - draftCost(n).grain)
    assert.equal(p.armies['a-us']!.mix.bow, (r.armies['a-us']!.mix.bow ?? 0) + n, '쉬는 군대에 든다')
  })

  it('쉬는 군대가 없으면 새 군대가 선다 · 그 판에서 바로 떠날 수 있다', () => {
    const r = byeonhanMini(1)
    const p = planned(r, [{ kind: 'draft', faction: 'us', node: 'our-north', unit: 'spear', n: 12 }])
    const fresh = Object.values(p.armies).find((a) => a.faction === 'us' && a.at === 'our-north')
    assert.ok(fresh !== undefined)
    assert.equal(fresh.mix.spear, 12)
    assert.equal(fresh.equip, r.factions['us']!.equip)
  })

  it('한도를 넘거나 남의 땅·소도·없는 병종이면 아무 일도 없다', () => {
    const r = byeonhanMini(1)
    const lim = draftLimit(r, 'us', 'our-cap')
    assert.ok(lim > 0)
    const bad: Order[] = [
      { kind: 'draft', faction: 'us', node: 'our-cap', unit: 'spear', n: lim + 1 },
      { kind: 'draft', faction: 'us', node: 'guya-cap', unit: 'spear', n: 10 },
      { kind: 'draft', faction: 'us', node: 'sodo', unit: 'spear', n: 10 },
      { kind: 'draft', faction: 'us', node: 'our-cap', unit: 'horse', n: 10 },
      { kind: 'draft', faction: 'us', node: 'our-cap', unit: 'boat', n: 10 }, // 국읍은 포구가 아니다
      { kind: 'draft', faction: 'us', node: 'our-cap', unit: 'spear', n: 2.5 },
    ]
    for (const o of bad) assert.deepEqual(planned(r, [o]), planned(r, []), JSON.stringify(o))
  })

  it('해산하면 사람이 그 고을 가호로 돌아간다', () => {
    const r = byeonhanMini(1)
    const p = planned(r, [{ kind: 'disband', army: 'a-us' }])
    assert.equal(p.armies['a-us'], undefined)
    assert.equal(p.nodes['our-cap']!.hh, r.nodes['our-cap']!.hh + Math.round(menOf(r, 'us') * P.realm.draftHHPerMan))
    // 남의 땅에서는 해산하지 못한다
    const away = planned(r, [])
    away.armies['a-us']!.at = 'sodo'
    assert.ok(planned(away, [{ kind: 'disband', army: 'a-us' }]).armies['a-us'] !== undefined)
  })
})

describe('이김 · 짐', () => {
  it('국읍 셋을 쥐면 이긴다 — 한 번 정해지면 그대로', () => {
    const r = planned(byeonhanMini(1), [])
    r.nodes['guya-cap']!.owner = 'us'
    r.nodes['miri-cap']!.owner = 'us'
    const { next, report } = advance(r, [])
    assert.deepEqual(next.outcome, { kind: 'win', season: r.season })
    assert.ok(report.lines.some((l) => l.kind === 'end' && l.outcome === 'win'))
    next.nodes['our-cap']!.owner = 'guya'
    assert.equal(advance(next, []).next.outcome?.kind, 'win')
  })

  it('제 국읍을 잃으면 진다 · 다른 나라를 고른 판도 같다', () => {
    const r = planned(startRealm(1, 'miri'), [])
    r.nodes['miri-cap']!.owner = 'guya'
    const { next, report } = advance(r, [])
    assert.equal(next.outcome?.kind, 'lose')
    assert.ok(report.lines.some((l) => l.kind === 'end' && l.outcome === 'lose' && l.faction === 'miri'))
  })
})

describe('행군은 보인다', () => {
  it('우리 고을에 맞닿은 길 위의 남의 군대만 보인다', () => {
    const r = planned(byeonhanMini(1), [])
    r.armies['a-guya-2']!.at = 'guya-vil'
    r.armies['a-guya-1']!.at = 'guya-vil'
    // 봉황 → 갈대울 (갯벌 e09, 두 계절 — 우리 고을에 맞닿는다) · 봉황 → 철산 (고갯길 e11, 두 계절 — 안 맞닿는다)
    const { next, report } = advance(r, [
      { kind: 'march', army: 'a-guya-2', edge: 'e09', ambush: false },
      { kind: 'march', army: 'a-guya-1', edge: 'e11', ambush: false },
    ])
    assert.ok(next.armies['a-guya-2']!.march !== null && next.armies['a-guya-1']!.march !== null)
    assert.deepEqual(seenMarches(next, 'us').map((a) => a.id), ['a-guya-2'])
    const sighted = report.lines.filter((l) => l.kind === 'sighted')
    assert.deepEqual(sighted, [{ kind: 'sighted', faction: 'guya', army: 'a-guya-2', from: 'guya-vil', to: 'our-east' }])
  })
})

/** 징병·해산을 섞어 명령을 지어내는 봇 */
function messy(r: Realm, tag: string): Order[] {
  const out: Order[] = []
  for (const f of Object.keys(r.factions).sort()) {
    for (const n of Object.values(r.nodes).filter((x) => x.owner === f).sort((x, y) => (x.id < y.id ? -1 : 1))) {
      const d = roll(r.seed, r.season, `${tag}:d:${n.id}`)
      if (d < 0.3) out.push({ kind: 'draft', faction: f, node: n.id, unit: d < 0.1 ? 'bow' : 'spear', n: 1 + Math.floor(draftLimit(r, f, n.id) * roll(r.seed, r.season, `${tag}:n:${n.id}`)) })
    }
  }
  for (const a of Object.values(r.armies).filter((x) => x.march === null).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    const d = roll(r.seed, r.season, `${tag}:a:${a.id}`)
    if (d < 0.05) out.push({ kind: 'disband', army: a.id })
    else if (d < 0.5) {
      const edges = Object.values(r.edges).filter((e) => otherEnd(e, a.at) !== null).sort((x, y) => (x.id < y.id ? -1 : 1))
      const ed = edges[Math.floor(roll(r.seed, r.season, `${tag}:e:${a.id}`) * edges.length)]
      if (ed !== undefined) out.push({ kind: 'march', army: a.id, edge: ed.id, ambush: d < 0.25 })
    }
  }
  return out
}

describe('징병·해산을 섞어 아무렇게나 돌려도', () => {
  it('같은 시드면 같은 판 · 창고·가호는 음수가 안 된다 · 군대 상한 · 한 고을에 두 나라가 머물지 않는다 (60판 × 40계절)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const as = NATION_IDS[seed % NATION_IDS.length]!
      let r = startRealm(seed, as)
      let again = startRealm(seed, as)
      for (let s = 0; s < 40; s++) {
        r = advance(r, messy(r, 'eco')).next
        again = advance(again, messy(again, 'eco')).next
        for (const f of Object.keys(r.factions)) {
          assert.ok(r.stock[f]!.grain >= 0 && r.stock[f]!.iron >= 0, `seed ${seed} ${f} 창고`)
          assert.ok(Object.values(r.armies).filter((a) => a.faction === f).length <= P.realm.armyMax)
        }
        for (const n of Object.values(r.nodes)) {
          assert.ok(n.hh >= 0 && Number.isInteger(n.hh), `seed ${seed} ${n.id} 가호 ${n.hh}`)
          const owners = new Set(Object.values(r.armies).filter((a) => a.march === null && a.at === n.id).map((a) => a.faction))
          if (n.kind !== 'sodo') assert.ok(owners.size <= 1, `seed ${seed} s${s} ${n.id} 에 두 나라`)
        }
      }
      assert.deepEqual(r, again)
    }
  })
})
