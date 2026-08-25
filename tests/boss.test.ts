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

  it('몸통은 착탄 속도 비례로 깎이고, 남으면 화살만 죽는다 · 관통살도 못 뚫는다', () => {
    const w = createWorld(bossDef(1000), STATS, 'pierce')
    const boss = w.targets[0]
    assert.ok(boss !== undefined)
    shootAt(w, 2.6)
    const dealt = 1000 - boss.hp
    // 피해는 이제 **운동에너지**다: 기준 × 질량 × (착탄속도/기준속도)² (sim/target.ts).
    // 특정 숫자를 박지 않는다 — 그 값은 탄도가 정하고, 탄도를 손보면 테스트가 거짓말을 한다.
    // 여기서 지키는 건 "피해가 났고 보스는 살아남는다"까지다. 질량·속도가 실제로 들어가는지는
    // 아래 두 테스트가 **비교**로 잡는다. 비교는 상수와 달리 튜닝에도 안 무너진다.
    assert.ok(dealt > 0, '피해가 0이다')
    assert.equal(boss.alive, true)
    assert.equal(boss.alive, true)
    const arrow = w.arrows[0]
    assert.ok(arrow !== undefined && !arrow.alive, '보스를 맞힌 화살이 계속 난다')
    assert.equal(arrow.kindPierced, 0, '애기살이 보스를 뚫었다')
  })

  it('★ 무거운 살이 더 아프다 — 피해가 질량을 탄다 (형: "데미지는 화살 무게에 따라도")', () => {
    const hit = (kind: 'basic' | 'heavy' | 'pierce'): number => {
      const w = createWorld(bossDef(100000), STATS, kind)
      const boss = w.targets[0]
      assert.ok(boss !== undefined)
      shootAt(w, 2.6)
      return 100000 - boss.hp
    }
    const light = hit('pierce')
    const mid = hit('basic')
    const heavy = hit('heavy')
    assert.ok(light > 0 && mid > 0 && heavy > 0, `아무것도 안 박혔다 (${light}/${mid}/${heavy})`)
    // 육량전(2.40)은 유엽전(1.00)보다, 유엽전은 애기살(0.55)보다 아프다.
    // 애기살은 빨라서(1.35) 속도로 일부 벌충하지만 질량의 제곱이 아니라 **일차**라 못 이긴다.
    assert.ok(heavy > mid, `육량전(${heavy})이 유엽전(${mid})보다 안 아프다`)
    assert.ok(mid > light, `유엽전(${mid})이 애기살(${light})보다 안 아프다`)
  })

  it('★ 가까이서 쏘면 더 아프다 — 피해가 속도를 탄다 (형: "화살 속도랑")', () => {
    // 같은 살·같은 활, 거리만 다르다. 멀수록 착탄 속도가 줄고 피해는 그 **제곱**으로 준다.
    // shootAt은 20m 고정이라 여기서는 각을 직접 훑는다 — 거리마다 맞는 각이 다르다.
    const at = (x: number): number => {
      let best = 0
      for (let mrad = -10; mrad <= 200; mrad += 2) {
        const w = createWorld({
          ...bossDef(1e7),
          targets: [{ kind: 'boss', x, y: 2.6, r: 1.7, hp: 1e7, speed: 0.0001, score: 150 }],
        }, STATS)
        const boss = w.targets[0]
        assert.ok(boss !== undefined)
        assert.notEqual(spawnArrow(w, mrad / 1000, 1), null)
        for (let i = 0; i < 900; i++) {
          step(w, IDLE)
          const a = w.arrows.find((y) => y.id === 0)
          if (a !== undefined && !a.alive) break
        }
        // 머리(치명)는 **고정값**(bossCritDmg)이라 속도를 안 탄다 — 세면 거리 비교가
        // 두 거리 모두 200으로 같아진다 (실제로 그렇게 나왔다). 몸통 명중만 센다.
        let head = false
        for (const e of w.events) if (e !== undefined && e.t === 'hit' && e.head) head = true
        if (head) continue
        const dealt = 1e7 - boss.hp
        // 가장 세게 박힌 각을 쓴다 = 그 거리에서 낼 수 있는 최대 피해.
        if (dealt > best) best = dealt
      }
      return best
    }
    const near = at(12)
    const far = at(40)
    assert.ok(near > 0 && far > 0, `안 맞았다 (가까이 ${near} / 멀리 ${far})`)
    // 실측 12m 67 vs 40m 59 = 1.14배. 크지 않다 — 이 게임의 공기저항이 순한 탓이고,
    // 그게 "빨간 바 위에서는 조준한 대로 맞는다"를 지키려고 고른 값이라 여기서 안 건드린다.
    // 문턱을 1.08로 잡는 건 **방향이 맞는가**를 지키려는 것이지 크기를 주장하는 게 아니다.
    // 거리 감쇠를 더 세게 하고 싶으면 P.arrow.drag를 올려야 하고, 그건 탄도 전체의 결정이다.
    assert.ok(near > far * 1.08, `가까이(${near})가 멀리(${far})보다 안 아프다`)
  })

  it('헤드샷은 치명 — bossCritDmg 만큼 깎고 정중앙 판정을 받는다', () => {
    // 낙차를 정확히 아는 건 sim뿐이다 — 머리를 지나는 각을 탐색으로 찾는다 (bows.test와 같은 방식).
    let critSeen = false
    for (let mrad = -30; mrad <= 60 && !critSeen; mrad += 2) {
      const base = 1000
      const w = createWorld(bossDef(base), STATS)
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
        assert.equal(boss.hp, base - Math.floor(P.target.bossCritDmg), `hp=${boss.hp}`)
      }
    }
    assert.ok(critSeen, '어떤 각으로도 헤드샷 판정(정확도 1)이 나오지 않는다')
  })

  it('체력이 0이 되면 죽고 판이 끝난다', () => {
    // 기준 피해의 절반 — 몸통 한 발이면 확실히 넘어가는 크기다.
    const w = createWorld(bossDef(Math.floor(P.enemy.playerDamage * 0.5)), STATS)
    shootAt(w, 2.6)
    w.events.length = 0
    shootAt(w, 2.6)
    const boss = w.targets[0]
    assert.ok(boss !== undefined && !boss.alive, '체력 0인데 서 있다')
    for (let i = 0; i < 300 && w.status === 'playing'; i++) step(w, IDLE)
    assert.equal(w.status, 'cleared')
  })

  it('궁수에게 닿으면 그 판을 진다', () => {
    const w = createWorld(bossDef(9000, 40), STATS)
    for (let i = 0; i < 1200 && w.status === 'playing'; i++) step(w, IDLE)
    assert.equal(w.status, 'failed', '보스가 닿았는데 판이 안 끝났다')
    assert.ok(w.events.some((e) => e.t === 'stage_end' && !e.cleared) ||
      w.status === 'failed')
  })
})
