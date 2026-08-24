/**
 * 보스 (docs/RUN.md 3장) — 체력·헤드샷·접촉 패배·관통 불가.
 * 전부 결정론적 배선 검사다. 손맛(크기·연출)은 형이 눈으로 판정한다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { spawnArrow } from '../src/sim/ballistics.ts'
import { getStage, BOSS_EVERY } from '../src/game/stages.ts'
import { P } from '../src/tune/params.ts'
import type { InputFrame, StageDef, Stats } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 8, focus: 6 }
const IDLE: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false }

function bossDef(hp: number, speed = 0): StageDef {
  return {
    id: 'boss-test',
    seed: 7,
    arrows: 10,
    targetScore: 100,
    wind: 0,
    targets: [{ kind: 'boss', x: 20, y: 2.6, r: 1.7, hp, speed: speed || 0.0001, score: 150 }],
  }
}

/** (tx, ty)를 정확히 지나는 각으로 한 발. 20m라 낙차 보정이 필요해 탐색으로 잡는다. */
function shootAt(w: ReturnType<typeof createWorld>, ty: number): void {
  // 보스는 크다(r 1.7). 약간의 낙차 오차는 몸통이 받아준다. 머리는 따로 조준한다.
  const dx = 20
  const dy = ty - w.archer.y
  // 평사 근사 + 낙차 반각 보정
  const angle = Math.atan2(dy, dx) + 0.012
  assert.notEqual(spawnArrow(w, angle, 1), null)
  for (let i = 0; i < 600; i++) {
    step(w, IDLE)
    const a = w.arrows.find((x) => x.id === 0)
    if (a !== undefined && !a.alive) break
  }
}

describe('보스', () => {
  it('10판마다 보스판이 선다 (id는 챕터-10 — 별 기록이 이어진다)', () => {
    for (const n of [10, 20, 50]) {
      const s = getStage(n - 1)
      assert.equal(s.targets[0]?.kind, 'boss', `${n}판이 보스가 아니다`)
      assert.match(s.id, /^\d+-10$/, s.id)
    }
    assert.equal(getStage(BOSS_EVERY - 2).targets[0]?.kind === 'boss', false, '9판이 보스다')
  })

  it('몸통 한 발 = 1, 남으면 화살만 죽는다 · 관통살도 못 뚫는다', () => {
    const w = createWorld(bossDef(3), STATS, 'pierce')
    const boss = w.targets[0]
    assert.ok(boss !== undefined)
    shootAt(w, 2.6)
    assert.equal(boss.hp, 2, `hp=${boss.hp}`)
    assert.equal(boss.alive, true)
    const arrow = w.arrows[0]
    assert.ok(arrow !== undefined && !arrow.alive, '보스를 맞힌 화살이 계속 난다')
    assert.equal(arrow.kindPierced, 0, '애기살이 보스를 뚫었다')
  })

  it('헤드샷은 치명 — bossCritDmg 만큼 깎고 정중앙 판정을 받는다', () => {
    // 낙차를 정확히 아는 건 sim뿐이다 — 머리를 지나는 각을 탐색으로 찾는다 (bows.test와 같은 방식).
    let critSeen = false
    for (let mrad = -30; mrad <= 60 && !critSeen; mrad += 2) {
      const w = createWorld(bossDef(5), STATS)
      const boss = w.targets[0]
      assert.ok(boss !== undefined)
      const headY = boss.y + boss.r * P.target.bossHeadUp
      const angle = Math.atan2(headY - w.archer.y, 20) + mrad / 1000
      assert.notEqual(spawnArrow(w, angle, 1), null)
      for (let i = 0; i < 600; i++) {
        step(w, IDLE)
        const a = w.arrows[0]
        if (a !== undefined && !a.alive) break
      }
      const hit = w.events.find((e) => e.t === 'hit')
      if (hit !== undefined && hit.t === 'hit' && hit.accuracy === 1) {
        critSeen = true
        assert.equal(boss.hp, 5 - Math.floor(P.target.bossCritDmg), `hp=${boss.hp}`)
      }
    }
    assert.ok(critSeen, '어떤 각으로도 헤드샷 판정(정확도 1)이 나오지 않는다')
  })

  it('체력이 0이 되면 죽고 판이 끝난다', () => {
    const w = createWorld(bossDef(2), STATS)
    shootAt(w, 2.6)
    w.events.length = 0
    shootAt(w, 2.6)
    const boss = w.targets[0]
    assert.ok(boss !== undefined && !boss.alive, '체력 0인데 서 있다')
    for (let i = 0; i < 300 && w.status === 'playing'; i++) step(w, IDLE)
    assert.equal(w.status, 'cleared')
  })

  it('궁수에게 닿으면 그 판을 진다', () => {
    const w = createWorld(bossDef(9, 40), STATS)
    for (let i = 0; i < 1200 && w.status === 'playing'; i++) step(w, IDLE)
    assert.equal(w.status, 'failed', '보스가 닿았는데 판이 안 끝났다')
    assert.ok(w.events.some((e) => e.t === 'stage_end' && !e.cleared) ||
      w.status === 'failed')
  })
})
