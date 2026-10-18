/**
 * AI 별동대 (ai.moves raid) — 큰 군대는 숨지 못한다. 칠 데를 못 찾은 군대는 작은 무리만 떼어
 * 숨기 좋은 길로 성 뒤 고을을 기습하거나 지키는 이 없는 마을을 줍는다 (2026-10-18, 봇 대전: AI 기습이 판에 한두 번이었다)
 *
 *  - 갈대 물가(갈대울 → 여울목)로 목책 두른 마을을 노릴 때 — 정면으론 모자란 군대가 작은 무리만 떼어 기습으로 보낸다
 *    (장수 없는 무리로는 숨어 닿기 어려우면 장수가 이끈다 — 기습은 지략을 탄다)
 *  - 별동대는 ambushFreeMen 을 넘지 않고 splitMin 은 넘는다
 *  - 도읍은 별동대로 노리지 않는다 (도읍 하나뿐인 나라가 작은 무리에 무너졌다)
 *  - 같은 판이면 같은 명령 (결정론)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { decide } from '../../src/realm/ai.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { pairKey } from '../../src/realm/diplomacy.ts'
import { nodeStrength, planned } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, Realm } from '../../src/realm/types.ts'

/** 봄 · 가락(guya)과 추화(miri)가 싸운다 · 가락의 작은 군대가 갈대울에 · 목책 두른 여울목을 방금 정찰했다 · 추화 군대는 도읍에 */
function setup(target: 'miri-vil' | 'miri-cap' = 'miri-vil'): Realm {
  const r = planned(byeonhanMini(1), [])
  r.season = Math.ceil((P.realm.aiGrace + 1) / 4) * 4
  r.relations[pairKey('guya', 'miri')] = { state: 'war', until: null }
  r.nodes['our-east'] = { ...r.nodes['our-east']!, owner: 'guya' }
  r.nodes['miri-vil'] = { ...r.nodes['miri-vil']!, tags: [...r.nodes['miri-vil']!.tags, 'palisade'] }
  const a = r.armies['a-guya-2']!
  a.at = 'our-east'
  a.mix = { spear: 82, bow: 38 } // 정면으론 모자라다 (목책·장정)
  delete (a as { kit?: unknown }).kit
  for (const x of Object.values(r.armies)) if (x.faction === 'miri') x.at = target === 'miri-vil' ? 'miri-cap' : 'miri-vil'
  ;(r.intel['guya'] ??= {})[target] = { land: true, force: { f0: nodeStrength(r, target, 'miri'), src: 'scout', u: 0.5, season: r.season }, alert: null }
  return r
}

const splitOf = (os: readonly Order[], army: string): Extract<Order, { kind: 'split' }> | undefined =>
  os.find((o): o is Extract<Order, { kind: 'split' }> => o.kind === 'split' && o.army === army)

describe('AI 별동대', () => {
  it('갈대 물가로 목책 마을을 — 작은 무리가 기습으로 간다, 나머지는 남는다', () => {
    const os = decide(setup(), 'guya', 'cautious')
    const sp = splitOf(os, 'a-guya-2')
    assert.ok(sp !== undefined, `별동대가 안 떠났다: ${JSON.stringify(os.filter((o) => o.kind === 'march' || o.kind === 'split'))}`)
    const n = Object.values(sp.take).reduce((s, v) => s + (v ?? 0), 0)
    assert.ok(n <= P.realm.ambushFreeMen && n >= P.realm.splitMin, `별동대 ${n}명`)
    const m = os.find((o): o is Extract<Order, { kind: 'march' }> => o.kind === 'march' && o.army === sp.id)
    assert.ok(m !== undefined && m.ambush === true && m.edge === 'e08', JSON.stringify(m))
    assert.ok(!os.some((o) => o.kind === 'march' && o.army === 'a-guya-2'), '나머지도 떠났다')
  })

  it('도읍은 별동대로 노리지 않는다', () => {
    const r = setup('miri-cap')
    // 철광에서 숲길로 추화 도읍을 — 정면으론 모자라고 기습이면 될 법해도 별동대는 안 간다
    const a = r.armies['a-guya-2']!
    a.at = 'guya-iron'
    r.season += 3 // 겨울 숲길
    const os = decide(r, 'guya', 'cautious')
    const sp = splitOf(os, 'a-guya-2')
    const m = sp !== undefined ? os.find((o) => o.kind === 'march' && o.army === sp.id) : undefined
    assert.ok(m === undefined || (m as Extract<Order, { kind: 'march' }>).edge !== 'e14', JSON.stringify(os))
  })

  it('같은 판이면 같은 명령', () => {
    assert.deepEqual(decide(setup(), 'guya', 'cautious'), decide(setup(), 'guya', 'cautious'))
  })
})
