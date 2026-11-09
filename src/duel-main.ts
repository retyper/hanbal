/// <reference types="vite/client" />
/**
 * 장수 겨루기 시험판 2판 — 그리기·손·소리 (duel.html · docs/realm/council/1109-battle.md).
 * 셈은 src/duel/sim.ts. 여기는 그 상태를 읽기만 한다 (절대 규칙 2).
 *
 * 형 11-09: "화면에는 적장 이미지가 크게 · 내 장수와 적장 전투 그림은 작게 들판 하단에서 싸우는 게 보임 ·
 * 장수 겨루기는 항상 쓸 수 있는 깃발 · 시행될 때 화면 가운데로 확대 및 fade out 연출 · QTE 로 적이 공격 들어올 위치에 큰 원이 모임".
 * 소리는 누른 순간의 반응으로만 — 박자는 눈(고리)으로 잰다.
 */
import { autoWinChance, createDuel, lateWindow, stepDuel, tierOf, type Cue, type Duel, type DuelEvent, type Tap } from './duel/sim.ts'
import { LEVEL_NAME } from './realm/tier.ts'
import { GEN_OWN, HERO_BUST } from './realm/data/art.ts'
import { P } from './tune/params.ts'

const params = new URLSearchParams(location.search)
const num = (k: string, d: number): number => { const v = Number(params.get(k)); return params.get(k) !== null && Number.isFinite(v) ? v : d }
const NAMES: Record<string, string> = {
  aryeong: '알영', haebi: '해비', jumong: '주몽', soseono: '소서노', onjo: '온조', ara: '아라', gamsil: '감실', soebi: '쇠비', eomni: '엄니',
  malgalgi: '말갈기', daeso: '대소', hyeokgeose: '혁거세', duman: '두만', heo: '허황옥', irang: '이랑', gureum: '구름', beombal: '범발', dalli: '달리',
}
const meKey = params.get('me') ?? 'aryeong'
const foeKey = params.get('foe') ?? 'haebi'
const muMe = num('muMe', 5)
const muFoe = num('muFoe', 5)
let seed = num('seed', 1) >>> 0
/** 판의 세기 — 0 촌장 ~ 6 천손 (주소 ?tier=) */
const tier = Math.max(0, Math.min(6, Math.round(num('tier', 1))))
/** 띠 이름 → 초상 id (본편 표 그대로) */
const portraitOf = (key: string): string | undefined => {
  for (const [rid, k] of Object.entries(GEN_OWN)) if (k === key && HERO_BUST[rid] !== undefined) return HERO_BUST[rid]
  return undefined
}

const canvas = document.getElementById('duel') as HTMLCanvasElement
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
const over = document.getElementById('over') as HTMLDivElement
const flagBtn = document.getElementById('flag') as HTMLButtonElement

// ── 그림
const img = (src: string, fallback?: string): HTMLImageElement => {
  const i = new Image()
  if (fallback !== undefined) i.onerror = () => { i.onerror = null; i.src = fallback }
  i.src = src
  return i
}
const bg = img('realm/battle/battle-field.jpg')
const sprMe = img(`realm/anim2/gen-${meKey}.png`)
const sprFoe = img(`realm/anim2/gen-${foeKey}.png`)
const foePid = portraitOf(foeKey)
const mePid = portraitOf(meKey)
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
type SndSlot = 'good' | 'perfect' | 'crit' | 'rushHit' | 'deflect' | 'hurt' | 'swing' | 'break' | 'intro'
const SND_FILES: Record<SndSlot, readonly string[]> = {
  good: ['good_h.mp3'], perfect: ['perfect_h.mp3'], crit: ['crit_a.ogg'], rushHit: ['rushHit_h1.mp3', 'rushHit_h2.mp3', 'rushHit_h3.mp3'],
  deflect: ['deflect_h.mp3'], hurt: ['hurt_h.mp3'], swing: ['swing_b.ogg'], break: ['break_h.mp3'], intro: ['intro_h.wav'],
}
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
  let i = 0
  if (bufs.length > 1) { // 셋을 섞어 돌린다 — 바로 앞 소리는 피한다
    rushTurn = (rushTurn * 1103515245 + 12345) >>> 0
    i = (rushTurn >>> 16) % bufs.length
    if (i === rushLast) i = (i + 1) % bufs.length
    rushLast = i
  }
  const buf = bufs[i] as AudioBuffer
  const src = a.createBufferSource(); src.buffer = buf
  const g = a.createGain(); g.gain.value = vol
  src.connect(g).connect(a.destination)
  const t = a.currentTime + delay, cut = SND_CUT[slot]
  if (cut !== undefined && buf.duration > cut) {
    g.gain.setValueAtTime(vol, t + cut * 0.6); g.gain.linearRampToValueAtTime(0.0001, t + cut)
    src.start(t, 0, cut)
  } else src.start(t)
  return true
}
/** 싸움 음악 — 본편 싸움판과 같은 곡 (sound.ts 의 bgm_war c7v · 크기 0.3). 겨루기 화면이 떠도 끊기지 않는다 (형 11-09) */
const bgm = new Audio('realm/sfx/bgm_war_c7v.ogg')
bgm.loop = true
bgm.volume = 0.3
function startBgm(): void { if (bgm.paused) void bgm.play().catch(() => undefined) }
document.addEventListener('visibilitychange', () => { if (document.hidden) bgm.pause(); else if (mode !== 'field' || bgmStarted) startBgm() })
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
let mode: Mode = 'field'
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
let critAt = -1e9
let hurtAt = -1e9
let foeHurtAt = -1e9
/** 아래 들판 장수들이 하는 짓 — 그리기만 */
let meAnim: { kind: 'idle' | 'guard' | 'hit' | 'attack'; t0: number } = { kind: 'idle', t0: 0 }
let foeAnim: { kind: 'idle' | 'windup' | 'attack' | 'hit' | 'stagger'; t0: number } = { kind: 'idle', t0: 0 }

// ── 크기 · 자리
let W = 0, H = 0, dpr = 1
function resize(): void {
  dpr = Math.min(2, devicePixelRatio || 1)
  W = innerWidth; H = innerHeight
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
}
addEventListener('resize', resize)
resize()
const hudTop = (): number => 84
const fieldTop = (): number => H * 0.8
/** 고리가 서는 칸 — 위 띠와 아래 들판 사이 전부 */
const play = (): { x: number; y: number; w: number; h: number } => ({ x: 0, y: hudTop(), w: W, h: fieldTop() - hudTop() })
const toPx = (x: number, y: number): [number, number] => { const p = play(); return [p.x + x * p.w, p.y + y * p.h] }
const cueR = (): number => P.duel.radius * Math.min(W, play().h)

// ── 손
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault()
  if (mode !== 'duel' || duel.over !== null) return
  audio()
  const p = play()
  queued = { x: (e.clientX - p.x) / p.w, y: (e.clientY - p.y) / p.h }
})
flagBtn.addEventListener('click', () => {
  audio(); SFX.flag()
  flagBtn.classList.add('hide')
  mode = 'zoom'; modeAt = performance.now()
})

function begin(): void {
  duel = createDuel({ seed, muMe, muFoe, tier })
  seen = 0; queued = null
  pops.length = 0; sparks.length = 0; slashes.length = 0; marks.length = 0
  mode = 'duel'; modeAt = performance.now()
  over.classList.add('hide')
}

const RESULT: Record<string, { word: string; col: string }> = {
  ko: { word: 'KO 승리', col: '#ffd98a' }, win: { word: '판정승', col: '#ffe9b8' }, draw: { word: '비김', col: '#d9d2c2' },
  lose: { word: '판정패', col: '#ffb3a6' }, kod: { word: 'KO 패배', col: '#ff8a7a' },
}
function showEnd(): void {
  const d = duel
  const r = RESULT[d.over ?? 'draw'] as { word: string; col: string }
  const s = d.stats
  mode = 'end'
  over.classList.remove('hide')
  over.innerHTML = `<div class="card"><div class="big" style="color:${r.col}">${r.word}</div>
    <div class="sub">체력 ${Math.round(d.me.hp)} 대 ${Math.round(d.foe.hp)} · ${Math.round(d.t / P.duel.hz)}초</div>
    <div class="stats"><span>⚡ 치명 ${s.crit}</span><span>🛡 막음 ${s.good}</span><span>💥 맞음 ${s.miss}</span><span>⚔ 연타 ${s.rushHit}</span><span>✦ 막힌 칼 ${s.deflect}</span></div>
    <div class="auto">${LEVEL_NAME[tier] ?? ''} · 맡겼다면 이길 몫 ${Math.round(autoWinChance(muMe, muFoe) * 100)}% (무예 ${muMe} 대 ${muFoe})</div>
    <button id="again">한 판 더</button></div>`
  ;(document.getElementById('again') as HTMLButtonElement).onclick = () => { seed = (seed + 1) >>> 0; begin() }
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
      meAnim = { kind: 'guard', t0: now }; foeAnim = { kind: 'attack', t0: now }
      break
    case 'good':
      SFX.good(); marks.push({ x, y, t0: now, kind: 'good', off: e.off ?? 0 }); burst(x, y, 10, '#cfe6ff', 5, now); shake = R.shake * 0.3
      meAnim = { kind: 'guard', t0: now }; foeAnim = { kind: 'attack', t0: now }
      break
    case 'miss':
      SFX.miss(); freezeUntil = now + R.hitStopHit; shake = R.shake; hurtAt = now
      flash = { rgb: '190,20,10', t0: now, ms: 220, a: 0.4 }
      marks.push({ x, y, t0: now, kind: 'miss', off: e.off ?? 0 })
      slashes.push({ x, y, ang: -0.7 + ((e.t * 13) % 10) / 20, len: Math.min(W, H) * 0.45, t0: now, ms: 260, color: '255,60,40', w: 10 })
      pop(`−${e.dmgMe}`, '#ff7a6a', 38)
      meAnim = { kind: 'hit', t0: now }; foeAnim = { kind: 'attack', t0: now }
      break
    case 'crit':
      SFX.crit(); critAt = now; foeHurtAt = now; freezeUntil = now + R.hitStopCrit; shake = R.shake * 1.6
      flash = { rgb: '255,250,235', t0: now, ms: 260, a: 0.75 }
      slashes.push({ x: (x + panel().x + panel().s / 2) / 2, y: (y + panel().y + panel().s / 2) / 2, ang: slashAngle(x, y, e.t), len: Math.hypot(W, H) * 0.85, t0: now + 60, ms: 520, color: '255,255,255', w: 22 })
      burst(W / 2, play().y + play().h * 0.42, 34, '#ffd98a', 12, now)
      pop(`−${e.dmgFoe}`, '#ffd98a', 64, W / 2, play().y + play().h * 0.3)
      meAnim = { kind: 'attack', t0: now }; foeAnim = { kind: 'hit', t0: now }
      break
    case 'break':
      SFX.break(); shake = R.shake * 0.8
      flash = { rgb: '255,200,90', t0: now, ms: 300, a: 0.35 }
      foeAnim = { kind: 'stagger', t0: now }
      break
    case 'rushHit':
      SFX.rushHit(); foeHurtAt = now
      slashes.push({ x, y, ang: slashAngle(x, y, e.t), len: Math.min(W, H) * 0.32, t0: now, ms: 240, color: '255,255,255', w: 8 })
      pop(`−${e.dmgFoe}`, '#ffd98a', 26)
      meAnim = { kind: 'attack', t0: now }
      break
    case 'deflect':
      // 챙 — 튕겨 나가는 빛과 소리 (글자 없이)
      SFX.deflect(); marks.push({ x, y, t0: now, kind: 'good', off: 0 }); burst(x, y, 12, '#cfe6ff', 8, now); shake = R.shake * 0.25
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
    ctx.fillText(`${NAMES[meKey] ?? meKey}  ⚔  ${NAMES[foeKey] ?? foeKey}`, W / 2, H * 0.36)
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
    return null
  }
  return im
}
for (const n of ['panel-frame', 'hud-bar', 'hud-posture', 'hud-timer', 'fx-clang', 'fx-slash', 'fx-ring', 'rush-tap-a', 'rush-tap-b']) art(n)
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
/**
 * 그림을 한 빛으로 물들인 판 — 그림 모양에만 색이 든다 (화면에 바로 source-atop 을 칠하면 네모가 통째로 물든다 · 형 11-09).
 * 색마다 한 번 만들어 둔다.
 */
const TINTED = new Map<string, HTMLCanvasElement>()
function tinted(im: HTMLImageElement, color: string): HTMLCanvasElement {
  const key = `${im.src}|${color}`
  let cv = TINTED.get(key)
  if (cv === undefined) {
    cv = document.createElement('canvas')
    cv.width = im.naturalWidth; cv.height = im.naturalHeight
    const c = cv.getContext('2d') as CanvasRenderingContext2D
    c.drawImage(im, 0, 0)
    c.globalCompositeOperation = 'source-atop'; c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height)
    TINTED.set(key, cv)
  }
  return cv
}
/** 챙 — 튕겨 나가는 빛 (에셋이 있으면 그것 · hue 0 = 금빛 · 0.6 = 흰 푸른빛) */
function clang(x: number, y: number, size: number, alpha: number, cool: number, now: number): void {
  const im = art('fx-clang')
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.max(0, alpha)
  ctx.translate(x, y); ctx.rotate((now / 900) % (Math.PI * 2))
  if (im !== null) {
    // 막음은 흰 푸른빛 · 정확은 금빛 (그림 모양에만 물든다)
    ctx.drawImage(cool > 0 ? tinted(im, 'rgba(150,200,255,.5)') : im, -size / 2, -size / 2, size, size)
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

function drawSlash(s: Slash, k: number): void {
  const im = art('fx-slash')
  const grow = Math.min(1, k * 3.5)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5
  ctx.translate(s.x, s.y); ctx.rotate(s.ang)
  const x0 = -s.len / 2
  if (im !== null) {
    const h = s.w * 6
    // 그림의 왼쪽부터 grow 만큼만 — 칼이 시작점에서 끝점으로 지나간다
    const src = s.color === '255,255,255' ? im : tinted(im, `rgba(${s.color},.6)`)
    ctx.drawImage(src, 0, 0, im.naturalWidth * grow, im.naturalHeight, x0, -h / 2, s.len * grow, h)
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
    const iw = im.naturalWidth, ih = im.naturalHeight
    const dy = y - geo.y0 * ih * sc, dh = ih * sc
    const lw = geo.capL * iw, rw = (1 - geo.capR) * iw
    ctx.drawImage(im, 0, 0, lw, ih, x, dy, lw * sc, dh)
    ctx.drawImage(im, geo.capR * iw, 0, rw, ih, x + ow - rw * sc, dy, rw * sc, dh)
    if (geo.mid !== undefined) {
      const m0 = geo.mid[0] * iw, m1 = geo.mid[1] * iw, mw = (m1 - m0) * sc, cx = x + ow / 2
      ctx.drawImage(im, m0, 0, m1 - m0, ih, cx - mw / 2, dy, mw, dh)
      ctx.drawImage(im, lw, 0, m0 - lw, ih, x + lw * sc, dy, cx - mw / 2 - (x + lw * sc), dh)
      ctx.drawImage(im, m1, 0, geo.capR * iw - m1, ih, cx + mw / 2, dy, x + ow - rw * sc - (cx + mw / 2), dh)
    } else ctx.drawImage(im, lw, 0, geo.capR * iw - lw, ih, x + lw * sc, dy, ow - (lw + rw) * sc, dh)
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
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6)
  g.addColorStop(0, `rgba(${rgb},${0.1 + 0.4 * k})`); g.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
  const ringArt = art('fx-ring')
  if (ringArt !== null) {
    // 과녁 고리 에셋 — 띠 한가운데가 r 에 오게 (띠 중심 = 그림 폭의 0.46)
    const sz = r / 0.92 // 그림 반폭 · 띠 중심 = 반폭의 0.92
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 + 0.45 * k
    ctx.drawImage(c.heavy ? tinted(ringArt, 'rgba(255,60,40,.6)') : ringArt, x - sz, y - sz, sz * 2, sz * 2)
    ctx.restore()
  }
  else { ctx.lineWidth = 4; ctx.strokeStyle = `rgba(${rgb},${0.55 + 0.45 * k})`; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke() }
  // 모여드는 고리 — 원을 지나면 안으로 계속 줄어든다
  const rr = ringR(r, off, lead)
  const past = off > 0
  ctx.lineWidth = past ? 4 : 3 + 3 * k
  ctx.strokeStyle = past ? `rgba(255,150,60,${Math.max(0.2, 1 - off / 20)})` : `rgba(${rgb},${0.35 + 0.65 * k})`
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
  if (im !== null) ctx.drawImage(im, cx - sz / 2, cy - sz / 2, sz, sz)
  else { ctx.fillStyle = beat === 1 ? '#ffd27a' : '#fff1c0'; ctx.beginPath(); ctx.arc(cx, cy, sz * 0.32, 0, Math.PI * 2); ctx.fill() }
  // 「연타!」 — 크게 흔들리며
  const fs = Math.round(Math.min(W, pn.s) * 0.16 * (1 + 0.06 * Math.sin(now / 45)))
  ctx.font = `900 ${fs}px "Gowun Batang", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const ty = cy - sz * 0.62, jx = Math.sin(now / 33) * 3
  ctx.lineWidth = Math.max(6, fs * 0.14); ctx.strokeStyle = 'rgba(40,10,0,.9)'; ctx.strokeText('연타!', cx + jx, ty)
  const g = ctx.createLinearGradient(0, ty - fs / 2, 0, ty + fs / 2); g.addColorStop(0, '#fff6d0'); g.addColorStop(1, '#ffb03a')
  ctx.fillStyle = g; ctx.fillText('연타!', cx + jx, ty)
  ctx.textBaseline = 'alphabetic'
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
  cover(bg, 0, 0, W, H)
  const shade = ctx.createLinearGradient(0, 0, 0, H)
  shade.addColorStop(0, 'rgba(8,5,3,.7)'); shade.addColorStop(0.55, 'rgba(8,5,3,.5)'); shade.addColorStop(0.82, 'rgba(8,5,3,.2)'); shade.addColorStop(1, 'rgba(8,5,3,.35)')
  ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H)
  // 초상 판 — 모서리 둥근 정사각 · 초상은 살짝 비친다. 맞으면 흔들리고 붉게, 비틀거리면 기운다
  const pn = panel()
  const sinceCrit = now - critAt
  const sway = d.phase === 'rush' ? Math.sin(now / 160) * 0.03 : 0
  const kick = sinceCrit < 400 ? Math.sin(sinceCrit / 30) * (1 - sinceCrit / 400) * 12 : 0
  ctx.save()
  ctx.translate(pn.x + pn.s / 2 + kick, pn.y + pn.s / 2); ctx.rotate(sway)
  const zoom = 1 + (sinceCrit < 500 ? 0.05 * (1 - sinceCrit / 500) : 0)
  ctx.scale(zoom, zoom)
  roundRect(-pn.s / 2, -pn.s / 2, pn.s, pn.s, pn.s * 0.06)
  ctx.save(); ctx.clip()
  ctx.fillStyle = 'rgba(10,7,5,.55)'; ctx.fillRect(-pn.s / 2, -pn.s / 2, pn.s, pn.s)
  if (foeArt !== null && foeArt.complete && foeArt.naturalWidth > 0) {
    ctx.globalAlpha = 0.9 * fadeIn
    ctx.drawImage(foeArt, -pn.s / 2, -pn.s / 2, pn.s, pn.s)
    ctx.globalAlpha = 1
  }
  if (now - foeHurtAt < 120) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,240,220,${0.28 * (1 - (now - foeHurtAt) / 120)})`; ctx.fillRect(-pn.s / 2, -pn.s / 2, pn.s, pn.s); ctx.globalCompositeOperation = 'source-over' } // 맞으면 초상이 잠깐 하얗게 번쩍
  ctx.restore()
  const fr = art('panel-frame')
  if (fr !== null) { const F = pn.s / 0.89, Fh = pn.s / 0.877; ctx.drawImage(fr, -pn.s / 2 - 0.055 * F, -pn.s / 2 - 0.061 * Fh, F, Fh) } // 테두리 안쪽 창 = 그림의 5.5~94.5% · 6.1~93.8%
  else { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(214,170,90,.85)'; roundRect(-pn.s / 2, -pn.s / 2, pn.s, pn.s, pn.s * 0.06); ctx.stroke() }
  ctx.restore()
  if (d.phase === 'rush') {
    // 비틀거림 — 판 둘레가 금빛으로 맥박
    const a = 0.4 + 0.3 * Math.sin(now / 90)
    ctx.save(); ctx.shadowColor = `rgba(255,200,90,${a})`; ctx.shadowBlur = 30; ctx.lineWidth = 6; ctx.strokeStyle = `rgba(255,210,110,${a})`
    roundRect(pn.x, pn.y, pn.s, pn.s, pn.s * 0.06); ctx.stroke(); ctx.restore()
  }
  // 고리
  for (const c of d.cues) if (c.done === null && d.t >= c.t0) drawCue(c, d.t)
  // 판정 자국 — 챙! 빛 (정확·막음) · 붉은 자국 (맞음) · 빨랐다/늦었다는 남은 고리 크기로
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i] as (typeof marks)[number]; const age = now - m.t0
    const life = m.kind === 'perfect' ? 420 : 520
    if (age > life) { marks.splice(i, 1); continue }
    const k = age / life
    if (m.kind !== 'perfect') {
      // 누른 순간의 고리를 그 자리에 얼려 보인다 — 바깥에 남았으면 빨랐다, 안으로 들어갔으면 늦었다
      const r0 = cueR(), rr = ringR(r0, m.off)
      ctx.lineWidth = 4; ctx.strokeStyle = m.off < 0 ? `rgba(120,200,255,${1 - k})` : `rgba(255,150,60,${1 - k})`
      ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(m.x, m.y, r0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([])
      ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(m.x, m.y, rr, 0, Math.PI * 2); ctx.stroke()
      if (m.kind === 'miss') { ctx.lineWidth = 5; ctx.strokeStyle = `rgba(255,60,40,${1 - k})`; ctx.beginPath(); ctx.moveTo(m.x - r0 * 0.6, m.y - r0 * 0.6); ctx.lineTo(m.x + r0 * 0.6, m.y + r0 * 0.6); ctx.moveTo(m.x + r0 * 0.6, m.y - r0 * 0.6); ctx.lineTo(m.x - r0 * 0.6, m.y + r0 * 0.6); ctx.stroke() }
      if (m.kind === 'miss') continue
    }
    clang(m.x, m.y, cueR() * (m.kind === 'perfect' ? 3.2 : 2) * (0.6 + 0.6 * Math.min(1, k * 3)), 1 - k, m.kind === 'perfect' ? 0 : 0.6, now)
  }
  // 베기 자국
  for (let i = slashes.length - 1; i >= 0; i--) {
    const s = slashes[i] as Slash; const age = now - s.t0
    if (age < 0) continue
    if (age > s.ms) { slashes.splice(i, 1); continue }
    drawSlash(s, age / s.ms)
  }
  // 불꽃
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i] as Spark; const age = now - s.t0
    if (age > s.life) { sparks.splice(i, 1); continue }
    const k = age / 16
    ctx.strokeStyle = s.color; ctx.globalAlpha = 1 - age / s.life; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(s.x + s.vx * k, s.y + s.vy * k + 0.05 * k * k); ctx.lineTo(s.x + s.vx * (k + 2.2), s.y + s.vy * (k + 2.2) + 0.05 * (k + 2.2) ** 2); ctx.stroke()
  }
  ctx.globalAlpha = 1
  // 아래 — 같은 전장 위에서 작은 두 장수가 따라 싸운다 (따로 깐 배경 없음)
  const fh = (H - ft) * 0.82
  fieldFighters(now, H - 6, fh, Math.min(W * 0.34, fh * 1.6), W / 2)
  // 체간 — 판 아래 가운데, 가운데서 양쪽으로 차오른다 (세키로처럼)
  const pk = d.phase === 'rush' ? 1 : d.foe.posture / R.posture
  const pw = Math.min(W * 0.7, pn.s * 0.9), px = (W - pw) / 2, py = Math.min(ft - 22, pn.y + pn.s + 10)
  if (d.phase !== 'rush') bar(px, py, pw, 10, pk, pk > 0.8 ? '#ffb347' : '#e9c46a', 'center', 'hud-posture')
  else rushCue(now, d)
  // 위 — 격투 게임처럼: 우리(왼쪽) · 시간(가운데 크게) · 적장(오른쪽)
  const tw = Math.min(104, W * 0.24)
  const plateW = tw * 0.98 * 1.32
  const bw = (W - plateW) / 2 - 6, by = 36
  const capMe = bar(4, by, bw, 10, d.me.hp / R.hp, now - hurtAt < 200 ? '#ff5a4a' : '#e9c46a', 'left', 'hud-bar')
  const capFoe = bar(W - 4 - bw, by, bw, 10, d.foe.hp / Math.round(R.hp * tierOf(d).foeHp), now - foeHurtAt < 200 ? '#ffffff' : '#e76f51', 'right', 'hud-bar')
  // 둥근 머리 안에 얼굴
  for (const [cap, face] of [[capMe, meFace], [capFoe, foeFace]] as const) {
    if (cap === null || face === null || !face.complete || face.naturalWidth === 0) continue
    ctx.save(); ctx.beginPath(); ctx.arc(cap.cx, cap.cy, cap.r, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(face, cap.cx - cap.r * 1.15, cap.cy - cap.r * 1.0, cap.r * 2.3, cap.r * 2.3); ctx.restore()
  }
  ctx.font = '700 14px "Gowun Batang", serif'; ctx.fillStyle = '#f3e3c0'
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)'
  const nameY = by + 30
  ctx.textAlign = 'left'; ctx.strokeText(`${NAMES[meKey] ?? meKey} · 무예 ${muMe}`, 8 + (capMe?.r ?? 0) * 2.2, nameY); ctx.fillText(`${NAMES[meKey] ?? meKey} · 무예 ${muMe}`, 8 + (capMe?.r ?? 0) * 2.2, nameY)
  ctx.textAlign = 'right'; ctx.strokeText(`${NAMES[foeKey] ?? foeKey} · 무예 ${muFoe}`, W - 8 - (capFoe?.r ?? 0) * 2.2, nameY); ctx.fillText(`${NAMES[foeKey] ?? foeKey} · 무예 ${muFoe}`, W - 8 - (capFoe?.r ?? 0) * 2.2, nameY)
  const sec = Math.max(0, Math.ceil((d.end - d.t) / R.hz))
  const plate = art('hud-timer')
  const tcx = W / 2, tcy = 40
  if (plate !== null) { const ph2 = tw * 0.98, pw2 = ph2 * (plate.naturalWidth / plate.naturalHeight); ctx.drawImage(plate, tcx - pw2 / 2, tcy - ph2 / 2, pw2, ph2) }
  else { ctx.fillStyle = 'rgba(20,12,6,.85)'; ctx.beginPath(); ctx.arc(tcx, tcy, tw * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#c99a4a'; ctx.stroke() }
  const low = sec <= 10
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `900 ${Math.round(tw * 0.52 * (low ? 1 + 0.08 * Math.max(0, Math.sin(now / 80)) : 1))}px "Gowun Batang", serif`
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(String(sec), tcx, tcy + 2)
  ctx.fillStyle = low ? '#ff6a5a' : '#ffe2a0'; ctx.fillText(String(sec), tcx, tcy + 2)
  ctx.textBaseline = 'alphabetic'
  ctx.font = '700 13px "Gowun Batang", serif'; ctx.fillStyle = 'rgba(243,227,192,.85)'; ctx.fillText(LEVEL_NAME[tier] ?? '', tcx, tcy + tw * 0.62)
  // 숫자 — 빠르고 멀리 튄다
  for (let i = pops.length - 1; i >= 0; i--) {
    const pp = pops[i] as Pop; const age = now - pp.t0
    if (age > 620) { pops.splice(i, 1); continue }
    const k = age / 620, e = 1 - (1 - Math.min(1, age / 260)) ** 3
    const x = pp.x + pp.vx * e, y = pp.y + pp.vy * e + 60 * Math.max(0, k - 0.4) ** 2
    ctx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4; ctx.fillStyle = pp.color
    ctx.font = `900 ${Math.round(pp.size * (1 + 0.7 * Math.max(0, 1 - age / 90)))}px "Gowun Batang", serif`
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.8)'
    ctx.strokeText(pp.text, x, y); ctx.fillText(pp.text, x, y)
  }
  ctx.globalAlpha = 1
  // 치명 — 잠깐 어두워졌다가 흰 베기
  if (sinceCrit < 160) { ctx.fillStyle = `rgba(0,0,0,${0.55 * (1 - sinceCrit / 160)})`; ctx.fillRect(0, 0, W, H) }
}

// ── 돌리기 (탭이 숨으면 멈춘다 · 절대 규칙 4)
let raf = 0
function frame(now: number): void {
  raf = 0
  if (document.hidden) return
  const dt = last === 0 ? 0 : Math.min(100, now - last)
  last = now
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
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
      if (duel.over !== null) setTimeout(showEnd, 900)
    } else acc = 0
    drawDuel(now, Math.min(1, (now - modeAt) / 450))
    if (mode === 'duel' && now - modeAt < 450) { ctx.fillStyle = `rgba(0,0,0,${1 - (now - modeAt) / 450})`; ctx.fillRect(-20, -20, W + 40, H + 40) }
  }
  ctx.restore()
  if (flash !== null) {
    const a = flash.a * Math.max(0, 1 - (now - flash.t0) / flash.ms)
    ctx.fillStyle = `rgba(${flash.rgb},${a})`; ctx.fillRect(0, 0, W, H)
    if (now - flash.t0 > flash.ms) flash = null
  }
  raf = requestAnimationFrame(frame)
}
function wake(): void { if (!document.hidden && raf === 0) { last = 0; raf = requestAnimationFrame(frame) } }
document.addEventListener('visibilitychange', wake)
wake()
