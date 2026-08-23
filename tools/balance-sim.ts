/**
 * 헤드리스 밸런스 시뮬 (ARCHITECTURE A7 / balance-lens의 유일한 근거)
 *
 * 봇 3종이 스테이지를 N판씩 자동 플레이하고 클리어율·점수·붕괴율을 낸다.
 * "느낌상 쉬운 것 같다"를 숫자로 대체하는 게 이 파일의 존재 이유다.
 *
 * 실행: npm run balance -- --seed=12345 --runs=200
 *
 * 봇은 **World를 읽어 InputFrame을 만드는 함수**일 뿐이다.
 * World를 직접 건드리면 측정값이 게임이 아니라 봇을 재는 게 되므로 절대 쓰지 않는다.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createWorld, step } from '../src/sim/world.ts'
import { effectiveStats } from '../src/sim/bow.ts'
import { STAGES as CHAPTER1 } from '../src/game/stages.ts'
import { grantArrows } from '../src/game/progression.ts'
import { defaultSave } from '../src/game/save.ts'
import { makeRng } from '../src/core/rng.ts'
import { clamp, lerp } from '../src/core/math.ts'
import { P } from '../src/tune/params.ts'
import type { Rng } from '../src/core/rng.ts'
import type { InputFrame, StageDef, Stats, Target, World } from '../src/sim/types.ts'

// ───────────────────────── 실행 인자 ─────────────────────────

interface Args {
  seed: number
  runs: number
  budgetMs: number
  preview: boolean
  /** 보유 화살이 바닥났을 때의 지급량으로 돌린다 (progression.grantArrows). */
  floor: boolean
}

function parseArgs(argv: readonly string[]): Args {
  let seed = 20260823
  let runs = 200
  let budgetMs = 25000
  let preview = false
  let floor = false
  for (const a of argv) {
    const m = /^--(\w+)=(-?[\d.]+)$/.exec(a)
    if (m === null) continue
    const v = Number(m[2])
    if (!Number.isFinite(v)) continue
    if (m[1] === 'seed') seed = Math.trunc(v)
    else if (m[1] === 'runs') runs = Math.max(1, Math.trunc(v))
    else if (m[1] === 'budget') budgetMs = Math.max(1000, Math.trunc(v * 1000))
    else if (m[1] === 'preview') preview = v !== 0
    else if (m[1] === 'floor') floor = v !== 0
  }
  return { seed, runs, budgetMs, preview, floor }
}

/** 시드 합성. 같은 (스테이지, 판 번호)면 봇이 달라도 같은 판이 나온다 — 짝지은 비교로 분산을 줄인다. */
function mixSeed(a: number, b: number, c: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ b, 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  h = Math.imul(h ^ c, 0x27d4eb2f) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

// ───────────────────────── 봇 모델 ─────────────────────────
//
// 아래 숫자는 게임 손맛 상수가 아니라 **봇의 실력 모델**이다. 플레이어가 겪는 값이 아니므로
// params.ts(P)에 넣지 않고 여기 둔다. 밸런스 담당이 "봇 실력 자체"를 튜닝하고 싶어지면
// params.ts에 bot 섹션을 요청할 것.
//
// ── 새 활 모델에서의 '실력'이란 무엇인가 ──
//
// 1. 만작은 0.375초 만에 온다. 당김의 앞 2/3은 **떨림이 0**이고(gripFrom 0.85부터 스며든다),
//    만작에서 onsetAmp(0.60)배로 시작해 계속 자란다 — 만작 순간부터 이미 읽을 수 있는 크기다.
//    즉 **만작에 닿는 순간이 가장 정확하다.** "떨림이 잦아들기를 기다린다"는 옛 전략은 순손해다.
// 2. 그런데 조준은 당기는 0.375초 안에 끝나야 한다. 안 끝났는데 만작이 오면 빗나간다.
//    → 그래서 조준을 **시간에 따라 수렴하는 오차**로 모델링한다 (aimTau).
//    실력이 낮을수록 늦게 수렴하고 바닥 오차(aimFloor)도 크다.
// 3. 거리 감각도 실력이다. 초보는 자기 화살이 실제보다 빠르다고 착각해(velBias)
//    낮게 쏴서 못 미친다. 난수가 아니라 **체계적이고 학습 가능한** 오차다.
// 4. 위상 읽기는 만작 직후 짧은 창에서만 이득이다. 창이 길어질수록 진폭이 자라
//    "좋은 위상 × 큰 진폭"이 "아무 위상 × 작은 진폭"보다 나빠진다.
//
// 요약: 실력 = 조준 수렴 속도 × 거리 감각 × 릴리즈 타이밍(만작 직후) × 위상 읽기.

type BotKind = 'novice' | 'average' | 'expert'

interface BotModel {
  /** 사이클 시작 순간의 조준 오차 σ (rad) */
  aimAcquire: number
  /** 아무리 오래 겨눠도 남는 조준 오차 σ (rad) */
  aimFloor: number
  /** 조준 수렴 시간상수 (s). 만작까지가 0.375s라 이 값이 실력의 절반이다. */
  aimTau: number
  /** 화살 초속 오판 비율. +면 빠르다고 착각 → 낮게 쏴서 못 미친다. */
  velBias: number
  /** 바람을 얼마나 읽는가 0..1 */
  windAware: number
  /** 이동 과녁 리드를 얼마나 맞추는가 0..1 */
  leadAware: number
  /** 만작 후 놓기 시작하는 시각 (s). 위상을 못 읽는 봇은 [holdLo, holdHi]에서 뽑는다. */
  holdLo: number
  /** 이 시각에 닿으면 위상과 무관하게 놓는다 (s) */
  holdHi: number
  /** |tremorOffset| <= tol × tremorAmp 이면 놓는다. 1 이상이면 위상을 못 읽는다는 뜻. */
  phaseTol: number
  /** 위상 인지 지연 (스텝). 본 것을 즉시 못 놓는다 — 이게 위상 읽기의 실력 상한을 만든다. */
  reactSteps: number
  /** 만작 후 이 시간이 지나면 호흡정지를 쓴다. Infinity면 안 쓴다. */
  steadyAfter: number
  /** 이 비율 이상 스태미나가 찰 때까지 쉰다 */
  restFrac: number
  /** 붕괴 경고가 뜨면 즉시 놓는가 */
  bailsOnWarn: boolean
}

const BOTS: Readonly<Record<BotKind, BotModel>> = {
  /**
   * 초보. 조준이 느리게 수렴하고 바닥 오차가 크다. 거리 감각이 없어 멀수록 못 미친다.
   * 확신이 안 서서 만작을 한참 지나 끌다 놓는다 — 그 사이 떨림이 다 자라 있다.
   * 붕괴 경고를 무시해서 가끔 스스로 무너진다.
   */
  novice: {
    aimAcquire: 0.045,
    aimFloor: 0.0105,
    aimTau: 0.55,
    velBias: 0.022,
    windAware: 0,
    leadAware: 0,
    holdLo: 0.50,
    holdHi: 1.50,
    phaseTol: 2,
    reactSteps: 0,
    steadyAfter: Number.POSITIVE_INFINITY,
    // 초보는 팔이 회복되기를 기다릴 줄 모른다. 그래서 가끔 만작 도중에 스스로 무너진다.
    restFrac: 0.38,
    bailsOnWarn: false,
  },
  /**
   * 보통. 만작 전에 조준이 대체로 붙는다. 만작 후 0.3~0.8초 창에서 놓고,
   * 위상은 반쯤 읽는다 — 허용치가 느슨하고(0.45) 인지 지연이 50ms라
   * "좋은 위상을 봤다"와 "좋은 위상에서 놓았다" 사이가 벌어진다.
   */
  average: {
    aimAcquire: 0.030,
    aimFloor: 0.0066,
    aimTau: 0.26,
    velBias: 0.008,
    windAware: 0.6,
    leadAware: 0.6,
    holdLo: 0.30,
    holdHi: 0.80,
    phaseTol: 0.45,
    reactSteps: 6,
    steadyAfter: Number.POSITIVE_INFINITY,
    restFrac: 0.55,
    bailsOnWarn: true,
  },
  /**
   * 숙련. 당기는 0.375초 안에 조준이 끝난다. 만작 직후 0.16초 창에서
   * |tremorOffset|이 최소인 순간에 놓는다 — 이 창을 넘기면 진폭이 자라 손해다.
   *
   * 호흡정지는 세 봇 다 쓰지 않는다. GDD 6장이 호흡정지 활용을 챕터 8의 학습 목표로
   * 잡아 두었으므로, 챕터 1~3을 재는 봇이 그걸 쓰면 측정 대상이 어긋난다.
   */
  expert: {
    aimAcquire: 0.020,
    aimFloor: 0.0045,
    aimTau: 0.095,
    velBias: 0,
    windAware: 1,
    leadAware: 1,
    holdLo: 0,
    holdHi: 0.16,
    phaseTol: 0.25,
    reactSteps: 2,
    steadyAfter: Number.POSITIVE_INFINITY,
    restFrac: 0.75,
    bailsOnWarn: true,
  },
}

/**
 * 아직 결과가 안 난 화살이 있는가.
 * 봇은 화살이 날아가는 동안 다음 발을 잡지 않는다 — 사람은 맞았는지 보고 다음을 정한다.
 * 안 그러면 이미 죽을 과녁에 두 발을 겹쳐 쏴, 실력이 아니라 발사 주기가 명중률을 정하게 된다.
 */
function anyArrowInFlight(w: World): boolean {
  const pool = w.arrows
  for (let i = 0; i < pool.length; i++) {
    const a = pool[i]
    if (a !== undefined && a.alive && a.outcome === 'flying') return true
  }
  return false
}

/** 조준을 다시 푸는 간격 (스텝). 매 스텝 탄도해를 다시 풀면 시뮬이 느려진다. */
const AIM_UPDATE_STEPS = 8
/** 릴리즈 후 시위를 다시 잡기까지 (스텝) */
const RELEASE_COOLDOWN = 10
/** 위상 인지 지연 버퍼 길이. reactSteps 상한이자 고정 할당 크기 (A5). */
const RATIO_HIST = 16

// ───────────────────────── 탄도 해 ─────────────────────────
//
// 봇이 들고 있는 "화살이 이렇게 날 것이다"라는 모델. sim 구현이 아니라 봇의 추정이다.
// 적분 순서와 스텝을 sim/ballistics.ts 와 맞춰 둔다 — 모델이 어긋나면 세 봇이 똑같이
// 빗나가서 실력 격차가 아니라 모델 오차를 재게 된다.

const MODEL_MAX_STEPS = 900

/** 주어진 발사각으로 쐈을 때 목표 x에서의 높이 오차. 양수면 너무 높이 쐈다. */
function flightError(dx: number, dy: number, angle: number, v: number, wind: number, dt: number): number {
  const g = P.arrow.gravity
  const drag = P.arrow.drag
  let x = 0
  let y = 0
  let vx = Math.cos(angle) * v
  let vy = Math.sin(angle) * v
  for (let i = 0; i < MODEL_MAX_STEPS; i++) {
    const px = x
    const py = y
    const rvx = vx - wind
    const sp = Math.sqrt(rvx * rvx + vy * vy)
    const k = drag * sp
    vx -= k * rvx * dt
    vy -= k * vy * dt
    vy -= g * dt
    x += vx * dt
    y += vy * dt
    if (x >= dx) {
      const span = x - px
      const t = span > 0 ? (dx - px) / span : 0
      return py + (y - py) * t - dy
    }
    if (y < dy - 40) break
  }
  // 사거리 부족 — 각을 올리라는 신호를 거리 부족만큼 실어 보낸다
  return y - dy - (dx - x)
}

/** 할선법으로 발사각을 푼다. 저탄도 해를 향해 수렴한다. */
function solveAngle(dx: number, dy: number, v: number, wind: number, dt: number): number {
  if (dx <= 0.05) return Math.atan2(dy, Math.max(dx, 0.05))
  let a0 = Math.atan2(dy, dx)
  let f0 = flightError(dx, dy, a0, v, wind, dt)
  let a1 = a0 + 0.06
  let f1 = flightError(dx, dy, a1, v, wind, dt)
  for (let i = 0; i < 6; i++) {
    const denom = f1 - f0
    if (Math.abs(denom) < 1e-9) break
    const a2 = clamp(a1 - (f1 * (a1 - a0)) / denom, -1.2, 1.45)
    a0 = a1
    f0 = f1
    a1 = a2
    f1 = flightError(dx, dy, a1, v, wind, dt)
    if (Math.abs(f1) < 0.005) break
  }
  return a1
}

// ───────────────────────── 봇 ─────────────────────────

class Bot {
  private readonly m: BotModel
  private readonly rng: Rng
  /** 봇이 **믿는** 화살 초속. velBias만큼 진실에서 어긋나 있다. */
  private readonly v: number
  private readonly out: InputFrame = { aimX: 0, aimY: 0, drawing: false, steady: false }
  /** 위상 인지 지연용 링버퍼. 생성자에서 한 번만 잡는다 (A5). */
  private readonly hist = new Float64Array(RATIO_HIST)
  private histIdx = 0

  /** 탄도해가 준 기준 발사각 (rad). 조준 오차는 여기 얹는다. */
  private baseAngle = 0
  /** 사이클 시작 순간의 조준 오차 (rad) */
  private aimStart = 0
  /** 수렴이 끝나도 남는 조준 오차 (rad) */
  private aimEnd = 0
  /** 이번 사이클에서 겨눈 시간 (s). 조준 수렴의 유일한 입력. */
  private aimAge = 0
  /** 위상을 못 읽는 봇이 이번 사이클에 참기로 한 시간 (s) */
  private plannedHold = 0
  private cooldown = 0
  private sinceAim = AIM_UPDATE_STEPS
  private cycleActive = false

  constructor(kind: BotKind, seed: number, stats: Stats) {
    const m = BOTS[kind]
    this.m = m
    this.rng = makeRng(seed)
    // 봇은 항상 자기 한계(maxDraw)까지 당겨서 놓는다. 초보의 만작은 1.0이 아니라 0.74다 —
    // maxSpeed를 그대로 믿으면 모든 봇이 30% 빠른 화살을 가정해 일제히 못 미친다.
    const d = effectiveStats(stats)
    const trueSpeed =
      lerp(P.bow.minSpeed, P.bow.maxSpeed, Math.pow(d.maxDraw, P.bow.drawCurve)) * d.speedMul
    this.v = trueSpeed * (1 + m.velBias)
    this.out.aimX = 1
    this.out.aimY = 0
  }

  /** World를 읽고 이번 스텝의 입력을 만든다. World는 절대 건드리지 않는다. */
  frame(w: World): InputFrame {
    const a = w.archer
    const o = this.out

    if (this.cooldown > 0) {
      this.cooldown--
      o.drawing = false
      o.steady = false
      return o
    }

    // 놓았거나 무너졌다 — 버튼을 떼야 다음 사이클이 잡힌다 (bow.ts 연사 방지 규칙)
    if (a.phase === 'recovering' || a.phase === 'collapsing') {
      this.cycleActive = false
      o.drawing = false
      o.steady = false
      return o
    }

    if (a.phase === 'idle') {
      this.cycleActive = false
      // 회복이 덜 됐으면 쉰다. 지쳐서 쏘면 붕괴로 판을 버린다.
      if (a.stamina < this.m.restFrac * a.staminaMax) {
        o.drawing = false
        o.steady = false
        return o
      }
    }

    // 앞선 화살의 결과가 나오기 전에는 새로 잡지 않는다
    if (!this.cycleActive && anyArrowInFlight(w)) {
      o.drawing = false
      o.steady = false
      return o
    }

    if (!this.cycleActive) {
      this.startCycle()
      this.solveAim(w)
    } else if (this.sinceAim >= AIM_UPDATE_STEPS) {
      this.solveAim(w)
    }
    this.sinceAim++
    // 겨눈 시간만큼 조준이 수렴한다. 만작(0.375s)까지 못 붙으면 그대로 빗나간다.
    this.aimAge += w.dt
    this.applyAim(w)

    const full = a.phase === 'full'
    if (full) this.pushRatio(a.tremorOffset, a.tremorAmp)

    o.steady = full && a.holdTime >= this.m.steadyAfter
    o.drawing = !(full && this.shouldRelease(a.holdTime, a.warn))
    if (!o.drawing) {
      this.cooldown = RELEASE_COOLDOWN
      this.cycleActive = false
      o.steady = false
    }
    return o
  }

  private startCycle(): void {
    this.cycleActive = true
    this.aimStart = this.rng.gaussian() * this.m.aimAcquire
    this.aimEnd = this.rng.gaussian() * this.m.aimFloor
    this.aimAge = 0
    this.plannedHold =
      this.m.phaseTol >= 1 ? this.rng.range(this.m.holdLo, this.m.holdHi) : this.m.holdLo
    this.sinceAim = AIM_UPDATE_STEPS
    // 지난 사이클의 위상 기억은 버린다. 안 그러면 만작 첫 스텝에 남의 위상으로 놓는다.
    this.hist.fill(Number.POSITIVE_INFINITY)
    this.histIdx = 0
  }

  /** 살아 있는 과녁 중 가장 가까운 것. 가까운 것부터 확실히 챙기는 게 클리어에 유리하다. */
  private pickTarget(w: World): Target | null {
    const targets = w.targets
    let best: Target | null = null
    let bestD = Number.POSITIVE_INFINITY
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]
      if (t === undefined || !t.alive) continue
      const dx = t.x - w.archer.x
      const dy = t.y - w.archer.y
      const d = dx * dx + dy * dy
      if (d < bestD) {
        bestD = d
        best = t
      }
    }
    return best
  }

  /** 탄도해를 다시 푼다 (8스텝마다). 조준 오차는 여기 없다 — applyAim이 얹는다. */
  private solveAim(w: World): void {
    this.sinceAim = 0
    const t = this.pickTarget(w)
    if (t === null) {
      this.baseAngle = 0
      return
    }
    let dx = t.x - w.archer.x
    let dy = t.y - w.archer.y
    // 리드 샷: 화살이 도달할 때쯤 과녁이 어디 있을지. 실력이 낮을수록 덜 맞춘다.
    const tof = Math.sqrt(dx * dx + dy * dy) / Math.max(this.v, 1)
    dx += t.vx * tof * this.m.leadAware
    dy += t.vy * tof * this.m.leadAware
    // 바람도 봇이 아는 만큼만 모델에 넣는다.
    this.baseAngle = solveAngle(dx, dy, this.v, w.wind * this.m.windAware, w.dt)
  }

  /**
   * 조준 오차는 시간에 따라 aimStart → aimEnd 로 지수 수렴한다.
   * 이게 "당기는 동안 조준을 끝낸다"는 실력을 수치로 만든 부분이다.
   */
  private applyAim(w: World): void {
    const m = this.m
    const decay = m.aimTau > 0 ? Math.exp(-this.aimAge / m.aimTau) : 0
    const err = this.aimEnd + (this.aimStart - this.aimEnd) * decay
    const angle = this.baseAngle + err
    const o = this.out
    o.aimX = w.archer.x + Math.cos(angle) * 10
    o.aimY = w.archer.y + Math.sin(angle) * 10
  }

  private pushRatio(offset: number, amp: number): void {
    this.hist[this.histIdx] = Math.abs(offset) / (amp > 1e-9 ? amp : 1e-9)
    this.histIdx = (this.histIdx + 1) % RATIO_HIST
  }

  /** reactSteps 전에 **본** 위상. 지금 위상이 아니다 — 사람은 본 것을 즉시 못 놓는다. */
  private seenRatio(): number {
    const i = (this.histIdx - 1 - this.m.reactSteps + RATIO_HIST * 2) % RATIO_HIST
    const v = this.hist[i]
    return v === undefined ? Number.POSITIVE_INFINITY : v
  }

  private shouldRelease(holdTime: number, warn: number): boolean {
    const m = this.m
    // 창을 넘기면 진폭이 자라 손해다. 위상이 나빠도 놓는다.
    if (holdTime >= m.holdHi) return true
    // 붕괴 직전에 버티는 건 실력이 아니라 사고다
    if (m.bailsOnWarn && warn > 0) return true
    if (holdTime < this.plannedHold) return false
    // 위상을 못 읽는 봇은 계획한 시각에 그냥 놓는다
    if (m.phaseTol >= 1) return true
    return this.seenRatio() <= m.phaseTol
  }
}

// ───────────────────────── 스테이지 ─────────────────────────

interface StageRow {
  key: string
  /** 이 판에 도달했을 때 플레이어가 들고 있을 것으로 가정한 스탯 */
  stats: Stats
  make: (seed: number) => StageDef
}

/**
 * 진행도별 가정 스탯. 실제 성장 곡선(훈련치 소비)이 붙기 전까지의 **밸런스 가정**이다.
 * 가정이 바뀌면 클리어율이 통째로 움직이므로, 감추지 말고 여기 한 곳에 둔다.
 */
function assumedStats(progress: number): Stats {
  return {
    str: 1 + Math.round(progress * 4),
    steady: 1 + Math.round(progress * 4),
    stamina: 1 + Math.round(progress * 3),
    focus: Math.round(progress * 3),
  }
}

/** 실제 콘텐츠. 밸런스 판정의 대상은 언제나 이쪽이다. */
/**
 * 보유 화살이 바닥났을 때 이 판에 실제로 지급되는 발수.
 * 공식을 여기 베끼지 않고 progression.grantArrows를 그대로 부른다 — 베끼면 언젠가 어긋난다.
 */
function floorArrows(def: StageDef): number {
  const d = defaultSave(0)
  d.arrows = 0
  return grantArrows(d, def)
}

const REAL_STAGES: readonly StageRow[] = CHAPTER1.map((def, i) => ({
  key: def.id,
  stats: assumedStats(CHAPTER1.length > 1 ? i / (CHAPTER1.length - 1) : 0),
  make: (seed: number): StageDef => ({ ...def, seed }),
}))

/**
 * 아직 저작되지 않은 챕터의 메커닉(바람·이동·공중 연쇄)을 미리 재보는 프리뷰.
 * 실제 콘텐츠가 아니므로 기본값은 꺼져 있다. `--preview=1` 로 켠다.
 */
const PREVIEW_STAGES: readonly StageRow[] = [
  {
    key: 'pv-wind',
    stats: assumedStats(1),
    make: (seed: number): StageDef => ({
      id: 'pv-wind', seed, arrows: 7, targetScore: 300, wind: 5,
      targets: [
        { kind: 'static', x: 21, y: 1.8, r: 0.38, score: 100 },
        { kind: 'static', x: 25, y: 2.6, r: 0.35, score: 100 },
      ],
    }),
  },
  {
    key: 'pv-moving',
    stats: assumedStats(1),
    make: (seed: number): StageDef => ({
      id: 'pv-moving', seed, arrows: 7, targetScore: 300, wind: 0,
      targets: [
        { kind: 'moving', x: 20, y: 2.2, r: 0.4, score: 100, ampX: 2.2, freq: 0.3 },
        { kind: 'moving', x: 24, y: 3.0, r: 0.38, score: 100, ampY: 1.4, freq: 0.45 },
      ],
    }),
  },
  {
    key: 'pv-aerial',
    stats: assumedStats(1),
    make: (seed: number): StageDef => ({
      id: 'pv-aerial', seed, arrows: 7, targetScore: 500, wind: 2,
      targets: [
        { kind: 'aerial', x: 20, y: 6.2, r: 0.34, score: 100 },
        { kind: 'static', x: 20, y: 1.6, r: 0.45, score: 100 },
        { kind: 'aerial', x: 25, y: 5.4, r: 0.32, score: 100 },
        { kind: 'static', x: 25, y: 1.5, r: 0.45, score: 100 },
      ],
    }),
  },
]

// ───────────────────────── 한 판 ─────────────────────────

interface RunResult {
  cleared: boolean
  score: number
  arrowsUsed: number
  collapsed: boolean
  hits: number
  shots: number
  steps: number
  /** 만작에 닿은 발들의 릴리즈 지연 합 (s) */
  holdSum: number
  holdShots: number
  /** 만작에 못 닿고 나간 발 (붕괴로 손이 풀린 경우) */
  noFullShots: number
  /** 붕괴로 나간 발 */
  collapseShots: number
}

function playOne(row: StageRow, kind: BotKind, stageSeed: number, botSeed: number): RunResult {
  const def = row.make(stageSeed)
  const w = createWorld(def, row.stats)
  const bot = new Bot(kind, botSeed, row.stats)
  const hz = Math.round(1 / w.dt)
  const maxSteps = Math.ceil((def.timeLimit ?? 90) * hz) + 4 * hz

  let collapsed = false
  let hits = 0
  let shots = 0
  let steps = 0
  let holdSum = 0
  let holdShots = 0
  let noFullShots = 0
  let collapseShots = 0
  // 이번 사이클이 만작에 닿았는가. release가 뜰 때 이걸 보고 '만작 실패'를 가른다.
  let reachedFull = false
  let collapsedThisShot = false

  while (w.status === 'playing' && steps < maxSteps) {
    // release는 holdTime을 0으로 되돌리고 나간다. 지연을 재려면 스텝 직전 값이 필요하다.
    const prevHold = w.archer.holdTime
    step(w, bot.frame(w))
    steps++
    const events = w.events
    for (let i = 0; i < events.length; i++) {
      const e = events[i]
      if (e === undefined) continue
      if (e.t === 'draw_start') {
        reachedFull = false
        collapsedThisShot = false
      } else if (e.t === 'full_draw') {
        reachedFull = true
      } else if (e.t === 'collapse') {
        collapsed = true
        collapsedThisShot = true
      } else if (e.t === 'hit') {
        hits++
      } else if (e.t === 'release') {
        shots++
        if (collapsedThisShot) collapseShots++
        if (reachedFull) {
          holdSum += prevHold + w.dt
          holdShots++
        } else {
          noFullShots++
        }
        reachedFull = false
        collapsedThisShot = false
      }
    }
    // 소비자 계약: 읽었으면 비운다
    events.length = 0
  }

  return {
    cleared: w.status === 'cleared',
    score: w.score,
    arrowsUsed: def.arrows - w.arrowsLeft,
    collapsed,
    hits,
    shots,
    steps,
    holdSum,
    holdShots,
    noFullShots,
    collapseShots,
  }
}

// ───────────────────────── 집계 ─────────────────────────

interface Agg {
  stage: string
  bot: BotKind
  runs: number
  clearRate: number
  avgScore: number
  avgArrows: number
  collapseRate: number
  avgHits: number
  /** 한 발당 명중률. 클리어율이 100%로 포화해도 실력 차이는 여기서 드러난다. */
  hitRate: number
  /** 만작 후 평균 릴리즈 지연 (s). 새 활 모델의 건강도를 보는 1번 지표. */
  avgHold: number
  /** 만작에 못 닿고 나간 발의 비율 */
  noFullRate: number
  /** 붕괴로 나간 발의 비율 */
  collapseShotRate: number
  /** 판 평균 길이 (s). C1: 한 판 30초~1분 */
  avgSeconds: number
}

function playGroup(row: StageRow, kind: BotKind, baseSeed: number, runs: number, stageIdx: number): Agg {
  let cleared = 0
  let score = 0
  let arrows = 0
  let collapses = 0
  let hits = 0
  let shots = 0
  let holdSum = 0
  let holdShots = 0
  let noFull = 0
  let collapseShots = 0
  let steps = 0
  for (let i = 0; i < runs; i++) {
    // 스테이지 시드는 봇과 무관하게 같다 — 같은 판을 세 봇이 나눠 푼다
    const stageSeed = mixSeed(baseSeed, stageIdx, i)
    const botSeed = mixSeed(stageSeed, kind.length, i * 7 + 1)
    const r = playOne(row, kind, stageSeed, botSeed)
    if (r.cleared) cleared++
    if (r.collapsed) collapses++
    score += r.score
    arrows += r.arrowsUsed
    hits += r.hits
    shots += r.shots
    holdSum += r.holdSum
    holdShots += r.holdShots
    noFull += r.noFullShots
    collapseShots += r.collapseShots
    steps += r.steps
  }
  return {
    stage: row.key,
    bot: kind,
    runs,
    clearRate: cleared / runs,
    avgScore: score / runs,
    avgArrows: arrows / runs,
    collapseRate: collapses / runs,
    avgHits: hits / runs,
    hitRate: shots > 0 ? hits / shots : 0,
    avgHold: holdShots > 0 ? holdSum / holdShots : 0,
    noFullRate: shots > 0 ? noFull / shots : 0,
    collapseShotRate: shots > 0 ? collapseShots / shots : 0,
    avgSeconds: steps / runs / P.sim.hz,
  }
}

// ───────────────────────── 출력 ─────────────────────────

const TARGET_LO = 0.55
const TARGET_HI = 0.75
const GAP_LO = 0.30
const GAP_HI = 0.50

const pct = (v: number): string => (v * 100).toFixed(1) + '%'

function verdict(rate: number): string {
  if (rate < TARGET_LO) return `LOW  ${((rate - TARGET_LO) * 100).toFixed(1)}%p`
  if (rate > TARGET_HI) return `HIGH +${((rate - TARGET_HI) * 100).toFixed(1)}%p`
  return 'OK'
}

function printTable(rows: readonly Agg[]): void {
  const head =
    'stage'.padEnd(13) + 'bot'.padEnd(9) + 'clear'.padStart(7) + 'score'.padStart(9) +
    'arrows'.padStart(8) + 'hit/shot'.padStart(10) + 'hold'.padStart(8) +
    'noFull'.padStart(8) + 'collapse'.padStart(10) + 'sec'.padStart(7) + '  vs목표'
  console.log(head)
  console.log('-'.repeat(head.length + 4))
  let last = ''
  for (const r of rows) {
    if (last !== '' && last !== r.stage) console.log('')
    last = r.stage
    const note = r.bot === 'average' ? '  ' + verdict(r.clearRate) : ''
    console.log(
      r.stage.padEnd(13) + r.bot.padEnd(9) +
      pct(r.clearRate).padStart(7) +
      r.avgScore.toFixed(0).padStart(9) +
      r.avgArrows.toFixed(1).padStart(8) +
      pct(r.hitRate).padStart(10) +
      (r.avgHold.toFixed(2) + 's').padStart(8) +
      pct(r.noFullRate).padStart(8) +
      pct(r.collapseShotRate).padStart(10) +
      r.avgSeconds.toFixed(1).padStart(7) + note,
    )
  }
}

function summarize(rows: readonly Agg[]): void {
  console.log('')
  console.log('요약 — docs/BALANCE.md 목표 대비')
  const byStage = new Map<string, Map<BotKind, Agg>>()
  for (const r of rows) {
    let m = byStage.get(r.stage)
    if (m === undefined) {
      m = new Map<BotKind, Agg>()
      byStage.set(r.stage, m)
    }
    m.set(r.bot, r)
  }
  let prevAvg: number | null = null
  let totalHits = 0
  let avgSum = 0
  let avgCount = 0
  let gapOk = 0
  for (const [key, m] of byStage) {
    const nov = m.get('novice')
    const avg = m.get('average')
    const exp = m.get('expert')
    if (nov === undefined || avg === undefined || exp === undefined) continue
    totalHits += nov.avgHits + avg.avgHits + exp.avgHits
    avgSum += avg.clearRate
    avgCount++
    const gap = exp.clearRate - nov.clearRate
    if (gap >= GAP_LO && gap <= GAP_HI) gapOk++
    const gapNote = gap < GAP_LO ? '좁다(실력 개입 부족)' : gap > GAP_HI ? '넓다(초보 벽)' : 'OK'
    // 클리어율이 포화하면 난이도 신호가 죽는다. 그때는 한 발당 명중률이 유일한 실력 지표다.
    const easy = avg.clearRate > 0.95 ? ' — 95% 초과, 배우는 게 없다' : ''
    const drop =
      prevAvg === null || prevAvg - avg.clearRate <= 0.25 ? '' :
      `  / 직전 판 대비 ${((prevAvg - avg.clearRate) * 100).toFixed(1)}%p 하락 — 학습 곡선 가파름`
    console.log(
      `  ${key.padEnd(10)} average 클리어 ${pct(avg.clearRate).padStart(6)}` +
      ` (목표 55~75%: ${verdict(avg.clearRate)}${easy})${drop}`,
    )
    console.log(
      `  ${' '.repeat(10)} 한발 명중률 nov ${pct(nov.hitRate)} / avg ${pct(avg.hitRate)} / exp ${pct(exp.hitRate)}` +
      `   클리어율 격차 ${(gap * 100).toFixed(1)}%p (목표 30~50%p) ${gapNote}`,
    )
    prevAvg = avg.clearRate
  }
  if (avgCount > 0) {
    console.log('')
    console.log(
      `  챕터 평균 average 클리어 ${pct(avgSum / avgCount)} (목표 55~75%)` +
      `   격차 목표 달성 ${gapOk}/${avgCount}판`,
    )
  }
  if (totalHits < 0.05) {
    console.log('')
    console.log('  경고: 어떤 봇도 과녁을 맞히지 못했다.')
    console.log('  봇의 탄도 모델(항력 해석)이 sim 구현과 어긋났거나, 조준각 규약이 다를 수 있다.')
    console.log('  tools/balance-sim.ts 의 flightError() 를 sim/ballistics.ts 구현에 맞춰라.')
  }
}

function writeCsv(rows: readonly Agg[], args: Args): string {
  const out = fileURLToPath(new URL('./out/balance.csv', import.meta.url))
  mkdirSync(dirname(out), { recursive: true })
  const lines = [
    'stage,bot,runs,clear_rate,avg_score,avg_arrows,avg_hits,hit_rate,collapse_rate,' +
    'avg_hold_s,no_full_rate,collapse_shot_rate,avg_seconds,seed',
  ]
  for (const r of rows) {
    lines.push([
      r.stage, r.bot, String(r.runs),
      r.clearRate.toFixed(4), r.avgScore.toFixed(2), r.avgArrows.toFixed(3),
      r.avgHits.toFixed(3), r.hitRate.toFixed(4), r.collapseRate.toFixed(4),
      r.avgHold.toFixed(4), r.noFullRate.toFixed(4), r.collapseShotRate.toFixed(4),
      r.avgSeconds.toFixed(2), String(args.seed),
    ].join(','))
  }
  writeFileSync(out, lines.join('\n') + '\n', 'utf8')
  return out
}

// ───────────────────────── main ─────────────────────────

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const authored = args.preview ? [...REAL_STAGES, ...PREVIEW_STAGES] : REAL_STAGES
  // --floor=1 : 보유 화살이 바닥난 사람이 겪는 판. 여기서 클리어율이 무너지면 그 판은 벽이다.
  const stages: readonly StageRow[] = args.floor
    ? authored.map((row) => ({
        ...row,
        make: (seed: number): StageDef => {
          const d = row.make(seed)
          return { ...d, arrows: floorArrows(d) }
        },
      }))
    : authored
  const kinds: readonly BotKind[] = ['novice', 'average', 'expert']
  const groups = stages.length * kinds.length

  // 실행 시간을 예산 안에 묶는다. 먼저 짧게 재보고 반복 수를 정한다.
  const probeRow = stages[0]
  if (probeRow === undefined) throw new Error('스테이지가 없다')
  const t0 = Date.now()
  for (const k of kinds) playGroup(probeRow, k, args.seed ^ 0x1234, 2, 0)
  const perRun = Math.max((Date.now() - t0) / 6, 0.05)
  const affordable = Math.floor(args.budgetMs / (perRun * groups * 1.5))
  const runs = Math.max(20, Math.min(args.runs, affordable))

  console.log(`한 발 — 헤드리스 밸런스 시뮬`)
  console.log(`seed=${args.seed}  runs=${runs}/판  stages=${stages.length}  bots=${kinds.length}` +
    (runs < args.runs ? `  (시간 예산으로 ${args.runs} → ${runs} 축소)` : '') +
    (args.preview ? '  +미저작 챕터 프리뷰' : ''))
  console.log('')

  const rows: Agg[] = []
  const start = Date.now()
  for (let si = 0; si < stages.length; si++) {
    const row = stages[si]
    if (row === undefined) continue
    for (const k of kinds) rows.push(playGroup(row, k, args.seed, runs, si))
  }
  const elapsed = (Date.now() - start) / 1000

  printTable(rows)
  summarize(rows)
  const csv = writeCsv(rows, args)
  console.log('')
  console.log(`CSV: ${csv}`)
  console.log(`총 ${rows.length * runs}판 / ${elapsed.toFixed(1)}s`)
}

main()
