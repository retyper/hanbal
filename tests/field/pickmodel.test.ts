import { test } from 'node:test'
import assert from 'node:assert/strict'
import { P } from '../../src/tune/params.ts'
import { createField, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { crossMap, highMap, stakeMap } from '../../src/field/map.ts'
import { readField, type VModel } from '../../src/field/viewRead.ts'
import { cellWhy, pickables, type UiState } from '../../src/field/pickmodel.ts'
import type { LiveSetup } from '../../src/field/types.ts'

const ui = (o: Partial<UiState> = {}): UiState => ({ phase: 'play', sel: -1, popup: false, ...o })

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
  ['장수 없음', model(full, false), ui(), 3],
  ['앞줄만 · 장수 없음', model({ front: 2000, bows: 0, horse: 0 }, false), ui(), 1],
  ['활이 다 쓰러짐', without(model(full), 'bows'), ui(), 3],
  ['칸을 골라 둠', model(full), ui({ sel: 1 }), 4],
  ['앞줄 칸 상자 열림', model(full), ui({ sel: 0, popup: true }), 4],
  ['활 칸 상자 열림', model(full), ui({ sel: 1, popup: true }), 1],
  ['장수 칸 상자 열림', model(full), ui({ sel: 3, popup: true }), 1],
  ['없는 칸의 상자 열림은 닫힌 것으로', model({ front: 2000, bows: 0, horse: 0 }), ui({ sel: 1, popup: true }), 2],
  ['목책 맵', model(full, true, 50, stakeMap()), ui(), 4],
  ['개울 맵', model(full, true, 50, crossMap()), ui(), 4],
  ['높은 터 맵', model(full, true, 50, highMap()), ui(), 4],
  ['끝난 판', { ...model(full, true, 10), end: 'morale' }, ui({ phase: 'end' }), 0],
]

test('모든 상태에서 고를 것이 pickMax(넷) 이하이다 · 열 가지 이상', () => {
  assert.ok(cases.length >= 10)
  let most = 0
  for (const [name, m, u, want] of cases) {
    const n = pickables(m, u).length
    assert.ok(n <= P.field.pickMax, `${name}: ${n}`)
    assert.equal(n, want, name)
    if (n > most) most = n
  }
  assert.equal(most, 4)
})

test('열린 상자 안은 그 칸의 것뿐이다 (자세 셋 + 알아서)', () => {
  const items = pickables(model(full), ui({ sel: 0, popup: true }))
  assert.deepEqual(items.map(i => i.id), ['stance0', 'stance1', 'stance2', 'auto'])
  assert.ok(items.every(i => i.g === 0))
})

test('칸마다 못 누르는 까닭을 말한다', () => {
  const m = model({ front: 1500, bows: 0, horse: 500 }, false)
  assert.equal(cellWhy(m, 0), null)
  assert.equal(cellWhy(m, 1), 'none')
  assert.equal(cellWhy(m, 3), 'none')
  assert.equal(cellWhy(without(model(full), 'horse'), 2), 'gone')
})

test('여러 씨앗·병력에서도 넷 이하 (300판)', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const men = 40 + (seed * 37) % 3000
    const s = createField(plainSetup(seed, men, seed % 5 !== 0))
    const m = readField(s)
    assert.ok(pickables(m, ui({ sel: (seed % 4) as 0 | 1 | 2 | 3, popup: seed % 2 === 0 })).length <= P.field.pickMax, `seed ${seed}`)
  }
})
