/**
 * 물리 불변식 테스트 (ARCHITECTURE A7)
 *
 * 구현 세부를 흉내내지 않는다. "이 값이 정확히 3.2여야 한다" 같은 테스트는
 * 튜닝 한 번에 전부 빨개져서 아무도 안 고치게 된다.
 * 대신 **어떤 튜닝값에서도 참이어야 하는 것**만 못 박는다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { spawnArrow } from '../src/sim/ballistics.ts'
import { P } from '../src/tune/params.ts'
import type { Arrow, InputFrame, Stats, StageDef, World } from '../src/sim/types.ts'

// ───────────────────────── 픽스처 ─────────────────────────

const STATS: Stats = { str: 6, steady: 5, stamina: 6, focus: 4 }

function makeStage(over: Partial<StageDef> = {}): StageDef {
  const base: StageDef = {
    id: 'phys',
    seed: 0x1234,
    arrows: 8,
    targetScore: 999999, // 클리어로 판이 일찍 끝나면 불변식 관찰 구간이 짧아진다
    wind: 0,
    targets: [{ kind: 'static', x: 18, y: 1.6, r: 0.4, score: 100 }],
  }
  return { ...base, ...over }
}

function must<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`${what} 가 undefined`)
  return v
}

function aimAt(w: World, dx: number, dy: number, drawing: boolean, steady: boolean): InputFrame {
  return { aimX: w.archer.x + dx, aimY: w.archer.y + dy, drawing, steady }
}

/** 화살의 역학적 에너지 (운동 + 위치). 중력은 에너지를 옮길 뿐 넣지 않는다. */
function mechEnergy(a: Arrow): number {
  const m = P.arrow.mass
  return 0.5 * m * (a.vx * a.vx + a.vy * a.vy) + m * P.arrow.gravity * a.y
}

/** World 안의 모든 숫자가 유한한지. NaN 한 개면 판 전체가 죽는다. */
function assertFinite(w: World, ctx: string): void {
  const a = w.archer
  const scalars: ReadonlyArray<readonly [string, number]> = [
    ['tick', w.tick], ['dt', w.dt], ['wind', w.wind], ['windPhase', w.windPhase],
    ['score', w.score], ['combo', w.combo], ['elapsed', w.elapsed], ['arrowsLeft', w.arrowsLeft],
    ['archer.x', a.x], ['archer.y', a.y], ['aimAngle', a.aimAngle],
    ['tremorOffset', a.tremorOffset], ['tremorAmp', a.tremorAmp], ['tremorPhase', a.tremorPhase],
    ['draw', a.draw], ['drawTime', a.drawTime], ['holdTime', a.holdTime],
    ['stamina', a.stamina], ['staminaMax', a.staminaMax], ['regenLock', a.regenLock],
    ['steadyTime', a.steadyTime], ['steadyBlend', a.steadyBlend], ['warn', a.warn],
  ]
  for (const [name, v] of scalars) {
    assert.ok(Number.isFinite(v), `${ctx}: archer/world ${name} = ${v}`)
  }
  let i = 0
  for (const ar of w.arrows) {
    if (ar.alive) {
      const vals: ReadonlyArray<readonly [string, number]> = [
        ['x', ar.x], ['y', ar.y], ['px', ar.px], ['py', ar.py],
        ['vx', ar.vx], ['vy', ar.vy], ['angle', ar.angle], ['age', ar.age], ['power', ar.power],
      ]
      for (const [name, v] of vals) {
        assert.ok(Number.isFinite(v), `${ctx}: arrow[${i}].${name} = ${v}`)
      }
    }
    i++
  }
  let ti = 0
  for (const t of w.targets) {
    const vals: ReadonlyArray<readonly [string, number]> = [
      ['x', t.x], ['y', t.y], ['vx', t.vx], ['vy', t.vy], ['r', t.r],
    ]
    for (const [name, v] of vals) {
      assert.ok(Number.isFinite(v), `${ctx}: target[${ti}].${name} = ${v}`)
    }
    ti++
  }
}

// ───────────────────────── 에너지 ─────────────────────────

describe('화살 에너지', () => {
  /**
   * 발사 후 화살은 에너지를 잃기만 한다.
   * 순수 운동에너지는 낙하 중 늘어나므로(중력이 위치에너지를 옮긴다) 역학적 에너지로 본다.
   * 바람을 "가속도"로 더하는 구현은 여기서 즉시 걸린다 — params.ts wind.effect 주석의 요구사항.
   */
  for (const wind of [0, P.wind.maxSpeed, -P.wind.maxSpeed]) {
    it(`역학적 에너지는 증가하지 않는다 (바람 ${wind} m/s)`, () => {
      const w = createWorld(makeStage({ wind, targets: [] }), STATS)
      const idle = aimAt(w, 10, 0, false, false)

      // 완만한 사격부터 고각 로브샷까지. 로브샷 정점에서 바람 상대속도가 가장 작아진다.
      for (const angle of [-0.15, 0.05, 0.35, 0.8]) {
        const a = spawnArrow(w, angle, 1)
        assert.ok(a !== null, `spawnArrow 가 null (angle=${angle}) — 풀 크기/arrowsLeft 확인`)
      }

      const n = w.arrows.length
      const prev = new Float64Array(n)
      const start = new Float64Array(n)
      const seen = new Uint8Array(n)

      for (let s = 0; s < 900; s++) {
        step(w, idle)
        let i = 0
        for (const ar of w.arrows) {
          if (!ar.alive || ar.outcome !== 'flying') {
            i++
            continue
          }
          const e = mechEnergy(ar)
          assert.ok(Number.isFinite(e), `arrow[${i}] 에너지가 NaN`)
          if (seen[i] === 0) {
            seen[i] = 1
            start[i] = e
            prev[i] = e
          } else {
            const e0 = Math.abs(must(start[i], 'start'))
            const last = must(prev[i], 'prev')
            // 스텝 단위 허용치: 바람 상대속도 항력의 수치 잡음만 통과시킨다.
            const stepTol = 1e-4 * e0 + 1e-9
            assert.ok(
              e <= last + stepTol,
              `arrow[${i}] 스텝 ${s}: 에너지 증가 ${last} → ${e} (+${e - last} J)`,
            )
            // 누적 상한: 스텝마다 조금씩 새는 에너지 주입을 잡는다.
            const totalTol = 0.01 * e0 + 1e-9
            assert.ok(
              e <= must(start[i], 'start') + totalTol,
              `arrow[${i}] 스텝 ${s}: 발사 시점 대비 에너지 증가 ${start[i]} → ${e}`,
            )
            prev[i] = e
          }
          i++
        }
      }

      assert.ok(seen.some((v) => v === 1), '화살이 한 발도 비행하지 않았다 — 테스트가 헛돌았다')
    })
  }
})

// ───────────────────────── 범위 불변식 ─────────────────────────

describe('궁수 상태 범위', () => {
  it('스태미나는 항상 [0, staminaMax], draw는 항상 [0,1]', () => {
    const w = createWorld(makeStage(), STATS)
    // 만작 + 호흡정지를 계속 물고 늘어지는, 가장 가혹한 입력
    const grind = aimAt(w, 16, 2, true, true)
    const rest = aimAt(w, 16, 2, false, false)

    for (let s = 0; s < 4000; s++) {
      // 붕괴 → 회복 → 재당김 사이클을 전부 지나가게 한다
      step(w, s % 900 < 700 ? grind : rest)
      const a = w.archer
      assert.ok(a.staminaMax > 0, `staminaMax=${a.staminaMax}`)
      assert.ok(a.stamina >= 0 && a.stamina <= a.staminaMax,
        `스텝 ${s}: stamina=${a.stamina} (max ${a.staminaMax})`)
      assert.ok(a.draw >= 0 && a.draw <= 1, `스텝 ${s}: draw=${a.draw}`)
      assert.ok(a.steadyBlend >= 0 && a.steadyBlend <= 1, `스텝 ${s}: steadyBlend=${a.steadyBlend}`)
      assert.ok(a.warn >= 0 && a.warn <= 1, `스텝 ${s}: warn=${a.warn}`)
      assert.ok(a.tremorAmp >= 0, `스텝 ${s}: tremorAmp=${a.tremorAmp}`)
      w.events.length = 0
    }
  })

  it('입력을 매 스텝 뒤집어도 범위가 깨지지 않는다', () => {
    const w = createWorld(makeStage(), STATS)
    const on = aimAt(w, 16, 2, true, true)
    const off = aimAt(w, 16, 2, false, false)
    for (let s = 0; s < 1200; s++) {
      step(w, s % 2 === 0 ? on : off)
      const a = w.archer
      assert.ok(a.stamina >= 0 && a.stamina <= a.staminaMax, `스텝 ${s}: stamina=${a.stamina}`)
      assert.ok(a.draw >= 0 && a.draw <= 1, `스텝 ${s}: draw=${a.draw}`)
      w.events.length = 0
    }
  })
})

// ───────────────────────── NaN ─────────────────────────

describe('NaN 내성', () => {
  it('극단 입력에서도 NaN이 나오지 않는다', () => {
    // 조준각 0 / PI / 수직, 손 위치와 완전히 겹치는 조준점, 말도 안 되는 좌표
    const aims: ReadonlyArray<readonly [number, number]> = [
      [10, 0], [-10, 0], [0, 10], [0, -10], [0, 0],
      [1e6, 1e6], [-1e6, 1e-9], [1e-9, -1e6],
    ]
    for (const [dx, dy] of aims) {
      const w = createWorld(makeStage({ wind: P.wind.maxSpeed }), STATS)
      const hold = aimAt(w, dx, dy, true, true)
      const release = aimAt(w, dx, dy, false, false)
      for (let s = 0; s < 1500; s++) {
        step(w, s % 700 < 650 ? hold : release)
        assertFinite(w, `조준(${dx},${dy}) 스텝 ${s}`)
        w.events.length = 0
      }
    }
  })

  it('스태미나 0 상태를 오래 유지해도 NaN이 없다', () => {
    const w = createWorld(makeStage(), STATS)
    const hold = aimAt(w, 16, 2, true, true)
    // 스태미나를 바닥에 붙여둔 채로 계속 당긴다 (붕괴 직후 재당김 반복)
    for (let s = 0; s < 3000; s++) {
      step(w, hold)
      assertFinite(w, `스태미나 고갈 스텝 ${s}`)
      w.events.length = 0
    }
  })
})

// ───────────────────────── 붕괴 예고 ─────────────────────────

describe('붕괴 예고 (feel-lens 요구사항)', () => {
  for (const steady of [false, true]) {
    it(`붕괴 전 경고가 ${P.stamina.collapseWarnMinTime}s 이상 지속된다 (호흡정지 ${steady ? 'ON' : 'OFF'})`, () => {
      const w = createWorld(makeStage(), STATS)
      const hold = aimAt(w, 16, 2, true, steady)

      let warnTick = -1
      let collapseTick = -1
      const limit = 60 * Math.round(1 / w.dt)

      for (let s = 0; s < limit && collapseTick < 0; s++) {
        step(w, hold)
        for (const e of w.events) {
          if (e.t === 'warn_start' && warnTick < 0) warnTick = w.tick
          if (e.t === 'collapse') collapseTick = w.tick
        }
        // 이벤트를 놓쳐도 warn 값으로 예고 시작을 잡는다 (렌더가 실제로 보는 신호)
        if (warnTick < 0 && w.archer.warn > 0) warnTick = w.tick
        w.events.length = 0
      }

      assert.ok(collapseTick > 0, '만작을 계속 유지했는데 붕괴가 일어나지 않았다')
      assert.ok(warnTick > 0, '예고 없이 붕괴했다 — warn 신호도, warn_start 이벤트도 없었다')

      const warnTime = (collapseTick - warnTick) * w.dt
      assert.ok(
        warnTime >= P.stamina.collapseWarnMinTime - w.dt,
        `경고 시간 ${warnTime.toFixed(3)}s < 최소 ${P.stamina.collapseWarnMinTime}s. ` +
          '예고 없는 붕괴는 "게임이 나를 배신했다"가 된다.',
      )
    })
  }
})

// ───────────────────────── 터널링 ─────────────────────────

describe('터널링 방지', () => {
  // 120Hz에서 60m/s면 한 스텝에 0.5m 이동한다. 반경 0.15m 과녁은 점 판정으로는 통째로 뛰어넘는다.
  for (const dist of [3, 6]) {
    it(`60m/s 화살이 ${dist}m 앞 반경 0.15m 과녁을 통과해 지나치지 않는다`, () => {
      const w = createWorld(makeStage(), STATS)
      const t = must(w.targets[0], 'targets[0]')

      // 과녁을 화살 경로 정중앙에 놓는다. 이동 성분은 전부 죽인다.
      t.alive = true
      t.kind = 'static'
      t.x = w.archer.x + dist
      t.y = w.archer.y
      t.px = t.x
      t.py = t.y
      t.baseX = t.x
      t.baseY = t.y
      t.vx = 0
      t.vy = 0
      t.ampX = 0
      t.ampY = 0
      t.freq = 0
      t.r = 0.15

      const a = spawnArrow(w, 0, 1)
      assert.ok(a !== null, 'spawnArrow 가 null')
      const arrow = a as Arrow
      // 발사 파라미터에 의존하지 않도록 운동상태를 직접 못 박는다.
      arrow.x = w.archer.x
      arrow.y = w.archer.y
      arrow.px = arrow.x
      arrow.py = arrow.y
      arrow.vx = 60
      arrow.vy = 0
      arrow.angle = 0
      arrow.age = 0
      arrow.outcome = 'flying'

      const idle = aimAt(w, 10, 0, false, false)
      let hit = false
      const steps = Math.ceil((dist / 60) / w.dt) + 8
      for (let s = 0; s < steps && !hit; s++) {
        step(w, idle)
        for (const e of w.events) {
          if (e.t === 'hit' && e.targetId === t.id) hit = true
        }
        if (!t.alive) hit = true
        w.events.length = 0
      }

      assert.ok(
        hit,
        `화살이 과녁을 뚫고 지나갔다 (터널링). ` +
          `화살 x=${arrow.x.toFixed(3)}, 과녁 x=${t.x.toFixed(3)}, ` +
          `스텝당 이동 ${(60 * w.dt).toFixed(3)}m vs 지름 ${(2 * t.r).toFixed(3)}m — ` +
          '점 판정 대신 선분-원 판정(core/math.ts distSqPointSegment)을 써야 한다.',
      )
    })
  }
})
