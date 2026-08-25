/**
 * '한 발' 순간 (docs/MEGAHIT.md §2) — **판마다 한 번 보장되는 기대.**
 *
 * 여기서 지키는 계약은 둘이다.
 *   ① 과녁 하나짜리 판이 **통째로 슬로모가 되지 않는다.**
 *      "과녁이 하나 남았다"만으로 걸면 1-1이 시작부터 끝까지 늘어진다.
 *   ② 조건은 **마지막 하나를 향해 내 화살이 날고 있는 동안**뿐이다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { createFx, pumpEvents, updateFx, oneShotAmount } from '../src/render/effects.ts'
import type { InputFrame, StageDef, Stats, World } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 12, focus: 6 }

function arena(n: number): StageDef {
  const targets = []
  for (let i = 0; i < n; i++) targets.push({ kind: 'static' as const, x: 9 + i * 1.2, y: 1.6, r: 0.8 })
  return { id: 'oneshot-test', seed: 5, arrows: 20, targetScore: 100, wind: 0, targets }
}

/** 한 프레임: sim 한 스텝 + fx 갱신. fx는 실시간이라 dt를 따로 준다. */
function frame(w: World, fx: ReturnType<typeof createFx>, input: InputFrame): void {
  step(w, input)
  updateFx(fx, w.dt)
  pumpEvents(fx, w)
  w.events.length = 0
}

describe("'한 발' 순간", () => {
  it('과녁이 하나여도 화살이 안 날면 안 늘어진다 (1-1이 통째로 슬로모가 되면 안 된다)', () => {
    const w = createWorld(arena(1), STATS)
    const fx = createFx()
    const idle: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false }
    for (let i = 0; i < 240; i++) frame(w, fx, idle)
    assert.equal(oneShotAmount(fx), 0, '가만히 서 있는데 시간이 늘어졌다')

    // 당기는 동안에도 아직 아니다 — 화살이 떠나야 그 순간이다.
    const hold: InputFrame = { aimX: 20, aimY: 2, drawing: true, steady: false }
    for (let i = 0; i < 300 && w.archer.phase !== 'full'; i++) frame(w, fx, hold)
    for (let i = 0; i < 30; i++) frame(w, fx, hold)
    assert.equal(oneShotAmount(fx), 0, '당기기만 했는데 시간이 늘어졌다')
  })

  it('마지막 하나를 향해 화살이 날면 늘어진다', () => {
    const w = createWorld(arena(1), STATS)
    const fx = createFx()
    const t = w.targets[0]
    assert.ok(t !== undefined)
    const hold: InputFrame = { aimX: t.x, aimY: t.y, drawing: true, steady: false }
    const rest: InputFrame = { aimX: t.x, aimY: t.y, drawing: false, steady: false }
    for (let i = 0; i < 300 && w.archer.phase !== 'full'; i++) frame(w, fx, hold)
    frame(w, fx, rest)
    let peak = 0
    for (let i = 0; i < 300; i++) {
      frame(w, fx, rest)
      if (oneShotAmount(fx) > peak) peak = oneShotAmount(fx)
      let flying = false
      for (const a of w.arrows) if (a !== undefined && a.alive && a.outcome === 'flying') flying = true
      if (!flying) break
    }
    assert.ok(peak > 0.5, `화살이 나는데 안 늘어졌다 (최대 ${peak.toFixed(3)})`)
  })

  it('과녁이 둘 남았으면 안 늘어진다 — 마지막 하나여야 한다', () => {
    const w = createWorld(arena(3), STATS)
    const fx = createFx()
    const t = w.targets[0]
    assert.ok(t !== undefined)
    const hold: InputFrame = { aimX: t.x, aimY: t.y, drawing: true, steady: false }
    const rest: InputFrame = { aimX: t.x, aimY: t.y, drawing: false, steady: false }
    for (let i = 0; i < 300 && w.archer.phase !== 'full'; i++) frame(w, fx, hold)
    frame(w, fx, rest)
    let peak = 0
    for (let i = 0; i < 300; i++) {
      frame(w, fx, rest)
      if (oneShotAmount(fx) > peak) peak = oneShotAmount(fx)
      let flying = false
      for (const a of w.arrows) if (a !== undefined && a.alive && a.outcome === 'flying') flying = true
      if (!flying) break
    }
    assert.equal(peak, 0, `셋 중 하나를 쏘는데 시간이 늘어졌다 (${peak.toFixed(3)})`)
  })

  it('여운은 진입보다 길다 — 툭 끊으면 연출이 아니라 렉이다', () => {
    const fx = createFx()
    const w = createWorld(arena(1), STATS)
    // 조건을 손으로 켜고 끈다. 램프만 본다.
    ;(fx as unknown as { oneShotWant: boolean }).oneShotWant = true
    let inSteps = 0
    while (oneShotAmount(fx) < 0.9 && inSteps < 1000) {
      updateFx(fx, 1 / 60)
      inSteps++
    }
    ;(fx as unknown as { oneShotWant: boolean }).oneShotWant = false
    let outSteps = 0
    while (oneShotAmount(fx) > 0.1 && outSteps < 1000) {
      updateFx(fx, 1 / 60)
      outSteps++
    }
    void w
    assert.ok(outSteps > inSteps, `여운(${outSteps})이 진입(${inSteps})보다 짧다`)
  })
})
