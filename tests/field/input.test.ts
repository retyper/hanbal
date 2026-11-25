import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { P } from '../../src/tune/params.ts'
import { dragIntent, gestureOf, translateAuto, translateMap, translateStance, type InputCtx } from '../../src/field/input.ts'
import { parse, serialize } from '../../src/field/rec.ts'
import { createField, runField, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { OP_AUTO, OP_MOVE, OP_STANCE, STANCE_CHARGE, STANCE_HOLD, STANCE_OPEN, type FieldInput } from '../../src/field/types.ts'

const U = P.field.unit
const ctx = (o: Partial<InputCtx> = {}): InputCtx => ({ tick: 100, face: 1, used: [0, 0, 0, 0], lastMove: [-1, -1, -1, -1], frontStance: STANCE_CHARGE, mapUUnits: 160 * U, mapVUnits: 40 * U, ...o })

test('몸짓: 짧게 = 누르기 · 오래 = 길게 · 움직임 = 끌기 (끌기가 먼저)', () => {
  assert.equal(gestureOf(0, 100), 'tap')
  assert.equal(gestureOf(4, P.field.holdMs - 1), 'tap')
  assert.equal(gestureOf(4, P.field.holdMs), 'hold')
  assert.equal(gestureOf(P.field.dragMinPx ** 2, 50), 'drag')
  assert.equal(gestureOf(P.field.dragMinPx ** 2, 5000), 'drag')
  assert.equal(gestureOf(P.field.dragMinPx ** 2 - 1, 50), 'tap')
})

test('끌기 방향: 적 쪽 = 돌격 · 옆 = 길 트기 · 뒤 = 방진 (face 가 바뀌어도)', () => {
  for (const face of [1, -1] as const) {
    assert.equal(dragIntent(40 * face, 5, face), 'charge')
    assert.equal(dragIntent(40 * face, -5, face), 'charge')
    assert.equal(dragIntent(5 * face, 40, face), 'open')
    assert.equal(dragIntent(5 * face, -40, face), 'open')
    assert.equal(dragIntent(-40 * face, 5, face), 'hold')
  }
})

test('번역표: 누르기는 자리만, 길게는 자리 + 방진, 끌기는 자리 + 자세', () => {
  const tap = translateMap(0, 'tap', 50 * U, 10 * U, 0, 0, ctx())
  assert.deepEqual(tap.inputs, [{ tick: 100, g: 0, op: OP_MOVE, u: 50 * U, v: 10 * U }])
  assert.equal(tap.intent, 'move')
  const hold = translateMap(0, 'hold', 50 * U, 10 * U, 0, 0, ctx())
  assert.deepEqual(hold.inputs.map(i => [i.op, i.u]), [[OP_MOVE, 50 * U], [OP_STANCE, STANCE_HOLD]])
  assert.equal(hold.intent, 'hold')
  const charge = translateMap(0, 'drag', 50 * U, 10 * U, 60, 0, ctx({ frontStance: STANCE_HOLD }))
  assert.deepEqual(charge.inputs.map(i => [i.op, i.u]), [[OP_MOVE, 50 * U], [OP_STANCE, STANCE_CHARGE]])
  const open = translateMap(0, 'drag', 50 * U, 10 * U, 0, -60, ctx())
  assert.deepEqual(open.inputs.map(i => [i.op, i.u]), [[OP_MOVE, 50 * U], [OP_STANCE, STANCE_OPEN]])
  assert.equal(open.intent, 'open')
})

test('이미 그 자세면 자세 입력을 아낀다', () => {
  const r = translateMap(0, 'drag', 5 * U, 5 * U, 60, 0, ctx({ frontStance: STANCE_CHARGE }))
  assert.equal(r.inputs.length, 1)
  assert.equal(r.intent, 'charge')
})

test('활·기병·장수는 자세가 없어 자리로만 가고 덧말을 단다', () => {
  for (const g of [1, 2, 3] as const) {
    const r = translateMap(g, 'hold', 5 * U, 5 * U, 0, 0, ctx())
    assert.equal(r.inputs.length, 1)
    assert.equal(r.intent, 'move')
    assert.equal(r.note, 'noStance')
  }
  assert.equal(translateStance(1, 'hold', ctx()).inputs.length, 0)
})

test('무시 규칙: 입력을 다 쓰면 budget · 너무 빨리 다시 몰면 redirect · 입력이 하나 남으면 자리만', () => {
  const full = P.field.inputPerGroupPerTime
  const b = translateMap(0, 'tap', 1, 1, 0, 0, ctx({ used: [full, 0, 0, 0] }))
  assert.deepEqual([b.inputs.length, b.why], [0, 'budget'])
  const r = translateMap(0, 'tap', 1, 1, 0, 0, ctx({ lastMove: [100 - P.field.redirectTicks + 1, -1, -1, -1] }))
  assert.deepEqual([r.inputs.length, r.why], [0, 'redirect'])
  const ok = translateMap(0, 'tap', 1, 1, 0, 0, ctx({ lastMove: [100 - P.field.redirectTicks, -1, -1, -1] }))
  assert.equal(ok.inputs.length, 1)
  const one = translateMap(0, 'hold', 1, 1, 0, 0, ctx({ frontStance: STANCE_CHARGE, used: [full - 1, 0, 0, 0] }))
  assert.deepEqual([one.inputs.length, one.note, one.intent], [1, 'stanceLater', 'move'])
  assert.equal(translateStance(0, 'hold', ctx({ used: [full, 0, 0, 0] })).why, 'budget')
  assert.equal(translateAuto(2, ctx({ used: [0, 0, full, 0] })).why, 'budget')
})

test('맵 밖을 눌러도 맵 안으로 붙는다', () => {
  const r = translateMap(0, 'tap', -500, 99999 * U, 0, 0, ctx())
  assert.deepEqual([r.inputs[0]!.u, r.inputs[0]!.v], [0, 40 * U])
})

test('알아서 하게는 OP_AUTO 하나', () => {
  assert.deepEqual(translateAuto(1, ctx()).inputs, [{ tick: 100, g: 1, op: OP_AUTO, u: 0, v: 0 }])
})

test('입력 줄 기록 왕복 (직렬화 → 읽기 → 같은 입력)', () => {
  const inputs: FieldInput[] = []
  for (const [g, gest, du, dv] of [[0, 'hold', 0, 0], [1, 'tap', 0, 0], [2, 'drag', 50, 0], [0, 'drag', 0, 60]] as const) {
    inputs.push(...translateMap(g, gest, (30 + g) * U, (8 + g) * U, du, dv, ctx({ tick: 12 * g })).inputs)
  }
  assert.ok(inputs.length >= 4)
  assert.deepEqual(parse(serialize(inputs)), inputs)
})

test('번역한 입력이 엔진에서 받아들여져 자리와 자세가 바뀐다', () => {
  const s = createField(plainSetup(3, 1200))
  const c = ctx({ tick: 0, frontStance: s.squads.find(q => q.side === 0 && q.grp === 'front')!.stance })
  const t = translateMap(0, 'drag', 70 * U, 20 * U, 0, 90, c)
  stepField(s, t.inputs)
  const front = s.squads.filter(q => q.side === 0 && q.grp === 'front')
  assert.ok(front.every(q => q.stance === STANCE_OPEN && q.manual === 1))
  assert.equal(s.log.dropped, 0)
  assert.equal(s.log.accepted.length, 2)
})

test('가장 바쁜 손이어도 한 판 입력은 80줄 이하 · 길이(바이트)를 잰다', () => {
  // 때마다 무리마다 한도까지 (자리 + 자세) 를 번역표로 낸다 — 번역이 한도를 넘기지 않으니 sim 도 하나도 버리지 않는다
  const timeTicks = P.field.timeSec * P.field.hz
  const inputs: FieldInput[] = []
  const used: [number, number, number, number] = [0, 0, 0, 0]
  const lastMove: [number, number, number, number] = [-1, -1, -1, -1]
  let stance = 1
  for (let tick = 0; tick < P.field.timesMax * timeTicks; tick += P.field.redirectTicks) {
    if (tick % timeTicks === 0) used.fill(0)
    for (const g of [0, 1, 2, 3] as const) {
      const gest = g === 0 ? (['hold', 'drag', 'tap'] as const)[(tick / P.field.redirectTicks) % 3]! : 'tap'
      const r = translateMap(g, gest, (20 + tick % 90) * U, (5 + g * 8) * U, gest === 'drag' ? 60 : 0, 0, ctx({ tick, used, lastMove, frontStance: stance }))
      for (const i of r.inputs) { inputs.push(i); used[g]++; if (i.op === OP_STANCE) stance = i.u }
      if (r.inputs.length > 0) lastMove[g] = tick
    }
  }
  const end = runField(plainSetup(5, 1500), inputs)
  assert.equal(end.log.dropped, 0)
  assert.ok(inputs.length <= 80, `줄 수 ${inputs.length}`)
  const text = serialize(end.log.accepted)
  console.log(`입력 줄: ${end.log.accepted.length}줄 · ${Buffer.byteLength(text)}바이트 (가장 바쁜 손)`)
  assert.ok(Buffer.byteLength(text) < 2000)
})

test('입력 번역은 sim 쪽 규칙을 지킨다 (난수·시계·삼각함수·DOM 없음)', () => {
  const dir = path.resolve(import.meta.dirname, '../../src/field')
  for (const f of ['input.ts', 'pickmodel.ts']) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*')).join('\n')
    assert.deepEqual(text.match(/Math\.(random|sin|cos|atan2?|hypot|sqrt)|Date\.now|performance\.now|\bdocument\b|\bwindow\b|localStorage/g) ?? [], [], f)
  }
})
