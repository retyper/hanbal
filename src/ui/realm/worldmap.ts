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

/** 조각 눈금 — 1024px 이 경도 2.9°, 765px 이 위도 2.0° (판의 scale 배로 잇는다) */
const PX0 = 1024 / 2.9
const PY0 = 765 / 2.0

/** 열쇠 `판:계절` */
const urls = new Map<string, string>()
const bases = new Map<RegionId, Promise<HTMLCanvasElement>>()
const pending = new Set<string>()

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
      tg.drawImage(im, 0, 0, tw, th)
      // 겹친 띠 — 바깥 끝은 비치고 안쪽으로 갈수록 이 조각이 덮는다
      const mask = document.createElement('canvas')
      mask.width = tw
      mask.height = th
      const mg = mask.getContext('2d')!
      mg.fillStyle = '#000'
      mg.fillRect(0, 0, tw, th)
      mg.globalCompositeOperation = 'destination-in'
      const fade = (x0: number, y0: number, x1: number, y1: number): void => {
        const gr = mg.createLinearGradient(x0, y0, x1, y1)
        gr.addColorStop(0, 'rgba(0,0,0,0)')
        gr.addColorStop(1, '#000')
        mg.fillStyle = gr
        mg.fillRect(0, 0, tw, th)
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

async function build(art: string, season: SeasonOfYear, region: RegionId, geo: WorldGeo): Promise<string> {
  const src = await buildBase(art, region, geo)
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const g = c.getContext('2d')!
  g.drawImage(src, 0, 0)
  if (season !== 'spring') {
    const img = g.getImageData(0, 0, c.width, c.height)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const [r, gg, b] = seasonTint(season, d[i]!, d[i + 1]!, d[i + 2]!)
      d[i] = r
      d[i + 1] = gg
      d[i + 2] = b
    }
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
  const geo = worldGeoOf(region)
  if (geo === null) return ''
  const key = `${region}:${season}`
  const hit = urls.get(key)
  if (hit !== undefined) return hit
  if (!pending.has(key)) {
    pending.add(key)
    void build(art, season, region, geo).then((u) => {
      urls.set(key, u)
      pending.delete(key)
      for (const el of document.querySelectorAll<HTMLElement>(`.map[data-region="${region}"][data-world="${season}"]`)) el.style.backgroundImage = `url('${u}')`
    }).catch(() => pending.delete(key))
  }
  return ''
}
