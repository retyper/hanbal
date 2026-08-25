/**
 * 오디오 프로브 — **소리를 숫자로 본다.**
 *
 * 이 데스크탑에서는 게임을 브라우저로 못 연다(CLAUDE.md). 그래서 "판 클리어 소리가 좋아졌다"를
 * 귀로 확인할 수가 없다. 대신 WebAudio를 스텁으로 세우고 실제 `sfx.ts`를 돌려서
 * **무엇이 · 언제 · 어떤 음정으로 · 얼마나 크게** 예약되는지를 표로 찍는다.
 *
 * 이 프로브가 잡아주는 것:
 *   1. 예외 없이 스케줄되는가 (배음 합성은 노드를 여럿 만든다 — 하나만 틀려도 판이 조용해진다)
 *   2. 음정이 실제로 올라가는가 (상승음인데 마지막이 제일 작으면 사그라드는 소리다)
 *   3. 보이스 상한(P.audio.maxVoices)에 걸려 뒷부분이 통째로 버려지지 않는가
 *   4. 전체 길이가 C1(다음 판을 막지 않는다) 안에 드는가
 *
 * 실행: node --experimental-strip-types tools/probe-audio.ts
 */

export {}

// ───────────────────────── WebAudio 스텁 ─────────────────────────
//
// 진짜 소리를 내지 않는다. **예약된 사건을 기록**할 뿐이다.
// 그럴듯하게 만들수록 "스텁을 테스트하는" 쪽으로 미끄러진다 — 기록에 필요한 것만 세운다.

interface Ev {
  kind: 'osc' | 'noise'
  /** 시작 시각 (ctx 시간, s) */
  at: number
  stop: number
  freq: number
  /** 엔벨로프 최고점 × 상류 게인들의 곱 */
  peak: number
}

const events: Ev[] = []
let now = 0

class Param {
  value = 0
  peak = 0
  /** 누가 한 번이라도 건드렸는가. 안 건드린 파라미터(필터의 gain)는 게인이 아니라 없는 것이다. */
  touched = false
  /** 마지막으로 예약된 시각. 엔벨로프 길이를 재는 데 쓴다. */
  last = 0
  setValueAtTime(v: number, t: number): Param {
    this.value = v
    this.touched = true
    if (v > this.peak) this.peak = v
    if (t > this.last) this.last = t
    return this
  }
  exponentialRampToValueAtTime(v: number, t: number): Param {
    this.value = v
    if (v > this.peak) this.peak = v
    if (t > this.last) this.last = t
    return this
  }
  setTargetAtTime(v: number): Param {
    this.value = v
    return this
  }
  cancelScheduledValues(): Param {
    return this
  }
}

/**
 * 노드 하나의 게인. 필터처럼 게인이 없는 노드는 1로 본다 —
 * 0으로 세면 통과하는 소리가 전부 무음으로 계산돼 "소리가 안 난다"는 오진이 난다.
 */
function gainOf(n: ANode): number {
  if (n.gain.peak > 0) return n.gain.peak
  if (n.gain.value > 0) return n.gain.value
  return n.gain.touched ? n.gain.value : 1
}

class ANode {
  /** 상류에서 하류로만 연결된다. peak 를 거슬러 곱하기 위해 부모를 들고 있는다. */
  dest: ANode | null = null
  gain = new Param()
  connect(d: ANode): ANode {
    this.dest = d
    return d
  }
  disconnect(): void {}
  /**
   * 이 노드부터 **마스터 직전까지**의 게인 곱. 소리끼리 비교하려는 값이라
   * 전체에 똑같이 걸리는 마스터 볼륨과 컴프레서는 세지 않는다.
   */
  chainGain(): number {
    let g = gainOf(this)
    let p = this.dest
    while (p !== null && p !== master) {
      g *= gainOf(p)
      p = p.dest
    }
    return g
  }
}

class Osc extends ANode {
  type = 'sine'
  frequency = new Param()
  onended: (() => void) | null = null
  start(t: number): void {
    this.startAt = t
  }
  stop(t: number): void {
    const g = this.dest
    events.push({
      kind: 'osc',
      at: this.startAt,
      stop: t,
      freq: this.frequency.peak > 0 ? this.frequency.peak : this.frequency.value,
      peak: g === null ? 0 : g.chainGain(),
    })
  }
  startAt = 0
}

class Src extends ANode {
  buffer: unknown = null
  loop = false
  playbackRate = new Param()
  onended: (() => void) | null = null
  startAt = 0
  start(t: number): void {
    this.startAt = t
  }
  stop(t: number): void {
    const g = this.dest
    events.push({
      kind: 'noise',
      at: this.startAt,
      stop: t,
      freq: 0,
      peak: g === null ? 0 : g.chainGain(),
    })
  }
}

class Filter extends ANode {
  type = 'lowpass'
  frequency = new Param()
  Q = new Param()
}

class Comp extends ANode {
  threshold = new Param()
  knee = new Param()
  ratio = new Param()
  attack = new Param()
  release = new Param()
}

let master: ANode | null = null

class Ctx {
  sampleRate = 48000
  state = 'running'
  destination = new ANode()
  get currentTime(): number {
    return now
  }
  createGain(): ANode {
    return new ANode()
  }
  createOscillator(): Osc {
    return new Osc()
  }
  createBiquadFilter(): Filter {
    return new Filter()
  }
  createBufferSource(): Src {
    return new Src()
  }
  createDynamicsCompressor(): Comp {
    return new Comp()
  }
  createBuffer(_c: number, len: number): { getChannelData: () => Float32Array } {
    const data = new Float32Array(len)
    return { getChannelData: (): Float32Array => data }
  }
  resume(): Promise<void> {
    return Promise.resolve()
  }
  suspend(): Promise<void> {
    return Promise.resolve()
  }
  close(): Promise<void> {
    return Promise.resolve()
  }
}

const g = globalThis as unknown as Record<string, unknown>
g['AudioContext'] = Ctx
g['document'] = { addEventListener: (): void => {}, removeEventListener: (): void => {}, hidden: false }
g['window'] = { addEventListener: (): void => {}, removeEventListener: (): void => {} }
g['localStorage'] = {
  getItem: (): string | null => null,
  setItem: (): void => {},
}
// 샘플은 받지 않는다. **합성 경로만** 재는 게 이 프로브의 목적이다 —
// 실사운드가 있든 없든 소리가 나야 한다는 게 sfx.ts 의 계약이기도 하다 (samples.ts).
g['fetch'] = (): Promise<never> => Promise.reject(new Error('no network in probe'))

// ───────────────────────── 실행 ─────────────────────────

const { createSfx, playUi, pumpSfx, unlockSfx } = await import('../src/audio/sfx.ts')
const { P } = await import('../src/tune/params.ts')

const sfx = createSfx()
unlockSfx(sfx)
// 첫 번째 노이즈 버퍼를 만들며 마스터 게인이 잡힌다. 그 뒤에야 chainGain 이 마스터를 알아본다.
master = (sfx.synth?.out ?? null) as unknown as ANode

/**
 * 이벤트 하나를 소리 내게 하고, 그동안 예약된 것만 걷어 온다.
 * 시계를 넉넉히 밀어 두는 이유: 소리마다 "직전에 같은 소리가 났는가"를 보므로(echoScale)
 * 앞 항목의 잔향 구간에서 재면 뒤 항목이 눌린 채로 측정된다.
 */
function capture(label: string, fn: () => void): Ev[] {
  events.length = 0
  now += 5
  fn()
  const list = events.slice().sort((a, b) => a.at - b.at)
  console.log(`\n── ${label} ── ${list.length}개 예약`)
  return list
}

/** 주파수 → 음이름. 음정이 진짜 올라가는지 눈으로 확인하는 자다. */
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
function noteOf(f: number): string {
  if (f <= 0) return '—'
  const n = Math.round(12 * Math.log2(f / 440) + 69)
  return `${NAMES[((n % 12) + 12) % 12] ?? '?'}${Math.floor(n / 12) - 1}`
}

function table(list: readonly Ev[]): void {
  console.log(
    '  ' + 't(ms)'.padStart(7) + 'len(ms)'.padStart(9) + 'freq'.padStart(9) +
    'note'.padStart(6) + 'gain'.padStart(9),
  )
  for (const e of list) {
    console.log(
      '  ' + (e.at * 1000).toFixed(0).padStart(7) +
      ((e.stop - e.at) * 1000).toFixed(0).padStart(9) +
      (e.kind === 'noise' ? '노이즈' : e.freq.toFixed(1)).padStart(9) +
      noteOf(e.kind === 'noise' ? 0 : e.freq).padStart(6) +
      e.peak.toFixed(4).padStart(9),
    )
  }
}

/** 가짜 World. sfx.ts 는 events / tick / archer 만 읽는다. */
function fakeWorld(ev: unknown[]): unknown {
  return {
    tick: ++tick,
    events: ev,
    targets: [{ id: 0, kind: 'aerial' }],
    // 클리어음 분기(isBossStage)가 스테이지 정의를 읽는다 — 보스 없는 판으로 세운다.
    stage: { targets: [] },
    archer: { phase: 'idle', draw: 0, warn: 0, tremorAmp: 0 },
  }
}
let tick = 0

console.log('한 발 — 오디오 프로브 (합성 경로만. 실사운드는 받지 않는다)')
console.log(`master=${P.audio.master}  maxVoices=${P.audio.maxVoices}  endGain=${P.audio.endGain}`)

// ── 1. 판 클리어 ──
{
  const list = capture('판 클리어 (stage_end cleared)', () => {
    pumpSfx(sfx, fakeWorld([{ t: 'stage_end', cleared: true, score: 900 }]) as never)
  })
  table(list)
  const tonal = list.filter((e) => e.kind === 'osc')
  const t0 = list.length === 0 ? 0 : Math.min(...list.map((e) => e.at))
  const span = list.length === 0 ? 0 : Math.max(...list.map((e) => e.stop)) - t0
  console.log(`  총 길이 ${(span * 1000).toFixed(0)}ms · 음정 있는 소리 ${tonal.length}개`)
  if (span > 1.4) console.log('  ⚠ 1.4초를 넘는다 — 다음 판을 막는다 (C1)')
  if (tonal.length < 8) console.log('  ⚠ 배음이 예상보다 적다 — 보이스 상한에 걸렸을 수 있다')
}

// ── 2. 연쇄 (또로롱) ──
{
  const evs: unknown[] = []
  for (let d = 0; d < 8; d++) evs.push({ t: 'chain', targetId: 0, x: 20, y: 3, depth: d })
  const list = capture('연쇄 8단 (또로롱)', () => {
    pumpSfx(sfx, fakeWorld(evs) as never)
  })
  table(list)
  // 같은 순간에 예약된 것들은 한 알의 배음이다. 알갱이의 **기본음**만 뽑아 비교한다.
  const fundamentals = new Map<number, number>()
  for (const e of list) {
    if (e.kind !== 'osc') continue
    const lo = fundamentals.get(e.at)
    if (lo === undefined || e.freq < lo) fundamentals.set(e.at, e.freq)
  }
  const series = [...fundamentals.entries()].sort((a, b) => a[0] - b[0]).map((p) => p[1])
  let rising = series.length > 1
  for (let i = 1; i < series.length; i++) if ((series[i] ?? 0) <= (series[i - 1] ?? 0)) rising = false
  console.log(
    `  알갱이 ${series.length}개 · 기본음 ${series.map((f) => f.toFixed(0)).join(' → ')}` +
    `  ${rising ? '반음씩 올라간다 ✓' : '⚠ 단조 증가가 아니다'}`,
  )
}

// ── 3. 해금 ──
{
  const list = capture('해금 (playUi unlock)', () => {
    playUi(sfx, 'unlock')
  })
  table(list)
}

console.log('')
console.log('※ 이 프로브는 "예약되었는가"만 답한다. 실제로 듣기 좋은지는 형이 확인해야 한다.')
