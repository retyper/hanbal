import {test} from 'node:test'
import assert from 'node:assert/strict'
import {makePose,overlaps,type PartId,type Shape,type Point} from '../src/raid/giant-core.ts'
import {createImugi,stepImugi,commitImugi,imugiCandidates,type ImugiMove,type GiantOwner} from '../src/raid/imugi.ts'
import {HAEBI_RUN as C,HAEBI_GIANT as G} from '../src/tune/params.ts'
const DT=1/120,near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`)
function start(move:ImugiMove,side=-1){
 const e:GiantOwner={id:9,x:C.width/2,y:C.height/2,hp:G.hp,max:G.hp},g=createImugi(e)
 g.phase=3;g.state='recover';g.timer=0
 const player={x:e.x+side*200,y:e.y},choices=imugiCandidates(g,e,player),i=choices.indexOf(move)
 assert.ok(i>=0,move+' eligibility')
 const step=()=>stepImugi(g,e,{dt:DT,tick:Math.round((g.age+DT)*120),player,speed:C.speed,dazed:false,random:()=>(i+.01)/choices.length})
 step();assert.equal(g.pattern,move);return{e,g,player,step}
}
test('body card: six moves have six different mid-preparation body configurations',()=>{
 const signatures=[]
 for(const move of Object.keys(G.moves)as ImugiMove[]){const a=start(move);for(let i=0;i<30;i++)a.step();signatures.push(a.g.pose.parts.map(p=>[p.id,p.start.x.toFixed(2),p.start.y.toFixed(2),p.end.x.toFixed(2),p.end.y.toFixed(2)]).join('|'))}
 assert.equal(new Set(signatures).size,6)
})
test('body card: broken skin stays visible, bends, and keeps every child attached',()=>{
 const healthy=makePose({ownerId:9,tick:1,x:500,y:360}),broken=makePose({ownerId:9,tick:1,x:500,y:360,broken:['neck-mid','body2']})
 const mid=broken.parts.find(p=>p.id==='neck-mid')!,before=healthy.parts.find(p=>p.id==='neck-mid')!
 assert.ok(mid.visible&&mid.broken&&!mid.targetable)
 assert.ok(Math.abs(mid.angle-before.angle)>.2)
 for(const p of broken.parts)if(p.parent){const parent=broken.parts.find(q=>q.id===p.parent)!;assert.deepEqual(p.start,parent.end)}
 assert.ok(broken.parts.find(p=>p.id==='head')!.visible)
})
test('body card: both body facing and mirror follow left/right players before red starts',()=>{
 for(const side of[-1,1]){const a=start('water-fan',side);while(a.g.state==='body')a.step();const root=a.g.pose.parts.find(p=>p.id==='root')!
  near(Math.cos(root.angle),side);assert.equal(root.mirrorY,side)
 }
})
test('body card: emerge fully submerges, repositions, and lands the real head on frozen red',()=>{
 const a=start('emerge'),begin={x:a.e.x,y:a.e.y};while(a.g.state==='body')a.step()
 assert.ok(a.g.pose.parts.every(p=>!p.visible&&!p.targetable),'not fully submerged')
 const red=a.g.attack!.shapes[0]!,snapshot=JSON.stringify(a.g.attack!.shapes)
 assert.equal(red.kind,'circle')
 while(a.g.state==='tell')a.step()
 while(a.g.state==='strike'){
  a.step()
  if(a.g.pose.parts.every(p=>p.visible)){
   const h=a.g.pose.parts.find(p=>p.id==='head')!.collider
   assert.equal(h.kind,'ellipse');if(h.kind==='ellipse'&&red.kind==='circle'){near(h.center.x,red.center.x);near(h.center.y,red.center.y)}
   break
  }
 }
 assert.ok(Math.hypot(a.e.x-begin.x,a.e.y-begin.y)>10,'emerge never moved')
 assert.equal(JSON.stringify(a.g.attack!.shapes),snapshot)
})
test('body card: pose is continuous across body-to-tell and strike-to-recover boundaries',()=>{
 for(const move of ['water-fan','neck-slam','failed-rise']as ImugiMove[]){const a=start(move);let previous=a.g.pose,old=a.g.state
  for(let n=0;n<1000&&a.g.state!=='recover';n++){
   a.step();if(old!==a.g.state&&a.g.state!=='strike'){
    for(const id of ['neck-top','tail3']as PartId[]){const before=previous.parts.find(p=>p.id===id)!,now=a.g.pose.parts.find(p=>p.id===id)!;assert.ok(Math.hypot(before.end.x-now.end.x,before.end.y-now.end.y)<8,move+' discontinuity '+id)}
   }
   previous=a.g.pose;old=a.g.state
  }
 }
})
test('body card: water front advances through exactly its frozen red capsule and hurts only there once',()=>{
 for(const side of[-1,1]){
  const a=start('jaw-dash',side);while(a.g.state!=='strike')a.step()
  const full=a.g.attack!.shapes[0]!,snapshot=JSON.stringify(full);assert.equal(full.kind,'capsule');if(full.kind!=='capsule')throw new Error('capsule expected')
  const dx=full.to.x-full.from.x,dy=full.to.y-full.from.y,length=Math.hypot(dx,dy),victim={x:full.from.x+dx*.85,y:full.from.y+dy*.85}
  const pieces:Shape[]=[],hits:number[]=[];let first=true
  while(a.g.state==='strike'){
   const attack=a.g.attack!,mouth=a.g.pose.parts.find(p=>p.id==='jaw')!.end
   near(mouth.x,full.from.x);near(mouth.y,full.from.y)
   for(const piece of attack.activeShapes??[]){assert.equal(piece.kind,'capsule');if(piece.kind==='capsule'){near(piece.radius,full.radius);if(pieces.length){const old=pieces[pieces.length-1]!;if(old.kind==='capsule'){near(old.to.x,piece.from.x);near(old.to.y,piece.from.y)}}near(attack.front!.x,piece.to.x);near(attack.front!.y,piece.to.y)}pieces.push(piece)}
   const before=hits.length
   commitImugi(a.g,a.e,victim,n=>hits.push(n),false)
   if(first){assert.equal(hits.length,0,'endpoint was hit before the moving water reached it');first=false}
   if(hits.length>before)assert.ok((attack.activeShapes??[]).some(shape=>overlaps(shape,{kind:'circle',center:victim,radius:0})))
   assert.equal(JSON.stringify(full),snapshot);a.step()
  }
  assert.deepEqual(hits,[G.moves['jaw-dash'].damage])
  const firstPiece=pieces[0]!,lastPiece=pieces[pieces.length-1]!;assert.equal(firstPiece.kind,'capsule');assert.equal(lastPiece.kind,'capsule')
  if(firstPiece.kind==='capsule'&&lastPiece.kind==='capsule'){near(firstPiece.from.x,full.from.x);near(firstPiece.from.y,full.from.y);near(lastPiece.to.x,full.to.x);near(lastPiece.to.y,full.to.y)}
  for(let i=0;i<=20;i++)for(const edge of[-1,0,1]){
   const q:Point={x:full.from.x+dx*i/20-dy/length*full.radius*edge,y:full.from.y+dy*i/20+dx/length*full.radius*edge}
   assert.ok(pieces.some((shape:Shape):boolean=>overlaps(shape,{kind:'circle',center:q,radius:0})),'red contains an uncovered water gap')
  }
 }
})
