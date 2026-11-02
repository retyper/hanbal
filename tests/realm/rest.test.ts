/**
 * 싸운 뒤 추스름은 걷었다 (형 11-03) — 싸운 군대도 곧바로 떠난다
 *  - 경계 강화는 달 시계에서도 계절에 한 번 (canGuard)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { canGuard, guardCost, stockOf } from '../../src/realm/economy.ts'
import { PEOPLE_SCALE as S } from '../../src/realm/migrate.ts'
import { advance, neighbors, otherEnd } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, Realm } from '../../src/realm/types.ts'

const FOE = 'guya'

/**
 * 플레이어 고을 `mine` 과 가락국 고을 `foe` 가 한 길(`edge`)로 맞닿았다. `foe` 의 다른 이웃은 다 가락국 땅 (물러날 곳).
 * 판의 군대는 다 걷어 낸다. 달 시계 · 두 나라는 싸우는 사이
 */
function scene(month = true): { r: Realm; mine: string; foe: string; edge: string } {
  const r = byeonhanMini(3)
  if (month) (r as { clock?: 'month' }).clock = 'month'
  else delete (r as { clock?: 'month' }).clock
  const me = r.player
  const cap = r.factions[me]!.capital
  let mine = Object.values(r.nodes).filter((n) => n.owner === me && n.id !== cap).map((n) => n.id).sort()[0]
  if (mine === undefined) {
    mine = neighbors(r, cap).filter((id) => r.nodes[id]!.kind !== 'sodo').sort()[0]!
    r.nodes[mine]!.owner = me
  }
  const ed = Object.values(r.edges).sort((a, b) => (a.id < b.id ? -1 : 1))
    .find((e) => otherEnd(e, mine!) !== null && e.kind !== 'pass' && e.kind !== 'mudflat' && e.kind !== 'ford' && r.nodes[otherEnd(e, mine!)!]!.kind !== 'sodo' && otherEnd(e, mine!) !== cap)!
  const foe = otherEnd(ed, mine)!
  for (const id of [foe, ...neighbors(r, foe)]) if (id !== mine && id !== cap && r.nodes[id]!.kind !== 'sodo') r.nodes[id]!.owner = FOE
  for (const id of Object.keys(r.armies)) delete r.armies[id]
  ;(r.relations ??= {})[[me, FOE].sort().join('|')] = { state: 'war', until: null }
  r.season = 30
  return { r, mine, foe, edge: ed.id }
}

const march = (army: string, edge: string): Order => ({ kind: 'march', army, edge, ambush: false })

describe('싸운 군대도 곧바로 다시 떠난다 (형 11-03: "족쇄 풀어 · 임진왜란 때 20일 만에 부산에서 서울까지")', () => {
  it('이긴 군대가 다음 달에 바로 다른 데로 떠난다', () => {
    const { r, foe, edge } = scene()
    const me = r.player
    const mine = otherEnd(r.edges[edge]!, foe)!
    r.armies['a-me'] = { id: 'a-me', faction: me, hero: null, mix: { spear: 3000 * S }, equip: 'iron', morale: 1, at: mine, march: null }
    r.armies['a-def'] = { id: 'a-def', faction: FOE, hero: null, mix: { spear: 400 * S }, equip: 'stone', morale: 0.6, at: foe, march: null }
    const s = advance(r, [march('a-me', edge)])
    const l = s.report.lines.find((x) => x.kind === 'battle')
    assert.ok(l !== undefined && l.kind === 'battle' && (l.outcome === 'win' || l.outcome === 'rout'), `이겼다: ${l?.kind === 'battle' ? l.outcome : '싸움 없음'}`)
    const a = s.next.armies['a-me']!
    assert.equal(a.at, foe, '그 고을을 쥐었다')
    const s2 = advance(s.next, [march('a-me', edge)])
    const b = s2.next.armies['a-me']!
    assert.ok(b.at === mine || b.march !== null, '다음 달에 바로 떠났다')
  })
})

describe('경계 강화 — 계절에 한 번', () => {
  it('달 시계: 한 번 올리면 그 계절의 남은 달엔 못 올리고 다음 계절 첫 달에 다시', () => {
    const { r, mine } = scene()
    const me = r.player
    stockOf(r, me).grain = 100 * guardCost().grain
    r.season = 30 // 3 의 배수 — 계절 첫 달
    const s1 = advance(r, [{ kind: 'guard', faction: me, node: mine }]).next
    assert.equal(s1.watch[mine]!.guarded, 30)
    assert.ok(!canGuard(s1, me, mine), '둘째 달')
    const s2 = advance(s1, [{ kind: 'guard', faction: me, node: mine }]).next
    assert.equal(s2.watch[mine]!.guarded, 30, '둘째 달엔 다시 안 올랐다')
    assert.ok(!canGuard(s2, me, mine), '셋째 달')
    const s3 = advance(s2, []).next
    assert.equal(s3.season, 33)
    assert.ok(canGuard(s3, me, mine), '다음 계절 첫 달')
  })
  it('옛 판은 턴(계절)마다 그대로', () => {
    const { r, mine } = scene(false)
    const me = r.player
    stockOf(r, me).grain = 100 * guardCost().grain
    const s1 = advance(r, [{ kind: 'guard', faction: me, node: mine }]).next
    assert.ok(canGuard(s1, me, mine))
  })
  it('달마다 쌓이지 않는다 — 경계는 한 번 올린 만큼', () => {
    const { r, mine } = scene()
    const me = r.player
    stockOf(r, me).grain = 100 * guardCost().grain
    const s1 = advance(r, [{ kind: 'guard', faction: me, node: mine }]).next
    const a1 = s1.watch[mine]!.alert
    const s2 = advance(s1, [{ kind: 'guard', faction: me, node: mine }]).next
    assert.ok(s2.watch[mine]!.alert <= a1 + 1e-9, `${a1} → ${s2.watch[mine]!.alert}`)
    assert.ok(P.realm.guardAlert > 0)
  })
})
