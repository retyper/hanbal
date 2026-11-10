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
@keyframes dpulse { 50% { box-shadow: 0 0 40px rgba(255,200,100,.8); } }
`
let cssIn = false

/** 겨루기를 띄운다 — 끝나면 저절로 닫히고 끝을 돌려준다 (시험판은 닫지 않고 되풀이) */
export function mountDuel(cfg: DuelSetup, root: HTMLElement = document.body): Promise<DuelResult> {
  if (!cssIn) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); cssIn = true }
  const host = document.createElement('div')
  host.className = 'duelx'
  host.innerHTML = '<canvas></canvas>' + (cfg.standalone === true ? '<button class="dflag">⚔ 장수 겨루기</button>' : '')
  root.appendChild(host)
  // 겨루기가 뜨면 밑(나라 판·전투판)은 숨기고 멈춘다 — 폰에서 밑이 같이 그려져 버벅였다 (형 11-11 · appstyle 의 html.duel-open)
  document.documentElement.classList.add('duel-open')
  const heldVideos = [...document.querySelectorAll('video')].filter((v) => !v.paused && !host.contains(v))
  for (const v of heldVideos) v.pause()
  const canvas = host.querySelector('canvas') as HTMLCanvasElement
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const flagBtn = host.querySelector<HTMLButtonElement>('.dflag')
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
/** 겨루기 마당 — 군중이 둥글게 둘러싼 그림 (형 11-11: 아래가 비어 보임). 본편 전장 그림 이름으로 고른다 · 파일이 없으면 지금 바탕 그대로 */
const arenaKind = (name: string): 'sea' | 'fort' | 'field' =>
  /sea|port|beach/.test(name) ? 'sea' : /fort|wall|gate|castle/.test(name) ? 'fort' : 'field'
const arena = img(`realm/duel/arena-${arenaKind(cfg.bg ?? 'battle-field')}.jpg`)
const sprMe = img(`realm/anim2/gen-${cfg.me.sprite}.png`)
const sprFoe = img(`realm/anim2/gen-${cfg.foe.sprite}.png`)
const foePid = cfg.foe.portrait
const mePid = cfg.me.portrait
const foeArt = foePid !== undefined ? img(`realm/awaken-hd/${foePid}.jpg`, `realm/bust-hd/${foePid}.jpg`) : null
const meFace = mePid !== undefined ? img(`realm/bust/${mePid}.jpg`) : null
const foeFace = foePid !== undefined ? img(`realm/bust/${foePid}.jpg`) : null

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
type Mode = 'field' | 'zoom' | 'duel' | 'end'
let mode: Mode = cfg.standalone === true ? 'field' : 'duel'
let modeAt = 0
let duel: Duel = createDuel({ seed, muMe, muFoe, tier })
let seen = 0
let queued: Tap | null = null
let freezeUntil = 0
let acc = 0
let last = 0
let shake = 0
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
let foeAnim: { kind: 'idle' | 'windup' | 'attack' | 'hit' | 'stagger'; t0: number } = { kind: 'idle', t0: 0 }

// ── 크기 · 자리
let W = 0, H = 0, dpr = 1
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
 * 글자를 바뀔 때만 작은 판에 굽는다 — strokeText 는 글자 윤곽을 매번 선으로 다시 그려 폰에서 무거웠다 (형 11-11).
 * 그릴 땐 drawImage 한 번 · 크기 변화(톡 튀는 효과)는 배율로.
 */
interface TextSprite { cv: HTMLCanvasElement; w: number; h: number; tw: number; pad: number; by: number }
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
    t = { cv, w, h, tw, pad, by }
    TXT.set(key, t)
  }
  return t
}
const txtCx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D
/** 구운 글자를 (x, y) 에 — y 는 글자 기준선(또는 middle 이면 가운데) · align 은 x 가 글자의 어느 쪽인가 */
function putText(t: TextSprite, x: number, y: number, align: 'left' | 'center' | 'right', sc = 1): void {
  const ox = align === 'left' ? -t.pad : align === 'right' ? -(t.tw + t.pad) : -t.w / 2
  ctx.drawImage(t.cv, x + ox * sc, y - t.by * sc, t.w * sc, t.h * sc)
}
let dprCap = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 1.5 : 2
const gaps: number[] = []
function watchLoad(dt: number): void {
  if (dprCap <= 1 || dt <= 0 || dt > 500) return
  gaps.push(dt)
  if (gaps.length < 60) return
  const mid = gaps.sort((a, b) => a - b)[30]!
  gaps.length = 0
  if (mid > 22) { dprCap = Math.max(1, dprCap - 0.5); resize() }
}
/** 바탕(전장 그림 + 어둡게 덮는 그라디언트)은 크기가 바뀔 때만 한 번 굽는다 — 화면 가득 큰 그림을 매 프레임 늘려 그리던 것 */
let bgBaked: HTMLCanvasElement | null = null
let bgKey = ''
function bakedBg(): HTMLCanvasElement | null {
  if (!bg.complete || bg.naturalWidth === 0) return null
  const arenaOk = arena.complete && arena.naturalWidth > 0
  const key = `${W}x${H}@${dpr}${arenaOk ? 'a' : ''}`
  if (bgBaked !== null && bgKey === key) return bgBaked
  const cv = bgBaked ?? document.createElement('canvas')
  if (cv.parentNode === null) host.insertBefore(cv, canvas) // 바탕은 밑 판에 — 위 판은 투명으로 비워 두고 매 프레임 바탕을 다시 그리지 않는다
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
  const c = cv.getContext('2d') as CanvasRenderingContext2D
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  const s = Math.max(W / bg.naturalWidth, H / bg.naturalHeight)
  c.drawImage(bg, (W - bg.naturalWidth * s) / 2, (H - bg.naturalHeight * s) / 2, bg.naturalWidth * s, bg.naturalHeight * s)
  if (arenaOk) { // 마당 그림을 위에 덮는다 — 군중 고리가 장수 띠 뒤·옆에, 가운데 빈 마당에 장수가 선다
    const a = Math.max(W / arena.naturalWidth, H / arena.naturalHeight)
    const aw = arena.naturalWidth * a, ah = arena.naturalHeight * a
    const dy = H * P.duel.arenaDrop // 그림을 아래로 내려 빈 마당이 장수 띠 자리에 오게 — 윗머리는 비는 만큼 부드럽게 녹인다
    const ac = document.createElement('canvas'); ac.width = Math.round(W * dpr); ac.height = Math.round(H * dpr)
    const x = ac.getContext('2d') as CanvasRenderingContext2D
    x.setTransform(dpr, 0, 0, dpr, 0, 0)
    x.drawImage(arena, (W - aw) / 2, H - ah + dy, aw, ah)
    const fade = x.createLinearGradient(0, dy, 0, dy + H * P.duel.arenaFade)
    fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)')
    x.globalCompositeOperation = 'destination-in'; x.fillStyle = fade; x.fillRect(0, 0, W, H)
    c.drawImage(ac, 0, 0, W, H)
  }
  const shade = c.createLinearGradient(0, 0, 0, H)
  shade.addColorStop(0, 'rgba(8,5,3,.7)'); shade.addColorStop(0.55, 'rgba(8,5,3,.5)'); shade.addColorStop(0.82, 'rgba(8,5,3,.2)'); shade.addColorStop(1, 'rgba(8,5,3,.35)')
  c.fillStyle = shade; c.fillRect(0, 0, W, H)
  bgBaked = cv; bgKey = key
  return cv
}
function resize(): void {
  TXT.clear(); SCALED.clear(); GLOWS.clear(); BAR_CV.clear(); panelCv = null
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
const safeTop = (): number => safeProbe.offsetHeight
/** 폰(좁은 화면)은 체력 막대를 시간 판 아래 한 줄에 길게 — 시간 판 옆에 두면 너무 짧았다 (형 11-11) */
const narrowHud = (): boolean => W < 560
const hudBarH = (): number => Math.round(Math.max(10, Math.min(20, hudTw() * 0.13)))
const hudTop = (): number => Math.round(safeTop() + hudTw() * 0.92 + 22 + (narrowHud() ? hudBarH() + 26 : 0))
const fieldTop = (): number => H * 0.8
/** 고리가 서는 칸 — 위 띠와 아래 들판 사이 전부 */
const play = (): { x: number; y: number; w: number; h: number } => ({ x: 0, y: hudTop(), w: W, h: fieldTop() - hudTop() })
const toPx = (x: number, y: number): [number, number] => { const p = play(); return [p.x + x * p.w, p.y + y * p.h] }
const cueR = (): number => P.duel.radius * Math.min(W, play().h)

// ── 손
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault()
  if (mode === 'end' && cfg.standalone === true && performance.now() - endAt > 900) { seed = (seed + 1) >>> 0; begin(); return }
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

function begin(): void {
  duel = createDuel({ seed, muMe, muFoe, tier })
  seen = 0; queued = null
  pops.length = 0; sparks.length = 0; slashes.length = 0; marks.length = 0; judges.length = 0
  mode = 'duel'; modeAt = performance.now(); endAt = 0
}

/** 끝 — 「승리 · 패배 · 비김」만 크게 쾅 떴다가 저절로 닫힌다 (형 11-09: 체력·시간 숫자 · 확인 버튼 필요 없다) */
const RESULT: Record<string, { word: string; col: string }> = {
  ko: { word: '승리', col: '#ffd98a' }, win: { word: '승리', col: '#ffd98a' }, draw: { word: '비김', col: '#e9e1cf' },
  lose: { word: '패배', col: '#ff9a88' }, kod: { word: '패배', col: '#ff9a88' },
}
let endAt = 0
const END_MS = 1500
function drawEnd(now: number): void {
  const r = RESULT[duel.over ?? 'draw'] as { word: string; col: string }
  const age = now - endAt
  const k = Math.min(1, age / 260)
  // 하스스톤처럼 — 크게 떨어져 쾅 박히고(살짝 눌렸다 튐) 빛이 터진다
  const sc = age < 260 ? 2.4 - 1.4 * (1 - (1 - k) ** 3) : 1 + 0.06 * Math.max(0, Math.sin((age - 260) / 60)) * Math.max(0, 1 - (age - 260) / 400)
  ctx.save()
  ctx.fillStyle = `rgba(0,0,0,${0.5 * k})`; ctx.fillRect(0, 0, W, H)
  if (age > 200 && age < 700) {
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.min(W, H) * 0.6)
    const a2 = 0.45 * (1 - (age - 200) / 500)
    g.addColorStop(0, `rgba(255,230,160,${a2})`); g.addColorStop(1, 'rgba(255,230,160,0)')
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'
  }
  ctx.translate(W / 2, H * 0.45); ctx.scale(sc, sc)
  ctx.globalAlpha = k
  const fs = Math.round(Math.min(W, H) * 0.2)
  ctx.font = `900 ${fs}px "Gowun Batang", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.lineWidth = fs * 0.12; ctx.strokeStyle = 'rgba(30,12,4,.95)'; ctx.strokeText(r.word, 0, 0)
  const gr = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, r.col)
  ctx.fillStyle = gr; ctx.fillText(r.word, 0, 0)
  ctx.restore()
  ctx.textBaseline = 'alphabetic'
  if (age > END_MS && cfg.standalone !== true) close()
}
/** 시작 — 두 이름판이 양쪽에서 미끄러져 들어와 가운데서 부딪힌다 (짧게 · 첫 고리 전) */
function drawIntro(now: number): void {
  const age = now - modeAt
  if (age > 1100) return
  const kIn = Math.min(1, age / 320), e = 1 - (1 - kIn) ** 3
  const fade = age < 800 ? 1 : 1 - (age - 800) / 300
  const fs = Math.round(Math.min(W, H) * 0.075)
  ctx.save(); ctx.globalAlpha = Math.max(0, fade)
  ctx.font = `900 ${fs}px "Gowun Batang", serif`; ctx.textBaseline = 'middle'; ctx.lineWidth = fs * 0.14; ctx.strokeStyle = 'rgba(20,8,2,.9)'
  const y = H * 0.45
  ctx.textAlign = 'right'; const lx = W / 2 - fs * 0.6 - (1 - e) * W * 0.6
  ctx.strokeText(cfg.me.name, lx, y); ctx.fillStyle = '#ffe9b8'; ctx.fillText(cfg.me.name, lx, y)
  ctx.textAlign = 'left'; const rx = W / 2 + fs * 0.6 + (1 - e) * W * 0.6
  ctx.strokeText(cfg.foe.name, rx, y); ctx.fillStyle = '#ffb3a6'; ctx.fillText(cfg.foe.name, rx, y)
  if (kIn >= 1) { ctx.textAlign = 'center'; const s2 = 1 + 0.4 * Math.max(0, 1 - (age - 320) / 200); ctx.font = `900 ${Math.round(fs * 1.2 * s2)}px "Gowun Batang", serif`; ctx.strokeText('⚔', W / 2, y); ctx.fillStyle = '#ffd98a'; ctx.fillText('⚔', W / 2, y) }
  ctx.restore(); ctx.textBaseline = 'alphabetic'
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
      SFX.miss(); freezeUntil = now + R.hitStopHit; shake = R.shake; hurtAt = now
      flash = { rgb: '190,20,10', t0: now, ms: 220, a: 0.4 }
      marks.push({ x, y, t0: now, kind: 'miss', off: e.off ?? 0 })
      judges.push({ x, y, t0: now, kind: 'miss', when: (e.off ?? 0) < 0 ? 'early' : 'late' })
      slashes.push({ x, y, ang: -0.7 + ((e.t * 13) % 10) / 20, len: Math.min(W, H) * 0.45, t0: now, ms: 260, color: '255,60,40', w: 10 })
      pop(`−${e.dmgMe}`, '#ff7a6a', 38)
      meAnim = { kind: 'hit', t0: now }; foeAnim = { kind: 'attack', t0: now }
      break
    case 'crit':
      // 적이 맞는 건 화면이 아니라 적장 액자(critAt 의 kick·zoom)와 적 체력 막대가 흔들린다 (형 11-11)
      SFX.crit(); critAt = now; foeHurtAt = now; freezeUntil = now + R.hitStopCrit
      flash = { rgb: '255,250,235', t0: now, ms: 260, a: 0.75 }
      slashes.push({ x: (x + panel().x + panel().s / 2) / 2, y: (y + panel().y + panel().s / 2) / 2, ang: slashAngle(x, y, e.t), len: Math.hypot(W, H) * 0.85, t0: now + 60, ms: 520, color: '255,255,255', w: 22 })
      burst(W / 2, play().y + play().h * 0.42, 34, '#ffd98a', 12, now)
      pop(`−${e.dmgFoe}`, '#ffd98a', 64, W / 2, play().y + play().h * 0.3)
      meAnim = { kind: 'attack', t0: now }; foeAnim = { kind: 'hit', t0: now }
      break
    case 'break':
      SFX.break()
      flash = { rgb: '255,200,90', t0: now, ms: 300, a: 0.35 }
      foeAnim = { kind: 'stagger', t0: now }
      break
    case 'rushHit':
      SFX.rushHit(); foeHurtAt = now; rushKickAt = now
      try { navigator.vibrate?.(18) } catch { /* 햅틱 없는 기기 */ }
      slashes.push({ x, y, ang: slashAngle(x, y, e.t), len: Math.min(W, H) * 0.32, t0: now, ms: 240, color: '255,255,255', w: 8 })
      pop(`−${e.dmgFoe}`, '#ffd98a', 26)
      meAnim = { kind: 'attack', t0: now }
      break
    case 'deflect':
      // 막힌 칼 — 소리만 (형 11-09: "연타 막힐 경우는 애니메이션도 진동도 없게 · 시원하게 공격할 수 있어야")
      SFX.deflect()
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
function sprite(im: HTMLImageElement, frame: number, x: number, base: number, h: number, flip: boolean, tint: string | null): void {
  if (!im.complete || im.naturalWidth === 0) return
  const cw = im.naturalWidth / 20, ch = im.naturalHeight, w = h * (cw / ch)
  ctx.save(); ctx.translate(x, base); if (flip) ctx.scale(-1, 1)
  if (tint === null) ctx.drawImage(im, frame * cw, 0, cw, ch, -w / 2, -h, w, h)
  else {
    // 번쩍임은 장수 모양에만 — 따로 그린 판에서 물들여 옮긴다 (판 위에 바로 칠하면 칸 네모가 통째로 물든다)
    const tw = Math.ceil(cw), th = Math.ceil(ch)
    if (tintCv.width < tw || tintCv.height < th) { tintCv.width = tw; tintCv.height = th }
    tintCx.clearRect(0, 0, tintCv.width, tintCv.height)
    tintCx.globalCompositeOperation = 'source-over'; tintCx.drawImage(im, frame * cw, 0, cw, ch, 0, 0, cw, ch)
    tintCx.globalCompositeOperation = 'source-atop'; tintCx.fillStyle = tint; tintCx.fillRect(0, 0, cw, ch)
    ctx.drawImage(tintCv, 0, 0, cw, ch, -w / 2, -h, w, h)
  }
  ctx.restore()
}
const tintCv = document.createElement('canvas')
const tintCx = tintCv.getContext('2d') as CanvasRenderingContext2D
/** 아래 들판의 작은 두 장수 (서기 0-3 · 걷기 4-11 · 공격 12-17 · 맞음 18 · 쓰러짐 19) */
function fieldFighters(now: number, base: number, h: number, gapPx: number, cx: number): void {
  const d = duel
  const meX = cx - gapPx / 2, foeX = cx + gapPx / 2
  const idleF = (o: number): number => Math.floor((now + o) / 180) % 4
  // 우리
  let mf = idleF(0), mdx = 0
  const ma = now - meAnim.t0
  if (mode === 'end' && (d.over === 'kod' || d.over === 'lose')) mf = d.over === 'kod' ? 19 : 18
  else if (meAnim.kind === 'attack' && ma < 420) { mf = 12 + Math.min(5, Math.floor(ma / 70)); mdx = gapPx * 0.32 * Math.sin(Math.min(1, ma / 300) * Math.PI) }
  else if (meAnim.kind === 'guard' && ma < 260) { mf = 12; mdx = -gapPx * 0.05 }
  else if (meAnim.kind === 'hit' && ma < 380) { mf = 18; mdx = -gapPx * 0.12 }
  // 적장
  let ff = idleF(90), fdx = 0
  const fa = now - foeAnim.t0
  if (mode === 'end' && (d.over === 'ko' || d.over === 'win')) ff = d.over === 'ko' ? 19 : 18
  else if (duel.phase === 'rush') { ff = 18; fdx = Math.sin(now / 90) * gapPx * 0.03 }
  else if (foeAnim.kind === 'windup') { ff = fa < 250 ? 12 : 13 }
  else if (foeAnim.kind === 'attack' && fa < 420) { ff = 14 + Math.min(3, Math.floor(fa / 100)); fdx = -gapPx * 0.3 * Math.sin(Math.min(1, fa / 280) * Math.PI) }
  else if (foeAnim.kind === 'hit' && fa < 500) { ff = 18; fdx = gapPx * 0.1 }
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
function panel(): { x: number; y: number; s: number } {
  const p = play()
  const s = Math.min(W - 60, p.h - 56) // 테두리 장식이 화면 밖으로 넘치지 않게
  return { x: (W - s) / 2, y: p.y + (p.h - 36 - s) / 2 + 4, s }
}
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
  return textSprite(when === 'early' ? '빠름' : '늦음', fs2, 800, when === 'early' ? '#8fd0ff' : '#ffb070', null, 'rgba(20,10,4,.92)', Math.max(3, fs2 * 0.2), true)
}
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
  if (c.heavy) {
    ctx.fillStyle = `rgba(255,90,70,${0.7 + 0.3 * k})`; ctx.font = `800 ${Math.round(r * 0.9)}px "Gowun Batang", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('!', x, y + 1); ctx.textBaseline = 'alphabetic'
  }
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
  const fs0 = Math.round(Math.min(W, pn.s) * 0.16)
  const ty = cy - sz * 0.62, jx = Math.sin(now / 33) * 3
  putText(textSprite('연타!', fs0 * 1.06, 900, '#fff6d0', '#ffb03a', 'rgba(40,10,0,.9)', Math.max(6, fs0 * 0.14), true), cx + jx, ty, 'center', (1 + 0.06 * Math.sin(now / 45)) / 1.06)
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
  ctx.save()
  ctx.translate(pn.x + pn.s / 2 + kick, pn.y + pn.s / 2); ctx.rotate(sway)
  const zoom = 1 + (sinceCrit < 500 ? 0.05 * (1 - sinceCrit / 500) : 0)
  ctx.scale(zoom, zoom)
  const pb = panelBake(pn.s)
  if (pb !== null) { ctx.globalAlpha = fadeIn; ctx.drawImage(pb, -pn.s / 2, -pn.s / 2, pn.s, pn.s); ctx.globalAlpha = 1 }
  else { roundRect(-pn.s / 2, -pn.s / 2, pn.s, pn.s, pn.s * 0.06); ctx.fillStyle = 'rgba(10,7,5,.55)'; ctx.fill() }
  if (now - foeHurtAt < 120) { roundRect(-pn.s / 2, -pn.s / 2, pn.s, pn.s, pn.s * 0.06); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,240,220,${0.28 * (1 - (now - foeHurtAt) / 120)})`; ctx.fill(); ctx.globalCompositeOperation = 'source-over' } // 맞으면 초상이 잠깐 하얗게 번쩍
  const fr = art('panel-frame')
  if (fr !== null) { const F = pn.s / 0.89, Fh = pn.s / 0.877; ctx.drawImage(scaled(fr, F, Fh), -pn.s / 2 - 0.055 * F, -pn.s / 2 - 0.061 * Fh, F, Fh) } // 테두리 안쪽 창 = 그림의 5.5~94.5% · 6.1~93.8%
  else { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(214,170,90,.85)'; roundRect(-pn.s / 2, -pn.s / 2, pn.s, pn.s, pn.s * 0.06); ctx.stroke() }
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
  for (const c of d.cues) if (c.done === null && d.t >= c.t0) drawCue(c, d.t)
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
    const word = j.kind === 'perfect' ? '완벽!' : j.kind === 'good' ? '막음' : '맞음'
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
  const fh = (H - ft) * 0.82
  fieldFighters(now, H - 6, fh, Math.min(W * 0.34, fh * 1.6), W / 2)
  pm('fighters')
  // 체간 — 판 아래 가운데, 가운데서 양쪽으로 차오른다 (세키로처럼)
  const pk = d.phase === 'rush' ? 1 : d.foe.posture / R.posture
  const pw = Math.min(W * 0.7, pn.s * 0.9), px = (W - pw) / 2, py = Math.min(ft - 22, pn.y + pn.s + 10)
  if (d.phase !== 'rush') bar(px, py, pw, 10, pk, pk > 0.8 ? '#ffb347' : '#e9c46a', 'center', 'hud-posture')
  else rushCue(now, d)
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
  pm('bars')
  // 둥근 머리 안에 얼굴
  for (const [cap, face] of [[capMe, meFace], [capFoe, foeFace]] as const) {
    if (cap === null || face === null || !face.complete || face.naturalWidth === 0) continue
    ctx.save(); ctx.beginPath(); ctx.arc(cap.cx, cap.cy, cap.r, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(face, cap.cx - cap.r * 1.15, cap.cy - cap.r * 1.0, cap.r * 2.3, cap.r * 2.3); ctx.restore()
  }
  const namePx = Math.round(14 * Math.max(1, hudS))
  const nameY = by + bh + Math.round(18 * Math.max(1, hudS))
  // 이름은 얼굴(둥근 머리) 옆 아래
  const nxMe = capMe !== null ? capMe.cx + capMe.r * 1.25 : 12, nxFoe = capFoe !== null ? capFoe.cx - capFoe.r * 1.25 : W - 12
  putText(textSprite(cfg.me.name, namePx, 700, '#f3e3c0', null, 'rgba(0,0,0,.7)', 4, false), nxMe, nameY, 'left')
  putText(textSprite(cfg.foe.name, namePx, 700, '#f3e3c0', null, 'rgba(0,0,0,.7)', 4, false), nxFoe, nameY, 'right')
  pm('faces+names')
  const sec = Math.max(0, Math.ceil((d.end - d.t) / R.hz))
  const plate = art('hud-timer')
  const tcx = W / 2, tcy = Math.round(top + tw * 0.42)
  if (plate !== null) { const ph2 = tw * 0.98, pw2 = ph2 * (plate.naturalWidth / plate.naturalHeight); ctx.drawImage(scaled(plate, pw2, ph2), tcx - pw2 / 2, tcy - ph2 / 2, pw2, ph2) }
  else { ctx.fillStyle = 'rgba(20,12,6,.85)'; ctx.beginPath(); ctx.arc(tcx, tcy, tw * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#c99a4a'; ctx.stroke() }
  const low = sec <= 10
  putText(textSprite(String(sec), tw * 0.52 * 1.08, 900, low ? '#ff6a5a' : '#ffe2a0', null, 'rgba(0,0,0,.85)', 6, true), tcx, tcy + 2, 'center', (low ? 1 + 0.08 * Math.max(0, Math.sin(now / 80)) : 1) / 1.08)
  pm('timer')
  // 숫자 — 빠르고 멀리 튄다
  for (let i = pops.length - 1; i >= 0; i--) {
    const pp = pops[i] as Pop; const age = now - pp.t0
    if (age > 620) { pops.splice(i, 1); continue }
    const k = age / 620, e = 1 - (1 - Math.min(1, age / 260)) ** 3
    const x = pp.x + pp.vx * e, y = pp.y + pp.vy * e + 60 * Math.max(0, k - 0.4) ** 2
    ctx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4
    putText(textSprite(pp.text, pp.size * 1.7, 900, pp.color, null, 'rgba(0,0,0,.8)', 6, false), x, y, 'center', (1 + 0.7 * Math.max(0, 1 - age / 90)) / 1.7)
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
  for (const [kind, word] of [['perfect', '완벽!'], ['good', '막음'], ['miss', '맞음']] as const) judgeSprite(kind, word)
  whenSprite('early'); whenSprite('late')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H)
}
function frame(now: number): void {
  raf = 0
  if (document.hidden) return
  const dt = last === 0 ? 0 : Math.min(100, now - last)
  last = now
  if (!(PROF && params.get('nowatch') === '1')) watchLoad(dt)
  warmNow(now)
  if (PROF) pt = performance.now()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (mode === 'duel' || mode === 'end') ctx.clearRect(0, 0, W, H)
  const sx = shake > 0 ? (((now * 7) % 13) / 13 - 0.5) * shake : 0
  const sy = shake > 0 ? (((now * 11) % 17) / 17 - 0.5) * shake : 0
  shake = Math.max(0, shake - 0.7)
  ctx.save(); ctx.translate(sx, sy)
  if (mode === 'field') drawField(now, 0)
  else if (mode === 'zoom') {
    const k = Math.min(1, (now - modeAt) / 700)
    drawField(now, k * k)
    if (k >= 1) begin()
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
function wake(): void { if (!document.hidden && raf === 0 && !closed) { last = 0; raf = requestAnimationFrame(frame) } }
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
return done
}
