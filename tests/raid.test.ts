import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRaid,stepRaid,upgradeRaid,W,H,type Enemy } from '../src/raid/sim.ts'
const neutral={x:0,y:0,dash:false,skill:false}
const enemy=(x:number,y:number,kind:Enemy['kind']='club'):Enemy=>({id:1,x,y,hp:1,max:1,kind,cd:2,flash:0,wind:0,aimX:0,aimY:0})
test('fixed inputs and seed reproduce combat and movement stays inside the arena',()=>{
 const a=createRaid('mir',4),b=createRaid('mir',4)
 for(let i=0;i<300;i++){const input={x:1,y:-1,dash:i===0,skill:i===100};stepRaid(a,input,1/60);stepRaid(b,input,1/60)}
 assert.deepEqual(a,b);assert.ok(a.x<W&&a.y>0)
})
test('upgrade freezes combat until one upgrade is picked, then applies exactly once',()=>{
 const s=createRaid('haebi');s.upgrade=true;stepRaid(s,{...neutral,skill:true},.05);assert.equal(s.t,0)
 upgradeRaid(s,'power');assert.equal(s.power,1.28);assert.equal(s.level,2)
 upgradeRaid(s,'power');assert.equal(s.power,1.28)
})
test('boss death wins, timeout loses, and finished runs never advance',()=>{
 const s=createRaid('haebi');s.enemies=[enemy(s.x+40,s.y,'chief')];s.cool=0;stepRaid(s,neutral,.05);assert.equal(s.state,'won')
 const t=s.t;stepRaid(s,neutral,.05);assert.equal(s.t,t)
 const timeout=createRaid('mir');timeout.t=90;stepRaid(timeout,neutral,.05);assert.equal(timeout.state,'lost')
})
test('axe hits a cluster, spear keeps a narrow line, bow emits a projectile',()=>{
 for(const hero of ['haebi','soseono','mir'] as const){const s=createRaid(hero);s.spawn=99;s.cool=0;s.enemies=[enemy(s.x+45,s.y),{...enemy(s.x+55,s.y+50),id:2}];stepRaid(s,neutral,.01)
 if(hero==='haebi')assert.equal(s.kills,2)
 if(hero==='soseono')assert.equal(s.kills,1)
 if(hero==='mir'){assert.equal(s.kills,0);assert.equal(s.shots.length,1)}
 }
})
test('dodge protects from a telegraphed boss strike and has a cooldown',()=>{
 const s=createRaid('haebi');s.enemies=[{...enemy(s.x,s.y,'chief'),wind:.01,aimX:s.x,aimY:s.y,hp:600}]
 stepRaid(s,{...neutral,dash:true},.02);assert.equal(s.hp,100);assert.ok(s.dashCd>0)
 const first=s.dashCd;stepRaid(s,{...neutral,dash:true},.02);assert.ok(s.dashCd<first)
 assert.ok(s.x>0&&s.x<W&&s.y<H)
})
