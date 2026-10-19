/**
 * 직접 지휘하는 싸움 (realm/tactics.ts · 형 2026-10-19: "상성 · 포획은 직접 · 열세여도 잘 판단하면 이기고 우세여도 잘못 판단하면 진다")
 *
 *  - 세모: 돌격 > 화살비 > 방진 > 돌격 — 이긴 명령이 그 라운드를 민다
 *  - 명령의 세기는 병종 구성이 정한다
 *  - 사로잡기는 적이 줄수록 잘 된다
 *  - 같은 판 같은 명령이면 같은 결과 (A1) · 맡기면 AI 가 고른다 · 시험 돌림(open)은 다음 고를 것을 낸다
 *  - 잘 읽으면 열세를 뒤집고, 못 읽으면 우세에도 진다 (많은 판의 평균)
 *  - 진군 방식 · 군량 · 막힌 길 (season.ts)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { BASIC, COUNTER, captureChance, fightRounds, might, optionsOf, type Side } from '../../src/realm/tactics.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { advance, approachOptions } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Cmd, Order } from '../../src/realm/types.ts'
import { anyOurs, rehearse } from '../../src/realm/warroom.ts'

const side = (F: number, mix: Side['mix'], player = false, over: Partial<Side> = {}): Side => ({
  F, mix, morale: 1, hero: { id: player ? 'me' : 'foe', mu: 5, ryak: 5, coward: false }, hungry: false, specials: [], water: false, player, seen: true, ...over,
})
const SPEAR = { spear: 80, bow: 10, shield: 10 }
const BOW = { spear: 10, bow: 80, shield: 10 }
const SHIELD = { spear: 10, bow: 10, shield: 80 }
const EVEN = { spear: 34, bow: 33, shield: 33 }
const won = (o: string): boolean => o === 'win' || o === 'rout'

describe('직접 지휘하는 싸움 — 라운드', () => {
  it('명령의 세기는 병종이 정한다 — 창병은 돌격, 궁수는 화살비, 방패병은 방진', () => {
    assert.ok(might({ mix: SPEAR, water: false }, 'charge') > might({ mix: SPEAR, water: false }, 'volley'))
    assert.ok(might({ mix: BOW, water: false }, 'volley') > might({ mix: BOW, water: false }, 'charge'))
    assert.ok(might({ mix: SHIELD, water: false }, 'hold') > might({ mix: SHIELD, water: false }, 'volley'))
    // 수군은 물 위에서만 돌격·화살비에 낀다
    assert.ok(might({ mix: { boat: 100 }, water: true }, 'charge') > might({ mix: { boat: 100 }, water: false }, 'charge'))
  })

  it('세모 — 돌격 > 화살비 > 방진 > 돌격, 이긴 쪽이 민다', () => {
    for (const [a, d] of [['charge', 'volley'], ['volley', 'hold'], ['hold', 'charge']] as Array<[Cmd, Cmd]>) {
      // 적이 진 명령을 낸 라운드만 모아 — 이긴 명령을 낸 쪽이 평균으로 민다
      const push: number[] = []
      for (let s = 0; s < 120; s++) {
        const r1 = fightRounds(side(100, EVEN, true), side(100, EVEN), `k${s}`, s, 0, { cmds: [a] })
        if (r1.rounds[0]!.d !== d) continue
        assert.equal(r1.rounds[0]!.beat, 'a')
        push.push(r1.rounds[0]!.push)
      }
      assert.ok(push.length > 0)
      assert.ok(push.reduce((x, y) => x + y, 0) / push.length > 0.5, `${a} 가 ${d} 를 민다`)
    }
  })

  it('같은 판 같은 명령이면 같은 결과', () => {
    const t = { cmds: ['charge', 'hold', 'volley', 'capture'] as Cmd[] }
    const x = fightRounds(side(120, SPEAR, true), side(100, BOW), 'same', 7, 3, t)
    const y = fightRounds(side(120, SPEAR, true), side(100, BOW), 'same', 7, 3, t)
    assert.deepEqual(x, y)
  })

  it('시험 돌림 — 고를 것 · 세기 · 사로잡기 · 낌새를 낸다. 고른 명령을 더하면 다음 라운드로', () => {
    const a = side(100, SPEAR, true)
    const d = side(100, BOW)
    const t0 = fightRounds(a, d, 'open', 1, 0, { cmds: [], open: true })
    assert.ok(t0.pending !== undefined && t0.pending.round === 0 && t0.pending.weAtk)
    assert.ok(t0.pending.options.includes('charge') && t0.pending.options.includes('capture') && t0.pending.options.includes('retreat'))
    assert.ok(t0.pending.hint !== null && BASIC.includes(t0.pending.hint))
    const t1 = fightRounds(a, d, 'open', 1, 0, { cmds: ['charge'], open: true })
    assert.equal(t1.rounds[0]!.a, 'charge')
    if (t1.pending !== undefined) assert.equal(t1.pending.round, 1)
    // 지키는 쪽도 플레이어일 수 있다
    const td = fightRounds(side(100, SPEAR), side(100, BOW, true), 'open', 1, 0, { cmds: [], open: true })
    assert.equal(td.pending?.weAtk, false)
  })

  it('사로잡기는 적이 줄수록 · 사기가 꺾일수록 잘 된다. 적장이 없으면 못 한다', () => {
    const me = side(100, EVEN, true)
    const foe = side(100, EVEN)
    const c1 = captureChance(me, foe, 1, 1, 1, 0.5, false)
    const c2 = captureChance(me, foe, 1, 0.6, 1, 0.5, false)
    const c3 = captureChance(me, foe, 1, 0.6, 0.6, 0.7, false)
    assert.ok(c1 < c2 && c2 < c3, `${c1} < ${c2} < ${c3}`)
    const noHero = side(100, EVEN, false, { hero: null })
    assert.equal(captureChance(me, noHero, 1, 0.5, 0.5, 0.8, false), 0)
    assert.ok(!optionsOf(me, noHero, new Set(), false).includes('capture'))
    // 겁 많은 장수는 먼저 달아난다
    assert.ok(captureChance(me, side(100, EVEN, false, { hero: { id: 'c', mu: 5, ryak: 5, coward: true } }), 1, 0.6, 1, 0.5, false) < c2)
  })

  it('사로잡으면 판이 끝나고 대승 — 플레이어가 직접 노린다', () => {
    let caught = 0
    for (let s = 0; s < 80; s++) {
      const r = fightRounds(side(160, EVEN, true), side(100, EVEN), `cap${s}`, s, 0, { cmds: ['charge', 'charge', 'capture', 'capture'] })
      if (r.captured === 'd') {
        caught++
        assert.equal(r.outcome, 'rout')
        assert.equal(r.rounds[r.rounds.length - 1]!.ev, 'capture-ok')
      }
    }
    assert.ok(caught > 0)
  })

  it('물러나면 손실이 적고 장수가 안 잡힌다', () => {
    const r = fightRounds(side(60, EVEN, true), side(100, EVEN), 'ret', 2, 0, { cmds: ['retreat'] })
    assert.equal(r.outcome, 'lose')
    assert.equal(r.captured, null)
    assert.ok(r.na > 1 - P.realm.tacRoundLoss)
  })

  it('잘 읽으면 열세를 뒤집고, 못 읽으면 우세에도 진다 (많은 판의 평균)', () => {
    const N = 300
    let readWins = 0
    let autoWins = 0
    let badWins = 0
    let autoStrong = 0
    for (let s = 0; s < N; s++) {
      const foe = side(100, [SPEAR, BOW, SHIELD, EVEN][s % 4]!)
      // 열세(0.8) — 낌새를 읽어 그 맞수를 낸다
      const me = side(80, EVEN, true)
      const cmds: Cmd[] = []
      for (;;) {
        const t = fightRounds(me, foe, `w${s}`, s, 0, { cmds, open: true })
        if (t.pending === undefined) {
          readWins += won(t.outcome) ? 1 : 0
          break
        }
        cmds.push(t.pending.capture >= 0.45 ? 'capture' : COUNTER[t.pending.hint ?? 'charge'] ?? 'charge')
      }
      autoWins += won(fightRounds(side(80, EVEN), foe, `w${s}`, s, 0).outcome) ? 1 : 0
      // 우세(1.25) — 적의 가장 센 명령에 지는 명령만 낸다
      const best = [...BASIC].sort((x, y) => might(foe, y) - might(foe, x))[0]!
      const loser = BASIC.find((c) => COUNTER[c] === best)!
      badWins += won(fightRounds(side(125, EVEN, true), foe, `b${s}`, s, 0, { cmds: [loser, loser, loser, loser] }).outcome) ? 1 : 0
      autoStrong += won(fightRounds(side(125, EVEN), foe, `b${s}`, s, 0).outcome) ? 1 : 0
    }
    assert.ok(readWins > autoWins * 1.5, `열세 — 읽음 ${readWins} · 맡김 ${autoWins}`)
    assert.ok(readWins / N > 0.3, `열세에서 읽으면 셋에 하나는 넘게 이긴다 ${readWins / N}`)
    assert.ok(badWins < autoStrong * 0.7, `우세 — 못 읽음 ${badWins} · 맡김 ${autoStrong}`)
    assert.ok(badWins / N < 0.5, `우세여도 못 읽으면 반도 못 이긴다 ${badWins / N}`)
  })
})

describe('전장 화면의 시험 돌림 (warroom.ts)', () => {
  it('고른 명령으로 진짜 넘기면 시험 돌림과 같은 싸움이 난다', () => {
    const r = byeonhanMini(4)
    const a = r.armies['a-us']!
    const ed = Object.values(r.edges).find((e) => {
      const to = e.a === a.at ? e.b : e.b === a.at ? e.a : null
      return to !== null && r.nodes[to]!.owner !== null && r.nodes[to]!.owner !== 'us' && r.nodes[to]!.kind !== 'sodo'
    })
    assert.ok(ed !== undefined, '이웃 나라 고을로 가는 길')
    // 한 계절에 닿는 길이 아니면 한 번 더 넘긴다
    let prev = r
    let orders: Order[] = [{ kind: 'march', army: 'a-us', edge: ed.id, ambush: false, approach: 'road', ration: 'full' }]
    for (let i = 0; i < 4; i++) {
      if (anyOurs(prev, orders, 'us')) break
      prev = advance(prev, orders).next
      orders = []
    }
    assert.ok(anyOurs(prev, orders, 'us'), '우리 싸움이 난다')
    const done: Record<string, { cmds: Cmd[] }> = {}
    let cur: { key: string; cmds: Cmd[] } | null = null
    let seen: ReturnType<typeof rehearse>['line'] = null
    for (let guard = 0; guard < 20; guard++) {
      const t = rehearse(prev, orders, done, cur, 'us')
      if (t.line === null) break
      if (cur === null || cur.key !== t.line.key) cur = { key: t.line.key!, cmds: [] }
      if (t.line.pending === undefined) {
        done[cur.key] = { cmds: cur.cmds }
        seen = t.line
        cur = null
        continue
      }
      const p = t.line.pending
      cur.cmds.push(p.capture >= 0.45 ? 'capture' : COUNTER[p.hint ?? 'charge'] ?? 'charge')
    }
    assert.ok(seen !== null)
    const real = advance(prev, orders, {}, done).report.lines.find((l) => l.kind === 'battle' && l.key === seen!.key)
    assert.ok(real !== undefined && real.kind === 'battle')
    assert.equal(real.outcome, seen.outcome)
    assert.deepEqual(real.rounds, seen.rounds)
    assert.equal(real.led, true)
  })
})

describe('진군 방식 · 군량 · 막힌 길', () => {
  it('고를 수 있는 진군 방식 — 남의 땅만 숨어 가고, 강이면 여울 · 산성이면 절벽', () => {
    const r = byeonhanMini(1)
    for (const ed of Object.values(r.edges)) {
      for (const to of [ed.a, ed.b]) {
        const opts = approachOptions(r, ed, to)
        assert.equal(opts[0], 'road')
        const node = r.nodes[to]!
        if (node.owner === null || node.kind === 'sodo') assert.deepEqual(opts, ['road'])
        if (opts.includes('ford')) assert.ok(ed.kind === 'ford' || ed.kind === 'reeds' || ed.tags.includes('shallows'))
        if (opts.includes('cliff')) assert.ok(node.kind === 'fort' || node.tags.includes('high'))
      }
    }
  })

  it('넉넉히 챙기면 곡식이 들고 군량이 남는다 · 가볍게면 곡식이 안 든다', () => {
    const r = byeonhanMini(2)
    const a = Object.values(r.armies).find((x) => x.faction === 'us')!
    const ed = Object.values(r.edges).find((e) => e.a === a.at || e.b === a.at)!
    const g0 = r.stock['us']?.grain ?? 0
    const full = advance(r, [{ kind: 'march', army: a.id, edge: ed.id, ambush: false, ration: 'full' }])
    const light = advance(r, [{ kind: 'march', army: a.id, edge: ed.id, ambush: false, ration: 'light' }])
    const gFull = full.next.stock['us']?.grain ?? 0
    const gLight = light.next.stock['us']?.grain ?? 0
    assert.ok(gFull < gLight, `넉넉히 ${gFull} < 가볍게 ${gLight} (처음 ${g0})`)
  })
})
