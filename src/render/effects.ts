/**
 * 명중 반응 레이어 (GDD 7장) — 파티클, 히트스톱, 남는 궤적, 작은 콤보 표시.
 *
 * 전부 고정 크기 버퍼다. push/splice/map 없음, 프레임당 힙 할당 0 (ARCHITECTURE A5).
 * World는 읽기만 하고, events는 읽되 비우지 않는다 (비우는 건 게임 루프).
 */
import { clamp01 } from '../core/math.ts'
import { makeRng } from '../core/rng.ts'
import type { Rng } from '../core/rng.ts'
import { P, SPEC } from '../tune/params.ts'
import { TRAIL_POINTS } from '../sim/types.ts'
import type { World } from '../sim/types.ts'
import { THEME, worldToScreenX, worldToScreenY } from './camera.ts'
import type { Camera } from './camera.ts'

/** 링버퍼 용량은 런타임에 못 늘린다. 노브의 상한만큼 미리 잡고, 실사용 상한은 P를 따른다. */
const PARTICLE_CAP = SPEC.chain.maxParticles.max
/** 궤적 유령 슬롯 — 한 판 화살이 5~8발이라 8이면 겹치지 않는다 (GDD 6장) */
const GHOSTS = 8

const KIND_HIT = 0
const KIND_CHAIN = 1
const KIND_MISS = 2

/** 연출 상수 (개수·px·감쇠). 손맛 시간값은 전부 P에서 읽는다. */
const FX = {
  hitBurst: 16,
  chainBurst: 10,
  missBurst: 7,
  speed: 5.5,
  missSpeed: 2.2,
  speedVar: 0.55,
  ttl: 0.5,
  missTtl: 0.32,
  ttlVar: 0.45,
  sizePx: 2.4,
  dragRate: 2.2,
  /** 히트스톱 누적 상한 (ms). 대형 연쇄에서 화면이 멎으면 손맛이 아니라 렉이다. */
  stopCapMs: 130,
  comboTtl: 0.9,
  comboMinShow: 2,
  trailWidthPx: 1.6,
  seed: 0x5eed,
} as const

export interface Fx {
  readonly cap: number
  head: number
  /** 파티클 SoA — 월드 좌표(m)라 카메라가 움직여도 붙어 있는다 */
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
  life: Float32Array
  ttl: Float32Array
  kind: Uint8Array
  /** 유령 궤적: 화살이 사라진 뒤에도 남는 선 */
  gHead: number
  gPts: Float32Array
  gLen: Int32Array
  gLife: Float32Array
  gTtl: Float32Array
  gMiss: Uint8Array
  /** 남은 히트스톱 (s) */
  hitStop: number
  comboLife: number
  comboX: number
  comboY: number
  comboText: string
  comboVal: number
  lastTick: number
  rng: Rng
}

/** drawFx(ctx, cam) 2인자 호출을 지원하기 위한 현재 인스턴스. 게임에 Fx는 하나뿐이다. */
let active: Fx | null = null

export function createFx(): Fx {
  const f: Fx = {
    cap: PARTICLE_CAP,
    head: 0,
    x: new Float32Array(PARTICLE_CAP),
    y: new Float32Array(PARTICLE_CAP),
    vx: new Float32Array(PARTICLE_CAP),
    vy: new Float32Array(PARTICLE_CAP),
    life: new Float32Array(PARTICLE_CAP),
    ttl: new Float32Array(PARTICLE_CAP),
    kind: new Uint8Array(PARTICLE_CAP),
    gHead: 0,
    gPts: new Float32Array(GHOSTS * TRAIL_POINTS * 2),
    gLen: new Int32Array(GHOSTS),
    gLife: new Float32Array(GHOSTS),
    gTtl: new Float32Array(GHOSTS),
    gMiss: new Uint8Array(GHOSTS),
    hitStop: 0,
    comboLife: 0,
    comboX: 0,
    comboY: 0,
    comboText: '',
    comboVal: 0,
    lastTick: -1,
    // 렌더 전용 난수. sim 스트림과 분리돼 있어 결정론에 영향이 없다.
    rng: makeRng(FX.seed),
  }
  active = f
  return f
}

function spawn(f: Fx, x: number, y: number, n: number, kind: number, speed: number, ttl: number): void {
  const live = P.chain.maxParticles < f.cap ? P.chain.maxParticles : f.cap
  for (let i = 0; i < n; i++) {
    const idx = f.head
    f.head = f.head + 1 >= live ? 0 : f.head + 1
    const ang = f.rng.next() * Math.PI * 2
    const sp = speed * (1 - FX.speedVar + f.rng.next() * FX.speedVar * 2)
    f.x[idx] = x
    f.y[idx] = y
    f.vx[idx] = Math.cos(ang) * sp
    f.vy[idx] = Math.sin(ang) * sp
    const t = ttl * (1 - FX.ttlVar + f.rng.next() * FX.ttlVar * 2)
    f.ttl[idx] = t
    f.life[idx] = t
    f.kind[idx] = kind
  }
}

/** 화살이 죽은 뒤에도 궤적을 남기려면 링버퍼를 복사해 둬야 한다. 화살 풀은 곧 재사용된다. */
function captureTrail(f: Fx, w: World, x: number, y: number, miss: boolean): void {
  let best = -1
  let bestD = Infinity
  const want = miss ? 'miss' : 'hit'
  for (let i = 0; i < w.arrows.length; i++) {
    const ar = w.arrows[i]
    if (ar === undefined || ar.outcome !== want) continue
    const dx = ar.x - x
    const dy = ar.y - y
    const d = dx * dx + dy * dy
    if (d < bestD) { bestD = d; best = i }
  }
  if (best < 0) return
  const ar = w.arrows[best]
  if (ar === undefined) return

  const slot = f.gHead
  f.gHead = f.gHead + 1 >= GHOSTS ? 0 : f.gHead + 1
  const n = ar.trailLen < TRAIL_POINTS ? ar.trailLen : TRAIL_POINTS
  const base = slot * TRAIL_POINTS * 2
  // 링버퍼를 오래된 → 최신 순서로 펴서 복사한다.
  for (let j = 0; j < n; j++) {
    const src = ((ar.trailHead - n + j) % TRAIL_POINTS + TRAIL_POINTS) % TRAIL_POINTS
    f.gPts[base + j * 2] = ar.trail[src * 2] ?? 0
    f.gPts[base + j * 2 + 1] = ar.trail[src * 2 + 1] ?? 0
  }
  f.gLen[slot] = n
  // ★ 빗나간 궤적이 더 오래 남아야 왜 빗나갔는지 읽고 배운다 (GDD 8장)
  const ttl = miss ? P.hit.missTrailFade : P.hit.trailFade
  f.gTtl[slot] = ttl
  f.gLife[slot] = ttl
  f.gMiss[slot] = miss ? 1 : 0
}

export function pumpEvents(fx: Fx, w: World): void {
  // 같은 tick을 두 번 그리면 이벤트가 이중 처리된다. events를 비우는 건 게임 루프의 몫이라
  // 여기서는 tick으로만 가드한다.
  if (w.tick === fx.lastTick) return
  fx.lastTick = w.tick

  const ev = w.events
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i]
    if (e === undefined) continue
    if (e.t === 'hit') {
      spawn(fx, e.x, e.y, FX.hitBurst, KIND_HIT, FX.speed, FX.ttl)
      captureTrail(fx, w, e.x, e.y, false)
      fx.hitStop += P.hit.stopMs * 0.001
      if (e.combo >= FX.comboMinShow) {
        // 콤보 문자열은 값이 바뀔 때만 만든다 (A5)
        if (e.combo !== fx.comboVal) {
          fx.comboVal = e.combo
          fx.comboText = `${e.combo}연쇄`
        }
        fx.comboX = e.x
        fx.comboY = e.y
        fx.comboLife = FX.comboTtl
      }
    } else if (e.t === 'chain') {
      spawn(fx, e.x, e.y, FX.chainBurst, KIND_CHAIN, FX.speed, FX.ttl)
      fx.hitStop += P.hit.chainStopMs * 0.001
    } else if (e.t === 'miss') {
      spawn(fx, e.x, e.y, FX.missBurst, KIND_MISS, FX.missSpeed, FX.missTtl)
      captureTrail(fx, w, e.x, e.y, true)
    }
  }

  const cap = FX.stopCapMs * 0.001
  if (fx.hitStop > cap) fx.hitStop = cap
}

export function updateFx(fx: Fx, dtReal: number): void {
  if (fx.hitStop > 0) {
    fx.hitStop -= dtReal
    if (fx.hitStop < 0) fx.hitStop = 0
  }
  if (fx.comboLife > 0) fx.comboLife -= dtReal

  const g = P.arrow.gravity
  const drag = 1 - FX.dragRate * dtReal
  const k = drag > 0 ? drag : 0
  for (let i = 0; i < fx.cap; i++) {
    const l = fx.life[i] ?? 0
    if (l <= 0) continue
    const nl = l - dtReal
    fx.life[i] = nl > 0 ? nl : 0
    if (nl <= 0) continue
    const vx = (fx.vx[i] ?? 0) * k
    const vy = (fx.vy[i] ?? 0) * k - g * dtReal
    fx.vx[i] = vx
    fx.vy[i] = vy
    fx.x[i] = (fx.x[i] ?? 0) + vx * dtReal
    fx.y[i] = (fx.y[i] ?? 0) + vy * dtReal
  }

  for (let s = 0; s < GHOSTS; s++) {
    const l = fx.gLife[s] ?? 0
    if (l <= 0) continue
    const nl = l - dtReal
    fx.gLife[s] = nl > 0 ? nl : 0
    if (nl <= 0) fx.gLen[s] = 0
  }
}

/** 현재 남은 히트스톱 (ms). 게임 루프가 이만큼 sim 스텝을 미룬다. */
export function hitStopMs(fx: Fx): number {
  return fx.hitStop * 1000
}

export function drawFx(ctx: CanvasRenderingContext2D, cam: Camera, fx?: Fx): void {
  const f = fx ?? active
  if (f === null) return

  // ── 유령 궤적 ────────────────────────────────────────────────
  ctx.lineWidth = FX.trailWidthPx
  ctx.lineCap = 'round'
  for (let s = 0; s < GHOSTS; s++) {
    const n = f.gLen[s] ?? 0
    const life = f.gLife[s] ?? 0
    if (n < 2 || life <= 0) continue
    const ttl = f.gTtl[s] ?? 1
    const miss = (f.gMiss[s] ?? 0) === 1
    ctx.globalAlpha = clamp01(life / ttl) * (miss ? 0.55 : 0.75)
    ctx.strokeStyle = miss ? THEME.trailMiss : THEME.trailHit
    const base = s * TRAIL_POINTS * 2
    ctx.beginPath()
    for (let j = 0; j < n; j++) {
      const sx = worldToScreenX(cam, f.gPts[base + j * 2] ?? 0)
      const sy = worldToScreenY(cam, f.gPts[base + j * 2 + 1] ?? 0)
      if (j === 0) ctx.moveTo(sx, sy)
      else ctx.lineTo(sx, sy)
    }
    ctx.stroke()
  }

  // ── 파티클 ───────────────────────────────────────────────────
  const px = FX.sizePx
  for (let i = 0; i < f.cap; i++) {
    const l = f.life[i] ?? 0
    if (l <= 0) continue
    const t = clamp01(l / (f.ttl[i] ?? 1))
    const kind = f.kind[i] ?? KIND_HIT
    ctx.globalAlpha = t
    ctx.fillStyle = kind === KIND_MISS ? THEME.trailMiss : kind === KIND_CHAIN ? THEME.target2 : THEME.accent
    const sz = px * (0.4 + t * 0.6)
    ctx.fillRect(
      worldToScreenX(cam, f.x[i] ?? 0) - sz * 0.5,
      worldToScreenY(cam, f.y[i] ?? 0) - sz * 0.5,
      sz, sz,
    )
  }

  // ── 콤보 (GDD 7장 절제 원칙: 작게) ────────────────────────────
  if (f.comboLife > 0 && f.comboText !== '') {
    ctx.globalAlpha = clamp01(f.comboLife / FX.comboTtl)
    ctx.fillStyle = THEME.accent
    ctx.font = '600 13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const rise = (1 - clamp01(f.comboLife / FX.comboTtl)) * 14
    ctx.fillText(f.comboText, worldToScreenX(cam, f.comboX), worldToScreenY(cam, f.comboY) - 12 - rise)
  }

  ctx.globalAlpha = 1
}
