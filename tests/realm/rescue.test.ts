/**
 * 공작 — 구출 (형 10-26: "공작중에서는 잡혀간 우리 장수가있는나라의 경우 구출 이 활성화되면 좋겠어.
 * 구출작전은 암살이랑 비슷하게 활쏘기겜으로 가서 적물리치면될듯")
 *
 *  - 잡혀간 우리 장수가 있을 때만 대상이 있다 — 잡은 나라 도읍의 옥
 *  - 먹히면 그 장수가 풀려 우리 도읍으로 돌아온다 · 회유는 끊긴다
 *  - 밤 판의 손: cleared 먹힘 · fled 실패(들킴) · withdrew 실패(안 들킴) · skip 은 굴림
 *  - 같은 판·같은 명령이면 같은 결과 (결정론)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { reportText } from '../../src/realm/data/prose.ts'
import { NIGHT_OPS, PLOT_OPS, plotChance, plotCost, plotTargets, plotTrueChance, rescueGuard, rescueNode } from '../../src/realm/plots.ts'
import { advance } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Hand, Order, Realm, ReportLine } from '../../src/realm/types.ts'

type PlotLine = Extract<ReportLine, { kind: 'plot' }>
const plotLines = (lines: readonly ReportLine[]): PlotLine[] => lines.filter((l): l is PlotLine => l.kind === 'plot')

/** 우리 장수 잔물(us-2)이 가락국(guya)에 잡혀 있는 판 — 회유도 받는 중 */
function jailed(seed: number): Realm {
  const r = byeonhanMini(seed)
  const h = r.heroes['us-2']!
  h.status = 'captive'
  h.captor = 'guya'
  h.at = null
  h.post = null
  h.persuade = { by: null, left: 5 }
  return r
}

const rescue = (agent?: string, hand?: Hand): Order => ({
  kind: 'plot', faction: 'us', op: 'rescue', target: 'guya', node: 'guya-cap', hero: 'us-2',
  ...(agent !== undefined ? { agent } : {}), ...(hand !== undefined ? { hand } : {}),
})

describe('공작 — 구출', () => {
  it('구출은 공작 갈래에 들고 밤 판으로 간다', () => {
    assert.ok(PLOT_OPS.includes('rescue'))
    assert.ok(NIGHT_OPS.has('rescue') && NIGHT_OPS.has('assassin'))
  })

  it('잡혀간 우리 장수가 있을 때만 대상이 있다 — 잡은 나라 도읍의 옥', () => {
    assert.deepEqual(plotTargets(byeonhanMini(3), 'us', 'rescue'), [])
    const r = jailed(3)
    const ts = plotTargets(r, 'us', 'rescue')
    assert.deepEqual(ts, [{ target: 'guya', node: 'guya-cap', hero: 'us-2' }])
    assert.equal(rescueNode(r, 'guya'), 'guya-cap')
    // 남의 나라가 잡은 남의 장수는 우리 대상이 아니다
    assert.deepEqual(plotTargets(r, 'guya', 'rescue'), [])
    // 범위가 참값을 품는다 · 고용 자객은 곡식이 더 든다
    const t = ts[0]!
    for (const agent of [null, 'us-1'] as const) {
      const [lo, hi] = plotChance(r, 'us', 'rescue', t.target, t.node, t.hero, agent)
      const p = plotTrueChance(r, 'us', 'rescue', t.target, t.node, t.hero, agent)
      assert.ok(lo <= p + 1e-9 && p <= hi + 1e-9, `${lo} ${p} ${hi}`)
    }
    assert.equal(plotCost('rescue', null).grain - plotCost('rescue', 'us-1').grain, P.realm.plotHiredGrain)
    // 도읍의 옥은 경비가 붙는다
    assert.ok(rescueGuard(r, 'guya-cap') >= 1)
  })

  it('밤 판에서 데려 나왔으면(cleared) 풀려나 우리 도읍으로 돌아온다 · 회유가 끊긴다', () => {
    const r = jailed(5)
    const { next, report } = advance(r, [rescue('us-1', { result: 'cleared', alarm: false })])
    const l = plotLines(report.lines).find((x) => x.op === 'rescue')!
    assert.equal(l.ok, true)
    assert.equal(l.caught, false)
    assert.equal(l.hero, 'us-2')
    const h = next.heroes['us-2']!
    assert.equal(h.status, 'free')
    assert.equal(h.captor, null)
    assert.equal(h.at, 'our-cap')
    assert.equal(h.persuade, undefined)
    assert.ok(next.stock['us']!.grain < r.stock['us']!.grain)
    const text = reportText(r, next, l, 'us')!
    assert.ok(text.includes(r.heroes['us-2']!.name) && text.includes('구해 냈다'), text)
  })

  it('북이 울려 달아났으면(fled) 실패하고 들킨다', () => {
    const r = jailed(5)
    const { next, report } = advance(r, [rescue('us-1', { result: 'fled', alarm: true })])
    const l = plotLines(report.lines).find((x) => x.op === 'rescue')!
    assert.equal(l.ok, false)
    assert.equal(l.caught, true)
    assert.equal(next.heroes['us-2']!.status, 'captive')
    assert.equal(next.heroes['us-2']!.captor, 'guya')
    // 보낸 장수는 빠져나오거나 붙잡힌다
    assert.ok(l.agentFate === 'escaped' || l.agentFate === 'captured')
    // 옥이 있는 고을이 경계를 올린다
    assert.ok((next.watch['guya-cap']?.alert ?? 0) > 0)
  })

  it('화살이 다해 물러났으면(withdrew) 실패하지만 안 들킨다', () => {
    const r = jailed(5)
    const { next, report } = advance(r, [rescue('us-1', { result: 'withdrew', alarm: false })])
    const l = plotLines(report.lines).find((x) => x.op === 'rescue')!
    assert.equal(l.ok, false)
    assert.equal(l.caught, false)
    assert.equal(l.agentFate, undefined)
    assert.equal(next.heroes['us-2']!.status, 'captive')
    assert.equal(next.heroes['us-1']!.status, 'free')
  })

  it('맡기거나(skip) 안 쏘면 굴린다 — 같은 판·같은 명령이면 같은 결과', () => {
    const r = jailed(9)
    const o = [rescue(undefined, { result: 'skip', alarm: false })]
    const a = advance(r, o)
    assert.deepEqual(a, advance(r, o))
    assert.equal(plotLines(a.report.lines).filter((x) => x.op === 'rescue').length, 1)
    // 굴림이 먹히는 판도, 안 먹히는 판도 있다
    const oks = new Set<boolean>()
    for (let seed = 1; seed <= 60 && oks.size < 2; seed++) {
      const res = advance(jailed(seed), [rescue('us-1')])
      const l = plotLines(res.report.lines).find((x) => x.op === 'rescue')
      if (l === undefined) continue
      oks.add(l.ok)
      if (l.ok) assert.equal(res.next.heroes['us-2']!.status, 'free')
      else assert.equal(res.next.heroes['us-2']!.status, 'captive')
    }
    assert.equal(oks.size, 2)
  })

  it('잡혀 있지 않은 장수·엉뚱한 옥으로는 못 간다', () => {
    const free = byeonhanMini(5)
    const { report } = advance(free, [rescue('us-1', { result: 'cleared', alarm: false })])
    assert.equal(plotLines(report.lines).filter((x) => x.op === 'rescue').length, 0)
    const r = jailed(5)
    const wrong: Order = { ...rescue('us-1', { result: 'cleared', alarm: false }), node: 'guya-iron' } as Order
    const res = advance(r, [wrong])
    assert.equal(plotLines(res.report.lines).filter((x) => x.op === 'rescue').length, 0)
    assert.equal(res.next.heroes['us-2']!.status, 'captive')
  })
})
