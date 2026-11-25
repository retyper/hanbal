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
 *   피해(천분의 일 명) = 사람 수 × powerBase × 무리 세기 × 자세 × 세모 × 옆치기 × 화살비 ÷ 받는 쪽 자세  (각 곱은 ‰ 정수, 곱할 때마다 내림)
 *   사기 = 처음 사기 − 잃은 몫 × moraleLossLostShare − 누적 충격(옆구리 · 장수 쓰러짐)
 *   끝 = 사기(편 평균)가 처음의 tacBreakMorale 아래 | 남은 사람이 처음의 tacBreakMen 아래 | 물러남 | 때를 다 씀
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { clamp, dist2, idiv, isqrt, stepToward } from './num.ts'
import { groundAt, walkable } from './map.ts'
import { G_HIGH, G_SHALLOW, GRPS, OP_AUTO, OP_MOVE, OP_RETREAT, OP_STANCE, STANCE_CHARGE, STANCE_HOLD, STANCE_OPEN } from './types.ts'
import type { FieldInput, FieldState, Grp, Hero, LiveSetup, Point, Squad } from './types.ts'

const NO_INPUTS: readonly FieldInput[] = []
const ROW: Readonly<Record<Grp, number>> = { front: 0, bows: 1, horse: 2 }
const MILLI = 1000

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
  if (!Number.isInteger(s.seed) || s.map.u < 2 || s.map.w < 1) return true
  let bodies = 0
  for (const side of s.sides) {
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
  const s: FieldState = { tick: 0, seed: setup.seed, map: setup.map, squads: [], heroes: [], used: [0, 0, 0, 0], end: null, winner: -1, log: { dropped: 0, accepted: [] } }
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
        s.squads.push({ id, side, grp, kind: grp, men: cnt, menMax: cnt, fresh: men > 0 ? idiv(fresh * cnt, men) : 0, u, v, homeU: u, homeV: v, stance, morale0: ls.morale, shock: 0, goal: null, manual: 0, target: -1, hp: cnt * MILLI, morale: ls.morale })
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
  if (!(i.g >= 0 && i.g <= 3) || s.used[i.g] >= P.field.inputPerGroupPerTime) { s.log.dropped++; return }
  const unit = P.field.unit
  const inMap = Number.isInteger(i.u) && Number.isInteger(i.v) && i.u >= 0 && i.v >= 0 && i.u <= s.map.u * unit && i.v <= s.map.w * unit
  const ok = i.op === OP_MOVE ? inMap : i.op === OP_AUTO || i.op === OP_RETREAT || (i.op === OP_STANCE && i.g < 3 && (i.u === STANCE_CHARGE || i.u === STANCE_HOLD || i.u === STANCE_OPEN))
  if (!ok) { s.log.dropped++; return }
  s.used[i.g]++
  s.log.accepted.push({ tick: i.tick, g: i.g, op: i.op, u: i.u, v: i.v })
  if (i.op === OP_RETREAT) { s.end = 'retreat'; s.winner = 1; return }
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
    const e = best < 0 ? null : s.squads[best]!
    // 지키는 편은 시작 자리에서 leashCells 안까지만 나가 맞선다
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

/** 지키는 편(hold)의 목표를 시작 자리에서 leashCells 안으로 자른다 (활은 제자리 · 정수 제곱근으로 줄여 가까운 점) */
function leash(s: FieldState, q: Squad, goal: Point): Point {
  if (!s.map.camps[q.side].hold) return goal
  const r = q.grp === 'bows' ? 0 : P.field.leashCells * P.field.unit
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

/** 한 틱의 값표 (P.realm.tac* · P.field 를 ‰ 정수로 — 튜닝 콘솔이 값을 바꿔도 바로 따른다) */
function kit() {
  const R = P.realm, F = P.field
  return {
    grp: { front: m(R.tacGrpFront), bows: m(R.tacGrpBows), horse: m(R.tacGrpHorse) } as Record<Grp, number>,
    charge: m(R.tacChargeMul), hold: m(R.tacHoldMul), open: m(R.tacOpenFront), openVolley: m(R.tacOpenVolley),
    up: m(R.tacTriUp), down: m(R.tacTriDown), flank: m(R.tacFlankMul),
    takenCharge: m(R.tacTakenCharge), takenHold: m(R.tacTakenHold),
    volleyHold: m(R.tacVolleyHold), volleyCharge: m(R.tacVolleyCharge),
    height: m(R.tacHeight), water: F.waterSpeedPermille, climb: F.highClimbPermille,
    meleeR2: (F.meleeRangeCells * F.unit) ** 2, bowR2: (F.bowRangeCells * F.unit) ** 2, flankV: F.flankVCells * F.unit,
  }
}
type Kit = ReturnType<typeof kit>

/** 맞붙기 — 모든 대가 한꺼번에 치고 (순서에 안 따른다) 피해와 옆구리 맞음을 모았다가 한 번에 깎는다 */
function fight(s: FieldState, K: Kit): void {
  const n = s.squads.length
  const dmg = new Array<number>(n).fill(0)
  const flanked = new Array<number>(n).fill(0)
  const openFront: [boolean, boolean] = [false, false]
  for (const q of s.squads) if (q.men > 0 && q.grp === 'front' && q.stance === STANCE_OPEN) openFront[q.side] = true
  for (const q of s.squads) {
    if (q.men <= 0) continue
    const r2 = q.grp === 'bows' ? K.bowR2 : K.meleeR2
    let e: Squad | null = null, bd = 0
    for (const t of s.squads) {
      if (t.side === q.side || t.men <= 0) continue
      const d = dist2(q.u, q.v, t.u, t.v)
      if (d <= r2 && (e === null || d < bd)) { e = t; bd = d }
    }
    if (e === null) continue
    let v = mul(idiv(q.men * P.field.powerBase, MILLI), K.grp[q.grp])
    // 길 트기의 앞줄 약화(tacOpenFront)는 방진 앞에서는 걸지 않는다 — 세모에서 길 트기가 방진을 이기게 (본편은 합 단위 승패로 정하고 여기는 틱 피해라 이렇게 옮겼다)
    if (q.grp === 'front') v = mul(v, q.stance === STANCE_CHARGE ? K.charge : q.stance === STANCE_HOLD ? K.hold : e.grp === 'front' && e.stance === STANCE_HOLD ? MILLI : K.open)
    if (q.grp === 'bows' && openFront[q.side]) v = mul(v, K.openVolley)
    if (q.grp === 'bows' && groundAt(s.map, q.u, q.v) === G_HIGH) v = mul(v, K.height)
    if (q.grp === 'front' && e.grp === 'front') {
      if (beats(q.stance, e.stance)) v = mul(v, K.up)
      else if (beats(e.stance, q.stance)) v = mul(v, K.down)
    }
    if (e.grp === 'front') {
      v = mul(v, e.stance === STANCE_CHARGE ? K.takenCharge : e.stance === STANCE_HOLD ? K.takenHold : MILLI)
      if (q.grp === 'bows') v = mul(v, e.stance === STANCE_HOLD ? K.volleyHold : e.stance === STANCE_CHARGE ? K.volleyCharge : MILLI)
    }
    if (q.grp !== 'bows') {
      const dv = Math.abs(q.v - e.v), du = Math.abs(q.u - e.u)
      if (dv > K.flankV && dv > du) { v = mul(v, K.flank); flanked[e.id]!++ }
    }
    dmg[e.id]! += v
  }
  for (const q of s.squads) {
    if (q.men <= 0) continue
    const d = dmg[q.id]!
    q.hp = Math.max(0, q.hp - d)
    q.men = menOf(q.hp)
    q.shock += flanked[q.id]! * P.field.moraleLossFlank
  }
  // 장수 — 적 앞줄이 곁에 닿아 있으면 깎인다. 체력이 다하면 쓰러져 몇 초 못 움직인다 (죽지 않는다) · 그 편 사기가 꺾인다
  for (const h of s.heroes) {
    if (h.stun > 0) { h.stun--; continue }
    let hits = 0
    for (const t of s.squads) if (t.side !== h.side && t.men > 0 && t.grp !== 'bows' && dist2(h.u, h.v, t.u, t.v) <= K.meleeR2) hits++
    h.hp -= hits * P.field.heroHitPerTick
    if (h.hp <= 0) {
      h.hp = P.field.heroHp
      h.stun = P.field.heroStunTicks
      for (const q of s.squads) if (q.side === h.side) q.shock += P.field.heroDownMorale
    }
  }
  for (const q of s.squads) {
    const lost = idiv((q.menMax * MILLI - q.hp) * P.field.moraleLossLostShare, q.menMax * MILLI)
    q.morale = Math.max(0, q.morale0 - lost - q.shock)
  }
}

/** 편의 사람 수(남은) · 처음 · 사기(남은 사람 가중 평균) */
function sideTotals(s: FieldState, side: 0 | 1): { men: number; menMax: number; morale: number; morale0: number } {
  let men = 0, menMax = 0, mw = 0, m0 = 0
  for (const q of s.squads) {
    if (q.side !== side) continue
    menMax += q.menMax
    m0 = q.morale0
    men += q.men
    mw += q.men * q.morale
  }
  return { men, menMax, morale: men > 0 ? idiv(mw, men) : 0, morale0: m0 }
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
  // 둘 다 무너졌으면 남은 몫이 적은 쪽이 진다 (같으면 이름 붙은 굴림 — 늘 한 편이 이기면 대칭 판이 쏠린다)
  s.winner = downs[0] !== 0 && downs[1] !== 0 ? (share[0] === share[1] ? (roll(s.seed, s.tick, 'tie') < 0.5 ? 0 : 1) : share[0] < share[1] ? 1 : 0) : downs[0] !== 0 ? 1 : 0
}

/** 때를 다 썼을 때 — 남은 세기(사람 × 사기)의 몫이 tacWinShare 위인 쪽이 이긴다 (아래쪽은 1 - 이것) · 그 사이는 비김 */
function judgeTime(s: FieldState): void {
  const p = [0, 1].map(side => { const t = sideTotals(s, side as 0 | 1); return t.men * t.morale })
  const all = p[0]! + p[1]!
  s.winner = all <= 0 ? -1 : p[0]! * MILLI > all * m(P.realm.tacWinShare) ? 0 : p[1]! * MILLI > all * m(P.realm.tacWinShare) ? 1 : -1
}

export function stepField(s: FieldState, inputs: readonly FieldInput[] = NO_INPUTS): void {
  if (s.end !== null) return
  if (s.tick % P.field.timeTicks === 0) s.used = [0, 0, 0, 0]
  for (const i of inputs) if (i.tick === s.tick) applyInput(s, i)
  if (s.end !== null) return
  if (s.tick % P.field.retargetEvery === 0) retarget(s)
  const K = kit()
  fight(s, K)
  // 걸음은 모두 같은 틱 처음 자리에서 정하고 한꺼번에 옮긴다 (id 차례로 옮기면 먼저 도는 편이 뒤 편의 멈춤 판단을 바꿔 쏠린다)
  const moves: Array<Point | null> = s.squads.map(q => {
    if (!q.goal || q.men <= 0) return null
    if (q.manual === 0 && q.target >= 0) {
      const e = s.squads[q.target]!
      if (dist2(q.u, q.v, e.u, e.v) <= (q.grp === 'bows' ? K.bowR2 : K.meleeR2)) return null
    }
    return walk(s, K, q.side, q.u, q.v, q.goal, speedPerTick(q.grp))
  })
  for (const q of s.squads) {
    const p = moves[q.id]
    if (p) { q.u = p.u; q.v = p.v }
  }
  for (const h of s.heroes) {
    if (h.stun > 0 || !h.goal) continue
    const p = walk(s, K, h.side, h.u, h.v, h.goal, speedPerTick('front'))
    h.u = p.u; h.v = p.v
  }
  s.tick++
  judge(s)
  if (s.end === null && s.tick >= P.field.timesMax * P.field.timeTicks) { s.end = 'time'; judgeTime(s) }
}

/** 입력 열로 끝까지 돌린다 — 기록 재생과 헤드리스 시험이 쓰는 길 */
export function runField(setup: LiveSetup, inputs: readonly FieldInput[] = NO_INPUTS, maxTicks = Infinity): FieldState {
  const s = createField(setup)
  const byTick = [...inputs].sort((a, b) => a.tick - b.tick)
  let k = 0
  while (s.end === null && s.tick < maxTicks) {
    let j = k
    while (j < byTick.length && byTick[j]!.tick === s.tick) j++
    stepField(s, k === j ? NO_INPUTS : byTick.slice(k, j))
    while (k < byTick.length && byTick[k]!.tick < s.tick) k++
  }
  return s
}
