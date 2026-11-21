const BORDER = 6, LOW = 16, HIGH = 36
/** Alpha-only subset of skill-cut-bake.py: edge-connected plate, no internal keying/blur/crop. */
export function cutinPlateAlpha(pixels: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const n = w * h
  if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0 || !Number.isSafeInteger(n) || pixels.length !== n * 4) throw new RangeError('Invalid cutin pixels/dimensions')
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
  let samples = 0
  const sample = (x: number, y: number) => {
    const p = (y * w + x) * 4
    for (let c = 0; c < 3; c++) hist[c]![pixels[p + c]!]!++
    samples++
  }
  // Preserve the original four-band sampling, including duplicated corner samples.
  for (let y = 0; y < Math.min(BORDER, h); y++) for (let x = 0; x < w; x++) sample(x, y)
  for (let y = Math.max(0, h - BORDER); y < h; y++) for (let x = 0; x < w; x++) sample(x, y)
  for (let y = 0; y < h; y++) for (let x = 0; x < Math.min(BORDER, w); x++) sample(x, y)
  for (let y = 0; y < h; y++) for (let x = Math.max(0, w - BORDER); x < w; x++) sample(x, y)
  const median = hist.map(channel => {
    const lower = Math.floor((samples - 1) / 2), upper = Math.floor(samples / 2)
    let count = 0, lo = -1
    for (let v = 0; v < 256; v++) { count += channel[v]!; if (lo < 0 && count > lower) lo = v; if (count > upper) return (lo + v) / 2 }
    return 0
  })
  const distance = (i: number) => Math.abs(pixels[i * 4]! - median[0]!) + Math.abs(pixels[i * 4 + 1]! - median[1]!) + Math.abs(pixels[i * 4 + 2]! - median[2]!)
  const alpha = new Uint8ClampedArray(n), near = new Uint8Array(n), queue = new Uint32Array(n)
  for (let i = 0; i < n; i++) { alpha[i] = pixels[i * 4 + 3]!; if (distance(i) < HIGH) near[i] = 1 }
  let head = 0, tail = 0
  const visit = (i: number) => {
    if (near[i] !== 1) return
    near[i] = 2; queue[tail++] = i
    alpha[i] = Math.floor(pixels[i * 4 + 3]! * Math.max(0, Math.min(1, (distance(i) - LOW) / (HIGH - LOW))))
  }
  for (let x = 0; x < w; x++) { visit(x); visit((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { visit(y * w); visit(y * w + w - 1) }
  while (head < tail) {
    const i = queue[head++]!, x = i % w
    if (x > 0) visit(i - 1); if (x + 1 < w) visit(i + 1)
    if (i >= w) visit(i - w); if (i + w < n) visit(i + w)
  }
  return alpha
}

const plates = new Map<string, Promise<HTMLCanvasElement>>()
/** Full native canvas, one decoded/matted result per same-origin URL. Failures are caller-owned. */
export function prepareCutinPlate(src: string): Promise<HTMLCanvasElement> {
  let key: string
  try {
    if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof location === 'undefined') throw new Error('Cutin canvas unavailable')
    const url = new URL(src, document.baseURI)
    if (url.origin !== location.origin || (url.protocol !== 'http:' && url.protocol !== 'https:')) throw new Error('Cutin source must be same-origin')
    key = url.href
  } catch (error) { return Promise.reject(error) }
  const cached = plates.get(key); if (cached) return cached
  const request = (async () => {
    const image = new Image(); image.src = key; await image.decode()
    const w = image.naturalWidth, h = image.naturalHeight
    if (!w || !h) throw new Error('Empty cutin source')
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) throw new Error('Cutin 2D canvas unavailable')
    ctx.drawImage(image, 0, 0)
    const frame = ctx.getImageData(0, 0, w, h), alpha = cutinPlateAlpha(frame.data, w, h)
    for (let i = 0; i < alpha.length; i++) frame.data[i * 4 + 3] = alpha[i]!
    ctx.putImageData(frame, 0, 0); return canvas
  })()
  plates.set(key, request)
  void request.catch(() => { if (plates.get(key) === request) plates.delete(key) })
  return request
}
