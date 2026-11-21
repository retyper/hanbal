/**
 * 첫 진짜 판의 첫 위협 (docs/realm/FIRST-HOUR-20261122.md TOP 1)
 *  - 새내기 유예: 1장·1:1 판의 첫 해엔 우리가 새로 연 마을에 우리 군대가 없으면 남의 나라가 치지 않는다 (먼 길로 오던 군대는 돌아선다)
 *  - 처음부터 쥔 고을 · 군대가 선 고을 · 첫 해 뒤 · 유예가 긴 판은 예전대로
 *  - 적이 온다 예고: 이번 달 끝에 칠 적 · 저들 군사 범위가 참값을 품는다 · 지킬 가망은 판정과 같은 셈 · 답(보내기) · 결정론
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders, decide, spared } from '../../src/realm/ai.ts'
import { freshSpared } from '../../src/realm/grace.ts'
import { regionNations, startRegion } from '../../src/realm/data/regions/index.ts'
import { advance, forceOf, frontOdds } from '../../src/realm/season.ts'
import { headcount } from '../../src/realm/battle.ts'
import { threatsTo } from '../../src/realm/warn.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm } from '../../src/realm/types.ts'

/** 마한 판 — 한내 들을 우리가 새로 연 마을로 (군대 없음) */
function mahanWithNewVillage(seed = 1): Realm {
  const r = startRegion('mahan', seed, 'baekje')
  const n = r.nodes['mh-handeul']!
  n.owner = 'baekje'
  n.hh = 180
  n.foundedBy = 'baekje'
  n.takenAt = 2
  return r
}

describe('새내기 유예 — 첫 해엔 새로 연 빈 마을을 치지 않는다', () => {
  it('첫 해 · 1장 · 우리가 연 마을 · 우리 군대 없음 → 마한은 한내 들을 건너뛴다', () => {
    const r = mahanWithNewVillage()
    r.season = 6
    assert.equal(freshSpared(r, 'mokji', 'mh-handeul'), true)
    assert.equal(spared(r, 'mokji', 'mh-handeul'), true)
  })

  it('첫 해가 지나면 · 우리 군대가 서 있으면 · 처음부터 쥔 고을이면 · 남의 나라 마을이면 예전대로', () => {
    const r = mahanWithNewVillage()
    r.season = Math.round(P.realm.aiFreshGrace) * 3 // 달 시계 — 계절 넷이 지난 첫 달
    assert.equal(freshSpared(r, 'mokji', 'mh-handeul'), false, '첫 해 뒤')
    r.season = 6
    const a = Object.values(r.armies).find((x) => x.faction === 'baekje')!
    a.at = 'mh-handeul'
    assert.equal(freshSpared(r, 'mokji', 'mh-handeul'), false, '우리 군대가 선 곳은 깃발 싸움')
    a.at = 'mh-wirye-cap'
    assert.equal(freshSpared(r, 'mokji', 'mh-hannaru'), false, '처음부터 쥔 마을')
    assert.equal(freshSpared(r, 'baekje', 'mh-jinwi'), false, '남의 나라 마을 (우리가 치는 쪽)')
  })

  it('초반 유예가 긴 판(자유판의 aiGrace)엔 걸리지 않는다 — 그 판은 제 유예가 이미 첫 해를 덮는다', () => {
    const r = startRegion('yeongnam', 3, regionNations('yeongnam')[0]!)
    const foe = Object.keys(r.factions).find((f) => f !== r.player)!
    const mine = Object.values(r.nodes).find((n) => n.owner === r.player)!
    mine.foundedBy = r.player
    for (const a of Object.values(r.armies)) if (a.faction === r.player && a.at === mine.id) delete r.armies[a.id]
    assert.equal(freshSpared(r, foe, mine.id), false)
  })

  it('먼 길로 오던 군대 — 닿을 때 우리 군대가 떠나 비었으면 들어가지 않고 돌아선다', () => {
    const r = mahanWithNewVillage()
    r.season = 5
    const foe = r.armies['a-mh-front']!
    foe.march = { from: 'mh-jinwi', to: 'mh-handeul', edge: 'h06', left: 1, ambush: false, aim: 'baekje' }
    const { next, report } = advance(r, [])
    assert.ok(!report.lines.some((l) => l.kind === 'battle' && l.node === 'mh-handeul'), '싸움이 없다')
    assert.equal(next.nodes['mh-handeul']!.owner, 'baekje', '마을은 그대로')
    assert.ok(report.lines.some((l) => l.kind === 'recall' && l.node === 'mh-handeul'), '돌아섰다는 줄')
  })

  it('1장 10판(봇 신중) — 첫 해 안의 손쓸 수 없는 막다 짐(적 승률 0.9 이상)이 없다', () => {
    let hopeless = 0
    for (let seed = 1000; seed < 1010; seed++) {
      let r = startRegion('mahan', seed, 'baekje')
      for (let t = 0; t < 12; t++) {
        const { next, report } = advance(r, [...decide(r, 'baekje', 'cautious'), ...aiOrders(r)])
        for (const l of report.lines) if (l.kind === 'battle' && l.defender === 'baekje' && (l.outcome === 'win' || l.outcome === 'rout') && l.p >= 0.9) hopeless++
        r = next
      }
    }
    assert.equal(hopeless, 0)
  })
})

describe('적이 온다 예고 (realm/warn.ts)', () => {
  /** 마한 군대가 한내 들(첫 해가 지난 우리 새 마을) 앞에서 이번 달 끝에 치려고 모였다 */
  function poised(): Realm {
    const r = mahanWithNewVillage()
    r.season = 15
    const foe = r.armies['a-mh-front']!
    foe.strike = { node: 'mh-handeul', edge: 'h06', at: r.season, ambush: false }
    return r
  }

  it('채비한 적 — 저들 군사 범위가 참값을 품고, 지킬 가망은 판정과 같은 셈의 끝과 끝', () => {
    const r = poised()
    const th = threatsTo(r, 'baekje', () => true)
    assert.equal(th.length, 1)
    const x = th[0]!
    assert.equal(x.to, 'mh-handeul')
    assert.equal(x.foe, 'mokji')
    const men = headcount(forceOf(r, r.armies['a-mh-front']!))
    assert.ok(x.men[0] <= men && men <= x.men[1], `${x.men} ∋ ${men}`)
    const p = frontOdds(r, [{ army: r.armies['a-mh-front']!, edge: r.edges['h06']! }], 'mh-handeul')
    assert.ok(x.hold[0] <= 1 - p + 1e-9 && 1 - p <= x.hold[1] + 1e-9, `${x.hold} ∋ ${1 - p}`)
    assert.ok(x.hold[1] < 0.1, '군대 없는 새 마을은 거의 못 지킨다')
  })

  it('이번 달 안에 닿는 우리 군대가 있으면 「보내기」 — 보내면 가망이 오른다 · 같은 판이면 같은 예고 (결정론)', () => {
    const r = poised()
    const a = Object.values(r.armies).find((x) => x.faction === 'baekje')!
    a.at = 'mh-namhan'
    a.march = null
    const th = threatsTo(r, 'baekje', () => true)[0]!
    assert.ok(th.send !== null, '남한산에서 한 달 길')
    assert.equal(th.send!.army, a.id)
    assert.ok((th.send!.hold[0] + th.send!.hold[1]) / 2 > (th.hold[0] + th.hold[1]) / 2 + P.realm.warnSendGain - 1e-9)
    assert.deepEqual(threatsTo(r, 'baekje', () => true), threatsTo(r, 'baekje', () => true))
    // 그 군대가 이번 달 다른 명령을 받았으면 답으로 내지 않는다
    assert.ok(threatsTo(r, 'baekje', () => true, (id) => id === a.id).every((x) => x.send?.army !== a.id))
  })

  it('보이지 않는 곳에 모인 적은 알리지 않는다 · 배우는 판·끝난 판엔 없다', () => {
    const r = poised()
    assert.equal(threatsTo(r, 'baekje', (n) => n !== 'mh-jinwi').length, 0)
    r.outcome = { kind: 'win', season: r.season, path: 'conquest' }
    assert.equal(threatsTo(r, 'baekje', () => true).length, 0)
  })
})
