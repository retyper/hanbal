import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createField, runField, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { ambushMap, crossMap, groundAt, holdMap, stakeMap } from '../../src/field/map.ts'
import { P, SPEC } from '../../src/tune/params.ts'
import { G_SHALLOW } from '../../src/field/types.ts'
import type { FieldMap, FieldState, Squad } from '../../src/field/types.ts'
import { assertInts, finish, keepOnly, MAPS, pick, place, run, U } from './kit.ts'

const SPEC_HZ_MIN = SPEC.field.hz.min
const M = (x: number): number => Math.round(x * 1000)
const mulK = (v: number, k: number): number => Math.trunc(v * k / 1000)

test('맞물림: 앞줄은 맞붙는 거리의 적 앞줄과 맞물려 지나쳐 걷지 못하고 손으로 몰면 풀린다', () => {
  const s = createField(plainSetup(1, 1300, false))
  const A = pick(s, 0, 'front'), B = pick(s, 1, 'front')
  keepOnly(s, [A, B])
  place(A, 50, 20); place(B, 52, 20) // 몸이 맞닿는 거리 (깊이 2 + 2 의 반)
  Object.assign(A, { manual: 0, goal: { u: U(100), v: U(20) }, target: B.id }); Object.assign(B, { manual: 0 })
  const u0 = A.u
  run(s, 10)
  assert.equal(A.lock, B.id)
  assert.equal(B.lock, A.id)
  assert.equal(A.u, u0, '맞물린 대는 걷지 않는다')
  // 몸이 있어 적 쪽으로는 못 뚫는다 — 손으로 뒤로 몰면 한 걸음 빠져나간다
  A.manual = 1; A.goal = { u: 0, v: U(20) }
  run(s, 1)
  assert.equal(u0 - A.u, Math.trunc(P.field.speedFrontCellsPerSec * P.field.unit / P.field.hz), '손으로 몰면 한 걸음 빠져나간다')
})

test('기병은 맞물리지 않는다 (옆으로 돌아간다)', () => {
  const s = createField(plainSetup(1, 1300, false))
  const H = pick(s, 0, 'horse'), B = pick(s, 1, 'front')
  keepOnly(s, [H, B])
  place(H, 50, 20); place(B, 52.5, 20) // 몸이 맞닿는 거리 (기병 깊이 3 · 앞줄 2 의 반)
  run(s, 1)
  assert.equal(H.lock, -1)
  assert.equal(B.lock, H.id, '앞줄은 적 기병과 맞물린다')
})

test('돕기: 같은 편 앞줄이 맞물려 있으면 가까이 놀고 있는 앞줄의 목표가 정확히 그 적의 자리다', () => {
  const s = createField(plainSetup(1, 1300, false))
  const A1 = pick(s, 0, 'front', 0), A2 = pick(s, 0, 'front', 1), B = pick(s, 1, 'front', 0), far = pick(s, 1, 'front', 1)
  keepOnly(s, [A1, A2, B, far])
  place(A1, 50, 20); place(B, 51, 20); place(A2, 46, 26); place(far, 60, 38)
  for (const q of [A1, B, A2, far]) q.manual = 0
  run(s, 8)
  assert.deepEqual(A2.goal, { u: B.u, v: B.v }, '목표가 맞물린 적이다 (가까운 적 far 이 아니라)')
  assert.equal(B.lock, A1.id)
})

test('맞쏘기: 활은 우리 편을 쏘는 적 활을 앞줄보다 먼저 겨눈다 (깎인 양이 셈과 같다)', () => {
  const s = createField(plainSetup(1, 1300, false))
  const a = pick(s, 0, 'bows'), bw = pick(s, 1, 'bows'), bf = pick(s, 1, 'front'), a2 = pick(s, 0, 'front')
  keepOnly(s, [a, bw, bf, a2])
  place(a, 50, 20); place(bf, 53, 20); place(bw, 60, 20); place(a2, 40, 20)
  const before = { bf: bf.hp, bw: bw.hp }
  run(s, 1)
  // 적 활(bw)은 우리 앞줄 a2(20칸)가 아니라 가까운 a(10칸)를 쏘고 있다 → a 는 적 활을 먼저 쏜다
  const v = mulK(mulK(a.menMax * P.field.powerPerSec, M(P.realm.tacGrpBows)), M(P.realm.tacTakenVolley))
  assert.equal(before.bw - bw.hp, Math.trunc(v / (1000 * P.field.hz)), '적 활이 a 한 대의 화살만큼 맞았다')
  assert.equal(bf.hp, before.bf, '앞줄은 안 맞았다')
})

test('잠든 대: 움직이지도 치지도 않고 맞으면 깨고 첫 칼은 깬 뒤 edgeSec 동안 edgeMulPermille 만큼 더 아프다', () => {
  const s = createField(plainSetup(1, 1300, false, ambushMap(true)))
  const sleepers = s.squads.filter(q => q.side === 1)
  assert.ok(sleepers.every(q => q.sleep === P.field.asleepSec * P.field.hz))
  const u0 = new Map(sleepers.map(q => [q, [q.u, q.v]]))
  run(s, 5)
  for (const q of sleepers) if (q.sleep > 0) assert.deepEqual([q.u, q.v], u0.get(q), '잠든 동안 안 걷는다')
  // 맞은 잠든 대는 깬다 · 첫 칼 배수
  const duel = (asleep: boolean): { A: Squad; B: Squad; s: FieldState } => {
    const t = createField(plainSetup(1, 1300, false, ambushMap(false)))
    const A = pick(t, 0, 'front'), B = pick(t, 1, 'front')
    keepOnly(t, [A, B]); place(A, 50, 20); place(B, 51, 20)
    if (asleep) B.sleep = 100
    return { A, B, s: t }
  }
  const sl = duel(true), aw = duel(false)
  run(sl.s, 1); run(aw.s, 1)
  assert.equal(sl.B.sleep, 0, '맞으면 깬다')
  assert.equal(sl.B.daze, P.field.edgeSec * P.field.hz - 1, '깬 뒤 edgeSec 동안 첫 칼')
  assert.equal(sl.A.hp, sl.A.menMax * 1000, '잠든 대는 못 친다')
  const r1 = (sl.B.menMax * 1000 - sl.B.hp) / (aw.B.menMax * 1000 - aw.B.hp)
  assert.ok(Math.abs(r1 - P.field.edgeMulPermille / 1000) < 0.01, `첫 틱 피해 배수 ${r1.toFixed(3)}`)
  // 깬 뒤에도 edgeSec 동안 배수가 남고 그 뒤로는 같다
  const lossOver = (d: { B: Squad; s: FieldState }, ticks: number): number => { const h0 = d.B.hp; run(d.s, ticks); return h0 - d.B.hp }
  const mid = lossOver(sl, 10) / lossOver(aw, 10)
  assert.ok(mid > (P.field.edgeMulPermille / 1000) * 0.93, `깬 뒤 배수 ${mid.toFixed(3)}`)
  run(sl.s, P.field.edgeSec * P.field.hz); run(aw.s, P.field.edgeSec * P.field.hz)
  assert.equal(sl.B.daze, 0)
  const late = lossOver(sl, 5) / lossOver(aw, 5)
  assert.ok(late < 1.1, `edgeSec 뒤에는 배수가 없다 ${late.toFixed(3)}`)
})

test('건너는 쪽 약화: 얕은 물 위에 선 대는 tacFordCharge 만큼 약하게 친다', () => {
  const cm = crossMap()
  const water = cm.camps[1].u - P.field.streamFromFrontCells - 1
  const dmg = (u: number, v: number, map: FieldMap): number => {
    const s = createField(plainSetup(1, 1300, false, map))
    const A = pick(s, 0, 'front'), B = pick(s, 1, 'front')
    keepOnly(s, [A, B]); place(A, u, v); place(B, u + 1, v)
    const hp = B.hp
    run(s, 1)
    return hp - B.hp
  }
  const r = dmg(water, 13, cm) / dmg(40, 13, cm)
  assert.ok(Math.abs(r - P.realm.tacFordCharge) <= 0.02, `물 위 배수 ${r.toFixed(3)}`)
})

test('진영은 적이 진영 앞줄 선을 넘어 실제로 들어왔을 때 한 번 무너진다', () => {
  const s = createField(plainSetup(1, 1300, false, holdMap()))
  const A = pick(s, 0, 'front'), B = pick(s, 1, 'front')
  keepOnly(s, [A, B]); place(A, s.map.camps[1].u - 2, s.map.camps[1].v); place(B, 60, 20)
  run(s, 1)
  assert.equal(s.broken[1], 0, '앞줄 선 앞에 선 것만으로는 안 무너진다')
  place(A, s.map.camps[1].u + 1, s.map.camps[1].v)
  run(s, 1)
  assert.equal(s.broken[1], 1)
  assert.equal(B.shock, P.field.campBreakMoraleLoss)
  run(s, 1)
  assert.equal(B.shock, P.field.campBreakMoraleLoss, '한 번뿐')
})

test('지키는 편은 먼저 나가지 않고, 깨면 편 전체가 나서며, 시작 자리에서 leashCells 밖으로는 한 틱도 안 나간다 (밀어내기 뒤에도)', () => {
  const s = createField(plainSetup(1, 1300, true, holdMap()))
  const homes = s.squads.filter(q => q.side === 1).map(q => [q.u, q.v])
  run(s, 20)
  assert.deepEqual(s.squads.filter(q => q.side === 1).map(q => [q.u, q.v]), homes, '멀리서는 안 나간다')
  const r2 = U(P.field.leashCells) ** 2
  let moved = 0, worst = 0
  for (const [name, mk] of MAPS) {
    if (!mk().camps[1].hold) continue
    for (let seed = 1; seed <= 6; seed++) {
      // 우리 편을 손으로 지키는 편 가까이 몰아 밀어내기·돕기가 섞이게 한다
      const t = createField(plainSetup(seed, 1300, true, mk()))
      const inputs = [0, 1, 2].map(g => ({ tick: 3, g: g as 0 | 1 | 2, op: 0, u: U(t.map.camps[1].u - 3), v: U(10 + g * 10) }))
      while (t.end === null) {
        stepField(t, inputs.filter(i => i.tick === t.tick))
        for (const q of t.squads) if (q.side === 1) {
          const d = (q.u - q.homeU) ** 2 + (q.v - q.homeV) ** 2
          worst = Math.max(worst, d / r2)
          assert.ok(d <= r2, `${name} ${seed} 대 ${q.id} 한계 밖 ${Math.sqrt(d) / U(1)}칸`)
        }
      }
      assertInts(t, name)
      moved += t.squads.filter(q => q.side === 1 && q.u !== q.homeU).length
    }
  }
  assert.ok(moved > 0, '적이 오면 나간다')
  assert.ok(worst > 0, '시작 자리에서 나간 대가 있다')
})

test('지키는 편 발동은 편 단위: 한 대에 적이 닿으면 멀리 있는 같은 편 대도 나선다', () => {
  const s = createField(plainSetup(1, 1300, false, holdMap()))
  const A = pick(s, 0, 'front'), B1 = pick(s, 1, 'front', 0), B2 = pick(s, 1, 'front', 3)
  keepOnly(s, [A, B1, B2])
  const home2 = [B2.u, B2.v]
  for (const q of [B1, B2]) q.manual = 0
  place(A, s.map.camps[1].u - 15, Math.trunc(B1.v / U(1)), 300)
  run(s, 6)
  assert.notDeepEqual([B2.u, B2.v], home2, '멀리 있는 대도 움직였다')
})

test('개울의 지키는 편은 물가에서 멈춘다 (얕은 물·물 너머로 안 들어간다)', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const s = createField(plainSetup(seed, 1300, true, crossMap()))
    const far = s.map.camps[1].u - P.field.streamFromFrontCells
    while (s.end === null) {
      stepField(s)
      for (const q of s.squads) if (q.side === 1 && q.men > 0) {
        assert.notEqual(groundAt(s.map, q.u, q.v), G_SHALLOW, `seed ${seed} 대 ${q.id} 물에 들었다`)
        assert.ok(q.u >= U(far), `seed ${seed} 대 ${q.id} 물 너머 ${q.u / U(1)}`)
      }
    }
    assertInts(s)
  }
})

test('같은 편 대끼리는 겹치지 않게 서로 밀어낸다 (한 점에 겹쳐도 · 손으로 한 곳에 몬 무리도)', () => {
  const s = createField(plainSetup(1, 1300, false))
  const A = pick(s, 0, 'front', 0), A2 = pick(s, 0, 'front', 1)
  keepOnly(s, [A, A2, pick(s, 1, 'front')])
  place(A, 50, 20); place(A2, 50, 20)
  run(s, 60)
  const d2 = (A.u - A2.u) ** 2 + (A.v - A2.v) ** 2
  assert.ok(d2 >= U(P.field.sepCells) ** 2 * 0.9, '떨어졌다')
  // 손으로 한 자리에 몬 무리는 시작 줄 모양대로 서고, 서로 sepCells 안으로 겹치지 않는다
  const t = runField(plainSetup(3, 1300, false), [{ tick: 1, g: 0, op: 0, u: U(50), v: U(20) }], 400)
  const front = t.squads.filter(q => q.side === 0 && q.grp === 'front')
  for (const a of front) for (const b of front) if (a !== b) assert.ok((a.u - b.u) ** 2 + (a.v - b.v) ** 2 >= U(P.field.sepCells) ** 2, `대 ${a.id}·${b.id} 가 겹쳤다`)
  assert.equal(new Set(front.map(q => `${q.goal!.u},${q.goal!.v}`)).size, front.length, '목표가 대마다 다르다')
})

/**
 * hz 는 10 으로 못 박는다 (P.field.hz 의 고를 수 있는 아래 끝이 10). 5Hz 는 기병 한 걸음이 1칸을 넘는 굵은 걸음이라
 * 대로 한 판이 10Hz 보다 약 19% 길었다 (40판 · tools/out/f2c/hz2.ts) — 고를 수 있는 hz 10·20·30 전부를 견준다.
 */
test('hz 10·20·30 에서 한 판 길이가 같고(±10%) 목책을 깨는 시간은 hz 5~30 에서 같다(±5%) — 씨앗 여럿 · 대로·평지 지킴·목책', () => {
  assert.equal(SPEC_HZ_MIN, 10, 'hz 의 아래 끝')
  const was = P.field.hz
  const at = <T>(hz: number, fn: () => T): T => { (P.field as { hz: number }).hz = hz; try { return fn() } finally { (P.field as { hz: number }).hz = was } }
  for (const [name, mk] of MAPS.filter(([n]) => n === 'meet' || n === 'hold' || n === 'stake')) {
    // 목책은 문이 깨지느냐로 판 길이가 두 갈래라 씨앗 12개로는 흔들림이 ±10% 를 넘는다 (C2 · 장수 곁의 기운으로 판이 길어진 뒤 12씨앗 65.5/78.9초 · 48씨앗 73.4/72.6초) → 48
    const N = name === 'stake' ? 48 : 12
    const secs = (hz: number): number => at(hz, () => { let t = 0; for (let seed = 1; seed <= N; seed++) t += runField(plainSetup(seed, 1300, true, mk())).tick / hz; return t / N })
    const base = secs(10)
    for (const hz of [20, 30]) { const x = secs(hz); assert.ok(Math.abs(x - base) / base < 0.1, `${name} ${hz}Hz ${x.toFixed(1)}초 · 10Hz ${base.toFixed(1)}초`) }
  }
  // 문 하나를 한 대가 깬다 — 사람 150 · 400 · 1300 × hz 5/10/20/30
  for (const men of [150, 400, 1300]) {
    const breakSec = (hz: number): number => at(hz, () => {
      const s = createField(plainSetup(1, 300, false, stakeMap()))
      const gate = s.map.pieces.find(p => p.kind === 'gate')!
      const q = pick(s, 0, 'front'), d = pick(s, 1, 'front')
      keepOnly(s, [q, d])
      place(q, gate.u0 - 1, (gate.v0 + gate.v1) / 2, men); place(d, s.map.u - 2, 2)
      let t = 0
      while (gate.hp > 0 && s.end === null) { stepField(s); t++ }
      assert.equal(gate.hp, 0)
      return t / hz
    })
    const base = breakSec(10)
    for (const hz of [5, 20, 30]) { const x = breakSec(hz); assert.ok(Math.abs(x - base) / base <= 0.05, `${men}명 ${hz}Hz 문 ${x.toFixed(1)}초 · 10Hz ${base.toFixed(1)}초`) }
  }
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

test('편 사기는 오르지 않고 사람 수는 틱마다 늘지 않는다 (모든 맵 · 장수 있음/없음)', () => {
  for (const [name, mk] of MAPS) for (const hero of [true, false]) for (let seed = 1; seed <= 4; seed++) {
    const s = createField(plainSetup(seed, seed % 2 ? 600 : 2100, hero, mk()))
    let prev = [Infinity, Infinity]
    const men = s.squads.map(q => q.men)
    while (s.end === null) {
      stepField(s)
      for (const side of [0, 1]) {
        const qs = s.squads.filter(q => q.side === side)
        const tot = qs.reduce((a, q) => a + q.menMax, 0)
        const mor = qs.reduce((a, q) => a + q.menMax * q.morale, 0) / tot
        assert.ok(mor <= prev[side]! + 1e-9, `${name} seed ${seed} 편 ${side} 사기가 올랐다`)
        prev[side] = mor
      }
      s.squads.forEach((q, i) => { assert.ok(q.men <= men[i]!, `${name} 사람이 늘었다`); men[i] = q.men })
    }
    assertInts(s, name)
  }
})

test('9,000명 판이 시간 끝까지 가도 정수 범위 안이다', () => {
  const s = createField(plainSetup(3, 9000))
  for (const q of s.squads) { q.manual = 1; q.goal = null }
  // 장수도 세워 둔다 (C2 부터 입력 없는 장수는 적 쪽으로 걸어가 칼을 쓴다 — 이 시험은 맞붙지 않는 판의 정수 범위를 본다)
  for (const h of s.heroes) { h.manual = 1; h.goal = null }
  finish(s)
  assert.equal(s.end, 'time')
  assert.equal(s.winner, -1)
})

test('목책 마디: 곁에 선 적이 깎아 부수면 그 칸이 열린다', () => {
  const st = stakeMap()
  const s = createField(plainSetup(1, 1300, false, st))
  const seg = s.map.pieces.find(p => p.kind === 'stake')!
  const q = pick(s, 0, 'front')
  keepOnly(s, [q, pick(s, 1, 'front')])
  place(q, seg.u0 - 1, seg.v0 + 1, 1300)
  for (let i = 0; i < 3000 && seg.hp > 0; i++) stepField(s)
  assert.equal(seg.hp, 0)
  assert.equal(s.map.cells[seg.u0 * s.map.w + seg.v0], 0)
  assert.equal(st.cells[seg.u0 * st.w + seg.v0], 3, '원래 지도는 그대로')
  assertInts(s)
})

test('목책 체력은 치는 편 사람 수에 비례한다 (1,000명마다 gateHp · stakeHp)', () => {
  for (const men of [600, 1300, 2100]) {
    const s = createField(plainSetup(1, men, false, stakeMap()))
    const att = s.squads.filter(q => q.side === 0).reduce((a, q) => a + q.men, 0)
    assert.equal(s.map.pieces.find(p => p.kind === 'gate')!.hp, Math.trunc(P.field.gateHp * att / 1000))
    assert.equal(s.map.pieces.find(p => p.kind === 'stake')!.hp, Math.trunc(P.field.stakeHp * att / 1000))
  }
})

test('잠든 대는 목책을 깎지 않는다', () => {
  const s = createField(plainSetup(1, 1300, false, stakeMap()))
  const gate = s.map.pieces.find(p => p.kind === 'gate')!
  const q = pick(s, 0, 'front')
  keepOnly(s, [q, pick(s, 1, 'front')])
  place(q, gate.u0 - 1, (gate.v0 + gate.v1) / 2, 1300)
  q.sleep = 50
  const hp = gate.hp
  run(s, 20)
  assert.equal(gate.hp, hp)
})
