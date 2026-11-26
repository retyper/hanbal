/**
 * 전장 sim — 정수 격자 · 고정 걸음 (docs/realm/battle-study/40-cards.md F1a · F1b · F2b · F2c-1)
 *
 * 한 틱의 차례: 입력 받기 → 임시 AI 재목표 → 맞붙기(피해·사기) → 걷기 → 끝 판정.
 * 난수는 roll(seed, tick, 이름) 만. DOM·시계·삼각함수 없음 (tests/field/purity.test.ts 가 글자로 센다).
 *
 * 전투 수학 — src/realm/tactics.ts 의 방향을 옮긴 복제다 (원본: fightRounds :728~ · frontQ :287 · downOf :364).
 * 본편은 합(라운드) 단위 실수이고 여기는 틱 단위 정수라 수식을 글자 그대로 옮기지 않았다.
 * 같은 값은 P.realm.tac* 를 **읽는다** (세모 · 자세 배수 · 무리 세기 · 옆치기 · 화살비 · 끝 문턱). 복사 상수는 두지 않는다.
 * 어긋나는 것을 막는 안전망은 tests/field/parity.test.ts (방향만 견준다).
 *
 *   피해(백만분의 일 명/초) = 사람 수 × powerPerSec × 무리 세기 × 자세 × 세모 × 옆치기 × 화살비 ÷ 받는 쪽 자세  (각 곱은 ‰ 정수)
 *     → 틱마다 hz 로 나눠 체력(천분의 일 명)에서 깎고 나머지는 들고 간다 (hz 를 바꿔도 같은 피해 · 45 §1-4)
 *   사기 = 처음 사기 − 잃은 몫 × moraleLossLostShare − 누적 충격(옆구리 · 장수 쓰러짐 · 문 부서짐 · 진영 무너짐)
 *   끝 = 사기(편 평균)가 처음의 tacBreakMorale 아래 | 남은 사람이 처음의 tacBreakMen 아래 | 물러남 | 때를 다 씀
 *
 * 차례·거울 (45 §1-2·3·6): 고르기(가까운 적 · 돕기 · 겨눔 · 따라갈 앞줄)의 동점은 배열 차례가 아니라 자리와 시작 자리로 가른다.
 * u 를 L-1-u 로 뒤집고 편 이름표를 바꾼 판은 이긴 편이 정확히 뒤집힌다 (칸은 반열림 · 진영 점은 map.ts campPointU 한 규약).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { clamp, dist2, idiv, isqrt, nearestDir, stepToward } from './num.ts'
import { campPointU, groundAt, walkable } from './map.ts'
import { G_BLOCK, G_HIGH, G_PLAIN, G_SHALLOW, GRPS, HERO_ART_DEFAULT, HERO_ARTS, HERO_DIR, HERO_DIRS, OP_ATTACK, OP_AUTO, OP_DASH, OP_HERO_DIR, OP_MOVE, OP_RETREAT, OP_SKILL, OP_STANCE, STANCE_CHARGE, STANCE_HOLD, STANCE_OPEN, WHY_NONE, CMD_COUNTER, CMD_HEIGHT, OP_AIM, OP_RALLY, ORD_ATTACK, ORD_CHARGE, ORD_FLANK, ORD_MOVE, ORD_NONE, ORD_VOLLEY, HIT_PLAIN, HIT_GOOD, HIT_BLOCKED, LOSS_ARROW, LOSS_BLADE, KIND_BEATS } from './types.ts'
import { LINES, LINE_SHIELD, LINE_WEDGE, LINE_WINGS, LOSS_ART, LOSS_HERO, STANCE_NONE } from './types.ts'
import type { FieldInput, FieldMap, FieldState, Grp, Hero, LiveSetup, MoraleBy, Point, Squad, UnitKind } from './types.ts'
import { addShock, auraOf, emit, gritTick, heroInput, heroMove, heroStrike, heroTakeHits, pruneEvents, standOf } from './hero.ts'
import { armyInit, armyInput, armyTick, flankStep, follows, runMul, standing } from './army.ts'

const NO_INPUTS: readonly FieldInput[] = []
const ROW: Readonly<Record<Grp, number>> = { front: 0, bows: 1, horse: 2 }
const MILLI = 1000
const sq = (x: number): number => x * x
const noCause = (): MoraleBy => ({ arrows: 0, melee: 0, flank: 0, hero: 0, domino: 0, push: 0 })
/**
 * 초당 값을 이 틱의 몫으로 — 누적 내림의 차라서 hz 틱을 모으면 정확히 perSec 이다 (틱마다 내리면 hz 30 에서 걸음이 2% 짧았다 · 45 §2-8).
 * 틱 번호만 보므로 상태가 늘지 않고 거울·차례에 안 기댄다.
 */
export const perTickAt = (perSec: number, tick: number): number => idiv(perSec * ((tick % P.field.hz) + 1), P.field.hz) - idiv(perSec * (tick % P.field.hz), P.field.hz)
export const ticksOf = (sec: number): number => sec * P.field.hz
/** 한 때의 틱 수 */
const timeTicks = (): number => ticksOf(P.field.timeSec)
/** 편의 앞쪽 (편 0 은 u 가 커지는 쪽) — 거울 판에서 편 이름표와 u 가 함께 뒤집히므로 이 값으로 가르면 거울이 맞다 */
export const fwd = (side: 0 | 1): number => side === 0 ? 1 : -1

/** 실수 상수(P.realm.tac*)를 ‰ 정수로 — 한 틱에 한 번만 센다 */
export const m = (x: number): number => Math.round(x * MILLI)
export const mul = (v: number, k: number): number => idiv(v * k, MILLI)

/** 방진 > 돌격 > 길 트기 > 방진 (battlefield.ts FRONT_COUNTER 와 같은 순환) */
const beats = (a: number, d: number): boolean => (a === STANCE_HOLD && d === STANCE_CHARGE) || (a === STANCE_CHARGE && d === STANCE_OPEN) || (a === STANCE_OPEN && d === STANCE_HOLD)

/**
 * 무리의 대 수 — 사람이 있으면 늘 squadsPerGroupMax (사람이 그보다 적으면 사람 수).
 * 예전에는 사람 수 ÷ 400 올림이라 사람 2% 차이로 대가 4 → 7 로 뛰고 승률이 계단으로 뛰었다 (44 §2-2). 대에 기대는 셈(장수 맞음 · 문 깎기 · 지킴 발동)도 사람 수로 바꿨다.
 */
export function squadCount(men: number): number {
  if (men <= 0) return 0
  return Math.min(men, P.field.squadsPerGroupMax)
}

/** 무리의 걸음 (단위/초) */
export function speedPerSec(g: Grp): number {
  const cells = g === 'front' ? P.field.speedFrontCellsPerSec : g === 'bows' ? P.field.speedBowsCellsPerSec : P.field.speedHorseCellsPerSec
  return cells * P.field.unit
}

const menOf = (hp: number): number => hp > 0 ? idiv(hp + MILLI - 1, MILLI) : 0

/** 판 끝 (단위 · 판 안은 [0, 이것]) */
export const lastU = (map: FieldMap): number => map.u * P.field.unit - 1
export const lastV = (map: FieldMap): number => map.w * P.field.unit - 1
export const campU = (s: FieldState, side: 0 | 1): number => campPointU(s.map.camps[side].u, side)
export const campV = (s: FieldState, side: 0 | 1): number => s.map.camps[side].v * P.field.unit

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
    if (side.form !== undefined && !(Number.isInteger(side.form) && side.form >= 0 && side.form < LINES)) return true
    if (side.hero) {
      const hh = side.hero
      if (!Number.isInteger(hh.mu) || hh.mu < 0 || (hh.tong !== undefined && (!Number.isInteger(hh.tong) || hh.tong < 0)) || (hh.art !== undefined && !HERO_ARTS.includes(hh.art))) return true
      bodies++
    }
  }
  return bodies > P.field.bodiesMax
}

export function createField(setup: LiveSetup): FieldState {
  // 목책이 부서지면 칸이 바뀌므로 판은 지도 사본(칸 · 조각)을 쥔다 — 같은 지도로 다시 시작해도 안 변한다
  const map: FieldMap = { ...setup.map, cells: setup.map.cells.slice(), pieces: setup.map.pieces.map(p => ({ ...p, rem: 0 })) }
  const s: FieldState = { tick: 0, seed: setup.seed, map, squads: [], heroes: [], anchor: [], route: [[], [], [], [], [], []], grpWhy: [0, 0, 0], grpWhyTick: [-1, -1, -1], stats: { flankHits: [0, 0], artMorale: [0, 0], killed: [0, 0], lost: [0, 0], moraleBy: [noCause(), noCause()] }, lineup: [0, 0], breakTick: [-1, -1], breakWhy: [0, 0], stood: [0, 0], standTick: [-1, -1], bladeTick: [0, 0], planTick: [-1, -1], ai: [setup.sides?.[0]?.player ? 0 : 1, setup.sides?.[1]?.player ? 0 : 1], frontLockTick: [-1, -1], used: [0, 0, 0, 0], broken: [0, 0], end: null, winner: -1, log: { dropped: 0, accepted: [], events: [] } }
  if (invalidSetup(setup)) { s.end = 'invalid'; return s }
  const unit = P.field.unit
  const jit = P.field.spawnJitterCells * unit
  for (const side of [0, 1] as const) {
    const ls = setup.sides[side]
    // 진 (52 §6-1) — 받은 것 · 없으면 씨앗 (편마다 · 판을 만들 때 한 번 정해 상태에 둔다 — 거울 판이 편 이름표와 함께 뒤집는다)
    s.lineup[side] = ls.form ?? Math.floor(roll(s.seed, 0, `line:${side}`) * LINES)
    const cp = setup.map.camps[side]
    const bu = campU(s, side), bv = campV(s, side)
    // 진영: 줄은 spread 로 퍼지고 뒷줄(활·기병)은 face 반대쪽으로 rowGap 만큼씩 물러난다 (axis 0 은 u 쪽, axis 1 은 v 쪽)
    const place = (grp: Grp, i: number, n: number): Point => {
      const along = idiv(((2 * i + 1) - n) * cp.spread * unit, 2 * n)
      const back = cp.face * ROW[grp] * P.field.rowGapCells * unit
      return cp.axis === 0 ? { u: bu - back, v: bv + along } : { u: bu + along, v: bv - back }
    }
    GRPS.forEach(grp => {
      const men = ls.men[grp], n = squadCount(men)
      const parts = groupKinds(ls, grp, n, s.lineup[side])
      const fresh = Math.min(men, Math.max(0, ls.fresh?.[grp] ?? 0))
      for (let i = 0; i < n; i++) {
        const id = s.squads.length
        const cnt = parts[i]!.men
        const j = jit > 0 ? Math.floor(roll(s.seed, 0, `spawn:${id}`) * (2 * jit + 1)) - jit : 0
        const p = place(grp, i, n)
        const u = clamp(cp.axis === 1 ? p.u + j : p.u, 0, lastU(map)), v = clamp(cp.axis === 0 ? p.v + j : p.v, 0, lastV(map))
        const stance = (P.field.stanceStart === 1 ? STANCE_NONE : Math.floor(roll(s.seed, 0, `stance:${id}`) * 3)) as 0 | 1 | 2 | 3
        s.squads.push({ id, side, grp, kind: parts[i]!.kind, men: cnt, menMax: cnt, fresh: men > 0 ? idiv(fresh * cnt, men) : 0, u, v, homeU: u, homeV: v, lock: -1, sleep: ticksOf(cp.asleep ?? 0), daze: 0, rem: 0, held: 0, flank: 0, stance, morale0: ls.morale, shock: 0, goal: null, manual: 0, target: -1, hp: cnt * MILLI, morale: ls.morale, foe: -1, calm: 0, form: 0, cmd: -1, reach: grp === 'bows' ? P.field.bowRangeCells * unit : 0, aim: -1,
          order: ORD_NONE, orderTick: -1, orderAt: null, ran: 0, bonus: 0, hitTick: -1, flee: 0,
          bw: P.field.bodyWCells * unit, bd: (grp === 'horse' ? P.field.horseBodyDCells : P.field.bodyDCells) * unit, face: side === 0 ? 0 : HERO_DIRS / 2, pushed: 0, regrouped: 0, countered: 0, shoveU: 0, shoveV: 0, shoveN: 0 })
      }
    })
    if (ls.hero) {
      const hp0 = place('front', 0, 1)
      const hero: Hero = { side, id: ls.hero.id, u: clamp(hp0.u, 0, lastU(map)), v: clamp(hp0.v, 0, lastV(map)), goal: null, manual: 0, grp: -1, stun: 0, hp: P.field.heroHp, rem: 0,
        mu: ls.hero.mu, tong: ls.hero.tong ?? ls.hero.mu, dir: -1, face: side === 0 ? 0 : HERO_DIRS / 2, foe: -1, atk: -1, dash: 0, dashDir: 0, dashCd: 0,
        art: ls.hero.art ?? HERO_ART_DEFAULT, artCd: 0, artOn: 0, why: WHY_NONE, whyTick: -1, hitIds: [], grit: 0, gritN: 0, bangTick: -1, runIn: 0 }
      s.heroes.push(hero)
    }
  }
  // 무리 기준 점 — 처음은 대들의 가운데 (걸음 1.5 가 진 자리를 이 점 둘레로 놓는다)
  for (const side of [0, 1] as const) for (const g of GRPS) s.anchor.push(groupCenter(s, side, g))
  // 목책 체력은 치는 편(주인이 아닌 편) 사람 1,000명마다의 값 — 병력이 달라도 깨는 시간이 같다 (44 §2-3)
  const total = [0, 1].map(side => GRPS.reduce((a, g) => a + setup.sides[side]!.men[g], 0))
  for (const p of map.pieces) p.hp = Math.max(1, idiv(p.hp * total[1 - p.owner]!, MILLI))
  armyInit(s)
  return s
}

/**
 * 동점 가르기 — 같은 편 대끼리 시작 자리로 늘 같은 차례를 준다: 시작 v → 무리 줄 → 진영에서 앞쪽으로 떨어진 깊이.
 * 배열 차례·편 이름표·u 거울에 안 기댄다 (같은 편의 두 대는 시작 자리가 다르다).
 */
export function rankCmp(s: FieldState, a: Squad, b: Squad): number {
  if (a.homeV !== b.homeV) return a.homeV - b.homeV
  if (ROW[a.grp] !== ROW[b.grp]) return ROW[a.grp] - ROW[b.grp]
  return (a.homeU - campU(s, a.side)) * fwd(a.side) - (b.homeU - campU(s, b.side)) * fwd(b.side)
}

/** (pu 에서 본) a 가 b 보다 고를 만한가 — 거리 → v 가 작은 쪽 → 고르는 편의 앞쪽 → 시작 자리 */
function better(s: FieldState, side: 0 | 1, pu: number, a: Squad, da: number, b: Squad | null, db: number): boolean {
  if (b === null) return true
  if (da !== db) return da < db
  if (a.v !== b.v) return a.v < b.v
  const fa = (a.u - pu) * fwd(side), fb = (b.u - pu) * fwd(side)
  if (fa !== fb) return fa > fb
  return rankCmp(s, a, b) < 0
}

/** 가장 가까운 산 적 대 (pick 이 거르는 것 빼고) */
export function nearestFoe(s: FieldState, q: Squad, ok: (t: Squad, d: number) => boolean): Squad | null {
  let best: Squad | null = null, bd = 0
  for (const t of s.squads) {
    if (t.side === q.side || t.men <= 0) continue
    const d = dist2(q.u, q.v, t.u, t.v)
    if (ok(t, d) && better(s, q.side, q.u, t, d, best, bd)) { best = t; bd = d }
  }
  return best
}

/** 무리를 (tu, tv) 로 — 대마다 시작 줄의 상대 자리를 더해 한 점에 겹치지 않는다. 줄이 판 밖으로 나가면 가운데를 판 안으로 당긴다 (45 §1-3) */
function moveGroup(s: FieldState, grp: Grp, tu: number, tv: number): void {
  const qs = s.squads.filter(q => q.side === 0 && q.grp === grp)
  const live = qs.filter(q => q.men > 0)
  const L = lastU(s.map), W = lastV(s.map)
  let su = 0, sv = 0
  for (const q of live) { su += q.homeU; sv += q.homeV }
  const n = Math.max(1, live.length)
  const cu = idiv(su, n), cv = idiv(sv, n)
  let loU = 0, hiU = L, loV = 0, hiV = W
  for (const q of live) {
    loU = Math.max(loU, cu - q.homeU); hiU = Math.min(hiU, L - (q.homeU - cu))
    loV = Math.max(loV, cv - q.homeV); hiV = Math.min(hiV, W - (q.homeV - cv))
  }
  const gu = live.length === 0 ? tu : loU <= hiU ? clamp(tu, loU, hiU) : idiv(loU + hiU, 2)
  const gv = live.length === 0 ? tv : loV <= hiV ? clamp(tv, loV, hiV) : idiv(loV + hiV, 2)
  const bank = banks(s)
  for (const q of qs) {
    q.manual = 1
    q.order = ORD_MOVE
    q.orderTick = s.tick
    q.foe = -1
    q.target = -1
    const g = live.length === 0 ? { u: gu, v: gv } : { u: clamp(gu + q.homeU - cu, 0, L), v: clamp(gv + q.homeV - cv, 0, W) }
    q.goal = leash(s, q, g, bank)
  }
}

/** 산 적 대인가 (「적을 쳐라」의 u) */
const liveFoe = (s: FieldState, id: number): boolean => id >= 0 && id < s.squads.length && s.squads[id]!.side === 1 && s.squads[id]!.men > 0

/** 입력의 꼴이 맞나 — 맞지 않으면 버리고 센다 (판 상태로만 가르므로 기록 재생에서도 같다) */
function inputOk(s: FieldState, i: FieldInput): boolean {
  const unit = P.field.unit
  const inMap = i.u >= 0 && i.v >= 0 && i.u <= s.map.u * unit && i.v <= s.map.w * unit
  switch (i.op) {
    case OP_MOVE: return inMap
    case OP_AUTO: return true
    // 앞줄은 0~2 (STANCE_*) · 활·기병은 0~3 (CMD_*) — 무리마다 뜻이 다르다 (types.ts OP_STANCE)
    case OP_STANCE: return i.g < 3 && i.u >= 0 && i.u <= (i.g === 0 ? STANCE_OPEN : CMD_HEIGHT)
    case OP_ATTACK: return i.v === 0 && liveFoe(s, i.u)
    case OP_HERO_DIR: return i.g === 3 && i.u >= 0 && i.u < HERO_DIRS && (i.v === 0 || i.v === 1)
    case OP_DASH: return i.g === 3 && i.u >= -1 && i.u < HERO_DIRS
    case OP_SKILL: return i.g === 3 && inMap
    case OP_AIM: return (i.g === 1 || i.g === 2) && inMap
    case OP_RALLY: return true
    default: return false
  }
}

/** 입력 하나를 받는다 — 명령 수 제한은 없다 (50 조작 v2 · C2). 한 틱에 받는 수의 상한만 stepField 가 지킨다 */
function applyInput(s: FieldState, i: FieldInput): void {
  // 물러남은 언제든 · op 만 본다 (무리 번호·자리는 상관없다 · 30 §6 규칙 3) — 기록에는 g 0 으로 남겨 기록 줄이 늘 읽힌다
  if (i.op === OP_RETREAT) {
    s.log.accepted.push({ tick: i.tick, g: 0, op: OP_RETREAT, u: 0, v: 0 })
    s.end = 'retreat'; s.winner = 1
    return
  }
  // 정수가 아닌 입력은 기록에 못 들어간다 (기록 전체가 안 읽히므로 받는 쪽에서 버린다)
  if (![i.g, i.op, i.u, i.v].every(Number.isInteger) || !(i.g >= 0 && i.g <= 3) || !inputOk(s, i)) { s.log.dropped++; return }
  s.log.accepted.push({ tick: i.tick, g: i.g, op: i.op, u: i.u, v: i.op === OP_DASH ? 0 : i.v })
  if (i.op === OP_STANCE || i.op === OP_AIM || i.op === OP_RALLY) { armyInput(s, i); return }
  if (i.g === 3) { heroInput(s, i); return }
  if (i.op === OP_ATTACK) { attackGroup(s, GRPS[i.g]!, i.u); return }
  // 판 끝 경계(칸 수 × unit)를 누른 것도 받되 판 안 마지막 단위로 붙인다
  const tu = clamp(i.u, 0, lastU(s.map)), tv = clamp(i.v, 0, lastV(s.map))
  if (i.op === OP_MOVE) { moveGroup(s, GRPS[i.g]!, tu, tv); return }
  for (const q of s.squads) {
    if (q.side !== 0 || q.grp !== GRPS[i.g]) continue
    q.manual = 0
    q.foe = -1
    q.goal = null
    q.order = ORD_NONE
    q.orderAt = null
  }
}

/** 무리에 「적을 쳐라」 — 손을 떼되(manual 0) 그 적만 노린다 · 그 적이 사라지면 알아서로 (retarget 이 푼다) */
function attackGroup(s: FieldState, grp: Grp, foe: number): void {
  const e = s.squads[foe]!, bank = banks(s)
  for (const q of s.squads) {
    if (q.side !== 0 || q.grp !== grp) continue
    q.manual = 0
    q.foe = foe
    q.order = ORD_ATTACK
    q.orderTick = s.tick
    q.target = foe
    q.goal = q.men > 0 ? leash(s, q, detour(s, q, e), bank) : null
  }
}

/** 한 편의 산 대가 모두 자고 있나 (그 편 장수도 안 걷는다 · 45 §2-19) */
export const sideAsleep = (s: FieldState, side: 0 | 1): boolean => s.squads.every(q => q.side !== side || q.men <= 0 || q.sleep > 0)

/** 지키는 편이 깼나 — 지키는 편(hold)은 우리 대 하나에 적이 holdTriggerCells 안으로 들어야 나선다 (편 단위 · 44 §2-4) · 지키는 편이 아니면 늘 참 */
export const alarmed = (s: FieldState, side: 0 | 1): boolean => !s.map.camps[side].hold || s.squads.some(q => q.side === side && q.men > 0 && near(s, q, P.field.holdTriggerCells))

/** 임시 AI — 가장 가까운 적 대를 목표로 · 장수는 제 편 앞줄 가장 앞 대 곁을 따른다. F6 의 정식 AI 가 대체한다 */
function retarget(s: FieldState): void {
  const bank = banks(s)
  // 지키는 편은 편 단위로 깬다 — 우리 대 하나에 적이 holdTriggerCells 안으로 들면 leash 안의 모두가 움직인다 (44 §2-4)
  const alarm = ([0, 1] as const).map(side => alarmed(s, side))
  for (const q of s.squads) {
    if (q.manual === 1 || q.men <= 0) continue
    // 무너져 달아나는 대 (장수를 안 따르는 편) — 제 진영 뒤로 (장수를 따르는 편은 army.ts place)
    if (q.flee === 1 && !follows(s, q.side)) { q.target = -1; q.goal = { u: clamp(campU(s, q.side) - fwd(q.side) * P.field.fleeBackCells * P.field.unit, 0, lastU(s.map)), v: q.v }; continue }
    // 「적을 쳐라」 — 그 적이 살아 있으면 그 적만 (지키는 편의 경보도 안 본다 · 사람이 시킨 일이다) · 사라졌으면 알아서로
    if (q.foe >= 0 && s.squads[q.foe]!.men <= 0) q.foe = -1
    if (q.foe >= 0) { const f = s.squads[q.foe]!; q.target = f.id; q.goal = leash(s, q, detour(s, q, f), bank); continue }
    // 장수를 따르는 편은 army.ts 가 목표를 정한다 (기본 행동 · 큰 수)
    if (follows(s, q.side)) continue
    let e = nearestFoe(s, q, () => true)
    q.target = e ? e.id : -1
    // 돕기 — 같은 편 앞줄이 맞물려 있고 내가 supportCells 안에서 놀고 있으면 그 적에게 간다
    if (e && q.grp !== 'bows' && q.lock < 0) {
      const r2 = sq(P.field.supportCells * P.field.unit)
      let bd2 = 0, helped: Squad | null = null
      for (const f of s.squads) {
        if (f.side !== q.side || f.men <= 0 || f.lock < 0 || s.squads[f.lock]!.men <= 0) continue
        const d = dist2(q.u, q.v, f.u, f.v)
        if (d <= r2 && better(s, q.side, q.u, f, d, helped, bd2)) { helped = f; bd2 = d }
      }
      // 도우러 가는 적이 목표다 — 걸음은 그 적이 맞붙는 거리에 들면 멈춘다 (목표만 바꾸고 노리는 적을 두면 그 적 자리에 겹쳐 선다)
      if (helped) { e = s.squads[helped.lock]!; q.target = e.id }
    }
    if (e && !alarm[q.side]) e = null
    q.goal = e ? leash(s, q, detour(s, q, e), bank) : null
  }
  for (const h of s.heroes) {
    if (h.manual === 1) continue
    if (follows(s, h.side)) { h.goal = aiHeroGoal(s, h); continue }
    let best: Squad | null = null, bd = 0
    for (const q of s.squads) {
      if (q.side !== h.side || q.grp !== 'front' || q.men <= 0) continue
      const d = dist2(h.u, h.v, q.u, q.v)
      const fa = q.u * fwd(h.side), fb = best ? best.u * fwd(h.side) : 0
      // 가장 앞 앞줄 — 동점은 장수와의 거리 → 자리 (배열 차례가 아니다 · 45 §1-2)
      if (best === null || fa > fb || (fa === fb && better(s, h.side, h.u, q, d, best, bd))) { best = q; bd = d }
    }
    h.goal = best ? { u: best.u, v: best.v } : null
  }
}

/** 적 대가 이 대 곁 cells 칸 안에 있나 */
function near(s: FieldState, q: Squad, cells: number): boolean {
  const r2 = sq(cells * P.field.unit)
  return s.squads.some(e => e.side !== q.side && e.men > 0 && dist2(q.u, q.v, e.u, e.v) <= r2)
}

/**
 * 지키는 편의 물가 — 진영 앞쪽으로 leashCells 안에서 처음 만나는 얕은 물 칸 줄 앞의 경계 (단위) · 없으면 null.
 * 지키는 편은 이 너머로 안 나간다 (물에 들어가 싸우는 쪽이 진다 · 44 §2-6). face 가 -1 이면 u ≥ 이것, +1 이면 u ≤ 이것.
 */
export function banks(s: FieldState): [number | null, number | null] {
  const out: [number | null, number | null] = [null, null]
  const unit = P.field.unit, mp = s.map
  for (const side of [0, 1] as const) {
    const cp = mp.camps[side]
    if (!cp.hold || cp.axis !== 0) continue
    const c0 = idiv(campU(s, side), unit)
    for (let k = 0; k <= P.field.leashCells; k++) {
      const cu = c0 + cp.face * k
      if (cu < 0 || cu >= mp.u) break
      let wet = false
      for (let cv = 0; cv < mp.w && !wet; cv++) wet = mp.cells[cu * mp.w + cv] === G_SHALLOW
      if (wet) { out[side] = cp.face > 0 ? cu * unit - 1 : (cu + 1) * unit; break }
    }
  }
  return out
}

/** 지키는 편(hold)의 목표를 물가 안쪽으로, 시작 자리에서 leashCells 안으로 자른다 (활도 같다 · 정수 제곱근으로 줄여 가까운 점) */
export function leash(s: FieldState, q: Squad, goal: Point, bank: readonly [number | null, number | null]): Point {
  const cp = s.map.camps[q.side]
  if (!cp.hold) return goal
  const b = bank[q.side]
  const g = b === null ? goal : { u: cp.face > 0 ? Math.min(goal.u, b) : Math.max(goal.u, b), v: goal.v }
  const r = P.field.leashCells * P.field.unit
  const dx = g.u - q.homeU, dy = g.v - q.homeV
  const d2 = dx * dx + dy * dy
  if (d2 <= r * r) return g
  const root = isqrt(d2)
  const len = root * root === d2 ? root : root + 1
  return { u: q.homeU + idiv(dx * r, len), v: q.homeV + idiv(dy * r, len) }
}

/** 지키는 편이 이 자리로 가도 되나 — 한계(leash)·물가를 넘지 않거나, 넘었어도 더 나가지 않을 때만 (밀어내기·미끄러짐도 이것으로 자른다 · 45 §2-17) */
export function holdOk(s: FieldState, q: Squad, x: number, y: number, bank: readonly [number | null, number | null]): boolean {
  const cp = s.map.camps[q.side]
  if (!cp.hold) return true
  const r2 = sq(P.field.leashCells * P.field.unit)
  const d = dist2(x, y, q.homeU, q.homeV)
  if (d > r2 && d > dist2(q.u, q.v, q.homeU, q.homeV)) return false
  const b = bank[q.side]
  if (b === null) return true
  return cp.face > 0 ? x <= b || x <= q.u : x >= b || x >= q.u
}

/**
 * 목책 줄이 둘 사이에 있으면 문으로 돌아간다 (간단한 길 찾기). 줄 칸은 [u0, u1) — 문 바로 너머의 단위 점을 목표로 삼고,
 * v 는 내 자리를 문 폭 안으로 붙여 무리가 한 점에 모이지 않게 한다 (45 §1-3 · 1-6).
 */
export function detour(s: FieldState, q: Squad, e: Squad): Point {
  const gate = s.map.pieces.find(p => p.kind === 'gate')
  if (gate) {
    const unit = P.field.unit
    const lo = gate.u0 * unit, hi = gate.u1 * unit
    const sideOf = (u: number): number => u < lo ? -1 : u >= hi ? 1 : 0
    const a = sideOf(q.u), b = sideOf(e.u)
    if (a !== 0 && b !== 0 && a !== b) {
      const v0 = gate.v0 * unit + unit, v1 = gate.v1 * unit - 1 - unit
      return { u: a < 0 ? hi : lo - 1, v: v0 <= v1 ? clamp(q.v, v0, v1) : idiv(v0 + v1, 2) }
    }
  }
  return { u: e.u, v: e.v }
}

/** 한 걸음 (1칸 이하) — 얕은 물과 올라가는 높은 터는 느리고, 깊은 물·막힘 칸에는 못 들어간다 (막히면 한 축으로 미끄러진다) */
function stepOnce(s: FieldState, K: Kit, side: 0 | 1, u: number, v: number, goal: Point, speed: number): Point {
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

/** 땅을 보고 걷는다 — 틱당 걸음이 1칸을 넘으면 1칸 이하로 나눠 찍어 벽을 건너뛰지 않는다 (돌격 달리기가 걸음을 키운다 · 45 §2-11) */
export function walk(s: FieldState, K: Kit, side: 0 | 1, u: number, v: number, goal: Point, speed: number): Point {
  const unit = P.field.unit
  const n = Math.max(1, idiv(speed + unit - 1, unit))
  let p: Point = { u, v }
  for (let k = 0; k < n; k++) {
    const nx = stepOnce(s, K, side, p.u, p.v, goal, idiv(speed * (k + 1), n) - idiv(speed * k, n))
    if (nx.u === p.u && nx.v === p.v) break
    p = nx
  }
  return p
}

/**
 * 진영 닿음은 막힘 칸(목책)을 가로지르지 못한다 — 두 점 사이를 반 칸 이하 간격으로 찍어 본다 (화살은 넘는다 · 45 §2-12).
 * gate 가 참이면(칼날 · 장수 맞음) 서 있는 문 칸은 막지 않는다 — 칼날은 문 앞에서만 닿는다: 문을 사이에 두고 양쪽이 맞붙고, 마디 너머로는 안 닿는다 (44 §2-1)
 */
/** 막힘 칸이 하나라도 있는 지도인가 (막힘 칸은 늘지 않는다 — 목책이 부서지면 줄 뿐 · 없으면 clearLine 이 늘 참이라 건너뛴다) */
const blockless = new WeakMap<Uint8Array, boolean>()
function noBlock(map: FieldMap): boolean {
  let v = blockless.get(map.cells)
  if (v === undefined) { v = !map.cells.includes(G_BLOCK); blockless.set(map.cells, v) }
  return v
}
function clearLine(map: FieldMap, a: Point, b: Point, gate = false): boolean {
  if (noBlock(map)) return true
  const unit = P.field.unit
  const span = Math.max(Math.abs(b.u - a.u), Math.abs(b.v - a.v))
  const n = Math.max(4, idiv(2 * span + unit - 1, unit))
  for (let k = 1; k < n; k++) {
    const u = a.u + idiv((b.u - a.u) * k, n), v = a.v + idiv((b.v - a.v) * k, n)
    if (groundAt(map, u, v) !== G_BLOCK) continue
    if (gate && map.pieces.some(p => p.kind === 'gate' && p.hp > 0 && u >= p.u0 * unit && u < p.u1 * unit && v >= p.v0 * unit && v < p.v1 * unit)) continue
    return false
  }
  return true
}
/** 칼날이 닿는 줄 (문은 사이에 두고 닿는다) */
export const bladeLine = (map: FieldMap, a: Point, b: Point): boolean => clearLine(map, a, b, true)

/** 한 틱의 값표 (P.realm.tac* · P.field 를 ‰ 정수로 — 튜닝 콘솔이 값을 바꿔도 바로 따른다) */
function kit() {
  const R = P.realm, F = P.field
  return {
    grp: { front: m(R.tacGrpFront), bows: m(R.tacGrpBows), horse: m(R.tacGrpHorse) } as Record<Grp, number>,
    charge: m(R.tacChargeMul), hold: m(R.tacHoldMul), open: m(R.tacOpenFront), openVolley: m(R.tacOpenVolley),
    up: m(R.tacTriUp), down: m(R.tacTriDown), flank: m(R.tacFlankMul),
    takenCharge: m(R.tacTakenCharge), takenHold: m(R.tacTakenHold), takenVolley: m(R.tacTakenVolley),
    triTakeWin: m(R.tacTriTakeWin), triTakeLose: m(R.tacTriTakeLose),
    volleyHold: m(R.tacVolleyHold), volleyCharge: m(R.tacVolleyCharge),
    height: m(R.tacHeight), ford: m(R.tacFordCharge), counterCut: m(R.tacCounterCut), kindUp: m(R.counterUp), kindDown: m(R.counterDown), punchHold: m(R.tacPunchHoldTake), horseBows: m(R.tacFlank2), edge: F.edgeMulPermille, water: F.waterSpeedPermille, climb: F.highClimbPermille,
    meleeR2: sq(F.meleeRangeCells * F.unit), bowR2: sq(F.bowRangeCells * F.unit), bowR: F.bowRangeCells * F.unit, flankV: F.flankVCells * F.unit,
    /** 틱 나눔: 초당 백만분의 일 → 틱당 천분의 일 */
    perTickDen: MILLI * F.hz,
  }
}
export type Kit = ReturnType<typeof kit>

/** 잃은 몫 (사기 셈의 바탕 · 천분율) */
const lostOf = (q: Squad): number => q.menMax > 0 ? idiv((q.menMax * MILLI - q.hp) * P.field.moraleLossLostShare, q.menMax * MILLI) : 0
/** 목책 문이 서 있는 동안의 잃은 몫 (tacWallSteady 만큼 덜 꺾인다) */
const steadied = (lost0: number): number => mul(lost0, MILLI - m(P.realm.tacWallSteady))

/**
 * 목책 마디·문 — 곁(맞붙는 거리)에 선 깬 적 앞줄·기병의 사람 수를 조각마다 먼저 더하고 한 번 나눈다 (나머지는 들고 간다 · 45 §1-4).
 * 체력이 다하면 그 칸이 열리고, 문이면 지키는 편에 문 부서짐 충격 하나 (문이 주던 위안은 그 틱 값으로 굳혀 한꺼번에 사라지지 않는다 · 45 §2-10)
 */
function hitPieces(s: FieldState, K: Kit): void {
  const unit = P.field.unit
  for (const p of s.map.pieces) {
    if (p.hp <= 0) continue
    // 칸은 반열림 [u0, u1) — 닫힌 끝은 u1 × unit - 1 (거울이 맞게)
    const loU = p.u0 * unit, hiU = p.u1 * unit - 1, loV = p.v0 * unit, hiV = p.v1 * unit - 1
    let men = 0
    for (const q of s.squads) {
      if (q.side === p.owner || q.men <= 0 || q.grp === 'bows' || q.sleep > 0) continue
      if (dist2(q.u, q.v, clamp(q.u, loU, hiU), clamp(q.v, loV, hiV)) <= K.meleeR2) men += q.men
    }
    const num = men * P.field.pieceHitPerManPerSec + (p.rem ?? 0)
    const dmg = idiv(num, K.perTickDen)
    p.rem = num - dmg * K.perTickDen
    p.hp = Math.max(0, p.hp - dmg)
    if (p.hp > 0) continue
    for (let cu = p.u0; cu < p.u1; cu++) for (let cv = p.v0; cv < p.v1; cv++) s.map.cells[cu * s.map.w + cv] = G_PLAIN
    if (p.kind !== 'gate') continue
    const stillWalled = s.map.pieces.some(o => o.owner === p.owner && o.kind === 'gate' && o.hp > 0)
    for (const q of s.squads) {
      if (q.side !== p.owner) continue
      addShock(s, q, P.field.gateBreakMoraleLoss, 'melee')
      if (!stillWalled) { const l0 = lostOf(q); q.held = l0 - steadied(l0) }
    }
  }
}

/**
 * 진영이 무너짐 — 적 대가 그 편 진영 앞줄 선을 넘어(진영 쪽으로) campBreakCells 안까지 실제로 들어오면 한 번, 그 편 대마다 사기가 꺾인다.
 * 목책 너머에 서 있다가 문이 열린 틱에 같이 터지지 않는다 (45 §2-10).
 */
function breakCamps(s: FieldState): void {
  const r2 = sq(P.field.campBreakCells * P.field.unit)
  for (const side of [0, 1] as const) {
    if (s.broken[side] === 1) continue
    const cp = s.map.camps[side]
    const cu = campU(s, side), cv = campV(s, side)
    const inside = (q: Squad): boolean => (cp.axis === 0 ? q.u - cu : q.v - cv) * cp.face <= 0
    if (!s.squads.some(q => q.side !== side && q.men > 0 && inside(q) && dist2(q.u, q.v, cu, cv) <= r2 && clearLine(s.map, q, { u: cu, v: cv }))) continue
    s.broken[side] = 1
    for (const q of s.squads) if (q.side === side) addShock(s, q, P.field.campBreakMoraleLoss, 'melee')
  }
}

/**
 * 목책이 지키는 쪽에게 주는 것 (44 §2-1): 문이 서 있는 동안 목책 너머(주인 진영 쪽)에 선 대는 밖에서 쏜 화살을 안 맞는다 —
 * 지키는 쪽 활만 넘겨 쏘고, 치는 쪽 칼날은 문 앞에서만(clearLine) 닿는다. 문이 부서지면 덮개도 없다.
 */
function covered(s: FieldState, shooter: Squad, t: Squad): boolean {
  const unit = P.field.unit
  for (const g of s.map.pieces) {
    if (g.kind !== 'gate' || g.hp <= 0 || t.side !== g.owner) continue
    const lo = g.u0 * unit, hi = g.u1 * unit
    const sideOf = (u: number): number => u < lo ? -1 : u >= hi ? 1 : 0
    const inner = campU(s, g.owner) >= hi ? 1 : -1
    if (sideOf(t.u) === inner && sideOf(shooter.u) === -inner) return true
  }
  return false
}
/** 맞붙기 — 모든 대가 한꺼번에 치고 (순서에 안 따른다) 피해와 옆구리 맞음을 모았다가 한 번에 깎는다. 돌려주는 값: 편마다 칼날이 닿았나 (같이 닿기) */
function fight(s: FieldState, K: Kit): [boolean, boolean] {
  const n = s.squads.length
  const dmg = new Array<number>(n).fill(0)
  const flanked = new Array<number>(n).fill(0)
  // 옆·뒤에서 맞은 칼날 몫 (까닭별 사기 셈 · moraleBy.flank)
  const sideV = new Array<number>(n).fill(0)
  const contact: [boolean, boolean] = [false, false]
  const openFront: [boolean, boolean] = [false, false]
  for (const q of s.squads) if (q.men > 0 && q.grp === 'front' && q.stance === STANCE_OPEN) openFront[q.side] = true
  // 이 틱 앞의 값 (사기의 곁의 기운 몫 · 사건 줄 — 사건은 읽기용이다)
  const walled0 = [0, 1].map(side => s.map.pieces.some(p => p.owner === side && p.kind === 'gate' && p.hp > 0))
  const raw0 = s.squads.map(q => rawLoss(q, walled0[q.side]!))
  const lock0 = s.squads.map(q => q.lock)
  // loss 사건을 나눌 몫 — 맞은 대마다 [친 쪽 id(장수는 -1 - 편), 종류, 몫] 셋씩
  const hits: number[][] = s.squads.map(() => [])
  // 맞물림 — 앞줄은 맞붙는 거리 안의 가장 가까운 적 앞줄·기병과 맞물린다 (기병은 안 맞물려 옆으로 돌아간다)
  for (const q of s.squads) {
    q.lock = -1
    if (q.men <= 0 || q.grp !== 'front' || q.flee === 1) continue
    const t = nearestFoe(s, q, (t) => t.grp !== 'bows' && touching(q, t) && bladeLine(s.map, q, t))
    if (t) q.lock = t.id
  }
  // 돌격의 쾅 — 도움닫기를 한 대가 겨눈 적에 닿은 순간 (51 §8): 맞은 대가 밀려나고 덤이 붙는다 · 방진에 막힌 기병은 튕겨 나고 사기를 잃는다
  const struck = runImpacts(s)
  // 처음 맞물린 순간 (세기 = 붙은 사람 수 · 돌격의 쾅으로 이미 적은 대는 빼고)
  for (const q of s.squads) {
    if (q.lock < 0 || lock0[q.id]! >= 0 || struck[q.id]) continue
    const e = s.squads[q.lock]!
    emit(s, { kind: 'impact', side: q.side, id: q.id, u: idiv(q.u + e.u, 2), v: idiv(q.v + e.v, 2), n: q.men + e.men, to: e.id, how: beatsKind(q.kind, e.kind) ? HIT_GOOD : HIT_PLAIN })
    // 상성에 진 첫 맞물림 — 진 쪽 대 사기 kindFirstShock (대마다 한 번 · 금빛 숫자)
    if (beatsKind(q.kind, e.kind)) counterShock(s, e, 'melee')
  }
  // 활의 닿는 거리 (화면이 읽는 칸 · 높은 터 위면 bowHighReachPermille 배)
  for (const q of s.squads) if (q.grp === 'bows') q.reach = groundAt(s.map, q.u, q.v) === G_HIGH ? mul(K.bowR, P.field.bowHighReachPermille) : K.bowR
  // 겨눔 — 사거리 안의 가장 가까운 적 (도망치는 대는 안 친다)
  const aim = new Array<number>(n).fill(-1)
  for (const q of s.squads) {
    if (q.men <= 0 || q.sleep > 0 || q.flee === 1) continue
    const r2 = q.reach * q.reach
    const t = q.grp === 'bows' ? nearestFoe(s, q, (t, d) => d <= r2 && !covered(s, q, t)) : nearestFoe(s, q, t => touching(q, t) && bladeLine(s.map, q, t))
    if (t) aim[q.id] = t.id
  }
  // 맞쏘기 — 활은 사거리 안의 적 활 가운데 우리 편을 쏘고 있는 것을 앞줄보다 먼저 겨눈다 (알아서) · 맞쏘기 명령이면 적 활부터 (쏘든 안 쏘든)
  // 화살비 명령이면 가장 가까운 적 앞줄에 몰아 쏜다 (찍은 적이 있으면 아래 「적을 쳐라」가 그 적으로 바꾼다)
  const first = aim.slice()
  // 화살비(찍은 자리) — 그 자리 둘레 volleyRadiusCells 안의 적 대 가운데 찍은 곳에 가장 가까운 것 (닿으면)
  const focus = new Array<boolean>(n).fill(false)
  for (const q of s.squads) {
    if (q.men <= 0 || q.sleep > 0 || q.grp !== 'bows' || q.flee === 1) continue
    const ok = (t: Squad, d: number): boolean => d <= q.reach * q.reach && !covered(s, q, t)
    let t = nearestFoe(s, q, (t, d) => t.grp === 'bows' && (q.cmd === CMD_COUNTER || first[t.id]! >= 0) && ok(t, d))
    const at = q.order === ORD_VOLLEY ? q.orderAt : null
    if (at) {
      const r2 = sq(P.field.volleyRadiusCells * P.field.unit)
      let best: Squad | null = null, bd = 0
      for (const e of s.squads) {
        if (e.side === q.side || e.men <= 0) continue
        const d = dist2(at.u, at.v, e.u, e.v)
        if (d <= r2 && ok(e, dist2(q.u, q.v, e.u, e.v)) && (best === null || d < bd || (d === bd && rankCmp(s, e, best) < 0))) { best = e; bd = d }
      }
      if (best) { t = best; focus[q.id] = true }
    }
    if (t) aim[q.id] = t.id
  }
  // 적을 쳐라 — 받은 적이 닿는 거리에 있으면 그 적을 먼저 친다 (활은 맞쏘기보다 먼저)
  for (const q of s.squads) {
    if (q.men <= 0 || q.sleep > 0 || q.foe < 0 || q.flee === 1) continue
    const t = s.squads[q.foe]!, r2 = q.reach * q.reach
    if (t.men > 0 && (q.grp === 'bows' ? dist2(q.u, q.v, t.u, t.v) <= r2 && !covered(s, q, t) : touching(q, t) && bladeLine(s.map, q, t))) aim[q.id] = t.id
  }
  // 맞물림 상한 (52 §1-2) — 한 적 대를 칼날로 치는 대는 foeCapPerSquad 까지 (맞물린 대 → 몸이 가까운 차례 → 시작 자리) · 남는 대는 기다린다
  capMelee(s, aim)
  for (const q of s.squads) {
    if (q.men <= 0 || q.sleep > 0 || aim[q.id]! < 0) continue
    const e = s.squads[aim[q.id]!]!
    if (q.grp !== 'bows') contact[q.side] = true
    let v = mul(q.men * P.field.powerPerSec, K.grp[q.grp])
    if (q.grp === 'front') v = mul(v, q.stance === STANCE_CHARGE ? K.charge : q.stance === STANCE_HOLD ? K.hold : q.stance === STANCE_OPEN ? K.open : MILLI)
    if (q.grp === 'bows' && openFront[q.side]) v = mul(v, K.openVolley)
    if (q.grp === 'bows' && groundAt(s.map, q.u, q.v) === G_HIGH) v = mul(v, K.height)
    // 세모 — 이긴 쪽은 세고 진 쪽이 받는 손실은 크다 (본편 tacTriUp/Down · tacTriTakeLose/Win)
    if (q.grp === 'front' && e.grp === 'front') {
      if (beats(q.stance, e.stance)) v = mul(mul(v, K.up), K.triTakeLose)
      else if (beats(e.stance, q.stance)) v = mul(mul(v, K.down), K.triTakeWin)
    }
    // 받는 배수 — 맞붙는 칼날에만 (화살비에는 받는 배수가 없다 · 화살은 방진에 세고 돌격에 약하다)
    if (e.grp === 'front' && q.grp !== 'bows') v = mul(v, e.stance === STANCE_CHARGE ? K.takenCharge : e.stance === STANCE_HOLD ? K.takenHold : MILLI)
    // 방패 벽 진의 방진은 덜 받는다 (화살·칼날 둘 다 · 52 §6-1 「버팀에 덤」)
    if (e.grp === 'front' && e.stance === STANCE_HOLD && s.lineup[e.side] === LINE_SHIELD) v = mul(v, P.field.lineShieldTakenPermille)
    if (e.grp === 'front' && q.grp === 'bows') v = mul(v, e.stance === STANCE_HOLD ? K.volleyHold : e.stance === STANCE_CHARGE ? K.volleyCharge : MILLI)
    if (e.grp === 'bows') v = mul(v, K.takenVolley)
    // 맞쏘기 명령 — 우리 활을 쏘는 적 활은 그 세기가 tacCounterCut 으로 꺾인다
    if (q.grp === 'bows' && e.grp === 'bows' && e.cmd === CMD_COUNTER && aim[e.id] === q.id) v = mul(v, K.counterCut)
    if (groundAt(s.map, q.u, q.v) === G_SHALLOW) v = mul(v, K.ford)
    // 병종 상성 (51 §3) — 창 방진 > 기병 (기병이 방진을 치면 약하고, 방진이 기병을 치면 tacPunchHoldTake 배) · 기병 > 활 (tacFlank2)
    if (q.grp === 'horse' && e.grp === 'front' && e.stance === STANCE_HOLD) v = mul(v, P.field.horseVsHoldPermille)
    if (q.grp === 'front' && q.stance === STANCE_HOLD && e.grp === 'horse') v = mul(v, K.punchHold)
    if (q.grp === 'horse' && e.grp === 'bows') v = mul(v, K.horseBows)
    // 본편 병종 상성 (battle.ts BEATS · 화살에도) — 이기면 ×counterUp · 지면 ×counterDown (방패는 화살을 덜 맞고 쇠뇌는 방패를 뚫고 활은 창을 잘 잡는다)
    v = mul(v, kindMul(K, q.kind, e.kind))
    // 화살비(찍은 자리)에 몰아 쏨 · 돌격 덤 (부딪힌 순간 chargeImpactPermille → chargeBonusSec 에 걸쳐 1)
    if (focus[q.id]) v = mul(v, P.field.volleyFocusPermille)
    if (q.bonus > 0) v = mul(v, MILLI + idiv((P.field.chargeImpactPermille - MILLI) * q.bonus, Math.max(1, ticksOf(P.field.chargeBonusSec))))
    // 첫 칼 — 자는 대 · 깬 뒤 edgeSec 동안
    if (e.sleep > 0 || e.daze > 0) v = mul(v, K.edge)
    // 향 (52 §1-1) — 맞는 대가 보는 쪽 기준 앞 90° 는 정면(×1) · 뒤 90° 는 rearHitPermille · 나머지 옆은 sideHitPermille (칼날만 · 옆·뒤면 옆구리를 센다)
    let fl = false
    if (q.grp !== 'bows') {
      const k = hitArc(e, q)
      if (k > 0) { v = mul(v, k === 2 ? P.field.rearHitPermille : P.field.sideHitPermille); flanked[e.id]!++; fl = true 
        // 진 (52 §6-1) — 창 쐐기의 앞줄은 옆이 약하고 · 넓은 날개의 기병은 옆·뒤를 더 세게 친다
        if (e.grp === 'front' && s.lineup[e.side] === LINE_WEDGE) v = mul(v, P.field.lineWedgeSidePermille)
        if (q.grp === 'horse' && s.lineup[q.side] === LINE_WINGS) v = mul(v, P.field.lineWingsFlankPermille)
      }
    }
    dmg[e.id]! += v
    if (fl) sideV[e.id]! += v
    hits[e.id]!.push(q.id, q.grp === 'bows' ? LOSS_ARROW : LOSS_BLADE, v)
    // 상성에 진 첫 화살 (활 → 창 · 쇠뇌 → 방패)
    if (q.grp === 'bows' && v > 0 && beatsKind(q.kind, e.kind)) counterShock(s, e, 'arrows')
  }
  for (const q of s.squads) if (q.men > 0 && q.lock >= 0) contact[q.side] = true
  // 지금 싸우는 상대 (읽기용 · 화면의 「공격 중」) — 친 적 → 맞물린 적 → 없음
  for (const q of s.squads) q.aim = q.men > 0 && q.sleep <= 0 && aim[q.id]! >= 0 ? aim[q.id]! : q.lock
  // 활이 쏜다 (읽기용 · volleyEventSec 마다 한 줄)
  if (s.tick % ticksOf(P.field.volleyEventSec) === 0) {
    for (const q of s.squads) if (q.grp === 'bows' && q.men > 0 && q.sleep <= 0 && aim[q.id]! >= 0) { const e = s.squads[aim[q.id]!]!; emit(s, { kind: 'volley', side: q.side, id: q.id, u: e.u, v: e.v, n: q.men, to: e.id, how: beatsKind(q.kind, e.kind) ? HIT_GOOD : HIT_PLAIN }) }
  }
  // 장수의 칼 (같은 틱에 한꺼번에) · 버텨라 (곁의 우리 대가 받는 피해 배수)
  const toHero = heroStrike(s, dmg, hits)
  for (const q of s.squads) if (dmg[q.id]! > 0) dmg[q.id] = mul(dmg[q.id]!, standOf(s, q))
  for (const q of s.squads) {
    if (q.men <= 0) continue
    const men0 = q.men
    const num = dmg[q.id]! + q.rem
    const d = idiv(num, K.perTickDen)
    q.rem = num - d * K.perTickDen
    q.hp = Math.max(0, q.hp - d)
    q.men = menOf(q.hp)
    if (flanked[q.id]! > 0) { q.flank++; s.stats.moraleBy[q.side].flank += (idiv(q.flank * P.field.moraleLossFlankPerSec, P.field.hz) - idiv((q.flank - 1) * P.field.moraleLossFlankPerSec, P.field.hz)) * q.menMax }
    if (d > 0) hitMorale(s, q, d, hits[q.id]!, sideV[q.id]!)
    if (dmg[q.id]! > 0 && q.sleep > 0) { q.sleep = 0; q.daze = ticksOf(P.field.edgeSec) }
    if (men0 > q.men) lossEvents(s, q, men0 - q.men, hits[q.id]!)
  }
  afterHits(s, K, aim)
  hitPieces(s, K)
  breakCamps(s)
  // 장수 — 곁의 적 앞줄·기병 사람 수와 적장의 칼에 깎인다 · 쓰러지면 몇 초 못 움직인다 (죽지 않는다 · hero.ts)
  heroTakeHits(s, toHero)
  // 죽은 대를 가리키는 맞물림·목표는 그 틱에 푼다 (45 §2-19)
  for (const q of s.squads) {
    if (q.lock >= 0 && s.squads[q.lock]!.men <= 0) q.lock = -1
    if (q.target >= 0 && s.squads[q.target]!.men <= 0) q.target = -1
    if (q.foe >= 0 && s.squads[q.foe]!.men <= 0) q.foe = -1
  }
  // 도미노 — 도망치는 대 곁의 우리 대 사기가 깎인다
  panic(s)
  // 목책 문이 안 부서진 동안 그 안의 편은 잃은 몫에 덜 꺾인다 (본편 tacWallSteady). 부서진 뒤는 그때까지 덜 꺾인 몫(held)을 그대로 둔다
  // 장수 곁의 기운 — 곁의 우리 대는 이 틱에 꺾인 몫의 auraOf 만큼 덜 꺾인다 (calm 에 쌓는다 · 본편 「격려」의 자리 · 30 §6 규칙 2)
  const walled = [0, 1].map(side => s.map.pieces.some(p => p.owner === side && p.kind === 'gate' && p.hp > 0))
  const breakLine = m(P.realm.tacBreakMorale)
  const routed: Squad[] = []
  for (const q of s.squads) {
    const raw = rawLoss(q, walled[q.side]!)
    const drop = raw - raw0[q.id]!
    // 버팀 (stand) 중인 장수 곁의 대는 standSteadyPermille 이 덜 꺾인다 (곁의 기운과 겹치면 큰 쪽)
    if (drop > 0 && q.men > 0) q.calm += drop * (standing(s, q) ? Math.max(auraOf(s, q), P.field.standSteadyPermille) : auraOf(s, q))
    const before = q.morale
    // 되오른 몫(곁의 기운·큰 외침·버팀)은 처음 사기의 moraleCapPermille 까지만 — 넘는 몫은 쌓아 두지 않는다 (둘 다 외치면 사기가 안 내려가 때를 다 쓰던 판)
    const top = Math.min(MILLI, mul(q.morale0, P.field.moraleCapPermille)), want = q.morale0 - raw + idiv(q.calm, MILLI)
    if (want > top) q.calm -= (want - top) * MILLI
    q.morale = clamp(q.morale0 - raw + idiv(q.calm, MILLI), 0, MILLI)
    if (q.men > 0 && before * MILLI >= q.morale0 * breakLine && q.morale * MILLI < q.morale0 * breakLine) { emit(s, { kind: 'rout', side: q.side, id: q.id, u: q.u, v: q.v, n: q.men }); routed.push(q) }
  }
  // 깨짐 (52 §1-5) — 한 대가 무너지면 곁(routNeighborCells)의 같은 편 대 사기가 routNeighborShock 뚝 (도미노 · 다음 틱 사기에 든다)
  const nr2 = sq(P.field.routNeighborCells * P.field.unit)
  for (const r of routed) for (const q of s.squads) if (q !== r && q.side === r.side && q.men > 0 && q.flee === 0 && dist2(q.u, q.v, r.u, r.v) <= nr2) addShock(s, q, P.field.routNeighborShock, 'domino')
  return contact
}

/**
 * 사람을 잃어 꺾인 사기의 까닭 (stats.moraleBy · 천분율 × 사람) — 이 틱에 깎인 체력 d 의 몫(moraleLossLostShare)을 친 쪽의 몫대로 화살 · 칼날(정면) · 옆·뒤 · 장수로 나눈다.
 * 읽기용이다 (셈에 되먹이지 않는다)
 */
function hitMorale(s: FieldState, q: Squad, d: number, hit: readonly number[], sideV: number): void {
  let arrows = 0, blade = 0, hero = 0
  for (let i = 0; i < hit.length; i += 3) { const how = hit[i + 1]!, v = hit[i + 2]!; if (how === LOSS_ARROW) arrows += v; else if (how === LOSS_HERO || how === LOSS_ART) hero += v; else blade += v }
  const all = arrows + blade + hero
  if (all <= 0) return
  const amt = idiv(d * P.field.moraleLossLostShare, MILLI)
  const by = s.stats.moraleBy[q.side]
  by.arrows += idiv(amt * arrows, all); by.hero += idiv(amt * hero, all)
  by.flank += idiv(amt * sideV, all); by.melee += idiv(amt * (blade - sideV), all)
}

/** 꺾인 사기의 바탕 (천분율) — 잃은 몫(목책 문이 서 있으면 덜) + 충격 + 옆구리 */
function rawLoss(q: Squad, walled: boolean): number {
  const lost0 = lostOf(q)
  const lost = walled ? steadied(lost0) : lost0 - q.held
  return lost + q.shock + idiv(q.flank * P.field.moraleLossFlankPerSec, P.field.hz)
}

/**
 * loss 사건 — 이 틱에 실제로 줄어든 사람 수(drop)를 친 쪽마다 몫대로 나눈다 (내림 뒤 남은 사람은 몫이 큰 차례 · 동점은 먼저 친 차례).
 * 읽기용이다 (셈에 되먹이지 않는다).
 */
function lossEvents(s: FieldState, q: Squad, drop: number, hit: readonly number[]): void {
  const k = hit.length / 3
  if (k === 0) return
  let total = 0
  for (let i = 0; i < k; i++) total += hit[i * 3 + 2]!
  if (total <= 0) return
  const share = new Array<number>(k), frac = new Array<number>(k)
  let given = 0
  for (let i = 0; i < k; i++) { const x = drop * hit[i * 3 + 2]!; share[i] = idiv(x, total); frac[i] = x - share[i]! * total; given += share[i]! }
  const order = Array.from({ length: k }, (_, i) => i).sort((a, b) => frac[b]! - frac[a]! || a - b)
  for (let j = 0; j < drop - given; j++) share[order[j % k]!]!++
  for (let i = 0; i < k; i++) {
    if (share[i]! <= 0) continue
    const src = hit[i * 3]!
    const by = src >= 0 ? s.squads[src]!.side : (-1 - src) as 0 | 1
    s.stats.killed[by] += share[i]!; s.stats.lost[q.side] += share[i]!
    emit(s, { kind: 'loss', side: src >= 0 ? s.squads[src]!.side : (-1 - src) as 0 | 1, id: src >= 0 ? src : -1, u: q.u, v: q.v, n: share[i]!, to: q.id, how: hit[i * 3 + 1]! })
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
    // 달아나는 대는 싸움에서 빠진 몫이다 — 사기를 fleeCountPermille 만 센다 (달아난 대가 멀리서 편 사기를 받쳐 끝나지 않던 판 · 판의 법칙 묶음)
    mw += q.menMax * (q.flee === 1 ? mul(q.morale, P.field.fleeCountPermille) : q.morale)
  }
  return { men, menMax, morale: menMax > 0 ? idiv(mw, menMax) : 0, morale0: m0 }
}

/** 편 사기 — 처음 사기에 견준 천분율 (끝 판정과 같은 셈 · 달아나는 대는 fleeCountPermille 만 · 투지·적 AI 가 읽는다) */
export function sideMorale(s: FieldState, side: 0 | 1): number {
  const t = sideTotals(s, side)
  return t.morale0 > 0 ? idiv(t.morale * MILLI, t.morale0) : 0
}

/** 끝 판정 — 사기가 문턱 아래로 가면 바로 끝난다 (30 §6 규칙 3). 문턱은 본편 P.realm.tacBreakMen/tacBreakMorale 그대로 */
function judge(s: FieldState): void {
  const downs: [number, number] = [0, 0]   // 0 = 안 무너짐 · 1 = 사람 · 2 = 사기
  const tot = [sideTotals(s, 0), sideTotals(s, 1)]
  for (const side of [0, 1] as const) if (s.squads.some(q => q.side === side && q.men > 0 && q.flee === 0 && q.grp !== 'bows')) s.bladeTick[side] = s.tick
  for (const side of [0, 1] as const) {
    const t = tot[side]!
    if (t.morale0 > 0 && t.morale * MILLI < t.morale0 * m(P.realm.tacBreakMorale)) downs[side] = 2
    else if (t.men * MILLI < t.menMax * m(P.realm.tacBreakMen)) downs[side] = 1
    // 칼 든 대(앞줄·기병)가 breakNoBladesSec 내내 다 달아났거나 없으면 편이 무너진다 — 활만 남아 서로 쏘며 때를 다 쓰던 판 (2차)
    else if (P.field.breakNoBladesSec > 0 && s.tick - s.bladeTick[side] >= ticksOf(P.field.breakNoBladesSec)) downs[side] = 2
  }
  // 편이 무너짐 (검수 B5) — 문턱 아래로 간 틱에 sideBreak 하나 · 그 뒤 sideBreakSec 동안 그 편의 대가 모두 달아나고(armyTick) 나서 끝난다
  for (const side of [0, 1] as const) {
    if (downs[side] === 0 || s.breakTick[side] >= 0) continue
    s.breakTick[side] = s.tick; s.breakWhy[side] = downs[side]
    const c = sideCenter(s, side)
    emit(s, { kind: 'sideBreak', side, id: -1, u: c.u, v: c.v, n: downs[side] })
  }
  const b0 = s.breakTick[0], b1 = s.breakTick[1]
  if (b0 < 0 && b1 < 0) return
  const first = b0 < 0 ? b1 : b1 < 0 ? b0 : Math.min(b0, b1)
  if (s.tick - first < ticksOf(P.field.sideBreakSec)) return
  // 먼저 무너진 편이 진다 · 끝 까닭은 편 차례에 안 기댄다 — 먼저 무너진 어느 편이든 사기로 무너졌으면 사기
  const lose: [boolean, boolean] = [b0 === first, b1 === first]
  s.end = (lose[0] && s.breakWhy[0] === 2) || (lose[1] && s.breakWhy[1] === 2) ? 'morale' : 'men'
  if (lose[0] !== lose[1]) { s.winner = lose[0] ? 1 : 0; return }
  // 둘 다 같은 틱에 무너졌으면 체력 합 → 사람 × 사기 → 그래도 같으면 비김 (굴림으로 가르면 쏠림은 없어도 동전 던지기가 된다)
  const hpOf = (side: number): number => s.squads.reduce((a, q) => a + (q.side === side ? q.hp : 0), 0)
  const pw = (t: { men: number; morale: number }): number => t.men * t.morale
  const byHp = hpOf(0) - hpOf(1), byPw = pw(tot[0]!) - pw(tot[1]!)
  s.winner = byHp !== 0 ? (byHp > 0 ? 0 : 1) : byPw !== 0 ? (byPw > 0 ? 0 : 1) : -1
}

/** 편의 산 대 가운데 (없으면 진영 자리 · u 는 편마다 반대로 반올림) */
function sideCenter(s: FieldState, side: 0 | 1): Point {
  let su = 0, sv = 0, n = 0
  for (const q of s.squads) if (q.side === side && q.men > 0) { su += q.u; sv += q.v; n++ }
  return n > 0 ? { u: avgU(su, n, side), v: idiv(sv, n) } : { u: campU(s, side), v: campV(s, side) }
}

/** 때를 다 썼을 때 — 남은 세기(사람 × 사기)의 몫이 tacWinShare 위인 쪽이 이긴다 (아래쪽은 1 - 이것) · 그 사이는 비김 */
function judgeTime(s: FieldState): void {
  const p = [0, 1].map(side => { const t = sideTotals(s, side as 0 | 1); return t.men * t.morale })
  const all = p[0]! + p[1]!
  s.winner = all <= 0 ? -1 : p[0]! * MILLI > all * m(P.realm.tacWinShare) ? 0 : p[1]! * MILLI > all * m(P.realm.tacWinShare) ? 1 : -1
}

/** 편의 행군 걸음 (단위/초) — 산 대 가운데 가장 느린 무리의 걸음 (칼날이 닿기 전에는 맡긴 대가 이 걸음으로 같이 간다 · 44 §2-5) */
function marchSpeed(s: FieldState, side: 0 | 1): number {
  let sp = Infinity
  for (const q of s.squads) if (q.side === side && q.men > 0) sp = Math.min(sp, speedPerSec(q.grp))
  return sp
}

export function stepField(s: FieldState, inputs: readonly FieldInput[] = NO_INPUTS): void {
  if (s.end !== null) return
  pruneEvents(s)
  // 한 틱에 받는 입력은 inputPerTickMax 까지 (도배 방지 · 눈에 안 보이는 하나뿐) — 받은 것만 세므로 기록 재생도 같은 것을 받는다
  const took = s.log.accepted.length
  for (const i of inputs) {
    if (i.tick !== s.tick) continue
    if (i.op !== OP_RETREAT && s.log.accepted.length - took >= P.field.inputPerTickMax) { s.log.dropped++; continue }
    applyInput(s, i)
    if (s.end !== null) return
  }
  const retick = s.tick % Math.max(1, idiv(P.field.retargetMs * P.field.hz, MILLI)) === 0
  armyTick(s, retick || s.log.accepted.length > took)
  if (retick) retarget(s)
  shoves(s)
  const K = kit()
  const contact = fight(s, K)
  const bank = banks(s)
  const march = [marchSpeed(s, 0), marchSpeed(s, 1)]
  // 걸음은 모두 같은 틱 처음 자리에서 정하고 한꺼번에 옮긴다 (id 차례로 옮기면 먼저 도는 편이 뒤 편의 멈춤 판단을 바꿔 쏠린다)
  const run = new Array<boolean>(s.squads.length).fill(false)
  const moves: Array<Point | null> = s.squads.map(q => {
    if (!q.goal || q.men <= 0 || q.sleep > 0) return null
    if (q.lock >= 0 && q.manual === 0) return null
    if (q.manual === 0 && q.target >= 0) {
      const e = s.squads[q.target]!
      if ((q.grp === 'bows' ? dist2(q.u, q.v, e.u, e.v) <= q.reach * q.reach : touching(q, e)) && (q.grp === 'bows' || bladeLine(s.map, q, e))) return null
    }
    // 같이 닿기 — 맡긴 대는 제 편 칼날이 닿기 전까지 가장 느린 무리 걸음으로 간다 (기병 혼자 먼저 닿지 않게 · 「적을 쳐라」를 받은 대는 제 걸음)
    // 장수를 따르는 편은 진 자리로 제 걸음 · 돌격·옆치기 들이침은 달리고 무너진 대는 도망친다 (army.ts runMul)
    const fol = follows(s, q.side)
    const base = q.manual === 0 && q.foe < 0 && !fol && !contact[q.side] ? Math.min(speedPerSec(q.grp), march[q.side]!) : speedPerSec(q.grp)
    const rm = fol ? runMul(s, q) : MILLI
    run[q.id] = rm > MILLI
    const p = walk(s, K, q.side, q.u, q.v, q.goal, perTickAt(mul(base, rm), s.tick))
    // 몸 — 적 몸 앞 가장자리에서 멈추고 우리 몸과는 겹치지 않게 (틱 처음 자리 기준 · 차례에 안 기댄다)
    return bodyStep(s, q, p)
  })
  for (const q of s.squads) {
    const p = moves[q.id]
    if (p && holdOk(s, q, p.u, p.v, bank)) {
      // 도움닫기 — 달리는 동안 간 거리 (부딪히면 fight 가 0 으로)
      if (run[q.id]) { const d2 = dist2(q.u, q.v, p.u, p.v); q.ran += isqrt(d2) } else if (q.order !== ORD_CHARGE && q.order !== ORD_FLANK) q.ran = 0
      q.u = p.u; q.v = p.v
    }
  }
  unstack(s, bank)
  turnFaces(s)
  for (const q of s.squads) {
    if (q.sleep > 0) q.sleep--
    if (q.daze > 0) q.daze--
  }
  heroMove(s, K, side => sideAsleep(s, side))
  gritTick(s, side => sideMorale(s, side))
  s.tick++
  judge(s)
  if (s.end === null && s.tick >= P.field.timesMax * timeTicks()) { s.end = 'time'; judgeTime(s) }
}

/** 입력 열로 끝까지 돌린다 — 기록 재생과 헤드리스 시험이 쓰는 길 */
export function runField(setup: LiveSetup, inputs: readonly FieldInput[] = NO_INPUTS, maxTicks = Infinity): FieldState {
  const s = createField(setup)
  // 틱이 정수가 아닌 입력은 어느 틱에도 안 걸리므로 먼저 버리고 센다 (정렬을 망가뜨려 뒤 입력이 사라지지 않게 · 45 §2-19)
  const good = inputs.filter(x => Number.isInteger(x.tick))
  s.log.dropped += inputs.length - good.length
  // 같은 틱 입력은 받은 차례를 지킨다 (정렬이 안정적이지 않은 엔진에서도 같게 둘째 열쇠로 원래 차례)
  const byTick = good.map((x, k) => ({ x, k })).sort((a, b) => a.x.tick - b.x.tick || a.k - b.k).map(o => o.x)
  let k = 0
  while (s.end === null && s.tick < maxTicks) {
    let j = k
    while (j < byTick.length && byTick[j]!.tick === s.tick) j++
    stepField(s, k === j ? NO_INPUTS : byTick.slice(k, j))
    while (k < byTick.length && byTick[k]!.tick < s.tick) k++
  }
  return s
}

/** 무리의 산 대 가운데 (없으면 진영 자리) */
export function groupCenter(s: FieldState, side: 0 | 1, g: Grp): Point {
  let su = 0, sv = 0, n = 0
  for (const q of s.squads) if (q.side === side && q.grp === g && q.men > 0) { su += q.u; sv += q.v; n++ }
  return n > 0 ? { u: avgU(su, n, side), v: idiv(sv, n) } : { u: campU(s, side), v: campV(s, side) }
}


/**
 * 입력 없는 장수 (장수를 따르는 편) — 가장 가까운 적 대 쪽으로 가되 aiHeroHoldCells 앞에서 선다 (앞줄이 장수 앞에 서서 맞붙는다).
 * 적이 없으면 제자리.
 */
function aiHeroGoal(s: FieldState, h: Hero): Point | null {
  // 적 앞줄(없으면 산 적 전부)의 가운데 쪽으로 — 앞뒤(u)로 aiHeroHoldCells 앞에서 선다 (적 줄의 틈으로 파고들지 않게 대 하나가 아니라 가운데를 본다)
  const foes = s.squads.filter(q => q.side !== h.side && q.men > 0 && q.flee === 0)
  const fr = foes.filter(q => q.grp === 'front')
  const use = fr.length > 0 ? fr : foes
  if (use.length === 0 || !alarmed(s, h.side)) return null
  const cu = avgU(use.reduce((a, q) => a + q.u, 0), use.length, h.side), cv = idiv(use.reduce((a, q) => a + q.v, 0), use.length)
  const r = P.field.aiHeroHoldCells * P.field.unit, f = fwd(h.side)
  // 제 앞줄을 앞지르지 않는다 — 진 기준점(앞줄 가운데)보다 (followFrontCells − anchorSlackCells − 1) 칸 뒤까지만 (기준점이 그만큼 앞서 장수를 끌어간다)
  const F = s.anchor[h.side * 3]!
  const cap = F.u - f * P.field.unit * Math.max(0, P.field.followFrontCells - P.field.anchorSlackCells - 1)
  const u = (cu - f * r - cap) * f > 0 ? cap : cu - f * r
  return (u - h.u) * f > 0 ? { u, v: cv } : null
}

/** 앞줄 돌격 · 기병 옆치기 들이침인가 (도움닫기 덤을 받는 대) */
const runner = (s: FieldState, q: Squad): boolean => (q.grp === 'front' && q.order === ORD_CHARGE) || (q.grp === 'horse' && q.order === ORD_FLANK && q.target >= 0 && flankStep(s, q, s.squads[q.target]!).strike)

/**
 * 돌격의 쾅 (51 §8) — 도움닫기(chargeMinRunCells · flankMinRunCells)를 한 대가 겨눈 적의 맞붙는 거리에 들면 한 번:
 * 맞음 → 맞은 대가 pushFrontCells · pushHorseCells 밀려나고 친 대에 덤(chargeBonusSec) · impact how 1 /
 * 기병이 방진에 막힘 → 친 대가 bounceCells 튕겨 나고 사기 blockedShock · impact how 2. 돌려주는 값: 이 틱에 쾅을 적은 대.
 */
function runImpacts(s: FieldState): boolean[] {
  const out = new Array<boolean>(s.squads.length).fill(false)
  // 밀어내기는 모두 정한 뒤 한꺼번에 (판 차례에 안 기댄다 — 미는 대·친 대의 시작 자리 차례로)
  const shoves: Array<{ mover: Squad; from: Point; len: number; by: Squad }> = []
  const bank = banks(s)
  for (const q of s.squads) {
    if (q.men <= 0 || q.flee === 1 || !runner(s, q) || q.target < 0) continue
    const e = s.squads[q.target]!
    if (e.men <= 0 || !touching(q, e) || !bladeLine(s.map, q, e)) continue
    const min = (q.grp === 'front' ? P.field.chargeMinRunCells : P.field.flankMinRunCells) * P.field.unit
    if (q.ran < min) { q.ran = 0; continue }
    q.ran = 0
    out[q.id] = true
    // 방진이거나 긴 창이면 기병 들이침이 막힌다 (긴 창은 방진이 아니어도 · C2 병종)
    const blocked = q.grp === 'horse' && e.grp === 'front' && (e.stance === STANCE_HOLD || e.kind === 'pike')
    const mover = blocked ? q : e
    const away = blocked ? e : q
    const push = (blocked ? P.field.bounceCells : q.grp === 'horse' ? P.field.pushHorseCells : P.field.pushFrontCells) * P.field.unit
    shoves.push({ mover, from: { u: away.u, v: away.v }, len: push, by: q })
    if (blocked) addShock(s, q, P.field.blockedShock, 'melee')
    else { q.bonus = ticksOf(P.field.chargeBonusSec); addShock(s, e, q.grp === 'horse' ? P.field.flankHitShock : s.lineup[q.side] === LINE_WEDGE ? mul(P.field.chargeHitShock, P.field.lineWedgeShockPermille) : P.field.chargeHitShock, q.grp === 'horse' ? 'flank' : 'melee') }
    emit(s, { kind: 'impact', side: q.side, id: q.id, u: idiv(q.u + e.u, 2), v: idiv(q.v + e.v, 2), n: q.men + e.men, to: e.id, how: blocked ? HIT_BLOCKED : HIT_GOOD })
  }
  // 다른 대를 미는 것끼리는 서로 안 걸린다 — 같은 대를 여럿이 밀 때만 친 대의 시작 자리 차례 (같은 편끼리라 거울·차례에 안 기댄다)
  shoves.sort((a, b) => a.mover === b.mover ? rankCmp(s, a.by, b.by) : a.mover.id - b.mover.id)
  for (const x of shoves) shove(s, x.mover, x.from, x.len, bank)
  return out
}

/** mover 를 from 에서 멀어지는 쪽으로 len 만큼 민다 (막힘 칸·물가·지키는 한계는 지금 걸음 규칙 그대로 · 걸음을 나눠 찍는다) */
export function shove(s: FieldState, mover: Squad, from: Point, len: number, bank: readonly [number | null, number | null]): void {
  let du = mover.u - from.u, dv = mover.v - from.v
  if (du === 0 && dv === 0) du = -fwd(mover.side)
  const d2 = du * du + dv * dv, root = isqrt(d2), l = root * root === d2 ? root : root + 1
  // 밀림은 shoveTicks 틱에 나눠 옮긴다 (shoveStep · 3차) — 여기서는 남은 몫만 쌓는다
  mover.shoveU += idiv(du * len, Math.max(1, l)); mover.shoveV += idiv(dv * len, Math.max(1, l))
  mover.shoveN = Math.max(1, P.field.shoveTicks)
  if (P.field.shoveTicks <= 1) shoveStep(s, mover, bank)
}

/** 밀림 한 틱 몫 — 남은 거리를 남은 틱으로 나눠 대 모양째 옮긴다 (막힘 칸·물가·지키는 한계면 남은 몫을 버린다) */
function shoveStep(s: FieldState, q: Squad, bank: readonly [number | null, number | null]): void {
  if (q.shoveN <= 0) return
  const du = idiv(q.shoveU, q.shoveN), dv = idiv(q.shoveV, q.shoveN)
  q.shoveU -= du; q.shoveV -= dv; q.shoveN--
  const p = { u: clamp(q.u + du, 0, lastU(s.map)), v: clamp(q.v + dv, 0, lastV(s.map)) }
  if (!walkable(groundAt(s.map, p.u, p.v)) || !holdOk(s, q, p.u, p.v, bank)) { q.shoveU = 0; q.shoveV = 0; q.shoveN = 0; return }
  q.u = p.u; q.v = p.v
  if (q.shoveN === 0) { q.shoveU = 0; q.shoveV = 0 }
}

/** 이번 틱의 밀림 (fight 앞 · 틱마다 · 대마다 제 몫만 옮겨 차례에 안 기댄다) */
function shoves(s: FieldState): void {
  if (!s.squads.some(q => q.shoveN > 0)) return
  const bank = banks(s)
  for (const q of s.squads) if (q.shoveN > 0) shoveStep(s, q, bank)
}

/**
 * 맞은 뒤 (피해를 깎은 다음) — 돌격 덤 세기 · 옆치기가 먹힘(무리마다 한 번 · 통계) · 전선 밀림(맞물린 앞줄 가운데 더 깎인 쪽이 frontPushPerSec 로 밀린다).
 */
function afterHits(s: FieldState, K: Kit, aim: readonly number[]): void {
  for (const q of s.squads) if (q.bonus > 0) q.bonus--
  for (const q of s.squads) {
    if (q.men <= 0 || q.grp !== 'horse' || q.order !== ORD_FLANK || q.hitTick >= 0 || aim[q.id]! < 0) continue
    const e = s.squads[aim[q.id]!]!
    // 겨눈 대의 무리(찍은 적 무리)를 옆·뒤에서 친 것만 옆치기가 먹힌 것 (52 §1-1 · 가는 길에 스친 적 기병은 안 센다)
    if (hitArc(e, q) === 0 || q.target < 0 || e.grp !== s.squads[q.target]!.grp) continue
    const first = !s.squads.some(o => o.side === q.side && o.grp === 'horse' && o.hitTick >= 0)
    q.hitTick = s.tick
    if (!first) continue
    s.stats.flankHits[q.side]++
    emit(s, { kind: 'flankHit', side: q.side, id: q.id, u: e.u, v: e.v, n: q.men, to: e.id })
  }
  // 밀기 (52 §1-4) — 맞물린 앞줄 둘 가운데 약한 쪽이 pushCellsPerSec × (강 − 약)/(강 + 약) 로 밀린다 · pushShockCells 밀릴 때마다 사기 pushShock
  const bank = banks(s)
  const power = (q: Squad): number => mul(q.men * MILLI, K.grp[q.grp])
  const pushed: Array<Point | null> = s.squads.map(q => {
    if (q.men <= 0 || q.grp !== 'front' || q.lock < 0 || q.flee === 1) return null
    const e = s.squads[q.lock]!
    const a = power(q), b = power(e)
    if (e.grp !== 'front' || b <= a) return null
    const step = perTickAt(idiv(P.field.pushCellsPerSec * (b - a), a + b), s.tick)
    if (step <= 0) return null
    const p = { u: clamp(q.u - fwd(q.side) * step, 0, lastU(s.map)), v: q.v }
    return walkable(groundAt(s.map, p.u, p.v)) && holdOk(s, q, p.u, p.v, bank) ? p : null
  })
  const per = P.field.pushShockCells * P.field.unit
  for (const q of s.squads) {
    const p = pushed[q.id]
    if (!p) continue
    const before = idiv(q.pushed, per)
    q.pushed += Math.abs(p.u - q.u)
    if (idiv(q.pushed, per) > before) addShock(s, q, P.field.pushShock, 'push')
    q.u = p.u; q.v = p.v
  }
}

/** 도미노 (51 §7) — 도망치는 대 곁 routPanicCells 안의 우리 대는 1초에 routPanicPerSec 씩 사기를 잃는다 (곁의 기운이 덜어 준다 · calm) */
function panic(s: FieldState): void {
  const r2 = sq(P.field.routPanicCells * P.field.unit)
  const per = perTickAt(P.field.routPanicPerSec, s.tick)
  if (per <= 0) return
  const runs = s.squads.filter(f => f.flee === 1 && f.men > 0)
  if (runs.length === 0) return
  const hit = s.squads.map(q => q.men > 0 && q.flee === 0 && runs.some(f => f.side === q.side && dist2(f.u, f.v, q.u, q.v) <= r2))
  for (const q of s.squads) if (hit[q.id]) addShock(s, q, per, 'domino')
}

// ── 몸 (C2 묶음 3) — 대는 축에 맞춘 네모 (가운데 (u, v) · 폭 bw · 깊이 bd). 달아나는 대(flee)만 몸이 없다
/** 두 몸 사이 틈의 제곱 (겹치면 0) — a 를 (au, av) 에 둔 셈 */
export function boxGap2At(a: Squad, au: number, av: number, b: Squad): number {
  const du = Math.max(0, Math.abs(au - b.u) - idiv(a.bd + b.bd, 2)), dv = Math.max(0, Math.abs(av - b.v) - idiv(a.bw + b.bw, 2))
  return du * du + dv * dv
}
/** 두 몸이 겹친 넓이 (단위²) — a 를 (au, av) 에 둔 셈 */
export function overlapAt(a: Squad, au: number, av: number, b: Squad): number {
  const ou = idiv(a.bd + b.bd, 2) - Math.abs(au - b.u), ov = idiv(a.bw + b.bw, 2) - Math.abs(av - b.v)
  return ou > 0 && ov > 0 ? ou * ov : 0
}
/** 맞닿음 — 두 몸 사이 틈이 touchPermille 칸 안 (맞붙어 친다) */
export const touching = (a: Squad, b: Squad): boolean => boxGap2At(a, a.u, a.v, b) <= sq(mul(P.field.unit, P.field.touchPermille))
/** 장수(점 + 반 크기 heroBoxPermille)와 대 몸 사이 틈의 제곱 */
export function heroGap2(h: Point, q: Squad): number {
  const r = mul(P.field.unit, P.field.heroBoxPermille)
  const du = Math.max(0, Math.abs(h.u - q.u) - idiv(q.bd, 2) - r), dv = Math.max(0, Math.abs(h.v - q.v) - idiv(q.bw, 2) - r)
  return du * du + dv * dv
}
const solid = (q: Squad): boolean => q.men > 0 && q.flee === 0

/**
 * 몸에 막히나 (틱 처음 자리 기준 · 차례에 안 기댄다) — 적 대 몸이나 적장 몸과 더 겹치는 걸음 (우리 대 몸은 부드러워 막지 않는다 · unstack 이 천천히 벌린다).
 * 달아나는 대는 막히지 않는다.
 */
function bodyBlocked(s: FieldState, q: Squad, p: Point): boolean {
  if (q.flee === 1) return false

  for (const e of s.squads) {
    if (e === q || !solid(e)) continue
    const now = overlapAt(q, q.u, q.v, e), then = overlapAt(q, p.u, p.v, e)
    if (then <= now) continue
    if (e.side !== q.side) return true
  }
  const r = mul(P.field.unit, P.field.heroBoxPermille)
  for (const h of s.heroes) {
    if (h.side === q.side) continue
    const inside = (u: number, v: number): boolean => Math.abs(u - h.u) < idiv(q.bd, 2) + r && Math.abs(v - h.v) < idiv(q.bw, 2) + r
    if (inside(p.u, p.v) && !inside(q.u, q.v)) return true
  }
  return false
}

/** 막히면 걸음을 줄여(¾ · ½ · ¼) 보고, 그래도 막히면 한 축으로 미끄러진다 — 맞닿은 가장자리에서 멈추고 옆 대를 돌아 들어간다 */
function bodyStep(s: FieldState, q: Squad, p: Point): Point | null {
  if (!bodyBlocked(s, q, p)) return p
  const du = p.u - q.u, dv = p.v - q.v
  for (const k of [3, 2, 1]) { const c = { u: q.u + idiv(du * k, 4), v: q.v + idiv(dv * k, 4) }; if ((c.u !== q.u || c.v !== q.v) && !bodyBlocked(s, q, c)) return c }
  for (const c of [{ u: p.u, v: q.v }, { u: q.u, v: p.v }]) if ((c.u !== q.u || c.v !== q.v) && walkable(groundAt(s.map, c.u, c.v)) && !bodyBlocked(s, q, c)) return c
  return null
}

/**
 * 겹친 몸 풀기 (걸음 뒤 · 한꺼번에 셈해 차례에 안 기댄다) — 적끼리는 앞뒤(u)로, 우리끼리는 덜 겹친 축으로 서로 반씩 민다.
 * bodyPushPasses 번 되풀이한다 (사슬로 겹친 대). 막힘 칸·물가·지키는 한계는 걸음 규칙 그대로 (못 가면 그 몫은 남는다).
 */
function unstack(s: FieldState, bank: readonly [number | null, number | null]): void {
  const n = s.squads.length
  const soft = Math.max(1, idiv(perTickAt(P.field.allyPushCellsPerSec * P.field.unit, s.tick), 2))
  for (let pass = 0; pass < P.field.bodyPushPasses; pass++) {
    const du = new Array<number>(n).fill(0), dv = new Array<number>(n).fill(0)
    let any = false
    for (let i = 0; i < n; i++) {
      const a = s.squads[i]!
      if (!solid(a)) continue
      for (let j = i + 1; j < n; j++) {
        const b = s.squads[j]!
        if (!solid(b)) continue
        const ou = idiv(a.bd + b.bd, 2) - Math.abs(a.u - b.u), ov = idiv(a.bw + b.bw, 2) - Math.abs(a.v - b.v)
        if (ou <= 0 || ov <= 0) continue
        any = true
        // 적끼리는 앞뒤로 · 우리끼리는 덜 겹친 축으로 · 같은 자리면 시작 자리 차례로 방향을 정한다
        const alongU = a.side !== b.side || ou < ov
        const sgn = alongU ? (a.u !== b.u ? (a.u < b.u ? -1 : 1) : a.side !== b.side ? -fwd(a.side) : (rankCmp(s, a, b) < 0 ? -1 : 1) * fwd(a.side))
          : (a.v !== b.v ? (a.v < b.v ? -1 : 1) : rankCmp(s, a, b) < 0 ? -1 : 1)
        // 적끼리는 겹친 만큼 반씩 (딱딱하다) · 우리끼리는 1초에 allyPushCellsPerSec 까지 (부드럽다 · 움직이는 동안 겹쳐도 된다 · 52 §1-1)
        const half = a.side !== b.side ? idiv((alongU ? ou : ov) + 1, 2) : Math.min(idiv((alongU ? ou : ov) + 1, 2), soft)
        if (alongU) { du[i]! += sgn * half; du[j]! -= sgn * half } else { dv[i]! += sgn * half; dv[j]! -= sgn * half }
      }
    }
    if (!any) return
    // 새 자리는 모두 정한 뒤 한꺼번에 — 우리끼리 벌어지느라 적 몸에 더 파고드는 몫은 버린다 (틱 처음 자리 기준)
    const to = s.squads.map(q => {
      const x = clamp(q.u + du[q.id]!, 0, lastU(s.map)), y = clamp(q.v + dv[q.id]!, 0, lastV(s.map))
      if (x === q.u && y === q.v) return null
      if (!walkable(groundAt(s.map, x, y)) || !holdOk(s, q, x, y, bank) || bodyBlocked(s, q, { u: x, v: y })) return null
      return { u: x, v: y }
    })
    for (const q of s.squads) { const p = to[q.id]; if (p) { q.u = p.u; q.v = p.v } }
  }
}

/** 칼날 겨눔 상한 — 적 대마다 따로 가른다 (판 차례에 안 기댄다) */
function capMelee(s: FieldState, aim: number[]): void {
  const by = new Map<number, Squad[]>()
  for (const q of s.squads) {
    if (q.men <= 0 || q.grp === 'bows' || aim[q.id]! < 0) continue
    const t = aim[q.id]!
    const l = by.get(t)
    if (l) l.push(q); else by.set(t, [q])
  }
  for (const [t, qs] of by) {
    if (qs.length <= P.field.foeCapPerSquad) continue
    const e = s.squads[t]!
    qs.sort((a, b) => (b.lock === t ? 1 : 0) - (a.lock === t ? 1 : 0) || boxGap2At(a, a.u, a.v, e) - boxGap2At(b, b.u, b.v, e) || rankCmp(s, a, b))
    for (const q of qs.slice(P.field.foeCapPerSquad)) aim[q.id] = -1
  }
}

/** 친 대 q 가 맞는 대 e 의 어디에 있나 — 0 앞(보는 쪽 ±45°) · 2 뒤(반대쪽 ±45°) · 1 옆 (정수 내적 · 삼각함수 없음) */
export function hitArc(e: Squad, q: Point): number {
  const du = q.u - e.u, dv = q.v - e.v
  const d2 = du * du + dv * dv
  if (d2 === 0) return 0
  const fd = HERO_DIR[e.face]!
  const dot = fd[0] * du + fd[1] * dv
  const root = isqrt(d2), len = root * root === d2 ? root : root + 1
  const c45 = HERO_DIR[2]![0]
  return dot >= c45 * len ? 0 : dot <= -c45 * len ? 2 : 1
}

/**
 * 향 돌리기 (52 §1-1) — 겨눈(친) 적 → 가는 목표 → 편의 앞 쪽으로, 보병·활은 turnFrontTicks · 기병은 turnHorseTicks 마다 한 눈금.
 * 정면으로 맞물린 대(맞물린 적이 앞 90° 안)는 돌지 못한다 · 달아나는 대는 달아나는 쪽을 본다.
 */
function turnFaces(s: FieldState): void {
  for (const q of s.squads) {
    if (q.men <= 0) continue
    // 틱 수는 10Hz 기준 — hz 가 바뀌어도 1초에 도는 각이 같게 (20Hz 에서 두 배로 돌아 판 길이가 갈렸다 · 2차)
    const every = idiv((q.grp === 'horse' ? P.field.turnHorseTicks : P.field.turnFrontTicks) * P.field.hz, 10)
    if (s.tick % Math.max(1, every) !== 0) continue
    if (q.lock >= 0 && q.flee === 0 && hitArc(q, s.squads[q.lock]!) === 0) continue
    // 칼날로 맞닿은 적이 있을 때만 그쪽으로 돈다 (활이 멀리서 쏘는 적이나 다가오는 기병 쪽으로 미리 돌면 옆치기가 서지 않는다 · 진의 향은 적 쪽)
    const t = q.aim >= 0 && touching(q, s.squads[q.aim]!) ? s.squads[q.aim]! : null
    const want = t ? nearestDir(t.u - q.u, t.v - q.v)
      : q.goal && dist2(q.u, q.v, q.goal.u, q.goal.v) > sq(P.field.unit) ? nearestDir(q.goal.u - q.u, q.goal.v - q.v)
      : fwd(q.side) > 0 ? 0 : HERO_DIRS / 2
    if (want < 0 || want === q.face) continue
    const cw = (want - q.face + HERO_DIRS) % HERO_DIRS
    // 꼭 반대쪽이면 편 0 은 +v 쪽 · 편 1 은 −v 쪽으로 돈다 (거울 판이 정확히 뒤집히게)
    const up = cw < HERO_DIRS / 2 || (cw === HERO_DIRS / 2 && q.side === 0)
    q.face = (q.face + (up ? 1 : HERO_DIRS - 1)) % HERO_DIRS
  }
}

/**
 * u 의 평균 (양수 합) — 편 0 은 내림 · 편 1 은 올림. 거울(u → L−1−u · 편 바꿈)에서 내림의 짝은 올림이라,
 * 편마다 같은 쪽으로 내리면 가운데가 1 단위 어긋나 문턱(도는 길의 점 닿음 등)이 갈린다 (C2 · 거울 시험)
 */
export const avgU = (sum: number, n: number, side: 0 | 1): number => side === 0 ? idiv(sum, n) : idiv(sum + n - 1, n)

/** 무리 안의 줄 자리 차례 — 가운데부터 (n = 4 면 1 · 2 · 0 · 3) */
const centerOut = (n: number): number[] => Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(2 * a - (n - 1)) - Math.abs(2 * b - (n - 1)) || a - b)

/**
 * 무리의 대 n 개를 병종으로 가른다 (C2 병종 묶음) — 병종별 사람 수(LiveSide.kinds · 없거나 합이 안 맞으면 앞줄 방패·창 반반 · 활 4분의 3 활 · 4분의 1 쇠뇌).
 * 몫이 8분의 1 을 넘는 병종은 대 하나 이상 · 그 아래 병종의 사람은 가장 큰 병종에 붙인다.
 * 줄 자리: 앞줄은 방패가 가운데 · 창이 그 옆 · 긴 창이 끝 / 활 줄은 활이 가운데 · 쇠뇌가 끝 (돌려주는 배열의 차례 = 시작 줄의 차례).
 */
export function groupKinds(ls: LiveSetup['sides'][number], grp: Grp, n: number, line: number = LINE_WINGS): Array<{ kind: UnitKind; men: number }> {
  const men = ls.men[grp]
  if (n <= 0) return []
  // 병종이 없으면 진이 앞줄을 정한다 (52 §6-1) — 방패 벽 = 방패 4분의 3(가운데) · 창 쐐기 = 창 4분의 3(가운데) · 넓은 날개 = 반반
  const wedge = grp === 'front' && line === LINE_WEDGE && ls.kinds === undefined
  const order: UnitKind[] = grp === 'front' ? (wedge ? ['spear', 'shield', 'pike'] : ['shield', 'spear', 'pike']) : grp === 'bows' ? ['bow', 'crossbow'] : ['horse']
  let want = order.map(k => Math.max(0, ls.kinds?.[k] ?? 0))
  if (want.reduce((a, b) => a + b, 0) !== men) {
    const big = ls.kinds === undefined && line !== LINE_WINGS ? men - idiv(men, 4) : idiv(men, 2)
    want = grp === 'front' ? [big, men - big, 0] : grp === 'bows' ? [men - idiv(men, 4), idiv(men, 4)] : [men]
  }
  // 8분의 1 아래 병종은 가장 큰 병종에 붙인다
  const big = want.indexOf(Math.max(...want))
  for (let k = 0; k < want.length; k++) if (k !== big && want[k]! > 0 && want[k]! * 8 <= men) { want[big]! += want[k]!; want[k] = 0 }
  // 대 수 — 몫대로 (내림 뒤 남는 대는 나머지가 큰 차례 · 사람이 있는 병종은 하나 이상)
  const cnt = want.map(w => w > 0 ? Math.max(1, idiv(w * n, men)) : 0)
  let sum = cnt.reduce((a, b) => a + b, 0)
  const byRem = want.map((_w, k) => k).sort((a, b) => ((want[b]! * n) % men) - ((want[a]! * n) % men) || a - b)
  for (let j = 0; sum < n; j++) { const k = byRem[j % byRem.length]!; if (want[k]! > 0) { cnt[k]!++; sum++ } }
  for (let j = 0; sum > n; j++) { const k = cnt.indexOf(Math.max(...cnt)); cnt[k]!--; sum-- }
  // 가운데부터 앞 병종 차례로 채운다
  const slots = centerOut(n)
  const out = new Array<{ kind: UnitKind; men: number }>(n)
  let at = 0
  order.forEach((kind, k) => {
    const c = cnt[k]!
    for (let j = 0; j < c; j++) out[slots[at++]!] = { kind, men: idiv(want[k]!, c) + (j < want[k]! % c ? 1 : 0) }
  })
  return out
}

/** 병종 상성 (KIND_BEATS = 본편 battle.ts BEATS) — a 가 b 를 이기나 */
export const beatsKind = (a: string, b: string): boolean => (KIND_BEATS[a as UnitKind] ?? []).includes(b as UnitKind)
/** a 가 b 를 칠 때의 배수 (‰) — 이기면 counterUp · 지면 counterDown · 아니면 1 */
function kindMul(K: Kit, a: string, b: string): number {
  return beatsKind(a, b) ? K.kindUp : beatsKind(b, a) ? K.kindDown : MILLI
}

/** 상성에 진 첫 맞물림·첫 화살 — 대마다 판에 한 번 사기 kindFirstShock (51 §3 · 읽히는 상성) */
function counterShock(s: FieldState, e: Squad, cause: 'melee' | 'arrows'): void {
  if (e.countered === 1 || e.men <= 0 || P.field.kindFirstShock <= 0) return
  e.countered = 1
  addShock(s, e, P.field.kindFirstShock, cause)
}
