import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHaebi, type Effect} from '../src/raid/haebi.ts'
import {RaidFeel} from '../src/raid/impact.ts'
import {HAEBI_IMPACT as F} from '../src/tune/params.ts'
const fx = (): Effect => ({kind:'hit',x:100,y:100,x2:0,y2:0,r:20,angle:0,life:.2,total:.2,color:'#fff'})
test('53B elite entry and phase roar reuse bounded49 stop only once per new cue',()=>{
 const s=createHaebi(53), f=new RaidFeel(); f.observe(s)
 s.fx.push({...fx(),kind:'ring',championCue:'enter'}); f.observe(s)
 assert.ok(Math.abs(f.stopRemaining-F.eliteStop)<1e-9); assert.ok(f.shake>0)
 f.advance(.03,true); f.observe(s); assert.ok(Math.abs(f.stopRemaining-(F.eliteStop-.03))<1e-9)
 f.advance(F.cooldown,true); s.fx.push({...fx(),kind:'ring',championCue:'roar'}); f.observe(s)
 assert.ok(Math.abs(f.stopRemaining-F.eliteStop)<1e-9)
})
test('53B actual recovery hit receives heavy49 feedback without making plain attacks freeze',()=>{
 const s=createHaebi(53), f=new RaidFeel(); f.observe(s)
 s.fx.push(fx()); f.observe(s); assert.equal(f.stopRemaining,0)
 s.fx.push({...fx(),recoveryHit:true} as Effect); f.observe(s)
 assert.equal(f.stopRemaining,F.bossSkillStop); assert.ok(f.shake>0)
})
