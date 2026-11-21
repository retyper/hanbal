import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as core from '../src/raid/giant-core.ts'
import type { Collider, ImugiPose, PartPose, Shape } from '../src/raid/giant-core.ts'
const p = (x: number, y: number) => ({ x, y })
const circle = (x: number, y: number, radius: number): Shape => ({ kind: 'circle', center: p(x, y), radius })
const disk = (id: PartPose['id'], x: number, y: number, radius: number): PartPose => ({ id, parent: null, start: p(x,y), end:p(x,y), angle:0, mirrorY:1, alive:true, broken:false, damaged:false, visible:true, targetable:true, height:0, widthScale:1, collider:{kind:'capsule',from:p(x,y),to:p(x,y),radius} })
function scene(parts: readonly PartPose[]): ImugiPose { return { ownerId:9,tick:0,parts,worldGeometry:{parts:parts.map(q=>({id:q.id,shape:q.collider})),tell:[]},jawOpen:0,recovering:false } }
const near = (a: number, b: number, tol=1e-6) => assert.ok(Math.abs(a-b)<tol, `${a} != ${b}`)

describe('55 product pure geometry; actual UI/balance tested separately', () => {
  it('fast arrow crossing a neck hits before its endpoint; smaller earlier body beats head', () => {
    const pose = scene([disk('head',80,0,5),disk('neck-base',40,0,5)])
    const hit=core.sweepContact(pose,p(0,0),p(100,0),1)
    assert.equal(hit?.partId,'neck-base'); near(hit!.t,.34)
    assert.equal(core.sweepContact(pose,p(0,20),p(100,20),1),null)
  })
  it('thin capsule, rotated ellipse grazing, radius expansion and start-inside are not endpoint guesses', () => {
    const cap:Collider={kind:'capsule',from:p(30,-20),to:p(30,20),radius:2}
    const ellipse:Collider={kind:'ellipse',center:p(60,0),rx:12,ry:3,angle:Math.PI/4}
    const a={...disk('neck-mid',0,0,1),collider:cap}, b={...disk('head',0,0,1),collider:ellipse}
    near(core.sweepContact(scene([a]),p(0,0),p(100,0),1)!.t,.27)
    const hit=core.sweepContact(scene([b]),p(0,0),p(100,0),2)
    assert.ok(hit && hit.t>.45 && hit.t<.6)
    assert.equal(core.sweepContact(scene([b]),p(60,0),p(60,0),0)?.t,0)
    assert.equal(core.sweepContact(scene([disk('head',50,0,10)]),p(0,12.001),p(100,12.001),2),null)
    near(core.sweepContact(scene([disk('head',50,0,10)]),p(0,12),p(100,12),2)!.t,.5,2e-6)
  })
  it('cone uses its rays and curved boundary; annulus hole and angular arc gaps stay safe', () => {
    const cone:Shape={kind:'cone',center:p(0,0),radius:100,angle:0,halfAngle:Math.PI/6}
    assert.ok(core.overlaps(cone,circle(60,0,2)))
    assert.ok(core.overlaps(cone,circle(50,31,7)))
    assert.equal(core.overlaps(cone,circle(-20,0,2)),false)
    assert.equal(core.overlaps(cone,circle(40,40,2)),false)
    const ring:Shape={kind:'annulus',center:p(0,0),inner:30,outer:40}
    assert.equal(core.overlaps(ring,circle(0,0,10)),false)
    assert.ok(core.overlaps(ring,circle(25,0,6)))
    const arc:Shape={kind:'arc',center:p(0,0),inner:30,outer:40,angle:0,halfAngle:Math.PI/4}
    assert.ok(core.overlaps(arc,circle(35,0,1)))
    assert.equal(core.overlaps(arc,circle(-35,0,1)),false)
    assert.equal(core.overlaps(arc,circle(0,0,1)),false)
  })
  it('line/capsule, ellipse and unions intersect their actual geometry rather than AABBs', () => {
    const line:Shape={kind:'line',from:p(-10,0),to:p(10,0),width:2}
    const ellipse:Shape={kind:'ellipse',center:p(0,4),rx:12,ry:2,angle:0}
    assert.equal(core.overlaps(line,ellipse),false)
    assert.ok(core.overlaps({kind:'union',shapes:[line,circle(0,4,1)]},ellipse))
    assert.equal(core.overlaps({kind:'union',shapes:[circle(-20,0,1),circle(20,0,1)]},circle(0,0,1)),false)
    assert.ok(core.overlaps({kind:'ellipse',center:p(0,0),rx:10,ry:2,angle:Math.PI/4},circle(5,5,1)))
    assert.equal(core.overlaps({kind:'ellipse',center:p(0,0),rx:10,ry:2,angle:Math.PI/4},circle(7,-7,1)),false)
  })
  it('overlapping parts choose one head by stable tie priority; one pulse is one parent hit', () => {
    const pose=scene([disk('root',0,0,10),disk('head',0,0,10),disk('jaw',0,0,10)])
    assert.equal(core.pickContact(pose,circle(0,0,2))?.partId,'head')
    const ledger=new core.DamageLedger(2,2), actor=core.createDamageState(9,100,20)
    assert.equal(ledger.open(1),'opened')
    const first=core.resolveHit(actor,pose,circle(0,0,30),10,1,ledger)
    assert.equal(first.status,'hit'); assert.equal(actor.hp,85); assert.equal(actor.parts.head,10)
    assert.equal(actor.parts.root,20); assert.equal(actor.parts.jaw,20)
    assert.equal(core.resolveHit(actor,pose,circle(0,0,30),10,1,ledger).status,'duplicate')
    assert.equal(actor.hp,85)
    assert.equal(ledger.open(2),'opened')
    core.resolveHit(actor,pose,circle(0,0,30),10,2,ledger)
    assert.equal(actor.hp,70); assert.equal(actor.parts.head,0)
  })
  it('unknown/closed IDs fail before querying geometry; bounded ledger does not evict active shots', () => {
    const ledger=new core.DamageLedger(1,1), actor=core.createDamageState(9,100,20)
    const invalid={kind:'circle',center:p(NaN,0),radius:-1} as Shape
    assert.equal(core.resolveHit(actor,scene([disk('root',0,0,1)]),invalid,10,99,ledger).status,'unknown-event')
    assert.equal(actor.hp,100); assert.equal(ledger.size,0)
    assert.equal(ledger.open(1),'opened'); assert.equal(ledger.open(2),'event-capacity')
    assert.equal(ledger.claim(1,9),'claimed'); assert.equal(ledger.claim(1,10),'owner-capacity')
    assert.equal(ledger.check(1,9),'duplicate'); assert.equal(ledger.close(1),'closed')
    assert.equal(ledger.check(1,9),'unknown-event'); assert.equal(ledger.open(1),'stale-event')
    assert.equal(ledger.open(NaN),'invalid-event'); assert.equal(ledger.open(2),'opened'); assert.equal(ledger.size,1)
  })
  it('13 parts share hinge/socket/ellipse world geometry, mirror correctly and apply height once', () => {
    const a=core.makePose({ownerId:9,tick:11,x:20,y:60,angle:.2,mirrorY:1,height:10,jawOpen:.4})
    const b=core.makePose({ownerId:9,tick:11,x:20,y:60,angle:.2,mirrorY:-1,height:10,jawOpen:.4})
    assert.equal(a.parts.length,13); assert.equal(new Set(a.parts.map(q=>q.id)).size,13)
    const h=a.parts.find(q=>q.id==='head')!, j=a.parts.find(q=>q.id==='jaw')!
    assert.deepEqual(j.start,h.end); assert.deepEqual(j.mouth,j.end)
    assert.notDeepEqual((h.collider as Extract<Collider,{kind:'ellipse'}>).center,h.end)
    near(a.parts[0]!.start.y,50)
    const origin=p(20,50), c=Math.cos(.2),s=Math.sin(.2)
    for(let i=0;i<a.parts.length;i++) {
      const aa=a.parts[i]!,bb=b.parts[i]!
      const local=(q:{x:number;y:number})=>({x:(q.x-origin.x)*c+(q.y-origin.y)*s,y:-(q.x-origin.x)*s+(q.y-origin.y)*c})
      near(local(aa.start).x,local(bb.start).x);near(local(aa.start).y,-local(bb.start).y)
      near(local(aa.end).x,local(bb.end).x);near(local(aa.end).y,-local(bb.end).y)
      assert.equal(a.worldGeometry.parts[i]!.shape,aa.collider)
    }
    assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.worldGeometry)&&Object.isFrozen(a.parts[0]!.collider))
    assert.deepEqual(a,core.makePose({ownerId:9,tick:11,x:20,y:60,angle:.2,mirrorY:1,height:10,jawOpen:.4}))
  })
  it('tell geometry is cloned/frozen; broken pieces disappear except hittable head/root fallback', () => {
    const source=circle(10,20,30), pose=core.makePose({ownerId:9,tick:1,x:0,y:0,tell:[source],broken:core.PART_IDS})
    assert.notEqual(pose.worldGeometry.tell[0],source)
    assert.ok(Object.isFrozen(pose.worldGeometry.tell[0]))
    assert.equal(pose.parts.find(q=>q.id==='jaw')!.targetable,false)
    assert.equal(pose.parts.find(q=>q.id==='head')!.targetable,true)
    assert.equal(pose.parts.find(q=>q.id==='root')!.targetable,true)
    const before=JSON.stringify(pose)
    assert.ok(core.pickContact(pose,circle(0,0,1)))
    assert.equal(JSON.stringify(pose),before)
  })
  it('recovery head multiplier changes parent once, and death has one transition only', () => {
    const pose={...scene([disk('head',0,0,10)]),recovering:true}, ledger=new core.DamageLedger(2,2), actor=core.createDamageState(9,20,5)
    ledger.open(1); const out=core.resolveHit(actor,pose,circle(0,0,1),10,1,ledger)
    assert.equal(out.status,'hit');assert.equal(actor.hp,0);assert.equal(actor.parts.head,0);assert.equal(actor.kills,1)
    ledger.open(2);assert.equal(core.resolveHit(actor,pose,circle(0,0,1),10,2,ledger).status,'dead')
    assert.equal(actor.kills,1)
  })
})
