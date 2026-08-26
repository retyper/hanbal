/**
 * 갈림길 2택 (docs/MEGAHIT.md §3 · game/forks.ts).
 *
 * 여기서 지키는 것은 셋이다.
 *  1. **결정론** (A1) — 같은 판 번호·같은 선택은 언제 구워도 같은 판이 나온다.
 *  2. **보스판엔 안 나온다** — hasFork가 10의 배수를 막는다.
 *  3. **밀집은 대가 없이 좋아지지 않는다** — 과녁이 늘면 화살과 ★★ 문턱도 같이 는다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { applyFork, denseReward, FORK_OPTIONS, hasFork } from '../src/game/forks.ts'
import { getStage } from '../src/game/stages.ts'
import { BOSS_EVERY } from '../src/game/stages.ts'
import type { ArrowKindId } from '../src/game/arrows.ts'

const [WIND, DENSE] = FORK_OPTIONS

describe('갈림길 — 언제 나오는가', () => {
  it('보스판(10의 배수)에는 안 나온다', () => {
    for (let n = 1; n <= 40; n++) {
      assert.equal(hasFork(n), n % BOSS_EVERY !== 0, `${n}판`)
    }
  })
})

describe('갈림길 — 바람골', () => {
  it('무풍 판에 최저 바람을 끌어올린다', () => {
    const stage = { ...getStage(0), wind: 0 }
    const out = applyFork(stage, WIND, 1)
    assert.ok(out.wind > 0, '바람골인데 무풍이면 안 된다')
  })

  it('원래 더 강한 바람이면 깎지 않는다', () => {
    const stage = { ...getStage(20), wind: 999 }
    const out = applyFork(stage, WIND, 21)
    assert.equal(out.wind, 999)
  })

  it('과녁·화살 수는 안 건드린다 — 바람골의 값은 순수하게 조준 난이도다', () => {
    const stage = getStage(2)
    const out = applyFork(stage, WIND, 3)
    assert.equal(out.targets.length, stage.targets.length)
    assert.equal(out.arrows, stage.arrows)
  })
})

describe('갈림길 — 밀집', () => {
  it('과녁이 늘고, 는 만큼 화살도 는다', () => {
    const stage = getStage(2)
    const out = applyFork(stage, DENSE, 3)
    const added = out.targets.length - stage.targets.length
    assert.ok(added > 0, '복제할 과녁이 있는 판인데 안 늘었다')
    assert.equal(out.arrows, stage.arrows + added, '는 과녁 수만큼 화살도 늘어야 한다')
  })

  it('★★ 문턱도 같은 비율로 는다 — 공짜로 별을 더 주면 안 된다', () => {
    const stage = getStage(2)
    const out = applyFork(stage, DENSE, 3)
    const ratio = out.targets.length / stage.targets.length
    assert.ok(
      Math.abs(out.targetScore - stage.targetScore * ratio) <= 1,
      `targetScore가 과녁 비율(${ratio.toFixed(2)})을 안 따라갔다: ${stage.targetScore} → ${out.targetScore}`,
    )
  })

  it('복제할 과녁이 없으면(보스만 있는 판) 원본을 그대로 돌려준다', () => {
    const boss = { ...getStage(9), targets: [{ kind: 'boss' as const, x: 30, y: 2, r: 1, hp: 100 }] }
    const out = applyFork(boss, DENSE, 10)
    assert.deepEqual(out, boss)
  })

  it('보급(bonus)·돌진(charger)은 복제 대상에서 뺀다 — 재화·기믹은 밀집이 안 늘린다', () => {
    const stage = getStage(2)
    const out = applyFork(stage, DENSE, 3)
    const addedTargets = out.targets.slice(stage.targets.length)
    for (const t of addedTargets) {
      assert.notEqual(t.kind, 'bonus')
      assert.notEqual(t.kind, 'charger')
    }
  })

  it('11판+(전환된 판)에 적용해도 새 종류를 만들지 않는다 — 있는 걸 복제한다', () => {
    const stage = getStage(11) // convertToFoes를 거친 판 (docs/RUN.md)
    const out = applyFork(stage, DENSE, 12)
    const kinds = new Set(stage.targets.map((t) => t.kind))
    const addedTargets = out.targets.slice(stage.targets.length)
    for (const t of addedTargets) assert.ok(kinds.has(t.kind), `낯선 과녁 종류 ${t.kind}가 생겼다`)
  })
})

describe('갈림길 — 결정론 (A1)', () => {
  it('같은 판 번호·같은 선택은 언제 구워도 같다', () => {
    const a = applyFork(getStage(5), DENSE, 6)
    const b = applyFork(getStage(5), DENSE, 6)
    assert.deepEqual(a, b)
  })

  it('판 번호가 다르면 복제 위치가 달라질 수 있다 (같은 시드 재사용 아님)', () => {
    const a = JSON.stringify(applyFork(getStage(2), DENSE, 3))
    const b = JSON.stringify(applyFork(getStage(2), DENSE, 33))
    assert.notEqual(a, b, '판 번호를 시드에 안 섞으면 모든 밀집 판이 같은 모양이 된다')
  })
})

describe('갈림길 — 밀집 보상', () => {
  it('언제나 유효한 화살 종류를 돌려준다', () => {
    const valid = new Set<ArrowKindId>(['basic', 'burst', 'chain', 'split', 'homing', 'pierce', 'heavy'])
    for (let n = 1; n <= 30; n++) assert.ok(valid.has(denseReward(n)), `denseReward(${n})`)
  })

  it('기본살(basic)은 절대 안 나온다 — 밀집의 보상은 특수살이어야 값이 있다', () => {
    for (let n = 1; n <= 30; n++) assert.notEqual(denseReward(n), 'basic')
  })

  it('판마다 돈다 — 매번 같은 살만 나오면 두 번째 선택이 지겨워진다', () => {
    const seen = new Set<ArrowKindId>()
    for (let n = 1; n <= 12; n++) seen.add(denseReward(n))
    assert.ok(seen.size >= 4, `너무 안 돈다: ${[...seen].join(',')}`)
  })
})
