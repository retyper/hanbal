// 열전 기술·크리티컬 소리와 진동 계단 (11-19 형: 「기술 쓸 때 사운드랑 햅틱 · 크리티컬은 핑 · 초반 사운드 너무 심하면 안 됨 · 진각성은 더 임팩트」)
// 비기 < 각성 비기 < 진각성 비기 · 크리티컬 핑(한 프레임 한 번 · 틈) · 소리 수 한도 · 진동 끄기 · 가려진 탭 · 판 해시 그대로(결정론)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_SOUND as V, HAEBI_FEEL_TIERS as F, HAEBI_ULT as U, type FeelTier } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, spawnMob, choose, type Effect } from '../src/raid/haebi.ts'
import { makeHaptics, skillPattern, type HapticEnv } from '../src/ui/haptics.ts'

/** 가짜 소리판 — 합성 소리 하나(voice)마다 크기(첫 오름)와 사인 높이들, 파일 소리마다 크기를 적는다 */
type Synth = { vol: number; hz: number[]; end: (() => void) | null }
const synths: Synth[] = [], files: number[] = []
let clock = 0, hidden = false, lastSet = 0
const FAKE_BUF = { fake: true, duration: 1, sampleRate: 8000, getChannelData: () => Float32Array.of(1) }
const node = () => ({ connect: (x: unknown) => x, disconnect: () => undefined })
const param = (onRamp?: (v: number) => void) => {
  let v = 0
  return { get value() { return v }, set value(x: number) { v = x; lastSet = x }, setValueAtTime: () => undefined, linearRampToValueAtTime: (x: number) => onRamp?.(x), exponentialRampToValueAtTime: () => undefined }
}
const plain = () => ({ value: 0, setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined })
class FakeCtx {
  sampleRate = 8000; destination = {}
  get currentTime() { return clock }
  resume() { return Promise.resolve() }
  createGain() { return { ...node(), gain: param((x) => { if (x > 0) synths.push({ vol: x, hz: [], end: null }) }) } }
  createBiquadFilter() { return { ...node(), type: '', frequency: plain() } }
  createDynamicsCompressor() { return { ...node(), threshold: plain(), ratio: plain() } }
  createBuffer(_c: number, len: number) { return { getChannelData: () => new Float32Array(len) } }
  createBufferSource() {
    const b = { ...node(), buffer: null as unknown, playbackRate: plain(), onended: null as (() => void) | null, stop() {},
      start() { if ((b.buffer as { fake?: boolean } | null)?.fake) files.push(lastSet); else { const v = synths[synths.length - 1]; if (v && !v.end) v.end = () => b.onended?.() } } }
    return b
  }
  createOscillator() {
    const o = { ...node(), type: '', hz: 0, onended: null as (() => void) | null, stop() {},
      start() { const v = synths[synths.length - 1]!; v.hz.push(o.hz); if (!v.end) v.end = () => o.onended?.() },
      frequency: { value: 0, setValueAtTime: (x: number) => { if (!o.hz) o.hz = x }, exponentialRampToValueAtTime: () => undefined } }
    return o
  }
  decodeAudioData() { return Promise.resolve(FAKE_BUF) }
}
const g = globalThis as Record<string, unknown>
g['fetch'] = () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })
g['location'] = { search: '' }
g['document'] = { get hidden() { return hidden } }
g['localStorage'] = { getItem: () => null, setItem: () => undefined }
g['AudioContext'] = FakeCtx
g['Audio'] = class { loop = false; preload = ''; paused = true; volume = 1; play() { return Promise.resolve() } pause() {} }
const { raidSound, tierLoud } = await import('../src/raid/sound.ts')

const TIERS: FeelTier[] = ['skill', 'awake', 'true']
const fxOf = (kind: Effect['kind'], extra: Partial<Effect> = {}): Effect => ({ x: 0, y: 0, x2: 0, y2: 0, r: 0, angle: 0, life: .3, total: .3, kind, color: '', ...extra })
async function fresh(trueWake = false) {
  synths.length = 0; files.length = 0; clock = 1; hidden = false
  const snd = raidSound(false, 'bow', () => trueWake); snd.unlock(); await snd.ready()
  const s = createHaebi(7, 'stage', 'bow')
  snd.frame(s, true, false)   // 첫 프레임 = 기준
  synths.length = 0; files.length = 0
  return { snd, s }
}
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

test('계단 값 — 소리 크기·진동 길이·박 수가 비기 < 각성 < 진각성 · 크리티컬은 「둑」보다 크고 비기보다 작다', () => {
  const loud = TIERS.map(tierLoud), buzz = TIERS.map(t => sum(skillPattern(t))), beats = TIERS.map(t => Math.ceil(skillPattern(t).length / 2))
  for (let i = 1; i < 3; i++) { assert.ok(loud[i]! > loud[i - 1]!, `크기 ${TIERS[i]}`); assert.ok(buzz[i]! > buzz[i - 1]!, `진동 ${TIERS[i]}`) }
  assert.deepEqual(beats, [1, 2, 3])
  for (const k of ['cast', 'hit', 'boom', 'tail'] as const) for (let i = 1; i < 3; i++) assert.ok(F.tiers[TIERS[i]!][k] >= F.tiers[TIERS[i - 1]!][k], `${k} 가 계단을 거스름`)
  assert.equal(F.tiers.skill.boom, 0); assert.equal(F.tiers.skill.tail, 0); assert.equal(F.tiers.awake.tail, 0)
  // 비기는 예전(skill_hit .6 하나)보다 크지 않다 — 형: 「초반 사운드 너무 심하면 안 됨」
  assert.ok(F.tiers.skill.hit < V.skillHit && tierLoud('skill') <= V.skillHit + .05)
  assert.ok(F.crit.ping < tierLoud('skill') && F.crit.ping < F.tiers.skill.hit)
  assert.ok(F.crit.hz > V.thudHz[0] * 10 && F.crit.ms < F.tiers.awake.boomMs)   // 「둑」(85~150Hz)과 귀로 갈리는 높은 쇳소리 · 짧게
  assert.ok(F.crit.buzz < skillPattern('skill')[0]!)
})

test('비기가 터지면 계단마다 크게 — 울림은 각성부터 · 종 꼬리는 진각성만 · 사건으로 돌려준다', async () => {
  const total: number[] = []
  for (const tier of TIERS) {
    const { snd, s } = await fresh(tier === 'true')
    s.fx.push(fxOf('skill', tier === 'skill' ? {} : { tru: true }))
    const ev = snd.frame(s, true, false)
    assert.equal(ev.skill, tier)
    const hz = synths.flatMap(v => v.hz)
    assert.equal(hz.includes(F.boomHz[0]), tier !== 'skill', `${tier} 울림`)
    assert.equal(hz.includes(F.tailHz), tier === 'true', `${tier} 종 꼬리`)
    assert.ok(near(files[0]!, F.tiers[tier].hit))
    total.push(sum(synths.map(v => v.vol)) + sum(files))
    assert.ok(near(total[total.length - 1]!, tierLoud(tier) - F.tiers[tier].cast), tier)
  }
  assert.ok(total[0]! < total[1]! && total[1]! < total[2]!)
})

test('비기를 누르면 기합(그대로) + 계단마다 「탁」', async () => {
  for (const tier of TIERS) {
    const { snd, s } = await fresh(tier === 'true')
    s.skillCd = 5; s.cast = { kind: 'ult', t: U.cast, total: U.cast, tru: tier !== 'skill' }
    const ev = snd.frame(s, true, false)
    assert.equal(ev.cast, tier)
    const tick = synths.find(v => v.hz[0] === F.castHz)
    assert.ok(tick && near(tick.vol, F.tiers[tier].cast), tier)
    assert.ok(files.some(f => near(f, V.skill)), '기합 목소리 크기 그대로')
  }
})

test('크리티컬 「핑」 — 여럿이 몰려도 한 프레임 한 번 · crit.gap 안엔 다시 안 남', async () => {
  const { snd, s } = await fresh()
  const pings = () => synths.filter(v => v.hz[0] === F.crit.hz).length
  const crits = (n: number) => { for (let i = 0; i < n; i++) s.fx.push(fxOf('hit', { n: 30, crit: true })) }
  crits(6); assert.equal(snd.frame(s, true, false).crit, true)
  assert.equal(pings(), 1)
  const ping = synths.find(v => v.hz[0] === F.crit.hz)!
  assert.ok(near(ping.vol, F.crit.ping) && ping.hz.length === F.pingRatios.length)
  clock += F.crit.gap / 2; crits(3); assert.equal(snd.frame(s, true, false).crit, true)
  assert.equal(pings(), 1)
  clock += F.crit.gap; crits(1); snd.frame(s, true, false)
  assert.equal(pings(), 2)
  s.fx.push(fxOf('hit', { n: 30 })); clock += 1
  assert.equal(snd.frame(s, true, false).crit, false)   // 크리티컬이 아닌 맞음은 핑이 없다
  assert.equal(pings(), 2)
})

test('소리 수 한도 — 다 차면 핑은 건너뛰고, 기술 소리만 reserve 개까지 더 난다', async () => {
  const { snd, s } = await fresh(true)
  for (let i = 0; i < V.maxVoices * 3; i++) { s.fx.push(fxOf('hit', { n: 20 })); clock += V.thudGap * 1.01; snd.frame(s, true, false) }
  assert.equal(synths.length, V.maxVoices)
  s.fx.push(fxOf('hit', { n: 20, crit: true })); clock += 1; snd.frame(s, true, false)
  assert.equal(synths.filter(v => v.hz[0] === F.crit.hz).length, 0)
  s.fx.push(fxOf('skill', { tru: true })); clock += 1; snd.frame(s, true, false)
  const hz = synths.flatMap(v => v.hz)
  assert.ok(hz.includes(F.boomHz[0]) && hz.includes(F.tailHz))
  assert.ok(synths.length + files.length <= V.maxVoices + F.reserve)
})

test('가려진 탭 — 소리 0 · 진동 0번 (사건은 돌려주되 떨지 않는다)', async () => {
  const { snd, s } = await fresh(true)
  hidden = true
  s.skillCd = 5; s.cast = { kind: 'ult', t: U.cast, total: U.cast, tru: true }
  s.fx.push(fxOf('skill', { tru: true }), fxOf('hit', { n: 9, crit: true }))
  const ev = snd.frame(s, true, false)
  assert.equal(synths.length + files.length, 0)
  const calls: unknown[] = [], h = makeHaptics({ vibrate: (p) => { calls.push(p); return true }, hidden: () => true, store: () => null, now: () => 0 })
  if (ev.skill) h.skill(ev.skill)
  assert.equal(h.crit(), false)
  assert.equal(calls.length, 0)
})

function hapticEnv() {
  const calls: (number | number[])[] = [], saved: Record<string, string> = {}
  let t = 0
  const e: HapticEnv = { vibrate: (p) => { calls.push(p); return true }, hidden: () => false, store: () => ({ getItem: (k) => saved[k] ?? null, setItem: (k, v) => { saved[k] = v } }), now: () => t }
  return { e, calls, tick: (ms: number) => { t += ms } }
}

test('진동 — 계단 패턴 · 크리티컬은 buzzGap 사이 · 기술 떨림 도는 중엔 크리티컬이 끊지 않음 · 끄면 모두 꺼짐', () => {
  const x = hapticEnv(), h = makeHaptics(x.e)
  for (const t of TIERS) { assert.ok(h.skill(t)); x.tick(5000) }
  assert.deepEqual(x.calls, TIERS.map(t => [...skillPattern(t)]))
  x.calls.length = 0
  assert.ok(h.crit())
  x.tick(F.crit.buzzGap / 2); assert.equal(h.crit(), false)
  x.tick(F.crit.buzzGap); assert.ok(h.crit())
  assert.deepEqual(x.calls, [F.crit.buzz, F.crit.buzz])
  x.tick(5000); h.skill('true'); x.tick(sum(skillPattern('true')) - 1)
  assert.equal(h.crit(), false)                      // 진각성 세 박을 끊지 않는다
  x.tick(2); assert.ok(h.crit())
  h.set(false); x.tick(5000); x.calls.length = 0
  assert.equal(h.skill('true'), false); assert.equal(h.crit(), false)
  assert.equal(x.calls.length, 0)
})

test('소리·진동을 붙여도 판은 그대로 (결정론) — 같은 씨앗·같은 입력이면 같은 판', async () => {
  const make = () => {
    const s = createHaebi(11, 'stage', 'axe', { awaken: true, bonus: { luck: 5 } })
    s.level = U.unlockLevel; s.gauge = 1e9
    for (let i = 0; i < 24; i++) { spawnMob(s, 'club'); const e = s.enemies[s.enemies.length - 1]!; e.x = s.x + Math.cos(i) * (60 + i * 9); e.y = s.y + Math.sin(i * 1.3) * (50 + i * 7) }
    return s
  }
  const { snd } = await fresh(true)
  const x = hapticEnv(), h = makeHaptics(x.e)
  const a = make(), b = make()
  let skills = 0, crits = 0
  for (let i = 0; i < 3600; i++) {
    const input = { x: Math.sin(i / 50), y: Math.cos(i / 70), skill: i % 30 === 0, wake: i === 900 }
    for (const s of [a, b]) { if (s.offers.length) choose(s, s.offers[0]!); stepHaebi(s, input, 1 / 120) }
    clock += 1 / 120; x.tick(1000 / 120)
    const ev = snd.frame(b, true, false)
    if (ev.skill) { skills++; h.skill(ev.skill) } else if (ev.crit) { crits++; h.crit() }
  }
  assert.ok(skills >= 2 && crits >= 1, `사건이 실제로 났다 (비기 ${skills} · 크리티컬 ${crits})`)
  assert.deepEqual(a, b)
  assert.equal(JSON.stringify(a), JSON.stringify(b))
})

test('56-A 영구 각성 비기는 tru=false여도 각성 소리·진동 계단이며 투지 강화만으로 각성이 되지 않는다', async () => {
  for (const awake of [false, true]) {
    const { snd, s } = await fresh()
    s.skillCd = 5
    s.cast = { kind: 'ult', t: U.cast, total: U.cast, tru: false, awakened: awake, empowered: true }
    s.fx.push(fxOf('skill', { tru: false, awakened: awake, empowered: true }))
    const ev = snd.frame(s, true, false)
    assert.equal(ev.skill, awake ? 'awake' : 'skill')
  }
})
