/**
 * 혈통 — 혼인과 자식 (src/realm/heroes.ts · SYSTEMS §5-10 · 슬롯 ⑨ · 팰 교배)
 *
 *  - 혼인: 같은 나라 · 자유로운 몸 · 남녀 · 둘 다 짝 없음 · 잔치 곡식 · 짝이 적힌다
 *  - wedSeasons 뒤 자식 장수가 나선다: 부모 · 우리 나라 · 도읍 · 능력치는 부모 평균 ± wedSpread · 특성은 부모 것에서 (대박은 둘 다 없던 것) · 셋까지
 *  - 같은 판이면 같은 아이 (결정론)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { canWed, inheritOf } from '../../src/realm/heroes.ts'
import { advance } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, Realm, ReportLine } from '../../src/realm/types.ts'

const pass = (r: Realm, orders: Order[] = []): { next: Realm; lines: readonly ReportLine[] } => {
  const { next, report } = advance(r, orders)
  return { next, lines: report.lines }
}

/** 우리 나라의 남녀 짝 하나 — 없으면 남의 장수 하나를 우리 사람으로 */
function couple(r: Realm): [string, string] {
  const ours = Object.values(r.heroes).filter((h) => h.faction === r.player && h.status === 'free').sort((a, b) => (a.id < b.id ? -1 : 1))
  const g = ours.find((h) => h.look === 'g')
  const w = ours.find((h) => h.look === 'w')
  if (g !== undefined && w !== undefined) return [g.id, w.id]
  const need = g === undefined ? 'g' : 'w'
  const x = Object.values(r.heroes).filter((h) => h.look === need && h.faction !== r.player && !h.id.endsWith('-ruler')).sort((a, b) => (a.id < b.id ? -1 : 1))[0]!
  for (const a of Object.values(r.armies)) if (a.hero === x.id) a.hero = null
  x.faction = r.player
  x.at = r.factions[r.player]!.capital
  return g !== undefined ? [g.id, x.id] : [x.id, w!.id]
}

describe('혈통 — 혼인', () => {
  it('같은 나라 · 남녀 · 짝 없음만', () => {
    const r = byeonhanMini(3)
    const [a, b] = couple(r)
    assert.equal(canWed(r, r.player, a, b), true)
    assert.equal(canWed(r, r.player, a, a), false)
    const foe = Object.values(r.heroes).find((h) => h.faction !== r.player && h.look !== r.heroes[a]!.look)!
    assert.equal(canWed(r, r.player, a, foe.id), false)
    r.heroes[b]!.spouse = 'x'
    assert.equal(canWed(r, r.player, a, b), false)
  })

  it('잔치 곡식이 들고 짝이 적힌다 · 곡식이 모자라면 안 된다', () => {
    const r = byeonhanMini(3)
    const [a, b] = couple(r)
    r.stock[r.player]!.grain = 1000
    const { next, lines } = pass(r, [{ kind: 'wed', faction: r.player, a, b }])
    assert.equal(next.heroes[a]!.spouse, b)
    assert.equal(next.heroes[b]!.spouse, a)
    assert.equal(next.births?.length, 1)
    assert.ok(lines.some((l) => l.kind === 'wed'))
    const poor = byeonhanMini(3)
    const [c, d] = couple(poor)
    poor.stock[poor.player]!.grain = P.realm.wedGrain - 1
    const p2 = pass(poor, [{ kind: 'wed', faction: poor.player, a: c, b: d }]).next
    assert.equal(p2.heroes[c]!.spouse, undefined)
  })
})

describe('혈통 — 자식', () => {
  const grow = (seed: number): { r: Realm; a: string; b: string; kid: string; lines: ReportLine[] } => {
    let r = byeonhanMini(seed)
    const [a, b] = couple(r)
    r.stock[r.player]!.grain = 5000
    r = pass(r, [{ kind: 'wed', faction: r.player, a, b }]).next
    const lines: ReportLine[] = []
    for (let i = 0; i < P.realm.wedSeasons + 1; i++) {
      r.stock[r.player]!.grain = 5000
      const s = pass(r)
      r = s.next
      lines.push(...s.lines)
    }
    const kid = Object.keys(r.heroes).find((id) => id.startsWith('kid-'))!
    return { r, a, b, kid, lines }
  }

  it('때가 되면 나선다 — 부모 · 우리 나라 · 능력치는 부모 평균 언저리 · 특성은 셋까지', () => {
    const { r, a, b, kid, lines } = grow(11)
    assert.ok(kid !== undefined, '아이가 나서야 한다')
    const k = r.heroes[kid]!
    const pa = r.heroes[a]!
    const pb = r.heroes[b]!
    assert.deepEqual(k.parents, [a < b ? a : b, a < b ? b : a])
    assert.equal(k.faction, r.player)
    assert.equal(k.status, 'free')
    assert.ok(k.at !== null)
    for (const s of ['mu', 'tong', 'ryak', 'chi', 'deok'] as const) {
      // 부모가 그동안 자랐을 수 있다 — 한 단계 더 너그럽게
      assert.ok(Math.abs(k[s] - (pa[s] + pb[s]) / 2) <= P.realm.wedSpread + 1.5, `${s} ${k[s]} vs ${pa[s]},${pb[s]}`)
      assert.ok(k[s] >= 1 && k[s] <= 10)
    }
    assert.ok(k.traits.length <= 3)
    const birth = lines.find((l): l is Extract<ReportLine, { kind: 'birth' }> => l.kind === 'birth')!
    const inh = inheritOf(r, a, b).traits
    for (const t of k.traits) assert.ok(inh.includes(t) || t === birth.surprise, t)
    assert.equal(r.births?.length ?? 0, 0)
  })

  it('같은 판이면 같은 아이', () => {
    const x = grow(5)
    const y = grow(5)
    assert.deepEqual(x.r.heroes[x.kid], y.r.heroes[y.kid])
  })

  it('대박 — 부모 누구에게도 없던 특성이 터지기도 한다 (판이 여럿이면)', () => {
    let hits = 0
    let kids = 0
    for (let seed = 1; seed <= 60; seed++) {
      const g = grow(seed)
      if (g.kid === undefined) continue
      kids++
      const b = g.lines.find((l): l is Extract<ReportLine, { kind: 'birth' }> => l.kind === 'birth')
      if (b?.surprise !== undefined) {
        hits++
        assert.ok(!inheritOf(g.r, g.a, g.b).traits.includes(b.surprise))
      }
    }
    assert.ok(kids >= 50)
    assert.ok(hits <= kids * 0.25, `대박이 너무 잦다 ${hits}/${kids}`)
  })
})
