/**
 * 경제 프로브 — 훈련치 **수입**과 **소비처 총액**을 놓고 "다 사는 데 몇 분인가"를 잰다.
 *
 * 형 (2026-09-02): "다 너무 싼 거 아냐? 컨텐트 소모시간이 너무 빨라버리는 거 같은데" ·
 *                  "내가 한 10분 플레이하면 1000 모은단 말이야."
 *
 * 수입은 감이 아니라 **실제 채점기**(game/rewards.ts gradeRun)로 잰다 — 실제 판(getStage)에
 * 두 사람의 판 결과를 넣는다:
 *   초보  — 깨긴 깨는데 한 발 흘린다. 점수 = 기준선. 판에 25초.
 *   숙련  — 무손실 · 정중앙 둘 · 여벌 남김. 점수 = 기준선 × 2.5(상한). 판에 12초.
 * 숙련의 분당 수입이 형이 말한 100/분과 맞는지 먼저 본다 — 안 맞으면 이 프로브가 틀린 것이다.
 *
 * 실행: node --experimental-strip-types tools/probe-economy.ts [--old=1]
 *   --old=1 : 2026-09-02 오전의 값(스탯 quadDiv 16 · 개조 6/6 · 부적 8~12 · 화살 4/3 · 가게 3/1)으로 돈다.
 */
import { makeRng } from '../src/core/rng.ts'
import { gradeRun } from '../src/game/rewards.ts'
import type { RunStats } from '../src/game/rewards.ts'
import { getStage, BOSS_EVERY } from '../src/game/stages.ts'
import { trainingCost, trainingCostTotal } from '../src/game/progression.ts'
import { forgeCost, forgeMax } from '../src/game/forge.ts'
import { CHARMS, charmCost } from '../src/game/charms.ts'
import { defenseCost, arrowBuyMax } from '../src/game/defense.ts'
import { shopPrice } from '../src/game/supply.ts'
import { P } from '../src/tune/params.ts'

const old = process.argv.includes('--old=1')
if (old) {
  const M = P as unknown as Record<string, Record<string, number>>
  M['progression']!['costQuadDiv'] = 16
  M['progression']!['costCubeDiv'] = 0
  M['forge']!['costBase'] = 6
  M['forge']!['costStep'] = 6
  M['forge']!['costStep2'] = 0
  M['charm']!['quiverCost'] = 8
  M['charm']!['ironCost'] = 10
  M['charm']!['goldCost'] = 7
  M['charm']!['ghostCost'] = 12
  M['defense']!['arrowCost'] = 4
  M['defense']!['arrowCostStep'] = 3
  M['shop']!['priceBase'] = 3
  M['shop']!['priceStep'] = 1
  M['shop']!['homingPrice'] = 7
}

/** 판 결과 프로필. */
interface Profile { name: string; secPerStage: number; make(hits: number, arrows: number, target: number): RunStats }
const PROFILES: Profile[] = [
  {
    name: '초보', secPerStage: 25,
    make: (hits, arrows, target) => ({
      cleared: true, score: target, arrowsUsed: Math.min(arrows, hits + 1), arrowsGiven: arrows,
      hits, shots: Math.min(arrows, hits + 1), misses: 1, bestChain: 0, bullseyes: 0, bounties: 0,
    }),
  },
  {
    name: '숙련', secPerStage: 12,
    make: (hits, arrows, target) => ({
      cleared: true, score: target * 2.5, arrowsUsed: hits, arrowsGiven: arrows,
      hits, shots: hits, misses: 0, bestChain: 0, bullseyes: 2, bounties: 0,
    }),
  },
]

/** 판 1..N 의 수입 (판당). 보스판은 판당 평균에 섞인다. 보상 난수는 고정 시드 — 평균만 본다. */
function incomeTable(p: Profile, upto: number): number[] {
  const rng = makeRng(0xec0)
  const out: number[] = []
  for (let i = 0; i < upto; i++) {
    const s = getStage(i)
    const hits = s.targets.filter((t) => t.kind !== 'bonus' && t.kind !== 'barrel').length
    let sum = 0
    for (let k = 0; k < 40; k++) sum += gradeRun(rng, s, p.make(hits, s.arrows, s.targetScore)).training
    out.push(sum / 40)
  }
  return out
}

const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)
const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0)

// ── 소비처 총액 ──
const statTo14 = trainingCostTotal(0, 14)
const statTo8 = trainingCostTotal(0, 8)
const statTo30 = trainingCostTotal(0, 30)
let forgeBow = 0
for (let l = 0; l < forgeMax(); l++) forgeBow += forgeCost(l)
forgeBow *= 3
const forgeAll = forgeBow * 5
const charmAvg = mean(CHARMS.map((c) => charmCost(c.id)))
let arrowsStage = 0
for (let b = 0; b < arrowBuyMax(); b++) {
  arrowsStage += defenseCost('arrow', { playing: true, shield: 0, shieldMax: 0, armor: 0, armorMax: 0, arrowsBought: b })
}
const shopLine = `${shopPrice('burst')} · ${shopPrice('pierce')} · ${shopPrice('heavy')} · ${shopPrice('homing')}`

console.log(`경제 프로브 — ${old ? '옛 값 (2026-09-02 오전)' : '지금 값'}`)
console.log('')
console.log('소비처 총액 (훈련치)')
console.log(`  스탯 0→8 ${statTo8} · 0→14 ${statTo14} · 0→30 ${statTo30}  (레벨 비용: ${[0, 5, 10, 14, 20, 29].map((l) => `L${l} ${trainingCost(l)}`).join(' · ')})`)
console.log(`  4스탯 14 = ${statTo14 * 4} · 4스탯 30 = ${statTo30 * 4}`)
console.log(`  대장간 활 하나(3부위 ${forgeMax()}단) ${forgeBow} · 활 다섯 ${forgeAll}  (단 값 ${[...Array(forgeMax()).keys()].map((l) => forgeCost(l)).join('/')})`)
console.log(`  부적 평균 ${charmAvg.toFixed(0)} (${CHARMS.map((c) => `${c.name} ${charmCost(c.id)}`).join(' · ')})`)
console.log(`  화살 한 발 — 한 판 셋 ${arrowsStage}  · 살 가게 ${shopLine}`)
const core = statTo14 * 4 + forgeBow
console.log(`  ★ 핵심 영구 세트 (4스탯 14 + 주활 개조 전부) = ${core} · 전부 (4스탯 30 + 활 다섯) = ${statTo30 * 4 + forgeAll}`)
console.log('')

for (const p of PROFILES) {
  const inc = incomeTable(p, 40)
  const early = inc.slice(0, BOSS_EVERY)
  const perMin = mean(inc) * (60 / p.secPerStage)
  console.log(`${p.name} — 판당 ${mean(inc).toFixed(1)} (1~10판 ${mean(early).toFixed(1)} · 11~40판 ${mean(inc.slice(BOSS_EVERY)).toFixed(1)}) · 판에 ${p.secPerStage}s → 분당 ${perMin.toFixed(0)} · 10분 ${(perMin * 10).toFixed(0)}`)
  console.log(`  11판 도착 시 누적 ${sum(early).toFixed(0)} → 근력 ${(() => { let l = 0; let left = sum(early); while (left >= trainingCost(l)) { left -= trainingCost(l); l++ } return l })()}`)
  const mins = (cost: number): string => `${(cost / perMin).toFixed(0)}분`
  console.log(`  근력 14 ${mins(statTo14)} · 4스탯 14 ${mins(statTo14 * 4)} · 주활 개조 ${mins(forgeBow)} · ★핵심 세트 ${mins(core)} · 전부 ${mins(statTo30 * 4 + forgeAll)}`)
  console.log(`  부적 하나 = ${(charmAvg / mean(inc)).toFixed(1)}판 수입 · 화살 셋 = ${(arrowsStage / mean(inc)).toFixed(1)}판 수입`)
}
