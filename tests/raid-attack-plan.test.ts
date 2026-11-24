// 띠마다 공격 칸 계획 · 싸움 자세 (11-23 참고 연구: 기본 공격 그린 칸 9~11 장 · 적이 있으면 다른 서기) — 화면만 · 판 셈 그대로
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { HAEBI_ANIM as A, HAEBI_IDLE as I, P } from '../src/tune/params.ts'
import { planAttackCell, planLead, planLength, type AttackPlan } from '../src/raid/attack-plan.ts'
import { attackFrame, attackRole, heroPose } from '../src/raid/hero-motion.ts'
import { idlePlan, idleSeed, planFrame, idleEvents, type IdlePlan } from '../src/raid/hero-idle.ts'
import { fighterMotion, LEGACY_ATLAS, DUEL_ATLASES, pxAtlas } from '../src/duel/fighter-motion.ts'
import { createHaebi, stepHaebi, choose, spawnMob, KIT_RULES } from '../src/raid/haebi.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'

/** 시험용 범 공격 계획 (지금 있는 12~17 칸 · 내보내는 값이 아니다) */
const six: AttackPlan = { cells: [12, 13, 14, 15, 16, 17], times: [.09, .07, .05, .05, .08, .12], hit: 2 }
const hash = (a: number[]) => createHash('sha256').update(a.join(',')).digest('hex')

test('계획이 없으면 예전과 칸·몸 변형이 같다 (넣기 전 코드로 잰 봇 판 · 겨루기 칸)', () => {
  // 넣기 전 코드(커밋 6b569ca9)로 잰 값 — 숲 90초 봇 판의 heroPose 칸·런지·늘임
  // 11-24 활만 다시 잼: 형 「시위 당겼을 때 텀이 있어야 타격감」 → 예비 시간 .14 → .36 · 다 당긴 칸에 anticHold 몫 (도끼·창은 이 봇 판에서 예비가 안 보여 그대로)
  const BEFORE = { axe: '14a376d3294dd69edfce415b6863688406e57fd836ce69612e1a969a1ffe3fae', bow: '4b20d613de220d1ecb844818273bca37979b9d16f0269316bd393879b9667544', spear: '3a09dcd126a6e9163c4a315c670af716e4d2bc4153ecf8cb5e81d59c602bdac9' }
  for (const kit of ['axe', 'bow', 'spear'] as const) {
    const s = createHaebi(11, 'stage', kit, { stage: 'forest', simRules: '56B', kitRules: KIT_RULES }), frames: number[] = []
    for (let i = 0; i < 90 * 120 && s.state === 'playing'; i++) {
      if (s.offers.length) choose(s, botChoice(s, 'storm')); else stepHaebi(s, botInput(s, .5), 1 / 120)
      const p = heroPose(s, { stride: 73, cells: 8 }); frames.push(p.frame, Math.round(p.dx * 100), Math.round(p.sx * 1000))
    }
    assert.equal(hash(frames), BEFORE[kit], kit)
  }
  const d: number[] = []
  for (const atlas of [LEGACY_ATLAS, DUEL_ATLASES.aryeong!]) for (const kind of ['attack', 'windup', 'idle', 'hit', 'guard'] as const) for (let t = 0; t < 1500; t += 7) d.push(fighterMotion(atlas, { kind, t0: 0 }, t, false).frame)
  assert.equal(hash(d), '78334a06a67ea0f95f1a68ff9ecc2761660d4f9405988d8c0497bd4f53310cd1')
})

test('planAttackCell: 맞힘 칸은 hitAt 에 서고 제 초를 지킨다 · 앞은 줄이거나 붙들고 · 뒤는 남은 시간 안에 · 끝나면 null', () => {
  const at = (age: number, hitAt = .2, end = .5) => planAttackCell(six, age, hitAt, end)
  assert.equal(at(.2), 14); assert.equal(at(.2 + .05 - 1e-9), 14, '맞힘 칸 제 초 그대로'); assert.equal(at(.25), 15)
  // 앞이 길면(.16 > .1) 줄인다 · 짧으면(.16 < .3) 첫 칸을 붙들었다 시작
  const seqShort = [0, .02, .04, .06, .08, .099].map(a => planAttackCell(six, a, .1, .5)); assert.deepEqual([...new Set(seqShort)], [12, 13])
  assert.equal(planAttackCell(six, 0, .3, .6), 12); assert.equal(planAttackCell(six, .1, .3, .6), 12, '붙든다'); assert.equal(planAttackCell(six, .3 - .03, .3, .6), 13)
  // 뒤가 길면 줄이고 · 짧으면 마지막 칸을 end 까지
  assert.equal(at(.499), 17); assert.equal(at(.5), null)
  assert.equal(planAttackCell(six, .9, .2, 1), 17, '모자라면 마지막 칸을 붙든다')
  // 차례는 되돌아가지 않는다
  let last = -1; for (let a = 0; a < .5; a += .001) { const c = at(a)!; assert.ok(six.cells.indexOf(c) >= six.cells.indexOf(last as number) || last === -1); last = c }
  // 맞은 멈춤(held) 동안은 맞힘 칸
  assert.equal(planAttackCell(six, .1, .2, .5, true), 14)
  assert.ok(Math.abs(planLength(six) - .46) < 1e-12 && Math.abs(planLead(six) - .16) < 1e-12)
})

test('열전: 계획이 있으면 맞힘 앞 마지막 칸이 휘두름 · 맞힘 칸은 예전 맞힘 때에 · 마무리는 공격 시계 안 · 그 앞 칸은 예비', () => {
  const role = attackRole('sword', six)
  assert.deepEqual(role.antic, [12]); assert.deepEqual(role.swing, [13]); assert.equal(role.contact, 14); assert.deepEqual(role.recover, [15, 16, 17])
  assert.equal(attackFrame(role, 0), 13); assert.equal(attackFrame(role, A.swing), 14); assert.equal(attackFrame(role, A.swing + .05 - 1e-9), 14)
  assert.equal(attackFrame(role, A.swing + .05), 15); assert.equal(attackFrame(role, A.window - 1e-6), 17); assert.equal(attackFrame(role, A.window), null)
  assert.equal(attackFrame(role, .01, false, true), 14, '맞은 멈춤')
  assert.ok((attackFrame(role, A.swing + .05 + A.moveRecover, true) ?? null) === null, '걷는 중이면 마무리를 짧게')
  // 계획 없는 역할은 예전 그대로
  assert.equal(attackRole('sword'), A.roles.strike); assert.equal(attackRole('bow'), A.roles.draw)
})

test('겨루기: 계획이 있으면 맞힘 칸이 예전 맞힘 칸(15)이 보이던 때에 선다 · 공격 길이 안', () => {
  const atlas = { ...pxAtlas('beom'), plan: { ...pxAtlas('beom').plan!, attack: six } }
  const ms = P.duel.fighterAttackMs, hitAt = LEGACY_ATLAS.attack.indexOf(15) / LEGACY_ATLAS.attack.length * ms
  assert.equal(fighterMotion(LEGACY_ATLAS, { kind: 'attack', t0: 0 }, hitAt + 1, false).frame, 15, '예전 맞힘 때')
  assert.equal(fighterMotion(atlas, { kind: 'attack', t0: 0 }, hitAt + 1, false).frame, 14, '계획의 맞힘 칸')
  assert.equal(fighterMotion(atlas, { kind: 'attack', t0: 0 }, 0, false).frame, 12)
  assert.equal(fighterMotion(atlas, { kind: 'attack', t0: 0 }, ms - 1, false).frame, 17)
})

test('싸움 자세: 가까이 적이 있으면 stance 칸 · 떠난 뒤 stanceLinger 초까지 · 그동안 깜빡임만 · 쓰는 띠는 아직 없다', () => {
  const plan: IdlePlan = { cells: 26, base: [0, 1], hold: 2.4, blink: 2, breath: [3], quirk: [22, 23, 24, 25], stance: [5, 6] }
  for (const name of ['beom', 'maehwa']) assert.equal(idlePlan(`anim-px/gen-${name}.png`)!.stance, undefined)
  const seed = idleSeed('beom'), seen = new Set<number>()
  for (let t = 0; t < 120; t += .02) seen.add(planFrame(plan, seed, t, false, true))
  assert.deepEqual([...seen].sort((a, b) => a - b), [2, 5, 6], 'stance 칸과 깜빡임만')
  assert.ok(idleEvents(plan, seed, 0).some(e => e.kind !== 'blink'), '자세가 아닐 땐 숨·버릇도 온다')
  // 판 위 — 적이 가까이 오면 자세 · 떠나면 stanceLinger 뒤 base
  const s = createHaebi(5, 'stage', 'axe', { stage: 'forest', simRules: '56B', kitRules: KIT_RULES })
  s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9
  const o = { stride: 120, cells: 8, idle: { plan, seed } }
  for (let i = 0; i < 240; i++) { stepHaebi(s, { x: 0, y: 0 }, 1 / 120); heroPose(s, o) }
  assert.ok([0, 1, 2, 3, 22, 23, 24, 25].includes(heroPose(s, o).frame), '적이 없으면 base')
  spawnMob(s, 'club', undefined, true); const e = s.enemies[s.enemies.length - 1]!; e.x = s.x + I.stanceR - 20; e.y = s.y; e.cd = 99; e.hp = e.max = 1e9
  s.ranks[KIT_RULES ? 'axe' : 'axe'] = 1; s.cool.axe = 99
  heroPose(s, o); assert.ok([5, 6, 2].includes(heroPose(s, o).frame), `가까이 적 → 자세 (${heroPose(s, o).frame})`)
  e.x = s.x + I.stanceR * 4
  for (let i = 0; i < Math.round((I.stanceLinger - .3) * 120); i++) { s.t += 1 / 120; heroPose(s, o) }
  assert.ok([5, 6, 2].includes(heroPose(s, o).frame), '떠난 뒤 잠깐은 자세')
  for (let i = 0; i < Math.round(.6 * 120); i++) { s.t += 1 / 120; heroPose(s, o) }
  assert.ok(![5, 6].includes(heroPose(s, o).frame), 'stanceLinger 뒤 base')
})

test('매화 계획과 덧 띠 · 겨루기도 도트 띠', () => {
  const m = idlePlan('anim-px/gen-maehwa.png')!
  assert.equal(m.cells, 26); assert.deepEqual(m.fall, [18, 20, 21, 19]); assert.deepEqual(m.quirk, [22, 23, 24, 25]); assert.deepEqual(m.quirkTimes, [.28, .3, .42, .25])
  const png = readFileSync(new URL('../public/realm/anim-px/gen-maehwa-x.png', import.meta.url)), main = readFileSync(new URL('../public/realm/anim-px/gen-maehwa.png', import.meta.url))
  assert.equal(png.readUInt32BE(16), main.readUInt32BE(16) / 20 * 6); assert.equal(png.readUInt32BE(20), main.readUInt32BE(20))
  assert.deepEqual(pxAtlas('maehwa').fall, [18, 20, 21, 19])
  // 달빛 (덧 띠 「머리카락 넘기기」)
  const d = idlePlan('anim-px/gen-base-w-31-dabeol-dalbit.png')!
  assert.equal(d.cells, 26); assert.deepEqual(d.quirk, [22, 23, 24, 25]); assert.deepEqual(d.quirkTimes, [.28, .42, .3, .25]); assert.deepEqual(d.fall, [18, 20, 21, 19])
  const dx = readFileSync(new URL('../public/realm/anim-px/gen-base-w-31-dabeol-dalbit-x.png', import.meta.url)), dm = readFileSync(new URL('../public/realm/anim-px/gen-base-w-31-dabeol-dalbit.png', import.meta.url))
  assert.equal(dx.readUInt32BE(16), dm.readUInt32BE(16) / 20 * 6); assert.equal(dx.readUInt32BE(20), dm.readUInt32BE(20))
})

test('범 할퀴기(덧 띠 26~33): 26·27 예비 · 28 휘두름 · 29 맞힘이 예전 맞힘 때 · 코드 런지·늘임·잔상은 끈다 · 겨루기도', () => {
  const beom = idlePlan('anim-px/gen-beom.png')!
  assert.equal(beom.cells, 34); assert.deepEqual(beom.attack!.cells, [26, 27, 28, 29, 30, 31, 32, 33]); assert.equal(beom.attack!.hit, 3)
  const role = attackRole('dagger', beom.attack)
  assert.deepEqual(role.antic, [26, 27]); assert.deepEqual(role.swing, [28]); assert.equal(role.contact, 29); assert.deepEqual(role.recover, [30, 31, 32, 33])
  assert.equal(attackFrame(role, 0), 28); assert.equal(attackFrame(role, A.swing), 29); assert.equal(attackFrame(role, A.swing + .07 - 1e-9), 29, '맞힘 칸 .07초 그대로')
  assert.deepEqual([...new Set(Array.from({ length: 300 }, (_, i) => attackFrame(role, i / 1000)))], [28, 29, 30, 31, 32, 33], '공격 시계 안에 차례대로 다 보인다')
  // 판 위 — 그린 공격 칸에는 코드 런지·늘임·잔상이 없다
  const s = createHaebi(5, 'stage', 'dagger', { stage: 'forest', simRules: '56B', kitRules: KIT_RULES })
  s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9
  spawnMob(s, 'club', undefined, true); const e = s.enemies[s.enemies.length - 1]!; e.x = s.x + 40; e.y = s.y; e.hp = e.max = 1e9; e.cd = 99
  const o = { stride: 120, cells: 8, idle: { plan: beom, seed: idleSeed('beom') } }
  let seen = 0
  for (let i = 0; i < 4 * 120; i++) { stepHaebi(s, { x: 0, y: 0 }, 1 / 120); const p = heroPose(s, o); if (beom.attack!.cells.includes(p.frame)) { seen++; assert.equal(p.dx, 0); assert.equal(p.sx, 1); assert.equal(p.ghosts, 0) } }
  assert.ok(seen > 10, `공격 칸을 보였다 (${seen})`)
  // 겨루기: 맞힘 칸 29 가 예전 맞힘 때 · 코드 런지 없음
  const atlas = pxAtlas('beom'), ms = P.duel.fighterAttackMs, hitAt = LEGACY_ATLAS.attack.indexOf(15) / LEGACY_ATLAS.attack.length * ms
  assert.deepEqual(fighterMotion(atlas, { kind: 'attack', t0: 0 }, hitAt + 1, false), { frame: 29, dx: 0 })
})

test('새 길로 다시 그린 띠(범 · 매화 · 달빛)는 옛 2배 띠를 잇지 않고 · 발 줄·키는 새 그림 실측', async () => {
  const { HERO_HD } = await import('../src/raid/hero-hd.ts')
  const { SPRITE_PX } = await import('../src/realm/data/spritePx.ts')
  for (const k of ['beom', 'maehwa', 'base-w-31-dabeol-dalbit']) {
    assert.equal(HERO_HD[`anim-px/gen-${k}.png`], undefined, k)
    const px = SPRITE_PX[`gen-${k}`]!
    assert.deepEqual(px.cell, [208, 160]); assert.equal(px.feet, 154, k)
  }
  assert.equal(SPRITE_PX['gen-beom']!.bodyPx, 136); assert.equal(SPRITE_PX['gen-base-w-31-dabeol-dalbit']!.bodyPx, 139)
  assert.equal(SPRITE_PX['gen-maehwa']!.bodyPx, 131, '매화 139 에서 깃털 모자 8 (headgear.json) 을 뺀 키')
})
