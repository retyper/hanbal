/**
 * 화살은 적보다 반드시 한 발 많다 — 형의 규칙 (2026-09-01):
 * "어떤 상황에서도 게임 시작했을 때 화살 수는 아무리 적어도 적 수보다 1개 더 많아야 해."
 *
 * "어떤 상황에서도"가 이 검사의 전부다. 그래서 **한 판만 보지 않고 판을 만드는 모든 길**을
 * 지난다: 저작 50판 · 무한 생성 · 보스 · 11판+ 전환 · 갈림길 카드 · 화살 보유 0.
 * 예전엔 이 다섯 중 어느 하나에서만 깨져도 아무도 못 봤다 — 다 '의도된 설계'였기 때문이다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { getStage } from '../src/game/stages.ts'
import { arrowFloor, foeCount } from '../src/game/stagekit.ts'
import { applyFork, forkOptions, hasFork } from '../src/game/forks.ts'
import { grantArrows } from '../src/game/progression.ts'
import { defaultSave } from '../src/game/save.ts'
import { createWorld } from '../src/sim/world.ts'

/** 여기까지 본다. 200판이면 저작 50 + 무한 150 + 보스 20 마디를 전부 지난다. */
const DEEP = 200

describe('화살 바닥 — 적보다 한 발 많다', () => {
  it('1~200판 어느 판도 화살이 적 수 이하가 아니다', () => {
    const bad: string[] = []
    for (let i = 0; i < DEEP; i++) {
      const s = getStage(i)
      if (s.arrows < arrowFloor(s)) {
        bad.push(`${i + 1}판(${s.id}) 적 ${foeCount(s)} · 화살 ${s.arrows}`)
      }
    }
    assert.deepEqual(bad, [], `바닥을 깬 판:\n  ${bad.join('\n  ')}`)
  })

  it('화약 상자 퍼즐판도 예외가 아니다 — 상자는 적이 아니고, 화살은 적+1 이다', () => {
    // 1-9는 상자 하나 + 과녁 셋인 저작 판이다 (docs/GAP.md 1절). 예전엔 3발이었다.
    const s = getStage(8)
    assert.ok(s.targets.some((t) => t.kind === 'barrel'), '1-9에 화약 상자가 없다')
    assert.equal(foeCount(s), s.targets.filter((t) => t.kind !== 'barrel' && t.kind !== 'bonus').length)
    assert.ok(s.arrows > foeCount(s), `1-9: 적 ${foeCount(s)} 인데 화살 ${s.arrows}`)
  })

  it('보급 과녁과 화약 상자는 적으로 세지 않는다', () => {
    // 둘 다 클리어 조건이 아니다 (sim/world.ts anyTargetStanding). 세면 화살만 헤퍼진다.
    const stage = {
      id: 'floor-test', seed: 1, arrows: 1, targetScore: 100, wind: 0,
      targets: [
        { kind: 'static' as const, x: 10, y: 2, r: 0.5 },
        { kind: 'bonus' as const, x: 12, y: 3, r: 0.6, give: 2 },
        { kind: 'barrel' as const, x: 14, y: 2, r: 0.5 },
      ],
    }
    assert.equal(foeCount(stage), 1)
    assert.equal(arrowFloor(stage), 2)
  })

  it('화살 보유가 0이어도 지급이 바닥 아래로 안 내려간다', () => {
    const d = defaultSave(0)
    d.arrows = 0
    for (let i = 0; i < DEEP; i++) {
      const s = getStage(i)
      const give = grantArrows(d, s)
      assert.ok(give >= arrowFloor(s), `${i + 1}판(${s.id}): 적 ${foeCount(s)} 인데 ${give}발`)
    }
  })

  it('갈림길 카드를 얹은 뒤에도 바닥은 그대로다 (단발·화약고가 화살을 조인다)', () => {
    const d = defaultSave(0)
    d.arrows = 0
    for (let n = 2; n <= 60; n++) {
      if (!hasFork(n)) continue
      const base = getStage(n - 1)
      // 그 판에 실제로 뜨는 두 장 전부를 얹어 본다 — 한 장만 보면 나머지가 구멍이 된다.
      for (const opt of forkOptions(n, base, '')) {
        const forked = applyFork(base, opt, n)
        const give = grantArrows(d, forked)
        assert.ok(
          give >= arrowFloor(forked),
          `${n}판 '${opt.title}': 적 ${foeCount(forked)} 인데 ${give}발`,
        )
      }
    }
  })

  it('지급이 화살 풀보다 크지 않다 — 지급받고도 안 나가는 화살은 없다', () => {
    // 풀이 지급량보다 작으면 spawnArrow 가 빈 자리를 못 찾아 **조용히** 안 쏜다.
    const d = defaultSave(0)
    d.arrows = 999
    const stats = { str: 10, steady: 8, stamina: 10, focus: 6 }
    for (let i = 0; i < DEEP; i += 7) {
      const s = getStage(i)
      const w = createWorld(s, stats)
      assert.ok(
        w.arrows.length >= grantArrows(d, s),
        `${i + 1}판(${s.id}): 풀 ${w.arrows.length} < 지급 ${grantArrows(d, s)}`,
      )
    }
  })
})
