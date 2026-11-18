/**
 * 첫 한 시간 깔때기의 공용 부품 — 비용 가정 · 사건 잡기 (first-hour.ts · persona-test.ts 가 같이 쓴다)
 * 가정 표의 근거는 docs/realm/FIRST-HOUR.md §2.
 *
 * 11-18 「불꽃이 다 참」과 「힘이 붙음」을 따로 잰다 (docs/realm/study-20261118/30-PROPOSAL.md 바로 고칠 것 11).
 *  - flameFull: 우리 장수의 불꽃이 처음 다 찬 때. 시련 장수는 `kindle` 줄만 내고(시련이 열림) 그 밖은 `ascend` 줄을 낸다. 둘 다 센다.
 *  - ascend: 힘(능력치 · 기술)이 붙은 때. 시련 관문이 열린 규칙(P.realm.ascendTrialOpen 1)에서는 시련을 넘어야 붙는데 봇은 8분 열전을 못 한다.
 *    그래서 `passTrials` 가 「이겼다 치고」 깨우고 `trialSeconds` 가 시련 한 판의 시간을 더한다. 잰 값이 아니라 보정(가정)이다.
 *    관문이 닫힌 규칙(0)에서는 불꽃이 차는 싸움 끝에 곧바로 붙으니(투지) 보정이 없다.
 */
import { completeTrial } from '../src/realm/awakening-trial.ts'
import { ascendNeed } from '../src/realm/heroes.ts'
import { plotAgents, plotTargets } from '../src/realm/plots.ts'
import { HAEBI_RUN, HAEBI_STAGES, P } from '../src/tune/params.ts'
import type { Realm, ReportLine } from '../src/realm/types.ts'

/**
 * 각성 시련 한 판(초) — 열전 수치에서 온다. 낮음 = 두목이 나오는 때(그 전에는 못 이긴다) · 가운데와 높음 = 판 길이(8분).
 * 본편이 받아 주는 이긴 시간의 범위와 같다 (raid/haebi.ts trialWinValid). 한 번에 이긴다고 친다
 */
const TRIAL_FAST = HAEBI_RUN.bossAt * HAEBI_STAGES.trial.length
const TRIAL_FULL = HAEBI_RUN.duration * HAEBI_STAGES.trial.length

/** 비용 가정 (초) — 낮음/가운데/높음 */
export interface Cost { turn: number; tutTurn: number; battle: number; duel: number; capture: number; talk: number; ascend: number; trial: number; card: number; discover: number; intro: number }
export const COSTS: Record<'lo' | 'mid' | 'hi', Cost> = {
  lo: { turn: 10, tutTurn: 25, battle: 60, duel: 30, capture: 8, talk: 30, ascend: 10, trial: TRIAL_FAST, card: 12, discover: 6, intro: 20 },
  mid: { turn: 20, tutTurn: 40, battle: 120, duel: 60, capture: 12, talk: 60, ascend: 20, trial: TRIAL_FULL, card: 25, discover: 10, intro: 40 },
  hi: { turn: 35, tutTurn: 60, battle: 180, duel: 90, capture: 15, talk: 90, ascend: 30, trial: TRIAL_FULL, card: 40, discover: 15, intro: 60 },
}

export const MILES = ['battle', 'snipe', 'duelOffer', 'duel', 'capture', 'recruit', 'flameFull', 'ascend', 'night', 'card', 'discover', 'goal'] as const
export type Mile = typeof MILES[number]
export const NAMES: Record<Mile, string> = {
  battle: '첫 싸움', snipe: '첫 저격 제안', duelOffer: '첫 겨루기 제안', duel: '첫 겨루기(봇)', capture: '첫 생포', recruit: '첫 회유 등용', flameFull: '첫 불꽃 참(투지 자격)', ascend: '첫 각성',
  night: '첫 밤 작전 제안', card: '첫 사건 카드', discover: '첫 다른 나라 만남', goal: '첫 승리조건 진척',
}
/**
 * 줄 이름 — `ascend` 줄은 규칙에 따라 뜻이 다르다.
 * 시련 관문이 열린 규칙: 시련을 넘어 각성한 때(보정). 닫힌 규칙: 불꽃만으로 투지가 붙은 때(각성 모습은 열전 「목책 돌파」의 도깨비 뒤라 본편 셈으로는 못 잰다)
 */
export const mileName = (m: Mile, trialOpen: boolean, passTrial: boolean): string =>
  m !== 'ascend' ? NAMES[m] : !trialOpen ? '첫 투지(불꽃만으로)' : passTrial ? '첫 각성(시련 보정)' : '첫 각성(시련 안 넘음)'

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
    // 불꽃이 다 참 — 시련 장수는 문턱에 닿은 `kindle` 줄로(시련이 열린다 · heroes.kindle), 그 밖은 곧바로 나오는 `ascend` 줄로 안다
    if (l.kind === 'kindle') { const h = next.heroes[l.hero]; if (h !== undefined && h.faction === as && l.n >= ascendNeed(h)) flags.add('flameFull') }
    if (l.kind === 'ascend' && next.heroes[l.hero]?.faction === as) { flags.add('flameFull'); flags.add('ascend'); c.ascends++ }
    if (l.kind === 'discover' && l.faction === as && !startKnown.has(l.nation)) { flags.add('discover'); c.discovers++ }
    if ((l.kind === 'pathRite' || l.kind === 'pathIron' || l.kind === 'suzerain') && l.faction === as) flags.add('goal')
  }
}

/** 이번 턴이 더하는 초 (가정 비용 k 로) */
export function turnSeconds(k: Cost, tut: boolean, c: Counts): number {
  return (tut ? k.tutTurn : k.turn) + c.battles * k.battle + c.duels * k.duel + c.captures * k.capture + c.recruits * k.talk + c.ascends * k.ascend + c.cards * k.card + c.discovers * k.discover
}

/**
 * 시련 보정 — 시련이 열린(trialReady) 우리 장수를 「이겼다 치고」 깨운다. 본편의 셈은 시련을 넘기 전에는 힘을 안 붙이고(heroes.kindle),
 * 시련을 끝내는 것은 화면 쪽이라(awakening-trial.completeTrial) 헤드리스 봇 판에서는 아무도 안 깨어난다.
 * 막힌 장수(부상 · 원정 · 진군 중 · 끝난 판 · trialBlock)는 그대로 두니 다음 턴에 다시 부르면 된다. 사람도 그때는 못 들어간다.
 * 잰 값이 아니라 가정이다: 시련을 한 번에 이긴다고 친다. 실제 승률은 `tools/raid-winrate.ts <묶음> <씨앗> trial` 로 잰다.
 * 시련 관문이 닫힌 규칙(P.realm.ascendTrialOpen 0)에서는 열린 시련이 없어 아무 일도 안 한다(배우는 판의 해비만 남는다).
 */
export function passTrials(r: Realm, as: string): { next: Realm; passed: number } {
  let next = r, passed = 0
  for (const id of Object.keys(r.heroes).sort()) {
    const h = next.heroes[id]
    if (h === undefined || h.faction !== as || h.trialReady !== true || h.ascended === true) continue
    const done = completeTrial(next, id)
    if (done !== null) { next = done.next; passed++ }
  }
  return { next, passed }
}

/** 시련 n 판이 더하는 초 — 시련 한 판 + 각성 연출 (가정 비용 k 로) */
export const trialSeconds = (k: Cost, n: number): number => n * (k.trial + k.ascend)
