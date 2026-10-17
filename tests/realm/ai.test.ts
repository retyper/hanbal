/**
 * 세력 AI — 같은 정보 규칙을 따른다 (docs/realm/SYSTEMS.md §11)
 *
 *  - 같은 판 · 같은 계절이면 같은 명령 (결정론 — 헤드리스로 1천 판을 붙여 볼 수 있어야 한다)
 *  - 신중은 본 적 없는 고을을 치지 않는다 — 먼저 정찰한다
 *  - AI 는 남의 진짜 군세를 몰래 읽지 않는다: 참값을 바꿔도 제 정보가 같으면 같은 명령
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders, decide } from '../../src/realm/ai.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { advance } from '../../src/realm/season.ts'
import type { Realm } from '../../src/realm/types.ts'

function play(seed: number, seasons: number): Realm {
  let r = byeonhanMini(seed)
  for (let i = 0; i < seasons; i++) r = advance(r, [...decide(r, 'us', 'cautious'), ...aiOrders(r)]).next
  return r
}

describe('세력 AI', () => {
  it('같은 판이면 같은 명령 — 40계절 통째로 같다', () => {
    assert.deepEqual(play(77, 40), play(77, 40))
  })

  it('신중은 처음 보는 이웃을 치지 않고 정찰부터 한다', () => {
    const r = byeonhanMini(1)
    // 안야 국읍·여울목 읍락과 맞닿은 자리 (아직 아무것도 못 봤다). 국읍이 아니라 마지막 수비대 규칙도 안 걸린다
    r.armies['a-us']!.at = 'our-north'
    const o = decide(r, 'us', 'cautious')
    assert.ok(o.every((x) => x.kind !== 'march'), JSON.stringify(o))
    assert.ok(o.some((x) => x.kind === 'scout'))
  })

  it('AI 는 남의 참 군세를 몰래 읽지 않는다 — 참값을 바꿔도 명령이 같다', () => {
    const r = byeonhanMini(9)
    const before = aiOrders(r)
    // 플레이어 군대를 열 배로 부풀려도, 아무도 그것을 본 적이 없으니 AI 의 판단은 그대로여야 한다
    r.armies['a-us']!.mix = { spear: 1200, bow: 300 }
    assert.deepEqual(aiOrders(r), before)
  })

  it('명령은 언제나 제 군대 · 제 길만 가리킨다', () => {
    let r = byeonhanMini(4)
    for (let s = 0; s < 20; s++) {
      const orders = aiOrders(r)
      for (const o of orders) {
        if (o.kind !== 'march') continue
        const a = r.armies[o.army]!
        assert.notEqual(r.factions[a.faction]!.mind, 'player')
        const ed = r.edges[o.edge]!
        assert.ok(ed.a === a.at || ed.b === a.at)
      }
      r = advance(r, orders).next
    }
  })
})
