/**
 * 삼한과 북녘 판 (2026-10-19 — 형: "고구려도 엄연한 우리역사면서 … 꼭 넣어야함")
 *
 *  - 나라 쉰 · 고을은 틀 안 뭍(또는 섬) 위 · 길은 있는 고을끼리 · id 가 겹치지 않는다 · 모든 고을이 이어진다
 *  - 나라마다 근거(source)가 있다 · 낙랑·대방은 나라로도 고을로도 없다 (WORLD §5 규칙 0)
 *  - 발견은 남부 판처럼 — 국내성(고구려)은 처음에 탐라·사로를 모른다
 *  - 단궁: 동예 나라와 손잡으면 자객의 활이 싸게 오른다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { WORLD_NATIONS } from '../../src/realm/data/nations-world.ts'
import { WORLD_GEO } from '../../src/realm/data/regions/world-geo.ts'
import { WORLD_DATA, WORLD_NATION_IDS, startWorld, worldGeo } from '../../src/realm/data/regions/world.ts'
import { pairKey } from '../../src/realm/diplomacy.ts'
import { knows, stepSight } from '../../src/realm/discovery.ts'
import type { ReportLine } from '../../src/realm/types.ts'
import { bowUpCost } from '../../src/realm/plots.ts'
import { advance } from '../../src/realm/season.ts'
import { aiOrders } from '../../src/realm/ai.ts'
import { FACTION_ART, nodePos } from '../../src/realm/data/art.ts'
import { mapHtml } from '../../src/ui/realm/mapview.ts'

describe('삼한과 북녘 판', () => {
  it('나라 쉰 · 고을은 틀 안 뭍 위 · 길은 있는 고을끼리 · id 가 안 겹친다', () => {
    const r = startWorld(1, 'goguryeo')
    assert.equal(WORLD_NATION_IDS.length, 52)
    assert.ok(Object.values(r.nodes).some((n) => n.name === '독도'), '독도가 판에 있다')
    assert.equal(r.player, 'goguryeo')
    assert.equal(r.region, 'world')
    for (const xs of [WORLD_DATA.NODES, WORLD_DATA.EDGES, WORLD_DATA.HEROES, WORLD_DATA.ARMIES]) {
      const ids = xs.map((x) => x.id)
      assert.equal(new Set(ids).size, ids.length, `겹친 id: ${ids.filter((x, i) => ids.indexOf(x) !== i)}`)
    }
    for (const n of Object.values(r.nodes)) {
      const ll = worldGeo(n.id)
      assert.ok(ll !== undefined, `${n.id} 자리 없음`)
      const [x, y] = WORLD_GEO.pos(ll![0], ll![1])
      assert.ok(x > 0 && x < 1 && y > 0 && y < 1, `${n.id} 틀 밖`)
      assert.ok(WORLD_GEO.onLand(ll![0], ll![1]), `${n.id} (${ll}) 바다 위`)
      assert.ok(nodePos('world', n.id) !== undefined)
    }
    for (const ed of Object.values(r.edges)) {
      assert.ok(r.nodes[ed.a] !== undefined && r.nodes[ed.b] !== undefined, `${ed.id} 끝이 없다`)
      assert.notEqual(ed.a, ed.b)
    }
    const seen = new Set<string>(['g-gungnae-cap'])
    const q = ['g-gungnae-cap']
    while (q.length > 0) {
      const c = q.shift()!
      for (const ed of Object.values(r.edges)) {
        const nx = ed.a === c ? ed.b : ed.b === c ? ed.a : null
        if (nx !== null && !seen.has(nx)) { seen.add(nx); q.push(nx) }
      }
    }
    assert.equal(seen.size, Object.keys(r.nodes).length, '떨어진 고을이 있다')
    // 나라마다 군주 · 도읍 · 깃발 · 고르기 글(근거)
    for (const f of Object.values(r.factions)) {
      assert.equal(r.nodes[f.capital]?.owner, f.id, `${f.id} 도읍이 제 것이 아니다`)
      assert.ok(r.heroes[`${f.id}-ruler`] !== undefined, `${f.id} 군주 없음`)
      assert.ok(FACTION_ART[f.id] !== undefined, `${f.id} 깃발 없음`)
      const info = WORLD_NATIONS.find((x) => x.id === f.id)
      assert.ok(info !== undefined && info.source.length > 10, `${f.id} 근거 없음`)
    }
  })

  it('낙랑·대방은 나라로도 고을로도 그리지 않는다 (WORLD §5 규칙 0)', () => {
    const r = startWorld(1, 'goguryeo')
    const bad = /낙랑|대방|nangnang|daebang|lelang/i
    for (const f of Object.values(r.factions)) assert.ok(!bad.test(f.id) && !bad.test(f.name), f.id)
    for (const n of Object.values(r.nodes)) assert.ok(!bad.test(n.id) && !bad.test(n.name), n.id)
    // 대동강의 들은 임자 없는 빈땅
    assert.equal(r.nodes['w-daedong']?.owner, null)
  })

  it('처음엔 이웃만 안다 — 국내성은 탐라·사로를 모른다 · 지도는 안개', () => {
    const r = startWorld(1, 'goguryeo')
    assert.ok(knows(r, 'goguryeo', 'biryuna'))
    assert.ok(knows(r, 'goguryeo', 'gwanna'))
    assert.ok(!knows(r, 'goguryeo', 'tamna'))
    assert.ok(!knows(r, 'goguryeo', 'saro'))
    const html = mapHtml(r, 'goguryeo', '/', [], '')
    assert.ok(html.includes('data-node="g-gungnae-cap"'))
    assert.ok(!html.includes('data-node="t-tamna-cap"'))
    assert.ok(html.includes('mask="url(#rm-fog)"'))
  })

  it('지도는 본 만큼 — 아는 나라라도 못 본 고을은 안 그린다 · 이름만 들은 나라는 먹점 · 사신이 오간 길은 열린다', () => {
    const r = startWorld(1, 'goguryeo')
    // 알지만 못 본 나라 — 땅은 안 그리고 도읍 언저리에 소문만
    r.known!['goguryeo']!.push('tamna')
    const html = mapHtml(r, 'goguryeo', '/', [], '')
    assert.ok(!html.includes('data-node="t-tamna-cap"'))
    assert.ok(html.includes('class="rumor"') && html.includes('탐라'))
    assert.ok(!html.includes('모르는 땅'))
    // 사신이 다녀오면 도읍에서 도읍까지 길의 고을이 보인다
    const far = Object.values(r.nodes).find((n) => n.owner === 'buyeo' && n.kind === 'capital')!
    assert.ok(r.intel['goguryeo']![far.id]?.land !== true)
    const lines: ReportLine[] = [{ kind: 'envoy', from: 'goguryeo', to: 'buyeo', ask: 'truce', accepted: false }]
    stepSight(r, lines)
    assert.equal(r.intel['goguryeo']![far.id]?.land, true)
    assert.ok(knows(r, 'goguryeo', 'buyeo'))
  })

  it('판이 흐른다 — 같은 시드면 같은 판', () => {
    const run = (): string => {
      let r = startWorld(3, 'buyeo')
      for (let s = 0; s < 6; s++) r = advance(r, aiOrders(r)).next
      return JSON.stringify(r)
    }
    assert.equal(run(), run())
  })

  it('단궁 — 동예(불내)와 손잡으면 자객의 활이 싸게 오른다', () => {
    const r = startWorld(1, 'goguryeo')
    const plain = bowUpCost(r, 'goguryeo')!
    r.relations = { ...r.relations, [pairKey('goguryeo', 'bullae')]: { state: 'ally', until: null } }
    const cheap = bowUpCost(r, 'goguryeo')!
    assert.ok(cheap.grain < plain.grain && cheap.iron < plain.iron, `${JSON.stringify(plain)} → ${JSON.stringify(cheap)}`)
    assert.ok(bowUpCost(r, 'bullae')!.grain < plain.grain, '동예 나라는 제 활이 싸다')
  })
})
