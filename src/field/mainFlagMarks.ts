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
/** w·h 가 있으면 타원이 아니라 몸 네모를 감싸는 둥근 네모 테 (판 px · 가운데 x, y) */
export interface Ring { w?: number; h?: number; x: number; y: number; rx: number; ry: number; kind: 'sel' | 'dim' | 'hover' | 'nudge' | 'foe' | 'aura' | 'glow'; phase: number }

/** 활 사거리 띠: 활 한 대의 사거리 반원 (판 px) · lit 은 적 대가 그 안에 든 것 · sel 은 고른 것 · 겨눈 줄은 (x, y) → (tx, ty) */
export interface Band { x: number; y: number; r: number; face: 1 | -1; sel: boolean; lit: boolean; tx: number; ty: number; aim: boolean }

const GOLD = '#ffd27a'
const BAND_COLOR = '#cfe6ff'
const MINE = `rgb(${TEAM_RGB[0]![0]},${TEAM_RGB[0]![1]},${TEAM_RGB[0]![2]})`
const FULL_TURN = 6.2832
const SEL_POLE_SCALE = 1.35
const RING_FILL_ALPHA = 0.14
const NUDGE_GROW = 0.5
const BAND_ALPHA = 0.3
const HALF_TURN = 3.1416
const BAND_HALF = HALF_TURN / 3

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
  // 사거리: 무리 하나에 호 하나 (가는 흰 선 · 편의 앞쪽 120° 만) — 찍는 동안과 활 무리를 고른 동안에만 나온다
  if (bands.length > 0) {
    ctx.strokeStyle = BAND_COLOR; ctx.lineWidth = Math.max(1.5, 2 / z); ctx.globalAlpha = BAND_ALPHA
    ctx.beginPath()
    for (const b of bands) {
      const a0 = b.face === 1 ? -BAND_HALF : HALF_TURN - BAND_HALF
      ctx.moveTo(b.x + Math.cos(a0) * b.r, b.y + Math.sin(a0) * b.r)
      ctx.arc(b.x, b.y, b.r, a0, a0 + BAND_HALF * 2, false)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  for (const r of rings) {
    const grow = r.kind === 'nudge' ? 1 + r.phase * NUDGE_GROW : r.kind === 'foe' ? 1.3 - r.phase * 0.3 : 1
    ctx.beginPath()
    if (r.w !== undefined && r.h !== undefined) {
      const w = r.w * grow, h = r.h * grow
      ctx.roundRect(r.x - w / 2, r.y - h / 2, w, h, Math.min(w, h) * 0.2)
    } else ctx.ellipse(r.x, r.y, r.rx * grow, r.ry * grow, 0, 0, FULL_TURN)
    ctx.strokeStyle = GOLD
    if (r.kind === 'foe') { ctx.strokeStyle = '#ff6a3c'; ctx.globalAlpha = 1 - r.phase; ctx.lineWidth = Math.max(2, 3.6 / z) }
    else if (r.kind === 'dim') { ctx.strokeStyle = MINE; ctx.globalAlpha = 0.7; ctx.lineWidth = Math.max(1.5, 2.4 / z) }
    else if (r.kind === 'hover') { ctx.strokeStyle = '#f3ecd8'; ctx.globalAlpha = 0.8; ctx.lineWidth = Math.max(1, 1.5 / z) }
    else if (r.kind === 'aura') { ctx.strokeStyle = '#9cc8ff'; ctx.globalAlpha = 0.28; ctx.lineWidth = Math.max(1, 2 / z) }
    else if (r.kind === 'glow') { ctx.fillStyle = GOLD; ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 0.6; ctx.lineWidth = Math.max(1, 1.6 / z) }
    else if (r.kind === 'sel' && r.w !== undefined) { ctx.globalAlpha = 0.7; ctx.lineWidth = Math.max(1.5, 1.5 / z) }
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
    ctx.fillStyle = '#d9372c'; ctx.strokeStyle = '#2a0805'; ctx.lineWidth = Math.max(1, 1.5 / z)
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

/** 상성 표 하나 (판 px · 적 대 머리 위) — up 이면 고른 무리가 이 적을 이긴다(초록 ▲) · 아니면 이 적이 고른 무리를 이긴다(빨강 ▼) · big 은 마우스를 올린 적·겨눈 적 */
/** up: 고른 무리가 이긴다(▲) · 진다(▼) · null 이면 상성은 비기고 비탈 눈금만 · slope: 1 그 적이 높은 터 위(오르막 · 우리에게 불리) · -1 우리가 높은 터 위(내리막) · 0 같은 높이 */
export interface Odds { x: number; y: number; up: boolean | null; big: boolean; slope: -1 | 0 | 1 }
const SLOPE_UP = '#ffb08a', SLOPE_DOWN = '#9fe0a6'
const ODDS_UP = '#5fd068', ODDS_DOWN = '#e0473a', ODDS_BIG = 1.8

/** 시험판(?mvp): 고른 무리와 적 대 사이의 상성 표 (글 없이 세모만 · 엔진 상성 표 그대로를 넘겨 받는다) */
export function drawOdds(ctx: CanvasRenderingContext2D, vp: Viewport, cam: Cam, odds: readonly Odds[]): void {
  if (odds.length === 0) return
  const z = cam.zoom
  // 화면에서 같은 크기 (멀리 봐도 읽히게)
  const base = P.field.oddsMarkPx / z
  ctx.save()
  ctx.translate(vp.w / 2, vp.h / 2)
  ctx.scale(z, z)
  ctx.translate(-cam.x, -cam.y)
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(1, 1.5 / z)
  ctx.strokeStyle = '#0b0f08'
  for (const o of odds) {
    const h = o.big ? base * ODDS_BIG : base, w = h * 0.62
    if (o.up !== null) {
      ctx.fillStyle = o.up ? ODDS_UP : ODDS_DOWN
      ctx.beginPath()
      if (o.up) { ctx.moveTo(o.x, o.y - h); ctx.lineTo(o.x + w, o.y); ctx.lineTo(o.x - w, o.y) }
      else { ctx.moveTo(o.x - w, o.y - h); ctx.lineTo(o.x + w, o.y - h); ctx.lineTo(o.x, o.y) }
      ctx.closePath(); ctx.fill(); ctx.stroke()
    }
    // 비탈 눈금: 세모 오른쪽에 비스듬한 막대 — 오르는 비탈(/ 주황)이면 우리에게 불리 · 내리는 비탈(\ 초록)이면 유리
    if (o.slope !== 0) {
      const x0 = o.x + w + h * 0.25, x1 = x0 + h * 0.7
      ctx.save(); ctx.lineWidth = Math.max(2, 3 / z); ctx.strokeStyle = o.slope > 0 ? SLOPE_UP : SLOPE_DOWN
      ctx.beginPath()
      if (o.slope > 0) { ctx.moveTo(x0, o.y); ctx.lineTo(x1, o.y - h) } else { ctx.moveTo(x0, o.y - h); ctx.lineTo(x1, o.y) }
      ctx.stroke(); ctx.restore()
    }
  }
  ctx.restore()
}

/** 시험판(?mvp)의 길 하나 — 무리 g 의 가운데에서 마디들까지 (판 px) · sel 이면 굵게 */
export interface Path { g: number; pts: readonly { x: number; y: number }[]; sel: boolean }
/** 무리마다 길 색 (g 0 앞줄 · 1 활 · 2 위 날개 · 3 장수 · 4 아래 날개) — 땅 위에서 서로 갈린다 */
const PATH_COLORS = ['#9fc4ff', '#b7f08a', '#ffb35c', GOLD, '#f08ad8']

/** 땅에 그리는 길 (멈춘 동안에도 보인다) — 무리 색 점선 · 마디마다 작은 점 */
export function drawPaths(ctx: CanvasRenderingContext2D, vp: Viewport, cam: Cam, paths: readonly Path[]): void {
  if (paths.length === 0) return
  const z = cam.zoom
  ctx.save()
  ctx.translate(vp.w / 2, vp.h / 2)
  ctx.scale(z, z)
  ctx.translate(-cam.x, -cam.y)
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  for (const p of paths) {
    const color = PATH_COLORS[p.g] ?? GOLD
    ctx.strokeStyle = color; ctx.fillStyle = color
    ctx.globalAlpha = p.sel ? 0.95 : 0.6
    ctx.lineWidth = (p.sel ? 3 : 2) / z
    ctx.setLineDash([8 / z, 6 / z])
    ctx.beginPath()
    p.pts.forEach((q, i) => { if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y) })
    ctx.stroke()
    ctx.setLineDash([])
    for (let i = 1; i < p.pts.length; i++) { ctx.beginPath(); ctx.arc(p.pts[i]!.x, p.pts[i]!.y, 4 / z, 0, FULL_TURN); ctx.fill() }
  }
  ctx.restore()
}

/** 시험판(?mvp)의 화살비 자리 (판 px) — 찍기 전(placed false)은 마우스를 따라가고 · ok 아니면(활이 닿는 거리 밖 · 다가간 뒤 쏜다) 점선 · 찍은 뒤는 frac(남은 몫)만큼 줄어드는 안쪽 고리 */
export interface Volley { x: number; y: number; r: number; ok: boolean; placed: boolean; frac: number }
const VOLLEY_COLOR = '#cfe6ff', VOLLEY_FAR = '#ffb08a'

export function drawVolley(ctx: CanvasRenderingContext2D, vp: Viewport, cam: Cam, vs: readonly Volley[]): void {
  if (vs.length === 0) return
  const z = cam.zoom
  ctx.save()
  ctx.translate(vp.w / 2, vp.h / 2)
  ctx.scale(z, z)
  ctx.translate(-cam.x, -cam.y)
  for (const v of vs) {
    const color = v.ok || v.placed ? VOLLEY_COLOR : VOLLEY_FAR
    ctx.beginPath(); ctx.arc(v.x, v.y, v.r, 0, FULL_TURN)
    ctx.fillStyle = color; ctx.globalAlpha = v.placed ? 0.16 : 0.1; ctx.fill()
    ctx.globalAlpha = 0.9; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, 2.5 / z)
    ctx.setLineDash(v.ok || v.placed ? [] : [10 / z, 7 / z]); ctx.stroke(); ctx.setLineDash([])
    if (v.placed && v.frac > 0) {
      ctx.beginPath(); ctx.arc(v.x, v.y, v.r * v.frac, 0, FULL_TURN)
      ctx.globalAlpha = 0.75; ctx.lineWidth = Math.max(1, 1.8 / z); ctx.stroke()
    }
  }
  ctx.restore()
}

/** 시험판(?mvp): 달아나는 대 위의 흰 깃 (판 px · 못 고르는 대 · 장수가 곁에 가야 다시 선다) */
export function drawWhiteFlags(ctx: CanvasRenderingContext2D, vp: Viewport, cam: Cam, pts: readonly { x: number; y: number }[]): void {
  if (pts.length === 0) return
  const z = cam.zoom, h = P.field.markPoleCells * P.field.cellPx
  ctx.save()
  ctx.translate(vp.w / 2, vp.h / 2); ctx.scale(z, z); ctx.translate(-cam.x, -cam.y)
  ctx.lineWidth = Math.max(1, 1.6 / z); ctx.strokeStyle = '#3a3a3a'; ctx.fillStyle = '#f4f1ea'
  for (const p of pts) {
    const top = p.y - h, w = h * 0.55
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, top); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(p.x, top); ctx.lineTo(p.x + w, top + h * 0.12); ctx.lineTo(p.x + w * 0.85, top + h * 0.3); ctx.lineTo(p.x + w, top + h * 0.48); ctx.lineTo(p.x, top + h * 0.42); ctx.closePath()
    ctx.fill(); ctx.stroke()
  }
  ctx.restore()
}

/** 시험판(?mvp): 장수 체력 고리 — 발밑 둘레에 남은 체력만큼 호 (그 편 색 · 3분의 1 아래면 붉게) */
export interface HeroHp { x: number; y: number; frac: number; side: 0 | 1 }
export function drawHeroHp(ctx: CanvasRenderingContext2D, vp: Viewport, cam: Cam, hs: readonly HeroHp[]): void {
  if (hs.length === 0) return
  const z = cam.zoom, r = P.field.ringHeroCells * P.field.cellPx * 1.15
  ctx.save()
  ctx.translate(vp.w / 2, vp.h / 2); ctx.scale(z, z); ctx.translate(-cam.x, -cam.y)
  for (const hh of hs) {
    ctx.lineWidth = Math.max(3, 4 / z)
    ctx.strokeStyle = '#0008'
    ctx.beginPath(); ctx.ellipse(hh.x, hh.y, r, r * 0.45, 0, 0, FULL_TURN); ctx.stroke()
    ctx.strokeStyle = hh.frac < 1 / 3 ? '#ff5a3c' : hh.side === 0 ? MINE : '#e0473a'
    ctx.beginPath(); ctx.ellipse(hh.x, hh.y, r, r * 0.45, 0, -HALF_TURN / 2, -HALF_TURN / 2 + FULL_TURN * Math.max(0, Math.min(1, hh.frac))); ctx.stroke()
  }
  ctx.restore()
}
