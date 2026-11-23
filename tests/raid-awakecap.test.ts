// 70-AWAKECAP 각성 장수 최고 레벨 60 (형 11-23 「각성하면 만렙이 10 오르게 하는 건 어때?」) — 영구 각성 판만 · 겉모습 각성·각성 아닌 판·끈 판은 예전과 글자 하나까지 같다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_CAP as CP, HAEBI_CAP60 as C60 } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, maxLevel, xpNeeded, powerScale, runGold, KIT_RULES, CHEST_RULES, MAP_RULES, SOLID_RULES, ANCHOR_RULES, BREAK_RULES, BUILD_RULES, BUILD2_RULES, CAP_RULES, BOSSCHEST_RULES, BUILDUP_RULES, AWAKECAP_RULES, raidRulesForStage, type HaebiOpts, type Kit, type StageId } from '../src/raid/haebi.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, sealInput, replayRaid } from '../src/raid/runlog.ts'

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const prod = (stage: StageId, awake: boolean, on: boolean): HaebiOpts => ({ stage, bonus: {}, simRules: raidRulesForStage(stage), permanentAwake: awake, appearanceAwake: true, kitRules: KIT_RULES, chestRules: CHEST_RULES, mapRules: MAP_RULES, blockRules: SOLID_RULES, anchorRules: ANCHOR_RULES, breakRules: BREAK_RULES, buildRules: BUILD_RULES, build2Rules: BUILD2_RULES, capRules: CAP_RULES, bossChestRules: BOSSCHEST_RULES, buildUpRules: BUILDUP_RULES, ...(on ? { awakeCapRules: AWAKECAP_RULES } : {}) })
const capXp = (L: number) => CP.xpBase + L * CP.xpPerLevel + L ** 2 * CP.xpCurve
/** 조용한 판 (적·정예·일제 사격 멈춤) */
function quiet(awake: boolean, on = true, appearance = true) {
  const s = createHaebi(5, 'stage', 'axe', { stage: 'forest', simRules: '56B', kitRules: KIT_RULES, capRules: CAP_RULES, permanentAwake: awake, appearanceAwake: appearance, ...(on ? { awakeCapRules: AWAKECAP_RULES } : {}) })
  s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9
  return s
}

/** 70 을 넣기 전 코드(커밋 e66079aa)로 잰 150초 봇 판 상태 SHA — [판, 무기, 영구 각성, SHA] */
const BEFORE_70: [StageId, Kit, boolean, string][] = [
  ['forest', 'axe', true, 'd8d736fe9304ec3dc502f74cab15259d1c285291c163253c1da791d41d89888b'],
  ['ford', 'bow', false, '39a01fc4ad1d67a5f880dca128186497668b8a25dcdce23953d91ba941831b17'],
]
const bot = (opts: HaebiOpts, kit: Kit) => {
  const s = createHaebi(23, 'stage', kit, opts)
  for (let i = 0; i < 150 * 120 && s.state === 'playing'; i++) { if (s.offers.length) choose(s, botChoice(s, 'storm')); else stepHaebi(s, botInput(s, .5), 1 / 120) }
  return s
}
for (const [stage, kit, awake, sha] of BEFORE_70) test(`70-AWAKECAP off: ${stage}/${kit} (각성 ${awake}) 판이 넣기 전과 같다`, () => {
  assert.equal(hash(bot(prod(stage, awake, false), kit)), sha)
})
test('70 on: 각성이 아닌 판은 켜도 넣기 전과 같다 (겉모습 각성만으로는 60 이 아니다)', () => {
  const [stage, kit, awake, sha] = BEFORE_70[1]!
  assert.equal(awake, false)
  assert.equal(hash(bot(prod(stage, false, true), kit)), sha)
  const look = quiet(false, true, true)
  assert.equal(look.appearanceAwake, true); assert.equal(maxLevel(look), CP.capLevel); assert.equal(look.cap!.top, undefined)
})

test('70 on: 영구 각성 판은 최고 레벨 60 · 50~59 막대가 길어지고 · 51~60 레벨 힘은 반 · 60 뒤 넘침은 66 의 50 뒤 막대', () => {
  const s = quiet(true)
  assert.equal(maxLevel(s), C60.capLevel); assert.equal(s.cap!.top, C60.capLevel)
  assert.equal(maxLevel(quiet(true, false)), CP.capLevel, '끈 판은 50')
  s.level = 49; assert.equal(xpNeeded(s), capXp(49))
  s.level = 50; assert.ok(Math.abs(xpNeeded(s) - capXp(50) * (1 + C60.xpRise)) < 1e-9)
  s.level = 59; assert.ok(Math.abs(xpNeeded(s) - capXp(59) * (1 + C60.xpRise * 10)) < 1e-9)
  s.level = 60; assert.equal(xpNeeded(s), capXp(CP.capLevel))
  const p = (level: number) => { s.level = level; return powerScale(s) }
  assert.ok(Math.abs(p(50) - (1 + 49 * CP.levelPower)) < 1e-12)
  assert.ok(Math.abs(p(55) - p(50) - 5 * CP.levelPower * C60.powerShare) < 1e-12, '51~55 는 반')
  const plain = quiet(false); plain.level = 50; assert.ok(Math.abs(p(50) - powerScale(plain)) < 1e-12, '50 까지는 같다')
})

test('70 on: 50 에서도 레벨업 카드가 나오고 · 60 에서 멈추면 회복·금으로 넘친다', () => {
  const s = quiet(true)
  s.level = CP.capLevel; s.xp = xpNeeded(s) + .5
  stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  assert.ok(s.offers.length > 0, '50 에서 카드')
  assert.ok(choose(s, s.offers[0]!)); assert.equal(s.level, CP.capLevel + 1)
  const t = quiet(true); t.level = C60.capLevel; t.hp = 10; t.xp = capXp(CP.capLevel) * 2 + .5
  stepHaebi(t, { x: 0, y: 0 }, 1 / 120)
  assert.equal(t.offers.length, 0, '60 에서는 카드가 없다'); assert.equal(t.level, C60.capLevel)
  assert.equal(t.cap!.n, 2, '넘친 막대 둘'); assert.ok(t.hp > 10); assert.ok(runGold(t) >= t.cap!.gold && t.cap!.gold > 0)
  const u = quiet(false); u.level = CP.capLevel; u.xp = xpNeeded(u) + .5
  stepHaebi(u, { x: 0, y: 0 }, 1 / 120)
  assert.equal(u.offers.length, 0, '각성 아닌 판은 50 에서 멈춘다'); assert.equal(u.cap!.n, 1)
})

test('70 on: 판 기록 opts 에 남고 기록 재생이 같다', () => {
  const opts = prod('forest', true, true), s = createHaebi(31, 'stage', 'sword', opts)
  const r = startRecord(s, { id: 'awakecap70', started: '2026-11-23T00:00:00Z', mode: 'stage', stage: 'forest', hero: 'haebi', kit: 'sword', sprite: 'haebi', seed: 31, opts, from: null })
  for (let i = 0; i < 150 * 120 && s.state === 'playing'; i++) {
    while (s.offers.length) { const p = botChoice(s, 'storm'); choose(s, p); recPick(r, p) }
    stepHaebi(s, recInput(r, botInput(s, .5)), 1 / 120)
  }
  const game = sealInput(r)
  assert.equal(game.opts.awakeCapRules, AWAKECAP_RULES); assert.equal(s.cap!.top, C60.capLevel)
  assert.equal(hash(replayRaid(JSON.parse(JSON.stringify(game)))), hash(s))
})
