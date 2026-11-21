import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createImugi,beginImugiMove,imugiCandidates,updateImugiPose,fitImugiFrame,imugiCollisionBounds,type GiantOwner,type ImugiMove} from '../src/raid/imugi.ts'
import {PART_IDS,type PartId} from '../src/raid/giant-core.ts'
import {HAEBI_GIANT as G} from '../src/tune/params.ts'
/** From after-mid-normal-axe7-02 last state, not claimed as a new ordinary input run. */
const observed={root:0,'neck-base':0,'neck-mid':0,'neck-top':0,head:0,jaw:29280.47823231999,body1:0,body2:20037.38632608002,body3:62146.78743167999,tail1:70789.389984,tail2:57209.804490239985,tail3:68483.46614399999,'tail-tip':66538.86193599997}
function damaged(parts:readonly PartId[],phase:1|2|3=3,facing:1|-1=1){
 const e:GiantOwner={id:17785,x:316.5563041662337,y:235.6734365555808,hp:62412.243541441014,max:G.hp},g=createImugi(e)
 e.x=316.5563041662337;e.y=235.6734365555808;g.motion.current={...g.motion.current,x:e.x,y:e.y,facing};g.phase=phase;g.state='recover';g.timer=0;g.seq=42
 for(const id of parts)g.partHP[id]=0
 updateImugiPose(g,e,157004);return{e,g}
}
test('stability: observed surviving compound-broken rig must never abort a legal next plan',()=>{
 const broken=PART_IDS.filter(id=>observed[id]===0)
 for(const facing of[1,-1]as const)for(const move of['jaw-dash','water-fan','tail-sweep']as ImugiMove[]){
  const{e,g}=damaged(broken,3,facing);Object.assign(g.partHP,observed)
  const player={x:e.x+(move==='tail-sweep'?-facing:facing)*200,y:e.y}
  assert.doesNotThrow(()=>beginImugiMove(g,e,player,move,157005),move+' failed observed broken state')
  assert.ok(e.hp>0);assert.ok(g.pose.parts.some(p=>(p.id==='head'||p.id==='root')&&p.targetable))
 }
})
test('stability: all phases and mixed damaged neck/body/tail keep a normal plan or safe recovery',()=>{
 const sets:readonly(readonly PartId[])[]=[[],['root','body1'],['neck-mid','body2'],['neck-base','neck-top','body1','tail2'],PART_IDS.filter(id=>observed[id]===0),PART_IDS]
 for(const phase of[1,2,3]as const)for(const broken of sets){
  const{e,g}=damaged(broken,phase),target={x:e.x-200,y:e.y}
  for(const move of imugiCandidates(g,e,target))assert.doesNotThrow(()=>beginImugiMove(g,e,target,move,1))
  assert.ok(g.pose.parts.some(p=>p.id==='root'&&p.visible&&p.targetable))
 }
})
test('stability: frame fit checks future hit shapes even while the current actor is entering',()=>{
 const e:GiantOwner={id:9,x:560,y:360,hp:G.hp,max:G.hp},g=createImugi(e),before=JSON.stringify({e,g})
 const oversized={...g.motion.current,neckLength:8,bodyLength:8}
 assert.equal(fitImugiFrame(g,e,oversized,1),null,'entry mask cannot approve an oversized future attack')
 assert.equal(JSON.stringify({e,g}),before,'pure fitting must not mutate the live actor')
})
test('stability: unsafe planning recovers before publishing red and keeps a reachable owner core',()=>{
 const e:GiantOwner={id:9,x:560,y:360,hp:G.hp,max:G.hp},g=createImugi(e),hp=e.hp
 assert.equal(beginImugiMove(g,e,{x:e.x+200,y:e.y},'jaw-dash',1,0),false)
 assert.equal(g.state,'recover');assert.equal(g.attack,null);assert.equal(g.motion.blocked,true)
 assert.equal(g.motion.blockedReason,'no-safe-landing');assert.equal(e.hp,hp)
 updateImugiPose(g,e,2)
 const bounds=imugiCollisionBounds(g.pose),root=g.pose.parts.find(p=>p.id==='root')!
 assert.ok(root.visible&&root.targetable);assert.ok(bounds.left>=0&&bounds.top>=0&&bounds.right<=1120&&bounds.bottom<=720)
})
