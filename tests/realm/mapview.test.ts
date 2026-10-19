/**
 * 지도 겉모습 (형 2026-10-19: "마을이나 강조 영역이나 이런게 너무 짜침 … 기존게임들중에 이런거 잘한것들 … 갖다써" — docs/GAP.md M1~M5)
 *  - 고을 배너: 이름 · 주인 깃발 · 나라 색 띠가 한 덩어리 · 도읍은 k-cap · 우리 고을은 me · 깃대는 따로 없다
 *  - 나라 땅: 안쪽 띠(그 나라 땅으로 잘라 낸 굵은 둘레)
 *  - 군대를 고르면 갈 수 없는 고을은 흐리고(far), 갈 길은 빛난다(mvglow)
 *  - 우리 고을로 오는 적: 그 고을은 threat · 그 화살은 깜빡(thrarrow)
 *  - 길 위의 말은 가는 쪽(dir)과 병력 막대(hp)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import { mapHtml, type MapTarget, type MapToken } from '../../src/ui/realm/mapview.ts'

describe('지도 겉모습', () => {
  it('고을 배너 — 깃발과 나라 색이 이름과 한 덩어리 · 도읍과 우리 고을이 구별된다', () => {
    const r = startYeongnam(1, 'saro')
    const h = mapHtml(r, 'saro', '/', [], '')
    const cap = r.factions['saro']!.capital
    const lb = new RegExp(`<span class="lb([^"]*)" data-n="${cap}"[^>]*--c:[^>]*><img class="lbe"`)
    const m = lb.exec(h)
    assert.ok(m !== null, '우리 도읍 배너에 깃발')
    assert.ok(m[1]!.includes('k-cap') && m[1]!.includes(' me'))
    assert.ok(!h.includes('class="flag'), '깃대는 배너로 옮겼다')
    assert.ok(h.includes('clip-path="url(#rm-own-saro)"'), '우리 땅의 안쪽 띠')
  })

  it('군대를 고르면 갈 곳만 또렷 · 갈 길이 빛난다', () => {
    const r = startYeongnam(1, 'saro')
    const a = Object.values(r.armies).find((x) => x.faction === 'saro')!
    const ed = Object.values(r.edges).find((e) => e.a === a.at || e.b === a.at)!
    const to = ed.a === a.at ? ed.b : ed.a
    const targets: MapTarget[] = [{ node: to, edge: ed.id, chip: '', off: false, on: false }, { node: a.at, edge: '', chip: '', off: false, on: true }]
    const h = mapHtml(r, 'saro', '/', [], '', null, [], targets)
    assert.ok(h.includes('class="mvglow"'))
    const far = Object.values(r.nodes).find((n) => n.id !== to && n.id !== a.at)!
    assert.ok(new RegExp(`class="nd[^"]* far[^"]*"[^>]*data-node="${far.id}"`).test(h))
    assert.ok(!new RegExp(`class="nd[^"]* far[^"]*"[^>]*data-node="${to}"`).test(h))
  })

  it('우리 고을로 오는 적 — 고을에 붉은 고리 · 화살이 깜빡', () => {
    const r = startYeongnam(1, 'saro')
    const cap = r.factions['saro']!.capital
    const from = Object.values(r.edges).map((e) => (e.a === cap ? e.b : e.b === cap ? e.a : null)).find((x) => x !== null)!
    const h = mapHtml(r, 'saro', '/', [{ from, to: cap, left: 1, foe: true }], '')
    assert.ok(new RegExp(`class="nd[^"]* threat[^"]*"[^>]*data-node="${cap}"`).test(h))
    assert.ok(h.includes('class="thrarrow"'))
  })

  it('길 위의 말 — 가는 쪽과 병력 막대', () => {
    const r = startYeongnam(1, 'saro')
    const cap = r.factions['saro']!.capital
    const ed = Object.values(r.edges).find((e) => e.a === cap || e.b === cap)!
    const to = ed.a === cap ? ed.b : ed.a
    const toks: MapToken[] = [
      { army: 'x', node: cap, men: 100, img: '/a.png', sel: false, going: false, march: { from: cap, to } },
      { army: 'y', node: cap, men: 400, img: '/b.png', sel: false, going: false },
    ]
    const h = mapHtml(r, 'saro', '/', [], '', null, toks)
    assert.ok(/<i class="dir" style="--a:-?\d+deg"><\/i>/.test(h))
    assert.ok(h.includes('class="hp" style="--p:0.25"') && h.includes('class="hp" style="--p:1.00"'))
  })
})
