/**
 * 넓어지는 지도의 바탕 — 조각 그림을 한 장으로 잇는다 (docs/realm/WORLD-MAP.md §1 · 형: "부분부분 만든걸 합쳐가지고")
 *
 * 조각(public/realm/map-world/*.webp)을 판의 경위도 틀(WorldGeo.tiles)대로 캔버스에 놓고, 앞 조각과 겹친 띠는 서서히 비치게 섞는다.
 * 계절 그림은 따로 없다 — 봄 한 장에 계절 빛을 입힌다(여름 짙은 초록 · 가을 금빛 · 겨울 흰빛). 한 번 만들면 판·계절마다 주소를 남겨 둔다.
 * 다 만들어지면 그 판의 지도(.map[data-world])의 바탕을 바꾼다 — 다시 그리지 않는다. 화면 전용 (판 상태를 안 건드린다).
 */
import type { WorldGeo } from '../../realm/data/regions/geoframe.ts'
import { worldGeoOf } from '../../realm/data/regions/index.ts'
import type { RegionId, SeasonOfYear } from '../../realm/types.ts'
import { tintPixels } from './seasontint.ts'

export { tintPixels }

/** 조각 눈금 — 1024px 이 경도 2.9°, 765px 이 위도 2.0° (판의 scale 배로 잇는다) */
const PX0 = 1024 / 2.9
const PY0 = 765 / 2.0

/** 열쇠 `판:계절` */
const urls = new Map<string, string>()
const bases = new Map<RegionId, Promise<HTMLCanvasElement>>()
const pending = new Set<string>()
/** 판마다 마지막으로 다 만든 바탕 — 새 계절 것이 아직이면 이것을 깔아 둔다 (빈 바탕으로 깜빡이지 않게 · 형 10-23) */
const lastByRegion = new Map<RegionId, string>()

/** 새 계절 바탕이 아직 안 됐을 때 대신 깔 것 — 없으면 '' */
export function worldMapFallback(region: RegionId): string {
  return lastByRegion.get(region) ?? ''
}

/**
 * 계절 빛 — 픽셀 하나 [r,g,b] → [r,g,b]. 시험할 수 있게 따로 둔다.
 * 봄: 그대로 · 여름: 초록을 짙게, 조금 어둡게 · 가을: 풀빛을 금빛으로 · 겨울: 빛을 빼고 밝게, 푸르스름하게
 */
export function seasonTint(season: SeasonOfYear, r: number, g: number, b: number): [number, number, number] {
  switch (season) {
    case 'spring': return [r, g, b]
    case 'summer': return [r * 0.86, g * 0.95, b * 0.88]
    case 'autumn': {
      const leaf = g > r && g > b ? Math.min(1, (g - Math.max(r, b)) / 40) : 0
      return [r + (g - r) * 0.85 * leaf + 10, g * (1 - 0.12 * leaf), b * (1 - 0.35 * leaf)]
    }
    case 'winter': {
      const l = 0.3 * r + 0.59 * g + 0.11 * b
      const w = Math.min(255, l * 1.12 + 26)
      return [w * 0.95 * 0.7 + r * 0.3 * 0.95, w * 0.98 * 0.7 + g * 0.3, Math.min(255, w * 1.04) * 0.7 + b * 0.3]
    }
  }
}


async function load(src: string): Promise<HTMLImageElement> {
  const im = new Image()
  im.src = src
  await im.decode()
  return im
}

/** 봄 바탕 한 장 — 조각을 잇는다 */
function buildBase(art: string, region: RegionId, geo: WorldGeo): Promise<HTMLCanvasElement> {
  const hit = bases.get(region)
  if (hit !== undefined) return hit
  const made = (async () => {
    const PROJ = geo.proj
    const PX = PX0 * geo.scale
    const PY = PY0 * geo.scale
    const W = Math.round((PROJ.lon1 - PROJ.lon0) * PX)
    const H = Math.round((PROJ.lat1 - PROJ.lat0) * PY)
    const c = document.createElement('canvas')
    // 판만의 그림 한 장 — 그 그림의 해상도 그대로 (틀에 맞춰 그려 왔다)
    if (geo.base !== undefined) {
      const im = await load(`${art}${geo.base}`)
      c.width = im.width
      c.height = im.height
      c.getContext('2d')!.drawImage(im, 0, 0)
      return c
    }
    c.width = W
    c.height = H
    const g = c.getContext('2d')!
    g.fillStyle = '#cdb98e' // 조각이 안 닿는 데는 빈 옛 종이
    g.fillRect(0, 0, W, H)
    for (const t of geo.tiles) {
      const im = await load(`${art}map-world/${t.file}.webp`)
      const tw = Math.round((t.lon1 - t.lon0) * PX)
      const th = Math.round((t.lat1 - t.lat0) * PY)
      const tile = document.createElement('canvas')
      tile.width = tw
      tile.height = th
      const tg = tile.getContext('2d')!
      // 가장자리 종이 테두리를 잘라 내고 편다 (WorldTile.trim — 그림 1024×765 기준 px)
      const k = im.width / 1024
      const cw = (t.trim?.w ?? 0) * k
      const cn = (t.trim?.n ?? 0) * k
      tg.drawImage(im, cw, cn, im.width - cw - (t.trim?.e ?? 0) * k, im.height - cn - (t.trim?.s ?? 0) * k, 0, 0, tw, th)
      // 겹친 띠 — 바깥 끝은 비치고 안쪽으로 갈수록 이 조각이 덮는다
      const mask = document.createElement('canvas')
      mask.width = tw
      mask.height = th
      const mg = mask.getContext('2d')!
      mg.fillStyle = '#000'
      mg.fillRect(0, 0, tw, th)
      // 가장자리 흐림 — 캔버스 그러데이션 대신 1px 띠를 한 줄씩 지운다 (destination-out). 갤럭시 크롬은 캔버스 그러데이션을 못 그려
      // 흐리려던 조각이 통째로 투명해졌다 — 지도에 한지만 남은 네모가 생겼다 (형 10-28: "맵이 조각조각")
      mg.globalCompositeOperation = 'destination-out'
      const fade = (x0: number, y0: number, x1: number, y1: number): void => {
        const along = y0 === y1 // 가로로 흐린다 (동·서) · 아니면 세로 (남)
        const L = Math.max(1, Math.round(along ? Math.abs(x1 - x0) : Math.abs(y1 - y0)))
        const dir = along ? Math.sign(x1 - x0) : Math.sign(y1 - y0)
        for (let i = 0; i < L; i++) {
          mg.fillStyle = `rgba(0,0,0,${(1 - (i + 0.5) / L).toFixed(4)})`
          const at = Math.round((along ? x0 : y0) + dir * i - (dir < 0 ? 1 : 0))
          if (along) mg.fillRect(at, 0, 1, th)
          else mg.fillRect(0, at, tw, 1)
        }
      }
      if (t.fade.e !== undefined) fade(tw, 0, tw - t.fade.e * PX, 0)
      if (t.fade.w !== undefined) fade(0, 0, t.fade.w * PX, 0)
      if (t.fade.s !== undefined) fade(0, th, 0, th - t.fade.s * PY)
      tg.globalCompositeOperation = 'destination-in'
      tg.drawImage(mask, 0, 0)
      g.drawImage(tile, Math.round((t.lon0 - PROJ.lon0) * PX), Math.round((PROJ.lat1 - t.lat1) * PY))
    }
    return c
  })()
  bases.set(region, made)
  made.catch(() => bases.delete(region))
  return made
}

/** 계절 바탕을 일꾼에게 맡긴다 — 메인 스레드는 비트맵을 넘기고 JPEG 를 받기만 한다. 못 하는 브라우저·실패면 null (옛 길로) */
let tintJobs: Worker | null | undefined
let tintJobId = 0
const tintWaits = new Map<number, (b: Blob | null) => void>()
async function buildInWorker(src: HTMLCanvasElement, season: SeasonOfYear): Promise<Blob | null> {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return null
  try {
    if (tintJobs === undefined) {
      tintJobs = new Worker(new URL('./tintworker.ts', import.meta.url), { type: 'module' })
      tintJobs.onmessage = (e: MessageEvent<{ id: number; blob: Blob | null }>): void => { tintWaits.get(e.data.id)?.(e.data.blob); tintWaits.delete(e.data.id) }
      tintJobs.onerror = (): void => { for (const w of tintWaits.values()) w(null); tintWaits.clear(); tintJobs = null }
    }
    const w = tintJobs
    if (w === null) return null
    const bmp = await createImageBitmap(src)
    const id = ++tintJobId
    const done = new Promise<Blob | null>((res) => { tintWaits.set(id, res) })
    w.postMessage({ id, bmp, season, q: JPEG_Q }, [bmp])
    return await done
  } catch { return null }
}
const JPEG_Q = 0.86

async function build(art: string, season: SeasonOfYear, region: RegionId, geo: WorldGeo): Promise<string> {
  const src = await buildBase(art, region, geo)
  const viaWorker = await buildInWorker(src, season)
  if (viaWorker !== null) return URL.createObjectURL(viaWorker)
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const g = c.getContext('2d')!
  g.drawImage(src, 0, 0)
  if (season !== 'spring') {
    const img = g.getImageData(0, 0, c.width, c.height)
    tintPixels(img.data, season)
    g.putImageData(img, 0, 0)
  }
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.86))
  return blob !== null ? URL.createObjectURL(blob) : c.toDataURL('image/jpeg', 0.86)
}

/**
 * 그 계절의 바탕 주소 — 이미 만들었으면 바로, 아니면 '' 를 주고 만들기 시작한다.
 * 다 되면 `.map[data-world]` 들의 바탕을 그 계절 것으로 바꾼다.
 */
export function worldMapUrl(art: string, season: SeasonOfYear, region: RegionId): string {
  const key = `${region}:${season}`
  const hit = urls.get(key)
  if (hit !== undefined) { lastByRegion.set(region, hit); return hit }
  void worldMapReady(art, season, region)
  return ''
}

/** 만드는 중인 바탕 — 같은 판·계절을 두 번 만들지 않게 */
const building = new Map<string, Promise<string>>()

/**
 * 그 계절 바탕이 다 될 때까지 기다린다 — 스플래시·판 가림막이 이걸 기다려야 들어가자마자 지도가 덜 그려져 보이지 않는다
 * (형 11-03: "스플래시 빨리 넘어가면 뭐해 맵이 로딩도 안 되어 있는데"). 넓어지는 지도가 아닌 판이면 곧바로 ''.
 */
export function worldMapReady(art: string, season: SeasonOfYear, region: RegionId): Promise<string> {
  const geo = worldGeoOf(region)
  if (geo === null) return Promise.resolve('')
  const key = `${region}:${season}`
  const hit = urls.get(key)
  if (hit !== undefined) return Promise.resolve(hit)
  let p = building.get(key)
  if (p === undefined) {
    pending.add(key)
    p = build(art, season, region, geo).then((u) => {
      urls.set(key, u)
      lastByRegion.set(region, u)
      pending.delete(key)
      for (const el of document.querySelectorAll<HTMLElement>(`.map[data-region="${region}"][data-world="${season}"]`)) el.style.backgroundImage = `url('${u}')`
      return u
    }).catch(() => { pending.delete(key); building.delete(key); return '' })
    building.set(key, p)
  }
  return p
}
