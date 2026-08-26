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
import { P } from '../src/tune/params.ts'
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

  it('실시간 상한(oneShotMaxSec)을 넘기면 화살이 아직 날고 있어도 강제로 풀린다', () => {
    // 형의 신고 (2026-08-26): "화살이 아주 화면 바깥 멀리멀리 날아가버리는 도중인데도
    // 계속 슬로우 잡힌다." 원인은 상한이 아예 없었다는 것 — 빗맞은 화살은 sim 비행시간이
    // 최대 8초라, 상한 없이는 그동안 내내 늘어져 있었다. 위로 쏴서(과녁과 무관하게) 오래
    // 날게 만들고, 상한을 넘긴 뒤에도 여전히 슬로모인지를 잰다.
    const w = createWorld(arena(1), STATS)
    const fx = createFx()
    const hold: InputFrame = { aimX: 9, aimY: 30, drawing: true, steady: false }
    const rest: InputFrame = { aimX: 9, aimY: 30, drawing: false, steady: false }
    for (let i = 0; i < 300 && w.archer.phase !== 'full'; i++) frame(w, fx, hold)
    frame(w, fx, rest)

    const flyingNow = (): boolean => {
      for (const a of w.arrows) if (a !== undefined && a.alive && a.outcome === 'flying') return true
      return false
    }

    const capSteps = Math.ceil(P.render.oneShotMaxSec / w.dt)
    for (let i = 0; i < capSteps; i++) frame(w, fx, rest)
    assert.ok(flyingNow(), '테스트 전제가 틀렸다 — 상한 시점에 화살이 이미 안 날고 있다')

    // 여운(oneShotOut)은 지수 감쇠라 정확히 그 시간에 0이 되지 않는다 — 램프 #4와 같은
    // 방식으로 실제로 풀릴 때까지 기다린다. 여기서 재는 건 "언젠가 풀리는가"가 아니라
    // "상한을 넘긴 뒤부터 계속 화살이 날아도 다시는 안 붙잡히는가"다.
    let steps = 0
    while (oneShotAmount(fx) > 0.05 && steps < 600) {
      frame(w, fx, rest)
      steps++
    }
    assert.ok(oneShotAmount(fx) <= 0.05, `상한을 넘겼는데 안 풀렸다 (${oneShotAmount(fx).toFixed(3)})`)
    assert.ok(flyingNow(), '상한이 화살까지 지워버렸다 — 느려지던 시간만 돌려줘야 한다')
  })
})
