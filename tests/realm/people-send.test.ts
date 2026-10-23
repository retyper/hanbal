/**
 * 집 보내기 (형 2026-10-23: "백성 배치는 지금 여전히 복잡하고 어려워 … 간편하면서도 직관적이게 · 군대처럼 터치로 옮길 수 있게")
 *
 *  - 빈땅으로 보내면 새 마을(settle) — 많이는 settleLimit · 조금 ≤ 알맞게 ≤ 많이
 *  - 우리 고을로 보내면 집 나누기(migrate) — 많이는 migrateLimit
 *  - 보낼 수 없으면 null (그런 곳은 지도에서 빛나지 않는다)
 *  - evenShare 를 꺼냈어도 자동 분배는 그대로
 *  - 지도: 'pgo' 갈 곳은 data-act="pgo" · 보낸 집은 흙빛 점선(pplarrow)
 *  - 자동 분배는 늘 켜짐 — 옛 판의 migrateOff 는 지운다 · 배우는 판의 개척 단계는 「마을 세우기」(.stlgo)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import { autoFlows, evenShare, homeRoom, migrateLimit, sendAmounts, settleLimit, settleTargets } from '../../src/realm/economy.ts'
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
  it('빈땅이면 새 마을 — 많이는 settleLimit · 1 ≤ 조금 ≤ 알맞게 ≤ 많이', () => {
    const r = byeonhanMini(1)
    let checked = 0
    for (const f of Object.keys(r.factions).sort()) {
      for (const t of settleTargets(r, f)) {
        const s = sendAmounts(r, f, t.from, t.to)
        assert.ok(s !== null, `${t.from}→${t.to}`)
        assert.equal(s.kind, 'settle')
        assert.equal(s.many, settleLimit(r, f, t.from, t.to))
        assert.ok(s.few >= 1 && s.few <= s.fit && s.fit <= s.many, JSON.stringify(s))
        checked++
      }
    }
    assert.ok(checked > 0, '개척할 짝이 하나는 있다')
  })

  it('우리 고을이면 집 나누기 — 많이는 migrateLimit', () => {
    const r = byeonhanMini(3)
    const [f, a, b] = pairOf(r)
    r.nodes[a]!.hh = Math.round(homeRoom(r.nodes[a]!) * 1.6)
    r.nodes[b]!.hh = Math.round(homeRoom(r.nodes[b]!) * 0.3)
    const s = sendAmounts(r, f, a, b)
    assert.ok(s !== null)
    assert.equal(s.kind, 'migrate')
    assert.equal(s.many, migrateLimit(r, f, a, b))
    assert.ok(s.few >= 1 && s.few <= s.fit && s.fit <= s.many, JSON.stringify(s))
    // 붐빈 고을에서 한산한 고을로 — 알맞게는 두 고을 붐빔을 같게 하는 몫의 반을 넘지 않는다
    const even = evenShare(r.nodes[a]!.hh, r.nodes[b]!.hh, homeRoom(r.nodes[a]!), homeRoom(r.nodes[b]!))
    assert.ok(s.fit <= Math.max(1, Math.floor(even / 2)) || s.fit === Math.ceil(s.many / 2))
  })

  it('보낼 수 없으면 null — 남의 땅 · 제자리 · 곡식 없음', () => {
    const r = byeonhanMini(3)
    const [f, a, b] = pairOf(r)
    const foe = Object.values(r.nodes).find((n) => n.owner !== null && n.owner !== f && n.kind !== 'sodo')!
    assert.equal(sendAmounts(r, f, a, foe.id), null)
    assert.equal(sendAmounts(r, f, a, a), null)
    r.stock[f]!.grain = 0
    assert.equal(sendAmounts(r, f, a, b), null)
  })

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

  it('지도 — pgo 갈 곳은 data-act="pgo" · 보낸 집은 흙빛 점선', () => {
    const r = startYeongnam(1, 'saro')
    const cap = r.factions['saro']!.capital
    const ed = Object.values(r.edges).find((e) => e.a === cap || e.b === cap)!
    const to = ed.a === cap ? ed.b : ed.a
    const h = mapHtml(r, 'saro', '/', [{ from: cap, to, left: null, people: true }], cap, null, [], [{ node: to, edge: '', chip: '', off: false, on: false, act: 'pgo' }])
    assert.ok(new RegExp(`data-act="pgo" data-edge=""[^>]*data-node="${to}"`).test(h))
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

  it('배우는 판 — 개척 단계는 솔뫼의 「마을 세우기」를 가리킨다 · 솔뫼로 보낼 수 있다', () => {
    const st = TUT_STEPS.find((s) => s.id === 'settle')!
    assert.ok(st.press.includes('.stlgo[data-node="tut-solmoe"]'))
    const r = startTutorial(1)
    const t = settleTargets(r, r.player).find((x) => x.to === 'tut-solmoe')
    assert.ok(t !== undefined)
    const s = sendAmounts(r, r.player, t.from, t.to)
    assert.ok(s !== null && s.kind === 'settle' && s.fit >= 1)
  })
})
