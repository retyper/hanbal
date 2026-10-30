/**
 * 배우는 판 (형 2026-10-19: "튜토리얼용 제일작은지도 1:1게임 · 적 여장수 포획도 시도하고 이건 튜토리얼급이니 100% 성공하도록")
 *  - 두 나라 1:1 · 상대 군대는 여인 장수가 이끈다 · 상대는 먼저 치지 않는다
 *  - 우리 쪽 사로잡기는 반드시 된다 (시드가 달라도) · 상대는 우리 장수를 못 잡는다
 *  - 미추홀 도읍을 쥐면 이긴다
 *  - 판 해금 — 배우는 판 → 작은 판 → 영남 → 남부 → 북녘, 하던 판까지는 열려 있다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders } from '../../src/realm/ai.ts'
import { startTutorial } from '../../src/realm/data/regions/tutorial.ts'
import { advance, checkOutcome } from '../../src/realm/season.ts'
import { captureChance, type Side } from '../../src/realm/tactics.ts'
import { unlockedFrom } from '../../src/ui/realm/unlock.ts'
import { TUT_STEPS, tutAt } from '../../src/ui/realm/tutorial.ts'
import type { Order, Tactic } from '../../src/realm/types.ts'

const side = (o: Partial<Side>): Side => ({
  F: 100, mix: { spear: 100 }, morale: 1, hero: { id: 'x', mu: 3, ryak: 3, coward: false }, hungry: false, specials: [], water: false, player: true, seen: true, ...o,
})

describe('배우는 판', () => {
  it('두 나라 1:1 · 상대 군대는 여인 장수 · 상대는 먼저 치지 않는다', () => {
    const r = startTutorial(1)
    assert.equal(r.region, 'tutorial')
    assert.deepEqual(Object.keys(r.factions).sort(), ['baekje', 'michuhol'])
    const foe = Object.values(r.armies).find((a) => a.faction === 'michuhol')!
    assert.equal(r.heroes[foe.hero!]!.look, 'w')
    // 몇 계절 넘겨도 상대는 우리 땅에 오지 않는다
    let x = r
    for (let s = 0; s < 6; s++) {
      const ai = aiOrders(x)
      assert.ok(!ai.some((o) => o.kind === 'march'), `계절 ${s} 상대 출정`)
      x = advance(x, ai).next
    }
    assert.ok(Object.values(x.nodes).filter((n) => n.owner === 'baekje').length >= 3)
  })

  it('사로잡기 — 우리 쪽은 반드시 · 상대는 못 한다', () => {
    const me = side({ capture: 'sure' })
    const foe = side({ capture: 'never', player: false })
    assert.equal(captureChance(me, foe, 1, 1, 1, 0.5, false), 1)
    assert.equal(captureChance(foe, me, 0.2, 0.2, 0.2, 0.9, true), 0)
  })

  it('출정해서 첫 합에 사로잡기를 고르면 시드가 달라도 여인 장수가 잡힌다', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const r = startTutorial(seed)
      const march: Order = { kind: 'march', army: 'a-us', edge: 't01', ambush: false }
      // 첫 계절: 출정 → 다음 계절에 닿아 싸움 (사로잡기는 첫 합부터 고른다)
      let x = advance(r, [march, ...aiOrders(r)]).next
      for (let s = 0; s < 3 && x.heroes['tut-haebi']!.status === 'free'; s++) {
        // 싸움의 열쇠는 엔진이 정한다 — 한 번 시험 돌려 찾고, 그 싸움에 사로잡기를 건다
        const tactics: Order[] = []
        const probe = advance(x, aiOrders(x))
        for (const l of probe.report.lines) if (l.kind === 'battle' && l.key !== undefined) tactics.push({ kind: 'command', key: l.key, cmds: ['capture', 'capture', 'capture'] as Tactic['cmds'] })
        x = advance(x, [...tactics, ...aiOrders(x)]).next
      }
      assert.equal(x.heroes['tut-haebi']!.status, 'captive', `시드 ${seed}`)
      assert.equal(x.heroes['tut-haebi']!.captor, 'baekje')
    }
  })

  it('미추홀 도읍을 쥐면 이긴다', () => {
    const r = startTutorial(3)
    assert.equal(checkOutcome(r), null)
    r.nodes['tut-michuhol-cap']!.owner = 'baekje'
    assert.equal(checkOutcome(r), 'win')
  })

  it('차례 — 처음은 우리 땅 보기, 누르면 다음 · 판이 이기면 끝', () => {
    const r = startTutorial(1)
    const c = { r, orders: [] as Order[], report: null, acts: new Set<string>() }
    assert.equal(tutAt(0, c), 0)
    assert.equal(tutAt(0, { ...c, acts: new Set(['home']) }), 1)
    assert.equal(TUT_STEPS[TUT_STEPS.length - 1]!.id, 'win')
  })
})

describe('판 해금', () => {
  it('처음엔 배우는 판만 · 배우는 판을 끝내면(그만둬도) 작은 판', () => {
    assert.deepEqual([...unlockedFrom([], false, null)], ['tutorial'])
    assert.ok(unlockedFrom([], true, null).has('byeonhan-mini'))
    assert.ok(!unlockedFrom([], true, null).has('yeongnam'))
  })
  it('앞 판을 이기면 다음 판 · 하던 판까지는 열려 있다', () => {
    assert.ok(unlockedFrom(['tutorial', 'byeonhan-mini'], true, null).has('yeongnam'))
    assert.ok(!unlockedFrom(['tutorial', 'byeonhan-mini'], true, null).has('south'))
    const playing = unlockedFrom([], false, 'south')
    assert.ok(playing.has('byeonhan-mini') && playing.has('yeongnam') && playing.has('south') && !playing.has('world'))
  })
})

describe('옛 배우는 판 저장 → 한강 아래 백제·미추홀', () => {
  it('옛 id(골포·가락)의 하던 판이 새 id 로 그대로 이어진다', async () => {
    const { isOldTutorial, remapOldTutorial } = await import('../../src/realm/migrate.ts')
    const fresh = startTutorial(5)
    // 새 판을 옛 꼴로 되돌려 옛 저장을 흉내 낸다
    const back: Record<string, string> = { 'tut-wirye-cap': 'our-cap', 'tut-acha': 'our-north', 'tut-galdae': 'our-east', 'tut-solmoe': 'wild-dolseom', 'tut-gaetgol': 'guya-vil', 'tut-michuhol-cap': 'guya-cap', 'tut-onjo': 'us-ruler', 'tut-ogan': 'chief', 'tut-maryeo': 'us-1', 'tut-biryu': 'guya-ruler', 'tut-haebi': 'guya-3', baekje: 'us', michuhol: 'guya', 'tut-sodo': 'sodo' }
    let j = JSON.stringify(fresh)
    for (const [a, b] of Object.entries(back)) j = j.replaceAll(`"${a}"`, `"${b}"`)
    const old = JSON.parse(j) as typeof fresh
    old.nodes['our-cap']!.owner = 'us'
    assert.ok(isOldTutorial(old))
    const now = remapOldTutorial(old, fresh)
    assert.ok(!isOldTutorial(now))
    assert.deepEqual(Object.keys(now.nodes).sort(), Object.keys(fresh.nodes).sort())
    assert.equal(now.player, 'baekje')
    assert.equal(now.nodes['tut-sodo']!.kind, 'sodo')
    assert.equal(now.nodes['tut-wirye-cap']!.name, '위례 도읍')
    assert.equal(now.heroes['tut-onjo']!.name, '온조')
    assert.ok(Object.values(now.edges).every((e) => now.nodes[e.a] !== undefined && now.nodes[e.b] !== undefined))
  })
})

describe('배우는 판 — 갇히지 않는다', () => {
  // 형 10-24: "튜토리얼 10/12 사로잡은 해비 — 장수 탭 눌러도 다음으로 안 가짐". 사로잡은 장수는 「옥에 가둔 적장」 칸에만 보인다
  it('회유 단계 — 장수 판이 열렸는데 해비가 안 보이면 「옥에 가둔 적장」 칸을 가리킨다', async () => {
    const { tutPick } = await import('../../src/ui/realm/tutorial.ts')
    const step = TUT_STEPS.find((s) => s.id === 'persuade')!
    const c = { r: startTutorial(1), orders: [], report: null, acts: new Set<string>() }
    // 장수 판이 막 열린 화면: 탭 단추와 칸 단추는 보이고, 해비 줄·회유 단추는 아직 안 보인다
    const onScreen = new Set(['[data-act="tab"][data-tab="heroes"]', '[data-act="htab"][data-v="jail"]'])
    assert.equal(tutPick(step, c, (sel) => onScreen.has(sel)), '[data-act="htab"][data-v="jail"]')
    // 칸을 열면 해비 줄
    onScreen.add('[data-act="hero"][data-id="tut-haebi"]')
    assert.equal(tutPick(step, c, (sel) => onScreen.has(sel)), '[data-act="hero"][data-id="tut-haebi"]')
  })

  it('오래 머문 단계엔 「건너뛰기」가 뜬다 (평소엔 없다)', async () => {
    const { tutBandHtml } = await import('../../src/ui/realm/tutorial.ts')
    for (let i = 0; i < TUT_STEPS.length; i++) {
      assert.ok(!tutBandHtml(i, (s) => s).includes('tut-skip'))
      assert.ok(tutBandHtml(i, (s) => s, true).includes('data-act="tut-skip"'))
    }
  })

  // 형 10-30: "9/12 전략회의에서 꼬이고 · 10/12 회유한다 누르면 옥중담판을 무시하고 공작으로". 명령은 누르는 순간 서지만 창을 마쳐야 넘어간다
  it('출정을 고르면 전략 회의 단계 — 회의가 떠 있는 동안은 전투로 넘어가지 않는다', () => {
    const r = startTutorial(1)
    const march: Order = { kind: 'march', army: 'a-us', edge: Object.keys(r.edges)[0]!, ambush: false }
    const c = { r, orders: [march], report: null, acts: new Set<string>() }
    const at = (id: string): number => TUT_STEPS.findIndex((s) => s.id === id)
    assert.equal(tutAt(at('march'), { ...c, ov: 'strat' }), at('council'))
    assert.equal(tutAt(at('council'), { ...c, ov: null }), at('battle'))
  })

  it('「회유한다」를 누르면 옥중 담판 단계 — 담판이 떠 있는 동안은 공작으로 넘어가지 않는다', () => {
    const r = startTutorial(1)
    r.heroes['tut-haebi']!.status = 'captive'
    r.heroes['tut-haebi']!.captor = r.player
    const persuade: Order = { kind: 'persuade', hero: 'tut-haebi', by: 'tut-onjo', talk: [] }
    const c = { r, orders: [persuade], report: null, acts: new Set<string>() }
    const at = (id: string): number => TUT_STEPS.findIndex((s) => s.id === id)
    assert.equal(tutAt(at('persuade'), { ...c, ov: 'talk' }), at('talk'))
    assert.equal(tutAt(at('talk'), { ...c, ov: null }), at('plot'))
  })
})
