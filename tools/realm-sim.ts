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
 *   끝맺음  (둘째 표 · FOCUS C) 적 공세/판 = 남이 우리를 친 싸움 · 판 전체의 싸움·흩어짐·섬멸·연패 쉬기 · 짐의 갈래
 *   다시 싸움 (넷째 표 · loop 리뷰 #5) 우리 싸움 가운데 같은 고을에서 --refight 턴(기본 3) 안에 또 싸운 것 · 그 가운데 따로 닿은 원군
 * `--as all` 은 여섯 나라를 차례로 고른다 — FLOW §3 "잘하는 것이 다르고 합은 비슷하게"를 재는 표.
 * 합격선의 씨앗 — "신중 봇이 무모 봇보다 나아야 정보 체계가 장식이 아니다" (BUILD §3-5). 감이 아니라 숫자로 (CLAUDE.md).
 */
import { writeFileSync } from 'node:fs'
import { aiOrders, decide, type Brain } from '../src/realm/ai.ts'
import { regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import { applyTier } from '../src/realm/tier.ts'
import { advance } from '../src/realm/season.ts'
import type { Realm, RegionId } from '../src/realm/types.ts'
import { P } from '../src/tune/params.ts'
import { perSeason } from '../src/realm/calendar.ts'

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
const TIER = Number(opt('tier', '1'))
// --set rationPack=0,tacK=2 — 조율해 볼 때 (params.ts 를 고치기 전에)
for (const kv of opt('set', '').split(',').filter((x) => x !== '')) {
  const [k, v] = kv.split('=')
  ;(P.realm as unknown as Record<string, number>)[k!] = Number(v)
}
const EARLY = 8
// 다시 싸운 고을 — 같은 고을의 앞선 우리 싸움이 이 턴 수 안에 있었나 (--refight 3 · 달 시계면 석 달)
const REFIGHT = Number(opt('refight', '3'))

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
  /**
   * 싸움의 끝맺음 (FOCUS C) — 적 공세: 남이 우리를 친 싸움 · 판 전체의 싸움 · 진 군대가 흩어짐(scatter 줄) ·
   * 그 가운데 퇴로가 끊겨 섬멸 · 연달아 져서 쉬기에 든 나라(beaten 줄) · 졌으면 그 갈래
   */
  offensives: number
  /** 그 가운데 앞 턴(명령을 고르던 판)에 이미 보이던 것 — 우리 고을로 오는 길 위의 군대 · 「다음 달 친다」 채비 (loop 리뷰 11-01) · 계절 안 몇째 달에 맞았나 */
  warned: number
  byMonth: [number, number, number]
  worldBattles: number
  scatters: number
  wipes: number
  rests: number
  losePath: string
  /**
   * 다시 싸운 고을 (loop 리뷰 #5 · 11-01) — 우리 싸움 가운데 같은 고을에서 앞선 우리 싸움이 REFIGHT 턴 안(같은 턴 포함)에 있던 것 ·
   * 그 가운데 같은 나라가 같은 쪽으로 또 친 것(따로 닿은 원군) · 같은 턴의 것
   */
  refought: number
  refoughtWave: number
  refoughtSame: number
  /** 그 가운데 친 군대가 앞 싸움 뒤에도 이미 이 고을로 오던 것 — 따로 닿은 원군 */
  refoughtLate: number
  /** 그 가운데 우리가 친 쪽인 것 */
  refoughtUs: number
  /** 우리 싸움 가운데 같은 고을에서 누구든(남끼리 포함) REFIGHT 턴 안에 싸운 것 */
  refoughtAny: number
  /** 합종 (coalition.ts · 위원회 11-08 ⑤) — 선 수 · 첫 연합이 선 계절(없으면 -1) · 연합 나라 수 합 · 끝의 갈래 · 출정 동안 맞은 적 공세 · 첫 연합 뒤 맞은 적 공세 · 첫 연합 뒤 잃은 고을 */
  coal: number
  coalFirst: number
  coalSize: number
  coalEnds: Record<string, number>
  coalOff: number
  offAfter: number
  lostAfter: number
  /** 곳간을 부을 곳 (wonders.ts · 위원회 11-08 ⑦) — 마지막 20계절에 큰 공사·큰 잔치로 부은 곡식(돌려받은 것 빼고) · 판 끝 곳간 · 우리가 지은 공사 · 남이 지은 공사 · 잔치 수 · 이름난 손님 */
  sinkLate: number
  grainEnd: number
  ironEnd: number
  wonders: number
  wondersAi: number
  feasts: number
  guests: number
  firstWonder: number
}

function play(bot: Brain, as: string, seed: number): Run {
  let r: Realm = startRegion(REGION, seed, as)
  applyTier(r, TIER) // 난세 단계 (--tier 3)
  const own = (x: Realm): number => Object.values(x.nodes).filter((n) => n.owner === as).length
  const lead = Object.values(r.heroes).filter((h) => h.faction === as).sort((a, b) => (a.id < b.id ? -1 : 1))[0]?.id
  const run: Run = { bot, as, seed, start: own(r), nodes: 0, nodesEarly: -1, win: false, lose: false, battles: 0, wins: 0, captured: 0, lostHero: false, settled: 0, wildHeld: 0, ambush: 0, ambushOk: 0, rites: 0, worldAmbush: 0, asks: 0, pacts: 0, fieldFights: 0, plots: 0, plotsOk: 0, plotsAtUs: 0, worldPlots: 0, heroes: 0, persuaded: 0, hired: 0, allies: 0, pledgeKept: 0, pledgeBroken: 0, gifts: 0, arms: 0, lent: 0, hh: 0, offensives: 0, warned: 0, byMonth: [0, 0, 0], worldBattles: 0, scatters: 0, wipes: 0, rests: 0, losePath: '', refought: 0, refoughtWave: 0, refoughtSame: 0, refoughtLate: 0, refoughtUs: 0, refoughtAny: 0, coal: 0, coalFirst: -1, coalSize: 0, coalEnds: {}, coalOff: 0, offAfter: 0, lostAfter: 0, sinkLate: 0, grainEnd: 0, ironEnd: 0, wonders: 0, wondersAi: 0, feasts: 0, guests: 0, firstWonder: -1 }
  const sinkBy: number[] = []
  // 계절 수로 돌린다 — 달 시계 판이면 계절마다 석 턴 (calendar.perSeason)
  const per = perSeason(r)
  // 우리 싸움의 고을 → 그 턴 · 친 나라 · 지킨 나라 (다시 싸운 고을)
  const lastAt = new Map<string, { t: number; atk: string; def: string; late: Set<string> }>()
  // 누구의 싸움이든 그 고을의 마지막 싸움 턴
  const anyAt = new Map<string, number>()
  for (let s = 0; s < SEASONS * per; s++) {
    if (s === EARLY * per) run.nodesEarly = own(r)
    const orders = [...decide(r, as, bot), ...aiOrders(r)]
    const { next, report } = advance(r, orders)
    for (const l of report.lines) {
      if (l.kind === 'settle' && l.faction === as) run.settled++
      if (l.kind === 'wonder' && l.faction === as && (l.ev === 'pour' || l.ev === 'beaten')) { const k = Math.floor(s / per); sinkBy[k] = (sinkBy[k] ?? 0) + (l.ev === 'pour' ? (l.grain ?? 0) : -(l.grain ?? 0)) }
      if (l.kind === 'feast' && l.faction === as) { const k = Math.floor(s / per); sinkBy[k] = (sinkBy[k] ?? 0) + l.grain; run.feasts++; if (l.got === 'guest') run.guests++ }
      if (l.kind === 'wonder' && l.ev === 'done') { if (l.faction === as) { run.wonders++; if (run.firstWonder < 0) run.firstWonder = Math.floor(s / per) } else run.wondersAi++ }
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
      if (l.kind === 'scatter') {
        run.scatters++
        if (l.wiped) run.wipes++
      }
      if (l.kind === 'beaten') run.rests++
      if (l.kind === 'coalition') {
        if (l.ev === 'form') {
          run.coal++
          run.coalSize += l.members.length
          if (run.coalFirst < 0) run.coalFirst = Math.floor(s / per)
        } else if (l.ev !== 'strike' && l.ev !== 'leave') run.coalEnds[l.ev] = (run.coalEnds[l.ev] ?? 0) + 1
      }
      if (l.kind === 'take' && run.coalFirst >= 0 && r.nodes[l.node]?.owner === as && l.faction !== as) run.lostAfter++
      if (l.kind !== 'battle') continue
      run.worldBattles++
      // 나눈 별동대도 우리 군대다 — 넘기기 전 판에서 주인을 본다
      const weAttack = r.armies[l.attacker]?.faction === as
      const weDefend = l.defender === as
      if (weDefend && !weAttack && (l.atkFaction ?? r.armies[l.attacker]?.faction) !== as) {
        run.offensives++
        if (run.coalFirst >= 0) run.offAfter++
        const cc = r.coalition
        if (cc != null && r.season >= cc.strikeAt && r.season < cc.endAt && cc.members.includes(l.atkFaction ?? '')) run.coalOff++
        const pre = r.armies[l.attacker]
        if (pre !== undefined && ((pre.march !== null && pre.march.to === l.node) || (pre.strike?.at === r.season && pre.strike.node === l.node))) run.warned++
        run.byMonth[((r.season % per) + per) % per]! += 1
      }
      const anyPrev = anyAt.get(l.node)
      anyAt.set(l.node, r.season)
      if (!weAttack && !weDefend) continue
      run.battles++
      if (anyPrev !== undefined && r.season - anyPrev <= REFIGHT) run.refoughtAny++
      const atkF = l.atkFaction ?? r.armies[l.attacker]?.faction ?? ''
      const prev = lastAt.get(l.node)
      if (prev !== undefined && r.season - prev.t <= REFIGHT) {
        run.refought++
        if (prev.atk === atkF && prev.def === l.defender) run.refoughtWave++
        if (prev.t === r.season) run.refoughtSame++
        if ([l.attacker, ...l.allies].some((id) => prev.late.has(id))) run.refoughtLate++
        if (weAttack) run.refoughtUs++
      }
      // 이 싸움 뒤에도 이 고을로 오던(또는 채비한) 군대 — 다음 싸움이 이들이면 따로 닿은 원군이다
      const late = new Set(Object.values(next.armies).filter((x) => x.march?.to === l.node || x.strike?.node === l.node).map((x) => x.id))
      lastAt.set(l.node, { t: r.season, atk: atkF, def: l.defender, late })
      const atkWon = l.outcome === 'rout' || l.outcome === 'win'
      if ((weAttack && atkWon) || (weDefend && (l.outcome === 'lose' || l.outcome === 'routed'))) run.wins++
      if (l.captured !== null && next.heroes[l.captured]?.captor === as) run.captured++
    }
    r = next
    if (r.outcome !== null) break
  }
  {
    const last = Math.ceil(r.season / per)
    for (let k = Math.max(0, last - 20); k <= last; k++) run.sinkLate += sinkBy[k] ?? 0
    run.grainEnd = Math.round(r.stock[as]?.grain ?? 0)
    run.ironEnd = Math.round(r.stock[as]?.iron ?? 0)
  }
  if (run.nodesEarly < 0) run.nodesEarly = own(r) // EARLY 전에 판이 끝났다
  run.nodes = own(r)
  run.win = r.outcome?.kind === 'win'
  run.lose = r.outcome?.kind === 'lose'
  if (run.lose) run.losePath = r.outcome?.path ?? 'conquest'
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

console.log(`나라 시뮬 — ${REGION === "yeongnam" ? "영남 판 스물한 나라" : "변한 6국 축소판"} · ${GAMES}판 × ${SEASONS}계절 (${P.realm.monthClock >= 1 ? '한 턴 한 달' : '한 턴 한 계절'}) · 봇이 고른 나라를 맡는다\n`)
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

// 싸움의 끝맺음 (FOCUS C · 형: "400, 300, 200 계속 옴, 섬멸 안 됨") — 적 공세: 남이 우리를 친 싸움/판 ·
// 판 싸움·흩어짐·섬멸·쉬기는 판 전체(모든 나라)의 판당 수 · 짐의 갈래
console.log(`\n나라    봇          짐     싸움/판  적 공세/판  판 싸움/판  판 흩어짐  판 섬멸  판 쉬기  끝땅   짐: 정복  철·뱃길  제사  맹주`)
for (const as of AS) {
  for (const bot of BOTS) {
    const rs = runs.filter((x) => x.bot === bot && x.as === as)
    const by = (p: string): string => pct(mean(rs.map((x) => (x.losePath === p ? 1 : 0)))).padStart(6)
    console.log(
      `${as.padEnd(7)} ${bot.padEnd(9)} ${pct(mean(rs.map((x) => (x.lose ? 1 : 0)))).padStart(6)}  ${mean(rs.map((x) => x.battles)).toFixed(2).padStart(7)}  ` +
      `${mean(rs.map((x) => x.offensives)).toFixed(2).padStart(9)}  ${mean(rs.map((x) => x.worldBattles)).toFixed(2).padStart(9)}  ` +
      `${mean(rs.map((x) => x.scatters)).toFixed(2).padStart(8)}  ${mean(rs.map((x) => x.wipes)).toFixed(2).padStart(6)}  ${mean(rs.map((x) => x.rests)).toFixed(2).padStart(6)}  ` +
      `${mean(rs.map((x) => x.nodes)).toFixed(2).padStart(5)}  ${by('conquest')}  ${by('ironsea')}  ${by('rite')}  ${by('suzerain')}`,
    )
  }
}

// 예고 (loop 리뷰 11-01) — 적 공세 가운데 앞 턴에 이미 보이던 것 · 계절 안 몇째 달에 맞았나 (달 시계 판만 셋으로 갈린다)
console.log(`\n나라    봇          적 공세   예고됨   첫 달  둘째 달  셋째 달`)
for (const as of AS) {
  for (const bot of BOTS) {
    const rs = runs.filter((x) => x.bot === bot && x.as === as)
    const off = rs.reduce((a, x) => a + x.offensives, 0)
    const m = [0, 1, 2].map((i) => rs.reduce((a, x) => a + x.byMonth[i]!, 0))
    const share = (n: number): string => pct(off > 0 ? n / off : 0).padStart(6)
    console.log(`${as.padEnd(7)} ${bot.padEnd(9)} ${String(off).padStart(7)}  ${share(rs.reduce((a, x) => a + x.warned, 0))}  ${share(m[0]!)}  ${share(m[1]!)}  ${share(m[2]!)}`)
  }
}

// 다시 싸운 고을 (loop 리뷰 #5) — 우리 싸움 가운데 같은 고을에서 REFIGHT 턴 안에 또 싸운 것 · 그 가운데 같은 나라가 같은 쪽으로(따로 닿은 원군) · 같은 턴
console.log(`\n나라    봇          우리 싸움  다시 싸움(${REFIGHT}턴 안)  같은 쪽 또  같은 턴  따로 닿은 원군  우리가 친 것  남의 싸움 포함`)
for (const as of AS) {
  for (const bot of BOTS) {
    const rs = runs.filter((x) => x.bot === bot && x.as === as)
    const all = rs.reduce((a, x) => a + x.battles, 0)
    const sum = (f: (x: Run) => number): number => rs.reduce((a, x) => a + f(x), 0)
    const share = (n: number): string => pct(all > 0 ? n / all : 0).padStart(6)
    console.log(`${as.padEnd(7)} ${bot.padEnd(9)} ${String(all).padStart(8)}  ${share(sum((x) => x.refought)).padStart(17)}  ${share(sum((x) => x.refoughtWave)).padStart(9)}  ${share(sum((x) => x.refoughtSame)).padStart(6)}  ${share(sum((x) => x.refoughtLate)).padStart(13)}  ${share(sum((x) => x.refoughtUs)).padStart(11)}  ${share(sum((x) => x.refoughtAny)).padStart(13)}`)
  }
}


// 합종 (coalition.ts · 위원회 11-08 ⑤) — 연합이 선 판 · 판당 선 수 · 첫 연합 계절(중간값) · 연합 크기 · 끝의 갈래(막아 냄 · 앗고 흩어짐 · 모자라 흩어짐 · 두려움 걷힘) ·
// 연합 출정 동안 맞은 적 공세 · 첫 연합 뒤 맞은 적 공세 · 첫 연합 뒤 잃은 고을
console.log(`\n나라    봇          연합 선 판  연합/판  첫 연합(중간)  크기   막아 냄  앗고 흩어짐  모자라 흩어짐  걷힘   출정 중 공세/판  첫 연합 뒤 공세/판  뒤 잃은 고을/판`)
for (const as of AS) {
  for (const bot of BOTS) {
    const rs = runs.filter((x) => x.bot === bot && x.as === as)
    const firsts = rs.map((x) => x.coalFirst).filter((v) => v >= 0).sort((a, b) => a - b)
    const med = firsts.length === 0 ? '-' : String(firsts[Math.floor(firsts.length / 2)])
    const coal = rs.reduce((a, x) => a + x.coal, 0)
    const ends = (k: string): string => mean(rs.map((x) => x.coalEnds[k] ?? 0)).toFixed(2).padStart(6)
    console.log(`${as.padEnd(7)} ${bot.padEnd(9)} ${pct(firsts.length / Math.max(1, rs.length)).padStart(9)}  ${mean(rs.map((x) => x.coal)).toFixed(2).padStart(6)}  ${med.padStart(12)}  ${(coal > 0 ? rs.reduce((a, x) => a + x.coalSize, 0) / coal : 0).toFixed(1).padStart(4)}  ${ends('broken')}  ${ends('spent').padStart(10)}  ${ends('scatter').padStart(12)}  ${ends('fade')}  ${mean(rs.map((x) => x.coalOff)).toFixed(2).padStart(14)}  ${mean(rs.map((x) => x.offAfter)).toFixed(2).padStart(17)}  ${mean(rs.map((x) => x.lostAfter)).toFixed(2).padStart(14)}`)
  }
}
if (OUT !== '') {
  const head = 'as,bot,seed,nodesEarly,nodes,win,lose,battles,wins,captured,lostHero'
  const body = runs.map((x) => [x.as, x.bot, x.seed, x.nodesEarly, x.nodes, x.win ? 1 : 0, x.lose ? 1 : 0, x.battles, x.wins, x.captured, x.lostHero ? 1 : 0].join(','))
  writeFileSync(OUT, [head, ...body].join('\n') + '\n')
  console.log(`\n→ ${OUT}`)
}

// 곳간을 부을 곳 (wonders.ts · 위원회 11-08 ⑦) — 마지막 20계절에 큰 공사·큰 잔치로 부은 곡식 · 판 끝 곳간 · 부은 몫 = 부은 것 ÷ (부은 것 + 판 끝 곳간) ·
// 우리가 지은 공사/판 · 남이 지은 공사/판 · 첫 공사(중간 계절) · 잔치/판 · 이름난 손님/판 · 판 끝 철
console.log(`\n나라    봇          뒤20 부은 곡식  판 끝 곳간  부은 몫   우리 공사  남 공사  첫 공사  잔치/판  손님/판  판 끝 철`)
for (const as of AS) {
  for (const bot of BOTS) {
    const rs = runs.filter((x) => x.bot === bot && x.as === as)
    const sink = mean(rs.map((x) => x.sinkLate))
    const end = mean(rs.map((x) => x.grainEnd))
    const fw = rs.map((x) => x.firstWonder).filter((v) => v >= 0).sort((a, b) => a - b)
    console.log(`${as.padEnd(7)} ${bot.padEnd(9)} ${sink.toFixed(0).padStart(13)}  ${end.toFixed(0).padStart(10)}  ${pct(sink + end > 0 ? sink / (sink + end) : 0).padStart(7)}  ${mean(rs.map((x) => x.wonders)).toFixed(2).padStart(8)}  ${mean(rs.map((x) => x.wondersAi)).toFixed(2).padStart(6)}  ${(fw.length === 0 ? '-' : String(fw[Math.floor(fw.length / 2)])).padStart(6)}  ${mean(rs.map((x) => x.feasts)).toFixed(2).padStart(6)}  ${mean(rs.map((x) => x.guests)).toFixed(2).padStart(6)}  ${mean(rs.map((x) => x.ironEnd)).toFixed(0).padStart(8)}`)
  }
}
