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
  /** 스윕의 시작·끝 주파수. 노이즈는 **필터**의 것이다 — 노이즈에 음정은 없고 색만 있다. */
  f0: number
  f1: number
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
  /** 처음 세팅된 값. 스윕이 **어느 쪽으로 가는가**를 알려면 끝값만으로는 모자란다. */
  first = -1
  setValueAtTime(v: number, t: number): Param {
    if (this.first < 0) this.first = v
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
      f0: this.frequency.first,
      f1: this.frequency.value,
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
    // 노이즈의 '음정'은 제 뒤에 붙은 필터의 스윕이다. 하류로 걸어가 필터를 찾는다.
    let f: Filter | null = null
    let p: ANode | null = this.dest
    while (p !== null) {
      if (p instanceof Filter) {
        f = p
        break
      }
      p = p.dest
    }
    events.push({
      kind: 'noise',
      at: this.startAt,
      stop: t,
      freq: 0,
      peak: g === null ? 0 : g.chainGain(),
      f0: f === null ? -1 : f.frequency.first,
      f1: f === null ? -1 : f.frequency.value,
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

console.log('신궁 — 오디오 프로브 (합성 경로만. 실사운드는 받지 않는다)')
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

// ── 4. 발사 소리 (형: "활 쏘는 게 병아리 소리도 아니고") ──
//
// 활 소리가 '히마리 있으려면' 세 가지가 있어야 한다. 그걸 숫자로 판정한다.
//   ① **몸통** — 300Hz 아래 층이 있는가. 없으면 가슴에 오는 게 없고 중역 삑만 남는다.
//   ② **멀어지는 쉭** — 노이즈 스윕이 **내려가는가**. 올라가는 스윕은 다가오는 것이라
//      물리적으로 활 소리가 못 된다 (예전 swoosh는 1500→3200으로 거꾸로 갔다).
//   ③ **삑 없음** — 2kHz 위에서 60ms 안에 끝나는 **음정 있는** 층. 그게 병아리다.
//      (명적/신전은 설정상 음정이 있는 소리라 면제 — 형이 짚어준 그대로다.)
{
  const KINDS = ['basic', 'pierce', 'heavy', 'split', 'burst', 'homing', 'chain', 'scatter', 'rapid'] as const
  const NAME: Record<string, string> = {
    basic: '유엽전(기본)', pierce: '애기살=편전', heavy: '육량전', split: '세전',
    burst: '화전', homing: '신전', chain: '명적(우는살)',
    scatter: '산전', rapid: '연주전',
  }
  /** 음정이 설정인 살 — 삑 검사 면제. */
  const TONAL_BY_DESIGN = new Set(['homing', 'chain'])
  let bad = 0
  let baseTear = 0
  console.log('\n── 4. 발사 소리 ──')
  console.log(
    '  ' + '살'.padEnd(14) + '층'.padStart(4) + '몸통(Hz)'.padStart(10) +
    '쉭 스윕(Hz)'.padStart(16) + '길이(ms)'.padStart(10) + '  판정',
  )
  for (const kind of KINDS) {
    const list = capture(`발사 — ${NAME[kind] ?? kind}`, () => {
      pumpSfx(sfx, fakeWorld([
        { t: 'release', power: 0.8, angle: 0.2, err: 0, kind },
      ]) as never)
    })
    table(list)

    const t0 = list.length === 0 ? 0 : Math.min(...list.map((e) => e.at))
    const span = list.length === 0 ? 0 : Math.max(...list.map((e) => e.stop)) - t0

    // ① 몸통 — 저역 층 (톤이든 노이즈든 300Hz 아래에서 울리는 것)
    let body = 0
    for (const e of list) {
      const f = e.kind === 'osc' ? e.f0 : e.f1
      if (f > 0 && f < 300 && (body === 0 || f < body)) body = f
    }

    // ② 내려가는 노이즈 스윕 중 가장 높은 데서 출발하는 것 = 이 살의 쉭
    let tearF0 = 0
    let tearF1 = 0
    for (const e of list) {
      if (e.kind !== 'noise' || e.f0 <= 0 || e.f1 <= 0) continue
      if (e.f0 > e.f1 * 1.5 && e.f0 > tearF0) {
        tearF0 = e.f0
        tearF1 = e.f1
      }
    }
    if (kind === 'basic') baseTear = tearF0

    // ③ 병아리 검사 — 2kHz 위 · 60ms 안에 끝나는 음정 층
    let chirp = 0
    if (!TONAL_BY_DESIGN.has(kind)) {
      for (const e of list) {
        if (e.kind === 'osc' && e.f0 > 2000 && (e.stop - e.at) < 0.06) chirp++
      }
    }

    const okBody = body > 0
    const okTear = tearF0 > 0
    const okChirp = chirp === 0
    if (!okBody || !okTear || !okChirp) bad++
    console.log(
      '  ' + (NAME[kind] ?? kind).padEnd(14) + String(list.length).padStart(4) +
      (okBody ? body.toFixed(0) : '없음').padStart(10) +
      (okTear ? `${tearF0.toFixed(0)}→${tearF1.toFixed(0)}` : '없음').padStart(16) +
      (span * 1000).toFixed(0).padStart(10) +
      `  ${okBody ? '몸통✓' : '몸통✗'} ${okTear ? '쉭✓' : '쉭✗'} ${okChirp ? '삑없음✓' : `삑${chirp}개✗`}`,
    )
  }

  // 편전은 기본살보다 **더 높은 데서** 쉭이 시작해야 한다 — 초속이 두 배 가까우니까.
  const pierceList = capture('편전 대조', () => {
    pumpSfx(sfx, fakeWorld([{ t: 'release', power: 0.8, angle: 0.2, err: 0, kind: 'pierce' }]) as never)
  })
  let pierceTear = 0
  for (const e of pierceList) {
    if (e.kind === 'noise' && e.f0 > 0 && e.f1 > 0 && e.f0 > e.f1 * 1.5 && e.f0 > pierceTear) pierceTear = e.f0
  }
  const sharper = pierceTear > baseTear
  console.log(
    `\n  편전의 쉭 ${pierceTear.toFixed(0)}Hz vs 기본살 ${baseTear.toFixed(0)}Hz — ` +
    `${sharper ? '편전이 더 날카롭다 ✓' : '⚠ 편전이 더 날카롭지 않다'}`,
  )
  if (!sharper) bad++
  console.log(bad === 0 ? '\n  발사 소리 판정 전부 통과 ✓' : `\n  ⚠ 발사 소리 판정 실패 ${bad}건`)

  // 겹침 — 발사 층이 늘었으니 보이스 상한(P.audio.maxVoices)을 먹는지 본다.
  // 실전에서 가장 붐비는 순간: 편전을 쏘는데 앞 화살이 명중하고 연쇄까지 튄다.
  const busy = capture('붐빔 — 편전 발사 + 명중 + 연쇄', () => {
    pumpSfx(sfx, fakeWorld([
      { t: 'release', power: 1, angle: 0.2, err: 0, kind: 'pierce' },
      { t: 'hit', targetId: 0, x: 20, y: 3, score: 10, accuracy: 0.9, chain: 0, combo: 2, head: false, foe: false, dmg: 0, arrow: 0 },
      { t: 'chain', targetId: 0, x: 20, y: 3, depth: 1 },
    ]) as never)
  })
  console.log(
    `  동시 ${busy.length}개 예약 (상한 ${P.audio.maxVoices}) — ` +
    (busy.length >= 12 ? '발사·명중·연쇄가 모두 났다 ✓' : '⚠ 상한에 걸려 일부가 잘렸을 수 있다'),
  )
}

console.log('')
console.log('※ 이 프로브는 "예약되었는가"만 답한다. 실제로 듣기 좋은지는 형이 확인해야 한다.')
