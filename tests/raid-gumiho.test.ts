// 55 숲 산길 거대 보스 「구미호」 — 규칙 55-GUMIHO 는 숲 산길 열전에만 · 여섯 수의 고정 예고·봉인·seeded 박자·환영·막별 안전로 · 기록 재생
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_GIANT as G, HAEBI_GUMIHO as F, HAEBI_RUN as C, HAEBI_STAGES as ST, HAEBI_CHAMPION as CH } from '../src/tune/params.ts'
import { makeRng } from '../src/core/rng.ts'
import { createHaebi, stepHaebi, choose, spawnGiant, giantHUD, raidRulesForStage, usesGiantBoss, normalizedRaidOpts, runDuration, bossTime, midbossTime, type HaebiRun, type Kit } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, finishRecord, replayRaid, STEP } from '../src/raid/runlog.ts'
import { createGumiho, stepGumiho, commitGumiho, beginGumihoMove, planGumiho, gumihoCandidates, gumihoSealed, breakGumihoPart, damageGumihoPart, staggerGumiho, updateGumihoPose, gumihoCollisionBounds, gumihoContact, makeGumihoPose, GUMIHO_TAILS, CENTER_TAIL, type GumihoState, type GumihoMove } from '../src/raid/gumiho.ts'
import { safeLanding, type GiantOwner } from '../src/raid/imugi.ts'
import { overlaps, type Shape } from '../src/raid/giant-core.ts'
import { stageToolOpts } from '../tools/raid-stage-balance.ts'

const DT = 1 / 120, W = C.width, H = C.height
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const MOVES = Object.keys(F.moves) as GumihoMove[]
/** 막 3까지 다 열린 조용한 구미호 (판 없이) */
function actor(phase: 1 | 2 | 3 = 3) {
  const e: GiantOwner = { id: 9, x: W / 2, y: F.homeY, hp: F.hp, max: F.hp }, g = createGumiho(e)
  g.phase = phase; g.state = 'recover'; g.timer = 0; g.age = F.entrySeconds; updateGumihoPose(g, e, 1)
  return { e, g }
}
/** 이 수가 쓰이는 자리에 장수를 둔다 (앞 아래 · 수마다 닿는 거리) */
function targetFor(g: GumihoState, e: GiantOwner, move: GumihoMove) {
  const f = g.motion.current.facing
  if (move === 'leap') return { x: e.x + f * 300, y: e.y + 120 }
  if (move === 'thrust') return { x: e.x + f * 180, y: e.y + 90 }
  return { x: e.x + f * 150, y: e.y + 120 }
}
const step = (g: GumihoState, e: GiantOwner, player: { x: number; y: number }, random: () => number = () => 0, tick = 1) => stepGumiho(g, e, { dt: DT, tick, player, speed: C.speed, dazed: false, random })
const point = (p: { x: number; y: number }): Shape => ({ kind: 'circle', center: { x: p.x, y: p.y }, radius: 0 })

test('55-GUMIHO 는 숲 산길 열전에만 선다 · 각성 시련·선봉·다른 판은 56B 그대로 · 여울·설원·목책 규칙은 그대로', () => {
  assert.equal(raidRulesForStage('forest'), '55-GUMIHO'); assert.equal(raidRulesForStage('ford'), '55-IMUGI'); assert.equal(raidRulesForStage('snow'), '55-TIGER')
  assert.equal(raidRulesForStage('palisade'), '56C'); assert.equal(raidRulesForStage('fortress'), '56B')
  for (const stage of ['ford', 'palisade', 'snow', 'fortress'] as const) {
    const a = createHaebi(7, 'stage', 'sword', { stage, simRules: '55-GUMIHO' }), b = createHaebi(7, 'stage', 'sword', { stage, simRules: '56B' })
    assert.equal(usesGiantBoss(a), false, stage)
    for (let i = 0; i < 60 * 20; i++) { stepHaebi(a, { x: 0, y: 0 }, 1 / 60); stepHaebi(b, { x: 0, y: 0 }, 1 / 60) }
    assert.deepEqual(a, b, `${stage}: 55-GUMIHO 를 넣어도 56B 와 같은 판`)
  }
  // 각성 시련은 숲 그림을 쓰지만 거대 보스가 없다 · 선봉(기본 스테이지가 숲)도 마찬가지
  for (const mode of ['trial', 'vanguard'] as const) {
    const a = createHaebi(501, mode, 'sword', { simRules: '55-GUMIHO' }), b = createHaebi(501, mode, 'sword', { simRules: '56B' })
    assert.equal(usesGiantBoss(a), false, mode)
    for (let i = 0; i < 60 * 20; i++) { if (a.offers.length) choose(a, a.offers[0]!); if (b.offers.length) choose(b, b.offers[0]!); stepHaebi(a, { x: Math.sin(i / 120), y: 0 }, 1 / 60); stepHaebi(b, { x: Math.sin(i / 120), y: 0 }, 1 / 60) }
    assert.deepEqual(a, b, mode)
  }
  const old = createHaebi(7, 'stage', 'axe', { stage: 'forest', simRules: '56B' })
  assert.equal(usesGiantBoss(old), false, '옛 56B 숲 기록은 산적 대두목 그대로 다시 돈다'); assert.equal(runDuration(old), 1230)
  const s = createHaebi(7, 'stage', 'axe', { stage: 'forest', simRules: '55-GUMIHO' })
  assert.equal(usesGiantBoss(s), true); assert.equal(runDuration(s), 1380); assert.equal(normalizedRaidOpts(s, { stage: 'forest' }).simRules, '55-GUMIHO'); assert.equal(midbossTime(s), 600)
  assert.equal(stageToolOpts('forest', {}).simRules, '55-GUMIHO'); assert.equal(stageToolOpts('forest', {}, '56B').simRules, '56B')
})

test('10분 중간 보스는 산적 대두목(체력 몫) · 19분 거대 보스는 구미호 · 이름이 HUD 와 격파 알림에', () => {
  const s = createHaebi(31, 'stage', 'sword', { stage: 'forest', simRules: '55-GUMIHO' }); s.spawn = s.nextElite = s.nextBarrage = 1e9
  s.t = midbossTime(s) - DT; stepHaebi(s, { x: 0, y: 0 }, DT)
  const mid = s.enemies.find(e => e.bossRole === 'midboss')!
  assert.ok(mid && !mid.giant); assert.ok(Math.abs(mid.max - C.bossHp * ST.forest.bossHp * CH.stages.forest.bossHp * F.midHpScale) < 1e-6, `${mid.max}`)
  s.enemies = []; s.t = bossTime(s) - DT; stepHaebi(s, { x: 0, y: 0 }, DT)
  const e = s.enemies.find(x => x.giant)!
  assert.equal(e.giant!.kind, 'gumiho'); assert.equal(e.max, F.hp); assert.equal(giantHUD(s)!.name, '구미호')
  // 등장(여우불이 모이고 걸어 나오는 동안)은 맞지 않는다
  assert.ok(e.giant!.pose.parts.every(p => !p.targetable))
  e.hp = 1; e.giant!.state = 'recover'; e.giant!.timer = 5; updateGumihoPose(e.giant as GumihoState, e, 1)
  s.x = e.x; s.y = e.y + 60; s.shots.push({ x: e.x, y: e.y - 120, vx: 0, vy: 0, life: 0, kind: 'rain', damage: 1e9, radius: 260, hit: [], angle: 0, tx: 0, ty: 0 })
  stepHaebi(s, { x: 0, y: 0 }, DT)
  assert.equal(s.state, 'won'); assert.equal(s.message, '구미호 격파 · 토벌 완료'); assert.equal(s.giantFlow!.finalDefeated, true)
})

test('여섯 수 모두 몸 준비 → 붉은 바닥(고정) → 타격 · 몸 예고 동안엔 바닥이 없다 · 총예고 0.5~2.5초 · 몸(꼬리 빼고)이 판 안에', () => {
  for (const move of MOVES) {
    const { e, g } = actor(), target = targetFor(g, e, move)
    assert.ok(gumihoCandidates(g, e, target).includes(move), `${move} 후보`)
    assert.ok(beginGumihoMove(g, e, target, move, 2, C.speed, () => .5), `${move} 세움`)
    const shapes = g.attack!.shapes, serial = JSON.stringify(shapes), w = g.attack!.windup
    assert.ok(w.total >= G.windup.min - 1e-9 && w.total <= G.windup.max + 1e-9, `${move} total ${w.total}`)
    let t = 0, red = 0, prep = 0
    while ((g.state === 'body' || g.state === 'hold' || g.state === 'tell') && t < 5) {
      if (g.state === 'body' || g.state === 'hold') { assert.equal(g.pose.worldGeometry.tell.length, 0, `${move} 몸 예고에 바닥`); prep++ }
      if (g.state === 'tell') { assert.equal(g.pose.worldGeometry.tell, g.attack!.shapes); red++ }
      // 장수가 움직여도 예고는 따라가지 않는다
      step(g, e, { x: target.x + Math.sin(t * 9) * 200, y: target.y + 80 }); t += DT
    }
    assert.equal(g.state, 'strike', move); assert.ok(prep > 0 && red > 0, move)
    assert.equal(JSON.stringify(g.attack!.shapes), serial, `${move} 예고가 바뀌었다`)
    assert.ok(Math.abs(t - w.total) <= DT * 2, `${move} ${t} vs ${w.total}`)
    const b = gumihoCollisionBounds(g.pose, false)
    assert.ok(b.left >= -1e-6 && b.right <= W + 1e-6 && b.top >= -1e-6 && b.bottom <= H + 1e-6, `${move} 판 밖 ${JSON.stringify(b)}`)
  }
})

test('빨강 = 실제 피해: 붉은 모양 안이면 차례마다 한 번 맞고 밖이면 안 맞는다', () => {
  for (const move of MOVES) {
    const { e, g } = actor(), target = targetFor(g, e, move)
    assert.ok(beginGumihoMove(g, e, target, move, 2, C.speed, () => .4))
    const hits = g.attack!.hits, s0 = hits[0]!.shapes[0]!
    // 첫 차례 모양 안의 점 (원·타원·부채는 가운데에서 조금 · 선·곡선은 가운데 줄 위)
    const probe = s0.kind === 'line' ? { x: (s0.from.x + s0.to.x) / 2, y: (s0.from.y + s0.to.y) / 2 } : s0.kind === 'ellipse' ? s0.center : s0.kind === 'cone' ? { x: s0.center.x + Math.cos(s0.angle) * s0.radius * .6, y: s0.center.y + Math.sin(s0.angle) * s0.radius * .6 }
      : s0.kind === 'arc' ? { x: s0.center.x + Math.cos(s0.angle) * (s0.inner + s0.outer) / 2, y: s0.center.y + Math.sin(s0.angle) * (s0.inner + s0.outer) / 2 } : target
    const expect = hits.filter(h => h.shapes.some(s => overlaps(s, point(probe)))).length
    let hurt = 0, n = 0
    g.environment.active = false; g.environment.age = -1e9
    while (g.state !== 'recover' && n++ < 2000) { step(g, e, probe); g.environment.age = -1e9; commitGumiho(g, e, probe, d => { hurt += d }, false) }
    assert.ok(expect >= 1, `${move} 안쪽 점이 모양 안에 없다`)
    assert.equal(hurt, expect * F.moves[move].damage, `${move} 안 ${JSON.stringify(probe)} · 차례마다 한 번`)
  }
  for (const move of MOVES) {
    const { e, g } = actor(), target = targetFor(g, e, move)
    assert.ok(beginGumihoMove(g, e, target, move, 2))
    const all = g.attack!.hits.flatMap(h => h.shapes), safe = safeLanding(all, [], target, 1e4, 1)!
    g.environment.active = false; g.environment.age = -1e9
    let hurt = 0, n = 0
    while (g.state !== 'recover' && n++ < 2000) { step(g, e, safe); g.environment.age = -1e9; commitGumiho(g, e, safe, d => { hurt += d }, false) }
    assert.equal(hurt, 0, `${move} 밖 ${JSON.stringify(safe)}`)
  }
})

test('부채 팔이 부서지면 찌르기·곡풍이 봉인되고 예약된 수도 취소 · 도약 팔은 도약 베기 · 가운데 꼬리는 환영', () => {
  const seal: [GumihoMove, 'fan-arm' | 'claw-arm' | typeof CENTER_TAIL][] = [['thrust', 'fan-arm'], ['gale', 'fan-arm'], ['leap', 'claw-arm'], ['illusion', CENTER_TAIL]]
  for (const [move, part] of seal) {
    const { e, g } = actor(), target = targetFor(g, e, move)
    assert.ok(gumihoCandidates(g, e, target).includes(move), move)
    assert.ok(beginGumihoMove(g, e, target, move, 2))
    assert.equal(damageGumihoPart(g, part, 1e12), true, `${part} 처음 부서짐`)
    assert.equal(g.state, 'recover', `${move} 예약 취소`); assert.equal(g.attack, null)
    assert.equal(damageGumihoPart(g, part, 1), false, '두 번 부서지지 않는다')
    g.timer = 0; g.last = null
    assert.ok(gumihoSealed(g, move), `${move} 봉인`); assert.ok(!gumihoCandidates(g, e, target).includes(move), `${move} 후보에서 빠짐`)
  }
  // 부채 팔이 부서져도 꼬리 수·도약은 남는다
  { const { e, g } = actor(); g.partHP['fan-arm'] = 0; const c = gumihoCandidates(g, e, targetFor(g, e, 'ninetail')); assert.ok(c.includes('ninetail') && c.includes('sweep')) }
  // 막 1 에는 꼬리가 나오지 않았다 — 보이지도 맞지도 않는다
  { const { g } = actor(1); for (const id of GUMIHO_TAILS) { const p = g.pose.parts.find(q => q.id === id)!; assert.ok(!p.visible && !p.targetable, id) } }
})

test('꼬리마다 제 타격만 지운다: 순차쓸기의 그 차례 · 지연 찌르기의 그 선 (미리 보인 안전로는 그대로)', () => {
  const q = F.moves.sweep
  // 순차쓸기: 셋째 꼬리를 미리 끊으면 차례가 둘 · 세운 뒤 끊으면 그 차례는 붉은빛도 피해도 없다
  {
    const { e, g } = actor(2), target = targetFor(g, e, 'sweep'), tail = GUMIHO_TAILS[q.tails[2]]!
    g.partHP[tail] = 0
    assert.equal(planGumiho(g, e, target, 'sweep', 2)!.hits.length, 2)
  }
  {
    const { e, g } = actor(2), target = targetFor(g, e, 'sweep')
    assert.ok(beginGumihoMove(g, e, target, 'sweep', 2))
    assert.equal(g.attack!.hits.length, 3)
    const second = g.attack!.hits[1]!, owner = second.owners[0]!, cone = second.shapes[0]!
    assert.equal(damageGumihoPart(g, owner, 1e12), true)
    assert.notEqual(g.state, 'recover', '다른 꼬리 둘이 남아 수는 이어진다')
    assert.ok(cone.kind === 'cone')
    // 둘째 부채 한가운데(첫째·셋째 부채 밖)에 선 장수는 끊긴 꼬리 덕에 맞지 않는다 · 차례는 0 → 2
    const inside = { x: cone.center.x + Math.cos(cone.angle) * cone.radius * .6, y: cone.center.y + Math.sin(cone.angle) * cone.radius * .6 }
    assert.ok(!g.attack!.hits[0]!.shapes.some(s => overlaps(s, point(inside))) && !g.attack!.hits[2]!.shapes.some(s => overlaps(s, point(inside))))
    let hurt = 0, n = 0
    const steps = new Set<number>()
    while (g.state !== 'recover' && n++ < 2000) { step(g, e, inside); g.environment.age = -1e9; if (g.attack && (g.state === 'tell' || g.state === 'strike')) { steps.add(g.attack.step); assert.ok(!g.attack.shapes.some(s => overlaps(s, point(inside))), '끊긴 꼬리의 부채가 붉게 보인다') } commitGumiho(g, e, inside, d => { hurt += d }, false) }
    assert.equal(hurt, 0); assert.deepEqual([...steps], [0, 2])
  }
  // 지연 찌르기: 끊긴 꼬리의 선은 처음부터 없다 · 세운 뒤 끊으면 그 선만 사라진다
  {
    const { e, g } = actor(3), target = targetFor(g, e, 'ninetail')
    g.partHP.tail1 = 0; g.partHP.tail9 = 0
    assert.ok(beginGumihoMove(g, e, target, 'ninetail', 2, C.speed, () => .2))
    assert.equal(g.attack!.hits[0]!.shapes.length, 7)
    const before = g.attack!.shapes.length, cut = g.attack!.hits[0]!.owners[3]!
    assert.equal(damageGumihoPart(g, cut, 1e12), true)
    assert.equal(g.attack!.shapes.length, before - 1, '그 꼬리의 선 하나만 사라진다')
    for (const id of GUMIHO_TAILS) g.partHP[id] = 0
    assert.ok(gumihoSealed(g, 'ninetail') && gumihoSealed(g, 'sweep'), '꼬리가 다 끊기면 꼬리 수 둘이 봉인')
  }
})

test('도약 베기·아홉 꼬리 지연 찌르기의 버팀은 seeded — 같은 씨앗 같은 박자 · 씨앗마다 달라진다 · 다른 수는 두 번째부터 +0.3초 변형', () => {
  for (const move of ['leap', 'ninetail'] as const) {
    const totals: number[] = []
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const run = () => { const { e, g } = actor(), rng = makeRng(seed), target = targetFor(g, e, move); assert.ok(beginGumihoMove(g, e, target, move, 2, C.speed, () => rng.next())); return g.attack!.windup }
      const a = run(), b = run()
      assert.deepEqual(a, b, `${move} seed ${seed}`); totals.push(a.total)
      const m = F.moves[move]
      assert.ok(a.hold >= 0 && a.hold <= m.holdMax + 1e-9 && a.total <= G.windup.max + 1e-9, `${move} ${JSON.stringify(a)}`)
      // 버팀은 몸 예고 뒤 붉은 예고 앞 (hold 동안 바닥이 없다)
      const { e, g } = actor(), rng = makeRng(seed), target = targetFor(g, e, move); beginGumihoMove(g, e, target, move, 2, C.speed, () => rng.next())
      let holdTicks = 0, n = 0
      while (g.state !== 'strike' && n++ < 1000) { if (g.state === 'hold') { holdTicks++; assert.equal(g.pose.worldGeometry.tell.length, 0) } step(g, e, target) }
      assert.ok(Math.abs(holdTicks * DT - g.attack!.windup.hold) <= DT * 2, `${move} hold ${holdTicks * DT} vs ${g.attack!.windup.hold}`)
    }
    assert.ok(new Set(totals.map(t => t.toFixed(3))).size >= 5, `${move} 버팀이 늘 같다: ${totals}`)
  }
  // 곡풍: 첫 쓰임은 표 시간 · 두 번째부터 seeded 로 표 시간 또는 +repeatHold
  const seen = new Set<number>()
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const { e, g } = actor(), rng = makeRng(seed), target = targetFor(g, e, 'gale')
    assert.ok(beginGumihoMove(g, e, target, 'gale', 2, C.speed, () => rng.next())); assert.equal(g.attack!.windup.hold, 0)
    g.state = 'recover'; g.timer = 0; g.attack = null; g.last = null
    assert.ok(beginGumihoMove(g, e, target, 'gale', 3, C.speed, () => rng.next())); seen.add(Math.round(g.attack!.windup.hold * 1000))
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [0, G.windup.repeatHold * 1000])
})

test('환영 후 되받기: 진짜 자리는 seeded 셋 중 하나 · 환영은 맞지도 때리지도 않고 진짜의 붉은 바닥에 걸치지 않는다', () => {
  const reals = new Set<number>()
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const { e, g } = actor(1), rng = makeRng(seed), target = targetFor(g, e, 'illusion')
    assert.ok(beginGumihoMove(g, e, target, 'illusion', 2, C.speed, () => rng.next()))
    const a = g.attack!, spots = a.spots!, real = a.real!
    reals.add(real); assert.equal(spots.length, 3)
    // 붉은 바닥은 진짜 자리 앞 하나뿐
    assert.equal(a.hits.length, 1); assert.equal(a.hits[0]!.shapes.length, 1)
    const tell = a.hits[0]!.shapes[0]!
    assert.ok(tell.kind === 'cone' && Math.hypot(tell.center.x - spots[real]!.x, tell.center.y - spots[real]!.y) < 1e-6)
    while (g.state === 'body' || g.state === 'hold') step(g, e, target)
    // 몸 예고 blinkAt 뒤엔 진짜가 진짜 자리에 서 있다 (판정 부위도 그 자리)
    assert.ok(Math.hypot(e.x - spots[real]!.x, e.y - spots[real]!.y) < 1e-6)
    for (let i = 0; i < 3; i++) if (i !== real) {
      // 환영 자리에는 맞을 몸이 없다 — 화살이 환영을 지나간다
      const at: Shape = { kind: 'circle', center: { x: spots[i]!.x, y: spots[i]!.y - 200 }, radius: 30 }
      assert.equal(gumihoContact(g, at), null, '환영은 판정 부위가 없다')
    }
    // 환영 쪽 장수는 맞지 않는다 (환영의 되받기는 그림뿐)
    const decoy = spots[(real + 1) % 3]!, near = { x: decoy.x + (target.x > decoy.x ? 1 : -1) * 90, y: decoy.y + 60 }
    let hurt = 0, n = 0
    if (!overlaps(tell, point(near))) { while (g.state !== 'recover' && n++ < 2000) { step(g, e, near); g.environment.age = -1e9; commitGumiho(g, e, near, d => { hurt += d }, false) } assert.equal(hurt, 0) }
  }
  assert.ok(reals.size >= 2, `진짜 자리가 늘 같다: ${[...reals]}`)
  // 환영 몸 ↔ 진짜 붉은 바닥 (계획 그대로 · 막 1~3 · 여러 자리 · 몸 예고와 타격 자세 모두)
  let planned = 0
  for (const phase of [1, 2, 3] as const) for (let i = 0; i < 12; i++) {
    const { e, g } = actor(phase), target = { x: 120 + i * 80, y: F.homeY + 60 + (i % 3) * 50 }
    const plan = planGumiho(g, e, target, 'illusion', 2); if (!plan) continue
    planned++
    plan.variants!.forEach((v, j) => {
      const tell = v[0]!.shapes[0]!
      plan.spots!.forEach((_, k) => {
        if (k === j) return
        for (const f of [plan.prepares![k]!, plan.impacts![k]!]) {
          const pose = makeGumihoPose({ ...f, fox: phase > 1 ? 1 : 0, tails: phase > 1 ? GUMIHO_TAILS.length : 0 }, { ownerId: 9, tick: 1, alive: true, targetable: true, recovering: false, partHP: g.partHP })
          for (const p of pose.parts) if (p.visible && !p.id.startsWith('tail')) assert.ok(!overlaps(tell, p.collider), `막${phase} 환영 ${k} ${p.id} 가 진짜 ${j} 의 붉은 바닥에`)
        }
      })
    })
  }
  assert.ok(planned >= 20, `세운 환영 ${planned}`)
})

test('막마다 가운데 세로 3P 길이 판 끝까지 늘 비고 · 고른 수는 언제나 닿을 수 있는 3P 빈 원이 있다 (지연 찌르기는 빈 통로)', () => {
  const lane: Shape = { kind: 'box', center: { x: W / 2, y: H / 2 }, halfX: G.playerDiameter * G.safeDiameters / 2, halfY: H / 2, angle: 0 }
  for (const phase of [1, 2, 3] as const) {
    // 막은 회복이 끝날 때 하나씩 넘어가며 포효한다 (둘을 건너뛰지 않는다) · 막 2 는 변신
    const { e, g } = actor(1), roars: number[] = []
    e.hp = e.max * (phase === 1 ? 1 : phase === 2 ? .6 : .2)
    for (let n = 0; n < 4000 && g.environment.phase < phase; n++) { if (g.state !== 'roar') { g.state = 'recover'; g.timer = 0; g.attack = null } if (step(g, e, { x: W / 2, y: H - 80 }) === 'roar') roars.push(g.phase) }
    assert.equal(g.environment.phase, phase); assert.deepEqual(roars, phase === 1 ? [] : phase === 2 ? [2] : [2, 3])
    assert.ok(g.environment.shapes.every(s => !overlaps(s, lane)), `막 ${phase} 가운데 길`)
  }
  // 여러 자리에서 수를 고르게 해 본다: 세운 수는 모두 3P 빈 원을 실제 이동 속도로 닿을 수 있다 (막마다 그 막의 환경과 함께)
  const envFor = (phase: 1 | 2 | 3) => { const t = actor(1); t.e.hp = t.e.max * (phase === 1 ? 1 : phase === 2 ? .6 : .2); for (let n = 0; n < 4000 && t.g.environment.phase < phase; n++) { if (t.g.state !== 'roar') { t.g.state = 'recover'; t.g.timer = 0; t.g.attack = null } step(t.g, t.e, { x: W / 2, y: H - 80 }) } return t.g.environment }
  let begun = 0, lanes = 0
  const moves = new Set<string>()
  for (const phase of [1, 2, 3] as const) {
    const env = envFor(phase)
    for (let i = 0; i < 30; i++) {
      const { e, g } = actor(phase), rng = makeRng(300 + i + phase * 50), player = { x: 60 + (i * 97) % (W - 120), y: 120 + (i * 61) % (H - 160) }
      g.environment = { ...env }; g.last = null
      step(g, e, player, () => rng.next())
      if (!g.attack) continue
      begun++; moves.add(g.attack.move)
      const a = g.attack, shapes = a.hits.flatMap(h => h.shapes), seconds = a.move === 'leap' || a.move === 'illusion' ? a.windup.red : a.windup.body + a.windup.red
      assert.ok(safeLanding(shapes, g.environment.shapes, player, C.speed, seconds), `${a.move} @${JSON.stringify(player)} 막${phase}`)
      if (a.move === 'ninetail') {
        // 지정 3P 통로: 장수 쪽에서 lane 칸 떨어진 한쪽 자리에는 선이 없고 · 그 통로 가운데의 3P 원은 어느 선에도 닿지 않는다
        const q = F.moves.ninetail, slots = a.slots!, missing = [q.lane, -q.lane].filter(k => !slots.includes(k))
        assert.equal(missing.length, 1)
        const line = a.hits[0]!.shapes[0]!, o = line.kind === 'line' ? { x: line.from.x - Math.cos(Math.atan2(line.to.y - line.from.y, line.to.x - line.from.x)) * q.from, y: line.from.y - Math.sin(Math.atan2(line.to.y - line.from.y, line.to.x - line.from.x)) * q.from } : null
        assert.ok(o)
        const ang = a.aim + missing[0]! * Math.PI * 2 / q.slots, d = q.from + q.length * .7
        const disk: Shape = { kind: 'circle', center: { x: o.x + Math.cos(ang) * d, y: o.y + Math.sin(ang) * d }, radius: G.playerDiameter * G.safeDiameters / 2 }
        assert.ok(a.hits[0]!.shapes.every(s => !overlaps(s, disk)), '빈 통로에 선이 닿는다'); lanes++
      }
    }
  }
  assert.ok(begun >= 45, `세운 수 ${begun}`); assert.ok(moves.size >= 5, [...moves].join()); assert.ok(lanes >= 1, '지연 찌르기를 한 번은 세웠다')
})

test('막 2 변신: 웃으며 반여우가 되고 꼬리 아홉이 하나씩 나온다 · 다 나오기 전 꼬리는 맞지 않는다 · 포효 뒤 땅울림', () => {
  const { e, g } = actor(1), cues: string[] = [], shown: number[] = []
  e.hp = e.max * .69
  for (let n = 0; n < 1200 && (g.phase === 1 || g.state === 'roar'); n++) {
    const cue = step(g, e, { x: W / 2, y: H - 60 }); if (cue) cues.push(cue)
    if (g.state === 'roar') shown.push(g.pose.parts.filter(p => p.id.startsWith('tail') && p.visible).length)
    if (g.state === 'roar') for (const p of g.pose.parts) if (p.id.startsWith('tail') && p.visible) assert.ok(p.targetable)
  }
  assert.equal(g.phase, 2); assert.deepEqual(cues.slice(0, 2), ['roar', 'quake'])
  assert.equal(shown[0], 0); assert.equal(shown[shown.length - 1], GUMIHO_TAILS.length)
  // 하나씩 (한 번에 둘 이상 늘지 않는다)
  for (let i = 1; i < shown.length; i++) assert.ok(shown[i]! - shown[i - 1]! <= 1 && shown[i]! >= shown[i - 1]!)
  assert.equal(g.pose.frame.fox, 1)
})

test('회복 중 첫 타격은 움찔하고 회복이 한 번만 늘어난다 · 머리는 회복 중 2배', () => {
  const { e, g } = actor(), target = targetFor(g, e, 'thrust')
  assert.ok(beginGumihoMove(g, e, target, 'thrust', 2))
  while (g.state !== 'recover') step(g, e, target)
  const before = g.timer
  staggerGumiho(g); assert.ok(g.timer > before && g.stagger > 0)
  assert.ok(g.timer - before <= F.staggerRecover + 1e-9)
  const head = g.pose.parts.find(p => p.id === 'head')!, c = head.collider.kind === 'ellipse' ? head.collider.center : head.start
  const hit = gumihoContact(g, { kind: 'circle', center: c, radius: 1 })!
  assert.equal(hit.partId, 'head'); assert.equal(hit.weakScale, G.recoveryHeadDamage)
  assert.equal(breakGumihoPart(g, 'root'), false, '옷자락은 부서지지 않는다')
})

test('엔진 박자: 30/60/120 그림 빈도가 같은 고정 틱이면 같은 구미호 · 같은 난수', () => {
  const run = (fps: number) => {
    const { e, g } = actor(1), rng = makeRng(5519), damage: number[] = []; let lag = 0, tick = 0
    for (let frame = 0; frame < fps * 16; frame++) {
      lag += 1 / fps
      while (lag + 1e-12 >= DT) { tick++; if (tick === 120 * 8) e.hp = e.max * .5; const player = { x: W / 2 + Math.cos(tick / 160) * 260, y: F.homeY + 110 + Math.sin(tick / 90) * 60 }; stepGumiho(g, e, { dt: DT, tick, player, speed: C.speed, dazed: false, random: () => rng.next() }); commitGumiho(g, e, player, n => damage.push(n), false); lag -= DT }
      JSON.stringify(g.pose)
    }
    return hash({ e, g, damage, seed: rng.state(), tick })
  }
  assert.equal(run(30), run(60)); assert.equal(run(60), run(120))
})

test('55-GUMIHO 판 기록은 거대 보스 싸움까지 그대로 다시 돈다 (짧게 줄인 숲 · 보통 입력)', () => {
  // 숲 판 길이 몫과 구미호 체력만 줄여 거대 보스 싸움(변신 · 부위 파괴)까지 빨리 닿게 한다 — 기록과 재생이 같은 값을 쓴다
  const length = ST.forest.length, hp = F.hp
  Object.assign(ST.forest, { length: .12 }); Object.assign(F, { hp: 60000 })
  try {
    const opts = { stage: 'forest' as const, simRules: '55-GUMIHO' as const, bonus: { might: 10, vigor: 10, armor: 5, regen: 5, haste: 5, swift: 5 } }
    const s = createHaebi(41, 'stage', 'sword', opts)
    const r = startRecord(s, { id: 'g55', started: 'x', mode: 'stage', stage: 'forest', hero: 'haebi', kit: 'sword', sprite: 'haebi', seed: 41, opts, from: null })
    let seen = false, phase = 1, broken = 0
    const moves = new Set<string>()
    while (s.state === 'playing' && s.t < 400) {
      if (s.offers.length) { const p = botChoice(s, 'storm'); choose(s, p); recPick(r, p); continue }
      stepHaebi(s, recInput(r, { ...botInput(s, .5), skill: Math.floor(s.t * 2) % 7 === 0 }), STEP)
      const g = s.enemies.find(e => e.giant?.kind === 'gumiho')?.giant
      if (g?.kind === 'gumiho') { seen = true; phase = Math.max(phase, g.phase); broken = Math.max(broken, g.brokenSeen.length); if (g.attack) moves.add(g.attack.move) }
    }
    assert.ok(seen, '거대 보스까지 갔다'); assert.ok(phase >= 2 || s.giantFlow!.finalDefeated, `막 ${phase}`); assert.ok(moves.size >= 2, [...moves].join())
    const game = finishRecord(r, 0, 'x')
    assert.equal(game.rules, '55-GUMIHO')
    assert.equal(JSON.stringify(replayRaid(JSON.parse(JSON.stringify(game)))), JSON.stringify(s))
  } finally { Object.assign(ST.forest, { length }); Object.assign(F, { hp }) }
})

test('실제 무기 넷이 구미호의 부위 하나와 본체를 함께 깎는다 · 부위가 처음 부서지면 큰 반응(포효) 하나', () => {
  for (const kit of ['axe', 'bow', 'spear', 'sword'] as Kit[]) {
    const s = createHaebi(257, 'stage', kit, { stage: 'forest', simRules: '55-GUMIHO' })
    s.spawn = s.nextElite = s.nextBarrage = 1e9
    for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) s.cool[k] = 1e9
    const e = spawnGiant(s)!, g = e.giant as GumihoState
    g.state = 'recover'; g.timer = 9; g.age = F.entrySeconds; updateGumihoPose(g, e, 0)
    s.x = e.x + 150; s.y = e.y + 20
    s.cool[({ axe: 'axe', bow: 'bow', spear: 'spear', sword: 'sword' } as const)[kit as 'axe']] = 0
    const before = e.hp, parts = { ...g.partHP }
    for (let i = 0; i < 90 && e.hp === before; i++) stepHaebi(s, { x: 0, y: 0 }, DT)
    assert.ok(e.hp < before, `${kit} 못 맞힘`)
    assert.ok(Object.keys(parts).filter(k => g.partHP[k as keyof typeof parts] !== parts[k as keyof typeof parts]).length <= 1, `${kit} 부위 여럿`)
  }
  const s = createHaebi(257, 'stage', 'sword', { stage: 'forest', simRules: '55-GUMIHO' }); s.spawn = s.nextElite = s.nextBarrage = 1e9
  const e = spawnGiant(s)!, g = e.giant as GumihoState
  g.phase = 2; g.state = 'recover'; g.timer = 9; g.age = F.entrySeconds; g.partHP.tail3 = 1; updateGumihoPose(g, e, 0)
  const t = g.pose.parts.find(p => p.id === 'tail3')!
  assert.ok(t.visible && t.targetable)
  // 셋째 꼬리 뼈 위의 점 (머리·팔에 닿지 않는 곳) — 겹친 꼬리 여럿 안이면 뼈가 가장 가까운 꼬리가 맞는다
  const front = g.pose.parts.filter(p => p.visible && (p.id === 'head' || p.id.endsWith('-arm'))), along = (k: number) => ({ x: t.start.x + (t.end.x - t.start.x) * k, y: t.start.y + (t.end.y - t.start.y) * k })
  const k = [.9, .8, .7, .6, .5].find(k => front.every(p => !overlaps(p.collider, { kind: 'circle', center: along(k), radius: 5 })))
  assert.ok(k !== undefined, '셋째 꼬리가 머리·팔에 다 가린다'); const mid = along(k)
  s.shots.push({ x: mid.x, y: mid.y, vx: 0, vy: 0, life: 0, kind: 'rain', damage: 50, radius: 4, hit: [], angle: 0, tx: 0, ty: 0 })
  const fx = s.fx.length; stepHaebi(s, { x: 0, y: 0 }, DT)
  assert.deepEqual(g.brokenSeen, ['tail3']); assert.equal(g.brokenAt.tail3, g.age)
  assert.equal(s.fx.slice(fx).filter(f => f.championCue === 'roar').length, 1, '부서진 순간 포효 하나')
  assert.ok(!g.pose.parts.find(p => p.id === 'tail3')!.visible, '끊긴 꼬리는 더 보이지 않는다')
})
