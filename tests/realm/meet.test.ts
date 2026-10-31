/**
 * 새 나라 소개 — 한 계절에 하나씩 (discovery.stepMeet · FOCUS G 형: "한 계절에 모르는 도시 2개 이상이면 과부하")
 *
 *  - 한 턴에 둘을 알게 되면 하나만 화면에 나오고, 다른 하나는 다음 계절에 (달 시계면 같은 계절의 다음 달엔 안 나온다)
 *  - 판의 셈(known)은 바로 는다 — 줄은 화면(met)만 늦춘다 · 소개 수를 바꿔도 판은 똑같이 흐른다
 *  - 우리와 싸운 나라는 줄을 건너뛰고 바로 나온다
 *  - 옛 저장(meet 없음)도 그대로 열려 흐른다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders, decide } from '../../src/realm/ai.ts'
import { knows, met, stepMeet } from '../../src/realm/discovery.ts'
import { monthClock, startRegion } from '../../src/realm/data/regions/index.ts'
import { startSouth } from '../../src/realm/data/regions/south.ts'
import { advance } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Realm, ReportLine } from '../../src/realm/types.ts'

/** 플레이어가 아직 모르는 살아 있는 나라 둘 */
function strangers(r: Realm): [string, string] {
  const me = r.player
  const alive = (f: string): boolean => Object.values(r.nodes).some((n) => n.owner === f)
  const out = Object.keys(r.factions).sort().filter((f) => f !== me && alive(f) && !knows(r, me, f))
  assert.ok(out.length >= 2, '모르는 나라가 둘은 있어야 한다')
  return [out[0]!, out[1]!]
}

/** 플레이어가 x 를 알게 됐다 — 판의 셈(known)과 보고의 줄을 함께 (discover() 가 하는 일) */
function learn(r: Realm, x: string, lines: ReportLine[]): void {
  r.known![r.player] = [...r.known![r.player]!, x].sort()
  lines.push({ kind: 'discover', faction: r.player, nation: x, how: 'rumor' })
}

const shown = (lines: readonly ReportLine[], me: string): string[] =>
  lines.flatMap((l) => (l.kind === 'discover' && l.faction === me ? [l.nation] : []))

describe('새 나라 소개', () => {
  it('달 시계 — 한 턴에 둘을 알면 하나만 · 둘째는 같은 계절엔 안 나오고 다음 계절 첫 달에', () => {
    const r = startRegion('yeongnam', 3, 'us')
    assert.equal(r.clock, 'month')
    const me = r.player
    const [a, b] = strangers(r)
    const l0: ReportLine[] = []
    learn(r, a, l0)
    learn(r, b, l0)
    stepMeet(r, l0, 0) // 3월
    assert.deepEqual(shown(l0, me), [a])
    assert.ok(knows(r, me, b), '판의 셈은 바로 안다')
    assert.ok(met(r, me, a) && !met(r, me, b), '화면은 하나만 안다')
    const l1: ReportLine[] = []
    stepMeet(r, l1, 1) // 4월 — 같은 봄
    assert.deepEqual(shown(l1, me), [])
    assert.ok(!met(r, me, b))
    const l2: ReportLine[] = []
    stepMeet(r, l2, 2) // 5월 — 아직 봄
    assert.deepEqual(shown(l2, me), [])
    const l3: ReportLine[] = []
    stepMeet(r, l3, 3) // 6월 — 여름
    assert.deepEqual(shown(l3, me), [b])
    assert.ok(met(r, me, b))
    assert.deepEqual(r.meet?.wait, [])
  })

  it('계절 시계(옛 판) — 다음 턴이 다음 계절이라 둘째는 바로 다음 턴에', () => {
    const r = startRegion('yeongnam', 3, 'us')
    delete (r as { clock?: string }).clock
    const me = r.player
    const [a, b] = strangers(r)
    const l0: ReportLine[] = []
    learn(r, a, l0)
    learn(r, b, l0)
    stepMeet(r, l0, 0)
    assert.deepEqual(shown(l0, me), [a])
    const l1: ReportLine[] = []
    stepMeet(r, l1, 1)
    assert.deepEqual(shown(l1, me), [b])
  })

  it('줄에 선 나라가 우리와 싸우면 줄을 건너뛰고 바로 나온다', () => {
    const r = startRegion('yeongnam', 3, 'us')
    const me = r.player
    const [a, b] = strangers(r)
    const l0: ReportLine[] = []
    learn(r, a, l0)
    learn(r, b, l0)
    stepMeet(r, l0, 0)
    assert.ok(!met(r, me, b))
    const l1: ReportLine[] = [{ kind: 'relation', a: me < b ? me : b, b: me < b ? b : me, state: 'war', by: b }]
    stepMeet(r, l1, 1) // 같은 봄이지만 싸움을 걸어왔다
    assert.deepEqual(shown(l1, me), [b])
    assert.ok(met(r, me, b))
  })

  it('판을 흘려도 소개는 한 계절에 하나를 넘지 않고(얽힌 나라 빼고) · 아는 나라는 소개됐거나 줄에 있다', () => {
    let r = monthClock(startSouth(5, 'baekje'))
    const me = r.player
    const per = new Map<number, number>()
    const seen = new Set<string>()
    for (let t = 0; t < 36 && !r.outcome; t++) {
      const res = advance(r, [...aiOrders(r), ...decide(r, me, 'planner')])
      for (const x of shown(res.report.lines, me)) {
        assert.ok(!seen.has(x), `${x} 를 두 번 소개했다`)
        seen.add(x)
        const si = Math.floor(res.report.season / 3)
        per.set(si, (per.get(si) ?? 0) + 1)
      }
      r = res.next
      for (const f of r.known![me]!) assert.ok(met(r, me, f) || r.meet!.wait.some((w) => w.nation === f), `${f} 가 사라졌다`)
    }
    assert.ok(seen.size > 0, '판이 흘러도 새 나라를 하나도 못 만났다')
    // 얽힌 나라는 건너뛰므로 둘이 되는 계절이 드물게 있을 수 있다 — 그래도 대부분은 하나
    const over = [...per.values()].filter((n) => n > P.realm.meetPerSeason).length
    assert.ok(over <= Math.ceil(per.size / 4), `한 계절에 둘 넘게 나온 계절이 너무 많다 (${over}/${per.size})`)
  })

  it('소개는 화면만 늦춘다 — 소개 수를 바꿔도 판(known · 땅 · 군대)은 똑같이 흐른다', () => {
    const run = (): Realm => {
      let r = monthClock(startSouth(9, 'baekje'))
      for (let t = 0; t < 24 && !r.outcome; t++) r = advance(r, [...aiOrders(r), ...decide(r, r.player, 'planner')]).next
      return r
    }
    const keep = P.realm.meetPerSeason
    let one: Realm
    let many: Realm
    try {
      P.realm.meetPerSeason = 1
      one = run()
      P.realm.meetPerSeason = 4
      many = run()
    } finally { P.realm.meetPerSeason = keep }
    assert.deepEqual(one.known, many.known)
    assert.deepEqual(one.nodes, many.nodes)
    assert.deepEqual(one.armies, many.armies)
    assert.deepEqual(one.relations, many.relations)
  })

  it('옛 저장(meet 없음)도 열려 흐른다 · 처음 알게 된 나라부터 줄이 선다', () => {
    let r = monthClock(startSouth(5, 'baekje'))
    for (let t = 0; t < 6; t++) r = advance(r, [...aiOrders(r), ...decide(r, r.player, 'planner')]).next
    const old = JSON.parse(JSON.stringify(r)) as Realm
    delete old.meet
    // 옛 저장은 지금 아는 나라를 다 본다
    for (const f of old.known![old.player]!) assert.ok(met(old, old.player, f))
    let x = old
    for (let t = 0; t < 9 && !x.outcome; t++) x = JSON.parse(JSON.stringify(advance(x, [...aiOrders(x), ...decide(x, x.player, 'planner')]).next)) as Realm
    assert.ok(x.season > old.season)
    for (const w of x.meet?.wait ?? []) assert.ok(knows(x, x.player, w.nation))
  })
})
