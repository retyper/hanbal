/**
 * AI 가 한 판을 놓고 셈하는 동안의 기억 (2026-10-19 — 영남 판은 나라가 스물하나라 같은 셈을 수천 번 되풀이했다).
 *
 * aiOrders·decide 는 받은 판을 **바꾸지 않는다** — 그 판(그 객체)에 대한 나라의 힘·정보로 본 힘·앞서가는 나라는
 * 그동안 변하지 않으므로 한 번 셈해 두고 다시 쓴다. 다른 판(먼저 해 본 사본, advance 안에서 바뀌는 판)에는 기억이 없다 —
 * `memoFor(r)` 는 지금 기억하는 그 판일 때만 기억 칸을 준다. 결과는 기억이 없을 때와 같다 (판 지문으로 확인).
 */
import type { Realm } from './types.ts'

export interface Memo {
  readonly r: Realm
  readonly power: Map<string, number>
  readonly range: Map<string, [number, number]>
  readonly leader: Map<string, string | null>
  /** 나라마다 함께 치자고 약속한 고을 (diplomacy.pledgedNodes) */
  readonly pledged: Map<string, ReadonlySet<string>>
}

let active: Memo | null = null

/** 지금 기억하는 판이 이 판이면 기억 칸, 아니면 null */
export function memoFor(r: Realm): Memo | null {
  return active !== null && active.r === r ? active : null
}

/** 이 판을 기억하며 fn 을 돈다 — 이미 이 판을 기억 중이면 그대로 (겹쳐 불러도 된다) */
export function withMemo<T>(r: Realm, fn: () => T): T {
  if (active !== null && active.r === r) return fn()
  const prev = active
  active = { r, power: new Map(), range: new Map(), leader: new Map(), pledged: new Map() }
  try {
    return fn()
  } finally {
    active = prev
  }
}
