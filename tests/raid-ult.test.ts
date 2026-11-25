// 열전 비기 — 무기마다 꼴이 다르다 (11-16 형: 「무기마다 확실히 다르게 · DPS 예측해서 밸런스 조절」 · tools/raid-ult-dps.ts)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_RUN as C, HAEBI_ULT as U } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, spawnMob, powerScale, areaScale, KITS, choose, xpNeeded, ultOpen, type HaebiRun, type Kit, type Mob } from '../src/raid/haebi.ts'
import { replay } from '../src/raid/haebi-replay.ts'

const KIT6 = Object.keys(KITS) as Kit[]
const idle = { x: 0, y: 0 }
/** 적이 저절로 나오지 않고 평타·조합이 쉬는 판 — 맞는 건 비기뿐 */
function field(kit: Kit, x = C.width / 2, y = C.height / 2) {
  const s = createHaebi(7, 'stage', kit); s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9; s.x = x; s.y = y
  s.level = U.unlockLevel   // 비기는 첫 레벨업에서 열린다 (11-19 형: 「시작은 평타만」) · 이 판들은 비기만 재므로 열린 레벨로
  return s
}
function place(s: HaebiRun, dx: number, dy: number, kind: Mob['kind'] = 'iron') {
  spawnMob(s, 'club'); const e = s.enemies[s.enemies.length - 1]!
  Object.assign(e, { kind, x: s.x + dx, y: s.y + dy, hp: 1e6, max: 1e6, cd: 99 })
  return e
}
function step(s: HaebiRun, skill: boolean, input = idle) { for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) s.cool[k] = 99; stepHaebi(s, { ...input, skill }, 1 / 120) }
/** 시전이 끝나 비기가 터질 때까지 (HAEBI_ULT.cast · 판이 느려진다) */
function release(s: HaebiRun, input = idle) { for (let i = 0; i < 600 && s.cast; i++) step(s, false, input) }
/** 비기를 쓰고 시전 → 이어지는 조각이 다 끝날 때까지 */
function cast(s: HaebiRun, input = idle) { step(s, true, input); release(s, input); for (let i = 0; i < 120 && s.ult; i++) step(s, false, input) }
const hurt = (e: Mob) => e.max - e.hp

test('같은 씨앗·같은 입력이면 비기까지 같은 판 · 비기는 재사용·무적을 묶음 값대로 건다', () => {
  for (const kit of KIT6) {
    const make = () => { const s = field(kit); for (let i = 0; i < 12; i++) place(s, Math.cos(i) * (80 + i * 25), Math.sin(i * 1.7) * (60 + i * 15), 'club'); return s }
    const a = make(), b = make()
    for (let i = 0; i < 90; i++) { const input = { x: Math.sin(i / 20), y: Math.cos(i / 30), skill: i === 3 }; stepHaebi(a, input, 1 / 120); stepHaebi(b, input, 1 / 120) }
    assert.deepEqual(a, b, kit)
    const s = make(); step(s, true)
    assert.ok(Math.abs(s.skillCd - U[kit].cooldown) < .02, `${kit} 재사용`)
    assert.equal(s.damage, 0, `${kit} 누른 순간은 시전 · 아직 안 터진다`)
    assert.ok(s.cast && s.cast.kind === 'ult', `${kit} 시전`)
    release(s)
    assert.ok(s.inv >= C.skillInv - .02, `${kit} 무적`)
    for (let i = 0; i < 120 && s.ult; i++) step(s, false)   // 휘몰이는 끌어모은 뒤(gather) 후려친다 — 이어지는 비기가 끝날 때까지
    assert.ok(s.damage > 0, `${kit} 맞힘`)
    const r1 = replay(5, 60, 'storm', undefined, kit), r2 = replay(5, 60, 'storm', undefined, kit)
    assert.deepEqual(r1, r2, `${kit} 봇 판`)
  }
})

test('비기 한 번에 소리 신호(skill 그림)는 하나 · 그림은 모두 제 묶음 표식을 단다', () => {
  for (const kit of KIT6) {
    const s = field(kit); for (let i = 0; i < 8; i++) place(s, 60 + i * 30, (i % 3 - 1) * 40, 'club')
    const seen = new Set<object>(), lead: object[] = []
    step(s, true); for (let i = 0; i < 300; i++) { for (const f of s.fx) if (!seen.has(f)) { seen.add(f); if (f.kind === 'skill') lead.push(f) } step(s, false) }
    assert.equal(lead.length, 1, kit)
    for (const f of seen) if ((f as { kind: string }).kind === 'ult' || (f as { kind: string }).kind === 'skill') assert.equal((f as { ult?: Kit }).ult, kit)
  }
})

test('천지개벽: 발밑 둘레가 터지고, 줄이 가장 많이 걸리는 쪽으로 넓고 짧게 · 둘레 밖의 옆과 뒤와 먼 끝은 안 맞는다', () => {
  const s = field('axe', 360), area = areaScale(s), out = U.axe.burst * area + 40
  const row = [150, 280, 400].map(d => place(s, d, 0)), feet = place(s, -100, 50), side = place(s, 0, out), back = place(s, -out, 0), far = place(s, U.axe.length * area + 80, 0)
  const edge = place(s, 300, U.axe.width * area - 10)   // 넓은 반폭 안
  cast(s)
  for (const e of [...row, edge, feet]) assert.ok(Math.abs(hurt(e) - U.axe.damage * powerScale(s)) < 1e-6)
  for (const e of [side, back, far]) assert.equal(hurt(e), 0)
})

test('파천일섬: 화면 끝까지 꿰지만 줄은 좁다', () => {
  const s = field('bow', 100), area = areaScale(s)
  const row = [150, 450, 900].map(d => place(s, d, 0)), wide = place(s, 300, U.bow.width * area + 15), side = place(s, 0, 220)
  cast(s)
  for (const e of row) assert.ok(hurt(e) > 0, '먼 끝까지 꿴다')
  assert.equal(hurt(wide), 0, '도끼보다 좁다'); assert.equal(hurt(side), 0)
  assert.ok(U.bow.length > Math.hypot(C.width, C.height), '화면 대각선보다 길다')
})

test('용오름 창: 몸 둘레로 넓어지며 여러 번 솟는다 — 가까운 적은 여러 번 맞고 바깥으로 밀린다', () => {
  const s = field('spear'), area = areaScale(s), per = U.spear.damage * powerScale(s)
  const near = place(s, 90, 0, 'club'), ring = place(s, -(U.spear.r1 * area - 20), 0, 'iron'), out = place(s, 0, U.spear.r1 * area + 60, 'iron')
  cast(s)
  assert.ok(hurt(near) >= per * (U.spear.pulses - .01), `가까운 적은 솟을 때마다 (${hurt(near) / per})`)
  assert.ok(Math.abs(hurt(ring) - per) < 1e-6, '바깥 고리는 마지막 솟음 한 번')
  assert.equal(hurt(out), 0)
  assert.ok(Math.hypot(near.x - s.x, near.y - s.y) > 90 + U.spear.knock, '밀려남')
  assert.equal(s.ult, null)
})

test('섬광참: 장수가 실제로 내달리고 지나간 줄만 벤다 · 판 밖으로는 못 나간다', () => {
  const s = field('sword', 200), x0 = s.x
  const path = [120, 260, 400].map(d => place(s, d, 0)), side = place(s, 200, 260)
  cast(s)
  assert.ok(s.x - x0 > U.sword.length * areaScale(s) * .9, `옮겨 감 ${Math.round(s.x - x0)}`)
  for (const e of path) assert.ok(hurt(e) > 0); assert.equal(hurt(side), 0)
  const edge = field('sword', C.width - 60); place(edge, 40, 0); cast(edge, { x: 1, y: 0 })
  assert.ok(edge.x <= C.width - 32, '판 끝에서 멈춘다')
  const steer = field('sword'); const left = place(steer, -150, 0), right = [100, 200, 300].map(d => place(steer, d, 0))
  cast(steer, { x: -1, y: 0 })
  assert.ok(hurt(left) > 0 && right.every(e => hurt(e) === 0), '움직이는 쪽으로 내달린다 (적이 더 많은 뒤쪽이 아니라)')
})

test('환영난무: 가까운 적에게 차례로 순간 이동해 베고, 처음 자리로 돌아온다', () => {
  const s = field('dagger', 120), x0 = s.x, y0 = s.y
  const chain = Array.from({ length: U.dagger.targets }, (_, i) => place(s, 110 * (i + 1), 0)), extra = place(s, 110 * (U.dagger.targets + 1), 0)
  step(s, true); release(s)
  assert.ok(s.ult && Math.hypot(s.x - x0, s.y - y0) > 50, '베는 동안은 적 곁에 있다')
  for (let i = 0; i < 120 && s.ult; i++) step(s, false)
  for (const e of chain) assert.ok(Math.abs(hurt(e) - U.dagger.damage * powerScale(s)) < 1e-6)
  assert.equal(hurt(extra), 0, '벨 수만큼만')
  assert.deepEqual([s.x, s.y], [x0, y0])
  const lone = field('dagger'); cast(lone); assert.equal(lone.ult, null, '적이 없어도 끝난다')
})

test('천벌: 화면 어디에 있든 모든 적이 한 번씩 (한 대 피해는 가장 낮다)', () => {
  const s = field('magic')
  const all = [[-500, -280], [500, 300], [-20, 340], [480, -300], [60, 0]].map(([x, y]) => place(s, x!, y!))
  cast(s)
  for (const e of all) assert.ok(Math.abs(hurt(e) - U.magic.damage * powerScale(s)) < 1e-6)
  for (const k of ['axe', 'bow', 'spear', 'sword', 'dagger'] as const) assert.ok(U.magic.damage < U[k].damage)
})

test('비기 그림: 여섯 묶음 모두 그리다 깨지지 않고, 폰을 느리게 하는 filter·shadowBlur 를 쓰지 않는다', async () => {
  const { drawField, imagePaths } = await import('../src/raid/haebi-view.ts')
  const banned: string[] = [], draws: Record<string, number> = {}
  const store: Record<string | symbol, unknown> = { globalAlpha: 1, canvas: { width: C.width, height: C.height } }
  const ctx = new Proxy({}, {
    get: (_, k) => k in store ? store[k] : (..._a: unknown[]) => { draws[String(k)] = (draws[String(k)] ?? 0) + 1 },
    set: (_, k, v) => { if (k === 'filter' || k === 'shadowBlur') banned.push(String(k)); store[k] = v; return true },
  }) as unknown as CanvasRenderingContext2D
  const images = new Map(imagePaths.map(p => [p, { width: 5120, height: 256 } as HTMLImageElement]))
  for (const kit of KIT6) {
    const s = field(kit); for (let i = 0; i < 10; i++) place(s, 70 + i * 35, (i % 3 - 1) * 50, 'club')
    const before = draws['drawImage'] ?? 0
    step(s, true); for (let i = 0; i < 40; i++) { drawField(ctx, images, s, null); step(s, false) }
    assert.ok((draws['drawImage'] ?? 0) > before, kit)
  }
  assert.deepEqual(banned, [])
})

test('판은 평타만으로 시작한다 — 비기는 첫 레벨업에서 열리고 장수 둘레에 금빛 고리 · 시련도 같고 선봉은 처음부터 (11-19 형)', () => {
  const s = createHaebi(7, 'stage', 'sword'); s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9
  place(s, 120, 0, 'club')
  assert.equal(ultOpen(s), false, '1레벨은 잠김')
  stepHaebi(s, { ...idle, skill: true }, 1 / 120)
  assert.equal(s.cast, null, '잠긴 비기는 눌러도 시전이 안 선다'); assert.equal(s.skillCd, 0)
  s.xp = xpNeeded(s); stepHaebi(s, idle, 1 / 120); assert.ok(s.offers.length, '첫 레벨업 카드')
  assert.ok(choose(s, s.offers[0]!)); assert.equal(s.level, U.unlockLevel)
  assert.ok(ultOpen(s), '첫 레벨업에서 열림')
  assert.ok(s.fx.some(f => f.kind === 'ring' && f.r === U.unlockRing), '열리는 순간 금빛 고리')
  stepHaebi(s, { ...idle, skill: true }, 1 / 120); assert.equal((s as HaebiRun).cast?.kind, 'ult', '열린 뒤엔 누르면 시전')
  assert.equal(ultOpen(createHaebi(7, 'trial', 'sword')), false, '시련도 평타만으로 시작')
  assert.ok(ultOpen(createHaebi(7, 'vanguard', 'sword')), '선봉은 높은 레벨로 시작해 처음부터 열림')
})

test('봇 판: 같은 씨앗이면 비기가 열리는 때까지 같은 판 · 열리기 전엔 비기를 한 번도 안 쓴다', () => {
  for (const kit of ['sword', 'axe'] as Kit[]) {
    const a = replay(9, 150, 'storm', undefined, kit), b = replay(9, 150, 'storm', undefined, kit)
    assert.deepEqual(a, b, kit); assert.ok(a.level >= U.unlockLevel, `${kit} 2분 반이면 열린다`)
    const s = createHaebi(9, 'stage', kit); let early = 0
    while (s.state === 'playing' && !ultOpen(s)) { if (s.offers.length) choose(s, s.offers[0]!); else { stepHaebi(s, { x: Math.sin(s.t), y: Math.cos(s.t), skill: true }, 1 / 120); if (s.cast || s.skillCd) early++ } }
    assert.equal(early, 0, `${kit} 열리기 전 비기`)
  }
})
