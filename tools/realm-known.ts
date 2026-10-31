/**
 * 발견 재기 — 판마다 플레이어 자리가 아는 나라 수가 계절따라 어떻게 느나 (봇이 AI 로 둔다)
 *   node --experimental-strip-types tools/realm-known.ts [--region yeongnam] [--as saro] [--games 10]
 */
import { aiOrders } from '../src/realm/ai.ts'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { perSeason } from '../src/realm/calendar.ts'
import { advance } from '../src/realm/season.ts'
import type { RegionId } from '../src/realm/types.ts'

const args = process.argv.slice(2)
const opt = (k: string, d: string): string => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] ?? d : d }
const REGION = opt('region', 'yeongnam') as RegionId
const AS = opt('as', 'saro')
const GAMES = Number(opt('games', '10'))
const AT = [0, 4, 8, 12, 20, 30, 40]
const sum = AT.map(() => 0)
let total = 0
for (let g = 1; g <= GAMES; g++) {
  let r = startRegion(REGION, g, AS)
  total = Object.keys(r.factions).length - 1
  const per = perSeason(r)
  for (let t = 0; t <= 40 * per; t++) {
    const s = t / per
    const i = Number.isInteger(s) ? AT.indexOf(s) : -1
    if (i >= 0) sum[i] = (sum[i] ?? 0) + (r.known?.[AS]?.length ?? total)
    if (t < 40 * per) r = advance(r, aiOrders(r)).next
  }
}
console.log(`${REGION} · ${AS} · ${GAMES}판 — 아는 나라 (모두 ${total})`)
console.log(AT.map((s, i) => `${s}계절 ${(sum[i]! / GAMES).toFixed(1)}`).join(' · '))
