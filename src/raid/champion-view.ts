import { HAEBI_CHAMPION as B, HAEBI_RUN as C, HAEBI_STAGES as ST, HAEBI_FX as K } from '../tune/params.ts'
import { championFanAngles, championWindup, segmentDistance, type SpawnView } from './champion.ts'
import type { HaebiRun, Mob } from './haebi.ts'

const TAU = Math.PI * 2
const wholeField: SpawnView = { left: 0, top: 0, right: C.width, bottom: C.height }
const telling = (e: Mob) => !!e.champion && e.hp > 0 && e.champion.mode === 'tell' && e.wind > 0
export const championRecovery = (e: Mob) => e.champion ? Math.max(0, Math.min(1, (e.recovery ?? 0) / B.recoverySeconds)) : 0
/** Existing20-frame placeholders only, not newly drawn dash/roar animation. */
export const championPose = (e: Mob) => championRecovery(e) > 0 ? 18 : e.champion?.mode === 'roar' ? 12 : e.champion?.mode === 'guard' ? 13 : null
export function championFacing(e: Mob, fallback: number) {
  const c = e.champion
  return c && (c.mode === 'tell' || c.mode === 'dash' || c.mode === 'guard') && c.dx ? Math.sign(c.dx) : fallback
}
export function championLaneContains(e: Mob, x: number, y: number) {
  if (!telling(e)) return false
  const c = e.champion!
  if (e.pattern === 'dash') return segmentDistance(x, y, c.startX, c.startY, e.aimX, e.aimY) < B.dashWidth
  if (e.pattern !== 'fan') return false
  const range = B.fanSpeed * B.fanLife
  return championFanAngles(e).some(a => segmentDistance(x, y, c.startX, c.startY, c.startX + Math.cos(a) * range, c.startY + Math.sin(a) * range) < B.fanHitRadius)
}
/** Exactly the five missile corridors; never fill the safe gaps as a cone. */
export function drawChampionTells(ctx: CanvasRenderingContext2D, s: HaebiRun) {
  const F = K.foe
  for (const e of s.enemies) {
    if (!telling(e) || e.pattern !== 'dash' && e.pattern !== 'fan') continue
    const c = e.champion!, range = B.fanSpeed * B.fanLife, progress = Math.max(0, Math.min(1, 1 - e.wind / championWindup(e.pattern)))
    ctx.save(); ctx.lineCap = 'round'; ctx.beginPath()
    if (e.pattern === 'dash') { ctx.moveTo(c.startX, c.startY); ctx.lineTo(e.aimX, e.aimY) }
    else for (const a of championFanAngles(e)) { ctx.moveTo(c.startX, c.startY); ctx.lineTo(c.startX + Math.cos(a) * range, c.startY + Math.sin(a) * range) }
    ctx.strokeStyle = F.line; ctx.lineWidth = 2 * (e.pattern === 'dash' ? B.dashWidth : B.fanHitRadius); ctx.globalAlpha *= F.fillAlpha; ctx.stroke()
    ctx.globalAlpha = F.artFrom + (F.artTo - F.artFrom) * progress
    ctx.strokeStyle = F.rimDark; ctx.lineWidth = F.rimDarkWidth; ctx.stroke()
    ctx.strokeStyle = F.line; ctx.lineWidth = F.rimWidth; ctx.stroke(); ctx.restore()
  }
}
export function drawGroundChests(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun) {
  const image = images.get('raid/chest.png'); if (!image) return
  for (const chest of s.chests ?? []) {
    if (chest.state !== 'ground') continue
    const size = chest.large ? B.view.chestLargeSize : B.view.chestSize
    ctx.save()
    if (chest.large) { ctx.globalAlpha *= B.view.chestGlowAlpha; ctx.fillStyle = K.own.rim; ctx.beginPath(); ctx.arc(chest.x, chest.y - size / 2, size / 2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1 }
    ctx.drawImage(image, chest.x - size / 2, chest.y - size, size, size); ctx.restore()
  }
}
/** World-space markers/nameplates inherit the active DPR/camera transform. */
export function drawChampionOverlays(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, heightOf: (kind: string) => number, bounds: SpawnView = wholeField) {
  const V = B.view
  for (const e of s.enemies) {
    const c = e.champion
    if (!c || e.hp <= 0) continue
    const h = heightOf(e.kind), recovery = championRecovery(e)
    ctx.save(); ctx.strokeStyle = K.own.rim; ctx.lineWidth = K.own.rimWidth
    if (recovery > 0) { ctx.globalAlpha = V.recoveryRingAlpha * recovery; ctx.beginPath(); ctx.arc(e.x, e.y, V.recoveryRingRadius, 0, TAU); ctx.stroke() }
    if (c.mode === 'roar' || c.mode === 'enter') {
      const progress = Math.max(0, Math.min(1, 1 - c.t / (c.mode === 'enter' ? B.entrySeconds : B.roarSeconds))), rings = c.mode === 'roar' ? Math.max(1, (e.phase ?? 1) - 1) : 1
      ctx.globalAlpha = V.roarRingAlpha * (1 - progress)
      for (let i = 1; i <= rings; i++) { ctx.beginPath(); ctx.arc(e.x, e.y - h / 2, V.roarRingRadius * progress * i / rings, 0, TAU); ctx.stroke() }
    }
    ctx.restore()
    if (e.kind !== 'elite' || e.x < bounds.left || e.x > bounds.right || e.y < bounds.top || e.y > bounds.bottom) continue
    const w = V.elitePlateWidth, ph = V.elitePlateHeight, margin = V.eliteMargin
    const x = Math.max(bounds.left + margin, Math.min(bounds.right - margin - w, e.x - w / 2))
    const y = Math.max(bounds.top + margin, Math.min(bounds.bottom - (bounds.bottom - bounds.top) * V.eliteBottomInset - margin - ph - V.eliteHpHeight, e.y - h - V.elitePlateLift - ph))
    const plate = images.get('raid/ui/plaque.png')
    ctx.save()
    if (plate) ctx.drawImage(plate, x, y, w, ph)
    else { ctx.fillStyle = '#111c'; ctx.fillRect(x, y, w, ph) }
    ctx.fillStyle = '#fff5dc'; ctx.font = 'bold ' + V.eliteNameFont + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(ST[s.stage].eliteName, x + w / 2, y + ph / 2, w - margin * 2)
    ctx.fillStyle = '#111c'; ctx.fillRect(x, y + ph, w, V.eliteHpHeight)
    ctx.fillStyle = '#ef9873'; ctx.fillRect(x, y + ph, w * Math.max(0, Math.min(1, e.hp / e.max)), V.eliteHpHeight)
    ctx.restore()
  }
}