import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHaebi,stepHaebi,runDuration,bossTime,normalizedRaidOpts,type HaebiOpts} from '../src/raid/haebi.ts'
const opts={stage:'ford',simRules:'55-IMUGI'} as HaebiOpts
function quiet(){const s=createHaebi(257,'stage','sword',opts);s.spawn=s.nextElite=s.nextBarrage=1e9;for(const k of Object.keys(s.cool)as(keyof typeof s.cool)[])s.cool[k]=1e9;return s}
test('55 only ford has explicit giant flow; unsupported stages retain their final boss rules',()=>{
 assert.ok('giantFlow'in quiet())
 assert.equal('giantFlow'in createHaebi(257,'stage','sword',{...opts,stage:'forest'}),false)
})
test('55 midboss at600 and giant at1140 are distinct Mob roles',()=>{
 const s=quiet();s.t=600-1/120;stepHaebi(s,{x:0,y:0},1/120)
 assert.ok(s.enemies.some(e=>'bossRole'in e&&e.bossRole==='midboss'))
 s.t=bossTime(s)-1/120;stepHaebi(s,{x:0,y:0},1/120)
 assert.equal(s.enemies.filter(e=>'giant'in e).length,1)
})
test('55 has explicit1380 initial budget; old B remains1230',()=>{
 assert.equal(runDuration(quiet()),1380)
 assert.equal(runDuration(createHaebi(257,'stage','sword',{stage:'ford',simRules:'56B'})),1230)
})

test('55 unsupported stages normalize to B and preserve their old final victory',()=>{
 const s=createHaebi(257,'stage','sword',{stage:'forest',simRules:'55-IMUGI'})
 assert.equal(normalizedRaidOpts(s,{simRules:'55-IMUGI'}).simRules,'56B')
 s.spawn=s.nextElite=s.nextBarrage=1e9;s.t=bossTime(s)
 stepHaebi(s,{x:0,y:0},1/120)
 const boss=s.enemies.find(e=>e.kind==='boss')!;assert.equal(boss.giant,undefined)
 boss.hp=1;boss.x=s.x+10;boss.y=s.y;boss.recovery=1;s.cool.sword=0
 stepHaebi(s,{x:0,y:0},1/120);assert.equal(s.state,'won')
})
