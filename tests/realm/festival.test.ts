/**
 * 제천 대회 (festival.ts · docs/realm/CAPITAL.md §1-3 · 카드 P3)
 *  - 궁궐 3단 아래: 옛 하늘 제사(skyfest · 고름 둘) 그대로, 제천 대회는 열리지 않는다
 *  - 3단 이상: 그 나라 결의 달에만(부여 정월 · 그 밖 시월) 해마다 한 번 — 옛 skyfest 카드가 grand 로 큰다
 *  - 고름 셋: 활쏘기(명궁이 찾아옴 + 이웃 호감) · 장수 겨루기(마음이 기욺 + 사기) · 노래와 춤(가호 + 정) · 천군 덤 · 놀이 결과는 Order(held)에
 *  - 결정론
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { advance } from '../../src/realm/season.ts'
import { cardPreview } from '../../src/realm/events.ts'
import { festCard, festDue, festMonth, festName, festNextIn, festOpen, festSeatMul, stepFestival } from '../../src/realm/festival.ts'
import { cardFallback, cardInfo } from '../../src/realm/data/cards.ts'
import { poolPrice, resistOf } from '../../src/realm/heroes.ts'
import { monthOf } from '../../src/realm/calendar.ts'
import { P } from '../../src/tune/params.ts'
import type { Card, Order, Realm, ReportLine } from '../../src/realm/types.ts'

type CardLine = Extract<ReportLine, { kind: 'card' }>

/** 3단 궁궐을 쥔 판 · 가을(옛 판 2번째 턴 = 시월)로 */
function fest(tier: 1 | 2 | 3 | 4 = 3, season = 2): Realm {
  const r = byeonhanMini(1)
  r.factions['us']!.palace = { tier, stage: 0 }
  r.season = season
  return r
}
const pick = (n: 0 | 1 | 2, held?: number): Order => ({ kind: 'card', faction: 'us', pick: n, ...(held !== undefined ? { held } : {}) })

describe('제천 대회 · 때', () => {
  it('결마다 달이 다르다 — 부여 정월 · 그 밖 시월 (결을 모르면 시월)', () => {
    assert.equal(festMonth('buyeo'), 1)
    assert.equal(festMonth('goguryeo'), 10)
    assert.equal(festMonth('bullae'), 10)
    assert.equal(festMonth('us'), 10)
    assert.equal(festName('buyeo'), '영고')
    assert.equal(festName('goguryeo'), '동맹')
    assert.equal(festName('bullae'), '무천')
  })

  it('궁궐 3단 아래에서는 열리지 않는다 · 옛 하늘 제사 카드는 고름 둘 그대로', () => {
    for (const t of [1, 2] as const) {
      const r = fest(t)
      assert.equal(festOpen(r, 'us'), false)
      assert.equal(festDue(r), false)
      stepFestival(r)
      assert.equal(r.card ?? null, null)
    }
    const old: Card = { kind: 'skyfest', season: 0 }
    assert.equal(cardInfo(old).opts.length, 2)
    assert.equal(cardFallback('skyfest'), 0)
    const p = cardPreview(byeonhanMini(1), old, 0)!
    assert.ok((p.sure.grain ?? 0) < 0)
  })

  it('3단 이상 · 시월에만 열린다 · 같은 해에 두 번은 없다', () => {
    const r = fest(3, 2)
    assert.equal(monthOf(r), 10)
    assert.equal(festDue(r), true)
    stepFestival(r)
    assert.equal(r.card?.kind, 'skyfest')
    assert.equal(r.card?.grand, true)
    assert.equal(r.card?.season, 2)
    assert.equal(festNextIn(r, 'us'), 0)
    r.card = null
    assert.equal(festDue(r), false)
    assert.equal(festNextIn(r, 'us'), 12)
    // 다른 철에는 안 열린다
    for (const s of [0, 1, 3]) { const q = fest(3, s); stepFestival(q); assert.equal(q.card ?? null, null) }
    // 이듬해 시월에는 다시
    const next = fest(4, 6)
    stepFestival(next)
    assert.equal(next.card?.grand, true)
  })

  it('달 시계에서도 그 달에만 — 시월 한 번', () => {
    const hits: number[] = []
    for (let t = 0; t < 24; t++) {
      const r = fest(3, t)
      ;(r as { clock?: 'month' }).clock = 'month'
      stepFestival(r)
      if (r.card?.grand === true) hits.push(monthOf(r))
    }
    assert.deepEqual(hits, [10, 10])
  })

  it('다음 제천 대회까지 몇 달 — 열 수 없으면 null', () => {
    assert.equal(festNextIn(fest(2, 2), 'us'), null)
    assert.equal(festNextIn(fest(3, 0), 'us'), 6) // 4월 → 10월
    assert.equal(festNextIn(fest(3, 1), 'us'), 3) // 7월 → 10월
  })

  it('배우는 판에는 없다', () => {
    const r = fest(3, 2)
    r.region = 'tutorial'
    assert.equal(festDue(r), false)
  })
})

describe('제천 대회 · 고르기 셋', () => {
  it('카드는 우리 장수와 이웃 장수 · 명궁 · 이웃 나라를 미리 정해 든다', () => {
    const c = festCard(fest(), 'us', 2)
    assert.equal(c.grand, true)
    assert.ok(c.hero !== undefined && c.hero2 !== undefined, '겨룰 둘')
    assert.notEqual(byeonhanMini(1).heroes[c.hero!]?.faction, byeonhanMini(1).heroes[c.hero2!]?.faction)
    assert.ok(c.guest !== undefined)
    assert.equal(cardInfo(c).opts.length, 3)
    assert.equal(cardFallback('skyfest', true), 2) // 안 고르면 노래와 춤
  })

  it('노래와 춤 — 놀이 없이 가호 + 장수 정 +', () => {
    const r = fest()
    const c = festCard(r, 'us', 2)
    const p = cardPreview(r, c, 2)!
    assert.equal(p.hand, undefined)
    assert.ok((p.sure.bond ?? 0) > 0)
    assert.ok((p.sure.gain?.[0]?.[1] ?? 0) > 0)
  })

  it('활쏘기 — 쏘기 전엔 hand · 맞히면 명궁이 찾아오고 이웃 호감 · 빗나가면 호감 반쪽', () => {
    const r = fest()
    const c = festCard(r, 'us', 2)
    assert.equal(cardPreview(r, c, 0)!.hand, true)
    const win = cardPreview(r, c, 0, undefined, 1)!
    assert.equal(win.good, true)
    assert.equal(win.sure.wander, c.guest)
    assert.ok((win.sure.favor?.[0]?.d ?? 0) > 0)
    const lose = cardPreview(r, c, 0, undefined, 0)!
    assert.equal(lose.good, false)
    assert.equal(lose.sure.wander, undefined)
    assert.ok((lose.sure.favor?.[0]?.d ?? 0) < (win.sure.favor?.[0]?.d ?? 0))
  })

  it('장수 겨루기 — 이기면 마음이 기울고 사기가 오른다 · 지면 사기가 조금 준다', () => {
    const r = fest()
    const c = festCard(r, 'us', 2)
    assert.equal(cardPreview(r, c, 1)!.hand, true)
    const win = cardPreview(r, c, 1, undefined, 1)!
    assert.equal(win.sure.lean?.[0], c.hero2)
    assert.ok((win.sure.lean?.[1] ?? 0) > 0)
    assert.ok((win.sure.morale ?? 0) > 0)
    const lose = cardPreview(r, c, 1, undefined, 0)!
    assert.ok((lose.sure.morale ?? 0) < 0)
    assert.equal(lose.sure.lean, undefined)
  })

  it('겨룰 장수가 없으면 장수 겨루기는 노래와 춤으로', () => {
    const r = fest()
    const c: Card = { kind: 'skyfest', season: 2, grand: true }
    const p = cardPreview(r, c, 1)!
    assert.equal(p.hand, undefined)
    assert.ok((p.sure.bond ?? 0) > 0)
  })
})

describe('제천 대회 · 천군 덤', () => {
  it('천군이 앉았으면 보상이 커진다 — 덕이 높을수록', () => {
    const r = fest()
    const c = festCard(r, 'us', 2)
    const base = cardPreview(r, c, 1, undefined, 1)!.sure.morale!
    const song0 = cardPreview(r, c, 2)!.sure.bond!
    const seated = fest()
    seated.heroes['us-1']!.deok = 10
    seated.factions['us']!.seats = { priest: 'us-1' }
    assert.ok(festSeatMul(seated, 'us') > 1)
    assert.equal(festSeatMul(r, 'us'), 1)
    assert.ok(cardPreview(seated, c, 1, undefined, 1)!.sure.morale! > base)
    assert.ok(cardPreview(seated, c, 2)!.sure.bond! > song0)
    assert.equal(festSeatMul(seated, 'us'), 1 + 10 * P.realm.festSeatMul)
  })
})

describe('제천 대회 · 판에 걸리고 기록된다', () => {
  const run = (orders: Order[], r0: Realm = fest()): { r: Realm; line: CardLine | undefined } => {
    stepFestival(r0)
    const out = advance(r0, orders)
    const line = out.report.lines.find((l): l is CardLine => l.kind === 'card')
    return { r: out.next, line }
  }

  it('활쏘기에서 맞히면 명궁이 도읍에 떠돌이로 온다 · 값이 낮다', () => {
    const r0 = fest()
    const guest = festCard(r0, 'us', 2).guest!
    const { r, line } = run([pick(0, 1)], r0)
    const w = (r.wanderers ?? []).find((x) => x.hero.id === guest)
    assert.ok(w !== undefined, '명궁이 찾아왔다')
    assert.equal(w!.node, 'our-cap')
    assert.ok(w!.price < poolPrice(w!.hero))
    assert.equal(line?.grand, true)
    assert.equal(line?.good, true)
    assert.equal(line?.held, 1)
    assert.ok((r.poolUsed ?? []).includes(guest))
  })

  it('활쏘기에서 빗나가면 명궁은 안 온다', () => {
    const r0 = fest()
    const guest = festCard(r0, 'us', 2).guest!
    const { r, line } = run([pick(0, 0)], r0)
    assert.ok(!(r.wanderers ?? []).some((x) => x.hero.id === guest))
    assert.equal(line?.good, false)
  })

  it('장수 겨루기에서 이기면 그 장수의 마음의 벽이 낮아진다', () => {
    const r0 = fest()
    const foe = festCard(r0, 'us', 2).hero2!
    const before = resistOf(r0, foe)
    const { r, line } = run([pick(1, 1)], r0)
    assert.equal(r.heroes[foe]!.lean, P.realm.festDuelLean)
    assert.ok(resistOf(r, foe) < before)
    assert.equal(line?.good, true)
  })

  it('놀이를 안 쏘고(held 없이) 활쏘기·장수 겨루기를 골랐으면 노래와 춤으로', () => {
    const r0 = fest()
    const hh = r0.nodes['our-cap']!.hh
    const { r, line } = run([pick(0)], r0)
    assert.equal(line?.good, undefined)
    assert.ok(r.nodes['our-cap']!.hh >= hh)
  })

  it('안 고르면 노래와 춤 — 놀이 없이', () => {
    const { line } = run([])
    assert.equal(line?.pick, 2)
    assert.equal(line?.grand, true)
  })

  it('결정론 — 같은 판 · 같은 결과면 같은 판이 된다', () => {
    const a = run([pick(1, 1)])
    const b = run([pick(1, 1)])
    assert.deepEqual(a.r, b.r)
    assert.deepEqual(a.line, b.line)
  })

  it('한 해에 한 번 — 연 뒤 다음 달들은 카드가 안 선다', () => {
    const r0 = fest()
    stepFestival(r0)
    const out = advance(r0, []).next
    assert.equal(out.festYear, 0)
    stepFestival(out)
    assert.equal(out.card ?? null, null)
  })
})
