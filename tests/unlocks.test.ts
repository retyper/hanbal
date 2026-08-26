/**
 * 칭호 장착 (2026-08-26, 형: "칭호는 얻어도 장착하거나 그런거 전혀없고 재미도 없다").
 *
 * currentTitle()이 이제 두 가지를 판정한다: 고른 칭호가 있으면 그걸 보여주고,
 * 없거나 무효하면(안 딴 것·오타) 옛 규칙(가장 어려운 것)으로 떨어진다.
 * **가진 적 없는 칭호를 사칭하게 두지 않는다** — 그건 세이브 조작으로 칭호를 훔치는 길이다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { currentTitle, unlockedTitles } from '../src/game/unlocks.ts'

describe('칭호 장착', () => {
  it('고른 칭호가 딴 것이면 그걸 보여준다', () => {
    const unlocked = ['title.oneshot', 'title.hawk', 'title.forty']
    assert.equal(currentTitle(unlocked, 'title.hawk'), '매눈의 궁수')
  })

  it('안 딴 칭호를 가리키면 무시하고 옛 규칙(가장 어려운 것)으로 떨어진다', () => {
    const unlocked = ['title.oneshot', 'title.hawk']
    // title.flawless는 아직 못 땄다 — 세이브를 조작해도 안 가진 칭호를 두를 수 없다.
    assert.equal(currentTitle(unlocked, 'title.flawless'), '매눈의 궁수')
  })

  it('아직 아무것도 안 골랐으면(빈 문자열) 가장 어려운 것으로 떨어진다', () => {
    const unlocked = ['title.oneshot', 'title.hawk']
    assert.equal(currentTitle(unlocked, ''), '매눈의 궁수')
    assert.equal(currentTitle(unlocked), '매눈의 궁수')
  })

  it('활 해금 id를 칭호로 가리켜도 거부한다 (kind 불일치)', () => {
    const unlocked = ['title.oneshot', 'bow.gakgung']
    assert.equal(currentTitle(unlocked, 'bow.gakgung'), '첫 무결')
  })

  it('아무 칭호도 없으면 빈 문자열', () => {
    assert.equal(currentTitle([]), '')
  })

  it('unlockedTitles는 딴 칭호만, 목록 순서대로 돌려준다', () => {
    const unlocked = ['bow.gakgung', 'title.forty', 'title.oneshot']
    const got = unlockedTitles(unlocked).map((d) => d.id)
    assert.deepEqual(got, ['title.oneshot', 'title.forty'], '목록(UNLOCKS) 순서를 지켜야 한다')
  })
})
