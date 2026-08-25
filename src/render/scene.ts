/**
 * 장면 조립 — 배경 → 지면 → 과녁 → 궤적 → 화살 → 궁수 → 이펙트 → HUD.
 *
 * ARCHITECTURE A1: World는 읽기만 한다. events도 읽되 비우지 않는다 (게임 루프가 소비).
 * A5: save/restore 남발 금지, shadowBlur·filter 금지, 프레임당 힙 할당 0.
 */
import { TAU, clamp01, lerp, valueNoise } from '../core/math.ts'
import { P } from '../tune/params.ts'
import { TRAIL_POINTS } from '../sim/types.ts'
import type { Target, World } from '../sim/types.ts'
import {
  THEME, createCamera, resizeCamera, updateCamera, worldToScreenX, worldToScreenY, screenToWorldX,
} from './camera.ts'
import type { Camera } from './camera.ts'
import { drawArcher } from './stickman.ts'
import { createFx, pumpEvents, updateFx, drawFx, hitStopMs, targetSquash , PLAYER_PIN } from './effects.ts'
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
  /** 세 번째(가장 먼) 능선 — 하늘과 산 사이의 한 겹 더 */
  faintBase: 8.6,
  faintAmp: 2.8,
  faintFreq: 0.03,
  faintParallax: 0.16,
  /** 산안개 밴드 (월드 y) */
  mistLo: 2.6,
  mistHi: 5.4,
  mistAlpha: 0.07,
  /** 소나무 — 근경 능선을 따라 선다 */
  pines: 9,
  pineX0: -8,
  pineX1: 46,
  pineHMin: 1.6,
  pineHMax: 3.2,
  /** 구름 — 아주 느리게 흐른다 (m/s, 월드 기준) */
  clouds: 3,
  cloudDrift: 0.18,
  cloudAlpha: 0.5,
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
  faint: Float32Array
  pines: Float32Array
  clouds: Float32Array
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

    if (t.kind === 'archer') {
      // ── 적 궁수 (docs/RUN.md 6장) — 과녁이 아니라 **사람 실루엣**이어야 한다 ──
      // windup(당김 예고) 동안 활이 당겨지고 색이 달아오른다. 예고 없는 피해는 없다.
      const wind = P.enemy.windup
      const f = t.fireAt > 0
        ? clamp01(1 - (t.fireAt - w.elapsed) / wind)
        : 0
      const drawF = w.elapsed >= t.fireAt - wind ? f : 0
      const hot = drawF > 0
      const bodyCol = hot ? THEME.threat : THEME.threatDim

      // 조준선 예고 — 당김이 깊어질수록 또렷해진다. "곧 저기서 날아온다"를 먼저 보여준다.
      if (hot) {
        ctx.globalAlpha = 0.22 * drawF
        ctx.strokeStyle = THEME.threat
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(worldToScreenX(cam, w.archer.x), worldToScreenY(cam, w.archer.y))
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      // 사람 실루엣 — 머리·몸통·다리. 이쪽(-x)을 보고 선다.
      ctx.strokeStyle = bodyCol
      ctx.lineWidth = Math.max(2, rx * 0.14)
      ctx.lineCap = 'round'
      const hr = rx * 0.3
      const headY = y - ry * 0.62
      ctx.beginPath()
      ctx.moveTo(x, headY + hr)
      ctx.lineTo(x, y + ry * 0.3)
      ctx.moveTo(x, y + ry * 0.3)
      ctx.lineTo(x - rx * 0.34, y + ry)
      ctx.moveTo(x, y + ry * 0.3)
      ctx.lineTo(x + rx * 0.34, y + ry)
      ctx.stroke()
      ctx.fillStyle = bodyCol
      ctx.beginPath()
      ctx.arc(x, headY, hr, 0, TAU)
      ctx.fill()

      // 활 — 몸 앞(-x)의 호. 당길수록 시위가 몸쪽으로 당겨진다.
      const bx = x - rx * 0.55
      ctx.strokeStyle = bodyCol
      ctx.lineWidth = Math.max(1.5, rx * 0.1)
      ctx.beginPath()
      ctx.moveTo(bx, y - ry * 0.5)
      ctx.quadraticCurveTo(bx - rx * 0.35, y - ry * 0.1, bx, y + ry * 0.3)
      ctx.stroke()
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(bx, y - ry * 0.5)
      ctx.lineTo(bx + drawF * rx * 0.5, y - ry * 0.1)
      ctx.lineTo(bx, y + ry * 0.3)
      ctx.stroke()

      // 갑옷병 — 흉갑 실루엣 (형: "일시정지인 줄 알았다"). 어깨가 넓고 허리로 좁아지는
      // 사다리꼴 판 + 양어깨 견갑 + 가슴판 골 두 줄. 몸통이 안 통하는 이유가 갑주의
      // **형태**로 읽힌다. 머리는 맨머리 — 저기가 답이라는 뜻이다.
      if (t.armored) {
        const aw = rx * 0.5
        const top2 = y - ry * 0.3
        const bot2 = y + ry * 0.42
        ctx.fillStyle = '#8fa3b5'
        ctx.beginPath()
        ctx.moveTo(x - aw, top2)
        ctx.lineTo(x + aw, top2)
        ctx.lineTo(x + aw * 0.55, bot2)
        ctx.lineTo(x - aw * 0.55, bot2)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = THEME.targetBand
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(x - aw * 0.5, top2 + ry * 0.12)
        ctx.lineTo(x + aw * 0.5, top2 + ry * 0.12)
        ctx.moveTo(x - aw * 0.4, top2 + ry * 0.34)
        ctx.lineTo(x + aw * 0.4, top2 + ry * 0.34)
        ctx.stroke()
        ctx.fillStyle = '#9fb6c8'
        ctx.beginPath()
        ctx.arc(x - aw, top2, rx * 0.2, 0, TAU)
        ctx.arc(x + aw, top2, rx * 0.2, 0, TAU)
        ctx.fill()
      }

      // 체력 바 — 머리 위 (형: "전부 바 형태로").
      drawHpBar(ctx, x, headY - hr - 12, Math.max(26, rx * 1.4), t.hpMax > 0 ? t.hp / t.hpMax : 0)
    } else if (t.kind === 'boss') {
      // ★ 보스 = 눈알귀신 (형: "빨간 원이 둥실둥실 다가오는 건 말이 안 되잖아. 눈알귀신이라도").
      //   너덜너덜한 귀신 몸뚱이 + 위쪽의 거대한 눈알 하나. 눈알은 **약점 히트박스 그 자리**다 —
      //   동공이 궁수를 계속 노려보니 "눈을 쏘라"는 말이 필요 없다.
      const hy = y - ry * P.target.bossHeadUp
      const hr = Math.max(4, rx * P.target.bossHeadR)

      // 몸 — 어두운 덩어리. 밑단은 흘러내리는 세 겹 자락 (유령의 문법).
      ctx.fillStyle = THEME.threatDim
      ctx.beginPath()
      ctx.moveTo(x - rx, y)
      ctx.quadraticCurveTo(x - rx, y - ry * 1.05, x, y - ry * 1.1)
      ctx.quadraticCurveTo(x + rx, y - ry * 1.05, x + rx, y)
      // 자락 — 아래로 갈수록 파도친다. 시간은 sim elapsed (A1: 렌더는 읽기만).
      const wob = Math.sin(w.elapsed * 1.7) * ry * 0.08
      ctx.quadraticCurveTo(x + rx * 0.72, y + ry * 1.1 + wob, x + rx * 0.5, y + ry * 0.7)
      ctx.quadraticCurveTo(x + rx * 0.25, y + ry * 1.15 - wob, x, y + ry * 0.75)
      ctx.quadraticCurveTo(x - rx * 0.25, y + ry * 1.1 + wob, x - rx * 0.5, y + ry * 0.72)
      ctx.quadraticCurveTo(x - rx * 0.75, y + ry * 1.12 - wob, x - rx, y)
      ctx.closePath()
      ctx.fill()

      // ── 변종별 몸치장 — 실루엣이 달라야 '또 그놈'이 아니다 (형: "소스 재활용이 보인다"). ──
      if (t.look === 1) {
        // 갑주귀신 — 몸을 금속 판 세 장이 두른다. 이음매가 '판금'을 만든다.
        ctx.fillStyle = '#7e93a6'
        ctx.beginPath()
        ctx.moveTo(x - rx * 0.95, y + ry * 0.1)
        ctx.lineTo(x - rx * 0.6, y - ry * 0.85)
        ctx.lineTo(x + rx * 0.6, y - ry * 0.85)
        ctx.lineTo(x + rx * 0.95, y + ry * 0.1)
        ctx.lineTo(x + rx * 0.55, y + ry * 0.75)
        ctx.lineTo(x - rx * 0.55, y + ry * 0.75)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = THEME.targetBand
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x - rx * 0.75, y - ry * 0.25)
        ctx.lineTo(x + rx * 0.75, y - ry * 0.25)
        ctx.moveTo(x - rx * 0.8, y + ry * 0.25)
        ctx.lineTo(x + rx * 0.8, y + ry * 0.25)
        ctx.stroke()
        // 리벳 — 판금의 서명.
        ctx.fillStyle = THEME.targetBand
        for (const [px2, py2] of [[-0.6, -0.55], [0.6, -0.55], [-0.7, 0.5], [0.7, 0.5]] as const) {
          ctx.beginPath()
          ctx.arc(x + rx * px2, y + ry * py2, 2.2, 0, TAU)
          ctx.fill()
        }
      } else if (t.look === 3) {
        // 폭주귀신 — 앞으로 기운 몸 + 뒤로 찢어지는 속도선. 형태 자체가 돌진이다.
        ctx.strokeStyle = THEME.threatDim
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let l2 = 0; l2 < 3; l2++) {
          const ly = y - ry * 0.4 + l2 * ry * 0.4
          ctx.moveTo(x + rx * 0.7, ly)
          ctx.lineTo(x + rx * (1.7 + l2 * 0.3), ly + ry * 0.08)
        }
        ctx.stroke()
      }

      // 눈알 — 흰자 · 홍채(위험색) · 동공. 동공은 궁수를 따라간다.
      const blink = (w.elapsed % 3.7) < 0.13
      if (blink) {
        // 깜빡임 — 감긴 눈꺼풀 한 줄. 살아 있는 것만이 깜빡인다.
        ctx.strokeStyle = THEME.target2
        ctx.lineWidth = Math.max(2, hr * 0.18)
        ctx.beginPath()
        ctx.moveTo(x - hr, hy)
        ctx.lineTo(x + hr, hy)
        ctx.stroke()
      } else {
        // 변종별 눈: 갑주(1)는 투구 틈의 가로 슬릿 · 폭주(3)는 성난 사선 · 쌍눈(2)은 작고 말갛다.
        const eyeH = t.look === 1 ? hr * 0.38 : t.look === 3 ? hr * 0.6 : hr * 0.92
        if (t.look === 1) {
          // 투구 돔 — 눈은 그 틈으로만 보인다.
          band(ctx, x, hy - hr * 0.2, hr * 1.15, hr * 0.95, '#66788a')
        }
        band(ctx, x, hy, hr, eyeH, THEME.target2)
        const ax2 = worldToScreenX(cam, w.archer.x)
        const ay2 = worldToScreenY(cam, w.archer.y)
        const dl = Math.hypot(ax2 - x, ay2 - hy) || 1
        const px2 = x + ((ax2 - x) / dl) * hr * 0.34
        const py2 = hy + ((ay2 - hy) / dl) * Math.min(hr * 0.3, eyeH * 0.3)
        const iw = t.look === 2 ? hr * 0.4 : hr * 0.52
        band(ctx, px2, py2, iw, Math.min(eyeH * 0.85, iw), t.look === 2 ? '#ff9a45' : THEME.threat)
        band(ctx, px2, py2, iw * 0.5, Math.min(eyeH * 0.5, iw * 0.5), THEME.targetBand)
        // 눈빛 점 — 이게 있어야 젖은 눈알로 보인다.
        band(ctx, px2 - hr * 0.12, py2 - hr * 0.14, hr * 0.09, hr * 0.09, THEME.target2)
        if (t.look === 3) {
          // 성난 눈두덩 — 사선 한 줄이 표정을 만든다.
          ctx.strokeStyle = THEME.threatDim
          ctx.lineWidth = Math.max(2, hr * 0.16)
          ctx.beginPath()
          ctx.moveTo(x - hr, hy - eyeH * 1.15)
          ctx.lineTo(x + hr * 0.7, hy - eyeH * 0.55)
          ctx.stroke()
        }
      }

      // 체력 바 — 눈 위. 보스의 남은 목숨이 멀리서도 한 줄로 읽힌다.
      drawHpBar(ctx, x, hy - hr - 14, Math.max(40, rx * 1.2), t.hpMax > 0 ? t.hp / t.hpMax : 0)
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
/**
 * 체력 바 — 모든 목숨 있는 것의 문법 (형: "체력은 전부 캐릭터 머리 위나 다리 밑에 바 형태").
 * 화면 좌표로 그린다. 잃은 만큼이 어두워지는 단순한 두 겹 — 숫자는 안 쓴다.
 */
function drawHpBar(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, ratio: number,
): void {
  const h = 5
  ctx.fillStyle = THEME.gaugeBack
  ctx.fillRect(x - w / 2, y, w, h)
  ctx.fillStyle = THEME.gaugeWarn
  ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, ratio)), h)
}

/**
 * 몸에 박힌 화살 (형: "맞으면 정확히 박힌 위치에 보여져야"). 과녁 상대좌표라
 * 보스가 움직여도 몸에 붙어 다닌다. 주인이 죽으면 함께 사라진다 — 시체는 안 그린다.
 */
function drawBodyPins(ctx: CanvasRenderingContext2D, cam: Camera, w: World, fx: Fx): void {
  const n = fx.pId.length
  for (let i = 0; i < n; i++) {
    const id = fx.pId[i] ?? -1
    if (id === -1) continue
    let cx2 = 0
    let cy2 = 0
    if (id === PLAYER_PIN) {
      cx2 = w.archer.x
      cy2 = w.archer.y
    } else {
      let found = false
      for (const tg of w.targets) {
        if (tg.id === id && tg.alive) {
          cx2 = tg.x
          cy2 = tg.y
          found = true
          break
        }
      }
      if (!found) {
        fx.pId[i] = -1
        continue
      }
    }
    const ax2 = cx2 + (fx.pDx[i] ?? 0)
    const ay2 = cy2 + (fx.pDy[i] ?? 0)
    const ang = fx.pA[i] ?? 0
    const ux2 = Math.cos(ang)
    const uy2 = Math.sin(ang)
    const L = DRAW.arrowLen * 0.55
    const isEnemy = id === PLAYER_PIN
    ctx.strokeStyle = isEnemy ? THEME.threat : THEME.arrow
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(worldToScreenX(cam, ax2 - ux2 * L), worldToScreenY(cam, ay2 - uy2 * L))
    ctx.lineTo(worldToScreenX(cam, ax2), worldToScreenY(cam, ay2))
    ctx.stroke()
  }
}

/** 적 화살 — 위험색 짧은 대. 내 화살과 색이 달라야 "날아오는 것"이 즉시 구분된다. */
function drawEnemyShots(ctx: CanvasRenderingContext2D, cam: Camera, w: World): void {
  ctx.strokeStyle = THEME.threat
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  for (let i = 0; i < w.shots.length; i++) {
    const sh = w.shots[i]
    if (sh === undefined || !sh.alive) continue
    const sp = Math.hypot(sh.vx, sh.vy) || 1
    const ux = sh.vx / sp
    const uy = sh.vy / sp
    ctx.beginPath()
    ctx.moveTo(worldToScreenX(cam, sh.x - ux * 0.5), worldToScreenY(cam, sh.y - uy * 0.5))
    ctx.lineTo(worldToScreenX(cam, sh.x), worldToScreenY(cam, sh.y))
    ctx.stroke()
  }
}

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
    const shaft = ar.kind === 'pierce' ? DRAW.arrowLen * 0.52 : DRAW.arrowLen
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

function drawSky(ctx: CanvasRenderingContext2D, cam: Camera, stars: Float32Array, elapsed: number): void {
  // 달 — 초승달 + 달무리. 무리는 알파 낮은 큰 원 두 겹뿐이다 (그림자·필터 금지, A5).
  const mx = cam.w * DRAW.moonX
  const my = cam.h * DRAW.moonY
  ctx.fillStyle = THEME.moon
  ctx.globalAlpha = 0.05
  ctx.beginPath()
  ctx.arc(mx, my, DRAW.moonR * 2.6, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 0.09
  ctx.beginPath()
  ctx.arc(mx, my, DRAW.moonR * 1.7, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 0.55
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
    // 밝은 별 몇은 천천히 숨쉰다 — 시계는 sim elapsed (A1: 렌더는 읽기만).
    const tw = b > 0.75 ? 0.75 + 0.25 * Math.sin(elapsed * 0.8 + i * 2.1) : 1
    ctx.globalAlpha = (0.25 + b * 0.55) * tw
    ctx.fillRect(sx, sy, size, size)
  }
  ctx.globalAlpha = 1
}

/**
 * 밤구름 — 하늘보다 반 톤 밝은 길쭉한 덩어리가 아주 느리게 흐른다.
 * 정지화면이던 하늘에 시간이 흐르게 하는 가장 싼 방법이다 (형: "배경이 밋밋해").
 */
function bakeClouds(): Float32Array {
  // u(가로 위상 0..1), v(세로 0..1), 길이 배수, 두께 배수
  const t = new Float32Array(BG.clouds * 4)
  for (let i = 0; i < BG.clouds; i++) {
    // 별과 같은 관례 — valueNoise 시드 분리로 뽑는다 (렌더는 rng 스트림을 만들지 않는다).
    const n = (k: number, seed: number): number => (valueNoise(i * k, seed) + 1) * 0.5
    t[i * 4] = n(1.9, 811)
    t[i * 4 + 1] = 0.08 + n(2.7, 822) * 0.22
    t[i * 4 + 2] = 0.7 + n(3.3, 833) * 0.8
    t[i * 4 + 3] = 0.5 + n(4.1, 844)
  }
  return t
}

function drawClouds(ctx: CanvasRenderingContext2D, cam: Camera, clouds: Float32Array, elapsed: number): void {
  ctx.fillStyle = THEME.cloud
  for (let i = 0; i < BG.clouds; i++) {
    const u = clouds[i * 4] ?? 0
    const v = clouds[i * 4 + 1] ?? 0
    const len = (clouds[i * 4 + 2] ?? 1) * cam.w * 0.28
    const th = (clouds[i * 4 + 3] ?? 1) * 10
    let sx = (u * cam.w + elapsed * BG.cloudDrift * cam.scale * 0.2) % (cam.w + len)
    sx = sx < 0 ? sx + cam.w + len : sx
    const y = v * cam.h
    ctx.globalAlpha = BG.cloudAlpha * 0.5
    // 둥근 끝 막대 세 개를 겹쳐 뭉게 실루엣을 만든다 — 필터 없이.
    ctx.beginPath()
    ctx.ellipse(sx - len / 2, y, len * 0.5, th, 0, 0, TAU)
    ctx.ellipse(sx - len * 0.15, y - th * 0.6, len * 0.3, th * 0.9, 0, 0, TAU)
    ctx.ellipse(sx - len * 0.8, y + th * 0.3, len * 0.28, th * 0.7, 0, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** 산안개 — 가장 먼 능선의 발치를 가로로 지운다. 겹과 겹 사이에 공기가 생긴다. */
function drawMist(ctx: CanvasRenderingContext2D, cam: Camera): void {
  const top = worldToScreenY(cam, BG.mistHi)
  const bot = worldToScreenY(cam, BG.mistLo)
  ctx.fillStyle = THEME.mist
  ctx.globalAlpha = BG.mistAlpha
  ctx.fillRect(0, top, cam.w, Math.max(1, bot - top))
  ctx.globalAlpha = BG.mistAlpha * 0.6
  ctx.fillRect(0, top - (bot - top) * 0.5, cam.w, Math.max(1, (bot - top) * 0.5))
  ctx.globalAlpha = 1
}

/**
 * 소나무 실루엣 — 근경 능선을 따라 선다. 삼각 세 단 + 줄기.
 * "무슨 그림인지 알아보기 어렵다"(형)의 답: 산 능선만으론 밤하늘 그래프다 —
 * 나무가 서야 산이 된다. 자리는 월드에 박아 카메라와 같이 흐른다 (근경 시차).
 */
function bakePines(): Float32Array {
  // x(월드), 높이, 폭 배수
  const t = new Float32Array(BG.pines * 3)
  for (let i = 0; i < BG.pines; i++) {
    const n = (k: number, seed: number): number => (valueNoise(i * k, seed) + 1) * 0.5
    t[i * 3] = BG.pineX0 + ((BG.pineX1 - BG.pineX0) * (i + n(1.3, 911) * 0.8)) / BG.pines
    t[i * 3 + 1] = BG.pineHMin + n(2.1, 922) * (BG.pineHMax - BG.pineHMin)
    t[i * 3 + 2] = 0.7 + n(2.9, 933) * 0.6
  }
  return t
}

function drawPines(
  ctx: CanvasRenderingContext2D, cam: Camera, pines: Float32Array, nearTab: Float32Array,
): void {
  ctx.fillStyle = THEME.pine
  for (let i = 0; i < BG.pines; i++) {
    const wx = pines[i * 3] ?? 0
    const h = pines[i * 3 + 1] ?? 2
    const wmul = pines[i * 3 + 2] ?? 1
    // 근경 능선과 같은 시차로 선다 — 능선 높이를 그대로 발밑으로 쓴다.
    const px = (wx - cam.x) * BG.nearParallax * cam.scale + cam.w * 0.5
    if (px < -60 || px > cam.w + 60) continue
    const u = (wx * BG.nearParallax - RIDGE_X0) / RIDGE_STEP
    const j = u < 0 ? 0 : u > RIDGE_N - 2 ? RIDGE_N - 2 : u | 0
    const footWorld = nearTab[j] ?? BG.nearBase
    const foot = worldToScreenY(cam, footWorld)
    const hp = h * cam.scale * 0.55
    const wp = hp * 0.42 * wmul
    // 줄기
    ctx.fillRect(px - 1.5, foot - hp * 0.25, 3, hp * 0.25)
    // 삼각 세 단
    for (let tLv = 0; tLv < 3; tLv++) {
      const ty = foot - hp * (0.2 + tLv * 0.27)
      const tw = wp * (1 - tLv * 0.24)
      ctx.beginPath()
      ctx.moveTo(px, ty - hp * 0.33)
      ctx.lineTo(px - tw, ty)
      ctx.lineTo(px + tw, ty)
      ctx.closePath()
      ctx.fill()
    }
  }
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
    faint: bakeRidge(BG.faintBase, BG.faintAmp, BG.faintFreq, 37),
    pines: bakePines(),
    clouds: bakeClouds(),
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
      drawSky(c, cam, r.stars, w.elapsed)
      drawClouds(c, cam, r.clouds, w.elapsed)
      drawRidge(c, cam, r.faint, BG.faintParallax, THEME.ridgeFaint)
      drawMist(c, cam)
      drawRidge(c, cam, r.far, BG.farParallax, THEME.ridgeFar)
      drawRidge(c, cam, r.near, BG.nearParallax, THEME.ridgeNear)
      drawPines(c, cam, r.pines, r.near)

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
      drawEnemyShots(c, cam, w)
      drawArcher(c, cam, w, alpha)
      drawBodyPins(c, cam, w, r.fx)
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
