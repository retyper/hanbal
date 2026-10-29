/**
 * 폰 폭 확인용 판 — 변한 작은 판을 한 계절 돌려 보고까지 만든 뒤, 이번 계절 카드를 바꿔 끼운다 (tools/phone-shot.ts 와 함께).
 *   node --experimental-strip-types tools/phone-save.ts <나갈 json> <카드: quarrel-town|quarrel-feast|romance|exile|fugitive|none|captive|woo> [시드]
 *   captive — 카드 없이 적장 하나를 우리 옥에 (회유 화면) · woo — 그 적장을 이미 달래는 중 (진행 줄)
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
// 옥에 가둔 적장 — 회유 화면을 찍는다 (docs/realm/WOO.md). 고를 장수가 넉넉하게 남의 장수 넷을 더 데려온다
if (kind === 'captive' || kind === 'woo') {
  const foes = Object.values(next.heroes).filter((h) => h.faction !== next.player && h.status === 'free' && !h.id.endsWith('-ruler')).sort((a, b) => (a.id < b.id ? -1 : 1))
  const cap = foes[0]!
  for (const x of foes.slice(1, 5)) { x.faction = next.player; x.at = next.factions[next.player]!.capital; for (const a of Object.values(next.armies)) if (a.hero === x.id) a.hero = null }
  cap.status = 'captive'
  cap.captor = next.player
  cap.at = null
  cap.post = null
  cap.caughtAt = next.season - 1
  for (const a of Object.values(next.armies)) if (a.hero === cap.id) a.hero = null
  if (kind === 'woo') cap.persuade = { by: g.id, left: 4, resist: 3.2, tries: 0, since: next.season - 2, talkAt: next.season - 2 }
  next.stock[next.player]!.grain = Math.max(next.stock[next.player]!.grain, 300)
}
const quiet = kind === 'captive' || kind === 'woo' // 보고 없이 판 위에서 연다
writeFileSync(out, JSON.stringify({ v: 2, nation: 'us', seed, log: [], realm: next, before: quiet ? null : r0, report: quiet ? null : report }))
console.log('ok', kind, g.name, w.name)
