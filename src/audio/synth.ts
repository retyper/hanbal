/**
 * 저수준 합성 엔진 — WebAudio만으로 소리를 만든다. 샘플 파일 0바이트 (ARCHITECTURE A6).
 *
 * 왜 샘플이 아니라 합성인가:
 *  1. 번들이 14KB(gzip)이고 첫 페인트 예산이 0.3초다 (GDD C6). mp3 몇 개면 수십 배가 된다.
 *  2. 연쇄가 이어질수록 반음씩 올라가는 소리(P.chain.pitchStep)를 샘플로는 못 만든다.
 *     피치를 올리면 길이도 같이 변한다. 합성이면 주파수만 곱하면 끝이다.
 *
 * 소리 만드는 재료는 셋뿐이다: 필터 걸린 노이즈 · 스윕하는 오실레이터 · 아주 짧은 임펄스.
 * "삑삑거리는 신디사이저"가 되지 않으려면 노이즈 성형과 짧은 엔벨로프가 전부다.
 *
 * 이 파일은 sim이 아니다. Math.random을 써도 되지만 World는 절대 건드리지 않는다 (A1).
 */
import { P } from '../tune/params.ts'


/**
 * 엔진 상수. 손맛(음색·음량) 값이 아니라 합성 장치의 물성이라 여기 남는다.
 * 믹서 값(전체 음량·동시 발음 수)은 P.audio 로 올라갔다 (A2).
 */
const AUDIO = {
  /** 노이즈 원본 길이 (s). 48kHz에서 1.5초 = 288KB. 짧으면 반복 패턴이 귀에 잡힌다. */
  noiseSec: 1.5,
  /** 같은 종류가 이 간격 안에 또 울리면 통째로 버린다 (s). 플램(flam) 제거. */
  hardGap: 0.014,
  /** 이 창 안의 연속 발음은 점점 작아진다 (s). 연쇄 폭주에서 귀를 지킨다. */
  echoWindow: 0.075,
  echoAtten: 0.38,
  echoMax: 5,
  /** kind 인덱스 상한. sfx.ts가 쓰는 종류 수보다 커야 한다. */
  kinds: 26,
  /** 완만한 컴프레서 하나. 연쇄가 겹쳐도 0dBFS를 넘지 않게만 한다. */
  compThreshold: -16,
  compKnee: 16,
  compRatio: 3.5,
  compAttack: 0.004,
  compRelease: 0.2,
  /** 노드를 끊기 전 여유 (s). 꼬리를 바로 자르면 딸깍 소리가 난다. */
  tail: 0.02,
  /** exponentialRamp는 0에 못 간다. 사실상 무음으로 취급할 하한. */
  eps: 0.0001,
} as const

export interface Synth {
  readonly ctx: AudioContext
  /** 모든 소리가 들어오는 마스터 게인. 뒤에 컴프레서가 붙어 있다. */
  readonly out: GainNode
  /** 한 번만 만들고 영원히 재사용하는 노이즈 원본. 매번 만들면 GC가 튄다. */
  readonly noise: AudioBuffer
  volume: number
  muted: boolean
  /** 보이스 슬롯별 종료 시각(ctx 시간). 지난 슬롯은 비어 있는 것으로 본다. */
  readonly voiceEnd: Float64Array
  /** 종류별 마지막 발음 시각 — 에코 억제 */
  readonly lastAt: Float64Array
  /** 종류별 연속 발음 횟수 — 겹칠수록 작아진다 */
  readonly echo: Int32Array
}

/** 필터 걸린 노이즈. 활시위·바람·흙의 재료. */
export interface NoiseOpts {
  /** 총 길이 (s). 필터 스윕이 이 시간에 걸쳐 일어난다. */
  dur: number
  filterType: BiquadFilterType
  freq: number
  /** 0이면 스윕 없음. freq와 다르면 dur에 걸쳐 훑는다. */
  endFreq: number
  q: number
  gain: number
  attack: number
  decay: number
  /** 지금부터 이만큼 뒤에 시작 (s). setTimeout 대신 이걸 쓴다 — 타이머는 밀린다. */
  delay: number
}

/** 오실레이터 + 피치 스윕. 몸통·울림의 재료. */
export interface ToneOpts {
  freq: number
  /** 0이면 스윕 없음 */
  endFreq: number
  type: OscillatorType
  dur: number
  gain: number
  attack: number
  decay: number
  delay: number
}

/** 아주 짧은 임펄스. 나무·타격음의 어택. */
export interface ClickOpts {
  freq: number
  dur: number
  gain: number
  delay: number
}

/**
 * 울리는 한 방 — 종·하프·글로켄슈필 계열. **"또로롱"의 정체가 이것이다.**
 *
 * 왜 tone() 으로는 안 되는가: 사인이든 삼각이든 오실레이터 하나는 "삑"이지 "또로롱"이 아니다.
 * 실제로 울리는 물체의 소리를 만드는 건 세 가지고, 셋 다 여기 있다:
 *   1. **배음이 여럿이다.** 기본음 하나로는 음정만 있고 재질이 없다.
 *   2. **높은 배음이 먼저 죽는다.** 이게 제일 중요하다 — 어택은 쨍하고 꼬리는 순한
 *      그 변화가 "울린다"는 감각의 전부다. 다 같이 죽으면 오르간이 된다.
 *   3. **배음이 정수배가 아니다.** 정수배는 현(하프), 조금 어긋나면 종이다 (inharm).
 *
 * 보이스는 **하나만** 잡고 에코 억제도 한 번만 건다. 배음마다 tone()을 부르면
 * 서로가 서로의 에코로 잡혀 2번째부터 통째로 버려진다 (echoScale).
 */
export interface BellOpts {
  freq: number
  /** 기본음이 사실상 사라지기까지 (s). 배음은 이보다 빨리 죽는다. */
  dur: number
  gain: number
  /** 배음 수 (1..BELL_PARTIALS). 4면 종, 2면 순한 하프. */
  partials: number
  /**
   * 비조화도. 0이면 정수배(현·하프), 0.02~0.06이면 금속(종·글로켄).
   * 크게 올리면 음정이 흐려지고 "쇳소리"가 된다.
   */
  inharm: number
  attack: number
  delay: number
  type: OscillatorType
}

/** 지속음 채널 — 루핑 노이즈 → 필터 → 게인. 만들고 나면 계속 돌고, 게인으로만 제어한다. */
export interface Chan {
  readonly src: AudioBufferSourceNode
  readonly filter: BiquadFilterNode
  readonly gain: GainNode
}

/** 프라미스 거부를 삼킨다. 오디오가 안 되는 건 게임이 죽을 이유가 못 된다. */
const ignore = (): void => {}

/**
 * 끝난 노드를 그래프에서 떼어낸다.
 * 모듈 레벨 함수라 소리마다 클로저를 새로 만들지 않는다 (A5).
 * 소스만 끊으면 뒤에 달린 필터·게인은 참조가 끊겨 알아서 수거된다 (연결은 상류→하류 단방향).
 */
function releaseNode(this: AudioScheduledSourceNode): void {
  this.disconnect()
}

export function createSynth(): Synth | null {
  type Ctor = new (opts?: AudioContextOptions) => AudioContext
  const g = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
  const Ctor = g.AudioContext ?? g.webkitAudioContext
  if (Ctor === undefined) return null

  let ctx: AudioContext
  try {
    ctx = new Ctor({ latencyHint: 'interactive' })
  } catch {
    return null
  }

  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = AUDIO.compThreshold
  comp.knee.value = AUDIO.compKnee
  comp.ratio.value = AUDIO.compRatio
  comp.attack.value = AUDIO.compAttack
  comp.release.value = AUDIO.compRelease
  comp.connect(ctx.destination)

  const out = ctx.createGain()
  out.gain.value = P.audio.master
  out.connect(comp)

  // 백색 노이즈는 샘플끼리 무상관이라 루프 이음매가 그냥 노이즈로 들린다. 크로스페이드 불필요.
  const len = Math.floor(ctx.sampleRate * AUDIO.noiseSec)
  const noise = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1

  return {
    ctx,
    out,
    noise,
    volume: P.audio.master,
    muted: false,
    // 슬롯 수는 생성 시 한 번만 읽는다. 판 도중 배열을 다시 잡으면 힙이 튄다 (A5).
    voiceEnd: new Float64Array(Math.max(1, Math.round(P.audio.maxVoices))),
    // ★ 0이 아니라 음수로 연다. AudioContext 는 currentTime 0 근처에서 태어나는데,
    // 0으로 두면 "직전에 같은 소리가 났다"로 읽혀 **각 종류의 첫 소리가 통째로 버려진다**
    // (echoScale 의 hardGap). 첫 발의 시위 소리가 안 나는 경로가 여기였다.
    lastAt: new Float64Array(AUDIO.kinds).fill(-AUDIO.echoWindow * 2),
    echo: new Int32Array(AUDIO.kinds),
  }
}

/** 사용자 제스처에서 부른다. 그 전에는 AudioContext가 suspended라 아무 소리도 안 난다. */
export function resumeSynth(s: Synth): void {
  if (s.muted) return
  s.ctx.resume().catch(ignore)
}

/** 탭이 숨었을 때. 정지가 아니라 중단이라 CPU를 0으로 만든다 (GDD C3 — 공부 방해 금지). */
export function suspendSynth(s: Synth): void {
  s.ctx.suspend().catch(ignore)
}

export function setMasterVolume(s: Synth, v: number): void {
  const vol = v < 0 ? 0 : v > 1 ? 1 : v
  s.volume = vol
  if (!s.muted) s.out.gain.setTargetAtTime(vol, s.ctx.currentTime, 0.02)
}

export function isMuted(s: Synth): boolean {
  return s.muted
}

export function setMuted(s: Synth, m: boolean): void {
  s.muted = m
  const t = s.ctx.currentTime
  s.out.gain.cancelScheduledValues(t)
  s.out.gain.setValueAtTime(m ? 0 : s.volume, t)
  // 음소거는 볼륨 0이 아니라 진짜 정지여야 한다. 공부 중에 CPU를 먹으면 안 된다.
  if (m) suspendSynth(s)
  else resumeSynth(s)
}

/**
 * 소리를 낼 수 있는 상태인가. 정지·음소거 중이면 스케줄 자체를 하지 않는다.
 *
 * ★ `ctx.state === 'running'` 이 조건에 있다는 것이 중요하다 — resume() 은 비동기라,
 *   제스처 안에서 불렀다고 해서 그 다음 순간에 running 이라는 보장이 없다. 거절당하면
 *   여기가 조용히 false 로 남고 그 세션의 모든 소리가 사라진다 (tools/probe-sound.ts).
 */
export function synthLive(s: Synth): boolean {
  return !s.muted && s.ctx.state === 'running'
}

/**
 * 보이스 슬롯을 잡는다. 빈 슬롯이 없으면 그 소리는 버린다.
 * 오래된 소리를 끊는 대신 새 소리를 버리는 이유: 이미 울리는 걸 끊으면 딸깍 소리가 난다.
 *
 * 기준은 호출 시각이 아니라 **이 소리가 시작하는 시각**이다. 연쇄 아르페지오처럼
 * 미래에 예약된 소리를 지금 기준으로 세면, 실제로는 겹치지도 않는 소리들이 서로를 밀어낸다.
 */
function claim(s: Synth, start: number, end: number): boolean {
  const v = s.voiceEnd
  for (let i = 0; i < v.length; i++) {
    if ((v[i] ?? 0) <= start) {
      v[i] = end
      return true
    }
  }
  return false
}

/**
 * 에코 억제. 같은 종류가 연달아 터지면 점점 작게, 너무 붙으면 아예 버린다.
 * 반환값은 게인에 곱할 배수. 0이면 내지 마라.
 *
 * 기준 시각은 호출 시각이 아니라 **예약된 시작 시각**이다. 상승음 3개처럼 한 번에
 * 예약하고 시차를 두는 소리를 호출 시각으로 재면 2·3번째가 통째로 버려진다.
 */
function echoScale(s: Synth, kind: number, at: number): number {
  const k = kind >= 0 && kind < AUDIO.kinds ? kind : 0
  const gap = at - (s.lastAt[k] ?? 0)
  if (gap < AUDIO.hardGap) return 0
  let n = gap < AUDIO.echoWindow ? (s.echo[k] ?? 0) + 1 : 0
  if (n > AUDIO.echoMax) n = AUDIO.echoMax
  s.echo[k] = n
  s.lastAt[k] = at
  return 1 / (1 + n * AUDIO.echoAtten)
}

/**
 * 타악기 엔벨로프. 지수 어택·지수 감쇠라 선형보다 훨씬 "때린" 느낌이 난다.
 * 반환값은 소리가 사실상 끝나는 시각.
 */
function shape(p: AudioParam, t0: number, peak: number, attack: number, decay: number): number {
  const a = attack > 0.0005 ? attack : 0.0005
  const d = decay > 0.005 ? decay : 0.005
  const top = peak > AUDIO.eps * 2 ? peak : AUDIO.eps * 2
  p.setValueAtTime(AUDIO.eps, t0)
  p.exponentialRampToValueAtTime(top, t0 + a)
  p.exponentialRampToValueAtTime(AUDIO.eps, t0 + a + d)
  return t0 + a + d
}

/** 필터 주파수 스윕. 0이나 음수로는 지수 램프를 못 건다. */
function sweep(p: AudioParam, t0: number, from: number, to: number, dur: number): void {
  const a = from > 1 ? from : 1
  p.setValueAtTime(a, t0)
  if (to > 1 && to !== a) p.exponentialRampToValueAtTime(to, t0 + dur)
}

export function noiseBurst(s: Synth, kind: number, o: NoiseOpts): void {
  if (!synthLive(s) || o.gain <= 0) return
  const ctx = s.ctx
  const now = ctx.currentTime
  const t0 = now + (o.delay > 0 ? o.delay : 0)
  const scale = echoScale(s, kind, t0)
  if (scale <= 0) return

  const g = ctx.createGain()
  const stop = shape(g.gain, t0, o.gain * scale, o.attack, o.decay) + AUDIO.tail
  if (!claim(s, t0, stop)) {
    g.disconnect()
    return
  }

  const f = ctx.createBiquadFilter()
  f.type = o.filterType
  f.Q.value = o.q
  sweep(f.frequency, t0, o.freq, o.endFreq, o.dur > 0 ? o.dur : stop - t0)

  const src = ctx.createBufferSource()
  src.buffer = s.noise
  src.loop = true
  src.connect(f)
  f.connect(g)
  g.connect(s.out)
  // 매번 다른 구간에서 읽어야 같은 소리가 반복돼도 복사-붙여넣기로 들리지 않는다.
  src.start(t0, Math.random() * (AUDIO.noiseSec * 0.5))
  src.stop(stop)
  src.onended = releaseNode
}

export function tone(s: Synth, kind: number, o: ToneOpts): void {
  if (!synthLive(s) || o.gain <= 0 || o.freq <= 0) return
  const ctx = s.ctx
  const now = ctx.currentTime
  const t0 = now + (o.delay > 0 ? o.delay : 0)
  const scale = echoScale(s, kind, t0)
  if (scale <= 0) return

  const g = ctx.createGain()
  const stop = shape(g.gain, t0, o.gain * scale, o.attack, o.decay) + AUDIO.tail
  if (!claim(s, t0, stop)) {
    g.disconnect()
    return
  }

  const osc = ctx.createOscillator()
  osc.type = o.type
  sweep(osc.frequency, t0, o.freq, o.endFreq, o.dur > 0 ? o.dur : stop - t0)
  osc.connect(g)
  g.connect(s.out)
  osc.start(t0)
  osc.stop(stop)
  osc.onended = releaseNode
}

/**
 * 아주 짧은 임펄스. 좁은 밴드패스 노이즈라 "나무를 톡 친" 소리가 난다.
 * 사인파 클릭은 삑 소리가 나서 못 쓴다 — 임펄스의 정체는 노이즈다.
 */
export function click(s: Synth, kind: number, o: ClickOpts): void {
  if (!synthLive(s) || o.gain <= 0) return
  const ctx = s.ctx
  const now = ctx.currentTime
  const t0 = now + (o.delay > 0 ? o.delay : 0)
  const scale = echoScale(s, kind, t0)
  if (scale <= 0) return

  const g = ctx.createGain()
  const stop = shape(g.gain, t0, o.gain * scale, 0.0008, o.dur) + AUDIO.tail
  if (!claim(s, t0, stop)) {
    g.disconnect()
    return
  }

  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = o.freq > 1 ? o.freq : 1
  // Q가 높으면 링이 남아 나무 대신 금속이 된다. 1.6쯤이 "톡"이다.
  f.Q.value = 1.6

  const src = ctx.createBufferSource()
  src.buffer = s.noise
  src.loop = true
  src.connect(f)
  f.connect(g)
  g.connect(s.out)
  src.start(t0, Math.random() * (AUDIO.noiseSec * 0.5))
  src.stop(stop)
  src.onended = releaseNode
}

/**
 * 배음 하나의 세기와 감쇠.
 *
 * 세기는 위로 갈수록 빠르게 준다(1/(p+1)^1.5) — 안 그러면 기본음이 안 들리고 쇳소리만 남는다.
 * 감쇠는 **위로 갈수록 짧다.** 이 한 줄이 "울린다"의 전부다.
 */
const BELL_AMP_FALL = 1.5
const BELL_DECAY_FALL = 1.1
/** 배음 수 상한. 종 하나에 노드 8개까지. 이 위로는 귀에 안 들리고 보이스만 먹는다. */
const BELL_PARTIALS = 4

export function bellTone(s: Synth, kind: number, o: BellOpts): void {
  if (!synthLive(s) || o.gain <= 0 || o.freq <= 0) return
  const ctx = s.ctx
  const t0 = ctx.currentTime + (o.delay > 0 ? o.delay : 0)
  const scale = echoScale(s, kind, t0)
  if (scale <= 0) return

  const n = o.partials < 1 ? 1 : o.partials > BELL_PARTIALS ? BELL_PARTIALS : Math.round(o.partials)
  const dur = o.dur > 0.02 ? o.dur : 0.02
  const atk = o.attack > 0.0005 ? o.attack : 0.0005
  // 가장 오래 남는 건 기본음이다. 보이스 점유 시간은 그걸로 잡는다.
  const stop = t0 + atk + dur + AUDIO.tail
  if (!claim(s, t0, stop)) return

  // 배음이 다 같이 지나는 하나의 출구. 음량 조절이 여기 한 곳에서 끝난다.
  const out = ctx.createGain()
  out.gain.value = o.gain * scale
  out.connect(s.out)

  for (let p = 0; p < n; p++) {
    // 정수배에서 조금씩 어긋난다. 위 배음일수록 더 어긋나야 종처럼 들린다.
    const ratio = (p + 1) * (1 + o.inharm * p)
    const f = o.freq * ratio
    // 나이퀴스트를 넘는 배음은 앨리어싱으로 되돌아와 쇳소리를 만든다. 그냥 안 낸다.
    if (f > ctx.sampleRate * 0.45) break

    const pg = ctx.createGain()
    shape(pg.gain, t0, Math.pow(p + 1, -BELL_AMP_FALL), atk, dur / Math.pow(p + 1, BELL_DECAY_FALL))
    pg.connect(out)

    const osc = ctx.createOscillator()
    osc.type = o.type
    osc.frequency.value = f
    osc.connect(pg)
    osc.start(t0)
    osc.stop(stop)
    osc.onended = releaseNode
  }
}

// ───────────────────────── 지속음 채널 ─────────────────────────
//
// 삐걱·긴장음처럼 계속 나는 소리는 매 프레임 새 노드를 만들 수 없다.
// 루핑 노이즈를 하나 켜두고 게인·필터만 움직인다. 게인 0이면 사실상 공짜다.

export function createChan(s: Synth, type: BiquadFilterType, freq: number, q: number): Chan | null {
  const ctx = s.ctx
  const src = ctx.createBufferSource()
  src.buffer = s.noise
  src.loop = true

  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q

  const g = ctx.createGain()
  g.gain.value = 0

  src.connect(f)
  f.connect(g)
  g.connect(s.out)
  try {
    src.start()
  } catch {
    return null
  }
  return { src, filter: f, gain: g }
}

/**
 * 채널 게인·필터를 목표값으로 민다. setTargetAtTime은 지수 접근이라 계단이 안 들린다.
 * 매 프레임 불려도 되고, 값이 안 바뀌면 아무 일도 안 일어난다.
 */
export function setChan(s: Synth, c: Chan, gain: number, freq: number, smooth: number): void {
  const t = s.ctx.currentTime
  const tc = smooth > 0.005 ? smooth : 0.005
  c.gain.gain.setTargetAtTime(s.muted ? 0 : gain, t, tc)
  if (freq > 20) c.filter.frequency.setTargetAtTime(freq, t, 0.02)
}

/** 즉시 무음. 탭이 숨는 순간 지속음이 남아 울리면 최악이다. */
export function silenceChan(s: Synth, c: Chan): void {
  const t = s.ctx.currentTime
  c.gain.gain.cancelScheduledValues(t)
  c.gain.gain.setValueAtTime(0, t)
}

export function closeSynth(s: Synth): void {
  s.ctx.close().catch(ignore)
}
