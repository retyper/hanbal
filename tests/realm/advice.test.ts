/** 외교 추천 (src/realm/advice.ts · 형 10-31) */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { diploTips } from '../../src/realm/advice.ts'
import { pairKey } from '../../src/realm/diplomacy.ts'

describe('외교 추천', () => {
  it('국경이 맞닿은 아무 사이도 아닌 이웃을 권한다 · 화친을 맺으면 걷힌다', () => {
    const r = byeonhanMini(1)
    const met = diploTips(r, 'us').filter((t) => t.kind === 'met' || t.kind === 'strong')
    assert.ok(met.length > 0)
    const f = met[0]!.to
    r.relations[pairKey('us', f)] = { state: 'truce', until: 20 }
    assert.ok(!diploTips(r, 'us').some((t) => t.to === f))
  })

  it('남과 싸우느라 약해진 이웃은 칠 때다', () => {
    const r = byeonhanMini(1)
    const f = diploTips(r, 'us')[0]!.to
    const other = Object.keys(r.factions).find((x) => x !== 'us' && x !== f)!
    r.relations[pairKey(f, other)] = { state: 'war', until: null }
    // 우리를 아주 세게 — 남의 군세는 우리 정보로만 보이니 그쪽을 깎지 않고 (정보의 계약)
    const ours = Object.values(r.armies).find((a) => a.faction === 'us')!
    ours.mix = { spear: (ours.mix.spear ?? 0) * 30 }
    const t = diploTips(r, 'us').find((x) => x.to === f)
    assert.equal(t?.kind, 'chance')
    assert.equal(t?.foe, other)
  })

  it('같은 판이면 같은 추천 (A1)', () => {
    assert.deepEqual(diploTips(byeonhanMini(3), 'us'), diploTips(byeonhanMini(3), 'us'))
  })
})
