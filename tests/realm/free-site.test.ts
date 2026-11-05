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
  it('비워 두면 쌓이고(위 끝 있음) · 머무는 군대의 나라가 거둔다 · 덜 찬 몫은 남는다', () => {
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
    // 다 찬 몫만 가져가고 덜 찬 몫(1 아래)은 남아 다음 달에 이어 찬다
    for (const v of Object.values(r.nodes[site]!.stash ?? {})) assert.ok((v ?? 0) < 1)
  })
})

describe('주인 없는 터 — 달마다 (형 11-05: "군대 보내 놓고 있으면 철 매 턴 수급되는 거 아니었어?")', () => {
  it('우리 군대가 머물면 계절 끝이 아니어도 달마다 거두고 · 철치 소출의 반이 석 달에 고루 들어온다', () => {
    const { r, site } = setup()
    const me = r.player
    for (const a of Object.values(r.armies)) if (a.at === site) a.at = 'nowhere'
    const a = Object.values(r.armies).find((x) => x.faction === me)!
    a.at = site; a.march = null
    r.nodes[site]!.stash = {}
    let x = r
    let hauls = 0
    for (let i = 0; i < 6; i++) {
      const res = advance(x, [])
      x = res.next
      if (res.report.lines.some((l) => l.kind === 'haul' && l.faction === me && l.node === site)) hauls++
    }
    assert.ok(hauls >= 3, `여섯 달에 ${hauls}번만 거뒀다`)
  })
})

describe('주인 없는 터 — 개척단 (형 11-05: "감포로 보낸 개척단이 영원히 도착을 안 해서 개척단을 못 보낸다")', () => {
  it('편입 값을 떠날 때 치른다 · 닿으면 곳간이 비어도 서고 · 옛 판처럼 안 치르고 닿은 개척단도 서 있지 않는다', async () => {
    const { formParty, partyCost, stepParties } = await import('../../src/realm/parties.ts')
    const { foundCost } = await import('../../src/realm/economy.ts')
    const { r, site } = setup()
    const me = r.player
    const cap = r.factions[me]!.capital
    const s = r.stock[me]!
    s.grain = 99999; (s as Record<string, number>).wood = 9999
    r.nodes[cap]!.hh += 400
    const g0 = s.grain
    formParty(r, { kind: 'party', faction: me, node: cap, goal: site }, [])
    const p = Object.values(r.parties ?? {})[0]!
    assert.equal(p.paid, site)
    // 떠날 때 치른 곡식에 편입 값이 들었다
    const extra = foundCost(r, me, true).grain - foundCost(r, me).grain
    assert.ok(g0 - s.grain >= partyCost(r, me, p.hh).grain + extra - 1)
    // 곳간을 비우고 닿게 한다 → 그래도 선다
    s.grain = 0; (s as Record<string, number>).wood = 0
    p.readyAt = undefined; p.at = site; p.march = null
    for (const a of Object.values(r.armies)) if (a.at === site && a.faction !== me) a.at = cap
    const lines: ReportLine[] = []
    stepParties(r, lines)
    assert.equal(r.nodes[site]!.owner, me)
    // 옛 판 — 안 치르고 닿은 개척단 (paid 없음) 도 곳간이 비었어도 선다
    const { r: r2, site: site2 } = setup()
    const me2 = r2.player
    r2.stock[me2]!.grain = 0
    r2.parties = { old: { id: 'old', faction: me2, home: r2.factions[me2]!.capital, at: site2, hh: 20, march: null, goal: site2 } }
    for (const a of Object.values(r2.armies)) if (a.at === site2 && a.faction !== me2) a.at = r2.factions[me2]!.capital
    stepParties(r2, [])
    assert.equal(r2.nodes[site2]!.owner, me2)
    assert.ok(r2.stock[me2]!.grain >= 0)
  })
})
