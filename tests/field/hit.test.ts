import { test } from 'node:test'
import assert from 'node:assert/strict'
import { P } from '../../src/tune/params.ts'
import { createField, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { readField } from '../../src/field/viewRead.ts'
import { FLAG_FALLEN, clockSt, flagTilt, ingestHits, kickOf, pops, resetHit, scatterOf, sc, shake, shakeAt, viewClock } from '../../src/field/viewHit.ts'

function model() {
  const s = createField(plainSetup(3, 1200))
  for (let i = 0; i < 3; i++) stepField(s)
  return readField(s)
}
const horse = (m: ReturnType<typeof model>) => m.squads.find(q => q.side === 0 && q.grp === 'horse')!
const foe = (m: ReturnType<typeof model>) => m.squads.find(q => q.side === 1 && q.grp === 'bows')!

test('상성이 맞으면 깃이 꺾이고 점이 흩어지며 멈칫·흔들림·튕김이 걸린다 · 1.5초 안에는 다시 안 걸린다', () => {
  resetHit()
  const m = model(), a = horse(m), v = foe(m)
  const ev = { kind: 'impact', side: 0, id: a.id, u: 0, v: 0, n: 10, how: 1, to: v.id }
  ;(m as unknown as { events: unknown[] }).events = [ev]
  viewClock(1000)
  ingestHits(m, [], 1000, 1000)
  assert.ok(Math.abs(flagTilt(v.id, 1, -1, 1050, 0.55)) > 0.05, '깃이 기울었다')
  assert.ok(Math.abs(flagTilt(v.id, 1, -1, 1050, 0.55)) <= P.field.flagTiltDeg * Math.PI / 180 + 1e-9)
  assert.equal(flagTilt(v.id, 1, -1, 1000 + P.field.flagShakeMs + 10, 0.55), 0, '흔들림이 끝나면 곧게')
  assert.ok(kickOf(v.id, 1050) !== 0, '맞은 대가 튕긴다')
  let any = false
  for (let k = 0; k < 16; k++) { scatterOf(v.id, k, 1100); if (sc.x !== 0 || sc.turn) any = true }
  assert.ok(any, '점이 흩어진다')
  shakeAt(1030)
  assert.ok(shake.x !== 0 || shake.y !== 0, '화면이 흔들린다')
  // 멈칫: 시계가 멈춘다
  const c0 = viewClock(1040), c1 = viewClock(1100)
  assert.equal(c0, c1, '멈칫 동안 그리는 시계가 안 간다')
  assert.ok(viewClock(1000 + P.field.stopHorseMs + 100) > c1)
  // 같은 무리 1.5초 안 재충돌은 무시
  const stopAt = clockSt.stopUntil
  ingestHits(m, [], 1500, 1500)
  assert.equal(clockSt.stopUntil, stopAt)
})

test('깃은 사기가 낮으면 기운 채 · 문턱 아래면 떨어진다', () => {
  resetHit()
  assert.equal(flagTilt(1, 1, 1, 0, 0.55), 0)
  assert.ok(flagTilt(1, 0.65, 1, 0, 0.55) !== 0)
  assert.ok(Math.abs(flagTilt(1, 0.5, 1, 0, 0.55)) === FLAG_FALLEN)
})

test('사기 숫자는 상한 안이다', () => {
  resetHit()
  const m = model(), v = foe(m)
  for (let i = 0; i < 100; i++) {
    ;(m as unknown as { events: unknown[] }).events = [{ kind: 'artHit', side: 0, id: -1, u: 0, v: 0, n: 200, to: v.id }]
    ingestHits(m, [], i * 10, i * 10)
  }
  assert.ok(pops.length <= P.field.moralePopMax)
  assert.equal(pops[0]!.n, 20)
})

test('버팀(stand)은 범위 안 우리 대만 무기를 치켜들게 한다 (0.3초)', async () => {
  const { noteStand, raisedAt } = await import('../../src/field/viewHit.ts')
  resetHit()
  const m = model(), a = horse(m)
  noteStand(m, 0, a.u, a.v, P.field.heroAuraCells * P.field.unit, 1000)
  assert.equal(raisedAt(a.id, 1100), true)
  assert.equal(raisedAt(a.id, 1000 + P.field.standRaiseMs + 10), false)
  assert.equal(raisedAt(foe(m).id, 1100), false, '적 대는 아니다')
})
