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
  ASK_KIND_NAME, ASK_NAME, BLOCKED_LINE, EQUIP_NAME, PLOT_DOES, PLOT_NAME, askLine, josa, EDGE_NAME, NODE_KIND_NAME, SEASON_LINE, SETTLED_NAME, STAT_NAME, TAG_LINE, UNIT_NAME, reportText, seasonLabel, whyLine,
} from '../../realm/data/prose.ts'
import { envoyChance, envoyChanceFor, envoyOptions, favorOf, jointTargets, openAsks, relationOf } from '../../realm/diplomacy.ts'
import { armCost, canGuard, draftCost, draftIronCost, draftLimit, guardCost, hhGrowth, militiaMen, riteAllowed, riteCost, settleCost, settleLimit, settleTargets } from '../../realm/economy.ts'
import { jointWin, movesOf, type Move } from '../../realm/estimate.ts'
import { alertRange, visibleRange } from '../../realm/intel.ts'
import { advance, forceOf, neighbors, newArmyId, otherEnd, planned, seasonOf, seenMarches } from '../../realm/season.ts'
import { PLOT_OPS, plotAgents, plotChance, plotCost, plotTargets } from '../../realm/plots.ts'
import { allianceWhy, leaderOf, truceWhy, winningAgainst } from '../../realm/stance.ts'
import { heroSeen, isRuler, persuadeSeasons, wanderersFor } from '../../realm/heroes.ts'
import type { Army, EnvoyAsk, Hero, Order, PlotOp, Realm, Report } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { MAP_CSS, mapHtml, type MapMarch, type MapTarget, type MapToken } from './mapview.ts'
import { GROW_CSS, HERO_CSS, bondChip, growthHtml, heroRadar, roleLine, traitChips, traitLines } from './heroview.ts'
import { APP_CSS } from './appstyle.ts'
import { BATTLE_CSS, battleCard } from './battlecard.ts'
import { attachZoom } from './zoom.ts'
import { FEEL_CSS, alertFeel, ambushFeel, envoyFeel, favorFeel, fightFeel, plotFeel, unknownFeel } from './feel.ts'

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
/** 이번 계절에 정해 둔 명령 — 다른 화면에 다녀와도 남는다 (saveDraft) */
const DRAFT_KEY = 'hanbal.realm.draft'
/** 탭의 빨간 점 — 이 판에서 이미 본 것 (dotKeys) */
const SEEN_KEY = 'hanbal.realm.seen'
/** 밤 활 연습장 (SNIPE §0, 형: "궁술연습장도 만들어서 아무때나 해볼수 있게") */
const PRACTICE: string = (import.meta.env?.BASE_URL ?? '/') + 'night.html?practice=1'
/** night.html 이 올라갔다 (f9e77aa) — 없는 쪽으로 보내지 않으려 둔 스위치 */
const PRACTICE_READY = true
const NIGHT: string = (import.meta.env?.BASE_URL ?? '/') + 'night.html'
const HAND_NAME = { dead: '적장이 쓰러졌다', wounded: '적장이 다쳤다', fled: '적장이 달아났다', withdrew: '조용히 물러났다' } as const

type Ask = EnvoyAsk
type Envoy = Extract<Order, { kind: 'envoy' }>
type Sheet =
  | { kind: 'army' } | { kind: 'draft' } | { kind: 'diplo' } | { kind: 'scout' } | { kind: 'nation' } | { kind: 'help' }
  | { kind: 'node'; id: string } | { kind: 'heroes' } | { kind: 'hero'; id: string }

const REL_NAME = { war: '전쟁', neutral: '중립', truce: '화친', ally: '동맹' } as const
/** 지금 사이가 뜻하는 것 — 나라 카드 밑 한 줄 */
const REL_NOW = {
  war: '서로 친다. 화친을 청하면 멈출 수 있다.',
  neutral: '아직 아무 사이도 아니다. 먼저 치면 전쟁이 된다.',
  truce: '서로 안 친다. 계절마다 장터가 서서 곡식이 오간다.',
  ally: '서로 안 치고 땅을 지나간다. 본 것을 나누고, 같은 적을 친다.',
} as const
/** 사신 넷이 하는 일 */
const ASKS: ReadonlyArray<{ ask: Ask; does: string }> = [
  { ask: 'truce', does: '8계절 서로 안 친다 · 장터가 서서 곡식이 들어온다' },
  { ask: 'trade', does: '곡식과 철을 바꾼다' },
  { ask: 'tribute', does: '바치라고 한다 · 거절하면 전쟁' },
  { ask: 'alliance', does: '화친한 나라와만. 함께 치자 · 지원 요청 · 군대 빌리기가 열린다' },
  { ask: 'gift', does: '곡식·철을 보내 호감을 산다. 늘 받는다' },
]
/** 자세한 것이 필요한 사신 — goods: 곡식·철 · place: 고을 · confirm: 다짐 */
const ASK_NEEDS: Partial<Record<Ask, 'goods' | 'place' | 'confirm'>> = { trade: 'goods', gift: 'goods', aid: 'goods', tribute: 'goods', joint: 'place', troops: 'place', break: 'confirm' }
const ASK_HINT: Partial<Record<Ask, string>> = {
  trade: '무엇을 주고 무엇을 받을지 정한다.',
  gift: '선물은 늘 받는다. 호감이 오른다.',
  aid: '동맹에게 곡식·철을 보태 달라고 한다. 호감이 높을수록 많이 준다.',
  tribute: '바치라고 할 몫을 정한다. 거절하면 전쟁이 난다.',
  joint: '동맹이 두 계절 안에 칠 곳을 고른다. 지키면 호감이 오르고, 못 지키면 내려간다.',
  troops: '동맹 군대가 와서 몇 계절 지켜 줄 우리 고을을 고른다.',
  break: '약조를 깨면 다른 나라들도 우리를 덜 믿는다.',
}
/** 집이 느는(주는) 까닭 — economy.hhGrowth 의 열쇠 */
const GROWTH_WHY: Readonly<Record<string, string>> = {
  fed: '배부르고 평화롭다', hunger: '굶는다', post: '맡은 장수가 돌본다', settle: '새로 일군 땅이라 빨리 큰다', full: '더 들어설 자리가 없다', threat: '적이 다가와 술렁인다',
}
const NO_COMPOSE = { to: '', ask: 'truce' as Ask, give: { grain: 0, iron: 0 }, take: { grain: 0, iron: 0 }, target: '' }
const DRAFTABLE: readonly UnitKind[] = ['spear', 'bow', 'shield']
/** 공작 다섯의 그림 */
const PLOT_ICON: Readonly<Record<PlotOp, string>> = {
  rumor: 'status-morale-down', sow: 'status-betrayal', bribe: 'good-cowries', burn: 'status-famine', spy: 'status-spy', assassin: 'unit-archer',
}
const TABS = [
  { id: 'army', name: '군대', icon: 'unit-shield-wall' },
  { id: 'draft', name: '징병', icon: 'unit-spear' },
  { id: 'diplo', name: '외교', icon: 'good-tribute-bell' },
  { id: 'heroes', name: '장수', icon: 'unit-general' },
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

/** 나라마다 얼굴 하나 — 그 나라의 군주 (판의 Faction.ruler 와 같은 id — 나라 고르기 화면엔 판이 없어 이름 규칙으로) */
const rulerId = (nation: string): string => `${nation}-ruler`
function nationFace(id: string): string {
  const hid = rulerId(id)
  const file = hid !== undefined ? HERO_BUST[hid] : undefined
  return file !== undefined ? `<img class="nface" src="${ART}bust/${file}.jpg" alt="">` : ''
}

export function mountRealmApp(root: HTMLElement, host: AppHost): { show(r: Realm | null, before: Realm | null, report: Report | null): void } {
  const style = document.createElement('style')
  style.textContent = APP_CSS + MAP_CSS + FEEL_CSS + BATTLE_CSS + HERO_CSS + GROW_CSS
  document.head.appendChild(style)
  root.classList.add('ap')
  root.innerHTML = `<header class="top"></header><div class="mapwrap"></div><div class="legend"></div><div class="zbtns"><button data-act="zin">＋</button><button data-act="zout">－</button></div><button class="next" data-act="next"></button>`
    + `<nav class="tabs"></nav><div class="back" data-act="close"></div><section class="sheet"></section><div class="modal"></div>`
  const $ = (sel: string): HTMLElement => root.querySelector<HTMLElement>(sel)!
  const zoom = attachZoom($('.mapwrap'))

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
  /** 소도 제사 — 봄·가을에 한 번 */
  let rite = false
  /** 남의 나라가 걸어온 청에 대한 답 — 답이 없으면 거절로 친다 */
  const answers: Record<string, boolean> = {}
  /** 경계를 강화할 우리 고을 */
  let guards: string[] = []
  /** 보고 카드에서 답·경계를 누른 뒤 다시 그릴 때는 싸움 카드를 다시 돌리지 않는다 */
  let fastNext = false
  /** 이번 계절의 사신 — 상대 나라마다 하나 */
  const envoys: Record<string, Envoy> = {}
  /** 이번 계절의 공작 (한 계절에 P.realm.plotsPerSeason 개) · 외교 판의 갈래 · 펼친 공작 */
  let plots: Order[] = []
  /** 장수 명령 — 맡기기 · 이끌기 · 회유 · 떠돌이 들이기 (HEROES §3·§4) */
  let heroOrders: Order[] = []
  /** 회유를 맡길 장수 — 포로마다 */
  const persuadeBy: Record<string, string> = {}
  let diploMode: 'envoy' | 'plot' = 'envoy'
  let plotOpen: PlotOp | null = null
  /** 암살에 보낼 자객 — 우리 장수 id, null 이면 고용 자객 */
  let plotAgent: string | null = null
  /** 시트 안의 손 상태 */
  let openArmy = ''
  let armyMode: 'move' | 'split' = 'move'
  /** 일부만 보내기 — 떼어 낼 수 · 장수가 따라가나(기본은 본대에 남는다) · 갈 길 */
  let split: { take: Partial<Record<UnitKind, number>>; hero: boolean; edge: string | null; ambush: boolean } = { take: {}, hero: false, edge: null, ambush: false }
  const draftUnit: Record<string, UnitKind> = {}
  const draftN: Record<string, number> = {}
  /** 징병에 철을 들여 한 단계 좋은 무기로 */
  const draftIron: Record<string, boolean> = {}
  const settleN: Record<string, number> = {}
  const settleFrom: Record<string, string> = {}
  /** 사신을 꾸미는 중 — 누구에게 · 무엇을 · 얼마 · 어디 */
  let compose: { to: string; ask: Ask; give: { grain: number; iron: number }; take: { grain: number; iron: number }; target: string } = { ...NO_COMPOSE, give: { grain: 0, iron: 0 }, take: { grain: 0, iron: 0 } }
  let note = ''
  /** 방금 나눈 무리 — 그 카드를 밝히고 눈앞으로 가져온다 (다음 누름에 지운다) */
  let freshArmy = ''
  /** 지도에서 고른 우리 군대 — 갈 곳이 밝아진다 */
  let armySel = ''
  /** 탭의 빨간 점 — 본 것 */
  let seenKeys = new Set<string>()
  /** 지도에서 또렷하게 볼 나라 — 깃발 줄에서 누른다 */
  let focus: string | null = null

  const me = (): string => realm!.player
  // 맡기기·이끌기는 나누기처럼 먼저 해 본 판에 든다 — 장수 카드가 바뀐 자리를 바로 보인다
  // 들이기도 든다 — 들인 떠돌이가 바로 우리 장수로 보이고 군대를 이끌 수 있게 (형: "들인다 했을때 바로 적용되어야 하고 군사배치에도 쓸수 있어야 함")
  const plan = (): Realm => planned(realm!, [...armyOrders, ...settles, ...heroOrders.filter((o) => o.kind === 'hire' || o.kind === 'assign' || o.kind === 'lead')])

  function resetTurn(): void {
    armyOrders = []
    musters = []
    settles = []
    for (const k of Object.keys(pick)) delete pick[k]
    scout = ''
    rite = false
    for (const k of Object.keys(answers)) delete answers[k]
    guards = []
    for (const k of Object.keys(envoys)) delete envoys[k]
    plots = []
    heroOrders = []
    plotOpen = null
    openArmy = ''
    note = ''
    compose = { ...NO_COMPOSE, give: { grain: 0, iron: 0 }, take: { grain: 0, iron: 0 } }
  }

  function ordersNow(): Order[] {
    const p = plan()
    const out: Order[] = [...armyOrders, ...settles, ...heroOrders, ...musters]
    for (const [army, c] of Object.entries(pick)) {
      const a = p.armies[army]
      if (c !== undefined && a !== undefined && a.march === null) out.push({ kind: 'march', army, edge: c.edge, ambush: c.ambush })
    }
    if (scout !== '') out.push({ kind: 'scout', faction: me(), node: scout, hero: null })
    if (rite) out.push({ kind: 'rite', faction: me() })
    for (const [ask, yes] of Object.entries(answers)) out.push({ kind: 'answer', ask, yes })
    for (const node of guards) out.push({ kind: 'guard', faction: me(), node })
    for (const to of Object.keys(envoys).sort()) out.push(envoys[to]!)
    out.push(...plots)
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
      + `<button class="stat nat" data-act="tab" data-tab="nation">${bust(r.heroes[r.factions[me()]?.ruler ?? rulerId(me())], 'tface')}${emblem(me())}<b>${esc(nation?.name ?? '')}</b></button></div>`
  }

  // ───────── 지도
  function mapPart(r: Realm): string {
    const marches: MapMarch[] = []
    for (const a of Object.values(r.armies)) {
      if (a.faction !== me()) continue
      if (a.march !== null) marches.push({ from: a.march.from, to: a.march.to, left: a.march.left, ambush: a.march.ambush })
      const c = pick[a.id]
      const ed = c !== undefined && a.march === null ? r.edges[c.edge] : undefined
      if (ed !== undefined) marches.push({ from: a.at, to: otherEnd(ed, a.at)!, left: null, ambush: c!.ambush })
    }
    for (const a of seenMarches(r, me())) if (a.march !== null) marches.push({ from: a.march.from, to: a.march.to, left: a.march.left, foe: true })
    const sel = sheet?.kind === 'node' ? sheet.id : scout
    // 지도에서 바로 움직인다 (형: "다른게임에서는 지도에서 바로 배치 조절하는거 같은데") — 말을 누르고, 밝아진 고을을 누른다
    const tokens: MapToken[] = sorted(Object.values(r.armies)).filter((a) => a.faction === me() && a.march === null).map((a) => {
      const hero = a.hero !== null ? r.heroes[a.hero] : undefined
      const file = hero !== undefined ? HERO_BUST[hero.id] : undefined
      const top = (Object.entries(a.mix) as Array<[UnitKind, number]>).sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'spear'
      return {
        army: a.id, node: a.at, men: headcount(forceOf(r, a)), sel: armySel === a.id, going: pick[a.id] !== undefined,
        img: file !== undefined ? `${ART}bust/${file}.jpg` : `${ART}icon/${UNIT_ICON[top]}.png`,
      }
    })
    const a = armySel !== '' ? r.armies[armySel] : undefined
    const targets: MapTarget[] = a === undefined || a.march !== null ? [] : movesOf(r, me(), a).map((m) => ({
      node: m.to, edge: m.edge.id, off: m.blocked !== null, on: pick[a.id]?.edge === m.edge.id,
      chip: m.blocked !== null ? `<span class="tn">${esc(BLOCKED_LINE[m.blocked])}</span>`
        : m.hostile ? (m.win !== null ? fightFeel(m.win[0], m.win[1]) : unknownFeel()) : `<span class="tn">${m.seasons}계절</span>`,
    }))
    return mapHtml(r, me(), ART, marches, sel, focus, tokens, targets)
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
      if (m.hostile && !off && on) h += attackChoice(r, a, m, chosen?.ambush === true)
    }
    return h
  }

  /**
   * 어떻게 칠지 — 정면과 기습을 나란히 (형: "그냥공격하는거랑 기습하는거랑 사용자입장에서 느껴지는게 없음").
   * 기습은 도박이다: 먹히면 성·장정을 건너뛰고, 들키면 기다리던 적에게 맞는다. 큰 군대는 잘 안 숨는다.
   */
  function attackChoice(r: Realm, a: Army, m: Move, ambush: boolean): string {
    const feel = (w: readonly [number, number] | null): string => (w !== null ? fightFeel(w[0], w[1]) : unknownFeel())
    const node = r.nodes[m.to]!
    const walled = node.kind === 'fort' || node.tags.includes('palisade') || node.tags.includes('high')
    let h = `<div class="how">`
    h += `<button class="hw ${ambush ? '' : 'on'}" data-act="amb" data-army="${a.id}" data-v="0"><b>정면으로 친다</b>`
    h += `<span class="ln">판세 ${feel(m.win)}</span><span class="mute">${walled ? '성과 언덕을 그대로 맞는다' : '드러내 놓고 들어간다'} · 장정이 막아선다</span></button>`
    h += `<button class="hw amb ${ambush ? 'on' : ''}" data-act="amb" data-army="${a.id}" data-v="1"><b>기습한다</b>`
    h += `<span class="ln">숨어 닿기 ${ambushFeel(m.ambushP)}</span>`
    h += `<span class="ln">먹히면 ${feel(m.winAmbush)}</span><span class="ln">들키면 ${feel(m.winCaught)}</span>`
    h += `<span class="mute">먹히면 ${walled ? '성문이 닫히기 전에 들이치고 ' : ''}장정이 못 모인다</span></button></div>`
    if (headcount(forceOf(r, a)) > P.realm.ambushFreeMen) h += `<p class="mute tip">군사가 많으면 잘 안 숨는다. 작게 나눠 보내면 숨기 쉽다.</p>`
    return h
  }

  /**
   * 일부만 보내기 — ① 몇 명을 떼나 ② 장수가 따라가나(기본: 본대에 남는다) ③ 어디로 가나. 확정하면 떼어 낸 무리가 그 길로 떠난다.
   */
  function splitPanel(r: Realm, a: Army): string {
    const hero = a.hero !== null ? r.heroes[a.hero] : undefined
    const sent = Object.values(split.take).reduce((s, n) => s + (n ?? 0), 0)
    const total = headcount(forceOf(r, a))
    let h = `<div class="splitp"><div class="mute">① 보낼 군사</div>`
    for (const [k, n] of Object.entries(a.mix) as Array<[UnitKind, number]>) {
      if (n <= 0) continue
      const v = split.take[k] ?? 0
      const step = Math.max(5, Math.round(n / 10 / 5) * 5)
      h += `<div class="sprow">${icon(UNIT_ICON[k])}<span class="spn">${UNIT_NAME[k]}</span><span class="stepper sm">`
      h += `<button data-act="sq" data-army="${a.id}" data-kind="${k}" data-d="${-step}">−</button><b>${v}</b>`
      h += `<button data-act="sq" data-army="${a.id}" data-kind="${k}" data-d="${step}">+</button></span><span class="mute">/ ${n}</span></div>`
    }
    h += `<div class="spsum">보낸다 <b>${sent}</b>명 · 남는다 <b>${total - sent}</b>명${hero !== undefined && !split.hero ? ` · ${esc(josa(hero.name, '과', '와'))} 함께` : ''}</div>`
    if (hero !== undefined && hero.status === 'free') {
      h += `<div class="mute">② 장수</div><div class="seg"><button class="${split.hero ? '' : 'on'}" data-act="shero" data-v="0">${esc(josa(hero.name, '은', '는'))} 본대에 남는다</button>`
      h += `<button class="${split.hero ? 'on' : ''}" data-act="shero" data-v="1">${esc(josa(hero.name, '이', '가'))} 이끌고 간다</button></div>`
    }
    // ③ 갈 곳 — 떼어 낼 무리의 힘으로 판세를 본다
    const probe: Army = { id: '~split', faction: a.faction, hero: split.hero ? a.hero : null, mix: { ...split.take }, equip: a.equip, morale: a.morale, at: a.at, march: null }
    h += `<div class="mute">③ 갈 곳</div><div class="rows">`
    h += `<button class="row ${split.edge === null ? 'on' : ''}" data-act="sstay">떼어 두기만 한다 (여기 남는다)</button>`
    for (const m of movesOf(r, me(), probe)) {
      const node = r.nodes[m.to]!
      const off = m.blocked !== null
      const on = split.edge === m.edge.id
      let right = ''
      if (off) right = `<span class="mute">${BLOCKED_LINE[m.blocked!]}</span>`
      else if (m.hostile && sent > 0) right = `<span class="win">${m.win !== null ? fightFeel(m.win[0], m.win[1]) : unknownFeel()}</span>`
      h += `<button class="row mv ${on ? 'on' : ''}" data-act="sdest" data-edge="${m.edge.id}" ${off ? 'disabled' : ''}>${emblem(node.owner)}<span class="dest">${esc(node.name)}</span><span class="sub">${EDGE_NAME[m.edge.kind]} · ${m.seasons}계절</span>${right}</button>`
      if (on && m.hostile && !off) {
        h += `<div class="seg"><button class="${split.ambush ? '' : 'on'}" data-act="samb" data-v="0">정면</button>`
        h += `<button class="${split.ambush ? 'on' : ''}" data-act="samb" data-v="1">기습 ${ambushFeel(m.ambushP)}</button></div>`
      }
    }
    h += `</div>`
    const dest = split.edge !== null ? r.nodes[otherEnd(r.edges[split.edge]!, a.at)!]?.name : null
    const label = sent <= 0 ? '보낼 군사를 고른다' : dest != null ? `${sent}명을 ${josa(dest, '으로', '로')} 보낸다` : `${sent}명을 떼어 둔다`
    // 못 나누는 까닭은 누르기 전에 바로 여기서 (형: "보낸다 하면 변하는게 없음 그자리에서")
    const why = sent > 0 ? splitBlocked(r, a, sent, total) : null
    if (why !== null) h += `<div class="banner bad">${esc(why)}</div>`
    h += `<button class="btn on wide" data-act="split" data-army="${a.id}" ${sent <= 0 || why !== null ? 'disabled' : ''}>${esc(label)}</button></div>`
    return h
  }

  /** 나누기가 안 되는 까닭 — 되면 null (엔진 season.splitArmy 의 규칙과 같다) */
  function splitBlocked(r: Realm, a: Army, sent: number, total: number): string | null {
    const n = Object.values(r.armies).filter((x) => x.faction === a.faction).length
    if (n >= P.realm.armyMax) return `군대가 벌써 ${n}개다. ${P.realm.armyMax}개까지만 둔다. 다른 군대를 합류시키면 자리가 난다.`
    if (sent < P.realm.splitMin) return `${P.realm.splitMin}명은 넘게 보내야 한다.`
    if (total - sent < P.realm.splitMin) return `본대에 ${P.realm.splitMin}명은 남겨야 한다. 다 보내려면 "다 같이 간다"를 쓴다.`
    return null
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
    let h = `<h3>군대</h3>${threatsHtml(r)}${sortie(r)}`
    if (note !== '') h += `<div class="banner bad">${esc(note)}</div>`
    const armies = sorted(Object.values(r.armies)).filter((a) => a.faction === me())
    if (armies.length === 0) h += `<p class="mute">군대가 없다. 징병으로 뽑는다.</p>`
    for (const a of armies) {
      const hero = a.hero !== null ? r.heroes[a.hero] : undefined
      const disbanding = musters.some((o) => o.kind === 'disband' && o.army === a.id)
      const fresh = freshArmy === a.id
      h += `<div class="acard${fresh ? ' fresh' : ''}">${bust(hero)}<div class="ab">${fresh ? `<div class="banner good">나눴다 — ${pick[a.id] !== undefined && r.edges[pick[a.id]!.edge] !== undefined ? `${esc(josa(r.nodes[otherEnd(r.edges[pick[a.id]!.edge]!, a.at)!]?.name ?? '', '으로', '로'))} 떠난다. 지도에 화살표가 생겼다.` : '여기 남는다.'}</div>` : ''}<div class="an"><b>${esc(armyName(r, a))}</b>`
      h += `<span class="mute">${esc(r.nodes[a.at]?.name ?? '')} · ${headcount(forceOf(r, a))}명</span></div><div class="units">`
      for (const [k, n] of Object.entries(a.mix) as Array<[UnitKind, number]>) {
        if (n > 0) h += `<span class="unit">${icon(UNIT_ICON[k])}${UNIT_NAME[k]} ${n}</span>`
      }
      h += `<span class="unit mute">${EQUIP_NAME[a.equip]}</span></div>`
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
      h += `<div class="btns"><button class="btn ${open && armyMode === 'move' ? 'on' : ''}" data-act="open" data-army="${a.id}" data-mode="move">다 같이 간다</button>`
      h += `<button class="btn ${open && armyMode === 'split' ? 'on' : ''}" data-act="open" data-army="${a.id}" data-mode="split">일부만 보낸다</button>`
      for (const b of armies) {
        if (b.id !== a.id && b.at === a.at && b.march === null) h += `<button class="btn" data-act="merge" data-army="${a.id}" data-into="${b.id}">${esc(armyName(r, b))}에 합류</button>`
      }
      // 장수 없는 군대 — 이 고을에 혼자 있는 우리 장군이 바로 이끈다 (들인 떠돌이도)
      if (a.hero === null) {
        for (const y of sorted(Object.values(r.heroes)).filter((x) => x.faction === me() && x.status === 'free' && x.at === a.at && !isRuler(r, x.id) && !Object.values(r.armies).some((b) => b.hero === x.id))) {
          h += `<button class="btn" data-act="lead" data-id="${y.id}" data-army="${a.id}">${esc(josa(y.name, '이', '가'))} 이끈다</button>`
        }
      }
      if (r.nodes[a.at]?.owner === me()) h += `<button class="btn ghost" data-act="disband" data-army="${a.id}">해산</button>`
      const ac = armCost(r, a.id)
      const arming = musters.some((o) => o.kind === 'arm' && o.army === a.id)
      if (ac !== null && r.nodes[a.at]?.owner === me()) {
        const st = r.stock[me()] ?? { grain: 0, iron: 0 }
        h += `<button class="btn ${arming ? 'on' : ''}" data-act="arm" data-army="${a.id}" ${arming || (st.iron >= ac.iron && st.grain >= ac.grain) ? '' : 'disabled'}>${arming ? '무장 올리는 중 · 취소' : `${josa(EQUIP_NAME[ac.to], '으로', '로')} · 철 ${ac.iron}`}</button>`
      }
      h += `</div>`
      if (pick[a.id] !== undefined && !open) {
        const ed = r.edges[pick[a.id]!.edge]
        if (ed !== undefined) h += `<div class="go">→ ${esc(r.nodes[otherEnd(ed, a.at)!]?.name ?? '')}${pick[a.id]!.ambush ? ' · 기습' : ''}</div>`
      }
      if (open && armyMode === 'move') h += `<div class="rows">${moveRows(r, a, null)}</div>`
      if (open && armyMode === 'split') h += splitPanel(r, a)
      h += `</div></div>`
    }
    if (armyOrders.length > 0) h += `<button class="btn ghost wide" data-act="undo-split">나누기·합류 되돌리기</button>`
    return h
  }

  // ───────── 징병
  function draftSheet(r: Realm): string {
    const season = seasonOf(r.season)
    let h = `<h3>징병</h3>`
    // 집 · 장정 · 군사가 뭐가 다른지 (형: "장정이랑 징병, 병사 뭔차이임?") — 한 줄 그림으로
    h += `<div class="flow3"><div>${icon('settle-farm-village')}<b>집</b><span>농사짓고 곡식을 낸다</span></div><i>징병 →</i>`
      + `<div>${icon('unit-spear')}<b>군사</b><span>움직이고 쳐들어간다 · 곡식을 먹는다</span></div></div>`
      + `<p class="mute">장정은 뽑지 않은 집의 사내들이다. 적이 오면 제 고을만 지킨다. 집이 많을수록 많고, 곡식을 안 먹는다.</p>`
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
      h += `<span class="mute">집 ${Math.floor(n.hh)} · 장정 ${militiaMen(r, n.id)}${done > 0 ? ` · 뽑는 중 ${done}` : ''}</span></div>`
      if (lim <= 0) {
        h += `<div class="mute">이번 계절엔 더 못 뽑는다</div></div>`
        continue
      }
      h += `<div class="seg">`
      for (const u of DRAFTABLE) h += `<button class="${u === unit ? 'on' : ''}" data-act="dunit" data-node="${n.id}" data-unit="${u}">${icon(UNIT_ICON[u])}${UNIT_NAME[u]}</button>`
      h += `</div><div class="stepper"><button data-act="dn" data-node="${n.id}" data-d="${-step}">−</button><b>${want}</b>`
      h += `<button data-act="dn" data-node="${n.id}" data-d="${step}">+</button><span class="mute">최대 ${lim} · 곡식 ${Math.ceil(draftCost(want).grain)}</span>`
      h += `<button class="btn on" data-act="draft" data-node="${n.id}" ${want <= 0 ? 'disabled' : ''}>뽑는다</button></div>`
      // 철을 더 들이면 처음부터 한 단계 좋은 무기 (철의 쓰임)
      const ic = want > 0 ? draftIronCost(r, me(), want) : null
      if (ic !== null) h += `<label class="chk"><input type="checkbox" data-act="diron" data-node="${n.id}" ${draftIron[n.id] === true ? 'checked' : ''}> ${josa(EQUIP_NAME[ic.to], '을', '를')} 들려 뽑는다 · 철 ${ic.iron}</label>`
      h += `</div>`
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
    h += `<span class="mute">집 ${Math.floor(n.hh)} / ${n.room ?? 0}</span></div>`
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

  // ───────── 남의 나라가 걸어온 청 · 다가오는 적 (형: "적이 뭔가 거래를 걸어온다거나 동맹요구하거나 · 기습에 대비하거나 경계를 강화하거나")
  function asksHtml(): string {
    const asks = openAsks(realm!, me())
    if (asks.length === 0) return ''
    let h = `<h4>사신이 왔다 · 이번 계절 안에 답한다</h4>`
    for (const a of asks) {
      const lead = realm!.heroes[realm!.factions[a.from]?.ruler ?? rulerId(a.from)]
      const ans = answers[a.id]
      h += `<div class="askc ${a.kind === 'demand' ? 'threat' : ''}"><div class="an">${bust(lead, 'rface')}<div class="fn"><b>${emblem(a.from, 'fem')}${esc(realm!.factions[a.from]?.name ?? '')}</b>`
      h += `<span class="mute">${ASK_KIND_NAME[a.kind]}</span></div></div><p>${esc(askLine(a, realm!.factions[a.from]?.name ?? '', a.node !== undefined ? (realm!.nodes[a.node]?.name ?? '') : ''))}</p>`
      if (a.why !== undefined) h += `<div class="why">속셈 · ${esc(whyLine(a.why, a.about !== undefined ? (realm!.factions[a.about]?.name ?? '') : ''))}</div>`
      h += `<div class="btns"><button class="btn ${ans === true ? 'on' : ''}" data-act="answer" data-id="${a.id}" data-yes="1">받는다</button>`
      h += `<button class="btn ${ans === false ? 'on' : ''}" data-act="answer" data-id="${a.id}" data-yes="0">거절한다</button>`
      if (ans === undefined) h += `<span class="mute">답하지 않으면 거절</span>`
      h += `</div></div>`
    }
    return h
  }

  /** 우리 고을로 오는 적 — 보인 행군마다 경계 강화 단추 */
  function threatsHtml(r: Realm): string {
    const foes = seenMarches(realm!, me()).filter((a) => a.march !== null && realm!.nodes[a.march.to]?.owner === me())
    if (foes.length === 0) return ''
    const suspect = new Set((report?.lines ?? []).filter((l) => l.kind === 'sighted' && l.suspect === true).map((l) => (l as { army: string }).army))
    let h = `<h4>다가오는 적</h4>`
    for (const a of foes) {
      const to = a.march!.to
      const on = guards.includes(to)
      const can = on || canGuard(r, me(), to)
      h += `<div class="row">${emblem(a.faction)}<span>${esc(realm!.factions[a.faction]?.name ?? '')} → <b>${esc(realm!.nodes[to]?.name ?? '')}</b> · ${a.march!.left}계절${suspect.has(a.id) ? ' · <span class="sus">몰래 오는 낌새</span>' : ''}</span>`
      h += `<button class="btn sm ${on ? 'on' : ''}" data-act="guard" data-node="${to}" ${can ? '' : 'disabled'}>경계 강화 · 곡식 ${guardCost().grain}</button></div>`
    }
    return h
  }

  // ───────── 소도
  /**
   * 소도의 제사 (형: "소도는 왜있는거고?") — 씨 뿌린 봄과 거둔 가을에 귀신에게 제사한다 (삼한 사료).
   * 소도와 맞닿은 고을을 쥔 나라만 지낸다 — 그래서 소도 곁 땅이 다툴 거리가 된다. 소도 안의 군대는 아무도 못 친다.
   */
  function riteCard(r: Realm): string {
    const season = seasonOf(r.season)
    let h = `<p class="story">천군이 지키는 성스러운 땅이다. 칼을 들고 들어가 싸울 수 없다. 여기 머무는 군대는 아무도 못 친다.</p>`
    const rc = riteCost(r, me(), season)
    h += `<div class="ncard"><div class="an">${icon('status-good-omen', 'nic')}<b>제사</b><span class="mute">봄·가을에 한 번 · 이번엔 곡식 ${rc.grain}${rc.iron > 0 ? ` · 철 ${rc.iron}` : ''}</span></div>`
    h += `<div class="mute">봄 제사는 그해 가을 수확을 늘린다. 가을 제사는 군사들 사기를 올린다. 소도와 맞닿은 고을을 차지해야 지낸다.</div>`
    if (rite) h += `<div class="btns"><button class="btn on" data-act="rite">제사를 지낸다 · 취소</button></div>`
    else if (season !== 'spring' && season !== 'autumn') h += `<div class="mute">지금은 제사철이 아니다.</div>`
    else if (!riteAllowed(r, me())) h += `<div class="mute">지금은 지낼 수 없다. 소도 곁 고을이 없거나 곡식이 모자라다.</div>`
    else h += `<div class="btns"><button class="btn on" data-act="rite">${season === 'spring' ? '봄 제사를 지낸다' : '가을 제사를 지낸다'}</button></div>`
    return h + `</div>`
  }

  // ───────── 외교
  function diploSheet(r: Realm): string {
    let h = `<h3>외교</h3><div class="seg dseg"><button class="${diploMode === 'envoy' ? 'on' : ''}" data-act="dmode" data-v="envoy">사신</button><button class="${diploMode === 'plot' ? 'on' : ''}" data-act="dmode" data-v="plot">공작 ${plots.length > 0 ? plots.length : ''}</button></div>`
    if (diploMode === 'plot') return h + plotSheet(r)
    h += asksHtml()
    const out = Object.values(envoys)
    for (const e of out) {
      h += `<div class="banner good">사신: ${esc(r.factions[e.to]?.name ?? '')}에 ${ASK_NAME[e.ask]}<button class="btn ghost sm" data-act="unenvoy" data-to="${e.to}">거둔다</button></div>`
    }
    if (out.length === 0) h += `<p class="mute">나라마다 한 계절에 사신 하나씩 보낼 수 있다</p>`
    // 맺으면 뭐가 되는지 (형: "화친이랑 동맹도 되면 뭐가 되는건지 모르겠네")
    h += `<div class="asks">${ASKS.map((x) => `<div><b>${ASK_NAME[x.ask]}</b><span>${x.does}</span></div>`).join('')}</div>`
    // 앞서가는 나라 — 모두 이기려 하니, 앞선 나라는 다른 나라들이 함께 막으려 한다 (stance.leaderOf)
    const L = leaderOf(r, me())
    if (L === me()) h += `<div class="banner bad">우리가 앞서간다. 다른 나라들이 손을 잡고, 맺은 약조도 깨고 등을 돌릴 수 있다.</div>`
    else if (L !== null) h += `<div class="banner">앞서가는 나라: ${emblem(L, 'fem')}<b>${esc(r.factions[L]?.name ?? '')}</b> · 다른 나라들이 함께 막으려 한다. 손잡을 때다.</div>`
    for (const f of sorted(Object.values(r.factions)).filter((x) => x.id !== me())) {
      const rel = relationOf(r, me(), f.id)
      const left = rel.until !== null ? ` ${Math.max(0, rel.until - r.season)}계절` : ''
      const lead = r.heroes[f.ruler ?? rulerId(f.id)]
      h += `<div class="fcard"><div class="an">${lead !== undefined ? `<button class="fbtn" data-act="hero" data-id="${lead.id}">${bust(lead, 'rface')}</button>` : ''}<div class="fn"><b>${emblem(f.id, 'fem')}${esc(f.name)}</b><span class="mute">${lead !== undefined ? `군주 ${esc(lead.name)}${lead.status === 'captive' ? ' · 사로잡힘' : lead.status === 'dead' ? ' · 죽음' : ''}` : ''}</span></div><span class="rel ${rel.state}">${REL_NAME[rel.state]}${left}</span></div>`
      h += `<div class="frow"><span class="mute">${REL_NOW[rel.state]}</span>${favorFeel(favorOf(r, me(), f.id))}</div>`
      // 그쪽 속셈 — 우리와 화친·동맹할 까닭이 있으면 보인다 (형: "근거가 있게 움직여야해"). 깰 속셈은 안 보인다
      const tw = truceWhy(r, f.id, me())
      const aw = tw === null ? allianceWhy(r, f.id, me()) : null
      const mw = tw ?? aw
      if (mw !== null) {
        h += `<div class="why">속셈 · ${tw !== null ? '화친할 마음이 있다' : '손잡을 마음이 있다'} — ${esc(whyLine(mw.why, mw.about !== undefined ? (r.factions[mw.about]?.name ?? '') : ''))}</div>`
      } else if (rel.state === 'war' && winningAgainst(r, f.id, me())) h += `<div class="why">속셈 · 이기고 있다고 여긴다 — 화친은 잘 안 받는다</div>`
      // 맺은 약속 — 두 계절 안에 칠 곳 (동맹의 "함께 치자")
      for (const p of rel.pledges ?? []) {
        const who = p.by === me() ? '우리가' : josa(f.name, '이', '가')
        h += `<div class="banner ${p.by === me() ? 'bad' : 'good'}">약속: ${esc(who)} ${esc(josa(r.nodes[p.node]?.name ?? '', '을', '를'))} 친다 · ${Math.max(0, p.until - r.season)}계절 안에</div>`
      }
      // 사이에 따라 보낼 수 있는 사신이 다르다 (형: "동맹 되고나서도 동맹버튼이 아직도 활성이면 뭘 의미하는거고")
      h += `<div class="btns">`
      for (const ask of envoyOptions(r, me(), f.id)) {
        const sel = envoys[f.id]?.ask === ask
        const sure = ask === 'gift' || ask === 'break'
        const c = envoyChance(r, me(), f.id, ask)
        const needs = ASK_NEEDS[ask] !== undefined
        h += `<button class="btn ${sel || (compose.to === f.id && compose.ask === ask) ? 'on' : ''}${ask === 'break' ? ' ghost' : ''}" data-act="${needs ? 'compose' : 'envoy'}" data-to="${f.id}" data-ask="${ask}" ${envoys[f.id] !== undefined && !sel ? 'disabled' : ''}>`
        h += `${ASK_NAME[ask]}${sure ? '' : ` ${envoyFeel(c[0], c[1])}`}</button>`
      }
      h += `</div>`
      if (compose.to === f.id && envoys[f.id] === undefined) h += composeHtml(r, f.id)
      h += `</div>`
    }
    return h
  }

  /** 사신의 자세한 것 — 교역·선물·지원·조공은 무엇을 얼마나, 함께 치자는 어디를, 군대 빌리기는 어느 고을로, 약조 깨기는 다짐 */
  function composeHtml(r: Realm, to: string): string {
    const ask = compose.ask
    const need = ASK_NEEDS[ask]
    const st = r.stock[me()] ?? { grain: 0, iron: 0 }
    let h = `<div class="trade"><div class="mute">${esc(ASK_HINT[ask] ?? '')}</div>`
    let ok = true
    if (need === 'goods') {
      const sides = ask === 'trade' ? (['give', 'take'] as const) : ask === 'gift' ? (['give'] as const) : (['take'] as const)
      for (const side of sides) {
        h += `<div class="tr2"><span>${side === 'give' ? '준다' : '받는다'}</span>`
        for (const res of ['grain', 'iron'] as const) {
          h += `<span class="stepper sm">${icon(res === 'grain' ? 'good-rice' : 'treasure-iron-ingots')}`
          h += `<button data-act="cq" data-side="${side}" data-res="${res}" data-d="-10">−</button><b>${compose[side][res]}</b>`
          h += `<button data-act="cq" data-side="${side}" data-res="${res}" data-d="10">+</button></span>`
        }
        h += `</div>`
      }
      ok = compose.give.grain <= st.grain && compose.give.iron <= st.iron
        && compose.give.grain + compose.give.iron + compose.take.grain + compose.take.iron > 0
    } else if (need === 'place') {
      const places = ask === 'joint' ? jointTargets(r, me(), to) : sorted(Object.values(r.nodes)).filter((n) => n.owner === me()).map((n) => n.id)
      if (places.length === 0) h += `<div class="mute">고를 곳이 없다.</div>`
      h += `<div class="rows">`
      for (const id of places) {
        h += `<button class="row ${compose.target === id ? 'on' : ''}" data-act="ctarget" data-node="${id}">${emblem(r.nodes[id]?.owner ?? null)}<span class="dest">${esc(r.nodes[id]?.name ?? '')}</span></button>`
      }
      h += `</div>`
      ok = compose.target !== ''
    }
    const sure = ask === 'gift' || ask === 'break'
    const c = envoyChanceFor(r, me(), to, ask, compose.give, compose.take)
    h += `<button class="btn on" data-act="envoy" data-to="${to}" data-ask="${ask}" ${ok ? '' : 'disabled'}>${ask === 'break' ? '정말 깬다' : '사신을 보낸다'}${sure ? '' : ` ${envoyFeel(c[0], c[1])}`}</button></div>`
    return h
  }

  // ───────── 공작 (형: "다양한 외교나 공작이 가능 해야하는거 아님?")
  function plotSheet(r: Realm): string {
    const max = P.realm.plotsPerSeason
    let h = `<p class="mute">몰래 하는 일. 한 계절에 ${max}개까지. 들키면 그 나라와 사이가 나빠진다. 지략 높은 장수가 있으면 잘 된다.</p>`
    for (const [i, o] of plots.entries()) {
      if (o.kind !== 'plot') continue
      const where = o.node !== undefined ? r.nodes[o.node]?.name : o.other !== undefined ? `${r.factions[o.target]?.name} ↔ ${r.factions[o.other]?.name}` : r.factions[o.target]?.name
      const target = o.hero !== undefined ? r.heroes[o.hero]?.name : where
      h += `<div class="banner good">${PLOT_NAME[o.op]} · ${esc(target ?? '')}<button class="btn ghost sm" data-act="unplot" data-i="${i}">거둔다</button></div>`
      // 암살은 직접 쏠 수 있다 — 밤 판 (SNIPE §0). 안 쏘면 굴림
      if (o.op === 'assassin') {
        h += o.hand !== undefined
          ? `<div class="banner ${o.hand.result === 'dead' || o.hand.result === 'wounded' ? 'good' : 'bad'}">직접 쐈다 · ${HAND_NAME[o.hand.result]}${o.hand.alarm ? ' · 들켰다' : ''}</div>`
          : `<button class="btn on wide" data-act="shoot" data-i="${i}">${icon('unit-archer')} 직접 쏜다 · 밤 지붕 위로</button><p class="mute">안 쏘면 자객 솜씨로 굴린다.</p>`
      }
    }
    const full = plots.length >= max
    const st = r.stock[me()] ?? { grain: 0, iron: 0 }
    for (const op of PLOT_OPS) {
      // 암살은 자객을 고른다 — 우리 장수(혼자 머무는 이) 또는 고용 자객
      const agents = op === 'assassin' ? plotAgents(realm!, me()) : []
      const agent = op === 'assassin' && plotAgent !== null && agents.includes(plotAgent) ? plotAgent : null
      const cost = plotCost(op, agent)
      const open = plotOpen === op
      h += `<div class="ncard"><button class="plh" data-act="plot-open" data-op="${op}">${icon(PLOT_ICON[op], 'nic')}<span><b>${PLOT_NAME[op]}</b><span class="mute">${PLOT_DOES[op]}</span></span>`
      h += `<span class="mute cost">곡식 ${cost.grain}${cost.iron > 0 ? ` · 철 ${cost.iron}` : ''}</span></button>`
      if (open) {
        const afford = st.grain >= cost.grain && st.iron >= cost.iron
        const targets = plotTargets(realm!, me(), op)
        if (op === 'assassin') {
          h += `<img class="plimg" src="${ART}event/event-assassin-archer.jpg" alt="">`
          h += `<div class="mute">누구를 보내나</div><div class="seg"><button class="${agent === null ? 'on' : ''}" data-act="pagent" data-id="">고용 자객</button>`
          for (const id of agents.slice(0, 3)) h += `<button class="${agent === id ? 'on' : ''}" data-act="pagent" data-id="${id}">${esc(r.heroes[id]?.name ?? id)}</button>`
          h += `</div>`
          if (agents.length === 0) h += `<div class="mute">보낼 장수가 없다. 군대를 안 이끌고 쉬는 장수만 자객이 된다.</div>`
        }
        if (targets.length === 0) h += `<div class="mute">지금은 노릴 데가 없다.${op === 'bribe' || op === 'spy' ? ' 아는 마을이어야 한다. 정찰부터.' : op === 'assassin' ? ' 겨뤄 본 적장만 노릴 수 있다.' : ''}</div>`
        h += `<div class="rows">`
        for (const t of targets) {
          const hero = t.hero !== undefined ? r.heroes[t.hero] : undefined
          const label = hero !== undefined ? `${hero.name} · ${r.factions[t.target]?.name}` : t.node !== undefined ? `${r.nodes[t.node]?.name} · ${r.factions[t.target]?.name}` : t.other !== undefined ? `${r.factions[t.target]?.name} ↔ ${r.factions[t.other]?.name}` : (r.factions[t.target]?.name ?? '')
          const c = plotChance(realm!, me(), op, t.target, t.node, t.hero, agent)
          const dup = plots.some((p) => p.kind === 'plot' && p.op === op && p.target === t.target && p.node === t.node && p.other === t.other && p.hero === t.hero)
          h += `<button class="row ${dup ? 'on' : ''}" data-act="plot" data-op="${op}" data-target="${t.target}" data-node="${t.node ?? ''}" data-other="${t.other ?? ''}" data-hero="${t.hero ?? ''}" data-agent="${agent ?? ''}" ${(full && !dup) || !afford ? 'disabled' : ''}>`
          h += `${hero !== undefined ? bust(hero, 'rface sm') : emblem(t.target)}<span class="dest">${esc(label)}</span><span class="win">${plotFeel(c[0], c[1])}</span></button>`
        }
        h += `</div>${afford ? '' : '<div class="mute">곡식이나 철이 모자라다</div>'}`
      }
      h += `</div>`
    }
    return h
  }

  // ───────── 밤 판 (SNIPE §0) — 지도 위에 틀(iframe)로 띄우고, 끝나면 postMessage 로 결과를 받는다
  function openNight(i: number): void {
    const o = plots[i]
    if (o === undefined || o.kind !== 'plot' || realm === null) return
    const agent = o.agent !== undefined ? realm.heroes[o.agent] : undefined
    const arrows = P.night.arrows + (agent?.traits?.includes('archer') === true ? P.night.archerBonus : 0)
    // 판의 배치는 판 시드·계절·대상으로 — 같은 계절 같은 대상이면 같은 밤
    let seed = (realm.seed ^ Math.imul(realm.season + 1, 2654435761)) >>> 0
    for (const ch of o.hero ?? o.target) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0
    const ov = document.createElement('div')
    ov.className = 'nightov'
    ov.innerHTML = `<iframe src="${NIGHT}?seed=${seed}&arrows=${arrows}&id=plot-${i}&back=about:blank" title="밤의 암살"></iframe><button class="btn" data-close>닫기</button>`
    root.appendChild(ov)
    const close = (): void => ov.remove()
    ov.querySelector('[data-close]')!.addEventListener('click', close)
    let loads = 0
    ov.querySelector('iframe')!.addEventListener('load', () => { if (++loads > 1) close() }) // "돌아가기"로 틀이 다른 쪽으로 가면 닫는다
  }

  window.addEventListener('message', (ev) => {
    if (ev.origin !== location.origin) return
    const m = ev.data as { type?: string; id?: string; result?: 'dead' | 'wounded' | 'fled' | 'withdrew'; alarm?: boolean }
    if (m?.type !== 'hanbal.night.result' || typeof m.id !== 'string' || !m.id.startsWith('plot-') || m.result === undefined) return
    const i = Number(m.id.slice(5))
    const o = plots[i]
    if (o === undefined || o.kind !== 'plot' || o.op !== 'assassin') return
    plots = plots.map((p, j) => (j === i ? { ...o, hand: { result: m.result!, alarm: m.alarm === true } } : p))
    host.onTap('night', m.result)
    paint()
  })

  // ───────── 장수 (docs/realm/HEROES.md §5)
  function heroRow(r: Realm, h: Hero, extra = ''): string {
    const seen = h.faction === me() || heroSeen(realm!, me(), h.id)
    return `<button class="hrow${isRuler(r, h.id) ? ' ruler' : ''}" data-act="hero" data-id="${h.id}">${bust(h)}<span class="hb">`
      + `<b>${esc(h.name)}${isRuler(r, h.id) ? ' <span class="mute">군주</span>' : ''}</b><span class="mute">${esc(roleLine(r, h))}</span>`
      + `<span class="tr3">${h.faction === me() && h.status === 'free' ? bondChip(r, h) : ''}${traitChips(h, seen)}</span>${extra}</span></button>`
  }

  function heroesSheet(r: Realm): string {
    const mine = sorted(Object.values(r.heroes)).filter((h) => h.faction === me() && h.status === 'free')
    const ruler = mine.filter((h) => isRuler(r, h.id))
    let h = `<h3>장수</h3>`
    for (const x of ruler) h += heroRow(r, x)
    h += `<h4>장군 · 누르면 능력치와 할 일</h4>`
    const hiredNow = new Set(heroOrders.flatMap((o) => (o.kind === 'hire' ? [o.hero] : [])))
    for (const x of mine.filter((y) => !isRuler(r, y.id))) h += heroRow(r, x, hiredNow.has(x.id) ? `<span class="newb">새로 들였다</span>` : '')
    // 떠돌이 인재 — 들일 수 있는 이
    const wand = wanderersFor(r, me()) // 들인 이는 벌써 위 장군 줄에 있다
    if (wand.length > 0) {
      h += `<h4>떠돌이 인재가 우리 고을에 왔다</h4>`
      for (const w of wand) {
        const hired = heroOrders.some((o) => o.kind === 'hire' && o.hero === w.hero.id)
        h += `<div class="askc">${heroRow(r, w.hero, `<span class="mute">${esc(r.nodes[w.node]?.name ?? '')} · ${Math.max(0, w.until - r.season)}계절 안에 떠난다</span>`)}`
        h += `<div class="btns"><button class="btn ${hired ? 'on' : ''}" data-act="hire" data-id="${w.hero.id}" ${hired || (r.stock[me()]?.grain ?? 0) >= w.price ? '' : 'disabled'}>${hired ? '들인다 · 취소' : `들인다 · 곡식 ${w.price}`}</button></div></div>`
      }
    }
    const caps = sorted(Object.values(r.heroes)).filter((x) => x.status === 'captive' && x.captor === me())
    if (caps.length > 0) {
      h += `<h4>사로잡은 장수 · 회유하면 우리 장수가 된다</h4>`
      for (const x of caps) h += heroRow(r, x)
    }
    const foes = sorted(Object.values(r.heroes)).filter((x) => x.faction !== me() && x.status === 'free' && heroSeen(realm!, me(), x.id))
    if (foes.length > 0) {
      h += `<h4>겨뤄 본 적장</h4>`
      for (const x of foes) h += heroRow(r, x)
    }
    return h
  }

  function heroSheet(r: Realm, id: string): string {
    const x = r.heroes[id] ?? (realm!.wanderers ?? []).find((w) => w.hero.id === id)?.hero
    if (x === undefined) return ''
    const ours = x.faction === me() && x.status === 'free'
    const seen = x.faction === me() || heroSeen(realm!, me(), x.id) || (realm!.wanderers ?? []).some((w) => w.hero.id === id)
    const file = HERO_BUST[x.id]
    let h = `<div class="hcard">${file !== undefined ? `<img class="big" src="${ART}bust/${file}.jpg" alt="">` : bust(x, 'face')}`
    h += `<div class="hn">${esc(x.name)}</div><div class="mute">${emblem(x.faction)}${esc(r.factions[x.faction]?.name ?? '떠돌이')}${isRuler(r, x.id) ? ' 군주' : ''} · ${esc(roleLine(r, x))}</div>`
    h += heroRadar(x, seen, ours)
    h += `<div class="tr3">${traitChips(x, seen)}</div>${traitLines(x, seen)}`
    if (ours) h += growthHtml(r, x)
    if (!seen) h += `<p class="mute">싸워 보거나 정찰하면 능력치가 보인다.</p>`
    h += `<div class="hacts">`
    const pending = heroOrders.filter((o) => (o.kind === 'assign' || o.kind === 'lead' || o.kind === 'persuade' || o.kind === 'hire') && o.hero === id)
    for (const o of pending) {
      const what = o.kind === 'assign' ? (o.node === null ? '맡은 일을 그만둔다' : `${josa(r.nodes[o.node]?.name ?? '', '을', '를')} 맡는다`) : o.kind === 'lead' ? '군대를 이끈다' : o.kind === 'hire' ? '우리 장수로 들였다' : '회유한다'
      h += `<div class="banner good">이번 계절: ${esc(what)}<button class="btn ghost sm" data-act="unhero" data-id="${id}">취소</button></div>`
    }
    if (ours && !isRuler(r, id) && pending.every((o) => o.kind === 'hire')) {
      const army = Object.values(r.armies).find((a) => a.hero === id)
      const at = army?.at ?? x.at ?? null
      const atName = at !== null ? (r.nodes[at]?.name ?? '') : ''
      if (army !== undefined && army.march === null && at !== null && r.nodes[at]?.owner === me()) {
        h += `<button class="btn" data-act="assign" data-id="${id}" data-node="${at}">군대에서 빠져 ${esc(josa(atName, '을', '를'))} 맡는다</button>`
      }
      if (army === undefined && at !== null) {
        if (x.post !== at && r.nodes[at]?.owner === me()) h += `<button class="btn" data-act="assign" data-id="${id}" data-node="${at}">${esc(josa(atName, '을', '를'))} 맡는다</button>`
        if (x.post != null) h += `<button class="btn ghost" data-act="assign" data-id="${id}" data-node="">맡은 일을 그만둔다</button>`
        for (const a of sorted(Object.values(r.armies)).filter((b) => b.faction === me() && b.at === at && b.march === null && b.hero === null)) {
          h += `<button class="btn" data-act="lead" data-id="${id}" data-army="${a.id}">${esc(armyName(r, a))}을 이끈다</button>`
        }
      }
      h += `<p class="mute">맡긴 고을엔 내정·지략·매력과 특성이 걸린다. 장군이 군대를 이끌면 무예·통솔이 싸움에 걸린다.</p>`
    }
    // 회유 — 우리가 사로잡은 장수
    if (x.status === 'captive' && x.captor === me() && x.persuade === undefined && pending.length === 0) {
      const bys = sorted(Object.values(r.heroes)).filter((y) => y.faction === me() && y.status === 'free')
      const best = [...bys].sort((a, b) => b.deok - a.deok)[0]
      const by = persuadeBy[id] ?? best?.id ?? null
      if (bys.length > 0) {
        h += `<div class="mute">누가 회유하나</div><div class="seg">`
        for (const y of bys.slice(0, 4)) h += `<button class="${y.id === by ? 'on' : ''}" data-act="pby" data-id="${id}" data-by="${y.id}">${esc(y.name)}</button>`
        h += `</div>`
      }
      h += `<button class="btn on" data-act="persuade" data-id="${id}" data-by="${by ?? ''}">회유한다 · ${persuadeSeasons(realm!, id, by)}계절쯤 · 계절마다 곡식 ${P.realm.persuadeGrain}</button>`
    }
    return h + `</div></div>`
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
    h += `<div class="goal">목표 · 도읍 셋을 차지한다 <b>${caps} / 3</b></div>`
    h += `<div class="grid4"><div>${icon('settle-farm-village')}<b>${mine.length}</b><span>고을</span></div>`
    h += `<div>${icon('good-hemp')}<b>${Math.floor(mine.reduce((s, n) => s + n.hh, 0))}</b><span>집</span></div>`
    h += `<div>${icon('good-rice')}<b>${Math.floor(st.grain)}</b><span>곡식</span></div>`
    h += `<div>${icon('treasure-iron-ingots')}<b>${Math.floor(st.iron)}</b><span>철</span></div></div>`
    const caps2 = Object.values(r.heroes).filter((x) => x.status === 'captive' && x.captor === me())
    if (caps2.length > 0) {
      h += `<h4>사로잡은 장수</h4><div class="caps">`
      for (const x of caps2) h += `<div class="cap">${bust(x, 'cface')}<b>${esc(x.name)}</b><span class="mute">${STAT_NAME.mu} ${x.mu} · ${STAT_NAME.ryak} ${x.ryak} · ${STAT_NAME.chi} ${x.chi} · ${STAT_NAME.deok} ${x.deok}</span></div>`
      h += `</div>`
    }
    h += `<div class="btns"><button class="btn" data-act="help">도움말</button><button class="btn ghost" data-act="newgame">새 판</button>`
    h += `<a class="btn ghost" href="${(import.meta.env?.BASE_URL ?? '/')}">활터</a>${PRACTICE_READY ? `<a class="btn ghost" href="${PRACTICE}">궁술 연습장</a>` : ''}</div>`
    h += `<div class="btns"><button class="btn ghost" data-act="export">기록 내보내기 <span class="mute">${host.gameCount()}판</span></button></div>`
    return h
  }

  function helpSheet(): string {
    return `<h3>도움말</h3><div class="help">`
      + `<p><b>한 계절 = 한 턴.</b> 명령을 고르고 다음 계절을 누른다.</p>`
      + `<p><b>봄</b> 씨를 뿌린다. 봄에 심은 집 수만큼 가을에 거둔다. <b>여름</b> 장마. 나루가 막히고 길이 느리다. `
      + `<b>가을</b> 추수. 곡식이 들어온다. <b>겨울</b> 강이 언다. 언 강으로 기습하기 좋다. 고개가 막힌다. 군량이 더 든다.</p>`
      + `<p><b>개척</b> 빈땅은 아무도 안 사는 땅이다. 그 땅을 누르거나 징병 탭 아래에서, 맞닿은 우리 고을 사람을 보낸다. 곡식이 들고, 일군 땅은 빨리 큰다. 군대로 먼저 깃발만 꽂아 둘 수도 있다.</p>`
      + `<p><b>집 · 장정 · 군사</b> 집은 농사짓고 곡식을 낸다. 징병하면 집이 군사가 된다. 군사는 움직이고 쳐들어가지만 곡식을 먹는다. 곡식이 떨어지면 사기가 꺾인다. 장정은 뽑지 않은 집의 사내들로, 적이 오면 제 고을만 지킨다. 해산하면 군사가 다시 집이 된다.</p>`
      + `<p><b>지도</b> 땅 색과 깃발이 주인. 왼쪽 위 깃발을 누르면 그 나라 땅만 또렷하다. 초록 수는 우리 군사, 붉은 수는 척후가 본 적 군세, ?는 아직 못 본 곳. ✕는 이번 계절 막힌 길. 보랏빛 화살은 다가오는 적.</p>`
      + `<p><b>판세</b>는 색으로 보인다. 초록이면 해볼 만하고 붉으면 무모하다. 두 색이 섞이고 ?가 붙으면 아직 잘 모른다. 정찰하면 또렷해진다.</p>`
      + `<p><b>소도</b> 성스러운 땅이라 아무도 못 친다. 소도 곁 고을을 차지하면 봄·가을에 제사를 지낸다. 봄 제사는 수확을, 가을 제사는 사기를 올린다.</p>`
      + `<p><b>협공</b> 같은 계절에 두 길로 들어가면 한 판으로 싸우고 더 세다.</p>`
      + `<p><b>목표</b> 나라마다 도읍이 하나씩 있다. 도읍 셋을 차지하면 이긴다. 우리 도읍을 빼앗기면 진다.</p></div>`
  }

  // ───────── 고을
  function nodeSheet(r: Realm, id: string): string {
    const n = r.nodes[id]!
    const known = (r.intel[me()] ?? {})[id]
    const ours = n.owner === me()
    const who = n.owner === null ? '주인 없음' : (r.factions[n.owner]?.name ?? '')
    const isCap = Object.values(r.factions).some((f) => f.capital === id)
    const kind = n.kind === 'wild' && n.hh > 0 ? SETTLED_NAME : isCap ? (n.kind === 'port' ? '도읍 · 항구' : '도읍') : NODE_KIND_NAME[n.kind]
    let h = `<div class="an big">${icon(nodeIcon(n), 'nic')}<div><h3>${esc(n.name)}</h3><span class="mute">${emblem(n.owner)}${esc(who)} · ${kind}</span></div></div>`
    if (ours || known?.land) {
      const lines = n.tags.map((t) => TAG_LINE[t]).join(' ')
      if (lines !== '') h += `<p class="story">${esc(lines)}</p>`
    }
    if (n.kind === 'sodo') h += riteCard(r)
    if (n.kind === 'wild') {
      if (n.owner === null) h += `<p class="story">아무도 살지 않는 땅이다. 사람을 보내 일구면 마을이 된다. ${n.room ?? 0}집까지 들어선다.</p>`
      if (n.owner === null || ours) {
        const can = settleTargets(r, me()).some((t) => t.to === id) || settlePending().some((o) => o.to === id)
        h += can ? settleCard(r, id) : `<p class="mute">우리 고을과 길로 맞닿고, 그 길이 열려 있어야 사람을 보낸다.</p>`
      }
    }
    if (ours) {
      const men = Object.values(r.armies).filter((a) => a.at === id && a.faction === me() && a.march === null).reduce((s, a) => s + headcount(forceOf(r, a)), 0)
      h += `<div class="grid4"><div><b>${Math.floor(n.hh)}</b><span>집</span></div><div><b>${militiaMen(r, id)}</b><span>장정</span></div><div><b>${men}</b><span>군사</span></div><div><b>${draftLimit(r, me(), id)}</b><span>더 뽑을 수</span></div></div>`
      const g = hhGrowth(r, id)
      h += `<p class="mute">다음 계절 집 <b>${g.per >= 0 ? '+' : ''}${g.per}</b>${g.why.length > 0 ? ` · ${g.why.map((w) => GROWTH_WHY[w] ?? w).join(' · ')}` : ''}</p>`
      const guarded = guards.includes(id)
      h += `<div class="btns"><button class="btn on" data-act="tab" data-tab="draft">여기서 징병</button>`
      h += `<button class="btn ${guarded ? 'on' : ''}" data-act="guard" data-node="${id}" ${guarded || canGuard(r, me(), id) ? '' : 'disabled'}>경계 강화 · 곡식 ${guardCost().grain}</button></div>`
      h += `<p class="mute">경계를 올리면 기습이 잘 들킨다. 한 계절 동안.</p>`
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
      if (cap !== undefined && cap.captor === after.player) cands.push([4, { ev: 'event-capture', hero: cap, line: `${josa(cap.name, '을', '를')} 사로잡았다` }])
      if (dead !== undefined && dead.faction !== after.player) cands.push([3, { ev: 'event-sniped-commander', hero: dead, line: `${dead.name}이(가) 쓰러졌다` }])
      if (weAtk && l.ambush === 'success') cands.push([2, { ev: 'event-night-raid', hero: null, line: `${node} 기습이 먹혔다` }])
      if (weAtk && l.ambush === 'caught') cands.push([2, { ev: 'event-night-raid', hero: null, line: `${node} 기습이 들켰다` }])
      if (!weAtk && l.ambush === 'success') cands.push([2, { ev: 'event-night-raid', hero: null, line: `${node}에 기습을 당했다` }])
      const lost = cap !== undefined && cap.faction === after.player ? cap : dead !== undefined && dead.faction === after.player ? dead : undefined
      if (lost !== undefined) cands.push([1, { ev: 'event-sniped-commander', hero: lost, line: `${josa(lost.name, '을', '를')} 잃었다` }])
      for (const [k, p] of cands) if (k > rank) { rank = k; best = p }
    }
    if (best === null) return ''
    return `<div class="scene"><img class="ev" src="${ART}event/${best.ev}.jpg" alt="">${best.hero !== null ? bust(best.hero, 'who') : ''}<div class="brag">${esc(best.line)}</div></div>`
  }

  function modalHtml(r: Realm): string {
    if (r.outcome) {
      const win = r.outcome.kind === 'win'
      return `<div class="mcard end"><img class="ev" src="${ART}event/${win ? 'event-festival' : 'event-sky-drought'}.jpg" alt="">`
        + `<h2>${win ? '변한을 차지했다' : '도읍이 무너졌다'}</h2><p class="mute">${esc(seasonLabel(r.outcome.season))}</p>`
        + `<button class="btn on wide" data-act="newgame">새 판</button></div>`
    }
    if (!showReport || before === null || report === null) return ''
    const season = seasonOf(r.season)
    // 우리가 낀 싸움은 카드로 한 판씩 풀어 보이고, 글 줄에서는 뺀다
    const cards = report.lines.map((l, i) => (l.kind === 'battle' ? battleCard(before!, r, l, me(), ART, i) : ''))
    const lines = report.lines
      .filter((_, i) => cards[i] === '')
      .map((l) => reportText(before!, r, l, me()))
      .filter((x): x is string => x !== null)
    let h = `<div class="mcard"><div class="mt">${icon(SEASON_ICON[season], 'sic')}<b>${esc(seasonLabel(r.season))}</b><span>${esc(SEASON_LINE[season])}</span></div>`
    h += cards.some((c) => c !== '') ? cards.join('') : sceneOf(before, r, report)
    h += `<div class="lines">${lines.length === 0 ? '<p class="mute">조용한 계절이었다.</p>' : lines.map((t) => `<p class="${t.startsWith('소문') ? 'mute' : ''}">${esc(t)}</p>`).join('')}</div>`
    h += asksHtml() + threatsHtml(r)
    return h + `<button class="btn on wide" data-act="rep-close">확인</button></div>`
  }

  // ───────── 나라 고르기
  function chooseHtml(): string {
    let h = `<div class="choose"><h1>칠십팔국</h1><p class="mute">변한의 여섯 나라. 하나를 고른다.</p>${PRACTICE_READY ? `<p class="choose-links"><a class="btn ghost" href="${PRACTICE}">궁술 연습장</a></p>` : ''}<div class="ncards">`
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
  /**
   * 이번 계절에 정해 둔 명령을 남긴다 (형: "궁술연습장이나 활터 가버리면 그턴에서 내가 해놨던거 다 날아가버리는데") —
   * 다른 화면에 다녀오거나 새로고침해도 같은 판·같은 계절이면 그대로 되살린다. 저장이 안 되는 곳이면 그냥 없이 간다.
   */
  function saveDraft(): void {
    if (realm === null) return
    const d = { seed: realm.seed, season: realm.season, player: realm.player, armyOrders, musters, settles, pick, scout, rite, answers, guards, envoys, plots, heroOrders, persuadeBy }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { /* 저장 못 하는 곳 */ }
  }

  function restoreDraft(): void {
    if (realm === null) return
    let d: Record<string, unknown> | null = null
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Record<string, unknown> | null } catch { d = null }
    if (d === null || d['seed'] !== realm.seed || d['season'] !== realm.season || d['player'] !== realm.player) return
    const list = (k: string): Order[] => (Array.isArray(d![k]) ? (d![k] as Order[]) : [])
    const rec = <T>(k: string): Record<string, T> => (typeof d![k] === 'object' && d![k] !== null ? (d![k] as Record<string, T>) : {})
    armyOrders = list('armyOrders')
    musters = list('musters')
    settles = list('settles')
    plots = list('plots')
    heroOrders = list('heroOrders')
    guards = Array.isArray(d['guards']) ? (d['guards'] as string[]) : []
    scout = typeof d['scout'] === 'string' ? d['scout'] : ''
    rite = d['rite'] === true
    Object.assign(pick, rec<{ edge: string; ambush: boolean }>('pick'))
    Object.assign(answers, rec<boolean>('answers'))
    Object.assign(envoys, rec<Envoy>('envoys'))
    Object.assign(persuadeBy, rec<string>('persuadeBy'))
  }

  /**
   * 탭의 빨간 점 (형: "떠돌이 장수 오거나 뭔가 특별한 거 생기면 그 탭에는 빨간색 점") — 탭마다 새로 생긴 일의 열쇠.
   * 탭을 열면 본 것으로 친다. 답할 청은 답할 때까지 켜 둔다.
   */
  function dotKeys(r: Realm, tab: (typeof TABS)[number]['id']): string[] {
    const R = realm!
    switch (tab) {
      case 'heroes':
        return [
          ...wanderersFor(r, me()).map((w) => `w:${w.hero.id}`),
          ...Object.values(r.heroes).filter((x) => x.status === 'captive' && x.captor === me()).map((x) => `c:${x.id}`),
        ]
      case 'diplo': return openAsks(R, me()).filter((a) => answers[a.id] === undefined).map((a) => `a:${a.id}:${R.season}`)
      case 'army': return seenMarches(R, me()).filter((a) => a.march !== null && R.nodes[a.march.to]?.owner === me()).map((a) => `m:${a.id}:${R.season}`)
      default: return []
    }
  }

  function markSeen(tab: string): void {
    if (realm === null || !TABS.some((t) => t.id === tab)) return
    if (tab === 'diplo') return // 답할 청은 답해야 꺼진다
    for (const k of dotKeys(plan(), tab as (typeof TABS)[number]['id'])) seenKeys.add(k)
    try { localStorage.setItem(SEEN_KEY, JSON.stringify({ seed: realm.seed, player: realm.player, keys: [...seenKeys] })) } catch { /* 저장 못 하는 곳 */ }
  }

  function loadSeen(): void {
    seenKeys = new Set()
    if (realm === null) return
    try {
      const d = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null') as { seed?: number; player?: string; keys?: string[] } | null
      if (d !== null && d.seed === realm.seed && d.player === realm.player && Array.isArray(d.keys)) seenKeys = new Set(d.keys)
    } catch { /* 없으면 처음부터 */ }
  }

  function paint(): void {
    saveDraft()
    if (realm === null || choosing) {
      root.classList.add('choosing')
      $('.mapwrap').innerHTML = chooseHtml()
      $('.top').innerHTML = ''
      $('.tabs').innerHTML = ''
      $('.legend').innerHTML = ''
      $('.sheet').innerHTML = ''
      $('.modal').innerHTML = ''
      $('.modal').dataset['html'] = ''
      root.classList.remove('sheet-open', 'modal-open')
      return
    }
    root.classList.remove('choosing')
    const r = plan()
    $('.top').innerHTML = topHtml(r)
    const wrap = $('.mapwrap')
    const keep = [wrap.scrollLeft, wrap.scrollTop] as const
    const first = wrap.querySelector('.map') === null
    wrap.innerHTML = mapPart(r)
    zoom.apply()
    if (first) {
      // 처음엔 우리 국읍이 가운데 오게
      const cap = realm.factions[me()]?.capital
      const el = cap !== undefined ? wrap.querySelector<HTMLElement>(`.nd[data-node="${cap}"]`) : null
      if (el !== null) {
        wrap.scrollLeft = el.offsetLeft - wrap.clientWidth / 2
        wrap.scrollTop = el.offsetTop - wrap.clientHeight / 2
      }
    } else [wrap.scrollLeft, wrap.scrollTop] = keep
    // 답할 청이 남았으면 깃발 줄 끝에 사신 알림 — 누르면 외교 판
    const waiting = openAsks(realm, me()).filter((a) => answers[a.id] === undefined).length
    $('.legend').innerHTML = legendHtml(r) + (waiting > 0 ? `<button class="askpill" data-act="tab" data-tab="diplo">${icon('good-tribute-bell')}사신 ${waiting}</button>` : '')
    $('.next').innerHTML = `다음 계절 <span>›</span>`
    let tabs = ''
    for (const t of TABS) {
      const dot = dotKeys(r, t.id).some((k) => !seenKeys.has(k))
      tabs += `<button class="${sheet?.kind === t.id ? 'on' : ''}" data-act="tab" data-tab="${t.id}">${icon(t.icon, 'tic')}<span>${t.name}</span>${dot ? '<i class="dot"></i>' : ''}</button>`
    }
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
        case 'heroes': body = heroesSheet(r); break
        case 'hero': body = heroSheet(r, sheet.id); break
        case 'nation': body = nationSheet(r); break
        case 'help': body = helpSheet(); break
        case 'node': body = nodeSheet(r, sheet.id); break
      }
    }
    sh.innerHTML = sheet !== null ? `<div class="grip" data-act="close"></div>${body}` : ''
    sh.scrollTop = keepSheet
    // 방금 나눈 무리를 눈앞에 (형: "유저가 뭔가를 하면 항상 바로바로 적용돼야함")
    if (freshArmy !== '') sh.querySelector<HTMLElement>('.acard.fresh')?.scrollIntoView({ block: 'nearest' })
    root.classList.toggle('sheet-open', sheet !== null)
    const modal = modalHtml(r)
    const box = $('.modal')
    // 같은 보고를 다시 그리면 싸움 카드가 처음부터 다시 돈다 — 바뀔 때만 갈아 끼우고, 답을 누른 뒤에는 바로 끝까지 보인다
    if (box.dataset['html'] !== modal) {
      const keepScroll = box.querySelector('.mcard')?.scrollTop ?? 0
      box.innerHTML = modal
      box.dataset['html'] = modal
      box.classList.toggle('fast', fastNext)
      const card = box.querySelector('.mcard')
      if (card !== null && fastNext) card.scrollTop = keepScroll
    }
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
    if (zoom.dragged() && t.closest('.mapwrap') !== null) return // 지도를 끌다 놓은 것 — 누르기가 아니다
    if (t.dataset['act'] === 'bk-fast') {
      $('.modal').classList.add('fast') // 싸움 카드를 누르면 끝까지 바로 — 다시 그리지 않는다
      return
    }
    if (t.dataset['act'] === 'zin' || t.dataset['act'] === 'zout') {
      zoom.step(t.dataset['act'] === 'zin' ? 1 : -1)
      return
    }
    if (t.classList.contains('nd') && !t.dataset['act']) {
      // 군대를 고른 채 갈 수 없는 곳을 누르면 고르기만 푼다
      if (armySel !== '') {
        armySel = ''
        paint()
        return
      }
      host.onTap('node', t.dataset['node']!)
      openSheet({ kind: 'node', id: t.dataset['node']! })
      return
    }
    const d = t.dataset
    host.onTap(d['act'] ?? '', d['tab'] ?? d['node'] ?? d['army'] ?? d['to'] ?? d['id'] ?? d['unit'] ?? '')
    freshArmy = ''
    const r = realm !== null ? plan() : null
    switch (d['act']) {
      case 'nation': host.onNewGame(d['id']!); return
      case 'newgame': choosing = true; sheet = null; paint(); return
      case 'close': sheet = null; paint(); return
      case 'tab': markSeen(d['tab']!); openSheet({ kind: d['tab'] as 'army' }); return
      case 'help': openSheet({ kind: 'help' }); return
      case 'export': host.onExport(); return
      case 'focus': focus = focus === d['id'] ? null : d['id']!; break
      case 'rep-close': showReport = false; paint(); return
      case 'next': {
        if (realm === null || realm.outcome) return
        const mine = ordersNow()
        const all = [...mine, ...aiOrders(realm)]
        const prev = realm
        fastNext = false
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
        else { openArmy = d['army']!; armyMode = d['mode'] as 'move' | 'split'; split = { take: {}, hero: false, edge: null, ambush: false } }
        break
      case 'tok': armySel = armySel === d['army'] ? '' : d['army']!; break
      case 'go': {
        // 지도에서 고른 곳으로 — 싸울 곳이면 군대 판을 열어 정면·기습을 고르게 한다. 같은 곳을 다시 누르면 머문다
        const army = armySel
        const edge = d['edge']!
        if (army === '' || r === null) break
        if (pick[army]?.edge === edge) {
          delete pick[army]
          break
        }
        pick[army] = { edge, ambush: false }
        const m = movesOf(r, me(), r.armies[army]!).find((x) => x.edge.id === edge)
        if (m?.hostile === true) {
          openArmy = army
          armyMode = 'move'
          armySel = ''
          sheet = { kind: 'army' } // openSheet 은 같은 판이면 닫는다 — 여기선 늘 연다
          paint()
          requestAnimationFrame(() => $('.sheet').querySelector<HTMLElement>('.row.mv.on')?.scrollIntoView({ block: 'center' }))
          return
        }
        armySel = ''
        break
      }
      case 'mv': {
        const army = d['army']!
        if (d['edge'] === '') delete pick[army]
        else pick[army] = { edge: d['edge']!, ambush: pick[army]?.edge === d['edge'] ? pick[army]!.ambush : false }
        break
      }
      case 'amb': {
        const p = pick[d['army']!]
        if (p !== undefined) p.ambush = d['v'] === undefined ? !p.ambush : d['v'] === '1'
        break
      }
      case 'sq': {
        const a = r!.armies[d['army']!]
        const k = d['kind'] as UnitKind
        const max = a?.mix[k] ?? 0
        split.take[k] = Math.max(0, Math.min(max, (split.take[k] ?? 0) + Number(d['d'])))
        break
      }
      case 'shero': split.hero = d['v'] === '1'; break
      case 'sdest': split.edge = split.edge === d['edge'] ? null : d['edge']!; split.ambush = false; break
      case 'samb': split.ambush = d['v'] === '1'; break
      case 'sstay': split.edge = null; split.ambush = false; break
      case 'split': {
        // 떼어 낸 무리가 고른 곳으로 간다 — 본대(장수)는 그 자리에 남는다 (형: "장군이 이끄는 게 기본, 분리한 애가 그 목적대로 가야지")
        const army = d['army']!
        const take: Partial<Record<UnitKind, number>> = {}
        for (const [k, n] of Object.entries(split.take) as Array<[UnitKind, number]>) if (n > 0) take[k] = n
        const id = newArmyId(r!, me())
        const o: Order = { kind: 'split', army, id, take, hero: split.hero }
        if (planned(r!, [o]).armies[id] === undefined) note = `못 나눈다. 양쪽 다 ${P.realm.splitMin}명 이상, 군대는 ${P.realm.armyMax}개까지.`
        else {
          armyOrders = [...armyOrders, o]
          if (split.edge !== null) pick[id] = { edge: split.edge, ambush: split.ambush }
          openArmy = ''
          freshArmy = id
        }
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
      case 'arm': {
        const army = d['army']!
        musters = musters.some((o) => o.kind === 'arm' && o.army === army) ? musters.filter((o) => !(o.kind === 'arm' && o.army === army)) : [...musters, { kind: 'arm', army }]
        break
      }
      case 'disband':
        musters = [...musters, { kind: 'disband', army: d['army']! }]
        delete pick[d['army']!]
        break
      case 'undisband':
        musters = musters.filter((o) => !(o.kind === 'disband' && o.army === d['army']))
        break
      case 'dunit': draftUnit[d['node']!] = d['unit'] as UnitKind; break
      case 'diron': draftIron[d['node']!] = draftIron[d['node']!] !== true; break
      case 'dn': {
        const node = d['node']!
        const lim = draftLimit(r!, me(), node)
        draftN[node] = Math.max(0, Math.min(lim, (draftN[node] ?? Math.min(lim, 20)) + Number(d['d'])))
        break
      }
      case 'draft': {
        const node = d['node']!
        const n = draftN[node] ?? Math.min(draftLimit(r!, me(), node), 20)
        if (n > 0) musters = [...musters, { kind: 'draft', faction: me(), node, unit: draftUnit[node] ?? 'spear', n, ...(draftIron[node] === true ? { iron: true as const } : {}) }]
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
      case 'answer': answers[d['id']!] = d['yes'] === '1'; fastNext = true; break
      case 'guard': {
        const node = d['node']!
        guards = guards.includes(node) ? guards.filter((x) => x !== node) : [...guards, node]
        fastNext = true
        break
      }
      case 'rite': rite = !rite; break
      case 'compose': {
        const same = compose.to === d['to'] && compose.ask === d['ask']
        compose = { ...NO_COMPOSE, give: { grain: 0, iron: 0 }, take: { grain: 0, iron: 0 }, to: same ? '' : d['to']!, ask: d['ask'] as Ask }
        break
      }
      case 'cq': {
        const side = d['side'] as 'give' | 'take'
        const res = d['res'] as 'grain' | 'iron'
        compose[side][res] = Math.max(0, compose[side][res] + Number(d['d']))
        break
      }
      case 'ctarget': compose.target = compose.target === d['node'] ? '' : d['node']!; break
      case 'envoy': {
        const ask = d['ask'] as Ask
        const to = d['to']!
        const detailed = compose.to === to && compose.ask === ask
        if (envoys[to]?.ask === ask) delete envoys[to]
        else {
          envoys[to] = {
            kind: 'envoy', from: me(), to, ask,
            give: detailed ? { ...compose.give } : { grain: 0, iron: 0 },
            take: detailed ? { ...compose.take } : { grain: 0, iron: 0 },
            ...(detailed && compose.target !== '' ? { target: compose.target } : {}),
          }
        }
        compose = { ...NO_COMPOSE, give: { grain: 0, iron: 0 }, take: { grain: 0, iron: 0 } }
        break
      }
      case 'unenvoy': delete envoys[d['to']!]; break
      case 'dmode': diploMode = d['v'] as 'envoy' | 'plot'; break
      case 'plot-open': plotOpen = plotOpen === d['op'] ? null : (d['op'] as PlotOp); break
      case 'plot': {
        const op = d['op'] as PlotOp
        const o: Order = {
          kind: 'plot', faction: me(), op, target: d['target']!,
          ...(d['node'] ? { node: d['node'] } : {}), ...(d['other'] ? { other: d['other'] } : {}),
          ...(d['hero'] ? { hero: d['hero'] } : {}), ...(d['agent'] ? { agent: d['agent'] } : {}),
        }
        const k = o as { node?: string; other?: string; hero?: string }
        const same = (p: Order): boolean => p.kind === 'plot' && p.op === op && p.target === o.target && p.node === k.node && p.other === k.other && p.hero === k.hero
        if (plots.some(same)) plots = plots.filter((p) => !same(p))
        else if (plots.length < P.realm.plotsPerSeason) plots = [...plots, o]
        break
      }
      case 'unplot': plots = plots.filter((_, i) => i !== Number(d['i'])); break
      case 'shoot': openNight(Number(d['i'])); return
      case 'pagent': plotAgent = d['id'] ? d['id'] : null; break
      case 'hero': openSheet({ kind: 'hero', id: d['id']! }); return
      case 'assign':
        heroOrders = [...heroOrders, { kind: 'assign', hero: d['id']!, node: d['node'] ? d['node'] : null }]
        break
      case 'lead': heroOrders = [...heroOrders, { kind: 'lead', hero: d['id']!, army: d['army']! }]; break
      case 'pby': persuadeBy[d['id']!] = d['by']!; break
      case 'persuade': heroOrders = [...heroOrders, { kind: 'persuade', hero: d['id']!, by: d['by'] ? d['by'] : null }]; break
      case 'unhero': heroOrders = heroOrders.filter((o) => !((o.kind === 'assign' || o.kind === 'lead' || o.kind === 'persuade' || o.kind === 'hire') && o.hero === d['id'])); break
      case 'hire': {
        const id = d['id']!
        const had = heroOrders.some((o) => o.kind === 'hire' && o.hero === id)
        heroOrders = had ? heroOrders.filter((o) => !(o.kind === 'hire' && o.hero === id)) : [...heroOrders, { kind: 'hire', faction: me(), hero: id }]
        break
      }
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
      restoreDraft()
      loadSeen()
      sheet = null
      paint()
    },
  }
}
