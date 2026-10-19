/**
 * 배우는 판 (형 2026-10-19: "튜토리얼용 제일작은지도 1:1게임 · 적 여장수 포획도 시도하고 이건 튜토리얼급이니 100% 성공하도록")
 *  - 두 나라 1:1 · 상대 군대는 여인 장수가 이끈다 · 상대는 먼저 치지 않는다
 *  - 우리 쪽 사로잡기는 반드시 된다 (시드가 달라도) · 상대는 우리 장수를 못 잡는다
 *  - 가락 도읍을 쥐면 이긴다
 *  - 판 해금 — 배우는 판 → 작은 판 → 영남 → 남부 → 북녘, 하던 판까지는 열려 있다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders } from '../../src/realm/ai.ts'
import { startTutorial } from '../../src/realm/data/regions/tutorial.ts'
import { advance, checkOutcome } from '../../src/realm/season.ts'
import { captureChance, type Side } from '../../src/realm/tactics.ts'
import { unlockedFrom } from '../../src/ui/realm/unlock.ts'
import { TUT_STEPS, tutAt } from '../../src/ui/realm/tutorial.ts'
import type { Order, Tactic } from '../../src/realm/types.ts'

const side = (o: Partial<Side>): Side => ({
  F: 100, mix: { spear: 100 }, morale: 1, hero: { id: 'x', mu: 3, ryak: 3, coward: false }, hungry: false, specials: [], water: false, player: true, seen: true, ...o,
})

describe('배우는 판', () => {
  it('두 나라 1:1 · 상대 군대는 여인 장수 · 상대는 먼저 치지 않는다', () => {
    const r = startTutorial(1)
    assert.equal(r.region, 'tutorial')
    assert.deepEqual(Object.keys(r.factions).sort(), ['guya', 'us'])
    const foe = Object.values(r.armies).find((a) => a.faction === 'guya')!
    assert.equal(r.heroes[foe.hero!]!.look, 'w')
    // 몇 계절 넘겨도 상대는 우리 땅에 오지 않는다
    let x = r
    for (let s = 0; s < 6; s++) {
      const ai = aiOrders(x)
      assert.ok(!ai.some((o) => o.kind === 'march'), `계절 ${s} 상대 출정`)
      x = advance(x, ai).next
    }
    assert.ok(Object.values(x.nodes).filter((n) => n.owner === 'us').length >= 3)
  })

  it('사로잡기 — 우리 쪽은 반드시 · 상대는 못 한다', () => {
    const me = side({ capture: 'sure' })
    const foe = side({ capture: 'never', player: false })
    assert.equal(captureChance(me, foe, 1, 1, 1, 0.5, false), 1)
    assert.equal(captureChance(foe, me, 0.2, 0.2, 0.2, 0.9, true), 0)
  })

  it('출정해서 첫 합에 사로잡기를 고르면 시드가 달라도 여인 장수가 잡힌다', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const r = startTutorial(seed)
      const march: Order = { kind: 'march', army: 'a-us', edge: 't01', ambush: false }
      // 첫 계절: 출정 → 다음 계절에 닿아 싸움 (사로잡기는 첫 합부터 고른다)
      let x = advance(r, [march, ...aiOrders(r)]).next
      for (let s = 0; s < 3 && x.heroes['guya-3']!.status === 'free'; s++) {
        // 싸움의 열쇠는 엔진이 정한다 — 한 번 시험 돌려 찾고, 그 싸움에 사로잡기를 건다
        const tactics: Order[] = []
        const probe = advance(x, aiOrders(x))
        for (const l of probe.report.lines) if (l.kind === 'battle' && l.key !== undefined) tactics.push({ kind: 'command', key: l.key, cmds: ['capture', 'capture', 'capture'] as Tactic['cmds'] })
        x = advance(x, [...tactics, ...aiOrders(x)]).next
      }
      assert.equal(x.heroes['guya-3']!.status, 'captive', `시드 ${seed}`)
      assert.equal(x.heroes['guya-3']!.captor, 'us')
    }
  })

  it('가락 도읍을 쥐면 이긴다', () => {
    const r = startTutorial(3)
    assert.equal(checkOutcome(r), null)
    r.nodes['guya-cap']!.owner = 'us'
    assert.equal(checkOutcome(r), 'win')
  })

  it('차례 — 처음은 우리 땅 보기, 누르면 다음 · 판이 이기면 끝', () => {
    const r = startTutorial(1)
    const c = { r, orders: [] as Order[], report: null, acts: new Set<string>() }
    assert.equal(tutAt(0, c), 0)
    assert.equal(tutAt(0, { ...c, acts: new Set(['home']) }), 1)
    assert.equal(TUT_STEPS[TUT_STEPS.length - 1]!.id, 'win')
  })
})

describe('판 해금', () => {
  it('처음엔 배우는 판만 · 배우는 판을 끝내면(그만둬도) 작은 판', () => {
    assert.deepEqual([...unlockedFrom([], false, null)], ['tutorial'])
    assert.ok(unlockedFrom([], true, null).has('byeonhan-mini'))
    assert.ok(!unlockedFrom([], true, null).has('yeongnam'))
  })
  it('앞 판을 이기면 다음 판 · 하던 판까지는 열려 있다', () => {
    assert.ok(unlockedFrom(['tutorial', 'byeonhan-mini'], true, null).has('yeongnam'))
    assert.ok(!unlockedFrom(['tutorial', 'byeonhan-mini'], true, null).has('south'))
    const playing = unlockedFrom([], false, 'south')
    assert.ok(playing.has('byeonhan-mini') && playing.has('yeongnam') && playing.has('south') && !playing.has('world'))
  })
})
