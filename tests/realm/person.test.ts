/**
 * 사람 열쇠 (src/realm/person.ts · 각성 v2 · docs/realm/study-20261118/30-PROPOSAL.md 1절 ⑥)
 *
 *  - 같은 초상을 쓰는 장수 id 는 같은 사람이다 · 지금 일곱 쌍 (새 쌍이 생기면 이 시험이 먼저 안다: 얼굴을 빌려 쓴 다른 사람인지 가려 적을 것)
 *  - 초상이 다르면 이름이 같아도 따로 센다 (늙은 대소 · 진하 둘)
 *  - 사람 단위 비트(본편 도장 · 도깨비 도장)는 같은 사람의 id 를 묶어 읽는다 · 네 칸은 안 묶는다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { HERO_BUST } from '../../src/realm/data/hero-bust.ts'
import { DEX_AWOKE, DEX_BOSS, DEX_DEMON, PERSON_BITS, personFlags, personOf, sameIds, samePerson, sealsOf } from '../../src/realm/person.ts'

describe('사람 열쇠', () => {
  it('같은 초상 = 같은 사람 · 판마다 다른 id 를 묶는다', () => {
    assert.equal(personOf('tut-onjo'), personOf('mh-onjo'))
    assert.ok(samePerson('tut-malgalgi', 'sabeol-1'))
    assert.ok(samePerson('jm-haedal', 'buyeo-1'))
    assert.ok(!samePerson('mh-onjo', 'mh-ogan'))
    assert.deepEqual(sameIds('mh-ogan'), ['mh-ogan', 'tut-ogan'])
    assert.deepEqual(sameIds('tut-ogan'), ['mh-ogan', 'tut-ogan'], '어느 쪽 id 로 물어도 같은 묶음')
    assert.deepEqual(sameIds('tut-haebi'), ['tut-haebi'], '해비는 배우는 판에만 있는 사람')
  })

  it('초상이 없는 장수는 id 가 곧 열쇠다 (자녀 · 모르는 id)', () => {
    assert.equal(personOf('kid-3-5'), 'kid-3-5')
    assert.deepEqual(sameIds('kid-3-5'), ['kid-3-5'])
    assert.equal(personOf(''), '')
  })

  it('같은 초상을 쓰는 묶음은 알려진 일곱 쌍뿐이다', () => {
    const groups = new Map<string, string[]>()
    for (const id of Object.keys(HERO_BUST).sort()) groups.set(personOf(id), [...(groups.get(personOf(id)) ?? []), id])
    const shared = [...groups.values()].filter((g) => g.length > 1).map((g) => g.join(' ')).sort()
    assert.deepEqual(shared, [
      'biryuna-ruler jm-songbi', // 송비
      'bukokjeo-1 jm-okjeo-1', // 물범
      'bukokjeo-ruler jm-okjeo-ruler', // 두만
      'buyeo-1 jm-haedal', // 해달
      'mh-ogan tut-ogan', // 오간
      'mh-onjo tut-onjo', // 온조
      'sabeol-1 tut-malgalgi', // 말갈기
    ])
    for (const g of groups.values()) for (const id of g) assert.deepEqual(sameIds(id), g, id)
  })

  it('초상이 다르면 따로 센다 — 늙은 대소 · 진왕 진하와 신지 방울', () => {
    assert.ok(!samePerson('jm-daeso', 'dm-daeso'))
    assert.ok(!samePerson('mh-jinwang', 'mokji-ruler'))
  })
})

describe('사람 단위 도장', () => {
  it('비트 셋은 서로 다르고 네 칸(1·2·4·8)과 안 겹친다', () => {
    assert.deepEqual([DEX_AWOKE, DEX_DEMON, DEX_BOSS], [16, 32, 64])
    assert.equal(PERSON_BITS, 112)
  })

  it('같은 사람의 id 가운데 하나라도 켜져 있으면 켜진 것이다 · 표는 그대로 둔다', () => {
    // 열전에서는 배우는 판의 오간으로 목책을 깼고, 본편에서는 1장의 오간으로 불꽃을 채웠다
    const dex = { 'tut-ogan': { f: DEX_DEMON }, 'mh-ogan': { f: 15 | DEX_AWOKE }, 'mh-onjo': { f: 15 } }
    assert.deepEqual(sealsOf(dex, 'mh-ogan'), { flame: true, demon: true, both: true })
    assert.deepEqual(sealsOf(dex, 'tut-ogan'), { flame: true, demon: true, both: true })
    assert.deepEqual(sealsOf(dex, 'mh-onjo'), { flame: false, demon: false, both: false })
    assert.deepEqual(sealsOf(dex, 'nobody'), { flame: false, demon: false, both: false })
    assert.deepEqual(Object.keys(dex).sort(), ['mh-ogan', 'mh-onjo', 'tut-ogan'])
  })

  it('한쪽 도장만으로는 둘 다가 아니다', () => {
    assert.deepEqual(sealsOf({ 'sabeol-1': { f: DEX_AWOKE } }, 'tut-malgalgi'), { flame: true, demon: false, both: false })
    assert.deepEqual(sealsOf({ 'tut-haebi': { f: DEX_DEMON } }, 'tut-haebi'), { flame: false, demon: true, both: false })
  })

  it('네 칸은 사람으로 안 묶는다 — 거느림은 그 id 의 것이다', () => {
    assert.equal(personFlags({ 'tut-onjo': { f: 15 }, 'mh-onjo': { f: 1 } }, 'mh-onjo'), 0)
    assert.equal(personFlags({ 'tut-onjo': { f: 15 | DEX_BOSS } }, 'mh-onjo'), DEX_BOSS)
  })
})
