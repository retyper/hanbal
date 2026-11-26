/**
 * 검수 2 (사람 판 다섯) 의 엔진 고침 — E1 사람 편에 적 AI 큰 수가 안 걸린다 · E2 장수 쓰러짐 한 번의 사기 몫
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createField, sideMorale, stepField } from '../../src/field/sim.ts'
import { hurtHero } from '../../src/field/hero.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { P } from '../../src/tune/params.ts'
import { ORD_CHARGE, ORD_FLANK, ORD_HOLD } from '../../src/field/types.ts'

test('E1: 입력 없는 사람 편(편 0)은 예고 옆치기·알아서 방진·돌격을 안 쓰고 적 AI 편(편 1)은 쓴다', () => {
  let foeUsed = 0
  for (let seed = 1; seed <= 8; seed++) {
    const s = createField(plainSetup(seed, 1300))
    let mine = false, foe = false
    while (s.end === null) {
      stepField(s)
      for (const q of s.squads) if (q.men > 0 && (q.order === ORD_HOLD || q.order === ORD_CHARGE || q.order === ORD_FLANK)) { if (q.side === 0) mine = true; else foe = true }
    }
    assert.equal(mine, false, `seed ${seed}: 사람 편에 AI 큰 수`)
    assert.ok(!s.log.events.some(e => e.kind === 'omen' && e.side === 0), `seed ${seed}: 사람 편 예고`)
    if (foe) foeUsed++
  }
  assert.ok(foeUsed >= 4, `적 AI 가 큰 수를 쓴 판 ${foeUsed}/8`)
})

test('E2: 적장에게 쓰러져도 편 사기 낙폭은 8%p 아래 · heroStunSec 뒤 일어난다', () => {
  const s = createField(plainSetup(2, 1200))
  stepField(s)
  const h = s.heroes.find(e => e.side === 0)!
  const before = sideMorale(s, 0)
  hurtHero(s, h, P.field.heroHp + 1, true)
  stepField(s)
  assert.ok(before - sideMorale(s, 0) <= 80, `편 사기 ${before} → ${sideMorale(s, 0)}`)
  let up = -1
  while (s.end === null && up < 0) { stepField(s); if (s.log.events.some(e => e.kind === 'heroUp' && e.side === 0 && e.tick === s.tick - 1)) up = s.tick }
  assert.ok(up > 0 && h.stun === 0, '일어남')
})
