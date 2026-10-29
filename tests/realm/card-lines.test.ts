/**
 * 사람이 나오는 사건의 자막·그림 (src/ui/realm/card-lines.ts)
 *
 *  - 이야기는 여덟아홉 장 — 배경 · 까닭 · 맞섬 · 걸린 것 (형 10-29: "3~4줄 가지고 무슨 스토리가 생기겠냐")
 *  - 내세우는 까닭은 그 장수가 잘하는 것, 깎아내리는 말은 상대가 못하는 것 (형 10-29: "아이들이 따른다고 고을 주인 자격이 있냐")
 *  - 부부 · 부모와 자식 · 한 핏줄이면 그 사이를 말하는 한 장이 붙는다
 *  - 그림은 성별로 — 사내 둘 기본 · 여인 둘 -ww · 남녀 -mw (먼저 나선 이가 여인이면 뒤집는다)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import type { Card, Hero } from '../../src/realm/types.ts'
import { exileArt, exileBeats, fugitiveBeats, quarrelArt, quarrelBeats, romanceBeats } from '../../src/ui/realm/card-lines.ts'

const R = byeonhanMini(1)
const hero = (id: string, look: 'g' | 'w', more: Partial<Hero> = {}): Hero => ({
  id, name: id, faction: 'x', mu: 5, tong: 5, ryak: 5, chi: 5, deok: 5, uiri: 5, traits: [], look,
  status: 'free', captor: null, at: null, post: null, ...more,
})
const card = (why: Card['why'], more: Partial<Card> = {}): Card => ({ kind: 'quarrel', season: 0, hero: 'a', hero2: 'b', ...(why !== undefined ? { why } : {}), ...more })
const town = Object.keys(R.nodes)[0]!

describe('장수 다툼 자막', () => {
  it('이야기는 여덟 장 넘게 · 이름이 들어간다', () => {
    for (const why of ['spoils', 'town', 'feast'] as const) {
      const beats = quarrelBeats(R, card(why, { node: town }), hero('가람', 'g'), hero('누리', 'w'))
      assert.ok(beats.length >= 8, `${why} ${beats.length}장`)
      assert.ok(beats.some((s) => s.includes('가람')) && beats.some((s) => s.includes('누리')))
      assert.ok(beats.every((s) => !s.includes('{a}') && !s.includes('{b}')))
    }
  })

  it('고을을 맡겠다는 까닭은 잘하는 것에서, 깎아내림은 상대가 못하는 것에서', () => {
    const steward = hero('a', 'g', { chi: 9 })
    const brute = hero('b', 'g', { mu: 9, chi: 1 })
    const beats = quarrelBeats(R, card('town', { node: town }), steward, brute)
    assert.ok(beats.some((s) => s.includes('곳간과 물길을 셈할 줄 아는')))
    assert.ok(beats.some((s) => s.includes('셈 한 줄 못 하는')))
  })

  it('말투에 따라 높임이 다르다', () => {
    const young = hero('a', 'g', { traits: ['coward'] }) // 젊은이 결
    const x = quarrelBeats(R, card('spoils'), young, hero('b', 'g', { mu: 9 }))
    assert.ok(x.some((s) => s.includes('합니다') || s.includes('습니다')))
  })

  it('부부 · 부모와 자식 · 한 핏줄', () => {
    const a = hero('a', 'g', { spouse: 'b' })
    const b = hero('b', 'w', { spouse: 'a' })
    assert.ok(quarrelBeats(R, card('feast'), a, b).some((s) => s.includes('부부')))
    const mom = hero('a', 'w')
    const son = hero('b', 'g', { parents: ['a', 'z'] })
    assert.ok(quarrelBeats(R, card('town', { node: town }), mom, son).some((s) => s.includes('어머니와 아들이')))
    const s1 = hero('a', 'w', { parents: ['p', 'q'] })
    const s2 = hero('b', 'g', { parents: ['p', 'q'] })
    assert.ok(quarrelBeats(R, card('spoils'), s1, s2).some((s) => s.includes('남매')))
  })

  it('갓 자란 자식 장수 · 옛 저장(까닭 없음)도 덩이쇠 몫으로', () => {
    const kid = hero('a', 'g', { parents: ['p', 'q'] })
    const beats = quarrelBeats(R, card(undefined), kid, hero('b', 'g'))
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
  it('쫓겨 온 사람 — 성별·특성에 맞게 · 배신 기질이면 위험을 말한다', () => {
    const other = Object.keys(R.factions).find((f) => f !== R.player)!
    const c: Card = { kind: 'exile', season: 0, guest: 'g', from: other }
    const w = exileBeats(R, c, hero('다솜', 'w', { traits: ['farmer', 'traitor'] }))
    assert.ok(w.length >= 6)
    assert.ok(w[0]!.includes('여인') && w[0]!.includes(R.factions[other]!.name))
    assert.ok(w.some((s) => s.includes('팔아넘겼다')) && w.some((s) => s.includes('등에 칼')))
    assert.equal(exileArt('event-wanderer-arrives', hero('g', 'g')), 'event-wanderer-arrives-g')
  })

  it('소도 — 내놓으라는 나라가 있을 때만 새 글', () => {
    const other = Object.keys(R.factions).find((f) => f !== R.player)!
    assert.equal(fugitiveBeats(R, { kind: 'fugitive', season: 0 }), null)
    const b = fugitiveBeats(R, { kind: 'fugitive', season: 1, from: other })!
    assert.ok(b.length >= 6 && b.some((s) => s.includes(`${R.factions[other]!.name} 사신`)))
  })

  it('연정 소문 — 이름이 들어가고 · 같은 결이면 둘째는 다른 말', () => {
    const c: Card = { kind: 'romance', season: 0, hero: 'a', hero2: 'b' }
    const beats = romanceBeats(R, c, hero('바위', 'g', { mu: 9 }), hero('물결', 'g', { mu: 9 }))
    assert.ok(beats.length >= 8 && beats[0]!.includes('바위') && beats[0]!.includes('물결'))
    const say = beats.filter((s) => s.includes('" — '))
    assert.notEqual(say[0]!.split('—')[0], say[1]!.split('—')[0])
  })
})
