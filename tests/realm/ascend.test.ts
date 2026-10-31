/**
 * 각성 (형 10-31) — 우리 장수가 내리 이기면 불꽃이 켜지고, ascendWins 번이면 각성해 능력치가 모두 ascendBonus 오른다 (10 을 넘을 수 있다).
 * 지거나 비기면 불꽃이 다 꺼진다. 남의 나라 장수는 각성하지 않는다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { battleGrowth } from '../../src/realm/heroes.ts'
import { P } from '../../src/tune/params.ts'
import type { ReportLine } from '../../src/realm/types.ts'

describe('각성', () => {
  const setup = () => {
    const r = byeonhanMini(1)
    const ours = Object.values(r.heroes).filter((h) => h.faction === r.player && h.status === 'free').sort((a, b) => (a.id < b.id ? -1 : 1))
    const theirs = Object.values(r.heroes).find((h) => h.faction !== r.player && h.status === 'free')!
    return { r, h: ours[ours.length - 1]!, foe: theirs }
  }

  it('내리 이기면 각성하고 능력치가 모두 오른다 · 남의 장수는 안 한다', () => {
    const { r, h, foe } = setup()
    const before = { mu: h.mu, tong: h.tong, ryak: h.ryak, chi: h.chi, deok: h.deok }
    const lines: ReportLine[] = []
    for (let i = 0; i < P.realm.ascendWins; i++) battleGrowth(r, [h.id, foe.id], [], [], lines)
    const now = r.heroes[h.id]!
    assert.equal(now.ascended, true)
    assert.ok(lines.some((l) => l.kind === 'ascend' && l.hero === h.id))
    // 싸움에서 공이 쌓여 무예·통솔이 따로 오를 수 있다 — 적어도 각성 몫은 오른다
    for (const s of ['mu', 'tong', 'ryak', 'chi', 'deok'] as const) assert.ok(now[s] >= before[s] + P.realm.ascendBonus, s)
    assert.notEqual(r.heroes[foe.id]!.ascended, true, '남의 나라 장수는 각성하지 않는다')
  })

  it('지거나 비기면 불꽃이 다 꺼진다', () => {
    const { r, h } = setup()
    const lines: ReportLine[] = []
    battleGrowth(r, [h.id], [], [], lines)
    assert.equal(r.heroes[h.id]!.flames, 1)
    battleGrowth(r, [], [h.id], [], lines)
    assert.equal(r.heroes[h.id]!.flames, undefined)
    battleGrowth(r, [h.id], [], [], lines)
    battleGrowth(r, [], [], [h.id], lines)
    assert.equal(r.heroes[h.id]!.flames, undefined)
    assert.notEqual(r.heroes[h.id]!.ascended, true)
  })
})
