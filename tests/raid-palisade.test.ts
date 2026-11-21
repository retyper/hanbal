// 56-C 목책을 진짜로 (11-21 형: 「3스테이지 목책이 오브젝트도 아니라서 다 그림 밟고 온다」) — 목책 돌파 판(규칙 56C)의 마디·문·막힘·부수기
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_RUN as C, HAEBI_PALISADE as W } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, spawnMob, raidRulesForStage, usesPalisade, normalizedRaidOpts, type HaebiRun, type Mob } from '../src/raid/haebi.ts'
import { lastGateBroken, sweepWall, wallMove, wallAim, damagePiece, type Palisade } from '../src/raid/palisade.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, finishRecord, replayRaid, STEP } from '../src/raid/runlog.ts'

const opts = { stage: 'palisade' as const, simRules: '56C' as const }
/** 적이 저절로 안 나오고 장수 공격도 멈춘 조용한 목책 판 */
function quiet(kit: HaebiRun['kit'] = 'axe') {
  const s = createHaebi(56, 'stage', kit, opts)
  s.spawn = s.nextElite = s.nextBarrage = 1e9
  for (const k of Object.keys(s.cool) as (keyof typeof s.cool)[]) s.cool[k] = 1e9
  return s
}
const run = (s: HaebiRun, seconds: number, input = { x: 0, y: 0 }) => { for (let t = 0; t < seconds; t += 1 / 60) stepHaebi(s, input, 1 / 60) }
const wall = (s: HaebiRun) => s.palisade!
const pieceAt = (P: Palisade, x: number) => P.pieces.find(p => x >= p.x0 && x < p.x1)!
/** 성한 마디의 띠(+반지름) 안인가 */
const insideIntact = (P: Palisade, x: number, y: number, r: number) => Math.abs(y - P.y) < W.depth + r - 1e-9 && P.pieces.some(p => p.hp > 0 && p.x0 < x + r - 1e-9 && p.x1 > x - r + 1e-9)
function mob(s: HaebiRun, kind: Mob['kind'], x: number, y: number) {
  spawnMob(s, kind, undefined, true); const e = s.enemies[s.enemies.length - 1]!
  e.x = x; e.y = y; e.cd = 0; return e
}

test('56C 목책은 목책 돌파 판에만 선다 · 다른 판은 56B 그대로(같은 상태)', () => {
  // 실제 출전은 57-BULGASARI(이 목책 + 불가사리) · 옛 56C 기록·검사는 목책만 그대로 다시 돈다
  assert.equal(raidRulesForStage('palisade'), '57-BULGASARI')
  for (const stage of ['forest', 'ford', 'snow', 'fortress'] as const) {
    const a = createHaebi(7, 'stage', 'sword', { stage, simRules: '56C' }), b = createHaebi(7, 'stage', 'sword', { stage, simRules: '56B' })
    assert.equal(usesPalisade(a), false, stage)
    run(a, 20); run(b, 20)
    assert.deepEqual(a, b, `${stage}: 56C 를 넣어도 30초 판이 56B 와 같다`)
  }
  assert.equal(usesPalisade(createHaebi(7, 'stage', 'axe', { stage: 'palisade', simRules: '56B' })), false, '옛 56B 목책 기록은 목책 없이 다시 돈다')
  assert.equal(usesPalisade(createHaebi(7, 'trial', 'axe', { simRules: '56C' })), false)
  const s = createHaebi(7, 'stage', 'axe', opts)
  assert.equal(usesPalisade(s), true); assert.equal(normalizedRaidOpts(s, opts).simRules, '56C')
})

test('마디는 판 폭을 빈틈없이 덮고 문은 셋(열린 문 둘 · 가운데 큰 문)', () => {
  const P = wall(createHaebi(7, 'stage', 'axe', opts))
  assert.equal(P.pieces[0]!.x0, 0); assert.equal(P.pieces[P.pieces.length - 1]!.x1, C.width)
  for (let i = 1; i < P.pieces.length; i++) assert.equal(P.pieces[i]!.x0, P.pieces[i - 1]!.x1)
  assert.deepEqual(P.pieces.filter(p => p.kind !== 'w').map(p => p.kind), ['o', 'g', 'o'])
  const g = P.pieces.find(p => p.kind === 'g')!
  assert.ok(g.x0 < C.width / 2 && g.x1 > C.width / 2, '큰 문은 가운데')
  assert.equal(P.y, W.y); assert.ok(P.y + W.depth + W.heroR < C.height / 2, '장수는 목책 앞(아래)에서 시작')
})

test('장수는 성한 마디에 막혀 미끄러지고 · 열린 문으로는 지나간다 · 한 걸음이 커도 뚫지 못한다', () => {
  const s = quiet(), P = wall(s), w = pieceAt(P, 100)
  s.x = 100; s.y = P.y + 60
  run(s, 2, { x: 0, y: -1 })
  assert.equal(s.y, P.y + W.depth + W.heroR, '띠 가장자리에 선다'); assert.equal(s.x, 100)
  assert.ok(w.hp < w.max, '밀고 있으니 내려쳤다')
  const o = P.pieces.find(p => p.kind === 'o')!
  s.x = (o.x0 + o.x1) / 2; s.y = P.y + 60
  run(s, 1.5, { x: 0, y: -1 })
  assert.ok(s.y < P.y - W.depth - W.heroR, `열린 문을 지나 목책 뒤로 (${s.y})`)
  // 회피보다 훨씬 큰 한 걸음도 마디를 뚫지 못한다 (지나간 길로 잰다)
  const at = { x: 100, y: P.y - 300 }
  assert.ok(wallMove(P, at, 100, P.y + 300, W.heroR)); assert.equal(at.y, P.y + W.depth + W.heroR)
  assert.equal(sweepWall(P, (o.x0 + o.x1) / 2, P.y + 300, (o.x0 + o.x1) / 2, P.y - 300, W.heroR), null)
})

test('밀어서 부수면 지름길 — 부서진 마디는 지나가고 부서진 때를 적는다', () => {
  const s = quiet(), P = wall(s), w = pieceAt(P, 100)
  s.x = (w.x0 + w.x1) / 2; s.y = P.y + 60
  let t = 0
  while (w.hp > 0 && t < 30) { stepHaebi(s, { x: 0, y: -1 }, 1 / 60); t += 1 / 60 }
  assert.equal(w.hp, 0, `${t}초 안에 부서짐`); assert.ok(t <= 8, `레벨 1 장수도 몇 초면 (${t.toFixed(2)}초)`)
  assert.ok(w.brokenAt !== undefined && s.fx.some(f => f.kind === 'thud'), '부서진 때 · 흙먼지')
  run(s, 1.5, { x: 0, y: -1 })
  assert.ok(s.y < P.y - W.depth - W.heroR, '부서진 자리로 지나간다')
  assert.equal(lastGateBroken(P), false, '말뚝 마디는 마지막 문이 아니다')
})

test('비켜 걸으면 내려치지 않는다 (목책을 따라 미끄러질 때)', () => {
  const s = quiet(), P = wall(s), w = pieceAt(P, 100)
  s.x = 60; s.y = P.y + W.depth + W.heroR
  run(s, 1, { x: 1, y: -.3 })
  assert.equal(P.pieces.filter(p => p.hp < p.max).length, 0, '옆으로 걷기만 했다'); void w
})

test('목책 뒤의 적은 가장 가까운 문으로 돌아 들어와 장수에게 닿는다 (마디 속에 들어가지 않는다)', () => {
  const s = quiet(), P = wall(s)
  s.x = 100; s.y = P.y + 160
  const e = mob(s, 'club', 90, P.y - 120)
  let crossedAt: number | null = null, inside = 0
  for (let i = 0; i < 60 * 25 && s.hp === s.maxHp; i++) {
    const was = e.y
    stepHaebi(s, { x: 0, y: 0 }, 1 / 60)
    if (insideIntact(P, e.x, e.y, W.mobR)) inside++
    if (was < P.y && e.y >= P.y && crossedAt === null) crossedAt = e.x
  }
  assert.equal(inside, 0)
  assert.ok(crossedAt !== null, '줄을 넘었다')
  const gate = P.pieces.find(p => crossedAt! >= p.x0 && crossedAt! < p.x1)!
  assert.equal(gate.kind, 'o', `가까운 열린 문으로 넘었다 (${crossedAt})`)
  assert.ok(s.hp < s.maxHp, '문을 돌아 와서 장수를 쳤다')
})

test('문까지 곧장 · 문 앞에서 줄을 건너 · 곧게 갈 수 있으면 돌지 않는다', () => {
  const P = wall(createHaebi(7, 'stage', 'axe', opts)), out = { x: 0, y: 0 }
  assert.equal(wallAim(P, 300, P.y + 100, 500, P.y + 200, W.mobR, out), false, '같은 쪽이면 곧게')
  assert.equal(wallAim(P, 100, P.y - 100, 100, P.y + 200, W.mobR, out), true)
  const o = P.pieces.find(p => p.kind === 'o')!
  assert.ok(out.x > o.x0 && out.x < o.x1 && out.y < P.y, `먼저 이쪽 문 앞으로 (${out.x}, ${out.y})`)
  assert.equal(wallAim(P, (o.x0 + o.x1) / 2, P.y - 40, 40, P.y + 60, W.mobR, out), true)
  assert.ok(out.y > P.y && out.x === (o.x0 + o.x1) / 2, '문 앞이면 곧게 줄 너머로')
})

test('창돌격꾼 돌진은 마디에 박혀 깎고 멈춘다 · 두목은 밀어 부수며 오고 · 정예는 문으로 돈다', () => {
  const s = quiet(), P = wall(s), w = pieceAt(P, 100)
  s.x = 100; s.y = P.y + 120
  const r = mob(s, 'runner', 100, P.y - 60)
  r.act = -.5; r.vx = 0; r.vy = 1
  run(s, .3)
  assert.equal(w.max - w.hp, W.chargeBreak, '한 번 박혀 그만큼 깎였다'); assert.equal(r.act, 0); assert.ok(r.y < P.y, '목책 뒤에 멈췄다')
  // 두목: 장수가 멀리(공격 거리 밖) 있으면 곧장 밀고 와 마디를 부순다
  const q = quiet(), Q = wall(q), v = pieceAt(Q, 700)
  q.x = 700; q.y = Q.y + 400
  const b = mob(q, 'boss', 700, Q.y - 60); b.champion!.mode = 'chase'; b.cd = 1e9
  let t = 0
  for (; t < 20 && v.hp > 0; t += 1 / 60) stepHaebi(q, { x: 0, y: 0 }, 1 / 60)
  assert.equal(v.hp, 0, `두목이 밀어 부쉈다 (${t.toFixed(1)}초)`)
  for (let i = 0; i < 120; i++) stepHaebi(q, { x: 0, y: 0 }, 1 / 60)
  assert.ok(b.y > Q.y, '부순 자리로 넘어왔다')
  // 정예: 막히면 문 쪽으로 걷는다 (마디를 밀지 않는다)
  const u = quiet(), U = wall(u)
  u.x = 100; u.y = U.y + 400
  const e = mob(u, 'elite', 100, U.y - 60); e.champion!.mode = 'chase'; e.cd = 1e9
  for (let i = 0; i < 60 * 4; i++) stepHaebi(u, { x: 0, y: 0 }, 1 / 60)
  assert.ok(e.x > 100 + 40, `정예가 문 쪽(오른쪽)으로 돌았다 (${e.x.toFixed(0)})`)
  assert.equal(U.pieces.filter(p => p.hp < p.max).length, 0, '정예는 마디를 밀어 깎지 않았다')
})

test('장수의 근접 공격·비기가 닿은 마디는 깎인다 · 화살은 넘어간다', () => {
  const s = quiet('sword'), P = wall(s), w = pieceAt(P, 700)
  s.x = 700; s.y = P.y + 40; s.level = 10
  const e = mob(s, 'iron', 700, P.y - 30); e.hp = e.max = 1e6
  s.cool.sword = 0; stepHaebi(s, { x: 0, y: 0 }, 1 / 60)
  assert.equal(w.max - w.hp, W.hit.melee, '칼질이 목책에도 닿았다'); assert.ok(e.hp < e.max, '목책 너머 적도 맞았다')
  const b = quiet('bow'), B = wall(b), v = pieceAt(B, 700)
  b.x = 700; b.y = B.y + 80
  const f = mob(b, 'iron', 700, B.y - 60); f.hp = f.max = 1e6
  b.cool.bow = 0; run(b, .5)
  assert.ok(f.hp < f.max, '화살은 목책을 넘어 맞혔다'); assert.equal(v.hp, v.max, '화살은 목책을 깎지 않는다')
})

test('가운데 큰 문이 마지막 문 — 부서지면 gateBrokenAt 을 적는다', () => {
  const s = quiet(), P = wall(s), g = P.pieces.find(p => p.kind === 'g')!
  assert.equal(lastGateBroken(P), false)
  assert.equal(damagePiece(P, g, g.max - 1, 3), false); assert.equal(P.gateBrokenAt, undefined)
  assert.equal(damagePiece(P, g, 5, 4), true)
  assert.equal(lastGateBroken(P), true); assert.equal(P.gateBrokenAt, 4); assert.equal(g.brokenAt, 4)
})

test('56C 판 기록은 목책까지 그대로 다시 돈다 · 봇 판에서 적이 마디 속에 서지 않는다', () => {
  const s = createHaebi(31, 'stage', 'spear', opts)
  const r = startRecord(s, { id: 'p56c', started: 'x', mode: 'stage', stage: 'palisade', hero: 'haebi', kit: 'spear', sprite: 'haebi', seed: 31, opts, from: null })
  let inside = 0
  while (s.t < 150 && s.state === 'playing') {
    if (s.offers.length) { const p = botChoice(s, 'storm'); choose(s, p); recPick(r, p); continue }
    stepHaebi(s, recInput(r, botInput(s, .5)), STEP)
    for (const e of s.enemies) if (insideIntact(s.palisade!, e.x, e.y, e.kind === 'elite' || e.kind === 'boss' ? W.bigR : W.mobR)) inside++
    if (insideIntact(s.palisade!, s.x, s.y, W.heroR)) inside++
  }
  assert.equal(inside, 0)
  const g = finishRecord(r, 0, 'x')
  assert.equal(g.rules, '56C')
  assert.equal(JSON.stringify(replayRaid(JSON.parse(JSON.stringify(g)))), JSON.stringify(s))
})
