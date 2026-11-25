/**
 * 조종 장수 (C2 · docs/realm/battle-study/50-control-v2.md · 49-hero-plan.md §1·§2)
 *
 * 우리 장수(편 0)는 입력이 있으면 입력대로 — 방향(OP_HERO_DIR) · 찍은 자리(OP_MOVE) · 적을 쳐라(OP_ATTACK) · 내닫기 · 비기.
 * 입력이 한 번도 없던 장수와 적 장수는 임시 AI(sim.ts retarget · 제 편 맨 앞 앞줄 곁)를 따른다.
 * sim 쪽 파일이다: 난수·시계·DOM·삼각함수·** 없음 (tests/field/purity.test.ts).
 */
import { P } from '../tune/params.ts'
import { clamp } from './num.ts'
import { HERO_DIR, OP_ATTACK, OP_AUTO, OP_DASH, OP_HERO_DIR, OP_MOVE, OP_SKILL } from './types.ts'
import type { FieldInput, FieldState, Hero, Point } from './types.ts'

const lastU = (s: FieldState): number => s.map.u * P.field.unit - 1
const lastV = (s: FieldState): number => s.map.w * P.field.unit - 1

/** 우리 장수에게 온 입력 (g = 3) — 꼴은 sim.ts inputOk 가 이미 봤다 */
export function heroInput(s: FieldState, i: FieldInput): void {
  const h = s.heroes.find(e => e.side === 0)
  if (!h) return
  switch (i.op) {
    case OP_MOVE:
      h.manual = 1; h.dir = -1; h.foe = -1
      h.goal = { u: clamp(i.u, 0, lastU(s)), v: clamp(i.v, 0, lastV(s)) }
      return
    case OP_AUTO:
      h.manual = 0; h.dir = -1; h.foe = -1; h.goal = null
      return
    case OP_ATTACK:
      h.manual = 1; h.dir = -1; h.foe = i.u; h.goal = null
      return
    case OP_HERO_DIR:
      h.manual = 1; h.foe = -1; h.goal = null; h.dir = i.v === 1 ? i.u : -1
      return
    case OP_DASH:
    case OP_SKILL:
      // 걸음 1·2 가 채운다 (입력 계약만 먼저)
      return
  }
}

/** 이 틱에 장수가 걸어갈 곳 — 적을 쳐라 → 방향 → 찍은 자리(또는 임시 AI 가 정한 곳) */
export function heroGoal(s: FieldState, h: Hero): Point | null {
  if (h.foe >= 0) {
    const e = s.squads[h.foe]
    if (!e || e.men <= 0) { h.foe = -1; return h.goal }
    return { u: e.u, v: e.v }
  }
  if (h.dir >= 0) {
    // 걸음보다 넉넉히 먼 점 (판 안으로) — 걸음은 walk 가 1칸 이하로 나눠 찍는다
    const far = P.field.unit * 4
    const d = HERO_DIR[h.dir]!
    return { u: clamp(h.u + Math.trunc(d[0] * far / 1000), 0, lastU(s)), v: clamp(h.v + Math.trunc(d[1] * far / 1000), 0, lastV(s)) }
  }
  return h.goal
}
