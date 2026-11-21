/**
 * 각성 v2 의 본편 스위치 — P.realm.ascendTrialOpen (docs/realm/study-20261118/30-PROPOSAL.md 1절 ⑧ · 7-1 가4 · trial-rules.ts)
 *  1 (기본 · 지금 규칙): 불꽃이 다 켜지면 시련이 열리고 시련을 넘어야 힘이 붙는다 — ascend.test.ts · awakening-trial.test.ts 가 본다
 *  0 (형의 판이 끝난 뒤 켠다): 본편 장수는 시련 없이, 불꽃이 다 켜지는 싸움 끝에 곧바로 힘(능력치 · 각성기)이 붙는다
 * 여기서 보는 것:
 *  - 기본값은 1 이다 (스위치를 켜는 날 이 줄을 같이 고친다)
 *  - 0: 다 켜지는 싸움에 곧바로 +ascendBonus · 시련 문이 안 열린다 · 불꽃 셈은 그대로 · 배우는 판은 그대로
 *  - 옛 저장: 시련이 열린 채 멈춘 장수 · 시련을 넘은 장수 · 각성 전의 아주 옛 판 — 불러도 깨지지 않고 보상은 한 번
 *  - 결정론 (A1): 같은 씨앗 같은 명령이면 같은 결과 · 1 과 0 은 첫 불꽃이 다 켜지는 달까지 같은 판
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { aiOrders, decide } from '../../src/realm/ai.ts'
import { completeTrial, trialBlock } from '../../src/realm/awakening-trial.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import { startTutorial } from '../../src/realm/data/regions/tutorial.ts'
import { WAKE_ON, elemOf } from '../../src/realm/elem.ts'
import { ascendNeed, battleGrowth, wakeOf } from '../../src/realm/heroes.ts'
import { migrate } from '../../src/realm/migrate.ts'
import { advance } from '../../src/realm/season.ts'
import { ascendTrialOpen, hasAwakeningTrial } from '../../src/realm/trial-rules.ts'
import { P, getParam, setParam } from '../../src/tune/params.ts'
import type { Hero, Order, Realm, ReportLine } from '../../src/realm/types.ts'

const KEY = 'realm.ascendTrialOpen'
const STATS = ['mu', 'tong', 'ryak', 'chi', 'deok'] as const

/** 스위치를 v 로 두고 f 를 돌린 뒤 되돌린다 */
function withSwitch<T>(v: 0 | 1, f: () => T): T {
  const was = getParam(KEY)!
  setParam(KEY, v)
  try { return f() } finally { setParam(KEY, was) }
}

/** 지금 규칙(1)에서 시련이 있는 우리 장수 — 0 에서는 이 장수가 예전 길을 탄다 */
function setup(): { r: Realm; h: Hero } {
  const r = byeonhanMini(1)
  const h = withSwitch(1, () => Object.values(r.heroes).filter((x) => x.faction === r.player && x.status === 'free' && hasAwakeningTrial(x)).sort((a, b) => (a.id < b.id ? -1 : 1))[0])
  assert.ok(h, '각성 그림이 있는 우리 장수')
  return { r, h: h! }
}
const win = (r: Realm, id: string, lines: ReportLine[] = [], fair = true): void => battleGrowth(r, [id], [], [], lines, fair)
const lose = (r: Realm, id: string, lines: ReportLine[] = []): void => battleGrowth(r, [], [id], [], lines)
/** 저장했다 다시 연 것처럼 */
const reload = (r: Realm): Realm => { const x = JSON.parse(JSON.stringify(r)) as Realm; migrate(x); return x }

function nanPath(x: unknown, p = ''): string | null {
  if (typeof x === 'number') return Number.isFinite(x) ? null : p
  if (x !== null && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) {
      const q = nanPath(v, `${p}.${k}`)
      if (q !== null) return q
    }
  }
  return null
}

describe('각성 스위치 ascendTrialOpen · 기본값', () => {
  it('기본값은 1 (지금 규칙) — 형의 판이 끝나기 전에는 0 으로 두지 않는다', () => {
    assert.equal(P.realm.ascendTrialOpen, 1)
    assert.equal(ascendTrialOpen(), true)
    const { h } = setup()
    assert.equal(hasAwakeningTrial(h), true)
  })

  it('1 이면 지금 규칙 그대로 — 불꽃이 다 켜져도 시련이 열리기만 한다', () => {
    withSwitch(1, () => {
      const { r, h } = setup()
      const before = STATS.map((s) => h[s])
      const lines: ReportLine[] = []
      for (let i = 0; i < ascendNeed(h); i++) win(r, h.id, lines)
      assert.equal(h.trialReady, true)
      assert.equal(h.ascended, undefined)
      assert.ok(!lines.some((l) => l.kind === 'ascend'))
      assert.deepEqual(STATS.map((s) => h[s]).slice(2), before.slice(2), '지략·내정·덕망은 그대로 (무예·통솔은 싸움의 공으로 따로 자랄 수 있다)')
      assert.equal(trialBlock(r, h.id), null)
    })
  })
})

describe('각성 스위치 ascendTrialOpen 0 · 시련 없이 불꽃만으로', () => {
  it('불꽃이 다 켜지는 싸움 끝에 곧바로 붙는다 — 능력치가 모두 ascendBonus 오르고 각성기를 쥔다', () => {
    withSwitch(0, () => {
      const { r, h } = setup()
      assert.equal(ascendTrialOpen(), false)
      assert.equal(hasAwakeningTrial(h), false)
      const before = { mu: h.mu, tong: h.tong, ryak: h.ryak, chi: h.chi, deok: h.deok }
      const lines: ReportLine[] = []
      const need = ascendNeed(h)
      for (let i = 0; i < need - 1; i++) win(r, h.id, lines)
      assert.equal(h.ascended, undefined, '한 칸 모자라면 아직이다')
      assert.equal(h.flames, need - 1)
      assert.deepEqual([h.ryak, h.chi, h.deok], [before.ryak, before.chi, before.deok])
      win(r, h.id, lines)
      assert.equal(h.ascended, true)
      assert.equal(h.ascents, 1)
      assert.equal(h.flames, Math.round(P.realm.ascendWins), '불꽃은 다 켠 채 연료가 된다')
      // 싸움의 공으로 무예·통솔이 따로 자랄 수 있다 — 지략·내정·덕망은 딱 각성 몫만큼
      for (const s of ['ryak', 'chi', 'deok'] as const) assert.equal(h[s], before[s] + P.realm.ascendBonus, s)
      for (const s of ['mu', 'tong'] as const) assert.ok(h[s] >= before[s] + P.realm.ascendBonus, s)
      assert.equal(lines.filter((l) => l.kind === 'ascend' && l.hero === h.id).length, 1)
      assert.equal(wakeOf(r, h), WAKE_ON.has(elemOf(h)) ? elemOf(h) : null, '켠 기운이면 각성기를 쥔다')
    })
  })

  it('시련 문이 안 열린다 — trialReady 가 안 켜지고, 시련 보상도 받을 수 없다', () => {
    withSwitch(0, () => {
      const { r, h } = setup()
      const lines: ReportLine[] = []
      assert.ok(trialBlock(r, h.id), '불꽃 전에도 막힌다')
      for (let i = 0; i < ascendNeed(h) - 1; i++) win(r, h.id, lines)
      assert.equal(h.trialReady, undefined)
      assert.ok(trialBlock(r, h.id))
      assert.equal(completeTrial(r, h.id), null)
      win(r, h.id, lines)
      assert.equal(h.trialReady, undefined)
      assert.equal(h.trialCleared, undefined)
      assert.ok(trialBlock(r, h.id), '붙은 뒤에도 시련은 없다')
      const stats = STATS.map((s) => h[s])
      assert.equal(completeTrial(r, h.id), null)
      assert.deepEqual(STATS.map((s) => h[s]), stats)
    })
  })

  it('불꽃 셈은 그대로 — 이기면 한 칸, 지거나 비기면 한 칸, 제 몫이 아닌 싸움은 안 센다', () => {
    withSwitch(0, () => {
      const { r, h } = setup()
      win(r, h.id, [], false)
      assert.equal(h.flames, undefined, '제 몫이 아닌 싸움')
      win(r, h.id)
      assert.equal(h.flames, 1)
      lose(r, h.id)
      assert.equal(h.flames, undefined)
      win(r, h.id)
      battleGrowth(r, [], [], [h.id], [])
      assert.equal(h.flames, undefined, '비겨도 한 칸 꺼진다')
      assert.equal(h.ascended, undefined)
    })
  })

  it('붙은 뒤는 지금 규칙과 같다 — 져도 안 풀리고 불꽃은 연료 · 다시 이겨도 두 번 받지 않는다', () => {
    withSwitch(0, () => {
      const { r, h } = setup()
      const lines: ReportLine[] = []
      for (let i = 0; i < ascendNeed(h); i++) win(r, h.id, lines)
      const chi = h.chi
      for (let i = 0; i < 5; i++) lose(r, h.id, lines)
      assert.equal(h.ascended, true)
      assert.equal(h.flames, 0)
      assert.equal(h.chi, chi)
      for (let i = 0; i < 5; i++) win(r, h.id, lines)
      assert.equal(h.flames, Math.round(P.realm.ascendWins))
      assert.equal(h.chi, chi)
      assert.equal(h.ascents, 1)
      assert.equal(lines.filter((l) => l.kind === 'ascend').length, 1)
    })
  })

  it('남의 장수는 0 에서도 안 붙는다', () => {
    withSwitch(0, () => {
      const { r } = setup()
      const foe = Object.values(r.heroes).find((x) => x.faction !== r.player && x.status === 'free')!
      for (let i = 0; i < Math.round(P.realm.ascendWins) + 1; i++) win(r, foe.id)
      assert.notEqual(foe.ascended, true)
      assert.equal(foe.flames, undefined)
    })
  })

  it('배우는 판은 그대로 — 해비는 시련을 보여 주고, 말갈기는 불꽃이 차면 곧바로', () => {
    for (const v of [1, 0] as const) withSwitch(v, () => {
      const r = startTutorial(777)
      assert.equal(hasAwakeningTrial({ id: 'tut-haebi' }), true, `스위치 ${v}`)
      for (const h of Object.values(r.heroes)) if (h.id !== 'tut-haebi' && h.id.startsWith('tut-')) assert.equal(hasAwakeningTrial(h), false, h.id)
      const haebi = r.heroes['tut-haebi']!
      haebi.faction = r.player; haebi.status = 'free'; haebi.at = 'tut-wirye-cap'
      for (const a of Object.values(r.armies)) if (a.hero === haebi.id) a.hero = null
      for (let i = 0; i < ascendNeed(haebi); i++) win(r, haebi.id)
      assert.equal(haebi.trialReady, true, `스위치 ${v}`)
      assert.equal(haebi.ascended, undefined, `스위치 ${v}`)
      const done = completeTrial(r, haebi.id)
      assert.equal(done?.next.heroes[haebi.id]!.ascended, true, `스위치 ${v}`)
    })
    // 판 전체도 같다 — 같은 씨앗 같은 명령으로 달을 넘기면 두 값의 판이 글자까지 같다
    const play = (v: 0 | 1): string => withSwitch(v, () => {
      let r = startRegion('tutorial', 777, 'baekje')
      for (let t = 0; t < 12 && !r.outcome; t++) r = advance(r, [...aiOrders(r), ...decide(r, r.player, 'cautious')]).next
      return JSON.stringify(r)
    })
    assert.equal(play(0), play(1))
  })
})

describe('각성 스위치 ascendTrialOpen 0 · 옛 저장', () => {
  /** 지금 규칙(1)으로 시련이 열린 채 저장한 판 */
  const openTrialSave = (): { r: Realm; id: string } => withSwitch(1, () => {
    const { r, h } = setup()
    for (let i = 0; i < ascendNeed(h); i++) win(r, h.id)
    assert.equal(h.trialReady, true)
    return { r: reload(r), id: h.id }
  })

  it('시련이 열린 채 멈춘 장수 — 다음에 이기는 제 몫의 싸움 끝에 붙는다 (보상은 한 번)', () => {
    const { r, id } = openTrialSave()
    withSwitch(0, () => {
      const h = r.heroes[id]!
      const before = { ryak: h.ryak, chi: h.chi, deok: h.deok }
      assert.equal(h.ascended, undefined, '불러오기만 해서는 안 바뀐다 (저장을 고치는 줄이 없다)')
      const lines: ReportLine[] = []
      win(r, id, lines, false)
      assert.equal(h.ascended, undefined, '제 몫이 아닌 싸움으로는 안 붙는다')
      win(r, id, lines)
      assert.equal(h.ascended, true)
      for (const s of ['ryak', 'chi', 'deok'] as const) assert.equal(h[s], before[s] + P.realm.ascendBonus, s)
      assert.equal(lines.filter((l) => l.kind === 'ascend').length, 1)
      win(r, id, lines); win(r, id, lines)
      assert.equal(lines.filter((l) => l.kind === 'ascend').length, 1)
      for (const s of ['ryak', 'chi', 'deok'] as const) assert.equal(h[s], before[s] + P.realm.ascendBonus, s)
      assert.equal(nanPath(r), null)
    })
  })

  it('시련이 열린 채 멈춘 장수 — 그 사이에 지면 한 칸 꺼지고, 다시 채우면 붙는다', () => {
    const { r, id } = openTrialSave()
    withSwitch(0, () => {
      const h = r.heroes[id]!
      const need = ascendNeed(h)
      lose(r, id)
      assert.equal(h.flames, need - 1)
      assert.equal(h.ascended, undefined)
      win(r, id)
      assert.equal(h.ascended, true)
    })
  })

  it('시련을 넘어 각성한 장수 — 0 에서도 그대로이고 두 번 받지 않는다', () => {
    const saved = withSwitch(1, () => {
      const { r, h } = setup()
      for (let i = 0; i < ascendNeed(h); i++) win(r, h.id)
      const done = completeTrial(r, h.id)!
      return { r: reload(done.next), id: h.id }
    })
    withSwitch(0, () => {
      const h = saved.r.heroes[saved.id]!
      assert.equal(h.ascended, true); assert.equal(h.trialCleared, true)
      const stats = [h.ryak, h.chi, h.deok]
      const lines: ReportLine[] = []
      for (let i = 0; i < 4; i++) win(saved.r, saved.id, lines)
      lose(saved.r, saved.id, lines)
      assert.deepEqual([h.ryak, h.chi, h.deok], stats)
      assert.equal(h.ascents, 1)
      assert.ok(!lines.some((l) => l.kind === 'ascend'))
      assert.equal(h.flames, Math.round(P.realm.ascendWins) - 1)
    })
  })

  it('0 으로 붙은 판을 1 로 되돌려 불러도 두 번 받지 않는다 (되돌림 손잡이)', () => {
    const saved = withSwitch(0, () => {
      const { r, h } = setup()
      for (let i = 0; i < ascendNeed(h); i++) win(r, h.id)
      assert.equal(h.ascended, true)
      return { r: reload(r), id: h.id }
    })
    withSwitch(1, () => {
      const h = saved.r.heroes[saved.id]!
      const stats = STATS.map((s) => h[s])
      // 지금 규칙의 「옛 각성 저장」과 같은 꼴 — 시련을 치러도 능력치는 다시 오르지 않는다 (awakening-trial.test.ts)
      const done = completeTrial(saved.r, saved.id)
      if (done !== null) {
        assert.deepEqual(STATS.map((s) => done.next.heroes[saved.id]![s]), stats)
        assert.equal(done.lines.length, 0)
      }
      for (let i = 0; i < 3; i++) win(saved.r, saved.id)
      assert.deepEqual([h.ryak, h.chi, h.deok], stats.slice(2))
      assert.equal(h.ascents, 1)
    })
  })

  it('각성이 생기기 전의 옛 판(80eb366)을 0 으로 12계절 넘긴다 — 멈추지 않고 NaN 이 없고 시련 문이 안 열린다', () => {
    withSwitch(0, () => {
      let r = JSON.parse(readFileSync(new URL('./fixtures/realm-80eb366.json', import.meta.url), 'utf8')) as Realm
      migrate(r)
      for (let s = 0; s < 12 && !r.outcome; s++) {
        const res = advance(r, [...aiOrders(r), ...decide(r, r.player, 'planner')])
        assert.equal(nanPath(res.next), null, `계절 ${s}`)
        r = JSON.parse(JSON.stringify(res.next)) as Realm
        for (const h of Object.values(r.heroes)) {
          assert.notEqual(h.trialReady, true, h.id)
          if (h.ascended === true) assert.ok((h.flames ?? 0) >= 0 && (h.flames ?? 0) <= Math.round(P.realm.ascendWins), h.id)
        }
      }
    })
  })
})

describe('각성 스위치 ascendTrialOpen · 결정론 (A1)', () => {
  const TURNS = 40
  const orders = (r: Realm): Order[] => [...aiOrders(r), ...decide(r, r.player, 'cautious')]
  /** 큰 판을 통째로 견준다 — 어긋나면 긴 글 대신 짧은 말만 낸다 */
  const same = (a: unknown, b: unknown, what: string): void => assert.ok(JSON.stringify(a) === JSON.stringify(b), what)

  /**
   * 같은 씨앗에 같은 명령을 넣으면 같은 판 · 같은 보고가 나오나 — 1장 마한을 TURNS 달.
   * 첫 판은 봇이 고른 명령을 달마다 적어 두고, 둘째 판은 적어 둔 명령을 넣는다. 둘째 판은 달마다 저장했다 불러온다(JSON).
   * 둘째 판에서도 봇을 불러 「같은 판이면 같은 명령」을 먼저 본다 — 봇의 미리보기(season.planned)가 사건 카드가 뜬 달에 판의 호감을 고치는
   * 옛 흠이 있어(스위치와 상관없다 · 두 값 모두 · 11-18 보고) 봇을 안 부르면 그 달부터 판이 갈린다.
   */
  function replay(seed: number): { end: Realm; lines: ReportLine[] } {
    const log: string[] = []
    const linesA: ReportLine[] = []
    let a = startRegion('mahan', seed, 'baekje')
    for (let t = 0; t < TURNS && !a.outcome; t++) {
      const o = orders(a)
      log.push(JSON.stringify(o))
      const res = advance(a, o)
      linesA.push(...res.report.lines)
      a = res.next
    }
    const linesB: ReportLine[] = []
    let b = startRegion('mahan', seed, 'baekje')
    for (let t = 0; t < log.length; t++) {
      assert.ok(JSON.stringify(orders(b)) === log[t], `씨앗 ${seed} · ${t}번째 달: 같은 판이면 같은 명령`)
      const res = advance(b, JSON.parse(log[t]!) as Order[])
      linesB.push(...res.report.lines)
      b = JSON.parse(JSON.stringify(res.next)) as Realm
    }
    same(b, a, `씨앗 ${seed}: 판이 같다`)
    same(linesB, linesA, `씨앗 ${seed}: 보고가 같다`)
    return { end: a, lines: linesA }
  }

  it('0 에서 같은 씨앗 같은 명령이면 같은 결과 — 1장 마한 · 저장했다 불러도 같다', () => {
    withSwitch(0, () => {
      for (const seed of [2, 7]) {
        const { end, lines } = replay(seed)
        assert.ok(lines.some((l) => l.kind === 'ascend' && end.heroes[l.hero]?.faction === end.player), `씨앗 ${seed}: 이 판에서 불꽃만으로 붙은 우리 장수가 있어야 시험이 뜻이 있다`)
        assert.ok(!Object.values(end.heroes).some((h) => h.trialReady === true), '시련 문은 한 번도 안 열린다')
      }
    })
  })

  it('1 에서도 같은 씨앗 같은 명령이면 같은 결과 (지금 규칙)', () => {
    withSwitch(1, () => {
      const { end } = replay(2)
      assert.ok(Object.values(end.heroes).some((h) => h.trialReady === true && h.ascended !== true), '이 판에서 시련이 열린 장수가 있어야 시험이 뜻이 있다 (봇은 시련을 치르지 않는다)')
    })
  })

  it('1 과 0 은 첫 불꽃이 다 켜지는 달까지 같은 판이다 — 그 달에 1 은 시련이 열리고 0 은 곧바로 붙는다', () => {
    for (const seed of [2, 7]) {
      let r1 = startRegion('mahan', seed, 'baekje')
      let r0 = startRegion('mahan', seed, 'baekje')
      let split = -1
      for (let t = 0; t < TURNS && split < 0; t++) {
        same(r0, r1, `씨앗 ${seed} · ${t}번째 달 앞: 아직 같은 판`)
        const res1 = withSwitch(1, () => advance(r1, orders(r1)))
        const res0 = withSwitch(0, () => advance(r0, orders(r0)))
        const opened = res1.report.lines.find((l) => l.kind === 'kindle' && res1.next.heroes[l.hero]?.trialReady === true)
        // 0 에서만 나온 ascend 줄 — 시련이 없는 장수(각성 그림 없는 장수)는 두 값에서 똑같이 곧바로 붙으므로 뺀다
        const woke = res0.report.lines.find((l) => l.kind === 'ascend' && !res1.report.lines.some((m) => m.kind === 'ascend' && m.hero === l.hero))
        if (opened !== undefined || woke !== undefined) {
          assert.ok(opened !== undefined && woke !== undefined, `씨앗 ${seed} · ${t}번째 달: 둘은 같은 달에 갈린다`)
          const id = (opened as { hero: string }).hero
          assert.equal((woke as { hero: string }).hero, id, '같은 장수')
          assert.equal(res1.next.heroes[id]!.ascended, undefined)
          assert.equal(res0.next.heroes[id]!.ascended, true)
          assert.equal(res0.next.heroes[id]!.trialReady, undefined)
          split = t
        }
        r1 = res1.next; r0 = res0.next
      }
      assert.ok(split >= 0, `씨앗 ${seed}: ${TURNS}달 안에 불꽃이 다 켜진 장수가 있어야 한다`)
    }
  })
})

// Explicit rollback coverage; 56-A product default stays off in awakening-persistence.test.ts.
setParam('realm.legacyAwakeningOpen', 1)
