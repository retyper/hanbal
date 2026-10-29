/**
 * 장수 다툼 자막·그림 (src/ui/realm/card-lines.ts)
 *
 *  - 말투는 결을 따른다 — 거친 사내와 무당 여인의 말이 다르다
 *  - 부부 · 부모와 자식 · 한 핏줄이면 그 사이를 말하는 한 장이 붙는다
 *  - 그림은 성별로 — 사내 둘 기본 · 여인 둘 -ww · 남녀 -mw (먼저 나선 이가 여인이면 뒤집는다)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import type { Card, Hero } from '../../src/realm/types.ts'
import { exileArt, exileBeats, fugitiveBeats, quarrelArt, quarrelBeats, romanceBeats } from '../../src/ui/realm/card-lines.ts'

const hero = (id: string, look: 'g' | 'w', more: Partial<Hero> = {}): Hero => ({
  id, name: id, faction: 'x', mu: 5, tong: 5, ryak: 5, chi: 5, deok: 5, uiri: 5, traits: [], look,
  status: 'free', captor: null, at: null, post: null, ...more,
})
const card = (why: Card['why']): Card => ({ kind: 'quarrel', season: 0, hero: 'a', hero2: 'b', ...(why !== undefined ? { why } : {}) })

describe('장수 다툼 자막', () => {
  it('말투가 결마다 다르다', () => {
    const gruff = hero('a', 'g', { mu: 9 })
    const shaman = hero('a', 'w', { traits: ['shaman'] })
    const other = hero('b', 'g')
    const x = quarrelBeats(card('spoils'), gruff, other)
    const y = quarrelBeats(card('spoils'), shaman, other)
    assert.notEqual(x[1], y[1])
  })

  it('부부 · 부모와 자식 · 한 핏줄', () => {
    const a = hero('a', 'g', { spouse: 'b' })
    const b = hero('b', 'w', { spouse: 'a' })
    assert.ok(quarrelBeats(card('feast'), a, b).some((s) => s.includes('부부')))
    const mom = hero('a', 'w')
    const son = hero('b', 'g', { parents: ['a', 'z'] })
    assert.ok(quarrelBeats(card('town'), mom, son).some((s) => s.includes('어머니와 아들이')))
    const s1 = hero('a', 'w', { parents: ['p', 'q'] })
    const s2 = hero('b', 'g', { parents: ['p', 'q'] })
    assert.ok(quarrelBeats(card('spoils'), s1, s2).some((s) => s.includes('남매')))
  })

  it('갓 자란 자식 장수 · 옛 저장(까닭 없음)도 덩이쇠 몫으로', () => {
    const kid = hero('a', 'g', { parents: ['p', 'q'] })
    const b = hero('b', 'g')
    const beats = quarrelBeats(card(undefined), kid, b)
    assert.ok(beats.some((s) => s.includes('갓 자라')))
    assert.ok(beats[0]!.includes('덩이쇠'))
  })

  it('그림은 성별로', () => {
    const g = hero('a', 'g')
    const w = hero('b', 'w')
    assert.deepEqual(quarrelArt('event-quarrel-feast', g, hero('b', 'g')), { art: 'event-quarrel-feast', flip: false })
    assert.deepEqual(quarrelArt('event-quarrel-feast', hero('a', 'w'), w), { art: 'event-quarrel-feast-ww', flip: false })
    assert.deepEqual(quarrelArt('event-quarrel-feast', g, w), { art: 'event-quarrel-feast-mw', flip: false })
    assert.deepEqual(quarrelArt('event-quarrel-feast', hero('a', 'w'), hero('b', 'g')), { art: 'event-quarrel-feast-mw', flip: true })
  })
})

describe('쫓겨 온 사람 · 소도 · 연정 소문 자막', () => {
  it('쫓겨 온 사람 — 성별·특성에 맞게 · 배신 기질이 먼저', () => {
    const c: Card = { kind: 'exile', season: 0, guest: 'g', from: 'f' }
    const w = exileBeats(c, hero('g', 'w', { traits: ['farmer', 'traitor'] }))
    assert.ok(w[0]!.includes('여인') && w[0]!.includes('{f}'))
    assert.ok(w[1]!.includes('배신') || w[1]!.includes('팔아넘겼다'))
    assert.equal(exileArt('event-wanderer-arrives', hero('g', 'g')), 'event-wanderer-arrives-g')
  })

  it('소도 — 내놓으라는 나라가 있을 때만 새 글', () => {
    assert.equal(fugitiveBeats({ kind: 'fugitive', season: 0 }), null)
    assert.ok(fugitiveBeats({ kind: 'fugitive', season: 1, from: 'f' })!.some((s) => s.includes('{f} 사신')))
  })

  it('연정 소문 — 같은 결이면 둘째는 다른 말', () => {
    const c: Card = { kind: 'romance', season: 0, hero: 'a', hero2: 'b' }
    const beats = romanceBeats(c, hero('a', 'g', { mu: 9 }), hero('b', 'g', { mu: 9 }))
    assert.notEqual(beats[1]!.split('—')[0], beats[2]!.split('—')[0])
  })
})

