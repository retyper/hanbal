/**
 * 길이 꼬이지 않는다 (src/ui/realm/roadlayout.ts — 형 10-27: "길도 꼬이지 않게 해 줘")
 *
 *  - 고을 밖에서 두 길이 엇갈리지 않는다
 *  - 판(어느 고을끼리 잇나)은 그대로 — 길 모양의 두 끝은 제 두 고을 자리다
 * 금과 길의 엇갈림까지 판마다 낱낱이 재는 것은 tools/realm-tangle.ts.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { regionNations, startRegion } from '../../src/realm/data/regions/index.ts'
import type { RegionId } from '../../src/realm/types.ts'
import { curvePts } from '../../src/ui/realm/mapgeo.ts'
import { boardRoutes, boardTowns, crossCount, roadScale } from '../../src/ui/realm/roadlayout.ts'

describe('길이 꼬이지 않는다', () => {
  for (const region of ['yeongnam', 'byeonhan-mini', 'mahan'] as RegionId[]) {
    it(`${region} — 길끼리 고을 밖에서 엇갈리지 않고, 두 끝은 제 고을이다`, () => {
      const r = startRegion(region, 1, regionNations(region)[0]!)
      const routes = boardRoutes(r)
      const { towns } = boardTowns(r)
      const at = new Map(towns.map((t) => [t.id, t.p] as const))
      const { hub } = roadScale(region)
      const edges = Object.values(r.edges).sort((x, y) => (x.id < y.id ? -1 : 1))
      const curve = edges.map((ed) => curvePts(routes.get(ed.id)!, 8))
      for (const [i, ed] of edges.entries()) {
        const p = routes.get(ed.id)!
        const near = (q: readonly number[], t: readonly number[]): boolean => Math.hypot(q[0]! - t[0]!, q[1]! - t[1]!) < 0.5
        assert.ok(near(p[0]!, at.get(ed.a)!), `${ed.id} 의 앞 끝`)
        assert.ok(near(p[p.length - 1]!, at.get(ed.b)!), `${ed.id} 의 뒤 끝`)
        for (let j = i + 1; j < edges.length; j++) {
          const o = edges[j]!
          const shared = [ed.a, ed.b].filter((x) => x === o.a || x === o.b).map((x) => at.get(x)!)
          assert.equal(crossCount(curve[i]!, curve[j]!, shared, hub), 0, `${ed.id} ✕ ${o.id}`)
        }
      }
    })
  }
})
