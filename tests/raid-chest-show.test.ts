// 60-JACKPOT 보물 상자 연출 차례표 · 엽전 · 장수 기록 (src/raid/chest-show.ts · meta.ts) — 화면 쪽의 순수한 셈만 잰다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_JACKPOT as JP, UI_FLY } from '../src/tune/params.ts'
import { chestShowPlan, coinCount, coinSpecs, showTier } from '../src/raid/chest-show.ts'
import { loadMeta, heroJackpots, recordJackpots } from '../src/raid/meta.ts'
import { ko } from '../src/i18n/ko.ts'
import { en } from '../src/i18n/en.ts'

const V = JP.view, LAND = (UI_FLY.popMs + UI_FLY.flyMs) / 1000

test('단계 번호: 1·3·5·8개가 0~3 · 표에 없는 수는 아래 단계', () => {
  assert.deepEqual(JP.counts.map(showTier), [0, 1, 2, 3])
  assert.equal(showTier(2), 0); assert.equal(showTier(4), 1); assert.equal(showTier(7), 2); assert.equal(showTier(12), 3); assert.equal(showTier(0), 0)
})

test('연출 길이는 단계마다 3 · 5 · 8 · 12초이고 단계마다 길어진다', () => {
  const totals = JP.counts.map(n => chestShowPlan(n, n).total)
  totals.forEach((t, i) => assert.ok(Math.abs(t - V.seconds[i]!) < .05, `${JP.counts[i]}개 ${t}초`))
  assert.deepEqual([...totals].sort((a, b) => a - b), totals)
  assert.deepEqual([...V.seconds], [3, 5, 8, 12])
})

test('차례: 들썩임(빨라진다) → 터짐 → 룬이 하나씩 솟고 날아감 → 끝 · 마지막 룬은 끝 여운 전에 박힌다', () => {
  for (const n of JP.counts) {
    const plan = chestShowPlan(n, n), ev = plan.events
    assert.deepEqual([...ev].sort((a, b) => a.at - b.at), ev, '때 차례대로')
    const shakes = ev.filter(e => e.kind === 'shake'), burst = ev.find(e => e.kind === 'burst')!, runes = ev.filter(e => e.kind === 'rune'), flies = ev.filter(e => e.kind === 'fly')
    assert.equal(shakes.length, V.shakes); assert.equal(runes.length, n); assert.equal(flies.length, n); assert.equal(ev[ev.length - 1]!.kind, 'end')
    const gaps = shakes.slice(1).map((s, i) => s.at - shakes[i]!.at)
    assert.ok(gaps.every((g, i) => i === 0 || g < gaps[i - 1]!), '들썩임이 빨라진다')
    assert.ok(shakes.every(s => s.at < burst.at)); assert.equal(burst.at, plan.burstAt)
    assert.ok(runes.every(r => r.at >= burst.at + V.burstHold - 1e-9), '룬은 터진 뒤에')
    for (let i = 0; i < n; i++) assert.ok(flies[i]!.at - runes[i]!.at >= V.runeHold - 1e-9, '솟은 룬이 잠깐 머문다')
    for (let i = 1; i < n; i++) assert.ok(runes[i]!.at - runes[i - 1]!.at >= V.runeGapMin - 1e-9, '하나씩')
    assert.ok(flies[n - 1]!.at + LAND <= plan.total - V.tail + 1e-9, '마지막 룬이 박힌 뒤 여운이 남는다')
  }
})

test('8개(대박)만 멎는다 — 터지기 전 들썩이는 중에 · 나머지 단계에는 멎음이 없다', () => {
  for (const n of JP.counts) {
    const plan = chestShowPlan(n, n), freeze = plan.events.find(e => e.kind === 'freeze')
    assert.equal(plan.freeze, n === 8); assert.equal(freeze !== undefined, n === 8)
    if (freeze) { assert.ok(freeze.at < plan.burstAt); assert.ok(freeze.at > V.enter) }
  }
  assert.ok(V.pushSeconds === 2.5, '「눌러!」를 안 눌러도 2.5초 뒤에 터진다')
})

test('새로 연 조합은 합쳐지는 컷만큼 더 머물고 · 올릴 칸이 없던 상자(룬 0)도 끝난다', () => {
  const plain = chestShowPlan(3, 3), merged = chestShowPlan(3, 3, [0])
  const hold = (p: typeof plain, i: number) => p.events.find(e => e.kind === 'fly' && e.index === i)!.at - p.events.find(e => e.kind === 'rune' && e.index === i)!.at
  assert.ok(Math.abs(hold(merged, 0) - hold(plain, 0) - V.mergeSeconds) < 1e-9)
  assert.equal(merged.events.filter(e => e.kind === 'rune' && e.merge).length, 1)
  const empty = chestShowPlan(5, 0)
  assert.equal(empty.events.filter(e => e.kind === 'rune').length, 0); assert.equal(empty.events[empty.events.length - 1]!.kind, 'end'); assert.ok(empty.total >= V.seconds[2])
})

test('엽전은 낱낱이 — 단계마다 알 수가 늘고 · 저사양은 줄고 · 알마다 길이 다르다 (늘 같은 꼴)', () => {
  const counts = JP.counts.map((_, i) => coinCount(i, false))
  assert.deepEqual([...counts].sort((a, b) => a - b), counts)
  for (let i = 0; i < 4; i++) { assert.ok(coinCount(i, true) < coinCount(i, false)); assert.ok(coinCount(i, true) >= 1) }
  const coins = coinSpecs(48)
  assert.equal(coins.length, 48); assert.deepEqual(coinSpecs(48), coins)
  assert.ok(new Set(coins.map(c => c.dx.toFixed(2))).size > 40, '알마다 다른 쪽으로')
  for (const c of coins) { assert.ok(Math.abs(c.dx) <= V.coinSpread); assert.ok(c.rise > 0 && c.rise <= V.coinRise); assert.ok(c.size >= V.coinSize[0] && c.size <= V.coinSize[1]); assert.ok(c.ms >= V.coinMs[0] && c.ms <= V.coinMs[1]) }
})

test('빛 색은 단계마다 다르다 (본편 유물 상자의 세 색 + 대박 보라) · 일장기 결의 빨강은 쓰지 않는다', () => {
  assert.equal(new Set(V.colors).size, 4)
  assert.deepEqual(V.colors.slice(0, 3), ['#e0a85a', '#7ac0ff', '#ffd27a'])
  for (const c of V.colors) { const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); assert.ok(!(r > 200 && g < 110 && b < 110), c) }
})

test('장수마다 상자 대박 기록: 5개·8개 번수를 더해 적고 · 깨진 값은 0 으로 읽는다', () => {
  const m = loadMeta()
  assert.deepEqual(heroJackpots(m, 'haebi'), { five: 0, eight: 0 })
  recordJackpots(m, 'haebi', 0, 0); assert.equal(m.jackpots['haebi'], undefined, '없으면 칸도 안 만든다')
  recordJackpots(m, 'haebi', 2, 1); recordJackpots(m, 'haebi', 1, 0); recordJackpots(m, 'ara', 0, 1)
  assert.deepEqual(heroJackpots(m, 'haebi'), { five: 3, eight: 1 }); assert.deepEqual(heroJackpots(m, 'ara'), { five: 0, eight: 1 })
  // 저장 칸에서 읽을 때 — 옛 저장(칸 없음)과 깨진 값
  const store = new Map<string, string>(), g = globalThis as { localStorage?: unknown }, had = g.localStorage
  g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } }
  try {
    store.set('hanbal.raid.meta', JSON.stringify({ gold: 5, heroes: {} }))
    assert.deepEqual(loadMeta().jackpots, {})
    store.set('hanbal.raid.meta', JSON.stringify({ gold: 5, jackpots: { haebi: { five: 3.7, eight: -2 }, bad: 7, ara: { five: 'x' } } }))
    assert.deepEqual(loadMeta().jackpots, { haebi: { five: 3, eight: 0 }, ara: { five: 0, eight: 0 } })
  } finally { if (had === undefined) delete g.localStorage; else g.localStorage = had }
})

test('연출 위의 글은 「눌러!」 하나 · 확률 글은 두 말 모두 있다', () => {
  assert.equal(ko['raid.chest.push'], '눌러!'); assert.equal(en['raid.chest.push'], 'PUSH!')
  for (const k of Object.keys(ko).filter(k => k.startsWith('raid.chest.')) as (keyof typeof ko)[]) assert.ok(en[k], k)
})
