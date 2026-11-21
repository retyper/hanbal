import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cutinPlateAlpha } from '../src/raid/cutin-plate.ts'
const NAVY = [12, 20, 33, 255] as const
function fixture(w = 60, h = 60) {
  const pixels = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) pixels.set(NAVY, i * 4)
  const put = (x: number, y: number, rgba: readonly number[]) => pixels.set(rgba, (y * w + x) * 4)
  const at = (alpha: Uint8ClampedArray, x: number, y: number) => alpha[y * w + x]
  return { pixels, w, h, put, at }
}
test('border-connected navy plate disappears, gold weapon and enclosed navy clothing retain original alpha, RGB input is unchanged', () => {
  const f = fixture()
  for (let y = 20; y < 40; y++) for (let x = 20; x < 40; x++) f.put(x, y, [210, 162, 54, 255])
  for (let y = 24; y < 36; y++) for (let x = 24; x < 36; x++) f.put(x, y, [12, 20, 33, 173])
  for (let x = 0; x < 16; x++) f.put(x, 27, [255, 211, 91, 219])
  const before = f.pixels.slice(), alpha = cutinPlateAlpha(f.pixels, f.w, f.h)
  assert.equal(f.at(alpha, 0, 0), 0, 'opaque exterior plate must become transparent')
  assert.equal(f.at(alpha, 30, 30), 173, 'enclosed navy clothes must never be keyed out')
  assert.equal(f.at(alpha, 0, 27), 219, 'gold weapon touching the boundary must survive')
  assert.deepEqual(f.pixels, before); assert.equal(alpha.length, f.w * f.h); assert.notEqual(alpha.buffer, f.pixels.buffer)
})
test('only distance<36 boundary component receives LOW16/HIGH36 ramp multiplied by source alpha', () => {
  const f = fixture(); f.put(0, 10, [38, 20, 33, 200]); f.put(1, 10, [47, 20, 33, 128]); f.put(2, 10, [48, 20, 33, 255]); f.put(0, 11, [28, 20, 33, 255])
  const alpha = cutinPlateAlpha(f.pixels, f.w, f.h)
  assert.equal(f.at(alpha, 0, 10), 100); assert.equal(f.at(alpha, 1, 10), Math.floor(128 * 19 / 20))
  assert.equal(f.at(alpha, 2, 10), 255); assert.equal(f.at(alpha, 0, 11), 0)
})
test('flood fill is four-connected: a diagonal navy opening cannot erase enclosed clothing', () => {
  const f = fixture()
  for (let y = 29; y <= 31; y++) for (let x = 29; x <= 31; x++) f.put(x, y, [210, 162, 54, 255])
  f.put(29, 29, NAVY); f.put(30, 30, [12, 20, 33, 97])
  const alpha = cutinPlateAlpha(f.pixels, f.w, f.h)
  assert.equal(f.at(alpha, 29, 29), 0); assert.equal(f.at(alpha, 30, 30), 97)
})

test('invalid dimensions fail explicitly; transparent source pixels stay transparent', () => {
  assert.throws(() => cutinPlateAlpha(new Uint8ClampedArray(4), 0, 1), RangeError)
  assert.throws(() => cutinPlateAlpha(new Uint8ClampedArray(4), 2, 1), RangeError)
  const f = fixture(); f.put(30, 30, [255, 190, 60, 0])
  assert.equal(f.at(cutinPlateAlpha(f.pixels, f.w, f.h), 30, 30), 0)
})
import { prepareCutinPlate } from '../src/raid/cutin-plate.ts'

test('native offscreen canvas is decoded/matted once per URL with RGB intact and without source crop', async () => {
  const saved = ['document', 'Image', 'location'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const)
  const w = 800, h = 1200, source = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) source.set(NAVY, i * 4)
  source.set([240, 180, 45, 255], (600 * w + 400) * 4)
  const before = source.slice(), draws: unknown[][] = []
  let images = 0, decodes = 0, canvases = 0, put: Uint8ClampedArray | undefined
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'http://127.0.0.1:5173' } })
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: class {
    naturalWidth = w; naturalHeight = h; src = ''; constructor() { images++ } async decode() { decodes++ }
  } })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    baseURI: 'http://127.0.0.1:5173/raid.html', createElement(tag: string) {
      assert.equal(tag, 'canvas'); canvases++
      return { width: 0, height: 0, getContext: () => ({
        drawImage(...args: unknown[]) { draws.push(args) },
        getImageData(x: number, y: number, width: number, height: number) { assert.deepEqual([x, y, width, height], [0, 0, w, h]); return { data: source.slice() } },
        putImageData(frame: { data: Uint8ClampedArray }, x: number, y: number) { assert.deepEqual([x, y], [0, 0]); put = frame.data.slice() },
      }) }
    },
  } })
  try {
    const a = prepareCutinPlate('/plate-native-test.jpg'), b = prepareCutinPlate('http://127.0.0.1:5173/plate-native-test.jpg')
    assert.equal(a, b); const canvas = await a
    assert.equal(canvas.width, w); assert.equal(canvas.height, h); assert.equal(await prepareCutinPlate('/plate-native-test.jpg'), canvas)
    assert.deepEqual([images, decodes, canvases, draws.length], [1, 1, 1, 1]); assert.equal(draws[0]!.length, 3); assert.deepEqual(draws[0]!.slice(1), [0, 0])
    assert.ok(put); assert.equal(put[3], 0); assert.equal(put[(600 * w + 400) * 4 + 3], 255)
    for (let i = 0; i < source.length; i++) if (i % 4 !== 3) assert.equal(put[i], source[i])
    assert.deepEqual(source, before)
    await assert.rejects(prepareCutinPlate('https://outside.invalid/plate.jpg'), /same-origin/); assert.equal(images, 1)
  } finally { for (const [key, desc] of saved) { if (desc) Object.defineProperty(globalThis, key, desc); else Reflect.deleteProperty(globalThis, key) } }
})
test('decode or readback failure rejects for caller fallback and failed cache entries can retry', async () => {
  const saved = ['document', 'Image', 'location'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const)
  let failDecode = true, count = 0
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'http://127.0.0.1:5173' } })
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: class {
    naturalWidth = 2; naturalHeight = 2; src = ''; constructor() { count++ } async decode() { if (failDecode) throw Error('decode failed') }
  } })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    baseURI: 'http://127.0.0.1:5173/raid.html', createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {}, getImageData() { throw Error('tainted readback') } }) }),
  } })
  try {
    await assert.rejects(prepareCutinPlate('/plate-failure-test.jpg'), /decode failed/); failDecode = false
    await assert.rejects(prepareCutinPlate('/plate-failure-test.jpg'), /tainted readback/); assert.equal(count, 2)
  } finally { for (const [key, desc] of saved) { if (desc) Object.defineProperty(globalThis, key, desc); else Reflect.deleteProperty(globalThis, key) } }
})
