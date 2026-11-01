/**
 * 지도의 땅 모양 (src/ui/realm/mapgeo.ts) — 형: "직선경로만 있는게 이상하지 않냐?" (2026-10-19)
 *
 *  - 영남 판의 길마다 미리 셈한 물길이 있고(tools/yeongnam-routes.ts), 나루 길에는 배 자리가 있다
 *  - 고을 구역은 tests/realm/zones.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { ROUTES, FERRIES } from '../../src/realm/data/regions/yeongnam-routes.ts'
import { startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import { routePoints, trimPolyline } from '../../src/ui/realm/mapgeo.ts'

describe('지도의 땅 모양', () => {
  const r = startYeongnam(1, 'saro')

  it('영남 판의 길마다 물길이 있고, 나루마다 배 자리가 있다', () => {
    for (const ed of Object.values(r.edges)) {
      assert.ok(ROUTES[ed.id] !== undefined, `물길 없음: ${ed.id}`)
      if (ed.kind === 'ford') assert.ok(FERRIES[ed.id] !== undefined, `배 자리 없음: ${ed.id}`)
      const pts = routePoints('yeongnam', ed, [0, 0], [1, 1], 1024, 765)
      assert.ok(pts.length >= 2)
      for (const [x, y] of pts) assert.ok(x >= 0 && x <= 1024 && y >= 0 && y <= 765, `${ed.id} 가 그림 밖으로 나간다`)
    }
  })

  it('화살은 길의 가운데 몫만 그린다', () => {
    const p = trimPolyline([[0, 0], [10, 0], [10, 10]], 0.25, 0.75)
    assert.deepEqual(p[0], [5, 0])
    assert.deepEqual(p[p.length - 1], [10, 5])
  })
})
