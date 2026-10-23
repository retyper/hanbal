/**
 * 사로잡힌 장수가 돌아오는 길 (형 2026-10-23: "주몽을 뺏겨 버렸네 … 주몽 없이 고구려를 어떻게 끌지")
 *
 *  - 화친·동맹을 맺거나 잡아 둔 나라의 도읍이 떨어지면 풀려나 제 도읍으로 (releaseCaptives)
 *  - 군주는 회유되지 않는다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { releaseCaptives } from '../../src/realm/heroes.ts'
import { advance } from '../../src/realm/season.ts'
import type { ReportLine } from '../../src/realm/types.ts'

describe('사로잡힌 장수', () => {
  it('풀려나면 자유로운 몸으로 제 도읍에 · 소식 한 줄', () => {
    const r = byeonhanMini(1)
    const ruler = r.factions['us']!.ruler!
    const h = r.heroes[ruler]!
    h.status = 'captive'
    h.captor = 'guya'
    h.at = null
    const lines: ReportLine[] = []
    releaseCaptives(r, 'guya', 'us', 'peace', lines)
    assert.equal(h.status, 'free')
    assert.equal(h.captor, null)
    assert.equal(h.at, r.factions['us']!.capital)
    assert.ok(lines.some((l) => l.kind === 'freed' && l.hero === ruler))
  })

  it('군주는 회유를 받지 않는다', () => {
    const r = byeonhanMini(1)
    const ruler = r.factions['us']!.ruler!
    const h = r.heroes[ruler]!
    h.status = 'captive'
    h.captor = 'guya'
    h.at = null
    const by = Object.values(r.heroes).find((x) => x.faction === 'guya' && x.status === 'free')!.id
    const { next } = advance(r, [{ kind: 'persuade', hero: ruler, by }])
    assert.equal(next.heroes[ruler]!.persuade, undefined)
  })
})
