/**
 * 전장 그리기: VModel(viewRead.ts)만 읽는다. sim 상태를 모른다 (규칙 2).
 * 판 좌표 = 칸 × P.field.cellPx. u = 가로 · v = 세로. 우리 편(0)은 오른쪽을 보고 적(1)은 왼쪽을 보는 것이 처음 방향이고,
 * 움직이면 가는 쪽을 본다 (물러나는 대는 뒤돌아 걷는다).
 * 점 · 쓰러진 병사 · 목책 말뚝은 세로(y) 차례로 늘어세워 앞의 것이 뒤의 것을 덮는다. 화살은 맨 위에 낱낱이 그린다.
 * 그리는 쪽 기억(쓰러진 병사 · 방향)은 이 파일 안에만 있고 sim 으로 안 나간다.
 */
import { P } from '../tune/params.ts'
import { fieldView, inView, type Cam, type Viewport } from './viewCamera.ts'
import { ATTACK0, ATTACK_N, DOWN, HIT, STAND0, STAND_N, WALK0, WALK_N, heroStrip, pieceImg, sheetOf, stripFor, type Art, type Strip } from './viewArt.ts'
import { dotOffset, dotPhase, hash2, sideDotCounts } from './viewDots.ts'
import { drawTerrain } from './viewTerrain.ts'
import { TEAM_RGB } from './viewTint.ts'
import type { VModel } from './viewRead.ts'

const SIDE_COLOR = TEAM_RGB.map(c => `rgb(${c[0]},${c[1]},${c[2]})`) as readonly string[]
const GROUND_TILE_CELLS = 20
const GROUND_FALLBACK = '#5b7a3c'
const BACKDROP = '#10140d'
const ARROW_COLOR = '#f4ead0'
const FULL_TURN = 6.2832
const STAKE_VARIANTS = 17

type Kind = 0 | 1 | 2 // 0 병사 · 1 쓰러진 병사 · 2 소품(목책 말뚝·문)
interface Item { y: number; x: number; kind: Kind; strip: Strip | null; frame: number; flip: boolean; side: 0 | 1; h: number; img: HTMLImageElement | null; alpha: number; hero: boolean }
const pool: Item[] = []
const order: Item[] = []
let used = 0

const byY = (a: Item, b: Item): number => a.y - b.y
function nextItem(): Item {
  if (used === pool.length) pool.push({ y: 0, x: 0, kind: 0, strip: null, frame: 0, flip: false, side: 0, h: 0, img: null, alpha: 1, hero: false })
  const d = pool[used++]!
  d.img = null; d.strip = null; d.alpha = 1; d.hero = false
  return d
}

interface Corpse { x: number; y: number; side: 0 | 1; flip: boolean; strip: Strip | null; h: number; born: number }
/** 그리는 쪽 기억 — 점 수가 줄면 쓰러진 병사를 남기고 대의 마지막 방향을 기억한다 */
const fx = { counts: new Map<number, number>(), face: new Map<number, 1 | -1>(), corpses: [] as Corpse[], tick: -1 }
/** 새 판이 시작되면 부른다 */
export function resetFx(): void { fx.counts.clear(); fx.face.clear(); fx.corpses.length = 0; fx.tick = -1 }

const mix = (a: number, b: number, t: number): number => a + (b - a) * t
/** sim 단위 → 판 px */
export const unitsToPx = (u: number): number => u / P.field.unit * P.field.cellPx
/** 판 좌표로 바꾼 맵 크기 */
export const worldSize = (m: VModel): { w: number; h: number } => ({ w: m.mapU * P.field.cellPx, h: m.mapW * P.field.cellPx })

/** 카메라가 담을 점들(판 px): 적 대와 engageCells 안에 붙은 대 · 없으면 우리 편 살아 있는 대 */
export function focusPoints(m: VModel): { xs: number[]; ys: number[]; engaged: boolean } {
  const r = P.field.engageCells * P.field.unit, r2 = r * r
  const xs: number[] = [], ys: number[] = []
  for (const q of m.squads) {
    if (q.men <= 0) continue
    let near = false
    for (const e of m.squads) {
      if (e.side === q.side || e.men <= 0) continue
      const du = q.u - e.u, dv = q.v - e.v
      if (du * du + dv * dv <= r2) { near = true; break }
    }
    if (near) { xs.push(unitsToPx(q.u)); ys.push(unitsToPx(q.v)) }
  }
  if (xs.length > 0) return { xs, ys, engaged: true }
  for (const q of m.squads) if (q.side === 0 && q.men > 0) { xs.push(unitsToPx(q.u)); ys.push(unitsToPx(q.v)) }
  return { xs, ys, engaged: false }
}

function pose(nowMs: number, phase: number, moving: boolean, attacking: boolean): number {
  const F = P.field
  if (attacking) return ATTACK0 + Math.floor(nowMs / F.animAttackMs + phase * ATTACK_N) % ATTACK_N
  if (moving) return WALK0 + Math.floor(nowMs / F.animWalkMs + phase * WALK_N) % WALK_N
  return STAND0 + Math.floor(nowMs / F.animStandMs + phase * STAND_N) % STAND_N
}

function drawGround(ctx: CanvasRenderingContext2D, art: Art, view: ReturnType<typeof fieldView>): void {
  const g = art.ground
  ctx.fillStyle = GROUND_FALLBACK
  ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top)
  if (!(g.complete && g.naturalWidth > 0)) return
  const th = GROUND_TILE_CELLS * P.field.cellPx, tw = th * g.naturalWidth / g.naturalHeight
  const x0 = Math.floor(view.left / tw), x1 = Math.ceil(view.right / tw)
  const y0 = Math.floor(view.top / th), y1 = Math.ceil(view.bottom / th)
  for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) ctx.drawImage(g, tx * tw, ty * th, tw + 1, th + 1)
}

/** 목책 말뚝·문을 소품으로 모은다 (있는 그림 · 안 왔으면 건너뛴다) */
function addProps(m: VModel, art: Art, view: ReturnType<typeof fieldView>): void {
  const F = P.field, cp = F.cellPx
  for (const p of m.pieces) {
    if (p.kind === 'stake') {
      if (p.hp <= 0) continue
      const x = (p.u0 + p.u1) / 2 * cp, n = Math.max(1, Math.ceil((p.v1 - p.v0) / F.stakeGapCells))
      for (let i = 0; i < n; i++) {
        const y = (p.v0 + (i + 0.5) * (p.v1 - p.v0) / n) * cp
        if (!inView(view, x, y, F.stakeHeightCells * cp)) continue
        const img = pieceImg(art, `stake-${String(1 + hash2(p.id, i) % STAKE_VARIANTS).padStart(2, '0')}`)
        if (img === null) continue
        const d = nextItem()
        d.kind = 2; d.x = x; d.y = y; d.img = img; d.h = F.stakeHeightCells * cp
      }
    } else {
      const x = (p.u0 + p.u1) / 2 * cp, y = (p.v0 + p.v1) / 2 * cp
      if (!inView(view, x, y, F.stakeHeightCells * cp * 2)) continue
      const img = pieceImg(art, p.hp > 0 ? 'gate-oblique' : 'gate-oblique-broken')
      if (img === null) continue
      const d = nextItem()
      d.kind = 2; d.x = x; d.y = y; d.img = img; d.h = Math.max((p.v1 - p.v0) * cp * 1.1, F.stakeHeightCells * cp)
    }
  }
}

/**
 * 대마다 깃 하나 (대 가운데 위): 우리 = 네모 · 적 = 끝이 갈라진 제비꼬리. 모양으로 갈리니 색을 못 가려도 읽힌다.
 * 크기는 화면 px 로 하한을 둔다 (멀리서도 읽히게). 장수 깃(kind 1)은 더 크고 쓰러진 동안(kind 2)은 속이 빈 테두리만.
 * 빨간 원·햇살 모양은 쓰지 않는다.
 */
function drawBanners(ctx: CanvasRenderingContext2D, at: readonly number[], zoom: number, baseH: number): void {
  const F = P.field
  ctx.lineJoin = 'round'
  for (let i = 0; i < at.length; i += 4) {
    const x = at[i]!, y = at[i + 1]!, side = at[i + 2] as 0 | 1, kind = at[i + 3]!
    const hero = kind > 0
    const sz = Math.max(baseH * (hero ? 0.4 : 0.3), (hero ? F.heroFlagMinPx : F.flagMinPx) / zoom)
    const top = y - baseH * (hero ? 1.9 : 1.5) - sz * 1.2
    ctx.strokeStyle = ARROW_COLOR
    ctx.lineWidth = Math.max(1, 1.4 / zoom)
    ctx.beginPath(); ctx.moveTo(x, y - baseH * (hero ? 1.5 : 1.1)); ctx.lineTo(x, top); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, top)
    if (side === 0) { ctx.lineTo(x + sz, top); ctx.lineTo(x + sz, top + sz * 0.8); ctx.lineTo(x, top + sz * 0.8) }
    else { ctx.lineTo(x + sz, top); ctx.lineTo(x + sz * 0.62, top + sz * 0.4); ctx.lineTo(x + sz, top + sz * 0.8); ctx.lineTo(x, top + sz * 0.8) }
    ctx.closePath()
    if (kind !== 2) { ctx.fillStyle = SIDE_COLOR[side]!; ctx.fill() }
    ctx.stroke()
  }
}

function drawItem(ctx: CanvasRenderingContext2D, d: Item): void {
  if (d.kind === 2) {
    const img = d.img!
    const w = d.h * img.naturalWidth / img.naturalHeight
    ctx.drawImage(img, d.x - w / 2, d.y - d.h, w, d.h)
    return
  }
  if (d.kind === 0 && d.hero) {
    // 장수 발밑: 그림자 위에 편 색 테두리 (병사 그림자는 편마다 한 경로로 미리 칠했다)
    ctx.fillStyle = SIDE_COLOR[d.side]!
    ctx.globalAlpha = 0.4
    ctx.beginPath(); ctx.ellipse(d.x, d.y, d.h * 0.3, d.h * 0.1, 0, 0, FULL_TURN); ctx.fill()
    ctx.globalAlpha = 0.9; ctx.strokeStyle = SIDE_COLOR[d.side]!; ctx.lineWidth = Math.max(1.5, d.h * 0.05); ctx.stroke()
    ctx.globalAlpha = 1
  }
  const s = d.strip
  if (s === null) return
  const sc = d.h / s.bodyPx, dw = s.cw * sc, dh = s.ch * sc
  const sheet = sheetOf(s, d.hero ? -1 : d.side, d.flip)
  if (d.alpha < 1) ctx.globalAlpha = d.alpha
  ctx.drawImage(sheet, (d.frame % s.cols) * s.cw, Math.floor(d.frame / s.cols) * s.ch, s.cw, s.ch, d.x - dw / 2, d.y - s.feet * sc, dw, dh)
  if (d.alpha < 1) ctx.globalAlpha = 1
}

/** 병사 그림자: 편마다 한 경로로 모아 한 번에 칠한다 (점마다 칠하면 호출이 점 수에 그대로 비례한다) */
function drawShadows(ctx: CanvasRenderingContext2D, count: number, low: boolean): void {
  for (const side of [0, 1] as const) {
    ctx.beginPath()
    let any = false
    for (let i = 0; i < count; i++) {
      const d = pool[i]!
      if (d.kind !== 0 || d.hero || d.side !== side) continue
      const rx = d.h * 0.26
      ctx.moveTo(d.x + rx, d.y); ctx.ellipse(d.x, d.y, rx, d.h * 0.08, 0, 0, FULL_TURN)
      any = true
    }
    if (!any) continue
    ctx.fillStyle = SIDE_COLOR[side]!
    ctx.globalAlpha = low ? P.field.shadowAlphaLow / 100 : P.field.shadowAlpha / 100
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/**
 * 한 장 그린다. prev 는 직전 틱의 모양(없으면 null) · alpha 는 직전 틱과 지금 틱 사이 0~1.
 * ctx 는 CSS px 기준(setTransform 으로 dpr 를 이미 곱해 둔 것). 반환: 그린 점 수(병사+장수).
 * heroPick: 주소의 ?hero= (없으면 null)
 */
export function drawField(ctx: CanvasRenderingContext2D, vp: Viewport, cam: Cam, cur: VModel, prev: VModel | null, alpha: number, nowMs: number, art: Art, low: boolean, heroPick: string | null = null): number {
  const F = P.field
  if (cur.tick < fx.tick) resetFx()
  fx.tick = cur.tick
  const world = worldSize(cur)
  const view = fieldView(cam, vp)
  ctx.save()
  ctx.fillStyle = BACKDROP
  ctx.fillRect(0, 0, vp.w, vp.h)
  ctx.translate(vp.w / 2, vp.h / 2)
  ctx.scale(cam.zoom, cam.zoom)
  ctx.translate(-cam.x, -cam.y)
  drawGround(ctx, art, view)
  drawTerrain(ctx, cur, world.w, world.h)

  used = 0
  addProps(cur, art, view)
  const baseH = F.soldierCells * F.cellPx
  const pad = baseH * 3
  const lowShare = low ? F.lowDotsShare : 1000
  const arrows: number[] = []
  /** 대 깃 자리 (x · y · 편 · 장수면 1) — 끝에서 한꺼번에 그린다 */
  const flagsAt: number[] = []
  let drawn = 0
  for (const side of [0, 1] as const) {
    const mine = cur.squads.filter(q => q.side === side)
    const counts = sideDotCounts(mine.map(q => q.men), lowShare)
    mine.forEach((q, i) => {
      const n = counts[i]!
      const was = fx.counts.get(q.id) ?? n
      fx.counts.set(q.id, n)
      const pq = prev !== null ? prev.squads[q.id] : undefined
      const du0 = pq === undefined ? 0 : q.u - pq.u
      const moving = pq !== undefined && (du0 !== 0 || pq.v !== q.v)
      const tq = q.target >= 0 ? cur.squads[q.target] : undefined
      let attacking = false
      if (tq !== undefined && tq.men > 0) {
        const range = (q.grp === 'bows' ? F.bowRangeCells : F.meleeRangeCells + 1) * F.unit
        const du = q.u - tq.u, dv = q.v - tq.v
        attacking = cur.end === null && du * du + dv * dv <= range * range
      }
      if (du0 !== 0) fx.face.set(q.id, du0 > 0 ? 1 : -1)
      else if (tq !== undefined && tq.men > 0 && attacking) fx.face.set(q.id, tq.u >= q.u ? 1 : -1)
      const face = fx.face.get(q.id) ?? (side === 0 ? 1 : -1)
      const qu = pq === undefined ? q.u : mix(pq.u, q.u, alpha), qv = pq === undefined ? q.v : mix(pq.v, q.v, alpha)
      const strip = stripFor(art, q.grp, q.kind)
      // 줄어든 점은 쓰러진 병사로 남는다
      for (let k = n; k < was; k++) {
        const o = dotOffset(q.id, k)
        const x = unitsToPx(qu) + o.du * F.cellPx, y = unitsToPx(qv) + o.dv * F.cellPx
        fx.corpses.push({ x, y, side, flip: face === -1, strip, h: baseH, born: nowMs })
      }
      if (n === 0) return
      flagsAt.push(unitsToPx(qu), unitsToPx(qv) - baseH * 0.2, side, 0)
      const tqu = tq === undefined ? 0 : unitsToPx(tq.u), tqv = tq === undefined ? 0 : unitsToPx(tq.v)
      for (let k = 0; k < n; k++) {
        const o = dotOffset(q.id, k)
        const x = unitsToPx(qu) + o.du * F.cellPx, y = Math.min(world.h, Math.max(0, unitsToPx(qv) + o.dv * F.cellPx))
        if (!inView(view, x, y, pad)) continue
        const ph = dotPhase(q.id, k)
        const d = nextItem()
        d.kind = 0; d.x = x; d.y = y; d.strip = strip; d.side = side; d.flip = face === -1; d.h = baseH
        d.frame = pose(nowMs, ph, moving, attacking)
        drawn++
        if (attacking && q.grp === 'bows' && tq !== undefined && cur.end === null) {
          const cyc = F.arrowCycleMs, tt = (nowMs + ph * cyc) % cyc
          if (tt < F.arrowFlightMs) {
            const idx = Math.floor((nowMs + ph * cyc) / cyc), to = dotOffset(tq.id, (k + idx) % F.dotsPerSquadMax)
            arrows.push(x, y - baseH * 0.5, tqu + to.du * F.cellPx, tqv + to.dv * F.cellPx - baseH * 0.4, tt / F.arrowFlightMs)
          }
        }
      }
    })
  }
  // 쓰러진 병사: 오래된 것을 버리고 남은 것은 누운 칸(쓰러짐)으로 그리다 끝에서 옅어진다
  const cs = fx.corpses
  while (cs.length > F.corpseMax) cs.shift()
  let w = 0
  for (const c of cs) if (nowMs - c.born < F.corpseMs && nowMs >= c.born) cs[w++] = c
  cs.length = w
  for (const c of cs) {
    if (!inView(view, c.x, c.y, pad)) continue
    const age = (nowMs - c.born) / F.corpseMs
    const d = nextItem()
    d.kind = 1; d.x = c.x; d.y = c.y; d.strip = c.strip; d.side = c.side; d.flip = c.flip; d.h = c.h; d.frame = nowMs - c.born < F.hitFrameMs ? HIT : DOWN
    d.alpha = age < 0.6 ? 1 : Math.max(0, 1 - (age - 0.6) / 0.4)
  }
  // 장수
  for (const e of cur.heroes) {
    const pe = prev !== null ? prev.heroes.find(h => h.side === e.side) : undefined
    const hu = pe === undefined ? e.u : mix(pe.u, e.u, alpha), hv = pe === undefined ? e.v : mix(pe.v, e.v, alpha)
    const x = unitsToPx(hu), y = unitsToPx(hv)
    if (!inView(view, x, y, pad)) continue
    const mr = (F.meleeRangeCells + 1) * F.unit
    let fighting = false, faceU = e.side === 0 ? 1 : -1
    for (const q of cur.squads) {
      if (q.side === e.side || q.men <= 0) continue
      const du = q.u - e.u, dv = q.v - e.v
      if (du * du + dv * dv <= mr * mr) { fighting = true; faceU = du >= 0 ? 1 : -1; break }
    }
    const moved = pe !== undefined && (pe.u !== e.u || pe.v !== e.v)
    const d = nextItem()
    d.kind = 0; d.hero = true; d.x = x; d.y = y; d.strip = heroStrip(art, e.id, heroPick); d.side = e.side
    d.flip = (moved ? e.u < (pe?.u ?? e.u) : faceU < 0); d.h = baseH * F.heroScale / 100
    d.frame = e.stun > 0 ? DOWN : pose(nowMs, 0, moved, cur.end === null && fighting && e.stun === 0)
    drawn++
    flagsAt.push(x, y - d.h * 0.2, e.side, e.stun > 0 ? 2 : 1)
  }

  order.length = 0
  for (let i = 0; i < used; i++) order.push(pool[i]!)
  drawShadows(ctx, used, low)
  order.sort(byY)
  for (const d of order) drawItem(ctx, d)

  drawBanners(ctx, flagsAt, cam.zoom, baseH)

  // 화살: 낱낱의 짧은 선 (호를 그리며 난다)
  if (arrows.length > 0) {
    ctx.strokeStyle = ARROW_COLOR
    ctx.lineWidth = Math.max(1.2, 1.6 / cam.zoom)
    ctx.lineCap = 'round'
    ctx.beginPath()
    const len = F.arrowLenCells * F.cellPx, arc = F.arrowArcCells * F.cellPx
    for (let i = 0; i < arrows.length; i += 5) {
      const x0 = arrows[i]!, y0 = arrows[i + 1]!, x1 = arrows[i + 2]!, y1 = arrows[i + 3]!, t = arrows[i + 4]!
      const dist = Math.max(1, Math.abs(x1 - x0) + Math.abs(y1 - y0)), t0 = Math.max(0, t - len / dist)
      const px = (u: number): number => mix(x0, x1, u), py = (u: number): number => mix(y0, y1, u) - 4 * u * (1 - u) * arc
      ctx.moveTo(px(t0), py(t0)); ctx.lineTo(px(t), py(t))
    }
    ctx.stroke()
  }
  ctx.restore()
  return drawn
}
