// 열전 기술 나무 · 판 안 각성 (11-17 · docs/realm/RAID-LINK.md §1·§2)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_TREE as T, HAEBI_AWAKEN as A, HAEBI_ULT as U, HAEBI_RUN as C } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, xpNeeded, spawnMob, comboRank, ultUpgraded, gaugeNeed, gaugeRatio, awakenedLook, isCombo, wakeReady, ultName, POWERS, type HaebiRun } from '../src/raid/haebi.ts'
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
  assert.ok(Math.abs(plain.skillCd - U.axe.cooldown) < .02)
  assert.ok(Math.abs(up.skillCd - U.axe.cooldown * T.ultCooldown) < .02)
  for (const r of [plain, up]) for (let i = 0; i < 600 && r.cast; i++) stepHaebi(r, idle, DT)
  assert.ok(up.damage > plain.damage * (T.ultDamage - .05), `${up.damage} > ${plain.damage}`)
})

test('각성 막대: 잡으면 차고 → 각성(그림·힘) → sec 초 뒤 풀리고 다시 모은다 (다음은 더 많이)', () => {
  const s = still(); s.canAwaken = true
  assert.equal(awakenedLook(s), false, '처음엔 보통 모습')
  const need = gaugeNeed(s); s.gauge = need - 2
  killOne(s); assert.equal(s.form, 'normal'); assert.equal(s.gauge, need - 1); assert.ok(gaugeRatio(s) > .9)
  killOne(s)
  // 막대가 차도 저절로 각성하지 않는다 — 각성 단추(wake)를 누를 때까지 찬 채로 기다린다 (11-17 형)
  assert.equal(s.form, 'normal'); assert.ok(wakeReady(s)); assert.equal(gaugeRatio(s), 1)
  killOne(s); assert.equal(s.gauge, need, '찬 막대는 넘치지 않는다')
  stepHaebi(s, { ...idle, wake: true }, DT)
  assert.equal(s.form, 'awake'); assert.ok(awakenedLook(s)); assert.equal(s.wakes, 1); assert.equal(s.gauge, 0)
  assert.equal(s.cast?.kind, 'wake', '각성 컷인 동안은 시전')
  // 각성 시전 동안 비기를 눌러도 기다린다 (컷인이 겹치지 않게)
  const cd = s.skillCd; stepHaebi(s, { ...idle, skill: true }, DT); assert.equal(s.cast?.kind, 'wake'); assert.equal(s.skillCd, cd)
  for (let i = 0; i < 600 && s.cast; i++) stepHaebi(s, idle, DT)
  assert.equal(s.formT, A.sec, '각성 시간은 시전이 끝난 뒤부터')
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

test('도깨비 도장이 없는 장수(canAwaken 거짓)는 막대가 차도 투지뿐 — 모습은 그대로, 짧게', () => {
  const s = still(); s.canAwaken = false; s.gauge = gaugeNeed(s) - 1
  killOne(s); stepHaebi(s, { ...idle, wake: true }, DT)
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

test('각성 동안·시전 동안은 다치지 않는다 · 투지는 다친다', () => {
  const shot = (s: HaebiRun) => { s.enemies = []; s.inv = 0; s.shots.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 1, kind: 'enemy', damage: 30, radius: 10, hit: [], angle: 0, tx: 0, ty: 0 }); const hp = s.hp; stepHaebi(s, idle, DT); return hp - s.hp }
  const awake = still(); awake.form = 'awake'; awake.formT = 9
  assert.equal(shot(awake), 0)
  const casting = still(); stepHaebi(casting, { ...idle, skill: true }, DT); assert.ok(casting.cast)
  assert.equal(shot(casting), 0)
  const grit = still(); grit.form = 'grit'; grit.formT = 9
  assert.ok(shot(grit) > 0)
})

test('영웅의 투지: 최대 체력의 gritShield 몫 보호막이 먼저 받고, 다 깎이거나 투지가 끝나면 사라진다', () => {
  const shot = (s: HaebiRun, damage: number) => { s.enemies = []; s.inv = 0; s.shots.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 1, kind: 'enemy', damage, radius: 10, hit: [], angle: 0, tx: 0, ty: 0 }); const hp = s.hp; stepHaebi(s, idle, DT); return hp - s.hp }
  const s = still(); s.canAwaken = false; s.gauge = gaugeNeed(s)
  stepHaebi(s, { ...idle, wake: true }, DT)
  assert.equal(s.form, 'grit'); assert.match(s.message, /영웅의 투지/)
  assert.equal(s.ward, s.maxHp * A.gritShield)
  // 작은 한 대는 보호막이 다 받는다 (체력은 그대로 · 아파하는 몸짓 없음)
  const before = s.ward
  assert.ok(shot(s, 10) <= C.regen * DT * 2, '체력이 안 깎인다'); assert.ok(s.ward < before); assert.equal(s.hurt, 0)
  // 큰 한 대는 보호막을 깨고 남은 만큼 체력으로
  assert.ok(shot(s, 1e4) > 0); assert.equal(s.ward, 0)
  // 다시 투지 → 끝나면 보호막도 사라진다
  const t = still(); t.canAwaken = false; t.gauge = gaugeNeed(t); stepHaebi(t, { ...idle, wake: true }, DT)
  assert.ok(t.ward > 0)
  for (let k = 0; k < A.gritSec + .1; k += .05) stepHaebi(t, idle, .05)
  assert.equal(t.form, 'normal'); assert.equal(t.ward, 0)
  // 본편 각성 장수의 각성은 보호막 없이 무적
  const w = still(); w.canAwaken = true; w.gauge = gaugeNeed(w); stepHaebi(w, { ...idle, wake: true }, DT)
  assert.equal(w.form, 'awake'); assert.equal(w.ward, 0)
})

test('진 비기: 각성 중의 비기는 이름에 「진」 · 더 세고 넓다 · 그림에 진 표식', () => {
  const fire = (form: HaebiRun['form']) => {
    const s = still(); s.form = form; s.formT = 99
    for (let i = 0; i < 8; i++) { spawnMob(s); Object.assign(s.enemies[i]!, { x: s.x + 70 + i * 40, y: s.y + (i % 2) * 20, hp: 1e7, max: 1e7, cd: 99 }) }
    stepHaebi(s, { ...idle, skill: true }, DT)
    const tru = !!s.cast?.tru
    for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) s.cool[k] = 99
    const before = s.damage
    for (let i = 0; i < 600 && (s.cast || s.ult); i++) { for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) s.cool[k] = 99; stepHaebi(s, idle, DT) }
    return { tru, damage: s.damage - before, mark: s.fx.some(f => f.ult && f.tru) }
  }
  const plain = fire('normal'), tru = fire('awake')
  assert.equal(plain.tru, false); assert.equal(tru.tru, true); assert.ok(tru.mark && !plain.mark)
  assert.ok(tru.damage > plain.damage * U.trueDamage, `${tru.damage} > ${plain.damage} × 진`)
  assert.equal(ultName('magic', true), '진 천벌'); assert.equal(ultName('magic', false), '천벌')
})

test('끝 단계까지 찍은 칸은 레벨업 카드에 다시 안 나온다 (조합 재료여도)', () => {
  const s = still(); s.level = 10; s.ranks.axe = POWERS.axe.max; s.ranks.reach = POWERS.reach.max; s.ranks.ember = POWERS.ember.max; s.ranks.tempo = POWERS.tempo.max
  for (let i = 0; i < 40; i++) { s.offers = []; levelUp(s); for (const p of s.offers) if (!isCombo(p)) assert.ok(s.ranks[p] < POWERS[p].max, `${p} 끝 단계인데 나옴`); s.level = 10 }
})

test('봇은 각성 막대가 차면 바로 누른다', () => {
  const s = replay(3, 420, 'storm', undefined, 'axe', { awaken: true })
  assert.ok(s.wakes >= 1, `각성 ${s.wakes}번`)
})
