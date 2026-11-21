// Controlled renderer fixture; no browser or actual-user-save claim.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHaebi,spawnGiant,stepHaebi,type HaebiRun} from '../src/raid/haebi.ts'
import {updateImugiPose} from '../src/raid/imugi.ts'
import {drawField} from '../src/raid/haebi-view.ts'
import {RaidEnding} from '../src/raid/ending.ts'
const image=(path:string)=>({path,width:5120,height:256,complete:true}) as unknown as HTMLImageElement
function canvas(){
 const images:(string|null)[]=[],state:Record<string|symbol,unknown>={canvas:{width:1120,height:720},globalAlpha:1,lineWidth:1},stack:Record<string|symbol,unknown>[]=[]
 const ctx=new Proxy(state,{get(o,k){if(k in o)return o[k];return(...args:unknown[])=>{if(k==='save')stack.push({...state});else if(k==='restore')Object.assign(state,stack.pop());else if(k==='drawImage')images.push((args[0] as {path?:string}|undefined)?.path??null);else if(k==='measureText')return{width:12};else if(String(k).includes('Gradient'))return{addColorStop(){}}}},set(o,k,v){o[k]=v;return true}}) as unknown as CanvasRenderingContext2D
 return{ctx,images}
}
const art=new Map(['anim-px/boss-ford.png','anim-px/bandit-warlord.png','anim-px/bandit-club.png','raid/death-strip.png'].map(p=>[p,image(p)]))
function lethal(){
 const s=createHaebi(61,'stage','sword',{stage:'ford',simRules:'55-IMUGI'});s.spawn=1e9;s.nextElite=1e9;s.nextBarrage=1e9
 const e=spawnGiant(s);assert.ok(e?.giant);const g=e.giant;e.hp=1;e.poison=1;e.pdps=10000;g.state='recover';g.timer=10;updateImugiPose(g,e,0)
 stepHaebi(s,{x:0,y:0},1/120)
 assert.equal(s.state,'won');assert.equal(s.giantFlow?.finalDefeated,true);assert.equal(g.state,'dead');assert.ok(g.pose.parts.every(p=>!p.visible))
 const f=s.fx.find(f=>f.kind==='death'&&f.mob==='boss');assert.ok(f);return{s,f}
}
function render(s:HaebiRun){const before=JSON.stringify(s),ending=new RaidEnding();ending.observe(s);const c=canvas();drawField(c.ctx,art,s,null,undefined,undefined,ending);assert.equal(JSON.stringify(s),before,'renderer must not mutate serialized state');return c.images}
test('giant real lethal death has particles but no human warlord corpse',()=>{
 const{s}=lethal(),images=render(s)
 assert.equal(images.filter(p=>p==='anim-px/boss-ford.png'||p==='anim-px/bandit-warlord.png').length,0)
 assert.ok(images.includes('raid/death-strip.png'))
})
test('midboss-only human corpse and death particles remain',()=>{
 const{s,f}=lethal();assert.ok(s.giantFlow);s.giantFlow.finalDefeated=false;s.giantFlow.finalSpawned=false;delete s.giantFlow.finalOwner;s.state='playing';s.fx=[{...f}]
 const images=render(s);assert.equal(images.filter(p=>p==='anim-px/boss-ford.png').length,1);assert.ok(images.includes('raid/death-strip.png'))
})
test('ordinary corpse and both particle strips remain during giant final death',()=>{
 const{s,f}=lethal();s.fx.push({...f,mob:'club',x:f.x+100,r:25});const images=render(s)
 assert.equal(images.filter(p=>p==='anim-px/bandit-club.png').length,1);assert.equal(images.filter(p=>p==='raid/death-strip.png').length,2)
})
