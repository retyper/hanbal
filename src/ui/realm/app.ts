/**
 * 칠십팔국 — 앱 화면 (docs/realm/FLOW.md §5)
 *
 * 한 화면에 꽉 찬다. 페이지는 내려가지 않는다: 위 상태 줄 · 가운데 지도 · 아래 탭. 탭이나 고을을 누르면
 * 아래에서 판(시트)이 올라오고 그 안만 스크롤한다. 계절을 넘기면 보고가 카드로 뜬다.
 * 화면은 판을 읽기만 하고, 바꾸는 일은 명령을 모아 advance 에 넘기는 것 하나다 (절대 규칙 2 의 정신).
 * 루프·타이머가 없다 — 누르면 다시 그린다 (절대 규칙 4). 글은 FLOW §6: 짧게, AI 말투 금지.
 */
import { aiOrders } from '../../realm/ai.ts'
import { headcount, type UnitKind } from '../../realm/battle.ts'
import { FACTION_ART, HERO_BUST, SEASON_ICON, UNIT_ICON, nodeIcon } from '../../realm/data/art.ts'
import { NATIONS } from '../../realm/data/nations.ts'
import {
  ASK_NAME, BLOCKED_LINE, EDGE_NAME, NODE_KIND_NAME, SEASON_LINE, SETTLED_NAME, TAG_LINE, UNIT_NAME, reportText, seasonLabel,
} from '../../realm/data/prose.ts'
import { envoyChance, envoyChanceFor, relationOf } from '../../realm/diplomacy.ts'
import { draftCost, draftLimit, militiaMen, settleCost, settleLimit, settleTargets } from '../../realm/economy.ts'
import { jointWin, movesOf, type Move } from '../../realm/estimate.ts'
import { alertRange, visibleRange } from '../../realm/intel.ts'
import { advance, forceOf, neighbors, newArmyId, otherEnd, planned, seasonOf, seenMarches } from '../../realm/season.ts'
import type { Army, Hero, Order, Realm, Report } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { MAP_CSS, mapHtml, type MapMarch } from './mapview.ts'
import { APP_CSS } from './appstyle.ts'
import { FEEL_CSS, alertFeel, ambushFeel, envoyFeel, fightFeel, unknownFeel } from './feel.ts'

export interface AppHost {
  /** 계절을 넘긴 뒤 — 저장은 바깥이 한다. `orders` 는 AI 것까지 전부, `mine` 은 플레이어 것 */
  onAdvance(next: Realm, report: Report, orders: readonly Order[], mine: readonly Order[]): void
  /** 나라를 골라 새 판 */
  onNewGame(nation: string): void
  /** 누른 것 하나 — 판 기록에 남긴다 */
  onTap(act: string, arg: string): void
  /** 판 기록을 파일로 */
  onExport(): void
  /** 남아 있는 판 기록 수 */
  gameCount(): number
}

const ART: string = (import.meta.env?.BASE_URL ?? '/') + 'realm/'

type Ask = 'truce' | 'trade' | 'tribute' | 'alliance'
type Envoy = Extract<Order, { kind: 'envoy' }>
type Sheet =
  | { kind: 'army' } | { kind: 'draft' } | { kind: 'diplo' } | { kind: 'scout' } | { kind: 'nation' } | { kind: 'help' }
  | { kind: 'node'; id: string }

const REL_NAME = { war: '전쟁', neutral: '중립', truce: '화친', ally: '동맹' } as const
const DRAFTABLE: readonly UnitKind[] = ['spear', 'bow', 'shield']
const TABS = [
  { id: 'army', name: '군대', icon: 'unit-general' },
  { id: 'draft', name: '징병', icon: 'unit-spear' },
  { id: 'diplo', name: '외교', icon: 'good-tribute-bell' },
  { id: 'scout', name: '정찰', icon: 'unit-scouts' },
  { id: 'nation', name: '나라', icon: 'settle-capital' },
] as const

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const span = (lo: number, hi: number, f: (x: number) => string): string => (f(lo) === f(hi) ? f(lo) : `${f(lo)}~${f(hi)}`)
const icon = (name: string, cls = 'ic'): string => `<img class="${cls}" src="${ART}icon/${name}.png" alt="">`
const bust = (h: Hero | undefined, cls = 'face'): string =>
  h !== undefined && HERO_BUST[h.id] !== undefined ? `<img class="${cls}" src="${ART}bust/${HERO_BUST[h.id]}.jpg" alt="">` : `<span class="${cls} noface"></span>`
const emblem = (f: string | null, cls = 'em'): string => (f !== null && FACTION_ART[f] !== undefined ? icon(FACTION_ART[f].emblem, cls) : '')
const sorted = <T extends { id: string }>(xs: Iterable<T>): T[] => [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

/** 나라마다 얼굴 하나 — 그 나라의 첫 장수 */
const NATION_LEAD: Readonly<Record<string, string>> = { us: 'chief', guya: 'guya-1', anya: 'anya-1', miri: 'miri-1', goja: 'goja-1', dokro: 'dokro-1' }
function nationFace(id: string): string {
  const hid = NATION_LEAD[id]
  const file = hid !== undefined ? HERO_BUST[hid] : undefined
  return file !== undefined ? `<img class="nface" src="${ART}bust/${file}.jpg" alt="">` : ''
}

export function mountRealmApp(root: HTMLElement, host: AppHost): { show(r: Realm | null, before: Realm | null, report: Report | null): void } {
  const style = document.createElement('style')
  style.textContent = APP_CSS + MAP_CSS + FEEL_CSS
  document.head.appendChild(style)
  root.classList.add('ap')
  root.innerHTML = `<header class="top"></header><div class="mapwrap"></div><div class="legend"></div><button class="next" data-act="next"></button>`
    + `<nav class="tabs"></nav><div class="back" data-act="close"></div><section class="sheet"></section><div class="modal"></div>`
  const $ = (sel: string): HTMLElement => root.querySelector<HTMLElement>(sel)!

  let realm: Realm | null = null
  let before: Realm | null = null
  let report: Report | null = null
  let showReport = false
  let choosing = false
  let sheet: Sheet | null = null
  /** 이번 계절의 명령 거리 */
  let armyOrders: Order[] = [] // 나누기·모으기 — 화면은 이걸 먼저 해 본 판을 보인다
  let musters: Order[] = [] // 징병·해산
  let settles: Order[] = [] // 개척 — 나누기처럼 먼저 해 본 판에 든다 (그래야 남은 몫·곡식이 맞게 보인다)
  const pick: Record<string, { edge: string; ambush: boolean } | undefined> = {}
  let scout = ''
  let envoy: Envoy | null = null
  /** 시트 안의 손 상태 */
  let openArmy = ''
  let armyMode: 'move' | 'split' = 'move'
  const draftUnit: Record<string, UnitKind> = {}
  const draftN: Record<string, number> = {}
  const settleN: Record<string, number> = {}
  const settleFrom: Record<string, string> = {}
  let trade = { give: { grain: 0, iron: 0 }, take: { grain: 0, iron: 0 }, to: '' }
  let note = ''
  /** 지도에서 또렷하게 볼 나라 — 깃발 줄에서 누른다 */
  let focus: string | null = null

  const me = (): string => realm!.player
  const plan = (): Realm => planned(realm!, [...armyOrders, ...settles])

  function resetTurn(): void {
    armyOrders = []
    musters = []
    settles = []
    for (const k of Object.keys(pick)) delete pick[k]
    scout = ''
    envoy = null
    openArmy = ''
    note = ''
    trade = { give: { grain: 0, iron: 0 }, take: { grain: 0, iron: 0 }, to: '' }
  }

  function ordersNow(): Order[] {
    const p = plan()
    const out: Order[] = [...armyOrders, ...settles, ...musters]
    for (const [army, c] of Object.entries(pick)) {
      const a = p.armies[army]
      if (c !== undefined && a !== undefined && a.march === null) out.push({ kind: 'march', army, edge: c.edge, ambush: c.ambush })
    }
    if (scout !== '') out.push({ kind: 'scout', faction: me(), node: scout, hero: null })
    if (envoy !== null) out.push(envoy)
    return out
  }

  function armyName(r: Realm, a: Army): string {
    const h = a.hero !== null ? r.heroes[a.hero] : undefined
    return h !== undefined && h.status === 'free' ? h.name : `별동대 ${headcount(forceOf(r, a))}`
  }

  function scoutable(r: Realm): string[] {
    const mine = Object.values(r.nodes).filter((n) => n.owner === me())
    return [...new Set(mine.flatMap((n) => neighbors(r, n.id)))].filter((id) => r.nodes[id]?.owner !== me()).sort()
  }

  // ───────── 위 상태 줄
  function topHtml(r: Realm): string {
    const season = seasonOf(r.season)
    const st = r.stock[me()] ?? { grain: 0, iron: 0 }
    const men = Object.values(r.armies).filter((a) => a.faction === me()).reduce((s, a) => s + headcount(forceOf(r, a)), 0)
    const nation = r.factions[me()]
    return `<div class="tl">${icon(SEASON_ICON[season], 'sic')}<b>${esc(seasonLabel(r.season))}</b></div>`
      + `<div class="tr"><span class="stat">${icon('good-rice')}<b>${Math.floor(st.grain)}</b></span>`
      + `<span class="stat">${icon('treasure-iron-ingots')}<b>${Math.floor(st.iron)}</b></span>`
      + `<span class="stat">${icon('unit-spear')}<b>${men}</b></span>`
      + `<span class="stat nat">${emblem(me())}<b>${esc(nation?.name ?? '')}</b></span></div>`
  }

  // ───────── 지도
  function mapPart(r: Realm): string {
    const marches: MapMarch[] = []
    for (const a of Object.values(r.armies)) {
      if (a.faction !== me()) continue
      if (a.march !== null) marches.push({ from: a.march.from, to: a.march.to, left: a.march.left })
      const c = pick[a.id]
      const ed = c !== undefined && a.march === null ? r.edges[c.edge] : undefined
      if (ed !== undefined) marches.push({ from: a.at, to: otherEnd(ed, a.at)!, left: null })
    }
    for (const a of seenMarches(r, me())) if (a.march !== null) marches.push({ from: a.march.from, to: a.march.to, left: a.march.left, foe: true })
    const sel = sheet?.kind === 'node' ? sheet.id : scout
    return mapHtml(r, me(), ART, marches, sel, focus)
  }

  /** 깃발 줄 — 나라마다 깃발과 땅 수 (땅의 주인은 누구나 안다). 누르면 그 나라 땅만 또렷하다 */
  function legendHtml(r: Realm): string {
    const count = (f: string): number => Object.values(r.nodes).filter((n) => n.owner === f).length
    const fs = sorted(Object.values(r.factions)).map((f) => ({ f, n: count(f.id) })).sort((a, b) => b.n - a.n)
    let h = ''
    for (const { f, n } of fs) {
      const c = FACTION_ART[f.id]?.color ?? '#ccc'
      const cls = `${focus === f.id ? ' on' : ''}${f.id === me() ? ' me' : ''}${n === 0 ? ' gone' : ''}`
      h += `<button class="lg${cls}" data-act="focus" data-id="${f.id}" style="--c:${c}">${emblem(f.id, 'lem')}<b>${n}</b><span>${esc(f.name)}</span></button>`
    }
    return h
  }

  // ───────── 군대
  function moveRows(r: Realm, a: Army, only: string | null): string {
    const chosen = pick[a.id]
    let h = only === null ? `<button class="row ${chosen === undefined ? 'on' : ''}" data-act="mv" data-army="${a.id}" data-edge="">머문다</button>` : ''
    for (const m of movesOf(r, me(), a)) {
      if (only !== null && m.to !== only) continue
      const node = r.nodes[m.to]!
      const off = m.blocked !== null
      const on = chosen?.edge === m.edge.id
      let right = ''
      if (off) right = `<span class="mute">${BLOCKED_LINE[m.blocked!]}</span>`
      else if (m.hostile) right = `<span class="win">${m.win !== null ? fightFeel(m.win[0], m.win[1]) : unknownFeel()}</span>`
      h += `<button class="row mv ${on ? 'on' : ''}" data-act="mv" data-army="${a.id}" data-edge="${m.edge.id}" ${off ? 'disabled' : ''}>`
      h += `${emblem(node.owner)}<span class="dest">${esc(node.name)}</span><span class="sub">${EDGE_NAME[m.edge.kind]} · ${m.seasons}계절</span>${right}</button>`
      if (m.hostile && !off && on) {
        h += `<button class="chip amb ${chosen?.ambush ? 'on' : ''}" data-act="amb" data-army="${a.id}">기습 ${ambushFeel(m.ambushP)}</button>`
      }
    }
    return h
  }

  function sortie(r: Realm): string {
    const byTo = new Map<string, Array<{ army: Army; move: Move }>>()
    for (const [army, c] of Object.entries(pick)) {
      const a = r.armies[army]
      if (c === undefined || a === undefined || a.march !== null) continue
      const m = movesOf(r, me(), a).find((x) => x.edge.id === c.edge)
      if (m === undefined || m.blocked !== null) continue
      byTo.set(m.to, [...(byTo.get(m.to) ?? []), { army: a, move: m }])
    }
    let h = ''
    for (const [to, legs] of [...byTo].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
      if (legs.length < 2 || !legs[0]!.move.hostile) continue
      if (new Set(legs.map((x) => x.move.seasons)).size > 1) {
        h += `<div class="banner">${esc(r.nodes[to]!.name)}: 닿는 계절이 달라 따로 싸운다</div>`
        continue
      }
      const w = jointWin(r, me(), legs.map((x) => ({ army: x.army, edge: x.move.edge })), to)
      const two = new Set(legs.map((x) => x.move.edge.id)).size >= 2
      h += `<div class="banner good">협공 ${esc(r.nodes[to]!.name)} · ${legs.length}군${two ? ' · 두 길로 들어가 더 세다' : ''} ${w === null ? unknownFeel() : fightFeel(w[0], w[1])}</div>`
    }
    return h
  }

  function armySheet(r: Realm): string {
    let h = `<h3>군대</h3>${sortie(r)}`
    if (note !== '') h += `<div class="banner bad">${esc(note)}</div>`
    const armies = sorted(Object.values(r.armies)).filter((a) => a.faction === me())
    if (armies.length === 0) h += `<p class="mute">군대가 없다. 징병으로 뽑는다.</p>`
    for (const a of armies) {
      const hero = a.hero !== null ? r.heroes[a.hero] : undefined
      const disbanding = musters.some((o) => o.kind === 'disband' && o.army === a.id)
      h += `<div class="acard">${bust(hero)}<div class="ab"><div class="an"><b>${esc(armyName(r, a))}</b>`
      h += `<span class="mute">${esc(r.nodes[a.at]?.name ?? '')} · ${headcount(forceOf(r, a))}명</span></div><div class="units">`
      for (const [k, n] of Object.entries(a.mix) as Array<[UnitKind, number]>) {
        if (n > 0) h += `<span class="unit">${icon(UNIT_ICON[k])}${UNIT_NAME[k]} ${n}</span>`
      }
      h += `</div>`
      if (realm!.armies[a.id] === undefined) h += `<div class="mute">이번 계절에 나눴다</div>`
      if (a.march !== null) {
        h += `<div class="mute">${esc(r.nodes[a.march.to]?.name ?? '')}로 가는 중 · ${a.march.left}계절${a.march.ambush ? ' · 기습' : ''}</div></div></div>`
        continue
      }
      if (disbanding) {
        h += `<div class="mute">해산한다</div><div class="btns"><button class="btn ghost" data-act="undisband" data-army="${a.id}">해산 취소</button></div></div></div>`
        continue
      }
      const open = openArmy === a.id
      h += `<div class="btns"><button class="btn ${open && armyMode === 'move' ? 'on' : ''}" data-act="open" data-army="${a.id}" data-mode="move">이동</button>`
      h += `<button class="btn ${open && armyMode === 'split' ? 'on' : ''}" data-act="open" data-army="${a.id}" data-mode="split">나누기</button>`
      for (const b of armies) {
        if (b.id !== a.id && b.at === a.at && b.march === null) h += `<button class="btn" data-act="merge" data-army="${a.id}" data-into="${b.id}">${esc(armyName(r, b))}에 합류</button>`
      }
      if (r.nodes[a.at]?.owner === me()) h += `<button class="btn ghost" data-act="disband" data-army="${a.id}">해산</button>`
      h += `</div>`
      if (pick[a.id] !== undefined && !open) {
        const ed = r.edges[pick[a.id]!.edge]
        if (ed !== undefined) h += `<div class="go">→ ${esc(r.nodes[otherEnd(ed, a.at)!]?.name ?? '')}${pick[a.id]!.ambush ? ' · 기습' : ''}</div>`
      }
      if (open && armyMode === 'move') h += `<div class="rows">${moveRows(r, a, null)}</div>`
      if (open && armyMode === 'split') {
        h += `<div class="split">`
        for (const [k, n] of Object.entries(a.mix) as Array<[UnitKind, number]>) {
          if (n > 0) h += `<label>${icon(UNIT_ICON[k])}${UNIT_NAME[k]}<input type="number" inputmode="numeric" min="0" max="${n}" value="0" data-split="${a.id}" data-kind="${k}"></label>`
        }
        if (a.hero !== null) h += `<label class="chk"><input type="checkbox" data-split-hero="${a.id}"> 장수가 이끈다</label>`
        h += `<button class="btn on" data-act="split" data-army="${a.id}">떼어 낸다</button></div>`
      }
      h += `</div></div>`
    }
    if (armyOrders.length > 0) h += `<button class="btn ghost wide" data-act="undo-split">나누기·합류 되돌리기</button>`
    return h
  }

  // ───────── 징병
  function draftSheet(r: Realm): string {
    const season = seasonOf(r.season)
    let h = `<h3>징병</h3>`
    if (season === 'spring') h += `<div class="banner bad">봄에 뽑으면 그해 가을 수확이 준다</div>`
    if (season === 'autumn' || season === 'winter') h += `<div class="banner good">거둔 뒤라 뽑기 좋은 때다</div>`
    const pending = musters.filter((o): o is Extract<Order, { kind: 'draft' }> => o.kind === 'draft')
    for (const n of sorted(Object.values(r.nodes)).filter((x) => x.owner === me())) {
      const done = pending.filter((o) => o.node === n.id).reduce((s, o) => s + o.n, 0)
      const lim = Math.max(0, draftLimit(r, me(), n.id) - done)
      const unit = draftUnit[n.id] ?? 'spear'
      const step = Math.max(1, Math.round(lim / 10))
      const want = Math.min(lim, draftN[n.id] ?? Math.min(lim, 20))
      h += `<div class="ncard"><div class="an">${icon(nodeIcon(n), 'nic')}<b>${esc(n.name)}</b>`
      h += `<span class="mute">가호 ${Math.floor(n.hh)} · 장정 ${militiaMen(r, n.id)}${done > 0 ? ` · 뽑는 중 ${done}` : ''}</span></div>`
      if (lim <= 0) {
        h += `<div class="mute">이번 계절엔 더 못 뽑는다</div></div>`
        continue
      }
      h += `<div class="seg">`
      for (const u of DRAFTABLE) h += `<button class="${u === unit ? 'on' : ''}" data-act="dunit" data-node="${n.id}" data-unit="${u}">${icon(UNIT_ICON[u])}${UNIT_NAME[u]}</button>`
      h += `</div><div class="stepper"><button data-act="dn" data-node="${n.id}" data-d="${-step}">−</button><b>${want}</b>`
      h += `<button data-act="dn" data-node="${n.id}" data-d="${step}">+</button><span class="mute">최대 ${lim} · 곡식 ${Math.ceil(draftCost(want).grain)}</span>`
      h += `<button class="btn on" data-act="draft" data-node="${n.id}" ${want <= 0 ? 'disabled' : ''}>뽑는다</button></div></div>`
    }
    // 개척 — 맞닿은 빈땅으로 사람을 보낸다
    const lands = [...new Set([...settleTargets(r, me()).map((t) => t.to), ...settlePending().map((o) => o.to)])].sort()
    if (lands.length > 0) {
      h += `<h4>개척 · 빈땅에 사람을 보낸다</h4>`
      for (const to of lands) h += settleCard(r, to)
    }
    if (pending.length > 0) {
      h += `<h4>이번 계절 징병</h4>`
      pending.forEach((o) => {
        h += `<div class="row">${icon(UNIT_ICON[o.unit])}${esc(r.nodes[o.node]?.name ?? '')} ${UNIT_NAME[o.unit]} ${o.n}<button class="btn ghost sm" data-act="undraft" data-i="${musters.indexOf(o)}">취소</button></div>`
      })
    }
    return h
  }

  // ───────── 개척
  function settlePending(): Array<Extract<Order, { kind: 'settle' }>> {
    return settles.filter((o): o is Extract<Order, { kind: 'settle' }> => o.kind === 'settle')
  }

  /** 빈땅 하나의 개척 카드 — 어느 고을에서 몇 집을 보낼지. `r` 은 이미 보낸 개척이 든 판이다 */
  function settleCard(r: Realm, to: string): string {
    const n = r.nodes[to]!
    const froms = settleTargets(r, me()).filter((t) => t.to === to).map((t) => t.from)
    const sent = settlePending().filter((o) => o.to === to)
    let h = `<div class="ncard"><div class="an">${icon(nodeIcon(n), 'nic')}<b>${esc(n.name)}</b>`
    h += `<span class="mute">가호 ${Math.floor(n.hh)} / ${n.room ?? 0}</span></div>`
    for (const o of sent) {
      h += `<div class="row">${esc(r.nodes[o.from]?.name ?? '')}에서 ${o.n}집<button class="btn ghost sm" data-act="unsettle" data-i="${settles.indexOf(o)}">취소</button></div>`
    }
    if (froms.length === 0) return h + `<div class="mute">${sent.length > 0 ? '이번 계절엔 더 못 보낸다' : '지금은 보낼 수 없다'}</div></div>`
    const from = froms.includes(settleFrom[to] ?? '') ? settleFrom[to]! : froms[0]!
    const lim = settleLimit(r, me(), from, to)
    const want = Math.min(lim, settleN[to] ?? Math.min(lim, 20))
    const step = Math.max(1, Math.round(lim / 10))
    if (froms.length > 1) {
      h += `<div class="seg">`
      for (const f of froms) h += `<button class="${f === from ? 'on' : ''}" data-act="sfrom" data-node="${to}" data-from="${f}">${esc(r.nodes[f]!.name)}</button>`
      h += `</div>`
    } else h += `<div class="mute">${esc(r.nodes[from]!.name)}에서 떠난다</div>`
    h += `<div class="stepper"><button data-act="sn" data-node="${to}" data-d="${-step}">−</button><b>${want}</b>`
    h += `<button data-act="sn" data-node="${to}" data-d="${step}">+</button><span class="mute">집 · 최대 ${lim} · 곡식 ${settleCost(want).grain}</span>`
    h += `<button class="btn on" data-act="settle" data-node="${to}" data-from="${from}" ${want <= 0 ? 'disabled' : ''}>보낸다</button></div></div>`
    return h
  }

  // ───────── 외교
  function diploSheet(r: Realm): string {
    let h = `<h3>외교</h3>`
    if (envoy !== null) {
      h += `<div class="banner good">사신: ${esc(r.factions[envoy.to]?.name ?? '')}에 ${ASK_NAME[envoy.ask]}<button class="btn ghost sm" data-act="unenvoy">거둔다</button></div>`
    } else h += `<p class="mute">한 계절에 사신 하나</p>`
    for (const f of sorted(Object.values(r.factions)).filter((x) => x.id !== me())) {
      const rel = relationOf(r, me(), f.id)
      const left = rel.until !== null ? ` ${Math.max(0, rel.until - r.season)}계절` : ''
      h += `<div class="fcard"><div class="an">${emblem(f.id, 'fem')}<b>${esc(f.name)}</b><span class="rel ${rel.state}">${REL_NAME[rel.state]}${left}</span></div><div class="btns">`
      for (const ask of ['truce', 'trade', 'tribute', 'alliance'] as const) {
        const c = envoyChance(r, me(), f.id, ask)
        const sel = envoy !== null && envoy.to === f.id && envoy.ask === ask
        h += `<button class="btn ${sel ? 'on' : ''}" data-act="${ask === 'trade' ? 'trade-open' : 'envoy'}" data-to="${f.id}" data-ask="${ask}" ${envoy !== null && !sel ? 'disabled' : ''}>`
        h += `${ASK_NAME[ask]} ${envoyFeel(c[0], c[1])}</button>`
      }
      h += `</div>`
      if (trade.to === f.id && envoy === null) {
        const st = r.stock[me()] ?? { grain: 0, iron: 0 }
        h += `<div class="trade">`
        for (const [side, label] of [['give', '준다'], ['take', '받는다']] as const) {
          h += `<div class="tr2"><span>${label}</span>`
          for (const res of ['grain', 'iron'] as const) {
            h += `<span class="stepper sm">${icon(res === 'grain' ? 'good-rice' : 'treasure-iron-ingots')}`
            h += `<button data-act="tq" data-side="${side}" data-res="${res}" data-d="-10">−</button><b>${trade[side][res]}</b>`
            h += `<button data-act="tq" data-side="${side}" data-res="${res}" data-d="10">+</button></span>`
          }
          h += `</div>`
        }
        const ok = trade.give.grain <= st.grain && trade.give.iron <= st.iron && trade.give.grain + trade.give.iron + trade.take.grain + trade.take.iron > 0
        const c = envoyChanceFor(r, me(), f.id, 'trade', trade.give, trade.take)
        h += `<button class="btn on" data-act="envoy" data-to="${f.id}" data-ask="trade" ${ok ? '' : 'disabled'}>사신을 보낸다 ${envoyFeel(c[0], c[1])}</button></div>`
      }
      h += `</div>`
    }
    return h
  }

  // ───────── 정찰
  function scoutSheet(r: Realm): string {
    const known = r.intel[me()] ?? {}
    let h = `<h3>정찰</h3><p class="mute">한 계절에 척후 하나</p>`
    for (const id of scoutable(r)) {
      const n = r.nodes[id]!
      const f = known[id]?.force
      const age = f ? r.season - f.season : null
      const v = f ? visibleRange({ f0: f.f0, src: f.src, u: f.u }, age!) : null
      h += `<button class="row ${scout === id ? 'on' : ''}" data-act="scout" data-node="${id}">${emblem(n.owner)}<span class="dest">${esc(n.name)}</span>`
      h += `<span class="sub">${v !== null ? `${span(v[0], v[1], (x) => String(Math.round(x)))} · ${age === 0 ? '이번 계절' : `${age}계절 전`}` : '못 봤다'}</span></button>`
    }
    return h
  }

  // ───────── 나라
  function nationSheet(r: Realm): string {
    const info = NATIONS.find((x) => x.id === me())
    const mine = Object.values(r.nodes).filter((n) => n.owner === me())
    const caps = Object.values(r.nodes).filter((n) => n.owner === me() && (n.kind === 'capital' || n.kind === 'port') && Object.values(r.factions).some((f) => f.capital === n.id)).length
    const st = r.stock[me()] ?? { grain: 0, iron: 0 }
    let h = `<div class="nhead">${nationFace(me())}<div><h3>${emblem(me())}${esc(r.factions[me()]?.name ?? '')}</h3><p class="mute">${esc(info?.blurb ?? '')}</p></div></div>`
    h += `<div class="goal">목표 · 국읍 셋을 쥔다 <b>${caps} / 3</b></div>`
    h += `<div class="grid4"><div>${icon('settle-farm-village')}<b>${mine.length}</b><span>고을</span></div>`
    h += `<div>${icon('good-hemp')}<b>${Math.floor(mine.reduce((s, n) => s + n.hh, 0))}</b><span>가호</span></div>`
    h += `<div>${icon('good-rice')}<b>${Math.floor(st.grain)}</b><span>곡식</span></div>`
    h += `<div>${icon('treasure-iron-ingots')}<b>${Math.floor(st.iron)}</b><span>철</span></div></div>`
    const caps2 = Object.values(r.heroes).filter((x) => x.status === 'captive' && x.captor === me())
    if (caps2.length > 0) {
      h += `<h4>사로잡은 장수</h4><div class="caps">`
      for (const x of caps2) h += `<div class="cap">${bust(x, 'cface')}<b>${esc(x.name)}</b><span class="mute">무${x.mu} 략${x.ryak} 치${x.chi} 덕${x.deok}</span></div>`
      h += `</div>`
    }
    h += `<div class="btns"><button class="btn" data-act="help">도움말</button><button class="btn ghost" data-act="newgame">새 판</button>`
    h += `<a class="btn ghost" href="${(import.meta.env?.BASE_URL ?? '/')}">활터</a></div>`
    h += `<div class="btns"><button class="btn ghost" data-act="export">기록 내보내기 <span class="mute">${host.gameCount()}판</span></button></div>`
    return h
  }

  function helpSheet(): string {
    return `<h3>도움말</h3><div class="help">`
      + `<p><b>한 계절 = 한 턴.</b> 명령을 고르고 다음 계절을 누른다.</p>`
      + `<p><b>봄</b> 씨를 뿌린다. 봄에 심은 집 수만큼 가을에 거둔다. <b>여름</b> 장마. 나루가 막히고 길이 느리다. `
      + `<b>가을</b> 추수. 곡식이 들어온다. <b>겨울</b> 강이 언다. 언 강으로 기습하기 좋다. 고개가 막힌다. 군량이 더 든다.</p>`
      + `<p><b>개척</b> 빈땅은 아무도 안 사는 땅이다. 그 땅을 누르거나 징병 탭 아래에서, 맞닿은 우리 고을 사람을 보낸다. 곡식이 들고, 일군 땅은 빨리 큰다. 군대로 먼저 깃발만 꽂아 둘 수도 있다.</p>`
      + `<p><b>군사</b> 징병으로 뽑는다. 군대는 곡식을 먹는다. 곡식이 떨어지면 사기가 꺾인다.</p>`
      + `<p><b>지도</b> 땅 색과 깃발이 주인. 왼쪽 위 깃발을 누르면 그 나라 땅만 또렷하다. 초록 수는 우리 병력, 붉은 수는 척후가 본 적 군세, ?는 아직 못 본 곳. ✕는 이번 계절 막힌 길. 보랏빛 화살은 다가오는 적.</p>`
      + `<p><b>판세</b>는 색으로 보인다. 초록이면 해볼 만하고 붉으면 무모하다. 두 색이 섞이고 ?가 붙으면 아직 잘 모른다. 정찰하면 또렷해진다.</p>`
      + `<p><b>협공</b> 같은 계절에 두 길로 들어가면 한 판으로 싸우고 더 세다.</p>`
      + `<p><b>목표</b> 국읍 셋을 쥐면 이긴다. 우리 국읍을 잃으면 진다.</p></div>`
  }

  // ───────── 고을
  function nodeSheet(r: Realm, id: string): string {
    const n = r.nodes[id]!
    const known = (r.intel[me()] ?? {})[id]
    const ours = n.owner === me()
    const who = n.owner === null ? '주인 없음' : (r.factions[n.owner]?.name ?? '')
    const kind = n.kind === 'wild' && n.hh > 0 ? SETTLED_NAME : NODE_KIND_NAME[n.kind]
    let h = `<div class="an big">${icon(nodeIcon(n), 'nic')}<div><h3>${esc(n.name)}</h3><span class="mute">${emblem(n.owner)}${esc(who)} · ${kind}</span></div></div>`
    if (ours || known?.land) {
      const lines = n.tags.map((t) => TAG_LINE[t]).join(' ')
      if (lines !== '') h += `<p class="story">${esc(lines)}</p>`
    }
    if (n.kind === 'wild') {
      if (n.owner === null) h += `<p class="story">아무도 살지 않는 땅이다. 사람을 보내 일구면 마을이 된다. 가호 ${n.room ?? 0}집까지 품는다.</p>`
      if (n.owner === null || ours) {
        const can = settleTargets(r, me()).some((t) => t.to === id) || settlePending().some((o) => o.to === id)
        h += can ? settleCard(r, id) : `<p class="mute">우리 고을과 길로 맞닿고, 그 길이 열려 있어야 사람을 보낸다.</p>`
      }
    }
    if (ours) {
      const men = Object.values(r.armies).filter((a) => a.at === id && a.faction === me() && a.march === null).reduce((s, a) => s + headcount(forceOf(r, a)), 0)
      h += `<div class="grid4"><div><b>${Math.floor(n.hh)}</b><span>가호</span></div><div><b>${militiaMen(r, id)}</b><span>장정</span></div><div><b>${men}</b><span>병력</span></div><div><b>${draftLimit(r, me(), id)}</b><span>징병 가능</span></div></div>`
      h += `<div class="btns"><button class="btn on" data-act="tab" data-tab="draft">여기서 징병</button></div>`
    } else if (n.kind !== 'sodo' && !(n.kind === 'wild' && n.owner === null && known?.force == null)) {
      const f = known?.force
      let force = '못 봤다'
      if (f) {
        const v = visibleRange({ f0: f.f0, src: f.src, u: f.u }, r.season - f.season)
        force = v === null ? '너무 오래됐다' : `${span(v[0], v[1], (x) => String(Math.round(x)))} · ${r.season === f.season ? '이번 계절' : `${r.season - f.season}계절 전`}`
      }
      let alert = ''
      if (known?.alert) {
        const v = alertRange(known.alert.v, r.season - known.alert.season)
        if (v !== null) alert = ` · 경계 ${alertFeel(v[0], v[1])}`
      }
      h += `<p>군세 <b>${force}</b><span class="mute">${alert}</span></p>`
      if (scoutable(r).includes(id)) h += `<div class="btns"><button class="btn ${scout === id ? 'on' : ''}" data-act="scout" data-node="${id}">${scout === id ? '척후를 보낸다' : '정찰'}</button></div>`
    }
    // 여기로 갈 수 있는 우리 군대
    const goers = sorted(Object.values(r.armies)).filter((a) => a.faction === me() && a.march === null && movesOf(r, me(), a).some((m) => m.to === id))
    if (goers.length > 0) {
      h += `<h4>보낼 군대</h4>`
      for (const a of goers) h += `<div class="goer"><span class="gname">${esc(armyName(r, a))} <span class="mute">${headcount(forceOf(r, a))}명</span></span>${moveRows(r, a, id)}</div>`
    }
    return h
  }

  // ───────── 보고 카드
  function sceneOf(b: Realm, after: Realm, rep: Report): string {
    let best: { ev: string; hero: Hero | null; line: string } | null = null
    let rank = 0
    for (const l of rep.lines) {
      if (l.kind !== 'battle') continue
      const weAtk = b.armies[l.attacker]?.faction === after.player
      if (!weAtk && l.defender !== after.player) continue
      const cap = l.captured !== null ? after.heroes[l.captured] : undefined
      const dead = l.killed !== null ? after.heroes[l.killed] : undefined
      const node = after.nodes[l.node]?.name ?? ''
      const cands: Array<[number, { ev: string; hero: Hero | null; line: string }]> = []
      if (cap !== undefined && cap.captor === after.player) cands.push([4, { ev: 'event-capture', hero: cap, line: `${cap.name}을(를) 사로잡았다` }])
      if (dead !== undefined && dead.faction !== after.player) cands.push([3, { ev: 'event-sniped-commander', hero: dead, line: `${dead.name}이(가) 쓰러졌다` }])
      if (weAtk && l.ambush === 'success') cands.push([2, { ev: 'event-night-raid', hero: null, line: `${node} 기습 성공` }])
      const lost = cap !== undefined && cap.faction === after.player ? cap : dead !== undefined && dead.faction === after.player ? dead : undefined
      if (lost !== undefined) cands.push([1, { ev: 'event-sniped-commander', hero: lost, line: `${lost.name}을(를) 잃었다` }])
      for (const [k, p] of cands) if (k > rank) { rank = k; best = p }
    }
    if (best === null) return ''
    return `<div class="scene"><img class="ev" src="${ART}event/${best.ev}.jpg" alt="">${best.hero !== null ? bust(best.hero, 'who') : ''}<div class="brag">${esc(best.line)}</div></div>`
  }

  function modalHtml(r: Realm): string {
    if (r.outcome) {
      const win = r.outcome.kind === 'win'
      return `<div class="mcard end"><img class="ev" src="${ART}event/${win ? 'event-festival' : 'event-sky-drought'}.jpg" alt="">`
        + `<h2>${win ? '변한을 쥐었다' : '국읍이 무너졌다'}</h2><p class="mute">${esc(seasonLabel(r.outcome.season))}</p>`
        + `<button class="btn on wide" data-act="newgame">새 판</button></div>`
    }
    if (!showReport || before === null || report === null) return ''
    const season = seasonOf(r.season)
    const lines = report.lines.map((l) => reportText(before!, r, l, me())).filter((x): x is string => x !== null)
    let h = `<div class="mcard"><div class="mt">${icon(SEASON_ICON[season], 'sic')}<b>${esc(seasonLabel(r.season))}</b><span>${esc(SEASON_LINE[season])}</span></div>`
    h += sceneOf(before, r, report)
    h += `<div class="lines">${lines.length === 0 ? '<p class="mute">조용한 계절이었다.</p>' : lines.map((t) => `<p class="${t.startsWith('소문') ? 'mute' : ''}">${esc(t)}</p>`).join('')}</div>`
    return h + `<button class="btn on wide" data-act="rep-close">확인</button></div>`
  }

  // ───────── 나라 고르기
  function chooseHtml(): string {
    let h = `<div class="choose"><h1>칠십팔국</h1><p class="mute">변한의 여섯 나라. 하나를 고른다.</p><div class="ncards">`
    for (const n of NATIONS) {
      h += `<button class="ncard pick" data-act="nation" data-id="${n.id}">${nationFace(n.id)}<div class="nb">`
      h += `<div class="an">${emblem(n.id)}<b>${esc(n.name)}</b><span class="mute">${esc(n.place)}</span>${n.hard ? '<span class="hard">어려움</span>' : ''}</div>`
      h += `<p>${esc(n.blurb)}</p><div class="bars">`
      for (const [k, label] of [['army', '군사'], ['grain', '곡식'], ['militia', '장정'], ['terrain', '지형']] as const) {
        const v = n.bars[k]
        h += `<span class="bar"><i>${label}</i>${'<b></b>'.repeat(v)}${'<s></s>'.repeat(5 - v)}</span>`
      }
      h += `</div></div></button>`
    }
    return h + `</div></div>`
  }

  // ───────── 그리기
  function paint(): void {
    if (realm === null || choosing) {
      root.classList.add('choosing')
      $('.mapwrap').innerHTML = chooseHtml()
      $('.top').innerHTML = ''
      $('.tabs').innerHTML = ''
      $('.legend').innerHTML = ''
      $('.sheet').innerHTML = ''
      $('.modal').innerHTML = ''
      root.classList.remove('sheet-open', 'modal-open')
      return
    }
    root.classList.remove('choosing')
    const r = plan()
    $('.top').innerHTML = topHtml(r)
    const wrap = $('.mapwrap')
    const keep = wrap.scrollLeft
    const first = wrap.querySelector('.map') === null
    wrap.innerHTML = mapPart(r)
    if (first) {
      // 처음엔 우리 국읍이 가운데 오게
      const cap = realm.factions[me()]?.capital
      const el = cap !== undefined ? wrap.querySelector<HTMLElement>(`.nd[data-node="${cap}"]`) : null
      if (el !== null) wrap.scrollLeft = el.offsetLeft - wrap.clientWidth / 2
    } else wrap.scrollLeft = keep
    $('.legend').innerHTML = legendHtml(r)
    $('.next').innerHTML = `다음 계절 <span>›</span>`
    let tabs = ''
    for (const t of TABS) tabs += `<button class="${sheet?.kind === t.id ? 'on' : ''}" data-act="tab" data-tab="${t.id}">${icon(t.icon, 'tic')}<span>${t.name}</span></button>`
    $('.tabs').innerHTML = tabs
    const sh = $('.sheet')
    const keepSheet = sh.scrollTop
    let body = ''
    if (sheet !== null) {
      switch (sheet.kind) {
        case 'army': body = armySheet(r); break
        case 'draft': body = draftSheet(r); break
        case 'diplo': body = diploSheet(r); break
        case 'scout': body = scoutSheet(r); break
        case 'nation': body = nationSheet(r); break
        case 'help': body = helpSheet(); break
        case 'node': body = nodeSheet(r, sheet.id); break
      }
    }
    sh.innerHTML = sheet !== null ? `<div class="grip" data-act="close"></div>${body}` : ''
    sh.scrollTop = keepSheet
    root.classList.toggle('sheet-open', sheet !== null)
    const modal = modalHtml(r)
    $('.modal').innerHTML = modal
    root.classList.toggle('modal-open', modal !== '')
  }

  function openSheet(s: Sheet | null): void {
    const same = s !== null && sheet !== null && s.kind === sheet.kind && (s.kind !== 'node' || (sheet.kind === 'node' && sheet.id === s.id))
    sheet = same ? null : s
    $('.sheet').scrollTop = 0
    note = ''
    paint()
  }

  // ───────── 손짓 — 한 곳에서 받는다
  root.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act], .nd')
    if (t === null || !root.contains(t)) return
    if (t.classList.contains('nd') && !t.dataset['act']) {
      host.onTap('node', t.dataset['node']!)
      openSheet({ kind: 'node', id: t.dataset['node']! })
      return
    }
    const d = t.dataset
    host.onTap(d['act'] ?? '', d['tab'] ?? d['node'] ?? d['army'] ?? d['to'] ?? d['id'] ?? d['unit'] ?? '')
    const r = realm !== null ? plan() : null
    switch (d['act']) {
      case 'nation': host.onNewGame(d['id']!); return
      case 'newgame': choosing = true; sheet = null; paint(); return
      case 'close': sheet = null; paint(); return
      case 'tab': openSheet({ kind: d['tab'] as 'army' }); return
      case 'help': openSheet({ kind: 'help' }); return
      case 'export': host.onExport(); return
      case 'focus': focus = focus === d['id'] ? null : d['id']!; break
      case 'rep-close': showReport = false; paint(); return
      case 'next': {
        if (realm === null || realm.outcome) return
        const mine = ordersNow()
        const all = [...mine, ...aiOrders(realm)]
        const prev = realm
        const res = advance(prev, all)
        resetTurn()
        sheet = null
        before = prev
        report = res.report
        showReport = true
        realm = res.next
        host.onAdvance(res.next, res.report, all, mine)
        paint()
        return
      }
      case 'open':
        if (openArmy === d['army'] && armyMode === d['mode']) openArmy = ''
        else { openArmy = d['army']!; armyMode = d['mode'] as 'move' | 'split' }
        break
      case 'mv': {
        const army = d['army']!
        if (d['edge'] === '') delete pick[army]
        else pick[army] = { edge: d['edge']!, ambush: pick[army]?.edge === d['edge'] ? pick[army]!.ambush : false }
        break
      }
      case 'amb': {
        const p = pick[d['army']!]
        if (p !== undefined) p.ambush = !p.ambush
        break
      }
      case 'split': {
        const army = d['army']!
        const take: Partial<Record<UnitKind, number>> = {}
        for (const inp of root.querySelectorAll<HTMLInputElement>(`input[data-split="${army}"]`)) {
          const n = Math.floor(Number(inp.value))
          if (n > 0) take[inp.dataset['kind'] as UnitKind] = n
        }
        const hero = root.querySelector<HTMLInputElement>(`input[data-split-hero="${army}"]`)?.checked ?? false
        const id = newArmyId(r!, me())
        const o: Order = { kind: 'split', army, id, take, hero }
        if (planned(r!, [o]).armies[id] === undefined) note = `못 나눈다. 양쪽 다 ${P.realm.splitMin}명 이상, 군대는 ${P.realm.armyMax}개까지.`
        else { armyOrders = [...armyOrders, o]; openArmy = '' }
        break
      }
      case 'merge': {
        const o: Order = { kind: 'merge', army: d['army']!, into: d['into']! }
        if (planned(r!, [o]).armies[d['army']!] !== undefined) note = '장수 둘은 한 군대를 함께 이끌지 못한다.'
        else { armyOrders = [...armyOrders, o]; delete pick[d['army']!] }
        break
      }
      case 'undo-split':
        armyOrders = []
        for (const k of Object.keys(pick)) if (realm!.armies[k] === undefined) delete pick[k]
        break
      case 'disband':
        musters = [...musters, { kind: 'disband', army: d['army']! }]
        delete pick[d['army']!]
        break
      case 'undisband':
        musters = musters.filter((o) => !(o.kind === 'disband' && o.army === d['army']))
        break
      case 'dunit': draftUnit[d['node']!] = d['unit'] as UnitKind; break
      case 'dn': {
        const node = d['node']!
        const lim = draftLimit(r!, me(), node)
        draftN[node] = Math.max(0, Math.min(lim, (draftN[node] ?? Math.min(lim, 20)) + Number(d['d'])))
        break
      }
      case 'draft': {
        const node = d['node']!
        const n = draftN[node] ?? Math.min(draftLimit(r!, me(), node), 20)
        if (n > 0) musters = [...musters, { kind: 'draft', faction: me(), node, unit: draftUnit[node] ?? 'spear', n }]
        delete draftN[node]
        break
      }
      case 'undraft': musters = musters.filter((_, i) => i !== Number(d['i'])); break
      case 'sfrom': settleFrom[d['node']!] = d['from']!; delete settleN[d['node']!]; break
      case 'sn': {
        const to = d['node']!
        const from = settleFrom[to] ?? settleTargets(r!, me()).find((t) => t.to === to)?.from ?? ''
        const lim = settleLimit(r!, me(), from, to)
        settleN[to] = Math.max(0, Math.min(lim, (settleN[to] ?? Math.min(lim, 20)) + Number(d['d'])))
        break
      }
      case 'settle': {
        const to = d['node']!
        const from = d['from']!
        const lim = settleLimit(r!, me(), from, to)
        const n = Math.min(lim, settleN[to] ?? Math.min(lim, 20))
        if (n > 0) settles = [...settles, { kind: 'settle', faction: me(), from, to, n }]
        delete settleN[to]
        break
      }
      case 'unsettle': settles = settles.filter((_, i) => i !== Number(d['i'])); break
      case 'trade-open': trade = { give: { grain: 0, iron: 0 }, take: { grain: 0, iron: 0 }, to: trade.to === d['to'] ? '' : d['to']! }; break
      case 'tq': {
        const side = d['side'] as 'give' | 'take'
        const res = d['res'] as 'grain' | 'iron'
        trade[side][res] = Math.max(0, trade[side][res] + Number(d['d']))
        break
      }
      case 'envoy': {
        const ask = d['ask'] as Ask
        const to = d['to']!
        if (envoy !== null && envoy.to === to && envoy.ask === ask) envoy = null
        else envoy = { kind: 'envoy', from: me(), to, ask, give: ask === 'trade' ? { ...trade.give } : { grain: 0, iron: 0 }, take: ask === 'trade' ? { ...trade.take } : { grain: 0, iron: 0 } }
        trade.to = ''
        break
      }
      case 'unenvoy': envoy = null; break
      case 'scout': scout = scout === d['node'] ? '' : d['node']!; break
      default: return
    }
    paint()
  })

  return {
    show(r, b, rep) {
      realm = r
      before = b
      report = rep
      showReport = rep !== null
      choosing = r === null
      resetTurn()
      sheet = null
      paint()
    },
  }
}
