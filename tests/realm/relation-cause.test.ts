/**
 * 전쟁을 누가 걸었나 (형 2026-10-19: "누가 나랑 전쟁나면 상대가 걸어왔다는걸 알려줘야지... 그냥무작정 전쟁이다라 그러면 어떡하냐")
 *  - 땅에 군대를 들이면 그 나라가 건 전쟁 (by · attack) · 화친을 깨고 치면 betray, 다른 나라들은 distrust
 *  - 보고 글이 "○○국이 우리에게 전쟁을 걸어왔다 — …" 로 말한다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { onHostile } from '../../src/realm/diplomacy.ts'
import { reportText } from '../../src/realm/data/prose.ts'
import { startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import type { ReportLine } from '../../src/realm/types.ts'

describe('전쟁을 건 쪽과 까닭', () => {
  it('땅에 들이면 attack · 그 나라가 건 것으로 적힌다', () => {
    const r = startYeongnam(1, 'saro')
    const lines: ReportLine[] = []
    onHostile(r, 'guya', 'saro', lines)
    const war = lines.find((l) => l.kind === 'relation' && l.state === 'war')
    assert.ok(war !== undefined && war.kind === 'relation' && war.by === 'guya' && war.why === 'attack')
    const t = reportText(r, r, war, 'saro')
    assert.ok(t !== null && t.includes('우리에게 전쟁을 걸어왔다') && t.includes('군대를 들였다'))
  })

  it('화친을 깨고 치면 betray · 다른 나라들은 등을 돌린다(distrust)', () => {
    const r = startYeongnam(1, 'saro')
    r.relations[['guya', 'saro'].sort().join('|')] = { state: 'truce', until: 99 }
    r.relations[['guya', 'dabeol'].sort().join('|')] = { state: 'truce', until: 99 }
    const lines: ReportLine[] = []
    onHostile(r, 'guya', 'saro', lines)
    const war = lines.find((l) => l.kind === 'relation' && l.state === 'war')
    assert.ok(war !== undefined && war.kind === 'relation' && war.why === 'betray')
    const back = lines.find((l) => l.kind === 'relation' && l.why === 'distrust' && (l.a === 'dabeol' || l.b === 'dabeol'))
    assert.ok(back !== undefined && back.kind === 'relation' && back.by === 'dabeol')
    assert.ok(reportText(r, r, war, 'saro')!.includes('약조를 깨고'))
  })

  it('남의 나라끼리 전쟁도 누가 먼저였는지 말한다', () => {
    const r = startYeongnam(1, 'saro')
    const lines: ReportLine[] = []
    onHostile(r, 'guya', 'dabeol', lines)
    const war = lines.find((l) => l.kind === 'relation' && l.state === 'war')!
    const t = reportText(r, r, war, 'saro')
    assert.ok(t !== null && t.startsWith(r.factions['guya']!.name))
  })
})
