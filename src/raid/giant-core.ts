import { HAEBI_GIANT as G } from '../tune/params.ts'
/** 55 shared geometry. Initial boss values remain subject to measured balance.
 * Authority: MD55 lines2325-2337; BOSS.md98-115; ../PLAN.md sections2-4.
 * No DOM, RNG, wall clock, Mob allocation, XP, gold or application state writes.
 */
export interface Point { readonly x:number; readonly y:number }
export const PART_IDS=['root','neck-base','neck-mid','neck-top','head','jaw','body1','body2','body3','tail1','tail2','tail3','tail-tip'] as const
export type PartId=typeof PART_IDS[number]
export type Collider=Readonly<{kind:'capsule';from:Point;to:Point;radius:number}>|Readonly<{kind:'ellipse';center:Point;rx:number;ry:number;angle:number}>
export type Primitive=Collider|Readonly<{kind:'box';center:Point;halfX:number;halfY:number;angle:number}>|Readonly<{kind:'diskCap';center:Point;radius:number;angle:number;minAlong:number}>|Readonly<{kind:'circle';center:Point;radius:number}>|Readonly<{kind:'line';from:Point;to:Point;width:number}>|Readonly<{kind:'cone';center:Point;radius:number;angle:number;halfAngle:number}>|Readonly<{kind:'annulus';center:Point;inner:number;outer:number}>|Readonly<{kind:'arc';center:Point;inner:number;outer:number;angle:number;halfAngle:number}>
export type Shape=Primitive|Readonly<{kind:'union';shapes:readonly Shape[]}>
export interface PartPose {
 readonly id:PartId;readonly parent:PartId|null;readonly start:Point;readonly end:Point;readonly angle:number
 readonly mirrorY:1|-1;readonly alive:boolean;readonly broken:boolean;readonly damaged:boolean
 readonly visible:boolean;readonly targetable:boolean;readonly height:number;readonly widthScale:number;readonly collider:Collider;readonly mouth?:Point
}
export interface WorldGeometry { readonly parts:readonly Readonly<{id:PartId;shape:Collider}>[];readonly tell:readonly Shape[] }
export interface ImugiPose {readonly ownerId:number;readonly tick:number;readonly parts:readonly PartPose[];readonly worldGeometry:WorldGeometry;readonly jawOpen:number;readonly recovering:boolean}
const EPS=1e-7,TOI_EPS=1e-10,TAU=Math.PI*2
const point=(x:number,y:number):Point=>({x,y})
const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y
const sub=(a:Point,b:Point)=>point(a.x-b.x,a.y-b.y)
const mix=(a:Point,b:Point,t:number)=>point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t)
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)
const cross=(a:Point,b:Point)=>a.x*b.y-a.y*b.x
const finite=(...v:number[])=>v.every(Number.isFinite)
const validPoint=(p:Point)=>finite(p.x,p.y)
const turn=(a:number)=>((a%TAU)+TAU)%TAU
const delta=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b))
function freeze<T>(value:T):T { if(value!==null&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value)}return value }
function leaves(shape:Shape):Primitive[] {
 const out:Primitive[]=[]
 function visit(s:Shape,depth:number){
  if(depth>8||out.length>=128)throw new RangeError('geometry-budget')
  if(s.kind==='union'){if(s.shapes.length>32)throw new RangeError('geometry-budget');for(const q of s.shapes)visit(q,depth+1);return}
  const radial='center' in s
  if(radial&&!validPoint(s.center)||!radial&&(!validPoint(s.from)||!validPoint(s.to)))throw new RangeError('geometry-point')
  if(s.kind==='box'){if(!finite(s.halfX,s.halfY,s.angle)||s.halfX<0||s.halfY<0)throw new RangeError('box')}
  else if(s.kind==='diskCap'){if(!finite(s.radius,s.angle,s.minAlong)||s.radius<0||Math.abs(s.minAlong)>s.radius)throw new RangeError('disk-cap')}
  else if(s.kind==='ellipse'){if(!finite(s.rx,s.ry,s.angle)||s.rx<=0||s.ry<=0)throw new RangeError('ellipse')}
  else if(s.kind==='line'){if(!finite(s.width)||s.width<0)throw new RangeError('line')}
  else if(s.kind==='annulus'||s.kind==='arc') {if(!finite(s.inner,s.outer)||s.inner<0||s.outer<s.inner)throw new RangeError('annulus')}
  else if(!finite(s.radius)||s.radius<0)throw new RangeError('radius')
  if(s.kind==='cone'||s.kind==='arc')if(!finite(s.angle,s.halfAngle)||s.halfAngle<0||s.halfAngle>Math.PI)throw new RangeError('angle')
  out.push(s)
 }
 visit(shape,0);return out
}
function closestSegment(p:Point,a:Point,b:Point):Point {const v=sub(b,a),d=dot(v,v);return mix(a,b,d===0?0:Math.max(0,Math.min(1,dot(sub(p,a),v)/d)))}
/** Euclidean closest point, not ellipse-axis inflation. Monotone Lagrange multiplier. */
export function closestPoint(p:Point,c:Collider):Point {
 if(c.kind==='capsule'){
  const q=closestSegment(p,c.from,c.to),d=dist(p,q)
  return d<=c.radius?point(p.x,p.y):mix(q,p,c.radius/d)
 }
 const co=Math.cos(c.angle),si=Math.sin(c.angle),v=sub(p,c.center),x=v.x*co+v.y*si,y=-v.x*si+v.y*co
 if((x/c.rx)**2+(y/c.ry)**2<=1)return point(p.x,p.y)
 const aa=c.rx*c.rx,bb=c.ry*c.ry
 const f=(t:number)=>(c.rx*x/(t+aa))**2+(c.ry*y/(t+bb))**2-1
 let lo=0,hi=Math.max(aa,bb,Math.abs(c.rx*x),Math.abs(c.ry*y),1),n=0
 while(f(hi)>0){hi*=2;if(++n>64||!Number.isFinite(hi))throw new RangeError('ellipse-distance-budget')}
 for(let i=0;i<80;i++){const mid=(lo+hi)/2;if(f(mid)>0)lo=mid;else hi=mid}
 const qx=aa*x/(hi+aa),qy=bb*y/(hi+bb)
 return point(c.center.x+co*qx-si*qy,c.center.y+si*qx+co*qy)
}
interface Segment {kind:'segment';a:Point;b:Point}
interface Curve {kind:'curve';center:Point;u:Point;v:Point;start:number;sweep:number}
type Boundary=Segment|Curve
const curve=(center:Point,rx:number,ry:number,angle=0,start=0,sweep=TAU):Curve=>({kind:'curve',center,u:point(rx*Math.cos(angle),rx*Math.sin(angle)),v:point(-ry*Math.sin(angle),ry*Math.cos(angle)),start,sweep})
const onCurve=(c:Curve,t:number)=>point(c.center.x+c.u.x*Math.cos(t)+c.v.x*Math.sin(t),c.center.y+c.u.y*Math.cos(t)+c.v.y*Math.sin(t))
const inArc=(c:Curve,t:number)=>c.sweep>=TAU-EPS||turn(t-c.start)<=c.sweep+EPS||Math.abs(delta(t,c.start))<=EPS
function normalized(c:Curve,p:Point):Point {const q=sub(p,c.center);return point(dot(q,c.u)/dot(c.u,c.u),dot(q,c.v)/dot(c.v,c.v))}
function boundary(s:Primitive):Boundary[] {
 if(s.kind==='box'){
  const c=Math.cos(s.angle),n=Math.sin(s.angle),local=(x:number,y:number)=>point(s.center.x+c*x-n*y,s.center.y+n*x+c*y)
  const ps=[local(-s.halfX,-s.halfY),local(s.halfX,-s.halfY),local(s.halfX,s.halfY),local(-s.halfX,s.halfY)]
  return ps.map((a,i)=>({kind:'segment',a,b:ps[(i+1)%4]!}))
 }
 if(s.kind==='diskCap'){
  if(s.radius===0)return[{kind:'segment',a:s.center,b:s.center}]
  const h=Math.acos(s.minAlong/s.radius),c=curve(s.center,s.radius,s.radius,0,s.angle-h,h*2)
  return[c,{kind:'segment',a:onCurve(c,c.start),b:onCurve(c,c.start+c.sweep)}]
 }
 if(s.kind==='ellipse')return[curve(s.center,s.rx,s.ry,s.angle)]
 if(s.kind==='circle')return s.radius===0?[{kind:'segment',a:s.center,b:s.center}]:[curve(s.center,s.radius,s.radius)]
 if(s.kind==='line')return boundary({kind:'capsule',from:s.from,to:s.to,radius:s.width/2})
 if(s.kind==='capsule'){
  if(s.radius===0)return[{kind:'segment',a:s.from,b:s.to}]
  if(dist(s.from,s.to)===0)return[curve(s.from,s.radius,s.radius)]
  const a=Math.atan2(s.to.y-s.from.y,s.to.x-s.from.x),n=point(-Math.sin(a)*s.radius,Math.cos(a)*s.radius)
  return[{kind:'segment',a:point(s.from.x+n.x,s.from.y+n.y),b:point(s.to.x+n.x,s.to.y+n.y)},curve(s.to,s.radius,s.radius,0,a-Math.PI/2,Math.PI),{kind:'segment',a:point(s.from.x-n.x,s.from.y-n.y),b:point(s.to.x-n.x,s.to.y-n.y)},curve(s.from,s.radius,s.radius,0,a+Math.PI/2,Math.PI)]
 }
 const outer=s.kind==='cone'?s.radius:s.outer,inner=s.kind==='cone'?0:s.inner
 const half=s.kind==='annulus'?Math.PI:s.halfAngle,angle=s.kind==='annulus'?0:s.angle
 if(outer===0)return[{kind:'segment',a:s.center,b:s.center}]
 const start=angle-half,sweep=half*2,result:Boundary[]=[curve(s.center,outer,outer,0,start,sweep)]
 if(inner>0)result.push(curve(s.center,inner,inner,0,start,sweep))
 if(sweep<TAU-EPS)for(const t of [start,start+sweep])result.push({kind:'segment',a:point(s.center.x+Math.cos(t)*inner,s.center.y+Math.sin(t)*inner),b:point(s.center.x+Math.cos(t)*outer,s.center.y+Math.sin(t)*outer)})
 return result
}
function contains(s:Primitive,p:Point):boolean {
 if(s.kind==='box'){const d=sub(p,s.center),c=Math.cos(s.angle),n=Math.sin(s.angle);return Math.abs(d.x*c+d.y*n)<=s.halfX+EPS&&Math.abs(d.y*c-d.x*n)<=s.halfY+EPS}
 if(s.kind==='diskCap'){const d=sub(p,s.center);return dist(p,s.center)<=s.radius+EPS&&d.x*Math.cos(s.angle)+d.y*Math.sin(s.angle)>=s.minAlong-EPS}
 if(s.kind==='capsule'||s.kind==='ellipse')return dist(p,closestPoint(p,s))<=EPS
 if(s.kind==='line')return dist(p,closestSegment(p,s.from,s.to))<=s.width/2+EPS
 const d=dist(p,s.center)
 if(s.kind==='circle')return d<=s.radius+EPS
 const inner=s.kind==='cone'?0:s.inner,outer=s.kind==='cone'?s.radius:s.outer
 if(d<inner-EPS||d>outer+EPS)return false
 return s.kind==='annulus'||d<=EPS||Math.abs(delta(Math.atan2(p.y-s.center.y,p.x-s.center.x),s.angle))<=s.halfAngle+EPS
}
function segmentCross(a:Segment,b:Segment):boolean {
 const r=sub(a.b,a.a),s=sub(b.b,b.a),q=sub(b.a,a.a),d=cross(r,s)
 if(Math.abs(d)>1e-12){const t=cross(q,s)/d,u=cross(q,r)/d;return t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS}
 return dist(a.a,closestSegment(a.a,b.a,b.b))<=EPS||dist(a.b,closestSegment(a.b,b.a,b.b))<=EPS||dist(b.a,closestSegment(b.a,a.a,a.b))<=EPS||dist(b.b,closestSegment(b.b,a.a,a.b))<=EPS
}
function segmentCurve(s:Segment,c:Curve):boolean {
 const a=normalized(c,s.a),b=normalized(c,s.b),d=sub(b,a),aa=dot(d,d),bb=2*dot(a,d),cc=dot(a,a)-1
 if(aa===0)return Math.abs(cc)<EPS&&inArc(c,Math.atan2(a.y,a.x))
 const disc=bb*bb-4*aa*cc
 if(disc< -1e-12)return false
 const root=Math.sqrt(Math.max(0,disc))
 return [(-bb-root)/(2*aa),(-bb+root)/(2*aa)].some(t=>{const p=mix(a,b,t);return t>=-EPS&&t<=1+EPS&&inArc(c,Math.atan2(p.y,p.x))})
}
function polynomialRoots(input:number[]):number[] {
 const scale=Math.max(...input.map(Math.abs))
 if(scale===0)return[]
 const c=input.map(v=>v/scale)
 while(c.length>1&&Math.abs(c[c.length-1]!)<1e-14)c.pop()
 const degree=c.length-1
 if(degree===0)return[]
 if(degree===1)return[-c[0]!/c[1]!]
 const bound=1+Math.max(...c.slice(0,-1).map(v=>Math.abs(v/c[degree]!)))
 const f=(x:number)=>c.reduceRight((v,q)=>v*x+q,0)
 const critical=polynomialRoots(c.slice(1).map((v,i)=>v*(i+1))).filter(v=>v> -bound&&v<bound)
 const points=[-bound,...critical,bound].sort((a,b)=>a-b),roots:number[]=[]
 const tolerance=(x:number)=>1e-11*c.reduce((sum,v,i)=>sum+Math.abs(v)*Math.abs(x)**i,1)
 for(const x of points)if(Math.abs(f(x))<=tolerance(x))roots.push(x)
 for(let i=0;i<points.length-1;i++){
  let a=points[i]!,b=points[i+1]!,fa=f(a),fb=f(b)
  if(fa===0||fb===0||Math.sign(fa)===Math.sign(fb))continue
  for(let k=0;k<100;k++){const mid=(a+b)/2,fm=f(mid);if(Math.sign(fm)===Math.sign(fa)){a=mid;fa=fm}else{b=mid;fb=fm}}
  roots.push((a+b)/2)
 }
 return roots.filter((x,i)=>roots.findIndex(y=>Math.abs(x-y)<1e-9*(1+Math.abs(x)))===i)
}
function curveCross(a:Curve,b:Curve):boolean {
 const A=normalized(b,a.center),B=point(dot(a.u,b.u)/dot(b.u,b.u),dot(a.u,b.v)/dot(b.v,b.v)),C=point(dot(a.v,b.u)/dot(b.u,b.u),dot(a.v,b.v)/dot(b.v,b.v))
 const x=[A.x+B.x,2*C.x,A.x-B.x],y=[A.y+B.y,2*C.y,A.y-B.y],coeff=[-1,0,-2,0,-1]
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)coeff[i+j]!+=x[i]!*x[j]!+y[i]!*y[j]!
 if(Math.max(...coeff.map(Math.abs))<1e-11){
  return[a.start,a.start+a.sweep/2,a.start+a.sweep].some(t=>inArc(b,Math.atan2(normalized(b,onCurve(a,t)).y,normalized(b,onCurve(a,t)).x)))||[b.start,b.start+b.sweep/2,b.start+b.sweep].some(t=>inArc(a,Math.atan2(normalized(a,onCurve(b,t)).y,normalized(a,onCurve(b,t)).x)))
 }
 const angles=[...polynomialRoots(coeff).map(u=>2*Math.atan(u)),Math.PI]
 return angles.some(t=>{if(!inArc(a,t))return false;const q=normalized(b,onCurve(a,t));return Math.abs(dot(q,q)-1)<=EPS/Math.max(1,Math.min(Math.hypot(b.u.x,b.u.y),Math.hypot(b.v.x,b.v.y)))&&inArc(b,Math.atan2(q.y,q.x))})
}
function primitiveOverlap(a:Primitive,b:Primitive):boolean {
 const aa=boundary(a),bb=boundary(b)
 for(const x of aa)for(const y of bb){
  if(x.kind==='segment'&&y.kind==='segment'?segmentCross(x,y):x.kind==='segment'&&y.kind==='curve'?segmentCurve(x,y):x.kind==='curve'&&y.kind==='segment'?segmentCurve(y,x):curveCross(x as Curve,y as Curve))return true
 }
 const sample=(q:Boundary)=>q.kind==='segment'?q.a:onCurve(q,q.start)
 return aa.some(q=>contains(b,sample(q)))||bb.some(q=>contains(a,sample(q)))
}
/** Boundary crossing plus containment handles sector/annular holes and disjoint unions. */
export function overlaps(a:Shape,b:Shape):boolean {const aa=leaves(a),bb=leaves(b);return aa.some(x=>bb.some(y=>primitiveOverlap(x,y)))}
/** Structural Point inputs may be full run/Mob objects. Copy ONLY the schema. */
function copyShape(s:Shape):Shape {
 const p=(v:Point)=>point(v.x,v.y)
 switch(s.kind){
  case 'union':return{kind:'union',shapes:s.shapes.map(copyShape)}
  case 'capsule':return{kind:'capsule',from:p(s.from),to:p(s.to),radius:s.radius}
  case 'line':return{kind:'line',from:p(s.from),to:p(s.to),width:s.width}
  case 'ellipse':return{kind:'ellipse',center:p(s.center),rx:s.rx,ry:s.ry,angle:s.angle}
  case 'circle':return{kind:'circle',center:p(s.center),radius:s.radius}
  case 'cone':return{kind:'cone',center:p(s.center),radius:s.radius,angle:s.angle,halfAngle:s.halfAngle}
  case 'arc':return{kind:'arc',center:p(s.center),inner:s.inner,outer:s.outer,angle:s.angle,halfAngle:s.halfAngle}
  case 'annulus':return{kind:'annulus',center:p(s.center),inner:s.inner,outer:s.outer}
  case 'box':return{kind:'box',center:p(s.center),halfX:s.halfX,halfY:s.halfY,angle:s.angle}
  case 'diskCap':return{kind:'diskCap',center:p(s.center),radius:s.radius,angle:s.angle,minAlong:s.minAlong}
 }
}
export function freezeTell(shape:Shape):Shape {leaves(shape);return freeze(copyShape(shape))}
export interface PoseInput {ownerId:number;tick:number;x:number;y:number;angle?:number;mirrorY?:1|-1;height?:number;jawOpen?:number;recovering?:boolean;alive?:boolean;targetable?:boolean;broken?:readonly PartId[];hidden?:readonly PartId[];joints?:Readonly<Partial<Record<PartId,number>>>;lengthScales?:Readonly<Partial<Record<PartId,number>>>;widthScales?:Readonly<Partial<Record<PartId,number>>>;tell?:readonly Shape[]}
/** Source pivots are asset-contract values. Lengths/radii below are unvalidated C-only proposals. */
export function makePose(input:PoseInput):ImugiPose {
 const facing=input.angle??0,side=input.mirrorY??1,height=input.height??0,alive=input.alive!==false,jawOpen=input.jawOpen??0
 if(!finite(input.x,input.y,facing,height,jawOpen,input.tick,input.ownerId)||!(side===1||side===-1))throw new RangeError('pose-input')
 const origin=point(input.x,input.y-height),broken=new Set(input.broken??[]),hidden=new Set(input.hidden??[]),parts:PartPose[]=[],byId=new Map<PartId,PartPose>()
 const specs:readonly (readonly [PartId,PartId|null,number,number,number])[]=G.pose.parts
 for(const[id,parent,rotation,length,radius]of specs){
  const a=parent?byId.get(parent)!.end:origin,base=parent?byId.get(parent)!.angle:facing
  const damaged=broken.has(id),widthScale=input.widthScales?.[id]??1,lengthScale=input.lengthScales?.[id]??1
  if(!finite(widthScale,lengthScale)||widthScale<=0||lengthScale<=0)throw new RangeError('part-scale')
  const angle=base+side*(rotation+(input.joints?.[id]??0)+(damaged?G.motion.brokenBend[id]:0)+(id==='jaw'?jawOpen:0))
  const local=(x:number,y:number):Point=>point(a.x+Math.cos(angle)*x-Math.sin(angle)*y*side,a.y+Math.sin(angle)*x+Math.cos(angle)*y*side)
  const end=id==='head'?local(235*G.view.headScale,85*G.view.headScale):id==='jaw'?local(840*G.view.jawScale,245*G.view.jawScale):id==='tail-tip'?local(Math.hypot(1060,605)*G.view.tipScale,0):local(length*lengthScale,0)
  const severed=damaged&&id!=='head'&&id!=='root',visible=alive&&!hidden.has(id)
  const collider:Collider=id==='head'?{kind:'ellipse',center:local(G.pose.headCenter[0],G.pose.headCenter[1]),rx:G.pose.headRadii[0],ry:G.pose.headRadii[1],angle}:{kind:'capsule',from:a,to:end,radius:radius*widthScale}
  const part:PartPose={id,parent,start:a,end,angle,mirrorY:side,alive,broken:severed,damaged,visible,targetable:visible&&!severed&&input.targetable!==false,height,widthScale,collider,...(id==='jaw'?{mouth:end}:{})}
  parts.push(part);byId.set(id,part)
 }
 const worldGeometry:WorldGeometry={parts:parts.map(q=>({id:q.id,shape:q.collider})),tell:(input.tell??[]).map(freezeTell)}
 return freeze({ownerId:input.ownerId,tick:input.tick,parts,worldGeometry,jawOpen,recovering:input.recovering===true})
}
export interface Contact {readonly ownerId:number;readonly partId:PartId;readonly t:number;readonly point:Point;readonly normal:Point;readonly distance:number;readonly weakScale:number}
const priority=(id:PartId)=>id==='head'?0:id==='jaw'?1:PART_IDS.indexOf(id)+2
function contact(pose:ImugiPose,part:PartPose,center:Point,t:number,distance:number,velocity:Point=point(0,0)):Contact {
 const q=closestPoint(center,part.collider),v=sub(center,q),d=Math.hypot(v.x,v.y),back=Math.hypot(velocity.x,velocity.y)
 return{ownerId:pose.ownerId,partId:part.id,t,point:q,normal:d>EPS?point(v.x/d,v.y/d):back>EPS?point(-velocity.x/back,-velocity.y/back):point(1,0),distance,weakScale:part.id==='head'?(pose.recovering?G.recoveryHeadDamage:G.headDamage):1}
}
const eligible=(p:PartPose)=>p.alive&&p.visible&&p.targetable&&!p.broken
function reference(s:Primitive):Point{return'center'in s?s.center:s.from}
export function pickContact(pose:ImugiPose,shape:Shape):Contact|null {
 const attacks=leaves(shape),hits:Contact[]=[]
 for(const part of pose.parts)if(eligible(part))for(const attack of attacks)if(primitiveOverlap(attack,part.collider)){const at=reference(attack),d=dist(at,closestPoint(at,part.collider));hits.push(contact(pose,part,at,0,d))}
 hits.sort((a,b)=>Math.abs(a.distance-b.distance)>EPS?a.distance-b.distance:priority(a.partId)-priority(b.partId))
 return hits[0]??null
}
/** Static fixed-tick collider versus a moving disk. Convex squared-distance derivative
 * brackets the minimum; a second bracket finds the FIRST radius crossing. 80+80 bounded.
 * This is not proof of continuous collision against a moving/rotating collider.
 */
function sweepPart(from:Point,to:Point,radius:number,shape:Collider):number|null {
 const v=sub(to,from),distance=(t:number)=>{const p=mix(from,to,t);return dist(p,closestPoint(p,shape))}
 if(distance(0)<=radius+EPS)return 0
 if(dot(v,v)===0)return null
 const derivative=(t:number)=>{const p=mix(from,to,t);return dot(v,sub(p,closestPoint(p,shape)))}
 let minimum=0
 if(derivative(0)>=0)return null
 if(derivative(1)<=0)minimum=1
 else {let a=0,b=1;for(let i=0;i<80;i++){const mid=(a+b)/2;if(derivative(mid)<0)a=mid;else b=mid}minimum=(a+b)/2}
 if(distance(minimum)>radius+EPS)return null
 let a=0,b=minimum
 for(let i=0;i<80;i++){const mid=(a+b)/2;if(distance(mid)>radius)a=mid;else b=mid}
 return b
}
export function sweepContact(pose:ImugiPose,from:Point,to:Point,radius:number):Contact|null {
 if(!validPoint(from)||!validPoint(to)||!finite(radius)||radius<0)throw new RangeError('sweep-input')
 const hits:Contact[]=[],v=sub(to,from)
 for(const part of pose.parts)if(eligible(part)){leaves(part.collider);const t=sweepPart(from,to,radius,part.collider);if(t!==null)hits.push(contact(pose,part,mix(from,to,t),t,0,v))}
 hits.sort((a,b)=>Math.abs(a.t-b.t)>TOI_EPS?a.t-b.t:priority(a.partId)-priority(b.partId))
 return hits[0]??null
}
type EventFailure='invalid-event'|'stale-event'|'unknown-event'|'event-capacity'|'owner-capacity'|'invalid-owner'
export class DamageLedger {
 readonly capacity:number;readonly ownerCapacity:number
 private events=new Map<number,Set<number>>();private last=0
 constructor(capacity=32,ownerCapacity=64){if(!Number.isSafeInteger(capacity)||capacity<1||!Number.isSafeInteger(ownerCapacity)||ownerCapacity<1)throw new RangeError('ledger-capacity');this.capacity=capacity;this.ownerCapacity=ownerCapacity}
 get size():number{return this.events.size}
 open(id:number):'opened'|EventFailure {
  if(!Number.isSafeInteger(id)||id<1)return'invalid-event'
  if(id<=this.last)return'stale-event'
  if(this.events.size>=this.capacity)return'event-capacity'
  this.events.set(id,new Set());this.last=id;return'opened'
 }
 check(id:number,owner:number):'ready'|'duplicate'|EventFailure {
  if(!Number.isSafeInteger(id)||id<1)return'invalid-event'
  if(!Number.isSafeInteger(owner)||owner<1)return'invalid-owner'
  const event=this.events.get(id);if(!event)return'unknown-event'
  if(event.has(owner))return'duplicate'
  return event.size>=this.ownerCapacity?'owner-capacity':'ready'
 }
 claim(id:number,owner:number):'claimed'|'duplicate'|EventFailure {const status=this.check(id,owner);if(status!=='ready')return status;this.events.get(id)!.add(owner);return'claimed'}
 close(id:number):'closed'|'unknown-event' {return this.events.delete(id)?'closed':'unknown-event'}
}
export interface DamageState {id:number;hp:number;parts:Record<PartId,number>;kills:number}
export function createDamageState(id:number,hp:number,partHP:number):DamageState {
 if(!Number.isSafeInteger(id)||id<1||!finite(hp,partHP)||hp<=0||partHP<=0)throw new RangeError('damage-state')
 return{id,hp,parts:Object.fromEntries(PART_IDS.map(p=>[p,partHP]))as Record<PartId,number>,kills:0}
}
export type DamageResult={status:'hit';contact:Contact;parentDamage:number;partDamage:number}|{status:EventFailure|'duplicate'|'dead'|'miss'|'invalid-damage'|'owner-mismatch'}
/** Caller supplies one already-rolled base damage. No critical roll, reward or per-part Mob. */
export function resolveHit(actor:DamageState,pose:ImugiPose,shape:Shape,damage:number,eventID:number,ledger:DamageLedger):DamageResult {
 const status=ledger.check(eventID,actor.id);if(status!=='ready')return{status}
 if(actor.id!==pose.ownerId)return{status:'owner-mismatch'}
 if(actor.hp<=0)return{status:'dead'}
 if(!finite(damage)||damage<=0)return{status:'invalid-damage'}
 const hit=pickContact({...pose,parts:pose.parts.filter(p=>actor.parts[p.id]>0||p.id==='head'||p.id==='root')},shape)
 if(!hit)return{status:'miss'}
 const claim=ledger.claim(eventID,actor.id);if(claim!=='claimed')return{status:claim}
 const partDamage=Math.min(actor.parts[hit.partId],damage),parentDamage=Math.min(actor.hp,damage*hit.weakScale)
 actor.parts[hit.partId]-=partDamage;actor.hp-=parentDamage
 if(actor.hp===0)actor.kills++
 return{status:'hit',contact:hit,parentDamage,partDamage}
}
