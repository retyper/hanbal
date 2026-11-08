/**
 * 합종 — 앞서가는 나라를 묶어 친다 (위원회 11-08 ⑤ · docs/realm/council/1108/design.md · loop L3 「앞서면 맞는다」).
 * 형 11-08: 쉬움(촌장)은 그대로 · 보통부터 — 우리가 판을 압도하면 겁먹은 나라들이 연합해 맞선다. 세금 말고 후반의 장면이 되게.
 *
 *   서기   (계절 끝) 재물의 위협(scale.wealthThreat)이 coalThreat 을 넘고, 우리를 「앞서가는 나라」(stance.leaderOf)로 보는 이웃
 *          (맞닿았거나 · 싸우는 중이거나 · 최근 땅을 앗긴) 가운데 우리와 화친·동맹·조공 사이가 아닌 나라가 coalMin 이상이면 선다.
 *          힘 센 순으로 coalMax 까지. 서로 동맹(싸우던 사이는 화친)으로 묶인다 — 땅을 지나고 본 것을 나눈다 (diplomacy 그대로).
 *   예고   함께 칠 턴(strikeAt)이 선 때 정해진다 — 보통 coalWarn 계절 · 어려움 coalWarnHard 계절 뒤. 화면이 미리 보인다 (운보다 통제).
 *   출정   strikeAt 앞 턴 끝에 연합 나라들이 함께 칼을 뽑고(전쟁), coalMarch 계절 동안 우리 고을을 coalFocus 만큼 더 노린다 (ai.focus).
 *   흩기   우리 수 — 화친(그 나라가 빠진다) · 이간(연합이 맺은 동맹이 깨지면 약한 쪽이 빠진다) · 이기기(coalLeaveLosses 번 지면 빠진다).
 *          남은 나라가 coalMin 밑이면 흩어진다. 우리가 작아져 위협이 걷혀도 흩어진다.
 *   끝     출정이 끝날 때 우리 고을을 하나도 못 앗았으면 「막아 냈다」 — 연합 나라들이 coalBrokenRest 계절 쉬고 우리를 좀 더 좋게 본다.
 *          앗았으면 「앗고 흩어졌다」. 어느 쪽이든 연합이 맺어 준 동맹은 화친으로 물러나고 coalRest 계절 뒤에야 새 연합이 설 수 있다.
 * 판 상태만 읽고 쓴다 · 굴림이 없다 (결정론).
 */
import { P } from '../tune/params.ts'
import { monthly, seasonEndTurn, seasons } from './calendar.ts'
import { addFavor, bindLeague, declareWar, friendly, nationPower, pairKey, relationOf, unbindLeague } from './diplomacy.ts'
import { knows } from './discovery.ts'
import { wealthThreat } from './scale.ts'
import { borders, leaderOf, tookRecently } from './stance.ts'
import { isVassal } from './suzerain.ts'
import type { CoalLeave, Coalition, Realm, ReportLine } from './types.ts'

const alive = (r: Realm, f: string): boolean => Object.values(r.nodes).some((n) => n.owner === f)

/** 이 판에 합종이 걸리나 — 보통 이상(쉬움은 wealthThreat 가 늘 0) · 배우는 판·장(scenario) 빼고 · 판이 안 끝났다 */
function on(r: Realm): boolean {
  return P.realm.coalOn >= 0.5 && r.region !== 'tutorial' && r.scenario === undefined && r.outcome == null
    && r.factions[r.player]?.mind === 'player' && wealthThreat(r) > 0
}

const hard = (r: Realm): boolean => (r.tier ?? 1) >= P.realm.coalHardTier

/** 연합이 서고 버티는 데 드는 나라 수 — 우리가 아는 살아 있는 나라의 coalShare 몫 (2 부터 · 보통 coalMin · 어려움 coalMinHard 까지) */
export function coalMinOf(r: Realm): number {
  const R = P.realm
  const known = Object.keys(r.factions).filter((f) => f !== r.player && alive(r, f) && knows(r, r.player, f)).length
  const cap = Math.max(2, Math.round(hard(r) ? R.coalMinHard : R.coalMin))
  return Math.max(2, Math.min(cap, Math.round(known * R.coalShare)))
}

/** 우리 땅에서 길로 coalReach 걸음 안에 땅이 있는 나라들 (너비 우선 · 판 상태만) */
function within(r: Realm): Set<string> {
  const me = r.player
  const dist = new Map<string, number>()
  let front = Object.values(r.nodes).filter((n) => n.owner === me).map((n) => n.id)
  for (const id of front) dist.set(id, 0)
  const adj = new Map<string, string[]>()
  for (const ed of Object.values(r.edges)) {
    adj.set(ed.a, [...(adj.get(ed.a) ?? []), ed.b])
    adj.set(ed.b, [...(adj.get(ed.b) ?? []), ed.a])
  }
  const out = new Set<string>()
  for (let d = 1; d <= Math.max(1, Math.round(P.realm.coalReach)) && front.length > 0; d++) {
    const next: string[] = []
    for (const id of front) {
      for (const to of adj.get(id) ?? []) {
        if (dist.has(to)) continue
        dist.set(to, d)
        next.push(to)
        const o = r.nodes[to]?.owner
        if (o != null && o !== me) out.add(o)
      }
    }
    front = next
  }
  return out
}

/** 지금 선 합종 — 없으면 null */
export function coalitionOf(r: Realm): Coalition | null {
  return r.coalition ?? null
}

/** 이 턴이 함께 치는 출정 안인가 */
export function coalStriking(r: Realm): boolean {
  const c = r.coalition
  return c != null && r.season >= c.strikeAt && r.season < c.endAt
}

/**
 * 연합이 거는 노릴 값 (ai.focus) — 연합 나라가 연합의 과녁(우리) 고을을 볼 때. 출정 동안 coalFocus · 모이는 동안 coalGatherFocus
 */
export function coalFocusOf(r: Realm, faction: string, owner: string | null): number {
  const c = r.coalition
  if (c == null || owner === null || owner !== c.against || !c.members.includes(faction)) return 0
  return coalStriking(r) ? P.realm.coalFocus : r.season < c.strikeAt ? P.realm.coalGatherFocus : 0
}

/**
 * 합종에 들 만한 나라 — 살아 있는 AI 나라 가운데 우리를 앞서가는 나라로 보고, 서로 아는 사이고, 우리 땅에서 coalReach 걸음 안에 있거나
 * 싸우거나 최근 땅을 앗겼고, 우리와 동맹·조공 사이가 아니다 (화친한 나라도 든다 · 칠 때 화친을 깨고 온다). 힘 센 순 (같으면 id)
 */
export function coalCandidates(r: Realm): string[] {
  const me = r.player
  const near = within(r)
  return Object.keys(r.factions).sort()
    .filter((f) => f !== me && r.factions[f]!.mind !== 'player' && alive(r, f) && knows(r, f, me) && knows(r, me, f))
    .filter((f) => relationOf(r, f, me).state !== 'ally' && !isVassal(r, f, me))
    .filter((f) => near.has(f) || borders(r, f, me) || relationOf(r, f, me).state === 'war' || tookRecently(r, me, f))
    .filter((f) => leaderOf(r, f) === me)
    .sort((a, b) => nationPower(r, b) - nationPower(r, a) || (a < b ? -1 : 1))
}

/** 연합이 선다 — 서로 묶고, 함께 칠 턴을 박는다 */
function form(r: Realm, members: string[], lines: ReportLine[]): void {
  const R = P.realm
  const ms = members.slice().sort()
  const bound: string[] = []
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) {
      if (bindLeague(r, ms[i]!, ms[j]!)) bound.push(pairKey(ms[i]!, ms[j]!))
      addFavor(r, ms[i]!, ms[j]!, R.coalFavor)
    }
  }
  const head = members[0]!
  // 함께 칠 턴 — 다음 턴부터 셈해 coalWarn 계절 뒤 (달 시계면 그 달 수)
  const strikeAt = r.season + 1 + seasons(r, Math.round(hard(r) ? R.coalWarnHard : R.coalWarn))
  const endAt = strikeAt + seasons(r, Math.max(1, Math.round(R.coalMarch)))
  r.coalition = { against: r.player, members: ms, head, formed: r.season, strikeAt, endAt, bound, peace: ms.filter((m) => relationOf(r, m, r.player).state === 'truce'), defeats: {}, took: 0 }
  lines.push({ kind: 'coalition', ev: 'form', against: r.player, members: ms, head, at: strikeAt })
}

/** 연합이 끝난다 — 맺어 준 동맹은 화친으로 · 쉴 턴 */
function end(r: Realm, c: Coalition, lines: ReportLine[], ev: 'broken' | 'spent' | 'scatter' | 'fade'): void {
  const R = P.realm
  for (const key of c.bound) {
    const [a, b] = key.split('|') as [string, string]
    unbindLeague(r, a, b)
  }
  if (ev === 'broken') {
    for (const m of c.members) {
      addFavor(r, m, c.against, R.coalBrokenFavor)
      // 출정을 막아 냈다 — 연합 나라들이 군사를 거두고 숨을 고른다 (달 시계 · rout.beatenResting 이 읽는다)
      const f = r.factions[m]
      if (f !== undefined && monthly(r) && R.coalBrokenRest > 0) {
        const until = seasonEndTurn(r) + seasons(r, Math.round(R.coalBrokenRest))
        f.beaten = { n: 0, until: Math.max(until, f.beaten?.until ?? 0) }
      }
    }
  }
  lines.push({ kind: 'coalition', ev, against: c.against, members: c.members.slice(), head: c.head, ...(ev === 'spent' ? { took: c.took } : {}) })
  r.coalition = null
  r.coalRest = r.season + 1 + seasons(r, Math.round(R.coalRest))
}

/** 이번 턴의 싸움·땅을 센다 — 연합 나라가 우리에게 진 싸움(치다 막힘 · 우리가 쳐서 이김) · 앗은 우리 고을 */
function tally(r: Realm, c: Coalition, lines: readonly ReportLine[]): void {
  const me = c.against
  for (const l of lines) {
    if (l.kind === 'battle') {
      const atk = l.atkFaction ?? r.armies[l.attacker]?.faction
      if (atk === undefined) continue
      const atkWon = l.outcome === 'rout' || l.outcome === 'win'
      const draw = l.outcome === 'draw' && l.field === true
      // 연합 나라가 우리를 쳤다 막혔다 · 우리가 연합 나라를 쳐서 이겼다
      const loser = l.defender === me && c.members.includes(atk) && !atkWon && !draw ? atk
        : atk === me && c.members.includes(l.defender) && atkWon ? l.defender : null
      if (loser !== null) c.defeats[loser] = (c.defeats[loser] ?? 0) + 1
    } else if (l.kind === 'take' && c.members.includes(l.faction) && relationOf(r, l.faction, me).took?.[l.faction] === r.season) {
      c.took += 1
    }
  }
}

/** 빠질 나라를 고른다 — 한 턴에 까닭마다 (이름 순으로 정해진다) */
function leavers(r: Realm, c: Coalition): Array<{ who: string; why: CoalLeave }> {
  const R = P.realm
  const out: Array<{ who: string; why: CoalLeave }> = []
  const gone = new Set<string>()
  const drop = (who: string, why: CoalLeave): void => {
    if (gone.has(who)) return
    gone.add(who)
    out.push({ who, why })
  }
  for (const m of c.members) {
    if (!alive(r, m)) drop(m, 'fall')
    else if (relationOf(r, m, c.against).state === 'ally' || isVassal(r, m, c.against) || (friendly(r, m, c.against) && (c.marched === true || !(c.peace ?? []).includes(m)))) drop(m, 'truce')
    else if ((c.defeats[m] ?? 0) >= Math.max(1, Math.round(R.coalLeaveLosses))) drop(m, 'beaten')
  }
  // 이간 — 연합이 맺어 준 동맹이 깨졌거나(동맹 밑으로) · 본디 사이가 틀어졌으면(화친 밑으로) 둘 가운데 약한 쪽이 빠진다
  const bound = new Set(c.bound)
  const ms = c.members.filter((m) => !gone.has(m))
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) {
      const a = ms[i]!
      const b = ms[j]!
      if (gone.has(a) || gone.has(b)) continue
      const s = relationOf(r, a, b).state
      const split = bound.has(pairKey(a, b)) ? s !== 'ally' : s !== 'ally' && s !== 'truce'
      if (!split) continue
      const pa = nationPower(r, a)
      const pb = nationPower(r, b)
      drop(pa < pb || (pa === pb && a > b) ? a : b, 'sow')
    }
  }
  return out
}

/**
 * 9 — 합종의 걸음 (season.advance 가 턴마다 · 싸움·사신·공작을 다 판정한 뒤). `seasonEnd` 면 새 연합이 서거나 두려움이 걷히는지도 본다
 */
export function stepCoalition(r: Realm, lines: ReportLine[], seasonEnd: boolean): void {
  const R = P.realm
  const c = r.coalition
  if (c != null) {
    // 판이 끝났거나 · 꺼졌거나 · 과녁이 달라졌으면 조용히 걷는다 (옛 판 · 시험)
    if (!on(r) || c.against !== r.player) {
      // 우리가 쪼그라들어 위협이 0 이 됐으면 보고하고, 판이 끝났거나 꺼졌으면 조용히
      const shrunk = c.against === r.player && P.realm.coalOn >= 0.5 && r.outcome == null && r.factions[r.player]?.mind === 'player'
      end(r, c, shrunk ? lines : [], 'fade')
      return
    }
    tally(r, c, lines)
    for (const { who, why } of leavers(r, c)) {
      c.members = c.members.filter((m) => m !== who)
      lines.push({ kind: 'coalition', ev: 'leave', against: c.against, members: c.members.slice(), head: c.head, who, why })
    }
    if (c.members.length < coalMinOf(r)) return end(r, c, lines, 'scatter')
    if (seasonEnd && r.season < c.strikeAt - 1) {
      // 두려움이 걷혔다 — 우리가 작아졌거나, 우리를 앞서가는 나라로 보는 연합 나라가 모자라다 (출정에 들기 전에만)
      const scared = c.members.filter((m) => leaderOf(r, m) === c.against).length
      if (wealthThreat(r) < R.coalThreat * R.coalFade || scared < coalMinOf(r)) return end(r, c, lines, 'fade')
    }
    // 다음 턴이 출정 — 함께 칼을 뽑는다
    if (c.marched !== true && r.season >= c.strikeAt - 1) {
      c.marched = true
      for (const m of c.members) declareWar(r, m, c.against, [], 'league')
      lines.push({ kind: 'coalition', ev: 'strike', against: c.against, members: c.members.slice(), head: c.head, at: c.endAt })
    }
    // 출정의 마지막 턴 — 막아 냈나, 앗겼나
    if (r.season >= c.endAt - 1) end(r, c, lines, c.took > 0 ? 'spent' : 'broken')
    return
  }
  if (!seasonEnd || !on(r) || r.season < (r.coalRest ?? 0) || wealthThreat(r) < R.coalThreat) return
  const cands = coalCandidates(r).slice(0, Math.max(2, Math.round(R.coalMax)))
  if (cands.length >= coalMinOf(r)) form(r, cands, lines)
}
