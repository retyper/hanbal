/**
 * 고을을 맡은 장수도 사신·공작에 보낸다 (형 2026-10-26: "사신이나 공작으로 보낼때에는 마을 맡고있는 애들도 내가 보낼수가 있어서
 * 안보낸 경우에만 알아서 고을 맡기를 하는거임")
 *  - 고을지기를 이름으로 보내면 제 몸이 손이다 — 사자·쉬는 장수 수(handsOf)를 안 깎는다 (hands.ownHand · limitHands)
 *  - 그 계절엔 자리를 비우고(awayUntil) 자리는 그대로 — 다음 계절 다시 그 고을을 맡는다 · 알아서 일하기(idleHeroOrders)가 그 고을을 남에게 주지 않는다
 *  - 같은 고을지기를 두 번 쓰면 둘째는 사자 몫으로 센다 · 같은 판이면 같은 답 (결정론)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { envoyOptions } from '../../src/realm/diplomacy.ts'
import { handsOf, limitHands, ownHand, ownHandsIn } from '../../src/realm/hands.ts'
import { idleHeroOrders, postHero } from '../../src/realm/heroes.ts'
import { plotTargets } from '../../src/realm/plots.ts'
import { advance } from '../../src/realm/season.ts'
import type { Order, Realm } from '../../src/realm/types.ts'

const NONE = { grain: 0, iron: 0 }

/** 골포국 — 돌개는 안개골(our-east), 잔물은 갈대울(our-north)을 맡았다 · 매눈은 군대 · 쉬는 장수가 없다 (보낼 사람 = 사자 하나) */
function posted(seed = 1): Realm {
  const r = byeonhanMini(seed)
  r.heroes['us-1']!.at = 'our-east'
  r.heroes['us-1']!.post = 'our-east'
  r.heroes['us-2']!.at = 'our-north'
  r.heroes['us-2']!.post = 'our-north'
  return r
}

/** 그 나라에 보낼 수 있는 사신 하나 — 물건이 필요 없는 것 */
function askTo(r: Realm, to: string): Extract<Order, { kind: 'envoy' }> {
  const ask = envoyOptions(r, 'us', to).find((a) => a !== 'gift' && a !== 'trade' && a !== 'break' && a !== 'joint' && a !== 'troops' && a !== 'aid' && a !== 'tribute')
  assert.ok(ask !== undefined, `${to} 에 보낼 사신이 없다`)
  return { kind: 'envoy', from: 'us', to, ask, give: NONE, take: NONE }
}

describe('고을지기를 사신·공작에 보낸다', () => {
  it('고을지기는 제 몸이 손 — 사자가 이미 나가도 간다', () => {
    const r = posted()
    assert.equal(handsOf(r, 'us'), 1, '쉬는 장수가 없어 사자 하나')
    assert.ok(ownHand(r, 'us', 'us-1') && ownHand(r, 'us', 'us-2'))
    assert.ok(!ownHand(r, 'us', 'chief'), '군대를 이끄는 장수는 아니다')
    assert.ok(!ownHand(r, 'us', 'us-ruler'), '군주는 아니다')
    const rumor = plotTargets(r, 'us', 'rumor')[0]!
    const orders: Order[] = [
      askTo(r, 'guya'), // 사자
      { ...askTo(r, 'anya'), hero: 'us-1' }, // 고을지기 돌개
      { kind: 'plot', faction: 'us', op: 'rumor', target: rumor.target, agent: 'us-2' }, // 고을지기 잔물
    ]
    assert.equal(ownHandsIn(r, orders, 'us'), 2)
    assert.equal(limitHands(r, orders).length, 3, '셋 다 간다')
    // 이름 없는 둘째 사신은 사자가 없어 빠진다
    const more = [...orders, askTo(r, 'miri')]
    assert.equal(limitHands(r, more).length, 3)
  })

  it('같은 고을지기를 두 번 쓰면 둘째는 사자 몫 — 사자가 없으면 빠진다', () => {
    const r = posted()
    const a: Order = { ...askTo(r, 'guya'), hero: 'us-1' }
    const b: Order = { ...askTo(r, 'anya'), hero: 'us-1' }
    const out = limitHands(r, [a, b])
    assert.equal(out.length, 2, '둘째는 사자가 간다')
    assert.equal((out[1] as Extract<Order, { kind: 'envoy' }>).hero, undefined, '둘째 사신은 장수를 떼고 사자가')
    const c: Order = askTo(r, 'miri')
    assert.equal(limitHands(r, [a, b, c]).length, 2, '사자가 다 나가 셋째는 빠진다')
  })

  it('보낸 계절엔 고을을 비우고, 다음 계절 다시 맡는다 — 알아서 일하기가 그 고을을 남에게 안 준다', () => {
    const r = posted()
    const rumor = plotTargets(r, 'us', 'rumor')[0]!
    const orders: Order[] = [
      { ...askTo(r, 'anya'), hero: 'us-1' },
      { kind: 'plot', faction: 'us', op: 'rumor', target: rumor.target, agent: 'us-2' },
    ]
    const { next, report } = advance(r, orders)
    assert.ok(report.lines.some((l) => l.kind === 'envoy' && l.from === 'us'), '사신이 갔다')
    assert.ok(report.lines.some((l) => l.kind === 'plot' && l.faction === 'us'), '공작이 갔다')
    for (const [id, node] of [['us-1', 'our-east'], ['us-2', 'our-north']] as const) {
      const h = next.heroes[id]!
      assert.equal(h.status, 'free', `${id} 는 무사히 돌아왔다`)
      assert.equal(h.awayUntil, r.season, `${id} 는 보낸 계절에 자리를 비웠다`)
      assert.equal(h.post, node, `${id} 의 자리는 그대로`)
      assert.equal(postHero(next, node)?.id, id, `${id} 는 다음 계절 다시 ${node} 를 맡는다`)
    }
    // 다음 계절 알아서 일하기 — 두 고을지기는 그대로, 아무도 그 자리에 오지 않는다
    const auto = idleHeroOrders(next, 'us', new Set(), true)
    assert.ok(!auto.some((o) => o.kind === 'assign' && (o.node === 'our-east' || o.node === 'our-north')), JSON.stringify(auto))
    assert.ok(!auto.some((o) => (o.kind === 'assign' || o.kind === 'lead') && (o.hero === 'us-1' || o.hero === 'us-2')))
  })

  it('같은 판이면 같은 답 — 결정론', () => {
    const run = (): Realm => {
      const r = posted(7)
      const rumor = plotTargets(r, 'us', 'rumor')[0]!
      return advance(r, [askTo(r, 'guya'), { ...askTo(r, 'anya'), hero: 'us-1' }, { kind: 'plot', faction: 'us', op: 'rumor', target: rumor.target, agent: 'us-2' }]).next
    }
    assert.deepEqual(run(), run())
  })
})
