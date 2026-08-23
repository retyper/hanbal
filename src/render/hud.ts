/**
 * HUD — 최소한만. 남은 화살, 점수/목표, 스태미나, 성장 진입구.
 *
 * GDD 2장: "물리가 곧 UI다." 정확도 바·QTE 링 같은 장치는 만들지 않는다.
 * 스태미나 게이지는 활 바로 옆에 붙인다 — 눈이 조준점과 게이지를 왕복하면 그 자체가 페널티다.
 *
 * 만작 유지 가능 시간이 4.2초(초보)로 짧아져 게이지가 눈에 띄게 빨리 준다. 그래서 게이지에
 * **1초 눈금**(= P.stamina.drawDrain 만큼의 스태미나)과 **붕괴 문턱 표시**를 넣었다.
 * 숫자를 띄우지 않고도 "몇 초 남았나"와 "어디서 무너지나"가 읽혀야 한다 (GDD 7장 절제 원칙).
 *
 * A5: 매 프레임 문자열을 만들지 않는다. 값이 바뀔 때만 갱신해 캐시한다.
 * A1: World는 읽기만 한다. 시간축도 w.tick 을 쓴다 — performance.now 를 끌어오지 않는다.
 */
import { TAU, clamp01 } from '../core/math.ts'
import { P } from '../tune/params.ts'
import type { World } from '../sim/types.ts'
import { THEME } from './camera.ts'
import type { Camera } from './camera.ts'
import { bowHandScreenX, bowHandScreenY } from './stickman.ts'

/**
 * HUD가 밖에서 받아야 하는 것들. 성장·오디오는 game/ui 레이어의 상태라
 * World(=sim)에 넣지 않고 인자로 받는다 (A1 레이어 분리).
 * 루프가 객체 하나를 만들어 제자리에서 갱신한다 — 프레임당 할당 0 (A5).
 */
export interface HudState {
  /** 보유 훈련치 (GDD 4장 성장 재화) */
  training: number
  /** 지금 올릴 수 있는 스탯이 있는가 — 숫자가 강조색으로 켜진다 */
  canLevelUp: boolean
  /** 음소거 (M 키) */
  muted: boolean
  /** 짧은 알림 한 줄. 빈 문자열이면 그리지 않는다. */
  toast: string
}

const HUD = {
  padX: 18,
  padY: 22,
  lineGap: 19,
  /** 게이지를 활 손 기준 어디에 붙일지 (px) */
  gaugeDX: -8,
  gaugeDY: 34,
  gaugeW: 84,
  gaugeH: 8,
  /** 경고 시 게이지가 커지는 정도 */
  gaugeWarnGrow: 3,
  /** 1초 눈금이 이보다 촘촘해지면 오히려 안 읽힌다 — 그리지 않는다 */
  tickMinPx: 7,
  tickW: 1,
  /** 붕괴 문턱 표시가 게이지 위아래로 삐져나오는 길이 */
  notchOut: 3,
  notchW: 2,
  pipW: 3,
  pipH: 11,
  pipGap: 6,
  pipMax: 12,
  /** 훈련치 아래 줄 간격 */
  subGap: 6,
  /** 경고 깜빡임 (Hz). sim 시계로 도는 값이라 프레임레이트와 무관하다. */
  pulseHz: 2.4,
  toastUp: 46,
} as const

const GAUGE_RAMP = ['#5fb0a5', '#7fae8c', '#a3aa72', '#c8a35c', '#e58a50', '#ff6a45'] as const

/** 문자열 캐시. 값이 바뀐 프레임에만 새 문자열이 생긴다. */
const cache = {
  score: -1,
  goal: -1,
  scoreText: '',
  arrows: -1,
  arrowsText: '',
  training: -1,
  trainingText: '',
}

export function drawHud(
  ctx: CanvasRenderingContext2D, cam: Camera, w: World, hud: HudState,
): void {
  const a = w.archer
  // 렌더의 시계는 sim tick 이다. 값이 결정론적이라 리플레이에서도 같은 그림이 나온다.
  const t = w.tick * w.dt

  // ── 점수 / 목표 ──────────────────────────────────────────────
  const goal = w.stage.targetScore
  if (w.score !== cache.score || goal !== cache.goal) {
    cache.score = w.score
    cache.goal = goal
    cache.scoreText = `${w.score | 0} / ${goal | 0}`
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = '600 16px system-ui, sans-serif'
  ctx.fillStyle = w.score >= goal ? THEME.accent : THEME.hudText
  ctx.fillText(cache.scoreText, HUD.padX, HUD.padY)

  // ── 남은 화살 ────────────────────────────────────────────────
  const left = w.arrowsLeft
  const pipY = HUD.padY + HUD.lineGap + 4
  if (left <= HUD.pipMax) {
    // 개수가 적을 땐 숫자보다 눈금이 빠르게 읽힌다
    ctx.fillStyle = THEME.hudDim
    for (let i = 0; i < left; i++) {
      ctx.fillRect(HUD.padX + i * (HUD.pipW + HUD.pipGap), pipY, HUD.pipW, HUD.pipH)
    }
  } else {
    if (left !== cache.arrows) {
      cache.arrows = left
      cache.arrowsText = `화살 ${left}`
    }
    ctx.font = '500 13px system-ui, sans-serif'
    ctx.fillStyle = THEME.hudDim
    ctx.fillText(cache.arrowsText, HUD.padX, pipY)
  }

  // ── 스태미나 — 활 옆 ─────────────────────────────────────────
  const max = a.staminaMax > 0 ? a.staminaMax : 1
  const ratio = clamp01(a.stamina / max)
  const warn = clamp01(a.warn)
  const gx = bowHandScreenX(cam, w) + HUD.gaugeDX - HUD.gaugeW * 0.5
  const gy = bowHandScreenY(cam, w) + HUD.gaugeDY
  const gh = HUD.gaugeH + warn * HUD.gaugeWarnGrow
  const gw = HUD.gaugeW

  ctx.fillStyle = THEME.gaugeBack
  ctx.fillRect(gx, gy, gw, gh)
  ctx.fillStyle = GAUGE_RAMP[(warn * 5 + 0.5) | 0] ?? THEME.gauge
  ctx.fillRect(gx, gy, gw * ratio, gh)

  // 1초 눈금 — 만작 유지 1초에 해당하는 스태미나(P.stamina.drawDrain)마다 하나.
  // 남은 칸 수가 곧 "앞으로 몇 초"다. 숫자를 띄우지 않고 시간을 읽게 하는 유일한 방법.
  const perSec = P.stamina.drawDrain
  if (perSec > 0) {
    const stepPx = gw * perSec / max
    if (stepPx >= HUD.tickMinPx) {
      ctx.fillStyle = THEME.sky0
      for (let s = stepPx; s < gw - 0.5; s += stepPx) {
        ctx.fillRect(gx + s, gy, HUD.tickW, gh)
      }
    }
  }

  // 붕괴 문턱 — 여기 닿으면 팔이 무너지기 시작한다. 미리 보여야 예고가 된다 (feel-lens).
  const warnAt = clamp01(P.stamina.collapseWarnAt / max)
  if (warnAt > 0) {
    ctx.fillStyle = THEME.gaugeWarn
    ctx.globalAlpha = warn > 0
      ? 0.75 + 0.25 * Math.sin(t * HUD.pulseHz * TAU)
      : 0.45
    ctx.fillRect(gx + gw * warnAt, gy - HUD.notchOut, HUD.notchW, gh + HUD.notchOut * 2)
    ctx.globalAlpha = 1
  }

  // 호흡정지 중이면 게이지 아래 짧은 선 — 지금 급소모 중이라는 신호
  if (a.steadyBlend > 0.01) {
    ctx.fillStyle = THEME.target2
    ctx.globalAlpha = clamp01(a.steadyBlend)
    ctx.fillRect(gx, gy + gh + 3, gw, 1)
    ctx.globalAlpha = 1
  }

  // ── 훈련치 · 음소거 (오른쪽 위) ──────────────────────────────
  // 성장 화면을 여는 버튼은 DOM 오버레이(ui/growth.ts)가 왼쪽 아래에 그린다.
  // 캔버스에 또 그리면 버튼이 둘이 되고, 조준선이 지나는 자리에서 클릭을 먹는다 (C1).
  // 여기서는 "올릴 게 있다"는 신호만 훈련치 숫자의 색으로 낸다.
  const training = hud.training | 0
  if (training !== cache.training) {
    cache.training = training
    cache.trainingText = `훈련 ${training}`
  }
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.font = '600 15px system-ui, sans-serif'
  ctx.fillStyle = hud.canLevelUp ? THEME.accent : THEME.hudText
  ctx.fillText(cache.trainingText, cam.w - HUD.padX, HUD.padY)

  if (hud.muted) {
    ctx.font = '500 11px system-ui, sans-serif'
    ctx.fillStyle = THEME.hudDim
    ctx.fillText('무음 · M', cam.w - HUD.padX, HUD.padY + HUD.lineGap + HUD.subGap)
  }

  // ── 알림 한 줄 — 화면을 덮지 않는다 (GDD 7장) ─────────────────
  if (hud.toast !== '') {
    ctx.textAlign = 'center'
    ctx.font = '500 13px system-ui, sans-serif'
    ctx.fillStyle = THEME.hudDim
    ctx.fillText(hud.toast, cam.w * 0.5, cam.h - HUD.toastUp)
  }
}
