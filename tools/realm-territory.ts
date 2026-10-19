/**
 * 땅 가르기(territory.ts) 재기 — 판마다 처음 한 번 셈하는 데 걸리는 때와, 땅을 못 받은 고을 수.
 *
 *   node --experimental-strip-types tools/realm-territory.ts
 */
import { REGION_ART, nodePos } from '../src/realm/data/art.ts'
import { regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import type { NodeKind, RegionId } from '../src/realm/types.ts'
import { naturalLines } from '../src/ui/realm/mapgeo.ts'
import { territory } from '../src/ui/realm/territory.ts'

const SIZE: Readonly<Record<NodeKind, number>> = { capital: 1.3, port: 1.1, fort: 0.95, village: 1, ironMine: 0.9, wild: 0.85, sodo: 0.7 }
for (const region of ['byeonhan-mini', 'yeongnam', 'south', 'world'] as RegionId[]) {
  const r = startRegion(region, 1, regionNations(region)[0]!)
  const RA = REGION_ART[region]
  const nodes = Object.values(r.nodes).sort((x, y) => (x.id < y.id ? -1 : 1))
  const t0 = performance.now()
  const nat = naturalLines(region, RA.w, RA.h)
  const seeds = nodes.map((n) => {
    const p = nodePos(region, n.id) ?? [0.5, 0.5]
    return { x: p[0] * RA.w, y: p[1] * RA.h, size: SIZE[n.kind] }
  })
  const t = territory(`${region}:time`, RA.w, RA.h, RA.terrR * (nat.land === null ? 1.15 : 1.5), { seeds, ...nat })
  const ms = performance.now() - t0
  // 두 번째(덥혀진 뒤) — 처음 것엔 자바스크립트가 덥혀지는 때가 섞인다
  const t1 = performance.now()
  territory(`${region}:time2`, RA.w, RA.h, RA.terrR * (nat.land === null ? 1.15 : 1.5), { seeds, ...nat })
  console.log(`  ${region} 두 번째: ${(performance.now() - t1).toFixed(1)}ms`)
  const empty = nodes.filter((_, i) => t.cells[i] === 0).map((n) => n.name)
  const bytes = t.fills.reduce((s, d) => s + d.length, 0) + t.edges.reduce((s, e) => s + e.d.length, 0)
  console.log(`${region}: ${ms.toFixed(1)}ms · 고을 ${nodes.length} · 금 ${t.edges.length} · 패스 ${(bytes / 1024).toFixed(0)}KB · 땅 없는 고을 ${empty.length}${empty.length > 0 ? ` (${empty.join(', ')})` : ''}`)
}
