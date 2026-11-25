/**
 * 전장 sim — 정수 격자 · 고정 걸음 (docs/realm/battle-study/40-cards.md F1a)
 *
 * F1a 는 **이동 뼈대**: 매 틱 대가 목표로 걷고, 임시 AI 는 재목표 틱마다 가장 가까운 적 대를 목표로 고른다.
 * 부딪혀 피해·사기·끝(사기·사람)은 F1b 가 얹는다. 여기서 끝나는 것은 시간(time)과 무효(invalid)뿐이다.
 * 난수는 roll(seed, tick, 이름) 만. DOM·시계·삼각함수 없음 (tests/field/purity.test.ts 가 글자로 센다).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { clamp, dist2, idiv, stepToward } from './num.ts'
import { GRPS, OP_AUTO, OP_MOVE } from './types.ts'
import type { FieldInput, FieldState, Grp, Hero, LiveSetup } from './types.ts'

const NO_INPUTS: readonly FieldInput[] = []
const ROW: Readonly<Record<Grp, number>> = { front: 0, bows: 1, horse: 2 }

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

function invalidSetup(s: LiveSetup): boolean {
  if (!Number.isInteger(s.seed) || s.map.u < 2 || s.map.w < 1) return true
  let bodies = 0
  for (const side of s.sides) {
    let total = 0
    for (const g of GRPS) {
      const m = side.men[g]
      if (!Number.isInteger(m) || m < 0) return true
      total += m
      bodies += squadCount(m)
    }
    if (total === 0) return true
    if (side.hero) bodies++
  }
  return bodies > P.field.bodiesMax
}

export function createField(setup: LiveSetup): FieldState {
  const s: FieldState = { tick: 0, seed: setup.seed, map: setup.map, squads: [], heroes: [], used: [0, 0, 0, 0], end: null, log: { dropped: 0, accepted: [] } }
  if (invalidSetup(setup)) { s.end = 'invalid'; return s }
  const unit = P.field.unit
  const jit = P.field.spawnJitterCells * unit
  for (const side of [0, 1] as const) {
    const ls = setup.sides[side]
    GRPS.forEach(grp => {
      const men = ls.men[grp], n = squadCount(men)
      const fresh = Math.min(men, Math.max(0, ls.fresh?.[grp] ?? 0))
      const row = (P.field.startMarginCells - ROW[grp] * P.field.rowGapCells) * unit
      const u = side === 0 ? Math.max(0, row) : Math.min(setup.map.u * unit, setup.map.u * unit - row)
      for (let i = 0; i < n; i++) {
        const id = s.squads.length
        const m = idiv(men, n) + (i < men % n ? 1 : 0)
        const j = jit > 0 ? Math.floor(roll(s.seed, 0, `spawn:${id}`) * (2 * jit + 1)) - jit : 0
        const v = clamp(idiv(setup.map.w * unit * (2 * i + 1), 2 * n) + j, 0, setup.map.w * unit)
        s.squads.push({ id, side, grp, kind: grp, men: m, menMax: m, fresh: men > 0 ? idiv(fresh * m, men) : 0, u, v, goal: null, manual: 0, target: -1, hp: m, morale: ls.morale })
      }
    })
    if (ls.hero) {
      const row = P.field.startMarginCells * unit
      const hero: Hero = { side, id: ls.hero.id, u: side === 0 ? row : setup.map.u * unit - row, v: idiv(setup.map.w * unit, 2), goal: null, grp: -1, stun: 0, hp: P.field.heroHp }
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
  if (i.op === OP_MOVE ? !inMap : i.op !== OP_AUTO) { s.log.dropped++; return }
  s.used[i.g]++
  s.log.accepted.push({ tick: i.tick, g: i.g, op: i.op, u: i.u, v: i.v })
  const goal = i.op === OP_MOVE ? { u: i.u, v: i.v } : null
  if (i.g === 3) {
    const h = s.heroes.find(e => e.side === 0)
    if (h) h.goal = goal
    return
  }
  for (const q of s.squads) {
    if (q.side !== 0 || q.grp !== GRPS[i.g]) continue
    q.manual = i.op === OP_MOVE ? 1 : 0
    q.goal = goal ? { u: goal.u, v: goal.v } : null
    if (i.op === OP_MOVE) q.target = -1
  }
}

/** 임시 AI — 가장 가까운 적 대를 목표로 (동점은 id 가 작은 쪽). F6 의 정식 AI 가 대체한다 */
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
    q.goal = e ? { u: e.u, v: e.v } : null
  }
}

export function stepField(s: FieldState, inputs: readonly FieldInput[] = NO_INPUTS): void {
  if (s.end !== null) return
  if (s.tick % P.field.timeTicks === 0) s.used = [0, 0, 0, 0]
  for (const i of inputs) if (i.tick === s.tick) applyInput(s, i)
  if (s.tick % P.field.retargetEvery === 0) retarget(s)
  const gap2 = (P.field.contactGapCells * P.field.unit) ** 2
  for (const q of s.squads) {
    if (!q.goal || q.men <= 0) continue
    if (q.manual === 0 && q.target >= 0) {
      const e = s.squads[q.target]!
      if (dist2(q.u, q.v, e.u, e.v) <= gap2) continue
    }
    const p = stepToward(q.u, q.v, q.goal.u, q.goal.v, speedPerTick(q.grp))
    q.u = p.u; q.v = p.v
  }
  for (const h of s.heroes) {
    if (h.stun > 0) { h.stun--; continue }
    if (!h.goal) continue
    const p = stepToward(h.u, h.v, h.goal.u, h.goal.v, speedPerTick('front'))
    h.u = p.u; h.v = p.v
  }
  s.tick++
  if (s.tick >= P.field.timesMax * P.field.timeTicks) s.end = 'time'
}

/** 입력 열(틱 오름차순)로 끝까지 돌린다 — 기록 재생과 헤드리스 시험이 쓰는 길 */
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
