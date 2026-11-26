/**
 * 맞은 일이 글 없이 보인다 (51 §4 · §8) — 그리는 쪽 기억 · sim 으로 안 나간다.
 *  - 깃이 꺾임(상성·옆치기·비기에 맞은 무리 · 막힌 쪽 깃은 뒤로 젖혀짐) · 사기 70% 아래면 기운 채 · 55% 아래면 깃이 떨어짐
 *  - 깃에서 사기 숫자가 튐(「−18」 · 상성이 맞았을 때만 금빛) · 맞은 쪽 점이 뒤로 흩어지고 몇이 돌아섬
 *  - 돌격의 쾅: 그리는 시계 멈칫 · 화면 흔들림 · 맞은 줄이 뒤로 튕김 · 막히면 친 쪽이 튕겨 남 (무리마다 첫 접촉에만)
 * 사건은 틱이 바뀔 때 한 번만 읽는다. 읽는 곳: VModel.events(impact) · loss(how 4 부딪힘) · 있으면 flankHit·artHit.
 */
import { P } from '../tune/params.ts'
import { hash2 } from './viewDots.ts'
import { HIT_BLOCKED, HIT_GOOD, LOSS_IMPACT, eventsOf, moraleOf } from './viewFxRead.ts'
import { spawn } from './viewMelee.ts'
import type { VLoss, VModel, VSquad } from './viewRead.ts'

/** 이 값이면 깃이 떨어진 것 */
export const FLAG_FALLEN = 9
const DEG = Math.PI / 180

interface Tilt { at: number; amp: number; sgn: number }
interface Scat { at: number; dir: number }
interface Kick { at: number; dir: number; cells: number }
/** plus = 되오른 사기 (「+N」 · 다시 섬) */
export interface Pop { x: number; y: number; at: number; n: number; gold: boolean; plus?: boolean }
interface Pend { at: number; id: number; base: number; gold: boolean }

const tilts = new Map<number, Tilt>()
const scats = new Map<number, Scat>()
const kicks = new Map<number, Kick>()
const lastImpact = new Map<number, number>()
const braces = new Map<number, number>()
const pends: Pend[] = []
export const pops: Pop[] = []
export const clockSt = { stopUntil: 0, last: -1, clk: 0, shAt: -1e9, shPx: 0, shMs: 1 }

export function resetHit(): void {
  braces.clear(); raised.clear(); rises.clear(); knocks.clear(); bashAt[0] = bashAt[1] = -1e9; tilts.clear(); scats.clear(); kicks.clear(); omens.length = 0; lastImpact.clear(); pends.length = 0; pops.length = 0
  clockSt.stopUntil = 0; clockSt.last = -1; clockSt.clk = 0; clockSt.shAt = -1e9
}

/** 그리는 시계: 멈칫(stopUntil) 동안은 가지 않는다. 실제 시각이 거꾸로 가면(새 판·재기) 다시 맞춘다 */
export function viewClock(real: number): number {
  const c = clockSt
  if (c.last < 0 || real < c.last) { c.clk = real; c.last = real; return real }
  const dt = real - c.last
  c.last = real
  if (real < c.stopUntil) return c.clk
  c.clk += dt
  return c.clk
}

/** 화면 흔들림 어긋남 (화면 px) — 흔들림이 없으면 0 */
export const shake = { x: 0, y: 0 }
export function shakeAt(real: number): void {
  const c = clockSt, t = real - c.shAt
  if (t < 0 || t >= c.shMs || c.shPx <= 0) { shake.x = 0; shake.y = 0; return }
  const a = c.shPx * (1 - t / c.shMs), n = Math.floor(t / 22)
  shake.x = a * (((hash2(91, n) % 2001) - 1000) / 1000)
  shake.y = a * (((hash2(93, n) % 2001) - 1000) / 1000) * 0.7
}

const pending: { att: number; vic: number; how: number; d2: number }[] = []

/** 부딪힘 하나를 모은다 (같은 틱에 여럿이면 끝에서 장수에게 가장 가까운 한 곳만 흔든다) */
function noteImpact(cur: VModel, att: number, vic: number, how: number, hero: { u: number; v: number } | undefined, clk: number): void {
  const a = cur.squads[att], e = cur.squads[vic]
  if (a === undefined || e === undefined || a.grp === 'bows') return
  const last = lastImpact.get(att)
  if (last !== undefined && clk - last < P.field.impactRepeatMs) return
  lastImpact.set(att, clk)
  const du = hero === undefined ? 0 : (a.u + e.u) / 2 - hero.u, dv = hero === undefined ? 0 : (a.v + e.v) / 2 - hero.v
  pending.push({ att, vic, how, d2: du * du + dv * dv })
}

function addTilt(id: number, amp: number, sgn: number, clk: number): void { tilts.set(id, { at: clk, amp, sgn }) }
function pend(id: number, q: VSquad, clk: number, gold: boolean): void {
  if (pends.length < 16) pends.push({ at: clk, id, base: q.morale0 > 0 ? q.morale / q.morale0 : 1, gold })
}

/** 한 틱 한 번: 사건 줄과 이번에 쌓인 깎임을 읽어 효과를 건다 */
export function ingestHits(cur: VModel, hits: readonly VLoss[], clk: number, real: number, prev: VModel | null = null): void {
  const F = P.field
  const hero = cur.heroes.find(h => h.side === 0)
  pending.length = 0
  for (const e of eventsOf(cur)) {
    if (e.kind === 'impact') {
      const a = cur.squads[e.id]
      const vic = e.to >= 0 ? e.to : a === undefined ? -1 : a.aim
      noteImpact(cur, e.id, vic, e.how, hero, clk)
    } else if (e.kind === 'flankHit' && e.to >= 0) {
      const v = cur.squads[e.to], a = cur.squads[e.id]
      if (v !== undefined && a !== undefined) good(cur, a, v, clk)
    } else if (e.kind === 'stand') {
      noteStand(cur, e.side, e.u, e.v, e.r, clk)
    } else if (e.kind === 'regroup') {
      noteRegroup(cur, e.id, clk)
    } else if (e.kind === 'heroBash') {
      noteBash(cur, e.side, e.to, e.u, e.v, clk, real)
    } else if (e.kind === 'heroDown') {
      noteHeroDown(cur, prev, e.side, e.u, e.v, clk, real)
    } else if (e.kind === 'artHit' && e.to >= 0) {
      const v = cur.squads[e.to]
      if (v !== undefined) { good(cur, undefined, v, clk); const sh = cur.heroes.find(x => x.side === e.side); kicks.set(e.to, { at: clk, dir: sh !== undefined && v.u < sh.u ? -1 : 1, cells: F.kickFrontCells }); pops.push({ at: clk, n: Math.round(e.n / 10), gold: true, ...flagPos(v) }); if (pops.length > F.moralePopMax) pops.shift() }
    }
  }
  // 부딪힘 loss 가 사건 없이 오는 경우(옛 엔진·누락된 틱)도 받는다 — 같은 대의 첫 접촉 간격이 중복을 막는다
  for (const h of hits) if (h.how === LOSS_IMPACT && h.from >= 0) noteImpact(cur, h.from, h.to, 0, hero, clk)
  if (pending.length > 0) {
    let bi = 0
    for (let i = 1; i < pending.length; i++) if (pending[i]!.d2 < pending[bi]!.d2) bi = i
    for (let i = 0; i < pending.length; i++) land(cur, pending[i]!, i === bi, clk, real)
  }
  // 뒤따라 사기가 얼마나 깎였나를 숫자로 (친 지 moralePopDelayMs 뒤)
  let w = 0
  for (const p of pends) {
    if (clk - p.at < F.moralePopDelayMs) { pends[w++] = p; continue }
    const q = cur.squads[p.id]
    if (q === undefined) continue
    const raw = (p.base - moraleOf(q)) * 100
    // 상성이 맞은 일은 작아도 「−1」 로 보인다 (깎이지 않았으면 안 띄운다)
    const drop = p.gold && raw > 0 ? Math.max(1, Math.round(raw)) : Math.round(raw)
    if (drop >= 1) { pops.push({ at: clk, n: drop, gold: p.gold, ...flagPos(q) }); if (pops.length > F.moralePopMax) pops.shift() }
  }
  pends.length = w
}

const flagPos = (q: VSquad): { x: number; y: number } => ({ x: q.u / P.field.unit * P.field.cellPx, y: q.v / P.field.unit * P.field.cellPx })

/**
 * 맞은 대가 밀린다: 달아나는 대와 기병 들이침에 옆을 맞은 대만 점이 흩어지고 몇이 돌아선다 ·
 * 앞줄끼리 맞닿은 대(flee 0)는 대 모양째 kickFrontCells 밀린다 (맞닿은 방패 벽이 낱낱이 퍼져 달아나는 것처럼 읽히던 것 · 화면 2차)
 * — 이미 더 큰 밀림이 걸려 있으면 그대로 둔다
 */
function shove(q: VSquad, dir: number, clk: number, scatter = false): void {
  if (q.flee === 1 || scatter) { scats.set(q.id, { at: clk, dir }); if (q.flee === 1) return }
  const k = kicks.get(q.id)
  if (k !== undefined && clk - k.at < P.field.kickMs && k.cells >= P.field.kickFrontCells) return
  kicks.set(q.id, { at: clk, dir, cells: P.field.kickFrontCells })
}
/** 상성이 맞은 무리: 깃 꺾임 · 밀림(달아나는 대만 흩어짐) · 사기 숫자 */
function good(cur: VModel, a: VSquad | undefined, v: VSquad, clk: number): void {
  const dir = a !== undefined ? (v.u >= a.u ? 1 : -1) : (v.side === 0 ? -cur.face : cur.face)
  addTilt(v.id, P.field.flagTiltDeg * DEG, dir, clk)
  shove(v, dir, clk, a !== undefined && a.grp === 'horse')
  pend(v.id, v, clk, true)
}

function land(cur: VModel, p: { att: number; vic: number; how: number }, nearest: boolean, clk: number, real: number): void {
  const F = P.field
  const a = cur.squads[p.att]!, v = cur.squads[p.vic]!
  const horse = a.grp === 'horse'
  const dir = v.u >= a.u ? 1 : -1
  // 닿는 순간 흙먼지가 터진다 (두 대 사이 · 기병은 더 많이)
  const mx = (a.u + v.u) / 2 / F.unit * F.cellPx, my = (a.v + v.v) / 2 / F.unit * F.cellPx, nb = Math.round(F.burstPieces * (horse ? 1.5 : 1))
  for (let i = 0; i < nb; i++) {
    const hh = hash2(p.att * 31 + i, Math.floor(clk)), ang = (hh % 628) / 100, sp = 25 + (hh >>> 9) % 45
    spawn(0, mx + Math.cos(ang) * 4, my + Math.sin(ang) * 3 + (i % 5 - 2) * (a.bw > 0 ? a.bw / F.unit * F.cellPx / 5 : F.cellPx * 0.5), Math.cos(ang) * sp, Math.sin(ang) * sp * 0.55 - 10, clk, F.burstMs, F.cellPx * 0.2)
  }
  if (p.how === HIT_BLOCKED) {
    kicks.set(p.att, { at: clk, dir: -dir, cells: F.kickBlockCells })
    addTilt(p.att, F.flagTiltDeg * DEG, -dir, clk)
    if (nearest) { clockSt.stopUntil = Math.max(clockSt.stopUntil, real + F.stopBlockMs); clockSt.shAt = real; clockSt.shPx = F.shakeBlockPx; clockSt.shMs = F.shakeBlockMs }
    return
  }
  // 시험판: 맞은 대가 눈에 띄게 뒤로 밀리고 화면이 더 크게 흔들린다 (그리는 쪽만)
  kicks.set(p.vic, { at: clk, dir, cells: (horse ? F.kickHorseCells : F.kickFrontCells) * (cur.mvp ? F.mvpKickPermille / 1000 : 1) })
  braces.set(p.vic, clk)
  if (p.how === HIT_GOOD) good(cur, a, v, clk)
  if (nearest) {
    clockSt.stopUntil = Math.max(clockSt.stopUntil, real + (horse ? F.stopHorseMs : F.stopFrontMs))
    clockSt.shAt = real; clockSt.shPx = (horse ? F.shakeHorsePx : F.shakeFrontPx) * (cur.mvp ? F.mvpShakePermille / 1000 : 1); clockSt.shMs = horse ? F.shakeHorseMs : F.shakeFrontMs
  }
}

/**
 * 깃 기울기(라디안 · 양수면 꼭대기가 +u 쪽) — 사기에 따라 기운 채 · 떨어짐 · 맞은 뒤 흔들림.
 * mor 는 처음 사기에 대한 몫 · fallBelow 는 깃이 떨어지는 문턱(본편 무너짐)
 */
export function flagTilt(id: number, mor: number, face: number, clk: number, fallBelow: number): number {
  const F = P.field
  if (mor < fallBelow) return FLAG_FALLEN * (face >= 0 ? -1 : 1)
  let rest = 0
  if (mor < F.waverPermille / 1000) rest = -face * F.flagLeanDeg * DEG
  const t = tilts.get(id)
  if (t === undefined) return rest
  const age = clk - t.at
  if (age >= F.flagShakeMs) return rest
  const k = 1 - age / F.flagShakeMs
  return rest + t.sgn * t.amp * k * Math.cos(age / F.flagShakeMs * 6.2832 * 1.5)
}

/** 대 전체가 뒤로 튕기는 어긋남(칸 · 부호는 +u 쪽이 양수) */
export function kickOf(id: number, clk: number): number {
  const k = kicks.get(id)
  if (k === undefined) return 0
  const t = (clk - k.at) / P.field.kickMs
  if (t < 0 || t >= 1) return 0
  const e = (1 - t) * (1 - t)
  return k.dir * k.cells * e
}

export const sc = { x: 0, turn: false }
/** 맞은 쪽 점 흩어짐: 몇은 1~2칸 밀리고 2~3개는 돌아선다 (칸 · +u 쪽이 양수) */
export function scatterOf(id: number, k: number, clk: number): void {
  sc.x = 0; sc.turn = false
  const s = scats.get(id)
  if (s === undefined) return
  const t = (clk - s.at) / P.field.scatterMs
  if (t < 0 || t >= 1) return
  const h = hash2(id * 29 + 11, k) % 1000
  if (h < 350) sc.x = s.dir * (1 + (h % 2)) * (1 - t)
  else if (h < 350 + 150) sc.turn = true
}

/** 사기 숫자(「−N」)를 낱낱 그린다: 위로 떠오르며 옅어진다 (screen px 로 크기 고정) */
export function drawPops(ctx: CanvasRenderingContext2D, clk: number, zoom: number, baseH: number): void {
  const F = P.field
  let w = 0
  for (const p of pops) if (clk - p.at < F.moralePopMs) pops[w++] = p
  pops.length = w
  if (w === 0) return
  const px = F.moraleNumPx / zoom
  ctx.font = `bold ${px}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
  for (const p of pops) {
    const t = (clk - p.at) / F.moralePopMs
    const y = p.y - baseH * 2.2 - px * 0.4 - t * px * 1.6
    ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3
    const s = p.plus === true ? `+${p.n}` : `−${p.n}`
    ctx.lineWidth = Math.max(2, px * 0.18); ctx.strokeStyle = '#1a1208'; ctx.strokeText(s, p.x, y)
    ctx.fillStyle = p.plus === true ? PLUS_COLOR : p.gold ? '#ffd45a' : '#f4ead0'; ctx.fillText(s, p.x, y)
  }
  ctx.globalAlpha = 1
}

// ───────── 적의 큰 수 예고: 땅에 붉은 화살표 (omen 사건 · 올 길을 따라 omenMs 동안) ─────────
interface Omen { at: number; pts: { u: number; v: number }[] }
const omens: Omen[] = []
export function noteOmens(cur: VModel, clk: number): void {
  for (const e of eventsOf(cur)) if (e.kind === 'omen' && e.side === 1 && e.pts.length >= 2) {
    omens.push({ at: clk, pts: e.pts.map(p => ({ u: p.u, v: p.v })) })
    if (omens.length > 4) omens.shift()
  }
}
export function drawOmens(ctx: CanvasRenderingContext2D, clk: number, zoom: number): void {
  const F = P.field
  let w = 0
  for (const o of omens) if (clk - o.at < F.omenMs) omens[w++] = o
  omens.length = w
  if (w === 0) return
  const cp = F.cellPx, u = F.unit, step = F.omenStepCells * cp, half = cp * 0.9
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  for (const o of omens) {
    const age = clk - o.at, t = age / F.omenMs
    let a = Math.min(1, age / 150) * (t > 0.85 ? (1 - t) / 0.15 : 1)
    if (F.omenBlinkHz > 0) a *= 0.88 + 0.12 * Math.sin(age / 1000 * F.omenBlinkHz * 6.2832)
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath()
      let carry = (age / 1000 * cp * 3) % step, ex = 0, ey = 0, edx = 1, edy = 0
      for (let j = 1; j < o.pts.length; j++) {
        const ax = o.pts[j - 1]!.u / u * cp, ay = o.pts[j - 1]!.v / u * cp, bx = o.pts[j]!.u / u * cp, by = o.pts[j]!.v / u * cp
        const len = Math.hypot(bx - ax, by - ay)
        if (len < 1) continue
        const dx = (bx - ax) / len, dy = (by - ay) / len, nx = -dy, ny = dx
        for (let d = carry; d < len; d += step) {
          const x = ax + dx * d, y = ay + dy * d
          ctx.moveTo(x - dx * half + nx * half, y - dy * half + ny * half); ctx.lineTo(x, y); ctx.lineTo(x - dx * half - nx * half, y - dy * half - ny * half)
        }
        carry = ((carry - len) % step + step) % step
        ex = bx; ey = by; edx = dx; edy = dy
      }
      // 끝은 화살촉 (더 큰 갈매기)
      const hh = half * 1.7, enx = -edy, eny = edx
      ctx.moveTo(ex - edx * hh + enx * hh, ey - edy * hh + eny * hh); ctx.lineTo(ex + edx * half * 0.6, ey + edy * half * 0.6); ctx.lineTo(ex - edx * hh - enx * hh, ey - edy * hh - eny * hh)
      ctx.globalAlpha = a
      ctx.strokeStyle = pass === 0 ? '#f4ead0' : '#dc3a2e'
      ctx.lineWidth = Math.max(pass === 0 ? 6.4 : 4.2, (pass === 0 ? 7.2 : 4.6) / zoom)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

/** 방진 앞 열이 부딪힘을 받아 더 낮춰 버티는 동안인가 (임팩트 뒤 braceMs) */
export const bracedAt = (id: number, clk: number): boolean => { const t = braces.get(id); return t !== undefined && clk - t >= 0 && clk - t < P.field.braceMs }

// ───────── 큰 외침(Q): 장수를 중심으로 끊긴 고리 셋이 차례로 퍼진다 (조각난 호 · 채운 원·햇살 아님) ─────────
/** gold = 투지로 한 번 더 쓴 것(금빛 · 더 크게) · inward = 투지가 막 찼다(금빛 고리가 장수에게 모여든다) */
interface Shout { x: number; y: number; at: number; side: 0 | 1; rings: number; scale: number; r: number; gold: boolean; inward: boolean }
const shouts: Shout[] = []
const lifts = new Map<number, number>()
const raised = new Map<number, number>()
/** 다시 선 대의 깃이 일어서기 시작한 시각 (대 id) */
const rises = new Map<number, number>()
const GOLD = '#ffd27a'
const PLUS_COLOR = '#a8dcff'
const pushShout = (s: Shout): void => { shouts.push(s); if (shouts.length > 6) shouts.shift() }
const px = (units: number): number => units / P.field.unit * P.field.cellPx
/**
 * 비기 쿨이 새로 돌기 시작한 큰 외침을 잡는다 (장수 칸의 쿨 오름으로 안다) — 흙먼지·우리 대 들썩·적 대 뒷걸음도 여기서 건다.
 * 투지로 한 번 더 쓰면 쿨이 안 돌고 gritN 이 오른다 → 금빛으로 크게 · 멈칫·흔들림. 투지가 막 차면 금빛 고리가 장수에게 모여든다.
 */
export function noteShouts(cur: VModel, prev: VModel | null, clk: number, real = clk): void {
  if (prev === null) return
  const F = P.field
  for (const h of cur.heroes) {
    const p = prev.heroes.find(x => x.side === h.side)
    if (p === undefined) continue
    const x = px(h.u), y = px(h.v)
    if (h.grit >= 1000 && p.grit < 1000 && h.stun === 0) pushShout({ x, y, at: clk, side: h.side, rings: 2, scale: 1, r: F.heroAuraCells * F.cellPx, gold: true, inward: true })
    const gritUsed = h.gritN > p.gritN
    if (!(gritUsed || (h.art === 'shout' && h.artCd > p.artCd))) continue
    const ev = eventsOf(cur).find(e => e.kind === 'heroSkill' && e.side === h.side)
    const rUnits = ev !== undefined && ev.r > 0 ? ev.r : F.heroAuraCells * F.unit
    pushShout({ x, y, at: clk, side: h.side, rings: gritUsed ? 4 : 3, scale: gritUsed ? F.gritShoutScale : 1, r: px(rUnits), gold: gritUsed, inward: false })
    if (gritUsed) { clockSt.stopUntil = Math.max(clockSt.stopUntil, real + F.gritShoutStopMs); clockSt.shAt = real; clockSt.shPx = F.gritShoutShakePx; clockSt.shMs = F.shakeHorseMs }
    const nd = gritUsed ? F.shoutDust * 2 : F.shoutDust
    for (let i = 0; i < nd; i++) {
      const hh = hash2((clk | 0) + i, 7), ang = (hh % 628) / 100, sp = 40 + (hh >>> 9) % 70
      spawn(0, x + Math.cos(ang) * 6, y + Math.sin(ang) * 4, Math.cos(ang) * sp, Math.sin(ang) * sp * 0.45 - 4, clk, F.shoutMs * 0.9, F.cellPx * 0.16)
    }
    if (h.art !== 'shout') continue
    const r2 = rUnits * rUnits
    for (const q of cur.squads) {
      if (q.men <= 0) continue
      const du = q.u - h.u, dv = q.v - h.v
      if (du * du + dv * dv > r2) continue
      if (q.side === h.side) lifts.set(q.id, clk)
      else kicks.set(q.id, { at: clk, dir: du >= 0 ? 1 : -1, cells: gritUsed ? 1 : 0.5 })
    }
  }
}
/** 버팀(stand): 장수에서 기운 범위의 우리 대로 짧은 흰 물결 두 번 · 그 대들이 무기를 한 번 치켜들고 들썩인다 (10초 남는 표시는 drawStands) */
export function noteStand(cur: VModel, side: 0 | 1, u: number, v: number, r: number, clk: number): void {
  const F = P.field
  pushShout({ x: px(u), y: px(v), at: clk, side, rings: 2, scale: F.standRingScale, r: px(r > 0 ? r : F.heroAuraCells * F.unit), gold: false, inward: false })
  const rr = (r > 0 ? r : F.heroAuraCells * F.unit) ** 2
  for (const q of cur.squads) { if (q.side !== side || q.men <= 0) continue; const du = q.u - u, dv = q.v - v; if (du * du + dv * dv <= rr) { raised.set(q.id, clk); lifts.set(q.id, clk) } }
}
/**
 * 다시 섬(regroup): 달아나던 대가 몸을 돌려 선다 — 한 번 들썩 · 무기를 치켜들고 · 그 무리 깃이 금빛 테를 두르고 한 번 일어선다.
 * 「+N」 은 화면 쪽(mainHud fly)이 그 대 몸 위에서 막대로 날려 보낸다 (판 위에 숫자·고리를 또 두지 않는다)
 */
export function noteRegroup(cur: VModel, id: number, clk: number): void {
  const q = cur.squads[id]
  if (q === undefined || q.men <= 0) return
  rises.set(id, clk); raised.set(id, clk); lifts.set(id, clk)
}
/**
 * 장수가 쓰러짐(heroDown): 그 편 대마다 깃이 크게 꺾이고 점이 흩어진다 · 무리마다 가장 큰 대 위에 깎인 사기 숫자(금빛) ·
 * 그리는 시계 멈칫 · 화면 흔들림 · 흙먼지. 적장을 쓰러뜨린 판(편 사기 −25%p)이 판에서 가장 큰 순간이다.
 */
export function noteHeroDown(cur: VModel, prev: VModel | null, side: 0 | 1, u: number, v: number, clk: number, real: number): void {
  const F = P.field
  const best = new Map<string, VSquad>()
  for (const q of cur.squads) {
    if (q.side !== side || q.men <= 0) continue
    const dir = q.u >= u ? 1 : -1
    addTilt(q.id, F.flagTiltDeg * DEG * F.slainTiltMul, dir, clk)
    shove(q, dir, clk)
    const b = best.get(q.grp)
    if (b === undefined || q.men > b.men) best.set(q.grp, q)
  }
  // 꺾임은 장수가 쓰러진 그 틱에 이미 들어가 있다 — 앞 틱과 견준 몫을 곧바로 띄운다 (앞 틱이 없으면 뒤따라 잰다)
  for (const q of best.values()) {
    const pq = prev?.squads[q.id]
    if (pq === undefined || q.morale0 <= 0) { pend(q.id, q, clk, true); continue }
    const drop = Math.round((pq.morale - q.morale) * 100 / q.morale0)
    if (drop >= 1) { pops.push({ at: clk, n: drop, gold: true, ...flagPos(q) }); if (pops.length > F.moralePopMax) pops.shift() }
  }
  const x = px(u), y = px(v)
  for (let i = 0; i < F.slainDust; i++) {
    const hh = hash2((clk | 0) + i, 13), ang = (hh % 628) / 100, sp = 50 + (hh >>> 9) % 90
    spawn(0, x + Math.cos(ang) * 6, y + Math.sin(ang) * 4, Math.cos(ang) * sp, Math.sin(ang) * sp * 0.45 - 8, clk, F.shoutMs, F.cellPx * 0.2)
  }
  pushShout({ x, y, at: clk, side: side === 0 ? 1 : 0, rings: 3, scale: 1, r: F.heroArtCells * F.cellPx, gold: side === 1, inward: false })
  clockSt.stopUntil = Math.max(clockSt.stopUntil, real + F.slainStopMs)
  clockSt.shAt = real; clockSt.shPx = F.slainShakePx; clockSt.shMs = F.slainShakeMs
}
// ───────── 장수 밀침 (heroBash): 장수가 크게 휘두르고 · 밀린 대가 대 모양째 튕기며 몇이 뒤로 넘어지고 · 금빛 「−N」 ─────────
/** 밀린 대마다 넘어짐이 시작된 시각과 넘어지는 쪽(+u 1 · -u -1) */
const knocks = new Map<number, { at: number; dir: number }>()
/** 편마다 장수가 밀친 시각과 그 쪽 */
const bashAt = [-1e9, -1e9], bashDir = [1, 1]
/**
 * 밀침 한 번 — 쾅(impact how 1 · id -1)은 같은 틱에 같이 오지만 noteImpact 가 장수 것(id -1)을 안 받으므로 두 번 터지지 않는다.
 * 숫자는 엔진 값 heroBangShock 그대로 (천분율 → %p)
 */
export function noteBash(cur: VModel, side: 0 | 1, to: number, u: number, v: number, clk: number, real: number): void {
  const F = P.field, q = cur.squads[to], h = cur.heroes.find(e => e.side === side)
  if (q === undefined || q.men <= 0) return
  const dir = h === undefined ? (side === 0 ? cur.face : -cur.face) : q.u >= h.u ? 1 : -1
  kicks.set(q.id, { at: clk, dir, cells: F.heroBashKickCells })
  knocks.set(q.id, { at: clk, dir })
  addTilt(q.id, F.flagTiltDeg * DEG, dir, clk)
  bashAt[side] = clk; bashDir[side] = dir
  const n = Math.round(F.heroBangShock / 10)
  if (n >= 1) { pops.push({ at: clk, n, gold: true, ...flagPos(q) }); if (pops.length > F.moralePopMax) pops.shift() }
  const x = px(u), y = px(v)
  for (let i = 0; i < F.heroBashDust; i++) {
    const hh = hash2((clk | 0) + i, 17), ang = (hh % 628) / 100, sp = 30 + (hh >>> 9) % 50
    spawn(0, x + Math.cos(ang) * 4, y + Math.sin(ang) * 3, Math.cos(ang) * sp + dir * 25, Math.sin(ang) * sp * 0.5 - 8, clk, F.burstMs, F.cellPx * 0.18)
  }
  clockSt.stopUntil = Math.max(clockSt.stopUntil, real + F.heroBashStopMs)
  clockSt.shAt = real; clockSt.shPx = F.heroBashShakePx; clockSt.shMs = F.heroBashShakeMs
}
/** 밀린 대의 이 점이 넘어져 있는 중이면 0~1 (넘어짐 → 누움 → 일어남) · 아니면 -1 · knockSide 에 넘어지는 쪽 */
export const knockSide = { dir: 1 }
export function knockOf(id: number, k: number, clk: number): number {
  const kn = knocks.get(id)
  if (kn === undefined) return -1
  const t = (clk - kn.at) / P.field.heroBashKnockMs
  if (t < 0 || t >= 1 || hash2(id * 41 + 7, k) % 1000 >= P.field.heroBashKnockPermille) return -1
  knockSide.dir = kn.dir
  return t
}
/** 이 편 장수가 밀치며 휘두르는 중이면 0~1 · 아니면 -1 · 쪽은 bashDirOf */
export function bashPoseOf(side: 0 | 1, clk: number): number {
  const t = (clk - bashAt[side]!) / P.field.heroBashSwingMs
  return t >= 0 && t < 1 ? t : -1
}
export const bashDirOf = (side: 0 | 1): number => bashDir[side]!

/** 무기를 치켜드는 중인가 */
export const raisedAt = (id: number, clk: number): boolean => { const t = raised.get(id); return t !== undefined && clk - t >= 0 && clk - t < P.field.standRaiseMs }
/**
 * 다시 선 대의 깃 (라디안 · 그 대 위에 따로 서는 작은 깃) — 다시 서지 않았거나 regroupFlagMs 가 지났으면 NaN.
 * 처음 regroupRiseMs 동안 땅에 누운 깃이 일어서며 한 번 넘쳤다가 바로 선다 (fall = 누웠던 쪽 부호).
 */
export function riseTilt(id: number, clk: number, fall: number): number {
  const t = rises.get(id)
  if (t === undefined) return NaN
  const age = clk - t, F = P.field
  if (age < 0 || age >= F.regroupFlagMs) return NaN
  if (age >= F.regroupRiseMs) return 0
  const k = age / F.regroupRiseMs
  return fall * 1.35 * (1 - k) * (1 - k) - fall * 0.35 * Math.sin(k * Math.PI)
}
/** 큰 외침을 받은 우리 대가 한 번 들썩 (px 위로 · 0.15초) */
export function liftOf(id: number, clk: number): number {
  const t = lifts.get(id)
  if (t === undefined) return 0
  const k = (clk - t) / P.field.shoutLiftMs
  return k < 0 || k >= 1 ? 0 : Math.sin(k * Math.PI) * P.field.shoutLiftPx
}
/** 이 편 장수가 지금 외치는 중인가 (외치는 칸을 보이게) */
export const isShouting = (side: 0 | 1, clk: number): boolean => { for (const s of shouts) if (s.side === side && !s.inward && clk - s.at >= 0 && clk - s.at < 450) return true; return false }

/** 그 편 버팀이 남은 몫 0~1 (안 섰거나 끝났으면 0) — 엔진의 standTick 과 standSec 으로만 센다 */
export function standLeft(m: VModel, side: 0 | 1): number {
  const t = m.standTick[side], F = P.field
  // 판이 끝났거나 그 편이 무너졌으면 버팀 표시도 걷는다
  if (t < 0 || m.end !== null || m.breakTick[side] >= 0) return 0
  const left = 1 - (m.tick - t) / (F.standSec * F.hz)
  return left > 0 && left <= 1 ? left : 0
}
/** 이 대가 버티는 중인가 (엔진 standing 과 같은 셈: 버팀 시간 안 · 제 편 장수가 서 있고 그 곁 heroArtCells 안) */
export function standingAt(m: VModel, q: VSquad): boolean {
  if (q.men <= 0 || q.flee === 1 || standLeft(m, q.side) <= 0) return false
  const h = m.heroes.find(e => e.side === q.side)
  if (h === undefined || h.stun > 0) return false
  const r = P.field.heroArtCells * P.field.unit, du = q.u - h.u, dv = q.v - h.v
  return du * du + dv * dv <= r * r
}
/**
 * 버팀이 이어지는 동안(standSec) 남는 표시 — 버티는 대마다 발밑에 금빛 판(옅게 채우고 끊긴 테)이 깔리고,
 * 장수 발밑에는 땅에 꽂힌 창 자루 같은 짧은 세로 금이 작은 고리를 두른다 (세로 금이라 햇살 모양이 아니다).
 * 처음 0.3초에 차오르고 끝 standFadeMs 동안 옅어진다. plates = [x, y, w, h, side, …] (판 px · 대 가운데와 몸 크기) · hx · hy = 편마다 장수 자리
 */
export function drawStands(ctx: CanvasRenderingContext2D, m: VModel, hx: readonly number[], hy: readonly number[], plates: readonly number[], clk: number, zoom: number, teamColor: readonly string[]): void {
  const F = P.field
  const alphaOf = (side: 0 | 1): number => {
    const left = standLeft(m, side)
    if (left <= 0) return 0
    const remMs = left * F.standSec * 1000, ageMs = F.standSec * 1000 - remMs
    return Math.min(1, ageMs / 300) * Math.min(1, remMs / F.standFadeMs)
  }
  const a0 = alphaOf(0), a1 = alphaOf(1)
  if (a0 <= 0 && a1 <= 0) return
  const pulse = 0.75 + 0.25 * Math.sin(clk / 220)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  // 버티는 대의 발밑 판: 편마다 한 경로 (채움 한 번 · 테 한 번)
  for (const side of [0, 1] as const) {
    const a = side === 0 ? a0 : a1
    if (a <= 0) continue
    ctx.beginPath()
    let any = false
    for (let i = 0; i < plates.length; i += 5) {
      if (plates[i + 4] !== side) continue
      const w = plates[i + 2]! + F.cellPx * F.standPadCells * 2, h = plates[i + 3]! + F.cellPx * F.standPadCells * 2
      ctx.rect(plates[i]! - w / 2, plates[i + 1]! - h / 2, w, h)
      any = true
    }
    if (!any) continue
    ctx.globalAlpha = a * 0.22 * pulse; ctx.fillStyle = GOLD; ctx.fill()
    ctx.globalAlpha = a * 0.9 * pulse; ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(2, 2.6 / zoom)
    ctx.setLineDash([F.cellPx * 0.9, F.cellPx * 0.45]); ctx.lineDashOffset = -clk / 60; ctx.stroke(); ctx.setLineDash([])
  }
  // 장수 발밑: 꽂힌 창 자루가 두른 작은 고리
  for (const side of [0, 1] as const) {
    const a = side === 0 ? a0 : a1
    const h = m.heroes.find(e => e.side === side)
    if (a <= 0 || h === undefined || h.stun > 0) continue
    const x = hx[side]!, y = hy[side]!, R = F.standHeroCells * F.cellPx, ry = 0.5, n = F.standMarkTicks, hgt = F.standMarkCells * F.cellPx
    ctx.beginPath()
    ctx.ellipse(x, y, R, R * ry, 0, 0, Math.PI * 2)
    ctx.globalAlpha = a * pulse; ctx.strokeStyle = teamColor[side]!; ctx.lineWidth = Math.max(2.4, 3 / zoom); ctx.stroke()
    ctx.beginPath()
    for (let i = 0; i < n; i++) { const b = i * 2 * Math.PI / n, bx = x + Math.cos(b) * R, by = y + Math.sin(b) * R * ry; ctx.moveTo(bx, by); ctx.lineTo(bx, by - hgt) }
    ctx.globalAlpha = a; ctx.strokeStyle = '#f4ead0'; ctx.lineWidth = Math.max(1.6, 2 / zoom); ctx.stroke()
    ctx.beginPath()
    for (let i = 0; i < n; i++) { const b = i * 2 * Math.PI / n, bx = x + Math.cos(b) * R, by = y + Math.sin(b) * R * ry; ctx.moveTo(bx, by - hgt); ctx.lineTo(bx, by - hgt * 0.65) }
    ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(2.6, 3.2 / zoom); ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/**
 * 다시 서는 자리: 우리 대가 달아나는 동안(다시 선 적 없는 대 · 편이 안 무너졌을 때) 우리 장수 둘레 regroupCells 에 끊긴 고리 —
 * 그 안으로 들어온 달아나는 대가 다시 선다. 장수 고리에만 보인다.
 */
export function drawRegroupZone(ctx: CanvasRenderingContext2D, m: VModel, hx: number, hy: number, clk: number, zoom: number, color: string): void {
  const F = P.field
  const h = m.heroes.find(e => e.side === 0)
  if (h === undefined || h.stun > 0 || m.breakTick[0] >= 0 || m.end !== null) return
  if (!m.squads.some(q => q.side === 0 && q.men > 0 && q.flee === 1 && q.regrouped === 0)) return
  const R = F.regroupCells * F.cellPx
  ctx.beginPath(); ctx.ellipse(hx, hy, R, R * 0.6, 0, 0, Math.PI * 2)
  ctx.setLineDash([F.cellPx * 0.7, F.cellPx * 0.5]); ctx.lineDashOffset = clk / 40
  ctx.globalAlpha = 0.5 + 0.3 * Math.sin(clk / 200); ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, 2.6 / zoom); ctx.stroke()
  ctx.setLineDash([]); ctx.globalAlpha = 1
}

export function drawShouts(ctx: CanvasRenderingContext2D, clk: number, zoom: number, teamColor: readonly string[]): void {
  const F = P.field
  let w = 0
  for (const s of shouts) if (clk - s.at < (s.inward ? F.gritCallMs : F.shoutMs)) shouts[w++] = s
  shouts.length = w
  if (w === 0) return
  ctx.lineCap = 'round'
  for (const s of shouts) {
    const R = s.r * s.scale, life = s.inward ? F.gritCallMs : 450
    for (let ring = 0; ring < s.rings; ring++) {
      const age = clk - s.at - ring * 120
      if (age < 0 || age >= life) continue
      const t = age / life, e = 1 - (1 - t) * (1 - t)
      // 모여드는 고리는 크게서 장수 발밑으로 · 퍼지는 고리는 발밑에서 범위 끝으로
      const r = s.inward ? R - (R - F.cellPx * 1.2) * e : F.cellPx + (R - F.cellPx) * e
      // 조각난 고리: 여덟 조각 (조각마다 빈틈) · 굵기 3px → 1px · 흰색(투지는 금빛) → 편 색으로 옅어짐
      ctx.beginPath()
      const rot = ring * 0.4 + (s.at % 100) / 100
      for (let i = 0; i < 8; i++) {
        const a = rot + i * Math.PI / 4
        ctx.moveTo(s.x + Math.cos(a - 0.3) * r, s.y + Math.sin(a - 0.3) * r * 0.75)
        for (let j = 1; j <= 4; j++) { const b = a - 0.3 + j * 0.15; ctx.lineTo(s.x + Math.cos(b) * r, s.y + Math.sin(b) * r * 0.75) }
      }
      ctx.strokeStyle = s.gold ? (s.inward || t < 0.6 ? GOLD : teamColor[s.side]!) : t < 0.5 ? '#ffffff' : teamColor[s.side]!
      ctx.globalAlpha = s.inward ? 0.35 + 0.65 * t : 1 - t * 0.7
      const wpx = s.gold ? (s.inward ? 2.5 : 4.5 - 3 * t) : 3 - 2 * t
      ctx.lineWidth = Math.max(1, wpx * (1 / Math.min(1, zoom)))
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}
