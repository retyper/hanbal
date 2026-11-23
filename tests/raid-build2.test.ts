// 67-BUILD2 설치 다섯 종류 더 (장승 · 솟대 · 봉수대 · 포차 · 우물) — 새 규칙 판만 · 65-BUILD 판은 예전과 글자 하나까지 같다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_BUILD2 as B2 } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, spawnMob, runBranches, runBranchNodes, buildChoices, KIT_RULES, CHEST_RULES, MAP_RULES, SOLID_RULES, ANCHOR_RULES, BREAK_RULES, BUILD_RULES, BUILD2_RULES, CAP_RULES, raidRulesForStage, type HaebiOpts, type HaebiRun, type StageId, type Kit, type Mob } from '../src/raid/haebi.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, sealInput, replayRaid } from '../src/raid/runlog.ts'
import { BUILD_KINDS, BUILD2_KINDS, ALL_BUILD_KINDS, sotdaeSlow, wellHeal, beaconRadius, catapultRadius, type BuildKind } from '../src/raid/build.ts'
import { treeModel } from '../src/raid/tree-model.ts'

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const prod = (stage: StageId, two: boolean): HaebiOpts => ({ stage, bonus: {}, simRules: raidRulesForStage(stage), permanentAwake: false, appearanceAwake: true, kitRules: KIT_RULES, chestRules: CHEST_RULES, mapRules: MAP_RULES, blockRules: SOLID_RULES, anchorRules: ANCHOR_RULES, breakRules: BREAK_RULES, buildRules: BUILD_RULES, capRules: CAP_RULES, ...(two ? { build2Rules: BUILD2_RULES } : {}) })
/** 한 장짜리 조용한 판 (67 켬) — 저절로 나오는 적·정예·일제 사격을 멈춘다 */
function quiet(kit: Kit = 'axe') {
  const s = createHaebi(5, 'stage', kit, { stage: 'forest', simRules: '56B', kitRules: KIT_RULES, buildRules: BUILD_RULES, build2Rules: BUILD2_RULES })
  s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9
  return s
}
const pick = (s: HaebiRun, k: BuildKind) => { s.offers = [k]; s.xp = 0; assert.ok(choose(s, k), k) }
const step = (s: HaebiRun, seconds: number, input = { x: 0, y: 0 }) => { for (let i = 0; i < seconds * 120; i++) stepHaebi(s, input, 1 / 120) }
const items = (s: HaebiRun, k?: BuildKind) => s.build!.items.filter(it => !k || it.kind === k)
/** 잡졸 하나 — id 는 지정한 값 (끌림 몫은 id 로만 갈린다) */
function club(s: HaebiRun, x: number, y: number, hp: number, id?: number): Mob {
  spawnMob(s, 'club', undefined, true); const e = s.enemies[s.enemies.length - 1]!
  e.x = x; e.y = y; e.hp = e.max = hp; e.cd = 9; if (id !== undefined) e.id = id
  return e
}

/** 67-BUILD2 를 넣기 전 코드(커밋 4db9251e)로 잰 65-BUILD + 66-CAP 판 상태 SHA (90초 봇 판 · 설치 카드도 골랐다) */
const BEFORE_67: [StageId, Kit, string][] = [
  ['forest', 'bow', '8acfcce1b50cd79c396a1712f290ba0d348ea5b287157dae53710fc6b32bf8fb'],
  ['ford', 'axe', 'f39f2c56aa376eb5e3e23c9e6be8b4337e0e1e51af7280970d0fb7d80aa00a58'],
  ['palisade', 'sword', '5d2344884a8d30b028cf442058c8568112f1afa4a1da98f2194c972e1c2491bc'],
]
for (const [stage, kit, sha] of BEFORE_67) test(`67-BUILD2 off: ${stage}/${kit} 65-BUILD 판이 넣기 전과 같다 · 새 다섯은 카드에도 ranks 에도 없다`, () => {
  const s = createHaebi(23, 'stage', kit, prod(stage, false))
  for (let i = 0; i < 90 * 120 && s.state === 'playing'; i++) {
    if (s.offers.length) { assert.ok(!s.offers.some(p => (BUILD2_KINDS as readonly string[]).includes(p)), String(s.offers)); choose(s, botChoice(s, 'storm')) } else stepHaebi(s, botInput(s, .5), 1 / 120)
  }
  assert.equal(s.build!.v2, undefined)
  for (const k of BUILD2_KINDS) assert.ok(!(k in s.ranks), k)
  assert.equal(hash(s), sha)
})

test('67-BUILD2 on: 설치 갈래 여덟 · 나무 네 층에 둘씩 · 종류 칸은 셋 (셋을 고르면 그것만 나온다)', () => {
  const s = quiet()
  assert.deepEqual(runBranches(s), ['a', 'b', 'c', 'd'])
  assert.deepEqual(runBranchNodes(s).d, [['tower', 'totem'], ['fence', 'sotdae'], ['jar', 'beacon'], ['catapult', 'well']])
  assert.deepEqual(treeModel(s).branches[3]!.tiers.flat().map(n => n.id).sort(), [...ALL_BUILD_KINDS].sort())
  assert.deepEqual([...buildChoices(s)].sort(), [...ALL_BUILD_KINDS].sort())
  pick(s, 'totem'); pick(s, 'well'); pick(s, 'beacon')
  assert.deepEqual([...buildChoices(s)].sort(), ['beacon', 'totem', 'well'])
  s.offers = ['tower']; assert.equal(choose(s, 'tower'), false, '넷째 종류는 못 고른다')
  // 65-BUILD 판의 나무는 예전 그대로 세 줄
  const old = createHaebi(5, 'stage', 'axe', { stage: 'forest', simRules: '56B', kitRules: KIT_RULES, buildRules: BUILD_RULES })
  assert.deepEqual(runBranchNodes(old).d, BUILD_KINDS.map(k => [k]))
})

test('67 장승: 체력이 크고 · 둘에 하나를 더 넓게 끈다 · 둘이 서면 혼줄이 지나는 적을 다치게 하고 느리게 한다 · 무너지면 다시 선다', () => {
  const s = quiet(); pick(s, 'totem')
  const t = items(s, 'totem')[0]!
  assert.ok(t.max > 0 && t.hp === t.max)
  // 끌림: id 가 둘의 배수면 aggroR(190) 안에서 끌린다 · 아니면 장수에게
  const pulled = club(s, t.x + 150, t.y + 60, 1e6, 1000), free = club(s, t.x + 150, t.y - 60, 1e6, 1001)
  step(s, 3)
  assert.equal(pulled.aggro, t.id); assert.equal(free.aggro, undefined)
  assert.ok(t.hp < t.max, '끌린 잡졸이 장승을 친다')
  // 혼줄: 둘째 장승(3단계) → 둘 사이 줄 위의 적
  pick(s, 'totem'); pick(s, 'totem')
  const [p, q] = items(s, 'totem')
  assert.ok(p && q)
  const mid = club(s, (p!.x + q!.x) / 2, (p!.y + q!.y) / 2, 1e6, 1003)
  const hp = mid.hp; stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  assert.ok(mid.hp < hp, '혼줄 위의 적이 다친다'); assert.ok((mid.slow ?? 0) > 0, '혼줄에 닿으면 느려진다')
  // 무너짐 → 잔해 → 다시 섬
  t.hp = 1e-9; step(s, .05); assert.ok(t.down > 0)
  step(s, B2.totem.rebuild + .1); assert.equal(t.down, 0); assert.ok(t.hp === t.max)
})

test('67 솟대: 무적 · 둘레 안의 적이 단계 몫만큼 느리게 걷는다', () => {
  const walk = (sotdae: boolean) => {
    const s = quiet(); if (sotdae) pick(s, 'sotdae')
    const at = sotdae ? items(s, 'sotdae')[0]! : { x: s.x + B2.sotdae.ahead, y: s.y }
    const e = club(s, at.x + 110, at.y + 70, 1e6, 1001), x0 = e.x, y0 = e.y   // 장수 도끼가 닿지 않는 곳 (맞으면 밀려난다)
    step(s, .5)
    return Math.hypot(e.x - x0, e.y - y0)
  }
  const plain = walk(false), slowed = walk(true)
  assert.ok(Math.abs(slowed / plain - (1 - sotdaeSlow(1))) < .02, `${(slowed / plain).toFixed(3)} ≈ ${1 - sotdaeSlow(1)}`)
})

test('67 봉수대: 무적 · 때마다 가장 뭉친 곳에 금빛 표식 → delay 초 뒤 화살비', () => {
  const s = quiet(); pick(s, 'beacon')
  const lone = club(s, s.x - 250, s.y, 1e6, 1001)
  const pack = [0, 1, 2, 3].map(i => club(s, s.x + 260 + i * 12, s.y + 120, 1e6, 1010 + i))
  stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  const m = s.shots.find(b => b.kind === 'signal')!
  assert.ok(m, '봉수 화살비가 떴다'); assert.ok(Math.hypot(m.x - pack[0]!.x, m.y - pack[0]!.y) < 60, '뭉친 쪽'); assert.equal(m.radius, beaconRadius(1))
  const before = pack.map(e => e.hp)
  step(s, B2.beacon.delay * .5); assert.deepEqual(pack.map(e => e.hp), before, '표식 동안은 아직')
  step(s, B2.beacon.delay * .6); assert.ok(pack.every((e, i) => e.hp < before[i]!), '떨어지면 뭉친 적이 모두 다친다')
  assert.equal(lone.hp, 1e6)
  assert.ok(items(s, 'beacon').every(it => it.hp === 0 && it.down === 0), '무적')
})

test('67 포차: 먼 뭉치에 바위 · flight 초 뒤 큰 둘레를 친다 · 체력이 있어 끌리고 무너진다', () => {
  const s = quiet(); pick(s, 'catapult')
  const c = items(s, 'catapult')[0]!
  const pack = [0, 1, 2].map(i => club(s, c.x + 420 + i * 15, c.y, 1e6, 1011 + i * 2))
  stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  const m = s.shots.find(b => b.kind === 'lob')!
  assert.ok(m); assert.equal(m.radius, catapultRadius(1)); assert.ok(Math.hypot(m.tx - pack[1]!.x, m.ty - pack[1]!.y) < 40)
  step(s, B2.catapult.flight + .05)
  assert.ok(pack.every(e => e.hp < 1e6), '떨어진 둘레의 적이 다친다')
  assert.ok(c.max > 0, '포차는 체력이 있다')
  const near = club(s, c.x + 90, c.y + 30, 1e6, 1500)
  step(s, 2); assert.equal(near.aggro, c.id, '셋에 하나는 포차로 끌린다')
  c.hp = 1e-9; step(s, .05); assert.ok(c.down > 0)
})

test('67 우물: 곁에 서 있으면 초마다 회복 · 우물이 둘이어도 한 번', () => {
  const heal = (wells: number) => {
    const s = quiet(); for (let i = 0; i < wells; i++) pick(s, 'well')
    s.hp = 50
    step(s, 1)
    return s.hp
  }
  const none = heal(0), one = heal(1), three = heal(5)
  assert.ok(Math.abs(one - none - wellHeal(1)) < .2, `${(one - none).toFixed(2)} ≈ ${wellHeal(1)}`)
  assert.ok(Math.abs(three - none - wellHeal(5)) < .2, '셋이 서도 다섯 단계 한 번만')
  // 멀리 걸어가면 회복이 없다
  const s = quiet(); pick(s, 'well'); step(s, 1.5, { x: -1, y: 0 }); s.hp = 50; step(s, 1)
  assert.ok(s.hp - 50 < wellHeal(1) * .5)
})

test('67-BUILD2: 같은 씨앗이면 판이 같다 · 봇이 새 다섯을 고른다 · 판 기록 재생도 같다', () => {
  const run = (seed: number) => {
    const opts = prod('forest', true)
    const s = createHaebi(seed, 'stage', 'axe', opts)
    const r = startRecord(s, { id: 'build67', started: '2026-11-23T00:00:00Z', mode: 'stage', stage: 'forest', hero: 'haebi', kit: 'axe', sprite: 'haebi', seed, opts, from: null })
    for (let i = 0; i < 180 * 120 && s.state === 'playing'; i++) {
      while (s.offers.length) { const p = botChoice(s, 'spread'); choose(s, p); recPick(r, p) }
      stepHaebi(s, recInput(r, botInput(s, .5)), 1 / 120)
    }
    return { s, game: sealInput(r) }
  }
  const a = run(41), b = run(41)
  assert.equal(hash(a.s), hash(b.s))
  assert.ok(BUILD2_KINDS.some(k => a.s.ranks[k] > 0), `봇이 새 종류를 골랐다 (${BUILD2_KINDS.map(k => k + a.s.ranks[k]).join(' ')})`)
  assert.equal(a.game.opts.build2Rules, BUILD2_RULES)
  assert.equal(hash(replayRaid(JSON.parse(JSON.stringify(a.game)))), hash(a.s))
})

// ── 그리기 (화면은 읽기만) ──
function canvas() {
  const calls: { method: string; args: unknown[] }[] = [], props: Record<string | symbol, unknown> = { canvas: { width: 1120, height: 720 }, globalAlpha: 1, lineWidth: 1, strokeStyle: '', fillStyle: '', imageSmoothingEnabled: false, lineCap: 'butt' }
  const ctx = new Proxy(props, { get(o, key) {
    if (key in o) return o[key]
    return (...args: unknown[]) => { calls.push({ method: String(key), args }); if (key === 'measureText') return { width: 10 }; if (String(key).startsWith('create')) return { addColorStop() {} }; return undefined }
  }, set(o, key, value) { o[key] = value; return true } }) as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}
test('67 그리기: 다섯이 그려지고 혼줄·표식·바위가 보이며 판은 그대로', async () => {
  const { drawField } = await import('../src/raid/haebi-view.ts')
  const img = (width: number, height: number) => ({ width, height, complete: true }) as unknown as HTMLImageElement
  const totem = img(95, 165), sotdae = img(96, 96), beacon = img(91, 120), rock = img(64, 64), arrow = img(64, 16)
  const images = new Map([['raid/props/snow-3.webp', totem], ['icon/route-sotdae.png', sotdae], ['raid/props/palisade-5.webp', beacon], ['fx/rock.png', rock], ['raid/arrow.png', arrow]])
  const s = quiet(); pick(s, 'totem'); pick(s, 'totem'); pick(s, 'totem'); pick(s, 'sotdae'); pick(s, 'beacon')
  club(s, s.x + 300, s.y + 80, 1e6, 1001)
  stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  const before = hash(s)
  const c = canvas(); drawField(c.ctx, images, s, null)
  const drawn = (x: HTMLImageElement) => c.calls.some(k => k.method === 'drawImage' && k.args[0] === x)
  assert.ok(drawn(totem) && drawn(sotdae) && drawn(beacon), '장승·솟대·봉수대 그림')
  assert.ok(c.calls.some(k => k.method === 'quadraticCurveTo'), '혼줄')
  assert.ok(drawn(arrow), '봉수 화살비')
  assert.equal(hash(s), before)
})
