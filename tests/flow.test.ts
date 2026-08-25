/**
 * 연사(連射)와 몰기(沒技) — docs/MEGAHIT.md §1 · src/sim/flow.ts
 *
 * 여기서 지키는 계약은 둘이다.
 *   ① **세는 단위는 화살이다.** 한 발이 셋을 뚫어도 1중이다.
 *   ② **연사는 정확도를 건드리지 않는다.** 빠르게 만들 뿐 부정확하게 만들지 않는다 —
 *      이게 GDD 1장 빨간 바 계약과의 화해점이고, 깨지면 기능 전체가 반려다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, resetWorld, step } from '../src/sim/world.ts'
import { flowDrainMul, flowDrawMul } from '../src/sim/flow.ts'
import { P } from '../src/tune/params.ts'
import type { InputFrame, StageDef, Stats, World } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 12, focus: 6 }
const IDLE: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false }

/** 아주 큰 과녁 n개를 코앞에 세운다 — 조준 실력이 아니라 배선을 재는 판이다. */
function arena(n: number, kind: 'static' | 'pierceable' = 'static'): StageDef {
  const targets = []
  for (let i = 0; i < n; i++) {
    targets.push({ kind, x: 8 + i * 0.9, y: 1.6, r: 0.8, score: 10 })
  }
  return { id: 'flow-test', seed: 11, arrows: 40, targetScore: 100, wind: 0, targets }
}

/** 한 발 쏜다: 만작까지 당기고 놓은 뒤, 화살이 결판날 때까지 돌린다. */
function shoot(w: World, aimX: number, aimY: number): void {
  const hold: InputFrame = { aimX, aimY, drawing: true, steady: false }
  const rest: InputFrame = { aimX, aimY, drawing: false, steady: false }
  for (let i = 0; i < 600 && w.archer.phase !== 'full'; i++) step(w, hold)
  step(w, rest)
  for (let i = 0; i < 600; i++) {
    step(w, rest)
    let flying = false
    for (const a of w.arrows) if (a !== undefined && a.alive && a.outcome === 'flying') flying = true
    if (!flying) break
  }
}

describe('연사와 몰기', () => {
  it('중(中)이 쌓이면 만작이 빨라진다 — 그리고 하한에서 멈춘다', () => {
    const w = createWorld(arena(1), STATS)
    assert.equal(flowDrawMul(w), 1, '0중에서는 아무것도 안 바뀐다 (초보가 보는 게임은 그대로다)')
    let prev = 1
    for (let n = 1; n <= 12; n++) {
      w.flowHits = n
      const m = flowDrawMul(w)
      assert.ok(m <= prev + 1e-9, `${n}중에서 배수가 되레 커졌다`)
      assert.ok(m >= P.flow.drawFloor - 1e-9, `${n}중에서 하한을 뚫었다`)
      prev = m
    }
    assert.equal(flowDrawMul(w), P.flow.drawFloor, '충분히 쌓이면 하한에 앉는다')
  })

  it('몰기에 닿는 지점이 곧 속도의 천장이다 (설계상 같은 자리)', () => {
    const w = createWorld(arena(1), STATS)
    w.flowHits = Math.floor(P.flow.molgiAt)
    assert.equal(flowDrawMul(w), P.flow.drawFloor, '몰기인데 아직 더 빨라질 여지가 남아 있다')
  })

  it('실제로 맞히면 다음 만작이 눈에 띄게 빨라진다', () => {
    const w = createWorld(arena(6), STATS)
    const t0 = w.targets[0]
    assert.ok(t0 !== undefined)
    shoot(w, t0.x, t0.y)
    assert.equal(w.flowHits, 1, '맞혔는데 중이 안 올랐다')

    // 첫 발과 둘째 발의 만작 도달 스텝 수를 잰다.
    function drawSteps(): number {
      const w2 = createWorld(arena(6), STATS)
      w2.flowHits = 0
      let a = 0
      const hold: InputFrame = { aimX: 20, aimY: 2, drawing: true, steady: false }
      for (; a < 600 && w2.archer.phase !== 'full'; a++) step(w2, hold)
      return a
    }
    const slow = drawSteps()
    const w3 = createWorld(arena(6), STATS)
    w3.flowHits = Math.floor(P.flow.molgiAt)
    let fast = 0
    const hold: InputFrame = { aimX: 20, aimY: 2, drawing: true, steady: false }
    for (; fast < 600 && w3.archer.phase !== 'full'; fast++) step(w3, hold)
    assert.ok(fast < slow * 0.8, `몰기의 만작이 안 빠르다 (${slow} → ${fast} 스텝)`)
  })

  it('한 발이 여럿을 뚫어도 1중이다 (세는 단위는 화살이다)', () => {
    const w = createWorld(arena(4, 'pierceable'), STATS, 'pierce')
    const t0 = w.targets[0]
    assert.ok(t0 !== undefined)
    shoot(w, t0.x, t0.y)
    let struck = 0
    for (const a of w.arrows) if (a !== undefined && a.struck > struck) struck = a.struck
    assert.ok(struck >= 2, `관통 판이 아니다 — 한 발이 ${struck}개만 맞혔다`)
    assert.equal(w.flowHits, 1, `한 발로 중이 ${w.flowHits}이 됐다`)
  })

  it('실중이면 즉시 끊긴다', () => {
    const w = createWorld(arena(3), STATS)
    w.flowHits = Math.floor(P.flow.molgiAt)
    w.molgi = true
    // 과녁(x 8~10.7) 앞의 맨땅에 처박는다 — 확실한 실중.
    shoot(w, 5, 0)
    assert.equal(w.flowHits, 0, '빗나갔는데 중이 남아 있다')
    assert.equal(w.molgi, false, '빗나갔는데 몰기가 살아 있다')
  })

  it('몰기 진입·이탈이 이벤트로 나간다 (연출과 소리가 이 순간을 받는다)', () => {
    const w = createWorld(arena(8), STATS)
    const on: number[] = []
    let guard = 0
    while (w.flowHits < P.flow.molgiAt && guard < 12) {
      guard++
      const t = w.targets.find((x) => x !== undefined && x.alive)
      if (t === undefined) break
      const before = w.events.length
      shoot(w, t.x, t.y)
      for (let i = before; i < w.events.length; i++) {
        const e = w.events[i]
        if (e !== undefined && e.t === 'molgi' && e.on) on.push(w.flowHits)
      }
    }
    assert.equal(w.molgi, true, `${w.flowHits}중인데 몰기가 아니다`)
    assert.equal(on.length, 1, '몰기 진입 이벤트가 정확히 한 번 나오지 않았다')
  })

  it('망설이면 식는다 — 단, 화살이 나는 동안은 안 센다', () => {
    const w = createWorld(arena(3), STATS)
    w.flowHits = 3
    // 활도 안 잡고 화살도 없다 → 식는다.
    const steps = Math.ceil(P.flow.coolAfter / w.dt) + 2
    for (let i = 0; i < steps; i++) step(w, IDLE)
    assert.equal(w.flowHits, 2, '무행동인데 안 식었다')

    // 화살이 나는 동안은 시계가 안 간다 — 비행 시간은 벌이 아니다.
    const w2 = createWorld(arena(3), STATS)
    w2.flowHits = 3
    const hold: InputFrame = { aimX: 60, aimY: 9, drawing: true, steady: false }
    const rest: InputFrame = { aimX: 60, aimY: 9, drawing: false, steady: false }
    for (let i = 0; i < 600 && w2.archer.phase !== 'full'; i++) step(w2, hold)
    step(w2, rest)
    // 화살이 아직 나는 동안만 돌린다.
    for (let i = 0; i < steps; i++) {
      let flying = false
      for (const a of w2.arrows) if (a !== undefined && a.alive && a.outcome === 'flying') flying = true
      if (!flying) break
      step(w2, rest)
    }
    assert.ok(w2.flowIdle < P.flow.coolAfter, '화살이 나는 동안 식음 시계가 갔다')
  })

  it('★ 연사는 정확도를 건드리지 않는다 — 빨간 바 계약 (GDD 1장)', () => {
    // 같은 조준·같은 만작이면, 0중이든 몰기든 **화살이 같은 각으로 나가야 한다.**
    function releaseAngle(hits: number): number {
      const w = createWorld(arena(1), STATS)
      w.flowHits = hits
      const hold: InputFrame = { aimX: 30, aimY: 4, drawing: true, steady: false }
      const rest: InputFrame = { aimX: 30, aimY: 4, drawing: false, steady: false }
      for (let i = 0; i < 600 && w.archer.phase !== 'full'; i++) step(w, hold)
      const before = w.events.length
      step(w, rest)
      for (let i = before; i < w.events.length; i++) {
        const e = w.events[i]
        if (e !== undefined && e.t === 'release') return e.err
      }
      throw new Error('release 이벤트가 없다')
    }
    assert.equal(releaseAngle(0), 0, '안전 구간 만작인데 오차가 0이 아니다')
    assert.equal(releaseAngle(Math.floor(P.flow.molgiAt)), 0, '몰기가 오차를 만들었다')
  })

  it('연사는 스태미나를 덜 쓰게 하되 하한이 있다', () => {
    const w = createWorld(arena(1), STATS)
    assert.equal(flowDrainMul(w), 1)
    w.flowHits = 100
    assert.equal(flowDrainMul(w), P.flow.drainFloor)
    assert.ok(P.flow.drainFloor > 0, '소모가 0이 되면 스태미나 축이 사라진다')
  })

  it('판이 바뀌면 연사는 처음부터다 (판 안의 리듬이다)', () => {
    const w = createWorld(arena(3), STATS)
    w.flowHits = 4
    w.flowIdle = 1.2
    w.molgi = true
    resetWorld(w, arena(3), STATS)
    assert.equal(w.flowHits, 0)
    assert.equal(w.flowIdle, 0)
    assert.equal(w.molgi, false)
  })

  it('결정론 — 같은 입력이면 같은 연사 상태 (A1)', () => {
    function run(): string {
      const w = createWorld(arena(5), STATS)
      const marks: string[] = []
      for (let s = 0; s < 5; s++) {
        const t = w.targets.find((x) => x !== undefined && x.alive)
        if (t === undefined) break
        shoot(w, t.x, t.y)
        marks.push(`${w.flowHits}/${w.molgi ? 1 : 0}/${flowDrawMul(w).toFixed(6)}`)
      }
      return marks.join(' ')
    }
    assert.equal(run(), run())
  })
})
