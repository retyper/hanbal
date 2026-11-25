import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { P } from '../../src/tune/params.ts'
import { CMDS, cmdInput, mergePlan, sendInputs, type InputCtx } from '../../src/field/input.ts'
import { boxPick, normalizeSel, pickAt, type PickCand } from '../../src/field/pickmodel.ts'
import { actionOf, KEYS, type ActionName } from '../../src/field/actions.ts'
import { parse, serialize } from '../../src/field/rec.ts'
import { createField, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { readField } from '../../src/field/viewRead.ts'
import { OP_AUTO, OP_MOVE, OP_STANCE, STANCE_CHARGE, STANCE_HOLD, STANCE_OPEN, type FieldInput } from '../../src/field/types.ts'

const U = P.field.unit
const ctx = (o: Partial<InputCtx> = {}): InputCtx => ({ tick: 100, mapUUnits: 160 * U, mapVUnits: 40 * U, ...o })

test('장수를 움직이는 데 입력 하나: 처음부터 장수가 골라져 있으니 땅을 한 번 누르면 간다', () => {
  const s = createField(plainSetup(3, 1200))
  const m = readField(s)
  const sel = normalizeSel(m, [3])
  assert.deepEqual(sel, [3])
  const out = sendInputs(sel, 70 * U, 20 * U, ctx({ tick: 0 }))
  assert.deepEqual(out, [{ tick: 0, g: 3, op: OP_MOVE, u: 70 * U, v: 20 * U }])
  stepField(s, out)
  assert.equal(s.log.dropped, 0)
  const h = s.heroes.find(e => e.side === 0)!
  assert.deepEqual([h.goal?.u, h.goal?.v, h.manual], [70 * U, 20 * U, 1])
})

test('무리를 보내는 데 입력 둘: 눌러서 고르기 + 찍어서 보내기', () => {
  const cands: PickCand[] = [{ g: 2, x: 200, y: 120, reach: 20 }, { g: 3, x: 400, y: 120, reach: 0 }]
  const picked = pickAt(cands, 205, 125, P.field.pickRadiusPx, P.field.heroPickPermille)
  assert.equal(picked, 2)
  const out = sendInputs([picked as 2], 90 * U, 10 * U, ctx())
  assert.deepEqual(out.map(i => [i.g, i.op, i.u, i.v]), [[2, OP_MOVE, 90 * U, 10 * U]])
  // 네모로 한꺼번에 고르면 무리마다 입력 하나씩 · 사람의 입력은 그대로 둘 (네모 + 찍기)
  const many = sendInputs(boxPick([{ g: 0, x: 10, y: 10, reach: 0 }, { g: 1, x: 20, y: 20, reach: 0 }, { g: 2, x: 30, y: 30, reach: 0 }], 0, 0, 50, 50), 5 * U, 5 * U, ctx())
  assert.deepEqual(many.map(i => i.g), [0, 1, 2])
})

test('보낼 때 명령 수·다시 몰기 제한이 없다: 같은 무리를 연달아 몰아도 모두 나간다', () => {
  let n = 0
  for (let tick = 0; tick < 40; tick++) n += sendInputs([0], (20 + tick) * U, 10 * U, ctx({ tick })).length
  assert.equal(n, 40)
})

test('맵 밖을 눌러도 맵 안으로 붙는다', () => {
  const r = sendInputs([0], -500, 99999 * U, ctx())
  assert.deepEqual([r[0]!.u, r[0]!.v], [0, 40 * U])
})

test('명령 단추: 누르면 그 무리의 그 명령 · 지금 명령을 다시 누르면 알아서 (OP_AUTO)', () => {
  assert.deepEqual(cmdInput(0, 0, -1, ctx()), { tick: 100, g: 0, op: OP_STANCE, u: STANCE_CHARGE, v: 0 })
  assert.equal(cmdInput(0, 1, 0, ctx()).u, STANCE_HOLD)
  assert.equal(cmdInput(0, 2, 1, ctx()).u, STANCE_OPEN)
  assert.deepEqual(cmdInput(0, 1, 1, ctx()), { tick: 100, g: 0, op: OP_AUTO, u: 0, v: 0 })
  assert.deepEqual(cmdInput(2, 3, -1, ctx()), { tick: 100, g: 2, op: OP_STANCE, u: 3, v: 0 })
})

test('무리마다 제 명령: 앞줄 셋 · 활 둘 · 기병 넷 (본편 전투 화면의 이름)', () => {
  assert.deepEqual(CMDS, [['charge', 'hold', 'open'], ['volley', 'counter'], ['flank', 'punch', 'pursue', 'guard']])
})

test('시작 화면에 꽂아 둔 것: 같은 무리의 같은 갈래는 바뀌고 · 알아서는 그 무리를 비운다', () => {
  let plan: FieldInput[] = []
  plan = mergePlan(plan, sendInputs([0, 1], 30 * U, 5 * U, ctx({ tick: 0 })))
  plan = mergePlan(plan, [cmdInput(0, 1, -1, ctx({ tick: 0 }))])
  assert.equal(plan.length, 3)
  plan = mergePlan(plan, sendInputs([0], 40 * U, 8 * U, ctx({ tick: 0 })))
  assert.equal(plan.filter(i => i.g === 0 && i.op === OP_MOVE).length, 1)
  assert.equal(plan.find(i => i.g === 0 && i.op === OP_MOVE)!.u, 40 * U)
  assert.ok(plan.some(i => i.g === 0 && i.op === OP_STANCE), '자리를 바꿔도 자세는 남는다')
  plan = mergePlan(plan, [cmdInput(0, 1, 1, ctx({ tick: 0 }))])
  assert.deepEqual(plan.filter(i => i.g === 0).map(i => i.op), [OP_AUTO])
  assert.equal(plan.filter(i => i.g === 1).length, 1)
})

test('입력 줄 기록 왕복 (직렬화 → 읽기 → 같은 입력)', () => {
  const inputs: FieldInput[] = []
  for (const g of [0, 1, 2, 3] as const) inputs.push(...sendInputs([g], (30 + g) * U, (8 + g) * U, ctx({ tick: 12 * g })))
  inputs.push(cmdInput(2, 1, -1, ctx({ tick: 50 })))
  assert.deepEqual(parse(serialize(inputs)), inputs)
})

test('번역한 입력이 엔진에서 받아들여져 자리와 자세가 바뀐다', () => {
  const s = createField(plainSetup(3, 1200))
  stepField(s, [...sendInputs([0], 70 * U, 20 * U, ctx({ tick: 0 })), cmdInput(0, 2, -1, ctx({ tick: 0 }))])
  const front = s.squads.filter(q => q.side === 0 && q.grp === 'front')
  assert.ok(front.every(q => q.stance === STANCE_OPEN && q.manual === 1))
  assert.equal(s.log.dropped, 0)
})

test('조작표: 키마다 동작이 하나이고 (겹침 없음) · 이름으로 되짚는다', () => {
  const seen = new Map<string, ActionName>()
  for (const name of Object.keys(KEYS) as ActionName[]) {
    for (const code of KEYS[name]) {
      assert.ok(!seen.has(code), `${code} 가 ${seen.get(code)} 와 ${name} 에 겹침`)
      seen.set(code, name)
      assert.equal(actionOf(code), name)
    }
  }
  assert.deepEqual([KEYS.pickHero, KEYS.pickFront, KEYS.pickBows, KEYS.pickHorse, KEYS.pickAll], [['Digit1'], ['Digit2'], ['Digit3'], ['Digit4'], ['Backquote']])
  assert.deepEqual([KEYS.cmd1, KEYS.cmd2, KEYS.cmd3, KEYS.cmd4], [['KeyZ'], ['KeyX'], ['KeyC'], ['KeyV']])
  assert.equal(actionOf('F13'), null)
})

test('화면 글에 명령 수 제한 말이 없다 (명령을 다 썼습니다 · 방금 움직였습니다)', () => {
  const root = path.resolve(import.meta.dirname, '../..')
  const files = ['src/i18n/ko.ts', 'src/i18n/en.ts', 'src/field-main.ts', ...fs.readdirSync(path.join(root, 'src/field')).filter(f => f.startsWith('main') || f === 'input.ts' || f === 'pickmodel.ts').map(f => `src/field/${f}`)]
  for (const f of files) {
    const text = fs.readFileSync(path.join(root, f), 'utf8')
    assert.ok(!/명령을 다 썼|방금 움직였|No orders left|just moved/.test(text), f)
  }
})

test('입력 번역은 sim 쪽 규칙을 지킨다 (난수·시계·삼각함수·DOM 없음)', () => {
  const dir = path.resolve(import.meta.dirname, '../../src/field')
  for (const f of ['input.ts', 'pickmodel.ts', 'actions.ts']) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*')).join('\n')
    assert.deepEqual(text.match(/Math\.(random|sin|cos|atan2?|hypot|sqrt)|Date\.now|performance\.now|\bdocument\b|\bwindow\b|localStorage/g) ?? [], [], f)
  }
})
