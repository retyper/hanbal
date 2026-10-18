/**
 * 판 넘기기의 무게 — 한 계절(모든 AI 의 명령 + advance)에 몇 ms 드나 (영남 판은 나라가 스물하나 — 브라우저에서 버티나)
 *
 *   node --experimental-strip-types tools/realm-perf.ts [--region yeongnam] [--seasons 40] [--seeds 5]
 */
import { aiOrders, decide } from '../src/realm/ai.ts'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { advance } from '../src/realm/season.ts'
import type { Realm, RegionId } from '../src/realm/types.ts'

const args = process.argv.slice(2)
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : def
}
const REGION = opt('region', 'yeongnam') as RegionId
const SEASONS = Number(opt('seasons', '40'))
const SEEDS = Number(opt('seeds', '5'))

const times: number[] = []
for (let seed = 1; seed <= SEEDS; seed++) {
  let r: Realm = startRegion(REGION, seed, 'us')
  for (let s = 0; s < SEASONS && !r.outcome; s++) {
    const t0 = performance.now()
    const orders = [...decide(r, r.player, 'planner'), ...aiOrders(r)]
    r = advance(r, orders).next
    times.push(performance.now() - t0)
  }
}
times.sort((a, b) => a - b)
const q = (p: number): number => times[Math.min(times.length - 1, Math.floor(times.length * p))]!
console.log(`${REGION}: 계절 ${times.length}개 · 가운데 ${q(0.5).toFixed(1)}ms · 90% ${q(0.9).toFixed(1)}ms · 가장 느림 ${q(1).toFixed(1)}ms`)
