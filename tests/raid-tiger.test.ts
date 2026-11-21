// 55 설원 고개 거대 보스 「백두 대호」 — 규칙 55-TIGER 는 설원에만 · 여섯 수의 고정 예고·봉인·덮치기 흔들림·막별 안전로 · 기록 재생
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_GIANT as G, HAEBI_TIGER as T, HAEBI_RUN as C, HAEBI_STAGES as ST } from '../src/tune/params.ts'
import { makeRng } from '../src/core/rng.ts'
import { createHaebi, stepHaebi, choose, spawnGiant, giantHUD, raidRulesForStage, usesGiantBoss, normalizedRaidOpts, runDuration, bossTime, midbossTime, type HaebiRun, type Kit } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, finishRecord, replayRaid, STEP } from '../src/raid/runlog.ts'
import { createTiger, stepTiger, commitTiger, beginTigerMove, planTiger, tigerCandidates, breakTigerPart, damageTigerPart, staggerTiger, updateTigerPose, tigerCollisionBounds, tigerContact, TIGER_HP, type TigerState, type TigerMove } from '../src/raid/tiger.ts'
import { safeLanding, type GiantOwner } from '../src/raid/imugi.ts'
import { overlaps, type Shape } from '../src/raid/giant-core.ts'
import { drawTigerGround } from '../src/raid/tiger-view.ts'
import { TIGER_ART } from '../src/raid/tiger-art.ts'

const DT = 1 / 120, W = C.width, H = C.height
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const MOVES = Object.keys(T.moves) as TigerMove[]
/** 막 3까지 다 열린 조용한 범 (판 없이 · 장수는 앞 아래) */
function actor(phase: 1 | 2 | 3 = 3) {
  const e: GiantOwner = { id: 9, x: W / 2, y: T.homeY, hp: T.hp, max: T.hp }, g = createTiger(e)
  g.phase = phase; g.state = 'recover'; g.timer = 0; g.age = T.entrySeconds; updateTigerPose(g, e, 1)
  return { e, g }
}
/** 이 수가 쓰이는 자리에 장수를 둔다 */
function targetFor(g: TigerState, e: GiantOwner, move: TigerMove) {
  const f = g.motion.current.facing
  if (move === 'tail') return { x: e.x - f * 210, y: e.y - 60 }
  if (move === 'swipe') return { x: e.x + f * 190, y: e.y + 40 }
  if (move === 'pounce') return { x: e.x + f * 300, y: e.y + 140 }
  return { x: e.x + f * 120, y: e.y + 150 }
}
const step = (g: TigerState, e: GiantOwner, player: { x: number; y: number }, random: () => number = () => 0, tick = 1) => stepTiger(g, e, { dt: DT, tick, player, speed: C.speed, dazed: false, random })
const point = (p: { x: number; y: number }): Shape => ({ kind: 'circle', center: { x: p.x, y: p.y }, radius: 0 })

test('55-TIGER 는 설원에만 선다 · 다른 판은 56B 그대로 · 여울·목책 규칙은 그대로', () => {
  assert.equal(raidRulesForStage('snow'), '55-TIGER'); assert.equal(raidRulesForStage('ford'), '55-IMUGI'); assert.equal(raidRulesForStage('palisade'), '56C')
  assert.equal(raidRulesForStage('forest'), '56B'); assert.equal(raidRulesForStage('fortress'), '55-SHAMAN')
  for (const stage of ['forest', 'ford', 'palisade', 'fortress'] as const) {
    const a = createHaebi(7, 'stage', 'sword', { stage, simRules: '55-TIGER' }), b = createHaebi(7, 'stage', 'sword', { stage, simRules: '56B' })
    assert.equal(usesGiantBoss(a), false, stage)
    for (let i = 0; i < 60 * 20; i++) { stepHaebi(a, { x: 0, y: 0 }, 1 / 60); stepHaebi(b, { x: 0, y: 0 }, 1 / 60) }
    assert.deepEqual(a, b, `${stage}: 55-TIGER 를 넣어도 56B 와 같은 판`)
  }
  assert.equal(usesGiantBoss(createHaebi(7, 'trial', 'axe', { simRules: '55-TIGER' })), false)
  const old = createHaebi(7, 'stage', 'axe', { stage: 'snow', simRules: '56B' })
  assert.equal(usesGiantBoss(old), false, '옛 56B 설원 기록은 두목 그대로 다시 돈다'); assert.equal(runDuration(old), 1230)
  const s = createHaebi(7, 'stage', 'axe', { stage: 'snow', simRules: '55-TIGER' })
  assert.equal(usesGiantBoss(s), true); assert.equal(runDuration(s), 1380); assert.equal(normalizedRaidOpts(s, { stage: 'snow' }).simRules, '55-TIGER')
  assert.equal(midbossTime(s), 600)
})

test('10분 중간 보스는 설산 우두머리(체력 몫) · 19분 거대 보스는 백두 대호 · 이름이 HUD 와 격파 알림에', () => {
  const s = createHaebi(31, 'stage', 'sword', { stage: 'snow', simRules: '55-TIGER' }); s.spawn = s.nextElite = s.nextBarrage = 1e9
  s.t = midbossTime(s) - DT; stepHaebi(s, { x: 0, y: 0 }, DT)
  const mid = s.enemies.find(e => e.bossRole === 'midboss')!
  assert.ok(mid && !mid.giant); assert.ok(Math.abs(mid.max - C.bossHp * ST.snow.bossHp * 6 * T.midHpScale) < 1e-6, `${mid.max}`)
  s.enemies = []; s.t = bossTime(s) - DT; stepHaebi(s, { x: 0, y: 0 }, DT)
  const e = s.enemies.find(x => x.giant)!
  assert.equal(e.giant!.kind, 'tiger'); assert.equal(e.max, T.hp)
  assert.equal(giantHUD(s)!.name, '백두 대호')
  // 등장 동안은 맞지 않는다 (몸이 내려앉는 중)
  assert.ok(e.giant!.pose.parts.every(p => !p.targetable))
  e.hp = 1; e.giant!.state = 'recover'; e.giant!.timer = 5; updateTigerPose(e.giant as TigerState, e, 1)
  s.x = e.x; s.y = e.y + 60; s.shots.push({ x: e.x, y: e.y - 120, vx: 0, vy: 0, life: 0, kind: 'rain', damage: 1e9, radius: 260, hit: [], angle: 0, tx: 0, ty: 0 })
  stepHaebi(s, { x: 0, y: 0 }, DT)
  assert.equal(s.state, 'won'); assert.equal(s.message, '백두 대호 격파 · 토벌 완료'); assert.equal(s.giantFlow!.finalDefeated, true)
})

test('여섯 수 모두 몸 준비 → 붉은 바닥(고정) → 타격 · 몸 예고 동안엔 바닥이 없다 · 총예고 0.5~2.5초 · 판 안에 몸이 들어온다', () => {
  for (const move of MOVES) {
    const { e, g } = actor(), target = targetFor(g, e, move)
    assert.ok(tigerCandidates(g, e, target).includes(move), `${move} 후보`)
    assert.ok(beginTigerMove(g, e, target, move, 2, C.speed, () => .5), `${move} 세움`)
    const shapes = g.attack!.shapes, serial = JSON.stringify(shapes), w = g.attack!.windup
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
    const b = tigerCollisionBounds(g.pose)
    assert.ok(b.left >= -1e-6 && b.right <= W + 1e-6 && b.top >= -1e-6 && b.bottom <= H + 1e-6, `${move} 판 밖 ${JSON.stringify(b)}`)
  }
})

test('빨강 = 실제 피해: 붉은 모양 안이면 맞고 밖이면 안 맞는다 (눈사태는 내려온 자리만)', () => {
  for (const move of MOVES) {
    const { e, g } = actor(), target = targetFor(g, e, move)
    assert.ok(beginTigerMove(g, e, target, move, 2, C.speed, () => .4))
    const shapes = g.attack!.shapes, inside = shapes[0]!.kind === 'circle' || shapes[0]!.kind === 'ellipse' ? (shapes[0] as { center: { x: number; y: number } }).center : null
    const probe = inside ?? target
    // 안: 끝까지 서 있으면 한 번 맞는다
    let hurt = 0, n = 0
    while (g.state !== 'recover' && n++ < 1200) { step(g, e, probe); commitTiger(g, e, probe, d => { hurt += d }, false, () => {}) }
    const shouldHit = shapes.some(s => overlaps(s, point(probe)))
    assert.equal(hurt > 0, shouldHit, `${move} 안 ${JSON.stringify(probe)}`)
    if (shouldHit) assert.equal(hurt, T.moves[move].damage, `${move} 한 번만`)
  }
  // 밖: 어느 모양에도 닿지 않는 곳은 맞지 않는다 (환경은 끈다)
  for (const move of MOVES) {
    const { e, g } = actor(), target = targetFor(g, e, move)
    assert.ok(beginTigerMove(g, e, target, move, 2))
    const safe = safeLanding(g.attack!.shapes, [], target, 1e4, 1)!
    g.environment.active = false; g.environment.age = -1e9
    let hurt = 0, n = 0
    while (g.state !== 'recover' && n++ < 1200) { step(g, e, safe); g.environment.age = -1e9; commitTiger(g, e, safe, d => { hurt += d }, false, () => {}) }
    assert.equal(hurt, 0, `${move} 밖 ${JSON.stringify(safe)}`)
  }
})

test('부위가 부서지면 그 수가 봉인된다 (앞발·꼬리·턱) · 예약된 수도 취소 · 수가 바뀐다 (덮치기 거리 · 눈사태 줄 · 잠행 꼬리)', () => {
  // 봉인: 후려치기(그 쪽 앞다리) · 꼬리 채찍(꼬리) · 포효(턱)
  const seal: [TigerMove, (typeof TIGER_HP)[number]][] = [['swipe', 'fore-near'], ['tail', 'tail'], ['roar', 'jaw']]
  for (const [move, part] of seal) {
    const { e, g } = actor(), target = targetFor(g, e, move)
    assert.ok(tigerCandidates(g, e, target).includes(move))
    assert.ok(beginTigerMove(g, e, target, move, 2))
    assert.equal(damageTigerPart(g, part === 'tail' ? 'tail2' : part, 1e12), true, `${part} 처음 부서짐`)
    assert.equal(g.state, 'recover', `${move} 예약 취소`); assert.equal(g.attack, null)
    assert.equal(damageTigerPart(g, part === 'tail' ? 'tail2' : part, 1), false, '두 번 부서지지 않는다')
    g.timer = 0; g.last = null
    assert.ok(!tigerCandidates(g, e, target).includes(move), `${move} 봉인`)
  }
  // 먼 쪽 앞다리만 부서지면 가까운 쪽(아래) 후려치기는 남는다
  { const { e, g } = actor(), target = targetFor(g, e, 'swipe'); g.partHP['fore-far'] = 0; assert.ok(tigerCandidates(g, e, target).includes('swipe')) }
  // 덮치기: 뒷다리가 하나라도 부서지면 뛰는 거리가 절반
  {
    // 판 끝에 걸리지 않는 거리 (끝에 걸리면 몸을 판 안으로 당겨 거리가 줄어든다)
    const a = actor(), b = actor(), target = { x: a.e.x + 260, y: a.e.y + 200 }
    b.g.partHP['hind-far'] = 0
    const pa = planTiger(a.g, a.e, target, 'pounce', 2)!, pb = planTiger(b.g, b.e, target, 'pounce', 2)!
    const leap = (p: typeof pa, s: TigerState) => Math.hypot(p.impact.x - s.motion.current.x, p.impact.y - s.motion.current.y)
    assert.ok(Math.abs(leap(pb, b.g) / leap(pa, a.g) - T.moves.pounce.brokenLeap) < .08, `${leap(pb, b.g)} / ${leap(pa, a.g)}`)
  }
  // 눈사태: 앞다리가 하나라도 부서지면 줄 둘 · 줄 사이는 3P
  {
    const a = actor(), b = actor(), target = targetFor(a.g, a.e, 'avalanche')
    b.g.partHP['fore-near'] = 0
    assert.equal(planTiger(a.g, a.e, target, 'avalanche', 2)!.lines!.length, T.moves.avalanche.lines)
    const lines = planTiger(b.g, b.e, target, 'avalanche', 2)!.lines!
    assert.equal(lines.length, T.moves.avalanche.brokenLines)
    assert.ok(lines[1]! - lines[0]! - T.moves.avalanche.width >= G.playerDiameter * G.safeDiameters - 1e-9)
  }
  // 잠행: 화살 묶음이 부서졌으면 진짜 눈 더미 위로 꼬리 끝이 먼저 보인다 (그림만 · 붉은 바닥은 그대로)
  const peeks = (arrows: number) => {
    const { e, g } = actor(), target = targetFor(g, e, 'dive'); g.partHP.arrows = arrows
    assert.ok(beginTigerMove(g, e, target, 'dive', 2, C.speed, () => .9))
    while (g.state === 'body') step(g, e, target)
    const drawn: string[] = [], img = { width: 100, height: 100, naturalWidth: 491, naturalHeight: 318, complete: true }
    const ctx = new Proxy({}, { get: (_, k) => k === 'drawImage' ? (i: { tag?: string }) => drawn.push(i.tag ?? '') : () => {}, set: () => true }) as unknown as CanvasRenderingContext2D
    drawTigerGround(ctx, new Map([[TIGER_ART['tail-tip'], { ...img, tag: 'tip' } as unknown as HTMLImageElement]]), g)
    return drawn.includes('tip')
  }
  assert.equal(peeks(0), true); assert.equal(peeks(1), false)
})

test('덮치기 흔들림(속임)은 seeded — 같은 씨앗 같은 박자 · 씨앗마다 1.2~2.0초 안에서 달라진다', () => {
  const totals: number[] = []
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const run = () => { const { e, g } = actor(), rng = makeRng(seed), target = targetFor(g, e, 'pounce'); assert.ok(beginTigerMove(g, e, target, 'pounce', 2, C.speed, () => rng.next())); return g.attack!.windup.total }
    const a = run(), b = run()
    assert.equal(a, b, `seed ${seed}`); totals.push(a)
    assert.ok(a >= T.moves.pounce.body + T.moves.pounce.red - 1e-9 && a <= T.moves.pounce.body + T.moves.pounce.red + T.moves.pounce.wiggle + 1e-9)
  }
  assert.ok(new Set(totals.map(t => t.toFixed(3))).size >= 5, `흔들림이 늘 같다: ${totals}`)
  assert.ok(Math.min(...totals) >= 1.2 - 1e-9 && Math.max(...totals) <= 2 + 1e-9)
})

test('막마다 가운데 세로 3P 길이 늘 비고 · 고른 수는 언제나 닿을 수 있는 3P 빈 원이 있다', () => {
  const lane: Shape = { kind: 'box', center: { x: W / 2, y: H / 2 }, halfX: G.playerDiameter * G.safeDiameters / 2, halfY: H / 2, angle: 0 }
  for (const phase of [1, 2, 3] as const) {
    // 막은 회복이 끝날 때 하나씩 넘어가며 포효한다 (둘을 건너뛰지 않는다)
    const { e, g } = actor(1), roars: number[] = []
    e.hp = e.max * (phase === 1 ? 1 : phase === 2 ? .6 : .2)
    for (let n = 0; n < 3000 && g.environment.phase < phase; n++) { if (g.state !== 'roar') { g.state = 'recover'; g.timer = 0; g.attack = null } if (step(g, e, { x: W / 2, y: H - 80 }) === 'roar') roars.push(g.phase) }
    assert.equal(g.environment.phase, phase); assert.deepEqual(roars, phase === 1 ? [] : phase === 2 ? [2] : [2, 3])
    assert.ok(g.environment.shapes.every(s => !overlaps(s, lane)), `막 ${phase} 가운데 길`)
  }
  // 여러 자리에서 수를 고르게 해 본다: 세운 수는 모두 3P 빈 원을 실제 이동 속도로 닿을 수 있다
  let begun = 0
  for (let i = 0; i < 40; i++) {
    const { e, g } = actor(3), rng = makeRng(100 + i), player = { x: 60 + (i * 97) % (W - 120), y: 120 + (i * 61) % (H - 160) }
    g.phase = 3; g.last = null
    step(g, e, player, () => rng.next())
    if (!g.attack) continue
    begun++
    const seconds = g.attack.move === 'pounce' || g.attack.move === 'dive' ? g.attack.windup.red : g.attack.windup.total
    assert.ok(safeLanding(g.attack.shapes, g.environment.shapes, player, C.speed, seconds), `${g.attack.move} @${JSON.stringify(player)}`)
    if (g.attack.move === 'roar') assert.ok(!g.attack.shapes.some(s => overlaps(s, lane)), '포효 가운데 3P')
  }
  assert.ok(begun >= 25, `세운 수 ${begun}`)
})

test('회복 중 첫 타격은 움찔하고 회복이 한 번만 늘어난다 · 머리는 회복 중 2배', () => {
  const { e, g } = actor(), target = targetFor(g, e, 'swipe')
  assert.ok(beginTigerMove(g, e, target, 'swipe', 2))
  while (g.state !== 'recover') step(g, e, target)
  const before = g.timer
  staggerTiger(g); assert.ok(g.timer > before && g.stagger > 0)
  const after = g.timer; g.recoveryHitUsed = true
  assert.ok(after - before <= T.staggerRecover + 1e-9)
  const head = g.pose.parts.find(p => p.id === 'head')!, c = head.collider.kind === 'ellipse' ? head.collider.center : head.start
  const hit = tigerContact(g, { kind: 'circle', center: c, radius: 1 })!
  assert.equal(hit.partId, 'head'); assert.equal(hit.weakScale, G.recoveryHeadDamage)
})

test('잠행 동안은 눈 속이라 맞지 않고 · 솟은 자리로 몸이 옮겨진다 · 포효는 띠 안의 장수를 바깥으로 민다', () => {
  {
    const { e, g } = actor(), target = targetFor(g, e, 'dive')
    assert.ok(beginTigerMove(g, e, target, 'dive', 2, C.speed, () => 0))
    const landing = g.attack!.landing!
    let hidden = 0
    while (g.state !== 'recover') { step(g, e, target); if (g.state === 'tell') { hidden++; assert.ok(g.pose.parts.every(p => !p.targetable)) } }
    assert.ok(hidden > 0); assert.deepEqual({ x: e.x, y: e.y }, landing)
    assert.ok(g.pose.parts.some(p => p.targetable))
  }
  {
    const { e, g } = actor(2), player = { x: 70, y: H - 90 }
    assert.ok(beginTigerMove(g, e, { x: 300, y: H - 90 }, 'roar', 2))
    let pushed = 0, n = 0
    while (g.state !== 'recover' && n++ < 1000) { step(g, e, player); commitTiger(g, e, player, () => {}, false, dx => { pushed += dx }) }
    assert.equal(pushed, -T.moves.roar.push)
  }
})

test('엔진 박자: 30/60/120 그림 빈도가 같은 고정 틱이면 같은 범 · 같은 난수', () => {
  const run = (fps: number) => {
    const { e, g } = actor(1), rng = makeRng(5519), damage: number[] = []; let lag = 0, tick = 0
    g.phase = 1
    for (let frame = 0; frame < fps * 14; frame++) {
      lag += 1 / fps
      while (lag + 1e-12 >= DT) { tick++; const player = { x: W / 2 + Math.cos(tick / 160) * 260, y: T.homeY + 120 + Math.sin(tick / 90) * 60 }; stepTiger(g, e, { dt: DT, tick, player, speed: C.speed, dazed: false, random: () => rng.next() }); commitTiger(g, e, player, n => damage.push(n), false, () => {}); lag -= DT }
      JSON.stringify(g.pose)
    }
    return hash({ e, g, damage, seed: rng.state(), tick })
  }
  assert.equal(run(30), run(60)); assert.equal(run(60), run(120))
})

test('55-TIGER 판 기록은 거대 보스 싸움까지 그대로 다시 돈다 (짧게 줄인 설원 · 보통 입력)', () => {
  // 설원 판 길이 몫과 범 체력만 줄여 거대 보스 싸움(막 전환 · 부위 파괴)까지 빨리 닿게 한다 — 기록과 재생이 같은 값을 쓴다
  const length = ST.snow.length, hp = T.hp
  Object.assign(ST.snow, { length: .12 }); Object.assign(T, { hp: 90000 })
  try {
    const opts = { stage: 'snow' as const, simRules: '55-TIGER' as const, bonus: { might: 10, vigor: 10, armor: 5, regen: 5, haste: 5, swift: 5 } }
    const s = createHaebi(41, 'stage', 'sword', opts)
    const r = startRecord(s, { id: 't55', started: 'x', mode: 'stage', stage: 'snow', hero: 'haebi', kit: 'sword', sprite: 'haebi', seed: 41, opts, from: null })
    let tiger = false, phase = 1, broken = 0, moves = new Set<string>()
    while (s.state === 'playing' && s.t < 400) {
      if (s.offers.length) { const p = botChoice(s, 'storm'); choose(s, p); recPick(r, p); continue }
      stepHaebi(s, recInput(r, { ...botInput(s, .5), skill: Math.floor(s.t * 2) % 7 === 0 }), STEP)
      const g = s.enemies.find(e => e.giant?.kind === 'tiger')?.giant
      if (g?.kind === 'tiger') { tiger = true; phase = Math.max(phase, g.phase); broken = Math.max(broken, g.brokenSeen.length); if (g.attack) moves.add(g.attack.move) }
    }
    assert.ok(tiger, '거대 보스까지 갔다'); assert.ok(phase >= 2 || s.giantFlow!.finalDefeated, `막 ${phase}`); assert.ok(moves.size >= 2, [...moves].join())
    const g = finishRecord(r, 0, 'x')
    assert.equal(g.rules, '55-TIGER')
    assert.equal(JSON.stringify(replayRaid(JSON.parse(JSON.stringify(g)))), JSON.stringify(s))
  } finally { Object.assign(ST.snow, { length }); Object.assign(T, { hp }) }
})

test('실제 무기 넷이 범의 부위 하나와 본체를 함께 깎는다 · 부위가 처음 부서지면 포효(큰 반응) 하나', () => {
  for (const kit of ['axe', 'bow', 'spear', 'sword'] as Kit[]) {
    const s = createHaebi(257, 'stage', kit, { stage: 'snow', simRules: '55-TIGER' })
    s.spawn = s.nextElite = s.nextBarrage = 1e9
    for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) s.cool[k] = 1e9
    const e = spawnGiant(s)!, g = e.giant as TigerState
    g.state = 'recover'; g.timer = 9; g.age = T.entrySeconds; updateTigerPose(g, e, 0)
    const leg = g.pose.parts.find(p => p.id === 'fore-near')!
    s.x = leg.end.x + 40; s.y = leg.end.y + 10
    s.cool[({ axe: 'axe', bow: 'bow', spear: 'spear', sword: 'sword' } as const)[kit as 'axe']] = 0
    const before = e.hp, parts = { ...g.partHP }
    for (let i = 0; i < 90 && e.hp === before; i++) stepHaebi(s, { x: 0, y: 0 }, DT)
    assert.ok(e.hp < before, `${kit} 못 맞힘`)
    assert.ok(Object.keys(parts).filter(k => g.partHP[k as keyof typeof parts] !== parts[k as keyof typeof parts]).length <= 1, `${kit} 부위 여럿`)
  }
  const s = createHaebi(257, 'stage', 'sword', { stage: 'snow', simRules: '55-TIGER' }); s.spawn = s.nextElite = s.nextBarrage = 1e9
  const e = spawnGiant(s)!, g = e.giant as TigerState
  g.state = 'recover'; g.timer = 9; g.age = T.entrySeconds; g.partHP.arrows = 1; updateTigerPose(g, e, 0)
  const ar = g.pose.parts.find(p => p.id === 'arrows')!
  s.shots.push({ x: ar.start.x, y: ar.start.y, vx: 0, vy: 0, life: 0, kind: 'rain', damage: 50, radius: 8, hit: [], angle: 0, tx: 0, ty: 0 })
  const fx = s.fx.length; stepHaebi(s, { x: 0, y: 0 }, DT)
  assert.deepEqual(g.brokenSeen, ['arrows']); assert.equal(g.brokenAt.arrows, g.age)
  assert.equal(s.fx.slice(fx).filter(f => f.championCue === 'roar').length, 1, '부서진 순간 포효 하나')
  assert.equal(breakTigerPart(g, 'arrows'), false)
  assert.ok(!g.pose.parts.find(p => p.id === 'arrows')!.visible, '떨어진 화살 묶음은 더 보이지 않는다')
})
