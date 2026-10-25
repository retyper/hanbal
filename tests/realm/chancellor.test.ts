/**
 * 재상 — 쉬는 장수는 계절 끝에 재상이 일을 맡긴다 (형 2026-10-26: "쉬는 장수들 일일이 뭐 시키기가 너무 귀찮은데 …
 * 왕이 신하한테 명령을 한다면 하나하나 할 일 매 턴 알려주는 게 이상하잖아")
 *  - AI 와 플레이어의 재상이 같은 셈(heroes.idleHeroOrders)을 쓴다 — AI 는 제자리만, 재상은 더 멀리(far)
 *  - 장수 없는 군대에 장수를 붙이고, 고을지기 없는 고을에 앉힌다 · 도읍은 안 간다 · 직접 부리는 장수(skip)는 안 건드린다
 *  - 계절 보고에 「재상이 …」 한 줄 · 설정은 판(JSON)에 실려 넘어간다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { armyOfHero, idleHeroOrders, isRuler, postHero } from '../../src/realm/heroes.ts'
import { aiOrders } from '../../src/realm/ai.ts'
import { regionNations, startRegion } from '../../src/realm/data/regions/index.ts'
import { advance } from '../../src/realm/season.ts'
import { reportText } from '../../src/realm/data/prose.ts'
import type { Order, Realm } from '../../src/realm/types.ts'

/** 골포국 — 군주 해솔(도읍) · 매눈(군대) · 돌개(농사꾼, 도읍) · 잔물(도읍). 마을 둘(안개골·갈대울)은 고을지기가 없다 */
const mini = (): Realm => byeonhanMini(1)

describe('재상 — 쉬는 장수에게 일을 맡긴다', () => {
  it('고을지기 없는 우리 고을에 앉힌다 — 도읍은 안 가고, 농사꾼은 마을로, 같은 고을에 둘을 앉히지 않는다', () => {
    const os = idleHeroOrders(mini(), 'us', new Set(), true)
    const assigns = os.filter((o): o is Extract<Order, { kind: 'assign' }> => o.kind === 'assign')
    assert.deepEqual(assigns.map((o) => [o.hero, o.node]), [['us-1', 'our-east'], ['us-2', 'our-north']])
    assert.ok(os.every((o) => !(o.kind === 'assign' && o.node === 'our-cap')))
    assert.ok(os.every((o) => o.kind !== 'assign' || o.hero !== 'us-ruler'), '군주는 안 건드린다')
  })

  it('장수 없는 군대에는 싸움꾼이 먼저 붙는다', () => {
    const r = mini()
    r.armies['a-us']!.hero = null
    r.heroes['chief']!.at = 'our-cap'
    const os = idleHeroOrders(r, 'us', new Set(), true)
    assert.deepEqual(os.find((o) => o.kind === 'lead'), { kind: 'lead', hero: 'chief', army: 'a-us' })
    assert.equal(os.filter((o) => o.kind === 'lead').length, 1)
  })

  it('멀리 선 장수 없는 군대에도 우리 땅으로 이어져 있으면 간다', () => {
    const r = mini()
    const a = r.armies['a-us']!
    a.hero = null
    a.at = 'our-north'
    r.heroes['chief']!.at = 'our-cap'
    const os = idleHeroOrders(r, 'us', new Set(), true)
    assert.ok(os.some((o) => o.kind === 'lead' && o.hero === 'chief' && o.army === 'a-us'))
    // AI 의 셈(제자리만)은 멀리 가지 않는다
    assert.ok(!idleHeroOrders(r, 'us').some((o) => o.kind === 'lead'))
  })

  it('직접 부리는 장수는 건드리지 않는다', () => {
    const os = idleHeroOrders(mini(), 'us', new Set(['us-1']), true)
    assert.ok(!os.some((o) => (o.kind === 'assign' || o.kind === 'lead') && o.hero === 'us-1'))
    assert.ok(os.some((o) => o.kind === 'assign' && o.hero === 'us-2'))
  })

  it('맡을 고을이 없으면 쉰다 — 도읍에 앉히지 않는다', () => {
    const r = mini()
    r.nodes['our-north']!.owner = 'guya'
    r.nodes['our-east']!.owner = 'guya'
    assert.deepEqual(idleHeroOrders(r, 'us', new Set(), true), [])
    assert.deepEqual(idleHeroOrders(r, 'us'), [])
  })

  it('이미 고을지기가 있는 고을, 길에 있는 장수, 맡은 장수는 빼고 셈한다', () => {
    const r = mini()
    r.heroes['us-2']!.at = 'our-north'
    r.heroes['us-2']!.post = 'our-north'
    r.heroes['us-1']!.awayUntil = r.season
    assert.deepEqual(idleHeroOrders(r, 'us', new Set(), true), [])
  })

  it('같은 판이면 같은 답 — 결정론', () => {
    assert.deepEqual(idleHeroOrders(mini(), 'us', new Set(), true), idleHeroOrders(mini(), 'us', new Set(), true))
  })

  it('AI 의 셈은 예전 그대로 — 혼자 머무는 고을에 고을지기가 없으면 그 자리를 맡는다', () => {
    const r = mini()
    r.heroes['us-2']!.at = 'our-north'
    assert.deepEqual(idleHeroOrders(r, 'us'), [{ kind: 'assign', hero: 'us-2', node: 'our-north' }])
  })
})

/** 나누기 전 AI 의 셈 (ai.ts heroCare 의 앞부분) 그대로 — 새 함수가 AI 에게는 같은 답을 내는지 견준다 */
function oldAiHeroes(r: Realm, faction: string): Order[] {
  const sorted = <T extends { id: string }>(xs: Iterable<T>): T[] => [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const out: Order[] = []
  const mine = sorted(Object.values(r.heroes)).filter((h) => h.faction === faction && h.status === 'free')
  const taken = new Set<string>()
  for (const h of mine) {
    if (h.at === null || isRuler(r, h.id) || armyOfHero(r, h.id) !== null) continue
    const leaderless = sorted(Object.values(r.armies)).find((a) => a.faction === faction && a.at === h.at && a.march === null && a.hero === null && !taken.has(a.id))
    if (leaderless !== undefined && h.mu + h.tong >= h.chi + h.deok) {
      taken.add(leaderless.id)
      out.push({ kind: 'lead', hero: h.id, army: leaderless.id })
    } else if (h.post !== h.at && r.factions[faction]?.capital !== h.at && postHero(r, h.at)?.id === undefined) out.push({ kind: 'assign', hero: h.id, node: h.at })
  }
  return out
}

describe('AI 의 장수 셈은 나누기 전과 같다', () => {
  for (const region of ['byeonhan-mini', 'yeongnam'] as const) {
    it(`${region} — 열두 계절 동안 나라마다 같은 답`, () => {
      let r = startRegion(region, 7, regionNations(region)[0]!)
      let n = 0
      for (let s = 0; s < 12; s++) {
        for (const f of Object.keys(r.factions).sort()) {
          assert.deepEqual(idleHeroOrders(r, f), oldAiHeroes(r, f), `${region} ${s} ${f}`)
          n++
        }
        r = advance(r, aiOrders(r)).next
      }
      assert.ok(n > 0)
    })
  }
})

describe('재상 — 계절 보고와 저장', () => {
  it('재상이 맡긴 일은 보고에 「재상이 …」로 남는다 (멀리 보낸 것도)', () => {
    const before = mini()
    const { next, report } = advance(before, [
      { kind: 'assign', hero: 'us-1', node: 'our-east', by: 'chancellor' },
      { kind: 'assign', hero: 'us-2', node: 'our-cap', by: 'chancellor' }, // 도읍 — 엔진이 막는다, 보고도 없다
    ])
    const ls = report.lines.filter((l) => l.kind === 'chancellor')
    assert.equal(ls.length, 1)
    assert.equal(next.heroes['us-1']!.post, 'our-east')
    assert.equal(report.lines.filter((l) => l.kind === 'heroGo').length, 0, '길 떠난 줄은 재상의 줄이 함께 말한다')
    const text = reportText(before, next, ls[0]!, 'us')!
    assert.ok(text.startsWith('재상이 '), text)
    assert.ok(text.includes('갈대울 마을 고을지기로 보냈다'), text)
    assert.equal(reportText(before, next, ls[0]!, 'guya'), null)
  })

  it('군대를 맡긴 줄', () => {
    const before = mini()
    before.armies['a-us']!.hero = null
    before.heroes['chief']!.at = 'our-cap'
    const { next, report } = advance(before, [{ kind: 'lead', hero: 'chief', army: 'a-us', by: 'chancellor' }])
    const l = report.lines.find((x) => x.kind === 'chancellor')!
    const text = reportText(before, next, l, 'us')!
    assert.ok(text.startsWith('재상이 살해 매눈에게 골포 도읍의 군사 '), text)
  })

  it('재상 설정은 판에 실려 계절을 넘기고, JSON 으로 저장·불러오기 된다', () => {
    const r = mini()
    r.autoIdle = false
    r.manual = { us: ['us-1'] }
    const { next } = advance(r, [])
    assert.equal(next.autoIdle, false)
    assert.deepEqual(next.manual, { us: ['us-1'] })
    const back = JSON.parse(JSON.stringify(next)) as Realm
    assert.deepEqual(back.manual, { us: ['us-1'] })
    assert.equal(back.autoIdle, false)
  })
})
