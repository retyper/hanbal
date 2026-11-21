import { test } from 'node:test'
import assert from 'node:assert/strict'
import { awakeningCutinArt, awakeningCutinPose } from '../src/raid/awakening-cutin.ts'

test('56-B uses the actual complete body, keeps appearance OFF, and falls back to the corresponding portrait', () => {
 assert.deepEqual(awakeningCutinArt('w-95-michuhol-haebi', true), { src: 'skill-body/aw1/w-95-michuhol-haebi.jpg', fullBody: true })
 assert.deepEqual(awakeningCutinArt('w-95-michuhol-haebi', false), { src: 'skill-body/w-95-michuhol-haebi.jpg', fullBody: true })
 assert.deepEqual(awakeningCutinArt('unknown-hero', true), { src: 'awaken-hd/unknown-hero.jpg', fullBody: false })
 assert.deepEqual(awakeningCutinArt('unknown-hero', false), { src: 'bust-hd/unknown-hero.jpg', fullBody: false })
})
test('56-B full body enters diagonally, holds, and depends only on cast progress', () => {
 const first=awakeningCutinPose(0), hold=awakeningCutinPose(.5)
 assert.ok(first.x<0 && first.y>0 && first.scale<1)
 assert.deepEqual(hold,{x:0,y:0,scale:1,opacity:1})
 assert.deepEqual(awakeningCutinPose(.75),hold)
 assert.deepEqual(awakeningCutinPose(.5),hold)
 assert.deepEqual(awakeningCutinPose(-1),first)
 assert.deepEqual(awakeningCutinPose(2),awakeningCutinPose(1))
})

test('56-B duplicate body load failures retain the valid portrait and stale callbacks do not change the next cast', async () => {
 const saved=['document','Image','location'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)] as const)
 class Element {
  hidden=false;className='';textContent='';style:Record<string,string>={};dataset:Record<string,string>={};children:unknown[]=[]
  classList={add(){},toggle(){}}
  append(...nodes:unknown[]){this.children.push(...nodes)}
  replaceChildren(...nodes:unknown[]){this.children=nodes}
  replaceChild(node:unknown,old:unknown){this.children[this.children.indexOf(old)]=node}
 }
 const images:Image[]=[]
 class Image extends Element {
  src='';alt='';draggable=false;onerror:((e:Event)=>void)|null=null;naturalWidth=800;naturalHeight=1200
  constructor(){super();images.push(this)}
  async decode(){throw Error('body unavailable')}
 }
 Object.defineProperty(globalThis,'document',{configurable:true,value:{baseURI:'http://127.0.0.1:5173/raid.html',createElement:()=>new Element()}})
 Object.defineProperty(globalThis,'Image',{configurable:true,value:Image})
 Object.defineProperty(globalThis,'location',{configurable:true,value:{origin:'http://127.0.0.1:5173'}})
 try{
  const { RaidAwakeningCutin }=await import('../src/raid/awakening-cutin.ts'),{ createHaebi }=await import('../src/raid/haebi.ts')
  const host=new Element(),cut=new RaidAwakeningCutin(host as unknown as HTMLElement,'/realm/','w-95-michuhol-haebi','skill','hero')
  const run=createHaebi(56,'stage','axe',{permanentAwake:true});run.cast={kind:'ult',t:.1,total:.18,tru:false,awakened:true,slow:.1,seq:1}
  cut.show(run,true);const display=images[0]!,late=display.onerror!;late(new Event('error'))
  await new Promise(r=>setTimeout(r,0))
  assert.equal(display.src,'/realm/awaken-hd/w-95-michuhol-haebi.jpg');assert.equal(display.hidden,false)
  cut.clear();assert.equal(host.hidden,true)
  cut.show(run,true);const next=images.at(-2)!;late(new Event('error'));assert.notEqual(display,next);assert.equal(host.hidden,false)
  cut.clear()
 }finally{for(const[k,d]of saved){if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k)}}
})
