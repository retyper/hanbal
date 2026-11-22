/**
 * 「다음 달」 지도 연출의 차례 (src/ui/realm/turnplay.ts · 형 11-22 "본게임이 너무 정적") — 판을 읽기만 하는 셈만 본다.
 *  - 길 위 자리 ↔ 고을 자리 사이의 걸음이 길을 따라 이어진다 (앞으로 · 되돌아 · 거꾸로)
 *  - 걸은 군대 · 친 군대(물러난 길) · 흩어진 군대 · 안 보이는 적은 빠진다
 *  - 박자는 가장 긴 시간을 넘지 않고, 아무 일 없는 달은 짧은 쉼
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { pathOf, planTurn, timeline, type TpGeo, type TpInput, type TurnPlan } from '../../src/ui/realm/turnplay.ts'
import { P } from '../../src/tune/params.ts'
import type { Army, Realm, ReportLine } from '../../src/realm/types.ts'

const POS: Record<string, readonly [number, number]> = { A: [0.1, 0.1], B: [0.5, 0.1], C: [0.5, 0.5], D: [0.9, 0.9] }
const ROADS: Record<string, ReadonlyArray<readonly [number, number]>> = { 'A|B': [[0.1, 0.1], [0.3, 0.15], [0.5, 0.1]], 'B|C': [[0.5, 0.1], [0.5, 0.5]] }
const geo: TpGeo = {
  pos: (id) => POS[id],
  route: (a, b) => (ROADS[`${a}|${b}`] ?? (ROADS[`${b}|${a}`] !== undefined ? [...ROADS[`${b}|${a}`]!].reverse() : null)),
}
const close = (p: readonly number[], q: readonly number[]): boolean => Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!) < 1e-6

const army = (id: string, faction: string, at: string, march: Army['march'] = null): Army => ({ id, faction, hero: null, mix: { spear: 100 }, equip: 'none', morale: 1, at, march } as unknown as Army)
const realmOf = (armies: Army[], owners: Record<string, string | null> = {}): Realm => ({
  armies: Object.fromEntries(armies.map((a) => [a.id, a])),
  nodes: Object.fromEntries(Object.keys(POS).map((id) => [id, { id, owner: owners[id] ?? null }])),
  edges: { e1: { id: 'e1', a: 'A', b: 'B' }, e2: { id: 'e2', a: 'B', b: 'C' } },
} as unknown as Realm)
const input = (before: Realm, after: Realm, lines: ReportLine[] = [], o: Partial<TpInput> = {}): TpInput => ({
  before, after, lines, me: 'us', geo, seen: () => true, heard: () => true, foes: new Set(), threats: [],
  look: () => ({ squad: [{ src: 'x.png', ar: 1 }], c: '#fff', c2: '#000' }), goods: () => null, ...o,
})

describe('지도 연출 — 걸음', () => {
  it('고을 → 길 위 자리: 길을 따라 떠난 쪽 몫만큼', () => {
    const p = pathOf(geo, { node: 'A' }, { from: 'A', to: 'B', f: 0.34 })!
    assert.ok(close(p[0]!, POS.A!))
    assert.ok(p.length >= 2)
    // 끝은 A 와 B 사이 (B 에 닿지 않았다)
    assert.ok(p[p.length - 1]![0] > 0.1 && p[p.length - 1]![0] < 0.5)
  })
  it('길 위 → 갈 고을 · 길 위 → 떠난 고을로 되돌아', () => {
    const fwd = pathOf(geo, { from: 'A', to: 'B', f: 0.34 }, { node: 'B' })!
    assert.ok(close(fwd[fwd.length - 1]!, POS.B!))
    const back = pathOf(geo, { from: 'A', to: 'B', f: 0.34 }, { node: 'A' })!
    assert.ok(close(back[back.length - 1]!, POS.A!))
  })
  it('길 위에서 다음 길로 이어 간다 · 길이 없으면 곧게 · 안 움직였으면 없음', () => {
    const p = pathOf(geo, { from: 'A', to: 'B', f: 0.34 }, { from: 'B', to: 'C', f: 0.34 })!
    assert.ok(p.some((q) => close(q, POS.B!)))
    assert.ok(p[p.length - 1]![1] > 0.1 && p[p.length - 1]![1] < 0.5)
    const s = pathOf(geo, { node: 'A' }, { node: 'C' })!
    assert.ok(close(s[0]!, POS.A!) && close(s[s.length - 1]!, POS.C!))
    assert.equal(pathOf(geo, { node: 'A' }, { node: 'A' }), null)
  })
})

describe('지도 연출 — 차례', () => {
  it('걸은 우리 군대 하나 · 닿았다는 줄을 품는다', () => {
    const arrive: ReportLine = { kind: 'arrive', army: 'a1', node: 'B' }
    const plan = planTurn(input(realmOf([army('a1', 'us', 'A')]), realmOf([army('a1', 'us', 'B')]), [arrive]))
    assert.equal(plan.walks.length, 1)
    const w = plan.walks[0]!
    assert.equal(w.clash, -1)
    assert.ok(close(w.go!.pts[w.go!.pts.length - 1]!, POS.B!))
    assert.equal(w.go!.a, 'node')
    assert.equal(w.go!.b, 'node')
    assert.deepEqual(w.lines, [arrive])
  })
  it('쳐서 진 군대는 그 고을 앞까지 가서 돌아온다 · 흩어진 군대는 가서 스러진다', () => {
    const battle = { kind: 'battle', node: 'C', attacker: 'a1', allies: ['a2'], pincer: false, defender: 'them', ambush: 'none', p: 0.4, outcome: 'lose', captured: null, killed: null, militia: 0, atkFaction: 'us' } as unknown as ReportLine
    const plan = planTurn(input(realmOf([army('a1', 'us', 'B'), army('a2', 'us', 'B')], { C: 'them' }), realmOf([army('a1', 'us', 'B')], { C: 'them' }), [battle]))
    assert.equal(plan.clashes.length, 1)
    assert.equal(plan.clashes[0]!.result, 'none')
    const a1 = plan.walks.find((w) => w.army === 'a1')!
    const a2 = plan.walks.find((w) => w.army === 'a2')!
    assert.equal(a1.clash, 0)
    assert.ok(a1.go !== null && a1.back !== null)
    assert.ok(close(a1.back!.pts[a1.back!.pts.length - 1]!, POS.B!))
    assert.equal(a2.gone, true)
    assert.equal(a2.back, null)
  })
  it('빼앗은 고을은 우리 깃발 · 남이 빼앗으면 불 · 지켜 내면 방패', () => {
    const b = (atk: string, def: string, outcome: string): ReportLine => ({ kind: 'battle', node: 'C', attacker: 'x', allies: [], pincer: false, defender: def, ambush: 'none', p: 0.5, outcome, captured: null, killed: null, militia: 0, atkFaction: atk } as unknown as ReportLine)
    const r0 = realmOf([])
    assert.equal(planTurn(input(r0, realmOf([], { C: 'us' }), [b('us', 'them', 'win')])).clashes[0]!.result, 'taken')
    assert.equal(planTurn(input(r0, realmOf([], { C: 'them' }), [b('them', 'other', 'rout')])).clashes[0]!.result, 'burn')
    assert.equal(planTurn(input(r0, realmOf([], { C: 'us' }), [b('them', 'us', 'lose')])).clashes[0]!.result, 'held')
  })
  it('안 보이는 적 · 안 보이는 고을의 싸움은 빠진다', () => {
    const before = realmOf([army('f1', 'them', 'A')])
    const after = realmOf([army('f1', 'them', 'B')])
    assert.equal(planTurn(input(before, after)).walks.length, 0)
    assert.equal(planTurn(input(before, after, [], { foes: new Set(['f1']) })).walks.length, 1)
    const battle = { kind: 'battle', node: 'D', attacker: 'f1', allies: [], pincer: false, defender: 'x', ambush: 'none', p: 0.5, outcome: 'win', captured: null, killed: null, militia: 0, atkFaction: 'them' } as unknown as ReportLine
    assert.equal(planTurn(input(before, after, [battle], { seen: (n) => n !== 'D' })).clashes.length, 0)
  })
})

describe('지도 연출 — 박자', () => {
  const empty: TurnPlan = { walks: [], clashes: [], goods: [], marks: [] }
  it('아무 일 없는 달은 짧은 쉼', () => {
    const t = timeline(empty, 100)
    assert.equal(t.end, 100 + P.realm.tpQuietMs / P.realm.tpSpeed)
  })
  it('걸음 → 싸움 → 거둔 것 → 위협 차례 · 가장 긴 시간을 넘지 않는다', () => {
    const before = realmOf([army('a1', 'us', 'A')])
    const after = realmOf([army('a1', 'us', 'B')], { C: 'us' })
    const battle = { kind: 'battle', node: 'C', attacker: 'zz', allies: [], pincer: false, defender: 'them', ambush: 'none', p: 0.5, outcome: 'win', captured: null, killed: null, militia: 0, atkFaction: 'us' } as unknown as ReportLine
    const harvest: ReportLine = { kind: 'harvest', faction: 'us', grain: 300 }
    const plan = planTurn(input(before, after, [battle, harvest], { goods: (l) => (l.kind === 'harvest' ? { node: 'A', items: [{ icon: 'good-rice', n: 300 }] } : null), threats: ['B'] }))
    const t = timeline(plan, 150)
    assert.ok(t.walkAt[0]! >= 150)
    assert.ok(t.clashAt[0]! >= t.walkAt[0]! + t.walkMs - 1)
    assert.ok(t.goodAt[0]! > t.clashAt[0]!)
    assert.ok(t.markAt[0]! >= t.goodAt[0]!)
    assert.ok(t.end <= P.realm.tpMaxMs)
    // 싸움이 아주 많아도 가장 긴 시간 안에
    const many: TurnPlan = { ...plan, clashes: Array.from({ length: 30 }, () => plan.clashes[0]!) }
    const tm = timeline(many, 150)
    assert.ok(tm.end <= P.realm.tpMaxMs + 1)
    assert.ok(tm.k < 1)
  })
})
