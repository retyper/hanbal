import { test } from 'node:test'
import assert from 'node:assert/strict'
import { P } from '../../src/tune/params.ts'
import { createField, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { crossMap, highMap, stakeMap } from '../../src/field/map.ts'
import { readField, type VModel } from '../../src/field/viewRead.ts'
import { boxPick, cellWhy, normalizeSel, pickAt, pickables, cmdGroup, type PickCand, type UiState } from '../../src/field/pickmodel.ts'
import type { InputGroup, LiveSetup } from '../../src/field/types.ts'

const ui = (o: Partial<UiState> = {}): UiState => ({ phase: 'play', sel: [3], ...o })
/** 한 번에 고를 칸 상한 (아래 칸 넷) */
const CELLS_MAX = 4

function model(men: { front: number; bows: number; horse: number }, withHero = true, ticks = 0, map = undefined as LiveSetup['map'] | undefined): VModel {
  const base = plainSetup(7, 2000, withHero, map)
  const setup: LiveSetup = { ...base, sides: [{ ...base.sides[0], men }, base.sides[1]] }
  const s = createField(setup)
  for (let i = 0; i < ticks && s.end === null; i++) stepField(s)
  return readField(s)
}
/** 우리 편 한 무리를 다 쓰러뜨린 것처럼 만든 읽기 모양 */
function without(m: VModel, grp: string): VModel {
  return { ...m, squads: m.squads.map(q => (q.side === 0 && q.grp === grp ? { ...q, men: 0 } : q)) }
}

const full = { front: 1000, bows: 500, horse: 500 }
const cases: Array<[string, VModel, UiState, number]> = [
  ['시작 화면 · 넷 다 있음', model(full), ui({ phase: 'ready' }), 4],
  ['싸움 100틱', model(full, true, 100), ui(), 4],
  ['싸움 400틱', model(full, true, 400), ui(), 4],
  ['활 없음', model({ front: 1500, bows: 0, horse: 500 }), ui(), 3],
  ['기병 없음', model({ front: 1500, bows: 500, horse: 0 }), ui(), 3],
  ['앞줄만', model({ front: 2000, bows: 0, horse: 0 }), ui(), 2],
  ['장수 없음', model(full, false), ui({ sel: [0] }), 3],
  ['앞줄만 · 장수 없음', model({ front: 2000, bows: 0, horse: 0 }, false), ui({ sel: [0] }), 1],
  ['활이 다 쓰러짐', without(model(full), 'bows'), ui(), 3],
  ['무리를 골라 둠', model(full), ui({ sel: [1] }), 4],
  ['앞줄·활 함께 고름', model(full), ui({ sel: [0, 1] }), 4],
  ['목책 맵', model(full, true, 50, stakeMap()), ui(), 4],
  ['개울 맵', model(full, true, 50, crossMap()), ui(), 4],
  ['높은 터 맵', model(full, true, 50, highMap()), ui(), 4],
  ['끝난 판', { ...model(full, true, 10), end: 'morale' }, ui({ phase: 'end' }), 0],
]

test('모든 상태에서 아래 칸은 넷 이하 · 열 가지 이상', () => {
  assert.ok(cases.length >= 10)
  let most = 0
  for (const [name, m, u, want] of cases) {
    const n = pickables(m, u).length
    assert.ok(n <= CELLS_MAX, `${name}: ${n}`)
    assert.equal(n, want, name)
    if (n > most) most = n
  }
  assert.equal(most, 4)
})

test('명령 단추는 고른 무리의 것: 앞줄 · 활 · 기병이 먼저 오고, 장수만 고르면 없다', () => {
  assert.equal(cmdGroup(model(full), ui({ sel: [0] })), 0)
  assert.equal(cmdGroup(model(full), ui({ sel: [1] })), 1)
  assert.equal(cmdGroup(model(full), ui({ sel: [2, 0] })), 2)
  assert.equal(cmdGroup(model(full), ui({ sel: [3] })), null)
  assert.equal(cmdGroup(without(model(full), 'front'), ui({ sel: [0] })), null)
  assert.equal(cmdGroup({ ...model(full, true, 10), end: 'morale' }, ui({ sel: [0], phase: 'end' })), null)
})

test('칸마다 못 누르는 까닭을 말한다', () => {
  const m = model({ front: 1500, bows: 0, horse: 500 }, false)
  assert.equal(cellWhy(m, 0), null)
  assert.equal(cellWhy(m, 1), 'none')
  assert.equal(cellWhy(m, 3), 'none')
  assert.equal(cellWhy(without(model(full), 'horse'), 2), 'gone')
})

test('아무것도 안 고른 상태는 없다: 쓰러진 것은 빠지고 비면 장수로 돌아온다', () => {
  const m = model(full)
  const same: readonly InputGroup[] = [0, 1]
  assert.equal(normalizeSel(m, same), same)
  assert.deepEqual(normalizeSel(without(m, 'bows'), [1]), [3])
  assert.deepEqual(normalizeSel(without(m, 'bows'), [0, 1]), [0])
  assert.deepEqual(normalizeSel(m, []), [3])
  const noHero = model(full, false)
  assert.deepEqual(normalizeSel(noHero, [3]), [0])
})

const cands: PickCand[] = [
  { g: 0, x: 100, y: 100, reach: 30 },
  { g: 1, x: 100, y: 190, reach: 30 },
  { g: 3, x: 110, y: 110, reach: 0 },
]
test('맵에서 누르기: 가장 가까운 것 · 장수는 겹쳐 서도 먼저 · 반경 밖은 없음', () => {
  const R = P.field.pickRadiusPx, H = P.field.heroPickPermille
  assert.equal(pickAt(cands, 106, 106, R, H), 3, '장수가 앞줄과 겹쳐 서도 장수가 먼저')
  assert.equal(pickAt(cands, 95, 190, R, H), 1)
  assert.equal(pickAt(cands, 100, 400, R, H), -1)
  assert.equal(pickAt(cands, 30, 100, R, H), 0, '몸집(reach)만큼 넓게 잡힌다')
  assert.equal(pickAt([], 5, 5, R, H), -1)
})

test('끌어서 네모: 든 무리 모두 · 장수는 무리가 없을 때만 · 빈 네모는 빈 줄', () => {
  assert.deepEqual(boxPick(cands, 50, 50, 150, 250), [0, 1])
  assert.deepEqual(boxPick(cands, 150, 250, 50, 50), [0, 1], '거꾸로 그려도 같다')
  assert.deepEqual(boxPick(cands, 105, 105, 120, 120), [3])
  assert.deepEqual(boxPick(cands, 300, 300, 400, 400), [])
})

test('여러 씨앗·병력에서도 아래 칸은 넷 이하 (300판)', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const men = 40 + (seed * 37) % 3000
    const s = createField(plainSetup(seed, men, seed % 5 !== 0))
    const m = readField(s)
    const sel = [(seed % 4) as InputGroup]
    assert.ok(pickables(m, ui({ sel })).length <= CELLS_MAX, `seed ${seed}`)
    assert.ok(normalizeSel(m, sel).length >= 1)
  }
})
