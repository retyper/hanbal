/**
 * 활 — 당김 · 떨림 · 호흡정지 · 붕괴 · 릴리즈
 *
 * 이 파일이 게임의 심장이다. GDD 2장: "놓는 순간이 전부다."
 * 떨림(tremor)의 위상이 그대로 발사각에 들어간다. UI 장치 없이 물리만으로
 * "흔들림이 중앙을 지날 때 놓기"라는 실력이 자연 발생하게 만드는 게 목적이다.
 *
 * 시간축은 오직 w.dt 누적. Date.now / performance.now 금지 (ARCHITECTURE A1).
 * 손맛 숫자는 전부 P (tune/params.ts). 이 파일에 매직넘버는 없다 (A2).
 */
import type { DerivedStats, InputFrame, Stats, World } from './types.ts'
import { P } from '../tune/params.ts'
import { clamp, clamp01, diminish, lerp, smoothstep, valueNoise } from '../core/math.ts'
import { spawnArrow } from './ballistics.ts'

/**
 * 떨림 노이즈의 두 옥타브 시드.
 * 손맛 노브가 아니라 파형의 신원(identity)이다 — 바꾸면 값이 세지는 게 아니라 다른 파형이 나온다.
 * w.rng를 쓰지 않는 이유: 매 스텝 rng를 소비하면 같은 시드라도 발사 횟수에 따라
 * 난수 스트림이 어긋나 결정론이 깨진다 (A1).
 */
const SEED_SLOW = 0x51ed27
const SEED_FAST = 0x7f4a3b

// ─────────────────────── 파생 계수 (프레임당 할당 0) ───────────────────────
//
// 매 스텝 DerivedStats 객체를 만들면 A5(핫 루프 힙 할당 0)를 어긴다.
// 그래서 모듈 스칼라에 풀어놓고 쓴다. 값을 캐시하지 않고 매 스텝 다시 푸는 이유는
// 라이브 튜닝 콘솔이 P.growth를 런타임에 덮어쓰기 때문 — 캐시하면 슬라이더가 안 먹는다.

let dSpeedMul = 1
let dDrawTimeMul = 1
let dTremorMul = 1
let dStaminaMax = 0
let dSteadyMul = 1
/**
 * 릴리즈 산포 배수 (FOCUS). DerivedStats에는 넣지 않는다 —
 * 계약을 늘리지 않고 bow 내부에서만 쓰면 되는 값이라 모듈 스칼라로 둔다.
 */
let dScatterMul = 1
/**
 * 이 궁수가 도달할 수 있는 최대 당김 (0..1). STR로 열린다.
 * 초보는 1.0(진짜 만작)에 못 간다 — GDD 2장 "시위가 안 당겨진다".
 */
let dMaxDraw = 1

/** 수확체감을 거친 스탯 레벨. GDD 4장: 초반 급성장, 후반 완만. */
function eff(level: number): number {
  return diminish(level > 0 ? level : 0, P.growth.diminishAt, P.growth.diminishRate)
}

function computeDerived(stats: Stats): void {
  const str = eff(stats.str)
  const steady = eff(stats.steady)
  const stam = eff(stats.stamina)
  const focus = eff(stats.focus)

  dSpeedMul = 1 + str * P.growth.strToSpeed
  // 감소 계수는 1/(1+x) 꼴로 만든다. (1 - level*rate)로 쓰면 고레벨에서 음수가 되어
  // 만작 시간과 떨림 부호가 뒤집힌다.
  dDrawTimeMul = 1 / (1 + str * P.growth.strToDrawTime)
  dTremorMul = 1 / (1 + steady * P.growth.steadyToTremor)
  dStaminaMax = P.stamina.max * (1 + stam * P.growth.staminaToMax)
  dSteadyMul = 1 + focus * P.growth.focusToSteady
  // GDD 4장 FOCUS의 두 번째 효과 "릴리즈 관용 창". 떨림이 아니라 난수 산포를 좁힌다.
  dScatterMul = 1 / (1 + focus * P.growth.focusToScatter)
  dMaxDraw = clamp01(P.bow.maxDrawBase + str * P.growth.strToMaxDraw)
}

/** 스탯(레벨) → 물리 계수. UI·성장 화면용. 핫 루프에서는 쓰지 말 것(객체를 만든다). */
export function effectiveStats(stats: Stats): DerivedStats {
  computeDerived(stats)
  return {
    speedMul: dSpeedMul,
    drawTimeMul: dDrawTimeMul,
    tremorMul: dTremorMul,
    staminaMax: dStaminaMax,
    steadyMul: dSteadyMul,
    maxDraw: dMaxDraw,
  }
}

/**
 * 예고 없는 붕괴 금지 (feel-lens 자동 반려 항목).
 * 최소 경고 시간만큼도 못 버틸 스태미나로는 애초에 시위를 잡지 못한다.
 * 잡게 두면 누른 즉시 붕괴 → 화살 한 발이 예고 없이 증발한다 = "게임이 나를 배신했다".
 */
function canStartDraw(stamina: number): boolean {
  return stamina > P.stamina.drawDrain * P.stamina.collapseWarnMinTime
}

// ─────────────────────────────── 한 스텝 ───────────────────────────────

export function stepArcher(w: World, input: InputFrame): void {
  const a = w.archer
  const dt = w.dt
  computeDerived(w.stats)

  // 조준은 스무딩 없이 즉시 반영한다. 한 스텝이라도 늦으면 조준이 미끄러진다 (feel-lens 1).
  a.aimAngle = Math.atan2(input.aimY - a.y, input.aimX - a.x)

  // 노이즈의 유일한 시간축. 항상 흐른다 — 발사 때마다 같은 위상에서 시작하면 파형이 외워진다.
  a.tremorPhase += dt

  a.staminaMax = dStaminaMax
  if (a.stamina > dStaminaMax) a.stamina = dStaminaMax

  // 놓은 뒤에는 버튼을 한 번 떼야 다시 잡을 수 있다. 안 그러면 홀드 한 번으로 연사가 된다.
  if ((a.phase === 'recovering' || a.phase === 'collapsing') && !input.drawing) {
    a.phase = 'idle'
  }

  // idle → drawing. 누른 **그 스텝에** draw가 0보다 커져야 한다 (feel-lens 1).
  // 잔량 0에서도 잡히면, 마지막 화살이 날아가는 동안 다시 눌러 만작까지 간 한 발이
  // spawnArrow의 잔량 검사에 걸려 통째로 증발한다. 아예 안 물려야 '못 쏜다'가 즉시 읽힌다.
  if (a.phase === 'idle' && input.drawing && w.arrowsLeft > 0 && canStartDraw(a.stamina)) {
    a.phase = 'drawing'
    a.drawTime = 0
    a.draw = 0
    a.holdTime = 0
    a.steadyTime = 0
    w.events.push({ t: 'draw_start' })
  }

  const drawing = a.phase === 'drawing' || a.phase === 'full'

  // ── 호흡정지 ──
  // 즉발 금지. rampIn 동안 스며들어야 "숨을 참는" 동작으로 읽힌다.
  // 당기는 중에만 쌓인다 — idle에서 미리 채워두고 누르는 꼼수를 막는다.
  const rampIn = P.steady.rampIn
  if (drawing && input.steady) {
    a.steadyTime += dt
    a.steadyBlend = rampIn > 0 ? clamp01(a.steadyBlend + dt / rampIn) : 1
  } else {
    a.steadyTime = 0
    a.steadyBlend = rampIn > 0 ? clamp01(a.steadyBlend - dt / rampIn) : 0
  }

  // ── 당김 ──
  //
  // 만작은 "1.0까지 당김"이 아니라 "이 궁수의 한계(dMaxDraw)까지 당김"이다.
  // 초보는 0.72에서 팔이 멈추고, 그 상태가 그의 만작이다. STR이 붙어야 1.0이 열린다.
  if (drawing) {
    const fullTime = P.bow.drawTime * dDrawTimeMul
    a.drawTime += dt
    // 초반엔 쭉 당겨지고 마지막 한 뼘이 버겁다 — 실제 활의 장력 곡선.
    const p = fullTime > 0 ? clamp01(a.drawTime / fullTime) : 1
    a.draw = dMaxDraw * (1 - Math.pow(1 - p, P.bow.drawEase))
    if (a.phase === 'drawing' && p >= 1) {
      a.phase = 'full'
      a.holdTime = 0
      w.events.push({ t: 'full_draw' })
    } else if (a.phase === 'full') {
      a.holdTime += dt
    }
  }

  // ── 스태미나 ──
  let drain = 0
  if (drawing) {
    drain = P.stamina.drawDrain
      * Math.pow(a.draw, P.stamina.drainByDraw)
      * lerp(1, P.steady.staminaDrain, a.steadyBlend)
    a.stamina -= drain * dt
    a.regenLock = P.stamina.regenDelay
  } else {
    a.regenLock = a.regenLock > dt ? a.regenLock - dt : 0
    if (a.regenLock <= 0) a.stamina += P.stamina.regen * dt
  }
  a.stamina = clamp(a.stamina, 0, dStaminaMax)

  // ── 붕괴 경고 ──
  const prevWarn = a.warn
  let warn = P.stamina.collapseWarnAt > 0
    ? clamp01(1 - a.stamina / P.stamina.collapseWarnAt)
    : 0
  // 임계값만 믿지 않는다. 지금 소모 속도로 붕괴까지 남은 시간이 최소 예고 시간보다
  // 짧아지면(호흡정지로 소모가 2.6배가 되는 경우 등) 그 자리에서 경고를 강제로 켠다.
  if (drain > 0 && P.stamina.collapseWarnMinTime > 0) {
    const forced = clamp01(1 - a.stamina / drain / P.stamina.collapseWarnMinTime)
    if (forced > warn) warn = forced
  }
  // 선형 그대로면 경고 진입 스텝의 warn이 0에 가까워 렌더가 그릴 게 없다.
  // warnCurve < 1 로 앞을 세워야 warn_start와 눈에 보이는 변화가 같은 순간에 온다.
  a.warn = warn > 0 ? Math.pow(warn, P.stamina.warnCurve) : 0
  if (prevWarn <= 0 && a.warn > 0) w.events.push({ t: 'warn_start' })

  // ── 떨림 ──
  //
  // **당김의 앞부분은 떨리지 않는다.** 실제 활에서 떨림은 당기는 동작에서 오는 게 아니라
  // 만작에서 '버티는' 동안, 버티는 힘이 모자랄수록 시간이 갈수록 커진다.
  // 당기는 내내 흔들리면 조준이 불가능하고 활을 쏘는 감각 자체가 아니다.
  //
  // 다만 게이트는 phase가 아니라 **당김 진행도**다. draw는 만작 플래그가 서기 46ms 전에
  // 이미 한계의 99%에 닿기 때문에, phase로 걸면 "위력은 만작인데 떨림은 0"인 창이 열리고
  // 그 창에 맞춰 놓는 게 유일한 최적해가 된다 — 만작 이후를 싸움터로 만들려는 설계가 죽는다.
  const holding = a.phase === 'drawing' || a.phase === 'full' || a.phase === 'collapsing'
  if (holding) {
    const fatigue = dStaminaMax > 0 ? clamp01(1 - a.stamina / dStaminaMax) : 1
    // 호흡정지 목표 배수. FOCUS가 높을수록 더 깊이 눌린다.
    const steadyTarget = dSteadyMul > 0
      ? P.steady.tremorMul / dSteadyMul
      : P.steady.tremorMul

    let amp = P.tremor.baseAmp
    // 만작에 닿은 순간부터 rampStart에 걸쳐 onsetAmp -> 1 로 자란다.
    // 고요함을 맡는 건 아래 grip(당김 진행도)이고, 여기는 **버틴 시간**만 본다 —
    // 만작 순간의 떨림이 안 보일 만큼 작으면 '지금이다'를 읽을 근거가 화면에 없다.
    // smoothstep이라 만작 진입에서 진폭이 툭 튀지 않는다.
    const onset = P.tremor.rampStart > 0
      ? lerp(P.tremor.onsetAmp, 1, smoothstep(a.holdTime / P.tremor.rampStart))
      : 1
    amp *= onset
    // 다 자란 뒤에도 계속 버티면 더 커진다 — 버티는 힘이 바닥나는 중이라는 신호.
    amp *= 1 + Math.max(0, a.holdTime - P.tremor.rampStart) * P.tremor.rampRate
    // 지칠수록 (막판에 급격히)
    amp *= 1 + Math.pow(fatigue, P.tremor.fatigueExp) * (P.tremor.fatigueMul - 1)
    // STEADY 스탯
    amp *= dTremorMul
    // 호흡정지
    amp *= lerp(1, steadyTarget, a.steadyBlend)
    // 숨을 너무 오래 참으면 오히려 더 떨린다 — 실제 사격과 같다.
    if (a.steadyTime > P.steady.maxHold) amp *= P.steady.overholdPenalty
    // 마지막 한 뼘에서 떨림이 스며든다. 만작에 닿는 순간 grip이 정확히 1이 되므로
    // 당김 → 만작 전환에서 진폭이 튀지 않고, 무떨림 최대위력 창도 남지 않는다.
    // span이 0이면 0/0으로 NaN이 새어나가 발사각이 통째로 죽는다. 슬라이더 최대값(1)이 그 경우다.
    const span = 1 - P.tremor.gripFrom
    const grip = dMaxDraw <= 0
      ? 0
      : span > 0
        ? clamp01((a.draw / dMaxDraw - P.tremor.gripFrom) / span)
        : a.draw >= dMaxDraw ? 1 : 0
    amp *= grip

    // 2옥타브 합성. 단일 사인파는 예측 가능해 지루하고, 순수 난수는 위상을 못 읽어
    // 실력이 개입할 여지가 없다. 느린 스윙 위에 잔떨림이 얹혀야 "지금이다"가 생긴다.
    const slow = valueNoise(a.tremorPhase * P.tremor.slowFreq, SEED_SLOW)
    const fast = valueNoise(a.tremorPhase * P.tremor.fastFreq, SEED_FAST)
    const wave = slow * (1 - P.tremor.fastRatio) + fast * P.tremor.fastRatio

    a.tremorAmp = amp
    a.tremorOffset = wave * amp
  } else {
    a.tremorAmp = 0
    a.tremorOffset = 0
  }

  // ── 붕괴 ──
  // 스스로 놓아버린다. 경고는 위에서 이미 켜져 있다.
  if (drawing && a.stamina <= 0) {
    a.phase = 'collapsing'
    w.events.push({ t: 'collapse' })
    release(w, true)
    return
  }

  // ── 릴리즈 ── drawing이 true→false로 떨어진 스텝
  if (drawing && !input.drawing) {
    release(w, false)
  }
}

/**
 * 발사. P.bow.releaseDelay는 0이 정답이며, 0일 때 **같은 스텝에** 화살이 나가야 한다.
 * (delay > 0을 구현하려면 ArcherState에 타이머 필드가 필요하다 — 계약 변경 사항이라 보류.)
 */
function release(w: World, collapsed: boolean): void {
  const a = w.archer
  const power = a.draw

  // 산포. STEADY 스탯이 통째로 줄이고, FOCUS가 릴리즈 관용 창을 따로 넓힌다 (GDD 4장).
  let scatter = w.rng.gaussian() * P.bow.releaseScatter * dTremorMul * dScatterMul
  // 호흡정지는 떨림만이 아니라 난수 산포도 좁힌다. 안 그러면 참고 쏜 한 발이 순수 운이 된다.
  scatter *= lerp(1, P.bow.steadyScatterMul, a.steadyBlend)
  // 덜 당기고 쏘면 화살이 흔들리며 날아간다.
  scatter *= 1 + (1 - power) * P.bow.partialDrawPenalty
  // 붕괴는 큰 페널티. 피로는 여기 섞지 않는다 — 피로는 이미 떨림(읽을 수 있는 채널)을
  // 키우고 있고, 읽을 수 없는 난수까지 같이 키우면 실력이 개입할 여지가 줄어든다.
  if (collapsed) scatter *= P.bow.collapseScatterMul

  // 이 한 줄이 이 게임의 전부다. 떨림 위상이 그대로 발사각이 된다.
  // 흔들림이 중앙(offset≈0)을 지날 때 놓으면 정확하다. UI 없이 물리로 만들어지는 실력.
  const err = a.tremorOffset + scatter
  const angle = a.aimAngle + err

  spawnArrow(w, angle, power)
  w.events.push({ t: 'release', power, angle, err })

  a.phase = collapsed ? 'collapsing' : 'recovering'
  a.draw = 0
  a.drawTime = 0
  a.holdTime = 0
  a.steadyTime = 0
  a.steadyBlend = 0
}
