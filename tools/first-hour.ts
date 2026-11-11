/**
 * 첫 한 시간 깔때기 — 새 판을 헤드리스로 돌려 「첫 싸움 · 첫 생포 · 첫 각성 …」이 몇 턴·몇 분째에 오는지 잰다
 * (docs/realm/MEGAHIT.md 기둥 ①② · §6 · 결과와 가정은 docs/realm/FIRST-HOUR.md)
 *
 *   node --experimental-strip-types tools/first-hour.ts [--seeds 30] [--turns 120] [--bot cautious|planner|reckless|greedy] [--boards tutorial,mahan,byeonhan-mini]
 *
 * 새 사람처럼 — 규칙을 다 아는 최적 봇이 아니라 기본 두뇌(cautious)가 이웃을 치고, 싸움의 명령은 맡긴 대로(AI 가 고른다),
 * 배우는 판은 판 자체가 겨루기 → 사로잡기를 한 깃발씩만 내민다(tactics.leadOptions lesson). 등용은 봇의 회유 명령을 그대로 쓴다.
 * 결정론: 같은 씨앗이면 같은 표. 시계는 안 쓴다 — 「분」은 턴마다 사건 비용을 더한 가정치다(FIRST-HOUR.md 가정 표).
 */
import { aiOrders, decide, type Brain } from '../src/realm/ai.ts'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { advance } from '../src/realm/season.ts'
import { COSTS, MILES, NAMES, headFlags, noCounts, scanReport, turnSeconds, type Mile } from './first-hour-lib.ts'
import { goalState } from '../src/realm/scenario.ts'
import { P } from '../src/tune/params.ts'
import type { Order, Realm, RegionId } from '../src/realm/types.ts'

const args = process.argv.slice(2)
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : def
}
const SEEDS = Number(opt('seeds', '30'))
const TURNS = Number(opt('turns', '120'))
const BOT = opt('bot', 'cautious') as Brain
const BOARDS = opt('boards', 'tutorial,mahan,byeonhan-mini').split(',') as RegionId[]
// --set ascendWins=2,tacDuelMu=5 — 고쳐 보면 어떻게 되나 (params.ts 를 고치기 전에 · realm-sim 과 같은 길)
for (const kv of opt('set', '').split(',').filter((x) => x !== '')) {
  const [k, v] = kv.split('=')
  ;(P.realm as unknown as Record<string, number>)[k!] = Number(v)
}
const PLAYER: Partial<Record<RegionId, string>> = { tutorial: 'baekje', mahan: 'baekje', 'byeonhan-mini': 'us' }

interface Seen { turn: number; min: Record<'lo' | 'mid' | 'hi', number> }
type Run = Partial<Record<Mile, Seen>> & { turns: number; won: boolean }

function play(board: RegionId, seed: number): Run {
  const as = PLAYER[board] ?? 'us'
  let r: Realm = startRegion(board, seed, as)
  const run: Run = { turns: 0, won: false }
  const tut = board === 'tutorial'
  const cum = { lo: COSTS.lo.intro, mid: COSTS.mid.intro, hi: COSTS.hi.intro }
  const startKnown = new Set(r.known?.[as] ?? [])
  const goalAt = (): number => (r.scenario?.win ?? []).reduce((a, g) => a + goalState(r, g).have, 0)
  const goal0 = goalAt()
  let pendingTalk = false
  const mark = (m: Mile, t: number): void => { if (run[m] === undefined) run[m] = { turn: t + 1, min: { lo: cum.lo / 60, mid: cum.mid / 60, hi: cum.hi / 60 } } }
  // 같은 턴에 일어난 일은 턴 끝의 누적으로 적는다 → 사건을 모아 두었다 한꺼번에 더하고 적는다
  for (let t = 0; t < TURNS; t++) {
    const flags = new Set<Mile>()
    const c = noCounts()
    headFlags(r, as, flags, c)
    // 배우는 판의 안내는 사로잡은 적장을 곧바로 회유하라고 한다(tutorial.ts 5·6단계) — 봇이 곡식을 아끼다 안 하지 않게 안내를 흉내 낸다
    const guide: Order[] = []
    if (tut) for (const h of Object.values(r.heroes)) if (h.status === 'captive' && h.captor === as && h.persuade === undefined) guide.push({ kind: 'persuade', hero: h.id, by: 'tut-onjo' })
    const orders = [...decide(r, as, BOT), ...guide, ...aiOrders(r)]
    const { next, report } = advance(r, orders)
    scanReport(r, next, report.lines, as, tut, startKnown, flags, c)

    r = next
    if (r.scenario !== undefined && goalAt() > goal0) flags.add('goal')
    // 배우는 판 — 회유는 안내대로 사로잡은 바로 다음 달 담판으로 끝난다고 친다(봇은 담판 놀이를 못 해 몇 달 걸린다). 담판 시간을 더한다
    const scriptedRecruit = tut && pendingTalk
    pendingTalk = false
    if (tut && c.captures > 0) pendingTalk = true
    if (scriptedRecruit) { c.recruits++; flags.add('recruit') }
    for (const k of ['lo', 'mid', 'hi'] as const) cum[k] += turnSeconds(COSTS[k], tut, c)
    for (const m of flags) mark(m, t)
    run.turns = t + 1

    if (r.outcome != null) { run.won = r.outcome.kind === 'win'; break }
  }
  return run
}

const pct = (xs: number[], p: number): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]! }

for (const board of BOARDS) {
  const runs: Run[] = []
  for (let g = 0; g < SEEDS; g++) runs.push(play(board, 1000 + g))
  const per = 3 // 한 계절 = 석 달 (달 시계)
  const k0 = startRegion(board, 1000, PLAYER[board] ?? 'us')
  const known0 = (k0.known?.[PLAYER[board] ?? 'us']?.length ?? 0) + 1
  console.log(`\n## ${board} — ${SEEDS}판 · ${TURNS}턴 상한 · 봇 ${BOT} · 이긴 판 ${(runs.filter((x) => x.won).length / SEEDS * 100).toFixed(0)}% · 끝난 턴 중간값 ${pct(runs.map((x) => x.turns), 0.5)}`)
  console.log(`처음부터 아는 나라 ${known0}/${Object.keys(k0.factions).length} (다 알면 「만남」은 일어나지 않는다)`)
  console.log('사건'.padEnd(18) + '일어난 판  턴 p25/중간/p75   계절(중간)  분 중간(낮음~높음)   60분 안')
  for (const m of MILES) {
    const hit = runs.map((x) => x[m]).filter((x): x is Seen => x !== undefined)
    if (hit.length === 0) { console.log(NAMES[m].padEnd(16) + '   0%  (상한 안에 한 번도 없음)'); continue }
    const ts = hit.map((x) => x.turn)
    const mid = hit.map((x) => x.min.mid)
    const lo = hit.map((x) => x.min.lo)
    const hi = hit.map((x) => x.min.hi)
    const within = runs.filter((x) => (x[m]?.min.mid ?? 1e9) <= 60).length
    console.log(
      `${NAMES[m].padEnd(16)} ${(hit.length / SEEDS * 100).toFixed(0).padStart(4)}%  ` +
      `${String(pct(ts, 0.25)).padStart(4)} / ${String(pct(ts, 0.5)).padStart(4)} / ${String(pct(ts, 0.75)).padStart(4)}      ` +
      `${(pct(ts, 0.5) / per).toFixed(1).padStart(5)}      ${pct(mid, 0.5).toFixed(0).padStart(4)}분 (${pct(lo, 0.5).toFixed(0)}~${pct(hi, 0.5).toFixed(0)})        ${(within / SEEDS * 100).toFixed(0)}%`,
    )
  }
}
