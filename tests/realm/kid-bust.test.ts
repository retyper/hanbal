/**
 * 아이의 얼굴 (data/art.ts KID_BUST · 그림 줄 K1) — 혼인에서 난 아이도 명치판이 있다
 *
 *  - 성별(look)에 맞는 젊은 얼굴 묶음에서 고른다 · 같은 id 는 늘 같은 얼굴
 *  - 판에 적어 두면(noteKids) id 만으로도 찾는다 (싸움 기록·지도 말)
 *  - 묶음의 그림이 다 public/realm/bust 에 있다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import { KID_BUST, bustOf, kidBust, noteKids } from '../../src/realm/data/art.ts'

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

  it('묶음의 그림 파일이 다 있다', () => {
    for (const f of [...KID_BUST.g, ...KID_BUST.w]) assert.ok(existsSync(`public/realm/bust/${f}.jpg`), f)
  })
})
