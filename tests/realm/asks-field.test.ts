/**
 * 남의 나라가 거는 청 · 기습 낌새와 경계 강화 · 들판 싸움 (형, 2026-10-18:
 * "적국에서 기습오거나 기습에 대비하거나 우리가 경계를 강화하거나 적이 뭔가 거래를 걸어온다거나 동맹요구하거나" ·
 * "군대가 항상 마을에서 싸우나? 야전에서 마주칠수도 있는거 아닌가?")
 *
 *  - 청: AI 가 계절 끝에 걸고(ask 줄), 다음 계절에 답한다. 받으면 관계·창고가 바뀌고, 조공 요구를 거절하면(답이 없어도) 전쟁
 *  - 경계 강화: 곡식을 내고 경계가 오른다 · 한 고을 한 계절 한 번 · 남의 고을은 안 된다
 *  - 들판 싸움: 같은 길을 마주 보고 가는 적대 군대는 길 위에서 맞붙는다. 같은 방향·화친이면 아니다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders } from '../../src/realm/ai.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { openAsks, pairKey, relationOf } from '../../src/realm/diplomacy.ts'
import { canGuard, guardCost } from '../../src/realm/economy.ts'
import { advance, suspects } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Ask, Order, Realm, ReportLine } from '../../src/realm/types.ts'

type Battle = Extract<ReportLine, { kind: 'battle' }>

const NONE = { grain: 0, iron: 0 }

function withAsk(r: Realm, a: Partial<Ask> & Pick<Ask, 'kind'>): Ask {
  const ask: Ask = { id: `ask:${r.season - 1}:anya`, from: 'anya', to: 'us', give: NONE, take: NONE, until: r.season, ...a }
  ;(r.asks ??= []).push(ask)
  return ask
}

describe('청 — 남의 나라가 걸어온다', () => {
  it('판을 돌리면 청이 온다 — 플레이어에게만, 계절에 상한까지, 다음 계절이 마감', () => {
    let seen = 0
    for (let seed = 1; seed <= 30; seed++) {
      let r = byeonhanMini(seed)
      for (let s = 0; s < 16; s++) {
        const { next, report } = advance(r, aiOrders(r))
        const asks = report.lines.filter((l): l is Extract<ReportLine, { kind: 'ask' }> => l.kind === 'ask')
        assert.ok(asks.length <= P.realm.askMaxPerSeason)
        for (const l of asks) {
          assert.equal(l.ask.to, 'us')
          assert.notEqual(l.ask.from, 'us')
          assert.equal(l.ask.until, r.season + 1)
          assert.equal(l.ask.id, `ask:${r.season}:${l.ask.from}`)
          seen++
        }
        // 넘긴 판에서 그 청에 답할 수 있다
        assert.deepEqual(openAsks(next, 'us').map((a) => a.id).sort(), asks.map((l) => l.ask.id).sort())
        r = next
      }
    }
    assert.ok(seen > 10, `청이 너무 드물다: ${seen}`)
  })

  it('화친을 받으면 화친이 된다 · 답하면 청이 사라진다', () => {
    const r = byeonhanMini(1)
    r.season = 1
    const a = withAsk(r, { kind: 'truce' })
    const { next, report } = advance(r, [{ kind: 'answer', ask: a.id, yes: true }])
    assert.equal(relationOf(next, 'anya', 'us').state, 'truce')
    assert.ok(report.lines.some((l) => l.kind === 'answered' && l.ask === a.id && l.yes))
    // 답한 청은 사라진다 (계절 끝에 새 청이 올 수는 있다)
    assert.ok(!(next.asks ?? []).some((x) => x.id === a.id))
  })

  it('조공 요구 — 내면 곡식이 가고 화친, 거절하거나 답이 없으면 전쟁', () => {
    const base = byeonhanMini(1)
    base.season = 1
    const plain = advance(base, []).next.stock['us']!.grain // 청이 없던 계절의 살림
    for (const answer of ['yes', 'no', 'none'] as const) {
      const r = byeonhanMini(1)
      r.season = 1
      const a = withAsk(r, { kind: 'demand', take: { grain: 50, iron: 0 } })
      const orders: Order[] = answer === 'none' ? [] : [{ kind: 'answer', ask: a.id, yes: answer === 'yes' }]
      const { next } = advance(r, orders)
      if (answer === 'yes') {
        assert.equal(relationOf(next, 'anya', 'us').state, 'truce')
        // 50 이 나가고, 화친이 되어 그 계절 끝 장터 몫이 든다
        assert.equal(next.stock['us']!.grain, plain - 50 + P.realm.truceTrade)
      } else assert.equal(relationOf(next, 'anya', 'us').state, 'war')
    }
  })

  it('조공 요구를 받아도 곡식이 모자라면 거절로 친다 → 전쟁', () => {
    const r = byeonhanMini(1)
    r.season = 1
    r.stock['us']!.grain = 10
    const a = withAsk(r, { kind: 'demand', take: { grain: 50, iron: 0 } })
    const { next, report } = advance(r, [{ kind: 'answer', ask: a.id, yes: true }])
    assert.ok(report.lines.some((l) => l.kind === 'answered' && l.ask === a.id && !l.yes))
    assert.equal(relationOf(next, 'anya', 'us').state, 'war')
  })

  it('맞바꿈 — 받으면 서로 낸다', () => {
    const r = byeonhanMini(1)
    r.season = 1
    r.stock['anya']!.iron = 100
    r.stock['us']!.grain = 500
    const a = withAsk(r, { kind: 'trade', give: { grain: 0, iron: 15 }, take: { grain: 30, iron: 0 } })
    const ironBefore = r.stock['us']!.iron
    const { next } = advance(r, [{ kind: 'answer', ask: a.id, yes: true }])
    assert.ok(next.stock['us']!.iron >= ironBefore + 15)
  })

  it('마감이 지난 청에는 답할 수 없다', () => {
    const r = byeonhanMini(1)
    r.season = 3
    withAsk(r, { kind: 'truce', until: 2 })
    assert.equal(openAsks(r, 'us').length, 0)
  })
})

describe('경계 강화', () => {
  it('곡식을 내고 경계가 오른다 · 한 계절 한 번 · 남의 고을은 안 된다', () => {
    const r = byeonhanMini(1)
    assert.ok(canGuard(r, 'us', 'our-north'))
    assert.ok(!canGuard(r, 'us', 'anya-cap'))
    const plain = advance(r, []).next.stock['us']!.grain
    const { next, report } = advance(r, [
      { kind: 'guard', faction: 'us', node: 'our-north' },
      { kind: 'guard', faction: 'us', node: 'our-north' },
    ])
    assert.equal(report.lines.filter((l) => l.kind === 'guard').length, 1)
    // 경계는 계절 끝에 alertDecay 만큼 빠진다
    assert.ok(Math.abs(next.watch['our-north']!.alert - Math.max(0, P.realm.guardAlert - P.realm.alertDecay)) < 1e-9)
    assert.equal(next.stock['us']!.grain, plain - guardCost().grain)
  })

  it('곡식이 없으면 못 한다', () => {
    const r = byeonhanMini(1)
    r.stock['us']!.grain = guardCost().grain - 1
    assert.ok(!canGuard(r, 'us', 'our-north'))
  })

  it('경계가 높을수록 우리 고을로 오는 기습을 잘 챈다', () => {
    const count = (alert: number): number => {
      let n = 0
      for (let seed = 1; seed <= 200; seed++) {
        const r = byeonhanMini(seed)
        r.watch['our-north']!.alert = alert
        const a = r.armies['a-anya-1']!
        a.march = { from: 'anya-cap', to: 'our-north', edge: 'e05', left: 1, ambush: true }
        if (suspects(r, a)) n++
      }
      return n
    }
    assert.ok(count(0.5) > count(0))
    // 정면 행군은 기습 낌새가 아니다
    const r = byeonhanMini(1)
    const a = r.armies['a-anya-1']!
    a.march = { from: 'anya-cap', to: 'our-north', edge: 'e05', left: 1, ambush: false }
    assert.equal(suspects(r, a), false)
  })
})

describe('들판 싸움', () => {
  /** 갯마을 군장이 안개골에서 안야 국읍으로, 안야 군대가 안야 국읍에서 안개골로 — 같은 들길 e05 를 마주 보고 */
  function headOn(seed: number, setup: (r: Realm) => void = () => {}): { next: Realm; report: ReturnType<typeof advance>['report'] } {
    const r = byeonhanMini(seed)
    r.armies['a-us']!.at = 'our-north'
    setup(r)
    return advance(r, [
      { kind: 'march', army: 'a-us', edge: 'e05', ambush: false },
      { kind: 'march', army: 'a-anya-1', edge: 'e05', ambush: false },
    ])
  }

  it('마주 보고 가는 적대 군대는 길 위에서 맞붙는다 — 성·장정·기습이 없다', () => {
    const { report } = headOn(1)
    const f = report.lines.find((l): l is Battle => l.kind === 'battle' && l.field === true)
    assert.ok(f !== undefined)
    assert.equal(f.edge, 'e05')
    assert.equal(f.militia, 0)
    assert.equal(f.ambush, 'none')
  })

  it('진 쪽은 가던 곳에 못 간다 — 물러나고, 이긴 쪽은 가던 길을 간다', () => {
    let checked = 0
    for (let seed = 1; seed <= 20; seed++) {
      const { next, report } = headOn(seed)
      const f = report.lines.find((l): l is Battle => l.kind === 'battle' && l.field === true)!
      if (f.outcome === 'draw') continue
      const atkWon = f.outcome === 'rout' || f.outcome === 'win'
      const loser = atkWon ? (f.attacker === 'a-us' ? 'a-anya-1' : 'a-us') : f.attacker
      const winner = loser === 'a-us' ? 'a-anya-1' : 'a-us'
      const far = loser === 'a-us' ? 'anya-cap' : 'our-north'
      const a = next.armies[loser]
      if (a !== undefined) {
        assert.equal(a.march, null)
        assert.notEqual(a.at, far)
      }
      // 이긴 쪽은 가던 고을에 닿아 그 고을과 싸우거나 들어갔다
      const win = report.lines.some((l) => (l.kind === 'battle' && !l.field && l.attacker === winner) || (l.kind === 'arrive' && l.army === winner))
      assert.ok(win)
      checked++
    }
    assert.ok(checked > 5)
  })

  it('화친이면 엇갈려 지나간다', () => {
    const { report } = headOn(1, (r) => {
      r.relations[pairKey('us', 'anya')] = { state: 'truce', until: 99 }
    })
    assert.ok(!report.lines.some((l) => l.kind === 'battle' && l.field === true))
  })

  it('같은 방향으로 가면 안 싸운다', () => {
    const r = byeonhanMini(1)
    r.armies['a-us']!.at = 'our-north'
    r.armies['a-goja']!.at = 'our-north'
    r.relations[pairKey('us', 'goja')] = { state: 'war', until: null }
    const { report } = advance(r, [
      { kind: 'march', army: 'a-us', edge: 'e05', ambush: false },
      { kind: 'march', army: 'a-goja', edge: 'e05', ambush: false },
    ])
    assert.ok(!report.lines.some((l) => l.kind === 'battle' && l.field === true))
  })

  it('같은 판이면 같은 들판 싸움 (결정론)', () => {
    assert.deepEqual(headOn(7).report, headOn(7).report)
    assert.deepEqual(headOn(7).next, headOn(7).next)
  })
})
