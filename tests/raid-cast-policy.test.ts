import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createHaebi, spawnMob, stepHaebi, choose, castSlow, castWallSeconds, KITS, type HaebiRun, type HaebiOpts, type Kit } from '../src/raid/haebi.ts'
import { HAEBI_ULT as U, HAEBI_RUN as C } from '../src/tune/params.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, gridInput, recPick, finishRecord, replayRaid } from '../src/raid/runlog.ts'
const DT = 1 / 120, idle = { x: 0, y: 0 }
function quiet(awake = false, kit: Kit = 'axe', simRules: NonNullable<HaebiOpts['simRules']> = '56B', appearanceAwake = true) {
  const s = createHaebi(57, 'stage', kit, { simRules, permanentAwake: awake, appearanceAwake })
  s.spawn = s.nextElite = s.nextBarrage = 1e9; s.level = U.unlockLevel
  for (const key of Object.keys(s.cool) as (keyof typeof s.cool)[]) s.cool[key] = 1e9
  return s
}
function release(s: HaebiRun) { let n = 0; while (s.cast && n++ < 500) stepHaebi(s, idle, DT); assert.ok(n < 500); return n * DT }
function fire(s: HaebiRun, shortCutin = false) {
  s.skillCd = 0; const seen = new WeakSet(s.fx), cues: number[] = [], before = s.damage
  const observe = () => { for (const f of s.fx) if (!seen.has(f)) { seen.add(f); if (f.awakenedRelease) cues.push(f.castSeq!) } }
  stepHaebi(s, { ...idle, skill: true, shortCutin }, DT); observe()
  let n = 0; while ((s.cast || s.ult) && n++ < 1000) { stepHaebi(s, idle, DT); observe() }
  assert.ok(n < 1000)
  return { damage: s.damage - before, cues }
}

test('56B actual unawakened casts use0.4/0.5wall seconds', () => {
  for (const empowered of [false, true]) {
    const s = quiet(); s.gritUltReady = empowered; stepHaebi(s, { ...idle, skill: true }, DT)
    assert.equal(s.cast?.total, empowered ? .25 : .2)
    const wall = release(s); assert.ok(Math.abs(wall - (empowered ? .5 : .4)) <= DT + 1e-8)
  }
})

test('56B actual awakened cast first1.8seconds then0.9; short never quarters it', () => {
  const s = quiet(true)
  for (const shortCutin of [false, false, true]) {
    const first = s.awakenedCasts === 0; s.skillCd = 0
    stepHaebi(s, { ...idle, skill: true, shortCutin }, DT)
    assert.equal(s.cast?.slow, .1); assert.ok(Math.abs(s.cast!.total - (first ? .18 : .09)) < 1e-9)
    assert.ok(Math.abs(release(s) - (first ? 1.8 : .9)) <= DT + 1e-8)
  }
})

test('56B manual awakened release applies one real enemy daze and one explicit release cue', () => {
  const s = quiet(true); spawnMob(s, 'elite'); const e = s.enemies[0]!
  e.hp = e.max = 1e7
  stepHaebi(s, { ...idle, skill: true }, DT); release(s)
  assert.ok(e.daze > .29 && e.daze <= .3)
  assert.equal(s.fx.filter(f => f.awakenedRelease).length, 1)
})

test('56B short first is0.9seconds, rejects duplicate/CD/locked requests and helpers are read-only', () => {
  const s = quiet(true); s.level = 1
  stepHaebi(s, { ...idle, skill: true }, DT); assert.equal(s.awakenedCasts, 0); assert.equal(!!s.cast, false)
  s.level = U.unlockLevel; s.skillCd = 1
  stepHaebi(s, { ...idle, skill: true }, DT); assert.equal(s.awakenedCasts, 0)
  s.skillCd = 0; stepHaebi(s, { ...idle, skill: true, shortCutin: true }, DT)
  assert.equal(s.awakenedCasts, 1); assert.equal(s.cast?.seq, 1)
  const c = Object.freeze(structuredClone(s.cast!)), saved = JSON.stringify(c)
  assert.equal(castSlow(c), .1); assert.ok(Math.abs(castWallSeconds(c) - .9) < 1e-9); assert.equal(JSON.stringify(c), saved)
  stepHaebi(s, { ...idle, skill: true }, DT); assert.equal(s.awakenedCasts, 1); release(s)
  s.skillCd = 0; stepHaebi(s, { ...idle, skill: true, shortCutin: true }, DT)
  assert.equal(s.cast?.seq, 2); assert.ok(Math.abs(castWallSeconds(s.cast) - .9) < 1e-9)
})

test('56B actual0.3world-second enemy freeze expires; an existing longer daze is never shortened', () => {
  const s = quiet(true)
  for (let i = 0; i < 2; i++) { spawnMob(s, 'iron'); Object.assign(s.enemies[i]!, { x: s.x + 200, y: s.y + i * 20, hp: 1e7, max: 1e7, cd: 99, daze: i ? 1 : 0 }) }
  stepHaebi(s, { ...idle, skill: true }, DT); release(s)
  const e = s.enemies[0]!, longer = s.enemies[1]!, point = { x: e.x, y: e.y }
  assert.ok(longer.daze > .3)
  for (let n = 0; n < 34; n++) stepHaebi(s, idle, DT)
  assert.deepEqual({ x: e.x, y: e.y }, point)
  for (let n = 0; n < 6; n++) stepHaebi(s, idle, DT)
  assert.equal(e.daze, 0); assert.ok(e.x !== point.x || e.y !== point.y)
})

test('56B counter has no manual sequence/daze/cue and continuous pulses cannot stun newly born targets', () => {
  const counter = quiet(true); spawnMob(counter, 'iron'); const e = counter.enemies[0]!
  Object.assign(e, { x: counter.x + 60, y: counter.y, hp: 1e7, max: 1e7, cd: 99 })
  counter.counterDue = true; stepHaebi(counter, idle, DT)
  assert.equal(counter.awakenedCasts, 0); assert.equal(e.daze, 0)
  assert.ok(counter.fx.some(f => f.awakened)); assert.ok(!counter.fx.some(f => f.awakenedRelease))
  for (const kit of ['spear', 'dagger', 'sling'] as const) {
    const s = quiet(true, kit)
    for (let i = 0; i < 8; i++) { spawnMob(s, 'iron'); Object.assign(s.enemies[i]!, { x: s.x + 70 + i * 10, y: s.y, hp: 1e7, max: 1e7, cd: 99 }) }
    stepHaebi(s, { ...idle, skill: true }, DT); release(s)
    const seen = new WeakSet(s.fx); let cues = s.fx.filter(f => f.awakenedRelease).length
    spawnMob(s, 'iron'); const late = s.enemies.at(-1)!; Object.assign(late, { hp: 1e7, max: 1e7, cd: 99 })
    let n = 0; while (s.ult && n++ < 1000) { stepHaebi(s, idle, DT); for (const f of s.fx) if (!seen.has(f)) { seen.add(f); if (f.awakenedRelease) cues++ } }
    assert.equal(cues, 1, kit); assert.equal(late.daze, 0, kit); assert.equal(s.ultReleaseSeq, 0)
  }
})

test('56B all seven kits preserve56A actual hit vector, damage RNG and wall/lunge target geometry', () => {
  const positions = [[60, 0], [220, 0], [420, 0], [-80, 50], [0, 260], [0, -220], [-350, 100], [430, 250], [-400, -260]]
  for (const kit of Object.keys(KITS) as Kit[]) for (const empowered of [false, true]) {
    const make = (rules: '56A' | '56B') => {
      const s = quiet(true, kit, rules); s.gritUltReady = empowered; s.bonus.luck = 1
      for (const [dx, dy] of positions) { spawnMob(s, 'iron'); Object.assign(s.enemies.at(-1)!, { x: s.x + dx!, y: s.y + dy!, hp: 1e7, max: 1e7, cd: 99, daze: 1e9 }) }
      return s
    }
    const a = make('56A'), b = make('56B'), old = fire(a), next = fire(b)
    assert.ok(old.damage > 0, kit); assert.equal(next.damage, old.damage, `${kit}:${empowered}`)
    assert.deepEqual(b.enemies.map(e => e.hp), a.enemies.map(e => e.hp), `${kit}: exact hit targets`)
    assert.deepEqual([b.x, b.y, b.seed], [a.x, a.y, a.seed], `${kit}: lunge and damage RNG`)
    assert.deepEqual(old.cues, []); assert.deepEqual(next.cues, [1])
  }
  for (const rules of ['56A', '56B'] as const) {
    const s = quiet(true, 'sword', rules); s.x = C.width - 80
    spawnMob(s, 'iron'); Object.assign(s.enemies[0]!, { x: C.width - 20, y: s.y, hp: 1e7, max: 1e7, cd: 99, daze: 1e9 })
    fire(s); assert.equal(s.x, C.width - 32)
  }
})

test('56B records bit8short preference and reproduces the complete state without touching input', () => {
  const opts = { simRules: '56B' as const, permanentAwake: true, appearanceAwake: false }, s = createHaebi(17, 'stage', 'axe', opts)
  const r = startRecord(s, { id: 'new56B', started: 'x', mode: 'stage', stage: 'forest', hero: 'h', kit: 'axe', sprite: 'haebi', seed: 17, opts, from: null })
  const input = { ...idle, skill: true, shortCutin: true }, saved = structuredClone(input)
  assert.equal(gridInput(input).shortCutin, true); assert.deepEqual(input, saved)
  assert.ok(!Object.hasOwn(gridInput(idle), 'shortCutin'))
  while (s.t < 90 && s.state === 'playing') {
    if (s.offers.length) { const key = botChoice(s, 'storm'); assert.equal(choose(s, key), true); recPick(r, key) }
    else stepHaebi(s, recInput(r, { ...botInput(s), shortCutin: Math.floor(s.t / 5) % 2 === 1 }), DT)
  }
  const g = finishRecord(r, 0, 'x'); assert.equal(g.rules, '56B'); assert.ok(s.awakenedCasts! > 1)
  assert.deepEqual(replayRaid(JSON.parse(JSON.stringify(g))), s)
})

test('56A frozen13c1fa0 source record and state hash survive the new56B default', () => {
  const opts = { simRules: '56A' as const, permanentAwake: true, appearanceAwake: false, bonus: { might: 1 } }, s = createHaebi(17, 'stage', 'axe', opts)
  const r = startRecord(s, { id: 'frozen56A', started: 'x', mode: 'stage', stage: 'forest', hero: 'h', kit: 'axe', sprite: 'haebi', seed: 17, opts, from: null })
  while (s.t < 90 && s.state === 'playing') {
    if (s.offers.length) { const key = botChoice(s, 'storm'); choose(s, key); recPick(r, key) }
    else stepHaebi(s, recInput(r, botInput(s)), DT)
  }
  const g = finishRecord(r, 0, 'x')
  assert.equal(s.awakenedCasts, undefined); assert.equal(g.rules, '56A')
  assert.equal(createHash('sha256').update(JSON.stringify(s)).digest('hex'), '839b4a00dc9922ce209a3accd293a67a7feea4d62f9809adf63dd016c24e0966')
  assert.equal(createHash('sha256').update(JSON.stringify(g)).digest('hex'), '6d3c8cee346662e242470debceee0df95efb3f614de4a464fe62475fc1b0d16e')
  assert.deepEqual(replayRaid(g), s)
})
