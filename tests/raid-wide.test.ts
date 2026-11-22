// 59-WIDE 넓은 맵 (11-22 형 「맵이 너무 좁다」 · docs/realm/RAID-REWARD-MAP-20261122.md 4장) — 새 규칙 스테이지 판만 넓어지고 옛 판은 그대로
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_RUN as C, HAEBI_WIDE as W, HAEBI_CHAMPION as CH } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, spawnMob, normalizedRaidOpts, usesWideMap, midbossTime, bossTime, barrageArcher, giantMob, KIT_RULES, MAP_RULES, type HaebiOpts, type HaebiRun, type Kit } from '../src/raid/haebi.ts'
import { BOARD, WORLD, fieldBounds, simView, ringSpot, huntSpot, stepGate, newWide } from '../src/raid/wide.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, sealInput, replayRaid } from '../src/raid/runlog.ts'
import { newCam, followCam, clampCenter, toField, fieldView, cameraBounds } from '../src/raid/camera.ts'
import { drawField } from '../src/raid/haebi-view.ts'
import { edgeArrows } from '../src/raid/wide-view.ts'
import { stageToolOpts } from '../tools/raid-stage-balance.ts'

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const WIDE: HaebiOpts = { stage: 'forest', simRules: '55-GUMIHO', permanentAwake: false, appearanceAwake: true, kitRules: KIT_RULES, mapRules: MAP_RULES }
/** 같은 판을 한 장짜리(옛 맵)로 */
const ONE: HaebiOpts = { stage: 'forest', simRules: '55-GUMIHO', permanentAwake: false, appearanceAwake: true, kitRules: KIT_RULES }
/** 적이 저절로 나오지 않고 장수가 쓰러지지 않는 조용한 넓은 판 */
function quiet(opts: HaebiOpts = WIDE, kit: Kit = 'axe') {
  const s = createHaebi(59, 'stage', kit, opts); s.spawn = 1e9; s.nextElite = s.nextBarrage = 1e9; s.maxHp = s.hp = 1e9; return s
}
const still = { x: 0, y: 0 }
const ONE_RUN = createHaebi(1, 'stage', 'axe', ONE)
const run = (s: HaebiRun, seconds: number, input = still) => { for (let i = 0; i < seconds * 60 && s.state === 'playing'; i++) { while (s.offers.length) choose(s, botChoice(s, 'spread')); stepHaebi(s, input, 1 / 60) } }
const inside = (r: { left: number; top: number; right: number; bottom: number }, x: number, y: number, pad = 0) => x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad
const view = (s: HaebiRun) => simView(s, { left: 0, top: 0, right: 0, bottom: 0 })

test('세계는 원래 판을 가운데 칸으로 둔 3×3 이고 원래 판의 좌표는 그대로다', () => {
  assert.deepEqual({ ...BOARD }, { left: 0, top: 0, right: C.width, bottom: C.height })
  assert.deepEqual({ ...WORLD }, { left: -1120, top: -720, right: 2240, bottom: 1440 })
  assert.equal(WORLD.right - WORLD.left, C.width * W.screens); assert.equal(WORLD.bottom - WORLD.top, C.height * W.screens)
})

test('새 규칙은 열전 스테이지 판에만 켜지고 판 기록 opts 에 남는다 (시련·선봉·옛 판은 한 장짜리)', () => {
  const s = createHaebi(7, 'stage', 'axe', WIDE)
  assert.equal(usesWideMap(s), true); assert.equal(s.x, C.width / 2); assert.equal(s.y, C.height / 2)
  assert.equal(normalizedRaidOpts(s, WIDE).mapRules, MAP_RULES)
  for (const mode of ['trial', 'vanguard'] as const) {
    const off = createHaebi(7, mode, 'axe', { mapRules: MAP_RULES, kitRules: KIT_RULES })
    assert.equal(usesWideMap(off), false, mode); assert.equal('wide' in off, false)
    assert.deepEqual(fieldBounds(off), BOARD)
  }
  const old = createHaebi(7, 'stage', 'axe', { stage: 'forest', simRules: '55-GUMIHO', kitRules: KIT_RULES })
  assert.equal(usesWideMap(old), false); assert.equal('wide' in old, false); assert.equal(normalizedRaidOpts(old, {}).mapRules, undefined)
  // 봇 도구: 기본은 옛 셈 · wide 를 켜야 넓은 맵
  assert.equal(stageToolOpts('snow', {}).mapRules, undefined); assert.equal(stageToolOpts('snow', {}, undefined, false, true, false, true).mapRules, MAP_RULES)
})

// 넓은 맵 작업 전(561210dd) 같은 입력으로 잰 판 상태 SHA — 규칙을 안 켠 판은 바이트까지 같다 (봇 걸음 포함)
// (한 장짜리 판의 셈이나 수치를 일부러 바꾼 작업이면 이 기준도 같이 새로 잰다 · raid-bulgasari 의 옛 판 SHA 와 같은 성격)
test('규칙을 안 켠 판은 넓은 맵 작업 전과 바이트까지 같다', () => {
  const cases: [HaebiRun['mode'], Kit, HaebiOpts, number, string][] = [
    ['stage', 'axe', { stage: 'forest', simRules: '55-GUMIHO', permanentAwake: false, appearanceAwake: true, kitRules: KIT_RULES }, 90, 'a7b4e26f2da48f57ee4474da99ad1e1094106e32a53bb5d6b606d841280a5321'],
    ['stage', 'bow', { stage: 'snow', simRules: '55-TIGER', permanentAwake: true, appearanceAwake: true, kitRules: KIT_RULES, bonus: { might: 5, vigor: 5, swift: 3, luck: 2 } }, 90, '6504964dcffb29f5d890b0784a06dd0108289b65cfb682a4124fe37b4f18a5b3'],
    ['trial', 'sword', { awaken: false, simRules: '53B', kitRules: KIT_RULES }, 60, '5ef7ea8951b62c4e61f9ddff3f26b81beee6922b222b6fa7577667fba811a3a0'],
    ['vanguard', 'magic', { simRules: '56B', kitRules: KIT_RULES }, 60, 'fef727d36de8ad7546a1da43abfc983747bfb2a615b7cbbd308717c4f55a723f'],
  ]
  for (const [mode, kit, opts, seconds, sha] of cases) {
    const s = createHaebi(59, mode, kit, opts)
    for (let i = 0; i < seconds * 120 && s.state === 'playing'; i++) { while (s.offers.length) choose(s, botChoice(s, 'spread')); stepHaebi(s, botInput(s, .5), 1 / 120) }
    assert.equal(hash(s), sha, `${mode}/${kit}`)
    // 시련·선봉에 새 규칙을 넘겨도 같은 판이다
    if (mode !== 'stage') {
      const t = createHaebi(59, mode, kit, { ...opts, mapRules: MAP_RULES })
      for (let i = 0; i < seconds * 120 && t.state === 'playing'; i++) { while (t.offers.length) choose(t, botChoice(t, 'spread')); stepHaebi(t, botInput(t, .5), 1 / 120) }
      assert.equal(hash(t), sha, `${mode}/${kit} + mapRules`)
    }
  }
})

test('넓은 판도 같은 입력·고름이면 기록에서 똑같이 다시 돈다', () => {
  for (const kit of ['bow', 'spear', 'sling'] as Kit[]) {
    const s = createHaebi(59, 'stage', kit, WIDE)
    const r = startRecord(s, { id: 'wide-' + kit, started: '2026-11-22T00:00:00Z', mode: 'stage', stage: 'forest', hero: 'ara', kit, sprite: 'ara', seed: 59, opts: WIDE, from: null })
    for (let i = 0; i < 60 * 120; i++) {
      while (s.offers.length) { const pick = botChoice(s, 'spread'); choose(s, pick); recPick(r, pick) }
      // 사람처럼 멀리 돌아다닌다 (봇 걸음에 큰 원을 얹는다)
      const b = botInput(s, .5), a = s.t * .2
      stepHaebi(s, recInput(r, i % 600 < 400 ? { ...b, x: Math.cos(a), y: Math.sin(a) } : b), 1 / 120)
    }
    const game = sealInput(r), copy = replayRaid(game)
    assert.equal(game.opts.mapRules, MAP_RULES); assert.ok(usesWideMap(copy))
    assert.equal(hash(copy), hash(s), kit)
  }
})

test('장수는 원래 판 밖으로 걸어 세계 끝에서 멈춘다 (옛 판은 판 끝)', () => {
  const s = quiet(), old = quiet(ONE)
  run(s, 20, { x: -1, y: -1 }); run(old, 20, { x: -1, y: -1 })
  assert.equal(s.x, WORLD.left + 32); assert.equal(s.y, WORLD.top + 65)
  assert.equal(old.x, 32); assert.equal(old.y, 65)
  run(s, 30, { x: 1, y: 1 })
  assert.equal(s.x, WORLD.right - 32); assert.equal(s.y, WORLD.bottom - 24)
})

test('잡졸은 장수 화면 바로 밖 둘레에서 나온다 — 세계 안 · 화면 밖', () => {
  for (const [hx, hy] of [[560, 360], [-700, -300], [1900, 1100], [WORLD.left + 40, 300], [600, WORLD.bottom - 30]] as const) {
    const s = quiet(); s.x = hx; s.y = hy
    const v = view(s)
    for (let i = 0; i < 300; i++) spawnMob(s, 'club', undefined, true)
    for (const e of s.enemies) {
      assert.ok(inside(WORLD, e.x, e.y), `세계 안 (${hx},${hy}) → ${e.x},${e.y}`)
      assert.ok(!inside(v, e.x, e.y, -1), `화면 밖 (${hx},${hy}) → ${e.x},${e.y}`)
      assert.ok(inside(v, e.x, e.y, W.spawnMargin + 1), '둘레 띠 안')
    }
    // 열린 변이 고루 쓰인다 (세계 끝에 눌린 변은 빼고 · 귀퉁이면 둘)
    const sides = new Set(s.enemies.map(e => e.x < v.left ? 'l' : e.x > v.right ? 'r' : e.y < v.top ? 't' : 'b'))
    assert.ok(sides.size >= (hx > 1500 && hy > 1000 ? 2 : 3), `변 ${[...sides].join('')}`)
  }
})

test('늑대 떼도 화면 밖에서 한 무리로 나온다', () => {
  const s = quiet(); s.x = 1500; s.y = -200
  spawnMob(s, 'dog'); const v = view(s)
  assert.ok(s.enemies.length > 1)
  for (const e of s.enemies) assert.ok(!inside(v, e.x, e.y, -1) && inside(WORLD, e.x, e.y, 60))
})

test('뒤처진 잡졸은 장수가 가는 쪽 둘레로 옮겨지고 정예는 걸어서 온다', () => {
  const s = quiet(); s.x = 1400; s.y = 300
  spawnMob(s, 'club', undefined, true); spawnMob(s, 'club', undefined, true); spawnMob(s, 'elite')
  const [far, near, elite] = s.enemies as [HaebiRun['enemies'][number], HaebiRun['enemies'][number], HaebiRun['enemies'][number]]
  far.x = s.x - C.width * W.strayScreens - 200; far.y = s.y; near.x = s.x - C.width * W.strayScreens + 200; near.y = s.y
  elite.x = s.x - C.width * W.strayScreens - 200; elite.y = s.y + 50
  const nx = near.x, ex = elite.x
  stepHaebi(s, still, 1 / 60)
  const v = view(s)
  assert.ok(far.x > v.right && far.x <= v.right + W.spawnMargin, `왼쪽에 뒤처진 적은 오른쪽 둘레로 (${far.x})`)
  assert.ok(Math.abs(near.x - nx) < 5, '한 장 반 안의 적은 그대로 걸어온다')
  assert.ok(Math.abs(elite.x - ex) < 5, '정예는 옮기지 않는다')
})

test('큰 놈 사냥: 정예는 화면 1.2~1.8장 밖에 나오고 「빨리 잡기」는 처음 화면에 들어온 때부터 센다', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const s = createHaebi(seed, 'stage', 'axe', WIDE); s.spawn = 1e9; s.nextBarrage = 1e9; s.maxHp = s.hp = 1e9
    spawnMob(s, 'elite'); const e = s.enemies[0]!
    const k = Math.max(Math.abs(e.x - s.x) / C.width, Math.abs(e.y - s.y) / C.height)
    assert.ok(inside(WORLD, e.x, e.y, -W.huntInset + 1), `세계 안 ${e.x},${e.y}`)
    assert.ok(!inside(view(s), e.x, e.y), '화면 밖'); assert.ok(k <= W.huntFar + 1e-9, `멀기 ${k}`)
    assert.equal(e.unseen, true)
  }
  const s = quiet(); spawnMob(s, 'elite'); const e = s.enemies[0]!
  e.x = s.x + 1500; e.y = s.y; e.cd = 1e9
  run(s, 5); assert.equal(e.unseen, true); assert.equal(e.bornAt, s.t, '안 본 동안은 태어난 때가 지금으로 밀린다')
  e.x = s.x + 300; e.y = s.y
  stepHaebi(s, still, 1 / 60); const seen = s.t
  assert.equal(e.unseen, undefined); assert.ok(seen - e.bornAt! < 1 / 30, '화면에 들어온 그 걸음에 멈춘다'); const born = e.bornAt
  run(s, 3); assert.equal(e.bornAt, born, '본 뒤로는 그대로')
  assert.ok(s.t - e.bornAt! <= CH.fastSeconds)
  // 화살표: 화면 밖 정예를 가리키고 화면 안에 들어오면 사라진다
  const t = quiet(); spawnMob(t, 'elite'); const far = t.enemies[0]!; far.x = t.x + 1500; far.y = t.y - 900
  const cam = newCam(); followCam(cam, t.x, t.y, 0, true, undefined, fieldBounds(t))
  const [arrow] = edgeArrows(t, cam)
  assert.equal(arrow!.kind, 'elite'); assert.ok(arrow!.x > C.width / 2 && arrow!.y < C.height / 2 && arrow!.x <= C.width && arrow!.y >= 0)
  assert.ok(Math.abs(arrow!.angle - Math.atan2(far.y - 30 - cam.y, far.x - cam.x)) < 1e-9)
  far.x = t.x + 200; far.y = t.y
  assert.equal(edgeArrows(t, cam).length, 0)
})

test('안개 문: 중간 보스 20초 전부터 닫혀 장수·적·알·상자를 결전장으로 밀고, 보스가 쓰러지면 다시 열린다', () => {
  const s = quiet(); const mid = midbossTime(s)
  s.t = mid - W.gateWarn - 1; s.x = WORLD.left + 40; s.y = WORLD.bottom - 30
  spawnMob(s, 'club', undefined, true); const mob = s.enemies[0]!; mob.x = WORLD.right - 20; mob.y = WORLD.top + 30; mob.cd = 1e9; mob.hp = mob.max = 1e12
  s.drops.push({ x: WORLD.right - 50, y: WORLD.top + 10, value: 1, age: 0 })
  s.chests!.push({ id: 99, eliteId: 0, x: WORLD.right - 40, y: WORLD.bottom - 5, bornAt: s.t, state: 'ground', choicesRemaining: 1, gold: 0, large: false })
  run(s, .5); assert.equal(s.wide!.gate, 0); assert.deepEqual({ left: s.wide!.left, top: s.wide!.top, right: s.wide!.right, bottom: s.wide!.bottom }, { ...WORLD })
  let cues = 0
  for (let i = 0; i < 60; i++) { const before = new Set(s.fx); stepHaebi(s, still, 1 / 60); cues += s.fx.filter(f => !before.has(f) && f.championCue === 'roar').length }
  assert.ok(s.wide!.gate > 0 && s.wide!.gate < .1); assert.equal(s.wide!.warned, 1)
  assert.equal(cues, 1, '닫히기 시작하면 한 번 알린다')
  // 닫히는 동안 결전장 쪽 화살표
  const cam = newCam(); followCam(cam, s.x, s.y, 0, true, undefined, fieldBounds(s))
  assert.ok(edgeArrows(s, cam).some(a => a.kind === 'arena'))
  // 문이 camLag 만큼 닫힐 때까지 카메라는 세계 끝까지 본다 (다가오는 안개가 보인다)
  assert.deepEqual({ ...cameraBounds(s)! }, { ...WORLD })
  let last = s.wide!.gate, hp = s.hp
  while (s.t < mid - .05) {
    stepHaebi(s, still, 1 / 60)
    assert.ok(s.wide!.gate >= last); last = s.wide!.gate
    const f = fieldBounds(s)
    assert.ok(s.x >= f.left + 32 - 1e-9 && s.y <= f.bottom - 24 + 1e-9, '장수는 늘 고리 안')
    assert.ok(inside(f, mob.x, mob.y), '적도 고리 안')
  }
  assert.equal(s.hp, hp, '고리는 밀기만 한다 (피해 없음)')
  run(s, .2)
  assert.equal(s.wide!.gate, 1); assert.deepEqual({ left: s.wide!.left, top: s.wide!.top, right: s.wide!.right, bottom: s.wide!.bottom }, { ...BOARD })
  assert.ok(inside(BOARD, s.x, s.y) && inside(BOARD, mob.x, mob.y) && inside(BOARD, s.drops[0]!.x, s.drops[0]!.y))
  const chest = s.chests!.find(c => c.id === 99)!; assert.ok(chest.x <= C.width - 32 && chest.y <= C.height - 24, '상자는 장수가 닿는 자리로')
  const boss = s.enemies.find(e => e.bossRole === 'midboss')!
  assert.ok(boss && inside(BOARD, boss.x, boss.y), '중간 보스는 결전장에')
  assert.equal(edgeArrows(s, cam).filter(a => a.kind === 'arena').length, 0, '다 닫히면 화살표는 없다')
  // 닫힌 동안은 옛 판과 같은 끝: 장수 32·65·24 · 카메라는 결전장에 고정
  run(s, 3, { x: -1, y: -1 }); assert.ok(s.x >= 32 && s.y >= 65)
  assert.deepEqual({ ...cameraBounds(s)! }, { ...BOARD }); assert.equal(cameraBounds(ONE_RUN), undefined)
  followCam(cam, s.x, s.y, 0, true, undefined, cameraBounds(s)); assert.deepEqual({ x: cam.x, y: cam.y }, { x: C.width / 2, y: C.height / 2 })
  // 보스가 쓰러지면 gateOpen 초에 걸쳐 열린다
  boss.hp = 0; s.giantFlow!.midDefeated = true
  run(s, W.gateOpen / 2); assert.ok(s.wide!.gate > .3 && s.wide!.gate < .7)
  run(s, W.gateOpen / 2 + .2); assert.equal(s.wide!.gate, 0); assert.equal(s.wide!.warned, 0)
  run(s, 6, { x: -1, y: 0 }); assert.ok(s.x < -500, '다시 밖으로 나갈 수 있다')
})

test('안개 문: 끝 보스 때에는 꼭 결전장과 같아지고 거대 보스는 결전장 가운데에 선다 · 중간 보스를 못 잡아도 닫힌 채다', () => {
  const s = quiet(); s.giantFlow!.midSpawned = true; s.giantFlow!.midDefeated = true
  s.t = bossTime(s) - W.gateWarn - .5; s.x = WORLD.right - 40; s.y = WORLD.top + 70
  run(s, W.gateWarn + 1)
  assert.equal(s.wide!.gate, 1); assert.equal(s.wide!.warned, 2)
  const giant = giantMob(s)!
  assert.ok(giant, '거대 보스가 나왔다'); assert.ok(inside(BOARD, giant.x, giant.y, -100), '결전장 한복판')
  assert.ok(inside(BOARD, s.x, s.y))
  // 중간 보스가 살아 있는 채 끝 보스 예고가 시작돼도 열리지 않는다
  const w = newWide(); let opened = false
  for (let t = 590; t < 1150; t += 1 / 60) { stepGate(w, t, 1 / 60, 600, 1140); if (t > 600 && w.gate < 1) opened = true }
  assert.equal(opened, false)
})

test('닫힌 결전장에서는 적이 옛 판과 같은 가장자리 자리에서 나온다', () => {
  const s = quiet(); s.wide!.gate = 1; Object.assign(s.wide!, BOARD)
  const old = quiet(ONE); old.seed = s.seed
  for (let i = 0; i < 50; i++) { spawnMob(s, 'club', undefined, true); spawnMob(old, 'club', undefined, true) }
  assert.deepEqual(s.enemies.map(e => [e.x, e.y]), old.enemies.map(e => [e.x, e.y]))
  const spot = { x: 0, y: 0 }
  huntSpot(s, 1, .5, spot); assert.ok(inside(BOARD, spot.x, spot.y, -W.huntInset + 1))
  ringSpot(s, 0, .5, spot); assert.equal(spot.x, 15)
})

test('일제 사격 발사자는 장수 화면 안의 궁수만 (봇은 판의 화면 틀로 잰다)', () => {
  const s = quiet(); s.x = -600; s.y = -300
  spawnMob(s, 'archer', undefined, true); const a = s.enemies[0]!
  a.x = 560; a.y = 360; assert.equal(barrageArcher(s), undefined, '원래 판 한가운데라도 화면 밖이면 아니다')
  a.x = s.x + 200; a.y = s.y + 100; assert.equal(barrageArcher(s), a)
})

test('장수는 화면 밖 먼 적을 저절로 쏘지 않는다 (넓은 맵만 · 화면에 들어오면 쏜다)', () => {
  for (const kit of ['bow', 'axe', 'magic'] as Kit[]) {
    const s = quiet(WIDE, kit); s.level = 6; s.ranks.ember = 2; s.ranks.thunder = 2
    spawnMob(s, 'club', undefined, true); const e = s.enemies[0]!
    e.x = s.x + 1500; e.y = s.y; e.cd = 1e9; e.hp = e.max = 1e9
    run(s, 3)
    assert.equal(s.damage, 0, `${kit}: 화면 밖 적은 안 맞는다`); assert.equal(s.shots.length, 0, `${kit}: 쏜 것도 없다`)
    e.x = s.x + 260; e.y = s.y
    run(s, 4)
    assert.ok(s.damage > 0, `${kit}: 화면에 들어오면 친다`)
  }
})

test('카메라: 1배에서도 장수를 따라가고 · 걷는 쪽을 앞서 보고 · 세계 끝에서 멈추고 · 누른 자리가 판 자리로 맞게 돌아온다', () => {
  // 옛 판(땅을 안 넘김)은 1배에서 판 가운데 고정 그대로
  const old = newCam(); followCam(old, 40, 40, 1, false); assert.deepEqual({ x: old.x, y: old.y }, { x: C.width / 2, y: C.height / 2 })
  assert.deepEqual(clampCenter(1, 0, 0), { x: C.width / 2, y: C.height / 2 }); assert.deepEqual(clampCenter(1.8, 0, 0), { x: C.width / 3.6, y: C.height / 3.6 })
  const cam = newCam(); followCam(cam, -300, -300, 0, true, undefined, WORLD)
  assert.deepEqual({ x: cam.x, y: cam.y }, { x: -300, y: -300 })
  // 오른쪽으로 걷는다 → 화면 가운데가 장수보다 오른쪽 (앞서 본다 · lookAhead 까지)
  let hx = -300
  for (let i = 0; i < 180; i++) { hx += C.speed / 60; followCam(cam, hx, -300, 1 / 60, false, undefined, WORLD) }
  assert.ok(cam.x > hx + W.view.lookAhead * .5 && cam.x <= hx + W.view.lookAhead + 1e-6, `앞서 봄 ${cam.x - hx}`)
  assert.ok(Math.abs(cam.y + 300) < 1e-6)
  // 적이 나오는 둘레는 앞서 본 화면보다도 밖이다
  assert.ok(W.spawnMargin > W.view.lookAhead + 15)
  // 세계 끝
  followCam(cam, WORLD.right - 32, WORLD.bottom - 24, 0, true, undefined, WORLD)
  assert.deepEqual(fieldView(cam), { left: WORLD.right - C.width, right: WORLD.right, top: WORLD.bottom - C.height, bottom: WORLD.bottom })
  for (const level of [0, 1, 2]) {
    const c = newCam(level); followCam(c, -900, 1200, 0, true, undefined, WORLD)
    const v = fieldView(c); assert.ok(v.left >= WORLD.left - 1e-9 && v.bottom <= WORLD.bottom + 1e-9)
    const at = toField(c, 200, 500), px = C.width / 2 + (at.x - c.x) * c.zoom, py = C.height / 2 + (at.y - c.y) * c.zoom
    assert.ok(Math.abs(px - 200) < 1e-9 && Math.abs(py - 500) < 1e-9, `단계 ${level}`)
  }
})

// ── 그리기 (화면만) ──
function canvas() {
  const calls: { method: string; args: unknown[] }[] = [], props: Record<string | symbol, unknown> = { canvas: { width: C.width, height: C.height }, globalAlpha: 1, lineWidth: 1, strokeStyle: '', fillStyle: '', imageSmoothingEnabled: false }
  const ctx = new Proxy(props, { get(o, key) {
    if (key in o) return o[key]
    return (...args: unknown[]) => { calls.push({ method: String(key), args }); if (key === 'measureText') return { width: 10 }; if (String(key).startsWith('create')) return { addColorStop() {} }; return undefined }
  }, set(o, key, value) { o[key] = value; return true } }) as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}
const image = (width: number, height: number) => ({ width, height, complete: true }) as unknown as HTMLImageElement

test('그리기: 화면에 걸친 적만 그리고 · 카메라 옮김이 1배에서도 걸리고 · 옛 판의 1배는 변환이 없다', () => {
  const images = new Map([['anim-px/enemy-forest-leather.png', image(2320, 144)], ['raid/forest.webp', image(1440, 810)], ['raid/ground-forest.webp', image(687, 350)]])
  const s = quiet(); s.x = -500; s.y = 900
  for (let i = 0; i < 6; i++) spawnMob(s, 'club', undefined, true)
  s.enemies.forEach((e, i) => { e.x = i < 2 ? s.x + 100 + i * 40 : 1500 + i * 30; e.y = i < 2 ? s.y : -400 })
  const cam = newCam(); followCam(cam, s.x, s.y, 0, true, undefined, fieldBounds(s))
  const wide = canvas(); drawField(wide.ctx, images, s, null, cam)
  const bodies = wide.calls.filter(c => c.method === 'drawImage' && (c.args[0] as { width: number }).width === 2320)
  assert.equal(bodies.length, 2, '화면 안 둘만')
  assert.ok(wide.calls.some(c => c.method === 'setTransform' && c.args[4] === C.width / 2 - cam.x && c.args[5] === C.height / 2 - cam.y), '카메라 옮김')
  const old = quiet(ONE); const plain = canvas(); drawField(plain.ctx, images, old, null, newCam())
  assert.ok(plain.calls.filter(c => c.method === 'setTransform').every(c => c.args[4] === 0 && c.args[5] === 0), '옛 판 1배는 옮김 없음')
})
