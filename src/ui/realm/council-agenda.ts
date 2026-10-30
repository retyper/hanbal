/**
 * 전략 회의의 안건 — 장수들이 저마다 제 생각을 펴고, 군주가 안건마다 하나를 고른다 (형 10-29: "장수 얼굴이 나오고 하나씩 대사 치듯 ·
 * 이 고을에 가까운 타국 고을이 있어 다 비우면 위험하니 7할만 · 적의 경계가 강해 기습은 위험하니 대로로 · ○○국은 호전적이니 먼저 치게 두고 ·
 * 저는 밤눈이 밝아 기습에 능하니 저를 믿고 맡겨 주십시오 · 충돌하지 않는 안건도, 충돌하는 안건도 · 마지막에 한 번 누르면 다 이루어지게").
 *
 * 안건 넷 — 때(지금 칠까 기다릴까) · 군사(다 데려갈까 남겨 둘까) · 길(어느 길로 · 누가 이끄나) · 군량. 판의 사정이 걸릴 때만 선다.
 * 한 안건 안의 말은 서로 갈린다(하나만 고른다). 안건끼리는 겹치지 않는다(때를 「기다린다」로 고르면 나머지는 쓰이지 않는다).
 *
 * 누가 어느 편에 서나 — 그 사람다워야 한다 (형 10-29: "장수 인물 특성과의 적절성"):
 *   밀어붙이는 쪽(지금 친다 · 모두 데려간다 · 우리가 세니 대로)은 거친 이(bold) — 겁쟁이·신중한 이는 그 편에 서지 않는다
 *   기다리자 · 적이 지킬 길목을 읽는 말은 지략이 cnReadRyak 넘는 이 · 남겨 지키자는 통솔 높고 신중한 이 · 군량은 내정 높은 이
 *   「우리가 더 세다」는 판세를 알 때만(m.win) — 모르면 그 말을 하지 않는다
 *   특성 길(밤눈·물길잡이·산사람)로 나서는 이는 겁쟁이가 아니고, 그 군대를 이끌거나 이끌 수 있을 때만 「맡겨 달라」
 *   군사를 나눌 수 없으면(양쪽 splitMin · 군대 armyMax) 「몇 할만」을 내놓지 않는다
 * 말은 council-says.ts (결마다 · 특성마다). 판에는 손대지 않는다(읽기만).
 */
import { guardAdjust, guardWeights, type GuardWhy } from '../../realm/council.ts'
import { headcount } from '../../realm/battle.ts'
import { josa } from '../../realm/data/prose.ts'
import { relationOf } from '../../realm/diplomacy.ts'
import { knows } from '../../realm/discovery.ts'
import { movesOf, type ApproachMove, type Move } from '../../realm/estimate.ts'
import { hasTrait, isRuler } from '../../realm/heroes.ts'
import { foeAlliesWhenStruck, lastBattleVs } from '../../realm/memory.ts'
import { forceOf, otherEnd } from '../../realm/season.ts'
import type { Approach, Army, Hero, Order, Realm } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { councilFact, grainSeen, heroRouteFact, heroSplitFact, lostLast, nationRouteFacts, nationSplitFact, plotFact, whenSaid, type RouteFact } from './council-recall.ts'
import { schemeSay, type Scheme } from './council-schemes.ts'
import { askOf, fill, pickIdx, sageuk, sayOf, VOLUNTEER, type Move as SayMove } from './council-says.ts'
import { voiceKind } from './voice.ts'

/** 고르면 출정 판에 무엇이 걸리나 */
export type Choice =
  | { readonly k: 'take'; readonly share: number }
  | { readonly k: 'route'; readonly ap: Approach; readonly lead?: string }
  | { readonly k: 'ration'; readonly extra: number }
  | { readonly k: 'wait' }
  | { readonly k: 'go' }
  /** 치지 않는다 — 이번 출정을 거둔다 (먼 갈 곳도) */
  | { readonly k: 'hold' }
  /** 공작을 먼저 — 이번 계절은 떠나지 않고 그 공작을 건다 (방화 · 이간). agent 는 미리 고른 이(없으면 고용 밀정) · grain 은 그 값 */
  | { readonly k: 'plot'; readonly op: 'burn' | 'sow'; readonly target: string; readonly other?: string; readonly agent: string | null; readonly grain: number }
  /** 두 갈래로 — 다른 우리 군대(army)가 from 에서 edge 로 같은 계절에 닿는다 (협공) */
  | { readonly k: 'pincer'; readonly army: string; readonly edge: string; readonly from: string }

export interface Voice {
  /** 말한 장수 — null 이면 군주 스스로의 뜻(얼굴 없는 카드) */
  readonly hero: Hero | null
  /** 아뢰는 말 (두세 문장) */
  readonly line: string
  /** 고르면 붙는 짧은 이름 — 결정 카드 · 정리 */
  readonly label: string
  readonly opt: Choice
  /** 어느 처지의 말인가 (시험 · 말이 그 사람다운지 본다) · recall 은 지난 싸움의 길을 드는 말 */
  readonly move?: SayMove | Scheme | 'volunteer' | 'recall'
  /** 안의 종류 — 장수의 기억(council)에 적는 이름 (없으면 opt 로 셈한다 · howOf) */
  readonly how?: string
  /** 지난 회의에서 이 장수의 말을 따라 잘 됐다 — 얼굴에 금빛 테 */
  readonly proven?: boolean
  /** 지난 회의에서 이 장수의 말이 빗나갔다 — 머뭇거린다 */
  readonly doubt?: boolean
}

export type AgendaId = 'ally' | 'plot' | 'wait' | 'pincer' | 'keep' | 'route' | 'ration'
export interface Agenda {
  readonly id: AgendaId
  readonly title: string
  readonly voices: readonly Voice[]
}

export interface CouncilCtx {
  /** 이 장수가 이 군대를 이끌 수 있나 (그 고을에 있고 쉬는 중) */
  readonly canLead: (id: string) => boolean
  /** 지금 고른 군량의 더 챙김 · 그 군량값 · 국고의 곡식 */
  readonly rationNow: number
  readonly rationCost: (extra: number) => number
  readonly grain: number
  /** 이번 계절 이 공작을 걸 수 있나 — 보낼 이(가장 솜씨 좋은 쉬는 장수 · 없으면 고용 밀정 null)와 값. 못 걸면 null (자리·곡식·사람) */
  readonly plotHand?: (op: 'burn' | 'sow', target: string, other?: string) => { readonly agent: string | null; readonly grain: number } | null
  /** 이 군대를 두 갈래의 다른 한쪽으로 부를 수 있나 (이번 계절 다른 곳으로 걸어 둔 군대는 빼고) */
  readonly armyFree?: (id: string) => boolean
}

/** 안의 종류 — 장수의 기억에 적는 이름 (길 · keep · all · wait · go · hold · burn · sow · pincer · more · same) */
export function howOf(v: Voice): string {
  if (v.how !== undefined) return v.how
  const o = v.opt
  switch (o.k) {
    case 'take': return o.share >= 1 ? 'all' : 'keep'
    case 'route': return o.ap
    case 'ration': return 'ration'
    case 'plot': return o.op
    default: return o.k
  }
}

const AP_NAME: Readonly<Record<Approach, string>> = { road: '대로', night: '밤길', ford: '여울', ridge: '산기슭', cliff: '절벽' }
/** 결정 띠의 짧은 길 이름 */
export const APPROACH_SHORT = AP_NAME
/** 전략 회의의 바탕 그림 — 군막 안 (public/realm/event · 챗지피티 10-29) */
export const COUNCIL_ART = 'event-war-council'
/** 고른 안의 짧은 이름 */
const AP_LABEL: Readonly<Record<Approach, string>> = { road: '대로로', night: '밤길로', ford: '여울로', ridge: '산기슭으로', cliff: '절벽으로' }
/** 적이 지킬 길목을 읽은 말 */
const GUARD_SAY: Readonly<Record<Approach, readonly string[]>> = {
  road: ['적은 대로를 막고 성문 앞에 진을 칠 것입니다.', '적은 큰길에 군사를 모아 둘 것입니다.'],
  night: ['적은 밤 경계를 겹겹이 세울 것입니다.', '적은 밤마다 횃불을 늘려 둘 것입니다.'],
  ford: ['적은 여울목에 군사를 둘 것입니다.', '적은 물가를 지킬 것입니다.'],
  ridge: ['적은 산기슭 길목을 지킬 것입니다.', '적은 산자락에 망을 세울 것입니다.'],
  cliff: ['적은 절벽 위를 지킬 것입니다.', '적은 벼랑 위에 보초를 둘 것입니다.'],
}
/** 그 길목을 지킬 까닭 — 읽은 장수가 함께 말한다 */
const WHY_SAY: Readonly<Record<GuardWhy, (foe: string, cmd: string | null) => string>> = {
  repeat: () => '지난번에도 우리가 그 길로 들었으니 저들도 기억할 것입니다.',
  trait: (_f, cmd) => (cmd !== null ? `저쪽을 지키는 ${josa(cmd, '은', '는')} 늘 그렇게 지키는 장수입니다.` : '저쪽 장수의 버릇이 그러합니다.'),
  mind: (foe) => `${josa(foe, '은', '는')} 성향이 그러한 나라입니다.`,
  land: () => '땅의 생김이 그곳을 지키게 되어 있습니다.',
}

/** 지키는 쪽의 장수 — 그 고을에 선 적 군대 가운데 지략이 가장 높은 이 (council-lines 와 같은 셈) */
function foeCmd(r: Realm, to: string, def: string): Hero | null {
  const hs = Object.values(r.armies).filter((x) => x.at === to && x.march === null && x.faction === def && x.hero !== null).map((x) => r.heroes[x.hero!]).filter((h): h is Hero => h !== undefined)
  return hs.sort((x, y) => y.ryak - x.ryak || (x.id < y.id ? -1 : 1))[0] ?? null
}

/** 회의에 앉는 이 — 이 군대의 장수, 그 밖에 지략·통솔이 높은 우리 장수 (군주 빼고) · 넷까지 */
function members(r: Realm, me: string, a: Army): Hero[] {
  const lead = a.hero !== null ? r.heroes[a.hero] : undefined
  const others = Object.values(r.heroes)
    .filter((h) => h.faction === me && h.status === 'free' && h.id !== lead?.id && !isRuler(r, h.id))
    .sort((x, y) => y.ryak + y.tong - (x.ryak + x.tong) || (x.id < y.id ? -1 : 1))
  return [...(lead !== undefined ? [lead] : []), ...others].slice(0, 4)
}

/** 겁쟁이 · 신중한 이 — 밀어붙이는 편에 서지 않는다 */
const timid = (h: Hero): boolean => hasTrait(h, 'coward') || hasTrait(h, 'careful')
/** 거친 이 — 밀어붙이자는 쪽 */
export const bold = (h: Hero): boolean => !timid(h)
  && (['m-gruff', 'm-young', 'w-bright', 'm-knight', 'm-veteran'].includes(voiceKind(h)) || hasTrait(h, 'drinker') || hasTrait(h, 'hundred') || hasTrait(h, 'ironhand') || h.mu >= 8)
/** 차분한 이 — 기다리자 · 남겨 두자는 쪽에 더 어울린다 */
const calm = (h: Hero): boolean => timid(h) || hasTrait(h, 'steadfast') || ['m-sage', 'm-elder', 'w-cool', 'w-shaman', 'w-knight', 'w-matron'].includes(voiceKind(h))
const best = (hs: readonly Hero[], f: (h: Hero) => number): Hero | undefined => [...hs].sort((x, y) => f(y) - f(x) || (x.id < y.id ? -1 : 1))[0]

/** 우리 땅 곁의 남의 군사 — 그 나라 · 고을 · 머릿수 (동맹·화친은 빼고 · skip 고을은 셈하지 않는다 — 칠 곳을 지키는 군사는 우리와 맞붙는다) */
function threatsNear(r: Realm, me: string, node: string, skip: string | null = null): Array<{ faction: string; at: string; men: number }> {
  const out: Array<{ faction: string; at: string; men: number }> = []
  for (const ed of Object.values(r.edges)) {
    const o = otherEnd(ed, node)
    if (o === null || o === skip) continue
    for (const x of Object.values(r.armies)) {
      if (x.at !== o || x.faction === me || x.lent !== undefined) continue
      const st = relationOf(r, me, x.faction).state
      if (st === 'ally' || st === 'truce') continue
      out.push({ faction: x.faction, at: o, men: headcount(forceOf(r, x)) })
    }
  }
  return out.sort((x, y) => y.men - x.men || (x.at < y.at ? -1 : 1))
}

/** 머릿수를 말로 — 남의 군사는 대강 (ODDS: 남의 속은 범위·말) */
const sizeWord = (theirs: number, ours: number): string => (theirs >= ours ? '우리보다 많은 군사' : theirs * 2 >= ours ? '만만치 않은 군사' : '얼마간의 군사')

/** 이 몫으로 나누면 몇 명이 떠나나 — 화면(app.applyVoice)과 같은 셈 */
export const takeCount = (a: Army, share: number): number => (Object.values(a.mix) as number[]).reduce((s, n) => s + (share >= 1 ? n : Math.round(n * share)), 0)
/** 그 나라와 손잡은 나라들 — 살아 있고 우리가 아는 나라 · 우리와도 손잡은 나라는 뺀다 · 땅이 큰 차례 */
function alliesOf(r: Realm, me: string, def: string): string[] {
  const size = (f: string): number => Object.values(r.nodes).filter((n) => n.owner === f).length
  return Object.keys(r.factions).sort()
    .filter((f) => f !== me && f !== def && size(f) > 0 && knows(r, me, f) && relationOf(r, def, f).state === 'ally' && relationOf(r, me, f).state !== 'ally')
    .sort((x, y) => size(y) - size(x) || (x < y ? -1 : 1))
}

/** 그 나라가 우리와 땅을 맞댔나 */
function bordersUs(r: Realm, me: string, f: string): boolean {
  return Object.values(r.edges).some((ed) => {
    const a = r.nodes[ed.a]?.owner
    const b = r.nodes[ed.b]?.owner
    return (a === me && b === f) || (a === f && b === me)
  })
}

/** 두 갈래의 다른 한쪽 — 이 군대 말고 쉬는 우리 군대 가운데 다른 길로 같은 계절에 칠 곳에 닿는 가장 큰 군대 */
function pincerArmy(r: Realm, me: string, a: Army, m: Move, ctx: CouncilCtx): { army: Army; edge: string; from: string } | null {
  let top: { army: Army; edge: string; from: string; men: number } | null = null
  for (const b of Object.values(r.armies).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (b.faction !== me || b.id === a.id || b.march !== null || b.lent !== undefined) continue
    if (ctx.armyFree !== undefined && !ctx.armyFree(b.id)) continue
    const men = headcount(forceOf(r, b))
    if (men < P.realm.splitMin) continue
    const mv = movesOf(r, me, b).find((x) => x.to === m.to && x.edge.id !== m.edge.id && x.seasons === m.seasons && x.blocked === null && x.hostile)
    if (mv === undefined) continue
    if (top === null || men > top.men) top = { army: b, edge: mv.edge.id, from: b.at, men }
  }
  return top === null ? null : { army: top.army, edge: top.edge, from: top.from }
}

/** 나라 수를 말로 — 두 나라 · 세 나라 */
const countWord = (n: number): string => ['', '한', '두', '세', '네', '다섯'][n] ?? String(n)

/** 지난 길의 말을 맺는 한 마디 — 그 길로 이겼으니 이번에도 */
const RECALL_ASK: readonly string[] = ['이번에도 {ap|으로} 가시지요.', '같은 길이 또 통할 것입니다. 이번에도 {ap|으로} {there}에 드시지요.']
/** 지난 떠남으로 남기자는 말 — 이웃에 보이는 적이 없어도 */
const KEEP_RECALL: readonly string[] = ['이번에는 {stay|을} {here}에 남겨 두시고 {go}만 데려가시지요.', '{here|을} 비우면 같은 일을 또 겪습니다. {stay|은} 남겨 두시고 {go}만 데려가시지요.']
/** 사실 한 마디를 말 앞에 — 사극 말투로 */
const withWhy = (why: string, line: string): string => (why !== '' ? `${sageuk(why)} ${line}` : line)

/**
 * 이 출정의 안건들 — 적 고을을 칠 때만. 안건마다 말이 둘 이상(장수 둘, 또는 장수 하나와 군주의 뜻)일 때만 선다.
 * a 는 군대 전부 · m · moves 는 출정할 무리의 힘으로 셈한 것 (app.sortieProbe)
 *
 * 차례: 동맹(치지 말자 · 기다리자 · 이간) → 먼저 공작 → 때(기다릴까 · 동맹 안건이 서면 뺀다) → 두 갈래 → 군사 → 길 → 군량.
 * 앞의 셋(동맹 · 공작 · 때)에서 떠나지 않기로 고르면 나머지는 쓰이지 않는다.
 * 까닭은 기억에서 (council-recall) — 그 일을 겪은 장수가 먼저 말하고, 없으면 나라의 장부로. 사실이 없으면 지금 말 그대로.
 */
export function councilAgendas(r: Realm, me: string, a: Army, m: Move, moves: readonly ApproachMove[], ctx: CouncilCtx): Agenda[] {
  const node = r.nodes[m.to]
  const def = node?.owner ?? null
  if (node === undefined || def === null || def === me || !m.hostile) return []
  const foe = r.factions[def]?.name ?? ''
  const here = r.nodes[a.at]?.name ?? ''
  const there = node.name
  const ours = headcount(forceOf(r, a))
  const seats = members(r, me, a)
  if (seats.length === 0) return []
  const out: Agenda[] = []
  const used = new Set<string>()
  const pickSeat = (f: (h: Hero) => number, ok: (h: Hero) => boolean = () => true, from: Set<string> = used): Hero | undefined => {
    const h = best(seats.filter((x) => !from.has(x.id) && ok(x)), f)
    if (h !== undefined) from.add(h.id)
    return h
  }
  const base = { foe, here, there, seasons: `${m.seasons}계절`, all: `${ours.toLocaleString('ko-KR')}명` }
  // 맞서는 이 — 겁쟁이·신중한 이가 아니면 누구든, 거친 이가 먼저 (한 사람만 말하면 회의가 아니다 · 형 10-29: "대사가 한 줄밖에 안 뜬다")
  const counter = (from: Set<string> = used): Hero | undefined => pickSeat((h) => h.mu + (bold(h) ? 5 : 0), (h) => !timid(h), from)
  const say = (h: Hero, move: SayMove, v: Readonly<Record<string, string>> = {}): string => sayOf(h, move, { ...base, ...v }, r.season)
  const sly = (h: Hero): number => (voiceKind(h) === 'w-sly' ? 3 : 0)

  // ⓪-1 동맹 — 칠 나라가 튼튼한 동맹을 끼고 있으면: 치지 말자 · 때를 기다리자 · 이간하자 (거친 이는 그래도 치자)
  const allies = alliesOf(r, me, def)
  const struck = foeAlliesWhenStruck(r, me, def)
  const lastB = lastBattleVs(r, { faction: me }, def)
  const near = allies.filter((f) => bordersUs(r, me, f))
  const burned = struck !== null && struck >= 1 && lastB !== null && !lastB.on && lastB.res === 'lost' && r.season - lastB.s <= P.realm.cnMemAge
  if (allies.length > 0 && (near.length > 0 || allies.length >= 2 || burned)) {
    const ally = near[0] ?? allies[0]!
    const allyName = r.factions[ally]?.name ?? ''
    const v = { ...base, ally: allyName }
    const why = burned ? `${whenSaid(r.season, lastB!.s)} ${josa(foe, '을', '를')} 칠 때 이웃 ${countWord(struck!)} 나라가 함께 막아 우리가 졌습니다.`
      : near.length > 0 ? `${josa(allyName, '은', '는')} 우리와 땅을 맞댄 나라입니다.`
        : `${josa(foe, '은', '는')} ${countWord(allies.length)} 나라와 손을 잡았습니다.`
    const mine = new Set<string>()
    const voices: Voice[] = []
    let said = false
    const line = (h: Hero, sc: Scheme): string => { const t = schemeSay(h, sc, v, r.season, said ? '' : why); said = true; return t }
    // 세 카드(치지 않는다 · 때를 기다린다 · 이간)는 늘 — 그 편에 설 장수가 없으면 군주의 뜻(얼굴 없는 카드)으로. 거친 이가 남으면 「그래도 친다」
    const holder = pickSeat((h) => h.ryak + (calm(h) ? 3 : 0) + (timid(h) ? 2 : 0) - (bold(h) ? 4 : 0), (h) => !bold(h), mine)
    voices.push(holder !== undefined
      ? { hero: holder, label: '치지 않는다', move: 'allyHold', line: line(holder, 'allyHold'), opt: { k: 'hold' } }
      : { hero: null, label: '치지 않는다', line: '이번 출정을 거둔다', opt: { k: 'hold' } })
    const waiter = pickSeat((h) => h.ryak + (calm(h) ? 2 : 0) - (bold(h) ? 3 : 0), (h) => !bold(h) || h.ryak >= P.realm.cnReadRyak, mine)
    voices.push(waiter !== undefined
      ? { hero: waiter, label: '때를 기다린다', move: 'allyWait', line: line(waiter, 'allyWait'), opt: { k: 'wait' } }
      : { hero: null, label: '때를 기다린다', line: '이번 계절은 머물고 때를 본다', opt: { k: 'wait' } })
    const [x, y] = def < ally ? [def, ally] : [ally, def]
    const hand = ctx.plotHand?.('sow', x, y) ?? null
    if (hand !== null) {
      const sower = pickSeat((h) => h.ryak + sly(h), (h) => h.ryak >= P.realm.cnReadRyak || sly(h) > 0, mine)
      const opt: Choice = { k: 'plot', op: 'sow', target: x, other: y, agent: hand.agent, grain: hand.grain }
      voices.push(sower !== undefined
        ? { hero: sower, label: '이간 공작', move: 'allySow', line: line(sower, 'allySow'), opt }
        : { hero: null, label: '이간 공작', line: `${josa(foe, '과', '와')} ${allyName} 사이를 갈라놓는다`, opt })
    }
    const hot = counter(mine)
    if (hot !== undefined && bold(hot)) voices.push({ hero: hot, label: '그래도 친다', move: 'allyGo', line: line(hot, 'allyGo'), opt: { k: 'go' } })
    // 장수가 아무도 말하지 않으면 회의가 아니다
    if (voices.some((x2) => x2.hero !== null)) {
      out.push({ id: 'ally', title: `${josa(allyName, '과', '와')} 손잡은 ${josa(foe, '을', '를')} 칠까`, voices })
    }
  }

  // ⓪-2 먼저 공작 — 저들의 곳간이 그득한 것을 보았거나(정찰) 공작 뒤에 친 싸움이 잘 됐으면: 이번 계절은 곳간에 불을 놓고 다음에 치자
  const seen = grainSeen(r, me, def)
  const rich = seen !== null && seen.v >= P.realm.cnPlotRich
  const burnHand = ctx.plotHand?.('burn', def) ?? null
  if (burnHand !== null && knows(r, me, def)) {
    const nationPlot = plotFact(r, me, def, null)
    if (rich || nationPlot !== '') {
      const mine = new Set<string>()
      // 그 나라에 공작을 먹여 본 이가 먼저 — 없으면 지략 높은 이 (꾀돌이 · 차분한 이가 앞)
      const did = seats.find((h) => plotFact(r, me, def, h.id) !== nationPlot)
      const plotter = did ?? pickSeat((h) => h.ryak + sly(h) + (calm(h) ? 1 : 0) - (bold(h) ? 3 : 0), (h) => h.ryak >= P.realm.cnReadRyak, mine)
      if (plotter !== undefined) {
        mine.add(plotter.id)
        const own = plotFact(r, me, def, plotter.id)
        const why = rich ? `${whenSaid(r.season, seen!.s)} 척후가 보니 ${foe}의 곳간에 곡식이 그득하였습니다.${own !== nationPlot ? ` ${own}` : ''}` : own
        const voices: Voice[] = [{ hero: plotter, label: '먼저 곳간에 불을', move: 'plotAdvise', line: schemeSay(plotter, 'plotAdvise', base, r.season, why), opt: { k: 'plot', op: 'burn', target: def, agent: burnHand.agent, grain: burnHand.grain } }]
        const hot = counter(mine)
        voices.push(hot !== undefined
          ? { hero: hot, label: '곧장 친다', move: 'plotAgainst', line: schemeSay(hot, 'plotAgainst', base, r.season), opt: { k: 'go' } }
          : { hero: null, label: '곧장 친다', line: '불은 놓지 않는다: 곧장 친다', opt: { k: 'go' } })
        out.push({ id: 'plot', title: '치기 전에 곳간을 태울까', voices })
      }
    }
  }

  // ① 때 — 호전적인 나라가 우리 땅 곁에 큰 군사를 두었으면, 먼저 치게 두고 성에서 맞아 힘을 뺀 뒤에 치자 (동맹 안건이 섰으면 거기에 기다림이 있다)
  const nearFoe = new Map<string, number>()
  for (const n of Object.values(r.nodes)) {
    if (n.owner !== me) continue
    for (const t of threatsNear(r, me, n.id)) if (t.faction === def) nearFoe.set(t.at, Math.max(nearFoe.get(t.at) ?? 0, t.men))
  }
  const foeMen = [...nearFoe.values()].reduce((s, n) => s + n, 0)
  if (!out.some((x) => x.id === 'ally') && r.factions[def]?.mind === 'greedy' && foeMen >= ours * P.realm.cnWaitFoe) {
    const wise = pickSeat((h) => h.ryak + (calm(h) ? 2 : 0) - (bold(h) ? 2 : 0), (h) => h.ryak >= P.realm.cnReadRyak)
    if (wise !== undefined) {
      const voices: Voice[] = [{ hero: wise, label: '기다린다', move: 'waitAdvise', line: say(wise, 'waitAdvise', { size: sizeWord(foeMen, ours) }), opt: { k: 'wait' } }]
      const hot = counter()
      voices.push(hot !== undefined
        ? { hero: hot, label: '지금 친다', move: 'waitAgainst', line: say(hot, 'waitAgainst'), opt: { k: 'go' } }
        : { hero: null, label: '지금 친다', line: '기다리지 않는다: 이번 계절에 친다', opt: { k: 'go' } })
      out.push({ id: 'wait', title: '지금 칠까, 기다릴까', voices })
    }
  }

  // ①-2 두 갈래 — 다른 우리 군대가 다른 길로 같은 계절에 닿을 수 있고, 성이 굳거나 · 지난번에 졌거나 · 승산이 빠듯하면
  const pin = pincerArmy(r, me, a, m, ctx)
  const lost = lostLast(r, me, def)
  if (pin !== null && (m.walled || lost !== '' || m.win === null || m.win[0] < P.realm.cnCloseOdds)) {
    const mine = new Set<string>()
    const bLead = pin.army.hero !== null ? r.heroes[pin.army.hero] : undefined
    // 그쪽 군대를 이끄는 이가 먼저 나선다 (겁쟁이·신중한 이가 아니면) — 아니면 자리의 통솔 높은 이
    const fromB = bLead !== undefined && bLead.status === 'free' && !timid(bLead)
    const adv = fromB ? bLead : pickSeat((h) => h.tong + (bold(h) ? 2 : 0), (h) => !timid(h), mine)
    if (adv !== undefined) {
      mine.add(adv.id)
      const aLead = a.hero !== null ? r.heroes[a.hero] : undefined
      const pv = fromB
        ? { ...base, via: here, with: aLead !== undefined && aLead.id !== adv.id ? aLead.name : `${here}의 군대` }
        : { ...base, via: r.nodes[pin.from]?.name ?? '', with: bLead?.name ?? `${r.nodes[pin.from]?.name ?? ''}의 군대` }
      const why = lost !== '' ? lost : m.walled ? `${josa(there, '은', '는')} 성벽이 굳어 한쪽에서만 치면 오래 걸립니다.` : ''
      const voices: Voice[] = [{ hero: adv, label: '두 갈래로', move: 'pincerAdvise', line: schemeSay(adv, 'pincerAdvise', pv, r.season, why), opt: { k: 'pincer', army: pin.army.id, edge: pin.edge, from: pin.from } }]
      const careful = pickSeat((h) => h.ryak + (calm(h) ? 3 : 0) - (bold(h) ? 4 : 0), (h) => !bold(h), mine)
      voices.push(careful !== undefined
        ? { hero: careful, label: '한 길로', move: 'pincerAgainst', how: 'one', line: schemeSay(careful, 'pincerAgainst', base, r.season), opt: { k: 'go' } }
        : { hero: null, label: '한 길로', how: 'one', line: '나누지 않는다: 한 길로만 간다', opt: { k: 'go' } })
      out.push({ id: 'pincer', title: '두 갈래로 칠까', voices })
    }
  }

  // ② 군사 — 이 고을 곁에 남의 군사가 있으면 다 비우지 말자 (같은 고을에 남는 우리 군대가 있으면 걱정 없다 · 나눌 수 없으면 안 낸다)
  //   지난 떠남에 털린 일이 있으면 곁에 보이는 적이 없어도 선다 — 그 일을 겪은 장수가 먼저 말한다
  const stay = Object.values(r.armies).some((x) => x.faction === me && x.id !== a.id && x.at === a.at && x.march === null)
  const go = takeCount(a, P.realm.cnKeepTake)
  const canSplit = go >= P.realm.splitMin && ours - go >= P.realm.splitMin && Object.values(r.armies).filter((x) => x.faction === me).length < P.realm.armyMax
  const th = stay || !canSplit ? [] : threatsNear(r, me, a.at, m.to)
  const nSplit = nationSplitFact(r, me)
  const wasThere = stay || !canSplit ? undefined : seats.find((h) => !used.has(h.id) && heroSplitFact(r, h.id) !== null)
  const keepWhy = wasThere !== undefined ? heroSplitFact(r, wasThere.id)!.line : nSplit?.side === 'keep' ? nSplit.line : ''
  if (th.length > 0 || (!stay && canSplit && keepWhy !== '')) {
    const t = th[0]
    const keepPct = Math.round((1 - P.realm.cnKeepTake) * 10)
    if (wasThere !== undefined) used.add(wasThere.id)
    const careful = wasThere ?? pickSeat((h) => h.tong + (calm(h) ? 3 : 0) - (bold(h) ? 5 : 0) - (hasTrait(h, 'drinker') ? 3 : 0))
    if (careful !== undefined) {
      const v = { tf: t !== undefined ? r.factions[t.faction]?.name ?? '' : '', tn: t !== undefined ? r.nodes[t.at]?.name ?? '' : '', size: t !== undefined ? sizeWord(t.men, ours) : '', go: `${go.toLocaleString('ko-KR')}명`, stay: `${(ours - go).toLocaleString('ko-KR')}명` }
      const kline = t !== undefined ? say(careful, 'keepAdvise', v) : sageuk(fill(KEEP_RECALL[pickIdx(`${careful.id}:keepRecall:${r.season}`, KEEP_RECALL.length)]!, { ...base, ...v }))
      const voices: Voice[] = [{ hero: careful, label: `${10 - keepPct}할만 데려간다`, move: 'keepAdvise', line: withWhy(keepWhy, kline), opt: { k: 'take', share: P.realm.cnKeepTake } }]
      // 맞서는 말 — 승산이 빠듯하면 「수비가 단단하니 다 데려가자」, 넉넉하면 「빨리 끝내고 돌아오자」 · 지난 떠남이 받치면 그 일을 든다
      const close = m.win === null || m.win[0] < P.realm.cnCloseOdds
      const hot = counter()
      const mv: SayMove = close ? 'keepAgainst' : 'keepAllSafe'
      const allWhy = nSplit?.side === 'all' ? nSplit.line : ''
      voices.push(hot !== undefined
        ? { hero: hot, label: '모두 데려간다', move: mv, line: withWhy(allWhy, say(hot, mv)), opt: { k: 'take', share: 1 } }
        : { hero: null, label: '모두 데려간다', line: '나누지 않는다: 군사를 모두 데려간다', opt: { k: 'take', share: 1 } })
      out.push({ id: 'keep', title: '군사를 얼마나 데려갈까', voices })
    }
  }

  // ③ 길 — 저마다 제 길. 지난번 이 나라를 쳐서 이긴 길을 기억하는 이가 먼저 · 읽은 장수는 적이 지킬 길목과 그 까닭을, 특성이 있는 장수는 그 길을 맡겠다고 나선다
  if (moves.length >= 2) {
    const fc = foeCmd(r, m.to, def)
    const ws = guardWeights(r, m.to, def, me, fc)
    const topW = ws.length > 1 ? [...ws].sort((x, y) => y.w - x.w)[0]! : null
    const q = (ap: Approach, read: Approach | null): number => {
      const x = moves.find((y) => y.ap === ap)
      return x === undefined || ap === 'road' ? 0 : read === null ? x.p : guardAdjust(x.p, ap, read)
    }
    const has = (ap: Approach): boolean => moves.some((x) => x.ap === ap)
    const voices: Voice[] = []
    const said = new Set<Approach>()
    const add = (v: Voice, ap: Approach): void => { if (!said.has(ap)) { said.add(ap); voices.push(v) } }
    // 길은 모두가 말할 수 있다 — 아직 말하지 않은 이가 먼저, 앞 안건에서 말한 이는 뒤에 (한 회의에서 두 번 말하는 것은 자연스럽다)
    const rseats = [...seats.filter((h) => !used.has(h.id)), ...seats.filter((h) => used.has(h.id))]
    const readOf = (h: Hero): { ap: Approach | null; line: string } => {
      if (h.ryak < P.realm.cnReadRyak || topW === null) return { ap: null, line: '' }
      const gs = GUARD_SAY[topW.ap]
      return { ap: topW.ap, line: `${gs[pickIdx(`${h.id}:guard:${r.season}`, gs.length)]} ${WHY_SAY[topW.why](foe, fc?.name ?? null)} ` }
    }
    // 지난 싸움의 길 — 그 싸움을 겪은 이가 먼저(그 길로 이겼다), 없으면 나라의 장부로 (형 10-30: "지난번 ~~ 싸움에서 승리한 대로 대로로 가자")
    const nf = nationRouteFacts(r, me, def)
    let recall: { h: Hero; f: RouteFact } | null = null
    for (const h of rseats) {
      const f = heroRouteFact(r, h.id, def)
      if (f !== null && f.won && has(f.ap) && !(timid(h) && f.ap === 'cliff')) { recall = { h, f }; break }
    }
    if (recall === null && nf.best !== null && has(nf.best.ap)) {
      const nb = nf.best
      const h = rseats.find((x) => !(timid(x) && nb.ap === 'cliff'))
      if (h !== undefined) recall = { h, f: nb }
    }
    if (recall !== null) {
      const ask = RECALL_ASK[pickIdx(`${recall.h.id}:recall:${r.season}`, RECALL_ASK.length)]!
      add({ hero: recall.h, label: AP_LABEL[recall.f.ap], move: 'recall', line: sageuk(`${recall.f.line} ${fill(ask, { ap: AP_NAME[recall.f.ap], there })}`), opt: { k: 'route', ap: recall.f.ap } }, recall.f.ap)
    }
    // 특성으로 나서는 이 — 겁쟁이가 아니고, 그 길이 열려 있고, 읽은 대로 해 볼 만하고, 이끌거나 이끌 수 있을 때 (앞서 말했어도 나선다)
    for (const h of seats) {
      if (hasTrait(h, 'coward')) continue
      const vol = VOLUNTEER.find((v) => hasTrait(h, v.trait) && has(v.ap))
      if (vol === undefined) continue
      if (q(vol.ap, readOf(h).ap) < P.realm.cnAdviseMin) continue
      const leads = h.id === a.hero
      if (!leads && !ctx.canLead(h.id)) continue
      const ask = askOf(h)[leads ? 'leads' : 'lead']
      const line = sageuk(`${vol.intro[pickIdx(`${h.id}:vol:${r.season}`, vol.intro.length)]} ${fill(ask[pickIdx(`${h.id}:ask:${r.season}`, ask.length)]!, { ap: AP_NAME[vol.ap], there })}`)
      add({ hero: h, label: `${AP_LABEL[vol.ap]}${leads ? '' : ` · ${josa(h.name, '이', '가')} 이끈다`}`, move: 'volunteer', line, opt: { k: 'route', ap: vol.ap, ...(leads ? {} : { lead: h.id }) } }, vol.ap)
      break
    }
    for (const h of rseats) {
      if (voices.length >= 3) break
      if (voices.some((v) => v.hero?.id === h.id)) continue
      const rd = readOf(h)
      // 숨는 길 가운데 읽은 대로 가장 잘 숨는 것
      let sneak: Approach | null = null
      let sp = -1
      for (const x of moves) if (x.ap !== 'road' && q(x.ap, rd.ap) > sp) { sp = q(x.ap, rd.ap); sneak = x.ap }
      const sneakOk = sneak !== null && sp >= P.realm.cnAdviseMin
      const strong = m.win !== null && m.win[0] >= 0.5
      if (bold(h) && has('road') && (strong || m.win === null)) {
        // 거친 이는 대로 — 판세를 알면 「우리가 세다」, 모르면 「모르니 정면」
        add({ hero: h, label: '대로로', move: strong ? 'roadStrong' : 'roadBlind', line: say(h, strong ? 'roadStrong' : 'roadBlind'), opt: { k: 'route', ap: 'road' } }, 'road')
      } else if (!sneakOk) {
        if (has('road')) add({ hero: h, label: '대로로', move: 'roadSafe', line: say(h, 'roadSafe', { read: rd.line }), opt: { k: 'route', ap: 'road' } }, 'road')
      } else {
        const mv: SayMove = rd.ap === null ? 'sneakBlind' : rd.ap === sneak ? 'sneakSame' : 'sneakRead'
        add({ hero: h, label: AP_LABEL[sneak!], move: mv, line: say(h, mv, { read: rd.line, ap: AP_NAME[sneak!] }), opt: { k: 'route', ap: sneak! } }, sneak!)
      }
    }
    // 진 길의 까닭 — 다른 길을 권하는 이가 그 일을 든다: 제가 겪었으면 제 일로, 아니면 나라의 장부로 한 번
    let nationLossSaid = false
    let citedLoss: Approach | null = null
    for (let i = 0; i < voices.length; i++) {
      const v = voices[i]!
      if (v.hero === null || v.move === 'recall' || v.opt.k !== 'route') continue
      const ap = v.opt.ap
      const own = heroRouteFact(r, v.hero.id, def)
      const f = own !== null && !own.won && own.ap !== ap ? own : !nationLossSaid && nf.worst !== null && nf.worst.ap !== ap ? nf.worst : null
      if (f === null) continue
      if (!f.own) nationLossSaid = true
      citedLoss ??= f.ap
      voices[i] = { ...v, line: withWhy(f.line, v.line) }
    }
    // 모두 한 길을 권하는데 진 길을 들었으면 — 군주가 그래도 그 길로 갈 수 있게 곁에 (진 일이 보여야 고를 거리가 된다)
    if (voices.length === 1 && citedLoss !== null && has(citedLoss) && voices[0]!.opt.k === 'route' && voices[0]!.opt.ap !== citedLoss) {
      voices.push({ hero: null, label: AP_LABEL[citedLoss], line: `그래도 ${josa(AP_NAME[citedLoss], '으로', '로')} 간다`, opt: { k: 'route', ap: citedLoss } })
    }
    // 말이 하나뿐이고 숨는 길이면 — 군주의 대로를 곁에 (갈리지 않으면 회의가 아니다)
    if (voices.length === 1 && voices[0]!.opt.k === 'route' && voices[0]!.opt.ap !== 'road' && has('road')) voices.push({ hero: null, label: '대로로', line: '숨지 않는다: 대로로 간다', opt: { k: 'route', ap: 'road' } })
    if (voices.length >= 2) out.push({ id: 'route', title: '어느 길로 갈까', voices })
  }

  // ④ 군량 — 성이 굳거나 길이 멀면 더 챙기자 · 국고가 빠듯하면 그대로
  const now = ctx.rationNow
  const more = Math.min(P.realm.rationMaxExtra, now + 1)
  if ((m.walled || m.seasons >= 2) && more > now && ctx.rationCost(more) <= ctx.grain) {
    // 아직 말하지 않은 이 가운데 내정이 가장 높은 이 — 다 말했으면 모두 가운데
    const steward = best(seats.filter((h) => !used.has(h.id)), (h) => h.chi) ?? best(seats, (h) => h.chi)
    if (steward !== undefined) {
      const mv: SayMove = m.walled ? 'rationWall' : 'rationFar'
      const tight = ctx.grain - ctx.rationCost(more) < ctx.rationCost(more)
      const rv = { rnow: `${m.seasons + now}계절치`, rmore: `${m.seasons + more}계절치`, rcost: `${Math.max(0, ctx.rationCost(more) - ctx.rationCost(now)).toLocaleString('ko-KR')}` }
      used.add(steward.id)
      const voices: Voice[] = [{ hero: steward, label: '군량을 더', move: mv, how: 'more', line: say(steward, mv, rv), opt: { k: 'ration', extra: more } }]
      // 맞서는 말 — 국고가 빠듯하면 「곳간을 아끼자」, 아니면 「이 길이면 지금 것으로 넉넉하다」(아직 말하지 않은 이 먼저)
      const others = seats.filter((h) => h.id !== steward.id)
      const fresh = others.filter((h) => !used.has(h.id))
      const frugal = best(fresh.length > 0 ? fresh : others, (h) => h.chi + (hasTrait(h, 'farmer') || hasTrait(h, 'trader') ? 3 : 0))
      const fmv: SayMove = tight ? 'rationFrugal' : 'rationEnough'
      voices.push(frugal !== undefined
        ? { hero: frugal, label: '군량은 그대로', move: fmv, how: 'same', line: say(frugal, fmv, rv), opt: { k: 'ration', extra: now } }
        : { hero: null, label: '군량은 그대로', how: 'same', line: '지금 챙긴 만큼으로 간다', opt: { k: 'ration', extra: now } })
      out.push({ id: 'ration', title: '군량을 얼마나 챙길까', voices })
    }
  }
  return recallCouncil(r, out)
}

/**
 * 지난 회의 — 장수마다 처음 말할 때 한 번: 지난번 그 장수의 말을 따라 잘 됐으면 「지난번 소장의 말대로 …」(금빛 테),
 * 빗나갔으면 머뭇거리는 말을 앞에 붙인다 (형 10-30: "캐릭터가 사람처럼 기억하는 듯")
 */
function recallCouncil(r: Realm, ags: Agenda[]): Agenda[] {
  const seen = new Set<string>()
  return ags.map((ag) => ({
    ...ag,
    voices: ag.voices.map((v) => {
      if (v.hero === null) return v
      const f = councilFact(r, v.hero)
      if (f === null) return v
      const first = !seen.has(v.hero.id)
      seen.add(v.hero.id)
      return { ...v, ...(f.proven ? { proven: true } : { doubt: true }), ...(first ? { line: withWhy(f.line, v.line) } : {}) }
    }),
  }))
}

/** 회의가 건 것 — 떠나지 않음(기다림 · 거둠 · 공작 먼저) · 먼저 걸 공작과 보낼 이 · 두 갈래의 다른 군대 */
export interface CouncilPlan {
  readonly wait?: boolean
  readonly plot?: { readonly op: 'burn' | 'sow'; readonly target: string; readonly other?: string; readonly agent: string | null }
  readonly pincer?: { readonly army: string; readonly edge: string }
}

/** 한 번 누름 — 그 안건이 전에 건 것(공작 · 두 갈래)을 거두고 새로 건다. 군사 · 길 · 군량은 화면이 출정 판에 바로 건다 (app.applyVoice) */
export function planChoice(p: CouncilPlan, v: Voice, ag: AgendaId): CouncilPlan {
  const o = v.opt
  const { plot, pincer, wait } = p
  let next: CouncilPlan = {
    ...(wait !== undefined ? { wait } : {}),
    ...(plot !== undefined && ag !== 'ally' && ag !== 'plot' ? { plot } : {}),
    ...(pincer !== undefined && ag !== 'pincer' ? { pincer } : {}),
  }
  if (o.k === 'pincer') next = { ...next, pincer: { army: o.army, edge: o.edge } }
  else if (o.k === 'plot') next = { ...next, wait: true, plot: { op: o.op, target: o.target, ...(o.other !== undefined ? { other: o.other } : {}), agent: o.agent } }
  else if (o.k === 'wait' || o.k === 'hold' || o.k === 'go') next = { ...next, wait: o.k !== 'go' }
  return next
}

/**
 * 「결정」 — 회의가 건 것을 명령으로: 떠나지 않으면 먼저 걸 공작, 떠나면 두 갈래의 다른 군대의 출정(같은 계절에 닿는 다른 길 · 대로).
 * 그리고 들은 안(said — 장수마다 안의 종류 · 따랐나)을 council 명령으로 — 장수의 기억에 적힌다 (memory.noteMemory).
 * 이 군대 자신의 출정(march)은 화면이 군사·길·군량과 함께 낸다.
 */
export function planOrders(r: Realm, me: string, a: Army, edge: string, p: CouncilPlan, said: ReadonlyArray<{ readonly hero: string; readonly how: string; readonly took: boolean }>): Order[] {
  const ed = r.edges[edge]
  const at = ed !== undefined ? otherEnd(ed, a.at) : null
  const foe = at !== null ? r.nodes[at]?.owner ?? null : null
  const out: Order[] = []
  if (p.wait === true && p.plot !== undefined) {
    const pl = p.plot
    out.push({ kind: 'plot', faction: me, op: pl.op, target: pl.target, ...(pl.other !== undefined ? { other: pl.other } : {}), ...(pl.agent !== null ? { agent: pl.agent } : {}) })
  }
  if (p.wait !== true && p.pincer !== undefined) {
    const b = r.armies[p.pincer.army]
    if (b !== undefined && b.faction === me && b.march === null && b.id !== a.id) out.push({ kind: 'march', army: b.id, edge: p.pincer.edge, ambush: false, approach: 'road' })
  }
  if (at !== null && foe !== null && foe !== me && said.length > 0) out.push({ kind: 'council', faction: me, foe, at, said: [...said] })
  return out
}
