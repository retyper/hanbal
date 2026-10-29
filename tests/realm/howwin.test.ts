/**
 * 이기는 법 — 진 싸움을 읽어 까닭을 짚고, 넘길 판 여덟 장을 까닭부터 늘어놓는다 (src/ui/realm/howwin.ts · 형 10-29)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { startRegion } from '../../src/realm/data/regions/index.ts'
import { advance } from '../../src/realm/season.ts'
import type { ReportLine } from '../../src/realm/types.ts'
import { P } from '../../src/tune/params.ts'
import { LESSON_ORDER, lessons, lossOf } from '../../src/ui/realm/howwin.ts'

function fake(outcome: 'lose' | 'win', men: [number, number]): { loss: ReturnType<typeof lossOf> } {
  const r0 = startRegion('byeonhan-mini', 7, 'us')
  const { next, report } = advance(r0, [])
  const ours = Object.values(r0.armies).find((a) => a.faction === r0.player)!
  const foe = Object.values(r0.armies).find((a) => a.faction !== r0.player && a.march === null)!
  const line = {
    kind: 'battle', node: foe.at, attacker: ours.id, allies: [], pincer: false, defender: foe.faction, ambush: 'none', p: 0.3, outcome,
    captured: null, killed: null, militia: 0, atkFaction: r0.player, start: { men, morale: [1, 1], heroes: [null, null] },
    rounds: [{ a: 'charge', d: 'hold', beat: 'd', push: 0.3, na: 0, nd: 0, ma: 0, md: 0 }],
  } as unknown as ReportLine
  return { loss: lossOf(r0, next, { ...report, lines: [...report.lines, line] }, r0.player) }
}

describe('이기는 법', () => {
  it('쳐서 졌으면 읽고 · 이겼으면 없다', () => {
    const { loss } = fake('lose', [80, 240])
    assert.ok(loss !== null)
    assert.equal(loss.causes[0], 'draft') // 적이 셋 배 — 머릿수가 첫 까닭
    assert.ok(loss.causes.length <= 3)
    assert.equal(fake('win', [80, 240]).loss, null)
  })
  it('판은 여덟 장 · 까닭이 앞에', () => {
    const { loss } = fake('lose', [80, 240])
    const pages = lessons({ art: '/', flag: () => null, wait: () => 0 }, loss)
    assert.equal(pages.length, LESSON_ORDER.length)
    assert.deepEqual(pages.slice(0, loss!.causes.length).map((p) => p.id), [...loss!.causes])
    assert.ok(pages.every((p) => p.html.includes('lsn-go')))
  })
  it('띠의 시간 값은 맨 숫자', () => {
    assert.equal(typeof P.realm.howWinToastMs, 'number')
    assert.equal(typeof P.realm.howWinFreeShows, 'number')
  })
})
