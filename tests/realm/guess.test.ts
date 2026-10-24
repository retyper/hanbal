/**
 * 고르기 전 짐작 (tactics.guessOf · 형 10-24: "어떤걸 선택하면 어떤 결과 예상되는지 문명처럼")
 *
 *  - 시험 돌림의 pending 에 깃발마다 이번 합의 짐작이 붙는다 — 우리·적이 잃을 몫, 합 뒤 판세
 *  - 낌새가 있으면 「낌새대로 오면」 하나(폭 없음), 없으면 적 앞줄의 수마다라 폭이 생긴다
 *  - 낌새의 맞수가 낌새에 지는 수보다 판세가 낫다 (많은 판에서)
 *  - 사로잡기·물러나기·겨루기는 짐작하지 않는다 · 같은 판이면 같은 짐작 (A1)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { fightRounds, type Side } from '../../src/realm/tactics.ts'
import type { Guess } from '../../src/realm/types.ts'

const side = (mix: Side['mix'], player = false, over: Partial<Side> = {}): Side => ({
  F: 100, mix, morale: 1, hero: { id: player ? 'me' : 'foe', mu: 5, ryak: 5, coward: false }, hungry: false, specials: [], water: false, player, seen: true, ...over,
})
const EVEN = { spear: 34, bow: 33, shield: 33 }

describe('고르기 전 짐작', () => {
  it('깃발마다 짐작이 붙는다 — 몫은 0..1, 폭은 아래 ≤ 위', () => {
    const t = fightRounds(side(EVEN, true), side(EVEN), 'g1', 1, 0, { cmds: [], open: true })
    const g = t.pending?.guess
    assert.ok(g !== undefined)
    for (const grp of t.pending!.groups) {
      for (const c of grp.options) {
        const v: Guess | undefined = g.opts[grp.g]?.[c]
        assert.ok(v !== undefined, `${grp.g}:${c}`)
        for (const [lo, hi] of [v.us, v.foe, v.edge]) {
          assert.ok(lo >= 0 && hi <= 1 && lo <= hi + 1e-9)
        }
      }
    }
    for (const c of ['capture', 'retreat', 'duel'] as const) assert.equal(g.opts.lead?.[c], undefined)
    assert.deepEqual(fightRounds(side(EVEN, true), side(EVEN), 'g1', 1, 0, { cmds: [], open: true }).pending?.guess, g)
  })

  it('낌새가 있으면 낌새대로 하나 — 없으면 적이 어떻게 나오든 (폭)', () => {
    const seen = fightRounds(side(EVEN, true), side(EVEN), 'g2', 2, 0, { cmds: [], open: true }).pending!
    assert.ok(seen.hint !== null)
    assert.equal(seen.guess?.by, 'hint')
    const v = seen.guess!.opts.front!.charge!
    assert.equal(v.edge[0], v.edge[1])
    const blind = fightRounds(side(EVEN, true, { seen: false }), side(EVEN), 'g2', 2, 0, { cmds: [], open: true }).pending!
    assert.equal(blind.hint, null)
    assert.equal(blind.guess?.by, 'all')
    assert.ok(Object.values(blind.guess!.opts.front!).some((x) => x!.edge[1] > x!.edge[0]))
  })

  it('낌새의 맞수가 낌새에 지는 수보다 낫다 (많은 판)', () => {
    const COUNTER: Record<string, string> = { charge: 'hold', hold: 'open', open: 'charge' }
    const LOSER: Record<string, string> = { charge: 'open', hold: 'charge', open: 'hold' }
    let better = 0
    let n = 0
    for (let s = 0; s < 60; s++) {
      const p = fightRounds(side(EVEN, true), side(EVEN), `g3-${s}`, s, 0, { cmds: [], open: true }).pending!
      if (p.hint === null) continue
      const row = p.guess!.opts.front!
      const good = row[COUNTER[p.hint] as 'hold']
      const bad = row[LOSER[p.hint] as 'hold']
      if (good === undefined || bad === undefined) continue
      n++
      if (good.edge[0] > bad.edge[0]) better++
    }
    assert.ok(n >= 30, `판 ${n}`)
    assert.ok(better / n >= 0.8, `${better}/${n}`)
  })
})
