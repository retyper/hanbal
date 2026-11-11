/**
 * 첫 한 시간 깔때기의 공용 부품 — 비용 가정 · 사건 잡기 (first-hour.ts · persona-test.ts 가 같이 쓴다)
 * 가정 표의 근거는 docs/realm/FIRST-HOUR.md §2.
 */
import { plotAgents, plotTargets } from '../src/realm/plots.ts'
import { P } from '../src/tune/params.ts'
import type { Realm, ReportLine } from '../src/realm/types.ts'

/** 비용 가정 (초) — 낮음/가운데/높음 */
export interface Cost { turn: number; tutTurn: number; battle: number; duel: number; capture: number; talk: number; ascend: number; card: number; discover: number; intro: number }
export const COSTS: Record<'lo' | 'mid' | 'hi', Cost> = {
  lo: { turn: 10, tutTurn: 25, battle: 60, duel: 30, capture: 8, talk: 30, ascend: 10, card: 12, discover: 6, intro: 20 },
  mid: { turn: 20, tutTurn: 40, battle: 120, duel: 60, capture: 12, talk: 60, ascend: 20, card: 25, discover: 10, intro: 40 },
  hi: { turn: 35, tutTurn: 60, battle: 180, duel: 90, capture: 15, talk: 90, ascend: 30, card: 40, discover: 15, intro: 60 },
}

export const MILES = ['battle', 'snipe', 'duelOffer', 'duel', 'capture', 'recruit', 'ascend', 'night', 'card', 'discover', 'goal'] as const
export type Mile = typeof MILES[number]
export const NAMES: Record<Mile, string> = {
  battle: '첫 싸움', snipe: '첫 저격 제안', duelOffer: '첫 겨루기 제안', duel: '첫 겨루기(봇)', capture: '첫 생포', recruit: '첫 회유 등용', ascend: '첫 각성',
  night: '첫 밤 작전 제안', card: '첫 사건 카드', discover: '첫 다른 나라 만남', goal: '첫 승리조건 진척',
}

/** 한 턴에 일어난 일의 수 — 분 환산이 곱한다 */
export interface Counts { battles: number; duels: number; captures: number; recruits: number; ascends: number; cards: number; discovers: number }
export const noCounts = (): Counts => ({ battles: 0, duels: 0, captures: 0, recruits: 0, ascends: 0, cards: 0, discovers: 0 })

/** 제안(턴 머리) — 사건 카드 · 밤 작전 */
export function headFlags(r: Realm, as: string, flags: Set<Mile>, c: Counts): void {
  if (r.card != null) { flags.add('card'); c.cards++ }
  if (plotAgents(r, as).length > 0 && plotTargets(r, as, 'assassin').length > 0) flags.add('night')
}

/** 이번 턴 보고 줄에서 사건을 잡는다 — r 는 advance 전, next 는 뒤. 우리가 진 싸움(`lost`)도 센다 */
export function scanReport(r: Realm, next: Realm, lines: readonly ReportLine[], as: string, tut: boolean, startKnown: ReadonlySet<string>, flags: Set<Mile>, c: Counts, lost?: { n: number; big: number }): void {
  for (const l of lines) {
    if (l.kind === 'battle') {
      const weAtk = (l.atkFaction ?? r.armies[l.attacker]?.faction) === as
      if (weAtk || l.defender === as) {
        flags.add('battle'); flags.add('snipe'); c.battles++
        const hs = l.start?.heroes; const aides = l.start?.aides
        const mine = weAtk ? 0 : 1
        const ours = [hs?.[mine] ?? null, ...(aides?.[mine] ?? [])].filter((x): x is string => x !== null)
        if (hs?.[1 - mine] != null && ours.some((id) => (r.heroes[id]?.mu ?? 0) >= P.realm.tacDuelMu)) flags.add('duelOffer')
        if ((l.rounds ?? []).some((x) => x.ev === 'duel-win' || x.ev === 'duel-lose')) { flags.add('duel'); c.duels++ }
        if (l.captured !== null && next.heroes[l.captured]?.captor === as) { flags.add('capture'); c.captures++ }
        if (l.defender !== as && r.nodes[l.node]?.owner !== as && next.nodes[l.node]?.owner === as && next.factions[l.defender]?.capital === l.node) flags.add('goal')
        if (lost !== undefined) {
          const wonAtk = l.outcome === 'rout' || l.outcome === 'win'
          const lostAtk = l.outcome === 'lose' || l.outcome === 'routed'
          if (weAtk ? lostAtk : wonAtk) { lost.n++; if (l.outcome === 'routed' || l.outcome === 'rout') lost.big++ }
        }
      }
    }
    if (l.kind === 'recruit' && l.faction === as && l.how === 'persuade' && !tut) { flags.add('recruit'); c.recruits++ }
    if (l.kind === 'ascend' && next.heroes[l.hero]?.faction === as) { flags.add('ascend'); c.ascends++ }
    if (l.kind === 'discover' && l.faction === as && !startKnown.has(l.nation)) { flags.add('discover'); c.discovers++ }
    if ((l.kind === 'pathRite' || l.kind === 'pathIron' || l.kind === 'suzerain') && l.faction === as) flags.add('goal')
  }
}

/** 이번 턴이 더하는 초 (가정 비용 k 로) */
export function turnSeconds(k: Cost, tut: boolean, c: Counts): number {
  return (tut ? k.tutTurn : k.turn) + c.battles * k.battle + c.duels * k.duel + c.captures * k.capture + c.recruits * k.talk + c.ascends * k.ascend + c.cards * k.card + c.discovers * k.discover
}
