/**
 * 지도의 땅 모양 — 휘는 길 · 강 · 고을마다의 땅 (형: "강도 안 뚜렷하고 개활지 같은데 직선 경로만 있는게 이상하지 않냐?" — 2026-10-19)
 *
 * mapview 가 읽는다. 셈은 다 그림을 위한 것이다 — 판(realm)은 그대로 점과 길이다.
 *   길: 영남 판은 tools/yeongnam-routes.ts 가 미리 셈한 물길(ROUTES), 변한 판은 길마다 살짝 휜 한 구비.
 *   강: 영남 판의 실제 강(yeongnam-geo RIVERS)을 또렷하게 덧그린다.
 *   땅: 고을마다 가장 가까운 땅을 나눈 칸(보로노이 — 큰 고을이 조금 넓다)을 둘레로 자르고, 영남 판은 뭍 밖을 잘라 낸다.
 * 땅 모양은 판마다 한 번만 셈해 둔다 (고을 자리는 안 바뀐다) — 계절마다는 색만 바뀐다.
 */
import { ISLES, LAND, RIVERS } from '../../realm/data/regions/yeongnam-geo.ts'
import { FERRIES, ROUTES } from '../../realm/data/regions/yeongnam-routes.ts'
import { YEONGNAM_PROJ, yeongnamPos } from '../../realm/data/regions/yeongnam.ts'
import type { WorldGeo } from '../../realm/data/regions/geoframe.ts'
import { worldGeoOf } from '../../realm/data/regions/index.ts'
import type { REdge, RegionId } from '../../realm/types.ts'

export type Pt = readonly [number, number]

/** 영남 판 그림 좌표(0..1) → 넓어지는 지도의 그림 좌표(0..1) — 영남 고을·길은 넓은 판에 그대로 들어 있다 */
function yToWorld(g: WorldGeo, [x, y]: Pt): Pt {
  const P = YEONGNAM_PROJ
  return g.pos(P.lon0 + x * (P.lon1 - P.lon0), P.lat1 - y * (P.lat1 - P.lat0))
}

/** 판마다 미리 셈한 물길 (그림 좌표 0..1) — 넓은 판은 영남 길만 있다. 마한·북녘 쪽 길은 아직 한 구비 */
function viaOf(region: RegionId, id: string): readonly Pt[] | undefined {
  if (region === 'yeongnam') return ROUTES[id]
  const g = worldGeoOf(region)
  if (g !== null) return ROUTES[id]?.map((p) => yToWorld(g, p))
  return undefined
}

/** 길 위의 점들 (그림 좌표, a → b) — 영남 판은 미리 셈한 물길, 아니면 한 구비 휜 길 */
export function routePoints(region: RegionId, ed: REdge, a: Pt, b: Pt, W: number, H: number): Pt[] {
  const via = viaOf(region, ed.id)
  if (via !== undefined) return [a, ...via.map(([x, y]) => [x * W, y * H] as const), b]
  // 변한 판 — 길 id 로 정한 쪽으로 살짝 휜다 (뱃길은 더 크게, 바닷가를 도는 것처럼)
  let h = 0
  for (const ch of ed.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const side = h % 2 === 0 ? 1 : -1
  const bend = (ed.kind === 'sea' ? 0.16 : 0.07) * side * (0.6 + ((h >> 3) % 5) / 10)
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  return [a, [(a[0] + b[0]) / 2 - dy * bend, (a[1] + b[1]) / 2 + dx * bend], b]
}

/** 나루의 배 자리 (그림 좌표) — 영남 판의 나루 길만 */
export function ferryAt(region: RegionId, ed: REdge, W: number, H: number): Pt | null {
  const g = worldGeoOf(region)
  const f0 = region === 'yeongnam' || g !== null ? FERRIES[ed.id] : undefined
  const f = f0 !== undefined && g !== null ? yToWorld(g, f0) : f0
  return f !== undefined ? [f[0] * W, f[1] * H] : null
}

const f1 = (v: number): string => v.toFixed(1)

/** 점들을 매끈한 곡선으로 (캣멀-롬 → 3차 베지에) */
export function smoothPath(p: readonly Pt[]): string {
  if (p.length < 2) return ''
  let d = `M${f1(p[0]![0])} ${f1(p[0]![1])}`
  if (p.length === 2) return `${d}L${f1(p[1]![0])} ${f1(p[1]![1])}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)]!
    const p1 = p[i]!
    const p2 = p[i + 1]!
    const p3 = p[Math.min(p.length - 1, i + 2)]!
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`
  }
  return d
}

/** 꺾은선의 길이 몫 t0..t1 만 (화살이 고을 기호에 안 묻히게 끝을 당긴다) */
export function trimPolyline(p: readonly Pt[], t0: number, t1: number): Pt[] {
  const seg: number[] = []
  let total = 0
  for (let i = 1; i < p.length; i++) {
    const l = Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1])
    seg.push(l)
    total += l
  }
  const at = (t: number): { i: number; q: Pt } => {
    let d = t * total
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i]! || i === seg.length - 1) {
        const k = seg[i]! > 0 ? Math.min(1, d / seg[i]!) : 0
        return { i, q: [p[i]![0] + (p[i + 1]![0] - p[i]![0]) * k, p[i]![1] + (p[i + 1]![1] - p[i]![1]) * k] }
      }
      d -= seg[i]!
    }
    return { i: 0, q: p[0]! }
  }
  const s = at(t0)
  const e = at(t1)
  return [s.q, ...p.slice(s.i + 1, e.i + 1), e.q]
}

/** 꺾은선의 가운데 점 */
export const midOf = (p: readonly Pt[]): Pt => trimPolyline(p, 0.5, 0.5)[0]!

// ───────── 강 (영남 판)

/** 강을 또렷하게 — 굵기는 밑그림의 굵기를 그림 너비에 맞춘다 (낙동강이 가장 굵다) */
export function riversSvg(region: RegionId, W: number, H: number): string {
  const g = worldGeoOf(region)
  if (region !== 'yeongnam' && g === null) return ''
  // 넓은 판은 고을 기호가 작다 — 강도 가늘게 (2026-10-19 화면으로 맞춤)
  const k = g !== null ? (W / 1536) * 0.55 : W / 1536
  let s = '<g class="rivers" fill="none" stroke-linecap="round" stroke-linejoin="round">'
  for (const r of g !== null ? g.rivers : RIVERS) {
    const pts = r.pts.map(([lon, lat]) => {
      const [x, y] = g !== null ? g.pos(lon, lat) : yeongnamPos(lon, lat)
      return [x * W, y * H] as const
    })
    const d = smoothPath(pts)
    s += `<path d="${d}" stroke="#f3e6c8" stroke-width="${f1(r.w * k + 3)}" opacity=".55"/>`
    s += `<path d="${d}" stroke="#3d78b0" stroke-width="${f1(r.w * k)}" opacity=".85"><title>${r.name}</title></path>`
  }
  return s + '</g>'
}

// ───────── 고을마다의 땅

/** 땅 한 조각 — 꼭짓점과, 각 변 너머의 이웃 고을(없으면 -1 = 둘레) */
export interface Cell { readonly pts: Pt[]; readonly nb: number[] }

/** 볼록 다각형을 반평면 a·x ≤ c 로 자른다 — 새로 생긴 변은 이웃 `tag` 쪽 */
function clip(cell: Cell, ax: number, ay: number, c: number, tag: number): Cell {
  const { pts, nb } = cell
  const out: Pt[] = []
  const onb: number[] = []
  const inside = (p: Pt): boolean => ax * p[0] + ay * p[1] <= c
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    const pin = inside(p)
    const qin = inside(q)
    const cross = (): Pt => {
      const dp = ax * p[0] + ay * p[1] - c
      const dq = ax * q[0] + ay * q[1] - c
      const t = dp / (dp - dq)
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
    }
    if (pin) {
      out.push(p)
      if (qin) onb.push(nb[i]!)
      else {
        onb.push(nb[i]!)
        out.push(cross())
        onb.push(tag) // 나간 자리부터 들어올 자리까지는 새 변
      }
    } else if (qin) {
      out.push(cross())
      onb.push(nb[i]!)
    }
  }
  return { pts: out, nb: onb }
}

const cellCache = new Map<string, Cell[]>()

/**
 * 고을마다의 땅 — 거듭제곱 보로노이(큰 고을이 조금 넓다)를 둘레 반지름 `R` 의 다각형으로 자른 조각.
 * `pts` 는 고을 자리(그림 좌표), `size` 는 크기 배수. 판마다 한 번만 셈한다 (`key`).
 */
export function provinceCells(key: string, pts: readonly Pt[], size: readonly number[], R: number): Cell[] {
  const hit = cellCache.get(key)
  if (hit !== undefined) return hit
  const SIDES = 20
  const cells = pts.map((p, i) => {
    const r = R * (0.85 + 0.25 * (size[i] ?? 1))
    let cell: Cell = {
      pts: Array.from({ length: SIDES }, (_, k) => [p[0] + r * Math.cos((2 * Math.PI * k) / SIDES), p[1] + r * Math.sin((2 * Math.PI * k) / SIDES)] as const),
      nb: Array.from({ length: SIDES }, () => -1),
    }
    const wi = (R * 0.22 * (size[i] ?? 1)) ** 2
    for (let j = 0; j < pts.length && cell.pts.length > 0; j++) {
      if (j === i) continue
      const q = pts[j]!
      const wj = (R * 0.22 * (size[j] ?? 1)) ** 2
      // |x−p|² − wi ≤ |x−q|² − wj  ⇔  2x·(q−p) ≤ |q|² − |p|² − wj + wi
      cell = clip(cell, 2 * (q[0] - p[0]), 2 * (q[1] - p[1]), q[0] ** 2 + q[1] ** 2 - p[0] ** 2 - p[1] ** 2 - wj + wi, j)
    }
    return cell
  })
  cellCache.set(key, cells)
  return cells
}

/** 영남 판의 뭍 (땅빛을 뭍 안에 가둔다) — SVG clipPath 안에 넣을 다각형들 */
export function landClipSvg(region: RegionId, W: number, H: number): string {
  const g = worldGeoOf(region)
  if (region !== 'yeongnam' && g === null) return ''
  const pos = g !== null ? g.pos : yeongnamPos
  const poly = (ll: readonly Pt[]): string => `<polygon points="${ll.map(([lon, lat]) => {
    const [x, y] = pos(lon, lat)
    return `${f1(x * W)},${f1(y * H)}`
  }).join(' ')}"/>`
  if (g !== null) return `<clipPath id="rm-land">${g.lands.map(poly).join('')}${g.isles.map(poly).join('')}</clipPath>`
  return `<clipPath id="rm-land">${poly(LAND)}${ISLES.map(poly).join('')}</clipPath>`
}

export const polyPath = (p: readonly Pt[]): string => (p.length === 0 ? '' : `M${p.map((q) => `${f1(q[0])} ${f1(q[1])}`).join('L')}Z`)
