/**
 * 전략 회의의 안건 (src/ui/realm/council-agenda.ts · 형 10-29)
 *
 *  - 장수의 말은 모두 군주에게 '합니다' — 반말이 섞이지 않는다
 *  - 이 고을 곁에 남의 군사가 있으면 「군사를 얼마나 데려갈까」가 서고, 없으면 서지 않는다
 *  - 호전적인 나라가 우리 땅 곁에 큰 군사를 두었으면 「지금 칠까, 기다릴까」가 선다
 *  - 안건마다 말은 둘 이상 — 갈리지 않으면 회의가 아니다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { approachMoves, movesOf } from '../../src/realm/estimate.ts'
import { otherEnd } from '../../src/realm/season.ts'
import type { Realm } from '../../src/realm/types.ts'
import { councilAgendas } from '../../src/ui/realm/council-agenda.ts'

const CTX = { canLead: () => true, rationNow: 2, rationCost: () => 10, grain: 1000 }

/** 우리 군대가 남의 고을로 가는 첫 길 */
function setup(seed: number): { r: Realm; army: string; edge: string } {
  const r = byeonhanMini(seed)
  const a = Object.values(r.armies).find((x) => x.faction === r.player)!
  const m = movesOf(r, r.player, a).find((x) => x.hostile)!
  return { r, army: a.id, edge: m.edge.id }
}
function agendas(r: Realm, army: string, edge: string) {
  const a = r.armies[army]!
  const m = movesOf(r, r.player, a).find((x) => x.edge.id === edge)!
  return councilAgendas(r, r.player, a, m, approachMoves(r, r.player, a, m), CTX)
}
/** 우리 고을 곁에서 남의 군대를 모두 치운다 */
function clearNear(r: Realm, at: string): void {
  for (const x of Object.values(r.armies)) if (x.faction !== r.player) x.at = r.factions[x.faction]!.capital === at ? x.at : r.factions[x.faction]!.capital
  for (const ed of Object.values(r.edges)) {
    const o = otherEnd(ed, at)
    if (o === null) continue
    for (const x of Object.values(r.armies)) if (x.faction !== r.player && x.at === o) x.at = 'nowhere'
  }
}

describe('전략 회의의 안건', () => {
  it("장수의 말은 모두 '합니다'", () => {
    for (let s = 1; s <= 12; s++) {
      const { r, army, edge } = setup(s)
      for (const ag of agendas(r, army, edge)) {
        for (const v of ag.voices) {
          if (v.hero === null) continue
          for (const sent of v.line.split(/(?<=[.!?])\s+/)) {
            assert.match(sent.trim(), /(니다|지요|시오|세요)[.!?]$/, `${v.hero.name}: ${sent}`)
          }
        }
      }
    }
  })

  it('곁에 남의 군사가 있으면 「군사를 얼마나 데려갈까」 · 없으면 없다', () => {
    const { r, army, edge } = setup(4)
    const at = r.armies[army]!.at
    clearNear(r, at)
    assert.ok(!agendas(r, army, edge).some((x) => x.id === 'keep'), '곁에 아무도 없는데 섰다')
    // 칠 곳이 아닌 이웃 고을에 남의 군대를 세운다 (칠 곳을 지키는 군사는 우리와 맞붙으니 셈하지 않는다)
    const to = otherEnd(r.edges[edge]!, at)!
    const side = Object.values(r.edges).map((ed) => otherEnd(ed, at)).find((o): o is string => o !== null && o !== to)
    assert.ok(side !== undefined, '이웃 고을이 하나뿐')
    const foe = Object.values(r.armies).find((x) => x.faction !== r.player)!
    foe.at = to
    assert.ok(!agendas(r, army, edge).some((x) => x.id === 'keep'), '칠 곳의 군사로 섰다')
    foe.at = side
    const keep = agendas(r, army, edge).find((x) => x.id === 'keep')
    assert.ok(keep !== undefined, '곁에 남의 군사가 있는데 안 섰다')
    assert.ok(keep.voices.some((v) => v.opt.k === 'take' && v.opt.share < 1))
    assert.ok(keep.voices.some((v) => v.opt.k === 'take' && v.opt.share === 1))
  })

  it('호전적인 나라가 곁에 큰 군사를 두면 「기다릴까」', () => {
    const { r, army, edge } = setup(4)
    const at = r.armies[army]!.at
    const to = otherEnd(r.edges[edge]!, at)!
    const def = r.nodes[to]!.owner!
    ;(r.factions[def] as { mind: string }).mind = 'greedy'
    const foe = Object.values(r.armies).find((x) => x.faction === def)!
    foe.at = to
    foe.mix = { spear: 5000 }
    for (const h of Object.values(r.heroes)) if (h.faction === r.player) h.ryak = 9
    const ags = agendas(r, army, edge)
    const w = ags.find((x) => x.id === 'wait')
    assert.ok(w !== undefined, ags.map((x) => x.id).join(','))
    assert.ok(w.voices.some((v) => v.opt.k === 'wait') && w.voices.some((v) => v.opt.k === 'go'))
  })

  it('안건마다 말은 둘 이상', () => {
    for (let s = 1; s <= 12; s++) {
      const { r, army, edge } = setup(s)
      for (const ag of agendas(r, army, edge)) assert.ok(ag.voices.length >= 2, `${ag.id}: ${ag.voices.length}`)
    }
  })
})
