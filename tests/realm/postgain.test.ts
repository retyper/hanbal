/**
 * 고을 맡기의 득 (postgain.ts · 형 11-04 "어느 마을을 보내야 뭐가 좋은지 선택지에서 다 보여야 함")
 *  - 화면의 숫자가 실제 셈과 같다 — 앉힌 판의 nodeHarvest·militiaMen 과 맞는다
 *  - 판을 고치지 않는다
 *  - 농사꾼은 가을걷이가 늘고, 대장장이는 쇠가, 철의 손은 철검이 붙는다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { militiaMen, nodeHarvest } from '../../src/realm/economy.ts'
import { postGain } from '../../src/realm/postgain.ts'
import { P } from '../../src/tune/params.ts'

describe('고을 맡기의 득', () => {
  it('실제로 앉힌 판과 숫자가 같다 · 판을 고치지 않는다', () => {
    const r = byeonhanMini(1)
    const before = structuredClone(r)
    const g = postGain(r, 'us-1', 'our-north')
    assert.deepEqual(r, before)
    assert.ok(g.grain > 0, `농사꾼 가을걷이 ${g.grain}`)
    const sat = structuredClone(r)
    const base = nodeHarvest(sat, 'our-north')
    const baseM = militiaMen(sat, 'our-north')
    sat.heroes['us-1']!.post = 'our-north'
    sat.heroes['us-1']!.at = 'our-north'
    assert.equal(nodeHarvest(sat, 'our-north') - base, g.grain)
    assert.equal(militiaMen(sat, 'our-north') - baseM, g.militia)
  })

  it('특성이 득에 걸린다 — 대장장이 쇠 · 철의 손 철검', () => {
    const r = byeonhanMini(1)
    const smith = postGain(r, 'guya-ruler', 'guya-cap')
    assert.ok(smith.iron >= P.realm.traitSmith)
    assert.equal(postGain(r, 'guya-1', 'guya-cap').ironhand, true)
    assert.equal(postGain(r, 'us-1', 'our-north').ironhand, false)
  })
})
