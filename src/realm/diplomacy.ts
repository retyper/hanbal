/**
 * 외교 — 관계 넷과 사신 넷 (docs/realm/FLOW.md §4 · SYSTEMS §8 의 최소판)
 *
 * 관계: 전쟁 · 중립 · 화친(정한 계절까지) · 동맹. 판은 중립에서 시작하고, 먼저 치면 전쟁이 된다.
 * 화친·동맹을 깨고 치면 **모든 나라**와의 관계가 한 칸 내려간다 — 신의가 값이다.
 * 사신: 화친 · 교역(곡식↔철) · 조공 요구 · 동맹. 한 나라가 한 계절에 하나.
 *
 * 받아들일 확률은 정보의 계약을 따른다 — envoyChance 는 **묻는 쪽의 정보로** 범위를 낸다.
 * 판정은 참값으로 셈한 한 점(그 범위 안에 든다)에 이름 붙은 주사위 `envoy:<from>:<to>` 를 굴린다.
 * 지금은 남의 나라가 플레이어에게 사신을 보내지 않는다 (받기·거절 화면이 생기면 붙인다).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { stockOf } from './economy.ts'
import { visibleRange } from './intel.ts'
import { nodeStrength } from './season.ts'
import type { EnvoyAsk, Order, Realm, Relation, ReportLine } from './types.ts'

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

const NEUTRAL: Relation = { state: 'neutral', until: null }

export function relationOf(r: Realm, a: string, b: string): Relation {
  return r.relations?.[pairKey(a, b)] ?? NEUTRAL
}

/** 친한 사이인가 — 화친·동맹. AI 는 이런 나라를 치지 않는다 */
export function friendly(r: Realm, a: string, b: string): boolean {
  const s = relationOf(r, a, b).state
  return s === 'truce' || s === 'ally'
}

function setRelation(r: Realm, a: string, b: string, state: Relation['state'], until: number | null, lines: ReportLine[]): void {
  const prev = relationOf(r, a, b)
  ;(r.relations ??= {})[pairKey(a, b)] = { state, until }
  if (prev.state !== state) lines.push({ kind: 'relation', a: a < b ? a : b, b: a < b ? b : a, state })
}

const STEP: Readonly<Record<Relation['state'], Relation['state']>> = { ally: 'truce', truce: 'neutral', neutral: 'war', war: 'war' }

/**
 * `attacker` 가 `victim` 을 쳤다 (싸움이든, 장정 없는 땅을 걸어 들어가든). 전쟁이 된다.
 * 화친·동맹을 깨고 쳤으면 남은 모든 나라와의 관계가 한 칸 내려간다.
 */
export function onHostile(r: Realm, attacker: string, victim: string | null, lines: ReportLine[]): void {
  if (victim === null || victim === attacker || r.factions[victim] === undefined) return
  const prev = relationOf(r, attacker, victim).state
  if (prev === 'war') return
  setRelation(r, attacker, victim, 'war', null, lines)
  if (prev !== 'truce' && prev !== 'ally') return
  for (const x of Object.keys(r.factions).sort()) {
    if (x === attacker || x === victim) continue
    const s = relationOf(r, attacker, x).state
    const down = STEP[s]
    setRelation(r, attacker, x, down, down === 'truce' ? r.season + P.realm.truceSeasons : null, lines)
  }
}

/** 9 — 화친이 끝날 때가 됐다 */
export function expireRelations(r: Realm, lines: ReportLine[]): void {
  for (const key of Object.keys(r.relations ?? {}).sort()) {
    const rel = r.relations[key]!
    if (rel.state === 'truce' && rel.until !== null && rel.until <= r.season) {
      const [a, b] = key.split('|') as [string, string]
      setRelation(r, a, b, 'neutral', null, lines)
    }
  }
}

/** 한 나라의 힘 — 제 고을마다 머무는 군대와 장정 (정보가 다루는 F 와 같은 잣대) */
export function nationPower(r: Realm, faction: string): number {
  let f = 0
  for (const n of Object.values(r.nodes)) if (n.owner === faction) f += nodeStrength(r, n.id, faction)
  return f
}

/** `asker` 의 정보로 본 `faction` 의 힘 — 본 고을은 범위, 못 본 고을은 0~envoyUnknownNode */
function powerRange(r: Realm, asker: string, faction: string): [number, number] {
  const known = r.intel[asker] ?? {}
  let lo = 0
  let hi = 0
  for (const n of Object.values(r.nodes)) {
    if (n.owner !== faction) continue
    const k = known[n.id]?.force
    const v = k ? visibleRange({ f0: k.f0, src: k.src, u: k.u }, r.season - k.season) : null
    if (v !== null) {
      lo += v[0]
      hi += v[1]
    } else hi += P.realm.envoyUnknownNode
  }
  return [lo, hi]
}

function worth(x: { grain: number; iron: number }): number {
  return x.grain + x.iron * P.realm.envoyIronWorth
}

function atWarWithSame(r: Realm, a: string, b: string): boolean {
  for (const x of Object.keys(r.factions)) {
    if (x === a || x === b) continue
    if (relationOf(r, a, x).state === 'war' && relationOf(r, b, x).state === 'war') return true
  }
  return false
}

/** 받아들일 확률 — 힘의 비 `ratio`(묻는 쪽 / 받는 쪽)에 대해 줄지 않는다 (범위를 끝점 둘로 셀 수 있게) */
function chanceAt(
  r: Realm,
  from: string,
  to: string,
  ask: EnvoyAsk,
  ratio: number,
  give: { grain: number; iron: number },
  take: { grain: number; iron: number },
): number {
  const R = P.realm
  const rel = relationOf(r, from, to).state
  const mind = r.factions[to]?.mind
  const pw = (x: number): number => R.envoyPower * Math.max(-1, Math.min(R.envoyPowerCap - 1, x))
  let p: number
  switch (ask) {
    case 'truce':
      p = R.envoyTruce + pw(ratio - 1) + (mind === 'cautious' ? R.envoyCautious : mind === 'greedy' ? R.envoyGreedy : 0)
      break
    case 'trade':
      p = R.envoyTrade + R.envoyGain * ((worth(give) - worth(take)) / Math.max(1, worth(take)))
      break
    case 'tribute':
      p = R.envoyTribute + pw(ratio - R.envoyTributePower)
      break
    case 'alliance':
      p = R.envoyAlliance + pw(ratio - 1) / 2 + (atWarWithSame(r, from, to) ? R.envoyCommonFoe : 0)
        + (mind === 'cautious' ? R.envoyCautious : mind === 'greedy' ? R.envoyGreedy : 0)
      break
  }
  if (rel === 'war') p += R.envoyWar
  else if (rel === 'truce' || rel === 'ally') p += R.envoyFriend
  return Math.min(R.envoyMax, Math.max(R.envoyMin, p))
}

const NONE = { grain: 0, iron: 0 }

/**
 * 받아들일 확률의 범위 — **묻는 쪽(from)의 정보로** (FLOW §4 · 정보의 계약).
 * 우리 힘은 안다. 그들의 힘은 본 고을의 범위 + 못 본 고을 0~envoyUnknownNode.
 * 교역의 몫은 기본(빈 손)으로 셈한다 — 몫까지 넣은 값은 envoyChanceFor.
 */
export function envoyChance(r: Realm, from: string, to: string, ask: EnvoyAsk): readonly [number, number] {
  return envoyChanceFor(r, from, to, ask, NONE, NONE)
}

export function envoyChanceFor(
  r: Realm,
  from: string,
  to: string,
  ask: EnvoyAsk,
  give: { grain: number; iron: number },
  take: { grain: number; iron: number },
): readonly [number, number] {
  const mine = nationPower(r, from)
  const [lo, hi] = powerRange(r, from, to)
  const a = chanceAt(r, from, to, ask, mine / Math.max(1, hi), give, take)
  const b = chanceAt(r, from, to, ask, mine / Math.max(1, lo), give, take)
  return [Math.min(a, b), Math.max(a, b)]
}

/** 참값의 한 점 — 판정에 쓴다 (envoyChance 의 범위 안에 든다) */
export function envoyTrueChance(
  r: Realm,
  from: string,
  to: string,
  ask: EnvoyAsk,
  give: { grain: number; iron: number },
  take: { grain: number; iron: number },
): number {
  return chanceAt(r, from, to, ask, nationPower(r, from) / Math.max(1, nationPower(r, to)), give, take)
}

function canPay(r: Realm, f: string, x: { grain: number; iron: number }): boolean {
  const s = stockOf(r, f)
  return x.grain >= 0 && x.iron >= 0 && s.grain >= x.grain && s.iron >= x.iron
}

function pay(r: Realm, from: string, to: string, x: { grain: number; iron: number }): void {
  const a = stockOf(r, from)
  const b = stockOf(r, to)
  a.grain -= x.grain
  a.iron -= x.iron
  b.grain += x.grain
  b.iron += x.iron
}

/** 2 — 사신. 한 나라는 한 계절에 첫 사신 하나만 보낸다. 받는 쪽이 플레이어면 (아직) 아무 일도 없다 */
export function resolveEnvoys(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const R = P.realm
  const sent = new Set<string>()
  for (const o of orders) {
    if (o.kind !== 'envoy') continue
    if (sent.has(o.from) || o.from === o.to) continue
    if (r.factions[o.from] === undefined || r.factions[o.to] === undefined) continue
    if (r.factions[o.to]!.mind === 'player') continue
    sent.add(o.from)
    const give = o.ask === 'tribute' ? NONE : o.give
    const take = o.ask === 'trade' || o.ask === 'tribute' ? o.take : NONE
    if (!canPay(r, o.from, give)) continue
    const p = envoyTrueChance(r, o.from, o.to, o.ask, give, take)
    let accepted = roll(r.seed, r.season, `envoy:${o.from}:${o.to}`) < p
    if (accepted && (o.ask === 'trade' || o.ask === 'tribute')) {
      // 받는 쪽이 내놓을 것이 없으면 성사되지 않는다 — 조공은 있는 만큼만
      if (o.ask === 'trade' && !canPay(r, o.to, take)) accepted = false
    }
    lines.push({ kind: 'envoy', from: o.from, to: o.to, ask: o.ask, accepted })
    if (!accepted) {
      // 조공 요구를 거절당하면 그 자리에서 전쟁이다
      if (o.ask === 'tribute') setRelation(r, o.from, o.to, 'war', null, lines)
      continue
    }
    pay(r, o.from, o.to, give)
    switch (o.ask) {
      case 'truce':
        setRelation(r, o.from, o.to, 'truce', r.season + R.truceSeasons, lines)
        break
      case 'alliance':
        setRelation(r, o.from, o.to, 'ally', null, lines)
        break
      case 'trade':
        pay(r, o.to, o.from, take)
        break
      case 'tribute': {
        const s = stockOf(r, o.to)
        pay(r, o.to, o.from, { grain: Math.min(take.grain, s.grain), iron: Math.min(take.iron, s.iron) })
        break
      }
    }
  }
}
