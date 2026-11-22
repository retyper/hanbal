/**
 * 장수 열전은 장수마다 본편 한 달에 한 번 (realm/raid-month.ts · 형 11-19 「한 달에 장수들 열전 다 하고 다음 달」)
 *  - 11-22 형 「열전은 한 달에 한 캐릭터만 한 번」: 장수 전체에서도 한 달에 한 번 · 그 한 번은 지도 위 열전 표적(raid-bounty.ts)
 *  - 같은 달 두 번째 출전은 막힌다 · 다음 달에 풀린다 · 다른 장수는 따로 센다
 *  - 옛 저장(기록 없음 · 깨진 칸)은 깨지지 않고 열려 있다
 *  - 판의 셈은 이 기록을 읽지 않는다 (같은 명령이면 기록이 있든 없든 같은 다음 판)
 *  - 추천은 이번 달 나간 장수를 열전 카드로 권하지 않는다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { bustOf } from '../../src/realm/data/art.ts'
import { markRaid, raidCap, raidMonthCap, raidMonthHeroes, raidMonthOpen, raidOpen, raidUsed } from '../../src/realm/raid-month.ts'
import { grantRaidBounty, raidBounty, recentRaidWins, stageForNode, RAID_STAGES } from '../../src/realm/raid-bounty.ts'
import { advance } from '../../src/realm/season.ts'
import { recHeroes, recsOf, type RecBook } from '../../src/ui/realm/recommend.ts'
import { getParam, setParam } from '../../src/tune/params.ts'
import type { Realm } from '../../src/realm/types.ts'

const book = (x: Partial<RecBook> = {}): RecBook => ({ known: [], fresh: [], quiet: {}, woke: [], ...x })

describe('열전 한 달에 한 번', () => {
  it('기본은 장수마다 한 번 · 장수 전체도 한 번', () => { assert.equal(raidCap(), 1); assert.equal(raidMonthCap(), 1) })

  it('같은 달 두 번째 출전은 막히고 다음 달에 풀린다', () => {
    const r = byeonhanMini(1)
    const [a, b] = recHeroes(r, r.player, bustOf)
    assert.ok(a && b)
    assert.equal(raidOpen(r, a.id), true)
    markRaid(r, a.id)
    assert.equal(raidUsed(r, a.id), 1)
    assert.equal(raidOpen(r, a.id), false, '같은 달 두 번째는 막힘')
    assert.equal(raidOpen(r, b.id), false, '11-22: 한 달에 장수 전체에서 한 번 — 다른 장수도 이번 달은 닫힘')
    assert.equal(raidMonthOpen(r), false)
    assert.deepEqual(raidMonthHeroes(r), [a.id])
    const next = advance(r, []).next
    assert.equal(next.season, r.season + 1)
    assert.equal(raidOpen(next, a.id), true, '다음 달 풀림')
    markRaid(next, b.id)
    assert.deepEqual(Object.keys(next.raidRuns ?? {}), [b.id], '지난 달 기록은 걷힌다')
  })

  it('옛 저장 · 깨진 칸은 열려 있다', () => {
    const r = byeonhanMini(1)
    const id = recHeroes(r, r.player, bustOf)[0]!.id
    delete r.raidRuns
    assert.equal(raidOpen(r, id), true)
    for (const bad of [null, 'x', 3, { [id]: null }, { [id]: { t: 'a', n: 1 } }, { [id]: { t: r.season } }]) {
      ;(r as unknown as { raidRuns: unknown }).raidRuns = bad
      assert.equal(raidOpen(r, id), true, JSON.stringify(bad))
    }
    ;(r as unknown as { raidRuns: unknown }).raidRuns = { [id]: null }
    markRaid(r, id)
    assert.equal(raidOpen(r, id), false)
  })

  it('한 달에 두 번으로 바꾸면 두 번째까지 열린다 (params)', () => {
    const was = getParam('realm.raidPerMonth')!, wasAll = getParam('realm.raidMonthAll')!
    setParam('realm.raidPerMonth', 2); setParam('realm.raidMonthAll', 3)
    try {
      const r = byeonhanMini(1), [a, b] = recHeroes(r, r.player, bustOf)
      markRaid(r, a!.id); assert.equal(raidOpen(r, a!.id), true)
      markRaid(r, a!.id); assert.equal(raidOpen(r, a!.id), false, '장수마다 두 번')
      assert.equal(raidOpen(r, b!.id), true, '전체 셋 중 둘 썼다')
      markRaid(r, b!.id); assert.equal(raidOpen(r, b!.id), false, '전체 셋을 다 썼다')
    } finally { setParam('realm.raidPerMonth', was); setParam('realm.raidMonthAll', wasAll) }
  })

  it('판의 셈은 기록을 읽지 않는다', () => {
    const a = byeonhanMini(3), b = byeonhanMini(3)
    for (const h of recHeroes(b, b.player, bustOf)) markRaid(b, h.id)
    const na = advance(a, []).next, nb = advance(b, []).next as Realm
    const strip = (x: Realm) => { const c = structuredClone(x); delete c.raidRuns; return JSON.stringify(c) }
    assert.equal(strip(na), strip(nb))
  })

  it('추천: 이번 달 나간 장수는 열전 카드로 권하지 않는다 · 다음 달엔 다시', () => {
    const r = byeonhanMini(1)
    const ids = recHeroes(r, r.player, bustOf).map((h) => h.id)
    const peek = { cleared: {}, gold: 0, cheapest: 50 }
    const before = recsOf(r, r.player, bustOf, {}, peek, book({ fresh: ids }))
    assert.ok(before.length > 0)
    for (const x of before) markRaid(r, x.id)
    const after = recsOf(r, r.player, bustOf, {}, peek, book({ fresh: ids }))
    assert.ok(after.every((x) => raidOpen(r, x.id)), '나간 장수 없음')
    assert.ok(after.every((x) => !before.some((y) => y.id === x.id)))
    const later = advance(r, []).next
    const back = recsOf(later, later.player, bustOf, {}, peek, book({ fresh: ids }))
    assert.ok(back.some((x) => before.some((y) => y.id === x.id)), '다음 달 다시 뜬다')
  })

  it('열전 표적: 같은 판 같은 달이면 늘 같다 · 우리 고을은 아니다 · 스테이지는 다섯 가운데', () => {
    const r = byeonhanMini(1)
    const b1 = raidBounty(r), b2 = raidBounty(structuredClone(r))
    assert.ok(b1 !== null)
    assert.deepEqual(b1, b2)
    assert.notEqual(r.nodes[b1.node]!.owner, r.player)
    assert.ok(RAID_STAGES.includes(b1.stage))
    assert.equal(b1.stage, stageForNode(r, r.nodes[b1.node]!))
    // 달이 바뀌어도 표적은 하나 · 판을 여러 달 넘겨도 늘 남의 고을
    let x: Realm = r
    for (let i = 0; i < 6; i++) { x = advance(x, []).next; const b = raidBounty(x); assert.ok(b === null || x.nodes[b.node]!.owner !== x.player) }
  })

  it('열전 표적을 깨면 곡식·쇠가 들고 평정 깃발 · 같은 달 두 번은 안 준다 · 평정한 고을은 표적에서 빠진다', () => {
    const r = byeonhanMini(1)
    const b = raidBounty(r)!, hero = recHeroes(r, r.player, bustOf)[0]!.id
    const before = { ...r.stock[r.player]! }
    const got = grantRaidBounty(r, hero, b)
    assert.ok(got !== null && got.grain > 0 && got.iron > 0)
    assert.equal(r.stock[r.player]!.grain, before.grain + got.grain)
    assert.equal(r.stock[r.player]!.iron, before.iron + got.iron)
    assert.equal(grantRaidBounty(r, hero, b), null, '같은 달 같은 고을은 한 번')
    assert.deepEqual(recentRaidWins(r).map((w) => w.node), [b.node])
    const after = raidBounty(r)
    assert.ok(after === null || after.node !== b.node, '평정한 고을은 표적에서 빠진다')
  })

  it('판의 셈은 평정 기록을 읽지 않는다', () => {
    const a = byeonhanMini(3), b = byeonhanMini(3)
    grantRaidBounty(b, recHeroes(b, b.player, bustOf)[0]!.id, raidBounty(b)!)
    const strip = (x: Realm) => { const c = structuredClone(x) as Partial<Realm>; delete c.raidWins; delete c.stock; return JSON.stringify(c) }
    assert.equal(strip(advance(a, []).next), strip(advance(b, []).next))
  })
})
