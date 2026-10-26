/**
 * 외교의 손 — 사신·공작은 보낼 사람만큼 (docs/realm/VICTORY.md §2-2, 형: "외교에서 할수있는 행동은 2개로 충분한가? …
 * 강한나라가 외교나공작 선택권이 많아지는것도 이상한데 … 외교관장수가 있어야 할까?").
 *
 *   한 계절의 사신 + 공작 수 = 군장의 사자(handsBase) + 쉬는 장수 수
 *   쉬는 장수 — 군대를 안 이끌고 · 고을도 안 맡고 · 포로·다침·나가 있음이 아닌 우리 장수 (군장은 빼고 — 군장의 몫은 사자다)
 *
 * 강한 나라가 더 많이 하는 것은 장수가 많아서다. 장수를 외교에 쓰면 그 계절 전선·고을이 빈다 — 저절로 견제된다.
 * 넘치는 명령은 주문 차례대로 버린다 (결정론). 이름 붙은 장수(함께 가는 장수·자객 장수)는 한 계절에 한 번만 — 두 번째부터는
 * 사신은 사자 몫으로 가고(장수를 떼어 낸다), 공작은 그대로 둔다(자객 장수의 옳고 그름은 plots 가 본다).
 */
import { P } from '../tune/params.ts'
import type { Order, Realm } from './types.ts'

/** 쉬는 장수 — id 순서 */
export function idleHeroes(r: Realm, faction: string): string[] {
  const leading = new Set(Object.values(r.armies).map((a) => a.hero).filter((h): h is string => h !== null))
  const ruler = r.factions[faction]?.ruler
  return Object.values(r.heroes)
    .filter((h) => h.faction === faction && h.status === 'free' && h.id !== ruler && !leading.has(h.id) && (h.post === null || h.post === undefined)
      && !(h.woundedUntil !== undefined && h.woundedUntil >= r.season) && !(h.awayUntil !== undefined && h.awayUntil >= r.season))
    .map((h) => h.id)
    .sort()
}

/** 이 나라가 이번 계절 보낼 수 있는 사람 수 */
export function handsOf(r: Realm, faction: string): number {
  return P.realm.handsBase + idleHeroes(r, faction).length
}

type HandOrder = Extract<Order, { kind: 'envoy' }> | Extract<Order, { kind: 'plot' }>
const usesHand = (o: Order): o is HandOrder => o.kind === 'envoy' || o.kind === 'plot'
const ownerOf = (o: HandOrder): string => (o.kind === 'envoy' ? o.from : o.faction)
/** 이름 붙은 사람 — 함께 가는 장수 · 자객 장수(암살·구출) */
const namedOf = (o: HandOrder): string | undefined => (o.kind === 'envoy' ? o.hero : o.op === 'assassin' || o.op === 'rescue' ? o.agent : undefined)

/** 사람을 쓰는 명령 수 — 나라마다 (화면: "보낼 사람 n/m") */
export function handsUsed(orders: readonly Order[], faction: string): number {
  return orders.filter((o) => usesHand(o) && ownerOf(o) === faction).length
}

/**
 * 보낼 사람을 넘는 사신·공작을 주문 차례대로 버린다. 사람을 안 쓰는 명령은 그대로 지나간다.
 * `r` 은 맡기기·이끌기를 다 적용한 판이어야 한다 (advance 의 1 다음) — 그래야 화면의 미리보기와 같다.
 */
export function limitHands(r: Realm, orders: readonly Order[]): Order[] {
  const cap = new Map<string, number>()
  const used = new Map<string, number>()
  const named = new Set<string>()
  const out: Order[] = []
  for (const o of orders) {
    if (!usesHand(o)) {
      out.push(o)
      continue
    }
    const f = ownerOf(o)
    if (!cap.has(f)) cap.set(f, handsOf(r, f))
    const n = used.get(f) ?? 0
    if (n >= cap.get(f)!) continue
    used.set(f, n + 1)
    const h = namedOf(o)
    if (h !== undefined && named.has(h) && o.kind === 'envoy') {
      // 같은 장수를 두 곳에 보낼 수는 없다 — 이 사신은 사자가 간다
      const { hero: _drop, ...rest } = o
      out.push(rest)
      continue
    }
    if (h !== undefined) named.add(h)
    out.push(o)
  }
  return out
}
