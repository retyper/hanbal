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

/** 판 전체에 철 빛깔 한 겹 (판 px · 바닥 다음 · 병사 앞) */
export function drawSeasonTint(ctx: CanvasRenderingContext2D, s: FieldSeason, w: number, h: number): void {
  const a = tintOf(s)
  if (a <= 0) return
  ctx.globalAlpha = a; ctx.fillStyle = TINT[s]; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1
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
