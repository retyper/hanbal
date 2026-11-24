/**
 * 장수 겨루기 — 화면 (어디서든 띄운다: 시험판 duel.html · 본편 전투판의 「장수 겨루기」 깃발).
 * 셈은 ./sim.ts. 여기는 그 상태를 읽기만 한다 (절대 규칙 2).
 *
 * 형 11-09: "화면에는 적장 이미지가 크게 · 내 장수와 적장 전투 그림은 작게 들판 하단 · QTE 로 적이 공격 들어올 위치에 큰 원이 모임 ·
 * 붙이자 · 시작이랑 종료시 뜨는 것도 말끔히 정리 · 실제 전투에서 필요한 것만 · 확인 버튼 계속 누르게 만드는 것도 귀찮게 하는 것".
 * 그래서 끝은 「승리 · 패배 · 비김」만 크게 떴다 저절로 닫힌다. 소리는 누른 순간의 반응으로만 — 박자는 눈(고리)으로 잰다.
 */
import { createDuel, judgeWindows, lateWindow, stepDuel, tierOf, type Cue, type Duel, type DuelEvent, type Outcome, type Tap } from './sim.ts'
import { P } from '../tune/params.ts'
import { t as tr, type Key } from '../i18n/index.ts'
import { makeRng } from '../core/rng.ts'
import { AWAKEN_ART, AWAKEN_LOOP, loopFile } from '../realm/data/awaken-art.ts'
import { SPRITE_PX } from '../realm/data/spritePx.ts'
import { DUEL_ATLASES, LEGACY_ATLAS, fighterMotion, pxAtlas, type FighterAnim, type FighterAtlas } from './fighter-motion.ts'
import { HAEBI_KO as KO, HAEBI_END as KO_END } from '../tune/params.ts'
import { fallCells, fallTime, koSkippable, koTargetZoom, koZoom } from '../raid/ko.ts'
import { STRIP_CELLS, usesCompanion } from '../raid/hero-idle.ts'
import { companionPlace } from '../raid/strip-geom.ts'
import { haptics } from '../ui/haptics.ts'
import { HitClock, drawHitPortrait, hitArtKey, hitArtPath, hitFocusSlide, hitStrength, type HitForm, type HitFrame } from '../ui/hit-portrait.ts'

export interface DuelSide {
  readonly name: string
  readonly mu: number
  /** 전투 띠 이름 — public/realm/anim2/gen-<sprite>.png */
  readonly sprite: string
  /** 초상 id — awaken-hd/<id>.jpg (없으면 bust-hd) · 얼굴은 bust/<id>.jpg */
  readonly portrait?: string
}
export interface DuelSetup {
  readonly me: DuelSide
  readonly foe: DuelSide
  /** 판의 세기 0 촌장 ~ 6 천손 */
  readonly tier: number
  readonly seed: number
  /** 전장 그림 — 본편은 그 싸움의 배경을 그대로 (형 11-09: 배경은 하나) · 없으면 들판 */
  readonly bg?: string
  /** 시험판 — 들판과 깃발부터 · 싸움 음악을 직접 튼다 · 끝나면 눌러서 한 판 더 */
  readonly standalone?: boolean
  /** 도트 띠 — 기본 켜짐: public/realm/anim-px/gen-<sprite>.png (tools/sprite-normalize.mjs 규격)를 정수 배율로 또렷이 그린다 (없으면 옛 anim2 띠) · false 나 주소 ?px=0 이면 옛 띠 */
  readonly px?: boolean
}
/** 본편으로 넘기는 끝 — 이김 · 짐 · 비김(undefined → 본편이 무예로 굴린다) */
export type DuelResult = 'win' | 'lose' | undefined
export const resultOf = (o: Outcome | null): DuelResult => (o === 'ko' || o === 'win' ? 'win' : o === 'kod' || o === 'lose' ? 'lose' : undefined)

const CSS = `
.duelx { position: fixed; inset: 0; z-index: 9000; background: #0b0806; touch-action: none; -webkit-user-select: none; user-select: none; }
.duelx canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
.duelx .dflag { position: absolute; left: 50%; bottom: calc(22px + env(safe-area-inset-bottom)); transform: translateX(-50%); padding: 0 26px; height: 64px; border-radius: 16px;
  border: 2px solid #f0c66a; background: linear-gradient(#5a2a14, #2c140a); color: #ffe7b0; font-family: 'Gowun Batang', serif; font-weight: 800; font-size: 21px;
  box-shadow: 0 0 24px rgba(240,180,80,.45); animation: dpulse 1.4s ease-in-out infinite; }
.duelx .dflag.hide { display: none; }
.duelx .dskip { position: absolute; right: 16px; top: calc(16px + env(safe-area-inset-top)); min-height: 44px; padding: 0 18px;
  border: 1px solid #d9ba7c; border-radius: 24px; background: #17100de6; color: #ffedc7; font: 700 14px sans-serif; cursor: pointer; }
.duelx .dskip[hidden] { display: none; }
@keyframes dpulse { 50% { box-shadow: 0 0 40px rgba(255,200,100,.8); } }
`
let cssIn = false

/** 겨루기를 띄운다 — 끝나면 저절로 닫히고 끝을 돌려준다 (시험판은 닫지 않고 되풀이) */
export function mountDuel(cfg: DuelSetup, root: HTMLElement = document.body): Promise<DuelResult> {
  if (!cssIn) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); cssIn = true }
  const host = document.createElement('div')
  host.className = 'duelx'
  host.innerHTML = '<canvas></canvas><button class="dskip" hidden>' + tr('duel.skip') + '</button>' + (cfg.standalone === true ? '<button class="dflag">' + tr('duel.flag') + '</button>' : '')
  root.appendChild(host)
  // 겨루기가 뜨면 밑(나라 판·전투판)은 숨기고 멈춘다 — 폰에서 밑이 같이 그려져 버벅였다 (형 11-11 · appstyle 의 html.duel-open)
  document.documentElement.classList.add('duel-open')
  const heldVideos = [...document.querySelectorAll('video')].filter((v) => !v.paused && !host.contains(v))
  for (const v of heldVideos) v.pause()
  const canvas = host.querySelector('canvas') as HTMLCanvasElement
  /** 그리는 판 — 늘 화면 판이다. 미리 그려 보기(warmStates)만 잠깐 화면 밖 판으로 바꿨다가 되돌린다 */
  let ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const screenCtx = ctx
  const flagBtn = host.querySelector<HTMLButtonElement>('.dflag')
  const skipBtn = host.querySelector<HTMLButtonElement>('.dskip') as HTMLButtonElement
  const params = new URLSearchParams(location.search)
  const muMe = cfg.me.mu, muFoe = cfg.foe.mu, tier = Math.max(0, Math.min(6, Math.round(cfg.tier)))
  let seed = cfg.seed >>> 0
  let resolveDone: (r: DuelResult) => void = () => undefined
  const done = new Promise<DuelResult>((res) => { resolveDone = res })
  const cleanups: Array<() => void> = []
  const on = <K extends keyof WindowEventMap>(t: K, f: (e: WindowEventMap[K]) => void): void => { addEventListener(t, f); cleanups.push(() => removeEventListener(t, f)) }
  const onDoc = (t: 'visibilitychange', f: () => void): void => { document.addEventListener(t, f); cleanups.push(() => document.removeEventListener(t, f)) }

// ── 그림
const img = (src: string, fallback?: string): HTMLImageElement => {
  const i = new Image()
  if (fallback !== undefined) i.onerror = () => { i.onerror = null; i.src = fallback }
  i.src = src
  void i.decode().catch(() => undefined)
  return i
}
const bg = img(cfg.bg ?? 'realm/battle/battle-field.jpg')
/** 흥분한 군사 줄 (형 11-11: 전쟁통 한가운데니 군중은 군사 · 누끼로 바탕 위에) — 뒤쪽은 카메라를 보는 줄 · 앞줄은 등을 보이는 줄 */
const crowdBack = [1, 2, 3, 4, 5, 6].map((i) => img(`realm/duel/crowd/f${i}.png`)) // 정면(소리치는) 군사 낱장
const crowdFront = [1, 2, 3, 4, 5, 6].map((i) => img(`realm/duel/crowd/b${i}.png`)) // 등을 보이는 군사 낱장
const crowdReady = (set: HTMLImageElement[]): boolean => set.every((im) => im.complete && im.naturalWidth > 0)
const pxMode = cfg.px !== false && params.get('px') !== '0'
/** 겨루기 전용 옛 띠(duel/sprites) 대신 열전과 같은 도트 띠(anim-px)를 쓰는 장수 — 두 판에서 같은 모습 · 서기 계획·쓰러지는 칸도 같다 (11-23 범 · 매화 · 달빛 · 11-24 해비 · 아룸) */
const PX_DUEL: ReadonlySet<string> = new Set(['beom', 'maehwa', 'base-w-31-dabeol-dalbit', 'haebi', 'areum', 'base-w-13-young-archer', 'base-w-10-pirate-captain', 'base-w-17-mahan-pearl-diver', 'base-w-06-buyeo-huntress', 'base-w-64-miri-dallae', 'ara', 'base-w-22-dongye-tiger-huntress', 'noeul', 'sagong', 'sinneoul', 'heo', 'base-w-08-mahan-warrior', 'base-w-23-usisan-whale-queen', 'base-w-26-iseo-tomboy-general', 'base-w-72-eumjeup-beol', 'tneoul', 'odi', 'base-w-76-gampyeong-baetsagong', 'base-w-34-chopal-deulme', 'base-w-102-garak-dana', 'base-w-36-baekje-maena', 'base-w-56-dongokjeo-sogeum', 'budeul', 'base-w-53-hwanna-gabi', 'base-w-18-jinhan-salt-widow', 'beombal'])
/** 띠 그림 — 기본은 anim-px(도트 규격) 먼저, 없으면 옛 띠로 (img 의 onerror 가 갈아 끼운다) */
const strip = (s: string): HTMLImageElement => pxMode
  ? DUEL_ATLASES[s] !== undefined && !PX_DUEL.has(s) ? img(`realm/duel/sprites/gen-${s}.png`, `realm/anim-px/gen-${s}.png`)
    : img(`realm/anim-px/gen-${s}.png`, `realm/anim2/gen-${s}.png`)
  : img(`realm/anim2/gen-${s}.png`)
const sprMe = strip(cfg.me.sprite)
const sprFoe = strip(cfg.foe.sprite)
const foePid = cfg.foe.portrait
const mePid = cfg.me.portrait
const foeArt = foePid !== undefined ? img(`realm/awaken-hd/${foePid}.jpg`, `realm/bust-hd/${foePid}.jpg`) : null
const meFace = mePid !== undefined ? img(`realm/bust/${mePid}.jpg`) : null
const foeFace = foePid !== undefined ? img(`realm/bust/${foePid}.jpg`) : null
/**
 * 맞은 초상 (11-17 형: 「맞았을 때 모습」 · ui/hit-portrait.ts) — 우리 얼굴(체력 막대 머리) · 적장 액자와 얼굴이 맞으면 붉게 번쩍 · 빛 빠짐 · 금.
 * 그리는 쪽 기억만 (판은 읽기만) · 피격 그림(realm/hit)은 있을 때만 부른다 · 피격 그림을 실어 그린 자리에는 금을 안 긋는다 (11-18 형).
 * 얼굴 자리 (11-18 형: 「얼굴이 바깥에 나가 있는 그림은 얼굴이 안 보인다」):
 *  - 적장 액자는 정사각 판에 정사각 그림을 통째로 그린다 → 안 잘리니 그대로.
 *  - 체력 막대 머리는 그림을 창 지름의 FACE_ZOOM 배로 키워 둥글게 오린다 → 잘리니, 피격 그림은 얼굴이 보이게 그 남는 몫 안에서만 민다
 *    (그림 끝을 넘지 않는다 · 얼굴 자료가 없으면 얼굴 그림과 같은 자리: 가로 가운데 · 위 끝). 셈은 창 크기와 무관한 몫이라 여기서 한 번만.
 */
const meHit = new HitClock(), foeHit = new HitClock()
const hitArt = (form: HitForm, pid: string | undefined): HTMLImageElement | null => { const p = hitArtPath(form, pid); return p === null ? null : img('realm/' + p) }
const foePanelHitArt = hitArt('awaken', foePid), meFaceHitArt = hitArt('bust', mePid), foeFaceHitArt = hitArt('bust', foePid)
/** 체력 막대 머리 — 얼굴 그림은 둥근 창 지름의 이 배수 (가로 가운데 · 위 끝 맞춤) */
const FACE_ZOOM = 1.15
/** 머리 창에서 피격 그림을 밀 몫 [가로, 세로] (0~1 · 남는 몫 가운데 얼마를 왼쪽·위로 넘길지) */
const faceHitSlide = (pid: string | undefined): readonly [number, number] => { const s = hitFocusSlide(hitArtKey('bust', pid), 1, 1, FACE_ZOOM, FACE_ZOOM); return [s?.[0] ?? 0.5, s?.[1] ?? 0] }
const meFaceHitSlide = faceHitSlide(mePid), foeFaceHitSlide = faceHitSlide(foePid)
const artReady = (im: HTMLImageElement | null): im is HTMLImageElement => im !== null && im.complete && im.naturalWidth > 0
const calmMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
/** 피격 그림을 겉막 아래에 잠깐 (그림이 있을 때만) */
const hitArtDraw = (im: HTMLImageElement | null, f: HitFrame, x: number, y: number, w: number, h: number, circle: boolean): void => {
  if (im === null || f.art <= 0.001 || !im.complete || im.naturalWidth === 0) return
  ctx.save(); ctx.beginPath()
  if (circle) ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2); else ctx.rect(x, y, w, h)
  ctx.clip(); ctx.globalAlpha *= f.art; ctx.drawImage(im, x, y, w, h); ctx.restore()
}
/**
 * 각성 영상은 전투 전의 짧은 등장 컷에서만, 원래 화면비 그대로 쓴다.
 * 정사각 초상에 세로 영상을 겹치면 얼굴이 두 겹으로 보이고 크기가 튄다.
 * 체간 붕괴·결판에는 평상시 미소/춤 영상을 재생하지 않고 전투 자세와 타격 반응을 유지한다.
 */
const foeLoop: HTMLVideoElement | null = (() => {
  if (foePid === undefined || !AWAKEN_ART.has(foePid) || !AWAKEN_LOOP.has(foePid)) return null
  const v = document.createElement('video')
  v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'
  v.setAttribute('playsinline', ''); v.setAttribute('muted', '')
  v.style.cssText = 'position:absolute;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none'
  v.src = `realm/${loopFile(foePid)}`
  host.appendChild(v)
  cleanups.push(() => { v.pause(); v.removeAttribute('src'); v.load() })
  onDoc('visibilitychange', () => { if (document.visibilityState !== 'visible') v.pause() })
  return v
})()

// ── 소리 (합성 · 누른 순간 반응만)
let ac: AudioContext | null = null
const audio = (): AudioContext | null => {
  if (ac === null) { try { ac = new AudioContext() } catch { ac = null } }
  if (ac !== null && ac.state === 'suspended') void ac.resume()
  return ac
}
function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 1, delay = 0): void {
  const a = audio(); if (a === null) return
  const o = a.createOscillator(); const g = a.createGain(); const t = a.currentTime + delay
  o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur)
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur)
}
function noise(dur: number, vol: number, lp: number, delay = 0): void {
  const a = audio(); if (a === null) return
  const n = Math.floor(a.sampleRate * dur); const b = a.createBuffer(1, n, a.sampleRate); const ch = b.getChannelData(0)
  for (let i = 0; i < n; i++) ch[i] = (((i * 1103515245 + 12345) >>> 0) / 4294967296 * 2 - 1) * (1 - i / n)
  const s = a.createBufferSource(); s.buffer = b
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp
  const g = a.createGain(); g.gain.value = vol
  s.connect(f).connect(g).connect(a.destination); s.start(a.currentTime + delay)
}
/**
 * 진짜 효과음 — public/realm/sfx/duel/ (출처 sfx/CREDITS.txt · 고르는 곳 realm/duel-sounds.html).
 * 형 11-09 고름: 막음·정확·연타 튕김·연타 맞음 셋·내가 맞음·체간 무너짐·겨루기 시작 = 형이 받아 준 것(_h) · 치명 베기 = crit_a · 적장 휘두름 = swing_b.
 * 연타 맞음은 셋을 번갈아 (같은 소리가 연달아 나지 않게 · 촥촥촥이 다르게). 주소의 ?sfx=good:b 로 후보(a·b·c)를 바꿔 듣는다.
 */
type SndSlot = 'good' | 'perfect' | 'crit' | 'rushHit' | 'deflect' | 'hurt' | 'swing' | 'break' | 'intro' | 'riser'
const SND_FILES: Record<SndSlot, readonly string[]> = {
  good: ['good_h.mp3'], perfect: ['perfect_h1.mp3', 'perfect_h2.mp3'], crit: ['crit_a.ogg'], rushHit: ['rushHit_h1.mp3', 'rushHit_h2.mp3', 'rushHit_h3.mp3'],
  deflect: ['deflect_h.mp3'], hurt: ['hurt_h.mp3'], swing: ['swing_b.ogg'], break: ['break_h.mp3'], intro: ['intro_h.wav'], riser: ['riser_h.mp3'],
}
/** 여럿을 한꺼번에 겹쳐 내는 자리 — 정확은 정확1·정확2 를 동시에 (형 11-09) */
const SND_LAYER: ReadonlySet<SndSlot> = new Set<SndSlot>(['perfect'])
/** 앞부분만 쓰는 소리 (초) — 체간 무너짐은 16초짜리라 앞 3.5초의 묵직한 울림만, 끝은 부드럽게 줄인다 */
const SND_CUT: Partial<Record<SndSlot, number>> = { break: 3.5 }
for (const kv of (params.get('sfx') ?? '').split(',')) { const [k, v] = kv.split(':'); if (k !== undefined && v !== undefined && k in SND_FILES) SND_FILES[k as SndSlot] = [`${k}_${v}.ogg`] }
const SND_BUF = new Map<SndSlot, AudioBuffer[]>()
let sndLoading = false
function loadSounds(): void {
  const a = audio()
  if (a === null || sndLoading) return
  sndLoading = true
  for (const slot of Object.keys(SND_FILES) as SndSlot[]) {
    void Promise.all(SND_FILES[slot].map((f) => fetch(`realm/sfx/duel/${f}`).then((r) => r.arrayBuffer()).then((b) => a.decodeAudioData(b))))
      .then((bufs) => { SND_BUF.set(slot, bufs) }).catch(() => undefined)
  }
}
let rushTurn = 0, rushLast = -1
/** 받은 소리를 낸다 — 없으면 false (합성으로 대신) */
function snd(slot: SndSlot, vol = 1, delay = 0): boolean {
  const a = audio(), bufs = SND_BUF.get(slot)
  if (a === null || bufs === undefined || bufs.length === 0) return false
  if (SND_LAYER.has(slot)) { for (const b of bufs) play1(a, b, slot, vol, delay); return true }
  let i = 0
  if (bufs.length > 1) { // 셋을 섞어 돌린다 — 바로 앞 소리는 피한다
    rushTurn = (rushTurn * 1103515245 + 12345) >>> 0
    i = (rushTurn >>> 16) % bufs.length
    if (i === rushLast) i = (i + 1) % bufs.length
    rushLast = i
  }
  play1(a, bufs[i] as AudioBuffer, slot, vol, delay)
  return true
}
function play1(a: AudioContext, buf: AudioBuffer, slot: SndSlot, vol: number, delay: number): void {
  const src = a.createBufferSource(); src.buffer = buf
  const g = a.createGain(); g.gain.value = vol
  src.connect(g).connect(a.destination)
  const t = a.currentTime + delay, cut = SND_CUT[slot]
  if (cut !== undefined && buf.duration > cut) {
    g.gain.setValueAtTime(vol, t + cut * 0.6); g.gain.linearRampToValueAtTime(0.0001, t + cut)
    src.start(t, 0, cut)
  } else src.start(t)
}
/**
 * 고리마다 차오르는 소리 — 고리가 보이는 때 시작해 닿는 순간 가장 높은 음 (형 11-09: "눈 감고도 깰 수 있게").
 * 고리가 빠르면 빠르게 돌리고(한도를 넘으면 앞을 건너뛴다) · 먼저 막으면 곧바로 끊는다.
 */
const risers = new Map<number, { src: AudioBufferSourceNode; g: GainNode }>()
function riserStart(id: number, leadSec: number): void {
  const a = audio(), buf = SND_BUF.get('riser')?.[0]
  if (a === null || buf === undefined || leadSec <= 0.05) return
  const R = P.duel
  const rate = Math.min(R.riserRateMax, Math.max(R.riserRateMin, R.riserPeak / leadSec))
  const from = Math.max(0, R.riserPeak - leadSec * rate)
  const src = a.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate
  const g = a.createGain()
  const t = a.currentTime, hit = t + (R.riserPeak - from) / rate
  g.gain.setValueAtTime(R.riserVol, t); g.gain.setValueAtTime(R.riserVol, hit); g.gain.linearRampToValueAtTime(0.0001, hit + R.riserTail)
  src.connect(g).connect(a.destination)
  src.onended = () => { src.disconnect(); g.disconnect(); if (risers.get(id)?.src === src) risers.delete(id) }
  src.start(t, from); src.stop(hit + R.riserTail + 0.02)
  risers.set(id, { src, g })
}
/** 막았거나 사라진 고리의 소리는 짧게 줄여 끊는다 */
function riserCut(id: number): void {
  const r = risers.get(id), a = audio()
  risers.delete(id)
  if (r === undefined || a === null) return
  const t = a.currentTime
  r.g.gain.cancelScheduledValues(t); r.g.gain.setValueAtTime(r.g.gain.value, t); r.g.gain.linearRampToValueAtTime(0.0001, t + 0.05)
  try { r.src.stop(t + 0.06) } catch { /* 이미 멈춤 */ }
}
const risenCues = new Set<number>()
/** 한 틀마다 — 새로 보인 고리는 소리를 걸고, 끝난 고리는 끊는다 */
function syncRisers(d: Duel): void {
  for (const c of d.cues) {
    if (c.done === null && d.t >= c.t0 && !risenCues.has(c.id)) { risenCues.add(c.id); riserStart(c.id, (c.hitAt - d.t) / P.duel.hz) }
  }
  for (const id of [...risers.keys()]) { const c = d.cues.find((x) => x.id === id); if (c === undefined || c.done !== null) riserCut(id) }
}
/** 싸움 음악 — 본편 싸움판과 같은 곡 (sound.ts 의 bgm_war c7v · 크기 0.3). 겨루기 화면이 떠도 끊기지 않는다 (형 11-09) */
// 본편에선 전투판 음악이 그대로 흐른다 (겨루기는 그 위에 겹쳐 뜬다) — 시험판만 직접 튼다
const bgm = cfg.standalone === true ? new Audio('realm/sfx/bgm_war_c7v.ogg') : null
if (bgm !== null) { bgm.loop = true; bgm.volume = 0.3 }
function startBgm(): void { if (bgm !== null && bgm.paused) void bgm.play().catch(() => undefined) }
onDoc('visibilitychange', () => { if (document.hidden) bgm?.pause(); else if (bgmStarted) startBgm() })
let bgmStarted = false
const SFX = {
  perfect: () => { if (!snd('perfect')) { tone(2600, 0.6, 'triangle', 0.22); tone(1950, 0.5, 'sine', 0.18); noise(0.06, 0.5, 9000) } },
  good: () => { snd('swing', 0.5); if (!snd('good')) { tone(1150, 0.2, 'triangle', 0.2); noise(0.05, 0.3, 6000) } },
  miss: () => { snd('swing', 0.6); if (!snd('hurt')) { noise(0.25, 0.75, 650); tone(110, 0.25, 'sine', 0.45, 0.5) } },
  crit: () => { if (!snd('crit', 1, 0.05)) { noise(0.35, 0.9, 1200, 0.05); tone(70, 0.6, 'sine', 0.6, 0.6, 0.05); tone(3200, 0.9, 'sine', 0.12, 0.98, 0.1) } },
  break: () => { if (!snd('break')) { tone(400, 0.5, 'sawtooth', 0.12, 0.4); noise(0.3, 0.4, 900) } },
  rushHit: () => { if (!snd('rushHit', 0.8)) { noise(0.08, 0.45, 2200); tone(260, 0.07, 'square', 0.08, 0.6) } },
  deflect: () => { if (!snd('deflect', 0.8)) { tone(1700, 0.12, 'triangle', 0.16); noise(0.03, 0.2, 7000) } },
  flag: () => { bgmStarted = true; startBgm(); if (!snd('intro')) { tone(220, 0.5, 'sawtooth', 0.12, 2); noise(0.6, 0.25, 900) } },
}
loadSounds() // 처음부터 받아 둔다 (소리판은 첫 손짓에 깨어난다)

// ── 판
type Mode = 'field' | 'zoom' | 'intro' | 'duel' | 'end'
let mode: Mode = cfg.standalone === true ? 'field' : 'duel'
let modeAt = 0
let entranceSource: HTMLVideoElement | HTMLImageElement | null = null
let entrancePending = false
let entranceShade: CanvasGradient | null = null
let duel: Duel = createDuel({ seed, muMe, muFoe, tier })
/** 적장 체력 끝 (맞은 초상 세기 셈) */
const foeHpMax = (): number => Math.round(P.duel.hp * tierOf(duel).foeHp)
let seen = 0
let queued: Tap | null = null
let freezeUntil = 0
let acc = 0
let last = 0
let shake = 0
/** 이 틀의 화면 흔들림 (px) — 0 이 아니면 초상 판을 구운 한 장으로 찍지 않는다 */
let shakeX = 0, shakeY = 0
let flash: { rgb: string; t0: number; ms: number; a: number } | null = null
interface Pop { x: number; y: number; vx: number; vy: number; text: string; color: string; t0: number; size: number }
interface Spark { x: number; y: number; vx: number; vy: number; t0: number; life: number; color: string }
interface Slash { x: number; y: number; ang: number; len: number; t0: number; ms: number; color: string; w: number }
const pops: Pop[] = []
const sparks: Spark[] = []
const slashes: Slash[] = []
/** off = 누른 때 − 닿는 때 (틱) — 빨랐나 늦었나를 남은 고리로 보인다 */
const marks: { x: number; y: number; t0: number; kind: 'perfect' | 'good' | 'miss'; off: number }[] = []
/**
 * 판정 글 — 누른 자리 위에 크게 톡 튀어 (형 11-09: "동그라미 눌렀을 때 성공 실패가 비직관적이고 UI 가 어설픔") · 리듬 게임처럼
 * 정확 = 금빛 「완벽!」 · 막음 = 은빛 「막음」 · 맞음 = 붉은 「맞음」 (흔들림) · 정확이 아니면 아래에 작게 빠름/늦음
 */
const judges: { x: number; y: number; t0: number; kind: 'perfect' | 'good' | 'miss'; when: '' | 'early' | 'late' }[] = []
let critAt = -1e9
/** 연타가 먹힌 때 — 액자가 아주 빠르게 좌우로 떤다 */
let rushKickAt = -1e9
let hurtAt = -1e9
let foeHurtAt = -1e9
/** 아래 들판 장수들이 하는 짓 — 그리기만 */
let meAnim: { kind: 'idle' | 'guard' | 'hit' | 'attack'; t0: number } = { kind: 'idle', t0: 0 }
let foeAnim: FighterAnim = { kind: 'idle', t0: 0 }

// ── 크기 · 자리
let W = 0, H = 0, dpr = 1
/**
 * 자리 셈은 틀마다 한 번 (11-22 · 열전 기법) — play()·panel() 이 한 틀에 수십 번 불려 그때마다 새 물건을 만들고
 * 노치 높이(safeProbe.offsetHeight · 화면 배치 읽기)를 다시 쟀다. 노치 높이는 크기가 바뀔 때만 다시 잰다 (-1 = 아직)
 */
let frameNo = 0, layAt = -1, safeTopPx = -1
/** 크기·DPR 이 바뀌어 구운 판을 다 버렸다 — 다음 틀에 미리 굽기(warmNow)를 다시 돈다 */
let rewarm = false
/** 폰(손가락 화면)은 DPR 1.5 에서 시작 · 프레임 간격 가운데값이 22ms 를 넘으면 0.5 씩 1 까지 (형 11-10: 폰으로 겨루기할 때 렉이 엄청 · render/scene watchLoad 와 같은 셈) */
/** ?prof=1 일 때만 도는 구간 재기 — 기본 길엔 비용이 없다 */
const PROF = params.get('prof') === '1'
const prof: Record<string, number> = {}
let pt = 0
const pm = (k: string): void => { if (!PROF) return; if (params.get('sync') === '1') ctx.getImageData(0, 0, 1, 1); const t = performance.now(); prof[k] = (prof[k] ?? 0) + t - pt; pt = t }
const profGaps: number[] = []
let profAt = 0, profFrames = 0
/**
 * 큰 그림을 쓰는 크기로 한 번만 줄여 둔 판 — 900px 그림을 매 프레임 300px 로 줄여 그리던 것 (폰에서 가장 무거웠다 · 형 11-11)
 * 크기·DPR 이 바뀌면 새 키로 다시 굽는다.
 */
const SCALED = new Map<string, HTMLCanvasElement>()
function scaled(im: HTMLImageElement, w: number, h: number, tint: string | null = null): HTMLCanvasElement {
  const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr))
  const key = `${im.src}|${pw}x${ph}|${tint ?? ''}`
  let cv = SCALED.get(key)
  if (cv === undefined) {
    cv = document.createElement('canvas'); cv.width = pw; cv.height = ph
    const c = cv.getContext('2d') as CanvasRenderingContext2D
    c.imageSmoothingQuality = 'high'
    c.drawImage(im, 0, 0, pw, ph)
    if (tint !== null) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = tint; c.fillRect(0, 0, pw, ph) }
    SCALED.set(key, cv)
  }
  return cv
}
const BAR_CV = new Map<string, { cv: HTMLCanvasElement; dh: number }>()
/** 번지는 빛 — 한 번 구운 동그란 그라디언트 (세기는 globalAlpha 로) */
const GLOWS = new Map<string, HTMLCanvasElement>()
function glow(rgb: string, r: number): HTMLCanvasElement {
  const pr = Math.max(2, Math.round(r * dpr))
  const key = `${rgb}|${pr}`
  let cv = GLOWS.get(key)
  if (cv === undefined) {
    cv = document.createElement('canvas'); cv.width = pr * 2; cv.height = pr * 2
    const c = cv.getContext('2d') as CanvasRenderingContext2D
    const g = c.createRadialGradient(pr, pr, 0, pr, pr, pr); g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(1, `rgba(${rgb},0)`)
    c.fillStyle = g; c.fillRect(0, 0, pr * 2, pr * 2)
    GLOWS.set(key, cv)
  }
  return cv
}
/** 초상 판 — 어두운 바탕 + 적장 초상을 둥근 모서리로 오려 한 번 구운 것 (매 프레임 clip + 900px 그림 줄이기를 없앤다) */
let panelCv: HTMLCanvasElement | null = null
let panelKey = ''
function panelBake(s: number): HTMLCanvasElement | null {
  if (foeArt === null || !foeArt.complete || foeArt.naturalWidth === 0) return null
  const ps = Math.round(s * dpr)
  const key = `${ps}`
  if (panelCv !== null && panelKey === key) return panelCv
  const cv = panelCv ?? document.createElement('canvas')
  cv.width = ps; cv.height = ps
  const c = cv.getContext('2d') as CanvasRenderingContext2D
  c.imageSmoothingQuality = 'high'
  const r = ps * 0.06
  c.beginPath(); c.moveTo(r, 0); c.arcTo(ps, 0, ps, ps, r); c.arcTo(ps, ps, 0, ps, r); c.arcTo(0, ps, 0, 0, r); c.arcTo(0, 0, ps, 0, r); c.closePath(); c.clip()
  c.fillStyle = 'rgba(10,7,5,.55)'; c.fillRect(0, 0, ps, ps)
  c.globalAlpha = 0.9; c.drawImage(foeArt, 0, 0, ps, ps)
  panelCv = cv; panelKey = key
  return cv
}
/**
 * 가만히 있는 초상 판 — 초상 판(panelBake)과 테두리를 화면에 그릴 때와 같은 변환으로, 화면 화소 칸에 맞춘 판 하나에 구운 것 (11-22 · 폰 GPU).
 * 그 판을 화면에 1:1 로(정수 화소 자리) 찍으니 두 장을 따로 그린 것과 화소가 같다. 판 자리·크기·DPR 이 바뀌면 다시 굽는다.
 */
let restCv: HTMLCanvasElement | null = null
let restKey = ''
/** 구운 판을 찍을 화면 화소 자리 (panelRest 가 적는다) */
const restAt = { x: 0, y: 0 }
function panelRest(pn: Readonly<typeof panelBox>, pb: HTMLCanvasElement, fr: HTMLImageElement): HTMLCanvasElement {
  const F = pn.s / 0.89, Fh = pn.s / 0.877, cx = pn.x + pn.s / 2, cy = pn.y + pn.s / 2
  const fx = cx - pn.s / 2 - 0.055 * F, fy = cy - pn.s / 2 - 0.061 * Fh
  const bx = Math.floor(fx * dpr), by = Math.floor(fy * dpr)
  const bw = Math.ceil((fx + F) * dpr) - bx, bh = Math.ceil((fy + Fh) * dpr) - by
  const key = `${bx},${by},${bw},${bh},${pn.s},${dpr},${pb.width},${fr.naturalWidth}`
  if (restCv === null || restKey !== key) {
    const cv = restCv ?? document.createElement('canvas')
    cv.width = Math.max(1, bw); cv.height = Math.max(1, bh)
    const c = cv.getContext('2d') as CanvasRenderingContext2D
    c.setTransform(dpr, 0, 0, dpr, -bx, -by); c.translate(cx, cy)
    c.drawImage(pb, -pn.s / 2, -pn.s / 2, pn.s, pn.s)
    c.drawImage(scaled(fr, F, Fh), -pn.s / 2 - 0.055 * F, -pn.s / 2 - 0.061 * Fh, F, Fh)
    restCv = cv; restKey = key
  }
  restAt.x = bx; restAt.y = by
  return restCv
}
/**
 * 글자를 바뀔 때만 작은 판에 굽는다 — strokeText 는 글자 윤곽을 매번 선으로 다시 그려 폰에서 무거웠다 (형 11-11).
 * 그릴 땐 drawImage 한 번 · 크기 변화(톡 튀는 효과)는 배율로.
 */
/** final: 제 글꼴로 구웠다 (false 면 글꼴 조각이 오는 중이라 대신 글꼴 — 오면 다시 굽는다) */
interface TextSprite { cv: HTMLCanvasElement; w: number; h: number; tw: number; pad: number; by: number; final: boolean }
const TXT = new Map<string, TextSprite>()
function textSprite(text: string, px: number, weight: number, top: string, bottom: string | null, stroke: string, lw: number, mid: boolean): TextSprite {
  px = Math.max(4, Math.round(px))
  const key = `${text}|${px}|${weight}|${top}|${bottom ?? ''}|${stroke}|${lw}|${mid ? 1 : 0}|${dpr}`
  let t = TXT.get(key)
  if (t === undefined) {
    const font = `${weight} ${px}px "Gowun Batang", serif`
    txtCx.font = font
    const tw = Math.ceil(txtCx.measureText(text).width)
    const pad = Math.ceil(lw) + 2, w = tw + pad * 2, h = Math.ceil(px * 1.5) + pad * 2
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr)
    const c = cv.getContext('2d') as CanvasRenderingContext2D
    c.setTransform(cv.width / w, 0, 0, cv.height / h, 0, 0)
    c.font = font; c.textAlign = 'left'; c.textBaseline = mid ? 'middle' : 'alphabetic'
    const by = mid ? h / 2 : pad + px * 1.1
    c.lineWidth = lw; c.strokeStyle = stroke; c.strokeText(text, pad, by)
    if (bottom !== null) { const g = c.createLinearGradient(0, by - px / 2, 0, by + px / 2); g.addColorStop(0, top); g.addColorStop(1, bottom); c.fillStyle = g } else c.fillStyle = top
    c.fillText(text, pad, by)
    const final = fontReady(font, text)
    t = { cv, w, h, tw, pad, by, final }
    TXT.set(key, t)
    // 글꼴 조각(unicode-range)이 아직 안 온 글자는 대신 글꼴로 구워졌다 — 다 오면 버려 다음에 제 글꼴로 다시 굽는다 (예전엔 대신 글꼴이 그대로 남았다 · 11-22)
    // 받다 실패하면(오프라인 등) 대신 글꼴 판을 그대로 쓴다 — 틀마다 다시 굽지 않게
    if (!final) { const mine = t; void document.fonts.load(font, text).then(() => { if (TXT.get(key) === mine && fontReady(font, text)) TXT.delete(key); else mine.final = true }, () => { mine.final = true }) }
  }
  return t
}
/** 이 글자들에 맞는 글꼴 조각이 다 와 있나 — 고운바탕은 글자 범위마다 조각 파일이라 처음 쓰는 글자는 그때 받는다 */
function fontReady(font: string, text: string): boolean {
  try { return document.fonts.check(font, text) } catch { return true }
}
const txtCx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D
/** 구운 글자를 (x, y) 에 — y 는 글자 기준선(또는 middle 이면 가운데) · align 은 x 가 글자의 어느 쪽인가 */
function putText(t: TextSprite, x: number, y: number, align: 'left' | 'center' | 'right', sc = 1): void {
  const ox = align === 'left' ? -t.pad : align === 'right' ? -(t.tw + t.pad) : -t.w / 2
  ctx.drawImage(t.cv, x + ox * sc, y - t.by * sc, t.w * sc, t.h * sc)
}
/** 기기 화소대로 시작(형 11-12: 빨라졌으니 해상도 올려 — 폰 1.5 에서 시작하면 도트가 뿌옇게 두 번 늘어난다) · 버거우면 0.5 씩 내린다 */
let dprCap = P.duel.dprCap
const gaps: number[] = []
function watchLoad(dt: number): void {
  if (dprCap <= 1 || dt <= 0 || dt > 500) return
  gaps.push(dt)
  if (gaps.length < 60) return
  const mid = gaps.sort((a, b) => a - b)[30]!
  gaps.length = 0
  if (mid > P.duel.dprDropMs) { dprCap = Math.max(1, dprCap - 0.5); resize() }
}
/**
 * 군사 한 줄 — 낱장 군사(누끼)를 시드 고정 난수로 한 명씩 세운다 (형 11-11: 통짜 그림은 몸이 붙고 목이 돌아갔다).
 * 칸마다 그림·좌우 뒤집기·크기·간격·세로 들쭉날쭉을 정해 한 번 굽고, 매 프레임은 drawImage 하나.
 * 반환 캔버스는 폭 w · 높이 soldierH * P.duel.crowdRowRoom — 군사 발은 맨 아래선에 닿는다.
 */
const ROWS = new Map<string, HTMLCanvasElement>()
function crowdRow(set: HTMLImageElement[], w: number, soldierH: number, salt: number): HTMLCanvasElement {
  const rowH = soldierH * P.duel.crowdRowRoom
  const key = `${salt}|${Math.round(w)}x${Math.round(soldierH)}@${dpr}`
  let cv = ROWS.get(key)
  if (cv === undefined) {
    cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(rowH * dpr))
    const c = cv.getContext('2d') as CanvasRenderingContext2D
    c.imageSmoothingQuality = 'high'
    const rng = makeRng((cfg.seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0)
    let prev = -1
    for (let x = -soldierH * 0.15; x < w; ) {
      let i = rng.int(0, set.length - 1)
      if (i === prev) i = (i + 1) % set.length
      prev = i
      const im = set[i] as HTMLImageElement
      const dh = soldierH * rng.range(P.duel.crowdScaleMin, P.duel.crowdScaleMax)
      const dw = dh * im.naturalWidth / im.naturalHeight
      const y = rowH - dh - rng.range(0, soldierH * P.duel.crowdJitterY)
      const flip = rng.chance(0.5)
      const tile = scaled(im, dw, dh)
      c.save()
      c.translate((flip ? x + dw : x) * dpr, y * dpr); c.scale(flip ? -1 : 1, 1)
      c.drawImage(tile, 0, 0)
      c.restore()
      x += dw * rng.range(P.duel.crowdStepMin, P.duel.crowdStepMax)
    }
    ROWS.set(key, cv)
  }
  return cv
}
/** 바탕(전장 그림 + 어둡게 덮는 그라디언트)은 크기가 바뀔 때만 한 번 굽는다 — 화면 가득 큰 그림을 매 프레임 늘려 그리던 것 */
let bgBaked: HTMLCanvasElement | null = null
let bgKey = ''
function bakedBg(): HTMLCanvasElement | null {
  if (!bg.complete || bg.naturalWidth === 0) return null
  const key = `${W}x${H}@${dpr}${crowdReady(crowdBack) ? 'c' : ''}`
  if (bgBaked !== null && bgKey === key) return bgBaked
  const cv = bgBaked ?? document.createElement('canvas')
  if (cv.parentNode === null) host.insertBefore(cv, canvas) // 바탕은 밑 판에 — 위 판은 투명으로 비워 두고 매 프레임 바탕을 다시 그리지 않는다
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
  const c = cv.getContext('2d') as CanvasRenderingContext2D
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  const s = Math.max(W / bg.naturalWidth, H / bg.naturalHeight)
  c.drawImage(bg, (W - bg.naturalWidth * s) / 2, (H - bg.naturalHeight * s) / 2, bg.naturalWidth * s, bg.naturalHeight * s)
  if (crowdReady(crowdBack)) { // 장수 띠 바로 뒤 — 카메라를 보는 군사들이 소리친다
    const sh = H * P.duel.crowdBackH
    c.globalAlpha = P.duel.crowdBackAlpha
    const row = crowdRow(crowdBack, W, sh, 1)
    c.drawImage(row, 0, fieldTop() + H * P.duel.crowdBackFeet - row.height / dpr, W, row.height / dpr)
    c.globalAlpha = 1
  }
  const shade = c.createLinearGradient(0, 0, 0, H)
  shade.addColorStop(0, 'rgba(8,5,3,.7)'); shade.addColorStop(0.55, 'rgba(8,5,3,.5)'); shade.addColorStop(0.82, 'rgba(8,5,3,.2)'); shade.addColorStop(1, 'rgba(8,5,3,.35)')
  c.fillStyle = shade; c.fillRect(0, 0, W, H)
  bgBaked = cv; bgKey = key
  return cv
}
function resize(): void {
  TXT.clear(); SCALED.clear(); GLOWS.clear(); BAR_CV.clear(); panelCv = null; restCv = null
  entranceShade = null
  layAt = -1; safeTopPx = -1; rewarm = true
  dpr = Math.min(dprCap, devicePixelRatio || 1)
  W = innerWidth; H = innerHeight
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
}
on('resize', resize)
resize()
/** 위 띠(시간 판) 크기 — 폰은 그대로, 넓은 화면은 키운다 (PC 에서 너무 가늘고 작았다) */
const hudTw = (): number => Math.min(150, Math.max(90, Math.min(W * 0.24, H * 0.16)))
/** 폰 노치(카메라) 높이 — env(safe-area-inset-top) 을 한 번 재 둔다 (형 11-11: 시간 판이 카메라에 걸림) */
const safeProbe = document.createElement('div')
safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:env(safe-area-inset-top, 0px);pointer-events:none;visibility:hidden'
host.appendChild(safeProbe)
const safeTop = (): number => safeTopPx >= 0 ? safeTopPx : (safeTopPx = safeProbe.offsetHeight)
/** 폰(좁은 화면)은 체력 막대를 시간 판 아래 한 줄에 길게 — 시간 판 옆에 두면 너무 짧았다 (형 11-11) */
const narrowHud = (): boolean => W < 560
const hudBarH = (): number => Math.round(Math.max(10, Math.min(20, hudTw() * 0.13)))
const hudTop = (): number => Math.round(safeTop() + hudTw() * 0.92 + 22 + (narrowHud() ? hudBarH() + 26 : 0))
const fieldTop = (): number => H * P.duel.fieldTop
const playBox = { x: 0, y: 0, w: 0, h: 0 }, panelBox = { x: 0, y: 0, s: 0 }
/** 이 틀의 자리 — 고리 칸(play) · 초상 판(panel). 튜닝 콘솔이 값을 바꿔도 다음 틀에 따라온다 */
function layout(): void {
  if (layAt === frameNo) return
  layAt = frameNo
  const top = hudTop()
  playBox.y = top; playBox.w = W; playBox.h = fieldTop() - top
  const s = Math.min(W - 60, playBox.h - 56) // 테두리 장식이 화면 밖으로 넘치지 않게
  panelBox.x = (W - s) / 2; panelBox.y = playBox.y + (playBox.h - 36 - s) / 2 + 4; panelBox.s = s
}
/** 고리가 서는 칸 — 위 띠와 아래 들판 사이 전부 */
const play = (): Readonly<typeof playBox> => { layout(); return playBox }
const toPx = (x: number, y: number): [number, number] => { const p = play(); return [p.x + x * p.w, p.y + y * p.h] }
const cueR = (): number => P.duel.radius * Math.min(W, play().h)

// ── 손
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault()
  if (mode === 'intro') { fight(); return }
  if (mode === 'end' && cfg.standalone === true && performance.now() - endAt > 900 && koSkippable((performance.now() - endAt) / 1000)) { seed = (seed + 1) >>> 0; begin(); return }
  if (mode !== 'duel' || duel.over !== null) return
  audio()
  const p = play()
  queued = { x: (e.clientX - p.x) / p.w, y: (e.clientY - p.y) / p.h }
})
flagBtn?.addEventListener('click', () => {
  audio(); SFX.flag()
  flagBtn.classList.add('hide')
  mode = 'zoom'; modeAt = performance.now()
})
skipBtn.addEventListener('click', fight)

function begin(): void {
  for (const id of [...risers.keys()]) riserCut(id)
  risenCues.clear()
  duel = createDuel({ seed, muMe, muFoe, tier })
  seen = 0; queued = null
  pops.length = 0; sparks.length = 0; slashes.length = 0; marks.length = 0; judges.length = 0
  freezeUntil = 0; acc = 0; last = 0; shake = 0; flash = null
  critAt = -1e9; rushKickAt = -1e9; hurtAt = -1e9; foeHurtAt = -1e9; meHit.reset(); foeHit.reset()
  meAnim = { kind: 'idle', t0: 0 }; foeAnim = { kind: 'idle', t0: 0 }
  mode = 'intro'; modeAt = performance.now(); endAt = 0
  entranceSource = foeLoop === null ? foeArt : null
  entrancePending = foeLoop !== null
  skipBtn.hidden = false
  if (foeLoop !== null && document.visibilityState === 'visible') {
    try { foeLoop.currentTime = 0 } catch { /* 아직 안 받았다 */ }
    void foeLoop.play().catch(() => undefined)
  }
  if (P.duel.loopIntroMs <= 0) fight()
}

/** 등장 컷을 보는 동안에는 셈이 멈춘다. 넘기는 탭이 첫 공격 입력으로 새지 않는다. */
function fight(): void {
  if (mode !== 'intro') return
  foeLoop?.pause()
  skipBtn.hidden = true
  queued = null; acc = 0; last = 0
  mode = 'duel'; modeAt = performance.now()
}

/** 영상과 전투는 서로 다른 쇼트다. 세로 원본을 자르지 않고 암전으로 장면을 넘긴다. */
function drawEntrance(now: number): void {
  ctx.fillStyle = '#0b0806'; ctx.fillRect(0, 0, W, H)
  // 이번 컷의 매체를 한 번만 고른다. 재생 준비가 늦어도 정사각 그림이 세로 영상으로 중간에 바뀌지 않는다.
  if (entrancePending) {
    if (foeLoop !== null && foeLoop.readyState >= 2 && foeLoop.videoWidth > 0) entranceSource = foeLoop
    else if (now - modeAt < P.duel.loopWaitMs) return
    else { entranceSource = foeArt; foeLoop?.pause() }
    entrancePending = false; modeAt = now
  }
  const age = now - modeAt, fadeMs = P.duel.loopFadeMs, source = entranceSource
  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, age / fadeMs, (P.duel.loopIntroMs - age) / fadeMs))
  if (source !== null) {
    const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth
    const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight
    if (sw > 0 && sh > 0) {
      const scale = Math.min(W / sw, H / sh)
      ctx.drawImage(source, (W - sw * scale) / 2, (H - sh * scale) / 2, sw * scale, sh * scale)
    }
  }
  if (entranceShade === null) {
    entranceShade = ctx.createLinearGradient(0, H * 0.48, 0, H)
    entranceShade.addColorStop(0, 'rgba(11,8,6,0)'); entranceShade.addColorStop(0.55, 'rgba(11,8,6,.9)'); entranceShade.addColorStop(1, '#0b0806')
  }
  ctx.fillStyle = entranceShade; ctx.fillRect(0, H * 0.48, W, H * 0.52)
  const fs = Math.round(Math.min(W * 0.052, 22))
  putText(textSprite(tr('duel.challenger'), fs, 700, '#e3c394', null, '#1b100a', 3, false), W / 2, H * 0.68, 'center')
  putText(textSprite(cfg.foe.name, fs * 2.1, 900, '#fff3ce', '#e6b258', '#1b100a', 5, false), W / 2, H * 0.75, 'center')
  const guide = textSprite(tr('duel.guide'), fs, 800, '#fff0cb', null, '#1b100a', 3, false)
  const detail = textSprite(tr('duel.guideHeavy'), fs * 0.78, 600, '#dbc9b2', null, '#1b100a', 3, false)
  putText(guide, W / 2, H * 0.85, 'center', Math.min(1, (W - 30) / guide.w))
  putText(detail, W / 2, H * 0.89, 'center', Math.min(1, (W - 30) / detail.w))
  ctx.restore()
  if (age >= P.duel.loopIntroMs) fight()
}

/** 끝 — 「승리 · 패배 · 비김」만 크게 쾅 떴다가 저절로 닫힌다 (형 11-09: 체력·시간 숫자 · 확인 버튼 필요 없다) */
const RESULT: Record<string, { word: string; col: string }> = {
  ko: { word: tr('duel.win'), col: '#ffd98a' }, win: { word: tr('duel.win'), col: '#ffd98a' }, draw: { word: tr('duel.draw'), col: '#e9e1cf' },
  lose: { word: tr('duel.lose'), col: '#ff9a88' }, kod: { word: tr('duel.lose'), col: '#ff9a88' },
}
let endAt = 0
const END_MS = 1500
/** 쓰러짐 KO 막 길이(ms) — 끝이 쓰러짐(ko · kod)이면 맞은 멈춤 + 쓰러지는 칸 + 누운 채 멈춤 뒤에 결과 글 (HAEBI_KO) · 그 밖은 0 */
function koMs(): number {
  if (duel.over !== 'ko' && duel.over !== 'kod') return 0
  const a = atlasOf(duel.over === 'ko' ? sprFoe : sprMe)
  return (KO_END.defeat.freeze + fallTime(fallCells(a.fall, a.hit, a.dead)) + KO.hold) * 1000
}
function drawEnd(now: number): void {
  const r = RESULT[duel.over ?? 'draw'] as { word: string; col: string }
  const age = now - endAt - koMs()
  if (age < 0) return
  const k = Math.min(1, age / 260)
  // 하스스톤처럼 — 크게 떨어져 쾅 박히고(살짝 눌렸다 튐) 빛이 터진다
  const sc = age < 260 ? 2.4 - 1.4 * (1 - (1 - k) ** 3) : 1 + 0.06 * Math.max(0, Math.sin((age - 260) / 60)) * Math.max(0, 1 - (age - 260) / 400)
  ctx.save()
  ctx.fillStyle = `rgba(0,0,0,${0.5 * k})`; ctx.fillRect(0, 0, W, H)
  if (age > 200 && age < 700) {
    // 터지는 빛 — 구운 둥근 빛 한 장 (틀마다 그라디언트를 새로 지어 화면 가득 더해 칠하던 것 · 고른 빛이라 작게 구워 늘려도 같다)
    const gr = Math.min(W, H) * 0.6
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * (1 - (age - 200) / 500)
    ctx.drawImage(glow('255,230,160', gr * P.duel.endGlowRes), W / 2 - gr, H * 0.45 - gr, gr * 2, gr * 2)
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
  }
  ctx.translate(W / 2, H * 0.45); ctx.scale(sc, sc)
  ctx.globalAlpha = k
  // 글자는 구운 판 (틀마다 큰 글자 윤곽을 다시 긋던 것 · 11-22) — 쾅 떨어지는 동안(2.4배→1배)은 두 배로 구운 판을 줄여서
  const big = age < 260
  putText(endSprite(r.word, r.col, big ? 2 : 1), 0, 0, 'center', big ? 0.5 : 1)
  ctx.restore()
  if (age > END_MS && cfg.standalone !== true) close()
}
/** 시작 — 두 이름판이 양쪽에서 미끄러져 들어와 가운데서 부딪힌다 (짧게 · 첫 고리 전) */
function drawIntro(now: number): void {
  const age = now - modeAt
  if (age > 1100) return
  const kIn = Math.min(1, age / 320), e = 1 - (1 - kIn) ** 3
  const fade = age < 800 ? 1 : 1 - (age - 800) / 300
  const fs = introFs()
  ctx.save(); ctx.globalAlpha = Math.max(0, fade)
  const y = H * 0.45
  // 글자는 구운 판 (11-22) — 틀마다 이름 윤곽을 다시 긋고, ⚔ 는 틀마다 새 글꼴 크기라 그때마다 글꼴을 새로 그렸다 (겨루기 첫 1초가 끊겼다)
  putText(introSprite(cfg.me.name, '#ffe9b8'), W / 2 - fs * 0.6 - (1 - e) * W * 0.6, y, 'right')
  putText(introSprite(cfg.foe.name, '#ffb3a6'), W / 2 + fs * 0.6 + (1 - e) * W * 0.6, y, 'left')
  if (kIn >= 1) {
    const s2 = 1 + 0.4 * Math.max(0, 1 - (age - 320) / 200)
    if (s2 > 1) putText(introSprite('⚔', '#ffd98a', Math.round(fs * 1.2 * 1.4)), W / 2, y, 'center', s2 / 1.4)
    else putText(introSprite('⚔', '#ffd98a', Math.round(fs * 1.2)), W / 2, y, 'center')
  }
  ctx.restore()
}

// ── 일이 났을 때
function burst(x: number, y: number, n: number, color: string, speed: number, now: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 3) * 0.37
    const v = speed * (0.45 + ((i * 37) % 10) / 10)
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t0: now, life: 320 + (i % 5) * 70, color })
  }
}
function onEvent(e: DuelEvent, now: number): void {
  const R = P.duel
  const [x, y] = e.x !== undefined && e.y !== undefined ? toPx(e.x, e.y) : [W / 2, play().y + play().h * 0.45]
  // 숫자는 빠르고 멀리 — 위쪽 부채꼴로 튄다 (형 11-09)
  const pop = (text: string, color: string, size: number, px = x, py = y): void => {
    const a = -Math.PI / 2 + (((e.t * 47 + pops.length * 13) % 100) / 100 - 0.5) * 1.6
    const dist = Math.min(W, H) * (0.22 + size / 400)
    pops.push({ x: px, y: py, vx: Math.cos(a) * dist, vy: Math.sin(a) * dist, text, color, t0: now, size })
  }
  switch (e.kind) {
    case 'cue': foeAnim = { kind: 'windup', t0: now }; break
    case 'perfect':
      SFX.perfect(); freezeUntil = now + R.hitStopPerfect
      marks.push({ x, y, t0: now, kind: 'perfect', off: e.off ?? 0 }); burst(x, y, 22, '#fff1c0', 9, now)
      judges.push({ x, y, t0: now, kind: 'perfect', when: '' })
      meAnim = { kind: 'guard', t0: now }; foeAnim = { kind: 'attack', t0: now }
      break
    case 'good':
      SFX.good(); marks.push({ x, y, t0: now, kind: 'good', off: e.off ?? 0 }); burst(x, y, 10, '#cfe6ff', 5, now); shake = R.shake * 0.3
      judges.push({ x, y, t0: now, kind: 'good', when: (e.off ?? 0) < 0 ? 'early' : 'late' })
      meAnim = { kind: 'guard', t0: now }; foeAnim = { kind: 'attack', t0: now }
      break
    case 'miss':
      SFX.miss(); freezeUntil = now + R.hitStopHit; shake = R.shake; hurtAt = now; meHit.hit(now, hitStrength(e.dmgMe, R.hp))
      flash = { rgb: '190,20,10', t0: now, ms: 220, a: 0.4 }
      marks.push({ x, y, t0: now, kind: 'miss', off: e.off ?? 0 })
      judges.push({ x, y, t0: now, kind: 'miss', when: (e.off ?? 0) < 0 ? 'early' : 'late' })
      slashes.push({ x, y, ang: -0.7 + ((e.t * 13) % 10) / 20, len: Math.min(W, H) * 0.45, t0: now, ms: 260, color: '255,60,40', w: 10 })
      pop(`−${e.dmgMe}`, POP.miss[1], POP.miss[0])
      meAnim = { kind: 'hit', t0: now }; foeAnim = { kind: 'attack', t0: now }
      break
    case 'crit':
      // 적이 맞는 건 화면이 아니라 적장 액자(critAt 의 kick·zoom)와 적 체력 막대가 흔들린다 (형 11-11)
      SFX.crit(); critAt = now; foeHurtAt = now; freezeUntil = now + R.hitStopCrit; foeHit.hit(now, hitStrength(e.dmgFoe, foeHpMax()))
      flash = { rgb: '255,250,235', t0: now, ms: 260, a: 0.75 }
      slashes.push({ x: (x + panel().x + panel().s / 2) / 2, y: (y + panel().y + panel().s / 2) / 2, ang: slashAngle(x, y, e.t), len: Math.hypot(W, H) * 0.85, t0: now + 60, ms: 520, color: '255,255,255', w: 22 })
      burst(W / 2, play().y + play().h * 0.42, 34, '#ffd98a', 12, now)
      pop(`−${e.dmgFoe}`, POP.crit[1], POP.crit[0], W / 2, play().y + play().h * 0.3)
      meAnim = { kind: 'attack', t0: now }; foeAnim = { kind: 'hit', t0: now }
      break
    case 'break':
      SFX.break()
      flash = { rgb: '255,200,90', t0: now, ms: 300, a: 0.35 }
      foeAnim = { kind: 'stagger', t0: now }
      break
    case 'rushHit':
      SFX.rushHit(); foeHurtAt = now; rushKickAt = now; foeHit.hit(now, hitStrength(e.dmgFoe, foeHpMax()))
      haptics().buzz(18)
      slashes.push({ x, y, ang: slashAngle(x, y, e.t), len: Math.min(W, H) * 0.32, t0: now, ms: 240, color: '255,255,255', w: 8 })
      pop(`−${e.dmgFoe}`, POP.rush[1], POP.rush[0])
      meAnim = { kind: 'attack', t0: now }; foeAnim = { kind: 'hit', t0: now }
      break
    case 'deflect':
      // 막힌 공격도 무기를 들어 받아낸다. 피해 번쩍임/진동은 적중 때만.
      SFX.deflect()
      meAnim = { kind: 'attack', t0: now }; foeAnim = { kind: 'guard', t0: now }
      break
    case 'rushEnd': foeAnim = { kind: 'idle', t0: now }; break
    default: break
  }
}

// ── 그리기 조각
function cover(im: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  if (!im.complete || im.naturalWidth === 0) return
  const s = Math.max(w / im.naturalWidth, h / im.naturalHeight)
  ctx.drawImage(im, x + (w - im.naturalWidth * s) / 2, y + (h - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s)
}
const PX_NAME = /\/(gen-[^/]+)\.png/
/** 띠 그림의 칸 표 · 도트인가 · 발 줄 — 그림 주소마다 한 번 (틀마다 주소에 정규식·includes 를 네 번씩 돌렸다) · 주소가 바뀌면(없는 그림 → 옛 띠) 다시 */
interface SprMeta { readonly src: string; readonly atlas: FighterAtlas; readonly px: boolean; readonly feet: number | undefined }
const SPR_META = new WeakMap<HTMLImageElement, SprMeta>()
function sprMeta(im: HTMLImageElement): SprMeta {
  const src = im.src
  let m = SPR_META.get(im)
  if (m === undefined || m.src !== src) {
    const name = (PX_NAME.exec(src) ?? [])[1], sheet = src.includes('/duel/sprites/')
    const px = src.includes('/anim-px/')
    m = { src, atlas: sheet ? DUEL_ATLASES[name?.slice(4) ?? ''] ?? LEGACY_ATLAS : px ? pxAtlas(name?.slice(4) ?? '') : LEGACY_ATLAS, px: sheet || px, feet: SPRITE_PX[name ?? '']?.feet }
    SPR_META.set(im, m)
  }
  return m
}
/**
 * 덧 띠 (anim-px/gen-X-x.png · 20 칸부터 · 열전과 같은 길) — 계획이 20 칸 넘게 쓰는 도트 띠만 한 번 받는다 · 못 받으면 null.
 * 아직 안 왔으면 그 칸을 쓰는 일(쓰러짐 넷 · 버릇)을 뺀 칸 표로 (빈 칸을 그리지 않는다)
 */
const COMPANIONS = new WeakMap<HTMLImageElement, HTMLImageElement | null>()
function companionImg(im: HTMLImageElement): HTMLImageElement | null {
  if (COMPANIONS.has(im)) return COMPANIONS.get(im) ?? null
  const m = sprMeta(im), name = (PX_NAME.exec(m.src) ?? [])[1]
  const c = m.px && name !== undefined && usesCompanion(m.atlas.plan ?? null) ? img(`realm/anim-px/${name}-x.png`) : null
  COMPANIONS.set(im, c)
  return c
}
const ready = (im: HTMLImageElement | null): im is HTMLImageElement => im !== null && im.complete && im.naturalWidth > 0
const LEAN = new WeakMap<FighterAtlas, FighterAtlas>()
/** 지금 그릴 수 있는 칸 표 — 덧 띠가 아직이면 20 칸 넘는 칸을 뺀다 */
function atlasOf(im: HTMLImageElement): FighterAtlas {
  const a = sprMeta(im).atlas
  if (!a.plan || !usesCompanion(a.plan) || ready(companionImg(im))) return a
  let lean = LEAN.get(a)
  if (lean === undefined) { lean = pxAtlas((PX_NAME.exec(im.src) ?? [])[1]?.slice(4) ?? '', false); LEAN.set(a, lean) }
  return lean
}
/**
 * 띠를 폰 GPU 텍스처 한도 아래 폭으로 접어 둔 판 (11-22 · 열전 bakedStrip 기법) — 겨루기 띠는 넓이가 4600~5760px 라(251장 중 142장이 4096 넘음)
 * 한도를 넘으면 폰이 그릴 때마다 조각내 올리거나 줄여 올린다. 칸을 1:1 로 옮겨 여러 줄로 접을 뿐이라 도트는 그대로다.
 * 옮기는 판은 CPU 캔버스(willReadFrequently) — 넓은 원본을 GPU 로 읽다 줄어들지 않게 · 다 되면 ImageBitmap 으로 굳혀 쥔다.
 * 칸 폭이 정수가 아닌 띠(칸 수가 그림과 안 맞음)는 옮기면 화소가 번지니 원본 그대로 그린다.
 */
interface Fold { src: CanvasImageSource; readonly cols: number }
const FOLDS = new WeakMap<HTMLImageElement, { readonly src: string; readonly fold: Fold | null }>()
function folded(im: HTMLImageElement, cells: number): Fold | null {
  const had = FOLDS.get(im)
  if (had !== undefined && had.src === im.src) return had.fold
  const max = P.duel.stripFoldPx, cw = im.naturalWidth / cells, ch = im.naturalHeight
  let fold: Fold | null = null
  if (im.naturalWidth > max && Number.isInteger(cw) && cw <= max) {
    const cols = Math.floor(max / cw)
    const cv = document.createElement('canvas'); cv.width = cols * cw; cv.height = Math.ceil(cells / cols) * ch
    const c = cv.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
    c.imageSmoothingEnabled = false
    for (let i = 0; i < cells; i++) c.drawImage(im, i * cw, 0, cw, ch, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch)
    const f: Fold = { src: cv, cols }
    fold = f
    if (typeof createImageBitmap === 'function') void createImageBitmap(cv).then((bm) => { if (FOLDS.get(im)?.fold === f) f.src = bm; else bm.close() }, () => undefined)
  }
  FOLDS.set(im, { src: im.src, fold })
  return fold
}
/** 띠가 실제로 그려지는 키 — 도트 띠는 정수 배율(칸 키 × 배율) · 옛 띠는 h 그대로 (sprite 와 같은 셈) */
function drawnHeight(im: HTMLImageElement, h: number): number {
  if (!im.complete || im.naturalWidth === 0 || !sprMeta(im).px) return h
  const ch = im.naturalHeight
  return ch * Math.max(1, Math.round(Math.min(W, H) * P.duel.pxFill / ch))
}
function sprite(im: HTMLImageElement, frame: number, x: number, base: number, h: number, flip: boolean, tint: string | null): void {
  if (!im.complete || im.naturalWidth === 0) return
  const meta = sprMeta(im), isPx = meta.px
  // 20 칸부터는 덧 띠에서 (발 줄·배율은 본 띠 그대로) · 아직 없으면 누운 칸
  let cells = meta.atlas.cells
  const mainCh0 = im.naturalHeight
  let xg = meta.atlas.plan?.xGeom
  if (frame >= STRIP_CELLS) {
    const c = companionImg(im)
    if (ready(c) && meta.atlas.plan) { im = c; cells = Math.max(1, meta.atlas.plan.cells - STRIP_CELLS); frame -= STRIP_CELLS } else { frame = meta.atlas.dead; xg = undefined }
  } else xg = undefined
  const cw = im.naturalWidth / cells, ch = im.naturalHeight
  const mainCh = xg !== undefined ? mainCh0 : ch   // 배율·발 줄은 본 띠 칸 높이로 (xGeom 덧 띠만 — 칸 높이가 달라도 몸 크기가 같게 · 없으면 예전 그대로)
  // 도트는 정수 배율 · 정수 자리 — 점이 네모로 또렷하게 (옛 띠는 매끄럽게 늘린다) · 발 줄(manifest)이 base 에 닿게 칸을 그만큼 내린다
  const sc = isPx ? Math.max(1, Math.round(Math.min(W, H) * P.duel.pxFill / mainCh)) : 0 // 화면 짧은 변 기준 (폰 390 → 1배 · 데스크톱 768 → 2배)
  const w = isPx ? cw * sc : h * (cw / ch)
  let ox = -w / 2, oy = -h
  if (isPx) {
    h = ch * sc; x = Math.round(x); base = Math.round(base) + (meta.feet !== undefined ? (mainCh - meta.feet) * sc : 0); oy = -h
    // 덧 띠 자기 규격(xGeom): (뿌리, 발 줄) 점을 본 띠 칸의 (한가운데, 발 줄) 점 자리에 (strip-geom.ts · base 는 이미 본 띠 발 줄 + (칸 높이 − 발 줄) · sc 아래)
    if (xg !== undefined && meta.feet !== undefined) { const p = companionPlace(cw, ch, sc, meta.feet, xg); ox = p.left; oy = p.top - (mainCh - meta.feet) * sc; h = p.h }
  }
  const fold = folded(im, cells)
  const src = fold?.src ?? im, sx = fold !== null ? (frame % fold.cols) * cw : frame * cw, sy = fold !== null ? Math.floor(frame / fold.cols) * ch : 0
  ctx.save(); ctx.translate(x, base); if (flip) ctx.scale(-1, 1)
  ctx.imageSmoothingEnabled = !isPx
  if (tint === null) ctx.drawImage(src, sx, sy, cw, ch, ox, oy, w, h)
  else {
    // 번쩍임은 장수 모양에만 — 따로 그린 판에서 물들여 옮긴다 (판 위에 바로 칠하면 칸 네모가 통째로 물든다)
    const tw = Math.ceil(cw), th = Math.ceil(ch)
    if (tintCv.width < tw || tintCv.height < th) { tintCv.width = tw; tintCv.height = th }
    tintCx.clearRect(0, 0, tintCv.width, tintCv.height)
    tintCx.imageSmoothingEnabled = !isPx
    tintCx.globalCompositeOperation = 'source-over'; tintCx.drawImage(src, sx, sy, cw, ch, 0, 0, cw, ch)
    tintCx.globalCompositeOperation = 'source-atop'; tintCx.fillStyle = tint; tintCx.fillRect(0, 0, cw, ch)
    ctx.drawImage(tintCv, 0, 0, cw, ch, ox, oy, w, h)
  }
  ctx.restore()
}
const tintCv = document.createElement('canvas')
const tintCx = tintCv.getContext('2d') as CanvasRenderingContext2D
/** 아래 들판의 작은 두 장수 (서기 0-3 · 걷기 4-11 · 공격 12-17 · 맞음 18 · 쓰러짐 19) */
function fieldFighters(now: number, base: number, h: number, gapPx: number, cx: number): void {
  const d = duel
  const meX = cx - gapPx / 2, foeX = cx + gapPx / 2
  const meEnd = mode === 'end' && (d.over === 'kod' || d.over === 'lose') ? (d.over === 'kod' ? 'dead' : 'hurt') : null
  const foeEnd = mode === 'end' && (d.over === 'ko' || d.over === 'win') ? (d.over === 'ko' ? 'dead' : 'hurt') : null
  // 쓰러짐(KO)은 끝난 뒤 시계로 쓰러지는 칸을 차례로 (raid/ko.ts)
  const endAge = mode === 'end' ? now - endAt : undefined
  const me = fighterMotion(atlasOf(sprMe), meAnim, now, false, meEnd, endAge, calmMotion)
  const foe = fighterMotion(atlasOf(sprFoe), foeAnim, now, d.phase === 'rush', foeEnd, endAge, calmMotion)
  const mf = me.frame, mdx = me.dx * gapPx, ff = foe.frame, fdx = -foe.dx * gapPx
  ctx.fillStyle = 'rgba(0,0,0,.35)'
  for (const x of [meX, foeX]) { ctx.beginPath(); ctx.ellipse(x, base + 2, h * 0.22, h * 0.05, 0, 0, Math.PI * 2); ctx.fill() }
  sprite(sprMe, mf, meX + mdx, base, h, false, now - hurtAt < 140 ? 'rgba(255,215,205,.75)' : null)
  sprite(sprFoe, ff, foeX + fdx, base, h, true, now - foeHurtAt < 140 ? 'rgba(255,255,255,.8)' : null)
}

function drawField(now: number, k: number): void {
  // 들판 — 깃발을 누르면 가운데로 다가가며 어두워진다 (k 0→1)
  ctx.save()
  const z = 1 + k * 1.6
  ctx.translate(W / 2, H * 0.62); ctx.scale(z, z); ctx.translate(-W / 2, -H * 0.62)
  cover(bg, 0, 0, W, H)
  const gr = ctx.createLinearGradient(0, 0, 0, H)
  gr.addColorStop(0, 'rgba(8,5,3,.4)'); gr.addColorStop(1, 'rgba(8,5,3,.6)')
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H)
  const h = Math.min(H * 0.2, W * 0.24)
  fieldFighters(now, H * 0.66, h, Math.min(W * 0.36, h * 2.2), W / 2)
  ctx.restore()
  if (k > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, k * 1.15)})`; ctx.fillRect(0, 0, W, H) }
  if (k === 0) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#f3e3c0'; ctx.font = '700 18px "Gowun Batang", serif'
    ctx.fillText(`${cfg.me.name}  ⚔  ${cfg.foe.name}`, W / 2, H * 0.36)
  }
}

/** 에셋 — public/realm/duel/<이름>.png · 없으면 null (그리기가 대신 선으로) */
const ARTS = new Map<string, HTMLImageElement | null>()
function art(name: string): HTMLImageElement | null {
  let im = ARTS.get(name)
  if (im === undefined) {
    const i = new Image()
    ARTS.set(name, null)
    i.onload = () => ARTS.set(name, i)
    i.src = `realm/duel/${name}.png`
    void i.decode().catch(() => undefined)
    return null
  }
  return im
}
const ART_NAMES = ['panel-frame', 'hud-bar', 'hud-posture', 'hud-timer', 'fx-clang', 'fx-slash', 'fx-ring', 'rush-tap-a', 'rush-tap-b']
for (const n of ART_NAMES) art(n)
function roundRect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}
/** 초상 판 — 위 띠와 체간 사이 가운데 정사각 */
function panel(): Readonly<typeof panelBox> { layout(); return panelBox }
/** 고리 반지름 — 닿기 전엔 바깥에서 모여들고, 닿은 뒤엔 원 안으로 계속 줄어든다 (형 11-09: 늦은 걸 보기만 해도 알게) */
function ringR(r: number, off: number, lead = P.duel.lead): number {
  if (off <= 0) return r * (1 + 3.2 * Math.min(1, -off / Math.max(1, lead)))
  return r * Math.max(0.08, 1 - 0.92 * off / Math.max(1, lateWindow(muMe, tier)))
}
/** 챙 — 튕겨 나가는 빛 (에셋이 있으면 그것 · hue 0 = 금빛 · 0.6 = 흰 푸른빛) */
function clang(x: number, y: number, size: number, alpha: number, cool: number, now: number): void {
  const im = art('fx-clang')
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.max(0, alpha)
  ctx.translate(x, y); ctx.rotate((now / 900) % (Math.PI * 2))
  if (im !== null) {
    // 막음은 흰 푸른빛 · 정확은 금빛 (그림 모양에만 물든다)
    const mx = Math.round(cueR() * 3.9)
    ctx.drawImage(scaled(im, mx, mx, cool > 0 ? 'rgba(150,200,255,.5)' : null), -size / 2, -size / 2, size, size)
  } else {
    const col = cool > 0 ? '200,230,255' : '255,236,170'
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, l = size * (i % 2 === 0 ? 0.5 : 0.28)
      ctx.strokeStyle = `rgba(${col},1)`; ctx.lineWidth = i % 2 === 0 ? 4 : 2
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * size * 0.06, Math.sin(a) * size * 0.06); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.stroke()
    }
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.3); g.addColorStop(0, `rgba(${col},1)`); g.addColorStop(1, `rgba(${col},0)`)
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}
/**
 * 베는 방향 — 누른 자리가 판 가운데의 어느 쪽인가로 (형 11-09):
 * 좌하단 → 우상단으로 올려베기 · 좌상단 → 우하단으로 내려베기 · 우상단 → 좌하단으로 내려베기 · 우하단 → 좌상단으로 올려베기.
 * 돌려주는 각은 시작점 → 끝점 방향 (화면은 y 가 아래로). 같은 사분면이라도 조금씩 다르게 흔든다.
 */
function slashAngle(x: number, y: number, salt: number): number {
  const pn = panel()
  const left = x < pn.x + pn.s / 2, top = y < pn.y + pn.s / 2
  const base = left ? (top ? Math.PI / 4 : -Math.PI / 4) : (top ? (3 * Math.PI) / 4 : (-3 * Math.PI) / 4)
  return base + ((((salt * 7919) % 100) / 100) - 0.5) * 0.35
}

const judgeMax = (kind: 'perfect' | 'good' | 'miss'): number => Math.round(cueR() * (kind === 'perfect' ? 1.25 : 1.0) * 1.35)
function judgeSprite(kind: 'perfect' | 'good' | 'miss', word: string): TextSprite {
  const fsMax = judgeMax(kind)
  const [c0, c1] = kind === 'perfect' ? ['#fff7d6', '#ffb02e'] : kind === 'good' ? ['#ffffff', '#a9c8ff'] : ['#ffb3a6', '#ff3a26']
  return textSprite(word, fsMax, 900, c0, c1, 'rgba(20,10,4,.92)', Math.max(5, fsMax * 0.16), true)
}
function whenSprite(when: 'early' | 'late'): TextSprite {
  const fs2 = Math.round(judgeMax('good') * 0.42)
  return textSprite(tr(when === 'early' ? 'duel.early' : 'duel.late'), fs2, 800, when === 'early' ? '#8fd0ff' : '#ffb070', null, 'rgba(20,10,4,.92)', Math.max(3, fs2 * 0.2), true)
}
/** 글자 판 — 그리는 곳과 미리 굽는 곳(queueWarm)이 같은 열쇠를 쓰게 한 곳에 모은다 */
const hintSprite = (key: Key, heavy: boolean): TextSprite => textSprite(tr(key), Math.min(18, W * 0.038), 800, heavy ? '#ffb2a0' : '#ffebbe', null, '#160c07', 4, false)
const postureSprite = (): TextSprite => textSprite(tr('duel.posture'), Math.min(13, W * 0.03), 700, '#e9d3a9', null, '#160c07', 3, false)
/** 고리 안 글 — 막는 폭 안이면 「지금!」 · 아니면 강공격 표시 */
const cueWordSprite = (inWin: boolean): TextSprite => textSprite(tr(inWin ? 'duel.tap' : 'duel.heavy'), cueR() * 0.58, 900, inWin ? '#ffe7a1' : '#ffb2a0', null, '#240b05', 3, true)
const orderSprite = (n: number): TextSprite => textSprite(String(n), cueR() * 0.65, 900, '#fff3d5', null, '#21110a', 3, true)
const namePx = (): number => Math.round(14 * Math.max(1, hudTw() / 100))
const nameSprite = (name: string): TextSprite => textSprite(name, namePx(), 700, '#f3e3c0', null, 'rgba(0,0,0,.7)', 4, false)
const timerSprite = (sec: number): TextSprite => textSprite(String(sec), hudTw() * 0.52 * 1.08, 900, sec <= 10 ? '#ff6a5a' : '#ffe2a0', null, 'rgba(0,0,0,.85)', 6, true)
/** 튀는 피해 숫자 — 크기·빛은 사건마다 (맞음 · 치명 · 연타) */
const POP = { miss: [38, '#ff7a6a'], crit: [64, '#ffd98a'], rush: [26, '#ffd98a'] } as const
const popSprite = (text: string, size: number, color: string): TextSprite => textSprite(text, size * 1.7, 900, color, null, 'rgba(0,0,0,.8)', 6, false)
const rushFs = (): number => Math.round(Math.min(W, panel().s) * 0.16)
const rushSprite = (): TextSprite => { const fs0 = rushFs(); return textSprite(tr('duel.rush'), fs0 * 1.06, 900, '#fff6d0', '#ffb03a', 'rgba(40,10,0,.9)', Math.max(6, fs0 * 0.14), true) }
/** 시작 이름판 (형 11-09 · 양쪽에서 미끄러져 와 부딪힘) — 글자 크기 · ⚔ 는 쉴 때와 톡 커질 때(1.4배) 두 판 */
const introFs = (): number => Math.round(Math.min(W, H) * 0.075)
const introSprite = (text: string, color: string, px = introFs()): TextSprite => textSprite(text, px, 900, color, null, 'rgba(20,8,2,.9)', introFs() * 0.14, true)
/** 끝 글 「승리 · 패배 · 비김」 — 쾅 떨어지는 동안(2.4배→1배)은 두 배로 구운 판을 줄여서 · 앉은 뒤는 제 크기 판 */
const endFs = (): number => Math.round(Math.min(W, H) * 0.2)
const endSprite = (word: string, col: string, k = 1): TextSprite => textSprite(word, endFs() * k, 900, '#fffaf0', col, 'rgba(30,12,4,.95)', endFs() * 0.12 * k, true)
function slashSrc(im: HTMLImageElement, len: number, color: string): HTMLCanvasElement {
  const bw = Math.min(512, Math.ceil(len))
  return scaled(im, bw, bw * im.naturalHeight / im.naturalWidth, color === '255,255,255' ? null : `rgba(${color},.6)`)
}
function drawSlash(s: Slash, k: number): void {
  const im = art('fx-slash')
  const grow = Math.min(1, k * 3.5)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5
  ctx.translate(s.x, s.y); ctx.rotate(s.ang)
  const x0 = -s.len / 2
  if (im !== null) {
    const h = s.w * 6
    // 그림의 왼쪽부터 grow 만큼만 — 칼이 시작점에서 끝점으로 지나간다
    const src = slashSrc(im, s.len, s.color)
    ctx.drawImage(src, 0, 0, src.width * grow, src.height, x0, -h / 2, s.len * grow, h)
  } else {
    ctx.strokeStyle = `rgba(${s.color},1)`; ctx.lineCap = 'round'; ctx.lineWidth = s.w * (1 - k * 0.6)
    ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + s.len * grow, 0); ctx.stroke()
    ctx.lineWidth = s.w * 3; ctx.globalAlpha = 0.2 * (1 - k); ctx.stroke()
  }
  ctx.restore()
}
/**
 * 막대 테두리 에셋의 안쪽 창 자리 (잘라 낸 그림의 몫) — public/realm/duel/<이름>.png 을 재서 적는다.
 * 왼쪽 머리·오른쪽 끝은 그대로 두고 가운데만 늘린다 (세 조각).
 */
const BAR_GEO: Readonly<Record<string, { x0: number; x1: number; y0: number; y1: number; capL: number; capR: number; mid?: readonly [number, number] }>> = {
  'hud-bar': { x0: 0.143, x1: 0.926, y0: 0.377, y1: 0.623, capL: 0.16, capR: 0.9 },
  // 체간 — 가운데 장식은 늘리지 않는다 (다섯 조각)
  'hud-posture': { x0: 0.079, x1: 0.92, y0: 0.326, y1: 0.841, capL: 0.1, capR: 0.9, mid: [0.44, 0.56] },
}
/** 막대 테두리를 이 크기로 한 번 이어 붙여 구운 판 (머리·끝·가운데를 매번 일곱 번 그리던 것) */

function barFrame(im: HTMLImageElement, geo: { capL: number; capR: number; y0: number; y1: number; mid?: readonly [number, number] }, frame: string, ow: number, h: number): { cv: HTMLCanvasElement; dh: number } {
  const key = `${frame}|${Math.round(ow * dpr)}|${Math.round(h * dpr)}|${im.naturalWidth}`
  let b = BAR_CV.get(key)
  if (b === undefined) {
    const iw = im.naturalWidth, ih = im.naturalHeight, sc = h / ((geo.y1 - geo.y0) * ih), dh = ih * sc
    const cv = document.createElement('canvas'); cv.width = Math.round(ow * dpr); cv.height = Math.max(1, Math.round(dh * dpr))
    const c = cv.getContext('2d') as CanvasRenderingContext2D
    c.imageSmoothingQuality = 'high'; c.setTransform(cv.width / ow, 0, 0, cv.height / dh, 0, 0)
    const x = 0, dy = 0
    const lw = geo.capL * iw, rw = (1 - geo.capR) * iw
    c.drawImage(im, 0, 0, lw, ih, x, dy, lw * sc, dh)
    c.drawImage(im, geo.capR * iw, 0, rw, ih, x + ow - rw * sc, dy, rw * sc, dh)
    if (geo.mid !== undefined) {
      const m0 = geo.mid[0] * iw, m1 = geo.mid[1] * iw, mw = (m1 - m0) * sc, cx = x + ow / 2
      c.drawImage(im, m0, 0, m1 - m0, ih, cx - mw / 2, dy, mw, dh)
      c.drawImage(im, lw, 0, m0 - lw, ih, x + lw * sc, dy, cx - mw / 2 - (x + lw * sc), dh)
      c.drawImage(im, m1, 0, geo.capR * iw - m1, ih, cx + mw / 2, dy, x + ow - rw * sc - (cx + mw / 2), dh)
    } else c.drawImage(im, lw, 0, geo.capR * iw - lw, ih, x + lw * sc, dy, ow - (lw + rw) * sc, dh)
    b = { cv, dh }
    BAR_CV.set(key, b)
  }
  return b
}
/** 막대 — (x, y) 부터 바깥 폭 ow · 채움 높이 h · from = 차오르는 쪽 (right 면 통째로 뒤집는다) */
function bar(x: number, y: number, ow: number, h: number, v: number, col: string, from: 'left' | 'right' | 'center', frame: string): { cx: number; cy: number; r: number } | null {
  const k = Math.max(0, Math.min(1, v))
  const im = art(frame)
  const geo = BAR_GEO[frame]
  ctx.save()
  if (from === 'right') { ctx.translate(x + ow / 2, 0); ctx.scale(-1, 1); ctx.translate(-(x + ow / 2), 0) }
  let fx0 = x, fx1 = x + ow, sc = 0
  if (im !== null && geo !== undefined) {
    sc = h / ((geo.y1 - geo.y0) * im.naturalHeight)
    fx0 = x + geo.x0 * im.naturalWidth * sc
    fx1 = x + ow - (1 - geo.x1) * im.naturalWidth * sc
  }
  const fw = fx1 - fx0
  ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(fx0, y, fw, h)
  const w = fw * k
  const wx = from === 'center' ? fx0 + (fw - w) / 2 : fx0
  ctx.fillStyle = col; ctx.fillRect(wx, y, w, h)
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)')
  ctx.fillStyle = g; ctx.fillRect(wx, y, w, h)
  if (im !== null && geo !== undefined) {
    const bf = barFrame(im, geo, frame, ow, h)
    ctx.drawImage(bf.cv, x, y - geo.y0 * im.naturalHeight * sc, ow, bf.dh)
  } else { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(214,170,90,.9)'; ctx.strokeRect(fx0 - 1, y - 1, fw + 2, h + 2) }
  ctx.restore()
  if (im === null || geo === undefined) return null
  // 왼쪽 둥근 머리 — 얼굴을 넣을 자리 (뒤집힌 막대면 오른쪽)
  const r = 0.062 * im.naturalWidth * sc, cxl = x + 0.072 * im.naturalWidth * sc, cy = y + h / 2
  return { cx: from === 'right' ? x + ow - (cxl - x) : cxl, cy, r }
}

function drawCue(c: Cue, t: number): void {
  const [x, y] = toPx(c.x, c.y)
  const r = cueR()
  const lead = Math.max(1, c.hitAt - c.t0)
  const off = t - c.hitAt
  const k = Math.min(1, Math.max(0, (t - c.t0) / lead))
  const rgb = c.heavy ? '255,70,50' : '255,244,214'
  // 과녁 원 — 고리가 다가올수록 밝아진다
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.1 + 0.4 * k
  ctx.drawImage(glow(rgb, r * 1.6), x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2)
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
  const ringArt = art('fx-ring')
  if (ringArt !== null) {
    // 과녁 고리 에셋 — 띠 한가운데가 r 에 오게 (띠 중심 = 그림 폭의 0.46)
    const sz = r / 0.92 // 그림 반폭 · 띠 중심 = 반폭의 0.92
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 + 0.45 * k
    ctx.drawImage(scaled(ringArt, sz * 2, sz * 2, c.heavy ? 'rgba(255,60,40,.6)' : null), x - sz, y - sz, sz * 2, sz * 2)
    ctx.restore()
  }
  else { ctx.lineWidth = 4; ctx.strokeStyle = `rgba(${rgb},${0.55 + 0.45 * k})`; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke() }
  // 막는 폭 — 고리가 이 띠 안에 있을 때 누르면 막는다 · 가운데 금줄에 맞으면 완벽 (판정과 같은 셈 · sim.judgeWindows)
  const jw = judgeWindows(muMe, tier)
  const bandOut = ringR(r, -jw.early, lead), bandIn = ringR(r, jw.late, lead)
  ctx.save()
  ctx.fillStyle = `rgba(${c.heavy ? '255,120,90' : '170,220,255'},${0.08 + 0.14 * k})`
  ctx.beginPath(); ctx.arc(x, y, bandOut, 0, Math.PI * 2); ctx.arc(x, y, bandIn, 0, Math.PI * 2, true); ctx.fill('evenodd')
  const pOut = ringR(r, -jw.perfect, lead), pIn = ringR(r, jw.perfect, lead)
  ctx.fillStyle = `rgba(255,214,110,${0.18 + 0.32 * k})`
  ctx.beginPath(); ctx.arc(x, y, pOut, 0, Math.PI * 2); ctx.arc(x, y, pIn, 0, Math.PI * 2, true); ctx.fill('evenodd')
  ctx.restore()
  // 모여드는 고리 — 원을 지나면 안으로 계속 줄어든다 · 막는 폭에 들면 금빛으로 굵게 (「지금!」을 눈으로)
  const rr = ringR(r, off, lead)
  const past = off > 0
  const inWin = off >= -jw.early && off <= jw.late
  const inPerfect = Math.abs(off) <= jw.perfect
  ctx.lineWidth = inPerfect ? 9 : inWin ? 7 : past ? 4 : 3 + 3 * k
  ctx.strokeStyle = inPerfect ? 'rgba(255,226,120,1)' : inWin ? 'rgba(255,214,110,.95)' : past ? `rgba(255,150,60,${Math.max(0.2, 1 - off / 20)})` : `rgba(${rgb},${0.35 + 0.65 * k})`
  if (inWin) {
    // 빛 번짐은 shadowBlur 대신 굵고 옅은 선을 겹쳐서
    const lw = ctx.lineWidth, ss = ctx.strokeStyle
    ctx.strokeStyle = 'rgba(255,200,80,.18)'; ctx.lineWidth = lw + (inPerfect ? 18 : 10)
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,200,80,.32)'; ctx.lineWidth = lw + (inPerfect ? 9 : 5)
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke()
    ctx.lineWidth = lw; ctx.strokeStyle = ss
  }
  ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke()
  // 느낌표만으로는 피해야 하는지 알 수 없다. 강공격도 같은 고리에서 받아친다는 뜻을 쓴다.
  if (c.heavy || inWin) {
    const text = cueWordSprite(inWin)
    putText(text, x, y, 'center', Math.min(1, r * 1.8 / text.w))
  }
  if (duel.cues.length > 1) putText(orderSprite(duel.cues.indexOf(c) + 1), x, y - r * 1.55, 'center')
}

/** 연타 신호 — 「연타!」 + 단추를 누르는 손 그림 두 장이 파바박 번갈아 (형 11-09) · 남은 시간 띠 */
function rushCue(now: number, d: Duel): void {
  const pn = panel()
  const cx = W / 2, cy = pn.y + pn.s * 0.78
  const beat = Math.floor(now / 90) % 2
  const im = art(beat === 0 ? 'rush-tap-a' : 'rush-tap-b')
  const sz = Math.min(W, pn.s) * 0.34 * (beat === 1 ? 0.92 : 1.04)
  ctx.save()
  if (im !== null) ctx.drawImage(scaled(im, Math.round(Math.min(W, pn.s) * 0.36), Math.round(Math.min(W, pn.s) * 0.36)), cx - sz / 2, cy - sz / 2, sz, sz)
  else { ctx.fillStyle = beat === 1 ? '#ffd27a' : '#fff1c0'; ctx.beginPath(); ctx.arc(cx, cy, sz * 0.32, 0, Math.PI * 2); ctx.fill() }
  // 「연타!」 — 크게 흔들리며
  const ty = cy - sz * 0.62, jx = Math.sin(now / 33) * 3
  putText(rushSprite(), cx + jx, ty, 'center', (1 + 0.06 * Math.sin(now / 45)) / 1.06)
  // 남은 시간 — 판 아래 금빛 띠가 줄어든다
  const left = Math.max(0, (d.phaseUntil - d.t) / P.duel.rushTicks)
  const bw = pn.s * 0.8
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(cx - bw / 2, pn.y + pn.s + 12, bw, 8)
  ctx.fillStyle = '#ffd27a'; ctx.fillRect(cx - bw / 2, pn.y + pn.s + 12, bw * left, 8)
  ctx.restore()
}

function drawDuel(now: number, fadeIn: number): void {
  const d = duel
  const R = P.duel
  const ft = fieldTop()
  // 바탕 — 전장 그림 한 장 (형 11-09: 배경은 하나 · 아래서 싸우는 장수도 같은 배경 위)
  // 위는 어둡게(띠·숫자가 읽히게) · 아래 땅은 밝게(장수들이 보이게)
  pm('pre')
  bakedBg()
  pm('bg')
  // 초상 판 — 모서리 둥근 정사각 · 초상은 살짝 비친다. 맞으면 흔들리고 붉게, 비틀거리면 기운다
  const pn = panel()
  const sinceCrit = now - critAt
  const sway = 0 // 비틀거려도 액자는 기울이지 않는다 (형 11-09)
  const sinceRush = now - rushKickAt
  const kick = (sinceCrit < 400 ? Math.sin(sinceCrit / 30) * (1 - sinceCrit / 400) * 12 : 0)
    + (sinceRush < 90 ? Math.sin(sinceRush / 7) * (1 - sinceRush / 90) * 9 : 0) // 연타가 먹히면 아주 빠른 좌우 떨림
  const fhit = foeHit.at(now, calmMotion)
  ctx.save()
  ctx.translate(pn.x + pn.s / 2 + kick + (fhit?.dx ?? 0), pn.y + pn.s / 2 + (fhit?.dy ?? 0)); ctx.rotate(sway)
  const zoom = 1 + (sinceCrit < 500 ? 0.05 * (1 - sinceCrit / 500) : 0)
  ctx.scale(zoom, zoom)
  const pb = panelBake(pn.s)
  const fr = art('panel-frame')
  // 가만히 있는 판(안 맞고 · 안 떨리고 · 다 밝아진 뒤)은 초상+테두리를 화면 화소 자리 그대로 구운 한 장을 1:1 로 (11-22 · 폰 GPU: 큰 그림 둘을 매 틀 겹쳐 칠하던 것)
  if (pb !== null && fr !== null && fadeIn >= 1 && sinceCrit >= 500 && sinceRush >= 90 && fhit === null && now - foeHurtAt >= 120 && shakeX === 0 && shakeY === 0) {
    const rest = panelRest(pn, pb, fr)
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(rest, restAt.x, restAt.y)
  } else {
    if (pb !== null) { ctx.globalAlpha = fadeIn; ctx.drawImage(pb, -pn.s / 2, -pn.s / 2, pn.s, pn.s); ctx.globalAlpha = 1 }
    else { roundRect(-pn.s / 2, -pn.s / 2, pn.s, pn.s, pn.s * 0.06); ctx.fillStyle = 'rgba(10,7,5,.55)'; ctx.fill() }
    if (now - foeHurtAt < 120) { roundRect(-pn.s / 2, -pn.s / 2, pn.s, pn.s, pn.s * 0.06); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,240,220,${0.28 * (1 - (now - foeHurtAt) / 120)})`; ctx.fill(); ctx.globalCompositeOperation = 'source-over' } // 맞으면 초상이 잠깐 하얗게 번쩍
    if (fhit !== null) { ctx.globalAlpha = fadeIn; hitArtDraw(foePanelHitArt, fhit, -pn.s / 2, -pn.s / 2, pn.s, pn.s, false); drawHitPortrait(ctx, fhit, -pn.s / 2, -pn.s / 2, pn.s, pn.s, 'rect', pn.s * 0.06, artReady(foePanelHitArt)); ctx.globalAlpha = 1 } // 맞은 초상: 붉게 · 빛 빠짐 · 피격 그림이 없을 때만 금
    if (fr !== null) { const F = pn.s / 0.89, Fh = pn.s / 0.877; ctx.drawImage(scaled(fr, F, Fh), -pn.s / 2 - 0.055 * F, -pn.s / 2 - 0.061 * Fh, F, Fh) } // 테두리 안쪽 창 = 그림의 5.5~94.5% · 6.1~93.8%
    else { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(214,170,90,.85)'; roundRect(-pn.s / 2, -pn.s / 2, pn.s, pn.s, pn.s * 0.06); ctx.stroke() }
  }
  ctx.restore()
  pm('panel')
  if (d.phase === 'rush') {
    // 비틀거림 — 판 둘레가 금빛으로 맥박
    const a = 0.4 + 0.3 * Math.sin(now / 90)
    ctx.save()
    ctx.lineWidth = 22; ctx.strokeStyle = `rgba(255,200,90,${a * 0.2})`; roundRect(pn.x, pn.y, pn.s, pn.s, pn.s * 0.06); ctx.stroke()
    ctx.lineWidth = 6; ctx.strokeStyle = `rgba(255,210,110,${a})`; roundRect(pn.x, pn.y, pn.s, pn.s, pn.s * 0.06); ctx.stroke(); ctx.restore()
  }
  pm('rushring')
  // 고리
  if (mode === 'duel') for (const c of d.cues) if (c.done === null && d.t >= c.t0) drawCue(c, d.t)
  pm('cues')
  // 판정 자국 — 챙! 빛 (정확·막음) · 붉은 자국 (맞음) · 빨랐다/늦었다는 남은 고리 크기로
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i] as (typeof marks)[number]; const age = now - m.t0
    const life = m.kind === 'perfect' ? 420 : 520
    if (age > life) { marks.splice(i, 1); continue }
    const k = age / life
    if (m.kind !== 'perfect') {
      // 누른 순간의 고리를 그 자리에 얼려 보인다 — 바깥에 남았으면 빨랐다, 안으로 들어갔으면 늦었다
      const r0 = cueR(), rr = ringR(r0, m.off)
      // 누른 순간의 고리를 결과 빛으로 얼려 — 막음은 은빛, 맞음은 붉게 (점선 둘은 무엇이 무엇인지 몰랐다 · 형 11-09)
      ctx.lineWidth = 6; ctx.strokeStyle = m.kind === 'miss' ? `rgba(255,70,50,${1 - k})` : `rgba(220,236,255,${1 - k})`
      ctx.beginPath(); ctx.arc(m.x, m.y, rr, 0, Math.PI * 2); ctx.stroke()
      if (m.kind === 'miss') { ctx.lineWidth = 5; ctx.strokeStyle = `rgba(255,60,40,${1 - k})`; ctx.beginPath(); ctx.moveTo(m.x - r0 * 0.6, m.y - r0 * 0.6); ctx.lineTo(m.x + r0 * 0.6, m.y + r0 * 0.6); ctx.moveTo(m.x + r0 * 0.6, m.y - r0 * 0.6); ctx.lineTo(m.x - r0 * 0.6, m.y + r0 * 0.6); ctx.stroke() }
      if (m.kind === 'miss') continue
    }
    clang(m.x, m.y, cueR() * (m.kind === 'perfect' ? 3.2 : 2) * (0.6 + 0.6 * Math.min(1, k * 3)), 1 - k, m.kind === 'perfect' ? 0 : 0.6, now)
  }
  pm('marks')
  // 판정 글 — 크게 톡 (0.12초 안에 1.35배 → 1배) · 0.7초에 걷힌다
  for (let i = judges.length - 1; i >= 0; i--) {
    const j = judges[i] as (typeof judges)[number]; const age = now - j.t0
    if (age > 700) { judges.splice(i, 1); continue }
    const pk = Math.min(1, age / 120)
    const sc = pk < 1 ? 0.6 + 0.75 * pk : 1.35 - 0.35 * Math.min(1, (age - 120) / 140)
    const fade = age < 520 ? 1 : 1 - (age - 520) / 180
    const word = tr(j.kind === 'perfect' ? 'duel.perfect' : j.kind === 'good' ? 'duel.block' : 'duel.hit')
    const fs = Math.round(cueR() * (j.kind === 'perfect' ? 1.25 : 1.0) * sc)
    const jx = j.kind === 'miss' && age < 260 ? Math.sin(age / 18) * 6 : 0
    const ty = j.y - cueR() * 1.9 - (age / 700) * cueR() * 0.5
    ctx.globalAlpha = Math.max(0, fade)
    const fsMax = judgeMax(j.kind)
    putText(judgeSprite(j.kind, word), j.x + jx, ty, 'center', fs / fsMax)
    if (j.when !== '') putText(whenSprite(j.when), j.x + jx, ty + fs * 0.62, 'center', fs / fsMax)
    ctx.globalAlpha = 1
  }
  pm('judge')
  // 베기 자국
  for (let i = slashes.length - 1; i >= 0; i--) {
    const s = slashes[i] as Slash; const age = now - s.t0
    if (age < 0) continue
    if (age > s.ms) { slashes.splice(i, 1); continue }
    drawSlash(s, age / s.ms)
  }
  pm('slash')
  // 불꽃
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i] as Spark; const age = now - s.t0
    if (age > s.life) { sparks.splice(i, 1); continue }
    const k = age / 16
    ctx.strokeStyle = s.color; ctx.globalAlpha = 1 - age / s.life; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(s.x + s.vx * k, s.y + s.vy * k + 0.05 * k * k); ctx.lineTo(s.x + s.vx * (k + 2.2), s.y + s.vy * (k + 2.2) + 0.05 * (k + 2.2) ** 2); ctx.stroke()
  }
  ctx.globalAlpha = 1
  pm('spark')
  // 아래 — 같은 전장 위에서 작은 두 장수가 따라 싸운다 (따로 깐 배경 없음)
  const fh = (H - ft) * 0.82, fbase = H - 6 - H * P.duel.fighterLift, gap = W * P.duel.fighterGapW
  // 쓰러짐 KO — 쓰러진 쪽으로 다가가고 둘레를 어둡게 (장수들은 그 위에 또렷이 · 움직임 줄이기면 그대로)
  const koSide = mode === 'end' ? duel.over === 'ko' ? 1 : duel.over === 'kod' ? -1 : 0 : 0
  const kz = koSide ? koZoom((now - endAt) / 1000 - KO_END.defeat.freeze, calmMotion) : 0
  if (kz > 0) {
    ctx.fillStyle = `rgba(6,4,3,${KO.duelDim * kz})`; ctx.fillRect(0, 0, W, H)
    // 쓰러진 쪽 누운 몸이 화면 폭의 duelFill 몫이 되게 (그리는 키 = 도트 배율을 반영한 실제 키)
    const fallen = duel.over === 'ko' ? sprFoe : sprMe, fx = W / 2 + koSide * gap / 2, fy = fbase - fh * 0.25
    const z = 1 + (koTargetZoom(1, drawnHeight(fallen, fh), W, KO.duelFill, KO.duelMaxZoom) - 1) * kz
    ctx.save(); ctx.translate(fx + (W / 2 - fx) * kz, fy + (H * 0.55 - fy) * kz); ctx.scale(z, z); ctx.translate(-fx, -fy)
    fieldFighters(now, fbase, fh, gap, W / 2)
    ctx.restore()
  } else fieldFighters(now, fbase, fh, gap, W / 2)
  pm('fighters')
  // 앞줄 — 등을 보이는 군사들이 장수 앞 맨 아래에서 함성 (치명엔 들썩임 두 배)
  if (crowdReady(crowdFront)) {
    const cw = W * P.duel.crowdFrontW, sh = H * P.duel.crowdFrontH
    const bob = Math.sin(now / 180) * R.crowdBob * (now - critAt < 400 ? 2 : 1)
    const row = crowdRow(crowdFront, cw, sh, 2), rh = row.height / dpr
    ctx.drawImage(row, (W - cw) / 2, H + sh * R.crowdFrontDrop - rh + bob, cw, rh)
  }
  pm('crowd')
  // 체간 — 판 아래 가운데, 가운데서 양쪽으로 차오른다 (세키로처럼)
  const pk = d.phase === 'rush' ? 1 : d.foe.posture / R.posture
  const pw = Math.min(W * 0.7, pn.s * 0.9), px = (W - pw) / 2, py = Math.min(ft - 22, pn.y + pn.s + 10)
  if (d.phase !== 'rush') bar(px, py, pw, 10, pk, pk > 0.8 ? '#ffb347' : '#e9c46a', 'center', 'hud-posture')
  else rushCue(now, d)
  if (mode === 'duel') {
    let next: Cue | undefined
    for (const c of d.cues) if (c.done === null && d.t >= c.t0) { next = c; break }
    const key = d.phase === 'rush' ? 'duel.break' : d.phase === 'crit' ? 'duel.crit' : next?.heavy === true ? 'duel.heavyHint' : 'duel.guide'
    const hint = hintSprite(key, next?.heavy === true)
    putText(hint, W / 2, play().y + 6, 'center', Math.min(1, (W - 24) / hint.w))
    if (d.phase !== 'rush') putText(postureSprite(), W / 2, py - 5, 'center')
  }
  pm('posture')
  // 위 — 격투 게임처럼: 우리(왼쪽) · 시간(가운데 크게) · 적장(오른쪽)
  // 위 띠 크기 — 폰은 그대로, 넓은 화면은 키운다 (PC 에서 너무 가늘고 작았다)
  const tw = hudTw()
  const bh = hudBarH(), hudS = tw / 100
  const plateW = tw * 0.98 * 1.32
  const top = safeTop(), narrow = narrowHud()
  // 넓은 화면: 시간 판 양옆 · 폰: 시간 판 아래 한 줄에 둘이 길게 (가운데 틈 12px)
  const bw = narrow ? Math.round(W / 2 - 6 - 6) : Math.min((W - plateW) / 2 - 6, W * 0.36)
  const by = Math.round(top + (narrow ? tw * 0.98 + 10 : tw * 0.36))
  const bxMe = narrow ? 6 : W / 2 - plateW / 2 - 6 - bw, bxFoe = narrow ? W - 6 - bw : W / 2 + plateW / 2 + 6
  // 맞은 쪽 막대만 떨린다 — 화면 전체(우리가 맞음)·적장 액자(적이 맞음)와 따로 (형 11-11)
  const jolt = (t0: number): readonly [number, number] => {
    const s = now - t0
    if (s < 0 || s >= R.barJoltMs) return [0, 0]
    const a = (1 - s / R.barJoltMs) * R.barJolt
    return [Math.sin(s / 9) * a, Math.cos(s / 13) * a * 0.6]
  }
  const [jmx, jmy] = jolt(hurtAt), [jfx, jfy] = jolt(foeHurtAt)
  const capMe = bar(bxMe + jmx, by + jmy, bw, bh, d.me.hp / R.hp, now - hurtAt < 200 ? '#ff5a4a' : '#e9c46a', 'left', 'hud-bar')
  const capFoe = bar(bxFoe + jfx, by + jfy, bw, bh, d.foe.hp / Math.round(R.hp * tierOf(d).foeHp), now - foeHurtAt < 200 ? '#ffffff' : '#e76f51', 'right', 'hud-bar')
  if (capMe !== null) faceCapR = capMe.r
  pm('bars')
  // 둥근 머리 안에 얼굴
  // 맞으면 얼굴도 붉게 · 빛 빠짐 (흔들림은 막대 떨림이 이미 준다) · 피격 그림이 있으면 그 얼굴로 잠깐(얼굴이 보이게 밀어서) · 없으면 금
  for (const [cap, face, hc, hitIm, sl] of [[capMe, meFace, meHit, meFaceHitArt, meFaceHitSlide], [capFoe, foeFace, foeHit, foeFaceHitArt, foeFaceHitSlide]] as const) {
    if (cap === null || face === null || !face.complete || face.naturalWidth === 0) continue
    const hf = hc.at(now, true)
    ctx.save(); ctx.beginPath(); ctx.arc(cap.cx, cap.cy, cap.r, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(face, cap.cx - cap.r * 1.15, cap.cy - cap.r * 1.0, cap.r * 2.3, cap.r * 2.3)
    if (hf !== null && hf.art > 0.001 && artReady(hitIm)) { const d = cap.r * 2 * FACE_ZOOM, spare = d - cap.r * 2; ctx.globalAlpha = hf.art; ctx.drawImage(hitIm, cap.cx - cap.r - sl[0] * spare, cap.cy - cap.r - sl[1] * spare, d, d); ctx.globalAlpha = 1 }
    ctx.restore()
    if (hf !== null) drawHitPortrait(ctx, hf, cap.cx - cap.r, cap.cy - cap.r, cap.r * 2, cap.r * 2, 'circle', 0, artReady(hitIm))
  }
  const nameY = by + bh + Math.round(18 * Math.max(1, hudS))
  // 이름은 얼굴(둥근 머리) 옆 아래
  const nxMe = capMe !== null ? capMe.cx + capMe.r * 1.25 : 12, nxFoe = capFoe !== null ? capFoe.cx - capFoe.r * 1.25 : W - 12
  putText(nameSprite(cfg.me.name), nxMe, nameY, 'left')
  putText(nameSprite(cfg.foe.name), nxFoe, nameY, 'right')
  pm('faces+names')
  const sec = Math.max(0, Math.ceil((d.end - d.t) / R.hz))
  const plate = art('hud-timer')
  const tcx = W / 2, tcy = Math.round(top + tw * 0.42)
  if (plate !== null) { const ph2 = tw * 0.98, pw2 = ph2 * (plate.naturalWidth / plate.naturalHeight); ctx.drawImage(scaled(plate, pw2, ph2), tcx - pw2 / 2, tcy - ph2 / 2, pw2, ph2) }
  else { ctx.fillStyle = 'rgba(20,12,6,.85)'; ctx.beginPath(); ctx.arc(tcx, tcy, tw * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#c99a4a'; ctx.stroke() }
  const low = sec <= 10
  putText(timerSprite(sec), tcx, tcy + 2, 'center', (low ? 1 + 0.08 * Math.max(0, Math.sin(now / 80)) : 1) / 1.08)
  pm('timer')
  // 숫자 — 빠르고 멀리 튄다
  for (let i = pops.length - 1; i >= 0; i--) {
    const pp = pops[i] as Pop; const age = now - pp.t0
    if (age > 620) { pops.splice(i, 1); continue }
    const k = age / 620, e = 1 - (1 - Math.min(1, age / 260)) ** 3
    const x = pp.x + pp.vx * e, y = pp.y + pp.vy * e + 60 * Math.max(0, k - 0.4) ** 2
    ctx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4
    putText(popSprite(pp.text, pp.size, pp.color), x, y, 'center', (1 + 0.7 * Math.max(0, 1 - age / 90)) / 1.7)
  }
  ctx.globalAlpha = 1
  pm('pops')
  // 치명 — 잠깐 어두워졌다가 흰 베기
  if (sinceCrit < 160) { ctx.fillStyle = `rgba(0,0,0,${0.55 * (1 - sinceCrit / 160)})`; ctx.fillRect(0, 0, W, H) }
}

// ── 돌리기 (탭이 숨으면 멈춘다 · 절대 규칙 4)
let raf = 0
/**
 * 처음 쓰는 그림의 풀기·줄이기·굽기를 싸움 밖에서 한 번에 — 처음 베기·챙·고리가 뜰 때마다 끊기던 것 (그림 풀기는 처음 그릴 때 일어난다).
 * 그림이 다 오면(또는 4초 지나면) 첫 프레임 머리에서 한 번 · 이 프레임은 바로 위에 덮어 그리거나 비운다.
 */
let warmed = false, warmTries = 0
function warmNow(now: number): void {
  if (warmed) return
  const imgsOk = [bg, sprMe, sprFoe, ...(foeArt !== null ? [foeArt] : [])].every((i) => i.complete && i.naturalWidth > 0)
  const artOk = ART_NAMES.every((n) => art(n) !== null)
  if (!(imgsOk && artOk) && ++warmTries < 240) return
  warmed = true
  const R = cueR(), pn = panel()
  drawDuel(now, 1)
  for (const rgb of ['255,244,214', '255,70,50']) glow(rgb, R * 1.6)
  const ring = art('fx-ring'), clg = art('fx-clang'), sl = art('fx-slash')
  if (ring !== null) { const sz = R / 0.92; scaled(ring, sz * 2, sz * 2); scaled(ring, sz * 2, sz * 2, 'rgba(255,60,40,.6)') }
  if (clg !== null) { const mx = Math.round(R * 3.9); scaled(clg, mx, mx); scaled(clg, mx, mx, 'rgba(150,200,255,.5)') }
  if (sl !== null) { slashSrc(sl, Math.min(W, H) * 0.45, '255,60,40'); slashSrc(sl, Math.hypot(W, H) * 0.85, '255,255,255'); slashSrc(sl, Math.min(W, H) * 0.32, '255,255,255') }
  for (const n of ['rush-tap-a', 'rush-tap-b']) { const im = art(n); if (im !== null) { const z = Math.round(Math.min(W, pn.s) * 0.36); scaled(im, z, z) } }
  for (const [kind, word] of [['perfect', tr('duel.perfect')], ['good', tr('duel.block')], ['miss', tr('duel.hit')]] as const) judgeSprite(kind, word)
  whenSprite('early'); whenSprite('late')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H)
  queueWarm()
}
/**
 * 남은 글자는 한 틀에 P.duel.warmPerFrame 개씩 (11-22) — 처음 「연타!」·피해 숫자·초 숫자·고리 안 글이 뜨는 틀마다 글꼴을 새로 그려 끊겼다
 * (재기: 4배 느린 CPU 에서 첫 치명 50ms · 첫 연타 70~90ms · 첫 맞음 30ms · 첫 고리 20ms). 싸움 전(깃발·등장 컷) 틀에서 먼저 쓸 것부터 굽는다.
 * 그림은 그대로 — 그릴 때 부르는 같은 함수(같은 열쇠)를 미리 부를 뿐이다.
 */
type WarmJob = (() => TextSprite | void) & { tries?: number }
const warmQ: WarmJob[] = []
function queueWarm(): void {
  const q = warmQ
  q.length = 0
  warmedIm.clear()
  // 그림 먼저 — 아직 안 온 그림(피격 그림은 늦게 올 수 있다)이 있으면 뒤로 돌려 다시 · 다 오면(또는 끝내 안 오면) 그리기 꼴도 미리
  const images: WarmJob = () => {
    if (warmImages() || (images.tries = (images.tries ?? 0) + 1) >= P.duel.warmImageTries) warmStates(last)
    else { warmCx.getImageData(0, 0, 1, 1); q.push(images) }
  }
  q.push(images)
  q.push(() => introSprite(cfg.me.name, '#ffe9b8'), () => introSprite(cfg.foe.name, '#ffb3a6'))
  q.push(() => introSprite('⚔', '#ffd98a', Math.round(introFs() * 1.2 * 1.4)), () => introSprite('⚔', '#ffd98a', Math.round(introFs() * 1.2)))
  q.push(() => nameSprite(cfg.me.name), () => nameSprite(cfg.foe.name), postureSprite)
  // 판정 글은 위에서 이미 구웠다 — 글꼴 조각이 늦게 와 다시 구워야 하면 여기서 (이미 제 글꼴이면 찾기만)
  q.push(() => judgeSprite('perfect', tr('duel.perfect')), () => judgeSprite('good', tr('duel.block')), () => judgeSprite('miss', tr('duel.hit')), () => whenSprite('early'), () => whenSprite('late'))
  for (const [key, heavy] of [['duel.guide', false], ['duel.heavyHint', true], ['duel.crit', false], ['duel.crit', true], ['duel.break', false], ['duel.break', true]] as const) q.push(() => hintSprite(key, heavy))
  q.push(() => cueWordSprite(true), () => cueWordSprite(false), () => orderSprite(1), () => orderSprite(2), () => orderSprite(3))
  const top = Math.ceil(duel.end / P.duel.hz)
  for (let s = top; s > top - 3 && s >= 0; s--) q.push(() => timerSprite(s))
  q.push(() => { q.unshift(...damageTexts().map(([text, size, color]) => () => popSprite(text, size, color))) })
  q.push(rushSprite)
  // 끝 글은 앉은 판(제 크기)만 — 쾅 떨어지는 두 배 판은 셋 다 구우면 너무 커서(한 장 3~4MB) 결판 나는 틀에 그것 하나만 굽는다
  for (const r of Object.values(RESULT)) q.push(() => endSprite(r.word, r.col, 1))
  for (let s = top - 3; s >= 0; s--) q.push(() => timerSprite(s))
}
/**
 * 처음 그리는 그림을 싸움 밖에서 한 번 그려 풀고 GPU 에 올려 둔다 (11-22) — 피격 그림(900px)·얼굴·장수 띠는 처음 그리는 틀 뒤에
 * 풀기·올리기로 주 스레드가 오래 멈췄다 (재기: 4배 느린 CPU 에서 첫 치명 뒤 147ms 두 번 · 첫 맞음 뒤 67ms · 싸움 첫 틀 120ms).
 * 화면 밖 작은 판에 그릴 때와 같은 배율로 그리고(넘친 곳은 잘린다) 부르는 쪽이 한 화소를 읽어 그 자리에서 올리게 한다 — 화면에는 그리지 않는다.
 * 다 그렸으면 true · 아직 안 온 그림이 있으면 false.
 */
const warmCv = document.createElement('canvas')
warmCv.width = 256; warmCv.height = 256
const warmCx = warmCv.getContext('2d') as CanvasRenderingContext2D
const warmedIm = new Set<CanvasImageSource>()
/** 체력 막대 머리(얼굴 창) 반지름 — 그릴 때 적어 두면 warmImages 가 같은 크기로 미리 그린다 */
let faceCapR = 0
function warmImages(): boolean {
  let all = true
  const put = (im: CanvasImageSource | null, w: number, h: number): void => {
    if (im === null || warmedIm.has(im)) return
    if (im instanceof HTMLImageElement && !artReady(im)) { all = false; return }
    warmCx.setTransform(1, 0, 0, 1, 0, 0); warmCx.drawImage(im, 0, 0, Math.max(1, w * dpr), Math.max(1, h * dpr)); warmedIm.add(im)
  }
  if (faceCapR > 0) {
    put(meFace, faceCapR * 2.3, faceCapR * 2.3); put(foeFace, faceCapR * 2.3, faceCapR * 2.3)
    put(meFaceHitArt, faceCapR * 2 * FACE_ZOOM, faceCapR * 2 * FACE_ZOOM); put(foeFaceHitArt, faceCapR * 2 * FACE_ZOOM, faceCapR * 2 * FACE_ZOOM)
  } else all = false
  put(foePanelHitArt, panel().s, panel().s)
  // 장수 띠 — 접은 띠는 ImageBitmap 으로 굳은 뒤에 (그 전 판은 곧 바뀐다) · 제 배율(1:1)로
  for (const im of [sprMe, sprFoe]) {
    if (!artReady(im)) { all = false; continue }
    const f = folded(im, atlasOf(im).cells)
    if (f === null) put(im, im.naturalWidth / dpr, im.naturalHeight / dpr)
    else if (typeof ImageBitmap !== 'undefined' && f.src instanceof ImageBitmap) put(f.src, f.src.width / dpr, f.src.height / dpr)
    else all = false
  }
  return all
}
/**
 * 무거운 순간(첫 고리 · 치명 · 맞음 · 연타)에 처음 쓰는 그리기 꼴을 싸움 전에 화면 밖 판에 한 번씩 그려 둔다 (11-22) — 사각·원 오림 + 투명도로 그림 그리기 ·
 * 빛 더하기(lighter)로 돌려 그리기 · 둥근 판 테두리 긋기 · 물들인 장수. 처음 쓰는 꼴은 GPU 가 그 자리에서 그리기 프로그램을 짓느라 멈췄다
 * (재기: 같은 꼴을 미리 그리면 첫 그리기 멈춤 107~213ms → 0). 그리는 함수는 화면과 같은 것을 부르고 그리는 판(ctx)만 잠깐 바꾼다 · 모양은 이 판 안에 들게 옮긴다.
 */
function warmStates(now: number): void {
  const pn = panel(), s = pn.s, r = faceCapR > 0 ? faceCapR : 20, R = cueR()
  const f: HitFrame = { dx: 0, dy: 0, red: 0.5, gray: 0.3, crack: 0.5, art: 0.6, seed: 0 }
  ctx = warmCx
  try {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // 첫 고리 — 빛 · 고리 그림 · 막는 띠(evenodd) · 고리 선 · 고리 안 글 (닿기 직전 · 강공격)
    const c: Cue = { id: 0, x: 0.5, y: 0.5, t0: 0, hitAt: 40, heavy: true, done: null }
    const [cx, cy] = toPx(c.x, c.y)
    ctx.save(); ctx.translate(40 - cx, 40 - cy); drawCue(c, 9); drawCue(c, 39); ctx.restore()
    // 초상 판이 맞을 때 — 둥근 판 빛 더하기 · 사각 오림 + 투명도 피격 그림 · 겉막(둥근 사각 오림 · 금) · 연타 때 판 둘레 굵은 선
    const pb = panelBake(s)
    ctx.save(); ctx.translate(20 + s / 2, 20 + s / 2); ctx.scale(1.03, 1.03)
    if (pb !== null) { ctx.globalAlpha = 0.9; ctx.drawImage(pb, -s / 2, -s / 2, s, s); ctx.globalAlpha = 1 }
    roundRect(-s / 2, -s / 2, s, s, s * 0.06); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,240,220,.2)'; ctx.fill(); ctx.globalCompositeOperation = 'source-over'
    hitArtDraw(foePanelHitArt, f, -s / 2, -s / 2, s, s, false)
    drawHitPortrait(ctx, f, -s / 2, -s / 2, s, s, 'rect', s * 0.06, false); drawHitPortrait(ctx, f, -s / 2, -s / 2, s, s, 'rect', s * 0.06, true)
    ctx.restore()
    ctx.save(); ctx.lineWidth = 22; ctx.strokeStyle = 'rgba(255,200,90,.1)'; roundRect(20, 20, s, s, s * 0.06); ctx.stroke(); ctx.restore()
    // 얼굴 창 — 원 오림 + 얼굴 · 투명도 피격 그림 · 원 겉막
    for (const [face, hit] of [[meFace, meFaceHitArt], [foeFace, foeFaceHitArt]] as const) {
      ctx.save(); ctx.beginPath(); ctx.arc(60, 60, r, 0, Math.PI * 2); ctx.clip()
      if (artReady(face)) ctx.drawImage(face, 60 - r * 1.15, 60 - r, r * 2.3, r * 2.3)
      if (artReady(hit)) { const d = r * 2 * FACE_ZOOM; ctx.globalAlpha = 0.5; ctx.drawImage(hit, 60 - r, 60 - r, d, d); ctx.globalAlpha = 1 }
      ctx.restore()
      drawHitPortrait(ctx, f, 60 - r, 60 - r, r * 2, r * 2, 'circle', 0, artReady(hit)); drawHitPortrait(ctx, f, 60 - r, 60 - r, r * 2, r * 2, 'circle', 0, false)
    }
    // 챙(막음 · 정확) · 베기(흰 · 붉은) · 불꽃 · 번쩍 — 빛 더하기 · 돌려 그리기 · 투명도
    clang(60, 60, R * 3.2, 0.8, 0, now); clang(60, 60, R * 2, 0.8, 0.6, now)
    drawSlash({ x: 60, y: 60, ang: 0.6, len: Math.hypot(W, H) * 0.85, t0: now, ms: 520, color: '255,255,255', w: 22 }, 0.3)
    drawSlash({ x: 60, y: 60, ang: -0.6, len: Math.min(W, H) * 0.45, t0: now, ms: 260, color: '255,60,40', w: 10 }, 0.7)
    ctx.strokeStyle = '#ffd98a'; ctx.globalAlpha = 0.6; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(50, 30); ctx.stroke(); ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(255,250,235,.5)'; ctx.fillRect(0, 0, 80, 80)
    // 맞아 물든 장수 (우리 · 적장 · 뒤집힘)
    const sh = (H - fieldTop()) * 0.82
    sprite(sprMe, 0, 40, 70, sh, false, 'rgba(255,215,205,.75)'); sprite(sprFoe, 0, 40, 70, sh, true, 'rgba(255,255,255,.8)')
  } finally { ctx = screenCtx }
  warmCx.getImageData(0, 0, 1, 1)
}
function warmMore(): void {
  // 글꼴 조각을 받는 중이면 기다린다 — 그사이 구우면 대신 글꼴로 구웠다가 다시 굽는다
  if (document.fonts.status === 'loading') return
  // 이번 틀에 몇 개 — 뒤로 돌린 일(다시 해 볼 것)을 한 틀에 거듭 돌리지 않게 처음 길이로 묶는다
  for (let i = 0, n = Math.min(P.duel.warmPerFrame, warmQ.length); i < n; i++) {
    const job = warmQ.shift() as WarmJob
    // 미리 굽기는 덤이다 — 하나가 잘못돼도 싸움 틀(rAF)이 끊기지 않게 그 일만 버린다 (없으면 처음 쓸 때 예전처럼 굽는다)
    let t: TextSprite | void
    try { t = job() } catch { ctx = screenCtx; continue }
    if (t !== undefined && !t.final && (job.tries = (job.tries ?? 0) + 1) < 4) warmQ.push(job)
  }
}
/**
 * 나올 수 있는 피해 숫자 (미리 굽기에만) — 같은 셈(sim)을 그림 쪽에서 따로 두 번 굴려 모은다: 하나도 못 막는 손 · 늘 정확히 받고 연타하는 손.
 * 판(duel)은 건드리지 않는다 · 빠진 숫자가 있으면 그 숫자만 처음 뜰 때 굽는다 (예전 그대로)
 */
function damageTexts(): Array<readonly [string, number, string]> {
  const out = new Map<string, readonly [string, number, string]>()
  for (const parry of [false, true]) {
    const d = createDuel({ seed, muMe, muFoe, tier })
    while (d.over === null) {
      let tap: Tap | undefined
      if (parry && d.phase === 'rush') tap = { x: 0.5, y: 0.5 }
      else if (parry) for (const c of d.cues) if (c.done === null && c.hitAt === d.t + 1) tap = { x: c.x, y: c.y }
      stepDuel(d, tap)
    }
    for (const e of d.events) {
      const [size, color] = e.kind === 'miss' ? POP.miss : e.kind === 'crit' ? POP.crit : POP.rush
      const n = e.kind === 'miss' ? e.dmgMe : e.dmgFoe
      if (e.kind === 'miss' || e.kind === 'crit' || e.kind === 'rushHit') out.set(`${e.kind}${n}`, [`−${n}`, size, color])
    }
  }
  return [...out.values()]
}
function frame(now: number): void {
  raf = 0
  if (document.hidden) return
  frameNo++
  const dt = last === 0 ? 0 : Math.min(100, now - last)
  last = now
  if (!(PROF && params.get('nowatch') === '1')) watchLoad(dt)
  if (rewarm) { rewarm = false; warmed = false }
  warmNow(now)
  if (warmQ.length > 0) warmMore()
  if (PROF) pt = performance.now()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (mode === 'intro' || mode === 'duel' || mode === 'end') ctx.clearRect(0, 0, W, H)
  const sx = shake > 0 ? (((now * 7) % 13) / 13 - 0.5) * shake : 0
  const sy = shake > 0 ? (((now * 11) % 17) / 17 - 0.5) * shake : 0
  shakeX = sx; shakeY = sy
  shake = Math.max(0, shake - 0.7)
  ctx.save(); ctx.translate(sx, sy)
  if (mode === 'field') drawField(now, 0)
  else if (mode === 'zoom') {
    const k = Math.min(1, (now - modeAt) / 700)
    drawField(now, k * k)
    if (k >= 1) begin()
  } else if (mode === 'intro') {
    acc = 0
    drawEntrance(now)
  } else {
    if (mode === 'duel' && duel.over === null && now >= freezeUntil) {
      acc += dt
      const stepMs = 1000 / P.duel.hz
      while (acc >= stepMs && duel.over === null) {
        acc -= stepMs
        const tap = queued; queued = null
        stepDuel(duel, tap ?? undefined)
        while (seen < duel.events.length) onEvent(duel.events[seen++] as DuelEvent, now)
        if (now < freezeUntil) { acc = 0; break }
      }
      syncRisers(duel)
      if (duel.over !== null) { mode = 'end'; endAt = now; for (const id of [...risers.keys()]) riserCut(id) }
    } else acc = 0
    drawDuel(now, Math.min(1, (now - modeAt) / 450))
    if (mode === 'duel') drawIntro(now)
    if (mode === 'end') drawEnd(now)
    if (mode === 'duel' && now - modeAt < 450) { ctx.fillStyle = `rgba(0,0,0,${1 - (now - modeAt) / 450})`; ctx.fillRect(-20, -20, W + 40, H + 40) }
  }
  ctx.restore()
  if (flash !== null) {
    const a = flash.a * Math.max(0, 1 - (now - flash.t0) / flash.ms)
    ctx.fillStyle = `rgba(${flash.rgb},${a})`; ctx.fillRect(0, 0, W, H)
    if (now - flash.t0 > flash.ms) flash = null
  }
  if (PROF) {
    pt = performance.now()
    if (params.get('sync') === '1') { ctx.getImageData(0, 0, 1, 1); pm('flush') }
    profFrames++; if (dt > 0) profGaps.push(dt)
    if (now - profAt > 1000) {
      if (profAt > 0) { const g = profGaps.slice().sort((a, b) => a - b); console.log('PROF ' + JSON.stringify({ n: profFrames, med: g[g.length >> 1], p95: g[Math.floor(g.length * 0.95)], over33: g.filter((x) => x > 33).length, len: g.length, dpr, mode, ms: Object.fromEntries(Object.entries(prof).map(([k, v]) => [k, +(v / Math.max(1, profFrames)).toFixed(2)])) })) }
      profAt = now; profFrames = 0; profGaps.length = 0; for (const k of Object.keys(prof)) prof[k] = 0
    }
  }
  raf = requestAnimationFrame(frame)
}
let entranceHiddenAt: number | null = null
function wake(): void {
  if (document.hidden) {
    if (mode === 'intro' && entranceHiddenAt === null) entranceHiddenAt = performance.now()
    return
  }
  if (entranceHiddenAt !== null) {
    if (mode === 'intro') {
      // Count the ten seconds that can actually be watched, not hidden-tab time.
      modeAt += performance.now() - entranceHiddenAt
      if (entranceSource === foeLoop || entrancePending) void foeLoop?.play().catch(() => undefined)
    }
    entranceHiddenAt = null
  }
  if (raf === 0 && !closed) { last = 0; raf = requestAnimationFrame(frame) }
}
onDoc('visibilitychange', wake)
let closed = false
function close(): void {
  if (closed) return
  closed = true
  if (raf !== 0) cancelAnimationFrame(raf)
  for (const c of cleanups.splice(0)) c()
  bgm?.pause()
  host.remove()
  document.documentElement.classList.remove('duel-open')
  for (const v of heldVideos) if (v.isConnected) void v.play().catch(() => undefined)
  resolveDone(resultOf(duel.over))
}
if (mode === 'duel') begin()
wake()
// 개발 검수 손잡이 — 헤드리스 시험(tools/hit-portrait-probe.ts)이 화면 쪽 사건 하나를 틀어 본다 (판은 그대로) · 배포 빌드엔 없음
// __duel·__duelTap: 프레임 재기(tools/duel-fps-probe.ts)가 고리 닿는 때에 맞춰 눌러 가장 무거운 순간(챙·베기·치명·연타)을 만든다 · __duelWarm: 미리 굽기가 어디까지 왔나
if (import.meta.env?.DEV === true) Object.assign(window, { __duelEvent: (e: DuelEvent): number => { onEvent(e, last); return last }, __duelMode: () => mode, __duel: () => duel, __duelTap: (x: number, y: number): void => { if (mode === 'duel' && duel.over === null) queued = { x, y } }, /** 개발 검수: 지금 겨루기를 쓰러짐으로 끝낸다 (foe = 상대가 쓰러짐 · me = 내가 쓰러짐 · KO 연출 찍기) */ __duelKo: (who: 'me' | 'foe'): void => { if (mode !== 'duel' || duel.over !== null) return; duel.over = who === 'foe' ? 'ko' : 'kod'; mode = 'end'; endAt = performance.now(); for (const id of [...risers.keys()]) riserCut(id) }, __duelWarm: () => ({ warmed, left: warmQ.length, images: warmedIm.size, faceCapR, texts: TXT.size }) })
return done
}
