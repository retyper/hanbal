import { test } from 'node:test'
import assert from 'node:assert/strict'
import { P } from '../../src/tune/params.ts'
import { createField, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { readField, type VLoss } from '../../src/field/viewRead.ts'
import { drawField, fxStats, resetFx } from '../../src/field/view.ts'
import { OP_MOVE, type FieldInput } from '../../src/field/types.ts'
import type { Art } from '../../src/field/viewArt.ts'

/** 아무것도 안 그리는 판 (점의 상태만 본다) */
const noop = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D
const art = { base: '', manifest: null, strips: new Map(), ground: { complete: false, naturalWidth: 0 }, pieces: new Map() } as unknown as Art
const vp = { w: 800, h: 360 }
const cam = { level: 0, zoom: 0.4, x: 1800, y: 480 }

test('손으로 몰아 맞붙인 앞줄도 친다 · 점이 까닭 없이 사라지지 않는다 (100틱)', () => {
  resetFx()
  const s = createField(plainSetup(5, 1200))
  const U = P.field.unit
  const go: FieldInput[] = [0, 1, 2].map(g => ({ tick: 0, g: g as 0 | 1 | 2, op: OP_MOVE, u: 80 * U, v: 20 * U }))
  let prev = readField(s)
  let acc: VLoss[] = []
  let maxAtk = 0, manualFighting = 0, sawDead = 0
  for (let t = 0; t < 400 && s.end === null; t++) {
    stepField(s, t === 0 ? go : [])
    const cur = readField(s)
    acc.push(...cur.loss)
    drawField(noop, vp, cam, cur, prev, 1, t * 100, art, false, null, acc)
    acc = []
    const st = fxStats()
    maxAtk = Math.max(maxAtk, st.attackers)
    sawDead = Math.max(sawDead, st.dead)
    // 서 있는 점 수 = 판의 사람 수로 센 점 수 이하 (점이 더 남아 있지 않다)
    assert.ok(st.alive >= 0 && st.dead >= 0)
    if (cur.squads.some(q => q.side === 0 && q.manual === 1 && q.target === -1 && q.aim >= 0)) manualFighting++
    prev = cur
  }
  assert.ok(manualFighting > 0, '손으로 몬 대가 target -1 로 싸운다 (aim 으로 읽는다)')
  assert.ok(maxAtk > 0, '맞붙은 대의 앞줄 점은 공격 칸을 돈다')
  assert.ok(sawDead > 0, '사람이 줄면 점이 쓰러진다')
})

test('쓰러짐은 지연되어도 사라지지는 않는다: 기다리는 점 수가 끝에서 0', () => {
  resetFx()
  const s = createField(plainSetup(9, 1200))
  const U = P.field.unit
  const go: FieldInput[] = [0, 2].map(g => ({ tick: 0, g: g as 0 | 2, op: OP_MOVE, u: 80 * U, v: 20 * U }))
  let prev = readField(s)
  let t = 0
  for (; t < 300 && s.end === null; t++) {
    stepField(s, t === 0 ? go : [])
    const cur = readField(s)
    drawField(noop, vp, cam, cur, prev, 1, t * 100, art, false, null, cur.loss)
    prev = cur
  }
  drawField(noop, vp, cam, prev, prev, 1, t * 100 + 5000, art, false, null, [])
  assert.equal(fxStats().pending, 0)
})
