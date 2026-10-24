/**
 * 동맹 땅의 군대 (형 10-24) — 약속 없이 머물면 그 나라가 언짢아한다 · 동맹을 깬 뒤엔 서 있는 그 고을을 바로 칠 수 있다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { favorOf, relationOf } from '../../src/realm/diplomacy.ts'
import { advance } from '../../src/realm/season.ts'
import type { Realm } from '../../src/realm/types.ts'

/** 우리 군대 하나를 이웃 나라 고을(도읍 아닌 곳)에 세운다 */
const setup = (state: 'ally' | 'neutral'): { r: Realm; army: string; node: string; them: string } => {
  const r = byeonhanMini(5)
  const me = r.player
  const a = Object.values(r.armies).find((x) => x.faction === me)!
  const them = Object.keys(r.factions).find((f) => f !== me)!
  const caps = new Set(Object.values(r.factions).map((f) => f.capital))
  const node = Object.values(r.nodes).find((n) => n.owner === them && !caps.has(n.id))?.id ?? r.factions[them]!.capital
  a.at = node
  a.came = r.season - 2
  ;(r.relations ??= {})[[me, them].sort().join('|')] = { state, until: null, favor: 20 }
  return { r, army: a.id, node, them }
}

describe('동맹 땅의 군대', () => {
  it('동맹 땅에 약속 없이 머물면 그 나라 호감이 내려간다', () => {
    const { r, them } = setup('ally')
    const before = favorOf(r, r.player, them)
    const { next, report } = advance(r, [])
    assert.ok(favorOf(next, next.player, them) < before)
    assert.ok(report.lines.some((l) => l.kind === 'stationed'))
  })
  it('싸울 사이가 된 땅에 서 있으면 그 고을을 바로 친다', () => {
    const { r, army, node, them } = setup('neutral')
    const { next, report } = advance(r, [{ kind: 'assault', army }])
    assert.ok(report.lines.some((l) => l.kind === 'battle' && l.node === node), '그 고을에서 싸움이 났다')
    assert.equal(relationOf(next, next.player, them).state, 'war')
  })
  it('동맹 땅에서는 그 자리 공격 명령이 먹지 않는다', () => {
    const { r, army, node } = setup('ally')
    const { report } = advance(r, [{ kind: 'assault', army }])
    assert.ok(!report.lines.some((l) => l.kind === 'battle' && l.node === node))
  })
})
