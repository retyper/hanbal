/** 55 read-only continuous UV view. Raw part pixels are preserved; sim owns every socket/hazard. */
import {HAEBI_GIANT as G,HAEBI_FX as K} from '../tune/params.ts'
import type {Point,PartId,PartPose,ImugiPose,Shape} from './giant-core.ts'
import {IMUGI_ART} from './imugi-art.ts'
export interface WorldRect {readonly left:number;readonly top:number;readonly right:number;readonly bottom:number}
export interface View {readonly bounds:WorldRect;readonly density:number}
export interface RibbonQuad {readonly from:PartId;readonly to:PartId;readonly world:readonly Point[];readonly uv:readonly Point[]}
export interface Ribbon {readonly quads:readonly RibbonQuad[];readonly overflow:boolean;readonly coarse?:boolean}
// Shared visual params; source pixel coordinates below are immutable asset metadata.
const {maxQuads:MAX_QUADS,perEdge:PER_EDGE,period:PERIOD}=G.view
const SX=263,SY=350,SW=608
const chain:readonly PartId[]=['neck-top','neck-mid','neck-base','root','body1','body2','body3','tail1','tail2','tail3']
const widths=G.view.widths
const widthScale=(p:PartPose|undefined)=>(p as (PartPose & {readonly widthScale?:number})|undefined)?.widthScale??1
const widthAt=(p:PartPose|undefined,i:number)=>widths[i]!*widthScale(p)
// MD55: a broken part bends and seals its move; its visible collapsed skin stays attached.
const shown=(p:PartPose|undefined):p is PartPose=>!!p&&p.alive&&p.visible
const point=(x:number,y:number):Point=>({x,y})
const mix=(a:number,b:number,t:number)=>a+(b-a)*t
function curve(a:Point,b:Point,c:Point,d:Point,t:number):Point {
 const q=(x:number,y:number,z:number,w:number)=>.5*(2*y+(-x+z)*t+(2*x-5*y+4*z-w)*t*t+(-x+3*y-3*z+w)*t*t*t)
 return point(q(a.x,b.x,c.x,d.x),q(a.y,b.y,c.y,d.y))
}
/** Same source and canonical start phase; bounded coarse strips keep a pathological actor visible.
 * In coarse mode repeated interior periods are intentionally compressed, never sampled outside the native UV rect. */
export function buildRibbon(pose:ImugiPose,density:number):Ribbon {
 const fine=fineRibbon(pose,density);if(!fine.overflow&&fine.quads.length)return fine
 const byId=new Map(pose.parts.map(p=>[p.id,p])),quads:RibbonQuad[]=[];let phase=0
 for(let i=0;i<chain.length-1;i++){
  const a=byId.get(chain[i]!),b=byId.get(chain[i+1]!);if(!a||!b)continue
  const pa=a.id==='root'?a.start:a.end,pb=b.id==='root'?b.start:b.end,dx=pb.x-pa.x,dy=pb.y-pa.y,length=Math.hypot(dx,dy),w0=widthAt(a,i),w1=widthAt(b,i+1),start=phase
  phase+=length*SW/((w0+w1)/2)
  if(!shown(a)||!shown(b)||!(a.parent===b.id||b.parent===a.id)||!Number.isFinite(length)||!length)continue
  const nx=dy/length,ny=-dx/length,y0=SY+((start%PERIOD)+PERIOD)%PERIOD,y1=Math.min(SY+PERIOD,y0+phase-start)
  quads.push({from:a.id,to:b.id,world:[point(pa.x-nx*w0/2,pa.y-ny*w0/2),point(pa.x+nx*w0/2,pa.y+ny*w0/2),point(pb.x+nx*w1/2,pb.y+ny*w1/2),point(pb.x-nx*w1/2,pb.y-ny*w1/2)],uv:[point(SX,y0),point(SX+SW,y0),point(SX+SW,y1),point(SX,y1)]})
 }
 return {quads,overflow:false,coarse:true}
}

export function imugiVisualBounds(pose:ImugiPose):WorldRect|null {
 const mesh=buildRibbon(pose,1),points:Point[]=[];for(const q of mesh.quads)points.push(...q.world)
 for(let i=0;i<chain.length;i++){const p=pose.parts.find(p=>p.id===chain[i]);if(shown(p)&&!mesh.quads.some(q=>q.from===p.id||q.to===p.id)){const x=(p.start.x+p.end.x)/2,y=(p.start.y+p.end.y)/2,w=widthAt(p,i),r=Math.max(w,PERIOD*w/SW)/2;points.push(point(x-r,y-r),point(x+r,y+r))}}
 for(const a of assets){const p=pose.parts.find(p=>p.id===a.id);if(shown(p)){const[x,y,w,h]=a.rect;for(const q of [point(x,y),point(x+w,y),point(x+w,y+h),point(x,y+h)])points.push(assetPoint(p,a,q))}}
 if(!points.length){const p=pose.parts.find(p=>p.id==='root');if(shown(p))points.push(point(p.start.x-widths[3]!/2,p.start.y-widths[3]!/2),point(p.start.x+widths[3]!/2,p.start.y+widths[3]!/2))}
 return points.length?{left:Math.min(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))}:null
}

const parentViews=new WeakMap<ReadonlyMap<string,HTMLImageElement>,ReturnType<typeof createImugiView>>()
export interface ImugiViewState {readonly pose:ImugiPose;readonly partHP:Readonly<Record<PartId,number>>;readonly partMax:Readonly<Record<PartId,number>>}
export function drawImugiParent(ctx:CanvasRenderingContext2D,images:ReadonlyMap<string,HTMLImageElement>,state:ImugiViewState,view:View):boolean {
 let renderer=parentViews.get(images);if(!renderer?.ready){renderer=createImugiView(images);parentViews.set(images,renderer)}
 const drew=renderer.draw(ctx,state.pose,view);if(!drew)return false
 const v=G.view
 ctx.save();try{for(const p of state.pose.parts){const hp=state.partHP[p.id],max=state.partMax[p.id];if(!shown(p)||p.id==='root'||!(max>0&&hp>0&&hp<max))continue
  const x=Math.max(view.bounds.left,Math.min(view.bounds.right-v.partHpWidth,p.start.x-v.partHpWidth/2)),y=Math.max(view.bounds.top,Math.min(view.bounds.bottom-v.partHpHeight,p.start.y-v.partHpLift))
  ctx.fillStyle=K.foe.rimDark;ctx.fillRect(x,y,v.partHpWidth,v.partHpHeight);ctx.fillStyle=K.own.rim;ctx.fillRect(x,y,v.partHpWidth*hp/max,v.partHpHeight)
 }}finally{ctx.restore()}return true
}

/** Render exactly the frozen sim geometry; no attack-specific guessed radii or renderer clock. */
export function drawImugiThreats(ctx:CanvasRenderingContext2D,shapes:readonly Shape[]):void {
 const TAU=Math.PI*2
 const paint=(s:Shape):void=>{
  if(s.kind==='union'){for(const child of s.shapes)paint(child);return}
  ctx.beginPath()
  if(s.kind==='ellipse')ctx.ellipse(s.center.x,s.center.y,s.rx,s.ry,s.angle,0,TAU)
  else if(s.kind==='circle')ctx.arc(s.center.x,s.center.y,s.radius,0,TAU)
  else if(s.kind==='box'){
   const c=Math.cos(s.angle),t=Math.sin(s.angle)
   for(const [i,q]of [[-s.halfX,-s.halfY],[s.halfX,-s.halfY],[s.halfX,s.halfY],[-s.halfX,s.halfY]].entries()){const x=s.center.x+c*q[0]!-t*q[1]!,y=s.center.y+t*q[0]!+c*q[1]!;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)}ctx.closePath()
  }else if(s.kind==='diskCap'){
   if(s.radius===0)return
   const half=Math.acos(Math.max(-1,Math.min(1,s.minAlong/s.radius)));ctx.arc(s.center.x,s.center.y,s.radius,s.angle-half,s.angle+half);ctx.closePath()
  }
  else if(s.kind==='capsule'||s.kind==='line'){
   const r=s.kind==='line'?s.width/2:s.radius,a=Math.atan2(s.to.y-s.from.y,s.to.x-s.from.x),nx=-Math.sin(a)*r,ny=Math.cos(a)*r
   ctx.moveTo(s.from.x+nx,s.from.y+ny);ctx.lineTo(s.to.x+nx,s.to.y+ny);ctx.arc(s.to.x,s.to.y,r,a+Math.PI/2,a-Math.PI/2,true);ctx.lineTo(s.from.x-nx,s.from.y-ny);ctx.arc(s.from.x,s.from.y,r,a-Math.PI/2,a+Math.PI/2,true);ctx.closePath()
  }else{
   const inner=s.kind==='cone'?0:s.inner,outer=s.kind==='cone'?s.radius:s.outer,start=s.kind==='annulus'?0:s.angle-s.halfAngle,end=s.kind==='annulus'?TAU:s.angle+s.halfAngle
   ctx.moveTo(s.center.x+Math.cos(start)*outer,s.center.y+Math.sin(start)*outer);ctx.arc(s.center.x,s.center.y,outer,start,end)
   if(inner){ctx.lineTo(s.center.x+Math.cos(end)*inner,s.center.y+Math.sin(end)*inner);ctx.arc(s.center.x,s.center.y,inner,end,start,true)}else ctx.lineTo(s.center.x,s.center.y)
   ctx.closePath()
  }
  ctx.save();ctx.globalAlpha*=K.foe.fillAlpha;ctx.fillStyle=K.foe.line;ctx.fill('evenodd');ctx.restore();ctx.strokeStyle=K.foe.line;ctx.lineWidth=K.foe.rimWidth;ctx.stroke()
 }
 ctx.save();try{for(const s of shapes)paint(s)}finally{ctx.restore()}
}
/** Pure bounded visual mesh, never authoritative collision/hazard geometry. */
function fineRibbon(pose:ImugiPose,density:number):Ribbon {
 const map=new Map(pose.parts.map(p=>[p.id,p])),nodes=chain.map(id=>map.get(id))
 if(nodes.some(p=>!p))return {quads:[],overflow:false}
 const pos=nodes.map(p=>p!.id==='root'?p!.start:p!.end)
 if(pos.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return {quads:[],overflow:true}
 const eligible=nodes.slice(0,-1).map((a,i)=>{const b=nodes[i+1]!;return shown(a)&&shown(b)&&(a.parent===b.id||b.parent===a.id)})
 const quads:RibbonQuad[]=[];let phase=0
 const lod=Number.isFinite(density)?Math.max(G.view.densityMin,Math.min(G.view.densityMax,density)):1
 for(let i=0;i<pos.length-1;i++) {
  const p0=pos[Math.max(0,i-1)]!,p1=pos[i]!,p2=pos[i+1]!,p3=pos[Math.min(pos.length-1,i+2)]!
  const sample=(t:number,render=false)=>curve(render&&!eligible[i-1]?p1:p0,p1,p2,render&&!eligible[i+1]?p2:p3,t)
  const width=(t:number)=>mix(widthAt(nodes[i],i),widthAt(nodes[i+1],i+1),t*t*(3-2*t))
  // Canonical phase ignores damage, visibility and LOD; do not reset after a broken interval.
  const phases=[phase];let last=p1,length=0
  for(let k=1;k<=PER_EDGE;k++){const t=k/PER_EDGE,p=sample(t),ds=Math.hypot(p.x-last.x,p.y-last.y);length+=ds;phase+=ds*SW/((width(t)+width((k-1)/PER_EDGE))/2);phases.push(phase);last=p}
  if(!eligible[i])continue
  const vAt=(t:number)=>{const k=Math.min(PER_EDGE-1,Math.floor(t*PER_EDGE));return mix(phases[k]!,phases[k+1]!,t*PER_EDGE-k)}
  const edge=(t:number):readonly Point[]=>{const p=sample(t,true),a=sample(Math.max(0,t-.001),true),b=sample(Math.min(1,t+.001),true),dx=b.x-a.x,dy=b.y-a.y,n=Math.hypot(dx,dy)||1,w=width(t)/2;return [point(p.x-dy/n*w,p.y+dx/n*w),point(p.x+dy/n*w,p.y-dx/n*w)]}
  const count=Math.max(1,Math.min(PER_EDGE,Math.ceil(length*lod/G.view.screenStep)))
  for(let k=0;k<count;k++){
   const ta=k/count,tb=(k+1)/count,va=vAt(ta),vb=vAt(tb)
   if(vb-va>PERIOD*MAX_QUADS)return {quads:[],overflow:true}
   const splits=[{t:ta,v:va}]
   for(let v=(Math.floor(va/PERIOD)+1)*PERIOD;v<vb-1e-7;v+=PERIOD)splits.push({t:mix(ta,tb,(v-va)/(vb-va)),v})
   splits.push({t:tb,v:vb})
   for(let j=0;j<splits.length-1;j++){
    if(quads.length>=MAX_QUADS)return {quads:[],overflow:true}
    const a=splits[j]!,b=splits[j+1]!,period=Math.floor((a.v+1e-7)/PERIOD),y0=SY+Math.max(0,Math.min(PERIOD,a.v-period*PERIOD)),y1=SY+Math.max(0,Math.min(PERIOD,b.v-period*PERIOD)),aa=edge(a.t),bb=edge(b.t)
    quads.push({from:chain[i]!,to:chain[i+1]!,world:[aa[0]!,aa[1]!,bb[1]!,bb[0]!],uv:[point(SX,y0),point(SX+SW,y0),point(SX+SW,y1),point(SX,y1)]})
   }
  }
 }
 return {quads,overflow:false}
}
type NativeKey='head-upper'|'jaw-lower'|'neck-segment'|'tail-tip'
const assets:readonly {id:PartId;key:NativeKey;pivot:Point;scale:number;basis:number;rect:readonly [number,number,number,number]}[]=[
 {id:'tail-tip',key:'tail-tip',pivot:point(350,270),scale:G.view.tipScale,basis:-Math.atan2(605,1060),rect:[87,62,1362,898]},
 {id:'jaw',key:'jaw-lower',pivot:point(470,330),scale:G.view.jawScale,basis:0,rect:[416,238,942,441]},
 {id:'head',key:'head-upper',pivot:point(525,575),scale:G.view.headScale,basis:0,rect:[258,158,1041,697]},
]
function assetPoint(p:PartPose,a:typeof assets[number],q:Point):Point {const bc=Math.cos(a.basis),bs=Math.sin(a.basis),qx=q.x-a.pivot.x,qy=q.y-a.pivot.y,x=(bc*qx-bs*qy)*a.scale,y=(bs*qx+bc*qy)*a.scale*(p.mirrorY??1),c=Math.cos(p.angle),s=Math.sin(p.angle);return point(p.start.x+c*x-s*y,p.start.y+s*x+c*y)}
const intersects=(a:WorldRect,b:WorldRect)=>a.right>=b.left&&a.left<=b.right&&a.bottom>=b.top&&a.top<=b.bottom
function triangle(ctx:CanvasRenderingContext2D,image:CanvasImageSource,uv:readonly Point[],dst:readonly Point[]) {
 const s0=uv[0]!,s1=uv[1]!,s2=uv[2]!,d0=dst[0]!,d1=dst[1]!,d2=dst[2]!,x1=s1.x-s0.x,y1=s1.y-s0.y,x2=s2.x-s0.x,y2=s2.y-s0.y,det=x1*y2-x2*y1
 if(Math.abs(det)<1e-7)return
 const dx1=d1.x-d0.x,dy1=d1.y-d0.y,dx2=d2.x-d0.x,dy2=d2.y-d0.y
 if(Math.abs(dx1*dy2-dx2*dy1)<1e-7)return
 const a=(dx1*y2-dx2*y1)/det,c=(x1*dx2-x2*dx1)/det,b=(dy1*y2-dy2*y1)/det,d=(x1*dy2-x2*dy1)/det,e=d0.x-a*s0.x-c*s0.y,f=d0.y-b*s0.x-d*s0.y
 ctx.save();try{ctx.beginPath();ctx.moveTo(d0.x,d0.y);ctx.lineTo(d1.x,d1.y);ctx.lineTo(d2.x,d2.y);ctx.closePath();ctx.clip();ctx.transform(a,b,c,d,e,f);ctx.drawImage(image,0,0)}finally{ctx.restore()}
}
/** Already decoded originals supplied by caller. No network/DOM/RNG/local clock. One call per parent. */
export function createImugiView(images:ReadonlyMap<string,CanvasImageSource>) {
 const sources=new Map<NativeKey,CanvasImageSource>()
 for(const key of ['head-upper','jaw-lower','neck-segment','tail-tip'] as const){const image=images.get(IMUGI_ART[key])??images.get(key);if(image)sources.set(key,image)}
 let disposed=false,lastKey='',cached:Ribbon={quads:[],overflow:false}
 return {
  get ready(){return !disposed&&sources.size===4},
  draw(ctx:CanvasRenderingContext2D,pose:ImugiPose,view:View):boolean {
   if(disposed||sources.size!==4)return false
   const key=pose.ownerId+':'+pose.tick+':'+view.density+':'+pose.parts.map(p=>[p.id,p.start.x,p.start.y,p.end.x,p.end.y,p.alive,p.broken,p.visible,widthScale(p)].join(',')).join(';')
   if(key!==lastKey){cached=buildRibbon(pose,view.density);lastKey=key}
   const byId=new Map(pose.parts.map(p=>[p.id,p])),points:Point[]=[]
   for(const q of cached.quads)points.push(...q.world)
   for(let i=0;i<chain.length;i++){const p=byId.get(chain[i]!);if(shown(p)&&!cached.quads.some(q=>q.from===p.id||q.to===p.id)){const x=(p.start.x+p.end.x)/2,y=(p.start.y+p.end.y)/2,w=widthAt(p,i),r=Math.max(w,PERIOD*w/SW)/2;points.push(point(x-r,y-r),point(x+r,y+r))}}
   for(const a of assets){const p=byId.get(a.id);if(shown(p)){const [x,y,w,h]=a.rect;for(const q of [point(x,y),point(x+w,y),point(x+w,y+h),point(x,y+h)])points.push(assetPoint(p,a,q))}}
   if(!points.length){const root=byId.get('root');if(shown(root))points.push(point(root.start.x-widths[3]!/2,root.start.y-widths[3]!/2),point(root.start.x+widths[3]!/2,root.start.y+widths[3]!/2))}
   if(!points.length)return false
   const bounds={left:Math.min(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))}
   if(!intersects(bounds,view.bounds))return false
   ctx.save();try{
    ctx.imageSmoothingEnabled=false
    for(const q of cached.quads)for(const t of [[0,1,2],[0,2,3]])triangle(ctx,sources.get('neck-segment')!,t.map(i=>q.uv[i]!),t.map(i=>q.world[i]!))
    // Mouth remains a separate read-only part; cavity quality is verified in actual pose screenshots.
    for(let i=0;i<chain.length;i++){const p=byId.get(chain[i]!);if(!shown(p)||cached.quads.some(q=>q.from===p.id||q.to===p.id))continue;ctx.save();try{ctx.translate((p.start.x+p.end.x)/2,(p.start.y+p.end.y)/2);ctx.rotate(p.angle+Math.PI/2);const z=widthAt(p,i)/SW;ctx.scale(z,z*(p.mirrorY??1));ctx.drawImage(sources.get('neck-segment')!,SX,SY,SW,PERIOD,-SW/2,-PERIOD/2,SW,PERIOD)}finally{ctx.restore()}}
    for(const a of assets){const p=byId.get(a.id);if(!shown(p))continue;const [x,y,w,h]=a.rect;ctx.save();try{ctx.translate(p.start.x,p.start.y);ctx.rotate(p.angle);ctx.scale(a.scale,a.scale*(p.mirrorY??1));ctx.rotate(a.basis);ctx.drawImage(sources.get(a.key)!,x,y,w,h,x-a.pivot.x,y-a.pivot.y,w,h)}finally{ctx.restore()}}
   }finally{ctx.restore()}
   return true
  },
  dispose(){disposed=true;sources.clear();cached={quads:[],overflow:false};lastKey=''},
 }
}

/** A short moving water highlight over the sim's active capsule. It creates no damage geometry or clock. */
export function drawImugiWater(ctx:CanvasRenderingContext2D,attack:Readonly<{front?:Point;activeShapes?:readonly Shape[]}>):void {
 const front=attack.front;if(!front||!attack.activeShapes?.length)return
 const paint=(s:Shape):void=>{
  if(s.kind==='union'){for(const child of s.shapes)paint(child);return}
  if(s.kind!=='capsule'||s.radius<=0)return
  ctx.strokeStyle=G.view.waterOuter;ctx.lineWidth=s.radius*2*G.view.waterOuterShare
  ctx.beginPath();ctx.moveTo(s.from.x,s.from.y);ctx.lineTo(s.to.x,s.to.y);ctx.stroke()
  ctx.strokeStyle=G.view.waterCore;ctx.lineWidth=s.radius*2*G.view.waterCoreShare
  ctx.beginPath();ctx.moveTo(s.from.x,s.from.y);ctx.lineTo(front.x,front.y);ctx.stroke()
 }
 ctx.save();try{ctx.globalAlpha*=G.view.waterAlpha;ctx.lineCap='round';ctx.lineJoin='round';for(const s of attack.activeShapes)paint(s)}finally{ctx.restore()}
}
