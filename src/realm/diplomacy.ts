/**
 * 외교 — 관계 넷과 사신 넷 (docs/realm/FLOW.md §4 · SYSTEMS §8 의 최소판)
 *
 * 관계: 전쟁 · 중립 · 화친(정한 계절까지) · 동맹. 판은 중립에서 시작하고, 먼저 치면 전쟁이 된다.
 * 화친·동맹을 깨고 치면 **모든 나라**와의 관계가 한 칸 내려간다 — 신의가 값이다.
 * 사신: 화친 · 교역(곡식↔철) · 조공 요구 · 동맹. 상대 나라마다 한 계절에 하나. 몰래 하는 일은 plots.ts(공작).
 *
 * 받아들일 확률은 정보의 계약을 따른다 — envoyChance 는 **묻는 쪽의 정보로** 범위를 낸다.
 * 판정은 참값으로 셈한 한 점(그 범위 안에 든다)에 이름 붙은 주사위 `envoy:<from>:<to>` 를 굴린다.
 * 남의 나라는 플레이어에게 사신 대신 **청**(Ask)을 건다 — 아래 makeAsks · resolveAnswers. AI 끼리는 사신을 주고받는다 (ai.ts envoys).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { stockOf } from './economy.ts'
import { envoyBonus } from './heroes.ts'
import { visibleRange } from './intel.ts'
import { nodeStrength } from './season.ts'
import type { Ask, AskKind, EnvoyAsk, Order, Realm, Relation, ReportLine } from './types.ts'

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

/** 두 나라 사이가 한 칸 나빠진다 (동맹→화친→중립→전쟁) — 공작이 들키거나 이간이 먹힐 때 (plots.ts) */
export function worsen(r: Realm, a: string, b: string, lines: ReportLine[]): void {
  if (a === b || r.factions[a] === undefined || r.factions[b] === undefined) return
  const down = STEP[relationOf(r, a, b).state]
  setRelation(r, a, b, down, down === 'truce' ? r.season + P.realm.truceSeasons : null, lines)
}

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

/**
 * 화친·동맹을 맺으면 무엇을 얻나 (형: "화친이랑 동맹도 되면 뭐가 되는건지 모르겠네" — 2026-10-18)
 *   화친 — 서로 안 친다 + **장터**: 계절마다 둘 다 곡식 truceTrade 씩 (holdMarkets)
 *   동맹 — 땅을 지나간다 + **본 것을 나눈다** (shareIntel) + 동맹 AI 는 같은 적을 먼저 친다 (allyFoe)
 */

/** 9 — 장터: 화친 중인 두 나라가 계절마다 곡식을 조금씩 얻는다. 동맹도 화친의 위라 장터가 선다 */
export function holdMarkets(r: Realm, lines: ReportLine[]): void {
  const g = P.realm.truceTrade
  if (g <= 0) return
  for (const key of Object.keys(r.relations ?? {}).sort()) {
    const rel = r.relations[key]!
    if (rel.state !== 'truce' && rel.state !== 'ally') continue
    const [a, b] = key.split('|') as [string, string]
    if (r.factions[a] === undefined || r.factions[b] === undefined) continue
    stockOf(r, a).grain += g
    stockOf(r, b).grain += g
    lines.push({ kind: 'market', a, b, grain: g })
  }
}

/** 9 — 동맹끼리 본 것을 나눈다: 고을마다 더 새로 본 군세·경계를 서로 가진다. 땅은 하나라도 알면 둘 다 안다 */
export function shareIntel(r: Realm): void {
  for (const key of Object.keys(r.relations ?? {}).sort()) {
    if (r.relations[key]!.state !== 'ally') continue
    const [a, b] = key.split('|') as [string, string]
    const ia = r.intel[a]
    const ib = r.intel[b]
    if (ia === undefined || ib === undefined) continue
    for (const node of [...new Set([...Object.keys(ia), ...Object.keys(ib)])].sort()) {
      const x = ia[node]
      const y = ib[node]
      const force = !x?.force ? (y?.force ?? null) : !y?.force ? x.force : x.force.season >= y.force.season ? x.force : y.force
      const alert = !x?.alert ? (y?.alert ?? null) : !y?.alert ? x.alert : x.alert.season >= y.alert.season ? x.alert : y.alert
      ia[node] = { land: true, force: force === null ? null : { ...force }, alert: alert === null ? null : { ...alert } }
      ib[node] = { land: true, force: force === null ? null : { ...force }, alert: alert === null ? null : { ...alert } }
    }
  }
}

/** `owner` 가 이 나라의 동맹과 전쟁 중인가 — 동맹 AI 는 같은 적을 먼저 친다 (P.realm.aiAllyFocus) */
export function allyFoe(r: Realm, faction: string, owner: string | null): boolean {
  if (owner === null || owner === faction) return false
  for (const x of Object.keys(r.factions).sort()) {
    if (x === faction || x === owner) continue
    if (relationOf(r, faction, x).state === 'ally' && relationOf(r, x, owner).state === 'war') return true
  }
  return false
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
  p += envoyBonus(r, from, ask) // 군주 매력 · 매혹 · 장사꾼 (heroes.ts)
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

/**
 * 2 — 사신. 한 계절에 **상대 나라마다** 하나씩 보낼 수 있다 (형: "한 턴에 외교나 거래나 한쪽밖에 못한다는데 말이 안돼").
 * 같은 상대에게 둘을 보내면 첫 것만. 받는 쪽이 플레이어면 아무 일도 없다 (플레이어에게는 청 — makeAsks)
 */
export function resolveEnvoys(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const R = P.realm
  const sent = new Set<string>()
  for (const o of orders) {
    if (o.kind !== 'envoy') continue
    const pair = `${o.from}>${o.to}`
    if (sent.has(pair) || o.from === o.to) continue
    if (r.factions[o.from] === undefined || r.factions[o.to] === undefined) continue
    if (r.factions[o.to]!.mind === 'player') continue
    sent.add(pair)
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

/**
 * 청(請) — 남의 나라가 플레이어에게 거는 것 (형: "적이 뭔가 거래를 걸어온다거나 동맹요구하거나 그런거 없어?" — 2026-10-18).
 * 계절 끝에 AI 가 만들고(makeAsks), 플레이어는 다음 계절에 답한다(answer 명령 → resolveAnswers). 답이 없으면 거절.
 * 무엇을 청하나는 사이·힘의 비·성향·창고가 정한다:
 *   전쟁 중   — 지는 쪽은 화친을, 훨씬 센 쪽은 조공을 내놓으면 멈추겠다고
 *   중립      — 화친(신중할수록) · 맞바꿈 · 같은 적이 있으면 동맹 · 우리가 훨씬 세면 조공을 바친다 · 탐욕스럽고 훨씬 세면 조공 요구
 *   화친      — 맞바꿈 · 동맹
 *   동맹      — 맞바꿈
 */

const NO_GOODS = { grain: 0, iron: 0 }

/** 지금 이 나라가 답할 수 있는 청 — id 순서 */
export function openAsks(r: Realm, faction: string): Ask[] {
  return (r.asks ?? []).filter((a) => a.to === faction && a.until >= r.season).sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

/** 맞바꿈 제안 — 그쪽이 남는 것을 내고 모자란 것을 받는다. 서로 낼 것이 없으면 null */
function tradeOffer(r: Realm, from: string, to: string): { give: { grain: number; iron: number }; take: { grain: number; iron: number } } | null {
  const R = P.realm
  const a = stockOf(r, from)
  const b = stockOf(r, to)
  const iron = R.askTradeIron
  const grain = Math.round(iron * R.envoyIronWorth)
  if (a.iron >= iron * 2 && b.grain >= grain) return { give: { grain: 0, iron }, take: { grain, iron: 0 } }
  if (a.grain >= grain * 3 && b.iron >= iron) return { give: { grain, iron: 0 }, take: { grain: 0, iron } }
  return null
}

/** 한 나라가 플레이어에게 걸 청 하나 — 걸 거리가 없으면 null. 굴림은 `ask-kind:<season>:<from>` */
function pickAsk(r: Realm, from: string, to: string): Ask | null {
  const R = P.realm
  const rel = relationOf(r, from, to).state
  const ratio = nationPower(r, to) / Math.max(1, nationPower(r, from)) // 플레이어가 이 나라의 몇 배인가
  const mind = r.factions[from]?.mind
  const mine = stockOf(r, from)
  const theirs = stockOf(r, to)
  const round10 = (x: number): number => Math.max(10, Math.round(x / 10) * 10)
  const opts: Array<{ kind: AskKind; w: number; give: { grain: number; iron: number }; take: { grain: number; iron: number } }> = []
  const strong = 1 / Math.max(1e-9, ratio) >= R.askDemandPower
  if (rel === 'war') {
    opts.push({ kind: 'truce', w: ratio > 1 ? 3 : 1, give: NO_GOODS, take: NO_GOODS })
  } else if (rel === 'neutral') {
    opts.push({ kind: 'truce', w: mind === 'cautious' ? 2 : 1, give: NO_GOODS, take: NO_GOODS })
  }
  if (rel === 'neutral' || rel === 'truce') {
    opts.push({ kind: 'alliance', w: atWarWithSame(r, from, to) ? 3 : rel === 'truce' ? 1 : 0, give: NO_GOODS, take: NO_GOODS })
  }
  if (rel !== 'war') {
    const t = tradeOffer(r, from, to)
    if (t !== null) opts.push({ kind: 'trade', w: 2, ...t })
  }
  if ((rel === 'war' || rel === 'neutral') && ratio >= R.askTributePower && mine.grain >= 20) {
    opts.push({ kind: 'tribute', w: mind === 'cautious' ? 3 : 1, give: { grain: round10(mine.grain * R.askTributeShare), iron: 0 }, take: NO_GOODS })
  }
  if ((rel === 'war' || (rel === 'neutral' && mind === 'greedy')) && strong && theirs.grain >= 20) {
    opts.push({ kind: 'demand', w: 2, give: NO_GOODS, take: { grain: round10(theirs.grain * R.askDemandShare), iron: 0 } })
  }
  const live = opts.filter((o) => o.w > 0)
  const total = live.reduce((s, o) => s + o.w, 0)
  if (total <= 0) return null
  let x = roll(r.seed, r.season, `ask-kind:${from}`) * total
  const o = live.find((c) => (x -= c.w) < 0) ?? live[live.length - 1]!
  return { id: `ask:${r.season}:${from}`, from, to, kind: o.kind, give: o.give, take: o.take, until: r.season + 1 }
}

/** 9 — 계절 끝: AI 나라들이 플레이어에게 청을 건다. 나라마다 aiAskChance, 플레이어는 계절에 askMaxPerSeason 까지 */
export function makeAsks(r: Realm, lines: ReportLine[]): void {
  const R = P.realm
  const me = r.player
  if (me === undefined || r.factions[me] === undefined || r.outcome) return
  const alive = (f: string): boolean => Object.values(r.nodes).some((n) => n.owner === f)
  if (!alive(me)) return
  let made = 0
  for (const f of Object.keys(r.factions).sort()) {
    if (made >= R.askMaxPerSeason) break
    if (f === me || r.factions[f]!.mind === 'player' || !alive(f)) continue
    if (roll(r.seed, r.season, `ask:${f}`) >= R.aiAskChance) continue
    const ask = pickAsk(r, f, me)
    if (ask === null) continue
    ;(r.asks ??= []).push(ask)
    lines.push({ kind: 'ask', ask })
    made++
  }
}

/**
 * 1 — 청에 답한다. 이번 계절이 마감인 청은 모두 여기서 끝난다: 받기 명령이 있으면 받고, 없으면 거절.
 * 받았는데 낼 것이 모자라면 거절로 친다. 조공 요구를 거절하면 전쟁이다.
 */
export function resolveAnswers(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const R = P.realm
  const due = (r.asks ?? []).filter((a) => a.until <= r.season).sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
  if (due.length === 0) return
  r.asks = (r.asks ?? []).filter((a) => a.until > r.season)
  for (const a of due) {
    if (r.factions[a.from] === undefined || r.factions[a.to] === undefined) continue
    const ans = orders.find((o): o is Extract<Order, { kind: 'answer' }> => o.kind === 'answer' && o.ask === a.id)
    let yes = ans?.yes === true
    if (yes) {
      switch (a.kind) {
        case 'truce':
          setRelation(r, a.from, a.to, 'truce', r.season + R.truceSeasons, lines)
          break
        case 'alliance':
          setRelation(r, a.from, a.to, 'ally', null, lines)
          break
        case 'trade':
          if (canPay(r, a.from, a.give) && canPay(r, a.to, a.take)) {
            pay(r, a.from, a.to, a.give)
            pay(r, a.to, a.from, a.take)
          } else yes = false
          break
        case 'tribute': {
          const s = stockOf(r, a.from)
          pay(r, a.from, a.to, { grain: Math.min(a.give.grain, s.grain), iron: Math.min(a.give.iron, s.iron) })
          if (relationOf(r, a.from, a.to).state !== 'ally') setRelation(r, a.from, a.to, 'truce', r.season + R.truceSeasons, lines)
          break
        }
        case 'demand':
          if (canPay(r, a.to, a.take)) {
            pay(r, a.to, a.from, a.take)
            if (relationOf(r, a.from, a.to).state !== 'ally') setRelation(r, a.from, a.to, 'truce', r.season + R.truceSeasons, lines)
          } else yes = false
          break
      }
    }
    lines.push({ kind: 'answered', ask: a.id, yes, from: a.from, askKind: a.kind })
    if (!yes && a.kind === 'demand') setRelation(r, a.from, a.to, 'war', null, lines)
  }
}
