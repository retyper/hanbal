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
import { battleName, seasonLabel } from '../../realm/data/prose.ts'
import type { Approach, Hero, Mem, Realm } from '../../realm/types.ts'
import { lazyTable, t as tr } from '../../i18n/index.ts'

const ROUTE: Readonly<Record<string, string>> = lazyTable('memRoute', ['road', 'night', 'ford', 'ridge', 'cliff', 'field'])
const PLOT: Readonly<Record<string, string>> = lazyTable('memPlot', ['rumor', 'sow', 'bribe', 'burn', 'spy', 'assassin', 'rescue'])
const WOO: Readonly<Record<string, string>> = lazyTable('memWoo', ['soothe', 'cause', 'gain', 'fear', 'bond'])
const FREED: Readonly<Record<string, string>> = lazyTable('memFreed', ['peace', 'take', 'rescue'])

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
  const when = seasonLabel(r, m.s)
  const parts: string[] = [when]
  switch (m.k) {
    case 'battle': {
      parts.push(m.at !== undefined && r.nodes[m.at] !== undefined ? battleName(r, { node: m.at, field: m.how === 'field', ...(m.how !== undefined && m.how !== 'field' ? { approach: m.how as Approach } : {}) }) : tr('mem.battle'))
      const foe = facName(r, m.foe)
      if (foe !== '') parts.push(tr(m.on === 1 ? 'mem.invaded' : 'mem.struck', { foe }))
      if (m.how !== undefined && ROUTE[m.how] !== undefined && m.on !== 1) parts.push(ROUTE[m.how]!)
      parts.push(tr(m.res === 'won' ? 'mem.won' : m.res === 'lost' ? 'mem.lost' : 'mem.drew'))
      break
    }
    case 'duel': {
      const who = heroName(r, m.who)
      parts.push(who !== '' ? tr('mem.duelWith', { who }) : tr('mem.duel'))
      parts.push(tr(m.res === 'won' ? 'mem.won' : 'mem.lost'))
      break
    }
    case 'captured': {
      const foe = facName(r, m.foe)
      parts.push(foe !== '' ? tr('mem.capBy', { foe }) : tr('mem.cap'))
      if (m.how === 'envoy') parts.push(tr('mem.capEnvoy'))
      else if (m.how === 'plot') parts.push(tr('mem.capPlot'))
      else if (m.at !== undefined) parts.push(nodeName(r, m.at))
      break
    }
    case 'freed':
      if (m.how === 'turned') parts.push(tr('mem.turned', { foe: facName(r, m.foe) }))
      else parts.push(FREED[m.how ?? ''] ?? tr('mem.freedDef'))
      break
    case 'plot': {
      const op = PLOT[m.how ?? ''] ?? tr('mem.plotDef')
      const foe = facName(r, m.foe)
      if (m.on === 1) parts.push(foe !== '' ? tr('mem.plotOf', { foe, op }) : tr('mem.plotSome', { op }), tr(m.res === 'ok' ? 'mem.plotHit' : 'mem.plotDodge'))
      else parts.push(foe !== '' ? tr('mem.plotOn', { foe, op }) : op, tr(m.res === 'ok' ? 'mem.plotOk' : 'mem.plotMiss'))
      break
    }
    case 'woo': {
      const who = heroName(r, m.who)
      const how = (m.how ?? '').split('+').map((x) => WOO[x]).filter((x): x is string => x !== undefined)
      parts.push(tr(m.on === 1 ? 'mem.wooOf' : 'mem.wooOn', { who }))
      if (how.length > 0) parts.push(how.join(', '))
      parts.push(m.res === 'ok' ? (m.on === 1 ? tr('mem.wooBreak') : tr('mem.wooOk')) : m.res === 'fail' ? tr('mem.wooAngry') : tr('mem.wooHold'))
      break
    }
    case 'split': {
      // 도읍에서 떠났으면 고을 이름은 빼고 짧게: 「다 데리고 가락국으로 · 도읍 무사」
      const n = m.n ?? 0
      const home = m.at !== undefined && faction !== undefined && r.factions[faction]?.capital === m.at
      const at = home ? '' : nodeName(r, m.at)
      const foe = facName(r, m.foe)
      const tenth = Math.max(1, Math.round(n / 10))
      parts.push(n <= 0
        ? tr(foe !== '' ? (at !== '' ? 'mem.allFoeAt' : 'mem.allFoe') : (at !== '' ? 'mem.allGoAt' : 'mem.allGo'), { at, foe })
        : tr(foe !== '' ? (at !== '' ? 'mem.keepFoeAt' : 'mem.keepFoe') : (at !== '' ? 'mem.keepGoAt' : 'mem.keepGo'), { at, foe, n: tenth }))
      parts.push(m.res === 'fail' ? (home ? tr('mem.raidHome') : tr('mem.raidBack')) : home ? tr('mem.safeHome') : tr('mem.safeBack'))
      break
    }
    case 'council':
      parts.push(tr('mem.council'), tr(m.res === 'ok' ? 'mem.accepted' : 'mem.rejected'))
      break
    case 'betrayed':
      parts.push(tr('mem.betrayed', { foe: facName(r, m.foe) }))
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
  return `<div class="mm-row"><b class="mm-h">${tr('mem.head')}</b><div class="mm-tl">${cells}</div></div>`
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
