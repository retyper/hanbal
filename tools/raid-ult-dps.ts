// 열전 궁극기 DPS 예측 (11-16 형: 「무기마다 다르게 · DPS 예측해서 밸런스 조절」)
//   node --experimental-strip-types tools/raid-ult-dps.ts [씨앗 7,11]
//   ULT='{"axe":{"damage":300}}' — params.ts 를 고치지 않고 값을 바꿔 재 본다 (전장은 params 값으로 뜨고, 바꾼 값은 궁극기를 쓸 때만 · 조율 중 잡음 없이)
//
// 어떻게 재나: 여섯 묶음 봇이 숲 산길을 (상점 조금 산 채로) 달리다 초반 1분·중반 5분·후반 13분·두목 때에 판을 떠 둔다(전장).
// 전장마다 두 벌로 복제해 평타·조합·날아가던 우리 투사체를 모두 끄고, 한 벌만 궁극기를 쓴 채 1초를 돌린다 —
// 두 벌의 피해 차이 = 궁극기 한 번의 피해(쓰러뜨린 적의 남은 체력까지만 센다). DPS = 한 번 피해 ÷ 재사용 시간.
// 「공통 전장」은 여섯 묶음 전장을 다 모아 놓고 궁극기만 바꿔 쓴 값 (꼴 비교 · 밸런스 기준) · 「제 전장」은 그 묶음 판에서만.
import * as P from '../src/tune/params.ts'
import { createHaebi, choose, stepHaebi, bossTime, runDuration, KITS, type HaebiRun, type Kit, type StageId } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
import { stageToolOpts, toolPolicy, toolSourceSha256 } from './raid-stage-balance.ts'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

// STAGE=ford RULES=55-IMUGI|56B AWAKEN=0|1 MAX_STEPS=300000; default forest follows raidRulesForStage (55-GUMIHO) · RULES=56B keeps the old forest lane.
export function ultToolConfig(env: NodeJS.ProcessEnv = process.env) {
  const stage = env['STAGE'] ?? 'forest', policy = toolPolicy(env)
  if (!['forest', 'ford', 'palisade', 'snow', 'fortress'].includes(stage)) throw new Error('Unsupported STAGE')
  return { stage: stage as StageId, ...policy, only: env['ONLY'] }
}

const ULT = (P as unknown as { HAEBI_ULT?: Record<string, Record<string, number>> }).HAEBI_ULT
const cooldown = (kit: Kit) => ULT?.[kit]?.['cooldown'] ?? (P.HAEBI_RUN as unknown as { skillCooldown: number }).skillCooldown
const KITS6 = Object.keys(KITS) as Kit[]
// 두목은 나오자마자 (봇 판이 두목을 1초 안팎에 잡는다) · ONLY=1 이면 그 국면만 (0 초반 · 1 중반 · 2 후반 · 3 두목)
const moments = (only?: string) => ([['초반 1분', 60, [0, 3, 6, 9]], ['중반 5분', 300, [0, 3, 6, 9]], ['후반 13분', 780, [0, 3, 6, 9]], ['두목', -1, [.05, .15, .25, .35]]] as const).filter((_, i) => only === undefined || String(i) === only)
// 시전(cast · 판이 slow 배로 느려짐)이 끝나야 터지므로 그만큼 더 본다 (11-17)
const RUN_DT = 1 / 60, DT = 1 / 120, WINDOW = 1 + P.HAEBI_ULT.cast / P.HAEBI_ULT.slow
const BONUS = { vigor: 3, might: 2, armor: 1 }

type Field = { kit: Kit; moment: number; s: HaebiRun; total: number }
export function collectUltFields(kit: Kit, seed: number, config = ultToolConfig()) {
  const opts = stageToolOpts(config.stage, BONUS, config.rules, config.awake), s = createHaebi(seed, 'stage', kit, opts), deadline = runDuration(s)
  const MOMENTS = moments(config.only)
  const at = MOMENTS.flatMap(([, t, offs], m) => offs.map(o => ({ m, t: (t < 0 ? bossTime(s) : t) + o })))
  const samples = at.map(a => ({ moment: a.m, targetTime: a.t, capturedAt: null as number | null, bossHP: null as number | null, bossRole: null as string | null }))
  const out: Field[] = [], hist: [number, number][] = []
  let operations = 0, stopReason: string | null = null, error: string | null = null
  try {
    while (s.state === 'playing' && at.length) {
      if (operations >= config.maxOperations) { stopReason = 'operation_limit'; break }
      if (s.t > deadline + 30) { stopReason = 'time_guard'; break }
      operations++
      if (s.offers.length) choose(s, botChoice(s, 'storm')); else stepHaebi(s, botInput(s), RUN_DT)
      if (!hist.length || s.t - hist[hist.length - 1]![0] >= 1) hist.push([s.t, s.damage])
      if (s.t >= at[0]!.t) {
        const back = hist.find(h => h[0] >= s.t - 30) ?? hist[0]!
        const boss = s.enemies.find(e => e.giant) ?? s.enemies.find(e => e.kind === 'boss')
        const sample = samples[out.length]!
        out.push({ kit, moment: at[0]!.m, s: structuredClone(s), total: (s.damage - back[1]) / Math.max(1, s.t - back[0]) })
        sample.capturedAt = s.t; sample.bossHP = boss?.hp ?? null; sample.bossRole = boss?.bossRole ?? (boss ? 'legacy_final' : null)
        at.shift()
      }
    }
  } catch (e) { stopReason = 'engine_error'; error = String(e) }
  return { fields: out, report: { kit, seed, stage: config.stage, simRules: opts.simRules, permanentAwake: config.awake, runDuration: deadline, state: s.state, time: s.t, hp: s.hp, maxHp: s.maxHp, operations, stopReason, error, allRequestedFieldsCaptured: at.length === 0, samples } }
}
/** 평타·조합·투사체를 끈 판 — 이 판에서 나는 피해는 궁극기(와 남은 독)뿐 */
function quiet(s: HaebiRun) {
  for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) s.cool[k] = 99
  s.xp = -1e9; s.maxHp = s.hp = 1e9
}
function cast(f: Field, kit: Kit) {
  const a = structuredClone(f.s); a.kit = kit; a.skillCd = 0
  a.shots = a.shots.filter(b => b.kind === 'enemy' || b.kind === 'hurl' || b.kind === 'stone' || b.kind === 'flame' || b.kind === 'barrage')
  quiet(a); const b = structuredClone(a)
  const boss = a.enemies.find(e => e.giant) ?? a.enemies.find(e => e.kind === 'boss')
  // Only the new permanent-awake lane may need a longer first-cast window.
  const window = a.permanentAwake ? Math.max(WINDOW, P.HAEBI_AWAKEN_ULT.firstWall + 1) : WINDOW
  for (let i = 0; i < window / DT; i++) {
    const input = botInput(a); quiet(a); quiet(b)
    stepHaebi(a, { ...input, skill: i === 0, dash: false }, DT); stepHaebi(b, { ...input, skill: false, dash: false }, DT)
  }
  const bossHp = (s: HaebiRun) => Math.max(0, s.enemies.find(e => e.id === boss?.id)?.hp ?? 0)
  return { damage: a.damage - b.damage, boss: boss ? bossHp(b) - bossHp(a) : 0 }
}
function main() {
const seeds = (process.argv[2] ?? '7,11,23').split(',').map(Number), config = ultToolConfig(), MOMENTS = moments(config.only)
const all: Field[] = [], captures: ReturnType<typeof collectUltFields>['report'][] = [], estimates: object[] = []
console.log(`정지 복제 궁극기 실험 · stage=${config.stage} rules=${stageToolOpts(config.stage, BONUS, config.rules).simRules} AWAKEN=${Number(config.awake)} · full-run 승률/생존 통계 아님`)
for (const kit of KITS6) for (const seed of seeds) { const result = collectUltFields(kit, seed, config), f = result.fields; captures.push(result.report); all.push(...f); if (result.report.error) process.exitCode = 1; if (f.length < MOMENTS.reduce((n, m) => n + m[2].length, 0)) console.log(`  (${kit}/${seed} 판이 ${f.length}번째 전장에서 끝남 · ${result.report.stopReason ?? result.report.state})`) }
for (const [k, v] of Object.entries(JSON.parse(process.env['ULT'] ?? '{}'))) Object.assign(ULT![k]!, v)
const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
const fmt = (n: number) => String(Math.round(n)).padStart(6)
for (const [m, [name, when]] of MOMENTS.entries()) {
  const here = all.filter(f => f.moment === m)
  const total = avg(here.map(f => f.total)), enemies = avg(here.map(f => f.s.enemies.length))
  console.log(`\n■ ${name} — 전장 ${here.length}개 · 평균 적 ${Math.round(enemies)} · 평균 총 DPS ${Math.round(total)}`)
  console.log('묶음    재사용 | 공통 전장: 한 번 피해  궁 DPS  비중 | 제 전장: 한 번 피해  궁 DPS  비중' + (when < 0 ? ' | 두목에 한 번' : ''))
  const rows = KITS6.map(kit => {
    const common = here.map(f => cast(f, kit)), own = here.filter(f => f.kit === kit), mine = own.map(f => cast(f, kit))
    const cd = cooldown(kit), one = avg(common.map(c => c.damage)), oneOwn = avg(mine.map(c => c.damage)), totalOwn = avg(own.map(f => f.total))
    return { kit, cd, one, dps: one / cd, share: one / cd / total, oneOwn, dpsOwn: oneOwn / cd, shareOwn: totalOwn ? oneOwn / cd / totalOwn : 0, boss: avg(common.map(c => c.boss)) }
  })
  estimates.push({ moment: m, name, fields: here.length, total: here.length ? total : null, enemies: here.length ? enemies : null, rows: here.length ? rows : null })
  const mean = avg(rows.map(r => r.dps))
  for (const r of rows) console.log(`${r.kit.padEnd(7)} ${String(r.cd).padStart(4)}초 | ${fmt(r.one)} ${fmt(r.dps)} (${(r.dps / mean * 100 - 100 >= 0 ? '+' : '') + Math.round(r.dps / mean * 100 - 100)}%) ${String(Math.round(r.share * 100)).padStart(3)}% | ${fmt(r.oneOwn)} ${fmt(r.dpsOwn)} ${String(Math.round(r.shareOwn * 100)).padStart(3)}%` + (when < 0 ? ` | ${fmt(r.boss)}` : ''))
}

if (process.env['OUTJSON']) writeFileSync(process.env['OUTJSON'], JSON.stringify({ metricKind: 'quiet-cloned-ult-dps-estimate', fullRunMetric: false, note: 'Field collection uses ordinary bot/create/choose/step. Cloned experiment intentionally sets HP/XP/cooldowns, filters projectiles and swaps kit; never combine with full-run survival or win statistics. DPS uses the original nominal cooldown formula, not effective awakened cadence. Missing fields stay null; early completion after requested snapshots is not a full run.', config: { ...config, requestedRules: config.rules ?? 'raidRulesForStage', seeds, bonus: BONUS, choice: 'storm', runDt: RUN_DT, quietDt: DT, baseWindow: WINDOW, awakenedWindow: Math.max(WINDOW, P.HAEBI_AWAKEN_ULT.firstWall + 1), ultOverride: JSON.parse(process.env['ULT'] ?? '{}') }, provenance: { node: process.version, sourceSha256: toolSourceSha256() }, captures, estimates }, null, 2) + '\n')
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
