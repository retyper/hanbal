/**
 * 맵 위 표시 — 꽂은 자리의 깃발 · 고른 무리에서 그 자리까지 점선 · 고른 것 발밑 금빛 고리 · 끌어서 그리는 네모 (50-control-v2.md)
 * 그리는 쪽 전용: 넘겨 받은 값만 읽고 sim 은 모른다. 깃발 모양이 자세를 말한다 (색에만 기대지 않게):
 * 돌격 = 뾰족한 세모 · 방진 = 네모 · 길 트기 = 제비꼬리 · 이동 = 가는 세모. 고른 깃은 금빛 테두리에 더 크다.
 * 빨간 원이 든 흰 바탕은 쓰지 않는다 (일장기 결 금지) — 내 편은 MY_LAND 파랑.
 */
import type { Cam, Viewport } from './viewCamera.ts'
import { P } from '../tune/params.ts'
import { TEAM_RGB } from './viewTint.ts'

export type MarkShape = 'move' | 'charge' | 'hold' | 'open'
export interface Mark { g: number; x: number; y: number; shape: MarkShape; sel: boolean }
/** 끌어서 그리는 네모 (판 px) */
export interface Box { x0: number; y0: number; x1: number; y1: number }
/** 발밑 고리 (판 px · 반지름은 가로 rx · 세로 ry) — sel 은 고른 것(늘 떠 있다) · nudge 는 한 번 퍼지며 사라지는 「눌러 봐」 (phase 0~1) */
export interface Ring { x: number; y: number; rx: number; ry: number; kind: 'sel' | 'nudge' | 'foe' | 'aura' | 'glow'; phase: number }

/** 활 사거리 띠: 활 한 대의 사거리 반원 (판 px) · lit 은 적 대가 그 안에 든 것 · sel 은 고른 것 · 겨눈 줄은 (x, y) → (tx, ty) */
export interface Band { x: number; y: number; r: number; face: 1 | -1; sel: boolean; lit: boolean; tx: number; ty: number; aim: boolean }

const GOLD = '#ffd27a'
const BAND_COLOR = '#cfe6ff'
const MINE = `rgb(${TEAM_RGB[0]![0]},${TEAM_RGB[0]![1]},${TEAM_RGB[0]![2]})`
const FULL_TURN = 6.2832
const SEL_POLE_SCALE = 1.35
const RING_FILL_ALPHA = 0.14
const NUDGE_GROW = 0.5
const BAND_WIDTH_CELLS = 0.8
const BAND_ALPHA = [0.1, 0.32, 0.5] as const
const HALF_TURN = 3.1416

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

/** froms[g]: 고른 무리의 자리(있으면 그 무리 깃까지 점선이 거기서 시작) */
export function drawMarks(ctx: CanvasRenderingContext2D, vp: Viewport, cam: Cam, marks: readonly Mark[], froms: readonly ({ x: number; y: number } | null)[], rings: readonly Ring[], box: Box | null, bands: readonly Band[], foes: readonly { x: number; y: number }[]): void {
  if (marks.length === 0 && rings.length === 0 && box === null && bands.length === 0 && foes.length === 0) return
  const z = cam.zoom
  const poleH = P.field.markPoleCells * P.field.cellPx
  ctx.save()
  ctx.translate(vp.w / 2, vp.h / 2)
  ctx.scale(z, z)
  ctx.translate(-cam.x, -cam.y)
  ctx.lineJoin = 'round'
  // 사거리 띠: 안 고른 것 · 고른 것 · 적이 든 것 세 단계를 단계마다 한 경로로 (낱낱 점선이 아니라 옅은 띠 한 겹)
  if (bands.length > 0) {
    ctx.strokeStyle = BAND_COLOR; ctx.lineWidth = BAND_WIDTH_CELLS * P.field.cellPx
    for (let lvl = 0; lvl < 3; lvl++) {
      ctx.beginPath()
      let any = false
      for (const b of bands) {
        if ((b.lit ? 2 : b.sel ? 1 : 0) !== lvl) continue
        const a0 = b.face === 1 ? -HALF_TURN / 2 : HALF_TURN / 2
        ctx.moveTo(b.x + Math.cos(a0) * b.r, b.y + Math.sin(a0) * b.r)
        ctx.arc(b.x, b.y, b.r, a0, a0 + HALF_TURN, false)
        any = true
      }
      if (any) { ctx.globalAlpha = BAND_ALPHA[lvl]!; ctx.stroke() }
    }
    ctx.globalAlpha = 0.8; ctx.lineWidth = Math.max(1, 1.5 / z); ctx.beginPath()
    for (const b of bands) if (b.aim) { ctx.moveTo(b.x, b.y); ctx.lineTo(b.tx, b.ty) }
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  for (const r of rings) {
    const grow = r.kind === 'nudge' ? 1 + r.phase * NUDGE_GROW : r.kind === 'foe' ? 1.3 - r.phase * 0.3 : 1
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.rx * grow, r.ry * grow, 0, 0, FULL_TURN)
    ctx.strokeStyle = GOLD
    if (r.kind === 'foe') { ctx.strokeStyle = '#ff6a3c'; ctx.globalAlpha = 1 - r.phase; ctx.lineWidth = Math.max(2, 3.6 / z) }
    else if (r.kind === 'aura') { ctx.strokeStyle = '#9cc8ff'; ctx.globalAlpha = 0.28; ctx.lineWidth = Math.max(1, 2 / z) }
    else if (r.kind === 'glow') { ctx.fillStyle = GOLD; ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 0.6; ctx.lineWidth = Math.max(1, 1.6 / z) }
    else if (r.kind === 'sel') {
      ctx.globalAlpha = RING_FILL_ALPHA; ctx.fillStyle = GOLD; ctx.fill()
      ctx.globalAlpha = 0.9; ctx.lineWidth = Math.max(1.5, 2.6 / z)
    } else { ctx.globalAlpha = 1 - r.phase; ctx.lineWidth = Math.max(1.5, 3.4 / z) }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  for (const k of marks) {
    const from = froms[k.g]
    if (k.sel && from !== null && from !== undefined) {
      ctx.save()
      ctx.setLineDash([6 / z, 5 / z]); ctx.lineWidth = 2 / z; ctx.strokeStyle = GOLD; ctx.globalAlpha = 0.85
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(k.x, k.y); ctx.stroke()
      ctx.restore()
    }
  }
  for (const k of marks) pennant(ctx, k.x, k.y, k.sel ? poleH * SEL_POLE_SCALE : poleH, k.shape, k.sel, z)
  if (foes.length > 0) {
    const h = P.field.foeMarkCells * P.field.cellPx
    ctx.fillStyle = '#ffb04a'; ctx.strokeStyle = '#2a1405'; ctx.lineWidth = Math.max(1, 1.5 / z)
    ctx.beginPath()
    for (const f of foes) { ctx.moveTo(f.x - h * 0.6, f.y - h * 1.4); ctx.lineTo(f.x + h * 0.6, f.y - h * 1.4); ctx.lineTo(f.x, f.y - h * 0.4); ctx.closePath() }
    ctx.fill(); ctx.stroke()
  }
  if (box !== null) {
    ctx.fillStyle = GOLD; ctx.strokeStyle = GOLD
    ctx.globalAlpha = RING_FILL_ALPHA; ctx.fillRect(Math.min(box.x0, box.x1), Math.min(box.y0, box.y1), Math.abs(box.x1 - box.x0), Math.abs(box.y1 - box.y0))
    ctx.globalAlpha = 0.9; ctx.lineWidth = 2 / z
    ctx.strokeRect(Math.min(box.x0, box.x1), Math.min(box.y0, box.y1), Math.abs(box.x1 - box.x0), Math.abs(box.y1 - box.y0))
  }
  ctx.restore()
}
