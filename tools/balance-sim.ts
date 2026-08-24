/**
 * 헤드리스 밸런스 시뮬 (ARCHITECTURE A7 / balance-lens의 유일한 근거)
 *
 * 봇 3종이 스테이지를 N판씩 자동 플레이하고 클리어율·점수·붕괴율·별·보상을 낸다.
 * "느낌상 쉬운 것 같다"를 숫자로 대체하는 게 이 파일의 존재 이유다.
 *
 * 실행: npm run balance -- --seed=12345 --runs=200
 *       npm run balance -- --floor=1      보유 화살이 바닥난 사람이 겪는 판
 *       npm run balance -- --preview=1    미저작 챕터(바람·이동·공중) 프리뷰
 *       npm run balance -- --arrow=burst  드래프트 화살을 하나로 고정해 전 판을 돌린다
 *       npm run balance -- --cross=0      화살 × 스테이지 교차표 끄기 (기본은 켜짐)
 *       npm run balance -- --crossbot=expert   교차표를 숙련 봇으로
 *
 * 봇은 **World를 읽어 InputFrame을 만드는 함수**일 뿐이다.
 * World를 직접 건드리면 측정값이 게임이 아니라 봇을 재는 게 되므로 절대 쓰지 않는다.
 *
 * ── 이 도구가 판정하는 것 (docs/HOOK.md 4장) ──
 *
 * 1. **드래프트 선택이 판의 결과를 실제로 바꾸는가.** 전부 비슷하면 선택이 장식이고,
 *    하나가 전 판에서 압도적이면 지배 전략이다. 둘 다 실패다. 교차표가 그걸 잰다.
 * 2. **별 1/2/3개 분포.** ★★★이 너무 흔하거나 너무 희귀하면 재도전 동기가 죽는다.
 * 3. **변동 보상의 분산이 실력을 덮지 않는가.** 같은 판에서 숙련과 초보의 훈련치 차이가
 *    **판 안 표준편차**보다 커야 성장이 한 판 단위로 느껴진다.
 *
 * 판정 문턱은 전부 이 파일 안에 상수로 있고(`STAR3_BAND`·`REWARD_D_OK`·`CROSS_*`),
 * 근거는 docs/BALANCE.md 1장에 적혀 있다. 문턱을 옮기려면 그쪽도 같이 고칠 것.
 *
 * ── 클리어 조건 (2026-08-23 변경) ──
 *
 * 클리어는 **과녁을 다 없앤 것**이다. 점수가 아니다 (`sim/world.ts` evaluateEnd).
 * 이 도구는 `w.status === 'cleared'`만 읽으므로 그 정의를 그대로 따른다.
 * `stage.targetScore`는 이제 클리어선이 아니라 **별 2개의 기준선**으로만 쓰인다.
 * 화살이 모자라 못 깨는 판을 잡기 위해 실패를 두 갈래(화살 소진 / 시간 초과)로 나눠 센다.
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
import { CAMPAIGN, STAGES as ALL_STAGES, getStage } from '../src/game/stages.ts'
import { ENDLESS_THEMES } from '../src/game/endless.ts'
import { grantArrows } from '../src/game/progression.ts'
import { defaultSave } from '../src/game/save.ts'
import { ARROW_KINDS, arrowFx, DEFAULT_ARROW, isArrowKindId } from '../src/game/arrows.ts'
import { BOW_KINDS, bowMods, DEFAULT_BOW, type BowKindId } from '../src/game/bows.ts'
import { evaluateUnlocks, progressOf, unlockedArrows, UNLOCKS } from '../src/game/unlocks.ts'
import { bullseyeAcc, gradeRun } from '../src/game/rewards.ts'
import { makeRng } from '../src/core/rng.ts'
import { clamp, clamp01, lerp } from '../src/core/math.ts'
import { P } from '../src/tune/params.ts'
import type { Rng } from '../src/core/rng.ts'
import type { ArrowKindId } from '../src/game/arrows.ts'
import type { RunStats } from '../src/game/rewards.ts'
import type { BowMods, InputFrame, StageDef, Stats, Target, World } from '../src/sim/types.ts'

// ───────────────────────── 실행 인자 ─────────────────────────

interface Args {
  seed: number
  runs: number
  budgetMs: number
  preview: boolean
  /** 보유 화살이 바닥났을 때의 지급량으로 돌린다 (progression.grantArrows). */
  floor: boolean
  /** 드래프트 화살 고정. null이면 아무것도 안 실어 보낸다(= 지금의 게임 기본 경로). */
  arrow: ArrowKindId | null
  /** 화살 × 스테이지 교차표를 돌린다. */
  cross: boolean
  /** 활 × 스테이지 교차표를 돌린다. */
  bows: boolean
  /** 교차표를 어느 봇으로 돌리는가. 봇 × 화살 × 40판은 너무 비싸다. */
  crossBot: BotKind
  /** 캠페인 모드로 돌릴 사람 수 (봇 종류마다). 0이면 건너뛴다. */
  campaign: number
  /**
   * 무한 구간(41판~)에서 표본으로 돌릴 판 수. 0이면 건너뛴다.
   * 기본값이 테마 한 바퀴인 이유: 한 바퀴를 돌면 열 테마가 정확히 한 번씩 나온다 (endless.ts).
   */
  endless: number
}

const BOT_KINDS: readonly BotKind[] = ['novice', 'average', 'expert']

function isBotKind(s: string): s is BotKind {
  for (const k of BOT_KINDS) if (k === s) return true
  return false
}

function parseArgs(argv: readonly string[]): Args {
  let seed = 20260823
  let runs = 200
  let budgetMs = 25000
  let preview = false
  let floor = false
  let arrow: ArrowKindId | null = null
  let cross = true
  let bows = true
  let crossBot: BotKind = 'average'
  // 캠페인(해금 페이싱). 한 사람이 1판부터 순서대로 도는 모드라 따로 시간을 먹는다.
  let campaign = 12
  let endless = ENDLESS_THEMES
  for (const a of argv) {
    const m = /^--([\w]+)=(.+)$/.exec(a)
    if (m === null) continue
    const key = m[1]
    const raw = m[2]
    if (key === undefined || raw === undefined) continue
    // 문자열 인자 먼저 — 숫자 파싱에 걸리면 안 된다.
    if (key === 'arrow') {
      if (raw === 'none' || raw === '') arrow = null
      else if (isArrowKindId(raw)) arrow = raw
      // 오타는 조용히 무시하지 않는다. 없는 화살로 40판을 돌고 "차이가 없다"고 보고하면 최악이다.
      else throw new Error(`알 수 없는 화살: ${raw} (가능: ${ARROW_IDS.join(' ')})`)
      continue
    }
    if (key === 'crossbot') {
      if (isBotKind(raw)) crossBot = raw
      continue
    }
    const v = Number(raw)
    if (!Number.isFinite(v)) continue
    if (key === 'seed') seed = Math.trunc(v)
    else if (key === 'runs') runs = Math.max(1, Math.trunc(v))
    else if (key === 'budget') budgetMs = Math.max(1000, Math.trunc(v * 1000))
    else if (key === 'preview') preview = v !== 0
    else if (key === 'floor') floor = v !== 0
    else if (key === 'cross') cross = v !== 0
    else if (key === 'bows') bows = v !== 0
    else if (key === 'campaign') campaign = Math.max(0, Math.trunc(v))
    else if (key === 'endless') endless = Math.max(0, Math.trunc(v))
  }
  return { seed, runs, budgetMs, preview, floor, arrow, cross, bows, crossBot, campaign, endless }
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

/**
 * 낙하 중인 공중 과녁이 있는가 — **연쇄가 아직 진행 중이다.**
 *
 * 화살과 같은 이유로 여기서도 기다려야 한다. 낙하물은 아래 과녁을 쓸어버리므로,
 * 이걸 안 기다리면 봇은 **몇 초 뒤 저절로 죽을 과녁**에 화살을 한 발 버린다.
 * 그리고 그 손해는 빨리 쏘는 봇일수록 커서, 챕터 2에서 expert의 발당 명중률이
 * novice보다 20%p 낮게 나왔다(실측). 게임이 아니라 봇의 성급함을 잰 값이다.
 * 사람은 보로로로록이 끝나는 걸 보고 다음을 정한다 (GDD 7장).
 */
function anyTargetFalling(w: World): boolean {
  const targets = w.targets
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]
    if (t !== undefined && t.alive && t.falling) return true
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
function flightError(
  dx: number, dy: number, angle: number, v: number, wind: number, dt: number, dragMul: number,
): number {
  const g = P.arrow.gravity
  // 화살 종류의 공기저항 배수까지 모델에 넣는다. 안 넣으면 무거운 살에서 세 봇이 똑같이
  // 빗나가 '화살이 나쁘다'가 아니라 '봇의 모델이 틀렸다'를 재게 된다.
  const drag = P.arrow.drag * dragMul
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
function solveAngle(
  dx: number, dy: number, v: number, wind: number, dt: number, dragMul: number,
): number {
  if (dx <= 0.05) return Math.atan2(dy, Math.max(dx, 0.05))
  let a0 = Math.atan2(dy, dx)
  let f0 = flightError(dx, dy, a0, v, wind, dt, dragMul)
  let a1 = a0 + 0.06
  let f1 = flightError(dx, dy, a1, v, wind, dt, dragMul)
  for (let i = 0; i < 6; i++) {
    const denom = f1 - f0
    if (Math.abs(denom) < 1e-9) break
    const a2 = clamp(a1 - (f1 * (a1 - a0)) / denom, -1.2, 1.45)
    a0 = a1
    f0 = f1
    a1 = a2
    f1 = flightError(dx, dy, a1, v, wind, dt, dragMul)
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

  /** 이 판에서 쓰는 화살의 공기저항 배수. 탄도 모델이 이걸 알아야 한다. */
  private readonly dragMul: number
  /** 활의 바람 배수 — 탄도 모델의 바람 항에 곱한다 (장궁 0.7). */
  private readonly bowWindMul: number

  constructor(kind: BotKind, seed: number, stats: Stats, arrow: ArrowKindId, bow?: BowMods) {
    const m = BOTS[kind]
    this.m = m
    this.rng = makeRng(seed)
    const fx = arrowFx(arrow)
    this.dragMul = fx.dragMul
    this.bowWindMul = bow?.windMul ?? 1
    // 봇은 항상 자기 한계(maxDraw)까지 당겨서 놓는다. 초보의 만작은 1.0이 아니라 0.74다 —
    // maxSpeed를 그대로 믿으면 모든 봇이 30% 빠른 화살을 가정해 일제히 못 미친다.
    // 활도 같은 이유로 모델에 넣는다: 장궁의 만작 페널티와 초속 배수를 모르면
    // 다섯 활이 똑같이 빗나가서 '활이 나쁘다'가 아니라 '봇이 틀렸다'를 재게 된다.
    const d = effectiveStats(stats)
    const maxDraw = clamp01(d.maxDraw + (bow?.maxDrawAdd ?? 0))
    const trueSpeed =
      lerp(P.bow.minSpeed, P.bow.maxSpeed, Math.pow(maxDraw, P.bow.drawCurve))
        * d.speedMul * fx.speedMul * (bow?.speedMul ?? 1)
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

    // 앞선 화살의 결과와 그 화살이 일으킨 연쇄가 끝나기 전에는 새로 잡지 않는다
    if (!this.cycleActive && (anyArrowInFlight(w) || anyTargetFalling(w))) {
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
    this.baseAngle = solveAngle(dx, dy, this.v, w.wind * this.m.windAware * this.bowWindMul, w.dt, this.dragMul)
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

// ───────────────────────── 활 × 스테이지 교차표 ─────────────────────────
//
// 활 검증 (docs/BOWS.md 2장). 화살과 판정이 다르다 — 화살은 판마다 갈아 끼우는 카드라
// "판을 바꾸는가"를 재지만, 활은 오래 드는 플레이스타일이라 잣대가 둘이다:
//   (a) **지배/함정 없음**: 어떤 활도 전 구간에서 최선·최악이면 안 된다. 특히 연습궁이
//       1등이면 업그레이드가 함정이고, 꼴찌 고정이면 시작 활이 벌이다.
//   (b) **클리어율 보존**: 어느 활을 들어도 클리어율이 연습궁 대비 크게 무너지면 안 된다.
//       활은 손맛의 변주지 난이도 스위치가 아니다 (빨간 바 계약은 활보다 세다).

/** 연습궁 대비 클리어율이 이만큼 내려가는 활은 벌이다. */
const BOW_CLEAR_DROP = 0.12

function printBows(
  stages: readonly StageRow[],
  bowIds: readonly BowKindId[],
  cells: ReadonlyArray<ReadonlyArray<CrossCell>>,
  bot: BotKind,
): void {
  console.log('')
  console.log(`활 × 스테이지 교차표 — 지배도 함정도 없는가 (봇 ${bot} · 숙련 0 · 목록 src/game/bows.ts)`)

  const n = stages.length
  const winsBy = new Map<string, number>()
  let identical = 0
  // 활별 평균 (전 판)
  const avgClear = bowIds.map(() => 0)
  const avgScore = bowIds.map(() => 0)
  const avgArrows = bowIds.map(() => 0)
  for (let si = 0; si < n; si++) {
    const row = cells[si]
    if (row === undefined) continue
    let bestI = 0
    let best = Number.NEGATIVE_INFINITY
    let allSame = true
    const first = row[0]
    for (let bi = 0; bi < row.length; bi++) {
      const c = row[bi]
      if (c === undefined) continue
      avgClear[bi] = (avgClear[bi] ?? 0) + c.clear
      avgScore[bi] = (avgScore[bi] ?? 0) + c.score
      avgArrows[bi] = (avgArrows[bi] ?? 0) + c.arrows
      if (first !== undefined && (c.score !== first.score || c.clear !== first.clear)) allSame = false
      if (c.score > best) {
        best = c.score
        bestI = bi
      }
    }
    if (allSame) identical++
    const w = bowIds[bestI]
    if (w !== undefined) winsBy.set(w, (winsBy.get(w) ?? 0) + 1)
  }

  const base = bowIds.indexOf(DEFAULT_BOW)
  const baseClear = (avgClear[base] ?? 0) / Math.max(n, 1)
  console.log('')
  console.log('  활'.padEnd(11) + '점수1등'.padStart(8) + '평균클리어'.padStart(11) + '평균점수'.padStart(9) + '화살소모'.padStart(9))
  for (let bi = 0; bi < bowIds.length; bi++) {
    const id = bowIds[bi]
    if (id === undefined) continue
    console.log(
      `  ${id.padEnd(9)}` +
      `${String(winsBy.get(id) ?? 0).padStart(5)}/${n}` +
      `${(((avgClear[bi] ?? 0) / n) * 100).toFixed(1).padStart(9)}%` +
      `${((avgScore[bi] ?? 0) / n).toFixed(0).padStart(9)}` +
      `${((avgArrows[bi] ?? 0) / n).toFixed(2).padStart(9)}`,
    )
  }

  console.log('')
  if (identical === n && bowIds.length > 1) {
    console.log('  ✗ 미배선 — 활을 바꿔도 결과가 완전히 같다. BowMods가 sim에 도달하지 않았다.')
    return
  }
  let bad = 0
  for (const [k, c] of winsBy) {
    if (c / n >= CROSS_DOMINANT) {
      bad++
      console.log(`  ✗ 지배 — '${k}'가 ${Math.round((c / n) * 100)}% 의 판에서 점수 1등이다.` +
        (k === DEFAULT_BOW ? ' 연습궁이 최선이면 활 수집이 통째로 함정이다.' : ' 나머지 활이 함정이 된다.'))
    }
  }
  for (let bi = 0; bi < bowIds.length; bi++) {
    const id = bowIds[bi]
    if (id === undefined) continue
    const clear = (avgClear[bi] ?? 0) / Math.max(n, 1)
    if (baseClear - clear > BOW_CLEAR_DROP) {
      bad++
      console.log(`  ✗ 벌 — '${id}' 평균 클리어율이 연습궁보다 ${((baseClear - clear) * 100).toFixed(0)}%p 낮다.` +
        ' 활은 손맛의 변주지 난이도 스위치가 아니다.')
    }
  }
  if (bad === 0) console.log('  ✓ 지배도 함정도 없다 — 활 선택이 취향으로 성립한다.')
}

// ══════════════════════ 드래프트 화살 배선 ══════════════════════
//
// 목록은 `src/game/arrows.ts`(화살 담당)에서 그대로 가져온다. 이 도구가 후보를 따로 들고 있으면
// 담당이 화살을 하나 지우거나 이름을 바꿨을 때 계측기만 옛 세상을 재게 된다.
//
// 고른 화살이 sim에 도달하는 경로는 **열려 있다**: `createWorld(stage, stats, arrow)`의
// 3번째 인자로 들어가고, sim/world.ts가 `World.arrowKind`·`World.fx`에 실어 ballistics·target이
// 매 스텝 읽는다 (효과 수치는 tune/params.ts의 `arrowkind` 그룹).
// 예전에 열려 있지 않던 시절의 폴백(`StageDef.arrow` 필드)은 무해하므로 그대로 둔다 —
// 두 경로가 다 막히면 교차표가 전부 같은 숫자가 되어 `printCross`가 '미배선'을 보고한다.
//
// **World를 여기서 직접 조작하지 않는다** — 그러면 게임이 아니라 이 파일을 재게 된다 (파일 상단 규칙).
// 다만 봇의 탄도 모델은 화살의 speedMul·dragMul을 알아야 한다. 모르면 세 봇이 똑같이 빗나가서
// '화살이 나쁘다'가 아니라 '봇의 모델이 틀렸다'를 재게 된다 (Bot 생성자 참조).

const ARROW_IDS: readonly ArrowKindId[] = ARROW_KINDS.map((k) => k.id)

function withArrow(def: StageDef, arrow: ArrowKindId): StageDef {
  return { ...def, arrow } as unknown as StageDef
}

function makeWorld(
  def: StageDef, stats: Stats, arrow: ArrowKindId | null, bow?: BowMods,
): World {
  if (arrow === null) return createWorld(def, stats, undefined, bow)
  return createWorld(withArrow(def, arrow), stats, arrow, bow)
}

// ══════════════════════ 별·보상 ══════════════════════
//
// 판정기는 `src/game/rewards.ts`의 `gradeRun(rng, stage, RunStats)` 하나뿐이다.
// 이 도구가 별·훈련치 공식을 따로 들고 있으면 "계측기에서는 통과, 게임에서는 실패"가 나온다.
//
// 이 도구가 채우는 `RunStats`의 해석 두 가지 — 어긋나면 보상 담당이 고쳐 잡을 것:
//   · `hits`     = 직격('hit') + 연쇄로 죽은 과녁('chain'). rewards.ts 주석이
//                  "관통·연쇄 때문에 shots보다 클 수 있다"고 적었으므로 연쇄분을 포함한다.
//   · `bestChain`= 판에서 도달한 최대 콤보(`World.combo`의 봉우리).

interface Grade {
  stars: number
  training: number
  bonus: number
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

/**
 * 보유 화살이 바닥났을 때 이 판에 실제로 지급되는 발수.
 * 공식을 여기 베끼지 않고 progression.grantArrows를 그대로 부른다 — 베끼면 언젠가 어긋난다.
 */
function floorArrows(def: StageDef): number {
  const d = defaultSave(0)
  d.arrows = 0
  return grantArrows(d, def)
}

/** 실제 콘텐츠. 밸런스 판정의 대상은 언제나 이쪽이다. */
const REAL_STAGES: readonly StageRow[] = ALL_STAGES.map((def, i) => ({
  key: def.id,
  stats: assumedStats(ALL_STAGES.length > 1 ? i / (ALL_STAGES.length - 1) : 0),
  make: (seed: number): StageDef => ({ ...def, seed }),
}))

/**
 * 무한 구간 표본 (41판~). 생성기가 굽는 판이라 **여기가 유일한 검사대**다 —
 * 손으로 적은 판이 아니어서 눈으로 훑을 목록이 없고, 사람이 도달하기까지 오래 걸린다.
 * 스탯은 다 자란 것으로 본다(assumedStats(1)) — 41판에 오는 사람은 40판을 지나온 사람이다.
 */
function endlessRows(n: number): readonly StageRow[] {
  const rows: StageRow[] = []
  for (let k = 0; k < n; k++) {
    const def = getStage(CAMPAIGN + k)
    rows.push({
      key: def.id,
      stats: assumedStats(1),
      make: (seed: number): StageDef => ({ ...def, seed }),
    })
  }
  return rows
}

/**
 * 아직 저작되지 않은 메커닉을 미리 재보는 프리뷰.
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
  /** 판이 끝난 시점의 잔여 화살. 0이면 빠듯했다는 뜻이다. */
  arrowsLeft: number
  collapsed: boolean
  /** 직격 명중 이벤트 수. 관통 한 발이 여럿을 치면 1발에 여러 번 오른다. */
  hits: number
  /** 연쇄로 죽은 과녁 수 */
  chains: number
  /** 이 판에서 도달한 최대 콤보 */
  maxCombo: number
  /** 정중앙(명중도 ≥ P.hit.bullseyeAcc) 명중 수 */
  bullseyes: number
  shots: number
  /** 무언가를 맞힌 발의 수. 관통·연쇄에 오염되지 않는 진짜 '발당 명중률'의 분자다. */
  hitShots: number
  /**
   * miss 이벤트 수. **게임(loop.ts)이 misses를 세는 축과 같은 축이다** — 이걸 안 쓰고
   * shots - hitShots 로 대신 만들면 시뮬이 게임과 다른 정의로 무손실을 채점하게 되어,
   * 화살 종류가 miss를 뱉는 방식이 틀려도 게이트가 한 번도 안 걸린다.
   */
  missEvents: number
  /** 남은 과녁 수 (실패 진단용) */
  targetsLeft: number
  /** 화살을 다 쓰고도 과녁이 남아 실패했는가 */
  failedByArrows: boolean
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

function playOne(
  def: StageDef,
  stats: Stats,
  kind: BotKind,
  botSeed: number,
  arrow: ArrowKindId | null,
  bow?: BowKindId,
): RunResult {
  // 숙련 0 기준으로 잰다 — 활의 소재 값이 문제인지 숙련 완화가 문제인지 섞이면 안 된다.
  const mods = bow === undefined ? undefined : bowMods(bow, arrow ?? DEFAULT_ARROW, 0)
  const w = makeWorld(def, stats, arrow, mods)
  const bot = new Bot(kind, botSeed, stats, arrow ?? DEFAULT_ARROW, mods)
  const hz = Math.round(1 / w.dt)
  const maxSteps = Math.ceil((def.timeLimit ?? 90) * hz) + 4 * hz

  let collapsed = false
  let hits = 0
  let chains = 0
  let maxCombo = 0
  let bullseyes = 0
  let shots = 0
  let hitShots = 0
  let missEvents = 0
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
    if (pendingHit) hitShots++
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
    if (w.combo > maxCombo) maxCombo = w.combo
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
        if (e.accuracy >= bullseyeAcc()) bullseyes++
        pendingHit = true
      } else if (e.t === 'chain') {
        chains++
      } else if (e.t === 'miss') {
        // 게임의 loop.ts와 같은 축. 여기서만 세야 무손실 판정이 시뮬과 게임에서 같아진다.
        missEvents++
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

  let targetsLeft = 0
  for (let i = 0; i < w.targets.length; i++) {
    const t = w.targets[i]
    if (t !== undefined && t.alive) targetsLeft++
  }
  const cleared = w.status === 'cleared'

  return {
    cleared,
    score: w.score,
    arrowsUsed: def.arrows - w.arrowsLeft,
    arrowsLeft: w.arrowsLeft,
    collapsed,
    hits,
    chains,
    maxCombo,
    bullseyes,
    shots,
    hitShots,
    missEvents,
    targetsLeft,
    // 시간 초과 실패와 구분한다. 이쪽이 "화살이 모자라 못 깬 판"이다.
    failedByArrows: !cleared && w.arrowsLeft <= 0,
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

// ───────────────────────── 별과 보상 ─────────────────────────

/**
 * 판 결과를 rewards.ts의 계약(`RunStats`)으로 옮긴다.
 * 재사용 객체 하나를 계속 덮어쓴다 — 판마다 새로 만들면 수만 판에서 GC가 측정 시간을 먹는다 (A5 정신).
 */
const runStats: RunStats = {
  cleared: false,
  score: 0,
  arrowsUsed: 0,
  arrowsGiven: 0,
  hits: 0,
  shots: 0,
  misses: 0,
  bestChain: 0,
  bullseyes: 0,
}

function grade(def: StageDef, r: RunResult, rng: Rng): Grade {
  runStats.cleared = r.cleared
  runStats.score = r.score
  runStats.arrowsUsed = r.arrowsUsed
  runStats.arrowsGiven = def.arrows
  // hits는 **화살이 직접 맞힌 수**(hit 이벤트)다. 관통·분열이 한 발로 여럿을 맞히면
  // shots를 넘고, rewards.ts는 그걸 '한 발에 여럿'으로 읽는다.
  // 연쇄로 딸려 죽은 과녁(chain)은 명중이 아니라 결과라 여기 넣지 않는다.
  runStats.hits = r.hits
  runStats.shots = r.shots
  // 무손실(★★★)의 근거. "아무것도 못 맞히고 사라진 화살"이 하나도 없는가.
  // **game/loop.ts와 같은 축(miss 이벤트 수)이어야 한다.** shots - hitShots 로 만들면
  // 시뮬이 게임과 다른 정의로 채점해, miss를 잘못 뱉는 화살이 게이트에 안 걸린다.
  runStats.misses = r.missEvents
  runStats.bestChain = r.maxCombo
  runStats.bullseyes = r.bullseyes
  const out = gradeRun(rng, def, runStats)
  return { stars: clamp(Math.round(out.stars), 0, 3), training: Math.floor(out.training), bonus: out.bonus }
}

// ───────────────────────── 집계 ─────────────────────────

interface Agg {
  stage: string
  bot: BotKind
  arrow: string
  runs: number
  clearRate: number
  avgScore: number
  avgArrows: number
  /** 판이 끝났을 때 남은 화살 평균. 0에 붙으면 화살이 병목이다. */
  avgSpare: number
  collapseRate: number
  avgHits: number
  /** 한 발당 명중률 — 무언가를 맞힌 발 / 쏜 발. 관통·연쇄로 100%를 넘지 않는다. */
  hitRate: number
  /** 판당 연쇄 킬 수 */
  avgChains: number
  /** 판당 최대 콤보의 평균 */
  avgMaxCombo: number
  /** 전 판을 통틀어 관측된 최대 콤보 */
  peakCombo: number
  /** 판당 정중앙 명중 수 */
  avgBullseyes: number
  /** 화살이 모자라 못 깬 판의 비율 */
  arrowStarveRate: number
  /** 실패한 판에서 남아 있던 과녁 수의 평균 */
  avgTargetsLeftOnFail: number
  /** 만작 후 평균 릴리즈 지연 (s). 새 활 모델의 건강도를 보는 1번 지표. */
  avgHold: number
  /** 만작에 못 닿고 나간 발의 비율 */
  noFullRate: number
  /** 붕괴로 나간 발의 비율 */
  collapseShotRate: number
  /** 판 평균 길이 (s). C1: 한 판 30초~1분 */
  avgSeconds: number

  // ── 별·보상 ──
  stars0: number
  stars1: number
  stars2: number
  stars3: number
  /** 훈련치 평균·표준편차·최대/최소 */
  trainSum: number
  trainSqSum: number
  trainMin: number
  trainMax: number
  /** 변동 보너스로 들어온 몫의 합. 전체 대비 비율이 "운의 지분"이다. */
  bonusSum: number
  /** 보너스가 터진 판 수 */
  bonusRuns: number
  /** 보너스를 뺀 훈련치(= 실력만의 몫). 운을 껐을 때의 분산을 재려고 따로 쌓는다. */
  baseSum: number
  baseSqSum: number
  /**
   * ★★★을 받았는데 **실제로는 아무것도 못 맞힌 발이 있었던** 판.
   * 별은 rewards.flawless() = (miss 이벤트 0)으로 붙고, 여기서는 **발 단위**(hitShots < shots)로
   * 따로 센다 — 축이 둘이라야 대조가 성립한다. 이 칸이 0이 아니면 '무손실'이 무손실이 아니다.
   */
  star3Miss: number

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

const trainMean = (a: Agg): number => (a.runs > 0 ? a.trainSum / a.runs : 0)
const trainSd = (a: Agg): number => {
  if (a.runs <= 1) return 0
  const m = trainMean(a)
  const v = a.trainSqSum / a.runs - m * m
  return v > 0 ? Math.sqrt(v) : 0
}

interface GroupOpts {
  arrow: ArrowKindId | null
  /** 활. 없으면 연습궁(중립). 궁합은 game/bows.ts의 bowMods가 (활, 살) 쌍으로 판정한다. */
  bow?: BowKindId
}

function playGroup(
  row: StageRow,
  kind: BotKind,
  baseSeed: number,
  runs: number,
  stageIdx: number,
  opts: GroupOpts,
): Agg {
  let cleared = 0
  let score = 0
  let arrows = 0
  let spare = 0
  let collapses = 0
  let hits = 0
  let chains = 0
  let comboSum = 0
  let peakCombo = 0
  let bullseyes = 0
  let starve = 0
  let leftOnFail = 0
  let fails = 0
  let shots = 0
  let hitShots = 0
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
  const starCount = [0, 0, 0, 0]
  let trainSum = 0
  let trainSqSum = 0
  let trainMin = Number.POSITIVE_INFINITY
  let trainMax = Number.NEGATIVE_INFINITY
  let bonusSum = 0
  let bonusRuns = 0
  let baseSum = 0
  let baseSqSum = 0
  let star3Miss = 0

  // 보상 rng는 판마다 새로 만들지 않고 하나를 이어 쓴다 — 판별 시드로 만들면
  // 잭팟이 시드 해시의 성질을 그대로 물려받아 분산 측정이 오염된다.
  const rewardRng = makeRng(mixSeed(baseSeed, stageIdx * 131, kind.length * 7 + 3))

  for (let i = 0; i < runs; i++) {
    // 스테이지 시드는 봇과 무관하게 같다 — 같은 판을 세 봇이 나눠 푼다
    const stageSeed = mixSeed(baseSeed, stageIdx, i)
    const botSeed = mixSeed(stageSeed, kind.length, i * 7 + 1)
    const def = row.make(stageSeed)
    const r = playOne(def, row.stats, kind, botSeed, opts.arrow, opts.bow)
    const g = grade(def, r, rewardRng)

    if (r.cleared) cleared++
    else {
      fails++
      leftOnFail += r.targetsLeft
      if (r.failedByArrows) starve++
    }
    if (r.collapsed) collapses++
    score += r.score
    arrows += r.arrowsUsed
    spare += r.arrowsLeft
    hits += r.hits
    chains += r.chains
    comboSum += r.maxCombo
    if (r.maxCombo > peakCombo) peakCombo = r.maxCombo
    bullseyes += r.bullseyes
    shots += r.shots
    hitShots += r.hitShots
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

    const s = clamp(g.stars, 0, 3)
    const slot = starCount[s]
    if (slot !== undefined) starCount[s] = slot + 1
    trainSum += g.training
    trainSqSum += g.training * g.training
    if (g.training < trainMin) trainMin = g.training
    if (g.training > trainMax) trainMax = g.training
    bonusSum += g.bonus
    if (g.bonus > 0) bonusRuns++
    const base = g.training - g.bonus
    baseSum += base
    baseSqSum += base * base
    // 별 3개인데 빗나간 화살이 있었다 = '무손실'이 무손실을 재지 못했다.
    // 두 축을 실제로 대조한다 — 별은 rewards.flawless(misses===0)가, 여기서는 발당 명중을 본다.
    if (s >= 3 && r.hitShots < r.shots) star3Miss++
  }
  return {
    stage: row.key,
    bot: kind,
    arrow: opts.arrow ?? '-',
    runs,
    clearRate: cleared / runs,
    avgScore: score / runs,
    avgArrows: arrows / runs,
    avgSpare: spare / runs,
    collapseRate: collapses / runs,
    avgHits: hits / runs,
    hitRate: shots > 0 ? hitShots / shots : 0,
    avgChains: chains / runs,
    avgMaxCombo: comboSum / runs,
    peakCombo,
    avgBullseyes: bullseyes / runs,
    arrowStarveRate: starve / runs,
    avgTargetsLeftOnFail: fails > 0 ? leftOnFail / fails : 0,
    avgHold: holdShots > 0 ? holdSum / holdShots : 0,
    noFullRate: shots > 0 ? noFull / shots : 0,
    collapseShotRate: shots > 0 ? collapseShots / shots : 0,
    avgSeconds: steps / runs / P.sim.hz,
    stars0: starCount[0] ?? 0,
    stars1: starCount[1] ?? 0,
    stars2: starCount[2] ?? 0,
    stars3: starCount[3] ?? 0,
    trainSum,
    trainSqSum,
    trainMin: Number.isFinite(trainMin) ? trainMin : 0,
    trainMax: Number.isFinite(trainMax) ? trainMax : 0,
    bonusSum,
    bonusRuns,
    baseSum,
    baseSqSum,
    star3Miss,
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
 *
 * 드래프트가 붙어도 이 목표는 그대로다 — 드래프트는 난이도 장치가 아니라 **변주 장치**다.
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
    'arrows'.padStart(7) + 'spare'.padStart(7) + 'hit/shot'.padStart(9) +
    'chain'.padStart(7) + 'combo'.padStart(7) +
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
      r.avgSpare.toFixed(1).padStart(7) +
      pct(r.hitRate).padStart(9) +
      r.avgChains.toFixed(1).padStart(7) +
      r.avgMaxCombo.toFixed(1).padStart(7) +
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
 * 봇별 안전 구간 지표 (전 판 합산).
 *
 * 이 표가 떨림 재설계의 검증이다. 봐야 할 것 두 가지:
 *   1. 안전 발의 각오차 RMS가 **정확히 0.000 mrad** — 안전 구간 안에서는 조준한 그대로 간다.
 *   2. 안전 명중률 − 넘김 명중률이 **크게 벌어진다** — 규율이 실제로 결과를 바꾼다.
 */
function printSafeZone(rows: readonly Agg[]): void {
  console.log('')
  console.log('안전 구간 지표 — 빨간 바(스태미나 55%) 위에서 쏘았는가 (전 판 합산)')
  console.log('  inSafe=안전 구간 안에서 쏜 비율 · hitSafe/hitOver=그 두 부류의 명중률 · errRMS=릴리즈 각오차')
  const head =
    '  bot'.padEnd(11) + 'shots'.padStart(7) + 'inSafe'.padStart(9) +
    'hitSafe'.padStart(9) + 'hitOver'.padStart(9) + 'gap'.padStart(9) +
    'errRMS(safe)'.padStart(14) + 'errRMS(over)'.padStart(14) +
    'overStrain'.padStart(12) + 'hold'.padStart(9) + 'collapse'.padStart(10)
  console.log(head)
  console.log('  ' + '-'.repeat(head.length))
  for (const k of BOT_KINDS) {
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

// ───────────────────────── 별 분포 ─────────────────────────

/**
 * 목표 (docs/HOOK.md 4장 — 재도전 동기).
 *   ★★ 이상이 흔하고 ★★★은 가끔. average 봇 기준으로 잡는다.
 *   ★★★이 흔하면 다시 할 이유가 없고, 희귀하면 아예 포기한다.
 */
const STAR3_BAND: readonly [number, number] = [0.05, 0.30]
const STAR2PLUS_MIN = 0.55

function printStars(rows: readonly Agg[]): void {
  console.log('')
  console.log('별 분포 — 재도전 동기 (판정기: src/game/rewards.ts starsOf)')
  console.log(`  목표: ★★ 이상 ≥ ${(STAR2PLUS_MIN * 100) | 0}% · ★★★ ${(STAR3_BAND[0] * 100) | 0}~${(STAR3_BAND[1] * 100) | 0}% (average 봇 기준)`)
  const head =
    '  bot'.padEnd(11) + 'runs'.padStart(8) + '☆(실패)'.padStart(11) +
    '★'.padStart(9) + '★★'.padStart(10) + '★★★'.padStart(11) + '★★이상'.padStart(11) + '  판정'
  console.log(head)
  console.log('  ' + '-'.repeat(head.length))
  let miss3 = 0
  let all3 = 0
  for (const k of BOT_KINDS) {
    let n = 0
    let s0 = 0
    let s1 = 0
    let s2 = 0
    let s3 = 0
    for (const r of rows) {
      if (r.bot !== k) continue
      n += r.runs
      s0 += r.stars0
      s1 += r.stars1
      s2 += r.stars2
      s3 += r.stars3
      miss3 += r.star3Miss
      all3 += r.stars3
    }
    if (n === 0) continue
    const r3 = s3 / n
    const r2p = (s2 + s3) / n
    const note =
      k !== 'average' ? '' :
      r3 < STAR3_BAND[0] ? '  ★★★ 너무 희귀 — 재도전 전에 포기한다' :
      r3 > STAR3_BAND[1] ? '  ★★★ 너무 흔함 — 다시 할 이유가 없다' :
      r2p < STAR2PLUS_MIN ? '  ★★가 드물다 — 기준선(targetScore)이 높다' : '  OK'
    console.log(
      ('  ' + k).padEnd(11) +
      String(n).padStart(8) +
      pct(s0 / n).padStart(11) +
      pct(s1 / n).padStart(9) +
      pct(s2 / n).padStart(10) +
      pct(r3).padStart(11) +
      pct(r2p).padStart(11) + note,
    )
  }
  // '무손실'의 정의 점검. 별은 rewards.flawless() = (misses === 0) = miss 이벤트 0 으로 붙는데,
  // 여기서는 **발 단위**로 '무언가를 맞히지 못한 발'이 있었는지를 따로 센다. 두 축이 어긋나면
  // 화살이 맞힌 게 하나도 없는 발을 두고도 무손실이 붙었다는 뜻이다.
  if (all3 > 0) {
    const bad = miss3 / all3
    console.log('')
    console.log(
      `  ★★★ 중 실제로 빗나간 발이 있었던 판 ${pct(bad)} (${miss3}/${all3})` +
      (bad > 0.02
        ? "  ✗ '무손실'이 무손실을 재지 못한다 — miss 이벤트는 0인데 아무것도 못 맞힌 발이 있었다"
        : '  OK'),
    )
  }
}

// ───────────────────────── 변동 보상 분산 ─────────────────────────

/**
 * 목표 (docs/HOOK.md 4장 — "운이 실력을 덮으면 안 된다").
 *
 * 판정 기준을 효과크기로 못 박는다: 숙련과 초보의 훈련치 기대값 차이를 **판 안 표준편차**로
 * 나눈 값 d = (E[exp] − E[nov]) / σ.
 *   d ≥ 1.0  실력이 운을 이긴다 (한 판만 봐도 대체로 숙련이 더 번다)
 *   d < 0.5  운이 실력을 덮는다 — 성장이 무의미해진다
 * 순서(exp > avg > nov)가 뒤집히면 그건 즉시 실패다.
 */
const REWARD_D_OK = 1.0
const REWARD_D_BAD = 0.5

function printRewards(rows: readonly Agg[]): void {
  console.log('')
  console.log('변동 보상 분산 — 운이 실력을 덮는가 (판정기: src/game/rewards.ts gradeRun)')
  const head =
    '  bot'.padEnd(11) + 'runs'.padStart(8) + '평균'.padStart(10) + '표준편차'.padStart(11) +
    'CV'.padStart(9) + '최소'.padStart(8) + '최대'.padStart(8) +
    '보너스판'.padStart(12) + '운의지분'.padStart(12)
  console.log(head)
  console.log('  ' + '-'.repeat(head.length))
  const mean: Record<string, number> = {}
  let sdPooled = 0
  let sdN = 0
  for (const k of BOT_KINDS) {
    let n = 0
    let sum = 0
    let sq = 0
    let lo = Number.POSITIVE_INFINITY
    let hi = Number.NEGATIVE_INFINITY
    let bonus = 0
    let bonusRuns = 0
    for (const r of rows) {
      if (r.bot !== k) continue
      n += r.runs
      sum += r.trainSum
      sq += r.trainSqSum
      bonus += r.bonusSum
      bonusRuns += r.bonusRuns
      if (r.trainMin < lo) lo = r.trainMin
      if (r.trainMax > hi) hi = r.trainMax
    }
    if (n === 0) continue
    const m = sum / n
    const varr = sq / n - m * m
    const sd = varr > 0 ? Math.sqrt(varr) : 0
    mean[k] = m
    sdPooled += sd
    sdN++
    console.log(
      ('  ' + k).padEnd(11) +
      String(n).padStart(8) +
      m.toFixed(2).padStart(10) +
      sd.toFixed(2).padStart(11) +
      (m > 0 ? (sd / m).toFixed(2) : '-').padStart(9) +
      String(Number.isFinite(lo) ? lo : 0).padStart(8) +
      String(Number.isFinite(hi) ? hi : 0).padStart(8) +
      pct(bonusRuns / n).padStart(12) +
      (sum > 0 ? pct(bonus / sum) : '-').padStart(12),
    )
  }
  const nov = mean['novice']
  const avg = mean['average']
  const exp = mean['expert']
  void sdPooled
  void sdN
  if (nov === undefined || avg === undefined || exp === undefined) return
  const ordered = exp > avg && avg > nov

  // ── 효과크기는 반드시 **판 안에서** 재야 한다 ──
  // 전 판을 한 통에 섞은 표준편차에는 "1-1은 원래 적게 주고 4-10은 원래 많이 준다"는
  // 스테이지 차이가 통째로 들어 있다. 그걸 운으로 세면 어떤 보상 설계도 d가 0.2로 나온다.
  // 플레이어가 실제로 겪는 비교는 "같은 판을 초보가 하면 vs 숙련이 하면"이므로 판 안 분산이 맞다.
  const withinSd = (pick: (a: Agg) => { sum: number; sq: number }): number => {
    let wn = 0
    let wv = 0
    for (const r of rows) {
      if (r.runs <= 0) continue
      const { sum, sq } = pick(r)
      const m = sum / r.runs
      const v = sq / r.runs - m * m
      wv += r.runs * (v > 0 ? v : 0)
      wn += r.runs
    }
    return wn > 0 ? Math.sqrt(wv / wn) : 0
  }
  const gapPerStage = (pick: (a: Agg) => number): number => {
    const byStage = new Map<string, Map<BotKind, number>>()
    for (const r of rows) {
      let m = byStage.get(r.stage)
      if (m === undefined) {
        m = new Map<BotKind, number>()
        byStage.set(r.stage, m)
      }
      m.set(r.bot, pick(r))
    }
    let sum = 0
    let n = 0
    for (const [, m] of byStage) {
      const a = m.get('novice')
      const b = m.get('expert')
      if (a === undefined || b === undefined) continue
      sum += b - a
      n++
    }
    return n > 0 ? sum / n : 0
  }

  const sdAll = withinSd((r) => ({ sum: r.trainSum, sq: r.trainSqSum }))
  const sdBase = withinSd((r) => ({ sum: r.baseSum, sq: r.baseSqSum }))
  const gapAll = gapPerStage((r) => (r.runs > 0 ? r.trainSum / r.runs : 0))
  const d = sdAll > 0 ? gapAll / sdAll : 0
  const d0 = sdBase > 0 ? gapAll / sdBase : 0

  console.log('')
  console.log(
    `  실력 순서 ${ordered ? 'OK' : '깨짐 — 운이 실력을 뒤집었다'}` +
    ` (nov ${nov.toFixed(2)} · avg ${avg.toFixed(2)} · exp ${exp.toFixed(2)})`,
  )
  console.log(
    `  판 안 표준편차 σ=${sdAll.toFixed(2)} (보너스 제외 ${sdBase.toFixed(2)})` +
    ` · 같은 판에서 exp−nov 평균 ${gapAll.toFixed(2)}`,
  )
  console.log(
    `  효과크기 d = ${d.toFixed(2)} (운을 끄면 ${d0.toFixed(2)})  ` +
    (d >= REWARD_D_OK ? 'OK — 한 판만 봐도 실력이 보인다'
      : d >= REWARD_D_BAD ? '경계 — 여러 판을 모아야 실력이 보인다'
      : '실패 — 운이 실력을 덮는다'),
  )
  if (d < REWARD_D_OK) {
    console.log(
      `    원인 분해: 실력 격차 자체가 ${gapAll.toFixed(2)}로 작다면 보상식이 실력을 안 읽는 것이고,` +
      ` σ(보너스 제외)=${sdBase.toFixed(2)}가 이미 크다면 판마다 점수가 흔들리는 것이다.`,
    )
  }
}

// ───────────────────────── 화살 × 스테이지 교차표 ─────────────────────────

/**
 * 드래프트 검증 (docs/HOOK.md 4장).
 *
 * 판정 규칙 세 가지. 하나라도 걸리면 선택은 아직 진짜가 아니다.
 *   (a) **미배선**: 화살을 바꿔도 결과가 비트 단위로 같다. 고른 게 sim에 도달하지 않았다.
 *   (b) **장식**: 판마다 화살 간 점수 폭이 거의 없다. 골라도 판이 안 바뀐다.
 *   (c) **지배 전략**: 한 화살이 거의 모든 판에서 1등이다. 나머지는 함정 선택지다.
 */
/** 판별 최고/최저 점수 비가 이 아래면 그 판에서는 화살이 결과를 안 바꾼 것으로 본다. */
const CROSS_FLAT_RATIO = 1.10
/** 이 비율 이상의 판에서 1등이면 지배 전략. */
const CROSS_DOMINANT = 0.60
/** 전체 판 중 이 비율 이상이 '평평'하면 장식. */
const CROSS_DECOR = 0.70

interface CrossCell {
  clear: number
  score: number
  arrows: number
  combo: number
  chains: number
}

function printCross(
  stages: readonly StageRow[],
  kinds: readonly string[],
  cells: ReadonlyArray<ReadonlyArray<CrossCell>>,
  bot: BotKind,
): void {
  console.log('')
  console.log(`화살 × 스테이지 교차표 — 드래프트가 판을 바꾸는가 (봇 ${bot} · 목록 src/game/arrows.ts)`)

  const w = 9
  const head = '  stage'.padEnd(10) + kinds.map((k) => k.slice(0, w - 1).padStart(w)).join('')
  const line = '  ' + '-'.repeat(head.length)

  const show = (title: string, pick: (c: CrossCell) => string): void => {
    console.log('')
    console.log('  ' + title)
    console.log(head)
    console.log(line)
    for (let si = 0; si < stages.length; si++) {
      const row = cells[si]
      const st = stages[si]
      if (row === undefined || st === undefined) continue
      console.log(
        ('  ' + st.key).padEnd(10) +
        row.map((c) => pick(c).padStart(w)).join(''),
      )
    }
  }

  show('클리어율', (c) => pct(c.clear))
  show('평균 점수', (c) => c.score.toFixed(0))
  show('평균 사용 화살', (c) => c.arrows.toFixed(1))
  show('최대 연쇄 (판당 최대 콤보 평균)', (c) => c.combo.toFixed(1))

  // ── 판정 ──
  const winsBy = new Map<string, number>()
  const bestStages = new Map<string, string[]>()
  /**
   * 화살을 가장 적게 쓴 화살. **점수만으로 줄을 세우면 폭발·분열이 영원히 0등이다** —
   * 둘은 점수를 깎는 대신 판을 빨리 정리하는 화살이라(딸려 죽은 과녁은 링 배수가 낮다),
   * 실제로 얻는 건 여벌 화살과 무손실이다. 그 축을 따로 세지 않으면 "장식"으로 오독한다.
   */
  const thriftBy = new Map<string, number>()
  let flat = 0
  let identical = 0
  let spreadSum = 0
  for (let si = 0; si < stages.length; si++) {
    const row = cells[si]
    const st = stages[si]
    if (row === undefined || st === undefined) continue
    let bestI = 0
    let best = Number.NEGATIVE_INFINITY
    let worst = Number.POSITIVE_INFINITY
    let thriftI = 0
    let thrift = Number.POSITIVE_INFINITY
    let allSame = true
    const first = row[0]
    for (let ki = 0; ki < row.length; ki++) {
      const c = row[ki]
      if (c === undefined) continue
      if (first !== undefined && (c.score !== first.score || c.clear !== first.clear || c.arrows !== first.arrows)) {
        allSame = false
      }
      if (c.score > best) {
        best = c.score
        bestI = ki
      }
      if (c.score < worst) worst = c.score
      // 0.05발 차이는 노이즈다. 확실히 적게 쓴 것만 1등으로 친다.
      if (c.arrows < thrift - 0.05) {
        thrift = c.arrows
        thriftI = ki
      }
    }
    const thrifty = kinds[thriftI]
    if (thrifty !== undefined) thriftBy.set(thrifty, (thriftBy.get(thrifty) ?? 0) + 1)
    if (allSame) identical++
    const ratio = worst > 0 ? best / worst : best > 0 ? Number.POSITIVE_INFINITY : 1
    spreadSum += Number.isFinite(ratio) ? ratio : CROSS_FLAT_RATIO
    if (Number.isFinite(ratio) && ratio < CROSS_FLAT_RATIO) flat++
    const winner = kinds[bestI]
    if (winner !== undefined) {
      winsBy.set(winner, (winsBy.get(winner) ?? 0) + 1)
      const lst = bestStages.get(winner)
      if (lst === undefined) bestStages.set(winner, [st.key])
      else if (lst.length < 8) lst.push(st.key)
    }
  }

  const n = stages.length
  console.log('')
  console.log('  판정')
  console.log(`    판별 최고/최저 점수 비 평균 ${(spreadSum / Math.max(n, 1)).toFixed(3)} ` +
    `· 평평한 판(비 < ${CROSS_FLAT_RATIO}) ${flat}/${n}`)
  for (const k of kinds) {
    const wcount = winsBy.get(k) ?? 0
    const tcount = thriftBy.get(k) ?? 0
    const where = bestStages.get(k)
    console.log(
      `    ${k.padEnd(9)} 점수1등 ${String(wcount).padStart(3)}/${n}  화살절약1등 ${String(tcount).padStart(3)}/${n}` +
      (where !== undefined && where.length > 0 ? `   강한 판: ${where.join(' ')}` : ''),
    )
  }

  console.log('')
  if (identical === n && kinds.length > 1) {
    console.log('  ✗ 미배선 — 화살을 바꿔도 결과가 완전히 같다.')
    console.log('    고른 화살이 sim에 도달하지 않았다. 이 도구는 두 경로를 시도한다:')
    console.log('      · createWorld(stage, stats, arrow)  3번째 인자')
    console.log('      · StageDef.arrow 필드')
    console.log('    화살 담당이 둘 중 하나를 열어주면 이 표가 즉시 살아난다.')
    return
  }
  let dominant: string | null = null
  for (const [k, c] of winsBy) if (c / n >= CROSS_DOMINANT) dominant = k
  if (dominant !== null) {
    console.log(`  ✗ 지배 전략 — '${dominant}'가 ${Math.round(((winsBy.get(dominant) ?? 0) / n) * 100)}% 의 판에서 1등이다.`)
    console.log('    나머지는 함정 선택지다. 3택이 사실상 1택이 된다.')
  } else if (flat / n >= CROSS_DECOR) {
    console.log(`  ✗ 장식 — ${Math.round((flat / n) * 100)}% 의 판에서 화살 간 차이가 ${CROSS_FLAT_RATIO}배 미만이다.`)
    console.log('    골라도 판이 안 바뀐다. 효과의 크기를 키우거나 판 배치를 화살에 맞춰 갈라야 한다.')
  } else {
    console.log('  ✓ 선택이 결과를 바꾼다 — 판마다 다른 화살이 1등이고, 지배 전략도 없다.')
  }
}

// ───────────────────────── 요약 ─────────────────────────

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
  let starve = 0
  const starveStages: string[] = []
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
    // 클리어 조건이 '과녁 전멸'로 바뀐 뒤의 새 실패 모드다: 쏠 화살이 없어서 못 깬 판.
    if (avg.arrowStarveRate > 0.05) {
      starve++
      if (starveStages.length < 12) starveStages.push(key)
      console.log(
        `  ${' '.repeat(10)} ⚠ 화살 소진 실패 ${pct(avg.arrowStarveRate)}` +
        ` · 남은 과녁 평균 ${avg.avgTargetsLeftOnFail.toFixed(1)} · 잔여 화살 ${avg.avgSpare.toFixed(1)}`,
      )
    }
    prevAvg = avg.clearRate
  }
  if (avgCount > 0) {
    console.log('')
    console.log(
      `  전체 평균 average 클리어 ${pct(avgSum / avgCount)} (1~10판 95%+ · 11~25판 90%+ · 26~40판 80~95%)` +
      `   격차 목표 달성 ${gapOk}/${avgCount}판`,
    )
    console.log(
      starve === 0
        ? '  화살이 모자라 못 깬 판: 없음 (전 판에서 5% 미만)'
        : `  화살이 모자라 못 깬 판: ${starve}판 — ${starveStages.join(' ')}`,
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
    'stage,bot,arrow,runs,clear_rate,avg_score,avg_arrows,avg_spare,avg_hits,hit_rate,' +
    'avg_chains,avg_max_combo,peak_combo,avg_bullseyes,arrow_starve_rate,targets_left_on_fail,' +
    'collapse_rate,avg_hold_s,no_full_rate,collapse_shot_rate,avg_seconds,' +
    'stars0,stars1,stars2,stars3,train_mean,train_sd,train_min,train_max,' +
    'shots,safe_shots,safe_rate,safe_hit_rate,over_shots,over_hit_rate,' +
    'safe_err_rms_mrad,over_err_rms_mrad,over_strain,seed',
  ]
  for (const r of rows) {
    const sRms = r.safeShots > 0 ? Math.sqrt(r.safeErrSq / r.safeShots) * 1000 : 0
    const oRms = r.overShots > 0 ? Math.sqrt(r.overErrSq / r.overShots) * 1000 : 0
    lines.push([
      r.stage, r.bot, r.arrow, String(r.runs),
      r.clearRate.toFixed(4), r.avgScore.toFixed(2), r.avgArrows.toFixed(3), r.avgSpare.toFixed(3),
      r.avgHits.toFixed(3), r.hitRate.toFixed(4),
      r.avgChains.toFixed(3), r.avgMaxCombo.toFixed(3), String(r.peakCombo), r.avgBullseyes.toFixed(3),
      r.arrowStarveRate.toFixed(4), r.avgTargetsLeftOnFail.toFixed(3),
      r.collapseRate.toFixed(4),
      r.avgHold.toFixed(4), r.noFullRate.toFixed(4), r.collapseShotRate.toFixed(4),
      r.avgSeconds.toFixed(2),
      String(r.stars0), String(r.stars1), String(r.stars2), String(r.stars3),
      trainMean(r).toFixed(3), trainSd(r).toFixed(3), String(r.trainMin), String(r.trainMax),
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

function writeCrossCsv(
  stages: readonly StageRow[],
  kinds: readonly string[],
  cells: ReadonlyArray<ReadonlyArray<CrossCell>>,
  bot: BotKind,
): string {
  const out = fileURLToPath(new URL('./out/balance-arrows.csv', import.meta.url))
  mkdirSync(dirname(out), { recursive: true })
  const lines = ['stage,arrow,bot,clear_rate,avg_score,avg_arrows,avg_max_combo,avg_chains']
  for (let si = 0; si < stages.length; si++) {
    const row = cells[si]
    const st = stages[si]
    if (row === undefined || st === undefined) continue
    for (let ki = 0; ki < kinds.length; ki++) {
      const c = row[ki]
      const k = kinds[ki]
      if (c === undefined || k === undefined) continue
      lines.push([
        st.key, k, bot,
        c.clear.toFixed(4), c.score.toFixed(2), c.arrows.toFixed(3),
        c.combo.toFixed(3), c.chains.toFixed(3),
      ].join(','))
    }
  }
  writeFileSync(out, lines.join('\n') + '\n', 'utf8')
  return out
}

// ───────────────────────── 캠페인 (해금 페이싱) ─────────────────────────
//
// 판마다 독립으로 재던 지금까지의 계측으로는 **누적 조건**(별 12개 · 누적 명중 60 · 무손실 15판)이
// 몇 판째에 열리는지 알 수 없었다. 여기서는 한 사람이 1판부터 순서대로 진행하며
// 드래프트 → 판 → 채점 → 해금 → (다음 판) 을 실제 모듈로 돌린다.
//
// 재는 것은 하나다: **조건이 플레이하다 저절로 지나가는가** (docs/HOOK.md ★2 · GDD C3).
// 갈아넣어야 열리는 칸이 있으면 그건 공부를 잡아먹는 구조다.

/** 한 사람이 최대 몇 판까지 시도하는가. 실패한 판은 다시 하므로 40보다 넉넉해야 한다. */
const CAMPAIGN_MAX_RUNS = 120

interface CampaignState {
  stars: Record<string, number>
  bestChain: number
  bullseyes: number
  totalHits: number
  perfectRuns: number
  bossKills: number
}

function playCampaign(seed: number, bot: BotKind): Map<string, number> {
  const st: CampaignState = { stars: {}, bestChain: 0, bullseyes: 0, totalHits: 0, perfectRuns: 0, bossKills: 0 }
  const unlocked: string[] = []
  const openedAt = new Map<string, number>()
  // 드래프트·보상용 스트림. 게임의 save.runSeed와 같은 자리다 (sim 스트림과 분리).
  const rng = makeRng(seed ^ 0x5eed1)
  let stageIndex = 0

  for (let run = 1; run <= CAMPAIGN_MAX_RUNS && stageIndex < ALL_STAGES.length; run++) {
    const def = ALL_STAGES[stageIndex]
    if (def === undefined) break

    // 3택. 어느 카드를 고를지는 모델링하지 않는다 — 사람이 무엇을 좋아하는지는
    // 이 도구가 답할 수 없는 질문이고, 균등 선택이 편향 없는 기준선이다.
    // 건너뛰기(기본 살)도 같은 확률로 넣는다.
    // 여정 구조(docs/RUN.md)에서 살통은 런 시작에 고른다. 캠페인 페이싱 추정에는
    // "해금된 것 중 아무거나 든다"로 충분하다 — 재는 건 화살이 아니라 해금 도달 판수다.
    const pool = unlockedArrows(unlocked)
    const pick = Math.floor(rng.next() * (pool.length + 1))
    const arrow: ArrowKindId = pool[pick] ?? DEFAULT_ARROW

    // 스탯은 판 진행도에 따라 오르는 것으로 가정한다 (REAL_STAGES와 같은 곡선).
    const stats = assumedStats(ALL_STAGES.length > 1 ? stageIndex / (ALL_STAGES.length - 1) : 0)
    const r = playOne(def, stats, bot, (seed ^ (run * 0x9e3779b9)) >>> 0, arrow)
    const g = grade(def, r, rng)

    const had = st.stars[def.id] ?? 0
    if (g.stars > had) st.stars[def.id] = g.stars
    if (r.maxCombo > st.bestChain) st.bestChain = r.maxCombo
    st.bullseyes += r.bullseyes
    st.totalHits += r.hits
    if (g.stars >= 3) st.perfectRuns++
    // 활 해금의 재료 — 보스판을 깼는가 (loop.ts finishRun과 같은 판정)
    if (r.cleared && def.targets.some((t) => t.kind === 'boss')) st.bossKills++

    const fresh = evaluateUnlocks(progressOf(st), unlocked)
    for (const id of fresh) {
      unlocked.push(id)
      openedAt.set(id, run)
    }

    if (r.cleared) stageIndex++
  }
  return openedAt
}

function printCampaign(seed: number, runs: number): void {
  console.log('')
  console.log('캠페인 — 해금이 몇 판째에 열리는가 (1판부터 순서대로, 실패하면 같은 판 재시도)')
  console.log('  조건은 플레이하다 저절로 지나가야 한다 (HOOK ★2 · GDD C3: 갈아넣게 만들지 않는다)')

  const rows = new Map<string, number[]>()
  for (const d of UNLOCKS) rows.set(d.id, [])
  for (const bot of BOT_KINDS) {
    for (let i = 0; i < runs; i++) {
      const opened = playCampaign((seed ^ (i * 0x1000193)) >>> 0, bot)
      for (const d of UNLOCKS) {
        const at = opened.get(d.id)
        rows.get(d.id)?.push(at ?? Number.POSITIVE_INFINITY)
      }
    }
  }

  const total = runs * BOT_KINDS.length
  console.log('')
  console.log('  해금                   조건                          열린 판(중앙값)   40판 안 달성')
  console.log('  ' + '-'.repeat(92))
  for (const d of UNLOCKS) {
    const xs = (rows.get(d.id) ?? []).slice().sort((a, b) => a - b)
    const mid = xs[Math.floor(xs.length / 2)] ?? Number.POSITIVE_INFINITY
    let within = 0
    for (const x of xs) if (x <= 40) within++
    const midText = Number.isFinite(mid) ? String(mid) : '—'
    console.log(
      `  ${d.label.padEnd(14)} ${d.hint.padEnd(28)} ${midText.padStart(10)}` +
      `      ${pct(within / Math.max(total, 1)).padStart(7)}` +
      (within / Math.max(total, 1) < 0.5 ? '  ✗ 너무 멀다' : ''),
    )
  }
}

// ───────────────────────── main ─────────────────────────

function applyFloor(rows: readonly StageRow[]): readonly StageRow[] {
  return rows.map((row) => ({
    ...row,
    make: (seed: number): StageDef => {
      const d = row.make(seed)
      return { ...d, arrows: floorArrows(d) }
    },
  }))
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))

  const authored: readonly StageRow[] = [
    ...REAL_STAGES,
    ...(args.endless > 0 ? endlessRows(args.endless) : []),
    ...(args.preview ? PREVIEW_STAGES : []),
  ]
  // --floor=1 : 보유 화살이 바닥난 사람이 겪는 판. 여기서 클리어율이 무너지면 그 판은 벽이다.
  const stages: readonly StageRow[] = args.floor ? applyFloor(authored) : authored
  const groups = stages.length * BOT_KINDS.length
  const opts: GroupOpts = { arrow: args.arrow }

  // 실행 시간을 예산 안에 묶는다. 먼저 짧게 재보고 반복 수를 정한다.
  const probeRow = stages[0]
  if (probeRow === undefined) throw new Error('스테이지가 없다')
  const t0 = Date.now()
  for (const k of BOT_KINDS) playGroup(probeRow, k, args.seed ^ 0x1234, 2, 0, opts)
  const perRun = Math.max((Date.now() - t0) / 6, 0.05)
  const affordable = Math.floor(args.budgetMs / (perRun * groups * 1.5))
  const runs = Math.max(20, Math.min(args.runs, affordable))

  console.log(`한 발 — 헤드리스 밸런스 시뮬`)
  console.log(`seed=${args.seed}  runs=${runs}/판  stages=${stages.length}  bots=${BOT_KINDS.length}` +
    (runs < args.runs ? `  (시간 예산으로 ${args.runs} → ${runs} 축소)` : '') +
    (args.preview ? '  +미저작 챕터 프리뷰' : '') +
    (args.floor ? '  +화살 바닥 지급' : '') +
    (args.arrow !== null ? `  화살 고정=${args.arrow}` : ''))
  console.log(`화살 목록: src/game/arrows.ts (${ARROW_IDS.join(' ')}) · 기본 ${DEFAULT_ARROW}` +
    `   보상 판정기: src/game/rewards.ts gradeRun`)
  console.log('클리어 조건 = 과녁 전멸 (sim/world.ts). targetScore는 별 2개 기준선으로만 쓴다.')
  console.log('')

  const rows: Agg[] = []
  const start = Date.now()
  for (let si = 0; si < stages.length; si++) {
    const row = stages[si]
    if (row === undefined) continue
    for (const k of BOT_KINDS) rows.push(playGroup(row, k, args.seed, runs, si, opts))
  }
  const elapsed = (Date.now() - start) / 1000

  printTable(rows)
  printSafeZone(rows)
  printStars(rows)
  printRewards(rows)
  summarize(rows)
  const csv = writeCsv(rows, args)
  console.log('')
  console.log(`CSV: ${csv}`)
  console.log(`총 ${rows.length * runs}판 / ${elapsed.toFixed(1)}s`)

  // ── 캠페인 (해금 페이싱) ──
  if (args.campaign > 0) printCampaign(args.seed, args.campaign)

  // ── 활 × 스테이지 교차표 (docs/BOWS.md) ──
  // 화살은 유엽전 고정(궁합 없음) — 활 소재의 값만 잰다. 궁합 검증은 화살 교차표를
  // --arrow=pierce --bows 로 다시 돌려서 본다.
  if (args.bows) {
    const bowIds: readonly BowKindId[] = BOW_KINDS.map((b) => b.id)
    const bowRuns = Math.max(20, Math.min(runs,
      Math.floor(args.budgetMs / (perRun * stages.length * bowIds.length * 1.5))))
    const bcells: CrossCell[][] = []
    const bt0 = Date.now()
    for (let si = 0; si < stages.length; si++) {
      const row = stages[si]
      if (row === undefined) continue
      const line: CrossCell[] = []
      for (const bowId of bowIds) {
        const a = playGroup(row, args.crossBot, args.seed, bowRuns, si, { arrow: args.arrow, bow: bowId })
        line.push({
          clear: a.clearRate,
          score: a.avgScore,
          arrows: a.avgArrows,
          combo: a.avgMaxCombo,
          chains: a.avgChains,
        })
      }
      bcells.push(line)
    }
    printBows(stages, bowIds, bcells, args.crossBot)
    console.log(`활 교차표 ${bowIds.length}종 × ${stages.length}판 × ${bowRuns}판 / ${((Date.now() - bt0) / 1000).toFixed(1)}s`)
  }

  // ── 화살 교차표 ──
  if (!args.cross) {
    console.log('')
    console.log('화살 × 스테이지 교차표: 건너뜀 (--cross=0)')
    return
  }

  const kinds = ARROW_IDS
  // 교차표는 한 봇으로만 돈다. 화살 × 스테이지 × 봇 3종은 예산을 통째로 먹는다.
  const crossRuns = Math.max(20, Math.min(runs, Math.floor((args.budgetMs / (perRun * stages.length * kinds.length * 1.5)))))
  const cells: CrossCell[][] = []
  const ct0 = Date.now()
  for (let si = 0; si < stages.length; si++) {
    const row = stages[si]
    if (row === undefined) continue
    const line: CrossCell[] = []
    for (const kindId of kinds) {
      // 화살 종류를 시드에 섞지 않는다 — 같은 판을 같은 조건에서 화살만 바꿔 비교해야
      // 차이가 화살의 것이지 난수의 것이 아니게 된다 (짝지은 비교).
      const a = playGroup(row, args.crossBot, args.seed, crossRuns, si, { arrow: kindId })
      line.push({
        clear: a.clearRate,
        score: a.avgScore,
        arrows: a.avgArrows,
        combo: a.avgMaxCombo,
        chains: a.avgChains,
      })
    }
    cells.push(line)
  }
  printCross(stages, kinds, cells, args.crossBot)
  const ccsv = writeCrossCsv(stages, kinds, cells, args.crossBot)
  console.log('')
  console.log(`교차표 CSV: ${ccsv}`)
  console.log(`화살 ${kinds.length}종 × ${stages.length}판 × ${crossRuns}판 = ${kinds.length * stages.length * crossRuns}판 / ${((Date.now() - ct0) / 1000).toFixed(1)}s`)
}

// 인자 오타는 스택 트레이스가 아니라 한 줄로 알려준다. 계측기가 겁을 주면 아무도 안 돌린다.
try {
  main()
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e))
  process.exitCode = 1
}
