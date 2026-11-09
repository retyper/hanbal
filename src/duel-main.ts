/// <reference types="vite/client" />
/**
 * 장수 겨루기 시험판 — 그리기·손·소리 (duel.html · docs/realm/council/1109-battle.md).
 * 셈은 src/duel/sim.ts 가 한다. 여기는 그 상태를 읽기만 한다 (절대 규칙 2).
 *
 * 낌새는 눈으로 — 적장 무기에 빛이 차오르다 타격 순간 가장 밝다. 빛깔이 수를 말한다:
 *   흰빛 = 빠른 찌르기(받아치기) · 붉은빛 = 크게 휘두르기(일찍 끊거나 피하기 · 막는 폭이 좁다) · 노란빛 = 속임수(헛동작 뒤 진짜가 온다).
 * 소리는 누른 순간의 반응으로만 쓴다 — 폰 브라우저는 소리가 늦게 나는 기기가 있어 소리에 박자를 걸지 않는다 (형 11-09).
 */
import { autoWinChance, createDuel, foePhase, stepDuel, type Act, type Duel, type DuelEvent, type FoeMove } from './duel/sim.ts'
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

const canvas = document.getElementById('duel') as HTMLCanvasElement
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
const over = document.getElementById('over') as HTMLDivElement
const pads = [...document.querySelectorAll<HTMLDivElement>('.pad')]

// ── 그림
const img = (src: string): HTMLImageElement => { const i = new Image(); i.src = src; return i }
const bg = img('realm/battle/battle-field.jpg')
const sprMe = img(`realm/anim2/gen-${meKey}.png`)
const sprFoe = img(`realm/anim2/gen-${foeKey}.png`)
const fxImpact = img('realm/fx/impact.png')

// ── 소리 (합성 · 누른 순간 반응만)
let ac: AudioContext | null = null
const audio = (): AudioContext | null => {
  if (ac === null) { try { ac = new AudioContext() } catch { ac = null } }
  if (ac !== null && ac.state === 'suspended') void ac.resume()
  return ac
}
function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 1): void {
  const a = audio(); if (a === null) return
  const o = a.createOscillator(); const g = a.createGain()
  o.type = type; o.frequency.setValueAtTime(freq, a.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), a.currentTime + dur)
  g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur)
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur)
}
function noise(dur: number, vol: number, lp: number): void {
  const a = audio(); if (a === null) return
  const n = Math.floor(a.sampleRate * dur); const b = a.createBuffer(1, n, a.sampleRate); const ch = b.getChannelData(0)
  for (let i = 0; i < n; i++) ch[i] = (((i * 1103515245 + 12345) >>> 0) / 4294967296 * 2 - 1) * (1 - i / n)
  const s = a.createBufferSource(); s.buffer = b
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp
  const g = a.createGain(); g.gain.value = vol
  s.connect(f).connect(g).connect(a.destination); s.start()
}
const SFX: Partial<Record<DuelEvent['kind'] | 'press', () => void>> = {
  perfect: () => { tone(2400, 0.5, 'triangle', 0.25); tone(1800, 0.4, 'sine', 0.2); noise(0.08, 0.5, 9000) },
  parry: () => { tone(1100, 0.18, 'triangle', 0.2); noise(0.05, 0.3, 6000) },
  hit: () => { noise(0.22, 0.7, 700); tone(120, 0.2, 'sine', 0.4, 0.5) },
  counter: () => { noise(0.16, 0.6, 1600); tone(220, 0.15, 'square', 0.12, 0.5) },
  interrupt: () => { noise(0.2, 0.7, 1800); tone(300, 0.2, 'square', 0.12, 0.4) },
  clash: () => { tone(900, 0.15, 'triangle', 0.18); noise(0.05, 0.3, 5000) },
  blocked: () => { tone(600, 0.1, 'triangle', 0.15); noise(0.04, 0.2, 3000) },
  dodge: () => { noise(0.18, 0.25, 2500) },
  press: () => { noise(0.06, 0.12, 4000) },
}

// ── 판
let duel: Duel = createDuel({ seed, muMe, muFoe })
let started = false
let seen = 0
let queued: Act | null = null
let freezeUntil = 0
let acc = 0
let last = 0
let shake = 0
let flash: { color: string; until: number; a: number } | null = null
interface Pop { x: number; y: number; text: string; color: string; t0: number }
interface Spark { x: number; y: number; vx: number; vy: number; t0: number; life: number; color: string }
const pops: Pop[] = []
const sparks: Spark[] = []
const ghosts: { t0: number; x: number }[] = []
let impactAt: { t0: number; x: number; y: number } | null = null

// ── 손
function press(a: Act): void {
  if (!started || duel.over !== null) return
  queued = a
  SFX.press?.()
  const el = pads.find((p) => p.dataset.act === a)
  if (el !== undefined) { el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 90) }
}
for (const p of pads) p.addEventListener('pointerdown', (e) => { e.preventDefault(); press(p.dataset.act as Act) })
addEventListener('keydown', (e) => {
  if (e.repeat) return
  const k = e.key.toLowerCase()
  if (k === 'arrowleft' || k === 'a') press('dodge')
  else if (k === ' ' || k === 'arrowdown' || k === 's' || k === 'j') press('parry')
  else if (k === 'arrowright' || k === 'd' || k === 'k') press('strike')
  else if (k === 'enter' && !started) begin()
})

// ── 겹 화면 (시작 · 끝)
function showStart(): void {
  over.classList.remove('hide')
  over.innerHTML = `<div class="card"><h1>장수 겨루기</h1>
    <div class="row"><span class="dot" style="color:#fff;background:#fff"></span>흰빛: 빠른 찌르기. 빛이 가장 밝을 때 받아치기</div>
    <div class="row"><span class="dot" style="color:#ff4a3a;background:#ff4a3a"></span>붉은빛: 크게 휘두르기. 일찍 치면 끊고, 늦으면 피하기</div>
    <div class="row"><span class="dot" style="color:#ffd24a;background:#ffd24a"></span>노란빛: 속임수. 한 번 꺼졌다가 진짜가 온다</div>
    <div class="row"><span class="dot" style="color:#7fd0ff;background:#7fd0ff"></span>튕겨 내거나 비키면 빈틈. 그때 치기</div>
    <button id="go">겨루기 시작</button></div>`
  ;(document.getElementById('go') as HTMLButtonElement).onclick = begin
}
function begin(): void {
  audio()
  duel = createDuel({ seed, muMe, muFoe })
  seen = 0; queued = null; pops.length = 0; sparks.length = 0; ghosts.length = 0
  started = true
  over.classList.add('hide')
}
function showEnd(): void {
  const d = duel
  const word = d.over === 'win' ? '이겼다' : d.over === 'lose' ? '졌다' : '비겼다'
  const col = d.over === 'win' ? '#ffd98a' : d.over === 'lose' ? '#ff8a7a' : '#d9d2c2'
  const s = d.stats
  over.classList.remove('hide')
  over.innerHTML = `<div class="card"><div class="big" style="color:${col}">${word}</div>
    <div class="stats"><span>✨ 튕겨 냄 ${s.perfect}</span><span>🛡 막음 ${s.parry}</span><span>↩ 비킴 ${s.dodge}</span><span>⚔ 빈틈 ${s.counter}</span><span>✂ 끊음 ${s.interrupt}</span><span>💥 맞음 ${s.hit}</span></div>
    <div class="auto">맡겼다면 이길 몫 ${Math.round(autoWinChance(muMe, muFoe) * 100)}% (무예 ${muMe} 대 ${muFoe})</div>
    <button id="again">한 판 더</button></div>`
  ;(document.getElementById('again') as HTMLButtonElement).onclick = () => { seed = (seed + 1) >>> 0; begin() }
}

// ── 크기
let W = 0, H = 0, dpr = 1
function resize(): void {
  dpr = Math.min(2, devicePixelRatio || 1)
  W = innerWidth; H = innerHeight
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
}
addEventListener('resize', resize)
resize()

// ── 자리
const ground = (): number => H * 0.62
const sprH = (): number => Math.min(H * 0.38, W * 0.5)
const meX0 = (): number => W * 0.27
const foeX0 = (): number => W * 0.73

function drawSprite(im: HTMLImageElement, frame: number, x: number, flip: boolean, tint: string | null): void {
  if (!im.complete || im.naturalWidth === 0) return
  const cw = im.naturalWidth / 20, ch = im.naturalHeight
  const h = sprH(), w = h * (cw / ch)
  ctx.save()
  ctx.translate(x, ground())
  if (flip) ctx.scale(-1, 1)
  ctx.drawImage(im, frame * cw, 0, cw, ch, -w / 2, -h, w, h)
  if (tint !== null) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = tint; ctx.fillRect(-w / 2, -h, w, h) }
  ctx.restore()
}

const GLINT: Record<FoeMove, string> = { jab: '255,255,255', heavy: '255,74,58', feint: '255,210,74' }

function foeFrameAndX(d: Duel): { frame: number; dx: number; glint: { rgb: string; k: number } | null } {
  const ph = foePhase(d)
  const gap = foeX0() - meX0()
  if (d.over === 'win') return { frame: 19, dx: 0, glint: null }
  switch (ph.phase) {
    case 'stun': return { frame: 18, dx: gap * 0.06, glint: null }
    case 'windup': {
      const k = Math.min(1, ph.k)
      return { frame: k < 0.45 ? 12 : 13, dx: gap * 0.04 * k, glint: { rgb: GLINT[ph.kind ?? 'jab'], k } }
    }
    case 'fake': return { frame: 12, dx: gap * 0.08 * (1 - ph.k), glint: null }
    case 'strike': return { frame: 14, dx: -gap * 0.32, glint: { rgb: GLINT[ph.kind ?? 'jab'], k: 1 } }
    case 'recover': return { frame: ph.k < 0.35 ? 15 : ph.k < 0.7 ? 16 : 17, dx: -gap * 0.32 * Math.max(0, 1 - ph.k * 1.6), glint: null }
    default: return { frame: Math.floor(d.t / 10) % 4, dx: 0, glint: null }
  }
}

function meFrameAndX(d: Duel): { frame: number; dx: number; guard: boolean } {
  const R = P.duel
  const gap = foeX0() - meX0()
  const t = d.t
  if (d.over === 'lose') return { frame: 19, dx: 0, guard: false }
  if (t < d.me.stunUntil) return { frame: 18, dx: -gap * 0.05, guard: false }
  const sd = t - d.me.dodgeAt
  if (sd >= 0 && sd < R.dodgeLen) { const k = sd / R.dodgeLen; return { frame: 4 + (7 - Math.floor(k * 8) % 8), dx: -gap * 0.28 * Math.sin(k * Math.PI), guard: false } }
  const ss = t - d.me.strikeAt
  const land = R.strikeWind
  if (ss >= 0 && ss < land + R.strikeRecover) {
    if (ss < land) return { frame: ss < land * 0.5 ? 12 : 13, dx: gap * 0.1 * (ss / land), guard: false }
    const k = (ss - land) / R.strikeRecover
    return { frame: k < 0.3 ? 14 : k < 0.6 ? 15 : 16, dx: gap * 0.34 * Math.max(0, 1 - k * 1.4), guard: false }
  }
  if (t - d.me.parryAt >= 0 && t - d.me.parryAt < 12) return { frame: 12, dx: 0, guard: true }
  return { frame: Math.floor(t / 11) % 4, dx: 0, guard: false }
}

function onEvent(e: DuelEvent, now: number): void {
  const R = P.duel
  SFX[e.kind]?.()
  const mid = (meX0() + foeX0()) / 2
  const head = ground() - sprH() * 0.75
  const burst = (x: number, n: number, color: string, speed: number): void => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (i % 3) * 0.3
      const v = speed * (0.5 + ((i * 37) % 10) / 10)
      sparks.push({ x, y: head + sprH() * 0.2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, t0: now, life: 380 + (i % 5) * 60, color })
    }
  }
  if (e.dmgFoe > 0) pops.push({ x: foeX0(), y: head - 20, text: `−${e.dmgFoe}`, color: '#ffd98a', t0: now })
  if (e.dmgMe > 0) pops.push({ x: meX0(), y: head - 20, text: `−${e.dmgMe}`, color: '#ff8a7a', t0: now })
  switch (e.kind) {
    case 'perfect':
      freezeUntil = now + R.hitStopPerfect; shake = R.shake; flash = { color: '255,250,230', until: now + 180, a: 0.55 }
      burst(mid, 26, '#fff4c8', 7); break
    case 'parry': burst(mid, 10, '#ffe9a8', 4); shake = R.shake * 0.4; break
    case 'hit':
      freezeUntil = now + R.hitStopHit; shake = R.shake * 0.8; flash = { color: '200,20,10', until: now + 160, a: 0.35 }
      impactAt = { t0: now, x: meX0(), y: head + sprH() * 0.15 }; break
    case 'counter': case 'interrupt':
      freezeUntil = now + R.hitStopHit; shake = R.shake * 0.6; impactAt = { t0: now, x: foeX0(), y: head + sprH() * 0.15 }
      burst(foeX0(), 14, '#ffd98a', 5); break
    case 'clash': burst(mid, 12, '#ffffff', 5); shake = R.shake * 0.4; break
    case 'blocked': burst(mid + 10, 6, '#cfcfcf', 3); break
    case 'dodge': ghosts.push({ t0: now, x: meX0() }); break
    default: break
  }
}

// ── 그리기
function draw(now: number): void {
  const d = duel
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const sx = shake > 0 ? (((now * 7) % 13) / 13 - 0.5) * shake : 0
  const sy = shake > 0 ? (((now * 11) % 17) / 17 - 0.5) * shake : 0
  shake = Math.max(0, shake - 0.6)
  ctx.save(); ctx.translate(sx, sy)
  // 바탕
  if (bg.complete && bg.naturalWidth > 0) {
    const s = Math.max(W / bg.naturalWidth, H / bg.naturalHeight)
    ctx.drawImage(bg, (W - bg.naturalWidth * s) / 2, (H - bg.naturalHeight * s) / 2, bg.naturalWidth * s, bg.naturalHeight * s)
  } else { ctx.fillStyle = '#2a2016'; ctx.fillRect(0, 0, W, H) }
  const gr = ctx.createLinearGradient(0, 0, 0, H)
  gr.addColorStop(0, 'rgba(8,5,3,.55)'); gr.addColorStop(0.55, 'rgba(8,5,3,.15)'); gr.addColorStop(1, 'rgba(8,5,3,.85)')
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H)
  // 그림자
  for (const x of [meX0(), foeX0()]) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, ground() + 2, sprH() * 0.22, sprH() * 0.05, 0, 0, Math.PI * 2); ctx.fill() }
  // 적장
  const f = foeFrameAndX(d)
  const foeX = foeX0() + f.dx
  const foeStun = d.t < d.foe.stunUntil || d.t < d.foe.openUntil
  drawSprite(sprFoe, f.frame, foeX, true, foeStun ? 'rgba(120,200,255,.18)' : null)
  if (f.glint !== null) {
    // 낌새 — 무기 쪽(적장 앞쪽 위)에 빛이 차오른다. 타격 순간 가장 크다
    const gx = foeX - sprH() * 0.28, gy = ground() - sprH() * 0.78
    const r = sprH() * (0.06 + 0.22 * f.glint.k * f.glint.k)
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r)
    g.addColorStop(0, `rgba(${f.glint.rgb},${0.35 + 0.65 * f.glint.k})`); g.addColorStop(1, `rgba(${f.glint.rgb},0)`)
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.fill()
    if (f.glint.k > 0.92) { ctx.strokeStyle = `rgba(${f.glint.rgb},.9)`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(gx - r * 1.4, gy); ctx.lineTo(gx + r * 1.4, gy); ctx.moveTo(gx, gy - r * 1.4); ctx.lineTo(gx, gy + r * 1.4); ctx.stroke() }
    ctx.globalCompositeOperation = 'source-over'
  }
  // 우리 장수
  const m = meFrameAndX(d)
  for (const gh of ghosts) { const a = 1 - (now - gh.t0) / 300; if (a > 0) { ctx.globalAlpha = a * 0.4; drawSprite(sprMe, 0, gh.x, false, 'rgba(140,200,255,.6)'); ctx.globalAlpha = 1 } }
  drawSprite(sprMe, m.frame, meX0() + m.dx, false, d.t < d.me.stunUntil ? 'rgba(255,40,20,.25)' : null)
  if (m.guard) { ctx.strokeStyle = 'rgba(255,236,170,.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(meX0() + sprH() * 0.2, ground() - sprH() * 0.55, sprH() * 0.22, -1.1, 1.1); ctx.stroke() }
  // 맞음 그림
  if (impactAt !== null && fxImpact.complete && now - impactAt.t0 < 220) {
    const k = (now - impactAt.t0) / 220, s = sprH() * (0.4 + k * 0.5)
    ctx.globalAlpha = 1 - k; ctx.drawImage(fxImpact, impactAt.x - s / 2, impactAt.y - s / 2, s, s); ctx.globalAlpha = 1
  }
  // 불꽃
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i] as Spark; const age = now - s.t0
    if (age > s.life) { sparks.splice(i, 1); continue }
    const k = age / 16
    ctx.strokeStyle = s.color; ctx.globalAlpha = 1 - age / s.life; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(s.x + s.vx * k, s.y + s.vy * k + 0.08 * k * k); ctx.lineTo(s.x + s.vx * (k + 2.5), s.y + s.vy * (k + 2.5) + 0.08 * (k + 2.5) ** 2); ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.restore()
  if (flash !== null) { const a = flash.a * Math.max(0, (flash.until - now) / 180); ctx.fillStyle = `rgba(${flash.color},${a})`; ctx.fillRect(0, 0, W, H); if (now > flash.until) flash = null }
  // 숫자
  ctx.textAlign = 'center'
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i] as Pop; const age = now - p.t0
    if (age > 900) { pops.splice(i, 1); continue }
    const k = age / 900
    ctx.globalAlpha = 1 - k * k; ctx.fillStyle = p.color
    ctx.font = `800 ${Math.round(28 + 14 * Math.max(0, 1 - age / 120))}px "Gowun Batang", serif`
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)'
    ctx.strokeText(p.text, p.x, p.y - 40 * k); ctx.fillText(p.text, p.x, p.y - 40 * k)
  }
  ctx.globalAlpha = 1
  // 기세 막대 · 시간
  const R = P.duel
  const top = 16
  const bw = W * 0.4
  const bar = (x: number, v: number, name: string, right: boolean, col: string): void => {
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x, top + 22, bw, 14)
    const w = bw * (v / R.poise)
    ctx.fillStyle = col; ctx.fillRect(right ? x + bw - w : x, top + 22, w, 14)
    ctx.font = '700 17px "Gowun Batang", serif'; ctx.fillStyle = '#f3e3c0'; ctx.textAlign = right ? 'right' : 'left'
    ctx.fillText(name, right ? x + bw : x, top + 15)
  }
  bar(W * 0.06, d.me.poise, `${NAMES[meKey] ?? meKey} · 무예 ${muMe}`, false, '#e9c46a')
  bar(W * 0.54, d.foe.poise, `${NAMES[foeKey] ?? foeKey} · 무예 ${muFoe}`, true, '#e76f51')
  const left = Math.max(0, 1 - d.t / d.end)
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(W * 0.3, top + 44, W * 0.4, 5)
  ctx.fillStyle = left < 0.25 ? '#ff8a7a' : '#f3e3c0'; ctx.fillRect(W * 0.3, top + 44, W * 0.4 * left, 5)
  // 단추 잠김
  const locked = d.t < d.me.lockUntil
  for (const p of pads) p.classList.toggle('lock', locked)
}

// ── 돌리기 (탭이 숨으면 멈춘다 · 절대 규칙 4)
let raf = 0
function frame(now: number): void {
  raf = 0
  if (document.hidden) return
  const dt = last === 0 ? 0 : Math.min(100, now - last)
  last = now
  if (started && duel.over === null && now >= freezeUntil) {
    acc += dt
    const stepMs = 1000 / P.duel.hz
    while (acc >= stepMs && duel.over === null) {
      acc -= stepMs
      const a = queued; queued = null
      stepDuel(duel, a ?? undefined)
      while (seen < duel.events.length) onEvent(duel.events[seen++] as DuelEvent, now)
      if (now < freezeUntil) { acc = 0; break }
    }
    if (duel.over !== null) setTimeout(showEnd, 700)
  } else acc = 0
  draw(now)
  raf = requestAnimationFrame(frame)
}
function wake(): void { if (!document.hidden && raf === 0) { last = 0; raf = requestAnimationFrame(frame) } }
document.addEventListener('visibilitychange', wake)
showStart()
wake()
