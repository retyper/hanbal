/**
 * 원군 (tactics.fightRounds relief · season.fight — 형: "양쪽에서 동시공격 했을때 그냥 퉁쳐진 합으로 계산해서 싸우는거야?
 * … 열세에 밀린 아군에 로한의 기병대 같은 쾌감")
 *
 *  - 원군은 처음 합에 없고 reliefRound 합에 닿는다 — 그 합 기록에 relief
 *  - 싸움이 원군 전에 끝나도 원군은 잃지 않는다
 *  - 다른 길 둘로 들어간 협공은 작은 쪽이 원군이 된다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { fightRounds, type Side } from '../../src/realm/tactics.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { advance, marchSeasons, otherEnd, seasonOf } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import { PEOPLE_SCALE as S } from '../../src/realm/migrate.ts'
import type { Realm, ReportLine } from '../../src/realm/types.ts'

const side = (mix: Side['mix'], extra: Partial<Side> = {}): Side => ({
  F: Object.values(mix).reduce((s, v) => s + (v ?? 0), 0), mix, morale: 1, hero: null, hungry: false, specials: [], water: false, player: false, seen: true, ...extra,
})

describe('원군', () => {
  it('원군은 정한 합에 닿는다 · 기병이면 기병 원군 · 첫 합엔 덜 민다', () => {
    const atk = side({ spear: 300, horse: 200 }, { relief: { mix: { horse: 200 }, at: P.realm.reliefRound } })
    const def = side({ spear: 420 })
    const res = fightRounds(atk, def, 'k', 1, 0)
    const at = res.rounds.findIndex((x) => x.relief !== undefined)
    assert.equal(at, P.realm.reliefRound)
    assert.equal(res.rounds[at]!.relief!.side, 'a')
    assert.equal(res.rounds[at]!.relief!.horse, true)
    const merged = fightRounds(side({ spear: 300, horse: 200 }), def, 'k', 1, 0)
    // 첫 합엔 원군이 없다 — 맞은편이 덜 잃는다
    assert.ok(res.rounds[0]!.nd > merged.rounds[0]!.nd, `${res.rounds[0]!.nd} vs ${merged.rounds[0]!.nd}`)
  })

  it('싸움이 원군 전에 끝나도 원군은 잃지 않는다 — 남은 몫이 0~1', () => {
    const atk = side({ spear: 40, horse: 300 }, { relief: { mix: { horse: 300 }, at: 3 } })
    const def = side({ spear: 900 })
    const res = fightRounds(atk, def, 'k', 2, 0)
    for (const g of ['front', 'bows', 'horse'] as const) assert.ok((res.ga[g] ?? 0) <= 1 + 1e-9 && (res.ga[g] ?? 0) >= 0, `${g} ${res.ga[g]}`)
  })

  it('다른 길 둘로 들어간 협공 — 작은 쪽이 늦게 닿는 원군으로 기록된다', () => {
    let found = false
    for (let seed = 1; seed <= 30 && !found; seed++) {
      const r: Realm = byeonhanMini(seed)
      const cap = 'anya-cap'
      // 같은 계절에 닿는 두 길 (고개는 더 걸린다)
      const ways = Object.values(r.edges).filter((e) => otherEnd(e, cap) !== null && marchSeasons(e.kind, seasonOf(r.season)) === 1)
      if (ways.length < 2) continue
      const [e1, e2] = ways
      const main = Object.values(r.armies).find((a) => a.faction === r.player)
      if (main === undefined) continue
      main.at = otherEnd(e1!, cap)!
      main.mix = { spear: 500 * S }
      main.march = null
      const late = { ...structuredClone(main), id: 'a-late', hero: null, at: otherEnd(e2!, cap)!, mix: { horse: 150 * S } }
      r.armies['a-late'] = late
      for (const a of Object.values(r.armies)) if (a.id !== main.id && a.id !== 'a-late' && (a.at === main.at || a.at === late.at)) a.at = cap
      r.nodes[main.at]!.owner = r.player
      r.nodes[late.at]!.owner = r.player
      const { report } = advance(r, [
        { kind: 'march', army: main.id, edge: e1!.id, ambush: false },
        { kind: 'march', army: 'a-late', edge: e2!.id, ambush: false },
      ])
      const b = report.lines.find((l): l is Extract<ReportLine, { kind: 'battle' }> => l.kind === 'battle' && l.node === cap)
      if (b === undefined || (b.rounds ?? []).length <= P.realm.reliefRound) continue
      const rel = b.rounds!.find((x) => x.relief !== undefined)?.relief
      assert.ok(rel !== undefined && rel.side === 'a' && rel.horse, JSON.stringify(rel))
      found = true
    }
    assert.ok(found, '협공 싸움이 한 번은 나야 한다')
  })

  it('같은 길이어도 「뒤따른다」로 보내면 원군으로 늦게 붙는다 (형 10-25: "원군으로도 안 오고 그냥 한 번에 합산")', () => {
    let found = false
    for (let seed = 1; seed <= 30 && !found; seed++) {
      const r: Realm = byeonhanMini(seed)
      const cap = 'anya-cap'
      const way = Object.values(r.edges).find((e) => otherEnd(e, cap) !== null && marchSeasons(e.kind, seasonOf(r.season)) === 1)
      if (way === undefined) continue
      const main = Object.values(r.armies).find((a) => a.faction === r.player)
      if (main === undefined) continue
      main.at = otherEnd(way, cap)!
      main.mix = { spear: 500 * S }
      main.march = null
      r.armies['a-late'] = { ...structuredClone(main), id: 'a-late', hero: null, mix: { horse: 150 * S } }
      for (const a of Object.values(r.armies)) if (a.id !== main.id && a.id !== 'a-late' && a.at === main.at) a.at = cap
      r.nodes[main.at]!.owner = r.player
      const { report } = advance(r, [
        { kind: 'march', army: main.id, edge: way.id, ambush: false },
        { kind: 'march', army: 'a-late', edge: way.id, ambush: false, follow: true },
      ])
      const b = report.lines.find((l): l is Extract<ReportLine, { kind: 'battle' }> => l.kind === 'battle' && l.node === cap)
      if (b === undefined || (b.rounds ?? []).length <= P.realm.reliefRound) continue
      const rel = b.rounds!.find((x) => x.relief !== undefined)?.relief
      assert.ok(rel !== undefined && rel.side === 'a' && rel.horse, JSON.stringify(rel))
      found = true
    }
    assert.ok(found, '뒤따른 원군 싸움이 한 번은 나야 한다')
  })
})

describe('장수 둘이 한 고을을 칠 때 (형 10-26)', () => {
  it('적장 사로잡기는 한 판에 한 번 — 약한 장수 둘이 져도 둘 다 잃지는 않는다', () => {
    let both = 0
    let fought = 0
    for (let seed = 1; seed <= 80; seed++) {
      const r = structuredClone(byeonhanMini(seed))
      r.armies['a-us']!.at = 'our-north'
      r.heroes['chief']!.at = null
      const a2 = structuredClone(r.armies['a-us']!) as unknown as { id: string; at: string; hero: string }
      a2.id = 'a-us2'
      a2.at = 'our-east'
      a2.hero = 'us-1'
      ;(r.armies as Record<string, unknown>)['a-us2'] = a2
      r.heroes['us-1']!.at = null
      const mh = r.heroes['miri-1'] as unknown as Record<string, number>
      mh['mu'] = 10; mh['tong'] = 10; mh['ryak'] = 10
      for (const id of ['chief', 'us-1']) { const h = r.heroes[id] as unknown as Record<string, number>; h['mu'] = 1; h['tong'] = 1; h['ryak'] = 1 }
      r.armies['a-us']!.morale = 30
      r.armies['a-us2']!.morale = 30
      let res = advance(r, [{ kind: 'march', army: 'a-us', edge: 'e06', ambush: false }, { kind: 'march', army: 'a-us2', edge: 'e08', ambush: false }])
      for (let i = 0; i < 3 && !res.report.lines.some((l) => l.kind === 'battle' && l.node === 'miri-vil'); i++) res = advance(res.next, [])
      const b = res.report.lines.find((l) => l.kind === 'battle' && l.node === 'miri-vil')
      if (b === undefined) continue
      fought++
      assert.deepEqual(b.kind === 'battle' ? b.allies : [], ['a-us2'], '두 군대가 한 싸움에 함께 선다')
      if (['chief', 'us-1'].every((id) => res.next.heroes[id]!.status !== 'free')) both++
    }
    assert.ok(fought > 40)
    assert.equal(both, 0)
  })
})
