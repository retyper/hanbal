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
import { pairKey } from '../../src/realm/diplomacy.ts'
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

  it('장수 다툼 — 고르지 않으면 침묵 · 둘의 정이 함께 오르거나 함께 준다', () => {
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
    r.card = { kind: 'quarrel', season: 0, hero: h1!.id, hero2: h2!.id, why: 'feast' }
    const out = lines()
    resolveCard(r, [], out)
    const l = out.find((x): x is Extract<ReportLine, { kind: 'card' }> => x.kind === 'card')
    assert.ok(l !== undefined && l.pick === 2 && l.good !== undefined && l.why === 'feast')
    const d1 = (bondOf(r, h1!) ?? 0) - b1
    const d2 = (bondOf(r, h2!) ?? 0) - b2
    assert.ok(l.good ? d1 > 0 && d2 > 0 : d1 < 0 && d2 < 0, `${l.good} ${d1} ${d2}`)
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

describe('망명자 — 가만히 있으면 장수가 늘지 않는다 (형 10-24: "32년 넘기기만 했는데 장수가 17명")', () => {
  it('답하지 않으면 돌려보낸다 · 받으면 장수가 하나 는다', () => {
    const base = byeonhanMini(3)
    base.stock[base.player]!.grain = 500
    const n0 = Object.values(base.heroes).filter((h) => h.faction === base.player).length
    const card: Card = { kind: 'exile', season: base.season }
    const quiet = structuredClone(base)
    quiet.card = card
    resolveCard(quiet, [], lines())
    assert.equal(Object.values(quiet.heroes).filter((h) => h.faction === quiet.player).length, n0)
    const yes = structuredClone(base)
    yes.card = card
    resolveCard(yes, [{ kind: 'card', faction: yes.player, pick: 0 }], lines())
    assert.equal(Object.values(yes.heroes).filter((h) => h.faction === yes.player).length, n0 + 1)
  })

  /** 우리 남녀 장수 둘 — 없으면 남의 장수를 데려온다 */
  const couple = (r: Realm): [string, string] => {
    const pick = (look: 'g' | 'w'): string => {
      let h = Object.values(r.heroes).find((x) => x.faction === r.player && x.look === look && !x.id.endsWith('-ruler') && x.spouse === undefined)
      if (h === undefined) {
        h = Object.values(r.heroes).find((x) => x.faction !== r.player && x.look === look && !x.id.endsWith('-ruler'))!
        for (const a of Object.values(r.armies)) if (a.hero === h.id) a.hero = null
        h.faction = r.player
        h.at = r.factions[r.player]!.capital
      }
      return h.id
    }
    return [pick('g'), pick('w')]
  }

  it('연정 소문 — 짝지어 주면 혼인한다 · 핏줄끼리는 카드가 서지 않는다', () => {
    const r = byeonhanMini(5)
    r.stock[r.player]!.grain = 5000
    const [a, b] = couple(r)
    r.card = { kind: 'romance', season: 0, hero: a, hero2: b }
    assert.ok(cardValid(r, r.card))
    const out = lines()
    resolveCard(r, [{ kind: 'card', faction: r.player, pick: 0 }], out)
    assert.equal(r.heroes[a]!.spouse, b)
    assert.ok(out.some((l) => l.kind === 'wed'))
    const k = byeonhanMini(5)
    const [x, y] = couple(k)
    k.heroes[y]!.parents = [x, 'someone']
    assert.ok(!cardValid(k, { kind: 'romance', season: 0, hero: x, hero2: y }))
  })

  it('소도의 도망자 — 넘겨주면 내놓으라던 나라만 반긴다', () => {
    const r = byeonhanMini(2)
    const other = Object.keys(r.factions).find((f) => f !== r.player)!
    r.card = { kind: 'fugitive', season: 0, from: other }
    const before = r.relations?.[pairKey(r.player, other)]?.favor ?? 0
    resolveCard(r, [{ kind: 'card', faction: r.player, pick: 1 }], lines())
    const after = r.relations?.[pairKey(r.player, other)]?.favor ?? 0
    assert.ok(after > before, `${before} → ${after}`)
  })
})
