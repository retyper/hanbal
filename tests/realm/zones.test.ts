/**
 * 고을 구역 (FOCUS H · 형: "국경이 줌마다 꼬이고 작으면 사라짐") — src/realm/data/zones 에 구워 둔 고을마다의 다각형.
 *  - 판마다 고을 자리·종류·길이 구운 때와 같다 (다르면 `node --experimental-strip-types tools/bake-zones.ts` 로 다시 굽는다)
 *  - 고을마다 구역이 있고, 맞닿은 변의 두 끝은 그 판의 고을이다
 *  - 지도는 구역을 주인 색으로 칠하고, 국경 굵기는 화면 px 고정(non-scaling-stroke)이다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { REGION_ART } from '../../src/realm/data/art.ts'
import { REGION_IDS, regionNations, startRegion } from '../../src/realm/data/regions/index.ts'
import { startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import { ZONES } from '../../src/realm/data/zones/index.ts'
import { mapHtml } from '../../src/ui/realm/mapview.ts'
import { canonicalRealm, zoneHash } from '../../tools/zonegeo.ts'

describe('고을 구역', () => {
  for (const region of REGION_IDS) {
    it(`${region} — 구운 구역이 지금 판과 맞고, 고을마다 구역이 있다`, () => {
      const z = ZONES[region]
      assert.ok(z !== undefined, '구역 데이터 없음')
      const r = canonicalRealm(region)
      assert.equal(z.hash, zoneHash(region, r), '고을 자리·종류·길이 바뀌었다 — tools/bake-zones.ts 로 다시 굽는다')
      assert.equal(z.w, REGION_ART[region].w)
      assert.equal(z.h, REGION_ART[region].h)
      for (const id of Object.keys(r.nodes)) {
        assert.ok((z.fill[id] ?? '').startsWith('M'), `${id} 의 구역이 없다`)
        assert.ok(z.size[id] !== undefined, `${id} 의 크기 배수가 없다`)
      }
      const pairs = new Set<string>()
      for (const [a, b, d] of z.edge) {
        assert.ok(r.nodes[a] !== undefined && (b === '' || r.nodes[b] !== undefined), `${a}–${b} 가 판에 없는 고을`)
        assert.ok(a !== b && d.startsWith('M'))
        if (b !== '') pairs.add(a < b ? `${a}|${b}` : `${b}|${a}`)
      }
      // 길로 이어진 두 고을은 대개 구역이 맞닿는다 (뱃길 · 먼 길은 바다·빈 데를 사이에 둘 수 있다)
      const land = Object.values(r.edges).filter((e) => e.kind !== 'sea')
      const touch = land.filter((e) => pairs.has(e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`)).length
      assert.ok(touch >= land.length * 0.6, `길로 이어진 고을 ${land.length} 쌍 가운데 구역이 맞닿은 것이 ${touch} 쌍뿐`)
    })
  }

  it('자유판(빈 땅이 섞인 판)도 고을마다 구운 구역을 쓴다', () => {
    for (const region of ['yeongnam', 'south'] as const) {
      const r = startRegion(region, 3, regionNations(region)[0]!)
      for (const id of Object.keys(r.nodes)) assert.ok(ZONES[region]!.fill[id] !== undefined, `${region} ${id}`)
    }
  })

  it('지도 — 국경은 화면 px 굵기, 같은 나라 고을은 한 패스로 칠한다', () => {
    const r = startYeongnam(1, 'saro')
    delete (r as { known?: unknown }).known
    const h = mapHtml(r, 'saro', '/', [], '')
    assert.ok(/<path class="nb"[^>]*vector-effect="non-scaling-stroke"/.test(h), '나라 국경의 제 빛 선')
    assert.ok(/<g class="mine-edge"><path[^>]*vector-effect="non-scaling-stroke"/.test(h), '우리 땅 둘레')
    const terr = /<g class="terr"[^>]*>((?:<path d="[^"]*" fill="[^"]*" opacity="[^"]*"\/>)*)/.exec(h)
    assert.ok(terr !== null)
    const fills = terr[1]!.match(/<path /g) ?? []
    const owners = new Set(Object.values(r.nodes).map((n) => n.owner).filter((o) => o !== null))
    assert.equal(fills.length, owners.size, '나라마다 땅빛 패스 하나')
  })
})
