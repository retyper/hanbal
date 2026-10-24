/**
 * 2장 송양의 활쏘기 겨루기 (scenario.resolveContests · CAMPAIGN §1)
 *  - 이기면 비류국 호감이 크게 오르고 사건이 적힌다 · 지면 조금 식는다
 *  - 한 판에 한 번 · 첫 해 안에만 · 2장이 아니면 없다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { startRegion } from '../../src/realm/data/regions/index.ts'
import { contestOpen } from '../../src/realm/scenario.ts'
import { favorOf } from '../../src/realm/diplomacy.ts'
import { advance } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'

describe('송양의 활쏘기 겨루기', () => {
  it('이기면 비류국 마음이 크게 기울고 사건이 적힌다 — 다시는 못 한다', () => {
    const r = startRegion('jumong', 3, 'goguryeo')
    assert.ok(contestOpen(r, 'goguryeo'))
    const f0 = favorOf(r, 'goguryeo', 'biryuna')
    const { next, report } = advance(r, [{ kind: 'contest', faction: 'goguryeo', id: 'archery', won: true }])
    assert.ok(report.lines.some((l) => l.kind === 'contest' && l.won))
    assert.ok(favorOf(next, 'goguryeo', 'biryuna') >= f0 + P.realm.contestFavorWin - 20) // 계절의 다른 일로 조금 흔들릴 수 있다
    assert.ok(next.scenario?.marks?.includes('archery'))
    assert.ok(!contestOpen(next, 'goguryeo'))
  })
  it('지면 조금 식는다', () => {
    const r = startRegion('jumong', 3, 'goguryeo')
    const won = advance(r, [{ kind: 'contest', faction: 'goguryeo', id: 'archery', won: true }]).next
    const lost = advance(r, [{ kind: 'contest', faction: 'goguryeo', id: 'archery', won: false }]).next
    assert.ok(favorOf(lost, 'goguryeo', 'biryuna') < favorOf(won, 'goguryeo', 'biryuna'))
    assert.ok(!lost.scenario?.marks?.includes('archery'))
  })
  it('첫 해가 지나면 · 다른 판에선 없다', () => {
    const r = startRegion('jumong', 3, 'goguryeo')
    r.season = P.realm.contestSeasons
    assert.ok(!contestOpen(r, 'goguryeo'))
    assert.ok(!contestOpen(startRegion('byeonhan-mini', 3, 'guya'), 'guya'))
  })
})
