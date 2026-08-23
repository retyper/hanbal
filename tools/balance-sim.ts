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
import { makeRng } from '../src/core/rng.ts'
import { clamp } from '../src/core/math.ts'
import { P } from '../src/tune/params.ts'
import type { Rng } from '../src/core/rng.ts'
import type { InputFrame, StageDef, Stats, Target, World } from '../src/sim/types.ts'

// ───────────────────────── 실행 인자 ─────────────────────────

interface Args {
  seed: number
  runs: number
  budgetMs: number
  preview: boolean
}

function parseArgs(argv: readonly string[]): Args {
  let seed = 20260823
  let runs = 200
  let budgetMs = 25000
  let preview = false
  for (const a of argv) {
    const m = /^--(\w+)=(-?[\d.]+)$/.exec(a)
    if (m === null) continue
    const v = Number(m[2])
    if (!Number.isFinite(v)) continue
    if (m[1] === 'seed') seed = Math.trunc(v)
    else if (m[1] === 'runs') runs = Math.max(1, Math.trunc(v))
    else if (m[1] === 'budget') budgetMs = Math.max(1000, Math.trunc(v * 1000))
    else if (m[1] === 'preview') preview = v !== 0
  }
  return { seed, runs, budgetMs, preview }
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

type BotKind = 'novice' | 'average' | 'expert'

interface BotModel {
  /** 조준각에 더해지는 가우시안 오차 (rad) */
  aimErr: number
  /** 바람을 얼마나 읽는가 0..1 */
  windAware: number
  /** 이동 과녁 리드를 얼마나 맞추는가 0..1 */
  leadAware: number
  /** 릴리즈 판정: |tremorOffset| <= 이 비율 × tremorAmp 이면 놓는다 */
  phaseTol: number
  /** 떨림 극소점(위상이 중앙을 지나는 순간)을 노리는가 */
  readsPhase: boolean
  /** 만작 후 무작정 기다리는 시간 범위 (s). novice 전용 */
  blindHold: readonly [number, number]
  /** 이 시간이 지나면 무조건 놓는다 (s) */
  maxHold: number
  /** 호흡정지를 쓰기 시작하는 만작 경과 시간 (s). Infinity면 안 씀 */
  steadyAfter: number
  /** 이 비율 이상 스태미나가 찰 때까지 쉰다 */
  restFrac: number
  /** 붕괴 경고가 뜨면 즉시 놓는가 */
  bailsOnWarn: boolean
}

const BOTS: Readonly<Record<BotKind, BotModel>> = {
  // 떨림 위상을 못 읽는다. 만작만 하면 아무 때나 놓는다.
  novice: {
    aimErr: 0.030,
    windAware: 0,
    leadAware: 0,
    phaseTol: Number.POSITIVE_INFINITY,
    readsPhase: false,
    blindHold: [0.05, 1.2],
    maxHold: 2.4,
    steadyAfter: Number.POSITIVE_INFINITY,
    restFrac: 0.45,
    bailsOnWarn: false,
  },
  // 떨림이 작아지는 쪽으로 절반쯤 맞춰 놓는다.
  average: {
    aimErr: 0.012,
    windAware: 0.5,
    leadAware: 0.5,
    phaseTol: 0.5,
    readsPhase: false,
    blindHold: [0.2, 0.2],
    maxHold: 1.8,
    steadyAfter: 0.35,
    restFrac: 0.6,
    bailsOnWarn: true,
  },
  // |tremorOffset|이 극소가 되는 순간을 노린다. 조준도 정확.
  expert: {
    aimErr: 0.0035,
    windAware: 1,
    leadAware: 1,
    phaseTol: 0.18,
    readsPhase: true,
    blindHold: [0.08, 0.08],
    maxHold: 2.0,
    steadyAfter: 0.1,
    restFrac: 0.8,
    bailsOnWarn: true,
  },
}

/** 조준을 다시 푸는 간격 (스텝). 매 스텝 탄도해를 다시 풀면 시뮬이 느려진다. */
const AIM_UPDATE_STEPS = 8
/** 릴리즈 후 시위를 다시 잡기까지 (스텝) */
const RELEASE_COOLDOWN = 10

// ───────────────────────── 탄도 해 ─────────────────────────
//
// 봇이 들고 있는 "화살이 이렇게 날 것이다"라는 모델. sim 구현이 아니라 봇의 추정이다.
// 항력은 a = -drag·|v_rel|·v_rel (params.ts arrow.drag 를 가속도 계수로 본 모델).
// 모델이 sim과 어긋나면 모든 봇이 똑같이 빗나가므로, 결과 요약에서 경고를 띄운다.

const MODEL_DT = 1 / 60
const MODEL_MAX_STEPS = 400

/** 주어진 발사각으로 쐈을 때 목표 x에서의 높이 오차. 양수면 너무 높이 쐈다. */
function flightError(dx: number, dy: number, angle: number, v: number, wind: number): number {
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
    vx += -drag * sp * rvx * MODEL_DT
    vy += (-drag * sp * vy - g) * MODEL_DT
    x += vx * MODEL_DT
    y += vy * MODEL_DT
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
function solveAngle(dx: number, dy: number, v: number, wind: number): number {
  if (dx <= 0.05) return Math.atan2(dy, Math.max(dx, 0.05))
  let a0 = Math.atan2(dy, dx)
  let f0 = flightError(dx, dy, a0, v, wind)
  let a1 = a0 + 0.06
  let f1 = flightError(dx, dy, a1, v, wind)
  for (let i = 0; i < 6; i++) {
    const denom = f1 - f0
    if (Math.abs(denom) < 1e-9) break
    const a2 = clamp(a1 - (f1 * (a1 - a0)) / denom, -1.2, 1.45)
    a0 = a1
    f0 = f1
    a1 = a2
    f1 = flightError(dx, dy, a1, v, wind)
    if (Math.abs(f1) < 0.01) break
  }
  return a1
}

// ───────────────────────── 봇 ─────────────────────────

class Bot {
  private readonly m: BotModel
  private readonly rng: Rng
  private readonly v: number
  private readonly out: InputFrame = { aimX: 0, aimY: 0, drawing: false, steady: false }

  /** 이번 사이클의 조준 오차 (한 발 동안 유지된다. 매 스텝 흔들면 릴리즈 판단이 무의미해진다) */
  private aimErr = 0
  /** novice가 이번 사이클에 참을 시간 (s) */
  private plannedHold = 0
  private cooldown = 0
  private sinceAim = AIM_UPDATE_STEPS
  private cycleActive = false
  private prevAbs = Number.POSITIVE_INFINITY
  private prevPrevAbs = Number.POSITIVE_INFINITY

  constructor(kind: BotKind, seed: number, stats: Stats) {
    const m = BOTS[kind]
    this.m = m
    this.rng = makeRng(seed)
    // 만작에서 나가는 초속. 봇은 항상 만작에서 놓는다.
    this.v = P.bow.maxSpeed * effectiveStats(stats).speedMul
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

    if (a.phase === 'idle' || a.phase === 'recovering') {
      this.cycleActive = false
      // 회복이 덜 됐으면 쉰다. 지쳐서 쏘면 붕괴로 판을 버린다.
      if (a.stamina < this.m.restFrac * a.staminaMax) {
        o.drawing = false
        o.steady = false
        return o
      }
    }

    if (!this.cycleActive) {
      this.startCycle()
      this.updateAim(w)
    } else if (this.sinceAim >= AIM_UPDATE_STEPS) {
      this.updateAim(w)
    }
    this.sinceAim++

    if (a.phase === 'collapsing') {
      o.drawing = false
      o.steady = false
      this.cooldown = RELEASE_COOLDOWN
      this.cycleActive = false
      return o
    }

    const full = a.phase === 'full'
    o.steady = full && a.holdTime >= this.m.steadyAfter
    o.drawing = !(full && this.shouldRelease(w))
    if (!o.drawing) {
      this.cooldown = RELEASE_COOLDOWN
      this.cycleActive = false
      o.steady = false
    }
    return o
  }

  private startCycle(): void {
    this.cycleActive = true
    this.aimErr = this.rng.gaussian() * this.m.aimErr
    this.plannedHold = this.rng.range(this.m.blindHold[0], this.m.blindHold[1])
    this.prevAbs = Number.POSITIVE_INFINITY
    this.prevPrevAbs = Number.POSITIVE_INFINITY
    this.sinceAim = AIM_UPDATE_STEPS
  }

  /** 살아 있는 과녁 중 가장 가까운 것. 가까운 것부터 확실히 챙기는 게 클리어에 유리하다. */
  private pickTarget(w: World): Target | null {
    let best: Target | null = null
    let bestD = Number.POSITIVE_INFINITY
    for (const t of w.targets) {
      if (!t.alive) continue
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

  private updateAim(w: World): void {
    this.sinceAim = 0
    const t = this.pickTarget(w)
    const o = this.out
    if (t === null) {
      o.aimX = w.archer.x + 10
      o.aimY = w.archer.y
      return
    }
    let dx = t.x - w.archer.x
    let dy = t.y - w.archer.y
    // 리드 샷: 화살이 도달할 때쯤 과녁이 어디 있을지. 실력이 낮을수록 덜 맞춘다.
    const tof = Math.sqrt(dx * dx + dy * dy) / Math.max(this.v, 1)
    dx += t.vx * tof * this.m.leadAware
    dy += t.vy * tof * this.m.leadAware
    // 바람도 봇이 아는 만큼만 모델에 넣는다.
    const angle = solveAngle(dx, dy, this.v, w.wind * this.m.windAware) + this.aimErr
    o.aimX = w.archer.x + Math.cos(angle) * 10
    o.aimY = w.archer.y + Math.sin(angle) * 10
  }

  private shouldRelease(w: World): boolean {
    const a = w.archer
    if (a.holdTime >= this.m.maxHold) return true
    // 붕괴 직전에 버티는 건 실력이 아니라 사고다
    if (this.m.bailsOnWarn && a.warn > 0) return true
    // 위상을 못 읽는 봇(novice)은 계획한 시간이 지나면 그냥 놓는다
    if (!Number.isFinite(this.m.phaseTol)) return a.holdTime >= this.plannedHold
    // 만작 직후 0초 릴리즈는 사람이 못 한다. 최소 홀드를 준다.
    if (a.holdTime < this.plannedHold) return false
    const abs = Math.abs(a.tremorOffset)
    const amp = Math.max(a.tremorAmp, 1e-9)
    const ratio = abs / amp
    let release = ratio <= this.m.phaseTol
    if (this.m.readsPhase && !release) {
      // 극소점 통과 감지: 줄다가 늘기 시작한 순간이 위상이 중앙을 지난 직후다
      release = this.prevAbs < this.prevPrevAbs && abs > this.prevAbs && ratio <= 0.5
    }
    this.prevPrevAbs = this.prevAbs
    this.prevAbs = abs
    return release
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
      id: 'pv-wind', seed, arrows: 7, targetScore: 150, wind: 5,
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
      id: 'pv-moving', seed, arrows: 7, targetScore: 150, wind: 0,
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
      id: 'pv-aerial', seed, arrows: 7, targetScore: 200, wind: 2,
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

  while (w.status === 'playing' && steps < maxSteps) {
    step(w, bot.frame(w))
    steps++
    for (const e of w.events) {
      if (e.t === 'collapse') collapsed = true
      else if (e.t === 'hit') hits++
      else if (e.t === 'release') shots++
    }
    // 소비자 계약: 읽었으면 비운다
    w.events.length = 0
  }

  return {
    cleared: w.status === 'cleared',
    score: w.score,
    arrowsUsed: def.arrows - w.arrowsLeft,
    collapsed,
    hits,
    shots,
    steps,
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
}

function playGroup(row: StageRow, kind: BotKind, baseSeed: number, runs: number, stageIdx: number): Agg {
  let cleared = 0
  let score = 0
  let arrows = 0
  let collapses = 0
  let hits = 0
  let shots = 0
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
    'arrows'.padStart(8) + 'hit/shot'.padStart(10) + 'collapse'.padStart(10) + '  vs목표'
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
      pct(r.collapseRate).padStart(10) + note,
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
  for (const [key, m] of byStage) {
    const nov = m.get('novice')
    const avg = m.get('average')
    const exp = m.get('expert')
    if (nov === undefined || avg === undefined || exp === undefined) continue
    totalHits += nov.avgHits + avg.avgHits + exp.avgHits
    const gap = exp.clearRate - nov.clearRate
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
    'stage,bot,runs,clear_rate,avg_score,avg_arrows,avg_hits,hit_rate,collapse_rate,seed',
  ]
  for (const r of rows) {
    lines.push([
      r.stage, r.bot, String(r.runs),
      r.clearRate.toFixed(4), r.avgScore.toFixed(2), r.avgArrows.toFixed(3),
      r.avgHits.toFixed(3), r.hitRate.toFixed(4), r.collapseRate.toFixed(4), String(args.seed),
    ].join(','))
  }
  writeFileSync(out, lines.join('\n') + '\n', 'utf8')
  return out
}

// ───────────────────────── main ─────────────────────────

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const stages = args.preview ? [...REAL_STAGES, ...PREVIEW_STAGES] : REAL_STAGES
  const kinds: readonly BotKind[] = ['novice', 'average', 'expert']
  const groups = stages.length * kinds.length

  // 실행 시간을 30초 안에 묶는다. 먼저 짧게 재보고 반복 수를 정한다.
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
