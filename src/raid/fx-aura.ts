import { FX_AURA as P } from '../tune/params.ts'

/**
 * 오라 입자 (11-18 형: 「투지 오라랑 각성 오라 이펙트도 필요」) — 그리기만. 판 상태를 모른다: 발밑 자리 · 시계 · 몸 키만 받는다 (열전 장수 · 본편 어디서든).
 * 덩어리 그림 한 장을 통째로 움직이지 않는다 — 낱낱 입자: 불꽃 가닥(불꽃 그림 한 장에 빛깔을 입혀 N번 찍는다) · 불티(낱알 그림) · 발밑 고리(고리 그림).
 * 입자 자리는 시계와 번호로만 셈한다(판의 셈과 무관 · Math.random 없음 · 같은 시각이면 늘 같은 그림). 수치는 전부 FX_AURA (src/tune/params.ts).
 *  grit 「투지」: 하늘빛·흰빛 가는 가닥이 몸에서 오르고 발밑에 얇은 고리 — 차분하게 버틴다
 *  awake 「각성」: 금빛 불기둥 가닥이 몸 뒤에서 솟고 금 불티가 흩어 오르고 발밑 금 고리가 맥박친다 — 한눈에 크고 뜨겁다
 * 쓰는 법 (세 겹 · 사이에 몸을 그리면 깊이가 생긴다):
 *   drawAuraGround(땅 표식 차례) → drawAura(…, false)(몸보다 먼저) → 몸 → drawAura(…, true)(몸 다음) → drawAuraBurst(켜진 순간 한 번)
 * 그림은 있는 것을 빌린다 (AURA_ART: 본편 각성 연출의 불꽃·불티 · 열전 방울 고리) — 빛깔은 오라마다 한 번만 구워 입힌다(그릴 때마다 물들이지 않는다).
 * 폰 프레임: filter·shadowBlur 없음 · 그라디언트는 한 번 만들어 다시 쓴다 · 입자 수는 FX_AURA 의 수가 상한(줄이는 손잡이 density · setAuraDensity · 작은 화면).
 */
export type AuraKind = 'grit' | 'awake'
type Art = CanvasImageSource & { width: number; height: number }
/** 오라가 빌려 쓰는 그림 (public/realm/ 아래) — flame 불꽃 가닥 · ember 불티 낱알 · ring 발밑 고리 */
export const AURA_ART = { flame: 'fx/awaken/flame.png', ember: 'fx/awaken/ember.png', ring: 'raid/bell-ring.png' } as const
export type AuraArt = { -readonly [k in keyof typeof AURA_ART]?: Art | undefined }
export interface AuraAt {
  /** 발밑 자리 (그리는 쪽 좌표) */
  x: number; y: number
  /** 시계(초) — 열전은 판 시각. 입자 자리는 이 값과 번호로만 정해진다 */
  t: number
  /** 몸 키(px) */
  height: number
  /** 섞을 빛 (무기 묶음 색 등 · FX_AURA 의 tintEvery 가닥마다 하나) */
  tints?: readonly string[]
  /** 입자 수 몫 0~1 (붐비는 장면에서 줄인다) */
  density?: number
  /** 차오른 몫 0~1 (시전 동안 낮게 시작해 솟는다) */
  gain?: number
  /** 빌려 쓰는 그림 — 없는 것은 선·점으로 대신 그린다 */
  art?: AuraArt
  /** 그리는 판 크기 — 주면 판 밖의 오라는 건너뛴다 */
  view?: { w: number; h: number }
}
/** 그림 안에서 알맹이가 든 자리 [x, y, w, h] — flame 384×384 · ember 96×96 · ring 160×160(통째) */
const BOX = { flame: [128, 20, 122, 328], ember: [39, 30, 18, 38], ring: [0, 0, 160, 160] } as const
type Spec = (typeof P)[AuraKind]
const TAU = Math.PI * 2, GOLDEN = Math.PI * (3 - Math.sqrt(5))
/** 그리기 전용 의사난수 0~1 — 번호와 갈래로만 정해진다 (같은 번호는 늘 같은 값 · 판의 난수와 무관) */
const rnd = (i: number, salt: number) => { const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return v - Math.floor(v) }
const frac = (v: number) => v - Math.floor(v)

let userDensity = 1, screenK = 0
/** 입자 수 손잡이 0~1 — 느린 기기에서 그리는 쪽이 낮춘다 (0 이면 가닥·불티 없이 고리만) */
export function setAuraDensity(k: number) { userDensity = Math.max(0, Math.min(1, k)) }
/** 작은 화면(폰)에서는 덜 그린다 — 한 번만 잰다 (node 에는 screen 이 없다) */
function screenDensity() { return screenK ||= typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < P.small ? P.smallDensity : 1 }
/** 그릴 입자 수 — 줄여도 minCount 는 남긴다 (오라가 있다는 것은 보이게) */
export function auraCount(base: number, density = 1) {
  const k = P.density * userDensity * screenDensity() * density
  return base <= 0 || k <= 0 ? 0 : Math.max(Math.min(base, P.minCount), Math.round(base * k))
}

/** 입자 하나 — 가닥은 (x,y) 가 밑동 가운데 · 위로 h 만큼 · 불티는 (x,y) 가 가운데. a 짙기 · c 빛 번호(0 으뜸 · 1 속 · 2 짙은 · 3~ 섞는 빛) */
export interface Mote { x: number; y: number; w: number; h: number; a: number; c: number }
const mote: Mote = { x: 0, y: 0, w: 0, h: 0, a: 0, c: 0 }
const tintOf = (p: Spec, i: number, tints: number) => p.tintEvery && tints && i % p.tintEvery === p.tintEvery - 1 ? 3 + Math.floor(i / p.tintEvery) % tints : -1
/**
 * 불꽃 가닥 하나하나 (그리기와 시험이 같이 쓴다) — 발밑에서 피어나 오르며 가늘어지고 옅어진다. 가운데 가닥일수록 높이 솟아 기둥 꼴.
 * each 에 넘기는 그릇은 다시 쓰는 것 하나다 (판마다 새로 만들지 않는다). 돌려주는 값 = 가닥 수.
 */
export function auraWisps(kind: AuraKind, at: AuraAt, front: boolean, each: (m: Mote) => void) {
  const p: Spec = P[kind], H = at.height, gain = at.gain ?? 1, n = auraCount(front ? p.front : p.back, at.density), tints = at.tints?.length ?? 0
  const top = H * p.rise * (front ? p.frontRise : 1) * gain, small = front ? (1 + p.frontRise) / 2 : 1
  for (let i = 0; i < n; i++) {
    const id = front ? i + 101 : i + 1, lane = rnd(id, 1) * 2 - 1, size = (1 + (rnd(id, 2) - .5) * p.vary) * small
    const ph = frac(at.t * p.rate * (1 + (rnd(id, 3) - .5) * p.vary) + rnd(id, 4)), scale = size * (1 - p.thin * ph), tint = tintOf(p, i, tints)
    mote.x = at.x + lane * H * p.spread * (1 - p.gather * ph) + Math.sin(at.t * p.swayRate + id * 1.7) * p.sway * ph
    mote.y = at.y - ph * top * (1 - p.taper * Math.abs(lane))
    mote.w = p.w * scale; mote.h = p.h * scale
    mote.a = p.alpha * Math.min(1, gain * 1.5) * Math.min(1, ph / p.fadeIn) * (1 - ph * ph)
    mote.c = tint >= 0 ? tint : i % 3
    each(mote)
  }
  return n
}
/** 불티 하나하나 — 몸 둘레에서 반짝이며 오르고 옆으로 흩어진다 */
export function auraSparks(kind: AuraKind, at: AuraAt, each: (m: Mote) => void) {
  const p: Spec = P[kind], H = at.height, gain = at.gain ?? 1, n = auraCount(p.sparks, at.density), tints = at.tints?.length ?? 0
  for (let i = 0; i < n; i++) {
    const id = i + 201, lane = rnd(id, 1) * 2 - 1, tint = tintOf(p, i, tints)
    const ph = frac(at.t * p.sparkRate * (1 + (rnd(id, 3) - .5) * p.vary) + rnd(id, 4))
    mote.x = at.x + lane * H * (p.spread + p.drift * ph) + Math.sin(at.t * p.swayRate + id) * p.sway * .5
    mote.y = at.y - H * (p.sparkFrom + ph * (p.sparkRise - p.sparkFrom) * gain)
    mote.w = mote.h = p.spark * (1 + (rnd(id, 2) - .5) * p.vary) * (1 - .5 * ph)
    mote.a = Math.min(1, gain * 1.5) * (1 - ph) * (.55 + .45 * Math.sin(at.t * p.twinkle + id * 2.4))
    mote.c = tint >= 0 ? tint : i % 2
    each(mote)
  }
  return n
}

/**
 * 빛깔 입힌 그림 — 그림(불꽃·불티·고리)과 빛마다 한 번만 굽는다: 그림의 밝기는 그대로 두고 빛깔만 그 빛으로('color' 겹치기) · 그림의 꼴대로 다시 오려 낸다.
 * 헤드리스 시험(node)·그림이 아직 없을 때는 null (그리는 쪽이 원본 그림이나 선·점으로 대신한다)
 */
const baked: Record<keyof typeof BOX, Map<number, Map<string, CanvasImageSource>>> = { flame: new Map(), ember: new Map(), ring: new Map() }
function tinted(art: AuraArt | undefined, slot: keyof typeof BOX, color: string, height: number, lift: number) {
  // 찾기 먼저 (판마다 입자 수만큼 불린다 — 글자를 이어 붙이지 않는다): 그림 → 띄우는 몫 → 빛
  let byColor = baked[slot].get(lift); if (!byColor) baked[slot].set(lift, byColor = new Map())
  const had = byColor.get(color); if (had) return had
  const img = art?.[slot]
  if (!img || !img.width || typeof document === 'undefined') return null
  const [sx, sy, sw, sh] = BOX[slot], h = Math.max(1, Math.round(height)), w = Math.max(1, Math.round(h * sw / sh))
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d')!; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
  g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
  g.globalCompositeOperation = 'color'; g.fillStyle = color; g.fillRect(0, 0, w, h)
  if (lift) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = lift; g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.globalAlpha = 1 }
  g.globalCompositeOperation = 'destination-in'; g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
  byColor.set(color, c)
  // 굳힌 그림(ImageBitmap)으로 바꿔 쥔다 — 캔버스를 원본으로 찍으면 찍을 때마다 사본을 뜰 수 있다
  if (typeof createImageBitmap === 'function') { const m = byColor; void createImageBitmap(c).then(bm => { m.set(color, bm) }, () => {}) }
  return c
}
/** 그림 한 장을 (x,y,w,h) 에 — 구운 것이 있으면 그것, 없으면 원본의 알맹이 자리, 그림이 아예 없으면 false */
function put(ctx: CanvasRenderingContext2D, at: AuraAt, slot: keyof typeof BOX, color: string, bake: number, lift: number, x: number, y: number, w: number, h: number) {
  const b = tinted(at.art, slot, color, bake, lift)
  if (b) { ctx.drawImage(b, x, y, w, h); return true }
  const img = at.art?.[slot]; if (!img) return false
  const box = BOX[slot]; ctx.drawImage(img, box[0], box[1], box[2], box[3], x, y, w, h); return true
}
const colorOf = (p: Spec, at: AuraAt, c: number) => c < 3 ? p.colors[c]! : at.tints![c - 3]!
function drawWisps(ctx: CanvasRenderingContext2D, kind: AuraKind, at: AuraAt, front: boolean, a: number) {
  const p: Spec = P[kind]
  auraWisps(kind, at, front, m => {
    const color = colorOf(p, at, m.c)
    ctx.globalAlpha = a * m.a
    if (!put(ctx, at, 'flame', color, P.bake, p.lift, m.x - m.w / 2, m.y - m.h, m.w, m.h)) { ctx.fillStyle = color; ctx.fillRect(m.x - m.w / 6, m.y - m.h, m.w / 3, m.h) }
  })
}
function drawSparks(ctx: CanvasRenderingContext2D, kind: AuraKind, at: AuraAt, a: number) {
  const p: Spec = P[kind]
  auraSparks(kind, at, m => {
    if (m.a <= 0) return
    const color = colorOf(p, at, m.c), w = m.w * P.emberWide, h = m.h * P.emberTall
    ctx.globalAlpha = a * m.a
    if (!put(ctx, at, 'ember', color, P.emberBake, p.lift, m.x - w / 2, m.y - h / 2, w, h)) { ctx.fillStyle = color; ctx.fillRect(m.x - m.w / 2, m.y - m.h / 2, m.w, m.h) }
  })
}
/** 몸 뒤 둥근 빛 — 그라디언트는 오라마다 한 번만 만든다 (원점 기준 · 옮겨서 쓴다) */
const glows = new Map<AuraKind, CanvasGradient | null>()
function drawGlow(ctx: CanvasRenderingContext2D, kind: AuraKind, at: AuraAt, a: number) {
  const p: Spec = P[kind]; if (!p.glow) return
  let g = glows.get(kind)
  if (g === undefined) {
    g = ctx.createRadialGradient(0, 0, 4, 0, 0, p.glow) ?? null
    if (g) { g.addColorStop(0, p.colors[0] + 'a0'); g.addColorStop(.55, p.colors[2] + '40'); g.addColorStop(1, p.colors[2] + '00') }
    glows.set(kind, g)
  }
  if (!g) return
  const pulse = .8 + .2 * Math.sin(at.t * 7), sx = pulse, sy = pulse * 1.35, cx = at.x, cy = at.y - at.height * .5
  ctx.globalAlpha = a * p.glowAlpha * (at.gain ?? 1); ctx.fillStyle = g
  ctx.translate(cx, cy); ctx.scale(sx, sy); ctx.fillRect(-p.glow, -p.glow, p.glow * 2, p.glow * 2); ctx.scale(1 / sx, 1 / sy); ctx.translate(-cx, -cy)
}
/** 판 밖인가 (view 를 줬을 때만) */
function outside(at: AuraAt, reach: number) {
  const v = at.view; return !!v && (at.x < -reach || at.x > v.w + reach || at.y < -reach || at.y - at.height * 2 > v.h + reach)
}
/** 납작한 고리 하나 (반지름 r) — 고리 그림에 빛깔을 입혀 찍고, 그림이 없으면 선으로 */
function ring(ctx: CanvasRenderingContext2D, at: AuraAt, color: string, r: number, width: number) {
  const d = r * P.ringArt
  if (put(ctx, at, 'ring', color, BOX.ring[3], 0, at.x - d, at.y - d * P.flat, d * 2, d * 2 * P.flat)) return
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.ellipse(at.x, at.y, r, r * P.flat, 0, 0, TAU); ctx.stroke()
}
/**
 * 발밑 고리 — 땅 표식이라 모든 몸보다 먼저 그린다 (적의 붉은 표식이 있으면 그 아래에).
 * 늘 있는 고리 하나 · 맥박마다 번지며 옅어지는 고리 · (각성) 거꾸로 도는 끊긴 고리.
 */
export function drawAuraGround(ctx: CanvasRenderingContext2D, kind: AuraKind, at: AuraAt) {
  const p: Spec = P[kind]; if (outside(at, p.ring * 2)) return
  const a = ctx.globalAlpha, f = P.flat, R = p.ring, k = a * p.ringAlpha * (at.gain ?? 1), ph = frac(at.t * p.beat)
  ctx.globalAlpha = k; ring(ctx, at, p.colors[0], R, p.ringWidth)
  ctx.globalAlpha = k * (1 - ph); ring(ctx, at, p.colors[0], R * (1 + p.beatGrow * ph), p.ringWidth)
  if (p.arcs) {
    const r2 = R * p.arcR
    ctx.strokeStyle = p.colors[1]; ctx.lineWidth = p.arcWidth; ctx.globalAlpha = k * .7; ctx.beginPath()
    for (let i = 0; i < p.arcs; i++) { const a0 = -at.t * p.spin + i * TAU / p.arcs; ctx.moveTo(at.x + Math.cos(a0) * r2, at.y + Math.sin(a0) * r2 * f); ctx.ellipse(at.x, at.y, r2, r2 * f, 0, a0, a0 + TAU / p.arcs * .55) }
    ctx.stroke()
  }
  ctx.globalAlpha = a
}
/**
 * 오라 한 겹 — front=false 는 몸보다 먼저(몸 뒤 빛 · 뒤 가닥), true 는 몸 다음(앞 가닥 · 불티).
 * 그리는 쪽의 globalAlpha·겹치기·그림 다듬기는 그대로 돌려놓는다.
 */
export function drawAura(ctx: CanvasRenderingContext2D, kind: AuraKind, front: boolean, at: AuraAt) {
  const p: Spec = P[kind]; if (outside(at, at.height)) return
  const op = ctx.globalCompositeOperation, a = ctx.globalAlpha, smooth = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = true
  if (!front) { ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, kind, at, a) }
  ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over'
  drawWisps(ctx, kind, at, front, a)
  if (front) drawSparks(ctx, kind, at, a)
  ctx.globalCompositeOperation = op; ctx.globalAlpha = a; ctx.imageSmoothingEnabled = smooth
}
/**
 * 켜지는 순간 한 번 (age = 켜진 뒤 흐른 초 · burst.life 가 지나면 아무것도 안 그린다) —
 * 발밑에서 번지는 고리 · 땅을 따라 흩어지며 뜨는 불티 · (각성) 발밑에서 솟구치는 가닥. 빠르게 나가 느려지며 옅어진다.
 */
export function drawAuraBurst(ctx: CanvasRenderingContext2D, kind: AuraKind, at: AuraAt, age: number) {
  const p: Spec = P[kind], b = p.burst
  if (age < 0 || age >= b.life || outside(at, b.radius)) return
  const k = age / b.life, out = 1 - (1 - k) ** 3, fade = 1 - k, f = P.flat, H = at.height
  const op = ctx.globalCompositeOperation, a = ctx.globalAlpha, smooth = ctx.imageSmoothingEnabled
  ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over'; ctx.imageSmoothingEnabled = true
  for (let j = 0; j < b.rings; j++) {
    ctx.globalAlpha = a * fade
    ring(ctx, at, p.colors[j % 2]!, b.radius * out * (1 - .7 * j / b.rings), 1 + b.width * fade * (1 - .5 * j / b.rings))
  }
  for (let i = 0, n = auraCount(b.sparks, at.density); i < n; i++) {
    const id = i + 301, ang = i * GOLDEN, d = b.radius * out * (.35 + .65 * rnd(id, 1)), size = (1 + p.spark * 1.6 * fade) * P.emberTall, color = p.colors[i % 2]!
    const x = at.x + Math.cos(ang) * d, y = at.y + Math.sin(ang) * d * f - b.lift * out * (.3 + .7 * rnd(id, 2))
    ctx.globalAlpha = a * fade
    if (!put(ctx, at, 'ember', color, P.emberBake, p.lift, x - size * .25, y - size / 2, size * .5, size)) { ctx.fillStyle = color; ctx.fillRect(x - size / 4, y - size / 4, size / 2, size / 2) }
  }
  for (let i = 0, n = auraCount(b.pillars, at.density); i < n; i++) {
    const id = i + 401, lane = rnd(id, 1) * 2 - 1, top = H * b.pillarRise * out * (1 - p.taper * Math.abs(lane)), w = p.w * (1 + .5 * rnd(id, 2)), color = p.colors[i % 3]!, x = at.x + lane * H * p.spread
    ctx.globalAlpha = a * fade * p.alpha
    if (!put(ctx, at, 'flame', color, P.bake, p.lift, x - w / 2, at.y - top, w, top)) { ctx.fillStyle = color; ctx.fillRect(x - w / 6, at.y - top, w / 3, top) }
  }
  ctx.globalCompositeOperation = op; ctx.globalAlpha = a; ctx.imageSmoothingEnabled = smooth
}
