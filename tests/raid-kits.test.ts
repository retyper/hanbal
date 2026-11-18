// 장수 열전 무기 묶음 (11-15 형: 「각성 시련을 모든 장수로 · 활·창·칼 먼저」)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_RUN as C, getParam, setParam } from '../src/tune/params.ts'
import { createHaebi, choose, stepHaebi, KITS, attackPowers, kitPowers, type Kit } from '../src/raid/haebi.ts'
import { replay } from '../src/raid/haebi-replay.ts'
import { kitOfSprite } from '../src/raid/hero-kit.ts'
import { hasAwakeningTrial } from '../src/realm/trial-rules.ts'
import { trialBlock, completeTrial } from '../src/realm/awakening-trial.ts'
import { battleGrowth, ascendNeed } from '../src/realm/heroes.ts'
import { startTutorial } from '../src/realm/data/regions/tutorial.ts'
import { byeonhanMini } from '../src/realm/data/regions/byeonhan-mini.ts'
import type { ReportLine } from '../src/realm/types.ts'

const NEW: Kit[] = ['bow', 'spear', 'sword', 'dagger', 'magic']

test('각 묶음은 제 주 무기로 시작하고 첫 고름은 갈래마다 하나 (보조 공격 · 주 무기 · 기세)', () => {
  for (const kit of NEW) {
    const s = createHaebi(7, 'trial', kit), k = KITS[kit]
    assert.equal(s.ranks[k.primary], 1)
    assert.equal(s.ranks[k.secondary], 0, '보조 공격은 첫 카드로 (11-19 형: 「시작은 평타만」)')
    assert.equal(s.ranks.axe, 0)
    s.xp = 999; stepHaebi(s, { x: 0, y: 0 }, .01)
    assert.deepEqual(s.offers, [k.secondary, k.primary, 'tempo'])
    assert.ok(attackPowers(kit).every(p => kitPowers(kit).includes(p)))
    assert.ok(!kitPowers(kit).includes('gale') && !kitPowers(kit).includes('axe'))
  }
})

test('같은 씨앗·같은 입력이면 같은 판 · 남의 묶음 능력은 고를 수 없다', () => {
  for (const kit of NEW) {
    const a = replay(5, 90, 'storm', undefined, kit), b = replay(5, 90, 'storm', undefined, kit)
    assert.deepEqual(a, b)
    const s = createHaebi(3, 'trial', kit); s.xp = 999; stepHaebi(s, { x: 0, y: 0 }, .01)
    assert.equal(choose(s, 'gale'), false)
  }
})

// 11-16: 강화 없이 숲 산길 20분은 완벽한 봇도 두목 앞에서 아슬아슬 (형: 「처음엔 못 깨게」) — 상점을 조금 산 판으로 본다
// 11-19 「시작은 평타만」(보조 공격을 첫 카드로) 뒤로 판의 길이 바뀌어 씨앗 7 의 단검이 두목 앞에서 진다 (예전에도 씨앗 11 은 졌다 ·
// 상점 조금 · 씨앗 넷: 예전 18/20 · 지금 17/20 · 단검이 가장 약하다). 그래서 씨앗 셋 가운데 처음 이긴 판으로 본다 (대개 첫 씨앗에서 끝난다)
test('활·창·칼 모두 상점을 조금 산 봇이 숲 산길 20분 두목을 잡고 제 조합을 완성한다', () => {
  for (const kit of NEW) {
    let s = replay(7, C.duration, 'storm', r => assert.ok(r.shots.length <= C.maxShots), kit, { bonus: { vigor: 3, might: 2, armor: 1 } })
    for (const seed of [11, 13]) if (s.state !== 'won') s = replay(seed, C.duration, 'storm', undefined, kit, { bonus: { vigor: 3, might: 2, armor: 1 } })
    assert.equal(s.state, 'won', kit)
    assert.ok(s.t >= C.bossAt)
    assert.ok(s.kills > 4000, `${kit} ${s.kills}`)
    assert.ok(s.combos.some(c => c !== 'inferno'), `${kit} ${s.combos}`)
    assert.ok(s.ranks[KITS[kit].primary] > 1 && s.ranks[KITS[kit].secondary] > 0, kit)
  }
})

test('전투 그림에서 무기 묶음 · 표에 없는 결도 가까운 묶음으로', () => {
  assert.equal(kitOfSprite('haebi'), 'axe')
  assert.equal(kitOfSprite('maenun'), 'bow')
  assert.equal(kitOfSprite('sori'), 'dagger', '단검 장수는 단검 묶음 (11-16)')
  assert.equal(kitOfSprite('base-g-15-shaman-man'), 'magic', '방울·지팡이 장수는 주술 묶음 (11-16)')
  assert.equal(kitOfSprite('gamsil'), 'magic', '원화가 방울이면 주술 묶음 · 원장 무기보다 원화가 먼저 (11-16 무기 감사)')
  assert.equal(kitOfSprite('g-bow'), 'bow')
  assert.equal(kitOfSprite('w-spear'), 'spear')
  assert.equal(kitOfSprite('없는-그림'), 'sword')
})

test('해비 말고 다른 우리 장수도 공훈으로 시련이 열리고, 시련을 넘어야 각성한다 (시련 관문이 열린 규칙 · ascendTrialOpen 1)', () => {
  // 본편의 시련 관문을 닫은 규칙(0 · 각성 v2)은 tests/realm/ascend-switch.test.ts 가 본다. 이 시험은 열린 규칙을 못박아 본다
  const was = getParam('realm.ascendTrialOpen')!
  setParam('realm.ascendTrialOpen', 1)
  try {
    const r = byeonhanMini(1)
    const h = Object.values(r.heroes).find(x => x.faction === r.player && x.status === 'free' && hasAwakeningTrial(x))!
    assert.ok(h, '시련이 있는 다른 우리 장수')
    const lines: ReportLine[] = []
    for (let i = 0; i < ascendNeed(h); i++) battleGrowth(r, [h.id], [], [], lines)
    assert.notEqual(h.ascended, true)
    assert.equal(h.trialReady, true)
    assert.equal(trialBlock(r, h.id), null)
    const done = completeTrial(r, h.id)!
    assert.equal(done.next.heroes[h.id]!.ascended, true)
    assert.equal(done.next.heroes[h.id]!.trialCleared, true)
    assert.equal(r.heroes[h.id]!.ascended, undefined, '원본은 그대로 (저장이 끝난 뒤에 채택)')
  } finally { setParam('realm.ascendTrialOpen', was) }
})

test('배우는 판의 다른 장수는 예전 길 — 이기면 바로 각성 (판이 약속한 말갈기 각성) · 해비만 시련', () => {
  const r = startTutorial(777)
  assert.equal(hasAwakeningTrial({ id: 'tut-haebi' }), true)
  for (const h of Object.values(r.heroes)) if (h.id !== 'tut-haebi' && h.id.startsWith('tut-')) assert.equal(hasAwakeningTrial(h), false, h.id)
})

test('가만히 서서 고르기만 하면 어느 묶음도 못 깬다 — 일제 사격의 붉은 고리를 피해야 한다 (형 11-15)', () => {
  for (const kit of ['axe', ...NEW] as Kit[]) {
    const s = createHaebi(7, 'trial', kit)
    while (s.state === 'playing') { if (s.offers.length) choose(s, s.offers[0]!); else stepHaebi(s, { x: 0, y: 0 }, 1 / 120) }
    assert.equal(s.state, 'lost', kit)
    assert.ok(s.t < C.bossAt / 2, `${kit} ${Math.round(s.t)}초 — 두목은커녕 절반도 못 간다`)
  }
})

test('일제 사격은 경고 뒤에 떨어지고, 비켜나면 맞지 않는다', () => {
  const s = createHaebi(7, 'trial', 'axe')
  const step = (x: number) => { if (s.offers.length) choose(s, s.offers[0]!); else stepHaebi(s, { x, y: 0 }, 1 / 120) }
  for (let i = 0; i < 120 * 60 && !s.shots.some(b => b.kind === 'barrage'); i++) step(0)
  const ring = s.shots.find(b => b.kind === 'barrage')!, hp = s.hp
  assert.ok(Math.abs(ring.life - C.barrageDelay) < .02, '뜨자마자는 경고 시간 그대로')
  s.enemies.length = 0; s.inv = 0
  for (let i = 0; i < 120 * C.barrageDelay + 5; i++) { s.enemies.length = 0; s.shots = s.shots.filter(b => b.kind !== 'enemy'); step(1) }
  assert.ok(Math.hypot(s.x - ring.x, s.y - ring.y) > C.barrageRadius, '경고 시간 안에 걸어서 벗어난다')
  assert.ok(s.hp >= hp, '벗어났으면 안 맞는다')
})
