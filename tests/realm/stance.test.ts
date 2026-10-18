/**
 * 속셈 (src/realm/stance.ts) — 형: "모든 국가들을 승리를 목적으로 행동하니까 · 좀 근거가 있게 움직여야해" (2026-10-18)
 *
 *  - 화친을 맺으면 서로의 땅으로 가던 군대가 돌아선다 — 맺자마자 다시 전쟁이 되지 않는다
 *  - 이기고 있는 나라는 화친할 까닭이 없다 · 밀리는 나라는 있다
 *  - 플레이어에게 거는 화친 청에는 까닭이 붙는다
 *  - 앞서가는 나라와는 약조를 깰 까닭이 생긴다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { makeAsks, pairKey, relationOf } from '../../src/realm/diplomacy.ts'
import { advance, nodeStrength, planned } from '../../src/realm/season.ts'
import { breakWhy, leaderOf, noteTake, truceWhy, winningAgainst } from '../../src/realm/stance.ts'
import type { Realm, ReportLine } from '../../src/realm/types.ts'

const fresh = (seed = 1): Realm => planned(byeonhanMini(seed), [])

/** `viewer` 가 `faction` 의 고을 군세를 방금 정찰해 안다 */
function know(r: Realm, viewer: string, faction: string): void {
  for (const n of Object.values(r.nodes)) {
    if (n.owner !== faction) continue
    ;(r.intel[viewer] ??= {})[n.id] = { land: true, force: { f0: nodeStrength(r, n.id, faction), src: 'scout', u: 0, season: r.season }, alert: null }
  }
}

describe('속셈', () => {
  it('화친 청을 받으면 우리 땅으로 오던 군대가 돌아서고, 다음 계절에도 화친이다', () => {
    const r = fresh()
    r.relations[pairKey('us', 'guya')] = { state: 'war', until: null }
    // 구야 군대가 봉황 마을에서 갯벌 길로 갈대울 마을에 오고 있다
    const g = r.armies['a-guya-1']!
    g.at = 'guya-vil'
    g.march = { from: 'guya-vil', to: 'our-east', edge: 'e09', left: 1, ambush: false }
    r.asks = [{ id: 'ask:t', from: 'guya', to: 'us', kind: 'truce', give: { grain: 0, iron: 0 }, take: { grain: 0, iron: 0 }, until: r.season }]
    const { next, report } = advance(r, [{ kind: 'answer', ask: 'ask:t', yes: true }])
    assert.equal(relationOf(next, 'us', 'guya').state, 'truce')
    assert.ok(report.lines.some((l) => l.kind === 'recall' && l.army === 'a-guya-1'))
    assert.ok(!report.lines.some((l) => l.kind === 'battle'), '화친을 맺은 계절에 싸웠다')
    assert.equal(next.nodes['our-east']!.owner, 'us')
    const after = advance(next, []).next
    assert.equal(relationOf(after, 'us', 'guya').state, 'truce')
    assert.equal(after.armies['a-guya-1']!.at, 'guya-vil')
  })

  it('이기고 있는 나라는 화친할 까닭이 없다 · 밀리는 나라는 있다', () => {
    const r = fresh()
    r.relations[pairKey('us', 'guya')] = { state: 'war', until: null }
    noteTake(r, 'guya', 'us')
    know(r, 'guya', 'us')
    know(r, 'us', 'guya')
    // 구야는 우리보다 세고 방금 땅을 앗았다
    assert.equal(winningAgainst(r, 'guya', 'us'), true)
    assert.equal(truceWhy(r, 'guya', 'us'), null)
    // 우리는 밀린다 — 화친할 까닭이 있다

    assert.equal(truceWhy(r, 'us', 'guya')?.why, 'losing')
  })

  it('플레이어에게 오는 화친 청에는 까닭이 붙는다', () => {
    for (let seed = 1; seed < 400; seed++) {
      const r = fresh(seed)
      const fs = ['us', 'guya', 'anya', 'miri', 'goja', 'dokro']
      for (const x of fs) for (const y of fs) if (x < y) r.relations[pairKey(x, y)] = { state: 'war', until: null }
      const lines: ReportLine[] = []
      makeAsks(r, lines)
      const truce = (r.asks ?? []).find((a) => a.kind === 'truce')
      if (truce === undefined) continue
      assert.ok(truce.why !== undefined, '까닭 없는 화친 청')
      assert.ok(truceWhy(r, truce.from, 'us') !== null)
      return
    }
    assert.fail('400 시드 안에 화친 청이 한 번도 없었다')
  })

  it('도읍 둘을 쥔 나라는 앞서가는 나라 — 그와 맺은 약조를 깰 까닭이 생긴다', () => {
    const r = fresh()
    r.nodes['goja-cap']!.owner = 'guya'
    assert.equal(leaderOf(r, 'anya'), 'guya')
    know(r, 'anya', 'guya')
    r.relations[pairKey('anya', 'guya')] = { state: 'ally', until: null }
    assert.equal(breakWhy(r, 'anya', 'guya')?.why, 'tooBig')
    // 앞서가지 않으면 깰 까닭이 없다 (안야는 신중하다 — 만만함으로는 안 깬다)
    r.nodes['goja-cap']!.owner = 'goja'
    assert.equal(breakWhy(r, 'anya', 'guya'), null)
  })
})
