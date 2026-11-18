/**
 * 첫 한 시간 깔때기 — 새 판을 헤드리스로 돌려 「첫 싸움 · 첫 생포 · 첫 불꽃 참 · 첫 각성 …」이 몇 턴·몇 분째에 오는지 잰다
 * (docs/realm/MEGAHIT.md 기둥 ①② · §6 · 결과와 가정은 docs/realm/FIRST-HOUR.md)
 *
 *   node --experimental-strip-types tools/first-hour.ts [--seeds 30] [--turns 120] [--bot cautious|planner|reckless|greedy] [--boards tutorial,mahan,byeonhan-mini]
 *                                                       [--trial 0|1] [--pass-trial 0|1] [--set ascendWins=2,tacDuelMu=5]
 *
 * 새 사람처럼 — 규칙을 다 아는 최적 봇이 아니라 기본 두뇌(cautious)가 이웃을 치고, 싸움의 명령은 맡긴 대로(AI 가 고른다),
 * 배우는 판은 판 자체가 겨루기 → 사로잡기를 한 깃발씩만 내민다(tactics.leadOptions lesson). 등용은 봇의 회유 명령을 그대로 쓴다.
 * 결정론: 같은 씨앗이면 같은 표. 시계는 안 쓴다 — 「분」은 턴마다 사건 비용을 더한 가정치다(FIRST-HOUR.md 가정 표).
 *
 * 각성은 두 줄로 잰다 (11-18 · docs/realm/study-20261118/30-PROPOSAL.md 바로 고칠 것 11):
 *  - 「첫 불꽃 참(투지 자격)」: 우리 장수의 불꽃이 처음 다 찬 때. 어느 규칙에서나 판의 셈이 낸 값 그대로다.
 *  - 「첫 각성(시련 보정)」: 시련 관문이 열린 규칙(--trial 1 · 지금 params 값)에서는 봇이 8분 시련을 못 하니, 열린 시련을 「이겼다 치고」 깨우고
 *    시련 한 판(8분)과 연출 시간을 더한다. 잰 값이 아니라 보정이다. --pass-trial 0 이면 보정을 끈다(11-18 이전의 표와 같은 판이 된다).
 *  - --trial 0 (각성 v2 · 시련을 본편 관문에서 걷음): 불꽃이 차는 싸움 끝에 곧바로 힘이 붙으니 그 줄은 「첫 투지」가 된다.
 *    각성 모습은 열전 「목책 돌파」의 도깨비 뒤라 본편 셈으로는 못 잰다.
 */
import { aiOrders, decide, type Brain } from '../src/realm/ai.ts'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { advance } from '../src/realm/season.ts'
import { ascendTrialOpen } from '../src/realm/trial-rules.ts'
import { COSTS, MILES, headFlags, mileName, noCounts, passTrials, scanReport, trialSeconds, turnSeconds, type Mile } from './first-hour-lib.ts'
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
const tune = P.realm as unknown as Record<string, number>
for (const kv of opt('set', '').split(',').filter((x) => x !== '')) {
  const [k, v] = kv.split('=')
  tune[k!] = Number(v)
}
// --trial 0|1 — 본편의 시련 관문(P.realm.ascendTrialOpen)을 이 돌림에서만 바꿔 잰다. 안 주면 params.ts 값 그대로
const TRIAL = opt('trial', '')
if (TRIAL !== '') tune['ascendTrialOpen'] = Number(TRIAL) >= 1 ? 1 : 0
const TRIAL_OPEN = ascendTrialOpen()
/** 시련 보정을 하나 — 열린 시련을 이겼다 치고 깨운다 (first-hour-lib.passTrials) */
const PASS = opt('pass-trial', '1') !== '0'
const PLAYER: Partial<Record<RegionId, string>> = { tutorial: 'baekje', mahan: 'baekje', 'byeonhan-mini': 'us' }

interface Seen { turn: number; min: Record<'lo' | 'mid' | 'hi', number> }
type Run = Partial<Record<Mile, Seen>> & { turns: number; won: boolean; trials: number }

function play(board: RegionId, seed: number): Run {
  const as = PLAYER[board] ?? 'us'
  let r: Realm = startRegion(board, seed, as)
  const run: Run = { turns: 0, won: false, trials: 0 }
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
    // 불꽃 참은 각성 연출보다 앞이다 → 연출 시간을 더하기 전에 적는다. 다른 줄은 예전대로 턴 끝의 누적으로 적는다 (더한 합은 같다)
    for (const k of ['lo', 'mid', 'hi'] as const) cum[k] += turnSeconds(COSTS[k], tut, { ...c, ascends: 0 })
    if (flags.has('flameFull')) mark('flameFull', t)
    for (const k of ['lo', 'mid', 'hi'] as const) cum[k] += c.ascends * COSTS[k].ascend
    for (const m of flags) mark(m, t)
    // 시련 보정 — 이 턴의 다른 일을 다 적은 뒤에 시련 시간을 더한다. 그래야 「불꽃 참」에 시련 8분이 섞이지 않는다
    if (PASS) {
      const done = passTrials(r, as)
      if (done.passed > 0) {
        r = done.next
        run.trials += done.passed
        for (const k of ['lo', 'mid', 'hi'] as const) cum[k] += trialSeconds(COSTS[k], done.passed)
        mark('ascend', t)
      }
    }
    run.turns = t + 1

    if (r.outcome != null) { run.won = r.outcome.kind === 'win'; break }
  }
  return run
}

const pct = (xs: number[], p: number): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]! }

const trialMin = `${(COSTS.mid.trial / 60).toFixed(0)}분(낮음 ${(COSTS.lo.trial / 60).toFixed(1)}분)`
console.log(!TRIAL_OPEN
  ? '규칙: 시련 관문 닫힘(ascendTrialOpen 0 · 각성 v2). 불꽃이 다 차는 싸움 끝에 곧바로 투지가 붙는다. 각성 모습은 열전 「목책 돌파」의 도깨비 뒤라 이 도구(본편 셈)로는 못 잰다.'
  : PASS
    ? `규칙: 시련 관문 열림(ascendTrialOpen 1). 불꽃이 다 차면 시련이 열리고 시련을 넘어야 각성한다. 시련 보정 켬: 열린 시련을 이겼다 치고 한 판에 ${trialMin}과 연출 시간을 더했다. 「첫 각성」 줄은 잰 값이 아니라 보정이다.`
    : '규칙: 시련 관문 열림(ascendTrialOpen 1). 시련 보정 끔(--pass-trial 0): 시련을 안 넘으니 시련 장수는 각성하지 않는다.')
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
    const name = mileName(m, TRIAL_OPEN, PASS)
    const hit = runs.map((x) => x[m]).filter((x): x is Seen => x !== undefined)
    if (hit.length === 0) { console.log(name.padEnd(16) + '   0%  (상한 안에 한 번도 없음)'); continue }
    const ts = hit.map((x) => x.turn)
    const mid = hit.map((x) => x.min.mid)
    const lo = hit.map((x) => x.min.lo)
    const hi = hit.map((x) => x.min.hi)
    const within = runs.filter((x) => (x[m]?.min.mid ?? 1e9) <= 60).length
    console.log(
      `${name.padEnd(16)} ${(hit.length / SEEDS * 100).toFixed(0).padStart(4)}%  ` +
      `${String(pct(ts, 0.25)).padStart(4)} / ${String(pct(ts, 0.5)).padStart(4)} / ${String(pct(ts, 0.75)).padStart(4)}      ` +
      `${(pct(ts, 0.5) / per).toFixed(1).padStart(5)}      ${pct(mid, 0.5).toFixed(0).padStart(4)}분 (${pct(lo, 0.5).toFixed(0)}~${pct(hi, 0.5).toFixed(0)})        ${(within / SEEDS * 100).toFixed(0)}%`,
    )
  }
  // 불꽃이 찬 판마다 「불꽃 참 → 각성」 사이 (가운데 가정). 시련을 한 번이라도 넘긴 돌림에서만 낸다 (배우는 판은 예전 길이라 시련이 없다)
  const gaps = runs.flatMap((x) => x.flameFull !== undefined && x.ascend !== undefined ? [x.ascend.min.mid - x.flameFull.min.mid] : [])
  const trials = runs.map((x) => x.trials)
  if (PASS && gaps.length > 0 && Math.max(...trials) > 0) console.log(`불꽃 참에서 각성까지(가운데 가정): 중간 ${pct(gaps, 0.5).toFixed(0)}분 (${Math.min(...gaps).toFixed(0)}~${Math.max(...gaps).toFixed(0)}) · 한 판에 넘긴 시련 수: 중간 ${pct(trials, 0.5)} (${Math.min(...trials)}~${Math.max(...trials)}) · 시련은 이겼다 친 보정이다`)
}
