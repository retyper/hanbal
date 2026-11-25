// 첫 각성까지 걸리는 시간 (11-25 · 봇) — 새 계정(상점 0 · 금 0)이 한 장수로 숲 → 여울 → 목책을 이길 때까지 판을 이어 돌고,
// 목책을 처음 이긴 때(= 영구 각성의 문 · 33-decisions 3번)까지 판 수와 판 안 시간을 잰다. 판 사이 시간·메뉴·읽기는 0 (사람 시간이 아니다).
//   node --experimental-strip-types tools/raid-first-awaken.ts
//   쪼개 돌리기: 환경 KITS·POLICIES·OUT 을 나눠 여러 프로세스로 돌린 뒤 AGG=tools/out/first-awaken 으로 모아 본다 (계정마다 한 줄씩 쌓이는 .jsonl)
//   환경: KITS=axe,bow,dagger,sword · SEEDS=7,11,13 · CAP=80 (한 계정 판 수 한도) · POLICIES=cheap,none,cheapgo · OUT=tools/out/first-awaken/result.jsonl
//   정책: cheap = 번 금으로 가장 싼 것부터 다 산다 + 출전 화면이 골라 주는 스테이지(meta.pickStage · 목책 벽 앞이면 여울로 되돌림)를 그대로 따른다
//         cheapgo = 가장 싼 것부터 사되 늘 「아직 못 깬 첫 스테이지」로 곧장 간다 (고른 것을 무시하고 목책을 누르는 사람)
//         none = 아무것도 안 사고 곧장 간다 (아래쪽 끝)
//   규칙 태그: raid-main.ts runOpts 가 새 스테이지 판에 켜는 것 전부 (stageToolOpts 가 켜는 것 + 72-BOSSHIT). 영구 각성 없음(첫 각성 전).
import { createHaebi, choose, stepHaebi, runDuration, runGold, type Kit, type StageId, type Bonus } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
import { buy, record, pickStage, shopCost, shopMax, SHOP, STAGE_ORDER, type RaidMeta, type ShopKey } from '../src/raid/meta.ts'
import { NO_BONUS } from '../src/raid/haebi.ts'
import { stageToolOpts } from './raid-stage-balance.ts'
import { mkdirSync, writeFileSync, appendFileSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

type Policy = 'cheap' | 'cheapgo' | 'none'
type Stg = Exclude<StageId, 'trial'>
const REACT = .5, GOAL: Stg = 'palisade'

/** 새 판 한 번 — 규칙 태그는 raid-main runOpts 와 같다 (stageToolOpts 전부 켬 + bossHitRules). 반환: 끝 상태 · 판 안 시간(초) · 받는 금 */
export function playRun(stage: Stg, kit: Kit, seed: number, bonus: Bonus) {
  const opts = stageToolOpts(stage, bonus, undefined, false, true, true, true, true, true, true, true, true, true, true, true) as Record<string, unknown>
  opts['bossHitRules'] = '72-BOSSHIT'
  const s = createHaebi(seed, 'stage', kit, opts), duration = runDuration(s)
  let guard = 0
  while (s.state === 'playing' && s.t <= duration + 30 && guard++ < 400000) {
    if (s.offers.length) choose(s, botChoice(s, 'storm'))
    else stepHaebi(s, botInput(s, REACT), 1 / 60)
  }
  return { won: s.state === 'won', seconds: s.t, gold: runGold(s) }
}
const freshMeta = (): RaidMeta => ({ gold: 0, spent: 0, shop: { ...NO_BONUS }, cleared: {}, best: {}, runs: 0, heroes: {}, jackpots: {} })
/** 살 수 있는 가장 싼 것을 더 못 살 때까지 산다 */
function buyCheapest(m: RaidMeta) {
  for (;;) {
    let best: ShopKey | null = null, bc = Infinity
    for (const it of SHOP) { if (m.shop[it.key] >= shopMax(it.key)) continue; const c = shopCost(it.key, m.shop[it.key]); if (c < bc) { bc = c; best = it.key } }
    if (best === null || m.gold < bc || !buy(m, best)) return
  }
}
export interface AccountResult { kit: Kit; seed: number; policy: Policy; cleared: boolean; runs: number; minutes: number; perStage: Record<string, number>; spent: number }
export function account(kit: Kit, seed: number, policy: Policy, cap: number): AccountResult {
  const m = freshMeta(), perStage: Record<string, number> = {}
  let seconds = 0, n = 0
  while (!m.cleared[GOAL] && n < cap) {
    if (policy !== 'none') buyCheapest(m)
    const open = STAGE_ORDER.find(id => !m.cleared[id])!   // 열림 조건은 앞 스테이지를 깸 — 못 깬 첫 스테이지는 늘 열려 있다 (meta.stageOpen)
    const stage = policy === 'cheap' ? pickStage(m, kit) : open
    const r = playRun(stage, kit, seed * 1000 + n, m.shop)   // 판마다 새 씨앗 (같은 계정 = 같은 결과)
    record(m, stage, r.gold, r.won, r.seconds, 'hero')
    seconds += r.seconds; n++; perStage[stage] = (perStage[stage] ?? 0) + 1
  }
  return { kit, seed, policy, cleared: !!m.cleared[GOAL], runs: n, minutes: seconds / 60, perStage, spent: m.spent }
}
const mean = (v: number[]) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN
const median = (v: number[]) => { if (!v.length) return NaN; const a = [...v].sort((x, y) => x - y), i = a.length >> 1; return a.length % 2 ? a[i]! : (a[i - 1]! + a[i]!) / 2 }
function report(all: AccountResult[], cap: number) {
  const kits = [...new Set(all.map(r => r.kit))], policies = [...new Set(all.map(r => r.policy))]
  for (const policy of policies) {
    const rows = all.filter(r => r.policy === policy), ok = rows.filter(r => r.cleared), runs = ok.map(r => r.runs), mins = ok.map(r => r.minutes)
    console.log(`
[${policy}] 계정 ${rows.length}개 (${kits.join('·')}) · 못 깬 계정(${cap}판) ${rows.length - ok.length}`)
    console.log(`  판 수: 가운데 ${median(runs)} · 평균 ${mean(runs).toFixed(1)} · 가장 빠름 ${Math.min(...runs)} · 가장 느림 ${Math.max(...runs)}`)
    console.log(`  판 안 분: 가운데 ${median(mins).toFixed(0)} · 평균 ${mean(mins).toFixed(0)} · 가장 빠름 ${Math.min(...mins).toFixed(0)} · 가장 느림 ${Math.max(...mins).toFixed(0)}`)
    console.log(`  스테이지별 평균 판 수(깬 계정): ${STAGE_ORDER.map(id => `${id} ${mean(ok.map(r => r.perStage[id] ?? 0)).toFixed(1)}`).join(' · ')} · 쓴 금 평균 ${Math.round(mean(ok.map(r => r.spent)))}`)
    for (const k of kits) {
      const kr = rows.filter(r => r.kit === k), kok = kr.filter(r => r.cleared)
      console.log(`  ${k.padEnd(6)} 깸 ${kok.length}/${kr.length} · 판 가운데 ${median(kok.map(r => r.runs))} (${kok.length ? Math.min(...kok.map(r => r.runs)) : '-'}~${kok.length ? Math.max(...kok.map(r => r.runs)) : '-'}) · 분 가운데 ${median(kok.map(r => r.minutes)).toFixed(0)} · ${kr.map(r => r.cleared ? `${r.runs}판` : '못깸').join(' ')}`)
    }
  }
}
function main() {
  const cap = Number(process.env['CAP'] ?? 80)
  if (process.env['AGG']) {   // 나눠 돌린 결과(.jsonl 들)를 모아 보고 (AGG=폴더)
    const dir = resolve(process.env['AGG']), all = readdirSync(dir).filter(f => f.endsWith('.jsonl')).flatMap(f => readFileSync(resolve(dir, f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as AccountResult))
    return report(all, cap)
  }
  const kits = (process.env['KITS'] ?? 'axe,bow,dagger,sword').split(',') as Kit[], seeds = (process.env['SEEDS'] ?? '7,11,13').split(',').map(Number)
  const policies = (process.env['POLICIES'] ?? 'cheap,cheapgo,none').split(',') as Policy[]
  const all: AccountResult[] = [], out = resolve(process.env['OUT'] ?? fileURLToPath(new URL('./out/first-awaken/result.jsonl', import.meta.url)))
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, '')
  for (const policy of policies) for (const k of kits) for (const sd of seeds) { const r = account(k, sd, policy, cap); console.error(`${policy} ${k}/${sd} ${r.cleared ? '깸' : '못 깸'} ${r.runs}판 ${r.minutes.toFixed(0)}분`); all.push(r); appendFileSync(out, JSON.stringify(r) + '\n') }   // 계정 하나 끝날 때마다 한 줄 (중간에 끊겨도 남는다)
  report(all, cap)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
