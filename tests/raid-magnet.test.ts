import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_RUN as C, HAEBI_SHOP as SH, HAEBI_WALL as WALL } from '../src/tune/params.ts'
import { createHaebi, magnetRadius, stepHaebi } from '../src/raid/haebi.ts'
import { buy, loadMeta, saveMeta, shopCost, shopMax, shopTotal, behindWall, pickStage, SHOP } from '../src/raid/meta.ts'
import { META_KEY } from '../src/raid/link.ts'

// 빨강 조건: 예전5단 상한이 남아 있으면 실패.
test('50-4 끌어오기 상한은10이고 기존 단계당.2는 그대로', () => {
  assert.equal(shopMax('magnet'), 10)
  assert.equal(SH.magnet.step, .2)
})

// 빨강 조건: 9단 이하에서 전체가 되거나10단에서도 대각선보다 짧으면 실패.
test('50-4 0~9단은 선형 반경, 마지막10단만 유한한 판 전체 반경', () => {
  for (let lv = 0; lv <= 9; lv++) {
    const r = magnetRadius(createHaebi(504, 'stage', 'axe', { bonus: { magnet: lv } }))
    assert.equal(r, C.dropMagnet * (1 + lv * SH.magnet.step))
    assert.ok(r < Math.hypot(C.width, C.height))
  }
  const full = magnetRadius(createHaebi(504, 'stage', 'axe', { bonus: { magnet: 10 } }))
  assert.equal(full, Math.hypot(C.width, C.height))
  assert.ok(Number.isFinite(full))
})

// 빨강 조건: 실제 stepHaebi에서 가장 먼 구석 기세가10단에서 오지 않거나9단에서 오면 실패.
test('50-4 실제 스텝의 먼 구석 기세는9단에서 머물고10단에서 수집됨', () => {
  for (const lv of [9, 10]) {
    const s = createHaebi(504, 'stage', 'axe', { bonus: { magnet: lv } })
    s.x = 24; s.y = 40; s.level = C.maxLevel; s.spawn = s.nextElite = s.nextBarrage = 1e9
    s.drops.push({ x: C.width - 24, y: C.height - 24, value: 7, age: 0 })
    for (let i = 0; i < 5 * 120; i++) stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
    if (lv === 9) {
      assert.equal(s.xp, 0); assert.equal(s.drops.length, 1)
      assert.equal(s.drops[0]!.x, C.width - 24); assert.equal(s.drops[0]!.y, C.height - 24)
    } else { assert.equal(s.xp, 7); assert.equal(s.drops.length, 0) }
  }
})

// 빨강 조건: 저장된5단을10단으로 승격하거나6~10단을 살 수 없거나10을 넘겨 사면 실패.
test('50-4 기존 저장5단 유지·6~10단 구매·저장 왕복·10단 상한', () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } } })
  try {
    store.set(META_KEY, JSON.stringify({ gold: 100000, spent: 1234, shop: { magnet: 5 }, cleared: { forest: true }, runs: 9 }))
    const m = loadMeta(); assert.equal(m.shop.magnet, 5); assert.equal(m.gold, 100000); assert.equal(m.spent, 1234); assert.equal(m.runs, 9)
    saveMeta(m); assert.equal(loadMeta().shop.magnet, 5)
    for (let lv = 5; lv < 10; lv++) {
      const before: number = m.gold, cost = shopCost('magnet', lv)
      assert.equal(buy(m, 'magnet'), true, `${lv}→${lv + 1} 구매`)
      assert.equal(m.shop.magnet, lv + 1); assert.equal(m.gold, before - cost)
    }
    const endGold = m.gold; assert.equal(buy(m, 'magnet'), false); assert.equal(m.gold, endGold)
    saveMeta(m); assert.deepEqual(loadMeta(), m)
  } finally { if (prior) Object.defineProperty(globalThis, 'localStorage', prior); else delete (globalThis as { localStorage?: unknown }).localStorage }
})

// 빨강 조건: 끝까지 찍은 상점 설명이 기존+200%만 보여 주면 실패.
test('50-4 마지막 상점 설명은 화면 전체라고 직접 알림', () => {
  const item = SHOP.find(x => x.key === 'magnet')!
  assert.match(item.desc(10), /화면 전체/)
  assert.equal(item.desc(5), '기세 줍는 거리 +100%')
  assert.doesNotMatch(item.desc(9), /화면 전체/)
})

test('50-4 전체 상점 총액은 늘어도 저장5단 계정의 모든 무기 추천 문턱은 그대로', () => {
  assert.equal(SH.magnet.recommendationCap, 5)
  assert.equal(shopTotal(), 42486); assert.equal(shopTotal(SH.magnet.recommendationCap), 37335)
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } } })
  try {
    for (const kit of ['axe', 'sword', 'spear', 'magic', 'sling', 'bow', 'dagger'] as const) {
      const legacyThreshold = Math.ceil(37335 * WALL.shop[kit])
      for (const spent of [legacyThreshold - 1, legacyThreshold]) {
        store.set(META_KEY, JSON.stringify({ gold: 3333, spent, shop: { magnet: 5 }, cleared: { forest: true, ford: true }, runs: 4 }))
        const m = loadMeta(), snapshot = JSON.stringify(m), wall = spent < legacyThreshold
        assert.equal(m.shop.magnet, 5); assert.equal(m.spent, spent)
        assert.equal(behindWall(m, 'palisade', kit), wall, `${kit} 저장된 금 ${spent}`)
        assert.equal(pickStage(m, kit), wall ? 'ford' : 'palisade', `${kit} 기존 추천`)
        assert.equal(JSON.stringify(m), snapshot, '추천 계산이 저장 계정을 바꾸지 않음')
      }
    }
  } finally { if (prior) Object.defineProperty(globalThis, 'localStorage', prior); else delete (globalThis as { localStorage?: unknown }).localStorage }
})
