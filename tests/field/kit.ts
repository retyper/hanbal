/**
 * 전장 sim 시험 도우미 — 대를 지우기 · 자리 잡기 · 정수 검사 · 거울 · 차례 섞기를 한 곳에 모은다 (45 §1-5 · §4).
 * 시험 파일이 아니다 (이름이 .test.ts 가 아니라 node --test 가 따로 돌리지 않는다).
 */
import assert from 'node:assert/strict'
import { stepField } from '../../src/field/sim.ts'
import { ambushMap, crossMap, highMap, holdMap, meetMap, stakeMap } from '../../src/field/map.ts'
import { P } from '../../src/tune/params.ts'
import type { FieldMap, FieldState, Grp, Squad } from '../../src/field/types.ts'
import { HERO_DIRS } from '../../src/field/types.ts'

export const U = (cells: number): number => cells * P.field.unit

export const MAPS: ReadonlyArray<readonly [string, () => FieldMap]> = [['meet', meetMap], ['hold', holdMap], ['cross', crossMap], ['stake', stakeMap], ['high', highMap], ['ambush', () => ambushMap(true)], ['ambushFail', () => ambushMap(false)]]

/** side 편 grp 무리의 i 번째 대 */
export const pick = (s: FieldState, side: 0 | 1, grp: Grp, i = 0): Squad => s.squads.filter(q => q.side === side && q.grp === grp)[i]!

/**
 * keep 에 든 대만 남기고 나머지는 **배열에서 뺀다** — 번호(id)를 0 부터 다시 매기고 lock·target 을 따라 옮긴다.
 * (사람 수를 0 으로 두는 옛 도우미는 menMax 0 으로 사기가 0/0 = NaN 이 됐다 · 45 §1-5)
 */
export function keepOnly(s: FieldState, keep: readonly Squad[]): void {
  const kept = s.squads.filter(q => keep.includes(q))
  const old = new Map(s.squads.map(q => [q.id, q]))
  const lk = kept.map(q => q.lock >= 0 ? old.get(q.lock)! : null), tg = kept.map(q => q.target >= 0 ? old.get(q.target)! : null)
  kept.forEach((q, i) => { q.id = i })
  kept.forEach((q, i) => {
    q.lock = lk[i] && kept.includes(lk[i]!) ? lk[i]!.id : -1
    q.target = tg[i] && kept.includes(tg[i]!) ? tg[i]!.id : -1
  })
  s.squads = kept
}

/** 대를 손으로 세운다 (u, v 는 칸 · 사람 수 · 손으로 몬 채 목표 없음 · 방진) */
export function place(q: Squad, u: number, v: number, men = 500): void {
  Object.assign(q, { u: U(u), v: U(v), men, menMax: men, hp: men * 1000, rem: 0, goal: null, manual: 1, stance: 1 })
}

/** 판의 모든 값이 정수이고 -0·NaN 이 없다 (모든 시험 판 끝에 부른다) */
export function assertInts(s: FieldState, label = ''): void {
  const ok = (n: number): boolean => Number.isSafeInteger(n) && !Object.is(n, -0) && Math.abs(n) < 2 ** 31
  for (const q of s.squads) {
    for (const n of [q.u, q.v, q.men, q.menMax, q.hp, q.morale, q.morale0, q.shock, q.flank, q.lock, q.target, q.sleep, q.daze, q.rem, q.held, q.homeU, q.homeV, q.fresh]) assert.ok(ok(n), `${label} 대 ${q.id}: ${n}`)
    if (q.goal) assert.ok(ok(q.goal.u) && ok(q.goal.v), `${label} 대 ${q.id} 목표`)
    assert.ok(q.men >= 0 && q.men <= q.menMax && q.hp >= 0 && q.morale >= 0 && q.morale <= 1000, `${label} 대 ${q.id} 범위`)
  }
  for (const e of s.heroes) for (const n of [e.u, e.v, e.hp, e.stun, e.rem]) assert.ok(ok(n), `${label} 장수 ${e.side}: ${n}`)
  for (const p of s.map.pieces) for (const n of [p.hp, p.rem ?? 0]) assert.ok(ok(n) && n >= 0, `${label} 조각 ${p.id}: ${n}`)
  for (const n of [s.tick, s.winner, ...s.used, ...s.broken]) assert.ok(ok(n), `${label} 판: ${n}`)
}

/** 끝까지 걷는다 · 사람 수가 틱마다 늘지 않는지 본다 · 끝에 정수 검사 */
export function finish(s: FieldState, label = ''): FieldState {
  const prev = s.squads.map(q => q.men)
  while (s.end === null) {
    stepField(s)
    s.squads.forEach((q, i) => { assert.ok(q.men <= prev[i]!, `${label} 대 ${q.id} 사람이 늘었다`); prev[i] = q.men })
  }
  assertInts(s, label)
  return s
}

/** ticks 틱 (끝나면 멈춤) */
export function run(s: FieldState, ticks: number): FieldState {
  for (let i = 0; i < ticks && s.end === null; i++) stepField(s)
  assertInts(s)
  return s
}

/**
 * 거울: u 를 L-1-u 로 (칸이 정확히 뒤집힌다) · 편 이름표를 바꾼다 (대·장수의 편 · 진영 차례 · 조각 주인 · 높은 터 주인 · broken).
 * 진영 경계 u 는 칸 수 - u (map.ts campPointU 규약) · face 는 축 0 진영만 뒤집는다 (축 1 진영의 face 는 v 쪽).
 */
export function mirror(s: FieldState): void {
  const mp = s.map, L = mp.u * P.field.unit
  const f = (u: number): number => L - 1 - u
  for (const q of s.squads) { q.side = (1 - q.side) as 0 | 1; q.face = (HERO_DIRS - q.face + HERO_DIRS / 2) % HERO_DIRS; q.u = f(q.u); q.homeU = f(q.homeU); if (q.goal) q.goal = { u: f(q.goal.u), v: q.goal.v } }
  for (const h of s.heroes) { h.side = (1 - h.side) as 0 | 1; h.u = f(h.u); if (h.goal) h.goal = { u: f(h.goal.u), v: h.goal.v } }
  const cells = new Uint8Array(mp.cells.length)
  for (let cu = 0; cu < mp.u; cu++) for (let cv = 0; cv < mp.w; cv++) cells[(mp.u - 1 - cu) * mp.w + cv] = mp.cells[cu * mp.w + cv]!
  const c = mp.camps.map(k => ({ ...k, u: mp.u - k.u, face: (k.axis === 0 ? -k.face : k.face) as 1 | -1 }))
  const m = mp as { cells: Uint8Array; camps: unknown; pieces: unknown; highOwner: number }
  m.cells = cells
  m.camps = [c[1], c[0]]
  m.pieces = mp.pieces.map(p => ({ ...p, u0: mp.u - p.u1, u1: mp.u - p.u0, owner: (1 - p.owner) as 0 | 1 }))
  m.highOwner = mp.highOwner < 0 ? -1 : 1 - mp.highOwner
  s.broken = [s.broken[1], s.broken[0]]
  // 편마다의 칸 (army.ts) — 편 차례를 바꾸고 u 를 뒤집는다
  const fp = (p: { u: number; v: number }) => ({ u: f(p.u), v: p.v })
  s.anchor = [...s.anchor.slice(3), ...s.anchor.slice(0, 3)].map(fp)
  s.route = [...s.route.slice(3), ...s.route.slice(0, 3)].map(r => r.map(fp))
  s.planTick = [s.planTick[1], s.planTick[0]]
  s.frontLockTick = [s.frontLockTick[1], s.frontLockTick[0]]
  for (const q of s.squads) if (q.orderAt) q.orderAt = fp(q.orderAt)
}

/** 배열 차례 바꾸기 — order(대들) 이 새 차례. id 는 새 자리 번호로, lock·target 은 따라 옮긴다 · 장수 배열도 뒤집는다 */
export function reorder(s: FieldState, order: (qs: Squad[]) => Squad[]): void {
  const sq = order([...s.squads])
  const old = new Map(s.squads.map(q => [q.id, q]))
  const lk = sq.map(q => q.lock >= 0 ? old.get(q.lock)! : null), tg = sq.map(q => q.target >= 0 ? old.get(q.target)! : null)
  sq.forEach((q, i) => { q.id = i })
  sq.forEach((q, i) => { q.lock = lk[i] ? lk[i]!.id : -1; q.target = tg[i] ? tg[i]!.id : -1 })
  s.squads = sq
  s.heroes = [...s.heroes].reverse()
}

/** 같은 편 안에서만 섞는다 (편 덩어리 차례는 그대로 · 씨앗으로 정한 섞기) */
export function shuffleWithinSides(seed: number): (qs: Squad[]) => Squad[] {
  return qs => {
    let x = (seed * 2654435761) >>> 0
    const rnd = (n: number): number => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x % n }
    const out: Squad[] = []
    for (const side of [0, 1]) {
      const part = qs.filter(q => q.side === side)
      for (let i = part.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = part[i]!; part[i] = part[j]!; part[j] = t }
      out.push(...part)
    }
    return out
  }
}


/** 처음 번호 이름표 — 대 객체에 붙여 둔다 (C2 병종 묶음부터 sim 이 kind 를 읽어 kind 칸에 적을 수 없다) */
const TAGS = new WeakMap<Squad, string>()
export const tag = (s: FieldState): void => { for (const q of s.squads) TAGS.set(q, `k${q.id}`) }
const tagOf = (q: Squad): string => TAGS.get(q) ?? `?${q.id}`
/** 대 상태의 글자 (id·lock·target 은 처음 번호로 바꿔 차례와 무관하게 견준다) */
export function squadKey(s: FieldState): string {
  const name = (id: number): string => id >= 0 ? tagOf(s.squads[id]!) : '-'
  return [...s.squads].sort((a, b) => tagOf(a) < tagOf(b) ? -1 : tagOf(a) > tagOf(b) ? 1 : 0)
    .map(q => [tagOf(q), q.kind, q.side, q.u, q.v, q.hp, q.morale, q.shock, q.flank, q.sleep, q.daze, q.rem, q.held, name(q.lock), name(q.target), q.goal ? `${q.goal.u},${q.goal.v}` : '-'].join(':')).join('|')
}
