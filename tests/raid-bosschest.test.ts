// 68-BOSSCHEST 중간 보스 상자가 늘 카드 셋 (형 11-23 「중간보스 잡은 보상이 뇌화연옥밖에 없던 적이 너무 많음」) — 새 규칙 판만 · 끈 판은 예전과 글자 하나까지 같다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_BOSS_CHEST as BC, HAEBI_TREE as T } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, bossLoot, bossLootOpen, kitCombos, kitPowers, comboRank, isCombo, POWERS, runGold, KITS, KIT_RULES, CHEST_RULES, MAP_RULES, SOLID_RULES, ANCHOR_RULES, BREAK_RULES, BUILD_RULES, BUILD2_RULES, CAP_RULES, BOSSCHEST_RULES, raidRulesForStage, type HaebiOpts, type HaebiRun, type Kit, type Power, type Combo } from '../src/raid/haebi.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, sealInput, replayRaid } from '../src/raid/runlog.ts'

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const prod = (on: boolean): HaebiOpts => ({ stage: 'forest', bonus: { might: 4, haste: 2, magnet: 10 }, simRules: raidRulesForStage('forest'), permanentAwake: false, appearanceAwake: true, kitRules: KIT_RULES, chestRules: CHEST_RULES, mapRules: MAP_RULES, blockRules: SOLID_RULES, anchorRules: ANCHOR_RULES, breakRules: BREAK_RULES, buildRules: BUILD_RULES, build2Rules: BUILD2_RULES, capRules: CAP_RULES, ...(on ? { bossChestRules: BOSSCHEST_RULES } : {}) })
/** 봇 판 (보스 상자 카드를 적는다) */
function bot(opts: HaebiOpts, seconds: number, kit: Kit = 'axe', seed = 7) {
  const s = createHaebi(seed, 'stage', kit, opts), boss: string[][] = []
  for (let i = 0; i < seconds * 60 && s.state === 'playing'; i++) {
    if (s.offers.length) { if (s.choiceOrigin === 'chest' && s.chests?.find(c => c.id === s.chestChoice?.id)?.boss) boss.push([...s.offers]); choose(s, botChoice(s, 'storm')) } else stepHaebi(s, botInput(s, .5), 1 / 60)
  }
  return { s, boss }
}
/** 조용한 판에 중간 보스 상자를 장수 발밑에 둔다 — 다음 걸음에 열린다 */
function withChest(on: boolean, kit: Kit, setup: (s: HaebiRun) => void) {
  const s = createHaebi(5, 'stage', kit, { stage: 'forest', simRules: '56B', kitRules: KIT_RULES, chestRules: CHEST_RULES, ...(on ? { bossChestRules: BOSSCHEST_RULES } : {}) })
  s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9
  setup(s)
  s.chests!.push({ id: s.nextChestId!++, eliteId: 0, x: s.x, y: s.y, bornAt: s.t, state: 'ground', choicesRemaining: 1, gold: 0, large: false, boss: true })
  stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  return s
}
const open = (s: HaebiRun, ...ids: Combo[]) => { for (const id of ids) { s.combos.push(id); s.comboRanks[id] = 1 } }

/** 68 을 넣기 전 코드(커밋 8265c31e)로 잰 판 상태 — 지금 열전 규칙 · 형의 상점 · 보스 상자(뇌화 연옥·천 갈래 바람)를 지난 숲 도끼 판 */
test('68-BOSSCHEST off: 보스 상자를 지난 판이 넣기 전과 같다', () => {
  const { s, boss } = bot(prod(false), 760)
  assert.deepEqual(boss, [['inferno', 'torrent']], '옛 상자는 안 연 조합만')
  assert.equal(s.bossChest, undefined)
  assert.equal(hash(s), '53e00d3e0e56307daa16d4ca7a7c9b812d9981ed1a4b726c08d50c61c220f845')
})

test('68 on: 안 연 조합이 뇌화 연옥 하나여도 카드는 셋 (연 조합의 다음 단계로 채운다) · 끄면 예전처럼 뇌화 연옥 하나', () => {
  const kit: Kit = 'axe', mine = kitCombos(kit).filter(c => c.kit === kit).map(c => c.id)
  const on = withChest(true, kit, s => open(s, ...mine))
  assert.equal(on.offers.length, 3); assert.equal(new Set(on.offers).size, 3)
  assert.equal(on.offers[0], 'inferno', '안 연 조합이 맨 앞')
  assert.deepEqual(on.offers.slice(1), mine, '그다음 연 조합의 다음 단계')
  assert.ok(bossLootOpen(on))
  const off = withChest(false, kit, s => open(s, ...mine))
  assert.deepEqual(off.offers, ['inferno'], '옛 상자는 한 장')
})

test('68 on: 조합이 다 끝 단계면 갈래 끝 → 주 무기 → 나머지 칸 셋 · 칸을 고르면 두 단계', () => {
  for (const kit of ['axe', 'bow', 'dagger'] as Kit[]) {
    const s = withChest(true, kit, r => { for (const c of kitCombos(kit)) { r.combos.push(c.id); r.comboRanks[c.id] = T.max } r.ranks[KITS[kit].primary] = 6; r.ranks.reach = 3; r.ranks.hone = 2 })
    assert.equal(s.offers.length, 3, kit); assert.ok(s.offers.every(k => !isCombo(k)), kit)
    assert.deepEqual(s.offers, bossLoot(s))
    assert.ok(s.offers.indexOf(KITS[kit].primary) >= 0 || s.offers.some(k => k === 'capA' || k === 'capB' || k === 'capC'), `${kit} 갈래 끝 또는 주 무기가 앞에 (${s.offers.join(',')})`)
    const pick = s.offers[0] as Power, before = s.ranks[pick]
    assert.ok(choose(s, pick))
    assert.equal(s.ranks[pick], Math.min(POWERS[pick].max, before + BC.ranks), `${kit} ${pick} 두 단계`)
    assert.equal(s.offers.length, 0)
  }
  // 끝 단계 하나 앞이면 끝 단계에서 멈춘다
  const s = withChest(true, 'axe', r => { for (const c of kitCombos('axe')) { r.combos.push(c.id); r.comboRanks[c.id] = T.max } for (const p of kitPowers('axe')) if (p !== 'axe') r.ranks[p] = POWERS[p].max; r.ranks.axe = POWERS.axe.max - 1 })
  assert.deepEqual(s.offers, ['axe']); assert.ok(choose(s, 'axe')); assert.equal(s.ranks.axe, POWERS.axe.max)
})

test('68 on: 조합 카드는 예전처럼 한 단계 · 올릴 것이 하나도 없으면 빈 창 대신 큰 금', () => {
  const s = withChest(true, 'axe', r => open(r, 'cyclone', 'torrent'))
  assert.ok(choose(s, 'cyclone')); assert.equal(comboRank(s, 'cyclone'), 2)
  const full = withChest(true, 'axe', r => { for (const c of kitCombos('axe')) { r.combos.push(c.id); r.comboRanks[c.id] = T.max } for (const p of kitPowers('axe')) r.ranks[p] = POWERS[p].max })
  assert.equal(full.offers.length, 0, '빈 창을 띄우지 않는다')
  const gold = full.fx.find(f => f.bossGold !== undefined)?.bossGold ?? 0
  assert.ok(gold >= BC.gold, '큰 금'); assert.ok(runGold(full) >= gold)
  assert.ok(full.chests!.every(c => c.state === 'claimed'))
})

test('68 on: 봇 판의 보스 상자는 늘 카드 셋 · 뇌화 연옥 혼자는 없다 · 같은 씨앗이면 판이 같다', () => {
  const a = bot(prod(true), 760), b = bot(prod(true), 760)
  assert.equal(a.boss.length, 1, '보스 상자를 열었다'); assert.equal(a.boss[0]!.length, 3, String(a.boss[0])); assert.ok(a.boss[0]!.includes('inferno'), '뇌화 연옥도 카드 가운데 하나'); assert.notDeepEqual(a.boss[0], ['inferno'])
  assert.equal(a.s.bossChest, true)
  assert.equal(hash(a.s), hash(b.s))
})

test('68 on: 판 기록 opts 에 남고 기록 재생이 같다', () => {
  const opts = prod(true), s = createHaebi(7, 'stage', 'axe', opts)
  const r = startRecord(s, { id: 'boss68', started: '2026-11-23T00:00:00Z', mode: 'stage', stage: 'forest', hero: 'haebi', kit: 'axe', sprite: 'haebi', seed: 7, opts, from: null })
  for (let i = 0; i < 150 * 120 && s.state === 'playing'; i++) {
    while (s.offers.length) { const p = botChoice(s, 'storm'); choose(s, p); recPick(r, p) }
    stepHaebi(s, recInput(r, botInput(s, .5)), 1 / 120)
  }
  const game = sealInput(r)
  assert.equal(game.opts.bossChestRules, BOSSCHEST_RULES)
  assert.equal(hash(replayRaid(JSON.parse(JSON.stringify(game)))), hash(s))
})
