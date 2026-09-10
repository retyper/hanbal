/**
 * 보스의 약점 (2026-09-10, 형: "보스도 형편없고 약점 공략하는 맛도 없고") — 배선 검사.
 *
 * 눈알: 뜬 눈 = 크리 + 멈춤 · 감은 눈 = 몸통샷 (weak_shut)
 * 갑주: 판금에 막힌 몸통 두 발 = 비틀 → 그때 눈이 통한다
 * 쌍눈: 한쪽 눈 = 다른 쪽 멈춤
 * 폭주: 다리 = 넘어짐 (trip)
 * 손맛(고리·별·기울기)은 형이 눈으로 판정한다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { spawnArrow } from '../src/sim/ballistics.ts'
import { P } from '../src/tune/params.ts'
import { bossGait, bossGrammar } from '../src/sim/target.ts'
import type { InputFrame, StageDef, Stats, TargetSpec, World } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 8, focus: 6 }
const IDLE: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false, parry: false }

function def(targets: TargetSpec[]): StageDef {
  return { id: 'boss-weak', seed: 7, arrows: 20, targetScore: 100, wind: 0, targets }
}
const boss = (look: number, extra: Partial<TargetSpec> = {}): TargetSpec =>
  ({ kind: 'boss', x: 20, y: 2.6, r: 1.7, hp: 100000, speed: 0.0001, look, score: 150, ...extra })

/** 20m 앞 높이 ty 를 지나는 각으로 한 발. 날아가 죽을 때까지 돌린다. */
function shootAt(w: World, ty: number): void {
  const dy = ty - w.archer.y
  const angle = Math.atan2(dy, 20) + 0.012
  const a = spawnArrow(w, angle, 1)
  assert.notEqual(a, null)
  const id = (a as { id: number }).id
  for (let i = 0; i < 600; i++) {
    step(w, IDLE)
    const ar = w.arrows.find((x) => x.id === id)
    if (ar !== undefined && !ar.alive) break
  }
}
function idle(w: World, secs: number): void {
  const n = Math.ceil(secs / w.dt)
  for (let i = 0; i < n; i++) step(w, IDLE)
}
const eyeY = (t: { y: number; r: number }): number => t.y + t.r * P.target.bossHeadUp
const has = (w: World, t: string): boolean => w.events.some((e) => e !== undefined && e.t === t)

describe('보스의 약점', () => {
  it('눈알귀신 — 뜬 눈은 크리티컬이고 맞으면 멈춘다. 멈춘 동안 다시 맞히면 더 아프다', () => {
    const w = createWorld(def([boss(0)]), STATS)
    const b = w.targets[0]
    assert.ok(b !== undefined)
    assert.equal(b.weak, 1, '판이 서자마자 눈이 감겨 있다')
    shootAt(w, eyeY(b))
    assert.equal(100000 - b.hp, Math.floor(P.target.bossCritDmg), '뜬 눈이 크리티컬이 아니다')
    assert.ok(b.stagger > 0, '눈을 맞혔는데 안 멈춘다')
    assert.ok(has(w, 'stagger'))
    const x0 = b.x
    idle(w, 0.4)
    assert.equal(b.x, x0, '멈춘 보스가 걸었다')
    const hp1 = b.hp
    shootAt(w, eyeY(b))
    assert.equal(hp1 - b.hp, Math.floor(P.target.bossCritDmg * P.target.bossStaggerCritMul), '멈춘 눈의 배수가 안 붙었다')
  })

  it('눈알귀신 — 감은 눈에 쏘면 몸통샷이다 (weak_shut)', () => {
    const w = createWorld(def([boss(0)]), STATS)
    const b = w.targets[0]
    assert.ok(b !== undefined)
    // 눈이 감길 때까지 기다린다. 주기는 params 가 정한다.
    idle(w, P.target.bossEyeOpen + P.target.bossEyeShut * 0.5)
    assert.ok(b.weak < P.target.bossEyeOpenAt, `눈이 안 감겼다 (weak ${b.weak})`)
    w.events.length = 0
    shootAt(w, eyeY(b))
    assert.ok(has(w, 'weak_shut'), '감은 눈 이벤트가 없다')
    assert.ok(100000 - b.hp < P.target.bossCritDmg, '감은 눈이 크리티컬로 셌다')
    assert.equal(b.stagger, 0, '감은 눈을 맞혔는데 멈췄다')
    // 눈은 다시 뜬다 — 주기 한 바퀴 뒤엔 첫 상태와 같다.
    idle(w, P.target.bossEyeShut)
    assert.equal(b.weak, 1)
  })

  it('갑주귀신 — 판금에 막힌 몸통 두 발이면 비틀거리고, 그때 눈이 통한다', () => {
    const w = createWorld(def([boss(1, { armored: true })]), STATS)
    const b = w.targets[0]
    assert.ok(b !== undefined)
    // 투구가 닫혀 있다 — 눈을 쏴도 판금에 막힌다.
    shootAt(w, eyeY(b))
    assert.equal(b.hp, 100000, '닫힌 투구인데 눈이 통했다')
    assert.equal(b.guardHits, 1)
    shootAt(w, b.y)
    assert.ok(b.stagger > 0, `몸통 ${P.target.bossGuardHits}발인데 안 비틀거린다`)
    assert.ok(has(w, 'stagger'))
    shootAt(w, eyeY(b))
    assert.equal(100000 - b.hp, Math.floor(P.target.bossCritDmg * P.target.bossStaggerCritMul), '열린 투구의 눈이 안 통했다')
  })

  it('쌍눈귀신 — 둘이 엇갈려 뜨고, 한쪽 눈을 맞히면 다른 쪽이 멈춘다', () => {
    const w = createWorld(def([boss(2, { x: 20 }), boss(2, { x: 30, y: 2.6 })]), STATS)
    const a = w.targets[0]
    const b = w.targets[1]
    assert.ok(a !== undefined && b !== undefined)
    step(w, IDLE)
    assert.equal(a.weak, 1, '첫째가 감겨 있다')
    assert.ok(b.weak < P.target.bossEyeOpenAt, '둘째가 첫째와 같이 떠 있다 — 엇박이 아니다')
    shootAt(w, eyeY(a))
    assert.ok(b.stagger > 0, '한쪽 눈을 맞혔는데 다른 쪽이 안 멈춘다')
    assert.equal(a.stagger, 0, '맞은 쪽이 멈췄다 — 쌍눈은 다른 쪽이 멈추는 것이다')
  })

  it('★ 여덟이 전부 자기 문법대로 움직인다 — look 을 해석하는 자리가 하나뿐인지', () => {
    // 2026-09-10: bossGrammar 로 모은다고 해놓고 **치환 셋이 실제로는 안 들어갔다.**
    // 테스트가 look 0~3 만 보고 있어서 통과해 버렸다 — 구미호(5)는 다리를 맞혀도 안 넘어지고,
    // 도깨비(4)·저승사자(7)는 눈을 맞혀도 안 멈췄다. 이제 여덟을 전부 건다.
    for (const look of [0, 1, 2, 3, 4, 5, 6, 7]) {
      const gram = bossGrammar(look)
      const armored = gram === 'guard'
      const w = createWorld(def([boss(look, armored ? { armored: true } : {})]), STATS)
      const b2 = w.targets[0]
      assert.ok(b2 !== undefined)
      // 한 스텝은 돌려야 문법이 weak 에 반영된다 — 태어날 때는 셋 다 1(뜬 채)이다.
      step(w, IDLE)
      if (gram === 'leg') {
        shootAt(w, b2.y - b2.r * (P.target.bossLegZone + 0.25))
        assert.ok(b2.stagger > 0, `look ${look} (${gram}) — 다리를 맞혔는데 안 넘어진다`)
      } else if (gram === 'eye') {
        assert.equal(b2.weak, 1, `look ${look} — 판이 서자마자 눈이 감겨 있다`)
        shootAt(w, eyeY(b2))
        assert.ok(b2.stagger > 0, `look ${look} (${gram}) — 뜬 눈을 맞혔는데 안 멈춘다`)
      } else if (gram === 'guard') {
        assert.equal(b2.weak, 0, `look ${look} — 갑주인데 약점이 열려 있다`)
        shootAt(w, b2.y)
        shootAt(w, b2.y)
        assert.ok(b2.stagger > 0, `look ${look} (${gram}) — 몸통을 두들겼는데 안 비틀거린다`)
      }
    }
  })

  it('걷는 놈은 뜨지 않는다 — 발이 땅에 붙는다 (형: "왜 다 둥실둥실 떠다니냐")', () => {
    for (const look of [0, 1, 2, 3, 4, 5, 6, 7]) {
      const w = createWorld(def([boss(look)]), STATS)
      const b2 = w.targets[0]
      assert.ok(b2 !== undefined)
      idle(w, 0.6)
      const foot = b2.y - b2.r
      if (bossGait(look) === 'walk') {
        // 발이 땅(0)에서 걸음 높이 안쪽이어야 한다. 저작된 y(1.6~3.8m)는 안 쓴다.
        assert.ok(foot >= -1e-6 && foot <= P.target.bossStepRise + 1e-6,
          `look ${look} 은 걷는 놈인데 발이 ${foot.toFixed(2)}m 에 떠 있다`)
      } else {
        assert.ok(foot > 0.4, `look ${look} 은 유령인데 땅에 붙어 있다 (${foot.toFixed(2)}m)`)
      }
    }
  })

  it('폭주귀신 — 다리를 맞히면 넘어지고(trip), 넘어진 동안 내려앉는다', () => {
    const w = createWorld(def([boss(3)]), STATS)
    const b = w.targets[0]
    assert.ok(b !== undefined)
    shootAt(w, b.y - b.r * (P.target.bossLegZone + 0.25))
    assert.ok(b.stagger > 0, '다리를 맞혔는데 안 넘어진다')
    const ev = w.events.find((e) => e !== undefined && e.t === 'stagger')
    assert.ok(ev !== undefined && ev.t === 'stagger' && ev.trip, '넘어짐이 trip 이 아니다')
    step(w, IDLE)
    assert.ok(b.y < b.baseY, '넘어졌는데 안 내려앉았다')
  })
})
