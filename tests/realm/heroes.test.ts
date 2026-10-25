/**
 * 장수 첫판 (docs/realm/HEROES.md — 형: "육각형 능력치 · 팰월드처럼 특성 · 군주는 장군이랑 별개", 2026-10-18)
 *
 *  - 나라마다 군주가 따로 있다 — 도읍에 혼자 머물고 군대를 이끌지 않는다 · 능력치 여섯은 1~10 · 특성은 목록에 있는 것
 *  - 지휘는 무예·통솔 반반 · 궁술·명궁은 궁수를 세게
 *  - 맡기기: 그 고을에 있는 장수만 · 맡으면 수확(농사꾼)·경계(신중) · 군주는 못 맡는다 · 이끌기 · 해산하면 그 고을에 남는다
 *  - 고을을 잃으면 혼자 있던 장수는 물러나거나 잡힌다
 *  - 회유: 계절마다 곡식, 다 되면 우리 장수 · 떠돌이: 고을 주인만 들인다
 *  - 본 장수: 우리 장수와 포로는 보이고, 남의 장수는 정찰하면 보인다 · 같은 판이면 같은 결과
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { fightHead } from '../../src/realm/battle.ts'
import { TRAIT } from '../../src/realm/data/traits.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import {
  addBond, alertFloor, armyOfHero, harvestMul, heroSeen, persuadeSeasons, postHero, rulerOf, sweepHeroes, wanderersFor,
} from '../../src/realm/heroes.ts'
import { advance, forceOf, planned } from '../../src/realm/season.ts'
import { migrate } from '../../src/realm/migrate.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, Realm, ReportLine } from '../../src/realm/types.ts'

const pass = (r: Realm, orders: Order[] = []): { next: Realm; lines: readonly ReportLine[] } => {
  const { next, report } = advance(r, orders)
  return { next, lines: report.lines }
}

describe('장수 — 판의 처음', () => {
  it('나라마다 군주가 따로 — 도읍에 혼자 머문다 · 능력치 여섯 1~10 · 특성은 목록에 있다', () => {
    const r = byeonhanMini(1)
    for (const f of Object.values(r.factions)) {
      const ruler = rulerOf(r, f.id)
      assert.ok(ruler !== null, f.id)
      assert.equal(ruler.at, f.capital)
      assert.equal(armyOfHero(r, ruler.id), null)
    }
    for (const h of Object.values(r.heroes)) {
      for (const v of [h.mu, h.tong, h.ryak, h.chi, h.deok, h.uiri]) assert.ok(v >= 1 && v <= 10, h.id)
      for (const t of h.traits) assert.ok(TRAIT[t] !== undefined, `${h.id}: ${t}`)
    }
    // 여섯 군주 가운데 여인이 둘 이상
    assert.ok(Object.values(r.factions).filter((f) => rulerOf(r, f.id)?.look === 'w').length >= 2)
  })

  it('지휘는 무예·통솔 반반 · 명궁이 이끄는 군대의 궁수는 더 세다', () => {
    const r = byeonhanMini(1)
    const a = r.armies['a-us']!
    const chief = r.heroes['chief']!
    const f = forceOf(r, a)
    assert.equal(f.mu, (chief.mu + chief.tong) / 2)
    const bare = forceOf(r, { ...a, hero: null })
    assert.ok(fightHead(f) > fightHead(bare))
  })
})

describe('맡기기 · 이끌기', () => {
  it('고을에 혼자 있는 장수를 그 고을에 맡긴다 — 농사꾼이면 수확이 는다 · 우리 땅으로 이어진 다른 고을은 호위를 거느리고 가서 맡는다 · 군주는 안 된다', () => {
    const r = byeonhanMini(1)
    const here = structuredClone(r)
    here.heroes['us-1']!.at = 'our-north'
    const before = harvestMul(here, 'our-north')
    const p = planned(here, [{ kind: 'assign', hero: 'us-1', node: 'our-north' }])
    assert.equal(p.heroes['us-1']!.post, 'our-north')
    assert.ok(harvestMul(p, 'our-north') > before)
    const far = planned(r, [{ kind: 'assign', hero: 'us-1', node: 'our-north' }]).heroes['us-1']!
    assert.equal(far.post, 'our-north')
    assert.equal(far.at, 'our-north')
    assert.equal(far.awayUntil, r.season) // 그 계절은 길에 있다
    const foe = Object.values(r.nodes).find((n) => n.owner !== null && n.owner !== 'us' && n.kind !== 'sodo')!
    assert.equal(planned(r, [{ kind: 'assign', hero: 'us-1', node: foe.id }]).heroes['us-1']!.post, null)
    assert.equal(planned(r, [{ kind: 'assign', hero: 'us-ruler', node: 'our-cap' }]).heroes['us-ruler']!.post, null)
  })

  it('도읍은 늘 군주가 다스린다 — 다른 장수는 앉지 못하고, 예전 판에 앉아 있던 장수도 자리를 내놓는다 (형 10-26)', () => {
    const r = byeonhanMini(1)
    const p = planned(r, [{ kind: 'assign', hero: 'us-1', node: 'our-cap' }])
    assert.equal(p.heroes['us-1']!.post, null)
    assert.equal(postHero(p, 'our-cap')?.id, rulerOf(p, 'us')?.id)
    // 예전 판 — 도읍에 장수가 앉아 있었다
    const old = structuredClone(r)
    old.heroes['us-1']!.post = 'our-cap'
    old.heroes['us-1']!.at = 'our-cap'
    assert.equal(postHero(old, 'our-cap')?.id, rulerOf(old, 'us')?.id)
    assert.equal(planned(old, []).heroes['us-1']!.post, null)
  })

  it('군대를 이끌던 장수를 맡기면 그 군대는 장수가 없어진다 · 혼자 있는 장수가 장수 없는 군대를 이끈다', () => {
    const r = structuredClone(byeonhanMini(1))
    r.armies['a-us']!.at = 'our-north'
    const p = planned(r, [{ kind: 'assign', hero: 'chief', node: 'our-north' }])
    assert.equal(p.armies['a-us']!.hero, null)
    assert.equal(p.heroes['chief']!.post, 'our-north')
    const q = planned(p, [{ kind: 'lead', hero: 'us-1', army: 'a-us' }])
    assert.equal(q.armies['a-us']!.hero, 'us-1')
    assert.equal(q.heroes['us-1']!.at, null)
  })

  it('맡은 장수의 지략·신중이 그 고을 경계를 받친다', () => {
    const r = structuredClone(byeonhanMini(1))
    r.heroes['us-1']!.at = 'our-north'
    const p = planned(r, [{ kind: 'assign', hero: 'us-1', node: 'our-north' }])
    assert.ok(alertFloor(p, 'our-north') > alertFloor(r, 'our-north'))
    const { next } = pass(r, [{ kind: 'assign', hero: 'us-1', node: 'our-north' }])
    assert.ok(next.watch['our-north']!.alert >= alertFloor(next, 'our-north') - 1e-9)
  })

  it('해산하면 장수는 그 고을에 혼자 남는다', () => {
    const r = byeonhanMini(1)
    const p = planned(r, [{ kind: 'disband', army: 'a-us' }])
    assert.equal(p.heroes['chief']!.at, 'our-cap')
    assert.equal(armyOfHero(p, 'chief'), null)
  })

  it('고을을 잃으면 혼자 있던 장수는 이웃 제 고을로 물러나고, 갈 데가 없으면 잡힌다', () => {
    const r = structuredClone(byeonhanMini(1))
    r.heroes['us-1']!.at = 'our-north'
    r.nodes['our-north']!.owner = 'anya'
    const lines: ReportLine[] = []
    sweepHeroes(r, lines)
    assert.equal(r.heroes['us-1']!.at, 'our-cap')
    // 갈 데가 없다 — 이웃이 다 남의 땅
    const s = structuredClone(byeonhanMini(1))
    s.heroes['dokro-2']!.at = 'dokro-cap'
    s.nodes['dokro-cap']!.owner = 'guya'
    sweepHeroes(s, [])
    assert.equal(s.heroes['dokro-2']!.status, 'captive')
    assert.equal(s.heroes['dokro-2']!.captor, 'guya')
  })
})

describe('회유 · 떠돌이', () => {
  it('포로를 회유하면 계절마다 곡식이 들고, 다 되면 우리 장수가 된다', () => {
    let r = structuredClone(byeonhanMini(1))
    const g = r.heroes['guya-2']!
    g.status = 'captive'
    g.captor = 'us'
    r.armies['a-guya-2']!.hero = null
    r.stock['us']!.grain = 1000
    const n = persuadeSeasons(r, 'guya-2', 'us-ruler')
    assert.ok(n >= 1)
    let recruited = false
    r = pass(r, [{ kind: 'persuade', hero: 'guya-2', by: 'us-ruler' }]).next
    // 굴림이라 정해진 계절이 없다 — 넉넉히 기다린다
    for (let i = 1; i < 40 && !recruited; i++) {
      r.stock['us']!.grain = 1000
      if (r.heroes['guya-2']!.faction === 'us') recruited = true
      else r = pass(r).next
    }
    const h = r.heroes['guya-2']!
    assert.equal(h.faction, 'us')
    assert.equal(h.status, 'free')
    assert.notEqual(h.at, null)
  })

  it('회유는 굴림이다 — 같은 장수도 판마다 넘어오는 계절이 다르고, 일편단심은 거의 안 넘어오고, 배신의 상은 쉽게 넘어온다', () => {
    /** 회유를 걸고 넘어올 때까지 센 계절 (cap 이면 끝내 안 왔다) */
    const woo = (seed: number, trait: string | null, cap = 24): { n: number; refuse: number } => {
      let r = structuredClone(byeonhanMini(seed))
      const g = r.heroes['guya-2']!
      g.status = 'captive'
      g.captor = 'us'
      ;(g as unknown as { traits: string[] }).traits = trait === null ? g.traits.filter((t) => t !== 'steadfast') : [trait]
      r.armies['a-guya-2']!.hero = null
      let refuse = 0
      r.stock['us']!.grain = 5000
      let res = pass(r, [{ kind: 'persuade', hero: 'guya-2', by: 'us-ruler' }])
      for (let i = 1; i <= cap; i++) {
        refuse += res.lines.filter((l) => l.kind === 'persuade' && l.step === 'refuse').length
        if (res.next.heroes['guya-2']!.faction === 'us') return { n: i, refuse }
        r = res.next
        r.stock['us']!.grain = 5000
        res = pass(r)
      }
      return { n: cap, refuse }
    }
    const plain = Array.from({ length: 40 }, (_, i) => woo(i + 1, null))
    assert.ok(new Set(plain.map((x) => x.n)).size >= 3, '판마다 걸린 계절이 다르다')
    assert.ok(plain.some((x) => x.refuse > 0), '고개를 젓는 계절이 있다')
    const avg = (xs: Array<{ n: number }>): number => xs.reduce((s, x) => s + x.n, 0) / xs.length
    const steady = Array.from({ length: 40 }, (_, i) => woo(i + 1, 'steadfast'))
    const traitor = Array.from({ length: 40 }, (_, i) => woo(i + 1, 'traitor'))
    assert.ok(avg(steady) > avg(plain) + 6, `일편단심 ${avg(steady)} · 보통 ${avg(plain)}`)
    assert.ok(avg(traitor) < avg(plain), `배신의 상 ${avg(traitor)} · 보통 ${avg(plain)}`)
    // 매혹 있는 매력 8 군주가 달래도 세 해 남짓 — 여느 장수가 달래면 훨씬 더 (넘어올 확률이 바닥 recruitMin)
    assert.ok(avg(steady) > avg(plain) * 3, `일편단심 ${steady.map((x) => x.n).join(',')}`)
    assert.ok(steady.filter((x) => x.n >= 15).length >= 6, '네 해 가까이 달래도 안 오는 판이 있다')
  })

  it('떠돌이는 봄에 오고, 그 고을 주인만 값을 내고 들인다', () => {
    let r = byeonhanMini(7)
    for (let i = 0; i < 24 && (r.wanderers ?? []).length === 0; i++) r = pass(r).next
    const w = (r.wanderers ?? [])[0]
    assert.ok(w !== undefined, '떠돌이가 한 번은 와야 한다')
    const owner = r.nodes[w.node]!.owner!
    assert.ok(wanderersFor(r, owner).some((x) => x.hero.id === w.hero.id))
    const other = Object.keys(r.factions).find((f) => f !== owner)!
    r.stock[owner]!.grain = 10_000
    r.stock[other]!.grain = 10_000
    assert.equal(planned(r, [{ kind: 'hire', faction: other, hero: w.hero.id }]).heroes[w.hero.id], undefined)
    const p = planned(r, [{ kind: 'hire', faction: owner, hero: w.hero.id }])
    assert.equal(p.heroes[w.hero.id]!.faction, owner)
    assert.equal(p.stock[owner]!.grain, 10_000 - w.price)
  })
})

describe('본 장수 · 결정론', () => {
  it('우리 장수는 보이고, 남의 장수는 그 고을을 정찰하면 보인다', () => {
    const r = byeonhanMini(1)
    assert.equal(heroSeen(r, 'us', 'chief'), true)
    assert.equal(heroSeen(r, 'us', 'guya-1'), false)
    const { next } = pass(r, [{ kind: 'scout', faction: 'us', node: 'guya-cap', hero: null }])
    assert.equal(heroSeen(next, 'us', 'guya-1'), true)
  })

  it('같은 판 · 같은 명령이면 같은 결과', () => {
    const r = byeonhanMini(5)
    const o: Order[] = [{ kind: 'assign', hero: 'us-1', node: 'our-cap' }]
    assert.deepEqual(advance(r, o), advance(r, o))
    assert.ok(P.realm.persuadeSeasons >= 1)
  })
})

describe('옛 판 — 특성 줄이 없는 장수 (형의 9년 가을 막힘, 2026-10-19)', () => {
  it('정이 100에 닿아도 막히지 않는다 · migrate 가 빈 특성 줄을 채운다', () => {
    const r = byeonhanMini(1)
    for (const h of Object.values(r.heroes)) delete (h as { traits?: unknown }).traits
    const h = Object.values(r.heroes).find((x) => x.faction === 'us' && x.status === 'free' && !x.id.endsWith('-ruler'))!
    ;(h as { bond?: number }).bond = 99.5
    const lines: ReportLine[] = []
    assert.doesNotThrow(() => addBond(r, h, 5, lines))
    assert.ok(lines.some((l) => l.kind === 'awaken'))
    const r2 = byeonhanMini(2)
    for (const x of Object.values(r2.heroes)) delete (x as { traits?: unknown }).traits
    migrate(r2)
    assert.ok(Object.values(r2.heroes).every((x) => Array.isArray(x.traits)))
    assert.doesNotThrow(() => advance(r2, []))
  })
})

// 형 2026-10-20: "수성에서 지면 장수가 무조건 사로잡혀? 죽거나 후퇴하거나 이런경우는 없어? 그것도 그 장수 능력치에따라 달라져야할듯"
describe('고을이 떨어질 때 혼자 머물던 장수', () => {
  /** 우리 고을 하나에 장수를 혼자 두고, 그 고을을 적이 쥐었다 — n 판의 운명을 센다 */
  const fates = (stat: number, safeNeighbor: boolean, n = 120): Record<string, number> => {
    const out: Record<string, number> = { moved: 0, caught: 0, slipped: 0, fell: 0, captive: 0 }
    for (let seed = 1; seed <= n; seed++) {
      const r = byeonhanMini(seed)
      const h = Object.values(r.heroes).find((x) => x.faction === 'us' && armyOfHero(r, x.id) === null && x.status === 'free')!
      h.mu = stat
      h.ryak = stat
      h.at = 'our-east'
      r.nodes['our-east']!.owner = 'guya'
      if (!safeNeighbor) {
        // 이웃은 다 적 땅 · 멀리 떨어진 섬 하나만 우리 것 (빠져나갈 곳)
        for (const ed of Object.values(r.edges)) for (const [x, y] of [[ed.a, ed.b], [ed.b, ed.a]] as const) if (x === 'our-east') r.nodes[y]!.owner = 'guya'
        r.nodes['wild-keunseom']!.owner = 'us'
        r.nodes['wild-keunseom']!.hh = 50
      }
      const lines: ReportLine[] = []
      sweepHeroes(r, lines)
      const l = lines.find((x) => x.kind === 'heroMoved' && x.hero === h.id)
      assert.ok(l !== undefined && l.kind === 'heroMoved')
      const k = l.fate ?? (l.captor !== null ? 'captive' : 'moved')
      out[k] = (out[k] ?? 0) + 1
    }
    return out
  }

  it('늘 사로잡히지 않는다 — 물러나기 · 붙잡히기 · 쓰러지기가 갈리고, 무예·지략이 높으면 더 잘 빠진다', () => {
    const weak = fates(2, true)
    const strong = fates(9, true)
    assert.ok(weak.moved! > 0 && (weak.caught! + weak.fell!) > 0, `약한 장수도 갈린다 ${JSON.stringify(weak)}`)
    assert.ok(strong.moved! > weak.moved!, `센 장수가 더 잘 물러난다 ${JSON.stringify(strong)} vs ${JSON.stringify(weak)}`)
  })

  it('물러날 이웃이 없으면 도읍으로 빠져나가거나 사로잡힌다', () => {
    const weak = fates(2, false)
    const strong = fates(9, false)
    assert.ok(strong.slipped! > weak.slipped!, `${JSON.stringify(strong)} vs ${JSON.stringify(weak)}`)
    assert.ok(weak.captive! > 0)
  })
})
