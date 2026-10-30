/**
 * 장수 판의 「기억」 줄 (docs/realm/MEMORY.md §3-2 5 · 형 10-29: "읽지 않고도 바로 이해하는 게 베스트")
 *
 * 그림이 먼저: 계절 차례로 놓인 둥근 그림 줄 — 칼(싸움) · 엇갈린 칼(겨루기) · 사슬(사로잡힘) · 열린 옥(풀려남) ·
 * 공작 그림(불·이간·매수…) · 흰 깃발(회유) · 행군 줄(나눠 떠남). 테두리 빛이 이 사람에게 좋았나(초록)·나빴나(빨강).
 * 누르면 한 줄(data-tip — tips.ts 의 닿자마자 뜨는 말풍선): 「2년 봄 · 갯벌성 싸움 · 대로 · 이김」. 굴리는 판이 없다.
 * 줄이 폭을 넘으면 이 줄 안에서만 옆으로 민다 (360px 에서 12칸이 들어간다). 이름 바로 밑 — 판을 굴리지 않고 보인다.
 *
 * 화면은 읽기만 한다 (규칙 2).
 */
import { battleName, josa, seasonLabel } from '../../realm/data/prose.ts'
import type { Approach, Hero, Mem, Realm } from '../../realm/types.ts'

const ROUTE: Readonly<Record<string, string>> = { road: '대로', night: '밤길', ford: '여울', ridge: '산기슭', cliff: '절벽', field: '들판' }
const PLOT: Readonly<Record<string, string>> = { rumor: '소문', sow: '이간', bribe: '매수', burn: '방화', spy: '첩자', assassin: '암살', rescue: '구출' }
const WOO: Readonly<Record<string, string>> = { soothe: '달래기', cause: '명분', gain: '이익', fear: '겁주기', bond: '인연' }
const FREED: Readonly<Record<string, string>> = { peace: '화친으로 풀려남', take: '도읍이 떨어져 풀려남', rescue: '구출됨' }

type Tone = 'good' | 'bad' | 'even'

/** 이 사람에게 좋았나 */
function toneOf(m: Mem): Tone {
  switch (m.k) {
    case 'battle': case 'duel': return m.res === 'won' ? 'good' : m.res === 'lost' ? 'bad' : 'even'
    case 'split': return m.res === 'fail' ? 'bad' : 'good'
    case 'captured': case 'betrayed': return 'bad'
    case 'freed': return 'good'
    case 'plot': return m.res === undefined ? 'even' : (m.res === 'ok') === (m.on !== 1) ? 'good' : 'bad'
    case 'woo': return m.on === 1 ? 'even' : m.res === 'ok' ? 'good' : m.res === 'fail' ? 'bad' : 'even'
    case 'council': return m.res === 'ok' ? 'good' : m.res === 'fail' ? 'bad' : 'even'
  }
}

/** 그림 — public/realm/icon 의 것 (사로잡힘만 사슬 글자) */
function iconOf(m: Mem): string | null {
  switch (m.k) {
    case 'battle': return 'treasure-ring-sword'
    case 'duel': return 'war-melee'
    case 'captured': return null
    case 'freed': return 'plot-rescue'
    case 'plot': return m.how !== undefined && PLOT[m.how] !== undefined ? `plot-${m.how}` : 'plot-schemes'
    case 'woo': return 'war-surrender'
    case 'split': return 'route-column'
    case 'council': return 'unit-general'
    case 'betrayed': return 'status-betrayal'
  }
}

const nodeName = (r: Realm, id: string | undefined): string => (id !== undefined ? r.nodes[id]?.name ?? '' : '')
const facName = (r: Realm, id: string | undefined): string => (id !== undefined ? r.factions[id]?.name ?? '' : '')
const heroName = (r: Realm, id: string | undefined): string => (id !== undefined ? r.heroes[id]?.name ?? '' : '')

/** 누르면 뜨는 한 줄 — 평서 (이야기 글). faction — 이 기억의 주인이 섬기는 나라 (나눠 떠남이 「도읍」인지) */
export function memLine(r: Realm, m: Mem, faction?: string): string {
  const when = seasonLabel(m.s)
  const parts: string[] = [when]
  switch (m.k) {
    case 'battle': {
      parts.push(m.at !== undefined && r.nodes[m.at] !== undefined ? battleName(r, { node: m.at, field: m.how === 'field', ...(m.how !== undefined && m.how !== 'field' ? { approach: m.how as Approach } : {}) }) : '싸움')
      const foe = facName(r, m.foe)
      if (foe !== '') parts.push(m.on === 1 ? `${josa(foe, '이', '가')} 쳐들어옴` : `${josa(foe, '을', '를')} 침`)
      if (m.how !== undefined && ROUTE[m.how] !== undefined && m.on !== 1) parts.push(ROUTE[m.how]!)
      parts.push(m.res === 'won' ? '이김' : m.res === 'lost' ? '짐' : '비김')
      break
    }
    case 'duel': {
      const who = heroName(r, m.who)
      parts.push(who !== '' ? `${josa(who, '과', '와')} 겨룸` : '장수 겨루기')
      parts.push(m.res === 'won' ? '이김' : '짐')
      break
    }
    case 'captured': {
      const foe = facName(r, m.foe)
      parts.push(foe !== '' ? `${foe}에 사로잡힘` : '사로잡힘')
      if (m.how === 'envoy') parts.push('사신으로 갔다가')
      else if (m.how === 'plot') parts.push('공작을 하다 들킴')
      else if (m.at !== undefined) parts.push(nodeName(r, m.at))
      break
    }
    case 'freed':
      if (m.how === 'turned') parts.push(`${facName(r, m.foe)} 장수가 됨`)
      else parts.push(FREED[m.how ?? ''] ?? '풀려남')
      break
    case 'plot': {
      const op = PLOT[m.how ?? ''] ?? '공작'
      const foe = facName(r, m.foe)
      if (m.on === 1) parts.push(foe !== '' ? `${foe}의 ${op}` : `누군가의 ${op}`, m.res === 'ok' ? '당함' : '피함')
      else parts.push(foe !== '' ? `${foe}에 ${op}` : op, m.res === 'ok' ? '먹힘' : '어긋남')
      break
    }
    case 'woo': {
      const who = heroName(r, m.who)
      const how = (m.how ?? '').split('+').map((x) => WOO[x]).filter((x): x is string => x !== undefined)
      parts.push(m.on === 1 ? `${who}의 회유` : `${josa(who, '을', '를')} 회유`)
      if (how.length > 0) parts.push(how.join(', '))
      parts.push(m.res === 'ok' ? (m.on === 1 ? '마음이 무너짐' : '먹힘') : m.res === 'fail' ? '노여움' : '버팀')
      break
    }
    case 'split': {
      // 도읍에서 떠났으면 고을 이름은 빼고 짧게: 「다 데리고 가락국으로 · 도읍 무사」
      const n = m.n ?? 0
      const home = m.at !== undefined && faction !== undefined && r.factions[faction]?.capital === m.at
      const at = home ? '' : nodeName(r, m.at)
      const foe = facName(r, m.foe)
      const where = foe !== '' ? ` ${josa(foe, '으로', '로')}` : ' 출정'
      parts.push(n <= 0 ? `${at !== '' ? `${at}에서 ` : ''}다 데리고${where}` : `${at !== '' ? `${at}에 ` : ''}${Math.max(1, Math.round(n / 10))}할 남기고${where}`)
      parts.push(m.res === 'fail' ? (home ? '도읍이 털림' : '뒤가 털림') : home ? '도읍 무사' : '뒤 무사')
      break
    }
    case 'council':
      parts.push('회의에서 낸 안', m.res === 'ok' ? '받아들여짐' : '물리침')
      break
    case 'betrayed':
      parts.push(`${josa(facName(r, m.foe), '이', '가')} 등을 돌림`)
      break
  }
  return parts.filter((x) => x !== '').join(' · ')
}

/** 이 사람의 기억 가운데 보는 나라가 볼 수 있는 것 — 우리 장수는 다, 남의 장수는 우리와 얽힌 일만 */
export function memSeen(r: Realm, h: Hero, viewer: string): Mem[] {
  const xs = h.mem ?? []
  if (h.faction === viewer) return xs
  return xs.filter((m) => m.foe === viewer || (m.who !== undefined && r.heroes[m.who]?.faction === viewer))
}

/** 「기억」 줄 — 없으면 '' */
export function memRowHtml(r: Realm, h: Hero, viewer: string, art: string, esc: (s: string) => string): string {
  const xs = memSeen(r, h, viewer)
  if (xs.length === 0) return ''
  const cells = xs.map((m) => {
    const ic = iconOf(m)
    const pic = ic !== null ? `<img src="${art}icon/${ic}.png" alt="">` : `<i class="mm-chain">⛓</i>`
    return `<span class="mm-i mm-${toneOf(m)}${m.keep === true ? ' mm-keep' : ''}" data-tip="${esc(memLine(r, m, h.faction))}">${pic}</span>`
  }).join('')
  return `<div class="mm-row"><b class="mm-h">기억</b><div class="mm-tl">${cells}</div></div>`
}

export const MEM_CSS = `
.ap .mm-row { display: flex; align-items: center; gap: 6px; margin: 6px 0 2px; min-width: 0; width: 100%; box-sizing: border-box; }
.ap .mm-h { flex: none; font-size: 11px; font-weight: 700; opacity: .7; writing-mode: vertical-rl; letter-spacing: 2px; }
.ap .mm-tl { flex: 1 1 auto; min-width: 0; display: flex; gap: 2px; align-items: center; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; padding: 3px 2px;
  background: linear-gradient(to bottom, transparent calc(50% - 1px), rgba(200, 170, 110, .35) calc(50% - 1px), rgba(200, 170, 110, .35) calc(50% + 1px), transparent calc(50% + 1px)); }
.ap .mm-tl::-webkit-scrollbar { display: none; }
.ap .mm-i { flex: none; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: #1c2129; border: 2px solid #6b6f78; box-sizing: border-box; cursor: help; -webkit-user-select: none; user-select: none; }
.ap .mm-i img { width: 16px; height: 16px; object-fit: contain; pointer-events: none; }
.ap .mm-i.mm-good { border-color: #5fbf6a; }
.ap .mm-i.mm-bad { border-color: #d0524a; }
.ap .mm-i.mm-keep { box-shadow: 0 0 0 1px #e8c26a; }
.ap .mm-chain { font-style: normal; font-size: 13px; line-height: 1; color: #d9dde4; pointer-events: none; }
`
