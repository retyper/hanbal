import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GiantHealthTrail } from '../src/raid/giant-hud.ts'
import { HAEBI_RUN as C } from '../src/tune/params.ts'
test('giant yellow damage trail freezes through paused or hidden updates and then resumes after active hold', () => {
 const m=new GiantHealthTrail(); assert.equal(m.update(1,1,0),1); assert.equal(m.update(1,.4,0),1)
 for(let i=0;i<200;i++) assert.equal(m.update(1,.4,0),1)
 assert.equal(m.update(1,.4,C.hpChunkHold),1)
 const resumed=m.update(1,.4,.1); assert.ok(resumed>.4&&resumed<1)
 assert.equal(m.update(1,.4,0),resumed)
})
test('a new giant, cleared run, healing and invalid values never inherit a previous boss yellow bar', () => {
 const m=new GiantHealthTrail(); m.update(1,1,0);m.update(1,.2,0)
 assert.equal(m.update(2,.6,0),.6);assert.equal(m.update(2,.9,0),.9)
 m.clear();assert.equal(m.update(2,.3,0),.3);assert.equal(m.update(3,NaN,Infinity),0)
})
