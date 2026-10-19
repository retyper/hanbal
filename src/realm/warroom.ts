/**
 * 전장 화면의 시험 돌림 (docs/realm/BATTLE.md §3) — 계절을 넘기기 전에 우리가 낄 싸움을 하나씩 직접 지휘한다.
 *
 * 판정은 언제나 advance 하나다. 화면은 같은 명령으로 advance 를 시험 삼아 돌려
 *   ① 우리가 낀 싸움 가운데 아직 안 끝낸 첫 판을 찾고 (안 본 판은 '*' 로 처음 라운드에서 멈춘다)
 *   ② 그 판의 라운드를 고른 데까지 보이고, 다음 라운드에 고를 것(pending)을 받는다.
 * 앞 싸움의 결과가 다음 싸움을 바꿀 수 있으니 고를 때마다 처음부터 다시 돌린다 (결정론 — 같은 명령이면 같은 판).
 * 다 고르면 그 명령들(tactics)로 진짜 advance 를 돌린다. 시험 돌림의 판은 버린다.
 */
import { ANY_BATTLE, advance } from './season.ts'
import type { Cmd, Order, Realm, ReportLine, RoundOrder, Tactic } from './types.ts'

export type BattleLine = Extract<ReportLine, { kind: 'battle' }>

/** 우리가 낀 싸움인가 */
export function ours(l: ReportLine, me: string): l is BattleLine {
  return l.kind === 'battle' && (l.atkFaction === me || l.defender === me)
}

export interface Rehearsal {
  /** 지금 고를 판 — 없으면 우리 싸움이 다 끝났다 */
  readonly line: BattleLine | null
  /** 시험 돌림의 뒤 판 (이름·장수 얼굴용 — 버린다) */
  readonly after: Realm
  /** 아직 안 끝낸 우리 싸움 수 (지금 판 포함) */
  readonly left: number
}

/**
 * 시험 돌림 — `done` 은 다 고른 판(열쇠 → 명령), `cur` 은 지금 고르는 판과 그 명령.
 * 돌려주는 line 은 `want` 판(다 고른 판의 결과 보기)이거나, `cur` 판(아직 고르는 중)이거나, 아직 안 본 우리 판의 첫째.
 */
export function rehearse(
  prev: Realm, orders: readonly Order[], done: Readonly<Record<string, Tactic>>, cur: { key: string; cmds: readonly (Cmd | RoundOrder)[] } | null, me: string, want?: string,
): Rehearsal {
  const tactics: Record<string, Tactic> = { ...done, [ANY_BATTLE]: { cmds: [], open: true } }
  if (cur !== null) tactics[cur.key] = { cmds: cur.cmds, open: true }
  const { next, report } = advance(prev, orders, {}, tactics)
  const open = report.lines.filter((l): l is BattleLine => ours(l, me) && l.key !== undefined && (l.key === cur?.key || done[l.key] === undefined))
  const line = want !== undefined
    ? (report.lines.find((l): l is BattleLine => ours(l, me) && l.key === want) ?? null)
    : (open[0] ?? null)
  return { line, after: next, left: open.length }
}

/** 이번 계절에 우리가 낄 싸움이 있나 — 없으면 전장 화면 없이 넘긴다 */
export function anyOurs(prev: Realm, orders: readonly Order[], me: string): boolean {
  return rehearse(prev, orders, {}, null, me).line !== null
}
