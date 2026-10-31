/**
 * 싸운 뒤 추스름 (달 시계 · battleRest) — 리뷰 11-01 에서 찾은 구멍들
 *  - 나누거나 합쳐서 추스름을 비켜 가지 못한다 (splitArmy · mergeArmy)
 *  - 맞붙은 군대만 추스른다: 이웃으로 물러난 진 쪽도 들고, 들판 싸움의 가던 고을에 서 있던 군대는 안 든다
 *  - 경계 강화는 달 시계에서도 계절에 한 번 (canGuard)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { canGuard, guardCost, stockOf } from '../../src/realm/economy.ts'
import { PEOPLE_SCALE as S } from '../../src/realm/migrate.ts'
import { advance, neighbors, otherEnd, resting } from '../../src/realm/season.ts'
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

describe('추스름 — 나누고 합쳐도 남는다', () => {
  it('떼어 낸 무리는 추스름·군량·닿은 때를 함께 진다 · 같은 달에 떠나지 못한다', () => {
    const { r, mine, edge } = scene()
    const me = r.player
    r.armies['a-me'] = { id: 'a-me', faction: me, hero: null, mix: { spear: 400 * S }, equip: 'bronze', morale: 1, at: mine, march: null, rest: r.season + 1, food: 2, came: r.season - 1 }
    const id = 'a-me-split'
    const s = advance(r, [{ kind: 'split', army: 'a-me', id, take: { spear: 100 * S }, hero: false }, march(id, edge)])
    const b = s.next.armies[id]!
    assert.ok(b !== undefined, '나뉘었다')
    assert.equal(b.march, null, '추스르는 무리는 떠나지 못한다')
    assert.equal(b.rest, r.season + 1)
    assert.equal(b.came, r.season - 1)
  })
  it('합치면 둘 가운데 늦게 풀리는 추스름 · 같은 달에 떠나지 못한다', () => {
    const { r, mine, edge } = scene()
    const me = r.player
    r.armies['a-tired'] = { id: 'a-tired', faction: me, hero: null, mix: { spear: 200 * S }, equip: 'bronze', morale: 1, at: mine, march: null, rest: r.season + 1 }
    r.armies['a-fresh'] = { id: 'a-fresh', faction: me, hero: null, mix: { spear: 200 * S }, equip: 'bronze', morale: 1, at: mine, march: null }
    const s = advance(r, [{ kind: 'merge', army: 'a-tired', into: 'a-fresh' }, march('a-fresh', edge)])
    assert.equal(s.next.armies['a-tired'], undefined, '합쳐졌다')
    const b = s.next.armies['a-fresh']!
    assert.equal(b.rest, r.season + 1)
    assert.equal(b.march, null, '추스르는 군대가 든 무리는 떠나지 못한다')
    // 받는 쪽이 더 오래 추스르면 그대로
    const { r: r2, mine: m2 } = scene()
    r2.armies['a-tired'] = { id: 'a-tired', faction: r2.player, hero: null, mix: { spear: 200 * S }, equip: 'bronze', morale: 1, at: m2, march: null, rest: r2.season }
    r2.armies['a-fresh'] = { id: 'a-fresh', faction: r2.player, hero: null, mix: { spear: 200 * S }, equip: 'bronze', morale: 1, at: m2, march: null, rest: r2.season + 2 }
    assert.equal(advance(r2, [{ kind: 'merge', army: 'a-tired', into: 'a-fresh' }]).next.armies['a-fresh']!.rest, r2.season + 2)
  })
})

describe('추스름 — 맞붙은 군대만', () => {
  it('진 지킨 쪽이 이웃 고을로 물러나도 추스른다', () => {
    const { r, foe, edge } = scene()
    const me = r.player
    const mine = otherEnd(r.edges[edge]!, foe)!
    r.armies['a-me'] = { id: 'a-me', faction: me, hero: null, mix: { spear: 3000 * S }, equip: 'iron', morale: 1, at: mine, march: null }
    r.armies['a-def'] = { id: 'a-def', faction: FOE, hero: null, mix: { spear: 400 * S }, equip: 'stone', morale: 0.6, at: foe, march: null }
    const s = advance(r, [march('a-me', edge)])
    const l = s.report.lines.find((x) => x.kind === 'battle')
    assert.ok(l !== undefined && l.kind === 'battle' && (l.outcome === 'win' || l.outcome === 'rout'), `이겼다: ${l?.kind === 'battle' ? l.outcome : '싸움 없음'}`)
    const d = s.next.armies['a-def']
    assert.ok(d !== undefined && d.at !== foe, `물러났다: ${d?.at}`)
    assert.ok(resting(s.next, d), '물러난 진 쪽도 추스른다')
    assert.ok(resting(s.next, s.next.armies['a-me']!), '이긴 쪽도 추스른다')
  })
  it('들판 싸움 — 가던 고을에 서 있던 군대는 싸우지 않았으니 추스르지 않는다', () => {
    const { r, mine, foe, edge } = scene()
    const me = r.player
    // 가락국 군대(a-atk: id 가 앞서 공격 쪽)가 우리 고을로, 우리 군대(a-me)가 가락국 고을로 — 같은 길에서 맞붙는다
    r.armies['a-atk'] = { id: 'a-atk', faction: FOE, hero: null, mix: { spear: 150 * S }, equip: 'stone', morale: 0.6, at: foe, march: null }
    r.armies['a-me'] = { id: 'a-me', faction: me, hero: null, mix: { spear: 3000 * S }, equip: 'iron', morale: 1, at: mine, march: null }
    r.armies['a-stay'] = { id: 'a-stay', faction: me, hero: null, mix: { spear: 200 * S }, equip: 'bronze', morale: 1, at: mine, march: null }
    const s = advance(r, [march('a-atk', edge), march('a-me', edge)])
    const l = s.report.lines.find((x) => x.kind === 'battle' && x.field === true)
    assert.ok(l !== undefined && l.kind === 'battle' && l.node === mine, '들판 싸움 · 공격 쪽이 가던 고을은 우리 고을')
    assert.ok(!s.report.lines.some((x) => x.kind === 'battle' && x.node === mine && x.field !== true), '우리 고을엔 싸움이 없었다')
    assert.equal(s.next.armies['a-stay']!.at, mine)
    assert.ok(!resting(s.next, s.next.armies['a-stay']!), '싸우지 않은 군대는 떠날 수 있다')
    assert.ok(resting(s.next, s.next.armies['a-me']!), '맞붙은 우리 군대는 추스른다')
    const atk = s.next.armies['a-atk']
    if (atk !== undefined) assert.ok(resting(s.next, atk), '맞붙은 적도 추스른다')
  })
  it('옛 판(시계 없음)은 추스름이 없다', () => {
    const { r, foe, edge } = scene(false)
    const mine = otherEnd(r.edges[edge]!, foe)!
    r.armies['a-me'] = { id: 'a-me', faction: r.player, hero: null, mix: { spear: 3000 * S }, equip: 'iron', morale: 1, at: mine, march: null }
    r.armies['a-def'] = { id: 'a-def', faction: FOE, hero: null, mix: { spear: 400 * S }, equip: 'stone', morale: 0.6, at: foe, march: null }
    const s = advance(r, [march('a-me', edge)])
    assert.ok(s.report.lines.some((x) => x.kind === 'battle'))
    for (const a of Object.values(s.next.armies)) assert.equal(a.rest, undefined)
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
