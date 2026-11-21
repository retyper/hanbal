import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHaebi, spawnMob, stepHaebi, choose, reroll, runGold, xpNeeded, POWERS, kitPowers, kitCombos, type Mob, type HaebiRun, type StageId } from '../src/raid/haebi.ts'
import { initChampion, stepChampion, championDamageScale, championFanAngles, spawnView, type ChampionHooks } from '../src/raid/champion.ts'
import { HAEBI_RUN as C, HAEBI_CHAMPION as B, HAEBI_TREE as T } from '../src/tune/params.ts'

const stages: StageId[] = ['forest', 'ford', 'palisade', 'snow', 'fortress']
function quiet(stage: StageId = 'forest', kind: 'elite' | 'boss' = 'elite') {
  const s = createHaebi(53, 'stage', 'axe', { stage })
  s.spawn = s.nextElite = s.nextBarrage = 1e9; s.level = C.maxLevel
  for (const k of Object.keys(s.cool) as (keyof typeof s.cool)[]) s.cool[k] = 1e9
  spawnMob(s, kind); const e = s.enemies[0]!
  e.x = s.x - 100; e.y = s.y; e.cd = 0; e.champion!.mode = 'chase'
  return { s, e }
}
function hooks() {
  const damage: number[] = [], fans: number[] = [], summons: string[] = [], cues: string[] = []
  const h: ChampionHooks = { hurt: n => damage.push(n), fan: n => fans.push(n), summon: k => summons.push(k), cue: k => cues.push(k) }
  return { h, damage, fans, summons, cues }
}
function tick(s: HaebiRun, seconds = .01) { for (let t = 0; t < seconds - 1e-8; t += .01) stepHaebi(s, { x: 0, y: 0 }, .01) }
function chest(large = true) {
  const { s } = quiet(); s.enemies = []; s.hp = s.maxHp
  s.chests!.push({ id: 1, eliteId: 99, x: s.x, y: s.y, bornAt: 0, state: 'ground', choicesRemaining: large ? 2 : 1, gold: 12, large })
  return s
}

test('53B stage elite has a real phase, pattern sequence and entry state', () => {
  const s = createHaebi(53, 'stage', 'axe')
  spawnMob(s, 'elite')
  const e = s.enemies[0]! as Mob & { phase?: number; patternSeq?: number; recovery?: number }
  assert.equal(e.phase, 1)
  assert.equal(e.patternSeq, 0)
  assert.equal(e.recovery, 0)
})

test('53B stage chest lifecycle is separate from experience drops', () => {
  const s = createHaebi(53, 'stage', 'axe') as HaebiRun & { chests?: unknown[] }
  assert.deepEqual(s.chests, [])
  assert.notEqual(s.chests, s.drops)
})

test('53B all stages cycle two real phase1 patterns then their third phase2 pattern', () => {
  for (const stage of stages) {
    const { s, e } = quiet(stage), { h } = hooks(), got: string[] = []
    for (let i = 0; i < 2; i++) {
      e.champion!.mode = 'chase'; e.cd = 0; e.recovery = 0
      stepChampion(s, e, .01, h); got.push(e.pattern!)
    }
    assert.deepEqual(got, B.stages[stage as keyof typeof B.stages].patterns.slice(0, 2), stage)
    e.phase = 2; e.champion!.mode = 'chase'; e.cd = 0; e.recovery = 0
    stepChampion(s, e, .01, h)
    assert.equal(e.pattern, B.stages[stage as keyof typeof B.stages].patterns[2]); assert.equal(e.patternSeq, 3)
  }
})

test('53B a nonlethal burst queues phase2 then phase3 and one wave; a dead boss does nothing', () => {
  const { s, e } = quiet('ford', 'boss'), { h, cues, summons, damage } = hooks()
  e.hp = e.max * .2
  stepChampion(s, e, .01, h); assert.equal(e.phase, 2)
  stepChampion(s, e, B.roarSeconds, h); assert.equal(summons.length, 0)
  stepChampion(s, e, .01, h); assert.equal(e.phase, 3)
  stepChampion(s, e, B.roarSeconds, h); assert.equal(summons.length, 4)
  assert.deepEqual(cues, ['roar', 'roar'])
  e.hp = 0; e.champion!.mode = 'tell'; e.pattern = 'slam'; e.wind = 0; e.aimX = s.x; e.aimY = s.y
  stepChampion(s, e, 10, h); assert.deepEqual(damage, []); assert.equal(summons.length, 4)
})

test('53B entry and recovery suppress contact/new attacks; dash sweeps once and wall enters recovery', () => {
  const { s, e } = quiet(), { h, damage } = hooks()
  e.champion!.mode = 'enter'; e.champion!.t = B.entrySeconds; e.x = s.x; e.y = s.y
  stepChampion(s, e, .1, h); assert.equal(e.patternSeq, 0); assert.deepEqual(damage, [])
  e.champion!.mode = 'dash'; e.champion!.dx = 1; e.champion!.dy = 0; e.champion!.remaining = 400
  e.x = s.x - 40
  stepChampion(s, e, .3, h); assert.deepEqual(damage, [B.dashDamage])
  stepChampion(s, e, .3, h); assert.equal(damage.length, 1)
  e.x = C.width - 11; e.champion!.remaining = 400
  stepChampion(s, e, .1, h); assert.equal(e.recovery, B.recoverySeconds)
  const seq = e.patternSeq; stepChampion(s, e, .5, h); assert.equal(e.patternSeq, seq); assert.equal(damage.length, 1)
})

test('53B dash telegraph ends at the same wall as actual movement', () => {
  const { s, e } = quiet(), { h } = hooks(); e.x = C.width - 60; e.y = s.y; s.x = C.width - 32
  stepChampion(s, e, .01, h); assert.equal(e.aimX, C.width - 10)
  const end = { x: e.aimX, y: e.aimY }; stepChampion(s, e, B.dashWind, h); stepChampion(s, e, 1, h)
  assert.deepEqual({ x: e.x, y: e.y }, end); assert.equal(e.recovery, B.recoverySeconds)
})

test('53B fixed slam target lets a .5sec delayed walk escape; standing still is hit', () => {
  for (const moving of [false, true]) {
    const { s, e } = quiet(), { h, damage } = hooks()
    e.champion!.cycle = 1; stepChampion(s, e, .01, h)
    const target = { x: e.aimX, y: e.aimY }
    for (let n = 0; n < 136; n++) { if (moving && n >= 50) s.y += C.speed * .01; stepChampion(s, e, .01, h) }
    assert.deepEqual({ x: e.aimX, y: e.aimY }, target)
    assert.equal(damage.length, moving ? 0 : 1)
  }
})

test('53B guard uses the actual hit origin; fan rays stay fixed at windup', () => {
  const { s, e } = quiet('palisade'), { h, fans } = hooks()
  stepChampion(s, e, .01, h); assert.equal(e.pattern, 'guard')
  assert.equal(championDamageScale(e, { x: e.x + 10, y: e.y }), B.guardFront)
  assert.equal(championDamageScale(e, { x: e.x - 10, y: e.y }), B.guardRear)
  assert.equal(championDamageScale(e, null), 1)
  e.pattern = 'fan'; e.champion!.mode = 'tell'; e.wind = .1
  const angles = championFanAngles(e); s.y += 150
  stepChampion(s, e, .11, h); assert.deepEqual(fans, angles); assert.equal(fans.length, 5)
})

test('53B two recovery hits both gain damage but only the first tags the large reaction', () => {
  const { s, e } = quiet(); e.recovery = 1; e.hp = e.max = 1000; s.cool.axe = 0
  const before = e.hp; tick(s); const first = before - e.hp
  s.cool.axe = 0; const mid = e.hp; tick(s); const second = mid - e.hp
  assert.ok(first > 0); assert.equal(first, second)
  assert.equal(s.fx.filter(f => f.recoveryHit).length, 1)
  const { s: normal, e: n } = quiet(); n.hp = n.max = 1000; normal.cool.axe = 0; const hp = n.hp; tick(normal)
  assert.ok(Math.abs(first / (hp - n.hp) - B.recoveryDamage) < 1e-9)
  assert.equal(s.fx.find(f => f.recoveryHit)?.crit, false)
})

test('53B real summon can overlap the player without immediate contact; phase3 dogs remain four', () => {
  const { s, e } = quiet(); e.pattern = 'summon'; e.champion!.mode = 'tell'; e.wind = .001
  e.x = s.x - B.summonRadius; e.y = s.y
  tick(s); const child = s.enemies.find(m => m !== e && Math.hypot(m.x - s.x, m.y - s.y) < 1)!
  assert.ok(child); const hp = s.hp; tick(s, .5); assert.equal(s.hp, hp)
  s.enemies = [child]; tick(s, 1.6); assert.ok(s.hp < hp, 'same overlapping child is capable of later contact')
  const { s: ford, e: boss } = quiet('ford', 'boss'); boss.phase = 3; boss.champion!.mode = 'roar'; boss.champion!.t = .001
  tick(ford); assert.equal(ford.enemies.filter(m => m.kind === 'dog').length, 4)
})

test('53B elite death drops fast/slow chest and gold is paid once only on pickup', () => {
  for (const age of [19.98, 20.01]) {
    const { s, e } = quiet(); s.t = age; e.bornAt = 0; e.hp = .01; s.cool.axe = 0
    const before = runGold(s); tick(s); assert.equal(s.elites, 1); assert.equal(s.chests!.length, 1)
    const c = s.chests![0]!; assert.equal(c.large, age < 20)
    assert.equal(s.chestGold, 0); assert.ok(runGold(s) - before < 12)
    s.x = c.x; s.y = c.y; tick(s); assert.equal(s.chestGold, c.gold); assert.equal(s.chestsClaimed, 1)
    const gold = s.chestGold; while (s.offers.length) assert.equal(choose(s, s.offers[0]!, s.offerNonce), true)
    tick(s); assert.equal(s.chestGold, gold); assert.equal(s.chestsClaimed, 1)
  }
})

test('53B free chest choices work at max level without XP/reroll cost and reject stale clicks', () => {
  const s = chest(); s.xp = 123; const before = { xp: s.xp, level: s.level, rerolls: s.rerolls }; tick(s)
  assert.equal(s.choiceOrigin, 'chest'); assert.equal(s.chestChoice?.left, 2); assert.equal(reroll(s), false)
  const key = s.offers[0]!, nonce = s.offerNonce!; assert.equal(choose(s, key, nonce), true)
  assert.equal(s.chestChoice?.left, 1); assert.equal(choose(s, s.offers[0]!, nonce), false)
  assert.equal(choose(s, s.offers[0]!, s.offerNonce), true); assert.equal(s.chests![0]!.state, 'claimed')
  assert.deepEqual({ xp: s.xp, level: s.level, rerolls: s.rerolls }, before); assert.equal(s.offers.length, 0)
})

test('53B all-max chest is gold only; current level choice precedes opened chest and saved XP', () => {
  const s = chest(); for (const p of kitPowers(s.kit)) s.ranks[p] = POWERS[p].max
  for (const c of kitCombos(s.kit)) { s.combos.push(c.id); s.comboRanks[c.id] = T.max }
  tick(s); assert.equal(s.offers.length, 0); assert.equal(s.chests![0]!.state, 'claimed'); assert.equal(s.chestGold, 12)
  const q = chest(false); q.level = 1; q.xp = xpNeeded(q) * 3; tick(q)
  // A real ground pickup takes priority over a not-yet-open XP menu.
  assert.equal(q.choiceOrigin, 'chest'); assert.equal(choose(q, q.offers[0]!, q.offerNonce), true); assert.equal(q.choiceOrigin, 'level')
  const extra = { ...q.chests![0]!, id: 2, state: 'opened' as const, choicesRemaining: 1 }; q.chests!.push(extra)
  const oldLevel = q.level; assert.equal(choose(q, q.offers[0]!, q.offerNonce), true)
  assert.equal(q.level, oldLevel + 1); assert.equal(q.choiceOrigin, 'chest'); assert.equal(q.chestChoice?.id, 2)
})

test('53B malformed/tiny viewport falls back to world while real zoom bounds spawn on its edges', () => {
  const world = spawnView(); assert.deepEqual(spawnView({ left: 5, top: 5, right: 6, bottom: 6 }), world)
  assert.deepEqual(spawnView({ left: NaN, top: 0, right: 1000, bottom: 700 }), world)
  const view = { left: 200, top: 100, right: 840, bottom: 516 }, { s } = quiet(); s.enemies = []
  for (let i = 0; i < 12; i++) spawnMob(s, 'elite', view)
  assert.ok(s.enemies.every(e => e.x === view.left + 15 || e.x === view.right - 15 || e.y === view.top + 24 || e.y === view.bottom - 15))
})

test('53B guard blocks a real projectile coming from the front even after the hero moved behind', () => {
  for (const front of [true, false]) {
    const { s, e } = quiet('palisade'); e.champion!.mode = 'guard'; e.champion!.t = 1; e.champion!.dx = 1; e.champion!.dy = 0
    e.hp = e.max = 1000; s.x = e.x - 200
    const direction = front ? -1 : 1
    s.shots.push({ kind: 'arrow', x: e.x - direction * 12, y: e.y, vx: direction * 1000, vy: 0, life: 2, damage: 100, radius: 10, hit: [], angle: 0, tx: 0, ty: 0 })
    tick(s); assert.ok(Math.abs(1000 - e.hp - 100 * (front ? B.guardFront : B.guardRear)) < 1e-9)
  }
})

test('53B lethal same-tick boss and hero damage resolves once as victory with no pending chest', () => {
  const { s, e } = quiet('forest', 'boss'); e.hp = .01; s.cool.axe = 0; s.hp = .01
  s.chests!.push({ id: 9, eliteId: 9, x: s.x, y: s.y, bornAt: 0, state: 'ground', choicesRemaining: 2, gold: 12, large: true })
  s.shots.push({ kind: 'enemy', x: s.x, y: s.y, vx: 0, vy: 0, life: 1, damage: 100, radius: 20, hit: [], angle: 0, tx: 0, ty: 0 })
  tick(s); assert.equal(s.state, 'won'); assert.equal(s.hp, 0); assert.equal(s.offers.length, 0)
  assert.equal(s.chests![0]!.state, 'expired'); assert.equal(s.chestGold, 0)
})

test('53B second large-chest choice rebuilds the legal combo pool after the first rank', () => {
  const s = chest(); for (const p of kitPowers(s.kit)) s.ranks[p] = POWERS[p].max
  s.ranks.gale = 2; s.combos.push('inferno'); s.comboRanks.inferno = T.max
  tick(s); assert.ok(s.offers.includes('gale'))
  assert.equal(choose(s, 'gale', s.offerNonce), true)
  assert.ok(s.offers.includes('cyclone'), 'newly met actual combo is immediately offered')
})

test('53B R1 keeps the first two elite HP scales and boss HP, increasing only later elite growth', () => {
  const endFactors = { forest: 2.4, ford: 2.4, palisade: 1, snow: 1.8, fortress: 1 }
  for (const stage of stages) {
    const key = stage as keyof typeof endFactors, { s, e } = quiet(stage)
    const scaled = (at: number, kind: 'elite' | 'boss') => {
      s.t = at; e.kind = kind; e.hp = e.max = 1000; initChampion(s, e); return e.max
    }
    const first = scaled(150, 'elite')
    assert.equal(scaled(300.0000000001, 'elite'), first, `${stage}: second natural spawn stays exact despite clock rounding`)
    const final = scaled(600, 'elite')
    assert.ok(Math.abs(final / first - endFactors[key]) < 1e-9, `${stage}: bounded late factor`)
    assert.equal(scaled(C.bossAt * 2, 'elite'), final, `${stage}: growth is capped`)
    const middle = scaled(450, 'elite'); assert.ok(middle >= first && middle <= final)
    assert.equal(scaled(0, 'boss'), scaled(C.bossAt, 'boss'), `${stage}: boss HP is unchanged`)
  }
})
