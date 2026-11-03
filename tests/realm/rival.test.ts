/**
 * 맞수 (위원회 11-04 역사 ① · memory.rivalOf · 사건 카드 'rival')
 *  - 같은 적장과 rivalMeet 번 넘게 맞서면 맞수 · 적장이 우리 편이 되면 맞수가 아니다
 *  - 도전장 = 우리 장수 무예 + 정 · 술 한 동이 = 곡식 · 원한 −1 · 그 나라 호감
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { cardPreview, cardValid } from '../../src/realm/events.ts'
import { rivalOf } from '../../src/realm/memory.ts'
import { P } from '../../src/tune/params.ts'
import type { Card, Realm } from '../../src/realm/types.ts'

function met(r: Realm, n: number): void {
  const h = r.heroes['us-1']!
  h.mem = Array.from({ length: n }, (_, i) => ({ s: i, k: 'battle' as const, foe: 'guya', who: 'guya-1', res: 'won' as const }))
}

describe('맞수', () => {
  it('rivalMeet 번 맞서면 맞수 · 모자라면 아니다', () => {
    const r = byeonhanMini(1)
    met(r, Math.round(P.realm.rivalMeet) - 1)
    assert.equal(rivalOf(r, 'us'), null)
    met(r, Math.round(P.realm.rivalMeet))
    assert.deepEqual(rivalOf(r, 'us'), { hero: 'us-1', foe: 'guya-1', n: Math.round(P.realm.rivalMeet) })
    r.heroes['guya-1']!.faction = 'us'
    assert.equal(rivalOf(r, 'us'), null)
  })

  it('도전장은 무예와 정 · 술 한 동이는 곡식·원한·호감 · 카드는 적장이 남의 장수일 때만', () => {
    const r = byeonhanMini(1)
    met(r, 5)
    r.heroes['guya-1']!.grudge = 2
    const c: Card = { kind: 'rival', season: r.season, hero: 'us-1', hero2: 'guya-1' }
    assert.equal(cardValid(r, c), true)
    const a = cardPreview(r, c, 0)!
    assert.deepEqual(a.sure.stat, ['us-1', 'mu', P.realm.cardMentorStat])
    const b = cardPreview(r, c, 1)!
    assert.ok((b.sure.grain ?? 0) < 0)
    assert.equal(b.sure.soothe, 'guya-1')
    assert.deepEqual(b.sure.favor, [{ to: ['guya'], d: P.realm.cardRivalFavor }])
    r.heroes['guya-1']!.faction = 'us'
    assert.equal(cardValid(r, c), false)
  })
})
