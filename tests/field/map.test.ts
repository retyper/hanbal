import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ambushMap, crossMap, groundAt, highMap, holdMap, mapFor, meetMap, stakeMap, walkable } from '../../src/field/map.ts'
import type { MapMeta } from '../../src/field/map.ts'
import { createField, runField, stepField } from '../../src/field/sim.ts'
import { hashField } from '../../src/field/state.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { G_BLOCK, G_HIGH, G_PLAIN, G_SHALLOW } from '../../src/field/types.ts'
import type { FieldMap, Squad } from '../../src/field/types.ts'
import { P } from '../../src/tune/params.ts'

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
  assert.equal(blocked.filter(Boolean).length, st.w - P.field.gateCells)
  assert.ok(blocked.some(x => !x), '문 틈이 있다')
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
  assert.equal(mapFor(meta({ ambush: 'success' }))!.camps[1].asleep, P.field.asleepTicks)
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
    for (const o of t.squads) if (o !== q) { o.men = 0; o.hp = 0 }
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
  for (const o of t.squads) if (o !== q) { o.men = 0; o.hp = 0 }
  Object.assign(q, { u: U(wallU) - 10, v: U(2), goal: { u: U(wallU + 5), v: U(2) }, manual: 1 })
  for (let i = 0; i < 40; i++) stepField(t)
  assert.ok(walkable(groundAt(st, q.u, q.v)), '막힘 칸 안에 서지 않는다')
  assert.ok(q.u < U(wallU), '벽을 뚫지 않는다')
})

test('목책: 문으로 돌아 지나간다 (한쪽에서 반대쪽 목표를 보면 문 가운데가 목표)', () => {
  const st = stakeMap()
  const wallU = st.pieces[0]!.u0
  let passed = 0
  for (let seed = 1; seed <= 6; seed++) {
    const s = runField(plainSetup(seed, 1300, true, st), [], 700)
    if (s.squads.some(q => q.side === 0 && q.men > 0 && q.u > U(wallU) + P.field.unit)) passed++
  }
  assert.ok(passed >= 5, `문을 지난 판 ${passed}/6`)
})

test('높은 터: 위에 선 활이 더 세게 쏘고 올라오는 쪽은 느리다', () => {
  const dmgOn = (map: FieldMap, high: boolean): number => {
    const s = createField(plainSetup(1, 1300, false, map))
    const a = s.squads.find(q => q.side === 1 && q.grp === 'bows')!, b = s.squads.find(q => q.side === 0 && q.grp === 'front')!
    for (const o of s.squads) if (o !== a && o !== b) { o.men = 0; o.hp = 0 }
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
    for (const o of s.squads) if (o !== q) { o.men = 0; o.hp = 0 }
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
  assert.ok(s.map.camps[1].asleep === P.field.asleepTicks)
})
