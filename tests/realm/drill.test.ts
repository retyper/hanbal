/**
 * 단련 (src/realm/drill.ts · docs/realm/HERO-GROWTH.md ★ 둘째 판) — 판을 넘어 자라는 장수
 *
 *  - 판 안: 우리 장수마다 공이 쌓인다 (싸움 · 겨루기 · 사로잡음 · 맡은 고을 · 이끈 군대 · 공작 · 사신). 남의 장수는 안 쌓인다
 *  - 판 끝: 이기든 지든 새긴다 · 이기면 ×1.5 · 같은 판은 한 번만 (무한 모드로 이어 둔 몫만 더) · 쓰러진 장수도 공은 남는다
 *  - 단련터: n → n+1 은 n+2 · 능력치 하나 +1 · 그릇은 타고난 값+3 · 10 을 못 넘는다
 *  - 다음 판: 우리 장수만 단련 몸 · 남의 나라의 같은 사람은 처음 몸 · 배우는 판은 안 입힌다
 *  - 결정론 · 옛 판(merit 없음)도 돈다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { aiOrders, decide } from '../../src/realm/ai.ts'
import {
  addMerit, applyDrill, battleMerit, canRaise, capOf, drillRealm, earnedOf, emptyDrill, engrave, gainOf, meritOf, raise, raiseState, seasonMerit, spendCost, type DrillStore,
} from '../../src/realm/drill.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import { advance } from '../../src/realm/season.ts'
import type { Hero, Realm, ReportLine } from '../../src/realm/types.ts'
import { P } from '../../src/tune/params.ts'

const R = P.realm
const bihwa = (seed = 7): Realm => startRegion('yeongnam', seed, 'bihwa')
const ourHeroes = (r: Realm): Hero[] => Object.values(r.heroes).filter((h) => h.faction === r.player).sort((a, b) => (a.id < b.id ? -1 : 1))
const foeHero = (r: Realm): Hero => Object.values(r.heroes).find((h) => h.faction !== r.player && h.faction !== '')!

/** 공을 쌓아 둔 판 — 끝난 판으로 */
function ended(kind: 'win' | 'lose', merit: Record<string, number>, seed = 7): Realm {
  const r = bihwa(seed)
  r.merit = { ...merit }
  r.outcome = { kind, season: 30 }
  return r
}

describe('단련 — 판 안의 공', () => {
  it('우리 장수만 쌓인다 · 남의 장수 · 배우는 판은 안 쌓인다', () => {
    const r = bihwa()
    const me = ourHeroes(r)[0]!
    const foe = foeHero(r)
    addMerit(r, me.id, 3)
    addMerit(r, foe.id, 3)
    addMerit(r, null, 3)
    assert.equal(meritOf(r, me.id), 3)
    assert.equal(meritOf(r, foe.id), 0)
    const t = startRegion('tutorial', 1, 'baekje')
    const th = ourHeroes(t)[0]!
    addMerit(t, th.id, 5)
    assert.equal(meritOf(t, th.id), 0)
  })

  it('싸움 — 이기면 3 · 지면 2 · 겨루기 이김 3 · 적장을 사로잡으면 우리 쪽에 선 이마다 3', () => {
    const r = bihwa()
    const [a, b] = ourHeroes(r)
    const foe = foeHero(r)
    battleMerit(r, [a!.id, null], [foe.id], 'a', a!.id, [])
    assert.equal(meritOf(r, a!.id), R.drillMeritWin + R.drillMeritDuel)
    battleMerit(r, [foe.id], [b!.id], 'a', undefined, [])
    assert.equal(meritOf(r, b!.id), R.drillMeritFight)
    // 교착 — 둘 다 싸움 공만
    battleMerit(r, [b!.id], [foe.id], null, undefined, [])
    assert.equal(meritOf(r, b!.id), 2 * R.drillMeritFight)
    // 사로잡음 — 우리 옥에 들어온 적장
    foe.status = 'captive'
    foe.captor = r.player
    const was = meritOf(r, a!.id)
    battleMerit(r, [a!.id], [foe.id], 'a', undefined, [foe.id])
    assert.equal(meritOf(r, a!.id) - was, R.drillMeritWin + R.drillMeritCapture)
    assert.equal(meritOf(r, foe.id), 0)
  })

  it('계절 — 맡은 고을 1 · 이끈 군대 1 · 먹힌 공작의 자객 2 · 받아들여진 청의 사신 1', () => {
    const r = bihwa()
    const hs = ourHeroes(r)
    const lead = Object.values(r.armies).find((x) => x.faction === r.player && x.hero !== null)
    const gov = hs.find((h) => h.id !== lead?.hero)!
    gov.post = gov.at ?? r.factions[r.player]!.capital
    const agent = hs.find((h) => h.id !== gov.id && h.id !== lead?.hero) ?? gov
    const lines: ReportLine[] = [
      { kind: 'plot', faction: r.player, op: 'rumor', target: 'x', ok: true, caught: false, agent: agent.id },
      { kind: 'plot', faction: r.player, op: 'rumor', target: 'x', ok: false, caught: false, agent: agent.id },
      { kind: 'envoy', from: r.player, to: 'x', ask: 'trade', accepted: true, hero: gov.id },
      { kind: 'envoy', from: r.player, to: 'x', ask: 'trade', accepted: false, hero: gov.id },
    ]
    const before = { gov: meritOf(r, gov.id), agent: meritOf(r, agent.id) }
    seasonMerit(r, lines)
    const govGain = R.drillMeritPost + R.drillMeritEnvoy + (agent.id === gov.id ? R.drillMeritPlot : 0)
    assert.equal(meritOf(r, gov.id) - before.gov, govGain)
    if (agent.id !== gov.id) assert.equal(meritOf(r, agent.id) - before.agent, R.drillMeritPlot)
    if (lead?.hero != null) assert.equal(meritOf(r, lead.hero), R.drillMeritLead)
  })

  it('판을 돌리면 공이 쌓이고 · 같은 시드는 같은 공 (결정론)', () => {
    const run = (): Record<string, number> => {
      let r = bihwa(11)
      for (let s = 0; s < 12 && r.outcome === null; s++) r = advance(r, [...decide(r, r.player, 'planner'), ...aiOrders(r)]).next
      return r.merit ?? {}
    }
    const a = run()
    assert.ok(Object.values(a).reduce((s, x) => s + x, 0) > 0, '열두 계절이면 공이 든다')
    assert.deepEqual(run(), a)
  })

  it('옛 판 — merit 가 없는 저장도 돌고, 그 계절부터 쌓인다', () => {
    let r = JSON.parse(readFileSync(new URL('./fixtures/realm-80eb366.json', import.meta.url), 'utf8')) as Realm
    assert.equal(r.merit, undefined)
    assert.equal(meritOf(r, 'anything'), 0)
    for (let s = 0; s < 4 && !r.outcome; s++) r = advance(r, [...aiOrders(r), ...decide(r, r.player, 'planner')]).next
    assert.ok(r.merit === undefined || Object.values(r.merit).every((x) => Number.isFinite(x) && x > 0))
    const bare = { ...r }
    delete bare.merit
    assert.deepEqual(gainOf(emptyDrill(), { ...bare, outcome: { kind: 'lose', season: 9 } }), {})
  })
})

describe('단련 — 판 끝에 새기기', () => {
  it('지면 그대로 · 이기면 ×1.5 (반올림) · 쓰러진 장수도 남는다', () => {
    const r0 = ended('lose', {})
    const [a, b] = ourHeroes(r0)
    const lose = ended('lose', { [a!.id]: 10, [b!.id]: 5 })
    lose.heroes[b!.id]!.status = 'dead'
    const s1 = engrave(emptyDrill(), lose, false)
    assert.equal(s1.h[a!.id]!.points, 10)
    assert.equal(s1.h[b!.id]!.points, 5)
    assert.equal(s1.h[a!.id]!.runs, 1)
    assert.equal(s1.h[a!.id]!.name, lose.heroes[a!.id]!.name)
    const win = ended('win', { [a!.id]: 10, [b!.id]: 5 }, 8)
    const s2 = engrave(s1, win, true)
    assert.equal(s2.h[a!.id]!.points, 10 + Math.round(10 * R.drillWinMul))
    assert.equal(s2.h[b!.id]!.points, 5 + Math.round(5 * R.drillWinMul))
    assert.equal(s2.h[a!.id]!.runs, 2)
    assert.equal(earnedOf(win, a!.id), Math.round(10 * R.drillWinMul))
  })

  it('같은 판은 한 번만 — 무한 모드로 이어 둔 몫만 더 · 받은 기록은 안 바뀐다', () => {
    const r = ended('win', {})
    const a = ourHeroes(r)[0]!
    r.merit = { [a.id]: 10 }
    const s0 = emptyDrill()
    const s1 = engrave(s0, r, true)
    assert.deepEqual(s0, emptyDrill())
    assert.equal(engrave(s1, r, true), s1, '두 번째는 그대로')
    assert.deepEqual(gainOf(s1, r, true), {})
    r.merit[a.id] = 14 // 이어서 둔 계절들
    const s2 = engrave(s1, r, true)
    assert.equal(s2.h[a.id]!.points, Math.round(14 * R.drillWinMul))
    assert.equal(s2.h[a.id]!.runs, 1, '같은 판이면 판 수는 그대로')
  })

  it('기억하는 판은 drillKeepRuns 까지', () => {
    let s: DrillStore = emptyDrill()
    for (let i = 0; i < R.drillKeepRuns + 5; i++) {
      const r = ended('lose', {}, 100 + i)
      r.merit = { [ourHeroes(r)[0]!.id]: 1 }
      s = engrave(s, r, false)
    }
    assert.equal(s.order.length, R.drillKeepRuns)
    assert.equal(Object.keys(s.paid).length, R.drillKeepRuns)
  })

  it('배우는 판은 새기지 않는다', () => {
    const t = startRegion('tutorial', 1, 'baekje')
    t.merit = { [ourHeroes(t)[0]!.id]: 20 }
    t.outcome = { kind: 'win', season: 9 }
    assert.deepEqual(gainOf(emptyDrill(), t, true), {})
  })
})

describe('단련 — 단련터', () => {
  const body: Hero = { id: 'h', name: '늪', faction: '', look: 'g', mu: 5, tong: 8, ryak: 9, chi: 3, deok: 4, uiri: 6, traits: [], status: 'free', captor: null, at: null, post: null }
  const store = (points: number, add: Partial<Record<'mu' | 'tong' | 'ryak' | 'chi' | 'deok', number>> = {}): DrillStore => {
    const level = Object.values(add).reduce((a, b) => a + (b ?? 0), 0)
    return { ...emptyDrill(), h: { h: { points, level, add, runs: 1 } } }
  }

  it('값 — 단련 n → n+1 은 n + 2', () => {
    assert.deepEqual([0, 1, 2, 5, 9].map(spendCost), [2, 3, 4, 7, 11])
    // 단련 5 까지 모두: 2+3+4+5+6 = 20 · 단련 7 까지: 20+7+8 = 35
    assert.equal([0, 1, 2, 3, 4].reduce((s, n) => s + spendCost(n), 0), 20)
  })

  it('올리기 — 공을 내고 한 칸 · 단계가 오른다', () => {
    let s = store(5)
    assert.ok(canRaise(s, body, 'mu'))
    s = raise(s, 'h', 'mu', body)
    assert.equal(s.h.h!.points, 3)
    assert.equal(s.h.h!.level, 1)
    assert.equal(s.h.h!.add.mu, 1)
    assert.equal(raiseState(s, 'h', 'mu', body), 'ok') // 3 ≥ 3
    s = raise(s, 'h', 'tong', body)
    assert.equal(s.h.h!.points, 0)
    assert.equal(raiseState(s, 'h', 'chi', body), 'poor')
    assert.equal(raise(s, 'h', 'chi', body), s, '못 올리면 그대로')
    assert.equal(raiseState(s, 'nobody', 'mu', body), 'none')
    assert.equal(raiseState(s, 'h', 'uiri' as 'mu', body), 'none', '의리는 안 자란다')
  })

  it('그릇 — 타고난 값 + 3 · 10 을 못 넘는다', () => {
    assert.equal(capOf(body, 'mu'), 8)
    assert.equal(capOf(body, 'tong'), 10)
    assert.equal(capOf(body, 'ryak'), 10)
    assert.equal(raiseState(store(99, { mu: 3 }), 'h', 'mu', body), 'cap')
    assert.equal(raiseState(store(99, { tong: 2 }), 'h', 'tong', body), 'cap')
    assert.equal(raiseState(store(99, { ryak: 1 }), 'h', 'ryak', body), 'cap')
    assert.equal(raiseState(store(99, { mu: 2 }), 'h', 'mu', body), 'ok')
  })

  it('몸을 안 넘겨도 새길 때 적어 둔 처음 몸으로 잰다', () => {
    const r = ended('lose', {})
    const a = ourHeroes(r)[0]!
    r.merit = { [a.id]: 30 }
    const s = engrave(emptyDrill(), r, false)
    assert.equal(s.h[a.id]!.born!.mu, a.mu)
    assert.equal(raiseState(s, a.id, 'mu'), a.mu >= 10 ? 'cap' : 'ok')
  })

  it('단련 몸 — 더하고 10 에서 멈춘다 · 덜 든 몫은 add 에 안 적는다', () => {
    const d = applyDrill(body, { points: 0, level: 4, add: { mu: 2, ryak: 2 }, runs: 1 })
    assert.equal(d.mu, 7)
    assert.equal(d.ryak, 10)
    assert.deepEqual(d.drill, { lv: 4, add: { mu: 2, ryak: 1 } })
    assert.equal(body.mu, 5, '받은 몸은 안 바뀐다')
    assert.equal(applyDrill(body, undefined), body)
    assert.equal(applyDrill(body, { points: 9, level: 0, add: {}, runs: 1 }), body)
  })
})

describe('단련 — 다음 판', () => {
  it('우리 장수만 단련 몸 · 남의 나라의 같은 사람은 처음 몸 · 배우는 판은 그대로', () => {
    const r = bihwa(3)
    const mine = ourHeroes(r)[0]!
    const foe = foeHero(r)
    const s: DrillStore = { ...emptyDrill(), h: {
      [mine.id]: { points: 0, level: 1, add: { chi: 1 }, runs: 1 },
      [foe.id]: { points: 0, level: 1, add: { mu: 1 }, runs: 1 },
    } }
    const chi = mine.chi
    const fmu = foe.mu
    const got = drillRealm(r, s)
    assert.deepEqual(got, [mine.id])
    assert.equal(r.heroes[mine.id]!.chi, Math.min(10, chi + 1))
    assert.equal(r.heroes[mine.id]!.drill?.lv, 1)
    assert.equal(r.heroes[foe.id]!.mu, fmu)
    assert.deepEqual(drillRealm(r, s), [], '두 번 입히지 않는다')
    const t = startRegion('tutorial', 1, 'baekje')
    const th = ourHeroes(t)[0]!
    assert.deepEqual(drillRealm(t, { ...emptyDrill(), h: { [th.id]: { points: 0, level: 1, add: { mu: 1 }, runs: 1 } } }), [])
  })

  it('단련 몸으로 연 판도 같은 시드면 같은 판 (결정론)', () => {
    const go = (): string => {
      const r = bihwa(5)
      const s: DrillStore = { ...emptyDrill(), h: Object.fromEntries(ourHeroes(r).map((h) => [h.id, { points: 0, level: 2, add: { mu: 1, tong: 1 }, runs: 1 }])) }
      drillRealm(r, s)
      let x = r
      for (let i = 0; i < 6 && x.outcome === null; i++) x = advance(x, [...decide(x, x.player, 'planner'), ...aiOrders(x)]).next
      return JSON.stringify(x)
    }
    assert.equal(go(), go())
  })
})
