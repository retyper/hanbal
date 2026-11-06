import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { RoundLog } from '../../src/realm/types.ts'
import { arrowPose, planBattleStrikes } from '../../src/ui/realm/battle-strikes.ts'

const unit = (side: 'a' | 'd', group: 'front' | 'bows' | 'horse' | 'lead', y: number, falling = false) => ({
  side, group, ranged: group === 'bows', falling, x: side === 'a' ? 20 : 80, y,
})
const round: RoundLog = { a: 'charge', d: 'hold', beat: null, push: .5, na: 1, nd: 1, ma: 1, md: 1 }

test('battle replay assigns a logged ranged target, then a separate melee casualty', () => {
  const bow = unit('a', 'bows', 20)
  const spear = unit('a', 'front', 50)
  const fallen = unit('d', 'front', 80, true)
  const rival = unit('d', 'front', 50)
  const horse = unit('d', 'horse', 20)
  const strikes = planBattleStrikes([bow, spear, fallen, rival, horse], { ...round, acts: [
    { s: 'a', g: 'bows', c: 'counter', n: 10, tg: 'horse', tl: 4, res: 'hit' },
    { s: 'a', g: 'front', c: 'charge', n: 10, tg: 'front', tl: 10, res: 'won' },
    { s: 'd', g: 'horse', c: 'guard', n: 10, tg: 'lead', res: 'ok' },
  ] }, [{ ours: true, c: 'counter', at: 1 }], 3, true)
  assert.equal(strikes.find((s) => s.source === bow)?.target, horse)
  assert.equal(strikes.find((s) => s.source === spear)?.target, fallen)
  assert.equal(strikes.some((s) => s.source === fallen || s.source === horse), false)
  const shot = strikes.find((s) => s.source === bow)!
  assert.ok(shot.start < shot.impact - shot.flight && shot.impact < 3)
})

test('duel pairs leaders and blocked ranged attack does not trigger a hit', () => {
  const a = unit('a', 'lead', 45)
  const d = unit('d', 'lead', 50)
  const bow = unit('d', 'bows', 20)
  const front = unit('a', 'front', 30)
  const strikes = planBattleStrikes([a, d, bow, front], { ...round, ev: 'duel-win', acts: [
    { s: 'a', g: 'lead', c: 'duel', n: 1, res: 'won' },
    { s: 'd', g: 'bows', c: 'volley', n: 10, tg: 'front', tl: 0, res: 'blocked' },
  ] }, [], 3, false)
  assert.equal(strikes.find((s) => s.source === a)?.target, d)
  assert.equal(strikes.find((s) => s.source === d)?.target, a)
  assert.equal(strikes.find((s) => s.source === bow)?.hit, false)
})

test('arrow reaches the target and follows the tangent in both directions', () => {
  for (const targetX of [-100, 100]) {
    const from = { x: 0, y: 30 }
    const to = { x: targetX, y: 55 }
    const start = arrowPose(from, to, 24, 0)
    const impact = arrowPose(from, to, 24, 1)
    assert.deepEqual([start.x, start.y, impact.x, impact.y], [0, 30, targetX, 55])
    assert.equal(Math.sign(Math.cos(start.angle)), Math.sign(targetX))
    assert.ok(Math.sin(start.angle) < 0 && Math.sin(impact.angle) > 0)
    const p = arrowPose(from, to, 24, .4)
    const q = arrowPose(from, to, 24, .400001)
    assert.ok(Math.abs(Math.atan2(q.y - p.y, q.x - p.x) - p.angle) < 1e-5)
  }
})

test('retreat-only rounds never invent a clash', () => {
  const units = [unit('a', 'front', 30), unit('a', 'bows', 40), unit('d', 'front', 30)]
  for (const ev of ['retreat', 'retreat-fail'] as const) {
    assert.deepEqual(planBattleStrikes(units, { ...round, ev }, [], 3, true), [])
  }
})
