/** 옛 판의 깨어난 장수 — 불꽃이 지워져 있었다 · 이제 불꽃은 연료라 다 켠 채로 이어 간다 (sim-lens 11-04) */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { migrate } from '../../src/realm/migrate.ts'
import { P } from '../../src/tune/params.ts'

describe('옛 판 각성 장수의 불꽃', () => {
  it('ascended 인데 불꽃이 없으면 다 켠다', () => {
    const r = byeonhanMini(1)
    const h = r.heroes['us-1']!
    h.ascended = true
    delete h.flames
    migrate(r)
    assert.equal(r.heroes['us-1']!.flames, Math.round(P.realm.ascendWins))
  })
})
