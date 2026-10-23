/**
 * 원정 (src/realm/expedition.ts · SYSTEMS §15-4 · 슬롯 ⑩ · 팰 파견)
 *
 *  - 보낼 수 있는 이: 우리 장수 · 군주 아님 · 이미 원정 아님 · 바닷길은 포구가 있어야 · 길 양식 · 한꺼번에 expMax 까지
 *  - 가 있는 동안 판에 없다 (고을·군대에서 빠진다) · 돌아오면 도읍에 · 얻은 것이 창고에 · 떠날 때 정해진 대로
 *  - 몫은 합이 1 · 좋은 장수·긴 길일수록 빈손이 준다 · 같은 판이면 같은 결과
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { EXP_SEASONS, expBlock, expOdds, onExpedition } from '../../src/realm/expedition.ts'
import { armyOfHero } from '../../src/realm/heroes.ts'
import { advance } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, Realm, ReportLine } from '../../src/realm/types.ts'

const pass = (r: Realm, orders: Order[] = []): { next: Realm; lines: readonly ReportLine[] } => {
  const { next, report } = advance(r, orders)
  return { next, lines: report.lines }
}
const general = (r: Realm): string =>
  Object.values(r.heroes).filter((h) => h.faction === r.player && !h.id.endsWith('-ruler') && h.status === 'free').sort((a, b) => (a.id < b.id ? -1 : 1))[0]!.id

describe('원정 — 보내기', () => {
  it('군주는 못 간다 · 바닷길은 포구가 있어야 · 길 양식이 있어야', () => {
    const r = byeonhanMini(4)
    r.stock[r.player]!.grain = 1000
    const ruler = r.factions[r.player]!.ruler!
    assert.notEqual(expBlock(r, r.player, ruler, 'hills', 0), null)
    const g = general(r)
    assert.equal(expBlock(r, r.player, g, 'hills', 0), null)
    const hasPort = Object.values(r.nodes).some((n) => n.owner === r.player && n.kind === 'port')
    assert.equal(expBlock(r, r.player, g, 'wa', 0) === null, hasPort)
    r.stock[r.player]!.grain = 0
    assert.notEqual(expBlock(r, r.player, g, 'hills', 0), null)
  })

  it('떠나면 판에 없다 — 군대에서 빠지고, 길 양식이 들고, 정해진 계절에 돌아온다', () => {
    let r = byeonhanMini(4)
    r.stock[r.player]!.grain = 1000
    const g = general(r)
    const s = pass(r, [{ kind: 'expedition', faction: r.player, hero: g, dest: 'hills', len: 1 }])
    r = s.next
    assert.ok(s.lines.some((l) => l.kind === 'expGo'))
    assert.ok(onExpedition(r, g) !== undefined)
    assert.equal(r.heroes[g]!.at, null)
    assert.equal(armyOfHero(r, g), null)
    const got = onExpedition(r, g)!.got
    let back: Extract<ReportLine, { kind: 'expBack' }> | undefined
    for (let i = 0; i < EXP_SEASONS[1] + 1 && back === undefined; i++) {
      r.stock[r.player]!.grain = 1000
      const t = pass(r)
      r = t.next
      back = t.lines.find((l): l is Extract<ReportLine, { kind: 'expBack' }> => l.kind === 'expBack')
      // 가 있는 동안엔 자리가 없다
      if (back === undefined) assert.equal(r.heroes[g]!.at, null)
    }
    assert.ok(back !== undefined, '돌아와야 한다')
    assert.equal(onExpedition(r, g), undefined)
    assert.ok(r.heroes[g]!.at !== null)
    if (got.kind === 'wanderer' && back.got.kind === 'wanderer') assert.equal(r.heroes[got.hero]!.faction, r.player)
    if (got.kind === 'skill' && back.got.kind === 'skill') assert.ok(r.heroes[g]!.traits.includes(got.trait))
  })

  it('한꺼번에 expMax 까지', () => {
    const r = byeonhanMini(4)
    r.stock[r.player]!.grain = 10_000
    const g = general(r)
    r.expeditions = Array.from({ length: P.realm.expMax }, (_, i) => ({ hero: `x${i}`, faction: r.player, dest: 'hills' as const, len: 0 as const, back: 99, got: { kind: 'none' as const } }))
    assert.notEqual(expBlock(r, r.player, g, 'hills', 0), null)
  })
})

describe('원정 — 몫', () => {
  it('합이 1 · 좋은 장수와 긴 길일수록 빈손이 준다', () => {
    const r = byeonhanMini(4)
    const h = r.heroes[general(r)]!
    for (const d of ['wa', 'juho', 'neukdo', 'hills'] as const) {
      for (const len of [0, 1, 2] as const) {
        const o = expOdds(h, d, len)
        const sum = Object.values(o).reduce((a, b) => a + b, 0)
        assert.ok(Math.abs(sum - 1) < 1e-9)
      }
      assert.ok(expOdds(h, d, 2).none < expOdds(h, d, 0).none)
    }
    const weak = { ...h, mu: 1, ryak: 1, deok: 1 }
    const strong = { ...h, mu: 10, ryak: 10, deok: 10 }
    assert.ok(expOdds(strong, 'hills', 1).none < expOdds(weak, 'hills', 1).none)
  })

  it('같은 판이면 같은 결과', () => {
    const go = (): unknown => {
      const r = byeonhanMini(9)
      r.stock[r.player]!.grain = 1000
      const g = general(r)
      return onExpedition(pass(r, [{ kind: 'expedition', faction: r.player, hero: g, dest: 'hills', len: 2 }]).next, g)?.got
    }
    assert.deepEqual(go(), go())
  })
})
