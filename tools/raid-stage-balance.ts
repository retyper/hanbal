// 열전 스테이지별 봇 판 (11-16 · 설원 고개·불타는 산성을 더하며) — 이기는 시각 · 진 시각 · 가장 낮은 체력
//   node --experimental-strip-types tools/raid-stage-balance.ts [stages forest,ford,...] [kits axe,bow,spear,sword] [seeds 7,11]
//   REACT=.5 (고리·줄을 0.5초 늦게 알아채는 봇) · SHOP=0~1 (상점 단계를 최대의 몇 할로 · 0 = 강화 없음)
import { HAEBI_SHOP, HAEBI_MOBS, HAEBI_STAGES } from '../src/tune/params.ts'
import { createHaebi, choose, stepHaebi, respite, type Kit, type Bonus, type StageId } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
// MOVR='{"bearDamage":10}' · STOVR='{"snow":{"hp":2.5}}' — 값을 바꿔 재 본다 (params.ts 는 그대로)
Object.assign(HAEBI_MOBS, JSON.parse(process.env['MOVR'] ?? '{}'))
for (const [k, v] of Object.entries(JSON.parse(process.env['STOVR'] ?? '{}'))) Object.assign((HAEBI_STAGES as Record<string, object>)[k]!, v)
const stages = (process.argv[2] ?? 'forest,ford,palisade,snow,fortress').split(',') as Exclude<StageId, 'trial'>[]
const kits = (process.argv[3] ?? 'axe,bow,spear,sword').split(',') as Kit[]
const seeds = (process.argv[4] ?? '7,11').split(',').map(Number)
const react = Number(process.env['REACT'] ?? .5), share = Number(process.env['SHOP'] ?? 0)
const bonus = Object.fromEntries(Object.entries(HAEBI_SHOP).filter(([k]) => k !== 'growth').map(([k, v]) => [k, Math.round((v as { max: number }).max * share)])) as Bonus
// OUTJSON is optional reporting only: keep the same simulation loop and default CLI output.
const runs: { stage: string; kit: Kit; seed: number; time: number; hp: number; maxHp: number; minHp: number; won: boolean; death: boolean; enemyLoad: { surgeMean: number; respiteMean: number | null; respiteMax: number } }[] = []
const sourceSha256 = Object.fromEntries(['src/raid/haebi.ts', 'src/raid/haebi-replay.ts', 'src/tune/params.ts', 'tools/raid-stage-balance.ts'].map(path => [path, createHash('sha256').update(readFileSync(new URL(`../${path}`, import.meta.url))).digest('hex')]))
for (const stage of stages) {
  const rows: string[] = []; let won = 0, n = 0
  for (const kit of kits) for (const seed of seeds) {
    const s = createHaebi(seed, 'stage', kit, { stage, bonus }); let low = s.hp, surgeN = 0, restN = 0, surgeLoad = 0, restLoad = 0, restMax = 0
    while (s.state === 'playing') { if (s.offers.length) choose(s, botChoice(s, 'storm')); else { stepHaebi(s, botInput(s, react), 1 / 60); if (process.env['OUTJSON']) { if (respite(s)) { restN++; restLoad += s.enemies.length; restMax = Math.max(restMax, s.enemies.length) } else { surgeN++; surgeLoad += s.enemies.length } } } low = Math.min(low, s.hp) }
    n++; if (s.state === 'won') won++
    if (process.env['OUTJSON']) runs.push({ stage, kit, seed, time: s.t, hp: s.hp, maxHp: s.maxHp, minHp: low, won: s.state === 'won', death: s.state === 'lost', enemyLoad: { surgeMean: surgeLoad / surgeN, respiteMean: restN ? restLoad / restN : null, respiteMax: restMax } })
    rows.push(`${kit}/${seed} ${s.state === 'won' ? '승' : '패'} ${Math.floor(s.t / 60)}:${String(Math.floor(s.t % 60)).padStart(2, '0')}${s.state === 'won' ? ` 최저 ${Math.round(low)}` : ''}`)
  }
  console.log(`${stage.padEnd(8)} 승 ${won}/${n} · ${rows.join(' · ')}`)
}
if (process.env['OUTJSON']) {
  const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  const aggregate = stages.map(stage => {
    const rows = runs.filter(r => r.stage === stage), wins = rows.filter(r => r.won)
    return { stage, runs: rows.length, won: wins.length, deaths: rows.filter(r => r.death).length, deathRate: rows.filter(r => r.death).length / rows.length,
      meanTime: mean(rows.map(r => r.time)), meanWinTime: mean(wins.map(r => r.time)), meanHp: mean(rows.map(r => r.hp)), meanWinHp: mean(wins.map(r => r.hp)), meanWinHpRatio: mean(wins.map(r => r.hp / r.maxHp)), minHp: Math.min(...rows.map(r => r.minHp)) }
  })
  writeFileSync(process.env['OUTJSON'], `${JSON.stringify({ config: { stages, kits, seeds, react, shop: share, bonus, choice: 'storm', dt: 1 / 60, mobOverride: JSON.parse(process.env['MOVR'] ?? '{}'), stageOverride: JSON.parse(process.env['STOVR'] ?? '{}') }, provenance: { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), node: process.version, sourceSha256 }, runs, aggregate }, null, 2)}\n`)
}
