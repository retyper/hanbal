import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_RUN as C } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, reroll, xpNeeded, spawnMob, POWERS, type HaebiRun, type Power } from '../src/raid/haebi.ts'
import { replay } from '../src/raid/haebi-replay.ts'
import { heroFrame } from '../src/raid/haebi-view.ts'
const idle = { x: 0, y: 0 }
function reward(s: HaebiRun) { s.xp = xpNeeded(s); stepHaebi(s, idle, 1 / 120) }
test('same seed and inputs reproduce the run; choices freeze all combat and apply once', () => {
  const a = createHaebi(23), b = createHaebi(23)
  for (let i = 0; i < 2400; i++) { const input = { x: Math.sin(i / 60), y: Math.cos(i / 60), skill: i % 100 === 0 }; stepHaebi(a, input, 1 / 120); stepHaebi(b, input, 1 / 120) }
  assert.deepEqual(a, b); reward(a); const snapshot = structuredClone(a); stepHaebi(a, { x: 1, y: 1, skill: true }, .05); assert.deepEqual(a, snapshot)
  const pick = a.offers[0]!; assert.ok(choose(a, pick)); const rank = a.ranks[pick]; assert.equal(choose(a, pick), false); assert.equal(a.ranks[pick], rank)
})
test('three attack slots force a route; maxed powers disappear and rerolls are limited', () => {
  const s = createHaebi(); s.ranks.gale = 1; s.ranks.ember = 1; s.ranks.axe = POWERS.axe.max; s.level = 5
  reward(s)
  for (let i = 0; i < 4; i++) { assert.ok(!s.offers.includes('thunder')); assert.ok(!s.offers.includes('axe')); assert.equal(new Set(s.offers).size, s.offers.length); assert.equal(reroll(s), i < 3) }
  assert.equal(s.rerolls, 0)
})
test('combination unlocks exactly once at the recipe threshold', () => {
  const s = createHaebi(); s.level = 6; s.ranks.axe = 3; s.ranks.gale = 3; s.offers = ['axe']; s.xp = xpNeeded(s)
  choose(s, 'axe'); assert.deepEqual(s.combos, ['cyclone']); assert.match(s.message, /도끼 폭풍/)
  s.xp = xpNeeded(s); s.offers = ['axe']; choose(s, 'axe'); assert.deepEqual(s.combos, ['cyclone'])
})
test('projectile split and lightning explosion are real damage mechanics, not visual-only', () => {
  const s = createHaebi(); s.spawn = 99; s.ranks.gale = 3; s.ranks.echo = 2; s.combos = ['torrent']; s.cool.axe = 99
  spawnMob(s); const e = s.enemies[0]!; e.x = s.x + 45; e.y = s.y; e.hp = e.max = 10000
  for (let i = 0; i < 60; i++) stepHaebi(s, idle, 1 / 120)
  assert.ok(s.shots.some(b => b.kind === 'shard')); assert.ok(e.hp < e.max)
  const plain = createHaebi(); plain.spawn = 99; plain.ranks.thunder = 3; plain.cool.axe = 99
  for (let i = 0; i < 2; i++) { spawnMob(plain); Object.assign(plain.enemies[i]!, { x: plain.x + 40 + i * 10, y: plain.y, hp: 10000, max: 10000 }) }
  const evolved = structuredClone(plain); evolved.combos = ['inferno']
  stepHaebi(plain, idle, .01); stepHaebi(evolved, idle, .01); assert.ok(evolved.damage > plain.damage)
})
test('dodge avoids boss telegraph; terminal states never advance; portrait uses authored frames', () => {
  const s = createHaebi(); s.spawn = 99; spawnMob(s, 'boss'); Object.assign(s.enemies[0]!, { x: s.x, y: s.y, wind: .01, aimX: s.x, aimY: s.y })
  stepHaebi(s, { ...idle, dash: true }, .02); assert.equal(s.hp, C.health); assert.ok(s.dashCd > 0)
  s.hurt = .2; assert.equal(heroFrame(s, true), 18); s.hurt = 0; s.attack = .15; assert.ok(heroFrame(s, true) >= 12)
  s.state = 'won'; const saved = structuredClone(s); stepHaebi(s, idle, .05); assert.deepEqual(s, saved)
  const timeout = createHaebi(); timeout.t = C.duration; stepHaebi(timeout, idle, .01); assert.equal(timeout.state, 'lost')
})
test('real ten-minute route grows into crowd clearing with bounded live objects', () => {
  const minutes: number[] = []; let kills = 0
  const s = replay(7, C.duration, 'storm', r => { minutes.push(r.kills - kills); kills = r.kills; assert.ok(r.enemies.length <= C.maxEnemies + 2); assert.ok(r.shots.length <= C.maxShots); assert.ok(r.fx.length <= C.maxFx); assert.ok(r.drops.length <= C.maxDrops) })
  assert.equal(s.state, 'won'); assert.ok(s.t >= C.bossAt); assert.ok(s.combos.includes('cyclone')); assert.ok(s.kills > 4000)
  assert.ok(minutes[8]! > minutes[0]! * 5); assert.ok(s.level <= C.maxLevel)
  assert.equal((['axe','gale','ember','thunder'] as Power[]).filter(k => s.ranks[k]).length, C.attackSlots)
})
