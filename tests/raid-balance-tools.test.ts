import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHaebi, choose, stepHaebi, usesGiantBoss, isPermanentAwake, runDuration, raidRulesForStage } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
import { stageToolOpts, stageSample, toolPolicy, trackToolBosses } from '../tools/raid-stage-balance.ts'
import { ultToolConfig, collectUltFields } from '../tools/raid-ult-dps.ts'

test('forest explicit 56B lane preserves original create state and ordinary bot progression', () => {
  const bonus = { vigor: 3, might: 2, armor: 1 }
  const old = createHaebi(7, 'stage', 'axe', { stage: 'forest', bonus })
  assert.deepEqual(createHaebi(7, 'stage', 'axe', stageToolOpts('forest', bonus, '56B')), old)
  for (let i = 0; i < 120; i++) { if (old.offers.length) choose(old, botChoice(old, 'storm')); else stepHaebi(old, botInput(old, .5), 1 / 60) }
  assert.deepEqual(stageSample({ stage: 'forest', kit: 'axe', seed: 7, bonus, react: .5, rules: '56B', maxOperations: 120 }).s, old)
})
test('forest default follows the real stage rule (55-GUMIHO): same run as 56B until the 10-minute midboss, plus the giant flow', () => {
  const bonus = { vigor: 3, might: 2, armor: 1 }
  assert.equal(stageToolOpts('forest', bonus).simRules, raidRulesForStage('forest'))
  const { s } = stageSample({ stage: 'forest', kit: 'axe', seed: 7, bonus, react: .5, maxOperations: 120 }), old = stageSample({ stage: 'forest', kit: 'axe', seed: 7, bonus, react: .5, rules: '56B', maxOperations: 120 }).s
  assert.equal(usesGiantBoss(s), true); assert.equal(runDuration(s), 1380)
  const { giantFlow, ...rest } = s
  assert.deepEqual(giantFlow, { midSpawned: false, midDefeated: false, finalSpawned: false, finalDefeated: false }); assert.deepEqual(rest, old)
})
test('ford defaults to real stage rules; explicit56B comparison and permanent awake remain canonical', () => {
  const normal = createHaebi(7, 'stage', 'axe', stageToolOpts('ford', {})), awake = createHaebi(7, 'stage', 'axe', stageToolOpts('ford', {}, undefined, true))
  assert.equal(stageToolOpts('ford', {}).simRules, raidRulesForStage('ford'))
  assert.equal(usesGiantBoss(normal), true); assert.equal(runDuration(normal), 1380)
  assert.equal(isPermanentAwake(normal), false); assert.equal(isPermanentAwake(awake), true)
  const legacy = createHaebi(7, 'stage', 'axe', stageToolOpts('ford', {}, '56B'))
  assert.equal(usesGiantBoss(legacy), false)
  assert.deepEqual(legacy, createHaebi(7, 'stage', 'axe', { stage: 'ford' }))
})
test('CLI policy rejects invalid rules, awake and unbounded operation limits', () => {
  assert.deepEqual(toolPolicy({}), { rules: undefined, awake: false, maxOperations: 300000 })
  assert.equal(toolPolicy({ RULES: '56B', AWAKEN: '1' }).awake, true)
  for (const env of [{ RULES: '53B' }, { AWAKEN: 'yes' }, { MAX_STEPS: '0' }, { MAX_STEPS: 'Infinity' }]) assert.throws(() => toolPolicy(env))
  assert.throws(() => ultToolConfig({ STAGE: 'garbage' }))
})
test('short actual ford run is incomplete, never a loss; unreached bosses null and observation readonly', () => {
  const { s, row } = stageSample({ stage: 'ford', kit: 'bow', seed: 11, bonus: {}, react: .5, maxOperations: 2 })
  assert.equal(row.complete, false); assert.equal(row.death, false); assert.equal(row.won, false); assert.equal(row.stopReason, 'operation_limit')
  assert.equal(row.state, 'playing'); assert.equal(row.time, 2 / 60); assert.equal(row.runDuration, 1380)
  assert.deepEqual(row.bosses, { mid: null, final: null }); assert.equal(row.deathReason, null)
  const before = structuredClone(s), tracker = trackToolBosses(s); tracker.observe(); tracker.result()
  assert.deepEqual(s, before)
})
test('ult collection uses selected actual ford rules/awake but missing final fields remain null', () => {
  assert.equal(ultToolConfig({}).stage, 'forest')
  const config = ultToolConfig({ STAGE: 'ford', RULES: '55-IMUGI', AWAKEN: '1', ONLY: '3', MAX_STEPS: '2' })
  const { fields, report } = collectUltFields('sword', 7, config)
  assert.equal(report.simRules, '55-IMUGI'); assert.equal(report.permanentAwake, true); assert.equal(report.runDuration, 1380)
  assert.equal(report.stopReason, 'operation_limit'); assert.equal(report.allRequestedFieldsCaptured, false); assert.equal(fields.length, 0)
  assert.equal(report.samples.length, 4); assert(report.samples.every(s => s.capturedAt === null && s.bossHP === null && s.targetTime > 1140))
})
