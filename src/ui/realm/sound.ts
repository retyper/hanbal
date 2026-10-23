/**
 * 칠십팔국의 소리 — public/realm/sfx (CC0 · 출처는 sfx/CREDITS.txt)
 *
 * 자리마다 후보가 a·b·c… 로 있다. 형이 public/realm/sound-picker.html 에서 듣고 고르면 PICK 의 글자만 바꾼다.
 * 배경 음악과 계절 바람소리는 둘 다 한 줄씩 돌고, 탭이 가려지면 멈춘다 (절대 규칙 4).
 */

/** 자리 → 고른 후보 */
export const PICK = {
  // c1·c3·c6 … — 형이 소리 고르기 판(claude.ai 아티팩트)에서 고른 것 · 출처는 sfx/CREDITS.txt 끝 (10-23)
  ui_order: 'b', ui_open: 'c', season_turn: 'c1',
  war_drums: 'a', arrow_volley: 'c3', horses: 'c',
  horn_victory: 'a', defeat: 'a', capture: 'b',
  dex_new: 'c', birth: 'c', feast: 'a', envoy: 'b', coins: 'c',
  amb_spring: 'a', amb_summer: 'b', amb_autumn: 'b', amb_winter: 'b',
  // g1·g2·g3 — 공유마당(공공누리 제1유형 · CC BY)에서 받은 후보 (형 10-23: "공공누리에서 니가 싹 받아와서 쓸 수 있는 거면 다 해 · 출처표기 주의").
  // 출처는 sfx/CREDITS.txt 끝 · 첫 화면의 「소리 출처」. 형이 sound-picker.html 에서 듣고 고르면 글자만 바꾼다
  bgm_map: 'f', bgm_war: 'c7',
  // 이기고 진 뒤의 음악 — 이김은 형이 받은 "즐겁게 추격하는 듯한 한국풍" (싸움 음악으로는 너무 신났다 — 형 10-23)
  bgm_win: 'a', bgm_lose: 'c3',
  // 첫 화면(로그인·이어 하기) 음악 — 웅장한 것 (형 10-23: "로그인 화면 메인은 웅장한 bgm 따로")
  bgm_title: 'c6',
  // 누를 때 나는 소리 — 누른 것의 바탕(쇠·엽전·붓·말굽·방울·북·바둑돌·딱따기)대로 (형 10-23: "탭할 때 나는 sfx 도 소재에 맞게 다양한 소리")
  // 싸움의 함성 — 싸움이 열릴 때 · 돌격·추격 합에 (형 10-23: "전투라면 함성소리가 있어야")
  war_cry: 'c1',
  // 맞부딪힘 — 한 합마다 · 필살(상성에서 이긴 합)은 더 무겁게. 쇠 한 번 "팅"이 아니라 여럿이 칼·창·방패로 엉겨 붙는 소리 (형 10-23: "진짜 전투하는 효과음")
  battle_clash: 'c14', battle_crit: 'g1',
  // 판이 끝났을 때(이겼다·졌다 화면) — 싸움 하나 이긴·진 음악과 따로 (형 10-23: "게임 승리했을 때나 패배했을 때 사운드는 없어?")
  bgm_end_win: 'w5', bgm_end_lose: 'c6',
  // 깃발 소리 — 깃발마다 제 소리 (형 10-23: "돌격 방진 바위 굴리기 … 다 그만의 이펙트와 사운드") · 맞쏘기는 화살비 소리를 흩어 친다
  // 싸움이 열릴 때 — 종 「댕」 한 번 · 북 두 번 (형 10-23: "싸움 발생할 때 댕 하고 이상한 소리 · 소리 설정 웹페이지에서 바꿀 수 있게") — k1 은 옛 활터 소리
  war_bell: 'c5', war_drum: 'c4', draft_go: 'c4', arm_go: 'c6',
  march_go: 'c8', cmd_counter: 'c10', cmd_art: 'c2', cmd_capture: 'c1', cmd_charge: 'm1', cmd_drum: 'c1', cmd_duel: 'c1', cmd_fire: 'c3', cmd_ford: 'c5', cmd_gate: 'c4', cmd_guard: 'c3', cmd_height: 'c5', cmd_hold: 'c2', cmd_horse: 'c4', cmd_open: 'c3', cmd_ram: 'c3', cmd_retreat: 'c4', cmd_rocks: 'c1',
  tap_arms: 'g1', tap_coin: 'g1', tap_brush: 'g1', tap_move: 'g1', tap_bell: 'g1', tap_drum: 'g1', tap_map: 'g1', tap_cancel: 'g1',
} as const
/** ogg 가 아닌 후보 — 형이 받아 온 것은 받은 꼴 그대로 · 공유마당 음악은 mp3 · 누르는 소리는 브라우저로 잘라 낸 wav */
const EXT: Readonly<Partial<Record<string, string>>> = {
  bgm_map_f: 'mp3', bgm_map_g: 'mp3', bgm_win_a: 'mp3',
  ...Object.fromEntries(['bgm_title', 'bgm_war', 'bgm_lose'].flatMap((s) => ['g1', 'g2', 'g3'].map((g) => [`${s}_${g}`, 'mp3']))),
  war_cry_g1: 'wav', war_cry_g2: 'wav', war_cry_g3: 'wav',
  ...Object.fromEntries(['battle_clash', 'battle_crit'].flatMap((s) => ['g1', 'g2', 'g3'].map((g) => [`${s}_${g}`, 'mp3']))),
  ...Object.fromEntries(['tap_arms', 'tap_coin', 'tap_brush', 'tap_move', 'tap_bell', 'tap_drum', 'tap_map', 'tap_cancel'].flatMap((s) => ['g1', 'g2', 'g3'].map((g) => [`${s}_${g}`, 'wav']))),
}
export type Slot = keyof typeof PICK
/** 아직 파일을 안 받은 자리 — 없으면 소리 없이 듣던 음악을 둔다 (있으면 출처를 적는다) */
export const LATER: ReadonlySet<Slot> = new Set<Slot>([])
/** 한 곡이 끝나면 다음 곡으로 넘어가는 자리 — 첫 글자가 PICK 이다 (형이 받은 평상시 음악 둘: bgm후보 · 배경음2) */
// 형 10-23 소리 고르기 판: 지도 = 형의 두 곡 + 국악 BGM 다섯 · 싸움 = 사물놀이 둘
export const ROTATE: Readonly<Partial<Record<Slot, readonly string[]>>> = { bgm_map: ['f', 'c2', 'c9', 'c3', 'c4', 'c10'], bgm_war: ['c7', 'c8'] }
/**
 * 곡마다 소리 크기 — 형이 가져온 지도 곡(-16dB 언저리)에 맞춘다 (형 10-23: "소리도 너무 커"). 1 보다 크게는 못 키운다.
 * 2026-10-23 잰 값: map c4 -12.0 · c9 -11.9 · war c7 -12.5 · title c6 -14.0 · 끝 이김 w5(Joy of Victory) -18.0 · 끝 짐 c6 -14.8
 */
const TRACK_GAIN: Readonly<Partial<Record<string, number>>> = {
  // 싸움 음악(사물놀이)은 꽹과리가 앞에 나서 깃발 소리를 덮는다 — 지도 음악보다 한참 낮게 (형 10-23: "꽹과리 소리 너무 많이 시끄러운데")
  bgm_map_c4: 0.56, bgm_map_c9: 0.56, bgm_war_c7: 0.3, bgm_war_c8: 0.5, bgm_title_c6: 0.72, bgm_end_lose_c6: 0.87,
}
const gainOf = (slot: Slot, pick: string = PICK[slot]): number => TRACK_GAIN[`${slot}_${pick}`] ?? 1

type TapSlot = Extract<Slot, `tap_${string}`>
/** 누른 단추(data-act) → 그 바탕의 소리. 맞는 줄이 없으면 나무 딱(ui_order) */
const TAP: ReadonlyArray<readonly [RegExp, TapSlot | 'ui_open']> = [
  // 닫기 · 물리기 · 되돌리기
  [/^(close|rep-close|selclose|dex-close|failclose|sortie-cancel|fr-back|turnback|undo-split|pp-close|pp-undo|un[a-z]+)$/, 'tap_cancel'],
  // 책장 · 기록 · 도움말
  [/-open$|^film-|^(help|tab|log-n|log-f|mig-n|layers|layer|deeds|jump|roadkey|hero)$/, 'ui_open'],
  // 군사 — 뽑기 · 편성 · 진군 · 지키기 · 쏘기
  [/^(draft|dunit|diron|dn|assign|tok|sq|sqall|ap|mv|go|guard|arm|shoot|sortie-go|lead|merge|selmerge|disband|bowup|shero|sdest|sstay)$/, 'tap_arms'],
  // 곡식 · 쇠 · 교역 — 고용 · 짓기 · 군량 · 주고받기
  [/^(hire|build|ration|cq)$/, 'tap_coin'],
  // 글 · 꾀 · 사신 — 붓과 도장
  [/^(compose|compose-go|ctarget|chero|plot|nat-plot|pagent|persuade|pby|answer|envoy|nat-diplo|dmode)$/, 'tap_brush'],
  // 사람이 움직인다 — 정찰 · 원정 · 옮겨 살기
  [/^(scout|exp-go|exp-dest|exp-len|settle|sn|sfrom|migrate|mig-[a-z]+|pgo|pp-[a-z]+|pl-[a-z]+)$/, 'tap_move'],
  // 고르기 · 혼인 · 제사
  [/^(wed|rite|card-pick|tier-pick|dex-sel|keep|carry-tog|focus)$/, 'tap_bell'],
  // 지도의 고을을 누른다 — 바둑돌 놓듯
  [/^node$/, 'tap_map'],
  // 판을 연다
  [/^(fr-start|fr-board|fr-nation|fr-again|fr-endless|fr-tutorial|fr-new|newgame|continue)$/, 'tap_drum'],
]
/** 형의 파일이 오기 전에 대신 내는 소리 — null 이면 소리 없이 (지금까지와 같게) */
const TAP_STANDIN: Readonly<Record<TapSlot, Slot | null>> = {
  tap_arms: 'ui_order', tap_coin: 'ui_order', tap_brush: 'ui_order', tap_move: 'ui_order',
  tap_bell: 'ui_order', tap_drum: 'ui_order', tap_cancel: 'ui_order', tap_map: null,
}
/** 누른 것의 소리 — 아직 안 받은 자리면 대신 소리 (없으면 null) */
export function tapSlot(act: string): Slot | null {
  const s = TAP.find(([re]) => re.test(act))?.[1] ?? 'ui_order'
  if (s === 'ui_open' || s === 'ui_order' || !LATER.has(s)) return s
  return TAP_STANDIN[s]
}

/** ding 에 넘기는 이름 — public 아래 길 (확장자까지 — 형이 받아 온 mp3 도 있다) */
export const snd = (slot: Slot): string => `realm/sfx/${sndFile(slot)}`
/** 고른 후보의 파일 이름 (확장자까지) */
export const sndFile = (slot: Slot, pick: string = PICK[slot]): string => `${slot}_${pick}.${EXT[`${slot}_${pick}`] ?? 'ogg'}`

/** 장면 그림(event-*) → 그 장면의 소리. 없으면 소리 없이 */
export const SCENE_SOUND: Readonly<Record<string, Slot>> = {
  'event-marriage': 'feast', 'event-festival': 'feast', 'event-egg-birth': 'birth',
  'event-alliance-oath': 'envoy', 'event-outside-envoy': 'envoy', 'event-iron-trade': 'coins',
  'event-relief-cavalry': 'horses', 'event-captive-persuade': 'capture', 'event-wanderer-arrives': 'horses',
}

/** 소리 크기 — 음악은 뒤에 깔리게, 바람소리는 더 낮게 */
const BGM_VOL = 0.22
const AMB_VOL = 0.1
/** 음악이 들어오고 빠지는 빠르기 (초 — setTargetAtTime 의 시간 상수) */
const FADE_S = 0.25

/**
 * 크기는 Web Audio 의 gain 으로 준다 — 아이폰 사파리는 <audio>.volume 을 무시하고 늘 1로 튼다.
 * 문서에 하나만 두고, 탭이 가려지면 멈춘다 (makeMusic). 없는 곳에선 .volume 으로.
 */
let ctx: AudioContext | null | undefined
function audio(): AudioContext | null {
  if (ctx !== undefined) return ctx
  type Ctor = new () => AudioContext
  const g = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
  const C = g.AudioContext ?? g.webkitAudioContext
  try { ctx = C !== undefined ? new C() : null } catch { ctx = null }
  return ctx
}

/** <audio> 를 gain 에 이어 둔다 — 크기는 gain 으로 */
function wire(el: HTMLAudioElement, vol: number): GainNode | null {
  const c = audio()
  if (c === null) { el.volume = vol; return null }
  try {
    const gain = c.createGain()
    gain.gain.value = vol
    c.createMediaElementSource(el).connect(gain).connect(c.destination)
    return gain
  } catch {
    el.volume = vol
    return null
  }
}

/** 한 번 울리는 소리 (ding) — 탭이 가려져 있으면 안 낸다 */
/**
 * 한 번 울리는 소리는 한 번 풀어(decode) 두고 다시 쓴다 — 예전엔 울릴 때마다 <audio> 와 노드를 새로 만들고 풀지 않아
 * 오래 하면 쌓여 소리가 버벅였다 (형 10-23: "대패했을 때 음악 소리가 버벅거리는데 … 메모리 쓰고 있는지")
 */
const buffers = new Map<string, Promise<AudioBuffer | null>>()
function bufferOf(c: AudioContext, url: string): Promise<AudioBuffer | null> {
  let p = buffers.get(url)
  if (p === undefined) {
    p = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status))))).then((b) => c.decodeAudioData(b)).catch(() => null)
    buffers.set(url, p)
  }
  return p
}

/** rate — 빠르기(=높낮이). 같은 소리를 여러 번 겹칠 때 조금씩 달리 낸다 (화살비 여러 발) */
/** 한 번 낸다 — dur 를 주면 앞부분만 그만큼 울리고 끝을 살짝 줄이며 끊는다 (싸움 깃발 소리가 겹쳐 뭉개지지 않게) */
export function playOnce(url: string, vol: number, rate = 1, dur = 0): void {
  if (document.visibilityState !== 'visible') return
  const c = audio()
  if (c === null) {
    try { const a = new Audio(url); a.volume = vol; a.playbackRate = rate; void a.play().catch(() => {}) } catch { /* 소리를 못 내는 곳 */ }
    return
  }
  void c.resume().catch(() => {})
  void bufferOf(c, url).then((buf) => {
    if (buf === null || document.visibilityState !== 'visible') return
    const src = c.createBufferSource()
    const gain = c.createGain()
    gain.gain.value = vol
    src.buffer = buf
    src.playbackRate.value = rate
    src.connect(gain).connect(c.destination)
    src.onended = () => { src.disconnect(); gain.disconnect() } // 다 울면 풀어 준다
    src.start()
    if (dur > 0 && dur < buf.duration / rate) {
      const t = c.currentTime
      gain.gain.setValueAtTime(vol, t + Math.max(0, dur - 0.18))
      gain.gain.linearRampToValueAtTime(0, t + dur)
      src.stop(t + dur + 0.02)
    }
  })
}

/** 한 줄로 도는 소리 하나 (음악 · 바람). 곡마다 요소를 하나씩 두고 다시 쓴다 — 싸움 뒤 지도 음악은 멈춘 자리에서 잇는다 */
function track(base: string, vol: number): { prime(slot: Slot): void; want(slot: Slot | null): void; pause(): void; resume(): void } {
  const els = new Map<Slot, { el: HTMLAudioElement; gain: GainNode | null }>()
  let cur: Slot | null = null
  /** 바로 앞에 틀던 곡 — 새 곡 파일이 없으면 이리로 돌아간다 */
  let prev: Slot | null = null
  /** 파일이 없는 곡 (아직 안 받은 승리·패배 음악) */
  const missing = new Set<Slot>()
  const node = (slot: Slot): { el: HTMLAudioElement; gain: GainNode | null } => {
    let n = els.get(slot)
    if (n === undefined) {
      const el = new Audio(`${base}realm/sfx/${sndFile(slot)}`)
      el.preload = 'auto'
      el.volume = gainOf(slot)
      const list = ROTATE[slot]
      el.loop = list === undefined
      if (list !== undefined) {
        // 한 곡이 끝나면 다음 곡 — 같은 요소에 주소만 바꿔 끼운다
        let i = 0
        el.addEventListener('ended', () => {
          i = (i + 1) % list.length
          el.src = `${base}realm/sfx/${sndFile(slot, list[i])}`
          el.volume = gainOf(slot, list[i])
          if (cur === slot) start()
        })
      }
      el.addEventListener('error', () => {
        missing.add(slot)
        if (cur === slot) { cur = null; if (prev !== null && !missing.has(prev)) { cur = prev; start() } }
      })
      n = { el, gain: wire(el, vol) }
      if (n.gain !== null) n.gain.gain.value = 0
      els.set(slot, n)
    }
    return n
  }
  const start = (): void => {
    if (cur === null || document.visibilityState !== 'visible') return
    const n = node(cur)
    void n.el.play().then(() => {
      if (n.gain !== null && ctx) n.gain.gain.setTargetAtTime(vol, ctx.currentTime, FADE_S)
    }).catch(() => { /* 아직 손을 안 댔다 — 첫 탭에 다시 */ })
  }
  const stop = (slot: Slot | null): void => {
    const n = slot !== null ? els.get(slot) : undefined
    if (n === undefined) return
    n.el.pause()
    if (n.gain !== null) n.gain.gain.value = 0
  }
  return {
    /** 미리 받아 둔다 — 틀기 전에 다 받아 두어야 처음에 버벅이지 않는다 (싸움이 열리면 이긴·진 음악을) */
    prime(slot) { if (!missing.has(slot)) node(slot).el.load() },
    want(slot) {
      if (slot !== null && missing.has(slot)) return // 없는 곡 — 듣던 것을 그대로
      if (slot === cur) { if (cur !== null && els.get(cur)?.el.paused !== false) start(); return }
      stop(cur)
      prev = cur
      cur = slot
      start()
    },
    pause() { stop(cur) },
    resume() { if (cur !== null && els.get(cur)?.el.paused !== false) start() },
  }
}

/** 배경 음악 + 계절 바람 — muted() 나 quiet()(밤 판이 떠 있다) 가 참이면 안 튼다 */
export function makeMusic(base: string, muted: () => boolean, quiet: () => boolean): {
  map(season: 'spring' | 'summer' | 'autumn' | 'winter'): void
  war(): void
  /** 첫 화면 — 판 음악을 끊고 첫 화면 음악 (아직 없으면 조용히) */
  title(): void
  /** 싸움이 열렸다 — 이긴·진 음악을 미리 받아 둔다 */
  primeResults(): void
  /** 이겼다 · 졌다 — 싸움 끝 · 판 끝 */
  result(kind: 'win' | 'lose'): void
  ending(kind: 'win' | 'lose'): void
  refresh(): void
} {
  const bgm = track(base, BGM_VOL)
  const amb = track(base, AMB_VOL)
  let mode: { bgm: Slot | null; amb: Slot | null } | null = null
  const off = (): boolean => mode === null || muted() || quiet()
  const apply = (): void => {
    if (off()) { bgm.want(null); amb.want(null); return }
    bgm.want(mode!.bgm)
    amb.want(mode!.amb)
  }
  // 탭이 가려지면 멈추고, 돌아오면 잇는다 · 브라우저는 손을 대기 전엔 소리를 막으니 첫 탭에 다시 튼다
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void ctx?.resume().catch(() => {})
      if (!off()) { bgm.resume(); amb.resume() }
    } else {
      bgm.pause(); amb.pause()
      void ctx?.suspend().catch(() => {})
    }
  })
  document.addEventListener('pointerdown', () => {
    void audio()?.resume().catch(() => {})
    if (!off()) { bgm.resume(); amb.resume() }
  }, { capture: true })
  return {
    map(season) { mode = { bgm: 'bgm_map', amb: `amb_${season}` }; apply() },
    war() { mode = { bgm: 'bgm_war', amb: null }; apply() },
    title() { mode = { bgm: LATER.has('bgm_title') ? null : 'bgm_title', amb: null }; apply() },
    primeResults() { bgm.prime('bgm_win'); bgm.prime('bgm_lose') },
    result(kind) { mode = { bgm: kind === 'win' ? 'bgm_win' : 'bgm_lose', amb: null }; apply() },
    /** 판이 끝났다 — 이겼다·졌다 화면의 음악 */
    ending(kind) { mode = { bgm: kind === 'win' ? 'bgm_end_win' : 'bgm_end_lose', amb: null }; apply() },
    refresh: apply,
  }
}
