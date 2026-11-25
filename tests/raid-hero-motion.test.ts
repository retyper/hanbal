// 62-A 열전 장수 몸놀림 — 칸 박자 표 · 맞힘 동기 · 걷기 거리 위상 · 멈춤 한 박 · 판 상태 읽기만 (src/raid/hero-motion.ts)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_ANIM as A, HAEBI_RUN as C } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, spawnMob, KITS, type HaebiRun, type Kit } from '../src/raid/haebi.ts'
import { attackFrame, attackRole, heroPose } from '../src/raid/hero-motion.ts'
import { heroFrame } from '../src/raid/haebi-view.ts'

const idle = { x: 0, y: 0 }
const opts = { stride: 70, cells: 4 }
/** 적 하나를 장수 옆에 세운 판 (주 무기가 바로 선다) */
function fight(kit: Kit, gap = 40) {
  const s = createHaebi(7, 'stage', kit); s.spawn = 99; s.inv = 999   // 맞지 않게 (맞음 칸 18 이 끼지 않게)
  spawnMob(s); Object.assign(s.enemies[0]!, { x: s.x + gap, y: s.y, hp: 1e6, max: 1e6 })
  return s
}
/** 주 무기가 서는 걸음까지 (쿨다운이 다시 차는 걸음) */
function untilStrike(s: HaebiRun, input = idle) {
  const key = KITS[s.kit].primary as keyof HaebiRun['cool']
  for (let i = 0; i < 600; i++) { const before = s.cool[key]; stepHaebi(s, input, 1 / 120); if (s.cool[key] > before) return }
  assert.fail('primary never fired')
}

test('62-A 공격 칸 시계 길이는 판이 세우는 attack 값과 같다 (모든 무기 묶음)', () => {
  for (const kit of (Object.keys(KITS) as Kit[]).filter(k => k !== 'whip')) {   // 채찍은 카드 W2 에서 켠다
    const s = fight(kit); untilStrike(s)
    assert.equal(s.attack, A.window, kit)
  }
})

test('62-A 칸 박자 표: 휘두름 짧게 → 맞힘 멈춤 → 마무리(뒤 칸이 더 길게) · 활은 놓음이 첫 칸', () => {
  const strike = attackRole('axe'), draw = attackRole('bow'), c1 = A.swing + A.contact
  assert.deepEqual([attackFrame(strike, 0), attackFrame(strike, A.swing - 1e-4), attackFrame(strike, A.swing)], [14, 14, 15])
  assert.equal(attackFrame(strike, c1 - 1e-4), 15)
  const split = c1 + (A.window - c1) * A.recoverSplit
  assert.deepEqual([attackFrame(strike, c1), attackFrame(strike, split - 1e-4), attackFrame(strike, split), attackFrame(strike, A.window - 1e-4)], [16, 16, 17, 17])
  assert.equal(attackFrame(strike, A.window), null)
  assert.ok(A.window - split > split - c1, '서기로 돌아가는 칸이 더 오래')
  assert.ok(A.swing < A.contact && A.contact < A.window - c1, '휘두름 < 맞힘 < 마무리')
  // 활: 당김(14)은 예비, 서는 순간이 놓음(15) — 화살이 나가는 걸음과 같다
  assert.deepEqual([attackFrame(draw, 0), attackFrame(draw, A.contact - 1e-4), attackFrame(draw, A.contact)], [15, 15, 16])
  // 걷는 중: 마무리를 짧게 하고 걷기로
  assert.deepEqual([attackFrame(strike, c1, true), attackFrame(strike, c1 + A.moveRecover - 1e-4, true)], [16, 17])
  assert.equal(attackFrame(strike, c1 + A.moveRecover, true), null)
  // 모든 칸은 열전 띠 공격 칸(12..17) 안 · 피격 칸 18 을 공격에 쓰지 않는다
  for (const r of [strike, draw]) for (const f of [r.ready, ...r.antic, ...r.swing, r.contact, ...r.recover]) assert.ok(f >= 12 && f <= 17, String(f))
})

test('62-A 서는 순간(피해가 들어가는 걸음)부터 휘두름 · 맞은 순간 멈춤 동안은 맞힘 칸에 머물고 풀려도 되돌아가지 않는다', () => {
  const s = fight('axe'); untilStrike(s)
  assert.equal(heroPose(s, opts).frame, 14, '첫 화면 = 휘두름 (예전엔 12 준비 칸)')
  const t = fight('axe'); untilStrike(t)
  const held = heroPose(t, { ...opts, stopped: true })
  assert.equal(held.frame, 15); assert.equal(held.dx, A.lunge.axe, '멈춘 동안 런지가 끝까지 나가 있다')
  stepHaebi(t, idle, 1 / 120)
  assert.equal(heroPose(t, opts).frame, 15, '멈춤이 풀린 뒤에도 휘두름으로 되돌아가지 않음')
})

test('62-A 런지·늘임·잔상은 적 쪽 · 마무리 끝에 제자리 · 움직임 줄이기·저사양이면 끈다', () => {
  const s = fight('sword', -40); untilStrike(s)
  const p = heroPose(s, opts)
  assert.equal(p.face, -1); assert.ok(p.dx <= 0 && p.sx > 1); assert.equal(p.ghosts, A.ghosts); assert.ok(p.ghostStep > 0, '잔상은 몸 뒤')
  const calm = fight('sword', -40); untilStrike(calm)
  const q = heroPose(calm, { ...opts, still: true })
  assert.deepEqual([q.dx, q.sx, q.sy, q.lean, q.ghosts], [0, 1, 1, 0, 0]); assert.equal(q.frame, p.frame, '칸 박자는 그대로')
  const low = fight('sword', -40); untilStrike(low); assert.equal(heroPose(low, { ...opts, low: true }).ghosts, 0)
  while (s.attack > .01) stepHaebi(s, idle, 1 / 120)
  assert.ok(Math.abs(heroPose(s, opts).dx) < A.lunge.sword * .05, '마무리 끝에 런지가 돌아와 있다')
})

test('62-A 예비: 한 번 친 뒤 다음 쿨다운 끝에만 · 첫 한 방엔 없다 · 빗나가면 준비 칸에 잠깐', () => {
  const s = fight('axe', 160), key = KITS.axe.primary as keyof HaebiRun['cool']   // 적이 걸어 들어와 첫 공격이 늦게 선다
  heroPose(s, opts)   // 판이 열린 첫 화면부터 그린다 (기억이 첫 공격을 본다)
  const seen: number[] = []
  for (let i = 0; i < 2000 && !(s.cool[key] > 0 && s.cool[key] <= A.roles.strike.anticTime && seen.includes(14)); i++) { stepHaebi(s, idle, 1 / 120); seen.push(heroPose(s, opts).frame) }
  assert.ok(seen.indexOf(14) > 0, '적이 다가온 뒤 첫 공격'); assert.equal(seen.slice(0, seen.indexOf(14)).indexOf(13), -1, '첫 공격 전엔 예비 없음')
  assert.equal(heroPose(s, opts).frame, 13, '다음 공격 직전 예비(젖힘)')
  untilStrike(s); assert.equal(heroPose(s, opts).frame, 14)
  // 적이 사라지면: 예비 → 쿨다운 끝 → 준비 칸 잠깐 → 서기
  const g = fight('axe'); heroPose(g, opts); untilStrike(g)
  // 적이 사라진 뒤 남은 쿨다운이 anticCancel 보다 짧아야 준비 칸이 보인다 (11-24 예비 시간을 늘려 .3 몫으로는 모자람)
  while (g.cool[key] > Math.min(A.roles.strike.anticTime * .3, A.anticCancel * .5)) { stepHaebi(g, idle, 1 / 120); heroPose(g, opts) }
  assert.equal(heroPose(g, opts).frame, 13)
  g.enemies.length = 0
  while (g.cool[key] > 0) { stepHaebi(g, idle, 1 / 120); heroPose(g, opts) }
  assert.equal(heroPose(g, opts).frame, A.roles.strike.ready)
  for (let i = 0; i < Math.ceil(A.anticCancel * 120) + 1; i++) stepHaebi(g, idle, 1 / 120)
  assert.ok(A.idle.includes(heroPose(g, opts).frame as 0 | 1 | 2))
})

test('62-A 걷기: 칸은 걸은 거리로만 · 한 프레임에 여러 번 물어도 한 번 · 멈추면 한 박 늦게 서기', () => {
  const a = createHaebi(3), b = createHaebi(3); a.spawn = b.spawn = 99
  const right = { x: 1, y: 0 }
  const fa: number[] = [], fb: number[] = []
  heroPose(a, opts); heroPose(b, opts)   // 판이 열린 첫 화면부터 그린다
  for (let i = 0; i < 48; i++) { stepHaebi(a, right, 1 / 120); fa.push(heroPose(a, opts).frame); heroPose(a, opts) }
  for (let i = 0; i < 24; i++) { stepHaebi(b, right, 1 / 120); stepHaebi(b, right, 1 / 120); fb.push(heroPose(b, opts).frame) }
  assert.deepEqual(fb, fa.filter((_, i) => i % 2 === 1), '같은 거리 = 같은 칸 (프레임 빠르기와 상관없이)')
  assert.ok(new Set(fa).size > 1 && fa.every(f => f >= A.walkCell && f < A.walkCell + opts.cells))
  const last = heroPose(a, opts); assert.ok(last.lean > 0, '오른쪽으로 걸으면 위가 오른쪽으로'); assert.notEqual(last.sy, 1)
  stepHaebi(a, idle, 1 / 120)
  assert.equal(heroPose(a, opts).frame, last.frame, '멈춘 직후엔 마지막 걸음 칸')
  for (let i = 0; i < Math.ceil(A.settle * 120) + 1; i++) stepHaebi(a, idle, 1 / 120)
  const stood = heroPose(a, opts); assert.ok((A.idle as readonly number[]).includes(stood.frame)); assert.equal(stood.sy, 1)
})

test('62-A 그리는 쪽은 판 상태를 바꾸지 않는다 (몸놀림을 물어도 같은 판)', () => {
  const a = fight('spear'), b = fight('spear')
  for (let i = 0; i < 900; i++) {
    const input = { x: Math.sin(i / 50), y: Math.cos(i / 70) }
    stepHaebi(a, input, 1 / 120); stepHaebi(b, input, 1 / 120)
    heroPose(a, { ...opts, stopped: i % 7 === 0 }); heroFrame(a); heroFrame(a, true)
  }
  assert.deepEqual(a, b)
  assert.ok(C.heroPx > 0)
})

test('맞음 두 칸(계획 hurt): 약하게 맞으면 움츠림만 · 크게 맞으면 움츠림 hurtSnap 초 뒤 젖혀짐 · 계획 없으면 예전 맞음 칸 (11-24)', () => {
  const plan = { cells: 38, base: [0, 1], hold: 2.4, hurt: [34, 35], rise: [36, 37] }
  const o = { ...opts, idle: { plan, seed: 1 } }
  const hit = (s: HaebiRun, share: number) => { s.t += 1 / 120; s.hp -= s.maxHp * share; s.hurt = .3 }
  const light = createHaebi(7, 'stage', 'spear'); light.spawn = 99; heroPose(light, o)
  hit(light, A.hurtStrong / 2)
  assert.equal(heroPose(light, o).frame, 34, '약하게 맞음 = 움츠림')
  light.t += A.hurtSnap + .02; light.hurt = .1
  assert.equal(heroPose(light, o).frame, 34, '약하게 맞으면 끝까지 움츠림')
  const strong = createHaebi(7, 'stage', 'spear'); strong.spawn = 99; heroPose(strong, o)
  hit(strong, A.hurtStrong * 2)
  assert.equal(heroPose(strong, o).frame, 34, '크게 맞아도 처음엔 움츠림')
  strong.t += A.hurtSnap + .02; strong.hurt = .2
  assert.equal(heroPose(strong, o).frame, 35, '그다음 젖혀짐')
  const old = createHaebi(7, 'stage', 'spear'); old.spawn = 99; heroPose(old, opts)
  hit(old, A.hurtStrong * 2)
  assert.equal(heroPose(old, opts).frame, A.hurtCell, '계획에 맞음 칸이 없으면 예전 그대로')
})

test('일어남 두 칸(계획 rise): 되살아난 직후 riseTime 초 동안 한 무릎 → 넓게 섬 · 그 뒤 예전대로 (11-24)', () => {
  const plan = { cells: 38, base: [0, 1], hold: 2.4, hurt: [34, 35], rise: [36, 37] }
  const o = { ...opts, idle: { plan, seed: 1 } }
  const s = createHaebi(7, 'stage', 'spear'); s.spawn = 99; s.revives = 1; heroPose(s, o)
  s.t += 1 / 120; s.revives = 0; s.hp = s.maxHp / 2; s.hurt = 0
  assert.equal(heroPose(s, o).frame, 36, '한 무릎')
  s.t += A.riseTime * A.riseSplit + .01
  assert.equal(heroPose(s, o).frame, 37, '넓게 섬')
  s.t += A.riseTime
  assert.ok(![36, 37].includes(heroPose(s, o).frame), '그 뒤엔 서기')
})
