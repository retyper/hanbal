/**
 * 무리의 기본 행동과 큰 수 (C2 묶음 2 · docs/realm/battle-study/51-prototype.md §2·§3·§7·§8)
 *
 * 기본 행동(명령 없음): 장수를 따라 진을 맞춰 온다 — 앞줄은 장수 앞 followFrontCells, 활은 장수 뒤, 기병은 장수 옆 뒤.
 *   적이 autoEngageCells 안에 들면 앞줄·기병은 알아서 맞붙고, 활은 사거리 안의 적을 알아서 쏜다. 무너지는 적은 기병이 알아서 쫓는다.
 * 큰 수: 돌격(쐐기로 달려 들이침) · 방진(멈춰 촘촘한 네모) · 화살비(찍은 자리) · 기병 옆치기(도는 길 → 들이침 → 빠짐).
 * 무너진 대(사기가 tacBreakMorale 아래)는 도망치며 곁의 우리 대 사기를 깎는다(도미노).
 * 입력이 없는 편(장수가 손으로 몰리지 않는 편)은 planTick 에 옆치기 하나를 두고 omenSec 전에 예고 사건을 낸다.
 * 장수가 없는 편과 P.field.followHero 0 이면 옛 임시 AI (sim.ts retarget) 그대로다.
 * sim 쪽 파일: 난수는 roll 만 · 시계·DOM·삼각함수·** 없음 (tests/field/purity.test.ts).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { clamp, dist2, idiv, isqrt } from './num.ts'
import { emit } from './hero.ts'
import { alarmed, banks, campU, detour, fwd, lastU, lastV, leash, m, mul, nearestFoe, rankCmp, ticksOf } from './sim.ts'
import { CMD_FIRE, CMD_HEIGHT, FORM_AUTO, FORM_CHARGE, FORM_HOLD, FORM_OPEN, GRPS, OP_RALLY, OP_STANCE, ORD_CHARGE, ORD_FLANK, ORD_HOLD, ORD_NONE, ORD_VOLLEY, STANCE_CHARGE, STANCE_HOLD, WHY_NO_MEN, WHY_NONE, WHY_NOT_YET } from './types.ts'
import type { FieldInput, FieldState, Grp, Hero, Point, Squad } from './types.ts'

const MILLI = 1000
const ROW: Readonly<Record<Grp, number>> = { front: 0, bows: 1, horse: 2 }
const sq = (x: number): number => x * x
const cells = (n: number): number => n * P.field.unit

/** 이 편이 장수를 따라 진을 맞추나 (장수가 있고 followHero 가 켜져 있으면) */
export const follows = (s: FieldState, side: 0 | 1): boolean => P.field.followHero === 1 && s.heroes.some(h => h.side === side)
const heroOf = (s: FieldState, side: 0 | 1): Hero | null => s.heroes.find(h => h.side === side) ?? null
const groupOf = (s: FieldState, side: 0 | 1, g: Grp): Squad[] => s.squads.filter(q => q.side === side && q.grp === g)
const live = (qs: readonly Squad[]): Squad[] => qs.filter(q => q.men > 0)
const sorted = (s: FieldState, qs: Squad[]): Squad[] => qs.sort((a, b) => rankCmp(s, a, b))

/** 진의 폭 (단위) — 사람 수에 비례 (1,000명마다 formCellsPer1000Men 칸) · 판 폭의 3분의 1 을 넘지 않는다 */
export function formWidth(s: FieldState, men: number): number {
  return Math.min(mul(cells(s.map.w), P.field.formWidthMaxPermille), idiv(men * P.field.formCellsPer1000Men * P.field.unit, MILLI))
}

/** 무리 한 줄의 진 자리 (기준 점에서의 상대 자리) — 자세(form)마다 다른 꼴 */
export function slotOf(q: Squad, i: number, n: number, width: number): Point {
  const f = fwd(q.side)
  if (q.grp === 'front' && q.form === FORM_HOLD) {
    // 방진 — 두 줄 네모 · 대 사이는 sepCells (밀어내기가 벌리지 않는 가장 가까운 거리)
    const gap = cells(P.field.sepCells)
    const cols = 2, rows = idiv(n + 1, cols)
    const c = i % cols, r = idiv(i, cols)
    return { u: -f * (idiv((2 * r + 1 - rows) * gap, 2)), v: idiv((2 * c + 1 - cols) * gap, 2) }
  }
  if (q.grp === 'horse') {
    // 기병은 두 줄 뭉치 (옆치기 길을 같이 돈다)
    const gap = cells(P.field.sepCells)
    const c = i % 2, r = idiv(i, 2)
    return { u: -f * r * gap, v: idiv((2 * c - 1) * gap, 2) }
  }
  const along = idiv(((2 * i + 1) - n) * width, 2 * n)
  if (q.grp === 'front' && q.form === FORM_CHARGE) {
    // 돌격 — 앞이 뾰족한 쐐기 (가운데 대가 앞) · 폭은 wedgePermille 로 좁힌다
    const k = Math.min(i, n - 1 - i)
    return { u: f * k * cells(P.field.wedgeStepCells), v: mul(along, P.field.wedgePermille) }
  }
  if (q.grp === 'front' && q.form === FORM_OPEN) {
    // 길 트기 — 가운데가 벌어진 두 줄 (우리 활이 그 사이로 쏜다)
    const half = i < idiv(n, 2) ? -1 : 1
    return { u: 0, v: along + half * cells(P.field.openGapCells) }
  }
  return { u: 0, v: along }
}

/** 장수를 따르는 무리 기준 점 (편 · 무리) — 앞줄은 앞, 활은 뒤, 기병은 옆 뒤 */
function followAnchor(s: FieldState, h: Hero, g: Grp): Point {
  const f = fwd(h.side)
  const mid = idiv(cells(s.map.w), 2)
  const side = h.v <= mid ? 1 : -1
  const p = g === 'front' ? { u: h.u + f * cells(P.field.followFrontCells), v: h.v }
    : g === 'bows' ? { u: h.u - f * cells(P.field.followBowsBackCells), v: h.v }
    : { u: h.u - f * cells(P.field.followHorseBackCells), v: h.v + side * cells(P.field.followHorseSideCells) }
  return { u: clamp(p.u, 0, lastU(s.map)), v: clamp(p.v, 0, lastV(s.map)) }
}

/** 판을 만들 때 — 명령 칸 · 적의 큰 수 틱 */
export function armyInit(s: FieldState): void {
  for (const side of [0, 1] as const) {
    const span = Math.max(0, P.field.planMaxSec - P.field.planMinSec)
    const hasHorse = s.squads.some(q => q.side === side && q.grp === 'horse' && q.men > 0)
    s.planTick[side] = hasHorse && P.field.followHero === 1 ? ticksOf(P.field.planMinSec) + Math.floor(roll(s.seed, 0, `plan:${side}`) * (ticksOf(span) + 1)) : -1
  }
}

function setOrder(s: FieldState, side: 0 | 1, g: Grp, ord: number, at: Point | null): void {
  for (const q of groupOf(s, side, g)) {
    q.order = ord; q.orderTick = s.tick; q.orderAt = at ? { ...at } : null
    q.manual = 0; q.foe = -1; q.ran = 0; q.hitTick = -1
    if (g === 'front') q.form = ord === ORD_CHARGE ? FORM_CHARGE : ord === ORD_HOLD ? FORM_HOLD : q.form === FORM_OPEN ? FORM_OPEN : FORM_AUTO
  }
  s.route[side * 3 + ROW[g]] = []
}

/** 옆치기를 건다 — 겨눈 적 대 t 의 옆 바깥 → 뒤를 돌아 들이친다 (도는 길은 t 를 따라 틱마다 다시 잡는다) */
export function startFlank(s: FieldState, side: 0 | 1, t: Squad): void {
  setOrder(s, side, 'horse', ORD_FLANK, { u: t.u, v: t.v })
  for (const q of groupOf(s, side, 'horse')) q.target = t.id
  s.route[side * 3 + 2] = flankRoute(s, side, t, 2)
}

/** 도는 길의 남은 점 (steps 개 · 옆 바깥 점 → 뒤 점) — 기병 뭉치가 t 의 어느 옆에 있느냐로 도는 쪽을 정한다 */
function flankRoute(s: FieldState, side: 0 | 1, t: Squad, steps: number): Point[] {
  const qs = live(groupOf(s, side, 'horse'))
  let hv = t.v
  if (qs.length) hv = idiv(qs.reduce((a, q) => a + q.v, 0), qs.length)
  const mid = idiv(cells(s.map.w), 2)
  const sgn = hv > t.v || (hv === t.v && t.v < mid) ? 1 : -1
  const ft = fwd(t.side), wide = cells(P.field.flankWideCells), back = cells(P.field.flankBackCells)
  const pin = (p: Point): Point => ({ u: clamp(p.u, 0, lastU(s.map)), v: clamp(p.v, 0, lastV(s.map)) })
  const pts = [pin({ u: t.u, v: t.v + sgn * wide }), pin({ u: t.u - ft * back, v: t.v + sgn * idiv(wide, 2) })]
  return pts.slice(pts.length - steps)
}

/** 큰 수·무리 명령 (OP_STANCE · OP_AIM · OP_RALLY) — 꼴은 sim.ts inputOk 가 이미 봤다 · 받을 수 없으면 까닭만 남긴다 */
export function armyInput(s: FieldState, i: FieldInput): void {
  if (i.op === OP_RALLY) { for (const g of GRPS) setOrder(s, 0, g, ORD_NONE, null); return }
  const g = GRPS[i.g]!
  const gi = i.g as 0 | 1 | 2
  const why = (w: number): void => { s.grpWhy[gi] = w; s.grpWhyTick[gi] = s.tick }
  if (live(groupOf(s, 0, g)).length === 0) return why(WHY_NO_MEN)
  if (i.op === OP_STANCE && g !== 'front' && (i.u === CMD_FIRE || i.u === CMD_HEIGHT)) return why(WHY_NOT_YET)
  why(WHY_NONE)
  if (i.op === OP_STANCE && g === 'front') {
    const qs = groupOf(s, 0, 'front')
    for (const q of qs) q.stance = i.u as 0 | 1 | 2
    if (i.u === STANCE_CHARGE) setOrder(s, 0, 'front', ORD_CHARGE, null)
    else if (i.u === STANCE_HOLD) {
      // 방진은 한 번 더 누르면 풀린다 (기본 행동으로)
      const on = qs.some(q => q.order === ORD_HOLD)
      setOrder(s, 0, 'front', on ? ORD_NONE : ORD_HOLD, on ? null : centerOf(live(qs)))
    } else { for (const q of qs) q.form = FORM_OPEN }
    return
  }
  if (i.op === OP_STANCE) {
    for (const q of groupOf(s, 0, g)) q.cmd = i.u
    // 활 0 · 기병 0 은 찍지 않고 눌러도 된다: 화살비는 가장 가까운 적 앞줄 자리에 · 옆치기는 적 활에
    if (g === 'bows' && i.u === 0) { const t = nearestTo(s, 1, centerOf(live(groupOf(s, 0, g))), q => q.grp === 'front'); if (t) setOrder(s, 0, g, ORD_VOLLEY, { u: t.u, v: t.v }) }
    if (g === 'horse' && i.u === 0) { const t = nearestTo(s, 1, centerOf(live(groupOf(s, 0, g))), q => q.grp === 'bows') ?? nearestTo(s, 1, centerOf(live(groupOf(s, 0, g))), () => true); if (t) startFlank(s, 0, t) }
    return
  }
  // OP_AIM — 화살비는 찍은 자리 · 옆치기는 찍은 자리에 가장 가까운 적 대
  const at = { u: clamp(i.u, 0, lastU(s.map)), v: clamp(i.v, 0, lastV(s.map)) }
  if (g === 'bows') { setOrder(s, 0, g, ORD_VOLLEY, at); return }
  const t = nearestTo(s, 1, at, () => true)
  if (t) startFlank(s, 0, t)
}

const centerOf = (qs: readonly Squad[]): Point => qs.length ? { u: idiv(qs.reduce((a, q) => a + q.u, 0), qs.length), v: idiv(qs.reduce((a, q) => a + q.v, 0), qs.length) } : { u: 0, v: 0 }

/** p 에 가장 가까운 side 편 산 대 (동점은 자리 · 시작 자리) */
function nearestTo(s: FieldState, side: 0 | 1, p: Point, ok: (q: Squad) => boolean): Squad | null {
  let best: Squad | null = null, bd = 0
  for (const q of s.squads) {
    if (q.side !== side || q.men <= 0 || q.flee === 1 || !ok(q)) continue
    const d = dist2(p.u, p.v, q.u, q.v)
    if (best === null || d < bd || (d === bd && rankCmp(s, q, best) < 0)) { best = q; bd = d }
  }
  return best
}

const breakLine = (): number => m(P.realm.tacBreakMorale)
/** 무너졌나 (처음 사기의 tacBreakMorale 아래) */
export const broken = (q: Squad): boolean => q.morale * MILLI < q.morale0 * breakLine()

/**
 * 틱마다 (입력 뒤 · 맞붙기 앞) — 도망 · 적의 큰 수 · 명령 끝 · 진 자리와 목표.
 * 장수를 따르는 편의 대만 여기서 목표를 정한다 (손으로 몬 대·적을 쳐라 받은 대는 sim.ts 가 그대로 본다).
 */
export function armyTick(s: FieldState): void {
  for (const q of s.squads) q.flee = q.men > 0 && broken(q) ? 1 : 0
  for (const side of [0, 1] as const) if (follows(s, side)) { enemyPlan(s, side); expire(s, side); place(s, side); holdCamp(s, side) }
}

/** 입력 없는 편의 큰 수 하나 — planTick 에 적 앞줄 가운데 사람이 가장 많은 대에 옆치기 · omenSec 전에 예고 (올 길) */
function enemyPlan(s: FieldState, side: 0 | 1): void {
  const h = heroOf(s, side)
  if (s.planTick[side] < 0 || !h || h.manual === 1) return
  const at = s.planTick[side]
  if (s.tick !== at - ticksOf(P.field.omenSec) && s.tick !== at) return
  let t: Squad | null = null
  for (const q of s.squads) if (q.side !== side && q.grp === 'front' && q.men > 0 && q.flee === 0 && (t === null || q.men > t.men || (q.men === t.men && rankCmp(s, q, t) < 0))) t = q
  const hs = live(groupOf(s, side, 'horse'))
  if (!t || hs.length === 0) return
  if (s.tick === at) { startFlank(s, side, t); return }
  emit(s, { kind: 'omen', side, id: t.id, u: t.u, v: t.v, n: hs.reduce((a, q) => a + q.men, 0), pts: [centerOf(hs), ...flankRoute(s, side, t, 2), { u: t.u, v: t.v }] })
}

/** 명령이 끝났나 — 돌격은 겨눈 적이 없어지면 · 화살비는 volleySec · 옆치기는 닿고 flankStaySec 뒤(또는 flankMaxSec) */
function expire(s: FieldState, side: 0 | 1): void {
  for (const g of GRPS) {
    const qs = groupOf(s, side, g)
    const q0 = qs[0]
    if (!q0 || q0.order === ORD_NONE) continue
    const age = s.tick - q0.orderTick
    if (q0.order === ORD_VOLLEY && age >= ticksOf(P.field.volleySec)) setOrder(s, side, g, ORD_NONE, null)
    else if (q0.order === ORD_FLANK) {
      const t = q0.target >= 0 ? s.squads[q0.target]! : null
      const hit = qs.reduce((a, q) => q.hitTick >= 0 && (a < 0 || q.hitTick < a) ? q.hitTick : a, -1)
      if (!t || t.men <= 0 || age >= ticksOf(P.field.flankMaxSec) || (hit >= 0 && s.tick - hit >= ticksOf(P.field.flankStaySec))) setOrder(s, side, g, ORD_NONE, null)
    } else if (q0.order === ORD_CHARGE && age >= ticksOf(P.field.chargeMaxSec) && !qs.some(q => q.lock >= 0)) setOrder(s, side, g, ORD_NONE, null)
  }
}

/** 진 자리와 목표 (장수를 따르는 편) */
function place(s: FieldState, side: 0 | 1): void {
  const h = heroOf(s, side)!
  const f = fwd(side)
  const engage2 = sq(cells(P.field.autoEngageCells))
  for (const g of GRPS) {
    const qs = sorted(s, live(groupOf(s, side, g)))
    const idx = side * 3 + ROW[g]
    if (qs.length === 0) continue
    const q0 = qs[0]!
    if (q0.manual === 1 || q0.foe >= 0) { s.anchor[idx] = centerOf(qs); continue }
    const width = formWidth(s, qs.reduce((a, q) => a + q.men, 0))
    let anchor = followAnchor(s, h, g)
    if (q0.order === ORD_HOLD && q0.orderAt) anchor = q0.orderAt
    if (q0.order === ORD_VOLLEY && q0.orderAt) {
      // 화살비 — 찍은 자리가 닿는 거리(의 volleyReachPermille) 안에 들 때까지 다가간다 · 들면 선다
      const c = centerOf(qs), r = mul(qs[0]!.reach, P.field.volleyReachPermille)
      anchor = dist2(c.u, c.v, q0.orderAt.u, q0.orderAt.v) > r * r ? stepPoint(c, q0.orderAt, r) : c
    }
    if (q0.order === ORD_FLANK) {
      const t = s.squads[q0.target]!
      const rt = s.route[idx]!
      const c = centerOf(qs)
      if (rt.length > 0) {
        const fresh = flankRoute(s, side, t, rt.length)
        if (dist2(c.u, c.v, fresh[0]!.u, fresh[0]!.v) <= sq(cells(P.field.flankReachCells))) fresh.shift()
        s.route[idx] = fresh
      }
      anchor = s.route[idx]!.length > 0 ? s.route[idx]![0]! : { u: t.u, v: t.v }
      for (const q of qs) { q.target = t.id; q.goal = s.route[idx]!.length > 0 ? anchor : { u: t.u, v: t.v } }
      s.anchor[idx] = anchor
      continue
    }
    s.anchor[idx] = anchor
    qs.forEach((q, i) => {
      const o = slotOf(q, i, qs.length, width)
      const slot = { u: clamp(anchor.u + o.u, 0, lastU(s.map)), v: clamp(anchor.v + o.v, 0, lastV(s.map)) }
      if (q.flee === 1) { q.target = -1; q.goal = { u: clamp(campU(s, side) - f * cells(P.field.fleeBackCells), 0, lastU(s.map)), v: q.v }; return }
      if (q.order === ORD_CHARGE) {
        // 돌격 — 가장 가까운 적 (앞줄 먼저) 에게 달려간다
        const e = nearestFoe(s, q, t => t.flee === 0 && t.grp === 'front') ?? nearestFoe(s, q, t => t.flee === 0)
        q.target = e ? e.id : -1
        q.goal = e ? detour(s, q, e) : slot
        return
      }
      if (q.order === ORD_HOLD || q.grp === 'bows') { q.target = -1; q.goal = slot; return }
      // 기본 행동 — 닿는 적과 알아서 맞붙는다 · 기병은 무너지는(사기가 tacPursueMorale 아래) 적을 쫓는다
      const pursue = q.grp === 'horse' ? nearestFoe(s, q, (t, d) => d <= sq(cells(P.field.pursueCells)) && t.morale * MILLI < t.morale0 * m(P.realm.tacPursueMorale)) : null
      const e = pursue ?? nearestFoe(s, q, (t, d) => d <= engage2 && t.flee === 0)
      q.target = e ? e.id : -1
      q.goal = e ? detour(s, q, e) : slot
    })
  }
}

/** a 에서 b 쪽으로, b 에서 r 만큼 덜 간 점 */
function stepPoint(a: Point, b: Point, r: number): Point {
  const du = b.u - a.u, dv = b.v - a.v
  const d2 = du * du + dv * dv
  if (d2 <= r * r) return a
  const len = isqrt(d2)
  const k = len - r
  return { u: a.u + idiv(du * k, Math.max(1, len)), v: a.v + idiv(dv * k, Math.max(1, len)) }
}

/** 걸음 배수 (‰) — 돌격·옆치기 들이침은 달리고(도움닫기 거리로 붙는 가속) · 도망은 fleeSpeedPermille */
export function runMul(s: FieldState, q: Squad): number {
  if (q.flee === 1) return P.field.fleeSpeedPermille
  const t = q.target >= 0 ? s.squads[q.target] : undefined
  if (!t || t.men <= 0) return MILLI
  const charging = q.grp === 'front' && q.order === ORD_CHARGE
  const striking = q.grp === 'horse' && q.order === ORD_FLANK && s.route[q.side * 3 + 2]!.length === 0
  if (!charging && !striking) return MILLI
  const start = cells(charging ? P.field.chargeRunCells : P.field.flankRunCells)
  if (dist2(q.u, q.v, t.u, t.v) > start * start) return MILLI
  const top = charging ? P.field.chargeSpeedPermille : P.field.flankSpeedPermille
  const acc = cells(charging ? P.field.chargeAccelCells : P.field.flankAccelCells)
  // 보병 걸음 = 1 로 잰 배수를 이 무리 걸음 배수로 (기병은 제 걸음이 이미 빠르다)
  const base = mul(top, idiv(P.field.speedFrontCellsPerSec * MILLI, q.grp === 'front' ? P.field.speedFrontCellsPerSec : P.field.speedHorseCellsPerSec))
  return MILLI + idiv((Math.max(MILLI, base) - MILLI) * Math.min(q.ran, acc), Math.max(1, acc))
}

/** 지키는 편(진영 hold) — 깨기 전에는 제자리 · 깬 뒤에도 시작 자리에서 leashCells · 물가 안으로만 (sim.ts 의 옛 규칙 그대로) */
function holdCamp(s: FieldState, side: 0 | 1): void {
  if (!s.map.camps[side].hold) return
  const al = alarmed(s, side), bank = banks(s)
  for (const q of s.squads) {
    if (q.side !== side || q.men <= 0 || q.manual === 1 || q.foe >= 0) continue
    if (!al) { q.goal = null; q.target = -1; continue }
    if (q.goal) q.goal = leash(s, q, q.goal, bank)
  }
}
