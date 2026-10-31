/**
 * 친밀 (형 10-31) — 장수 둘 사이. 함께 이긴 싸움으로 오른다. 혼인은 누구든 맺지만
 * 아끼는 사이(tieLove)는 잔치가 싸고, 낯선 사이(tieCold 아래 · 정략)는 비싸고 둘 다 정이 떨어진다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { addTie, battleGrowth, canWed, isRuler, tieOf, wed, wedCost } from '../../src/realm/heroes.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm, ReportLine } from '../../src/realm/types.ts'

const couple = (r: Realm): [string, string] | null => {
  const ours = Object.values(r.heroes).filter((h) => h.faction === r.player && h.status === 'free' && !isRuler(r, h.id)) // 군주는 정이 없다
  for (const a of ours) for (const b of ours) if (canWed(r, r.player!, a.id, b.id)) return [a.id, b.id]
  return null
}

describe('친밀', () => {
  it('함께 이기면 가까워진다 · 둘의 순서와 상관없다', () => {
    const r = byeonhanMini(1)
    const ours = Object.values(r.heroes).filter((h) => h.faction === r.player && h.status === 'free').map((h) => h.id).sort()
    assert.ok(ours.length >= 2)
    battleGrowth(r, [ours[0]!, ours[1]!], [], [], [])
    assert.equal(tieOf(r, ours[0]!, ours[1]!), P.realm.tieWin)
    assert.equal(tieOf(r, ours[1]!, ours[0]!), P.realm.tieWin)
  })

  it('아끼는 사이는 잔치가 싸고, 정략은 비싸고 서운해한다', () => {
    const r = byeonhanMini(1)
    const pair = couple(r)
    if (pair === null) return // 이 판엔 맺을 수 있는 둘이 없다
    const [a, b] = pair
    const cold = wedCost(r, a, b)
    addTie(r, a, b, P.realm.tieLove)
    assert.ok(wedCost(r, a, b) < cold, '가까우면 싸다')

    const r2 = byeonhanMini(1)
    r2.stock[r2.player!]!.grain = 5000
    const bond0 = r2.heroes[a]!.bond
    const lines: ReportLine[] = []
    assert.equal(wed(r2, { kind: 'wed', faction: r2.player!, a, b }, lines), true, '낯설어도 맺을 수는 있다')
    assert.ok((r2.heroes[a]!.bond ?? P.realm.bondStart) < (bond0 ?? P.realm.bondStart), '정략혼인은 정이 떨어진다')
  })
})
