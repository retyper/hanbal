import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {makeRng} from '../src/core/rng.ts'
import {createImugi,beginImugiMove,stepImugi,commitImugi,type GiantOwner,type ImugiMove} from '../src/raid/imugi.ts'
import {HAEBI_GIANT as G,HAEBI_RUN as C} from '../src/tune/params.ts'
const DT=1/120,waiting=new Set(['body','hold','tell'])
type Windup={body:number;hold:number;red:number;total:number;use:number}
function actor(){const e:GiantOwner={id:9,x:560,y:360,hp:G.hp,max:G.hp},g=createImugi(e);g.phase=3;g.state='recover';g.timer=0;return{e,g}}
function begin(a:ReturnType<typeof actor>,move:ImugiMove){const side=a.g.motion.current.facing,target={x:Math.max(100,Math.min(1020,a.e.x+(move==='tail-sweep'?-side:side)*200)),y:360};assert.ok(beginImugiMove(a.g,a.e,target,move,Math.round(a.g.age*120)),move);return target}
function measure(a:ReturnType<typeof actor>,move:ImugiMove){
 const target=begin(a,move),start=a.g.age,clock=(a.g.attack as {windup?:Windup}).windup;let hold=0,n=0
 while(waiting.has(a.g.state)&&n++<1500){if(String(a.g.state)==='hold')hold+=DT;stepImugi(a.g,a.e,{dt:DT,tick:Math.round((a.g.age+DT)*120),player:target,speed:C.speed,dazed:false,random:()=>0})}
 assert.equal(a.g.state,'strike');return{move,total:a.g.age-start,hold,clock,target}
}
function finish(a:ReturnType<typeof actor>,target:{x:number;y:number}){let n=0;while((a.g.state!=='recover'||a.g.timer>DT)&&n++<1500)stepImugi(a.g,a.e,{dt:DT,tick:Math.round((a.g.age+DT)*120),player:target,speed:C.speed,dazed:false,random:()=>0})}
test('timing contract1: body start to FIRST strike is0.5..2.5, never body plus a second full tell',()=>{
 const rows=(Object.keys(G.moves)as ImugiMove[]).map(move=>measure(actor(),move))
 assert.ok(rows.every(row=>row.total>=.5-1e-8&&row.total<=2.5+1e-8),JSON.stringify(rows.map(({move,total})=>({move,total}))))
 for(const row of rows){assert.ok(row.clock);assert.ok(Object.isFrozen(row.clock));assert.ok(Math.abs(row.clock.total-row.clock.body-row.clock.hold-row.clock.red)<1e-8);assert.ok(Math.abs(row.total-row.clock.total)<=DT+1e-8)}
})
test('timing contract2: an accepted move reused later has a different pre-red hold, fixed at its start',()=>{
 for(const move of Object.keys(G.moves)as ImugiMove[]){const a=actor(),first=measure(a,move);finish(a,first.target)
  const other=measure(a,move==='emerge'?'water-fan':'emerge');finish(a,other.target)
  const second=measure(a,move)
  assert.notEqual(first.hold,second.hold,move+' repeated the same hold')
  assert.ok(second.total<=2.5+1e-8);assert.ok(Math.abs(second.total-first.total)>.2)
 }
})
test('timing contract3: held body is still, ground begins only after hold, geometry never tracks afterward',()=>{
 const a=actor(),first=measure(a,'water-fan');finish(a,first.target);const other=measure(a,'emerge');finish(a,other.target)
 const target=begin(a,'water-fan'),shapes=a.g.attack!.shapes,serialized=JSON.stringify(shapes),windup=(a.g.attack as {windup?:Windup}).windup
 let holdPose:string|null=null,held=0,red=0,n=0
 while(waiting.has(a.g.state)&&n++<1500){
  assert.equal(a.g.attack!.shapes,shapes);assert.equal(JSON.stringify(shapes),serialized);assert.equal((a.g.attack as {windup?:Windup}).windup,windup)
  if(a.g.state==='body'||String(a.g.state)==='hold')assert.equal(a.g.pose.worldGeometry.tell.length,0)
  if(String(a.g.state)==='hold'){const pose=JSON.stringify(a.g.pose.parts);if(holdPose!==null)assert.equal(pose,holdPose);holdPose=pose;held++}
  if(a.g.state==='tell'){assert.equal(a.g.pose.worldGeometry.tell,shapes);red++}
  stepImugi(a.g,a.e,{dt:DT,tick:Math.round((a.g.age+DT)*120),player:{x:target.x+100,y:target.y+80},speed:C.speed,dazed:false,random:()=>0})
 }
 assert.ok(held>1&&red>1);assert.equal(JSON.stringify(shapes),serialized)
})
test('timing contract5: 30/60/120render FPS share the same fixed-tick actor, accepted rhythm and RNG',()=>{
 const run=(fps:number)=>{const a=actor(),rng=makeRng(5517),damage:number[]=[];let lag=0,tick=0
  for(let frame=0;frame<fps*12;frame++){lag+=1/fps;while(lag+1e-12>=DT){tick++;const player={x:560+Math.cos(tick/180)*160,y:360};stepImugi(a.g,a.e,{dt:DT,tick,player,speed:C.speed,dazed:false,random:()=>rng.next()});commitImugi(a.g,a.e,player,n=>damage.push(n),false);lag-=DT}JSON.stringify(a.g.pose)}
  return createHash('sha256').update(JSON.stringify({e:a.e,g:a.g,damage,seed:rng.state(),tick})).digest('hex')}
 assert.equal(run(30),run(60));assert.equal(run(60),run(120))
})
