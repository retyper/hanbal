/**
 * 삼한 남부 판 · 발견 (2026-10-19 — 형: "시간지나서 발견국가가 많아지면 확장하는거지 지도도")
 *
 *  - 판이 열리고, 고을은 다 틀 안·뭍(또는 섬) 위에 있고, 길은 있는 고을끼리 잇는다 · 모든 고을이 이어진다
 *  - 나라마다 제 땅과 이웃만 알고 시작한다 · 판이 흐르면 아는 나라가 는다 · 같은 시드면 같은 발견
 *  - 발견이 없는 판(영남·옛 판)은 모두가 모두를 안다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders } from '../../src/realm/ai.ts'
import { knows } from '../../src/realm/discovery.ts'
import { onSouthLand, southPos } from '../../src/realm/data/regions/south-geo.ts'
import { SOUTH_NATION_IDS, southGeo, startSouth } from '../../src/realm/data/regions/south.ts'
import { startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import { startRealm } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { advance } from '../../src/realm/season.ts'
import type { Realm } from '../../src/realm/types.ts'
import { mapHtml, visibleNodes } from '../../src/ui/realm/mapview.ts'

describe('삼한 남부 판', () => {
  it('나라 서른여섯 · 고을은 틀 안 뭍 위 · 길은 있는 고을끼리', () => {
    const r = startSouth(1, 'baekje')
    assert.equal(SOUTH_NATION_IDS.length, 36)
    assert.equal(r.player, 'baekje')
    for (const n of Object.values(r.nodes)) {
      const ll = southGeo(n.id)
      assert.ok(ll !== undefined, `${n.id} 자리 없음`)
      const [x, y] = southPos(ll![0], ll![1])
      assert.ok(x > 0 && x < 1 && y > 0 && y < 1, `${n.id} 틀 밖`)
      assert.ok(onSouthLand(ll![0], ll![1]), `${n.id} (${ll}) 바다 위`)
    }
    for (const ed of Object.values(r.edges)) {
      assert.ok(r.nodes[ed.a] !== undefined && r.nodes[ed.b] !== undefined, `${ed.id} 끝이 없다`)
      assert.notEqual(ed.a, ed.b)
    }
    // 이어져 있다
    const seen = new Set<string>(['m-baekje-cap'])
    const q = ['m-baekje-cap']
    while (q.length > 0) {
      const c = q.shift()!
      for (const ed of Object.values(r.edges)) {
        const nx = ed.a === c ? ed.b : ed.b === c ? ed.a : null
        if (nx !== null && !seen.has(nx)) { seen.add(nx); q.push(nx) }
      }
    }
    assert.equal(seen.size, Object.keys(r.nodes).length, '떨어진 고을이 있다')
  })

  it('처음엔 이웃만 안다 — 위례(백제)는 동해 실직을 모른다', () => {
    const r = startSouth(1, 'baekje')
    assert.ok(knows(r, 'baekje', 'michuhol'))
    assert.ok(knows(r, 'baekje', 'mokji'))
    assert.ok(!knows(r, 'baekje', 'siljik'))
    assert.ok(!knows(r, 'baekje', 'guya'))
  })

  it('판이 흐르면 아는 나라가 는다 · 같은 시드면 같은 발견', () => {
    const run = (): Realm => {
      let r = startSouth(7, 'baekje')
      for (let s = 0; s < 12; s++) r = advance(r, aiOrders(r)).next
      return r
    }
    const a = run()
    const b = run()
    assert.deepEqual(a.known, b.known)
    const sum = (r: Realm): number => Object.values(r.known!).reduce((s, k) => s + k.length, 0)
    const start = sum(startSouth(7, 'baekje'))
    assert.ok(sum(a) > start + 10, `발견이 너무 적다 (${start} → ${sum(a)})`)
  })

  it('지도는 아는 나라만 그린다 — 모르는 나라의 고을·이름은 안개 밑', () => {
    const r = startSouth(1, 'baekje')
    const vis = visibleNodes(r, 'baekje')
    assert.ok(vis.has('m-baekje-cap') && vis.has('m-mokji-cap'))
    assert.ok(!vis.has('n-siljik-cap'))
    const html = mapHtml(r, 'baekje', '/', [], '')
    assert.ok(html.includes('data-node="m-baekje-cap"'))
    assert.ok(!html.includes('data-node="n-siljik-cap"'), '모르는 실직이 지도에 보인다')
    assert.ok(!html.includes(r.nodes['n-siljik-cap']!.name), '모르는 실직의 이름이 보인다')
    assert.ok(html.includes('mask="url(#rm-fog)"'))
    // 영남 판도 처음엔 이웃만 (형: "시작할땐 주변 밝혀진애들만") · 작은 판(변한)은 안개가 없다
    assert.ok(mapHtml(startYeongnam(1, 'us'), 'us', '/', [], '').includes('rm-fog'))
    assert.ok(!mapHtml(startRealm(1, 'us'), 'us', '/', [], '').includes('rm-fog'))
  })

  it('발견이 없는 판(작은 판)은 모두가 모두를 안다 · 영남 판은 이웃만 알고 시작한다', () => {
    const r = startRealm(1, 'us')
    assert.equal(r.known, undefined)
    assert.ok(Object.keys(r.factions).every((f) => knows(r, 'us', f)))
    const y = startYeongnam(1, 'us')
    assert.ok(y.known !== undefined && !Object.keys(y.factions).every((f) => knows(y, 'us', f)))
  })
})
