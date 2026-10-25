/**
 * 나라의 두 빛 — 축구팀 유니폼처럼 바탕 빛 + 둘째 빛 (ui/realm/kitcolor.ts · data/art.ts FACTION_ART)
 * 형 10-26: "적국 수가 막 7개 넘어가는 상황에서는 어느 나라가 어느 나라인지 전혀 구분이 안 가 … 비슷한 나라들에 색이 겹치면 두 번째 컬러"
 *
 *  - 판마다 같이 서는 두 나라: 바탕 빛이 멀거나(kitMainFar), 바탕이 가까우면 둘째 빛이 멀다(kitSecondFar)
 *  - 한 나라의 띠는 제 바탕에 묻히지 않는다(kitSelfFar)
 *  - 바탕 위 글씨는 읽힌다 (WCAG 대비 4 이상)
 *  - 고을 이름표는 주인의 두 빛을 입는다 · 빈땅은 빛이 없다
 *
 * 겹치면 tools/kit-colors.ts 가 둘째 빛 후보를 말한다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { FACTION_ART } from '../../src/realm/data/art.ts'
import { REGION_IDS, regionNations, startRegion } from '../../src/realm/data/regions/index.ts'
import { startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import { deltaE, inkOn, kitClash, kitSelfClash, luminance, nationKit } from '../../src/ui/realm/kitcolor.ts'
import { mapHtml } from '../../src/ui/realm/mapview.ts'

const contrast = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

describe('나라의 두 빛', () => {
  it('ΔE — 같은 빛은 0 · 흰빛과 먹빛은 100 가까이', () => {
    assert.equal(deltaE('#7a8a3a', '#7a8a3a'), 0)
    assert.ok(deltaE('#ffffff', '#000000') > 99)
  })

  for (const region of REGION_IDS) {
    it(`${region} — 같이 서는 나라끼리 옷이 겹치지 않는다`, () => {
      const ids = Object.keys(startRegion(region, 1, regionNations(region)[0]!).factions)
      const bad: string[] = []
      for (const a of ids) {
        const s = kitSelfClash(a)
        if (s !== null) bad.push(s)
      }
      for (const [i, a] of ids.entries()) for (const b of ids.slice(i + 1)) {
        const s = kitClash(a, b)
        if (s !== null) bad.push(s)
      }
      assert.deepEqual(bad, [], 'tools/kit-colors.ts 로 둘째 빛 후보를 본다')
    })
  }

  it('바탕 위 글씨가 읽힌다', () => {
    for (const [f, a] of Object.entries(FACTION_ART)) {
      assert.ok(contrast(a.color, inkOn(a.color)) >= 4, `${f} ${a.color} 위 글씨 대비 ${contrast(a.color, inkOn(a.color)).toFixed(2)}`)
    }
  })

  it('고을 이름표가 주인의 두 빛을 입는다 · 빈땅은 빛이 없다', () => {
    const r = startYeongnam(1, 'saro')
    const h = mapHtml(r, 'saro', '/', [], '')
    const label = (id: string): string | undefined => new RegExp(`<span class="lb[^"]*" data-n="${id}" style="([^"]*)"`).exec(h)?.[1]
    // 보이는 남의 고을 하나 — 그 주인의 두 빛
    const other = Object.values(r.nodes).find((n) => n.owner !== null && n.owner !== 'saro' && n.kind !== 'sodo' && label(n.id) !== undefined)
    assert.ok(other !== undefined, '보이는 남의 고을')
    const k = nationKit(other.owner)
    const st = label(other.id)!
    assert.ok(st.includes(`--c:${k.c}`) && st.includes(`--c2:${k.c2}`) && st.includes(`--ink:${k.ink}`), st)
    for (const n of Object.values(r.nodes)) {
      const w = n.owner === null ? label(n.id) : undefined
      if (w !== undefined) assert.ok(!w.includes('--c2'), `빈땅 ${n.id} 이름표는 띠가 없다`)
    }
  })
})
