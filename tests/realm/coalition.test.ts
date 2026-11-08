/**
 * 합종 (coalition.ts · 위원회 11-08 ⑤) — 앞서가는 우리를 겁낸 나라들이 묶여 친다. 쉬움(촌장)엔 없다.
 *  - 보통 이상에서 우리가 앞서가면 선다 · 서로 동맹 · 함께 칠 턴이 미리 정해진다
 *  - 쉬움에선 절대 안 선다
 *  - 화친·이간·이기기로 빠지고, 모자라면 흩어진다 · 출정을 막아 내면 쉰다 · 위협이 걷히면 흩어진다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { startRegion } from '../../src/realm/data/regions/index.ts'
import { applyTier } from '../../src/realm/tier.ts'
import { advance } from '../../src/realm/season.ts'
import { coalCandidates, coalFocusOf, coalMinOf, stepCoalition } from '../../src/realm/coalition.ts'
import { leaguePeace, pairKey, relationOf } from '../../src/realm/diplomacy.ts'
import { wealthThreat } from '../../src/realm/scale.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm, ReportLine } from '../../src/realm/types.ts'

/** 영남 이서 판 — 모두가 서로 알고, 우리 도읍이 아주 크고(앞서가는 나라), 남들과 싸우는 사이 */
function bigUs(tier: number): Realm {
  const r = startRegion('yeongnam', 1000, 'iseo')
  applyTier(r, tier)
  delete r.known
  r.season = 120
  const cap = r.factions[r.player]!.capital
  r.nodes[cap] = { ...r.nodes[cap]!, hh: 40000 }
  // 빈 고을을 우리 땅으로 — 남의 눈에도 우리 힘이 가장 커 보인다 (못 본 고을마다 범위가 붙는다)
  for (const n of Object.values(r.nodes)) if (n.owner === null && n.kind !== 'sodo' && n.kind !== 'wild') n.owner = r.player
  for (const f of Object.keys(r.factions)) {
    if (f === r.player) continue
    r.relations[pairKey(f, r.player)] = { state: 'war', until: null }
  }
  return r
}

const evs = (lines: readonly ReportLine[]): string[] => lines.flatMap((l) => (l.kind === 'coalition' ? [l.ev] : []))

describe('합종', () => {
  it('보통 난세에서 앞서가면 겁먹은 나라들이 묶인다 · 서로 동맹 · 함께 칠 턴이 미리 보인다', () => {
    const r = bigUs(1)
    assert.ok(wealthThreat(r) >= P.realm.coalThreat)
    assert.ok(coalCandidates(r).length >= coalMinOf(r))
    const lines: ReportLine[] = []
    stepCoalition(r, lines, true)
    const c = r.coalition
    assert.ok(c != null)
    assert.deepEqual(evs(lines), ['form'])
    assert.ok(c.members.length >= coalMinOf(r) && c.members.length <= P.realm.coalMax)
    assert.ok(c.strikeAt > r.season && c.endAt > c.strikeAt)
    for (const a of c.members) for (const b of c.members) if (a < b) assert.notEqual(relationOf(r, a, b).state, 'war')
    // 모이는 동안엔 노릴 값이 그대로 · 출정 동안엔 크다
    assert.equal(coalFocusOf(r, c.members[0]!, r.player), P.realm.coalGatherFocus)
    r.season = c.strikeAt
    assert.equal(coalFocusOf(r, c.members[0]!, r.player), P.realm.coalFocus)
  })

  it('쉬움(촌장)에선 아무리 커도 서지 않는다', () => {
    let r = bigUs(0)
    assert.equal(wealthThreat(r), 0)
    const lines: ReportLine[] = []
    stepCoalition(r, lines, true)
    assert.equal(r.coalition ?? null, null)
    assert.deepEqual(evs(lines), [])
    for (let i = 0; i < 6; i++) {
      const res = advance(r, [])
      assert.deepEqual(evs(res.report.lines), [])
      r = res.next
    }
    assert.equal(r.coalition ?? null, null)
  })

  it('끄면(coalOn 0) 서지 않는다', () => {
    const r = bigUs(1)
    const was = P.realm.coalOn
    ;(P.realm as { coalOn: number }).coalOn = 0
    try {
      stepCoalition(r, [], true)
      assert.equal(r.coalition ?? null, null)
    } finally {
      ;(P.realm as { coalOn: number }).coalOn = was
    }
  })

  it('출정 앞 턴 끝에 함께 칼을 뽑는다 · 우리 고을을 못 앗고 출정이 끝나면 「막아 냈다」 · 연합 나라들이 쉬고 동맹은 화친으로', () => {
    const r = bigUs(1)
    stepCoalition(r, [], true)
    const c = r.coalition!
    for (const m of c.members) r.relations[pairKey(m, r.player)] = { state: 'neutral', until: null }
    r.season = c.strikeAt - 1
    const strike: ReportLine[] = []
    stepCoalition(r, strike, false)
    assert.deepEqual(evs(strike), ['strike'])
    for (const m of c.members) assert.equal(relationOf(r, m, r.player).state, 'war')
    r.season = c.endAt - 1
    const fin: ReportLine[] = []
    stepCoalition(r, fin, false)
    assert.deepEqual(evs(fin), ['broken'])
    assert.equal(r.coalition, null)
    assert.ok((r.coalRest ?? 0) > r.season)
    for (const m of c.members) assert.ok((r.factions[m]!.beaten?.until ?? -1) > r.season)
    for (const key of c.bound) {
      const [a, b] = key.split('|') as [string, string]
      assert.equal(relationOf(r, a, b).state, 'truce')
    }
    // 쉬는 동안엔 새 연합이 서지 않는다
    stepCoalition(r, [], true)
    assert.equal(r.coalition, null)
  })

  it('우리와 새로 화친한 나라는 빠지고 · 모자라면 흩어진다', () => {
    const r = bigUs(1)
    stepCoalition(r, [], true)
    const c = r.coalition!
    const need = coalMinOf(r)
    // 모자랄 때까지 하나씩 화친
    const out: string[] = []
    for (const m of c.members.slice()) {
      r.relations[pairKey(m, r.player)] = { state: 'truce', until: r.season + 20 }
      const lines: ReportLine[] = []
      stepCoalition(r, lines, false)
      out.push(...evs(lines))
      if (r.coalition == null) break
      assert.equal(r.coalition.members.includes(m), false)
    }
    assert.ok(out.includes('leave'))
    assert.equal(out[out.length - 1], 'scatter')
    assert.equal(r.coalition, null)
    assert.ok(c.members.length < need)
  })

  it('이간으로 연합이 맺어 준 동맹이 깨지면 약한 쪽이 빠진다', () => {
    const r = bigUs(1)
    stepCoalition(r, [], true)
    const c = r.coalition!
    const key = c.bound[0]
    assert.ok(key !== undefined)
    const [a, b] = key.split('|') as [string, string]
    r.relations[key] = { ...r.relations[key]!, state: 'truce', until: r.season + 8 }
    const lines: ReportLine[] = []
    stepCoalition(r, lines, false)
    const leave = lines.find((l) => l.kind === 'coalition' && l.ev === 'leave')
    assert.ok(leave !== undefined && leave.kind === 'coalition')
    assert.equal(leave.why, 'sow')
    assert.ok(leave.who === a || leave.who === b)
  })

  it('우리에게 coalLeaveLosses 번 진 나라는 물러난다', () => {
    const r = bigUs(1)
    stepCoalition(r, [], true)
    const c = r.coalition!
    const m = c.members[0]!
    c.defeats[m] = P.realm.coalLeaveLosses
    const lines: ReportLine[] = []
    stepCoalition(r, lines, false)
    const leave = lines.find((l) => l.kind === 'coalition' && l.ev === 'leave')
    assert.ok(leave !== undefined && leave.kind === 'coalition' && leave.who === m && leave.why === 'beaten')
  })

  it('우리가 작아져 위협이 걷히면 (출정 앞이면) 흩어진다', () => {
    const r = bigUs(1)
    stepCoalition(r, [], true)
    const cap = r.factions[r.player]!.capital
    r.nodes[cap] = { ...r.nodes[cap]!, hh: 500 }
    for (const n of Object.values(r.nodes)) if (n.owner === r.player && n.id !== cap) n.owner = null
    const lines: ReportLine[] = []
    stepCoalition(r, lines, true)
    assert.deepEqual(evs(lines), ['fade'])
    assert.equal(r.coalition, null)
  })

  it('옛 저장(연합 칸 없음)도 그대로 넘어가고 · 같은 판은 같은 연합 (결정론)', () => {
    const a = bigUs(1)
    const b = bigUs(1)
    delete a.coalition
    const ra = advance(a, []).next
    const rb = advance(b, []).next
    assert.deepEqual(ra.coalition ?? null, rb.coalition ?? null)
  })
  it('합종을 깬 뒤의 화친 — 진 쪽만 우리 장수를 돌려주고 우리가 잡은 적장은 우리가 쥔다 (위원회 11-08b Q2)', () => {
    const r = bigUs(1)
    const me = r.player
    const foe = Object.keys(r.factions).find((f) => f !== me)!
    r.relations = { ...(r.relations ?? {}), [pairKey(me, foe)]: { state: 'war', until: null } }
    const theirs = Object.values(r.heroes).find((h) => h.faction === foe)!
    const ours = Object.values(r.heroes).find((h) => h.faction === me && h.id !== r.factions[me]!.ruler)!
    theirs.status = 'captive'; theirs.captor = me
    ours.status = 'captive'; ours.captor = foe
    const lines: ReportLine[] = []
    leaguePeace(r, me, foe, lines)
    assert.equal(relationOf(r, me, foe).state, 'truce', '싸움이 그친다')
    assert.equal(theirs.status, 'captive', '우리가 잡은 적장은 그대로')
    assert.equal(theirs.captor, me)
    assert.equal(ours.status, 'free', '우리 장수는 돌아온다')
    assert.ok(!lines.some((l) => l.kind === 'freed' && l.hero === theirs.id), '적장을 돌려보냈다는 줄이 없다')
  })
})
