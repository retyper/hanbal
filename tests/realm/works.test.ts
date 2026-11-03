/**
 * 고을 일터 · 단 올리기 (works.ts · 형 11-03 "1 사면 나중에 2가 되고 5가 돼")
 *  - 지으면 workTurns 뒤에 선다 · 값이 든다
 *  - 같은 일터를 다시 고르면 단이 오른다 · 값은 workLvCostMul 의 거듭제곱 · 효과는 곱으로 더
 *  - workLvMax 를 넘지 못한다 · 다른 일터는 못 짓는다
 *  - 같은 판이면 같은 결과 (A1)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { advance } from '../../src/realm/season.ts'
import { canWork, workBlocked, workCost, workLv, workMulAt } from '../../src/realm/works.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, Realm } from '../../src/realm/types.ts'

const work = (r: Realm, what: 'paddy' | 'yard'): Order => ({ kind: 'work', faction: r.player, node: 'our-cap', what })

/** 일터 주문을 넣고 다 설 때까지 돌린다 */
function build(r0: Realm, what: 'paddy' | 'yard'): Realm {
  let r = r0
  r.stock[r.player]!.grain = 100000
  r = advance(r, [work(r, what)]).next
  for (let i = 0; i < 12 && (r.works ?? []).length > 0; i++) {
    r.stock[r.player]!.grain = 100000
    r = advance(r, []).next
  }
  return r
}

describe('일터 단 올리기', () => {
  it('지으면 1단 · 다시 고르면 2단 · 3단 · 그 위는 못 올린다', () => {
    let r = build(byeonhanMini(1), 'paddy')
    assert.equal(r.nodes['our-cap']!.work, 'paddy')
    assert.equal(workLv(r.nodes['our-cap']), 1)
    const m1 = workMulAt(r, 'our-cap', 'harvest')
    r = build(r, 'paddy')
    assert.equal(workLv(r.nodes['our-cap']), 2)
    const m2 = workMulAt(r, 'our-cap', 'harvest')
    r = build(r, 'paddy')
    assert.equal(workLv(r.nodes['our-cap']), Math.round(P.realm.workLvMax))
    const m3 = workMulAt(r, 'our-cap', 'harvest')
    assert.ok(m1 > 1 && m2 > m1 && m3 > m2, `${m1} ${m2} ${m3}`)
    // 효과 몫이 곱으로 커진다 — 2단은 1단 몫의 workLv2Gain 배
    assert.ok(Math.abs((m2 - 1) / (m1 - 1) - P.realm.workLv2Gain) < 1e-9)
    assert.equal(workBlocked(r, r.player, 'our-cap', 'paddy'), '다 올렸다')
    assert.equal(canWork(r, r.player, 'our-cap', 'paddy'), false)
    assert.notEqual(workBlocked(r, r.player, 'our-cap', 'yard'), null) // 고을마다 하나
  })

  it('올리는 값은 단마다 workLvCostMul 배', () => {
    const c1 = workCost('paddy', 1).grain!
    const c2 = workCost('paddy', 2).grain!
    const c3 = workCost('paddy', 3).grain!
    assert.equal(c2, Math.round(c1 * P.realm.workLvCostMul))
    assert.equal(c3, Math.round(c1 * P.realm.workLvCostMul ** 2))
    // 실제로 그만큼 빠진다
    let r = build(byeonhanMini(1), 'paddy')
    r.stock[r.player]!.grain = 1000
    const before = advance(r, []).next.stock[r.player]!.grain
    const after = advance(r, [work(r, 'paddy')]).next.stock[r.player]!.grain
    assert.equal(before - after, c2)
  })

  it('같은 판이면 같은 결과', () => {
    const a = build(build(byeonhanMini(2), 'yard'), 'yard')
    const b = build(build(byeonhanMini(2), 'yard'), 'yard')
    assert.deepEqual(a, b)
    assert.equal(workLv(a.nodes['our-cap']), 2)
  })
})
