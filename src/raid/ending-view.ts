import { HAEBI_END as E, HAEBI_IMPACT as F } from '../tune/params.ts'
import type { RaidEnding } from './ending.ts'

/** Canvas composites only; no CSS filter or extra compositor layer. */
export function drawEnding(ctx: CanvasRenderingContext2D, end: RaidEnding, portrait: HTMLImageElement | null, gold: number) {
  if (!end.active) return
  const w = ctx.canvas.width, h = ctx.canvas.height, age = end.elapsed
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (end.kind !== 'victory') {
    const gray = Math.min(1, Math.max(0, age - end.freeze) / E.defeat.slow) * E.grayMax
    ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = gray; ctx.fillStyle = '#888'; ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = gray; ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, w, h)
  }
  ctx.globalAlpha = 1
  if (age < E.flashTime && end.kind !== 'retreat') { ctx.globalAlpha = E.flashAlpha * (1 - age / E.flashTime); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1 }
  if (end.kind === 'defeat' && age >= E.defeat.portraitAt && portrait?.complete && portrait.naturalWidth) {
    const fade = Math.min(1, (age - E.defeat.portraitAt) / E.stampSettle)
    const scale = Math.min(w * E.portraitWidth / portrait.naturalWidth, h * E.portraitHeight / portrait.naturalHeight)
    const pw = portrait.naturalWidth * scale, ph = portrait.naturalHeight * scale
    ctx.globalAlpha = fade; ctx.drawImage(portrait, (w - pw) / 2, h * (1 - E.portraitHeight) / 2, pw, ph); ctx.globalAlpha = 1
  }
  if (end.kind === 'victory') {
    for (let i = 0; i < E.sparkCount; i++) {
      const k = (age * E.slowRate + i / E.sparkCount) % 1
      const x = w * (E.sparkLeft + E.sparkSpan * ((i * E.sparkSequence) % 1)), y = h * (1 - k)
      ctx.globalAlpha = Math.sin(k * Math.PI); ctx.fillStyle = '#ffe29a'; ctx.fillRect(x, y, E.sparkSize, E.sparkSize)
    }
    ctx.globalAlpha = 1
  }
  if (age >= end.stampAt) {
    const t = age - end.stampAt, scale = 1 + E.stampOvershoot * Math.max(0, 1 - t / E.stampSettle)
    const shake = Math.max(0, 1 - t / E.shakeLife) * E.shake
    ctx.translate(w / 2 + Math.sin(t * F.shakeXHz) * shake, h / 2 + Math.cos(t * F.shakeYHz) * shake)
    ctx.scale(scale, scale)
    ctx.fillStyle = end.kind === 'victory' ? '#3c2b13dd' : '#080b11dd'
    ctx.fillRect(-w * E.bandWidth / 2, -h * E.bandHeight / 2, w * E.bandWidth, h * E.bandHeight)
    ctx.font = `900 ${Math.round(w * E.stampSize)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = end.kind === 'victory' ? '#ffe298' : '#ece9df'; ctx.fillText(end.kind === 'victory' ? '승리' : '패배', 0, 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
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
