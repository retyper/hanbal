/**
 * 지형 — 언덕과 높낮이 (2026-09-03, 형: "언덕이랑 높낮이차 이런 것 있는 스테이지들 구현해야지").
 *
 * 지키는 것 넷:
 *  1. 꺾은선 보간 — 점 사이는 직선, 바깥은 끝값.
 *  2. **궁수의 발밑은 언제나 0** — 캠페인·무한 어느 판이든.
 *  3. 저작 y는 땅에서 잰 높이다 — 언덕 위 과녁은 실제로 그만큼 높이 선다. 화살은 언덕에 꽂힌다.
 *  4. 달려오는 사람은 땅을 따라 오른다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { groundAt, groundPeak, hasHills } from '../src/sim/terrain.ts'
import { createWorld, step } from '../src/sim/world.ts'
import { getStage, CAMPAIGN } from '../src/game/stages.ts'
import { ENDLESS_THEMES } from '../src/game/endless.ts'
import type { InputFrame, StageDef, Stats } from '../src/sim/types.ts'
import { P } from '../src/tune/params.ts'

const STATS: Stats = { str: 14, steady: 8, stamina: 12, focus: 6 }

const HILL: StageDef = {
  id: 'hill-test', seed: 3, arrows: 9, targetScore: 100, wind: 0,
  ground: [{ x: 4, y: 0 }, { x: 12, y: 3 }, { x: 20, y: 0 }],
  targets: [
    { kind: 'static', x: 12, y: 1.0, r: 0.4, score: 100 },
    { kind: 'static', x: 60, y: 10, r: 0.2, score: 0 },
  ],
}

describe('지형 — 꺾은선', () => {
  it('점 사이는 직선, 바깥은 끝값, 없으면 0', () => {
    assert.equal(groundAt(HILL, 0), 0)
    assert.equal(groundAt(HILL, 8), 1.5)
    assert.equal(groundAt(HILL, 12), 3)
    assert.equal(groundAt(HILL, 16), 1.5)
    assert.equal(groundAt(HILL, 99), 0)
    assert.equal(groundPeak(HILL), 3)
    assert.ok(hasHills(HILL))
    const { ground: _g, ...flat } = HILL
    void _g
    assert.equal(groundAt(flat, 12), 0)
    assert.equal(hasHills(flat), false)
  })

  it('캠페인과 무한 구간 어디서든 궁수의 발밑(x≤2)은 0이다', () => {
    let hilly = 0
    for (let i = 0; i < CAMPAIGN + ENDLESS_THEMES * 2; i++) {
      const s = getStage(i)
      if (hasHills(s)) hilly++
      assert.equal(groundAt(s, 0), 0, `${i + 1}판 궁수 발밑`)
      assert.equal(groundAt(s, 2), 0, `${i + 1}판 궁수 앞`)
      const g = s.ground
      if (g === undefined) continue
      for (let k = 1; k < g.length; k++) {
        const a: { x: number; y: number } | undefined = g[k - 1]
        const b: { x: number; y: number } | undefined = g[k]
        if (a !== undefined && b !== undefined) assert.ok(b.x > a.x, `${i + 1}판 땅 x 오름차순`)
      }
      assert.ok(groundPeak(s) <= 5, `${i + 1}판 봉우리 ${groundPeak(s)}m — 너무 높다`)
    }
    assert.ok(hilly >= 4, `언덕 판이 ${hilly}개 — 캠페인 셋 + 무한 테마 둘은 있어야 한다`)
  })
})

describe('지형 — 세계', () => {
  it('저작 y는 땅에서 잰 높이다 — 언덕 위 과녁은 언덕만큼 높이 선다', () => {
    const w = createWorld(HILL, STATS, 'basic')
    const t = w.targets[0]
    assert.ok(t !== undefined)
    assert.ok(Math.abs(t.y - 4.0) < 1e-9, `과녁 y ${t.y} = 1.0 + 언덕 3.0`)
  })

  it('화살은 언덕에 꽂힌다 — 평지(y=0)까지 내려가지 않는다', () => {
    // 언덕 비탈(x≈8, 땅 1.5m)로 낮게 쏜다. 화살이 땅 0까지 내려가면 언덕을 뚫은 것이다.
    const w = createWorld(HILL, STATS, 'basic')
    const frame: InputFrame = { aimX: 8, aimY: 1.2, drawing: true, steady: false }
    for (let i = 0; i < 30; i++) step(w, frame)
    frame.drawing = false
    let minY = Infinity
    let landedAt = NaN
    for (let i = 0; i < 400; i++) {
      step(w, frame)
      for (const a of w.arrows) {
        if (a.alive && a.y < minY) minY = a.y
        if (!a.alive && Number.isNaN(landedAt) && a.age > 0) landedAt = a.x
      }
    }
    assert.ok(minY > 0.3, `화살 최저 높이 ${minY.toFixed(2)} — 언덕 안으로 파고들었다`)
  })

  it('달려오는 사람은 땅을 따라 오른다', () => {
    const stage: StageDef = {
      ...HILL,
      targets: [{ kind: 'charger', x: 18, y: 0, r: 0.6, speed: 4, score: 100 }, { kind: 'static', x: 60, y: 10, r: 0.2, score: 0 }],
    }
    const w = createWorld(stage, STATS, 'basic')
    const idle: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false }
    const c = w.targets[0]
    assert.ok(c !== undefined)
    let peakY = -Infinity
    for (let i = 0; i < 200 && c.alive; i++) {
      step(w, idle)
      if (c.y > peakY) peakY = c.y
      // 발이 땅에 있다: 중심 = 땅 + 반경 (±흔들림 0.2m 이내)
      const g = groundAt(stage, c.x)
      assert.ok(Math.abs(c.y - (g + c.r)) < P.target.chargeBob + 0.05, `x=${c.x.toFixed(1)} y=${c.y.toFixed(2)} 땅 ${g.toFixed(2)}`)
    }
    assert.ok(peakY > 2.5, `언덕 꼭대기(3m)를 지났어야 한다 — 최고 ${peakY.toFixed(2)}`)
  })
})
