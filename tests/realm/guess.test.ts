/**
 * 고르기 전 짐작 (tactics.lookRound · 형 10-24: "어떤걸 선택하면 어떤 결과 예상되는지 문명처럼" · 10-26: "어느정도가 +- 범위이고 어느정도가 확률인지")
 *
 *  - 시험 돌림의 pending 에 짐작의 판(look)이 실린다 — 깃발마다 이번 합에 양쪽이 잃을 사람·사기의 폭, 합 뒤 판세
 *  - 본 귀띔이 있으면 그만큼 좁힌다(by saw) — 없으면 적이 어떻게 나오든(all). 좁힌 폭이 평균으로 더 좁다
 *  - 귀띔을 받아치는 수가 귀띔에 지는 수보다 판세가 낫다 (많은 판에서)
 *  - 사로잡기만 잡을 확률을 따로 낸다 · 퇴각은 굴림이 없어 한 값 · 같은 판이면 같은 짐작 (A1)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { fightRounds, lookRound, type Side } from '../../src/realm/tactics.ts'
import { P } from '../../src/tune/params.ts'
import type { Cmd, Look } from '../../src/realm/types.ts'

const side = (mix: Side['mix'], player = false, over: Partial<Side> = {}): Side => ({
  F: 100, mix, morale: 1, hero: { id: player ? 'me' : 'foe', mu: 5, ryak: 5, coward: false }, hungry: false, specials: [], water: false, player, seen: true, ...over,
})
const EVEN = { spear: 34, bow: 33, shield: 33 }
const width = (x: readonly [number, number]): number => x[1] - x[0]

describe('고르기 전 짐작', () => {
  it('깃발마다 짐작 — 잃을 사람은 0 이상, 폭은 아래 ≤ 위, 같은 판이면 같은 짐작', () => {
    const t = fightRounds(side(EVEN, true), side(EVEN), 'g1', 1, 0, { cmds: [], open: true })
    const at = t.pending?.look
    assert.ok(at !== undefined)
    for (const grp of t.pending!.groups) {
      for (const c of grp.options) {
        const v: Look = lookRound(at, { [grp.g]: c })
        for (const x of [v.us, v.foe, v.usMor, v.foeMor, v.edge]) assert.ok(x[0] <= x[1] + 1e-9, `${grp.g}:${c}`)
        assert.ok(v.us[0] >= 0 && v.foe[0] >= 0)
        assert.ok(v.edge[0] >= 0 && v.edge[1] <= 1)
        assert.equal(v.capture, undefined)
      }
    }
    const again = fightRounds(side(EVEN, true), side(EVEN), 'g1', 1, 0, { cmds: [], open: true }).pending!.look!
    assert.deepEqual(lookRound(again, { front: 'charge' }), lookRound(at, { front: 'charge' }))
  })

  it('본 귀띔이면 좁힌다 — 안 보이면 적이 어떻게 나오든 (평균 폭이 더 넓다)', () => {
    let wSaw = 0
    let wAll = 0
    let n = 0
    for (let s = 0; s < 40; s++) {
      const seen = fightRounds(side(EVEN, true), side(EVEN), `g2-${s}`, s, 0, { cmds: [], open: true }).pending!
      const blind = fightRounds(side(EVEN, true, { seen: false }), side(EVEN), `g2-${s}`, s, 0, { cmds: [], open: true }).pending!
      assert.equal(blind.hint, null)
      assert.equal(blind.look?.by, 'all')
      if (seen.look?.by !== 'saw') continue
      for (const c of ['charge', 'hold', 'open'] as const) {
        wSaw += width(lookRound(seen.look, { front: c }).us)
        wAll += width(lookRound(blind.look!, { front: c }).us)
        n++
      }
    }
    assert.ok(n >= 60, `판 ${n}`)
    assert.ok(wSaw < wAll * 0.9, `귀띔 ${(wSaw / n).toFixed(2)} · 모름 ${(wAll / n).toFixed(2)}`)
  })

  it('귀띔을 받아치는 수가 귀띔에 지는 수보다 낫다 (많은 판)', () => {
    const COUNTER: Record<string, Cmd> = { charge: 'hold', hold: 'open', open: 'charge' }
    const LOSER: Record<string, Cmd> = { charge: 'open', hold: 'charge', open: 'hold' }
    let better = 0
    let n = 0
    for (let s = 0; s < 60; s++) {
      const p = fightRounds(side(EVEN, true), side(EVEN), `g3-${s}`, s, 0, { cmds: [], open: true }).pending!
      if (p.hint === null || p.look === undefined) continue
      const mid = (x: Look): number => (x.edge[0] + x.edge[1]) / 2
      n++
      if (mid(lookRound(p.look, { front: COUNTER[p.hint]! })) > mid(lookRound(p.look, { front: LOSER[p.hint]! }))) better++
    }
    assert.ok(n >= 30, `판 ${n}`)
    assert.ok(better / n >= 0.8, `${better}/${n}`)
  })

  it('사로잡기는 잡을 확률을 따로 · 퇴각은 한 값', () => {
    const p = fightRounds(side({ spear: 150, bow: 60, shield: 40, horse: 50 }, true), side(EVEN), 'g4', 4, 0, { cmds: [], open: true }).pending!
    assert.ok(p.lead.includes('capture'))
    const cap = lookRound(p.look!, { lead: 'capture' })
    assert.ok(cap.capture !== undefined && cap.capture[0] > 0 && cap.capture[1] <= P.realm.captureMax + 1e-9)
    const back = lookRound(p.look!, { lead: 'retreat' })
    assert.equal(width(back.us), 0)
    assert.equal(back.foe[1], 0)
  })
})
