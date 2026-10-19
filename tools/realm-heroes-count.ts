/**
 * 판마다 장수 남녀 수 · 그림 없는 장수 (형: "장수도 여캐 많았으면" 2026-10-19)
 *
 *   node --experimental-strip-types tools/realm-heroes-count.ts [--list]
 */
import { regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import { HERO_BUST } from '../src/realm/data/art.ts'
import type { RegionId } from '../src/realm/types.ts'

const list = process.argv.includes('--list')
for (const reg of ['byeonhan-mini', 'yeongnam', 'south', 'world'] as RegionId[]) {
  const r = startRegion(reg, 1, regionNations(reg)[0]!)
  const hs = Object.values(r.heroes)
  const rulers = new Set(Object.values(r.factions).map((f) => f.ruler))
  const non = hs.filter((h) => !rulers.has(h.id))
  const w = (xs: typeof hs): number => xs.filter((h) => h.look === 'w').length
  const bare = hs.filter((h) => HERO_BUST[h.id] === undefined)
  console.log(`${reg}: 장수 ${hs.length} (여 ${w(hs)}) · 군주 빼고 ${non.length} (여 ${w(non)}) · 그림 없음 ${bare.length} · 나라 ${Object.keys(r.factions).length}`)
  if (list) for (const h of non) console.log(`  ${h.id} ${h.name} ${h.look} ${h.faction}${HERO_BUST[h.id] === undefined ? ' (그림 없음)' : ''}`)
}
