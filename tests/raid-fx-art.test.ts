import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drawFx, warmFx, FX_PATHS } from '../src/raid/fx-art.ts'
import { FX_BOUNDS } from '../src/raid/fx-bounds.ts'
import { readFileSync, statSync } from 'node:fs'
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
    const images = new Map([['raid/fx/fx_spark_shard.webp', image]])
    const before = JSON.stringify(image)
    warmFx(images)
    const ctx = { save() {}, restore() {}, translate() {}, rotate() {}, drawImage() { draws++ } } as unknown as CanvasRenderingContext2D
    for (let i = 0; i < 20; i++) assert.equal(drawFx(ctx, images, 'fx_spark_shard', 10, 20, 18, 5), true)
    assert.equal(readbacks, 0); assert.equal(canvases, 1); assert.equal(bakes, 1); assert.equal(draws, 20)
    assert.equal(JSON.stringify(image), before)
    assert.equal(drawFx(ctx, new Map(), 'stamp_defeat', 0, 0, 100, 50), false)
  } finally { if (original) Object.defineProperty(globalThis, 'document', { configurable: true, value: original }); else Reflect.deleteProperty(globalThis, 'document') }
})

test('shipped FX paths match WebP files and alpha metadata under the 1.5MB budget', () => {
  let bytes = 0
  assert.equal(FX_PATHS.length, 10)
  assert.equal(Object.keys(FX_BOUNDS).length, 10)
  for (const path of FX_PATHS) {
    const url = new URL(`../public/realm/${path}`, import.meta.url)
    const data = readFileSync(url)
    assert.equal(data.toString('ascii', 0, 4), 'RIFF')
    assert.equal(data.toString('ascii', 8, 12), 'WEBP')
    // VP8X declares alpha and the decoded canvas dimensions without a decoder.
    assert.equal(data.toString('ascii', 12, 16), 'VP8X')
    assert.ok(data[20]! & 0x10, path)
    const width = 1 + data.readUIntLE(24, 3), height = 1 + data.readUIntLE(27, 3)
    const bounds = FX_BOUNDS[path.slice('raid/fx/'.length)]!
    assert.ok(bounds, path)
    assert.ok(bounds[0] >= 0 && bounds[1] >= 0 && bounds[2] > 0 && bounds[3] > 0)
    assert.ok(bounds[0] + bounds[2] <= width && bounds[1] + bounds[3] <= height, path)
    if (!path.includes('stamp_') && !path.includes('victory_rays')) assert.ok(Math.max(width, height) <= 128, path)
    bytes += statSync(url).size
  }
  assert.ok(bytes < 1_500_000, `FX bundle ${bytes} bytes`)
})

test('death particles obey the remaining per-frame budget without mutating the effect', () => {
  const effect: Effect = { x: 10, y: 20, x2: 0, y2: 0, r: 25, angle: 0, life: .6, total: 1, kind: 'death', mob: 'elite', color: '#ddd', face: -1 }
  const before = JSON.stringify(effect)
  const ctx = { globalAlpha: 1, save() {}, restore() {} } as unknown as CanvasRenderingContext2D
  assert.equal(drawImpactParticles(ctx, new Map(), effect, .4, 4), 4)
  assert.equal(drawImpactParticles(ctx, new Map(), effect, .4, 0), 0)
  assert.equal(JSON.stringify(effect), before)
})
