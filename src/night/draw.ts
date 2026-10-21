/**
 * 밤의 암살판 — 그리기 (docs/realm/SNIPE.md §0-1 "어둠과 빛")
 *
 * 판을 **읽기만** 한다 (절대 규칙 2). 순서:
 *   하늘·능선 → 뒤 배경(담·집) → 땅·지붕 → 형체(검은 몸) → 꽂힌 살
 *   → **어둠**(화면 전체를 덮고 불마다 둥글게 도려낸다) → 불빛 → 형체의 빛 받은 가장자리 → 창호지·그림자
 *   → 자객(활터 궁수) → 나는 살 → 글자판(HUD)
 * 사람은 그림 파일이 아니라 도형이다 — 머리 원 · 몸통 · 다리 (형: "타겟 에셋 인물마다 만들지 말고").
 */
import { TAU, clamp, clamp01, damp, lerp, valueNoise } from '../core/math.ts'
import { P } from '../tune/params.ts'
import { drawArcher } from '../render/stickman.ts'
import { THEME, worldToScreenX, worldToScreenY, type Camera } from '../render/camera.ts'
import { createFx, drawFx, type Fx } from '../render/effects.ts'
import { drawArrowArt } from '../render/foeart.ts'
import type { World } from '../sim/types.ts'
import { effectiveStats } from '../sim/bow.ts'
import type { Pull } from './input.ts'
import { GUARD_NAME, type Decor, type Figure, type Light } from './layout.ts'
import {
  BOW_NAME, chiefCandle, chiefRise, fallOf, flicker, lightAt, lightRadius, moveProgress, newParts, partsOf, tendProgress, walking, type Night, type Parts,
} from './sim.ts'

/** 보이는 땅의 범위 (m) — 지붕 끝부터 판의 끝까지 */
const VIEW = { x0: -3, x1: 32, top: 6.2 }

const COL = {
  sky0: '#04060b',
  sky1: '#111a2a',
  moon: '#e9e4cf',
  ridge: '#0b1019',
  ridgeNear: '#080b11',
  wall: '#141920',
  wallTop: '#1d242d',
  roofTile: '#10141b',
  tileLine: '#2a3340',
  ground: '#0a0d12',
  body: '#06080b',
  rim: '#ffb35c',
  rimCool: '#6d8096',
  paper: '#f0dfb2',
  paperDark: '#2b261c',
  lattice: '#3a2a1a',
  shadow: '#24170d',
  flame: '#ffcf6a',
  flameCore: '#fff3c2',
  arrow: '#e3e9f0',
  hud: '#ccd6e0',
  hudDim: '#95a1ae',
  alarm: '#e0503a',
  good: '#8fd07a',
} as const

const parts: Parts = newParts()

/** 자객의 몸 — 지금은 활터 궁수 그대로. 그림을 받으면 setAssassinBody 로 바꿔 끼운다 */
export type BodyDrawer = (ctx: CanvasRenderingContext2D, cam: Camera, w: World) => void
let assassinBody: BodyDrawer = (ctx, cam, w) => drawArcher(ctx, cam, w, 1)

/**
 * 자객 몸 그림 자리 (SNIPE §0-1 — "여자 자객 궁사").
 * 그림 조건: 옆모습 **오른쪽(+x)을 본다** · 팔 없는 몸 · 발바닥이 그림 아래 끝 · 키 약 1.7m 로 맞춘다
 * (cam.scale px/m 로 늘이면 된다 — 발은 worldToScreen(w.archer.x, 0)). 팔·활·시위는 활터처럼 절차로 위에 그린다.
 */
export function setAssassinBody(fn: BodyDrawer): void {
  assassinBody = fn
}

export interface NightView {
  readonly cam: Camera
  /** 어둠을 따로 그려 두는 판 — 크기가 바뀔 때만 다시 만든다 */
  dark: HTMLCanvasElement | null
  /** 화면 위 글자 하나 (보초의 ?!, 경보 등) — 벽시계로 사라진다 */
  pops: Array<{ text: string; x: number; y: number; born: number; color: string }>
  /** 경보 번쩍임 — 벽시계 ms */
  flashAt: number
  /**
   * 활터의 명중 반응 그대로 (render/effects.ts) — 불꽃 · 파열 링 · '헤드샷!' · 히트스톱 · 남는 궤적(빗나간 살은 더 오래).
   * 밤 판은 형체를 맞히면 활터와 같은 'hit' 사건을 낸다 (night/sim.ts). 돌림(night-main)이 pumpEvents·updateFx 를 부른다
   */
  fx: Fx
  /** 화면 흔들림 — 활터 카메라와 같은 규칙 (render/camera.ts updateCamera: 진폭 P.hit.shakeAmp · 감쇠 · 컷오프) */
  shakeAmp: number
  shakeAge: number
}

export function createView(cam: Camera): NightView {
  return { cam, dark: null, pops: [], flashAt: -1e9, fx: createFx(), shakeAmp: 0, shakeAge: 0 }
}

/** 활터 카메라의 흔들림 배수 (render/camera.ts VIEW.foeShakeMul · headShakeMul · shakeFreq — 거기는 밖으로 안 낸다) */
const SHAKE = { foe: 1.5, head: 2, freq: 34 } as const

/** 흔들림을 실시간으로 깎는다 — 컷오프에서 강제로 끊는다 (다음 조준을 방해하지 않게, 활터와 같다) */
export function shakeView(v: NightView, dtReal: number): void {
  const cam = v.cam
  if (v.shakeAmp <= 0) {
    cam.shakeX = 0
    cam.shakeY = 0
    return
  }
  v.shakeAge += dtReal
  if (v.shakeAge >= P.hit.shakeCutoff) {
    v.shakeAmp = 0
    cam.shakeX = 0
    cam.shakeY = 0
    return
  }
  v.shakeAmp = damp(v.shakeAmp, 0, P.hit.shakeDecay, dtReal)
  const ph = v.shakeAge * SHAKE.freq * TAU
  cam.shakeX = Math.sin(ph) * v.shakeAmp
  cam.shakeY = Math.sin(ph * 1.37 + 1.1) * v.shakeAmp
}

/** 화면 크기에 맞춰 판 전체가 들어오게 */
export function frameCamera(cam: Camera, n: Night): void {
  const g = n.scene.ground
  const spanX = VIEW.x1 - VIEW.x0
  const spanY = VIEW.top - (g - 0.8)
  const top = 52
  const bottom = 56
  const s = Math.min((cam.w * 0.98) / spanX, Math.max(1, cam.h - top - bottom) / spanY)
  cam.scale = s
  cam.x = (VIEW.x0 + VIEW.x1) / 2
  // 땅(g − 0.8)이 아래 띠 위에 붙게
  const groundPx = cam.h - bottom
  cam.y = (g - 0.8) + (groundPx - cam.h * 0.5) / s
}

const X = (cam: Camera, x: number): number => worldToScreenX(cam, x)
const Y = (cam: Camera, y: number): number => worldToScreenY(cam, y)

// ───────────────────────── 하늘·배경 ─────────────────────────

function drawSky(ctx: CanvasRenderingContext2D, cam: Camera, seed: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, cam.h)
  grad.addColorStop(0, COL.sky0)
  grad.addColorStop(1, COL.sky1)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, cam.w, cam.h)
  // 별 — 시드로 정해진 자리
  ctx.fillStyle = '#cfd8e8'
  for (let i = 0; i < 70; i++) {
    const sx = ((valueNoise(i * 3.17, seed) + 1) / 2) * cam.w
    const sy = ((valueNoise(i * 5.31, seed ^ 0x55) + 1) / 2) * cam.h * 0.5
    ctx.globalAlpha = 0.25 + 0.5 * ((valueNoise(i * 1.7, 9) + 1) / 2)
    ctx.fillRect(sx, sy, 1.4, 1.4)
  }
  ctx.globalAlpha = 1
  // 달
  const mx = cam.w * 0.82
  const my = cam.h * 0.14
  const mr = Math.max(14, cam.h * 0.045)
  const halo = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 5)
  halo.addColorStop(0, 'rgba(233,228,207,0.28)')
  halo.addColorStop(1, 'rgba(233,228,207,0)')
  ctx.fillStyle = halo
  ctx.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10)
  ctx.fillStyle = COL.moon
  ctx.beginPath()
  ctx.arc(mx, my, mr, 0, Math.PI * 2)
  ctx.fill()
  // 능선 둘
  for (const [col, base, amp, f, sd] of [[COL.ridge, 0.42, 0.12, 0.004, 3], [COL.ridgeNear, 0.52, 0.08, 0.007, 11]] as const) {
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.moveTo(0, cam.h)
    for (let x = 0; x <= cam.w; x += 12) ctx.lineTo(x, cam.h * (base - amp * (valueNoise(x * f, sd) + 1) / 2))
    ctx.lineTo(cam.w, cam.h)
    ctx.fill()
  }
}

/** 기와 지붕 한 채 — 처마가 살짝 들린 사다리꼴 */
function roof(ctx: CanvasRenderingContext2D, cam: Camera, x0: number, x1: number, yBase: number, h: number): void {
  const lift = 0.25
  ctx.fillStyle = COL.roofTile
  ctx.beginPath()
  ctx.moveTo(X(cam, x0 - 0.4), Y(cam, yBase + lift))
  ctx.quadraticCurveTo(X(cam, x0 + 0.6), Y(cam, yBase), X(cam, x0 + 1.2), Y(cam, yBase + h * 0.85))
  ctx.lineTo(X(cam, x1 - 1.2), Y(cam, yBase + h * 0.85))
  ctx.quadraticCurveTo(X(cam, x1 - 0.6), Y(cam, yBase), X(cam, x1 + 0.4), Y(cam, yBase + lift))
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = COL.tileLine
  ctx.lineWidth = 1
  for (let x = x0 + 0.5; x < x1; x += 0.45) {
    ctx.beginPath()
    ctx.moveTo(X(cam, x), Y(cam, yBase + 0.12))
    ctx.lineTo(X(cam, x + 0.05), Y(cam, yBase + h * 0.8))
    ctx.stroke()
  }
}

function drawDecor(ctx: CanvasRenderingContext2D, cam: Camera, d: Decor, g: number): void {
  const x0 = d.x
  const x1 = d.x + d.w
  const s = cam.scale
  switch (d.kind) {
    case 'compound':
      ctx.fillStyle = COL.wall
      ctx.fillRect(X(cam, x0), Y(cam, g + d.h), d.w * s, d.h * s)
      ctx.fillStyle = COL.wallTop
      ctx.fillRect(X(cam, x0), Y(cam, g + d.h + 0.25), d.w * s, 0.25 * s)
      break
    case 'gate':
      ctx.fillStyle = '#0c1016'
      ctx.fillRect(X(cam, x0 + 0.4), Y(cam, g + 3), (d.w - 0.8) * s, 3 * s)
      roof(ctx, cam, x0, x1, g + 3, 0.6)
      break
    case 'hall':
      ctx.fillStyle = COL.wall
      ctx.fillRect(X(cam, x0 + 1), Y(cam, g + d.h - 1.4), (d.w - 2) * s, (d.h - 1.4) * s)
      roof(ctx, cam, x0, x1, g + d.h - 1.4, 1.4)
      break
    case 'granary':
      ctx.fillStyle = '#121720'
      ctx.fillRect(X(cam, x0 + 0.6), Y(cam, g + 2.6), (d.w - 1.2) * s, 2 * s)
      roof(ctx, cam, x0, x1, g + 2.6, 0.8)
      break
    case 'sarangchae':
      ctx.fillStyle = '#121720'
      ctx.fillRect(X(cam, x0 + 0.5), Y(cam, g + 3.3), (d.w - 1) * s, 2.7 * s)
      ctx.fillStyle = '#1a1510'
      ctx.fillRect(X(cam, x0 + 0.5), Y(cam, g + 0.6), (d.w - 1) * s, 0.6 * s) // 마루
      roof(ctx, cam, x0, x1, g + 3.3, 1)
      break
    case 'well':
      ctx.fillStyle = '#1a1f27'
      ctx.fillRect(X(cam, x0), Y(cam, g + d.h), d.w * s, d.h * s)
      break
    case 'cart':
      ctx.fillStyle = '#16120d'
      ctx.fillRect(X(cam, x0), Y(cam, g + d.h), d.w * s, (d.h - 0.35) * s)
      ctx.beginPath()
      ctx.arc(X(cam, x0 + 0.4), Y(cam, g + 0.35), 0.35 * s, 0, Math.PI * 2)
      ctx.arc(X(cam, x1 - 0.4), Y(cam, g + 0.35), 0.35 * s, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'stand':
      ctx.fillStyle = '#1b1610'
      ctx.fillRect(X(cam, x0 - 0.05), Y(cam, g + d.h), 0.1 * s, d.h * s)
      break
  }
}

function drawGroundAndRoof(ctx: CanvasRenderingContext2D, cam: Camera, g: number): void {
  // 마당
  ctx.fillStyle = COL.ground
  ctx.fillRect(0, Y(cam, g), cam.w, cam.h - Y(cam, g))
  // 자객이 엎드린 지붕 — 처마 끝은 x 2 (sim stageDef 의 땅 꺾은선과 같은 자리)
  const top = Y(cam, 0)
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, top + 0.6 * cam.scale, X(cam, 1.6), Y(cam, g) - top)
  ctx.fillStyle = COL.roofTile
  ctx.beginPath()
  ctx.moveTo(0, top)
  ctx.lineTo(X(cam, 2), top)
  ctx.quadraticCurveTo(X(cam, 2.4), top + 0.1 * cam.scale, X(cam, 2.5), top - 0.25 * cam.scale)
  ctx.lineTo(X(cam, 2.3), top + 0.6 * cam.scale)
  ctx.lineTo(0, top + 0.6 * cam.scale)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = COL.tileLine
  ctx.lineWidth = 1
  for (let x = VIEW.x0; x < 2.2; x += 0.42) {
    ctx.beginPath()
    ctx.moveTo(X(cam, x), top)
    ctx.lineTo(X(cam, x - 0.1), top + 0.55 * cam.scale)
    ctx.stroke()
  }
}

// ───────────────────────── 형체 ─────────────────────────

/** 형체 하나 — 몸은 검게. `rim` 이 0 보다 크면 빛 받은 쪽 가장자리를 밝게 */
/** 빛 받은 테의 두께 (화면 px) — 검은 몸을 빛 반대쪽으로 이만큼 밀어 덮으면 빛 쪽에만 테가 남는다 */
const RIM_EDGE_PX = 1.6

/** 이 사람에게 빛이 오는 쪽 (+1 오른쪽 · −1 왼쪽) — 가장 가까운 켜진 불. 제가 든 등불이면 얼굴 쪽 */
function lightSide(sc: Night['scene'], f: Figure): number {
  let best: { d: number; s: number } | null = null
  for (const l of sc.lights) {
    if (!l.lit) continue
    const s = l.carrier === f.id ? f.facing : Math.sign(l.x - f.x) || 1
    const d = l.carrier === f.id ? 0 : Math.abs(l.x - f.x)
    if (best === null || d < best.d) best = { d, s }
  }
  return best?.s ?? 1
}

function figurePath(ctx: CanvasRenderingContext2D, cam: Camera, n: Night, f: Figure, rise: number, mode: 'fill' | 'rim', rim: number, rimCol: string): void {
  partsOf(f, parts, f.role === 'chief' ? rise : undefined)
  const s = cam.scale
  const fall = fallOf(n, f)
  ctx.save()
  if (fall > 0) {
    // 발을 축으로 눕는다 — 자객에게서 먼 쪽으로
    const fx = X(cam, f.x)
    const fy = Y(cam, f.y)
    ctx.translate(fx, fy)
    ctx.rotate((Math.PI / 2) * fall * (f.hitZone === 'leg' ? 0.9 : 1))
    ctx.translate(-fx, -fy)
  }
  const stroke = (w: number): void => {
    ctx.lineWidth = w
    ctx.stroke()
  }
  ctx.lineCap = 'round'
  if (mode === 'fill') {
    ctx.strokeStyle = COL.body
    ctx.fillStyle = COL.body
  } else {
    ctx.strokeStyle = rimCol
    ctx.fillStyle = rimCol
    ctx.globalAlpha = rim
  }
  const extra = mode === 'rim' ? 2.2 : 0
  // 걷는 다리 — 순찰은 걸음마다 다리를 벌린다 (틱 기반)
  const swing = walking(f) ? Math.sin((n.tick / P.sim.hz) * 7 + f.id) * 0.22 : 0
  const hip = { x: parts.l1x, y: parts.l1y }
  for (const k of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(X(cam, hip.x), Y(cam, hip.y))
    ctx.lineTo(X(cam, parts.l0x + swing * k), Y(cam, parts.l0y))
    stroke(parts.lr * 1.4 * s + extra)
  }
  // 몸통
  ctx.beginPath()
  ctx.moveTo(X(cam, parts.t0x), Y(cam, parts.t0y))
  ctx.lineTo(X(cam, parts.t1x), Y(cam, parts.t1y))
  stroke(parts.tr * 2 * s + extra)
  // 팔 — 창이나 등불을 든 쪽은 앞으로
  const shY = parts.t1y + parts.tr * 0.5
  ctx.beginPath()
  ctx.moveTo(X(cam, f.x), Y(cam, shY))
  ctx.lineTo(X(cam, f.x + 0.28 * f.facing * f.size), Y(cam, shY - 0.42 * f.size))
  stroke(0.09 * s + extra)
  // 머리 + 상투
  ctx.beginPath()
  ctx.arc(X(cam, parts.hx), Y(cam, parts.hy), parts.hr * s + extra / 2, 0, Math.PI * 2)
  if (mode === 'fill') ctx.fill()
  else stroke(1.6)
  if (mode === 'fill') {
    ctx.beginPath()
    ctx.arc(X(cam, parts.hx - 0.05 * f.facing), Y(cam, parts.hy + parts.hr * 0.95), parts.hr * 0.42 * s, 0, Math.PI * 2)
    ctx.fill()
  }
  // 창
  if (f.holds === 'spear') {
    const hx = f.x + 0.3 * f.facing * f.size
    ctx.beginPath()
    ctx.moveTo(X(cam, hx), Y(cam, f.y + 0.1))
    ctx.lineTo(X(cam, hx + 0.05 * f.facing), Y(cam, f.y + 2.25 * f.size))
    stroke(0.045 * s + (mode === 'rim' ? 1 : 0))
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

function drawFlame(ctx: CanvasRenderingContext2D, cam: Camera, l: Light, tick: number): void {
  if (l.kind === 'candle') return
  const s = cam.scale
  if (!l.lit) {
    // 꺼진 모닥불 — 불씨만 붉게 남는다 (다시 살릴 수 있다는 표시)
    if (l.kind !== 'fire') return
    ctx.fillStyle = `rgba(200,60,30,${0.45 + 0.25 * flicker(l, tick)})`
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      ctx.arc(X(cam, l.x + i * 0.12), Y(cam, l.y - 0.18 + Math.abs(i) * 0.02), 0.045 * s, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }
  const f = flicker(l, tick)
  // 모닥불은 살이 꽂힐수록 사그라든다
  const dim = l.kind === 'fire' ? 1 - (0.6 * l.hits) / Math.max(1, P.night.fireHits) : 1
  const size = (l.kind === 'fire' ? 0.55 * dim : l.kind === 'torch' ? 0.28 : 0.16) * f
  const x = X(cam, l.x)
  const y = Y(cam, l.y)
  if (l.kind === 'lantern') {
    ctx.fillStyle = '#c98a3a'
    ctx.fillRect(x - 0.09 * s, y - 0.12 * s, 0.18 * s, 0.24 * s)
  }
  ctx.fillStyle = COL.flame
  ctx.beginPath()
  ctx.moveTo(x - size * 0.45 * s, y)
  ctx.quadraticCurveTo(x, y - size * 2.1 * s, x + size * 0.45 * s, y)
  ctx.quadraticCurveTo(x, y + size * 0.5 * s, x - size * 0.45 * s, y)
  ctx.fill()
  ctx.fillStyle = COL.flameCore
  ctx.beginPath()
  ctx.arc(x, y - size * 0.2 * s, size * 0.22 * s, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * 불 붙이는 보초 머리 위 게이지 (형: "모션을 정확히 만들지 않더라도 불 붙이는 중 하면서 게이지바가 나오면") —
 * 붙이러 가는 길엔 글자만, 붙이는 중엔 게이지. 다 차면 불이 돌아온다
 */
function drawTend(ctx: CanvasRenderingContext2D, cam: Camera, n: Night): void {
  const s = cam.scale
  for (const f of n.scene.figures) {
    const p = tendProgress(n, f)
    if (p < 0) continue
    const cx = X(cam, f.x)
    const top = Y(cam, f.y + 2.05 * f.size)
    const bw = Math.max(72, 1.5 * s)
    const bh = Math.max(8, 0.14 * s)
    ctx.font = `700 ${Math.max(11, Math.round(0.24 * s))}px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = '#ffe2a8'
    const going = f.task?.step === 'go'
    ctx.fillText(going ? '불 붙이러 간다' : '불 붙이는 중', cx, top - bh - 3)
    if (!going) {
      ctx.fillStyle = '#3a3f48'
      ctx.fillRect(cx - bw / 2, top - bh, bw, bh)
      ctx.fillStyle = '#ffb35c'
      ctx.fillRect(cx - bw / 2, top - bh, bw * p, bh)
      ctx.strokeStyle = '#ffe2a8'
      ctx.lineWidth = 1
      ctx.strokeRect(cx - bw / 2 + 0.5, top - bh + 0.5, bw - 1, bh - 1)
    }
    ctx.textBaseline = 'middle'
  }
}

function drawStuck(ctx: CanvasRenderingContext2D, cam: Camera, n: Night): void {
  ctx.strokeStyle = '#8e8676'
  ctx.lineWidth = Math.max(1, cam.scale * 0.025)
  for (const st of n.stuck) {
    let x = st.x
    let y = st.y
    let ang = st.angle
    if (st.fig >= 0) {
      const f = n.scene.figures[st.fig]
      if (f === undefined) continue
      // 몸에 꽂힌 살은 몸과 같이 눕는다 (발을 축으로)
      const rot = -(Math.PI / 2) * fallOf(n, f) * (f.hitZone === 'leg' ? 0.9 : 1)
      const c = Math.cos(rot)
      const sn = Math.sin(rot)
      x = f.x + st.x * c - st.y * sn
      y = f.y + st.x * sn + st.y * c
      ang += rot
    }
    const bx = x - Math.cos(ang) * 0.55
    const by = y - Math.sin(ang) * 0.55
    ctx.beginPath()
    ctx.moveTo(X(cam, x), Y(cam, y))
    ctx.lineTo(X(cam, bx), Y(cam, by))
    ctx.stroke()
  }
}

function drawFlying(ctx: CanvasRenderingContext2D, cam: Camera, w: World): void {
  ctx.lineCap = 'round'
  for (const a of w.arrows) {
    if (!a.alive || a.outcome !== 'flying') continue
    const bx = a.x - Math.cos(a.angle) * 0.75
    const by = a.y - Math.sin(a.angle) * 0.75
    ctx.strokeStyle = 'rgba(227,233,240,0.25)'
    ctx.lineWidth = Math.max(1, cam.scale * 0.02)
    ctx.beginPath()
    ctx.moveTo(X(cam, a.px - (a.x - a.px) * 3), Y(cam, a.py - (a.y - a.py) * 3))
    ctx.lineTo(X(cam, bx), Y(cam, by))
    ctx.stroke()
    // 날아가는 살도 활터의 그림 화살 (형: "암살부분은 왜 이전 신궁 UI랑 에셋 이런거 거의 안가져온거임?") — 그림이 아직 안 왔으면 선
    if (drawArrowArt(ctx, 'basic', X(cam, bx), Y(cam, by), X(cam, a.x), Y(cam, a.y))) continue
    ctx.strokeStyle = COL.arrow
    ctx.lineWidth = Math.max(1.4, cam.scale * 0.03)
    ctx.beginPath()
    ctx.moveTo(X(cam, a.x), Y(cam, a.y))
    ctx.lineTo(X(cam, bx), Y(cam, by))
    ctx.stroke()
  }
}

// ───────────────────────── 어둠 ─────────────────────────

function drawDarkness(ctx: CanvasRenderingContext2D, v: NightView, n: Night): void {
  const cam = v.cam
  const bw = Math.round(cam.w * cam.dpr)
  const bh = Math.round(cam.h * cam.dpr)
  if (v.dark === null) v.dark = document.createElement('canvas')
  const d = v.dark
  if (d.width !== bw) d.width = bw
  if (d.height !== bh) d.height = bh
  const dc = d.getContext('2d')
  if (dc === null) return
  dc.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0)
  dc.globalCompositeOperation = 'source-over'
  dc.clearRect(0, 0, cam.w, cam.h)
  dc.fillStyle = 'rgba(3,5,10,0.88)'
  dc.fillRect(0, 0, cam.w, cam.h)
  // 지붕 위 자객 곁은 달빛 — 조금만 밝게 (자기 손은 보여야 한다)
  dc.globalCompositeOperation = 'destination-out'
  const moon = dc.createRadialGradient(X(cam, 0), Y(cam, 1), 0, X(cam, 0), Y(cam, 1), 3.2 * cam.scale)
  moon.addColorStop(0, 'rgba(0,0,0,0.75)')
  moon.addColorStop(1, 'rgba(0,0,0,0)')
  dc.fillStyle = moon
  dc.fillRect(0, 0, cam.w, cam.h)
  for (const l of n.scene.lights) {
    if (!l.lit) continue
    const r = lightRadius(l) * cam.scale
    const x = X(cam, l.x)
    const y = Y(cam, l.y)
    const f = flicker(l, n.tick)
    const gr = dc.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, `rgba(0,0,0,${0.95 * f})`)
    gr.addColorStop(0.55, `rgba(0,0,0,${0.55 * f})`)
    gr.addColorStop(1, 'rgba(0,0,0,0)')
    dc.fillStyle = gr
    dc.beginPath()
    dc.arc(x, y, r, 0, Math.PI * 2)
    dc.fill()
  }
  ctx.drawImage(d, 0, 0, cam.w, cam.h)
  // 불빛의 따뜻한 색 — 더하기로 얹는다
  ctx.globalCompositeOperation = 'lighter'
  for (const l of n.scene.lights) {
    if (!l.lit || l.kind === 'candle') continue
    const r = lightRadius(l) * cam.scale * 0.7
    const x = X(cam, l.x)
    const y = Y(cam, l.y)
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, `rgba(255,140,50,${0.22 * flicker(l, n.tick)})`)
    gr.addColorStop(1, 'rgba(255,140,50,0)')
    ctx.fillStyle = gr
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'
}

function drawDoor(ctx: CanvasRenderingContext2D, cam: Camera, n: Night): void {
  const d = n.scene.door
  if (d === null) return
  const candle = n.scene.lights.find((l) => l.kind === 'candle')
  const lit = candle?.lit === true
  const s = cam.scale
  const x = X(cam, d.x0)
  const y = Y(cam, d.y1)
  const w = (d.x1 - d.x0) * s
  const h = (d.y1 - d.y0) * s
  if (lit) {
    const glow = ctx.createRadialGradient(x + w / 2, y + h * 0.6, 0, x + w / 2, y + h * 0.6, Math.max(w, h))
    glow.addColorStop(0, '#f6e7bd')
    glow.addColorStop(1, '#b89a5e')
    ctx.fillStyle = glow
  } else ctx.fillStyle = COL.paperDark
  ctx.fillRect(x, y, w, h)
  // 적장의 그림자 — 창호지에 비친 검은 형체
  const chief = n.scene.figures.find((f) => f.role === 'chief')
  const rise = chiefRise(n)
  if (lit && chief !== undefined && (rise > 0 || n.phase === 'rise' || n.phase === 'chief' || chief.downAt >= 0)) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.clip()
    ctx.globalAlpha = 0.85
    figurePath(ctx, cam, n, chief, Math.max(rise, chief.downAt >= 0 ? 1 : 0), 'fill', 0, COL.shadow)
    ctx.restore()
  } else if (lit && chief !== undefined && chief.alive) {
    // 아직 앉아 있다 — 낮은 그림자만 어렴풋이
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.clip()
    ctx.globalAlpha = 0.45
    figurePath(ctx, cam, n, chief, 0, 'fill', 0, COL.shadow)
    ctx.restore()
  }
  // 촛불 게이지 — 그림자가 서면 닳는다. 다 닳으면 촛불을 끄고 달아난다 (형: "어떻게잡으라는겨")
  const cl = chiefCandle(n)
  if (cl >= 0) {
    const gy = y - 0.45 * s
    const gh = Math.max(8, 0.16 * s)
    ctx.fillStyle = '#3a3f48'
    ctx.fillRect(x, gy, w, gh)
    ctx.fillStyle = cl > 0.5 ? '#ffd27a' : cl > 0.25 ? '#ff9a4a' : COL.alarm
    ctx.fillRect(x, gy, w * cl, gh)
    ctx.strokeStyle = '#ffe2a8'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, gy + 0.5, w - 1, gh - 1)
    ctx.font = `700 ${Math.max(11, Math.round(0.26 * s))}px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = '#ffe2a8'
    ctx.fillText(n.phase === 'rise' ? '그림자가 일어선다 — 창호지 너머를 쏴라' : '촛불 — 다 닳으면 달아난다', x + w / 2, gy - 0.06 * s)
    ctx.textBaseline = 'middle'
  }
  // 문살
  ctx.strokeStyle = COL.lattice
  ctx.lineWidth = Math.max(1, s * 0.035)
  ctx.strokeRect(x, y, w, h)
  for (let i = 1; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(x + (w * i) / 4, y)
    ctx.lineTo(x + (w * i) / 4, y + h)
    ctx.stroke()
  }
  for (let i = 1; i < 6; i++) {
    ctx.beginPath()
    ctx.moveTo(x, y + (h * i) / 6)
    ctx.lineTo(x + w, y + (h * i) / 6)
    ctx.stroke()
  }
}

// ───────────────────────── 글자판 ─────────────────────────

function drawHud(ctx: CanvasRenderingContext2D, v: NightView, n: Night, now: number): void {
  const cam = v.cam
  const w = n.w
  const a = w.archer
  ctx.font = '600 15px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  ctx.textBaseline = 'middle'
  // 판 — 연습장이면 판 이름만
  ctx.fillStyle = COL.hud
  ctx.textAlign = 'left'
  const head = n.practice !== null ? `연습장 · ${n.scene.title}` : `${n.stage + 1} / 3 · ${n.scene.title}`
  ctx.fillText(head, 14, 22)
  // 경비 — 머리줄 바로 옆 (밑은 "그만" 단추 자리)
  const hw = ctx.measureText(head).width
  ctx.font = '700 12px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  ctx.fillStyle = n.guard === 2 ? '#ff9a7a' : n.guard === 0 ? '#9fd08a' : COL.hudDim
  ctx.fillText(`경비 ${GUARD_NAME[n.guard]}`, 14 + hw + 10, 22)
  ctx.font = '600 15px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  // 든 활 — 단계가 오르면 이름이 바뀐다 (형: "계단적 성장"). 왼쪽 아래는 "그만" 단추 자리라 오른쪽 화살 밑에
  ctx.fillStyle = n.bowTier > 0 ? '#ffd27a' : COL.hudDim
  ctx.font = '700 13px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`활 · ${BOW_NAME[n.bowTier] ?? BOW_NAME[0]}`, cam.w - 14, 98)
  ctx.textAlign = 'left'
  ctx.font = '600 15px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  ctx.fillStyle = COL.hud
  // 남은 화살 — 활터 HUD 처럼 큰 숫자 + 그림 화살 눈금 (형: "화살 발수도 제대로 안보이는데"). 마지막 한 발은 붉다
  ctx.textAlign = 'right'
  const inf = n.practice?.infinite === true
  const low = !inf && w.arrowsLeft <= 1
  ctx.font = '800 30px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  ctx.fillStyle = low ? COL.alarm : '#f3e6c8'
  ctx.fillText(inf ? '∞' : String(w.arrowsLeft), cam.w - 38, 26)
  ctx.font = '700 14px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  ctx.fillStyle = COL.hudDim
  ctx.fillText('발', cam.w - 14, 32)
  if (!inf) {
    const glyph = 36
    for (let i = 0; i < Math.min(w.arrowsLeft, 12); i++) {
      const cx = cam.w - 22 - i * 13
      ctx.shadowColor = low ? COL.alarm : '#e8d6a8'
      ctx.shadowBlur = 6
      if (!drawArrowArt(ctx, 'basic', cx, 62 + glyph / 2, cx, 62 - glyph / 2, 2)) {
        ctx.fillStyle = low ? COL.alarm : '#e8d6a8'
        ctx.fillRect(cx - 1, 62 - glyph / 2, 2, glyph)
      }
      ctx.shadowBlur = 0
    }
  }
  ctx.font = '600 15px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  ctx.fillStyle = COL.hud
  // 발각 게이지 — 가운데 위
  if (n.practice?.alarm !== false) {
    const gw = Math.min(220, cam.w * 0.34)
    const gx = cam.w / 2 - gw / 2
    ctx.fillStyle = 'rgba(20,24,30,0.8)'
    ctx.fillRect(gx, 14, gw, 14)
    const al = clamp01(n.alarm)
    ctx.fillStyle = al > 0.66 ? COL.alarm : al > 0.33 ? '#d0902f' : '#6b7a8a'
    ctx.fillRect(gx, 14, gw * al, 14)
    ctx.strokeStyle = '#4a5363'
    ctx.strokeRect(gx + 0.5, 14.5, gw - 1, 13)
    ctx.textAlign = 'center'
    ctx.fillStyle = COL.hudDim
    ctx.font = '600 12px system-ui, sans-serif'
    ctx.fillText('발각', cam.w / 2, 40)
  }
  // 스태미나와 빨간 바 (GDD 2장 — 바 위에서 만작으로 놓으면 오차 0)
  const bw = 150
  const bx = 14
  const by = cam.h - 30
  const max = a.staminaMax > 0 ? a.staminaMax : 1
  ctx.fillStyle = 'rgba(20,24,30,0.8)'
  ctx.fillRect(bx, by, bw, 10)
  const above = a.stamina >= max * P.stamina.steadyZone
  ctx.fillStyle = above ? '#6cc7b8' : '#ff8a5a'
  ctx.fillRect(bx, by, bw * clamp01(a.stamina / max), 10)
  ctx.fillStyle = '#ff3b2f'
  ctx.fillRect(bx + bw * P.stamina.steadyZone - 1, by - 4, 2.5, 18)
  ctx.textAlign = 'left'
  ctx.fillStyle = COL.hudDim
  ctx.font = '600 12px system-ui, sans-serif'
  ctx.fillText('숨', bx + bw + 8, by + 5)
  // 떠 있는 글자
  ctx.textAlign = 'center'
  ctx.font = '800 18px system-ui, sans-serif'
  v.pops = v.pops.filter((p) => now - p.born < 1400)
  for (const p of v.pops) {
    const age = (now - p.born) / 1400
    ctx.globalAlpha = 1 - age
    ctx.fillStyle = p.color
    ctx.fillText(p.text, X(cam, p.x), Y(cam, p.y) - age * 18)
  }
  ctx.globalAlpha = 1
  // 경보 번쩍
  const fl = (now - v.flashAt) / 600
  if (fl >= 0 && fl < 1) {
    ctx.fillStyle = `rgba(200,40,30,${0.35 * (1 - fl)})`
    ctx.fillRect(0, 0, cam.w, cam.h)
  }
}

/** 판의 사건을 화면 글자로 — 그리기 쪽에서만 (판은 안 건드린다) */
export function pumpView(v: NightView, n: Night, from: number, now: number): void {
  for (let i = from; i < n.events.length; i++) {
    const e = n.events[i]
    if (e === undefined) continue
    switch (e.t) {
      // 다음 지붕 — 지난 판의 박힌 살·남은 궤적을 거둔다
      case 'stage': v.fx = createFx(); break
      case 'notice': v.pops.push({ text: '?!', x: e.x, y: e.y, born: now, color: '#ffcf6a' }); break
      case 'drum': v.flashAt = now; v.pops.push({ text: '경보!', x: 15, y: n.scene.ground + 3.5, born: now, color: COL.alarm }); break
      // 머리 · 몸 · 다리 — 글자('헤드샷!')와 불꽃은 활터 effects 가 낸다. 여기서는 흔들림만
      case 'head': case 'body': case 'leg': v.shakeAmp = P.hit.shakeAmp * (e.t === 'head' ? SHAKE.head : SHAKE.foe); v.shakeAge = 0; break
      case 'chief': v.shakeAmp = P.hit.shakeAmp * SHAKE.head; v.shakeAge = 0; v.pops.push({ text: '명중', x: e.x, y: e.y + 0.5, born: now, color: COL.good }); break
      case 'flee': v.pops.push({ text: '촛불이 꺼졌다', x: 24.5, y: n.scene.ground + 3.2, born: now, color: COL.hud }); break
      case 'startle': v.pops.push({ text: '촛불이 흔들린다', x: 24.5, y: n.scene.ground + 3.6, born: now, color: '#ff9a4a' }); break
      case 'tend': v.pops.push({ text: '불이 꺼졌네?', x: e.x, y: e.y, born: now, color: '#e8d6a8' }); break
      default: break
    }
  }
}

/**
 * 당겨 쏘기의 손잡이 (night/input.ts) — 누른 자리의 고리 · 끝까지의 테 · 끈 줄 · 손가락.
 * 고리 안이면 회색으로 "그만" — 놓으면 쏘지 않는다. 끝까지 끌면 테가 금빛으로 찬다.
 */
function drawPull(ctx: CanvasRenderingContext2D, p: Pull): void {
  if (!p.active) return
  const dead = P.night.pullDead
  const max = p.max
  ctx.save()
  ctx.lineCap = 'round'
  // 끝까지의 테 — 옅게, 끈 몫만큼 금빛 호
  ctx.strokeStyle = 'rgba(233,226,212,0.18)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(p.ax, p.ay, max, 0, Math.PI * 2)
  ctx.stroke()
  if (!p.inDead && p.frac > 0) {
    ctx.strokeStyle = p.frac >= 1 ? '#ffd27a' : 'rgba(255,210,122,0.75)'
    ctx.lineWidth = p.frac >= 1 ? 5 : 3
    ctx.beginPath()
    ctx.arc(p.ax, p.ay, max, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.frac)
    ctx.stroke()
  }
  // 고리 — 그만두는 자리
  ctx.setLineDash([5, 5])
  ctx.strokeStyle = p.inDead ? '#c8c0b0' : 'rgba(200,192,176,0.45)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(p.ax, p.ay, dead, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  // 끈 줄과 손가락
  ctx.strokeStyle = p.inDead ? 'rgba(200,192,176,0.5)' : '#e9c98a'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(p.ax, p.ay)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
  ctx.fillStyle = p.inDead ? '#8f887b' : '#ffd27a'
  ctx.beginPath()
  ctx.arc(p.x, p.y, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = '700 13px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#e9e2d4'
  ctx.fillText(p.inDead ? '그만' : p.frac >= 1 ? '끝까지' : '', p.ax, p.ay - dead - 12)
  ctx.restore()
}

/**
 * 호흡정지 사선의 아랫도리 — 활터와 같은 규칙 (render/stickman.ts "호흡정지 사선"):
 * **숨을 참아야만** 화살이 갈 길이 점선으로 스며 나온다 (steadyBlend). 숨을 안 참으면 아무것도 안 보인다.
 * 활터의 점선은 땅(y 0)에서 끊기는데, 밤 판의 궁수는 지붕(y 0) 위에 서고 표적은 그 아래 마당에 있다 —
 * 그래서 지붕 높이까지는 활터 궁수 그림(drawArcher)이 그리고, 여기서는 **같은 적분을 이어** 지붕 아래부터 마당까지만 찍는다.
 * 각·속도·바람·점 간격·길이(P.steady.previewTime)·색·투명도가 활터와 한 글자도 다르지 않아야 한다.
 */
function drawPreview(ctx: CanvasRenderingContext2D, cam: Camera, w: World, ground: number): void {
  const a = w.archer
  if (a.steadyBlend <= 0.02 || (a.phase !== 'drawing' && a.phase !== 'full')) return
  const spd = lerp(P.bow.minSpeed, P.bow.maxSpeed, Math.pow(clamp(a.draw, 0, 1), P.bow.drawCurve))
    * effectiveStats(w.stats).speedMul * w.fx.speedMul * w.bow.speedMul
  const ang = a.aimAngle + a.tremorOffset
  let vx = Math.cos(ang) * spd
  let vy = Math.sin(ang) * spd
  let x = a.x
  let y = a.y
  const dtp = 1 / 60
  const steps = Math.floor(P.steady.previewTime / dtp)
  ctx.fillStyle = THEME.target2
  ctx.globalAlpha = 0.5 * a.steadyBlend
  let distSinceDot = P.steady.previewDotGap
  for (let i = 1; i <= steps; i++) {
    const rvx = vx - w.wind * w.bow.windMul
    const kd = P.arrow.drag * w.fx.dragMul * Math.hypot(rvx, vy)
    vx -= kd * rvx * dtp
    vy -= kd * vy * dtp
    vy -= P.arrow.gravity * dtp
    const stepDist = Math.hypot(vx, vy) * dtp
    x += vx * dtp
    y += vy * dtp
    if (y <= ground) break
    distSinceDot += stepDist
    if (distSinceDot >= P.steady.previewDotGap) {
      distSinceDot -= P.steady.previewDotGap
      if (y > 0) continue // 지붕 위는 활터 궁수 그림이 이미 찍었다
      ctx.beginPath()
      ctx.arc(X(cam, x), Y(cam, y), 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

export function drawNight(ctx: CanvasRenderingContext2D, v: NightView, n: Night, now: number, pull?: Pull): void {
  const cam = v.cam
  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0)
  frameCamera(cam, n)
  const sc = n.scene
  const g = sc.ground
  drawSky(ctx, cam, n.seed)
  for (const d of sc.decor) drawDecor(ctx, cam, d, g)
  drawGroundAndRoof(ctx, cam, g)
  const rise = chiefRise(n)
  for (const f of sc.figures) if (f.role !== 'chief') figurePath(ctx, cam, n, f, 1, 'fill', 0, COL.body)
  drawStuck(ctx, cam, n)

  drawDarkness(ctx, v, n)

  // 빛 받은 가장자리 — 밝은 곳의 형체만 또렷 (어둠 속은 흐릿한 윤곽).
  // 테만 남긴다: 주황으로 몸 전체를 칠한 뒤 검은 몸을 빛 반대쪽으로 한 뼘 밀어 다시 덮는다 — 빛 쪽 가장자리만 탄다
  // (전에는 테가 몸을 통째로 덮어 "주황 마네킹"으로 보였다 — ART-QUEUE 8)
  for (const f of sc.figures) {
    if (f.role === 'chief') continue
    const lit = lightAt(sc, f.x, f.y + 1, n.tick)
    if (lit > 0.05) {
      figurePath(ctx, cam, n, f, 1, 'rim', Math.min(0.95, lit * 1.4), COL.rim)
      ctx.save()
      ctx.translate(-lightSide(sc, f) * RIM_EDGE_PX, RIM_EDGE_PX * 0.4)
      figurePath(ctx, cam, n, f, 1, 'fill', 0, COL.body)
      ctx.restore()
    } else figurePath(ctx, cam, n, f, 1, 'rim', 0.13, COL.rimCool)
  }
  for (const l of sc.lights) drawFlame(ctx, cam, l, n.tick)
  drawTend(ctx, cam, n)
  drawDoor(ctx, cam, n)
  void rise

  assassinBody(ctx, cam, n.w)
  drawPreview(ctx, cam, n.w, g)
  drawFlying(ctx, cam, n.w)
  drawFx(ctx, cam, v.fx)

  // 지붕을 타고 넘어가는 중 — 어둡게 덮였다 걷힌다
  const mv = moveProgress(n)
  if (mv > 0) {
    ctx.fillStyle = `rgba(0,0,0,${Math.sin(mv * Math.PI)})`
    ctx.fillRect(0, 0, cam.w, cam.h)
  }
  drawHud(ctx, v, n, now)
  if (pull !== undefined) drawPull(ctx, pull)
}
