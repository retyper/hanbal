/**
 * 외교 — 관계 넷 · 사신 넷 (docs/realm/FLOW.md §4)
 *
 *  - 관계는 쌍마다 하나 (순서 없음) · 처음엔 중립
 *  - 받아들일 확률은 묻는 쪽의 정보로 범위가 되고, 판정에 쓰는 참값은 그 범위 안에 든다 · 정찰하면 좁아진다
 *  - 판정은 이름 붙은 주사위 — 같은 판·같은 명령이면 같은 답
 *  - 화친: 정한 계절까지 · AI 는 화친·동맹을 맺은 나라를 치지 않는다 · 끝나면 중립
 *  - 화친을 깨고 치면 전쟁, 남은 모든 나라와 한 칸씩 내려간다
 *  - 교역은 창고를 바꾸고, 조공 요구를 거절당하면 전쟁이다
 *  - 동맹의 땅은 지나갈 뿐 싸우지도 쥐지도 않는다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { decide } from '../../src/realm/ai.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { envoyChance, envoyChanceFor, envoyTrueChance, pairKey, relationOf } from '../../src/realm/diplomacy.ts'
import { advance, otherEnd, planned } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { EnvoyAsk, Order, Realm, ReportLine } from '../../src/realm/types.ts'

const ASKS: readonly EnvoyAsk[] = ['truce', 'trade', 'tribute', 'alliance']
const envoyLine = (lines: readonly ReportLine[]) => lines.find((l): l is Extract<ReportLine, { kind: 'envoy' }> => l.kind === 'envoy')
const envoy = (to: string, ask: EnvoyAsk, give = { grain: 0, iron: 0 }, take = { grain: 0, iron: 0 }): Order =>
  ({ kind: 'envoy', from: 'us', to, ask, give, take })

/** 사신이 받아들여지는 시드를 찾는다 (판정은 시드에 걸린 주사위다) */
function acceptedRun(setup: (r: Realm) => void, o: Order): { before: Realm; next: Realm; lines: readonly ReportLine[] } {
  for (let seed = 1; seed < 500; seed++) {
    const r = planned(byeonhanMini(seed), [])
    setup(r)
    const { next, report } = advance(r, [o])
    if (envoyLine(report.lines)?.accepted) return { before: r, next, lines: report.lines }
  }
  throw new Error('500 시드 안에 한 번도 받아들여지지 않았다')
}

describe('관계', () => {
  it('쌍마다 하나 · 처음엔 중립', () => {
    assert.equal(pairKey('us', 'guya'), pairKey('guya', 'us'))
    const r = byeonhanMini(1)
    assert.deepEqual(relationOf(r, 'us', 'guya'), { state: 'neutral', until: null })
  })

  it('먼저 치면 전쟁이 된다', () => {
    const r = planned(byeonhanMini(1), [])
    r.armies['a-us']!.at = 'wild-dolseom' // 돌섬에서 구야 국읍으로 (뱃길 e35)
    const { next, report } = advance(r, [{ kind: 'march', army: 'a-us', edge: 'e35', ambush: false }])
    assert.equal(relationOf(next, 'us', 'guya').state, 'war')
    assert.ok(report.lines.some((l) => l.kind === 'relation' && l.state === 'war'))
  })
})

describe('받아들일 확률', () => {
  it('범위는 [바닥, 천장] 안이고, 판정의 참값이 그 안에 든다 (첫 판, 모든 나라 · 모든 청)', () => {
    const r = byeonhanMini(1)
    for (const to of Object.keys(r.factions)) {
      if (to === 'us') continue
      for (const ask of ASKS) {
        const [lo, hi] = envoyChance(r, 'us', to, ask)
        const p = envoyTrueChance(r, 'us', to, ask, { grain: 0, iron: 0 }, { grain: 0, iron: 0 })
        assert.ok(P.realm.envoyMin <= lo && lo <= hi && hi <= P.realm.envoyMax, `${to} ${ask} ${lo}~${hi}`)
        assert.ok(lo - 1e-12 <= p && p <= hi + 1e-12, `${to} ${ask}: ${p} ∉ ${lo}~${hi}`)
      }
    }
  })

  it('정찰하면 범위가 좁아진다', () => {
    const r = byeonhanMini(1)
    const [lo0, hi0] = envoyChance(r, 'us', 'guya', 'truce')
    let s = r
    for (const node of ['guya-cap', 'guya-vil', 'guya-iron']) s = advance(s, [{ kind: 'scout', faction: 'us', node, hero: null }]).next
    const [lo1, hi1] = envoyChance(s, 'us', 'guya', 'truce')
    assert.ok(hi1 - lo1 < hi0 - lo0, `${lo0}~${hi0} → ${lo1}~${hi1}`)
  })

  it('교역은 그들이 얻는 몫이 클수록 잘 받는다', () => {
    const r = byeonhanMini(1)
    const fair = envoyChanceFor(r, 'us', 'miri', 'trade', { grain: 20, iron: 0 }, { grain: 20, iron: 0 })[0]
    const gift = envoyChanceFor(r, 'us', 'miri', 'trade', { grain: 60, iron: 0 }, { grain: 20, iron: 0 })[0]
    assert.ok(gift > fair)
  })

  it('같은 판·같은 명령이면 같은 답 · 상대 나라마다 한 계절에 사신 하나 · 플레이어에게 오는 사신은 없다', () => {
    const r = byeonhanMini(3)
    const o = [envoy('miri', 'truce'), envoy('anya', 'truce'), envoy('miri', 'alliance')]
    assert.deepEqual(advance(r, o), advance(r, o))
    // 미리미동·안야에 하나씩 — 미리미동에 보낸 둘째(동맹)는 버려진다
    const sent = advance(r, o).report.lines.filter((l) => l.kind === 'envoy')
    assert.equal(sent.length, 2)
    assert.deepEqual(sent.map((l) => (l as { to: string }).to).sort(), ['anya', 'miri'])
    const toPlayer: Order = { kind: 'envoy', from: 'guya', to: 'us', ask: 'tribute', give: { grain: 0, iron: 0 }, take: { grain: 50, iron: 0 } }
    assert.equal(advance(r, [toPlayer]).report.lines.filter((l) => l.kind === 'envoy').length, 0)
  })
})

describe('화친', () => {
  it(`받아들이면 ${P.realm.truceSeasons}계절 화친 · AI 는 그동안 치지 않는다 · 끝나면 중립`, () => {
    const { before, next } = acceptedRun(() => {}, envoy('guya', 'truce'))
    const rel = relationOf(next, 'us', 'guya')
    assert.equal(rel.state, 'truce')
    assert.equal(rel.until, before.season + P.realm.truceSeasons)
    // 유예가 끝난 뒤에도 구야는 우리 땅으로 오지 않는다
    let r = next
    r.season = P.realm.aiGrace + 1
    r.relations[pairKey('us', 'guya')]!.until = r.season + 6
    const ours = (x: Realm): Set<string> => new Set(Object.values(x.nodes).filter((n) => n.owner === 'us').map((n) => n.id))
    for (let s = 0; s < 6; s++) {
      // 약조 깨기는 따로 본다 (stance.test) — 여기서는 화친이 이어지는 동안 치지 않는지만
      const orders = decide(r, 'guya', 'greedy').filter((o) => !(o.kind === 'envoy' && o.ask === 'break'))
      const p = planned(r, orders)
      for (const o of orders) {
        if (o.kind !== 'march') continue
        assert.ok(!ours(r).has(otherEnd(r.edges[o.edge]!, p.armies[o.army]!.at)!), '화친 중에 우리 땅을 친다')
      }
      r = advance(r, orders).next
    }
    // 끝난다
    const { next: after, report } = advance(r, [])
    assert.equal(relationOf(after, 'us', 'guya').state, 'neutral')
    assert.ok(report.lines.some((l) => l.kind === 'relation' && l.state === 'neutral'))
  })

  it('화친을 깨고 치면 전쟁 · 남은 나라와는 한 칸씩 내려간다', () => {
    const r = planned(byeonhanMini(1), [])
    r.relations[pairKey('us', 'guya')] = { state: 'truce', until: 20 }
    r.relations[pairKey('us', 'miri')] = { state: 'ally', until: null }
    r.armies['a-us']!.at = 'wild-dolseom'
    const { next } = advance(r, [{ kind: 'march', army: 'a-us', edge: 'e35', ambush: false }])
    assert.equal(relationOf(next, 'us', 'guya').state, 'war')
    assert.equal(relationOf(next, 'us', 'miri').state, 'truce')
    assert.equal(relationOf(next, 'us', 'anya').state, 'war') // 중립 → 전쟁
  })
})

describe('교역 · 조공 · 동맹', () => {
  it('교역을 받아들이면 창고가 바뀐다', () => {
    const give = { grain: 60, iron: 0 }
    const take = { grain: 0, iron: 10 }
    const { before, next } = acceptedRun(() => {}, envoy('guya', 'trade', give, take))
    // 그 계절의 살림(군량·철 수입)을 빼고 사신의 몫만 본다 — 같은 판을 사신 없이 돌린 것과 비교
    const without = advance(before, []).next
    assert.equal(next.stock['us']!.grain, without.stock['us']!.grain - 60)
    assert.equal(next.stock['us']!.iron, without.stock['us']!.iron + 10)
    assert.equal(next.stock['guya']!.iron, without.stock['guya']!.iron - 10)
  })

  it('조공 요구를 거절당하면 전쟁이다', () => {
    for (let seed = 1; seed < 200; seed++) {
      const r = byeonhanMini(seed)
      const { next, report } = advance(r, [envoy('guya', 'tribute', { grain: 0, iron: 0 }, { grain: 50, iron: 0 })])
      if (envoyLine(report.lines)?.accepted === false) {
        assert.equal(relationOf(next, 'us', 'guya').state, 'war')
        return
      }
    }
    assert.fail('한 번도 거절당하지 않았다')
  })

  it('동맹의 땅은 지나간다 — 싸우지도 쥐지도 않는다', () => {
    const r = planned(byeonhanMini(1), [])
    r.relations[pairKey('us', 'goja')] = { state: 'ally', until: null }
    const { next, report } = advance(r, [{ kind: 'march', army: 'a-us', edge: 'e03', ambush: false }])
    assert.equal(report.lines.filter((l) => l.kind === 'battle').length, 0)
    assert.equal(next.nodes['goja-vil']!.owner, 'goja')
    assert.equal(next.armies['a-us']!.at, 'goja-vil')
  })
})
