// Unit fixtures only. No live UI/full-run claim; RNG is never replaced or advanced outside stepHaebi.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHaebi, stepHaebi, choose, KITS, type HaebiRun, type Mob, type MobKind, type Kit, type Effect, type HaebiOpts } from '../src/raid/haebi.ts'
import { HAEBI_SHOP, HAEBI_IMPACT } from '../src/tune/params.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
import { STEP, startRecord, recInput, recPick, sealInput, replayRaid } from '../src/raid/runlog.ts'
import { tagPrimaryShot, primaryShotDirection, tagCriticalFinish, criticalFinishEvent, criticalFinishPoses, criticalFinishFrames, criticalFinishHandled, drawCriticalFinishFrames } from '../src/raid/critical-finish.ts'

const kits: Kit[] = ['axe', 'bow', 'spear', 'sword', 'dagger', 'magic', 'sling']
const input = { x: 0, y: 0 }, tuning = HAEBI_IMPACT.criticalFinish
function fixture(seed: number, kit: Kit, hp = 1, luck: number = HAEBI_SHOP.luck.max, kind: MobKind = 'club') {
  const s = createHaebi(seed, 'stage', kit, { stage: 'forest', simRules: '56B', bonus: { luck } })
  // Isolated initial fixture. The engine still resolves every attack, crit, death, and drop normally.
  s.spawn = s.nextElite = s.nextBarrage = 100000
  for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) s.cool[k] = 99
  const e: Mob = { id: s.next++, x: s.x + 45, y: s.y, hp, max: hp, kind, cd: 99, flash: 0, wind: 0, aimX: 0, aimY: 0, act: 0, vx: 0, vy: 0, buff: 0, poison: 0, pdps: 0, daze: 99 }
  s.enemies.push(e); return { s, e }
}
function sample(s: HaebiRun, match: (f: Effect) => boolean, skill = false) {
  for (let i = 0; i < 600 && s.state === 'playing' && !s.offers.length; i++) {
    stepHaebi(s, { ...input, skill: skill && i === 0 }, STEP)
    const f = s.fx.find(match); if (f) return f
  }
  return undefined
}
function findCritical(setup: (seed: number) => { s: HaebiRun; skill?: boolean }, kind: Effect['kind'] = 'death') {
  for (let seed = 1; seed <= 64; seed++) {
    const { s, skill } = setup(seed), f = sample(s, f => f.kind === kind && f.crit === true, skill)
    if (f) return { s, f, seed }
  }
  assert.fail('No actual critical event within seeds1..64 and600 ordinary steps per seed')
}
const enablePrimary = (s: HaebiRun) => { s.cool[KITS[s.kit].primary as keyof HaebiRun['cool']] = 0 }
function deathFx(extra: Partial<Effect> = {}): Effect { return { kind: 'death', x: 100, y: 80, x2: 100, y2: 80, r: 25, angle: 0, life: .45, total: .45, color: '#d4af76', mob: 'club', face: -1, n: 100, crit: true, ...extra } }

test('60 actual seven-kit primary critical finishing blows tag only ordinary lethal crits', t => {
  const evidence: object[] = []
  for (const kit of kits) {
    const { s, f, seed } = findCritical(seed => { const { s } = fixture(seed, kit); enablePrimary(s); return { s } })
    assert.equal(criticalFinishEvent(f)?.origin, 'primary', kit); assert.equal(f.crit, true); assert.equal(s.kills, 1)
    evidence.push({ kit, seed, t: s.t, damage: f.n, direction: criticalFinishEvent(f)?.direction })
    const normal = fixture(seed, kit, 1, 0).s; enablePrimary(normal)
    const normalDeath = sample(normal, f => f.kind === 'death'); assert(normalDeath, kit + ' normal death'); assert.equal(normalDeath.crit, false); assert.equal(criticalFinishEvent(normalDeath), undefined)
    const nonlethal = findCritical(seed => { const { s } = fixture(seed, kit, 1000000); enablePrimary(s); return { s } }, 'hit')
    assert.equal(nonlethal.s.kills, 0); assert.equal(criticalFinishEvent(nonlethal.f), undefined, kit + ' nonlethal crit')
  }
  for (const kind of ['boss', 'elite'] as const) {
    const { f } = findCritical(seed => { const { s } = fixture(seed, 'axe', 1, HAEBI_SHOP.luck.max, kind); enablePrimary(s); return { s } })
    assert.equal(criticalFinishEvent(f), undefined, kind + ' never flies')
  }
  t.diagnostic(JSON.stringify(evidence))
})

test('60 actual ultimate, secondary, same-kind volley arrow and lethal DOT never inherit primary provenance', t => {
  const paths: [string, (seed: number) => { s: HaebiRun; skill?: boolean }][] = [
    ['ultimate', seed => { const { s } = fixture(seed, 'axe'); s.level = 2; return { s, skill: true } }],
    ['secondary', seed => { const { s } = fixture(seed, 'axe'); s.ranks.gale = 1; s.cool.gale = 0; return { s } }],
    ['volley-arrow', seed => { const { s } = fixture(seed, 'bow'); s.combos = ['volley']; s.cool.volley = 0; return { s } }],
    ['lethal-DOT', seed => { const { s, e } = fixture(seed, 'dagger'); e.poison = 1; e.pdps = 10000; return { s } }],
  ]
  for (const [name, setup] of paths) {
    const { s, f, seed } = findCritical(setup)
    assert.equal(f.crit, true, name + ' genuinely produced a crit death'); assert.equal(s.kills, 1); assert.equal(criticalFinishEvent(f), undefined, name)
    t.diagnostic(JSON.stringify({ path: name, seed, t: s.t, crit: f.crit, tagged: false }))
  }
})

test('60 private tags/getters do not alter enumerable object/state/opts/record data or share projectile kind', () => {
  const { s } = fixture(7, 'bow', 1000000); enablePrimary(s); stepHaebi(s, input, STEP)
  const shot = s.shots.find(b => b.kind === 'arrow'); assert(shot); assert.notEqual(primaryShotDirection(shot), undefined)
  const other = structuredClone(shot); assert.equal(primaryShotDirection(other), undefined)
  const opts: HaebiOpts = { stage: 'forest', simRules: '56B', bonus: { luck: HAEBI_SHOP.luck.max } }
  const record = startRecord(s, { id: 'cosmetic-only', started: '2026-11-21T00:00:00Z', mode: s.mode, stage: s.stage, hero: 'haebi', kit: s.kit, sprite: 'haebi', seed: 7, opts, from: null })
  const f = Object.freeze(deathFx()), before = JSON.stringify({ s, opts, game: record.g, shot, other, f }), keys = [s, opts, record.g, shot, other, f].map(x => Reflect.ownKeys(x))
  tagPrimaryShot(shot); tagCriticalFinish(f, -1); criticalFinishEvent(f); primaryShotDirection(shot)
  assert.equal(JSON.stringify({ s, opts, game: record.g, shot, other, f }), before)
  assert.deepEqual([s, opts, record.g, shot, other, f].map(x => Reflect.ownKeys(x)), keys)
  assert.equal(criticalFinishEvent(f)?.direction, -1); assert.equal(primaryShotDirection(other), undefined)
  assert.equal(criticalFinishEvent(structuredClone(f)), undefined, 'intermediate clone cosmetic metadata is deliberately not serialized')
  for (const extra of [{ crit: false }, { mob: 'elite' as const }, { mob: 'boss' as const }, { kind: 'hit' as const }]) { const excluded = deathFx(extra); tagCriticalFinish(excluded, 1); assert.equal(criticalFinishEvent(excluded), undefined) }
  const invalid = deathFx(); tagCriticalFinish(invalid, NaN); assert.equal(criticalFinishEvent(invalid), undefined)
})

test('60 pure view contracts: brief mirrored motion, low budget, pause, terminal corpse suppression, callback restoration', () => {
  const f = deathFx(); tagCriticalFinish(f, 1); const event = criticalFinishEvent(f); assert(event)
  const at = (age: number) => { const pose = criticalFinishPoses(event, age, tuning).at(-1); assert(pose); return pose }
  // 11-23 세 박자: hold 동안 제자리에서 부풂(「둑」) → 빨리 떠서 느려짐(「팡」) · 작아짐 → 끝에 별(「~~」)
  assert.equal(at(0).x, 100); assert.equal(at(tuning.hold * .5).x, 100); assert(at(tuning.hold * .5).scale > 1)
  assert(at(.25).x - at(.15).x > at(.45).x - at(.35).x, 'launch decelerates'); assert(at(.45).scale < at(.15).scale)
  assert.equal(at(.2).star, 0); assert((at(tuning.life - .05).star ?? 0) > 0)
  assert.equal(criticalFinishPoses(event, tuning.life, tuning).length, 0)
  assert.equal(criticalFinishPoses(event, .3, tuning, true).length, 1); assert.equal(criticalFinishPoses(event, .3, tuning).length, 3)
  const left = criticalFinishPoses({ ...event, direction: -1 }, .3, tuning).at(-1); assert(left); assert.equal(left.x - event.x, -(at(.3).x - event.x))
  const run = Object.freeze({ seed: 60 }), fx = Array.from({ length: 6 }, () => deathFx()); fx.forEach(f => tagCriticalFinish(f, 1)); const raw = JSON.stringify({ run, fx })
  assert.equal(criticalFinishFrames(run, fx, 5, true, false, tuning).length, tuning.maxBodies)
  const frames = criticalFinishFrames(run, fx, 5.2, true, false, tuning); assert.deepEqual(criticalFinishFrames(run, fx, 5.2, true, false, tuning), frames)
  const stack: number[] = [], calls: string[] = [], brush = { globalAlpha: .8, save() { stack.push(this.globalAlpha) }, restore() { this.globalAlpha = stack.pop()! }, translate() {}, rotate() {}, scale() {} }
  drawCriticalFinishFrames(brush as unknown as CanvasRenderingContext2D, frames, (mob, face) => calls.push(mob + '/' + face))
  assert.equal(calls.length, tuning.maxBodies * 3); assert.equal(stack.length, 0); assert.equal(brush.globalAlpha, .8)
  assert.equal(criticalFinishFrames(run, [], 5 + tuning.life, true, false, tuning).length, 0); assert.equal(criticalFinishHandled(run, fx[0]!), true); assert.equal(criticalFinishHandled(run, fx[5]!), false)
  assert.equal(criticalFinishFrames(run, fx, 0, false, false, tuning).length, 0); assert.equal(criticalFinishHandled(run, fx[0]!), true)
  assert.equal(criticalFinishFrames(run, fx, .03, false, false, tuning).length, 0); assert.equal(criticalFinishHandled(run, fx[0]!), true)
  assert.equal(criticalFinishFrames(run, fx, 5.06 + tuning.life, true, false, tuning).length, 0, 'seen survives terminal clock reset')
  assert.equal(criticalFinishFrames(run, fx, 1, true, false, tuning).length, tuning.maxBodies, 'backwards playing-time seek still resets')
  const low = {}; assert.equal(criticalFinishHandled(low, fx[0]!), false); const lowFrames = criticalFinishFrames(low, fx, 0, true, true, tuning); assert.equal(lowFrames.length, tuning.lowMaxBodies); assert(lowFrames.every(f => f.poses.length === 1))
  assert.equal(JSON.stringify({ run, fx }), raw)
})

test('60 canonical seed and recorded ordinary bot inputs rebuild primary critical finish tags on replay within60simsec', t => {
  // This lane has no enemy/rank/HP/time fixture. Only canonical creation and real choose/step/record APIs.
  const opts: HaebiOpts = { stage: 'forest', simRules: '56B', bonus: { luck: HAEBI_SHOP.luck.max, vigor: 3, might: 2, armor: 1 } }
  const seed = 257, s = createHaebi(seed, 'stage', 'sword', opts), recorder = startRecord(s, { id: 'critical-finish-replay', started: '2026-11-21T00:00:00Z', mode: 'stage', stage: 'forest', hero: 'haebi', kit: 'sword', sprite: 'haebi', seed, opts, from: null })
  let operations = 0
  while (s.state === 'playing' && s.t < 60 && operations++ < 30000 && !s.fx.some(f => criticalFinishEvent(f))) {
    if (s.offers.length) { const pick = botChoice(s, 'storm'); assert(choose(s, pick)); recPick(recorder, pick) }
    else stepHaebi(s, recInput(recorder, botInput(s, .5)), STEP)
  }
  const finishes = s.fx.filter(f => criticalFinishEvent(f)); assert(finishes.length > 0, 'real ordinary run reaches an eligible final blow within bounded loop')
  const game = sealInput(recorder), serialized = JSON.stringify(s), own = Reflect.ownKeys(s), back = replayRaid(JSON.parse(JSON.stringify(game)) as typeof game)
  assert.equal(JSON.stringify(back), serialized); assert.deepEqual(Reflect.ownKeys(back), own)
  assert.deepEqual(back.fx.map(f => criticalFinishEvent(f)), s.fx.map(f => criticalFinishEvent(f)), 'replayed actual primary paths recreate matching private events')
  assert(!Object.hasOwn(s, 'criticalFinish')); assert(!Object.hasOwn(game.opts, 'criticalFinish'))
  t.diagnostic(JSON.stringify({ seed, t: s.t, operations, recordedSteps: game.steps, picks: game.picks.length, eligibleDeaths: finishes.length, stateEqual: true, tagsRebuilt: true }))
})
