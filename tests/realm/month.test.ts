/**
 * 한 턴 = 한 달 (calendar.ts · docs/realm/TIME-TABLE-1031.md · 형 10-31)
 *  - 0 턴은 1년 3월(봄) · 여름은 6·7·8월 · 장마는 7·8월 · 해는 봄에 바뀐다
 *  - 새 판은 달 시계로 열고 길마다 지도 위 길이를 적는다 · 배우는 판은 계절 시계 그대로
 *  - 이웃 길은 대개 한 달 · 가장 먼 길도 석 달 안 · 장마 나루는 7·8월에만 막힌다
 *  - 계절마다 한 번 도는 일은 계절 끝 달에만 · 사건 카드는 계절의 첫 달에만
 *  - 징병 한도는 석 달이 한 장부 · 같은 씨앗이면 같은 판 (A1) · 옛 저장(clock 없음)은 옛 계절 판으로 돈다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  ageSeasons, blockedWhy, isMonsoon, isSeasonEnd, isSeasonStart, monthOf, perSeason, seasonEndTurn, seasonIdx, seasonOf, seasons, yearOf,
} from '../../src/realm/calendar.ts'
import { aiOrders, decide } from '../../src/realm/ai.ts'
import { regionNations, startRegion } from '../../src/realm/data/regions/index.ts'
import { seasonLabel, turnsLabel } from '../../src/realm/data/prose.ts'
import { draftLimit, spentThisSeason } from '../../src/realm/economy.ts'
import { advance, marchTurns } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm } from '../../src/realm/types.ts'

const month = (season: number): { season: number; clock: 'month' } => ({ season, clock: 'month' })

/** 달 시계를 걷어 낸 판 — 달 시계가 생기기 전의 저장과 같다 */
function oldSave(r: Realm): Realm {
  const x = structuredClone(r) as Realm & { clock?: string; roadKm?: unknown }
  delete x.clock
  delete x.roadKm
  return x
}

describe('달력', () => {
  it('0 턴은 1년 3월 봄 · 석 달마다 철이 바뀌고 봄에 해가 바뀐다', () => {
    assert.equal(monthOf(month(0)), 3)
    assert.equal(seasonOf(month(0)), 'spring')
    assert.equal(seasonOf(month(3)), 'summer')
    assert.equal(monthOf(month(3)), 6)
    assert.equal(seasonOf(month(9)), 'winter')
    assert.equal(monthOf(month(10)), 1)
    assert.equal(yearOf(month(11)), 0)
    assert.equal(yearOf(month(12)), 1)
    assert.equal(seasonIdx(month(14)), 4)
    assert.equal(seasonLabel(month(4)), '1년 7월 · 여름')
  })
  it('장마는 7·8월만 · 계절의 끝 달과 첫 달', () => {
    assert.deepEqual([3, 4, 5, 6].map((t) => isMonsoon(month(t))), [false, true, true, false])
    assert.deepEqual([0, 1, 2, 3].map((t) => isSeasonEnd(month(t))), [false, false, true, false])
    assert.deepEqual([0, 1, 2, 3].map((t) => isSeasonStart(month(t))), [true, false, false, true])
    assert.equal(seasonEndTurn(month(3)), 5)
    assert.equal(seasons(month(0), 2), 6)
    assert.equal(ageSeasons(month(9), 3), 2)
    assert.equal(turnsLabel(month(0), 2), '2달')
  })
  it('옛 판은 한 턴이 한 계절 그대로', () => {
    const c: { season: number; clock?: 'month' } = { season: 5 }
    assert.equal(perSeason(c), 1)
    assert.equal(seasonOf(c), 'summer')
    assert.equal(yearOf(c), 1)
    assert.ok(isSeasonEnd(c) && isSeasonStart(c) && isMonsoon(c))
    assert.equal(seasons(c, 2), 2)
    assert.equal(seasonLabel(c), '2년 여름')
    assert.equal(turnsLabel(c, 2), '2계절')
  })
})

describe('새 판은 달 시계', () => {
  it('자유판·장·배우는 판 모두 달 시계로 연다 (형 11-01)', () => {
    assert.equal(P.realm.monthClock, 1)
    const y = startRegion('yeongnam', 1, 'guya')
    assert.equal(y.clock, 'month')
    assert.equal(Object.keys(y.roadKm ?? {}).length, Object.keys(y.edges).length)
    assert.equal(startRegion('mahan', 1, 'baekje').clock, 'month')
    assert.equal(startRegion('tutorial', 1, 'baekje').clock, 'month')
  })
  it('이웃 길은 대개 한 달 · 가장 먼 길도 석 달 · 장마 나루는 7·8월에만 막힌다', () => {
    const r = startRegion('yeongnam', 1, 'guya')
    const spring = Object.values(r.edges).map((e) => marchTurns(r, e, 0))
    assert.ok(spring.every((m) => m >= 1 && m <= 3), `${Math.min(...spring)}~${Math.max(...spring)}`)
    assert.ok(spring.filter((m) => m === 1).length > spring.length / 2)
    const ford = Object.values(r.edges).find((e) => e.kind === 'ford')!
    assert.equal(blockedWhy(ford, r, 3), null) // 6월
    assert.equal(blockedWhy(ford, r, 4), 'summerFord') // 7월
    assert.equal(blockedWhy(ford, r, 6), null) // 9월
    assert.equal(marchTurns(r, ford, 4), marchTurns(r, ford, 0) + P.realm.marchSummerExtra)
  })
})

describe('달 시계의 박자', () => {
  it('함께한 턴은 달마다 · 정은 계절 끝 달에만 오른다 · 카드는 계절의 첫 달에만 편다', () => {
    let r = startRegion('yeongnam', 4, 'guya')
    const h = Object.values(r.heroes).find((x) => x.faction === 'guya' && x.status === 'free' && r.factions['guya']!.ruler !== x.id)!
    const served: number[] = []
    const bond: number[] = []
    for (let t = 0; t < 6; t++) {
      r = advance(r, []).next
      served.push(r.heroes[h.id]!.served ?? 0)
      bond.push(r.heroes[h.id]!.bond ?? 0)
      if (!isSeasonStart(r)) assert.ok(r.card === undefined || r.card === null || r.card.season !== r.season)
    }
    assert.deepEqual(served, [1, 2, 3, 4, 5, 6]) // 형 11-01: 「함께한 지 n달」
    assert.ok(bond[0] === bond[1] && bond[2]! > bond[1]! && bond[2] === bond[4] && bond[5]! > bond[4]!, String(bond))
  })
  it('징병 한도는 석 달이 한 장부 — 달마다 1/3씩 차오르고, 다음 계절에 다시 찬다', () => {
    let r = startRegion('yeongnam', 2, 'guya')
    while (seasonOf(r) !== 'autumn') r = advance(r, []).next
    const cap = r.factions['guya']!.capital
    r.stock['guya']!.grain = 100000
    const n = draftLimit(r, 'guya', cap, 'spear')
    assert.ok(n > 0)
    r = advance(r, [{ kind: 'draft', faction: 'guya', node: cap, unit: 'spear', n }]).next
    const m2 = draftLimit(r, 'guya', cap, 'spear') // 같은 계절 둘째 달 — 첫 달 몫을 다 썼어도 1/3 이 또 열린다
    assert.ok(m2 > 0 && m2 < n * 1.6, `${n} → ${m2}`)
    r = advance(r, [{ kind: 'draft', faction: 'guya', node: cap, unit: 'spear', n: m2 }]).next
    assert.ok(draftLimit(r, 'guya', cap, 'spear') < n * 1.6) // 끝 달 — 마지막 1/3 만
    r = advance(r, []).next // 겨울 첫 달
    assert.equal(seasonOf(r), 'winter')
    r.stock['guya']!.grain = 100000
    assert.equal(spentThisSeason(r, r.nodes[cap]!.drafted), 0) // 새 계절 — 장부가 비었다
  })
  it('같은 씨앗 같은 명령이면 같은 판 — 저장했다 불러도 같다 (A1)', () => {
    const run = (): Realm => {
      let r = startRegion('yeongnam', 7, 'guya')
      for (let t = 0; t < 15; t++) r = advance(r, [...decide(r, 'guya', 'planner'), ...aiOrders(r)]).next
      return r
    }
    const a = run()
    assert.deepEqual(a, run())
    const loaded = JSON.parse(JSON.stringify(a)) as Realm
    const o = [...decide(a, 'guya', 'planner'), ...aiOrders(a)]
    assert.deepEqual(advance(loaded, o), advance(a, o))
  })
  it('옛 저장(시계 없음)은 한 턴이 한 계절로 돈다', () => {
    let r = oldSave(startRegion('yeongnam', 4, 'guya'))
    const h = Object.values(r.heroes).find((x) => x.faction === 'guya' && x.status === 'free' && r.factions['guya']!.ruler !== x.id)!
    r = advance(r, []).next
    assert.equal(r.clock, undefined)
    assert.equal(seasonOf(r), 'summer')
    assert.equal(r.heroes[h.id]!.served, 1)
    const e = Object.values(r.edges).find((x) => x.kind === 'field')!
    assert.equal(marchTurns(r, e), 1 + P.realm.marchSummerExtra) // 옛 셈: 여름 들길 두 계절
  })
})

/** 길 하나는 한 달 (형 11-05: "존나 가까운데 왜 2달이나 걸리는지") — 장마가 아니면 이웃 고을은 다음 달에 닿는다 */
describe('가까운 길은 한 달', () => {
  it('영남·서라벌·구지봉 판의 길은 봄에 모두 한 달 · 마한 고개도 금현성 먼 고개 하나만 두 달', () => {
    for (const reg of ['yeongnam', 'seorabeol', 'gujibong'] as const) {
      const r = startRegion(reg, 7, regionNations(reg)[0]!)
      for (const e of Object.values(r.edges)) assert.equal(marchTurns(r, e, 0), 1, `${reg} ${e.id}`)
    }
    const m = startRegion('mahan', 7, regionNations('mahan')[0]!)
    assert.ok(Object.values(m.edges).filter((e) => marchTurns(m, e, 0) > 1).length <= 1)
  })
})

/** 이어 걷기 — 바로 잇는 길이 없어도 짧은 길 둘이면 한 달에 닿는다 · 화면 셈(goalReach)과 판정이 같다 (형 11-05: "지도에서는 가까운데 2달씩") */
describe('짧은 길은 이어 걷는다', () => {
  it('두 길을 거쳐 가는 가까운 곳이 화면에 한 달이면, 정말 한 달 뒤 그곳에 서 있다', async () => {
    const { goalReach } = await import('../../src/realm/goal.ts')
    let found = false
    for (const reg of ['yeongnam', 'gujibong', 'seorabeol'] as const) {
      const r = startRegion(reg, 7, regionNations(reg)[0]!)
      for (const a of Object.values(r.armies).filter((x) => x.faction === r.player && x.march === null)) {
        const reach = goalReach(r, r.player, a.at)
        const hit = [...reach.entries()].find(([to, x]) => x.hops >= 2 && x.seasons === 1 && (r.nodes[to]!.owner === r.player || r.nodes[to]!.owner === null) && r.nodes[to]!.kind !== 'sodo')
        if (hit === undefined) continue
        ;(r.armies[a.id] as { goal?: string | null }).goal = hit[0]
        const next = advance(r, []).next
        assert.equal(next.armies[a.id]?.at, hit[0], `${reg} ${a.at} → ${hit[0]}`)
        found = true
        break
      }
      if (found) break
    }
    assert.ok(found, '두 길 한 달짜리 쌍을 못 찾았다')
  })
})
