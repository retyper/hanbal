/**
 * 도읍 — 궁궐 네 단 · 조정 세 자리 (palace.ts · docs/realm/CAPITAL.md §1-1 · §1-2)
 *  - 궁궐: 단 하나를 palaceStages 번 나눠 붓는다 · 값은 나라의 그릇만큼 · 도읍을 잃으면 한 단 내려온다 · 4단이면 도읍 지킴이 는다
 *  - 조정: 2단부터 재상·대장군, 3단 천군 · 앉은 장수는 출정·맡기기에서 빠지고 도읍에 머문다 · 자리 힘이 셈에 걸린다
 *  - 대신 뽑기: 대장군이 앉아야 켜진다 · 판 규칙 안에서 징병한다
 *  - 결정론 · 옛 저장(palace 없음)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { advance } from '../../src/realm/season.ts'
import { realmScale } from '../../src/realm/scale.ts'
import { workMulAt } from '../../src/realm/works.ts'
import { draftLimit, draftPay } from '../../src/realm/economy.ts'
import { fortMul } from '../../src/realm/season.ts'
import { riteMul } from '../../src/realm/heroes.ts'
import {
  autoDraftOn, canPalace, heroSeat, palaceBlocked, palaceCost, palaceTier, seatBlocked, seatDraftMul, seatFx, seatHero, seatMorale, seatOmenMul, seatOpen, seatRiteMul, seatWorkMul,
  type Seat,
} from '../../src/realm/palace.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, Realm } from '../../src/realm/types.ts'

/** 큰 나라 — 집을 늘려 그릇을 키우고 · 곳간을 넉넉히 */
function big(): Realm {
  const r = byeonhanMini(1)
  r.nodes['our-cap']!.hh = 9000
  r.nodes['guya-cap']!.hh = 9000
  for (const f of ['us', 'guya']) { r.stock[f]!.grain = 900000; r.stock[f]!.iron = 9000; r.stock[f]!.wood = 9000 }
  return r
}
const pal = (): Order => ({ kind: 'palace', faction: 'us' })
const seat = (s: Seat, hero: string | null): Order => ({ kind: 'seat', faction: 'us', seat: s, hero })

/** 한 단이 다 오를 때까지 — 한 번 붓고 다음 턴 끝에 서니 한 번씩 (한 턴 한 계절 판) */
function raise(r0: Realm, to: number): Realm {
  let r = r0
  for (let i = 0; i < 40 && palaceTier(r, 'us') < to; i++) r = advance(r, palaceBlocked(r, 'us') === null ? [pal()] : []).next
  return r
}

describe('궁궐', () => {
  it('처음은 1단 · 값은 나라의 그릇을 따라 커진다', () => {
    const r = byeonhanMini(1)
    assert.equal(palaceTier(r, 'us'), 1)
    const b = big()
    assert.ok(realmScale(b, 'us') > realmScale(r, 'us'))
    assert.ok(palaceCost(b, 'us', 2).grain > palaceCost(r, 'us', 2).grain)
    assert.ok(palaceCost(b, 'us', 4).grain > palaceCost(b, 'us', 3).grain)
    assert.equal(palaceCost(b, 'us', 2).iron, 0)
    assert.ok(palaceCost(b, 'us', 3).iron > 0)
    assert.equal(palaceCost(b, 'us', 2).grain, Math.round((P.realm.palaceGrain2 * realmScale(b, 'us')) / Math.round(P.realm.palaceStages)))
  })

  it('한 번 부으면 곡식·나무가 들고 쌓는 동안은 더 못 붓는다 · 단마다 palaceStages 번 쌓아야 오른다', () => {
    const r = big()
    assert.ok(canPalace(r, 'us'))
    const c = palaceCost(r, 'us')
    const plain = advance(r, []).next
    const { next, report } = advance(r, [pal()])
    assert.ok(report.lines.some((l) => l.kind === 'palace' && l.ev === 'pour' && l.grain === c.grain))
    assert.equal(Math.round(plain.stock['us']!.grain - next.stock['us']!.grain), c.grain)
    // 한 턴 한 계절 판 — 그 턴 끝에 한 번이 선다
    assert.equal(next.factions['us']!.palace!.stage, 1)
    assert.equal(palaceTier(next, 'us'), 1)
    assert.ok(report.lines.some((l) => l.kind === 'palace' && l.ev === 'stage'))
    // 쌓는 중에 또 부으면 헛수고
    const again = advance(next, [pal(), pal()]).next
    assert.ok(again.factions['us']!.palace!.stage <= 2)
    const r2 = raise(big(), 2)
    assert.equal(palaceTier(r2, 'us'), 2)
    assert.equal(r2.factions['us']!.palace!.stage, 0)
  })

  it('4단까지 오르고 그 뒤는 막힌다 · 4단 도읍은 지킴이 는다', () => {
    const r = raise(big(), 4)
    assert.equal(palaceTier(r, 'us'), 4)
    assert.equal(palaceBlocked(r, 'us'), '이미 토성 궁성입니다')
    const cap = r.nodes['our-cap']!
    assert.equal(cap.walled, true)
    assert.ok(fortMul(cap, 'spring') >= P.realm.palaceFort)
    const bare = { ...cap }
    delete bare.walled
    assert.equal(fortMul(bare, 'spring') * P.realm.palaceFort, fortMul(cap, 'spring'))
  })

  it('곳간이 모자라면 못 붓는다 · 배우는 판·이야기 장은 막힌다', () => {
    const r = big()
    r.stock['us']!.grain = 5
    assert.equal(canPalace(r, 'us'), false)
    const t = big()
    t.region = 'tutorial'
    assert.match(palaceBlocked(t, 'us') ?? '', /배우는 판/)
  })

  it('도읍을 잃으면 한 단 내려온다 · 한 번만 · 되찾으면 다시 오를 수 있다', () => {
    let r = raise(big(), 3)
    r.nodes['our-cap']!.owner = 'guya'
    const a = advance(r, [])
    assert.ok(a.report.lines.some((l) => l.kind === 'palace' && l.ev === 'fall' && l.tier === 2))
    assert.equal(palaceTier(a.next, 'us'), 2)
    // 잃은 채 한 턴 더 — 또 내려오지 않는다
    assert.equal(palaceTier(advance(a.next, []).next, 'us'), 2)
    // 되찾으면
    r = a.next
    r.nodes['our-cap']!.owner = 'us'
    r = advance(r, []).next
    assert.equal(r.factions['us']!.palace!.lost, undefined)
    assert.ok(palaceBlocked(r, 'us') === null)
  })

  it('4단에서 도읍을 잃으면 성벽 표시도 걷힌다', () => {
    const r = raise(big(), 4)
    r.nodes['our-cap']!.owner = 'guya'
    const n = advance(r, []).next
    assert.equal(palaceTier(n, 'us'), 3)
    assert.equal(n.nodes['our-cap']!.walled, undefined)
  })
})

describe('조정', () => {
  it('1단에는 모두 잠겨 있다 · 2단에 재상·대장군 · 3단에 천군', () => {
    const r = big()
    assert.equal(seatOpen(r, 'us', 'chancellor'), false)
    assert.match(seatBlocked(r, 'us', 'general', 'us-1') ?? '', /2단/)
    const r2 = raise(big(), 2)
    assert.equal(seatBlocked(r2, 'us', 'chancellor', 'us-1'), null)
    assert.equal(seatBlocked(r2, 'us', 'general', 'us-1'), null)
    assert.match(seatBlocked(r2, 'us', 'priest', 'us-1') ?? '', /3단/)
    const r3 = raise(big(), 3)
    assert.equal(seatBlocked(r3, 'us', 'priest', 'us-1'), null)
  })

  it('앉히면 도읍에 머문다 · 비우면 풀린다 · 군주·남의 장수는 못 앉는다 · 한 장수는 한 자리', () => {
    let r = raise(big(), 2)
    assert.equal(seatBlocked(r, 'us', 'chancellor', 'us-ruler'), '군주는 앉지 않습니다')
    assert.equal(seatBlocked(r, 'us', 'chancellor', 'nobody'), '우리 장수가 아닙니다')
    r.heroes['us-1']!.at = 'our-north'
    const a = advance(r, [seat('chancellor', 'us-1')])
    assert.ok(a.report.lines.some((l) => l.kind === 'seat' && l.hero === 'us-1'))
    r = a.next
    assert.equal(heroSeat(r, 'us-1'), 'chancellor')
    assert.equal(seatHero(r, 'us', 'chancellor')!.id, 'us-1')
    assert.equal(r.heroes['us-1']!.at, 'our-cap')
    // 같은 장수를 다른 자리에 — 옮겨 앉는다
    r = advance(r, [seat('general', 'us-1')]).next
    assert.equal(heroSeat(r, 'us-1'), 'general')
    assert.equal(seatHero(r, 'us', 'chancellor'), null)
    // 비우기
    r = advance(r, [seat('general', null)]).next
    assert.equal(heroSeat(r, 'us-1'), null)
    assert.equal(r.factions['us']!.seats, undefined)
  })

  it('앉은 장수는 고을 맡기·군대 이끌기에서 빠진다', () => {
    let r = raise(big(), 2)
    r = advance(r, [seat('chancellor', 'us-1')]).next
    const away = advance(r, [{ kind: 'assign', hero: 'us-1', node: 'our-north' }]).next
    assert.equal(away.heroes['us-1']!.post, null)
    assert.equal(away.heroes['us-1']!.at, 'our-cap')
    const army = Object.values(r.armies).find((a) => a.faction === 'us')!
    army.hero = null
    const led = advance(r, [{ kind: 'lead', hero: 'us-1', army: army.id }]).next
    assert.equal(led.armies[army.id]!.hero, null)
    assert.equal(heroSeat(led, 'us-1'), 'chancellor')
  })

  it('군대를 이끄는 장수는 못 앉는다', () => {
    const r = raise(big(), 2)
    assert.equal(seatBlocked(r, 'us', 'general', 'chief'), '군대를 이끌고 있습니다')
  })

  it('단이 내려와 자리가 잠기면 앉은 장수는 풀려난다', () => {
    let r = raise(big(), 3)
    r = advance(r, [seat('priest', 'us-2')]).next
    assert.equal(heroSeat(r, 'us-2'), 'priest')
    r.nodes['our-cap']!.owner = 'guya'
    r = advance(r, []).next
    assert.equal(heroSeat(r, 'us-2'), null)
  })

  it('옛 저장 — palace·seats 가 없어도 읽는다', () => {
    const r = byeonhanMini(1)
    assert.equal(r.factions['us']!.palace, undefined)
    assert.equal(palaceTier(r, 'us'), 1)
    assert.equal(heroSeat(r, 'us-1'), null)
    assert.equal(seatWorkMul(r, 'us'), 1)
    assert.equal(seatDraftMul(r, 'us'), 1)
    assert.equal(seatMorale(r, 'us'), 0)
    assert.equal(seatRiteMul(r, 'us'), 1)
    assert.equal(seatOmenMul(r, 'us'), 1)
    assert.doesNotThrow(() => advance(r, []))
    assert.equal(autoDraftOn(r, 'us'), false)
  })
})

describe('자리의 힘', () => {
  it('재상의 내정이 일터 소출에 · 대장군의 무예가 징병에 · 천군의 매력이 제사에 걸린다', () => {
    let r = raise(big(), 3)
    const w0 = workMulAt(r, 'our-north', 'harvest')
    const d0 = draftPay(r, 'us', 100).grain
    const lim0 = draftLimit(r, 'us', 'our-north')
    const rite0 = riteMul(r, 'us')
    r.heroes['us-1']!.chi = 10
    r.heroes['us-2']!.mu = 10
    r.heroes['us-ruler']!.deok = 8
    r.heroes['us-1']!.deok = 10
    r = advance(r, [seat('chancellor', 'us-1')]).next
    assert.ok(Math.abs(workMulAt(r, 'our-north', 'harvest') - w0 * (1 + 10 * P.realm.seatChi)) < 1e-9)
    r = advance(r, [seat('general', 'us-2')]).next
    assert.ok(seatMorale(r, 'us') > 0)
    assert.ok(draftPay(r, 'us', 100).grain < d0)
    assert.ok(draftLimit(r, 'us', 'our-north') >= lim0 || lim0 === 0)
    r = advance(r, [seat('priest', 'us-1')]).next // 한 장수는 한 자리 — 재상에서 천군으로
    assert.equal(seatWorkMul(r, 'us'), 1)
    assert.ok(riteMul(r, 'us') > rite0)
    assert.ok(seatOmenMul(r, 'us') < 1)
    // 화면 미리보기가 엔진 셈과 같다
    assert.deepEqual(seatFx('chancellor', r.heroes['us-1']!), [`일터 소출 +${Math.round(10 * P.realm.seatChi * 1000) / 10}%`])
  })

  it('대장군이 앉은 징병은 새 군사의 사기가 높고 곡식이 덜 든다', () => {
    const base = raise(big(), 2)
    base.nodes['our-north']!.hh = 3000
    base.heroes['us-1']!.mu = 10
    const plain = advance(base, [{ kind: 'draft', faction: 'us', node: 'our-north', unit: 'spear', n: 100 }])
    const seated = advance(advance(base, [seat('general', 'us-1')]).next, [{ kind: 'draft', faction: 'us', node: 'our-north', unit: 'spear', n: 100 }])
    const mor = (x: Realm): number => Object.values(x.armies).find((a) => a.faction === 'us' && a.at === 'our-north')!.morale
    assert.ok(mor(seated.next) > mor(plain.next))
    assert.ok(mor(seated.next) <= P.realm.moraleMax)
  })

  it('계절 끝마다 앉은 장수와 군주의 정이 오른다', () => {
    let r = raise(big(), 2)
    r = advance(r, [seat('chancellor', 'us-1')]).next
    const b0 = r.heroes['us-1']!.bond ?? P.realm.bondStart
    const b1 = advance(r, []).next.heroes['us-1']!.bond ?? P.realm.bondStart
    assert.ok(b1 > b0)
  })
})

describe('대신 뽑기', () => {
  it('대장군이 없으면 켜지지 않는다 · 앉으면 켜지고 · 대장군을 비우면 꺼진다', () => {
    let r = raise(big(), 2)
    r = advance(r, [{ kind: 'autoDraft', faction: 'us', on: true }]).next
    assert.equal(r.factions['us']!.autoDraft, undefined)
    r = advance(r, [seat('general', 'us-1')]).next
    r = advance(r, [{ kind: 'autoDraft', faction: 'us', on: true }]).next
    assert.equal(autoDraftOn(r, 'us'), true)
    r = advance(r, [seat('general', null)]).next
    assert.equal(r.factions['us']!.autoDraft, undefined)
  })

  it('켜 두면 계절마다 징병한다 (봄은 쉰다) · 끄면 안 한다', () => {
    let r = raise(big(), 2)
    r = advance(r, [seat('general', 'us-1')]).next
    r = advance(r, [{ kind: 'autoDraft', faction: 'us', on: true }]).next
    const men = (x: Realm): number => Object.values(x.armies).filter((a) => a.faction === 'us').reduce((s, a) => s + Object.values(a.mix).reduce((t, v) => t + (v ?? 0), 0), 0)
    let drafted = false
    let t = r
    for (let i = 0; i < 6; i++) {
      const { next, report } = advance(t, [])
      if (report.lines.some((l) => l.kind === 'draft' && l.faction === 'us')) { drafted = true; assert.ok(men(next) > men(t)) }
      t = next
    }
    assert.ok(drafted)
    let off = advance(r, [{ kind: 'autoDraft', faction: 'us', on: false }]).next
    for (let i = 0; i < 4; i++) {
      const { next, report } = advance(off, [])
      assert.ok(!report.lines.some((l) => l.kind === 'draft' && l.faction === 'us'))
      off = next
    }
  })
})

describe('결정론', () => {
  it('같은 판 같은 명령이면 같은 결과 (A1)', () => {
    const run = (): Realm => {
      let r = raise(big(), 3)
      r = advance(r, [seat('general', 'us-1'), seat('chancellor', 'us-2')]).next
      r = advance(r, [{ kind: 'autoDraft', faction: 'us', on: true }]).next
      for (let i = 0; i < 4; i++) r = advance(r, []).next
      return r
    }
    assert.equal(JSON.stringify(run()), JSON.stringify(run()))
  })
})
