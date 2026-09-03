export {}
/**
 * 소리 배선 프로브 — **첫 제스처 뒤에 소리가 실제로 살아나는가.**
 *
 * probe-audio.ts 는 "sfx를 부르면 무엇이 예약되는가"를 잰다 — 이미 열린 소리의 모양이다.
 * 여기서는 그 앞 단계, **소리가 열리는 순간**만 본다. 형이 두 번 반려한 자리다
 * ("왜 소리가 안나는지 모르겠다" 2026-08-31 · "또 씨발 소리가 안난다" 2026-09-03).
 *
 * 자동재생 정책상 AudioContext 는 사용자 제스처 안에서 만들고 resume 해야 하는데,
 * **resume() 은 비동기다.** 제스처 한 번에 열린 척하고 리스너를 떼어버리면, 그 resume 이
 * 실패했을 때(정책·기기·bfcache 복귀) 그 세션의 소리가 통째로 조용히 사라진다.
 * synth.live() 가 `ctx.state === 'running'` 을 요구하므로 아무 소리도 예약되지 않는다.
 *
 * 재는 것:
 *   1. 제스처 전에는 AudioContext 를 만들지 않는다 (C3·C6)
 *   2. 창 어디를 눌러도(캔버스 밖 DOM 버튼 포함) 열린다
 *   3. **첫 resume 이 실패하면 다음 제스처가 다시 연다** — 한 번 실패로 세션이 조용해지지 않는다
 *   4. 음소거로 시작해도 M 한 번이면 그 자리에서 열린다
 *   5. 탭에 돌아오면 다시 running 이 된다
 *
 * 실행: node --experimental-strip-types tools/probe-sound.ts
 */

// ───────────────────────── AudioContext 스텁 ─────────────────────────
//
// 진짜 소리를 내지 않는다. **상태 기계만** 흉내낸다 — 이 프로브가 보는 건 파형이 아니라
// "지금 소리를 낼 수 있는 상태인가"다.

let ctxCount = 0
/** 켜 두는 동안 모든 resume() 이 실패한다 (브라우저 정책 거절 재현). */
let refuseResume = false

class Par {
  value = 0
  setValueAtTime(): Par { return this }
  setTargetAtTime(): Par { return this }
  linearRampToValueAtTime(): Par { return this }
  exponentialRampToValueAtTime(): Par { return this }
  cancelScheduledValues(): Par { return this }
}
class Node {
  gain = new Par()
  frequency = new Par()
  detune = new Par()
  Q = new Par()
  pan = new Par()
  threshold = new Par()
  knee = new Par()
  ratio = new Par()
  attack = new Par()
  release = new Par()
  playbackRate = new Par()
  buffer: unknown = null
  loop = false
  type = ''
  onended: (() => void) | null = null
  connect(n: unknown): unknown { return n }
  disconnect(): void {}
  start(): void { started++ }
  stop(): void {}
}
let started = 0

class Ctx {
  state: 'suspended' | 'running' | 'closed' = 'suspended'
  sampleRate = 48000
  currentTime = 0
  destination = new Node()
  constructor() { ctxCount++ }
  createGain(): Node { return new Node() }
  createOscillator(): Node { return new Node() }
  createBufferSource(): Node { return new Node() }
  createBiquadFilter(): Node { return new Node() }
  createStereoPanner(): Node { return new Node() }
  createDynamicsCompressor(): Node { return new Node() }
  createBuffer(_ch: number, len: number): { getChannelData: () => Float32Array } {
    const d = new Float32Array(len)
    return { getChannelData: (): Float32Array => d }
  }
  decodeAudioData(): Promise<unknown> { return Promise.reject(new Error('no decode')) }
  async resume(): Promise<void> {
    if (refuseResume) throw new Error('NotAllowedError')
    this.state = 'running'
  }
  async suspend(): Promise<void> { this.state = 'suspended' }
  async close(): Promise<void> { this.state = 'closed' }
}

// ───────────────────────── DOM 스텁 ─────────────────────────

type Fn = (e: unknown) => void
const winLs = new Map<string, Fn[]>()
const docLs = new Map<string, Fn[]>()
const on = (m: Map<string, Fn[]>, t: string, f: Fn): void => {
  const l = m.get(t)
  if (l === undefined) m.set(t, [f])
  else l.push(f)
}
const off = (m: Map<string, Fn[]>, t: string, f: Fn): void => {
  const l = m.get(t)
  if (l === undefined) return
  const i = l.indexOf(f)
  if (i >= 0) l.splice(i, 1)
}
const fire = (m: Map<string, Fn[]>, t: string, e: unknown = {}): void => {
  for (const f of (m.get(t) ?? []).slice()) f(e)
}

const store = new Map<string, string>()
const doc = {
  hidden: false,
  addEventListener: (t: string, f: Fn): void => on(docLs, t, f),
  removeEventListener: (t: string, f: Fn): void => off(docLs, t, f),
  createElement: (): unknown => ({ style: {}, appendChild: (): void => {}, addEventListener: (): void => {} }),
}
const g = globalThis as unknown as Record<string, unknown>
g['window'] = {
  addEventListener: (t: string, f: Fn): void => on(winLs, t, f),
  removeEventListener: (t: string, f: Fn): void => off(winLs, t, f),
}
g['document'] = doc
g['localStorage'] = {
  getItem: (k: string): string | null => store.get(k) ?? null,
  setItem: (k: string, v: string): void => { store.set(k, v) },
  removeItem: (k: string): void => { store.delete(k) },
}
g['AudioContext'] = Ctx
g['fetch'] = (): Promise<never> => Promise.reject(new Error('no net'))
g['HTMLInputElement'] = class {}
g['HTMLTextAreaElement'] = class {}
g['HTMLSelectElement'] = class {}

const sfxMod = await import('../src/audio/sfx.ts')
const { createSfx, unlockSfx, sfxLive } = sfxMod

let fails = 0
function check(ok: boolean, label: string, detail = ''): void {
  if (!ok) fails++
  console.log(`  ${ok ? 'ok ' : '✗  '} ${label.padEnd(46)} ${detail}`)
}
/** resume() 이 마이크로태스크로 풀리므로 한 틱 넘긴다. */
const tick = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve() }

// ───────────────────────── 1. 제스처 전 ─────────────────────────

console.log('\n1. 제스처 전에는 AudioContext 를 만들지 않는다 (C3 · C6)')
const sfx = createSfx()
check(ctxCount === 0, 'AudioContext 가 아직 없다', `ctx ${ctxCount}개`)
check(!sfxLive(sfx), '소리는 아직 죽어 있다')

// ───────────────────────── 2. 첫 제스처 ─────────────────────────

console.log('\n2. 첫 제스처 하나로 열린다')
unlockSfx(sfx)
await tick()
check(ctxCount === 1, 'AudioContext 가 하나 생겼다', `ctx ${ctxCount}개`)
check(sfxLive(sfx), 'resume 이 끝나면 소리가 산다', `state=${sfx.synth?.ctx.state ?? '-'}`)

// ───────────────────────── 3. resume 이 거절당한 경우 ─────────────────────────

console.log('\n3. 첫 resume 이 거절당해도 다음 제스처가 다시 연다 (형: "또 소리가 안난다")')
sfx.dispose()
ctxCount = 0
const sfx2 = createSfx()
refuseResume = true
unlockSfx(sfx2)
await tick()
check(!sfxLive(sfx2), '거절당한 직후에는 죽어 있다', `state=${sfx2.synth?.ctx.state ?? '-'}`)
refuseResume = false
unlockSfx(sfx2)
await tick()
check(sfxLive(sfx2), '두 번째 제스처가 되살린다', `state=${sfx2.synth?.ctx.state ?? '-'}`)
check(ctxCount === 1, '컨텍스트를 새로 만들지는 않는다', `ctx ${ctxCount}개`)
sfx2.dispose()

// ───────────────────────── 4. 음소거로 시작 ─────────────────────────

console.log('\n4. 음소거를 저장해 둔 채로 켰다면 (M 한 번에 살아나야 한다)')
store.set('hanbal.audio.v1', '{"v":1,"muted":true}')
ctxCount = 0
const sfx3 = createSfx()
unlockSfx(sfx3)
await tick()
check(ctxCount === 0, '음소거면 컨텍스트도 안 만든다 (CPU 0)', `ctx ${ctxCount}개`)
fire(winLs, 'keydown', { key: 'm', repeat: false, target: null })
await tick()
check(ctxCount === 1 && sfxLive(sfx3), 'M 한 번에 그 자리에서 열린다', `state=${sfx3.synth?.ctx.state ?? '-'}`)
store.delete('hanbal.audio.v1')

// ───────────────────────── 5. 탭을 나갔다 돌아온다 ─────────────────────────

console.log('\n5. 공부하러 나갔다 돌아온다 (C3 — 나가면 정지, 오면 복귀)')
doc.hidden = true
fire(docLs, 'visibilitychange')
await tick()
check(!sfxLive(sfx3), '나가면 즉시 멎는다', `state=${sfx3.synth?.ctx.state ?? '-'}`)
doc.hidden = false
fire(docLs, 'visibilitychange')
await tick()
check(sfxLive(sfx3), '돌아오면 다시 산다', `state=${sfx3.synth?.ctx.state ?? '-'}`)

console.log('\n6. pagehide 로 멎은 뒤에도 다음 제스처가 되살린다 (bfcache 복귀)')
fire(winLs, 'pagehide')
await tick()
check(!sfxLive(sfx3), 'pagehide 는 소리를 멎게 한다')
unlockSfx(sfx3)
await tick()
check(sfxLive(sfx3), '다음 제스처가 되살린다', `state=${sfx3.synth?.ctx.state ?? '-'}`)
sfx3.dispose()

console.log(fails === 0 ? '\n전부 통과' : `\n${fails}건 어긋남`)
process.exit(fails === 0 ? 0 : 1)
