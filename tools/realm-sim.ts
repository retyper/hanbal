/**
 * 나라 헤드리스 시뮬 — 봇을 플레이어 자리에 앉혀 판을 수백 번 돌린다 (docs/realm/BUILD.md §1-5 · §3-5)
 *
 *   node --experimental-strip-types tools/realm-sim.ts [--games 300] [--seasons 40]
        [--bot all|reckless|cautious|planner|random] [--as us|guya|anya|miri|goja|dokro|all] [--region byeonhan-mini|yeongnam] [--out runs.csv]
 *
 * 재는 것 (FLOW §7 #1 의 이김·짐이 생겼다):
 *   이김    국읍 셋을 쥔 판의 비율 · 짐 = 제 국읍을 잃은 판의 비율
 *   땅      EARLY 계절째 · 끝의 제 고을 수
 *   싸움    판당 싸움 수 · 이긴 비율 · 판당 생포 · 첫 장수를 잃은 판
 *   기습    이 나라가 친 기습/판 · 그 가운데 먹힌 비율 · 판 전체(모든 나라)의 기습/판 · 제사/판
 *   외교    이 나라가 받은 청/판 · 판 전체에서 맺어진 화친·동맹/판 · 판 전체의 들판 싸움/판
 * `--as all` 은 여섯 나라를 차례로 고른다 — FLOW §3 "잘하는 것이 다르고 합은 비슷하게"를 재는 표.
 * 합격선의 씨앗 — "신중 봇이 무모 봇보다 나아야 정보 체계가 장식이 아니다" (BUILD §3-5). 감이 아니라 숫자로 (CLAUDE.md).
 */
import { writeFileSync } from 'node:fs'
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
const GAMES = Number(opt('games', '300'))
const SEASONS = Number(opt('seasons', '40'))
const BOTS: Brain[] = opt('bot', 'all') === 'all' ? ['reckless', 'cautious', 'planner', 'random'] : [opt('bot', 'all') as Brain]
// 판 — 변한 6국 축소판(기본) · 영남 판 (--region yeongnam)
const REGION = opt('region', 'byeonhan-mini') as RegionId
const AS: string[] = opt('as', 'us') === 'all' ? [...regionNations(REGION)] : [opt('as', 'us')]
const OUT = opt('out', '')
// --set rationPack=0,tacK=2 — 조율해 볼 때 (params.ts 를 고치기 전에)
for (const kv of opt('set', '').split(',').filter((x) => x !== '')) {
  const [k, v] = kv.split('=')
  ;(P.realm as unknown as Record<string, number>)[k!] = Number(v)
}
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
  /** 이 나라가 친 기습 · 그 가운데 먹힌 것 · 제사 · 판 전체의 기습(모든 나라) */
  ambush: number
  ambushOk: number
  rites: number
  worldAmbush: number
  wildHeld: number
  /** 이 나라가 받은 청 · 판 전체에서 맺어진 화친·동맹 · 판 전체의 들판 싸움 */
  asks: number
  pacts: number
  fieldFights: number
  /** 이 나라가 벌인 공작 · 먹힌 것 · 이 나라가 당한 공작 · 판 전체의 공작 */
  plots: number
  plotsOk: number
  plotsAtUs: number
  worldPlots: number
  heroes: number
  persuaded: number
  hired: number
  /** 판 전체의 동맹 맺음 · 약속 지킴 · 저버림 · 선물 · 무장 올리기 · 군대 빌려줌 (외교 둘째판·철) · 이 나라의 판 끝 가호 */
  allies: number
  pledgeKept: number
  pledgeBroken: number
  gifts: number
  arms: number
  lent: number
  hh: number
}

function play(bot: Brain, as: string, seed: number): Run {
  let r: Realm = startRegion(REGION, seed, as)
  const own = (x: Realm): number => Object.values(x.nodes).filter((n) => n.owner === as).length
  const lead = Object.values(r.heroes).filter((h) => h.faction === as).sort((a, b) => (a.id < b.id ? -1 : 1))[0]?.id
  const run: Run = { bot, as, seed, start: own(r), nodes: 0, nodesEarly: -1, win: false, lose: false, battles: 0, wins: 0, captured: 0, lostHero: false, settled: 0, wildHeld: 0, ambush: 0, ambushOk: 0, rites: 0, worldAmbush: 0, asks: 0, pacts: 0, fieldFights: 0, plots: 0, plotsOk: 0, plotsAtUs: 0, worldPlots: 0, heroes: 0, persuaded: 0, hired: 0, allies: 0, pledgeKept: 0, pledgeBroken: 0, gifts: 0, arms: 0, lent: 0, hh: 0 }
  for (let s = 0; s < SEASONS; s++) {
    if (s === EARLY) run.nodesEarly = own(r)
    const orders = [...decide(r, as, bot), ...aiOrders(r)]
    const { next, report } = advance(r, orders)
    for (const l of report.lines) {
      if (l.kind === 'settle' && l.faction === as) run.settled++
      if (l.kind === 'rite' && l.faction === as) run.rites++
      if (l.kind === 'recruit' && l.faction === as) l.how === 'persuade' ? run.persuaded++ : run.hired++
      if (l.kind === 'ask' && l.ask.to === as) run.asks++
      if (l.kind === 'relation' && (l.state === 'truce' || l.state === 'ally')) run.pacts++
      if (l.kind === 'battle' && l.field === true) run.fieldFights++
      if (l.kind === 'relation' && l.state === 'ally') run.allies++
      if (l.kind === 'pledge') l.kept ? run.pledgeKept++ : run.pledgeBroken++
      if (l.kind === 'envoy' && l.ask === 'gift' && l.accepted) run.gifts++
      if (l.kind === 'arm') run.arms++
      if (l.kind === 'lent' && !l.back) run.lent++
      if (l.kind === 'plot') {
        run.worldPlots++
        if (l.target === as) run.plotsAtUs++
        if (l.faction === as) {
          run.plots++
          if (l.ok) run.plotsOk++
        }
      }
      if (l.kind === 'battle' && l.ambush !== 'none') {
        run.worldAmbush++
        if (r.armies[l.attacker]?.faction === as) {
          run.ambush++
          if (l.ambush === 'success') run.ambushOk++
        }
      }
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
  run.heroes = Object.values(r.heroes).filter((h) => h.faction === as && h.status === 'free').length
  run.hh = Object.values(r.nodes).filter((n) => n.owner === as).reduce((s, n) => s + n.hh, 0)
  return run
}

const runs: Run[] = []
for (const as of AS) for (const bot of BOTS) for (let g = 0; g < GAMES; g++) runs.push(play(bot, as, 1000 + g))

const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`

console.log(`나라 시뮬 — ${REGION === "yeongnam" ? "영남 판 스물한 나라" : "변한 6국 축소판"} · ${GAMES}판 × ${SEASONS}계절 · 봇이 고른 나라를 맡는다\n`)
console.log(`나라    봇         시작  땅@${EARLY}  끝땅   이김    짐     싸움/판  이긴 비율  생포/판  장수 잃음  개척/판  쥔 빈땅  기습/판  먹힘   제사/판  판 기습  청/판  맺음/판  들판/판  공작/판  먹힘   당함/판  판 공작  장수끝  회유/판  들임/판  동맹/판  지킴/판  저버림/판  선물/판  무장/판  빌림/판  끝 가호`)
for (const as of AS) {
  for (const bot of BOTS) {
    const rs = runs.filter((x) => x.bot === bot && x.as === as)
    const battles = rs.reduce((a, x) => a + x.battles, 0)
    const wins = rs.reduce((a, x) => a + x.wins, 0)
    const amb = rs.reduce((a, x) => a + x.ambush, 0)
    const ambOk = rs.reduce((a, x) => a + x.ambushOk, 0)
    const pl = rs.reduce((a, x) => a + x.plots, 0)
    const plOk = rs.reduce((a, x) => a + x.plotsOk, 0)
    console.log(
      `${as.padEnd(7)} ${bot.padEnd(9)} ${String(rs[0]?.start ?? 0).padStart(4)} ${mean(rs.map((x) => x.nodesEarly)).toFixed(2).padStart(6)} ${mean(rs.map((x) => x.nodes)).toFixed(2).padStart(6)}  ` +
      `${pct(mean(rs.map((x) => (x.win ? 1 : 0)))).padStart(6)} ${pct(mean(rs.map((x) => (x.lose ? 1 : 0)))).padStart(6)}  ` +
      `${mean(rs.map((x) => x.battles)).toFixed(2).padStart(7)}  ${pct(battles > 0 ? wins / battles : 0).padStart(9)}  ` +
      `${mean(rs.map((x) => x.captured)).toFixed(2).padStart(7)}  ${pct(mean(rs.map((x) => (x.lostHero ? 1 : 0)))).padStart(9)}  ` +
      `${mean(rs.map((x) => x.settled)).toFixed(2).padStart(7)}  ${mean(rs.map((x) => x.wildHeld)).toFixed(2).padStart(7)}  ` +
      `${mean(rs.map((x) => x.ambush)).toFixed(2).padStart(7)}  ${pct(amb > 0 ? ambOk / amb : 0).padStart(6)}  ` +
      `${mean(rs.map((x) => x.rites)).toFixed(2).padStart(7)}  ${mean(rs.map((x) => x.worldAmbush)).toFixed(2).padStart(6)}  ` +
      `${mean(rs.map((x) => x.asks)).toFixed(2).padStart(5)}  ${mean(rs.map((x) => x.pacts)).toFixed(2).padStart(7)}  ${mean(rs.map((x) => x.fieldFights)).toFixed(2).padStart(7)}  ` +
      `${mean(rs.map((x) => x.plots)).toFixed(2).padStart(7)}  ${pct(pl > 0 ? plOk / pl : 0).padStart(6)}  ${mean(rs.map((x) => x.plotsAtUs)).toFixed(2).padStart(7)}  ${mean(rs.map((x) => x.worldPlots)).toFixed(2).padStart(6)}  ` +
      `${mean(rs.map((x) => x.heroes)).toFixed(2).padStart(6)}  ${mean(rs.map((x) => x.persuaded)).toFixed(2).padStart(7)}  ${mean(rs.map((x) => x.hired)).toFixed(2).padStart(7)}  ` +
      `${mean(rs.map((x) => x.allies)).toFixed(2).padStart(7)}  ${mean(rs.map((x) => x.pledgeKept)).toFixed(2).padStart(7)}  ${mean(rs.map((x) => x.pledgeBroken)).toFixed(2).padStart(9)}  ` +
      `${mean(rs.map((x) => x.gifts)).toFixed(2).padStart(7)}  ${mean(rs.map((x) => x.arms)).toFixed(2).padStart(7)}  ${mean(rs.map((x) => x.lent)).toFixed(2).padStart(7)}  ${mean(rs.map((x) => x.hh)).toFixed(0).padStart(7)}`,
    )
  }
}

if (OUT !== '') {
  const head = 'as,bot,seed,nodesEarly,nodes,win,lose,battles,wins,captured,lostHero'
  const body = runs.map((x) => [x.as, x.bot, x.seed, x.nodesEarly, x.nodes, x.win ? 1 : 0, x.lose ? 1 : 0, x.battles, x.wins, x.captured, x.lostHero ? 1 : 0].join(','))
  writeFileSync(OUT, [head, ...body].join('\n') + '\n')
  console.log(`\n→ ${OUT}`)
}
