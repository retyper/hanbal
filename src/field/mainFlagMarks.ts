/**
 * 맵 위 깃발 표시 — 꽂은 자리의 깃발 · 고른 무리에서 그 자리까지 점선 · 끌기 화살표 · 길게 누름 고리 (F5a)
 * 그리는 쪽 전용: 넘겨 받은 값만 읽고 sim 은 모른다. 깃발 모양이 자세를 말한다 (색에만 기대지 않게):
 * 돌격 = 뾰족한 세모 · 방진 = 네모 · 길 트기 = 제비꼬리 · 이동 = 가는 세모.
 * 빨간 원이 든 흰 바탕은 쓰지 않는다 (일장기 결 금지) — 내 편은 MY_LAND 파랑.
 */
import { P } from '../tune/params.ts'
import type { Cam, Viewport } from './viewCamera.ts'
import { TEAM_RGB } from './viewTint.ts'

export type MarkShape = 'move' | 'charge' | 'hold' | 'open'
export interface Mark { g: number; x: number; y: number; shape: MarkShape; sel: boolean }
export interface Gesture { x: number; y: number; tx: number; ty: number; ring: number; arrow: boolean }

const GOLD = '#ffd27a'
const MINE = `rgb(${TEAM_RGB[0]![0]},${TEAM_RGB[0]![1]},${TEAM_RGB[0]![2]})`
const FULL_TURN = 6.2832

function pennant(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, shape: MarkShape, sel: boolean, z: number): void {
  const w = h * 0.55, top = y - h
  ctx.lineWidth = Math.max(1, (sel ? 2.4 : 1.6) / z)
  ctx.strokeStyle = sel ? GOLD : '#f3ecd8'
  ctx.fillStyle = MINE
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, top); ctx.stroke()
  ctx.beginPath()
  if (shape === 'charge') { ctx.moveTo(x, top); ctx.lineTo(x + w * 1.2, top + h * 0.25); ctx.lineTo(x, top + h * 0.5) }
  else if (shape === 'hold') { ctx.moveTo(x, top); ctx.lineTo(x + w, top); ctx.lineTo(x + w, top + h * 0.5); ctx.lineTo(x, top + h * 0.5) }
  else if (shape === 'open') { ctx.moveTo(x, top); ctx.lineTo(x + w, top); ctx.lineTo(x + w * 0.7, top + h * 0.25); ctx.lineTo(x + w, top + h * 0.5); ctx.lineTo(x, top + h * 0.5) }
  else { ctx.moveTo(x, top); ctx.lineTo(x + w * 0.8, top + h * 0.2); ctx.lineTo(x, top + h * 0.4) }
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = sel ? GOLD : '#f3ecd8'
  ctx.fillRect(x - 1.5 / z, y - 1.5 / z, 3 / z, 3 / z)
}

/** from: 고른 무리의 자리(있으면 점선이 거기서 시작) */
export function drawMarks(ctx: CanvasRenderingContext2D, vp: Viewport, cam: Cam, marks: readonly Mark[], from: { x: number; y: number } | null, gest: Gesture | null): void {
  if (marks.length === 0 && gest === null) return
  const z = cam.zoom
  const poleH = P.field.markPoleCells * P.field.cellPx
  ctx.save()
  ctx.translate(vp.w / 2, vp.h / 2)
  ctx.scale(z, z)
  ctx.translate(-cam.x, -cam.y)
  ctx.lineJoin = 'round'
  for (const k of marks) {
    if (k.sel && from !== null) {
      ctx.save()
      ctx.setLineDash([6 / z, 5 / z]); ctx.lineWidth = 2 / z; ctx.strokeStyle = GOLD; ctx.globalAlpha = 0.85
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(k.x, k.y); ctx.stroke()
      ctx.restore()
    }
  }
  for (const k of marks) pennant(ctx, k.x, k.y, poleH, k.shape, k.sel, z)
  if (gest !== null) {
    ctx.strokeStyle = GOLD; ctx.fillStyle = GOLD
    if (gest.arrow) {
      ctx.lineWidth = 3 / z
      ctx.beginPath(); ctx.moveTo(gest.x, gest.y); ctx.lineTo(gest.tx, gest.ty); ctx.stroke()
      const dx = gest.tx - gest.x, dy = gest.ty - gest.y, len = Math.hypot(dx, dy) || 1
      const ux = dx / len, uy = dy / len, a = 11 / z
      ctx.beginPath()
      ctx.moveTo(gest.tx, gest.ty)
      ctx.lineTo(gest.tx - ux * a - uy * a * 0.6, gest.ty - uy * a + ux * a * 0.6)
      ctx.lineTo(gest.tx - ux * a + uy * a * 0.6, gest.ty - uy * a - ux * a * 0.6)
      ctx.closePath(); ctx.fill()
    } else if (gest.ring > 0) {
      ctx.lineWidth = 4 / z
      ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(gest.x, gest.y, 22 / z, 0, FULL_TURN); ctx.stroke()
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(gest.x, gest.y, 22 / z, -1.5708, -1.5708 + FULL_TURN * Math.min(1, gest.ring)); ctx.stroke()
    }
  }
  ctx.restore()
}
