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
export interface Pop { x: number; y: number; at: number; n: number; gold: boolean }
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
  braces.clear(); tilts.clear(); scats.clear(); kicks.clear(); omens.length = 0; lastImpact.clear(); pends.length = 0; pops.length = 0
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
export function ingestHits(cur: VModel, hits: readonly VLoss[], clk: number, real: number): void {
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

/** 상성이 맞은 무리: 깃 꺾임 · 점 흩어짐 · 사기 숫자 */
function good(cur: VModel, a: VSquad | undefined, v: VSquad, clk: number): void {
  const dir = a !== undefined ? (v.u >= a.u ? 1 : -1) : (v.side === 0 ? -cur.face : cur.face)
  addTilt(v.id, P.field.flagTiltDeg * DEG, dir, clk)
  scats.set(v.id, { at: clk, dir })
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
  kicks.set(p.vic, { at: clk, dir, cells: horse ? F.kickHorseCells : F.kickFrontCells })
  braces.set(p.vic, clk)
  if (p.how === HIT_GOOD) good(cur, a, v, clk)
  if (nearest) {
    clockSt.stopUntil = Math.max(clockSt.stopUntil, real + (horse ? F.stopHorseMs : F.stopFrontMs))
    clockSt.shAt = real; clockSt.shPx = horse ? F.shakeHorsePx : F.shakeFrontPx; clockSt.shMs = horse ? F.shakeHorseMs : F.shakeFrontMs
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
    const s = `−${p.n}`
    ctx.lineWidth = Math.max(2, px * 0.18); ctx.strokeStyle = '#1a1208'; ctx.strokeText(s, p.x, y)
    ctx.fillStyle = p.gold ? '#ffd45a' : '#f4ead0'; ctx.fillText(s, p.x, y)
  }
  ctx.globalAlpha = 1
}

// ───────── 적의 큰 수 예고: 땅에 붉은 화살표 (omen 사건 · 올 길을 따라 omenMs 동안) ─────────
interface Omen { at: number; pts: { u: number; v: number }[] }
const omens: Omen[] = []
export function noteOmens(cur: VModel, clk: number): void {
  for (const e of eventsOf(cur)) if (e.kind === 'omen' && e.pts.length >= 2) {
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

// ───────── 큰 외침(Q): 장수에서 퍼지는 낱낱 충격 줄 (채운 원·햇살이 아니라 짧은 호 조각 여럿) ─────────
interface Shout { x: number; y: number; at: number; side: 0 | 1 }
const shouts: Shout[] = []
/** 비기 쿨이 새로 돌기 시작한 큰 외침을 잡는다 (사건 줄에 heroSkill 이 없어도 장수 칸의 쿨 오름으로 안다) */
export function noteShouts(cur: VModel, prev: VModel | null, clk: number): void {
  if (prev === null) return
  for (const h of cur.heroes) {
    const p = prev.heroes.find(x => x.side === h.side)
    if (h.art === 'shout' && p !== undefined && h.artCd > p.artCd) {
      shouts.push({ x: h.u / P.field.unit * P.field.cellPx, y: h.v / P.field.unit * P.field.cellPx, at: clk, side: h.side })
      if (shouts.length > 4) shouts.shift()
    }
  }
}
/** 이 편 장수가 지금 외치는 중인가 (외치는 칸을 보이게) */
export const isShouting = (side: 0 | 1, clk: number): boolean => { for (const s of shouts) if (s.side === side && clk - s.at >= 0 && clk - s.at < P.field.shoutMs) return true; return false }
export function drawShouts(ctx: CanvasRenderingContext2D, clk: number, zoom: number, teamColor: readonly string[]): void {
  const F = P.field
  let w = 0
  for (const s of shouts) if (clk - s.at < F.shoutMs) shouts[w++] = s
  shouts.length = w
  if (w === 0) return
  const R = F.heroAuraCells * F.cellPx
  ctx.lineCap = 'round'
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath()
    let any = false
    for (const s of shouts) {
      const t = (clk - s.at) / F.shoutMs
      for (let i = pass; i < F.shoutPieces; i += 2) {
        const h = hash2(s.at | 0, i), a = i / F.shoutPieces * 6.2832 + (h % 100) / 400, r = R * (1 - (1 - t) * (1 - t)) * (0.85 + ((h >>> 8) % 30) / 100)
        ctx.moveTo(s.x + Math.cos(a - 0.1) * r, s.y + Math.sin(a - 0.1) * r * 0.75)
        ctx.arc(s.x, s.y, r, a - 0.1, a + 0.1) // 짧은 호 조각 (타원으로 눌러 땅 위에 퍼지는 모양)
        any = true
      }
    }
    if (!any) continue
    ctx.strokeStyle = pass === 0 ? '#f4ead0' : teamColor[shouts[0]!.side]!
    ctx.globalAlpha = 1 - (clk - shouts[0]!.at) / F.shoutMs * 0.8
    ctx.lineWidth = Math.max(3, 3.4 / zoom)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}
