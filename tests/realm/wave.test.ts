/**
 * 둘째 물결 (loop 리뷰 #5 · 11-01 — 같은 고을로 오던 원군이 달을 달리해 닿아 하나씩 따로 싸웠다) — 달 시계 판만
 *  - 치는 쪽: 같은 나라의 다른 군대가 reliefReach 달 안에 그 고을에 닿을 것이면 이 싸움에 함께 선다 (원군으로 늦게 붙는다)
 *  - 지키는 쪽: 그 고을로 오던 한편 군대도 reliefReach 달 안이면 먼저 들어와 함께 지킨다
 *  - 더 먼 군대는 끼지 않는다 · reliefReach 0 이거나 옛 판(clock 없음)이면 예전 그대로 (같은 턴에 닿은 것만)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { PEOPLE_SCALE as S } from '../../src/realm/migrate.ts'
import { advance, neighbors, otherEnd } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm, ReportLine } from '../../src/realm/types.ts'

const ATK = 'guya'
const DEF = 'anya'

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
 * 가락국 군대가 아라국 고을 하나를 이번 달에 친다 (a-atk · 남은 1달). 같은 나라의 다른 군대 a-wave 가 다른 길로 그 고을에 오고 있다(남은 `atkLeft` 달),
 * 아라국 군대 d-wave 가 제 땅에서 그 고을을 지키러 오고 있다(남은 `defLeft` 달). 판의 다른 군대는 다 걷어 낸다
 */
function scene(opts: { month: boolean; atkLeft: number; defLeft: number }): { r: Realm; node: string } {
  const r = byeonhanMini(3)
  if (opts.month) (r as { clock?: 'month' }).clock = 'month'
  else delete (r as { clock?: 'month' }).clock
  const node = Object.values(r.nodes)
    .filter((n) => n.owner === DEF && n.id !== r.factions[DEF]!.capital && neighbors(r, n.id).length >= 3)
    .sort((a, b) => (a.id < b.id ? -1 : 1))[0]!
  const [from, side, home] = neighbors(r, node.id).sort()
  for (const n of neighbors(r, node.id)) r.nodes[n]!.owner = n === home ? DEF : ATK
  const edgeTo = (at: string): string => Object.values(r.edges).find((e) => otherEnd(e, node.id) === at)!.id
  for (const id of Object.keys(r.armies)) delete r.armies[id]
  r.armies['a-atk'] = { id: 'a-atk', faction: ATK, hero: null, mix: { spear: 400 * S }, equip: 'iron', morale: 1, at: from!, march: { from: from!, to: node.id, edge: edgeTo(from!), left: 1, ambush: false } }
  r.armies['a-wave'] = { id: 'a-wave', faction: ATK, hero: null, mix: { horse: 120 * S }, equip: 'iron', morale: 1, at: side!, march: { from: side!, to: node.id, edge: edgeTo(side!), left: opts.atkLeft, ambush: false } }
  r.armies['a-def'] = { id: 'a-def', faction: DEF, hero: null, mix: { spear: 200 * S }, equip: 'bronze', morale: 1, at: node.id, march: null }
  r.armies['d-wave'] = { id: 'd-wave', faction: DEF, hero: null, mix: { spear: 150 * S }, equip: 'bronze', morale: 1, at: home!, march: { from: home!, to: node.id, edge: edgeTo(home!), left: opts.defLeft, ambush: false } }
  return { r, node: node.id }
}

type Battle = Extract<ReportLine, { kind: 'battle' }>
const battlesAt = (lines: readonly ReportLine[], node: string): Battle[] => lines.filter((l): l is Battle => l.kind === 'battle' && l.node === node)

describe('둘째 물결 — 다음 달 닿을 원군은 이번 싸움에 붙는다', () => {
  it('달 시계 — 치는 쪽 둘째 군대가 한 싸움에 함께 서고 다음 달엔 그 고을 싸움이 다시 나지 않는다', () => {
    const { r, node } = scene({ month: true, atkLeft: 2, defLeft: 9 })
    const one = advance(r, [])
    const bs = battlesAt(one.report.lines, node)
    assert.equal(bs.length, 1)
    assert.equal(bs[0]!.attacker, 'a-atk', '앞선 군대는 이번 달에 닿은 군대')
    assert.deepEqual(bs[0]!.allies, ['a-wave'])
    assert.equal(one.next.armies['a-wave']?.march ?? null, null, '둘째 물결은 길 위에 남지 않는다')
    // 둘째 물결은 처음 합에 없고 늦게 붙는다 (싸움이 그 합까지 가면 기록에 relief)
    const rounds = bs[0]!.rounds ?? []
    if (rounds.length > P.realm.reliefRound) assert.equal(rounds.find((x) => x.relief !== undefined)?.relief?.side, 'a')
    const two = advance(one.next, [])
    assert.equal(battlesAt(two.report.lines, node).length, 0, '다음 달에 따로 싸우지 않는다')
  })

  it('달 시계 — 지키는 쪽 원군도 먼저 들어와 함께 지킨다', () => {
    const { r, node } = scene({ month: true, atkLeft: 9, defLeft: 2 })
    const { next, report } = advance(r, [])
    const at = report.lines.findIndex((l) => l.kind === 'arrive' && l.army === 'd-wave' && l.node === node)
    const fought = report.lines.findIndex((l) => l.kind === 'battle' && l.node === node)
    assert.ok(at >= 0 && fought > at, '싸움 앞에 고을에 든다')
    assert.equal(next.armies['d-wave']?.march ?? null, null)
  })

  it('reliefReach 보다 먼 군대는 끼지 않는다', () => {
    const { r, node } = scene({ month: true, atkLeft: 3, defLeft: 3 })
    const { next, report } = advance(r, [])
    const b = battlesAt(report.lines, node)[0]!
    assert.deepEqual(b.allies, [])
    assert.ok(!report.lines.some((l) => l.kind === 'arrive' && l.army === 'd-wave'))
    assert.equal(next.armies['a-wave']?.march?.left, 2)
    assert.equal(next.armies['d-wave']?.march?.left, 2)
  })

  it('reliefReach 0 · 옛 판(clock 없음)은 예전 그대로 — 같은 턴에 닿은 것만', () => {
    const off = withKnobs({ reliefReach: 0 }, () => advance(scene({ month: true, atkLeft: 2, defLeft: 2 }).r, []))
    const old = advance(scene({ month: false, atkLeft: 2, defLeft: 2 }).r, [])
    for (const { next, report } of [off, old]) {
      const b = report.lines.find((l): l is Battle => l.kind === 'battle')!
      assert.deepEqual(b.allies, [])
      assert.equal(next.armies['a-wave']?.march?.left, 1)
      assert.equal(next.armies['d-wave']?.march?.left, 1)
    }
  })

  it('같은 판이면 같은 결과 (A1)', () => {
    const a = advance(scene({ month: true, atkLeft: 2, defLeft: 2 }).r, [])
    const b = advance(scene({ month: true, atkLeft: 2, defLeft: 2 }).r, [])
    assert.equal(JSON.stringify(a.next), JSON.stringify(b.next))
    assert.equal(JSON.stringify(a.report), JSON.stringify(b.report))
  })
})
