// 열전 기술 나무 · 판 안 각성 (11-17 · docs/realm/RAID-LINK.md §1·§2)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_TREE as T, HAEBI_AWAKEN as A, HAEBI_ULT as U, HAEBI_RUN as C } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, xpNeeded, spawnMob, comboRank, ultUpgraded, gaugeNeed, gaugeRatio, awakenedLook, isCombo, type HaebiRun } from '../src/raid/haebi.ts'
import { replay } from '../src/raid/haebi-replay.ts'

const idle = { x: 0, y: 0 }
const DT = 1 / 120
/** 레벨업 하나를 연다 (적은 안 나오게) */
function levelUp(s: HaebiRun) { s.xp = xpNeeded(s); stepHaebi(s, idle, DT) }
/** 조건이 찬 도끼 묶음 (도끼 폭풍 = 도끼 4 + 질풍 3) */
function ready() { const s = createHaebi(7); s.spawn = 1e9; s.nextElite = s.nextBarrage = 1e9; s.level = 8; s.ranks.axe = 4; s.ranks.gale = 3; return s }
/** 한 방에 쓰러지는 잡졸 하나를 장수 곁에 세운다 */
function prey(s: HaebiRun, kind?: 'elite') { spawnMob(s, kind); const e = s.enemies[s.enemies.length - 1]!; Object.assign(e, { x: s.x + 30, y: s.y, hp: 1, max: 1 }); return e }
/** 하나 잡을 때까지 (도끼 쿨 1초) */
function killOne(s: HaebiRun, kind?: 'elite') { const k = s.kills; prey(s, kind); for (let i = 0; i < 300 && s.kills === k; i++) stepHaebi(s, idle, DT) }
/** 레벨업이 안 끼는 판 (끝 레벨) */
function still() { const s = ready(); s.level = C.maxLevel; return s }

test('같은 씨앗이면 기술 나무·각성까지 같은 판', () => {
  const a = replay(11, 240, 'storm', undefined, 'bow', { awaken: true }), b = replay(11, 240, 'storm', undefined, 'bow', { awaken: true })
  assert.deepEqual(a, b)
})

test('조건이 차도 조합은 저절로 안 열리고, 다음 레벨업에 금테 카드 하나로 나온다', () => {
  const s = ready()
  levelUp(s)
  assert.deepEqual(s.combos, [])
  assert.equal(s.offers.filter(isCombo).length, 1, '조합 카드는 하나')
  assert.equal(s.offers[s.offers.length - 1], 'cyclone', '맨 끝 자리')
  // 다른 카드를 고르면 안 열리고, 다음 레벨업에 또 나온다
  const other = s.offers.find(k => !isCombo(k))!
  assert.ok(choose(s, other)); assert.deepEqual(s.combos, [])
  levelUp(s); assert.ok(s.offers.includes('cyclone'))
  assert.ok(choose(s, 'cyclone')); assert.deepEqual(s.combos, ['cyclone']); assert.equal(comboRank(s, 'cyclone'), 1)
  // 조건이 안 찬 조합은 골라도 안 된다
  s.offers = ['torrent']; assert.equal(choose(s, 'torrent'), false)
})

test('조합 단계 1→3 · 단계마다 조합 피해가 붙고 3단계는 비기 강화', () => {
  const s = ready(); s.combos = ['cyclone']; s.comboRanks = { cyclone: 1 }
  const hitWith = (rank: number) => {
    const r = structuredClone(s); r.comboRanks.cyclone = rank; r.cool.axe = r.cool.gale = 99
    spawnMob(r); Object.assign(r.enemies[0]!, { x: r.x + 145, y: r.y, hp: 1e6, max: 1e6 })
    for (let i = 0; i < 30; i++) { r.cool.axe = 99; stepHaebi(r, idle, DT) }
    return r.damage
  }
  assert.ok(hitWith(2) > hitWith(1) * 1.2, '2단계는 더 세다')
  for (const want of [2, 3]) { s.offers = ['cyclone']; s.xp = xpNeeded(s); assert.ok(choose(s, 'cyclone')); assert.equal(comboRank(s, 'cyclone'), want) }
  assert.match(s.message, /비기 강화/)
  assert.ok(ultUpgraded(s))
  s.offers = ['cyclone']; s.xp = xpNeeded(s); assert.equal(choose(s, 'cyclone'), false, '3단계가 끝')
  // 끝 단계 조합은 더 안 나온다
  s.offers = []
  for (let i = 0; i < 6; i++) { levelUp(s); assert.ok(s.offers.length); assert.ok(!s.offers.includes('cyclone')); choose(s, s.offers[0]!) }
})

test('3층 비기 강화: 비기 피해·범위가 커지고 재사용이 짧아진다', () => {
  const plain = ready(), up = ready(); up.combos = ['cyclone']; up.comboRanks = { cyclone: T.max }
  for (const r of [plain, up]) for (let i = 0; i < 6; i++) { spawnMob(r); Object.assign(r.enemies[i]!, { x: r.x + 60 + i * 60, y: r.y, hp: 1e6, max: 1e6 }) }
  for (const r of [plain, up]) { r.cool.axe = r.cool.gale = r.cool.orbit = 99; stepHaebi(r, { x: 0, y: 0, skill: true }, DT) }
  assert.ok(up.damage > plain.damage * (T.ultDamage - .05), `${up.damage} > ${plain.damage}`)
  assert.ok(Math.abs(plain.skillCd - U.axe.cooldown) < .02)
  assert.ok(Math.abs(up.skillCd - U.axe.cooldown * T.ultCooldown) < .02)
})

test('각성 막대: 잡으면 차고 → 각성(그림·힘) → sec 초 뒤 풀리고 다시 모은다 (다음은 더 많이)', () => {
  const s = still(); s.canAwaken = true
  assert.equal(awakenedLook(s), false, '처음엔 보통 모습')
  const need = gaugeNeed(s); s.gauge = need - 2
  killOne(s); assert.equal(s.form, 'normal'); assert.equal(s.gauge, need - 1); assert.ok(gaugeRatio(s) > .9)
  killOne(s)
  assert.equal(s.form, 'awake'); assert.ok(awakenedLook(s)); assert.equal(s.wakes, 1)
  // 각성 동안: 비기 쿨이 빨리 돈다 · 막대는 안 찬다
  s.skillCd = 10; stepHaebi(s, idle, .05); assert.ok(10 - s.skillCd > .05 * (A.ultRate - .1))
  killOne(s); assert.equal(s.gauge, 0)
  for (let t = 0; t < A.sec + .1; t += .05) stepHaebi(s, idle, .05)
  assert.equal(s.form, 'normal'); assert.equal(awakenedLook(s), false); assert.equal(s.gauge, 0)
  assert.ok(gaugeNeed(s) > need, '다음 각성은 더 모아야')
})

test('각성하면 같은 시간에 더 많이 벤다 (힘·공격 속도)', () => {
  const run = (form: HaebiRun['form']) => {
    const s = still(); s.form = form; s.formT = 99
    spawnMob(s); Object.assign(s.enemies[0]!, { x: s.x + 40, y: s.y, hp: 1e7, max: 1e7 })
    for (let i = 0; i < 600; i++) { s.enemies[0]!.x = s.x + 40; s.enemies[0]!.y = s.y; stepHaebi(s, idle, DT) }
    return s.damage
  }
  const normal = run('normal')
  assert.ok(run('awake') > normal * A.power * 1.1)
  assert.ok(run('grit') > normal * 1.05)
})

test('정예는 막대를 많이 채운다', () => {
  const s = still(); s.canAwaken = true
  killOne(s, 'elite')
  assert.equal(s.gauge, A.elite)
})

test('본편에서 각성 못 한 장수는 막대가 차도 투지뿐 — 모습은 그대로, 짧게', () => {
  const s = still(); s.canAwaken = false; s.gauge = gaugeNeed(s) - 1
  killOne(s)
  assert.equal(s.form, 'grit'); assert.equal(awakenedLook(s), false); assert.match(s.message, /투지/)
  for (let t = 0; t < A.gritSec + .1; t += .05) stepHaebi(s, idle, .05)
  assert.equal(s.form, 'normal')
  assert.ok(A.gritSec < A.sec && A.gritPower < A.power)
})
test('숙련(숲·여울·목책을 다 깬 장수)은 막대 절반으로 시작 · 선봉은 늘 각성 모습', () => {
  const s = createHaebi(7, 'stage', 'sword', { awaken: true, mastery: true })
  assert.equal(gaugeRatio(s), A.mastery)
  assert.equal(createHaebi(7, 'stage', 'sword', { awaken: true }).gauge, 0)
  assert.ok(awakenedLook(createHaebi(7, 'vanguard', 'axe')))
})

test('봇은 조합 카드를 먼저 고르고 20분 안에 조합을 연다', () => {
  const s = replay(7, 600, 'storm', undefined, 'axe')
  assert.ok(s.combos.length >= 1, String(s.combos))
})
