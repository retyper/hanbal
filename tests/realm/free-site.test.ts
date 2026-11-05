/**
 * 주인 없는 철광·포구 (형 11-05: "점령하자마자 내 땅이 되면 안 된다 · 매 턴 철이 나고 밟은 군사의 나라가 얻는다 ·
 * 주둔하면 계속 얻고, 비우면 또 쌓이다가 다시 밟으면 또 얻는다 · 편입하려면 개척")
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { regionNations, startRegion } from '../../src/realm/data/regions/index.ts'
import { freeSite, goodOf, stepSites } from '../../src/realm/economy.ts'
import { movesOf } from '../../src/realm/estimate.ts'
import { advance, otherEnd } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm, ReportLine } from '../../src/realm/types.ts'

/** 우리 군대 곁의 주인 없는 터 하나 */
function setup(): { r: Realm; army: string; edge: string; site: string } {
  const r = startRegion('byeonhan-mini', 1, regionNations('byeonhan-mini')[0]!)
  for (const a of Object.values(r.armies).filter((x) => x.faction === r.player)) {
    for (const ed of Object.values(r.edges)) {
      const to = otherEnd(ed, a.at)
      if (to !== null && freeSite(r.nodes[to])) return { r, army: a.id, edge: ed.id, site: to }
    }
  }
  // 곁에 없으면 판에 있는 주인 없는 터 하나의 이웃 고을로 우리 군대를 옮겨 둔다
  const site = Object.values(r.nodes).filter((n) => freeSite(n)).sort((x, y) => (x.id < y.id ? -1 : 1))[0]!
  const ed = Object.values(r.edges).filter((e) => (e.a === site.id || e.b === site.id) && e.kind !== 'sea').sort((x, y) => (x.id < y.id ? -1 : 1))[0]!
  const a = Object.values(r.armies).find((x) => x.faction === r.player)!
  a.at = otherEnd(ed, site.id)!
  return { r, army: a.id, edge: ed.id, site: site.id }
}

describe('주인 없는 철광·포구', () => {
  it('군대가 밟아도 우리 땅이 안 되고 · 싸울 곳(회의)으로 잡히지 않는다', () => {
    const { r, army, edge, site } = setup()
    assert.equal(movesOf(r, r.player, r.armies[army]!).find((m) => m.edge.id === edge)?.hostile, false)
    let x = advance(r, [{ kind: 'march', army, edge, ambush: false }]).next
    for (let i = 0; i < 6 && x.armies[army]?.march !== null; i++) x = advance(x, []).next
    assert.equal(x.armies[army]?.at, site)
    assert.equal(x.nodes[site]!.owner, null)
  })
  it('비워 두면 쌓이고(위 끝 있음) · 머무는 군대의 나라가 거둔다 · 거두면 다시 0부터', () => {
    const { r, site } = setup()
    for (const a of Object.values(r.armies)) if (a.at === site) a.at = 'nowhere'
    const lines: ReportLine[] = []
    for (let i = 0; i < 10; i++) stepSites(r, 'spring', lines)
    const st = r.nodes[site]!.stash ?? {}
    const total = Object.values(st).reduce((s, v) => s + (v ?? 0), 0)
    assert.ok(total > 0, '쌓인 게 없다')
    // 위 끝 — 한 철치의 siteStashSeasons 배를 넘지 않는다
    const r1 = setup().r
    for (const a of Object.values(r1.armies)) if (a.at === site) a.at = 'nowhere'
    stepSites(r1, 'spring', [])
    const one = Object.values(r1.nodes[site]!.stash ?? {}).reduce((s, v) => s + (v ?? 0), 0)
    assert.ok(total <= one * P.realm.siteStashSeasons + 1e-9)
    // 우리 군대가 머문다 → 거둔다
    const me = r.player
    const a = Object.values(r.armies).find((x) => x.faction === me)!
    a.at = site; a.march = null
    const before = { ...r.stock[me]! }
    const out: ReportLine[] = []
    stepSites(r, 'spring', out)
    assert.ok(out.some((l) => l.kind === 'haul' && l.faction === me))
    const gained = (['iron', 'salt', 'wood', 'horse'] as const).reduce((s, g) => s + goodOf(r.stock[me], g) - goodOf(before, g), 0)
    assert.ok(gained > 0)
    assert.equal(Object.values(r.nodes[site]!.stash ?? {}).reduce((s, v) => s + (v ?? 0), 0), 0)
  })
})
