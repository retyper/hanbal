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
import type { ApproachMove, Move } from '../../realm/estimate.ts'
import { hasTrait, isRuler } from '../../realm/heroes.ts'
import { forceOf, otherEnd } from '../../realm/season.ts'
import type { Approach, Army, Hero, Realm } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { fill, pickIdx, sayOf, VOLUNTEER, VOLUNTEER_ASK, type Move as SayMove } from './council-says.ts'
import { voiceKind } from './voice.ts'

/** 고르면 출정 판에 무엇이 걸리나 */
export type Choice =
  | { readonly k: 'take'; readonly share: number }
  | { readonly k: 'route'; readonly ap: Approach; readonly lead?: string }
  | { readonly k: 'ration'; readonly extra: number }
  | { readonly k: 'wait' }
  | { readonly k: 'go' }

export interface Voice {
  /** 말한 장수 — null 이면 군주 스스로의 뜻(얼굴 없는 카드) */
  readonly hero: Hero | null
  /** 아뢰는 말 (두세 문장) */
  readonly line: string
  /** 고르면 붙는 짧은 이름 — 결정 카드 · 정리 */
  readonly label: string
  readonly opt: Choice
  /** 어느 처지의 말인가 (시험 · 말이 그 사람다운지 본다) */
  readonly move?: SayMove | 'volunteer'
}

export type AgendaId = 'wait' | 'keep' | 'route' | 'ration'
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
  && (voiceKind(h) === 'm-gruff' || voiceKind(h) === 'm-young' || voiceKind(h) === 'w-bright' || hasTrait(h, 'drinker') || hasTrait(h, 'hundred') || hasTrait(h, 'ironhand') || h.mu >= 8)
/** 차분한 이 — 기다리자 · 남겨 두자는 쪽에 더 어울린다 */
const calm = (h: Hero): boolean => timid(h) || hasTrait(h, 'steadfast') || ['m-sage', 'm-elder', 'w-cool', 'w-shaman'].includes(voiceKind(h))
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

/**
 * 이 출정의 안건들 — 적 고을을 칠 때만. 안건마다 말이 둘 이상(장수 둘, 또는 장수 하나와 군주의 뜻)일 때만 선다.
 * a 는 군대 전부 · m · moves 는 출정할 무리의 힘으로 셈한 것 (app.sortieProbe)
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
  const pickSeat = (f: (h: Hero) => number, ok: (h: Hero) => boolean = () => true): Hero | undefined => {
    const h = best(seats.filter((x) => !used.has(x.id) && ok(x)), f)
    if (h !== undefined) used.add(h.id)
    return h
  }
  const base = { foe, here, there, seasons: `${m.seasons}계절` }
  const say = (h: Hero, move: SayMove, v: Readonly<Record<string, string>> = {}): string => sayOf(h, move, { ...base, ...v }, r.season)

  // ① 때 — 호전적인 나라가 우리 땅 곁에 큰 군사를 두었으면, 먼저 치게 두고 성에서 맞아 힘을 뺀 뒤에 치자
  const near = new Map<string, number>()
  for (const n of Object.values(r.nodes)) {
    if (n.owner !== me) continue
    for (const t of threatsNear(r, me, n.id)) if (t.faction === def) near.set(t.at, Math.max(near.get(t.at) ?? 0, t.men))
  }
  const foeMen = [...near.values()].reduce((s, n) => s + n, 0)
  if (r.factions[def]?.mind === 'greedy' && foeMen >= ours * P.realm.cnWaitFoe) {
    const wise = pickSeat((h) => h.ryak + (calm(h) ? 2 : 0) - (bold(h) ? 2 : 0), (h) => h.ryak >= P.realm.cnReadRyak)
    if (wise !== undefined) {
      const voices: Voice[] = [{ hero: wise, label: '기다린다', move: 'waitAdvise', line: say(wise, 'waitAdvise', { size: sizeWord(foeMen, ours) }), opt: { k: 'wait' } }]
      const hot = pickSeat((h) => h.mu, bold)
      voices.push(hot !== undefined
        ? { hero: hot, label: '지금 친다', move: 'waitAgainst', line: say(hot, 'waitAgainst'), opt: { k: 'go' } }
        : { hero: null, label: '지금 친다', line: '기다리지 않는다 — 이번 계절에 친다', opt: { k: 'go' } })
      out.push({ id: 'wait', title: '지금 칠까, 기다릴까', voices })
    }
  }

  // ② 군사 — 이 고을 곁에 남의 군사가 있으면 다 비우지 말자 (같은 고을에 남는 우리 군대가 있으면 걱정 없다 · 나눌 수 없으면 안 낸다)
  const stay = Object.values(r.armies).some((x) => x.faction === me && x.id !== a.id && x.at === a.at && x.march === null)
  const go = takeCount(a, P.realm.cnKeepTake)
  const canSplit = go >= P.realm.splitMin && ours - go >= P.realm.splitMin && Object.values(r.armies).filter((x) => x.faction === me).length < P.realm.armyMax
  const th = stay || !canSplit ? [] : threatsNear(r, me, a.at, m.to)
  if (th.length > 0) {
    const t = th[0]!
    const keepPct = Math.round((1 - P.realm.cnKeepTake) * 10)
    const careful = pickSeat((h) => h.tong + (calm(h) ? 3 : 0) - (bold(h) ? 5 : 0) - (hasTrait(h, 'drinker') ? 3 : 0))
    if (careful !== undefined) {
      const v = { tf: r.factions[t.faction]?.name ?? '', tn: r.nodes[t.at]?.name ?? '', size: sizeWord(t.men, ours), take: `${10 - keepPct}할`, keep: `${keepPct}할` }
      const voices: Voice[] = [{ hero: careful, label: `${10 - keepPct}할만 데려간다`, move: 'keepAdvise', line: say(careful, 'keepAdvise', v), opt: { k: 'take', share: P.realm.cnKeepTake } }]
      const close = m.win === null || m.win[0] < P.realm.cnCloseOdds
      const hot = close ? pickSeat((h) => h.mu, bold) : undefined
      voices.push(hot !== undefined
        ? { hero: hot, label: '모두 데려간다', move: 'keepAgainst', line: say(hot, 'keepAgainst'), opt: { k: 'take', share: 1 } }
        : { hero: null, label: '모두 데려간다', line: '나누지 않는다 — 군사를 모두 데려간다', opt: { k: 'take', share: 1 } })
      out.push({ id: 'keep', title: '군사를 얼마나 데려갈까', voices })
    }
  }

  // ③ 길 — 저마다 제 길. 읽은 장수는 적이 지킬 길목과 그 까닭을, 특성이 있는 장수는 그 길을 맡겠다고 나선다
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
    // 특성으로 나서는 이 — 겁쟁이가 아니고, 그 길이 열려 있고, 읽은 대로 해 볼 만하고, 이끌거나 이끌 수 있을 때 (앞서 말했어도 나선다)
    for (const h of seats) {
      if (hasTrait(h, 'coward')) continue
      const vol = VOLUNTEER.find((v) => hasTrait(h, v.trait) && has(v.ap))
      if (vol === undefined) continue
      if (q(vol.ap, readOf(h).ap) < P.realm.cnAdviseMin) continue
      const leads = h.id === a.hero
      if (!leads && !ctx.canLead(h.id)) continue
      const ask = VOLUNTEER_ASK[voiceKind(h)][leads ? 'leads' : 'lead']
      const line = `${vol.intro[pickIdx(`${h.id}:vol:${r.season}`, vol.intro.length)]} ${fill(ask[pickIdx(`${h.id}:ask:${r.season}`, ask.length)]!, { ap: AP_NAME[vol.ap] })}`
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
    // 말이 하나뿐이고 숨는 길이면 — 군주의 대로를 곁에 (갈리지 않으면 회의가 아니다)
    if (voices.length === 1 && voices[0]!.opt.k === 'route' && voices[0]!.opt.ap !== 'road' && has('road')) voices.push({ hero: null, label: '대로로', line: '숨지 않는다 — 대로로 간다', opt: { k: 'route', ap: 'road' } })
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
      const voices: Voice[] = [{ hero: steward, label: '군량을 더', move: mv, line: say(steward, mv), opt: { k: 'ration', extra: more } }]
      const frugal = tight ? best(seats.filter((h) => h.id !== steward.id), (h) => h.chi + (hasTrait(h, 'farmer') || hasTrait(h, 'trader') ? 3 : 0)) : undefined
      voices.push(frugal !== undefined
        ? { hero: frugal, label: '군량은 그대로', move: 'rationFrugal', line: say(frugal, 'rationFrugal'), opt: { k: 'ration', extra: now } }
        : { hero: null, label: '군량은 그대로', line: '지금 챙긴 만큼으로 간다', opt: { k: 'ration', extra: now } })
      out.push({ id: 'ration', title: '군량을 얼마나 챙길까', voices })
    }
  }
  return out
}
