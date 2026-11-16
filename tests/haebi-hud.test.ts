import test from 'node:test'
import assert from 'node:assert/strict'
import { createHaebi } from '../src/raid/haebi.ts'
import { installPowerHints, powerTooltip } from '../src/raid/power-ui.ts'
import { impactFrame, projectileAnchor } from '../src/raid/haebi-view.ts'
import { HAEBI_RUN as C } from '../src/tune/params.ts'
import type { Missile } from '../src/raid/haebi.ts'

test('projectiles leave hand/bow height without moving the ground-plane simulation', () => {
  const b: Missile={x:100,y:200,vx:350,vy:0,life:C.galeLife,kind:'gale',damage:1,radius:12,hit:[],angle:0,tx:100,ty:200}
  assert.deepEqual(projectileAnchor(b),{x:114,y:154})
  b.vx=-350; assert.deepEqual(projectileAnchor(b),{x:86,y:154})
  b.life-=C.shotReleaseTime; assert.equal(projectileAnchor(b).x,100)
  b.kind='enemy'; assert.equal(projectileAnchor(b).y,166)
  b.kind='shard';b.life=C.galeLife;assert.equal(projectileAnchor(b).x,100)
  assert.deepEqual([b.x,b.y],[100,200])
})

test('rank description reflects acquired rank, max rank and recipe progress', () => {
  const s = createHaebi(7, 'vanguard')
  const text = powerTooltip(s, 'axe')
  assert.match(text, /파쇄 도끼 · 4\/10/)
  assert.match(text, /current">4/)
  assert.match(text, /질풍 도끼 3\/3/)
  assert.equal(impactFrame(0), 0); assert.equal(impactFrame(.999), 7)
  assert.equal(impactFrame(1), 7); assert.equal(impactFrame(-.1), 0)
})

test('touch hold pauses inspection only until release/cancel/blur; hover does not pause', () => {
  class ElementStub extends EventTarget {
    dataset = { power: 'axe' }; innerHTML = ''; hidden = true; offsetWidth = 250; offsetHeight = 160
    style: Record<string,string> = {}; attrs = new Map<string,string>(); id = 'hint'; captured = -1
    button: ElementStub | null = null
    closest() { return this.button ?? this }
    setAttribute(k: string,v: string) { this.attrs.set(k,v) }
    removeAttribute(k: string) { this.attrs.delete(k) }
    getBoundingClientRect() { return {left:810,bottom:365} }
    setPointerCapture(id: number) { this.captured = id }
    contains() { return false }
  }
  const win = new EventTarget(), doc = Object.assign(new EventTarget(),{hidden:false})
  const previous = Object.fromEntries(['window','document','innerWidth','innerHeight'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
  Object.assign(globalThis,{window:win,document:doc,innerWidth:844,innerHeight:390})
  try {
    const container=new ElementStub(), button=new ElementStub(), tip=new ElementStub(); container.button=button
    let held=false
    const hide=installPowerHints(container as unknown as HTMLElement,tip as unknown as HTMLElement,()=>createHaebi(),v=>held=v)
    const send=(target:EventTarget,type:string,props:object={})=>target.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),props))
    send(container,'pointerover',{pointerType:'mouse'}); assert.equal(tip.hidden,false); assert.equal(held,false)
    assert.equal(tip.style.left,'586px'); assert.equal(tip.style.top,'222px')
    send(container,'pointerout',{pointerType:'mouse',relatedTarget:null}); assert.equal(tip.hidden,true)
    for (const ending of ['pointerup','pointercancel','blur']) {
      send(container,'pointerdown',{pointerType:'touch',pointerId:4}); assert.equal(held,true); assert.equal(tip.hidden,false)
      send(win,'pointerup',{pointerId:8}); assert.equal(held,true,'another finger must not close this hold')
      send(win,ending,{pointerId:4}); assert.equal(held,false); assert.equal(tip.hidden,true)
    }
    send(container,'pointerdown',{pointerType:'touch',pointerId:5}); hide(); assert.equal(held,false); assert.equal(button.attrs.has('aria-describedby'),false)
  } finally {
    for (const [k,desc] of Object.entries(previous)) { if(desc)Object.defineProperty(globalThis,k,desc);else Reflect.deleteProperty(globalThis,k) }
  }
})
