import { fieldTransform } from './surface.ts'
import { HAEBI_RUN as C } from '../tune/params.ts'
import { HAEBI_END as E, HAEBI_IMPACT as F, HAEBI_KO as K } from '../tune/params.ts'
import type { RaidEnding } from './ending.ts'
import { HAEBI_FX_ART as A } from '../tune/params.ts'
import { drawFx } from './fx-art.ts'

/**
 * Canvas composites only; no CSS filter or extra compositor layer.
 * focus 쓰러진 장수의 화면 자리(판 논리 좌표 · 발 위)와 누운 몸의 화면 폭 — 쓰러짐 KO 는 장수 둘레를 남기고 둘레만 빛을 빼고 어둡게 (HAEBI_KO)
 */
export function drawEnding(ctx: CanvasRenderingContext2D, end: RaidEnding, gold: number, images: Map<string, HTMLImageElement>, focus?: { x: number; y: number; width: number }) {
  if (!end.active) return
  const w = C.width, h = C.height, age = end.elapsed
  ctx.save(); fieldTransform(ctx)
  if (end.kind === 'defeat' && focus) {
    const k = Math.min(1, Math.max(0, age - end.freeze) / E.defeat.slow), r0 = K.clearR * focus.width, r1 = r0 * K.dimR
    const hole = (color: string) => { const g = ctx.createRadialGradient(focus.x, focus.y, r0, focus.x, focus.y, r1); g.addColorStop(0, color + '00'); g.addColorStop(1, color + 'ff'); return g }
    ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = k * K.gray; ctx.fillStyle = hole('#888888'); ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = k * K.dark; ctx.fillStyle = hole('#111827'); ctx.fillRect(0, 0, w, h)
  } else if (end.kind !== 'victory') {
    const gray = Math.min(1, Math.max(0, age - end.freeze) / E.defeat.slow) * E.grayMax
    ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = gray; ctx.fillStyle = '#888'; ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = gray; ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, w, h)
  }
  ctx.globalAlpha = 1
  if (age < E.flashTime && end.kind !== 'retreat') { ctx.globalAlpha = E.flashAlpha * (1 - age / E.flashTime); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1 }
  if (end.kind === 'victory') {
    for (let i = 0; i < E.sparkCount; i++) {
      const k = (age * E.slowRate + i / E.sparkCount) % 1
      const x = w * (E.sparkLeft + E.sparkSpan * ((i * E.sparkSequence) % 1)), y = h * (1 - k)
      ctx.globalAlpha = Math.sin(k * Math.PI)
      drawFx(ctx, images, 'fx_spark_shard', x, y, A.victorySparkWidth, A.victorySparkHeight)
    }
    ctx.globalAlpha = 1
  }
  if (age >= end.stampAt) {
    const t = age - end.stampAt, scale = 1 + E.stampOvershoot * Math.max(0, 1 - t / E.stampSettle)
    const shake = Math.max(0, 1 - t / E.shakeLife) * E.shake
    ctx.translate(w / 2 + Math.sin(t * F.shakeXHz) * shake, h * (end.kind === 'defeat' ? K.stampY : .5) + Math.cos(t * F.shakeYHz) * shake)
    ctx.scale(scale, scale)
    const won = end.kind === 'victory'
    ctx.globalAlpha = won ? A.victoryBandAlpha : A.bandAlpha
    const band = drawFx(ctx, images, won ? 'stamp_victory_band' : 'stamp_defeat_band', 0, 0, w * E.bandWidth, h * E.bandHeight)
    ctx.globalAlpha = 1
    if (!band) { ctx.fillStyle = won ? '#3c2b13dd' : '#080b11dd'; ctx.fillRect(-w * E.bandWidth / 2, -h * E.bandHeight / 2, w * E.bandWidth, h * E.bandHeight) }
    if (!drawFx(ctx, images, won ? 'stamp_victory' : 'stamp_defeat', 0, 0, w * A.stampWidth, h * A.stampHeight)) {
      ctx.font = `900 ${Math.round(w * E.stampSize)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = won ? '#ffe298' : '#ece9df'; ctx.fillText(won ? '승리' : '패배', 0, 0)
    }
    fieldTransform(ctx)
  }
  if (end.kind === 'victory' && age >= E.victory.coinAt) {
    const t = age - E.victory.coinAt
    for (let i = 0; i < E.coinCount; i++) {
      const k = Math.max(0, Math.min(1, (t - i / E.coinCount * E.coinTravel) / E.coinTravel))
      const x = w / 2 + Math.sin(i * E.coinSeedStep) * w * E.coinSpread * (1 - k), y = h * (E.coinStartY - k * E.coinRise)
      ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffd15d'; ctx.beginPath(); ctx.ellipse(x, y, E.coinSize / 2, E.coinSize * E.coinFlat, i, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1; ctx.fillStyle = '#ffe298'; ctx.font = `bold ${Math.round(w * E.coinFont)}px serif`; ctx.textAlign = 'center'
    ctx.fillText(`+${Math.round(gold * Math.min(1, t / E.coinTravel)).toLocaleString()}`, w / 2, h * E.coinTextY)
  }
  ctx.restore()
}
