/**
 * 이기는 길 · 외교의 손 (docs/realm/VICTORY.md §1 · §2-2 — 형 2026-10-19 "이어서해")
 *  - 보낼 사람 = 군장의 사자 + 쉬는 장수 · 넘치는 사신·공작은 주문 차례대로 버린다 (결정론)
 *  - 같은 장수를 두 사신에 딸려 보내면 두 번째는 사자가 간다
 *  - 맹주(진왕): 아는 나라 절반 넘게와 동맹·조공으로 손잡고(조공국 하나는) 네 계절 내리 → 이김 · 끊기면 시계가 처음부터
 *  - 남이 맹주가 되면 우리가 진다 · 그 전에 소문이 온다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { makeVassal, onHostile, pairKey, relationOf } from '../../src/realm/diplomacy.ts'
import { handsOf, idleHeroes, limitHands } from '../../src/realm/hands.ts'
import { pactOf } from '../../src/realm/suzerain.ts'
import { advance, planned } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, Realm } from '../../src/realm/types.ts'

const gift = (from: string, to: string, hero?: string): Order => ({
  kind: 'envoy', from, to, ask: 'gift', give: { grain: 10, iron: 0, salt: 0, wood: 0, horse: 0 }, take: { grain: 0, iron: 0, salt: 0, wood: 0, horse: 0 }, ...(hero !== undefined ? { hero } : {}),
})

/** f 와 a·b 는 동맹, c 는 f 의 조공국 (기한 넉넉히) */
/** 속국으로 삼는다 (기한 넉넉히) */
function vassal(r: Realm, f: string, v: string): void {
  r.relations[pairKey(f, v)] = { state: 'truce', until: 999 }
  makeVassal(r, v, f)
  r.relations[pairKey(f, v)]!.vassal = { lord: f, until: 999 }
}
/** 셋을 속국으로 — 아는 나라 다섯의 절반 넘게(3) */
function pact(r: Realm, f: string, a: string, b: string, c: string): void {
  for (const v of [a, b, c]) vassal(r, f, v)
}

describe('외교의 손 — 보낼 사람', () => {
  it('보낼 사람 = 사자 + 쉬는 장수 · 넘치는 사신은 주문 차례대로 버린다', () => {
    const r = planned(byeonhanMini(1), [])
    const cap = handsOf(r, 'us')
    assert.equal(cap, P.realm.handsBase + idleHeroes(r, 'us').length)
    const targets = ['guya', 'anya', 'miri', 'goja', 'dokro']
    const orders = targets.slice(0, cap + 1).map((t) => gift('us', t))
    const kept = limitHands(r, orders)
    assert.equal(kept.length, cap)
    assert.deepEqual(kept, orders.slice(0, cap), '앞의 것부터 남는다')
    assert.deepEqual(limitHands(r, orders), kept, '같은 판 같은 주문이면 같다')
    // 엔진도 같은 규칙 — 사신 줄은 cap 개
    r.stock['us']!.grain = 9999
    const { report } = advance(r, orders)
    assert.equal(report.lines.filter((l) => l.kind === 'envoy' && l.from === 'us').length, cap)
  })

  it('한 장수를 두 사신에 딸려 보내면 두 번째는 사자가 간다', () => {
    const r = planned(byeonhanMini(1), [])
    const idle = idleHeroes(r, 'us')
    if (idle.length === 0) return // 쉬는 장수가 없는 판이면 볼 게 없다
    const h = idle[0]!
    const kept = limitHands(r, [gift('us', 'guya', h), gift('us', 'anya', h)])
    assert.equal(kept.length, 2)
    assert.equal((kept[0] as { hero?: string }).hero, h)
    assert.equal((kept[1] as { hero?: string }).hero, undefined)
  })

  it('장수가 군대를 이끌면 쉬는 장수가 아니다', () => {
    const r = planned(byeonhanMini(1), [])
    const lead = Object.values(r.armies).find((a) => a.faction === 'us' && a.hero !== null)?.hero
    if (lead != null) assert.ok(!idleHeroes(r, 'us').includes(lead))
  })
})

describe('맹주의 길 — 진왕', () => {
  it('절반 넘게와 손잡고 네 계절 내리 버티면 이긴다 (path suzerain)', () => {
    let r = planned(byeonhanMini(1), [])
    pact(r, 'us', 'guya', 'anya', 'miri')
    assert.ok(pactOf(r, 'us').score >= pactOf(r, 'us').need)
    for (let i = 0; i < P.realm.suzerainSeasons && !r.outcome; i++) r = advance(r, []).next
    assert.equal(r.outcome?.kind, 'win')
    assert.equal(r.outcome?.path, 'suzerain')
  })

  it('동맹은 반 나라로 센다 — 속국 하나 + 동맹 셋(2.5)은 모자라고 동맹 넷(3)이면 찬다', () => {
    const r = planned(byeonhanMini(1), [])
    vassal(r, 'us', 'guya')
    for (const x of ['anya', 'miri', 'goja']) r.relations[pairKey('us', x)] = { state: 'ally', until: null }
    const p = pactOf(r, 'us')
    assert.equal(p.vassals, 1)
    assert.equal(p.allies, 3)
    assert.equal(p.score, 1 + 3 * P.realm.suzerainAllyWeight)
    assert.ok(p.score < p.need)
    const rest = Object.keys(r.factions).find((x) => x !== 'us' && !['guya', 'anya', 'miri', 'goja'].includes(x))!
    r.relations[pairKey('us', rest)] = { state: 'ally', until: null }
    assert.ok(pactOf(r, 'us').score >= pactOf(r, 'us').need)
  })

  it('조공국이 없으면 동맹만으로는 진왕이 아니다', () => {
    let r = planned(byeonhanMini(1), [])
    r.relations[pairKey('us', 'guya')] = { state: 'ally', until: null }
    r.relations[pairKey('us', 'anya')] = { state: 'ally', until: null }
    r.relations[pairKey('us', 'miri')] = { state: 'ally', until: null }
    for (let i = 0; i < P.realm.suzerainSeasons + 1 && !r.outcome; i++) r = advance(r, []).next
    assert.notEqual(r.outcome?.path, 'suzerain')
  })

  it('끊기면 시계가 처음부터', () => {
    let r = planned(byeonhanMini(1), [])
    pact(r, 'us', 'guya', 'anya', 'miri')
    r = advance(r, []).next
    r = advance(r, []).next
    assert.equal(r.suzerain?.['us']?.streak, 2)
    // 속국 하나가 떨어졌다 — 셈이 모자란다
    r.relations[pairKey('us', 'guya')] = { state: 'neutral', until: null }
    r = advance(r, []).next
    assert.equal(r.suzerain?.['us']?.streak, 0)
    assert.equal(r.outcome ?? null, null)
  })

  it('남이 맹주가 되면 우리가 진다 · 그 전에 소문이 온다', () => {
    let r = planned(byeonhanMini(1), [])
    pact(r, 'guya', 'anya', 'miri', 'goja')
    let rumor = false
    for (let i = 0; i < P.realm.suzerainSeasons && !r.outcome; i++) {
      const res = advance(r, [])
      if (res.report.lines.some((l) => l.kind === 'suzerain' && l.faction === 'guya')) rumor = true
      r = res.next
    }
    assert.ok(rumor)
    assert.equal(r.outcome?.kind, 'lose')
    assert.equal(r.outcome?.path, 'suzerain')
    assert.equal(r.outcome?.by, 'guya')
  })

  it('전쟁이 나면 조공은 끊긴다 · 평화면 남는다', () => {
    const r = planned(byeonhanMini(1), [])
    makeVassal(r, 'miri', 'us')
    assert.ok(relationOf(r, 'miri', 'us').vassal !== undefined)
    const calm = advance(r, []).next
    assert.ok(relationOf(calm, 'miri', 'us').vassal !== undefined, '평화면 남는다')
    onHostile(calm, 'us', 'miri', [])
    assert.equal(relationOf(calm, 'miri', 'us').vassal, undefined)
  })
})
