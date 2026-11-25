import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ambushMap, crossMap, groundAt, highMap, holdMap, mapFor, meetMap, stakeMap, walkable } from '../../src/field/map.ts'
import type { MapMeta } from '../../src/field/map.ts'
import { createField, runField as runFieldRaw, stepField } from '../../src/field/sim.ts'
import { hashField } from '../../src/field/state.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { G_BLOCK, G_HIGH, G_PLAIN, G_SHALLOW } from '../../src/field/types.ts'
import type { FieldMap, Squad } from '../../src/field/types.ts'
import { P } from '../../src/tune/params.ts'
import { assertInts, keepOnly, U as UK } from './kit.ts'
/** 끝 판 정수 검사를 거치는 runField */
const runField: typeof runFieldRaw = (...a) => { const s = runFieldRaw(...a); assertInts(s); return s }

const U = (cells: number): number => cells * P.field.unit
const MAPS: Array<[string, () => FieldMap]> = [['meet', meetMap], ['hold', holdMap], ['cross', crossMap], ['stake', stakeMap], ['high', highMap], ['ambush', () => ambushMap(true)], ['ambushFail', () => ambushMap(false)]]
const meta = (over: Partial<MapMeta> = {}, tags: MapMeta['tags'] = {}): MapMeta => ({ edgeKind: 'road', nodeKind: 'town', tags, approach: 'march', ambush: 'none', water: false, field: true, ...over })

test('다섯 맵(과 비교용 hold)이 끝까지 돌고 같은 씨앗 두 번 같은 해시', () => {
  for (const [name, mk] of MAPS) for (let seed = 1; seed <= 12; seed++) {
    const setup = plainSetup(seed, 1300, true, mk())
    const a = runField(setup), b = runField(plainSetup(seed, 1300, true, mk()))
    assert.ok(a.end !== null && a.end !== 'invalid', `${name} ${seed}: ${a.end}`)
    assert.equal(hashField(a), hashField(b), `${name} ${seed}`)
  }
})

test('지도(바닥 칸)가 해시에 들어간다', () => {
  const seeds = new Set<string>()
  for (const [, mk] of MAPS) seeds.add(hashField(createField(plainSetup(1, 1300, true, mk()))))
  assert.equal(seeds.size, MAPS.length, '맵마다 다른 시작 해시')
  const a = meetMap(), b = meetMap()
  b.cells[777] = G_BLOCK
  assert.notEqual(hashField(createField(plainSetup(1, 1300, true, a))), hashField(createField(plainSetup(1, 1300, true, b))))
})

test('바닥: 개울은 얕은 물 띠 + 여울 · 목책은 막힘 줄 + 문 틈 · 높은 터는 뒤쪽', () => {
  const c = crossMap()
  let water = 0, ford = 0
  for (let cu = 0; cu < c.u; cu++) for (let cv = 0; cv < c.w; cv++) {
    const g = c.cells[cu * c.w + cv]
    if (g === G_SHALLOW) water++
    if (g === G_PLAIN && cu >= c.camps[1].u - P.field.streamFromFrontCells - P.field.streamWidthCells && cu < c.camps[1].u - P.field.streamFromFrontCells) ford++
  }
  assert.ok(water > 0 && ford > 0)
  const st = stakeMap()
  const wallU = st.pieces[0]!.u0
  const blocked = Array.from({ length: st.w }, (_, v) => st.cells[wallU * st.w + v] === G_BLOCK)
  assert.equal(blocked.filter(Boolean).length, st.w, '문도 부서지기 전에는 막혀 있다')
  assert.ok(st.pieces.some(p => p.kind === 'gate' && p.hp === P.field.gateHp))
  const h = highMap()
  assert.equal(h.highOwner, 1)
  assert.equal(groundAt(h, U(h.u - 1), U(10)), G_HIGH)
  assert.equal(groundAt(h, U(10), U(10)), G_PLAIN)
  assert.equal(groundAt(h, -1, 0), G_BLOCK, '판 밖은 막힘')
})

test('mapFor: 첫 조각은 맵이 되고 지어지지 않은 것은 null (대로로 떨어지지 않는다)', () => {
  assert.equal(mapFor(meta())!.rule, 'meet')
  assert.equal(mapFor(meta({}, { palisade: true }))!.rule, 'stake')
  assert.equal(mapFor(meta({}, { highland: true }))!.rule, 'high')
  assert.equal(mapFor(meta({ edgeKind: 'pass' }))!.rule, 'high')
  assert.equal(mapFor(meta({ edgeKind: 'ford' }))!.rule, 'cross')
  assert.equal(mapFor(meta({ ambush: 'success' }))!.camps[1].asleep, P.field.asleepSec)
  assert.equal(mapFor(meta({ ambush: 'fail' }))!.camps[1].asleep, 0)
  assert.equal(mapFor(meta({ water: true })), null, '수상')
  assert.equal(mapFor(meta({}, { moat: true })), null, '해자')
  assert.equal(mapFor(meta({}, { earthwall: true })), null, '토성')
  assert.equal(mapFor(meta({ ambush: 'success' }, { palisade: true })), null, '겹친 것은 아직 안 지었다')
})

test('걷기: 지키는 쪽은 제자리 · 깊은 물과 막힘에는 못 들어간다 · 얕은 물에서는 느리다', () => {
  const s = createField(plainSetup(2, 1300, true, holdMap()))
  const homes = s.squads.filter(q => q.side === 1).map(q => [q.u, q.v])
  for (let i = 0; i < 100; i++) stepField(s)
  assert.deepEqual(s.squads.filter(q => q.side === 1).map(q => [q.u, q.v]), homes, '지키는 편은 안 움직인다')
  // 개울 가운데에서 같은 한 걸음이 평지보다 짧다
  const cm = crossMap()
  const wu = cm.camps[1].u - P.field.streamFromFrontCells - 1
  const step = (map: FieldMap, u: number): number => {
    const t = createField(plainSetup(1, 1300, false, map))
    const q = t.squads.find(x => x.side === 0 && x.grp === 'front')!
    keepOnly(t, [q])
    Object.assign(q, { u: U(u), v: U(13), goal: { u: U(150), v: U(13) }, manual: 1 })
    stepField(t)
    return q.u - U(u)
  }
  assert.ok(step(cm, wu) < step(meetMap(), wu), '물 위 걸음이 짧다')
  // 막힘 칸 앞에서 멈춘다
  const st = stakeMap()
  const wallU = st.pieces[0]!.u0
  const t = createField(plainSetup(1, 1300, false, st))
  const q = t.squads.find(x => x.side === 0 && x.grp === 'front')!
  keepOnly(t, [q])
  Object.assign(q, { u: U(wallU) - 10, v: U(2), goal: { u: U(wallU + 5), v: U(2) }, manual: 1 })
  for (let i = 0; i < 40; i++) stepField(t)
  assert.ok(walkable(groundAt(st, q.u, q.v)), '막힘 칸 안에 서지 않는다')
  assert.ok(q.u < U(wallU), '벽을 뚫지 않는다')
})

test('목책: 문을 깨면 길이 열리고 지키는 편은 그 틱에 문 부서짐 충격 하나만 받는다 (진영은 같이 안 터지고 사기는 정확히 그만큼 준다)', () => {
  const st = stakeMap()
  const setup = plainSetup(1, 1300, false, st)
  const s = createField(setup)
  const gate = s.map.pieces.find(p => p.kind === 'gate')!
  const q = s.squads.find(x => x.side === 0 && x.grp === 'front')!
  keepOnly(s, s.squads.filter(o => o === q || o.side === 1))
  const def = s.squads.filter(x => x.side === 1)
  for (const d of def) d.manual = 1
  Object.assign(q, { manual: 1, u: U(gate.u0) - U(1), v: U((gate.v0 + gate.v1) / 2), goal: null, men: 1300, menMax: 1300, hp: 1300000 })
  const before = def[0]!.shock
  let broke = -1, m0 = 0, m1 = 0
  for (let i = 0; i < 3000 && s.end === null; i++) {
    const was = def[0]!.morale
    stepField(s)
    if (broke < 0 && gate.hp === 0) { broke = i; m0 = was; m1 = def[0]!.morale; assert.equal(s.broken[1], 0, '진영은 문이 열린 틱에 같이 안 무너진다') }
  }
  assert.ok(broke > 0, '문이 깨졌다')
  assert.equal(def[0]!.shock, before + P.field.gateBreakMoraleLoss, '문 부서짐 충격 하나')
  assert.equal(m0 - m1, P.field.gateBreakMoraleLoss, '그 틱의 사기는 정확히 문 충격만큼 준다 (목책 위안이 한꺼번에 사라지지 않는다)')
  assert.ok(walkable(groundAt(s.map, U(gate.u0) + 1, U(gate.v0) + 1)), '길이 열렸다')
  assert.equal(st.cells[gate.u0 * st.w + gate.v0], G_BLOCK, '판의 지도 사본만 바뀌고 원래 지도는 그대로다')
  assert.equal(st.pieces.find(p => p.kind === 'gate')!.hp, P.field.gateHp)
  assertInts(s)
  // 같은 setup 으로 다시 시작해도 판이 같다 (조각 사본)
  assert.equal(hashField(createField(setup)), hashField(createField(plainSetup(1, 1300, false, stakeMap()))))
})

test('목책이 지키는 쪽에게 주는 것: 칼날은 문을 사이에 두고만 닿고(마디 너머는 안 닿는다) · 문이 서 있는 동안 밖에서 쏜 화살은 안의 대를 못 맞힌다', () => {
  const setup = (): { s: ReturnType<typeof createField>; A: Squad; B: Squad; W: Squad } => {
    const s = createField(plainSetup(1, 1300, false, stakeMap()))
    const A = s.squads.find(x => x.side === 0 && x.grp === 'front')!, W = s.squads.find(x => x.side === 0 && x.grp === 'bows')!
    const B = s.squads.find(x => x.side === 1 && x.grp === 'front')!
    keepOnly(s, [A, W, B])
    for (const q of [A, W, B]) Object.assign(q, { manual: 1, goal: null, men: 500, menMax: 500, hp: 500000, stance: 1 })
    W.u = UK(10); W.v = UK(2)
    return { s, A, B, W }
  }
  const gate = stakeMap().pieces.find(p => p.kind === 'gate')!
  // 문을 사이에 두고 맞붙는다
  const g = setup()
  g.A.u = UK(gate.u0) - 1; g.A.v = UK(gate.v0 + 3); g.B.u = UK(gate.u1); g.B.v = UK(gate.v0 + 3)
  stepField(g.s)
  assert.equal(g.A.lock, g.B.id); assert.ok(g.B.hp < 500000 && g.A.hp < 500000, '문 앞에서 칼날이 닿는다')
  // 마디 너머로는 안 닿는다
  const m = setup()
  m.A.u = UK(gate.u0) - 1; m.A.v = UK(2); m.B.u = UK(gate.u1); m.B.v = UK(2)
  stepField(m.s)
  assert.equal(m.A.lock, -1); assert.equal(m.B.hp, 500000); assert.equal(m.A.hp, 500000)
  // 화살: 밖의 활은 목책 안 대를 못 맞히고, 안의 활은 밖을 넘겨 쏜다
  const a = setup()
  a.A.u = UK(30); a.W.u = UK(gate.u0) - UK(4); a.W.v = UK(10); a.B.u = UK(gate.u1) + UK(2); a.B.v = UK(10)
  for (let i = 0; i < 10; i++) stepField(a.s)
  assert.equal(a.B.hp, 500000, '목책 안은 밖의 화살을 안 맞는다')
  const d = setup()
  const DB = createField(plainSetup(1, 1300, false, stakeMap())).squads.find(x => x.side === 1 && x.grp === 'bows')!
  d.s.squads.push({ ...DB, id: d.s.squads.length, u: UK(gate.u1) + UK(2), v: UK(10), manual: 1, goal: null, men: 500, menMax: 500, hp: 500000 })
  d.A.u = UK(gate.u0) - UK(4); d.A.v = UK(10); d.B.u = UK(155); d.B.v = UK(38)
  stepField(d.s)
  assert.ok(d.A.hp < 500000, '안의 활은 넘겨 쏜다')
  assertInts(d.s)
})

test('빠른 걸음도 벽을 건너뛰지 않는다 (틱당 걸음이 1칸을 넘으면 나눠 찍는다)', () => {
  const was = P.field.speedHorseCellsPerSec
  ;(P.field as { speedHorseCellsPerSec: number }).speedHorseCellsPerSec = 20
  try {
    const st = stakeMap()
    const wallU = st.pieces[0]!.u0
    const t = createField(plainSetup(1, 1300, false, st))
    const q = t.squads.find(x => x.side === 0 && x.grp === 'horse')!
    keepOnly(t, [q])
    Object.assign(q, { u: UK(wallU - 6), v: UK(2), goal: { u: UK(wallU + 6), v: UK(2) }, manual: 1 })
    for (let i = 0; i < 40; i++) { stepField(t); assert.ok(q.u < UK(wallU), `${i} 틱에 벽을 넘었다`) }
    assertInts(t)
  } finally { (P.field as { speedHorseCellsPerSec: number }).speedHorseCellsPerSec = was }
})

test('높은 터: 위에 선 활이 더 세게 쏘고 올라오는 쪽은 느리다', () => {
  const dmgOn = (map: FieldMap, high: boolean): number => {
    const s = createField(plainSetup(1, 1300, false, map))
    const a = s.squads.find(q => q.side === 1 && q.grp === 'bows')!, b = s.squads.find(q => q.side === 0 && q.grp === 'front')!
    keepOnly(s, [a, b])
    const au = high ? U(map.u - 5) : U(60)
    Object.assign(a, { u: au, v: U(20), goal: null, manual: 1 })
    Object.assign(b, { u: au - U(10), v: U(20), goal: null, manual: 1, stance: 1 })
    const before = b.hp
    stepField(s)
    return before - b.hp
  }
  const hm = highMap()
  assert.ok(dmgOn(hm, true) > dmgOn(hm, false), '터 위 활이 더 센다')
  assert.equal(Math.round(dmgOn(hm, true) * 1000 / dmgOn(hm, false)) / 1000 >= P.realm.tacHeight - 0.02, true, 'P.realm.tacHeight 만큼')
  const climb = (owner: 0 | 1): number => {
    const s = createField(plainSetup(1, 1300, false, { ...highMap(), highOwner: owner }))
    const q = s.squads.find(x => x.side === 0 && x.grp === 'front') as Squad
    keepOnly(s, [q])
    const u0 = U(hm.u - P.field.highDepthCells) + 5
    Object.assign(q, { u: u0, v: U(20), goal: { u: U(hm.u - 2), v: U(20) }, manual: 1 })
    stepField(s)
    return q.u - u0
  }
  assert.ok(climb(1) < climb(0), '올라오는 쪽(가진 쪽이 아닌 편)이 느리다')
})

test('기습: 치는 쪽이 옆 가장자리에서 줄지어 시작한다', () => {
  const s = createField(plainSetup(1, 1300, true, ambushMap(true)))
  const att = s.squads.filter(q => q.side === 0)
  assert.ok(att.every(q => q.v < U(P.field.ambushEdgeCells + 2 * P.field.rowGapCells + 3)), '가장자리 곁')
  assert.ok(att.filter(q => q.grp === 'front').every(q => q.u > U(60)), '지키는 쪽 가까이')
  assert.ok(s.map.camps[1].asleep === P.field.asleepSec)
})
