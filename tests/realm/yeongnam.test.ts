/**
 * 영남 판 (data/regions/yeongnam.ts) — 스물한 나라 · 실제 경위도 자리
 *
 *  - 판이 열리고, 나라마다 도읍·군주가 있다 · 고를 수 있는 나라 = 고르기 글의 나라
 *  - 고을은 모두 지도 그림 안에 있고, 밑그림(tools/yeongnam-sketch.js)의 뭍이나 섬 위에 있다
 *  - 길은 있는 고을끼리만 · id 는 겹치지 않는다 · 모든 고을이 길로 이어진다
 *  - 같은 시드면 같은 판 (결정론)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders, decide } from '../../src/realm/ai.ts'
import { NODE_POS } from '../../src/realm/data/art.ts'
import { YEONGNAM_NATIONS } from '../../src/realm/data/nations-yeongnam.ts'
import { NODE_NOW } from '../../src/realm/data/prose.ts'
import { regionOf, startRegion } from '../../src/realm/data/regions/index.ts'
import { GEO, YEONGNAM_NATION_IDS, startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import { advance, checkOutcome } from '../../src/realm/season.ts'
import type { Realm } from '../../src/realm/types.ts'

/** 밑그림의 뭍·섬 — tools/yeongnam-sketch.js 의 LAND · ISLES 와 같다 [경도, 위도] */
const LAND: Array<[number, number]> = [
  [127.2, 36.7], [129.42, 36.7], [129.43, 36.4], [129.42, 36.2], [129.41, 36.1], [129.36, 36.02], [129.45, 36.0], [129.57, 36.08],
  [129.5, 35.95], [129.46, 35.8], [129.47, 35.65], [129.42, 35.52], [129.36, 35.48], [129.35, 35.36], [129.26, 35.25], [129.17, 35.16],
  [129.08, 35.08], [128.99, 35.05], [128.95, 35.09], [128.86, 35.07], [128.76, 35.08], [128.7, 35.13], [128.6, 35.19], [128.56, 35.1],
  [128.46, 35.03], [128.43, 34.92], [128.34, 34.95], [128.26, 34.93], [128.17, 34.94], [128.08, 35.02], [127.99, 34.96], [127.88, 34.96],
  [127.78, 34.98], [127.7, 34.95], [127.6, 34.93], [127.45, 34.86], [127.2, 34.86],
]
const ISLES: Array<Array<[number, number]>> = [
  [[128.47, 35.0], [128.62, 35.03], [128.73, 34.95], [128.7, 34.82], [128.6, 34.72], [128.52, 34.8], [128.45, 34.9]],
  [[127.82, 34.9], [127.95, 34.93], [128.06, 34.85], [128.02, 34.72], [127.88, 34.7], [127.8, 34.78]],
]

function inside(pt: readonly [number, number], poly: ReadonlyArray<readonly [number, number]>): boolean {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!
    const [xj, yj] = poly[j]!
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

describe('영남 판', () => {
  const r = startYeongnam(7, 'us')

  it('스물한 나라 — 도읍·군주가 있고 고르기 글과 같다', () => {
    assert.equal(Object.keys(r.factions).length, 21)
    assert.deepEqual([...YEONGNAM_NATION_IDS].sort(), YEONGNAM_NATIONS.map((n) => n.id).sort())
    for (const f of Object.values(r.factions)) {
      assert.equal(r.nodes[f.capital]?.owner, f.id, `${f.id} 의 도읍`)
      assert.ok(r.heroes[f.ruler!] !== undefined, `${f.id} 의 군주`)
    }
    assert.equal(regionOf(r), 'yeongnam')
    assert.equal(regionOf(startRegion('byeonhan-mini', 7, 'us')), 'byeonhan-mini')
    assert.equal(checkOutcome(r), null)
  })

  it('고을은 지도 그림 안, 밑그림의 뭍이나 섬 위에 있다 · 지금 지명이 있다', () => {
    for (const id of Object.keys(r.nodes)) {
      const ll = GEO[id]
      assert.ok(ll !== undefined, `${id} 의 경위도`)
      const p = NODE_POS[id]!
      assert.ok(p[0] > 0.02 && p[0] < 0.98 && p[1] > 0.02 && p[1] < 0.98, `${id} 가 그림 밖`)
      assert.ok(inside(ll, LAND) || ISLES.some((poly) => inside(ll, poly)), `${id} 가 바다 위`)
      assert.ok(NODE_NOW[id] !== undefined, `${id} 의 지금 지명`)
    }
  })

  it('길은 있는 고을끼리 · id 는 겹치지 않고 · 모든 고을이 이어진다', () => {
    const ids = new Set<string>()
    for (const ed of Object.values(r.edges)) {
      assert.ok(r.nodes[ed.a] !== undefined && r.nodes[ed.b] !== undefined, ed.id)
      assert.notEqual(ed.a, ed.b)
      const key = [ed.a, ed.b].sort().join('|')
      assert.ok(!ids.has(key), `겹친 길 ${key}`)
      ids.add(key)
    }
    const seen = new Set<string>(['y-us-cap'])
    const queue = ['y-us-cap']
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const ed of Object.values(r.edges)) {
        const nx = ed.a === cur ? ed.b : ed.b === cur ? ed.a : null
        if (nx !== null && !seen.has(nx)) {
          seen.add(nx)
          queue.push(nx)
        }
      }
    }
    assert.equal(seen.size, Object.keys(r.nodes).length)
  })

  it('같은 시드면 같은 판 — 여섯 계절', () => {
    const run = (): Realm => {
      let x = startYeongnam(11, 'saro')
      for (let s = 0; s < 6; s++) x = advance(x, [...decide(x, x.player, 'planner'), ...aiOrders(x)]).next
      return x
    }
    assert.deepEqual(run(), run())
  })
})
