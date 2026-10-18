/**
 * 공작 — 소문 · 이간 · 매수 · 방화 · 첩자 (형, 2026-10-18: "다양한 외교나 공작이 가능 해야하는거 아님?")
 *
 *  - 값을 내고 굴린다 · 같은 판·같은 명령이면 같은 결과 · 한 계절 plotsPerSeason 까지 · 같은 대상에 같은 공작은 하나
 *  - 먹히면: 소문은 사기 · 이간은 두 나라 사이 · 매수는 장정 · 방화는 곡식 · 첩자는 몇 계절 군세를 안다
 *  - 들키면 그 나라와 한 칸 나빠진다 · 안 들키면 당한 쪽은 누가 했는지 모른다(mystery)
 *  - 화면에 보이는 범위(plotChance)는 참값(plotTrueChance)을 품는다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders } from '../../src/realm/ai.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { relationOf } from '../../src/realm/diplomacy.ts'
import { militiaMen } from '../../src/realm/economy.ts'
import { PLOT_OPS, plotChance, plotCost, plotTargets, plotTrueChance } from '../../src/realm/plots.ts'
import { advance } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, PlotOp, Realm, ReportLine } from '../../src/realm/types.ts'

type PlotLine = Extract<ReportLine, { kind: 'plot' }>

const plot = (op: PlotOp, target: string, extra: { node?: string; other?: string } = {}): Order =>
  ({ kind: 'plot', faction: 'us', op, target, ...extra })

const plotLines = (lines: readonly ReportLine[]): PlotLine[] => lines.filter((l): l is PlotLine => l.kind === 'plot')

/** 이 공작이 바라는 대로(먹혔나 · 들켰나) 굴러가는 판을 시드를 바꿔 가며 찾는다 */
function find(o: Order, want: { ok: boolean; caught: boolean }, prep: (r: Realm) => void = () => {}) {
  for (let seed = 1; seed <= 400; seed++) {
    const r = byeonhanMini(seed)
    prep(r)
    const res = advance(r, [o])
    const l = plotLines(res.report.lines)[0]
    if (l !== undefined && l.ok === want.ok && l.caught === want.caught) return { before: r, ...res }
  }
  throw new Error(`그런 판을 못 찾았다: ${JSON.stringify(want)}`)
}

describe('공작 — 값과 규칙', () => {
  it('값을 내고 한 줄이 남는다 · 같은 판·같은 명령이면 같은 결과', () => {
    const r = byeonhanMini(7)
    const o = [plot('rumor', 'guya')]
    const a = advance(r, o)
    assert.deepEqual(a, advance(r, o))
    assert.equal(plotLines(a.report.lines).length, 1)
    // 같은 계절에 다른 곳에도 곡식이 드니, 공작 값만 따로 빼 본다
    const plain = advance(r, [])
    assert.equal(plain.next.stock['us']!.grain - a.next.stock['us']!.grain, plotCost('rumor').grain)
  })

  it(`한 계절에 ${P.realm.plotsPerSeason}개까지 · 같은 대상에 같은 공작은 하나`, () => {
    const r = byeonhanMini(3)
    r.stock['us']!.grain = 1000
    const o = [plot('rumor', 'guya'), plot('rumor', 'guya'), plot('rumor', 'anya'), plot('burn', 'miri')]
    const ls = plotLines(advance(r, o).report.lines)
    assert.equal(ls.length, P.realm.plotsPerSeason)
    assert.deepEqual(ls.map((l) => `${l.op}:${l.target}`), ['rumor:guya', 'rumor:anya'])
  })

  it('규칙에 안 맞으면 아무 일도 없다 — 곡식 모자람 · 남의 고을이 아님 · 이간의 상대 없음 · 제 나라', () => {
    const r = byeonhanMini(3)
    const poor = structuredClone(r)
    poor.stock['us']!.grain = 5
    assert.equal(plotLines(advance(poor, [plot('rumor', 'guya')]).report.lines).length, 0)
    const bad: Order[] = [
      plot('bribe', 'guya', { node: 'anya-cap' }), // 안야의 고을이다
      plot('sow', 'guya'), // 상대가 없다
      plot('sow', 'guya', { other: 'guya' }),
      plot('rumor', 'us'),
    ]
    assert.equal(plotLines(advance(r, bad).report.lines).length, 0)
  })

  it('보이는 범위가 참값을 품는다 · 대상 목록은 결정론', () => {
    const r = byeonhanMini(11)
    for (const op of PLOT_OPS) {
      const ts = plotTargets(r, 'us', op)
      assert.deepEqual(ts, plotTargets(r, 'us', op))
      assert.ok(ts.length > 0, op)
      for (const t of ts) {
        const [lo, hi] = plotChance(r, 'us', op, t.target, t.node)
        const p = plotTrueChance(r, 'us', op, t.target, t.node)
        assert.ok(lo <= p + 1e-9 && p <= hi + 1e-9, `${op} ${t.target} ${t.node ?? ''}: ${lo} ${p} ${hi}`)
        assert.ok(lo >= P.realm.plotMin && hi <= P.realm.plotMax)
      }
    }
    // 매수·첩자는 우리가 땅을 아는 남의 고을만
    for (const t of plotTargets(r, 'us', 'spy')) assert.notEqual(r.intel['us']![t.node!], undefined)
  })
})

describe('공작 — 먹히면', () => {
  it('소문: 그 나라 군대 사기가 꺾인다 · 안 들키면 당한 쪽은 누가 했는지 모른다', () => {
    const { before, next, report } = find(plot('rumor', 'guya'), { ok: true, caught: false })
    for (const a of Object.values(next.armies)) {
      if (a.faction !== 'guya' || before.armies[a.id] === undefined) continue
      assert.ok(a.morale < before.armies[a.id]!.morale)
    }
    assert.ok(report.lines.some((l) => l.kind === 'mystery' && l.faction === 'guya' && l.what === 'morale'))
    assert.equal(relationOf(next, 'us', 'guya').state, 'neutral')
  })

  it('이간: 화친 중인 두 나라 사이가 한 칸 내려간다', () => {
    const { next } = find(plot('sow', 'guya', { other: 'miri' }), { ok: true, caught: false }, (r) => {
      r.relations['guya|miri'] = { state: 'truce', until: r.season + 8 }
    })
    assert.equal(relationOf(next, 'guya', 'miri').state, 'neutral')
  })

  it('매수: 그 고을 장정이 정한 계절 동안 서지 않는다, 그 뒤엔 다시 선다', () => {
    const o = plot('bribe', 'guya', { node: 'guya-vil' })
    const { before, next } = find(o, { ok: true, caught: false }, (r) => { r.stock['us']!.iron = 50 })
    assert.ok(militiaMen(before, 'guya-vil') > 0)
    assert.equal(militiaMen(next, 'guya-vil'), 0)
    let r = next
    for (let i = 1; i < P.realm.plotBribeSeasons; i++) r = advance(r, []).next
    assert.ok(militiaMen(r, 'guya-vil') > 0, '매수는 끝난다')
  })

  it('방화: 그 나라 곡식이 탄다 (상한까지)', () => {
    const { before, next, report } = find(plot('burn', 'miri'), { ok: true, caught: false })
    const plain = advance(before, [])
    const lost = plain.next.stock['miri']!.grain - next.stock['miri']!.grain
    assert.ok(lost > 0 && lost <= P.realm.plotBurnMax, String(lost))
    assert.ok(report.lines.some((l) => l.kind === 'mystery' && l.what === 'grain'))
  })

  it('첩자: 그 고을 군세를 계절마다 새로 알다가, 정한 계절이 지나면 거둔다', () => {
    const node = plotTargets(byeonhanMini(1), 'us', 'spy')[0]!
    const o = plot('spy', node.target, { node: node.node! })
    let { next: r } = find(o, { ok: true, caught: false })
    assert.equal(r.spies?.['us']?.length, 1)
    for (let i = 0; i < P.realm.plotSpySeasons - 1; i++) {
      const res = advance(r, [])
      assert.equal(res.next.intel['us']![node.node!]!.force?.season, r.season, '그 계절 것으로 안다')
      r = res.next
    }
    r = advance(r, []).next
    assert.equal(r.spies?.['us']?.length, 0, '끝나면 거둔다')
  })
})

describe('공작 — 들키면', () => {
  it('그 나라와 한 칸 나빠지고, 누가 했는지 줄에 남는다 (mystery 는 없다)', () => {
    const { next, report } = find(plot('burn', 'anya'), { ok: false, caught: true })
    assert.equal(relationOf(next, 'us', 'anya').state, 'war')
    assert.ok(!report.lines.some((l) => l.kind === 'mystery'))
  })

  it('첩자가 먹혀도 들키면 첩자를 잃는다', () => {
    const node = plotTargets(byeonhanMini(1), 'us', 'spy')[0]!
    const { next } = find(plot('spy', node.target, { node: node.node! }), { ok: true, caught: true })
    assert.equal(next.spies?.['us']?.length ?? 0, 0)
  })
})

describe('공작 — AI', () => {
  it('AI 도 가끔 공작을 벌이고, 플레이어를 노릴 때도 있다 · 결정론', () => {
    let n = 0
    let atUs = 0
    for (let seed = 1; seed <= 20; seed++) {
      let r = byeonhanMini(seed)
      for (let s = 0; s < 16; s++) {
        const os = aiOrders(r)
        assert.deepEqual(os, aiOrders(r))
        for (const o of os) {
          if (o.kind !== 'plot') continue
          n++
          if (o.target === 'us') atUs++
        }
        r = advance(r, os).next
      }
    }
    assert.ok(n > 0, '공작이 한 번도 없다')
    assert.ok(atUs > 0, '플레이어를 노린 공작이 없다')
  })
})
