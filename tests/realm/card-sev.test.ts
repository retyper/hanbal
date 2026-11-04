/**
 * 재해의 세기 (형 11-05: "더 강한 전염병 · 더 약한 왜구 · 재해 강도를 표시하면서 variation") ·
 * 강 범람 — 기다리면 집을 잃지만 그해 가을걷이가 는다 (문명의 범람원)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { startRegion } from '../../src/realm/data/regions/index.ts'
import { cardPreview } from '../../src/realm/events.ts'
import { cardInfo } from '../../src/realm/data/cards.ts'
import type { Card } from '../../src/realm/types.ts'

const lost = (p: ReturnType<typeof cardPreview>, side: 'sure' | 'lose'): number => (p?.[side]?.hurt ?? []).reduce((s, [, n]) => s + n, 0)

describe('재해의 세기', () => {
  const r = startRegion('byeonhan-mini', 7, 'us')
  const node = r.factions[r.player]!.capital
  const card = (sev: 1 | 2 | 3): Card => ({ kind: 'plague', season: r.season, node, sev })

  it('큰 돌림병은 작은 돌림병보다 집을 더 잃고, 그냥 두면 번질 가망도 크다', () => {
    assert.ok(lost(cardPreview(r, card(3), 0), 'sure') > lost(cardPreview(r, card(1), 0), 'sure'))
    assert.ok((cardPreview(r, card(3), 1)?.chance ?? 0) < (cardPreview(r, card(1), 1)?.chance ?? 0))
  })
  it('세기마다 이름이 다르다 (보통은 본래 이름)', () => {
    assert.equal(cardInfo(card(2)).name, '돌림병')
    assert.equal(cardInfo(card(3)).name, '큰 돌림병')
    assert.equal(cardInfo(card(1)).name, '가벼운 돌림병')
  })
  it('범람을 기다리면 집을 잃지만 가을걷이가 늘고, 클수록 둘 다 크다', () => {
    const f = (sev: 1 | 2 | 3): Card => ({ kind: 'flood', season: r.season, node, sev })
    const big = cardPreview(r, f(3), 1)
    const small = cardPreview(r, f(1), 1)
    assert.ok((big?.sure.harvest ?? 1) > (small?.sure.harvest ?? 1))
    assert.ok((small?.sure.harvest ?? 1) > 1)
  })
})
