// 55 불타는 산성 거대 보스 「불의 무녀 장군」 — 규칙 55-SHAMAN 은 불타는 산성에만 · 여섯 수의 고정 예고·연타·봉인·seeded 정지·막별 안전 길 · 기록 재생 · 그림 변환
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_GIANT as G, HAEBI_SHAMAN as S, HAEBI_RUN as C, HAEBI_STAGES as ST } from '../src/tune/params.ts'
import { makeRng } from '../src/core/rng.ts'
import { createHaebi, stepHaebi, choose, spawnGiant, giantHUD, raidRulesForStage, usesGiantBoss, normalizedRaidOpts, runDuration, bossTime, midbossTime, type HaebiRun, type Kit } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, finishRecord, replayRaid, STEP } from '../src/raid/runlog.ts'
import { createShaman, stepShaman, commitShaman, beginShamanMove, planShaman, shamanCandidates, breakShamanPart, damageShamanPart, staggerShaman, updateShamanPose, shamanCollisionBounds, shamanContact, shamanEnvironment, shamanBands, shamanLane, shamanPoint, shamanPulseEscape, shamanSafeLanding, shamanFrameBounds, makeShamanPose, SHAMAN_MOVES, SHAMAN_REQUIRES, type ShamanState, type ShamanMove } from '../src/raid/shaman.ts'
import { safeLanding, type GiantOwner } from '../src/raid/imugi.ts'
import { overlaps, type Point, type Shape } from '../src/raid/giant-core.ts'
import { drawShaman, drawShamanFall, drawShamanGround, drawShamanThreats, shamanBodySpace, shamanVisualBounds } from '../src/raid/shaman-view.ts'
import { SHAMAN_ART, SHAMAN_PIECES, SHAMAN_SOURCE, prewarmShamanArt, shamanArtReady } from '../src/raid/shaman-art.ts'

const DT = 1 / 120, W = C.width, H = C.height
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const pt = (p: Point): Shape => ({ kind: 'circle', center: { x: p.x, y: p.y }, radius: 0 })
/** 막 3까지 다 열린 조용한 무녀 (판 없이 · 등장은 끝났다) */
function actor(phase: 1 | 2 | 3 = 3) {
  const e: GiantOwner = { id: 9, x: W / 2, y: S.homeY, hp: S.hp, max: S.hp }, g = createShaman(e)
  const up = <T extends { rise: number }>(f: T): T => ({ ...f, rise: 1 })
  g.motion = { ...g.motion, from: up(g.motion.from), prepared: up(g.motion.prepared), relaxed: up(g.motion.relaxed), current: up(g.motion.current), recoverFrom: up(g.motion.recoverFrom) }
  g.phase = phase; g.state = 'recover'; g.timer = 0; g.age = S.entrySeconds; updateShamanPose(g, e, 1)
  return { e, g }
}
/** 이 수가 후보가 되는 자리에 장수를 둔다 */
function targetFor(g: ShamanState, e: GiantOwner, move: ShamanMove): Point {
  const f = g.motion.current.facing
  if (move === 'sweep') return { x: e.x + f * 150, y: e.y + 60 }
  if (move === 'ring') return { x: e.x + f * 120, y: e.y + 150 }
  if (move === 'chase') return { x: e.x + f * 260, y: e.y + 120 }
  if (move === 'twin') return { x: e.x + f * 100, y: e.y + 120 }
  return { x: e.x + f * 200, y: e.y + 150 }
}
const step = (g: ShamanState, e: GiantOwner, player: Point, random: () => number = () => 0, tick = 1) => stepShaman(g, e, { dt: DT, tick, player, speed: C.speed, dazed: false, random })
/** 판정에서 환경 불을 끈다 (예고·안전 길 셈에는 그대로 남는다) */
const quiet = (g: ShamanState) => { g.environment.active = false; g.environment.age = -1e9 }

test('55-SHAMAN 은 불타는 산성에만 선다 · 다른 판은 56B 그대로 · 숲·여울·목책·설원 규칙은 그대로', () => {
  assert.equal(raidRulesForStage('fortress'), '55-SHAMAN'); assert.equal(raidRulesForStage('ford'), '55-IMUGI'); assert.equal(raidRulesForStage('palisade'), '57-BULGASARI'); assert.equal(raidRulesForStage('snow'), '55-TIGER'); assert.equal(raidRulesForStage('forest'), '55-GUMIHO')
  for (const stage of ['forest', 'ford', 'palisade', 'snow'] as const) {
    const a = createHaebi(7, 'stage', 'sword', { stage, simRules: '55-SHAMAN' }), b = createHaebi(7, 'stage', 'sword', { stage, simRules: '56B' })
    assert.equal(usesGiantBoss(a), false, stage)
    for (let i = 0; i < 60 * 20; i++) { stepHaebi(a, { x: 0, y: 0 }, 1 / 60); stepHaebi(b, { x: 0, y: 0 }, 1 / 60) }
    assert.deepEqual(a, b, `${stage}: 55-SHAMAN 을 넣어도 56B 와 같은 판`)
  }
  assert.equal(usesGiantBoss(createHaebi(7, 'trial', 'axe', { simRules: '55-SHAMAN' })), false)
  assert.equal(usesGiantBoss(createHaebi(7, 'vanguard', 'axe', { simRules: '55-SHAMAN' })), false)
  const old = createHaebi(7, 'stage', 'axe', { stage: 'fortress', simRules: '56B' })
  assert.equal(usesGiantBoss(old), false, '옛 56B 산성 기록은 두목 그대로 다시 돈다'); assert.equal(runDuration(old), 1230)
  const s = createHaebi(7, 'stage', 'axe', { stage: 'fortress', simRules: '55-SHAMAN' })
  assert.equal(usesGiantBoss(s), true); assert.equal(runDuration(s), 1380); assert.equal(normalizedRaidOpts(s, { stage: 'fortress' }).simRules, '55-SHAMAN')
  assert.equal(midbossTime(s), 600)
})

test('10분 중간 보스는 불의 반란 장군(체력 몫) · 19분 거대 보스는 불의 무녀 장군 · 이름이 HUD 와 격파 알림에', () => {
  const s = createHaebi(31, 'stage', 'sword', { stage: 'fortress', simRules: '55-SHAMAN' }); s.spawn = s.nextElite = s.nextBarrage = 1e9
  s.t = midbossTime(s) - DT; stepHaebi(s, { x: 0, y: 0 }, DT)
  const mid = s.enemies.find(e => e.bossRole === 'midboss')!
  assert.ok(mid && !mid.giant); assert.ok(Math.abs(mid.max - C.bossHp * ST.fortress.bossHp * 6 * S.midHpScale) < 1e-6, `${mid.max}`)
  s.enemies = []; s.t = bossTime(s) - DT; stepHaebi(s, { x: 0, y: 0 }, DT)
  const e = s.enemies.find(x => x.giant)!
  assert.equal(e.giant!.kind, 'shaman'); assert.equal(e.max, S.hp)
  assert.equal(giantHUD(s)!.name, '불의 무녀 장군')
  // 등장 동안은 맞지 않는다 (불 속에서 걸어 나오는 중)
  assert.ok(e.giant!.pose.parts.every(p => !p.targetable))
  const g = e.giant as ShamanState
  for (let i = 0; i < S.entrySeconds / DT + 2; i++) stepHaebi(s, { x: 0, y: 0 }, DT)
  assert.ok(g.pose.parts.some(p => p.targetable), '다 나오면 맞는다')
  e.hp = 1; g.state = 'recover'; g.timer = 5; g.attack = null; updateShamanPose(g, e, 1)
  s.x = e.x; s.y = e.y + 60; s.shots.push({ x: e.x, y: e.y - 120, vx: 0, vy: 0, life: 0, kind: 'rain', damage: 1e9, radius: 260, hit: [], angle: 0, tx: 0, ty: 0 })
  stepHaebi(s, { x: 0, y: 0 }, DT)
  assert.equal(s.state, 'won'); assert.equal(s.message, '불의 무녀 장군 격파 · 토벌 완료'); assert.equal(s.giantFlow!.finalDefeated, true)
})

test('여섯 수 모두 몸 준비 → 붉은 바닥(고정) → 타격 · 몸 예고 동안엔 바닥이 없다 · 연타는 타마다 붉은 바닥 · 총예고 0.5~2.5초 · 판 안에 몸', () => {
  for (const move of SHAMAN_MOVES) {
    const { e, g } = actor(), target = targetFor(g, e, move)
    assert.ok(shamanCandidates(g, e, target).includes(move), `${move} 후보`)
    assert.ok(beginShamanMove(g, e, target, move, 2, C.speed, () => .5), `${move} 세움`)
    const a = g.attack!, w = a.windup, serial = JSON.stringify(a.subs.map(s => s.shapes))
    assert.ok(w.total >= G.windup.min - 1e-9 && w.total <= G.windup.max + 1e-9, `${move} total ${w.total}`)
    let t = 0, body = 0, firstStrike = -1, n = 0
    const reds: number[] = []
    while (g.state !== 'recover' && n++ < 2000) {
      if (g.state === 'body' || g.state === 'hold') { assert.equal(g.pose.worldGeometry.tell.length, 0, `${move} 몸 예고에 바닥`); body++ }
      if (g.state === 'tell') { assert.equal(g.pose.worldGeometry.tell, a.shapes, `${move} 붉은 바닥 = 판정 모양`); if (reds[reds.length - 1] !== a.sub) reds.push(a.sub) }
      if (g.state === 'strike' && firstStrike < 0) firstStrike = t
      const b = shamanCollisionBounds(g.pose)
      assert.ok(b.left >= -1e-6 && b.right <= W + 1e-6 && b.top >= -1e-6 && b.bottom <= H + 1e-6, `${move} 판 밖 ${JSON.stringify(b)}`)
      // 장수가 움직여도 예고는 따라가지 않는다
      step(g, e, { x: target.x + Math.sin(t * 9) * 200, y: target.y + 80 }); t += DT
    }
    assert.equal(g.state, 'recover', move); assert.ok(body > 0, move)
    assert.deepEqual(reds, a.subs.map((_, k) => k), `${move} 타마다 붉은 바닥`)
    assert.equal(JSON.stringify(a.subs.map(s => s.shapes)), serial, `${move} 예고가 바뀌었다`)
    assert.ok(Math.abs(firstStrike - w.total) <= DT * 2, `${move} ${firstStrike} vs ${w.total}`)
  }
})

test('빨강 = 실제 피해: 붉은 모양 안이면 타마다 한 번 맞고 밖이면 안 맞는다 (맥동은 띠가 타는 때)', () => {
  const sample = (s: Shape): Point => s.kind === 'circle' ? s.center : s.kind === 'box' ? s.center : s.kind === 'cone' ? { x: s.center.x + Math.cos(s.angle) * s.radius * .6, y: s.center.y + Math.sin(s.angle) * s.radius * .6 }
    : s.kind === 'arc' ? { x: s.center.x + Math.cos(s.angle) * (s.inner + s.outer) / 2, y: s.center.y + Math.sin(s.angle) * (s.inner + s.outer) / 2 } : { x: 0, y: 0 }
  for (const move of SHAMAN_MOVES) {
    const { e, g } = actor(), target = targetFor(g, e, move)
    assert.ok(beginShamanMove(g, e, target, move, 2, C.speed, () => .4))
    const subs = g.attack!.subs, probe = sample(subs[0]!.shapes[0]!)
    const expected = subs.reduce((n, s) => n + (s.shapes.some(x => overlaps(x, pt(probe))) ? s.damage : 0), 0)
    let hurt = 0, n = 0
    while (g.state !== 'recover' && n++ < 2000) { step(g, e, probe); quiet(g); commitShaman(g, e, probe, d => { hurt += d }, false) }
    assert.ok(expected > 0, `${move} 시험 자리가 붉은 모양 안`)
    assert.equal(hurt, expected, `${move} 안 ${JSON.stringify(probe)}`)
  }
  // 밖: 모든 타의 모양에 닿지 않는 곳은 맞지 않는다
  for (const move of SHAMAN_MOVES) {
    const { e, g } = actor(), target = targetFor(g, e, move)
    assert.ok(beginShamanMove(g, e, target, move, 2))
    const safe = move === 'pulse' ? { x: W / 2, y: H / 2 } : safeLanding(g.attack!.subs.flatMap(s => s.shapes), [], target, 1e4, 1)!
    let hurt = 0, n = 0
    while (g.state !== 'recover' && n++ < 2000) { step(g, e, safe); quiet(g); commitShaman(g, e, safe, d => { hurt += d }, false) }
    assert.equal(hurt, 0, `${move} 밖 ${JSON.stringify(safe)}`)
  }
  // 맥동: 띠는 왼쪽부터 차례로 탄다 — 맨 오른쪽 띠에 선 장수는 앞의 셋이 탈 때 맞지 않는다
  {
    const { e, g } = actor(), right = { x: W - 80, y: H / 2 }
    assert.ok(beginShamanMove(g, e, targetFor(g, e, 'pulse'), 'pulse', 2))
    let firstHit = -1, n = 0
    while (g.state !== 'recover' && n++ < 2000) { step(g, e, right); quiet(g); commitShaman(g, e, right, () => { if (firstHit < 0) firstHit = g.motion.progress }, false) }
    assert.ok(firstHit >= .75 - 1e-6, `오른쪽 띠는 마지막에 탄다 ${firstHit}`)
  }
})

test('부위가 부서지면 그 수가 봉인된다 (부채 팔 · 방울 팔 · 허리 장식) · 예약된 수는 취소 · 치는 중인 연타는 끊긴다', () => {
  for (const [part, sealed] of [['fan', ['sweep', 'pillars', 'twin']], ['bell', ['chase', 'pulse', 'twin']], ['waist', ['ring']]] as const) {
    for (const move of sealed) assert.ok(SHAMAN_REQUIRES[move].includes(part), `${move} ← ${part}`)
    for (const move of SHAMAN_MOVES) {
      const { e, g } = actor(), target = targetFor(g, e, move)
      if (!shamanCandidates(g, e, target).includes(move)) continue
      g.partHP[part] = 0; g.last = null
      assert.equal(shamanCandidates(g, e, target).includes(move), !(sealed as readonly string[]).includes(move), `${part} 부서진 뒤 ${move}`)
    }
  }
  // 예약 취소: 몸 예고 동안 부채 팔이 부서지면 회복 자세로
  {
    const { e, g } = actor(), target = targetFor(g, e, 'sweep')
    assert.ok(beginShamanMove(g, e, target, 'sweep', 2))
    assert.equal(damageShamanPart(g, 'fan', 1e12), true, '처음 부서짐')
    assert.equal(g.state, 'recover'); assert.equal(g.attack, null)
    assert.equal(damageShamanPart(g, 'fan', 1), false, '두 번 부서지지 않는다')
    assert.equal(breakShamanPart(g, 'fan'), false)
  }
  // 치는 중: 세 걸음 추격 첫 걸음에 방울 팔이 부서지면 남은 걸음이 없다 · 그 뒤로는 맞지 않는다
  {
    const { e, g } = actor(), target = targetFor(g, e, 'chase')
    assert.ok(beginShamanMove(g, e, target, 'chase', 2))
    const state = () => g.state as string
    while (state() !== 'strike') step(g, e, target)
    assert.equal(damageShamanPart(g, 'bell', 1e12), true)
    const subs = g.attack!.subs.length, line2 = g.attack!.subs[1]!.shapes[0]!
    assert.ok(subs === 3 && g.attack!.cut)
    let hurt = 0, n = 0, maxSub = 0
    const probe = line2.kind === 'box' ? line2.center : target
    while (state() !== 'recover' && n++ < 2000) { step(g, e, probe); quiet(g); maxSub = Math.max(maxSub, g.attack?.sub ?? 0); commitShaman(g, e, probe, d => { hurt += d }, false) }
    assert.equal(maxSub, 0, '둘째 걸음 없음'); assert.equal(hurt, 0)
  }
  // 허리 장식은 부서지면 떨어져 보이지도 맞지도 않는다 · 부서진 팔은 그을린 채 남지만 안 맞는다
  {
    const { e, g } = actor()
    g.partHP.waist = 0; g.partHP.fan = 0; updateShamanPose(g, e, 1)
    const waist = g.pose.parts.find(p => p.id === 'waist')!, fan = g.pose.parts.find(p => p.id === 'fan')!
    assert.equal(waist.visible, false); assert.equal(fan.visible, true); assert.equal(fan.targetable, false)
  }
})

test('정지 초는 seeded — 같은 씨앗 같은 박자 · 씨앗마다 표 시간 ~ +유지 안에서 달라진다 (고리 빈 곳·불기둥 놓임도)', () => {
  for (const move of ['ring', 'pillars', 'twin', 'sweep', 'chase'] as const) {
    const totals: number[] = [], shapes = new Set<string>()
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const run = () => { const { e, g } = actor(), rng = makeRng(seed); assert.ok(beginShamanMove(g, e, targetFor(g, e, move), move, 2, C.speed, () => rng.next()), `${move}/${seed}`); return { total: g.attack!.windup.total, shapes: JSON.stringify(g.attack!.subs[0]!.shapes) } }
      const a = run(), b = run()
      assert.deepEqual(a, b, `${move} seed ${seed}`); totals.push(a.total); shapes.add(a.shapes)
      const m = S.moves[move], base = m.body + m.red
      assert.ok(a.total >= base + m.hold[0] - 1e-9 && a.total <= base + m.hold[1] + 1e-9 && a.total <= G.windup.max + 1e-9, `${move} ${a.total}`)
    }
    assert.ok(new Set(totals.map(t => t.toFixed(3))).size >= 5, `${move} 정지가 늘 같다: ${totals}`)
    if (move === 'ring' || move === 'pillars') assert.ok(shapes.size >= 5, `${move} 모양이 늘 같다`)
  }
})

test('막마다 가운데 세로 길이 늘 비고 · 화염 맥동과 막3 불을 합쳐도 길이 남는다 · 고른 수는 언제나 피할 길이 있다', () => {
  const [laneL, laneR] = shamanLane(), lane: Shape = { kind: 'box', center: { x: W / 2, y: H / 2 }, halfX: (laneR - laneL) / 2 - .5, halfY: H / 2, angle: 0 }
  assert.ok(laneR - laneL >= G.playerDiameter * G.safeDiameters, '길은 3P 이상')
  for (const phase of [1, 2, 3] as const) assert.ok(shamanEnvironment(phase).shapes.every(s => !overlaps(s, lane)), `막 ${phase} 환경이 길을 막는다`)
  assert.ok(shamanBands().flat().every(s => !overlaps(s, lane)), '맥동 띠가 길을 막는다')
  // 막은 회복이 끝날 때 하나씩 넘어가며 방울을 치켜든다 (둘을 건너뛰지 않는다)
  for (const phase of [2, 3] as const) {
    const { e, g } = actor(1), roars: number[] = []
    e.hp = e.max * (phase === 2 ? .6 : .2)
    for (let n = 0; n < 3000 && g.environment.phase < phase; n++) { if (g.state !== 'roar') { g.state = 'recover'; g.timer = 0; g.attack = null } if (step(g, e, { x: W / 2, y: H - 80 }) === 'roar') roars.push(g.phase) }
    assert.deepEqual(roars, phase === 2 ? [2] : [2, 3])
  }
  // 화염 맥동: 판 어디서 시작해도 가운데 길로 달리면 띠가 탈 때 그 띠 안에 있지 않다 (가장 느린 장수 속도)
  for (let x = 32; x <= W - 32; x += 8) assert.ok(shamanPulseEscape({ x, y: 300 }, C.speed, S.moves.pulse.body + S.moves.pulse.red), `맥동 x=${x}`)
  // 여러 자리에서 고르게 해 본다: 세운 수는 타마다 닿을 수 있는 3P 빈 원이 막 환경과 겹치지 않는다
  let begun = 0
  const used = new Set<string>()
  for (let i = 0; i < 60; i++) for (const phase of [1, 2, 3] as const) {
    const { e, g } = actor(phase), rng = makeRng(300 + i), player = { x: 40 + (i * 97) % (W - 80), y: 90 + (i * 61) % (H - 140) }
    g.environment = shamanEnvironment(phase); g.last = null
    step(g, e, player, () => rng.next())
    const a = g.attack; if (!a) continue
    begun++; used.add(a.move)
    if (a.move === 'pulse') { assert.ok(shamanPulseEscape(player, C.speed, a.windup.total)); continue }
    let at: Point = player
    a.subs.forEach((s, k) => {
      const seconds = k ? s.red + a.subs[k - 1]!.strike : a.windup.total, p = safeLanding(s.shapes, g.environment.shapes, at, C.speed, seconds)
      assert.ok(p, `${a.move} 타 ${k} 막 ${phase} @${JSON.stringify(player)}`); at = p!
    })
  }
  assert.ok(begun >= 120, `세운 수 ${begun}`); assert.equal(used.size, SHAMAN_MOVES.length, [...used].join())
})

test('붉은 바닥을 보고 피하는 장수는 막 1~3 내내 공격에 맞지 않는다 (환경 불과 연타를 합쳐도 길이 남는다)', () => {
  const all = new Set<string>()
  for (const seed of [11, 23, 37]) {
    const { e, g } = actor(1), rng = makeRng(seed), moves = new Set<string>()
    let me: Point = { x: W / 2 + 200, y: S.homeY + 120 }, goal = null as Point | null, seen = '', hurt = 0, tick = 1
    const plan = () => {
      const a = g.attack; if (!a || (g.state !== 'tell' && g.state !== 'body' && g.state !== 'hold')) return
      const key = `${a.seq}:${a.sub}:${g.state === 'tell'}`; if (key === seen) return; seen = key
      if (a.move === 'pulse') { const [l, r] = shamanLane(); goal = { x: (l + r) / 2, y: me.y }; return }
      if (g.state !== 'tell') return
      const left = g.timer, s = a.subs[a.sub]!
      goal = safeLanding(s.shapes, g.environment.shapes, me, C.speed, left) ?? goal
    }
    for (let i = 0; i < 120 * 210; i++, tick++) {
      // 막을 차례로 넘긴다 (70초마다 체력을 막 문턱 아래로)
      const want = i < 120 * 70 ? 1 : i < 120 * 140 ? .6 : .2
      if (e.hp > e.max * want) e.hp = e.max * want
      stepShaman(g, e, { dt: DT, tick, player: me, speed: C.speed, dazed: false, random: () => rng.next() })
      if (g.attack) moves.add(g.attack.move)
      plan()
      if (goal) { const dx = goal.x - me.x, dy = goal.y - me.y, d = Math.hypot(dx, dy), v = Math.min(d, C.speed * DT); if (d > 1e-6) me = { x: me.x + dx / d * v, y: me.y + dy / d * v } }
      quiet(g)
      commitShaman(g, e, me, d => { hurt += d }, false)
    }
    assert.equal(g.phase, 3, `seed ${seed} 막 3까지`)
    assert.equal(hurt, 0, `seed ${seed} 피하는 장수가 맞았다 (${[...moves].join()})`)
    assert.ok(moves.size >= 4, `seed ${seed} 수 ${[...moves].join()}`)
    for (const m of moves) all.add(m)
  }
  assert.equal(all.size, SHAMAN_MOVES.length, `세 씨앗을 합치면 여섯 수 모두 (${[...all].join()})`)
})

test('회복 중 첫 타격은 움찔하고 회복이 한 번만 늘어난다 · 머리는 회복 중 2배', () => {
  const { e, g } = actor(), target = targetFor(g, e, 'sweep')
  assert.ok(beginShamanMove(g, e, target, 'sweep', 2))
  while (g.state !== 'recover') step(g, e, target)
  const before = g.timer
  staggerShaman(g); assert.ok(g.timer > before && g.stagger > 0)
  assert.ok(g.timer - before <= S.staggerRecover + 1e-9)
  const head = g.pose.parts.find(p => p.id === 'head')!, c = head.collider.kind === 'ellipse' ? head.collider.center : head.start
  const hit = shamanContact(g, { kind: 'circle', center: c, radius: 1 })!
  assert.equal(hit.partId, 'head'); assert.equal(hit.weakScale, G.recoveryHeadDamage)
})

test('엔진 박자: 30/60/120 그림 빈도가 같은 고정 틱이면 같은 무녀 · 같은 난수', () => {
  const run = (fps: number) => {
    const { e, g } = actor(3), rng = makeRng(5519), damage: number[] = []; let lag = 0, tick = 0
    for (let frame = 0; frame < fps * 16; frame++) {
      lag += 1 / fps
      while (lag + 1e-12 >= DT) { tick++; const player = { x: W / 2 + Math.cos(tick / 160) * 300, y: S.homeY + 100 + Math.sin(tick / 90) * 80 }; stepShaman(g, e, { dt: DT, tick, player, speed: C.speed, dazed: false, random: () => rng.next() }); commitShaman(g, e, player, n => damage.push(n), false); lag -= DT }
      JSON.stringify(g.pose)
    }
    return hash({ e, g, damage, seed: rng.state(), tick })
  }
  assert.equal(run(30), run(60)); assert.equal(run(60), run(120))
})

test('55-SHAMAN 판 기록은 거대 보스 싸움까지 그대로 다시 돈다 (짧게 줄인 산성 · 보통 입력)', () => {
  // 산성 판 길이 몫 · 잡졸 피해 · 무녀 체력만 줄여 거대 보스 싸움(막 전환 · 부위 파괴)까지 빨리 닿게 한다 — 기록과 재생이 같은 값을 쓴다
  const length = ST.fortress.length, damage = ST.fortress.damage, hp = S.hp
  Object.assign(ST.fortress, { length: .12, damage: 1 }); Object.assign(S, { hp: 90000 })
  try {
    const opts = { stage: 'fortress' as const, simRules: '55-SHAMAN' as const, bonus: { might: 10, vigor: 10, armor: 5, regen: 5, haste: 5, swift: 5 } }
    const s = createHaebi(41, 'stage', 'sword', opts)
    const r = startRecord(s, { id: 's55', started: 'x', mode: 'stage', stage: 'fortress', hero: 'haebi', kit: 'sword', sprite: 'haebi', seed: 41, opts, from: null })
    let shaman = false, phase = 1, moves = new Set<string>()
    while (s.state === 'playing' && s.t < 420) {
      if (s.offers.length) { const p = botChoice(s, 'storm'); choose(s, p); recPick(r, p); continue }
      stepHaebi(s, recInput(r, { ...botInput(s, .5), skill: Math.floor(s.t * 2) % 7 === 0 }), STEP)
      const g = s.enemies.find(e => e.giant?.kind === 'shaman')?.giant
      if (g?.kind === 'shaman') { shaman = true; phase = Math.max(phase, g.phase); if (g.attack) moves.add(g.attack.move) }
    }
    assert.ok(shaman, `거대 보스까지 갔다 (${s.state} ${s.t.toFixed(1)})`); assert.ok(phase >= 2 || s.giantFlow!.finalDefeated, `막 ${phase}`); assert.ok(moves.size >= 2, [...moves].join())
    const g = finishRecord(r, 0, 'x')
    assert.equal(g.rules, '55-SHAMAN')
    assert.equal(JSON.stringify(replayRaid(JSON.parse(JSON.stringify(g)))), JSON.stringify(s))
  } finally { Object.assign(ST.fortress, { length, damage }); Object.assign(S, { hp }) }
})

test('실제 무기 넷이 무녀의 부위 하나와 본체를 함께 깎는다 · 부위가 처음 부서지면 큰 반응 하나', () => {
  for (const kit of ['axe', 'bow', 'spear', 'sword'] as Kit[]) {
    const s = createHaebi(257, 'stage', kit, { stage: 'fortress', simRules: '55-SHAMAN' })
    s.spawn = s.nextElite = s.nextBarrage = 1e9
    for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) s.cool[k] = 1e9
    const e = spawnGiant(s)!, g = e.giant as ShamanState
    g.motion = { ...g.motion, from: { ...g.motion.from, rise: 1 }, current: { ...g.motion.current, rise: 1 }, relaxed: { ...g.motion.relaxed, rise: 1 }, recoverFrom: { ...g.motion.recoverFrom, rise: 1 } }
    g.state = 'recover'; g.timer = 9; g.age = S.entrySeconds; updateShamanPose(g, e, 0)
    const skirt = g.pose.parts.find(p => p.id === 'skirt')!
    s.x = skirt.end.x + 60; s.y = skirt.end.y + 10
    s.cool[({ axe: 'axe', bow: 'bow', spear: 'spear', sword: 'sword' } as const)[kit as 'axe']] = 0
    const before = e.hp, parts = { ...g.partHP }
    for (let i = 0; i < 90 && e.hp === before; i++) stepHaebi(s, { x: 0, y: 0 }, DT)
    assert.ok(e.hp < before, `${kit} 못 맞힘`)
    assert.ok(Object.keys(parts).filter(k => g.partHP[k as keyof typeof parts] !== parts[k as keyof typeof parts]).length <= 1, `${kit} 부위 여럿`)
  }
  const s = createHaebi(257, 'stage', 'sword', { stage: 'fortress', simRules: '55-SHAMAN' }); s.spawn = s.nextElite = s.nextBarrage = 1e9
  const e = spawnGiant(s)!, g = e.giant as ShamanState
  g.motion = { ...g.motion, current: { ...g.motion.current, rise: 1 }, relaxed: { ...g.motion.relaxed, rise: 1 }, recoverFrom: { ...g.motion.recoverFrom, rise: 1 } }
  g.state = 'recover'; g.timer = 9; g.age = S.entrySeconds; g.partHP.waist = 1; updateShamanPose(g, e, 0)
  const w = g.pose.parts.find(p => p.id === 'waist')!, c = w.collider.kind === 'ellipse' ? w.collider.center : w.start
  s.shots.push({ x: c.x, y: c.y, vx: 0, vy: 0, life: 0, kind: 'rain', damage: 50, radius: 6, hit: [], angle: 0, tx: 0, ty: 0 })
  const fx = s.fx.length; stepHaebi(s, { x: 0, y: 0 }, DT)
  assert.deepEqual(g.brokenSeen, ['waist']); assert.equal(g.brokenAt.waist, g.age)
  assert.equal(s.fx.slice(fx).filter(f => f.championCue === 'roar').length, 1, '부서진 순간 큰 반응 하나')
  assert.ok(!g.pose.parts.find(p => p.id === 'waist')!.visible, '떨어진 허리 장식은 더 보이지 않는다')
})

/** 캔버스 행렬만 셈하는 가짜 2D 문맥 — 그림이 그리는 자리(drawImage 의 원점 · 행렬)를 적는다 */
function fakeCanvas() {
  let m = [1, 0, 0, 1, 0, 0]
  const stack: number[][] = [], draws: { name: string; m: number[] }[] = []
  const mul = (a: number[], b: number[]) => [a[0]! * b[0]! + a[2]! * b[1]!, a[1]! * b[0]! + a[3]! * b[1]!, a[0]! * b[2]! + a[2]! * b[3]!, a[1]! * b[2]! + a[3]! * b[3]!, a[0]! * b[4]! + a[2]! * b[5]! + a[4]!, a[1]! * b[4]! + a[3]! * b[5]! + a[5]!]
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_, k) => {
      if (k === 'translate') return (x: number, y: number) => { m = mul(m, [1, 0, 0, 1, x, y]) }
      if (k === 'scale') return (x: number, y: number) => { m = mul(m, [x, 0, 0, y, 0, 0]) }
      if (k === 'rotate') return (a: number) => { m = mul(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]) }
      if (k === 'save') return () => { stack.push(m) }
      if (k === 'restore') return () => { m = stack.pop() ?? m }
      if (k === 'drawImage') return (img: { tag?: string }) => { draws.push({ name: img.tag ?? '', m: [...m] }) }
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} })
      if (k === 'globalAlpha') return 1
      return () => {}
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D
  return { ctx, draws, at: (x: number, y: number) => ({ x: m[0]! * x + m[2]! * y + m[4]!, y: m[1]! * x + m[3]! * y + m[5]! }) }
}
const fakeImages = () => new Map<string, unknown>([...SHAMAN_PIECES.map(p => [SHAMAN_ART[p], { tag: p, width: SHAMAN_SOURCE[p].size[0], height: SHAMAN_SOURCE[p].size[1], naturalWidth: SHAMAN_SOURCE[p].size[0], naturalHeight: SHAMAN_SOURCE[p].size[1], complete: true }] as [string, unknown]),
  ['fx/awaken/flame.png', { tag: 'flame', width: 384, height: 384 }], ['raid/bell-ring.png', { tag: 'ring', width: 160, height: 160 }]]) as unknown as Map<string, HTMLImageElement>

test('그림은 판정과 같은 변환으로 그린다 — 자세·기울임·원무·좌우가 바뀌어도 원본 px 한 점이 같은 판 좌표로', () => {
  const { g } = actor()
  for (const key of [0, 1, 2, 3] as const) for (const facing of [1, -1] as const) for (const [lean, spin, squash, lift] of [[0, 0, 0, 0], [.2, .1, .05, 12], [-.15, .6, -.08, -9]] as const) {
    const f = { ...g.motion.current, key, facing, lean, spin, squash, lift, turn: 0, x: 400, y: 460 }, c = fakeCanvas()
    shamanBodySpace(c.ctx, f)
    for (const p of [S.rig.keys[key]!.head, S.rig.keys[key]!.fan[1], S.rig.keys[key]!.waist, [100, 700]] as const) {
      const a = shamanPoint(f, [p[0], p[1]]), b = c.at(p[0], p[1])
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-6, `${key}/${facing}/${lean}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`)
    }
  }
  // 그려지는 몸 그림의 발 = 판의 발 자리 · 머리 판정 타원은 그림의 머리 위에
  const c = fakeCanvas(), images = fakeImages()
  assert.ok(drawShaman(c.ctx, images, g, { heroX: 0, heroY: 0 }))
  const body = c.draws.find(d => d.name === `body-${g.pose.frame.key}`)
  assert.ok(body, '몸을 그렸다')
  const feet = S.rig.keys[g.pose.frame.key]!.feet, [cx, cy] = SHAMAN_SOURCE[`body-${g.pose.frame.key}` as 'body-0'].crop
  const m = body!.m, at = (x: number, y: number) => ({ x: m[0]! * x + m[2]! * y + m[4]!, y: m[1]! * x + m[3]! * y + m[5]! })
  // drawImage(img, cropX, cropY, w, h) 이므로 그림 안 원본 px p 는 행렬로 (p) 에 놓인다
  const drawnFeet = at(feet[0], feet[1]), simFeet = shamanPoint(g.pose.frame, feet)
  assert.ok(Math.hypot(drawnFeet.x - simFeet.x, drawnFeet.y - simFeet.y) < 1e-6, `${JSON.stringify(drawnFeet)} vs ${JSON.stringify(simFeet)} (crop ${cx},${cy})`)
})

test('그림: 모든 상태에서 그리기가 판 상태를 바꾸지 않는다 · 카메라 경계가 온몸을 담는다 · 산성에서만 그림을 불러온다', async () => {
  const images = fakeImages()
  for (const move of SHAMAN_MOVES) {
    const { e, g } = actor(), target = targetFor(g, e, move)
    assert.ok(beginShamanMove(g, e, target, move, 2, C.speed, () => .3))
    g.partHP.fan = move === 'pulse' ? 0 : g.partHP.fan; g.brokenAt.fan = g.age
    let n = 0
    while (g.state !== 'recover' && n++ < 2000) {
      step(g, e, target)
      const before = JSON.stringify(g), c = fakeCanvas()
      drawShamanGround(c.ctx, images, g); drawShaman(c.ctx, images, g, { heroX: e.x, heroY: e.y - 100 }); drawShamanThreats(c.ctx, images, g)
      assert.equal(JSON.stringify(g), before, `${move} 그리기가 판을 바꿨다`)
      const b = shamanVisualBounds(g)!, col = shamanCollisionBounds(g.pose)
      assert.ok(b.left <= col.left + 1e-6 && b.right >= col.right - 1e-6 && b.top <= col.top + 1e-6 && b.bottom >= col.bottom - 1e-6, `${move} 경계`)
    }
  }
  // 등장 · 쓰러짐
  const s = createHaebi(7, 'stage', 'sword', { stage: 'fortress', simRules: '55-SHAMAN' }); s.spawn = s.nextElite = s.nextBarrage = 1e9
  const e = spawnGiant(s)!, g = e.giant as ShamanState, drawn: number[] = []
  for (let i = 0; i < S.entrySeconds / DT; i++) { stepHaebi(s, { x: 0, y: 0 }, DT); const c = fakeCanvas(); drawShamanGround(c.ctx, images, g); drawShaman(c.ctx, images, g, { heroX: 0, heroY: 0 }); drawn.push(c.draws.length) }
  assert.ok(Math.max(...drawn) > 10, '등장에 불·방울이 그려진다')
  for (const t of [0, 1, 2, 2.7, 3]) { const c = fakeCanvas(); drawShamanFall(c.ctx, images, g, t) }
  // 그림 불러오기: 산성 밖은 요청 없음 · 다른 크기면 하나도 넣지 않는다
  const made: string[] = [], fake = (w: (key: string) => readonly [number, number]) => () => { const img: Record<string, unknown> = { decode: async () => {} }; let src = ''; Object.defineProperty(img, 'src', { set(v: string) { src = v; made.push(v); const key = v.split('/').pop()!.replace('.png', '') as keyof typeof SHAMAN_SOURCE; const [nw, nh] = w(key); Object.assign(img, { naturalWidth: nw, naturalHeight: nh, width: nw, height: nh, complete: true }); queueMicrotask(() => (img['onload'] as () => void)()) }, get: () => src }); return img as unknown as HTMLImageElement }
  const none = new Map<string, HTMLImageElement>()
  assert.equal(await prewarmShamanArt('snow', none, '/', fake(k => SHAMAN_SOURCE[k as 'waist'].size)), true); assert.equal(made.length, 0)
  const bad = new Map<string, HTMLImageElement>()
  assert.equal(await prewarmShamanArt('fortress', bad, '/', fake(k => k === 'waist' ? [1, 1] : SHAMAN_SOURCE[k as 'waist'].size)), false); assert.equal(bad.size, 0)
  const good = new Map<string, HTMLImageElement>()
  assert.equal(await prewarmShamanArt('fortress', good, '/', fake(k => SHAMAN_SOURCE[k as 'waist'].size)), true); assert.equal(good.size, SHAMAN_PIECES.length); assert.ok(shamanArtReady(good))
})

test('가벼운 셈은 무거운 셈과 같은 답 — 빈 원(상자 거름)은 safeLanding 과 같은 점 · 계획용 경계는 판정 부위 경계와 같은 값', () => {
  const { e, g } = actor(), rng = makeRng(91)
  for (let i = 0; i < 120; i++) {
    const phase = (1 + i % 3) as 1 | 2 | 3, env = shamanEnvironment(phase).shapes, player = { x: 40 + rng.next() * (W - 80), y: 70 + rng.next() * (H - 100) }
    const move = SHAMAN_MOVES[i % SHAMAN_MOVES.length]!, plan = planShaman(g, e, player, move, 2, { hold: rng.next(), shape: rng.next() })
    if (!plan) continue
    for (const s of plan.subs) for (const seconds of [.3, 1, 2.4]) assert.deepEqual(shamanSafeLanding(s.shapes, env, player, C.speed, seconds), safeLanding(s.shapes, env, player, C.speed, seconds), `${move} ${seconds}`)
  }
  for (const key of [0, 1, 2, 3] as const) for (const waist of [1, 0]) {
    g.partHP.waist = waist
    const f = { ...g.motion.current, key, facing: (key % 2 ? -1 : 1) as 1 | -1, lean: .13 * (key - 1.5), spin: key * .17, squash: .03 * key, lift: 7 * key, rise: 1 }
    assert.deepEqual(shamanFrameBounds(g, e, f), shamanCollisionBounds(makeShamanPose(f, { ownerId: e.id, tick: 1, alive: true, targetable: true, recovering: false, partHP: g.partHP })), `자세 ${key} 허리 ${waist}`)
  }
})

test('수 계획은 판을 바꾸지 않는다 · 같은 자리·같은 난수면 같은 계획', () => {
  for (const move of SHAMAN_MOVES) {
    const { e, g } = actor(), target = targetFor(g, e, move), before = JSON.stringify(g)
    const a = planShaman(g, e, target, move, 2, { hold: .3, shape: .7 }), b = planShaman(g, e, target, move, 2, { hold: .3, shape: .7 })
    assert.ok(a, move); assert.equal(JSON.stringify(a), JSON.stringify(b)); assert.equal(JSON.stringify(g), before)
  }
})
