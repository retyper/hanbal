/** 판 끝 칭호 (src/realm/title.ts · META §7-1) */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { titleOf } from '../../src/realm/title.ts'

describe('판 끝 칭호', () => {
  it('끝나지 않은 판엔 없다 · 이긴 길마다 다르다 · 진 판은 비류', () => {
    const r = byeonhanMini(1)
    assert.equal(titleOf(r), null)
    const names = (['conquest', 'suzerain', 'ironsea', 'rite'] as const).map((path) => { r.outcome = { kind: 'win', season: 9, path }; return titleOf(r)!.name })
    assert.deepEqual(names, ['동명', '혁거세', '수로', '해모수'])
    r.outcome = { kind: 'lose', season: 9 }
    assert.equal(titleOf(r)!.name, '비류')
  })
})
