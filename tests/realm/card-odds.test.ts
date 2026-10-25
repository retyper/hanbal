/**
 * 사건 카드 — 화면이 보이는 것과 엔진이 거는 것이 같다 (docs/realm/ODDS.md · 형 10-25: "확률이랑 얻게 되거나 잃게 되는 거 이미지랑 숫자로")
 *
 *  - 굴리는 답의 % 는 resolveCard 의 판정 문턱 그대로다 — 여러 판을 굴리면 그 비율로 이룬다 (보정 시험 · BUILD §3-3)
 *  - 틀림없이 오가는 곡식·쇠·집·가을걷이 배수는 미리 본 수와 실제로 걸린 수가 같다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { roll } from '../../src/core/rng.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { cardPreview, resolveCard } from '../../src/realm/events.ts'
import { P } from '../../src/tune/params.ts'
import type { Card, Realm, ReportLine } from '../../src/realm/types.ts'

type CardLine = Extract<ReportLine, { kind: 'card' }>

const ourNode = (r: Realm): string => Object.values(r.nodes).filter((n) => n.owner === r.player && n.kind !== 'sodo').sort((a, b) => (a.id < b.id ? -1 : 1))[0]!.id

function play(seed: number, card: (r: Realm) => Card, pick: 0 | 1): { r: Realm; pv: NonNullable<ReturnType<typeof cardPreview>>; line: CardLine } {
  const r = byeonhanMini(seed)
  r.stock[r.player]!.grain = 400 + seed * 7
  r.stock[r.player]!.iron = 30 + seed
  const c = card(r)
  r.card = c
  const pv = cardPreview(r, c, pick)!
  const out: ReportLine[] = []
  resolveCard(r, [{ kind: 'card', faction: r.player, pick }], out)
  return { r, pv, line: out.find((l): l is CardLine => l.kind === 'card')! }
}

describe('사건 카드 — 굴리는 답의 %', () => {
  const rolled: Array<{ kind: Card['kind']; pick: 0 | 1; die: string; want: number }> = [
    { kind: 'locust', pick: 1, die: 'wait', want: P.realm.cardLocustOk },
    { kind: 'plague', pick: 1, die: 'spread', want: P.realm.cardPlagueOk },
    { kind: 'pirates', pick: 1, die: 'fight', want: P.realm.cardPirateOk },
  ]
  for (const x of rolled) {
    it(`${x.kind} — 미리 본 % 가 판정 문턱이고, 여러 판이면 그 비율로 이룬다`, () => {
      let wins = 0
      const N = 300
      for (let seed = 1; seed <= N; seed++) {
        const { r, pv, line } = play(seed, (r) => ({ kind: x.kind, season: r.season, node: ourNode(r) }), x.pick)
        assert.equal(pv.chance, x.want)
        assert.equal(pv.die, x.die)
        assert.equal(line.good, roll(r.seed, r.season, `card-res:${x.kind}:${x.die}`) < pv.chance!, `${seed}`)
        if (line.good === true) wins++
      }
      assert.ok(Math.abs(wins / N - x.want) < 0.08, `${x.kind} ${wins}/${N} vs ${x.want}`)
    })
  }

  it('굴리지 않는 답에는 % 가 없다', () => {
    const r = byeonhanMini(3)
    for (const kind of ['drought', 'bounty', 'halo', 'waship', 'whale'] as const) {
      for (const pick of [0, 1] as const) assert.equal(cardPreview(r, { kind, season: r.season, node: ourNode(r) }, pick)!.chance, undefined, `${kind} ${pick}`)
    }
  })
})

describe('사건 카드 — 미리 본 수 = 실제로 걸린 수', () => {
  it('가뭄 — 바치는 곡식과 가을걷이 배수', () => {
    for (const pick of [0, 1] as const) {
      for (let seed = 1; seed <= 20; seed++) {
        const { r, pv, line } = play(seed, (r) => ({ kind: 'drought', season: r.season }), pick)
        assert.ok((pv.sure.grain ?? 0) < 0)
        assert.equal(line.grain, pv.sure.grain, `${seed} ${pick}`)
        assert.equal(r.harvestMod?.[r.player]?.mul, pv.sure.harvest)
      }
    }
  })

  it('왜의 배 — 팔면 쇠가 나가고 곡식이 들어온다 · 사면 반대', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const sell = play(seed, (r) => ({ kind: 'waship', season: r.season, node: ourNode(r) }), 0)
      assert.ok((sell.pv.sure.iron ?? 0) < 0 && (sell.pv.sure.grain ?? 0) > 0)
      assert.equal(sell.line.iron, sell.pv.sure.iron)
      assert.equal(sell.line.grain, sell.pv.sure.grain)
      const buy = play(seed, (r) => ({ kind: 'waship', season: r.season, node: ourNode(r) }), 1)
      assert.ok((buy.pv.sure.iron ?? 0) > 0 && (buy.pv.sure.grain ?? 0) < 0)
      assert.equal(buy.line.iron, buy.pv.sure.iron)
      assert.equal(buy.line.grain, buy.pv.sure.grain)
    }
  })

  it('바다 도적에 맞서면 — 이기면 미리 본 쇠, 지면 미리 본 집과 곡식', () => {
    let won = 0
    let lost = 0
    for (let seed = 1; seed <= 40; seed++) {
      const { pv, line } = play(seed, (r) => ({ kind: 'pirates', season: r.season, node: ourNode(r) }), 1)
      if (line.good === true) {
        won++
        assert.equal(line.iron, pv.win!.iron)
        assert.equal(line.grain, undefined)
      } else {
        lost++
        assert.equal(line.grain, pv.lose!.grain)
        assert.equal(line.hh, -pv.lose!.hurt!.reduce((a, [, d]) => a + d, 0))
      }
    }
    assert.ok(won > 0 && lost > 0, `${won} ${lost}`)
  })

  it('곡식이 모자라면 미리 보는 수도 창고만큼 — 없는 곡식을 잃는다고 하지 않는다', () => {
    const r = byeonhanMini(3)
    r.stock[r.player]!.grain = 4
    const pv = cardPreview(r, { kind: 'pirates', season: r.season, node: ourNode(r) }, 0)!
    assert.equal(pv.sure.grain, -4)
  })
})
