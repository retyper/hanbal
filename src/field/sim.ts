/**
 * 전장 sim — 정수 격자 · 고정 걸음 (docs/realm/battle-study/40-cards.md F1a · F1b)
 *
 * 한 틱의 차례: 입력 받기 → 임시 AI 재목표 → 맞붙기(피해·사기) → 걷기 → 끝 판정.
 * 난수는 roll(seed, tick, 이름) 만. DOM·시계·삼각함수 없음 (tests/field/purity.test.ts 가 글자로 센다).
 *
 * 전투 수학 — src/realm/tactics.ts 의 방향을 옮긴 복제다 (원본: fightRounds :728~ · frontQ :287 · downOf :364).
 * 본편은 합(라운드) 단위 실수이고 여기는 틱 단위 정수라 수식을 글자 그대로 옮기지 않았다.
 * 같은 값은 P.realm.tac* 를 **읽는다** (세모 · 자세 배수 · 무리 세기 · 옆치기 · 화살비 · 끝 문턱). 복사 상수는 두지 않는다.
 * 어긋나는 것을 막는 안전망은 tests/field/parity.test.ts (방향만 견준다).
 *
 *   피해(천분의 일 명) = 사람 수 × powerPerSec ÷ hz × 무리 세기 × 자세 × 세모 × 옆치기 × 화살비 ÷ 받는 쪽 자세  (각 곱은 ‰ 정수, 곱할 때마다 내림)
 *   사기 = 처음 사기 − 잃은 몫 × moraleLossLostShare − 누적 충격(옆구리 · 장수 쓰러짐)
 *   끝 = 사기(편 평균)가 처음의 tacBreakMorale 아래 | 남은 사람이 처음의 tacBreakMen 아래 | 물러남 | 때를 다 씀
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { clamp, dist2, idiv, isqrt, stepToward } from './num.ts'
import { groundAt, walkable } from './map.ts'
import { G_BLOCK, G_HIGH, G_PLAIN, G_SHALLOW, GRPS, OP_AUTO, OP_MOVE, OP_RETREAT, OP_STANCE, STANCE_CHARGE, STANCE_HOLD, STANCE_OPEN } from './types.ts'
import type { FieldInput, FieldMap, FieldState, Grp, Hero, LiveSetup, Point, Squad } from './types.ts'

const NO_INPUTS: readonly FieldInput[] = []
const ROW: Readonly<Record<Grp, number>> = { front: 0, bows: 1, horse: 2 }
const MILLI = 1000
const sq = (x: number): number => x * x
/** 초당 값을 틱당 값으로 (hz 를 바꿔도 한 판 길이가 같게) */
const perTick = (perSec: number): number => idiv(perSec, P.field.hz)
const ticksOf = (sec: number): number => sec * P.field.hz
/** 한 때의 틱 수 */
const timeTicks = (): number => ticksOf(P.field.timeSec)

/** 실수 상수(P.realm.tac*)를 ‰ 정수로 — 한 틱에 한 번만 센다 */
const m = (x: number): number => Math.round(x * MILLI)
const mul = (v: number, k: number): number => idiv(v * k, MILLI)

/** 방진 > 돌격 > 길 트기 > 방진 (battlefield.ts FRONT_COUNTER 와 같은 순환) */
const beats = (a: number, d: number): boolean => (a === STANCE_HOLD && d === STANCE_CHARGE) || (a === STANCE_CHARGE && d === STANCE_OPEN) || (a === STANCE_OPEN && d === STANCE_HOLD)

/** 무리의 대 수 (4 이하 고정 · 사람 수가 많으면 대당 사람 수가 늘어난다) */
export function squadCount(men: number): number {
  if (men <= 0) return 0
  return clamp(Math.ceil(men / P.field.squadMenRef), 1, P.field.squadsPerGroupMax)
}

/** 걸음당 이동 (단위/틱) */
function speedPerTick(g: Grp): number {
  const cells = g === 'front' ? P.field.speedFrontCellsPerSec : g === 'bows' ? P.field.speedBowsCellsPerSec : P.field.speedHorseCellsPerSec
  return idiv(cells * P.field.unit, P.field.hz)
}

const menOf = (hp: number): number => hp > 0 ? idiv(hp + MILLI - 1, MILLI) : 0

function invalidSetup(s: LiveSetup): boolean {
  const mp = s.map
  if (!Number.isInteger(s.seed) || !Number.isInteger(mp.u) || !Number.isInteger(mp.w) || mp.u < 2 || mp.w < 1) return true
  if (mp.cells.length !== mp.u * mp.w || mp.camps.length !== 2) return true
  for (const c of mp.camps) if (![c.u, c.v, c.spread].every(Number.isInteger) || (c.asleep !== undefined && !Number.isInteger(c.asleep))) return true
  let bodies = 0
  for (const side of s.sides) {
    if (!Number.isInteger(side.morale) || side.morale < 0 || side.morale > MILLI) return true
    let total = 0
    for (const g of GRPS) {
      const n = side.men[g]
      if (!Number.isInteger(n) || n < 0) return true
      total += n
      bodies += squadCount(n)
    }
    if (total === 0) return true
    if (side.hero) bodies++
  }
  return bodies > P.field.bodiesMax
}

export function createField(setup: LiveSetup): FieldState {
  // 목책이 부서지면 칸이 바뀌므로 판은 지도 사본(칸 · 조각)을 쥔다 — 같은 지도로 다시 시작해도 안 변한다
  const map: FieldMap = { ...setup.map, cells: setup.map.cells.slice(), pieces: setup.map.pieces.map(p => ({ ...p })) }
  const s: FieldState = { tick: 0, seed: setup.seed, map, squads: [], heroes: [], used: [0, 0, 0, 0], broken: [0, 0], end: null, winner: -1, log: { dropped: 0, accepted: [] } }
  if (invalidSetup(setup)) { s.end = 'invalid'; return s }
  const unit = P.field.unit
  const jit = P.field.spawnJitterCells * unit
  for (const side of [0, 1] as const) {
    const ls = setup.sides[side]
    const cp = setup.map.camps[side]
    // 진영: 줄은 spread 로 퍼지고 뒷줄(활·기병)은 face 반대쪽으로 rowGap 만큼씩 물러난다 (axis 0 은 u 쪽, axis 1 은 v 쪽)
    const place = (grp: Grp, i: number, n: number): Point => {
      const along = idiv(((2 * i + 1) - n) * cp.spread * unit, 2 * n)
      const back = cp.face * ROW[grp] * P.field.rowGapCells * unit
      return cp.axis === 0 ? { u: cp.u * unit - back, v: cp.v * unit + along } : { u: cp.u * unit + along, v: cp.v * unit - back }
    }
    GRPS.forEach(grp => {
      const men = ls.men[grp], n = squadCount(men)
      const fresh = Math.min(men, Math.max(0, ls.fresh?.[grp] ?? 0))
      for (let i = 0; i < n; i++) {
        const id = s.squads.length
        const cnt = idiv(men, n) + (i < men % n ? 1 : 0)
        const j = jit > 0 ? Math.floor(roll(s.seed, 0, `spawn:${id}`) * (2 * jit + 1)) - jit : 0
        const p = place(grp, i, n)
        const u = clamp(cp.axis === 1 ? p.u + j : p.u, 0, setup.map.u * unit), v = clamp(cp.axis === 0 ? p.v + j : p.v, 0, setup.map.w * unit)
        const stance = Math.floor(roll(s.seed, 0, `stance:${id}`) * 3) as 0 | 1 | 2
        s.squads.push({ id, side, grp, kind: grp, men: cnt, menMax: cnt, fresh: men > 0 ? idiv(fresh * cnt, men) : 0, u, v, homeU: u, homeV: v, lock: -1, sleep: ticksOf(cp.asleep ?? 0), flank: 0, stance, morale0: ls.morale, shock: 0, goal: null, manual: 0, target: -1, hp: cnt * MILLI, morale: ls.morale })
      }
    })
    if (ls.hero) {
      const hp0 = place('front', 0, 1)
      const hero: Hero = { side, id: ls.hero.id, u: hp0.u, v: hp0.v, goal: null, manual: 0, grp: -1, stun: 0, hp: P.field.heroHp }
      s.heroes.push(hero)
    }
  }
  return s
}

/** 입력 하나를 받는다. 한 때에 무리당 상한이 넘으면 버리고 센다 (손재주가 수를 덮지 않게 · 22 §3) */
function applyInput(s: FieldState, i: FieldInput): void {
  // 정수가 아닌 입력은 기록에 못 들어간다 (기록 전체가 안 읽히므로 받는 쪽에서 버린다)
  if (![i.g, i.op, i.u, i.v].every(Number.isInteger) || !(i.g >= 0 && i.g <= 3)) { s.log.dropped++; return }
  // 물러남은 언제든 — 입력 한도 앞에서 처리한다 (30 §6 규칙 3)
  if (i.op === OP_RETREAT) {
    s.log.accepted.push({ tick: i.tick, g: i.g, op: i.op, u: 0, v: 0 })
    s.end = 'retreat'; s.winner = 1
    return
  }
  if (s.used[i.g] >= P.field.inputPerGroupPerTime) { s.log.dropped++; return }
  const unit = P.field.unit
  const inMap = i.u >= 0 && i.v >= 0 && i.u <= s.map.u * unit && i.v <= s.map.w * unit
  const ok = i.op === OP_MOVE ? inMap : i.op === OP_AUTO || (i.op === OP_STANCE && i.g < 3 && (i.u === STANCE_CHARGE || i.u === STANCE_HOLD || i.u === STANCE_OPEN))
  if (!ok) { s.log.dropped++; return }
  s.used[i.g]++
  s.log.accepted.push({ tick: i.tick, g: i.g, op: i.op, u: i.u, v: i.v })
  if (i.op === OP_STANCE) {
    for (const q of s.squads) if (q.side === 0 && q.grp === GRPS[i.g]) q.stance = i.u as 0 | 1 | 2
    return
  }
  const goal = i.op === OP_MOVE ? { u: i.u, v: i.v } : null
  if (i.g === 3) {
    const h = s.heroes.find(e => e.side === 0)
    if (h) { h.goal = goal; h.manual = i.op === OP_MOVE ? 1 : 0 }
    return
  }
  for (const q of s.squads) {
    if (q.side !== 0 || q.grp !== GRPS[i.g]) continue
    q.manual = i.op === OP_MOVE ? 1 : 0
    q.goal = goal ? { u: goal.u, v: goal.v } : null
    if (i.op === OP_MOVE) q.target = -1
  }
}

/** 임시 AI — 가장 가까운 적 대를 목표로 (동점은 id 가 작은 쪽) · 장수는 제 편 앞줄 가장 앞 대 곁을 따른다. F6 의 정식 AI 가 대체한다 */
function retarget(s: FieldState): void {
  for (const q of s.squads) {
    if (q.manual === 1 || q.men <= 0) continue
    let best = -1, bd = 0
    for (const e of s.squads) {
      if (e.side === q.side || e.men <= 0) continue
      const d = dist2(q.u, q.v, e.u, e.v)
      if (best < 0 || d < bd) { best = e.id; bd = d }
    }
    q.target = best
    let e = best < 0 ? null : s.squads[best]!
    // 돕기 — 같은 편 앞줄이 맞물려 있고 내가 supportCells 안에서 놀고 있으면 그 적에게 간다
    if (e && q.grp !== 'bows' && q.lock < 0) {
      const r2 = sq(P.field.supportCells * P.field.unit)
      let bd2 = 0, helped: Squad | null = null
      for (const f of s.squads) {
        if (f.side !== q.side || f.men <= 0 || f.lock < 0) continue
        const foe = s.squads[f.lock]!
        const d = dist2(q.u, q.v, f.u, f.v)
        if (foe.men > 0 && d <= r2 && (helped === null || d < bd2)) { helped = foe; bd2 = d }
      }
      if (helped) e = helped
    }
    // 지키는 편은 먼저 걸어 나가지 않는다 — 적이 holdTriggerCells 안에 들어와야 맞서러 나가고, 시작 자리에서 leashCells 안까지만 간다 (활은 제자리)
    if (e && s.map.camps[q.side].hold && !near(s, q, P.field.holdTriggerCells)) e = null
    q.goal = e ? leash(s, q, detour(s, q, e)) : null
  }
  for (const h of s.heroes) {
    if (h.manual === 1) continue
    let best: Squad | null = null
    for (const q of s.squads) {
      if (q.side !== h.side || q.grp !== 'front' || q.men <= 0) continue
      if (best === null || (h.side === 0 ? q.u > best.u : q.u < best.u)) best = q
    }
    h.goal = best ? { u: best.u, v: best.v } : null
  }
}

/** 적 대가 이 대 곁 cells 칸 안에 있나 */
function near(s: FieldState, q: Squad, cells: number): boolean {
  const r2 = sq(cells * P.field.unit)
  return s.squads.some(e => e.side !== q.side && e.men > 0 && dist2(q.u, q.v, e.u, e.v) <= r2)
}

/** 지키는 편(hold)의 목표를 시작 자리에서 leashCells 안으로 자른다 (활은 제자리 · 정수 제곱근으로 줄여 가까운 점) */
function leash(s: FieldState, q: Squad, goal: Point): Point {
  if (!s.map.camps[q.side].hold) return goal
  const r = P.field.leashCells * P.field.unit
  const dx = goal.u - q.homeU, dy = goal.v - q.homeV
  const d2 = dx * dx + dy * dy
  if (d2 <= r * r) return goal
  const root = isqrt(d2)
  const len = root * root === d2 ? root : root + 1
  return { u: q.homeU + idiv(dx * r, len), v: q.homeV + idiv(dy * r, len) }
}

/** 목책 줄이 둘 사이에 있으면 문으로 돌아간다 (간단한 길 찾기: 줄 한쪽에서 반대쪽 목표를 보면 문 가운데가 목표) */
function detour(s: FieldState, q: Squad, e: Squad): Point {
  const gate = s.map.pieces.find(p => p.kind === 'gate')
  if (gate) {
    const wallX = gate.u0 * P.field.unit + idiv(P.field.unit, 2)
    if ((q.u < wallX) !== (e.u < wallX)) return { u: wallX, v: idiv((gate.v0 + gate.v1) * P.field.unit, 2) }
  }
  return { u: e.u, v: e.v }
}

/** 땅을 보고 걷는다 — 얕은 물과 올라가는 높은 터는 느리고, 깊은 물·막힘 칸에는 못 들어간다 (막히면 한 축으로 미끄러진다) */
function walk(s: FieldState, K: Kit, side: 0 | 1, u: number, v: number, goal: Point, speed: number): Point {
  const slow = (g: number): number => g === G_SHALLOW ? K.water : g === G_HIGH && s.map.highOwner !== side ? K.climb : MILLI
  const full = stepToward(u, v, goal.u, goal.v, speed)
  const f = Math.min(slow(groundAt(s.map, u, v)), slow(groundAt(s.map, full.u, full.v)))
  const p = f === MILLI ? full : stepToward(u, v, goal.u, goal.v, mul(speed, f))
  if (walkable(groundAt(s.map, p.u, p.v))) return p
  const alongU = { u: p.u, v }, alongV = { u, v: p.v }
  const first = Math.abs(p.u - u) >= Math.abs(p.v - v) ? [alongU, alongV] : [alongV, alongU]
  for (const c of first) if ((c.u !== u || c.v !== v) && walkable(groundAt(s.map, c.u, c.v))) return c
  return { u, v }
}

/** 맞붙는 칼날은 막힘 칸(목책)을 가로지르지 못한다 — 두 점 사이 세 곳을 찍어 본다 (화살은 넘는다) */
function clearLine(map: FieldMap, a: Point, b: Point): boolean {
  for (let k = 1; k <= 3; k++) {
    if (groundAt(map, a.u + idiv((b.u - a.u) * k, 4), a.v + idiv((b.v - a.v) * k, 4)) === G_BLOCK) return false
  }
  return true
}

/** 한 틱의 값표 (P.realm.tac* · P.field 를 ‰ 정수로 — 튜닝 콘솔이 값을 바꿔도 바로 따른다) */
function kit() {
  const R = P.realm, F = P.field
  return {
    grp: { front: m(R.tacGrpFront), bows: m(R.tacGrpBows), horse: m(R.tacGrpHorse) } as Record<Grp, number>,
    charge: m(R.tacChargeMul), hold: m(R.tacHoldMul), open: m(R.tacOpenFront), openVolley: m(R.tacOpenVolley),
    up: m(R.tacTriUp), down: m(R.tacTriDown), flank: m(R.tacFlankMul),
    takenCharge: m(R.tacTakenCharge), takenHold: m(R.tacTakenHold), takenVolley: m(R.tacTakenVolley),
    triTakeWin: m(R.tacTriTakeWin), triTakeLose: m(R.tacTriTakeLose),
    power: perTick(F.powerPerSec), pieceHit: F.pieceHitPerManPerSec, heroHit: perTick(F.heroHitPerSec),
    volleyHold: m(R.tacVolleyHold), volleyCharge: m(R.tacVolleyCharge),
    height: m(R.tacHeight), ford: m(R.tacFordCharge), edge: F.edgeMulPermille, water: F.waterSpeedPermille, climb: F.highClimbPermille,
    meleeR2: sq(F.meleeRangeCells * F.unit), bowR2: sq(F.bowRangeCells * F.unit), flankV: F.flankVCells * F.unit,
  }
}
type Kit = ReturnType<typeof kit>

/** 목책 마디·문 — 곁(맞붙는 거리)에 선 적 앞줄·기병이 틱마다 깎는다. 체력이 다하면 그 칸이 열리고 문이면 지키는 편 사기가 꺾인다 */
function hitPieces(s: FieldState, K: Kit): void {
  const unit = P.field.unit
  for (const p of s.map.pieces) {
    if (p.hp <= 0) continue
    const loU = p.u0 * unit, hiU = p.u1 * unit, loV = p.v0 * unit, hiV = p.v1 * unit
    let dmg = 0
    for (const q of s.squads) {
      if (q.side === p.owner || q.men <= 0 || q.grp === 'bows') continue
      const cu = clamp(q.u, loU, hiU), cv = clamp(q.v, loV, hiV)
      if (dist2(q.u, q.v, cu, cv) <= K.meleeR2) dmg += idiv(q.men * K.pieceHit, MILLI * P.field.hz)
    }
    p.hp = Math.max(0, p.hp - dmg)
    if (p.hp > 0) continue
    for (let cu = p.u0; cu < p.u1; cu++) for (let cv = p.v0; cv < p.v1; cv++) s.map.cells[cu * s.map.w + cv] = G_PLAIN
    if (p.kind === 'gate') for (const q of s.squads) if (q.side === p.owner) q.shock += P.field.gateBreakMoraleLoss
  }
}

/** 진영이 무너짐 — 적 대가 그 편의 진영 자리 campBreakCells 안까지 들어오면 한 번, 그 편 대마다 사기가 꺾인다 */
function breakCamps(s: FieldState): void {
  const r2 = sq(P.field.campBreakCells * P.field.unit)
  for (const side of [0, 1] as const) {
    if (s.broken[side] === 1) continue
    const cp = s.map.camps[side]
    const cu = cp.u * P.field.unit, cv = cp.v * P.field.unit
    if (!s.squads.some(q => q.side !== side && q.men > 0 && dist2(q.u, q.v, cu, cv) <= r2 && clearLine(s.map, q, { u: cu, v: cv }))) continue
    s.broken[side] = 1
    for (const q of s.squads) if (q.side === side) q.shock += P.field.campBreakMoraleLoss
  }
}

/** 같은 편 대끼리 겹치지 않게 작은 걸음으로 밀어낸다 (한꺼번에 계산해 차례에 안 따른다) */
function separate(s: FieldState): void {
  const sep2 = sq(P.field.sepCells * P.field.unit), push = P.field.pushPerTick
  const n = s.squads.length
  const du = new Array<number>(n).fill(0), dv = new Array<number>(n).fill(0)
  for (let i = 0; i < n; i++) {
    const a = s.squads[i]!
    if (a.men <= 0) continue
    for (let j = i + 1; j < n; j++) {
      const b = s.squads[j]!
      if (b.men <= 0 || b.side !== a.side) continue
      const d2 = dist2(a.u, a.v, b.u, b.v)
      if (d2 >= sep2) continue
      if (d2 === 0) { dv[i]! -= push; dv[j]! += push; continue }
      const root = isqrt(d2), len = root * root === d2 ? root : root + 1
      const ux = idiv((b.u - a.u) * push, len), uy = idiv((b.v - a.v) * push, len)
      du[i]! -= ux; dv[i]! -= uy; du[j]! += ux; dv[j]! += uy
    }
  }
  for (const q of s.squads) {
    const x = q.u + du[q.id]!, y = q.v + dv[q.id]!
    if ((x !== q.u || y !== q.v) && walkable(groundAt(s.map, x, y))) { q.u = x; q.v = y }
  }
}

/** 맞붙기 — 모든 대가 한꺼번에 치고 (순서에 안 따른다) 피해와 옆구리 맞음을 모았다가 한 번에 깎는다 */
function fight(s: FieldState, K: Kit): void {
  const n = s.squads.length
  const dmg = new Array<number>(n).fill(0)
  const flanked = new Array<number>(n).fill(0)
  const openFront: [boolean, boolean] = [false, false]
  for (const q of s.squads) if (q.men > 0 && q.grp === 'front' && q.stance === STANCE_OPEN) openFront[q.side] = true
  // 맞물림 — 앞줄은 맞붙는 거리 안의 가장 가까운 적 앞줄·기병과 맞물린다 (기병은 안 맞물려 옆으로 돌아간다)
  for (const q of s.squads) {
    q.lock = -1
    if (q.men <= 0 || q.grp !== 'front') continue
    let bd = 0
    for (const t of s.squads) {
      if (t.side === q.side || t.men <= 0 || t.grp === 'bows') continue
      const d = dist2(q.u, q.v, t.u, t.v)
      if (d <= K.meleeR2 && (q.lock < 0 || d < bd) && clearLine(s.map, q, t)) { q.lock = t.id; bd = d }
    }
  }
  // 겨눔 — 사거리 안의 가장 가까운 적 (동점은 id 가 작은 쪽)
  const aim = new Array<number>(n).fill(-1)
  for (const q of s.squads) {
    if (q.men <= 0 || q.sleep > 0) continue
    const r2 = q.grp === 'bows' ? K.bowR2 : K.meleeR2
    let bd = 0
    for (const t of s.squads) {
      if (t.side === q.side || t.men <= 0) continue
      const d = dist2(q.u, q.v, t.u, t.v)
      if (d <= r2 && (aim[q.id]! < 0 || d < bd) && (q.grp === 'bows' || clearLine(s.map, q, t))) { aim[q.id] = t.id; bd = d }
    }
  }
  // 맞쏘기 — 활은 사거리 안의 적 활 가운데 우리 편을 쏘고 있는 것을 앞줄보다 먼저 겨눈다
  const first = aim.slice()
  for (const q of s.squads) {
    if (q.men <= 0 || q.sleep > 0 || q.grp !== 'bows') continue
    let bd = 0, pick = -1
    for (const t of s.squads) {
      if (t.side === q.side || t.men <= 0 || t.grp !== 'bows' || first[t.id]! < 0) continue
      const d = dist2(q.u, q.v, t.u, t.v)
      if (d <= K.bowR2 && (pick < 0 || d < bd)) { pick = t.id; bd = d }
    }
    if (pick >= 0) aim[q.id] = pick
  }
  for (const q of s.squads) {
    if (q.men <= 0 || q.sleep > 0 || aim[q.id]! < 0) continue
    const e = s.squads[aim[q.id]!]!
    let v = mul(idiv(q.men * K.power, MILLI), K.grp[q.grp])
    if (q.grp === 'front') v = mul(v, q.stance === STANCE_CHARGE ? K.charge : q.stance === STANCE_HOLD ? K.hold : K.open)
    if (q.grp === 'bows' && openFront[q.side]) v = mul(v, K.openVolley)
    if (q.grp === 'bows' && groundAt(s.map, q.u, q.v) === G_HIGH) v = mul(v, K.height)
    // 세모 — 이긴 쪽은 세고 진 쪽이 받는 손실은 크다 (본편 tacTriUp/Down · tacTriTakeLose/Win)
    if (q.grp === 'front' && e.grp === 'front') {
      if (beats(q.stance, e.stance)) v = mul(mul(v, K.up), K.triTakeLose)
      else if (beats(e.stance, q.stance)) v = mul(mul(v, K.down), K.triTakeWin)
    }
    // 받는 배수 — 맞붙는 칼날에만 (화살비에는 받는 배수가 없다 · 화살은 방진에 세고 돌격에 약하다)
    if (e.grp === 'front' && q.grp !== 'bows') v = mul(v, e.stance === STANCE_CHARGE ? K.takenCharge : e.stance === STANCE_HOLD ? K.takenHold : MILLI)
    if (e.grp === 'front' && q.grp === 'bows') v = mul(v, e.stance === STANCE_HOLD ? K.volleyHold : e.stance === STANCE_CHARGE ? K.volleyCharge : MILLI)
    if (e.grp === 'bows') v = mul(v, K.takenVolley)
    if (groundAt(s.map, q.u, q.v) === G_SHALLOW) v = mul(v, K.ford)
    if (e.sleep > 0) v = mul(v, K.edge)
    // 옆구리 — 옆에서 붙었고, 맞는 대가 다른 적을 보고 있을 때만 (서로 옆에 서면 둘 다 맞는 것을 막는다)
    if (q.grp !== 'bows') {
      const dv = Math.abs(q.v - e.v), du = Math.abs(q.u - e.u)
      const facing = e.lock >= 0 ? e.lock : e.target
      if (dv > K.flankV && dv > du && facing >= 0 && facing !== q.id) { v = mul(v, K.flank); flanked[e.id]!++ }
    }
    dmg[e.id]! += v
  }
  for (const q of s.squads) {
    if (q.men <= 0) continue
    const d = dmg[q.id]!
    q.hp = Math.max(0, q.hp - d)
    q.men = menOf(q.hp)
    q.flank += flanked[q.id]! > 0 ? 1 : 0
    if (d > 0) q.sleep = 0
  }
  hitPieces(s, K)
  breakCamps(s)
  // 장수 — 적 앞줄이 곁에 닿아 있으면 깎인다. 체력이 다하면 쓰러져 몇 초 못 움직인다 (죽지 않는다) · 그 편 사기가 꺾인다
  for (const h of s.heroes) {
    if (h.stun > 0) { h.stun--; continue }
    let hits = 0
    for (const t of s.squads) if (t.side !== h.side && t.men > 0 && t.grp !== 'bows' && dist2(h.u, h.v, t.u, t.v) <= K.meleeR2) hits++
    h.hp -= hits * K.heroHit
    if (h.hp <= 0) {
      h.hp = P.field.heroHp
      h.stun = ticksOf(P.field.heroStunSec)
      for (const q of s.squads) if (q.side === h.side) q.shock += P.field.heroDownMorale
    }
  }
  // 목책 문이 안 부서진 동안 그 안의 편은 잃은 몫에 덜 꺾인다 (본편 tacWallSteady — 성벽·목책 안에서 지키는 쪽은 밀린 합에서 사기가 덜 꺾인다)
  const walled = [0, 1].map(side => s.map.pieces.some(p => p.owner === side && p.kind === 'gate' && p.hp > 0))
  for (const q of s.squads) {
    const lost0 = idiv((q.menMax * MILLI - q.hp) * P.field.moraleLossLostShare, q.menMax * MILLI)
    const lost = walled[q.side] ? mul(lost0, MILLI - m(P.realm.tacWallSteady)) : lost0
    q.morale = Math.max(0, q.morale0 - lost - q.shock - idiv(q.flank * P.field.moraleLossFlankPerSec, P.field.hz))
  }
}

/** 편의 사람 수(남은) · 처음 · 사기(처음 사람 수 가중 평균 — 한 대가 몰살돼도 편 사기가 되오르지 않는다) */
function sideTotals(s: FieldState, side: 0 | 1): { men: number; menMax: number; morale: number; morale0: number } {
  let men = 0, menMax = 0, mw = 0, m0 = 0
  for (const q of s.squads) {
    if (q.side !== side) continue
    menMax += q.menMax
    m0 = q.morale0
    men += q.men
    mw += q.menMax * q.morale
  }
  return { men, menMax, morale: menMax > 0 ? idiv(mw, menMax) : 0, morale0: m0 }
}

/** 끝 판정 — 사기가 문턱 아래로 가면 바로 끝난다 (30 §6 규칙 3). 문턱은 본편 P.realm.tacBreakMen/tacBreakMorale 그대로 */
function judge(s: FieldState): void {
  const downs: [number, number] = [0, 0]   // 0 = 안 무너짐 · 1 = 사람 · 2 = 사기
  const share: [number, number] = [0, 0]
  const tot = [sideTotals(s, 0), sideTotals(s, 1)]
  for (const side of [0, 1] as const) {
    const t = tot[side]!
    share[side] = t.menMax > 0 ? idiv(t.men * MILLI, t.menMax) : 0
    if (t.morale0 > 0 && t.morale * MILLI < t.morale0 * m(P.realm.tacBreakMorale)) downs[side] = 2
    else if (t.men * MILLI < t.menMax * m(P.realm.tacBreakMen)) downs[side] = 1
  }
  if (downs[0] === 0 && downs[1] === 0) return
  s.end = (downs[0] !== 0 ? downs[0] : downs[1]) === 2 ? 'morale' : 'men'
  if (downs[0] === 0 || downs[1] === 0) { s.winner = downs[0] !== 0 ? 1 : 0; return }
  // 둘 다 같은 틱에 무너졌으면 체력 합 → 사람 × 사기 → 그래도 같으면 비김 (굴림으로 가르면 쏠림은 없어도 동전 던지기가 된다)
  const hpOf = (side: number): number => s.squads.reduce((a, q) => a + (q.side === side ? q.hp : 0), 0)
  const pw = (t: { men: number; morale: number }): number => t.men * t.morale
  const byHp = hpOf(0) - hpOf(1), byPw = pw(tot[0]!) - pw(tot[1]!)
  s.winner = byHp !== 0 ? (byHp > 0 ? 0 : 1) : byPw !== 0 ? (byPw > 0 ? 0 : 1) : -1
}

/** 때를 다 썼을 때 — 남은 세기(사람 × 사기)의 몫이 tacWinShare 위인 쪽이 이긴다 (아래쪽은 1 - 이것) · 그 사이는 비김 */
function judgeTime(s: FieldState): void {
  const p = [0, 1].map(side => { const t = sideTotals(s, side as 0 | 1); return t.men * t.morale })
  const all = p[0]! + p[1]!
  s.winner = all <= 0 ? -1 : p[0]! * MILLI > all * m(P.realm.tacWinShare) ? 0 : p[1]! * MILLI > all * m(P.realm.tacWinShare) ? 1 : -1
}

export function stepField(s: FieldState, inputs: readonly FieldInput[] = NO_INPUTS): void {
  if (s.end !== null) return
  if (s.tick % timeTicks() === 0) s.used = [0, 0, 0, 0]
  for (const i of inputs) if (i.tick === s.tick) applyInput(s, i)
  if (s.end !== null) return
  if (s.tick % Math.max(1, idiv(P.field.retargetMs * P.field.hz, MILLI)) === 0) retarget(s)
  const K = kit()
  fight(s, K)
  // 걸음은 모두 같은 틱 처음 자리에서 정하고 한꺼번에 옮긴다 (id 차례로 옮기면 먼저 도는 편이 뒤 편의 멈춤 판단을 바꿔 쏠린다)
  const moves: Array<Point | null> = s.squads.map(q => {
    if (!q.goal || q.men <= 0 || q.sleep > 0) return null
    if (q.lock >= 0 && q.manual === 0) return null
    if (q.manual === 0 && q.target >= 0) {
      const e = s.squads[q.target]!
      if (dist2(q.u, q.v, e.u, e.v) <= (q.grp === 'bows' ? K.bowR2 : K.meleeR2) && (q.grp === 'bows' || clearLine(s.map, q, e))) return null
    }
    return walk(s, K, q.side, q.u, q.v, q.goal, speedPerTick(q.grp))
  })
  for (const q of s.squads) {
    const p = moves[q.id]
    if (p) { q.u = p.u; q.v = p.v }
  }
  separate(s)
  for (const q of s.squads) if (q.sleep > 0) q.sleep--
  for (const h of s.heroes) {
    if (h.stun > 0 || !h.goal) continue
    const p = walk(s, K, h.side, h.u, h.v, h.goal, speedPerTick('front'))
    h.u = p.u; h.v = p.v
  }
  s.tick++
  judge(s)
  if (s.end === null && s.tick >= P.field.timesMax * timeTicks()) { s.end = 'time'; judgeTime(s) }
}

/** 입력 열로 끝까지 돌린다 — 기록 재생과 헤드리스 시험이 쓰는 길 */
export function runField(setup: LiveSetup, inputs: readonly FieldInput[] = NO_INPUTS, maxTicks = Infinity): FieldState {
  const s = createField(setup)
  // 같은 틱 입력은 받은 차례를 지킨다 (정렬이 안정적이지 않은 엔진에서도 같게 둘째 열쇠로 원래 차례)
  const byTick = inputs.map((x, k) => ({ x, k })).sort((a, b) => a.x.tick - b.x.tick || a.k - b.k).map(o => o.x)
  let k = 0
  while (s.end === null && s.tick < maxTicks) {
    let j = k
    while (j < byTick.length && byTick[j]!.tick === s.tick) j++
    stepField(s, k === j ? NO_INPUTS : byTick.slice(k, j))
    while (k < byTick.length && byTick[k]!.tick < s.tick) k++
  }
  return s
}
