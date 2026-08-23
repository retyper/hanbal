/**
 * 명중 반응 레이어 (GDD 7장 · HOOK ★6) — 파티클, 히트스톱, 남는 궤적, 스쿼시&스트레치,
 * 크리티컬 강조, 연쇄 비네트, 콤보 배수, 점수 팝.
 *
 * 규칙은 하나도 안 바뀐다. 피드백만 쌓는다 ("Juice It or Lose It", GDC 2012).
 *
 * ★ 절제 규율 (GDD 7장 · 9장). 새로 붙인 것 전부 아래를 지킨다:
 *   - **조준을 가리는 것은 없다.** 비네트는 화면 가장자리 22%에만 얹히고, 궁수가 시위를
 *     잡는 순간(phase drawing/full) 0.25초 안에 강제로 꺼진다 — 카메라 흔들림의
 *     shakeCutoff와 같은 규율이다.
 *   - 파열 링·스쿼시는 **맞은 과녁 자신의 반경 안팎**에서만 산다. 0.3초면 끝난다.
 *   - 숫자는 popups.ts가 상한을 걸어 관리한다.
 *
 * 전부 고정 크기 버퍼다. push/splice/map 없음, 프레임당 힙 할당 0 (ARCHITECTURE A5).
 * World는 읽기만 하고, events는 읽되 비우지 않는다 (비우는 건 게임 루프).
 */
import { clamp01, damp } from '../core/math.ts'
import { makeRng } from '../core/rng.ts'
import type { Rng } from '../core/rng.ts'
import { P, SPEC } from '../tune/params.ts'
import { TRAIL_POINTS } from '../sim/types.ts'
import type { World } from '../sim/types.ts'
import { THEME, worldToScreenX, worldToScreenY } from './camera.ts'
import type { Camera } from './camera.ts'
import { createPopups, drawPopups, pushPopup, updatePopups } from './popups.ts'
import type { Popups } from './popups.ts'

/** 링버퍼 용량은 런타임에 못 늘린다. 노브의 상한만큼 미리 잡고, 실사용 상한은 P를 따른다. */
const PARTICLE_CAP = SPEC.chain.maxParticles.max
/** 궤적 유령 슬롯 — 한 판 화살이 5~8발이라 8이면 겹치지 않는다 (GDD 6장) */
const GHOSTS = 8
/** 파열 링 슬롯. 한 번의 연쇄가 한꺼번에 8개를 터뜨려도 겹치지 않는다. */
const RINGS = 12
/** 스쿼시 기록 슬롯. scene.ts가 살아남은 과녁(낙하 중 aerial · pierceable)을 눌러 그린다. */
const SQUASH = 12

const KIND_HIT = 0
const KIND_CHAIN = 1
const KIND_MISS = 2
const KIND_CRIT = 3

/** 연출 상수 (개수·px·감쇠). 손맛 시간값은 전부 P에서 읽는다. */
const FX = {
  hitBurst: 16,
  chainBurst: 10,
  missBurst: 7,
  critBurst: 22,
  speed: 5.5,
  missSpeed: 2.2,
  critSpeed: 8.5,
  speedVar: 0.55,
  ttl: 0.5,
  missTtl: 0.32,
  critTtl: 0.72,
  ttlVar: 0.45,
  sizePx: 2.4,
  dragRate: 2.2,
  /**
   * 히트스톱 누적 상한 (ms). 대형 연쇄에서 화면이 멎으면 손맛이 아니라 렉이다.
   * 130 -> 160: 크리티컬 배수(critStopMul)가 붙으면 한 발만으로 88ms라, 130이면
   * 그 뒤에 오는 연쇄가 통째로 잘려 "정중앙이 더 묵직하다"가 사라진다.
   */
  stopCapMs: 160,
  comboTtl: 0.9,
  comboMinShow: 2,
  trailWidthPx: 1.6,
  seed: 0x5eed,

  // ── 크리티컬 (HOOK ★6-3) ──────────────────────────────────────────
  /** 정중앙 문턱은 여기 없다 — 실제 판정은 P.hit.bullseyeAcc 하나를 본다 (A2). */
  /** 정중앙의 히트스톱 배수 */
  critStopMul: 2.1,
  /**
   * 짧은 슬로모 (s)와 그동안의 시간 배수.
   *
   * 왜 sim이 아니라 이펙트 시간축인가: 루프는 **손을 뗀 동안에만** 히트스톱을 건다
   * (loop.ts, 시위가 얼어붙으면 놓은 프레임에 화살이 안 나가므로). 그래서 다음 발을
   * 당기는 중에 터진 정중앙은 sim이 전혀 안 멈춘다 — 그 순간의 "시간이 휘었다"를
   * 만들 수 있는 곳은 이 레이어뿐이다. 조준·시위는 계속 실시간으로 돈다 (입력 지연 0).
   */
  critSlowSec: 0.2,
  critSlowScale: 0.45,
  /** 정중앙에서 자동으로 띄우는 위업 문구 */
  critFeat: '정중앙',

  // ── 스쿼시 & 스트레치 (HOOK ★6-2) ─────────────────────────────────
  /** 눌림이 끝나고 부풀기 시작하는 지점 (수명 비율) */
  squashT: 0.34,
  /** 가로로 퍼지는 양 / 세로로 눌리는 양 */
  squashX: 0.34,
  squashY: 0.26,
  /** 눌린 뒤 한 번 부푸는 양 ("터진다") */
  squashOver: 0.16,
  /** 살아남은 과녁의 눌림 수명 (s) */
  squashTtl: 0.22,
  /** 파열 링 수명 (s) — 즉사한 과녁의 스쿼시를 대신 그린다 */
  ringTtl: 0.3,
  ringCritTtl: 0.42,
  /** 링이 마지막에 퍼지는 배수 */
  ringGrow: 1.15,
  ringW: 2,

  // ── 연쇄 고조 (HOOK ★6-4) ────────────────────────────────────────
  /** 이 연쇄 깊이에서 비네트가 최대 */
  glowDepthFull: 6,
  /** 비네트 최대 불투명도. 이 이상은 배경을 먹는다. */
  glowAlpha: 0.16,
  /** 투명한 중심의 반경 비율 — 화면 안쪽 78%는 손대지 않는다 */
  glowInner: 0.78,
  glowOuter: 1.02,
  /** 평상시 감쇠 / 시위를 잡은 순간의 감쇠 (/s) */
  glowDecay: 2.4,
  glowAimDecay: 12,
  /** 연쇄가 멎고 이만큼 지나면 무조건 끈다 (s). shakeCutoff와 같은 규율. */
  glowCutoff: 1.1,
  /** 콤보 1당 파티클 크기 증가 / 그 상한 */
  chainSizeStep: 0.09,
  chainSizeCap: 8,

  // ── 점수 팝 (HOOK ★6-1) ──────────────────────────────────────────
  /** 이 점수에서 팝이 최대 크기·밝기가 된다. 기본 과녁 100점, 링 배수 최대 2배. */
  scoreRef: 420,
} as const
// TODO(params): hit.critStopMul · hit.critSlowSec · hit.critSlowScale
// TODO(params): hit.squashTtl · hit.ringTtl · chain.glowAlpha · chain.glowCutoff

/** 비네트 색 = 강조색(#ffb347). 알파는 globalAlpha로 준다. */
const GLOW_RGB0 = 'rgba(255,179,71,0)'
const GLOW_RGB1 = 'rgba(255,179,71,1)'

/** 연쇄 팝의 짧은 정수 문자열. 매 연쇄마다 문자열을 만들지 않는다 (A5). */
const NUM: string[] = []
for (let i = 0; i <= 64; i++) NUM.push(String(i))

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
  /** 크기 배수 — 연쇄가 깊을수록 커진다 */
  sz: Float32Array
  /** 유령 궤적: 화살이 사라진 뒤에도 남는 선 */
  gHead: number
  gPts: Float32Array
  gLen: Int32Array
  gLife: Float32Array
  gTtl: Float32Array
  gMiss: Uint8Array
  /** 파열 링 — 즉사한 과녁의 스쿼시&스트레치 */
  rHead: number
  rX: Float32Array
  rY: Float32Array
  rR: Float32Array
  rLife: Float32Array
  rTtl: Float32Array
  rCrit: Uint8Array
  /** 살아남은 과녁의 눌림 기록. scene.ts가 targetSquash()로 읽어간다. */
  sHead: number
  sId: Int32Array
  sLife: Float32Array
  /** 남은 히트스톱 (s) */
  hitStop: number
  /** 남은 슬로모 (실시간 s) */
  slow: number
  /** 연쇄 비네트 0..1 과 그 나이 (s) */
  glow: number
  glowAge: number
  /** 궁수가 지금 시위를 잡고 있는가. 비네트를 강제로 끄는 조건이다. */
  aiming: boolean
  comboLife: number
  comboX: number
  comboY: number
  comboText: string
  comboVal: number
  /** sim의 w.combo를 렌더 쪽에서 그대로 따라 센다 (chain 이벤트에는 combo가 없다) */
  comboRun: number
  /** 마지막 명중 지점 — 위업 문구를 띄울 자리 */
  lastX: number
  lastY: number
  pop: Popups
  vig: CanvasGradient | null
  vigW: number
  vigH: number
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
    sz: new Float32Array(PARTICLE_CAP),
    gHead: 0,
    gPts: new Float32Array(GHOSTS * TRAIL_POINTS * 2),
    gLen: new Int32Array(GHOSTS),
    gLife: new Float32Array(GHOSTS),
    gTtl: new Float32Array(GHOSTS),
    gMiss: new Uint8Array(GHOSTS),
    rHead: 0,
    rX: new Float32Array(RINGS),
    rY: new Float32Array(RINGS),
    rR: new Float32Array(RINGS),
    rLife: new Float32Array(RINGS),
    rTtl: new Float32Array(RINGS),
    rCrit: new Uint8Array(RINGS),
    sHead: 0,
    sId: new Int32Array(SQUASH).fill(-1),
    sLife: new Float32Array(SQUASH),
    hitStop: 0,
    slow: 0,
    glow: 0,
    glowAge: 0,
    aiming: false,
    comboLife: 0,
    comboX: 0,
    comboY: 0,
    comboText: '',
    comboVal: 0,
    comboRun: 0,
    lastX: 0,
    lastY: 0,
    pop: createPopups(),
    vig: null,
    vigW: -1,
    vigH: -1,
    lastTick: -1,
    // 렌더 전용 난수. sim 스트림과 분리돼 있어 결정론에 영향이 없다.
    rng: makeRng(FX.seed),
  }
  active = f
  return f
}

function spawn(
  f: Fx, x: number, y: number, n: number, kind: number,
  speed: number, ttl: number, sizeMul: number,
): void {
  const live = P.chain.maxParticles < f.cap ? P.chain.maxParticles : f.cap
  for (let i = 0; i < n; i++) {
    const idx = f.head
    f.head = f.head + 1 >= live ? 0 : f.head + 1
    // 정중앙만 방사형 — 고르게 퍼지는 별 모양이라 난수 뭉치와 한눈에 구분된다.
    const ang = kind === KIND_CRIT
      ? (i / n) * Math.PI * 2 + f.rng.next() * 0.12
      : f.rng.next() * Math.PI * 2
    const sp = speed * (1 - FX.speedVar + f.rng.next() * FX.speedVar * 2)
    f.x[idx] = x
    f.y[idx] = y
    f.vx[idx] = Math.cos(ang) * sp
    f.vy[idx] = Math.sin(ang) * sp
    const t = ttl * (1 - FX.ttlVar + f.rng.next() * FX.ttlVar * 2)
    f.ttl[idx] = t
    f.life[idx] = t
    f.kind[idx] = kind
    f.sz[idx] = sizeMul
  }
}

/** 즉사한 과녁 자리에 파열 링을 남긴다. 눌렸다가 터지는 걸 링 하나로 보여준다. */
function spawnRing(f: Fx, x: number, y: number, r: number, crit: boolean): void {
  const slot = f.rHead
  f.rHead = f.rHead + 1 >= RINGS ? 0 : f.rHead + 1
  const ttl = crit ? FX.ringCritTtl : FX.ringTtl
  f.rX[slot] = x
  f.rY[slot] = y
  f.rR[slot] = r
  f.rTtl[slot] = ttl
  f.rLife[slot] = ttl
  f.rCrit[slot] = crit ? 1 : 0
}

/** 살아남은 과녁(낙하 중 aerial · pierceable)의 눌림을 기록한다. scene.ts가 읽어간다. */
function markSquash(f: Fx, id: number): void {
  // 같은 과녁이 연달아 맞으면 새 슬롯을 쓰지 않고 갱신한다 — 관통 과녁에서 슬롯이 마른다.
  for (let i = 0; i < SQUASH; i++) {
    if (f.sId[i] === id && (f.sLife[i] ?? 0) > 0) {
      f.sLife[i] = FX.squashTtl
      return
    }
  }
  const slot = f.sHead
  f.sHead = f.sHead + 1 >= SQUASH ? 0 : f.sHead + 1
  f.sId[slot] = id
  f.sLife[slot] = FX.squashTtl
}

/** 과녁 반경을 이벤트만으로는 알 수 없다. World에서 읽어온다 (읽기 전용, A1). */
function radiusOf(w: World, id: number): number {
  for (let i = 0; i < w.targets.length; i++) {
    const t = w.targets[i]
    if (t !== undefined && t.id === id) return t.r
  }
  return 0.5
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

/** 연쇄 파티클이 커지는 배수. 콤보가 깊을수록 굵어진다 (HOOK ★6-4). */
function chainSize(combo: number): number {
  const n = combo < FX.chainSizeCap ? combo : FX.chainSizeCap
  return 1 + (n > 0 ? n : 0) * FX.chainSizeStep
}

export function pumpEvents(fx: Fx, w: World): void {
  // 비네트를 끌 조건은 tick과 무관하게 매 프레임 최신이어야 한다.
  const ph = w.archer.phase
  fx.aiming = ph === 'drawing' || ph === 'full'

  // 같은 tick을 두 번 그리면 이벤트가 이중 처리된다. events를 비우는 건 게임 루프의 몫이라
  // 여기서는 tick으로만 가드한다.
  if (w.tick === fx.lastTick) return
  fx.lastTick = w.tick

  const ev = w.events
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i]
    if (e === undefined) continue

    if (e.t === 'hit') {
      const crit = e.accuracy >= P.hit.bullseyeAcc
      fx.lastX = e.x
      fx.lastY = e.y
      fx.comboRun = e.combo + 1

      const size = chainSize(e.combo)
      if (crit) {
        spawn(fx, e.x, e.y, FX.critBurst, KIND_CRIT, FX.critSpeed, FX.critTtl, size * 1.25)
        fx.hitStop += P.hit.stopMs * 0.001 * FX.critStopMul
        if (fx.slow < FX.critSlowSec) fx.slow = FX.critSlowSec
      } else {
        spawn(fx, e.x, e.y, FX.hitBurst, KIND_HIT, FX.speed, FX.ttl, size)
        fx.hitStop += P.hit.stopMs * 0.001
      }

      spawnRing(fx, e.x, e.y, radiusOf(w, e.targetId), crit)
      // 폭발 살은 반경이 화면에 한 번도 안 그려져 "왜 저것들이 같이 죽었는지"도,
      // 다음 발을 어디 겨눠야 둘이 물리는지도 배울 수 없었다. 기존 파열 링을 그대로 쓴다 —
      // 0.3초 안에 사라지고 새 상태·새 할당이 없다 (A5).
      if (w.fx.burstRadius > 0) spawnRing(fx, e.x, e.y, w.fx.burstRadius, false)
      markSquash(fx, e.targetId)
      captureTrail(fx, w, e.x, e.y, false)

      // 점수 팝 — 문자열은 명중마다 한 번만 만든다. 매 프레임이 아니라 이벤트마다다 (A5).
      pushPopup(
        fx.pop, e.x, e.y, `+${e.score}`, crit ? 'crit' : 'score',
        clamp01(e.score / FX.scoreRef),
      )
      if (crit) pushPopup(fx.pop, e.x, e.y, FX.critFeat, 'feat')

      if (e.combo >= FX.comboMinShow) {
        // 콤보 문자열은 값이 바뀔 때만 만든다 (A5)
        if (e.combo !== fx.comboVal) {
          fx.comboVal = e.combo
          fx.comboText = `${e.combo}연쇄 ×${Math.pow(P.chain.comboMul, e.combo).toFixed(1)}`
        }
        fx.comboX = e.x
        fx.comboY = e.y
        fx.comboLife = FX.comboTtl
      }
    } else if (e.t === 'chain') {
      fx.comboRun++
      fx.lastX = e.x
      fx.lastY = e.y
      const size = chainSize(fx.comboRun)
      spawn(fx, e.x, e.y, FX.chainBurst, KIND_CHAIN, FX.speed, FX.ttl, size)
      spawnRing(fx, e.x, e.y, radiusOf(w, e.targetId), false)
      markSquash(fx, e.targetId)
      fx.hitStop += P.hit.chainStopMs * 0.001

      // 연쇄는 배수가 아니라 **박자**를 보여준다 — 작게, 연달아, 숫자 하나만.
      pushPopup(fx.pop, e.x, e.y, NUM[fx.comboRun] ?? String(fx.comboRun), 'chain')

      const g = clamp01(e.depth / FX.glowDepthFull)
      if (g > fx.glow) fx.glow = g
      fx.glowAge = 0

      if (fx.comboRun >= FX.comboMinShow) {
        if (fx.comboRun !== fx.comboVal) {
          fx.comboVal = fx.comboRun
          fx.comboText = `${fx.comboRun}연쇄 ×${Math.pow(P.chain.comboMul, fx.comboRun).toFixed(1)}`
        }
        fx.comboX = e.x
        fx.comboY = e.y
        fx.comboLife = FX.comboTtl
      }
    } else if (e.t === 'miss') {
      // sim이 여기서 콤보를 끊는다 (world.ts). 렌더 카운터도 같이 끊어야 어긋나지 않는다.
      fx.comboRun = 0
      spawn(fx, e.x, e.y, FX.missBurst, KIND_MISS, FX.missSpeed, FX.missTtl, 1)
      captureTrail(fx, w, e.x, e.y, true)
    }
  }

  const cap = FX.stopCapMs * 0.001
  if (fx.hitStop > cap) fx.hitStop = cap
}

/** 지금 이펙트 시간이 흐르는 속도. 정중앙 직후에만 1보다 작다. */
export function fxTimeScale(fx: Fx): number {
  if (fx.slow <= 0) return 1
  // 끝에서 1로 부드럽게 돌아온다. 툭 끊으면 슬로모가 아니라 렉으로 읽힌다.
  const u = clamp01(fx.slow / FX.critSlowSec)
  return 1 + (FX.critSlowScale - 1) * u * u
}

export function updateFx(fx: Fx, dtReal: number): void {
  // 히트스톱은 sim을 세우는 값이라 언제나 실시간으로 깎인다. 슬로모에 끌려가면 안 된다.
  if (fx.hitStop > 0) {
    fx.hitStop -= dtReal
    if (fx.hitStop < 0) fx.hitStop = 0
  }
  const scale = fxTimeScale(fx)
  if (fx.slow > 0) {
    fx.slow -= dtReal
    if (fx.slow < 0) fx.slow = 0
  }
  // 이펙트 시간축. 파티클·링·팝만 여기에 실린다 — 궤적과 콤보 표시는 읽기용이라 실시간이다.
  const dt = dtReal * scale

  if (fx.comboLife > 0) fx.comboLife -= dtReal

  // ── 연쇄 비네트 ──────────────────────────────────────────────
  if (fx.glow > 0) {
    fx.glowAge += dtReal
    // ★ 시위를 잡는 순간 급히 꺼진다. 다음 발을 겨누는 화면에 물이 들면 안 된다.
    //   나이 컷오프는 카메라 shakeCutoff와 같은 규율 — 연출이 조준보다 오래 살지 못한다.
    if (fx.glowAge >= FX.glowCutoff) fx.glow = 0
    else fx.glow = damp(fx.glow, 0, fx.aiming ? FX.glowAimDecay : FX.glowDecay, dtReal)
    if (fx.glow < 0.004) fx.glow = 0
  }

  updatePopups(fx.pop, dt)

  const g = P.arrow.gravity
  const drag = 1 - FX.dragRate * dt
  const k = drag > 0 ? drag : 0
  for (let i = 0; i < fx.cap; i++) {
    const l = fx.life[i] ?? 0
    if (l <= 0) continue
    const nl = l - dt
    fx.life[i] = nl > 0 ? nl : 0
    if (nl <= 0) continue
    const vx = (fx.vx[i] ?? 0) * k
    const vy = (fx.vy[i] ?? 0) * k - g * dt
    fx.vx[i] = vx
    fx.vy[i] = vy
    fx.x[i] = (fx.x[i] ?? 0) + vx * dt
    fx.y[i] = (fx.y[i] ?? 0) + vy * dt
  }

  for (let s = 0; s < RINGS; s++) {
    const l = fx.rLife[s] ?? 0
    if (l <= 0) continue
    const nl = l - dt
    fx.rLife[s] = nl > 0 ? nl : 0
  }

  for (let s = 0; s < SQUASH; s++) {
    const l = fx.sLife[s] ?? 0
    if (l <= 0) continue
    const nl = l - dt
    fx.sLife[s] = nl > 0 ? nl : 0
    if (nl <= 0) fx.sId[s] = -1
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

// ───────────────────────── scene.ts 가 읽어가는 것 ─────────────────────────

/**
 * 과녁 한 개의 스쿼시 배율. 1,1 이면 아무 일도 없는 상태다.
 *
 * scene.ts 사용법 (drawTargets 안, arc 대신 ellipse):
 * ```ts
 * const sq = targetSquash(fx, t.id)
 * ctx.ellipse(x, y, r * sq.sx, r * sq.sy, 0, 0, Math.PI * 2)
 * ```
 * 즉사하는 과녁은 같은 프레임에 alive=false가 되어 scene이 안 그리므로, 그쪽 몫은
 * effects.ts가 파열 링으로 대신 그린다. 이 함수가 실제로 눌러 그리는 건 **살아남는 과녁** —
 * 낙하 중인 aerial 과 관통 과녁이다.
 *
 * ★ 반환값은 **공유 스크래치**다. 다음 호출 전에 읽어라 (프레임당 할당 0, A5).
 */
export interface Squash {
  readonly sx: number
  readonly sy: number
}

const SQ_OUT = { sx: 1, sy: 1 }

/** 0..1 진행에서의 눌림 세기. squashT에서 정확히 0으로 돌아온다 (튀지 않는다). */
function squashPulse(t: number): number {
  return t < FX.squashT ? Math.sin((Math.PI * t) / FX.squashT) : 0
}

/** squashT 이후의 부풀기. 끝에서 0으로 돌아온다. */
function squashOver(t: number): number {
  if (t < FX.squashT) return 0
  const u = (t - FX.squashT) / (1 - FX.squashT)
  return Math.sin(Math.PI * u)
}

export function targetSquash(fx: Fx, id: number): Squash {
  SQ_OUT.sx = 1
  SQ_OUT.sy = 1
  for (let i = 0; i < SQUASH; i++) {
    if (fx.sId[i] !== id) continue
    const l = fx.sLife[i] ?? 0
    if (l <= 0) continue
    const t = 1 - clamp01(l / FX.squashTtl)
    const sq = squashPulse(t)
    const ov = FX.squashOver * squashOver(t)
    SQ_OUT.sx = 1 + FX.squashX * sq + ov
    SQ_OUT.sy = 1 - FX.squashY * sq + ov
    return SQ_OUT
  }
  return SQ_OUT
}

/** 위업 문구를 띄운다. 좌표를 생략하면 마지막 명중 지점 (game/ui 레이어용). */
export function pushFeat(text: string, x?: number, y?: number, fx?: Fx): void {
  const f = fx ?? active
  if (f === null) return
  pushPopup(f.pop, x ?? f.lastX, y ?? f.lastY, text, 'feat')
}

/** 팝 풀을 직접 쓰고 싶은 쪽을 위한 창구. 없으면 pushFeat만으로 충분하다. */
export function fxPopups(fx: Fx): Popups {
  return fx.pop
}

// ───────────────────────────── 그리기 ─────────────────────────────

function drawVignette(ctx: CanvasRenderingContext2D, f: Fx, w: number, h: number): void {
  if (f.glow <= 0) return
  if (f.vig === null || f.vigW !== w || f.vigH !== h) {
    // 그라디언트는 화면 크기가 바뀔 때만 만든다 (프레임당 할당 0, A5).
    const cx = w * 0.5
    const cy = h * 0.5
    const rad = Math.max(w, h) * 0.72
    const g = ctx.createRadialGradient(cx, cy, rad * FX.glowInner, cx, cy, rad * FX.glowOuter)
    g.addColorStop(0, GLOW_RGB0)
    g.addColorStop(1, GLOW_RGB1)
    f.vig = g
    f.vigW = w
    f.vigH = h
  }
  ctx.globalAlpha = FX.glowAlpha * f.glow
  ctx.fillStyle = f.vig
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 1
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

  // ── 파열 링 (스쿼시 & 스트레치) ────────────────────────────────
  ctx.lineWidth = FX.ringW
  for (let s = 0; s < RINGS; s++) {
    const life = f.rLife[s] ?? 0
    if (life <= 0) continue
    const ttl = f.rTtl[s] ?? 1
    const t = 1 - clamp01(life / ttl)
    const sq = squashPulse(t)
    const ov = squashOver(t)
    // 눌린 뒤 퍼지며 사라진다. 반경은 맞은 과녁 자신의 크기에서 출발한다.
    const grow = t < FX.squashT ? 1 : 1 + FX.ringGrow * Math.pow((t - FX.squashT) / (1 - FX.squashT), 0.55)
    const rp = (f.rR[s] ?? 0.5) * cam.scale * grow
    if (rp < 1) continue
    const rx = rp * (1 + FX.squashX * sq + FX.squashOver * ov)
    const ry = rp * (1 - FX.squashY * sq + FX.squashOver * ov)
    ctx.globalAlpha = (t < FX.squashT ? 1 : 1 - (t - FX.squashT) / (1 - FX.squashT)) * 0.85
    ctx.strokeStyle = (f.rCrit[s] ?? 0) === 1 ? THEME.target2 : THEME.accent
    ctx.beginPath()
    ctx.ellipse(
      worldToScreenX(cam, f.rX[s] ?? 0),
      worldToScreenY(cam, f.rY[s] ?? 0),
      rx, ry, 0, 0, Math.PI * 2,
    )
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
    ctx.fillStyle = kind === KIND_MISS
      ? THEME.trailMiss
      : kind === KIND_CRIT ? THEME.target2 : kind === KIND_CHAIN ? THEME.target2 : THEME.accent
    const sz = px * (f.sz[i] ?? 1) * (0.4 + t * 0.6)
    ctx.fillRect(
      worldToScreenX(cam, f.x[i] ?? 0) - sz * 0.5,
      worldToScreenY(cam, f.y[i] ?? 0) - sz * 0.5,
      sz, sz,
    )
  }

  // ── 연쇄 비네트 (가장자리만) ──────────────────────────────────
  drawVignette(ctx, f, cam.w, cam.h)

  // ── 콤보 배수 (GDD 7장 절제 원칙: 작게, 연쇄가 일어난 자리 옆에) ──
  if (f.comboLife > 0 && f.comboText !== '') {
    ctx.globalAlpha = clamp01(f.comboLife / FX.comboTtl)
    ctx.fillStyle = THEME.accent
    ctx.font = '600 13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const rise = (1 - clamp01(f.comboLife / FX.comboTtl)) * 14
    ctx.fillText(f.comboText, worldToScreenX(cam, f.comboX), worldToScreenY(cam, f.comboY) - 12 - rise)
  }

  // ── 점수 팝 (맨 위) ──────────────────────────────────────────
  drawPopups(ctx, cam, f.pop)

  ctx.globalAlpha = 1
}
