import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createField, runField, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { ambushMap, crossMap, holdMap, stakeMap } from '../../src/field/map.ts'
import { P } from '../../src/tune/params.ts'
import type { FieldMap, FieldState, Grp, Squad } from '../../src/field/types.ts'

const U = (cells: number): number => cells * P.field.unit

/** 지정한 대만 남기고 나머지는 지운다 (menMax 도 0 — 편 사기 평균에 안 들어가게) */
function only(s: FieldState, keep: Squad[]): void {
  for (const q of s.squads) if (!keep.includes(q)) { q.men = 0; q.hp = 0; q.menMax = 0 }
}
const pick = (s: FieldState, side: 0 | 1, grp: Grp, i = 0): Squad => s.squads.filter(q => q.side === side && q.grp === grp)[i]!
const place = (q: Squad, u: number, v: number, men = 500): void => { Object.assign(q, { u: U(u), v: U(v), men, menMax: men, hp: men * 1000, goal: null, manual: 1, stance: 1 }) }

test('맞물림: 앞줄은 맞붙는 거리의 적 앞줄과 맞물려 지나쳐 걷지 못하고 손으로 몰면 풀린다', () => {
  const s = createField(plainSetup(1, 1300, false))
  const A = pick(s, 0, 'front'), B = pick(s, 1, 'front')
  only(s, [A, B])
  place(A, 50, 20); place(B, 51, 20)
  Object.assign(A, { manual: 0, goal: { u: U(100), v: U(20) }, target: B.id }); Object.assign(B, { manual: 0 })
  const u0 = A.u
  for (let i = 0; i < 10; i++) stepField(s)
  assert.equal(A.lock, B.id)
  assert.equal(B.lock, A.id)
  assert.equal(A.u, u0, '맞물린 대는 걷지 않는다')
  A.manual = 1
  stepField(s)
  assert.ok(A.u > u0, '손으로 몰면 빠져나간다')
})

test('기병은 맞물리지 않는다 (옆으로 돌아간다)', () => {
  const s = createField(plainSetup(1, 1300, false))
  const H = pick(s, 0, 'horse'), B = pick(s, 1, 'front')
  only(s, [H, B])
  place(H, 50, 20); place(B, 51, 20)
  stepField(s)
  assert.equal(H.lock, -1)
  assert.equal(B.lock, H.id, '앞줄은 적 기병과 맞물린다')
})

test('돕기: 같은 편 앞줄이 맞물려 있으면 가까이 놀고 있는 앞줄이 그 적에게 간다', () => {
  const s = createField(plainSetup(1, 1300, false))
  const A1 = pick(s, 0, 'front', 0), A2 = pick(s, 0, 'front', 1), B = pick(s, 1, 'front', 0), far = pick(s, 1, 'front', 1)
  only(s, [A1, A2, B, far])
  place(A1, 50, 20); place(B, 51, 20); place(A2, 46, 26); place(far, 60, 38)
  for (const q of [A1, B, A2, far]) q.manual = 0
  for (let i = 0; i < 8; i++) stepField(s)
  assert.ok(A2.goal !== null && Math.abs(A2.goal.u - B.u) < U(1) && Math.abs(A2.goal.v - B.v) < U(1), '목표가 맞물린 적이다')
})

test('맞쏘기: 활은 우리 편을 쏘는 적 활을 앞줄보다 먼저 겨눈다', () => {
  const s = createField(plainSetup(1, 1300, false))
  const a = pick(s, 0, 'bows'), bw = pick(s, 1, 'bows'), bf = pick(s, 1, 'front'), a2 = pick(s, 0, 'front')
  only(s, [a, bw, bf, a2])
  place(a, 50, 20); place(bf, 53, 20); place(bw, 60, 20); place(a2, 40, 20)
  const before = { bf: bf.hp, bw: bw.hp }
  stepField(s)
  // 적 활(bw)은 우리 앞줄 a2(20칸)가 아니라 가까운 a(10칸)를 쏘고 있다 → a 는 적 활을 먼저 쏜다
  assert.ok(bw.hp < before.bw, '적 활이 맞았다')
  assert.equal(bf.hp, before.bf, '앞줄은 안 맞았다')
})

test('잠든 대: 움직이지도 치지도 않고 맞으면 깨고 첫 칼은 더 아프다', () => {
  const s = createField(plainSetup(1, 1300, false, ambushMap(true)))
  const sleepers = s.squads.filter(q => q.side === 1)
  assert.ok(sleepers.every(q => q.sleep === P.field.asleepSec * P.field.hz))
  const u0 = sleepers.map(q => q.u)
  for (let i = 0; i < 5; i++) stepField(s)
  assert.deepEqual(sleepers.map(q => q.u), u0, '잠든 동안 안 걷는다')
  // 맞은 잠든 대는 깬다 · 첫 칼 배수
  const t = createField(plainSetup(1, 1300, false, ambushMap(true)))
  const A = pick(t, 0, 'front'), B = pick(t, 1, 'front')
  only(t, [A, B]); place(A, 50, 20); place(B, 51, 20)
  B.sleep = 100
  const awake = createField(plainSetup(1, 1300, false, ambushMap(false)))
  const A2 = pick(awake, 0, 'front'), B2 = pick(awake, 1, 'front')
  only(awake, [A2, B2]); place(A2, 50, 20); place(B2, 51, 20)
  stepField(t); stepField(awake)
  assert.equal(B.sleep, 0, '맞으면 깬다')
  assert.ok(A.hp === A.menMax * 1000, '잠든 대는 못 친다')
  assert.ok(B.hp < B2.hp, '잠든 대가 더 아프게 맞는다 (첫 칼)')
})

test('건너는 쪽 약화: 얕은 물 위에 선 대는 약하게 친다', () => {
  const cm = crossMap()
  const water = cm.camps[1].u - P.field.streamFromFrontCells - 1
  const dmg = (u: number, v: number, map: FieldMap): number => {
    const s = createField(plainSetup(1, 1300, false, map))
    const A = pick(s, 0, 'front'), B = pick(s, 1, 'front')
    only(s, [A, B]); place(A, u, v); place(B, u + 1, v)
    const hp = B.hp
    stepField(s)
    return hp - B.hp
  }
  assert.ok(dmg(water, 13, cm) < dmg(40, 13, cm), '물 위에서 약하다')
  assert.equal(Math.round(dmg(water, 13, cm) * 1000 / dmg(40, 13, cm)) / 1000 <= P.realm.tacFordCharge + 0.02, true)
})

test('진영이 무너지면 그 편 사기가 한 번 꺾인다', () => {
  const s = createField(plainSetup(1, 1300, false, holdMap()))
  const A = pick(s, 0, 'front'), B = pick(s, 1, 'front')
  only(s, [A, B]); place(A, s.map.camps[1].u - 3, s.map.camps[1].v); place(B, 60, 20)
  assert.equal(s.broken[1], 0)
  stepField(s)
  assert.equal(s.broken[1], 1)
  assert.equal(B.shock, P.field.campBreakMoraleLoss)
  stepField(s)
  assert.equal(B.shock, P.field.campBreakMoraleLoss, '한 번뿐')
})

test('지키는 편은 먼저 걸어 나가지 않고 적이 가까이 오면 맞서러 나간다', () => {
  const s = createField(plainSetup(1, 1300, true, holdMap()))
  const homes = s.squads.filter(q => q.side === 1).map(q => [q.u, q.v])
  for (let i = 0; i < 20; i++) stepField(s)
  assert.deepEqual(s.squads.filter(q => q.side === 1).map(q => [q.u, q.v]), homes, '멀리서는 안 나간다')
  const r = runField(plainSetup(1, 1300, true, holdMap()))
  assert.ok(r.squads.some(q => q.side === 1 && q.u !== q.homeU), '적이 오면 나간다')
  assert.ok(r.squads.filter(q => q.side === 1).every(q => Math.abs(q.u - q.homeU) <= U(P.field.leashCells) + 1), '시작 자리에서 leashCells 안')
})

test('같은 편 대끼리는 겹치지 않게 서로 밀어낸다', () => {
  const s = createField(plainSetup(1, 1300, false))
  const A = pick(s, 0, 'front', 0), A2 = pick(s, 0, 'front', 1)
  only(s, [A, A2, pick(s, 1, 'front')])
  place(A, 50, 20); place(A2, 50, 20)
  for (let i = 0; i < 30; i++) stepField(s)
  const d2 = (A.u - A2.u) ** 2 + (A.v - A2.v) ** 2
  assert.ok(d2 >= U(P.field.sepCells) ** 2 * 0.9, '떨어졌다')
})

test('hz 를 바꿔도 한 판 길이가 비슷하다 (초당 값을 틱당으로 환산)', () => {
  const secs = (hz: number): number => {
    const was = P.field.hz
    ;(P.field as { hz: number }).hz = hz
    try { const s = runField(plainSetup(7, 1300)); return s.tick / hz } finally { (P.field as { hz: number }).hz = was }
  }
  const a = secs(10), b = secs(20)
  assert.ok(Math.abs(a - b) / a < 0.2, `10Hz ${a.toFixed(1)}초 · 20Hz ${b.toFixed(1)}초`)
})

test('시작 판 검증: 사기는 0~1000 정수 · 지도는 정수와 맞는 칸 수 · 아니면 invalid', () => {
  const ok = plainSetup(1, 1300)
  const withMorale = (mo: number) => ({ ...ok, sides: [{ ...ok.sides[0], morale: mo }, ok.sides[1]] as typeof ok.sides })
  for (const bad of [1.5, NaN, -1, 1001, 700.5]) assert.equal(createField(withMorale(bad)).end, 'invalid', String(bad))
  assert.equal(createField(withMorale(0)).end, null)
  const badMap = { ...ok, map: { ...ok.map, cells: new Uint8Array(10) } }
  assert.equal(createField(badMap).end, 'invalid')
  assert.equal(createField({ ...ok, map: { ...ok.map, u: 160.5 } }).end, 'invalid')
})

test('편 사기는 오르지 않는다 (한 대가 몰살돼도 되오르지 않는다)', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const s = createField(plainSetup(seed, 600))
    let prev = [Infinity, Infinity]
    while (s.end === null) {
      stepField(s)
      for (const side of [0, 1]) {
        const qs = s.squads.filter(q => q.side === side)
        const tot = qs.reduce((a, q) => a + q.menMax, 0)
        const mor = qs.reduce((a, q) => a + q.menMax * q.morale, 0) / tot
        assert.ok(mor <= prev[side]! + 1e-9, `seed ${seed} 편 ${side} 사기가 올랐다`)
        prev[side] = mor
      }
    }
  }
})

test('9,000명 판이 시간 끝까지 가도 정수 범위 안이다', () => {
  const setup = plainSetup(3, 9000)
  const s = createField(setup)
  for (const q of s.squads) { q.manual = 1; q.goal = null }
  while (s.end === null) stepField(s)
  assert.equal(s.end, 'time')
  assert.equal(s.winner, -1)
  for (const q of s.squads) for (const n of [q.hp, q.men, q.menMax, q.morale]) assert.ok(Number.isSafeInteger(n) && Math.abs(n) < 2 ** 31)
})

test('목책 마디: 곁에 선 적이 깎아 부수면 그 칸이 열린다', () => {
  const st = stakeMap()
  const s = createField(plainSetup(1, 1300, false, st))
  const seg = s.map.pieces.find(p => p.kind === 'stake')!
  const q = pick(s, 0, 'front')
  only(s, [q, pick(s, 1, 'front')])
  place(q, seg.u0 - 1, seg.v0 + 1, 1300)
  for (let i = 0; i < 1500 && seg.hp > 0; i++) stepField(s)
  assert.equal(seg.hp, 0)
  assert.equal(s.map.cells[seg.u0 * s.map.w + seg.v0], 0)
  assert.equal(st.cells[seg.u0 * st.w + seg.v0], 3, '원래 지도는 그대로')
})
