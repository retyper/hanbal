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
