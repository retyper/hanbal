/**
 * 건물 — 창문의 사수가 서 있는 곳.
 *
 * ★ 형의 반려 두 줄이 이 파일의 존재 이유다.
 *     "건물 1·2·3층으로 쌓으려면 좀 제대로 쌓고"
 *     "적군이 죽었는데 건물은 왜 없어져."
 *
 *   예전엔 **적 하나가 자기 벽을 직접 그렸다.** 그래서 두 가지가 동시에 틀렸다.
 *     ① 적이 죽으면(alive=false) 그리는 사람이 사라지니 건물도 같이 증발했다.
 *        건물은 적의 소지품이 아니라 **거기 서 있는 것**이다.
 *     ② 위아래로 선 적 둘은 각자 땅에서 지붕까지 벽을 그렸다 — 벽 두 장이 포개지고
 *        창턱 높이도 제각각이라 '층'이 아니라 겹친 판때기가 됐다.
 *
 *   그래서 건물을 **장면의 구조물**로 꺼냈다. 판이 시작될 때 창문의 사수들의 자리에서
 *   건물 배치를 한 번 굽고(bake), 그 뒤로는 누가 죽든 말든 그대로 서 있는다.
 *
 * 층과 열을 만드는 규칙 (이게 "제대로 쌓는다"의 정의다):
 *   · 사수가 있는 y가 **층의 기준선**이다. 창은 반드시 층 위에 앉는다.
 *   · 층 사이가 벌어져 있으면 그 사이를 **같은 간격의 빈 층**으로 채운다.
 *   · 맨 아래 층에서 땅까지도 같은 간격으로 층이 계속된다 — 건물은 땅에서 자란다.
 *   · x도 같은 규칙으로 **열(column)** 을 만든다. 창은 열 위에만 뚫린다.
 *   · 가까이 선 사수들은 **한 건물**을 공유한다. 벽이 두 장 겹치는 일은 이제 없다.
 *
 * 결정론(A1): 렌더 전용이고 World를 읽기만 한다. 불 켜진 창은 Math.random이 아니라
 * 좌표 해시로 정한다 — 같은 판은 언제 봐도 같은 건물이다.
 * A5: 배치는 판이 바뀔 때만 다시 굽는다. 프레임마다 배열을 만들지 않는다.
 */
import type { Target, World } from '../sim/types.ts'
import { worldToScreenX, worldToScreenY } from './camera.ts'
import type { Camera } from './camera.ts'

/** 창 하나가 뚫린 자리 (월드 m). 사수의 상반신은 이 사각형 안으로 클립된다. */
export interface WinRect {
  cx: number
  cy: number
  hw: number
  hh: number
}

/**
 * 치수. 전부 **창 크기 대비 비율**이라 과녁 반경이 달라져도 건물의 비례가 유지된다.
 * 창 크기 자체는 과녁 반경 r에서 나온다 (예전 코드와 같은 1.3 / 1.05).
 */
const CELL = {
  hw: 1.3,
  hh: 1.05,
  /** 열 간격 (창 반너비 대비) */
  colPitch: 2.6,
  /** 층 간격 (창 반높이 대비) */
  floorPitch: 2.6,
  /** 층 간격의 하한 — 이보다 좁으면 위아래 창이 서로 붙는다 */
  floorMin: 2.2,
  /** 열 간격의 하한 */
  colMin: 2.2,
  /** 벽이 바깥 열보다 더 나가는 여유 (창 반너비 대비) */
  margin: 1.1,
  /** 지붕이 맨 위 창보다 높은 양 (창 반높이 대비) */
  roof: 2.4,
  /** 맨 아래 창이 땅에서 최소한 떨어져야 하는 높이 (창 반높이 대비) */
  ground: 1.6,
  /** 바깥으로 한 열씩 더 — 창 하나짜리 기둥이 아니라 건물로 보이게 한다 */
  padCols: 1,
  /** 이 거리(열 간격 배수) 안에 있으면 같은 건물이다 */
  groupCols: 3,
} as const

/**
 * 색. 밤 실루엣의 규칙(GDD 8장)을 지킨다 — 벽은 적보다 어둡고, 창 안은 벽보다 더 어둡다.
 * 그래야 창이 '구멍'으로 읽힌다. 형태는 처마·왼쪽 모서리(달빛)가 낸다.
 *
 * 2026-08-31: 하늘을 통째로 올리면서(render/sky.ts) 같은 감마(0.78)로 함께 올렸다.
 * 벽만 두면 하늘이 밝아진 만큼 도시가 검은 종이처럼 납작해진다 — 관계를 유지해야 입체가 산다.
 */
const COL = {
  wall: '#373e4b',
  cornice: '#505a68',
  /** 왼쪽 모서리에 닿는 달빛 */
  edge: '#4f5966',
  /** 층을 가르는 슬래브 선 */
  slab: '#2c3440',
  /** 창 안쪽 어둠 */
  dark: '#1c232e',
  /** 불 꺼진 창 (사수가 없는 칸) */
  empty: '#282f3a',
  /** 드물게 불이 켜진 창 — 사람이 사는 건물이라는 유일한 신호 */
  lit: '#514937',
  frame: '#717b88',
} as const

interface Bldg {
  x0: number
  x1: number
  top: number
  hw: number
  hh: number
  cols: number[]
  floors: number[]
  /** 사수가 든 칸 (ci * 64 + fi). 여긴 빈 창을 그리지 않는다 — 창틀은 사람 위에 얹는다. */
  occ: Set<number>
  seed: number
}

const bldgs: Bldg[] = []
/** 과녁 id → 그 사수의 창. 사수 렌더가 클립 사각형으로 쓴다. */
const wins = new Map<number, WinRect>()
/** 마지막으로 구운 배치의 지문. 이게 바뀔 때만 다시 굽는다. */
let baked = ''

/** 창문의 사수인가 — **죽었어도 참이다.** 건물은 시체가 아니라 자리에서 나온다. */
function isWindowFoe(t: Target): boolean {
  return t.kind === 'archer' && (t.look === 1 || t.look === 2)
}

/** 좌표 해시 → 0..1. Math.random 대신 (A1: 같은 판은 언제 봐도 같은 건물). */
function hash01(a: number, b: number, seed: number): number {
  let h = (a * 374761393 + b * 668265263 + seed * 2246822519) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * 점유된 값들 사이를 같은 간격의 빈 칸으로 채운 격자.
 * 점유 값은 **반드시 그대로 남는다** — 사수가 층과 열 위에 앉는다는 규칙이 여기서 지켜진다.
 */
function grid(occupied: number[], pitch: number): number[] {
  const out: number[] = [occupied[0] as number]
  for (let i = 1; i < occupied.length; i++) {
    const a = occupied[i - 1] as number
    const b = occupied[i] as number
    const gap = b - a
    const n = Math.max(1, Math.round(gap / pitch))
    for (let k = 1; k < n; k++) out.push(a + (gap * k) / n)
    out.push(b)
  }
  return out
}

/** 사수들의 값을 0.05 단위로 뭉쳐 정렬한다. 부동소수 오차로 층이 두 개로 갈라지지 않게. */
function snapUnique(vals: number[]): number[] {
  const s = vals.map((v) => Math.round(v * 20) / 20).sort((p, q) => p - q)
  const out: number[] = []
  for (const v of s) {
    const last = out[out.length - 1]
    if (last === undefined || v - last > 1e-6) out.push(v)
  }
  return out
}

/** 점유 값들의 자연스러운 간격 — 가장 좁은 틈. 하나뿐이면 기본값. */
function pitchOf(vals: number[], fallback: number, min: number, max: number): number {
  let p = Infinity
  for (let i = 1; i < vals.length; i++) p = Math.min(p, (vals[i] as number) - (vals[i - 1] as number))
  if (!isFinite(p)) p = fallback
  return Math.max(min, Math.min(max, p))
}

/** 판이 바뀌었으면 건물을 다시 굽는다. 매 프레임 불러도 지문이 같으면 아무 일도 안 한다. */
function bake(w: World): void {
  let sig = w.stage.id
  const foes: Target[] = []
  for (const t of w.targets) {
    if (t === undefined || !isWindowFoe(t)) continue
    foes.push(t)
    sig += `|${t.x.toFixed(2)},${t.y.toFixed(2)},${t.r.toFixed(2)}`
  }
  if (sig === baked) return
  baked = sig
  bldgs.length = 0
  wins.clear()
  if (foes.length === 0) return

  // ── 무리 짓기 — 가까이 선 사수들은 한 건물을 쓴다 ──
  foes.sort((a, b) => a.x - b.x)
  const groups: Target[][] = []
  let cur: Target[] = [foes[0] as Target]
  for (let i = 1; i < foes.length; i++) {
    const t = foes[i] as Target
    const prev = cur[cur.length - 1] as Target
    const reach = Math.max(t.r, prev.r) * CELL.hw * CELL.colPitch * CELL.groupCols
    if (t.x - prev.x <= reach) cur.push(t)
    else {
      groups.push(cur)
      cur = [t]
    }
  }
  groups.push(cur)

  for (const gp of groups) {
    // 창 크기는 무리에서 가장 큰 사수를 따른다 — 한 건물의 창은 전부 같은 크기여야 한다.
    let r = 0
    for (const t of gp) r = Math.max(r, t.r)
    const hw = r * CELL.hw
    const hh = r * CELL.hh

    const occX = snapUnique(gp.map((t) => t.x))
    const occY = snapUnique(gp.map((t) => t.y))
    const colP = pitchOf(occX, hw * CELL.colPitch, hw * CELL.colMin, hw * CELL.colPitch * 2)
    const flrP = pitchOf(occY, hh * CELL.floorPitch, hh * CELL.floorMin, hh * CELL.floorPitch * 2)

    const cols = grid(occX, colP)
    // 바깥으로 한 열씩 — 창 하나짜리 기둥이 아니라 건물로 보이게.
    for (let k = 0; k < CELL.padCols; k++) {
      cols.unshift((cols[0] as number) - colP)
      cols.push((cols[cols.length - 1] as number) + colP)
    }

    const floors = grid(occY, flrP)
    // 맨 아래 층에서 땅까지 같은 간격으로 계속 — 건물은 땅에서 자란다.
    for (let y = (floors[0] as number) - flrP; y - hh * CELL.ground > 0; y -= flrP) floors.unshift(y)

    const b: Bldg = {
      x0: (cols[0] as number) - hw * CELL.margin,
      x1: (cols[cols.length - 1] as number) + hw * CELL.margin,
      top: (floors[floors.length - 1] as number) + hh * CELL.roof,
      hw,
      hh,
      cols,
      floors,
      occ: new Set<number>(),
      seed: Math.round((gp[0] as Target).x * 100) | 0,
    }

    // 사수를 격자에 앉힌다 — 가장 가까운 열·층. grid()가 점유 값을 보존하므로 오차는 0에 가깝다.
    for (const t of gp) {
      let ci = 0
      let fi = 0
      for (let i = 1; i < cols.length; i++) {
        if (Math.abs((cols[i] as number) - t.x) < Math.abs((cols[ci] as number) - t.x)) ci = i
      }
      for (let i = 1; i < floors.length; i++) {
        if (Math.abs((floors[i] as number) - t.y) < Math.abs((floors[fi] as number) - t.y)) fi = i
      }
      b.occ.add(ci * 64 + fi)
      wins.set(t.id, { cx: cols[ci] as number, cy: floors[fi] as number, hw, hh })
    }
    bldgs.push(b)
  }
}

/**
 * 이 사수의 창. 없으면 null (들판 궁수·드론).
 * 사수 렌더가 이 사각형으로 상반신을 클립한다 — 하반신은 벽 뒤다.
 */
export function windowOf(t: Target): WinRect | null {
  return wins.get(t.id) ?? null
}

/**
 * 벽·층·빈 창 — **과녁보다 먼저.** 여기 그린 것은 적의 생사와 무관하다.
 */
export function drawBuildings(ctx: CanvasRenderingContext2D, cam: Camera, w: World): void {
  bake(w)
  if (bldgs.length === 0) return
  const gy = worldToScreenY(cam, 0)

  for (const b of bldgs) {
    const sx0 = worldToScreenX(cam, b.x0)
    const sx1 = worldToScreenX(cam, b.x1)
    const top = worldToScreenY(cam, b.top)
    if (sx1 < -40 || sx0 > cam.w + 40) continue
    const bw = sx1 - sx0
    const bh = gy - top
    if (bh <= 0 || bw <= 0) continue

    // 벽 — 땅에서 지붕까지. 이게 있어야 창문이 '어딘가에' 있다.
    ctx.fillStyle = COL.wall
    ctx.fillRect(sx0, top, bw, bh)
    // 처마 — 지붕선을 얹는다. 없으면 벽이 하늘로 잘려 나간 것처럼 보인다.
    ctx.fillStyle = COL.cornice
    ctx.fillRect(sx0 - 3, top - 5, bw + 6, 5)
    // 왼쪽 모서리의 달빛 — 면이 두 개여야 입체다.
    ctx.fillStyle = COL.edge
    ctx.fillRect(sx0, top, Math.max(1.5, bw * 0.012), bh)

    const hhPx = b.hh * cam.scale
    const hwPx = b.hw * cam.scale
    if (hwPx < 1.2 || hhPx < 1.2) continue

    // 층을 가르는 슬래브 — 창 사이 중간 높이. "1층 2층"이 이 선으로 읽힌다.
    ctx.fillStyle = COL.slab
    for (let fi = 0; fi < b.floors.length; fi++) {
      const y = worldToScreenY(cam, (b.floors[fi] as number) + b.hh * 1.75)
      if (y < top || y > gy) continue
      ctx.fillRect(sx0, y, bw, Math.max(1, hhPx * 0.1))
    }

    // 창 — 열 × 층. 사수가 든 칸은 비워둔다 (사람과 창틀은 그 위에 얹힌다).
    for (let ci = 0; ci < b.cols.length; ci++) {
      const cx = worldToScreenX(cam, b.cols[ci] as number)
      for (let fi = 0; fi < b.floors.length; fi++) {
        if (b.occ.has(ci * 64 + fi)) continue
        const cy = worldToScreenY(cam, b.floors[fi] as number)
        const lit = hash01(ci, fi, b.seed) < 0.18
        ctx.fillStyle = lit ? COL.lit : COL.empty
        ctx.fillRect(cx - hwPx, cy - hhPx, hwPx * 2, hhPx * 2)
      }
    }

    // 사수의 창 — 실내 어둠. 사람은 이 어둠 속에서 나온다.
    ctx.fillStyle = COL.dark
    for (const key of b.occ) {
      const cx = worldToScreenX(cam, b.cols[(key / 64) | 0] as number)
      const cy = worldToScreenY(cam, b.floors[key % 64] as number)
      ctx.fillRect(cx - hwPx, cy - hhPx, hwPx * 2, hhPx * 2)
    }
  }
}

/**
 * 사수 창의 창틀·창턱 — **사람보다 나중에.** 벽이 하반신을 가린다는 말을 완성한다.
 * 사수가 죽어도 창틀은 남는다. 빈 창이 되는 것뿐이다.
 */
export function drawBuildingFronts(ctx: CanvasRenderingContext2D, cam: Camera): void {
  for (const b of bldgs) {
    const hhPx = b.hh * cam.scale
    const hwPx = b.hw * cam.scale
    if (hwPx < 1.6 || hhPx < 1.6) continue
    for (const key of b.occ) {
      const cx = worldToScreenX(cam, b.cols[(key / 64) | 0] as number)
      const cy = worldToScreenY(cam, b.floors[key % 64] as number)
      if (cx < -60 || cx > cam.w + 60) continue
      ctx.strokeStyle = COL.frame
      ctx.lineWidth = Math.max(2, hwPx * 0.11)
      ctx.strokeRect(cx - hwPx, cy - hhPx, hwPx * 2, hhPx * 2)
      // 창턱 — 창보다 조금 넓게 튀어나온다. 사수가 활을 걸치는 자리다.
      ctx.fillStyle = COL.frame
      ctx.fillRect(cx - hwPx * 1.16, cy + hhPx, hwPx * 2.32, Math.max(3, hhPx * 0.14))
    }
  }
}

/** 판 밖(샌드박스 재구성·판 전환)에서 배치를 강제로 버린다. 테스트·프로브가 쓴다. */
export function invalidateBuildings(): void {
  baked = ''
  bldgs.length = 0
  wins.clear()
}
