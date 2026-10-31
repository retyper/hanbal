/**
 * 출정 달 어긋내기 · 칠 채비 (loop 리뷰 11-01: 우리를 친 싸움의 85% 가 그 앞 달에 길 위에 없던 군대였다) — 달 시계 판만
 *  - 나라마다 제 출정 달이 있다 (시드·나라 이름으로 · 같은 판이면 같은 달) · 계절에 한 번은 그대로
 *  - 플레이어 고을을 한 달 길로 칠 땐 한 달 먼저 제 자리에 모인다 (Army.strike) → 다음 달에 친다
 *  - 그사이 승률이 크게 떨어지면 거둔다 · 옛 판(시계 없음)은 예전 그대로 곧장 간다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiMarchTurn, aiOrders, marchPhase } from '../../src/realm/ai.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import { PEOPLE_SCALE as S } from '../../src/realm/migrate.ts'
import { advance, marchTurns, neighbors, nodeStrength, otherEnd } from '../../src/realm/season.ts'
import { mapHtml } from '../../src/ui/realm/mapview.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, Realm } from '../../src/realm/types.ts'

const ATK = 'guya'

/** 판의 다른 값을 잠깐 바꿔 돌린다 */
function withKnobs<T>(set: Record<string, number>, f: () => T): T {
  const R = P.realm as unknown as Record<string, number>
  const was = Object.fromEntries(Object.keys(set).map((k) => [k, R[k]!]))
  Object.assign(R, set)
  try {
    return f()
  } finally {
    Object.assign(R, was)
  }
}

/**
 * 가락국(탐욕) 큰 군대가 플레이어 고을 하나와 한 달 길로 맞닿은 제 고을에 서 있다. 그 고을엔 지키는 이가 없다.
 * 판의 다른 군대는 다 걷어 내고 가락국 도읍에 군대 하나를 남긴다 (마지막 수비가 아니게). 유예가 끝나고 가락국의 출정 달.
 */
function scene(month: boolean): { r: Realm; from: string; to: string; edge: string } {
  const r = byeonhanMini(3)
  if (month) (r as { clock?: 'month' }).clock = 'month'
  else delete (r as { clock?: 'month' }).clock
  ;(r.factions[ATK] as { mind: string }).mind = 'greedy'
  const me = r.player
  const cap = r.factions[me]!.capital
  // 플레이어의 도읍이 아닌 고을 하나 — 없으면 도읍 옆 고을을 플레이어 땅으로
  let to = Object.values(r.nodes).filter((n) => n.owner === me && n.id !== cap).map((n) => n.id).sort()[0]
  if (to === undefined) {
    to = neighbors(r, cap).filter((id) => r.nodes[id]!.kind !== 'sodo').sort()[0]!
    r.nodes[to]!.owner = me
  }
  const ed = Object.values(r.edges).sort((a, b) => (a.id < b.id ? -1 : 1))
    .find((e) => otherEnd(e, to!) !== null && e.kind !== 'pass' && e.kind !== 'mudflat' && e.kind !== 'ford' && r.nodes[otherEnd(e, to!)!]!.kind !== 'sodo' && otherEnd(e, to!) !== cap)!
  const from = otherEnd(ed, to)!
  // 그 고을의 다른 이웃은 다 가락국 땅 — 칠 곳이 플레이어 고을 하나뿐이게
  for (const id of [from, ...neighbors(r, from)]) if (id !== to && r.nodes[id]!.kind !== 'sodo') r.nodes[id]!.owner = ATK
  for (const id of Object.keys(r.armies)) delete r.armies[id]
  r.armies['a-atk'] = { id: 'a-atk', faction: ATK, hero: null, mix: { spear: 2000 * S }, equip: 'iron', morale: 1, at: from, march: null }
  r.armies['a-home'] = { id: 'a-home', faction: ATK, hero: null, mix: { spear: 300 * S }, equip: 'iron', morale: 1, at: r.factions[ATK]!.capital, march: null }
  r.armies['a-me'] = { id: 'a-me', faction: me, hero: null, mix: { spear: 100 * S }, equip: 'bronze', morale: 1, at: cap, march: null }
  // 유예가 끝난 뒤 · 가락국의 출정 달
  const per = month ? 3 : 1
  let t = P.realm.aiGrace * per + 3 * per
  while (!aiMarchTurn({ ...r, season: t }, ATK)) t++
  r.season = t
  return { r, from, to, edge: ed.id }
}

const marchOf = (os: readonly Order[], army: string): Extract<Order, { kind: 'march' }> | undefined =>
  os.find((o): o is Extract<Order, { kind: 'march' }> => o.kind === 'march' && o.army === army)
const poiseOf = (os: readonly Order[], army: string): Extract<Order, { kind: 'poise' }> | undefined =>
  os.find((o): o is Extract<Order, { kind: 'poise' }> => o.kind === 'poise' && o.army === army)

describe('출정 달 어긋내기', () => {
  it('같은 판이면 같은 달 · 0..2 · 나라마다 갈린다', () => {
    const a = startRegion('yeongnam', 7, 'guya')
    const b = startRegion('yeongnam', 7, 'guya')
    const ids = Object.keys(a.factions).sort()
    const pa = ids.map((f) => marchPhase(a, f))
    assert.deepEqual(pa, ids.map((f) => marchPhase(b, f)))
    for (const p of pa) assert.ok(p >= 0 && p <= 2, String(p))
    assert.deepEqual([...new Set(pa)].sort(), [0, 1, 2], '스물한 나라면 세 달이 다 나온다')
    // 다른 씨앗이면 다른 짜임
    const c = startRegion('yeongnam', 8, 'guya')
    assert.notDeepEqual(pa, ids.map((f) => marchPhase(c, f)))
  })
  it('계절마다 꼭 한 번 — 제 출정 달에만', () => {
    const r = startRegion('yeongnam', 7, 'guya')
    for (const f of Object.keys(r.factions)) {
      for (let s = 0; s < 4; s++) {
        const hits = [0, 1, 2].filter((m) => aiMarchTurn({ ...r, season: s * 3 + m }, f))
        assert.deepEqual(hits, [marchPhase(r, f)])
      }
    }
  })
  it('끄면 모두 계절 첫 달 · 옛 판은 늘', () => {
    const r = startRegion('yeongnam', 7, 'guya')
    withKnobs({ aiMarchStagger: 0 }, () => {
      for (const f of Object.keys(r.factions)) assert.equal(marchPhase(r, f), 0)
    })
    const old = structuredClone(r) as Realm & { clock?: string }
    delete old.clock
    for (let s = 0; s < 6; s++) assert.ok(aiMarchTurn({ ...old, season: s }, 'anya'))
  })
})

describe('칠 채비 — 모였다가 다음 달에 친다', () => {
  it('한 달 길로 플레이어 고을을 칠 땐 먼저 모인다 · 다음 턴에 그 길로 친다', () => {
    const { r, from, to, edge } = scene(true)
    assert.equal(marchTurns(r, r.edges[edge]!), 1)
    const o1 = aiOrders(r)
    const p = poiseOf(o1, 'a-atk')
    assert.ok(p !== undefined, `채비: ${JSON.stringify(o1.filter((o) => 'army' in o))}`)
    assert.equal(p.edge, edge)
    assert.equal(marchOf(o1, 'a-atk'), undefined)
    // 모이는 달 — 떠나지 않고 싸움도 없다 · 지도에 보일 채비가 선다
    const s1 = advance(r, o1)
    const a1 = s1.next.armies['a-atk']!
    assert.equal(a1.march, null)
    assert.equal(a1.at, from)
    assert.deepEqual({ node: a1.strike?.node, at: a1.strike?.at }, { node: to, at: r.season + 1 })
    assert.ok(!s1.report.lines.some((l) => l.kind === 'battle' && l.node === to))
    assert.ok(mapHtml(s1.next, s1.next.player, '', [], '').includes('class="strk'), '지도에 「다음 달 친다」')
    // 치는 달 — 그 길로 떠나 닿는다 · 채비는 걷힌다
    const o2 = aiOrders(s1.next)
    const m = marchOf(o2, 'a-atk')
    assert.ok(m !== undefined && m.edge === edge)
    assert.equal(poiseOf(o2, 'a-atk'), undefined)
    const s2 = advance(s1.next, o2)
    assert.ok(s2.report.lines.some((l) => l.kind === 'battle' && l.node === to && l.attacker === 'a-atk'))
    for (const a of Object.values(s2.next.armies)) assert.equal(a.strike, undefined)
  })
  it('채비하는 사이 승률이 크게 떨어지면 거둔다', () => {
    const { r, to } = scene(true)
    const s1 = advance(r, aiOrders(r))
    const a = s1.next.armies['a-atk']!
    assert.ok(a.strike !== undefined)
    a.strike = { ...a.strike, est: 5 } // 채비할 땐 훨씬 나아 보였다
    // 지금 그 고을을 본다 (승률을 모르면 거둘 셈을 못 한다)
    const n = s1.next
    ;(n.intel[ATK] ??= {})[to] = { land: true, force: { f0: nodeStrength(n, to, n.player), src: 'scout', u: 0.3, season: n.season }, alert: null }
    const o2 = aiOrders(s1.next)
    assert.equal(marchOf(o2, 'a-atk'), undefined)
    assert.equal(poiseOf(o2, 'a-atk'), undefined)
  })
  it('같은 판 같은 명령이면 같은 채비 (A1)', () => {
    const run = (): string => {
      let r = scene(true).r
      for (let i = 0; i < 4; i++) r = advance(r, aiOrders(r)).next
      return JSON.stringify(r)
    }
    assert.equal(run(), run())
  })
  it('옛 판(시계 없음)은 모이지 않고 곧장 간다 · 채비 명령은 안 먹는다', () => {
    const { r, edge } = scene(false)
    const o = aiOrders(r)
    assert.equal(poiseOf(o, 'a-atk'), undefined)
    assert.ok(marchOf(o, 'a-atk') !== undefined)
    const s = advance(r, [{ kind: 'poise', army: 'a-atk', edge, ambush: false }])
    assert.equal(s.next.armies['a-atk']!.strike, undefined)
  })
  it('끄면 달 시계도 곧장 간다', () => {
    withKnobs({ aiStrikeWarn: 0 }, () => {
      const { r } = scene(true)
      const o = aiOrders(r)
      assert.equal(poiseOf(o, 'a-atk'), undefined)
      assert.ok(marchOf(o, 'a-atk') !== undefined)
    })
  })
})
