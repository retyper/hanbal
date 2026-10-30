/**
 * 장수의 기억 · 나라의 전례 장부 (docs/realm/MEMORY.md §3 · src/realm/memory.ts)
 *
 *  - 같은 씨앗 · 같은 명령이면 같은 기억 (A1)
 *  - 기억은 memMax 줄까지 · keep 은 memKeepMax 까지 지킨다 · 장부는 lessonMax 줄까지
 *  - 싸움마다 이끈 장수에게 그 싸움이 적힌다 · 없는 나라·쓰러진 장수에게는 안 적힌다
 *  - 나눠 떠남: 남긴 몫 · 그 사이 도읍이 털렸나
 *  - 옛 저장은 빈 기억으로 시작하고, 깨진 칸은 걷힌다
 *  - 묻는 손(lastBattleVs · bestRouteVs · splitLesson · wasCapturedBy · plotBeforeWin)이 꾸민 판에서 맞는 값을 낸다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { aiOrders, decide } from '../../src/realm/ai.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import {
  bestRouteVs, foeAlliesWhenStruck, lastBattleVs, noteMemory, plotBeforeWin, remember, splitLesson, wasCapturedBy, worstRouteVs,
} from '../../src/realm/memory.ts'
import { migrate } from '../../src/realm/migrate.ts'
import { advance, newArmyId, otherEnd } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Lesson, Order, Realm, ReportLine } from '../../src/realm/types.ts'

type Battle = Extract<ReportLine, { kind: 'battle' }>

function run(seed: number, seasons: number): { r: Realm; reports: ReportLine[][] } {
  let r = byeonhanMini(seed)
  const reports: ReportLine[][] = []
  for (let s = 0; s < seasons && !r.outcome; s++) {
    const res = advance(r, [...aiOrders(r), ...decide(r, r.player, 'planner')])
    reports.push([...res.report.lines])
    r = res.next
  }
  return { r, reports }
}

const memOf = (r: Realm): string => JSON.stringify([Object.keys(r.heroes).sort().map((k) => [k, r.heroes[k]!.mem ?? null]), r.lessons ?? null])

/** 꾸민 싸움 줄 — 필요한 칸만 */
function battle(over: Partial<Battle> & Pick<Battle, 'node' | 'defender' | 'atkFaction' | 'outcome'>): Battle {
  return {
    kind: 'battle', attacker: 'x', allies: [], pincer: false, ambush: 'none', p: 0.5, captured: null, killed: null, militia: 0, ...over,
  } as Battle
}

describe('장수의 기억', () => {
  it('같은 씨앗 · 같은 명령이면 기억과 장부가 같다', () => {
    const a = run(3, 24)
    const b = run(3, 24)
    assert.equal(memOf(a.r), memOf(b.r))
    assert.ok(Object.values(a.r.heroes).some((h) => (h.mem?.length ?? 0) > 0), '24계절이면 누군가는 기억이 있다')
    assert.ok(Object.keys(a.r.lessons ?? {}).length > 0, '장부도 적힌다')
  })

  it('싸움을 이끈 장수에게 그 싸움이 적힌다 (고을 · 상대 나라 · 결과)', () => {
    let r = byeonhanMini(5)
    let checked = 0
    for (let s = 0; s < 30 && !r.outcome; s++) {
      const res = advance(r, [...aiOrders(r), ...decide(r, r.player, 'planner')])
      for (const l of res.report.lines) {
        if (l.kind !== 'battle' || l.pending !== undefined || l.start === undefined) continue
        const lead = l.start.heroes[0]
        const h = lead !== null ? res.next.heroes[lead] : undefined
        if (h === undefined || h.status === 'dead') continue
        // 친 쪽 기록만 (on 없음) — 같은 계절 같은 고을에서 쳐서 이긴 뒤 반격을 막다 질 수도 있다
        const m = (h.mem ?? []).find((x) => x.s === res.report.season && x.k === 'battle' && x.at === l.node && x.on === undefined && x.foe === l.defender && x.how === (l.field === true ? 'field' : l.approach))
        assert.ok(m !== undefined, `${lead} 의 ${l.node} 싸움`)
        assert.equal(m.foe, l.defender)
        const won = l.outcome === 'rout' || l.outcome === 'win'
        const lost = l.outcome === 'lose' || l.outcome === 'routed'
        assert.equal(m.res, won ? 'won' : lost ? 'lost' : 'draw')
        checked++
      }
      r = res.next
    }
    assert.ok(checked > 0, '싸움이 하나는 있었다')
  })

  it(`기억은 ${P.realm.memMax}줄까지 · keep 은 ${P.realm.memKeepMax}줄까지 지킨다`, () => {
    const r = byeonhanMini(1)
    remember(r, 'chief', { s: 0, k: 'captured', foe: 'guya', keep: true })
    for (let i = 1; i <= 40; i++) remember(r, 'chief', { s: i, k: 'battle', at: 'guya-vil', foe: 'guya', how: 'road', res: 'won' })
    const mem = r.heroes['chief']!.mem!
    assert.equal(mem.length, P.realm.memMax)
    assert.equal(mem[0]!.k, 'captured', '크게 남을 일은 안 지워진다')
    assert.equal(mem[mem.length - 1]!.s, 40, '최근 것이 남는다')
    for (let i = 0; i < 10; i++) remember(r, 'chief', { s: 50 + i, k: 'freed', foe: 'guya', how: 'peace', keep: true })
    assert.equal(mem.length, P.realm.memMax)
    assert.ok(mem.filter((m) => m.keep === true).length <= P.realm.memKeepMax)
  })

  it('같은 계절 같은 일은 한 번 · 없는 나라 · 쓰러진 장수에게는 안 적는다', () => {
    const r = byeonhanMini(1)
    const m = { s: 3, k: 'battle' as const, at: 'guya-vil', foe: 'guya', res: 'won' as const }
    remember(r, 'chief', m)
    remember(r, 'chief', m)
    assert.equal(r.heroes['chief']!.mem!.length, 1)
    r.heroes['us-1']!.status = 'dead'
    remember(r, 'us-1', m)
    assert.equal(r.heroes['us-1']!.mem, undefined)
    r.heroes['guya-1']!.faction = 'gone'
    remember(r, 'guya-1', m)
    assert.equal(r.heroes['guya-1']!.mem, undefined)
  })

  it(`장부는 상대 나라마다 ${P.realm.lessonMax}줄까지`, () => {
    const r = byeonhanMini(1)
    for (let s = 0; s < 20; s++) {
      r.season = s
      noteMemory(r, [battle({ node: 'guya-vil', defender: 'guya', atkFaction: 'us', outcome: 'win', approach: 'road', start: { men: [1, 1], morale: [1, 1], heroes: ['chief', 'guya-1'] } })], [], [])
    }
    assert.equal(r.lessons!['us']!['guya']!.length, P.realm.lessonMax)
    assert.equal(r.lessons!['guya']!['us']!.length, P.realm.lessonMax)
    assert.equal(r.lessons!['us']!['guya']!.at(-1)!.s, 19)
  })

  it('싸움 줄에서: 양쪽 장수 · 사로잡힘 · 겨루기 · 지킨 쪽은 on', () => {
    const r = byeonhanMini(1)
    r.season = 6
    noteMemory(r, [battle({
      node: 'guya-cap', defender: 'guya', atkFaction: 'us', outcome: 'rout', approach: 'night', captured: 'guya-1',
      start: { men: [1, 1], morale: [1, 1], heroes: ['chief', 'guya-1'], aides: [['us-1'], ['guya-2']] },
      rounds: [{ a: 'charge', d: 'hold', beat: 'a', push: 0.5, na: 1, nd: 1, ma: 1, md: 1, acts: [{ s: 'a', g: 'lead', c: 'duel', n: 1, res: 'won', hero: 'us-1' }] }],
    })], [], [])
    const chief = r.heroes['chief']!.mem!
    assert.deepEqual(chief[0], { s: 6, k: 'battle', at: 'guya-cap', foe: 'guya', who: 'guya-1', how: 'night', res: 'won', keep: true })
    const g2 = r.heroes['guya-2']!.mem!.find((m) => m.k === 'battle')!
    assert.equal(g2.res, 'lost')
    assert.equal(g2.on, 1)
    assert.equal(g2.who, 'chief')
    const cap = r.heroes['guya-1']!.mem!.find((m) => m.k === 'captured')!
    assert.equal(cap.foe, 'us')
    assert.equal(cap.at, 'guya-cap')
    assert.equal(cap.who, 'chief')
    const duel = r.heroes['us-1']!.mem!.find((m) => m.k === 'duel')!
    assert.equal(duel.res, 'won')
    // 받은 쪽은 무예가 가장 높은 이
    const champ = ['guya-1', 'guya-2'].sort((a, b) => r.heroes[b]!.mu - r.heroes[a]!.mu || (a < b ? -1 : 1))[0]!
    assert.equal(duel.who, champ)
    assert.equal(r.heroes[champ]!.mem!.find((m) => m.k === 'duel')!.res, 'lost')
  })

  it('나눠 떠남: 군대를 떼어 치러 가면 남긴 몫이 적히고, 그 사이 떠난 고을·도읍을 잃으면 털림', () => {
    const r = byeonhanMini(1)
    const id = newArmyId(r, 'us')
    r.armies['a-us']!.at = 'our-east'
    const edge = Object.values(r.edges).find((e) => {
      const to = otherEnd(e, 'our-east')
      return to !== null && r.nodes[to]?.owner !== null && r.nodes[to]?.owner !== 'us' && e.kind !== 'sea'
    })
    assert.ok(edge !== undefined, '남의 땅으로 가는 길')
    const to = otherEnd(edge, 'our-east')!
    const foe = r.nodes[to]!.owner!
    r.relations[[foe, 'us'].sort().join('|')] = { state: 'war', until: null }
    const orders: Order[] = [
      { kind: 'split', army: 'a-us', id, take: { spear: 20 * 4, bow: 10 * 4 }, hero: true },
      { kind: 'march', army: id, edge: edge.id, ambush: false, approach: 'road' },
    ]
    const { next } = advance(r, orders)
    const sp = next.heroes['chief']!.mem?.find((m) => m.k === 'split')
    assert.ok(sp !== undefined, '별동대를 이끈 장수가 기억한다')
    assert.equal(sp.at, 'our-east')
    assert.equal(sp.foe, foe)
    assert.equal(sp.n, 75, '480 가운데 360 을 남겼다')
    const ls = splitLesson(next, 'us')
    assert.ok(ls !== null)
    assert.equal(ls.keep, 75)
    assert.equal(ls.at, 'our-east')
    assert.equal(ls.raid, false)
    // 다음 계절 도읍을 잃었다 — 지켜보는 떠남에 털림이 붙는다
    noteMemory(next, [{ kind: 'take', faction: 'guya', node: 'our-cap' }], [], [])
    assert.equal(splitLesson(next, 'us')!.raid, true)
    assert.equal(next.heroes['chief']!.mem!.find((m) => m.k === 'split')!.res, 'fail')
  })

  it('공작 · 풀려남 · 회유 · 사신으로 갔다 붙잡힘', () => {
    const r = byeonhanMini(1)
    r.season = 4
    r.heroes['guya-1']!.status = 'captive'
    r.heroes['guya-1']!.captor = 'us'
    const lines: ReportLine[] = [
      { kind: 'plot', faction: 'us', op: 'assassin', target: 'guya', hero: 'guya-2', agent: 'us-1', ok: true, caught: true, exposed: false, result: 'wound' },
      { kind: 'plot', faction: 'us', op: 'burn', target: 'guya', ok: true, caught: false },
      { kind: 'persuade', hero: 'guya-1', faction: 'us', step: 'talk', by: 'chief', d: 1, reacts: ['sway', 'rage'], broke: false },
      { kind: 'envoyHeld', from: 'anya', to: 'miri', hero: 'anya-1' },
      { kind: 'freed', hero: 'miri-ruler', faction: 'miri', from: 'goja', why: 'peace' },
    ]
    noteMemory(r, lines, [{ kind: 'persuade', hero: 'guya-1', by: 'chief', talk: ['soothe', 'fear'] }], [])
    assert.deepEqual(r.heroes['us-1']!.mem![0], { s: 4, k: 'plot', foe: 'guya', how: 'assassin', res: 'ok', who: 'guya-2' })
    const hit = r.heroes['guya-2']!.mem![0]!
    assert.equal(hit.on, 1)
    assert.equal(hit.foe, undefined, '누가 보냈는지 드러나지 않았다')
    const woo = r.heroes['guya-1']!.mem!.find((m) => m.k === 'woo')!
    assert.equal(woo.how, 'soothe+fear')
    assert.equal(woo.res, 'fail', '노여움')
    assert.equal(woo.who, 'chief')
    assert.equal(r.heroes['chief']!.mem!.find((m) => m.k === 'woo')!.who, 'guya-1')
    assert.deepEqual(wasCapturedBy(r, 'anya-1', 'miri'), { s: 4, how: 'envoy' })
    assert.equal(r.heroes['miri-ruler']!.mem![0]!.how, 'peace')
    // 장부 — 먹힌 공작 둘 (드러나지 않아 당한 나라 장부엔 없다)
    assert.equal(r.lessons!['us']!['guya']!.filter((l) => l.k === 'p').length, 2)
    assert.equal(r.lessons!['guya']?.['us'], undefined)
    // 같은 계절 싸움 — 공작 뒤의 싸움
    noteMemory(r, [battle({ node: 'guya-vil', defender: 'guya', atkFaction: 'us', outcome: 'win', approach: 'road' })], [], [])
    assert.equal(lastBattleVs(r, { faction: 'us' }, 'guya')!.plot, true)
  })
})

describe('묻는 손 (꾸민 판)', () => {
  const book = (xs: Lesson[]): Realm => {
    const r = byeonhanMini(1)
    r.season = 20
    r.lessons = { us: { guya: xs } }
    return r
  }

  it('lastBattleVs — 장수 · 나라', () => {
    const r = book([
      { s: 3, k: 'b', at: 'guya-vil', how: 'night', res: 'lost' },
      { s: 7, k: 'b', at: 'guya-cap', how: 'road', res: 'won', plot: 1, ally: 2 },
      { s: 8, k: 'p', how: 'burn', res: 'ok' },
    ])
    assert.deepEqual(lastBattleVs(r, { faction: 'us' }, 'guya'), { s: 7, at: 'guya-cap', how: 'road', res: 'won', on: false, plot: true })
    assert.equal(lastBattleVs(r, { faction: 'us' }, 'anya'), null)
    r.heroes['chief']!.mem = [{ s: 2, k: 'battle', at: 'guya-vil', foe: 'guya', how: 'ford', res: 'lost', on: 1 }, { s: 5, k: 'battle', at: 'anya-cap', foe: 'anya', res: 'won' }]
    assert.deepEqual(lastBattleVs(r, { hero: 'chief' }, 'guya'), { s: 2, at: 'guya-vil', how: 'ford', res: 'lost', on: true, plot: false })
    assert.equal(foeAlliesWhenStruck(r, 'us', 'guya'), 2)
  })

  it('bestRouteVs · worstRouteVs — 이긴 길과 진 길 (지킨 싸움 · 들판은 뺀다)', () => {
    const r = book([
      { s: 1, k: 'b', how: 'night', res: 'lost' },
      { s: 2, k: 'b', how: 'night', res: 'lost' },
      { s: 3, k: 'b', how: 'road', res: 'won' },
      { s: 4, k: 'b', how: 'ford', res: 'won' },
      { s: 5, k: 'b', how: 'road', res: 'won' },
      { s: 6, k: 'b', how: 'cliff', res: 'won', on: 1 },
      { s: 7, k: 'b', how: 'field', res: 'won' },
    ])
    assert.deepEqual(bestRouteVs(r, 'us', 'guya'), { how: 'road', won: 2, lost: 0 })
    assert.deepEqual(worstRouteVs(r, 'us', 'guya'), { how: 'night', won: 0, lost: 2 })
    assert.equal(bestRouteVs(r, 'us', 'anya'), null)
    assert.equal(bestRouteVs(book([{ s: 1, k: 'b', how: 'night', res: 'lost' }]), 'us', 'guya'), null)
  })

  it('splitLesson — 가장 최근의 떠남', () => {
    const r = book([
      { s: 4, k: 's', at: 'our-cap', n: 0, raid: 1, res: 'won' },
      { s: 9, k: 's', at: 'our-cap', n: 30, res: 'lost' },
    ])
    r.lessons!['us']!['anya'] = [{ s: 6, k: 's', at: 'our-north', n: 50 }]
    assert.deepEqual(splitLesson(r, 'us'), { s: 9, foe: 'guya', at: 'our-cap', keep: 30, raid: false, res: 'lost' })
    assert.equal(splitLesson(r, 'anya'), null)
  })

  it('plotBeforeWin — 공작 뒤의 싸움과 공작 없이 친 싸움', () => {
    const r = book([
      { s: 1, k: 'b', how: 'road', res: 'lost' },
      { s: 3, k: 'p', how: 'burn', res: 'ok' },
      { s: 3, k: 'b', how: 'road', res: 'won', plot: 1 },
      { s: 5, k: 'p', how: 'rumor', res: 'fail' },
      { s: 6, k: 'b', how: 'road', res: 'won' },
    ])
    assert.deepEqual(plotBeforeWin(r, 'us', 'guya'), { won: 1, lost: 0, bareWon: 1, bareLost: 1, op: 'burn' })
    assert.equal(plotBeforeWin(r, 'us', 'anya'), null)
  })

  it('wasCapturedBy — 그 나라에 사로잡힌 마지막 일', () => {
    const r = book([])
    r.heroes['chief']!.mem = [
      { s: 2, k: 'captured', at: 'guya-vil', foe: 'guya', who: 'guya-1', keep: true },
      { s: 5, k: 'freed', foe: 'guya', how: 'peace', keep: true },
      { s: 9, k: 'captured', foe: 'anya', keep: true },
    ]
    assert.deepEqual(wasCapturedBy(r, 'chief', 'guya'), { s: 2, at: 'guya-vil', who: 'guya-1' })
    assert.equal(wasCapturedBy(r, 'chief', 'miri'), null)
  })
})

describe('옛 저장', () => {
  it('기억이 없던 판(80eb366)은 빈 기억으로 시작해 계절을 넘기며 쌓는다', () => {
    let r = JSON.parse(readFileSync(new URL('./fixtures/realm-80eb366.json', import.meta.url), 'utf8')) as Realm
    assert.ok(Object.values(r.heroes).every((h) => h.mem === undefined) && r.lessons === undefined)
    for (let s = 0; s < 12 && !r.outcome; s++) r = JSON.parse(JSON.stringify(advance(r, [...aiOrders(r), ...decide(r, r.player, 'planner')]).next)) as Realm
    for (const h of Object.values(r.heroes)) assert.ok(h.mem === undefined || (Array.isArray(h.mem) && h.mem.length <= P.realm.memMax))
  })

  it('깨진 기억 칸은 걷고, 넘치는 줄은 최근 것만', () => {
    const r = byeonhanMini(1)
    ;(r.heroes['chief'] as unknown as { mem: unknown }).mem = 'broken'
    r.heroes['us-1']!.mem = Array.from({ length: 30 }, (_, i) => ({ s: i, k: 'battle' as const, res: 'won' as const }))
    ;(r as unknown as { lessons: unknown }).lessons = 7
    migrate(r)
    assert.equal(r.heroes['chief']!.mem, undefined)
    assert.equal(r.heroes['us-1']!.mem!.length, P.realm.memMax)
    assert.equal(r.heroes['us-1']!.mem![0]!.s, 30 - P.realm.memMax)
    assert.equal(r.lessons, undefined)
  })
})
