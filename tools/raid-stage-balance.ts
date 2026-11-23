// Stage bot full runs. Default rules follow the production stage resolver; RULES=56B preserves the old comparison lane.
// CLI: [stages] [kits] [seeds]; BUILD=on|off (CLI 기본 on = 새 판의 65-BUILD 설치 갈래 · off = 세 갈래 옛 판) CAP=on|off (CLI 기본 on = 66-CAP 최고 레벨 뒤 회복·금 · off = 옛 판) KITS=58|off (CLI 기본 58 = 새 판의 무기 개성 규칙 · off = 옛 무기 셈) JACKPOT=on|off (CLI 기본 on = 새 판의 잭팟 상자 · off = 옛 고르는 상자) MAP=wide|off (CLI 기본 wide = 새 판의 59-WIDE 넓은 맵 · off = 한 장짜리 옛 판) REACT=.5 SHOP=0 AWAKEN=0|1 RULES=56B|55-IMUGI|56C|55-TIGER|57-BULGASARI|55-GUMIHO|55-SHAMAN MAX_STEPS=300000 OUTJSON=path
import { HAEBI_SHOP, HAEBI_MOBS, HAEBI_STAGES, HAEBI_WIDE } from '../src/tune/params.ts'
import { createHaebi, choose, stepHaebi, respite, KIT_RULES, CHEST_RULES, MAP_RULES, SOLID_RULES, ANCHOR_RULES, BREAK_RULES, BUILD_RULES, CAP_RULES, raidRulesForStage, runDuration, midbossTime, bossTime, giantMob, type HaebiRun, type HaebiOpts, type Mob, type Kit, type Bonus, type StageId } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export type ToolRules = '56B' | '55-IMUGI' | '56C' | '55-TIGER' | '57-BULGASARI' | '55-GUMIHO' | '55-SHAMAN'
export function toolPolicy(env: NodeJS.ProcessEnv = process.env) {
  const rules = env['RULES'], awake = env['AWAKEN'] ?? '0', maxOperations = Number(env['MAX_STEPS'] ?? 300000)
  if (rules !== undefined && rules !== '56B' && rules !== '55-IMUGI' && rules !== '56C' && rules !== '55-TIGER' && rules !== '57-BULGASARI' && rules !== '55-GUMIHO' && rules !== '55-SHAMAN') throw new Error('RULES must be 56B, 55-IMUGI, 56C, 55-TIGER, 57-BULGASARI, 55-GUMIHO or 55-SHAMAN (unset = raidRulesForStage)')
  if (awake !== '0' && awake !== '1') throw new Error('AWAKEN must be 0 or 1')
  if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new Error('MAX_STEPS must be a positive safe integer')
  return { rules: rules as ToolRules | undefined, awake: awake === '1', maxOperations }
}
/** kits: 58-KITS 무기 개성 규칙을 켠다 (부르는 쪽 기본은 옛 셈 · CLI 는 KITS 로 고른다) · jackpot: 60-JACKPOT 상자 규칙을 켠다 (CLI 는 JACKPOT 으로) · wide: 59-WIDE 넓은 맵 (CLI 는 MAP 으로) · solid: 61-SOLID 막는 장식 (CLI 는 SOLID=on|off · 기본 on) · build: 65-BUILD 설치 갈래 (CLI 는 BUILD=on|off · 기본 on) · cap: 66-CAP 최고 레벨 뒤 보상 (CLI 는 CAP=on|off · 기본 on) */
export function stageToolOpts(stage: StageId, bonus: Partial<Bonus>, rules?: ToolRules, awake = false, kits = false, jackpot = false, wide = false, solid = false, build = false, cap = false): HaebiOpts {
  const requested = rules ?? raidRulesForStage(stage)
  return { stage, bonus, simRules: requested === '55-IMUGI' && stage !== 'ford' || (requested === '56C' || requested === '57-BULGASARI') && stage !== 'palisade' || requested === '55-TIGER' && stage !== 'snow' || requested === '55-GUMIHO' && stage !== 'forest' || requested === '55-SHAMAN' && stage !== 'fortress' ? '56B' : requested, permanentAwake: awake, appearanceAwake: true, ...(kits ? { kitRules: KIT_RULES } : {}), ...(jackpot ? { chestRules: CHEST_RULES } : {}), ...(wide ? { mapRules: MAP_RULES } : {}), ...(wide && solid ? { blockRules: SOLID_RULES } : {}), ...(kits ? { anchorRules: ANCHOR_RULES } : {}), ...(kits && process.env['BREAK'] !== 'off' ? { breakRules: BREAK_RULES } : {}), ...(build ? { buildRules: BUILD_RULES } : {}), ...(cap ? { capRules: CAP_RULES } : {}) }
}
export const toolSourceSha256 = () => Object.fromEntries(['src/raid/haebi.ts', 'src/raid/haebi-replay.ts', 'src/raid/champion.ts', 'src/raid/imugi.ts', 'src/raid/tiger.ts', 'src/raid/bulgasari.ts', 'src/raid/gumiho.ts', 'src/raid/shaman.ts', 'src/raid/giant.ts', 'src/raid/giant-core.ts', 'src/raid/palisade.ts', 'src/raid/wide.ts', 'src/tune/params.ts', 'tools/raid-stage-balance.ts', 'tools/raid-ult-dps.ts'].map(path => [path, createHash('sha256').update(readFileSync(new URL(`../${path}`, import.meta.url))).digest('hex')]))

/** Observe retained owner references, never edit the run. Disappearance alone does not prove a kill. */
export function trackToolBosses(s: HaebiRun) {
  type Encounter = { id: number | null; spawnedAt: number; observedSpawnTime: number; killedAt: number | null; maxHp: number | null; hp: number | null; state: string; fightTime: number }
  const rows: { mid: Encounter | null; final: Encounter | null } = { mid: null, final: null }
  const owners: { mid: Mob | null; final: Mob | null } = { mid: null, final: null }
  const observe = () => {
    for (const key of ['mid', 'final'] as const) {
      const owner = key === 'mid' ? s.enemies.find(e => e.bossRole === 'midboss') : giantMob(s) ?? s.enemies.find(e => e.kind === 'boss' && e.bossRole !== 'midboss')
      if (owner) owners[key] = owner
      const e = owners[key], spawned = key === 'mid' ? s.giantFlow?.midSpawned : s.giantFlow?.finalSpawned
      const defeated = key === 'mid' ? s.giantFlow?.midDefeated : s.giantFlow?.finalDefeated ?? s.state === 'won'
      if (!rows[key] && (e || spawned || key === 'final' && s.state === 'won')) rows[key] = { id: e?.id ?? null, spawnedAt: e?.bornAt ?? s.t, observedSpawnTime: s.t, killedAt: null, maxHp: e?.max ?? null, hp: e?.hp ?? null, state: 'observed', fightTime: 0 }
      const row = rows[key]
      if (row) {
        if (e) { row.hp = Math.max(0, e.hp); row.state = e.giant?.state ?? (e.hp <= 0 ? 'killed' : 'alive') }
        if (row.killedAt === null && (defeated || e && e.hp <= 0)) { row.killedAt = s.t; row.hp = 0; row.state = 'killed' }
        row.fightTime = (row.killedAt ?? s.t) - row.spawnedAt
      }
    }
  }
  observe()
  return { observe, result: () => structuredClone(rows) }
}
export interface StageSample {
  stage: StageId; kit: Kit; seed: number; bonus: Partial<Bonus>; react: number; rules?: ToolRules; awake?: boolean; maxOperations?: number; measureLoad?: boolean; kits?: boolean; jackpot?: boolean; wide?: boolean; solid?: boolean; build?: boolean; cap?: boolean
}
export function stageSample(c: StageSample) {
  const opts = stageToolOpts(c.stage, c.bonus, c.rules, c.awake, c.kits, c.jackpot, c.wide, c.solid, c.build, c.cap), s = createHaebi(c.seed, 'stage', c.kit, opts), duration = runDuration(s), tracker = trackToolBosses(s)
  const maxOperations = c.maxOperations ?? 300000
  if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new Error('maxOperations must be positive')
  let low = s.hp, surgeN = 0, restN = 0, surgeLoad = 0, restLoad = 0, restMax = 0, operations = 0, stopReason: string | null = null, error: string | null = null
  try {
    while (s.state === 'playing') {
      if (operations >= maxOperations) { stopReason = 'operation_limit'; break }
      if (s.t > duration + 30) { stopReason = 'time_guard'; break }
      operations++
      if (s.offers.length) choose(s, botChoice(s, 'storm'))
      else { stepHaebi(s, botInput(s, c.react), 1 / 60); if (c.measureLoad) { if (respite(s)) { restN++; restLoad += s.enemies.length; restMax = Math.max(restMax, s.enemies.length) } else { surgeN++; surgeLoad += s.enemies.length } } }
      low = Math.min(low, s.hp); tracker.observe()
    }
  } catch (e) { stopReason = 'engine_error'; error = String(e); tracker.observe() }
  const complete = !stopReason && s.state !== 'playing'
  return { s, row: { stage: c.stage, kit: c.kit, seed: c.seed, simRules: opts.simRules, permanentAwake: opts.permanentAwake, time: s.t, hp: s.hp, maxHp: s.maxHp, minHp: low, state: s.state, complete, stopReason, error, operations, runDuration: duration, midScheduledAt: s.giantFlow ? midbossTime(s) : null, finalScheduledAt: bossTime(s), won: complete && s.state === 'won', death: complete && s.state === 'lost', deathReason: !complete ? null : s.state === 'won' ? null : s.hp <= 0 ? 'player_hp_zero' : s.t >= duration ? 'timeout' : 'lost_unknown', giantFlow: s.giantFlow ? { midSpawned: s.giantFlow.midSpawned, midDefeated: s.giantFlow.midDefeated, finalSpawned: s.giantFlow.finalSpawned, finalDefeated: s.giantFlow.finalDefeated } : null, bosses: tracker.result(), enemyLoad: { surgeMean: surgeN ? surgeLoad / surgeN : null, respiteMean: restN ? restLoad / restN : null, respiteMax: restMax } } }
}
function main() {
  // Explicit exploratory overrides are retained; they never write params files.
  Object.assign(HAEBI_MOBS, JSON.parse(process.env['MOVR'] ?? '{}')); Object.assign(HAEBI_WIDE, JSON.parse(process.env['WOVR'] ?? '{}'))   // WOVR: 넓은 맵 수치 시험 (예: {"strayScreens":1})
  for (const [k, v] of Object.entries(JSON.parse(process.env['STOVR'] ?? '{}'))) Object.assign((HAEBI_STAGES as Record<string, object>)[k]!, v)
  const stages = (process.argv[2] ?? 'forest,ford,palisade,snow,fortress').split(',') as Exclude<StageId, 'trial'>[], kits = (process.argv[3] ?? 'axe,bow,spear,sword,dagger,magic,sling').split(',') as Kit[], seeds = (process.argv[4] ?? '7,11').split(',').map(Number)
  const react = Number(process.env['REACT'] ?? .5), share = Number(process.env['SHOP'] ?? 0), policy = toolPolicy()
  const bonus = Object.fromEntries(Object.entries(HAEBI_SHOP).filter(([k]) => k !== 'growth').map(([k, v]) => [k, Math.round((v as { max: number }).max * share)])) as Bonus
  const magnetOverride = process.env['MAGOVR'] === undefined ? null : Number(process.env['MAGOVR'])
  if (magnetOverride !== null) { if (!Number.isInteger(magnetOverride) || magnetOverride < 0 || magnetOverride > HAEBI_SHOP.magnet.max) throw new Error(`MAGOVR must be an integer from 0 to ${HAEBI_SHOP.magnet.max}`); bonus.magnet = magnetOverride }
  const runs: ReturnType<typeof stageSample>['row'][] = []
  for (const stage of stages) {
    const rows: string[] = []; let won = 0, n = 0
    for (const kit of kits) for (const seed of seeds) {
      const { row } = stageSample({ stage, kit, seed, bonus, react, kits: process.env['KITS'] !== 'off', jackpot: process.env['JACKPOT'] !== 'off', wide: process.env['MAP'] !== 'off', solid: process.env['SOLID'] !== 'off', build: process.env['BUILD'] !== 'off', cap: process.env['CAP'] !== 'off', ...(policy.rules ? { rules: policy.rules } : {}), awake: policy.awake, maxOperations: policy.maxOperations, measureLoad: !!process.env['OUTJSON'] })
      runs.push(row); n++; if (row.won) won++; if (row.error) process.exitCode = 1
      rows.push(`${kit}/${seed} ${!row.complete ? '미완' : row.won ? '승' : '패'} ${Math.floor(row.time / 60)}:${String(Math.floor(row.time % 60)).padStart(2, '0')}${row.won ? ` 최저 ${Math.round(row.minHp)}` : ''}`)
    }
    console.log(`${stage.padEnd(8)} 승 ${won}/${n} · ${rows.join(' · ')}`)
  }
  if (process.env['OUTJSON']) {
    const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
    const aggregate = stages.map(stage => {
      const rows = runs.filter(r => r.stage === stage), complete = rows.filter(r => r.complete), wins = complete.filter(r => r.won)
      return { stage, runs: rows.length, terminalRuns: complete.length, incompleteRuns: rows.length - complete.length, won: wins.length, winFraction: `${wins.length}/${rows.length}`, deaths: complete.filter(r => r.death).length, deathRate: complete.length === rows.length ? complete.filter(r => r.death).length / rows.length : null,
        meanTime: mean(complete.map(r => r.time)), meanWinTime: mean(wins.map(r => r.time)), meanHp: mean(complete.map(r => r.hp)), meanWinHp: mean(wins.map(r => r.hp)), meanWinHpRatio: mean(wins.map(r => r.hp / r.maxHp)), minHp: rows.length ? Math.min(...rows.map(r => r.minHp)) : null }
    })
    writeFileSync(process.env['OUTJSON'], `${JSON.stringify({ metricKind: 'ordinary-input-full-run', note: 'Same bot policy, not identical input streams; bot has no new giant threat awareness. Guard/error samples are incomplete, never losses. Encounter times are first observed at operation boundaries; same-operation birth/death can have null owner/HP.', config: { stages, kits, seeds, react, shop: share, magnetOverride, bonus, choice: 'storm', kitRules: process.env['KITS'] !== 'off' ? KIT_RULES : null, chestRules: process.env['JACKPOT'] !== 'off' ? CHEST_RULES : null, mapRules: process.env['MAP'] !== 'off' ? MAP_RULES : null, buildRules: process.env['BUILD'] !== 'off' ? BUILD_RULES : null, capRules: process.env['CAP'] !== 'off' ? CAP_RULES : null, dt: 1 / 60, requestedRules: policy.rules ?? 'raidRulesForStage', permanentAwake: policy.awake, maxOperations: policy.maxOperations, safetySeconds: 30, mobOverride: JSON.parse(process.env['MOVR'] ?? '{}'), wideOverride: JSON.parse(process.env['WOVR'] ?? '{}'), stageOverride: JSON.parse(process.env['STOVR'] ?? '{}') }, provenance: { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8' }).trim(), node: process.version, sourceSha256: toolSourceSha256() }, runs, aggregate }, null, 2)}\n`)
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
