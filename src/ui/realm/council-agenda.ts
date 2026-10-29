/**
 * 전략 회의의 안건 — 장수들이 저마다 제 생각을 펴고, 군주가 안건마다 하나를 고른다 (형 10-29: "장수 얼굴이 나오고 하나씩 대사 치듯 ·
 * 이 고을에 가까운 타국 고을이 있어 다 비우면 위험하니 7할만 · 적의 경계가 강해 기습은 위험하니 대로로 · ○○국은 호전적이니 먼저 치게 두고 ·
 * 저는 밤눈이 밝아 기습에 능하니 저를 믿고 맡겨 주십시오 · 충돌하지 않는 안건도, 충돌하는 안건도 · 마지막에 한 번 누르면 다 이루어지게").
 *
 * 안건 넷 — 때(지금 칠까 기다릴까) · 군사(다 데려갈까 남겨 둘까) · 길(어느 길로 · 누가 이끄나) · 군량. 판의 사정이 걸릴 때만 선다.
 * 한 안건 안의 말은 서로 갈린다(하나만 고른다). 안건끼리는 겹치지 않는다(때를 「기다린다」로 고르면 나머지는 쓰이지 않는다).
 * 모든 장수는 군주에게 '합니다'로 아뢴다 — 결은 말투의 높낮이가 아니라 덧붙이는 한마디로 낸다.
 * 판에는 손대지 않는다(읽기만). 이름 뒤 조사는 josa().
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
import { voiceKind, type VoiceKind } from './voice.ts'

/** 고르면 출정 판에 무엇이 걸리나 */
export type Choice =
  | { readonly k: 'take'; readonly share: number }
  | { readonly k: 'route'; readonly ap: Approach; readonly lead?: string }
  | { readonly k: 'ration'; readonly extra: number }
  | { readonly k: 'wait' }
  | { readonly k: 'go' }

export interface Voice {
  /** 말한 장수 — null 이면 군주 스스로의 뜻(얼굴 없는 단추) */
  readonly hero: Hero | null
  /** 아뢰는 말 (두세 문장) */
  readonly line: string
  /** 고르면 붙는 짧은 이름 — 아래 결정 띠에 */
  readonly label: string
  readonly opt: Choice
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

/** 결마다 덧붙이는 한마디 — 높임은 같고 결만 다르다 · [권할 때, 나설 때, 두 번째로 권할 때] (같은 이가 두 번 말하면 다른 마무리) */
const TAIL: Readonly<Record<VoiceKind, readonly [string, string, string]>> = {
  'm-gruff': ['제 말이 틀림없습니다.', '제 창이 앞장서겠습니다.', '길게 따질 일이 아닙니다.'],
  'm-young': ['그리하시는 것이 옳습니다!', '맡겨만 주십시오!', '부디 제 말을 들어 주십시오!'],
  'm-sage': ['깊이 헤아려 주십시오.', '셈으로 보아도 그러합니다.', '서두르실 일이 아닙니다.'],
  'm-elder': ['이 늙은 몸의 소견입니다.', '오래 싸워 본 자의 말씀이니 새겨 주십시오.', '젊은 혈기로 정하실 일이 아닙니다.'],
  'm-charm': ['보기에도 좋고 셈에도 맞습니다.', '그리하면 저들이 먼저 겁을 먹을 겁니다.', '백성들도 그리 바랄 것입니다.'],
  'w-bright': ['꼭 그리하셔야 합니다!', '저를 믿어 주십시오!', '제 말이 맞을 겁니다!'],
  'w-cool': ['더 말씀드릴 것은 없습니다.', '그것으로 족합니다.', '그리하십시오.'],
  'w-sly': ['셈이 빠른 쪽이 이깁니다.', '저들은 눈치채지 못할 겁니다.', '손해 볼 일은 없습니다.'],
  'w-shaman': ['신령의 뜻도 그러합니다.', '하늘이 그리 일러 주었습니다.', '조상께서도 그리 이르십니다.'],
}

const AP_NAME: Readonly<Record<Approach, string>> = { road: '대로', night: '밤길', ford: '여울', ridge: '산기슭', cliff: '절벽' }
/** 결정 띠의 짧은 길 이름 */
export const APPROACH_SHORT = AP_NAME
/** 고른 안의 짧은 이름 */
const AP_LABEL: Readonly<Record<Approach, string>> = { road: '대로로', night: '밤길로', ford: '여울로', ridge: '산기슭으로', cliff: '절벽으로' }
/** 적이 지킬 길목을 읽은 말 */
const GUARD_SAY: Readonly<Record<Approach, string>> = {
  road: '적은 대로를 막고 성문 앞에 진을 칠 것입니다.',
  night: '적은 밤 경계를 겹겹이 세울 것입니다.',
  ford: '적은 여울목에 군사를 둘 것입니다.',
  ridge: '적은 산기슭 길목을 지킬 것입니다.',
  cliff: '적은 절벽 위를 지킬 것입니다.',
}
/** 그 길목을 지킬 까닭 — 읽은 장수가 함께 말한다 */
const WHY_SAY: Readonly<Record<GuardWhy, (foe: string) => string>> = {
  repeat: () => '지난번에도 우리가 그 길로 들었으니 저들도 기억할 것입니다.',
  trait: () => '저쪽 장수의 버릇이 그러합니다.',
  mind: (foe) => `${josa(foe, '은', '는')} 성향이 그러한 나라입니다.`,
  land: () => '땅의 생김이 그곳을 지키게 되어 있습니다.',
}
/** 특성으로 나서는 말 — 그 길을 맡겠다 */
const VOLUNTEER: ReadonlyArray<{ trait: string; ap: Approach; say: string }> = [
  { trait: 'nighteye', ap: 'night', say: '저는 밤눈이 밝아 어둠 속에서도 적의 보초를 먼저 찾아낼 수 있습니다.' },
  { trait: 'river', ap: 'ford', say: '저는 물길을 압니다. 여울의 얕은 곳을 골라 소리 없이 건널 수 있습니다.' },
  { trait: 'mountain', ap: 'ridge', say: '저는 산에서 자랐습니다. 짐승길을 따라 적의 뒤로 돌아 들 수 있습니다.' },
]

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

/** 거친 이 — 밀어붙이자는 쪽 */
const bold = (h: Hero): boolean => voiceKind(h) === 'm-gruff' || voiceKind(h) === 'w-bright' || h.mu >= 8
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

/**
 * 이 출정의 안건들 — 적 고을을 칠 때만. 안건마다 말이 둘 이상(장수 둘, 또는 장수 하나와 군주의 뜻)일 때만 선다.
 * m · moves 는 출정할 무리의 힘으로 셈한 것 (app.sortieProbe)
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
  // 같은 장수가 두 번 권하면 마무리를 바꾼다
  const spoke = new Map<string, number>()
  const tail = (h: Hero, i: 0 | 1): string => {
    const t = TAIL[voiceKind(h)]
    if (i === 1) return t[1]
    const n = spoke.get(h.id) ?? 0
    spoke.set(h.id, n + 1)
    return n % 2 === 0 ? t[0] : t[2]
  }
  const pickSeat = (f: (h: Hero) => number, ok: (h: Hero) => boolean = () => true): Hero | undefined => {
    const h = best(seats.filter((x) => !used.has(x.id) && ok(x)), f)
    if (h !== undefined) used.add(h.id)
    return h
  }

  // ① 때 — 호전적인 나라가 우리 땅 곁에 큰 군사를 두었으면, 먼저 치게 두고 성에서 맞아 힘을 뺀 뒤에 치자
  const near = new Map<string, number>()
  for (const n of Object.values(r.nodes)) {
    if (n.owner !== me) continue
    for (const t of threatsNear(r, me, n.id)) if (t.faction === def) near.set(t.at, Math.max(near.get(t.at) ?? 0, t.men))
  }
  const foeMen = [...near.values()].reduce((s, n) => s + n, 0)
  if (r.factions[def]?.mind === 'greedy' && foeMen >= ours * P.realm.cnWaitFoe) {
    const wise = pickSeat((h) => h.ryak, (h) => h.ryak >= P.realm.cnReadRyak)
    if (wise !== undefined) {
      const voices: Voice[] = [{
        hero: wise, label: '기다린다',
        line: `${josa(foe, '은', '는')} 호전적인 나라입니다. 우리 땅 곁에 ${josa(sizeWord(foeMen, ours), '을', '를')} 모아 두었으니 머지않아 저들이 먼저 칠 것입니다. 이번 계절은 성을 지키며 저들이 힘을 빼게 두고, 지친 뒤에 치시지요. ${tail(wise, 0)}`,
        opt: { k: 'wait' },
      }]
      const hot = pickSeat((h) => h.mu, bold)
      voices.push(hot !== undefined
        ? { hero: hot, label: '지금 친다', line: `기다리면 저들이 먼저 채비를 마칩니다. 저들이 아직 모이기 전인 지금이 ${josa(there, '을', '를')} 칠 때입니다. ${tail(hot, 1)}`, opt: { k: 'go' } }
        : { hero: null, label: '지금 친다', line: '기다리지 않는다 — 이번 계절에 친다', opt: { k: 'go' } })
      out.push({ id: 'wait', title: '지금 칠까, 기다릴까', voices })
    }
  }

  // ② 군사 — 이 고을 곁에 남의 군사가 있으면 다 비우지 말자 (같은 고을에 남는 우리 군대가 있으면 걱정 없다)
  const stay = Object.values(r.armies).some((x) => x.faction === me && x.id !== a.id && x.at === a.at && x.march === null)
  const th = stay ? [] : threatsNear(r, me, a.at, m.to)
  if (th.length > 0) {
    const t = th[0]!
    const tf = r.factions[t.faction]?.name ?? ''
    const tn = r.nodes[t.at]?.name ?? ''
    const keepPct = Math.round((1 - P.realm.cnKeepTake) * 10)
    const takePct = 10 - keepPct
    const careful = pickSeat((h) => h.tong + (bold(h) ? -5 : 0))
    if (careful !== undefined) {
      const voices: Voice[] = [{
        hero: careful, label: `${takePct}할만 데려간다`,
        line: `${tf}의 ${tn}에 ${josa(sizeWord(t.men, ours), '이', '가')} 머물고 있습니다. 군사를 모두 데려가면 ${josa(here, '이', '가')} 텅 비어 그들에게 내주게 됩니다. ${takePct}할만 데려가시고 ${keepPct}할은 남겨 지키게 하시지요. ${tail(careful, 0)}`,
        opt: { k: 'take', share: P.realm.cnKeepTake },
      }]
      const close = m.win === null || m.win[0] < P.realm.cnCloseOdds
      const hot = close ? pickSeat((h) => h.mu, bold) : undefined
      voices.push(hot !== undefined
        ? { hero: hot, label: '모두 데려간다', line: `${there}의 수비가 만만치 않습니다. 군사를 나누면 이기기 어렵습니다. 모두 데려가 단번에 무너뜨려야 합니다. ${tail(hot, 0)}`, opt: { k: 'take', share: 1 } }
        : { hero: null, label: '모두 데려간다', line: '나누지 않는다 — 군사를 모두 데려간다', opt: { k: 'take', share: 1 } })
      out.push({ id: 'keep', title: '군사를 얼마나 데려갈까', voices })
    }
  }

  // ③ 길 — 저마다 제 길. 읽은 장수는 적이 지킬 길목과 그 까닭을, 특성이 있는 장수는 그 길을 맡겠다고 나선다
  if (moves.length >= 2) {
    const ws = guardWeights(r, m.to, def, me, foeCmd(r, m.to, def))
    const topW = ws.length > 1 ? [...ws].sort((x, y) => y.w - x.w)[0]! : null
    const q = (ap: Approach, read: Approach | null): number => {
      const x = moves.find((y) => y.ap === ap)
      return x === undefined || ap === 'road' ? 0 : read === null ? x.p : guardAdjust(x.p, ap, read)
    }
    const has = (ap: Approach): boolean => moves.some((x) => x.ap === ap)
    const voices: Voice[] = []
    const said = new Set<Approach>()
    const add = (v: Voice, ap: Approach): void => { if (!said.has(ap)) { said.add(ap); voices.push(v) } }
    const rseats = seats.filter((h) => !used.has(h.id) || h.id === a.hero)
    // 특성으로 나서는 이 — 그 길이 열려 있고 읽은 대로 해 볼 만하면
    for (const h of rseats) {
      const vol = VOLUNTEER.find((v) => hasTrait(h, v.trait) && has(v.ap))
      if (vol === undefined) continue
      const read = h.ryak >= P.realm.cnReadRyak && topW !== null ? topW.ap : null
      if (q(vol.ap, read) < P.realm.cnAdviseMin) continue
      const leads = h.id === a.hero
      const lead = !leads && ctx.canLead(h.id) ? h.id : undefined
      const ask = leads ? `제가 앞장서 ${AP_LABEL[vol.ap]} 이끌겠습니다.` : lead !== undefined ? `저를 믿고 이 군사를 맡겨 주십시오. ${AP_LABEL[vol.ap]} 데려가겠습니다.` : `제 말대로 ${AP_LABEL[vol.ap]} 가십시오.`
      add({ hero: h, label: `${AP_LABEL[vol.ap]}${lead !== undefined ? ` · ${josa(h.name, '이', '가')} 이끈다` : ''}`, line: `${vol.say} ${ask} ${tail(h, 1)}`, opt: { k: 'route', ap: vol.ap, ...(lead !== undefined ? { lead } : {}) } }, vol.ap)
      break
    }
    for (const h of rseats) {
      if (voices.length >= 3) break
      if (voices.some((v) => v.hero?.id === h.id)) continue
      const reads = h.ryak >= P.realm.cnReadRyak && topW !== null
      const read = reads ? topW!.ap : null
      // 숨는 길 가운데 읽은 대로 가장 잘 숨는 것
      let sneak: Approach | null = null
      let sp = -1
      for (const x of moves) if (x.ap !== 'road' && q(x.ap, read) > sp) { sp = q(x.ap, read); sneak = x.ap }
      const readLine = reads ? `${GUARD_SAY[read!]} ${WHY_SAY[topW!.why](foe)}` : '적이 어디를 지킬지는 저로서는 알 수 없습니다.'
      if ((bold(h) && has('road') && (m.win === null || m.win[0] >= 0.5)) || sneak === null || sp < P.realm.cnAdviseMin) {
        // 대로 — 우리가 세서, 또는 숨는 길이 다 위험해서
        const why = sneak !== null && sp < P.realm.cnAdviseMin
          ? `${reads ? readLine + ' ' : ''}적의 경계가 단단하여 숨어 가다 들키면 크게 꺾입니다. 대로로 당당히 가 정면에서 겨루어야 합니다.`
          : `우리 군세가 저들보다 큽니다. 숨을 까닭 없이 대로로 밀고 들어가면 됩니다.`
        if (has('road')) add({ hero: h, label: '대로로', line: `${why} ${tail(h, 0)}`, opt: { k: 'route', ap: 'road' } }, 'road')
      } else {
        const line = reads
          ? (read === sneak
            ? `${readLine} 그래도 ${AP_NAME[sneak]} 말고는 숨을 길이 없으니 해 볼 만합니다.`
            : `${readLine} 그렇다면 ${josa(AP_NAME[sneak], '이', '가')} 비어 있을 터이니 ${AP_LABEL[sneak]} 들어가시지요.`)
          : `${readLine} 다만 땅으로 보아 ${josa(AP_NAME[sneak], '이', '가')} 가장 숨기 좋은 길입니다.`
        add({ hero: h, label: AP_LABEL[sneak], line: `${line} ${tail(h, 1)}`, opt: { k: 'route', ap: sneak } }, sneak)
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
      const why = m.walled ? `${josa(there, '은', '는')} 성이 굳어 쉽게 떨어지지 않을 것입니다. 싸움이 길어지면 군량이 먼저 바닥납니다.` : `${there}까지 ${m.seasons}계절이 걸립니다. 길이 멀면 군량이 먼저 바닥납니다.`
      const tight = ctx.grain - ctx.rationCost(more) < ctx.rationCost(more)
      const voices: Voice[] = [{ hero: steward, label: '군량을 더', line: `${why} 군량을 한 계절치 더 챙기시지요. ${tail(steward, 0)}`, opt: { k: 'ration', extra: more } }]
      const frugal = tight ? best(seats.filter((h) => h.id !== steward.id), (h) => h.chi) : undefined
      voices.push(frugal !== undefined
        ? { hero: frugal, label: '군량은 그대로', line: `국고의 곡식이 넉넉지 않습니다. 더 챙기면 백성이 굶습니다. 지금 챙긴 만큼으로 가시지요. ${tail(frugal, 0)}`, opt: { k: 'ration', extra: now } }
        : { hero: null, label: '군량은 그대로', line: '지금 챙긴 만큼으로 간다', opt: { k: 'ration', extra: now } })
      out.push({ id: 'ration', title: '군량을 얼마나 챙길까', voices })
    }
  }
  return out
}
