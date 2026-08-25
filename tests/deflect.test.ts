/**
 * 맞불 — 내 화살이 적 화살을 공중에서 쳐낸다 (형: "내 화살로 적 화살을 튕겨낼 수 있게").
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { spawnArrow } from '../src/sim/ballistics.ts'
import type { InputFrame, StageDef, Stats } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 8, focus: 6 }
const IDLE: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false }

describe('맞불', () => {
  it('마주 나는 두 화살이 만나면 적 화살이 죽고 deflect가 튄다', () => {
    const def: StageDef = {
      id: 'deflect', seed: 3, arrows: 5, targetScore: 100, wind: 0,
      targets: [{ kind: 'static', x: 30, y: 8, r: 0.3, score: 100 }],
    }
    const w = createWorld(def, STATS, 'basic')
    // 적 화살을 손으로 심는다 — 궁수를 향해 수평으로 날아온다.
    const sh = w.shots[0]
    assert.ok(sh !== undefined, '적 화살 풀이 비어 있다')
    sh.alive = true
    sh.x = 20
    sh.y = w.archer.y
    sh.px = 20
    sh.py = w.archer.y
    sh.vx = -18
    // 교차 시점(t=0.24s)에 내 화살과 같은 높이가 되는 초기 상승 속도 — 판정 반경 0.3m 안.
    sh.vy = 1.2
    // 내 화살 — 정면으로 마주 쏜다.
    assert.notEqual(spawnArrow(w, 0.02, 1), null)
    let deflected = false
    let hurt = false
    for (let i = 0; i < 240; i++) {
      step(w, IDLE)
      for (const e of w.events) {
        if (e.t === 'deflect') deflected = true
        if (e.t === 'player_hit') hurt = true
      }
      w.events.length = 0
    }
    assert.ok(deflected, '정면으로 마주친 화살이 안 튕겼다')
    assert.ok(!hurt, '튕겼는데도 맞았다')
  })
})
