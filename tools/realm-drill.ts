/**
 * 단련 공 셈 — 한 판에서 우리 장수마다 공이 얼마나 쌓이나 (docs/realm/HERO-GROWTH.md ★ 둘째 판 §A · §D · src/realm/drill.ts)
 *
 *   node --experimental-strip-types tools/realm-drill.ts [--games 20] [--seasons 40] [--region yeongnam] [--as bihwa] [--bot planner] [--tier 1]
 *        [--set drillMeritPost=1,drillMeritLead=1]
 *
 * 봇을 플레이어 자리에 앉혀 판을 돌리고, 판 끝(40계절이 다 차거나 판이 끝난 때)에 장수마다:
 *   공    r.merit (판 안에서 쌓인 공) · 새길 공 = 이기면 × drillWinMul
 *   단련  그 공으로 단련 0 에서 몇 단계까지 오르나 (n → n+1 은 n + drillCostBase)
 * 합격선 (HERO-GROWTH §A): 비화가야 40계절이면 주력 장수(가장 많이 번 장수)가 단련 5~7 단계쯤.
 */
import { aiOrders, decide, type Brain } from '../src/realm/ai.ts'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { earnedOf, spendCost } from '../src/realm/drill.ts'
import { isRuler } from '../src/realm/heroes.ts'
import { advance } from '../src/realm/season.ts'
import { applyTier } from '../src/realm/tier.ts'
import type { Realm, RegionId } from '../src/realm/types.ts'
import { P } from '../src/tune/params.ts'

const args = process.argv.slice(2)
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : def
}
const GAMES = Number(opt('games', '20'))
const SEASONS = Number(opt('seasons', '40'))
const REGION = opt('region', 'yeongnam') as RegionId
const AS = opt('as', 'bihwa')
const BOT = opt('bot', 'planner') as Brain
const TIER = Number(opt('tier', '1'))
for (const kv of opt('set', '').split(',').filter((x) => x !== '')) {
  const [k, v] = kv.split('=')
  ;(P.realm as unknown as Record<string, number>)[k!] = Number(v)
}

/** 단련 0 에서 이 공으로 몇 단계까지 */
function levelsFor(points: number): number {
  let n = 0
  let left = points
  while (left >= spendCost(n)) { left -= spendCost(n); n++ }
  return n
}

interface Row { seed: number; seasons: number; end: string; heroes: number; top: number; topName: string; ruler: number; sum: number; each: number[] }

function play(seed: number): Row {
  let r: Realm = startRegion(REGION, seed, AS)
  applyTier(r, TIER)
  let s = 0
  for (; s < SEASONS && r.outcome === null; s++) r = advance(r, [...decide(r, AS, BOT), ...aiOrders(r)]).next
  const ids = Object.keys(r.merit ?? {})
  const each = ids.map((id) => earnedOf(r, id)).sort((a, b) => b - a)
  const topId = ids.sort((a, b) => earnedOf(r, b) - earnedOf(r, a))[0]
  const ruler = Object.values(r.heroes).find((h) => isRuler(r, h.id) && h.faction === AS) ?? Object.values(r.heroes).find((h) => h.id === `${AS}-ruler`)
  return {
    seed, seasons: s, end: r.outcome?.kind ?? '-', heroes: ids.length,
    top: each[0] ?? 0, topName: topId !== undefined ? (r.heroes[topId]?.name ?? topId) : '-',
    ruler: ruler !== undefined ? earnedOf(r, ruler.id) : 0,
    sum: each.reduce((a, b) => a + b, 0), each,
  }
}

const rows: Row[] = []
for (let g = 0; g < GAMES; g++) rows.push(play(1000 + g))

const avg = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)
const med = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s.length === 0 ? 0 : s[Math.floor(s.length / 2)]! }
const f1 = (x: number): string => x.toFixed(1)

console.log(`단련 공 — ${REGION} · ${AS} · ${BOT} 봇 · ${SEASONS}계절 · 난세 ${TIER} · ${GAMES}판`)
console.log(`공: 싸움 ${P.realm.drillMeritFight}(이김 ${P.realm.drillMeritWin}) · 겨루기 ${P.realm.drillMeritDuel} · 사로잡음 ${P.realm.drillMeritCapture} · 고을 ${P.realm.drillMeritPost}/계절 · 군대 ${P.realm.drillMeritLead}/계절 · 공작 ${P.realm.drillMeritPlot} · 사신 ${P.realm.drillMeritEnvoy} · 이기면 ×${P.realm.drillWinMul} · 값 n+${P.realm.drillCostBase}`)
console.log('')
console.log('시드   계절  끝    공 받은 장수  주력(공 · 단련)            군주 공  공 합')
for (const x of rows) {
  console.log(`${String(x.seed).padEnd(6)} ${String(x.seasons).padStart(4)}  ${x.end.padEnd(5)} ${String(x.heroes).padStart(6)}       ${`${x.topName} ${x.top} · ${levelsFor(x.top)}`.padEnd(24)} ${String(x.ruler).padStart(6)}  ${String(x.sum).padStart(5)}`)
}
const tops = rows.map((x) => x.top)
const lv = tops.map(levelsFor)
const all = rows.flatMap((x) => x.each)
console.log('')
console.log(`주력 장수 공   평균 ${f1(avg(tops))} · 가운데 ${med(tops)} · 최소 ${Math.min(...tops)} · 최대 ${Math.max(...tops)}`)
console.log(`주력 장수 단련 평균 ${f1(avg(lv))} · 가운데 ${med(lv)} · 5~7 단계에 든 판 ${lv.filter((n) => n >= 5 && n <= 7).length}/${rows.length}`)
console.log(`군주 공       평균 ${f1(avg(rows.map((x) => x.ruler)))} · 단련 평균 ${f1(avg(rows.map((x) => levelsFor(x.ruler))))}`)
console.log(`장수 하나     평균 ${f1(avg(all))} · 가운데 ${med(all)} · 공 받은 장수 판당 ${f1(avg(rows.map((x) => x.heroes)))}`)
console.log(`판 끝         이김 ${rows.filter((x) => x.end === 'win').length} · 짐 ${rows.filter((x) => x.end === 'lose').length} · 다 참 ${rows.filter((x) => x.end === '-').length} · 평균 ${f1(avg(rows.map((x) => x.seasons)))}계절`)
