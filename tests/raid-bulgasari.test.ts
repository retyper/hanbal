// 57 목책 돌파 거대 보스 「불가사리」 — 규칙 57-BULGASARI 는 목책 돌파에만 · 큰 문 등장 · 여섯 수의 고정 예고·봉인·박자 · 철갑 → 살 · 목책과 얽힘 · 막별 안전로 · 기록 재생
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { HAEBI_GIANT as G, HAEBI_BULGASARI as B, HAEBI_RUN as C, HAEBI_STAGES as ST, HAEBI_PALISADE as WL } from '../src/tune/params.ts'
import { makeRng } from '../src/core/rng.ts'
import { createHaebi, stepHaebi, choose, giantHUD, raidRulesForStage, usesGiantBoss, usesPalisade, normalizedRaidOpts, runDuration, bossTime, midbossTime, spawnGiant, type HaebiOpts, type HaebiRun, type Kit, type StageId } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, finishRecord, replayRaid, STEP } from '../src/raid/runlog.ts'
import { createBulgasari, stepBulgasari, commitBulgasari, beginBulgasariMove, planBulgasari, bulgasariCandidates, bulgasariContact, bulgasariEnvironment, bulgasariFrame, bulgasariSafeSpot, bulgasariWindup, damageBulgasariPart, updateBulgasariPose, bulgasariCollisionBounds, type BulgasariState, type BulgasariMove, type BulgasariStep } from '../src/raid/bulgasari.ts'
import { createPalisade, damagePiece, sweepWall, type Palisade } from '../src/raid/palisade.ts'
import type { GiantOwner } from '../src/raid/imugi.ts'
import { overlaps, type Shape } from '../src/raid/giant-core.ts'
import { bulgasariLayout, drawBulgasari, drawBulgasariGround, drawBulgasariThreats } from '../src/raid/bulgasari-view.ts'
import { BULGASARI_ART, BULGASARI_PIECES, BULGASARI_SOURCE } from '../src/raid/bulgasari-art.ts'

const DT = 1 / 120, W = C.width, H = C.height
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const MOVES = Object.keys(B.moves) as BulgasariMove[]
const point = (p: { x: number; y: number }): Shape => ({ kind: 'circle', center: { x: p.x, y: p.y }, radius: 0 })
/** 막 3까지 다 열린 조용한 불가사리 (판 없이 · 등장은 끝났다) — back 이 0 이면 쌍돌진이 열린다 */
function actor(phase: 1 | 2 | 3 = 3, x = 360, wall?: Palisade) {
  const e: GiantOwner = { id: 9, x, y: B.homeY, hp: B.hp, max: B.hp }, g = createBulgasari(e, 0, wall, W)
  const rest = bulgasariFrame(x, B.homeY, 1, B.motion.rest)
  g.motion = { ...g.motion, from: rest, prepared: rest, impact: rest, relaxed: rest, current: rest, recoverFrom: rest }
  g.phase = phase; g.state = 'recover'; g.timer = 0; g.age = B.entrySeconds; updateBulgasariPose(g, e, 1)
  return { e, g }
}
/** 이 수가 쓰이는 자리에 장수를 둔다 (불가사리는 오른쪽을 본다) */
function targetFor(e: GiantOwner, move: BulgasariMove) {
  if (move === 'suction') return { x: e.x + 380, y: e.y - 60 }
  if (move === 'stomp') return { x: e.x + 200, y: e.y + 30 }
  if (move === 'burrow') return { x: e.x + 380, y: e.y + 40 }
  if (move === 'spin') return { x: e.x + 150, y: e.y + 110 }
  return { x: e.x + 330, y: e.y + 40 }
}
/** 그 수를 쓸 수 있게 (쌍돌진은 등 철갑을 벗긴다) */
function ready(move: BulgasariMove) {
  const a = actor(B.moves[move].phase === 1 ? 1 : B.moves[move].phase)
  if (move === 'double') a.g.partHP.back = 0
  a.g.phase = 3; return a
}
const input = (player: { x: number; y: number }, random: () => number = () => 0, extra: Partial<BulgasariStep> = {}): BulgasariStep => ({ dt: DT, tick: 1, player, speed: C.speed, dazed: false, random, ...extra })
const step = (g: BulgasariState, e: GiantOwner, player: { x: number; y: number }, random: () => number = () => 0, extra: Partial<BulgasariStep> = {}) => stepBulgasari(g, e, input(player, random, extra))
const quiet = (g: BulgasariState) => { g.environment.active = false; g.environment.age = -1e9 }
/** 장수가 (from → to) 로 걸어갈 때 성한 마디에 막히나 (빈 원 찾기와 같은 잣대) */
const sweepWallOf = (wall: Palisade, from: { x: number; y: number }, to: { x: number; y: number }) => !!sweepWall(wall, from.x, from.y, to.x, to.y, WL.heroR)

test('57-BULGASARI 는 목책 돌파에만 선다 · 다른 판은 56B 그대로 · 진짜 목책(56C)도 같이 선다', () => {
  assert.equal(raidRulesForStage('palisade'), '57-BULGASARI'); assert.equal(raidRulesForStage('ford'), '55-IMUGI'); assert.equal(raidRulesForStage('snow'), '55-TIGER')
  assert.equal(raidRulesForStage('forest'), '55-GUMIHO'); assert.equal(raidRulesForStage('fortress'), '55-SHAMAN')
  for (const stage of ['forest', 'ford', 'snow', 'fortress'] as const) {
    const a = createHaebi(7, 'stage', 'sword', { stage, simRules: '57-BULGASARI' }), b = createHaebi(7, 'stage', 'sword', { stage, simRules: '56B' })
    assert.equal(usesGiantBoss(a), false, stage); assert.equal(usesPalisade(a), false, stage)
    for (let i = 0; i < 60 * 20; i++) { stepHaebi(a, { x: 0, y: 0 }, 1 / 60); stepHaebi(b, { x: 0, y: 0 }, 1 / 60) }
    assert.deepEqual(a, b, `${stage}: 57 을 넣어도 56B 와 같은 판`)
  }
  assert.equal(usesGiantBoss(createHaebi(7, 'trial', 'axe', { simRules: '57-BULGASARI' })), false)
  const old = createHaebi(7, 'stage', 'axe', { stage: 'palisade', simRules: '56C' })
  assert.equal(usesGiantBoss(old), false, '옛 56C 목책 기록은 거대 보스 없이 다시 돈다'); assert.equal(usesPalisade(old), true); assert.equal(runDuration(old), 1230)
  const s = createHaebi(7, 'stage', 'axe', { stage: 'palisade', simRules: '57-BULGASARI' })
  assert.equal(usesGiantBoss(s), true); assert.equal(usesPalisade(s), true); assert.equal(runDuration(s), 1380); assert.equal(midbossTime(s), 600)
  assert.equal(normalizedRaidOpts(s, { stage: 'palisade' }).simRules, '57-BULGASARI')
})

// 작업 전(dc0c3c0f) 같은 입력으로 잰 판 상태 SHA — 불가사리를 넣어도 다른 판은 바이트까지 같다.
// (다른 판의 셈이나 수치를 일부러 바꾼 작업이면 이 기준도 같이 새로 잰다 · raid-giant-replay 의 옛 기록 SHA 와 같은 성격)
const BONUS = { might: 10, vigor: 10, armor: 5, regen: 5, haste: 5, swift: 5 }
function scenario(stage: StageId, simRules: NonNullable<HaebiOpts['simRules']>, seed: number, kit: Kit, seconds: number, length?: number) {
  const was = ST[stage].length
  if (length !== undefined) Object.assign(ST[stage], { length })
  try {
    const s = createHaebi(seed, 'stage', kit, { stage, simRules, bonus: BONUS })
    while (s.t < seconds && s.state === 'playing') { if (s.offers.length) choose(s, botChoice(s, 'storm')); else stepHaebi(s, botInput(s, .5), 1 / 120) }
    return hash(s)
  } finally { Object.assign(ST[stage], { length: was }) }
}
test('여울(이무기) · 설원(백두 대호) · 숲 · 산성 · 옛 56C 목책 판은 작업 전과 같은 상태', () => {
  assert.equal(scenario('palisade', '56C', 31, 'spear', 150), '08c272a7c23dd6d958a8c17d4726cc385ce8195b6c61cd8d10a4b8592364a329', '옛 56C 목책')
  assert.equal(scenario('palisade', '56C', 41, 'sword', 200, .12), '50df03f1d6782391152b128f8fac78b4ed1faf9756961e5fc9750160e57adb57', '옛 56C 목책 두목까지')
  assert.equal(scenario('ford', '55-IMUGI', 41, 'sword', 200, .12), 'caca94c56191d22f841499c6f67f3b26e265f6a2f35df486437b94af0318a5f3', '여울 이무기 싸움까지')
  assert.equal(scenario('snow', '55-TIGER', 41, 'sword', 200, .12), '6d5e78779ef3f7c7e8f0bd0633156dcc9720977fea2aa95d628f90ea157afd39', '설원 백두 대호 싸움까지')
  assert.equal(scenario('forest', '56B', 7, 'axe', 120), '3a6f690af9077a18d6b07d2abb1fb33937901a1e9f428e29a6985cb8e246b7b1', '숲')
  assert.equal(scenario('fortress', '56B', 11, 'sword', 120), '22cc45cad5263cb2a71ffba1ec11901fd897dc1128193dea3bf0a546eaa49fc1', '산성')
})

test('57 의 목책 돌파는 10분 중간 보스 전까지 56C 와 같은 판이다 (거대 보스 흐름 표시만 다르다)', () => {
  const a = createHaebi(31, 'stage', 'spear', { stage: 'palisade', simRules: '57-BULGASARI', bonus: BONUS }), b = createHaebi(31, 'stage', 'spear', { stage: 'palisade', simRules: '56C', bonus: BONUS })
  for (const s of [a, b]) while (s.t < 200 && s.state === 'playing') { if (s.offers.length) choose(s, botChoice(s, 'storm')); else stepHaebi(s, botInput(s, .5), 1 / 120) }
  assert.ok(a.giantFlow && !a.giantFlow.midSpawned && !b.giantFlow)
  const { giantFlow, ...rest } = a; void giantFlow
  assert.equal(JSON.stringify(rest), JSON.stringify(b))
})

/** 거대 보스 때 직전의 조용한 57 판 (잡졸·정예·일제 사격 없음) */
function bossRun(seed = 31, kit: Kit = 'sword') {
  const s = createHaebi(seed, 'stage', kit, { stage: 'palisade', simRules: '57-BULGASARI' }); s.spawn = s.nextElite = s.nextBarrage = 1e9
  s.giantFlow!.midSpawned = s.giantFlow!.midDefeated = true; s.t = bossTime(s) - DT
  return s
}
const bulgasari = (s: HaebiRun) => s.enemies.find(e => e.giant?.kind === 'bulgasari')
test('10분 중간 보스는 배신한 성주(체력 몫) · 19분 거대 보스는 불가사리 · 이름이 HUD 와 격파 알림에', () => {
  const s = createHaebi(31, 'stage', 'sword', { stage: 'palisade', simRules: '57-BULGASARI' }); s.spawn = s.nextElite = s.nextBarrage = 1e9
  s.t = midbossTime(s) - DT; stepHaebi(s, { x: 0, y: 0 }, DT)
  const mid = s.enemies.find(e => e.bossRole === 'midboss')!
  assert.ok(mid && !mid.giant && mid.champion); assert.ok(Math.abs(mid.max - C.bossHp * ST.palisade.bossHp * 6 * B.midHpScale) < 1e-6, `${mid.max}`)
  s.enemies = []; s.t = bossTime(s) - DT; stepHaebi(s, { x: 0, y: 0 }, DT)
  const e = bulgasari(s)!
  assert.equal(e.giant!.kind, 'bulgasari'); assert.equal(e.max, B.hp); assert.equal(giantHUD(s)!.name, '불가사리')
  assert.ok(e.giant!.pose.parts.every(p => !p.targetable), '등장 동안은 맞지 않는다')
  const g = e.giant as BulgasariState
  g.state = 'recover'; g.timer = 5; g.age = B.entrySeconds; e.hp = 1; updateBulgasariPose(g, e, 1)
  s.x = e.x; s.y = e.y + 60; s.shots.push({ x: e.x, y: e.y - 120, vx: 0, vy: 0, life: 0, kind: 'rain', damage: 1e9, radius: 260, hit: [], angle: 0, tx: 0, ty: 0 })
  stepHaebi(s, { x: 0, y: 0 }, DT)
  assert.equal(s.state, 'won'); assert.equal(s.message, '불가사리 격파 · 토벌 완료'); assert.equal(s.giantFlow!.finalDefeated, true)
})

test('큰 문이 서 있으면 문 쇠붙이를 두 번 씹고 부수며 뛰쳐나온다 · 그 앞 마디도 쓰러진다 · 땅울림과 포효', () => {
  const s = bossRun(), P = s.palisade!, gate = P.pieces.find(p => p.kind === 'g')!
  stepHaebi(s, { x: 0, y: 0 }, DT)
  const e = bulgasari(s)!, g = e.giant as BulgasariState, start = { x: e.x, y: e.y }
  assert.equal(g.state, 'entry'); assert.ok(e.y < P.y, `목책 뒤에서 온다 (${e.y})`); assert.equal(g.entry.gateDown, false)
  const mouth = (g.entry.door.x + g.entry.facing * 0) // 문 위에 입이 오도록 선 자리
  void mouth
  let chomped = false, brokenDuring = false, cues: string[] = [], behind = 0
  const intactBefore = P.pieces.filter(p => p.kind === 'w' && p.hp > 0).length
  while (g.state === 'entry') {
    const fx = s.fx.length, hp = gate.hp
    stepHaebi(s, { x: 0, y: 0 }, DT)
    for (const f of s.fx.slice(fx)) if (f.championCue) cues.push(f.championCue)
    if (gate.hp < hp && gate.hp > 0) chomped = true
    if (gate.hp === 0 && P.gateBrokenAt !== undefined) brokenDuring = true
    if (e.y < P.y) behind++
    if (g.state === 'entry') assert.ok(g.pose.parts.every(p => !p.targetable), '등장 동안은 맞지 않는다')
  }
  assert.ok(chomped, '부서지기 전에 씹혀 깎였다'); assert.ok(brokenDuring, '등장 중에 부서졌다')
  assert.ok(Math.abs(P.gateBrokenAt! - (bossTime(s) + B.entry.burst * B.entrySeconds)) < .05, `부서진 때 ${P.gateBrokenAt}`)
  assert.ok(behind > 0 && e.y > P.y + 150, `목책 앞으로 내려섰다 (${start.y} → ${e.y})`); assert.equal(e.y, B.homeY)
  assert.ok(P.pieces.filter(p => p.kind === 'w' && p.hp > 0).length < intactBefore, '뛰쳐나온 몸 앞 마디가 쓰러졌다')
  assert.ok(cues.includes('quake') && cues.includes('roar'), cues.join())
  assert.ok(g.pose.parts.some(p => p.targetable), '등장이 끝나면 맞는다')
})

test('큰 문이 이미 부서졌으면 씹지 않고 부서진 문으로 곧장 뛰쳐나온다 (부서진 때는 그대로)', () => {
  const s = bossRun(), P = s.palisade!, gate = P.pieces.find(p => p.kind === 'g')!
  damagePiece(P, gate, gate.hp, 500)
  stepHaebi(s, { x: 0, y: 0 }, DT)
  const e = bulgasari(s)!, g = e.giant as BulgasariState
  assert.equal(g.entry.gateDown, true)
  let cues: string[] = []
  while (g.state === 'entry') { const fx = s.fx.length; stepHaebi(s, { x: 0, y: 0 }, DT); for (const f of s.fx.slice(fx)) if (f.championCue) cues.push(f.championCue) }
  assert.equal(P.gateBrokenAt, 500); assert.equal(gate.hp, 0); assert.equal(e.y, B.homeY)
  assert.ok(cues.includes('quake') && cues.includes('roar'), cues.join())
})

test('여섯 수 모두 몸 준비 → 붉은 바닥(고정) → 타격 · 몸 예고 동안엔 바닥이 없다 · 총예고 0.5~2.5초 · 판 안에 몸이 들어온다', () => {
  for (const move of MOVES) {
    const { e, g } = ready(move), target = targetFor(e, move)
    assert.ok(bulgasariCandidates(g, e, target).includes(move), `${move} 후보`)
    assert.ok(beginBulgasariMove(g, e, target, move, 2, C.speed, () => .5), `${move} 세움`)
    const shapes = g.attack!.shapes, serial = JSON.stringify(shapes), w = g.attack!.windup
    assert.ok(Object.isFrozen(shapes))
    assert.ok(w.total >= G.windup.min - 1e-9 && w.total <= G.windup.max + 1e-9, `${move} total ${w.total}`)
    let t = 0, red = 0, body = 0
    while ((g.state === 'body' || g.state === 'hold' || g.state === 'tell') && t < 5) {
      if (g.state === 'body' || g.state === 'hold') { assert.equal(g.pose.worldGeometry.tell.length, 0, `${move} 몸 예고에 바닥`); body++ }
      if (g.state === 'tell') { assert.equal(g.pose.worldGeometry.tell, shapes); red++ }
      // 장수가 움직여도 예고는 따라가지 않는다
      step(g, e, { x: target.x + Math.sin(t * 9) * 200, y: target.y + 80 }); t += DT
    }
    assert.equal(g.state, 'strike', move); assert.ok(body > 0 && red > 0, move)
    assert.equal(JSON.stringify(g.attack!.shapes), serial, `${move} 예고가 바뀌었다`)
    assert.ok(Math.abs(t - w.total) <= DT * 2, `${move} ${t} vs ${w.total}`)
    while (g.state === 'strike') step(g, e, target)
    const b = bulgasariCollisionBounds(g.pose)
    assert.ok(b.left >= -1e-6 && b.right <= W + 1e-6 && b.top >= -1e-6 && b.bottom <= H + 1e-6, `${move} 판 밖 ${JSON.stringify(b)}`)
    assert.ok(e.y <= B.floorY + 1e-6, `${move} 발이 아래 막대까지 내려갔다 (${e.y})`)
  }
})

test('빨강 = 실제 피해: 붉은 모양 안이면 맞고 밖이면 안 맞는다 (달리는 수 · 땅속 질주는 앞머리가 지난 자리)', () => {
  const inside = (g: BulgasariState, move: BulgasariMove) => {
    const a = g.attack!, s0 = a.shapes[0]!
    if (a.path) return { x: (a.path.from.x + a.path.to.x) / 2, y: (a.path.from.y + a.path.to.y) / 2 }
    if (move === 'spin') { const ang = a.lines![0]!, r = B.moves.spin.inner + 120, c = g.motion.prepared; return { x: c.x + Math.cos(ang) * r, y: c.y + Math.sin(ang) * r } }
    if (s0.kind === 'cone') return { x: s0.center.x + Math.cos(s0.angle) * 120, y: s0.center.y + Math.sin(s0.angle) * 120 }
    return (s0 as { center: { x: number; y: number } }).center
  }
  for (const move of MOVES) {
    const { e, g } = ready(move), target = targetFor(e, move)
    assert.ok(beginBulgasariMove(g, e, target, move, 2, C.speed, () => .4))
    const probe = inside(g, move)
    assert.ok(g.attack!.shapes.some(s => overlaps(s, point(probe))), `${move} 안쪽 점`)
    let hurt = 0, n = 0
    while (g.state !== 'recover' && n++ < 2400) { quiet(g); step(g, e, probe); commitBulgasari(g, e, probe, d => { hurt += d }, false, () => {}) }
    const d = B.moves[move].damage
    assert.ok(move === 'double' ? hurt === d || hurt === 2 * d : hurt === d, `${move} 안에서 한 번 (${hurt})`)
  }
  for (const move of MOVES) {
    const { e, g } = ready(move), target = targetFor(e, move)
    assert.ok(beginBulgasariMove(g, e, target, move, 2))
    const safe = bulgasariSafeSpot(g.attack!.shapes, [], target, 1e4, 1)!
    let hurt = 0, n = 0
    while (g.state !== 'recover' && n++ < 2400) {
      quiet(g); step(g, e, safe)
      // 쌍돌진 둘째 길도 밖이어야 한다 (둘째는 장수 쪽으로 다시 겨누니 따로 잰다)
      if (g.attack?.sub === 1) break
      commitBulgasari(g, e, safe, d => { hurt += d }, false, () => {})
    }
    assert.equal(hurt, 0, `${move} 밖 ${JSON.stringify(safe)}`)
  }
})

test('쇠붙이 흡수는 맞은 장수를 입 쪽으로 끌어당긴다 (구매 장비·능력치는 건드리지 않는다)', () => {
  const { e, g } = ready('suction'), target = targetFor(e, 'suction')
  assert.ok(beginBulgasariMove(g, e, target, 'suction', 2))
  const cone = g.attack!.shapes[0]!; assert.equal(cone.kind, 'cone')
  const probe = cone.kind === 'cone' ? { x: cone.center.x + Math.cos(cone.angle) * 150, y: cone.center.y + Math.sin(cone.angle) * 150 } : target
  let pulled = { x: 0, y: 0 }, n = 0
  while (g.state !== 'recover' && n++ < 1200) { quiet(g); step(g, e, probe); commitBulgasari(g, e, probe, () => {}, false, (dx, dy) => { pulled = { x: pulled.x + dx, y: pulled.y + dy } }) }
  const toward = cone.kind === 'cone' ? (cone.center.x - probe.x) * pulled.x + (cone.center.y - probe.y) * pulled.y : 0
  assert.ok(toward > 0 && Math.abs(Math.hypot(pulled.x, pulled.y) - B.moves.suction.pull) < 1e-6, JSON.stringify(pulled))
})

test('부위가 부서지면 그 수가 봉인된다 (턱 · 어깨 철판 · 앞발 · 등 철갑) · 예약된 수도 취소 · 쌍돌진은 등 철갑이 벗겨진 뒤에만', () => {
  const seal: [BulgasariMove, 'jaw' | 'shoulder' | 'fore-near' | 'back'][] = [['suction', 'jaw'], ['ram', 'shoulder'], ['stomp', 'fore-near'], ['burrow', 'back'], ['spin', 'back']]
  for (const [move, part] of seal) {
    const { e, g } = ready(move), target = targetFor(e, move)
    assert.ok(bulgasariCandidates(g, e, target).includes(move), `${move} 처음엔 후보`)
    assert.ok(beginBulgasariMove(g, e, target, move, 2))
    assert.equal(damageBulgasariPart(g, part, 1e12), true, `${part} 처음 부서짐`)
    assert.equal(g.state, 'recover', `${move} 예약 취소`); assert.equal(g.attack, null)
    assert.equal(damageBulgasariPart(g, part, 1), false, '두 번 부서지지 않는다')
    g.timer = 0; g.last = null
    assert.ok(!bulgasariCandidates(g, e, target).includes(move), `${move} 봉인`)
  }
  // 먼 쪽 앞발만 부서지면 가까운 쪽(아래) 내려찍기는 남는다
  { const { e, g } = ready('stomp'); g.partHP['fore-far'] = 0; assert.ok(bulgasariCandidates(g, e, targetFor(e, 'stomp')).includes('stomp')) }
  // 쌍돌진: 막 3 이어도 등 철갑이 성하면 없다 · 벗기면 열린다 · 두 앞발이 다 부서지면 봉인
  const { e, g } = actor(3), target = targetFor(e, 'double')
  assert.ok(!bulgasariCandidates(g, e, target).includes('double'), '등 철갑이 성하면 없다')
  g.partHP.back = 0; assert.ok(bulgasariCandidates(g, e, target).includes('double'), '벗겨지면 열린다')
  g.partHP['fore-near'] = 0; assert.ok(bulgasariCandidates(g, e, target).includes('double'), '앞발 하나로는 아직')
  g.partHP['fore-far'] = 0; assert.ok(!bulgasariCandidates(g, e, target).includes('double'), '두 앞발이 다 부서지면 봉인')
  g.phase = 2; g.partHP['fore-far'] = 1; assert.ok(!bulgasariCandidates(g, e, target).includes('double'), '막 2 에는 없다')
  // 하나만 남은 수는 연달아 쓰지 않지만 쉰 뒤에는 다시 쓴다 (봉인이 다 돼도 영영 멈춰 서지 않는다)
  {
    const { e, g } = actor(1), player = targetFor(e, 'stomp')
    g.partHP.jaw = 0; g.partHP.shoulder = 0; g.partHP['fore-far'] = 0
    const used: number[] = []
    for (let n = 0; n < 120 * 20 && used.length < 2; n++) {
      const before = g.seq; step(g, e, player); quiet(g)
      if (g.seq > before) { assert.equal(g.attack!.move, 'stomp'); used.push(n) }
    }
    assert.equal(used.length, 2, '하나 남은 앞발 내려찍기를 다시 썼다')
  }
})

test('철갑 → 살: 성한 철갑은 본체가 반만 받고(몸통 타격도 등 철갑이 받는다) · 벗겨지면 드러난 살이 더 받는다 · 철갑 조각은 그림에서 빠진다', () => {
  const { e, g } = actor(1), root = g.pose.parts.find(p => p.id === 'root')!, c = root.collider.kind === 'capsule' ? { x: (root.collider.from.x + root.collider.to.x) / 2, y: (root.collider.from.y + root.collider.to.y) / 2 + root.collider.radius * .6 } : root.start
  let hit = bulgasariContact(g, { kind: 'circle', center: c, radius: 1 })!
  assert.equal(hit.partId, 'back'); assert.equal(hit.weakScale, B.armorDamage)
  const shoulder = g.pose.parts.find(p => p.id === 'shoulder')!, sc = shoulder.collider.kind === 'ellipse' ? shoulder.collider.center : shoulder.start
  assert.equal(bulgasariContact(g, { kind: 'circle', center: sc, radius: 1 })!.weakScale, B.armorDamage)
  const before = bulgasariLayout(g.pose, g.partHP).map(i => i.piece)
  assert.ok(before.includes('back') && before.includes('shoulder-near'))
  assert.equal(damageBulgasariPart(g, 'back', 1e12), true); assert.equal(g.brokenAt.back, g.age)
  assert.equal(damageBulgasariPart(g, 'shoulder', 1e12), true)
  updateBulgasariPose(g, e, 2)
  hit = bulgasariContact(g, { kind: 'circle', center: c, radius: 1 })!
  assert.equal(hit.partId, 'root'); assert.equal(hit.weakScale, B.exposedDamage)
  assert.equal(bulgasariContact(g, { kind: 'circle', center: sc, radius: 1 })!.weakScale, B.exposedDamage, '벗겨진 어깨 살')
  const after = bulgasariLayout(g.pose, g.partHP).map(i => i.piece)
  assert.ok(!after.includes('back') && !after.includes('shoulder-near') && after.includes('body'), after.join())
  // 판에서: 등 철갑이 처음 부서지는 타격에 포효 하나
  const s = bossRun(); stepHaebi(s, { x: 0, y: 0 }, DT)
  const m = bulgasari(s)!, gg = m.giant as BulgasariState
  gg.state = 'recover'; gg.timer = 9; gg.age = B.entrySeconds; gg.partHP.back = 1; updateBulgasariPose(gg, m, 0)
  for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) s.cool[k] = 1e9
  // 몸통 살 한가운데 (다리·등 철갑 판정 밖) — 성한 등 철갑이 받는다
  const body = gg.pose.parts.find(p => p.id === 'root')!, mid = { x: (body.start.x + body.end.x) / 2, y: (body.start.y + body.end.y) / 2 }
  s.shots.push({ x: mid.x, y: mid.y, vx: 0, vy: 0, life: 0, kind: 'rain', damage: 50, radius: 8, hit: [], angle: 0, tx: 0, ty: 0 })
  const fx = s.fx.length; stepHaebi(s, { x: 0, y: 0 }, DT)
  assert.deepEqual(gg.brokenSeen, ['back']); assert.equal(s.fx.slice(fx).filter(f => f.championCue === 'roar').length, 1, '부서진 순간 포효 하나')
})

test('예고 박자는 seeded — 박치기 앞발 긁기는 씨앗마다 달라지고 같은 씨앗은 같다 · 다른 수는 두 번째부터 +0.3초 변형', () => {
  const totals: number[] = []
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const run = () => { const { e, g } = ready('ram'), rng = makeRng(seed); assert.ok(beginBulgasariMove(g, e, targetFor(e, 'ram'), 'ram', 2, C.speed, () => rng.next())); return g.attack!.windup.total }
    const a = run(), b = run()
    assert.equal(a, b, `seed ${seed}`); totals.push(a)
    const m = B.moves.ram; assert.ok(a >= m.body + m.red - 1e-9 && a <= m.body + m.red + m.scrape + 1e-9)
  }
  assert.ok(new Set(totals.map(t => t.toFixed(3))).size >= 5, `긁기가 늘 같다: ${totals}`)
  const { g } = actor()
  assert.equal(bulgasariWindup(g, 'suction', 0).hold, 0, '처음 쓰는 수는 표 시간')
  g.windupUses.suction = 1
  assert.equal(bulgasariWindup(g, 'suction', .1).hold, G.windup.repeatHold); assert.equal(bulgasariWindup(g, 'suction', .9).hold, 0)
  for (const move of MOVES) { const m = B.moves[move], w = bulgasariWindup(g, move, .99); assert.ok(m.body + m.red + w.hold <= G.windup.max + 1e-9, move) }
})

test('막마다 가운데 세로 3P 길이 늘 비고 · 철편 회전은 빈 방향 3P 길을 남기고 · 고른 수는 언제나 걸어 닿는 3P 빈 원이 있다 (목책을 뚫지 않고)', () => {
  const lane: Shape = { kind: 'box', center: { x: W / 2, y: H / 2 }, halfX: G.playerDiameter * G.safeDiameters / 2, halfY: H / 2, angle: 0 }
  for (const phase of [1, 2, 3] as const) assert.ok(bulgasariEnvironment(phase).shapes.every(s => !overlaps(s, lane)), `막 ${phase} 가운데 길`)
  // 막은 회복이 끝날 때 하나씩 넘어가며 포효한다
  { const { e, g } = actor(1), roars: number[] = []; e.hp = e.max * .2
    for (let n = 0; n < 3000 && g.phase < 3; n++) { if (g.state !== 'roar') { g.state = 'recover'; g.timer = 0; g.attack = null } if (step(g, e, { x: W / 2, y: H - 80 }) === 'roar') roars.push(g.phase) }
    assert.deepEqual(roars, [2, 3]) }
  for (let k = 0; k < 6; k++) {
    const { e, g } = ready('spin'), rng = makeRng(70 + k)
    assert.ok(beginBulgasariMove(g, e, targetFor(e, 'spin'), 'spin', 2, C.speed, () => rng.next()))
    const a = g.attack!, s = B.moves.spin, c = g.motion.prepared, slot = 2 * Math.PI / s.slots
    assert.equal(a.lines!.length, s.lines); assert.equal(a.shapes.length, s.lines)
    const empty = Math.atan2(targetFor(e, 'spin').y - c.y, targetFor(e, 'spin').x - c.x) + a.empty! * slot, r = s.inner + s.length / 2
    const gap: Shape = { kind: 'box', center: { x: c.x + Math.cos(empty) * r, y: c.y + Math.sin(empty) * r }, halfX: s.length / 2, halfY: G.playerDiameter * G.safeDiameters / 2, angle: empty }
    assert.ok(a.shapes.every(q => !overlaps(q, gap)), `빈 방향 ${a.empty}`)
  }
  const wall = createPalisade()
  let begun = 0
  for (let i = 0; i < 48; i++) {
    const phase = (1 + i % 3) as 1 | 2 | 3, { e, g } = actor(phase, 200 + (i * 53) % 700, wall), rng = makeRng(100 + i)
    if (i % 2) g.partHP.back = 0
    g.environment = bulgasariEnvironment(phase); g.last = null
    const player = { x: 60 + (i * 97) % (W - 120), y: WL.y + 40 + (i * 61) % (H - WL.y - 80) }
    step(g, e, player, () => rng.next(), { wall })
    if (!g.attack) continue
    begun++
    const m = B.moves[g.attack.move], seconds = g.attack.move === 'burrow' ? g.attack.windup.red : g.attack.windup.total
    void m
    assert.ok(bulgasariSafeSpot(g.attack.shapes, g.environment.shapes, player, C.speed, seconds, wall), `${g.attack.move} @${JSON.stringify(player)}`)
  }
  assert.ok(begun >= 24, `세운 수 ${begun}`)
})

test('목책과 얽힘: 박치기는 성한 마디에 머리가 박혀 멈추고(그 마디가 깎이고 더 오래 쉰다) · 지하 질주는 목책 밑으로 지나 솟는 자리 마디를 부순다 · 빈 원은 목책 너머로 잡지 않는다', () => {
  // 박치기: 목책 뒤(위)의 장수 쪽으로 — 붉은 길은 목책 띠 앞에서 끝난다
  {
    const wall = createPalisade(), { e, g } = actor(1, 360, wall), target = { x: 760, y: 120 }
    const plan = planBulgasari(g, e, target, 'ram', 2, wall)!
    assert.ok(plan && plan.wall !== undefined, '박힐 마디가 있다')
    const cap = plan.shapes[0]!; assert.equal(cap.kind, 'capsule')
    if (cap.kind === 'capsule') assert.ok(Math.abs(cap.to.y - (wall.y + WL.depth + B.moves.ram.wallR)) < 1e-6, `머리가 띠 앞에서 멈춘다 (${cap.to.y})`)
    assert.ok(beginBulgasariMove(g, e, target, 'ram', 2, C.speed, () => 0, wall))
    const smashed: [number, number][] = []
    let stun = 0
    while (g.state !== 'recover') { step(g, e, target, () => 0, { wall, smash: (i, amount) => smashed.push([i, amount]) }); if ((g.state as string) === 'recover') stun = g.timer }
    assert.deepEqual(smashed, [[plan.wall!, B.moves.ram.wallHit]]); assert.equal(g.attack, null)
    assert.ok(Math.abs(stun - (B.moves.ram.recover + B.moves.ram.wallStun)) <= DT * 2, `박혀서 더 쉰다 (${stun})`)
  }
  // 지하 질주: 목책 줄 위로 솟으면 그 둘레 마디를 부순다
  {
    const wall = createPalisade(), { e, g } = actor(2, 360, wall), target = { x: 820, y: 240 }
    assert.ok(beginBulgasariMove(g, e, target, 'burrow', 2, C.speed, () => 0, wall))
    const landing = g.attack!.landing!, under = g.attack!.pieces!
    assert.ok(under.length > 0, `출현 원에 닿는 마디 (${JSON.stringify(landing)})`)
    const smashed: number[] = []
    while (g.state !== 'recover') step(g, e, target, () => 0, { wall, smash: i => smashed.push(i) })
    assert.deepEqual(smashed, [...under])
  }
  // 빈 원: 목책 앞의 장수에게 목책 뒤 자리는 (성한 마디를 뚫어야 하니) 빈 원이 아니다
  {
    const wall = createPalisade(), player = { x: 100, y: wall.y + 40 }, block: Shape = { kind: 'box', center: { x: 100, y: wall.y + 200 }, halfX: 400, halfY: 170, angle: 0 }
    const spot = bulgasariSafeSpot([block], [], player, 1e4, 1, wall)!
    assert.ok(spot.y > wall.y, `목책을 뚫지 않는 자리 ${JSON.stringify(spot)}`)
    assert.ok(bulgasariSafeSpot([block], [], player, 1e4, 1)!.y < wall.y, '목책이 없으면 위쪽이 가장 가깝다')
  }
})

test('빠른 빈 원 찾기는 giant-core 겹침 셈과 같은 자리를 고른다 (무작위 모양 · 목책 있고 없고)', () => {
  const radius = G.playerDiameter * G.safeDiameters / 2, rng = makeRng(20261122), r = () => rng.next()
  const reference = (shapes: readonly Shape[], env: readonly Shape[], player: { x: number; y: number }, seconds: number, wall?: Palisade) => {
    const cands: { x: number; y: number }[] = []
    for (let y = radius; y <= H - radius; y += G.safeGrid) for (let x = radius; x <= W - radius; x += G.safeGrid) if (Math.hypot(x - player.x, y - player.y) <= C.speed * seconds) cands.push({ x, y })
    cands.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y) || a.y - b.y || a.x - b.x)
    for (const p of cands) { if (wall && sweepWallOf(wall, player, p)) continue; const disk: Shape = { kind: 'circle', center: p, radius }; if ([...shapes, ...env].every(s => !overlaps(s, disk))) return p }
    return null
  }
  for (let i = 0; i < 300; i++) {
    const player = { x: 60 + r() * (W - 120), y: 60 + r() * (H - 120) }, shapes: Shape[] = []
    for (let j = 0, k = 1 + Math.floor(r() * 4); j < k; j++) {
      const c = { x: player.x + (r() - .5) * 500, y: player.y + (r() - .5) * 400 }, kind = Math.floor(r() * 6)
      shapes.push(kind === 0 ? { kind: 'circle', center: c, radius: 40 + r() * 140 } : kind === 1 ? { kind: 'capsule', from: c, to: { x: c.x + (r() - .5) * 600, y: c.y + (r() - .5) * 400 }, radius: 30 + r() * 80 }
        : kind === 2 ? { kind: 'box', center: c, halfX: 100 + r() * 300, halfY: 10 + r() * 40, angle: r() * Math.PI * 2 } : kind === 3 ? { kind: 'cone', center: c, radius: 120 + r() * 200, angle: r() * Math.PI * 2, halfAngle: .2 + r() * 1.2 }
        : kind === 4 ? { kind: 'ellipse', center: c, rx: 50 + r() * 100, ry: 50 + r() * 100, angle: r() * Math.PI } : { kind: 'arc', center: c, inner: 100, outer: 180, angle: r() * 6, halfAngle: .8 })
    }
    const env = bulgasariEnvironment((1 + i % 3) as 1 | 2 | 3).shapes, wall = i % 2 ? createPalisade() : undefined, seconds = .9 + r() * 1.2
    assert.deepEqual(bulgasariSafeSpot(shapes, env, player, C.speed, seconds, wall), reference(shapes, env, player, seconds, wall), `case ${i}`)
  }
})

test('엔진 박자: 30/60/120 그림 빈도가 같은 고정 틱이면 같은 불가사리 · 같은 난수', () => {
  const run = (fps: number) => {
    const wall = createPalisade(), { e, g } = actor(2, 480, wall), rng = makeRng(5719), damage: number[] = []; let lag = 0, tick = 0
    for (let frame = 0; frame < fps * 14; frame++) {
      lag += 1 / fps
      while (lag + 1e-12 >= DT) { tick++; const player = { x: W / 2 + Math.cos(tick / 160) * 260, y: B.homeY + 60 + Math.sin(tick / 90) * 60 }; stepBulgasari(g, e, { dt: DT, tick, player, speed: C.speed, dazed: false, random: () => rng.next(), wall, smash: (i, amount) => damagePiece(wall, wall.pieces[i]!, amount, tick * DT) }); commitBulgasari(g, e, player, n => damage.push(n), false, () => {}); lag -= DT }
      JSON.stringify(g.pose)
    }
    return hash({ e, g, damage, seed: rng.state(), tick, wall })
  }
  assert.equal(run(30), run(60)); assert.equal(run(60), run(120))
})

test('57-BULGASARI 판 기록은 등장(큰 문)부터 거대 보스 싸움까지 그대로 다시 돈다 (짧게 줄인 목책 돌파 · 보통 입력)', () => {
  // 판 길이 몫과 불가사리 체력만 줄여 거대 보스 싸움(막 전환 · 부위 파괴)까지 빨리 닿게 한다 — 기록과 재생이 같은 값을 쓴다
  const length = ST.palisade.length, hp = B.hp
  Object.assign(ST.palisade, { length: .12 }); Object.assign(B, { hp: 90000 })
  try {
    const opts = { stage: 'palisade' as const, simRules: '57-BULGASARI' as const, bonus: BONUS }
    const s = createHaebi(41, 'stage', 'sword', opts)
    const r = startRecord(s, { id: 'b57', started: 'x', mode: 'stage', stage: 'palisade', hero: 'haebi', kit: 'sword', sprite: 'haebi', seed: 41, opts, from: null })
    let seen = false, phase = 1, gate = false
    const moves = new Set<string>()
    while (s.state === 'playing' && s.t < 400) {
      if (s.offers.length) { const p = botChoice(s, 'storm'); choose(s, p); recPick(r, p); continue }
      stepHaebi(s, recInput(r, { ...botInput(s, .5), skill: Math.floor(s.t * 2) % 7 === 0 }), STEP)
      const g = bulgasari(s)?.giant
      if (g?.kind === 'bulgasari') { seen = true; phase = Math.max(phase, g.phase); if (g.attack) moves.add(g.attack.move) }
      if (s.palisade!.gateBrokenAt !== undefined) gate = true
    }
    assert.ok(seen, '거대 보스까지 갔다'); assert.ok(gate, '큰 문이 부서졌다'); assert.ok(phase >= 2 || s.giantFlow!.finalDefeated, `막 ${phase}`); assert.ok(moves.size >= 2, [...moves].join())
    const g = finishRecord(r, 0, 'x')
    assert.equal(g.rules, '57-BULGASARI')
    assert.equal(JSON.stringify(replayRaid(JSON.parse(JSON.stringify(g)))), JSON.stringify(s))
  } finally { Object.assign(ST.palisade, { length }); Object.assign(B, { hp }) }
})

test('실제 무기 넷이 불가사리의 부위 하나와 본체를 함께 깎는다', () => {
  for (const kit of ['axe', 'bow', 'spear', 'sword'] as Kit[]) {
    const s = bossRun(257, kit); stepHaebi(s, { x: 0, y: 0 }, DT)
    for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) s.cool[k] = 1e9
    const e = bulgasari(s)!, g = e.giant as BulgasariState
    g.state = 'recover'; g.timer = 9; g.age = B.entrySeconds; updateBulgasariPose(g, e, 0)
    const leg = g.pose.parts.find(p => p.id === 'fore-near')!
    s.x = leg.end.x + 40; s.y = leg.end.y + 10
    s.cool[({ axe: 'axe', bow: 'bow', spear: 'spear', sword: 'sword' } as const)[kit as 'axe']] = 0
    const before = e.hp, parts = { ...g.partHP }
    for (let i = 0; i < 90 && e.hp === before; i++) stepHaebi(s, { x: 0, y: 0 }, DT)
    assert.ok(e.hp < before, `${kit} 못 맞힘`)
    assert.ok(Object.keys(parts).filter(k => g.partHP[k as keyof typeof parts] !== parts[k as keyof typeof parts]).length <= 1, `${kit} 부위 여럿`)
  }
  void spawnGiant
})

test('부위 그림: 열한 장이 있고 구운 크기가 표와 같다 · 원본 참고 그림은 굽지 않았다', () => {
  for (const piece of BULGASARI_PIECES) {
    const buf = readFileSync(new URL(`../public/realm/${BULGASARI_ART[piece]}`, import.meta.url))
    assert.equal(buf.toString('latin1', 12, 16), 'IHDR', piece)
    assert.deepEqual([buf.readUInt32BE(16), buf.readUInt32BE(20)], [...BULGASARI_SOURCE[piece].size], piece)
  }
  assert.equal(BULGASARI_PIECES.length, 11); assert.ok(!(BULGASARI_PIECES as readonly string[]).includes('reference'))
})

test('그림은 판을 읽기만 한다: 다문 입은 아래턱 그림 없이 · 벌리면 아랫입술을 지우고 아래턱 · 모든 상태에서 그려진다', () => {
  const { e, g } = ready('suction')
  assert.ok(!bulgasariLayout(g.pose, g.partHP).some(i => i.piece === 'jaw'), '다문 입')
  assert.ok(beginBulgasariMove(g, e, targetFor(e, 'suction'), 'suction', 2))
  while (g.state === 'body') step(g, e, targetFor(e, 'suction'))
  const open = bulgasariLayout(g.pose, g.partHP)
  assert.ok(open.some(i => i.piece === 'jaw') && open.find(i => i.piece === 'head')!.clip, '벌린 입')
  const drawn: string[] = [], img = (w: number, h: number, tag: string) => ({ width: w, height: h, naturalWidth: w, naturalHeight: h, complete: true, tag }) as unknown as HTMLImageElement
  const images = new Map(BULGASARI_PIECES.map(p => [BULGASARI_ART[p], img(BULGASARI_SOURCE[p].size[0], BULGASARI_SOURCE[p].size[1], p)]))
  const ctx = new Proxy({}, { get: (_, k) => k === 'drawImage' ? (i: { tag?: string }) => drawn.push(i.tag ?? '') : () => {}, set: () => true }) as unknown as CanvasRenderingContext2D
  const before = JSON.stringify(g)
  assert.equal(drawBulgasari(ctx, images, g, { heroX: 0, heroY: 0 }), true)
  drawBulgasariGround(ctx, g); drawBulgasariThreats(ctx, g)
  assert.equal(JSON.stringify(g), before, '그림이 판을 바꿨다')
  assert.ok(['body', 'back', 'head', 'jaw', 'fore-near', 'hind-far', 'tail'].every(p => drawn.includes(p)), drawn.join())
})
