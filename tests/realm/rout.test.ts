/**
 * 싸움의 끝맺음 (FOCUS C · 형: "400, 300, 200 계속 옴, 섬멸 안 됨") — 달 시계 판만
 *  - 진 군대는 싸움에서 잃은 것 말고도 흩어진다 (도망병) · 옛 판은 예전 그대로
 *  - 물러날 곳이 없으면 섬멸 — 장수는 사로잡히거나 다쳐서 빠져나온다
 *  - 연달아 진 AI 나라는 몇 계절 새 출정을 쉰다 · 플레이어 나라는 안 쉰다
 *  - AI 징병은 싸움에서 잃은 사람이 아물 때까지 그만큼 덜 뽑는다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { decide } from '../../src/realm/ai.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { reportText } from '../../src/realm/data/prose.ts'
import { PEOPLE_SCALE as S } from '../../src/realm/migrate.ts'
import { beatenResting, healWarDead, noteBeaten, noteWarDead, warDeadRoom, menByFaction } from '../../src/realm/rout.ts'
import { advance, neighbors, otherEnd } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Army, Realm, ReportLine } from '../../src/realm/types.ts'

const ATK = 'guya'
const DEF = 'anya'

/** 판의 다른 값을 잠깐 바꿔 돌린다 */
function withKnobs<T>(set: Record<string, number>, f: () => T): T {
  const R = P.realm as unknown as Record<string, number>
  const was = Object.fromEntries(Object.keys(set).map((k) => [k, R[k]!]))
  Object.assign(R, set)
  try {
    return f()
  } finally {
    Object.assign(R, was)
  }
}

/**
 * 가락국 큰 군대가 아라국 고을 하나를 친다. 그 고을의 다른 이웃은 모두 가락국 땅 — `retreat` 면 하나만 아라국 땅으로 남긴다.
 * 판의 다른 군대는 다 걷어 낸다 (들판 싸움 · 원군이 끼지 않게)
 */
function scene(opts: { month: boolean; retreat: boolean; hero: boolean; seed?: number }): { r: Realm; node: string; home: string | null } {
  const r = byeonhanMini(opts.seed ?? 3)
  if (opts.month) (r as { clock?: 'month' }).clock = 'month'
  else delete (r as { clock?: 'month' }).clock
  const node = Object.values(r.nodes)
    .filter((n) => n.owner === DEF && n.id !== r.factions[DEF]!.capital && neighbors(r, n.id).length >= 3)
    .sort((a, b) => (a.id < b.id ? -1 : 1))[0]!
  const nbs = neighbors(r, node.id).sort()
  const from = nbs[0]!
  const home = opts.retreat ? nbs[1]! : null
  for (const n of nbs) r.nodes[n]!.owner = n === home ? DEF : ATK
  const edge = Object.values(r.edges).find((e) => otherEnd(e, node.id) === from)!
  for (const id of Object.keys(r.armies)) delete r.armies[id]
  r.armies['a-atk'] = { id: 'a-atk', faction: ATK, hero: null, mix: { spear: 2000 * S }, equip: 'iron', morale: 1, at: from, march: { from, to: node.id, edge: edge.id, left: 1, ambush: false } }
  const def: Army = { id: 'a-def', faction: DEF, hero: null, mix: { spear: 150 * S }, equip: 'bronze', morale: 1, at: node.id, march: null }
  if (opts.hero) {
    const ruler = r.heroes[r.factions[DEF]!.ruler!]!
    r.heroes['t-lead'] = { ...structuredClone(ruler), id: 't-lead', at: null, post: null, status: 'free', captor: null }
    def.hero = 't-lead'
  }
  r.armies['a-def'] = def
  return { r, node: node.id, home }
}

const scatterOf = (lines: readonly ReportLine[]): Extract<ReportLine, { kind: 'scatter' }> | undefined =>
  lines.find((l): l is Extract<ReportLine, { kind: 'scatter' }> => l.kind === 'scatter')

describe('진 군대가 흩어진다', () => {
  it('달 시계 — 진 군대는 물러나며 scatter 몫을 더 잃는다 · 싸움 판정은 그대로', () => {
    const run = (share: number): { men: number; lines: readonly ReportLine[]; outcome: string } => withKnobs({ scatterLose: share, scatterRouted: share, scatterFloor: 0 }, () => {
      const { r, home } = scene({ month: true, retreat: true, hero: false })
      const { next, report } = advance(r, [])
      const b = report.lines.find((l) => l.kind === 'battle')
      assert.ok(b !== undefined && b.kind === 'battle')
      const d = next.armies['a-def']
      assert.ok(d !== undefined, '물러날 곳이 있으면 남는다')
      assert.equal(d.at, home)
      return { men: Object.values(d.mix).reduce((s, v) => s + (v ?? 0), 0), lines: report.lines, outcome: b.outcome }
    })
    const none = run(0)
    const half = run(0.5)
    assert.ok(none.outcome === 'rout' || none.outcome === 'win', none.outcome)
    assert.equal(half.outcome, none.outcome)
    assert.equal(scatterOf(none.lines), undefined)
    const sc = scatterOf(half.lines)!
    assert.ok(sc !== undefined && !sc.wiped && sc.lost > 0)
    assert.ok(Math.abs(half.men - none.men * 0.5) <= 2, `${half.men} vs ${none.men}`)
    assert.equal(half.men + sc.lost, none.men)
  })

  it('남은 사람이 scatterFloor 아래면 다 흩어진다 (섬멸은 아니다)', () => {
    withKnobs({ scatterFloor: 1e6 }, () => {
      const { r } = scene({ month: true, retreat: true, hero: false })
      const { next, report } = advance(r, [])
      assert.equal(next.armies['a-def'], undefined)
      const sc = scatterOf(report.lines)!
      assert.ok(sc.wiped && !sc.cut)
    })
  })

  it('옛 판은 예전 그대로 — 물러나기만 하고 흩어짐 줄이 없다', () => {
    const { r, home } = scene({ month: false, retreat: true, hero: false })
    const { next, report } = advance(r, [])
    assert.equal(scatterOf(report.lines), undefined)
    assert.equal(next.armies['a-def']?.at, home)
    assert.equal(next.factions[ATK]!.beaten, undefined)
    assert.equal(next.factions[DEF]!.warDead, undefined)
  })
})

/**
 * 장수가 싸움 가운데 사로잡히거나 쓰러지지 않은 판을 찾는다 (자동 싸움도 적장 잡기를 건다 — 그 판은 섬멸 앞에 장수가 이미 빠졌다)
 */
function wipeWithHero(): { r: Realm; node: string; next: Realm; lines: readonly ReportLine[] } {
  for (let seed = 1; seed <= 40; seed++) {
    const { r, node } = scene({ month: true, retreat: false, hero: true, seed })
    const { next, report } = advance(r, [])
    const b = report.lines.find((l) => l.kind === 'battle')
    if (b?.kind === 'battle' && b.captured === null && b.killed === null) return { r, node, next, lines: report.lines }
  }
  throw new Error('장수가 싸움을 넘긴 판이 없다')
}

describe('물러날 곳이 없으면 섬멸', () => {
  it('퇴로가 끊긴 군대는 다 흩어지고 장수는 사로잡힌다 (wipeCapture 1)', () => {
    withKnobs({ wipeCapture: 1, tacDeathRout: 0, tacAiCapture: 99 }, () => {
      const { r, node, next, lines } = wipeWithHero()
      assert.equal(next.armies['a-def'], undefined)
      const sc = scatterOf(lines)!
      assert.ok(sc.wiped && sc.cut && sc.node === node && sc.by === ATK)
      assert.equal(sc.hero, 't-lead')
      assert.equal(sc.fate, 'captive')
      assert.equal(next.heroes['t-lead']!.status, 'captive')
      assert.equal(next.heroes['t-lead']!.captor, ATK)
      // 우리가 진 쪽이면 우리 말로 · 이긴 쪽이면 이긴 말로
      assert.match(reportText(r, next, sc, DEF) ?? '', /물러날 길이 끊겨 .*사로잡혔다/)
      assert.match(reportText(r, next, sc, ATK) ?? '', /사로잡았다/)
      assert.equal(reportText(r, next, sc, 'miri'), null)
    })
  })

  it('사로잡히지 않으면 다쳐서 빠져나온다 (wipeCapture 0)', () => {
    withKnobs({ wipeCapture: 0, tacDeathRout: 0, tacAiCapture: 99 }, () => {
      const { r, next, lines } = wipeWithHero()
      const sc = scatterOf(lines)!
      assert.equal(sc.fate, 'wounded')
      const h = next.heroes['t-lead']!
      assert.equal(h.status, 'free')
      assert.ok((h.woundedUntil ?? -1) >= r.season)
    })
  })

  it('같은 씨앗이면 같은 판 (A1)', () => {
    const a = advance(scene({ month: true, retreat: false, hero: true }).r, [])
    const b = advance(scene({ month: true, retreat: false, hero: true }).r, [])
    assert.equal(JSON.stringify(a.next), JSON.stringify(b.next))
    assert.equal(JSON.stringify(a.report), JSON.stringify(b.report))
  })
})

describe('연달아 진 나라는 쉰다', () => {
  const lost = (r: Realm, atk: string, def: string, outcome: 'lose' | 'win'): ReportLine => ({
    kind: 'battle', node: Object.keys(r.nodes)[0]!, attacker: 'x', allies: [], pincer: false, defender: def, ambush: 'none', p: 0.5,
    outcome, captured: null, killed: null, militia: 0, atkFaction: atk,
  })
  const monthRealm = (): Realm => {
    const r = byeonhanMini(1)
    ;(r as { clock?: 'month' }).clock = 'month'
    return r
  }

  it('beatenStreak 번 잇달아 지면 그 계절 끝부터 beatenRest 계절 동안 새 출정을 쉰다', () => {
    const r = monthRealm()
    const lines: ReportLine[] = [lost(r, ATK, DEF, 'lose')]
    noteBeaten(r, lines)
    assert.equal(beatenResting(r, ATK), false)
    assert.equal(r.factions[ATK]!.beaten?.n, 1)
    const more: ReportLine[] = [lost(r, ATK, DEF, 'lose')]
    for (let i = 2; i < P.realm.beatenStreak; i++) more.push(lost(r, ATK, DEF, 'lose'))
    noteBeaten(r, more)
    assert.equal(beatenResting(r, ATK), true)
    const b = more.find((l) => l.kind === 'beaten')
    assert.ok(b !== undefined && b.kind === 'beaten' && b.faction === ATK)
    // 계절 끝(2달째) + beatenRest 계절
    assert.equal(b.until, 2 + 3 * P.realm.beatenRest)
    // 쉬는 동안엔 출정·다가가기가 없다
    const orders = decide(r, ATK, 'greedy')
    assert.ok(!orders.some((o) => o.kind === 'march'), JSON.stringify(orders.filter((o) => o.kind === 'march')))
    r.season = b.until + 1
    assert.equal(beatenResting(r, ATK), false)
  })

  it('이기면 연패가 끊긴다 · 막힌 공격(고을 싸움 교착)도 진 것으로 센다', () => {
    const r = monthRealm()
    noteBeaten(r, [lost(r, ATK, DEF, 'lose')])
    noteBeaten(r, [lost(r, ATK, DEF, 'win')])
    assert.equal(r.factions[ATK]!.beaten?.n, 0)
    const draw: ReportLine = { ...(lost(r, ATK, DEF, 'lose') as Extract<ReportLine, { kind: 'battle' }>), outcome: 'draw' }
    noteBeaten(r, [draw])
    assert.equal(r.factions[ATK]!.beaten?.n, 1)
  })

  it('플레이어 나라 · 옛 판은 세지 않는다', () => {
    const r = monthRealm()
    const ls = Array.from({ length: 6 }, () => lost(r, r.player, DEF, 'lose'))
    noteBeaten(r, ls)
    assert.equal(r.factions[r.player]!.beaten, undefined)
    assert.equal(beatenResting(r, r.player), false)
    const old = byeonhanMini(1)
    delete (old as { clock?: 'month' }).clock
    noteBeaten(old, Array.from({ length: 6 }, () => lost(old, ATK, DEF, 'lose')))
    assert.equal(old.factions[ATK]!.beaten, undefined)
  })
})

describe('AI 징병은 잃은 사람만큼 덜 뽑는다', () => {
  it('싸움에서 잃은 사람이 장부에 적히고 계절마다 아문다 · 장부만큼 징병 상한이 준다', () => {
    const r = byeonhanMini(1)
    ;(r as { clock?: 'month' }).clock = 'month'
    const before = menByFaction(r)
    const a = Object.values(r.armies).find((x) => x.faction === ATK)!
    const n0 = Object.values(a.mix).reduce((s, v) => s + (v ?? 0), 0)
    delete r.armies[a.id]
    noteWarDead(r, before)
    assert.equal(r.factions[ATK]!.warDead, n0)
    assert.equal(warDeadRoom(r, ATK), n0)
    healWarDead(r)
    assert.ok(Math.abs(r.factions[ATK]!.warDead! - n0 * (1 - P.realm.warDeadHeal)) < 1e-6)
    // 플레이어 나라는 장부가 없다
    assert.equal(warDeadRoom(r, r.player), 0)
  })

  it('장부가 크면 AI 가 징병하지 않는다', () => {
    const drafted = (r: Realm, f: string): number => decide(r, f, 'greedy').reduce((s, o) => s + (o.kind === 'draft' ? o.n : 0), 0)
    // 가을·겨울 달 가운데 AI 가 뽑는 때를 찾는다 (곳간이 넉넉한 나라)
    let found = false
    for (const f of [ATK, DEF, 'miri']) {
      for (let t = 6; t < 12 && !found; t++) {
        const base = byeonhanMini(1)
        ;(base as { clock?: 'month' }).clock = 'month'
        base.season = t
        if (drafted(structuredClone(base), f) <= 0) continue
        const heavy = structuredClone(base)
        heavy.factions[f]!.warDead = 1e6
        assert.equal(drafted(heavy, f), 0)
        found = true
      }
    }
    assert.ok(found, '장부가 없으면 뽑는 때가 있다')
  })
})
