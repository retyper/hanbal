/**
 * 바닥 종류 그리기: cells(0 평지 · 1 얕은 물 · 2 깊은 물 · 3 막힘 · 4 높은 터)를 맵마다 한 번 작은 캔버스에 칠해 두고 늘려 그린다.
 * 높은 터는 밝게 + 아래·옆 가장자리에 층진 그늘(계단 모양 · 부드러운 그러데이션은 폰에서 깨져 쓰지 않는다)로 「높다」가 읽히게.
 * 물은 가장자리에 옅은 물가 띠. 그리는 쪽 전용 · 맵 배열을 읽기만 한다.
 */
import type { VModel } from './viewRead.ts'

const PX_PER_CELL = 8
const WATER_SHALLOW = 'rgba(78,138,128,0.6)'
const WATER_DEEP = 'rgba(34,84,96,0.86)'
const WATER_EDGE = 'rgba(214,236,226,0.45)'
const SHADE = 'rgba(30,22,10,0.26)'
const HIGH_LIGHT = 'rgba(255,238,190,0.26)'
const HIGH_TOP = 'rgba(255,246,214,0.5)'
const CLIFF = ['rgba(30,22,10,0.5)', 'rgba(30,22,10,0.3)', 'rgba(30,22,10,0.14)'] as const
const SHALLOW = 1, DEEP = 2, BLOCK = 3, HIGH = 4

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

function paint(m: VModel): HTMLCanvasElement {
  const U = m.mapU, W = m.mapW, S = PX_PER_CELL
  const cv = document.createElement('canvas')
  cv.width = U * S; cv.height = W * S
  const c = cv.getContext('2d') as CanvasRenderingContext2D
  const at = (cu: number, cv2: number): number => cu < 0 || cv2 < 0 || cu >= U || cv2 >= W ? -1 : m.cells[cu * W + cv2]!
  for (let cu = 0; cu < U; cu++) for (let v = 0; v < W; v++) {
    const g = m.cells[cu * W + v]!
    if (g === 0) continue
    const x = cu * S, y = v * S
    if (g === SHALLOW || g === DEEP) {
      c.fillStyle = g === DEEP ? WATER_DEEP : WATER_SHALLOW
      c.fillRect(x, y, S, S)
      const wet = (a: number): boolean => a === SHALLOW || a === DEEP
      if (!wet(at(cu, v + 1))) { c.fillStyle = WATER_EDGE; c.fillRect(x, y + S - 2, S, 2) }
      if (!wet(at(cu, v - 1))) { c.fillStyle = WATER_EDGE; c.fillRect(x, y, S, 2) }
      if (!wet(at(cu - 1, v))) { c.fillStyle = WATER_EDGE; c.fillRect(x, y, 2, S) }
      if (!wet(at(cu + 1, v))) { c.fillStyle = WATER_EDGE; c.fillRect(x + S - 2, y, 2, S) }
    } else if (g === BLOCK) {
      // 막힌 칸(목책 밑 · 바위): 검게 메우지 않고 오른쪽 반 칸에 옅은 그늘만 (위에 선 말뚝이 주인공)
      c.fillStyle = SHADE; c.fillRect(x + S / 2, y, S / 2, S)
    } else if (g === HIGH) {
      c.fillStyle = HIGH_LIGHT; c.fillRect(x, y, S, S)
      if (at(cu, v - 1) !== HIGH) { c.fillStyle = HIGH_TOP; c.fillRect(x, y, S, 2) }
    }
  }
  // 높은 터의 그늘: 아래(v+) 가장자리와 앞(u 작은 쪽) 가장자리에 세 겹
  for (let cu = 0; cu < U; cu++) for (let v = 0; v < W; v++) {
    if (m.cells[cu * W + v] === HIGH) continue
    for (let n = 0; n < CLIFF.length; n++) {
      if (at(cu, v - 1 - n) === HIGH && at(cu, v - n) !== HIGH) { c.fillStyle = CLIFF[n]!; c.fillRect(cu * S, v * S, S, S) }
    }
    for (let n = 0; n < CLIFF.length; n++) {
      if (at(cu + 1 + n, v) === HIGH && at(cu + n, v) !== HIGH) { c.fillStyle = CLIFF[n]!; c.fillRect(cu * S, v * S, S, S) }
    }
  }
  return cv
}

/** 맵 바닥 종류를 판 px 크기(worldW × worldH)로 늘려 그린다 */
export function drawTerrain(ctx: CanvasRenderingContext2D, m: VModel, worldW: number, worldH: number): void {
  const sig = signature(m)
  let e = cache.get(m.cells)
  if (e === undefined || e.sig !== sig) { e = { sig, cv: isPlain(m.cells) ? null : paint(m) }; cache.set(m.cells, e) }
  if (e.cv !== null) ctx.drawImage(e.cv, 0, 0, worldW, worldH)
}
