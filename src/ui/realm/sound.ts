/**
 * 칠십팔국의 소리 — public/realm/sfx (CC0 · 출처는 sfx/CREDITS.txt)
 *
 * 자리마다 후보가 a·b·c… 로 있다. 형이 public/realm/sound-picker.html 에서 듣고 고르면 PICK 의 글자만 바꾼다.
 * 배경 음악과 계절 바람소리는 둘 다 한 줄씩 돌고, 탭이 가려지면 멈춘다 (절대 규칙 4).
 */

/** 자리 → 고른 후보 */
export const PICK = {
  ui_order: 'b', ui_open: 'c', season_turn: 'a',
  war_drums: 'a', arrow_volley: 'a', horses: 'c',
  horn_victory: 'a', defeat: 'a', capture: 'b',
  dex_new: 'c', birth: 'c', feast: 'a', envoy: 'b', coins: 'c',
  amb_spring: 'a', amb_summer: 'b', amb_autumn: 'b', amb_winter: 'b',
  bgm_map: 'a', bgm_war: 'a',
} as const
export type Slot = keyof typeof PICK

/** ding 에 넘기는 이름 — public 아래 길 (확장자 없음) */
export const snd = (slot: Slot): string => `realm/sfx/${slot}_${PICK[slot]}`

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
export function playOnce(url: string, vol: number): void {
  if (document.visibilityState !== 'visible') return
  try {
    const a = new Audio(url)
    wire(a, vol)
    void audio()?.resume().catch(() => {})
    void a.play().catch(() => {})
  } catch { /* 소리를 못 내는 곳 */ }
}

/** 한 줄로 도는 소리 하나 (음악 · 바람). 곡마다 요소를 하나씩 두고 다시 쓴다 — 싸움 뒤 지도 음악은 멈춘 자리에서 잇는다 */
function track(base: string, vol: number): { want(slot: Slot | null): void; pause(): void; resume(): void } {
  const els = new Map<Slot, { el: HTMLAudioElement; gain: GainNode | null }>()
  let cur: Slot | null = null
  const node = (slot: Slot): { el: HTMLAudioElement; gain: GainNode | null } => {
    let n = els.get(slot)
    if (n === undefined) {
      const el = new Audio(`${base}${snd(slot)}.ogg`)
      el.loop = true
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
    want(slot) {
      if (slot === cur) { if (cur !== null && els.get(cur)?.el.paused !== false) start(); return }
      stop(cur)
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
  refresh(): void
} {
  const bgm = track(base, BGM_VOL)
  const amb = track(base, AMB_VOL)
  let mode: { bgm: Slot; amb: Slot | null } | null = null
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
    refresh: apply,
  }
}
