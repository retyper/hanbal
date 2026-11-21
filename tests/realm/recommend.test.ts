/**
 * 본편 추천 점 (ui/realm/recommend.ts · 형 11-18 「장수랑 열전에 추천 표시 자주 · 각성 조건 달성되면 무조건」)
 *  - 아무 일 없으면 아무것도 안 뜬다 · 배우는 판은 늘 0
 *  - 각성 조건 달성(옛 규칙: 시련이 열림 · 새 규칙: 불꽃은 찼는데 도깨비 도장이 없음 / 도장 둘로 깨어남)은 상한·끈 기록과 상관없이 뜬다
 *  - 가벼운 것(새 장수 · 안 싸워 본 장수 · 열전 금)은 recHeroMax 까지 · 끈 턴 동안은 안 뜬다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { startTutorial } from '../../src/realm/data/regions/tutorial.ts'
import { bustOf } from '../../src/realm/data/art.ts'
import { AWAKEN_ART } from '../../src/realm/data/awaken-art.ts'
import { DEX_AWOKE, DEX_DEMON } from '../../src/realm/person.ts'
import { recHeroes, recsOf, type RaidPeek, type RecBook } from '../../src/ui/realm/recommend.ts'
import { P, getParam, setParam } from '../../src/tune/params.ts'
import type { Realm } from '../../src/realm/types.ts'

const KEY = 'realm.ascendTrialOpen'
function withSwitch<T>(v: 0 | 1, f: () => T): T {
  const was = getParam(KEY)!
  setParam(KEY, v)
  try { return f() } finally { setParam(KEY, was) }
}
const book = (x: Partial<RecBook> = {}): RecBook => ({ known: [], fresh: [], quiet: {}, woke: [], ...x })
/** 모든 우리 장수가 열전 한 판씩은 깼고 금은 없다 — 가벼운 추천이 하나도 안 뜨는 바탕 */
const quietRaid = (r: Realm): RaidPeek => ({ cleared: Object.fromEntries(recHeroes(r, r.player, bustOf).map((h) => [h.id, ['forest']])), gold: 0, cheapest: 50 })
const awakeHero = (r: Realm) => recHeroes(r, r.player, bustOf).find((h) => AWAKEN_ART.has(bustOf(h.id) ?? ''))!

describe('추천 점', () => {
  it('아무 일 없으면 아무것도 안 뜬다', () => {
    const r = byeonhanMini(1)
    for (const v of [0, 1] as const) assert.deepEqual(withSwitch(v, () => recsOf(r, r.player, bustOf, {}, quietRaid(r), book())), [])
  })

  it('배우는 판에서는 늘 0', () => {
    const r = startTutorial(1)
    for (const h of Object.values(r.heroes)) if (h.faction === r.player) { h.trialReady = true; h.ascended = true }
    assert.deepEqual(recsOf(r, r.player, bustOf, {}, { cleared: {}, gold: 99999, cheapest: 1 }, book({ fresh: Object.keys(r.heroes) })), [])
  })

  it('새로 들어온 장수는 열전 카드로 · 상한까지만', () => {
    const r = byeonhanMini(1)
    const ids = recHeroes(r, r.player, bustOf).map((h) => h.id)
    assert.ok(ids.length >= 3, '우리 장수 셋 이상')
    const out = recsOf(r, r.player, bustOf, {}, quietRaid(r), book({ fresh: ids }))
    assert.equal(out.length, Math.round(P.realm.recHeroMax))
    assert.ok(out.every((x) => !x.hard && x.to === 'raid' && x.whys.includes('newbie')))
  })

  it('옛 규칙: 시련이 열린 장수는 무조건 · 시련 카드로', () => {
    const r = byeonhanMini(1)
    const h = awakeHero(r)
    h.trialReady = true
    const ids = recHeroes(r, r.player, bustOf).map((x) => x.id)
    const out = withSwitch(1, () => recsOf(r, r.player, bustOf, {}, { cleared: {}, gold: 99999, cheapest: 1 }, book({ fresh: ids, quiet: { untried: r.season, shop: r.season } })))
    assert.deepEqual(out[0], { id: h.id, whys: ['trial'], hard: true, to: 'trial' })
    assert.ok(out.length <= Math.max(1, Math.round(P.realm.recHeroMax)))
    h.trialCleared = true
    assert.ok(withSwitch(1, () => recsOf(r, r.player, bustOf, {}, quietRaid(r), book())).length === 0, '시련을 넘으면 꺼진다')
  })

  it('새 규칙: 불꽃은 찼는데 도깨비 도장이 없으면 목책으로 · 도장 둘로 깨어나면 초상 한 번', () => {
    const r = byeonhanMini(1)
    const h = awakeHero(r)
    h.ascended = true
    const a = withSwitch(0, () => recsOf(r, r.player, bustOf, {}, quietRaid(r), book()))
    assert.deepEqual(a, [{ id: h.id, whys: ['demon'], hard: true, to: 'raid' }])
    const dex = { [h.id]: { f: DEX_AWOKE | DEX_DEMON } }
    const b = withSwitch(0, () => recsOf(r, r.player, bustOf, dex, quietRaid(r), book()))
    assert.deepEqual(b, [{ id: h.id, whys: ['woke'], hard: true, to: 'pic' }])
    assert.deepEqual(withSwitch(0, () => recsOf(r, r.player, bustOf, dex, quietRaid(r), book({ woke: [h.id] }))), [], '한 번 보면 끝')
    // 옛 규칙에서는 도깨비 도장을 묻지 않는다
    assert.ok(withSwitch(1, () => recsOf(r, r.player, bustOf, {}, quietRaid(r), book())).every((x) => x.whys[0] !== 'demon'))
  })

  it('안 싸워 본 장수 하나 · 턴마다 돌아가고 · 들어가 보면 그 턴 동안 꺼진다', () => {
    const r = byeonhanMini(1)
    const raid: RaidPeek = { cleared: {}, gold: 0, cheapest: 50 }
    const one = recsOf(r, r.player, bustOf, {}, raid, book())
    assert.equal(one.length, 1)
    assert.deepEqual(one[0]!.whys, ['untried'])
    const next = recsOf({ ...r, season: r.season + 1 }, r.player, bustOf, {}, raid, book())
    assert.notEqual(next[0]!.id, one[0]!.id)
    assert.deepEqual(recsOf(r, r.player, bustOf, {}, raid, book({ quiet: { untried: r.season } })), [])
    assert.equal(recsOf({ ...r, season: r.season + Math.round(P.realm.recQuietTurns) }, r.player, bustOf, {}, raid, book({ quiet: { untried: r.season } })).length, 1)
  })

  it('열전 금이 쌓이면 가장 많이 데려간 장수로', () => {
    const r = byeonhanMini(1)
    const raid = quietRaid(r)
    const top = recHeroes(r, r.player, bustOf)[1]!.id
    const out = recsOf(r, r.player, bustOf, {}, { ...raid, cleared: { ...raid.cleared, [top]: ['forest', 'ford'] }, gold: 50 * P.realm.recShopMul }, book())
    assert.deepEqual(out, [{ id: top, whys: ['shop'], hard: false, to: 'raid' }])
    assert.deepEqual(recsOf(r, r.player, bustOf, {}, { ...raid, gold: 49 }, book()), [])
  })
})

// Explicit rollback coverage; 56-A product default stays off in awakening-persistence.test.ts.
setParam('realm.legacyAwakeningOpen', 1)
