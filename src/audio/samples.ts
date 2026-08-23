/**
 * 샘플 로더 — Kenney CC0 실사운드 (`public/sfx/`, 출처는 그 폴더의 CREDITS.txt)
 *
 * 왜 이 파일이 생겼나: 합성음은 "활시위"처럼 값에 연속 반응해야 하는 소리에는 강하지만
 * 나무에 화살이 박히는 소리 · 유리가 깨지는 소리 · 종소리는 아무리 성형해도 흉내다.
 * 이미 받아둔 진짜 소리가 있으면 그걸 쓰는 게 맞다. **어느 소리를 샘플로 두었는지는 sfx.ts 상단에 있다.**
 *
 * ── 이 파일이 절대 어기면 안 되는 것 ───────────────────────────────────────
 *
 * 1. **첫 화면을 막지 않는다 (C1·C6).**
 *    - 파일은 `public/` 아래에 있어 JS 번들에 한 바이트도 들어가지 않는다. import도 없다.
 *    - 로딩은 **첫 사용자 제스처 뒤에** 시작한다 (sfx.ts의 ensure). 자동재생 정책과도 맞고,
 *      음소거로 켜둔 사람에게는 아예 네트워크 요청이 나가지 않는다 (C3).
 *    - 게임 루프는 이 프라미스를 **기다리지 않는다.** 아직 안 온 소리는 그냥 안 난다.
 * 2. **실패해도 게임이 멈추지 않는다.** fetch 404 · CORS · Safari의 ogg 미지원으로 인한
 *    decodeAudioData 거부 — 전부 삼킨다. `get()`이 null을 돌려주면 sfx.ts가 합성음으로 되돌아간다.
 *    즉 샘플은 **덧칠**이지 의존이 아니다.
 * 3. 여기서 쓰는 `Math.random`은 변주 선택 전용이고 sim의 시드 스트림(core/rng.ts)과 완전히
 *    분리돼 있다. 오디오는 sim이 아니다 (ARCHITECTURE A1) — synth.ts의 노이즈 오프셋과 같은 규칙.
 */
import { P } from '../tune/params.ts'

/**
 * 소리의 **종류**지 파일이 아니다. 한 종류에 변주가 여럿 딸려 있고, 매번 무작위로 하나 고른다.
 * 같은 파일이 반복되면 아무리 좋은 소리도 두 번째부터 "복사-붙여넣기"로 들린다.
 */
export type SampleName =
  /** 화살이 나무 과녁에 박힘 — 가장자리 명중 */
  | 'wood'
  /** 같은 나무지만 두껍게 — 중심에 가깝게 박혔을 때 */
  | 'woodHeavy'
  /** 공중 과녁이 깨짐 (연쇄) */
  | 'glass'
  /** 공중 과녁 직격 — 연쇄의 뿌리라 더 크게 */
  | 'glassHeavy'
  /** 정중앙 (크리티컬) */
  | 'bell'
  /** 빗나가 땅에 박힘 */
  | 'soft'
  /** 관통 */
  | 'plank'
  /** UI — 누름 */
  | 'click'
  /** UI — 지나감 */
  | 'rollover'
  /** UI — 열림/해금 */
  | 'switch'

/** 확장자와 폴더는 여기 한 곳에만 적는다. */
const DIR = 'sfx/'
const EXT = '.ogg'

/**
 * 종류 → 파일 변주 목록.
 *
 * public/sfx/CREDITS.txt 의 목록과 1:1이다. 파일을 추가하려면 거기 넣고 여기 이름만 적으면 된다 —
 * 로더는 없는 파일을 만나도 그 하나만 조용히 건너뛴다.
 */
const FILES: Readonly<Record<SampleName, readonly string[]>> = {
  wood: ['impactWood_medium_000', 'impactWood_medium_001', 'impactWood_medium_002', 'impactWood_medium_003'],
  woodHeavy: ['impactWood_heavy_000', 'impactWood_heavy_001'],
  glass: ['impactGlass_light_000', 'impactGlass_light_001', 'impactGlass_light_002'],
  glassHeavy: ['impactGlass_medium_000', 'impactGlass_medium_001'],
  bell: ['impactBell_heavy_000', 'impactBell_heavy_001'],
  soft: ['impactSoft_medium_000', 'impactSoft_medium_001'],
  plank: ['impactPlank_medium_000', 'impactPlank_medium_001'],
  click: ['click1', 'click2'],
  rollover: ['rollover1', 'rollover2'],
  switch: ['switch2', 'switch3'],
}

/** 순회용 키 목록. 매번 Object.keys를 부르면 배열이 새로 생긴다 (A5). */
const NAMES = Object.keys(FILES) as SampleName[]

/**
 * 재생 장치의 물성 — synth.ts의 AUDIO와 같은 성격이다. 손맛 값(음량·피치)이 아니라
 * "같은 소리를 두 번 겹쳐 틀면 플램이 된다" 같은 재생기의 제약이라 여기 남는다.
 */
const SAMPLE = {
  /** 같은 종류가 이 간격 안에 또 오면 통째로 버린다 (s). 한 프레임에 두 번 들어온 명중을 지운다. */
  hardGap: 0.012,
  /** 노드를 끊기 전 여유 (s). 꼬리를 바로 자르면 딸깍 소리가 난다. */
  tail: 0.02,
  /** playbackRate 안전 범위. 0 이하면 예외가 나고, 너무 높으면 소리가 아니라 클릭이 된다. */
  minRate: 0.25,
  maxRate: 4,
  /** 이만큼 넘게 뒤처져 예약된 소리는 그림과 따로 논다. 예약 자체를 버린다 (s). */
  maxDelay: 0.5,
} as const

/**
 * 샘플 뱅크. `get`/`ready` 외의 필드는 **내부 상태**다 — 바깥에서 읽지도 쓰지도 않는다.
 * (뱅크를 클래스나 클로저로 감싸면 playSample이 매번 클로저를 타야 해서 이 형태로 뒀다.)
 */
export interface SampleBank {
  /** 그 종류의 변주 하나를 무작위로. 아직 안 왔거나 실패했으면 null — 호출자는 소리를 건너뛴다. */
  get(name: SampleName): AudioBuffer | null
  /** 모든 요청이 끝났는가 (성공이든 실패든). 게임은 이 값을 기다리지 않는다. */
  ready: boolean

  /** 내부 — 디코딩에 쓰는 컨텍스트 */
  readonly ctx: AudioContext
  /** 내부 — 종류별로 도착한 버퍼들 */
  readonly slots: Map<SampleName, AudioBuffer[]>
  /** 내부 — 종류별 직전 변주 인덱스. 같은 변주 연속 재생을 막는다. */
  readonly lastPick: Map<SampleName, number>
  /** 내부 — 종류별 마지막 예약 시각. 플램 제거. */
  readonly lastAt: Map<SampleName, number>
  /** 내부 — 보이스 슬롯별 종료 시각 (ctx 시간) */
  readonly voiceEnd: Float64Array
  /** 내부 — 진행 중인 로딩. 두 번 부르면 같은 프라미스가 돌아온다. */
  loading: Promise<void> | null
  /** 내부 — 못 받은 파일 수. 진단용. */
  failed: number
}

/** 재생 옵션. 호출부가 스크래치 객체를 재사용하도록 전부 필수 필드다 (A5 — 소리마다 객체 생성 금지). */
export interface SampleOpts {
  gain: number
  /**
   * 피치 배수. 1 = 원음.
   * 샘플은 피치를 올리면 길이도 같이 줄어든다 — 합성음과 다른 점이고, **타격음에는 오히려 맞다.**
   * 높은 소리일수록 짧고 가벼워야 연쇄가 "보로로로록"으로 들린다.
   */
  rate: number
  /** 좌우 -1..1. StereoPanner가 없는 브라우저에서는 무시된다. */
  pan: number
  /** 지금부터 이만큼 뒤에 시작 (s). setTimeout이 아니라 WebAudio 예약이다 — 타이머는 밀린다. */
  delay: number
}

/**
 * 끝난 노드를 그래프에서 떼어낸다. 모듈 레벨 함수라 소리마다 클로저를 새로 만들지 않는다 (A5).
 * 소스만 끊으면 뒤에 달린 게인·패너는 참조가 끊겨 알아서 수거된다 (연결은 상류→하류 단방향).
 */
function releaseNode(this: AudioScheduledSourceNode): void {
  this.disconnect()
}

/**
 * 배포 경로. GitHub Pages 서브경로 배포에서는 base가 '/'가 아니다 (vite.config.ts).
 * 절대경로 '/sfx/…'로 박으면 서브경로에서 전부 404가 난다.
 */
function assetUrl(file: string): string {
  // 빌드 시 vite가 통째로 문자열로 치환한다. vite 밖(노드 헤드리스 프로브 등)에서는
  // import.meta.env 자체가 없어 던지므로 루트로 본다 — 여기서 죽으면 소리가 통째로 사라진다.
  let base = '/'
  try {
    base = import.meta.env.BASE_URL || '/'
  } catch {
    base = '/'
  }
  return `${base.endsWith('/') ? base : `${base}/`}${DIR}${file}${EXT}`
}

export function createSampleBank(ctx: AudioContext): SampleBank {
  const slots = new Map<SampleName, AudioBuffer[]>()
  for (let i = 0; i < NAMES.length; i++) {
    const n = NAMES[i]
    if (n !== undefined) slots.set(n, [])
  }

  const lastPick = new Map<SampleName, number>()

  return {
    get(name: SampleName): AudioBuffer | null {
      const list = slots.get(name)
      if (list === undefined || list.length === 0) return null
      if (list.length === 1) return list[0] ?? null
      let i = Math.floor(Math.random() * list.length)
      // 같은 변주가 연달아 나오면 변주를 넣은 의미가 없다. 한 칸 민다.
      if (i === lastPick.get(name)) i = (i + 1) % list.length
      lastPick.set(name, i)
      return list[i] ?? null
    },
    ready: false,
    ctx,
    slots,
    lastPick,
    lastAt: new Map<SampleName, number>(),
    // 슬롯 수는 생성 시 한 번만 읽는다. 판 도중 배열을 다시 잡으면 힙이 튄다 (A5).
    voiceEnd: new Float64Array(Math.max(1, Math.round(P.audio.maxVoices))),
    loading: null,
    failed: 0,
  }
}

/** 그 소리를 지금 낼 수 있는가. get()을 호출하면 변주 커서가 움직이므로 판단용으로는 이걸 쓴다. */
export function hasSample(bank: SampleBank, name: SampleName): boolean {
  const list = bank.slots.get(name)
  return list !== undefined && list.length > 0
}

// ───────────────────────────── 로딩 ─────────────────────────────

/**
 * 파일 하나. **어떤 실패도 밖으로 던지지 않는다.**
 * 하나가 없어도 나머지는 그대로 오고, 전부 없어도 게임은 합성음으로 돈다.
 */
async function loadOne(bank: SampleBank, name: SampleName, file: string): Promise<void> {
  try {
    const res = await fetch(assetUrl(file))
    if (!res.ok) {
      bank.failed++
      return
    }
    const raw = await res.arrayBuffer()
    // 프라미스형 decodeAudioData. 코덱을 모르는 브라우저(구형 Safari의 ogg)는 여기서 거부한다.
    const buf = await bank.ctx.decodeAudioData(raw)
    const list = bank.slots.get(name)
    if (list !== undefined) list.push(buf)
  } catch {
    bank.failed++
  }
}

/**
 * 전부 뒤에서 받는다. **호출자는 await하지 않아도 된다** — 오히려 하지 않는 게 정상 경로다.
 * 두 번 불러도 같은 프라미스가 돌아오고, 이 프라미스는 절대 reject되지 않는다.
 *
 * 총량 216KB. 병렬로 던지는 이유는 파일이 전부 5~15KB라 한 줄로 세우면 왕복 지연만 늘기 때문이다.
 */
export function loadSamples(bank: SampleBank): Promise<void> {
  const running = bank.loading
  if (running !== null) return running

  const jobs: Array<Promise<void>> = []
  for (let i = 0; i < NAMES.length; i++) {
    const name = NAMES[i]
    if (name === undefined) continue
    const files = FILES[name]
    for (let j = 0; j < files.length; j++) {
      const f = files[j]
      if (f !== undefined) jobs.push(loadOne(bank, name, f))
    }
  }

  const p = Promise.all(jobs).then(
    () => {
      bank.ready = true
    },
    () => {
      // loadOne이 이미 전부 삼키므로 여기 올 일이 없지만, 와도 게임은 그대로 돈다.
      bank.ready = true
    },
  )
  bank.loading = p
  return p
}

// ───────────────────────────── 재생 ─────────────────────────────

/**
 * 보이스 슬롯을 잡는다. 빈 슬롯이 없으면 그 소리를 버린다 — synth.ts의 claim과 같은 규칙이다.
 * 이미 울리는 걸 끊으면 딸깍 소리가 나므로 **새 소리를 버린다.**
 *
 * 기준이 호출 시각이 아니라 시작 시각인 이유도 같다: 연쇄 아르페지오처럼 미래에 예약된 소리를
 * 지금 기준으로 세면 실제로는 겹치지도 않는 소리들이 서로를 밀어낸다.
 */
function claim(bank: SampleBank, start: number, end: number): boolean {
  const v = bank.voiceEnd
  for (let i = 0; i < v.length; i++) {
    if ((v[i] ?? 0) <= start) {
      v[i] = end
      return true
    }
  }
  return false
}

/**
 * 샘플 한 방. dest는 보통 synth의 마스터 게인이다 — 그래야 음소거·볼륨·컴프레서가
 * 합성음과 **같은 하나**를 지난다. 클리핑 방지는 그 컴프레서가 맡는다.
 *
 * 아직 안 받아진 소리는 조용히 건너뛴다. 그게 이 파일의 계약이다.
 */
export function playSample(
  ctx: AudioContext,
  bank: SampleBank,
  dest: AudioNode,
  name: SampleName,
  o: SampleOpts,
): void {
  if (o.gain <= 0 || ctx.state !== 'running') return
  const buf = bank.get(name)
  if (buf === null) return

  const delay = o.delay > 0 ? o.delay : 0
  if (delay > SAMPLE.maxDelay) return
  const t0 = ctx.currentTime + delay

  // 플램 제거. 한 프레임에 같은 종류가 두 번 들어와도 하나만 남는다.
  const prev = bank.lastAt.get(name) ?? 0
  if (t0 - prev < SAMPLE.hardGap) return
  bank.lastAt.set(name, t0)

  const rate = o.rate < SAMPLE.minRate ? SAMPLE.minRate : o.rate > SAMPLE.maxRate ? SAMPLE.maxRate : o.rate
  const stop = t0 + buf.duration / rate + SAMPLE.tail
  if (!claim(bank, t0, stop)) return

  const g = ctx.createGain()
  g.gain.value = o.gain

  // StereoPanner는 구형 사파리에 없다. 없으면 팬만 포기하고 소리는 낸다.
  const pan = o.pan < -1 ? -1 : o.pan > 1 ? 1 : o.pan
  if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    g.connect(p)
    p.connect(dest)
  } else {
    g.connect(dest)
  }

  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = rate
  src.connect(g)
  src.onended = releaseNode
  try {
    src.start(t0)
  } catch {
    // 컨텍스트가 그 사이 닫혔다. 슬롯은 시간이 지나면 저절로 풀린다.
    src.disconnect()
    g.disconnect()
  }
}

/** 탭이 숨거나 음소거될 때. 예약 커서를 되감아, 다시 켰을 때 옛 시각이 새 소리를 막지 않게 한다. */
export function resetSampleVoices(bank: SampleBank): void {
  bank.voiceEnd.fill(0)
  bank.lastAt.clear()
}

/** 진단용 한 줄. "소리가 왜 안 나지"를 3초 안에 답하기 위한 것 (dev 콘솔에서만 쓴다). */
export function sampleStatus(bank: SampleBank): string {
  let n = 0
  for (let i = 0; i < NAMES.length; i++) {
    const name = NAMES[i]
    if (name === undefined) continue
    n += bank.slots.get(name)?.length ?? 0
  }
  return `samples ${n} loaded / ${bank.failed} failed / ready=${bank.ready ? 'y' : 'n'}`
}
