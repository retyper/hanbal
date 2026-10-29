/**
 * 폰 폭 확인용 판 — 변한 작은 판을 한 계절 돌려 보고까지 만든 뒤, 이번 계절 카드를 바꿔 끼운다 (tools/phone-shot.ts 와 함께).
 *   node --experimental-strip-types tools/phone-save.ts <나갈 json> <카드: quarrel-town|quarrel-feast|romance|exile|fugitive|none> [시드]
 */
import { writeFileSync } from 'node:fs'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { HERO_POOL } from '../src/realm/data/heroes-pool.ts'
import { advance } from '../src/realm/season.ts'
import type { Card } from '../src/realm/types.ts'

const out = process.argv[2]!
const kind = process.argv[3] ?? 'quarrel-town'
const seed = Number(process.argv[4] ?? 7)
const r0 = startRegion('byeonhan-mini', seed, 'us')
const { next, report } = advance(r0, [])
const ours = Object.values(next.heroes).filter((h) => h.faction === next.player && h.status === 'free')
// 장수가 모자라면 남의 장수를 데려와 둘을 맞춘다 (남녀 하나씩)
for (const look of ['g', 'w'] as const) {
  if (ours.some((h) => h.look === look && !h.id.endsWith('-ruler'))) continue
  const x = Object.values(next.heroes).find((h) => h.faction !== next.player && h.look === look && !h.id.endsWith('-ruler'))
  if (x !== undefined) { x.faction = next.player; x.at = next.factions[next.player]!.capital; for (const a of Object.values(next.armies)) if (a.hero === x.id) a.hero = null; ours.push(x) }
}
const g = ours.find((h) => h.look === 'g' && !h.id.endsWith('-ruler'))!
const w = ours.find((h) => h.look === 'w' && !h.id.endsWith('-ruler'))!
const other = Object.keys(next.factions).find((f) => f !== next.player)!
const town = Object.values(next.nodes).find((n) => n.owner === next.player && n.id !== next.factions[next.player]!.capital)?.id
const cards: Record<string, Card | null> = {
  'quarrel-town': { kind: 'quarrel', season: next.season, hero: g.id, hero2: w.id, why: 'town', ...(town !== undefined ? { node: town } : {}) },
  'quarrel-feast': { kind: 'quarrel', season: next.season, hero: g.id, hero2: w.id, why: 'feast' },
  romance: { kind: 'romance', season: next.season, hero: g.id, hero2: w.id },
  exile: { kind: 'exile', season: next.season, guest: HERO_POOL[3]!.id, from: other },
  fugitive: { kind: 'fugitive', season: next.season, from: other },
  none: null,
}
next.card = cards[kind] ?? null
writeFileSync(out, JSON.stringify({ v: 2, nation: 'us', seed, log: [], realm: next, before: r0, report }))
console.log('ok', kind, g.name, w.name)
