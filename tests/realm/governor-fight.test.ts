/**
 * 성주가 장정을 이끈다 (형 10-26: "장군이 없는 마을에 성주가 있다면 성주가 자동적으로 장군으로서 싸웠으면")
 *
 *  - 장수가 이끄는 제 군대가 없는 고을이면 장정의 장수는 성주 · 도읍은 군주
 *  - 장수가 이끄는 제 군대가 있으면 성주는 나서지 않는다 · 다친 성주도 안 나선다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { postHero, rulerOf } from '../../src/realm/heroes.ts'
import { militiaOf, planned } from '../../src/realm/season.ts'
import type { Realm } from '../../src/realm/types.ts'

/** us-1 이 our-north 에 머물다 그 고을을 맡았다 (멀리서 가면 그 계절은 길에 있다) */
function governed(): Realm {
  const r0 = byeonhanMini(1)
  r0.heroes['us-1']!.at = 'our-north'
  return planned(r0, [{ kind: 'assign', hero: 'us-1', node: 'our-north' }])
}

describe('성주가 장정을 이끈다', () => {
  it('맡긴 고을은 성주가 · 도읍은 군주가 장정을 이끈다', () => {
    const r = governed()
    assert.equal(postHero(r, 'our-north')?.id, 'us-1')
    for (const a of Object.values(r.armies)) if (a.at === 'our-north') delete r.armies[a.id]
    const m = militiaOf(r, 'our-north')
    if (m === null) return // 장정이 없는 판이면 볼 것이 없다
    assert.equal(m.hero, 'us-1')
    const cap = r.factions['us']!.capital
    const led = Object.values(r.armies).some((a) => a.at === cap && a.faction === 'us' && a.hero !== null)
    const mc = militiaOf(r, cap)
    if (mc !== null && !led) assert.equal(mc.hero, rulerOf(r, 'us')?.id)
  })

  it('장수가 이끄는 제 군대가 있거나 성주가 다쳤으면 나서지 않는다', () => {
    const r = governed()
    for (const a of Object.values(r.armies)) if (a.at === 'our-north') delete r.armies[a.id]
    if (militiaOf(r, 'our-north') === null) return
    const chief = Object.values(r.armies).find((a) => a.faction === 'us' && a.hero !== null)!
    r.armies[chief.id] = { ...chief, at: 'our-north', march: null }
    assert.equal(militiaOf(r, 'our-north')!.hero, null)
    delete r.armies[chief.id]
    r.heroes['us-1']!.woundedUntil = r.season
    assert.equal(militiaOf(r, 'our-north')!.hero, null)
  })
})
