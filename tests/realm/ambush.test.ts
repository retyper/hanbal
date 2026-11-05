/**
 * 기습 — 길과 때의 싸움 (형이 고름 — 2026-10-18: "기습전략이 사실상 전략이 없음")
 *
 *  - 숨기는 길과 때가 정한다: 숲·갈대·안개·겨울밤은 좋고, 들길·갯벌·뱃길은 나쁘다. 큰 무리는 눈에 띈다 (concealOf)
 *  - 먹히면 첫 칼 — 맞붙기 전에 지키는 쪽이 먼저 잃는다
 *  - 들키면 되레 매복에 걸린다 — 걸린 군대는 싸운 뒤 사기가 꺾여 있다
 *  - AI 는 숨기 좋은 길로 성 뒤 고을을 칠 때 기습한다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { headcount, hides } from '../../src/realm/battle.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { CONCEAL_LINE } from '../../src/realm/data/prose.ts'
import { movesOf } from '../../src/realm/estimate.ts'
import { guardPick } from '../../src/realm/council.ts'
import { advance, concealOf, forceOf } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, Realm, ReportLine } from '../../src/realm/types.ts'

type Battle = Extract<ReportLine, { kind: 'battle' }>

describe('기습 — 길과 때', () => {
  it('숲길은 좋고 들길은 나쁘다 · 겨울밤은 더 숨는다 · 큰 무리는 눈에 띈다 · 까닭마다 말이 있다', () => {
    const r = byeonhanMini(1)
    r.season = 0 // 봄
    const forest = concealOf(r, 'e19', undefined, 'anya-vil')
    const field = concealOf(r, 'e02', undefined, 'our-east')
    assert.equal(forest.tier, 'good')
    assert.equal(field.tier, 'poor')
    assert.ok(forest.why.includes('forest') && field.why.includes('field'))
    r.season = 3 // 겨울
    const winter = concealOf(r, 'e02', undefined, 'our-east')
    assert.ok(winter.value > field.value && winter.why.includes('winterNight'))
    r.season = 0
    const big = concealOf(r, 'e19', 600, 'anya-vil')
    const small = concealOf(r, 'e19', 40, 'anya-vil')
    assert.ok(big.value < small.value && big.why.includes('bigArmy') && small.why.includes('smallArmy'))
    for (const w of [...forest.why, ...field.why, ...winter.why, ...big.why, ...small.why]) assert.ok(CONCEAL_LINE[w] !== undefined, w)
  })

  /** 갯마을 군대를 안개골에 두고 안야 도읍으로 기습 — `want` 가 되는 시드를 찾는다. 기습은 조건이라(형 11-05) 먹히게 하려면 작은 무리로 방심한 고을을 친다 */
  function find(want: 'success' | 'caught'): { before: Realm; next: Realm; line: Battle } {
    for (let seed = 1; seed <= 400; seed++) {
      const r = byeonhanMini(seed)
      r.armies['a-us']!.at = 'our-north'
      if (want === 'success') { r.armies['a-us']!.mix = { spear: 60 }; r.watch['anya-cap']!.lull = P.realm.lullMax; r.watch['anya-cap']!.alert = 0 }
      const o: Order = { kind: 'march', army: 'a-us', edge: 'e05', ambush: true }
      const res = advance(r, [o])
      const line = res.report.lines.find((l): l is Battle => l.kind === 'battle' && l.node === 'anya-cap')
      if (line !== undefined && line.ambush === want) return { before: r, next: res.next, line }
    }
    throw new Error(`그런 판을 못 찾았다: ${want}`)
  }

  it('먹히면 첫 칼 — 지키는 쪽이 맞붙기 전에 먼저 잃는다', () => {
    const { before, next } = find('success')
    const was = headcount(forceOf(before, before.armies['a-anya-1']!))
    const now = next.armies['a-anya-1']
    const left = now === undefined ? 0 : headcount(forceOf(next, now))
    assert.ok(left <= Math.ceil(was * (1 - P.realm.ambushFirstStrike)) + 1, `${was} → ${left}`)
  })

  it('들키면 되레 매복 — 걸린 군대는 싸운 뒤 사기가 꺾여 있다', () => {
    const { before, next } = find('caught')
    const a = next.armies['a-us']
    if (a === undefined) return // 흩어졌다 — 더 크게 졌다
    assert.ok(a.morale <= Math.max(P.realm.moraleFloor, before.armies['a-us']!.morale - P.realm.ambushCaughtMorale) + 1e-9, `사기 ${a.morale}`)
  })

  it('길마다의 셈에 숨기 좋은 정도와 성이 실린다 (지도·AI 가 같은 값을 본다)', () => {
    const r = byeonhanMini(1)
    r.armies['a-us']!.at = 'our-north'
    const ms = movesOf(r, 'us', r.armies['a-us']!)
    const toAnya = ms.find((m) => m.to === 'anya-cap')!
    assert.equal(toAnya.walled, true)
    assert.ok(['good', 'fair', 'poor'].includes(toAnya.conceal))
  })
})

/** 기습은 주사위가 아니라 조건 (형 11-05: "기습은 확률이 낮으니 거의 안 하게 된다 · 냉병기 전투에서는 어떻게 하더라") */
describe('기습 — 조건', () => {
  const run = (seed: number, good: boolean): { line: Battle | undefined; guard: string | null } => {
    const r = byeonhanMini(seed)
    r.armies['a-us']!.at = 'our-north'
    if (good) { r.armies['a-us']!.mix = { spear: 60 }; r.watch['anya-cap']!.lull = P.realm.lullMax; r.watch['anya-cap']!.alert = 0 }
    else { r.armies['a-us']!.mix = { spear: 2000 }; r.watch['anya-cap']!.lull = 0; r.watch['anya-cap']!.alert = P.realm.alertMax }
    const cmd = Object.values(r.armies).filter((x) => x.at === 'anya-cap' && x.hero !== null).map((x) => r.heroes[x.hero!]!).sort((x, y) => y.ryak - x.ryak || (x.id < y.id ? -1 : 1))[0] ?? null
    const g = guardPick(r, 'anya-cap', r.nodes['anya-cap']!.owner!, 'us', cmd, r.season)
    const res = advance(r, [{ kind: 'march', army: 'a-us', edge: 'e05', ambush: true }])
    return { line: res.report.lines.find((l): l is Battle => l.kind === 'battle' && l.node === 'anya-cap'), guard: g?.ap ?? null }
  }
  it('작은 무리 · 방심한 고을 — 저들이 밤길을 지키지 않으면 어느 판이든 먹힌다', () => {
    let n = 0
    for (let seed = 1; seed <= 30; seed++) {
      const { line, guard } = run(seed, true)
      if (line === undefined || guard === 'night') continue
      n++
      assert.equal(line.ambush, 'success', `씨앗 ${seed}`)
    }
    assert.ok(n > 0)
  })
  it('큰 무리 · 경계 높은 고을 — 어느 판이든 들킨다', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { line } = run(seed, false)
      if (line !== undefined) assert.equal(line.ambush, 'caught', `씨앗 ${seed}`)
    }
  })
  it('문턱 — 숨음이 ambushPass 이상이면 숨는다', () => {
    assert.ok(hides(P.realm.ambushPass) && !hides(P.realm.ambushPass - 0.01))
  })
})
