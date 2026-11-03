/**
 * 각성기 (tactics 'wake' · 위원회 11-04 던파 ① · DESIRE §8·§13-3) — 깨어난 우리 장수가 불꽃 하나를 태워 그 합의 규칙 하나를 꺾는다.
 *  - 깨어난 우리 장수만 · 불꽃이 wakeMinFlames 이상 · 켠 기운(땅·바람·불)만 · 적에게는 없다
 *  - 한 판에 한 번 · 쓰면 불꽃 하나를 태운다(마지막 하나는 남는다)
 *  - 땅: 그 싸움 무너지지 않는다 · 바람: 그 합 적 화살이 안 닿는다 · 불: 그 합 상성에 져도 밀리지 않는다
 *  - 깨어난 장수는 이기면 불꽃 하나(셋까지), 지면 하나 꺼지고, 다 꺼지면 깨어남이 풀린다
 *  - 같은 판이면 같은 결과 (A1)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { fightRounds, leadOptions, type Side } from '../../src/realm/tactics.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { battleGrowth, burnWake, wakeOf } from '../../src/realm/heroes.ts'
import { elemOf } from '../../src/realm/elem.ts'
import { P } from '../../src/tune/params.ts'
import type { Hero, ReportLine, RoundOrder } from '../../src/realm/types.ts'

const side = (F: number, mix: Side['mix'], player = false, over: Partial<Side> = {}): Side => ({
  F, mix, morale: 1, hero: { id: player ? 'me' : 'foe', mu: 5, ryak: 5, coward: false }, hungry: false, specials: [], water: false, player, seen: true, ...over,
})
const MIX = { spear: 40, bow: 40, shield: 20 }
const waker = (e: 'earth' | 'wind' | 'fire'): Side['hero'] => ({ id: 'me', mu: 6, ryak: 5, coward: false, wake: e })

/** 플레이어가 합마다 고른다 — 첫 합에 각성기를 낸다 */
const play = (me: Side, foe: Side, key: string, seed: number, lead0: NonNullable<RoundOrder['lead']>): ReturnType<typeof fightRounds> => {
  const cmds: RoundOrder[] = []
  let t = fightRounds(me, foe, key, seed, 0, { cmds, open: true })
  for (let g = 0; g < 10 && t.pending !== undefined; g++) {
    cmds.push({ front: 'hold', bows: 'volley', lead: g === 0 ? lead0 : 'drum' })
    t = fightRounds(me, foe, key, seed, 0, { cmds, open: true })
  }
  return t
}

describe('각성기 — 싸움', () => {
  it('쥔 장수가 있을 때만 명령에 뜬다 · 한 판에 한 번', () => {
    const plain = side(1, MIX, true)
    const foe = side(1, MIX)
    assert.ok(!leadOptions(plain, foe, new Set(), false).includes('wake'))
    const me = side(1, MIX, true, { hero: waker('earth') })
    assert.ok(leadOptions(me, foe, new Set(), false).includes('wake'))
    assert.ok(!leadOptions(me, foe, new Set(['wake']), false).includes('wake'))
    // 쓰면 그 판에서는 다시 안 뜬다
    const t = play(me, foe, 'w1', 1, 'wake')
    assert.equal(t.wokeA, 'me')
    const wakes = t.rounds.flatMap((rd) => rd.acts ?? []).filter((a) => a.c === 'wake' && a.s === 'a')
    assert.equal(wakes.length, 1)
  })

  it('땅 — 그 싸움 무너지지 않는다', () => {
    // 크게 밀리는 싸움 — 각성기 없이는 무너진다 (사로잡힘으로 끝나는 판은 이 시험의 몫이 아니라 적의 사로잡기는 막는다)
    const weak = (h: Side['hero']): Side => side(0.4, MIX, true, { hero: h })
    const strong = side(2.2, MIX, false, { capture: 'never' })
    let brokeNo = 0
    let brokeWake = 0
    for (let s = 1; s <= 12; s++) {
      { const w = play(weak({ id: 'me', mu: 6, ryak: 5, coward: false }), strong, `e${s}`, s, 'drum').endWhy; if (w === 'men' || w === 'morale') brokeNo++ }
      const t = play(weak(waker('earth')), strong, `e${s}`, s, 'wake')
      if (t.endWhy === 'men' || t.endWhy === 'morale') brokeWake++
    }
    assert.ok(brokeNo > 0, '시험이 맞으려면 각성기 없는 쪽이 무너져야 한다')
    assert.equal(brokeWake, 0)
  })

  it('바람 — 그 합 적의 화살이 막힌다', () => {
    const me = side(1, MIX, true, { hero: waker('wind') })
    const t = play(me, side(1, MIX), 'w2', 3, 'wake')
    const first = t.rounds[0]!
    assert.ok((first.acts ?? []).some((a) => a.s === 'd' && a.g === 'bows' && a.res === 'blocked'))
  })

  it('불 — 같은 판이면 같은 결과 (A1) · 적은 각성기가 없다', () => {
    const me = side(1, MIX, true, { hero: waker('fire') })
    const foe = side(1, MIX, false, { hero: { id: 'foe', mu: 5, ryak: 5, coward: false, wake: 'fire' } })
    assert.deepEqual(play(me, foe, 'w3', 5, 'wake'), play(me, foe, 'w3', 5, 'wake'))
    // 적이 각성기를 쥔 것처럼 넣어도 AI 는 내지 않는다
    const t = play(me, foe, 'w3', 5, 'drum')
    assert.ok(!t.rounds.some((rd) => (rd.acts ?? []).some((a) => a.c === 'wake' && a.s === 'd')))
  })
})

describe('각성기 — 불꽃', () => {
  const setup = (): { r: ReturnType<typeof byeonhanMini>; h: Hero } => {
    const r = byeonhanMini(1)
    const h = Object.values(r.heroes).filter((x) => x.faction === r.player && x.status === 'free').sort((a, b) => (a.id < b.id ? -1 : 1)).at(-1)!
    return { r, h }
  }

  it('깨어나면 불꽃 셋이 연료 · 쓰면 하나를 태우고 마지막 하나는 남는다', () => {
    const { r, h } = setup()
    const lines: ReportLine[] = []
    for (let i = 0; i < P.realm.ascendWins; i++) battleGrowth(r, [h.id], [], [], lines)
    assert.equal(h.ascended, true)
    assert.equal(h.flames, P.realm.ascendWins)
    burnWake(r, h.id, lines)
    assert.equal(h.flames, P.realm.ascendWins - 1)
    for (let i = 0; i < 5; i++) burnWake(r, h.id, lines)
    assert.equal(h.flames, 1)
  })

  it('깨어난 장수가 지면 하나 꺼지고, 다 꺼지면 깨어남이 풀리고 각성 몫이 빠진다', () => {
    const { r, h } = setup()
    const lines: ReportLine[] = []
    for (let i = 0; i < P.realm.ascendWins; i++) battleGrowth(r, [h.id], [], [], lines)
    const up = { mu: h.mu, tong: h.tong }
    battleGrowth(r, [], [h.id], [], lines)
    assert.equal(h.flames, P.realm.ascendWins - 1)
    assert.equal(h.ascended, true)
    for (let i = 0; i < P.realm.ascendWins; i++) battleGrowth(r, [], [h.id], [], lines)
    assert.notEqual(h.ascended, true)
    assert.equal(h.flames, undefined)
    assert.ok(lines.some((l) => l.kind === 'fade' && l.hero === h.id))
    // 지면 공(xp)이 조금 붙어 능력치가 오를 수도 있다 — 각성 몫만큼은 빠졌는지만 본다
    assert.ok(h.mu <= up.mu - P.realm.ascendBonus + 1 && h.tong <= up.tong - P.realm.ascendBonus + 1)
  })

  it('각성기를 쥐는 것은 깨어난 우리 장수 · 불꽃 둘 이상 · 켠 기운만', () => {
    const { r, h } = setup()
    assert.equal(wakeOf(r, h), null)
    const lines: ReportLine[] = []
    for (let i = 0; i < P.realm.ascendWins; i++) battleGrowth(r, [h.id], [], [], lines)
    const e = elemOf(h)
    assert.equal(wakeOf(r, h), e === 'earth' || e === 'wind' || e === 'fire' ? e : null)
    h.flames = 1
    assert.equal(wakeOf(r, h), null)
    const foe = Object.values(r.heroes).find((x) => x.faction !== r.player)!
    foe.ascended = true
    foe.flames = 3
    assert.equal(wakeOf(r, foe), null)
  })
})
