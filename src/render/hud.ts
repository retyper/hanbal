/**
 * HUD — 최소한만. 남은 화살, 점수/목표, 스태미나.
 *
 * GDD 2장: "물리가 곧 UI다." 정확도 바·QTE 링 같은 장치는 만들지 않는다.
 * 스태미나 게이지는 활 바로 옆에 붙인다 — 눈이 조준점과 게이지를 왕복하면 그 자체가 페널티다.
 * A5: 매 프레임 문자열을 만들지 않는다. 값이 바뀔 때만 갱신해 캐시한다.
 */
import { clamp01 } from '../core/math.ts'
import type { World } from '../sim/types.ts'
import { THEME } from './camera.ts'
import type { Camera } from './camera.ts'
import { bowHandScreenX, bowHandScreenY } from './stickman.ts'

const HUD = {
  padX: 18,
  padY: 22,
  lineGap: 19,
  /** 게이지를 활 손 기준 어디에 붙일지 (px) */
  gaugeDX: -8,
  gaugeDY: 30,
  gaugeW: 62,
  gaugeH: 5,
  /** 경고 시 게이지가 커지는 정도 */
  gaugeWarnGrow: 2,
  pipW: 3,
  pipH: 11,
  pipGap: 6,
  pipMax: 12,
} as const

const GAUGE_RAMP = ['#5fb0a5', '#7fae8c', '#a3aa72', '#c8a35c', '#e58a50', '#ff6a45'] as const

/** 문자열 캐시. 값이 바뀐 프레임에만 새 문자열이 생긴다. */
const cache = {
  score: -1,
  goal: -1,
  scoreText: '',
  arrows: -1,
  arrowsText: '',
}

export function drawHud(ctx: CanvasRenderingContext2D, cam: Camera, w: World): void {
  const a = w.archer

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
  const gx = bowHandScreenX(cam, w) + HUD.gaugeDX
  const gy = bowHandScreenY(cam, w) + HUD.gaugeDY
  const gh = HUD.gaugeH + warn * HUD.gaugeWarnGrow
  const gw = HUD.gaugeW

  ctx.fillStyle = THEME.gaugeBack
  ctx.fillRect(gx - gw * 0.5, gy, gw, gh)
  ctx.fillStyle = GAUGE_RAMP[(warn * 5 + 0.5) | 0] ?? THEME.gauge
  ctx.fillRect(gx - gw * 0.5, gy, gw * ratio, gh)

  // 호흡정지 중이면 게이지 아래 짧은 선 — 지금 급소모 중이라는 신호
  if (a.steadyBlend > 0.01) {
    ctx.fillStyle = THEME.target2
    ctx.globalAlpha = clamp01(a.steadyBlend)
    ctx.fillRect(gx - gw * 0.5, gy + gh + 2, gw, 1)
    ctx.globalAlpha = 1
  }
}
