/// <reference types="vite/client" />
/**
 * 장수 겨루기 시험판 2판 — 그리기·손·소리 (duel.html · docs/realm/council/1109-battle.md).
 * 셈은 src/duel/sim.ts. 여기는 그 상태를 읽기만 한다 (절대 규칙 2).
 *
 * 형 11-09: "화면에는 적장 이미지가 크게 · 내 장수와 적장 전투 그림은 작게 들판 하단에서 싸우는 게 보임 ·
 * 장수 겨루기는 항상 쓸 수 있는 깃발 · 시행될 때 화면 가운데로 확대 및 fade out 연출 · QTE 로 적이 공격 들어올 위치에 큰 원이 모임".
 * 소리는 누른 순간의 반응으로만 — 박자는 눈(고리)으로 잰다.
 */
import { autoWinChance, createDuel, lateWindow, stepDuel, type Cue, type Duel, type DuelEvent, type Tap } from './duel/sim.ts'
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
interface Pop { x: number; y: number; vx: number; vy: number; text: string; color: string; t0: number; size: number }
interface Spark { x: number; y: number; vx: number; vy: number; t0: number; life: number; color: string }
interface Slash { x: number; y: number; ang: number; len: number; t0: number; ms: number; color: string; w: number }
const pops: Pop[] = []
const sparks: Spark[] = []
const slashes: Slash[] = []
/** off = 누른 때 − 닿는 때 (틱) — 빨랐나 늦었나를 남은 고리로 보인다 */
const marks: { x: number; y: number; t0: number; kind: 'perfect' | 'good' | 'miss'; off: number }[] = []
let critAt = -1e9
/** 판정 막대 — 누른 때가 닿는 때보다 얼마나 빨랐나 늦었나 (osu! 의 히트 에러 막대처럼 · 버릇이 보인다) */
const errs: { off: number; t0: number; kind: 'perfect' | 'good' | 'miss' }[] = []
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
  duel = createDuel({ seed, muMe, muFoe })
  seen = 0; queued = null
  pops.length = 0; sparks.length = 0; slashes.length = 0; marks.length = 0; errs.length = 0
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
  // 숫자는 빠르고 멀리 — 위쪽 부채꼴로 튄다 (형 11-09)
  const pop = (text: string, color: string, size: number, px = x, py = y): void => {
    const a = -Math.PI / 2 + (((e.t * 47 + pops.length * 13) % 100) / 100 - 0.5) * 1.6
    const dist = Math.min(W, H) * (0.22 + size / 400)
    pops.push({ x: px, y: py, vx: Math.cos(a) * dist, vy: Math.sin(a) * dist, text, color, t0: now, size })
  }
  switch (e.kind) {
    case 'cue': foeAnim = { kind: 'windup', t0: now }; break
    case 'perfect':
      errs.push({ off: e.off ?? 0, t0: now, kind: 'perfect' })
      SFX.perfect(); freezeUntil = now + R.hitStopPerfect
      marks.push({ x, y, t0: now, kind: 'perfect', off: e.off ?? 0 }); burst(x, y, 22, '#fff1c0', 9, now)
      meAnim = { kind: 'guard', t0: now }; foeAnim = { kind: 'attack', t0: now }
      break
    case 'good':
      errs.push({ off: e.off ?? 0, t0: now, kind: 'good' })
      SFX.good(); marks.push({ x, y, t0: now, kind: 'good', off: e.off ?? 0 }); burst(x, y, 10, '#cfe6ff', 5, now); shake = R.shake * 0.3
      meAnim = { kind: 'guard', t0: now }; foeAnim = { kind: 'attack', t0: now }
      break
    case 'miss':
      errs.push({ off: e.off ?? 0, t0: now, kind: 'miss' })
      SFX.miss(); freezeUntil = now + R.hitStopHit; shake = R.shake; hurtAt = now
      flash = { rgb: '190,20,10', t0: now, ms: 220, a: 0.4 }
      marks.push({ x, y, t0: now, kind: 'miss', off: e.off ?? 0 })
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
for (const n of ['panel-frame', 'hud-bar', 'hud-posture', 'hud-timer', 'fx-clang', 'fx-slash', 'fx-ring']) art(n)
function roundRect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}
/** 초상 판 — 위 띠와 체간 사이 가운데 정사각 */
function panel(): { x: number; y: number; s: number } {
  const p = play()
  const s = Math.min(W - 24, p.h - 36)
  return { x: (W - s) / 2, y: p.y + (p.h - 36 - s) / 2 + 4, s }
}
/** 고리 반지름 — 닿기 전엔 바깥에서 모여들고, 닿은 뒤엔 원 안으로 계속 줄어든다 (형 11-09: 늦은 걸 보기만 해도 알게) */
function ringR(r: number, off: number, lead = P.duel.lead): number {
  if (off <= 0) return r * (1 + 3.2 * Math.min(1, -off / Math.max(1, lead)))
  return r * Math.max(0.08, 1 - 0.92 * off / Math.max(1, lateWindow(muMe)))
}
/** 챙 — 튕겨 나가는 빛 (에셋이 있으면 그것 · hue 0 = 금빛 · 0.6 = 흰 푸른빛) */
function clang(x: number, y: number, size: number, alpha: number, cool: number, now: number): void {
  const im = art('fx-clang')
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.max(0, alpha)
  ctx.translate(x, y); ctx.rotate((now / 900) % (Math.PI * 2))
  if (im !== null) {
    ctx.drawImage(im, -size / 2, -size / 2, size, size)
    if (cool > 0) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(150,200,255,${cool * 0.5})`; ctx.fillRect(-size / 2, -size / 2, size, size) }
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
function drawSlash(s: Slash, k: number): void {
  const im = art('fx-slash')
  const grow = Math.min(1, k * 4)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k
  ctx.translate(s.x, s.y); ctx.rotate(s.ang)
  if (im !== null) {
    const h = s.w * 6
    ctx.drawImage(im, -s.len / 2, -h / 2, s.len * grow, h)
    if (s.color !== '255,255,255') { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(${s.color},.6)`; ctx.fillRect(-s.len / 2, -h / 2, s.len, h) }
  } else {
    ctx.strokeStyle = `rgba(${s.color},1)`; ctx.lineCap = 'round'; ctx.lineWidth = s.w * (1 - k * 0.6)
    ctx.beginPath(); ctx.moveTo(-s.len / 2 * grow, 0); ctx.lineTo(s.len / 2 * grow, 0); ctx.stroke()
    ctx.lineWidth = s.w * 3; ctx.globalAlpha = 0.2 * (1 - k); ctx.stroke()
  }
  ctx.restore()
}
/** 막대 — 에셋 테두리가 있으면 그 안에 채운다 · from = 차오르는 쪽 */
function bar(x: number, y: number, w: number, h: number, v: number, col: string, from: 'left' | 'right' | 'center', frame: string): void {
  const k = Math.max(0, Math.min(1, v))
  ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(x, y, w, h)
  const fw = w * k
  const fx = from === 'left' ? x : from === 'right' ? x + w - fw : x + (w - fw) / 2
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,.35)')
  ctx.fillStyle = col; ctx.fillRect(fx, y, fw, h); ctx.fillStyle = g; ctx.globalAlpha = 0.5; ctx.fillRect(fx, y, fw, h); ctx.globalAlpha = 1
  const im = art(frame)
  if (im !== null) {
    ctx.save()
    if (from === 'right') { ctx.translate(x + w / 2, 0); ctx.scale(-1, 1); ctx.translate(-(x + w / 2), 0) }
    const padX = w * 0.04, padY = h * 0.9
    ctx.drawImage(im, x - padX, y - padY, w + padX * 2, h + padY * 2)
    ctx.restore()
  } else { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(214,170,90,.9)'; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2) }
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
  if (ringArt !== null) { ctx.globalAlpha = 0.6 + 0.4 * k; ctx.drawImage(ringArt, x - r * 1.15, y - r * 1.15, r * 2.3, r * 2.3); ctx.globalAlpha = 1 }
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

function drawDuel(now: number, fadeIn: number): void {
  const d = duel
  const R = P.duel
  const ft = fieldTop()
  // 바탕 — 전장이 살아 있게 (조금만 어둡게)
  cover(bg, 0, 0, W, H)
  ctx.fillStyle = 'rgba(8,5,3,.5)'; ctx.fillRect(0, 0, W, H)
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
  if (now - foeHurtAt < 180) { ctx.fillStyle = 'rgba(255,40,30,.22)'; ctx.fillRect(-pn.s / 2, -pn.s / 2, pn.s, pn.s) }
  ctx.restore()
  const fr = art('panel-frame')
  if (fr !== null) ctx.drawImage(fr, -pn.s / 2 - pn.s * 0.04, -pn.s / 2 - pn.s * 0.04, pn.s * 1.08, pn.s * 1.08)
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
  // 아래 들판 띠 — 작은 두 장수가 따라 싸운다
  ctx.save(); ctx.beginPath(); ctx.rect(0, ft, W, H - ft); ctx.clip()
  cover(bg, 0, ft - H * 0.35, W, H * 0.9)
  ctx.fillStyle = 'rgba(8,5,3,.3)'; ctx.fillRect(0, ft, W, H - ft)
  const fh = (H - ft) * 0.82
  fieldFighters(now, H - 6, fh, Math.min(W * 0.34, fh * 1.6), W / 2)
  ctx.restore()
  // 체간 — 판 아래 가운데, 가운데서 양쪽으로 차오른다 (세키로처럼)
  const pk = d.phase === 'rush' ? 1 : d.foe.posture / R.posture
  const pw = Math.min(W * 0.7, pn.s * 0.9), px = (W - pw) / 2, py = Math.min(ft - 22, pn.y + pn.s + 10)
  bar(px, py, pw, 12, pk, pk > 0.8 ? '#ffb347' : '#e9c46a', 'center', 'hud-posture')
  // 판정 막대 — 가운데가 딱 맞음 · 왼쪽 = 빨랐다 · 오른쪽 = 늦었다
  {
    const lw = lateWindow(muMe), mw = Math.min(W * 0.5, 220), mx = W / 2, my = py + 22
    if (my < ft - 2) {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(mx - mw / 2, my - 3, mw, 6)
      const pf = (P.duel.perfect / lw) * (mw / 2)
      ctx.fillStyle = 'rgba(255,214,120,.55)'; ctx.fillRect(mx - pf, my - 3, pf * 2, 6)
      ctx.fillStyle = '#fff'; ctx.fillRect(mx - 1, my - 7, 2, 14)
      while (errs.length > 12) errs.shift()
      for (const er of errs) {
        const a = Math.max(0, 1 - (now - er.t0) / 6000)
        if (a <= 0) continue
        const ex = mx + Math.max(-1, Math.min(1, er.off / lw)) * (mw / 2)
        ctx.globalAlpha = a; ctx.fillStyle = er.kind === 'perfect' ? '#ffd98a' : er.kind === 'good' ? (er.off < 0 ? '#8fd0ff' : '#ffb070') : '#ff5a4a'
        ctx.fillRect(ex - 2, my - 8, 4, 16)
      }
      ctx.globalAlpha = 1
    }
  }
  // 위 — 격투 게임처럼: 우리(왼쪽) · 시간(가운데 크게) · 적장(오른쪽)
  const tw = Math.min(110, W * 0.24)
  const bw = (W - tw) / 2 - 16, by = 34
  bar(10, by, bw, 16, d.me.hp / R.hp, now - hurtAt < 200 ? '#ff5a4a' : '#e9c46a', 'left', 'hud-bar')
  bar(W - 10 - bw, by, bw, 16, d.foe.hp / R.hp, now - foeHurtAt < 200 ? '#ffffff' : '#e76f51', 'right', 'hud-bar')
  ctx.font = '700 15px "Gowun Batang", serif'; ctx.fillStyle = '#f3e3c0'
  ctx.textAlign = 'left'; ctx.fillText(`${NAMES[meKey] ?? meKey} · 무예 ${muMe}`, meFace !== null ? 46 : 12, 24)
  ctx.textAlign = 'right'; ctx.fillText(`${NAMES[foeKey] ?? foeKey} · 무예 ${muFoe}`, W - 12, 24)
  if (meFace !== null && meFace.complete && meFace.naturalWidth > 0) { ctx.save(); ctx.beginPath(); ctx.arc(26, 18, 15, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(meFace, 11, 3, 30, 30); ctx.restore() }
  const sec = Math.max(0, Math.ceil((d.end - d.t) / R.hz))
  const plate = art('hud-timer')
  const tcx = W / 2, tcy = 40
  if (plate !== null) ctx.drawImage(plate, tcx - tw * 0.62, tcy - tw * 0.5, tw * 1.24, tw)
  else { ctx.fillStyle = 'rgba(20,12,6,.85)'; ctx.beginPath(); ctx.arc(tcx, tcy, tw * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#c99a4a'; ctx.stroke() }
  const low = sec <= 10
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `900 ${Math.round(tw * 0.52 * (low ? 1 + 0.08 * Math.max(0, Math.sin(now / 80)) : 1))}px "Gowun Batang", serif`
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(String(sec), tcx, tcy + 2)
  ctx.fillStyle = low ? '#ff6a5a' : '#ffe2a0'; ctx.fillText(String(sec), tcx, tcy + 2)
  ctx.textBaseline = 'alphabetic'
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
