/**
 * 곳간 열기 · 유민 부르기 (economy.applyCall · 위원회 11-04 림월드 ①)
 *  - 곡식이 들고 그 고을로 오는 길 위의 집(inbound)이 는다 → 다음 계절부터 조금씩 닿는다
 *  - 고을마다 한 계절에 한 번 · 한도(품의 몫 · 남은 품 · 곡식)를 넘으면 아무 일도 없다
 *  - 남의 고을·남의 군대가 머무는 고을은 못 연다
 *  - 같은 판이면 같은 결과 (A1)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { callCost, callLimit, callWhy, inboundOf } from '../../src/realm/economy.ts'
import { advance, planned } from '../../src/realm/season.ts'
import type { Order } from '../../src/realm/types.ts'

const call = (node: string, n: number): Order => ({ kind: 'call', faction: 'us', node, n })

describe('곳간 열기', () => {
  it('곡식이 들고 길 위의 집이 생겨 다음 계절부터 닿는다', () => {
    const r = byeonhanMini(1)
    r.stock['us']!.grain = 3000
    const lim = callLimit(r, 'us', 'our-north')
    assert.ok(lim > 0)
    const cost = callCost(r, 'us', lim).grain
    const plain = advance(r, []).next
    const { next, report } = advance(r, [call('our-north', lim)])
    assert.equal(report.lines.filter((l) => l.kind === 'call').length, 1)
    assert.ok(plain.stock['us']!.grain - next.stock['us']!.grain >= cost - 1)
    // 이번 계절에 일부가 닿았거나 길 위에 있다
    const got = next.nodes['our-north']!.hh + inboundOf(next.nodes['our-north']!, 'us') - plain.nodes['our-north']!.hh
    assert.ok(got >= lim - 1, `${got} / ${lim}`)
  })

  it('한 계절에 한 번 · 한도를 넘으면 아무 일도 없다', () => {
    const r = byeonhanMini(1)
    r.stock['us']!.grain = 3000
    const lim = callLimit(r, 'us', 'our-north')
    assert.deepEqual(advance(r, [call('our-north', lim + 1)]).next, advance(r, []).next)
    const p = planned(r, [call('our-north', lim)])
    assert.equal(callLimit(p, 'us', 'our-north'), 0)
    assert.notEqual(callWhy(p, 'us', 'our-north'), null)
  })

  it('남의 고을 · 남의 군대가 머무는 고을은 못 연다', () => {
    const r = byeonhanMini(1)
    r.stock['us']!.grain = 3000
    assert.equal(callLimit(r, 'us', 'guya-cap'), 0)
    const camped = planned(r, [])
    camped.armies['a-guya-1']!.at = 'our-north'
    assert.equal(callLimit(camped, 'us', 'our-north'), 0)
  })

  it('같은 판이면 같은 결과', () => {
    const r = byeonhanMini(2)
    r.stock['us']!.grain = 3000
    const o = [call('our-north', callLimit(r, 'us', 'our-north'))]
    assert.deepEqual(advance(r, o).next, advance(r, o).next)
  })
})
