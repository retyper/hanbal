import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drawFx, warmFx } from '../src/raid/fx-art.ts'
import { drawImpactParticles } from '../src/raid/fx-particles.ts'
import type { Effect } from '../src/raid/haebi.ts'

test('authored particle prewarm uses metadata, never reads pixels in a hit frame, and keeps one small cache', () => {
  const original = globalThis.document
  let canvases = 0, readbacks = 0, bakes = 0, draws = 0
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => {
    canvases++
    return { width: 0, height: 0, getContext: () => ({ drawImage: () => bakes++, getImageData: () => { readbacks++; throw new Error('unexpected hot-path readback') } }) }
  } } })
  try {
    const image = { complete: true, naturalWidth: 2200, naturalHeight: 1000 } as HTMLImageElement
    const images = new Map([['raid/fx/fx_spark_shard.png', image]])
    const before = JSON.stringify(image)
    warmFx(images)
    const ctx = { save() {}, restore() {}, translate() {}, rotate() {}, drawImage() { draws++ } } as unknown as CanvasRenderingContext2D
    for (let i = 0; i < 20; i++) assert.equal(drawFx(ctx, images, 'fx_spark_shard', 10, 20, 18, 5), true)
    assert.equal(readbacks, 0); assert.equal(canvases, 1); assert.equal(bakes, 1); assert.equal(draws, 20)
    assert.equal(JSON.stringify(image), before)
    assert.equal(drawFx(ctx, new Map(), 'stamp_defeat', 0, 0, 100, 50), false)
  } finally { if (original) Object.defineProperty(globalThis, 'document', { configurable: true, value: original }); else Reflect.deleteProperty(globalThis, 'document') }
})

test('death particles obey the remaining per-frame budget without mutating the effect', () => {
  const effect: Effect = { x: 10, y: 20, x2: 0, y2: 0, r: 25, angle: 0, life: .6, total: 1, kind: 'death', mob: 'elite', color: '#ddd', face: -1 }
  const before = JSON.stringify(effect)
  const ctx = { globalAlpha: 1, save() {}, restore() {} } as unknown as CanvasRenderingContext2D
  assert.equal(drawImpactParticles(ctx, new Map(), effect, .4, 4), 4)
  assert.equal(drawImpactParticles(ctx, new Map(), effect, .4, 0), 0)
  assert.equal(JSON.stringify(effect), before)
})
