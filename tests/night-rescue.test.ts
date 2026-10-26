/**
 * 밤 — 구출 판 (형 10-26: "구출작전은 암살이랑 비슷하게 활쏘기겜으로 가서 적물리치면될듯")
 *
 *  - kind=rescue 면 셋째 판에 적장이 없고 묶인 우리 장수가 앉아 있다 · 보초 배치는 암살과 똑같다
 *  - 셋째 판의 보초를 다 쓰러뜨리면 cleared (데려 나왔다) · 묶인 이는 살이 비켜 간다
 *  - 북이 울리면 fled · 갈래를 안 주면 옛 암살 판 그대로 · 연습장은 늘 암살 판
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { bakeScene, kindOf, STAGE_COUNT } from '../src/night/layout.ts'
import { createNight, stepNight, type Night } from '../src/night/sim.ts'
import { P } from '../src/tune/params.ts'
import type { InputFrame } from '../src/sim/types.ts'

const idle = (): InputFrame => ({ aimX: 10, aimY: 0, drawing: false, steady: false, parry: false })
const run = (n: Night, secs: number): void => {
  for (let i = 0; i < Math.round(secs * P.sim.hz); i++) stepNight(n, idle())
}

/** 만작까지 당겼다 놓고 살이 끝날 때까지 (night.test.ts 와 같은 손) */
function shoot(n: Night, angle: number): void {
  const a = n.w.archer
  const inp: InputFrame = { aimX: a.x + Math.cos(angle) * 10, aimY: a.y + Math.sin(angle) * 10, drawing: false, steady: false, parry: false }
  for (let i = 0; i < P.sim.hz * 2 && a.stamina < a.staminaMax * 0.95; i++) stepNight(n, inp)
  inp.drawing = true
  for (let i = 0; i < P.sim.hz * 2 && a.phase !== 'full'; i++) stepNight(n, inp)
  stepNight(n, inp)
  inp.drawing = false
  for (let i = 0; i < P.sim.hz * 4; i++) {
    stepNight(n, inp)
    if (!n.w.arrows.some((x) => x.alive && x.outcome === 'flying')) break
  }
}

/** 구출 밤을 셋째 판에서 연다 — 앞의 두 판은 보초를 다 눕혀 넘긴다 */
function toLastStage(seed: number): Night {
  const n = createNight({ seed, arrows: 30, kind: 'rescue' })
  for (let s = 0; s < STAGE_COUNT - 1; s++) {
    for (const f of n.scene.figures) if (f.role === 'guard') f.alive = false
    stepNight(n, idle())
    assert.equal(n.phase, 'move')
    run(n, P.night.moveTime + 0.1)
  }
  assert.equal(n.stage, STAGE_COUNT - 1)
  return n
}

describe('밤 — 구출 판', () => {
  it('셋째 판에 적장이 없고 묶인 우리 장수가 있다 · 보초는 암살과 같다', () => {
    for (const seed of [1, 4, 9]) {
      for (const g of [0, 1, 2] as const) {
        const a = bakeScene(seed, 2, g)
        const r = bakeScene(seed, 2, g, 'rescue')
        assert.equal(r.figures.filter((f) => f.role === 'chief').length, 0)
        assert.equal(r.figures.filter((f) => f.role === 'captive').length, 1)
        assert.equal(a.figures.filter((f) => f.role === 'captive').length, 0)
        assert.equal(a.figures.filter((f) => f.role === 'chief').length, 1)
        assert.deepEqual(r.figures.filter((f) => f.role === 'guard'), a.figures.filter((f) => f.role === 'guard'))
        assert.deepEqual(r, bakeScene(seed, 2, g, 'rescue'))
      }
      // 앞의 두 판은 갈래와 상관없이 같다
      assert.deepEqual(bakeScene(seed, 0, 1, 'rescue'), bakeScene(seed, 0, 1))
      assert.deepEqual(bakeScene(seed, 1, 1, 'rescue'), bakeScene(seed, 1, 1))
    }
    assert.equal(kindOf('rescue'), 'rescue')
    assert.equal(kindOf(null), 'assassin')
    assert.equal(kindOf('<script>'), 'assassin')
  })

  it('셋째 판의 보초를 다 쓰러뜨리면 cleared — 묶인 장수는 그대로 산다', () => {
    const n = toLastStage(3)
    assert.equal(n.kind, 'rescue')
    for (const f of n.scene.figures) if (f.role === 'guard') f.alive = false
    stepNight(n, idle())
    assert.equal(n.phase, 'end')
    assert.equal(n.result?.result, 'cleared')
    assert.equal(n.result?.alarm, false)
    assert.ok(n.scene.figures.some((f) => f.role === 'captive' && f.alive))
  })

  it('북이 울리면 달아난다(fled) — 경보가 남는다', () => {
    const n = toLastStage(3)
    n.alarm = 1
    stepNight(n, idle())
    assert.equal(n.phase, 'alarm')
    run(n, P.night.alarmTime + 0.1)
    assert.equal(n.result?.result, 'fled')
    assert.equal(n.result?.alarm, true)
  })

  it('묶인 이는 살이 비켜 간다 — 보초였으면 맞았을 각으로 쏴도 산다', () => {
    const seed = 3
    // 보초 하나만 멀리 세워 판이 끝나지 않게 한다 (순찰을 떼고 오른쪽 끝으로)
    const prep = (n: Night, asGuard: boolean): void => {
      n.stage = STAGE_COUNT - 1
      n.scene = bakeScene(seed, STAGE_COUNT - 1, n.guard, 'rescue')
      const gs = n.scene.figures.filter((f) => f.role === 'guard')
      gs.forEach((f, i) => {
        if (i === 0) {
          (f as { patrol: unknown }).patrol = null
          f.x = 60
        } else f.alive = false
      })
      const c = n.scene.figures.find((f) => f.role === 'captive')!
      if (asGuard) (c as { role: string }).role = 'guard'
    }
    let hitAngle: number | null = null
    for (let ang = -0.7; ang <= 0.1 && hitAngle === null; ang += 0.004) {
      const n = createNight({ seed, arrows: 5, kind: 'rescue' })
      prep(n, true)
      shoot(n, ang)
      const c = n.scene.figures.find((f) => f.x > 20 && f.x < 25 && f.pose === 'sit')!
      if (!c.alive) hitAngle = ang
    }
    assert.notEqual(hitAngle, null, '묶인 자리를 맞히는 각이 없다')
    const n = createNight({ seed, arrows: 5, kind: 'rescue' })
    prep(n, false)
    shoot(n, hitAngle!)
    assert.ok(n.scene.figures.find((f) => f.role === 'captive')!.alive)
  })

  it('갈래를 안 주면 옛 암살 판 · 연습장은 구출을 달라도 암살 판', () => {
    assert.equal(createNight({ seed: 2 }).kind, 'assassin')
    const p = createNight({ seed: 2, kind: 'rescue', practice: { stage: 2, alarm: true, infinite: true } })
    assert.equal(p.kind, 'assassin')
    assert.ok(p.scene.figures.some((f) => f.role === 'chief'))
  })
})
