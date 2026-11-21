import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RaidFeel } from '../src/raid/impact.ts'
import { createHaebi } from '../src/raid/haebi.ts'
import { runFrame } from '../src/raid/speed.ts'

test('ordinary hits do not freeze the crowd; critical hit freezes only wall time, never run state', () => {
  const s = createHaebi(49, 'stage', 'sword'), feel = new RaidFeel()
  feel.observe(s)
  const f = { x: 1, y: 1, x2: 0, y2: 0, r: 1, angle: 0, life: .2, total: .2, kind: 'hit' as const, color: '#fff', n: 1 }
  s.fx.push(f); feel.observe(s); assert.equal(feel.stopped, false)
  s.fx.push({ ...f, crit: true }); const before = JSON.stringify(s); feel.observe(s)
  assert.equal(feel.stopped, true); assert.equal(JSON.stringify(s), before)
  feel.advance(.02, false); assert.equal(feel.stopped, true)
  feel.advance(.041, true); assert.equal(feel.stopped, false)
  s.hurt += 1; s.hp -= 1; feel.observe(s); assert.equal(feel.stopped, false)
  feel.advance(.26, true); s.hurt += 1; s.hp -= 1; feel.observe(s); assert.equal(feel.stopped, true)
})

test('a new run resets wall-time impact state and old effects never replay', () => {
  const s = createHaebi(49, 'stage', 'sword'), feel = new RaidFeel()
  feel.observe(s); s.elites++; feel.observe(s); assert.equal(feel.stopped, true)
  feel.advance(.1, true); feel.observe(s); assert.equal(feel.stopped, false)
  feel.observe(createHaebi(50, 'stage', 'sword')); assert.equal(feel.stopped, false)
})

test('boss damage from a later beat of an active ultimate still requests 120ms', () => {
  const s = createHaebi(49, 'stage', 'sword'), feel = new RaidFeel()
  s.enemies.push({ id: 1, x: 50, y: 50, hp: 100, max: 100, kind: 'boss', cd: 0, flash: 0, wind: 0, aimX: 0, aimY: 0, act: 0, vx: 0, vy: 0, buff: 0, poison: 0, pdps: 0, daze: 0 })
  s.fx.push({ x: 1, y: 1, x2: 0, y2: 0, r: 1, angle: 0, life: 1, total: 1, kind: 'skill', ult: 'sword', color: '#fff' })
  feel.observe(s); s.enemies[0]!.hp--
  const before = JSON.stringify(s); feel.observe(s)
  assert.equal(feel.stopRemaining, .12); assert.equal(JSON.stringify(s), before)
})

test('elite death freezes 80ms and hidden/pause time cannot consume it', () => {
  const s = createHaebi(49, 'stage', 'sword'), feel = new RaidFeel()
  feel.observe(s); s.elites++; feel.observe(s)
  assert.equal(feel.stopRemaining, .08)
  feel.advance(10, false); assert.equal(feel.stopRemaining, .08)
  feel.advance(.079, true); assert.equal(feel.stopped, true)
  feel.advance(.002, true); assert.equal(feel.stopped, false)
})

test('an impact aborts accelerated multi-STEP work immediately and discards catch-up debt', () => {
  const s = createHaebi(49, 'stage', 'sword'), feel = new RaidFeel()
  feel.observe(s)
  let steps = 0
  const acc = runFrame(0, .1, () => 3, () => {
    steps++
    if (steps === 2) { s.elites++; feel.observe(s) }
    return !feel.stopped
  })
  assert.equal(steps, 2); assert.equal(acc, 0)
  const simTime = s.t; feel.advance(.08, true)
  assert.equal(s.t, simTime); assert.equal(feel.stopped, false)
})

test('56-B accepted manual awakening release requests heavy impact once; counters do not', () => {
 const s=createHaebi(56,'stage','sword'),feel=new RaidFeel()
 feel.observe(s)
 const f={x:1,y:1,x2:0,y2:0,r:1,angle:0,life:1,total:1,kind:'skill' as const,ult:'sword' as const,color:'#fff',awakened:true}
 s.fx.push({...f});feel.observe(s);assert.equal(feel.stopped,false)
 s.fx.push({...f,awakenedRelease:true,castSeq:1});const before=JSON.stringify(s);feel.observe(s)
 assert.equal(feel.stopRemaining,.12);assert.equal(JSON.stringify(s),before)
 feel.advance(10,false);assert.equal(feel.stopRemaining,.12)
 feel.advance(.3,true);feel.observe(s);assert.equal(feel.stopped,false)
})
