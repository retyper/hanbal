/**
 * 사건 카드 고침 (위원회 11-04 역사 자리 · docs/realm/council/1104/history.md §2) — 공짜·늘 밀리는 고름이 없게
 *  F1 떼어 놓기는 군기(사기)가 선다 · F3 풍년 잔치는 곡식이 안 들고 가을걷이가 조금 · F4 이웃 부르기는 곡식이 든다
 *  F5 망명자를 돌려보내면 쫓아낸 나라가 반긴다 · F6 고향 사람을 받으면 곡식이 든다 · F7 스승과 제자는 둘 사이 친밀
 *  F10 바다 도적에 맞설 가망은 포구를 맡은 장수로 오른다 · F11 답례 곡식은 곳간보다 크지 않다 · F13 본 카드는 한동안 덜 온다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { cardPreview } from '../../src/realm/events.ts'
import { P } from '../../src/tune/params.ts'
import type { Card } from '../../src/realm/types.ts'

const r0 = () => byeonhanMini(1)
const card = (kind: Card['kind'], more: Partial<Card> = {}): Card => ({ kind, season: 0, ...more })

describe('사건 카드 고침', () => {
  it('F1 떼어 놓는다 — 둘 다 정이 떨어지지만 군대 사기가 오른다', () => {
    const p = cardPreview(r0(), card('romance', { hero: 'us-1', hero2: 'chief' }), 2)!
    assert.ok((p.sure.morale ?? 0) > 0)
  })
  it('F3 풍년 · 크게 잔치한다 — 곡식이 안 들고 가을걷이가 조금 는다', () => {
    const p = cardPreview(r0(), card('bounty'), 1)!
    assert.equal(p.sure.grain, undefined)
    assert.ok((p.sure.harvest ?? 1) > 1)
  })
  it('F4 하늘 제사 · 이웃을 부른다 — 곡식이 든다', () => {
    const p = cardPreview(r0(), card('skyfest'), 0)!
    assert.ok((p.sure.grain ?? 0) < 0)
  })
  it('F5 망명자 · 돌려보낸다 — 쫓아낸 나라가 반긴다', () => {
    const p = cardPreview(r0(), card('exile', { from: 'guya' }), 1)!
    assert.deepEqual(p.sure.favor, [{ to: ['guya'], d: P.realm.cardExileReturnFavor }])
  })
  it('F6 고향 소식 · 받아들인다 — 곡식이 든다', () => {
    const p = cardPreview(r0(), card('homenews', { hero: 'us-1', node: 'our-cap' }), 0)!
    assert.ok((p.sure.grain ?? 0) < 0)
  })
  it('F7 스승과 제자 · 함께 다니게 한다 — 두 장수 사이 친밀이 오른다', () => {
    const p = cardPreview(r0(), card('mentor', { hero: 'chief', hero2: 'us-1' }), 1)!
    assert.deepEqual(p.sure.ties, [['chief', 'us-1', P.realm.cardMentorTie]])
  })
  it('F10 바다 도적 · 장수에게 맡긴다 — 포구를 맡은 장수가 있으면 가망이 오른다', () => {
    const r = r0()
    const port = 'our-north'
    const a = cardPreview(r, card('pirates', { node: port }), 2)!.chance!
    r.heroes['us-1']!.post = port
    r.heroes['us-1']!.at = port
    const b = cardPreview(r, card('pirates', { node: port }), 2)!.chance!
    assert.ok(b > a, `${a} → ${b}`)
  })
  it('F11 사신의 선물 · 크게 답례 — 나가는 곡식은 곳간을 넘지 않는다', () => {
    const r = r0()
    r.stock['us']!.grain = 5
    const p = cardPreview(r, card('gift', { from: 'guya' }), 1)!
    assert.ok((p.sure.grain ?? 0) >= -5)
  })
})
