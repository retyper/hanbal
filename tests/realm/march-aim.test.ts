/**
 * 가는 사이 주인이 바뀐 고을 — 싸우지 않는 나라 땅이 됐으면 들어가지 않고 돌아선다
 * (형 2026-10-20: "전쟁시도하지 않았는데 왜 우리가 거칠산국땅에 군대를 들였다는지")
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { pairKey, relationOf } from '../../src/realm/diplomacy.ts'
import { deedText } from '../../src/realm/data/prose.ts'
import { advance, planned } from '../../src/realm/season.ts'

describe('가던 고을의 주인이 바뀌면', () => {
  it('빈땅으로 가는 사이 이웃 나라가 먼저 쥐었으면 — 전쟁이 되지 않고 돌아선다', () => {
    const r = planned(byeonhanMini(1), [])
    const a = r.armies['a-us']!
    a.at = 'sodo'
    a.march = { from: 'sodo', to: 'wild-beodeul', edge: 'e24', left: 1, ambush: false, aim: null }
    const n = r.nodes['wild-beodeul']!
    n.owner = 'miri'
    n.hh = 50
    assert.notEqual(relationOf(r, 'us', 'miri').state, 'war')
    const { next, report } = advance(r, [])
    assert.notEqual(relationOf(next, 'us', 'miri').state, 'war')
    assert.ok(report.lines.some((l) => l.kind === 'recall' && l.army === 'a-us' && l.owner === 'miri'))
    assert.equal(next.nodes['wild-beodeul']!.owner, 'miri')
    assert.notEqual(next.armies['a-us']?.at, 'wild-beodeul')
  })

  it('떠날 때부터 그 나라 땅이었으면 (일부러 친 것) — 그대로 들어가 전쟁이 된다', () => {
    const r = planned(byeonhanMini(1), [])
    const a = r.armies['a-us']!
    a.at = 'sodo'
    a.march = { from: 'sodo', to: 'wild-beodeul', edge: 'e24', left: 1, ambush: false, aim: 'miri' }
    const n = r.nodes['wild-beodeul']!
    n.owner = 'miri'
    n.hh = 50
    const { next } = advance(r, [])
    assert.equal(relationOf(next, 'us', 'miri').state, 'war')
    // 나라 카드의 "있었던 일" — 우리가 쳐서 전쟁이 됐다 (때와 함께)
    const deeds = next.relations[pairKey('us', 'miri')]?.deeds ?? []
    const war = deeds.find((d) => d.k === 'rel' && d.st === 'war')
    assert.ok(war !== undefined && war.by === 'us' && war.s === r.season)
    assert.match(deedText(next, 'us', 'miri', war).text, /우리가 .+ 땅에 군대를 들여 전쟁이 됐다/)
    assert.equal(deedText(next, 'miri', 'us', war).tone, 'bad')
  })
})

describe('회군 (형: "가는도중에 있는 군대는 회군할수 있게 해야하는거아님?")', () => {
  it('길 위의 군대를 돌리면 온 만큼 걸려 떠난 고을로 돌아온다 · 싸우지 않는다 · 같은 판 같은 명령이면 같은 답', () => {
    const r = planned(byeonhanMini(1), [])
    const a = r.armies['a-us']!
    a.at = 'sodo'
    // 두 계절 길의 첫 계절이 지났다 — 한 계절 남음
    a.march = { from: 'sodo', to: 'wild-beodeul', edge: 'e24', left: 1, ambush: true, aim: null }
    const o = [{ kind: 'turnBack' as const, army: 'a-us' }]
    const { next, report } = advance(r, o)
    assert.deepEqual(advance(r, o), advance(r, o))
    assert.ok(report.lines.some((l) => l.kind === 'recall' && l.army === 'a-us' && l.why === 'order'))
    assert.ok(!report.lines.some((l) => l.kind === 'battle'))
    const back = next.armies['a-us']!
    assert.ok(back.at === 'sodo' || back.march?.to === 'sodo', JSON.stringify(back.march))
    assert.notEqual(back.at, 'wild-beodeul')
  })
})
