/**
 * 2장 졸본만의 사건 카드 (events.chapterCard) — 엄리대수의 다리 · 비류국의 고각
 *  - 정해진 계절에 반드시 온다 · 다른 판엔 없다
 *  - 다리를 흩으면 동부여 군대 사기가 꺾인다 · 고각을 두면 비류국 호감이 오른다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { startRegion } from '../../src/realm/data/regions/index.ts'
import { drawCard, resolveCard } from '../../src/realm/events.ts'
import { favorOf } from '../../src/realm/diplomacy.ts'
import { P } from '../../src/tune/params.ts'
import type { ReportLine } from '../../src/realm/types.ts'

describe('2장 사건 카드', () => {
  it('정해진 계절에 온다 · 다른 판엔 없다', () => {
    const r = startRegion('jumong', 2, 'goguryeo')
    assert.equal(drawCard(r, P.realm.cardFishSeason)?.kind, 'fishbridge')
    assert.equal(drawCard(r, P.realm.cardGogakSeason)?.kind, 'gogak')
    const b = startRegion('byeonhan-mini', 2, 'guya')
    for (let s = 0; s < 8; s++) assert.ok(!['fishbridge', 'gogak'].includes(drawCard(b, s)?.kind ?? ''))
  })
  it('다리를 흩으면 동부여 군대 사기가 꺾인다', () => {
    const r = startRegion('jumong', 2, 'goguryeo')
    r.season = P.realm.cardFishSeason
    r.card = { kind: 'fishbridge', season: r.season }
    const m0 = Object.values(r.armies).filter((a) => a.faction === 'buyeo').map((a) => a.morale)
    const lines: ReportLine[] = []
    resolveCard(r, [{ kind: 'card', faction: 'goguryeo', pick: 0 }], lines)
    const m1 = Object.values(r.armies).filter((a) => a.faction === 'buyeo').map((a) => a.morale)
    assert.ok(m1.every((m, i) => m < m0[i]!))
  })
  it('고각을 두고 예를 갖추면 비류국 호감이 오른다', () => {
    const r = startRegion('jumong', 2, 'goguryeo')
    r.season = P.realm.cardGogakSeason
    r.card = { kind: 'gogak', season: r.season }
    const f0 = favorOf(r, 'goguryeo', 'biryuna')
    resolveCard(r, [{ kind: 'card', faction: 'goguryeo', pick: 1 }], [])
    assert.equal(favorOf(r, 'goguryeo', 'biryuna'), f0 + P.realm.cardGogakFavor)
  })
})
