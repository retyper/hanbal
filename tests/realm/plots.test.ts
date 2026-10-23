/**
 * 공작 — 소문 · 이간 · 매수 · 방화 · 첩자 (형, 2026-10-18: "다양한 외교나 공작이 가능 해야하는거 아님?")
 *
 *  - 값을 내고 굴린다 · 같은 판·같은 명령이면 같은 결과 · 한 계절 plotsPerSeason 까지 · 같은 대상에 같은 공작은 하나
 *  - 먹히면: 소문은 사기 · 이간은 두 나라 사이 · 매수는 장정 · 방화는 곡식 · 첩자는 몇 계절 군세를 안다
 *  - 들킴 세 갈래: 안 들킴(mystery) · 들켰지만 누가 보냈는지 모름(경계만) · 드러남(사이·호감, 다른 나라도 등 돌림)
 *  - 입을 다문 채 붙잡힌 자객 장수는 나중에 실토한다
 *  - 화면에 보이는 범위(plotChance)는 참값(plotTrueChance)을 품는다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders } from '../../src/realm/ai.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { relationOf } from '../../src/realm/diplomacy.ts'
import { militiaMen } from '../../src/realm/economy.ts'
import {
  PLOT_OPS, assassinArrows, assassinBow, bowUpCost, escapeChance, exposeChance, plotChance, plotCost, plotTargets, plotTrueChance,
} from '../../src/realm/plots.ts'
import { reportText } from '../../src/realm/data/prose.ts'
import { advance } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, PlotOp, Realm, ReportLine } from '../../src/realm/types.ts'

type PlotLine = Extract<ReportLine, { kind: 'plot' }>

const plot = (op: PlotOp, target: string, extra: { node?: string; other?: string } = {}): Order =>
  ({ kind: 'plot', faction: 'us', op, target, ...extra })

const plotLines = (lines: readonly ReportLine[]): PlotLine[] => lines.filter((l): l is PlotLine => l.kind === 'plot')

/** 이 공작이 바라는 대로(먹혔나 · 들켰나) 굴러가는 판을 시드를 바꿔 가며 찾는다 */
function find(o: Order, want: { ok: boolean; caught: boolean; exposed?: boolean; agentFate?: 'escaped' | 'captured' }, prep: (r: Realm) => void = () => {}) {
  for (let seed = 1; seed <= 600; seed++) {
    const r = byeonhanMini(seed)
    prep(r)
    const res = advance(r, [o])
    const l = plotLines(res.report.lines)[0]
    if (l !== undefined && l.ok === want.ok && l.caught === want.caught && (want.exposed === undefined || l.exposed === want.exposed)
      && (want.agentFate === undefined || l.agentFate === want.agentFate)) return { before: r, ...res }
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

  it('한 계절의 천장(plotsPerSeason)까지 · 같은 대상에 같은 공작은 하나', () => {
    const R = P.realm as { plotsPerSeason: number }
    const keep = R.plotsPerSeason
    R.plotsPerSeason = 2
    try {
      const r = byeonhanMini(3)
      r.stock['us']!.grain = 1000
      const o = [plot('rumor', 'guya'), plot('rumor', 'guya'), plot('rumor', 'anya'), plot('burn', 'miri')]
      const ls = plotLines(advance(r, o).report.lines)
      assert.equal(ls.length, 2)
      assert.deepEqual(ls.map((l) => `${l.op}:${l.target}`), ['rumor:guya', 'rumor:anya'])
    } finally {
      R.plotsPerSeason = keep
    }
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
      assert.ok(op === 'assassin' || ts.length > 0, op) // 암살은 본 장수가 있어야 — 판의 처음엔 없다
      for (const t of ts) {
        const [lo, hi] = plotChance(r, 'us', op, t.target, t.node, t.hero)
        const p = plotTrueChance(r, 'us', op, t.target, t.node, t.hero)
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

describe('공작 — 들키면 (세 갈래)', () => {
  it('누가 했는지 드러나면 그 나라와 한 칸 나빠지고, 줄에 누가 했는지 남는다 (mystery 는 없다)', () => {
    const { before, next, report } = find(plot('burn', 'anya'), { ok: false, caught: true, exposed: true })
    assert.equal(relationOf(next, 'us', 'anya').state, 'war')
    assert.ok(!report.lines.some((l) => l.kind === 'mystery'))
    const text = reportText(before, next, plotLines(report.lines)[0]!, 'anya')!
    assert.ok(text.includes(next.factions['us']!.name), text)
  })

  it('들켰지만 누가 보냈는지 모르면 — 사이는 그대로, 그 나라 국읍 경계만 오른다', () => {
    // 도읍은 군주가 맡아 경계 바닥이 있다(HEROES §7) — 바닥이 오른 몫을 가리지 않게 이 시험에서만 끈다
    const keep = P.realm.postRyakAlert
    P.realm.postRyakAlert = 0
    try { checkUnknown() } finally { P.realm.postRyakAlert = keep }
  })
  function checkUnknown(): void {
    const { before, next, report } = find(plot('burn', 'anya'), { ok: false, caught: true, exposed: false })
    assert.equal(relationOf(next, 'us', 'anya').state, relationOf(before, 'us', 'anya').state)
    assert.equal(relationOf(next, 'us', 'anya').favor ?? 0, relationOf(before, 'us', 'anya').favor ?? 0)
    const cap = before.factions['anya']!.capital
    const plain = advance(before, []).next
    assert.ok(next.watch[cap]!.alert > plain.watch[cap]!.alert, '경계가 안 올랐다')
    const l = plotLines(report.lines)[0]!
    const text = reportText(before, next, l, 'anya')!
    assert.ok(text.includes('모른다') && !text.includes(next.factions['us']!.name), text)
    assert.ok(reportText(before, next, l, 'us')!.includes('누가 했는지는 모른다'))
  }

  it('드러나면 그 나라를 아는 다른 나라들도 조금 등 돌린다', () => {
    const { before, next } = find(plot('rumor', 'guya'), { ok: true, caught: true, exposed: true })
    const plain = advance(before, []).next
    const others = Object.keys(next.factions).filter((x) => x !== 'us' && x !== 'guya')
    assert.ok(others.some((x) => (relationOf(next, 'us', x).favor ?? 0) < (relationOf(plain, 'us', x).favor ?? 0)))
  })

  it('드러날 확률 — 보낸 이의 지략이 높을수록 · 고용 자객이면 낮고, 경계가 높을수록 · 장수가 붙잡히면 높다', () => {
    const r = byeonhanMini(1)
    const cap = r.factions['guya']!.capital
    const h = r.heroes['us-1']!
    h.ryak = 5
    const base = exposeChance(r, 'us', 'guya', cap, 'us-1')
    h.ryak = 9
    assert.ok(exposeChance(r, 'us', 'guya', cap, 'us-1') < base)
    // 고용 자객 (지략 plotHiredRyak) — 같은 지략의 우리 장수보다 덜 드러난다 (누가 샀는지 저도 잘 모른다)
    h.ryak = P.realm.plotHiredRyak
    assert.ok(exposeChance(r, 'us', 'guya', cap, null) < exposeChance(r, 'us', 'guya', cap, 'us-1'))
    h.ryak = 5
    assert.ok(exposeChance(r, 'us', 'guya', cap, 'us-1', true) > base)
    r.watch[cap]!.alert = P.realm.alertMax
    assert.ok(exposeChance(r, 'us', 'guya', cap, 'us-1') > base)
    for (const p of [base, exposeChance(r, 'us', 'guya', cap, 'us-1', true)]) assert.ok(p >= P.realm.plotExposeMin && p <= P.realm.plotExposeMax)
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

describe('공작 — 암살 (형: "암살자를 보내야지 장군 지혼자 왜 가냐")', () => {
  /** 구야 장군 거타를 본 판 — 싸워 봤거나 정찰했다 */
  const seen = (r: Realm): void => {
    r.met = { us: ['guya-1'] }
  }
  const kill = (agent?: string): Order => ({ kind: 'plot', faction: 'us', op: 'assassin', target: 'guya', hero: 'guya-1', ...(agent !== undefined ? { agent } : {}) })

  it('본 장수만 노린다 — 군주는 안 된다 · 범위가 참값을 품는다', () => {
    const r = byeonhanMini(3)
    assert.equal(plotTargets(r, 'us', 'assassin').length, 0)
    seen(r)
    const ts = plotTargets(r, 'us', 'assassin')
    assert.deepEqual(ts.map((t) => t.hero), ['guya-1'])
    const t = ts[0]!
    const [lo, hi] = plotChance(r, 'us', 'assassin', t.target, t.node, t.hero, 'us-1')
    const p = plotTrueChance(r, 'us', 'assassin', t.target, t.node, t.hero, 'us-1')
    assert.ok(lo <= p + 1e-9 && p <= hi + 1e-9)
    // 군주는 봤어도 못 노린다
    r.met = { us: ['guya-ruler'] }
    assert.equal(plotTargets(r, 'us', 'assassin').length, 0)
    // 고용 자객은 곡식이 더 든다
    assert.ok(plotCost('assassin').grain > plotCost('assassin', 'us-1').grain)
  })

  it('먹히면 그 장수가 다치거나 죽는다 — 다치면 군대를 못 이끈다', () => {
    const { next, report } = find(kill('us-1'), { ok: true, caught: false }, seen)
    const l = plotLines(report.lines)[0]!
    const h = next.heroes['guya-1']!
    if (l.result === 'kill') assert.equal(h.status, 'dead')
    else assert.ok((h.woundedUntil ?? -1) >= next.season - 1)
    assert.ok(report.lines.some((x) => x.kind === 'mystery' && x.faction === 'guya'))
  })

  it('들켜 도망을 못 치면 보낸 장수가 사로잡히고, 드러나면 그 나라와 두 칸 나빠진다', () => {
    const { before, next } = find(kill('us-1'), { ok: false, caught: true, exposed: true, agentFate: 'captured' }, seen)
    assert.equal(next.heroes['us-1']!.status, 'captive')
    assert.equal(next.heroes['us-1']!.captor, 'guya')
    assert.equal(relationOf(before, 'us', 'guya').state, 'neutral')
    assert.equal(relationOf(next, 'us', 'guya').state, 'war')
  })

  it('입을 다문 채 붙잡힌 자객은 나중에 실토한다 — 그때 드러나 두 칸 나빠진다', () => {
    const { before, next, report } = find(kill('us-1'), { ok: false, caught: true, exposed: false, agentFate: 'captured' }, seen)
    assert.equal(relationOf(next, 'us', 'guya').state, relationOf(before, 'us', 'guya').state)
    assert.deepEqual(next.hiddenAgents?.['us-1'], { from: 'us', to: 'guya' })
    assert.ok(reportText(before, next, plotLines(report.lines)[0]!, 'guya')!.includes('입을 열지 않는다'))
    let r = next
    let confessed = false
    for (let i = 0; i < 40 && !confessed; i++) {
      const prev = r
      const res = advance(r, [])
      r = res.next
      const c = res.report.lines.find((l) => l.kind === 'confess')
      if (c !== undefined && r.heroes['us-1']!.status === 'captive') {
        confessed = true
        assert.equal(relationOf(r, 'us', 'guya').state, 'war')
        assert.equal(r.hiddenAgents?.['us-1'], undefined)
        assert.ok(reportText(prev, r, c, 'guya')!.includes(r.factions['us']!.name))
      }
      if (r.heroes['us-1']!.status !== 'captive') break // 풀려났거나 죽었으면 실토할 일이 없다
    }
    assert.ok(confessed || r.heroes['us-1']!.status !== 'captive', '갇힌 채 끝내 실토를 안 했다')
  })

  it('남이 우리에게 보낸 자객 — 보고에 "누가 보냈는지 모른다" · 드러나면 그 나라 이름', () => {
    const r = byeonhanMini(1)
    const base = { kind: 'plot', faction: 'guya', op: 'assassin', target: 'us', hero: 'us-1', ok: false, caught: true } as const
    const hidden = reportText(r, r, { ...base, exposed: false }, 'us')!
    assert.ok(hidden.includes('자객을 붙잡았다') && hidden.includes('모른다') && !hidden.includes(r.factions['guya']!.name), hidden)
    const shown = reportText(r, r, { ...base, exposed: true }, 'us')!
    assert.ok(shown.includes(r.factions['guya']!.name) && shown.includes('보낸 자객'), shown)
  })

  // 자객 기본 · 장수는 도박 (형이 고름 — 2026-10-18)
  it('들켜도 장수가 빠져나올 수 있다 — 도망은 지략·무예·특성을 받는다', () => {
    const { next, report } = find(kill('us-1'), { ok: false, caught: true, agentFate: 'escaped' }, seen)
    assert.equal(next.heroes['us-1']!.status, 'free')
    assert.equal(plotLines(report.lines)[0]!.agentFate, 'escaped')
    const r = byeonhanMini(1)
    const h = r.heroes['us-1']!
    const base = escapeChance(r, 'us-1')
    h.ryak = 9
    assert.ok(escapeChance(r, 'us-1') > base)
  })

  it('고용 자객은 들켜도 장수를 잃지 않는다 — 값만 잃는다', () => {
    const { before, next, report } = find(kill(), { ok: false, caught: true }, seen)
    const mine = (x: Realm): string[] => Object.values(x.heroes).filter((h) => h.faction === 'us' && h.status === 'free').map((h) => h.id).sort()
    assert.deepEqual(mine(next), mine(before))
    assert.equal(plotLines(report.lines)[0]!.agentFate, undefined)
    assert.ok(next.stock['us']!.grain < before.stock['us']!.grain)
  })

  it('한 적장은 한 계절에 한 번만 — 둘째 암살·둘째 손맛은 없다', () => {
    const r = byeonhanMini(2)
    seen(r)
    const hand = { result: 'dead' as const, alarm: false }
    const second: Order = { kind: 'plot', faction: 'us', op: 'assassin', target: 'guya', hero: 'guya-1', agent: 'us-1', hand }
    const { report, next } = advance(r, [kill(), second])
    assert.equal(plotLines(report.lines).length, 1)
    // 첫 것(굴림)만 셌다 — 둘째의 손맛 'dead' 는 안 먹었다
    const l = plotLines(report.lines)[0]!
    assert.equal(l.agent, undefined)
    if (!l.ok) assert.equal(next.heroes['guya-1']!.status, 'free')
  })

  it('자객의 활은 계단으로 오른다 — 값이 들고, 굴림의 몫이 오른다, 신궁 위는 없다', () => {
    const r = byeonhanMini(1)
    seen(r)
    r.stock['us'] = { grain: 2000, iron: 500 }
    const t = plotTargets(r, 'us', 'assassin')[0]!
    const p0 = plotTrueChance(r, 'us', 'assassin', t.target, t.node, t.hero, null)
    assert.equal(assassinBow(r, 'us'), 0)
    let x = r
    for (let i = 1; i <= 4; i++) {
      const res = advance(x, [{ kind: 'bowUp', faction: 'us' }, { kind: 'bowUp', faction: 'us' }])
      x = res.next
      assert.equal(assassinBow(x, 'us'), Math.min(3, i), `단계 ${i}`)
      assert.equal(res.report.lines.filter((l) => l.kind === 'bowUp').length, i <= 3 ? 1 : 0, '한 계절에 한 단계')
    }
    assert.equal(bowUpCost(x, 'us'), null)
    // 굴림의 몫 — 같은 판에 활만 신궁으로
    const y = structuredClone(r)
    y.assassinBow = { us: 3 }
    assert.ok(plotTrueChance(y, 'us', 'assassin', t.target, t.node, t.hero, null) > p0)
    // 우리 장수를 보내면 밤 판 화살이 더 많다
    assert.ok(assassinArrows(r, 'us-1') > assassinArrows(r, null))
  })
})
