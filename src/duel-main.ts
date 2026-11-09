/// <reference types="vite/client" />
/**
 * 장수 겨루기 시험판 2판 — 그리기·손·소리 (duel.html · docs/realm/council/1109-battle.md).
 * 셈은 src/duel/sim.ts. 여기는 그 상태를 읽기만 한다 (절대 규칙 2).
 *
 * 형 11-09: "화면에는 적장 이미지가 크게 · 내 장수와 적장 전투 그림은 작게 들판 하단에서 싸우는 게 보임 ·
 * 장수 겨루기는 항상 쓸 수 있는 깃발 · 시행될 때 화면 가운데로 확대 및 fade out 연출 · QTE 로 적이 공격 들어올 위치에 큰 원이 모임".
 * 소리는 누른 순간의 반응으로만 — 박자는 눈(고리)으로 잰다.
 */
import { autoWinChance, createDuel, stepDuel, type Cue, type Duel, type DuelEvent, type Tap } from './duel/sim.ts'
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
const SFX = {
  perfect: () => { tone(2600, 0.6, 'triangle', 0.22); tone(1950, 0.5, 'sine', 0.18); noise(0.06, 0.5, 9000) },
  good: () => { tone(1150, 0.2, 'triangle', 0.2); noise(0.05, 0.3, 6000) },
  miss: () => { noise(0.25, 0.75, 650); tone(110, 0.25, 'sine', 0.45, 0.5) },
  crit: () => { noise(0.35, 0.9, 1200, 0.05); tone(70, 0.6, 'sine', 0.6, 0.6, 0.05); tone(3200, 0.9, 'sine', 0.12, 0.98, 0.1) },
  break: () => { tone(400, 0.5, 'sawtooth', 0.12, 0.4); noise(0.3, 0.4, 900) },
  rushHit: () => { noise(0.08, 0.45, 2200); tone(260, 0.07, 'square', 0.08, 0.6) },
  deflect: () => { tone(1700, 0.12, 'triangle', 0.16); noise(0.03, 0.2, 7000) },
  flag: () => { tone(220, 0.5, 'sawtooth', 0.12, 2); noise(0.6, 0.25, 900) },
}

// ── 판
type Mode = 'field' | 'zoom' | 'duel' | 'end'
let mode: Mode = 'field'
let modeAt = 0
let duel: Duel = createDuel({ seed, muMe, muFoe })
let seen = 0
let queued: Tap | null = null
let freezeUntil = 0
let acc = 0
let last = 0
let shake = 0
let flash: { rgb: string; t0: number; ms: number; a: number } | null = null
interface Pop { x: number; y: number; text: string; color: string; t0: number; size: number }
interface Spark { x: number; y: number; vx: number; vy: number; t0: number; life: number; color: string }
interface Slash { x: number; y: number; ang: number; len: number; t0: number; ms: number; color: string; w: number }
const pops: Pop[] = []
const sparks: Spark[] = []
const slashes: Slash[] = []
const marks: { x: number; y: number; t0: number; kind: 'perfect' | 'good' | 'miss' }[] = []
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
const hudTop = (): number => 64
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
  duel = createDuel({ seed, muMe, muFoe })
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
    <div class="stats"><span>⚡ 치명 ${s.crit}</span><span>🛡 막음 ${s.good}</span><span>💥 맞음 ${s.miss}</span><span>⚔ 연타 ${s.rushHit}</span><span>✦ 튕김 ${s.deflect}</span></div>
    <div class="auto">맡겼다면 이길 몫 ${Math.round(autoWinChance(muMe, muFoe) * 100)}% (무예 ${muMe} 대 ${muFoe})</div>
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
  const pop = (text: string, color: string, size: number, px = x, py = y): void => { pops.push({ x: px, y: py, text, color, t0: now, size }) }
  switch (e.kind) {
    case 'cue': foeAnim = { kind: 'windup', t0: now }; break
    case 'perfect':
      SFX.perfect(); freezeUntil = now + R.hitStopPerfect
      marks.push({ x, y, t0: now, kind: 'perfect' }); burst(x, y, 22, '#fff1c0', 9, now)
      meAnim = { kind: 'guard', t0: now }; foeAnim = { kind: 'attack', t0: now }
      break
    case 'good':
      SFX.good(); marks.push({ x, y, t0: now, kind: 'good' }); burst(x, y, 10, '#cfe6ff', 5, now); shake = R.shake * 0.3
      meAnim = { kind: 'guard', t0: now }; foeAnim = { kind: 'attack', t0: now }
      break
    case 'miss':
      SFX.miss(); freezeUntil = now + R.hitStopHit; shake = R.shake; hurtAt = now
      flash = { rgb: '190,20,10', t0: now, ms: 220, a: 0.4 }
      marks.push({ x, y, t0: now, kind: 'miss' })
      slashes.push({ x, y, ang: -0.7 + ((e.t * 13) % 10) / 20, len: Math.min(W, H) * 0.45, t0: now, ms: 260, color: '255,60,40', w: 10 })
      pop(`−${e.dmgMe}`, '#ff7a6a', 34, 80, fieldTop() - 30)
      meAnim = { kind: 'hit', t0: now }; foeAnim = { kind: 'attack', t0: now }
      break
    case 'crit':
      SFX.crit(); critAt = now; foeHurtAt = now; freezeUntil = now + R.hitStopCrit; shake = R.shake * 1.6
      flash = { rgb: '255,250,235', t0: now, ms: 260, a: 0.75 }
      slashes.push({ x: W / 2, y: play().y + play().h * 0.42, ang: -0.62, len: Math.hypot(W, H) * 0.9, t0: now + 60, ms: 520, color: '255,255,255', w: 22 })
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
      slashes.push({ x, y, ang: -1.2 + ((e.t * 29) % 24) / 10, len: Math.min(W, H) * 0.22, t0: now, ms: 200, color: '255,240,210', w: 6 })
      pop(`−${e.dmgFoe}`, '#ffd98a', 26)
      meAnim = { kind: 'attack', t0: now }
      break
    case 'deflect':
      SFX.deflect(); burst(x, y, 8, '#9fd8ff', 6, now)
      pop('튕김', '#9fd8ff', 20)
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
  ctx.drawImage(im, frame * cw, 0, cw, ch, -w / 2, -h, w, h)
  if (tint !== null) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = tint; ctx.fillRect(-w / 2, -h, w, h) }
  ctx.restore()
}
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
  sprite(sprMe, mf, meX + mdx, base, h, false, now - hurtAt < 160 ? 'rgba(255,40,20,.35)' : null)
  sprite(sprFoe, ff, foeX + fdx, base, h, true, now - foeHurtAt < 160 ? 'rgba(255,255,255,.45)' : null)
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

function drawCue(c: Cue, t: number): void {
  const [x, y] = toPx(c.x, c.y)
  const r = cueR()
  const k = Math.min(1, Math.max(0, (t - c.t0) / Math.max(1, c.hitAt - c.t0)))
  const rgb = c.heavy ? '255,70,50' : '255,244,214'
  // 과녁 원 — 고리가 다가올수록 밝아진다
  ctx.globalCompositeOperation = 'lighter'
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6)
  g.addColorStop(0, `rgba(${rgb},${0.1 + 0.4 * k})`); g.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
  ctx.lineWidth = 4; ctx.strokeStyle = `rgba(${rgb},${0.55 + 0.45 * k})`
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
  // 모여드는 고리
  const rr = r * (1 + 3.2 * (1 - k))
  ctx.lineWidth = 3 + 3 * k; ctx.strokeStyle = `rgba(${rgb},${0.35 + 0.65 * k})`
  ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke()
  if (c.heavy) {
    ctx.fillStyle = `rgba(255,90,70,${0.7 + 0.3 * k})`; ctx.font = `800 ${Math.round(r * 0.9)}px "Gowun Batang", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('!', x, y + 1); ctx.textBaseline = 'alphabetic'
  }
}

function drawDuel(now: number, fadeIn: number): void {
  const d = duel
  const R = P.duel
  const p = play()
  // 바탕 — 어두운 들판
  cover(bg, 0, 0, W, H)
  ctx.fillStyle = 'rgba(6,4,3,.78)'; ctx.fillRect(0, 0, W, H)
  // 적장 초상 — 크게. 맞으면 흔들리고 붉게, 비틀거리면 기운다
  if (foeArt !== null && foeArt.complete && foeArt.naturalWidth > 0) {
    const s = W > p.h ? p.h * 1.08 : Math.max(W, p.h * 0.98) // 가로 화면은 높이에 맞추고 양옆을 어둡게
    const sinceCrit = now - critAt
    const sway = d.phase === 'rush' ? Math.sin(now / 160) * 0.04 : 0
    const kick = sinceCrit < 400 ? Math.sin(sinceCrit / 30) * (1 - sinceCrit / 400) * 14 : 0
    ctx.save()
    ctx.globalAlpha = fadeIn
    ctx.translate(W / 2 + kick, p.y + p.h * 0.5); ctx.rotate(sway)
    const zoom = 1 + (sinceCrit < 500 ? 0.06 * (1 - sinceCrit / 500) : 0)
    ctx.scale(zoom, zoom)
    ctx.drawImage(foeArt, -s / 2, -s / 2, s, s)
    if (now - foeHurtAt < 180) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,40,30,.25)'; ctx.fillRect(-s / 2, -s / 2, s, s) }
    ctx.restore()
    // 가장자리를 어둡게 — 초상이 판에 녹아들게 (위아래 · 양옆)
    const cy = p.y + p.h * 0.5, top = cy - s / 2, bot = cy + s / 2
    const fadeV = (y0: number, y1: number): void => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(6,4,3,1)'); g.addColorStop(1, 'rgba(6,4,3,0)'); ctx.fillStyle = g; ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0)) }
    ctx.fillStyle = 'rgba(6,4,3,1)'; ctx.fillRect(0, 0, W, Math.max(0, top)); ctx.fillRect(0, bot, W, H - bot)
    fadeV(top, top + s * 0.18); fadeV(bot, bot - s * 0.2)
    if (s < W) { const l = (W - s) / 2; for (const [x0, x1] of [[l, l + s * 0.12], [W - l, W - l - s * 0.12]] as const) { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, 'rgba(6,4,3,1)'); g.addColorStop(1, 'rgba(6,4,3,0)'); ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), H); ctx.fillStyle = 'rgba(6,4,3,1)'; ctx.fillRect(x0 < W / 2 ? 0 : W - l, 0, l, H) } }
  }
  if (d.phase === 'rush') {
    // 비틀거림 — 테두리가 금빛으로 맥박 · 남은 시간 띠
    const a = 0.35 + 0.25 * Math.sin(now / 90)
    ctx.strokeStyle = `rgba(255,200,90,${a})`; ctx.lineWidth = 10; ctx.strokeRect(5, 5, W - 10, H - 10)
    const left = Math.max(0, (d.phaseUntil - d.t) / R.rushTicks)
    ctx.fillStyle = 'rgba(255,214,120,.9)'; ctx.fillRect(W * 0.2, fieldTop() - 16, W * 0.6 * left, 6)
  }
  // 고리
  for (const c of d.cues) if (c.done === null && d.t >= c.t0) drawCue(c, d.t)
  // 판정 자국
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i] as (typeof marks)[number]; const age = now - m.t0
    if (age > 420) { marks.splice(i, 1); continue }
    const k = age / 420, r = cueR() * (1 + k * 1.4)
    ctx.lineWidth = m.kind === 'perfect' ? 8 : 4
    ctx.strokeStyle = m.kind === 'perfect' ? `rgba(255,230,140,${1 - k})` : m.kind === 'good' ? `rgba(180,220,255,${1 - k})` : `rgba(255,70,50,${1 - k})`
    ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.stroke()
  }
  // 베기 자국
  for (let i = slashes.length - 1; i >= 0; i--) {
    const s = slashes[i] as Slash; const age = now - s.t0
    if (age < 0) continue
    if (age > s.ms) { slashes.splice(i, 1); continue }
    const k = age / s.ms, grow = Math.min(1, k * 4)
    const dx = Math.cos(s.ang) * s.len / 2, dy = Math.sin(s.ang) * s.len / 2
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = `rgba(${s.color},${1 - k})`; ctx.lineCap = 'round'
    ctx.lineWidth = s.w * (1 - k * 0.6)
    ctx.beginPath(); ctx.moveTo(s.x - dx * grow, s.y - dy * grow); ctx.lineTo(s.x + dx * grow, s.y + dy * grow); ctx.stroke()
    ctx.lineWidth = s.w * 3; ctx.strokeStyle = `rgba(${s.color},${0.2 * (1 - k)})`; ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
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
  // 아래 들판 띠 — 작은 두 장수가 따라 싸운다
  const ft = fieldTop()
  ctx.save(); ctx.beginPath(); ctx.rect(0, ft, W, H - ft); ctx.clip()
  cover(bg, 0, ft - H * 0.35, W, H * 0.9)
  ctx.fillStyle = 'rgba(8,5,3,.35)'; ctx.fillRect(0, ft, W, H - ft)
  const fh = (H - ft) * 0.82
  fieldFighters(now, H - 6, fh, Math.min(W * 0.34, fh * 1.6), W / 2)
  ctx.restore()
  ctx.strokeStyle = 'rgba(240,214,160,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, ft); ctx.lineTo(W, ft); ctx.stroke()
  // 위 띠 — 적장 이름 · 체력 · 체간 / 시간
  const bw = W * 0.62, bx = (W - bw) / 2
  ctx.textAlign = 'center'; ctx.fillStyle = '#f3e3c0'; ctx.font = '700 17px "Gowun Batang", serif'
  ctx.fillText(`${NAMES[foeKey] ?? foeKey} · 무예 ${muFoe}`, W / 2, 20)
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(bx, 28, bw, 10)
  ctx.fillStyle = '#e76f51'; ctx.fillRect(bx, 28, bw * (d.foe.hp / R.hp), 10)
  // 체간 — 가운데서 양쪽으로 차오른다 (세키로처럼)
  const pk = d.phase === 'rush' ? 1 : d.foe.posture / R.posture
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(bx, 42, bw, 7)
  ctx.fillStyle = pk > 0.8 ? '#ffb347' : '#e9c46a'; ctx.fillRect(W / 2 - (bw / 2) * pk, 42, bw * pk, 7)
  const sec = Math.max(0, Math.ceil((d.end - d.t) / R.hz))
  ctx.textAlign = 'right'; ctx.font = '800 20px "Gowun Batang", serif'; ctx.fillStyle = sec <= 10 ? '#ff8a7a' : '#f3e3c0'
  ctx.fillText(String(sec), W - 12, 48)
  // 우리 체력 — 들판 띠 위
  const mb = W * 0.44
  if (meFace !== null && meFace.complete && meFace.naturalWidth > 0) {
    ctx.save(); ctx.beginPath(); ctx.arc(30, ft - 22, 18, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(meFace, 12, ft - 40, 36, 36); ctx.restore()
  }
  ctx.textAlign = 'left'; ctx.font = '700 15px "Gowun Batang", serif'; ctx.fillStyle = '#f3e3c0'
  ctx.fillText(`${NAMES[meKey] ?? meKey} · 무예 ${muMe}`, 56, ft - 28)
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(56, ft - 20, mb, 9)
  ctx.fillStyle = now - hurtAt < 200 ? '#ff5a4a' : '#e9c46a'; ctx.fillRect(56, ft - 20, mb * (d.me.hp / R.hp), 9)
  // 숫자
  ctx.textAlign = 'center'
  for (let i = pops.length - 1; i >= 0; i--) {
    const pp = pops[i] as Pop; const age = now - pp.t0
    if (age > 900) { pops.splice(i, 1); continue }
    const k = age / 900
    ctx.globalAlpha = 1 - k * k; ctx.fillStyle = pp.color
    ctx.font = `800 ${Math.round(pp.size * (1 + 0.5 * Math.max(0, 1 - age / 120)))}px "Gowun Batang", serif`
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.75)'
    ctx.strokeText(pp.text, pp.x, pp.y - 46 * k); ctx.fillText(pp.text, pp.x, pp.y - 46 * k)
  }
  ctx.globalAlpha = 1
  // 치명 — 잠깐 어두워졌다가 흰 베기
  const sc = now - critAt
  if (sc < 160) { ctx.fillStyle = `rgba(0,0,0,${0.55 * (1 - sc / 160)})`; ctx.fillRect(0, 0, W, H) }
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
