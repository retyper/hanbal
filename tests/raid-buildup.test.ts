// 69-BUILDUP 설치물 강화 칸 화력·장전 (형 11-23 「설치물들의 공격력이나 공격속도 올려주는 것도 따로 만들어야 할 것 같고」) — 새 규칙 판만 · 끈 판은 예전과 글자 하나까지 같다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_BUILDUP as B3, HAEBI_BUILD as BU } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, spawnMob, towerShot, runPowers, runBranchNodes, buildChoices, buildUpOpen, nodeOpen, KIT_RULES, CHEST_RULES, MAP_RULES, SOLID_RULES, ANCHOR_RULES, BREAK_RULES, BUILD_RULES, BUILD2_RULES, CAP_RULES, BOSSCHEST_RULES, BUILDUP_RULES, raidRulesForStage, type HaebiOpts, type HaebiRun, type Kit, type Power, type StageId } from '../src/raid/haebi.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, sealInput, replayRaid } from '../src/raid/runlog.ts'
import { firepowerMul, reloadInterval, towerFire, type BuildKind } from '../src/raid/build.ts'
import { treeModel } from '../src/raid/tree-model.ts'

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const prod = (stage: StageId, on: boolean): HaebiOpts => ({ stage, bonus: {}, simRules: raidRulesForStage(stage), permanentAwake: false, appearanceAwake: true, kitRules: KIT_RULES, chestRules: CHEST_RULES, mapRules: MAP_RULES, blockRules: SOLID_RULES, anchorRules: ANCHOR_RULES, breakRules: BREAK_RULES, buildRules: BUILD_RULES, build2Rules: BUILD2_RULES, capRules: CAP_RULES, bossChestRules: BOSSCHEST_RULES, ...(on ? { buildUpRules: BUILDUP_RULES } : {}) })
/** 한 장짜리 조용한 판 (69 켬/끔) — 저절로 나오는 적·정예·일제 사격을 멈춘다 */
function quiet(on = true, kit: Kit = 'axe') {
  const s = createHaebi(5, 'stage', kit, { stage: 'forest', simRules: '56B', kitRules: KIT_RULES, buildRules: BUILD_RULES, build2Rules: BUILD2_RULES, ...(on ? { buildUpRules: BUILDUP_RULES } : {}) })
  s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9
  return s
}
const pick = (s: HaebiRun, k: Power) => { s.offers = [k]; s.xp = 0; assert.ok(choose(s, k), k) }
const ups = (s: HaebiRun) => runPowers(s).filter(p => p === 'firepower' || p === 'reload')
const treeD = (s: HaebiRun) => runBranchNodes(s).d.flat()

/** 69 를 넣기 전 코드(커밋 ef76dfdb)로 잰 지금 열전 규칙 판 상태 SHA (150초 봇 판) */
const BEFORE_69: [StageId, Kit, string][] = [
  ['forest', 'bow', 'ecddb20359990040c24dc42e67a7c857b4f6972395a31a2a43ccba7b51f3554e'],
  ['palisade', 'axe', '43fb56117b3c47169bc99a3f9c44fe5d582b24243486f868e43801c041cf124c'],
]
for (const [stage, kit, sha] of BEFORE_69) test(`69-BUILDUP off: ${stage}/${kit} 판이 넣기 전과 같다 · 화력·장전은 ranks 에도 카드에도 없다`, () => {
  const s = createHaebi(23, 'stage', kit, prod(stage, false))
  for (let i = 0; i < 150 * 120 && s.state === 'playing'; i++) {
    if (s.offers.length) { assert.ok(!s.offers.some(p => p === 'firepower' || p === 'reload'), String(s.offers)); choose(s, botChoice(s, 'storm')) } else stepHaebi(s, botInput(s, .5), 1 / 120)
  }
  assert.equal('firepower' in s.ranks, false); assert.equal(s.build!.up, undefined)
  assert.equal(hash(s), sha)
})

test('69 on: 공격 설치물이 없으면 카드·나무에 안 나온다 · 망루를 가지면 둘 다 · 장승만이면 화력만', () => {
  const s = quiet()
  assert.equal(s.build!.up, true); assert.equal(s.ranks.firepower, 0); assert.equal(s.ranks.reload, 0)
  assert.deepEqual(ups(s), []); assert.ok(!treeD(s).includes('firepower')); assert.ok(!nodeOpen(s, 'firepower'))
  pick(s, 'fence'); pick(s, 'well'); pick(s, 'sotdae')
  assert.deepEqual(ups(s), [], '목책·우물·솟대는 치지 않는다')
  const t = quiet(); pick(t, 'totem')
  assert.deepEqual(ups(t), ['firepower'], '장승 혼줄은 피해만 (때마다 쏘지 않는다)')
  assert.ok(treeD(t).includes('firepower') && !treeD(t).includes('reload'))
  const w = quiet(); pick(w, 'tower')
  assert.deepEqual(ups(w), ['firepower', 'reload']); assert.ok(buildUpOpen(w, 'reload'))
  assert.ok(treeModel(w).nodes.some(n => n.id === 'firepower') && treeModel(w).nodes.some(n => n.id === 'reload'), '나무에도 선다')
  // 끈 판은 망루가 있어도 안 나온다
  const o = quiet(false); pick(o, 'tower'); assert.deepEqual(ups(o), [])
})

test('69 on: 화력·장전은 종류 칸(셋)을 쓰지 않는다', () => {
  const s = quiet()
  for (const k of ['tower', 'beacon', 'catapult'] as BuildKind[]) pick(s, k)
  pick(s, 'firepower'); pick(s, 'reload')
  assert.deepEqual(buildChoices(s), ['tower', 'beacon', 'catapult'], '종류 칸 셋 그대로')
  assert.ok(runPowers(s).includes('firepower') && runPowers(s).includes('reload'))
  for (let i = 2; i <= B3.max; i++) { pick(s, 'firepower'); pick(s, 'reload') }
  assert.equal(s.ranks.firepower, B3.max); assert.equal(s.ranks.reload, B3.max)
  assert.ok(!runPowers(s).filter(p => s.ranks[p] < (p === 'firepower' || p === 'reload' ? B3.max : 99)).includes('firepower'))
  s.offers = ['firepower']; assert.equal(choose(s, 'firepower'), false, '끝 단계 위로는 못 고른다')
})

test('69 on: 화력은 망루 화살 피해를 곱하고 · 장전은 쏘는 간격을 줄인다 (바닥 아래로는 안 준다)', () => {
  const s = quiet(); pick(s, 'tower')
  const base = towerShot(s)
  pick(s, 'firepower'); pick(s, 'firepower')
  assert.ok(Math.abs(towerShot(s) - base * firepowerMul(2)) < 1e-9)
  assert.ok(Math.abs(firepowerMul(2) - (1 + 2 * B3.dmgStep)) < 1e-12)
  // 망루 곁에 적 하나 — 쏜 뒤 다음 화살까지
  const tower = s.build!.items.find(it => it.kind === 'tower')!
  const shotCd = () => { spawnMob(s, 'club', undefined, true); const e = s.enemies[s.enemies.length - 1]!; e.x = tower.x + 120; e.y = tower.y; e.hp = e.max = 1e9; e.cd = 99; tower.cd = 0; stepHaebi(s, { x: 0, y: 0 }, 1 / 120); return tower.cd }
  const before = shotCd()
  assert.ok(Math.abs(before - towerFire(1)) < .02, `${before}`)
  pick(s, 'reload'); pick(s, 'reload'); pick(s, 'reload')
  const after = shotCd()
  assert.ok(Math.abs(after - towerFire(1) / (1 + 3 * B3.rateStep)) < .02, `${after}`)
  assert.equal(reloadInterval(.01, 5), B3.minInterval, '간격 바닥')
  assert.equal(reloadInterval(1.3, 0), 1.3, '단계 0 은 그대로')
  // 끈 판의 망루 피해는 예전 그대로
  const o = quiet(false); pick(o, 'tower'); assert.equal(towerShot(o), base)
  assert.ok(BU.tower.fire > B3.minInterval)
})

test('69 on: 같은 씨앗이면 판이 같다 · 봇이 화력·장전을 고른다 · 판 기록 opts 에 남고 재생도 같다', () => {
  const run = () => {
    const opts = prod('forest', true), s = createHaebi(23, 'stage', 'bow', opts)
    const r = startRecord(s, { id: 'buildup69', started: '2026-11-23T00:00:00Z', mode: 'stage', stage: 'forest', hero: 'ara', kit: 'bow', sprite: 'ara', seed: 23, opts, from: null })
    for (let i = 0; i < 480 * 120 && s.state === 'playing'; i++) {
      while (s.offers.length) { const p = botChoice(s, 'storm'); choose(s, p); recPick(r, p) }
      stepHaebi(s, recInput(r, botInput(s, .5)), 1 / 120)
    }
    return { s, game: sealInput(r) }
  }
  const a = run(), b = run()
  assert.equal(hash(a.s), hash(b.s))
  assert.equal(a.game.opts.buildUpRules, BUILDUP_RULES)
  assert.ok(a.s.ranks.firepower + a.s.ranks.reload > 0, `봇이 강화 칸을 골랐다 (${a.s.ranks.firepower}/${a.s.ranks.reload})`)
  assert.equal(hash(replayRaid(JSON.parse(JSON.stringify(a.game)))), hash(a.s))
})

test('69 옛 기록: 규칙 69-BUILDUP 으로 적힌 판은 처음 수치(v1) 그대로 · 새 판(69B)은 지금 수치', () => {
  const old = createHaebi(5, 'stage', 'axe', { stage: 'forest', simRules: '56B', kitRules: KIT_RULES, buildRules: BUILD_RULES, build2Rules: BUILD2_RULES, buildUpRules: '69-BUILDUP' })
  old.spawn = 1e9; old.nextElite = 1e9; old.nextBarrage = 1e9
  pick(old, 'tower'); const base = towerShot(old); pick(old, 'firepower'); pick(old, 'firepower')
  assert.equal(old.build!.upV1, true)
  assert.ok(Math.abs(towerShot(old) - base * (1 + 2 * B3.v1.dmgStep)) < 1e-9)
  assert.equal(reloadInterval(1.3, 2, true), 1.3 / (1 + 2 * B3.v1.rateStep))
  const now = quiet(); assert.equal(now.build!.upV1, undefined); assert.equal(BUILDUP_RULES, '69B-BUILDUP')
  pick(now, 'tower'); pick(now, 'firepower'); assert.ok(Math.abs(towerShot(now) - base * (1 + B3.dmgStep)) < 1e-9)
})
