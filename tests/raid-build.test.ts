// 65-BUILD 설치 갈래 (레벨업 카드의 네 번째 갈래 · 망루 · 목책 · 항아리) — 새 규칙 판만 · 꺼진 판은 예전과 글자 하나까지 같다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_BUILD as B, HAEBI_MOBS as M, HAEBI_RUN as C, HAEBI_PALISADE as WL, HAEBI_CAP as CP, HAEBI_CAP_VIEW as CV } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, spawnMob, towerShot, nodeAt, runBranches, KIT_RULES, CHEST_RULES, MAP_RULES, SOLID_RULES, ANCHOR_RULES, BREAK_RULES, BUILD_RULES, CAP_RULES, xpNeeded, runGold, maxLevel, raidRulesForStage, type HaebiOpts, type HaebiRun, type StageId, type Kit } from '../src/raid/haebi.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, sealInput, replayRaid } from '../src/raid/runlog.ts'
import { BUILD_KINDS, jarShare, fenceTouching, aggroShare, type BuildKind } from '../src/raid/build.ts'
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
/** 망루에 끌리는 몫(aggro = true)이거나 아닌 잡졸 — id 를 그 몫에 맞춘다 (판은 id 로만 가른다) */
const clubOf = (s: HaebiRun, aggro: boolean, x: number, y: number, hp: number) => { const e = club(s, x, y, hp); e.id = s.next * B.tower.aggroEvery + (aggro ? 0 : 1); s.next++; assert.equal(aggroShare(e.id), aggro); return e }

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

/** 레벨업 카드로 고른다 (판이 놓는 길 그대로) */
const pick = (s: HaebiRun, k: BuildKind) => { s.offers = [k]; s.xp = 0; assert.ok(choose(s, k), k) }
const step = (s: HaebiRun, seconds: number, input = { x: 0, y: 0 }) => { for (let i = 0; i < seconds * 120; i++) stepHaebi(s, input, 1 / 120) }
const items = (s: HaebiRun, k?: BuildKind) => s.build!.items.filter(it => !k || it.kind === k)

test('65-BUILD: 고르면 장수 앞에 하나 서서 예전 수명이 지나도 그대로 · 3·5단계에 하나씩 더 (셋까지)', () => {
  const s = quiet()
  pick(s, 'tower')
  const t = items(s, 'tower')[0]!
  assert.ok(Math.abs(Math.hypot(t.x - s.x, t.y - s.y) - B.tower.ahead) < 1 && t.x > s.x, '보는 쪽(적이 없으면) 앞 ahead 에')
  pick(s, 'jar'); pick(s, 'fence')
  assert.equal(items(s).length, 3)
  const at = items(s).map(it => [it.x, it.y])
  step(s, 60)
  assert.deepEqual(items(s).map(it => [it.x, it.y]), at, '60초가 지나도 그 자리에 그대로')
  assert.ok(items(s).every(it => it.down === 0))
  pick(s, 'tower'); assert.equal(items(s, 'tower').length, 1, '2단계는 세지기만')
  pick(s, 'tower'); assert.equal(items(s, 'tower').length, 2, '3단계에 하나 더')
  pick(s, 'tower'); pick(s, 'tower'); assert.equal(items(s, 'tower').length, 3, '5단계에 셋')
  for (const p of items(s)) for (const q of items(s)) if (p !== q) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= B[p.kind].r + B[q.kind].r - .5, '설치물끼리 겹치지 않는다')
})

test('65-BUILD: 망루가 멀리 있는 적을 화살로 친다 (피해 = 잡졸 체력 × 몫)', () => {
  const s = quiet(); pick(s, 'tower')
  const t = items(s, 'tower')[0]!, e = club(s, t.x + 250, t.y + 40, 1e6)
  const shots: number[] = []
  for (let i = 0; i < 120; i++) { const want = towerShot(s); stepHaebi(s, { x: 0, y: 0 }, 1 / 120); for (const b of s.shots) if (b.kind === 'tower' && !shots.includes(b.damage)) { assert.ok(Math.abs(b.damage - want) / want < 1e-3); shots.push(b.damage) } }
  assert.ok(shots.length >= 1, '망루 화살이 날았다')
  assert.ok(1e6 - e.hp >= shots[0]! - 1e-6 && Math.hypot(e.x - s.x, e.y - s.y) > 200, '장수에게 닿지 않은 적이 망루 화살에 깎였다')
})

test('65-BUILD: 장수는 설치물을 지나가지 못하고 몸으로 밀면 함께 느리게 미끄러진다', () => {
  const s = quiet(); pick(s, 'jar')
  const j = items(s, 'jar')[0]!, x0 = s.x, jx = j.x
  // 오른쪽(항아리 쪽)으로 1초 — 닿기 전엔 제 빠르기 · 밀기 시작하면 pushShare 몫
  for (let i = 0; i < 120; i++) { stepHaebi(s, { x: 1, y: 0 }, 1 / 120); assert.ok(Math.hypot(s.x - j.x, s.y - j.y) >= B.jar.r + WL.heroR - 1e-6, '겹치지 않는다') }
  assert.ok(j.x > jx + 20, `항아리가 밀렸다 (${(j.x - jx).toFixed(1)}px)`)
  const free = jx - x0 - B.jar.r - WL.heroR, rest = C.speed - free, moved = s.x - x0
  assert.ok(moved < free + rest * B.pushShare + 4 && moved > free + rest * B.pushShare * .5, `밀면서 느려진다 (${moved.toFixed(1)}px · 안 느려지면 ${C.speed}px)`)
  assert.ok(j.push > 0, '밀리는 동안 흙먼지')
  const y0 = s.y; step(s, .5, { x: 0, y: 1 }); assert.ok(s.y - y0 > C.speed * .45, '비켜 걸으면 제 빠르기')
})

test('65-BUILD: 적은 설치물을 지나가지 못하고(밀지도 못하고) · 끌리지 않은 잡졸은 망루·항아리를 깎지 않는다', () => {
  const s = quiet(); pick(s, 'tower'); pick(s, 'jar')
  const t = items(s, 'tower')[0]!, tx = t.x, ty = t.y
  const e = clubOf(s, false, t.x + 45, t.y + 3, 1e6)
  for (let i = 0; i < 3 * 120; i++) {
    stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
    for (const it of items(s)) assert.ok(Math.hypot(e.x - it.x, e.y - it.y) >= B[it.kind].r + 10 - 1e-6, '잡졸이 설치물 몸 안에 들지 않는다')
  }
  assert.ok(Math.hypot(t.x - tx, t.y - ty) < 1e-9, '적은 밀지 못한다')
  assert.ok(t.hp === t.max && t.down === 0, '끌리지 않은 잡졸은 망루를 치지 않는다')
  assert.ok(items(s, 'jar').every(it => it.hp === 0 && it.max === 0 && it.down === 0), '항아리는 체력이 없다 (무적)')
})

test('65-BUILD 어그로: 끌리는 몫은 id 로만 정해져 같은 씨앗이면 늘 같다 (셋에 하나)', () => {
  const ids = Array.from({ length: 30 }, (_, i) => i + 1)
  assert.equal(ids.filter(aggroShare).length, 30 / B.tower.aggroEvery)
  assert.deepEqual(ids.filter(aggroShare), ids.filter(aggroShare))
  // 같은 판 두 번: 끌린 잡졸·망루 체력이 같다
  const run = () => { const s = quiet(); pick(s, 'tower'); const t = items(s, 'tower')[0]!; for (let i = 0; i < 6; i++) club(s, t.x + 100 + i * 7, t.y - 60 + i * 20, 1e6); step(s, 3); return { aggro: s.enemies.map(e => e.aggro ?? 0), hp: t.hp } }
  assert.deepEqual(run(), run())
})

test('65-BUILD 어그로: 끌린 잡졸만 망루로 가서 치고 · 무너지면 잔해(막지·쏘지 않음) → 장수에게 돌아가고 → rebuild 초 뒤 다시 선다 · 항아리는 무적', () => {
  const s = quiet(); pick(s, 'tower'); pick(s, 'jar')
  const t = items(s, 'tower')[0]!, j = items(s, 'jar')[0]!, tx = t.x, ty = t.y
  const free = clubOf(s, false, t.x + 120, t.y + 70, 1e6), hit = clubOf(s, true, t.x + 110, t.y - 70, 1e6)
  assert.ok(t.max > 0 && t.hp === t.max, '망루는 체력이 있다')
  step(s, 4)
  assert.equal(hit.aggro, t.id, '끌린 잡졸이 망루를 노린다'); assert.equal(free.aggro, undefined, '다른 잡졸은 장수를 노린다')
  assert.ok(Math.hypot(hit.x - t.x, hit.y - t.y) < B.tower.aggroR * .6, `망루 곁으로 갔다 (망루 화살에 밀려도 다시 붙는다 · ${Math.hypot(hit.x - t.x, hit.y - t.y).toFixed(0)}px)`)
  assert.ok(t.hp < t.max, '망루가 깎였다')
  t.hp = 1e-6; for (let i = 0; i < 3 * 120 && t.down <= 0; i++) stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  assert.ok(t.down > 0, '무너져 잔해'); assert.equal(hit.aggro, undefined, '망루가 무너지면 장수에게 돌아간다')
  step(s, 1); assert.equal(s.shots.filter(b => b.kind === 'tower').length, 0, '잔해는 쏘지 않는다')
  step(s, B.tower.rebuild)
  assert.equal(t.down, 0); assert.ok(t.hp > 0 && t.hp <= t.max)
  assert.ok(Math.hypot(t.x - tx, t.y - ty) < 40, '거의 같은 자리에 다시 선다')
  assert.ok(j.hp === 0 && j.down === 0, '항아리는 그대로 (무적)')
})

// ── 66-CAP 최고 레벨 뒤 ──
const capRun = (on: boolean) => { const s = createHaebi(5, 'stage', 'axe', { stage: 'forest', simRules: '56B', kitRules: KIT_RULES, ...(on ? { capRules: CAP_RULES } : {}) }); s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9; return s }
test('66-CAP on: 최고 레벨 뒤 기세 막대가 차면 비우고 회복·판 금으로 · 레벨은 그대로', () => {
  const s = capRun(true)
  assert.equal(maxLevel(s), CP.capLevel); assert.equal(CP.capLevel, 50)
  s.level = CP.capLevel - 1; s.offers = []; s.xp = 0; s.offers = ['tempo']; assert.ok(choose(s, 'tempo')); assert.equal(s.level, CP.capLevel, '49 → 50 은 카드로')
  s.offers = []; s.xp = 1e9; stepHaebi(s, { x: 0, y: 0 }, 1 / 120); assert.equal(s.offers.length, 0, '50 에서는 카드가 더 안 나온다'); assert.equal(s.level, CP.capLevel)
  s.hp = 40; s.xp = xpNeeded(s) * 2.5; s.cap!.n = 0; s.cap!.gold = 0; s.fx = []
  const gold0 = runGold(s)
  stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  assert.equal(s.level, CP.capLevel); assert.equal(s.offers.length, 0)
  assert.equal(s.cap!.n, 2, '두 번 찼다'); assert.ok(s.xp < xpNeeded(s) && s.xp > 0, '남은 기세는 다음 막대로')
  assert.ok(s.hp >= Math.min(s.maxHp, 40 + 2 * CP.heal * s.maxHp) - 1, `회복 (${s.hp.toFixed(1)})`)
  assert.ok(s.cap!.gold > 0 && runGold(s) === gold0 + s.cap!.gold, '판 금에 더해진다')
  assert.equal(s.fx.filter(f => f.capGold !== undefined).length, 2, '보상마다 화면이 「+금 · 회복」을 띄울 표식')
  // 같은 판 두 번이면 같다
  const twice = () => { const r = capRun(true); r.level = CP.capLevel; r.hp = 40; r.xp = xpNeeded(r) * 2.5; stepHaebi(r, { x: 0, y: 0 }, 1 / 120); return hash(r) }
  assert.equal(twice(), twice())
})
test('66-CAP off: 최고 레벨 뒤 기세는 예전처럼 쌓이기만 한다', () => {
  const s = capRun(false)
  assert.equal(maxLevel(s), 44, '끈 판은 예전 44')
  s.level = C.maxLevel; s.hp = 40; const xp = xpNeeded(s) * 2.5; s.xp = xp
  stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  assert.equal(s.cap, undefined); assert.equal(s.level, 44); assert.ok(s.xp >= xp - 1e-9); assert.ok(s.hp < 41)
})

test('65-BUILD: 목책 앞의 잡졸은 서서 목책을 깎고 · 부서지면 잔해(지나감) → rebuild 초 뒤 같은 자리에 다시 선다', () => {
  const s = quiet(); pick(s, 'fence')
  const f = items(s, 'fence')[0]!, fx = f.x, fy = f.y
  const e = club(s, f.x + B.fence.r + 12, f.y, 1e6), hp = f.hp, x = e.x
  step(s, 1)
  assert.ok(f.hp < hp, '목책이 깎였다'); assert.ok(Math.abs(e.x - x) < 1e-9, '막힌 잡졸은 서 있다')
  f.hp = 1e-6; step(s, .1)
  assert.ok(f.down > 0 && fenceTouching(s.build!, e, 10) === undefined, '부서지면 잔해 · 막지 않는다')
  step(s, B.fence.rebuild)
  assert.equal(f.down, 0); assert.ok(f.hp > 0 && f.hp <= f.max)
  assert.ok(Math.hypot(f.x - fx, f.y - fy) < 40, '거의 같은 자리에 다시 선다 (그 자리에 선 몸만 비켜 선다)')
})

test('65-BUILD: 항아리 둘레에서 쓰러진 적은 기세를 jarShare 배 준다', () => {
  const kill = (jar: boolean) => {
    const s = quiet(); if (jar) pick(s, 'jar')
    s.xp = 0
    const e = club(s, s.x + 30, s.y - 30, .01)
    for (let i = 0; i < 240 && e.hp > 0; i++) stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
    assert.ok(e.hp <= 0, '장수가 잡았다')
    return s
  }
  const plain = kill(false), withJar = kill(true)
  const drop = (s: HaebiRun) => s.drops.reduce((n, d) => n + d.value, 0) + s.xp
  assert.ok(Math.abs(drop(plain) - M.club.xp) < 1e-9)
  assert.ok(Math.abs(drop(withJar) - M.club.xp * jarShare(1)) < 1e-9, `${drop(withJar)}`)
  assert.ok(Math.abs(withJar.build!.jarXp - M.club.xp * (jarShare(1) - 1)) < 1e-9)
})

test('65-BUILD: 같은 씨앗이면 자리·판이 같다 · 봇이 설치 카드를 고르고 설치물이 선다 · 판 기록 재생도 같다', () => {
  const run = (seed: number) => {
    const opts: HaebiOpts = { ...prod('forest', true), capRules: CAP_RULES }
    const s = createHaebi(seed, 'stage', 'bow', opts)
    const r = startRecord(s, { id: 'build65', started: '2026-11-23T00:00:00Z', mode: 'stage', stage: 'forest', hero: 'ara', kit: 'bow', sprite: 'ara', seed, opts, from: null })
    for (let i = 0; i < 150 * 120 && s.state === 'playing'; i++) {
      while (s.offers.length) { const p = botChoice(s, 'spread'); choose(s, p); recPick(r, p) }
      stepHaebi(s, recInput(r, botInput(s, .5)), 1 / 120)
    }
    return { s, game: sealInput(r) }
  }
  const a = run(31), b = run(31)
  assert.equal(a.game.opts.capRules, CAP_RULES, '66-CAP 도 판 기록 opts 에 남는다')
  assert.equal(hash(a.s), hash(b.s))
  assert.ok(BUILD_KINDS.some(k => a.s.ranks[k] > 0) && a.s.build!.items.length > 0, '봇이 설치 카드를 골랐고 설치물이 서 있다')
  assert.deepEqual(a.s.build!.items.map(it => [it.kind, it.x, it.y]), b.s.build!.items.map(it => [it.kind, it.x, it.y]))
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
test('65-BUILD 그리기: 망루·목책·항아리가 몸 차례에 · 부서진 목책은 잔해 그림 · 판은 그대로', async () => {
  const { drawField } = await import('../src/raid/haebi-view.ts')
  const img = (width: number, height: number) => ({ width, height, complete: true }) as unknown as HTMLImageElement
  const tower = img(203, 210), fence = img(196, 115), rubble = img(188, 110), jar = img(96, 96)
  const images = new Map([['raid/props/palisade-2.webp', tower], ['raid/props/palisade-0.webp', fence], ['raid/props/palisade-1.webp', rubble], ['icon/good-soybean-jar.png', jar]])
  const s = quiet(); pick(s, 'tower'); pick(s, 'fence'); pick(s, 'jar')
  step(s, 1 / 120)
  const before = hash(s)
  const c = canvas(); drawField(c.ctx, images, s, null)
  const drawn = (calls: typeof c.calls, x: HTMLImageElement) => calls.some(k => k.method === 'drawImage' && k.args[0] === x)
  assert.ok(drawn(c.calls, tower) && drawn(c.calls, fence) && drawn(c.calls, jar) && !drawn(c.calls, rubble))
  assert.equal(hash(s), before, '그리기가 판을 바꾸지 않는다')
  items(s, 'fence')[0]!.down = 3; items(s, 'tower')[0]!.down = 3
  const d = canvas(); drawField(d.ctx, images, s, null)
  assert.ok(drawn(d.calls, rubble) && !drawn(d.calls, fence), '목책 잔해 그림')
  const towerDraw = d.calls.find(k => k.method === 'drawImage' && k.args[0] === tower)!
  assert.ok((towerDraw.args[4] as number) < B.view.towerH * .9, '망루 잔해는 주저앉혀 그린다')
  // 최고 레벨 — 처음 닿은 판에서 큰 글자 (이 판은 66-CAP 이 꺼져 최고 레벨 44)
  s.level = maxLevel(s)
  const e = canvas(); drawField(e.ctx, images, s, null)
  assert.ok(e.calls.some(k => k.method === 'fillText' && k.args[0] === CV.banner), '「수련을 모두 마쳤습니다」')
  s.fx.push({ kind: 'ring', x: s.x, y: s.y, x2: s.x, y2: s.y, r: CP.ring, angle: 0, life: .3, total: .3, color: '#ffd66b', capGold: 8 })
  const g = canvas(); drawField(g.ctx, images, s, null)
  assert.ok(g.calls.some(k => k.method === 'fillText' && k.args[0] === '+8금 · 회복'), '보상마다 작은 「+금 · 회복」')
})
