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
/** 음악을 바꿀 때 줄였다 키우는 걸음 (ms) */
const FADE_STEP = 60
const FADE_N = 10

/** 한 줄로 도는 소리 하나 (음악 · 바람) */
function track(base: string, vol: number): { want(slot: Slot | null): void; pause(): void; resume(): void } {
  let el: HTMLAudioElement | null = null
  let cur: Slot | null = null
  let fade = 0
  const stopFade = (): void => { if (fade !== 0) { clearInterval(fade); fade = 0 } }
  const start = (): void => {
    if (cur === null || document.visibilityState !== 'visible') return
    if (el === null) {
      el = new Audio(`${base}${snd(cur)}.ogg`)
      el.loop = true
      el.volume = 0
    }
    const a = el
    void a.play().then(() => {
      stopFade()
      let i = 0
      fade = window.setInterval(() => { i++; a.volume = vol * Math.min(1, i / FADE_N); if (i >= FADE_N) stopFade() }, FADE_STEP)
    }).catch(() => { /* 아직 손을 안 댔다 — 첫 탭에 다시 */ })
  }
  return {
    want(slot) {
      if (slot === cur) { if (el?.paused !== false) start(); return }
      stopFade()
      el?.pause()
      el = null
      cur = slot
      start()
    },
    pause() { stopFade(); el?.pause() },
    resume() { if (el === null || el.paused) start() },
  }
}

/** 배경 음악 + 계절 바람 — muted() 가 참이면 아무것도 안 튼다 */
export function makeMusic(base: string, muted: () => boolean): {
  map(season: 'spring' | 'summer' | 'autumn' | 'winter'): void
  war(): void
  refresh(): void
} {
  const bgm = track(base, BGM_VOL)
  const amb = track(base, AMB_VOL)
  let mode: { bgm: Slot; amb: Slot | null } | null = null
  const apply = (): void => {
    if (mode === null || muted()) { bgm.want(null); amb.want(null); return }
    bgm.want(mode.bgm)
    amb.want(mode.amb)
  }
  // 탭이 가려지면 멈추고, 돌아오면 잇는다 · 브라우저는 손을 대기 전엔 소리를 막으니 첫 탭에 다시 튼다
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { if (!muted()) { bgm.resume(); amb.resume() } } else { bgm.pause(); amb.pause() }
  })
  document.addEventListener('pointerdown', () => { if (!muted()) { bgm.resume(); amb.resume() } }, { capture: true })
  return {
    map(season) { mode = { bgm: 'bgm_map', amb: `amb_${season}` }; apply() },
    war() { mode = { bgm: 'bgm_war', amb: null }; apply() },
    refresh: apply,
  }
}
