// 76-PACE 초반 곡선 (형 11-25 「초반이 적들을 피할 이유도 없이 쉬움」 · journey-study 카드 2)
// 새 판만: 앞 5분 생성 수가 늘고 첫 정예가 당겨진다 · 5계단 적 표(tiers)는 그대로라 앞 5분은 근접만(50-1) · 옛 판은 글자 하나까지 같다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_PACE as PC, HAEBI_RUN as C, HAEBI_STAGES as ST } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, spawnMob, spawnRate, bossTime, KIT_RULES, MAP_RULES, PACE_RULES, type HaebiRun, type StageId } from '../src/raid/haebi.ts'
import { startRecord, recInput, recPick, finishRecord, replayRaid, STEP } from '../src/raid/runlog.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'
import { goldenRun } from './raid-golden-kit.ts'

const sha = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const ranged = new Set(['archer', 'slinger', 'firearcher', 'hunter', 'torch', 'shaman'])
const mk = (pace: boolean, stage: StageId = 'forest') => createHaebi(5, 'stage', 'axe', { stage, kitRules: KIT_RULES, mapRules: MAP_RULES, ...(pace ? { paceRules: PACE_RULES } : {}) })
const rateAt = (s: HaebiRun, t: number) => { s.t = t; return spawnRate(s) }

test('76-PACE 앞 5분 생성 수가 늘었다 (같은 씨앗 · 같은 걸음)', () => {
  const count = (pace: boolean) => { const s = goldenRun('forest', 'axe', 7, 300, pace ? { paceRules: PACE_RULES } : {}); return s.kills + s.enemies.length }
  const old = count(false), now = count(true)
  assert.ok(now > old * 1.25, `옛 ${old} → 새 ${now}`)
})

test('76-PACE 첫 정예가 당겨진다 · 그 뒤 간격은 그대로', () => {
  assert.equal(mk(false).nextElite, C.eliteEvery * ST.forest.length)
  assert.equal(mk(true).nextElite, PC.eliteFirst * ST.forest.length)
  assert.ok(PC.eliteFirst < C.eliteEvery)
  const s = mk(true); s.spawn = 1e9; s.nextBarrage = 1e9
  while (s.t < PC.eliteFirst + 2) stepHaebi(s, { x: 0, y: 0 }, 1 / 60)
  assert.equal(s.nextElite, PC.eliteFirst + C.eliteEvery * ST.forest.length)
})

test('76-PACE 생성 속도는 계단 없이 이어진다 · 옛 판은 옛 계단 그대로', () => {
  const neu = mk(true), old = mk(false), pd = (C.duration + 30) / 600   // paced 1 = 몇 초
  const jump = (s: HaebiRun, p: number) => Math.abs(rateAt(s, (p + .01) * pd) - rateAt(s, (p - .01) * pd))
  for (const p of [120, 300, 480]) assert.ok(jump(neu, p) < .05, `새 곡선 ${p} 계단 ${jump(neu, p)}`)
  assert.ok(jump(old, 120) > 1.5 && jump(old, 300) > 3 && jump(old, 480) > 4, '옛 곡선은 계단이 있다')
  assert.ok(rateAt(neu, 60) > rateAt(old, 60), '앞 1분 더 많다')
  assert.equal(rateAt(neu, 900 * pd), C.spawnFeast); assert.equal(rateAt(old, 900 * pd), C.spawnFeast)
})

test('76-PACE 다른 스테이지·모드: 스테이지 판에만 켜진다', () => {
  assert.equal(createHaebi(5, 'trial', 'axe', { paceRules: PACE_RULES }).pace, undefined)
  assert.equal(createHaebi(5, 'vanguard', 'axe', { paceRules: PACE_RULES }).pace, undefined)
  for (const stage of ['ford', 'palisade'] as const) assert.equal(mk(true, stage).pace, true)
})

test('76-PACE + 50-1 새 곡선에서도 앞 절반 자연 스폰은 근접만 · 적 표는 그대로', () => {
  const found: string[] = []
  for (const stage of ['forest', 'ford', 'palisade', 'snow', 'fortress'] as const) for (const f of [0, .22, .44, .499]) {
    const s = mk(true, stage); s.spawn = s.nextElite = s.nextBarrage = 1e9; s.t = bossTime(s) * f
    for (let i = 0; i < 100; i++) spawnMob(s)
    for (const e of s.enemies) if (ranged.has(e.kind)) found.push(`${stage}@${f}:${e.kind}`)
  }
  assert.deepEqual([...new Set(found)], [])
  assert.deepEqual(ST.forest.tiers, [['club', 'dog'], ['runner', 'dog'], ['shield', 'berserker'], ['berserker', 'archer'], ['iron', 'firearcher']])
})

test('76-PACE 같은 씨앗은 같은 판 · 옛 규칙 판과는 다르다 · 기록 재생이 같다', () => {
  const a = sha(goldenRun('forest', 'axe', 7, 60, { paceRules: PACE_RULES })), b = sha(goldenRun('forest', 'axe', 7, 60, { paceRules: PACE_RULES }))
  assert.equal(a, b); assert.notEqual(a, sha(goldenRun('forest', 'axe', 7, 60)))
  const opts = { stage: 'forest' as const, bonus: {}, kitRules: KIT_RULES, mapRules: MAP_RULES, paceRules: PACE_RULES }
  const s = createHaebi(11, 'stage', 'axe', opts)
  const r = startRecord(s, { id: '76-pace', started: 'test', mode: s.mode, stage: s.stage, hero: 'haebi', kit: s.kit, sprite: 'haebi', seed: 11, opts, from: null })
  while (s.t < 120 && s.state === 'playing') {
    if (s.offers.length) { const p = botChoice(s, 'storm'); choose(s, p); recPick(r, p); continue }
    stepHaebi(s, recInput(r, botInput(s, .5)), STEP)
  }
  assert.equal(s.pace, true)
  assert.deepEqual(replayRaid(finishRecord(r, 0, 'test')), s)
})

test('76-PACE 숲만 앞부분을 더 조이고 여울·목책은 계단만 잇는다', () => {
  for (const stage of ['ford', 'palisade'] as const) {
    const a = mk(true, stage), b = mk(false, stage)
    assert.equal(rateAt(a, 60), rateAt(b, 60), `${stage} 첫 토막은 옛 곡선 그대로`)
    assert.equal(rateAt(a, 700), rateAt(b, 700), `${stage} 둘째 토막 가운데도 그대로`)
  }
  assert.ok(rateAt(mk(true), 60) > rateAt(mk(false), 60) * 2, '숲 앞 1분은 두 배 넘게')
  assert.equal(rateAt(mk(true), 1100), rateAt(mk(false), 1100), '숲도 가산이 다 줄어든 뒤는 옛 곡선 그대로')
})
