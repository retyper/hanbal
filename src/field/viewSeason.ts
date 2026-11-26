/**
 * 시험판의 철 그리기 (그리는 쪽 전용 · 판을 읽기만 한다) — 바닥 빛깔 한 겹과 장마 빗줄기.
 * 봄 풀빛 · 여름 장마 젖은 잿빛 · 가을 금빛 · 겨울 눈빛. 빛깔 한 겹은 판 크기 사각 하나(필터·그러데이션 없음).
 * 빗줄기는 짧은 선 mvpRainDrops 개를 한 경로로 (낮은 사양은 반) — 자리는 시계와 번호로 정해 매 장 새로 만들지 않는다.
 */
import { P } from '../tune/params.ts'
import type { VModel } from './viewRead.ts'

/** 철 (그리는 쪽은 판 정의를 들이지 않고 VModel 에서 받는다) */
type FieldSeason = NonNullable<VModel['season']>

const TINT: Readonly<Record<FieldSeason, string>> = { spring: '#7fbf4a', summer: '#3c4a55', autumn: '#e0a640', winter: '#f4f7fb' }
const RAIN_COLOR = '#d7e6f0'
/** 빗줄기 기울기 (아래로 1 갈 때 옆으로) · 한 줄 길이(화면 px) · 떨어지는 빠르기(화면 px/초) */
const RAIN_SLANT = 0.28, RAIN_LEN = 14, RAIN_SPEED = 900

function tintOf(s: FieldSeason): number {
  const F = P.field
  return (s === 'spring' ? F.mvpTintSpringPermille : s === 'summer' ? F.mvpTintSummerPermille : s === 'autumn' ? F.mvpTintAutumnPermille : F.mvpTintWinterPermille) / 1000
}

/** 보이는 땅 전체(판 밖 여백까지 · 판 px 사각)에 철 빛깔 한 겹 (바닥 다음 · 병사 앞) */
export function drawSeasonTint(ctx: CanvasRenderingContext2D, s: FieldSeason, view: { left: number; top: number; right: number; bottom: number }): void {
  const a = tintOf(s)
  if (a <= 0) return
  ctx.globalAlpha = a; ctx.fillStyle = TINT[s]; ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top); ctx.globalAlpha = 1
}

/** 수(0 이상의 정수) → 0~1 (같은 수면 같은 값) */
function hash01(n: number): number {
  let x = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

/** 장마 빗줄기 — 보이는 판(판 px 사각) 위로 짧은 사선 (화면 크기를 배율로 나눠 판 px 로) */
export function drawWeather(ctx: CanvasRenderingContext2D, view: { left: number; top: number; right: number; bottom: number }, nowMs: number, zoom: number, low: boolean): void {
  const n = Math.round(P.field.mvpRainDrops * (low ? 0.5 : 1))
  if (n <= 0) return
  const w = view.right - view.left, h = view.bottom - view.top
  const len = RAIN_LEN / zoom, fall = RAIN_SPEED / zoom * nowMs / 1000
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const x0 = hash01(i * 2 + 1) * w, off = hash01(i * 2 + 2) * h
    const y = (off + fall * (0.8 + 0.4 * hash01(i + 977))) % h
    const x = (x0 - y * RAIN_SLANT + w * 4) % w
    ctx.moveTo(view.left + x, view.top + y); ctx.lineTo(view.left + x - len * RAIN_SLANT, view.top + y + len)
  }
  ctx.strokeStyle = RAIN_COLOR; ctx.globalAlpha = 0.45; ctx.lineWidth = Math.max(1, 1.2 / zoom); ctx.stroke(); ctx.globalAlpha = 1
}

const FLOW_COLOR = '#c8d4d4'
/**
 * 장마의 불어난 개울 물결 — 보이는 물 칸(얕은 물)마다 몇에 짧은 밝은 줄이 흐르는 쪽(폭 방향 = 개울 줄기)으로 미끄러진다 ·
 * 칸 수가 화면에 보이는 만큼만이라 싸다 (한 경로)
 */
export function drawFlood(ctx: CanvasRenderingContext2D, m: VModel, view: { left: number; top: number; right: number; bottom: number }, nowMs: number, zoom: number): void {
  const F = P.field, cp = F.cellPx, U = m.mapU, W = m.mapW
  const u0 = Math.max(0, Math.floor(view.left / cp)), u1 = Math.min(U - 1, Math.ceil(view.right / cp))
  const v0 = Math.max(0, Math.floor(view.top / cp)), v1 = Math.min(W - 1, Math.ceil(view.bottom / cp))
  const run = nowMs / 1000 * F.mvpFlowCellsPerSec / 3, len = cp * 3 // 길게(세 칸) · 성기게(물 칸의 열에 하나) · 옅게
  // 줄마다 물 줄기의 왼쪽 끝(보이는 폭 안 첫 물 칸) → 위아래 세 줄 차이로 기울기 (물결이 개울을 따라 비스듬히 흐르게)
  const first: number[] = []
  for (let v = v0 - 3; v <= v1 + 3; v++) { let f = -1; if (v >= 0 && v < W) for (let cu = Math.max(0, u0 - 8); cu <= Math.min(U - 1, u1 + 8); cu++) if (m.cells[cu * W + v] === 1) { f = cu; break } first.push(f) }
  const slopeAt = (v: number): number => { const a = first[v - v0], b = first[v - v0 + 6]; return a !== undefined && b !== undefined && a >= 0 && b >= 0 ? (b - a) / 6 : 0 }
  ctx.beginPath()
  for (let cu = u0; cu <= u1; cu++) for (let v = v0; v <= v1; v++) {
    if (m.cells[cu * W + v] !== 1) continue
    const h = hash01(cu * 4099 + v * 131)
    if (h > 0.1) continue
    const k = slopeAt(v), t = (run + h * 70) % 1, x = (cu + 0.15 + 0.7 * hash01(cu * 31 + v * 7) + k * t * 3) * cp, y = (v + t * 3) * cp
    ctx.moveTo(x, y); ctx.lineTo(x + k * len, y + len)
  }
  ctx.strokeStyle = FLOW_COLOR; ctx.globalAlpha = 0.32; ctx.lineWidth = Math.max(1.2, 2 / zoom); ctx.lineCap = 'round'; ctx.stroke(); ctx.globalAlpha = 1
}
