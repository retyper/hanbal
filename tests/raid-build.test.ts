// 65-BUILD 설치 갈래 (레벨업 카드의 네 번째 갈래 · 망루 · 목책 · 항아리) — 새 규칙 판만 · 꺼진 판은 예전과 글자 하나까지 같다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_BUILD as B, HAEBI_MOBS as M } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, spawnMob, towerShot, nodeAt, runBranches, KIT_RULES, CHEST_RULES, MAP_RULES, SOLID_RULES, ANCHOR_RULES, BREAK_RULES, BUILD_RULES, raidRulesForStage, type HaebiOpts, type HaebiRun, type StageId, type Kit } from '../src/raid/haebi.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, sealInput, replayRaid } from '../src/raid/runlog.ts'
import { BUILD_KINDS, jarShare, pushOutOfFences, fenceTouching, newBuild } from '../src/raid/build.ts'
import { treeModel } from '../src/raid/tree-model.ts'

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
/** 지금 열전 스테이지 판이 쓰는 규칙 (raid-main runOpts 와 같은 줄) — build 만 켜고 끈다 */
const prod = (stage: StageId, build: boolean): HaebiOpts => ({ stage, bonus: {}, simRules: raidRulesForStage(stage), permanentAwake: false, appearanceAwake: true, kitRules: KIT_RULES, chestRules: CHEST_RULES, mapRules: MAP_RULES, blockRules: SOLID_RULES, anchorRules: ANCHOR_RULES, breakRules: BREAK_RULES, ...(build ? { buildRules: BUILD_RULES } : {}) })
function bot(seed: number, kit: Kit, opts: HaebiOpts, seconds: number, seen?: (s: HaebiRun) => void) {
  const s = createHaebi(seed, 'stage', kit, opts)
  for (let i = 0; i < seconds * 120 && s.state === 'playing'; i++) {
    if (s.offers.length) { seen?.(s); choose(s, botChoice(s, 'storm')) } else stepHaebi(s, botInput(s, .5), 1 / 120)
  }
  return s
}
/** 한 장짜리 조용한 판 — 저절로 나오는 적·정예·일제 사격을 멈춘다 (시험할 적만 손으로 세운다) */
function quiet(kit: Kit = 'axe') {
  const s = createHaebi(5, 'stage', kit, { stage: 'forest', simRules: '56B', kitRules: KIT_RULES, buildRules: BUILD_RULES })
  s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9
  return s
}
const club = (s: HaebiRun, x: number, y: number, hp: number) => { spawnMob(s, 'club', undefined, true); const e = s.enemies[s.enemies.length - 1]!; e.x = x; e.y = y; e.hp = e.max = hp; e.cd = 9; return e }

/**
 * 65-BUILD 를 넣기 전 코드(커밋 72e5b433)로 잰 판 상태 SHA — 지금 열전 규칙 그대로 build 만 끈 60초 봇 판.
 * 설치 갈래가 꺼진 판의 카드 뽑기·난수 차례·판 상태가 예전과 같다는 증거. 일부러 판 셈(수치·규칙)을 바꾸면 이 값도 다시 잰다.
 */
const BEFORE_65: [StageId, Kit, string][] = [
  ['forest', 'bow', '43407baf340e68363b73eac04e6bf4af91d548f7631cb947ac72caab0eddffc9'],
  ['ford', 'axe', '68b6320a0593e5bbc7df18e6c254bfd563a3afc50a8a764417aeca2eaa2649d0'],
  ['palisade', 'sword', '39477307b3b0d2ae75023d65f64d459f581637e7662e8909edbe40091abf6d84'],
]
for (const [stage, kit, sha] of BEFORE_65) test(`65-BUILD off: ${stage}/${kit} 봇 판이 넣기 전과 같다 · 설치 카드는 나오지 않는다`, () => {
  const s = bot(23, kit, prod(stage, false), 60, r => assert.ok(!r.offers.some(p => (BUILD_KINDS as readonly string[]).includes(p)), String(r.offers)))
  assert.equal(s.build, undefined)
  assert.ok(!('tower' in s.ranks) && !('fence' in s.ranks) && !('jar' in s.ranks), '꺼진 판의 ranks 에는 설치 칸이 없다')
  assert.deepEqual(runBranches(s), ['a', 'b', 'c'])
  assert.equal(hash(s), sha)
})

test('65-BUILD on: 갈래 넷 · 설치 칸은 d 갈래 · 나무도 네 줄', () => {
  const s = quiet()
  assert.deepEqual(runBranches(s), ['a', 'b', 'c', 'd'])
  for (const k of BUILD_KINDS) { assert.equal(s.ranks[k], 0); assert.equal(nodeAt('axe', k)?.branch, 'd') }
  const m = treeModel(s)
  assert.equal(m.branches.length, 4)
  assert.deepEqual(m.branches[3]!.tiers.flat().map(n => n.id), ['tower', 'fence', 'jar'])
  assert.ok(m.branches[3]!.tiers.flat().every(n => n.open && !n.gate), '설치 칸은 처음부터 열려 있다')
})

test('65-BUILD: 망루가 장수 곁에 서서 멀리 있는 적을 화살로 친다', () => {
  const s = quiet(); s.ranks.tower = 1
  stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  const towers = s.build!.items.filter(it => it.kind === 'tower')
  assert.equal(towers.length, 1)
  const t = towers[0]!
  assert.ok(Math.abs(Math.hypot(t.x - s.x, t.y - s.y) - B.tower.ring) < 1, '장수 둘레 ring 에 선다')
  // 장수 도끼가 닿지 않는 먼 자리 (망루 사거리 안)
  const e = club(s, t.x + 250, t.y, 1e6)
  const shots: number[] = []
  for (let i = 0; i < 120; i++) { const want = towerShot(s); stepHaebi(s, { x: 0, y: 0 }, 1 / 120); for (const b of s.shots) if (b.kind === 'tower' && !shots.includes(b.damage)) { assert.ok(Math.abs(b.damage - want) / want < 1e-3, '피해 = 잡졸 체력 × 몫'); shots.push(b.damage) } }
  assert.ok(shots.length >= 1, '망루 화살이 날았다')
  assert.ok(1e6 - e.hp >= shots[0]! - 1e-6, `망루 화살에 깎였다 (${1e6 - e.hp})`)
  assert.ok(Math.hypot(e.x - s.x, e.y - s.y) > 200, '적은 장수에게 닿지 않았다')
})

test('65-BUILD: 항아리 둘레에서 쓰러진 적은 기세를 jarShare 배 준다', () => {
  const kill = (jar: number) => {
    const s = quiet(); s.ranks.jar = jar
    stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
    const e = club(s, s.x - 40, s.y, .01)
    for (let i = 0; i < 240 && e.hp > 0; i++) stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
    assert.ok(e.hp <= 0, '장수가 잡았다')
    return s
  }
  const plain = kill(0), withJar = kill(1)
  assert.equal(plain.build!.items.length, 0)
  assert.equal(withJar.build!.items.filter(it => it.kind === 'jar').length, 1)
  const drop = (s: HaebiRun) => s.drops.reduce((n, d) => n + d.value, 0) + s.xp
  assert.ok(Math.abs(drop(plain) - M.club.xp) < 1e-9)
  assert.ok(Math.abs(drop(withJar) - M.club.xp * jarShare(1)) < 1e-9, `${drop(withJar)}`)
  assert.ok(Math.abs(withJar.build!.jarXp - M.club.xp * (jarShare(1) - 1)) < 1e-9)
})

test('65-BUILD: 목책은 잡졸을 막고, 막힌 잡졸이 목책을 부순다', () => {
  const b = newBuild()
  b.items.push({ id: 1, kind: 'fence', x: 100, y: 100, born: 0, life: 9, total: 9, hp: 50, max: 50, cd: 0, flash: 0 })
  const body = { x: 105, y: 100 }; pushOutOfFences(b, body, 10)
  assert.ok(Math.abs(Math.hypot(body.x - 100, body.y - 100) - (B.fence.r + 10)) < 1e-9, '둘레 밖으로')
  assert.ok(fenceTouching(b, body, 10))
  b.items[0]!.hp = 0; assert.equal(fenceTouching(b, body, 10), undefined, '부서진 목책은 막지 않는다')
  // 판 안: 목책 앞의 잡졸은 걷지 않고 목책 체력을 깎는다
  const s = quiet(); s.ranks.fence = 1
  const e = club(s, s.x + 300, s.y, 1e6)
  stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  const f = s.build!.items.find(it => it.kind === 'fence')!
  assert.ok(Math.abs(Math.hypot(f.x - s.x, f.y - s.y) - B.fence.ahead) < 1 && f.x > s.x, '가장 가까운 적 쪽 ahead 앞에')
  e.x = f.x + B.fence.r + 10; e.y = f.y
  const hp = f.hp, x = e.x
  for (let i = 0; i < 120; i++) stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  assert.ok(f.hp < hp, '목책이 깎였다')
  assert.ok(Math.abs(e.x - x) < 1e-9, '막힌 잡졸은 서 있다')
})

test('65-BUILD: 같은 씨앗이면 자리·판이 같다 · 봇이 설치 카드를 고르고 설치물이 선다 · 판 기록 재생도 같다', () => {
  const run = (seed: number) => {
    let most = 0
    const s = createHaebi(seed, 'stage', 'bow', prod('forest', true))
    const r = startRecord(s, { id: 'build65', started: '2026-11-23T00:00:00Z', mode: 'stage', stage: 'forest', hero: 'ara', kit: 'bow', sprite: 'ara', seed, opts: prod('forest', true), from: null })
    for (let i = 0; i < 150 * 120 && s.state === 'playing'; i++) {
      while (s.offers.length) { const pick = botChoice(s, 'spread'); choose(s, pick); recPick(r, pick) }
      stepHaebi(s, recInput(r, botInput(s, .5)), 1 / 120)
      most = Math.max(most, s.build!.items.length)
    }
    return { s, most, game: sealInput(r) }
  }
  const a = run(31), b = run(31)
  assert.equal(hash(a.s), hash(b.s))
  assert.ok(BUILD_KINDS.some(k => a.s.ranks[k] > 0), '봇이 설치 카드를 골랐다')
  assert.ok(a.most > 0, '설치물이 섰다')
  assert.equal(a.game.opts.buildRules, BUILD_RULES, '판 기록 opts 에 남는다')
  assert.equal(hash(replayRaid(JSON.parse(JSON.stringify(a.game)))), hash(a.s), '기록을 다시 돌려도 같다')
})


// ── 그리기 (화면은 읽기만) ──
function canvas() {
  const calls: { method: string; args: unknown[] }[] = [], props: Record<string | symbol, unknown> = { canvas: { width: 1120, height: 720 }, globalAlpha: 1, lineWidth: 1, strokeStyle: '', fillStyle: '', imageSmoothingEnabled: false }
  const ctx = new Proxy(props, { get(o, key) {
    if (key in o) return o[key]
    return (...args: unknown[]) => { calls.push({ method: String(key), args }); if (key === 'measureText') return { width: 10 }; if (String(key).startsWith('create')) return { addColorStop() {} }; return undefined }
  }, set(o, key, value) { o[key] = value; return true } }) as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}
test('65-BUILD 그리기: 망루·목책(다치면 부서진 그림)·항아리가 몸 차례에 그려지고 판은 그대로', async () => {
  const { drawField } = await import('../src/raid/haebi-view.ts')
  const img = (width: number, height: number) => ({ width, height, complete: true }) as unknown as HTMLImageElement
  const tower = img(203, 210), fence = img(196, 115), broken = img(188, 110), jar = img(96, 96)
  const images = new Map([['raid/props/palisade-2.webp', tower], ['raid/props/palisade-0.webp', fence], ['raid/props/palisade-1.webp', broken], ['icon/good-soybean-jar.png', jar]])
  const s = quiet(); s.ranks.tower = 1; s.ranks.fence = 1; s.ranks.jar = 1
  club(s, s.x + 300, s.y, 1e6)
  stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  const before = hash(s)
  const c = canvas(); drawField(c.ctx, images, s, null)
  const drawn = (x: HTMLImageElement) => c.calls.some(k => k.method === 'drawImage' && k.args[0] === x)
  assert.ok(drawn(tower) && drawn(fence) && drawn(jar) && !drawn(broken))
  s.build!.items.find(it => it.kind === 'fence')!.hp = 1
  const d = canvas(); drawField(d.ctx, images, s, null)
  assert.ok(d.calls.some(k => k.method === 'drawImage' && k.args[0] === broken), '반 넘게 다친 목책은 부서진 그림')
  s.build!.items.find(it => it.kind === 'fence')!.hp = s.build!.items.find(it => it.kind === 'fence')!.max
  assert.equal(hash(s), before, '그리기가 판을 바꾸지 않는다 (체력은 시험이 되돌렸다)')
})
