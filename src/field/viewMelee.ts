/**
 * 맞붙은 싸움이 싸움처럼 (51 §5) — 그리는 쪽 기억 · sim 으로 안 나간다.
 *  - 양쪽 다 친다: 맞닿은 앞줄 점을 짝지어(틱이 바뀔 때만) 번갈아 찌른다. 이기는 쪽이 더 자주 친다(loss 사건의 양)
 *  - 줄이 움찔 · 뒤 줄 출렁임 · 무너지기 전 징후(뒤돌아봄 · 뒷걸음) · 쓰러진 자국 · 먼지와 불똥(낱낱 · 상한)
 * 셈은 틱마다(짝) 또는 점마다 해시 한 번이고 프레임마다 배열·객체를 새로 만들지 않는다.
 */
import { P } from '../tune/params.ts'
import { ATTACK_N } from './viewArt.ts'
import { hash2 } from './viewDots.ts'
import { type Dots, rowOfDot } from './viewForm.ts'
import type { VLoss } from './viewRead.ts'

interface Press { dealt: number; taken: number; flinchAt: number }
const press = new Map<number, Press>()
const pressOf = (id: number): Press => { let p = press.get(id); if (p === undefined) { p = { dealt: 0, taken: 0, flinchAt: -1e9 }; press.set(id, p) } return p }

/** 짝 (점 → 상대 점 번호) · 대 id 마다 */
const pairs = new Map<number, Int16Array>()

export interface Stain { x: number; y: number; at: number }
export const stains: Stain[] = []

/** 먼지·불똥 낱낱 (상한 P.field.particleMax) — kind 0 먼지 · 1 불똥 */
export interface Particle { x: number; y: number; vx: number; vy: number; at: number; life: number; kind: number; r: number }
export const parts: Particle[] = []

export function resetMelee(): void { press.clear(); pairs.clear(); stains.length = 0; parts.length = 0 }

/** 깎임 한 줄을 받는다 — 친 쪽은 쌓고 맞은 쪽은 움찔 시각을 기억한다 */
export function noteLoss(h: VLoss, nowMs: number): void {
  if (h.n <= 0) return
  if (h.from >= 0) pressOf(h.from).dealt += h.n
  const t = pressOf(h.to)
  t.taken += h.n; t.flinchAt = nowMs
}
/** 밀려난 거리가 늘었다 — 그 대의 줄이 움찔한다 */
export function notePush(id: number, nowMs: number): void { pressOf(id).flinchAt = nowMs }
/** 식히기: 두 값을 같이 줄여 비율은 지키고 오래된 것이 잊히게 (틱마다 한 번) */
export function coolPress(dtMs: number): void {
  const k = Math.exp(-dtMs / P.field.pressMemMs)
  for (const p of press.values()) { p.dealt *= k; p.taken *= k }
}
/** 이 대가 한 번 칼을 휘두르는 몫(0~1000) — 이기는 쪽이 더 자주 (자료가 없으면 baseline) */
export function swingChance(id: number): number {
  const p = press.get(id)
  const F = P.field
  if (p === undefined || p.dealt + p.taken < 1) return F.swingBasePermille
  const share = p.dealt / (p.dealt + p.taken)
  return Math.round(F.swingMinPermille + (1000 - F.swingMinPermille) * share)
}
/** 이번 휘두름 칸(cycle)에 점 k 가 칼을 내는가 */
export const swings = (id: number, k: number, cycle: number, chance: number): boolean => hash2(id * 131 + k, cycle) % 1000 < chance
/** 움찔 몫 1→0 */
export function flinchOf(id: number, nowMs: number): number {
  const p = press.get(id)
  if (p === undefined) return 0
  const t = nowMs - p.flinchAt
  return t < 0 || t > P.field.flinchMs ? 0 : 1 - t / P.field.flinchMs
}

/** 앞줄 점인가: 모양이 있으면 맨 앞 줄 · 흩어짐이면 맞닿는 쪽 가장자리에서 frontBandCells 안 */
export function isFront(d: Dots, k: number, face: number, maxFwd: number): boolean {
  const r = rowOfDot(d, k)
  if (r >= 0) return r === 0
  return d.cu[k]! * face >= maxFwd - P.field.frontBandCells
}
/** 살아 있는 점 가운데 가장 앞(맞닿는 쪽) 값 */
export function maxFwdOf(d: Dots, dead: ReadonlySet<number>, face: number): number {
  let m = -Infinity
  for (let k = 0; k < d.N; k++) if (!dead.has(k)) m = Math.max(m, d.cu[k]! * face)
  return m
}
/** 살아 있는 점 가운데 가장 뒤 값 */
export function minFwdOf(d: Dots, dead: ReadonlySet<number>, face: number): number {
  let m = Infinity
  for (let k = 0; k < d.N; k++) if (!dead.has(k)) m = Math.min(m, d.cu[k]! * face)
  return m
}

const aIdx: number[] = [], bIdx: number[] = []
/** 짝짓기 (틱이 바뀔 때): 내 앞줄 점과 상대 앞줄 점을 위에서 아래 차례로 겹쳐 1:1 에 가깝게 맺는다 */
export function computePairs(id: number, d: Dots, dead: ReadonlySet<number>, face: number, od: Dots | undefined, odead: ReadonlySet<number> | undefined): void {
  let pr = pairs.get(id)
  if (pr === undefined || pr.length !== d.N) { pr = new Int16Array(d.N); pairs.set(id, pr) }
  pr.fill(-1)
  if (od === undefined || odead === undefined) return
  const mf = maxFwdOf(d, dead, face), of = maxFwdOf(od, odead, -face)
  aIdx.length = 0; bIdx.length = 0
  for (let k = 0; k < d.N; k++) if (!dead.has(k) && isFront(d, k, face, mf)) aIdx.push(k)
  for (let k = 0; k < od.N; k++) if (!odead.has(k) && isFront(od, k, -face, of)) bIdx.push(k)
  if (aIdx.length === 0 || bIdx.length === 0) return
  aIdx.sort((x, y) => d.cv[x]! - d.cv[y]!); bIdx.sort((x, y) => od.cv[x]! - od.cv[y]!)
  const na = aIdx.length, nb = bIdx.length
  for (let i = 0; i < na; i++) pr[aIdx[i]!] = bIdx[na === 1 ? 0 : Math.round(i * (nb - 1) / (na - 1))]!
}
export const partnerOf = (id: number, k: number): number => pairs.get(id)?.[k] ?? -1

/** 한 점의 싸움 몸짓 결과 */
export const mo = { x: 0, y: 0, swing: false, hitFrame: false, turn: false, back: 0 }

/**
 * 점 하나의 찌름·움찔·출렁임·징후 (화면 px 어긋남을 mo 에 쓴다).
 * front 앞줄인가 · rear 맨 뒷줄인가 · tx,ty 짝의 자리(없으면 NaN) · mor 사기 몫 0~1
 */
export function dotMelee(id: number, k: number, ph: number, face: number, front: boolean, rear: boolean, fighting: boolean, mor: number, nowMs: number, x: number, y: number, tx: number, ty: number, chance: number, flinch: number): void {
  const F = P.field
  mo.x = 0; mo.y = 0; mo.swing = false; mo.hitFrame = false; mo.turn = false; mo.back = 0
  if (!fighting) return
  if (front) {
    const x0 = nowMs / F.animAttackMs + ph * ATTACK_N, cyc = Math.floor(x0 / ATTACK_N)
    if (swings(id, k, cyc, chance)) {
      mo.swing = true
      const tc = (x0 - cyc * ATTACK_N) * F.animAttackMs, h = F.attackHitFrame * F.animAttackMs
      let a = 0
      if (tc >= h - F.lungeOutMs && tc <= h) a = (tc - (h - F.lungeOutMs)) / F.lungeOutMs
      else if (tc > h && tc < h + F.lungeBackMs) a = 1 - (tc - h) / F.lungeBackMs
      mo.hitFrame = tc >= h && tc < h + F.animAttackMs
      if (a > 0) {
        let ux = face, uy = 0
        if (tx === tx) { const dx = tx - x, dy = ty - y, L = Math.hypot(dx, dy); if (L > 0.5 && L < F.cellPx * 6) { ux = dx / L; uy = dy / L } }
        mo.x = ux * a * F.lungePx; mo.y = uy * a * F.lungePx * 0.5
      }
    }
    if (flinch > 0) mo.x -= face * F.flinchPx * flinch
  } else if (rear) {
    mo.x = Math.sin(nowMs / F.waveMs + k * 1.7) * F.wavePx
  }
  // 무너지기 전 징후: 맨 뒷줄의 몫이 뒤를 돌아보고 · 더 낮으면 몇이 뒷걸음
  if (rear) {
    const hsh = hash2(id * 17 + 5, k) % 1000
    if (mor < F.lookBackPermille / 1000 && hsh < F.lookBackSharePermille) mo.turn = true
    if (mor < F.backstepPermille / 1000 && hsh < F.backstepSharePermille) { mo.back = 1; mo.x -= face * F.backstepPx }
  }
}

// ───────── 쓰러진 자국 · 먼지 · 불똥 ─────────
export function addStain(x: number, y: number, at: number): void {
  if (stains.length >= P.field.stainMax) stains.shift()
  stains.push({ x, y, at })
}
export function spawn(kind: number, x: number, y: number, vx: number, vy: number, at: number, life: number, r: number): void {
  if (parts.length >= P.field.particleMax) return
  parts.push({ x, y, vx, vy, at, life, kind, r })
}
/** 입자를 줄이고 낱낱 그린다 (먼지 알파 세 단계 한 경로씩 · 불똥 한 경로) */
export function drawParticles(ctx: CanvasRenderingContext2D, nowMs: number, zoom: number): void {
  let w = 0
  for (const p of parts) if (nowMs - p.at < p.life) parts[w++] = p
  parts.length = w
  if (w === 0) return
  for (let bin = 0; bin < 3; bin++) {
    ctx.beginPath()
    let any = false
    for (const p of parts) {
      if (p.kind !== 0 || nowMs < p.at) continue
      const t = (nowMs - p.at) / p.life
      if (Math.min(2, Math.floor((1 - t) * 3)) !== bin) continue
      const r = Math.max(p.r, 2.4 / zoom) * (0.6 + t * 0.7)
      const x = p.x + p.vx * (nowMs - p.at) / 1000, y = p.y + p.vy * (nowMs - p.at) / 1000
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832); any = true
    }
    if (!any) continue
    ctx.fillStyle = '#a89674'; ctx.globalAlpha = 0.15 + bin * 0.12; ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.beginPath()
  let sp = false
  for (const p of parts) {
    if (p.kind !== 1 || nowMs < p.at) continue
    const t = (nowMs - p.at) / p.life
    const el = nowMs - p.at
    const x = p.x + p.vx * el / 1000, y = p.y + p.vy * el / 1000 + 40 * t * t
    ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 0.03, y - p.vy * 0.03); sp = true
  }
  if (sp) { ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = Math.max(1.2, 1.4 / zoom); ctx.lineCap = 'round'; ctx.stroke() }
}
/** 쓰러진 자국: 낱낱 작은 어두운 타원 (두 경로 · 끝 쪽에서 옅어진다) */
export function drawStains(ctx: CanvasRenderingContext2D, nowMs: number, baseH: number): void {
  const F = P.field
  let w = 0
  for (const s of stains) if (nowMs - s.at < F.stainMs) stains[w++] = s
  stains.length = w
  if (w === 0) return
  ctx.fillStyle = '#2a1a12'
  for (let bin = 0; bin < 2; bin++) {
    ctx.beginPath()
    let any = false
    for (const s of stains) {
      const age = (nowMs - s.at) / F.stainMs
      if ((age < 0.7 ? 0 : 1) !== bin || nowMs < s.at) continue
      ctx.moveTo(s.x + baseH * 0.28, s.y); ctx.ellipse(s.x, s.y, baseH * 0.28, baseH * 0.09, 0, 0, 6.2832); any = true
    }
    if (any) { ctx.globalAlpha = bin === 0 ? 0.3 : 0.15; ctx.fill() }
  }
  ctx.globalAlpha = 1
}
