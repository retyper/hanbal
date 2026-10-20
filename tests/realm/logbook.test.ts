/**
 * 지난 기록 · 배우기 띠 (형 2026-10-19: "최근로그 확인할수 있어야함. 어디서 조공요구했는지 기억이안나고 어디서 전쟁선포했는지 모르겠음" ·
 * "배우기에서 이건 건너뛴다가 아니라 '다음'이어야함. 자연스럽게 '이전' 으로 갈수도 있어야함. 배우기 그 버튼은 없애")
 *  - 기록은 최근 계절이 위 · 갈래와 나라로 거른다
 *  - 남이 우리에게 건 조공 요구(ask) · 우리에게 건 전쟁(relation by) 이 기록에 글로 남는다
 *  - 배우기: 넘기는 단추가 없다 — 누를 곳을 눌러야 넘어간다 (형 2026-10-20)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { onHostile } from '../../src/realm/diplomacy.ts'
import { startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import { startTutorial } from '../../src/realm/data/regions/tutorial.ts'
import type { Ask, Order, ReportLine } from '../../src/realm/types.ts'
import { logNations, logRows, logText } from '../../src/ui/realm/logbook.ts'
import { TUT_STEPS, tutAt, tutBandHtml, tutPick } from '../../src/ui/realm/tutorial.ts'

const all = (): boolean => true

describe('지난 기록', () => {
  const r = startYeongnam(1, 'saro')
  const war: ReportLine[] = []
  onHostile(r, 'guya', 'saro', war)
  const demand: Ask = { id: 'a1', kind: 'demand', from: 'dabeol', to: 'saro', give: {}, take: { grain: 30 } } as unknown as Ask
  const hist = [
    { s: 1, lines: [{ kind: 'harvest', faction: 'saro', grain: 120 } as ReportLine] },
    { s: 2, lines: [{ kind: 'ask', ask: demand } as ReportLine, ...war] },
  ]

  it('최근 계절이 위 · 조공 요구와 전쟁 선포가 글로 남는다', () => {
    const rows = logRows(r, hist, 'saro', 'all', null, all)
    assert.equal(rows[0]!.s, 2)
    assert.ok(rows.some((x) => x.l.kind === 'ask' && x.text.includes('사신이 왔다')))
    assert.ok(rows.some((x) => x.l.kind === 'relation' && x.text.includes('우리에게 전쟁을 걸어왔다')))
    assert.equal(rows[rows.length - 1]!.s, 1)
  })

  it('갈래로 거른다 — 사신 · 전쟁·화친 · 우리 살림', () => {
    assert.deepEqual(logRows(r, hist, 'saro', 'envoy', null, all).map((x) => x.l.kind), ['ask'])
    assert.ok(logRows(r, hist, 'saro', 'rel', null, all).every((x) => x.l.kind === 'relation'))
    assert.deepEqual(logRows(r, hist, 'saro', 'home', null, all).map((x) => x.l.kind), ['harvest'])
  })

  it('나라로 거른다 — 그 나라가 적힌 줄만 (청 안의 보낸 나라까지)', () => {
    assert.deepEqual(logRows(r, hist, 'saro', 'all', 'dabeol', all).map((x) => x.l.kind), ['ask'])
    assert.ok(logNations(r, hist, 'saro').includes('dabeol') && logNations(r, hist, 'saro').includes('guya'))
    assert.ok(!logNations(r, hist, 'saro').includes('saro'))
  })

  it('남이 남에게 건 청은 우리 기록에 없다', () => {
    const other = { ...demand, to: 'guya' } as Ask
    assert.equal(logText(r, { kind: 'ask', ask: other }, 'saro'), null)
  })
})

// 형 2026-10-20: "다음만 누르면 넘어가지는데? … 그걸 눌러야 진행되게 만들어줘. 다음 이전 버튼 없어도 되겠다"
describe('배우기 — 누를 곳을 눌러야 넘어간다', () => {
  const tr = startTutorial(1)
  const ctx = { r: tr, orders: [], report: null, acts: new Set<string>() }

  it('띠에는 넘기는 단추가 없다 — 말과 몇째 단계뿐', () => {
    for (let i = 0; i < TUT_STEPS.length; i++) {
      const h = tutBandHtml(i, (x) => x)
      assert.ok(!h.includes('tut-next') && !h.includes('tut-prev') && !h.includes('<button'), `${i}단계`)
    }
    assert.ok(tutBandHtml(TUT_STEPS.length, (x) => x).includes('data-act="tut-end"'), '다 배운 뒤엔 처음으로')
  })

  it('하지 않으면 그 단계에 머문다 — 누른 단추와 고른 명령으로만 넘어간다', () => {
    assert.equal(tutAt(0, ctx), 0)
    assert.equal(tutAt(0, { ...ctx, acts: new Set(['home']) }), 1)
  })

  it('누를 곳은 나중 것부터 — 판이 열려 있으면 그 안의 단추, 아니면 탭', () => {
    const draft = TUT_STEPS.find((s) => s.id === 'draft')!
    assert.equal(tutPick(draft, ctx, (s) => s.includes('tab')), '[data-act="tab"][data-tab="draft"]')
    assert.equal(tutPick(draft, ctx, () => true), '[data-act="draft"]')
    assert.equal(tutPick(draft, ctx, () => false), null, '못 찾으면 없다 — 어둡게 막지 않는다')
  })

  it('마지막 단계 — 군대를 보내기 전엔 「다음 계절」이 아니라 군대 말을 가리킨다', () => {
    const win = TUT_STEPS.find((s) => s.id === 'win')!
    const seen = (s: string): boolean => s === '.next' || s.startsWith('.tok')
    assert.equal(tutPick(win, ctx, seen), '.tok[data-army="a-us"]')
    const going = { ...ctx, orders: [{ kind: 'march', army: 'a-us', edge: 'e10', ambush: false }] as Order[] }
    assert.equal(tutPick(win, going, seen), '.next')
  })
})
