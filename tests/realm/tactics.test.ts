/**
 * 직접 지휘하는 싸움 — 전투 2판 (realm/tactics.ts · docs/realm/BATTLE.md §전투 2판 · 형 2026-10-19:
 * "기병컨트롤은 방법이없나" · "창병움직이면 다른애들 가만있냐. 각자 행동 컨트롤" · "28명과 570명이었는데 이게 가능한가??")
 *
 *  - 무리마다 따로 깃발 — 앞줄 · 활 · 기병 · 장수. 기병 명령은 기병이 있을 때만, 땅의 수는 그 땅에서만 (한 번)
 *  - 앞줄의 세모: 방진 > 돌격 > 길 트기 > 방진 · 흔들리는 방진은 돌격에 뚫린다
 *  - 사로잡기는 날랜 무리와 적장 곁 호위를 견준다 — 28 대 570 은 거의 안 된다
 *  - 해시계 — 낮이면 아침~해질녘, 기습·야습이면 한밤~새벽 넷 때 · 마지막 때 뒤엔 진을 친다 · 한 합 더 · 물러난다 · 한쪽이 무너지면 일찍 끝난다
 *  - 밤 — 화살이 덜 맞고 불화살이 더 무섭고 밀린 쪽 사기가 크게 흔들린다 · 먹힌 야습은 첫 때에 치는 쪽이 세다
 *  - 같은 판 같은 명령이면 같은 결과 (A1) · 맡기면 AI 가 고른다 · 시험 돌림(open)은 다음 고를 것을 낸다
 *  - 잘 읽으면 열세를 뒤집고, 한 수만 되풀이하면 우세에도 진다 (많은 판의 평균)
 *  - 진군 방식 · 군량 · 막힌 길 (season.ts)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { captureChance, captureOdds, feastCost, fightRounds, groupOptions, leadOptions, lookRound, might, nightAt, optionsOf, pressCost, slotsFor, type Side } from '../../src/realm/tactics.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { advance, approachOptions } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Cmd, Order, Pending, RoundLog, RoundOrder, Tactic } from '../../src/realm/types.ts'
import { anyOurs, rehearse } from '../../src/realm/warroom.ts'

const side = (F: number, mix: Side['mix'], player = false, over: Partial<Side> = {}): Side => ({
  F, mix, morale: 1, hero: { id: player ? 'me' : 'foe', mu: 5, ryak: 5, coward: false }, hungry: false, specials: [], water: false, player, seen: true, ...over,
})
const SPEAR = { spear: 80, bow: 10, shield: 10 }
const BOW = { spear: 10, bow: 80, shield: 10 }
const SHIELD = { spear: 10, bow: 10, shield: 80 }
const EVEN = { spear: 34, bow: 33, shield: 33 }
const HORSE = { spear: 30, bow: 20, shield: 10, horse: 40 }
const MIXES = [{ spear: 60, bow: 20, shield: 10, horse: 10 }, { spear: 20, bow: 60, shield: 20 }, { spear: 20, bow: 10, shield: 70 }, HORSE]
const won = (o: string): boolean => o === 'win' || o === 'rout'

/** 낌새를 읽는 지휘 — 적 앞줄의 맞수 · 흔들리면 돌격과 추격 · 손이 닿으면 사로잡기 */
const reader = (p: Pending): RoundOrder => ({
  front: p.foeWaver ? 'charge' : p.hint === 'charge' ? 'hold' : p.hint === 'hold' ? (p.groups.some((g) => g.g === 'bows') ? 'open' : 'hold') : p.hint === 'open' ? 'charge' : 'hold',
  bows: 'volley',
  horse: p.foeWaver ? 'pursue' : (p.foe.bows ?? 0) > 0 ? 'flank' : 'punch',
  lead: p.capture >= 0.45 ? 'capture' : 'drum',
})
/** 시험 돌림으로 끝까지 — 합마다 who 가 고른다 */
const play = (me: Side, foe: Side, key: string, seed: number, who: (p: Pending) => RoundOrder): string => {
  const cmds: RoundOrder[] = []
  let t = fightRounds(me, foe, key, seed, 0, { cmds, open: true })
  for (let g = 0; g < 8 && t.pending !== undefined; g++) {
    cmds.push(who(t.pending))
    t = fightRounds(me, foe, key, seed, 0, { cmds, open: true })
  }
  return t.outcome
}

describe('직접 지휘하는 싸움 — 전투 2판', () => {
  it('명령의 세기는 병종이 정한다 — 창병은 돌격, 궁수는 화살비, 방패병은 방진', () => {
    assert.ok(might({ mix: SPEAR, water: false }, 'charge') > might({ mix: SPEAR, water: false }, 'volley'))
    assert.ok(might({ mix: BOW, water: false }, 'volley') > might({ mix: BOW, water: false }, 'charge'))
    assert.ok(might({ mix: SHIELD, water: false }, 'hold') > might({ mix: SHIELD, water: false }, 'volley'))
    assert.ok(might({ mix: { boat: 100 }, water: true }, 'charge') > might({ mix: { boat: 100 }, water: false }, 'charge'))
  })

  it('무리마다 따로 깃발 — 앞줄 · 활 · 기병 · 장수가 각자 제 명령을 한다', () => {
    const o: RoundOrder = { front: 'hold', bows: 'counter', horse: 'flank', lead: 'drum' }
    const r = fightRounds(side(100, HORSE, true), side(100, BOW), 'grp', 3, 0, { cmds: [o] })
    const rd = r.rounds[0]!
    assert.deepEqual(rd.oa, o)
    const acts = rd.acts ?? []
    assert.ok(acts.some((a) => a.s === 'a' && a.g === 'front' && a.c === 'hold'))
    assert.ok(acts.some((a) => a.s === 'a' && a.g === 'bows' && a.c === 'counter'))
    assert.ok(acts.some((a) => a.s === 'a' && a.g === 'horse' && a.c === 'flank'))
    // 고르지 않은 무리는 맡긴다 — 앞줄만 고르면 활·기병은 AI 가 채운다
    const r2 = fightRounds(side(100, HORSE, true), side(100, BOW), 'grp', 3, 0, { cmds: [{ front: 'charge' }] })
    assert.equal(r2.rounds[0]!.oa?.front, 'charge')
    assert.ok(r2.rounds[0]!.oa?.bows !== undefined && r2.rounds[0]!.oa?.horse !== undefined)
    // 옛 판의 명령 한 개도 받는다
    const r3 = fightRounds(side(100, HORSE, true), side(100, BOW), 'grp', 3, 0, { cmds: ['volley'] })
    assert.equal(r3.rounds[0]!.oa?.bows, 'volley')
  })

  it('기병 명령은 기병이 있을 때만 — 없으면 그 무리가 안 뜨고, 내려도 안 걸린다', () => {
    const noHorse = fightRounds(side(100, EVEN, true), side(100, EVEN), 'h', 1, 0, { cmds: [], open: true })
    assert.ok(noHorse.pending !== undefined)
    assert.ok(!noHorse.pending.groups.some((g) => g.g === 'horse'))
    assert.ok(!optionsOf(side(100, EVEN), side(100, EVEN), new Set(), false).some((c) => ['flank', 'punch', 'pursue', 'guard'].includes(c)))
    const r = fightRounds(side(100, EVEN, true), side(100, EVEN), 'h', 1, 0, { cmds: [{ horse: 'flank' }] })
    assert.equal(r.rounds[0]!.oa?.horse, undefined)
    const withHorse = fightRounds(side(100, HORSE, true), side(100, EVEN), 'h', 1, 0, { cmds: [], open: true })
    const hg = withHorse.pending?.groups.find((g) => g.g === 'horse')
    assert.ok(hg !== undefined && hg.men > 0)
    for (const c of ['flank', 'punch', 'pursue', 'guard'] as Cmd[]) assert.ok(hg.options.includes(c), c)
  })

  it('땅의 수는 그 땅에서만, 한 번 — 여울 막기 · 바위 · 성문 · 배 · 높은 곳', () => {
    const plain = side(100, HORSE)
    const all = [...groupOptions(plain, plain, 'front', new Set()), ...groupOptions(plain, plain, 'bows', new Set())]
    for (const c of ['ford', 'rocks', 'gate', 'ram', 'height'] as Cmd[]) assert.ok(!all.includes(c), `${c} 는 맨땅에 없다`)
    const ford = side(100, HORSE, false, { terrain: { ford: true, height: true } })
    assert.ok(groupOptions(ford, plain, 'front', new Set()).includes('ford'))
    assert.ok(!groupOptions(ford, plain, 'front', new Set()).includes('gate'))
    assert.ok(groupOptions(ford, plain, 'bows', new Set()).includes('height'))
    assert.ok(!groupOptions(ford, plain, 'front', new Set<Cmd>(['ford'])).includes('ford'), '한 번 쓰면 끝')
    // 시험 돌림 — 여울 막기를 쓴 다음 합에는 안 뜬다
    const me = side(100, HORSE, true, { terrain: { ford: true } })
    const t = fightRounds(me, side(100, SPEAR), 'f', 2, 0, { cmds: [{ front: 'ford' }], open: true })
    assert.equal(t.rounds[0]!.oa?.front, 'ford')
    if (t.pending !== undefined) assert.ok(!t.pending.groups.find((g) => g.g === 'front')!.options.includes('ford'))
  })

  it('앞줄의 세모 — 방진 > 돌격 > 길 트기 > 방진 (첫 합, 흔들리기 전)', () => {
    for (const [a, d] of [['hold', 'charge'], ['charge', 'open'], ['open', 'hold']] as Array<[Cmd, Cmd]>) {
      let n = 0
      for (let s = 0; s < 160; s++) {
        const r1 = fightRounds(side(100, EVEN, true), side(100, EVEN), `k${s}`, s, 0, { cmds: [{ front: a, bows: 'volley', lead: 'drum' }] })
        const rd = r1.rounds[0]!
        if (rd.od?.front !== d || rd.ev !== undefined) continue
        n++
        assert.equal(rd.beat, 'a', `${a} 가 ${d} 를 이긴다 (판 ${s})`)
      }
      assert.ok(n > 0, `${a} × ${d} 가 한 번은 나온다`)
    }
  })

  it('사로잡기는 날랜 무리와 호위를 견준다 — 28 대 570 은 거의 안 되고, 적이 흔들리고 다치면 잘 된다', () => {
    const me = side(28, EVEN, true)
    const foe = side(570, EVEN)
    const few = captureOdds(me, foe, 28, 0, 570, 1, false, false)
    assert.ok(few.p < 0.02, `28 대 570 — ${few.p}`)
    assert.equal(few.squad, 3)
    assert.ok(few.escort >= 150, `호위 ${few.escort}`)
    const many = captureOdds(side(570, EVEN, true), side(28, EVEN), 570, 0, 28, 1, false, false)
    assert.ok(many.p > 0.5, `570 대 28 — ${many.p}`)
    // 같은 수라도 적이 흔들리고(사기) 다쳤으면 오른다 · 기병이 호위하면 내린다
    const even = captureOdds(side(300, HORSE, true), side(300, EVEN), 300, 120, 300, 1, false, false)
    const shaken = captureOdds(side(300, HORSE, true), side(300, EVEN), 300, 120, 300, 0.6, false, false)
    const hurt = captureOdds(side(300, HORSE, true), side(300, EVEN), 300, 120, 300, 0.6, true, false)
    const guarded = captureOdds(side(300, HORSE, true), side(300, EVEN), 300, 120, 300, 1, false, true)
    assert.ok(even.p < shaken.p && shaken.p < hurt.p, `${even.p} < ${shaken.p} < ${hurt.p}`)
    assert.ok(guarded.p < even.p && guarded.escort > even.escort)
    // 기병은 날랜 무리를 키운다
    assert.ok(even.squad > captureOdds(side(300, EVEN, true), side(300, EVEN), 300, 0, 300, 1, false, false).squad)
    // 적장이 없으면 못 한다 · 겁 많은 장수는 먼저 달아난다
    const noHero = side(100, EVEN, false, { hero: null })
    assert.equal(captureChance(side(100, EVEN, true), noHero, 1, 0.5, 0.5, 0.8, false), 0)
    assert.ok(!optionsOf(side(100, EVEN, true), noHero, new Set(), false).includes('capture'))
    const c2 = captureChance(side(100, EVEN, true), side(100, EVEN), 1, 0.6, 1, 0.5, false)
    assert.ok(captureChance(side(100, EVEN, true), side(100, EVEN, false, { hero: { id: 'c', mu: 5, ryak: 5, coward: true } }), 1, 0.6, 1, 0.5, false) < c2)
  })

  it('28 명이 570 명의 장수를 노려도 백 판에 한두 판도 안 잡힌다 · 놓치면 날랜 무리를 잃는다', () => {
    let caught = 0
    for (let s = 0; s < 100; s++) {
      const r = fightRounds(side(28, { spear: 8, bow: 6, shield: 3, horse: 11 }, true), side(570, { spear: 190, bow: 190, shield: 190 }), `few${s}`, s, 0, { cmds: [{ lead: 'capture' }] })
      if (r.captured === 'd') caught++
      const a = r.rounds[0]!.acts?.find((x) => x.c === 'capture')
      assert.ok(a !== undefined && a.guard !== undefined && a.guard > a.n, '호위가 날랜 무리보다 크다')
    }
    assert.ok(caught <= 2, `잡힌 판 ${caught}`)
  })

  it('사로잡으면 판이 끝나고 대승 — 흔들어 놓고 노리면 된다', () => {
    let caught = 0
    for (let s = 0; s < 80; s++) {
      const cap: RoundOrder = { front: 'charge', horse: 'pursue', lead: 'capture' }
      const r = fightRounds(side(220, HORSE, true), side(100, EVEN), `cap${s}`, s, 0, { cmds: [{ front: 'charge', bows: 'volley', horse: 'flank' }, cap, cap, cap, cap] })
      if (r.captured === 'd') {
        caught++
        assert.equal(r.outcome, 'rout')
        assert.equal(r.endWhy, 'captured')
        assert.equal(r.rounds[r.rounds.length - 1]!.ev, 'capture-ok')
      }
    }
    assert.ok(caught > 10, `잡은 판 ${caught}`)
  })

  it('물러나면 손실이 적고 장수가 안 잡힌다', () => {
    const r = fightRounds(side(60, EVEN, true), side(100, EVEN), 'ret', 2, 0, { cmds: [{ lead: 'retreat' }] })
    assert.equal(r.outcome, 'lose')
    assert.equal(r.captured, null)
    assert.equal(r.endWhy, 'retreat')
    assert.ok(r.na > 1 - P.realm.tacRoundLoss)
  })

  it('해시계 — 마지막 때까지는 간다 · 거기서 두 쪽이 고른다 · 한 합 더면 그 너머로 · 무너지면 일찍 끝난다', () => {
    let long = 0
    let dusk = 0
    for (let s = 0; s < 120; s++) {
      const g = { grain: 1000 }
      const r = fightRounds(side(300, MIXES[s % 4]!, false, g), side(300, MIXES[(s + 1) % 4]!, false, g), `len${s}`, s, 0)
      assert.equal(r.clock.slots, P.realm.tacClock)
      assert.ok(r.rounds.length <= P.realm.tacRoundsMax)
      // 진을 쳐서 판세로 정해진 판은 마지막 때까지 갔고, 거기서 고른 것이 남는다
      if (r.endWhy === 'share' || r.endWhy === 'draw') {
        assert.ok(r.rounds.length >= r.clock.slots, `판 ${s} 합 ${r.rounds.length}`)
        const last = r.dusk[r.dusk.length - 1]
        // 많아도 tacRoundsMax — 거기 닿으면 더 묻지 않는다
        assert.ok(last !== undefined && ((last.a !== 'press' && last.d !== 'press') || r.rounds.length === P.realm.tacRoundsMax), `판 ${s} — 마지막 고름이 남는다`)
      }
      // 마지막 때 너머의 합은 누군가 밀어붙였다 — 해가 진 뒤라 어둠 속이다
      r.rounds.forEach((rd, i) => {
        assert.equal(rd.night === true, i >= r.clock.slots, `판 ${s} 합 ${i}`)
        if (i >= r.clock.slots) assert.ok(r.dusk.some((d) => d.at === i && (d.a === 'press' || d.d === 'press')))
      })
      if (r.dusk.length > 0) dusk++
      if (r.rounds.length > r.clock.slots) long++
    }
    assert.ok(dusk > 0, '해질녘까지 가는 판이 있다')
    assert.ok(long > 0, '밀어붙여 한 합 더 가는 판이 있다')
  })

  it('작은 싸움은 늦게 붙는다 — 때가 하나 준다', () => {
    assert.equal(slotsFor(50, 50), P.realm.tacClock - P.realm.tacClockSmall)
    assert.equal(slotsFor(300, 300), P.realm.tacClock)
  })

  it('밤 싸움 — 한밤~새벽은 어둠 속 · 날이 밝은 뒤 한 합 더는 낮', () => {
    const c = { clock: { night: true, edge: false, slots: 4 } }
    assert.deepEqual([0, 1, 2, 3, 4].map((i) => nightAt(c, i)), [true, true, true, true, false])
    assert.deepEqual([0, 1, 2, 3, 4].map((i) => nightAt({ clock: { night: false, edge: false, slots: 4 } }, i)), [false, false, false, false, true])
    const r = fightRounds(side(300, EVEN), side(300, EVEN), 'night', 3, 0, undefined, { night: true })
    assert.equal(r.clock.night, true)
    r.rounds.forEach((rd, i) => assert.equal(rd.night === true, i < r.clock.slots))
  })

  it('밤에는 화살이 덜 맞는다 · 불화살은 더 무섭다', () => {
    let day = 0
    let dark = 0
    let fireDay = 0
    let fireDark = 0
    const tl = (acts: RoundLog['acts'], f: (x: NonNullable<RoundLog['acts']>[number]) => boolean): number => (acts ?? []).filter(f).reduce((a, x) => a + (x.tl ?? 0), 0)
    for (let s = 0; s < 40; s++) {
      const t: Tactic = { cmds: [{ front: 'hold', bows: 'volley' }] }
      const d = fightRounds(side(100, BOW, true), side(100, SHIELD), `nb${s}`, s, 0, t)
      const n = fightRounds(side(100, BOW, true), side(100, SHIELD), `nb${s}`, s, 0, t, { night: true })
      day += tl(d.rounds[0]!.acts, (x) => x.s === 'a' && x.g === 'bows')
      dark += tl(n.rounds[0]!.acts, (x) => x.s === 'a' && x.g === 'bows')
      const f: Tactic = { cmds: [{ front: 'hold', bows: 'fire' }] }
      const fd = fightRounds(side(100, BOW, true, { specials: ['fire'] }), side(100, SHIELD), `nf${s}`, s, 0, f)
      const fn = fightRounds(side(100, BOW, true, { specials: ['fire'] }), side(100, SHIELD), `nf${s}`, s, 0, f, { night: true })
      fireDay += tl(fd.rounds[0]!.acts, (x) => x.c === 'fire' && x.s === 'a')
      fireDark += tl(fn.rounds[0]!.acts, (x) => x.c === 'fire' && x.s === 'a')
    }
    assert.ok(dark < day * 0.8, `화살비 낮 ${day} · 밤 ${dark}`)
    assert.ok(fireDark > fireDay * 1.15, `불화살 낮 ${fireDay} · 밤 ${fireDark}`)
  })

  it('먹힌 야습 — 첫 때에 치는 쪽이 세다', () => {
    let plain = 0
    let edge = 0
    for (let s = 0; s < 60; s++) {
      const t: Tactic = { cmds: [{ front: 'charge' }] }
      const a = fightRounds(side(100, EVEN, true), side(100, EVEN), `ne${s}`, s, 0, t, { night: true })
      const b = fightRounds(side(100, EVEN, true), side(100, EVEN), `ne${s}`, s, 0, t, { night: true, edge: true })
      plain += 1 - a.rounds[0]!.nd
      edge += 1 - b.rounds[0]!.nd
    }
    assert.ok(edge > plain * 1.05, `덤 없이 ${plain.toFixed(2)} · 덤 ${edge.toFixed(2)}`)
  })

  it('마지막 때 — 우리가 고른다: 진을 친다 · 한 합 더(곡식과 사기) · 물러난다 (판 기록의 dusk 로 다시 돌려도 같다)', () => {
    // 팽팽한 판을 찾아 — 우리가 끝까지 방진
    const hold: RoundOrder = { front: 'hold', bows: 'volley', lead: 'drum' }
    let found = 0
    for (let s = 0; s < 200 && found < 6; s++) {
      const me = side(300, EVEN, true, { grain: 500 })
      const foe = side(300, EVEN, false, { grain: 500 })
      const key = `dusk${s}`
      const cmds: RoundOrder[] = []
      let t = fightRounds(me, foe, key, s, 0, { cmds, open: true })
      for (let g = 0; g < 8 && t.pending !== undefined && t.pending.dusk === undefined; g++) {
        cmds.push(hold)
        t = fightRounds(me, foe, key, s, 0, { cmds, open: true })
      }
      const ask = t.pending?.dusk
      if (ask === undefined) continue
      found++
      const lastNa = t.rounds[P.realm.tacClock - 1]!.na // 묻는 판은 맡긴 셈으로 끝까지 돌았다 — 해질녘의 값
      assert.equal(t.pending!.round, P.realm.tacClock)
      assert.deepEqual([...ask.options], ['camp', 'press', 'retreat'])
      assert.equal(ask.grain, pressCost(100 * lastNa)) // EVEN 은 100명
      assert.ok(ask.hasGrain)
      // 진을 친다 — 적이 밀어붙이지 않으면 그 자리에서 판세로
      const camp = fightRounds(me, foe, key, s, 0, { cmds, dusk: ['camp'], open: true })
      if (camp.dusk[0]!.d !== 'press') {
        assert.equal(camp.rounds.length, P.realm.tacClock)
        assert.equal(camp.pending, undefined)
        assert.equal(camp.pressA, 0)
      }
      // 물러난다 — 시도다 (형 10-27). 빠져나가면 진다 · 조금 잃는다 · 장수는 안 잡힌다. 따라잡히면 크게 잃고 그 자리에 진을 친다
      assert.ok(ask.retreatP! >= P.realm.tacRetMin && ask.retreatP! <= P.realm.tacRetMax)
      const back = fightRounds(me, foe, key, s, 0, { cmds, dusk: ['retreat'], open: true })
      if (back.dusk[0]!.caught === 'a') {
        assert.equal(back.dusk[0]!.a, 'camp')
        assert.notEqual(back.endWhy, 'withdraw')
      } else {
        assert.equal(back.endWhy, 'withdraw')
        // 적도 함께 물러나면 비긴다 (둘 다 어둠을 틈탔다)
        const both = back.dusk[0]!.d === 'retreat'
        assert.ok(both ? back.outcome === 'draw' : back.outcome === 'lose' || back.outcome === 'routed', `s${s} ${back.outcome}`)
        assert.equal(back.captured, null)
        assert.ok(back.na < lastNa && back.na > lastNa - P.realm.tacRoundLoss)
      }
      // 한 합 더 — 곡식을 내고, 다음 합(밤)을 고르는 판이 열린다
      const go = fightRounds(me, foe, key, s, 0, { cmds, dusk: ['press'], open: true })
      assert.equal(go.dusk[0]!.a, 'press')
      if (go.dusk[0]!.d === 'retreat') continue // 적이 어둠을 틈타 물러났다 — 밀어붙일 판이 없다
      assert.equal(go.dusk[0]!.grain?.a, ask.grain)
      assert.equal(go.pressA, ask.grain)
      assert.equal(go.pending?.round, P.realm.tacClock)
      assert.equal(go.pending?.dusk, undefined)
      const end = fightRounds(me, foe, key, s, 0, { cmds: [...cmds, hold], dusk: ['press'] })
      assert.ok(end.rounds.length > P.realm.tacClock)
      assert.equal(end.rounds[P.realm.tacClock]!.night, true)
      // 판 기록 — 같은 고름이면 같은 판 (A1)
      assert.deepEqual(end, fightRounds(me, foe, key, s, 0, { cmds: [...cmds, hold], dusk: ['press'] }))
      // 옛 기록 — 마지막 때 너머의 명령이 있으면 밀어붙인 것으로 본다
      assert.equal(fightRounds(me, foe, key, s, 0, { cmds: [...cmds, hold] }).dusk[0]!.a, 'press')
    }
    assert.ok(found >= 3, `마지막 때까지 간 판 ${found}`)
  })

  it('한 합 더 — 곳간이 비면 굶은 채 싸워 사기가 더 꺾인다', () => {
    const hold: RoundOrder = { front: 'hold', bows: 'volley', lead: 'drum' }
    for (let s = 0; s < 200; s++) {
      const key = `hun${s}`
      const foe = side(300, EVEN, false)
      const cmds = [hold, hold, hold, hold]
      const full = fightRounds(side(300, EVEN, true, { grain: 500 }), foe, key, s, 0, { cmds, dusk: ['press'] })
      const empty = fightRounds(side(300, EVEN, true, { grain: 0 }), foe, key, s, 0, { cmds, dusk: ['press'] })
      if (full.dusk.length === 0) continue
      assert.equal(empty.pressA, 0)
      assert.equal(empty.dusk[0]!.hungry?.a, true)
      assert.ok(full.pressA > 0)
      // 묻는 판이 미리 알린다 — 곡식이 없으면 사기가 더 깎인다
      const askFull = fightRounds(side(300, EVEN, true, { grain: 500 }), foe, key, s, 0, { cmds, open: true }).pending?.dusk
      const askEmpty = fightRounds(side(300, EVEN, true, { grain: 0 }), foe, key, s, 0, { cmds, open: true }).pending?.dusk
      assert.ok(askFull !== undefined && askEmpty !== undefined)
      assert.equal(askFull.hasGrain, true)
      assert.equal(askEmpty.hasGrain, false)
      assert.ok(askEmpty.morale > askFull.morale, `곡식 ${askFull.morale} · 굶음 ${askEmpty.morale}`)
      return
    }
    assert.fail('마지막 때까지 간 판이 없다')
  })

  it('깃발 짐작은 밤 규칙을 탄다 · 무너질 판의 몫을 낸다', () => {
    const p = fightRounds(side(300, BOW, true), side(300, SHIELD), 'lk', 1, 0, { cmds: [], open: true }, { night: true }).pending!
    const q = fightRounds(side(300, BOW, true), side(300, SHIELD), 'lk', 1, 0, { cmds: [], open: true }).pending!
    const o: RoundOrder = { front: 'hold', bows: 'volley', lead: 'drum' }
    const dark = lookRound(p.look!, o)
    const day = lookRound(q.look!, o)
    assert.ok(dark.foe[1] < day.foe[1], `밤 ${dark.foe} · 낮 ${day.foe}`)
    assert.ok(dark.fall !== undefined && dark.fall >= 0 && dark.fall <= 1)
    assert.ok(dark.foeFall !== undefined && dark.foeFall >= 0 && dark.foeFall <= 1)
  })

  it('같은 판 같은 명령이면 같은 결과', () => {
    const t: Tactic = { cmds: [{ front: 'charge', bows: 'volley', horse: 'flank' }, 'hold', { lead: 'capture' }] }
    const x = fightRounds(side(120, HORSE, true), side(100, BOW), 'same', 7, 3, t)
    const y = fightRounds(side(120, HORSE, true), side(100, BOW), 'same', 7, 3, t)
    assert.deepEqual(x, y)
  })

  it('시험 돌림 — 무리마다 고를 것 · 장수의 것 · 적 무리 · 사로잡기(무리와 호위) · 낌새를 낸다', () => {
    const a = side(100, HORSE, true)
    const d = side(100, BOW)
    const t0 = fightRounds(a, d, 'open', 1, 0, { cmds: [], open: true })
    const p = t0.pending
    assert.ok(p !== undefined && p.round === 0 && p.weAtk)
    assert.deepEqual(p.groups.map((g) => g.g), ['front', 'bows', 'horse'])
    assert.ok(p.groups.find((g) => g.g === 'front')!.options.includes('charge'))
    assert.ok(p.lead.includes('capture') && p.lead.includes('retreat') && p.lead.includes('drum'))
    assert.ok((p.foe.bows ?? 0) > 0 && p.foe.horse === undefined)
    assert.ok(p.squad > 0 && p.escort > 0)
    assert.ok(p.hint === null || ['charge', 'hold', 'open'].includes(p.hint))
    const t1 = fightRounds(a, d, 'open', 1, 0, { cmds: [{ front: 'charge' }], open: true })
    assert.equal(t1.rounds[0]!.oa?.front, 'charge')
    if (t1.pending !== undefined) assert.equal(t1.pending.round, 1)
    const td = fightRounds(side(100, SPEAR), side(100, BOW, true), 'open', 1, 0, { cmds: [], open: true })
    assert.equal(td.pending?.weAtk, false)
  })

  it('잘 읽으면 열세를 뒤집고, 한 수만 되풀이하면 우세에도 진다 (많은 판의 평균)', () => {
    let readWins = 0
    let autoWins = 0
    let sameWins = 0
    let autoStrong = 0
    let n = 0
    for (const ma of MIXES) for (const md of MIXES) for (let s = 0; s < 20; s++) {
      n++
      const foe = side(100, md)
      readWins += won(play(side(80, ma, true), foe, `w${s}`, s, reader)) ? 1 : 0
      autoWins += won(fightRounds(side(80, ma), foe, `w${s}`, s, 0).outcome) ? 1 : 0
      // 우세(1.25) — 늘 돌격만 (적이 읽고 방진으로 받는다)
      sameWins += won(play(side(125, ma, true), foe, `b${s}`, s, () => ({ front: 'charge', bows: 'volley', horse: 'punch', lead: 'drum' }))) ? 1 : 0
      autoStrong += won(fightRounds(side(125, ma), foe, `b${s}`, s, 0).outcome) ? 1 : 0
    }
    assert.ok(readWins > autoWins * 1.5, `열세 — 읽음 ${readWins} · 맡김 ${autoWins}`)
    assert.ok(readWins / n > 0.5, `열세에서 읽으면 반 넘게 이긴다 ${readWins / n}`)
    assert.ok(sameWins < autoStrong * 0.75, `우세 — 돌격만 ${sameWins} · 맡김 ${autoStrong}`)
    assert.ok(sameWins / n < 0.5, `우세여도 돌격만 하면 반도 못 이긴다 ${sameWins / n}`)
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
    const done: Record<string, Tactic> = {}
    let cur: { key: string; cmds: (Cmd | RoundOrder)[] } | null = null
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
      cur.cmds.push(reader(p))
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

// 형 2026-10-20: "장수스킬 장수가 있건없건 똑같나?? 싸우는 장수의 특별한 액티브 스킬이 있다면 아이콘과 함께 그거라는걸 알게 해줘야함"
describe('장수의 비기', () => {
  const withArt = (art: NonNullable<NonNullable<Side['hero']>['art']>, player = true): Side =>
    side(100, EVEN, player, { hero: { id: player ? 'me' : 'foe', mu: 5, ryak: 5, coward: false, art } })

  it('비기가 있는 장수만 장수 깃발에 「비기」가 뜨고, 한 판에 한 번', () => {
    assert.ok(optionsOf(withArt('vanguard'), side(100, EVEN), new Set(), false).includes('art'))
    assert.ok(!optionsOf(side(100, EVEN, true), side(100, EVEN), new Set(), false).includes('art'), '비기 없는 장수')
    assert.ok(!leadOptions(withArt('vanguard'), side(100, EVEN), new Set(), false, new Set(['me'])).includes('art'), '쓴 뒤엔 없다 (장수마다 한 번)')
    assert.ok(!optionsOf(withArt('snipe'), side(100, EVEN, false, { hero: null }), new Set(), false).includes('art'), '쏠 적장이 없으면 명궁의 한 발도 없다')
  })

  it('비기를 쓰면 그 합 기록에 그 비기가 남고 · 전장 화면이 장수의 비기를 안다', () => {
    const t: Tactic = { cmds: [{ front: 'charge', lead: 'art' }], open: true }
    const res = fightRounds(withArt('shout'), side(100, EVEN), 'art-1', 7, 0, t)
    assert.ok(res.rounds[0]!.acts?.some((a) => a.c === 'art' && a.art === 'shout'))
    assert.equal(res.pending?.art, 'shout')
    assert.ok(!res.pending!.lead.includes('art'), '두 번째 합엔 다시 못 쓴다')
  })

  it('선봉에 선다 — 같은 판이면 우리 쪽이 덜 잃는다 · 버텨라 — 그 합에 덜 잃는다', () => {
    const run = (lead: Cmd, art: NonNullable<NonNullable<Side['hero']>['art']>): number => {
      let lost = 0
      for (let k = 0; k < 30; k++) {
        const r = fightRounds(withArt(art), side(100, EVEN), `art-v-${k}`, k + 1, 0, { cmds: [{ front: 'charge', bows: 'volley', lead }] })
        lost += 1 - r.rounds[0]!.na
      }
      return lost
    }
    assert.ok(run('art', 'vanguard') < run('drum', 'vanguard'), '선봉')
    assert.ok(run('art', 'stand') < run('drum', 'stand'), '버텨라')
  })

  it('명궁의 한 발 — 적장이 다쳐 사로잡기가 쉬워진다', () => {
    const t: Tactic = { cmds: [{ lead: 'art' }], open: true }
    const shot = fightRounds(withArt('snipe'), side(100, EVEN), 'art-s', 3, 0, t)
    const plain = fightRounds(side(100, EVEN, true), side(100, EVEN), 'art-s', 3, 0, { cmds: [{ lead: 'drum' }], open: true })
    assert.ok((shot.pending?.capture ?? 0) > (plain.pending?.capture ?? 0))
  })
})

describe('호궤 — 곳간의 곡식을 풀어 사기를 (형 10-25: "군량 소모해서 사기 회복시키는 건 어때?")', () => {
  it('곳간에 곡식이 있을 때만(Side.feast) 장수의 명령에 뜨고 · 한 판에 한 번 · 했는지가 결과에 남는다', () => {
    const plain = fightRounds(side(80, EVEN, true), side(100, EVEN), 'fe-o', 1, 0, { cmds: [], open: true })
    assert.ok(!(plain.pending?.lead ?? []).includes('feast'))
    const fed = side(80, EVEN, true, { feast: feastCost(80) })
    const first = fightRounds(fed, side(100, EVEN), 'fe-o', 1, 0, { cmds: [], open: true })
    assert.ok(first.pending?.lead.includes('feast'))
    assert.equal(first.pending?.feast, feastCost(80))
    const after = fightRounds(fed, side(100, EVEN), 'fe-o', 1, 0, { cmds: [{ lead: 'feast' }], open: true })
    if (after.pending !== undefined) assert.ok(!after.pending.lead.includes('feast'), '두 번은 못 한다')
    assert.equal(after.fedA, true)
    assert.equal(plain.fedA, false)
  })

  it('밀린 합에 북보다 사기가 크게 오른다 (처음 사기를 넘지는 않는다)', () => {
    let more = 0
    for (let k = 0; k < 20; k++) {
      const me = side(70, EVEN, true, { feast: 10 })
      const drum = fightRounds(me, side(100, EVEN), `fe-${k}`, k + 1, 0, { cmds: [{ front: 'hold', bows: 'volley', lead: 'drum' }] }).rounds[0]!
      const feast = fightRounds(me, side(100, EVEN), `fe-${k}`, k + 1, 0, { cmds: [{ front: 'hold', bows: 'volley', lead: 'feast' }] }).rounds[0]!
      assert.ok(feast.ma >= drum.ma - 1e-9 && feast.ma <= Math.max(1, drum.ma) + 1e-9) // 호궤로는 처음 사기까지만 (이긴 합의 밀림은 따로)
      if (feast.ma > drum.ma + 1e-9) more++
    }
    assert.ok(more > 0)
  })
})

// 형 10-25: "장수 3 분대를 동시에 보내면 장수가 한 명만 나오는데 · 비기를 하나밖에 못 쓰잖아 · 한 명 잡히면 바로 지는 건 말이 안 되는데"
describe('총대장과 부장', () => {
  const H = (id: string, mu = 5, art?: NonNullable<NonNullable<Side['hero']>['art']>): NonNullable<Side['hero']> => ({ id, mu, ryak: 5, coward: false, ...(art !== undefined ? { art } : {}) })
  // 적장들은 무예가 낮아 겨루기를 걸지 않는다 — 사로잡기만 본다
  const three = (over: Partial<Side> = {}): Side => side(100, EVEN, false, { hero: H('f-chief', 3), aides: [H('f-aide1', 3), H('f-aide2', 2)], ...over })

  it('비기는 장수마다 한 번 — 총대장이 썼어도 부장의 비기가 남는다', () => {
    const me = side(100, EVEN, true, { hero: H('me', 5, 'shout'), aides: [H('me2', 5, 'vanguard')] })
    assert.ok(leadOptions(me, side(100, EVEN), new Set(), false, new Set(['me'])).includes('art'))
    assert.ok(!leadOptions(me, side(100, EVEN), new Set(), false, new Set(['me', 'me2'])).includes('art'))
    const res = fightRounds(me, side(100, EVEN), 'gen-art', 3, 0, { cmds: [{ lead: 'art' }, { lead: 'art' }], open: true })
    const used = res.rounds.slice(0, 2).flatMap((r) => (r.acts ?? []).filter((a) => a.c === 'art' && a.s === 'a').map((a) => a.hero))
    assert.deepEqual(used, ['me', 'me2'])
  })

  it('부장을 사로잡으면 그 장수만 잡히고 싸움은 이어진다', () => {
    const me = side(100, EVEN, true, { capture: 'sure' })
    const res = fightRounds(me, three(), 'gen-cap-aide', 5, 0, { cmds: [{ lead: 'capture', target: 'f-aide1' }], open: true })
    assert.deepEqual(res.taken[0], { side: 'd', hero: 'f-aide1' })
    assert.ok(res.rounds.length > 1, '첫 합에 끝나지 않는다')
    assert.equal(res.rounds[0]!.lostHero?.hero, 'f-aide1')
    assert.equal(res.rounds[0]!.lostHero?.chief, undefined, '총대장은 그대로')
    assert.ok(res.pending !== undefined, '다음 합을 고른다')
    assert.ok(!(res.pending.foeHeroes ?? []).some((h) => h.id === 'f-aide1'))
  })

  it('총대장을 사로잡으면 맨 앞 부장이 지휘를 넘겨받고, 그 쪽은 다음 합에 북과 물러나기뿐', () => {
    const me = side(100, EVEN, true, { capture: 'sure' })
    const res = fightRounds(me, three(), 'gen-cap-chief', 5, 0, { cmds: [{ lead: 'capture' }] })
    assert.equal(res.taken[0]?.hero, 'f-chief')
    assert.equal(res.rounds[0]!.lostHero?.chief, 'f-aide1')
    const r1 = res.rounds[1]
    if (r1 !== undefined) assert.ok(r1.od?.lead === 'drum' || r1.od?.lead === 'retreat', `흔들린 합 — ${r1.od?.lead}`)
    // 뒤집어 — 우리 총대장이 잡히면 우리가 흔들린다
    const us = side(100, EVEN, true, { hero: H('me'), aides: [H('me2')] })
    const foe = side(100, EVEN, false, { capture: 'sure' })
    const t = fightRounds(foe, us, 'gen-cap-us', 9, 0, { cmds: [{ front: 'hold', bows: 'volley', lead: 'drum' }], open: true })
    assert.equal(t.rounds[0]!.lostHero?.hero, 'me', '첫 합에 우리 총대장이 잡혔다')
    assert.equal(t.pending?.shaken, true)
    assert.deepEqual([...t.pending!.lead].sort(), ['drum', 'retreat'])
  })

  it('홀로 선 장수가 잡히면 예전처럼 그 판이 끝난다', () => {
    const res = fightRounds(side(100, EVEN, true, { capture: 'sure' }), side(100, EVEN), 'gen-solo', 5, 0, { cmds: [{ lead: 'capture' }] })
    assert.equal(res.captured, 'd')
    assert.equal(res.rounds.length, 1)
  })

  it('같은 판이면 같은 결과 (A1)', () => {
    const go = (): unknown => fightRounds(side(120, EVEN, true, { hero: H('me', 6, 'rite'), aides: [H('me2', 7, 'shout')] }), three(), 'gen-det', 11, 0, { cmds: [{ lead: 'duel' }, { lead: 'art' }] })
    assert.deepEqual(go(), go())
  })
})
