/**
 * 게임 이벤트 → 소리 (GDD 7장 손맛 레이어)
 *
 * World는 **읽기만** 한다. events도 읽되 비우지 않는다 — 비우는 건 게임 루프다 (render/effects.ts와 같은 규칙).
 * 여기서 쓰는 Math.random은 오디오 전용이라 sim의 시드 스트림과 완전히 분리돼 있다 (ARCHITECTURE A1).
 *
 * 소리의 뼈대는 지금 게임의 리듬을 그대로 따른다:
 *   조준하며 빠르게 당긴다(삐걱) → 만작에 닿는다(툭) → 끌수록 벌받는다(긴장음·심장박동) → 놓는다(팅)
 *
 * ── 샘플과 합성을 섞는다 ─────────────────────────────────────────────────
 *
 * 기준은 하나다: **소리가 값에 연속으로 반응해야 하는가.**
 *
 * | 소리 | 방식 | 왜 |
 * |---|---|---|
 * | 명중(나무·유리·종) · 관통 · 빗나감 · UI | **샘플** (Kenney CC0, public/sfx/) | 물체가 부딪히는 소리는 한 번 나고 끝난다. 합성으로 흉내 내봐야 진짜를 못 이긴다 |
 * | 릴리즈 "팅" | 합성 | 활시위 소리가 기성 팩에 없다. 게다가 power(0.72~1.0)에 따라 음량·밝기가 **연속**으로 변해야 한다 |
 * | 당김 삐걱 · 만작 긴장음 | 합성 (지속 채널) | draw·strain을 매 프레임 게인·필터로 민다. 샘플은 이런 걸 못 한다 |
 * | 붕괴 예고 심장박동 | 합성 | warn에 따라 박 속도와 세기가 같이 변한다 |
 * | 만작 "툭" · 붕괴 · 화살 "쉭" · 판 클리어 상승음 | 합성 | 활 계열이라 팩에 대응물이 없고, 클리어음은 타악기가 아니라 음정 3개짜리 신호다 |
 *
 * **샘플은 덧칠이지 의존이 아니다.** 아직 안 받아졌거나(첫 몇 초) 브라우저가 ogg를 못 읽으면
 * 그 자리에 원래의 합성음이 그대로 난다 — 소리가 통째로 사라지는 경로는 없다 (samples.ts 참조).
 *
 * 음소거: **기본 ON**(GDD 1장 C3 — 형이 소리를 요청해 "기본 OFF"에서 바꿨다. 문서 갱신됨).
 * 대신 M 키 즉시 토글 · localStorage 기억 · 탭이 숨으면 즉시 전부 정지 · 낮은 기본 볼륨(P.audio.master)으로 방어한다.
 */
import { clamp01, lerp } from '../core/math.ts'
import { P } from '../tune/params.ts'
import type { ArrowKindId, TargetKind, World } from '../sim/types.ts'
import {
  createSampleBank,
  hasSample,
  loadSamples,
  playSample,
  resetSampleVoices,
  type SampleBank,
  type SampleName,
  type SampleOpts,
} from './samples.ts'
import {
  bellTone,
  click,
  closeSynth,
  createChan,
  createSynth,
  noiseBurst,
  resumeSynth,
  setChan,
  setMasterVolume,
  setMuted,
  silenceChan,
  suspendSynth,
  tone,
} from './synth.ts'
import type { BellOpts, Chan, ClickOpts, NoiseOpts, Synth, ToneOpts } from './synth.ts'

/** 음소거 기억. 저장 실패해도 게임은 계속 돈다 (A4와 같은 원칙). */
const STORE_KEY = 'hanbal.audio.v1'

// 에코 억제용 소리 종류. 같은 순간에 같이 울리는 소리는 서로 다른 번호를 써야
// 하나가 다른 하나를 플램으로 오해해 버린다.
const K_DRAW = 0
const K_FULL = 1
const K_RELEASE = 2
const K_RING = 3
const K_SWOOSH = 4
const K_COLLAPSE = 5
const K_HIT = 6
const K_BODY = 7
const K_HIT_RING = 8
const K_CHAIN = 9
const K_MISS = 10
const K_BEAT = 11
const K_END = 12
const K_AIR = 13
const K_UI = 14
/** 클리어 화음의 저음·마지막 음. 앞 세 음의 에코로 잡혀 눌리면 닫는 맛이 사라진다. */
const K_END_BODY = 15
/** 클리어 꼬리의 반짝임 (음정 없는 공기) */
const K_SPARKLE = 16
/** 연쇄에 얹히는 종의 배음 — "또로롱" */
const K_CHAIN_BELL = 17
/** 폭발 — 저역 몸통 / 고역 파편 */
const K_BOOM = 18
const K_DEBRIS = 19
/** 보급을 주웠다 / 돌진에게 빼앗겼다 */
const K_PICKUP = 20
const K_ESCAPE = 21

/**
 * 음색 상수 — **파형의 신원**이다. 필터 주파수·Q·부분음 길이를 바꾸면 값이 세지는 게 아니라
 * 다른 소리가 난다 (bow.ts의 노이즈 시드와 같은 이유). 그래서 여기 남는다.
 * "얼마나 크게 / 언제"는 전부 P.audio 로 올라갔다 (A2).
 */
const SFX = {
  // ── 삐걱 (지속) ── 활이 휘는 장력감. 당기는 '동작'에서 난다.
  creakLoFreq: 200,
  creakHiFreq: 500,
  creakQ: 1.1,
  drawGrabFreq: 320,
  drawGrabGain: 0.07,

  // ── 만작 "툭" ── 크지 않게. "걸렸다"만 알리면 된다.
  fullFreq: 155,
  fullDur: 0.045,

  // ── 긴장음 (지속) ── 빨간 바를 넘긴 동안만 울린다. 거슬리면 안 된다. 아주 작게 잡았다.
  tremorFreq: 115,
  tremorQ: 0.9,

  // ── 붕괴 예고 심장박동 ── 이게 "예고"의 청각 채널이다 (feel-lens 반려 항목 방어).
  beatFreq: 66,
  beatEndFreq: 46,
  beatGap: 0.16,

  // ── 릴리즈 "팅" ── 이 게임에서 가장 중요한 소리.
  relFreq: 420,
  relEndFreq: 160,
  relDur: 0.08,
  relRingFreq: 830,
  relRingGain: 0.09,
  relAirFreq: 2400,
  relAirGain: 0.17,
  brightFloor: 0.78,
  brightCeil: 1.16,

  // ── 화살 비행 "쉭" ── 길게 끌지 않는다.
  swooshFreq: 1500,
  swooshEndFreq: 3200,
  swooshDur: 0.15,
  swooshDelay: 0.025,

  // ── 붕괴 ── release보다 둔탁하고 낮고 작게. 고역 어택이 없는 게 핵심이다.
  colFreq: 205,
  colEndFreq: 88,
  colDur: 0.18,
  colNoiseFreq: 380,
  colNoiseGain: 0.09,

  // ── 명중 "퍽/텅" ── accuracy가 높을수록 밝고 단단하게.
  hitLoFreq: 210,
  hitHiFreq: 620,
  hitBodyLo: 145,
  hitBodyHi: 290,
  hitBodyGain: 0.2,
  hitRingFreq: 940,
  hitRingGain: 0.075,

  // ── 연쇄 ── 보로로로록. depth마다 P.chain.pitchStep 배씩 올라간다.
  chainBase: 300,
  chainDur: 0.085,
  /** 연쇄 상한은 없다. 소리는 여기서 접는다 — 더 올라가면 귀가 아프다. */
  chainMaxFreq: 2600,
  /**
   * 연쇄음 사이 최소 간격 (s). 한 프레임에 여러 연쇄가 들어와도 이만큼씩 벌려 예약한다.
   * 같은 순간에 몰아 넣으면 화음이 되어 "보로로로록"이 아니라 "쾅"이 된다.
   */
  chainSpacing: 0.032,
  /** 화면보다 이만큼 넘게 뒤처진 연쇄음은 버린다. 소리가 그림과 따로 놀면 손맛이 아니라 렉이다. */
  chainMaxLag: 0.28,

  // ── 빗나감 ── 존재감 없이. 실패를 조롱하지 않는다.
  missFreq: 260,
  missDur: 0.075,

  // ── 판 클리어 ─────────────────────────────────────────────────────
  //
  // 예전엔 삼각파 세 방(C5–E5–G5)이었다. 음정은 맞지만 **울리지 않아서** 신호음처럼 들렸다
  // ("더 실감나는 소리로" 반려). 이제 넷은 전부 배음을 가진 종이고(bellTone),
  // 아래에 저음 하나가 깔리고, 꼬리에 음정 없는 반짝임이 얹힌다.
  //
  // 닫는 음이 옥타브(C6)인 게 중요하다. 5도(G5)로 끝나면 "계속된다"로 들려서 끝맺음이 안 된다.
  // 전체 1.3초 안에 끝난다 — 다음 판을 막지 않는다 (C1).
  endStep: 0.085,
  /** 앞 세 음의 울림 길이 / 닫는 음의 울림 길이 (s) */
  endRing: 0.5,
  endRingLast: 1,
  /** 앞 세 음은 닫는 음보다 조금 작게. 마지막이 제일 커야 상승으로 들린다. */
  endStepGain: 0.78,
  endPartials: 3,
  /** 살짝만 어긋난 배음. 0이면 하프, 크면 쇳소리. 여기는 그 사이의 '종'이다. */
  endInharm: 0.012,
  /** 종 아래 깔리는 저음 (C3). 없으면 소리가 공중에 뜬다. */
  endBodyFreq: 130.81,
  endBodyDur: 0.7,
  endBodyGain: 0.5,
  /** 반짝임 — 음정이 없어야 화음을 흐리지 않는다 */
  sparkleFrom: 2600,
  sparkleTo: 7200,
  sparkleDur: 0.5,
  sparkleAttack: 0.16,
  sparkleGain: 0.35,
  sparkleDelay: 0.12,

  // ── 해금 ── 클리어보다 짧고 밝게. 두 음이면 "열렸다"는 방향이 생긴다.
  unlockStep: 0.09,
  unlockRing: 0.45,
  unlockInharm: 0.02,

  // ── 폭발 (화전) ───────────────────────────────────────────────────
  //
  // 예전에는 폭발에 **전용 소리가 없었다.** 딸려 죽은 과녁의 유리 깨짐만 났고,
  // 아무것도 안 물리면 아무 소리도 안 났다 (형의 지적: "뭐가 폭발이라는 건지").
  //
  // 폭발은 세 겹이다. 하나라도 빠지면 "퍽" 하고 만다:
  //   1. 어택  — 아주 짧은 고역 파열. 터진 **순간**이 여기 있다.
  //   2. 몸통  — 아래로 훅 떨어지는 저역. 가슴에 오는 부분.
  //   3. 파편  — 그 뒤로 흩어지는 노이즈 꼬리. 이게 없으면 소리가 뭉툭하게 끝난다.
  boomCrackFreq: 2600,
  boomCrackGain: 0.5,
  boomFreq: 150,
  boomEndFreq: 38,
  boomDur: 0.36,
  boomDebrisFreq: 1500,
  boomDebrisEndFreq: 260,
  boomDebrisDur: 0.42,
  boomDebrisGain: 0.45,
  boomDebrisDelay: 0.035,

  // ── 보급 ── 밝게 위로. "벌었다"는 방향이 있는 사건이라 한 방으로는 안 읽힌다.
  pickupLo: 784,
  pickupHi: 1174.7,
  pickupRing: 0.5,
  pickupStep: 0.06,
  pickupInharm: 0,

  // ── 빼앗김 ── 아래로. 벌이 아니라 **경고**다. 크지 않게, 대신 확실히 아래로 떨어지게.
  escapeFreq: 330,
  escapeEndFreq: 98,
  escapeDur: 0.3,
  escapeNoiseFreq: 700,
  escapeNoiseGain: 0.4,

  // ── 연쇄에 얹히는 종 ── 유리 깨짐 위의 배음. 이게 "또로롱"이다.
  chainBellBase: 880,
  chainBellDur: 0.28,
  chainBellGain: 0.45,
  chainBellInharm: 0.02,
  /** 이 깊이까지만 얹는다. 더 깊어지면 보이스를 먹고 소리가 뭉갠다. */
  chainBellDepth: 6,
} as const

/**
 * 샘플 믹서 — 실사운드는 팩마다 원본 음량이 제각각이라, 합성음 기준으로 잡아둔 P.audio.*Gain에
 * 종류별 트림을 곱해야 같은 자리에 앉는다.
 *
 * TODO(params): audio.smp* — 여기 값은 전부 믹서 값이라 원칙상 tune/params.ts로 올라가야 한다
 * (ARCHITECTURE A2). params.ts는 이번 작업에서 내 소유가 아니라 임시로 여기 둔다.
 * 노브를 낼 때는 아래 이름 그대로 audio 그룹에 넣으면 된다.
 */
const SMP = {
  /** 나무 과녁 (가장자리~보통) — P.audio.hitGain 배수 */
  woodGain: 1,
  /** 중심에 가깝게 박힌 두꺼운 소리 */
  woodHeavyGain: 0.88,
  /** 정중앙 종소리. 길게 울려서 조금 눌러야 한다 */
  bellGain: 0.8,
  /** 공중 과녁 직격 */
  glassHitGain: 0.95,
  /** 연쇄로 깨지는 유리 — P.audio.chainGain 배수 */
  glassChainGain: 1,
  /** 관통 */
  plankGain: 0.9,
  /** 빗나가 땅에 박힘 — P.audio.missGain 배수. 합성 노이즈보다 실사운드가 존재감이 커서 되레 올려야 들린다 */
  missGain: 2.4,
  /** UI. 절대값이다(합성 기준이 없다). 클릭 소리가 게임 소리보다 크면 안 된다 */
  uiPressGain: 0.3,
  uiHoverGain: 0.14,
  uiUnlockGain: 0.34,
  /** 해금 소절은 클리어보다 작게. 판을 깬 것보다 큰 사건이 아니다. */
  unlockJingleGain: 0.7,

  /**
   * 정중앙 문턱은 여기 없다 — `P.hit.bullseyeAcc` 하나뿐이다 (A2 단일 출처).
   * 눈에 보이는 크리티컬 연출·점수·해금과 **같은 문턱**을 써야 소리와 그림이 갈라지지 않는다.
   * 사본을 두면 다음 튜닝에서 또 갈라진다 — 실제로 0.90(소리)/0.78(그림)로 갈라져 있었다.
   */
  /** 이 위는 "제대로 박혔다" — 같은 나무지만 두꺼운 변주로 간다. 3단 사다리(가장자리/견실/정중앙)를 만든다. */
  solidAcc: 0.55,
  /** 정중앙에서 종을 이만큼까지 밝게 올린다. 1이면 원음. */
  bellBright: 1.12,
  /** 명중마다 이만큼 랜덤 피치. 같은 변주가 걸려도 같은 소리로 안 들리게 하는 마지막 장치. */
  hitJitter: 0.05,
  /** 연쇄 피치 상한 배수. 이 위로는 소리가 아니라 딸깍이 된다 (합성 쪽 chainMaxFreq와 같은 역할). */
  chainRateMax: 2.9,
  /** 연쇄를 좌우로 살짝 벌린다. 공간감이 아니라 **폭**을 주려는 것 — 겹칠 때 뭉치지 않는다. */
  chainPan: 0.35,
} as const

/**
 * 클리어 상승음 (C5–E5–G5–C6). 모듈 상수라 한 번만 만들어진다.
 * 마지막이 옥타브라 화음이 닫힌다 — 5도로 끝내면 "아직 안 끝났다"로 들린다.
 */
const END_NOTES = [523.25, 659.25, 783.99, 1046.5] as const
/** 해금 두 음 (C5–G5). 클리어와 같은 세계의 소리여야 한다. */
const UNLOCK_NOTES = [523.25, 783.99] as const

// 스크래치 파라미터. 소리마다 옵션 객체를 새로 만들면 힙이 튄다 (A5).
// 호출 즉시 값만 읽히므로 재사용해도 안전하다.
const NB: NoiseOpts = {
  dur: 0, filterType: 'bandpass', freq: 0, endFreq: 0, q: 1,
  gain: 0, attack: 0.002, decay: 0.05, delay: 0,
}
const TN: ToneOpts = {
  freq: 0, endFreq: 0, type: 'triangle', dur: 0,
  gain: 0, attack: 0.002, decay: 0.05, delay: 0,
}
const CK: ClickOpts = { freq: 0, dur: 0, gain: 0, delay: 0 }
const BL: BellOpts = {
  freq: 0, dur: 0, gain: 0, partials: 3, inharm: 0, attack: 0.004, delay: 0, type: 'sine',
}
const SP: SampleOpts = { gain: 0, rate: 1, pan: 0, delay: 0 }

export interface Sfx {
  synth: Synth | null
  /**
   * 실사운드 뱅크. **첫 제스처 이후에 뒤에서 받는다** — null이거나 아직 비어 있으면
   * 모든 소리가 합성음 경로로 떨어진다. 게임은 이걸 절대 기다리지 않는다 (C1·C6).
   */
  bank: SampleBank | null
  muted: boolean
  /** 사용자 제스처가 한 번이라도 있었는가. 그 전에는 AudioContext를 만들지도 않는다. */
  unlocked: boolean
  /** 같은 tick을 두 번 소비하지 않기 위한 가드 (render/effects.ts와 같은 방식) */
  lastTick: number
  creak: Chan | null
  strain: Chan | null
  prevDraw: number
  beatPhase: number
  /** 다음 연쇄음을 예약할 ctx 시각. 연쇄를 아르페지오로 펴는 커서다. */
  nextChainAt: number
  /** 마지막으로 채널에 밀어 넣은 값. 안 바뀌었으면 WebAudio를 건드리지 않는다 (C3 — 놀고 있을 때 CPU 0). */
  lastCreakG: number
  lastCreakF: number
  lastStrainG: number
  dispose: () => void
}

/** 이보다 작은 변화는 귀에 안 들린다. 매 프레임 예약을 거는 것보다 건너뛰는 게 낫다. */
const CHAN_EPS = 0.002
const CHAN_FREQ_EPS = 4

// ───────────────────────────── 저장 ─────────────────────────────

function loadMuted(): boolean {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw === null) return false
    const j: unknown = JSON.parse(raw)
    if (j !== null && typeof j === 'object' && 'muted' in j) {
      return (j as { muted: unknown }).muted === true
    }
  } catch {
    // 프라이빗 모드·용량 초과. 소리가 켜진 채로 시작할 뿐 게임은 멀쩡하다.
  }
  return false
}

function saveMuted(m: boolean): void {
  try {
    localStorage.setItem(STORE_KEY, `{"v":1,"muted":${m ? 'true' : 'false'}}`)
  } catch {
    // 저장 실패는 무시한다 (A4).
  }
}

// ───────────────────────────── 생성 ─────────────────────────────

/**
 * AudioContext는 첫 제스처 전에 만들지 않는다.
 * 첫 페인트 0.3초 예산(C6)에 노이즈 버퍼 생성 비용을 얹지 않기 위함이고,
 * 음소거로 시작한 사람에게는 아예 만들지 않아 CPU가 0이 된다 (C3).
 */
function ensure(sfx: Sfx): void {
  if (sfx.synth !== null || !sfx.unlocked || sfx.muted) return
  const s = createSynth()
  if (s === null) return
  sfx.synth = s
  setMasterVolume(s, P.audio.master)
  sfx.creak = createChan(s, 'bandpass', SFX.creakLoFreq, SFX.creakQ)
  sfx.strain = createChan(s, 'lowpass', SFX.tremorFreq, SFX.tremorQ)
  resumeSynth(s)

  /**
   * 여기가 샘플 로딩의 유일한 시작점이다. 세 가지가 한꺼번에 지켜진다:
   *  - 첫 페인트에 216KB가 얹히지 않는다 (C6). 이 함수는 첫 제스처 뒤에야 불린다.
   *  - 자동재생 정책상 어차피 그 전에는 소리를 못 낸다.
   *  - 음소거로 시작한 사람에게는 요청이 아예 안 나간다 (위의 early return, C3).
   * **await하지 않는다.** 로딩이 끝나기 전에 쏜 화살은 합성음으로 난다.
   */
  const bank = createSampleBank(s.ctx)
  sfx.bank = bank
  void loadSamples(bank)
}

/**
 * 샘플 한 방. 그 소리가 아직 없으면 false — 호출자는 합성음으로 되돌아간다.
 * 스크래치 SP를 재사용하므로 소리마다 객체가 생기지 않는다 (A5).
 */
function sample(
  sfx: Sfx,
  s: Synth,
  name: SampleName,
  gain: number,
  rate: number,
  pan: number,
  delay: number,
): boolean {
  const b = sfx.bank
  if (b === null || !hasSample(b, name)) return false
  SP.gain = gain
  SP.rate = rate
  SP.pan = pan
  SP.delay = delay
  playSample(s.ctx, b, s.out, name, SP)
  return true
}

/**
 * 명중한 과녁의 종류. 이벤트에는 id만 들어 있는데 소리는 **재질**을 알아야 한다 —
 * 나무에 박히는 소리와 유리가 깨지는 소리는 같은 명중이 아니다.
 * 과녁 배열은 고정 풀이고 판당 열 몇 개라 선형 탐색으로 충분하다 (할당 0, A5).
 */
function targetKind(w: World, id: number): TargetKind | null {
  const ts = w.targets
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]
    if (t !== undefined && t.id === id) return t.kind
  }
  return null
}

/** 명중마다 미세하게 다른 피치. 변주 4개로도 부족한 반복감을 여기서 마저 지운다. */
function jitter(amount: number): number {
  return 1 + (Math.random() * 2 - 1) * amount
}

/** 지속음을 즉시 끊는다. 탭 이탈·음소거 어느 쪽이든 남아 울리면 안 된다. */
function killSustain(sfx: Sfx): void {
  const s = sfx.synth
  if (s === null) return
  if (sfx.creak !== null) silenceChan(s, sfx.creak)
  if (sfx.strain !== null) silenceChan(s, sfx.strain)
  sfx.lastCreakG = 0
  sfx.lastStrainG = 0
  sfx.beatPhase = 0
  sfx.prevDraw = 0
  sfx.nextChainAt = 0
  // 예약 커서를 되감는다. 안 되감으면 탭에서 돌아왔을 때 옛 시각이 새 소리를 한동안 막는다.
  if (sfx.bank !== null) resetSampleVoices(sfx.bank)
}

/** 탭이 숨었다 / 페이지를 떠난다. 지속음이 백그라운드에서 울리면 최악이다. */
function hardStop(sfx: Sfx): void {
  const s = sfx.synth
  if (s === null) return
  killSustain(sfx)
  suspendSynth(s)
}

export function createSfx(): Sfx {
  const sfx: Sfx = {
    synth: null,
    bank: null,
    muted: loadMuted(),
    unlocked: false,
    lastTick: -1,
    creak: null,
    strain: null,
    prevDraw: 0,
    beatPhase: 0,
    nextChainAt: 0,
    lastCreakG: 0,
    lastCreakF: 0,
    lastStrainG: 0,
    dispose: (): void => {},
  }

  const onVisibility = (): void => {
    if (document.hidden) hardStop(sfx)
    else if (sfx.synth !== null && !sfx.muted) resumeSynth(sfx.synth)
  }
  const onPageHide = (): void => hardStop(sfx)

  /**
   * M = 음소거 토글. 공부 곁의 게임이라 한 손으로 즉시 꺼야 한다 (C3·C5).
   * 입력 레이어가 아니라 여기서 잡는 이유: 오디오의 생명주기는 오디오가 소유한다.
   * 통합 담당은 input/pointer.ts에 M을 **중복으로 걸지 말 것.**
   */
  const onKey = (e: KeyboardEvent): void => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key !== 'm' && e.key !== 'M') return
    // 튜닝 콘솔 입력창에 타이핑 중이면 건드리지 않는다.
    const t = e.target
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return
    // 키를 누른 것 자체가 사용자 제스처다. 여기서 음소거를 풀면 바로 소리가 나야 한다.
    sfx.unlocked = true
    toggleMute(sfx)
  }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('keydown', onKey)

  sfx.dispose = (): void => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('keydown', onKey)
    if (sfx.synth !== null) closeSynth(sfx.synth)
    sfx.synth = null
    sfx.creak = null
    sfx.strain = null
    // 버퍼는 ctx가 닫히면 같이 수거된다. 진행 중인 fetch는 결과를 버릴 뿐 아무 일도 하지 않는다.
    sfx.bank = null
  }
  return sfx
}

/** 첫 클릭에서 부른다. 자동재생 정책상 제스처 없이는 어떤 소리도 못 낸다. */
export function unlockSfx(sfx: Sfx): void {
  sfx.unlocked = true
  ensure(sfx)
  if (sfx.synth !== null && !sfx.muted) resumeSynth(sfx.synth)
}

/** 반환: 이제 음소거인가 */
export function toggleMute(sfx: Sfx): boolean {
  sfx.muted = !sfx.muted
  saveMuted(sfx.muted)
  if (sfx.synth !== null) {
    // 지속음을 먼저 끊는다. 안 끊으면 다시 켰을 때 옛 게인이 한 프레임 새어 나온다.
    if (sfx.muted) killSustain(sfx)
    setMuted(sfx.synth, sfx.muted)
  } else {
    ensure(sfx)
  }
  return sfx.muted
}

export function sfxMuted(sfx: Sfx): boolean {
  return sfx.muted
}

// ───────────────────────────── UI 소리 ─────────────────────────────

/**
 * 화면 소리. 드래프트 3택·해금·버튼이 쓴다 (HOOK.md ★1·★2).
 *
 * 레이어 규칙은 그대로다 — **ui/ 는 audio/ 를 직접 import하지 않는다.** game/loop.ts가
 * toggleMute처럼 좁은 창구로 내보내고, ui는 그 창구만 부른다.
 */
export type UiSound =
  /** 눌렀다 — 버튼·드래프트 선택 */
  | 'press'
  /** 지나갔다 — 마우스 오버. 있어도 되고 없어도 되는 소리라 합성 대체가 없다 */
  | 'hover'
  /** 열렸다 — 해금·패널 */
  | 'unlock'

export function playUi(sfx: Sfx, kind: UiSound): void {
  // UI를 누른 것 자체가 사용자 제스처다. 첫 클릭이 드래프트 카드일 수도 있으므로 여기서도 연다.
  sfx.unlocked = true
  ensure(sfx)
  const s = sfx.synth
  if (s === null || sfx.muted) return

  if (kind === 'hover') {
    // 없으면 그냥 안 낸다. 합성으로 만든 "삑"은 소리가 없는 것보다 나쁘다.
    sample(sfx, s, 'rollover', SMP.uiHoverGain, 1, 0, 0)
    return
  }

  if (kind === 'unlock') {
    // 연주된 한 소절이 있으면 그걸로 끝. 클리어음과 같은 악기(피치카토)라 한 세계로 들린다.
    if (sample(sfx, s, 'unlock', P.audio.clearGain * SMP.unlockJingleGain, 1, 0, 0)) return
    // 대체: 스위치 딸깍은 **어택**이고, 그 위에 울리는 두 음이 "열렸다"를 만든다.
    sample(sfx, s, 'switch', SMP.uiUnlockGain, 1, 0, 0)
    for (let n = 0; n < UNLOCK_NOTES.length; n++) {
      BL.freq = UNLOCK_NOTES[n] ?? 0
      BL.dur = SFX.unlockRing
      BL.gain = P.audio.endGain
      BL.partials = SFX.endPartials
      BL.inharm = SFX.unlockInharm
      BL.attack = 0.003
      BL.delay = n * SFX.unlockStep
      BL.type = 'sine'
      bellTone(s, n === 0 ? K_UI : K_END_BODY, BL)
    }
    return
  }

  if (sample(sfx, s, 'click', SMP.uiPressGain, 1, 0, 0)) return
  CK.freq = SFX.fullFreq
  CK.dur = SFX.fullDur
  CK.gain = P.audio.fullGain
  CK.delay = 0
  click(s, K_UI, CK)
}

// ───────────────────────────── 개별 소리 ─────────────────────────────

/**
 * 심장박동 두 번(lub–dub). 붕괴 예고의 청각 채널.
 * LFO 대신 이산 펄스인 이유: 맥동은 파형이 아니라 리듬으로 읽힌다.
 */
function heartbeat(s: Synth, warn: number): void {
  const v = warn > P.audio.beatMinWarn ? warn : P.audio.beatMinWarn

  TN.type = 'sine'
  TN.freq = SFX.beatFreq
  TN.endFreq = SFX.beatEndFreq
  TN.dur = 0.1
  TN.attack = 0.006
  TN.decay = 0.09
  TN.gain = P.audio.beatGain * v
  TN.delay = 0
  tone(s, K_BEAT, TN)

  TN.freq = SFX.beatFreq * 0.88
  TN.endFreq = SFX.beatEndFreq * 0.87
  TN.dur = 0.09
  TN.decay = 0.08
  TN.gain = P.audio.beatGain * v * 0.6
  TN.delay = SFX.beatGap
  tone(s, K_BEAT, TN)
}

/** 팅 — 하강 스윕 + 고역 노이즈 어택. power가 음량과 밝기를 같이 올린다. */
function playRelease(s: Synth, power: number): void {
  const pw = clamp01(power)
  // 제곱으로 눌러야 만작(1.0)과 초보 한계(0.72)의 차이가 귀에 잡힌다.
  const vol = lerp(P.audio.releasePowerFloor, 1, pw * pw)
  const bright = lerp(SFX.brightFloor, SFX.brightCeil, pw)

  TN.type = 'triangle'
  TN.freq = SFX.relFreq * bright
  TN.endFreq = SFX.relEndFreq * bright
  TN.dur = SFX.relDur
  TN.attack = 0.0015
  TN.decay = SFX.relDur
  TN.gain = P.audio.releaseGain * vol
  TN.delay = 0
  tone(s, K_RELEASE, TN)

  // 시위가 튕기며 남는 금속성 잔음. 만작에서만 확실히 들리게 pw를 한 번 더 곱한다.
  TN.type = 'sine'
  TN.freq = SFX.relRingFreq * bright
  TN.endFreq = SFX.relRingFreq * bright * 0.72
  TN.dur = 0.06
  TN.attack = 0.001
  TN.decay = 0.055
  TN.gain = SFX.relRingGain * vol * pw
  TN.delay = 0
  tone(s, K_RING, TN)

  NB.filterType = 'highpass'
  NB.freq = SFX.relAirFreq * bright
  NB.endFreq = 0
  NB.q = 0.7
  NB.dur = 0.03
  NB.attack = 0.001
  NB.decay = 0.028
  NB.gain = SFX.relAirGain * vol
  NB.delay = 0
  noiseBurst(s, K_AIR, NB)

  // 화살이 공기를 가르는 소리. 발사 직후 짧게만.
  NB.filterType = 'bandpass'
  NB.freq = SFX.swooshFreq
  NB.endFreq = SFX.swooshEndFreq
  NB.q = 0.8
  NB.dur = SFX.swooshDur
  NB.attack = 0.03
  NB.decay = 0.12
  NB.gain = P.audio.swooshGain * vol
  NB.delay = SFX.swooshDelay
  noiseBurst(s, K_SWOOSH, NB)
}

/**
 * 살별 발사 목소리 — 기본 팅 **위에 얹는** 서명 한 줄 (형: "쏘는 소리가 각각 달라야
 * 쏘는 재미가 있다"). 낱낱이 다른 악기를 만들지 않고, 실제 화살의 물리에서 딴다:
 *   명적 = 우는살이다. 진짜로 울며 난다 — 비브라토 걸린 호루라기 활공.
 *   화전 = 불심지 튀는 소리. 애기살 = 짧고 높은 채찍 스냅. 육량전 = 낮고 무거운 텅.
 *   세전 = 세 살대의 파닥임 3연타. 신전 = 느리게 차오르는 신령한 웅웅(5도 배음).
 */
function playShotVoice(s: Synth, kind: ArrowKindId, pw: number): void {
  const vol = lerp(P.audio.releasePowerFloor, 1, pw * pw)
  if (kind === 'chain') {
    // 우는살 — 상승했다 흘러내리는 호루라기. 활공 내내 우는 건 과하니 첫 0.4초만.
    TN.type = 'sine'
    TN.freq = 1350
    TN.endFreq = 1950
    TN.dur = 0.16
    TN.attack = 0.015
    TN.decay = 0.14
    TN.gain = 0.16 * vol
    TN.delay = 0.02
    tone(s, K_ESCAPE, TN)
    TN.freq = 1950
    TN.endFreq = 1150
    TN.dur = 0.26
    TN.attack = 0.005
    TN.decay = 0.24
    TN.delay = 0.18
    tone(s, K_ESCAPE, TN)
  } else if (kind === 'burst') {
    // 불심지 — 파직·파직·파지직. 고역 노이즈 세 톨.
    for (let i2 = 0; i2 < 3; i2++) {
      NB.filterType = 'highpass'
      NB.freq = 2600 + i2 * 500
      NB.endFreq = 0
      NB.q = 1.2
      NB.dur = 0.025
      NB.attack = 0.001
      NB.decay = 0.022
      NB.gain = 0.12 * vol
      NB.delay = 0.05 + i2 * 0.07
      noiseBurst(s, K_DEBRIS, NB)
    }
  } else if (kind === 'pierce') {
    // 애기살 — 통아를 훑는 채찍 스냅. 짧고 높고 마르게.
    TN.type = 'square'
    TN.freq = 2300
    TN.endFreq = 3100
    TN.dur = 0.03
    TN.attack = 0.001
    TN.decay = 0.028
    TN.gain = 0.09 * vol
    TN.delay = 0.005
    tone(s, K_ESCAPE, TN)
  } else if (kind === 'heavy') {
    // 육량전 — 여섯 냥의 무게. 낮은 텅이 가슴을 친다.
    TN.type = 'sine'
    TN.freq = 130
    TN.endFreq = 62
    TN.dur = 0.22
    TN.attack = 0.004
    TN.decay = 0.2
    TN.gain = 0.34 * vol
    TN.delay = 0.01
    tone(s, K_ESCAPE, TN)
  } else if (kind === 'split') {
    // 세전 — 세 살대의 파닥임. 같은 음이 아니라 살짝 어긋난 3연타.
    for (let i2 = 0; i2 < 3; i2++) {
      TN.type = 'triangle'
      TN.freq = 1500 + i2 * 190
      TN.endFreq = 1250 + i2 * 190
      TN.dur = 0.035
      TN.attack = 0.002
      TN.decay = 0.032
      TN.gain = 0.1 * vol
      TN.delay = 0.03 + i2 * 0.05
      tone(s, K_ESCAPE, TN)
    }
  } else if (kind === 'homing') {
    // 신전 — 신령한 웅웅. 근음+5도 배음이 느리게 차오른다.
    TN.type = 'sine'
    TN.freq = 520
    TN.endFreq = 660
    TN.dur = 0.3
    TN.attack = 0.07
    TN.decay = 0.22
    TN.gain = 0.11 * vol
    TN.delay = 0.02
    tone(s, K_ESCAPE, TN)
    TN.freq = 780
    TN.endFreq = 990
    TN.gain = 0.05 * vol
    tone(s, K_DEBRIS, TN)
  }
}

function playCollapse(s: Synth): void {
  // 고역이 없어야 "힘없이 풀렸다"가 들린다. 팅이 아니라 툭이다.
  TN.type = 'triangle'
  TN.freq = SFX.colFreq
  TN.endFreq = SFX.colEndFreq
  TN.dur = SFX.colDur
  TN.attack = 0.008
  TN.decay = SFX.colDur
  TN.gain = P.audio.collapseGain
  TN.delay = 0
  tone(s, K_COLLAPSE, TN)

  NB.filterType = 'lowpass'
  NB.freq = SFX.colNoiseFreq
  NB.endFreq = 0
  NB.q = 0.6
  NB.dur = 0.12
  NB.attack = 0.006
  NB.decay = 0.11
  NB.gain = SFX.colNoiseGain
  NB.delay = 0
  noiseBurst(s, K_COLLAPSE, NB)
}

/**
 * 명중. **재질과 명중도가 소리의 종류를 가른다** — 이게 손맛의 대부분이다.
 *
 *   나무 과녁  가장자리 → impactWood_medium · 견실 → impactWood_heavy · 정중앙 → impactBell(밝게)
 *   공중 과녁  impactGlass_medium (뒤이어 연쇄 유리가 줄줄이 따라온다)
 *   관통 과녁  impactPlank
 *
 * 정중앙만 재질을 무시하고 종으로 가는 이유: 크리티컬은 "무엇을 맞혔는가"가 아니라
 * "내가 잘 쐈다"는 신호다. 그건 과녁이 아니라 플레이어에 대한 소리라 재질과 무관해야 한다.
 */
function playHit(sfx: Sfx, s: Synth, w: World, targetId: number, accuracy: number): void {
  const acc = clamp01(accuracy)
  const kind = targetKind(w, targetId)

  // 튜닝 콘솔이 런타임에 P를 덮어쓰므로 상수로 붙잡지 않고 그때그때 읽는다 (A2).
  const crit = P.hit.bullseyeAcc
  if (acc >= crit) {
    // 정중앙일수록 조금 더 밝게. 문턱에서 갑자기 튀지 않게 문턱~1.0을 선형으로 편다.
    const t = crit < 1 ? (acc - crit) / (1 - crit) : 0
    if (sample(sfx, s, 'bell', P.audio.hitGain * SMP.bellGain, lerp(1, SMP.bellBright, t), 0, 0)) return
    // 종은 팩에서 가장 큰 파일이라 로딩 중 마지막에 도착한다. 그동안 정중앙만 합성음으로
    // 튀면 오히려 크리티컬이 약하게 들린다 — 두꺼운 나무로 한 칸 내려간다.
    if (sample(sfx, s, 'woodHeavy', P.audio.hitGain * SMP.woodHeavyGain, SMP.bellBright, 0, 0)) return
  } else if (kind === 'aerial') {
    if (sample(sfx, s, 'glassHeavy', P.audio.hitGain * SMP.glassHitGain, jitter(SMP.hitJitter), 0, 0)) return
  } else if (kind === 'pierceable') {
    // 뚫고 지나간 소리. 화살이 멈추지 않았다는 걸 귀로 알려야 다음 과녁을 기대한다.
    if (sample(sfx, s, 'plank', P.audio.hitGain * SMP.plankGain, jitter(SMP.hitJitter), 0, 0)) return
  } else if (acc >= SMP.solidAcc) {
    if (sample(sfx, s, 'woodHeavy', P.audio.hitGain * SMP.woodHeavyGain, jitter(SMP.hitJitter), 0, 0)) return
  } else if (sample(sfx, s, 'wood', P.audio.hitGain * SMP.woodGain, jitter(SMP.hitJitter), 0, 0)) {
    return
  }

  // 여기부터는 샘플이 아직 안 왔거나 못 읽는 브라우저다. 원래의 합성 명중음으로 되돌아간다.
  synthHit(s, acc)
}

function synthHit(s: Synth, accuracy: number): void {
  const acc = clamp01(accuracy)

  // 타격 어택. 중심일수록 높고 좁아져 "청량"해진다.
  CK.freq = lerp(SFX.hitLoFreq, SFX.hitHiFreq, acc)
  CK.dur = lerp(0.06, 0.035, acc)
  CK.gain = P.audio.hitGain
  CK.delay = 0
  click(s, K_HIT, CK)

  // 몸통. 가장자리는 낮고 길게(둔탁), 중심은 높고 짧게(단단).
  TN.type = 'triangle'
  TN.freq = lerp(SFX.hitBodyLo, SFX.hitBodyHi, acc)
  TN.endFreq = TN.freq * 0.62
  TN.dur = lerp(0.16, 0.1, acc)
  TN.attack = 0.002
  TN.decay = TN.dur
  TN.gain = SFX.hitBodyGain
  TN.delay = 0
  tone(s, K_BODY, TN)

  // 중심 명중에만 얹히는 맑은 울림. 이게 "정중앙이다"의 신호다.
  if (acc > 0.5) {
    TN.type = 'sine'
    TN.freq = SFX.hitRingFreq
    TN.endFreq = 0
    TN.dur = 0.12
    TN.attack = 0.001
    TN.decay = 0.11
    TN.gain = SFX.hitRingGain * (acc - 0.5) * 2
    TN.delay = 0
    tone(s, K_HIT_RING, TN)
  }
}

/**
 * 폭발. 어택(고역 파열) → 몸통(저역 하강) → 파편(노이즈 꼬리) 세 겹.
 *
 * 셋을 다른 kind 번호로 나눠 예약한다. 같은 번호면 에코 억제가 뒤의 둘을 눌러버려
 * "퍽" 하나로 끝난다 — 폭발이 폭발로 안 들리는 가장 흔한 이유다.
 */
function playBurst(s: Synth): void {
  const g = P.audio.burstGain

  // 1. 어택 — 터진 순간. 아주 짧아야 한다.
  NB.filterType = 'highpass'
  NB.freq = SFX.boomCrackFreq
  NB.endFreq = 0
  NB.q = 0.7
  NB.dur = 0.04
  NB.attack = 0.001
  NB.decay = 0.038
  NB.gain = g * SFX.boomCrackGain
  NB.delay = 0
  noiseBurst(s, K_BOOM, NB)

  // 2. 몸통 — 아래로 훅 떨어진다. 가슴에 오는 건 이 부분이다.
  TN.type = 'sine'
  TN.freq = SFX.boomFreq
  TN.endFreq = SFX.boomEndFreq
  TN.dur = SFX.boomDur
  TN.attack = 0.004
  TN.decay = SFX.boomDur
  TN.gain = g
  TN.delay = 0
  tone(s, K_BOOM, TN)

  // 3. 파편 — 흩어지는 꼬리. 없으면 소리가 뭉툭하게 끊긴다.
  NB.filterType = 'bandpass'
  NB.freq = SFX.boomDebrisFreq
  NB.endFreq = SFX.boomDebrisEndFreq
  NB.q = 0.5
  NB.dur = SFX.boomDebrisDur
  NB.attack = 0.006
  NB.decay = SFX.boomDebrisDur
  NB.gain = g * SFX.boomDebrisGain
  NB.delay = SFX.boomDebrisDelay
  noiseBurst(s, K_DEBRIS, NB)
}

/**
 * 판 클리어 — 이 게임에서 유일하게 "잘했다"고 말하는 소리다.
 *
 * 세 겹이다. 하나라도 빠지면 신호음으로 되돌아간다:
 *   저음 하나(C3)  — 몸통. 없으면 종소리가 공중에 뜬다.
 *   종 넷(C5·E5·G5·C6) — 배음을 가진 진짜 울림 (bellTone). 옥타브로 닫는다.
 *   반짝임 하나  — 음정 없는 공기. 꼬리에 얹혀 "여운"을 만든다.
 *
 * 마지막 음만 다른 kind 번호를 쓴다. 앞 세 음과 같은 번호면 에코 억제(echoScale)가
 * 마지막을 가장 작게 눌러서, 올라가는 소리가 되레 사그라든다.
 */
/** 이 판이 보스판인가. 스테이지 정의만 읽는다 — sim 상태를 건드리지 않는다. */
function isBossStage(w: World): boolean {
  const ts = w.stage.targets
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]
    if (t !== undefined && t.kind === 'boss') return true
  }
  return false
}

function playStageClear(sfx: Sfx, s: Synth, boss: boolean): void {
  const g = P.audio.endGain

  // 보스는 제 소리가 따로 있다 — 형이 고른 타이코 (CREDITS.txt). 없으면 일반 클리어음으로.
  if (boss && sample(sfx, s, 'clearBoss', P.audio.clearGain, 1, 0, 0)) return

  // ★ 진짜 연주된 한 소절이 있으면 그걸로 끝낸다. 합성 상승음은 아무리 배음을 쌓아도
  // "신호음"이지 음악이 아니다 (형의 반려). 아래 합성 경로는 샘플이 아직 안 왔거나
  // ogg를 못 읽는 브라우저를 위한 **대체**다 — 소리가 통째로 사라지는 경로는 없다.
  if (sample(sfx, s, 'clear', P.audio.clearGain, 1, 0, 0)) return

  TN.type = 'sine'
  TN.freq = SFX.endBodyFreq
  TN.endFreq = 0
  TN.dur = SFX.endBodyDur
  TN.attack = 0.012
  TN.decay = SFX.endBodyDur
  TN.gain = g * SFX.endBodyGain
  TN.delay = 0
  tone(s, K_END_BODY, TN)

  const last = END_NOTES.length - 1
  for (let n = 0; n <= last; n++) {
    BL.freq = END_NOTES[n] ?? 0
    BL.dur = n === last ? SFX.endRingLast : SFX.endRing
    BL.gain = g * (n === last ? 1 : SFX.endStepGain)
    BL.partials = SFX.endPartials
    BL.inharm = SFX.endInharm
    BL.attack = 0.004
    BL.delay = n * SFX.endStep
    BL.type = 'sine'
    bellTone(s, n === last ? K_SPARKLE : K_END, BL)
  }

  NB.filterType = 'highpass'
  NB.freq = SFX.sparkleFrom
  NB.endFreq = SFX.sparkleTo
  NB.q = 0.7
  NB.dur = SFX.sparkleDur
  NB.attack = SFX.sparkleAttack
  NB.decay = SFX.sparkleDur
  NB.gain = g * SFX.sparkleGain
  NB.delay = SFX.sparkleDelay
  noiseBurst(s, K_AIR, NB)
}

/**
 * 연쇄. depth마다 P.chain.pitchStep 배(반음)씩 올라간다 — 보로로로록의 정체가 이것이다.
 *
 * 노드를 하나만 쓰는 이유: 20연쇄에서 소리마다 3노드를 쓰면 보이스 상한에 즉사한다.
 *
 * **시간을 벌리는 게 핵심이다.** sweepChain은 한 스텝에 여러 연쇄를 한꺼번에 뱉고
 * pumpSfx는 한 프레임치를 통째로 받는다. 같은 순간에 전부 예약하면 아르페지오가 아니라
 * 화음 하나가 되고, 에코 억제가 나머지를 전부 버린다. 그래서 커서를 두고 한 알씩 벌린다.
 */
function playChain(s: Synth, sfx: Sfx, depth: number): void {
  const now = s.ctx.currentTime
  if (sfx.nextChainAt < now) sfx.nextChainAt = now
  const delay = sfx.nextChainAt - now
  // 너무 뒤처진 소리는 그림과 따로 논다. 내지 않는 게 낫다.
  if (delay > SFX.chainMaxLag) return
  sfx.nextChainAt += SFX.chainSpacing

  const d = depth > 0 ? depth : 0

  // 유리 샘플의 피치를 depth마다 P.chain.pitchStep 배씩 올린다.
  // 샘플은 피치를 올리면 길이도 같이 줄어든다 — 합성음에서는 dur을 손으로 줄여야 했던 걸
  // 재생 속도가 알아서 해준다. 깊어질수록 짧고 가벼워지는 게 "보로로로록"의 정체다.
  let rate = Math.pow(P.chain.pitchStep, d)
  if (rate > SMP.chainRateMax) rate = SMP.chainRateMax
  // 좌우로 번갈아 벌린다. 스무 발이 겹칠 때 한 덩어리로 뭉치지 않게 하는 최소한의 폭이다.
  const pan = d % 2 === 0 ? SMP.chainPan : -SMP.chainPan
  const g = (P.audio.chainGain * SMP.glassChainGain) / (1 + d * 0.06)

  // ★ 유리 위에 종의 배음을 얇게 얹는다 — **이게 "또로롱"이다.**
  // 유리 샘플만으로는 "쨍그랑"이 이어질 뿐 음정이 올라가는 게 안 읽힌다. 배음이 있는 소리를
  // 같은 비율로 같이 올려야 연쇄가 소리로 **선율**이 된다. 깊어질수록 얇아지고, 어느 선에서 멎는다
  // (보이스 상한이 14라, 다 얹으면 정작 유리가 밀려난다).
  if (d <= SFX.chainBellDepth) {
    BL.freq = SFX.chainBellBase * Math.pow(P.chain.pitchStep, d)
    BL.dur = SFX.chainBellDur
    BL.gain = P.audio.chainGain * SFX.chainBellGain
    BL.partials = 2
    BL.inharm = SFX.chainBellInharm
    BL.attack = 0.002
    BL.delay = delay
    BL.type = 'sine'
    bellTone(s, K_CHAIN_BELL, BL)
  }

  if (sample(sfx, s, 'glass', g, rate, pan, delay)) return

  let f = SFX.chainBase * Math.pow(P.chain.pitchStep, d)
  if (f > SFX.chainMaxFreq) f = SFX.chainMaxFreq

  TN.type = 'triangle'
  TN.freq = f
  TN.endFreq = f * 0.86
  // 깊을수록 짧고 가볍게. 길면 서로 겹쳐 웅웅거린다.
  TN.dur = SFX.chainDur / (1 + d * 0.06)
  TN.attack = 0.0012
  TN.decay = TN.dur
  TN.gain = P.audio.chainGain / (1 + d * 0.06)
  TN.delay = delay
  tone(s, K_CHAIN, TN)
}

// ───────────────────────────── 이벤트 소비 ─────────────────────────────

export function pumpSfx(sfx: Sfx, w: World): void {
  const s = sfx.synth
  if (s === null || sfx.muted) return
  // 히트스톱 중에는 tick이 멈춘다. 같은 tick을 두 번 읽으면 소리가 두 배로 난다.
  if (w.tick === sfx.lastTick) return
  sfx.lastTick = w.tick

  const ev = w.events
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i]
    if (e === undefined) continue
    if (e.t === 'release') {
      playRelease(s, e.power)
      if (e.kind !== 'basic') playShotVoice(s, e.kind, clamp01(e.power))
    } else if (e.t === 'hit') {
      // 적 몸통은 종(정중앙 소리)을 치지 않는다 — 사람에겐 헤드샷이 크리티컬이다.
      if (e.foe && e.head) {
        // 헤드샷 전용 2박 — 둔탁한 관통 + 높은 확인 핑. 과녁 종과 다른 소리여야
        // 가장 숙련된 한 발의 청각 정체성이 선다 (감사 재미).
        if (!sample(sfx, s, 'woodHeavy', P.audio.hitGain, 0.78, 0, 0)) {
          NB.filterType = 'lowpass'
          NB.freq = 700
          NB.endFreq = 0
          NB.q = 0.8
          NB.dur = 0.12
          NB.attack = 0.002
          NB.decay = 0.12
          NB.gain = P.audio.hitGain
          NB.delay = 0
          noiseBurst(s, K_ESCAPE, NB)
        }
        TN.type = 'sine'
        TN.freq = 1560
        TN.endFreq = 1200
        TN.dur = 0.09
        TN.attack = 0.002
        TN.decay = 0.09
        TN.gain = P.audio.hitGain * 0.5
        TN.delay = 0.03
        tone(s, K_ESCAPE, TN)
      } else {
        playHit(sfx, s, w, e.targetId, e.foe && !e.head ? Math.min(e.accuracy, P.hit.bullseyeAcc - 0.01) : e.accuracy)
      }
    } else if (e.t === 'burst') {
      playBurst(s)
    } else if (e.t === 'pickup') {
      // 두 음 상승 — 완전5도. 짧고 밝게. 이게 이 게임에서 유일하게 '얻었다'는 소리다.
      for (let n = 0; n < 2; n++) {
        BL.freq = n === 0 ? SFX.pickupLo : SFX.pickupHi
        BL.dur = SFX.pickupRing
        BL.gain = P.audio.pickupGain
        BL.partials = 2
        BL.inharm = SFX.pickupInharm
        BL.attack = 0.002
        BL.delay = n * SFX.pickupStep
        BL.type = 'sine'
        bellTone(s, n === 0 ? K_PICKUP : K_CHAIN_BELL, BL)
      }
    } else if (e.t === 'deflect') {
      // 맞불 — 쇠와 쇠가 스치는 높은 챙. 짧고 밝게, 두 음이 겹치면 '금속'이 된다.
      TN.type = 'square'
      TN.freq = 2500
      TN.endFreq = 1900
      TN.dur = 0.05
      TN.attack = 0.001
      TN.decay = 0.05
      TN.gain = P.audio.escapeGain * 0.8
      TN.delay = 0
      tone(s, K_RING, TN)
      TN.type = 'sine'
      TN.freq = 3600
      TN.endFreq = 2800
      TN.dur = 0.09
      TN.gain = P.audio.escapeGain * 0.5
      TN.delay = 0.012
      tone(s, K_ESCAPE, TN)
    } else if (e.t === 'enemy_block') {
      // 과녁이 대신 맞아줬다 — 낮은 나무 소리 하나. 위협이 끝났다는 안도의 마침표다.
      if (!sample(sfx, s, 'wood', P.audio.escapeGain, 0.85, 0, 0)) {
        NB.filterType = 'lowpass'
        NB.freq = 900
        NB.endFreq = 0
        NB.q = 0.8
        NB.dur = 0.09
        NB.attack = 0.002
        NB.decay = 0.09
        NB.gain = P.audio.escapeGain * 0.7
        NB.delay = 0
        noiseBurst(s, K_ESCAPE, NB)
      }
    } else if (e.t === 'enemy_draw') {
      // 적의 당김 — 낮게 조여 올라가는 경고. 크지 않게, 대신 반드시 들리게 (예고의 계약).
      TN.type = 'triangle'
      TN.freq = SFX.escapeEndFreq
      TN.endFreq = SFX.escapeFreq
      TN.dur = 0.5
      TN.attack = 0.05
      TN.decay = 0.5
      TN.gain = P.audio.escapeGain * 0.7
      TN.delay = 0
      tone(s, K_ESCAPE, TN)
    } else if (e.t === 'enemy_shot') {
      // 적 화살의 출발 — 짧은 바람소리.
      NB.filterType = 'bandpass'
      NB.freq = 1400
      NB.endFreq = 500
      NB.q = 1.2
      NB.dur = 0.16
      NB.attack = 0.004
      NB.decay = 0.16
      NB.gain = P.audio.escapeGain * 0.8
      NB.delay = 0
      noiseBurst(s, K_ESCAPE, NB)
    } else if (e.t === 'player_hit') {
      // 맞았다 — 이 게임에서 가장 무거운 저역. 놀라야 하지만 벌주듯 크면 안 된다.
      TN.type = 'triangle'
      TN.freq = SFX.escapeFreq
      TN.endFreq = 55
      TN.dur = 0.42
      TN.attack = 0.002
      TN.decay = 0.42
      TN.gain = P.audio.escapeGain * 1.6
      TN.delay = 0
      tone(s, K_ESCAPE, TN)
      NB.filterType = 'lowpass'
      NB.freq = 500
      NB.endFreq = 0
      NB.q = 0.7
      NB.dur = 0.3
      NB.attack = 0.002
      NB.decay = 0.3
      NB.gain = P.audio.escapeGain
      NB.delay = 0
      noiseBurst(s, K_DEBRIS, NB)
    } else if (e.t === 'escape') {
      // 아래로 떨어지는 두 겹. 실패를 조롱하지 않는다 — 놀라게만 하고 끝난다.
      TN.type = 'triangle'
      TN.freq = SFX.escapeFreq
      TN.endFreq = SFX.escapeEndFreq
      TN.dur = SFX.escapeDur
      TN.attack = 0.004
      TN.decay = SFX.escapeDur
      TN.gain = P.audio.escapeGain
      TN.delay = 0
      tone(s, K_ESCAPE, TN)

      NB.filterType = 'lowpass'
      NB.freq = SFX.escapeNoiseFreq
      NB.endFreq = 0
      NB.q = 0.6
      NB.dur = SFX.escapeDur
      NB.attack = 0.006
      NB.decay = SFX.escapeDur
      NB.gain = P.audio.escapeGain * SFX.escapeNoiseGain
      NB.delay = 0
      noiseBurst(s, K_ESCAPE, NB)
    } else if (e.t === 'chain') {
      playChain(s, sfx, e.depth)
    } else if (e.t === 'miss') {
      // 존재감 없이. 흙에 툭. 실패를 조롱하지 않는다.
      if (sample(sfx, s, 'soft', P.audio.missGain * SMP.missGain, jitter(SMP.hitJitter), 0, 0)) continue
      NB.filterType = 'lowpass'
      NB.freq = SFX.missFreq
      NB.endFreq = 0
      NB.q = 0.6
      NB.dur = SFX.missDur
      NB.attack = 0.003
      NB.decay = SFX.missDur
      NB.gain = P.audio.missGain
      NB.delay = 0
      noiseBurst(s, K_MISS, NB)
    } else if (e.t === 'full_draw') {
      // "걸렸다"는 신호. 크면 만작이 보상처럼 들려 오래 끌게 된다.
      CK.freq = SFX.fullFreq
      CK.dur = SFX.fullDur
      CK.gain = P.audio.fullGain
      CK.delay = 0
      click(s, K_FULL, CK)
    } else if (e.t === 'draw_start') {
      // 시위를 잡는 소리. 지속 삐걱은 updateSfx가 이어받는다.
      NB.filterType = 'bandpass'
      NB.freq = SFX.drawGrabFreq
      NB.endFreq = 0
      NB.q = 1.2
      NB.dur = 0.06
      NB.attack = 0.004
      NB.decay = 0.055
      NB.gain = SFX.drawGrabGain
      NB.delay = 0
      noiseBurst(s, K_DRAW, NB)
      sfx.prevDraw = 0
    } else if (e.t === 'warn_start') {
      // 경고가 뜬 그 순간 첫 박이 와야 예고가 성립한다. 다음 박은 updateSfx가 센다.
      // 진입 시점의 warn은 아직 작지만 heartbeat가 beatMinWarn으로 바닥을 받쳐준다.
      heartbeat(s, w.archer.warn)
      sfx.beatPhase = 0
    } else if (e.t === 'collapse') {
      playCollapse(s)
    } else if (e.t === 'stage_end') {
      if (e.cleared) playStageClear(sfx, s, isBossStage(w))
      // 실패에는 소리를 얹지 않는다. 실패를 조롱하지 않는다 (GDD 9장의 정신).
    }
  }
}

/**
 * 지속음 갱신. sim 스텝이 아니라 실시간(dtReal)으로 돈다 —
 * 소리는 결정론의 대상이 아니고, 히트스톱 중에도 자연스럽게 이어져야 한다.
 */
/** 다음 보스 북 시각 (elapsed). 판이 바뀌면(시계 되감김) 자연히 리셋된다. */
let bossThumpAt = 0

export function updateSfx(sfx: Sfx, w: World, dtReal: number): void {
  // ── 보스의 발소리 — 가까울수록 잦아진다. 위협의 거리를 소리 밀도로 번역한다 (감사). ──
  if (w.status === 'playing') {
    let bossDist = Infinity
    for (const t of w.targets) {
      if (t.alive && t.kind === 'boss') {
        const d2 = t.x - w.archer.x
        if (d2 < bossDist) bossDist = d2
      }
    }
    if (bossDist < 30) {
      if (w.elapsed < bossThumpAt - 4) bossThumpAt = 0
      if (w.elapsed >= bossThumpAt) {
        const period = Math.min(1.6, Math.max(0.45, bossDist / 12))
        bossThumpAt = w.elapsed + period
        const s2 = sfx.synth
        if (s2 !== null) {
          TN.type = 'sine'
          TN.freq = 62
          TN.endFreq = 40
          TN.dur = 0.22
          TN.attack = 0.004
          TN.decay = 0.22
          TN.gain = P.audio.escapeGain * (bossDist < 12 ? 1.2 : 0.7)
          TN.delay = 0
          tone(s2, K_BEAT, TN)
        }
      }
    }
  }

  const s = sfx.synth
  if (s === null || sfx.muted || s.ctx.state !== 'running') return

  const a = w.archer
  const drawing = a.phase === 'drawing' || a.phase === 'full'

  // ── 삐걱 ──
  // 게인을 draw가 아니라 draw의 **변화율**에 크게 실어야 "당기는 동작"으로 들린다.
  // 만작에서 멈추면 creakHold만큼의 장력 잔음만 남는다 — 활은 여전히 휘어 있으니까.
  const rate = dtReal > 0 ? (a.draw - sfx.prevDraw) / dtReal : 0
  sfx.prevDraw = a.draw
  const move = clamp01(rate / P.audio.drawRefRate)
  const creakG = drawing
    ? P.audio.drawGain * a.draw * (P.audio.drawHold + (1 - P.audio.drawHold) * move)
    : 0
  const creakF = lerp(SFX.creakLoFreq, SFX.creakHiFreq, a.draw)
  if (
    sfx.creak !== null
    && (Math.abs(creakG - sfx.lastCreakG) > CHAN_EPS || Math.abs(creakF - sfx.lastCreakF) > CHAN_FREQ_EPS)
  ) {
    sfx.lastCreakG = creakG
    sfx.lastCreakF = creakF
    setChan(s, sfx.creak, creakG, creakF, drawing ? 0.02 : 0.05)
  }

  // ── 긴장음 ──
  // tremorAmp는 **빨간 바를 넘어야** 0이 아니다 (안전 구간에서는 sim이 정확히 0을 준다).
  // 즉 이 소리가 들리기 시작하는 순간이 곧 "경계선을 넘었다"의 청각 채널이다.
  // 제곱으로 눌러, 갓 넘긴 구간은 거의 안 들리고 붕괴가 가까울수록 차오르게 한다.
  const tr = clamp01(a.tremorAmp / P.audio.strainRef)
  const strainG = P.audio.strainGain * tr * tr
  if (sfx.strain !== null && Math.abs(strainG - sfx.lastStrainG) > CHAN_EPS * 0.5) {
    sfx.lastStrainG = strainG
    setChan(s, sfx.strain, strainG, SFX.tremorFreq, 0.06)
  }

  // ── 붕괴 예고 맥동 ──
  if (drawing && a.warn > 0) {
    sfx.beatPhase += dtReal * lerp(P.audio.beatSlow, P.audio.beatFast, a.warn)
    if (sfx.beatPhase >= 1) {
      // 밀린 만큼만 빼서 박이 흐르게 한다. 프레임이 튀어도 박이 몰리지 않게 상한을 둔다.
      sfx.beatPhase = sfx.beatPhase - 1 > 1 ? 0 : sfx.beatPhase - 1
      heartbeat(s, a.warn)
    }
  } else {
    sfx.beatPhase = 0
  }
}
