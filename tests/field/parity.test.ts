/**
 * 본편 fightRounds 와 같은 쪽으로 기우는가 — **수치가 아니라 방향**만 견준다 (복제 표류를 막는 안전망 · 26 §1-1).
 * 방향: 세모 방진 > 돌격 > 길 트기 > 방진 · 병력이 클수록 이긴다 · 같은 자세끼리는 많은 쪽이 이긴다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fightRounds, type Side } from '../../src/realm/tactics.ts'
import { createField, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { P } from '../../src/tune/params.ts'
import type { Cmd } from '../../src/realm/types.ts'
import type { Squad } from '../../src/field/types.ts'

const EVEN = { spear: 34, bow: 33, shield: 33 }
const side = (F: number, player = false): Side => ({ F, mix: EVEN, morale: 1, hero: { id: player ? 'me' : 'foe', mu: 5, ryak: 5, coward: false }, hungry: false, specials: [], water: false, player, seen: true })
const CMD = ['charge', 'hold', 'open'] as const
const U = (c: number): number => c * P.field.unit

function fieldLoss(men: number, a: number, d: number): [number, number] {
  const s = createField(plainSetup(1, 1300, false))
  const pick = (sd: 0 | 1): Squad => s.squads.find(q => q.side === sd && q.grp === 'front')!
  const A = pick(0), B = pick(1)
  for (const q of s.squads) if (q !== A && q !== B) { q.men = 0; q.hp = 0; q.menMax = 0 }
  for (const q of [A, B]) { q.men = men; q.menMax = men; q.hp = men * 1000; q.manual = 1; q.goal = null; q.v = U(20); q.u = U(50) }
  B.u = U(51); A.stance = a as 0 | 1 | 2; B.stance = d as 0 | 1 | 2
  for (let i = 0; i < 60 && s.end === null; i++) stepField(s)
  return [1 - A.hp / (A.menMax * 1000), 1 - B.hp / (B.menMax * 1000)]
}

test('세모의 세 방향이 본편과 같은 쪽이다', () => {
  for (const [a, d] of [[1, 0], [0, 2], [2, 1]] as const) {
    // 본편: a 의 명령이 d 를 이긴 합이 한 번은 나온다
    let wins = 0, seen = 0
    for (let s = 0; s < 160; s++) {
      const rd = fightRounds(side(100, true), side(100), `k${s}`, s, 0, { cmds: [{ front: CMD[a] as Cmd, bows: 'volley', lead: 'drum' }] }).rounds[0]!
      if (rd.od?.front !== CMD[d] || rd.ev !== undefined) continue
      seen++
      if (rd.beat === 'a') wins++
    }
    assert.ok(seen > 0 && wins === seen, `본편 ${CMD[a]} > ${CMD[d]} (${wins}/${seen})`)
    // 전장: a 의 대가 덜 잃는다
    const [la, ld] = fieldLoss(800, a, d)
    assert.ok(la < ld, `전장 ${CMD[a]} > ${CMD[d]} (${la.toFixed(3)} < ${ld.toFixed(3)})`)
  }
})

test('병력이 클수록 이기고, 같은 자세끼리는 많은 쪽이 이긴다', () => {
  for (const stance of [0, 1, 2]) {
    const small = fieldLoss(400, stance, stance)
    assert.ok(Math.abs(small[0] - small[1]) < 0.05, '같은 수 · 같은 자세는 비슷하다')
  }
  const s = createField(plainSetup(1, 1300, false))
  const A = s.squads.find(q => q.side === 0 && q.grp === 'front')!, B = s.squads.find(q => q.side === 1 && q.grp === 'front')!
  for (const q of s.squads) if (q !== A && q !== B) { q.men = 0; q.hp = 0; q.menMax = 0 }
  for (const [q, n] of [[A, 900], [B, 500]] as const) { q.men = n; q.menMax = n; q.hp = n * 1000; q.manual = 1; q.goal = null; q.v = U(20); q.u = U(50); q.stance = 1 }
  B.u = U(51)
  for (let i = 0; i < 80; i++) stepField(s)
  assert.ok(1 - A.hp / (A.menMax * 1000) < 1 - B.hp / (B.menMax * 1000))
  // 본편: 같은 편성에서 F 가 큰 쪽이 더 자주 이긴다
  let big = 0
  for (let k = 0; k < 60; k++) if (fightRounds(side(300, true), side(100), `p${k}`, k, 0).outcome.startsWith('win') || fightRounds(side(300, true), side(100), `p${k}`, k, 0).outcome === 'rout') big++
  assert.ok(big > 30, `본편 큰 쪽 승 ${big}/60`)
})
