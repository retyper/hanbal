/**
 * 바닥 종류 그리기: cells(0 평지 · 1 얕은 물 · 2 깊은 물 · 3 막힘 · 4 높은 터 · 5 숲)를 맵마다 한 번 작은 캔버스에 칠해 두고 늘려 그린다.
 * 높은 터는 밝게 + 아래·옆 가장자리에 층진 그늘(계단 모양 · 부드러운 그러데이션은 폰에서 깨져 쓰지 않는다)로 「높다」가 읽히게.
 * 물은 가장자리에 옅은 물가 띠. 그리는 쪽 전용 · 맵 배열을 읽기만 한다.
 */
import type { VModel } from './viewRead.ts'

const PX_PER_CELL = 8
const WATER_SHALLOW = 'rgba(78,138,128,0.6)'
const WATER_DEEP = 'rgba(34,84,96,0.86)'
/** 여름 장마의 불어난 흙탕물 */
const WATER_FLOOD = 'rgba(124,98,60,0.88)'
const WATER_EDGE = 'rgba(214,236,226,0.45)'
const SHADE = 'rgba(30,22,10,0.26)'
const HIGH_LIGHT = 'rgba(255,238,190,0.4)'
const HIGH_TOP = 'rgba(255,246,214,0.6)'
const HIGH_LIGHT_LOW = 'rgba(255,238,190,0.16)'
/** 낮은 언덕의 그늘 (들판 섞임 · 흐리기 전) */
const CLIFF_LOW = ['rgba(30,22,10,0.34)', 'rgba(30,22,10,0.2)', 'rgba(30,22,10,0.1)', 'rgba(30,22,10,0.04)'] as const
const CLIFF = ['rgba(30,22,10,0.6)', 'rgba(30,22,10,0.4)', 'rgba(30,22,10,0.22)', 'rgba(30,22,10,0.1)'] as const
/** 높은 터의 등고선 — 가장자리에서 안쪽으로 이 칸 수마다 가는 줄 (0 = 가장자리 · 밝은 줄과 어두운 줄을 겹쳐 「턱」이 읽히게) */
const CONTOURS = [0, 3, 7, 12] as const
const EDGE_DARK = 'rgba(40,28,12,0.75)', EDGE_LIT = 'rgba(255,248,220,0.85)', CONTOUR = 'rgba(70,52,24,0.45)'
const SHALLOW = 1, DEEP = 2, BLOCK = 3, HIGH = 4, WOOD = 5, MUD = 6, ICE = 7
/** 봄 개울가 진흙 · 겨울 언 개울 */
const MUD_FILL = 'rgba(92,64,34,0.5)', ICE_FILL = 'rgba(214,232,242,0.85)', ICE_EDGE = 'rgba(255,255,255,0.7)'
/** 숲 칸: 짙은 풀빛 그늘 (나무 소품이 그 위에 선다) */
const WOOD_FILL = 'rgba(46,70,30,0.42)'

/** 칸 배열마다 한 번 칠해 둔다. 칸 내용이나 부서진 조각이 바뀌면(목책이 깨지면) 서명이 달라져 다시 칠한다 */
const cache = new WeakMap<Readonly<Uint8Array>, { sig: string; cv: HTMLCanvasElement | null }>()
function signature(m: VModel): string {
  let sum = 0
  for (let i = 0; i < m.cells.length; i++) sum = (sum * 31 + m.cells[i]! + 1) % 1000003
  return sum + ':' + m.pieces.map(p => (p.hp > 0 ? 1 : 0)).join('')
}

/** 평지뿐인 맵인가 (칠할 것이 없다) */
export function isPlain(cells: Readonly<Uint8Array>): boolean {
  for (let i = 0; i < cells.length; i++) if (cells[i] !== 0) return false
  return true
}

function paint(m: VModel, soft = false): HTMLCanvasElement {
  const U = m.mapU, W = m.mapW, S = PX_PER_CELL
  const cv = document.createElement('canvas')
  cv.width = U * S; cv.height = W * S
  const c = cv.getContext('2d') as CanvasRenderingContext2D
  // 들판(섞임)은 언덕을 칸이 아니라 모양(hills)으로 따로 그린다 (hillLayer) — 여기서는 높은 터 칸을 평지로 친다
  const cells = soft && m.hills.length > 0 ? m.cells.map(g => g === HIGH ? 0 : g) : m.cells
  const at = (cu: number, cv2: number): number => cu < 0 || cv2 < 0 || cu >= U || cv2 >= W ? -1 : cells[cu * W + cv2]!
  for (let cu = 0; cu < U; cu++) for (let v = 0; v < W; v++) {
    const g = cells[cu * W + v]!
    if (g === 0) continue
    const x = cu * S, y = v * S
    if (g === SHALLOW || g === DEEP) {
      c.fillStyle = g === DEEP ? WATER_DEEP : m.season === 'summer' ? WATER_FLOOD : WATER_SHALLOW
      c.fillRect(x, y, S, S)
      const wet = (a: number): boolean => a === SHALLOW || a === DEEP
      if (!wet(at(cu, v + 1))) { c.fillStyle = WATER_EDGE; c.fillRect(x, y + S - 2, S, 2) }
      if (!wet(at(cu, v - 1))) { c.fillStyle = WATER_EDGE; c.fillRect(x, y, S, 2) }
      if (!wet(at(cu - 1, v))) { c.fillStyle = WATER_EDGE; c.fillRect(x, y, 2, S) }
      if (!wet(at(cu + 1, v))) { c.fillStyle = WATER_EDGE; c.fillRect(x + S - 2, y, 2, S) }
    } else if (g === BLOCK) {
      // 막힌 칸(목책 밑 · 바위): 검게 메우지 않고 오른쪽 반 칸에 옅은 그늘만 (위에 선 말뚝이 주인공)
      c.fillStyle = SHADE; c.fillRect(x + S / 2, y, S / 2, S)
    } else if (g === MUD) {
      c.fillStyle = MUD_FILL; c.fillRect(x, y, S, S)
    } else if (g === ICE) {
      c.fillStyle = ICE_FILL; c.fillRect(x, y, S, S)
      if (at(cu - 1, v) !== ICE) { c.fillStyle = ICE_EDGE; c.fillRect(x, y, 2, S) }
      if (at(cu + 1, v) !== ICE) { c.fillStyle = ICE_EDGE; c.fillRect(x + S - 2, y, 2, S) }
    } else if (g === WOOD) {
      c.fillStyle = WOOD_FILL; c.fillRect(x, y, S, S)
    } else if (g === HIGH) {
      // 들판(섞임)의 낮은 언덕은 옅게 (흐린 뒤 안개처럼 하얗게 뜨지 않게)
      c.fillStyle = soft ? HIGH_LIGHT_LOW : HIGH_LIGHT; c.fillRect(x, y, S, S)
      if (at(cu, v - 1) !== HIGH && !soft) { c.fillStyle = HIGH_TOP; c.fillRect(x, y, S, 2) }
    }
  }
  // 높은 터의 그늘: 아래(v+) 가장자리와 앞(u 작은 쪽) 가장자리에 세 겹
  for (let cu = 0; cu < U; cu++) for (let v = 0; v < W; v++) {
    if (cells[cu * W + v] === HIGH) continue
    for (let n = 0; n < CLIFF.length; n++) {
      if (at(cu, v - 1 - n) === HIGH && at(cu, v - n) !== HIGH) { c.fillStyle = (soft ? CLIFF_LOW : CLIFF)[n]!; c.fillRect(cu * S, v * S, S, S) }
    }
    for (let n = 0; n < CLIFF.length; n++) {
      if (at(cu + 1 + n, v) === HIGH && at(cu + n, v) !== HIGH) { c.fillStyle = (soft ? CLIFF_LOW : CLIFF)[n]!; c.fillRect(cu * S, v * S, S, S) }
    }
  }
  // 높은 터의 등고선: 가장자리(옆이 낮은 칸)에서 안쪽으로 CONTOURS 칸째마다 그 가장자리를 따라 가는 줄
  const depth = (cu: number, v: number, du: number, dv: number): number => { let n = 0; while (at(cu - du * (n + 1), v - dv * (n + 1)) === HIGH) n++; return at(cu - du * (n + 1), v - dv * (n + 1)) === -1 ? -1 : n }
  for (let cu = 0; cu < U; cu++) for (let v = 0; v < W; v++) {
    if (cells[cu * W + v] !== HIGH) continue
    const x = cu * S, y = v * S
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const d = depth(cu, v, du, dv)
      if (d < 0 || !(CONTOURS as readonly number[]).includes(d)) continue
      const line = (col: string, off: number, w: number): void => {
        c.fillStyle = col
        if (du === 1) c.fillRect(x + off, y, w, S); else if (du === -1) c.fillRect(x + S - off - w, y, w, S)
        else if (dv === 1) c.fillRect(x, y + off, S, w); else c.fillRect(x, y + S - off - w, S, w)
      }
      if (d === 0) { line(EDGE_DARK, 0, 2); line(EDGE_LIT, 2, 1) } else line(CONTOUR, 0, 1)
    }
  }
  return cv
}

/** 맵 바닥 종류를 판 px 크기(worldW × worldH)로 늘려 그린다 */
export function drawTerrain(ctx: CanvasRenderingContext2D, m: VModel, worldW: number, worldH: number): void {
  const sig = signature(m)
  let e = cache.get(m.cells)
  if (e === undefined || e.sig !== sig) { e = { sig, cv: isPlain(m.cells) ? null : m.deco.length > 0 ? floodLayer(hillLayer(soften(paint(m, true)), m), m) : paint(m) }; cache.set(m.cells, e) }
  if (e.cv !== null) ctx.drawImage(e.cv, 0, 0, worldW, worldH)
}

/**
 * 들판(섞임)의 바닥은 비스듬한 개울·둥근 언덕·숲이라 칸 계단이 그대로 보인다 — 칠해 둔 작은 캔버스를 한 번 흐려 가장자리를 둥글린다
 * (맵마다 한 번 · 움직이는 필터가 아니다 · filter 를 모르는 브라우저는 계단 그대로)
 */
const SOFT_PX = 3
function soften(src: HTMLCanvasElement): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = src.width; cv.height = src.height
  const c = cv.getContext('2d') as CanvasRenderingContext2D
  c.filter = `blur(${SOFT_PX}px)`
  c.drawImage(src, 0, 0)
  c.filter = 'none'
  return cv
}

/**
 * 언덕을 모양으로 (들판 섞임) — 해가 왼쪽 위에서: 오른쪽 아래로 드리운 그림자 · 오른쪽 아래 비탈의 그늘 띠 · 왼쪽 위 비탈의 빛 ·
 * 꼭대기 쪽으로 옅은 등고선 셋 · 둘레 테. 타원 몇 개의 합이라 둘레가 매끈하다(칸 계단 없음). 맵마다 한 번 굽는다.
 * 빛·그늘은 한 번 흐려 부드럽게 (움직이는 필터가 아니다)
 */
const HILL_CAST = 'rgba(40,30,12,0.34)', HILL_BODY = 'rgba(92,116,48,0.30)', HILL_DARK = 'rgba(34,26,10,0.42)', HILL_LIT = 'rgba(255,240,196,0.42)'
const HILL_RING = 'rgba(70,52,22,0.42)', HILL_RING_LIT = 'rgba(255,246,214,0.38)', HILL_RIM = 'rgba(48,34,14,0.55)'
/** 등고선 (몸 반지름에 대한 몫) */
const HILL_RINGS = [0.74, 0.5, 0.27] as const
const HILL_SOFT_PX = 6
function hillLayer(base: HTMLCanvasElement, m: VModel): HTMLCanvasElement {
  if (m.hills.length === 0) return base
  const S = PX_PER_CELL, W = base.width, H = base.height
  const c = base.getContext('2d') as CanvasRenderingContext2D
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H
  const t = tmp.getContext('2d') as CanvasRenderingContext2D
  type Lobe = { u: number; v: number; ru: number; rv: number }
  /** 타원 합의 길 (k 몫으로 줄이고 · du·dv 몫만큼 옮긴다 · 칸 → px) */
  const lobes = (ls: readonly Lobe[], k: number, du: number, dv: number): void => {
    t.beginPath()
    for (const l of ls) { const x = (l.u + du * l.ru) * S, y = (l.v + dv * l.rv) * S, rx = l.ru * k * S, ry = l.rv * k * S; t.moveTo(x + rx, y); t.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2) }
  }
  /** 몸에서 옮긴 몸을 뺀 초승달 (같은 색 한 덩이) */
  const crescent = (ls: readonly Lobe[], color: string, du: number, dv: number): void => {
    t.globalCompositeOperation = 'source-over'; lobes(ls, 1, 0, 0); t.fillStyle = color; t.fill()
    t.globalCompositeOperation = 'destination-out'; lobes(ls, 1.04, du, dv); t.fillStyle = '#000'; t.fill()
    t.globalCompositeOperation = 'source-over'
  }
  const put = (blur: number): void => { c.filter = blur > 0 ? `blur(${blur}px)` : 'none'; c.drawImage(tmp, 0, 0); c.filter = 'none'; t.clearRect(0, 0, W, H) }
  for (const h of m.hills) {
    // 드리운 그림자 (오른쪽 아래)
    lobes(h.lobes, 1, 0.1, 0.16); t.fillStyle = HILL_CAST; t.fill(); put(HILL_SOFT_PX)
    // 몸: 들보다 조금 짙은 풀빛
    lobes(h.lobes, 1, 0, 0); t.fillStyle = HILL_BODY; t.fill(); put(2)
    // 오른쪽 아래 비탈 그늘 · 왼쪽 위 비탈 빛
    crescent(h.lobes, HILL_DARK, -0.2, -0.26); put(HILL_SOFT_PX)
    crescent(h.lobes, HILL_LIT, 0.22, 0.28); put(HILL_SOFT_PX)
    // 등고선: 꼭대기 쪽(왼쪽 위로 조금 치우쳐)으로 줄어드는 고리 · 겹친 타원 안쪽 호는 다른 타원으로 지운다
    for (const [i, k] of HILL_RINGS.entries()) {
      const du = -0.05 * (i + 1), dv = -0.07 * (i + 1)
      // 바깥 고리만 둔덕까지 감싸고 · 꼭대기 쪽 고리는 큰 몸 하나로 (작은 둔덕마다 과녁처럼 고리가 따로 서지 않게)
      const ls = i === 0 ? h.lobes : h.lobes.slice(0, 1)
      t.lineWidth = 1.6
      lobes(ls, k, du, dv); t.strokeStyle = HILL_RING; t.stroke()
      t.globalCompositeOperation = 'destination-out'; lobes(ls, k - 0.03, du, dv); t.fillStyle = '#000'; t.fill(); t.globalCompositeOperation = 'source-over'
      // 고리 바로 위(왼쪽 위)에 밝은 줄 한 겹 — 턱이 읽히게
      lobes(ls, k, du - 0.012, dv - 0.018); t.strokeStyle = HILL_RING_LIT; t.lineWidth = 1; t.stroke()
      t.globalCompositeOperation = 'destination-out'; lobes(ls, k - 0.03, du - 0.012, dv - 0.018); t.fill(); t.globalCompositeOperation = 'source-over'
      put(0.6)
    }
    // 둘레 테
    t.lineWidth = 2; lobes(h.lobes, 1, 0, 0); t.strokeStyle = HILL_RIM; t.stroke()
    t.globalCompositeOperation = 'destination-out'; lobes(h.lobes, 0.985, 0, 0); t.fill(); t.globalCompositeOperation = 'source-over'
    put(1)
  }
  return base
}

/**
 * 여름 장마의 여울 거품 (흐린 뒤에 얹어 또렷하게) — 물 칸의 위나 아래가 땅이고 그런 물 칸이 가로로 넷 넘게 이어진 곳(여울 가장자리 ·
 * 비스듬한 개울의 칸 계단은 한두 칸이라 빠진다)에 흰 거품 점. 흐르는 물결은 viewSeason drawFlood 가 매 장 움직여 그린다. 맵마다 한 번 굽는다
 */
const FLOOD_FOAM = 'rgba(255,252,240,0.9)'
function floodLayer(base: HTMLCanvasElement, m: VModel): HTMLCanvasElement {
  if (m.season !== 'summer') return base
  const S = PX_PER_CELL, U = m.mapU, W = m.mapW
  const c = base.getContext('2d') as CanvasRenderingContext2D
  const at = (cu: number, v: number): number => cu < 0 || v < 0 || cu >= U || v >= W ? -1 : m.cells[cu * W + v]!
  const edge = (cu: number, v: number, dv: number): boolean => at(cu, v) === SHALLOW && at(cu, v + dv) !== SHALLOW && at(cu, v + dv) !== -1
  const hsh = (a: number, b: number): number => { let x = Math.imul(a * 73856093 ^ b * 19349663, 0x45d9f3b); x ^= x >>> 15; return (x >>> 0) % 997 }
  c.fillStyle = FLOOD_FOAM
  c.beginPath()
  for (let v = 0; v < W; v++) for (const dv of [-1, 1]) {
    for (let cu = 0; cu < U; cu++) {
      if (!edge(cu, v, dv)) continue
      let n = 0
      while (edge(cu + n, v, dv)) n++
      if (n >= 4) for (let k = cu; k < cu + n; k++) {
        const y = dv < 0 ? v * S + 1.5 : v * S + S - 1.5
        for (let j = 0; j < 4; j++) { const x = k * S + 1 + j * 2 + (hsh(k * 4 + j, v) % 2), r = 0.9 + (hsh(j, k + v) % 3) * 0.4; c.moveTo(x + r, y + (hsh(k, j) % 3) - 1); c.arc(x, y + (hsh(k, j) % 3) - 1, r, 0, Math.PI * 2) }
      }
      cu += n
    }
  }
  c.fill()
  return base
}
