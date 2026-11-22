// 60-JACKPOT 상자 (11-22 형 「추천대로 해줘」 · docs/realm/RAID-REWARD-MAP-20261122.md §3-1·3-2) — 새 규칙 판만 바뀌고 옛 판은 그대로
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_JACKPOT as JP, HAEBI_RUN as C, HAEBI_TREE as T, HAEBI_STAGES as ST } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, reroll, spawnMob, comboChoices, comboRank, jackpotOdds, normalizedRaidOpts, usesJackpot, kitPowers, kitCombos, nodeAt, nodeOpen, branchPoints, POWERS, CHEST_RULES, KIT_RULES, type Chest, type HaebiOpts, type HaebiRun, type Kit } from '../src/raid/haebi.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, sealInput, replayRaid } from '../src/raid/runlog.ts'

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const NEW: HaebiOpts = { stage: 'forest', simRules: '55-GUMIHO', kitRules: KIT_RULES, chestRules: CHEST_RULES }
/** 적이 저절로 나오지 않는 조용한 판 */
function quiet(seed = 60, kit: Kit = 'axe', opts: HaebiOpts = NEW) {
  const s = createHaebi(seed, 'stage', kit, opts); s.spawn = 1e9; s.nextElite = s.nextBarrage = 1e9; s.t = 1; s.level = 20
  if (s.giantFlow) s.giantFlow.midSpawned = s.giantFlow.finalSpawned = true
  return s
}
const tick = (s: HaebiRun) => stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
/** 장수 발밑에 상자 하나를 놓고 한 걸음 — 주운 상자를 돌려준다 */
function drop(s: HaebiRun, large: boolean, boss = false): Chest {
  const c: Chest = { id: s.nextChestId!++, eliteId: 0, x: s.x, y: s.y, bornAt: s.t, state: 'ground', choicesRemaining: boss ? 1 : 0, gold: 10, large, ...(boss ? { boss: true } : {}) }
  s.chests!.push(c); tick(s); return c
}

test('규칙을 켠 스테이지 판만 잭팟 상자를 갖고 · 판 기록 opts 에 남는다', () => {
  assert.equal(usesJackpot(createHaebi(7, 'stage', 'axe')), false)
  assert.equal(usesJackpot(createHaebi(7, 'trial', 'axe', { chestRules: CHEST_RULES })), false, '시련 판은 상자가 없다')
  const s = createHaebi(7, 'stage', 'axe', NEW)
  assert.deepEqual(s.jackpots, { pity: 0, five: 0, eight: 0, ranks: 0 })
  assert.equal(normalizedRaidOpts(s, NEW).chestRules, CHEST_RULES)
  assert.equal(normalizedRaidOpts(createHaebi(7, 'stage', 'axe'), {}).chestRules, undefined)
})

test('옛 규칙 판의 상자는 그대로 고르는 상자다 (잭팟 없음 · 빨리 잡으면 두 번)', () => {
  const s = quiet(60, 'axe', { stage: 'forest', simRules: '55-GUMIHO', kitRules: KIT_RULES })
  s.chests!.push({ id: 1, eliteId: 0, x: s.x, y: s.y, bornAt: 0, state: 'ground', choicesRemaining: 2, gold: 10, large: true })
  tick(s)
  assert.equal(s.choiceOrigin, 'chest'); assert.equal(s.chestChoice?.left, 2); assert.equal(s.offers.length, 3)
  assert.equal(s.chests![0]!.jackpot, undefined); assert.equal(s.jackpots, undefined)
})

test('정예 상자는 고르지 않는다 — 주우면 바로 오르고 카드 창이 안 뜬다', () => {
  const s = quiet(), before = { ...s.ranks }, seed = s.seed
  const c = drop(s, true)
  assert.equal(c.state, 'claimed'); assert.equal(s.offers.length, 0); assert.equal(s.chestChoice, undefined)
  assert.ok(c.jackpot && JP.counts.includes(c.jackpot.count as 1))
  assert.equal(c.jackpot!.picks.length, c.jackpot!.count)
  const gained = kitPowers(s.kit).reduce((n, p) => n + s.ranks[p] - before[p], 0)
  assert.equal(gained, c.jackpot!.count); assert.equal(s.jackpots!.ranks, c.jackpot!.count)
  assert.equal(s.chestGold, 10); assert.equal(s.chestsClaimed, 1)
  assert.notEqual(s.seed, seed, '단계는 판의 시드 난수로 굴린다')
})

test('오르는 차례: 조건이 찬 새 조합 → 연 조합의 다음 단계 → 높은 층 기술 (하나 오를 때마다 다시 셈)', () => {
  const s = quiet(); s.ranks.axe = 4; s.ranks.gale = 3   // 산 가르기 조건
  const c = drop(s, true)                              // 빨리 잡은 상자는 적어도 3개
  assert.deepEqual(c.jackpot!.picks.slice(0, 3), ['cyclone', 'cyclone', 'cyclone'])
  assert.deepEqual(c.jackpot!.opened, ['cyclone']); assert.equal(comboRank(s, 'cyclone'), T.max)
  // 조합이 더 없으면 열린 칸 가운데 가장 높은 층 · 같은 층이면 많이 찍은 갈래
  const q = quiet(61); q.ranks.axe = 3; q.ranks.tough = 1
  const open = kitPowers(q.kit).filter(p => nodeOpen(q, p) && q.ranks[p] < POWERS[p].max)
  const top = Math.max(...open.map(p => nodeAt(q.kit, p)!.tier))
  const best = open.filter(p => nodeAt(q.kit, p)!.tier === top).sort((a, b) => branchPoints(q, nodeAt(q.kit, b)!.branch) - branchPoints(q, nodeAt(q.kit, a)!.branch))[0]
  const d = drop(q, false)
  assert.equal(d.jackpot!.picks[0], best)
})

test('조건이 찬 조합은 상자에서 반드시 나온다 (느리게 잡아 1개여도)', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const s = quiet(seed, 'bow'); s.ranks.bow = 4; s.ranks.rain = 3
    const c = drop(s, false)
    assert.equal(c.jackpot!.picks[0], 'volley', `씨앗 ${seed}`); assert.ok(s.combos.includes('volley'))
  }
})

test('단계 표: 빨리 잡으면 적어도 3개 · 느리게 잡으면 8개는 없다 · 첫 상자 몫은 표대로', () => {
  const tally = { slow: [0, 0, 0, 0], fast: [0, 0, 0, 0] }, n = 4000
  for (let seed = 1; seed <= n; seed++) for (const large of [false, true]) {
    const count = drop(quiet(seed), large).jackpot!.count
    tally[large ? 'fast' : 'slow'][JP.counts.indexOf(count as 1)]!++
  }
  assert.equal(tally.fast[0], 0); assert.equal(tally.slow[3], 0)
  for (const key of ['slow', 'fast'] as const) for (let i = 0; i < 4; i++) assert.ok(Math.abs(tally[key][i]! / n - JP[key][i]!) < .025, `${key} ${JP.counts[i]}개 ${tally[key][i]! / n} ≠ ${JP[key][i]}`)
  assert.equal(JP.slow.reduce((a: number, b) => a + b, 0), 1); assert.equal(JP.fast.reduce((a: number, b) => a + b, 0), 1)
})

test('5개 넘게 못 터진 상자마다 다음 상자의 5개 몫이 오르고 · 터지면 처음으로 · 8개 몫은 그대로', () => {
  const s = quiet()
  for (let i = 0; i < 40; i++) {
    const pity = s.jackpots!.pity, odds = jackpotOdds(s, false), fast = jackpotOdds(s, true)
    assert.ok(Math.abs(odds[2] - Math.min(1, JP.slow[2] + pity * JP.pityStep)) < 1e-9)
    assert.equal(odds[3], JP.slow[3]); assert.equal(fast[3], JP.fast[3]); assert.equal(fast[0], 0, '빨리 잡은 상자에 1개는 없다')
    assert.ok(Math.abs(odds.reduce((a, b) => a + b, 0) - 1) < 1e-9); assert.ok(odds.every(p => p >= 0))
    const before = { five: s.jackpots!.five, eight: s.jackpots!.eight }
    const count = drop(s, i % 2 === 0).jackpot!.count
    if (count >= 5) { assert.equal(s.jackpots!.pity, 0); assert.equal(s.jackpots!.five + s.jackpots!.eight, before.five + before.eight + 1) }
    else assert.equal(s.jackpots!.pity, pity + 1)
  }
  assert.ok(s.jackpots!.five + s.jackpots!.eight > 0, '마흔 상자면 대박이 한 번은 난다')
  // 한 판(상자 여섯)에 5개가 대체로 한 번은 터진다
  let runs = 0
  for (let seed = 1; seed <= 400; seed++) { const q = quiet(seed); for (let i = 0; i < 6; i++) drop(q, false); if (q.jackpots!.five + q.jackpots!.eight > 0) runs++ }
  assert.ok(runs / 400 > .5, `느리게만 잡아도 ${runs}/400 판에서 5개`)
})

test('올릴 칸이 없으면 엽전으로 바뀐다', () => {
  const s = quiet(); for (const p of kitPowers(s.kit)) s.ranks[p] = POWERS[p].max
  for (const c of kitCombos(s.kit)) { s.combos.push(c.id); s.comboRanks[c.id] = T.max }
  const c = drop(s, true)
  assert.deepEqual(c.jackpot!.picks, []); assert.equal(c.jackpot!.bonus, c.jackpot!.count * Math.floor(JP.spareGold * ST.forest.gold))
  assert.equal(s.chestGold, 10 + c.jackpot!.bonus); assert.equal(c.state, 'claimed'); assert.equal(s.offers.length, 0)
})

test('같은 씨앗 · 같은 입력이면 상자도 똑같이 터진다', () => {
  const run = (seed: number) => { const s = quiet(seed); s.ranks.axe = 4; for (let i = 0; i < 8; i++) drop(s, i % 3 === 0); return s }
  assert.equal(hash(run(77)), hash(run(77)))
  assert.notEqual(hash(run(77).chests!.map(c => c.jackpot!.count)), hash(run(78).chests!.map(c => c.jackpot!.count)))
})

test('중간 보스 상자: 안 연 조합 셋 중 하나를 고르면 조건 없이 바로 열린다', () => {
  const s = quiet(); s.ranks.gale = 1
  const c = drop(s, false, true)
  assert.equal(c.state, 'opened'); assert.equal(c.jackpot, undefined, '중간 보스 상자는 터지지 않고 고른다')
  assert.equal(s.choiceOrigin, 'chest'); assert.equal(s.chestChoice?.id, c.id)
  assert.deepEqual(s.offers, kitCombos('axe').map(x => x.id)); assert.equal(s.offers.length, 3)
  assert.equal(reroll(s), false)
  assert.equal(comboChoices(s).fresh.length, 0, '조건은 하나도 안 찼다')
  const nonce = s.offerNonce
  assert.equal(choose(s, 'inferno', nonce! + 1), false, '낡은 누름은 버린다')
  assert.equal(choose(s, 'inferno', nonce), true)
  assert.ok(s.combos.includes('inferno')); assert.equal(comboRank(s, 'inferno'), 1); assert.equal(c.state, 'claimed'); assert.equal(s.offers.length, 0)
  assert.ok(s.ranks.ember >= 1 && s.ranks.thunder >= 1, '조합이 얹히는 무기가 없으면 1단계로 같이 준다')
  assert.ok(comboChoices(s).more.includes('inferno'), '조건 없이 연 조합도 다음 단계가 나온다')
  // 다음 정예 상자는 그 조합을 올린다 (연 조합의 다음 단계가 기술보다 먼저)
  assert.equal(drop(s, true).jackpot!.picks[0], 'inferno')
})

test('중간 보스 상자: 조합을 다 열었으면 한 단계 올린다 · 정예 상자와 달리 고른다', () => {
  const s = quiet(); for (const c of kitCombos(s.kit)) { s.combos.push(c.id); s.comboRanks[c.id] = 1 }
  const c = drop(s, false, true)
  assert.equal(s.choiceOrigin, 'chest'); assert.ok(s.offers.length > 0 && s.offers.length <= 3)
  assert.deepEqual(s.offers.slice(0, 3), kitCombos(s.kit).map(x => x.id), '연 조합의 다음 단계가 먼저')
  assert.equal(choose(s, s.offers[0]!, s.offerNonce), true); assert.equal(comboRank(s, s.combos[0]!), 2); assert.equal(c.state, 'claimed')
})

test('정예가 쓰러지면 터지는 상자, 중간 보스가 쓰러지면 고르는 상자가 떨어진다', () => {
  for (const mid of [false, true]) {
    const s = quiet(); s.level = C.maxLevel
    spawnMob(s, mid ? 'boss' : 'elite'); const e = s.enemies[0]!
    if (mid) e.bossRole = 'midboss'
    Object.assign(e, { x: s.x + 30, y: s.y, hp: .01, bornAt: s.t }); s.cool.axe = 0
    for (let i = 0; i < 240 && !s.chests!.length; i++) tick(s)
    const c = s.chests![0]!
    assert.equal(c.boss === true, mid); assert.equal(c.choicesRemaining, mid ? 1 : 0)
  }
})

test('새 상자 규칙 판도 같은 입력·고름이면 기록에서 똑같이 다시 돈다 (잭팟이 터진 판)', () => {
  const opts: HaebiOpts = { ...NEW, permanentAwake: false, appearanceAwake: true, bonus: { might: 10, vigor: 10, armor: 5, haste: 5 } }
  for (const kit of ['axe', 'sling'] as Kit[]) {
    const run = createHaebi(60, 'stage', kit, opts)
    const r = startRecord(run, { id: 'jackpot-' + kit, started: '2026-11-22T00:00:00Z', mode: 'stage', stage: 'forest', hero: 'ara', kit, sprite: 'ara', seed: 60, opts, from: null })
    for (let i = 0; i < 330 * 120 && run.state === 'playing'; i++) {
      while (run.offers.length) { const pick = botChoice(run, 'spread'); choose(run, pick); recPick(r, pick) }
      // 봇은 상자를 찾아가지 않는다 — 땅에 상자가 있으면 그쪽으로 걷는다
      const chest = run.chests!.find(c => c.state === 'ground'), d = chest ? Math.hypot(chest.x - run.x, chest.y - run.y) || 1 : 1
      stepHaebi(run, recInput(r, chest ? { ...botInput(run, .5), x: (chest.x - run.x) / d, y: (chest.y - run.y) / d } : botInput(run, .5)), 1 / 120)
    }
    const game = sealInput(r), copy = replayRaid(game)
    assert.equal(game.opts.chestRules, CHEST_RULES)
    assert.ok(run.chests!.some(c => c.jackpot), `${kit}: 잭팟 상자가 하나는 터졌다`)
    assert.equal(hash(copy), hash(run), kit)
  }
})
