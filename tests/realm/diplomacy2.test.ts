/**
 * 외교 둘째판 · 철의 쓰임 · 집이 느는 길 · 제사의 값 (2026-10-18 — 형: "외교가 좀 재미없음" · "철은 언제 어떻게" · "집은 어떻게 늘리고")
 *
 *  - 관계마다 보낼 수 있는 사신이 다르다 (envoyOptions) — 동맹이면 동맹을 또 청하지 않는다
 *  - 호감: 선물로 오르고, 받아 줄 확률에 들어간다 · 깨기는 다른 나라 호감도 깎는다
 *  - 동맹: 함께 치자(약속 → 지키면 호감 +, 저버리면 −) · 지원 요청 · 군대 빌리기(그 고을로 가서 머물다 돌아간다)
 *  - 동맹이 플레이어에게 건 함께 치자 청을 받으면 플레이어가 약속한다 · 저버리면 호감 −
 *  - 무장 올리기 · 철검 징병 · hhGrowth · 제사 값 · 손으로 쏜 암살(hand) · 결정론
 */
import { aiOrders } from '../../src/realm/ai.ts'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import {
  envoyChance, envoyChanceFor, envoyOptions, favorOf, jointTargets, lentEta, lentStep, pairKey, relationOf,
} from '../../src/realm/diplomacy.ts'
import { armCost, draftIronCost, hhGrowth, riteCost } from '../../src/realm/economy.ts'
import { advance, planned } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { EnvoyAsk, Hand, Order, Realm, ReportLine } from '../../src/realm/types.ts'

const NONE = { grain: 0, iron: 0 }
const envoy = (to: string, ask: EnvoyAsk, extra: Partial<Extract<Order, { kind: 'envoy' }>> = {}): Order =>
  ({ kind: 'envoy', from: 'us', to, ask, give: NONE, take: NONE, ...extra })
const envoyLine = (lines: readonly ReportLine[]) => lines.find((l): l is Extract<ReportLine, { kind: 'envoy' }> => l.kind === 'envoy')

function ally(r: Realm, b: string): void {
  r.relations[pairKey('us', b)] = { state: 'ally', until: null }
}

/** 사신이 받아들여지는 시드 */
function acceptedRun(setup: (r: Realm) => void, o: Order): { before: Realm; next: Realm; lines: readonly ReportLine[] } {
  for (let seed = 1; seed < 500; seed++) {
    const r = planned(byeonhanMini(seed), [])
    setup(r)
    const { next, report } = advance(r, [o])
    if (envoyLine(report.lines)?.accepted) return { before: r, next, lines: report.lines }
  }
  throw new Error('500 시드 안에 한 번도 받아들여지지 않았다')
}

describe('관계마다 다른 사신', () => {
  it('전쟁·중립·화친·동맹마다 고를 것이 다르다 — 동맹이면 동맹을 또 청하지 않는다', () => {
    const r = byeonhanMini(1)
    assert.deepEqual(envoyOptions(r, 'us', 'guya'), ['truce', 'trade', 'gift', 'tribute'])
    r.relations[pairKey('us', 'guya')] = { state: 'war', until: null }
    assert.deepEqual(envoyOptions(r, 'us', 'guya'), ['truce', 'tribute', 'gift'])
    r.relations[pairKey('us', 'guya')] = { state: 'truce', until: 8 }
    assert.ok(envoyOptions(r, 'us', 'guya').includes('alliance'))
    ally(r, 'guya')
    const opts = envoyOptions(r, 'us', 'guya')
    assert.ok(!opts.includes('alliance') && !opts.includes('truce'))
    for (const x of ['joint', 'aid', 'troops', 'break'] as const) assert.ok(opts.includes(x))
  })

  it('그 사이에서 못 보내는 사신은 안 간다', () => {
    const r = byeonhanMini(1)
    ally(r, 'miri')
    const { report } = advance(r, [envoy('miri', 'alliance')])
    assert.equal(envoyLine(report.lines), undefined)
  })
})

describe('호감', () => {
  it('선물은 늘 받고, 호감이 오르고, 곡식이 간다', () => {
    const r = byeonhanMini(1)

    const { next, report } = advance(r, [envoy('guya', 'gift', { give: { grain: 40, iron: 0 } })])
    assert.equal(envoyLine(report.lines)?.accepted, true)
    assert.equal(favorOf(next, 'us', 'guya'), Math.min(P.realm.favorGiftMax, 40 * P.realm.favorGift))
    assert.equal(next.stock['guya']!.grain - advance(byeonhanMini(1), []).next.stock['guya']!.grain, 40)
  })

  it('호감이 높으면 받아 줄 확률이 오른다', () => {
    const r = byeonhanMini(1)
    const cold = envoyChance(r, 'us', 'miri', 'truce')
    r.relations[pairKey('us', 'miri')] = { state: 'neutral', until: null, favor: 60 }
    const warm = envoyChance(r, 'us', 'miri', 'truce')
    assert.ok(warm[1] > cold[1] || warm[1] === P.realm.envoyMax)
    assert.ok(warm[0] > cold[0])
  })

  it('화친을 먼저 깨면 중립 · 그 나라 호감이 크게, 다른 나라 호감도 깎인다', () => {
    const r = byeonhanMini(1)
    r.relations[pairKey('us', 'guya')] = { state: 'truce', until: 8 }
    const { next } = advance(r, [envoy('guya', 'break')])
    assert.equal(relationOf(next, 'us', 'guya').state, 'neutral')
    assert.equal(favorOf(next, 'us', 'guya'), -P.realm.favorBreakSelf)
    assert.equal(favorOf(next, 'us', 'anya'), -P.realm.favorBreakOthers)
  })
})

describe('동맹이 하는 일', () => {
  it('함께 치자 — 약속하고, 그 고을을 쥐면 지킨 것 · 말미가 지나면 저버린 것', () => {
    assert.deepEqual(jointTargets(byeonhanMini(1), 'us', 'miri'), ['guya-iron'])
    const { next } = acceptedRun((r) => ally(r, 'miri'), envoy('miri', 'joint', { target: 'guya-iron' }))
    const pledges = relationOf(next, 'us', 'miri').pledges ?? []
    assert.deepEqual(pledges.map((p) => [p.by, p.node]), [['miri', 'guya-iron']])
    // 지켰다 — 그 고을이 미리미동 땅이 됐다
    const kept = structuredClone(next)
    kept.nodes['guya-iron']!.owner = 'miri'
    const a = advance(kept, [])
    assert.ok(a.report.lines.some((l) => l.kind === 'pledge' && l.kept && l.from === 'miri'))
    assert.ok(favorOf(a.next, 'us', 'miri') > favorOf(next, 'us', 'miri'))
    // 저버렸다 — 말미까지 아무도 안 쳤다
    let r = next
    let broken: ReportLine | undefined
    for (let i = 0; i < P.realm.pledgeSeasons + 1 && broken === undefined; i++) {
      const s = advance(r, [])
      broken = s.report.lines.find((l) => l.kind === 'pledge' && !l.kept)
      r = s.next
    }
    assert.ok(broken !== undefined)
    assert.ok(favorOf(r, 'us', 'miri') < favorOf(next, 'us', 'miri'))
  })

  it('지원 요청은 아무것도 안 주는 교역과 같은 셈 · 저들 창고에 없는 것을 달라면 바닥', () => {
    const r = byeonhanMini(1)
    ally(r, 'miri')
    const none = { grain: 0, iron: 0, salt: 0, wood: 0, horse: 0 }
    const take = { ...none, grain: 40 }
    assert.deepEqual(envoyChanceFor(r, 'us', 'miri', 'aid', none, take), envoyChanceFor(r, 'us', 'miri', 'trade', none, take))
    const huge = { ...none, grain: (r.stock['miri']?.grain ?? 0) + 1 }
    assert.deepEqual(envoyChanceFor(r, 'us', 'miri', 'trade', { ...none, iron: 999 }, huge), [P.realm.envoyMin, P.realm.envoyMin])
  })

  it('지원 요청 — 동맹이 제 창고의 몫까지 곡식을 보탠다', () => {
    const { before, next } = acceptedRun((r) => ally(r, 'miri'), envoy('miri', 'aid', { take: { grain: 50, iron: 0 } }))
    const given = next.stock['us']!.grain - advance(before, []).next.stock['us']!.grain
    assert.ok(given > 0 && given <= 50)
  })

  it('군대 빌리기 — 동맹 군대가 우리 고을로 가서 머물다 말미가 지나면 돌아간다', () => {
    const { next, lines } = acceptedRun((r) => ally(r, 'miri'), envoy('miri', 'troops', { target: 'our-north' }))
    const lent = lines.find((l) => l.kind === 'lent' && !l.back) as Extract<ReportLine, { kind: 'lent' }> | undefined
    assert.ok(lent !== undefined)
    const a = next.armies[lent.army]!
    assert.equal(a.lent?.node, 'our-north')
    assert.deepEqual(lentStep(next, a.id)?.next, 'our-north')
    // 언제 닿는지 — 소식에도 화면에도
    assert.ok((lent.eta ?? 0) > 0 && (lentEta(next, a.id) ?? 0) > 0)
    // 닿으면 한 번 알리고, 말미가 지나면 빌림 표를 거둔다
    let r = next
    let back = false
    let arrived = 0
    for (let i = 0; i < P.realm.troopsSeasons + 2 && !back; i++) {
      const s = advance(r, aiOrders(r)) // 빌린 군대는 제 나라 AI 가 걸린다
      back = s.report.lines.some((l) => l.kind === 'lent' && l.back)
      arrived += s.report.lines.filter((l) => l.kind === 'lent' && l.arrived === true).length
      r = s.next
    }
    assert.ok(back)
    assert.equal(arrived, 1)
    assert.equal(r.armies[lent.army]?.lent, undefined)
  })

  it('동맹이 건 함께 치자 청 — 받으면 우리가 약속, 거절하면 호감이 깎인다', () => {
    const make = (): Realm => {
      const r = byeonhanMini(1)
      ally(r, 'miri')
      r.asks = [{ id: 'ask:0:miri', from: 'miri', to: 'us', kind: 'joint', node: 'guya-iron', give: NONE, take: NONE, until: 0 }]
      return r
    }
    const yes = advance(make(), [{ kind: 'answer', ask: 'ask:0:miri', yes: true }]).next
    assert.deepEqual((relationOf(yes, 'us', 'miri').pledges ?? []).map((p) => [p.by, p.node]), [['us', 'guya-iron']])
    const no = advance(make(), []).next
    assert.equal(favorOf(no, 'us', 'miri'), -P.realm.favorRefuseAlly + P.realm.favorMarket) // 동맹의 장터는 그대로 선다
  })
})

describe('철의 쓰임', () => {
  it('무장 올리기 — 철이 있으면 한 단계, 없으면 아무 일도 없다', () => {
    const r = byeonhanMini(1)
    const c = armCost(r, 'a-us')!
    assert.equal(c.to, 'iron')
    assert.equal(advance(r, [{ kind: 'arm', army: 'a-us' }]).next.armies['a-us']!.equip, 'ironTip')
    r.stock['us']!.iron = c.iron
    const { next, report } = advance(r, [{ kind: 'arm', army: 'a-us' }])
    assert.equal(next.armies['a-us']!.equip, 'iron')
    assert.equal(next.stock['us']!.iron, 0)
    assert.ok(report.lines.some((l) => l.kind === 'arm'))
    assert.equal(armCost(next, 'a-us'), null) // 철검 위는 없다
  })

  it('철검 징병 — 철을 들이면 새 군대가 한 단계 위 장비', () => {
    const r = byeonhanMini(1)
    const ic = draftIronCost(r, 'us', 10)!
    r.stock['us']!.iron = ic.iron
    const { next } = advance(r, [{ kind: 'draft', faction: 'us', node: 'our-north', unit: 'spear', n: 10, iron: true }])
    const a = Object.values(next.armies).find((x) => x.faction === 'us' && x.at === 'our-north')!
    assert.equal(a.equip, ic.to)
    assert.equal(next.stock['us']!.iron, 0)
  })
})

describe('집이 느는 길 · 제사의 값', () => {
  it('먹고 평화로우면 늘고, 곡식이 바닥이면 준다 — 까닭이 붙는다', () => {
    const r = byeonhanMini(1)
    const g = hhGrowth(r, 'our-cap')
    assert.ok(g.per > 0 && g.why.includes('fed'))
    r.stock['us']!.grain = 0
    const h = hhGrowth(r, 'our-cap')
    assert.ok(h.per < 0 && h.why.includes('hunger'))
    // 짐작이 실제와 맞는다
    const r2 = byeonhanMini(1)
    const want = r2.nodes['our-cap']!.hh + hhGrowth(r2, 'our-cap').per
    assert.equal(advance(r2, []).next.nodes['our-cap']!.hh, want)
  })

  it('봄 제사는 나라가 클수록 비싸고, 가을 제사는 철기 제물이 든다', () => {
    const r = byeonhanMini(1)
    const small = riteCost(r, 'us', 'spring')
    const big = riteCost(r, 'miri', 'spring')
    assert.ok(big.grain > small.grain && small.grain >= P.realm.riteGrain)
    assert.deepEqual(riteCost(r, 'us', 'autumn'), { grain: P.realm.riteAutumnGrain, iron: P.realm.riteAutumnIron })
  })
})

describe('손으로 쏜 암살 (SNIPE §0-3)', () => {
  const run = (hand: { result: 'dead' | 'wounded' | 'fled' | 'withdrew'; alarm: boolean }) => {
    const r = byeonhanMini(1)
    r.met = { us: ['guya-1'] }
    return advance(r, [{ kind: 'plot', faction: 'us', op: 'assassin', target: 'guya', hero: 'guya-1', hand }])
  }
  const line = (lines: readonly ReportLine[]) => lines.find((l): l is Extract<ReportLine, { kind: 'plot' }> => l.kind === 'plot')!

  it('굴림 대신 쏜 결과 — dead · wounded 먹힘, fled 는 경보면 들킴, withdrew 는 조용히', () => {
    const dead = run({ result: 'dead', alarm: false })
    assert.equal(dead.next.heroes['guya-1']!.status, 'dead')
    assert.equal(line(dead.report.lines).ok, true)
    const hurt = run({ result: 'wounded', alarm: false })
    assert.equal(hurt.next.heroes['guya-1']!.status, 'free')
    assert.ok((hurt.next.heroes['guya-1']!.woundedUntil ?? -1) >= 0)
    const fled = run({ result: 'fled', alarm: true })
    assert.deepEqual([line(fled.report.lines).ok, line(fled.report.lines).caught], [false, true])
    const quiet = run({ result: 'withdrew', alarm: false })
    assert.deepEqual([line(quiet.report.lines).ok, line(quiet.report.lines).caught], [false, false])
    // 값은 똑같이 든다
    assert.equal(quiet.next.stock['us']!.grain, dead.next.stock['us']!.grain)
  })

  // 건너뛰기 (형: "건너뛰기 버튼도 추가해서") — 쏘지 않고 굴린다. 진짜 지붕을 본 뒤면 굴림이 plotSkipSeenMul 만큼
  const skip = (seed: number, hand?: Hand) => {
    const r = byeonhanMini(seed)
    r.met = { us: ['guya-1'] }
    return advance(r, [{ kind: 'plot', faction: 'us', op: 'assassin', target: 'guya', hero: 'guya-1', ...(hand !== undefined ? { hand } : {}) }])
  }

  it('건너뛰기 — 안 보고 맡기면 안 쏜 것과 같다 · 같은 판이면 같은 결과', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const none = skip(seed)
      const blind = skip(seed, { result: 'skip', alarm: false, seen: false })
      assert.deepEqual(line(blind.report.lines), line(none.report.lines))
      assert.deepEqual(blind.next.heroes['guya-1'], none.next.heroes['guya-1'])
      assert.deepEqual(skip(seed, { result: 'skip', alarm: false, seen: true }), skip(seed, { result: 'skip', alarm: false, seen: true }))
    }
  })

  it('건너뛰기 — 지붕을 본 뒤에 맡기면 굴림이 조금 준다 (먹힌 판의 부분집합 · 더 많이 먹히는 일은 없다)', () => {
    assert.ok(P.realm.plotSkipSeenMul > 0 && P.realm.plotSkipSeenMul < 1)
    let blindOk = 0
    let seenOk = 0
    for (let seed = 1; seed <= 400; seed++) {
      const b = line(skip(seed, { result: 'skip', alarm: false, seen: false }).report.lines).ok
      const s = line(skip(seed, { result: 'skip', alarm: false, seen: true }).report.lines).ok
      if (s) assert.ok(b, `seed ${seed}: 보고 맡긴 쪽만 먹혔다`)
      blindOk += b ? 1 : 0
      seenOk += s ? 1 : 0
    }
    assert.ok(seenOk < blindOk, `본 뒤 ${seenOk} < 안 보고 ${blindOk}`)
    assert.ok(seenOk > 0)
  })
})

describe('결정론', () => {
  it('같은 판 · 같은 명령이면 같은 결과', () => {
    const orders: Order[] = [envoy('miri', 'gift', { give: { grain: 20, iron: 0 } }), envoy('guya', 'truce'), { kind: 'arm', army: 'a-us' }]
    const r = byeonhanMini(7)
    r.stock['us']!.iron = 100
    assert.deepEqual(advance(r, orders), advance(r, orders))
  })
})
