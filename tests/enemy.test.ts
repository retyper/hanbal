/**
 * 적 (docs/RUN.md 6장) — 적 궁수의 발사·예고, 플레이어 피격·사망, 판 주입 규칙.
 * 전부 결정론적 배선 검사다. 연출(실루엣·소리)은 형이 눈으로 판정한다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { getStage } from '../src/game/stages.ts'
import { P } from '../src/tune/params.ts'
import type { InputFrame, StageDef, Stats } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 8, focus: 6 }
const IDLE: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false }

function arena(fireDelay: number): StageDef {
  return {
    id: 'enemy-test',
    seed: 3,
    arrows: 8,
    targetScore: 100,
    wind: 0,
    targets: [
      { kind: 'archer', x: 18, y: 1.5, r: 0.65, hp: Math.floor(P.enemy.archerHp), fireDelay, score: 100 },
      // 빈 판 즉시 클리어 방지용 원거리 과녁
      { kind: 'static', x: 45, y: 8.5, r: 0.3, score: 0 },
    ],
  }
}

describe('적', () => {
  it('1~9판은 과녁뿐, 11판부터 적 궁수가 선다', () => {
    for (let i = 0; i < 9; i++) {
      assert.ok(!getStage(i).targets.some((t) => t.kind === 'archer'), `${i + 1}판에 적이 있다`)
    }
    assert.ok(getStage(10).targets.some((t) => t.kind === 'archer'), '11판에 적이 없다')
    // 보스판은 보스의 것 — 적 궁수를 얹지 않는다.
    assert.ok(!getStage(19).targets.some((t) => t.kind === 'archer'), '20판(보스)에 적 궁수가 있다')
  })

  it('적 궁수는 예고(enemy_draw) 후에 쏜다 (enemy_shot)', () => {
    const w = createWorld(arena(2.0), STATS)
    let drew = -1
    let shot = -1
    for (let i = 0; i < 240; i++) {
      step(w, IDLE)
      if (drew < 0 && w.events.some((e) => e.t === 'enemy_draw')) drew = w.elapsed
      if (shot < 0 && w.events.some((e) => e.t === 'enemy_shot')) shot = w.elapsed
      w.events.length = 0
      if (shot >= 0) break
    }
    assert.ok(drew >= 0, '예고가 없다')
    assert.ok(shot >= 0, '발사가 없다')
    assert.ok(shot - drew >= P.enemy.windup * 0.9, `예고→발사 간격이 ${(shot - drew).toFixed(2)}s뿐이다`)
    assert.ok(w.shots.some((s) => s.alive), '적 화살이 풀에 없다')
  })

  it('적 화살에 맞으면 체력이 깎이고, 0이면 여정이 끝날 판정(failed)이 난다', () => {
    // 조준 산포를 끄고 잰다 — 여기서 재는 건 명중률이 아니라 피격→사망 배선이다.
    const scatter = P.enemy.aimScatter
    ;(P.enemy as { aimScatter: number }).aimScatter = 0
    const w = createWorld(arena(0.5), STATS)
    // 한 발이면 눕는 체력에서 시작 — 피격 → 0 → failed 경로를 잰다.
    w.hp = Math.floor(P.enemy.arrowDamage)
    let hit = false
    for (let i = 0; i < 1200 && !hit; i++) {
      step(w, IDLE)
      if (w.events.some((e) => e.t === 'player_hit')) hit = true
      w.events.length = 0
    }
    ;(P.enemy as { aimScatter: number }).aimScatter = scatter
    assert.ok(hit, '적 화살이 궁수를 맞히지 못했다')
    assert.equal(w.hp, 0)
    assert.equal(w.status, 'failed', '체력 0인데 판이 계속된다')
  })

  it('과녁 뒤는 엄폐다 — 적 화살이 과녁에 박히고 나는 안 맞는다', () => {
    const scatter = P.enemy.aimScatter
    ;(P.enemy as { aimScatter: number }).aimScatter = 0
    // 적(18m)과 나 사이, 9m 지점에 큰 과녁 벽. 적의 사선이 반드시 걸린다.
    const def: StageDef = {
      id: 'cover-test', seed: 3, arrows: 8, targetScore: 100, wind: 0,
      targets: [
        { kind: 'archer', x: 18, y: 1.5, r: 0.65, hp: 100, fireDelay: 0.5, score: 100 },
        { kind: 'static', x: 9, y: 1.6, r: 2.2, score: 0 },
      ],
    }
    const w = createWorld(def, STATS)
    let blocked = false
    let hit = false
    for (let i = 0; i < 1500; i++) {
      step(w, IDLE)
      for (const e of w.events) {
        if (e.t === 'enemy_block') blocked = true
        if (e.t === 'player_hit') hit = true
      }
      w.events.length = 0
    }
    ;(P.enemy as { aimScatter: number }).aimScatter = scatter
    assert.ok(blocked, '적 화살이 과녁을 통과했다 — 엄폐가 없다')
    assert.ok(!hit, '과녁 뒤에 있는데 맞았다')
  })

  it('돌진 접촉은 체력을 깎는다 (화살 강탈이 아니라)', () => {
    const def: StageDef = {
      id: 'charge-test', seed: 5, arrows: 8, targetScore: 100, wind: 0,
      targets: [
        { kind: 'charger', x: 8, y: 1.5, r: 0.6, speed: 20, score: 50 },
        { kind: 'static', x: 45, y: 8.5, r: 0.3, score: 0 },
      ],
    }
    const w = createWorld(def, STATS)
    const arrowsBefore = w.arrowsLeft
    for (let i = 0; i < 600; i++) {
      step(w, IDLE)
      if (w.events.some((e) => e.t === 'player_hit')) break
    }
    assert.equal(w.hp, Math.floor(P.enemy.hpMax) - Math.floor(P.enemy.chargerDamage))
    assert.equal(w.arrowsLeft, arrowsBefore, '돌진이 아직도 화살을 훔친다')
  })
})
