/**
 * 휘장 (META §2-① · unlock.ts nationWon) — 이 나라로 이겼다는 표가 판 밖에 남는다
 *
 *  - 이기면 판/나라마다 가장 높은 난세 단계를 적는다 (낮은 단계로 다시 이겨도 안 내려간다) · 배우는 판은 안 적는다
 *  - 나라 고르기에 휘장과 "휘장 n/전체"가 붙고, 단계따라 빛깔(구리 → 은 → 금 → 붉은 금)이 짙어진다
 */
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'

import { NATIONS } from '../../src/realm/data/nations.ts'
import type { RegionId } from '../../src/realm/types.ts'
import { nationsHtml, type FrontKit } from '../../src/ui/realm/front.ts'
import { badgeRank, markWon, nationWon } from '../../src/ui/realm/unlock.ts'

before(() => {
  const m = new Map<string, string>()
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) },
  }
})

describe('휘장', () => {
  it('나라마다 이긴 가장 높은 단계 · 배우는 판은 안 적는다', () => {
    const id = NATIONS[0]!.id
    assert.equal(nationWon('byeonhan-mini', id), 0)
    markWon('byeonhan-mini', 3, id)
    markWon('byeonhan-mini', 1, id)
    assert.equal(nationWon('byeonhan-mini', id), 3)
    assert.equal(nationWon('yeongnam', id), 0)
    markWon('tutorial', 1, 'golpo')
    assert.equal(nationWon('tutorial', 'golpo'), 0)
  })

  it('단계따라 빛깔', () => {
    // 구리(군장) · 은(대가·왕) · 금(대왕·태왕) · 붉은 금(천손 — 옛 7~10 도)
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 10].map(badgeRank), [0, 1, 2, 2, 3, 3, 4, 4])
  })

  it('나라 고르기에 휘장이 붙는다', () => {
    const id = NATIONS[0]!.id
    const kit: FrontKit = {
      art: '/', esc: (s) => s, icon: (n) => `[${n}]`, emblem: (f) => `{${f}}`, face: (f) => `(${f})`,
      nations: (_r: RegionId) => NATIONS, won: (_r, n) => (n === id ? 3 : 0),
    }
    const h = nationsHtml(kit, 'byeonhan-mini')
    assert.ok(h.includes('휘장 · 난세 3') && h.includes('wonb r2'))
    assert.ok(h.includes(`휘장 1/${NATIONS.length}`))
    assert.ok(!nationsHtml({ ...kit, won: () => 0 }, 'byeonhan-mini').includes('휘장'))
  })
})
