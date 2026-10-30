/**
 * 회의의 까닭 — 장수의 기억 · 나라의 전례 장부에서 사실을 골라 한 마디로 (docs/realm/MEMORY.md §3-2 1 · 형 10-30:
 * "지난번 '~~ 싸움'에서 승리한 대로 대로로 가자 · 지난번 패배를 통해 알게 된 바 3할 정도는 군대를 남겨 놓고 가는 게 좋겠다 아니면 오히려 전부 출정").
 *
 *  - 그 일을 겪은 장수가 먼저다(Hero.mem) — 없으면 나라의 장부(r.lessons)로 「우리가 …」.
 *  - 사실이 없으면 빈 말('') — 회의는 지금 말 그대로.
 *  - cnMemAge 계절보다 오래된 일은 말하지 않는다.
 *  - 말은 '합니다'로 끝난다 (회의 말과 함께 sageuk 이 사극 말투로 바꾼다). 바뀌는 낱말 뒤 조사는 josa 로만.
 * 판을 읽기만 한다.
 */
import { seasonOf } from '../../realm/calendar.ts'
import { josa, SEASON_NAME } from '../../realm/data/prose.ts'
import { bestRouteVs, councilRecord, heroBattlesVs, heroPlotVs, heroSplit, lastBattleVs, plotBeforeWin, splitLesson, worstRouteVs } from '../../realm/memory.ts'
import type { Approach, Hero, Realm } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { voiceKind } from './voice.ts'

const AP_NAME: Readonly<Record<Approach, string>> = { road: '대로', night: '밤길', ford: '여울', ridge: '산기슭', cliff: '절벽' }
const isAp = (x: string): x is Approach => x in AP_NAME

/** 그 계절을 지금에서 본 말 — 「지난 봄」 · 「지난해 가을」 · 「두 해 전 겨울」 */
export function whenSaid(now: number, s: number): string {
  const name = SEASON_NAME[seasonOf(s)]
  const d = now - s
  if (d <= 0) return `이번 ${name}`
  if (d < 4) return `지난 ${name}`
  if (d < 8) return `지난해 ${name}`
  const y = Math.floor(d / 4)
  return `${y === 2 ? '두' : y === 3 ? '세' : y === 4 ? '네' : String(y)} 해 전 ${name}`
}

const fresh = (r: Realm, s: number): boolean => r.season - s <= P.realm.cnMemAge
const nodeName = (r: Realm, id: string | undefined): string => (id !== undefined ? r.nodes[id]?.name ?? '' : '')

/** 길의 까닭 — 이 길로 가자는 말 앞에. 이긴 길이면 「그 길로 가 이겼다」, 진 다른 길이 있으면 「그 길로 갔다가 졌다」 */
export interface RouteFact {
  /** 사실이 가리키는 길 */
  readonly ap: Approach
  readonly won: boolean
  /** 그 장수가 겪은 일인가 (아니면 나라의 장부) */
  readonly own: boolean
  readonly line: string
}

/** 이 장수가 이 나라를 치며 겪은 길의 일 — 가장 최근 것 (이긴 일 · 진 일) */
export function heroRouteFact(r: Realm, hero: string, foe: string): RouteFact | null {
  const xs = heroBattlesVs(r, hero, foe).filter((x) => fresh(r, x.s) && isAp(x.how) && (x.res === 'won' || x.res === 'lost'))
  const x = xs[xs.length - 1]
  if (x === undefined) return null
  const ap = x.how as Approach
  const where = `${whenSaid(r.season, x.s)} ${nodeName(r, x.at)} 싸움에서`
  return x.res === 'won'
    ? { ap, won: true, own: true, line: `${where} ${josa(AP_NAME[ap], '으로', '로')} 가 이겼습니다.` }
    : { ap, won: false, own: true, line: `${where} ${josa(AP_NAME[ap], '으로', '로')} 갔다가 크게 졌습니다.` }
}

/** 나라의 장부 — 그 나라를 칠 때 이긴 길 · 진 길 */
export function nationRouteFacts(r: Realm, me: string, foe: string): { best: RouteFact | null; worst: RouteFact | null } {
  const last = (how: string, res: 'won' | 'lost'): { s: number; at?: string } | null => {
    const xs = r.lessons?.[me]?.[foe] ?? []
    for (let i = xs.length - 1; i >= 0; i--) {
      const l = xs[i]!
      if (l.k === 'b' && l.on !== 1 && l.how === how && l.res === res) return { s: l.s, ...(l.at !== undefined ? { at: l.at } : {}) }
    }
    return null
  }
  const mk = (how: string | undefined, won: boolean): RouteFact | null => {
    if (how === undefined || !isAp(how)) return null
    const l = last(how, won ? 'won' : 'lost')
    if (l === null || !fresh(r, l.s)) return null
    const where = `${whenSaid(r.season, l.s)} ${josa(nodeName(r, l.at), '을', '를')} 칠 때`
    return { ap: how, won, own: false, line: won ? `${where} ${josa(AP_NAME[how], '으로', '로')} 가 이겼습니다.` : `${where} ${josa(AP_NAME[how], '으로', '로')} 갔다가 졌습니다.` }
  }
  return { best: mk(bestRouteVs(r, me, foe)?.how, true), worst: mk(worstRouteVs(r, me, foe)?.how, false) }
}

/** 나눠 떠난 일의 까닭 — keep: 남기자는 쪽을 받치나 · all: 다 데려가자는 쪽을 받치나 */
export interface SplitFact {
  readonly side: 'keep' | 'all'
  readonly own: boolean
  readonly line: string
}

/** 이 장수가 겪은 나눠 떠남 — 떠난 사이 고을이 털렸으면 「남기자」의 까닭 */
export function heroSplitFact(r: Realm, hero: string): SplitFact | null {
  const x = heroSplit(r, hero)
  if (x === null || !x.raid || !fresh(r, x.s)) return null
  return { side: 'keep', own: true, line: `${whenSaid(r.season, x.s)} ${x.keep <= 0 ? '군사를 다 데려갔다가' : `${Math.round(x.keep / 10)}할만 남기고 갔다가`} 빈 ${josa(nodeName(r, x.at), '이', '가')} 짓밟혔습니다.` }
}

/** 나라의 장부 — 가장 최근의 나눠 떠남과 그 결과 */
export function nationSplitFact(r: Realm, me: string): SplitFact | null {
  const x = splitLesson(r, me)
  if (x === null || !fresh(r, x.s)) return null
  const when = whenSaid(r.season, x.s)
  const foe = r.factions[x.foe]?.name ?? ''
  if (x.raid) return { side: 'keep', own: false, line: `${when} ${x.keep <= 0 ? '군사를 다 데려갔다가' : `${Math.round(x.keep / 10)}할만 남기고 갔다가`} 빈 ${josa(nodeName(r, x.at), '이', '가')} 짓밟혔습니다.` }
  if (x.res === 'lost' && x.keep > 0) return { side: 'all', own: false, line: `${when} 군사를 쪼개 갔다가 ${foe}에 졌습니다.` }
  if (x.res === 'won' && x.keep <= 0) return { side: 'all', own: false, line: `${when} 군사를 다 데려가 ${foe}에 이겼습니다.` }
  if (x.res === 'won' && x.keep > 0) return { side: 'keep', own: false, line: `${when} ${Math.round(x.keep / 10)}할을 남기고 가서도 ${foe}에 이겼습니다.` }
  return null
}

/** 먼저 공작의 까닭 — 이 장수가 그 나라에 공작을 먹였거나, 공작 뒤에 친 싸움이 더 잘 됐거나 */
export function plotFact(r: Realm, me: string, foe: string, hero: string | null): string {
  const name = r.factions[foe]?.name ?? ''
  const own = hero !== null ? heroPlotVs(r, hero, foe) : null
  if (own !== null && fresh(r, own.s)) return `${whenSaid(r.season, own.s)} ${name}에 공작을 놓아 본 적이 있어 그 속을 압니다.`
  const pb = plotBeforeWin(r, me, foe)
  if (pb !== null && pb.won > 0 && pb.won > pb.lost) return `${name}에는 공작을 먼저 놓고 쳤을 때 이겼습니다.`
  return ''
}

/** 곳간의 까닭 — 정찰로 본 그 나라의 곡식 (cnGrainAge 안 · cnPlotRich 넘게) */
export function grainSeen(r: Realm, me: string, foe: string): { v: number; s: number } | null {
  let best: { v: number; s: number } | null = null
  for (const [node, k] of Object.entries(r.intel[me] ?? {}).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const g = k.grain
    if (g === undefined || r.nodes[node]?.owner !== foe || r.season - g.season > P.realm.cnGrainAge) continue
    if (best === null || g.season > best.s) best = { v: g.v, s: g.season }
  }
  return best
}

/** 지난번 싸움 — 그 나라에 졌나 (두 갈래의 까닭) */
export function lostLast(r: Realm, me: string, foe: string): string {
  const b = lastBattleVs(r, { faction: me }, foe)
  if (b === null || b.on || b.res !== 'lost' || !fresh(r, b.s)) return ''
  return `${whenSaid(r.season, b.s)} ${nodeName(r, b.at)} 싸움에서 저들에게 졌습니다.`
}

/** 장수가 스스로를 낮춰 부르는 말 */
function selfWord(h: Hero): string {
  switch (voiceKind(h)) {
    case 'm-sage': return '소신'
    case 'w-shaman': return '소인'
    case 'm-elder': return '이 늙은이'
    case 'w-matron': return '이 몸'
    default: return '소장'
  }
}

/**
 * 지난 회의 — 그 장수가 낸 안을 들어 주었고 결과가 났다. 맞았으면 「지난번 소장의 말대로 하시어 이겼습니다」(금빛 테),
 * 빗나갔으면 머뭇거리며 「지난번에는 소장의 말이 빗나갔습니다」.
 */
export function councilFact(r: Realm, h: Hero): { proven: boolean; line: string } | null {
  const rec = councilRecord(r, h.id, r.season - P.realm.cnMemAge)
  if (rec === null || rec.res === 'draw') return null
  const me = selfWord(h)
  if (rec.res === 'lost' || rec.res === 'fail') return { proven: false, line: `지난번에는 ${me}의 말이 빗나갔습니다. 부끄러우나 다시 말씀 올립니다.` }
  const did = rec.how === 'wait' || rec.how === 'hold' ? (rec.res === 'won' ? '기다리시어 쳐들어온 적을 막았습니다' : '기다리시어 탈이 없었습니다')
    : rec.how === 'burn' && rec.res === 'ok' ? '저들의 곳간을 태워 두었습니다'
      : rec.how === 'sow' ? '저들의 맹약을 흔들어 놓았습니다'
        : '하시어 이겼습니다'
  return { proven: true, line: `지난번 ${me}의 말대로 ${did}.` }
}
