/**
 * 지도의 바뀌지 않는 꾸밈(땅빛·국경·강·안개·길·구름)을 캔버스 한 장에 — 예전엔 SVG 패스 수백 개와 구름 그림 수십 장이
 * 저마다 그래픽 층이 되어 폰에서 지도가 끊기고 고을이 사라졌다 (perf 검토 11-10 · skill mobile-ui-rules §5).
 *
 *  - mapview.mapHtml 이 `buildMapCanvasData` 로 그릴 것을 모아 여기 맡기고(registerMapCanvas), `<canvas class="mapcv" data-cvkey>` 만 낸다.
 *  - app 이 DOM 을 깐 뒤 `paintMapCanvas(wrap)` — 키가 바뀌었거나 보이는 크기가 크게 바뀌었을 때만 다시 그린다 (배율 굳은 뒤 한 번).
 *  - 고을·군대·이름표·화살·걷는 사람은 그대로 DOM 이다 (눌려야 하고 움직여야 한다).
 * 판을 읽기만 한다 (규칙 2). 결정론과 상관없다.
 */
import { P } from '../../tune/params.ts'

/** 길 한 줄의 획 하나 — 지도 좌표 굵기 */
export interface RoadOp { readonly d: string; readonly c: string; readonly w: number; readonly a: number; readonly dash: readonly number[] | null; readonly cap: 'round' | 'butt'; readonly off?: number }
export interface CloudSpec { readonly src: string; readonly x: number; readonly y: number; readonly w: number; readonly flip: boolean }
export interface RiverOp { readonly d: string; readonly ink: number; readonly wash: number }

export interface MapCanvasData {
  readonly key: string
  /** 지도 좌표 크기 */
  readonly W: number
  readonly H: number
  /** 뭍 밖을 잘라 낼 패스 ('' 면 안 자른다) */
  readonly land: string
  /** 나라 땅 안쪽 빛 */
  readonly fills: ReadonlyArray<{ readonly d: string; readonly col: string; readonly a: number }>
  /** 미리 구운 안쪽 띠 (없으면 안 그린다) */
  readonly band: CanvasImageSource | null
  /** 또렷한 제 색 국경 — own 안으로 잘라 rim 을 긋는다 */
  readonly rims: ReadonlyArray<{ readonly own: string; readonly rim: string; readonly col: string }>
  /** 같은 나라 고을 사이 점선 — 가까이 볼 때만 */
  readonly towns: ReadonlyArray<{ readonly d: string; readonly col: string; readonly a: number }>
  readonly inks: ReadonlyArray<{ readonly d: string; readonly a: number }>
  /** 우리 땅 둘레 */
  readonly gold: string
  readonly myLand: string
  readonly myDark: string
  readonly myCore: string
  readonly rivers: readonly RiverOp[]
  readonly riverPaint: { readonly ink: string; readonly wash: string; readonly inkOp: number; readonly washOp: number }
  /** 안개 — 흰 곳이 덮이는 가림막(그림판) · 한지 · 겹쳐 깐 한지 한 조각의 크기 */
  readonly fog: { readonly mask: HTMLCanvasElement; readonly hanji: string; readonly tile: number } | null
  readonly roads: readonly RoadOp[]
  readonly clouds: readonly CloudSpec[]
  /** 굵기를 px 로 주는 선들 (화면 px) */
  readonly px: { readonly border: number; readonly ink: number; readonly town: number; readonly townDash: number; readonly myEdge: number }
}

/** 그릴 때 읽는 화면 상태 — 가까이 볼 때만 보이는 것 · 보기 끄기 · 멀리서 흐려지는 길 */
interface View { near: boolean; hideTerr: boolean; hideRoads: boolean; dimRoads: boolean }

const registry = new Map<string, MapCanvasData>()

/** mapHtml 이 모은 그림감을 맡긴다 — 키가 같으면 지난번 것을 그대로 쓴다. 옛 것은 몇 개만 남긴다 */
export function registerMapCanvas(d: MapCanvasData): void {
  if (registry.has(d.key)) return
  if (registry.size >= 4) registry.delete(registry.keys().next().value!)
  registry.set(d.key, d)
}

const coarse = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

// ───────── 그림 받기 (한지 · 구름) — 받는 대로 다시 그린다
const imgs = new Map<string, HTMLImageElement>()
const live = new Set<HTMLCanvasElement>()
let again = 0
function img(url: string): HTMLImageElement | null {
  let im = imgs.get(url)
  if (im === undefined) {
    im = new Image()
    im.decoding = 'async'
    im.onload = () => {
      window.clearTimeout(again)
      again = window.setTimeout(() => { for (const cv of live) { if (cv.isConnected) repaint(cv); else live.delete(cv) } }, 30)
    }
    im.src = url
    imgs.set(url, im)
  }
  return im.complete && im.naturalWidth > 0 ? im : null
}

// ───────── 그리기
interface Drawn { key: string; cssW: number; bw: number; near: boolean; hideTerr: boolean; hideRoads: boolean; dimRoads: boolean; missing: boolean }
const drawn = new WeakMap<HTMLCanvasElement, Drawn>()
const alphaMasks = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()

/** 안개 가림막(흰=덮임)의 밝기를 투명도로 바꾼 사본 — 한 번만 */
function alphaMask(m: HTMLCanvasElement): HTMLCanvasElement {
  const had = alphaMasks.get(m)
  if (had !== undefined) return had
  const out = document.createElement('canvas')
  out.width = m.width
  out.height = m.height
  const g = out.getContext('2d')!
  const src = m.getContext('2d')!.getImageData(0, 0, m.width, m.height)
  const d = src.data
  for (let i = 0; i < d.length; i += 4) { d[i + 3] = d[i]!; d[i] = 0; d[i + 1] = 0; d[i + 2] = 0 }
  g.putImageData(src, 0, 0)
  alphaMasks.set(m, out)
  return out
}

export function drawMapCanvas(cv: HTMLCanvasElement, data: MapCanvasData, view: View = { near: true, hideTerr: false, hideRoads: false, dimRoads: false }): void {
  const g = cv.getContext('2d')
  if (g === null) return
  const R = P.realm
  const { W, H } = data
  const cssW = Math.max(1, cv.clientWidth)
  const dpr = Math.min(3, window.devicePixelRatio || 1)
  // 긴 쪽이 한도를 넘지 않게 — 폰은 2048 (그래픽 메모리) · 넘치면 늘려 보여 조금 흐리다
  const cap = coarse() ? R.mapCanvasCapTouch : R.mapCanvasCap
  const s = Math.min((cssW * dpr) / W, cap / Math.max(W, H))
  const bw = Math.max(64, Math.round(W * s))
  const bh = Math.max(64, Math.round(H * s))
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh }
  const sx = bw / W
  const sy = bh / H
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.clearRect(0, 0, bw, bh)
  g.setTransform(sx, 0, 0, sy, 0, 0)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  /** 화면 px 한 칸이 지도 좌표로 얼마인가 (non-scaling-stroke 대신) */
  const u = W / cssW
  let missing = false
  const paths = new Map<string, Path2D>()
  const path = (d: string): Path2D => { let p = paths.get(d); if (p === undefined) { p = new Path2D(d); paths.set(d, p) } return p }
  const line = (d: string, c: string, w: number, a: number, dash: readonly number[] | null = null, cap2: CanvasLineCap = 'round'): void => {
    g.globalAlpha = a
    g.strokeStyle = c
    g.lineWidth = w
    g.lineCap = cap2
    g.setLineDash(dash === null ? [] : [...dash])
    g.stroke(path(d))
  }
  // 겹쳐 그려도 진해지지 않게 — 한 층에 그려 통째로 투명도를 준다 (SVG 의 <g opacity>)
  let tmp: HTMLCanvasElement | null = null
  const layer = (alpha: number, fn: (c: CanvasRenderingContext2D) => void): void => {
    if (alpha >= 1) { fn(g); return }
    tmp ??= document.createElement('canvas')
    if (tmp.width !== bw || tmp.height !== bh) { tmp.width = bw; tmp.height = bh }
    const t = tmp.getContext('2d')!
    t.setTransform(1, 0, 0, 1, 0, 0)
    t.clearRect(0, 0, bw, bh)
    t.setTransform(sx, 0, 0, sy, 0, 0)
    fn(t)
    g.save()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalAlpha = alpha
    g.drawImage(tmp, 0, 0)
    g.restore()
  }
  const strokeOn = (c: CanvasRenderingContext2D, d: string, col: string, w: number): void => {
    c.strokeStyle = col
    c.lineWidth = w
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.setLineDash([])
    c.stroke(path(d))
  }

  // 1. 땅빛 — 뭍 안에서만
  if (!view.hideTerr) {
    g.save()
    if (data.land !== '') g.clip(path(data.land))
    for (const f of data.fills) { g.globalAlpha = f.a; g.fillStyle = f.col; g.fill(path(f.d)) }
    if (data.band !== null) { g.globalAlpha = 1; g.drawImage(data.band, 0, 0, W, H) }
    for (const x of data.rims) {
      g.save()
      g.clip(path(x.own))
      line(x.rim, x.col, data.px.border * u, 0.9)
      g.restore()
    }
    if (view.near) for (const t of data.towns) line(t.d, t.col, data.px.town * u, t.a, [data.px.townDash * u, data.px.townDash * 0.8 * u])
    for (const k of data.inks) line(k.d, '#1a120a', data.px.ink * u, k.a)
    if (data.gold !== '') {
      const w = data.px.myEdge * u
      // 숨 쉬던 빛 대신 가만한 번짐 한 겹 — 움직임이 없어도 우리 땅이 도드라진다
      line(data.gold, data.myLand, w * 2.2, 0.16)
      line(data.gold, data.myDark, w, 0.8)
      line(data.gold, data.myLand, w * 0.6, 1)
      line(data.gold, data.myCore, w * 0.2, 1)
    }
    g.restore()
  }

  // 2. 강
  if (data.rivers.length > 0) {
    const rp = data.riverPaint
    layer(rp.inkOp, (c) => { for (const r of data.rivers) strokeOn(c, r.d, rp.ink, r.ink) })
    layer(rp.washOp, (c) => { for (const r of data.rivers) strokeOn(c, r.d, rp.wash, r.wash) })
  }

  // 3. 안개 — 한지를 깔고 본 땅만 뚫는다
  if (data.fog !== null) {
    const f = data.fog
    tmp ??= document.createElement('canvas')
    if (tmp.width !== bw || tmp.height !== bh) { tmp.width = bw; tmp.height = bh }
    const t = tmp.getContext('2d')!
    t.setTransform(1, 0, 0, 1, 0, 0)
    t.clearRect(0, 0, bw, bh)
    t.globalCompositeOperation = 'source-over'
    t.setTransform(sx, 0, 0, sy, 0, 0)
    t.globalAlpha = 1
    t.fillStyle = '#efe4cc'
    t.fillRect(0, 0, W, H)
    const hj = img(f.hanji)
    if (hj === null) missing = true
    else for (let y = 0; y < H; y += f.tile) for (let x = 0; x < W; x += f.tile) t.drawImage(hj, x, y, f.tile, f.tile)
    t.globalCompositeOperation = 'destination-in'
    t.imageSmoothingQuality = 'high'
    t.drawImage(alphaMask(f.mask), 0, 0, W, H)
    t.globalCompositeOperation = 'source-over'
    g.save()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalAlpha = 1
    g.drawImage(tmp, 0, 0)
    g.restore()
  }

  // 4. 길 — 아는 고을 사이 · 한 끝만 아는 길머리
  if (!view.hideRoads && data.roads.length > 0) {
    layer(view.dimRoads ? 0.62 : 1, (c) => {
      for (const o of data.roads) {
        c.globalAlpha = o.a
        c.strokeStyle = o.c
        c.lineWidth = o.w
        c.lineCap = o.cap
        c.lineJoin = 'round'
        c.setLineDash(o.dash === null ? [] : [...o.dash])
        c.lineDashOffset = o.off ?? 0
        c.stroke(path(o.d))
      }
      c.globalAlpha = 1
    })
  }

  // 5. 구름 — 그린 자리에 가만히 (예전엔 천천히 떠다녔다)
  for (const c of data.clouds) {
    const im = img(c.src)
    if (im === null) { missing = true; continue }
    const w = c.w * W
    const h = (w * im.naturalHeight) / im.naturalWidth
    g.save()
    g.translate(c.x * W, c.y * H)
    if (c.flip) g.scale(-1, 1)
    g.globalAlpha = 0.5
    g.globalCompositeOperation = 'multiply'
    g.drawImage(im, -w / 2, -h / 2, w, h)
    g.restore()
  }
  g.globalAlpha = 1
  g.setLineDash([])
  drawn.set(cv, { key: data.key, cssW, bw, near: view.near, hideTerr: view.hideTerr, hideRoads: view.hideRoads, dimRoads: view.dimRoads, missing })
  live.add(cv)
}

// ───────── 판에 맞추기

function viewOf(cv: HTMLCanvasElement): View {
  const map = cv.closest<HTMLElement>('.map')
  const ap = cv.closest('.ap')
  const region = map?.dataset['region'] ?? ''
  const near = map?.dataset['zl'] === 'near'
  return {
    near,
    hideTerr: ap?.classList.contains('hide-terr') === true,
    hideRoads: ap?.classList.contains('hide-roads') === true,
    dimRoads: !near && (region === 'yeongnam' || region === 'south' || region === 'world'),
  }
}

function repaint(cv: HTMLCanvasElement): void {
  const data = registry.get(cv.dataset['cvkey'] ?? '')
  if (data === undefined || cv.clientWidth <= 0) return
  drawMapCanvas(cv, data, viewOf(cv))
}

const watched = new WeakSet<HTMLElement>()
const timers = new WeakMap<HTMLElement, number>()

/**
 * 깔린 지도에 그림을 맞춘다 — 판이 바뀌었거나(키) 단계·보기 끄기가 바뀌었거나 보이는 크기가 크게 바뀌었으면 다시 그린다. 아니면 아무것도 안 한다.
 * 배율은 굳은 뒤(zoom 이 'mapzoomed' 를 낸다) 잠깐 있다 한 번 — 손짓 중엔 있는 그림을 늘려 보인다
 */
export function paintMapCanvas(wrap: HTMLElement): void {
  if (!watched.has(wrap)) {
    watched.add(wrap)
    wrap.addEventListener('mapzoomed', () => {
      window.clearTimeout(timers.get(wrap))
      timers.set(wrap, window.setTimeout(() => paintMapCanvas(wrap), P.realm.mapCanvasRedrawMs))
    })
  }
  const cv = wrap.querySelector<HTMLCanvasElement>('canvas.mapcv')
  if (cv === null) return
  const data = registry.get(cv.dataset['cvkey'] ?? '')
  const cssW = cv.clientWidth
  if (data === undefined || cssW <= 0) return
  const v = viewOf(cv)
  const d = drawn.get(cv)
  const ratio = P.realm.mapCanvasRedrawRatio
  const stale = d === undefined || d.key !== data.key || d.near !== v.near || d.hideTerr !== v.hideTerr || d.hideRoads !== v.hideRoads || d.dimRoads !== v.dimRoads
    || cssW / d.cssW > ratio || d.cssW / cssW > ratio
  if (stale) drawMapCanvas(cv, data, v)
}
