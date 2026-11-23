// 71-BOSSDUEL 보스전은 보스와 겨루게 (형 11-23 「보스전에서는 졸병이 꼭 나와야 하나 · 잡몹이 최종 보스전 할 때 너무 많이 나옴」) — 새 규칙 판만 · 끈 판은 예전과 글자 하나까지 같다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_BOSS_DUEL as BD, HAEBI_RUN as C, HAEBI_SHOP } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, spawnMob, bossTime, KIT_RULES, CHEST_RULES, MAP_RULES, SOLID_RULES, ANCHOR_RULES, BREAK_RULES, BUILD_RULES, BUILD2_RULES, CAP_RULES, BOSSCHEST_RULES, BUILDUP_RULES, AWAKECAP_RULES, BOSSDUEL_RULES, raidRulesForStage, type HaebiOpts, type HaebiRun, type Mob } from '../src/raid/haebi.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, sealInput, replayRaid } from '../src/raid/runlog.ts'

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
/** 상점 절반 (헤드리스 밸런스 판과 같은 셈) */
const half = Object.fromEntries(Object.entries(HAEBI_SHOP).filter(([k]) => k !== 'growth').map(([k, v]) => [k, Math.round((v as { max: number }).max * .5)]))
const prod = (on: boolean): HaebiOpts => ({ stage: 'forest', bonus: half, simRules: raidRulesForStage('forest'), permanentAwake: false, appearanceAwake: true, kitRules: KIT_RULES, chestRules: CHEST_RULES, mapRules: MAP_RULES, blockRules: SOLID_RULES, anchorRules: ANCHOR_RULES, breakRules: BREAK_RULES, buildRules: BUILD_RULES, build2Rules: BUILD2_RULES, capRules: CAP_RULES, bossChestRules: BOSSCHEST_RULES, buildUpRules: BUILDUP_RULES, awakeCapRules: AWAKECAP_RULES, ...(on ? { bossDuelRules: BOSSDUEL_RULES } : {}) })
/** 한 장짜리 옛 두목 판 (거대 보스 없음) — 정예·일제 사격은 멈추고, 두목 때 바로 앞까지 시계를 돌린다 */
function nearBoss(on: boolean) {
  const s = createHaebi(5, 'stage', 'axe', { stage: 'forest', simRules: '56B', kitRules: KIT_RULES, ...(on ? { bossDuelRules: BOSSDUEL_RULES } : {}) })
  s.nextElite = 1e9; s.nextBarrage = 1e9; s.spawn = 1e9; s.t = bossTime(s) - .001
  return s
}
const club = (s: HaebiRun, x: number, y: number): Mob => { spawnMob(s, 'club', undefined, true); const e = s.enemies[s.enemies.length - 1]!; e.x = x; e.y = y; e.hp = e.max = 1e6; e.cd = 9; return e }

/**
 * 71 을 끈 숲 도끼 봇 판(상점 절반 · 19:22 승) — 마지막 두목 뒤 10초 · 판 끝 상태 SHA.
 * 71 을 넣기 전 코드(커밋 326cf56b)와 같은 값이었고, 뒤에 69-BUILDUP 수치(+25% · +15%)를 바꿔 다시 쟀다 (이 판의 봇이 화력·장전을 고른다)
 */
const BEFORE_71 = { boss: '719192eb5f12edd9ac76225a8026e86f329930d453a44c5171400ac7a162c074', end: '84e98d799cfaadde110e0524e7840f4ad0c5b8fddd37b763de18ef82f8a769e2' }
test('71-BOSSDUEL off: 마지막 두목을 지난 판이 넣기 전과 같다', () => {
  const s = createHaebi(7, 'stage', 'axe', prod(false))
  let atBoss = ''
  for (let i = 0; i < 1300 * 60 && s.state === 'playing'; i++) { if (s.offers.length) choose(s, botChoice(s, 'storm')); else stepHaebi(s, botInput(s, .5), 1 / 60); if (!atBoss && s.t >= bossTime(s) + 10) atBoss = hash(s) }
  assert.equal(s.duel, undefined)
  assert.equal(atBoss, BEFORE_71.boss); assert.equal(hash(s), BEFORE_71.end)
})

test('71 on: 마지막 두목이 나오면 보통 잡졸은 달아나 보상 없이 사라진다 · 정예·부른 졸개는 남는다 · 달아나는 동안 맞지도 치지도 않는다', () => {
  const s = nearBoss(true)
  const near = club(s, s.x + 5, s.y), far = club(s, s.x + 300, s.y + 40)
  spawnMob(s, 'elite', undefined, true); const elite = s.enemies[s.enemies.length - 1]!
  const kid = club(s, s.x - 200, s.y); kid.summoned = true
  const kills = s.kills, xp = s.xp, drops = s.drops.length, hp = s.hp
  stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  assert.equal(s.boss, true)
  const boss = s.enemies.find(e => e.kind === 'boss')!; boss.x += 3000; boss.cd = 1e9; near.cd = 0
  assert.equal(near.flee !== undefined && far.flee !== undefined, true, '보통 잡졸은 달아난다')
  assert.equal(elite.flee, undefined); assert.equal(kid.flee, undefined)
  const d0 = Math.hypot(far.x - s.x, far.y - s.y)
  for (let i = 0; i < 30; i++) stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  assert.ok(Math.hypot(far.x - s.x, far.y - s.y) > d0, '장수에게서 멀어진다')
  for (let i = 0; i < Math.ceil(BD.flee * 120) + 4; i++) stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  assert.ok(!s.enemies.includes(near) && !s.enemies.includes(far), '달아난 놈은 사라졌다')
  assert.ok(s.enemies.includes(elite) && s.enemies.includes(kid), '정예·부른 졸개는 남는다')
  assert.equal(s.kills, kills, '처치 수 그대로'); assert.equal(s.drops.length, drops, '기세 알 없음'); assert.equal(s.xp, xp)
  assert.ok(s.hp >= hp - 1e-9, `달아나는 놈은 치지 않는다 (${hp} → ${s.hp})`)
  assert.ok(s.fx.some(f => f.kind === 'ring' && f.r === BD.puff), '흙먼지 고리')
  // 끈 판은 아무도 달아나지 않는다
  const o = nearBoss(false); const c = club(o, o.x + 300, o.y); stepHaebi(o, { x: 0, y: 0 }, 1 / 120)
  assert.equal(c.flee, undefined); assert.ok(o.enemies.includes(c))
})

test('71 on: 마지막 두목이 살아 있으면 저절로 나오는 잡졸이 bossSpawn 배 · 적 상한 bossCap', () => {
  const count = (on: boolean) => {
    const s = nearBoss(on); s.spawn = 0
    stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
    const boss = s.enemies.find(e => e.kind === 'boss')!; boss.hp = boss.max = 1e12; boss.x = s.x + 600; boss.cd = 1e9
    s.x = s.x - 400; s.inv = 1e9
    const n0 = s.next
    for (let i = 0; i < 20 * 120; i++) { s.inv = 1e9; stepHaebi(s, { x: 0, y: 0 }, 1 / 120) }
    return s.next - n0
  }
  const off = count(false), on = count(true)
  assert.ok(off > 0 && on > 0)
  assert.ok(on < off * (BD.bossSpawn + .15), `${on} / ${off}`)
  // 상한 — 적이 bossCap 을 넘으면 저절로 나오지 않는다
  const s = nearBoss(true); stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  for (let i = 0; i < BD.bossCap; i++) club(s, s.x + 800, s.y)
  const n0 = s.next; s.spawn = 0; stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  assert.equal(s.next, n0, '상한에서 멈춘다'); assert.ok(BD.bossCap < C.maxEnemies)
})

test('71 on: 판 기록 opts 에 남고 기록 재생이 같다', () => {
  const opts = prod(true), s = createHaebi(31, 'stage', 'sword', opts)
  const r = startRecord(s, { id: 'duel71', started: '2026-11-23T00:00:00Z', mode: 'stage', stage: 'forest', hero: 'haebi', kit: 'sword', sprite: 'haebi', seed: 31, opts, from: null })
  for (let i = 0; i < 120 * 120 && s.state === 'playing'; i++) {
    while (s.offers.length) { const p = botChoice(s, 'storm'); choose(s, p); recPick(r, p) }
    stepHaebi(s, recInput(r, botInput(s, .5)), 1 / 120)
  }
  const game = sealInput(r)
  assert.equal(game.opts.bossDuelRules, BOSSDUEL_RULES); assert.equal(s.duel, true)
  assert.equal(hash(replayRaid(JSON.parse(JSON.stringify(game)))), hash(s))
})
