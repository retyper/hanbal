/**
 * 활의 sim 배선 (docs/BOWS.md)
 *
 * 지키는 것은 셋이다.
 *  1. **결정론이 활에 오염되지 않는다** (A1). 같은 BowMods = 같은 판. 활을 바꿔도
 *     sim의 난수 스트림은 같은 자리에 있어야 한다.
 *  2. **든 것이 실제로 물리를 바꾼다.** 각궁은 빨리 당겨지고, 컴파운드는 만작에서
 *     힘이 덜 빠지고, 궁합은 관통 예산을 늘린다. 배수판만 있고 아무도 안 읽는
 *     상태로 되돌아가면 여기서 빨간불이 켜진다.
 *  3. **빨간 바의 계약은 활보다 세다.** 어떤 활을 들어도 안전 구간 만작 릴리즈의
 *     오차는 정확히 0이다 — 배수는 0에 곱해질 뿐이다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { spawnArrow } from '../src/sim/ballistics.ts'
import { bowMods, masteryLevel, MASTERY_HITS } from '../src/game/bows.ts'
import { P } from '../src/tune/params.ts'
import type { BowMods, InputFrame, StageDef, Stats, World } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 8, focus: 6 }
const HOLD: InputFrame = { aimX: 20, aimY: 2, drawing: true, steady: false }
const LOOSE: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false }

function stage(): StageDef {
  return {
    id: 'bows-test',
    seed: 0x77,
    arrows: 4,
    targetScore: 100,
    wind: 0,
    targets: [
      // 애기살(pierceExtra 2)의 예산이 정확히 바닥나는 넷 일렬 — 궁합이 +1을 주면 넷째까지 뚫린다.
      { kind: 'static', x: 14, y: 2.0, r: 0.6, score: 100 },
      { kind: 'static', x: 17, y: 2.0, r: 0.6, score: 100 },
      { kind: 'static', x: 20, y: 2.0, r: 0.6, score: 100 },
      { kind: 'static', x: 23, y: 2.0, r: 0.6, score: 100 },
    ],
  }
}

/** 만작(full phase)에 닿는 데 걸린 스텝 수. */
function stepsToFull(w: World): number {
  for (let i = 1; i <= 600; i++) {
    step(w, HOLD)
    if (w.archer.phase === 'full') return i
  }
  assert.fail('600스텝 안에 만작이 안 됐다')
}

describe('활 — 물리 배선', () => {
  it('연습궁(중립)은 아무것도 바꾸지 않는다', () => {
    const neutral = createWorld(stage(), STATS)
    const practice = createWorld(stage(), STATS, 'basic', bowMods('practice', 'basic', 0))
    for (let i = 0; i < 400; i++) {
      step(neutral, i < 60 ? HOLD : LOOSE)
      step(practice, i < 60 ? HOLD : LOOSE)
    }
    assert.equal(neutral.score, practice.score)
    assert.equal(neutral.rng.state(), practice.rng.state(), '중립 활이 난수 스트림을 밀었다')
  })

  it('각궁은 만작이 빠르다', () => {
    const slow = stepsToFull(createWorld(stage(), STATS))
    const fast = stepsToFull(createWorld(stage(), STATS, 'basic', bowMods('gakgung', 'basic', 0)))
    assert.ok(fast < slow, `각궁 ${fast}스텝이 연습궁 ${slow}스텝보다 빨라야 한다`)
  })

  it('컴파운드는 만작 유지 중 스태미나가 덜 빠진다 (렛오프)', () => {
    const drainAfterHold = (mods?: BowMods): number => {
      const w = mods === undefined
        ? createWorld(stage(), STATS)
        : createWorld(stage(), STATS, 'basic', mods)
      const start = w.archer.stamina
      for (let i = 0; i < 300; i++) step(w, HOLD)
      assert.equal(w.archer.phase, 'full', '만작 상태여야 렛오프가 보인다')
      return start - w.archer.stamina
    }
    const plain = drainAfterHold()
    const comp = drainAfterHold(bowMods('compound', 'basic', 0))
    assert.ok(comp < plain * 0.85, `렛오프가 소모를 줄여야 한다 (중립 ${plain.toFixed(2)} vs 컴파운드 ${comp.toFixed(2)})`)
  })

  it('궁합 — 각궁×애기살(편전)은 관통이 하나 더 나온다', () => {
    // 활마다 초속이 달라 같은 각이 같은 궤적이 아니다. 활별로 첫 과녁(14, 2.0)을 지나는
    // 각을 먼저 찾고(과녁을 꺼두고 궤적만 본다), 그 각으로 실전을 쏜다.
    const aimFor = (mods: BowMods): number => {
      let best = 0
      let bestErr = Number.POSITIVE_INFINITY
      for (let deg = -2; deg <= 20; deg += 0.05) {
        const ang = (deg * Math.PI) / 180
        const w = createWorld(stage(), STATS, 'pierce', mods)
        for (const t of w.targets) t.alive = false
        const a = spawnArrow(w, ang, 1)
        if (a === null) continue
        for (let i = 0; i < 600 && a.alive; i++) {
          step(w, LOOSE)
          w.events.length = 0
          if (a.x >= 14) {
            const err = Math.abs(a.y - 2.0)
            if (err < bestErr) {
              bestErr = err
              best = ang
            }
            break
          }
        }
      }
      return best
    }
    const killedWith = (mods: BowMods): number => {
      const w = createWorld(stage(), STATS, 'pierce', mods)
      const a = spawnArrow(w, aimFor(mods), 1)
      assert.notEqual(a, null)
      for (let i = 0; i < 600; i++) {
        step(w, LOOSE)
        w.events.length = 0
      }
      let dead = 0
      for (const t of w.targets) if (!t.alive) dead++
      return dead
    }
    const plain = killedWith(bowMods('practice', 'pierce', 0))
    const pyeonjeon = killedWith(bowMods('gakgung', 'pierce', 0))
    assert.ok(plain >= 3, `애기살 홀로 최소 셋은 뚫어야 한다 (실측 ${plain})`)
    assert.equal(pyeonjeon, plain + Math.floor(P.bowkind.synergyPierce), '편전의 +1이 실제 관통 수에 없다')
  })

  it('궁합은 짝이 맞을 때만 붙는다', () => {
    assert.equal(bowMods('gakgung', 'pierce', 0).pierceAdd, Math.floor(P.bowkind.synergyPierce))
    assert.equal(bowMods('gakgung', 'basic', 0).pierceAdd, 0)
    assert.equal(bowMods('longbow', 'heavy', 0).pierceAdd, Math.floor(P.bowkind.synergyPierce))
    assert.equal(bowMods('longbow', 'pierce', 0).pierceAdd, 0)
    assert.equal(bowMods('practice', 'pierce', 0).pierceAdd, 0)
  })

  it('숙련은 대가를 깎고 장점은 건드리지 않는다', () => {
    const raw = bowMods('gakgung', 'basic', 0)
    const master = bowMods('gakgung', 'basic', MASTERY_HITS.length)
    assert.ok(master.tremorMul < raw.tremorMul, '숙련이 각궁의 떨림 대가를 깎아야 한다')
    assert.equal(master.drawTimeMul, raw.drawTimeMul, '장점(빠른 당김)은 그대로여야 한다')
    assert.equal(master.speedMul, raw.speedMul, '장점(초속)은 그대로여야 한다')
    // 장궁의 만작 페널티도 숙련으로 0에 다가간다
    const long0 = bowMods('longbow', 'basic', 0)
    const long3 = bowMods('longbow', 'basic', 3)
    assert.ok(long3.maxDrawAdd > long0.maxDrawAdd, '숙련이 장궁의 만작 페널티를 줄여야 한다')
  })

  it('숙련 레벨은 문턱에서만 오르고 줄지 않는다', () => {
    assert.equal(masteryLevel(0), 0)
    assert.equal(masteryLevel((MASTERY_HITS[0] ?? 30) - 1), 0)
    assert.equal(masteryLevel(MASTERY_HITS[0] ?? 30), 1)
    assert.equal(masteryLevel(MASTERY_HITS[2] ?? 200), 3)
  })

  it('빨간 바의 계약 — 어떤 활이든 안전 구간 만작 릴리즈는 오차 0', () => {
    for (const bow of ['practice', 'gakgung', 'longbow', 'recurve', 'compound'] as const) {
      const w = createWorld(stage(), { str: 20, steady: 0, stamina: 20, focus: 0 }, 'basic', bowMods(bow, 'basic', 0))
      for (let i = 0; i < 300 && w.archer.phase !== 'full'; i++) step(w, HOLD)
      assert.equal(w.archer.phase, 'full')
      assert.ok(w.archer.strain === 0, `${bow}: 만작 직후인데 이미 빨간 바 아래다 — 판 구성이 틀렸다`)
      step(w, LOOSE)
      const rel = w.events.find((e) => e.t === 'release')
      assert.ok(rel !== undefined && rel.t === 'release')
      assert.equal(rel.err, 0, `${bow}: 안전 구간 만작인데 오차가 ${rel.err}다`)
    }
  })
})
