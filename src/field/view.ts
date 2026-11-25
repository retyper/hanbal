/**
 * 전장 그리기: VModel(viewRead.ts)만 읽는다. sim 상태를 모른다 (규칙 2).
 * 판 좌표 = 칸 × P.field.cellPx. u = 가로 · v = 세로. 우리 편(0)은 오른쪽을 보고 적(1)은 왼쪽을 보는 것이 처음 방향이고,
 * 움직이면 가는 쪽을 본다 (물러나는 대는 뒤돌아 걷는다).
 * 점 · 쓰러진 병사 · 목책 말뚝은 세로(y) 차례로 늘어세워 앞의 것이 뒤의 것을 덮는다. 화살은 맨 위에 낱낱이 그린다.
 * 그리는 쪽 기억(쓰러진 병사 · 방향)은 이 파일 안에만 있고 sim 으로 안 나간다.
 */
import { P } from '../tune/params.ts'
import { fieldView, inView, type Cam, type Viewport } from './viewCamera.ts'
import { ATTACK0, ATTACK_N, DOWN, HIT, RUN_N, STAND0, STAND_N, WALK0, WALK_N, heroKey, heroStrip, pieceImg, holdStripFor, runStripFor, sheetOf, stripFor, type Art, type Strip } from './viewArt.ts'
import { dotPh, hash2 } from './viewDots.ts'
import { dotDied, dotsOf, offU, offV, peekDots, resetForm, rowCount, rowOfDot, stepDots } from './viewForm.ts'
import { FORM_HOLD, FORM_SCATTER, moraleOf } from './viewFxRead.ts'
import { drawDash, queueDash, resetDash } from './viewDash.ts'
import { FLAG_FALLEN, bracedAt, drawOmens, drawPops, noteOmens, flagTilt, ingestHits, kickOf, resetHit, scatterOf, sc, shake, shakeAt, viewClock } from './viewHit.ts'
import { computePairs, coolPress, notePush, dotMelee, drawParticles, flinchOf, isFront, maxFwdOf, minFwdOf, mo, noteLoss, partnerOf, resetMelee, spawn, swingChance, swings } from './viewMelee.ts'
import { drawTerrain } from './viewTerrain.ts'
import { TEAM_RGB } from './viewTint.ts'
import type { VLoss, VModel, VSquad } from './viewRead.ts'

const SIDE_COLOR = TEAM_RGB.map(c => `rgb(${c[0]},${c[1]},${c[2]})`) as readonly string[]
const GROUND_TILE_CELLS = 20
const GROUND_FALLBACK = '#5b7a3c'
const BACKDROP = '#10140d'
/** 방향 번호(0~15) → 보는 쪽(+u 1 · -u -1 · 위아래 0) */
const FACE_U: readonly number[] = [1, 1, 1, 1, 0, -1, -1, -1, -1, -1, -1, -1, 0, 1, 1, 1]
const GROUND_VEIL = '#8c7650'
const ARROW_COLOR = '#f4ead0'
const FULL_TURN = 6.2832
const STAKE_VARIANTS = 17

type Kind = 0 | 1 | 2 // 0 병사 · 1 쓰러진 병사 · 2 소품(목책 말뚝·문)
interface Item { y: number; x: number; kind: Kind; strip: Strip | null; frame: number; flip: boolean; side: 0 | 1; h: number; img: HTMLImageElement | null; alpha: number; hero: boolean; rot: number; lift: number }
const pool: Item[] = []
const order: Item[] = []
let used = 0

/** 프레임마다 새로 만들지 않는 작업 배열 */
const arrowBuf: number[] = [], flagBuf: number[] = [], mine: VModel['squads'] = []
const byY = (a: Item, b: Item): number => a.y - b.y
function nextItem(): Item {
  if (used === pool.length) pool.push({ y: 0, x: 0, kind: 0, strip: null, frame: 0, flip: false, side: 0, h: 0, img: null, alpha: 1, hero: false, rot: 0, lift: 0 })
  const d = pool[used++]!
  d.img = null; d.strip = null; d.alpha = 1; d.hero = false; d.rot = 0; d.lift = 0
  return d
}

/** born 이 앞날이면 아직 서 있다가 그때 맞음 칸 → 쓰러짐 칸으로 간다 (치는 쪽이 맞히는 순간에 맞춘다) · ph 는 서 있는 동안의 걸음 몫 */
interface Corpse { x: number; y: number; side: 0 | 1; flip: boolean; strip: Strip | null; h: number; born: number; ph: number; stained: boolean }
/** 대마다 점 자리(칸) 수와 쓰러진 자리 — 줄어들 점은 아무 데서나가 아니라 적과 맞닿은 쪽에서 고른다 */
interface Slots { N: number; dead: Set<number> }
/** 활이 쏜 한 대 — 맞는 점이 쓰러지는 순간(t0 + 나는 시간)에 닿는다 */
interface Shot { x0: number; y0: number; x1: number; y1: number; t0: number; side: 0 | 1 }
/** 그리는 쪽 기억 — 점 수가 줄면 쓰러진 병사를 남기고 대의 마지막 방향을 기억한다 */
const fx = { pushed: new Map<number, number>(), counts: new Map<number, number>(), menMax: new Map<number, number>(), face: new Map<number, 1 | -1>(), corpses: [] as Corpse[], tick: -1, slots: new Map<number, Slots>(), lastHit: new Map<number, { src: number; how: number }>(), shots: [] as Shot[], nowMs: 0, attackers: 0, routeAt: [-1, -1, -1, -1, -1, -1] as number[], dustAt: new Map<number, number>(), sparkAt: new Map<number, number>() }
const form0Hold = (q: VSquad): boolean => q.grp === 'front' && q.form === FORM_HOLD && q.flee !== 1
/** 시험용 읽기: 지금 쓰러진 점 수 · 쓰러지기를 기다리는(앞날 born) 점 수 · 이번 장에서 치는 모습으로 그린 점 수 */
export function fxStats(): { dead: number; pending: number; attackers: number; alive: number } {
  let dead = 0, alive = 0
  for (const sl of fx.slots.values()) { dead += sl.dead.size; alive += sl.N - sl.dead.size }
  return { dead, alive, pending: fx.corpses.filter(c => c.born > fx.nowMs).length, attackers: fx.attackers }
}
/** 새 판이 시작되면 부른다 */
export function resetFx(): void { fx.pushed.clear(); fx.counts.clear(); fx.menMax.clear(); fx.face.clear(); fx.corpses.length = 0; fx.tick = -1; fx.slots.clear(); fx.lastHit.clear(); fx.shots.length = 0; fx.routeAt.fill(-1); fx.dustAt.clear(); fx.sparkAt.clear(); resetForm(); resetMelee(); resetHit(); resetDash() }

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

/** 점 하나가 쓰러지는 순간을 정한다: 칼·부딪힘은 친 쪽 앞줄 병사의 맞히는 칸에 · 화살은 날아가 닿는 때에 · 그 밖은 곧바로. 지연(ms)을 돌려준다 */
function strikeDelay(foe: VSquad, vx: number, vy: number, how: number, nowMs: number): number {
  const F = P.field, cp = F.cellPx
  const sl = fx.slots.get(foe.id)
  const fx0 = unitsToPx(foe.u), fy0 = unitsToPx(foe.v)
  const dir = fx0 <= vx ? 1 : -1
  let bk = -1, bd = Infinity
  const n = sl === undefined ? 0 : sl.N
  for (let k = 0; k < n; k++) {
    if (sl!.dead.has(k)) continue
    if (how !== 1 && offU(foe.id, k) * dir < 0) continue
    const dx = fx0 + offU(foe.id, k) * cp - vx, dy = fy0 + offV(foe.id, k) * cp - vy, d = dx * dx + dy * dy
    if (d < bd) { bd = d; bk = k }
  }
  if (bk < 0) return 0
  if (how === 1) {
    fx.shots.push({ x0: fx0 + offU(foe.id, bk) * cp, y0: fy0 + offV(foe.id, bk) * cp - F.soldierCells * cp * 0.5, x1: vx, y1: vy - F.soldierCells * cp * 0.4, t0: nowMs, side: foe.side })
    return F.arrowFlightMs
  }
  if (how !== 0 && how !== 4) return 0
  // 치는 점이 칼을 내는 휘두름 칸의 맞히는 칸에 맞춘다 (칼을 안 내는 칸은 건너뛴다)
  const x0 = nowMs / F.animAttackMs + dotPh(foe.id, bk) * ATTACK_N, chance = swingChance(foe.id)
  let cyc = Math.floor(x0 / ATTACK_N)
  if (cyc * ATTACK_N + F.attackHitFrame + 1 <= x0) cyc++
  for (let i = 0; i < 6 && !swings(foe.id, bk, cyc, chance); i++) cyc++
  return Math.max(0, (cyc * ATTACK_N + F.attackHitFrame - x0) * F.animAttackMs)
}

/** 점 수를 판의 사람 수에 맞춘다: 늘면 쓰러진 자리부터 살리고 · 줄면 적과 맞닿은 쪽 점이 쓰러진다 (쓰러짐은 strikeDelay 만큼 뒤) */
function settleDots(q: VSquad, n: number, N0: number, cur: VModel, nowMs: number, qu: number, qv: number, strip: Strip | null, flip: boolean, baseH: number, worldH: number): Slots {
  let sl = fx.slots.get(q.id)
  if (sl === undefined) { sl = { N: N0, dead: new Set() }; fx.slots.set(q.id, sl) }
  let alive = sl.N - sl.dead.size
  while (alive < n && sl.dead.size > 0) { sl.dead.delete(sl.dead.values().next().value as number); alive++ }
  if (alive <= n) return sl
  const hit = fx.lastHit.get(q.id)
  const src = hit !== undefined && hit.src >= 0 ? cur.squads[hit.src] : undefined
  const foe = src !== undefined && src.men > 0 ? src : q.aim >= 0 ? cur.squads[q.aim] : undefined
  const dirU = foe === undefined ? (flip ? -1 : 1) : foe.u >= q.u ? 1 : -1
  const cp = P.field.cellPx
  for (; alive > n; alive--) {
    let bk = -1, bv = -Infinity
    for (let k = 0; k < sl.N; k++) { if (sl.dead.has(k)) continue; const v = offU(q.id, k) * dirU; if (v > bv) { bv = v; bk = k } }
    if (bk < 0) break
    sl.dead.add(bk)
    const x = unitsToPx(qu) + offU(q.id, bk) * cp, y = Math.min(worldH, Math.max(0, unitsToPx(qv) + offV(q.id, bk) * cp))
    const pd = peekDots(q.id)
    if (pd !== undefined) dotDied(pd, bk, nowMs)
    const delay = hit !== undefined && foe !== undefined && foe.men > 0 ? strikeDelay(foe, x, y, hit.how, nowMs) : 0
    fx.corpses.push({ x, y, side: q.side, flip, strip, h: baseH, born: nowMs + delay, ph: dotPh(q.id, bk), stained: false })
  }
  return sl
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
function drawBanners(ctx: CanvasRenderingContext2D, at: readonly number[], zoom: number, flagH: number): void {
  const F = P.field, gm = F.flagGroupPermille / 1000
  if (at.length === 0) return
  ctx.lineJoin = 'round'
  ctx.strokeStyle = ARROW_COLOR
  ctx.lineWidth = Math.max(1, 1.4 / zoom)
  /** 한 깃: 장대 밑 (x, by) · 기울기 tilt 만큼 꼭대기가 옆으로 간다 · 떨어진 깃(FLAG_FALLEN)은 땅에 누운 장대 */
  const geom = (i: number): { bx: number; by: number; tx: number; ty: number; sz: number; hero: boolean; fall: boolean } => {
    const kd = at[i + 3]!, hero = kd > 0, grp = kd === 3, tilt = at[i + 4]!
    const baseH = grp ? flagH * gm : flagH
    const sz = Math.max(baseH * (hero ? 0.4 : 0.3), (hero ? F.heroFlagMinPx : F.flagMinPx) * (grp ? gm : 1) / zoom)
    const y = at[i + 1]!, bx = at[i]!, by = y - baseH * (hero ? 1.5 : 1.1)
    const len = baseH * (hero ? 1.9 : 1.5) + sz * 1.2 - baseH * (hero ? 1.5 : 1.1)
    const fall = Math.abs(tilt) >= FLAG_FALLEN - 0.5
    const a = fall ? (tilt < 0 ? -1.35 : 1.35) : tilt
    return { bx, by: fall ? y - baseH * 0.15 : by, tx: bx + Math.sin(a) * len, ty: (fall ? y - baseH * 0.15 : by) - Math.cos(a) * len, sz, hero, fall }
  }
  // 장대: 한 경로
  ctx.beginPath()
  for (let i = 0; i < at.length; i += 5) { const g = geom(i); ctx.moveTo(g.bx, g.by); ctx.lineTo(g.tx, g.ty) }
  ctx.stroke()
  // 깃: 편마다 채우는 것(성한 것) 한 경로 · 속 빈 것(쓰러진 장수) 한 경로 · 떨어진 깃은 옅게 따로
  for (const side of [0, 1] as const) {
    for (const mode of [0, 1, 2]) {
      ctx.beginPath()
      let any = false
      for (let i = 0; i < at.length; i += 5) {
        if (at[i + 2] !== side) continue
        const g = geom(i), m = at[i + 3] === 2 ? 1 : g.fall ? 2 : 0
        if (m !== mode) continue
        const x = g.tx, top = g.ty, sz = g.sz
        any = true
        ctx.moveTo(x, top)
        if (side === 0) { ctx.lineTo(x + sz, top); ctx.lineTo(x + sz, top + sz * 0.8); ctx.lineTo(x, top + sz * 0.8) }
        else { ctx.lineTo(x + sz, top); ctx.lineTo(x + sz * 0.62, top + sz * 0.4); ctx.lineTo(x + sz, top + sz * 0.8); ctx.lineTo(x, top + sz * 0.8) }
        ctx.closePath()
      }
      if (!any) continue
      if (mode === 2) ctx.globalAlpha = 0.55
      if (mode !== 1) { ctx.fillStyle = SIDE_COLOR[side]!; ctx.fill() }
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }
}

/** 기병이 도는 길: 낱낱 점선 (길이 새로 정해진 뒤 routeMs 동안 · 끝에서 옅어져 걷힌다) */
function drawRoutes(ctx: CanvasRenderingContext2D, m: VModel, nowMs: number, zoom: number): void {
  const F = P.field, step = F.routeDashCells * F.cellPx, r = Math.max(1.6, 2.2 / zoom)
  for (let i = 0; i < m.route.length && i < 6; i++) {
    const rt = m.route[i]!
    if (rt.length < 2) { fx.routeAt[i] = -1; continue }
    if (fx.routeAt[i]! < 0) fx.routeAt[i] = nowMs
    const age = nowMs - fx.routeAt[i]!
    if (age > F.routeMs) continue
    ctx.globalAlpha = Math.min(0.85, (F.routeMs - age) / (F.routeMs * 0.25) * 0.85)
    ctx.fillStyle = SIDE_COLOR[i < 3 ? 0 : 1]!
    ctx.beginPath()
    let carry = 0
    for (let j = 1; j < rt.length; j++) {
      const ax = unitsToPx(rt[j - 1]!.u), ay = unitsToPx(rt[j - 1]!.v), bx = unitsToPx(rt[j]!.u), by = unitsToPx(rt[j]!.v)
      const len = Math.hypot(bx - ax, by - ay)
      for (let d = carry; d < len; d += step) { const x = ax + (bx - ax) * d / len, y = ay + (by - ay) * d / len; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, FULL_TURN) }
      carry = ((carry - len) % step + step) % step
    }
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/**
 * 무리 깃: 편마다 무리(앞줄·활·기병)마다 하나 — 무리 가운데에서 제 진영 쪽으로 뒤에 선다.
 * 깃 꺾임·기운 채·떨어짐은 이 깃에 건다 (사기는 무리의 사람 수로 가중 평균 · 꺾임은 무리 안 대 가운데 가장 큰 것)
 */
function addGroupFlags(m: VModel, at: number[], nowMs: number): void {
  const F = P.field, GRPS = ['front', 'bows', 'horse']
  for (const side of [0, 1] as const) {
    const enemyDir = side === 0 ? m.face : -m.face
    for (const grp of GRPS) {
      let men = 0, cu = 0, cv = 0, mor = 0
      for (const q of m.squads) if (q.side === side && q.grp === grp && q.men > 0) { men += q.men; cu += q.u * q.men; cv += q.v * q.men; mor += moraleOf(q) * q.men }
      if (men === 0) continue
      mor /= men
      let tilt = 0
      for (const q of m.squads) if (q.side === side && q.grp === grp && q.men > 0) { const v = flagTilt(q.id, mor, enemyDir, nowMs, P.realm.tacBreakMorale); if (Math.abs(v) > Math.abs(tilt)) tilt = v }
      at.push(unitsToPx(cu / men) - enemyDir * F.flagBackCells * F.cellPx, unitsToPx(cv / men), side, 3, tilt)
    }
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
    ctx.globalAlpha = 0.95; ctx.strokeStyle = SIDE_COLOR[d.side]!; ctx.lineWidth = Math.max(P.field.heroRingPx, d.h * 0.04); ctx.stroke()
    ctx.globalAlpha = 1
  }
  const s = d.strip
  if (s === null) return
  const sc = d.h / s.bodyPx, dw = s.cw * sc, dh = s.ch * sc
  const sheet = sheetOf(s, d.hero ? -1 : d.side, d.flip)
  if (d.alpha < 1) ctx.globalAlpha = d.alpha
  const sxp = (d.frame % s.cols) * s.cw, syp = Math.floor(d.frame / s.cols) * s.ch
  if (d.rot !== 0) {
    // 몸 숙임: 발 자리를 축으로 돌린다
    ctx.save(); ctx.translate(d.x, d.y - d.lift); ctx.rotate(d.rot)
    ctx.drawImage(sheet, sxp, syp, s.cw, s.ch, -dw / 2, -s.feet * sc, dw, dh)
    ctx.restore()
  } else ctx.drawImage(sheet, sxp, syp, s.cw, s.ch, d.x - dw / 2, d.y - d.lift - s.feet * sc, dw, dh)
  if (d.alpha < 1) ctx.globalAlpha = 1
}

/** 병사 그림자: 편마다 한 경로로 모아 한 번에 칠한다 (점마다 칠하면 호출이 점 수에 그대로 비례한다) */
function drawShadows(ctx: CanvasRenderingContext2D, count: number, low: boolean, zoom: number, baseH: number): void {
  // 아주 멀리서는(타원 짧은 반지름이 화면 1.5px 아래) 타원 대신 작은 네모로 — 모양이 안 보이는 크기라 같은 점으로 읽히고 훨씬 싸다
  const tiny = baseH * 0.08 * zoom < P.field.shadowRectPx
  for (const side of [0, 1] as const) {
    ctx.beginPath()
    let any = false
    for (let i = 0; i < count; i++) {
      const d = pool[i]!
      if (d.kind !== 0 || d.hero || d.side !== side) continue
      const rx = d.h * 0.26
      if (tiny) ctx.rect(d.x - rx, d.y - d.h * 0.08, rx * 2, d.h * 0.16)
      else { ctx.moveTo(d.x + rx, d.y); ctx.ellipse(d.x, d.y, rx, d.h * 0.08, 0, 0, FULL_TURN) }
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
export function drawField(ctx: CanvasRenderingContext2D, vp: Viewport, cam: Cam, cur: VModel, prev: VModel | null, alpha: number, realMs: number, art: Art, low: boolean, heroPick: string | null = null, hits: readonly VLoss[] = cur.loss): number {
  const F = P.field
  if (cur.tick < fx.tick) resetFx()
  const nowMs = viewClock(realMs)
  const tickNew = cur.tick !== fx.tick
  fx.tick = cur.tick
  fx.nowMs = nowMs; fx.attackers = 0
  for (const h of hits) { fx.lastHit.set(h.to, { src: h.from, how: h.how }); noteLoss(h, nowMs) }
  if (tickNew) { coolPress(1000 / F.hz); ingestHits(cur, hits, nowMs, realMs); noteOmens(cur, nowMs) }
  shakeAt(realMs)
  const world = worldSize(cur)
  const view = fieldView(cam, vp)
  ctx.save()
  ctx.fillStyle = BACKDROP
  ctx.fillRect(0, 0, vp.w, vp.h)
  ctx.translate(vp.w / 2 + shake.x, vp.h / 2 + shake.y)
  ctx.scale(cam.zoom, cam.zoom)
  ctx.translate(-cam.x, -cam.y)
  drawGround(ctx, art, view)
  ctx.fillStyle = GROUND_VEIL; ctx.globalAlpha = F.groundVeilPct / 100
  ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top)
  ctx.globalAlpha = 1
  drawTerrain(ctx, cur, world.w, world.h)

  used = 0
  addProps(cur, art, view)
  const baseH = F.soldierCells * F.cellPx, flagH = F.flagBaseCells * F.cellPx
  const pad = baseH * 3
  const lowShare = low ? F.lowDotsShare : 1000
  const arrows = arrowBuf; arrows.length = 0
  /** 대 깃 자리 (x · y · 편 · 장수면 1) — 끝에서 한꺼번에 그린다 */
  const flagsAt = flagBuf; flagsAt.length = 0
  let drawn = 0
  for (const side of [0, 1] as const) {
    mine.length = 0
    for (const q of cur.squads) if (q.side === side) mine.push(q)
    for (let i = 0; i < mine.length; i++) {
      const q = mine[i]!
      // 대마다 그림 칸이 고정이다 (사람 수와 묶지 않는다) — 잃은 비율만큼 뺀다
      const N0 = Math.max(1, Math.round((q.grp === 'front' ? F.slotsFront : q.grp === 'bows' ? F.slotsBows : F.slotsHorse) * lowShare / 1000))
      const mm = Math.max(fx.menMax.get(q.id) ?? 0, q.men)
      fx.menMax.set(q.id, mm)
      const n = q.men <= 0 ? 0 : Math.min(N0, Math.max(1, Math.ceil(N0 * q.men / mm)))
      fx.counts.set(q.id, n)
      const pq = prev !== null ? prev.squads[q.id] : undefined
      const du0 = pq === undefined ? 0 : q.u - pq.u
      const moving = pq !== undefined && (du0 !== 0 || pq.v !== q.v)
      // 싸우는 중 = 엔진이 실제로 치고 있는 상대(aim)가 있다 — 손으로 몰았든 알아서든 같다 (target 은 가려는 적이라 손으로 몬 대는 -1)
      const aq = q.aim >= 0 ? cur.squads[q.aim] : undefined
      const fighting = cur.end === null && aq !== undefined && aq.men > 0
      if (tickNew) { if (q.pushed > (fx.pushed.get(q.id) ?? q.pushed)) notePush(q.id, nowMs); fx.pushed.set(q.id, q.pushed) }
      // 보는 쪽은 엔진의 향(16방위)이 정한다 (옆을 맞은 대는 옆을 보고 · 달아나는 대는 등을 보인다) · 위아래 향이면 움직임·싸움 상대로
      const fu = FACE_U[q.face] ?? 0
      if (fu !== 0) fx.face.set(q.id, fu as 1 | -1)
      else if (du0 !== 0) fx.face.set(q.id, du0 > 0 ? 1 : -1)
      else if (fighting) fx.face.set(q.id, aq!.u >= q.u ? 1 : -1)
      const face = fx.face.get(q.id) ?? (side === 0 ? 1 : -1)
      const qu = pq === undefined ? q.u : mix(pq.u, q.u, alpha), qv = pq === undefined ? q.v : mix(pq.v, q.v, alpha)
      const strip = stripFor(art, q.grp, q.kind)
      const running = cur.end === null && moving && (q.ran > 0 || q.flee === 1)
      const holdStrip = form0Hold(q) ? holdStripFor(art, q.grp, q.kind) : null
      const braced = holdStrip !== null && bracedAt(q.id, nowMs)
      const runStrip = running ? runStripFor(art, q.grp, q.kind) : null
      const sH = q.grp === 'horse' ? baseH * F.horseBodyPermille / 1000 : baseH
      const sl = settleDots(q, n, N0, cur, nowMs, qu, qv, strip, face === -1, sH, world.h)
      if (n === 0) continue
      const form = q.flee === 1 ? FORM_SCATTER : q.grp === 'front' ? q.form : 0
      const dd = dotsOf(q.id, sl.N, form, face, nowMs, sl.dead, q.grp === 'horse' ? F.horseSpaceMul : q.grp === 'bows' ? F.bowsSpaceMul : 1, q.grp === 'front' ? F.depthFront : q.grp === 'bows' ? F.depthBows : F.depthHorse, q.bw / F.unit, q.bd / F.unit)
      const kickCells = kickOf(q.id, nowMs)
      if (running && nowMs - (fx.dustAt.get(-1 - q.id) ?? -1e9) > F.runDustMs) {
        fx.dustAt.set(-1 - q.id, nowMs)
        for (let j = 0; j < 2; j++) {
          const hh = hash2(q.id * 13 + j, Math.floor(nowMs / F.runDustMs)), kk = hh % dd.N
          if (sl.dead.has(kk)) continue
          spawn(0, unitsToPx(qu) + dd.cu[kk]! * F.cellPx - face * F.cellPx * 0.4, unitsToPx(qv) + dd.cv[kk]! * F.cellPx, -face * (8 + hh % 10), -4 - hh % 6, nowMs, F.runDustLife, F.cellPx * 0.2)
        }
      }
      stepDots(dd, q.id, sl.dead, nowMs)
      const tqu = aq === undefined ? 0 : unitsToPx(aq.u), tqv = aq === undefined ? 0 : unitsToPx(aq.v)
      const od = aq === undefined ? undefined : peekDots(aq.id), osl = aq === undefined ? undefined : fx.slots.get(aq.id)
      const melee = fighting && q.grp !== 'bows'
      let chance = 0, flinch = 0, mor = 1, mf = 0, mn = 0
      if (melee) {
        if (tickNew) computePairs(q.id, dd, sl.dead, face, od, osl?.dead)
        chance = swingChance(q.id); flinch = flinchOf(q.id, nowMs); mor = moraleOf(q)
        mf = maxFwdOf(dd, sl.dead, face); mn = minFwdOf(dd, sl.dead, face)
        if (q.id % 2 === side && nowMs - (fx.dustAt.get(q.id) ?? -1e9) > F.dustEveryMs) {
          fx.dustAt.set(q.id, nowMs)
          const lines = Math.max(1, Math.round(dd.N / F.dustLineCells))
          for (let j = 0; j < lines; j++) {
            const hh = hash2(q.id * 7 + j, Math.floor(nowMs / F.dustEveryMs))
            const kk = hh % dd.N
            if (sl.dead.has(kk)) continue
            const px = unitsToPx(qu) + dd.cu[kk]! * F.cellPx + face * F.cellPx * 0.6
            spawn(0, px, unitsToPx(qv) + dd.cv[kk]! * F.cellPx, face * (4 + hh % 7), -6 - hh % 9, nowMs, F.dustMs, F.cellPx * 0.14)
          }
        }
      }
      for (let k = 0; k < sl.N; k++) {
        if (sl.dead.has(k)) continue
        const x = unitsToPx(qu) + dd.cu[k]! * F.cellPx, y = Math.min(world.h, Math.max(0, unitsToPx(qv) + dd.cv[k]! * F.cellPx))
        if (!inView(view, x, y, pad)) continue
        const ph = dotPh(q.id, k)
        const d = nextItem()
        // 적과 닿는 쪽 줄의 병사가 치고 뒷줄은 서 있는다 (활은 모두 쏜다)
        const row = rowOfDot(dd, k)
        const front = q.grp === 'bows' || (melee ? isFront(dd, k, face, mf) : row >= 0 ? row === 0 : dd.cu[k]! * face >= 0)
        const gathering = dd.gap[k]! > F.formGatherCells
        let ox = 0, oy = 0, swing = fighting && front, flipDot = face === -1
        if (melee) {
          const pk = partnerOf(q.id, k)
          const rear = row >= 0 ? row >= 1 && row === rowCount(dd) - 1 : dd.cu[k]! * face <= mn + F.frontBandCells
          dotMelee(q.id, k, ph, face, front, rear && !front, true, mor, nowMs, x, y, pk >= 0 && aq !== undefined ? tqu + offU(aq.id, pk) * F.cellPx : NaN, pk >= 0 && aq !== undefined ? tqv + offV(aq.id, pk) * F.cellPx : NaN, chance, flinch)
          ox = mo.x; oy = mo.y; swing = mo.swing
          if (mo.turn) flipDot = !flipDot
          if (mo.hitFrame && hash2(q.id * 3 + k, Math.floor(nowMs / F.animAttackMs)) % F.sparkEveryHits === 0 && aq !== undefined && nowMs - (fx.sparkAt.get(q.id * 64 + k) ?? -1e9) > F.animAttackMs * ATTACK_N * 0.8) {
            fx.sparkAt.set(q.id * 64 + k, nowMs)
            const sx0 = x + face * F.cellPx * 0.5, hh = hash2(k, Math.floor(nowMs))
            for (let j = 0; j < 2; j++) spawn(1, sx0, y - baseH * 0.45, face * 40 + (hh % 60) - 30, -60 - ((hh >> 4) % 40) + j * 30, nowMs, F.sparkMs, 1)
          }
        }
        scatterOf(q.id, k, nowMs)
        ox += (kickCells * (front ? 1 : 0.6) + sc.x) * F.cellPx
        if (sc.turn) flipDot = !flipDot
        d.kind = 0; d.x = x + ox; d.y = y + oy; d.strip = strip; d.side = side; d.flip = flipDot; d.h = sH
        d.frame = pose(nowMs, ph, moving || gathering || (melee && mo.back === 1), fighting && front && swing)
        if (running && !fighting) {
          if (runStrip !== null) { d.strip = runStrip; d.frame = Math.floor(nowMs / F.runCellMs + ph * RUN_N) % RUN_N }
          else {
            // 달리기 띠가 아직 없으면: 걷기 칸을 빠르게 + 몸 숙임 + 큰 출렁임
            d.frame = WALK0 + Math.floor(nowMs / (F.animWalkMs / F.runWalkMul) + ph * WALK_N) % WALK_N
            d.rot = (face === -1 ? -1 : 1) * F.runLeanDeg * Math.PI / 180
            d.lift = Math.abs(Math.sin(nowMs / (F.animWalkMs / F.runWalkMul) * 0.5 + ph * 6.28)) * F.runBobPx
          }
        }
        // 방진: 창을 앞으로 내민 채(공격 첫 칸 고정) 몸을 살짝 낮춘다
        if (form === FORM_HOLD && !gathering && !fighting) {
          // 방진: 맨 앞 열은 버팀 칸(부딪히면 더 낮춰) · 뒤 열은 서기 칸에 창을 세운 채
          if (row === 0) { if (holdStrip !== null) { d.strip = holdStrip; d.frame = braced ? 1 : 0 } else d.frame = ATTACK0 }
          d.h = sH * F.holdDropPermille / 1000
        }
        if (fighting && front && swing) fx.attackers++
        drawn++
        if (fighting && q.grp === 'bows' && aq !== undefined) {
          const cyc = F.arrowCycleMs, tt = (nowMs + ph * cyc) % cyc
          if (tt < F.arrowFlightMs) {
            const idx = Math.floor((nowMs + ph * cyc) / cyc), tk = (k + idx) % F.dotsPerSquadMax
            arrows.push(x, y - baseH * 0.5, tqu + offU(aq.id, tk) * F.cellPx, tqv + offV(aq.id, tk) * F.cellPx - baseH * 0.4, tt / F.arrowFlightMs, side)
          }
        }
      }
    }
  }
  // 점 하나가 쓰러지는 순간에 닿는 화살
  let ws = 0
  for (const sh of fx.shots) {
    const t = (nowMs - sh.t0) / F.arrowFlightMs
    if (t >= 1) continue
    fx.shots[ws++] = sh
    if (t >= 0) arrows.push(sh.x0, sh.y0, sh.x1, sh.y1, t, sh.side)
  }
  fx.shots.length = ws
  // 쓰러진 병사: 오래된 것을 버리고 남은 것은 누운 칸(쓰러짐)으로 그리다 끝에서 옅어진다
  const cs = fx.corpses
  while (cs.length > F.stainMax) cs.shift()
  let w = 0
  for (const c of cs) if (nowMs - c.born < F.stainMs) cs[w++] = c
  cs.length = w
  for (const c of cs) {
    if (!inView(view, c.x, c.y, pad)) continue
    const age = (nowMs - c.born) / F.corpseMs
    const lyingMs = nowMs - c.born
    const d = nextItem()
    if (age < 0) { d.kind = 0; d.x = c.x; d.y = c.y; d.strip = c.strip; d.side = c.side; d.flip = c.flip; d.h = c.h; d.frame = pose(nowMs, c.ph, false, false); continue }
    d.kind = 1; d.x = c.x; d.y = c.y; d.strip = c.strip; d.side = c.side; d.flip = c.flip; d.h = c.h; d.frame = nowMs - c.born < F.hitFrameMs ? HIT : DOWN
    // 쓰러진 병사는 그림 그대로 눕고 어둡게(옅게) 남다가 끝에서 사라진다 (자국)
    d.alpha = lyingMs < F.corpseMs ? 1 : lyingMs < F.stainMs * 0.85 ? Math.max(0.5, 1 - (lyingMs - F.corpseMs) / 600) : Math.max(0, 0.5 * (F.stainMs - lyingMs) / (F.stainMs * 0.15))
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
    if (e.dash > 0 && e.stun === 0) {
      const hk = heroKey(art, e.id, heroPick), me = hk === null ? undefined : art.manifest?.[hk]
      if (hk !== null && me !== undefined && queueDash(art.base, hk.slice(4), x, y, d.flip, d.h, me.bodyPx, nowMs)) { used--; flagsAt.push(x, y - d.h * 0.2, e.side, 1, 0); continue }
    }
    flagsAt.push(x, y - d.h * 0.2, e.side, e.stun > 0 ? 2 : 1, 0)
  }

  order.length = 0
  for (let i = 0; i < used; i++) order.push(pool[i]!)
  drawShadows(ctx, used, low, cam.zoom, baseH)
  order.sort(byY)
  for (const d of order) if (!d.hero) drawItem(ctx, d)
  for (const d of order) if (d.hero) drawItem(ctx, d)
  drawDash(ctx, nowMs)

  drawOmens(ctx, nowMs, cam.zoom)
  drawRoutes(ctx, cur, nowMs, cam.zoom)
  addGroupFlags(cur, flagsAt, nowMs)
  drawParticles(ctx, nowMs, cam.zoom)
  drawBanners(ctx, flagsAt, cam.zoom, flagH)
  drawPops(ctx, nowMs, cam.zoom, flagH)

  // 화살: 낱낱의 짧은 선 (호를 그리며 난다) — 몸은 크림색 한 경로, 꼬리 3분의 1 은 쏜 편 색으로 편마다 한 경로 (누구 화살인지 읽히게)
  if (arrows.length > 0) {
    ctx.lineWidth = Math.max(1.2, 1.2 / cam.zoom)
    ctx.lineCap = 'round'
    const len = F.arrowLenCells * F.cellPx, arc = F.arrowArcCells * F.cellPx
    for (let pass = 0; pass < 3; pass++) {
      if (pass === 0) ctx.strokeStyle = ARROW_COLOR
      else ctx.strokeStyle = SIDE_COLOR[pass - 1]!
      ctx.beginPath()
      for (let i = 0; i < arrows.length; i += 6) {
        if (pass > 0 && arrows[i + 5] !== pass - 1) continue
        const x0 = arrows[i]!, y0 = arrows[i + 1]!, x1 = arrows[i + 2]!, y1 = arrows[i + 3]!, t = arrows[i + 4]!
        const dist = Math.max(1, Math.abs(x1 - x0) + Math.abs(y1 - y0)), t0 = Math.max(0, t - len / dist)
        const tm = t0 + (t - t0) / 3 // 꼬리 쪽 3분의 1
        const ua = pass === 0 ? tm : t0, ub = pass === 0 ? t : tm
        ctx.moveTo(mix(x0, x1, ua), mix(y0, y1, ua) - 4 * ua * (1 - ua) * arc)
        ctx.lineTo(mix(x0, x1, ub), mix(y0, y1, ub) - 4 * ub * (1 - ub) * arc)
      }
      ctx.stroke()
    }
  }
  ctx.restore()
  return drawn
}
