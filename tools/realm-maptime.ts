/**
 * 지도 그리기 시간 — mapHtml 한 번이 얼마나 걸리나 (판마다 첫 번 · 이어서 평균). 지도 겉모습을 바꿀 때 전후 비교용.
 *   node --experimental-strip-types tools/realm-maptime.ts
 */
import { regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import { mapHtml } from '../src/ui/realm/mapview.ts'
import type { RegionId } from '../src/realm/types.ts'

for (const region of ['tutorial', 'byeonhan-mini', 'yeongnam', 'south', 'world'] as RegionId[]) {
  const ns = regionNations(region)
  const r = startRegion(region, 1, ns[0]!)
  const me = r.player
  let t0 = performance.now()
  let html = mapHtml(r, me, '/', [], '')
  const first = performance.now() - t0
  t0 = performance.now()
  const N = 20
  for (let i = 0; i < N; i++) html = mapHtml(r, me, '/', [], '')
  const avg = (performance.now() - t0) / N
  console.log(`${region.padEnd(14)} 첫 ${first.toFixed(1)}ms · 이어서 ${avg.toFixed(2)}ms · ${(html.length / 1024).toFixed(0)}KB`)
}
