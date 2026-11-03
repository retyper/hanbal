/**
 * 장마다 사서의 한 장면 (위원회 11-04 역사 ③ · events.chapterCard) — 정해진 계절에 그 장의 카드가 온다 · 자유 판에는 안 온다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { startRegion } from '../../src/realm/data/regions/index.ts'
import { cardPreview, drawCard } from '../../src/realm/events.ts'
import { seasons } from '../../src/realm/calendar.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm } from '../../src/realm/types.ts'

/** 그 장의 시작 판에서 k 번째 계절 첫 턴 */
const at = (r: Realm, k: number): number => r.season + seasons(r, Math.round(k)) - (r.season % Math.max(1, seasons(r, 1)))

describe('장 카드', () => {
  const cases = [
    ['mahan', 'baekje', 'mhscold', P.realm.cardMhScoldSeason],
    ['mahan', 'baekje', 'mhhunt', P.realm.cardMhHuntSeason],
    ['seorabeol', 'saro', 'opengate', P.realm.cardOpenGateSeason],
    ['gujibong', 'garak', 'redsail', P.realm.cardRedSailSeason],
    ['daemusin', 'goguryeo', 'selfpot', P.realm.cardSelfPotSeason],
  ] as const
  for (const [reg, me, kind, k] of cases) {
    it(`${reg} — ${kind} 가 ${k} 계절에`, () => {
      const r = startRegion(reg, 1, me)
      const c = drawCard(r, at(r, k))
      assert.equal(c?.kind, kind)
      for (const pick of [0, 1] as const) assert.ok(cardPreview(r, c!, pick) !== null)
    })
  }
  it('자유 판에는 장 카드가 안 온다', () => {
    const r = startRegion('south', 1, 'saro')
    for (let s = 0; s < 40; s++) {
      const c = drawCard(r, s)
      assert.ok(c === null || !['mhscold', 'mhhunt', 'opengate', 'redsail', 'selfpot'].includes(c.kind))
    }
  })
})
