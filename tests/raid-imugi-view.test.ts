import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHaebi,spawnMob} from '../src/raid/haebi.ts'
import {drawField} from '../src/raid/haebi-view.ts'
import {makePose,PART_IDS,type ImugiPose,type Shape} from '../src/raid/giant-core.ts'
import {buildRibbon,createImugiView,drawImugiParent,drawImugiThreats,imugiVisualBounds} from '../src/raid/imugi-view.ts'
import {createImugi,updateImugiPose,type ImugiMove} from '../src/raid/imugi.ts'
import {IMUGI_ART,prewarmImugiArt,imugiArtReady} from '../src/raid/imugi-art.ts'
import {HAEBI_GIANT as G} from '../src/tune/params.ts'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
function canvas(){
 const calls:{method:string;args:unknown[];width:number;color:unknown;path:{method:string;args:unknown[]}[]}[]=[],p:Record<string|symbol,unknown>={canvas:{width:2240,height:1440},globalAlpha:1,lineWidth:1},stack:Record<string|symbol,unknown>[]=[]
 let path:{method:string;args:unknown[]}[]=[]
 return{calls,ctx:new Proxy(p,{get(o,k){if(k in o)return o[k];return(...a:unknown[])=>{
  if(k==='save')stack.push({...p});if(k==='restore')Object.assign(p,stack.pop());if(k==='beginPath')path=[]
  if(['moveTo','lineTo','arc','ellipse'].includes(String(k)))path.push({method:String(k),args:a})
  calls.push({method:String(k),args:a,width:Number(p.lineWidth),color:p.strokeStyle,path:[...path]})
  if(k==='measureText')return{width:12};if(String(k).includes('Gradient'))return{addColorStop(){}}
 }},set(o,k,v){o[k]=v;return true}}) as unknown as CanvasRenderingContext2D}
}
const image=(id:string)=>({id,width:1800,height:1500,complete:true}) as unknown as HTMLImageElement
test('55 actual drawField never draws a human sprite for a giant parent',()=>{
 const s=createHaebi(55,'stage','sword',{stage:'ford'});spawnMob(s,'boss');const e=s.enemies[0]!
 Object.assign(e,{giant:{kind:'imugi',state:'body',pose:{parts:[],worldGeometry:{parts:[],tell:[]}},partHP:{},partMax:{},attack:null}})
 const images=new Map([['anim-px/boss-ford.png',image('human')],['anim-px/bandit-warlord.png',image('human')]])
 const c=canvas();drawField(c.ctx,images,s,null)
 assert.equal(c.calls.filter(x=>x.method==='drawImage'&&(x.args[0] as {id?:string})?.id==='human').length,0)
})
const loaded=()=>new Map(Object.entries(IMUGI_ART).map(([id,path])=>[path,image(id)]))
const viewport={bounds:{left:-1e12,top:-1e12,right:1e12,bottom:1e12},density:2}
const pose=(extra:Parameters<typeof makePose>[0]={ownerId:1,tick:0,x:500,y:400})=>makePose(extra)
test('55 actual renderer: mirror uses localY once; auxiliary height never moves world sockets twice',()=>{
 const a=pose(),b:ImugiPose={...a,parts:a.parts.map(p=>({...p,height:999}))},ca=canvas(),cb=canvas();createImugiView(loaded()).draw(ca.ctx,a,viewport);createImugiView(loaded()).draw(cb.ctx,b,viewport);assert.deepEqual(ca.calls,cb.calls)
 const m=pose({ownerId:1,tick:0,x:500,y:400,mirrorY:-1,jawOpen:.5}),cm=canvas();createImugiView(loaded()).draw(cm.ctx,m,viewport)
 assert.ok(cm.calls.some(c=>c.method==='scale'&&c.args[0]===G.view.headScale&&c.args[1]===-G.view.headScale))
 assert.ok(cm.calls.some(c=>c.method==='rotate'&&c.args[0]===m.parts.find(p=>p.id==='jaw')!.angle))
 for(const id of ['head-upper','jaw-lower','tail-tip'])assert.equal(cm.calls.filter(c=>c.method==='drawImage'&&(c.args[0] as {id?:string})?.id===id).length,1)
})
test('55 broken but visible collapsed skin keeps both original neighboring edges and is not a new target',()=>{
 const a=pose(),collapsed:ImugiPose={...a,parts:a.parts.map(p=>p.id==='neck-mid'?{...p,broken:true,damaged:true,visible:true,targetable:false}:p)},before=JSON.stringify(collapsed),mesh=buildRibbon(collapsed,2)
 assert.ok(mesh.quads.some(q=>q.from==='neck-top'&&q.to==='neck-mid'),'broken visible neck upper edge must remain')
 assert.ok(mesh.quads.some(q=>q.from==='neck-mid'&&q.to==='neck-base'),'broken visible neck lower edge must remain')
 assert.deepEqual(mesh.quads.map(q=>q.uv),buildRibbon(a,2).quads.map(q=>q.uv))
 const c=canvas();assert.equal(createImugiView(loaded()).draw(c.ctx,collapsed,viewport),true);assert.equal(JSON.stringify(collapsed),before)
 assert.equal(c.calls.filter(c=>c.method==='drawImage'&&(c.args[0] as {id?:string})?.id==='head-upper').length,1)
})
test('55 genuinely hidden/missing neighbors never bridge; surviving canonical UV remains unchanged',()=>{
 const a=buildRibbon(pose(),2),b=buildRibbon(pose({ownerId:1,tick:0,x:500,y:400,hidden:['body2','neck-mid']}),2)
 assert.ok(!b.quads.some(q=>q.from==='body2'||q.to==='body2'||q.from==='neck-mid'||q.to==='neck-mid'||q.from==='body1'&&q.to==='body3'))
 assert.deepEqual(b.quads.filter(q=>q.from==='body3').map(q=>q.uv),a.quads.filter(q=>q.from==='body3').map(q=>q.uv))
 const missing:ImugiPose={...pose(),parts:pose().parts.filter(p=>p.id!=='body2')};assert.ok(!buildRibbon(missing,2).quads.some(q=>q.from==='body1'&&q.to==='body3'))
 const dead=pose({ownerId:1,tick:0,x:500,y:400,alive:false}),c=canvas();assert.equal(createImugiView(loaded()).draw(c.ctx,dead,viewport),false);assert.equal(c.calls.length,0)
})
test('55 sim-authored neck widthScale expands skin cross-sections and bounds without repainting native parts',()=>{
 const a=pose(),b:ImugiPose={...a,parts:a.parts.map(p=>({...p,widthScale:p.id.startsWith('neck-')?1.3:1}))},ma=buildRibbon(a,2),mb=buildRibbon(b,2)
 const qa=ma.quads.find(q=>q.from==='neck-top')!,qb=mb.quads.find(q=>q.from==='neck-top')!
 const width=(q:typeof qa)=>Math.hypot(q.world[1]!.x-q.world[0]!.x,q.world[1]!.y-q.world[0]!.y)
 assert.ok(Math.abs(width(qb)-width(qa)*1.3)<1e-7,'skin must follow authoritative breathing width')
 const c=canvas(),renderer=createImugiView(loaded());renderer.draw(c.ctx,a,viewport);const first=c.calls.filter(c=>c.method==='transform').map(c=>c.args);c.calls.length=0;renderer.draw(c.ctx,b,viewport);assert.notDeepEqual(c.calls.filter(c=>c.method==='transform').map(c=>c.args),first,'mesh cache must include widthScale')
})
test('55 bounded high-density UV and pathological coarse fallback both draw visible native body',()=>{
 const normal=buildRibbon(pose(),1e9);assert.ok(normal.quads.length>0&&normal.quads.length<=G.view.maxQuads)
 const huge:ImugiPose={...pose(),parts:pose().parts.map(p=>({...p,start:{x:p.start.x*1e5,y:p.start.y*1e5},end:{x:p.end.x*1e5,y:p.end.y*1e5}}))},mesh=buildRibbon(huge,1e9)
 assert.equal(mesh.coarse,true);assert.ok(mesh.quads.length>0&&mesh.quads.length<=G.view.maxQuads)
 for(const q of mesh.quads)for(const uv of q.uv)assert.ok(uv.x>=263&&uv.x<=871&&uv.y>=350&&uv.y<=1050)
 const c=canvas();assert.equal(createImugiView(loaded()).draw(c.ctx,huge,viewport),true);assert.ok(c.calls.some(c=>c.method==='drawImage'&&(c.args[0] as {id?:string})?.id==='neck-segment'))
})
test('55 root residual and isolated live body remain visible; invisible submerged pose draws nothing',()=>{
 const p=pose({ownerId:1,tick:0,x:500,y:400,broken:PART_IDS,hidden:PART_IDS.filter(id=>id!=='root')}),c=canvas();assert.ok(p.parts.find(p=>p.id==='root')!.visible);assert.equal(createImugiView(loaded()).draw(c.ctx,p,viewport),true);assert.ok(c.calls.some(c=>c.method==='drawImage'&&(c.args[0] as {id?:string})?.id==='neck-segment'))
 const submerged=pose({ownerId:1,tick:0,x:500,y:400,hidden:PART_IDS}),d=canvas();assert.equal(createImugiView(loaded()).draw(d.ctx,submerged,viewport),false);assert.equal(d.calls.length,0)
})
test('55 shared frozen hazard shapes preserve circles/ellipse/capsule/cone and annular safe holes',()=>{
 const shapes:readonly Shape[]=[{kind:'circle',center:{x:90,y:100},radius:77},{kind:'ellipse',center:{x:200,y:100},rx:80,ry:35,angle:.2},{kind:'capsule',from:{x:300,y:100},to:{x:420,y:140},radius:24},{kind:'cone',center:{x:500,y:100},radius:150,angle:.5,halfAngle:.6},{kind:'annulus',center:{x:600,y:100},inner:40,outer:100},{kind:'arc',center:{x:700,y:100},inner:30,outer:90,angle:1,halfAngle:.8}]
 const before=JSON.stringify(shapes),c=canvas();drawImugiThreats(c.ctx,shapes);assert.equal(JSON.stringify(shapes),before)
 assert.ok(c.calls.some(c=>c.method==='arc'&&c.args[0]===90&&c.args[2]===77));assert.ok(c.calls.some(c=>c.method==='ellipse'&&c.args[2]===80&&c.args[3]===35&&c.args[4]===.2));assert.ok(c.calls.some(c=>c.method==='arc'&&c.args[0]===420&&c.args[2]===24));assert.ok(c.calls.some(c=>c.method==='arc'&&c.args[0]===600&&c.args[2]===40&&c.args[5]===true));assert.ok(c.calls.filter(c=>c.method==='fill').every(c=>c.args[0]==='evenodd'))
})
test('55 actual drawField body stage emits no red hazard; tell uses attack.shapes with no old radius95',()=>{
 for(const state of ['body','tell','strike'] as const){const s=createHaebi(55,'stage','sword',{stage:'ford'});spawnMob(s,'boss');const e=s.enemies[0]!,shape:Shape={kind:'circle',center:{x:777,y:333},radius:77},p=pose({ownerId:e.id,tick:0,x:e.x,y:e.y,tell:[shape]});Object.assign(e,{wind:.5,giant:{kind:'imugi',state,pose:p,partHP:Object.fromEntries(PART_IDS.map(id=>[id,80])),partMax:Object.fromEntries(PART_IDS.map(id=>[id,80])),attack:{shapes:[shape]}}});const c=canvas(),before=JSON.stringify(s);drawField(c.ctx,loaded(),s,null);assert.equal(JSON.stringify(s),before);assert.equal(c.calls.some(c=>c.method==='arc'&&c.args[0]===777&&c.args[2]===77),state!=='body');assert.ok(!c.calls.some(c=>c.method==='arc'&&c.args[0]===e.aimX&&c.args[2]===95))}
})
test('55 camera visual bounds include original crown and cull offscreen without changing pose',()=>{
 const p=pose(),before=JSON.stringify(p),b=imugiVisualBounds(p);assert.ok(b&&b.right>b.left);const c=canvas();assert.equal(createImugiView(loaded()).draw(c.ctx,p,{bounds:{left:-9999,top:-9999,right:-9000,bottom:-9000},density:1}),false);assert.equal(c.calls.length,0);assert.equal(JSON.stringify(p),before)
})
function factory(requests:string[],fail=false){return()=>{const img:Record<string,any>={complete:false,onload:null,onerror:null,decode:async()=>{if(fail)throw Error('decode')}};Object.defineProperty(img,'src',{set(src:string){requests.push(src);const key=Object.entries(IMUGI_ART).find(([,p])=>src.endsWith(p))![0],dims:Record<string,number[]>={'head-upper':[1536,1024],'jaw-lower':[1774,887],'neck-segment':[1145,1374],'tail-tip':[1536,1024]};img.width=img.naturalWidth=dims[key]![0];img.height=img.naturalHeight=dims[key]![1];img.complete=true;queueMicrotask(()=>img.onload?.())}});return img as unknown as HTMLImageElement}}
test('55 lazy prewarm downloads ford only once, decodes atomically, retries failure and leaves other stages alone',async()=>{
 const map=new Map<string,HTMLImageElement>(),requests:string[]=[];assert.equal(await prewarmImugiArt('forest',map,'/realm/',factory(requests)),true);assert.equal(requests.length,0)
 const a=prewarmImugiArt('ford',map,'/realm/',factory(requests)),b=prewarmImugiArt('ford',map,'/realm/',factory(requests));assert.equal(a,b);assert.equal(map.size,0);assert.equal(await a,true);assert.equal(requests.length,4);assert.equal(imugiArtReady(map),true);assert.equal(await prewarmImugiArt('ford',map,'/realm/',factory(requests)),true);assert.equal(requests.length,4)
 const bad=new Map<string,HTMLImageElement>();assert.equal(await prewarmImugiArt('ford',bad,'/realm/',factory([],true)),false);assert.equal(bad.size,0);assert.equal(await prewarmImugiArt('ford',bad,'/realm/',factory([])),true)
})
test('55 installed native candidates are byte-identical to all four warehouse originals',()=>{
 for(const id of Object.keys(IMUGI_ART)){const a=readFileSync('public/realm/raid/giants/imugi/'+id+'.png'),b=readFileSync('D:/에셋창고/55-imugi-'+id+'-01-native.png');assert.equal(createHash('sha256').update(a).digest('hex'),createHash('sha256').update(b).digest('hex'))}
})
test('55 native head/jaw sockets land on mirrored authoritative world endpoints, not a second jawOpen',()=>{
 for(const side of [1,-1] as const){const p=pose({ownerId:1,tick:0,x:500,y:400,angle:2.7,mirrorY:side,height:80,jawOpen:.65}),seen=new Map<string,number[]>();let m=[1,0,0,1,0,0];const stack:number[][]=[]
  const multiply=(n:number[])=>{const[a,b,c,d,e,f]=m as [number,number,number,number,number,number],[g,h,i,j,k,l]=n as [number,number,number,number,number,number];m=[a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f]}
  const c=new Proxy({},{get(_o,key){return(...v:unknown[])=>{if(key==='save')stack.push([...m]);else if(key==='restore')m=stack.pop()!;else if(key==='translate')multiply([1,0,0,1,Number(v[0]),Number(v[1])]);else if(key==='scale')multiply([Number(v[0]),0,0,Number(v[1]),0,0]);else if(key==='rotate'){const a=Number(v[0]);multiply([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0])}else if(key==='transform')multiply(v as number[]);else if(key==='drawImage')seen.set((v[0] as {id:string}).id,[...m])}},set(){return true}}) as unknown as CanvasRenderingContext2D
  createImugiView(loaded()).draw(c,p,viewport)
  for(const[id,raw,idPose]of [['head-upper',[235,85],'head'],['jaw-lower',[840,245],'jaw']] as const){const t=seen.get(id)!,target=p.parts.find(p=>p.id===idPose)!.end;assert.ok(Math.abs(t[0]!*raw[0]+t[2]!*raw[1]+t[4]!-target.x)<1e-7);assert.ok(Math.abs(t[1]!*raw[0]+t[3]!*raw[1]+t[5]!-target.y)<1e-7)}
 }
})
test('55 exact rectangular hazards have no rounded damage corners; disk-cap has the original clipping chord',()=>{
 const c=canvas();drawImugiThreats(c.ctx,[{kind:'box',center:{x:100,y:200},halfX:80,halfY:12,angle:0},{kind:'diskCap',center:{x:400,y:200},radius:90,angle:.5,minAlong:30}]);assert.ok(c.calls.some(c=>c.method==='moveTo'&&c.args[0]===20&&c.args[1]===188));assert.ok(c.calls.some(c=>c.method==='lineTo'&&c.args[0]===180&&c.args[1]===212));const arc=c.calls.find(c=>c.method==='arc'&&c.args[0]===400)!;assert.equal(arc.args[2],90);assert.equal(arc.args[3],.5-Math.acos(30/90));assert.equal(arc.args[4],.5+Math.acos(30/90))
})
test('55 residual root bounds remain included beside surviving head; zero-area disk-cap never emits NaN',()=>{
 const p=pose({ownerId:1,tick:0,x:500,y:400,broken:PART_IDS}),r=p.parts.find(p=>p.id==='root')!,b=imugiVisualBounds(p)!;assert.ok(b.left<=r.start.x-G.view.widths[3]/2&&b.right>=r.start.x+G.view.widths[3]/2)
 const c=canvas();drawImugiThreats(c.ctx,[{kind:'diskCap',center:{x:1,y:2},radius:0,angle:0,minAlong:0}]);assert.ok(c.calls.every(c=>c.args.every(a=>typeof a!=='number'||Number.isFinite(a))))
})
test('55 six actual sim body/tell/recover poses render read-only; submerged visibility stays authoritative',()=>{
 for(const move of Object.keys(G.moves) as ImugiMove[]){const owner={id:55,x:700,y:400,hp:G.hp,max:G.hp},g=createImugi(owner)
  for(const state of ['body','tell','recover'] as const){g.pattern=move;g.state=state;updateImugiPose(g,owner,20);const before=JSON.stringify(g),c=canvas();drawImugiParent(c.ctx,loaded(),g,viewport);assert.equal(JSON.stringify(g),before)
   if(g.pose.parts.some(p=>p.visible))assert.ok(c.calls.some(c=>c.method==='drawImage'));else assert.ok(!c.calls.some(c=>c.method==='drawImage'))
  }
 }
 const single=pose({ownerId:1,tick:0,x:500,y:400,hidden:PART_IDS.filter(id=>id!=='body2')}),c=canvas();assert.equal(createImugiView(loaded()).draw(c.ctx,single,viewport),true);assert.ok(c.calls.some(c=>c.method==='drawImage'&&(c.args[0] as {id?:string})?.id==='neck-segment'))
 const missing:ImugiPose={...pose(),parts:pose().parts.filter(p=>p.id!=='body2')},d=canvas();assert.equal(createImugiView(loaded()).draw(d.ctx,missing,viewport),true);assert.ok(d.calls.some(c=>c.method==='drawImage'&&(c.args[0] as {id?:string})?.id==='neck-segment'))
})

test('55 actual strike water light follows sim front/active capsule while frozen full red shape stays unchanged',()=>{
 const s=createHaebi(55,'stage','sword',{stage:'ford'});spawnMob(s,'boss');const e=s.enemies[0]!,front={x:600,y:300},full:Shape={kind:'capsule',from:{x:400,y:300},to:{x:800,y:300},radius:40},active:Shape={kind:'capsule',from:{x:550,y:300},to:front,radius:40}
 const giant={kind:'imugi',state:'strike',pose:pose(),partHP:Object.fromEntries(PART_IDS.map(id=>[id,80])),partMax:Object.fromEntries(PART_IDS.map(id=>[id,80])),attack:{shapes:[full],activeShapes:[active],front}}
 Object.assign(e,{giant});const before=JSON.stringify(giant),c=canvas();drawField(c.ctx,loaded(),s,null);assert.equal(JSON.stringify(giant),before)
 const water=c.calls.find(c=>c.method==='stroke'&&c.color===G.view.waterCore)
 assert.ok(water,'strike must show the sim-owned moving water front')
 assert.ok(water.path.some(p=>p.method==='lineTo'&&p.args[0]===front.x&&p.args[1]===front.y));assert.equal(water.width,active.radius*2*G.view.waterCoreShare)
 assert.ok(c.calls.some(c=>c.method==='arc'&&c.args[0]===800&&c.args[2]===40),'red full capsule endpoint stays fixed')
 giant.state='tell';const d=canvas();drawField(d.ctx,loaded(),s,null);assert.ok(!d.calls.some(c=>c.method==='stroke'&&c.color===G.view.waterCore))
})
