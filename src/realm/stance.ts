/**
 * 속셈 — 나라마다 왜 그렇게 움직이나 (형: "모든 국가들을 승리를 목적으로 행동하니까 · 좀 근거가 있게 움직여야해" — 2026-10-18)
 *
 * 모든 나라는 이기려고 한다 (도읍 셋). 그래서 사신과 청은 굴림만으로 나오지 않는다 — 먼저 **까닭**이 있어야 하고,
 * 까닭이 있을 때 언제 꺼낼지만 굴린다. 까닭은 화면에도 보인다 (prose WHY_LINE).
 *   화친을 청한다 — 밀린다 · 두 쪽에서 싸운다 · 굶주린다 · 앞서가는 나라를 막아야 한다 · (중립) 센 이웃이 두렵다
 *   동맹을 청한다 — 같은 적 · 앞서가는 나라 · 가까워졌다
 *   약조를 깬다   — 상대가 너무 커졌다 · 상대가 약해 보이고 달리 칠 데가 없다
 * 이기고 있는 싸움은 멈추지 않는다 — 땅을 앗고 있고 더 센 쪽은 화친을 청하지도 받지도 않는다 (envoyWinning).
 * 셈은 참값이다 (AI 의 머리). 다만 까닭이 쓰는 것은 대개 누구나 아는 것이다 — 전쟁, 땅의 주인, 앗긴 땅, 도읍.
 */
import { P } from '../tune/params.ts'
import { stockOf, upkeepOf } from './economy.ts'
import { favorOf, nationPower, pairKey, powerRange, relationOf } from './diplomacy.ts'
import { memoFor } from './memo.ts'
import type { Realm, Why } from './types.ts'

export interface Motive {
  readonly why: Why
  /** 까닭이 가리키는 나라 — 앞서가는 나라 · 같은 적 */
  readonly about?: string
}

const alive = (r: Realm, f: string): boolean => Object.values(r.nodes).some((n) => n.owner === f)

const live = (r: Realm): string[] => Object.keys(r.factions).filter((f) => alive(r, f)).sort()

/** `viewer` 가 보는 `f` 의 힘 — 제 힘은 알고, 남의 힘은 제 정보의 범위 가운데 (정보의 계약: 참 군세를 몰래 읽지 않는다) */
function seen(r: Realm, viewer: string, f: string): number {
  if (viewer === f) return nationPower(r, f)
  const [lo, hi] = powerRange(r, viewer, f)
  return (lo + hi) / 2
}

/** 이 나라가 쥔 도읍의 수 (제 도읍을 넣어) — 이기는 조건과 같은 잣대 */
export function capitalsHeld(r: Realm, f: string): number {
  let n = 0
  for (const x of Object.values(r.factions)) if (r.nodes[x.capital]?.owner === f) n++
  return n
}

/**
 * 앞서가는 나라 — 도읍을 leaderCapitals 넘게 쥐었거나 살아 있는 나라들 힘의 leaderShare 를 넘는 나라.
 * 여럿이면 도읍이 많은 쪽, 같으면 힘이 센 쪽. 없으면 null. 다른 나라들은 이 나라를 함께 막으려 한다.
 */
export function leaderOf(r: Realm, viewer: string): string | null {
  const m = memoFor(r)
  if (m?.leader.has(viewer) === true) return m.leader.get(viewer)!
  const L = leaderNow(r, viewer)
  m?.leader.set(viewer, L)
  return L
}

function leaderNow(r: Realm, viewer: string): string | null {
  const R = P.realm
  const fs = live(r)
  const pw = new Map(fs.map((f) => [f, seen(r, viewer, f)]))
  const total = [...pw.values()].reduce((s, v) => s + v, 0)
  let best: { f: string; caps: number; p: number } | null = null
  for (const f of fs) {
    const caps = capitalsHeld(r, f)
    const p = pw.get(f)!
    const big = r.region === 'yeongnam'
    if (caps < (big ? R.leaderCapitalsYeongnam : R.leaderCapitals) && (total <= 0 || p / total < (big ? R.leaderShareYeongnam : R.leaderShare))) continue
    if (best === null || caps > best.caps || (caps === best.caps && p > best.p)) best = { f, caps, p }
  }
  return best?.f ?? null
}

/** `taker` 가 stanceMemory 계절 안에 `victim` 의 땅을 앗았나 */
export function tookRecently(r: Realm, taker: string, victim: string): boolean {
  const s = relationOf(r, taker, victim).took?.[taker]
  return s !== undefined && s >= r.season - P.realm.stanceMemory
}

/** `from` 의 군대가 지금 `to` 의 땅으로 가고 있나 */
function marchingAt(r: Realm, from: string, to: string): boolean {
  return Object.values(r.armies).some((a) => a.faction === from && a.march !== null && r.nodes[a.march.to]?.owner === to)
}

/** 땅이 길로 맞닿았나 */
export function borders(r: Realm, a: string, b: string): boolean {
  for (const ed of Object.values(r.edges)) {
    const x = r.nodes[ed.a]?.owner
    const y = r.nodes[ed.b]?.owner
    if ((x === a && y === b) || (x === b && y === a)) return true
  }
  return false
}

const atWar = (r: Realm, a: string, b: string): boolean => relationOf(r, a, b).state === 'war'

/** 이 나라와 싸우는 살아 있는 나라들 */
function warsOf(r: Realm, f: string): string[] {
  return live(r).filter((x) => x !== f && atWar(r, f, x))
}

/** 이기고 있는 싸움인가 — 최근에 땅을 앗았고 힘도 밀리지 않는다 */
export function winningAgainst(r: Realm, a: string, b: string): boolean {
  return atWar(r, a, b) && tookRecently(r, a, b) && seen(r, a, a) >= seen(r, a, b)
}

/** 앞서가는 나라가 이 나라에 위협인가 — 맞닿았거나 싸우는 중 */
function threatened(r: Realm, f: string, leader: string): boolean {
  return f !== leader && (borders(r, f, leader) || atWar(r, f, leader))
}

/** `a` 가 `b` 와 화친할 까닭 — 없으면 null */
export function truceWhy(r: Realm, a: string, b: string): Motive | null {
  const R = P.realm
  const rel = relationOf(r, a, b).state
  if (rel !== 'war' && rel !== 'neutral') return null
  if (winningAgainst(r, a, b)) return null
  const pa = seen(r, a, a)
  const pb = seen(r, a, b)
  const L = leaderOf(r, a)
  if (rel === 'war') {
    if (stockOf(r, a).grain < upkeepOf(r, a, false) * R.stanceHungry) return { why: 'hungry' }
    if (pb >= pa * R.stanceLosing && (tookRecently(r, b, a) || marchingAt(r, b, a))) return { why: 'losing' }
    const wars = warsOf(r, a)
    // 두 쪽에서 싸운다 — 가장 만만한 적만 남기고 나머지와는 멈춘다
    if (wars.length >= 2) {
      const prey = wars.slice().sort((x, y) => seen(r, a, x) - seen(r, a, y) || (x < y ? -1 : 1))[0]
      if (prey !== b) return { why: 'fronts', about: prey! }
    }
  }
  if (L !== null && L !== a && L !== b && threatened(r, a, L)) return { why: 'leader', about: L }
  // 중립 — 신중한 나라는 맞닿은 센 이웃과 먼저 화친한다
  if (rel === 'neutral' && r.factions[a]?.mind === 'cautious' && borders(r, a, b) && pb >= pa * R.stanceLosing) return { why: 'weak' }
  return null
}

/** `a` 가 `b` 와 동맹할 까닭 — 없으면 null. 호감이 아주 낮으면 없다 */
export function allianceWhy(r: Realm, a: string, b: string): Motive | null {
  const R = P.realm
  const rel = relationOf(r, a, b).state
  if (rel !== 'neutral' && rel !== 'truce') return null
  const fav = favorOf(r, a, b)
  if (fav <= R.favorHostile) return null
  const foe = live(r).find((x) => x !== a && x !== b && atWar(r, a, x) && atWar(r, b, x))
  if (foe !== undefined) return { why: 'commonFoe', about: foe }
  const L = leaderOf(r, a)
  if (L !== null && L !== a && L !== b && threatened(r, a, L) && threatened(r, b, L)) return { why: 'leader', about: L }
  // 같은 큰 이웃 — 둘 다 맞닿은 이웃이 둘 어느 쪽보다 훨씬 세고 둘 가운데 하나를 치고 있으면, 다음은 우리다 (영남 판: 사로가 음즙벌·우시산·골벌을 하나씩 삼켰다)
  const big = bigNeighbor(r, a, b)
  if (big !== null) return { why: 'commonFoe', about: big }
  if (rel === 'truce' && fav >= R.favorAllyAsk) return { why: 'favor' }
  return null
}

/** `a`·`b` 가 같이 맞닿은, 둘 어느 쪽보다 stanceBigNeighbor 배 센(a 의 눈으로) 나라 가운데 둘 중 하나와 싸우는 나라 — 없으면 null */
function bigNeighbor(r: Realm, a: string, b: string): string | null {
  const R = P.realm
  const top = Math.max(seen(r, a, a), seen(r, a, b))
  for (const x of live(r)) {
    if (x === a || x === b || !(atWar(r, a, x) || atWar(r, b, x))) continue
    if (!borders(r, a, x) || !borders(r, b, x)) continue
    if (seen(r, a, x) >= top * R.stanceBigNeighbor) return x
  }
  return null
}

/** `a` 가 `b` 와의 화친·동맹을 깰 까닭 — 없으면 null */
export function breakWhy(r: Realm, a: string, b: string): Motive | null {
  const R = P.realm
  const rel = relationOf(r, a, b).state
  if (rel !== 'truce' && rel !== 'ally') return null
  const pa = seen(r, a, a)
  const pb = seen(r, a, b)
  // 너무 커졌다 — 이대로 두면 그쪽이 이긴다. 다만 너무 약하면 등을 돌릴 엄두를 못 낸다
  if (leaderOf(r, a) === b && pa >= pb * R.stanceBreakFloor) return { why: 'tooBig' }
  // 만만하다 — 탐욕스러운 나라가 달리 싸우는 데가 없고, 맞닿은 이웃이 훨씬 약하고, 그리 가깝지도 않다
  if (r.factions[a]?.mind === 'greedy' && warsOf(r, a).length === 0 && borders(r, a, b)
    && pa >= pb * R.stancePrey && favorOf(r, a, b) < R.favorAllyAsk) return { why: 'prey' }
  return null
}

/** 땅을 앗았다 — 앗긴 쪽이 기억한다 (tookRecently) */
export function noteTake(r: Realm, taker: string, victim: string | null): void {
  if (victim === null || victim === taker || r.factions[victim] === undefined || r.factions[taker] === undefined) return
  const rel = ((r.relations ??= {})[pairKey(taker, victim)] ??= { state: 'neutral', until: null })
  ;(rel.took ??= {})[taker] = r.season
}
