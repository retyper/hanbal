/**
 * 정찰 여러 개 · 이웃은 늘 보인다 (docs/realm/FOCUS.md D · 형 11-01: "정찰 1개로 여러 전선을 못 봄")
 *  - 우리 고을과 맞닿은 고을은 정찰 없이 턴마다 군세가 범위로 보인다 (참값을 품는다)
 *  - 정찰꾼 수는 고을 수에 따라 1 → 2 → 3 · 판이 한도를 넘는 정찰을 버린다 (사람·AI 같은 규칙)
 *  - 옛 저장(정찰 한 칸 · 고정 한 곳)도 목록으로 읽힌다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders } from '../../src/realm/ai.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { startRegion, regionNations } from '../../src/realm/data/regions/index.ts'
import { ageSeasons } from '../../src/realm/calendar.ts'
import { visibleRange } from '../../src/realm/intel.ts'
import { draftScouts, parseScoutKeep, scoutCap, scoutTargets, townCount, watchedNodes } from '../../src/realm/scouts.ts'
import { advance, neighbors, nodeStrength, planned, scoutSeesNode, seenMarches, seenScoutedStationary } from '../../src/realm/season.ts'
import type { Order, Realm } from '../../src/realm/types.ts'
import { P } from '../../src/tune/params.ts'

const fresh = (): Realm => planned(byeonhanMini(1), [])

describe('빈땅 척후의 적군 시야', () => {
  it('척후가 본 빈땅으로 오가거나 그곳에 머무는 적군을 보고, 정보가 낡으면 보이지 않는다', () => {
    const r = fresh()
    const node = 'wild-galmae'
    const foe = r.armies['a-anya-1']!
    assert.equal(r.nodes[node]?.owner, null)
    assert.equal(r.nodes['anya-fort']?.owner, 'anya')
    foe.at = node
    foe.march = { from: node, to: 'anya-fort', edge: 'test', left: 1, ambush: false }
    assert.ok(!seenMarches(r, 'us').some((a) => a.id === foe.id), '척후 없이 빈땅의 적을 보았다')
    ;(r.intel['us'] ??= {})[node] = { land: true, force: { f0: 0, src: 'scout', u: 0.5, season: r.season }, alert: null }
    assert.equal(scoutSeesNode(r, 'us', node), true)
    assert.ok(seenMarches(r, 'us').some((a) => a.id === foe.id), '빈땅에서 떠나는 적을 못 보았다')
    foe.march = { from: 'anya-fort', to: node, edge: 'test', left: 1, ambush: false }
    assert.ok(seenMarches(r, 'us').some((a) => a.id === foe.id), '빈땅으로 오는 적을 못 보았다')
    foe.march = null
    assert.ok(seenScoutedStationary(r, 'us').some((a) => a.id === foe.id), '빈땅에 머무는 적을 못 보았다')
    assert.ok(nodeStrength(r, node, null) > 0, '빈땅에 머무는 적의 군세가 0으로 보인다')
    r.season += 2
    assert.equal(scoutSeesNode(r, 'us', node), false)
    assert.ok(!seenScoutedStationary(r, 'us').some((a) => a.id === foe.id), '낡은 척후 보고가 적군을 계속 보여 준다')
  })
})

/** 우리 땅을 n 곳으로 — 남의 고을을 차례로 넘겨받는다 (시험에서만) */
function withTowns(r: Realm, n: number): Realm {
  const s = structuredClone(r)
  const others = Object.values(s.nodes).filter((x) => x.owner !== 'us').sort((a, b) => (a.id < b.id ? -1 : 1))
  let have = townCount(s, 'us')
  for (const x of others) {
    if (have >= n) break
    x.owner = 'us'
    have++
  }
  return s
}

describe('이웃 고을은 늘 보인다 (파수)', () => {
  it('턴이 지나면 우리 고을과 맞닿은 고을마다 이번 턴 군세가 범위로 있고, 범위는 참값을 품는다', () => {
    const next = advance(fresh(), []).next
    const watched = watchedNodes(next, 'us').filter((id) => next.nodes[id]!.owner !== null)
    assert.ok(watched.length > 0)
    for (const id of watched) {
      const f = next.intel['us']?.[id]?.force
      assert.ok(f, `${id} 의 군세가 안 보인다`)
      const v = visibleRange({ f0: f!.f0, src: f!.src, u: f!.u }, ageSeasons(next, f!.season))
      assert.ok(v !== null, `${id} 범위가 없다`)
      const truth = nodeStrength(next, id, next.nodes[id]!.owner)
      assert.ok(truth >= v![0] - 1e-9 && truth <= v![1] + 1e-9, `${id}: ${truth} ∉ [${v![0]}, ${v![1]}]`)
    }
  })

  it('파수 범위는 정찰보다 넓다 — 정찰이 할 일이 남는다', () => {
    const next = advance(fresh(), []).next
    const id = watchedNodes(next, 'us').find((x) => next.intel['us']?.[x]?.force?.src === 'watch' && (next.intel['us']![x]!.force!.f0 > 0))
    assert.ok(id !== undefined)
    const f = next.intel['us']![id!]!.force!
    const v = visibleRange({ f0: f.f0, src: f.src, u: f.u }, 0)!
    assert.ok(v[1] > v[0], '파수가 한 숫자로 보인다')
  })

  it('맞닿지 않은 곳은 파수가 보지 않는다', () => {
    const r = fresh()
    const next = advance(r, []).next
    const watched = new Set(watchedNodes(next, 'us'))
    for (const n of Object.values(next.nodes)) {
      if (n.owner === 'us' || watched.has(n.id)) continue
      assert.notEqual(next.intel['us']?.[n.id]?.force?.src, 'watch', `${n.id} 는 맞닿지 않았는데 파수가 봤다`)
    }
  })

  it('정찰이 본 것은 다음 턴 파수가 덮지 않는다 (병종 몫이 남는다)', () => {
    const r = fresh()
    const node = watchedNodes(r, 'us')[0]!
    const next = advance(r, [{ kind: 'scout', faction: 'us', node, hero: null }]).next
    assert.equal(next.intel['us']![node]!.force!.src, 'scout')
  })

  it('달 시계 판은 첫 턴부터 이웃이 보인다', () => {
    const region = 'mahan'
    const me = regionNations(region)[0]!
    const r = startRegion(region, 3, me)
    const watched = watchedNodes(r, me).filter((id) => r.nodes[id]!.owner !== null)
    assert.ok(watched.length > 0)
    for (const id of watched) assert.equal(r.intel[me]?.[id]?.force?.season, r.season, `${id} 를 첫 턴에 못 본다`)
  })

  it('파수는 플레이어 자리만 — AI 나라는 예전처럼 정찰로 본다 · 빈땅엔 군세를 적지 않는다', () => {
    const next = advance(fresh(), []).next
    for (const f of Object.keys(next.factions)) {
      if (f === next.player) continue
      for (const k of Object.values(next.intel[f] ?? {})) assert.notEqual(k.force?.src, 'watch', `${f} 가 파수를 받았다`)
    }
    for (const id of watchedNodes(next, 'us')) if (next.nodes[id]!.owner === null) assert.notEqual(next.intel['us']?.[id]?.force?.src, 'watch')
  })

  it('같은 판이면 같은 범위 (결정론)', () => {
    const a = advance(fresh(), []).next
    const b = advance(fresh(), []).next
    assert.deepEqual(a.intel, b.intel)
  })
})

describe('정찰꾼 수 — 고을 수에 따라 1 → 2 → 3', () => {
  it('문턱마다 하나씩 는다', () => {
    const r = fresh()
    const t2 = P.realm.scoutTowns2
    const t3 = P.realm.scoutTowns3
    assert.equal(scoutCap(withTowns(r, 1), 'us'), 1)
    assert.equal(scoutCap(withTowns(r, t2 - 1), 'us'), 1)
    assert.equal(scoutCap(withTowns(r, t2), 'us'), 2)
    assert.equal(scoutCap(withTowns(r, t3 - 1), 'us'), 2)
    assert.equal(scoutCap(withTowns(r, t3), 'us'), 3)
    assert.equal(scoutCap(withTowns(r, t3 + 5), 'us'), 3)
  })

  it('판은 한도를 넘는 정찰을 버리고, 같은 곳은 한 번만 본다', () => {
    const r = fresh()
    const far = Object.values(r.nodes).filter((n) => n.owner !== null && n.owner !== 'us').map((n) => n.id).sort().slice(0, 4)
    assert.equal(far.length, 4)
    const orders: Order[] = [...far, far[0]!].map((node) => ({ kind: 'scout', faction: 'us', node, hero: null }))
    const count = (x: Realm): number => advance(x, orders).report.lines.filter((l) => l.kind === 'scout' && l.faction === 'us').length
    assert.equal(count(r), 1, '고을 하나면 정찰꾼 하나')
    const r2 = withTowns(r, P.realm.scoutTowns2)
    const far2 = far.filter((id) => r2.nodes[id]!.owner !== 'us')
    const orders2: Order[] = [...far2, far2[0]!].map((node) => ({ kind: 'scout', faction: 'us', node, hero: null }))
    const lines = advance(r2, orders2).report.lines.filter((l) => l.kind === 'scout' && l.faction === 'us')
    assert.equal(lines.length, Math.min(2, far2.length))
    assert.equal(new Set(lines.map((l) => (l.kind === 'scout' ? l.node : ''))).size, lines.length, '같은 곳을 두 번 봤다')
  })

  it('AI 도 정찰꾼 수를 넘겨 보내지 않는다', () => {
    let r = fresh()
    for (let t = 0; t < 8; t++) {
      const orders = aiOrders(r)
      for (const f of Object.keys(r.factions)) {
        const n = orders.filter((o) => o.kind === 'scout' && o.faction === f).length
        assert.ok(n <= scoutCap(r, f), `${f} 가 ${n} 곳에 정찰을 보냈다 (한도 ${scoutCap(r, f)})`)
      }
      r = advance(r, orders).next
    }
  })
})

describe('정찰꾼이 갈 곳 — 먼 곳까지', () => {
  it('맞닿은 곳과 그 너머(본 땅, scoutReach 칸 안)를 고를 수 있고, 우리 땅은 없다', () => {
    const r = fresh()
    const ts = scoutTargets(r, 'us')
    assert.ok(ts.every((id) => r.nodes[id]!.owner !== 'us'))
    for (const id of watchedNodes(r, 'us')) assert.ok(ts.includes(id), `맞닿은 ${id} 를 못 고른다`)
    const mine = new Set(Object.values(r.nodes).filter((n) => n.owner === 'us').map((n) => n.id))
    const far = ts.filter((id) => !neighbors(r, id).some((nb) => mine.has(nb)))
    assert.ok(far.length > 0, '먼 곳을 하나도 못 고른다')
  })

  it('안개 판에서는 본 땅만 고른다', () => {
    const region = 'yeongnam'
    const me = regionNations(region)[0]!
    const r = startRegion(region, 3, me)
    for (const id of scoutTargets(r, me)) assert.equal(r.intel[me]?.[id]?.land, true, `못 본 ${id} 로 정찰꾼이 간다`)
  })
})

describe('옛 저장 — 정찰 한 칸에서 목록으로', () => {
  it('고정해 둔 곳: 옛 글(고을 하나) · 새 글(JSON 목록) · 빈 것 · 깨진 것', () => {
    assert.deepEqual(parseScoutKeep('guya-vil'), ['guya-vil'])
    assert.deepEqual(parseScoutKeep('["guya-vil","anya-cap","guya-vil"]'), ['guya-vil', 'anya-cap'])
    assert.deepEqual(parseScoutKeep(null), [])
    assert.deepEqual(parseScoutKeep(''), [])
    assert.deepEqual(parseScoutKeep('[깨진'), [])
  })

  it('이번 턴 초안: 옛 scout 한 칸 · 새 scouts 목록', () => {
    assert.deepEqual(draftScouts({ scout: 'guya-vil' }), ['guya-vil'])
    assert.deepEqual(draftScouts({ scout: '' }), [])
    assert.deepEqual(draftScouts({}), [])
    assert.deepEqual(draftScouts({ scouts: ['a', 'b', 3, 'a'], scout: 'c' }), ['a', 'b'])
  })
})
