/**
 * 활 — 당김 · 떨림 · 호흡정지 · 붕괴 · 릴리즈
 *
 * 이 파일이 게임의 심장이다. GDD 2장: "놓는 순간이 전부다."
 *
 * ★ 이 파일이 지키는 계약 — **빨간 바(P.stamina.steadyZone)**
 *
 *   스태미나가 최대치의 55% 위(안전 구간)에 있고 만작으로 놓으면
 *   **떨림 0 · 난수 산포 0 · 조준한 그 자리에 정확히 맞는다.** (실측 발사 각오차 RMS 0.000 mrad)
 *   그 아래로 내려간 만큼만 ArcherState.strain 이 자라고, 떨림과 오차가 전부 여기 비례한다.
 *
 *   오차는 반드시 플레이어가 한 선택(오래 끌었다 / 덜 당기고 쐈다)의 결과여야 한다.
 *   제대로 쐈는데 빗나가면 자기가 뭘 잘못했는지 알 수 없고 그냥 화가 난다.
 *
 * 경계선을 넘은 뒤에는 떨림(tremor)의 위상이 그대로 발사각에 들어간다. UI 장치 없이 물리만으로
 * "흔들림이 중앙을 지날 때 놓기"라는 실력이 자연 발생하게 만드는 게 목적이다.
 * 즉 안전 구간은 '읽을 게 없는' 구간이고, 그걸 넘긴 순간부터 읽기가 시작된다.
 *
 * 시간축은 오직 w.dt 누적. Date.now / performance.now 금지 (ARCHITECTURE A1).
 * 손맛 숫자는 전부 P (tune/params.ts). 이 파일에 매직넘버는 없다 (A2).
 */
import type { DerivedStats, InputFrame, Stats, World } from './types.ts'
import { P } from '../tune/params.ts'
import { clamp, clamp01, diminish, lerp, valueNoise } from '../core/math.ts'
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
 * 호흡정지 한계 시간 배수 (FOCUS). DerivedStats에는 넣지 않는다 —
 * 계약을 늘리지 않고 bow 내부에서만 쓰면 되는 값이라 모듈 스칼라로 둔다.
 */
let dHoldMul = 1
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
  // GDD 4장 FOCUS의 두 번째 효과. 산포가 0이 된 뒤로는(P.bow.releaseScatter) 숨을 더 오래
  // 참게 해 준다 — "결정적인 순간을 잡는다"가 시간의 여유로 번역된다.
  dHoldMul = 1 + focus * P.growth.focusToHold
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
  // ── 활 (docs/BOWS.md) ──
  // 스탯 위에 활의 배수를 겹친다. 모듈 스칼라에 곱해 두면 이 스텝의 당김·떨림·릴리즈가
  // 전부 같은 값을 본다. effectiveStats()(UI용)는 몸의 값만 말한다 — 활 이야기는 활 걸이가 한다.
  // 안전 구간의 계약은 그대로다: tremor·scatter 는 빨간 바 아래에서만 0이 아니므로
  // 여기 배수가 얼마든 "안전 구간 만작 = 오차 0"은 변하지 않는다.
  const bow = w.bow
  dDrawTimeMul *= bow.drawTimeMul
  dTremorMul *= bow.tremorMul
  dMaxDraw = clamp01(dMaxDraw + bow.maxDrawAdd)

  // 조준은 스무딩 없이 즉시 반영한다. 한 스텝이라도 늦으면 조준이 미끄러진다 (feel-lens 1).
  // 단 **앞쪽 원뿔 안으로만** — 커서가 궁수 뒤로 가면 각이 ±180°로 뒤집혀 자세가 접힌다.
  // 결정론에는 영향이 없다: 같은 입력 = 같은 클램프 = 같은 각 (A1).
  a.aimAngle = clamp(
    Math.atan2(input.aimY - a.y, input.aimX - a.x),
    -P.input.aimDownMax,
    P.input.aimUpMax,
  )

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
    const p0 = fullTime > 0 ? clamp01(a.drawTime / fullTime) : 1
    // 시작 완만화 (스무스스텝) — 실제 활은 첫 한 뼘에서 화살이 거의 안 당겨진다.
    // 이게 없으면 0.03초 탭에도 당김이 0.14나 나와 화살이 십 미터를 날았다
    // (형의 재점검 요청: "짧게 클릭했을 때 아직도 너무 멀리 나가"). 파형의 신원이라 노브가 아니다.
    const p = p0 * p0 * (3 - 2 * p0)
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
    // 렛오프 — 컴파운드는 만작에서 장력이 빠진다. **만작에서만**이다.
    // 당기는 도중까지 깎아주면 "도르래를 넘기는 무게"라는 대가가 사라진다.
    if (a.phase === 'full') drain *= bow.holdDrainMul
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
  // 떨림의 유일한 원인은 **빨간 바를 넘었는가**다. 시간도, 당김 진행도도 아니다.
  //
  // 빨간 바는 스태미나 게이지 위의 경계선이고, 그 위로는 완벽하게 안정하다 —
  // 떨림 0, 발사 오차 0, 조준한 그대로 맞는다. 아래로 내려간 만큼만 떨린다.
  //
  // 왜 이렇게까지 하나: 제대로 쐈는데 빗나가면 플레이어는 자기가 뭘 잘못했는지 알 수 없다.
  // 오차는 반드시 본인이 한 선택(오래 끌었다 / 덜 당기고 쐈다)의 결과여야 하고,
  // 그 경계가 화면에 그려져 있어야 한다. 그래야 빗나가도 납득한다.
  //
  // strain 0 = 아직 안전, 1 = 완전 소진.
  const redAt = dStaminaMax * P.stamina.steadyZone
  a.strain = redAt > 0 ? clamp01((redAt - a.stamina) / redAt) : 1

  const holding = a.phase === 'drawing' || a.phase === 'full' || a.phase === 'collapsing'
  if (holding && a.strain > 0) {
    // 호흡정지 목표 배수. FOCUS가 높을수록 더 깊이 눌린다.
    const steadyTarget = dSteadyMul > 0
      ? P.steady.tremorMul / dSteadyMul
      : P.steady.tremorMul

    // 경계선을 갓 넘은 순간은 0에서 시작해 부드럽게 자란다 (growExp > 1).
    // 툭 튀면 "왜 갑자기 흔들리지"가 되고, 경계선의 의미가 안 읽힌다.
    let amp = P.tremor.baseAmp * Math.pow(a.strain, P.tremor.growExp)
    // STEADY 스탯
    amp *= dTremorMul
    // 호흡정지
    amp *= lerp(1, steadyTarget, a.steadyBlend)
    // 숨을 너무 오래 참으면 오히려 더 떨린다 — 실제 사격과 같다.
    if (a.steadyTime > P.steady.maxHold * dHoldMul) amp *= P.steady.overholdPenalty

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

  // 오차의 크기를 정하는 두 가지. 둘 다 0이면 **화살은 조준한 그 자리에 정확히 간다.**
  //
  // 이게 이 게임의 약속이다. 빨간 바를 넘기지 않고 만작에서 놓았는데 빗나가면,
  // 플레이어는 자기가 뭘 잘못했는지 알 수 없고 그냥 화가 난다.
  // 오차는 반드시 플레이어가 한 선택(오래 끌었다 / 덜 당기고 쐈다)의 결과여야 한다.
  const partial = dMaxDraw > 0 ? clamp01(1 - power / dMaxDraw) : 0
  const errScale = a.strain + partial * P.bow.partialDrawPenalty

  // gaussian()은 errScale이 0이어도 반드시 뽑는다. 안 뽑으면 발사 횟수에 따라
  // 난수 스트림이 어긋나 같은 시드가 다른 판을 만든다 (A1).
  let scatter = w.rng.gaussian() * P.bow.releaseScatter * errScale * dTremorMul
  // 호흡정지는 떨림만이 아니라 난수 산포도 좁힌다. 안 그러면 참고 쏜 한 발이 순수 운이 된다.
  scatter *= lerp(1, P.bow.steadyScatterMul, a.steadyBlend)
  // 붕괴만 별도 배수를 받는다. strain은 여기서 또 곱하지 않는다 — errScale에 이미 한 번 들어갔고,
  // 무엇보다 strain은 떨림(읽을 수 있는 채널)을 키우는 중이다.
  // 읽을 수 없는 난수까지 같은 입력으로 키우면 실력이 개입할 여지가 줄어든다.
  if (collapsed) scatter *= P.bow.collapseScatterMul

  // 이 한 줄이 이 게임의 전부다.
  // 안전 구간에서 만작이면 tremorOffset도 scatter도 정확히 0 → err === 0 → 조준각 그대로 나간다.
  // 경계선을 넘은 뒤에야 떨림 위상이 발사각이 되고, 중앙(offset≈0)을 지날 때 놓으면 덜 빗나간다.
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
