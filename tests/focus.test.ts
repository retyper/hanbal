/**
 * 집중 — 만작 뒤에 차오르는 두 번째 게이지 (2026-08-31).
 *
 * 왜 생겼나: 만작에 닿으면 힘은 상한이고 그 뒤로 참는 것은 **100% 손해**였다
 * (`src/sim/bow.ts`: `a.draw` 가 만작에서 멈춘다). 그래서 최적 플레이가 언제나
 * "만작 뜨자마자 놓기"였고, 이 게임의 유일한 독창 메커닉인 떨림·빨간 바·호흡정지 구역에
 * **아무도 자발적으로 안 들어갔다.** 선택한 적 없는 메커닉은 메커닉이 아니라 벽이다.
 *
 * 여기서 지키는 것 넷:
 *  1. 만작 **전에는** 안 찬다 — 당기는 중에 차면 그건 그냥 당김의 일부다.
 *  2. 놓으면 0으로 돌아간다 — 다음 발이 지난 발의 집중을 물려받으면 안 된다.
 *  3. **결정론** (A1) — 같은 입력이면 언제 돌려도 같은 각.
 *  4. 대가가 있다 — 채우는 동안 스태미나가 준다. 공짜면 선택이 아니다.
 *
 * 정확도(다 차면 겨눈 자리에 꽂히는가)는 여기서 안 잰다 — 거리별 실측이라
 * `tools/probe-focus.ts` 의 몫이다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { P } from '../src/tune/params.ts'
import type { InputFrame, StageDef, Stats } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 8, focus: 6 }

function arena(): StageDef {
  return {
    id: 'focus-test', seed: 1, arrows: 9, targetScore: 100, wind: 0,
    targets: [{ kind: 'static', x: 40, y: 2, r: 0.5, score: 100 }],
  }
}

/** 당긴 채로 steps 스텝. 입력 객체를 그대로 돌려준다 (제자리 갱신). */
function hold(w: ReturnType<typeof createWorld>, steps: number, steady = false): InputFrame {
  const input: InputFrame = { aimX: 40, aimY: 2, drawing: true, steady }
  for (let i = 0; i < steps; i++) {
    step(w, input)
    w.events.length = 0
  }
  return input
}

describe('집중 — 언제 차는가', () => {
  it('만작 전에는 한 톨도 안 찬다', () => {
    const w = createWorld(arena(), STATS, 'basic')
    const input: InputFrame = { aimX: 40, aimY: 2, drawing: true, steady: false }
    for (let i = 0; i < 400; i++) {
      step(w, input)
      w.events.length = 0
      if (w.archer.phase === 'full') break
      assert.equal(w.archer.focus, 0, `만작 전(${w.archer.phase})인데 집중이 ${w.archer.focus}`)
    }
    assert.equal(w.archer.phase, 'full', '만작에 못 갔다 — 검사가 성립하지 않는다')
  })

  it('만작 뒤에는 찬다', () => {
    const w = createWorld(arena(), STATS, 'basic')
    hold(w, 400)
    assert.ok(w.archer.focus > 0, '만작을 400스텝 지났는데 집중이 0이다')
  })

  it('fillTime 만큼 참으면 가득 찬다', () => {
    const w = createWorld(arena(), STATS, 'basic')
    // 만작까지 + 채우는 시간. 호흡정지는 안 쓴다 — 스태미나가 두 배로 빠져 오히려 붕괴한다.
    hold(w, Math.ceil((P.bow.drawTime + P.focus.fillTime + 0.4) * P.sim.hz))
    assert.equal(w.archer.focus, 1)
  })

  it('가득 찬 그 스텝에 full_focus 가 한 번만 나간다', () => {
    const w = createWorld(arena(), STATS, 'basic')
    const input: InputFrame = { aimX: 40, aimY: 2, drawing: true, steady: false }
    let fired = 0
    for (let i = 0; i < Math.ceil((P.bow.drawTime + P.focus.fillTime + 1) * P.sim.hz); i++) {
      step(w, input)
      for (const e of w.events) if (e.t === 'full_focus') fired++
      w.events.length = 0
    }
    assert.equal(fired, 1, `full_focus 가 ${fired}번 나갔다`)
  })

  it('놓으면 0으로 돌아간다 — 다음 발이 물려받지 않는다', () => {
    const w = createWorld(arena(), STATS, 'basic')
    const input = hold(w, Math.ceil((P.bow.drawTime + P.focus.fillTime + 0.4) * P.sim.hz))
    assert.equal(w.archer.focus, 1)
    input.drawing = false
    step(w, input)
    assert.equal(w.archer.focus, 0)
  })
})

describe('집중 — 대가가 있다', () => {
  it('채우는 동안 스태미나가 준다 — 공짜면 선택이 아니다', () => {
    const w = createWorld(arena(), STATS, 'basic')
    hold(w, Math.ceil(P.bow.drawTime * P.sim.hz) + 20)
    const before = w.archer.stamina
    hold(w, Math.ceil(P.focus.fillTime * P.sim.hz))
    assert.ok(w.archer.stamina < before, `스태미나가 안 줄었다 (${before} → ${w.archer.stamina})`)
  })
})

describe('집중 — 결정론 (A1)', () => {
  it('같은 입력이면 같은 발사각이 나온다', () => {
    const shot = (): number => {
      const w = createWorld(arena(), STATS, 'basic')
      const input = hold(w, Math.ceil((P.bow.drawTime + P.focus.fillTime * 0.6) * P.sim.hz))
      input.drawing = false
      step(w, input)
      const e = w.events.find((ev) => ev.t === 'release')
      assert.ok(e !== undefined && e.t === 'release')
      return e.angle
    }
    assert.equal(shot(), shot())
  })

  it('집중이 클수록 더 위로 쏜다 — 먼 과녁의 낙차를 갚는 각이다', () => {
    const angleAt = (fillFrac: number): number => {
      const w = createWorld(arena(), STATS, 'basic')
      const input = hold(
        w,
        Math.ceil((P.bow.drawTime + P.focus.fillTime * fillFrac) * P.sim.hz),
      )
      input.drawing = false
      step(w, input)
      const e = w.events.find((ev) => ev.t === 'release')
      assert.ok(e !== undefined && e.t === 'release')
      return e.angle
    }
    const low = angleAt(0.05)
    const high = angleAt(1)
    assert.ok(high > low, `집중을 채웠는데 각이 안 올라갔다 (${low} → ${high})`)
  })
})
