/**
 * 특수살 × 적 — "특수화살들 전부 제 기능 하는지 다 확인해"(형).
 *
 * 과녁 상대 검증은 arrows.test.ts·probe-arrows가 한다. 여기는 **적(체력으로 버티는 것)**
 * 상대로도 효과가 사는지를 잰다 — 화전이 버틴 보스에서 안 터지던 회귀가 이 구멍이었다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { spawnArrow } from '../src/sim/ballistics.ts'
import type { ArrowKindId, InputFrame, StageDef, Stats, World } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 8, focus: 6 }
const IDLE: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false }

/** 큰 보스(버틴다) + 곁의 잔몹 과녁 + 뒤의 과녁. 효과가 갈 곳을 깔아둔 배치다. */
function arena(): StageDef {
  return {
    id: 'foe-arena',
    seed: 9,
    arrows: 8,
    targetScore: 100,
    wind: 0,
    targets: [
      { kind: 'boss', x: 18, y: 2.2, r: 1.6, hp: 100000, speed: 0.0001, score: 150 },
      { kind: 'static', x: 18, y: 4.6, r: 0.5, score: 100 },   // 폭발·사슬이 물 이웃
      { kind: 'static', x: 24, y: 2.2, r: 0.6, score: 100 },   // 관통이 뚫고 갈 뒷줄
    ],
  }
}

function fire(w: World, ty: number): void {
  const ang = Math.atan2(ty - w.archer.y, 18) + 0.012
  assert.notEqual(spawnArrow(w, ang, 1), null)
}

function run(w: World, steps = 700): void {
  for (let i = 0; i < steps; i++) step(w, IDLE)
}

describe('특수살 × 적', () => {
  it('화전 — 버틴 보스 몸에서 터지고 이웃을 문다', () => {
    const w = createWorld(arena(), STATS, 'burst')
    fire(w, 2.2)
    run(w)
    assert.ok(w.events.some((e) => e.t === 'burst'), '폭발 이벤트가 없다')
    const neighbor = w.targets[1]
    assert.ok(neighbor !== undefined && !neighbor.alive, '폭발이 이웃 과녁을 못 물었다')
    const boss = w.targets[0]
    assert.ok(boss !== undefined && boss.alive, '보스가 죽었다 — 배치가 틀렸다')
  })

  it('명적 — 버틴 보스에서 다음 과녁으로 튄다 (범위 7.5m)', () => {
    const w = createWorld(arena(), STATS, 'chain')
    fire(w, 2.2)
    run(w)
    const neighbor = w.targets[1]
    assert.ok(neighbor !== undefined && !neighbor.alive, '사슬이 이웃으로 못 튀었다')
  })

  it('세전 — 보스 몸에서 갈라져 자식들이 추가타를 넣는다', () => {
    // 자식은 보스 몸속에서 태어나 같은 스텝에 다시 박힌다 — 살아있는 프레임이 없어
    // 개수로는 못 재고, **피해 총량**으로 잰다: 부모 1타 + 자식 2타면 유엽전의 두 배 이상.
    const dmgOf = (kind: ArrowKindId): number => {
      const w = createWorld(arena(), STATS, kind)
      fire(w, 2.2)
      run(w)
      const boss = w.targets[0]
      assert.ok(boss !== undefined)
      return 100000 - boss.hp
    }
    const basic = dmgOf('basic')
    const split = dmgOf('split')
    assert.ok(split > basic * 1.8, `세전 총피해(${split})가 유엽전(${basic})의 두 배 언저리에 못 미친다`)
  })

  it('애기살 — 적 궁수는 꿰뚫고 뒷줄을 마저 맞힌다 (보스는 못 뚫는다)', () => {
    const def: StageDef = {
      id: 'pierce-foe', seed: 9, arrows: 8, targetScore: 100, wind: 0,
      targets: [
        { kind: 'archer', x: 15, y: 2.2, r: 0.7, hp: 100000, fireDelay: 99, score: 100 },
        { kind: 'static', x: 22, y: 2.2, r: 0.6, score: 100 },
      ],
    }
    const w = createWorld(def, STATS, 'pierce')
    fire(w, 2.2)
    run(w)
    const behind = w.targets[1]
    assert.ok(behind !== undefined && !behind.alive, '애기살이 적 궁수를 못 뚫었다')
  })

  it('육량전 — 질량 배수만큼 보스가 더 아프다', () => {
    const dmgOf = (kind: ArrowKindId): number => {
      const w = createWorld(arena(), STATS, kind)
      fire(w, 2.2)
      run(w)
      const boss = w.targets[0]
      assert.ok(boss !== undefined)
      return 100000 - boss.hp
    }
    const basic = dmgOf('basic')
    const heavy = dmgOf('heavy')
    // 육량전은 느려서 착탄 속도가 낮다 — 그래도 질량 배수가 이겨서 더 아파야 한다.
    assert.ok(heavy > basic * 1.3, `육량전(${heavy})이 유엽전(${basic})보다 확실히 아프지 않다`)
  })
})
