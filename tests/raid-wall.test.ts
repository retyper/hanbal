// 75-WALL 건물은 모두 부서진다 (형 11-25 「건물들은 다 부서지긴 해야겠던데 · 막혀서 적이 공격 못 하는 꼼수」)
// 항아리·솟대·봉수대·우물에 체력 · 부서진 것은 효과가 끊긴다 · 잡졸은 닿은 설치물 전부를 물고 · 정예·두목도 막히면 문다 · 옛 규칙 판은 무적 그대로
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_BREAKABLE as W, HAEBI_BUILD2 as B2, HAEBI_RUN as C } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, spawnMob, KIT_RULES, BUILD_RULES, BUILD2_RULES, BUFF_RULES, WALL_RULES, type HaebiRun, type Mob } from '../src/raid/haebi.ts'
import { standing, jarBonusAt, rebuildOf, bodyR, type BuildKind } from '../src/raid/build.ts'
import { goldenRun } from './raid-golden-kit.ts'

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
