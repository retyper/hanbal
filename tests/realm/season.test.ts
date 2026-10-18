/**
 * 한 계절이 돈다 — R1 (docs/realm/BUILD.md §3-1 · §6)
 *
 *  - 같은 시드 + 같은 명령 기록 → 같은 상태 (A1)
 *  - advance 는 받은 판을 건드리지 않는다 (순수 — 저장되는 상태는 "넘기기 전"과 "넘긴 뒤" 둘뿐)
 *  - 판은 JSON 으로 그대로 오간다 (저장·리플레이가 공짜)
 *  - 계절이 길을 바꾼다: 겨울 고개 · 여름 나루
 *  - 아무렇게나 40계절을 돌려도 깨지는 것이 없다 (음수 병력 · 유령 장수 · 없는 고을)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { roll } from '../../src/core/rng.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { PEOPLE_SCALE as S } from '../../src/realm/migrate.ts'
import {
  advance, armiesAt, blockedWhy, conceal, marchSeasons, neighbors, otherEnd, preview, seasonOf,
} from '../../src/realm/season.ts'
import { ambushChance } from '../../src/realm/battle.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, Realm } from '../../src/realm/types.ts'

/** 이름 붙은 주사위로 명령을 지어내는 봇 — 시험용. 머무는 군대마다 이웃 길 하나를 고른다 */
function randomOrders(r: Realm, tag: string): Order[] {
  const out: Order[] = []
  const armies = Object.values(r.armies).filter((a) => a.march === null).sort((x, y) => (x.id < y.id ? -1 : 1))
  for (const a of armies) {
    if (roll(r.seed, r.season, `${tag}:go:${a.id}`) < 0.4) continue
    const edges = Object.values(r.edges).filter((e) => otherEnd(e, a.at) !== null).sort((x, y) => (x.id < y.id ? -1 : 1))
    const ed = edges[Math.floor(roll(r.seed, r.season, `${tag}:edge:${a.id}`) * edges.length)]
    if (ed === undefined) continue
    out.push({ kind: 'march', army: a.id, edge: ed.id, ambush: roll(r.seed, r.season, `${tag}:amb:${a.id}`) < 0.5 })
  }
  for (const f of Object.keys(r.factions).sort()) {
    const target = Object.keys(r.nodes).sort()[Math.floor(roll(r.seed, r.season, `${tag}:scout:${f}`) * Object.keys(r.nodes).length)]!
    out.push({ kind: 'scout', faction: f, node: target, hero: null })
  }
  return out
}

function run(seed: number, seasons: number): Realm {
  let r = byeonhanMini(seed)
  for (let i = 0; i < seasons; i++) r = advance(r, randomOrders(r, 'bot')).next
  return r
}

describe('한 계절이 돈다', () => {
  it('같은 시드 + 같은 명령 → 같은 판 (40계절)', () => {
    assert.deepEqual(run(2026, 40), run(2026, 40))
  })

  it('시드가 다르면 판이 갈린다', () => {
    assert.notDeepEqual(run(1, 40), run(2, 40))
  })

  it('advance 는 받은 판을 건드리지 않는다', () => {
    const r = byeonhanMini(7)
    const before = JSON.stringify(r)
    advance(r, randomOrders(r, 'bot'))
    assert.equal(JSON.stringify(r), before)
  })

  it('판은 JSON 으로 그대로 오간다 — 저장해 불러온 판이 같은 다음 계절을 낸다', () => {
    let r = byeonhanMini(11)
    for (let i = 0; i < 12; i++) r = advance(r, randomOrders(r, 'bot')).next
    const loaded = JSON.parse(JSON.stringify(r)) as Realm
    const o = randomOrders(r, 'bot')
    assert.deepEqual(advance(loaded, o), advance(r, o))
  })

  it('겨울엔 고개가 막히고 여름엔 나루가 막힌다', () => {
    const r = byeonhanMini(3)
    assert.equal(blockedWhy(r.edges['e11']!, 'winter'), 'winterPass')
    assert.equal(blockedWhy(r.edges['e11']!, 'autumn'), null)
    assert.equal(blockedWhy(r.edges['e06']!, 'summer'), 'summerFord')
    assert.equal(blockedWhy(r.edges['e06']!, 'winter'), null) // 언 강은 배 없이 건넌다
    assert.equal(marchSeasons('pass', 'spring'), 2)
    assert.equal(marchSeasons('field', 'summer'), 2)
  })

  it('막힌 길로는 떠나지 않고 보고에 남는다', () => {
    let r = byeonhanMini(3)
    // 봄: 갯마을 → 안개골 (나루 e06 이 안개골에서 나간다). 닿으면 여름
    r = advance(r, [{ kind: 'march', army: 'a-us', edge: 'e01', ambush: false }]).next
    assert.equal(seasonOf(r.season), 'summer')
    assert.equal(r.armies['a-us']!.at, 'our-north')
    const { next, report } = advance(r, [{ kind: 'march', army: 'a-us', edge: 'e06', ambush: false }])
    assert.equal(next.armies['a-us']!.march, null)
    assert.ok(report.lines.some((l) => l.kind === 'blocked' && l.why === 'summerFord'))
  })

  it('PLAY §4 의 겨울 — 언 갈대 나루 기습은 반을 넘는다', () => {
    // 대본: 겨울 갈대 0.15 + 언 강 0.20 + 략 차 2 × 0.05 + 술꾼의 방심 0.10 − 경계 0 → 0.55
    const r = byeonhanMini(1)
    const ed = r.edges['e06']!
    const node = r.nodes['miri-vil']!
    // e06 은 '나루'(ford) 에 갈대 꼬리표 — 나루 0.10 + 언 강 0.20 + 길가 갈대 0.10 + 겨울밤 0.10 (길과 때 — 2026-10-18)
    const c = conceal(ed, node, 'winter')
    const R = P.realm
    assert.ok(Math.abs(c - (R.concealFord + R.ambushWinterIce + R.concealEdgeTag + R.concealWinterNight)) < 1e-12, `은폐 ${c}`)
    const p = ambushChance(c, 6, 4, 0, 0.1, 0)
    assert.ok(p >= 0.5, `기습 ${p}`)
  })

  it('미리 보기는 상태를 안 바꾸고, 이번 계절에 열리는 싸움을 맞힌다', () => {
    let r = byeonhanMini(5)
    // 봄: 갯마을 → 안개골(우리 땅) · 여름은 쉰다(장마엔 들길도 2계절) · 가을: 안야 국읍 (들길 1계절)
    r = advance(r, [{ kind: 'march', army: 'a-us', edge: 'e01', ambush: false }]).next
    r = advance(r, []).next
    const orders: Order[] = [{ kind: 'march', army: 'a-us', edge: 'e05', ambush: true }]
    const before = JSON.stringify(r)
    const keys = preview(r, orders)
    assert.equal(JSON.stringify(r), before)
    assert.deepEqual(keys, ['anya-cap:a-us'])
    const { report } = advance(r, orders)
    assert.ok(report.lines.some((l) => l.kind === 'battle' && l.node === 'anya-cap'))
  })

  it('저격 다리 명중은 생포를 민다 — 같은 굴림에서 다리를 맞히면 사로잡는 판이 늘어난다', () => {
    let capLeg = 0
    let capMiss = 0
    for (let seed = 0; seed < 300; seed++) {
      let r = byeonhanMini(seed)
      r = advance(r, [{ kind: 'march', army: 'a-us', edge: 'e01', ambush: false }]).next
      r = advance(r, []).next // 여름을 건너뛴다
      // 우리 군대를 크게 키워 이기는 판을 많이 만든다 — 생포는 이긴 판에서만 굴린다
      r.armies['a-us']!.mix = { spear: 600 * S, bow: 200 * S }
      const o: Order[] = [{ kind: 'march', army: 'a-us', edge: 'e05', ambush: false }]
      const leg = advance(r, o, { 'anya-cap:a-us': 'leg' }).report.lines.find((l) => l.kind === 'battle')
      const miss = advance(r, o, {}).report.lines.find((l) => l.kind === 'battle')
      if (leg?.kind === 'battle' && leg.captured !== null) capLeg++
      if (miss?.kind === 'battle' && miss.captured !== null) capMiss++
    }
    assert.ok(capLeg > capMiss + 50, `다리 ${capLeg} · 빗나감 ${capMiss}`)
  })

  it('아무렇게나 40계절 — 깨지는 것이 없다 (시드 200개)', () => {
    for (let seed = 0; seed < 200; seed++) {
      let r = byeonhanMini(seed)
      for (let i = 0; i < 40; i++) {
        r = advance(r, randomOrders(r, 'soak')).next
        for (const a of Object.values(r.armies)) {
          for (const v of Object.values(a.mix)) assert.ok((v ?? 0) >= 0, `음수 병력 ${a.id}`)
          assert.ok(r.nodes[a.at] !== undefined, `없는 고을 ${a.at}`)
          if (a.hero !== null) assert.equal(r.heroes[a.hero]?.status, 'free', `잡히거나 죽은 장수가 군대를 이끈다 ${a.id}`)
          if (a.march !== null) assert.ok(a.march.left >= 1)
        }
        for (const h of Object.values(r.heroes)) {
          assert.equal(h.status === 'captive', h.captor !== null)
        }
        for (const w of Object.values(r.watch)) assert.ok(w.alert >= 0 && w.alert <= 0.6 + 1e-12)
        // 머무는 군대의 고을은 그 나라의 땅이거나 소도다 (남의 땅에 머물면 싸움이 났어야 한다)
        for (const n of Object.values(r.nodes)) {
          const factions = new Set(armiesAt(r, n.id).map((a) => a.faction))
          if (n.kind !== 'sodo') assert.ok(factions.size <= 1, `${n.id} 에 두 나라가 함께 머문다 (시드 ${seed} 계절 ${r.season})`)
        }
      }
      assert.equal(r.season, 40)
      assert.ok(neighbors(r, 'our-cap').length > 0)
    }
  })
})
