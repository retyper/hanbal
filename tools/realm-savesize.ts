/**
 * 판 저장의 무게 — 서버 문서 한 장(Firestore 1 MiB)에 들어가나 (docs/realm/SERVER.md §3)
 *
 *   node --experimental-strip-types tools/realm-savesize.ts [--seasons 80]
 *
 * 판마다 플레이어를 planner AI 로 돌리며 realm JSON · 명령 기록(log)의 글자 수를 잰다. gzip 한 크기도 같이.
 */
import { gzipSync } from 'node:zlib'
import { aiOrders, decide } from '../src/realm/ai.ts'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { advance } from '../src/realm/season.ts'
import type { Order, Realm, RegionId } from '../src/realm/types.ts'

const args = process.argv.slice(2)
const i = args.indexOf('--seasons')
const SEASONS = i >= 0 ? Number(args[i + 1]) : 80
const kb = (n: number): string => `${(n / 1024).toFixed(0)}KB`

for (const [region, nation] of [['byeonhan-mini', 'guya'], ['yeongnam', 'saro'], ['south', 'saro'], ['world', 'gungnae']] as Array<[RegionId, string]>) {
  let r: Realm
  try { r = startRegion(region, 7, nation) } catch { r = startRegion(region, 7, Object.keys(startRegion(region, 7, 'saro').factions)[0]!) }
  const log: Order[][] = []
  let s = 0
  const at: string[] = []
  for (; s < SEASONS && !r.outcome; s++) {
    const orders = [...decide(r, r.player, 'planner'), ...aiOrders(r)]
    log.push(orders.filter((o) => (o as { faction?: string }).faction === r.player || true))
    r = advance(r, orders).next
    if (s === 0 || s === 19 || s === 39 || s === SEASONS - 1) {
      const j = JSON.stringify(r)
      const lj = JSON.stringify(log)
      at.push(`${s + 1}계절: 판 ${kb(j.length)} (gzip ${kb(gzipSync(j).length)}) · 기록 ${kb(lj.length)} (gzip ${kb(gzipSync(lj).length)})`)
    }
  }
  console.log(`${region} — ${at.join(' | ')}`)
}
