/**
 * 이기는 길 — 철과 뱃길 · 큰 제사 (docs/realm/VICTORY.md §1 · src/realm/paths.ts)
 *
 *  - 교역 장부: 오간 철이 두 나라에 적히고, 네 계절이 지나면 빠진다 · 장터에서 철광 쥔 나라가 철을 판다
 *  - 철과 뱃길: 나라 수 × 철이 문턱을 넘고 철광·포구를 쥐면 이긴다 · 포구를 잃으면 안 된다 · 남이 이루면 진다(소문 먼저)
 *  - 큰 제사: 봄·가을 제사를 내리 넷, 가을에 집이 넉넉하면 이긴다 · 한 번 거르면 끊긴다 · 남이 이루면 진다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini, startRealm } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import { holdMarkets, pairKey } from '../../src/realm/diplomacy.ts'
import { ironOf, noteIron, pathsEnd, riteOf, stepPaths } from '../../src/realm/paths.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm, ReportLine } from '../../src/realm/types.ts'

/** 문턱을 넘길 만큼 철을 바꾼다 — 세 나라와 고르게 */
function trade(r: Realm, f: string, withs: readonly string[]): void {
  const need = ironOf(r, f).need
  const per = Math.ceil(need / withs.length / withs.length) + 1
  for (const w of withs) noteIron(r, f, w, per)
}

/** 계절 s 로 옮겨 제사 줄을 넣고 사슬을 센다 */
function riteSeason(r: Realm, s: number, who: readonly string[]): ReportLine[] {
  r.season = s
  const lines: ReportLine[] = who.map((f) => ({ kind: 'rite', faction: f, season: s % 4 === 0 ? 'spring' : 'autumn' }) as ReportLine)
  stepPaths(r, lines)
  return lines
}

describe('철과 뱃길', () => {
  it('교역 장부 — 두 나라에 적히고, 네 계절이 지나면 빠진다', () => {
    const r = byeonhanMini(1)
    r.season = 10
    noteIron(r, 'goja', 'us', 30)
    assert.equal(ironOf(r, 'goja').iron, 30)
    assert.deepEqual(ironOf(r, 'us').partners, ['goja'])
    r.season = 14
    stepPaths(r, [])
    assert.equal(ironOf(r, 'goja').iron, 0, '네 계절 창을 지났다')
  })

  it('장터 — 철광 쥔 나라가 철광 없는 화친 나라에 철을 판다 · 장부에 오른다', () => {
    const r = byeonhanMini(1)
    r.relations[pairKey('us', 'guya')] = { state: 'truce', until: 20 }
    r.stock['guya']!.iron = 50
    r.stock['us']!.grain = 500
    const lines: ReportLine[] = []
    holdMarkets(r, lines)
    const im = lines.find((l) => l.kind === 'ironMarket')
    assert.ok(im !== undefined && im.kind === 'ironMarket' && im.from === 'guya' && im.to === 'us' && im.iron === P.realm.marketIron)
    assert.ok(ironOf(r, 'us').partners.includes('guya'))
  })

  it('포구를 쥔 나라가 문턱을 넘으면 이긴다 · 포구를 잃으면 안 된다', () => {
    const r = startRealm(1, 'goja') // 고자국(포구)을 맡는다 · 여섯 나라가 다 있는 판 (쇠의 바다 자유판은 타국 하나 · rivals.ts)
    trade(r, 'goja', ['us', 'anya', 'miri'])
    assert.deepEqual(pathsEnd(r), { kind: 'win', by: 'goja', path: 'ironsea' })
    // 포구를 빼앗기면 뱃길이 끊긴다
    r.nodes['goja-cap']!.owner = 'dokro'
    assert.equal(ironOf(r, 'goja').gate, false)
    assert.equal(pathsEnd(r), null)
  })

  it('한 나라와 큰 거래 하나로는 안 된다 (바꾼 나라가 셋은 넘어야)', () => {
    const r = startRegion('byeonhan-mini', 1, 'goja')
    noteIron(r, 'goja', 'us', 100000)
    assert.equal(pathsEnd(r), null)
  })

  it('남이 이루면 우리가 진다 — 그 전에 소문', () => {
    const r = byeonhanMini(1)
    const lines: ReportLine[] = []
    // 문턱의 4분의 3쯤 — 소문
    const need = ironOf(r, 'dokro').need
    for (const w of ['guya', 'anya', 'miri']) noteIron(r, 'dokro', w, Math.ceil((need * 0.8) / 9))
    stepPaths(r, lines)
    assert.ok(lines.some((l) => l.kind === 'pathIron' && l.faction === 'dokro'))
    trade(r, 'dokro', ['guya', 'anya', 'miri'])
    assert.deepEqual(pathsEnd(r), { kind: 'lose', by: 'dokro', path: 'ironsea' })
  })
})

describe('큰 제사', () => {
  /** 우리 집을 판의 몫 넘게 */
  const rich = (r: Realm, f: string): void => {
    const cap = Object.values(r.nodes).find((n) => n.owner === f && r.factions[f]!.capital === n.id)!
    cap.hh += riteOf(r, f).hhNeed * 2
  }

  it('봄·가을 제사를 내리 넷, 가을에 집이 넉넉하면 이긴다', () => {
    const r = byeonhanMini(1)
    rich(r, 'us')
    for (const s of [4, 6, 8, 10]) riteSeason(r, s, ['us'])
    assert.equal(riteOf(r, 'us').chain, 4)
    r.season = 10 // 가을
    assert.deepEqual(pathsEnd(r), { kind: 'win', by: 'us', path: 'rite' })
    r.season = 11 // 겨울 — 큰 제사는 가을에만
    assert.equal(pathsEnd(r), null)
  })

  it('한 번 거르면 사슬이 끊긴다 · 집이 모자라면 안 열린다', () => {
    const r = byeonhanMini(1)
    rich(r, 'us')
    riteSeason(r, 4, ['us'])
    riteSeason(r, 6, ['us'])
    riteSeason(r, 8, []) // 봄 제사를 걸렀다
    assert.equal(riteOf(r, 'us').chain, 0)
    riteSeason(r, 10, ['us'])
    assert.equal(riteOf(r, 'us').chain, 1)
    // 집이 모자란 나라 — 사슬을 다 이어도 안 열린다
    const q = byeonhanMini(1)
    for (const s of [4, 6, 8, 10]) riteSeason(q, s, ['us'])
    q.season = 10
    assert.ok(riteOf(q, 'us').hh < riteOf(q, 'us').hhNeed)
    assert.equal(pathsEnd(q), null)
  })

  it('남이 큰 제사를 열면 우리가 진다 — 사슬이 길어지면 소문', () => {
    const r = byeonhanMini(1)
    rich(r, 'miri')
    let heard = false
    for (const s of [4, 6, 8, 10]) heard = riteSeason(r, s, ['miri']).some((l) => l.kind === 'pathRite' && l.faction === 'miri') || heard
    assert.ok(heard, '소문이 먼저 온다')
    r.season = 10
    assert.deepEqual(pathsEnd(r), { kind: 'lose', by: 'miri', path: 'rite' })
  })
})
