/**
 * 기습은 정면과 다른 싸움 · 소도 제사 · 화친의 장터 · 동맹의 눈 (형, 2026-10-18:
 * "그냥공격하는거랑 기습하는거랑 느껴지는게 없음" · "소도는 왜있는거고?" · "화친이랑 동맹도 되면 뭐가 되는건지 모르겠네")
 *
 *  - 기습이 먹히면 성·지형을 안 받고 장정이 모이지 못한다 (보고 줄 militia 0)
 *  - 들키면 정면보다 못하다 · 큰 군대는 잘 안 숨는다
 *  - movesOf 는 정면 · 기습 · 들킴 승률을 따로 낸다
 *  - 제사: 봄·가을 · 소도 곁 땅 · 곡식 — 봄은 그해 수확, 가을은 사기
 *  - 화친·동맹은 계절마다 장터 곡식 · 동맹은 본 것을 나눈다 · 동맹의 적을 안다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { ambushSizePenalty } from '../../src/realm/battle.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { allyFoe, pairKey } from '../../src/realm/diplomacy.ts'
import { riteAllowed, riteCost } from '../../src/realm/economy.ts'
import { movesOf } from '../../src/realm/estimate.ts'
import { advance, nodeStrength } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, Realm, ReportLine, Tag } from '../../src/realm/types.ts'

type Battle = Extract<ReportLine, { kind: 'battle' }>

/** 갯마을 군장이 뱃길(e03)로 고자미동 갯벌 읍락을 친다 — 그 판의 싸움 줄 */
function hit(r: Realm, ambush: boolean): Battle {
  const { report } = advance(r, [{ kind: 'march', army: 'a-us', edge: 'e03', ambush }])
  const b = report.lines.find((l): l is Battle => l.kind === 'battle')
  assert.ok(b !== undefined)
  return b
}

/** 기습이 먹히는 / 들키는 시드를 찾는다 (같은 시드면 같은 결과) */
function seedWhere(want: 'success' | 'caught', setup: (r: Realm) => void = () => {}): number {
  for (let s = 1; s < 500; s++) {
    const r = byeonhanMini(s)
    setup(r)
    if (hit(r, true).ambush === want) return s
  }
  throw new Error(`기습 ${want} 시드 없음`)
}

/** 고자미동 군대를 갯벌 읍락에 세우고 울타리를 두른다 — 성·장정·군대가 다 있는 고을 */
function guarded(r: Realm): void {
  r.armies['a-goja']!.at = 'goja-vil'
  ;(r.nodes['goja-vil'] as unknown as { tags: Tag[] }).tags = ['palisade', 'high']
}

describe('기습이 먹히면', () => {
  it('장정이 모이지 못한다 — 군대 없는 읍락은 그대로 쥔다', () => {
    const s = seedWhere('success')
    const front = hit(byeonhanMini(s), false)
    const amb = hit(byeonhanMini(s), true)
    assert.ok(front.militia > 0)
    assert.equal(amb.militia, 0)
    assert.equal(amb.p, 1)
    assert.ok(front.p < 1)
  })

  it('성·지형을 안 받는다 — 울타리·높은 터가 있어도 없어도 같은 승산', () => {
    const s = seedWhere('success', guarded)
    const walled = byeonhanMini(s)
    guarded(walled)
    const open = byeonhanMini(s)
    open.armies['a-goja']!.at = 'goja-vil'
    const a = hit(walled, true)
    const b = hit(open, true)
    assert.equal(a.ambush, 'success')
    assert.equal(b.ambush, 'success')
    assert.equal(a.p, b.p)
    // 정면이면 성이 먹힌다
    const fw = byeonhanMini(s)
    guarded(fw)
    assert.ok(hit(fw, false).p < a.p)
  })
})

describe('기습이 들키면', () => {
  it('정면보다 못하다', () => {
    const s = seedWhere('caught', guarded)
    const r1 = byeonhanMini(s)
    guarded(r1)
    const r2 = byeonhanMini(s)
    guarded(r2)
    const caught = hit(r1, true)
    const front = hit(r2, false)
    assert.equal(caught.ambush, 'caught')
    assert.ok(caught.p < front.p)
    assert.ok(caught.militia > 0)
  })
})

describe('큰 군대는 잘 안 숨는다', () => {
  it('ambushFreeMen 까지는 벌점이 없고 그 위 100명마다 ambushPerHundred', () => {
    assert.equal(ambushSizePenalty(P.realm.ambushFreeMen), 0)
    assert.equal(ambushSizePenalty(0), 0)
    assert.ok(Math.abs(ambushSizePenalty(P.realm.ambushFreeMen + 100) - P.realm.ambushPerHundred) < 1e-9)
  })

  it('movesOf 의 기습 확률 — 작은 별동대가 더 높다', () => {
    const r = byeonhanMini(1)
    const big = movesOf(r, 'us', r.armies['a-us']!).find((m) => m.to === 'goja-vil')!
    r.armies['a-us']!.mix = { spear: 40, bow: 20 }
    const small = movesOf(r, 'us', r.armies['a-us']!).find((m) => m.to === 'goja-vil')!
    assert.ok(small.ambushP > big.ambushP)
  })
})

describe('정면 · 기습 · 들킴 승률', () => {
  it('보면 셋이 따로 나온다 — 기습 ≥ 정면 ≥ 들킴', () => {
    const r = byeonhanMini(1)
    guarded(r)
    r.intel['us']!['goja-vil'] = {
      land: true, force: { f0: nodeStrength(r, 'goja-vil', 'goja'), src: 'scout', u: 0.5, season: 0 }, alert: null,
    }
    const m = movesOf(r, 'us', r.armies['a-us']!).find((x) => x.to === 'goja-vil')!
    assert.ok(m.win !== null && m.winAmbush !== null && m.winCaught !== null)
    assert.ok(m.winAmbush[0] > m.win[0])
    assert.ok(m.winCaught[1] < m.win[1])
  })

  it('모르면 셋 다 null', () => {
    const r = byeonhanMini(1)
    const m = movesOf(r, 'us', r.armies['a-us']!).find((x) => x.to === 'goja-vil')!
    assert.equal(m.win, null)
    assert.equal(m.winAmbush, null)
    assert.equal(m.winCaught, null)
  })
})

describe('소도 제사', () => {
  it('봄·가을에만 · 소도 곁 땅을 쥔 나라만 · 곡식이 있어야', () => {
    const r = byeonhanMini(1)
    assert.equal(riteAllowed(r, 'us'), true) // 안개골 읍락이 소도와 맞닿았다
    assert.equal(riteAllowed(r, 'goja'), false)
    const summer = byeonhanMini(1)
    summer.season = 1
    assert.equal(riteAllowed(summer, 'us'), false)
    const poor = byeonhanMini(1)
    poor.stock['us']!.grain = riteCost().grain - 1
    assert.equal(riteAllowed(poor, 'us'), false)
  })

  it('규칙에 안 맞는 제사는 아무 일도 없다', () => {
    const r = byeonhanMini(1)
    const { report, next } = advance(r, [{ kind: 'rite', faction: 'goja' }])
    assert.equal(report.lines.some((l) => l.kind === 'rite'), false)
    assert.equal(next.blessed?.['goja'], undefined)
  })

  it('봄 제사는 그해 가을 수확을 늘린다', () => {
    const run = (orders: Order[]): Extract<ReportLine, { kind: 'harvest' }> => {
      let r = advance(byeonhanMini(1), orders).next
      r = advance(r, []).next // 여름
      const h = advance(r, []).report.lines.find((l) => l.kind === 'harvest' && l.faction === 'us')
      assert.ok(h !== undefined && h.kind === 'harvest')
      return h
    }
    const plain = run([])
    const blessed = run([{ kind: 'rite', faction: 'us' }])
    assert.equal(plain.blessed, undefined)
    assert.ok((blessed.blessed ?? 0) > 0)
    assert.equal(blessed.grain, plain.grain + blessed.blessed!)
  })

  it('봄 제사는 한 해에 한 번 · 곡식이 든다', () => {
    const r = byeonhanMini(1)
    const { next, report } = advance(r, [{ kind: 'rite', faction: 'us' }, { kind: 'rite', faction: 'us' }])
    assert.equal(report.lines.filter((l) => l.kind === 'rite').length, 1)
    assert.equal(next.blessed?.['us'], 0)
    const without = advance(byeonhanMini(1), []).next
    assert.equal(next.stock['us']!.grain, without.stock['us']!.grain - riteCost().grain)
  })

  it('가을 제사는 군대 사기를 올린다 — 천장까지', () => {
    const r = byeonhanMini(1)
    r.season = 2
    r.armies['a-us']!.morale = 1
    const { next, report } = advance(r, [{ kind: 'rite', faction: 'us' }])
    assert.ok(report.lines.some((l) => l.kind === 'rite' && l.season === 'autumn'))
    assert.ok(Math.abs(next.armies['a-us']!.morale - Math.min(P.realm.moraleMax, 1 + P.realm.riteMorale)) < 1e-9)
  })
})

describe('화친·동맹으로 얻는 것', () => {
  it('화친이면 계절마다 둘 다 장터 곡식', () => {
    const r = byeonhanMini(1)
    r.relations[pairKey('us', 'guya')] = { state: 'truce', until: 20 }
    const a = advance(r, [])
    const b = advance(byeonhanMini(1), [])
    assert.ok(a.report.lines.some((l) => l.kind === 'market' && l.grain === P.realm.truceTrade))
    assert.equal(a.next.stock['us']!.grain, b.next.stock['us']!.grain + P.realm.truceTrade)
    assert.equal(a.next.stock['guya']!.grain, b.next.stock['guya']!.grain + P.realm.truceTrade)
  })

  it('동맹은 본 것을 나눈다 — 더 새로운 쪽으로', () => {
    const r = byeonhanMini(1)
    r.relations[pairKey('us', 'miri')] = { state: 'ally', until: null }
    r.intel['miri']!['goja-cap'] = { land: true, force: { f0: 222, src: 'scout', u: 0.3, season: 0 }, alert: null }
    const { next } = advance(r, [])
    assert.equal(next.intel['us']!['goja-cap']?.force?.f0, 222)
    assert.equal(next.intel['miri']!['goja-cap']?.force?.f0, 222)
  })

  it('동맹과 전쟁 중인 나라는 동맹의 적이다', () => {
    const r = byeonhanMini(1)
    r.relations[pairKey('us', 'miri')] = { state: 'ally', until: null }
    r.relations[pairKey('us', 'anya')] = { state: 'war', until: null }
    assert.equal(allyFoe(r, 'miri', 'anya'), true)
    assert.equal(allyFoe(r, 'miri', 'guya'), false)
    assert.equal(allyFoe(r, 'goja', 'anya'), false)
  })
})

describe('결정론', () => {
  it('기습·제사가 섞인 판도 같은 입력이면 같은 결과', () => {
    const orders: Order[] = [{ kind: 'march', army: 'a-us', edge: 'e03', ambush: true }, { kind: 'rite', faction: 'us' }]
    assert.deepEqual(advance(byeonhanMini(7), orders), advance(byeonhanMini(7), orders))
  })
})
