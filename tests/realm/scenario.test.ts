/**
 * 캠페인의 장 (CAMPAIGN.md · scenario.ts)
 *  - 1장 형제의 강 = 배우는 판에 장이 얹힌다 — 미추홀 도읍을 쥐면 이긴다 (옛 셈과 같다)
 *  - 목표마다: 쥐기 · 따르게 하기(동맹·조공) · 쓰러뜨리기 · 사건 · 버티기 — 모두 이뤄야 이긴다
 *  - 기한을 넘기면 진다 · 도읍을 잃으면 진다(그대로) · 장에서는 맹주·철·제사의 끝이 닫힌다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { CHAPTERS, chapterOfRegion, chapterScenario } from '../../src/realm/data/campaign.ts'
import { startTutorial } from '../../src/realm/data/regions/tutorial.ts'
import { pairKey } from '../../src/realm/diplomacy.ts'
import { goalState, markEvent, scenarioOutcome, seasonsLeft } from '../../src/realm/scenario.ts'
import { checkOutcome } from '../../src/realm/season.ts'
import { goalBandHtml } from '../../src/ui/realm/goalband.ts'

const esc = (s: string): string => s

describe('캠페인의 장', () => {
  it('0장 형제의 강 — 배우는 판에 얹히고, 미추홀 도읍을 쥐면 이긴다', () => {
    assert.equal(CHAPTERS[0]!.id, 'brothers')
    assert.equal(chapterOfRegion('tutorial')?.n, 0)
    const r = startTutorial(1)
    assert.equal(r.scenario?.id, 'brothers')
    assert.equal(checkOutcome(r), null)
    r.nodes['tut-michuhol-cap']!.owner = 'baekje'
    assert.equal(checkOutcome(r), 'win')
  })

  it('도읍을 잃으면 장에서도 진다', () => {
    const r = startTutorial(1)
    r.nodes[r.factions['baekje']!.capital]!.owner = 'michuhol'
    for (const n of Object.values(r.nodes)) if (n.owner === 'baekje') n.owner = 'michuhol'
    assert.equal(checkOutcome(r), 'lose')
  })

  it('목표를 모두 이뤄야 — 따르게 하기 · 쓰러뜨리기 · 사건 · 기한', () => {
    const r = startTutorial(1)
    const ruler = r.factions['michuhol']!.ruler!
    r.scenario = {
      id: 'test', limit: 6,
      win: [
        { kind: 'submit', factions: ['michuhol'], how: 'either' },
        { kind: 'fell', hero: ruler },
        { kind: 'event', id: 'contest' },
      ],
    }
    assert.equal(scenarioOutcome(r), null)
    r.relations[pairKey('baekje', 'michuhol')] = { state: 'ally', until: null }
    assert.equal(goalState(r, r.scenario.win[0]!).done, true)
    r.heroes[ruler]!.status = 'captive'
    assert.equal(scenarioOutcome(r), null) // 사건이 남았다
    markEvent(r, 'contest')
    markEvent(r, 'contest')
    assert.deepEqual(r.scenario.marks, ['contest'])
    assert.equal(scenarioOutcome(r), 'win')
    // 기한
    r.scenario = { id: 'test', limit: 6, win: [{ kind: 'event', id: 'never' }] }
    r.season = 3
    assert.equal(seasonsLeft(r), 3)
    assert.equal(scenarioOutcome(r), null)
    r.season = 5
    assert.equal(scenarioOutcome(r), 'lose')
  })

  it('조공으로 따르게 하기 — 우리가 맹주일 때만, 기한 안에서', () => {
    const r = startTutorial(1)
    const g = { kind: 'submit', factions: ['michuhol'], how: 'tribute' } as const
    r.relations[pairKey('baekje', 'michuhol')] = { state: 'truce', until: 8, vassal: { lord: 'michuhol', until: 8 } }
    assert.equal(goalState(r, g).done, false)
    r.relations[pairKey('baekje', 'michuhol')] = { state: 'truce', until: 8, vassal: { lord: 'baekje', until: 8 } }
    assert.equal(goalState(r, g).done, true)
    r.season = 9
    assert.equal(goalState(r, g).done, false)
  })

  it('장의 목표는 판마다 제 것 — 한 판의 사건이 다른 판에 새지 않는다', () => {
    const a = chapterScenario('brothers'), b = chapterScenario('brothers')
    a.marks = ['x']
    assert.equal(b.marks, undefined)
    assert.notEqual(a.win, b.win)
  })

  it('목표 띠 — 장이면 보이고, 옛 배우는 판 저장(장이 없음)에도 보인다', () => {
    const r = startTutorial(1)
    assert.ok(goalBandHtml(r, esc).includes('형제의 강'))
    delete r.scenario
    assert.ok(goalBandHtml(r, esc).includes('미추홀'))
    r.region = 'yeongnam'
    assert.equal(goalBandHtml(r, esc), '')
  })
})
