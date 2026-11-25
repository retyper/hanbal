/**
 * 포인터 → 입력 줄 번역 (docs/realm/battle-study/40-cards.md F5a · 30 §4). 순수 함수 — 화면·DOM 을 모른다.
 * 깃발은 「자리를 찍지만 뜻은 방침」이다: 칸을 고르고 맵을 누르면 그 자리로 보내고,
 * 길게 누르면 그 자리에서 버팀(방진) · 적 쪽으로 끌면 돌격 · 옆으로 끌면 길 트기 · 뒤로 끌면 방진.
 * 끌기 방향은 정수 기울기 비교다 (삼각함수 없음 · 이 폴더 sim 쪽 규칙을 그대로 따른다).
 * 못 하는 것은 입력을 만들지 않고 까닭 이름(Why)만 돌려준다 — 말은 화면이 t() 로 붙인다.
 */
import { P } from '../tune/params.ts'
import { OP_AUTO, OP_MOVE, OP_STANCE, STANCE_CHARGE, STANCE_HOLD, STANCE_OPEN, type FieldInput, type InputGroup } from './types.ts'

export type Gesture = 'tap' | 'hold' | 'drag'
/** 번역된 뜻 — move 는 자리만 · 나머지는 자리 + 자세 */
export type Intent = 'move' | 'hold' | 'charge' | 'open' | 'auto'
/** 못 한 까닭 — redirect 는 같은 무리를 너무 빨리 다시 몬 것 · budget 은 이번 때 입력을 다 쓴 것 */
export type Why = 'budget' | 'redirect'
/** 한 일에 붙는 덧말 — noStance: 자세가 없는 무리라 자리로만 · stanceLater: 입력이 하나 남아 자리만 갔다 */
export type Note = 'noStance' | 'stanceLater'

/** 누른 시간과 움직인 거리(화면 px 의 제곱)로 몸짓을 고른다 */
export function gestureOf(moved2: number, heldMs: number): Gesture {
  const min = P.field.dragMinPx
  if (moved2 >= min * min) return 'drag'
  return heldMs >= P.field.holdMs ? 'hold' : 'tap'
}

/**
 * 끌어 놓은 방향 (판 좌표의 변화 du: 가로 · dv: 세로) 의 뜻. face 는 우리 편이 적 쪽으로 가는 u 방향(+1/-1).
 * 옆으로 더 기울면 길 트기 · 아니면 적 쪽이면 돌격 · 뒤쪽이면 방진.
 */
export function dragIntent(du: number, dv: number, face: 1 | -1): 'hold' | 'charge' | 'open' {
  const along = du * face
  if (Math.abs(dv) * P.field.dragOpenSlopeDen >= P.field.dragOpenSlopeNum * Math.abs(along)) return 'open'
  return along > 0 ? 'charge' : 'hold'
}

export interface InputCtx {
  /** 이 입력이 들어갈 틱 */
  tick: number
  face: 1 | -1
  /** 이번 때에 무리별로 이미 쓴 입력 수 */
  used: readonly [number, number, number, number]
  /** 무리별 마지막으로 몬 틱 · 없으면 -1 (시작 화면에서는 늘 -1) */
  lastMove: readonly [number, number, number, number]
  /** 앞줄의 지금 자세 · 활·기병·장수는 의미 없음 */
  frontStance: number
  mapUUnits: number
  mapVUnits: number
}

export interface Translated {
  /** 입력 줄에 더할 것 (못 했으면 빈 배열) */
  inputs: FieldInput[]
  g: InputGroup
  intent: Intent
  why: Why | null
  note: Note | null
}

const clampInt = (n: number, hi: number): number => Math.max(0, Math.min(hi, Math.round(n)))
const left = (ctx: InputCtx, g: InputGroup): number => P.field.inputPerGroupPerTime - ctx.used[g]
const none = (g: InputGroup, intent: Intent, why: Why): Translated => ({ inputs: [], g, intent, why, note: null })

/**
 * 맵 위의 몸짓 하나를 입력으로. (u, v) 는 누른 자리(sim 단위) · (du, dv) 는 끌기 변화(판 좌표 부호 그대로)
 * 한 번에 입력 하나(자리)나 둘(자리 + 자세)이 나가고, 이번 때 입력이 모자라면 자리만 보낸다.
 */
export function translateMap(g: InputGroup, gesture: Gesture, u: number, v: number, du: number, dv: number, ctx: InputCtx): Translated {
  const want: Intent = gesture === 'tap' ? 'move' : gesture === 'hold' ? 'hold' : dragIntent(du, dv, ctx.face)
  if (left(ctx, g) <= 0) return none(g, want, 'budget')
  const last = ctx.lastMove[g]
  if (last >= 0 && ctx.tick - last < P.field.redirectTicks) return none(g, want, 'redirect')
  const pu = clampInt(u, ctx.mapUUnits), pv = clampInt(v, ctx.mapVUnits)
  const out: FieldInput[] = [{ tick: ctx.tick, g, op: OP_MOVE, u: pu, v: pv }]
  if (want === 'move') return { inputs: out, g, intent: 'move', why: null, note: null }
  if (g !== 0) return { inputs: out, g, intent: 'move', why: null, note: 'noStance' }
  const st = want === 'charge' ? STANCE_CHARGE : want === 'open' ? STANCE_OPEN : STANCE_HOLD
  if (ctx.frontStance === st) return { inputs: out, g, intent: want, why: null, note: null }
  if (left(ctx, g) < 2) return { inputs: out, g, intent: 'move', why: null, note: 'stanceLater' }
  out.push({ tick: ctx.tick, g, op: OP_STANCE, u: st, v: 0 })
  return { inputs: out, g, intent: want, why: null, note: null }
}

/** 열린 상자에서 자세 하나를 고름 (자리는 그대로) */
export function translateStance(g: InputGroup, intent: 'hold' | 'charge' | 'open', ctx: InputCtx): Translated {
  if (g !== 0) return { inputs: [], g, intent, why: null, note: 'noStance' }
  if (left(ctx, g) <= 0) return none(g, intent, 'budget')
  const st = intent === 'charge' ? STANCE_CHARGE : intent === 'open' ? STANCE_OPEN : STANCE_HOLD
  return { inputs: [{ tick: ctx.tick, g, op: OP_STANCE, u: st, v: 0 }], g, intent, why: null, note: null }
}

/** 손을 떼고 임시 AI 에 맡김 */
export function translateAuto(g: InputGroup, ctx: InputCtx): Translated {
  if (left(ctx, g) <= 0) return none(g, 'auto', 'budget')
  return { inputs: [{ tick: ctx.tick, g, op: OP_AUTO, u: 0, v: 0 }], g, intent: 'auto', why: null, note: null }
}
