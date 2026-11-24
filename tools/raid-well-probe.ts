// 우물 회복 총량 시험 (열전 · 12-24) — 봇이 우물을 처음에 R 단계로 세우고 정해진 시간을 나서 우물이 채운 체력을 잰다
//   node --experimental-strip-types tools/raid-well-probe.ts [seeds 1-12] [minutes 8] [stage forest] [kits axe,bow,...] [ranks 1,3,5]
//   한 줄: 우물 단계 · 우물이 채운 체력 평균(판 기준 · 최대 체력 몫) · 같은 판에서 예전 규칙(곁에 서 있으면 초마다 3 + 1.5 × (단계−1))이었다면 채웠을 체력(같은 걸음으로 센 짝짓기 · 우물 둘레 안에 있던 시간 × 비율을 빈 체력까지) · 판 끝(생존) 수
import { createHaebi, stepHaebi, choose, BUILD_TALLY, KIT_RULES, CHEST_RULES, MAP_RULES, SOLID_RULES, ANCHOR_RULES, PHANTOM_RULES, BREAK_RULES, BUILD_RULES, BUILD2_RULES, CAP_RULES, raidRulesForStage, type Kit, type StageId } from '../src/raid/haebi.ts'
import { wellRadius } from '../src/raid/build.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
const range = process.argv[2] ?? '1-12'
const seeds = (([a, b]) => Array.from({ length: b! - a! + 1 }, (_, i) => a! + i))(range.split('-').map(Number))
const minutes = Number(process.argv[3] ?? 8)
const stage = (process.argv[4] ?? 'forest') as StageId
const kits = (process.argv[5] ?? 'axe,bow,spear,sword,dagger,magic,sling').split(',') as Kit[]
for (const rank of (process.argv[6] ?? '1,3,5').split(',').map(Number)) {
  let healed = 0, share = 0, alive = 0, n = 0, old = 0
  for (const kit of kits) for (const seed of seeds) {
    const s = createHaebi(seed, 'stage', kit, { stage, bonus: {}, simRules: raidRulesForStage(stage), permanentAwake: false, appearanceAwake: true, kitRules: KIT_RULES, chestRules: CHEST_RULES, mapRules: MAP_RULES, blockRules: SOLID_RULES, anchorRules: ANCHOR_RULES, phantomRules: PHANTOM_RULES, breakRules: BREAK_RULES, buildRules: BUILD_RULES, capRules: CAP_RULES, build2Rules: BUILD2_RULES })
    for (let i = 0; i < rank; i++) { s.offers = ['well']; s.xp = 0; choose(s, 'well') }
    BUILD_TALLY.healed = 0
    for (let i = 0; i < minutes * 60 * 120 && s.state === 'playing'; i++) {
      if (s.offers.length) choose(s, botChoice(s, 'mixed')); else {
        const w = s.build!.items.find(it => it.kind === 'well'), r = s.ranks.well ?? 0
        if (w && r && Math.hypot(s.x - w.x, s.y - w.y) < wellRadius(r)) old += Math.min(Math.max(0, s.maxHp - s.hp), (3 + 1.5 * (r - 1)) / 120)
        stepHaebi(s, botInput(s, .5), 1 / 120)
      }
    }
    healed += BUILD_TALLY.healed; share += BUILD_TALLY.healed / s.maxHp; n++; if (s.state === 'playing') alive++
  }
  console.log(`well rank ${rank}: heal ${(healed / n).toFixed(1)} hp per run (${(share / n).toFixed(2)} x maxHp) · old rule would ${(old / n).toFixed(1)} · alive ${alive}/${n}`)
}
