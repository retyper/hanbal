/**
 * 전장 그리기: VModel(viewRead.ts)만 읽는다. sim 상태를 모른다 (규칙 2).
 * 판 좌표 = 칸 × P.field.cellPx. u = 가로 · v = 세로. 우리 편(0)은 오른쪽을 보고 적(1)은 왼쪽을 본다.
 * 점은 세로(y) 차례로 늘어세워 앞 점이 뒤 점을 덮는다. 편 색은 발밑 타원(임시 · F3b 가 편 색 입히기를 한다).
 */
import { P } from '../tune/params.ts'
import { fieldView, inView, type Cam, type Viewport } from './viewCamera.ts'
import { ATTACK0, ATTACK_N, DOWN, STAND0, STAND_N, STRIP_H, WALK0, WALK_N, heroStrip, pieceImg, stripFor, type Art, type Strip } from './viewArt.ts'
import { dotOffset, dotPhase, sideDotCounts } from './viewDots.ts'
import type { VModel } from './viewRead.ts'

/** 우리 편은 본편 지도의 MY_LAND 파랑과 같은 결 (src/ui/realm/mapview.ts) */
const SIDE_COLOR = ['#2f8cff', '#b8503a'] as const
const GROUND_TILE_CELLS = 20
const GROUND_FALLBACK = '#5b7a3c'
const BACKDROP = '#10140d'
/** 몸 키 / 띠 높이 (띠 칸 안 병사의 키 비) */
const BODY_RATIO = 150 / STRIP_H
const FULL_TURN = 6.2832

interface Dot { x: number; y: number; strip: Strip | null; frame: number; flip: boolean; side: 0 | 1; h: number }
const pool: Dot[] = []
const order: Dot[] = []
let used = 0

function nextDot(): Dot {
  if (used === pool.length) pool.push({ x: 0, y: 0, strip: null, frame: 0, flip: false, side: 0, h: 0 })
  return pool[used++]!
}

const mix = (a: number, b: number, t: number): number => a + (b - a) * t
/** sim 단위 → 판 px */
export const unitsToPx = (u: number): number => u / P.field.unit * P.field.cellPx

/** 판 좌표로 바꾼 맵 크기 */
export const worldSize = (m: VModel): { w: number; h: number } => ({ w: m.mapU * P.field.cellPx, h: m.mapW * P.field.cellPx })

function pose(nowMs: number, phase: number, moving: boolean, attacking: boolean): number {
  const F = P.field
  if (attacking) return ATTACK0 + Math.floor(nowMs / F.animAttackMs + phase * ATTACK_N) % ATTACK_N
  if (moving) return WALK0 + Math.floor(nowMs / F.animWalkMs + phase * WALK_N) % WALK_N
  return STAND0 + Math.floor(nowMs / F.animStandMs + phase * STAND_N) % STAND_N
}

function drawGround(ctx: CanvasRenderingContext2D, art: Art, view: ReturnType<typeof fieldView>, world: { w: number; h: number }): void {
  const g = art.ground
  ctx.fillStyle = GROUND_FALLBACK
  ctx.fillRect(0, 0, world.w, world.h)
  if (!(g.complete && g.naturalWidth > 0)) return
  const th = GROUND_TILE_CELLS * P.field.cellPx, tw = th * g.naturalWidth / g.naturalHeight
  const x0 = Math.max(0, Math.floor(view.left / tw)), x1 = Math.min(Math.ceil(world.w / tw), Math.ceil(view.right / tw))
  const y0 = Math.max(0, Math.floor(view.top / th)), y1 = Math.min(Math.ceil(world.h / th), Math.ceil(view.bottom / th))
  for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) ctx.drawImage(g, tx * tw, ty * th, tw + 1, th + 1)
}

/**
 * 한 장 그린다. prev 는 직전 틱의 모양(없으면 null) · alpha 는 직전 틱과 지금 틱 사이 0~1.
 * ctx 는 CSS px 기준(setTransform 으로 dpr 를 이미 곱해 둔 것). 반환: 그린 점 수.
 */
export function drawField(ctx: CanvasRenderingContext2D, vp: Viewport, cam: Cam, cur: VModel, prev: VModel | null, alpha: number, nowMs: number, art: Art, low: boolean): number {
  const F = P.field
  const world = worldSize(cur)
  const view = fieldView(cam, vp)
  ctx.save()
  ctx.fillStyle = BACKDROP
  ctx.fillRect(0, 0, vp.w, vp.h)
  ctx.translate(vp.w / 2, vp.h / 2)
  ctx.scale(cam.zoom, cam.zoom)
  ctx.translate(-cam.x, -cam.y)
  drawGround(ctx, art, view, world)

  for (const p of cur.pieces) {
    const img = pieceImg(art, p.kind)
    if (img === null) continue
    const x = unitsToPx(p.u), y = unitsToPx(p.v), h = F.cellPx * 3, w = h * img.naturalWidth / img.naturalHeight
    if (inView(view, x, y, w)) ctx.drawImage(img, x - w / 2, y - h, w, h)
  }

  used = 0
  const baseH = F.soldierCells * F.cellPx / BODY_RATIO
  const pad = baseH * 3
  const lowShare = low ? F.lowDotsShare : 1000
  for (const side of [0, 1] as const) {
    const mine = cur.squads.filter(q => q.side === side)
    const counts = sideDotCounts(mine.map(q => q.men), lowShare)
    mine.forEach((q, i) => {
      const n = counts[i]!
      if (n === 0) return
      const pq = prev !== null ? prev.squads[q.id] : undefined
      const moving = pq !== undefined && (pq.u !== q.u || pq.v !== q.v)
      const tq = q.target >= 0 ? cur.squads[q.target] : undefined
      let attacking = false
      if (tq !== undefined && tq.men > 0) {
        const range = (q.grp === 'bows' ? F.bowRangeCells : F.meleeRangeCells + 1) * F.unit
        const du = q.u - tq.u, dv = q.v - tq.v
        attacking = du * du + dv * dv <= range * range
      }
      const qu = pq === undefined ? q.u : mix(pq.u, q.u, alpha), qv = pq === undefined ? q.v : mix(pq.v, q.v, alpha)
      const strip = stripFor(art, q.grp, q.kind)
      for (let k = 0; k < n; k++) {
        const o = dotOffset(q.id, k)
        const x = unitsToPx(qu) + o.du * F.cellPx, y = unitsToPx(qv) + o.dv * F.cellPx
        if (!inView(view, x, y, pad)) continue
        const d = nextDot()
        d.x = x; d.y = y; d.strip = strip; d.side = side; d.flip = side === 1; d.h = baseH
        d.frame = pose(nowMs, dotPhase(q.id, k), moving, attacking)
      }
    })
  }
  const hs = heroStrip(art)
  for (const e of cur.heroes) {
    const pe = prev !== null ? prev.heroes.find(h => h.side === e.side) : undefined
    const hu = pe === undefined ? e.u : mix(pe.u, e.u, alpha), hv = pe === undefined ? e.v : mix(pe.v, e.v, alpha)
    const x = unitsToPx(hu), y = unitsToPx(hv)
    if (!inView(view, x, y, pad)) continue
    const d = nextDot()
    d.x = x; d.y = y; d.strip = hs; d.side = e.side; d.flip = e.side === 1; d.h = baseH * F.heroScale / 100
    d.frame = e.stun > 0 ? DOWN : pose(nowMs, 0, pe !== undefined && (pe.u !== e.u || pe.v !== e.v), false)
  }

  order.length = 0
  for (let i = 0; i < used; i++) order.push(pool[i]!)
  order.sort((a, b) => a.y - b.y)
  for (const d of order) {
    ctx.fillStyle = SIDE_COLOR[d.side]
    ctx.globalAlpha = low ? 0.5 : 0.35
    ctx.beginPath()
    ctx.ellipse(d.x, d.y, d.h * 0.22, d.h * 0.07, 0, 0, FULL_TURN)
    ctx.fill()
    ctx.globalAlpha = 1
    const s = d.strip
    if (s === null) { ctx.fillStyle = SIDE_COLOR[d.side]; ctx.fillRect(d.x - d.h * 0.1, d.y - d.h * BODY_RATIO, d.h * 0.2, d.h * BODY_RATIO); continue }
    const w = d.h * s.cw / STRIP_H
    if (d.flip) {
      ctx.save(); ctx.translate(d.x, d.y); ctx.scale(-1, 1)
      ctx.drawImage(s.img, d.frame * s.cw, 0, s.cw, STRIP_H, -w / 2, -d.h, w, d.h)
      ctx.restore()
    } else ctx.drawImage(s.img, d.frame * s.cw, 0, s.cw, STRIP_H, d.x - w / 2, d.y - d.h, w, d.h)
  }
  ctx.restore()
  return used
}
