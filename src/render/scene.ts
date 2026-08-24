/**
 * 장면 조립 — 배경 → 지면 → 과녁 → 궤적 → 화살 → 궁수 → 이펙트 → HUD.
 *
 * ARCHITECTURE A1: World는 읽기만 한다. events도 읽되 비우지 않는다 (게임 루프가 소비).
 * A5: save/restore 남발 금지, shadowBlur·filter 금지, 프레임당 힙 할당 0.
 */
import { TAU, lerp, valueNoise } from '../core/math.ts'
import { P } from '../tune/params.ts'
import { TRAIL_POINTS } from '../sim/types.ts'
import type { Target, World } from '../sim/types.ts'
import {
  THEME, createCamera, resizeCamera, updateCamera, worldToScreenX, worldToScreenY, screenToWorldX,
} from './camera.ts'
import type { Camera } from './camera.ts'
import { drawArcher } from './stickman.ts'
import { createFx, pumpEvents, updateFx, drawFx, hitStopMs, targetSquash } from './effects.ts'
import type { Fx } from './effects.ts'
import { drawHud } from './hud.ts'
import type { HudState } from './hud.ts'

/**
 * 능선 높이 테이블. valueNoise는 호출마다 클로저를 만들어서(core/math.ts) 매 프레임 90번 부르면
 * 프레임당 힙 할당 0이 깨진다 (A5). 생성 시 한 번만 굽고, 그릴 땐 인덱싱+보간만 한다.
 */
const RIDGE_N = 160
const RIDGE_X0 = -10
const RIDGE_X1 = 40
const RIDGE_STEP = (RIDGE_X1 - RIDGE_X0) / (RIDGE_N - 1)

/** 배경 실루엣 2겹 (GDD 8장 — 색 수를 극도로 제한) */
const BG = {
  segments: 44,
  farBase: 6.4,
  farAmp: 2.1,
  farFreq: 0.055,
  farParallax: 0.35,
  nearBase: 3.4,
  nearAmp: 1.3,
  nearFreq: 0.11,
  nearParallax: 0.62,
  groundLineW: 1.5,
} as const

const DRAW = {
  arrowLen: 0.72,
  /** 화살촉 길이 / 반너비 (화살 길이 대비). 선 하나로 그리면 어느 쪽이 앞인지 안 읽힌다. */
  arrowHead: 0.26,
  arrowHeadW: 0.075,
  /** 깃 — 뒤끝에서 앞으로 이만큼 지점에 사선 둘 */
  arrowFletch: 0.2,
  arrowWidthPx: 2,
  trailWidthPx: 1.7,

  /**
   * 과녁의 띠 (반경 비율, 바깥부터).
   *
   * 예전에는 얇은 원 두 개 + 가운데 사각형이었다. 어두운 배경에서 **선만** 있으니
   * 멀리 있는 작은 과녁이 배경에 묻혔고, "어디가 중심인지"도 링 두 개로는 안 읽혔다.
   * 이제 면으로 채운 띠 넷이다 — 밝은 테로 찾고, 어두운 띠로 테를 떼어내고,
   * 강조색으로 중심을 부르고, 흰 점이 정중앙이다. 색은 하나도 늘지 않았다 (GDD 8장).
   */
  ringRim: 1,
  ringBand: 0.76,
  ringAccent: 0.5,
  ringCore: 0.2,
  targetLineW: 2,
  /** 반경이 이보다 작으면 띠를 다 그려봐야 뭉갠다. 점 하나로 떨어진다 (px). */
  ringMinPx: 5,

  aerialStem: 0.35,
  /** 공중 과녁 후광 — 매달린 등불이라는 걸 말해주는 유일한 신호 */
  haloRings: 2,
  haloStep: 0.42,
  haloAlpha: 0.22,

  /** 지면 기둥. 이보다 높이 뜬 과녁은 세운 게 아니라 매달린 것으로 본다 (m). */
  postMaxY: 4.4,
  postW: 2,
  /** 보급 과녁 십자의 길이(반경 비율)와 굵기(반경 비율) */
  bonusCross: 0.55,
  bonusCrossW: 0.16,
  /** 돌진 과녁이 궁수까지 남긴 거리를 보여주는 선 */
  threatLineW: 1.5,
  threatLineAlpha: 0.3,
  /** 이 거리(m) 안으로 들어오면 선이 위험색으로 깜빡인다 */
  threatNear: 8,
  threatPulseHz: 3,
  /** 이동 과녁의 레일 — 어디까지 가는지 미리 보여준다. 리드 샷은 예측이지 반사신경이 아니다. */
  railW: 1.5,
  railAlpha: 0.5,
  railCapPx: 3,

  // ── 하늘 ──
  stars: 70,
  starParallax: 0.06,
  starSizePx: 1.6,
  moonX: 0.82,
  moonY: 0.2,
  moonR: 26,
  moonInset: 0.34,

  // ── 땅의 결 ──
  tufts: 54,
  tuftH: 0.34,
  tuftW: 1.2,
} as const

/**
 * 바람 깃발 — **지금까지 화면에 없던 것.**
 *
 * 26판부터 바람이 부는데(stages.ts), 화면에는 바람을 알려주는 게 하나도 없었다.
 * GDD가 "깃발을 보고 기다렸다 쏘는 판단이 성립하게 한다"고 적어둔 그 깃발이 없어서,
 * 바람 판은 읽고 대응하는 판이 아니라 **그냥 빗나가는 판**이었다.
 *
 * 깃대는 궁수와 첫 과녁 사이에 선다 — 조준선 위가 아니라 아래쪽 지면이다 (C1: 조준을 가리지 않는다).
 */
const FLAG = {
  /** 궁수에서 이만큼 앞 (m) */
  atX: 6.5,
  poleH: 3.2,
  poleW: 2,
  /** 천의 길이 (m) 와 폭 */
  clothLen: 1.5,
  clothH: 0.45,
  /** 파형 마디 수와 흔들리는 속도 (Hz). 시계는 sim tick 이라 결정론이다. */
  waveSegs: 6,
  waveHz: 1.6,
  /**
   * 풍속 1m/s당 천이 들리는 각 (rad). 무풍이면 slack 만큼 아래로 늘어지고,
   * 세질수록 수평에 가까워진다. **수평을 넘지는 않는다** — 깃발은 바람에 들리는 게 아니라
   * 끌려가는 것이라 위로 솟으면 거짓말이 된다.
   *
   * 실제 판의 풍속은 2.5~6.5 m/s 다 (stages.ts · endless.ts). 그 구간에서 각이 골고루
   * 벌어져야 눈금이 된다 — 0.19에서는 2 m/s가 -50°, 6 m/s가 -6°로 아래쪽에 몰려 있었다.
   * 0.24면 2 m/s -44° · 4 m/s -17° · 5 m/s 이상 수평이다 (렌더 프로브로 실측).
   */
  liftPerSpeed: 0.24,
  liftMax: 1.25,
  /** 무풍일 때 늘어진 각 (rad, 아래쪽) */
  slack: -1.25,
  /** 펄럭임 진폭 (m). 풍속에 비례해 커진다. */
  flutter: 0.12,
  /** 이 풍속(m/s)에서 펄럭임이 최대 */
  flutterFull: 3,
} as const

/**
 * 궤적 알파 밴드 수. 세그먼트마다 stroke를 부르면 화살 하나당 프레임당 47회가 나가고,
 * globalAlpha<1 에서 round lineCap이 관절마다 겹쳐 이중 블렌딩으로 선이 마디져 보인다.
 * 밴드로 묶어 폴리라인 하나씩만 그린다 (effects.ts의 유령 궤적이 이미 쓰는 방식).
 */
const TRAIL_BANDS = 4

export interface Renderer {
  resize(): void
  /**
   * hud는 game/ui 레이어의 상태다 (훈련치·음소거). World(=sim)에 넣지 않고 인자로 받는다 (A1).
   * 같은 객체를 매 프레임 제자리에서 갱신해 넘긴다 — 프레임당 할당 0 (A5).
   */
  draw(w: World, alpha: number, dtReal: number, hud: HudState): void
  dispose(): void
}

interface RendererX extends Renderer {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  cam: Camera
  fx: Fx
  far: Float32Array
  near: Float32Array
  stars: Float32Array
  tufts: Float32Array
  grad: CanvasGradient | null
  gradH: number
  dead: boolean
}

function bakeRidge(base: number, amp: number, freq: number, seed: number): Float32Array {
  const tab = new Float32Array(RIDGE_N)
  for (let i = 0; i < RIDGE_N; i++) {
    tab[i] = base + valueNoise((RIDGE_X0 + i * RIDGE_STEP) * freq, seed) * amp
  }
  return tab
}

function drawRidge(
  ctx: CanvasRenderingContext2D, cam: Camera,
  tab: Float32Array, parallax: number, color: string,
): void {
  const step = cam.w / BG.segments
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, cam.h)
  for (let i = 0; i <= BG.segments; i++) {
    const sx = i * step
    // 원경일수록 월드 좌표를 덜 반영해 느리게 흐른다
    const u = (screenToWorldX(cam, sx) * parallax - RIDGE_X0) / RIDGE_STEP
    const j = u < 0 ? 0 : u > RIDGE_N - 2 ? RIDGE_N - 2 : u | 0
    const f = u - j < 0 ? 0 : u - j > 1 ? 1 : u - j
    const h = lerp(tab[j] ?? 0, tab[j + 1] ?? 0, f)
    ctx.lineTo(sx, worldToScreenY(cam, h))
  }
  ctx.lineTo(cam.w, cam.h)
  ctx.closePath()
  ctx.fill()
}

/** 채운 타원 하나. 띠를 바깥부터 겹쳐 그리면 그게 곧 과녁의 링이 된다. */
function band(
  ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string,
): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

/** 마름모 하나. 관통 과녁의 실루엣 — 색을 못 봐도 "얘는 뚫린다"가 모양으로 읽힌다. */
function diamond(
  ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string,
): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y - ry)
  ctx.lineTo(x + rx, y)
  ctx.lineTo(x, y + ry)
  ctx.lineTo(x - rx, y)
  ctx.closePath()
  ctx.fill()
}

/**
 * 과녁을 지면에 세운 기둥. 낮게 놓인 과녁만 — 높이 뜬 건 매달린 것이다.
 * 아주 어둡게 긋는다. **있는 줄 모를 만큼**이어야 조준을 방해하지 않는다 (GDD 7장 절제).
 */
function drawPost(
  ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, wy: number, r: number,
): void {
  if (wy > DRAW.postMaxY) return
  const gy = worldToScreenY(cam, 0)
  if (gy <= y + r) return
  ctx.strokeStyle = THEME.prop
  ctx.lineWidth = DRAW.postW
  ctx.beginPath()
  ctx.moveTo(x, y + r)
  ctx.lineTo(x, gy)
  ctx.stroke()
}

/**
 * 이동 과녁이 오갈 구간. **리드 샷은 예측이지 반사신경이 아니다** — 어디까지 가는지
 * 미리 보이지 않으면 첫 발은 언제나 운이다. 양끝에 짧은 마개를 찍어 구간의 끝을 못박는다.
 */
function drawRail(ctx: CanvasRenderingContext2D, cam: Camera, t: Target): void {
  if (t.kind !== 'moving') return
  const ax = t.ampX
  const ay = t.ampY
  if (ax === 0 && ay === 0) return
  const x0 = worldToScreenX(cam, t.baseX - ax)
  const y0 = worldToScreenY(cam, t.baseY - ay)
  const x1 = worldToScreenX(cam, t.baseX + ax)
  const y1 = worldToScreenY(cam, t.baseY + ay)

  ctx.globalAlpha = DRAW.railAlpha
  ctx.strokeStyle = THEME.prop
  ctx.lineWidth = DRAW.railW
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()

  // 끝 마개 — 진행 방향과 직각으로 짧게.
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  if (len > 1) {
    const nx = (-dy / len) * DRAW.railCapPx
    const ny = (dx / len) * DRAW.railCapPx
    ctx.beginPath()
    ctx.moveTo(x0 - nx, y0 - ny)
    ctx.lineTo(x0 + nx, y0 + ny)
    ctx.moveTo(x1 - nx, y1 - ny)
    ctx.lineTo(x1 + nx, y1 + ny)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/**
 * 돌진 과녁에서 궁수까지 남은 거리를 잇는 선.
 *
 * **얼마나 남았는지가 보여야 판단이 성립한다.** 다른 과녁을 먼저 정리할지, 지금 저걸 쏠지 —
 * 그 판단이 이 메커닉의 전부인데, 남은 거리를 눈대중으로만 재게 하면 판단이 아니라 도박이 된다.
 * 가까워지면 위험색으로 깜빡인다.
 */
function drawThreatLine(
  ctx: CanvasRenderingContext2D, cam: Camera, w: World, t: Target, x: number, y: number,
): void {
  const dist = t.x - w.archer.x
  const near = dist < DRAW.threatNear
  const ax = worldToScreenX(cam, w.archer.x)
  const ay = worldToScreenY(cam, w.archer.y)
  // 시계는 sim tick 이다. 실시간을 쓰면 리플레이에서 다른 그림이 나온다 (A1).
  const pulse = near ? 0.35 + 0.65 * Math.abs(Math.sin(w.tick * w.dt * DRAW.threatPulseHz * TAU)) : 1
  ctx.globalAlpha = DRAW.threatLineAlpha * pulse
  ctx.strokeStyle = near ? THEME.threat : THEME.threatDim
  ctx.lineWidth = DRAW.threatLineW
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(x, y)
  ctx.stroke()
  ctx.globalAlpha = 1
}

function drawTargets(
  ctx: CanvasRenderingContext2D, cam: Camera, w: World, alpha: number, fx: Fx,
): void {
  for (let i = 0; i < w.targets.length; i++) {
    const t = w.targets[i]
    if (t === undefined || !t.alive) continue
    const wy = lerp(t.py, t.y, alpha)
    const x = worldToScreenX(cam, lerp(t.px, t.x, alpha))
    const y = worldToScreenY(cam, wy)
    const r = t.r * cam.scale
    if (r < 0.5) continue

    // 받침은 과녁보다 먼저. 나중에 그리면 링 위로 선이 지나간다.
    if (!t.falling) {
      drawRail(ctx, cam, t)
      if (t.kind === 'static' || t.kind === 'pierceable') drawPost(ctx, cam, x, y, wy, r)
      if (t.kind === 'charger' || t.kind === 'boss') drawThreatLine(ctx, cam, w, t, x, y)
    }

    // 맞은 순간 눌렸다 부푼다 (HOOK ★6-2). 즉사한 과녁은 여기 안 오므로(alive false)
    // 그쪽 몫은 effects.ts가 파열 링으로 대신 그린다 — 여기서 눌리는 건 살아남는 과녁,
    // 즉 낙하 중인 공중 과녁과 관통 과녁뿐이다.
    // ★ 반환값은 공유 스크래치라 **다음 호출 전에** 다 읽는다 (A5).
    const sq = targetSquash(fx, t.id)
    const rx = r * sq.sx
    const ry = r * sq.sy

    // 맞아서 떨어지는 중인 과녁은 이미 죽은 것이다. 아직 살아 있는 것과 헷갈리면 안 된다.
    if (t.falling) ctx.globalAlpha = 0.55

    if (t.kind === 'aerial') {
      // 매달린 등불 — 줄과 후광. 후광이 "떨어질 수 있는 것"이라고 말한다.
      ctx.strokeStyle = THEME.accentDim
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, y - ry)
      ctx.lineTo(x, y - ry - DRAW.aerialStem * cam.scale)
      ctx.stroke()
      if (!t.falling) {
        ctx.strokeStyle = THEME.accent
        for (let h = 1; h <= DRAW.haloRings; h++) {
          ctx.globalAlpha = DRAW.haloAlpha / h
          const k = 1 + DRAW.haloStep * h
          ctx.beginPath()
          ctx.ellipse(x, y, rx * k, ry * k, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }
    }

    if (t.kind === 'boss') {
      // ★ 보스 (docs/RUN.md 3장). 몸통은 위험색 겹띠 — 크기 자체가 위협이라 조형은 단순하게.
      band(ctx, x, y, rx, ry, THEME.threat)
      band(ctx, x, y, rx * 0.86, ry * 0.86, THEME.threatDim)
      band(ctx, x, y, rx * 0.3, ry * 0.3, THEME.targetBand)
      // 머리 — 약점. 밝은 테로 "여길 쏘라"가 읽혀야 한다.
      const hy = y - ry * P.target.bossHeadUp
      const hr = Math.max(3, rx * P.target.bossHeadR)
      band(ctx, x, hy, hr, hr, THEME.target2)
      band(ctx, x, hy, hr * 0.55, hr * 0.55, THEME.threat)
      // 남은 체력 — 몸통 위 눈금. 숫자보다 점이 멀리서 읽힌다.
      ctx.fillStyle = THEME.target2
      const pipR = Math.max(2, rx * 0.05)
      const gap = pipR * 3
      const x0 = x - ((t.hp - 1) * gap) / 2
      for (let p = 0; p < t.hp; p++) {
        ctx.beginPath()
        ctx.arc(x0 + p * gap, hy - hr - pipR * 4, pipR, 0, TAU)
        ctx.fill()
      }
    } else if (t.kind === 'charger') {
      // ★ 나를 향해 오는 것. **왼쪽을 가리키는 뾰족한 삼각형** — 다른 어떤 과녁과도
      // 실루엣이 겹치지 않아야 한다. 색을 못 봐도 "저건 다르다"가 먼저 와야 하기 때문이다.
      // 뒤로 흐르는 꼬리 둘이 진행 방향을 말한다.
      ctx.strokeStyle = THEME.threatDim
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x + rx * 0.6, y - ry * 0.5)
      ctx.lineTo(x + rx * 1.9, y - ry * 0.5)
      ctx.moveTo(x + rx * 0.6, y + ry * 0.5)
      ctx.lineTo(x + rx * 1.9, y + ry * 0.5)
      ctx.stroke()

      ctx.fillStyle = THEME.threat
      ctx.beginPath()
      ctx.moveTo(x - rx, y)
      ctx.lineTo(x + rx * 0.8, y - ry)
      ctx.lineTo(x + rx * 0.8, y + ry)
      ctx.closePath()
      ctx.fill()
      // 중심 표시 — 이것도 과녁이라 정중앙이 있다.
      band(ctx, x, y, rx * DRAW.ringCore, ry * DRAW.ringCore, THEME.target2)
    } else if (t.kind === 'bonus') {
      // 보급 — 청록 원에 십자. "지우는 것"이 아니라 "얻는 것"이라고 모양이 말한다.
      band(ctx, x, y, rx, ry, THEME.bonus)
      band(ctx, x, y, rx * DRAW.ringBand, ry * DRAW.ringBand, THEME.targetBand)
      ctx.strokeStyle = THEME.bonus
      ctx.lineWidth = Math.max(1.5, r * DRAW.bonusCrossW)
      ctx.lineCap = 'butt'
      const cw = rx * DRAW.bonusCross
      const ch = ry * DRAW.bonusCross
      ctx.beginPath()
      ctx.moveTo(x - cw, y)
      ctx.lineTo(x + cw, y)
      ctx.moveTo(x, y - ch)
      ctx.lineTo(x, y + ch)
      ctx.stroke()
    } else if (r < DRAW.ringMinPx) {
      // 너무 작다. 띠를 다 그리면 뭉개져 오히려 안 보인다 — 밝은 점 하나가 낫다.
      band(ctx, x, y, rx, ry, THEME.targetRim)
      band(ctx, x, y, rx * DRAW.ringAccent, ry * DRAW.ringAccent, THEME.accent)
    } else if (t.kind === 'pierceable') {
      // 마름모 세 겹. 원과 실루엣이 달라야 "뚫린다"가 모양으로 읽힌다.
      diamond(ctx, x, y, rx, ry, THEME.targetRim)
      diamond(ctx, x, y, rx * DRAW.ringBand, ry * DRAW.ringBand, THEME.targetBand)
      diamond(ctx, x, y, rx * DRAW.ringAccent, ry * DRAW.ringAccent, THEME.accent)
    } else {
      // 밝은 테로 찾고 → 어두운 띠로 테를 떼어내고 → 강조색이 중심을 부르고 → 흰 점이 정중앙.
      band(ctx, x, y, rx, ry, THEME.targetRim)
      band(ctx, x, y, rx * DRAW.ringBand, ry * DRAW.ringBand, THEME.targetBand)
      band(ctx, x, y, rx * DRAW.ringAccent, ry * DRAW.ringAccent, THEME.accent)
      band(ctx, x, y, rx * DRAW.ringCore, ry * DRAW.ringCore, THEME.target2)
    }

    ctx.globalAlpha = 1
  }
}

/**
 * 바람 깃발. `w.wind`는 이미 돌풍까지 반영된 **지금 이 순간의** 풍속이라
 * 천이 눕는 정도가 곧 화살이 받을 힘이다 — 보고 기다렸다 쏘면 된다.
 *
 * 시계는 `w.tick * w.dt`. 실시간을 쓰면 같은 리플레이에서 다른 그림이 나온다 (A1).
 */
function drawWindFlag(ctx: CanvasRenderingContext2D, cam: Camera, w: World): void {
  if (w.stage.wind === 0) return

  const baseX = w.archer.x + FLAG.atX
  const px = worldToScreenX(cam, baseX)
  const gy = worldToScreenY(cam, 0)

  ctx.strokeStyle = THEME.windPole
  ctx.lineWidth = FLAG.poleW
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(px, gy)
  ctx.lineTo(px, worldToScreenY(cam, FLAG.poleH))
  ctx.stroke()

  const mag = Math.abs(w.wind)
  const dir = w.wind >= 0 ? 1 : -1
  // 무풍이면 늘어지고, 셀수록 수평에 가깝게 들린다. 이 각도 하나가 풍속의 눈금이다.
  const lift = FLAG.slack + Math.min(FLAG.liftMax, mag * FLAG.liftPerSpeed)
  const t = w.tick * w.dt
  const flutter = FLAG.flutter * Math.min(1, mag / FLAG.flutterFull)

  ctx.strokeStyle = THEME.windCloth
  ctx.lineWidth = Math.max(1.5, FLAG.clothH * cam.scale)
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i <= FLAG.waveSegs; i++) {
    const u = i / FLAG.waveSegs
    const along = u * FLAG.clothLen
    // 뒤로 갈수록 크게 펄럭인다. 깃대에 묶인 쪽은 움직이지 않는다.
    const wave = Math.sin(t * FLAG.waveHz * TAU - u * TAU) * flutter * u
    const sx = worldToScreenX(cam, baseX + dir * along * Math.cos(lift))
    const sy = worldToScreenY(cam, FLAG.poleH + along * Math.sin(lift) + wave)
    if (i === 0) ctx.moveTo(sx, sy)
    else ctx.lineTo(sx, sy)
  }
  ctx.stroke()
  ctx.lineCap = 'butt'
}

function drawTrails(ctx: CanvasRenderingContext2D, cam: Camera, w: World): void {
  ctx.lineWidth = DRAW.trailWidthPx
  ctx.lineCap = 'round'
  ctx.strokeStyle = THEME.trailHit
  for (let i = 0; i < w.arrows.length; i++) {
    const ar = w.arrows[i]
    if (ar === undefined || !ar.alive) continue
    const n = ar.trailLen < TRAIL_POINTS ? ar.trailLen : TRAIL_POINTS
    if (n < 2) continue
    // 오래된 점일수록 옅게. 링버퍼를 뒤에서부터 되짚되, 알파를 밴드로 묶어 밴드마다 한 번만 stroke.
    for (let b = 0; b < TRAIL_BANDS; b++) {
      const j0 = (((n - 1) * b) / TRAIL_BANDS) | 0
      const j1 = (((n - 1) * (b + 1)) / TRAIL_BANDS) | 0
      if (j1 <= j0) continue
      ctx.globalAlpha = ((b + 1) / TRAIL_BANDS) * 0.7
      ctx.beginPath()
      for (let j = j0; j <= j1; j++) {
        const idx = ((ar.trailHead - n + j) % TRAIL_POINTS + TRAIL_POINTS) % TRAIL_POINTS
        const sx = worldToScreenX(cam, ar.trail[idx * 2] ?? 0)
        const sy = worldToScreenY(cam, ar.trail[idx * 2 + 1] ?? 0)
        if (j === j0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

/**
 * 날아가는 화살. 대 + 촉 + 깃.
 *
 * 예전엔 선 하나였다. 빠를 땐 궤적이 방향을 말해주지만 정점에서 느려지는 순간
 * **어느 쪽이 앞인지** 알 수가 없었다. 촉이 있으면 멈춰 있어도 방향이 읽힌다.
 */
function drawArrows(ctx: CanvasRenderingContext2D, cam: Camera, w: World, alpha: number): void {
  ctx.lineCap = 'round'
  for (let i = 0; i < w.arrows.length; i++) {
    const ar = w.arrows[i]
    if (ar === undefined || !ar.alive) continue
    const wx = lerp(ar.px, ar.x, alpha)
    const wy = lerp(ar.py, ar.y, alpha)
    const ux = Math.cos(ar.angle)
    const uy = Math.sin(ar.angle)
    const tipX = worldToScreenX(cam, wx)
    const tipY = worldToScreenY(cam, wy)
    // 애기살(편전)은 반 길이 — 통아를 떠난 짧은 살이 그대로 난다 (stickman.ts와 같은 비율).
    const shaft = w.arrowKind === 'pierce' ? DRAW.arrowLen * 0.52 : DRAW.arrowLen
    const backX = worldToScreenX(cam, wx - ux * shaft)
    const backY = worldToScreenY(cam, wy - uy * shaft)
    // 화면 방향의 단위 벡터. 월드는 y가 위로 +, 화면은 아래로 + 라 여기서 한 번 뒤집힌다.
    const dx = tipX - backX
    const dy = tipY - backY
    const len = Math.hypot(dx, dy)
    if (len < 1) continue
    const sx = dx / len
    const sy = dy / len
    const nx = -sy
    const ny = sx

    ctx.strokeStyle = THEME.arrow
    ctx.lineWidth = DRAW.arrowWidthPx
    ctx.beginPath()
    ctx.moveTo(backX, backY)
    ctx.lineTo(tipX, tipY)
    ctx.stroke()

    // 촉 — 채운 삼각형. 화살이라는 걸 말하는 부분이라 제일 또렷하다.
    const hl = len * DRAW.arrowHead
    const hw = len * DRAW.arrowHeadW
    ctx.fillStyle = THEME.arrow
    ctx.beginPath()
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX - sx * hl + nx * hw, tipY - sy * hl + ny * hw)
    ctx.lineTo(tipX - sx * hl - nx * hw, tipY - sy * hl - ny * hw)
    ctx.closePath()
    ctx.fill()

    // 깃 — 뒤끝의 사선 둘. 작게. 여기까지 그리면 실루엣이 완성된다.
    const fl = len * DRAW.arrowFletch
    ctx.strokeStyle = THEME.bodyDim
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(backX, backY)
    ctx.lineTo(backX + sx * fl + nx * fl * 0.5, backY + sy * fl + ny * fl * 0.5)
    ctx.moveTo(backX, backY)
    ctx.lineTo(backX + sx * fl - nx * fl * 0.5, backY + sy * fl - ny * fl * 0.5)
    ctx.stroke()
  }
}

/**
 * 하늘 — 별과 달.
 *
 * 좌표는 만들 때 한 번만 굽는다. 매 프레임 난수를 뽑으면 별이 깜빡이는 게 아니라 **춤춘다**.
 * 시차는 거의 0이다 (아주 멀리 있으니까). 그래서 카메라가 움직여도 하늘은 거의 제자리다.
 */
function bakeStars(): Float32Array {
  const tab = new Float32Array(DRAW.stars * 3)
  for (let i = 0; i < DRAW.stars; i++) {
    // valueNoise 는 시드가 다르면 다른 파형이라, 축마다 다른 시드로 뽑으면 격자가 안 생긴다.
    tab[i * 3] = (valueNoise(i * 1.7, 101) + 1) * 0.5
    tab[i * 3 + 1] = (valueNoise(i * 2.3, 202) + 1) * 0.5
    tab[i * 3 + 2] = (valueNoise(i * 3.1, 303) + 1) * 0.5
  }
  return tab
}

function drawSky(ctx: CanvasRenderingContext2D, cam: Camera, stars: Float32Array): void {
  // 달 — 초승달. 밝은 원 하나를 배경색 원으로 베어낸다 (그림자·필터 금지, A5).
  const mx = cam.w * DRAW.moonX
  const my = cam.h * DRAW.moonY
  ctx.fillStyle = THEME.moon
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.arc(mx, my, DRAW.moonR, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = THEME.sky0
  ctx.beginPath()
  ctx.arc(mx - DRAW.moonR * DRAW.moonInset, my - DRAW.moonR * DRAW.moonInset, DRAW.moonR, 0, TAU)
  ctx.fill()

  ctx.fillStyle = THEME.star
  const drift = cam.x * DRAW.starParallax * cam.scale
  for (let i = 0; i < DRAW.stars; i++) {
    const u = stars[i * 3] ?? 0
    const v = stars[i * 3 + 1] ?? 0
    const b = stars[i * 3 + 2] ?? 0
    // 화면 위쪽 절반에만. 아래쪽은 능선과 지면이 먹는다.
    const sy = v * cam.h * 0.5
    let sx = u * cam.w - drift
    // 화면 폭으로 감싼다. 카메라가 멀리 가도 하늘이 비지 않는다.
    sx = ((sx % cam.w) + cam.w) % cam.w
    const size = DRAW.starSizePx * (0.5 + b)
    ctx.globalAlpha = 0.25 + b * 0.55
    ctx.fillRect(sx, sy, size, size)
  }
  ctx.globalAlpha = 1
}

/**
 * 지면의 결 — 짧은 풀 몇 포기. 지면선 하나만 있으면 바닥이 '선'이지 '땅'이 아니다.
 * 월드 좌표에 박아 두어 카메라와 같이 흐른다 (시차 1).
 */
function bakeTufts(): Float32Array {
  const tab = new Float32Array(DRAW.tufts * 2)
  for (let i = 0; i < DRAW.tufts; i++) {
    tab[i * 2] = RIDGE_X0 + ((valueNoise(i * 1.31, 404) + 1) * 0.5) * (RIDGE_X1 - RIDGE_X0)
    tab[i * 2 + 1] = 0.4 + (valueNoise(i * 2.11, 505) + 1) * 0.5
  }
  return tab
}

function drawTufts(ctx: CanvasRenderingContext2D, cam: Camera, tufts: Float32Array): void {
  ctx.strokeStyle = THEME.grass
  ctx.lineWidth = DRAW.tuftW
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i < DRAW.tufts; i++) {
    const wx = tufts[i * 2] ?? 0
    const h = (tufts[i * 2 + 1] ?? 1) * DRAW.tuftH
    const sx = worldToScreenX(cam, wx)
    if (sx < -8 || sx > cam.w + 8) continue
    const gy = worldToScreenY(cam, 0)
    ctx.moveTo(sx, gy)
    ctx.lineTo(sx + h * cam.scale * 0.35, worldToScreenY(cam, h))
  }
  ctx.stroke()
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext('2d', { alpha: false })
  if (ctx === null) throw new Error('Canvas2D 컨텍스트를 얻지 못했다')

  const r: RendererX = {
    canvas,
    ctx,
    cam: createCamera(),
    fx: createFx(),
    far: bakeRidge(BG.farBase, BG.farAmp, BG.farFreq, 11),
    near: bakeRidge(BG.nearBase, BG.nearAmp, BG.nearFreq, 23),
    stars: bakeStars(),
    tufts: bakeTufts(),
    grad: null,
    gradH: -1,
    dead: false,

    resize(): void {
      resizeCamera(r.cam, r.canvas)
      // 그라디언트 객체는 크기가 바뀔 때만 다시 만든다 (프레임당 할당 0)
      r.grad = null
      r.gradH = -1
    },

    draw(w: World, alpha: number, dtReal: number, hud: HudState): void {
      if (r.dead) return
      const cam = r.cam
      const c = r.ctx
      // dpr 스케일을 여기서 한 번만 건다. 이후 모든 좌표는 CSS 픽셀이다.
      c.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0)

      // 갱신 → 수집 순서. 반대로 하면 이번 프레임에 쌓인 히트스톱이 같은 프레임에 한 번 깎이고,
      // 새로 태어난 파티클이 수명을 한 프레임 잃는다.
      updateFx(r.fx, dtReal)
      pumpEvents(r.fx, w)
      updateCamera(cam, w, dtReal)

      if (r.grad === null || r.gradH !== cam.h) {
        const g = c.createLinearGradient(0, 0, 0, cam.h)
        g.addColorStop(0, THEME.sky0)
        g.addColorStop(1, THEME.sky1)
        r.grad = g
        r.gradH = cam.h
      }
      c.fillStyle = r.grad
      c.fillRect(0, 0, cam.w, cam.h)

      // 하늘은 능선보다 먼저. 별이 산 위로 뜨면 산이 유리가 된다.
      drawSky(c, cam, r.stars)
      drawRidge(c, cam, r.far, BG.farParallax, THEME.ridgeFar)
      drawRidge(c, cam, r.near, BG.nearParallax, THEME.ridgeNear)

      const groundY = worldToScreenY(cam, 0)
      c.fillStyle = THEME.ground
      c.fillRect(0, groundY, cam.w, cam.h - groundY)
      c.strokeStyle = THEME.groundLine
      c.lineWidth = BG.groundLineW
      c.beginPath()
      c.moveTo(0, groundY)
      c.lineTo(cam.w, groundY)
      c.stroke()
      drawTufts(c, cam, r.tufts)

      // 깃발은 과녁보다 먼저 — 과녁 위로 천이 지나가면 조준을 가린다 (C1).
      drawWindFlag(c, cam, w)
      drawTargets(c, cam, w, alpha, r.fx)
      drawTrails(c, cam, w)
      drawArrows(c, cam, w, alpha)
      drawArcher(c, cam, w, alpha)
      drawFx(c, cam, r.fx)
      drawHud(c, cam, w, hud)
    },

    dispose(): void {
      r.dead = true
      r.grad = null
    },
  }

  r.resize()
  return r
}

export function getCamera(r: Renderer): Camera {
  return (r as RendererX).cam
}

/** 게임 루프가 히트스톱을 읽는 통로. Fx 인스턴스를 밖으로 노출하지 않기 위함. */
export function getHitStopMs(r: Renderer): number {
  return hitStopMs((r as RendererX).fx)
}
