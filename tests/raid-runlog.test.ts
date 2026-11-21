// 열전 판 기록 (11-19 형: 「열전 플레이데이터도 받고 있지?」) — 적은 기록(씨앗 + 판 옵션 + 입력)으로 판을 다시 돌리면 같은 판이 나온다 (A1)
// · 확대 카메라는 판을 건드리지 않는다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_RUN as C, HAEBI_ZOOM as Z } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, reroll, championViewNeeded, type HaebiRun } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, gridInput, recPick, recReroll, recQuit, withdrawRun, finishRecord, replayRaid, STEP } from '../src/raid/runlog.ts'
import { loadRaidGames, putRaidGame, sealLeftovers, unsentRaids, markRaidsSent, saveRaidGames, type RaidOpts } from '../src/raid/runlog-store.ts'
import { newCam, followCam, nextLevel, closest, clampCenter, toField, fieldView } from '../src/raid/camera.ts'

const hash = (s: HaebiRun) => JSON.stringify(s)

/** 화면(raid-main)처럼 판을 돌리며 적는다 — 봇이 사람 대신 움직이고 카드를 고른다 · 두 번째 레벨업에서 한 번 다시 고른다 */
function play(seed: number, until: number, opts: RaidOpts, quitAt = Infinity, onStep?: (s: HaebiRun) => void) {
  const s = createHaebi(seed, 'stage', 'sword', opts)
  const r = startRecord(s, { id: 't-' + seed, started: '2026-11-19T00:00:00.000Z', mode: 'stage', stage: s.stage, hero: 'haebi', kit: 'sword', sprite: 'haebi', seed, opts, from: { via: 'campaign', game: 42, turn: 7 } })
  let rerolled = false
  while (s.t < until && s.state === 'playing') {
    if (s.t >= quitAt) { recQuit(r); withdrawRun(s); break }
    if (s.offers.length) {
      if (!rerolled && s.level >= 2 && reroll(s)) { recReroll(r); rerolled = true; continue }
      const pick = botChoice(s, 'spread'); if (choose(s, pick)) recPick(r, pick)
      continue
    }
    stepHaebi(s, recInput(r, botInput(s, .45)), STEP)
    onStep?.(s)
  }
  return { s, r }
}

test('판 기록: 씨앗 + 판 옵션 + 입력으로 다시 돌리면 같은 판이 나온다 (결정론)', () => {
  const opts: RaidOpts = { stage: 'forest', bonus: { might: 2, vigor: 1 }, awaken: true, mastery: false }
  const { s, r } = play(20261119, 150, opts)
  const g = finishRecord(r, 123, '2026-11-19T00:03:00.000Z')
  assert.ok(g.picks.length >= 2, `카드를 고른 차례가 적힌다 (${g.picks.length})`)
  assert.ok(g.input.includes('!'), '다시 고르기가 적힌다')
  assert.ok(g.input.length > 0 && g.steps > 0)
  assert.equal(g.end?.gold, 123); assert.equal(g.from?.game, 42); assert.equal(g.from?.turn, 7)
  // 기기 칸을 거쳐(JSON) 읽어도 같다
  const back = JSON.parse(JSON.stringify(g)) as typeof g
  const again = replayRaid(back)
  assert.equal(again.t, s.t); assert.equal(again.kills, s.kills); assert.equal(again.level, s.level)
  assert.equal(hash(again), hash(s), '판 상태 전체가 같다')
})

test('판 기록: 물러남도 그대로 다시 돌아가고 결과는 quit', () => {
  const { s, r } = play(7, 200, { stage: 'forest', awaken: false, mastery: false }, 40)
  const g = finishRecord(r, 0, 'x')
  assert.equal(g.end?.result, 'quit'); assert.equal(s.state, 'lost')
  assert.equal(hash(replayRaid(g)), hash(s))
})

test('53B withdrawal expires ground/opened chests and clears pending choice without paying gold', () => {
  for (const state of ['ground', 'opened'] as const) {
    const s = createHaebi(53, 'stage', 'axe')
    s.chests!.push({ id: 1, eliteId: 9, x: s.x, y: s.y, bornAt: 0, state, choicesRemaining: 2, gold: 12, large: true })
    s.choiceOrigin = 'chest'; s.chestChoice = { id: 1, left: 2, nonce: 1 }; s.offers = ['axe']
    s.chestGold = state === 'opened' ? 12 : 0
    const gold = s.chestGold; withdrawRun(s)
    assert.equal(s.state, 'lost'); assert.equal(s.chests![0]!.state, 'expired'); assert.equal(s.chestChoice, undefined)
    assert.deepEqual(s.offers, []); assert.equal(s.choiceOrigin, 'level'); assert.equal(s.chestGold, gold); assert.equal(choose(s, 'axe', 1), false)
  }
})

test('53B camera-edge birth input is quantized, recorded and replays the entire encounter state', () => {
  const s = createHaebi(7, 'stage', 'sword', { stage: 'forest' }), cam = newCam(2)
  const r = startRecord(s, { id: 'view53', started: 'x', mode: s.mode, stage: s.stage, hero: 'h', kit: s.kit, sprite: 'haebi', seed: 7, opts: { stage: 'forest' }, from: null })
  while (s.t < 150 && s.state === 'playing') {
    if (s.offers.length) { const pick = botChoice(s, 'spread'); assert.equal(choose(s, pick), true); recPick(r, pick); continue }
    followCam(cam, s.x, s.y, STEP)
    const input = { ...botInput(s, .5), ...(championViewNeeded(s, STEP) ? { viewBounds: fieldView(cam) } : {}) }
    const actual = recInput(r, input)
    if (actual.viewBounds) assert.ok(Object.values(actual.viewBounds).every(n => n % 8 === 0))
    stepHaebi(s, actual, STEP)
  }
  const g = finishRecord(r, 0, 'x')
  assert.equal(g.rules, '53B'); assert.ok(g.input.includes('|'), 'real scheduled elite birth recorded a viewport')
  assert.ok(s.enemies.some(e => e.champion) || s.elites > 0)
  assert.equal(hash(replayRaid(JSON.parse(JSON.stringify(g)))), hash(s), 'phase, fixed aim, RNG and chest lifecycle are identical')
})

test('53B malformed view inputs fall back safely and old no-view records still parse', () => {
  for (const viewBounds of [{ left: NaN, top: 0, right: 1000, bottom: 700 }, { left: 1, top: 1, right: 2, bottom: 2 }]) {
    const q = gridInput({ x: 0, y: 0, viewBounds })
    assert.deepEqual(q.viewBounds, { left: 0, top: 0, right: C.width, bottom: C.height })
  }
  const { s, r } = play(11, 30, { stage: 'forest' }), g = finishRecord(r, 0, 'x')
  delete (g as { rules?: string }).rules
  assert.ok(!g.input.includes('|')); assert.equal(hash(replayRaid(g)), hash(s))
  const malformed = { ...g, input: '0,0,0,0|1,2,3 NaN,0,0,0|oops 1' }
  assert.doesNotThrow(() => replayRaid(malformed))
})

test('판 기록: 쓰러지면 까닭(fell)과 둘레의 적을 적는다', () => {
  const s0 = createHaebi(3, 'stage', 'axe', {}), r = startRecord(s0, { id: 'f', started: 'x', mode: 'stage', stage: 'forest', hero: 'h', kit: 'axe', sprite: 'haebi', seed: 3, opts: {}, from: null })
  s0.hp = 0; s0.state = 'lost'; s0.enemies.push({ id: 1, x: s0.x + 20, y: s0.y, hp: 1, max: 1, kind: 'dog', cd: 0, flash: 0, wind: 0, aimX: 0, aimY: 0, act: 0, vx: 0, vy: 0, buff: 0, poison: 0, pdps: 0, daze: 0 })
  const g = finishRecord(r, 5, 'x')
  assert.equal(g.end?.result, 'lost'); assert.equal(g.end?.why, 'fell'); assert.deepEqual(g.end?.near, ['dog'])
})

test('기기 칸: 넣고 · 판 가운데 닫힌 판은 떠남으로 · 올린 판 표시 · 넘치면 오래된 입력부터 던다', () => {
  const store = new Map<string, string>()
  const ls = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } }
  const had = (globalThis as { localStorage?: unknown }).localStorage
  Object.assign(globalThis, { localStorage: ls })
  try {
    const { r } = play(11, 30, { stage: 'forest' })
    r.g.snap = { t: 30, level: 2, kills: 9, hp: 100 }
    putRaidGame(r.g)
    assert.equal(loadRaidGames().length, 1); assert.equal(unsentRaids().length, 0, '끝나지 않은 판은 안 올린다')
    sealLeftovers('later')
    const [left] = loadRaidGames()
    assert.equal(left?.end?.result, 'left'); assert.equal(left?.end?.kills, 9)
    assert.equal(unsentRaids().length, 1)
    markRaidsSent([left!.id]); assert.equal(unsentRaids().length, 0)
    // 넘침: 큰 입력 판 여럿 — 마지막 판의 입력은 남는다
    const big = 'a'.repeat(400_000)
    saveRaidGames([1, 2, 3, 4].map((i) => ({ ...left!, id: 'b' + i, input: big })))
    const after = loadRaidGames()
    assert.equal(after.at(-1)?.input, big, '지금 판(마지막)은 입력을 남긴다')
    assert.ok(after.some((g) => g.cut), '오래된 판의 입력부터 덜어 낸다')
  } finally {
    Object.assign(globalThis, { localStorage: had })
  }
})

test('확대 카메라: 판을 건드리지 않는다 (같은 판 해시) · 세 단계 순환 · 판 밖이 보이지 않는다', () => {
  const plain = play(5, 60, { stage: 'forest' }).s
  const cam = newCam(0)
  let n = 0
  const zoomed = play(5, 60, { stage: 'forest' }, Infinity, (s) => { if (++n % 900 === 0) cam.level = nextLevel(cam.level); followCam(cam, s.x, s.y, 1 / 60) }).s
  assert.equal(hash(zoomed), hash(plain), '카메라를 돌려도 판은 같다')
  assert.deepEqual([0, 1, 2].map(nextLevel), [1, 2, 0]); assert.deepEqual([0, 1, 2].map(closest), [false, false, true])
  assert.deepEqual(Z.levels.slice(), [1, 1.35, 1.8])
  // 가장 가까이 · 장수가 왼쪽 위 끝 → 가운데는 가장자리에서 멈춘다
  const c = newCam(2); followCam(c, 0, 0, 0, true)
  assert.equal(c.zoom, 1.8)
  const left = c.x - C.width / 2 / c.zoom, top = c.y - C.height / 2 / c.zoom
  assert.ok(Math.abs(left) < 1e-9 && Math.abs(top) < 1e-9, '판 밖(음수 자리)이 보이지 않는다')
  // 판 가운데에서는 장수가 화면 가운데
  const m = newCam(2); followCam(m, C.width / 2 + 50, C.height / 2 - 30, 0, true)
  assert.deepEqual(toField(m, C.width / 2, C.height / 2), { x: C.width / 2 + 50, y: C.height / 2 - 30 })
  // 1배면 카메라는 판 한가운데 그대로
  const one = newCam(0); followCam(one, 10, 10, 0, true)
  assert.deepEqual({ x: one.x, y: one.y }, clampCenter(1, 0, 0))
  assert.deepEqual(toField(one, 100, 200), { x: 100, y: 200 })
})
