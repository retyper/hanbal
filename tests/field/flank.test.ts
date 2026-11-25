import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createField, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { OP_AIM, ORD_FLANK, ORD_NONE, type FieldInput } from '../../src/field/types.ts'
import { P } from '../../src/tune/params.ts'

/** 검수 B1 — 「V 를 적 활에 찍었는데 먹힌 옆치기 0번」: 찍은 뒤 9초 안에 적 활 무리를 옆·뒤에서 닿고(flankHit) · 그 뒤 flankStaySec 남짓에 빠져 기본 행동으로 */
test('옆치기: 적 활 둘째 대를 찍으면 9초 안에 옆·뒤에서 닿고 flankHit · 닿은 뒤 빠져 돌아온다 (씨앗 넷)', () => {
  const hz = P.field.hz
  for (const seed of [3, 4, 7, 11]) {
    const s = createField(plainSetup(seed, 1200))
    const T0 = 20 * hz
    let hit = -1, back = -1
    while (s.end === null && s.tick < T0 + 20 * hz) {
      const ins: FieldInput[] = []
      if (s.tick === T0) { const t = s.squads.filter(q => q.side === 1 && q.grp === 'bows')[1]!; ins.push({ tick: T0, g: 2, op: OP_AIM, u: t.u, v: t.v }) }
      stepField(s, ins)
      const hs = s.squads.filter(q => q.side === 0 && q.grp === 'horse' && q.men > 0)
      if (s.tick > T0 && hit < 0 && s.log.events.some(e => e.kind === 'flankHit' && e.side === 0)) hit = s.tick
      if (hit >= 0 && back < 0 && hs.every(q => q.order === ORD_NONE)) back = s.tick
      if (s.tick === T0 + 1) assert.ok(hs.every(q => q.order === ORD_FLANK), `씨앗 ${seed}: 옆치기를 받았다`)
    }
    assert.ok(hit >= 0 && hit - T0 <= 9 * hz, `씨앗 ${seed}: 첫 닿음 ${(hit - T0) / hz}초`)
    assert.ok(back >= 0 && back - hit <= (P.field.flankStaySec + 1) * hz, `씨앗 ${seed}: 빠짐 ${(back - hit) / hz}초 뒤`)
  }
})
