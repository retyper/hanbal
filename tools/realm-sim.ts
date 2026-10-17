/**
 * 나라 헤드리스 시뮬 — 봇을 플레이어 자리에 앉혀 판을 수백 번 돌린다 (docs/realm/BUILD.md §1-5 · §3-5)
 *
 *   node --experimental-strip-types tools/realm-sim.ts [--games 300] [--seasons 40] [--bot all|reckless|cautious|random] [--out runs.csv]
 *
 * R1 에는 승리 조건이 아직 없다 (추대·철길은 R4~R5). 그래서 재는 것은 **땅과 목숨**이다:
 *   땅      40계절 뒤 우리 고을 수 (시작 3)
 *   국읍    국읍을 잃은 판의 비율
 *   싸움    판당 싸움 수 · 이긴 비율
 *   생포    판당 사로잡은 적장 수
 * 합격선의 씨앗 — "신중 봇이 무모 봇보다 나아야 정보 체계가 장식이 아니다" (BUILD §3-5).
 * 지금 수치는 초안이니 이 표가 곧 다음 조율의 근거다. 감이 아니라 숫자로 (CLAUDE.md).
 */
import { writeFileSync } from 'node:fs'
import { aiOrders, decide, type Brain } from '../src/realm/ai.ts'
import { byeonhanMini } from '../src/realm/data/regions/byeonhan-mini.ts'
import { advance } from '../src/realm/season.ts'
import type { Realm } from '../src/realm/types.ts'

const args = process.argv.slice(2)
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : def
}
const GAMES = Number(opt('games', '300'))
const SEASONS = Number(opt('seasons', '40'))
const BOTS: Brain[] = opt('bot', 'all') === 'all' ? ['reckless', 'cautious', 'random'] : [opt('bot', 'all') as Brain]
const OUT = opt('out', '')
const EARLY = 8

interface Run {
  bot: Brain
  seed: number
  nodes: number
  /** EARLY 계절째의 우리 고을 수 — "초반엔 쉽게"를 재는 자리 */
  nodesEarly: number
  capitalLost: boolean
  battles: number
  wins: number
  captured: number
  lostHero: boolean
}

function play(bot: Brain, seed: number): Run {
  let r: Realm = byeonhanMini(seed)
  const run: Run = { bot, seed, nodes: 0, nodesEarly: 0, capitalLost: false, battles: 0, wins: 0, captured: 0, lostHero: false }
  for (let s = 0; s < SEASONS; s++) {
    if (s === EARLY) run.nodesEarly = Object.values(r.nodes).filter((n) => n.owner === 'us').length
    const orders = [...decide(r, 'us', bot), ...aiOrders(r)]
    const { next, report } = advance(r, orders)
    for (const l of report.lines) {
      if (l.kind !== 'battle') continue
      // 나눈 별동대도 우리 군대다 — 넘기기 전 판에서 주인을 본다
      const weAttack = r.armies[l.attacker]?.faction === 'us'
      const weDefend = l.defender === 'us'
      if (!weAttack && !weDefend) continue
      run.battles++
      const atkWon = l.outcome === 'rout' || l.outcome === 'win'
      if ((weAttack && atkWon) || (weDefend && (l.outcome === 'lose' || l.outcome === 'routed'))) run.wins++
      if (l.captured !== null && next.heroes[l.captured]?.captor === 'us') run.captured++
    }
    r = next
    if (r.nodes['our-cap']?.owner !== 'us') run.capitalLost = true
  }
  run.nodes = Object.values(r.nodes).filter((n) => n.owner === 'us').length
  run.lostHero = r.heroes['chief']?.status !== 'free'
  return run
}

const runs: Run[] = []
for (const bot of BOTS) for (let g = 0; g < GAMES; g++) runs.push(play(bot, 1000 + g))

const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`

console.log(`나라 시뮬 — 변한 6국 축소판 · ${GAMES}판 × ${SEASONS}계절 · 봇은 '우리 나라' 자리\n`)
console.log(`봇        땅@${EARLY}  땅(시작3)  국읍 잃음  싸움/판  이긴 비율  생포/판  군장 잃음`)
for (const bot of BOTS) {
  const rs = runs.filter((x) => x.bot === bot)
  const battles = rs.reduce((a, x) => a + x.battles, 0)
  const wins = rs.reduce((a, x) => a + x.wins, 0)
  console.log(
    `${bot.padEnd(9)} ${mean(rs.map((x) => x.nodesEarly)).toFixed(2).padStart(5)} ${mean(rs.map((x) => x.nodes)).toFixed(2).padStart(8)}  ${pct(mean(rs.map((x) => (x.capitalLost ? 1 : 0)))).padStart(9)}  ` +
    `${mean(rs.map((x) => x.battles)).toFixed(2).padStart(7)}  ${pct(battles > 0 ? wins / battles : 0).padStart(9)}  ` +
    `${mean(rs.map((x) => x.captured)).toFixed(2).padStart(7)}  ${pct(mean(rs.map((x) => (x.lostHero ? 1 : 0)))).padStart(9)}`,
  )
}

if (OUT !== '') {
  const head = 'bot,seed,nodesEarly,nodes,capitalLost,battles,wins,captured,lostHero'
  const body = runs.map((x) => [x.bot, x.seed, x.nodesEarly, x.nodes, x.capitalLost ? 1 : 0, x.battles, x.wins, x.captured, x.lostHero ? 1 : 0].join(','))
  writeFileSync(OUT, [head, ...body].join('\n') + '\n')
  console.log(`\n→ ${OUT}`)
}
