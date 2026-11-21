import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createHaebi, spawnMob, stepHaebi, awakenedLook, gaugeNeed, wakeReady, normalizedRaidOpts, choose, type HaebiRun, type Kit } from '../src/raid/haebi.ts'
import { HAEBI_AWAKEN as A, HAEBI_ULT as U } from '../src/tune/params.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, finishRecord, replayRaid } from '../src/raid/runlog.ts'

const idle = { x: 0, y: 0 }
function quiet(permanentAwake = true, kit: Kit = 'axe', appearanceAwake = true) {
  const s = createHaebi(56, 'stage', kit, { permanentAwake, appearanceAwake })
  s.spawn = s.nextElite = s.nextBarrage = 1e9; s.level = U.unlockLevel
  for (const key of Object.keys(s.cool) as (keyof typeof s.cool)[]) s.cool[key] = 1e9
  return s
}
function tick(s: HaebiRun, seconds: number) { for (let t = 0; t < seconds - 1e-8; t += .01) stepHaebi(s, idle, .01) }
function target(s: HaebiRun) { spawnMob(s, 'iron'); const e = s.enemies.at(-1)!; Object.assign(e, { x: s.x + 60, y: s.y, hp: 1e7, max: 1e7, daze: 1e9 }); return e }
function fire(s: HaebiRun) {
  s.skillCd = 0; const before = s.damage
  stepHaebi(s, { ...idle, skill: true }, .01)
  let n = 0; while ((s.cast || s.ult) && n++ < 500) stepHaebi(s, idle, .01)
  assert.ok(n < 500)
  return s.damage - before
}

test('56A permanent qualification and appearance are independent starting-state fields', () => {
  const on = createHaebi(56, 'stage', 'axe', { permanentAwake: true, appearanceAwake: true })
  const off = createHaebi(56, 'stage', 'axe', { permanentAwake: true, appearanceAwake: false })
  assert.equal(on.permanentAwake, true); assert.equal(off.permanentAwake, true)
  assert.equal(awakenedLook(on), true); assert.equal(awakenedLook(off), false)
  assert.equal(on.form, 'normal'); assert.equal(on.formT, 0)
})

test('56A an actual starting attack receives permanent power without using the gauge', () => {
  function damage(permanentAwake: boolean) {
    const s = createHaebi(56, 'stage', 'axe', { permanentAwake, appearanceAwake: false })
    s.spawn = s.nextElite = s.nextBarrage = 1e9
    spawnMob(s, 'club'); Object.assign(s.enemies[0]!, { x: s.x + 40, y: s.y, hp: 1e6, max: 1e6, daze: 100 })
    stepHaebi(s, { x: 0, y: 0 }, .01); assert.equal(s.wakes, 0)
    return s.damage
  }
  const base = damage(false), permanent = damage(true)
  assert.ok(base > 0)
  assert.ok(Math.abs(permanent / base - (A.permanent?.power ?? A.power)) < 1e-9, `${permanent}/${base}`)
})

test('56A qualified and unqualified stage characters both activate grit with one pending ult charge', () => {
  for (const permanentAwake of [false, true]) {
    const s = createHaebi(56, 'stage', 'axe', { permanentAwake, awaken: permanentAwake, appearanceAwake: true })
    s.spawn = s.nextElite = s.nextBarrage = 1e9; s.gauge = A.need
    stepHaebi(s, { x: 0, y: 0, wake: true }, .01)
    assert.equal(s.form, 'grit'); assert.equal(s.gritUltReady, true); assert.equal(s.cast, null)
    assert.equal(s.ward, s.maxHp * A.gritShield)
  }
})

test('56A qualification fallback, explicit false and default appearance normalize once', () => {
  const alias = createHaebi(56, 'stage', 'axe', { awaken: true })
  assert.equal(alias.permanentAwake, true); assert.equal(alias.appearanceAwake, true)
  const no = createHaebi(56, 'stage', 'axe', { awaken: true, permanentAwake: false })
  assert.equal(no.permanentAwake, false); assert.equal(no.canAwaken, false); assert.equal(awakenedLook(no), false)
  assert.deepEqual(normalizedRaidOpts(alias, {}), { simRules: '56A', permanentAwake: true, appearanceAwake: true })
})

test('56A actual damage, tempo, movement and cooldown rate are permanent before and after grit expires', () => {
  for (const afterGrit of [false, true]) {
    const normal = quiet(false), awake = quiet(true)
    if (afterGrit) for (const s of [normal, awake]) { s.gauge = gaugeNeed(s); stepHaebi(s, { ...idle, wake: true }, .01); tick(s, 10); assert.equal(s.form, 'normal') }
    for (const s of [normal, awake]) { target(s); s.cool.axe = 0; s.skillCd = 10 }
    const x0 = normal.x, x1 = awake.x
    stepHaebi(normal, { x: 1, y: 0 }, .01); stepHaebi(awake, { x: 1, y: 0 }, .01)
    assert.ok(Math.abs(awake.damage / normal.damage - A.permanent.power) < 1e-9)
    assert.ok(Math.abs(normal.cool.axe / awake.cool.axe - A.permanent.tempo) < 1e-9)
    assert.ok(Math.abs((awake.x - x1) / (normal.x - x0) - A.permanent.move) < 1e-9)
    assert.ok(Math.abs((10 - awake.skillCd) / (10 - normal.skillCd) - A.permanent.ultRate) < 1e-9)
    assert.equal(awake.permanentAwake, true)
  }
})

test('56A appearance affects no combat field or RNG during real movement and grit', () => {
  const on = quiet(true, 'axe', true), off = quiet(true, 'axe', false)
  for (const s of [on, off]) { target(s); s.cool.axe = 0; s.gauge = gaugeNeed(s) }
  for (let i = 0; i < 1000; i++) for (const s of [on, off]) stepHaebi(s, { x: Math.sin(i / 30), y: Math.cos(i / 30), wake: i === 10 }, .01)
  assert.deepEqual({ ...on, appearanceAwake: false }, off)
  assert.equal(on.form, 'normal'); assert.equal(awakenedLook(on), true); assert.equal(awakenedLook(off), false)
})

test('56A permanent qualification never grants timed-awake immunity', () => {
  const s = quiet(true)
  s.shots.push({ kind: 'enemy', x: s.x, y: s.y, vx: 0, vy: 0, life: 1, damage: 30, radius: 20, hit: [], angle: 0, tx: s.x, ty: s.y })
  stepHaebi(s, idle, .01)
  assert.ok(s.hp < s.maxHp); assert.equal(s.form, 'normal')
})

test('56A grit charge outlives its buff, rejects invalid consumption and strengthens exactly one actual manual ult', () => {
  const s = quiet(true); s.gauge = gaugeNeed(s); stepHaebi(s, { ...idle, wake: true }, .01); tick(s, 8)
  assert.equal(s.form, 'normal'); assert.equal(s.gritUltReady, true)
  s.counterDue = true; stepHaebi(s, idle, .01); assert.equal(s.gritUltReady, true)
  s.skillCd = 5; stepHaebi(s, { ...idle, skill: true }, .01); assert.equal(s.gritUltReady, true)
  s.level = 1; s.skillCd = 0; stepHaebi(s, { ...idle, skill: true }, .01); assert.equal(s.gritUltReady, true)
  s.level = U.unlockLevel; target(s)
  const first = fire(s); assert.equal(s.gritUltReady, false); assert.equal(s.ultEmpowered, true)
  assert.ok(s.fx.some(f => f.ult && f.awakened === true && f.empowered === true))
  const second = fire(s); assert.equal(s.ultEmpowered, false); assert.ok(second > 0)
  assert.ok(Math.abs(first / second - U.trueDamage) < 1e-9, `${first}/${second}`)
  const charge = quiet(false); charge.gauge = gaugeNeed(charge); stepHaebi(charge, { ...idle, wake: true }, .01)
  charge.gritUltReady = true; charge.hp = -10; stepHaebi(charge, idle, .01); assert.equal(charge.gritUltReady, false)
})

test('56A each continuous kit keeps accepted awakening and empowered flags through its last pulse', () => {
  for (const kit of ['spear', 'dagger', 'sling'] as const) {
    const charged = quiet(true, kit); charged.gauge = gaugeNeed(charged); stepHaebi(charged, { ...idle, wake: true }, .01); tick(charged, 8)
    target(charged); const plain = structuredClone(charged); plain.gritUltReady = false
    const enhanced = fire(charged), base = fire(plain)
    assert.ok(base > 0, kit); assert.ok(Math.abs(enhanced / base - U.trueDamage) < 1e-9, `${kit}:${enhanced}/${base}`)
    assert.equal(charged.ultEmpowered, true); assert.equal(charged.ultAwakened, true)
  }
})

test('56A explicit vanguard supports the same qualification and grit; default legacy vanguard stays legacy', () => {
  const legacy = createHaebi(56, 'vanguard'); assert.equal(legacy.permanentAwake, undefined); assert.equal(awakenedLook(legacy), true)
  const s = createHaebi(56, 'vanguard', 'axe', { simRules: '56A', permanentAwake: false })
  assert.equal(awakenedLook(s), false); s.gauge = gaugeNeed(s); assert.equal(wakeReady(s), true)
  stepHaebi(s, { ...idle, wake: true }, .01); assert.equal(s.form, 'grit'); assert.equal(s.gritUltReady, true)
})

test('56A records normalized qualification/preferences and replays without reading present storage', () => {
  const opts = { awaken: true, appearanceAwake: false, bonus: { might: 1 } }, s = createHaebi(17, 'stage', 'axe', opts)
  const r = startRecord(s, { id: '56A', started: 'x', mode: 'stage', stage: 'forest', hero: 'h', kit: 'axe', sprite: 'haebi', seed: 17, opts, from: null })
  opts.bonus.might = 999
  while (s.t < 90 && s.state === 'playing') {
    if (s.offers.length) { const key = botChoice(s, 'storm'); assert.equal(choose(s, key), true); recPick(r, key) }
    else stepHaebi(s, recInput(r, botInput(s)), 1 / 120)
  }
  const g = finishRecord(r, 0, 'x'); assert.equal(g.rules, '56A'); assert.equal(g.opts.permanentAwake, true); assert.equal(g.opts.appearanceAwake, false); assert.equal(g.opts.bonus?.might, 1)
  assert.ok(s.wakes > 0); assert.deepEqual(replayRaid(JSON.parse(JSON.stringify(g))), s)
})

test('53B actual old timed-awake source hash and unversioned/53B replay are preserved', () => {
  // Produced from dbe8ad3 original haebi.ts in C, using the unchanged bot and input quantizer. One timed wake occurred.
  const s = createHaebi(17, 'stage', 'axe', { awaken: true, simRules: '53B' })
  const r = startRecord(s, { id: 'old53', started: 'x', mode: 'stage', stage: 'forest', hero: 'h', kit: 'axe', sprite: 'haebi', seed: 17, opts: { awaken: true }, from: null })
  while (s.t < 90 && s.state === 'playing') {
    if (s.offers.length) { const key = botChoice(s, 'storm'); assert.equal(choose(s, key), true); recPick(r, key) }
    else stepHaebi(s, recInput(r, botInput(s)), 1 / 120)
  }
  assert.equal(s.wakes, 1); assert.equal(s.permanentAwake, undefined)
  assert.equal(createHash('sha256').update(JSON.stringify(s)).digest('hex'), 'e3f05a2a4247bb7ce1fc96b103ac3518b76eeeb7e59efda28d906aec39d4355f')
  const g = finishRecord(r, 0, 'x'); assert.equal(g.rules, '53B'); assert.deepEqual(replayRaid(g), s)
  delete (g as { rules?: string }).rules; assert.deepEqual(replayRaid(g), s)
})
