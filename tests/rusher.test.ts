/**
 * 돌진하는 적과 **종(種)의 일관성** (2026-08-31, 형의 반려).
 *
 * 형: "척후는 비행체가 아니라 칼을 들고 나에게 달려오는 사람모습이어야해. 그리고
 *      비행체라면 비행체라고 해야하고. 비행체는 죽을때 사람시체로 쓰면 안돼.
 *      비행체 잔해여야지(드론이아니다이건)"
 *
 * 예전 돌진은 **삼각형 + 꼬리 둘**로 그려졌다 — 누가 봐도 날아오는 물건인데, 죽으면
 * 사람 시체가 남았다. 본 것과 남는 것이 다른 종이었던 것이다. 여기서 지키는 것은 넷이다.
 *   1. 돌진은 **땅을 딛는다** — 중심 높이가 곧 반경이다. 떠 있으면 사람으로 그릴 수 없다.
 *   2. 돌진은 **사람보다 작아지지 않는다** — 각크기 규칙에도 하한이 있다.
 *   3. 돌진이 죽으면 **사람 시체**(look 0)가 남는다. 그림이 사람이니 남는 것도 사람이다.
 *   4. 드론이 죽으면 **잔해**(look 3)가 남는다. 기계는 사람처럼 눕지 않는다.
 *
 * ★ 3·4가 이 파일의 핵심이다. 새 적을 그릴 때는 **사람인가 기계인가를 먼저 정하고**,
 *   그림(render/foe.ts·scene.ts)과 시체(render/effects.ts drawCorpses)를 같은 쪽에 둬라.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { spawnArrow } from '../src/sim/ballistics.ts'
import { getStage } from '../src/game/stages.ts'
import { P } from '../src/tune/params.ts'
import type { InputFrame, StageDef, Stats } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 8, focus: 6 }
const IDLE: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false }

/** 한 발 쏘고 판이 멎을 때까지 돌린다. 그동안의 이벤트를 전부 모은다. */
function shoot(stage: StageDef, angle: number): Array<Record<string, unknown>> {
  const w = createWorld(stage, STATS)
  const out: Array<Record<string, unknown>> = []
  spawnArrow(w, angle, 1)
  for (let i = 0; i < 900; i++) {
    step(w, IDLE)
    for (const e of w.events) out.push({ ...e } as Record<string, unknown>)
    w.events.length = 0
  }
  return out
}

/** (tx, ty)를 겨누는 각. 과녁을 전부 꺼두고 궤적만 본다. */
function aimAt(make: () => StageDef, tx: number, ty: number): number {
  let best = 0
  let bestErr = Number.POSITIVE_INFINITY
  for (let deg = -2; deg <= 40; deg += 0.05) {
    const ang = (deg * Math.PI) / 180
    const w = createWorld(make(), STATS)
    for (const t of w.targets) t.alive = false
    const a = spawnArrow(w, ang, 1)
    if (a === null) continue
    for (let i = 0; i < 600; i++) {
      step(w, IDLE)
      w.events.length = 0
      if (!a.alive) break
      if (a.x >= tx) {
        const err = Math.abs(a.y - ty)
        if (err < bestErr) { bestErr = err; best = ang }
        break
      }
    }
  }
  return best
}

describe('돌진하는 적 — 사람이다', () => {
  it('땅을 딛는다 — 저작이 어떤 높이를 주든 발이 지면에 닿는다', () => {
    for (const y of [0.2, 1.3, 3.2, 9]) {
      const w = createWorld({
        id: 'ground', seed: 1, arrows: 3, targetScore: 100, wind: 0,
        targets: [{ kind: 'charger', x: 20, y, r: 0.6, score: 100 }],
      }, STATS)
      const c = w.targets[0]
      assert.ok(c !== undefined)
      assert.equal(c.y - c.r, 0, `y=${y} 로 놓았더니 발끝이 ${(c.y - c.r).toFixed(2)}m 다`)
    }
  })

  it('사람보다 작아지지 않는다', () => {
    const w = createWorld({
      id: 'tiny', seed: 1, arrows: 3, targetScore: 100, wind: 0,
      targets: [{ kind: 'charger', x: 20, y: 2, r: 0.2, score: 100 }],
    }, STATS)
    assert.equal(w.targets[0]?.r, P.enemy.foeMinR)
  })

  it('죽으면 사람 시체가 남는다 (foe_down look 0)', () => {
    const make = (): StageDef => ({
      id: 'rusher-down', seed: 1, arrows: 3, targetScore: 100, wind: 0,
      targets: [{ kind: 'charger', x: 16, y: 0.6, r: 0.6, score: 100, speed: 0 }],
    })
    const evs = shoot(make(), aimAt(make, 16, 0.6))
    const down = evs.find((e) => e['t'] === 'foe_down')
    assert.ok(down !== undefined, '돌진이 죽었는데 아무것도 안 남았다')
    assert.equal(down['look'], 0, '돌진이 사람이 아닌 것으로 남았다')
  })
})

describe('드론 — 기계다', () => {
  it('죽으면 잔해가 남는다 (foe_down look 3)', () => {
    const make = (): StageDef => ({
      id: 'drone-down', seed: 1, arrows: 3, targetScore: 100, wind: 0,
      targets: [{ kind: 'archer', look: 3, x: 16, y: 2.2, r: 0.6, score: 100, hp: 1, fireDelay: 99 }],
    })
    const evs = shoot(make(), aimAt(make, 16, 2.2))
    const down = evs.find((e) => e['t'] === 'foe_down')
    assert.ok(down !== undefined, '드론이 죽었는데 아무것도 안 남았다')
    assert.equal(down['look'], 3, '기계가 사람 시체로 남았다 — 종이 어긋난다')
  })
})

describe('창가의 사수 — 창이 사람보다 작으면 안 된다', () => {
  /**
   * 창 크기는 사수 반경에서 나온다 (render/buildings.ts — 반높이 1.05r). 그래서 반경이
   * 작으면 창도 사람도 같이 작아진다. 형: "가끔 창문이 너무 작아서 적이 거의 안보이는
   * 경우 있는데 (…) 최소 적군사람 머리랑 상체 나올만큼은 크게 만들어."
   * 창 높이 = 2.1r 이 1m 는 돼야 머리와 가슴이 나온다 → r ≥ 0.48. 하한은 0.5다.
   */
  it('11~50판의 모든 사수가 하한 위에 있다', () => {
    let checked = 0
    for (let n = 11; n <= 50; n++) {
      for (const t of getStage(n - 1).targets) {
        if (t.kind !== 'archer') continue
        checked++
        const r = t.r ?? 0
        assert.ok(r >= P.enemy.foeMinR - 1e-9, `${n}판 사수의 반경이 ${r.toFixed(2)}m 다`)
        assert.ok(r * 2.1 >= 1, `${n}판의 창 높이가 ${(r * 2.1).toFixed(2)}m — 상체가 안 나온다`)
      }
    }
    assert.ok(checked > 40, `검사한 사수가 ${checked}뿐이다 — 판이 안 바뀐 것 아닌가`)
  })
})
