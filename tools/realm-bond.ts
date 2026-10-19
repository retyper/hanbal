/**
 * 정(친밀도)이 얼마나 빨리 쌓이나 — 플레이어 장수의 정이 70(믿음)·100(한마음)에 닿는 계절 (형: "친밀도는 너무빨리쌓이는거아냐?" 2026-10-19)
 *   node --experimental-strip-types tools/realm-bond.ts [--region byeonhan-mini] [--seeds 20] [--seasons 60]
 */
import { decide, aiOrders } from '../src/realm/ai.ts'
import { regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import { bondOf } from '../src/realm/heroes.ts'
import { advance } from '../src/realm/season.ts'
import type { RegionId } from '../src/realm/types.ts'

const arg = (k: string, d: string): string => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1]! : d
}
const region = arg('region', 'byeonhan-mini') as RegionId
const SEEDS = Number(arg('seeds', '20'))
const SEASONS = Number(arg('seasons', '60'))
const t70: number[] = []
const t100: number[] = []
for (let seed = 1; seed <= SEEDS; seed++) {
  const nations = regionNations(region)
  const as = nations[seed % nations.length]!
  let r = startRegion(region, seed, as)
  let a70 = -1
  let a100 = -1
  for (let s = 0; s < SEASONS && !r.outcome; s++) {
    r = advance(r, [...decide(r, as, 'planner'), ...aiOrders(r)]).next
    const best = Math.max(0, ...Object.values(r.heroes).filter((h) => h.faction === as).map((h) => bondOf(r, h) ?? 0))
    if (a70 < 0 && best >= 70) a70 = s + 1
    if (a100 < 0 && best >= 100) a100 = s + 1
  }
  if (a70 > 0) t70.push(a70)
  if (a100 > 0) t100.push(a100)
}
const med = (xs: number[]): string => (xs.length === 0 ? '—' : String(xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]))
console.log(`${region} · ${SEEDS}판 · ${SEASONS}계절: 첫 믿음(70) ${t70.length}판 가운데 ${med(t70)}계절 · 첫 한마음(100) ${t100.length}판 가운데 ${med(t100)}계절`)
