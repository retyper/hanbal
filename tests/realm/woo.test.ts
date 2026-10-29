/**
 * 옥중 담판 (docs/realm/WOO.md · 형 10-29: "회유 … 미니게임화 (스카이림 화술 느낌)")
 *
 *  - 같은 시드 · 같은 말 → 같은 결과 · 화면의 미리 보기 = 계절을 넘긴 판
 *  - 마디의 굴림은 고른 거리와 무관하다 · 한 번 연 담판은 그 계절에 다시 못 연다 (무르기 막힘)
 *  - 보이는 가망의 폭은 늘 참값을 품고, 참값대로 먹힌다 (범위 보정)
 *  - 원한은 넘어올 확률을 깎고 · 담판으로 넘어오면 정이 더 높다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { recruitChance, resistOf } from '../../src/realm/heroes.ts'
import { advance, planned } from '../../src/realm/season.ts'
import type { Realm, WooApproach } from '../../src/realm/types.ts'
import { chanceOf, fitOf, shownRange, talkRun, talkWhy, WOO_APPROACHES } from '../../src/realm/woo.ts'
import { P } from '../../src/tune/params.ts'

/** 구야의 둘째 장수를 우리 옥에 — 곡식 넉넉히 */
function jail(seed = 1): Realm {
  const r = structuredClone(byeonhanMini(seed))
  const g = r.heroes['guya-2']!
  g.status = 'captive'
  g.captor = 'us'
  g.at = null
  for (const a of Object.values(r.armies)) if (a.hero === 'guya-2') a.hero = null
  r.stock['us']!.grain = 1000
  return r
}
const TALK: readonly WooApproach[] = ['soothe', 'cause', 'gain']

describe('옥중 담판', () => {
  it('같은 시드 같은 말이면 같은 결과 · 미리 보기가 계절을 넘긴 판과 같다', () => {
    const r = jail(3)
    const pre = talkRun(r, 'guya-2', 'us-ruler', TALK)
    const a = advance(r, [{ kind: 'persuade', hero: 'guya-2', by: 'us-ruler', talk: TALK }])
    const b = advance(r, [{ kind: 'persuade', hero: 'guya-2', by: 'us-ruler', talk: TALK }])
    assert.deepEqual(a.next.heroes['guya-2'], b.next.heroes['guya-2'])
    const pz = a.next.heroes['guya-2']!.persuade
    if (pz !== undefined) assert.ok(Math.abs(pz.resist! - pre.resist) < 1e-9, `미리 ${pre.resist} · 판 ${pz.resist}`)
    else assert.ok(pre.hand?.ok === true, '넘어왔으면 미리 보기도 손을 내민 것이 먹혔다')
    assert.ok(a.report.lines.some((l) => l.kind === 'persuade' && l.step === 'talk'))
    assert.equal(planned(r, [{ kind: 'persuade', hero: 'guya-2', by: 'us-ruler', talk: TALK }]).heroes['guya-2']!.persuade!.resist, pre.resist)
  })

  it('마디의 굴림은 고른 거리와 무관하다', () => {
    const r = jail(5)
    const us = WOO_APPROACHES.map((a) => talkRun(r, 'guya-2', 'us-ruler', [a]).beats[0]!.u)
    assert.equal(new Set(us).size, 1)
  })

  it('한 번 연 담판은 그 계절에 다시 열리지 않고, 맡기는 사이는 마주 앉기 틈을 기다린다', () => {
    const r = jail(2)
    assert.equal(talkWhy(r, 'guya-2'), 'first')
    const p = planned(r, [{ kind: 'persuade', hero: 'guya-2', by: 'us-ruler', talk: ['soothe'] }])
    assert.equal(talkWhy(p, 'guya-2'), null, '같은 계절엔 다시 못 연다')
    let n = advance(r, [{ kind: 'persuade', hero: 'guya-2', by: 'us-ruler', talk: ['soothe'] }]).next
    if (n.heroes['guya-2']!.faction === 'us') return
    const free: Array<string | null> = []
    for (let i = 0; i < P.realm.wooTalkGap + 1 && n.heroes['guya-2']!.persuade !== undefined; i++) {
      const pz = n.heroes['guya-2']!.persuade!
      if (pz.resist !== undefined && pz.resist > 0) free.push(talkWhy(n, 'guya-2'))
      n.stock['us']!.grain = 1000
      n = advance(n, []).next
    }
    if (free.length > 0) assert.equal(free[0], null, '다음 계절엔 저절로 안 뜬다')
  })

  it('보이는 폭은 늘 참값을 품는다 · 참값대로 먹힌다', () => {
    const r = jail(1)
    for (let ryak = 1; ryak <= 10; ryak++) {
      r.heroes['us-ruler']!.ryak = ryak
      for (let p = 0.05; p <= 0.951; p += 0.01) {
        const s = shownRange(r, 'us-ruler', p)
        const pc = Math.round(p * 100)
        assert.ok(s.lo <= pc && pc <= s.hi, `지략 ${ryak} · ${pc}% → ${s.lo}~${s.hi}`)
        if (ryak >= 9) assert.equal(s.lo, s.hi)
      }
    }
    // 첫 마디의 먹힘을 판 400개로 센다 — 참값 ± 7%p 안
    for (const a of WOO_APPROACHES) {
      let hit = 0
      let want = 0
      for (let seed = 1; seed <= 400; seed++) {
        const x: Realm = { ...jail(1), seed }
        const t = talkRun(x, 'guya-2', 'us-ruler', [a])
        want += chanceOf(x, 'guya-2', 'us-ruler', a)
        if (t.beats[0]!.react === 'big' || t.beats[0]!.react === 'sway') hit++
      }
      assert.ok(Math.abs(hit / 400 - want / 400) < 0.07, `${a}: 먹힘 ${hit / 400} · 가망 ${want / 400}`)
    }
  })

  it('가시를 짚으면 노여움이 나 원한이 쌓이고 · 원한은 넘어올 확률을 깎는다', () => {
    const r = jail(1)
    const g = r.heroes['guya-2']!
    ;(g as { mu: number }).mu = 9 // 거친 노장 — 겁주기가 가시
    ;(g as { traits: readonly string[] }).traits = []
    assert.equal(fitOf(r, 'guya-2', 'us-ruler', 'fear').fit, -2)
    let raged = false
    for (let seed = 1; seed <= 60 && !raged; seed++) {
      const t = talkRun({ ...r, seed }, 'guya-2', 'us-ruler', ['fear', 'fear', 'fear'])
      if (t.end === 'rage') { raged = true; assert.equal(t.grudge, 1); assert.ok(t.resist > 0) }
    }
    assert.ok(raged, '가시를 세 번 짚으면 노여움이 한 번은 난다')
    const before = recruitChance(r, 'guya-2', 'us-ruler')
    g.grudge = 1
    assert.ok(Math.abs(before - recruitChance(r, 'guya-2', 'us-ruler') - P.realm.wooGrudgeRecruit) < 1e-9 || recruitChance(r, 'guya-2', 'us-ruler') === P.realm.recruitMin)
  })

  it('담판의 손을 내민다로 넘어온 장수는 정이 더 높게 시작한다', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r: Realm = { ...jail(1), seed }
      r.heroes['guya-2']!.persuade = { by: 'us-ruler', left: 1, resist: 0, tries: 0, since: r.season - 2 }
      assert.equal(talkWhy(r, 'guya-2'), 'last')
      const t = talkRun(r, 'guya-2', 'us-ruler', TALK)
      if (t.hand?.ok !== true) continue
      const n = advance(r, [{ kind: 'persuade', hero: 'guya-2', by: 'us-ruler', talk: TALK }]).next
      const h = n.heroes['guya-2']!
      assert.equal(h.faction, 'us')
      assert.ok((h.bond ?? 0) >= P.realm.bondPersuaded + P.realm.wooBondTalk, `정 ${h.bond}`) // 섬긴 계절만큼 더 오를 수 있다
      assert.equal(h.born, 'guya')
      return
    }
    assert.fail('손을 내민 것이 한 번도 안 먹혔다')
  })

  it('맡기면 지금과 같다 — 담판 없는 회유의 벽은 처음 벽에서 깎인다', () => {
    const r = jail(4)
    const n = advance(r, [{ kind: 'persuade', hero: 'guya-2', by: 'us-ruler' }]).next
    const pz = n.heroes['guya-2']!.persuade
    if (pz !== undefined) assert.ok(pz.resist! < resistOf(r, 'guya-2'))
  })
})
