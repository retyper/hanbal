/**
 * 아이의 얼굴 (data/art.ts KID_BUST · 그림 줄 K1) — 혼인에서 난 아이도 명치판이 있다
 *
 *  - 성별(look)에 맞는 젊은 얼굴 묶음에서 고른다 · 같은 id 는 늘 같은 얼굴
 *  - 판에 적어 두면(noteKids) id 만으로도 찾는다 (싸움 기록·지도 말)
 *  - 묶음의 그림이 다 public/realm/bust 에 있다
 *  - 물려받은 특성이 갈래를 고른다 — 명궁의 아이는 활 든 얼굴 (형 10-29 · docs/realm/cast/kids.md)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import { KID_BUST, KID_LINE, LINE_OF_TRAIT, bustOf, kidBust, noteKids } from '../../src/realm/data/art.ts'
import { TRAIT } from '../../src/realm/data/traits.ts'

describe('아이의 얼굴', () => {
  it('성별에 맞는 묶음에서 고르고, 같은 id 는 늘 같은 얼굴', () => {
    const w = kidBust('kid-guya-2-guya-3', 'w')
    const g = kidBust('kid-guya-2-guya-3', 'g')
    assert.ok(w !== undefined && KID_BUST.w.includes(w))
    assert.ok(g !== undefined && KID_BUST.g.includes(g))
    assert.equal(kidBust('kid-guya-2-guya-3', 'w'), w)
  })

  it('판에 적어 두면 id 만으로 찾고, 부모 없는 장수는 건드리지 않는다', () => {
    assert.equal(bustOf('kid-us-2-us-5'), undefined)
    noteKids([{ id: 'kid-us-2-us-5', look: 'g', parents: ['us-2', 'us-5'] }, { id: 'nobody-x', look: 'w' }])
    assert.equal(bustOf('kid-us-2-us-5'), kidBust('kid-us-2-us-5', 'g'))
    assert.equal(bustOf('nobody-x'), undefined)
  })

  it('묶음의 그림 파일이 다 있다 (갈래 칸도)', () => {
    for (const f of [...KID_BUST.g, ...KID_BUST.w]) assert.ok(existsSync(`public/realm/bust/${f}.jpg`), f)
    for (const l of Object.values(KID_LINE)) for (const f of [...l.g, ...l.w]) assert.ok(KID_BUST.g.includes(f) || KID_BUST.w.includes(f), f)
    for (const t of Object.keys(LINE_OF_TRAIT)) assert.ok(TRAIT[t] !== undefined, t)
  })

  it('명궁을 물려받은 아이는 궁수 갈래의 얼굴 — 같은 id 는 늘 같은 얼굴', () => {
    for (const id of ['kid-guya-2-guya-3', 'kid-us-1-us-4', 'kid-baekje-1-baekje-2']) {
      const f = kidBust(id, 'g', ['archer'])
      assert.ok(f !== undefined && KID_LINE.archer.g.includes(f), `${id} ${f}`)
      assert.equal(kidBust(id, 'g', ['archer']), f)
      assert.ok(KID_LINE.archer.w.includes(kidBust(id, 'w', ['nighteye'])!))
    }
    // 앞의 특성부터 — 갈래 없는 특성(술꾼)은 건너뛴다
    assert.ok(KID_LINE.shaman.w.includes(kidBust('kid-a-b', 'w', ['drinker', 'shaman', 'archer'])!))
    // 걸리는 갈래가 없으면 전체 묶음
    assert.ok(KID_BUST.g.includes(kidBust('kid-a-b', 'g', ['drinker'])!))
  })

  it('가문의 아이도 특성을 적어 두면 판에서 본 얼굴 그대로', () => {
    noteKids([{ id: 'clan-g-77-kid-x-y', look: 'g', traits: ['archer'] }])
    assert.equal(bustOf('clan-g-77-kid-x-y'), kidBust('kid-x-y', 'g', ['archer']))
  })
})
