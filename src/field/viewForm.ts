/**
 * 대 안 병사 점의 자리를 자세(form)대로 세운다. 그리는 쪽 기억 — sim 으로 안 나간다.
 *  - 방진(FORM_HOLD): 줄 맞춘 촘촘한 네모 · 돌격(FORM_CHARGE): 앞이 뾰족한 쐐기 · 그 밖: 옛 흩어짐(dotDu/dotDv)
 *  - 자세가 바뀌면 점마다 조금씩 늦게 새 자리로 모인다(미끄러지지 않게) · 점이 빠지면 같은 줄 뒤의 점이 한 칸 나서 빈자리를 메운다
 * 자리는 대 가운데에서의 칸 단위 어긋남(du 가로 · dv 세로)이다. 앞(적 쪽)은 face(+1 오른쪽 · -1 왼쪽).
 */
import { P } from '../tune/params.ts'
import { dotDu, dotDv, hash2 } from './viewDots.ts'
import { FORM_CHARGE, FORM_HOLD, FORM_SCATTER } from './viewFxRead.ts'

interface Layout { rows: number; rowOf: Int16Array; fwd: Float32Array; side: Float32Array; behind: Int16Array }
const layouts = new Map<number, Layout>()

/** (자세, 점 자리 수)의 자리표: 줄 0 이 맨 앞 */
function layoutOf(form: number, N: number): Layout {
  const key = form * 1000 + N
  let L = layouts.get(key)
  if (L !== undefined) return L
  const F = P.field
  const fwd = new Float32Array(N), side = new Float32Array(N), rowOf = new Int16Array(N), behind = new Int16Array(N).fill(-1)
  let rows: number
  if (form !== FORM_CHARGE) {
    // 줄 선 덩어리: 열(깊이) 2~3 × 줄 4~6 · 방진은 더 촘촘하다
    const hold = form === FORM_HOLD, maxRows = hold ? F.holdRows : F.lineRows
    const uSp = hold ? F.holdUCells : F.lineUCells, vSp = hold ? F.holdVCells : F.lineVCells
    rows = N <= 3 ? 1 : N <= maxRows * 2 ? 2 : maxRows
    const cols = Math.ceil(N / rows)
    for (let s = 0; s < N; s++) {
      const r = Math.floor(s / cols), c = s % cols
      rowOf[s] = r; fwd[s] = ((rows - 1) / 2 - r) * uSp; side[s] = (c - (cols - 1) / 2) * vSp
      if (s + cols < N) behind[s] = s + cols
    }
  } else {
    rows = 1
    while (rows * rows < N) rows++
    for (let s = 0; s < N; s++) {
      const r = Math.floor(Math.sqrt(s)), c = s - r * r, len = Math.min(2 * r + 1, N - r * r)
      rowOf[s] = r; fwd[s] = ((rows - 1) / 2 - r) * F.wedgeUCells; side[s] = (c - (len - 1) / 2) * F.wedgeVCells
      const b = (r + 1) * (r + 1) + c + 1
      if (b < N) behind[s] = b
    }
  }
  L = { rows, rowOf, fwd, side, behind }
  layouts.set(key, L)
  return L
}

/** 대 하나의 점 자리 기억 */
export interface Dots {
  N: number; form: number; face: number; lastT: number; mul: number
  /** 지금 자리(칸) */
  cu: Float32Array; cv: Float32Array
  /** 점 → 자리 번호(모양이 있을 때) · 자리 → 점 */
  slot: Int16Array; occ: Int16Array
  /** 이 때까지 기다렸다 움직인다 · 새 자리까지 남은 거리(칸) · 쓰러진 점이었나 */
  hold: Float64Array; gap: Float32Array; wasDead: Uint8Array
  fills: { at: number; slot: number }[]
  /** 이 대가 이번에 모양을 바꾼 때 */
  formAt: number
}
const states = new Map<number, Dots>()
const idx: number[] = []

export function resetForm(): void { states.clear() }

function make(N: number): Dots {
  return { N, mul: 1, form: 0, face: 1, lastT: -1, cu: new Float32Array(N), cv: new Float32Array(N), slot: new Int16Array(N).fill(-1), occ: new Int16Array(N).fill(-1), hold: new Float64Array(N), gap: new Float32Array(N), wasDead: new Uint8Array(N), fills: [], formAt: -1e9 }
}

/** 줄 맞춘 자리는 점마다 ±lineJitterPx 만 흩는다 (칸 단위로 바꿔 더한다) */
const jitter = (id: number, k: number, salt: number): number => ((hash2(id * 3 + salt, k) % 2001) - 1000) / 1000 * P.field.lineJitterPx / P.field.cellPx
function targetOf(d: Dots, id: number, k: number, out: { u: number; v: number }): void {
  const s = d.slot[k]!
  if (d.form === FORM_SCATTER || s < 0) { out.u = dotDu(id, k); out.v = dotDv(id, k); return }
  const L = layoutOf(d.form, d.N)
  out.u = L.fwd[s]! * d.face * d.mul + jitter(id, k, 1); out.v = L.side[s]! * d.mul + jitter(id, k, 2)
}
const tgt = { u: 0, v: 0 }

/** 살아 있는 점을 앞쪽부터 줄 순서대로 자리에 앉힌다 (줄 안은 위에서 아래) */
function assign(d: Dots, dead: ReadonlySet<number>): void {
  d.occ.fill(-1); d.slot.fill(-1)
  if (d.form === FORM_SCATTER) return
  idx.length = 0
  for (let k = 0; k < d.N; k++) if (!dead.has(k)) idx.push(k)
  const f = d.face
  idx.sort((a, b) => (d.cu[b]! - d.cu[a]!) * f || d.cv[a]! - d.cv[b]!)
  const L = layoutOf(d.form, d.N)
  // 줄마다 위에서 아래로 다시 정렬
  let s = 0
  while (s < idx.length) {
    const r = L.rowOf[s]!
    let e = s
    while (e < idx.length && L.rowOf[e] === r) e++
    const part = idx.slice(s, e).sort((a, b) => d.cv[a]! - d.cv[b]!)
    for (let i = 0; i < part.length; i++) { d.slot[part[i]!] = s + i; d.occ[s + i] = part[i]! }
    s = e
  }
}

/** 대의 점 기억 (N 이 바뀌면 새로) — 처음 만들 때는 자리에 바로 앉는다 */
export function dotsOf(id: number, N: number, form: number, face: number, now: number, dead: ReadonlySet<number>, mul = 1): Dots {
  let d = states.get(id)
  const fresh = d === undefined || d.N !== N
  if (fresh) {
    d = make(N); states.set(id, d); d.mul = mul
    d.form = form; d.face = face; d.lastT = now
    for (let k = 0; k < N; k++) { d.cu[k] = dotDu(id, k); d.cv[k] = dotDv(id, k) }
    assign(d, dead)
    for (let k = 0; k < N; k++) { targetOf(d, id, k, tgt); d.cu[k] = tgt.u; d.cv[k] = tgt.v }
    return d
  }
  d = d!
  if (d.form !== form || d.face !== face) {
    if (d.form !== form) d.formAt = now
    d.form = form; d.face = face
    assign(d, dead)
    const st = P.field.formStaggerMs
    for (let k = 0; k < N; k++) d.hold[k] = now + (hash2(id * 31 + 7, k) % (st + 1))
  }
  return d
}

/** 점 k 가 쓰러졌다 — 모양이 있으면 뒤 점이 나서 메운다(메우기 지연 뒤) */
export function dotDied(d: Dots, k: number, now: number): void {
  d.wasDead[k] = 1
  const s = d.slot[k]!
  if (s >= 0) { d.occ[s] = -1; d.slot[k] = -1; d.fills.push({ at: now + P.field.fillMs, slot: s }) }
}

function fillChain(d: Dots, s0: number): void {
  const L = layoutOf(d.form, d.N)
  let s = s0
  for (;;) {
    const b = L.behind[s]!
    if (b < 0) return
    const k = d.occ[b]!
    if (k < 0) return
    d.occ[s] = k; d.slot[k] = s; d.occ[b] = -1
    s = b
  }
}

/** 프레임마다: 메우기 시각이 된 것을 하고 점마다 목표 자리로 부드럽게 간다. 반환 없음 — d.gap 이 남은 거리 */
export function stepDots(d: Dots, id: number, dead: ReadonlySet<number>, now: number): void {
  const dt = d.lastT < 0 || now < d.lastT ? 0 : Math.min(100, now - d.lastT) / 1000
  d.lastT = now
  if (d.fills.length > 0) {
    let w = 0
    for (const f of d.fills) { if (f.at <= now) { if (d.form !== FORM_SCATTER) fillChain(d, f.slot) } else d.fills[w++] = f }
    d.fills.length = w
  }
  const a = 1 - Math.exp(-P.field.formEaseRate * dt)
  for (let k = 0; k < d.N; k++) {
    if (dead.has(k)) { if (d.wasDead[k] === 0) d.wasDead[k] = 1; continue }
    if (d.wasDead[k] === 1) {
      d.wasDead[k] = 0
      if (d.form !== FORM_SCATTER) { let e = -1; for (let s = 0; s < d.N; s++) if (d.occ[s]! < 0) { e = s; break } if (e >= 0) { d.occ[e] = k; d.slot[k] = e } }
      targetOf(d, id, k, tgt); d.cu[k] = tgt.u; d.cv[k] = tgt.v; d.gap[k] = 0
      continue
    }
    targetOf(d, id, k, tgt)
    const du = tgt.u - d.cu[k]!, dv = tgt.v - d.cv[k]!
    d.gap[k] = Math.abs(du) + Math.abs(dv)
    if (now < d.hold[k]!) continue
    d.cu[k] = d.cu[k]! + du * a; d.cv[k] = d.cv[k]! + dv * a
  }
}
/** 이 대의 줄 번호 (모양이 없으면 -1) · 맨 앞 줄 0 */
export function rowOfDot(d: Dots, k: number): number {
  if (d.form === FORM_SCATTER) return -1
  const s = d.slot[k]!
  return s < 0 ? -1 : layoutOf(d.form, d.N).rowOf[s]!
}
export const rowCount = (d: Dots): number => d.form === FORM_SCATTER ? 0 : layoutOf(d.form, d.N).rows
/** 지금 점 자리 (모양 기억이 있으면 그것 · 없으면 옛 흩어짐) */
export const offU = (id: number, k: number): number => states.get(id)?.cu[k] ?? dotDu(id, k)
export const offV = (id: number, k: number): number => states.get(id)?.cv[k] ?? dotDv(id, k)
export const peekDots = (id: number): Dots | undefined => states.get(id)
