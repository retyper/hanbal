/**
 * 판의 법칙 묶음 (docs/realm/battle-study/52-bodies-and-lines.md §6 · §7 검수 B2·B5·W4·W7) — 계약 칸이 뜻대로 차는가
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createField, runField, stepField, ticksOf } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { P } from '../../src/tune/params.ts'
import { MORALE_CAUSES, OP_SKILL, OP_STANCE, ORD_CHARGE, ORD_NONE, STANCE_CHARGE } from '../../src/field/types.ts'

test('편이 무너지면 sideBreak 하나 · sideBreakSec 동안 그 편의 산 대가 모두 달아난 뒤 끝나고 무너진 편이 진다', () => {
  for (const seed of [3, 5, 8]) {
    const s = createField(plainSetup(seed, 1300))
    while (s.end === null && s.breakTick[0] < 0 && s.breakTick[1] < 0) stepField(s)
    assert.equal(s.end, null, `seed ${seed}: 무너지자마자 끝났다`)
    const side = s.breakTick[0] >= 0 ? 0 : 1
    const ev = s.log.events.filter(e => e.kind === 'sideBreak')
    assert.equal(ev.length, 1, `seed ${seed}: sideBreak ${ev.length}`)
    assert.equal(ev[0]!.side, side)
    const at = s.breakTick[side]
    stepField(s)
    assert.ok(s.squads.every(q => q.side !== side || q.men <= 0 || q.flee === 1), `seed ${seed}: 무너진 편에 안 달아나는 대`)
    while (s.end === null) stepField(s)
    assert.equal(s.tick, at + ticksOf(P.field.sideBreakSec), `seed ${seed}: 끝난 틱`)
    assert.equal(s.winner, 1 - side, `seed ${seed}: 이긴 편`)
  }
})

test('까닭별 사기 몫 (moraleBy) — 음수가 없고, 진 편의 깎인 몫 합이 그 편 사기가 실제로 내려간 몫 이상이다', () => {
  for (const seed of [1, 2, 3, 4]) {
    const s = runField(plainSetup(seed, 1300))
    if (s.winner < 0) continue
    const lose = (1 - s.winner) as 0 | 1
    const by = s.stats.moraleBy[lose]
    for (const c of MORALE_CAUSES) assert.ok(Number.isSafeInteger(by[c]) && by[c] >= 0, `${c} ${by[c]}`)
    let men = 0, drop = 0
    for (const q of s.squads) if (q.side === lose) { men += q.menMax; drop += (q.morale0 - q.morale) * q.menMax }
    const sum = MORALE_CAUSES.reduce((a, c) => a + by[c], 0)
    assert.ok(sum * 100 >= drop * 95, `seed ${seed}: 몫 합 ${Math.round(sum / men)} < 내려간 몫 ${Math.round(drop / men)}`)
    assert.ok(by.melee > 0 && by.arrows > 0, `seed ${seed}: 칼날·화살 몫이 0`)
  }
})

test('비기 사건은 닿은 대가 없어도 범위(r)를 싣고 큰 외침은 장수 자리에서 낸다 · 휘두름은 비기 통계에 안 든다', () => {
  const s = createField(plainSetup(1, 1300))
  const h = s.heroes.find(e => e.side === 0)!
  const hu = h.u
  stepField(s, [{ tick: 0, g: 3, op: OP_SKILL, u: h.u + 3 * P.field.unit, v: h.v }])
  const ev = s.log.events.find(e => e.kind === 'heroSkill')!
  assert.equal(ev.r, P.field.heroArtCells * P.field.unit)
  assert.equal(ev.u, hu)
  assert.equal(s.stats.artMorale[0], 0)
  // 입력 없는 판: 비기를 아무도 안 쓰면 비기 통계는 0 이다 (휘두름·내닫기는 moraleBy.hero 로)
  const t = runField(plainSetup(2, 1300))
  assert.deepEqual(t.stats.artMorale, [0, 0])
})

test('끝난 명령은 ORD_NONE 으로 — 돌격은 산 대가 모두 맞물리면 끝난다 (검수 W7)', () => {
  const s = createField(plainSetup(4, 1300))
  stepField(s, [{ tick: 0, g: 0, op: OP_STANCE, u: STANCE_CHARGE, v: 0 }])
  const front = (): number => s.squads.find(q => q.side === 0 && q.grp === 'front' && q.men > 0)!.order
  assert.equal(front(), ORD_CHARGE)
  let off = -1
  while (s.end === null && off < 0) { stepField(s); if (front() === ORD_NONE) off = s.tick }
  assert.ok(off > 0 && off < ticksOf(P.field.chargeMaxSec) + 5, `돌격이 끝난 틱 ${off}`)
})
