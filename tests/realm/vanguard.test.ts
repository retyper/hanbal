import { it } from 'node:test'
import assert from 'node:assert/strict'
import { fightRounds, type Side } from '../../src/realm/tactics.ts'
import { heroArt, battleGrowth } from '../../src/realm/heroes.ts'
import { advance, lessonOn } from '../../src/realm/season.ts'
import { rehearse } from '../../src/realm/warroom.ts'
import { isBreakthrough, type Breakthrough } from '../../src/realm/vanguard.ts'
import type { RoundOrder, Tactic } from '../../src/realm/types.ts'
import { vanguardScenario } from '../../tools/vanguard-scenario.ts'

function side(player: boolean): Side {
  return { F: 1000, mix: { spear: 700, bow: 300 }, morale: 1, hungry: false, specials: [], water: false, player, seen: true,
    hero: { id: player ? 'tut-haebi' : 'foe', mu: 5, ryak: 5, coward: false, ...(player ? { art: 'vanguard', breakthrough: true } : {}) } }
}
const order = (n: Breakthrough): RoundOrder => ({ front: 'hold', bows: 'volley', lead: 'art', who: 'tut-haebi', breakthrough: n })
it('completed breakthrough precedes enemy orders and bypasses army-size scaling', () => {
  const me = side(true), foe: Side = { ...side(false), F: 5000, mix: { spear: 3500, bow: 1500 } }
  for (let seed = 1; seed <= 20; seed++) {
    const r = fightRounds(me, foe, 'receipt', seed, 0, { cmds: [order(3)], open: true })
    const first = r.rounds[0]!.acts![0]!
    assert.equal(first.breakthrough, 3)
    assert.equal(first.tl, 420) // 12% of 3500, regardless of troop disparity or the AI command.
  }
})
it('zero through three breakthroughs apply once on either attacking or defending side', () => {
  for (const defense of [false, true]) for (const n of [0, 1, 2, 3] as const) {
    const a = side(!defense), d = side(defense), tactic: Tactic = { cmds: [order(n), order(n)], open: true }
    const result = fightRounds(a, d, 'vanguard', 7, 0, tactic)
    const acts = result.rounds.flatMap(r => r.acts ?? []).filter(a => a.breakthrough !== undefined)
    assert.equal(acts.length, 1); assert.equal(acts[0]!.breakthrough, n)
    assert.equal(acts[0]!.s, defense ? 'd' : 'a')
    assert.ok(n === 0 ? acts[0]!.tl === 0 : acts[0]!.tl! > 0)
    assert.deepEqual(fightRounds(a, d, 'vanguard', 7, 0, JSON.parse(JSON.stringify(tactic))), result)
  }
})
it('foreign, spent, out-of-range, non-art receipts never transfer to another hero or command', () => {
  for (const patch of [{ who: 'other' }, { breakthrough: 4 }, { breakthrough: -1 }, { breakthrough: 1.5 }, { lead: 'drum' }]) {
    const r = fightRounds(side(true), side(false), 'invalid', 7, 0, { cmds: [{ ...order(3), ...patch } as RoundOrder], open: true })
    assert.equal(r.rounds.flatMap(r => r.acts ?? []).some(a => a.breakthrough !== undefined), false)
  }
  const me: Side = { ...side(true), hero: { id: 'tut-haebi', mu: 5, ryak: 5, coward: false, art: 'vanguard' } }
  const r = fightRounds(me, side(false), 'unawakened', 7, 0, { cmds: [order(3)], open: true })
  assert.equal(r.rounds.flatMap(r => r.acts ?? []).some(a => a.breakthrough !== undefined), false)
  assert.equal(isBreakthrough(NaN), false); assert.equal(isBreakthrough('3'), false)
})
it('campaign replay commits actual casualties; serialized campaign retains awakening with zero flames', () => {
  const { realm, orders } = vanguardScenario(), h = realm.heroes['tut-haebi']!
  assert.equal(heroArt(h), 'vanguard'); assert.equal(h.flames, 0); assert.equal(lessonOn(realm, realm.player), false)
  const pending = rehearse(realm, orders, {}, null, realm.player).line!
  assert.ok(pending.pending?.heroes?.find(h => h.id === 'tut-haebi')?.breakthrough)
  const key = pending.key!, tactics = { [key]: { cmds: [order(3), { front: 'hold', bows: 'volley', lead: 'drum' } as RoundOrder] } }
  const result = advance(realm, orders, {}, tactics)
  const zero = advance(realm, orders, {}, { [key]: { cmds: [order(0), { front: 'hold', bows: 'volley', lead: 'drum' }] } })
  const battle = result.report.lines.find(l => l.kind === 'battle')!
  assert.ok(battle.kind === 'battle')
  assert.equal(battle.rounds?.flatMap(r => r.acts ?? []).filter(a => a.breakthrough === 3).length, 1)
  assert.notDeepEqual(result.next.armies, zero.next.armies)
  assert.deepEqual(advance(JSON.parse(JSON.stringify(realm)), orders, {}, JSON.parse(JSON.stringify(tactics))), result)
  for (let i = 0; i < 5; i++) battleGrowth(result.next, [], ['tut-haebi'], [], [])
  assert.equal(result.next.heroes['tut-haebi']!.ascended, true)
})
