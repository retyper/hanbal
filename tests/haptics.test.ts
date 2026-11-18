// 폰 떨림 한 곳 (11-19 형: 「피격될 때 햅틱 · 전투 승리하면 듀오링고처럼」) — 패턴 고름 · 끄기 · 진동 없는 기기 · 가려진 탭 · 연타 사이
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAPTICS as H } from '../src/tune/params.ts'
import { HAPTICS_KEY, hurtMs, makeHaptics, winPattern, type HapticEnv } from '../src/ui/haptics.ts'

function env(over: Partial<HapticEnv> & { saved?: Record<string, string> } = {}) {
  const calls: (number | number[])[] = [], saved = over.saved ?? {}
  let t = 0, hidden = false
  const e: HapticEnv = {
    vibrate: (p) => { calls.push(p); return true },
    hidden: () => hidden,
    store: () => ({ getItem: (k) => saved[k] ?? null, setItem: (k, v) => { saved[k] = v } }),
    now: () => t,
    ...over,
  }
  return { e, calls, saved, tick: (ms: number) => { t += ms }, hide: (v: boolean) => { hidden = v } }
}

test('맞은 몫이 클수록 길게 · 15~40ms 사이에 묶인다', () => {
  assert.equal(hurtMs(0), H.hurt[0])
  assert.equal(hurtMs(H.hurtFull), H.hurt[1])
  assert.equal(hurtMs(5), H.hurt[1])
  assert.equal(hurtMs(-1), H.hurt[0])
  assert.equal(hurtMs(Number.NaN), H.hurt[0])
  assert.ok(hurtMs(H.hurtFull / 2) > H.hurt[0] && hurtMs(H.hurtFull / 2) < H.hurt[1])
  assert.ok(H.hurt[0] >= 15 && H.hurt[1] <= 40)
})

test('이김은 다다닥 · 대승은 더 길게', () => {
  const w = makeHaptics(env().e), x = env(), h = makeHaptics(x.e)
  assert.ok(w.win())
  assert.ok(h.win(true))
  assert.deepEqual(x.calls[0], [...H.bigWin])
  assert.deepEqual([...winPattern()], [...H.win])
  assert.ok(H.win.length >= 7 && H.bigWin.reduce((a, b) => a + b, 0) > H.win.reduce((a, b) => a + b, 0))
})

test('맞음 연타는 hurtGap 사이를 둔다', () => {
  const x = env(), h = makeHaptics(x.e)
  assert.ok(h.hurt(.05))
  x.tick(H.hurtGap / 2)
  assert.equal(h.hurt(.05), false)
  x.tick(H.hurtGap)
  assert.ok(h.hurt(.2))
  assert.deepEqual(x.calls, [hurtMs(.05), H.hurt[1]])
})

test('끄기 — 기본은 켬 · 끄면 아무것도 안 낸다 · 다시 켜면 낸다', () => {
  const x = env(), h = makeHaptics(x.e)
  assert.ok(h.on())
  h.set(false)
  assert.equal(x.saved[HAPTICS_KEY], '0')
  assert.equal(h.on(), false)
  assert.equal(h.win(), false)
  assert.equal(h.hurt(1), false)
  assert.equal(h.buzz(8), false)
  h.set(true)
  assert.ok(h.buzz(8))
  assert.deepEqual(x.calls, [8])
})

test('진동이 없는 기기(아이폰 사파리)는 조용히 넘어간다', () => {
  const x = env({ vibrate: null }), h = makeHaptics(x.e)
  assert.equal(h.can(), false)
  assert.equal(h.win(), false)
  assert.equal(h.hurt(1), false)
})

test('가려진 탭·저장이 막힌 창·진동이 던지는 오류', () => {
  const x = env(), h = makeHaptics(x.e)
  x.hide(true)
  assert.equal(h.win(), false)
  assert.equal(x.calls.length, 0)
  // 저장이 막힌 창 — 켬으로 본다 · 끄기는 조용히 실패
  const blocked = makeHaptics({ ...env().e, store: () => { throw new Error('blocked') } })
  assert.ok(blocked.on())
  blocked.set(false)
  assert.ok(blocked.win())
  const boom = makeHaptics({ ...env().e, vibrate: () => { throw new Error('no') } })
  assert.equal(boom.win(), false)
})
