import { HAEBI_FX_ART as A } from '../tune/params.ts'
import { drawFx, type FxName } from './fx-art.ts'
import type { Effect } from './haebi.ts'

const INK: readonly FxName[] = ['fx_ink_splat_a', 'fx_ink_splat_b', 'fx_ink_splat_c']
/** Individual authored particles; deterministic view math, no sim RNG or per-frame objects. */
export function drawImpactParticles(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, effect: Effect, age: number, budget: number) {
  const death = effect.kind === 'death', elite = effect.mob === 'elite' || effect.mob === 'boss'
  if (!death && age * effect.total > A.sparkGate) return 0
  const count = Math.min(budget, death ? elite ? A.eliteParticles : A.deathParticles : A.hitSparks)
  const t = age * effect.total, direction = (effect.face ?? -1) > 0 ? Math.PI : 0, speed = elite ? A.eliteSpeed : A.particleSpeed
  let inkIndex = Math.abs(Math.round(effect.x + effect.y)) % INK.length
  ctx.save(); ctx.globalAlpha *= Math.max(0, 1 - age)
  for (let i = 0; i < count; i++) {
    const angle = direction + Math.sin((i + 1) * A.particleSeed + effect.x) * Math.PI * A.particleSpread
    const v = speed * (A.particleMinSpeed + A.particleSpeedRange * (i + 1) / count)
    const x = effect.x + Math.cos(angle) * v * t, y = effect.y + (Math.sin(angle) * v - A.particleLift) * t + A.particleGravity * t * t / 2
    const name: FxName = !death || i % A.sparkEvery === 0 ? 'fx_spark_shard' : i % A.dustEvery === 0 ? 'fx_dust_puff' : INK[inkIndex++ % INK.length]!
    const size = (name === 'fx_dust_puff' ? A.dustSize : A.inkSize) * (1 + i % A.inkVariants * A.particleSizeStep) * (1 - age * A.particleShrink)
    drawFx(ctx, images, name, x, y, name === 'fx_spark_shard' ? A.sparkWidth : size, name === 'fx_spark_shard' ? A.sparkHeight : size, angle + t * A.particleSpin)
  }
  ctx.restore(); return count
}
