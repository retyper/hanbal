/**
 * 스틱맨 궁수 (GDD 8장) — 벡터 라인, 관절 5개(어깨/팔꿈치/손목/골반/무릎).
 *
 * 이 파일의 책임은 두 가지다.
 *
 * 1. **떨림을 읽을 수 있게 그린다.** 조준 떨림은 실제로는 0.02 rad 미만이라 화면에서 1px도
 *    안 움직인다. 회전 중심을 어깨에 두고 P.tremor.minVisiblePx로 표시 배율을 역산해
 *    활 끝의 흔들림이 항상 최소 가시 진폭 이상 나오게 한다. 위상은 그대로 보존된다.
 * 2. **만작 한계를 자세로 말한다.** 만작은 1.0이 아니라 이 궁수의 한계(DerivedStats.maxDraw)다.
 *    STR 0이면 0.72에서 팔이 멈춘다. 그래서 자세의 '조여짐'을 draw에 직접 물려,
 *    시위가 안 당겨지는 초보는 영영 어정쩡한 자세에서 멈추고, 진짜 만작(1.0)에 닿은 궁수만
 *    등이 펴진 완성된 실루엣이 된다. effectiveStats()를 부르지 않는 이유는 그게 객체를
 *    만들기 때문이다(A5) — a.draw 하나로 같은 정보가 이미 화면에 있다.
 *
 * 굵기는 전부 cam.scale에 비례한다. 절대 픽셀 상수로 박지 않는다 — 줌이 바뀌어도 비율이 유지된다.
 *
 * ARCHITECTURE A1: World는 읽기만 한다.
 */
import { clamp, clamp01, lerp, smoothstep } from '../core/math.ts'
import { P } from '../tune/params.ts'
import type { World } from '../sim/types.ts'
import { THEME, worldToScreenX, worldToScreenY } from './camera.ts'
import type { Camera } from './camera.ts'

/** 체격 (m). 화면 픽셀이 아니라 월드 치수라 카메라 줌을 그대로 따라간다. */
const BODY = {
  arm: 0.62,
  armBend: 0.05,
  torso: 0.5,
  neck: 0.1,
  head: 0.135,
  hip: 0.06,
  stance: 0.26,
  kneeOut: 0.09,
  legMin: 0.35,
  legMax: 1.1,
  bowHalf: 0.46,
  bowCurve: 0.15,
  bowDrawCurve: 0.5,
  restDraw: 0.09,
  arrowLen: 0.72,
  arrowHead: 0.13,
  drawElbow: 0.17,
} as const

/**
 * 선 굵기. 두께는 월드 치수(m) × cam.scale 이라 줌과 함께 자란다.
 * min/max만 픽셀인데, 이건 손맛이 아니라 "이 이하로는 안 보인다"는 화면의 물리적 하한이다.
 *
 * 굵기 위계: 몸통 > 팔다리 > 활 > 화살 > 시위.
 * 활이 몸보다 얇아야 활로 읽히고, 화살은 얇지만 밝아서 눈에 먼저 들어온다 (GDD 8장).
 *
 * 골격 비율은 캐릭터의 신원이라 여기 남는다. **성장이 화면에 드러나는 폭**만
 * P.render 로 올라갔다 (lineBody / lineFullGain / lineTrueFullGain).
 */
const LINE = {
  minPx: 3,
  maxPx: 12,
  torsoMul: 1.35,
  limbMul: 1,
  /** 뒤쪽 팔다리는 살짝 얇게 — 원근 */
  backMul: 0.82,
  bowMul: 0.66,
  stringMul: 0.3,
  arrowMul: 0.4,
  /** 시위·화살이 사라지지 않을 픽셀 하한 */
  thinMinPx: 1.2,
} as const

/**
 * 자세. 전부 월드 치수(m)거나 비율이다. 자세의 골격은 여기,
 * **성장이 자세로 드러나는 문턱**(braceFrom / trueFullAt / fullBowCurve / onsetFlash)은 P.render.
 */
const POSE = {
  /** 덜 조여진 자세에서 등이 뒤로 굽는 양 (m) */
  slouchSpine: 0.16,
  /** 붕괴 경고에서 등이 더 굽는 양 (m) */
  warnSpine: 0.2,
  /** 진짜 만작에서 등이 펴지고 가슴이 열리는 양 (m) */
  fullArch: 0.07,
  /** 덜 조여진 자세에서 골반이 뒤로 빠지는 거리 (m) */
  slouchHip: 0.13,
  warnHip: 0.1,
  /** 등이 굽으면 척추의 세로 길이가 줄어든다 → 골반이 올라오고 무릎이 더 굽는다 */
  slouchCompress: 0.12,
  warnCompress: 0.16,
  /** 덜 조여진 앞팔(활 든 팔)은 팔꿈치가 안 펴진다 */
  slouchArm: 2.4,
  warnArm: 2,
  /** 덜 조여진 시위팔은 팔꿈치가 안 올라온다 (배수) */
  slouchElbow: 0.18,
  /** 진짜 만작에서 시위팔 팔꿈치가 어깨선 위로 더 올라간다 (배수) */
  fullElbow: 1.35,
  /** 덜 조여진 자세의 발 간격 배수 */
  slouchStance: 0.58,
  slouchKnee: 0.9,
  warnKnee: 1.4,
  /** 고개 기울기 (rad) — 조여질수록 활 쪽으로 붙고, 무너지면 앞으로 떨어진다 */
  braceHeadTilt: 0.22,
  warnHeadDrop: 0.5,
  /** 앞팔 처짐 각 (rad) — 붕괴 경고 */
  warnDroop: 0.11,
} as const

/** 어깨(회전 중심)에서 활 끝까지의 반지름. 떨림 지렛대의 실제 길이다. */
const TREMOR_LEVER = Math.hypot(BODY.arm, BODY.bowHalf)

/**
 * valueNoise 한 옥타브의 RMS (실측 0.497). 손맛 노브가 아니라 core/math.ts 파형의 성질이다.
 *
 * tremorOffset은 baseAmp가 아니라 baseAmp × wave 이고 wave의 RMS는 1이 아니다.
 * 파고율을 1로 가정하면 화면 진폭이 minVisiblePx의 절반 이하가 되어 노브 이름이 거짓말을 한다 —
 * 만작 직후 활 끝이 1.2px밖에 안 움직여 위상을 읽을 수 없었다 (feel-lens).
 */
const NOISE_RMS = 0.497

/**
 * 표시용 떨림 상한 (rad, 약 15°). 이보다 크게 흔들면 팔이 만화처럼 돌아간다.
 * 기본 진폭이 2.5px일 때 최대 진폭이 10~20px가 되도록 잡은 값.
 */
const VIS_TREMOR_MAX = 0.26
/** 붕괴 경고에서 떨림이 추가로 커지는 비율 — "예고 없는 붕괴" 방지 (GDD 2장) */
const WARN_TREMOR_BOOST = 0.85

/** 색을 고르는 이산 문턱. 램프에서 어느 색을 집을지의 판정일 뿐 손맛 노브가 아니다. */
const ON = { warn: 0.02, flash: 0.5, trueFull: 0.5 } as const

/** 경고색 램프. 매 프레임 색 문자열을 만들면 힙 할당이 생긴다 (A5). 미리 만들어 인덱싱한다. */
const BOW_RAMP = ['#d9cba6', '#e0bd8d', '#e8a874', '#ef8f5d', '#f57a4f', '#ff6a45'] as const
const BODY_RAMP = ['#c9d2dc', '#ccc9cf', '#d0bfbd', '#d5b3aa', '#dba798', '#e29a86'] as const

/** 관절 좌표 캐시 (월드 m). 프레임마다 새 객체를 만들지 않기 위한 단일 인스턴스. */
const rig = {
  ax: 0, ay: 0,
  ux: 1, uy: 0,
  vx: 0, vy: 1,
  /** 궁수가 바라보는 쪽 (+1 오른쪽 / -1 왼쪽). 등·골반은 조준각이 아니라 이 방향의 반대다. */
  face: 1,
  hx: 0, hy: 0,
  nockX: 0, nockY: 0,
  warn: 0,
  full: 0,
  draw: 0,
  /** 자세가 조여진 정도 0..1. 1 = 진짜 만작의 완성된 자세 */
  brace: 0,
  trueFull: 0,
  /** 만작 진입 섬광 0..1 */
  flash: 0,
}

/**
 * 표시용 떨림 각. 실제 발사각(aimAngle + tremorOffset)은 건드리지 않는다 —
 * 여기서 키우는 건 "보이는 팔"뿐이고, 부호와 위상은 원본 그대로라
 * "흔들림이 중앙을 지날 때 놓기"라는 읽기가 성립한다 (GDD 2장).
 */
function visualTremor(cam: Camera, offset: number, warn: number): number {
  // 2옥타브 합성의 RMS. 두 옥타브가 독립이라 hypot으로 따라간다 — fastRatio를 튜닝해도 안 어긋난다.
  const waveRms = NOISE_RMS * Math.hypot(1 - P.tremor.fastRatio, P.tremor.fastRatio)
  const rawPx = P.tremor.baseAmp * TREMOR_LEVER * cam.scale * waveRms
  const gain = rawPx > 1e-6 ? P.tremor.minVisiblePx / rawPx : 1
  const boosted = offset * gain * (1 + warn * WARN_TREMOR_BOOST)
  // tanh 소프트 클램프 — 단조증가라 위상이 보존되고, 기본 진폭 부근에서는 거의 선형이다.
  return VIS_TREMOR_MAX * Math.tanh(boosted / VIS_TREMOR_MAX)
}

function computeRig(cam: Camera, w: World): void {
  const a = w.archer
  const warn = clamp01(a.warn)
  const d = clamp01(a.draw)
  // 어깨 = sim이 주는 궁수 좌표. 만작 시 노크(화살 꽁무니)가 여기 오므로 화살 생성점과 정확히 맞는다.
  // **어깨는 절대 옮기지 않는다.** 자세의 붕괴는 척추·골반·다리·고개로만 표현한다.
  rig.ax = a.x
  rig.ay = a.y
  rig.warn = warn
  rig.draw = d
  const atFull = a.phase === 'full'
  rig.full = atFull || a.phase === 'collapsing' ? 1 : 0

  // 당김이 곧 자세의 완성도다. maxDraw가 0.72에서 멈추는 초보는 자세도 거기서 멈춘다.
  const braceFrom = P.render.poseBraceFrom
  rig.brace = braceFrom < 1
    ? smoothstep((d - braceFrom) / (1 - braceFrom))
    : 0
  const trueFullAt = P.render.poseTrueFullAt
  rig.trueFull = trueFullAt < 1
    ? smoothstep((d - trueFullAt) / (1 - trueFullAt))
    : 0
  // 당기는 동안은 떨리지 않는다. 만작에 '닿는 순간'을 이 섬광이 표시한다.
  // collapsing은 제외한다 — 붕괴 직후에도 holdTime이 0이라, 그대로 두면 벌이 보상처럼 번쩍인다.
  rig.flash = atFull && a.holdTime < P.render.poseOnsetFlash
    ? 1 - a.holdTime / P.render.poseOnsetFlash
    : 0

  const dir = a.aimAngle + visualTremor(cam, a.tremorOffset, warn) - warn * POSE.warnDroop
  const ux = Math.cos(dir)
  const uy = Math.sin(dir)
  rig.ux = ux
  rig.uy = uy
  rig.vx = -uy
  rig.vy = ux
  rig.face = ux >= 0 ? 1 : -1

  rig.hx = a.x + ux * BODY.arm
  rig.hy = a.y + uy * BODY.arm

  const pull = BODY.restDraw + (BODY.arm - BODY.restDraw) * d
  rig.nockX = rig.hx - ux * pull
  rig.nockY = rig.hy - uy * pull
}

/** 활 손 화면 좌표 — HUD가 스태미나 게이지를 활 옆에 붙이는 데 쓴다. */
export function bowHandScreenX(cam: Camera, w: World): number {
  computeRig(cam, w)
  return worldToScreenX(cam, rig.hx)
}

export function bowHandScreenY(cam: Camera, w: World): number {
  computeRig(cam, w)
  return worldToScreenY(cam, rig.hy)
}

function line(
  ctx: CanvasRenderingContext2D, cam: Camera,
  x0: number, y0: number, x1: number, y1: number,
): void {
  ctx.beginPath()
  ctx.moveTo(worldToScreenX(cam, x0), worldToScreenY(cam, y0))
  ctx.lineTo(worldToScreenX(cam, x1), worldToScreenY(cam, y1))
  ctx.stroke()
}

/** 팔·다리는 관절 하나짜리 꺾인 선. bend는 진행방향 왼쪽(+) 기준 오프셋(m). */
function limb(
  ctx: CanvasRenderingContext2D, cam: Camera,
  x0: number, y0: number, x1: number, y1: number, bend: number,
): void {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  const inv = len > 1e-5 ? 1 / len : 0
  const jx = (x0 + x1) * 0.5 - dy * inv * bend
  const jy = (y0 + y1) * 0.5 + dx * inv * bend
  ctx.beginPath()
  ctx.moveTo(worldToScreenX(cam, x0), worldToScreenY(cam, y0))
  ctx.lineTo(worldToScreenX(cam, jx), worldToScreenY(cam, jy))
  ctx.lineTo(worldToScreenX(cam, x1), worldToScreenY(cam, y1))
  ctx.stroke()
}

/** 척추 — 곧은 선이 아니라 굽는 곡선이어야 "등이 굽었다"가 읽힌다. */
function spine(
  ctx: CanvasRenderingContext2D, cam: Camera,
  x0: number, y0: number, x1: number, y1: number, bendX: number,
): void {
  ctx.beginPath()
  ctx.moveTo(worldToScreenX(cam, x0), worldToScreenY(cam, y0))
  ctx.quadraticCurveTo(
    worldToScreenX(cam, (x0 + x1) * 0.5 + bendX), worldToScreenY(cam, (y0 + y1) * 0.5),
    worldToScreenX(cam, x1), worldToScreenY(cam, y1),
  )
  ctx.stroke()
}

export function drawArcher(
  ctx: CanvasRenderingContext2D, cam: Camera, w: World, _alpha: number,
): void {
  // 궁수는 고정 위치라 보간할 이전 상태가 없다(ArcherState에 px/py가 없다). _alpha는 쓰지 않는다.
  computeRig(cam, w)
  const a = w.archer
  const warn = rig.warn
  const brace = rig.brace
  const trueFull = rig.trueFull
  const slouch = 1 - brace
  const face = rig.face
  const ramp = (warn * 5 + 0.5) | 0

  // 굵기는 cam.scale에 비례한다 — 줌이 바뀌어도 스틱맨의 무게감이 유지된다.
  const lw = clamp(cam.scale * P.render.lineBody, LINE.minPx, LINE.maxPx)
  const gain = 1 + rig.full * P.render.lineFullGain + trueFull * P.render.lineTrueFullGain
  const limbW = lw * LINE.limbMul * gain
  const torsoW = lw * LINE.torsoMul * gain
  const backW = lw * LINE.backMul * gain
  const bowW = lw * LINE.bowMul * gain
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const bodyCol = warn > ON.warn
    ? (BODY_RAMP[ramp] ?? THEME.body)
    : (trueFull > ON.trueFull ? THEME.target2 : THEME.body)

  // ── 몸통·다리·머리 ────────────────────────────────────────────
  //
  // 등이 굽으면 척추의 세로 길이가 줄고 골반이 올라온다 → 무릎이 더 굽는다.
  // 발은 지면(y=0)에 그대로 붙어 있어야 주저앉는 것처럼 읽힌다.
  const compress = slouch * POSE.slouchCompress + warn * POSE.warnCompress
  const hipBack = BODY.hip + slouch * POSE.slouchHip + warn * POSE.warnHip
  const pelvisX = rig.ax - face * hipBack
  const pelvisY = rig.ay - BODY.torso * (1 - compress)
  const legSpan = clamp(pelvisY, BODY.legMin, BODY.legMax)
  const footY = pelvisY - legSpan
  const stance = BODY.stance * lerp(POSE.slouchStance, 1, brace)
  const kneeOut = BODY.kneeOut * (1 + slouch * POSE.slouchKnee + warn * POSE.warnKnee)

  // 척추는 뒤(조준 반대쪽)로 굽는다. 진짜 만작에서만 반대로 젖혀져 가슴이 열린다.
  const spineBend = -face * (
    slouch * POSE.slouchSpine + warn * POSE.warnSpine - trueFull * POSE.fullArch
  )

  ctx.strokeStyle = bodyCol
  ctx.lineWidth = torsoW
  spine(ctx, cam, rig.ax, rig.ay, pelvisX, pelvisY, spineBend)

  // 뒷다리 먼저(어둡게) → 원근
  ctx.strokeStyle = THEME.bodyDim
  ctx.lineWidth = backW
  limb(ctx, cam, pelvisX, pelvisY, pelvisX - face * stance, footY, -face * kneeOut)
  ctx.strokeStyle = bodyCol
  ctx.lineWidth = limbW
  limb(ctx, cam, pelvisX, pelvisY, pelvisX + face * stance, footY, face * kneeOut)

  // 머리 — 조여질수록 활 쪽으로 붙고, 무너지면 앞으로 떨어진다.
  const tilt = brace * POSE.braceHeadTilt + warn * POSE.warnHeadDrop
  const upX = Math.sin(tilt) * rig.ux
  const upY = Math.cos(tilt) + Math.sin(tilt) * rig.uy
  const neckX = rig.ax + upX * BODY.neck
  const neckY = rig.ay + upY * BODY.neck
  const headSpan = BODY.neck + BODY.head
  const headX = rig.ax + upX * headSpan
  const headY = rig.ay + upY * headSpan
  line(ctx, cam, rig.ax, rig.ay, neckX, neckY)
  // 머리는 채운다. 선만으로는 실루엣의 무게중심이 생기지 않는다 (GDD 8장 실루엣 대비).
  ctx.beginPath()
  ctx.arc(
    worldToScreenX(cam, headX), worldToScreenY(cam, headY),
    Math.max(BODY.head * cam.scale, 2), 0, Math.PI * 2,
  )
  ctx.fillStyle = bodyCol
  ctx.fill()
  ctx.stroke()

  // ── 시위 당기는 팔 (뒤쪽) ─────────────────────────────────────
  // 덜 당겨진 팔은 팔꿈치가 안 올라온다 — 초보가 "어정쩡한 지점에서 멈춘" 그 모양.
  // 진짜 만작에서만 팔꿈치가 화살선 위로 확실히 올라선다.
  ctx.strokeStyle = THEME.bodyDim
  ctx.lineWidth = backW
  const drawElbow = BODY.drawElbow
    * lerp(POSE.slouchElbow, 1, brace)
    * lerp(1, POSE.fullElbow, trueFull)
  limb(ctx, cam, rig.ax, rig.ay, rig.nockX, rig.nockY, -drawElbow)

  // ── 활 ────────────────────────────────────────────────────────
  // 당길수록 활이 더 휜다. 진짜 만작이면 최대로 휘고, 경고가 오르면 경고색으로 물든다.
  const curve = BODY.bowCurve
    * (1 + rig.draw * BODY.bowDrawCurve)
    * (1 + trueFull * P.render.poseFullBowCurve)
  const tipAx = rig.hx + rig.vx * BODY.bowHalf
  const tipAy = rig.hy + rig.vy * BODY.bowHalf
  const tipBx = rig.hx - rig.vx * BODY.bowHalf
  const tipBy = rig.hy - rig.vy * BODY.bowHalf
  const ctrlX = rig.hx + rig.ux * curve * 2
  const ctrlY = rig.hy + rig.uy * curve * 2

  // 만작에 닿는 순간만 밝게 튄다. 당김(고요) → 만작(떨림) 전환의 신호.
  ctx.strokeStyle = warn > ON.warn
    ? (BOW_RAMP[ramp] ?? THEME.bow)
    : (rig.flash > ON.flash ? THEME.target2 : THEME.bow)
  ctx.lineWidth = bowW
  ctx.beginPath()
  ctx.moveTo(worldToScreenX(cam, tipAx), worldToScreenY(cam, tipAy))
  ctx.quadraticCurveTo(
    worldToScreenX(cam, ctrlX), worldToScreenY(cam, ctrlY),
    worldToScreenX(cam, tipBx), worldToScreenY(cam, tipBy),
  )
  ctx.stroke()

  // 시위 — 몸보다 훨씬 얇다. 굵기 위계가 있어야 활이 활로 보인다.
  ctx.strokeStyle = rig.flash > ON.flash ? THEME.target2 : THEME.string
  ctx.lineWidth = Math.max(lw * LINE.stringMul, LINE.thinMinPx)
  ctx.beginPath()
  ctx.moveTo(worldToScreenX(cam, tipAx), worldToScreenY(cam, tipAy))
  ctx.lineTo(worldToScreenX(cam, rig.nockX), worldToScreenY(cam, rig.nockY))
  ctx.lineTo(worldToScreenX(cam, tipBx), worldToScreenY(cam, tipBy))
  ctx.stroke()

  // ── 앞팔(활 잡은 팔) ──────────────────────────────────────────
  // 덜 조여지면 팔꿈치가 안 펴지고, 경고가 오르면 더 굽으며 처진다.
  ctx.strokeStyle = bodyCol
  ctx.lineWidth = limbW
  limb(
    ctx, cam, rig.ax, rig.ay, rig.hx, rig.hy,
    -BODY.armBend * (1 + slouch * POSE.slouchArm + warn * POSE.warnArm),
  )

  // ── 물린 화살 ─────────────────────────────────────────────────
  // 몸보다 얇고 밝게. 촉만 강조색 — 강조색은 과녁과 화살에만 (GDD 8장).
  if (a.phase !== 'idle' && a.phase !== 'recovering') {
    const tipX = rig.nockX + rig.ux * BODY.arrowLen
    const tipY = rig.nockY + rig.uy * BODY.arrowLen
    ctx.lineWidth = Math.max(lw * LINE.arrowMul, LINE.thinMinPx)
    ctx.strokeStyle = THEME.arrow
    line(ctx, cam, rig.nockX, rig.nockY, tipX, tipY)
    ctx.strokeStyle = THEME.accent
    line(ctx, cam, tipX - rig.ux * BODY.arrowHead, tipY - rig.uy * BODY.arrowHead, tipX, tipY)
  }
}
