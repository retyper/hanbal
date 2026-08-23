/**
 * 헤드리스 밸런스 시뮬 (ARCHITECTURE A7 / balance-lens의 유일한 근거)
 *
 * 봇 3종이 스테이지를 N판씩 자동 플레이하고 클리어율·점수·붕괴율을 낸다.
 * "느낌상 쉬운 것 같다"를 숫자로 대체하는 게 이 파일의 존재 이유다.
 *
 * 실행: npm run balance -- --seed=12345 --runs=200
 *       npm run balance -- --floor=1     보유 화살이 바닥난 사람이 겪는 판
 *       npm run balance -- --preview=1   미저작 챕터(바람·이동·공중) 프리뷰
 *
 * 봇은 **World를 읽어 InputFrame을 만드는 함수**일 뿐이다.
 * World를 직접 건드리면 측정값이 게임이 아니라 봇을 재는 게 되므로 절대 쓰지 않는다.
 *
 * ── 안전 구간 계측 (2026-08-23 떨림 재설계) ──
 *
 * 새 활 모델은 "스태미나가 빨간 바 위에 있으면 오차가 정확히 0"을 약속한다.
 * 이 도구는 그 약속이 지켜지는지를 매 발마다 잰다 — 발사 시점 `ArcherState.strain`이
 * 0이면 안전 발, 아니면 넘긴 발로 갈라 명중률과 각오차 RMS를 따로 집계한다.
 * 안전 발의 각오차 RMS가 0이 아니게 되는 순간 그건 sim의 회귀다.
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
// ── 떨림 재설계(2026-08-23) 이후 '실력'이란 무엇인가 ──
//
// 새 활 모델의 핵심: 스태미나가 빨간 바(P.stamina.steadyZone = 최대치의 55%) **위에 있는 동안
// 떨림도 발사 산포도 정확히 0이다.** 만작에서 그 안에 놓으면 조준한 자리에 그대로 맞는다.
// 아래로 내려간 만큼만 ArcherState.strain이 자라고 오차가 전부 여기 비례한다.
//
// 그래서 옛 봇의 전략("떨림 위상의 최소점을 노린다")은 통째로 무의미해졌다 —
// 안전 구간엔 읽을 위상 자체가 없다. 난이도의 축이 두 개로 갈렸다:
//
//   1. **조준 정확도** — 이제 이게 주된 축이다. 안전 구간 안에서는 명중/빗나감을
//      오직 봇의 조준 오차가 정한다. 그래서 조준 오차를 명시적 σ(rad)로 두고
//      두 가지 사람 단위로 같이 적는다:
//        · 30m 과녁에서 몇 cm 벗어나는가  = σ × 30m × 100
//        · 화면에서 몇 px 어긋나는가      ≈ σ × 뷰포트 폭(px)
//          (카메라가 사거리 전체를 화면 폭에 맞추므로 scale ≈ W/d, 즉 px 오차 ≈ σ×W.
//           1200px 기준. 사람은 마우스로 겨누므로 이 단위가 실제 사람 오차의 하한이다 —
//           마우스 1px ≈ 0.00083 rad. 이보다 정밀한 봇은 사람이 아니다.)
//   2. **릴리즈 규율** — 안전 구간 안에 놓았는가. 실제 초보는 확신이 안 서서 계속 겨누고,
//      그러다 바를 넘겨 떨리기 시작하면 더 못 쏜다. 망설임을 hold 계획으로,
//      "빨간 바를 보고 놓는 반응"을 strainBail로 모델링한다.
//
// 실측(assumedStats 기준): 만작 도달 0.36~0.38s, 만작 후 안전 구간 약 1.6s,
// 붕괴까지 약 4.2s. STAMINA를 올리면 안전 구간이 1.64s → 3.55s(스탯 25)까지 넓어진다.

type BotKind = 'novice' | 'average' | 'expert'

interface BotModel {
  /** 사이클 시작 순간의 조준 오차 σ (rad) */
  aimAcquire: number
  /** 아무리 오래 겨눠도 남는 조준 오차 σ (rad). **새 모델에서 실력의 주된 축.** */
  aimFloor: number
  /** 조준 수렴 시간상수 (s). 만작까지가 0.37s라 이 값이 "당기며 조준을 끝내는가"를 정한다. */
  aimTau: number
  /** 화살 초속 오판 비율. +면 빠르다고 착각 → 낮게 쏴서 못 미친다. */
  velBias: number
  /** 바람을 얼마나 읽는가 0..1 */
  windAware: number
  /** 이동 과녁 리드를 얼마나 맞추는가 0..1 */
  leadAware: number
  /** 평소 망설임: 만작 후 [holdLo, holdHi]에서 뽑은 시각에 놓는다 (s) */
  holdLo: number
  holdHi: number
  /** 이 확률로 "망설임 발작"이 나서 [lapseLo, lapseHi]에서 뽑는다 — 이게 바를 넘기는 경로다 */
  lapseChance: number
  lapseLo: number
  lapseHi: number
  /**
   * 규율: 감지한 strain이 이 값을 넘으면 계획과 무관하게 놓는다.
   * 0에 가까울수록 "빨간 바를 넘기지 않는다"는 규율이 강하다. 1이면 아예 신경 쓰지 않는다.
   */
  strainBail: number
  /** strain 인지 지연 (스텝). 넘긴 걸 즉시 알아채지 못한다. */
  reactSteps: number
  /** 만작 후 이 시간이 지나면 호흡정지를 쓴다. Infinity면 안 쓴다. */
  steadyAfter: number
  /**
   * 이 비율 이상 스태미나가 찰 때까지 쉰다.
   * 빨간 바가 0.55이므로 이 값이 안전 구간의 **폭**을 직접 정한다 —
   * 0.80에서 잡으면 만작 후 약 0.9초, 0.95에서 잡으면 약 1.5초가 남는다.
   */
  restFrac: number
  /** 붕괴 경고가 뜨면 즉시 놓는가 */
  bailsOnWarn: boolean
}

const BOTS: Readonly<Record<BotKind, BotModel>> = {
  /**
   * 초보. 조준 바닥 오차 σ=0.0075 rad = **30m에서 22.5cm**, 화면에서 약 9px.
   * 겨누는 데 오래 걸리고(tau 0.45s) 거리 감각이 없어(velBias 2%) 멀수록 못 미친다.
   *
   * 릴리즈 규율이 없다 — 확신이 안 서서 만작 후 0.4~3.8초를 끈다. 안전 구간이 약 1.1초라
   * 다섯 발 중 넷은 바를 넘기고, 가끔은 붕괴까지 간다. 넘긴 걸 알아채지도 못하고
   * (strainBail 1) 붕괴 경고도 무시한다(bailsOnWarn false).
   * 오래 끄는 만큼 조준은 더 붙지만 그 사이 떨림이 자라 결국 손해다 — 실제 초보가 그렇다.
   */
  novice: {
    aimAcquire: 0.040,
    aimFloor: 0.0075,
    aimTau: 0.45,
    velBias: 0.020,
    windAware: 0,
    leadAware: 0,
    holdLo: 0.40,
    holdHi: 3.80,
    lapseChance: 0,
    lapseLo: 0,
    lapseHi: 0,
    strainBail: 1,
    reactSteps: 0,
    steadyAfter: Number.POSITIVE_INFINITY,
    // 팔이 회복되기를 기다릴 줄 모른다. 안전 구간을 조금 깎아먹고 시작한다.
    restFrac: 0.85,
    bailsOnWarn: false,
  },
  /**
   * 보통. 조준 바닥 오차 σ=0.0050 rad = **30m에서 15cm**, 화면에서 약 6px.
   * 만작 전에 조준이 대체로 붙는다(tau 0.22s).
   *
   * 규율이 **계획에는 있고 반응에는 없다.** 평소엔 만작 후 0.15~0.85초에 놓아 안전 구간
   * 한복판이지만, 18% 확률로 망설임이 터져 1.6~3.2초까지 끈다. 망설이는 동안에는 바를
   * 보고 있지도 않아서(strainBail 0.9) 깊이 넘긴 채로 놓는다 — 사람이 실제로 그렇다.
   * 붕괴 경고가 뜨면 그때는 놓으므로 넘김의 깊이가 strain 0.69 근처에서 잘린다.
   */
  average: {
    aimAcquire: 0.028,
    aimFloor: 0.0050,
    aimTau: 0.22,
    velBias: 0.007,
    windAware: 0.6,
    leadAware: 0.6,
    holdLo: 0.15,
    holdHi: 0.85,
    lapseChance: 0.18,
    lapseLo: 1.60,
    lapseHi: 3.20,
    strainBail: 0.90,
    reactSteps: 8,
    steadyAfter: Number.POSITIVE_INFINITY,
    restFrac: 0.88,
    bailsOnWarn: true,
  },
  /**
   * 숙련. 조준 바닥 오차 σ=0.0036 rad = **30m에서 10.8cm**, 화면에서 약 4.3px.
   * 당기는 0.37초 안에 조준이 끝나고(tau 0.08) 거리 감각에 편향이 없다(velBias 0).
   *
   * 릴리즈 규율이 전부다 — 만작 직후 0.03~0.14초, 안전 구간(약 1.5초) 한참 안쪽에서 놓는다.
   * 팔이 거의 다 회복될 때까지(0.95) 기다렸다 잡으므로 여유가 최대다.
   *
   * lapseChance 4%: **"거의" 없다지 "절대" 없다가 아니다.** 이 4%가 있어야
   * "정확히 겨누는 사람이 바를 넘기면 얼마나 손해인가"를 측정할 표본이 생긴다 —
   * 조준 오차가 작을수록 떨림이 상대적으로 커지므로 숙련의 안전/넘김 격차가 가장 크다.
   *
   * 호흡정지는 세 봇 다 쓰지 않는다. GDD 6장이 호흡정지 활용을 챕터 8의 학습 목표로
   * 잡아 두었으므로, 챕터 1~3을 재는 봇이 그걸 쓰면 측정 대상이 어긋난다.
   * 새 모델에서는 더 그렇다 — 안전 구간 안에서는 이미 오차가 0이라 누를 이유가 없다.
   */
  expert: {
    aimAcquire: 0.020,
    aimFloor: 0.0036,
    aimTau: 0.08,
    velBias: 0,
    windAware: 1,
    leadAware: 1,
    holdLo: 0.03,
    holdHi: 0.14,
    lapseChance: 0.04,
    lapseLo: 1.60,
    lapseHi: 2.80,
    strainBail: 0.90,
    reactSteps: 2,
    steadyAfter: Number.POSITIVE_INFINITY,
    restFrac: 0.95,
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
/** strain 인지 지연 버퍼 길이. reactSteps 상한이자 고정 할당 크기 (A5). */
const STRAIN_HIST = 16

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
  /** strain 인지 지연용 링버퍼. 생성자에서 한 번만 잡는다 (A5). */
  private readonly hist = new Float64Array(STRAIN_HIST)
  private histIdx = 0

  /** 탄도해가 준 기준 발사각 (rad). 조준 오차는 여기 얹는다. */
  private baseAngle = 0
  /** 사이클 시작 순간의 조준 오차 (rad) */
  private aimStart = 0
  /** 수렴이 끝나도 남는 조준 오차 (rad) */
  private aimEnd = 0
  /** 이번 사이클에서 겨눈 시간 (s). 조준 수렴의 유일한 입력. */
  private aimAge = 0
  /** 이번 사이클에 만작 후 참기로 한 시간 (s). 안전 구간(약 1.6s)보다 길면 바를 넘긴다. */
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
    // strain은 만작 전에도 자란다(지친 팔로 잡으면 즉시). 그래서 phase와 무관하게 기록한다.
    this.pushStrain(a.strain)

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
    // 망설임. lapse가 터진 사이클이 바를 넘기는 경로다 — 규율은 확률적으로 무너진다.
    const m = this.m
    this.plannedHold = this.rng.chance(m.lapseChance)
      ? this.rng.range(m.lapseLo, m.lapseHi)
      : this.rng.range(m.holdLo, m.holdHi)
    this.sinceAim = AIM_UPDATE_STEPS
    // 지난 사이클의 strain 기억은 버린다. 안 그러면 첫 스텝에 남의 값으로 놓는다.
    this.hist.fill(0)
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

  private pushStrain(strain: number): void {
    this.hist[this.histIdx] = strain
    this.histIdx = (this.histIdx + 1) % STRAIN_HIST
  }

  /** reactSteps 전에 **본** strain. 지금 값이 아니다 — 사람은 본 것을 즉시 못 놓는다. */
  private seenStrain(): number {
    const i = (this.histIdx - 1 - this.m.reactSteps + STRAIN_HIST * 2) % STRAIN_HIST
    const v = this.hist[i]
    return v === undefined ? 0 : v
  }

  private shouldRelease(holdTime: number, warn: number): boolean {
    const m = this.m
    // 붕괴 직전에 버티는 건 실력이 아니라 사고다
    if (m.bailsOnWarn && warn > 0) return true
    // 빨간 바를 넘긴 걸 알아챘다. 규율이 강한 봇일수록 문턱이 낮다.
    if (this.seenStrain() >= m.strainBail) return true
    return holdTime >= this.plannedHold
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

  // ── 안전 구간 계측 (떨림 재설계의 핵심 지표) ──
  // 발사 시점 strain == 0 이면 "안전 구간 안에서 쏜 발"이다. 그 발의 각오차는 정의상 정확히 0이고,
  // 명중/빗나감을 오직 조준이 정한다. 넘겨서 쏜 발과 명중률을 나눠 재는 게 이 계측의 목적이다.
  safeShots: number
  safeHits: number
  /** 안전 발의 릴리즈 각오차 제곱합 (rad²). 새 모델이 맞다면 정확히 0이어야 한다. */
  safeErrSq: number
  overShots: number
  overHits: number
  overErrSq: number
  /** 넘긴 발들의 strain 합. 얼마나 깊이 넘겼는가. */
  overStrainSum: number
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
  let safeShots = 0
  let safeHits = 0
  let safeErrSq = 0
  let overShots = 0
  let overHits = 0
  let overErrSq = 0
  let overStrainSum = 0
  // 이번 사이클이 만작에 닿았는가. release가 뜰 때 이걸 보고 '만작 실패'를 가른다.
  let reachedFull = false
  let collapsedThisShot = false
  // 결과를 기다리는 발. 봇은 화살이 날아가는 동안 다음 발을 잡지 않으므로 발은 항상 한 발씩
  // 직렬이고, 'hit' 이벤트는 언제나 **가장 최근 release**의 것이다.
  let pendingSafe = false
  let pendingErr = 0
  let pendingStrain = 0
  let pendingHit = false
  let pendingOpen = false

  const closeShot = (): void => {
    if (!pendingOpen) return
    pendingOpen = false
    if (pendingSafe) {
      safeShots++
      if (pendingHit) safeHits++
      safeErrSq += pendingErr * pendingErr
    } else {
      overShots++
      if (pendingHit) overHits++
      overErrSq += pendingErr * pendingErr
      overStrainSum += pendingStrain
    }
  }

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
        pendingHit = true
      } else if (e.t === 'release') {
        closeShot()
        shots++
        if (collapsedThisShot) collapseShots++
        if (reachedFull) {
          holdSum += prevHold + w.dt
          holdShots++
        } else {
          noFullShots++
        }
        // stepArcher는 strain을 갱신한 **뒤** 발사한다. 스텝이 끝난 지금 값이 곧 발사 시점 값이다.
        pendingStrain = w.archer.strain
        pendingSafe = pendingStrain <= 0
        pendingErr = e.err
        pendingHit = false
        pendingOpen = true
        reachedFull = false
        collapsedThisShot = false
      }
    }
    // 소비자 계약: 읽었으면 비운다
    events.length = 0
  }
  closeShot()

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
    safeShots,
    safeHits,
    safeErrSq,
    overShots,
    overHits,
    overErrSq,
    overStrainSum,
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

  // ── 안전 구간 지표 ──
  /** 총 발수 (안전 + 넘김) */
  shots: number
  safeShots: number
  safeHits: number
  safeErrSq: number
  overShots: number
  overHits: number
  overErrSq: number
  overStrainSum: number
}

/** 안전 구간 안에서 쏜 비율. 릴리즈 규율의 직접 측정값. */
const safeRate = (a: Agg): number => (a.shots > 0 ? a.safeShots / a.shots : 0)
/** 안전 구간 안에서 쏜 발의 명중률 */
const safeHitRate = (a: Agg): number => (a.safeShots > 0 ? a.safeHits / a.safeShots : 0)
/** 빨간 바를 넘겨서 쏜 발의 명중률. 위와의 차이가 새 설계가 작동한다는 증거다. */
const overHitRate = (a: Agg): number => (a.overShots > 0 ? a.overHits / a.overShots : 0)

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
  let safeShots = 0
  let safeHits = 0
  let safeErrSq = 0
  let overShots = 0
  let overHits = 0
  let overErrSq = 0
  let overStrainSum = 0
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
    safeShots += r.safeShots
    safeHits += r.safeHits
    safeErrSq += r.safeErrSq
    overShots += r.overShots
    overHits += r.overHits
    overErrSq += r.overErrSq
    overStrainSum += r.overStrainSum
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
    shots,
    safeShots,
    safeHits,
    safeErrSq,
    overShots,
    overHits,
    overErrSq,
    overStrainSum,
  }
}

// ───────────────────────── 출력 ─────────────────────────

/**
 * 클리어율 목표 — 2026-08-23 전면 개정.
 *
 * 사용자 피드백: "과녁이 너무 작아서 어려운데. 수십단계까지는 쉽게 갈 수 있게 해줘야지."
 *
 * 옛 목표는 판을 가리지 않고 55~75%였고, 그걸 맞추려다 3판부터 과녁이 화면 반경 4px이 됐다.
 * 봇은 각오차로만 조준해서 그걸 못 느끼지만 사람은 화면 픽셀로 조준한다 —
 * **봇 클리어율은 애초에 사람의 체감 난이도를 재는 자가 아니었다.**
 *
 * 이 게임은 공부 사이에 30초씩 하는 게임이다. 앞의 수십 판은 실력을 시험하는 구간이 아니라
 * 손에 익히고 성장을 체감하는 구간이다. 그래서 판 번호에 따라 목표가 다르다.
 * (src/game/stages.ts 헤더의 난이도 정책과 반드시 같이 읽을 것.)
 */
function targetBand(stageNo: number): readonly [number, number] {
  if (stageNo <= 10) return [0.95, 1.0]
  if (stageNo <= 25) return [0.90, 1.0]
  if (stageNo <= 40) return [0.80, 0.95]
  // 41판 이후(무한 모드·후반 챕터)에서만 실력을 가른다.
  return [0.55, 0.75]
}

/**
 * 실력 격차 목표도 판에 따라 다르다. 앞 40판에서 격차가 0인 건 **정상**이다 —
 * 초보도 고수도 다 깨야 하는 구간이기 때문이다. 여기서 격차를 만들려 들면 과녁이 다시 작아진다.
 */
function gapBand(stageNo: number): readonly [number, number] {
  return stageNo <= 40 ? [0, 0.25] : [0.30, 0.50]
}

const pct = (v: number): string => (v * 100).toFixed(1) + '%'

/** 스테이지 id('3-4') -> 통산 판 번호(24). 목표 구간이 판 번호에 따라 다르다. */
function stageNoOf(id: string): number {
  const m = /^(\d+)-(\d+)$/.exec(id)
  if (m === null) return 1
  return (Number(m[1]) - 1) * 10 + Number(m[2])
}

function verdict(rate: number, stageNo: number): string {
  const [lo, hi] = targetBand(stageNo)
  if (rate < lo) return `LOW  ${((rate - lo) * 100).toFixed(1)}%p — 여기서 막히면 안 된다`
  if (rate > hi) return `HIGH +${((rate - hi) * 100).toFixed(1)}%p`
  return 'OK'
}

function printTable(rows: readonly Agg[]): void {
  const head =
    'stage'.padEnd(13) + 'bot'.padEnd(9) + 'clear'.padStart(7) + 'score'.padStart(8) +
    'arrows'.padStart(7) + 'hit/shot'.padStart(9) +
    'inSafe'.padStart(8) + 'hitSafe'.padStart(9) + 'hitOver'.padStart(9) +
    'hold'.padStart(7) + 'collapse'.padStart(9) + 'sec'.padStart(6) + '  vs목표'
  console.log(head)
  console.log('-'.repeat(head.length + 4))
  let last = ''
  for (const r of rows) {
    if (last !== '' && last !== r.stage) console.log('')
    last = r.stage
    const note = r.bot === 'average' ? '  ' + verdict(r.clearRate, stageNoOf(r.stage)) : ''
    // 표본이 없으면 비율 대신 '-'. 0.0%로 찍으면 "다 빗나갔다"로 오독된다.
    const sh = r.safeShots > 0 ? pct(safeHitRate(r)) : '-'
    const oh = r.overShots > 0 ? pct(overHitRate(r)) : '-'
    console.log(
      r.stage.padEnd(13) + r.bot.padEnd(9) +
      pct(r.clearRate).padStart(7) +
      r.avgScore.toFixed(0).padStart(8) +
      r.avgArrows.toFixed(1).padStart(7) +
      pct(r.hitRate).padStart(9) +
      pct(safeRate(r)).padStart(8) +
      sh.padStart(9) +
      oh.padStart(9) +
      (r.avgHold.toFixed(2) + 's').padStart(7) +
      pct(r.collapseShotRate).padStart(9) +
      r.avgSeconds.toFixed(1).padStart(6) + note,
    )
  }
}

/**
 * 봇별 안전 구간 지표 (챕터 전체 합산).
 *
 * 이 표가 떨림 재설계의 검증이다. 봐야 할 것 두 가지:
 *   1. 안전 발의 각오차 RMS가 **정확히 0.000 mrad** — 안전 구간 안에서는 조준한 그대로 간다.
 *   2. 안전 명중률 − 넘김 명중률이 **크게 벌어진다** — 규율이 실제로 결과를 바꾼다.
 */
function printSafeZone(rows: readonly Agg[]): void {
  const kinds: readonly BotKind[] = ['novice', 'average', 'expert']
  console.log('')
  console.log('안전 구간 지표 — 빨간 바(스태미나 55%) 위에서 쏘았는가 (챕터 전체 합산)')
  console.log('  inSafe=안전 구간 안에서 쏜 비율 · hitSafe/hitOver=그 두 부류의 명중률 · errRMS=릴리즈 각오차')
  const head =
    '  bot'.padEnd(11) + 'shots'.padStart(7) + 'inSafe'.padStart(9) +
    'hitSafe'.padStart(9) + 'hitOver'.padStart(9) + 'gap'.padStart(9) +
    'errRMS(safe)'.padStart(14) + 'errRMS(over)'.padStart(14) +
    'overStrain'.padStart(12) + 'hold'.padStart(9) + 'collapse'.padStart(10)
  console.log(head)
  console.log('  ' + '-'.repeat(head.length))
  for (const k of kinds) {
    let t: Agg | null = null
    for (const r of rows) {
      if (r.bot !== k) continue
      if (t === null) {
        t = { ...r, stage: 'ALL' }
        continue
      }
      t.shots += r.shots
      t.safeShots += r.safeShots
      t.safeHits += r.safeHits
      t.safeErrSq += r.safeErrSq
      t.overShots += r.overShots
      t.overHits += r.overHits
      t.overErrSq += r.overErrSq
      t.overStrainSum += r.overStrainSum
      // hold·collapse는 판별 평균의 평균으로 충분하다 — 판마다 발수가 비슷하다.
      t.avgHold = (t.avgHold + r.avgHold) / 2
      t.collapseShotRate = (t.collapseShotRate + r.collapseShotRate) / 2
    }
    if (t === null) continue
    const sHit = safeHitRate(t)
    const oHit = overHitRate(t)
    // mrad = rad × 1000. 사람이 읽을 수 있는 자리수로.
    const sRms = t.safeShots > 0 ? Math.sqrt(t.safeErrSq / t.safeShots) * 1000 : 0
    const oRms = t.overShots > 0 ? Math.sqrt(t.overErrSq / t.overShots) * 1000 : 0
    const strain = t.overShots > 0 ? t.overStrainSum / t.overShots : 0
    const gap = t.safeShots > 0 && t.overShots > 0
      ? ((sHit - oHit) * 100).toFixed(1) + '%p' : '-'
    console.log(
      ('  ' + k).padEnd(11) +
      String(t.shots).padStart(7) +
      pct(safeRate(t)).padStart(9) +
      (t.safeShots > 0 ? pct(sHit) : '-').padStart(9) +
      (t.overShots > 0 ? pct(oHit) : '-').padStart(9) +
      gap.padStart(9) +
      (sRms.toFixed(3) + 'mrad').padStart(14) +
      (oRms.toFixed(3) + 'mrad').padStart(14) +
      strain.toFixed(2).padStart(12) +
      (t.avgHold.toFixed(2) + 's').padStart(9) +
      pct(t.collapseShotRate).padStart(10),
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
    const stageNo = avgCount
    const [gLo, gHi] = gapBand(stageNo)
    const [tLo, tHi] = targetBand(stageNo)
    const gap = exp.clearRate - nov.clearRate
    if (gap >= gLo && gap <= gHi) gapOk++
    const gapNote = gap < gLo ? '좁다(실력 개입 부족)' : gap > gHi ? '넓다(초보 벽)' : 'OK'
    const drop =
      prevAvg === null || prevAvg - avg.clearRate <= 0.25 ? '' :
      `  / 직전 판 대비 ${((prevAvg - avg.clearRate) * 100).toFixed(1)}%p 하락 — 학습 곡선 가파름`
    console.log(
      `  ${key.padEnd(10)} average 클리어 ${pct(avg.clearRate).padStart(6)}` +
      ` (목표 ${(tLo * 100) | 0}~${(tHi * 100) | 0}%: ${verdict(avg.clearRate, stageNo)})${drop}`,
    )
    console.log(
      `  ${' '.repeat(10)} 발당 명중 nov ${pct(nov.hitRate)} / avg ${pct(avg.hitRate)} / exp ${pct(exp.hitRate)}` +
      `   클리어율 격차 ${(gap * 100).toFixed(1)}%p (목표 ${(gLo * 100) | 0}~${(gHi * 100) | 0}%p) ${gapNote}`,
    )
    prevAvg = avg.clearRate
  }
  if (avgCount > 0) {
    console.log('')
    console.log(
      `  전체 평균 average 클리어 ${pct(avgSum / avgCount)} (1~10판 95%+ · 11~25판 90%+ · 26~40판 80~95%)` +
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
    'avg_hold_s,no_full_rate,collapse_shot_rate,avg_seconds,' +
    'shots,safe_shots,safe_rate,safe_hit_rate,over_shots,over_hit_rate,' +
    'safe_err_rms_mrad,over_err_rms_mrad,over_strain,seed',
  ]
  for (const r of rows) {
    const sRms = r.safeShots > 0 ? Math.sqrt(r.safeErrSq / r.safeShots) * 1000 : 0
    const oRms = r.overShots > 0 ? Math.sqrt(r.overErrSq / r.overShots) * 1000 : 0
    lines.push([
      r.stage, r.bot, String(r.runs),
      r.clearRate.toFixed(4), r.avgScore.toFixed(2), r.avgArrows.toFixed(3),
      r.avgHits.toFixed(3), r.hitRate.toFixed(4), r.collapseRate.toFixed(4),
      r.avgHold.toFixed(4), r.noFullRate.toFixed(4), r.collapseShotRate.toFixed(4),
      r.avgSeconds.toFixed(2),
      String(r.shots), String(r.safeShots), safeRate(r).toFixed(4), safeHitRate(r).toFixed(4),
      String(r.overShots), overHitRate(r).toFixed(4),
      sRms.toFixed(4), oRms.toFixed(4),
      (r.overShots > 0 ? r.overStrainSum / r.overShots : 0).toFixed(4),
      String(args.seed),
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
  printSafeZone(rows)
  summarize(rows)
  const csv = writeCsv(rows, args)
  console.log('')
  console.log(`CSV: ${csv}`)
  console.log(`총 ${rows.length * runs}판 / ${elapsed.toFixed(1)}s`)
}

main()
