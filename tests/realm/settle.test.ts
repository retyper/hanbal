/**
 * 빈땅 · 개척 (docs/realm/FLOW.md §2 — 형: "빈땅도 좀 있고 개척도 좀 해야하고", 2026-10-18)
 *
 *  - 판은 빈땅 일곱으로 연다 — 아무도 안 쥐었고 사람이 없다. 품(room)이 있다
 *  - 개척: 맞닿은 제 고을 사람을 옮긴다 · 곡식이 든다 · 그 땅이 제 것이 되고 그 이웃이 보인다
 *  - 규칙에 안 맞는 개척은 아무 일도 없다 (한도 넘음 · 안 맞닿음 · 남의 땅 · 남의 군대 · 막힌 길 · 곡식 없음)
 *  - 개척한 땅은 품까지 빨리 크고 품을 넘지 않는다
 *  - 군대가 빈 빈땅에 걸어 들어가면 깃발을 꽂는다 — 그 뒤 사람을 보낼 수 있다
 *  - AI 도 개척한다 · 같은 판이면 같은 결과
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders, decide } from '../../src/realm/ai.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { settleCost, settleLimit, settleTargets } from '../../src/realm/economy.ts'
import { advance, planned } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, Realm } from '../../src/realm/types.ts'

const settle = (faction: string, from: string, to: string, n: number): Order => ({ kind: 'settle', faction, from, to, n })

describe('빈땅', () => {
  it('판은 빈땅 일곱으로 연다 — 주인 없음 · 사람 없음 · 품이 있다', () => {
    const r = byeonhanMini(1)
    const wild = Object.values(r.nodes).filter((n) => n.kind === 'wild')
    assert.equal(wild.length, 7)
    for (const n of wild) {
      assert.equal(n.owner, null)
      assert.equal(n.hh, 0)
      assert.ok((n.room ?? 0) > 0, n.id)
    }
    // 모든 빈땅은 길이 둘 이상 — 나라 사이 길이 된다
    for (const n of wild) {
      const deg = Object.values(r.edges).filter((e) => e.a === n.id || e.b === n.id).length
      assert.ok(deg >= 2, `${n.id} 길 ${deg}`)
    }
  })

  it('지금 개척할 수 있는 짝 — 갯마을은 국읍에서 돌섬으로', () => {
    const r = byeonhanMini(1)
    assert.deepEqual(settleTargets(r, 'us'), [{ from: 'our-cap', to: 'wild-dolseom', edge: 'e34' }])
    // 셋 가운데 작은 것 — 가호 300 의 settleShare · 품 150 · 곡식
    const want = Math.min(Math.floor(300 * P.realm.settleShare), 150, Math.floor(r.stock['us']!.grain / P.realm.settleGrain))
    assert.equal(settleLimit(r, 'us', 'our-cap', 'wild-dolseom'), want)
  })
})

describe('개척', () => {
  it('사람이 옮기고 곡식이 들고 그 땅이 제 것이 된다 · 이웃이 보인다', () => {
    const r = byeonhanMini(1)
    assert.equal(r.intel['us']!['guya-cap'], undefined)
    const n = 30
    const { next, report } = advance(r, [settle('us', 'our-cap', 'wild-dolseom', n)])
    assert.deepEqual(report.lines.filter((l) => l.kind === 'settle'), [settle('us', 'our-cap', 'wild-dolseom', n)])
    assert.equal(next.nodes['wild-dolseom']!.owner, 'us')
    assert.ok(next.nodes['wild-dolseom']!.hh >= n) // 그 계절의 성장까지
    // 국읍은 n 만큼 줄고 그 계절 성장 ±
    assert.ok(next.nodes['our-cap']!.hh <= Math.round((300 - n) * (1 + P.realm.hhGrowth)) + 1)
    // 곡식: 개척 값 + 군량
    const plain = advance(r, []).next
    assert.equal(plain.stock['us']!.grain - next.stock['us']!.grain, settleCost(n).grain)
    assert.ok(next.intel['us']!['guya-cap']?.land)
  })

  it('규칙에 안 맞으면 아무 일도 없다', () => {
    const r = byeonhanMini(1)
    const lim = settleLimit(r, 'us', 'our-cap', 'wild-dolseom')
    const same = (o: Order, why: string): void => {
      const a = advance(r, [o])
      const b = advance(r, [])
      assert.deepEqual(a.next, b.next, why)
    }
    same(settle('us', 'our-cap', 'wild-dolseom', lim + 1), '한도 넘음')
    same(settle('us', 'our-cap', 'wild-dolseom', 0), '0')
    same(settle('us', 'our-cap', 'wild-dolseom', 2.5), '정수 아님')
    same(settle('us', 'our-cap', 'wild-galmae', 10), '안 맞닿음')
    same(settle('us', 'guya-cap', 'wild-dolseom', 10), '남의 고을에서')
    same(settle('us', 'our-cap', 'our-north', 10), '빈땅이 아님')
    same(settle('nobody', 'our-cap', 'wild-dolseom', 10), '없는 나라')
    // 남이 쥔 빈땅
    const owned = planned(r, [])
    owned.nodes['wild-dolseom']!.owner = 'guya'
    assert.equal(settleLimit(owned, 'us', 'our-cap', 'wild-dolseom'), 0)
    // 남의 군대가 머문다
    const camped = planned(r, [])
    camped.armies['a-guya-1']!.at = 'wild-dolseom'
    assert.equal(settleLimit(camped, 'us', 'our-cap', 'wild-dolseom'), 0)
    // 겨울엔 고개가 막힌다 — 남강 산성 → 갈매봉 (고갯길 e23)
    const winter = planned(r, [])
    assert.ok(settleLimit(winter, 'anya', 'anya-fort', 'wild-galmae') > 0)
    winter.season = 3
    assert.equal(settleLimit(winter, 'anya', 'anya-fort', 'wild-galmae'), 0)
    // 곡식이 없으면 못 간다 · 조금 있으면 그만큼만
    const poor = planned(r, [])
    poor.stock['us']!.grain = 0
    assert.equal(settleLimit(poor, 'us', 'our-cap', 'wild-dolseom'), 0)
    poor.stock['us']!.grain = 6
    assert.equal(settleLimit(poor, 'us', 'our-cap', 'wild-dolseom'), Math.floor(6 / P.realm.settleGrain))
  })

  it('품까지 빨리 크고 품을 넘지 않는다 · 더 보내도 품까지만', () => {
    let r: Realm = advance(byeonhanMini(1), [settle('us', 'our-cap', 'wild-dolseom', 20)]).next
    const room = r.nodes['wild-dolseom']!.room!
    let prev = r.nodes['wild-dolseom']!.hh
    for (let i = 0; i < 40; i++) {
      r.stock['us']!.grain = 500 // 굶지 않게
      r = advance(r, []).next
      const hh = r.nodes['wild-dolseom']!.hh
      assert.ok(hh <= room, `품 ${room} 을 넘었다: ${hh}`)
      assert.ok(hh >= prev)
      prev = hh
    }
    assert.equal(prev, room)
    assert.equal(settleLimit(r, 'us', 'our-cap', 'wild-dolseom'), 0)
    // 처음 몇 계절은 보통 고을보다 훨씬 빨리 큰다
    const s = advance(byeonhanMini(1), [settle('us', 'our-cap', 'wild-dolseom', 20)]).next
    assert.ok(advance(s, []).next.nodes['wild-dolseom']!.hh >= Math.round(s.nodes['wild-dolseom']!.hh * (1 + P.realm.settleGrow)) - 1)
  })

  it('군대가 빈 빈땅에 걸어 들어가면 깃발을 꽂는다 — 싸움도 전쟁도 아니다. 그 뒤 사람을 보낸다', () => {
    const r = byeonhanMini(1)
    const { next, report } = advance(r, [{ kind: 'march', army: 'a-us', edge: 'e34', ambush: false }])
    assert.equal(report.lines.filter((l) => l.kind === 'battle').length, 0)
    assert.equal(report.lines.filter((l) => l.kind === 'relation').length, 0)
    assert.equal(next.nodes['wild-dolseom']!.owner, 'us')
    assert.equal(next.nodes['wild-dolseom']!.hh, 0)
    assert.ok(settleLimit(next, 'us', 'our-cap', 'wild-dolseom') > 0)
  })

  it('남이 개척한 땅은 보통 고을처럼 뺏는다 — 사람이 흩어진다', () => {
    const r = planned(byeonhanMini(1), [])
    r.nodes['wild-dolseom']!.owner = 'guya'
    r.nodes['wild-dolseom']!.hh = 100
    r.armies['a-us']!.mix = { spear: 900, bow: 300 }
    const { next, report } = advance(r, [{ kind: 'march', army: 'a-us', edge: 'e34', ambush: false }])
    assert.equal(report.lines.filter((l) => l.kind === 'battle').length, 1)
    if (next.nodes['wild-dolseom']!.owner === 'us') assert.ok(next.nodes['wild-dolseom']!.hh < 100)
  })
})

describe('AI 의 개척', () => {
  it('AI 는 봄·가을에 빈땅을 개척한다 · 같은 판이면 같은 결과', () => {
    const run = (): { r: Realm; settled: number } => {
      let r = byeonhanMini(5)
      let settled = 0
      for (let i = 0; i < 24; i++) {
        const { next, report } = advance(r, [...decide(r, 'us', 'planner'), ...aiOrders(r)])
        settled += report.lines.filter((l) => l.kind === 'settle').length
        for (const l of report.lines) if (l.kind === 'settle') assert.ok(i % 4 === 0 || i % 4 === 2, `봄·가을에만 (${i})`)
        r = next
      }
      return { r, settled }
    }
    const a = run()
    const b = run()
    assert.deepEqual(a.r, b.r)
    assert.ok(a.settled > 0)
    assert.ok(Object.values(a.r.nodes).some((n) => n.kind === 'wild' && n.owner !== null && n.hh > 0))
  })

  it('무모·무작위 봇은 개척하지 않는다', () => {
    const r = byeonhanMini(1)
    for (const brain of ['reckless', 'random'] as const) {
      assert.ok(!decide(r, 'us', brain).some((o) => o.kind === 'settle'))
    }
  })
})
