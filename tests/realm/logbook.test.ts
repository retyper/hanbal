/**
 * 지난 기록 · 배우기 띠 (형 2026-10-19: "최근로그 확인할수 있어야함. 어디서 조공요구했는지 기억이안나고 어디서 전쟁선포했는지 모르겠음" ·
 * "배우기에서 이건 건너뛴다가 아니라 '다음'이어야함. 자연스럽게 '이전' 으로 갈수도 있어야함. 배우기 그 버튼은 없애")
 *  - 기록은 최근 계절이 위 · 갈래와 나라로 거른다
 *  - 남이 우리에게 건 조공 요구(ask) · 우리에게 건 전쟁(relation by) 이 기록에 글로 남는다
 *  - 배우기 띠: 다음 · 이전 (이전은 안내만 다시 본다) · '배우기 그만' 단추가 없다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { onHostile } from '../../src/realm/diplomacy.ts'
import { startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import type { Ask, ReportLine } from '../../src/realm/types.ts'
import { logNations, logRows, logText } from '../../src/ui/realm/logbook.ts'
import { TUT_STEPS, tutBandHtml, tutShown, tutStep } from '../../src/ui/realm/tutorial.ts'

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

describe('배우기 띠 — 다음 · 이전', () => {
  it('다음은 지금 단계를 넘기고, 이전은 안내만 되돌려 본다', () => {
    let s = { at: 3, view: null as number | null }
    s = tutStep(s.at, s.view, -1)
    assert.deepEqual(s, { at: 3, view: 2 })
    assert.equal(tutShown(s.at, s.view), 2)
    s = tutStep(s.at, s.view, -1)
    assert.equal(tutShown(s.at, s.view), 1)
    s = tutStep(s.at, s.view, 1)
    s = tutStep(s.at, s.view, 1)
    assert.deepEqual(s, { at: 3, view: null }, '돌아가 보던 것이 지금 단계에 닿으면 끝난다')
    s = tutStep(s.at, s.view, 1)
    assert.deepEqual(s, { at: 4, view: null })
    assert.equal(tutStep(0, null, -1).view, null, '첫 단계에서 이전은 없다')
    assert.equal(tutStep(TUT_STEPS.length - 1, null, 1).at, TUT_STEPS.length)
  })

  it("띠에는 '다음 ›'과 '‹ 이전'이 있고 '배우기 그만'은 없다", () => {
    const h = tutBandHtml(2, (x) => x, 4)
    assert.ok(h.includes('data-act="tut-next"') && h.includes('data-act="tut-prev"'))
    assert.ok(!h.includes('그만') && !h.includes('건너뛴다'))
    assert.ok(h.includes('다시 보는 중'))
    assert.ok(!tutBandHtml(0, (x) => x, 0).includes('tut-prev'))
  })
})
