import type { CastState, Effect, Kit } from './haebi.ts'
import { awakeUltPath } from './awake-ult-art.ts'
import { HAEBI_AWAKEN_ULT } from '../tune/params.ts'

/** Native alpha8 bounds used only to align/size the full, unchanged image. No pixel scan/crop. */
const BOUNDS: Record<Kit, readonly [number, number, number, number, number, number]> = {
  sword: [2172, 724, 148, 203, 1875, 262], axe: [1448, 1086, 156, 221, 1145, 643],
  bow: [1024, 1536, 444, 114, 136, 1308], spear: [1024, 1536, 370, 83, 282, 1336],
  dagger: [2172, 724, 665, 159, 853, 402], magic: [1024, 1536, 273, 132, 479, 1189],
  sling: [1254, 1254, 271, 359, 755, 567],
  // 채찍(whip)은 각성 컷인 그림이 아직 없다 — 그림이 없으면 막히지 않으니 칸만 단검 것을 빌려 둔다 (카드 W8)
  whip: [2172, 724, 665, 159, 853, 402],
}
const TAU = Math.PI * 2, clamp = (x: number) => Math.max(0, Math.min(1, x))
export type AwakeUltGeometry = { kind: 'line'; length: number; radius: number; burst: number } | { kind: 'disc'; radius: number } | { kind: 'target' } | { kind: 'none' }
/** Exactly the existing inLine rectangle, pulse/splash disc, or an already-hit magic target. */
export function awakeUltGeometry(f: Effect, axeBurst = 0): AwakeUltGeometry {
  if (f.ult === 'sword' || f.ult === 'axe' || f.ult === 'bow') return { kind: 'line', length: Math.hypot(f.x2 - f.x, f.y2 - f.y), radius: f.r, burst: f.ult === 'axe' ? axeBurst : 0 }
  if (f.ult === 'magic') return f.kind === 'skill' ? { kind: 'none' } : { kind: 'target' }
  return f.r > 0 ? { kind: 'disc', radius: f.r } : { kind: 'none' }
}
/** Explicit new accepted-manual sequence only; counters/legacy/normal casts never dim. */
export function awakeCastDim(c: CastState | null): number {
  if (!c || c.kind !== 'ult' || c.awakened !== true || !c.seq || c.total <= 0) return 0
  const progress = clamp(1 - c.t / c.total)
  return HAEBI_AWAKEN_ULT.dim * Math.min(1, progress / .12, (1 - progress) / .15)
}
export function drawAwakeCastDim(ctx: CanvasRenderingContext2D, c: CastState | null, width: number, height: number) {
  const alpha = awakeCastDim(c); if (!alpha) return
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#080b13'; ctx.fillRect(0, 0, width, height); ctx.restore()
}
/** One full native texture, aspect preserved. The core is centered, faint alpha outside it is retained. */
function particle(ctx: CanvasRenderingContext2D, img: HTMLImageElement, kit: Kit, x: number, y: number, width: number, height: number, rotation: number, alpha: number) {
  const [nw, nh, bx, by, bw, bh] = BOUNDS[kit], k = Math.min(width / bw, height / bh)
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.globalAlpha *= clamp(alpha)
  ctx.drawImage(img, -(bx + bw / 2) * k, -(by + bh / 2) * k, nw * k, nh * k); ctx.restore()
}
export type AwakeAirParticle = { anchorX: number; anchorY: number; tipX: number; tipY: number; z: number; artHeight: number; rotation: number; alpha: number; sourceTipX: number; sourceTipY: number }
/** Visible alpha8 bottom-tip centers, measured from unchanged native RAW. */
const AIR_TIPS = { bow: [512, 1421.5], magic: [320, 1320.5] } as const
/** Ground geometry stays untouched; only the screen-up height of its particle is projected. */
export function awakeAirParticles(f: Effect, age: number): AwakeAirParticle[] {
  const out: AwakeAirParticle[] = [], t = clamp(age), fade = Math.min(1, (1 - t) * 2)
  if (age < 0 || age > 1) return out
  if (f.ult === 'bow') {
    const len = Math.hypot(f.x2 - f.x, f.y2 - f.y), cos = Math.cos(f.angle), sin = Math.sin(f.angle)
    for (let i = 0; i < 13; i++) {
      // Preserve the original lane positions/opacity phase; screen-up fall never alters that ground coordinate.
      const phase = (t * 2.4 + i * .19) % 1, along = len * (i + .5) / 13, across = (phase - .5) * f.r * .28
      const anchorX = f.x + cos * along - sin * across, anchorY = f.y + sin * along + cos * across
      const z = HAEBI_AWAKEN_ULT.bowFallHeight * (1 - clamp(t * 2.4 + i * .19))
      out.push({ anchorX, anchorY, tipX: anchorX, tipY: anchorY - z, z, artHeight: HAEBI_AWAKEN_ULT.bowArtHeight, rotation: 0, alpha: fade * (.65 + phase * .35), sourceTipX: AIR_TIPS.bow[0], sourceTipY: AIR_TIPS.bow[1] })
    }
  } else if (f.ult === 'magic' && f.kind !== 'skill') {
    for (let i = 0; i < 3; i++) out.push({ anchorX: f.x, anchorY: f.y, tipX: f.x, tipY: f.y, z: 0, artHeight: HAEBI_AWAKEN_ULT.magicArtHeight * (i === 1 ? 1 : .5), rotation: (i - 1) * .25, alpha: fade, sourceTipX: AIR_TIPS.magic[0], sourceTipY: AIR_TIPS.magic[1] })
  }
  return out
}
function airParticle(ctx: CanvasRenderingContext2D, img: HTMLImageElement, kit: Kit, p: AwakeAirParticle) {
  const [nw, nh, , , , bh] = BOUNDS[kit], k = p.artHeight / bh
  ctx.save(); ctx.translate(p.tipX, p.tipY); ctx.rotate(p.rotation); ctx.globalAlpha *= p.alpha
  // Full original image and aspect ratio, with its actual visible tip at the projected coordinate.
  ctx.drawImage(img, -p.sourceTipX * k, -p.sourceTipY * k, nw * k, nh * k); ctx.restore()
}

/** True means handled. Missing/failed optional art returns false for the unchanged normal fallback. */
export function drawAwakeUlt(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, f: Effect, age: number, axeBurst = 0, afterimage?: (x: number, y: number, alpha: number) => void): boolean {
  const kit = f.ult, img = kit && images.get(awakeUltPath(kit))
  if (!kit || !(f.awakened ?? f.tru) || !img?.complete || !img.naturalWidth || age < 0 || age >= 1) return false
  const geometry = awakeUltGeometry(f, axeBurst), fade = Math.min(1, (1 - age) * 2)
  if (geometry.kind === 'none') return true // Transition/lead cue has no damage footprint.
  // Ground contact is the existing lane/target; a screen-up billboard is not a wider ground AOE.
  if (kit === 'bow' || kit === 'magic') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    for (const p of awakeAirParticles(f, age)) airParticle(ctx, img, kit, p)
    ctx.restore(); return true
  }
  ctx.save(); ctx.translate(f.x, f.y)
  if (geometry.kind === 'line') ctx.rotate(f.angle)
  ctx.beginPath()
  if (geometry.kind === 'line') {
    ctx.rect(-geometry.radius / 2, -geometry.radius, geometry.length + geometry.radius / 2, geometry.radius * 2)
    if (geometry.burst > 0) { ctx.moveTo(geometry.burst, 0); ctx.arc(0, 0, geometry.burst, 0, TAU) }
  } else if (geometry.kind === 'disc') ctx.arc(0, 0, geometry.radius, 0, TAU)
  ctx.clip(); ctx.globalCompositeOperation = 'lighter'
  if (geometry.kind === 'line') {
    const { length: len, radius: r } = geometry
    if (kit === 'sword') {
      const reach = Math.max(1, len * .9), tilt = Math.atan2(r * 1.3, reach)
      for (const sign of [-1, 1]) particle(ctx, img, kit, len * .5, 0, reach, r * .7, tilt * sign, fade)
    } else {
      for (let i = 0; i < 9; i++) {
        const phase = clamp(age * 2 - i * .045)
        particle(ctx, img, kit, len * (i + .35) / 9, Math.sin(i * 2.4) * r * .3, 50 + phase * 35, r * .8, -.5 + Math.sin(i) * .25, fade * phase)
      }
      for (let i = 0; i < 7 && geometry.burst > 0; i++) {
        const a = i * TAU / 7, rr = geometry.burst * (.2 + age * .4)
        particle(ctx, img, kit, Math.cos(a) * rr, Math.sin(a) * rr, 70, 48, a, fade)
      }
    }
  } else if (kit === 'spear' && geometry.kind === 'disc') {
    // The same pulse disc sprouts a forest of individual upright spearheads.
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12 + f.angle * .25, rr = geometry.radius * (.3 + .35 * (i % 2)), rise = Math.sin(Math.PI * clamp(age * 1.4))
      particle(ctx, img, kit, Math.cos(a) * rr, Math.sin(a) * rr - rise * 18, 44, 65 + rise * 65, 0, fade)
    }
  } else if (kit === 'dagger' && geometry.kind === 'disc') {
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 + age * 2.4
      particle(ctx, img, kit, Math.cos(a) * f.r * .26, Math.sin(a) * f.r * .26, f.r * 1.4, f.r * .7, a, fade)
    }
  } else if (kit === 'sling' && geometry.kind === 'disc') {
    const lead = f.kind === 'skill', count = lead ? 7 : 5
    for (let i = 0; i < count; i++) {
      const a = i * 2.39996 + f.angle, rr = geometry.radius * (lead ? .65 : .42) * Math.sqrt((i + .5) / count)
      particle(ctx, img, kit, Math.cos(a) * rr, Math.sin(a) * rr - Math.sin(age * Math.PI) * (lead ? 8 : 14), lead ? 26 : 34, lead ? 22 : 28, a + age, fade)
    }
  }
  ctx.restore()
  if (kit === 'sword' && geometry.kind === 'line' && afterimage) {
    for (let i = 1; i <= 3; i++) afterimage(f.x + (f.x2 - f.x) * i / 4, f.y + (f.y2 - f.y) * i / 4, .32 * fade)
  }
  return true
}
