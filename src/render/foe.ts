/**
 * 적 궁수 — **사람이 활을 쥐고 나를 겨눈다.**
 *
 * ★ 형의 반려: "활 똑바로 좀 잡고 쏘게 만들고 적군도 좀 제대로 만들어라."
 *
 *   예전 적 궁수는 사람이 아니었다.
 *     · 활이 몸 옆(-x)에 **고정**이었다. 내가 어디 있든 왼쪽을 겨눴다.
 *     · 손이 활에 닿지 않았다. 활은 허공에 뜬 호였고 시위는 아무도 안 잡고 있었다.
 *     · 화살이 없었다. 당기는 시늉만 하다 어디선가 화살이 날아왔다.
 *
 *   그래서 플레이어 스틱맨과 **같은 문법**으로 다시 짰다 (docs/FORM.md · render/stickman.ts):
 *     ① 조준선 u는 **나를 향한다.** 몸도 활도 그 축 위에 선다.
 *     ② 활의 그립은 **활손 그 점**이다. 당김이 그 자리를 옮기지 않는다.
 *     ③ 당기면 **시위가 걸린 두 팁이 뒤로** 젖혀지고, 시위손이 턱으로 온다.
 *     ④ 두 손에 주먹을 찍는다 — 활대를 쥐고 줄을 쥐었다는 못.
 *     ⑤ 예고(windup) 동안 **화살이 시위에 물려 있다.** 날아올 것이 미리 보인다.
 *
 * ARCHITECTURE A1: World를 읽지도 않는다 — 좌표와 숫자만 받는다. 그래서 프로브가 쉽다.
 * A5: 프레임당 힙 할당 0. 모든 좌표는 지역 숫자다.
 */
import { TAU } from '../core/math.ts'
import { P } from '../tune/params.ts'

/**
 * 체격·활 — 전부 과녁 반경(rx, ry) 대비 비율이다. 줌이 바뀌어도 비례가 유지된다.
 *
 * ★ 머리는 여기 없다 — **sim/target.ts의 헤드샷 판정(P.enemy.archerHeadR·archerHeadUp)이
 *   유일한 출처다.** 예전엔 이 파일에 머리 반경(0.3)·목 길이(0.62)를 따로 박아뒀는데,
 *   실제 판정 중심은 어깨에서 0.62×rx가 아니라 **몸통 중심에서** 0.62×r였다 — 어깨 오프셋
 *   (0.22)만큼 시각적으로 더 높이 떠 있었다(형: "머리 위치를 목에 가깝게 내려야 한다").
 *   drawFoeArcher 안에서 매 호출 P.enemy.*를 직접 읽는다 — 라이브 튜닝 콘솔이 이 값을
 *   바꾸면 화면도 그 자리에서 같이 움직여야 한다(모듈 상수로 굳히면 안 됨).
 */
const F = {
  /** 어깨가 중심보다 위에 있는 양 (ry 대비) — 순수 실루엣용, 판정과 무관하다. */
  shoulder: 0.22,
  /** 턱(앵커) — 어깨에서 앞·위로 (rx 대비) */
  jawFwd: 0.26,
  jawUp: 0.3,
  /** 활손(그립) — 어깨에서 앞으로 곧게 뻗은 팔 (rx 대비) */
  reach: 1.15,
  gripUp: 0.1,
  /** 활 반길이 (ry 대비) */
  bow: 0.8,
  /** 브레이스 — 당김 0에서도 팁이 그립보다 뒤에 있는 거리 (활 반길이 대비) */
  brace: 0.2,
  /** 당길수록 더 젖혀지는 양 */
  backGain: 0.36,
  squeeze: 0.14,
  /** 그립 근처의 뻣뻣함 — 작을수록 라이저가 곧다 */
  ctrlBack: 0.16,
  ctrlV: 0.56,
  /** 손잡이 반길이 (활 반길이 대비) */
  riser: 0.18,
  /** 시위손 팔꿈치가 손보다 뒤로 (rx 대비) */
  elbow: 0.55,
  /** 물린 화살 길이 (rx 대비) */
  arrow: 1.9,
  /** 주먹 반지름 (선 굵기 배수) */
  fist: 0.8,
  /** 다리 — 골반 높이(ry 대비)와 보폭 */
  hip: 0.3,
  stance: 0.34,
} as const

/** 갑옷 — 흉갑의 금속색. 머리는 맨머리다: 저기가 답이라는 뜻 (형의 주문). */
const ARMOR = '#8fa3b5'
const ARMOR_LINE = '#373e4b'
const ARROW_COL = '#e8dcc0'

/**
 * 사람 하나를 그린다. `legs`가 false면 상반신만 (창가의 사수 — 하반신은 벽 뒤다).
 *
 * ux·uy는 **화면 좌표계**의 조준 단위벡터다 (y가 아래로 +). 호출자가 나를 향하도록 준다.
 * clip이 주어지면 몸통·머리만 그 안으로 잘린다. **활과 활팔은 클립 밖**이다 —
 * 창밖으로 내민 활이어야 하니까.
 */
export function drawFoeArcher(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, rx: number, ry: number,
  ux: number, uy: number,
  drawF: number,
  col: string, armored: boolean, legs: boolean,
  clip: { x: number; y: number; w: number; h: number } | null,
): void {
  // 조준축에 수직인 '위' 벡터. 화면 y는 아래로 +라 위를 향하는 쪽을 고른다.
  let vx = uy
  let vy = -ux
  if (vy > 0) {
    vx = -vx
    vy = -vy
  }

  const lw = Math.max(2, rx * 0.14)
  const thin = Math.max(1.2, rx * 0.07)

  // 어깨 — 두 팔의 회전축.
  const shX = x + vx * ry * F.shoulder
  const shY = y + vy * ry * F.shoulder
  // 턱(앵커) — 만작에서 시위손이 오는 자리.
  const ax = shX + ux * rx * F.jawFwd + vx * rx * F.jawUp
  const ay = shY + uy * rx * F.jawFwd + vy * rx * F.jawUp
  // 활손(그립) — 어깨에서 조준선으로 곧게 뻗은 팔 끝. **당김이 이 점을 옮기지 않는다.**
  const gx = shX + ux * rx * F.reach + vx * rx * F.gripUp
  const gy = shY + uy * rx * F.reach + vy * rx * F.gripUp

  // ── 몸통·머리 (클립 안) ──
  ctx.save()
  if (clip !== null) {
    ctx.beginPath()
    ctx.rect(clip.x, clip.y, clip.w, clip.h)
    ctx.clip()
  }
  // 머리 — 몸통 **중심**에서 곧장 잰다(어깨를 안 거친다). sim/target.ts의 헤드샷 판정이
  // 정확히 이 식(target.y + target.r * archerHeadUp)이라, 그림과 판정이 같은 자리를 본다.
  const hx = x + vx * rx * P.enemy.archerHeadUp
  const hy = y + vy * rx * P.enemy.archerHeadUp
  const hr = Math.max(2, rx * P.enemy.archerHeadR)
  ctx.strokeStyle = col
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = lw * 1.3
  // 척추 — 어깨에서 골반으로. 창가의 사수는 창턱 아래로 사라진다.
  const hipX = shX - vx * ry * (legs ? F.hip + F.shoulder : 1.5)
  const hipY = shY - vy * ry * (legs ? F.hip + F.shoulder : 1.5)
  ctx.beginPath()
  ctx.moveTo(shX, shY)
  ctx.lineTo(hipX, hipY)
  ctx.stroke()

  if (legs) {
    // 다리 — 조준축이 아니라 화면 기준으로 선다. 사람은 땅을 딛는다.
    ctx.lineWidth = lw
    const footY = y + ry
    ctx.beginPath()
    ctx.moveTo(hipX, hipY)
    ctx.lineTo(x - rx * F.stance, footY)
    ctx.moveTo(hipX, hipY)
    ctx.lineTo(x + rx * F.stance, footY)
    ctx.stroke()
  }

  // 목 — 어깨에서 머리로. 이게 없으면 머리가 몸에서 떨어져 둥둥 떠 보인다
  // (형의 지적: "목이랑 머리가 분리되어있고"). stickman.ts의 플레이어 목과 같은 문법이다.
  ctx.lineWidth = lw
  ctx.beginPath()
  ctx.moveTo(shX, shY)
  ctx.lineTo(hx, hy)
  ctx.stroke()

  if (armored) {
    // 흉갑 — 어깨가 넓고 허리로 좁아지는 판. 몸통이 안 통하는 이유가 형태로 읽힌다.
    const aw = rx * 0.46
    const t0x = shX + vx * ry * 0.04
    const t0y = shY + vy * ry * 0.04
    const b0x = shX - vx * ry * 0.62
    const b0y = shY - vy * ry * 0.62
    ctx.fillStyle = ARMOR
    ctx.beginPath()
    ctx.moveTo(t0x - ux * aw, t0y - uy * aw)
    ctx.lineTo(t0x + ux * aw, t0y + uy * aw)
    ctx.lineTo(b0x + ux * aw * 0.55, b0y + uy * aw * 0.55)
    ctx.lineTo(b0x - ux * aw * 0.55, b0y - uy * aw * 0.55)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = ARMOR_LINE
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(t0x - ux * aw * 0.6 - vx * ry * 0.16, t0y - uy * aw * 0.6 - vy * ry * 0.16)
    ctx.lineTo(t0x + ux * aw * 0.6 - vx * ry * 0.16, t0y + uy * aw * 0.6 - vy * ry * 0.16)
    ctx.stroke()
  }

  // 머리 — 채운다. 선만으로는 실루엣의 무게중심이 안 생긴다 (GDD 8장).
  ctx.fillStyle = col
  ctx.beginPath()
  ctx.arc(hx, hy, hr, 0, TAU)
  ctx.fill()
  ctx.restore()

  // ── 활팔 · 활 · 시위 (클립 밖 — 창밖으로 내민다) ──
  ctx.strokeStyle = col
  ctx.lineWidth = lw * 0.86
  ctx.beginPath()
  ctx.moveTo(shX, shY)
  ctx.lineTo(gx, gy)
  ctx.stroke()

  const half = ry * F.bow
  const back = half * (F.brace + F.backGain * drawF)
  const limbV = half * (1 - F.squeeze * drawF)
  const tAx = gx + vx * limbV - ux * back
  const tAy = gy + vy * limbV - uy * back
  const tBx = gx - vx * limbV - ux * back
  const tBy = gy - vy * limbV - uy * back
  const rV = half * F.riser
  const cV = rV + (limbV - rV) * F.ctrlV
  const cU = back * F.ctrlBack

  ctx.lineWidth = Math.max(1.5, rx * 0.1)
  ctx.beginPath()
  ctx.moveTo(tAx, tAy)
  ctx.quadraticCurveTo(gx + vx * cV - ux * cU, gy + vy * cV - uy * cU, gx + vx * rV, gy + vy * rV)
  ctx.lineTo(gx - vx * rV, gy - vy * rV)
  ctx.quadraticCurveTo(gx - vx * cV - ux * cU, gy - vy * cV - uy * cU, tBx, tBy)
  ctx.stroke()

  // 시위손 — 당김 0이면 시위 그 자리, 예고가 깊어질수록 턱으로 온다.
  const rx0 = gx - ux * back
  const ry0 = gy - uy * back
  const dx = rx0 + (ax - rx0) * drawF
  const dy = ry0 + (ay - ry0) * drawF

  // 시위 — 두 고자 끝에서 시위손으로 꺾인다.
  ctx.lineWidth = thin
  ctx.strokeStyle = col
  ctx.globalAlpha = 0.75
  ctx.beginPath()
  ctx.moveTo(tAx, tAy)
  ctx.lineTo(dx, dy)
  ctx.lineTo(tBx, tBy)
  ctx.stroke()
  ctx.globalAlpha = 1

  // 물린 화살 — 예고 동안만. 날아올 것이 **미리 보인다**는 게 이 게임의 계약이다.
  if (drawF > 0.02) {
    ctx.strokeStyle = ARROW_COL
    ctx.lineWidth = Math.max(1.2, rx * 0.075)
    ctx.beginPath()
    ctx.moveTo(dx, dy)
    ctx.lineTo(dx + ux * rx * F.arrow, dy + uy * rx * F.arrow)
    ctx.stroke()
  }

  // 시위팔 — 어깨 → 팔꿈치 → 시위손. 팔꿈치는 화살선보다 살짝 위 (닭날개 금지).
  ctx.strokeStyle = col
  ctx.lineWidth = lw
  ctx.beginPath()
  ctx.moveTo(shX, shY)
  ctx.lineTo(dx - ux * rx * F.elbow + vx * rx * 0.08, dy - uy * rx * F.elbow + vy * rx * 0.08)
  ctx.lineTo(dx, dy)
  ctx.stroke()

  // 두 주먹 — 왼손은 활대를, 오른손은 줄을 쥐었다.
  ctx.fillStyle = col
  const fr = Math.max(lw * F.fist, 1.6)
  ctx.beginPath()
  ctx.arc(gx, gy, fr, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(dx, dy, fr, 0, TAU)
  ctx.fill()
}
