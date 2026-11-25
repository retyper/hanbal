import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createField, runField, stepField } from '../../src/field/sim.ts'
import { hashField } from '../../src/field/state.ts'
import { parse, serialize } from '../../src/field/rec.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { nearestDir } from '../../src/field/num.ts'
import { HERO_DIR, OP_ATTACK, OP_DASH, OP_HERO_DIR, OP_MOVE, OP_SKILL, WHY_COOL, WHY_NONE, type FieldInput, type FieldState, type HeroArt } from '../../src/field/types.ts'
import { P } from '../../src/tune/params.ts'
import { assertInts, keepOnly, pick, place, run, U } from './kit.ts'

const hero0 = (s: FieldState) => s.heroes.find(e => e.side === 0)!
/** 우리 장수만 남긴 빈 판 (대는 멀리 두 대) */
function lone(art?: HeroArt): FieldState {
  const setup = plainSetup(1, 1300)
  const s = createField({ ...setup, sides: [{ ...setup.sides[0], hero: { id: 'h', mu: 50, ...(art ? { art } : {}) } }, setup.sides[1]] })
  keepOnly(s, [pick(s, 0, 'front'), pick(s, 1, 'front')])
  place(s.squads[0]!, 5, 5); place(s.squads[1]!, 150, 35)
  s.heroes = [hero0(s)]
  Object.assign(hero0(s), { u: U(40), v: U(20) })
  return s
}

test('16방위 표: 길이 1000 언저리 · nearestDir 가 제 번호를 돌려준다 · (0,0) 은 -1', () => {
  HERO_DIR.forEach(([du, dv], k) => {
    const len2 = du * du + dv * dv
    assert.ok(len2 > 998000 && len2 < 1002000, `${k}`)
    assert.equal(nearestDir(du, dv), k)
  })
  assert.equal(nearestDir(0, 0), -1)
  assert.equal(nearestDir(5, 0), 0)
  assert.equal(nearestDir(0, -3), 12)
})

test('입력 하나로 움직인다: OP_HERO_DIR 한 번이면 그쪽으로 계속 가고 멈춤 한 번이면 선다', () => {
  const s = lone()
  const h = hero0(s)
  const u0 = h.u
  stepField(s, [{ tick: 0, g: 3, op: OP_HERO_DIR, u: 0, v: 1 }])
  for (let t = 1; t < 30; t++) stepField(s)
  const gone = h.u - u0
  assert.equal(gone, 3 * P.field.heroSpeedCellsPerSec * P.field.unit, '3초에 걸음 × 3')
  stepField(s, [{ tick: 30, g: 3, op: OP_HERO_DIR, u: 0, v: 0 }])
  const u1 = h.u
  for (let t = 31; t < 60; t++) stepField(s)
  assert.equal(h.u, u1, '멈춤 뒤 선다')
  assert.equal(s.log.accepted.length, 2)
  assert.equal(h.face, 0)
  assertInts(s)
})

test('찍은 자리로 간다 · 적을 쳐라면 그 적에게 붙어 친다 (세기는 무예에 비례)', () => {
  const s = lone()
  const h = hero0(s)
  stepField(s, [{ tick: 0, g: 3, op: OP_MOVE, u: U(50), v: U(20) }])
  run(s, 40)
  assert.deepEqual([h.u, h.v], [U(50), U(20)])
  const e = s.squads[1]!
  place(e, 60, 20, 400)
  e.manual = 1
  stepField(s, [{ tick: s.tick, g: 3, op: OP_ATTACK, u: e.id, v: 0 }])
  run(s, 60)
  assert.ok(e.men < 400, `적이 줄었다 ${e.men}`)
  // 무예 0 이면 안 깎는다
  const t = lone(); const g = hero0(t); g.mu = 0
  const f = t.squads[1]!; place(f, 41, 20, 400); f.manual = 1
  run(t, 30)
  assert.equal(f.hp, 400 * 1000)
})

test('내닫기: 짧게 빠르게 · 그동안 안 맞는다 · 쿨 동안 다시 못 씀(까닭 코드) · 적 대를 뚫지 못한다', () => {
  const s = lone()
  const h = hero0(s)
  const u0 = h.u
  stepField(s, [{ tick: 0, g: 3, op: OP_DASH, u: 0, v: 0 }])
  const dashTicks = Math.trunc(P.field.heroDashMs * P.field.hz / 1000)
  run(s, dashTicks)
  const far = h.u - u0
  assert.ok(far >= U(5) && far <= U(7), `약 6칸 ${far / U(1)}`)
  stepField(s, [{ tick: s.tick, g: 3, op: OP_DASH, u: 0, v: 0 }])
  assert.equal(h.why, WHY_COOL)
  assert.ok(s.log.events.some(e => e.kind === 'heroDash'))
  // 앞에 적 대가 있으면 그 앞에서 멈춘다
  const t = lone(); const g = hero0(t)
  const e = t.squads[1]!; place(e, 43, 20, 500); e.manual = 1
  stepField(t, [{ tick: 0, g: 3, op: OP_DASH, u: 0, v: 0 }])
  run(t, dashTicks)
  assert.ok(g.u < e.u, '뚫지 못했다')
  // 적 곁(맞붙는 거리)에서 빠져나오는 내닫기 — 내닫는 틱 동안은 안 맞는다
  const w = lone(); const k = hero0(w)
  const f = w.squads[1]!; place(f, 41, 20, 500); f.manual = 1
  stepField(w, [{ tick: 0, g: 3, op: OP_DASH, u: 8, v: 0 }])
  assert.equal(k.hp, P.field.heroHp, '내닫는 동안 안 맞았다')
  assert.ok(k.u < U(40), '뒤로 빠졌다')
})

test('큰 외침: 곁의 우리 대 사기가 오르고 쿨이 돈다 · 선봉: 적 대를 뚫고 지나가며 깎는다', () => {
  const s = lone('shout')
  const h = hero0(s), q = s.squads[0]!
  place(q, 41, 20)
  const m0 = q.morale
  stepField(s, [{ tick: 0, g: 3, op: OP_SKILL, u: h.u, v: h.v }])
  stepField(s)
  assert.equal(h.why, WHY_NONE)
  assert.ok(q.morale > m0, `${q.morale} > ${m0}`)
  assert.equal(h.artCd, P.field.heroCdShoutSec * P.field.hz - 2)
  assert.ok(s.log.events.some(e => e.kind === 'heroSkill' && e.art === 'shout'))
  const t = lone('vanguard')
  const g = hero0(t), e = t.squads[1]!
  place(e, 45, 20, 500); e.manual = 1
  stepField(t, [{ tick: 0, g: 3, op: OP_SKILL, u: U(60), v: U(20) }])
  run(t, 20)
  assert.ok(g.u > e.u, '뚫고 지나갔다')
  assert.ok(e.men < 500, `깎였다 ${e.men}`)
  assert.ok(t.log.events.some(x => x.kind === 'loss' && x.to === e.id && x.how === 3))
})

test('곁의 기운: 장수 곁의 대는 같은 피해에 사기가 덜 꺾인다', () => {
  const lossWith = (heroNear: boolean): number => {
    const s = createField(plainSetup(2, 1300))
    const A = pick(s, 0, 'front'), B = pick(s, 1, 'front')
    keepOnly(s, [A, B])
    place(A, 60, 20, 300); place(B, 61, 20, 300)
    A.stance = 1; B.stance = 1
    for (const h of s.heroes) { h.mu = 0; h.manual = 1; h.goal = null; h.u = U(5); h.v = U(h.side === 0 ? 2 : 38) }
    if (heroNear) { const h = hero0(s); h.u = U(56); h.v = U(20) }
    run(s, 50)
    return A.morale0 - A.morale
  }
  const far = lossWith(false), near = lossWith(true)
  assert.ok(near < far, `곁 ${near} < 멀리 ${far}`)
})

test('사건 줄: 마구잡이 새 입력 넷이 섞인 판의 재생에서 해시와 사건 줄이 같다', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const setup = plainSetup(seed, 1300)
    const ins: FieldInput[] = []
    for (let k = 0; k < 40; k++) {
      const tick = 5 + k * 11 + (seed % 5), op = [OP_HERO_DIR, OP_DASH, OP_SKILL, OP_ATTACK, OP_MOVE][(k + seed) % 5]!
      const u = op === OP_HERO_DIR ? (k * 7 + seed) % 16 : op === OP_DASH ? ((k + seed) % 17) - 1 : op === OP_ATTACK ? 12 + ((k + seed) % 12) : U(20 + (k * 13 + seed) % 120)
      ins.push({ tick, g: op === OP_ATTACK && k % 3 === 0 ? ((k % 3) as 0) : 3, op, u, v: op === OP_HERO_DIR ? k % 2 : op === OP_DASH || op === OP_ATTACK ? 0 : U((k * 5 + seed) % 40) })
    }
    const a = runField(setup, ins)
    const b = runField(setup, parse(serialize(a.log.accepted))!)
    assert.equal(hashField(b), hashField(a), `seed ${seed}`)
    assert.deepEqual(b.log.events, a.log.events, `사건 seed ${seed}`)
    assertInts(a)
  }
})

test('loss 사건: 한 틱에 줄어든 사람 수와 그 틱 loss 의 합이 같다', () => {
  const s = createField(plainSetup(3, 1300))
  for (let t = 0; t < 400 && s.end === null; t++) {
    const before = s.squads.map(q => q.men)
    const tk = s.tick
    stepField(s)
    const lost = s.squads.reduce((a, q) => a + before[q.id]! - q.men, 0)
    const ev = s.log.events.filter(e => e.tick === tk && e.kind === 'loss').reduce((a, e) => a + e.n, 0)
    assert.equal(ev, lost, `틱 ${t}`)
  }
})
