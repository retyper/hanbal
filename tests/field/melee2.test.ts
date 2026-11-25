import { test } from 'node:test'
import assert from 'node:assert/strict'
import { P } from '../../src/tune/params.ts'
import { createField, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { readField, type VLoss } from '../../src/field/viewRead.ts'
import { drawField, resetFx } from '../../src/field/view.ts'
import { OP_MOVE, type FieldInput } from '../../src/field/types.ts'
import { coolPress, noteLoss, parts, resetMelee, spawn, stains, swingChance, swings, addStain } from '../../src/field/viewMelee.ts'
import type { Art } from '../../src/field/viewArt.ts'

const noop = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D
const art = { base: '', manifest: null, strips: new Map(), ground: { complete: false, naturalWidth: 0 }, pieces: new Map() } as unknown as Art
const vp = { w: 800, h: 360 }
const cam = { level: 0, zoom: 0.4, x: 1800, y: 480 }

test('이기는 쪽이 칼을 더 자주 낸다 (loss 의 양으로)', () => {
  resetMelee()
  assert.equal(swingChance(1), P.field.swingBasePermille)
  noteLoss({ from: 1, to: 2, n: 30, how: 0 }, 0)
  noteLoss({ from: 2, to: 1, n: 5, how: 0 }, 0)
  assert.ok(swingChance(1) > swingChance(2))
  assert.ok(swingChance(1) <= 1000 && swingChance(2) >= P.field.swingMinPermille)
  let a = 0, b = 0
  for (let c = 0; c < 1000; c++) { if (swings(1, 3, c, swingChance(1))) a++; if (swings(2, 3, c, swingChance(2))) b++ }
  assert.ok(a > b)
  coolPress(1e6)
  assert.equal(swingChance(1), swingChance(2))
})

test('입자와 자국은 상한을 넘지 않는다', () => {
  resetMelee()
  for (let i = 0; i < 1000; i++) { spawn(0, 0, 0, 0, 0, 0, 1000, 3); addStain(i, 0, 0) }
  assert.ok(parts.length <= P.field.particleMax)
  assert.ok(stains.length <= P.field.stainMax)
})

test('맞붙은 판 300틱을 그려도 안 깨지고 입자·자국이 상한 안이다 · 같은 입력이면 같은 점 수', () => {
  const run = (): number => {
    resetFx()
    const s = createField(plainSetup(5, 2400))
    const U = P.field.unit
    const go: FieldInput[] = [0, 1, 2].map(g => ({ tick: 0, g: g as 0 | 1 | 2, op: OP_MOVE, u: 80 * U, v: 20 * U }))
    let prev = readField(s), drawn = 0
    for (let t = 0; t < 300 && s.end === null; t++) {
      stepField(s, t === 0 ? go : [])
      const cur = readField(s)
      const hits: VLoss[] = cur.loss
      for (let j = 0; j < 6; j++) drawn += drawField(noop, vp, cam, cur, prev, (j + 1) / 6, t * 100 + j * 16, art, false, null, j === 0 ? hits : [])
      assert.ok(parts.length <= P.field.particleMax)
      assert.ok(stains.length <= P.field.stainMax)
      prev = cur
    }
    return drawn
  }
  assert.equal(run(), run())
})
