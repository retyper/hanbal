// 열전 초반 압박 시험 (11-25 · journey-study 카드 0) — 가만히 서 있는 봇이 앞 몇 분에 얼마나 맞나
//   node --experimental-strip-types tools/raid-early.ts [stage forest] [kits axe,bow,dagger,sword] [seeds 7,11,13]
//   환경: MIN=5 (몇 분까지) · SHOP=0 (상점 몫 0~1) · STILL=1 (1=서 있음 · 0=기본 봇 원 돌기) · WALL=off (75-WALL 을 끈 옛 판)
//   한 줄: 판 최저 체력(평균·최악) · 죽은 판 · 맞은 수 평균 · 처치 · 레벨 · 분마다 체력 평균
import { HAEBI_SHOP } from '../src/tune/params.ts'
import { createHaebi, choose, stepHaebi, type Kit, type StageId, type Bonus } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
import { stageToolOpts } from './raid-stage-balance.ts'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export function earlyRun(stage: StageId, kit: Kit, seed: number, minutes: number, share: number, still: boolean) {
  const bonus = Object.fromEntries(Object.entries(HAEBI_SHOP).filter(([k]) => k !== 'growth').map(([k, v]) => [k, Math.round((v as { max: number }).max * share)])) as Bonus
  const s = createHaebi(seed, 'stage', kit, { ...stageToolOpts(stage, bonus, undefined, false, true, true, true, true, true, true, true, true, true, true, true) })
  let low = 1, hits = 0, prev = 0
  const perMin: number[] = []
  while (s.state === 'playing' && s.t < minutes * 60) {
    if (s.offers.length) choose(s, botChoice(s, 'storm'))
    else stepHaebi(s, still ? { x: 0, y: 0 } : botInput(s, .5), 1 / 60)
    low = Math.min(low, Math.max(0, s.hp) / s.maxHp)
    if (s.hurt > 0 && prev <= 0) hits++
    prev = s.hurt
    if (s.t >= (perMin.length + 1) * 60 && perMin.length < minutes) perMin.push(Math.max(0, s.hp) / s.maxHp)
  }
  return { low, dead: s.state === 'lost' || s.hp <= 0, hits, kills: s.kills, level: s.level, perMin }
}
function main() {
  const stage = (process.argv[2] ?? 'forest') as StageId, kits = (process.argv[3] ?? 'axe,bow,dagger,sword').split(',') as Kit[], seeds = (process.argv[4] ?? '7,11,13').split(',').map(Number)
  const minutes = Number(process.env['MIN'] ?? 5), share = Number(process.env['SHOP'] ?? 0), still = process.env['STILL'] !== '0'
  const rows = kits.flatMap(k => seeds.map(seed => earlyRun(stage, k, seed, minutes, share, still)))
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
  const mins = Array.from({ length: minutes }, (_, i) => Math.round(mean(rows.map(r => r.perMin[i] ?? 0)) * 100))
  console.log(`${stage} ${still ? 'still' : 'bot'} 상점 ${share} ${minutes}분 · 죽은 판 ${rows.filter(r => r.dead).length}/${rows.length} · 판 최저 체력 평균 ${Math.round(mean(rows.map(r => r.low)) * 100)}% / 최악 ${Math.round(Math.min(...rows.map(r => r.low)) * 100)}% · 맞은 수 ${mean(rows.map(r => r.hits)).toFixed(1)}/판 · 처치 ${Math.round(mean(rows.map(r => r.kills)))} · 레벨 ${mean(rows.map(r => r.level)).toFixed(1)} · 체력 분마다(%) ${mins.join('·')}`)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
