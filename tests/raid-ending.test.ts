import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RaidEnding } from '../src/raid/ending.ts'
import { koDuration } from '../src/raid/ko.ts'
import { createHaebi } from '../src/raid/haebi.ts'

test('victory waits 3.8 visible seconds; one stamp and no sim mutation', () => {
  const s = createHaebi(49, 'stage', 'bow'), end = new RaidEnding()
  end.observe(s); assert.equal(end.active, false)
  s.state = 'won'; end.observe(s); const snapshot = JSON.stringify(s)
  assert.deepEqual(end.events(), { start: true, stamp: false })
  end.advance(10, false); assert.equal(end.elapsed, 0)
  end.advance(.4, true); assert.equal(end.effectTime, 0)
  end.advance(1.7, true); assert.equal(end.events().stamp, true); assert.equal(end.events().stamp, false)
  assert.equal(end.ready, false); end.advance(1.7, true); assert.equal(end.ready, true)
  assert.equal(JSON.stringify(s), snapshot)
})
test('defeat is the KO sequence (3.85s) and retreat 2s without stamp; skip and new run reset', () => {
  const s = createHaebi(49, 'stage', 'bow'), end = new RaidEnding()
  s.hp = 0; s.state = 'lost'; end.observe(s); assert.equal(end.kind, 'defeat'); assert.equal(end.duration, koDuration()); assert.ok(Math.abs(koDuration() - 3.85) < 1e-9)
  end.skip(); assert.equal(end.ready, true)
  const next = createHaebi(50, 'stage', 'bow'); end.observe(next); assert.equal(end.kind, null)
  next.state = 'lost'; end.observe(next); assert.equal(end.kind, 'retreat')
  end.advance(2, true); assert.equal(end.ready, true); assert.equal(end.events().stamp, false)
})


test('55 victory centers the final giant when a midboss death is still in the same frame', () => {
 const s=createHaebi(55,'stage','bow',{stage:'ford',simRules:'55-IMUGI'}),end=new RaidEnding()
 const boss={id:2,x:650,y:280,hp:0,max:100,kind:'boss' as const,bossRole:'giant' as const,cd:0,flash:0,wind:0,aimX:0,aimY:0,act:0,vx:0,vy:0,buff:0,poison:0,pdps:0,daze:0}
 s.giantFlow!.finalOwner=boss;s.giantFlow!.finalDefeated=true;s.state='won'
 s.fx.push({kind:'death',mob:'boss',x:101,y:220,x2:101,y2:220,r:1,angle:0,life:.5,total:.5,color:'#fff'},{kind:'death',mob:'boss',x:650,y:280,x2:650,y2:280,r:1,angle:0,life:.5,total:.5,color:'#fff'})
 const before=JSON.stringify(s);end.observe(s);assert.deepEqual(end.boss,{x:650,y:280});assert.equal(JSON.stringify(s),before)
})
