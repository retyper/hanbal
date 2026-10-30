/**
 * 장수 판의 「기억」 줄 (src/ui/realm/memrow.ts · MEMORY §3-2 5)
 *
 *  - 기억 한 줄마다 그림 하나 · 누르면 뜨는 한 줄(평서)이 비거나 깨지지 않는다 (undefined · 긴 줄표 없음)
 *  - 기억이 없으면 줄이 없다 · 남의 장수는 우리와 얽힌 일만 보인다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { memLine, memRowHtml, memSeen } from '../../src/ui/realm/memrow.ts'
import type { Mem } from '../../src/realm/types.ts'

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

describe('기억 줄', () => {
  const r = byeonhanMini(1)
  r.heroes['guya-1']!.status = 'captive'
  const all: Mem[] = [
    { s: 0, k: 'battle', at: 'guya-vil', foe: 'guya', who: 'guya-1', how: 'road', res: 'won' },
    { s: 1, k: 'battle', at: 'our-cap', foe: 'guya', how: 'night', res: 'lost', on: 1 },
    { s: 2, k: 'battle', at: 'guya-vil', foe: 'guya', how: 'field', res: 'draw' },
    { s: 3, k: 'duel', at: 'guya-vil', foe: 'guya', who: 'guya-1', res: 'won', keep: true },
    { s: 4, k: 'captured', at: 'guya-cap', foe: 'guya', who: 'guya-1', keep: true },
    { s: 5, k: 'captured', foe: 'miri', how: 'envoy', keep: true },
    { s: 6, k: 'freed', foe: 'guya', how: 'peace', keep: true },
    { s: 7, k: 'freed', foe: 'guya', how: 'turned', who: 'guya-1', keep: true },
    { s: 8, k: 'plot', foe: 'guya', how: 'burn', res: 'ok' },
    { s: 9, k: 'plot', how: 'assassin', res: 'fail', on: 1 },
    { s: 10, k: 'woo', who: 'guya-1', how: 'soothe+fear', res: 'fail' },
    { s: 11, k: 'woo', foe: 'guya', who: 'guya-1', on: 1 },
    { s: 12, k: 'split', at: 'our-cap', foe: 'guya', n: 0, res: 'fail' },
    { s: 13, k: 'split', at: 'our-east', foe: 'guya', n: 30, res: 'ok' },
    { s: 14, k: 'council', how: 'route', res: 'ok' },
    { s: 15, k: 'betrayed', foe: 'anya' },
  ]

  it('모든 갈래의 한 줄이 계절로 시작하고 깨진 데가 없다', () => {
    for (const m of all) {
      const line = memLine(r, m, 'us')
      assert.ok(line.startsWith(`${Math.floor(m.s / 4) + 1}년 `), line)
      assert.ok(!/undefined|NaN|—|\$\{/.test(line), line)
      assert.ok(line.split(' · ').length >= 2, line)
    }
  })

  it('예: 싸움 · 나눠 떠남 · 회유', () => {
    assert.match(memLine(r, all[0]!, 'us'), /^1년 봄 · .+ 싸움 · 가락국을 침 · 대로 · 이김$/)
    assert.equal(memLine(r, all[12]!, 'us'), '4년 봄 · 다 데리고 가락국으로 · 도읍이 털림')
    assert.match(memLine(r, all[13]!, 'us'), /3할 남기고 가락국으로 · 뒤 무사$/)
    assert.match(memLine(r, all[10]!, 'us'), /달래기, 겁주기 · 노여움$/)
  })

  it('기억이 없으면 줄이 없고, 있으면 줄마다 그림 하나', () => {
    const h = r.heroes['chief']!
    assert.equal(memRowHtml(r, h, 'us', '/realm/', esc), '')
    h.mem = all
    const html = memRowHtml(r, h, 'us', '/realm/', esc)
    assert.equal((html.match(/class="mm-i /g) ?? []).length, all.length)
    assert.ok(html.includes('icon/plot-burn.png') && html.includes('icon/war-melee.png') && html.includes('mm-chain'))
  })

  it('남의 장수는 우리와 얽힌 일만', () => {
    const g = r.heroes['guya-2']!
    g.mem = [
      { s: 1, k: 'battle', at: 'our-cap', foe: 'us', res: 'won' },
      { s: 2, k: 'battle', at: 'anya-cap', foe: 'anya', res: 'won' },
      { s: 3, k: 'duel', foe: 'anya', who: 'chief', res: 'lost' },
    ]
    assert.deepEqual(memSeen(r, g, 'us').map((m) => m.s), [1, 3])
    assert.equal(memSeen(r, g, 'guya').length, 3)
  })
})
