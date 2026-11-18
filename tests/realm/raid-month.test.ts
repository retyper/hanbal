/**
 * 장수 열전은 장수마다 본편 한 달에 한 번 (realm/raid-month.ts · 형 11-19 「한 달에 장수들 열전 다 하고 다음 달」)
 *  - 같은 달 두 번째 출전은 막힌다 · 다음 달에 풀린다 · 다른 장수는 따로 센다
 *  - 옛 저장(기록 없음 · 깨진 칸)은 깨지지 않고 열려 있다
 *  - 판의 셈은 이 기록을 읽지 않는다 (같은 명령이면 기록이 있든 없든 같은 다음 판)
 *  - 추천은 이번 달 나간 장수를 열전 카드로 권하지 않는다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { bustOf } from '../../src/realm/data/art.ts'
import { markRaid, raidCap, raidOpen, raidUsed } from '../../src/realm/raid-month.ts'
import { advance } from '../../src/realm/season.ts'
import { recHeroes, recsOf, type RecBook } from '../../src/ui/realm/recommend.ts'
import { getParam, setParam } from '../../src/tune/params.ts'
import type { Realm } from '../../src/realm/types.ts'

const book = (x: Partial<RecBook> = {}): RecBook => ({ known: [], fresh: [], quiet: {}, woke: [], ...x })

describe('열전 한 달에 한 번', () => {
  it('기본은 한 번', () => assert.equal(raidCap(), 1))

  it('같은 달 두 번째 출전은 막히고 다음 달에 풀린다', () => {
    const r = byeonhanMini(1)
    const [a, b] = recHeroes(r, r.player, bustOf)
    assert.ok(a && b)
    assert.equal(raidOpen(r, a.id), true)
    markRaid(r, a.id)
    assert.equal(raidUsed(r, a.id), 1)
    assert.equal(raidOpen(r, a.id), false, '같은 달 두 번째는 막힘')
    assert.equal(raidOpen(r, b.id), true, '다른 장수는 따로')
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
    const was = getParam('realm.raidPerMonth')!
    setParam('realm.raidPerMonth', 2)
    try {
      const r = byeonhanMini(1), id = recHeroes(r, r.player, bustOf)[0]!.id
      markRaid(r, id); assert.equal(raidOpen(r, id), true)
      markRaid(r, id); assert.equal(raidOpen(r, id), false)
    } finally { setParam('realm.raidPerMonth', was) }
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
})
