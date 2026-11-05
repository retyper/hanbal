/**
 * 주인 없는 철광·포구 확인용 판 — 우리 군대 하나를 그 터에 세워 두고 몇 달 넘겨, 보고에 「거뒀다」가 있는 판을 쓴다 (형 11-05).
 *   node --experimental-strip-types tools/site-save.ts <나갈 json> [달 수 2]  (REGION · NATION 은 phone-save 와 같다)
 */
import { writeFileSync } from 'node:fs'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { advance } from '../src/realm/season.ts'
import { freeSite } from '../src/realm/economy.ts'

const out = process.argv[2]!
const months = Number(process.argv[3] ?? 2)
let r = startRegion((process.env.REGION ?? 'byeonhan-mini') as Parameters<typeof startRegion>[0], 7, process.env.NATION ?? 'us')
const site = Object.values(r.nodes).filter((n) => freeSite(n)).sort((x, y) => (x.id < y.id ? -1 : 1))[0]!
const a = Object.values(r.armies).find((x) => x.faction === r.player)!
a.at = site.id
a.march = null
let before = r
let report = advance(r, []).report
for (let i = 0; i < months; i++) {
  before = r
  const res = advance(r, [])
  r = res.next
  report = res.report
}
writeFileSync(out, JSON.stringify({ v: 2, nation: process.env.NATION ?? 'us', seed: 7, log: [], realm: r, before, report }))
console.log('ok', site.id, site.name, JSON.stringify(r.nodes[site.id]!.stash), report.lines.filter((l) => l.kind === 'haul').map((l) => JSON.stringify(l)).join(' '))
