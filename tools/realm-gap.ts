// 자유판 시작 때 우리 도읍에서 가장 가까운 타국 도읍까지 걸음 (형 10-31 · params rivalGapHops) — npx tsx tools/realm-gap.ts [걸음]
import { startRegion, regionNations } from '../src/realm/data/regions/index.ts'
import type { Realm } from '../src/realm/types.ts'
import { P } from '../src/tune/params.ts'
if (process.argv[2] !== undefined) (P.realm as { rivalGapHops: number }).rivalGapHops = Number(process.argv[2])
const hops = (r: Realm, s: string): Map<string, number> => {
  const d = new Map([[s, 0]]); let f = [s]
  while (f.length) { const n: string[] = []; for (const id of f) for (const e of Object.values(r.edges)) { const o = e.a === id ? e.b : e.b === id ? e.a : null; if (o && !d.has(o)) { d.set(o, d.get(id)! + 1); n.push(o) } } f = n }
  return d
}
for (const region of ['yeongnam', 'south', 'world'] as const) {
  const near: number[] = []
  for (const p of regionNations(region)) for (let seed = 1; seed <= 6; seed++) {
    const r = startRegion(region, seed, p)
    const h = hops(r, r.factions[r.player]!.capital!)
    const ds = Object.keys(r.factions).filter((f) => f !== r.player).map((f) => h.get(r.factions[f]!.capital!) ?? 99)
    near.push(Math.min(...ds))
  }
  near.sort((a, b) => a - b)
  console.log(region, 'n', near.length, 'min', near[0], 'p10', near[Math.floor(near.length * 0.1)], 'median', near[Math.floor(near.length / 2)])
}
