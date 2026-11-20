/** view 이벤트 소비자 단위검사. 실제 터치 플레이 증거와 구분한다. */
import { it } from 'node:test'
import assert from 'node:assert/strict'
import { createWorld } from '../src/sim/world.ts'
import { createFx, pumpEvents, CORPSE_PIN0 } from '../src/render/effects.ts'
import { BOOST } from '../src/render/boost.ts'
import type { ArrowKindId, SimEvent } from '../src/sim/types.ts'
const kinds: ArrowKindId[] = ['basic','pierce','burst','split','homing','chain','heavy','scatter','rapid']
for (const mode of ['body','corpse','ground'] as const) it(`박힌 살 ${mode}: 화살별 원본 종류 보존 + World 읽기 전용`, () => {
  const old = BOOST.on; BOOST.on = true
  try { for (const kind of kinds) {
    const w = createWorld({id:'pin-fixture',seed:1,arrows:10,targetScore:100,wind:0,targets:[{kind:'archer',x:10,y:1.6,r:.6}]},{str:10,steady:10,stamina:10,focus:10},kind)
    const tg = w.targets[0]!, ar = w.arrows[0]!
    ar.kind = kind; ar.x = tg.x; ar.y = tg.y; ar.angle = .3
    if (mode === 'corpse') tg.alive = false
    const hit: SimEvent = {t:'hit',targetId:tg.id,x:tg.x,y:tg.y,score:0,accuracy:.1,chain:0,combo:0,head:false,foe:true,dmg:0,execute:false,arrow:0}
    w.events = mode === 'ground' ? [{t:'miss',x:5,y:0,arrow:0}] : [hit]
    if (mode === 'corpse') w.events.push({t:'foe_down',x:tg.x,y:tg.y,vx:0,vy:0,mass:1,look:0,r:tg.r,hard:false,g:0})
    const snapshot = JSON.stringify(w), fx = createFx()
    pumpEvents(fx,w)
    const view = fx as unknown as { kKind?: ArrowKindId[], pKind?: ArrowKindId[] }
    const actual = mode === 'ground' ? view.kKind?.[0] : view.pKind?.[0]
    assert.equal(actual,kind,`${mode}: ${kind}`)
    if (mode === 'corpse') assert.equal(fx.pId[0],CORPSE_PIN0)
    assert.equal(JSON.stringify(w),snapshot,'렌더가 sim 입력을 바꿨다')
  }} finally { BOOST.on = old }
})
