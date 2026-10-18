/**
 * 밤의 암살판 (src/night, docs/realm/SNIPE.md §0) — 배치 결정론 · 판 넘김 · 발각 게이지 · 적장 · 결과 꼴
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { bakeScene } from '../src/night/layout.ts'
import { createNight, lightAt, stepNight, type Night } from '../src/night/sim.ts'
import { P } from '../src/tune/params.ts'
import type { InputFrame } from '../src/sim/types.ts'

const idle = (): InputFrame => ({ aimX: 10, aimY: 0, drawing: false, steady: false, parry: false })
const run = (n: Night, secs: number, inp: InputFrame = idle()): void => {
  for (let i = 0; i < Math.round(secs * P.sim.hz); i++) stepNight(n, inp)
}

/** 만작까지 당겼다 놓고 살이 끝날 때까지 */
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

/** 연습장 '과녁만'(보초 없는 형체) 첫 형체의 어디를 맞히는 각을 찾는다 */
function angleFor(seed: number, zone: 'head' | 'body'): number {
  for (let ang = -0.6; ang <= -0.15; ang += 0.002) {
    const n = createNight({ seed, practice: { stage: 3, alarm: true, infinite: true } })
    shoot(n, ang)
    const f = n.scene.figures[0]!
    if (!f.alive && f.hitZone === zone) return ang
  }
  throw new Error(`${zone} 각을 못 찾았다`)
}

describe('밤의 암살판', () => {
  it('같은 시드·같은 판이면 같은 배치, 시드가 다르면 다른 배치', () => {
    assert.deepEqual(bakeScene(5, 0), bakeScene(5, 0))
    assert.deepEqual(bakeScene(5, 2), bakeScene(5, 2))
    assert.notDeepEqual(bakeScene(5, 0).figures.map((f) => f.x), bakeScene(6, 0).figures.map((f) => f.x))
  })

  it('머리는 소리 없이 쓰러진다 · 몸통은 신음으로 게이지가 오른다 · 같은 각이면 같은 결과', () => {
    const seed = 11
    const head = angleFor(seed, 'head')
    const a = createNight({ seed, practice: { stage: 3, alarm: true, infinite: true } })
    const b = createNight({ seed, practice: { stage: 3, alarm: true, infinite: true } })
    shoot(a, head)
    shoot(b, head)
    assert.deepEqual(a.scene.figures, b.scene.figures)
    assert.equal(a.scene.figures[0]!.hitZone, 'head')
    assert.equal(a.alarm, 0)
    assert.equal(a.heads, 1)
    const body = angleFor(seed, 'body')
    const c = createNight({ seed, practice: { stage: 3, alarm: true, infinite: true } })
    shoot(c, body)
    assert.ok(c.alarm > 0, '몸통에 맞으면 신음 소리')
  })

  it('보초를 다 쓰러뜨리면 지붕을 넘어 다음 판 — 화살은 그대로, 게이지는 조금 가라앉는다', () => {
    const n = createNight({ seed: 3, arrows: 7 })
    n.alarm = 0.5
    for (const f of n.scene.figures) f.alive = false
    stepNight(n, idle())
    assert.equal(n.phase, 'move')
    run(n, P.night.moveTime + 0.1)
    assert.equal(n.stage, 1)
    assert.equal(n.phase, 'play')
    assert.equal(n.w.arrowsLeft, 7)
    assert.ok(n.alarm < 0.5 && n.alarm > 0)
  })

  it('셋째 판 — 호위가 다 쓰러지면 그림자가 일어서고, 오래 기다리면 촛불을 끄고 달아난다', () => {
    const n = createNight({ seed: 4, practice: { stage: 2, alarm: true, infinite: false } })
    for (const f of n.scene.figures) if (f.role === 'guard') f.alive = false
    stepNight(n, idle())
    assert.equal(n.phase, 'rise')
    run(n, P.night.chiefRise + 0.05)
    assert.equal(n.phase, 'chief')
    run(n, P.night.chiefPatience + 0.1)
    assert.equal(n.result?.result, 'fled')
    assert.equal(n.result?.alarm, false)
    assert.equal(n.scene.lights.find((l) => l.kind === 'candle')?.lit, false)
  })

  it('게이지가 차면 북이 울리고 적장이 달아난다 — 결과에 경보가 남는다', () => {
    const n = createNight({ seed: 8 })
    n.alarm = 1
    stepNight(n, idle())
    assert.equal(n.phase, 'alarm')
    run(n, P.night.alarmTime + 0.1)
    assert.deepEqual(Object.keys(n.result!).sort(), ['alarm', 'arrowsLeft', 'result', 'stage'])
    assert.equal(n.result!.result, 'fled')
    assert.equal(n.result!.alarm, true)
  })

  it('빛 안의 시체를 앞을 보는 보초가 보면 알아채고 게이지가 오른다 · 불을 끄면 못 본다', () => {
    const n = createNight({ seed: 9 })
    const [g, c] = n.scene.figures as [NonNullable<Night['scene']['figures'][0]>, NonNullable<Night['scene']['figures'][0]>]
    // 둘째 보초(c)를 첫째(g) 앞 횃불 아래 시체로
    const torch = n.scene.lights.find((l) => l.kind === 'torch')!
    c.alive = false
    c.downAt = 0
    c.x = torch.x
    g.x = torch.x - 3
    g.facing = 1
    for (const f of n.scene.figures) if (f.patrol !== null) f.alive = false
    assert.ok(lightAt(n.scene, c.x, c.y + 0.6, n.tick) > P.night.corpseLight)
    run(n, P.night.noticeDelay + 0.5)
    assert.ok(n.alarm > 0, '알아채고 게이지가 오른다')
    const lit = createNight({ seed: 9 })
    const [g2, c2] = lit.scene.figures as typeof n.scene.figures
    for (const l of lit.scene.lights) l.lit = false
    c2!.alive = false
    c2!.downAt = 0
    g2!.x = c2!.x - 3
    g2!.facing = 1
    for (const f of lit.scene.figures) if (f.patrol !== null) f.alive = false
    run(lit, P.night.noticeDelay + 0.5)
    assert.equal(lit.alarm, 0)
  })

  it('화살이 다하면 조용히 물러난다', () => {
    const n = createNight({ seed: 2, arrows: 1 })
    shoot(n, 0.3) // 하늘로 — 멀리 떨어진다
    run(n, 3)
    assert.equal(n.result?.result, 'withdrew')
  })
})
