/**
 * 말 탄 군대는 뭍길이 빠르다 (형 11-05: "기병 부대는 이동 달도 짧아야") — 섞인 군대는 보병에 맞추고 뱃길은 그대로
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { startRegion } from '../../src/realm/data/regions/index.ts'
import { marchCut } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Army, REdge } from '../../src/realm/types.ts'

describe('기병 행군', () => {
  const r = startRegion('byeonhan-mini', 7, 'us')
  const base = Object.values(r.armies).find((a) => a.faction === r.player)!
  const road = Object.values(r.edges).find((e) => e.kind !== 'sea')!
  const sea: REdge = { ...road, kind: 'sea' }
  const army = (mix: Army['mix']): Army => ({ ...base, hero: null, mix })

  it('기병이 대부분이면 뭍길에서 덜 걸린다', () => {
    assert.equal(marchCut(r, army({ horse: 300 }), road), Math.round(P.realm.horseMarchCut))
    assert.equal(marchCut(r, army({ horse: 300, spear: 50 }), road), Math.round(P.realm.horseMarchCut))
  })
  it('보병이 섞이면 보병에 맞춘다 · 뱃길은 그대로', () => {
    assert.equal(marchCut(r, army({ horse: 100, spear: 300 }), road), 0)
    assert.equal(marchCut(r, army({ horse: 300 }), sea), 0)
  })
})
