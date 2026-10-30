/**
 * 장수의 기억 · 전례 장부가 저장을 얼마나 키우나 (docs/realm/MEMORY.md §3-1 — "저장 크기: 약 150KB 이하")
 *
 *   node --experimental-strip-types tools/realm-memsize.ts [--region south] [--seasons 40] [--seed 7]
 *
 * 봇이 플레이어 자리에 앉아 판을 돌리고, 끝 판의 JSON 크기 · 그 가운데 기억(mem)·장부(lessons)의 몫 · 장수마다 줄 수를 찍는다.
 */
import { aiOrders, decide } from '../src/realm/ai.ts'
import { regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import { advance } from '../src/realm/season.ts'
import type { Realm, RegionId } from '../src/realm/types.ts'

const args = process.argv.slice(2)
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : def
}
const REGION = opt('region', 'south') as RegionId
const SEASONS = Number(opt('seasons', '40'))
const SEED = Number(opt('seed', '7'))

let r: Realm = startRegion(REGION, SEED, regionNations(REGION)[0]!)
for (let s = 0; s < SEASONS && !r.outcome; s++) r = advance(r, [...aiOrders(r), ...decide(r, r.player, 'planner')]).next
const all = JSON.stringify(r).length
const bare = JSON.parse(JSON.stringify(r)) as Realm
for (const h of Object.values(bare.heroes)) delete h.mem
delete bare.lessons
const without = JSON.stringify(bare).length
const memB = Object.values(r.heroes).reduce((s, h) => s + (h.mem !== undefined ? JSON.stringify(h.mem).length : 0), 0)
const lessonB = r.lessons !== undefined ? JSON.stringify(r.lessons).length : 0
const lines = Object.values(r.heroes).map((h) => h.mem?.length ?? 0)
const kinds: Record<string, number> = {}
for (const h of Object.values(r.heroes)) for (const m of h.mem ?? []) kinds[m.k] = (kinds[m.k] ?? 0) + 1
console.log(`${REGION} · ${r.season}계절 · 장수 ${lines.length}명 (기억 있는 이 ${lines.filter((n) => n > 0).length})`)
console.log(`판 JSON ${(all / 1024).toFixed(1)}KB · 기억·장부 없이 ${(without / 1024).toFixed(1)}KB · 늘어난 몫 ${((all - without) / 1024).toFixed(1)}KB (+${(((all - without) / without) * 100).toFixed(1)}%)`)
console.log(`기억 ${(memB / 1024).toFixed(1)}KB · 장부 ${(lessonB / 1024).toFixed(1)}KB · 장수당 줄 평균 ${(lines.reduce((a, b) => a + b, 0) / Math.max(1, lines.length)).toFixed(1)} · 가장 많은 ${Math.max(...lines)}`)
console.log(`줄 종류 ${JSON.stringify(kinds)}`)
const busiest = Object.values(r.heroes).sort((a, b) => (b.mem?.length ?? 0) - (a.mem?.length ?? 0))[0]
if (busiest !== undefined) console.log(`예 ${busiest.id} ${JSON.stringify(busiest.mem)}`)
const lk: Record<string, number> = {}
let pairs = 0
for (const book of Object.values(r.lessons ?? {})) for (const xs of Object.values(book)) { pairs++; for (const l of xs) lk[l.k] = (lk[l.k] ?? 0) + 1 }
console.log(`장부 짝 ${pairs} · 줄 종류 ${JSON.stringify(lk)}`)
