// 75-WALL 건물은 모두 부서진다 (형 11-25 「건물들은 다 부서지긴 해야겠던데 · 막혀서 적이 공격 못 하는 꼼수」)
// 항아리·솟대·봉수대·우물에 체력 · 부서진 것은 효과가 끊긴다 · 잡졸은 닿은 설치물 전부를 물고 · 정예·두목도 막히면 문다 · 옛 규칙 판은 무적 그대로
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_BREAKABLE as W, HAEBI_BUILD2 as B2, HAEBI_RUN as C, HAEBI_GAP as GP } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, spawnMob, KIT_RULES, MAP_RULES, BUILD_RULES, BUILD2_RULES, BUFF_RULES, WALL_RULES, GAP_RULES, type HaebiRun, type Mob } from '../src/raid/haebi.ts'
import { standing, jarBonusAt, rebuildOf, bodyR, type BuildKind, type Structure } from '../src/raid/build.ts'
import { goldenRun } from './raid-golden-kit.ts'
import { fieldBounds } from '../src/raid/wide.ts'

const NEW_KINDS: BuildKind[] = ['jar', 'sotdae', 'beacon', 'well']
/** 조용한 한 장짜리 판 (저절로 나오는 적·정예·일제 사격을 멈춘다 · 장수 무기도 쉰다) */
function quiet(wall: boolean) {
  const s = createHaebi(5, 'stage', 'axe', { stage: 'forest', simRules: '56B', kitRules: KIT_RULES, buildRules: BUILD_RULES, build2Rules: BUILD2_RULES, ...(wall ? { wallRules: WALL_RULES } : {}) })
  s.spawn = s.nextElite = s.nextBarrage = 1e9
  return s
}
const pick = (s: HaebiRun, k: BuildKind) => { s.offers = [k]; s.xp = 0; assert.ok(choose(s, k), k) }
const step = (s: HaebiRun, seconds: number) => { for (let i = 0; i < seconds * 120; i++) stepHaebi(s, { x: 0, y: 0 }, 1 / 120) }
const one = (s: HaebiRun, k: BuildKind) => s.build!.items.find(it => it.kind === k)!
/** 장수의 무기를 쉬게 한다 (적을 건드리지 않고 설치물과 적만 본다) */
const rest = (s: HaebiRun) => { for (const k of Object.keys(s.cool) as (keyof typeof s.cool)[]) s.cool[k] = 1e9 }
function club(s: HaebiRun, x: number, y: number): Mob {
  spawnMob(s, 'club', undefined, true); const e = s.enemies[s.enemies.length - 1]!
  e.x = x; e.y = y; e.hp = e.max = 1e6; e.cd = 9
  return e
}

test('75-WALL 항아리·솟대·봉수대·우물이 체력을 가진다 · 옛 판은 무적 그대로', () => {
  for (const wall of [true, false]) {
    const s = quiet(wall)
    const s2 = quiet(wall); pick(s2, 'well'); for (const k of ['jar', 'sotdae', 'beacon'] as const) pick(s, k)
    for (const k of NEW_KINDS) {
      const st = k === 'well' ? s2 : s
      const it = one(st, k)
      if (wall) { assert.ok(it.hp > 0 && it.hp === it.max, `${k} ${it.hp}`); assert.equal(it.w, true); assert.equal(it.max, W.hp[k as keyof typeof W.hp]) }
      else { assert.equal(it.hp, 0, k); assert.equal(it.max, 0, k); assert.equal(it.w, undefined, k); assert.ok(standing(it), k) }
    }
  }
})

test('75-WALL 부서지면 잔해로 서서 다시 서기까지 센다 · 다시 서면 체력이 찬다', () => {
  const s = quiet(true); rest(s); pick(s, 'beacon')
  const it = one(s, 'beacon'); it.hp = -1
  step(s, .05)
  assert.ok(it.down > 0 && !standing(it))
  assert.equal(it.down <= rebuildOf('beacon'), true)
  step(s, rebuildOf('beacon') + .5)
  assert.ok(standing(it) && it.hp === it.max && it.hp > 0)
})

test('75-WALL 부서진 항아리는 기세를 더 주지 못한다', () => {
  const s = quiet(true); pick(s, 'jar')
  const j = one(s, 'jar')
  assert.ok(jarBonusAt(s.build!, s.ranks.jar, j.x, j.y, 0) > 1)
  j.hp = 0; step(s, .05)
  assert.equal(jarBonusAt(s.build!, s.ranks.jar, j.x, j.y, 0), 1)
})

test('75-WALL 부서진 솟대는 적을 못 느리게 한다', () => {
  const dist = (broken: boolean) => {
    const s = quiet(true); rest(s); pick(s, 'sotdae')
    const sot = one(s, 'sotdae'); if (broken) { sot.hp = 0; step(s, .05) }
    const e = club(s, sot.x + 4, sot.y + 4 + 90); e.cd = 9
    const x0 = e.x, y0 = e.y
    for (let i = 0; i < 60; i++) { stepHaebi(s, { x: 0, y: 0 }, 1 / 120); sot.hp = broken ? 0 : sot.hp }
    return Math.hypot(e.x - x0, e.y - y0)
  }
  assert.ok(dist(false) < dist(true), `${dist(false)} ${dist(true)}`)
})

test('75-WALL 부서진 우물은 고쳐 주지 않고 쿨타임도 멈춘다', () => {
  const heal = (broken: boolean) => {
    const s = quiet(true); rest(s); pick(s, 'well'); const w = one(s, 'well')
    s.hp = s.maxHp * .4; w.cd = 0
    if (broken) { w.hp = 0; step(s, .05) }
    const h0 = s.hp; step(s, .5)
    return (s.hp - h0) / s.maxHp
  }
  assert.ok(heal(false) > .2, '서 있는 우물은 고친다')
  assert.ok(heal(true) < .02, '잔해는 안 고친다')
  const s = quiet(true); rest(s); pick(s, 'well'); const w = one(s, 'well')
  s.hp = s.maxHp; w.cd = 20; w.hp = 0; step(s, .05)
  const cd0 = w.cd
  step(s, 4)
  assert.equal(w.cd, cd0, '잔해 동안 쿨타임이 멈춘다')
  step(s, rebuildOf('well') + 1)
  assert.ok(standing(w))
  step(s, 2)
  assert.ok(w.cd < cd0, '다시 서면 쿨타임이 이어서 돈다')
})

test('75-WALL 잡졸은 닿은 설치물 전부를 문다', () => {
  const s = quiet(true); rest(s); pick(s, 'jar'); pick(s, 'beacon')
  const jar = one(s, 'jar'), bea = one(s, 'beacon')
  // 둘 사이에 잡졸 하나 — 두 설치물 모두에 닿게 놓는다
  jar.x = s.x + 200; jar.y = s.y; bea.x = jar.x + 40; bea.y = jar.y
  const e = club(s, (jar.x + bea.x) / 2, jar.y + 22)
  e.x = (jar.x + bea.x) / 2; e.y = jar.y + 22
  const h = [jar.hp, bea.hp]
  step(s, .3)
  assert.ok(jar.hp < h[0]! && bea.hp < h[1]!, `${jar.hp}/${h[0]} ${bea.hp}/${h[1]}`)
})

test('75-WALL 정예가 설치물에 막히면 물어 부순다 (옛 판은 못 건드린다)', () => {
  for (const wall of [true, false]) {
    const s = quiet(wall); rest(s); pick(s, 'beacon')
    const bea = one(s, 'beacon')
    s.x = 300; s.y = 300; bea.x = 360; bea.y = 300
    spawnMob(s, 'elite'); const e = s.enemies[s.enemies.length - 1]!
    e.x = bea.x + bodyR(bea) + 14; e.y = bea.y; e.cd = 0
    const before = bea.hp
    step(s, 1.5)
    if (wall) assert.ok(bea.hp < before, `${bea.hp}/${before}`)
    else assert.equal(bea.hp, before)
  }
})

test('75-WALL 정예 하나가 닿은 봉수대는 10초 넘게 선다', () => {
  const need = C.contactDamage * W.championBite
  const hp = W.hp.beacon + W.hpStep.beacon * 0
  assert.ok(hp / (need * (1 + 10 * C.threatTimeScale)) > 10, `${hp / need}`)
})

test('75-WALL 같은 씨앗은 같은 판 · 옛 규칙 판과는 다르다', () => {
  const a = createHash('sha256').update(JSON.stringify(goldenRun('forest', 'axe', 7, 60, { wallRules: WALL_RULES }))).digest('hex')
  const b = createHash('sha256').update(JSON.stringify(goldenRun('forest', 'axe', 7, 60, { wallRules: WALL_RULES }))).digest('hex')
  const old = createHash('sha256').update(JSON.stringify(goldenRun('forest', 'axe', 7, 60))).digest('hex')
  assert.equal(a, b)
  assert.notEqual(a, old)
})

test('75-WALL + 74-BUFF 우물이 부서져도 이미 붙은 물기운은 끝까지 가고 잔해 동안은 새로 안 붙는다', () => {
  const mk = () => { const s = createHaebi(5, 'stage', 'axe', { stage: 'forest', simRules: '56B', kitRules: KIT_RULES, buildRules: BUILD_RULES, build2Rules: BUILD2_RULES, buffRules: BUFF_RULES, wallRules: WALL_RULES }); s.spawn = s.nextElite = s.nextBarrage = 1e9; rest(s); pick(s, 'well'); s.hp = s.maxHp * .4; return s }
  const s = mk(), w = one(s, 'well')
  step(s, .1)
  assert.ok(s.buffs!.some(b => b.kind === 'water'), '물기운이 붙었다')
  w.hp = 0; step(s, .05)
  assert.ok(!standing(w))
  const h0 = s.hp; step(s, B2.well.time - .3)
  assert.ok(s.hp - h0 > s.maxHp * .05, '이미 붙은 물기운은 끝까지 채운다')
  // 잔해 동안 새로 안 붙는다
  const t = mk(), v = one(t, 'well'); v.hp = 0; step(t, .05)
  step(t, 1)
  assert.equal(t.buffs!.length, 0)
})

// 78-GAP 건물은 구석을 봉하지 못한다 (형 11-25 「틈 규칙」) — 건물끼리 · 건물과 땅 끝 사이는 적 한 명이 지나갈 틈보다 가까이 못 붙는다
const quietGap = (gap: boolean) => {
  const s = createHaebi(5, 'stage', 'axe', { stage: 'forest', simRules: '56B', kitRules: KIT_RULES, mapRules: MAP_RULES, buildRules: BUILD_RULES, build2Rules: BUILD2_RULES, wallRules: WALL_RULES, ...(gap ? { gapRules: GAP_RULES } : {}) })
  s.spawn = s.nextElite = s.nextBarrage = 1e9; rest(s); s.ranks.beacon = 1
  return s
}
const putBeacon = (s: HaebiRun, x: number, y: number) => { s.build!.items.push({ id: s.build!.nextId++, kind: 'beacon', x, y, hp: 260, max: 260, down: 0, cd: 0, flash: 0, push: 0, w: true }); return s.build!.items[s.build!.items.length - 1]! }
const gapOf = (a: Structure, b: Structure) => Math.hypot(a.x - b.x, a.y - b.y) - bodyR(a) - bodyR(b)

test('78-GAP 붙여 놓은 건물 둘이 틈만큼 벌어진다 · 태그 없는 판은 옛 동작(맞닿기까지만)', () => {
  for (const gap of [true, false]) {
    const s = quietGap(gap); s.x = 600; s.y = 800
    const a = putBeacon(s, 600, 500), b = putBeacon(s, 620, 500)   // 몸이 겹치게 붙인다
    step(s, 1.5)
    const g = gapOf(a, b)
    if (gap) assert.ok(g >= GP.gap - 1, `틈 ${g}`)
    else assert.ok(g < GP.gap - 1, `옛 판은 맞닿기까지만 ${g}`)
  }
})

test('78-GAP 건물은 땅 끝에서도 틈만큼 떨어진다', () => {
  const s = quietGap(true); s.x = 600; s.y = 800
  const f = fieldBounds(s), a = putBeacon(s, f.left + 5, f.top + 5)
  step(s, 1)
  assert.ok(a.x - bodyR(a) - f.left >= GP.gap - 1 && a.y - bodyR(a) - f.top >= GP.gap - 1, `${a.x - f.left} ${a.y - f.top}`)
})

test('78-GAP 걸음마다 조금씩 벌어진다 (한 걸음에 rate × dt 를 넘지 않는다)', () => {
  const s = quietGap(true); s.x = 600; s.y = 800
  const a = putBeacon(s, 600, 500), b = putBeacon(s, 640, 500)
  const x0 = b.x
  stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  assert.ok(b.x - x0 <= GP.rate / 120 + 1e-6 && b.x - x0 > 0, `${b.x - x0}`)
  assert.ok(a.x < 600)
})

test('78-GAP 틈으로 잡졸이 지나간다 · 건물에 닿지 않는 길이면 (닿으면 75-WALL 대로 멈춰 문다)', () => {
  for (const off of [0, 3]) {
    const s = quietGap(true); s.x = 600; s.y = 760
    const a = putBeacon(s, 600, 600), half = (bodyR(a) * 2 + GP.gap) / 2
    a.x = 600 - half; putBeacon(s, 600 + half, 600)
    const e = club(s, 600 + off, 440); e.cd = 9
    let through = false
    for (let i = 0; i < 6 * 120 && !through; i++) { stepHaebi(s, { x: 0, y: 0 }, 1 / 120); e.hp = e.max; e.cd = 9; through = e.y > 640 }
    assert.ok(through, `off ${off} 멈춘 곳 ${e.x.toFixed(0)},${e.y.toFixed(0)}`)
  }
})

test('78-GAP 같은 씨앗은 같은 판 · 옛 규칙 판과는 다르다', () => {
  const h = (x: object) => createHash('sha256').update(JSON.stringify(goldenRun('forest', 'axe', 7, 60, x))).digest('hex')
  assert.equal(h({ wallRules: WALL_RULES, gapRules: GAP_RULES }), h({ wallRules: WALL_RULES, gapRules: GAP_RULES }))
  assert.notEqual(h({ wallRules: WALL_RULES, gapRules: GAP_RULES }), h({ wallRules: WALL_RULES }))
})
