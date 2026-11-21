import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHaebi } from '../src/raid/haebi.ts'
import { drawField } from '../src/raid/haebi-view.ts'
import { HAEBI_RUN as C } from '../src/tune/params.ts'
import { fieldPixels, heroCacheHeight, wantsHeroHd } from '../src/raid/surface.ts'
import { sprite, setHeroArt, heroHdFiles } from '../src/raid/haebi-view.ts'
import { drawEnding } from '../src/raid/ending-view.ts'
import { RaidEnding } from '../src/raid/ending.ts'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { HERO_HD_SHEETS } from '../src/raid/hero-hd.ts'

function context() {
  const transforms: number[][] = []
  const ctx = new Proxy({ canvas: { width: C.width * 2, height: C.height * 2 }, setTransform: (...v: number[]) => transforms.push(v) }, {
    get: (o, k) => k in o ? o[k as keyof typeof o] : () => undefined,
    set: (o, k, v) => { (o as Record<string | symbol, unknown>)[k] = v; return true },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, transforms }
}
test('53-A field retains backing density in its identity and zoom transforms', () => {
  const { ctx, transforms } = context(), s = createHaebi(53)
  drawField(ctx, new Map(), s, null, { zoom: 1.8, x: C.width / 2, y: C.height / 2 })
  assert.deepEqual(transforms[0], [2, 0, 0, 2, 0, 0], 'base backing density must survive renderer reset')
  assert.equal(transforms[1]![0], 3.6, 'camera zoom multiplies backing density')
  assert.equal(transforms.at(-1)![0], 2, 'screen overlays restore backing density, not one')
})
test('53-A actual CSS content controls backing, low tier uses DPR1, pointer logical size stays1120x720', () => {
  assert.deepEqual(fieldPixels(587.984375, 378, 2), { width: 1176, height: 756, ratio: 2 })
  assert.deepEqual(fieldPixels(587.984375, 378, 3), fieldPixels(587.984375, 378, 2))
  assert.deepEqual(fieldPixels(587.984375, 378, 2, true), { width: 588, height: 378, ratio: 1 })
  assert.equal(heroCacheHeight(94, 1.8 * 2, 160), 160)
  assert.equal(heroCacheHeight(94, 1.8 * 2, 320), 320)
  assert.equal(wantsHeroHd(1.3), false); assert.equal(wantsHeroHd(1.3001), true)
  setHeroArt('jumong', 'aw1-jumong')
  assert.deepEqual(heroHdFiles(1), []); assert.deepEqual(heroHdFiles(1.8), ['anim-px/gen-jumong_hd.png', 'anim-px/gen-aw1-jumong_hd.png'], '11-22: 각성 주몽도 2배 띠(bake-hero-hd2)')
  setHeroArt('base-w-102-garak-dana')
  assert.deepEqual(heroHdFiles(4), [], 'unqualified Dana source cannot masquerade asHD')
})
test('53-A density cache preserves logical size, folds wideHD, prewarms white without getImageData', () => {
  const old = globalThis.document, made: { width: number; height: number; draws: number }[] = []
  const fake = { createElement: () => { const c = { width: 0, height: 0, draws: 0, getContext: () => ({ drawImage: () => c.draws++, fillRect: () => undefined, getImageData: () => { throw Error('readback stall') } }) }; made.push(c); return c } }
  Object.defineProperty(globalThis, 'document', { value: fake, configurable: true })
  try {
    const draws: unknown[][] = [], ctx = { canvas: { width: 2240, height: 1440 }, translate() {}, scale() {}, drawImage: (...a: unknown[]) => draws.push(a), imageSmoothingEnabled: true } as unknown as CanvasRenderingContext2D
    const im = { width: 7680, height: 320, complete: true } as HTMLImageElement, images = new Map([['hero-hd', im]])
    sprite(ctx, images, 'hero-hd', 1, 1, 94, 0, 1, false, 2)
    assert.equal(draws[0]![8], 94, 'cache source density must not enlarge the logical hero')
    assert.ok(made.length >= 2, 'normal rendering warmed the white mask already')
    assert.ok(made.every(c => c.width <= C.spriteBakeMax), 'wideHD is folded below4096')
    const count = made.length
    sprite(ctx, images, 'hero-hd', 1, 1, 94, 18, 1, 'white', 2)
    assert.equal(made.length, count, 'first white hit allocates no new mask')
  } finally { if (old === undefined) Reflect.deleteProperty(globalThis, 'document'); else Object.defineProperty(globalThis, 'document', { value: old, configurable: true }) }
})
test('53-A ending overlay also restores backing transform while using logical dimensions', () => {
  const { ctx, transforms } = context(), end = new RaidEnding(), s = createHaebi(53)
  s.state = 'lost'; end.observe(s); end.advance(.4, true)
  drawEnding(ctx, end, null, 0, new Map())
  assert.deepEqual(transforms[0], [2, 0, 0, 2, 0, 0])
})
test('53-A shipped nativeHD itself fits4096, and folded frame18 uses row1 without changing20-frame order', () => {
  const path = 'anim-px/gen-jumong_hd.png', sheet = HERO_HD_SHEETS[path]!, draws: unknown[][] = []
  const png = readFileSync(new URL('../public/realm/anim-px/gen-jumong_hd.png', import.meta.url))
  const meta = JSON.parse(readFileSync(new URL('../tools/sprite-kit/hero-hd-jumong.json', import.meta.url), 'utf8'))
  assert.equal(png.readUInt32BE(16), 3840); assert.equal(png.readUInt32BE(20), 640)
  assert.equal(createHash('sha256').update(png).digest('hex'), meta.sha256)
  assert.ok(meta.rawToHdScale <= 1 && meta.rawToHdScale * meta.walkFactor <= 1, 'native pixels are reduced, never upscaled')
  assert.equal(meta.feet, 312); assert.equal(meta.frames.length, 20)
  assert.ok(meta.frames.every((f: { frame: number; feet: number }, i: number) => f.frame === i && f.feet === 312))
  const ctx = { canvas: { width: 2240, height: 1440 }, translate() {}, scale() {}, drawImage: (...a: unknown[]) => draws.push(a), imageSmoothingEnabled: true } as unknown as CanvasRenderingContext2D
  sprite(ctx, new Map([[path, { width: sheet.cell[0] * sheet.cols, height: 640, complete: true } as HTMLImageElement]]), path, 1, 1, 94, 18, 1, false, 4)
  assert.deepEqual(draws[0]!.slice(1, 5), [3072, 320, 384, 320])
  assert.equal(draws[0]![7], 113, 'logical width stays the same rounded113px as the approved normal strip')
})
