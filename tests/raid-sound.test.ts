// 열전 합성 소리 (11-19 형: 적이 맞는 「둑」 · 기세 알 「뽁」) — 한 프레임 한 묶음 · 묶음 틈 · 소리 수 한도(11-18 늑대 떼 렉) · 연달음 높이 · 가려진 탭
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_SOUND as V } from '../src/tune/params.ts'
import { createHaebi, type Effect, type HaebiRun } from '../src/raid/haebi.ts'

/** 가짜 소리판 — 만든 사인(=소리 하나)의 높이와 크기를 적는다. 끝남(onended)은 손으로 부른다 */
type Osc = { hz: number; vol: number; onended: (() => void) | null }
const made: Osc[] = []
let clock = 0, lastGain = 0
const param = (set: (v: number) => void = () => undefined) => ({ value: 0, setValueAtTime: (v: number) => set(v), linearRampToValueAtTime: (v: number) => set(v), exponentialRampToValueAtTime: () => undefined })
const node = () => ({ connect: (x: unknown) => x, disconnect: () => undefined })
class FakeCtx {
  sampleRate = 8000; destination = {}
  get currentTime() { return clock }
  resume() { return Promise.resolve() }
  createGain() { const g = { ...node(), gain: param((v) => { if (v > 0) lastGain = v }) }; return g }
  createBiquadFilter() { return { ...node(), type: '', frequency: param() } }
  createBuffer(_c: number, len: number) { return { getChannelData: () => new Float32Array(len) } }
  createBufferSource() { return { ...node(), buffer: null, playbackRate: param(), start() {}, stop() {}, onended: null } }
  createOscillator() {
    const o = { ...node(), type: '', hz: 0, vol: 0, onended: null as (() => void) | null, start() { o.vol = lastGain; made.push(o) }, stop() {}, frequency: param((v) => { if (!o.hz) o.hz = v }) }
    return o
  }
  decodeAudioData() { return Promise.reject(new Error('none')) }
}
const g = globalThis as Record<string, unknown>
let hidden = false
g['fetch'] = () => Promise.resolve({ ok: false })
g['location'] = { search: '' }
g['document'] = { get hidden() { return hidden } }
g['localStorage'] = { getItem: () => null, setItem: () => undefined }
g['AudioContext'] = FakeCtx
g['Audio'] = class { loop = false; preload = ''; paused = true; volume = 1; play() { return Promise.resolve() } pause() {} }
const { raidSound, thudShape, popHz } = await import('../src/raid/sound.ts')

const hitFx = (n: number): Effect => ({ x: 0, y: 0, x2: 0, y2: 0, r: 0, angle: 0, life: .3, total: .3, kind: 'hit', color: '', n })
function fresh() {
  made.length = 0; clock = 1; hidden = false
  const snd = raidSound(false, 'bow'); snd.unlock()
  const s = createHaebi(7, 'stage', 'bow')
  snd.frame(s, true, false)   // 첫 프레임 = 기준
  return { snd, s }
}
const frame = (snd: ReturnType<typeof raidSound>, s: HaebiRun) => snd.frame(s, true, false)

test('「둑」 모양 — 큰 피해일수록 낮고 크고 길게 · 높이 흔들림은 thudJitter 안 · 여럿 묶이면 조금 크게', () => {
  const small = thudShape(1, 5), big = thudShape(1, 500)
  assert.ok(big.hz < small.hz && big.vol > small.vol && big.s > small.s)
  assert.ok(small.s >= V.thudMs[0] / 1000 && big.s <= V.thudMs[1] / 1000)
  const up = thudShape(1, 50, 1), down = thudShape(1, 50, -1), mid = thudShape(1, 50)
  assert.ok(Math.abs(up.hz / mid.hz - 1 - V.thudJitter) < 1e-9 && Math.abs(1 - down.hz / mid.hz - V.thudJitter) < 1e-9)
  assert.ok(thudShape(4, 50).vol > mid.vol)
  assert.equal(thudShape(99, 50).vol, thudShape(1 + V.thudStackMax, 50).vol)   // 묶음 키움에도 끝이 있다
})

test('한 프레임에 여럿이 맞으면 「둑」 하나 · thudGap 안에 맞은 것은 다음 묶음에', () => {
  const { snd, s } = fresh()
  s.fx.push(hitFx(10), hitFx(10), hitFx(10), hitFx(10), hitFx(10)); frame(snd, s)
  assert.equal(made.length, 1)
  s.fx.push(hitFx(10)); clock += V.thudGap / 2; frame(snd, s)
  assert.equal(made.length, 1)                      // 아직 틈 안 — 모아 둔다
  clock += V.thudGap; frame(snd, s)
  assert.equal(made.length, 2)                      // 새로 맞은 것이 없어도 모아 둔 것을 낸다
  clock += V.thudGap; frame(snd, s)
  assert.equal(made.length, 2)                      // 이미 낸 것은 또 내지 않는다
})

test('소리 수 한도 — 끝나지 않은 소리가 maxVoices 면 「둑」·「뽁」도 건너뛴다 · 끝나면 다시', () => {
  const { snd, s } = fresh()
  for (let i = 0; i < V.maxVoices * 4; i++) { s.fx.push(hitFx(20)); clock += V.thudGap * 1.01; frame(snd, s) }
  assert.equal(made.length, V.maxVoices)
  s.drops = []; s.xp += 5; clock += 1; frame(snd, s)
  assert.equal(made.length, V.maxVoices)
  made[0]!.onended?.()
  s.fx.push(hitFx(20)); clock += 1; frame(snd, s)
  assert.equal(made.length, V.maxVoices + 1)
})

test('「뽁」 — 알을 주우면 하나 · 연달아 먹으면 높이가 오른다 · 쉬면 처음으로', () => {
  const { snd, s } = fresh()
  const drop = () => ({ x: s.x, y: s.y, value: 1, age: 0 })
  const eat = (n: number) => { s.drops = Array.from({ length: n }, drop); frame(snd, s); s.drops = []; s.xp += n; clock += V.popGap * 1.1; frame(snd, s) }
  eat(1); eat(1); eat(3)
  const hz = made.map(o => o.hz)
  assert.equal(made.length, 3)
  assert.ok(Math.abs(hz[0]! - popHz(0)) < 1e-6 && Math.abs(hz[1]! - popHz(1)) < 1e-6 && Math.abs(hz[2]! - popHz(4)) < 1e-6)
  clock += V.popCombo * 2; eat(1)
  assert.ok(Math.abs(made[3]!.hz - popHz(0)) < 1e-6)
  assert.equal(popHz(99), popHz(V.popSteps))
  // 시간이 다 돼 사라진 알(기세가 안 오름)은 소리가 없다
  s.drops = [drop()]; frame(snd, s); s.drops = []; clock += 1; frame(snd, s)
  assert.equal(made.length, 4)
})

test('가려진 탭에서는 안 낸다 (절대 규칙 4)', () => {
  const { snd, s } = fresh()
  hidden = true
  s.fx.push(hitFx(10)); clock += 1; frame(snd, s)
  s.drops = []; s.xp += 3; clock += 1; frame(snd, s)
  assert.equal(made.length, 0)
})
