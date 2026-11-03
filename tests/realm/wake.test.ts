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
const waker = (e: 'earth' | 'wind' | 'fire' | 'water' | 'bolt'): Side['hero'] => ({ id: 'me', mu: 6, ryak: 5, coward: false, wake: e })

/** 합마다 고른다 — n 번째 합(0부터)에 각성기를 낸다 */
const playAt = (me: Side, foe: Side, key: string, seed: number, at: number): ReturnType<typeof fightRounds> => {
  const cmds: RoundOrder[] = []
  let t = fightRounds(me, foe, key, seed, 0, { cmds, open: true })
  for (let g = 0; g < 10 && t.pending !== undefined; g++) {
    cmds.push({ front: 'hold', bows: 'volley', lead: g === at ? 'wake' : 'drum' })
    t = fightRounds(me, foe, key, seed, 0, { cmds, open: true })
  }
  return t
}

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

describe('각성기 — 둘째 판 (물 · 번개)', () => {
  it('물 — 쓰러진 우리 군사 일부가 다시 서고 사기가 처음으로', () => {
    // 둘째 합에 쓴다 — 첫 합에 잃은 몫이 있어야 되살린다. 같은 판에서 북만 친 것과 견준다
    const foe = side(1.4, MIX, false, { capture: 'never' })
    let more = 0
    let n = 0
    for (let s = 1; s <= 8; s++) {
      const plain = playAt(side(1, MIX, true, { hero: waker('water') }), foe, `wa${s}`, s, 99)
      const woke = playAt(side(1, MIX, true, { hero: waker('water') }), foe, `wa${s}`, s, 1)
      const r1p = plain.rounds[1]
      const r1w = woke.rounds[1]
      if (r1p === undefined || r1w === undefined) continue
      n++
      // 둘째 합이 끝났을 때 남은 우리 몫이 북만 친 판보다 많다 (되살아난 몫)
      if (r1w.na > r1p.na) more++
    }
    assert.ok(n > 0 && more >= Math.ceil(n * 0.75), `${more}/${n}`)
  })

  it('번개 — 이 싸움 남은 합은 적의 수를 먼저 본다 (낌새가 늘 맞다)', () => {
    // 적을 못 본 싸움(seen 거짓) — 쓰기 전엔 낌새가 없다가, 쓴 뒤 합부터 「봤다」로 뜬다
    const me = side(1, MIX, true, { hero: waker('bolt'), seen: false })
    const foe = side(1, MIX)
    const cmds: RoundOrder[] = []
    let t = fightRounds(me, foe, 'bo', 2, 0, { cmds, open: true })
    assert.equal(t.pending?.hint ?? null, null)
    cmds.push({ front: 'hold', bows: 'volley', lead: 'wake' })
    t = fightRounds(me, foe, 'bo', 2, 0, { cmds, open: true })
    assert.ok(t.pending !== undefined)
    assert.notEqual(t.pending!.hint ?? null, null)
    assert.equal(t.pending!.hintSrc, 'saw')
  })

  it('번개 — 이 합 적의 꾀(매복)는 들켜 헛일', () => {
    const me = side(1, MIX, true, { hero: waker('bolt') })
    const foe = side(1, MIX, false, { hero: { id: 'foe', mu: 5, ryak: 5, coward: false, art: 'ambush' } })
    const t = play(me, foe, 'bo2', 4, 'wake')
    const foeArts = t.rounds[0]!.acts?.filter((a) => a.s === 'd' && a.c === 'art') ?? []
    for (const a of foeArts) assert.equal(a.res, 'wasted')
  })

  it('다시 깨어나면 보고 줄에 again — 화면이 짧은 연출로', () => {
    const r = byeonhanMini(1)
    const h = Object.values(r.heroes).filter((x) => x.faction === r.player && x.status === 'free').sort((a, b) => (a.id < b.id ? -1 : 1)).at(-1)!
    const lines: ReportLine[] = []
    for (let i = 0; i < P.realm.ascendWins; i++) battleGrowth(r, [h.id], [], [], lines)
    assert.ok(lines.some((l) => l.kind === 'ascend' && l.again === undefined))
    for (let i = 0; i < P.realm.ascendWins; i++) battleGrowth(r, [], [h.id], [], lines) // 다 꺼져 풀린다
    const more: ReportLine[] = []
    for (let i = 0; i < P.realm.ascendWins; i++) battleGrowth(r, [h.id], [], [], more)
    assert.ok(more.some((l) => l.kind === 'ascend' && l.again === true))
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
    assert.equal(wakeOf(r, h), e) // 다섯 기운 다 켰다 (둘째 판)
    h.flames = 1
    assert.equal(wakeOf(r, h), null)
    const foe = Object.values(r.heroes).find((x) => x.faction !== r.player)!
    foe.ascended = true
    foe.flames = 3
    assert.equal(wakeOf(r, foe), null)
  })
})

describe('진각성 (DESIRE §17 · 한 판에 한 번 · 큰 싸움에서만)', () => {
  const trueWaker = (e: 'earth' | 'fire'): Side['hero'] => ({ id: 'me', mu: 6, ryak: 5, coward: false, wake: e, trueWake: true })
  it('큰 싸움이면 각성기가 진각성으로 터지고 적 사기가 더 꺾인다 · 작은 싸움이면 보통 각성기', () => {
    const big = play(side(1, MIX, true, { hero: trueWaker('fire') }), side(1, MIX), 'tw1', 3, 'wake')
    assert.equal(big.trueA, 'me')
    assert.ok(big.rounds.flatMap((rd) => rd.acts ?? []).some((a) => a.c === 'wake' && a.true === true))
    const small = play(side(1, MIX, true, { hero: trueWaker('fire') }), side(0.3, { spear: 10 }), 'tw1', 3, 'wake')
    assert.equal(small.trueA, undefined)
  })
  it('진각성 장부 — 이 판에서 한 번 하면 다시 자격이 없다', async () => {
    const { trueWakeOf } = await import('../../src/realm/heroes.ts')
    const r = byeonhanMini(1)
    const h = r.heroes['chief']!
    h.faction = r.player
    ;(h as Hero).ascended = true
    assert.equal(trueWakeOf(r, h), false) // 2차 초상이 없는 장수
    r.heroes['sr-aryeong'] = { ...h, id: 'sr-aryeong' }
    assert.equal(trueWakeOf(r, r.heroes['sr-aryeong']!), true)
    r.trueWoke = ['sr-aryeong']
    assert.equal(trueWakeOf(r, r.heroes['sr-aryeong']!), false)
  })
})
