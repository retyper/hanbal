/**
 * 화약 상자와 시체 (2026-08-31, 형의 반려 둘).
 *
 * ① **"터지는 과녁을 따로 만들지 말고 다이너마이트상자 (…) 그건 과녁으로 안치고 말이야."**
 *    상자(TargetKind 'barrel')는 과녁이 아니다 — 안 터뜨려도 판이 끝나야 하고,
 *    점수도 주지 않아야 한다.
 * ② **"적군들은 죽었을때 없어져버리지 말고 (…) 화살맞은 에너지와 물체의 질량에 따라."**
 *    적이 죽으면 'foe_down' 이 나가고, 거기에 그 죽음을 만든 **속도와 질량**이 실려 있어야 한다.
 *    (시체 자체는 렌더의 것이라 여기서 안 잰다 — sim은 상태를 만들지 않는다.)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { spawnArrow } from '../src/sim/ballistics.ts'
import { P } from '../src/tune/params.ts'
import type { InputFrame, StageDef, Stats } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 8, focus: 6 }
const IDLE: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false }

/** 한 발 쏘고 죽을 때까지 돌린다. 나온 이벤트를 전부 모은다. */
function shoot(stage: StageDef, angle: number, power = 1): {
  events: Array<Record<string, unknown>>
  status: string
} {
  const w = createWorld(stage, STATS, 'basic')
  const a = spawnArrow(w, angle, power)
  assert.ok(a !== null)
  const events: Array<Record<string, unknown>> = []
  for (let i = 0; i < 900; i++) {
    step(w, IDLE)
    for (const e of w.events) events.push({ ...e } as Record<string, unknown>)
    w.events.length = 0
    if (!a.alive) break
  }
  return { events, status: w.status }
}

/** 과녁 하나 + 상자 하나. 상자는 멀찍이 둔다 — 폭발이 과녁을 건드리면 검사가 흐려진다. */
function stageWithBarrel(): StageDef {
  return {
    id: 'barrel-test', seed: 1, arrows: 5, targetScore: 100, wind: 0,
    targets: [
      { kind: 'static', x: 34, y: 5.2, r: 0.7, score: 100 },
      { kind: 'barrel', x: 12, y: 1.2, r: 0.5, score: 0, bomb: true },
    ],
  }
}

/** 겨냥 각도 찾기 (tests/bomb.test.ts 와 같은 방식). */
function aimAt(make: () => StageDef, tx: number, ty: number): number {
  let best = 0
  let bestErr = Number.POSITIVE_INFINITY
  for (let deg = -5; deg <= 40; deg += 0.05) {
    const ang = (deg * Math.PI) / 180
    const w = createWorld(make(), STATS, 'basic')
    for (const t of w.targets) t.alive = false
    const a = spawnArrow(w, ang, 1)
    if (a === null) continue
    for (let i = 0; i < 900; i++) {
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

describe('화약 상자 — 과녁이 아니다', () => {
  it('상자를 남겨둬도 판은 클리어된다', () => {
    const r = shoot(stageWithBarrel(), aimAt(stageWithBarrel, 34, 5.2))
    assert.ok(r.events.some((e) => e['t'] === 'hit'), '과녁을 못 맞혔다 — 검사가 성립하지 않는다')
    assert.equal(r.status, 'cleared', '상자가 남아서 판이 안 끝났다')
  })

  it('상자를 맞히면 터진다', () => {
    const r = shoot(stageWithBarrel(), aimAt(stageWithBarrel, 12, 1.2))
    assert.ok(r.events.some((e) => e['t'] === 'burst'), '상자를 맞혔는데 안 터졌다')
  })

  it('상자는 점수를 주지 않는다', () => {
    const r = shoot(stageWithBarrel(), aimAt(stageWithBarrel, 12, 1.2))
    const hit = r.events.find((e) => e['t'] === 'hit')
    assert.ok(hit !== undefined, '상자를 못 맞혔다')
    assert.equal(hit['score'], 0)
  })
})

describe('쓰러진 적 — 없어지지 않고 남는다 (foe_down)', () => {
  /** 사수 하나. 한 발에 죽도록 체력을 1로 둔다. */
  function foeStage(): StageDef {
    return {
      id: 'foe-test', seed: 1, arrows: 5, targetScore: 100, wind: 0,
      targets: [{ kind: 'archer', x: 14, y: 1.6, r: 0.6, score: 100, hp: 1, look: 1, fireDelay: 99 }],
    }
  }

  it('적이 죽으면 foe_down 이 나간다', () => {
    const r = shoot(foeStage(), aimAt(foeStage, 14, 1.6))
    const down = r.events.filter((e) => e['t'] === 'foe_down')
    assert.equal(down.length, 1, `foe_down 이 한 번 나야 한다 (실제 ${down.length})`)
  })

  it('★ 거기 실린 것은 "그 죽음을 만든 충격"이다 — 속도와 질량', () => {
    const r = shoot(foeStage(), aimAt(foeStage, 14, 1.6))
    const down = r.events.find((e) => e['t'] === 'foe_down') as Record<string, number | undefined>
    // 화살은 오른쪽으로 날아가 맞혔으므로 vx > 0 이어야 한다. 몸이 왼쪽으로 날면 그건 거짓말이다.
    assert.ok((down['vx'] ?? 0) > 0, `vx=${(down['vx'] ?? 0)} — 화살이 온 방향과 반대다`)
    assert.ok(Math.abs((down['vx'] ?? 0)) > 5, '착탄 속도가 비현실적으로 작다')
    // 유엽전의 질량비. 육량전이면 더 커야 한다 (sim/arrowfx.ts mass).
    assert.ok((down['mass'] ?? 0) > 0, '질량이 안 실렸다')
  })

  it('과녁은 foe_down 을 내지 않는다 — 사람과 과녁은 다르게 남는다', () => {
    const r = shoot(stageWithBarrel(), aimAt(stageWithBarrel, 34, 5.2))
    assert.equal(r.events.filter((e) => e['t'] === 'foe_down').length, 0)
  })

  it('폭발로 죽은 적도 남는다 — 바깥으로 밀린다', () => {
    // 사수 옆에 상자를 붙여 두고 상자를 맞힌다.
    const make = (): StageDef => ({
      id: 'blast-foe', seed: 1, arrows: 5, targetScore: 100, wind: 0,
      targets: [
        { kind: 'barrel', x: 16, y: 1.4, r: 0.5, score: 0, bomb: true },
        { kind: 'archer', x: 17.6, y: 1.4, r: 0.5, score: 100, hp: 3, look: 1, fireDelay: 99 },
      ],
    })
    const r = shoot(make(), aimAt(make, 16, 1.4))
    const down = r.events.find((e) => e['t'] === 'foe_down') as Record<string, number> | undefined
    assert.ok(down !== undefined, '폭발로 죽은 적이 아무 흔적도 안 남겼다')
    // 상자(16)의 오른쪽에 있었으니 오른쪽으로 밀려야 한다.
    assert.ok((down['vx'] ?? 0) > 0, `vx=${(down['vx'] ?? 0)} — 폭발 중심 쪽으로 빨려 들어갔다`)
    assert.ok(Math.abs((down['vx'] ?? 0)) <= P.render.blastPush + 0.001, '폭발이 미는 속도의 상한을 넘었다')
  })
})
