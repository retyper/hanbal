/**
 * 사건 카드 · 점괘 (src/realm/events.ts · SYSTEMS §9 · 슬롯 ⑦ ⑧)
 *
 *  - 카드는 한 계절 앞서 뽑아 둔다 — 같은 판·같은 계절이면 같은 카드 · 배우는 판엔 없다
 *  - 답하지 않으면 첫째 · 둘째를 고르면 그 결과 · 카드는 한 번 답하면 사라진다
 *  - 가뭄·풍년은 그해 가을걷이 배수를 건다 · 장수 다툼은 편든 쪽 정이 오른다
 *  - 점괘: 제사를 지낸 계절엔 다음 카드를 엿본다 (맞을 때도 틀릴 때도)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import { cardValid, drawCard, resolveCard } from '../../src/realm/events.ts'
import { bondOf } from '../../src/realm/heroes.ts'
import { advance } from '../../src/realm/season.ts'
import type { Card, Realm, ReportLine } from '../../src/realm/types.ts'

const lines = (): ReportLine[] => []

describe('사건 — 뽑기', () => {
  it('같은 판·같은 계절이면 같은 카드 · 배우는 판엔 없다', () => {
    for (let s = 0; s < 12; s++) assert.deepEqual(drawCard(byeonhanMini(5), s), drawCard(byeonhanMini(5), s))
    const t = startRegion('tutorial', 1, 'us')
    for (let s = 0; s < 12; s++) assert.equal(drawCard(t, s), null)
  })

  it('여러 판이면 여러 가지가 온다 · 뽑힌 카드는 그때 펼 수 있다', () => {
    const kinds = new Set<string>()
    for (let seed = 1; seed <= 60; seed++) {
      const r = byeonhanMini(seed)
      for (let s = 0; s < 8; s++) {
        const c = drawCard(r, s)
        if (c === null) continue
        kinds.add(c.kind)
        if (c.season === r.season) assert.ok(cardValid(r, c), `${seed} ${s} ${c.kind}`)
      }
    }
    assert.ok(kinds.size >= 6, [...kinds].join(','))
  })

  it('계절을 넘기면 카드가 펴지고 다음 카드가 뽑혀 있다', () => {
    let r = byeonhanMini(3)
    let seen = 0
    for (let i = 0; i < 12; i++) {
      r = advance(r, []).next
      assert.ok(r.cardNext === null || r.cardNext?.season === r.season + 1)
      if (r.card != null) { seen++; assert.equal(r.card.season, r.season) }
    }
    assert.ok(seen > 0, '열두 계절에 카드가 한 장은 와야 한다')
  })
})

describe('사건 — 답', () => {
  const withCard = (card: Card): Realm => {
    const r = byeonhanMini(3)
    r.card = card
    return r
  }

  it('답하지 않으면 첫째 · 카드는 한 번 답하면 사라진다', () => {
    const r = withCard({ kind: 'drought', season: 0 })
    const out = lines()
    resolveCard(r, [], out)
    const l = out.find((x): x is Extract<ReportLine, { kind: 'card' }> => x.kind === 'card')!
    assert.equal(l.pick, 0)
    assert.equal(r.card, null)
    assert.equal(r.harvestMod?.[r.player]?.mul, 0.85)
  })

  it('풍년에 창고를 고르면 그해 가을걷이가 는다 — 실제로 더 거둔다', () => {
    const a = byeonhanMini(3)
    const b = byeonhanMini(3)
    b.card = { kind: 'bounty', season: 1 }
    a.season = 1
    b.season = 1
    a.card = null
    a.cardNext = null
    b.cardNext = null
    const ha = advance(a, []).report.lines.find((l): l is Extract<ReportLine, { kind: 'harvest' }> => l.kind === 'harvest' && l.faction === a.player)
    const hb = advance(b, [{ kind: 'card', faction: b.player, pick: 0 }]).report.lines.find((l): l is Extract<ReportLine, { kind: 'harvest' }> => l.kind === 'harvest' && l.faction === b.player)
    assert.ok(ha !== undefined && hb !== undefined)
    assert.ok(hb.grain > ha.grain * 1.15, `${hb.grain} vs ${ha.grain}`)
  })

  it('장수 다툼 — 편든 쪽 정이 오르고 다른 쪽은 준다', () => {
    const r = byeonhanMini(3)
    const ours = Object.values(r.heroes).filter((h) => h.faction === r.player && !h.id.endsWith('-ruler'))
    if (ours.length < 2) {
      const x = Object.values(r.heroes).find((h) => h.faction !== r.player && !h.id.endsWith('-ruler'))!
      for (const a of Object.values(r.armies)) if (a.hero === x.id) a.hero = null
      x.faction = r.player
      x.at = r.factions[r.player]!.capital
      ours.push(x)
    }
    const [h1, h2] = ours
    const b1 = bondOf(r, h1!) ?? 0
    const b2 = bondOf(r, h2!) ?? 0
    r.card = { kind: 'quarrel', season: 0, hero: h1!.id, hero2: h2!.id }
    resolveCard(r, [{ kind: 'card', faction: r.player, pick: 1 }], lines())
    assert.ok((bondOf(r, h2!) ?? 0) > b2)
    assert.ok((bondOf(r, h1!) ?? 0) < b1)
  })

  it('점괘 — 제사를 지낸 계절엔 다음 카드를 엿본다', () => {
    let found = false
    for (let seed = 1; seed <= 20 && !found; seed++) {
      const r = byeonhanMini(seed)
      r.stock[r.player]!.grain = 5000
      const rep = advance(r, [{ kind: 'rite', faction: r.player }]).report
      if (rep.lines.some((l) => l.kind === 'rite' && l.faction === r.player)) {
        assert.ok(rep.lines.some((l) => l.kind === 'omen'), `${seed} 제사를 지냈는데 점괘가 없다`)
        found = true
      }
    }
    assert.ok(found, '제사를 한 번은 지내야 한다')
  })
})
