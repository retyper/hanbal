// 열전 스테이지별 봇 판 (11-16 · 설원 고개·불타는 산성을 더하며) — 이기는 시각 · 진 시각 · 가장 낮은 체력
//   node --experimental-strip-types tools/raid-stage-balance.ts [stages forest,ford,...] [kits axe,bow,spear,sword] [seeds 7,11]
//   REACT=.5 (고리·줄을 0.5초 늦게 알아채는 봇) · SHOP=0~1 (상점 단계를 최대의 몇 할로 · 0 = 강화 없음)
import { HAEBI_SHOP, HAEBI_MOBS, HAEBI_STAGES } from '../src/tune/params.ts'
import { createHaebi, choose, stepHaebi, type Kit, type Bonus, type StageId } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
// MOVR='{"bearDamage":10}' · STOVR='{"snow":{"hp":2.5}}' — 값을 바꿔 재 본다 (params.ts 는 그대로)
Object.assign(HAEBI_MOBS, JSON.parse(process.env['MOVR'] ?? '{}'))
for (const [k, v] of Object.entries(JSON.parse(process.env['STOVR'] ?? '{}'))) Object.assign((HAEBI_STAGES as Record<string, object>)[k]!, v)
const stages = (process.argv[2] ?? 'forest,ford,palisade,snow,fortress').split(',') as Exclude<StageId, 'trial'>[]
const kits = (process.argv[3] ?? 'axe,bow,spear,sword').split(',') as Kit[]
const seeds = (process.argv[4] ?? '7,11').split(',').map(Number)
const react = Number(process.env['REACT'] ?? .5), share = Number(process.env['SHOP'] ?? 0)
const bonus = Object.fromEntries(Object.entries(HAEBI_SHOP).filter(([k]) => k !== 'growth').map(([k, v]) => [k, Math.round((v as { max: number }).max * share)])) as Bonus
for (const stage of stages) {
  const rows: string[] = []; let won = 0, n = 0
  for (const kit of kits) for (const seed of seeds) {
    const s = createHaebi(seed, 'stage', kit, { stage, bonus }); let low = s.hp
    while (s.state === 'playing') { if (s.offers.length) choose(s, botChoice(s, 'storm')); else stepHaebi(s, botInput(s, react), 1 / 60); low = Math.min(low, s.hp) }
    n++; if (s.state === 'won') won++
    rows.push(`${kit}/${seed} ${s.state === 'won' ? '승' : '패'} ${Math.floor(s.t / 60)}:${String(Math.floor(s.t % 60)).padStart(2, '0')}${s.state === 'won' ? ` 최저 ${Math.round(low)}` : ''}`)
  }
  console.log(`${stage.padEnd(8)} 승 ${won}/${n} · ${rows.join(' · ')}`)
}
