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
import { clamp, dist2, idiv, isqrt, stepToward } from './num.ts'
import { emit, trySkill } from './hero.ts'
import { sideMorale, alarmed, avgU, banks, campU, detour, fwd, lastU, lastV, leash, m, mul, nearestFoe, perTickAt, rankCmp, ticksOf } from './sim.ts'
import { ORD_ATTACK, CMD_FIRE, CMD_HEIGHT, FORM_AUTO, FORM_CHARGE, FORM_HOLD, FORM_OPEN, GRPS, OP_RALLY, OP_STANCE, ORD_CHARGE, ORD_FLANK, ORD_HOLD, ORD_NONE, ORD_VOLLEY, STANCE_CHARGE, STANCE_HOLD, WHY_NO_MEN, WHY_NONE, WHY_NOT_YET } from './types.ts'
import { LINE_SHIELD, LINE_WEDGE, LINE_WINGS, STANCE_NONE, STANCE_OPEN } from './types.ts'
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

/** 줄 한 칸의 간격 (대 몸 폭 + 틈) — 방진은 holdGapCells */
const pitchOf = (q: Squad): number => q.bw + cells(q.grp === 'front' && q.form === FORM_HOLD ? P.field.holdGapCells : P.field.lineGapCells)
/** n 대가 선 줄의 반 길이 (단위) */
const halfLine = (q: Squad, n: number): number => idiv(n * pitchOf(q) - (pitchOf(q) - q.bw), 2)

/**
 * 진 자리 (C2 묶음 3 · 무리 기준 점에서의 상대 자리) — 앞줄·활은 가로 한 줄(틈 lineGapCells) · 방진은 틈 holdGapCells ·
 * 돌격은 쐐기(가운데 대가 wedgeStepCells 앞) · 길 트기는 가운데가 openGapCells 더 벌어진 두 줄 · 기병은 양 날개에 둘씩(뒤로 한 대씩).
 * 기병의 기준 점은 앞줄 기준 점이고, 앞줄 줄 끝에서 wingOutCells 바깥 · wingBackCells 뒤 (frontHalf = 앞줄 줄의 반 길이).
 */
export function slotOf(q: Squad, i: number, n: number, frontHalf: number, line = 0): Point {
  const f = fwd(q.side)
  if (q.grp === 'horse') {
    const wing = i % 2 === 0 ? -1 : 1, row = idiv(i, 2)
    // 넓은 날개 진 (52 §6-1) — 기병이 더 바깥 · 더 앞 (옆치기가 빨리 닿는다)
    const wide = line === LINE_WINGS
    const back = wide ? P.field.lineWingsBackCells : P.field.wingBackCells, out = P.field.wingOutCells + (wide ? P.field.lineWingsOutCells : 0)
    return { u: -f * (cells(back) + row * (q.bd + cells(P.field.lineGapCells))), v: wing * (frontHalf + cells(out) + idiv(q.bw, 2)) }
  }
  const p = pitchOf(q)
  const along = idiv((2 * i + 1 - n) * p, 2)
  if (q.grp === 'front' && q.form === FORM_CHARGE) {
    const k = Math.min(i, n - 1 - i)
    return { u: f * k * cells(P.field.wedgeStepCells), v: along }
  }
  if (q.grp === 'front' && q.form === FORM_OPEN) return { u: 0, v: along + (i < idiv(n, 2) ? -1 : 1) * cells(P.field.openGapCells) }
  return { u: 0, v: along }
}

/** 장수를 따르는 앞줄 기준 점 — 장수 앞 followFrontCells (판 안으로) */
function frontAnchor(s: FieldState, h: Hero): Point {
  return { u: clamp(h.u + fwd(h.side) * cells(P.field.followFrontCells), 0, lastU(s.map)), v: clamp(h.v, 0, lastV(s.map)) }
}
/** 활 기준 점 — 앞줄 뒤 가장자리에서 bowsGapCells 뒤 (활 줄의 앞 가장자리) */
function bowsAnchor(s: FieldState, front: Point, side: 0 | 1, frontD: number, bowsD: number): Point {
  return { u: clamp(front.u - fwd(side) * (idiv(frontD, 2) + cells(P.field.bowsGapCells) + idiv(bowsD, 2)), 0, lastU(s.map)), v: front.v }
}

/** 판을 만들 때 — 명령 칸 · 적의 큰 수 틱 */
export function armyInit(s: FieldState): void {
  for (const side of [0, 1] as const) {
    const span = Math.max(0, P.field.planMaxSec - P.field.planMinSec)
    const hasHorse = s.squads.some(q => q.side === side && q.grp === 'horse' && q.men > 0)
    s.planTick[side] = hasHorse && P.field.followHero === 1 ? ticksOf(P.field.planMinSec) + Math.floor(roll(s.seed, 0, `plan:${side}`) * (ticksOf(span) + 1)) : -1
  }
  formUp(s)
}

function setOrder(s: FieldState, side: 0 | 1, g: Grp, ord: number, at: Point | null): void {
  for (const q of groupOf(s, side, g)) {
    q.order = ord; q.orderTick = s.tick; q.orderAt = at ? { ...at } : null
    q.manual = 0; q.foe = -1; q.ran = 0; q.hitTick = -1
    if (g === 'front') q.form = ord === ORD_CHARGE ? FORM_CHARGE : ord === ORD_HOLD ? FORM_HOLD : q.form === FORM_OPEN ? FORM_OPEN : FORM_AUTO
    // 자세는 명령을 따른다 — 돌격·방진이 끝나면 기본 자세로 (길 트기는 남는다 · 끝난 돌격 자세가 판 내내 세모 상성에 걸리던 것)
    if (g === 'front') q.stance = ord === ORD_CHARGE ? STANCE_CHARGE : ord === ORD_HOLD ? STANCE_HOLD : q.stance === STANCE_OPEN ? STANCE_OPEN : STANCE_NONE
    if (g === 'front') q.bd = cells(q.form === FORM_HOLD ? P.field.holdBodyDCells : P.field.bodyDCells)
  }
  s.route[side * 3 + ROW[g]] = []
}

/** 옆치기를 건다 — 겨눈 적 대 t 의 옆 바깥 → 뒤를 돌아 들이친다 (도는 길은 t 를 따라 틱마다 다시 잡는다) */
export function startFlank(s: FieldState, side: 0 | 1, t: Squad): void {
  setOrder(s, side, 'horse', ORD_FLANK, { u: t.u, v: t.v })
  for (const q of groupOf(s, side, 'horse')) q.target = t.id
  s.route[side * 3 + 2] = flankRoute(s, side, t, 2)
}

/**
 * 도는 길의 남은 점 (steps 개) — 적 무리 전체의 옆 바깥(가장자리에서 flankWideCells)으로 나가 적 앞줄 높이 → 겨눈 대 뒤(flankBackCells) 높이.
 * 기병 뭉치가 적 가운데보다 어느 옆에 있느냐로 도는 쪽을 정하고, 그 옆이 판 밖이면 반대쪽으로 돈다 (적 줄을 뚫고 지나가지 않게).
 */
function flankRoute(s: FieldState, side: 0 | 1, t: Squad, steps: number): Point[] {
  const foes = s.squads.filter(q => q.side === t.side && q.men > 0 && q.flee === 0)
  const qs = live(groupOf(s, side, 'horse'))
  const ft = fwd(t.side), wide = cells(P.field.flankWideCells), back = cells(P.field.flankBackCells)
  let vmin = t.v, vmax = t.v, vs = 0, near = t.u
  for (const q of foes) { vmin = Math.min(vmin, q.v); vmax = Math.max(vmax, q.v); vs += q.v; if ((q.u - near) * ft > 0) near = q.u }
  const vc = foes.length ? idiv(vs, foes.length) : t.v
  const hv = qs.length ? idiv(qs.reduce((a, q) => a + q.v, 0), qs.length) : vc
  const W = lastV(s.map)
  let sgn = hv >= vc ? 1 : -1
  const edge = (g: number): number => g > 0 ? vmax + wide : vmin - wide
  if (edge(sgn) < 0 || edge(sgn) > W) sgn = -sgn
  const ev = clamp(edge(sgn), 0, W)
  const pin = (p: Point): Point => ({ u: clamp(p.u, 0, lastU(s.map)), v: clamp(p.v, 0, W) })
  const pts = [pin({ u: near + ft * cells(P.field.flankReachCells), v: ev }), pin({ u: t.u - ft * back, v: ev })]
  return pts.slice(pts.length - steps)
}

/** 큰 수·무리 명령 (OP_STANCE · OP_AIM · OP_RALLY) — 꼴은 sim.ts inputOk 가 이미 봤다 · 받을 수 없으면 까닭만 남긴다 */
export function armyInput(s: FieldState, i: FieldInput, side: 0 | 1 = 0): void {
  const foe = (1 - side) as 0 | 1
  if (i.op === OP_RALLY) { for (const g of GRPS) setOrder(s, side, g, ORD_NONE, null); s.frontLockTick[side] = -1; return }
  const g = GRPS[i.g]!
  const gi = i.g as 0 | 1 | 2
  const why = (w: number): void => { if (side === 0) { s.grpWhy[gi] = w; s.grpWhyTick[gi] = s.tick } }
  if (live(groupOf(s, side, g)).length === 0) return why(WHY_NO_MEN)
  if (i.op === OP_STANCE && g !== 'front' && (i.u === CMD_FIRE || i.u === CMD_HEIGHT)) return why(WHY_NOT_YET)
  why(WHY_NONE)
  if (i.op === OP_STANCE && g === 'front') {
    const qs = groupOf(s, side, 'front')
    for (const q of qs) q.stance = i.u as 0 | 1 | 2
    if (i.u === STANCE_CHARGE) setOrder(s, side, 'front', ORD_CHARGE, null)
    else if (i.u === STANCE_HOLD) {
      // 방진은 한 번 더 누르면 풀린다 (기본 행동으로)
      const on = qs.some(q => q.order === ORD_HOLD)
      setOrder(s, side, 'front', on ? ORD_NONE : ORD_HOLD, on ? null : centerOf(live(qs)))
    } else { for (const q of qs) q.form = FORM_OPEN }
    return
  }
  if (i.op === OP_STANCE) {
    for (const q of groupOf(s, side, g)) q.cmd = i.u
    // 활 0 · 기병 0 은 찍지 않고 눌러도 된다: 화살비는 가장 가까운 적 앞줄 자리에 · 옆치기는 적 활에
    if (g === 'bows' && i.u === 0) { const t = nearestTo(s, foe, centerOf(live(groupOf(s, side, g))), q => q.grp === 'front'); if (t) setOrder(s, side, g, ORD_VOLLEY, { u: t.u, v: t.v }) }
    if (g === 'horse' && i.u === 0) { const t = nearestTo(s, foe, centerOf(live(groupOf(s, side, g))), q => q.grp === 'bows') ?? nearestTo(s, foe, centerOf(live(groupOf(s, side, g))), () => true); if (t) startFlank(s, side, t) }
    return
  }
  // OP_AIM — 화살비는 찍은 자리 · 옆치기는 찍은 자리에 가장 가까운 적 대
  const at = { u: clamp(i.u, 0, lastU(s.map)), v: clamp(i.v, 0, lastV(s.map)) }
  if (g === 'bows') { setOrder(s, side, g, ORD_VOLLEY, at); return }
  const t = nearestTo(s, foe, at, () => true)
  if (t) startFlank(s, side, t)
}

/** 대들의 가운데 — u 는 편마다 반대로 반올림한다 (거울 판에서 정확히 뒤집히게 · avgU) */
const centerOf = (qs: readonly Squad[]): Point => qs.length ? { u: avgU(qs.reduce((a, q) => a + q.u, 0), qs.length, qs[0]!.side), v: idiv(qs.reduce((a, q) => a + q.v, 0), qs.length) } : { u: 0, v: 0 }

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
export function armyTick(s: FieldState, full: boolean): void {
  standUp(s)
  regroup(s)
  // 무너진 대는 달아난다 · 편이 무너졌으면(sideBreak) 그 편의 남은 대가 모두 손을 놓고 달아난다 (검수 B5)
  for (const q of s.squads) {
    const fall = s.breakTick[q.side] >= 0
    q.flee = q.men > 0 && (broken(q) || fall) ? 1 : 0
    if (fall && q.manual === 1) { q.manual = 0; q.foe = -1 }
  }
  // 진 자리·목표는 retargetMs 마다(입력이 들어온 틱에는 곧바로) · 예고·명령 끝은 틱마다
  for (const side of [0, 1] as const) if (follows(s, side)) { enemyPlan(s, side); expire(s, side) }
  // 적 AI 의 수는 두 편 다 같은 틱 상태로 먼저 정하고 나서 건다 (한 편이 먼저 건 수를 다른 편이 같은 틱에 읽으면 거울 판이 어긋난다)
  if (full) { const acts = ([0, 1] as const).flatMap(side => follows(s, side) ? aiTactics(s, side) : []); for (const a of acts) a() }
  for (const side of [0, 1] as const) if (follows(s, side)) { moveAnchor(s, side); if (full) { place(s, side); holdCamp(s, side) } }
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

/**
 * 입력 없는 편의 큰 수 (검수 W10 · 진에 따라 갈린다 — 진은 씨앗) — 판 상태로만 가른다 (굴림 없음 · 거울 판이 정확히 뒤집힌다):
 * 적 기병 옆치기가 우리 대 aiHoldCells 안까지 오거나(방패 벽 진이면 적 앞줄 돌격이 와도) 앞줄 방진 · 위협이 aiHoldSec 없으면 푼다 ·
 * 적 활이 우리 앞줄 활 사거리 안으로 몰려 오거나(창 쐐기 진이면 적 앞줄이 aiChargeCells 안이면) 앞줄 돌격 · 장수는 곁에 적이 들면 비기(aiSkill).
 */
function aiTactics(s: FieldState, side: 0 | 1): Array<() => void> {
  const acts: Array<() => void> = []
  const h = heroOf(s, side)
  if (!h || h.manual === 1 || s.breakTick[side] >= 0) return acts
  const foe = (1 - side) as 0 | 1
  // 큰 외침은 제 편 사기가 적보다 낮을 때만 (aiSkill 2 면 늘) — 앞선 쪽이 더 굳히지 않게
  const behind = P.field.aiSkill === 2 || sideMorale(s, side) < sideMorale(s, foe)
  // aiSkill 3 = 투지가 찼을 때만 (뒤진 편의 한 번 더 · 52 §6-2)
  const ready = P.field.aiSkill === 3 ? h.grit >= MILLI : behind && (h.artCd === 0 || h.grit >= MILLI)
  if (P.field.aiSkill >= 1 && ready && h.art === 'shout' && h.stun === 0 && h.dash === 0
    && s.squads.some(q => q.side === foe && q.men > 0 && q.flee === 0 && dist2(q.u, q.v, h.u, h.v) <= sq(cells(P.field.heroArtCells)))) acts.push(() => trySkill(s, h, h.u, h.v))
  const fr = live(groupOf(s, side, 'front'))
  if (fr.length === 0) return acts
  const ord = fr[0]!.order, fc = centerOf(fr), r2 = sq(cells(P.field.aiHoldCells))
  const ffr = live(groupOf(s, foe, 'front')), fbw = live(groupOf(s, foe, 'bows'))
  const ffc = ffr.length ? centerOf(ffr) : null
  // 진마다 한 가지 버릇 (진은 씨앗) — 방패 벽은 방진으로 받고 · 창 쐐기는 먼저 돌격하고 · 넓은 날개는 적 활이 몰려 오면 돌격한다
  const threat = s.lineup[side] === LINE_SHIELD && s.squads.some(q => q.side === foe && q.men > 0 && q.grp === 'horse' && q.order === ORD_FLANK && q.target >= 0 && s.squads[q.target]!.side === side && dist2(q.u, q.v, s.squads[q.target]!.u, s.squads[q.target]!.v) <= r2)
    || (s.lineup[side] === LINE_SHIELD && ffc !== null && ffr[0]!.order === ORD_CHARGE && dist2(fc.u, fc.v, ffc.u, ffc.v) <= r2)
  const locked = fr.some(q => q.lock >= 0)
  if (threat && ord === ORD_NONE) { acts.push(() => { for (const q of fr) q.stance = STANCE_HOLD; setOrder(s, side, 'front', ORD_HOLD, fc) }); return acts }
  if (ord === ORD_HOLD) { if (!threat && s.tick - fr[0]!.orderTick >= ticksOf(P.field.aiHoldSec)) acts.push(() => setOrder(s, side, 'front', ORD_NONE, null)); return acts }
  if (ord !== ORD_NONE || locked) return acts
  const fbc = fbw.length ? centerOf(fbw) : null
  const reach = cells(P.field.bowRangeCells)
  // 적 활이 몰려 옴 = 적 활이 적 앞줄보다 우리 앞줄에 가깝고 활 사거리 안 (화살비로 앞으로 나온 활)
  const crowd = s.lineup[side] === LINE_WINGS && fbc !== null && dist2(fc.u, fc.v, fbc.u, fbc.v) <= reach * reach && (ffc === null || dist2(fc.u, fc.v, fbc.u, fbc.v) < dist2(fc.u, fc.v, ffc.u, ffc.v))
  const rush = s.lineup[side] === LINE_WEDGE && ffc !== null && dist2(fc.u, fc.v, ffc.u, ffc.v) <= sq(cells(P.field.aiChargeCells))
  if (crowd || rush) acts.push(() => { for (const q of fr) q.stance = STANCE_CHARGE; setOrder(s, side, 'front', ORD_CHARGE, null) })
  return acts
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
    } else if (q0.order === ORD_CHARGE && (age >= ticksOf(P.field.chargeMaxSec) || live(qs).every(q => q.lock >= 0))) setOrder(s, side, g, ORD_NONE, null)
    // 돌격은 산 대가 모두 맞물리면 끝 (자세는 그대로 · 검수 W7) · 「적을 쳐라」는 그 적이 사라지면 끝
    else if (q0.order === ORD_ATTACK && qs.every(q => q.foe < 0)) setOrder(s, side, g, ORD_NONE, null)
  }
}

/** 진 자리와 목표 (장수를 따르는 편) */
function place(s: FieldState, side: 0 | 1): void {
  // 맞물림 상한 (52 §1-2) — 적 대마다 우리 대가 몇이 붙어 있나 (맞물림 + 이번에 정한 목표) · foeCapPerSquad 넘게는 안 간다
  const taken = new Map<number, number>()
  for (const q of s.squads) if (q.side === side && q.men > 0 && q.lock >= 0) taken.set(q.lock, (taken.get(q.lock) ?? 0) + 1)
  const free = (t: Squad, q: Squad): boolean => q.lock === t.id || (taken.get(t.id) ?? 0) < P.field.foeCapPerSquad
  // 찾아 싸우기 — 한 번 맞붙은 뒤 huntSec 넘게 맞물린 앞줄이 없으면 거리와 상관없이 가까운 적에게 간다 (남은 대끼리 서로 비켜 서서 시간만 가는 판을 막는다)
  const hunt = s.frontLockTick[side] >= 0 && s.tick - s.frontLockTick[side] > ticksOf(P.field.huntSec)
  const f = fwd(side)
  const engage2 = sq(cells(P.field.autoEngageCells))
  // 앞줄 기준 점 (장수 앞) · 앞줄 줄의 반 길이와 깊이 — 활·기병 자리가 이것에 맞춘다
  const F = s.anchor[side * 3]!
  const fqs = sorted(s, live(groupOf(s, side, 'front')))
  const frontHalf = fqs[0] ? halfLine(fqs[0], fqs.length) : cells(P.field.bodyWCells)
  const frontD = fqs[0] ? fqs[0].bd : cells(P.field.bodyDCells)
  for (const g of GRPS) {
    const qs = sorted(s, live(groupOf(s, side, g)))
    const idx = side * 3 + ROW[g]
    if (qs.length === 0) continue
    const q0 = qs[0]!
    if (q0.manual === 1 || q0.foe >= 0) { s.anchor[idx] = centerOf(qs); continue }
    let anchor = g === 'bows' ? bowsAnchor(s, F, side, frontD, q0.bd) : F
    if (q0.order === ORD_HOLD && q0.orderAt) anchor = q0.orderAt
    if (q0.order === ORD_VOLLEY && q0.orderAt) {
      // 화살비 — 찍은 자리가 닿는 거리(의 volleyReachPermille) 안에 들 때까지 다가간다 · 들면 선다
      const c = centerOf(qs), r = mul(qs[0]!.reach, P.field.volleyReachPermille)
      anchor = dist2(c.u, c.v, q0.orderAt.u, q0.orderAt.v) > r * r ? stepPoint(c, q0.orderAt, r) : c
    }
    if (q0.order === ORD_FLANK) {
      // 옆치기 — 대마다 제 쪽 바깥으로 돌아 (날개 둘이면 양쪽에서 집게로) 뒤에서 들이친다 · 단계는 자리로 가른다 (flankStep)
      const t = s.squads[q0.target]!
      qs.forEach((q, i) => { const st = flankStep(s, q, t); q.target = t.id; q.goal = st.goal; if (i === 0) s.route[idx] = st.pts })
      s.anchor[idx] = centerOf(qs)
      continue
    }
    s.anchor[idx] = anchor
    qs.forEach((q, i) => {
      const o = slotOf(q, i, qs.length, frontHalf, s.lineup[side])
      const slot = { u: clamp(anchor.u + o.u, 0, lastU(s.map)), v: clamp(anchor.v + o.v, 0, lastV(s.map)) }
      // 기병 날개는 실제 앞줄보다 앞서지 않는다 — 장수가 앞서 걸으면 기준점이 앞줄보다 빨리 가서(따라붙기) 빠른 기병만 기준점 자리로 달려가
      // 앞줄보다 먼저 적 줄에 혼자 닿았다 (우리 기병만 날개 싸움에서 지던 까닭 · 입력 없는 장수는 앞줄을 앞지르지 않아 안 났다)
      if (q.grp === 'horse' && fqs.length > 0 && P.field.horseBehindFront === 1) {
        const fc = centerOf(fqs), back = cells(s.lineup[side] === LINE_WINGS ? P.field.lineWingsBackCells : P.field.wingBackCells) + idiv(frontD, 2)
        if ((slot.u - (fc.u - f * back)) * f > 0) slot.u = clamp(fc.u - f * back, 0, lastU(s.map))
      }
      if (q.flee === 1) { q.target = -1; q.goal = { u: clamp(campU(s, side) - f * cells(P.field.fleeBackCells), 0, lastU(s.map)), v: q.v }; return }
      if (q.order === ORD_CHARGE) {
        // 돌격 — 가장 가까운 적 (앞줄 먼저) 에게 달려간다
        const e = nearestFoe(s, q, t => t.flee === 0 && t.grp === 'front') ?? nearestFoe(s, q, t => t.flee === 0)
        q.target = e ? e.id : -1
        q.goal = e ? detour(s, q, e) : slot
        return
      }
      if (q.order === ORD_HOLD) { q.target = -1; q.goal = slot; return }
      if (q.grp === 'bows') {
        // 활은 진 자리로 가되 적이 닿는 거리(bowStandoffCells 덜)에 들면 그 자리에 서서 쏜다 (맞붙는 줄 안으로 따라 들어가지 않는다)
        const r = Math.max(0, q.reach - cells(P.field.bowStandoffCells))
        q.target = -1
        // 칼날 든 적이 bowsBackoffCells 안에 오면 (앞줄이 깨져 활이 맨 앞이 되면) 뒤로 물러나 거리를 벌린다 · 아니면 서서 쏜다
        const close = nearestFoe(s, q, (t, d) => t.grp !== 'bows' && t.flee === 0 && d <= sq(cells(P.field.bowsBackoffCells)))
        if (close) { q.goal = { u: clamp(q.u - f * cells(P.field.bowsBackoffCells + 2), 0, lastU(s.map)), v: q.v }; return }
        q.goal = nearestFoe(s, q, (_t, d) => d <= r * r) ? null : slot
        return
      }
      // 기본 행동 — 닿는 적과 알아서 맞붙는다 · 기병은 무너지는(사기가 tacPursueMorale 아래) 적을 쫓는다
      const pursue = q.grp === 'horse' ? nearestFoe(s, q, (t, d) => d <= sq(cells(P.field.pursueCells)) && t.morale * MILLI < t.morale0 * m(P.realm.tacPursueMorale)) : null
      // 감싸기 (52 §1-4) — 맞물리지 않은 대는 wrapCells 안의 「우리와 맞물린 적」의 옆구리로 붙는다 (수가 남는 쪽이 저절로 감싼다)
      if (q.lock < 0 && !pursue && q.grp !== 'horse') {
        const w = nearestFoe(s, q, (t, d) => d <= sq(cells(P.field.wrapCells)) && t.flee === 0 && t.lock >= 0 && s.squads[t.lock]!.side === side && s.squads[t.lock]!.id !== q.id && free(t, q))
        if (w) {
          const sv = q.v >= w.v ? 1 : -1
          taken.set(w.id, (taken.get(w.id) ?? 0) + 1)
          q.target = w.id
          q.goal = { u: w.u, v: clamp(w.v + sv * idiv(w.bw + q.bw, 2), 0, lastV(s.map)) }
          return
        }
      }
      // 기병 날개는 감싸기·맞붙기에 안 끼고 horseGuardCells 안의 적 기병만 막으러 간다 (52 §1-4 · 검수 W3 「예고 없이 가운데로 걸어 들어와 뭉친다」)
      const e = pursue ?? (q.grp === 'horse' ? nearestFoe(s, q, (t, d) => t.grp === 'horse' && d <= sq(cells(P.field.horseGuardCells)) && t.flee === 0 && free(t, q)) : nearestFoe(s, q, (t, d) => (d <= engage2 || hunt) && t.flee === 0 && free(t, q)))
      if (e && !pursue && q.lock !== e.id) taken.set(e.id, (taken.get(e.id) ?? 0) + 1)
      q.target = e ? e.id : -1
      // 제 길(진 자리의 v)에 걸친 적이면 줄을 지킨 채 곧게 앞으로 · 아니면 그 적에게 (쫓기·돌아 들기)
      const lane = e && !pursue && Math.abs(e.v - slot.v) * 2 <= q.bw + e.bw
      q.goal = e ? (lane ? { u: e.u, v: slot.v } : detour(s, q, e)) : slot
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
  const striking = q.grp === 'horse' && q.order === ORD_FLANK && q.target >= 0 && flankStep(s, q, s.squads[q.target]!).strike
  if (!charging && !striking) return MILLI
  const start = cells(charging ? P.field.chargeRunCells : P.field.flankRunCells)
  if (dist2(q.u, q.v, t.u, t.v) > start * start) return MILLI
  const top = charging ? P.field.chargeSpeedPermille : P.field.flankSpeedPermille
  const acc = cells(charging ? P.field.chargeAccelCells : P.field.flankAccelCells)
  // 보병 걸음 = 1 로 잰 배수를 이 무리 걸음 배수로 (기병은 제 걸음이 이미 빠르다)
  const base = mul(top, idiv(P.field.speedFrontCellsPerSec * MILLI, q.grp === 'front' ? P.field.speedFrontCellsPerSec : P.field.speedHorseCellsPerSec))
  // 달리기 시작한 틱도 1 단위 몫을 준다 (ran 0 이면 배수가 정확히 1 이라 「달림」이 안 서고 ran 이 영영 0 이던 것 · 돌격의 쾅이 한 번도 안 나던 까닭)
  return MILLI + Math.max(1, idiv((Math.max(MILLI, base) - MILLI) * Math.min(Math.max(q.ran, 1), acc), Math.max(1, acc)))
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

/**
 * 진의 기준점 (앞줄 줄 가운데 · 52 §1-3) — 장수 앞 followFrontCells 를 따라가되 anchorSlackCells 안이면 그대로 · 빠르기는 보병 걸음.
 * 앞줄 대 하나라도 맞물려 있으면 언다 (맞물림이 freezeSec 없거나 F 로 풀린다) — 장수가 앞으로 걸을 때마다 전군이 밀려 들어가지 않게.
 */
function moveAnchor(s: FieldState, side: 0 | 1): void {
  const h = heroOf(s, side)!
  if (s.squads.some(q => q.side === side && q.grp === 'front' && q.men > 0 && q.lock >= 0)) s.frontLockTick[side] = s.tick
  const lt = s.frontLockTick[side]
  if (lt >= 0 && s.tick - lt < ticksOf(P.field.freezeSec)) return
  const a = s.anchor[side * 3]!, t = frontAnchor(s, h)
  const slack = cells(P.field.anchorSlackCells)
  const d2 = dist2(a.u, a.v, t.u, t.v)
  if (d2 <= slack * slack) return
  const root = isqrt(d2), len = root * root === d2 ? root : root + 1
  const goal = { u: t.u - idiv((t.u - a.u) * slack, len), v: t.v - idiv((t.v - a.v) * slack, len) }
  // 장수가 catchUpCells 넘게 앞서면 진이 뛰어 따라붙는다 (검수 B6 「장수가 군을 버리고 간다」)
  const far = d2 > sq(cells(P.field.catchUpCells))
  s.anchor[side * 3] = stepToward(a.u, a.v, goal.u, goal.v, perTickAt(mul(P.field.speedFrontCellsPerSec * P.field.unit, far ? P.field.catchUpPermille : P.field.anchorSpeedPermille), s.tick))
}

/**
 * 처음 자리도 진 자리로 (52 §1-3 · 「시작 줄」 대신) — 장수를 따르는 편(진영이 줄을 폭으로 펴는 축 0)은 장수 앞 기준점 둘레의 줄에서 시작한다.
 * 시작 자리(homeU·homeV)도 그 자리 (동점 가르기 · 지키는 한계가 이것을 본다).
 */
function formUp(s: FieldState): void {
  for (const side of [0, 1] as const) {
    const h = heroOf(s, side)
    if (!h || !follows(s, side) || s.map.camps[side].axis !== 0) continue
    const F = frontAnchor(s, h)
    s.anchor[side * 3] = F
    const fqs = sorted(s, live(groupOf(s, side, 'front')))
    const frontHalf = fqs[0] ? halfLine(fqs[0], fqs.length) : cells(P.field.bodyWCells)
    const frontD = fqs[0] ? fqs[0].bd : cells(P.field.bodyDCells)
    for (const g of GRPS) {
      const qs = sorted(s, live(groupOf(s, side, g)))
      if (qs.length === 0) continue
      const a = g === 'bows' ? bowsAnchor(s, F, side, frontD, qs[0]!.bd) : F
      const at = qs.map((q, i) => { const o = slotOf(q, i, qs.length, frontHalf, s.lineup[side]); return { u: clamp(a.u + o.u, 0, lastU(s.map)), v: clamp(a.v + o.v, 0, lastV(s.map)) } })
      qs.forEach((q, i) => { q.u = at[i]!.u; q.v = at[i]!.v; q.homeU = q.u; q.homeV = q.v })
    }
    for (const g of GRPS) s.anchor[side * 3 + ROW[g]] = g === 'front' ? F : centerOf(live(groupOf(s, side, g)))
  }
}

/**
 * 옆치기 한 대의 다음 자리 (자취를 들지 않고 지금 자리로 단계를 가른다 · 차례·거울에 안 기댄다):
 * 겨눈 대 뒤(flankBackCells 의 반)를 넘었으면 들이침 · 적 앞줄 선을 넘었거나 바깥 길(적 몸 가장자리 + flankWideCells)에 섰으면 뒤 점으로 · 아니면 바깥 길 앞 점으로.
 * 바깥 길은 이 대가 적 가운데보다 어느 쪽에 있느냐로 (판 밖이면 반대쪽 · 둘 다 밖이면 판 끝).
 */
export function flankStep(s: FieldState, q: Squad, t: Squad): { goal: Point; strike: boolean; pts: Point[] } {
  const ft = fwd(t.side), back = cells(P.field.flankBackCells), reach = cells(P.field.flankReachCells)
  const foes = s.squads.filter(e => e.side === t.side && e.men > 0 && e.flee === 0)
  let vmin = t.v, vmax = t.v, vs = 0, near = t.u
  for (const e of foes) { vmin = Math.min(vmin, e.v - idiv(e.bw, 2)); vmax = Math.max(vmax, e.v + idiv(e.bw, 2)); vs += e.v; if ((e.u - near) * ft > 0) near = e.u }
  const vc = foes.length ? idiv(vs, foes.length) : t.v
  const W = lastV(s.map), pad = cells(P.field.flankWideCells) + idiv(q.bw, 2)
  const edge = (g: number): number => g > 0 ? vmax + pad : vmin - pad
  let sgn = q.v >= vc ? 1 : -1
  if (edge(sgn) < 0 || edge(sgn) > W) { if (!(edge(-sgn) < 0 || edge(-sgn) > W)) sgn = -sgn }
  const ev = clamp(edge(sgn), 0, W)
  const pin = (p: Point): Point => ({ u: clamp(p.u, 0, lastU(s.map)), v: clamp(p.v, 0, W) })
  const p0 = pin({ u: near + ft * reach, v: ev }), p1 = pin({ u: t.u - ft * back, v: ev })
  if ((q.u - t.u) * ft <= -idiv(back, 2)) return { goal: { u: t.u, v: t.v }, strike: true, pts: [] }
  if ((q.u - near) * ft <= 0 || Math.abs(q.v - ev) <= reach) return { goal: p1, strike: false, pts: [p1, { u: t.u, v: t.v }] }
  return { goal: p0, strike: false, pts: [p0, p1, { u: t.u, v: t.v }] }
}

/**
 * 버팀 (52 §6-2 · stand) — 편 사기가 무너짐 문턱 위 standAbovePermille 안으로 처음 내려온 틱에 (판마다 편에 한 번 · 장수가 서 있을 때)
 * 장수 곁(heroArtCells)의 안 달아나는 대 사기가 standRallyPermille 되오르고, standSec 동안 꺾이는 몫의 standSteadyPermille 이 덜 꺾인다 (sim.ts fight · standing).
 */
function standUp(s: FieldState): void {
  const line = breakLine()
  for (const side of [0, 1] as const) {
    if (s.stood[side] === 1 || s.breakTick[side] >= 0) continue
    const h = heroOf(s, side)
    if (!h || h.stun > 0) continue
    const sm = sideMorale(s, side)
    if (sm >= line + P.field.standAbovePermille || sm < line) continue
    s.stood[side] = 1; s.standTick[side] = s.tick
    const r = cells(P.field.heroArtCells), up = P.field.standRallyPermille
    let n = 0
    for (const q of s.squads) if (q.side === side && q.men > 0 && q.flee === 0 && dist2(q.u, q.v, h.u, h.v) <= r * r) { q.calm += up * MILLI; q.morale = clamp(q.morale + up, 0, MILLI); n++ }
    emit(s, { kind: 'stand', side, id: -1, u: h.u, v: h.v, n, r })
  }
}

/** 이 대가 버티는 중인가 (버팀이 선 뒤 standSec 안 · 제 편 장수가 서 있고 그 곁 heroArtCells 안) */
export function standing(s: FieldState, q: Squad): boolean {
  const t = s.standTick[q.side]
  if (t < 0 || s.tick - t >= ticksOf(P.field.standSec)) return false
  const h = heroOf(s, q.side)
  return h !== null && h.stun === 0 && dist2(q.u, q.v, h.u, h.v) <= sq(cells(P.field.heroArtCells))
}

/**
 * 다시 섬 (52 §6-5 · regroup) — 달아나는 대가 제 장수(쓰러지지 않은) 곁 regroupCells 안에 오면 사기를 무너짐 문턱 위 regroupPermille 까지 되올려 다시 선다
 * (대마다 판에 한 번 · 편이 무너진 뒤는 안 선다).
 */
function regroup(s: FieldState): void {
  const target = breakLine() + P.field.regroupPermille
  for (const q of s.squads) {
    if (q.flee !== 1 || q.regrouped === 1 || q.men <= 0 || s.breakTick[q.side] >= 0) continue
    const h = heroOf(s, q.side)
    if (!h || h.stun > 0 || dist2(q.u, q.v, h.u, h.v) > sq(cells(P.field.regroupCells))) continue
    const need = idiv(q.morale0 * target, MILLI) - q.morale
    if (need <= 0) continue
    q.calm += need * MILLI; q.morale += need; q.regrouped = 1
    emit(s, { kind: 'regroup', side: q.side, id: q.id, u: q.u, v: q.v, n: need })
  }
}
