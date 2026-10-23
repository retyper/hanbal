/**
 * 백성 — 자동 분배와 개척단의 화면 (개척단 엔진은 parties.test.ts)
 *
 *  - evenShare 를 꺼냈어도 자동 분배는 그대로
 *  - 지도: 개척단의 갈 곳은 data-act="ptgo" · 개척단 길은 흙빛 점선(pplarrow)
 *  - 자동 분배는 늘 켜짐 — 옛 판의 migrateOff 는 지운다 · 배우는 판의 개척 단계는 솔뫼의 개척단 단추(.stlgo)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import { autoFlows, evenShare, homeRoom } from '../../src/realm/economy.ts'
import { partyMoves } from '../../src/realm/parties.ts'
import { migrate } from '../../src/realm/migrate.ts'
import { startTutorial } from '../../src/realm/data/regions/tutorial.ts'
import { mapHtml } from '../../src/ui/realm/mapview.ts'
import { TUT_STEPS } from '../../src/ui/realm/tutorial.ts'
import type { Realm } from '../../src/realm/types.ts'

/** 길로 맞닿은 두 제 고을이 있는 나라 하나 — (나라, 고을 a, 고을 b) */
function pairOf(r: Realm): [string, string, string] {
  for (const id of Object.keys(r.edges).sort()) {
    const ed = r.edges[id]!
    const a = r.nodes[ed.a]!
    const b = r.nodes[ed.b]!
    if (a.owner !== null && a.owner === b.owner && a.kind !== 'sodo' && b.kind !== 'sodo' && a.kind !== 'wild' && b.kind !== 'wild') return [a.owner, a.id, b.id]
  }
  throw new Error('맞닿은 제 고을 짝이 없다')
}

describe('집 보내기', () => {
  it('evenShare 를 꺼냈어도 자동 분배는 그대로 — 옛 식과 같은 값', () => {
    const r = byeonhanMini(3)
    const [f, a, b] = pairOf(r)
    r.nodes[a]!.hh = Math.round(homeRoom(r.nodes[a]!) * 1.6)
    r.nodes[b]!.hh = Math.round(homeRoom(r.nodes[b]!) * 0.3)
    const ha = r.nodes[a]!.hh
    const hb = r.nodes[b]!.hh
    const ra = homeRoom(r.nodes[a]!)
    const rb = homeRoom(r.nodes[b]!)
    assert.equal(evenShare(ha, hb, ra, rb), ha - ((ha + hb) / (ra + rb)) * ra)
    const fl = autoFlows(r, f)
    assert.ok(fl.some((x) => x.from === a && x.to === b && x.n >= 1), JSON.stringify(fl))
    assert.deepEqual(autoFlows(structuredClone(r), f), fl)
  })

  it('지도 — 개척단의 갈 곳은 data-act="ptgo" · 개척단 길은 흙빛 점선', () => {
    const r = startYeongnam(1, 'saro')
    const cap = r.factions['saro']!.capital
    const ed = Object.values(r.edges).find((e) => e.a === cap || e.b === cap)!
    const to = ed.a === cap ? ed.b : ed.a
    const h = mapHtml(r, 'saro', '/', [{ from: cap, to, left: null, people: true }], cap, null, [], [{ node: to, edge: ed.id, chip: '', off: false, on: false, act: 'ptgo' }])
    assert.ok(new RegExp(`data-act="ptgo" data-edge="${ed.id}"[^>]*data-node="${to}"`).test(h))
    assert.ok(h.includes('class="pplarrow"'))
    // 고른 고을은 흐리지 않는다
    assert.ok(!new RegExp(`class="nd[^"]* far[^"]*"[^>]*data-node="${cap}"`).test(h))
  })

  it('자동 분배는 늘 켜짐 — 옛 판의 migrateOff 를 지운다', () => {
    const r = byeonhanMini(3)
    const [f, a, b] = pairOf(r)
    r.nodes[a]!.hh = Math.round(homeRoom(r.nodes[a]!) * 1.6)
    r.nodes[b]!.hh = Math.round(homeRoom(r.nodes[b]!) * 0.3)
    r.factions[f]!.migrateOff = true
    assert.deepEqual(autoFlows(r, f), [])
    migrate(r)
    assert.equal(r.factions[f]!.migrateOff, undefined)
    assert.ok(autoFlows(r, f).length > 0)
  })

  it('배우는 판 — 개척 단계는 솔뫼의 개척단 단추를 가리킨다 · 개척단이 솔뫼로 갈 수 있다', () => {
    const st = TUT_STEPS.find((s) => s.id === 'settle')!
    assert.ok(st.press.includes('.stlgo[data-node="tut-solmoe"]'))
    const r = startTutorial(1)
    const ok = Object.values(r.nodes).some((n) => n.owner === r.player && partyMoves(r, r.player, n.id).some((m) => m.to === 'tut-solmoe' && m.found))
    assert.ok(ok)
  })
})
