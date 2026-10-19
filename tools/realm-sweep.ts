/**
 * 큰 판 고르기 — 나라마다 봇을 앉혀 판을 돌리고, 플레이어의 이김·짐과 함께 **판 끝에 도읍을 가장 많이 쥔 나라**를 센다
 * (AI 하나가 판을 휩쓰는지 보려고 — realm-sim 은 플레이어 쪽만 잰다).
 *
 *   node --experimental-strip-types tools/realm-sweep.ts --region south [--games 20] [--seasons 40] [--bot planner] [--as baekje,mokji,…]
 *
 * 한 줄에 한 판을 JSON 으로 찍는다 — 여러 프로세스로 나눠 돌리고 합쳐 본다 (--sum 파일…).
 */
import { readFileSync } from 'node:fs'
import { aiOrders, decide, type Brain } from '../src/realm/ai.ts'
import { regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import { advance } from '../src/realm/season.ts'
import type { Realm, RegionId } from '../src/realm/types.ts'
import { P } from '../src/tune/params.ts'

const args = process.argv.slice(2)
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : def
}

/** caps — 나라마다 판 끝에 쥔 도읍 수 · taken — 남에게 넘어간 도읍: 본디 나라 → 지금 임자 */
interface Game { as: string; seed: number; win: boolean; lose: boolean; top: string; topCaps: number; caps: Record<string, number>; taken: Record<string, string> }

if (args.includes('--sum')) {
  const files = args.slice(args.indexOf('--sum') + 1)
  const games: Game[] = files.flatMap((f) => readFileSync(f, 'utf8').split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l) as Game))
  const need = Number(opt('need', String(P.realm.winCapitalsSouth)))
  const by = new Map<string, Game[]>()
  for (const g of games) by.set(g.as, [...(by.get(g.as) ?? []), g])
  const pct = (x: number): string => `${(x * 100).toFixed(1)}%`
  const rows = [...by.entries()].map(([as, gs]) => ({ as, n: gs.length, win: gs.filter((g) => g.win).length / gs.length, lose: gs.filter((g) => g.lose).length / gs.length }))
  rows.sort((a, b) => b.win - a.win)
  console.log('나라           판   이김    짐')
  for (const x of rows) console.log(`${x.as.padEnd(12)} ${String(x.n).padStart(4)} ${pct(x.win).padStart(6)} ${pct(x.lose).padStart(6)}`)
  // AI 가 휩쓰나 — 플레이어가 아닌 나라가 판 끝에 need 곳 이상을 쥔 판 · 가장 많이 쥔 나라
  const big = new Map<string, number>()
  const tops = new Map<string, number>()
  for (const g of games) {
    for (const [f, n] of Object.entries(g.caps)) if (f !== g.as && n >= need) big.set(f, (big.get(f) ?? 0) + 1)
    if (g.top !== g.as) tops.set(g.top, (tops.get(g.top) ?? 0) + 1)
  }
  console.log(`\n판 ${games.length} · AI 가 도읍 ${need} 곳 이상을 쥔 판 (나라별):`)
  console.log([...big.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n} (${pct(n / games.length)})`).join(' · ') || '없음')
  const killers = new Map<string, Map<string, number>>()
  for (const g of games) {
    const k = g.taken?.[g.as]
    if (k === undefined) continue
    const m = killers.get(g.as) ?? new Map<string, number>()
    m.set(k, (m.get(k) ?? 0) + 1)
    killers.set(g.as, m)
  }
  console.log('플레이어 도읍을 앗은 나라:')
  for (const [as, m] of [...killers.entries()].sort((a, b) => [...b[1].values()].reduce((x, y) => x + y) - [...a[1].values()].reduce((x, y) => x + y))) {
    console.log(`  ${as}: ${[...m.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(' · ')}`)
  }
  console.log('판 끝 도읍을 가장 많이 쥔 AI:')
  console.log([...tops.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([f, n]) => `${f} ${n}`).join(' · '))
  process.exit(0)
}

const REGION = opt('region', 'south') as RegionId
const GAMES = Number(opt('games', '20'))
const SEASONS = Number(opt('seasons', '40'))
const BOT = opt('bot', 'planner') as Brain
const AS = opt('as', 'all') === 'all' ? [...regionNations(REGION)] : opt('as', '').split(',')

for (const as of AS) {
  for (let g = 0; g < GAMES; g++) {
    const seed = 1000 + g
    let r: Realm = startRegion(REGION, seed, as)
    for (let s = 0; s < SEASONS; s++) {
      r = advance(r, [...decide(r, as, BOT), ...aiOrders(r)]).next
      // 플레이어의 판이 끝나도 계절을 다 돌린다 — AI 판의 모양을 보려고
    }
    const caps: Record<string, number> = {}
    const taken: Record<string, string> = {}
    for (const f of Object.values(r.factions)) {
      const o = r.nodes[f.capital]?.owner
      if (o !== undefined && o !== null) caps[o] = (caps[o] ?? 0) + 1
      if (o !== undefined && o !== null && o !== f.id) taken[f.id] = o
    }
    const [top, topCaps] = Object.entries(caps).sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
    const game: Game = { as, seed, win: r.outcome?.kind === 'win', lose: r.outcome?.kind === 'lose', top, topCaps, caps, taken }
    console.log(JSON.stringify(game))
  }
}
