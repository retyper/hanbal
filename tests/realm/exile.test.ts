/**
 * 도읍을 잃은 조정 (season.stepExile · 형: "내도읍 뺏기자마자 지는건 좀 오바")
 *
 *  - 도읍이 넘어가도 바로 지지 않는다 — 가장 큰 제 고을로 피하고 exileSeasons 를 버틴다
 *  - 그 안에 되찾으면 돌아온다 · 못 되찾으면 진다 · 고을을 다 잃으면 진다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { advance, checkOutcome } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm } from '../../src/realm/types.ts'

const fall = (r: Realm): string => {
  const cap = r.factions[r.player]!.capital
  r.nodes[cap]!.owner = 'anya'
  return cap
}

describe('도읍을 잃은 조정', () => {
  it('도읍이 넘어가면 가장 큰 고을로 피하고, 기한 안엔 지지 않는다', () => {
    let r = byeonhanMini(3)
    const cap = fall(r)
    const { next, report } = advance(r, [])
    r = next
    const ex = r.factions[r.player]!.exile
    assert.ok(ex !== undefined, '피했다')
    assert.equal(r.nodes[ex.seat]!.owner, r.player)
    assert.ok(report.lines.some((l) => l.kind === 'exile' && l.capital === cap))
    assert.equal(r.outcome ?? null, null)
    assert.equal(checkOutcome(r), null)
  })

  it('기한 안에 되찾으면 돌아온다', () => {
    let r = byeonhanMini(3)
    const cap = fall(r)
    r = advance(r, []).next
    r.nodes[cap]!.owner = r.player
    const { next, report } = advance(r, [])
    assert.equal(next.factions[next.player]!.exile, undefined)
    assert.ok(report.lines.some((l) => l.kind === 'retake'))
  })

  it('기한이 지나면 진다 · 고을을 다 잃으면 바로 진다', () => {
    let r = byeonhanMini(3)
    const cap = fall(r)
    for (let i = 0; i <= P.realm.exileSeasons && (r.outcome ?? null) === null; i++) {
      r.nodes[cap]!.owner = 'anya'
      r = advance(r, []).next
    }
    assert.equal(r.outcome?.kind, 'lose')
    const b = byeonhanMini(3)
    for (const n of Object.values(b.nodes)) if (n.owner === b.player) n.owner = 'anya'
    assert.equal(checkOutcome(b), 'lose')
  })
})
