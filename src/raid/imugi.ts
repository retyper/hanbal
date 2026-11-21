import { HAEBI_GIANT as G, HAEBI_RUN as C } from '../tune/params.ts'
import { PART_IDS, makePose, freezeTell, overlaps, type ImugiPose, type PartId, type Point, type Shape } from './giant-core.ts'

export type ImugiMove=keyof typeof G.moves
export interface GiantOwner { id:number;x:number;y:number;hp:number;max:number }
export interface ImugiWindup {readonly body:number;readonly hold:number;readonly red:number;readonly total:number;readonly use:number}
export interface ImugiAttack {windup?:Readonly<ImugiWindup>;seq:number;move:ImugiMove;requires:readonly PartId[];shapes:readonly Shape[];followShapes:readonly Shape[];sub:number;pending:boolean;hit:boolean;damage:number;recover:number;activeShapes?:readonly Shape[];front?:Point;lastProgress?:number}
export interface ImugiState {
 motion:ImugiMotion;windupUses:Partial<Record<ImugiMove,number>>;brokenSeen:PartId[];kind:'imugi';phase:1|2|3;state:'entry'|'body'|'hold'|'tell'|'strike'|'recover'|'roar'|'dead';pattern:ImugiMove|null
 seq:number;headAngle:number;age:number;timer:number;enraged:boolean;last:ImugiMove|null;recoveryHitUsed:boolean;submerge:number
 partHP:Record<PartId,number>;partMax:Record<PartId,number>;pose:ImugiPose;attack:ImugiAttack|null
 environment:{phase:1|2|3;shapes:readonly Shape[];age:number;active:boolean;nextHit:number}
 bounds:{left:number;top:number;right:number;bottom:number};lastHitPart:PartId;poisonPart:PartId
}
const point=(x:number,y:number):Point=>({x,y})
const requirements:Record<ImugiMove,readonly PartId[]>={emerge:['neck-base'],'jaw-dash':['jaw'],'tail-sweep':['tail-tip'],'water-fan':['jaw'],'neck-slam':['neck-mid'],'failed-rise':['neck-base']}
const frozen=(shapes:readonly Shape[]):readonly Shape[]=>Object.freeze(shapes.map(freezeTell))
function environment(phase:1|2|3):ImugiState['environment'] {
 const edge=G.environmentBorder
 const box=(x:number,y:number,halfX:number,halfY:number):Shape=>({kind:'box',center:point(x,y),halfX,halfY,angle:0})
 const shapes:Shape[]=phase===1?[{kind:'union',shapes:[box(C.width/2,edge/2,C.width/2,edge/2),box(C.width/2,C.height-edge/2,C.width/2,edge/2),box(edge/2,C.height/2,edge/2,C.height/2),box(C.width-edge/2,C.height/2,edge/2,C.height/2)]}]
  :phase===2?[box(G.environmentSide/2,C.height/2,G.environmentSide/2,C.height/2)]
  :[{kind:'annulus',center:point(C.width/2,C.height/2),inner:G.environmentInner,outer:Math.hypot(C.width,C.height)}]
 return{phase,shapes:frozen(shapes),age:0,active:false,nextHit:0}
}
function boundsOf(pose:ImugiPose,collision:boolean):ImugiState['bounds'] {
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity
 for(const p of pose.parts){if(collision&&(!p.alive||!p.targetable&&p.id!=='root'))continue;const c=p.collider;let x0:number,y0:number,x1:number,y1:number
  if(c.kind==='capsule'){x0=Math.min(c.from.x,c.to.x)-c.radius;y0=Math.min(c.from.y,c.to.y)-c.radius;x1=Math.max(c.from.x,c.to.x)+c.radius;y1=Math.max(c.from.y,c.to.y)+c.radius}
  else{const rx=Math.hypot(c.rx*Math.cos(c.angle),c.ry*Math.sin(c.angle)),ry=Math.hypot(c.rx*Math.sin(c.angle),c.ry*Math.cos(c.angle));x0=c.center.x-rx;x1=c.center.x+rx;y0=c.center.y-ry;y1=c.center.y+ry}
  left=Math.min(left,x0);right=Math.max(right,x1);top=Math.min(top,y0);bottom=Math.max(bottom,y1)
 }
 if(!Number.isFinite(left)){const p=pose.parts.find(p=>p.id==='root')?.start??point(0,0);return{left:p.x,right:p.x,top:p.y,bottom:p.y}}
 const m=collision?0:G.poseBoundsPadding;return{left:left-m,right:right+m,top:top-m,bottom:bottom+m}
}
/** Camera envelope includes skin overhang; it is NEVER a collision fit constraint. */
export const imugiBounds=(pose:ImugiPose)=>boundsOf(pose,false)
/** Only actual targetable shapes and the finite owner anchor constrain arena placement. */
export const imugiCollisionBounds=(pose:ImugiPose)=>boundsOf(pose,true)
const MOTION_IDS:readonly PartId[]=['neck-base','neck-mid','neck-top','body1','body2','body3','tail1','tail2','tail3','tail-tip']
export interface ImugiFrame {x:number;y:number;facing:1|-1;head:number;jaw:number;neckLength:number;bodyLength:number;neckWidth:number;submerged:number;joints:number[]}
export interface ImugiMotion {move:ImugiMove|null;from:ImugiFrame;prepared:ImugiFrame;impact:ImugiFrame;relaxed:ImugiFrame;current:ImugiFrame;recoverFrom:ImugiFrame;recoverSeconds:number;desiredLanding:Point;landing:Point;clamped:boolean;blocked:boolean;progress:number;blockedReason?:'collision-envelope'|'no-safe-landing'}
const unit=(x:number)=>Math.max(0,Math.min(1,x))
const smooth=(x:number)=>{const t=unit(x);return t*t*(3-2*t)}
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t
function frame(e:GiantOwner,facing:1|-1=1):ImugiFrame{return{x:e.x,y:e.y,facing,head:0,jaw:0,neckLength:1,bodyLength:1,neckWidth:1,submerged:0,joints:[...G.motion.rest]}}
function blend(a:ImugiFrame,b:ImugiFrame,t:number):ImugiFrame{
 const k=unit(t),turn=a.facing!==b.facing
 const hide=turn?(k<.5?smooth((k-G.motion.turnHideStart)/G.motion.turnHideSpan):1-smooth((k-G.motion.turnShowStart)/G.motion.turnHideSpan)):0
 const facing=turn&&k<.5?a.facing:b.facing
 const motion=turn?smooth((k-G.motion.turnHideStart)/G.motion.turnHiddenWindow):smooth(k)
 return{x:lerp(a.x,b.x,motion),y:lerp(a.y,b.y,motion),facing,head:lerp(a.head,b.head,motion),jaw:lerp(a.jaw,b.jaw,motion),neckLength:lerp(a.neckLength,b.neckLength,motion),bodyLength:lerp(a.bodyLength,b.bodyLength,motion),neckWidth:lerp(a.neckWidth,b.neckWidth,motion),submerged:Math.max(lerp(a.submerged,b.submerged,smooth(k)),hide),joints:a.joints.map((v,i)=>lerp(v,b.joints[i]??0,motion))}
}
function poseFor(g:ImugiState,e:GiantOwner,f:ImugiFrame,tick:number,planning=false){
 const joints:Partial<Record<PartId,number>>={},lengthScales:Partial<Record<PartId,number>>={},widthScales:Partial<Record<PartId,number>>={}
 for(let i=0;i<MOTION_IDS.length;i++){const id=MOTION_IDS[i]!;joints[id]=f.joints[i]??0;if(id!=='tail-tip')lengthScales[id]=i<3?f.neckLength:f.bodyLength;if(i<3)widthScales[id]=f.neckWidth}
 const neckBend=MOTION_IDS.slice(0,3).reduce((sum,id)=>sum+(g.partHP[id]<=0?G.motion.brokenBend[id]:0),0)
 joints.head=f.head-(f.joints[0]??0)-(f.joints[1]??0)-(f.joints[2]??0)-neckBend
 const revealing=g.motion.move==='emerge'&&g.state==='strike'||g.state==='body'&&g.motion.from.facing!==g.motion.prepared.facing&&1-g.timer/(g.attack?.windup?.body??G.bodySeconds)>.5
 const hidden=G.motion.submergeOrder.filter((_,i)=>revealing?1-f.submerged<(i+1)/G.motion.submergeOrder.length:f.submerged>(i+.5)/G.motion.submergeOrder.length)
 return makePose({ownerId:e.id,tick,x:f.x,y:f.y,angle:f.facing===1?0:Math.PI,mirrorY:f.facing,jawOpen:f.jaw,recovering:g.state==='recover',alive:e.hp>0&&g.state!=='dead',targetable:planning||g.state!=='entry',broken:PART_IDS.filter(id=>g.partHP[id]<=0),hidden,joints,lengthScales,widthScales})
}
function chosenFrame(g:ImugiState):ImugiFrame{
 const m=g.motion;if(!m.move)return m.current
 if(g.state==='body')return blend(m.from,m.prepared,1-g.timer/(g.attack?.windup?.body??G.bodySeconds))
 if(g.state==='hold')return m.prepared
 if(g.state==='tell'){
  if(g.attack?.sub)return m.impact
  if(m.move==='emerge')return{...m.prepared,x:lerp(m.prepared.x,m.impact.x,smooth(1-g.timer/(g.attack?.windup?.red??G.moves.emerge.tell))),y:lerp(m.prepared.y,m.impact.y,smooth(1-g.timer/G.moves.emerge.tell))}
  return m.prepared
 }
 if(g.state==='strike'){
  const p=unit(1-g.timer/G.strikeSeconds);m.progress=p
  if(g.attack?.sub)return m.impact
  return blend(m.move==='emerge'?{...m.prepared,x:m.impact.x,y:m.impact.y}:m.prepared,m.impact,unit(p/G.motion.impactAt))
 }
 if(g.state==='recover')return blend(m.recoverFrom,m.relaxed,1-g.timer/m.recoverSeconds)
 return m.current
}
export function updateImugiPose(g:ImugiState,e:GiantOwner,tick:number):void{
 const f=chosenFrame(g);g.motion.current=f;e.x=f.x;e.y=f.y;g.submerge=f.submerged
 const pose=poseFor(g,e,f,tick)
 g.pose=Object.freeze({...pose,worldGeometry:Object.freeze({...pose.worldGeometry,tell:g.state==='tell'||g.state==='strike'?g.attack?.shapes??Object.freeze([]):Object.freeze([])})});g.bounds=imugiBounds(pose)
 if(g.attack){
  g.attack.activeShapes=Object.freeze([])
  if(g.state==='strike'&&g.attack.move==='jaw-dash'){
   const shape=g.attack.shapes[0]
   if(shape?.kind==='capsule'){
    const t=unit((1-g.timer/G.strikeSeconds)/G.motion.impactAt),previous=g.attack.lastProgress??0
    const at=(p:number)=>point(lerp(shape.from.x,shape.to.x,p),lerp(shape.from.y,shape.to.y,p))
    g.attack.front=at(t);g.attack.activeShapes=frozen([{kind:'capsule',from:at(previous),to:at(t),radius:shape.radius}]);g.attack.lastProgress=t
   }
  }
 }
}
export function fitImugiFrame(g:ImugiState,e:GiantOwner,f:ImugiFrame,tick:number):ImugiFrame|null{
 const bounds=imugiCollisionBounds(poseFor(g,e,f,tick,true))
 if(bounds.right-bounds.left>C.width||bounds.bottom-bounds.top>C.height)return null
 return{...f,x:f.x+(bounds.left<0?-bounds.left:bounds.right>C.width?C.width-bounds.right:0),y:f.y+(bounds.top<0?-bounds.top:bounds.bottom>C.height?C.height-bounds.bottom:0)}
}
function profile(e:GiantOwner,facing:1|-1,move:ImugiMove,impact=false):ImugiFrame{
 const spec=G.motion.profiles[move],f=frame(e,facing)
 f.joints=[...(impact?spec.impact:spec.prepare)];f.neckLength=spec.neck;f.bodyLength=spec.body;f.neckWidth=spec.width;f.jaw=G.jawOpen
 if(move==='emerge')f.submerged=impact?0:1
 return f
}
/** Body and final landing are planned BEFORE red; no later tracking/clamp changes them. */
function planMotion(g:ImugiState,e:GiantOwner,target:Point,move:ImugiMove,tick:number):ImugiMotion|null{
 const from=g.motion.current,facing:1|-1=move==='tail-sweep'?from.facing:target.x<e.x?-1:1
 let prepared=profile(e,facing,move),impact=profile(e,facing,move,true),relaxed=frame(e,facing)
 const pivot=poseFor(g,e,prepared,tick).parts.find(p=>p.id==='head')!.start
 const rawX=235*G.view.headScale+Math.cos(G.jawOpen)*840*G.view.jawScale-Math.sin(G.jawOpen)*245*G.view.jawScale
 const rawY=85*G.view.headScale+Math.sin(G.jawOpen)*840*G.view.jawScale+Math.cos(G.jawOpen)*245*G.view.jawScale
 const base=facing===1?0:Math.PI,want=Math.atan2(target.y-pivot.y,target.x-pivot.x)-facing*Math.atan2(rawY,rawX),relative=Math.atan2(Math.sin(want-base),Math.cos(want-base))*facing
 const aim=Math.max(-G.headTurnLimit,Math.min(G.headTurnLimit,relative))
 prepared.head=move==='neck-slam'?G.motion.slamHead:move==='failed-rise'?G.motion.riseHead:aim
 impact.head=move==='neck-slam'||move==='failed-rise'?G.motion.fallHead:aim;relaxed.head=aim
 relaxed.joints=[...G.motion.rest];relaxed.joints[0]!+=G.recoveryNeck
 if(move==='jaw-dash'||move==='water-fan'){
  // Gather the real rear chain and put the mouth BEFORE the target, rather than
  // spitting backwards at a player standing underneath an overextended jaw.
  prepared.head=-Math.atan2(rawY,rawX)
  const mouth=poseFor(g,e,prepared,tick).parts.find(p=>p.id==='jaw')!.end
  prepared.x+=target.x-facing*G.motion.mouthClearance-mouth.x;prepared.y+=target.y-mouth.y
  impact={...prepared,joints:[...prepared.joints]}
 }
 if(move==='emerge'||move==='neck-slam'||move==='failed-rise'){
  const head=poseFor(g,e,impact,tick).parts.find(p=>p.id==='head')!.collider
  if(head.kind==='ellipse'){impact.x+=target.x-head.center.x;impact.y+=target.y-head.center.y}
 }
 const desired=point(impact.x,impact.y)
 // Fit all interpolation samples with ONE common correction, before capturing geometry.
 const samples:ImugiFrame[]=[]
 for(let i=0;i<=G.motion.envelopeSteps;i++){const t=i/G.motion.envelopeSteps;samples.push(blend(prepared,impact,t),blend(impact,relaxed,t))}
 const boxes=samples.map(f=>imugiCollisionBounds(poseFor(g,e,{...f,x:0,y:0},tick,true)))
 const allowed={left:-Math.min(...boxes.map(b=>b.left)),right:C.width-Math.max(...boxes.map(b=>b.right)),top:-Math.min(...boxes.map(b=>b.top)),bottom:C.height-Math.max(...boxes.map(b=>b.bottom))}
 // Each authored stage has its own root placement. Using one intersection for
 // raised, collapsed and relaxed bodies would artificially prevent the move.
 const fittedImpact=fitImugiFrame(g,e,impact,tick)
 if(!fittedImpact)return null
 impact=fittedImpact
 // Refuse impossible physical rigs BEFORE creating/publishing any ground promise.
 const fittedPrepared=fitImugiFrame(g,e,{...prepared,x:move==='emerge'?from.x:impact.x,y:move==='emerge'?from.y:impact.y},tick)
 const fittedRelaxed=fitImugiFrame(g,e,{...relaxed,x:impact.x,y:impact.y},tick)
 if(!fittedPrepared||!fittedRelaxed)return null
 prepared=fittedPrepared;relaxed=fittedRelaxed
 const oldHead=g.pose.parts.find(p=>p.id==='head')!.collider
 let pose=poseFor(g,e,impact,tick),head=pose.parts.find(p=>p.id==='head')!.collider
 if(move==='emerge'&&head.kind==='ellipse'&&oldHead.kind==='ellipse'&&Math.hypot(head.center.x-oldHead.center.x,head.center.y-oldHead.center.y)<G.motion.minRelocate){
  const x=Math.abs(allowed.left-from.x)>Math.abs(allowed.right-from.x)?allowed.left:allowed.right
  const shifted=fitImugiFrame(g,e,{...impact,x},tick),shiftedRest=fitImugiFrame(g,e,{...relaxed,x},tick)
  if(shifted&&shiftedRest){impact=shifted;relaxed=shiftedRest;pose=poseFor(g,e,impact,tick);head=pose.parts.find(p=>p.id==='head')!.collider}
 }
 const landing=head.kind==='ellipse'?head.center:pose.parts.find(p=>p.id==='root')!.start
 const blocked=move==='emerge'&&oldHead.kind==='ellipse'&&Math.hypot(landing.x-oldHead.center.x,landing.y-oldHead.center.y)<G.motion.minRelocate
 return{move,from,prepared,impact,relaxed,current:from,recoverFrom:impact,recoverSeconds:G.moves[move].recover,desiredLanding:point(target.x,target.y),landing,clamped:Math.hypot(impact.x-desired.x,impact.y-desired.y)>1e-6,blocked,progress:0}
}
export function createImugi(e:GiantOwner,tick=0):ImugiState {
 const max=G.hp*G.partHpShare,partMax=Object.fromEntries(PART_IDS.map(p=>[p,max]))as Record<PartId,number>,base=frame(e)
 const motion:ImugiMotion={move:null,from:base,prepared:base,impact:base,relaxed:base,current:base,recoverFrom:base,recoverSeconds:G.idleRecovery,desiredLanding:point(e.x,e.y),landing:point(e.x,e.y),clamped:false,blocked:false,progress:0}
 const g:ImugiState={motion,windupUses:{},brokenSeen:[],kind:'imugi',phase:1,state:'entry',pattern:null,seq:0,headAngle:0,age:0,timer:G.entrySeconds,enraged:false,last:null,recoveryHitUsed:false,submerge:0,
  partHP:{...partMax},partMax,pose:makePose({ownerId:e.id,tick,x:e.x,y:e.y}),attack:null,environment:environment(1),bounds:{left:0,top:0,right:C.width,bottom:C.height},lastHitPart:'root',poisonPart:'root'}
 const fit=fitImugiFrame(g,e,base,tick)??base;g.motion={...motion,from:fit,prepared:fit,impact:fit,relaxed:fit,current:fit,recoverFrom:fit}
 updateImugiPose(g,e,tick);return g
}
export function imugiCandidates(g:ImugiState,e:GiantOwner,target:Point):ImugiMove[] {
 if(e.hp<=0||g.state==='dead')return[]
 const d=Math.hypot(target.x-e.x,target.y-e.y)
 return(Object.keys(G.moves)as ImugiMove[]).filter(name=>{
  const m=G.moves[name]
  return name!==g.last&&g.phase>=m.phase&&d>=m.min&&d<=m.max&&(name!=='tail-sweep'||(target.x-e.x)*g.motion.current.facing<0)&&requirements[name].every(p=>g.partHP[p]>0)
 })
}
/** One RNG call AFTER filtering. Empty eligibility consumes no random number. */
export function chooseImugiMove(g:ImugiState,e:GiantOwner,target:Point,random:()=>number):ImugiMove|null {
 const choices=imugiCandidates(g,e,target);if(!choices.length)return null
 return choices[Math.min(choices.length-1,Math.floor(random()*choices.length))]!
}
export function imugiShapes(g:ImugiState,e:GiantOwner,target:Point,move:ImugiMove):{shapes:readonly Shape[];followShapes:readonly Shape[]} {
 const motion=g.motion.move===move?g.motion:planMotion(g,e,target,move,g.pose.tick)
 if(!motion)return{shapes:Object.freeze([]),followShapes:Object.freeze([])}
 const release=poseFor(g,e,motion.prepared,g.pose.tick),impact=poseFor(g,e,motion.impact,g.pose.tick)
 const mouth=release.parts.find(p=>p.id==='jaw')!.end,head=impact.parts.find(p=>p.id==='head')!.collider,landing=head.kind==='ellipse'?head.center:motion.landing
 const angle=Math.atan2(target.y-mouth.y,target.x-mouth.x)
 let shapes:Shape[],followShapes:Shape[]=[]
 if(move==='emerge')shapes=[{kind:'circle',center:landing,radius:G.moves.emerge.radius}]
 else if(move==='jaw-dash'){const m=G.moves[move];shapes=[{kind:'capsule',from:mouth,to:point(mouth.x+Math.cos(angle)*C.height*m.lengthShare,mouth.y+Math.sin(angle)*C.height*m.lengthShare),radius:m.width/2}]}
 else if(move==='tail-sweep'){
  const m=G.moves[move],base=release.parts.find(p=>p.id==='tail1')!.start
  const tips=Array.from({length:G.motion.envelopeSteps+1},(_,i)=>poseFor(g,e,blend(motion.prepared,motion.impact,i/G.motion.envelopeSteps),g.pose.tick).parts.find(p=>p.id==='tail-tip')!)
  const outer=Math.max(m.outer,...tips.map(t=>Math.hypot(t.end.x-base.x,t.end.y-base.y)+(t.collider.kind==='capsule'?t.collider.radius:0)))
  const middle=poseFor(g,e,blend(motion.prepared,motion.impact,.5),g.pose.tick).parts.find(p=>p.id==='tail-tip')!.end
  shapes=[{kind:'arc',center:base,inner:outer-(m.outer-m.inner),outer,angle:Math.atan2(middle.y-base.y,middle.x-base.x),halfAngle:m.halfAngle}]
 }else if(move==='water-fan'){const m=G.moves[move];shapes=[{kind:'cone',center:mouth,radius:C.height*m.rangeShare,angle,halfAngle:m.halfAngle}]}
 else if(move==='neck-slam'){const m=G.moves[move];shapes=[{kind:'ellipse',center:landing,rx:m.rx,ry:m.ry,angle:angle+Math.PI/2}]}
 else{const m=G.moves[move],gap=Math.asin(Math.min(1,G.safeDiameters*G.playerDiameter/(2*m.waveInner))),root=point(motion.impact.x,motion.impact.y)
  shapes=[{kind:'circle',center:landing,radius:m.radius}]
  followShapes=[{kind:'arc',center:root,inner:m.waveInner,outer:m.waveOuter,angle:Math.atan2(target.y-root.y,target.x-root.x)+Math.PI,halfAngle:Math.PI-gap}]
 }
 return{shapes:frozen(shapes),followShapes:frozen(followShapes)}
}
/** Total is active, uninterrupted body-start to FIRST strike. Follow-up red is separate.
 * Alternate a pre-red hold on accepted reuse without consuming an extra RNG draw. */
export function imugiWindup(g:ImugiState,move:ImugiMove):Readonly<ImugiWindup>{
 const use=(g.windupUses[move]??0)+1,base=Math.max(G.windup.min,Math.min(G.moves[move].tell,G.windup.max-G.windup.repeatHold))
 const body=Math.min(G.bodySeconds,base-G.windup.minRed),hold=(use-1)%2*G.windup.repeatHold,red=base-body
 return Object.freeze({body,hold,red,total:body+hold+red,use})
}
export function beginImugiMove(g:ImugiState,e:GiantOwner,target:Point,move:ImugiMove,tick:number,speed:number=C.speed):boolean {
 const previous=g.motion,motion=planMotion(g,e,target,move,tick)
 if(!motion){g.motion={...previous,blocked:true,blockedReason:'collision-envelope'};recover(g,G.idleRecovery);return false}
 g.motion=motion
 const m=G.moves[move],geometry=imugiShapes(g,e,target,move),windup=imugiWindup(g,move)
 if(!safeLanding([...geometry.shapes,...geometry.followShapes],g.environment.shapes,target,speed,windup.total)){g.motion={...previous,blocked:true,blockedReason:'no-safe-landing'};recover(g,G.idleRecovery);return false}
 g.windupUses[move]=windup.use;g.last=move;g.pattern=move;g.seq++;g.state='body';g.timer=windup.body;g.headAngle=motion.prepared.head
 g.attack={windup,seq:g.seq,move,requires:requirements[move],...geometry,sub:0,pending:false,hit:false,damage:m.damage,recover:m.recover}
 updateImugiPose(g,e,tick);return true
}
/** A 3P-wide landing disk inside the board, reachable at actual current move speed.
 * Environment safe regions are convex; a straight route between safe endpoints stays safe.
 * Future attack areas may be crossed DURING the tell, before their frozen strike.
 */
export function safeLanding(shapes:readonly Shape[],env:readonly Shape[],player:Point,speed:number,seconds:number):Point|null {
 const radius=G.playerDiameter*G.safeDiameters/2,candidates:Point[]=[]
 for(let y=radius;y<=C.height-radius;y+=G.safeGrid)for(let x=radius;x<=C.width-radius;x+=G.safeGrid)if(Math.hypot(x-player.x,y-player.y)<=speed*seconds)candidates.push(point(x,y))
 candidates.sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y)||a.y-b.y||a.x-b.x)
 for(const p of candidates){const disk:Shape={kind:'circle',center:p,radius};if([...shapes,...env].every(shape=>!overlaps(shape,disk)))return p}
 return null
}
function recover(g:ImugiState,seconds:number){
 const current=g.motion.current,relaxed=frame({id:0,x:current.x,y:current.y,hp:1,max:1},current.facing)
 relaxed.head=g.motion.relaxed.head;relaxed.joints=[...G.motion.rest];relaxed.joints[0]!+=G.recoveryNeck
 g.motion.recoverFrom=current;g.motion.relaxed=relaxed;g.motion.recoverSeconds=seconds
 g.state='recover';g.timer=seconds;g.attack=null;g.recoveryHitUsed=false
}
export function breakImugiPart(g:ImugiState,id:PartId):void {
 if(g.partHP[id]>0||g.brokenSeen.includes(id))return
 g.brokenSeen.push(id)
 if(!g.attack)return
 let source:PartId=g.attack.move==='jaw-dash'||g.attack.move==='water-fan'?'jaw':g.attack.move==='tail-sweep'?'tail1':'head'
 let affects=g.attack.requires.includes(id)||g.attack.move==='tail-sweep'&&id.startsWith('tail')
 while(source){if(source===id)affects=true;const parent=G.pose.parts.find(p=>p[0]===source)?.[1];if(!parent)break;source=parent}
 if(affects)recover(g,G.idleRecovery)
}
export function endImugi(g:ImugiState,e:GiantOwner,tick:number):void{g.state='dead';g.attack=null;g.environment.active=false;updateImugiPose(g,e,tick)}
export interface ImugiStep {dt:number;tick:number;player:Point;speed:number;dazed:boolean;random:()=>number}
/** Prepare only. Player hits resolve after this; commitImugi revalidates before hurt. */
export function stepImugi(g:ImugiState,e:GiantOwner,input:ImugiStep):'roar'|'recovery'|null {
 if(e.hp<=0||g.state==='dead'){endImugi(g,e,input.tick);return null}
 g.age+=input.dt;g.enraged=g.age>=G.enrageAfter
 if(g.state!=='entry'){g.environment.age+=input.dt;g.environment.active=g.environment.age>=G.environmentTell}
 if(input.dazed){updateImugiPose(g,e,input.tick);return null}
 const primary=g.state==='body'||g.state==='hold'||g.state==='tell'&&g.attack?.sub===0
 const remaining=g.timer-input.dt
 g.timer=Math.max(0,remaining)
 let cue:'roar'|'recovery'|null=null
 if(primary&&remaining<=G.windup.epsilon){
  let carry=Math.max(0,-remaining)
  // At most body -> hold -> red -> strike. Carry tick overshoot so .5 is
  // not silently rounded up separately for every stage of a 2.5-second tell.
  for(let n=0;n<3;n++){
   const w=g.attack?.windup
   if(g.state==='body'&&w&&w.hold>0){g.state='hold';g.timer=w.hold-carry}
   else if(g.state==='body'||g.state==='hold'){g.state='tell';g.timer=(w?.red??G.moves[g.pattern!].tell)-carry}
   else{g.state='strike';g.timer=G.strikeSeconds-carry;if(g.attack)g.attack.pending=true;break}
   if(g.timer>G.windup.epsilon)break
   carry=Math.max(0,-g.timer)
  }
  g.timer=Math.max(0,g.timer)
 }else if(g.timer===0){
  if(g.state==='entry'||g.state==='recover'||g.state==='roar'){
   const desired=e.hp/e.max<=G.phaseCuts[1]?3:e.hp/e.max<=G.phaseCuts[0]?2:1
   if(g.phase<desired){g.phase=(g.phase+1)as 2|3;g.state='roar';g.timer=G.roarSeconds;g.environment=environment(g.phase);cue='roar'}
   else{
    const move=chooseImugiMove(g,e,input.player,input.random)
    if(move){beginImugiMove(g,e,input.player,move,input.tick,input.speed)
    }else recover(g,G.idleRecovery)
   }
  }else if(g.state==='body'){g.state='tell';g.timer=G.moves[g.pattern!].tell}
  else if(g.state==='tell'){g.state='strike';g.timer=G.strikeSeconds;if(g.attack)g.attack.pending=true}
  else if(g.state==='strike'){
   if(g.attack?.followShapes.length){g.attack.shapes=g.attack.followShapes;g.attack.followShapes=Object.freeze([]);g.attack.sub++;g.attack.pending=false;g.attack.hit=false;g.state='tell';g.timer=G.moves['failed-rise'].followTell}
   else{recover(g,g.attack?.recover??G.idleRecovery);cue='recovery'}
  }
 }
 updateImugiPose(g,e,input.tick);return cue
}
export function commitImugi(g:ImugiState,e:GiantOwner,player:Point,hurt:(damage:number)=>void,dazed:boolean):void {
 if(e.hp<=0||g.state==='dead'){g.attack=null;g.environment.active=false;return}
 if(dazed)return
 const attack=g.attack
 if(g.state==='strike'&&attack&&!attack.hit&&(attack.pending||attack.move==='jaw-dash')){
  const hasMotion=g.motion.move===attack.move
  const due=attack.move==='jaw-dash'||!hasMotion||g.motion.progress>=G.motion.impactAt
  if(due&&attack.seq===g.seq&&attack.requires.every(id=>g.partHP[id]>0)){
   const shapes=attack.move==='jaw-dash'&&hasMotion?attack.activeShapes??[]:attack.shapes
   if(shapes.some(shape=>overlaps(shape,{kind:'circle',center:player,radius:0}))){attack.hit=true;hurt(attack.damage*(g.enraged?G.enrageDamage:1))}
   if(attack.move!=='jaw-dash'){attack.pending=false;attack.hit=true}
  }
 }
 if(g.environment.active&&g.environment.age>=g.environment.nextHit&&g.environment.shapes.some(shape=>overlaps(shape,{kind:'circle',center:player,radius:0}))){
  g.environment.nextHit=g.environment.age+G.environmentEvery;hurt(G.environmentDamage*(g.enraged?G.enrageDamage:1))
 }
}
