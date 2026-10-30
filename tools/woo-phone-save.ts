/**
 * 담판 화면 폰 찍기용 판 — 변한 작은 판에서 고른 사람을 우리 옥에 넣고, 벽이 막 무너진 채(담판이 저절로 뜬다) 연다 (tools/phone-shot.ts 와 함께).
 *   npx tsx tools/woo-phone-save.ts <나갈 json> <갇힐 사람 id> [회유할 우리 사람 id] [fallen]
 *   예: npx tsx tools/woo-phone-save.ts s.json guya-ruler us-ruler fallen   (군주 담판)
 *   예: npx tsx tools/woo-phone-save.ts s.json guya-1                       (장수 담판)
 */
import { writeFileSync } from 'node:fs'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { advance } from '../src/realm/season.ts'

const [out, capId, byArg, sit] = process.argv.slice(2) as [string, string, string?, string?]
const seed = 7
const r0 = startRegion('byeonhan-mini', seed, 'us')
const { next } = advance(r0, [])
const cap = next.heroes[capId]
if (cap === undefined) throw new Error(`${capId} 가 판에 없다`)
const by = byArg ?? Object.values(next.heroes).find((h) => h.faction === next.player && h.status === 'free' && !h.id.endsWith('-ruler'))?.id ?? 'us-ruler'
cap.status = 'captive'
cap.captor = next.player
cap.at = null
cap.post = null
cap.caughtAt = next.season - 1
for (const a of Object.values(next.armies)) if (a.hero === cap.id) a.hero = null
cap.persuade = { by, left: 2, resist: 0, tries: 0, since: next.season - 4, talkAt: next.season - 4 }
if (sit === 'fallen') for (const n of Object.values(next.nodes)) if (n.owner === cap.faction) n.owner = next.player
next.stock[next.player]!.grain = Math.max(next.stock[next.player]!.grain, 300)
writeFileSync(out, JSON.stringify({ v: 2, nation: 'us', seed, log: [], realm: next, before: null, report: null }))
console.log('ok', cap.name, '←', next.heroes[by]?.name)
