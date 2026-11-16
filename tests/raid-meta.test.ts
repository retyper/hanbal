// 장수 열전 판 밖 성장 (11-16 형: 다이센카식 상점·스테이지·휘장)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_RUN as C, HAEBI_SHOP as SH } from '../src/tune/params.ts'
import { createHaebi, runGold, runDuration, stepHaebi, tierOf, spawnMob } from '../src/raid/haebi.ts'
import { loadMeta, buy, refund, record, shopCost, stageOpen } from '../src/raid/meta.ts'

test('상점: 사면 금이 줄고 다음 값이 오르며, 되돌리면 쓴 금을 전부 돌려받는다', () => {
  const m = loadMeta(); m.gold = 1000
  assert.ok(buy(m, 'might')); assert.equal(m.gold, 1000 - shopCost('might', 0)); assert.equal(m.shop.might, 1)
  assert.ok(shopCost('might', 1) > shopCost('might', 0))
  const left = m.gold; m.gold = 0; assert.equal(buy(m, 'might'), false, '금이 모자라면 못 산다'); m.gold = left
  refund(m); assert.equal(m.gold, 1000); assert.equal(m.shop.might, 0)
  m.gold = 1e9; for (let i = 0; i < 20; i++) buy(m, 'revive'); assert.equal(m.shop.revive, SH.revive.max)
})

test('스테이지: 앞을 깨야 다음이 열리고, 처음 깰 때만 휘장', () => {
  const m = loadMeta()
  assert.equal(stageOpen(m, 'forest'), true); assert.equal(stageOpen(m, 'ford'), false)
  assert.equal(record(m, 'forest', 100, false, 300).first, false); assert.equal(stageOpen(m, 'ford'), false)
  assert.equal(record(m, 'forest', 900, true, 1150).first, true); assert.equal(stageOpen(m, 'ford'), true)
  assert.equal(record(m, 'forest', 900, true, 1150).first, false, '두 번째 깸은 새 휘장 아님')
  assert.equal(m.gold, 1900); assert.equal(m.best.forest, 1150)
})

test('본편 잇기: 장수마다 깬 스테이지를 적고, 마지막 스테이지를 깬 장수가 진각성 자격', async () => {
  const { raidSealed, SEAL_STAGE, mergeRoster, loadRoster } = await import('../src/raid/link.ts')
  const store = new Map<string, string>()
  ;(globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } }
  try {
    const { saveMeta } = await import('../src/raid/meta.ts')
    const m = loadMeta()
    assert.equal(record(m, 'palisade', 0, false, 600, 'sr-aryeong').heroFirst, false, '지면 안 적는다')
    assert.equal(record(m, 'forest', 0, true, 1150, 'sr-aryeong').heroFirst, true)
    saveMeta(m); assert.deepEqual(raidSealed(), [], '앞 스테이지만으로는 아직')
    assert.equal(record(m, SEAL_STAGE, 0, true, 1150, 'sr-aryeong').heroFirst, true)
    assert.equal(record(m, SEAL_STAGE, 0, true, 1150, 'sr-aryeong').heroFirst, false, '두 번째는 처음이 아니다')
    saveMeta(m); assert.deepEqual(raidSealed(), ['sr-aryeong'])
    assert.deepEqual(loadMeta().heroes['sr-aryeong'], ['forest', SEAL_STAGE], '다시 읽어도 남는다')
    const h = { id: 'gj-heo', name: '허황옥', home: '가락의 장수', bust: 'l-L3-heo-hwangok', sprite: 'heo', kit: 'bow' as const, video: false }
    assert.equal(mergeRoster([h]), true); assert.equal(mergeRoster([h]), false, '같으면 안 쓴다')
    mergeRoster([{ ...h, id: 'other' }]); assert.deepEqual(loadRoster().map(x => x.id), ['gj-heo', 'other'], '한 번 모은 장수는 남는다')
  } finally { delete (globalThis as { localStorage?: unknown }).localStorage }
})

test('금: 다 깨면 중간 패배보다 훨씬 많이 · 시련·선봉은 금이 없다', () => {
  const lose = createHaebi(1, 'stage'); lose.t = 300; lose.kills = 800; lose.state = 'lost'
  const win = createHaebi(1, 'stage'); win.t = C.bossAt + 20; win.kills = 14000; win.elites = 7; win.state = 'won'
  assert.ok(runGold(win) > runGold(lose) * 8, `${runGold(win)} vs ${runGold(lose)}`)
  const ford = createHaebi(1, 'stage', 'axe', { stage: 'ford' }); Object.assign(ford, { t: win.t, kills: win.kills, elites: 7, state: 'won' })
  assert.ok(runGold(ford) > runGold(win), '어려운 스테이지가 더 준다')
  assert.equal(runGold(createHaebi(1, 'trial')), 0)
  assert.ok(runDuration(createHaebi(1, 'trial')) < runDuration(win), '본편 시련은 짧은 판')
})

test('적 단계: 토막마다 다른 적, 앞 토막 적은 다음 토막에 안 나온다', () => {
  const s = createHaebi(3, 'stage')
  const seen = (t: number) => { s.t = t; s.enemies = []; for (let i = 0; i < 60; i++) spawnMob(s); return new Set(s.enemies.map(e => e.kind)) }
  const first = seen(10), late = seen(C.bossAt - 5)
  assert.equal(tierOf(s), 4)
  assert.ok(first.has('club') && !first.has('iron'))
  assert.ok(!late.has('club') && !late.has('archer') && late.has('iron'))
})

test('부활: 쓰러지면 상점에서 산 만큼 다시 일어난다', () => {
  const s = createHaebi(5, 'stage', 'axe', { bonus: { revive: 1, vigor: 2 } })
  assert.equal(s.maxHp, C.health + 2 * SH.vigor.step)
  s.hp = -5; stepHaebi(s, { x: 0, y: 0 }, .01)
  assert.equal(s.state, 'playing'); assert.equal(s.revives, 0); assert.ok(s.hp > 0)
  s.hp = -5; s.inv = 0; stepHaebi(s, { x: 0, y: 0 }, .01); assert.equal(s.state, 'lost')
})

test('본편 각성 시련: 실제 시련 판으로 이긴 기록을 본편이 받아들인다', async () => {
  const { trialWinValid, bossTime } = await import('../src/raid/haebi.ts')
  const s = createHaebi(2, 'trial')
  assert.ok(trialWinValid(bossTime(s) + 5), '두목 뒤 이김')
  assert.ok(trialWinValid(runDuration(s)), '판 끝')
  assert.ok(!trialWinValid(bossTime(s) - 30), '두목 전')
  assert.ok(!trialWinValid(runDuration(s) + 30) && !trialWinValid('x') && !trialWinValid(NaN))
})

test('스테이지 다섯 (11-16 설원 고개·불타는 산성): 차례대로 열리고 뒤로 갈수록 어렵다', async () => {
  const { STAGE_ORDER } = await import('../src/raid/meta.ts')
  const { HAEBI_STAGES: ST } = await import('../src/tune/params.ts')
  assert.deepEqual([...STAGE_ORDER], ['forest', 'ford', 'palisade', 'snow', 'fortress'])
  const m = loadMeta()
  for (const id of ['ford', 'palisade', 'snow', 'fortress'] as const) assert.equal(stageOpen(m, id), false, id)
  record(m, 'forest', 0, true, 1150); record(m, 'ford', 0, true, 1150)
  assert.equal(stageOpen(m, 'snow'), false, '목책을 깨기 전엔 설원이 닫힘')
  record(m, 'palisade', 0, true, 1150)
  assert.equal(stageOpen(m, 'snow'), true); assert.equal(stageOpen(m, 'fortress'), false)
  record(m, 'snow', 0, false, 600); assert.equal(stageOpen(m, 'fortress'), false, '지면 안 열림')
  record(m, 'snow', 0, true, 1150); assert.equal(stageOpen(m, 'fortress'), true)
  for (let i = 1; i < STAGE_ORDER.length; i++) {
    const a = ST[STAGE_ORDER[i - 1]!], b = ST[STAGE_ORDER[i]!]
    for (const k of ['hp', 'damage', 'spawn', 'bossHp', 'gold'] as const) assert.ok(b[k] > a[k], `${STAGE_ORDER[i]} ${k}`)
  }
})

test('새 적: 범·곰·투창 사냥꾼은 설원에만, 횃불 방화꾼은 산성에만 나온다', async () => {
  const { STAGE_ORDER } = await import('../src/raid/meta.ts')
  const kinds = (stage: typeof STAGE_ORDER[number]) => {
    const s = createHaebi(9, 'stage', 'axe', { stage }), seen = new Set<string>()
    for (const t of [10, 300, 520, 760, 1000]) { s.t = t; s.enemies = []; for (let i = 0; i < 120; i++) spawnMob(s); for (const e of s.enemies) seen.add(e.kind) }
    return seen
  }
  for (const id of STAGE_ORDER) {
    const k = kinds(id)
    for (const beast of ['tiger', 'bear', 'hunter']) assert.equal(k.has(beast), id === 'snow', `${id} ${beast}`)
    assert.equal(k.has('torch'), id === 'fortress', `${id} torch`)
  }
  const trial = createHaebi(9, 'trial'); for (const t of [10, 200, 400]) { trial.t = t; for (let i = 0; i < 80; i++) spawnMob(trial) }
  assert.ok(!trial.enemies.some(e => ['tiger', 'bear', 'hunter', 'torch'].includes(e.kind)), '본편 시련엔 안 나온다')
})

test('새 적 몸짓: 범은 겨눴다 덮치고 · 곰은 내려치고 · 사냥꾼은 창을 던지고 · 방화꾼은 불바닥을 깐다', () => {
  const place = (stage: 'snow' | 'fortress', kind: 'tiger' | 'bear' | 'hunter' | 'torch', dx: number) => {
    const s = createHaebi(4, 'stage', 'axe', { stage }); s.ranks.axe = 0; s.nextBarrage = 1e9; s.spawn = 1e9; s.nextElite = 1e9
    spawnMob(s, kind); const e = s.enemies[0]!; e.x = s.x + dx; e.y = s.y; e.cd = 0; e.hp = e.max = 1e9
    return { s, e }
  }
  { const { s, e } = place('snow', 'tiger', 250); stepHaebi(s, { x: 0, y: 0 }, .01); assert.ok(e.act > 0, '겨눔')
    for (let i = 0; i < 60 && e.act >= 0; i++) stepHaebi(s, { x: 0, y: 0 }, .02); assert.ok(e.act < 0, '덮침') }
  { const { s, e } = place('snow', 'bear', 60); stepHaebi(s, { x: 0, y: 0 }, .01); assert.ok(e.wind > 0, '일어섬')
    const hp = s.hp; s.inv = 0; for (let i = 0; i < 60; i++) stepHaebi(s, { x: 0, y: 0 }, .02); assert.ok(s.hp < hp, '내려친 곳에 서 있으면 맞는다') }
  { const { s, e } = place('snow', 'hunter', 380); for (let i = 0; i < 60 && !s.shots.some(b => b.kind === 'hurl'); i++) stepHaebi(s, { x: 0, y: 0 }, .02)
    assert.ok(s.shots.some(b => b.kind === 'hurl'), '창을 던진다'); assert.ok(Math.abs(e.x - (s.x + 380)) < 1, '사거리 안에선 서서 던짐') }
  { const { s } = place('fortress', 'torch', 500); for (let i = 0; i < 100; i++) stepHaebi(s, { x: 0, y: 0 }, .02)
    assert.ok(s.shots.some(b => b.kind === 'flame'), '불바닥을 깐다') }
})
