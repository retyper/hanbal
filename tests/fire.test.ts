/**
 * 화전(火箭) — **어디서 끝나든 터진다** (2026-08-31, 형).
 *
 * 형: "화전은 어딜 맞춰도 폭발해야해. 심지어 땅에맞아도 터져야한다고.
 *      내발앞에 떨어지면 나도 데미지 맞아야지."
 *
 * 예전에는 폭발이 `resolveHit` 안에만 있었다 — **과녁을 맞혀야만** 터졌다.
 * 빗나간 화전은 그냥 흙에 꽂힌 막대기였고, 그래서 화전을 써도 "터지는 살"이라는
 * 느낌이 안 왔다. 여기서 지키는 것은 넷이다.
 *   1. 과녁을 못 맞히고 땅에 꽂혀도 burst 이벤트가 난다.
 *   2. 그 폭발이 **둘레의 과녁을 실제로 친다** (땅에 맞아도 손해만은 아니다).
 *   3. 발치에 떨어지면 **내 체력이 깎인다**.
 *   4. 다른 살(유엽전)은 땅에 꽂혀도 아무 일이 없다 — 화전만의 성질이다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { spawnArrow } from '../src/sim/ballistics.ts'
import { P } from '../src/tune/params.ts'
import type { ArrowKindId, InputFrame, StageDef, Stats } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 8, focus: 6 }
const IDLE: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false }

/** 과녁 하나가 머리 높이(y=1.7)에 서 있는 판. 그 밑 땅에 떨어뜨려도 반경 안이다. */
function nearGround(x: number): StageDef {
  return {
    id: 'fire-test', seed: 1, arrows: 9, targetScore: 100, wind: 0,
    targets: [{ kind: 'static', x, y: 1.7, r: 0.3, score: 100 }],
  }
}

/** 과녁이 아예 없는 판. 화살은 반드시 땅에 꽂힌다. */
function emptyField(): StageDef {
  return {
    id: 'fire-empty', seed: 1, arrows: 9, targetScore: 100, wind: 0,
    targets: [{ kind: 'static', x: 60, y: 8, r: 0.3, score: 100 }],
  }
}

/** 화살 한 발을 쏘고 죽을 때까지 돌린다. 그 동안 나온 이벤트를 전부 모아 돌려준다. */
function shoot(stage: StageDef, kind: ArrowKindId, angle: number, power = 1): {
  events: Array<Record<string, unknown>>
  hp: number
  hp0: number
  landedX: number
} {
  const w = createWorld(stage, STATS, kind)
  const hp0 = w.hp
  const a = spawnArrow(w, angle, power)
  assert.ok(a !== null, '화살이 안 나갔다')
  const events: Array<Record<string, unknown>> = []
  for (let i = 0; i < 900; i++) {
    step(w, IDLE)
    for (const e of w.events) events.push({ ...e } as Record<string, unknown>)
    w.events.length = 0
    if (!a.alive) break
  }
  assert.ok(!a.alive, '화살이 900스텝 안에 안 죽었다')
  assert.ok(hp0 > 0, '판 시작 체력이 0이다')
  return { events, hp: w.hp, hp0, landedX: a.x }
}

describe('화전 — 땅에 맞아도 터진다', () => {
  it('과녁을 못 맞히고 땅에 꽂혀도 burst 이벤트가 난다', () => {
    // 거의 수평으로 약하게 — 과녁(x=60)까지 못 가고 앞쪽 땅에 꽂힌다.
    const r = shoot(emptyField(), 'burst', 0.05, 0.35)
    const bursts = r.events.filter((e) => e['t'] === 'burst')
    assert.equal(bursts.length, 1, `땅 폭발이 한 번 나야 한다 (실제 ${bursts.length})`)
    assert.equal(bursts[0]?.['radius'], P.arrowkind.burstRadius)
  })

  it('유엽전은 같은 자리에 꽂혀도 안 터진다', () => {
    const r = shoot(emptyField(), 'basic', 0.05, 0.35)
    assert.equal(r.events.filter((e) => e['t'] === 'burst').length, 0)
  })

  it('땅 폭발이 둘레의 과녁을 친다', () => {
    // 과녁을 머리 높이(y=1.7)에 세운다 — 지면에 꽂히는 화살의 궤적과 안 겹치는 높이다.
    // 반경(2.2m) 안의 땅에 꽂히면 직격 없이도 과녁이 떨어져야 한다.
    const stage = nearGround(12)
    let hitByBlast = false
    let anyLanding = false
    for (let deg = 0; deg <= 40 && !hitByBlast; deg += 0.5) {
      for (let pw = 0.3; pw <= 1.001; pw += 0.05) {
        const r = shoot(stage, 'burst', (deg * Math.PI) / 180, pw)
        if (Math.abs(r.landedX - 12) < 1.5) anyLanding = true
        const direct = r.events.some((e) => e['t'] === 'hit')
        const chained = r.events.some((e) => e['t'] === 'chain')
        if (!direct && chained) {
          hitByBlast = true
          break
        }
      }
    }
    assert.ok(anyLanding, '과녁 근처 땅에 꽂힌 발이 하나도 없다 — 검사가 성립하지 않는다')
    assert.ok(hitByBlast, '직격 없이 땅 폭발만으로 과녁을 친 경우가 하나도 없다')
  })

  it('발치에 떨어지면 내 체력이 깎인다', () => {
    // 하늘로 쏘면 거의 제자리로 떨어진다 — 발밑 폭발이다.
    const r = shoot(emptyField(), 'burst', Math.PI / 2 - 0.02, 0.25)
    const mine = r.events.filter((e) => e['t'] === 'player_hit')
    assert.equal(mine.length, 1, `자해가 한 번 나야 한다 (실제 ${mine.length})`)
    assert.equal(r.hp, r.hp0 - Math.floor(P.arrowkind.burstSelfDamage), '체력이 그만큼 안 깎였다')
  })

  it('멀리 떨어지면 자해는 없다', () => {
    const r = shoot(emptyField(), 'burst', 0.05, 0.7)
    assert.ok(r.landedX > P.arrowkind.burstRadius, '너무 가까이 떨어져 검사가 성립하지 않는다')
    assert.equal(r.events.filter((e) => e['t'] === 'player_hit').length, 0)
  })
})
