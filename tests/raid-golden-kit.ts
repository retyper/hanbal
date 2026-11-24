// 골든 시험 · 75-WALL 시험이 같이 쓰는 판 돌리기 — 지금 규칙을 모두 켠 판(74-BUFF 는 뺀다)에 설치물 여덟을 처음에 모두 세우고 정해진 길로 걷는다
import { createHaebi, stepHaebi, choose, KIT_RULES, CHEST_RULES, MAP_RULES, SOLID_RULES, ANCHOR_RULES, PHANTOM_RULES, BREAK_RULES, BUILD_RULES, BUILD2_RULES, CAP_RULES, BOSSCHEST_RULES, BUILDUP_RULES, AWAKECAP_RULES, BOSSDUEL_RULES, raidRulesForStage, type HaebiOpts, type Kit, type StageId } from '../src/raid/haebi.ts'
import { ALL_BUILD_KINDS } from '../src/raid/build.ts'

const rules = (stage: StageId): HaebiOpts => ({ stage, bonus: {}, simRules: raidRulesForStage(stage), permanentAwake: false, appearanceAwake: true, kitRules: KIT_RULES, chestRules: CHEST_RULES, mapRules: MAP_RULES, blockRules: SOLID_RULES, anchorRules: ANCHOR_RULES, phantomRules: PHANTOM_RULES, breakRules: BREAK_RULES, buildRules: BUILD_RULES, build2Rules: BUILD2_RULES, capRules: CAP_RULES, bossChestRules: BOSSCHEST_RULES, buildUpRules: BUILDUP_RULES, awakeCapRules: AWAKECAP_RULES, bossDuelRules: BOSSDUEL_RULES })
export function goldenRun(stage: StageId, kit: Kit, seed: number, seconds: number, extra: Partial<HaebiOpts> = {}) {
  const s = createHaebi(seed, 'stage', kit, { ...rules(stage), ...extra })
  for (const k of ALL_BUILD_KINDS) { s.offers = [k]; s.xp = 0; choose(s, k) }
  for (let i = 0; i < seconds * 60 && s.state === 'playing'; i++) {
    if (s.offers.length) choose(s, s.offers[0]!)
    stepHaebi(s, { x: Math.sin(i / 90), y: Math.cos(i / 140) }, 1 / 60)
  }
  return s
}
