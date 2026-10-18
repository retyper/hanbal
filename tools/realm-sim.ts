/**
 * 나라 헤드리스 시뮬 — 봇을 플레이어 자리에 앉혀 판을 수백 번 돌린다 (docs/realm/BUILD.md §1-5 · §3-5)
 *
 *   node --experimental-strip-types tools/realm-sim.ts [--games 300] [--seasons 40]
 *        [--bot all|reckless|cautious|planner|random] [--as us|guya|anya|miri|goja|dokro|all] [--out runs.csv]
 *
 * 재는 것 (FLOW §7 #1 의 이김·짐이 생겼다):
 *   이김    국읍 셋을 쥔 판의 비율 · 짐 = 제 국읍을 잃은 판의 비율
 *   땅      EARLY 계절째 · 끝의 제 고을 수
 *   싸움    판당 싸움 수 · 이긴 비율 · 판당 생포 · 첫 장수를 잃은 판
 * `--as all` 은 여섯 나라를 차례로 고른다 — FLOW §3 "잘하는 것이 다르고 합은 비슷하게"를 재는 표.
 * 합격선의 씨앗 — "신중 봇이 무모 봇보다 나아야 정보 체계가 장식이 아니다" (BUILD §3-5). 감이 아니라 숫자로 (CLAUDE.md).
 */
import { writeFileSync } from 'node:fs'
import { aiOrders, decide, type Brain } from '../src/realm/ai.ts'
import { NATION_IDS, startRealm } from '../src/realm/data/regions/byeonhan-mini.ts'
import { advance } from '../src/realm/season.ts'
import type { Realm } from '../src/realm/types.ts'

const args = process.argv.slice(2)
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : def
}
const GAMES = Number(opt('games', '300'))
const SEASONS = Number(opt('seasons', '40'))
const BOTS: Brain[] = opt('bot', 'all') === 'all' ? ['reckless', 'cautious', 'planner', 'random'] : [opt('bot', 'all') as Brain]
const AS: string[] = opt('as', 'us') === 'all' ? [...NATION_IDS] : [opt('as', 'us')]
const OUT = opt('out', '')
const EARLY = 8

interface Run {
  bot: Brain
  as: string
  seed: number
  start: number
  nodes: number
  nodesEarly: number
  win: boolean
  lose: boolean
  battles: number
  wins: number
  captured: number
  lostHero: boolean
  /** 이 나라의 개척 횟수 · 판 끝에 누구든 쥔 빈땅 수 */
  settled: number
  wildHeld: number
}

function play(bot: Brain, as: string, seed: number): Run {
  let r: Realm = startRealm(seed, as)
  const own = (x: Realm): number => Object.values(x.nodes).filter((n) => n.owner === as).length
  const lead = Object.values(r.heroes).filter((h) => h.faction === as).sort((a, b) => (a.id < b.id ? -1 : 1))[0]?.id
  const run: Run = { bot, as, seed, start: own(r), nodes: 0, nodesEarly: -1, win: false, lose: false, battles: 0, wins: 0, captured: 0, lostHero: false, settled: 0, wildHeld: 0 }
  for (let s = 0; s < SEASONS; s++) {
    if (s === EARLY) run.nodesEarly = own(r)
    const orders = [...decide(r, as, bot), ...aiOrders(r)]
    const { next, report } = advance(r, orders)
    for (const l of report.lines) {
      if (l.kind === 'settle' && l.faction === as) run.settled++
      if (l.kind !== 'battle') continue
      // 나눈 별동대도 우리 군대다 — 넘기기 전 판에서 주인을 본다
      const weAttack = r.armies[l.attacker]?.faction === as
      const weDefend = l.defender === as
      if (!weAttack && !weDefend) continue
      run.battles++
      const atkWon = l.outcome === 'rout' || l.outcome === 'win'
      if ((weAttack && atkWon) || (weDefend && (l.outcome === 'lose' || l.outcome === 'routed'))) run.wins++
      if (l.captured !== null && next.heroes[l.captured]?.captor === as) run.captured++
    }
    r = next
    if (r.outcome !== null) break
  }
  if (run.nodesEarly < 0) run.nodesEarly = own(r) // EARLY 전에 판이 끝났다
  run.nodes = own(r)
  run.win = r.outcome?.kind === 'win'
  run.lose = r.outcome?.kind === 'lose'
  run.lostHero = lead !== undefined && r.heroes[lead]?.status !== 'free'
  run.wildHeld = Object.values(r.nodes).filter((n) => n.kind === 'wild' && n.owner !== null).length
  return run
}

const runs: Run[] = []
for (const as of AS) for (const bot of BOTS) for (let g = 0; g < GAMES; g++) runs.push(play(bot, as, 1000 + g))

const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`

console.log(`나라 시뮬 — 변한 6국 축소판 · ${GAMES}판 × ${SEASONS}계절 · 봇이 고른 나라를 맡는다\n`)
console.log(`나라    봇         시작  땅@${EARLY}  끝땅   이김    짐     싸움/판  이긴 비율  생포/판  장수 잃음  개척/판  쥔 빈땅`)
for (const as of AS) {
  for (const bot of BOTS) {
    const rs = runs.filter((x) => x.bot === bot && x.as === as)
    const battles = rs.reduce((a, x) => a + x.battles, 0)
    const wins = rs.reduce((a, x) => a + x.wins, 0)
    console.log(
      `${as.padEnd(7)} ${bot.padEnd(9)} ${String(rs[0]?.start ?? 0).padStart(4)} ${mean(rs.map((x) => x.nodesEarly)).toFixed(2).padStart(6)} ${mean(rs.map((x) => x.nodes)).toFixed(2).padStart(6)}  ` +
      `${pct(mean(rs.map((x) => (x.win ? 1 : 0)))).padStart(6)} ${pct(mean(rs.map((x) => (x.lose ? 1 : 0)))).padStart(6)}  ` +
      `${mean(rs.map((x) => x.battles)).toFixed(2).padStart(7)}  ${pct(battles > 0 ? wins / battles : 0).padStart(9)}  ` +
      `${mean(rs.map((x) => x.captured)).toFixed(2).padStart(7)}  ${pct(mean(rs.map((x) => (x.lostHero ? 1 : 0)))).padStart(9)}  ` +
      `${mean(rs.map((x) => x.settled)).toFixed(2).padStart(7)}  ${mean(rs.map((x) => x.wildHeld)).toFixed(2).padStart(7)}`,
    )
  }
}

if (OUT !== '') {
  const head = 'as,bot,seed,nodesEarly,nodes,win,lose,battles,wins,captured,lostHero'
  const body = runs.map((x) => [x.as, x.bot, x.seed, x.nodesEarly, x.nodes, x.win ? 1 : 0, x.lose ? 1 : 0, x.battles, x.wins, x.captured, x.lostHero ? 1 : 0].join(','))
  writeFileSync(OUT, [head, ...body].join('\n') + '\n')
  console.log(`\n→ ${OUT}`)
}
