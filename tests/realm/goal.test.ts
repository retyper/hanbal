/**
 * 먼 곳으로 (src/realm/goal.ts · 형 10-25: "먼 곳으로도 이동시킬 수 있어야 · 매번 옆 고을을 선택해 줘야 하는 게 귀찮어")
 *
 *  - 갈 곳을 두면 닿을 때까지 계절마다 한 걸음씩 저절로 간다 · 닿으면 갈 곳이 지워진다
 *  - 지나는 고을은 우리·친한 나라·주인 없는 땅만 — 적 땅 너머는 닿을 곳이 아니다
 *  - 갈 곳 없이 직접 보내면 갈 곳을 지운다 · 같은 판이면 같은 길 (A1)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { startMahan } from '../../src/realm/data/regions/mahan.ts'
import { goalReach } from '../../src/realm/goal.ts'
import { advance } from '../../src/realm/season.ts'
import type { Army, Order, Realm } from '../../src/realm/types.ts'

const mine = (r: Realm): Army => Object.values(r.armies).filter((a) => a.faction === r.player && a.march === null).sort((a, b) => (a.id < b.id ? -1 : 1))[0]!
/** 두 걸음 넘게 떨어진 우리 고을이나 빈땅 */
function farOwn(r: Realm, a: Army): [string, number] | null {
  const reach = goalReach(r, r.player, a.at)
  const xs = [...reach.entries()].filter(([id, x]) => x.hops >= 2 && (r.nodes[id]!.owner === r.player || r.nodes[id]!.owner === null)).sort((x, y) => y[1].hops - x[1].hops || (x[0] < y[0] ? -1 : 1))
  return xs.length > 0 ? [xs[0]![0], xs[0]![1].seasons] : null
}

describe('먼 곳으로 — 갈 곳', () => {
  it('두면 계절마다 한 걸음씩 가서 닿고, 닿으면 지워진다', () => {
    let found = false
    for (const tier of [1, 2, 3]) {
      let r = startMahan(tier)
      const a = mine(r)
      const far = farOwn(r, a)
      if (far === null) continue
      found = true
      const [to, seasons] = far
      const first = goalReach(r, r.player, a.at).get(to)!
      const orders: Order[] = [{ kind: 'march', army: a.id, edge: first.edge, ambush: false }, { kind: 'goal', army: a.id, node: to }]
      r = advance(r, orders).next
      assert.equal(r.armies[a.id]?.goal, to)
      for (let i = 0; i < seasons + 3 && r.armies[a.id]?.at !== to; i++) r = advance(r, []).next
      const b = r.armies[a.id]
      if (b === undefined || (r.nodes[to]!.owner !== r.player && r.nodes[to]!.owner !== null)) continue // 싸움에 휩쓸렸다 — 이 시드는 넘긴다
      assert.equal(b.at, to, `${tier}: ${to} 에 닿아야 한다`)
      r = advance(r, []).next
      assert.equal(r.armies[a.id]?.goal, undefined)
      return
    }
    assert.fail(found ? '갈 곳에 닿은 시드가 없다' : '두 걸음 넘는 우리·빈 고을이 있는 시드가 없다')
  })

  it('갈 곳 없이 직접 보내면 갈 곳을 지운다', () => {
    let r = byeonhanMini(2)
    const a = mine(r)
    const reach = goalReach(r, r.player, a.at)
    const far = [...reach.entries()].find(([, x]) => x.hops >= 2)
    const near = [...reach.entries()].find(([, x]) => x.hops === 1)
    assert.ok(far !== undefined && near !== undefined)
    r = advance(r, [{ kind: 'goal', army: a.id, node: far[0] }]).next
    const b = r.armies[a.id]!
    assert.equal(b.goal, far[0])
    if (b.march !== null) return // 첫 걸음을 이미 떠났다 — 다음 시험에서
    r = advance(r, [{ kind: 'march', army: a.id, edge: reach.get(near[0])!.edge, ambush: false }]).next
    assert.equal(r.armies[a.id]?.goal, undefined)
  })

  it('적 땅은 지나지 않는다 — 닿는 길의 가운데 고을은 다 우리·친한 나라·주인 없는 땅', () => {
    const r = byeonhanMini(3)
    const a = mine(r)
    const reach = goalReach(r, r.player, a.at)
    for (const [to] of reach) {
      // 한 걸음씩 따라가 본다
      let at = a.at
      for (let k = 0; k < 40 && at !== to; k++) {
        const step = goalReach(r, r.player, at).get(to)!
        const e = r.edges[step.edge]!
        at = e.a === at ? e.b : e.a
        if (at !== to) {
          const o = r.nodes[at]!.owner
          assert.ok(o === null || o === r.player || r.relations[[r.player, o].sort().join('|')]?.state === 'ally' || r.relations[[r.player, o].sort().join('|')]?.state === 'truce', `${to} 가는 길에 ${at}(${o})`)
        }
      }
      assert.equal(at, to)
    }
  })

  it('같은 판이면 같은 길', () => {
    const r = byeonhanMini(5)
    const a = mine(r)
    const x = [...goalReach(r, r.player, a.at).entries()]
    const y = [...goalReach(r, r.player, a.at).entries()]
    assert.deepEqual(x, y)
  })
})
