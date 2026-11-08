/**
 * 곳간을 부을 곳 (wonders.ts · 위원회 11-08 ⑦)
 *  - 큰 공사: 나라가 커져야 열린다 · 한 단씩 나라의 그릇만큼 붓는다 · 다 쌓으면 그 고을에 선다 · 판에 하나
 *  - 남이 먼저 다 지으면 부은 것의 몫을 돌려받는다 · 짓는 동안 고을을 잃으면 무너진다 · 선 공사는 고을을 쥔 나라의 것
 *  - 큰 잔치: 곳간의 몫을 붓고 굴림 하나 (확률의 합 1 · 같은 판이면 같은 결과) · 한동안 다시 못 연다
 *  - 플레이어 자리의 봇도 붓는다 (시뮬로 잰다)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { advance } from '../../src/realm/season.ts'
import { decide } from '../../src/realm/ai.ts'
import { realmScale } from '../../src/realm/scale.ts'
import { goodOf } from '../../src/realm/economy.ts'
import {
  canWonder, feastBlocked, feastOdds, feastPour, greatOpen, hasWonder, rivalWonders, wonderBlocked, wonderHarvestMul, wonderNode, wonderStageCost, wonderWorkOf,
  type WonderId,
} from '../../src/realm/wonders.ts'
import { P } from '../../src/tune/params.ts'
import { HERO_POOL } from '../../src/realm/data/heroes-pool.ts'
import type { Order, Realm } from '../../src/realm/types.ts'

/** 큰 나라 — 집을 늘려 나라의 그릇이 wonderOpenAt 을 넘게 · 곳간을 넉넉히 */
function big(): Realm {
  const r = byeonhanMini(1)
  r.nodes['our-cap']!.hh = 9000
  r.nodes['guya-cap']!.hh = 9000
  for (const f of ['us', 'guya']) { r.stock[f]!.grain = 200000; r.stock[f]!.iron = 5000; r.stock[f]!.wood = 5000 }
  return r
}
const pour = (r: Realm, what: WonderId, faction = r.player): Order => ({ kind: 'wonder', faction, what })

/** 다 쌓을 때까지 단마다 붓는다 (한 턴 한 계절 판) */
function finish(r0: Realm, what: WonderId, faction = r0.player): Realm {
  let r = r0
  for (let i = 0; i < 20 && wonderNode(r, what) === null; i++) r = advance(r, wonderBlocked(r, faction, what) === null ? [pour(r, what, faction)] : []).next
  return r
}

describe('큰 공사', () => {
  it('작은 나라에는 열리지 않는다', () => {
    const r = byeonhanMini(1)
    assert.ok(realmScale(r, 'us') < P.realm.wonderOpenAt)
    assert.equal(greatOpen(r, 'us'), false)
    assert.equal(wonderBlocked(r, 'us', 'sotdae'), '나라가 더 커져야 합니다')
  })

  it('한 단을 부으면 그릇만큼 곡식·나무가 들고 · 쌓는 동안은 더 못 붓는다 · 한 계절 뒤 한 단이 선다', () => {
    const r = big()
    assert.ok(canWonder(r, 'us', 'sotdae'))
    const c = wonderStageCost(r, 'us', 'sotdae')
    assert.equal(c.grain, Math.round(P.realm.wonderGrain * realmScale(r, 'us')))
    const plain = advance(r, []).next
    const { next, report } = advance(r, [pour(r, 'sotdae')])
    assert.ok(report.lines.some((l) => l.kind === 'wonder' && l.ev === 'pour' && l.grain === c.grain))
    assert.equal(Math.round(plain.stock['us']!.grain - next.stock['us']!.grain), c.grain)
    assert.equal(Math.round(goodOf(plain.stock['us'], 'wood') - goodOf(next.stock['us'], 'wood')), c.n)
    const w = wonderWorkOf(next, 'us')!
    assert.equal(w.stage, 1) // 한 턴 한 계절 판 — 그 턴 끝에 선다
    assert.equal(w.node, 'our-cap')
    assert.ok(report.lines.some((l) => l.kind === 'wonder' && l.ev === 'stage' && l.stage === 1))
  })

  it('다른 공사를 짓는 동안은 새 공사를 못 연다', () => {
    const r = advance(big(), [pour(big(), 'sotdae')]).next
    assert.match(wonderBlocked(r, 'us', 'furnace') ?? '', /솟대 숲/)
  })

  it('다 쌓으면 도읍에 선다 · 가을걷이가 는다 · 다시는 못 짓는다', () => {
    const r = finish(big(), 'sotdae')
    assert.equal(r.nodes['our-cap']!.wonder, 'sotdae')
    assert.ok(hasWonder(r, 'us', 'sotdae'))
    assert.equal(wonderHarvestMul(r, 'us'), 1 + P.realm.wonderHarvest)
    assert.equal(wonderWorkOf(r, 'us'), null)
    assert.equal(wonderBlocked(r, 'us', 'sotdae'), '이미 섰습니다')
    assert.equal(wonderBlocked(r, 'guya', 'sotdae'), '이미 섰습니다')
  })

  it('남이 먼저 다 지으면 부은 곡식의 몫을 돌려받는다', () => {
    let r = big()
    // 구야가 두 단 앞서 짓는다
    r = advance(r, [pour(r, 'dolmen', 'guya')]).next
    r = advance(r, [pour(r, 'dolmen', 'guya')]).next
    r = advance(r, [pour(r, 'dolmen', 'guya'), pour(r, 'dolmen')]).next
    const poured = wonderWorkOf(r, 'us')!.poured.grain
    assert.ok(poured > 0)
    const { next, report } = advance(r, [pour(r, 'dolmen', 'guya')])
    assert.equal(next.nodes['guya-cap']!.wonder, 'dolmen')
    const beaten = report.lines.find((l) => l.kind === 'wonder' && l.ev === 'beaten')
    assert.ok(beaten !== undefined && beaten.kind === 'wonder')
    assert.equal(beaten.grain, Math.round(poured * P.realm.wonderRefund))
    assert.equal(beaten.by, 'guya')
    assert.equal(wonderWorkOf(next, 'us'), null)
  })

  it('남이 짓는 것은 단을 범위로만 안다', () => {
    let r = big()
    r = advance(r, [pour(r, 'altar', 'guya')]).next
    r = advance(r, [pour(r, 'altar', 'guya')]).next
    const xs = rivalWonders(r, 'us')
    assert.equal(xs.length, 1)
    assert.equal(xs[0]!.faction, 'guya')
    assert.ok(xs[0]!.lo <= 2 && xs[0]!.hi >= 2 && xs[0]!.hi > xs[0]!.lo)
  })

  it('짓는 동안 그 고을을 잃으면 무너진다 · 선 공사는 고을을 쥔 나라의 것이 된다', () => {
    let r = advance(big(), [pour(big(), 'furnace')]).next
    r.nodes['our-cap']!.owner = 'guya'
    const { next, report } = advance(r, [])
    assert.ok(report.lines.some((l) => l.kind === 'wonder' && l.ev === 'lost'))
    assert.equal(wonderWorkOf(next, 'us'), null)

    const done = finish(big(), 'furnace')
    assert.ok(hasWonder(done, 'us', 'furnace'))
    done.nodes['our-cap']!.owner = 'guya'
    assert.ok(hasWonder(done, 'guya', 'furnace'))
    assert.equal(hasWonder(done, 'us', 'furnace'), false)
  })

  it('같은 판 같은 명령이면 같은 결과 (A1)', () => {
    const a = finish(big(), 'altar')
    const b = finish(big(), 'altar')
    assert.equal(JSON.stringify(a), JSON.stringify(b))
  })
})

describe('큰 잔치', () => {
  it('확률의 합은 1 · 손님이 없으면 그 몫은 좋은 잔치로', () => {
    const r = big()
    const o = feastOdds(r, 'us')
    assert.ok(Math.abs(o.guest + o.king + o.joy - 1) < 1e-9)
    assert.ok(o.guest > 0)
    r.poolUsed = HERO_POOL.map((h) => h.id)
    const o2 = feastOdds(r, 'us')
    assert.equal(o2.guest, 0)
    assert.ok(Math.abs(o2.king + o2.joy - 1) < 1e-9)
  })

  it('곳간의 몫을 붓고 · 하나가 나오고 · 한동안 다시 못 연다 · 같은 판이면 같은 갈래', () => {
    const r = big()
    assert.equal(feastBlocked(r, 'us'), null)
    const g = feastPour(r, 'us')
    assert.equal(g, Math.floor(200000 * P.realm.feastShare))
    const a = advance(r, [{ kind: 'feast', faction: 'us' }])
    const b = advance(r, [{ kind: 'feast', faction: 'us' }])
    const line = a.report.lines.find((l) => l.kind === 'feast')
    assert.ok(line !== undefined && line.kind === 'feast')
    assert.equal(line.grain, g)
    assert.deepEqual(line, b.report.lines.find((l) => l.kind === 'feast'))
    if (line.got === 'guest') assert.ok((a.next.wanderers ?? []).some((w) => w.hero.id === line.who && w.price === 0))
    assert.equal(feastBlocked(a.next, 'us'), '지난 잔치의 여운이 남았습니다')
  })

  it('곳간이 모자라면 못 연다', () => {
    const r = big()
    r.stock['us']!.grain = 10
    assert.equal(feastBlocked(r, 'us'), '곳간이 더 차야 합니다')
  })
})

describe('봇도 붓는다', () => {
  it('곳간이 넘치는 큰 나라면 계절 끝에 큰 공사 한 단을 붓는다', () => {
    const r = big()
    const os = decide(r, 'us', 'planner')
    assert.ok(os.some((o) => o.kind === 'wonder'))
  })
})
