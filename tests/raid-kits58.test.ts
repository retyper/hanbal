// 58-KITS 무기 개성 (11-22 형 「그래 추천대로해」 · docs/realm/WEAPON-IDENTITY-20261122.md) — 새 규칙 판만 바뀌고 옛 판은 그대로
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_KITS as K, HAEBI_RUN as C } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, spawnMob, normalizedRaidOpts, usesKitRules, KIT_RULES, type HaebiOpts, type HaebiRun, type Kit } from '../src/raid/haebi.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, sealInput, replayRaid } from '../src/raid/runlog.ts'

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
/** 적이 저절로 나오지 않는 조용한 판 */
function quiet(kit: Kit, opts: HaebiOpts = { kitRules: KIT_RULES }) {
  const s = createHaebi(7, 'stage', kit, opts); s.spawn = 1e9; s.nextElite = s.nextBarrage = 1e9; s.level = 5; return s
}
/** (dx,dy) 자리에 잡졸 하나 */
function foe(s: HaebiRun, dx: number, dy: number, hp = 5000) {
  spawnMob(s, 'club', undefined, true); const e = s.enemies[s.enemies.length - 1]!
  Object.assign(e, { x: s.x + dx, y: s.y + dy, hp, max: hp, cd: 99 }); return e
}

test('규칙을 켠 판만 무기 개성 셈을 갖고 · 판 기록 opts 에 남는다', () => {
  assert.equal(usesKitRules(createHaebi(7, 'stage', 'axe')), false)
  const s = createHaebi(7, 'stage', 'axe', { kitRules: KIT_RULES })
  assert.equal(usesKitRules(s), true)
  assert.equal(normalizedRaidOpts(s, { kitRules: KIT_RULES }).kitRules, KIT_RULES)
  assert.equal(normalizedRaidOpts(createHaebi(7, 'stage', 'axe'), {}).kitRules, undefined)
})

test('새 규칙 판도 같은 입력·고름이면 기록에서 똑같이 다시 돈다', () => {
  for (const kit of ['axe', 'bow', 'spear', 'sword', 'dagger', 'magic', 'sling'] as Kit[]) {
    const opts: HaebiOpts = { stage: 'forest', simRules: '55-GUMIHO', permanentAwake: false, appearanceAwake: true, kitRules: KIT_RULES }
    const run = createHaebi(58, 'stage', kit, opts)
    const r = startRecord(run, { id: 'kits58-' + kit, started: '2026-11-22T00:00:00Z', mode: 'stage', stage: 'forest', hero: 'ara', kit, sprite: 'ara', seed: 58, opts, from: null })
    for (let i = 0; i < 40 * 120; i++) {
      while (run.offers.length) { const pick = botChoice(run, 'spread'); choose(run, pick); recPick(r, pick) }
      stepHaebi(run, recInput(r, botInput(run, .5)), 1 / 120)
    }
    const game = sealInput(r), copy = replayRaid(game)
    assert.equal(game.opts.kitRules, KIT_RULES)
    assert.ok(usesKitRules(copy))
    assert.equal(hash(copy), hash(run), kit)
  }
})

test('도끼 4단계는 몸 둘레 원이 아니다 — 등 뒤 적은 안 맞고 앞 적은 밀려나 멈칫한다 (옛 판은 원)', () => {
  for (const kits of [true, false]) {
    const s = quiet('axe', kits ? { kitRules: KIT_RULES } : {}); s.ranks.axe = 4
    const front = foe(s, 40, 0), back = foe(s, -60, 0), hp = back.hp, x0 = front.x
    stepHaebi(s, { x: 0, y: 0 }, 1 / 60)
    assert.ok(front.hp < 5000)
    if (kits) { assert.equal(back.hp, hp, '등 뒤는 비운다'); assert.ok(front.x - x0 >= K.axe.knock, '앞을 밀어 연다'); assert.ok(front.daze > 0) }
    else assert.ok(back.hp < hp, '옛 판은 4단계 원 그대로')
  }
})

test('부적은 따로 날아가지 않고 내 무기가 맞힌 적에 붙었다가 터진다', () => {
  const s = quiet('spear'); s.ranks.ember = 1
  const e = foe(s, 60, 0)
  stepHaebi(s, { x: 0, y: 0 }, 1 / 60)
  const seal = s.shots.find(b => b.kind === 'ember')
  assert.ok(seal, '창이 꿴 적에 부적')
  assert.equal(seal!.source, e.id); assert.equal(seal!.vx, 0)
  const hp = e.hp
  for (let i = 0; i < Math.ceil(K.seal.delay * 60) + 2; i++) stepHaebi(s, { x: 0, y: 0 }, 1 / 60)
  assert.ok(e.hp < hp, '붙은 부적이 터졌다')
})

test('벽력은 큰 한 방에서만 튄다 — 칼 셋째 칼', () => {
  const s = quiet('sword'); s.ranks.thunder = 1
  foe(s, 50, 0); foe(s, 70, 30)
  const bolts = () => s.fx.filter(f => f.kind === 'bolt').length
  stepHaebi(s, { x: 0, y: 0 }, 1 / 60)
  assert.equal(bolts(), 0, '첫째 칼은 번개 없음')
  for (let i = 0; i < 60 * C.swordCooldown * 2.2 && !bolts(); i++) stepHaebi(s, { x: 0, y: 0 }, 1 / 60)
  assert.equal(s.kits!.swing % K.sword.every, 0); assert.ok(bolts() > 0, '셋째 칼에서 튄다')
})

test('칼 셋째 칼 반달은 걷는 쪽으로 날아간다', () => {
  const s = quiet('sword'); foe(s, 0, 60)
  s.kits!.swing = K.sword.every - 1
  stepHaebi(s, { x: -1, y: 0 }, 1 / 60)
  const wave = s.shots.find(b => b.kind === 'wave' && b.big)
  assert.ok(wave); assert.ok(wave!.vx < 0 && Math.abs(wave!.vy) < 1e-9, '적(아래)이 아니라 걷는 쪽(왼쪽)')
})

test('활은 멈춰 서서 겨눔이 차면 모두 꿰뚫는 큰 화살 · 움직이면 보통 화살', () => {
  const s = quiet('bow'); foe(s, 200, 0, 1e6)
  for (let i = 0; i < 60 * K.bow.focus + 2; i++) { s.cool.bow = 1; stepHaebi(s, { x: 0, y: 0 }, 1 / 60) }
  s.cool.bow = 0; stepHaebi(s, { x: 0, y: 0 }, 1 / 60)
  assert.ok(s.shots.some(b => b.kind === 'arrow' && b.big), '겨눔 화살')
  const m = quiet('bow'); foe(m, 200, 0, 1e6)
  for (let i = 0; i < 60; i++) stepHaebi(m, { x: 0, y: i % 2 ? 1 : -1 }, 1 / 60)
  assert.ok(!m.shots.some(b => b.kind === 'arrow' && b.big))
})

test('방울 굿판은 한자리에 서 있을수록 넓어진다 · 둘레는 방울만', () => {
  const ring = (still: number) => { const s = quiet('magic'); s.kits!.still = still; foe(s, 60, 0); stepHaebi(s, { x: 0, y: 0 }, 1 / 60); return s.fx.find(f => f.kind === 'ring')!.r }
  assert.ok(ring(K.bell.groundTime) > ring(0) * (1 + K.bell.radius * .9))
})

test('창은 곧게 달리면 돌격 — 더 길게 닿는다', () => {
  const reach = (run: number) => { const s = quiet('spear'); s.kits!.runT = run; s.moving = true; const e = foe(s, (C.spearLength + C.spearRankLength) * 1.25, 0); stepHaebi(s, { x: 1, y: 0 }, 1 / 60); return e.hp < 5000 }
  assert.equal(reach(0), false); assert.equal(reach(K.spear.chargeTime + .1), true)
})

test('단검은 손 닿는 데의 가장 센 적을 찌르고 독이 겹친다', () => {
  const s = quiet('dagger'), small = foe(s, 30, 0, 100), big = foe(s, 0, 40, 5000)
  for (let i = 0; i < 60 * C.daggerCooldown * 3.5; i++) stepHaebi(s, { x: 0, y: 0 }, 1 / 60)
  assert.ok((big.stack ?? 0) >= 3, '큰 놈에 독이 겹겹'); void small
})

test('돌팔매는 너무 가까운 적에게 반만 아프다', () => {
  const dmg = (d: number) => { const s = quiet('sling'), e = foe(s, d, 0); for (let i = 0; i < 30; i++) stepHaebi(s, { x: 0, y: 0 }, 1 / 60); return 5000 - e.hp }
  const near = dmg(60), far = dmg(200)
  assert.ok(near > 0 && near < far * .75)
})
