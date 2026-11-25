import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createField, runField, stepField } from '../../src/field/sim.ts'
import { hashField, snapshot } from '../../src/field/state.ts'
import { parse, serialize } from '../../src/field/rec.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { MAPS as MAP_LIST, assertInts, U } from './kit.ts'
import { P } from '../../src/tune/params.ts'
import { stakeMap } from '../../src/field/map.ts'
import type { FieldInput, FieldState, InputGroup } from '../../src/field/types.ts'

const SIZES = [600, 1300, 2100]

/** 씨앗마다 다른 손질 열 — 꼴이 틀려 버려지는 것도 섞인다 */
function inputsFor(seed: number): FieldInput[] {
  const out: FieldInput[] = []
  for (let k = 0; k < 24; k++) {
    const g = ((seed + k) % 4) as InputGroup
    const stance = k % 7 === 3 && g < 3
    out.push({ tick: 10 + k * 53 + (seed % 7), g, op: stance ? 2 : k % 5 === 4 ? 1 : 0, u: stance ? (seed + k) % 3 : U(20 + ((seed * 7 + k * 13) % 120)), v: stance ? 0 : U((seed * 3 + k * 5) % 40) })
  }
  // 한 무리에 입력 5개 · 꼴이 틀린 입력 하나(버려진다) · 일부 판은 중간에 물러난다
  for (let k = 0; k < 5; k++) out.push({ tick: 700 + k, g: 0, op: 0, u: U(30 + k), v: U(10) })
  out.push({ tick: 702, g: 3, op: 5, u: 16, v: 1 })
  if (seed % 5 === 0) out.push({ tick: 450 + (seed % 40), g: 1, op: 3, u: 0, v: 0 })
  return out
}

test('빈 판 200씨앗 · 모든 맵 (1,000씨앗은 tools/field-bench.ts): 같은 씨앗 두 번 = 같은 해시 · 입력 기록 재생 = 같은 해시 · 끝 판 정수', () => {
  const seen = new Set<string>()
  let dropped = 0, retreats = 0, stances = 0
  for (let seed = 1; seed <= 200; seed++) {
    const setup = plainSetup(seed, SIZES[seed % 3]!, true, MAP_LIST[seed % MAP_LIST.length]![1]())
    const inputs = seed % 2 === 0 ? inputsFor(seed) : []
    const a = runField(setup, inputs)
    const b = runField(setup, inputs)
    assert.ok(a.end !== null && a.end !== 'invalid' && a.tick <= P.field.timesMax * P.field.timeSec * P.field.hz)
    assert.equal(hashField(a), hashField(b), `seed ${seed}`)
    const replay = parse(serialize(a.log.accepted))
    assert.ok(replay)
    assert.equal(hashField(runField(setup, replay)), hashField(a), `재생 seed ${seed}`)
    assertInts(a, `seed ${seed}`)
    seen.add(hashField(a))
    dropped += a.log.dropped
    if (a.end === 'retreat') retreats++
    stances += a.log.accepted.filter(i => i.op === 2).length
  }
  assert.ok(dropped > 0 && retreats > 0 && stances > 0, `시험 입력에 버림·물러남·자세가 실제로 섞인다 (${dropped} · ${retreats} · ${stances})`)
  assert.ok(seen.size > 180, `씨앗이 해시에 닿는다: ${seen.size}`)
})

test('틱을 하나씩 걸어도 runField 와 같다 · 끝난 판은 더 안 걷는다', () => {
  const setup = plainSetup(5, 1300)
  const inputs = inputsFor(5)
  const s = createField(setup)
  for (let t = 0; s.end === null; t++) stepField(s, inputs.filter(i => i.tick === t))
  assert.equal(hashField(s), hashField(runField(setup, inputs)))
  const h = hashField(s)
  stepField(s); stepField(s)
  assert.equal(hashField(s), h)
})

test('두 편이 걸어 서로 다가간다 (대 수는 무리마다 4 이하, 사람 수는 합이 같다)', () => {
  for (const men of SIZES) {
    const setup = plainSetup(1, men)
    const s0 = createField(setup)
    for (const side of [0, 1] as const) for (const grp of ['front', 'bows', 'horse'] as const) {
      const qs = s0.squads.filter(q => q.side === side && q.grp === grp)
      assert.ok(qs.length >= 1 && qs.length <= P.field.squadsPerGroupMax)
      assert.equal(qs.reduce((a, q) => a + q.men, 0), setup.sides[side].men[grp])
    }
    const near = (s: FieldState): number => Math.min(...s.squads.filter(q => q.side === 0).flatMap(q => s.squads.filter(e => e.side === 1).map(e => Math.abs(q.u - e.u))))
    const s = runField(setup, [], 200)
    assert.ok(near(s) < near(s0), '가까워졌다')
    const full = runField(setup)
    // 도망치는 대(사기가 꺾여 제 진영 쪽으로 달아남 · army.ts)는 빼고 본다
    assert.ok(full.squads.filter(q => q.side === 0 && q.flee === 0 && q.men > 0).every(q => q.u > s0.squads[q.id]!.u), '앞으로 나아갔다')
  }
})

test('명령 수 제한이 없다: 같은 무리에 한 때 명령 20번을 넣어도 전부 먹는다 · 한 틱 상한(inputPerTickMax)을 넘은 것만 버리고 센다 · 기록 재생이 같다', () => {
  const setup = plainSetup(2, 1300)
  const mv = (tick: number, k: number): FieldInput => ({ tick, g: 0, op: 0, u: U(30 + k), v: U(10) })
  const twenty = Array.from({ length: 20 }, (_, k) => mv(1 + k, k))
  const s = runField(setup, twenty, 40)
  assert.equal(s.log.dropped, 0)
  assert.equal(s.log.accepted.length, 20)
  assert.equal(s.squads.find(q => q.side === 0 && q.grp === 'front')!.goal!.u - U(49), s.squads.find(q => q.side === 0 && q.grp === 'front')!.homeU - Math.trunc(s.squads.filter(q => q.side === 0 && q.grp === 'front').reduce((a, q) => a + q.homeU, 0) / 4), '마지막 명령이 먹었다')
  assert.deepEqual(s.used, [0, 0, 0, 0], 'used 는 늘 0 (화면이 걷어낼 때까지 칸만 남김)')
  const cap = P.field.inputPerTickMax
  const flood = Array.from({ length: cap + 7 }, (_, k) => mv(3, k % 40))
  const f = runField(setup, flood, 10)
  assert.equal(f.log.accepted.length, cap)
  assert.equal(f.log.dropped, 7)
  assert.equal(hashField(runField(setup, parse(serialize(f.log.accepted))!, 10)), hashField(f), '기록 재생')
  const w = runField(setup, [{ tick: 1, g: 0, op: 0, u: U(9999), v: 0 }, { tick: 2, g: 0, op: 99, u: 0, v: 0 }])
  assert.equal(w.log.dropped, 2)
})

test('손으로 몬 무리는 그 자리로 간다 — 대마다 시작 줄의 상대 자리를 지키고 줄 가운데가 누른 곳이다 (판 밖으로 나가면 가운데를 당긴다)', () => {
  for (const [tu, tv] of [[50, 20], [50, 3]] as const) {
    const s = runField(plainSetup(3, 1300, false), [{ tick: 1, g: 0, op: 0, u: U(tu), v: U(tv) }], 600)
    const front = s.squads.filter(q => q.side === 0 && q.grp === 'front')
    const cu = Math.trunc(front.reduce((a, q) => a + q.homeU, 0) / front.length), cv = Math.trunc(front.reduce((a, q) => a + q.homeV, 0) / front.length)
    for (const q of front) {
      assert.equal(q.goal!.u - U(tu), q.homeU - cu, '앞뒤 자리')
      assert.ok(q.goal!.v >= 0 && q.goal!.v < U(s.map.w), '판 안')
      assert.ok(Math.abs(q.u - q.goal!.u) <= U(P.field.sepCells) && Math.abs(q.v - q.goal!.v) <= U(P.field.sepCells), '제 목표 곁에 선다')
    }
    const gv = front.map(q => q.goal!.v - (q.homeV - cv))
    assert.equal(new Set(gv).size, 1, '줄 모양 그대로 한 가운데')
    if (tv === 20) assert.equal(gv[0], U(tv))
    else assert.ok(gv[0]! > U(tv), '판 끝 가까이 누르면 줄이 판 안에 들어오게 가운데를 당긴다')
    assertInts(s)
  }
})

test('물러남은 op 만 본다 (무리 번호·자리가 이상해도) · 같은 틱 뒤 입력은 끝난 판을 안 바꾼다 · 틱이 정수가 아닌 입력은 버리고 뒤 입력은 산다', () => {
  const setup = plainSetup(4, 1300)
  const a = runField(setup, [{ tick: 30, g: 7 as InputGroup, op: 3, u: 0.5, v: NaN }, { tick: 30, g: 0, op: 0, u: U(80), v: U(5) }])
  assert.equal(a.end, 'retreat')
  assert.equal(a.tick, 30)
  assert.deepEqual(a.log.accepted, [{ tick: 30, g: 0, op: 3, u: 0, v: 0 }])
  assert.ok(a.squads.every(q => q.manual === 0), '물러난 뒤 입력은 안 받았다')
  assert.equal(hashField(runField(setup, parse(serialize(a.log.accepted))!)), hashField(a), '기록 재생')
  const b = runField(setup, [{ tick: NaN, g: 0, op: 0, u: 0, v: 0 }, { tick: 5, g: 0, op: 0, u: U(40), v: U(20) }], 20)
  assert.equal(b.log.dropped, 1)
  assert.equal(b.log.accepted.length, 1, '틱 NaN 뒤의 입력이 사라지지 않는다')
})

test('해시는 소수·NaN 을 정수와 같게 보지 않는다 · snapshot 은 지도·조각·broken 을 떼어 낸다', () => {
  const s = createField(plainSetup(1, 1300))
  const h = hashField(s)
  s.squads[0]!.morale = NaN
  assert.notEqual(hashField(s), h)
  s.squads[0]!.morale = 700.5
  const h2 = hashField(s)
  s.squads[0]!.morale = 700
  assert.notEqual(hashField(s), h2)
  const t = createField(plainSetup(1, 1300, true, stakeMap()))
  const snap = snapshot(t)
  const hs = hashField(snap)
  t.map.cells[0] = 3; t.map.pieces[0]!.hp = 0; t.broken[0] = 1
  assert.equal(hashField(snap), hs, '판이 바뀌어도 사본은 그대로')
})

test('무효 시작은 던지지 않고 invalid 로 끝난다 (음수 · 빈 편 · 소수 · 몸 수 상한)', () => {
  const ok = plainSetup(1, 1300)
  const withMen = (men: { front: number; bows: number; horse: number }) => ({ ...ok, sides: [{ ...ok.sides[0], men }, ok.sides[1]] as typeof ok.sides })
  assert.equal(runField(withMen({ front: -1, bows: 0, horse: 0 })).end, 'invalid')
  assert.equal(runField(withMen({ front: 0, bows: 0, horse: 0 })).end, 'invalid')
  assert.equal(runField(withMen({ front: 1.5, bows: 0, horse: 0 })).end, 'invalid')
  // 대 수는 무리마다 4 로 고정이라 사람이 아무리 많아도 몸 수는 그대로다 (대당 사람 수가 변한다)
  const huge = createField(withMen({ front: 100000, bows: 100000, horse: 100000 }))
  assert.equal(huge.end, null)
  assert.equal(huge.squads.filter(q => q.side === 0).length, 12)
  // 몸 수 상한을 넘는 판 (상한을 낮춰 본다)
  const was = P.field.bodiesMax
  ;(P.field as { bodiesMax: number }).bodiesMax = 5
  try { assert.equal(createField(ok).end, 'invalid') } finally { (P.field as { bodiesMax: number }).bodiesMax = was }
})
