/**
 * 백성 배치 · 땅의 결 · 일손 (형 2026-10-23: "마을마다 생산하는 것이 다르니 본인 전략대로 · 양동이에 물 나누듯 ·
 * 강이 있거나 가까우면 쌀 생산량도 많아지고")
 *
 *  - 고을마다 더하고 빼는 집의 합이 0 이면 옮겨지고, 곡식이 들고, 손댄 고을은 한동안 집이 안 는다
 *  - 합이 0 이 아니거나(모아 둔 백성이 남음) 한도를 넘거나 품을 넘기면 아무것도 안 바뀐다
 *  - 강가 고을은 가을걷이가 더 나고, 높은 터·산성은 덜 난다
 *  - 철·나무·소금·말은 사는 집이 많을수록 더 난다 (workMin ~ workMax)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { homeRoom, isRiverside, landMul, placeLimit, placeNodes, workMul } from '../../src/realm/economy.ts'
import { advance } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm } from '../../src/realm/types.ts'

const rich = (r: Realm): Realm => {
  r.stock[r.player]!.grain = 5000
  return r
}

/** 우리 고을 둘 — 집이 많은 곳(떼는 곳)과 품이 남는 곳(붓는 곳) */
function pair(r: Realm): { from: string; to: string } {
  const ids = placeNodes(r, r.player)
  const from = [...ids].sort((a, b) => r.nodes[b]!.hh - r.nodes[a]!.hh)[0]!
  const to = ids.find((id) => id !== from && homeRoom(r.nodes[id]!) - r.nodes[id]!.hh >= 10)!
  return { from, to }
}

describe('백성 배치', () => {
  it('합이 0 이면 옮겨지고 곡식이 들고, 손댄 고을은 한동안 안 는다', () => {
    const r = rich(byeonhanMini(1))
    const { from, to } = pair(r)
    const n = Math.min(10, placeLimit(r, r.player))
    assert.ok(n > 0)
    const a0 = r.nodes[from]!.hh
    const b0 = r.nodes[to]!.hh
    const { next, report } = advance(r, [{ kind: 'place', faction: r.player, delta: { [from]: -n, [to]: n } }])
    assert.ok(report.lines.some((l) => l.kind === 'place' && l.n === n))
    assert.equal(next.nodes[from]!.hh, a0 - n, '뗀 고을은 그만큼 준다 (자리 잡느라 늘지 않는다)')
    assert.equal(next.nodes[to]!.hh, b0 + n, '부은 고을은 그만큼 는다')
  })

  it('모아 둔 백성이 남거나 한도·품을 넘기면 아무것도 안 바뀐다', () => {
    const r = rich(byeonhanMini(1))
    const { from, to } = pair(r)
    const lim = placeLimit(r, r.player)
    const bad = [
      { [from]: -10, [to]: 5 },
      { [from]: -(lim + 1), [to]: lim + 1 },
      { [from]: -(homeRoom(r.nodes[to]!) + 1), [to]: homeRoom(r.nodes[to]!) + 1 },
    ]
    for (const delta of bad) {
      const { report } = advance(r, [{ kind: 'place', faction: r.player, delta }])
      assert.ok(!report.lines.some((l) => l.kind === 'place'), JSON.stringify(delta))
    }
  })

  it('같은 판 · 같은 명령이면 같은 결과', () => {
    const run = (): string => {
      const r = rich(byeonhanMini(2))
      const { from, to } = pair(r)
      return JSON.stringify(advance(r, [{ kind: 'place', faction: r.player, delta: { [from]: -8, [to]: 8 } }]).next.nodes)
    }
    assert.equal(run(), run())
  })
})

describe('땅의 결 · 일손', () => {
  it('강가는 더 나고, 높은 터는 덜 난다', () => {
    const r = byeonhanMini(1)
    const ns = Object.values(r.nodes).filter((n) => n.kind !== 'sodo')
    const river = ns.find((n) => isRiverside(r, n.id))
    if (river !== undefined) assert.equal(landMul(r, river.id), 1 + P.realm.riverRice)
    const hill = ns.find((n) => !isRiverside(r, n.id) && (n.tags.includes('high') || n.kind === 'fort'))
    if (hill !== undefined) assert.equal(landMul(r, hill.id), 1 - P.realm.hillRice)
  })

  it('사람이 많을수록 더 나되 위아래가 막혔다', () => {
    assert.equal(workMul(0), P.realm.workMin)
    assert.equal(workMul(P.realm.workHH), 1)
    assert.equal(workMul(P.realm.workHH * 10), P.realm.workMax)
  })
})
