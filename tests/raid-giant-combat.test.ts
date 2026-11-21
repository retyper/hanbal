import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHaebi,stepHaebi,spawnGiant,giantHUD,type Kit,type Missile} from '../src/raid/haebi.ts'
import {createImugi,imugiCollisionBounds,stepImugi,imugiCandidates,chooseImugiMove,beginImugiMove,imugiShapes,breakImugiPart,commitImugi,updateImugiPose,type ImugiMove,type GiantOwner,type ImugiState} from '../src/raid/imugi.ts'
import {overlaps,type Shape} from '../src/raid/giant-core.ts'
import {HAEBI_GIANT as G,HAEBI_RUN as C} from '../src/tune/params.ts'
function quiet(kit:Kit='sword'){
 const s=createHaebi(257,'stage',kit,{stage:'ford',simRules:'55-IMUGI'})
 s.spawn=s.nextElite=s.nextBarrage=1e9
 for(const k of Object.keys(s.cool)as(keyof typeof s.cool)[])s.cool[k]=1e9
 const e=spawnGiant(s)!,g=e.giant! as ImugiState;g.state='recover';g.timer=5;g.age=G.entrySeconds;updateImugiPose(g,e,0)
 return{s,e,g}
}
test('55 every primary kit actually damages one real part and one parent',()=>{
 for(const kit of ['axe','bow','spear','sword','dagger','magic','sling']as Kit[]){
  const{s,e,g}=quiet(kit);s.x=e.x+50;s.y=e.y;s.cool[{axe:'axe',bow:'bow',spear:'spear',sword:'sword',dagger:'dagger',magic:'bell',sling:'sling'}[kit]as keyof typeof s.cool]=0
  const before=e.hp,parts={...g.partHP}
  for(let i=0;i<75&&e.hp===before;i++)stepHaebi(s,{x:0,y:0},1/120)
  assert.ok(e.hp<before,kit+' primary missed')
  assert.equal(Object.keys(g.partHP).filter(id=>g.partHP[id as keyof typeof g.partHP]!==parts[id as keyof typeof parts]).length,1,kit+' multiplied part hits')
  assert.ok(Math.abs(s.damage-(before-e.hp))<1e-6,kit+' parent damage mismatch')
 }
})
test('55 an actual fast projectile tunnels through the body once; no fake part Mob or repeat owner',()=>{
 const{s,e,g}=quiet(),before=e.hp
 s.x=100;s.y=100
 const b:Missile={x:e.x-150,y:e.y,vx:60000,vy:0,life:.5,kind:'arrow',damage:100,radius:1,hit:[],angle:0,tx:0,ty:0}
 s.shots.push(b);stepHaebi(s,{x:0,y:0},1/120)
 assert.ok(e.hp<before);assert.deepEqual(b.hit,[e.id]);assert.equal(s.enemies.length,1)
 assert.equal(Object.values(g.partHP).filter(hp=>hp<G.hp*G.partHpShare).length,1)
})
test('55 midboss death leaves a free chest and playing state; giant death gives one victory',()=>{
 const s=createHaebi(257,'stage','sword',{stage:'ford',simRules:'55-IMUGI'});s.spawn=s.nextElite=s.nextBarrage=1e9;s.t=600
 stepHaebi(s,{x:0,y:0},1/120)
 const mid=s.enemies.find(e=>e.bossRole==='midboss')!;mid.hp=1;mid.x=s.x+10;mid.y=s.y;mid.recovery=1;s.cool.sword=0
 stepHaebi(s,{x:0,y:0},1/120)
 assert.equal(s.state,'playing');assert.equal(s.giantFlow!.midDefeated,true);assert.equal(s.chests!.length,1)
 const run=quiet();run.s.x=run.e.x+50;run.s.y=run.e.y
 run.s.shots.push({x:run.e.x,y:run.e.y,vx:0,vy:0,life:0,kind:'rain',damage:1e9,radius:200,hit:[],angle:0,tx:0,ty:0})
 stepHaebi(run.s,{x:0,y:0},1/120)
 assert.equal(run.s.state,'won');assert.equal(run.s.kills,1);assert.equal(run.s.giantFlow!.finalDefeated,true)
 assert.equal(giantHUD(run.s)!.hp,0);assert.equal(run.s.chests!.length,0)
})
test('55 six moves freeze tells, preserve3P landing and fit actual collision shapes in the arena',()=>{
 const owner:GiantOwner={id:9,x:C.width/2,y:C.height/2,hp:G.hp,max:G.hp},g=createImugi(owner)
 g.phase=3
 for(const move of Object.keys(G.moves)as ImugiMove[]){
  g.state='recover';g.timer=0;g.last=null;g.attack=null
  const player={x:owner.x-(move==='tail-sweep'?g.motion.current.facing:1)*200,y:owner.y},choices=imugiCandidates(g,owner,player),index=choices.indexOf(move)
  assert.ok(index>=0,move+' not eligible')
  stepImugi(g,owner,{dt:1/120,tick:1,player,speed:C.speed,dazed:false,random:()=> (index+.1)/choices.length})
  assert.equal(g.pattern,move);assert.equal(g.state,'body')
  const shapes=g.attack!.shapes,serial=JSON.stringify(shapes)
  for(let i=0;i<12;i++)stepImugi(g,owner,{dt:.05,tick:i+2,player:{x:20,y:20},speed:C.speed,dazed:false,random:()=>0})
  assert.equal(g.state,'tell');assert.equal(g.attack!.shapes,shapes);assert.equal(JSON.stringify(shapes),serial)
  const bounds=imugiCollisionBounds(g.pose)
  assert.ok(bounds.left>=-1e-6&&bounds.top>=-1e-6&&bounds.right<=C.width+1e-6&&bounds.bottom<=C.height+1e-6)
  assert.ok(g.bounds.left<=bounds.left&&g.bounds.right>=bounds.right&&g.bounds.top<=bounds.top&&g.bounds.bottom>=bounds.bottom)
 }
})
test('55 body head actually faces its frozen fan; tail source follows its real base/tip',()=>{
 const owner:GiantOwner={id:9,x:C.width/2,y:C.height/2,hp:G.hp,max:G.hp},g=createImugi(owner),player={x:owner.x-200,y:owner.y}
 const choices=imugiCandidates(g,owner,player);g.state='recover';g.timer=0
 const index=choices.indexOf('water-fan');assert.ok(index>=0)
 stepImugi(g,owner,{dt:.01,tick:1,player,speed:C.speed,dazed:false,random:()=> (index+.1)/choices.length})
 for(let i=0;i<11;i++)stepImugi(g,owner,{dt:.05,tick:2+i,player,speed:C.speed,dazed:false,random:()=>0})
 const fan=g.attack!.shapes[0]as Extract<Shape,{kind:'cone'}>,head=g.pose.parts.find(p=>p.id==='head')!,mouth=g.pose.parts.find(p=>p.id==='jaw')!.end
 assert.ok(Math.cos(head.angle-fan.angle)>0,'mouth faces opposite its own fan')
 assert.ok(Math.hypot(fan.center.x-mouth.x,fan.center.y-mouth.y)<1e-6,'fan left the real mouth')
 const rear={x:owner.x-g.motion.current.facing*200,y:owner.y}
 assert.ok(beginImugiMove(g,owner,rear,'tail-sweep',20))
 let sampled=0
 for(let n=0;n<1000&&g.state!=='recover';n++){
  stepImugi(g,owner,{dt:1/120,tick:21+n,player:rear,speed:C.speed,dazed:false,random:()=>0})
  if(g.state==='strike'){const tip=g.pose.parts.find(p=>p.id==='tail-tip')!.end;assert.ok(overlaps(g.attack!.shapes[0]!,{kind:'circle',center:tip,radius:0}),'tail path left its real frozen red');sampled++}
 }
 assert.ok(sampled>0)
})
test('55 delayed ring keeps at least3P radial opening at its INNER edge',()=>{
 const owner:GiantOwner={id:9,x:C.width/2,y:C.height/2,hp:G.hp,max:G.hp},g=createImugi(owner),a=imugiShapes(g,owner,{x:owner.x-200,y:owner.y},'failed-rise').followShapes[0]as Extract<Shape,{kind:'arc'}>
 assert.ok(2*a.inner*Math.sin(Math.PI-a.halfAngle)>=G.playerDiameter*G.safeDiameters-1e-7)
})
test('55 broken same-tick source and killed owner cannot commit pending collision',()=>{
 const owner:GiantOwner={id:9,x:C.width/2,y:C.height/2,hp:G.hp,max:G.hp},g=createImugi(owner),player={x:owner.x,y:owner.y};let loss=0
 g.state='strike';g.seq=1;g.attack={seq:1,move:'jaw-dash',requires:['jaw'],shapes:[{kind:'circle',center:player,radius:100}],followShapes:[],sub:0,pending:true,hit:false,damage:20,recover:1.2}
 g.partHP.jaw=0;breakImugiPart(g,'jaw');commitImugi(g,owner,player,n=>loss+=n,false);assert.equal(loss,0)
 owner.hp=0;g.environment.active=true;commitImugi(g,owner,player,n=>loss+=n,false);assert.equal(loss,0);assert.equal(g.environment.active,false)
})
test('55 phase queues do not skip2 or attack on death; no same move and no RNG on empty',()=>{
 const owner:GiantOwner={id:9,x:C.width/2,y:C.height/2,hp:G.hp*.2,max:G.hp},g=createImugi(owner),player={x:owner.x-200,y:owner.y}
 g.state='recover';g.timer=0
 stepImugi(g,owner,{dt:.01,tick:1,player,speed:C.speed,dazed:false,random:()=>0});assert.equal(g.phase,2);assert.equal(g.state,'roar')
 g.timer=0;stepImugi(g,owner,{dt:.01,tick:2,player,speed:C.speed,dazed:false,random:()=>0});assert.equal(g.phase,3)
 owner.hp=0;g.timer=0;stepImugi(g,owner,{dt:.01,tick:3,player,speed:C.speed,dazed:false,random:()=>{throw new Error('dead RNG')}});assert.equal(g.state,'dead')
})
test('55 eligibility consumes one seeded draw, excludes repeat, and all broken keeps real fallback',()=>{
 const owner:GiantOwner={id:9,x:C.width/2,y:C.height/2,hp:G.hp,max:G.hp},g=createImugi(owner),player={x:owner.x-200,y:owner.y};let calls=0
 g.last='emerge';assert.ok(!imugiCandidates(g,owner,player).includes('emerge'))
 assert.ok(chooseImugiMove(g,owner,player,()=>{calls++;return 0}));assert.equal(calls,1)
 for(const id of Object.keys(g.partHP)as(keyof typeof g.partHP)[])g.partHP[id]=0
 assert.equal(chooseImugiMove(g,owner,player,()=>{throw new Error('empty RNG')}),null)
 updateImugiPose(g,owner,1)
 assert.ok(g.pose.parts.every(p=>!p.targetable),'entry remains invulnerable even with broken parts')
 g.state='recover';updateImugiPose(g,owner,2)
 assert.ok(g.pose.parts.some(p=>p.id==='root'&&p.visible&&p.targetable))
 assert.ok(g.pose.parts.some(p=>p.id==='head'&&p.visible&&p.targetable))
})
test('55 actual periodic poison passes the parent hook once without a new random crit',()=>{
 const{s,e,g}=quiet();s.x=e.x+50;s.y=e.y;e.poison=1;e.pdps=120;g.poisonPart='root';const hp=e.hp,seed=s.seed,part=g.partHP.root
 stepHaebi(s,{x:0,y:0},1/120)
 assert.ok(Math.abs(hp-e.hp-1)<1e-7);assert.ok(Math.abs(part-g.partHP.root-1)<1e-7);assert.equal(s.seed,seed)
})
