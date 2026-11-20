import { HAEBI_FX_ART as A } from '../tune/params.ts'
import { FX_BOUNDS } from './fx-bounds.ts'

export const FX_NAMES = ['fx_spark_shard', 'fx_ink_splat_a', 'fx_ink_splat_b', 'fx_ink_splat_c', 'fx_dust_puff', 'stamp_defeat', 'stamp_defeat_band', 'stamp_victory', 'stamp_victory_band', 'fx_victory_rays'] as const
export type FxName = typeof FX_NAMES[number]
export const FX_PATHS = FX_NAMES.map(n => `raid/fx/${n}.webp`)
type Sprite = { canvas: HTMLCanvasElement; width: number; height: number }
const cache = new WeakMap<HTMLImageElement, Sprite>()

/** One alpha scan per loaded source. Original files and pixels are never written. */
function prepared(img: HTMLImageElement, name: FxName): Sprite | null {
  const old = cache.get(img); if (old) return old
  if (!img.complete || !img.naturalWidth || typeof document === 'undefined') return null
  let bounds = FX_BOUNDS[`${name}.webp`]
  if (!bounds) {
    // Development fallback only: shipped assets have precomputed alpha metadata.
    const probe = document.createElement('canvas'), ratio = Math.min(1, A.alphaProbeMax / Math.max(img.naturalWidth, img.naturalHeight))
    probe.width = Math.max(1, Math.round(img.naturalWidth * ratio)); probe.height = Math.max(1, Math.round(img.naturalHeight * ratio))
    const g = probe.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0, probe.width, probe.height)
    let x0 = probe.width, y0 = probe.height, x1 = 0, y1 = 0
    try {
      const data = g.getImageData(0, 0, probe.width, probe.height).data
      for (let y = 0; y < probe.height; y++) for (let x = 0; x < probe.width; x++) if (data[(y * probe.width + x) * 4 + 3]! >= A.alphaThreshold) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1) }
    } catch { x0 = y0 = 0; x1 = probe.width; y1 = probe.height }
    if (x1 <= x0 || y1 <= y0) return null
    bounds = [Math.floor(x0 / ratio), Math.floor(y0 / ratio), Math.ceil((x1 - x0) / ratio), Math.ceil((y1 - y0) / ratio)]
  }
  const [sx, sy] = bounds, sw = Math.min(img.naturalWidth - sx, bounds[2]), sh = Math.min(img.naturalHeight - sy, bounds[3])
  const max = name.startsWith('stamp_') || name === 'fx_victory_rays' ? A.uiBakeMax : A.particleBakeMax, k = Math.min(1, max / Math.max(sw, sh))
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(sw * k)); canvas.height = Math.max(1, Math.round(sh * k))
  canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  const result = { canvas, width: sw, height: sh }; cache.set(img, result); return result
}
export function warmFx(images: Map<string, HTMLImageElement>) { for (const name of FX_NAMES) { const img = images.get(`raid/fx/${name}.webp`); if (img) prepared(img, name) } }

/** Draw one authored particle/object, aspect-fit to a box; false permits the existing fallback. */
export function drawFx(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, name: FxName, x: number, y: number, width: number, height: number, rotation = 0): boolean {
  const img = images.get(`raid/fx/${name}.webp`), art = img && prepared(img, name); if (!art) return false
  const k = Math.min(width / art.width, height / art.height), w = art.width * k, h = art.height * k
  ctx.save(); ctx.translate(x, y); if (rotation) ctx.rotate(rotation); ctx.drawImage(art.canvas, -w / 2, -h / 2, w, h); ctx.restore(); return true
}
