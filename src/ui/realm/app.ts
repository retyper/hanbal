/**
 * 칠십팔국 — 앱 화면 (docs/realm/FLOW.md §5)
 *
 * 한 화면에 꽉 찬다. 페이지는 내려가지 않는다: 위 상태 줄 · 가운데 지도 · 아래 탭. 탭이나 고을을 누르면
 * 아래에서 판(시트)이 올라오고 그 안만 스크롤한다. 계절을 넘기면 보고가 카드로 뜬다.
 * 화면은 판을 읽기만 하고, 바꾸는 일은 명령을 모아 advance 에 넘기는 것 하나다 (절대 규칙 2 의 정신).
 * 루프·타이머가 없다 — 누르면 다시 그린다 (절대 규칙 4). 글은 FLOW §6: 짧게, AI 말투 금지.
 */
import { aiOrders } from '../../realm/ai.ts'
import { headcount, type Equip, type UnitKind } from '../../realm/battle.ts'
import { FACTION_ART, GOOD_ICON, HERO_BUST, SEASON_ICON, UNIT_ICON, nodeIcon } from '../../realm/data/art.ts'
import { NATIONS, type NationInfo } from '../../realm/data/nations.ts'
import { YEONGNAM_NATIONS } from '../../realm/data/nations-yeongnam.ts'
import { SOUTH_NATIONS } from '../../realm/data/nations-south.ts'
import { WORLD_NATIONS } from '../../realm/data/nations-world.ts'
import { knownOf, knows } from '../../realm/discovery.ts'
import { TRAIT } from '../../realm/data/traits.ts'
import {
  ASK_KIND_NAME, ASK_NAME, deedText, GEAR_NAME, TIER_NAME, PLOT_DOES, PLOT_NAME, askLine, arriveWhen, josa, EDGE_NAME, NODE_KIND_NAME, SEASON_LINE, SETTLED_NAME, STAT_NAME, TAG_LINE, UNIT_NAME, reportText, seasonLabel, whyLine, NODE_NOW, BUILD_NAME, BOW_NAME, CONCEAL_LINE, goodsLine, GOOD_NAME, tagNow,
} from '../../realm/data/prose.ts'
import { canEscort, envoyChanceFor, envoyOptions, favorOf, jointTargets, openAsks, relationOf } from '../../realm/diplomacy.ts'
import {
  GOODS, armCost, buildCost, canBuild, canGuard, draftCost, draftIronCost, draftLimit, draftNeeds, goodOf, guardCost, hhGrowth, isCoast, militiaMen, nextBuild, nodeYield, nodeSpecials, riteAllowed, riteCost,
  settleCost, settleLimit, settleSource, settleTargets, autoFlows, crowdOf, homeRoom, migrateCost, migrateLimit, migratePath,
} from '../../realm/economy.ts'
import { approachMoves, armyPower, jointWin, matchupHints, movesOf, type Move } from '../../realm/estimate.ts'
import { kitLines } from '../../realm/kit.ts'
import { alertRange, seenMix, visibleRange } from '../../realm/intel.ts'
import { advance, concealOf, draftable, forceOf, neighbors, newArmyId, otherEnd, planned, rationCost, rationExtra, seasonOf, seenMarches } from '../../realm/season.ts'
import { PLOT_OPS, exposeChance, assassinArrows, assassinBow, bowUpCost, escapeChance, plotAgents, plotChance, plotCost, plotTargets } from '../../realm/plots.ts'
import { allianceWhy, leaderOf, tookRecently, truceWhy, winningAgainst } from '../../realm/stance.ts'
import { heroSeen, isRuler, persuadeSeasons, wanderersFor } from '../../realm/heroes.ts'
import type { Approach, Army, EdgeKind, EnvoyAsk, Good, Hand, Hero, Order, PlotOp, Ration, Realm, RegionId, Report, ReportLine, Tactic } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { EDGE_STYLE, MAP_CSS, ROUTE_SIGN_NAME, mapHtml, type RouteSign, type MapMarch, type MapTarget, type MapToken } from './mapview.ts'
import { LEGACY_CSS, carryHtml, retainHtml, syncRetain, toggleCarry, toggleKeep } from './legacy.ts'
import { DEX_CSS, dexHtml, dexToastHtml, loadDex, recordDex, type DexBoard } from './dex.ts'
import { dexCounts } from '../../realm/dex.ts'
import { GROW_CSS, HERO_CSS, TITLE_MEAN, bondChip, growthHtml, heroRadar, nameHtml, roleLine, splitTitle, traitChips, traitLines } from './heroview.ts'
import { APP_CSS } from './appstyle.ts'
import { BATTLE_CSS, battleCard } from './battlecard.ts'
import { APPROACH_DOES, APPROACH_NAME, HARD_LINE, WAR_CSS, openWar } from './battlefield.ts'
import { attachZoom } from './zoom.ts'
import { TUT_CSS, TUT_STEPS, createSpot, tutAt, tutBandHtml, tutStyle } from './tutorial.ts'
import { LOG_CSS, logNations, logRows, logbookHtml, type LogFilter } from './logbook.ts'
import { markTutorialOver, markWon, tutorialOver, unlockedBoards } from './unlock.ts'
import { TINT_CSS, tint } from './tint.ts'
import { handsOf, idleHeroes } from '../../realm/hands.ts'
import { pactOf } from '../../realm/suzerain.ts'
import { ironOf, riteOf } from '../../realm/paths.ts'
import { MOOD_CSS, MOOD_WORD, moodImg, moodOf } from './mood.ts'
import { FRONT_CSS, PROLOGUE_STEPS, winNeed, boardHtml, detailHtml, endingHtml, nationsHtml, prologueHtml, titleHtml, type FrontKit, type History } from './front.ts'
import { FEEL_CSS, alertFeel, ambushFeel, envoyFeel, favorFeel, fightFeel, plotFeel, unknownFeel } from './feel.ts'

export interface AppHost {
  /** 계절을 넘긴 뒤 — 저장은 바깥이 한다. `orders` 는 AI 것까지 전부, `mine` 은 플레이어 것 */
  onAdvance(next: Realm, report: Report, orders: readonly Order[], mine: readonly Order[]): void
  /** 나라를 골라 새 판 */
  onNewGame(nation: string, region: RegionId): void
  /** 누른 것 하나 — 판 기록에 남긴다 */
  onTap(act: string, arg: string): void
  /** 판 기록을 파일로 */
  onExport(): void
  /** 남아 있는 판 기록 수 */
  gameCount(): number
  /** 이 판의 지난 계절 보고들 — 끝 화면의 연대기 */
  history(): History
  /** 마지막으로 저장한 때 (ISO) — 첫 화면의 "이어 하기" */
  savedAt(): string | null
}

const ART: string = (import.meta.env?.BASE_URL ?? '/') + 'realm/'
/** 이번 계절에 정해 둔 명령 — 다른 화면에 다녀와도 남는다 (saveDraft) */
const DRAFT_KEY = 'hanbal.realm.draft'
/** 탭의 빨간 점 — 이 판에서 이미 본 것 (dotKeys) */
const SEEN_KEY = 'hanbal.realm.seen'
/** 밤 활 연습장 (SNIPE §0, 형: "궁술연습장도 만들어서 아무때나 해볼수 있게") */
/** 소리 (public/sfx — 활터와 같은 곳). 끄기는 나라 판에서, 기억은 이 기기에만 */
const SFX: string = (import.meta.env?.BASE_URL ?? '/') + 'sfx/'
const MUTE_KEY = 'hanbal.realm.mute'
function muted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}
function ding(name: string, vol = 0.6): void {
  if (muted()) return
  try {
    const a = new Audio(`${SFX}${name}.ogg`)
    a.volume = vol
    void a.play().catch(() => {})
  } catch { /* 소리를 못 내는 곳 */ }
}
const PRACTICE: string = (import.meta.env?.BASE_URL ?? '/') + 'night.html?practice=1'
/** night.html 이 올라갔다 (f9e77aa) — 없는 쪽으로 보내지 않으려 둔 스위치 */
const PRACTICE_READY = true
const NIGHT: string = (import.meta.env?.BASE_URL ?? '/') + 'night.html'
/** 보고판이 쌓이는 빠르기 (초) — 소식 한 줄 · 무너진 나라 한 장. 계절 띠(seasonFx)가 걷힌 뒤 시작한다 (CSS .modal.late) */
const LINE_S = 0.6
const FALL_S = 1.6
/** 싸움 카드 하나가 다 풀리는 데 걸리는 때 — 카드 안 줄들의 가장 늦은 --d 에 한 박자 */
const battleCardSeconds = (html: string): number => Math.max(0, ...[...html.matchAll(/--d:([\d.]+)s/g)].map((m) => Number(m[1]))) + 0.8
/** 지도 보기 켜고 끄기 — 겹마다 이름과 무엇인지 */
const LAYERS = [
  { id: 'terr', name: '땅빛', hint: '나라 색 · 경계' },
  { id: 'roads', name: '길', hint: '들길·고갯길·나루…' },
  { id: 'marches', name: '행군 화살', hint: '우리 출정 · 다가오는 적' },
  { id: 'labels', name: '이름', hint: '고을 이름' },
  { id: 'flags', name: '깃발', hint: '고을 주인' },
  { id: 'goods', name: '특산', hint: '쇠·소금·나무·말 — 고을마다 나는 것' },
  { id: 'force', name: '군세 수', hint: '정찰꾼이 본 적 군세' },
  { id: 'army', name: '우리 군대', hint: '장수 얼굴 말' },
] as const
type LayerId = (typeof LAYERS)[number]['id']
const LAYER_KEY = 'hanbal.realm.layers'
const HAND_NAME = { dead: '적장이 쓰러졌다', wounded: '적장이 다쳤다', fled: '적장이 달아났다', withdrew: '조용히 물러났다', skip: '자객에게 맡겼다' } as const

type Ask = EnvoyAsk
type Envoy = Extract<Order, { kind: 'envoy' }>
type Sheet =
  | { kind: 'army' } | { kind: 'draft' } | { kind: 'people' } | { kind: 'diplo' } | { kind: 'scout' } | { kind: 'nation' } | { kind: 'help' }
  | { kind: 'node'; id: string } | { kind: 'heroes' } | { kind: 'hero'; id: string } | { kind: 'log' }

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
  crowded: '붐벼서 덜 는다', uprooted: '억지로 옮겨 와 자리 잡는 중이다',
  fed: '배부르고 평화롭다', hunger: '굶는다', post: '맡은 장수가 돌본다', settle: '새로 일군 땅이라 빨리 큰다', full: '더 들어설 자리가 없다', threat: '적이 다가와 술렁인다',
}
/** 빈 몫 — 다섯 물건 */
const noGoods = (): Record<Good, number> => ({ grain: 0, iron: 0, salt: 0, wood: 0, horse: 0 })
/** 물건의 그림 */
/** 사신을 꾸밀 때 한 번 누름에 오르내리는 몫 */
const GOOD_STEP: Record<Good, number> = { grain: 10, iron: 5, salt: 5, wood: 5, horse: 1 }
const NO_COMPOSE = { to: '', ask: 'truce' as Ask, give: noGoods(), take: noGoods(), target: '' }
/** 공작 다섯의 그림 */
const PLOT_ICON: Readonly<Record<PlotOp, string>> = {
  rumor: 'status-morale-down', sow: 'status-betrayal', bribe: 'good-cowries', burn: 'status-famine', spy: 'status-spy', assassin: 'unit-archer',
}
const TABS = [
  { id: 'army', name: '군대', icon: 'unit-shield-wall' },
  { id: 'draft', name: '징병', icon: 'unit-spear' },
  // 백성 — 개척·이주 (형: "군사징병이랑 개척 좀 확실히 구분필요함")
  { id: 'people', name: '백성', icon: 'settle-farm-village' },
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
/** 우리 나라 — 깃발마다 금빛 후광을 두른다 (형 2026-10-20: "사용자의 나라는 로그에서 아이콘도 뭔가 후광이 있거나 특별하게 … 내나라가 어느나란지도 모르겠어서") */
let MINE = ''
const emblem = (f: string | null, cls = 'em'): string => (f !== null && FACTION_ART[f] !== undefined ? icon(FACTION_ART[f].emblem, f === MINE ? `${cls} mine` : cls) : '')
const sorted = <T extends { id: string }>(xs: Iterable<T>): T[] => [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

/** 나라마다 얼굴 하나 — 그 나라의 군주 (판의 Faction.ruler 와 같은 id — 나라 고르기 화면엔 판이 없어 이름 규칙으로) */
const rulerId = (nation: string): string => `${nation}-ruler`

/** 판마다 나라 고르기 글 — 변한 6국 축소판 · 영남 판 */
const nationsOf = (region: RegionId): readonly NationInfo[] => (region === 'yeongnam' ? YEONGNAM_NATIONS : region === 'south' ? SOUTH_NATIONS : region === 'world' ? WORLD_NATIONS
  : region === 'tutorial' ? NATIONS.filter((n) => n.id === 'us' || n.id === 'guya') : NATIONS)

function nationFace(id: string, cls = 'nface'): string {
  const hid = rulerId(id)
  const file = hid !== undefined ? HERO_BUST[hid] : undefined
  return file !== undefined ? `<img class="${cls}" src="${ART}bust/${file}.jpg" alt="">` : ''
}

/** 도감(dex.ts)이 쓰는 그림 손 */
const DEX_KIT = { esc, bust: (id: string): string | null => (HERO_BUST[id] !== undefined ? `${ART}bust/${HERO_BUST[id]}.jpg` : null) }

/** 판의 앞과 끝(front.ts)이 쓰는 그림 손 */
const KIT: FrontKit = {
  art: ART, esc, icon, nations: nationsOf, face: nationFace,
  emblem: (f, cls) => emblem(f, cls),
  bust: (id) => (HERO_BUST[id] !== undefined ? `${ART}bust/${HERO_BUST[id]}.jpg` : null),
}

/** 첫 화면 · 판 고르기 · 나라 고르기 · 자세히 — null 이면 판 위 */
type Front = { kind: 'title' } | { kind: 'boards' } | { kind: 'nations'; region: RegionId } | { kind: 'detail'; region: RegionId; id: string }
  /** 도감 — back: 돌아갈 판 바깥 화면 (null 이면 판으로) */
  | { kind: 'dex'; board: DexBoard; sel: string | null; back: Front | null }

export function mountRealmApp(root: HTMLElement, host: AppHost): { show(r: Realm | null, before: Realm | null, report: Report | null, fresh?: boolean): void } {
  const style = document.createElement('style')
  style.textContent = APP_CSS + LOG_CSS + TINT_CSS + MOOD_CSS + MAP_CSS + FEEL_CSS + BATTLE_CSS + WAR_CSS + HERO_CSS + GROW_CSS + DEX_CSS + LEGACY_CSS + FRONT_CSS.replaceAll('__ART__', ART)
  document.head.appendChild(style)
  root.classList.add('ap')
  root.innerHTML = `<header class="top"></header><div class="mapwrap"></div><div class="legend"></div><div class="zbtns"><button data-act="layers" class="lyb" aria-label="보기">👁</button><button data-act="zin">＋</button><button data-act="zout">－</button></div><div class="layers"></div><button class="next" data-act="next"></button><div class="selbar"></div><div class="roadkey"></div><button class="homebtn" data-act="home">우리 땅</button><button class="logbtn" data-act="log-open">지난 기록</button><div class="tutband"></div>`
    + `<nav class="tabs"></nav><div class="back" data-act="close"></div><section class="sheet"></section><div class="modal"></div><div class="plbox"></div>`
  const $ = (sel: string): HTMLElement => root.querySelector<HTMLElement>(sel)!
  const zoom = attachZoom($('.mapwrap'))
  // 배우는 판의 빛낼 곳 — 단계마다 갈아 끼우는 <style> (tutorial.ts)
  const tutSheet = document.createElement('style')
  tutSheet.textContent = ''
  document.head.appendChild(tutSheet)
  const tutBase = document.createElement('style')
  tutBase.textContent = TUT_CSS
  document.head.appendChild(tutBase)
  // 누를 곳만 밝히고 그곳만 눌리게 (tutorial.createSpot — 형: "그걸 눌러야 진행되게")
  const spot = createSpot(root)
  /** 배우는 판 — 지금 할 단계 · 이 판에서 누른 단추 · 그만뒀나 (이 기기에 판마다 기억) */
  let tut = { seed: -1, i: 0, acts: new Set<string>(), off: false }
  const TUT_KEY = 'hanbal.realm.tut'
  const loadTut = (): void => {
    if (realm === null || realm.region !== 'tutorial') return
    if (tut.seed === realm.seed) return
    tut = { seed: realm.seed, i: 0, acts: new Set(), off: false }
    try {
      const d = JSON.parse(localStorage.getItem(TUT_KEY) ?? 'null') as { seed?: number; i?: number; acts?: string[]; off?: boolean } | null
      if (d !== null && d.seed === realm.seed) tut = { seed: realm.seed, i: d.i ?? 0, acts: new Set(d.acts ?? []), off: d.off === true }
    } catch { /* 처음부터 */ }
  }
  const saveTut = (): void => {
    try { localStorage.setItem(TUT_KEY, JSON.stringify({ seed: tut.seed, i: tut.i, acts: [...tut.acts], off: tut.off })) } catch { /* 저장 못 하는 곳 */ }
  }

  let realm: Realm | null = null
  let before: Realm | null = null
  /** 이번 계절에 막 알게 된 나라 — 지도에서 한 번 서서히 드러난다 (발견) */
  let fresh = new Set<string>()
  let report: Report | null = null
  let showReport = false
  /** 판 바깥의 화면 — 처음엔 첫 화면 */
  let front: Front | null = { kind: 'title' }
  /** 새 판의 서막 몇째 장 — null 이면 없음 */
  let prologue: number | null = null
  /** 끝난 판의 지도를 둘러보는 중 */
  let looking = false
  let sheet: Sheet | null = null
  /** 이번 계절의 명령 거리 */
  let armyOrders: Order[] = [] // 나누기·모으기 — 화면은 이걸 먼저 해 본 판을 보인다
  let musters: Order[] = [] // 징병·해산
  let settles: Order[] = [] // 개척 — 나누기처럼 먼저 해 본 판에 든다 (그래야 남은 몫·곡식이 맞게 보인다)
  const pick: Record<string, { edge: string; ambush: boolean; approach?: Approach; ration?: Ration } | undefined> = {}
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
  /** 사신과 함께 보낼 장수 — 상대 나라마다 (매력·매혹·장사꾼은 따라가야 먹힌다) */
  const escort: Record<string, string> = {}
  /** 나라 카드에서 "있었던 일"을 다 펼친 나라 */
  const deedsOpen = new Set<string>()
  let diploMode: 'envoy' | 'plot' | 'scout' = 'envoy'
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
  /** 억지 이주 — 보낼 고을 · 받을 고을 · 몇 집 (0 이면 한도와 20 가운데 작은 것) */
  let migFrom = ''
  let migTo = ''
  let migN = 0
  /** 사신을 꾸미는 중 — 누구에게 · 무엇을 · 얼마 · 어디 */
  let compose: { to: string; ask: Ask; give: Record<Good, number>; take: Record<Good, number>; target: string } = { ...NO_COMPOSE, give: noGoods(), take: noGoods() }
  let note = ''
  /** 방금 나눈 무리 — 그 카드를 밝히고 눈앞으로 가져온다 (다음 누름에 지운다) */
  let freshArmy = ''
  /** 이번 계절에 직접 쏜 결과 — 적장마다 (한 번만 쏜다) */
  const hands: Record<string, Hand> = {}
  /**
   * 지도에서 고른 우리 군대 — 갈 곳이 밝아진다. 같은 고을의 말을 하나씩 더 누르면 함께 골라진다
   * (형: "같은지역군대들은 하나씩 탭한다면 둘이 동시선택할수있게하고 합치기 버튼이 떴으면")
   */
  let armySel: string[] = []
  /** 길 보기 펼침 */
  let roadOpen = false
  /** 지난 기록 — 걸러 보기 갈래 · 나라 (logbook.ts) */
  let logFilter: LogFilter = 'all'
  let logNation: string | null = null
  /** 지도 보기 켜고 끄기 — 펼침 (켜고 끈 것은 이 기기에 기억) */
  let layersOpen = false
  const hiddenLayers = new Set<LayerId>()
  try {
    const v = JSON.parse(localStorage.getItem(LAYER_KEY) ?? '[]') as unknown
    if (Array.isArray(v)) for (const x of v) if (LAYERS.some((l) => l.id === x)) hiddenLayers.add(x as LayerId)
  } catch { /* 처음엔 다 켜짐 */ }
  applyLayers()
  /** 탭의 빨간 점 — 본 것 */
  let seenKeys = new Set<string>()
  /** 지도에서 또렷하게 볼 나라 — 깃발 줄에서 누른다 */
  let focus: string | null = null

  const me = (): string => realm!.player
  /** 안내 글에 낱말 색 — 나라는 그 나라 색, 군사는 붉게, 마을은 갈색 (tint.ts) */
  const tx = (s: string): string => (realm === null ? esc(s) : tint(esc(s), {
    nations: Object.values(realm.factions).map((f) => [f.name, FACTION_ART[f.id]?.color ?? '#888'] as const),
    heroes: Object.values(realm.heroes).map((x) => x.name),
    places: Object.values(realm.nodes).map((n) => n.name),
  }))
  // 맡기기·이끌기는 나누기처럼 먼저 해 본 판에 든다 — 장수 카드가 바뀐 자리를 바로 보인다
  // 들이기도 든다 — 들인 떠돌이가 바로 우리 장수로 보이고 군대를 이끌 수 있게 (형: "들인다 했을때 바로 적용되어야 하고 군사배치에도 쓸수 있어야 함")
  /** 이번 계절 끝에 자동 분배가 켜져 있나 — 고른 명령이 있으면 그것, 아니면 판 */
  const autoMigOn = (): boolean => {
    const o = settles.filter((x): x is Extract<Order, { kind: 'migrateAuto' }> => x.kind === 'migrateAuto').pop()
    return o !== undefined ? o.on : realm?.factions[me()]?.migrateOff !== true
  }
  const setAutoMig = (want: boolean): void => {
    settles = settles.filter((o) => o.kind !== 'migrateAuto')
    if ((realm!.factions[me()]?.migrateOff !== true) !== want) settles = [...settles, { kind: 'migrateAuto', faction: me(), on: want }]
  }
  const plan = (): Realm => planned(realm!, [...armyOrders, ...settles, ...heroOrders.filter((o) => o.kind === 'hire' || o.kind === 'assign' || o.kind === 'lead')])

  /**
   * 이번 계절 고른 것을 다 치르고 남는 것 (형: "철이부족해도 강화 선택이 가능해져버려있고") — 징병·무장·목책·경계는 엔진과 같은 함수로
   * 먼저 해 보고, 제사·공작·자객의 활·사신 선물은 값만 뺀다. 단추는 이 남은 몫으로 켜고 끈다. 그리기 한 번에 한 번 셈한다.
   */
  let leftCache: { key: string; st: Record<Good, number> } | null = null
  function left(): Record<Good, number> {
    const key = JSON.stringify([realm!.season, armyOrders, settles, heroOrders, musters, guards, rite, plots, envoys])
    if (leftCache !== null && leftCache.key === key) return leftCache.st
    const p = planned(realm!, [
      ...armyOrders, ...settles, ...musters.filter((o) => o.kind !== 'disband'),
      ...guards.map((node): Order => ({ kind: 'guard', faction: me(), node })),
      ...heroOrders.filter((o) => o.kind === 'hire' || o.kind === 'assign' || o.kind === 'lead'),
    ])
    const st = Object.fromEntries(GOODS.map((g) => [g, goodOf(p.stock[me()], g)])) as Record<Good, number>
    const pay = (c: { grain: number; iron: number } | null): void => {
      if (c !== null) { st.grain -= c.grain; st.iron -= c.iron }
    }
    if (rite) pay(riteCost(realm!, me()))
    for (const o of plots) if (o.kind === 'plot') pay(plotCost(o.op, o.agent ?? null))
    if (musters.some((o) => o.kind === 'bowUp')) pay(bowUpCost(realm!, me()))
    for (const e of Object.values(envoys)) for (const g of GOODS) st[g] -= e.give[g] ?? 0
    leftCache = { key, st }
    return st
  }

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
    for (const k of Object.keys(hands)) delete hands[k]
    heroOrders = []
    plotOpen = null
    openArmy = ''
    note = ''
    compose = { ...NO_COMPOSE, give: noGoods(), take: noGoods() }
  }

  function ordersNow(): Order[] {
    const p = plan()
    const out: Order[] = [...armyOrders, ...settles, ...heroOrders, ...musters]
    for (const [army, c] of Object.entries(pick)) {
      const a = p.armies[army]
      if (c !== undefined && a !== undefined && a.march === null) out.push({ kind: 'march', army, edge: c.edge, ambush: c.ambush, ...(c.approach !== undefined ? { approach: c.approach } : {}), ...(c.ration !== undefined ? { ration: c.ration } : {}) })
    }
    if (scout !== '') out.push({ kind: 'scout', faction: me(), node: scout, hero: null })
    if (rite) out.push({ kind: 'rite', faction: me() })
    for (const [ask, yes] of Object.entries(answers)) out.push({ kind: 'answer', ask, yes })
    for (const node of guards) out.push({ kind: 'guard', faction: me(), node })
    for (const to of Object.keys(envoys).sort()) out.push(envoys[to]!)
    out.push(...plots)
    return out
  }

  /**
   * 고른 군량(더 챙길 계절 수) — 안 골랐으면 기본(rationReserve)을, 곡식이 대는 만큼까지. 옛 'full'·'light' 도 받는다
   */
  function rationExtraOf(r: Realm, a: Army, seasons: number, want: Ration | undefined): number {
    let n = rationExtra(want) ?? P.realm.rationReserve
    const grain = left().grain
    while (n > 0 && rationCost(r, a, seasons, n) > grain) n--
    return n
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
    const st = left() // 이번 계절 고른 것을 치르고 남는 몫
    const men = Object.values(r.armies).filter((a) => a.faction === me()).reduce((s, a) => s + headcount(forceOf(r, a)), 0)
    const nation = r.factions[me()]
    return `<div class="tl">${icon(SEASON_ICON[season], 'sic')}<b>${esc(seasonLabel(r.season))}</b></div>`
      + `<div class="tr"><span class="stat">${icon('good-rice')}<b>${Math.floor(st.grain)}</b></span>`
      + (['iron', 'salt', 'wood', 'horse'] as const).filter((g) => g === 'iron' || goodOf(st, g) > 0).map((g) => `<span class="stat">${icon(GOOD_ICON[g])}<b>${Math.floor(goodOf(st, g))}</b></span>`).join('')
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
    // 길 위의 군대도 말을 둔다 — 길 가운데쯤에 (형: "내 군대 번예연이 군대가 지도에서 안보임")
    const tokens: MapToken[] = sorted(Object.values(r.armies)).filter((a) => a.faction === me()).map((a) => {
      const hero = a.hero !== null ? r.heroes[a.hero] : undefined
      const file = hero !== undefined ? HERO_BUST[hero.id] : undefined
      const top = (Object.entries(a.mix) as Array<[UnitKind, number]>).sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'spear'
      return {
        army: a.id, node: a.at, men: headcount(forceOf(r, a)), sel: armySel.includes(a.id), going: pick[a.id] !== undefined,
        img: file !== undefined ? `${ART}bust/${file}.jpg` : `${ART}icon/${UNIT_ICON[top]}.png`,
        ...(a.march !== null ? { march: { from: a.march.from, to: a.march.to } } : {}),
      }
    })
    const a = armySel.length > 0 ? r.armies[armySel[0]!] : undefined
    // 다른 우리 군대가 언제 어디에 닿나 — 이미 가는 군대 · 이번 계절에 보낼 군대. 칠 곳 칩에 협공을 미리 (형: "같은 계절에 도착하게 맞춰서 … 합쳐져서 공격이 안오네??")
    const others = new Map<string, number[]>()
    for (const o of Object.values(r.armies)) {
      if (o.faction !== me() || armySel.includes(o.id)) continue
      const c = pick[o.id]
      const when = o.march !== null ? { to: o.march.to, k: o.march.left } : c !== undefined ? (() => { const mv = movesOf(r, me(), o).find((x) => x.edge.id === c.edge); return mv !== undefined ? { to: mv.to, k: mv.seasons } : null })() : null
      if (when !== null) others.set(when.to, [...(others.get(when.to) ?? []), when.k])
    }
    const pincerChip = (to: string, k: number, hostile: boolean): string => {
      const ks = others.get(to)
      if (!hostile || ks === undefined) return ''
      if (ks.includes(k)) return `<span class="tn pin">협공</span>`
      const d = Math.min(...ks.map((x) => Math.abs(x - k)))
      return `<span class="tn hard">${d}계절 어긋남</span>`
    }
    const targets: MapTarget[] = a === undefined || a.march !== null ? [] : movesOf(r, me(), a).map((m) => ({
      // 막힌 길도 갈 수는 있다 — 무엇을 잃는지 칩으로 미리 (형: "불가능하게 만들지 말고 패널티 · 사전에 안내")
      node: m.to, edge: m.edge.id, off: false, on: armySel.every((id) => pick[id]?.edge === m.edge.id),
      // 걸리는 계절은 늘 — 칠 곳에도 (형: "적을 치러갈때 그 마을까지 얼마나걸리는지 여전히 안보임")
      chip: (m.blocked !== null ? `<span class="tn hard">${esc(HARD_LINE[m.blocked])}</span>`
        : m.hostile ? `${m.win !== null ? fightFeel(m.win[0], m.win[1]) : unknownFeel()}${m.conceal === "good" ? `<span class="tn hide">숨기 좋은 길</span>` : m.bigArmy ? `<span class="tn big">무리가 커 들킨다</span>` : ""}` : '')
        + `<span class="tn when">${m.seasons}계절</span>${pincerChip(m.to, m.seasons, m.hostile)}`,
    }))
    // 머물기도 지도에서 — 제 고을을 누르면 떠나기를 거둔다 (형: "머물기는 지도에서 선택을 못하고")
    if (a !== undefined && a.march === null) targets.push({ node: a.at, edge: '', off: false, on: armySel.every((id) => pick[id] === undefined), chip: `<span class="tn stay">머문다</span>` })
    const fr = fresh
    if (!showReport) fresh = new Set() // 드러나는 것은 한 번만 — 계절 소식을 닫고 지도를 볼 때
    return mapHtml(r, me(), ART, marches, sel, focus, tokens, targets, fr)
  }

  /** 지도에서 켜고 끄는 겹 (형: "좌하단에는 확대축소말고 뭔가 보이기 안보이기 토글 필요할듯") — 끈 것은 .ap.hide-<id> */
  function layersHtml(): string {
    let h = `<div class="lyh">지도에 보이기</div>`
    for (const l of LAYERS) {
      const on = !hiddenLayers.has(l.id)
      h += `<button class="lyr${on ? ' on' : ''}" data-act="layer" data-v="${l.id}"><i>${on ? '●' : '○'}</i><b>${l.name}</b><span>${l.hint}</span></button>`
    }
    return h
  }

  function toggleLayer(id: LayerId): void {
    if (hiddenLayers.has(id)) hiddenLayers.delete(id)
    else hiddenLayers.add(id)
    applyLayers()
    try { localStorage.setItem(LAYER_KEY, JSON.stringify([...hiddenLayers])) } catch { /* 저장 못 하는 곳 */ }
  }

  function applyLayers(): void {
    for (const l of LAYERS) root.classList.toggle(`hide-${l.id}`, hiddenLayers.has(l.id))
  }

  /**
   * 길 보기 — 선의 생김새가 무슨 길이고 무엇이 다른지 (형: "경로에 직선이랑 점선 이런건 뭔차이임").
   * 길의 선은 mapview.EDGE_STYLE 그대로 그려 보인다.
   */
  function roadKeyHtml(): string {
    let h = `<button data-act="roadkey">${roadOpen ? '길 보기 ✕' : '길 보기'}</button>`
    if (!roadOpen) return h
    const line = (attrs: string): string => `<svg width="54" height="14" viewBox="0 0 54 14"><path d="M4 7H50" fill="none" ${attrs.replace(/stroke-width="(\d+)"/, (_, w: string) => `stroke-width="${Math.max(3, Number(w) * 0.7)}"`)}/></svg>`
    const ROAD: ReadonlyArray<[EdgeKind, string]> = [
      ['field', '한 계절 · 빠르고 트였다 · 숨기 어렵다'],
      ['pass', '두 계절 · 겨울엔 눈이 덮는다 · 창을 휘두르기 좁다'],
      ['forest', '숨기 좋다 · 숲에선 활을 못 쏜다'],
      ['reeds', '숨기 좋다 · 겨울엔 더 좋다'],
      ['ford', '강을 건넌다 · 여름 장마엔 물이 붇는다'],
      ['sea', '배로 건너는 바닷길'],
      ['mudflat', '두 계절 · 발이 빠진다'],
    ]
    h += `<div class="rk"><h5>길</h5>${ROAD.map(([k, t]) => `<div>${line(EDGE_STYLE[k])}<b>${EDGE_NAME[k]}</b><span>${t}</span></div>`).join('')}`
    // 길 기호 — 계절·닿는 고을에 따라 바뀐다 (mapview.routeSign)
    h += `<h5>길 기호 · 계절따라 바뀐다</h5>`
    h += (Object.keys(ROUTE_SIGN_NAME) as RouteSign[]).map((s) => `<div><img class="rki" src="${ART}icon/route-${s}.png" alt=""><span>${esc(ROUTE_SIGN_NAME[s])}</span></div>`).join('')
    h += `<h5>특산 · 고을 위 둥근 표</h5><div class="rkg">${(['iron', 'salt', 'wood', 'horse'] as const).map((g) => `<span>${icon(GOOD_ICON[g])}${GOOD_NAME[g]}</span>`).join('')}</div>`
    h += `<div><span>흐린 표는 아무도 안 사는 땅 — 일구면 난다</span></div>`
    h += `<h5>화살</h5>`
    h += `<div>${line('stroke="#c8402a" stroke-width="7"')}<span>이번 계절 떠나기로 고른 길</span></div>`
    h += `<div>${line('stroke="#c8402a" stroke-width="7" stroke-dasharray="10 6"')}<span>이미 가는 중 · 남은 계절이 적힌다</span></div>`
    h += `<div>${line('stroke="#3a2a5a" stroke-width="8" stroke-dasharray="2 10" stroke-linecap="round"')}<span>몰래 가는 기습 길</span></div>`
    h += `<div>${line('stroke="#3a2a5a" stroke-width="7" stroke-dasharray="10 6"')}<span>우리 쪽으로 오는 적</span></div>`
    h += `<h5>땅 사이 금</h5><div>${line('stroke="#2a1d10" stroke-width="3"')}<span>나라와 나라의 경계</span></div>`
    h += `<div>${line('stroke="#6b4a2a" stroke-width="3" stroke-dasharray="3 4"')}<span>같은 나라 고을끼리의 금</span></div></div>`
    return h
  }

  /** 배우는 판의 띠 — 지금 할 일 하나 · 눌러야 할 곳이 빛난다 (tutorial.ts) */
  function paintTut(r: Realm): void {
    const band = $('.tutband')
    if (realm === null || realm.region !== 'tutorial' || front !== null || prologue !== null || (realm.outcome && !realm.endless)) {
      band.innerHTML = ''
      tutSheet.textContent = ''
      spot.set(undefined, null)
      return
    }
    loadTut()
    if (tut.off) {
      band.innerHTML = ''
      tutSheet.textContent = ''
      spot.set(undefined, null)
      return
    }
    const ctx = { r, orders: ordersNow(), report, acts: tut.acts }
    const i = tutAt(tut.i, ctx)
    if (i !== tut.i) {
      tut.i = i
      saveTut()
      if (i >= TUT_STEPS.length) markTutorialOver('done')
    }
    band.innerHTML = tutBandHtml(i, esc)
    tutSheet.textContent = tutStyle(TUT_STEPS[i])
    spot.set(TUT_STEPS[i], ctx)
  }

  /**
   * 지도에서 고른 말 — 아래에 띠로. 같은 고을에서 둘 넘게 고르면 합치기 단추, 길 위의 군대면 어디로 가는 중인지.
   */
  function selBarHtml(r: Realm): string {
    const sel = armySel.map((id) => r.armies[id]).filter((a): a is Army => a !== undefined)
    if (sel.length === 0) return ''
    let h = `<div class="sbf">${sel.map((a) => bust(a.hero !== null ? r.heroes[a.hero] : undefined, 'sbface')).join('')}</div><div class="sbt">`
    const first = sel[0]!
    if (first.march !== null) {
      h += `<b>${esc(armyName(r, first))}</b><span>${esc(josa(r.nodes[first.march.to]?.name ?? '', '으로', '로'))} 가는 중 · ${esc(arriveWhen(r.season, first.march.left))}</span>`
    } else if (sel.length === 1) {
      const more = Object.values(r.armies).filter((x) => x.faction === me() && x.id !== first.id && x.at === first.at && x.march === null).length
      h += `<b>${esc(armyName(r, first))} · ${headcount(forceOf(r, first))}명</b><span>갈 곳을 누른다 · 제 고을을 누르면 머문다 · 칩의 숫자는 닿는 데 걸리는 계절 · 협공은 다른 우리 군대와 같은 계절에 닿아 한 판으로 싸운다${more > 0 ? ' · 옆 말을 누르면 함께 고른다' : ''}</span>`
    } else {
      const men = sel.reduce((s, a) => s + headcount(forceOf(r, a)), 0)
      const heroes = sel.filter((a) => a.hero !== null).length
      h += `<b>${sel.length}군 · ${men}명</b><span>갈 곳을 누르면 함께 간다</span>`
      h += `</div><button class="btn on sm" data-act="selmerge" ${heroes > 1 ? 'disabled' : ''}>합치기</button>`
      if (heroes > 1) h += `<span class="sbwhy">장수 둘은 한 군대를 함께 못 이끈다</span>`
      return h + `<button class="sbx" data-act="selclose" aria-label="고르기 풀기">✕</button>`
    }
    return h + `</div><button class="sbx" data-act="selclose" aria-label="고르기 풀기">✕</button>`
  }

  /** 깃발 줄 — 나라마다 깃발과 땅 수 (땅의 주인은 누구나 안다). 누르면 그 나라 땅만 또렷하다 */
  function legendHtml(r: Realm): string {
    const count = (f: string): number => Object.values(r.nodes).filter((n) => n.owner === f).length
    // 아는 나라만 (삼한 남부 판의 발견 — 모르는 나라는 깃발 줄에도 없다)
    const fs = sorted(Object.values(r.factions)).filter((f) => knows(r, me(), f.id)).map((f) => ({ f, n: count(f.id) })).sort((a, b) => b.n - a.n)
    let h = ''
    for (const { f, n } of fs) {
      const c = FACTION_ART[f.id]?.color ?? '#ccc'
      const cls = `${focus === f.id ? ' on' : ''}${f.id === me() ? ' me' : ''}${n === 0 ? ' gone' : ''}`
      // 남의 나라는 군장 얼굴(탈)을 함께 — 깃발 줄만 봐도 누가 우리를 어떻게 보는지 (mood.ts)
      const mood = f.id !== me() && n > 0 ? moodImg(ART, moodOf(r, me(), f.id).mood, 'mood sm') : ''
      h += `<button class="lg${cls}" data-act="focus" data-id="${f.id}" style="--c:${c}">${emblem(f.id, 'lem')}<b>${n}</b><span>${esc(f.name)}</span>${mood}</button>`
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
      const on = chosen?.edge === m.edge.id
      let right = ''
      if (m.hostile) right = `<span class="win">${m.win !== null ? fightFeel(m.win[0], m.win[1]) : unknownFeel()}</span>`
      h += `<button class="row mv ${on ? 'on' : ''}" data-act="mv" data-army="${a.id}" data-edge="${m.edge.id}">`
      h += `${emblem(node.owner)}<span class="dest">${esc(node.name)}</span><span class="sub">${EDGE_NAME[m.edge.kind]} · ${esc(arriveWhen(r.season, m.seasons, true))}</span>${right}</button>`
      // 막힌 길 — 갈 수는 있다. 무엇을 잃는지 미리
      if (m.blocked !== null) h += `<div class="banner bad">${esc(HARD_LINE[m.blocked])}</div>`
      if (on) h += marchChoice(r, a, m)
    }
    return h
  }

  /**
   * 어떻게 갈지 — 진군 방식과 군량 (형: "강을 도하해 기습 · 대로로 행군 · 산기슭으로 · 절벽을 올라간다 · 식량은 어떻게 챙겨가고").
   * 방식마다 얻는 것과 거는 것을 말로, 먹힐 낌새와 판세를 색으로. 숨어 가는 길은 도박이다 — 큰 군대는 잘 안 숨는다.
   */
  function marchChoice(r: Realm, a: Army, m: Move): string {
    const feel = (w: readonly [number, number] | null): string => (w !== null ? fightFeel(w[0], w[1]) : unknownFeel())
    const c = pick[a.id]
    let h = ''
    if (m.hostile) {
      // 병종·지형·공수가 어떻게 걸리나 (상성 — 창 > 방패 > 활 > 창 · 성과 높은 데의 궁수 · 들판의 창병 …)
      const hints = matchupHints(r, me(), a.mix, m.to, m.edge.kind)
      h += hints.length > 0 ? `<ul class="hints">${hints.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''
      const chosen: Approach = c?.approach ?? (c?.ambush === true ? 'night' : 'road')
      h += `<div class="how">`
      for (const x of approachMoves(r, me(), a, m)) {
        const does = APPROACH_DOES[x.ap]
        // 한 줄에 하나 — 왼쪽은 이름과 얻고 거는 것, 오른쪽은 판세 (좁은 폰에서도 읽히게)
        h += `<button class="hw ${x.ap !== 'road' ? 'amb ' : ''}${chosen === x.ap ? 'on' : ''}" data-act="ap" data-army="${a.id}" data-v="${x.ap}"><span class="hwl"><b>${APPROACH_NAME[x.ap]}${x.seasons !== m.seasons ? ` <small>${x.seasons}계절</small>` : ''}</b>`
        h += `<span class="mute">${tx(`${does.gain}. ${does.risk}`)}</span></span><span class="hwr">`
        if (x.ap === 'road') h += `<span class="ln">판세 ${feel(x.hit)}</span>`
        else h += `<span class="ln">${x.ap === 'cliff' ? '오르기' : '몰래 닿기'} ${ambushFeel(x.p)}</span><span class="ln">안 들키면 ${feel(x.hit)}</span><span class="ln">들키면 ${feel(x.miss)}</span>`
        h += `</span></button>`
      }
      h += `</div>`
      // 길과 때 (형이 고름: "길과 때의 싸움") — 이 길이 왜 숨기 좋은지·나쁜지
      const cv = concealOf(r, m.edge.id, headcount(forceOf(r, a)), m.to)
      const cw = cv.why.map((w) => CONCEAL_LINE[w]).filter((x) => x !== undefined)
      h += `<p class="mute tip"><b>${cv.tier === 'good' ? '숨기 좋은 길' : cv.tier === 'fair' ? '그저 그런 길' : '숨기 나쁜 길'}</b>${cw.length > 0 ? ` · ${esc(cw.join(' · '))}` : ''}</p>`
    }
    // 군량 — 몇 계절치를 챙기나 (형: "넉넉히랑 안듦 두개밖에 없는데 이거 기본수치로 주고 줄일수 있게").
    // 길 계절은 늘 챙기고, 그 위에 더 챙길 계절을 고른다. 기본은 옛 "넉넉히"(rationReserve). 더 챙길수록 곡식이 든다
    const extra = rationExtraOf(r, a, m.seasons, c?.ration)
    const cost = rationCost(r, a, m.seasons, extra)
    const total = m.seasons + extra
    h += `<div class="ration">${icon('good-rice', 'rci')}<b>군량 ${total}계절치</b>`
    h += `<span class="stepper sm"><button data-act="ration" data-army="${a.id}" data-v="less" ${extra <= 0 ? 'disabled' : ''}>−</button><b>${total}</b>`
    h += `<button data-act="ration" data-army="${a.id}" data-v="more" ${extra >= P.realm.rationMaxExtra || rationCost(r, a, m.seasons, extra + 1) > left().grain + cost ? 'disabled' : ''}>+</button></span>`
    h += `<span class="mute">${tx(cost > 0 ? `곡식 ${cost}` : '곡식 안 듦')}</span>`
    h += `<button class="btn ghost sm${extra === P.realm.rationReserve ? ' on' : ''}" data-act="ration" data-army="${a.id}" data-v="full">기본</button></div>`
    h += `<p class="mute tip">${tx(extra <= 0
      ? `길 ${m.seasons}계절치만 챙긴다 — 닿자마자 바닥이라 싸움이 길어지면 사기가 꺾이고, 남의 땅에 머물면 사람이 흩어진다.`
      : `길 ${m.seasons}계절에 더해 ${extra}계절을 남의 땅에서 버틴다. 그 뒤로는 바닥나 사기가 꺾인다.`)}</p>`
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
      const on = split.edge === m.edge.id
      let right = ''
      if (m.blocked !== null) right = `<span class="mute">${esc(HARD_LINE[m.blocked])}</span>`
      else if (m.hostile && sent > 0) right = `<span class="win">${m.win !== null ? fightFeel(m.win[0], m.win[1]) : unknownFeel()}</span>`
      h += `<button class="row mv ${on ? 'on' : ''}" data-act="sdest" data-edge="${m.edge.id}">${emblem(node.owner)}<span class="dest">${esc(node.name)}</span><span class="sub">${EDGE_NAME[m.edge.kind]} · ${m.seasons}계절</span>${right}</button>`
      if (on && m.hostile) {
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

  /**
   * 부대의 힘과 무장 (형: "창병 궁수 방패병 다르지 않나 · 무장해서 뽑으면 그 수도 파악 · 부대마다 전투력은 어떻게 나오고 · 철이 아니면 뭘로 싸움?") —
   * 병종마다 몇 명이 무엇을 들었나, 힘이 얼마이고 무엇 때문인가, 병종마다 무장 올리기.
   */
  function gearBlock(r: Realm, a: Army): string {
    let h = ''
    const p = armyPower(r, a.id)
    if (p !== null) {
      const mine = sorted(Object.values(r.armies)).filter((x) => x.faction === me()).map((x) => armyPower(r, x.id)?.total ?? 0)
      const top = Math.max(1, ...mine)
      // 무장은 평균이 가장 가까운 단계의 이름으로 (돌·나무 · 청동 · 쇠날 · 온 쇠 · 고리칼)
      const R = P.realm
      const near = ([['stone', R.equipStone], ['bronze', R.equipBronze], ['ironTip', R.equipIronTip], ['iron', R.equipIron], ['ringSword', R.equipRingSword]] as Array<[Equip, number]>)
        .sort((x, y) => Math.abs(x[1] - p.parts.gear) - Math.abs(y[1] - p.parts.gear))[0]![0]
      const gear = `${TIER_NAME[near]} 무장`
      const lead = a.hero === null ? '장수가 없다' : p.parts.lead >= 1.15 ? '장수가 잘 이끈다' : '장수가 이끈다'
      const mor = p.parts.morale < 0.9 ? '사기가 낮다' : p.parts.morale > 1.05 ? '사기가 높다' : '사기 보통'
      h += `<div class="pow"><b>전투력 ${Math.round(p.total).toLocaleString('ko-KR')}</b><span class="pbar"><i style="width:${Math.max(4, (p.total / top) * 100)}%"></i></span>`
      h += `<span class="mute">사람 ${p.parts.men} · ${gear} · ${lead} · ${mor}</span></div>`
    }
    const canArm = a.march === null && r.nodes[a.at]?.owner === me()
    const st = left()
    for (const [k, rows] of Object.entries(kitLines(a)) as Array<[UnitKind, Array<{ tier: Equip; n: number }>]>) {
      const n = rows.reduce((s, x) => s + x.n, 0)
      if (n <= 0) continue
      h += `<div class="kitrow">${icon(UNIT_ICON[k])}<b>${UNIT_NAME[k]} ${n}</b><span class="kt">${rows.slice().reverse().map((x) => `${esc(GEAR_NAME[k]?.[x.tier] ?? TIER_NAME[x.tier])} ${x.n}`).join(' · ')}</span>`
      const ac = canArm ? armCost(r, a.id, k) : null
      const on = musters.some((o) => o.kind === 'arm' && o.army === a.id && o.unit === k)
      if (ac !== null) {
        const label = on ? '올리는 중 · 취소' : `${ac.n}명 → ${GEAR_NAME[k]?.[ac.to] ?? TIER_NAME[ac.to]} · 철 ${ac.iron}`
        h += `<button class="btn sm ${on ? 'on' : ''}" data-act="arm" data-army="${a.id}" data-unit="${k}" ${on || (st.iron >= ac.iron && st.grain >= ac.grain) ? '' : 'disabled'}>${esc(label)}</button>`
      }
      h += `</div>`
    }
    return h
  }

  function sortie(r: Realm): string {
    const byTo = new Map<string, Array<{ army: Army; move: Pick<Move, 'seasons' | 'edge' | 'hostile'> }>>()
    for (const [army, c] of Object.entries(pick)) {
      const a = r.armies[army]
      if (c === undefined || a === undefined || a.march !== null) continue
      const m = movesOf(r, me(), a).find((x) => x.edge.id === c.edge)
      if (m === undefined) continue
      byTo.set(m.to, [...(byTo.get(m.to) ?? []), { army: a, move: m }])
    }
    // 이미 길 위에 있는 군대도 — 앞서 보낸 군대와 이번에 보내는 군대가 같은 계절에 닿으면 협공이다
    for (const a of sorted(Object.values(r.armies))) {
      const ed = a.march !== null ? r.edges[a.march.edge] : undefined
      if (a.faction !== me() || a.march === null || ed === undefined || !byTo.has(a.march.to)) continue
      const own = r.nodes[a.march.to]?.owner ?? null
      byTo.get(a.march.to)!.push({ army: a, move: { seasons: a.march.left, edge: ed, hostile: own !== null && own !== me() } })
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
    if (note !== '') h += `<div class="banner bad">${tx(note)}</div>`
    const armies = sorted(Object.values(r.armies)).filter((a) => a.faction === me())
    if (armies.length === 0) h += `<p class="mute">군대가 없다. 징병으로 뽑는다.</p>`
    for (const a of armies) {
      const hero = a.hero !== null ? r.heroes[a.hero] : undefined
      const disbanding = musters.some((o) => o.kind === 'disband' && o.army === a.id)
      const fresh = freshArmy === a.id
      h += `<div class="acard${fresh ? ' fresh' : ''}">${bust(hero)}<div class="ab">${fresh ? `<div class="banner good">나눴다 — ${pick[a.id] !== undefined && r.edges[pick[a.id]!.edge] !== undefined ? `${esc(josa(r.nodes[otherEnd(r.edges[pick[a.id]!.edge]!, a.at)!]?.name ?? '', '으로', '로'))} 떠난다. 지도에 화살표가 생겼다.` : '여기 남는다.'}</div>` : ''}<div class="an"><b>${esc(armyName(r, a))}</b>`
      h += `<span class="mute">${esc(r.nodes[a.at]?.name ?? '')} · ${headcount(forceOf(r, a))}명</span></div><div class="units">`
      h += `</div>${gearBlock(r, a)}`
      if (realm!.armies[a.id] === undefined) h += `<div class="mute">이번 계절에 나눴다</div>`
      if (a.march !== null) {
        h += `<div class="mute">${esc(josa(r.nodes[a.march.to]?.name ?? '', '으로', '로'))} 가는 중 · ${esc(arriveWhen(r.season, a.march.left))}${a.march.ambush ? ' · 몰래 가는 길' : ''}</div></div></div>`
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

  // ───────── 징병 (형: "군사징병이랑 개척 좀 확실히 구분필요함" — 군사는 「징병」, 집 옮기기는 「백성」 탭)
  function draftSheet(r: Realm): string {
    const season = seasonOf(r.season)
    let h = `<h3 class="sech men">${icon('unit-spear')}징병 · 군사 뽑기</h3>`
    if (note !== '') h += `<div class="banner bad">${tx(note)}</div>`
    h += `<button class="btn ghost wide home" data-act="tab" data-tab="people">${icon('settle-farm-village', 'ic')} 집을 옮기는 개척·이주는 「백성」 탭에서</button>`
    // 집 · 장정 · 군사가 뭐가 다른지 (형: "장정이랑 징병, 병사 뭔차이임?") — 한 줄 그림으로
    h += `<div class="flow3"><div>${icon('settle-farm-village')}<b>집</b><span>다섯 식구 남짓 · 농사짓고 곡식을 낸다</span></div><i>징병 →</i>`
      + `<div>${icon('unit-spear')}<b>군사</b><span>움직이고 쳐들어간다 · 곡식을 먹는다</span></div></div>`
      + `<p class="mute">${tx('장정은 뽑지 않은 집의 사내들이다. 적이 오면 제 고을만 지킨다. 집이 많을수록 많고, 곡식을 안 먹는다.')}</p>`
    if (season === 'spring') h += `<div class="banner bad">${tx('봄에 뽑으면 그해 가을 수확이 준다')}</div>`
    if (season === 'autumn' || season === 'winter') h += `<div class="banner good">${tx('거둔 뒤라 뽑기 좋은 때다')}</div>`
    const pending = musters.filter((o): o is Extract<Order, { kind: 'draft' }> => o.kind === 'draft')
    for (const n of sorted(Object.values(r.nodes)).filter((x) => x.owner === me())) {
      const done = pending.filter((o) => o.node === n.id).reduce((s, o) => s + o.n, 0)
      const unit = draftUnit[n.id] ?? 'spear'
      const limAll = Math.max(0, draftLimit(r, me(), n.id) - done)
      // 기병은 말이, 수군은 배 지을 나무가 있어야 뽑는다 (땅마다 나는 것)
      const lim = Math.max(0, Math.min(limAll, draftLimit(r, me(), n.id, unit) - done))
      const step = Math.max(1, Math.round(lim / 10))
      const want = Math.min(lim, draftN[n.id] ?? Math.min(lim, 20))
      h += `<div class="ncard draftc"><div class="an">${icon(nodeIcon(n), 'nic')}<b>${esc(n.name)}</b>`
      h += `<span class="mute">${tx(`집 ${Math.floor(n.hh)} · 장정 ${militiaMen(r, n.id)}${done > 0 ? ` · 뽑는 중 군사 ${done}` : ''}`)}</span></div>`
      if (limAll <= 0) {
        h += `<div class="mute">이번 계절엔 더 못 뽑는다</div></div>`
        continue
      }
      h += `<div class="seg">`
      for (const u of draftable(n)) h += `<button class="${u === unit ? 'on' : ''}" data-act="dunit" data-node="${n.id}" data-unit="${u}">${icon(UNIT_ICON[u])}${UNIT_NAME[u]}</button>`
      h += `</div><div class="stepper"><button data-act="dn" data-node="${n.id}" data-d="${-step}">−</button><b>${want}</b>`
      h += `<button data-act="dn" data-node="${n.id}" data-d="${step}">+</button><span class="mute">명 · 최대 ${lim} · ${tx(`곡식 ${Math.ceil(draftCost(want).grain)}`)}</span>`
      h += `<button class="btn on men" data-act="draft" data-node="${n.id}" ${want <= 0 ? 'disabled' : ''}>군사 ${want}명 뽑기</button></div>`
      const nd = draftNeeds(unit, Math.max(1, want))
      if (unit === 'horse') h += `<p class="mute">${lim > 0 ? `말 ${nd.horse}필이 든다.` : '말이 없다.'} 말은 목장(너른벌을 일구면)에서 나거나 바꿔 온다.</p>`
      if (unit === 'boat') h += `<p class="mute">${lim > 0 ? `배 지을 나무 ${nd.wood}짐이 든다.` : '배 지을 나무가 없다.'} 나무는 솔숲·산·산성 땅에서 난다.</p>`
      // 철을 더 들이면 처음부터 한 단계 좋은 무기 (철의 쓰임)
      const ic = want > 0 ? draftIronCost(r, me(), want, unit) : null
      const base = r.factions[me()]?.equip
      if (ic !== null) {
        h += `<label class="chk"><input type="checkbox" data-act="diron" data-node="${n.id}" ${draftIron[n.id] === true ? 'checked' : left().iron < ic.iron ? 'disabled' : ''}> 새로 뽑는 ${esc(UNIT_NAME[unit])} ${want}명에게 ${esc(josa(GEAR_NAME[unit]?.[ic.to] ?? TIER_NAME[ic.to], '을', '를'))} 들린다 · 철 ${ic.iron}</label>`
        if (base !== undefined) h += `<p class="mute">철을 안 들이면 ${esc(josa(GEAR_NAME[unit]?.[base] ?? TIER_NAME[base], '을', '를'))} 든다.</p>`
      }
      h += `</div>`
    }
    if (pending.length > 0) {
      h += `<h4>이번 계절 징병</h4>`
      pending.forEach((o) => {
        h += `<div class="row">${icon(UNIT_ICON[o.unit])}${esc(r.nodes[o.node]?.name ?? '')} ${UNIT_NAME[o.unit]} ${o.n}<button class="btn ghost sm" data-act="undraft" data-i="${musters.indexOf(o)}">취소</button></div>`
      })
    }
    return h
  }

  // ───────── 백성 — 개척 · 이주 (집을 옮긴다. 군사가 아니다)
  function peopleSheet(r: Realm): string {
    let h = `<h3 class="sech home">${icon('settle-farm-village')}백성 · 집을 옮긴다</h3>`
    if (note !== '') h += `<div class="banner bad">${tx(note)}</div>`
    h += `<p class="mute">${tx('군사가 아니라 농사짓는 집을 옮긴다. 옮긴 집은 계절을 넘기면 바로 그 고을에 자리 잡는다.')}</p>`
    // 자동 분배 — 맨 위 큰 단추. 누르면 켜지고(단추는 잠긴다), 직접 옮기면 꺼져서 다시 누를 수 있다
    // (형 2026-10-20: "자동분배는 맨 위에 큰버튼으로 … 한번 누르면 비활성화. 본인이 직접 재분배 해서 숫자가 달라진경우에 다시활성화")
    h += autoMigOn()
      ? `<button class="btn wide autobtn" disabled><b>✓ 자동 분배 중</b><small>${tx('붐비는 고을의 집이 계절마다 한산한 고을로 저절로 옮겨 간다. 아래에서 직접 옮기면 꺼진다.')}</small></button>`
      : `<button class="btn on wide autobtn" data-act="mig-auto" data-v="1"><b>자동 분배</b><small>${tx('누르면 붐비는 고을부터 고르게 나눈다. 이번 계절 직접 옮긴 것은 거둔다.')}</small></button>`
    const lands = [...new Set([...settleTargets(r, me()).map((t) => t.to), ...settlePending().map((o) => o.to)])].sort()
    h += `<div class="twoway"><button class="sec home" data-act="jump" data-to="sec-settle">${icon('settle-farm-village')}<b>개척</b><span>${lands.length > 0 ? '집을 빈땅으로 옮겨 새 마을' : '맞닿은 빈땅이 없다'}</span></button>`
    h += `<button class="sec move" data-act="jump" data-to="sec-move">${icon('unit-porters')}<b>이주</b><span>${autoMigOn() ? '우리 고을끼리 · 자동 분배 중' : '우리 고을끼리 · 직접 옮긴다'}</span></button></div>`
    h += `<h4 id="sec-settle" class="sech home">${icon('settle-farm-village')}개척 · 빈땅에 새 마을을 일군다</h4>`
    // 빈땅은 아무 나라 땅도 아니다 — 사람이 가서 살면 그때 우리 마을이 된다 (형: "우리영토가 아닌데도 사람을보내서 살게하는거야? 그게맞나??")
    h += `<p class="mute">${tx('빈땅은 주인 없는 땅이다. 우리 고을과 길로 맞닿은 빈땅에 집을 보내면, 자리 잡는 대로 그 땅이 우리 마을이 된다. 남의 나라 땅에는 보낼 수 없다.')}</p>`
    if (lands.length > 0) for (const to of lands) h += settleCard(r, to)
    else h += `<p class="mute">${tx('지금은 우리 고을과 맞닿은 빈땅이 없다.')}</p>`
    h += migrateSection(r)
    return h
  }

  /** 고을 하나 — 옮기기 판의 왼쪽(보내는 곳)·오른쪽(받는 곳) 카드. 집이 얼마에서 얼마로 */
  function moveSide(r: Realm, id: string, d: number, role: string): string {
    const n = r.nodes[id]!
    const room = n.kind === 'wild' ? (n.room ?? 0) : homeRoom(n)
    const after = Math.max(0, Math.floor(n.hh) + d)
    return `<div class="mvc"><span class="mvr">${role}</span>${icon(nodeIcon(n), 'mvi')}<b>${esc(n.name)}</b>`
      + `<span class="mute">${tx(`집 ${Math.floor(n.hh)} → ${after}`)}</span>`
      + (room > 0 ? `<span class="cbar${after > room ? ' full' : after > room * 0.8 ? ' near' : ''}"><i style="width:${Math.min(100, (after / room) * 100).toFixed(0)}%"></i></span>` : '')
      + `</div>`
  }

  // ───────── 개척
  function settlePending(): Array<Extract<Order, { kind: 'settle' }>> {
    return settles.filter((o): o is Extract<Order, { kind: 'settle' }> => o.kind === 'settle')
  }

  /** 개척에서 보낼 고을 — 고른 것이 있으면 그것, 아니면 도읍이 아닌 가장 붐비는 맞닿은 고을 (economy.settleSource) */
  function settleFromOf(r: Realm, to: string): string {
    const froms = settleTargets(r, me()).filter((t) => t.to === to).map((t) => t.from)
    return froms.includes(settleFrom[to] ?? '') ? settleFrom[to]! : (settleSource(r, me(), to) ?? '')
  }

  /**
   * 빈땅 하나의 개척 카드 — [보내는 고을] ⟶ [빈땅] 을 좌우로 (형: "보낼곳 받을곳은 좌 우로 배치해야 직관적이지").
   * 보내는 고을의 기본은 도읍이 아닌 가장 붐비는 곳. 한 번에 보낼 수 있는 몫과 그 까닭 · 언제 자리 잡나. `r` 은 이미 보낸 개척이 든 판이다
   */
  function settleCard(r: Realm, to: string): string {
    const n = r.nodes[to]!
    const froms = settleTargets(r, me()).filter((t) => t.to === to).map((t) => t.from)
    const sent = settlePending().filter((o) => o.to === to)
    const room = n.room ?? 0
    let h = `<div class="ncard settlec"><div class="an">${icon(nodeIcon(n), 'nic')}<b>${esc(n.name)}</b>`
    h += `<span class="mute">${tx(`자리 ${room} 가운데 ${Math.floor(n.hh)} 찼다`)}</span></div>`
    for (const o of sent) {
      h += `<div class="row mvq"><span class="nchip">${esc(r.nodes[o.from]?.name ?? '')}</span><i class="ar">⟶</i><span class="nchip">${esc(n.name)}</span>${tx(` 집 ${o.n} · ${arriveWhen(r.season, 1)}`)}<button class="btn ghost sm" data-act="unsettle" data-i="${settles.indexOf(o)}">취소</button></div>`
    }
    if (froms.length === 0) return h + `<div class="mute">${sent.length > 0 ? '이번 계절엔 더 못 보낸다' : tx('지금은 보낼 수 없다 — 맞닿은 우리 고을이 없거나 길이 막혔거나 자리가 찼다')}</div></div>`
    const from = settleFromOf(r, to)
    const a = r.nodes[from]!
    const lim = settleLimit(r, me(), from, to)
    const want = Math.min(lim, settleN[to] ?? Math.min(lim, 20))
    const step = Math.max(1, Math.round(lim / 10))
    h += `<div class="mv2">${moveSide(r, from, -want, '보내는 곳')}<div class="mvmid"><span class="stepper sm"><button data-act="sn" data-node="${to}" data-d="${-step}">−</button><b>${want}</b>`
    h += `<button data-act="sn" data-node="${to}" data-d="${step}">+</button></span><i class="mva">⟶</i><span class="mute">집</span></div>${moveSide(r, to, want, '받는 곳')}</div>`
    if (froms.length > 1) {
      h += `<div class="mute">다른 고을에서 보내기</div><div class="seg wrap">`
      for (const f of froms) h += `<button class="${f === from ? 'on' : ''}" data-act="sfrom" data-node="${to}" data-from="${f}">${esc(r.nodes[f]!.name)}</button>`
      h += `</div>`
    }
    // 한 번에 보낼 수 있는 몫과 그 까닭
    const R = P.realm
    const share = Math.floor(a.hh * R.settleShare)
    const roomLeft = Math.max(0, room - Math.floor(n.hh))
    const why = lim === roomLeft ? `${n.name} 자리가 그만큼 남았다` : lim === share ? `한 계절에 보내는 고을 집 ${Math.floor(a.hh)} 가운데 ${share}까지` : '곡식이나 나무가 그만큼만 댄다'
    h += `<p class="mute">${tx(`한 번에 최대 ${lim}집 — ${why}. 곡식 ${settleCost(want).grain}`)}</p>`
    if (Object.values(r.factions).some((f) => f.capital === from)) h += `<p class="mute">${tx('도읍에서 빼면 도읍의 수확과 징병이 준다.')}</p>`
    h += `<button class="btn on home wide" data-act="settle" data-node="${to}" data-from="${from}" ${want <= 0 ? 'disabled' : ''}>${want}집 옮기기 · ${esc(arriveWhen(r.season, 1, true))} 자리 잡는다</button></div>`
    return h
  }

  /**
   * 이주 (형: "집 분배하는거 자동으로 분배하기 · 그게 디폴트이고 자동안하면 본인이 직접 이주 · 전방에 강제이주시키거나 수도에 집중") —
   * 고을마다 붐빔 막대 · 자동 분배 켜고 끄기와 이번 계절 저절로 옮겨 갈 흐름 · 억지 이주([보낼 고을] ⟶ [받을 고을] 좌우로).
   * `r` 은 이번 계절 고른 개척·이주가 든 판이다.
   */
  function migrateSection(r: Realm): string {
    const on = autoMigOn()
    const mine = sorted(Object.values(r.nodes)).filter((n) => n.owner === me() && n.kind !== 'sodo' && homeRoom(n) > 0)
    let h = `<h4 id="sec-move" class="sech move">${icon('unit-porters')}이주 · 우리 고을끼리 집을 옮긴다</h4>`
    h += `<p class="mute">${tx('고을마다 편히 품는 집이 있다. 넘치면 붐벼 집이 덜 는다. 전방 고을에 집이 많으면 장정이 많아 지키기 좋고, 도읍에 모으면 그곳에서 더 뽑는다.')}</p>`
    // 붐빔 막대 — 고을마다
    h += `<div class="crowd">`
    for (const n of mine) {
      const c = crowdOf(n)
      const cls = c > 1 ? 'full' : c > 0.8 ? 'near' : ''
      h += `<div class="crow"><span class="cn">${esc(n.name)}</span><span class="cbar ${cls}"><i style="width:${Math.min(100, c * 100).toFixed(0)}%"></i></span><span class="mute">${tx(`집 ${Math.floor(n.hh)} / ${homeRoom(n)}`)}${c > 1 ? ' · 붐빈다' : ''}</span></div>`
    }
    h += `</div>`
    // 자동 분배 — 켜기는 판 맨 위 큰 단추. 여기서는 이번 계절 저절로 옮겨 갈 것만 보인다
    if (on) {
      const fl = autoFlows(r, me())
      h += fl.length === 0 ? `<p class="mute">${tx('이번 계절엔 붐비는 고을이 없다. 저절로 옮겨 갈 집이 없다.')}</p>`
        : `<p class="mute">${tx(`이번 계절 저절로 옮겨 갈 집 — ${arriveWhen(r.season, 1)}`)}</p>${fl.map((x) => `<div class="row mvq"><span class="nchip">${esc(r.nodes[x.from]?.name ?? '')}</span><i class="ar">⟶</i><span class="nchip">${esc(r.nodes[x.to]?.name ?? '')}</span>${tx(` 집 ${x.n}`)}</div>`).join('')}`
    } else h += `<p class="mute">${tx('자동 분배가 꺼져 있다 — 붐비는 고을이 있어도 집이 저절로 옮겨 가지 않는다. 아래에서 직접 옮긴다.')}</p>`
    // 억지 이주 — 고른 것
    for (const o of settles) {
      if (o.kind !== 'migrate') continue
      h += `<div class="row mvq"><span class="nchip">${esc(r.nodes[o.from]?.name ?? '')}</span><i class="ar">⟶</i><span class="nchip">${esc(r.nodes[o.to]?.name ?? '')}</span>${tx(` 집 ${o.n} · ${arriveWhen(r.season, 1)}`)}<button class="btn ghost sm" data-act="unsettle" data-i="${settles.indexOf(o)}">취소</button></div>`
    }
    const froms = mine.filter((n) => n.hh >= 1)
    if (froms.length < 2) return h + `<p class="mute">${tx('옮길 고을이 둘은 있어야 한다.')}</p>`
    const from = froms.some((n) => n.id === migFrom) ? migFrom : froms.slice().sort((a, b) => crowdOf(b) - crowdOf(a))[0]!.id
    const tos = mine.filter((n) => n.id !== from && migratePath(r, me(), from, n.id) !== null)
    if (tos.length === 0) return h + `<p class="mute">${tx('그 고을에서 우리 땅으로 이어진 다른 고을이 없다.')}</p>`
    const to = tos.some((n) => n.id === migTo) ? migTo : tos.slice().sort((a, b) => crowdOf(a) - crowdOf(b))[0]!.id
    const lim = migrateLimit(r, me(), from, to)
    const want = Math.min(lim, migN > 0 ? migN : Math.min(lim, 20))
    const step = Math.max(1, Math.round(lim / 10))
    // 왼쪽 열은 보낼 고을, 오른쪽 열은 받을 고을 — 가운데 화살표 위에 집 수
    h += `<div class="mv3"><div class="mvcol"><span class="mvr">보내는 곳</span>${froms.map((n) => `<button class="mvpick${n.id === from ? ' on' : ''}" data-act="mig-from" data-node="${n.id}">${icon(nodeIcon(n), 'mvs')}${esc(n.name)}</button>`).join('')}</div>`
    h += `<div class="mvmid"><span class="stepper sm"><button data-act="mig-n" data-d="${-step}" data-lim="${lim}" data-cur="${want}">−</button><b>${want}</b>`
    h += `<button data-act="mig-n" data-d="${step}" data-lim="${lim}" data-cur="${want}">+</button></span><i class="mva">⟶</i><span class="mute">집</span></div>`
    h += `<div class="mvcol"><span class="mvr">받는 곳</span>${tos.map((n) => `<button class="mvpick${n.id === to ? ' on' : ''}" data-act="mig-to" data-node="${n.id}">${icon(nodeIcon(n), 'mvs')}${esc(n.name)}</button>`).join('')}</div></div>`
    // 옮기기 — 숫자 바로 밑에 (형: "이주에서 수치수정은 있는데 옮기기 확정버튼이없는데" — 맨 아래 묻혀 안 보였다)
    h += `<button class="btn on move wide" data-act="migrate" data-from="${from}" data-to="${to}" data-n="${want}" ${want <= 0 ? 'disabled' : ''}>${want}집 옮기기 · ${esc(arriveWhen(r.season, 1, true))} 자리 잡는다</button>`
    h += `<div class="mv2">${moveSide(r, from, -want, '보내는 곳')}<div class="mvmid"><i class="mva">⟶</i></div>${moveSide(r, to, want, '받는 곳')}</div>`
    h += `<p class="mute">${tx(`한 번에 최대 ${lim}집 · 곡식 ${migrateCost(want).grain}. 억지로 옮기면 두 고을 모두 한 계절 동안 집이 늘지 않는다 — 사람들이 자리 잡는 동안이다.${on ? ' 직접 옮기면 자동 분배가 꺼진다.' : ''}`)}</p>`
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
      if (a.why !== undefined && readsMind(realm!, a.from)) h += heardHtml(realm!, a.from, `저들이 이 청을 낸 까닭은 이렇습니다 — ${whyLine(a.why, a.about !== undefined ? (realm!.factions[a.about]?.name ?? '') : '')}`)
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
      const can = on || (canGuard(r, me(), to) && left().grain >= guardCost().grain)
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
    h += `<div class="ncard"><div class="an">${icon('status-good-omen', 'nic')}<b>제사</b><span class="mute">봄·가을에 한 번</span></div>`
    h += `<div class="mute">소도와 맞닿은 고을을 차지해야 지낸다.</div>`
    // 무엇을 내고 무엇을 얻는지 단추에 그림과 함께 (형: "제사지낼때 무슨손실나는지 버튼에 아예 보이게 만들어. 이미지 함께")
    const st = left()
    const short = !rite && (st.grain < rc.grain || st.iron < rc.iron)
    const cost = `<span class="cost"><span>${icon('good-rice')}곡식 −${rc.grain}${st.grain < rc.grain && !rite ? ' <i class="short">모자라다</i>' : ''}</span>${rc.iron > 0 ? `<span>${icon('treasure-iron-ingots')}철 −${rc.iron}${st.iron < rc.iron && !rite ? ' <i class="short">모자라다</i>' : ''}</span>` : ''}</span>`
    const gain = season === 'spring' ? '그해 가을 거두는 곡식이 는다' : '모든 군대의 사기가 오른다'
    const label = season === 'spring' ? '봄 제사를 지낸다' : '가을 제사를 지낸다'
    if (season !== 'spring' && season !== 'autumn') h += `<div class="mute">지금은 제사철이 아니다. 봄과 가을에 지낸다.</div>`
    else if (!rite && !riteAllowed(r, me())) h += `<div class="mute">지금은 지낼 수 없다. 소도 곁 고을이 없거나 곡식이 모자라다.</div>${cost}`
    else h += `<div class="btns"><button class="btn ${rite ? 'on' : ''} wide ritebtn" data-act="rite" ${short ? 'disabled' : ''}><b>${rite ? `${label} · 누르면 거둔다` : label}</b>${cost}<span class="gain">${gain}</span></button></div>`
    return h + `</div>`
  }

  // ───────── 외교
  /**
   * 외교의 손 (VICTORY §2-2) — 이번 계절 보낼 사람: 군장의 사자 + 쉬는 장수. 사신·공작 하나에 한 사람.
   * 다 나가면 사신·공작 단추가 꺼진다 (handsFull)
   */
  function handsCap(r: Realm): number {
    return handsOf(r, me())
  }
  function handsUsed(): number {
    return Object.keys(envoys).length + plots.length
  }
  function handsFull(r: Realm): boolean {
    return handsUsed() >= handsCap(r)
  }
  function handsHtml(r: Realm): string {
    const cap = handsCap(r)
    const used = handsUsed()
    const idle = idleHeroes(r, me())
    // 사자 먼저 쓰이는 것으로 — 쓴 만큼 흐리게
    const faces = [icon('unit-scouts', 'hface msgr'), ...idle.map((id) => bust(r.heroes[id], 'hface'))]
    let h = `<div class="hands"><div class="hf">${faces.map((f, i) => `<span class="${i < used ? 'used' : ''}">${f}</span>`).join('')}</div>`
    h += `<div class="ht"><b>이번 계절 보낼 사람 ${Math.min(used, cap)}/${cap}</b><span>${tx('군장의 사자 하나 + 쉬는 장수 수 — 사신·공작 하나에 한 사람')}</span></div></div>`
    if (used >= cap) h += `<div class="banner bad">${tx('보낼 사람이 다 나갔다. 장수를 군대·고을에서 빼서 쉬게 하면 더 보낼 수 있다.')}</div>`
    return h
  }

  function diploSheet(r: Realm): string {
    let h = `<h3>외교</h3><div class="seg dseg"><button class="${diploMode === 'envoy' ? 'on' : ''}" data-act="dmode" data-v="envoy">사신</button><button class="${diploMode === 'plot' ? 'on' : ''}" data-act="dmode" data-v="plot">공작 ${plots.length > 0 ? plots.length : ''}</button><button class="${diploMode === 'scout' ? 'on' : ''}" data-act="dmode" data-v="scout">정찰${scout !== '' ? ' 1' : ''}</button></div>`
    h += handsHtml(r)
    if (diploMode === 'plot') return h + plotSheet(r)
    if (diploMode === 'scout') return h + scoutSheet(r) // 정찰 — 외교 판 안에 (형: "척후도 외교에 넣아야 겠는데")
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
    h += `<p class="mute">남의 속은 그 나라에 첩자를 심거나 동맹을 맺어야 귀에 들어온다. 그 밖엔 우리 신하의 짐작뿐이다.</p>`
    if (L === me()) h += `<div class="banner bad">우리가 앞서간다. 다른 나라들이 손을 잡고, 맺은 약조도 깨고 등을 돌릴 수 있다.</div>`
    else if (L !== null) h += `<div class="banner">앞서가는 나라: ${emblem(L, 'fem')}<b>${esc(r.factions[L]?.name ?? '')}</b> · 다른 나라들이 함께 막으려 한다. 손잡을 때다.</div>`
    // 지금 벌어진 전쟁 — 아는 나라끼리 (형: "누구랑 누가 전쟁나면 그걸 좀 잘 보여줬음")
    const live = sorted(Object.values(r.factions)).filter((x) => x.id !== me() && knows(r, me(), x.id) && Object.values(r.nodes).some((n) => n.owner === x.id))
    const wars: string[] = []
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      if (relationOf(r, live[i]!.id, live[j]!.id).state === 'war') wars.push(`<div class="warbar">${emblem(live[i]!.id, 'fem')}<i>⚔</i>${emblem(live[j]!.id, 'fem')}<span>${tx(`${live[i]!.name} · ${live[j]!.name}`)}</span></div>`)
    }
    if (wars.length > 0) h += `<h4>지금 싸우는 나라들</h4>${wars.join('')}`
    // 땅이 하나도 없는 나라(무너진 나라)는 사신을 받을 곳이 없다 — 맨 아래에 이름만 (형: "지도에없는나라인데 상호작용까지 아직도 가능")
    const hasLand = (f: string): boolean => Object.values(r.nodes).some((n) => n.owner === f)
    const gone = sorted(Object.values(r.factions)).filter((x) => x.id !== me() && knows(r, me(), x.id) && !hasLand(x.id))
    for (const f of sorted(Object.values(r.factions)).filter((x) => x.id !== me() && knows(r, me(), x.id) && hasLand(x.id))) {
      const rel = relationOf(r, me(), f.id)
      const left = rel.until !== null ? ` ${Math.max(0, rel.until - r.season)}계절` : ''
      const lead = r.heroes[f.ruler ?? rulerId(f.id)]
      h += `<div class="fcard"><div class="an">${lead !== undefined ? `<button class="fbtn" data-act="hero" data-id="${lead.id}">${bust(lead, 'rface')}</button>` : ''}<div class="fn"><b>${emblem(f.id, 'fem')}${esc(f.name)}</b><span class="mute">${lead !== undefined ? `군주 ${nameHtml(lead.name)}${lead.status === 'captive' ? ' · 사로잡힘' : lead.status === 'dead' ? ' · 죽음' : ''}` : ''}</span></div><span class="rel ${rel.state}">${REL_NAME[rel.state]}${left}</span></div>`
      const md = moodOf(r, me(), f.id)
      h += `<div class="moodl ${md.mood}">${moodImg(ART, md.mood)}<div><b>${esc(MOOD_WORD[md.mood])}</b>${said(advisor(r), md.say)}</div></div>`
      h += `<div class="frow"><span class="mute">${REL_NOW[rel.state]}</span>${favorFeel(favorOf(r, me(), f.id))}</div>`
      // 우리 사이에 있었던 일 — 언제 누가 무엇을 (형: "이나라가 나한테 잘못한일 잘한일 이런거를 언제 그랬는지와 함께")
      const deeds = (rel.deeds ?? []).slice().reverse()
      if (deeds.length > 0) {
        const open = deedsOpen.has(f.id)
        h += `<div class="deeds"><h5>우리 사이에 있었던 일</h5>`
        for (const d of open ? deeds : deeds.slice(0, 3)) {
          const t = deedText(r, me(), f.id, d)
          h += `<div class="dd ${t.tone}"><span>${seasonLabel(d.s)}</span>${esc(t.text)}</div>`
        }
        if (deeds.length > 3) h += `<button class="btn ghost sm" data-act="deeds" data-to="${f.id}">${open ? '접기' : `더 보기 · ${deeds.length - 3}`}</button>`
        h += `</div>`
      }
      // 그쪽 속셈 — 첩자를 심었거나 동맹일 때만 보인다 (형: "속셈은 아무에게나 드러내게 하지 말고 … 간접정보로"). 깰 속셈은 안 보인다
      const tw = readsMind(r, f.id) ? truceWhy(r, f.id, me()) : null
      const aw = tw === null && readsMind(r, f.id) ? allianceWhy(r, f.id, me()) : null
      const mw = tw ?? aw
      if (mw !== null) {
        h += heardHtml(r, f.id, `${tw !== null ? '화친할 마음이 있다고 합니다' : '손잡을 마음이 있다고 합니다'} — ${whyLine(mw.why, mw.about !== undefined ? (r.factions[mw.about]?.name ?? '') : '')}`)
      } else if (readsMind(r, f.id) && rel.state === 'war' && winningAgainst(r, f.id, me())) h += heardHtml(r, f.id, '저들은 이기고 있다고 여깁니다. 화친은 잘 안 받을 겁니다.')
      // 맺은 약속 — 두 계절 안에 칠 곳 (동맹의 "함께 치자")
      for (const p of rel.pledges ?? []) {
        const who = p.by === me() ? '우리가' : josa(f.name, '이', '가')
        h += `<div class="banner ${p.by === me() ? 'bad' : 'good'}">약속: ${esc(who)} ${esc(josa(r.nodes[p.node]?.name ?? '', '을', '를'))} 친다 · ${Math.max(0, p.until - r.season)}계절 안에</div>`
      }
      // 사신과 함께 갈 장수 (형: "장사꾼 장수는 특별히 뭘 할 수 없잖아") — 매력·매혹·장사꾼은 따라가야 먹힌다. 그 계절엔 자리를 비운다
      const taken = new Set(Object.values(envoys).map((e) => e.hero).filter((x): x is string => x !== undefined))
      const escorts = sorted(Object.values(r.heroes)).filter((x) => canEscort(r, me(), x.id) && !taken.has(x.id))
      if (escorts.length > 0 && envoys[f.id] === undefined) {
        const cur = escort[f.id] ?? ''
        // 이름 글자 대신 얼굴 (형: "함께보낼장수선택할땐 이미지가보이게 해. 텍스트로 이름보여주지말고")
        h += `<div class="frow"><span class="mute">함께 보낼 장수</span><div class="fpick"><button class="none${cur === '' ? ' on' : ''}" data-act="escort" data-to="${f.id}" data-id="" aria-label="혼자 보낸다">✕</button>`
        for (const x of escorts.slice(0, 6)) {
          const tr = (x.traits ?? []).map((t) => TRAIT[t]?.name).filter((t) => t !== undefined).slice(0, 1).join('')
          h += `<button class="${cur === x.id ? 'on' : ''}" data-act="escort" data-to="${f.id}" data-id="${x.id}" aria-label="${esc(x.name)}${tr !== '' ? ` · ${esc(tr)}` : ''}">${bust(x, 'fp')}</button>`
        }
        h += `</div></div>`
      }
      // 사이에 따라 보낼 수 있는 사신이 다르다 (형: "동맹 되고나서도 동맹버튼이 아직도 활성이면 뭘 의미하는거고")
      h += `<div class="btns">`
      for (const ask of envoyOptions(r, me(), f.id)) {
        const sel = envoys[f.id]?.ask === ask
        const sure = ask === 'gift' || ask === 'break'
        const c = envoyChanceFor(r, me(), f.id, ask, noGoods(), noGoods(), escort[f.id] || undefined)
        const needs = ASK_NEEDS[ask] !== undefined
        h += `<button class="btn ${sel || (compose.to === f.id && compose.ask === ask) ? 'on' : ''}${ask === 'break' ? ' ghost' : ''}" data-act="${needs ? 'compose' : 'envoy'}" data-to="${f.id}" data-ask="${ask}" ${(envoys[f.id] !== undefined && !sel) || (envoys[f.id] === undefined && handsFull(r)) ? 'disabled' : ''}>`
        h += `${askLabel(r, f.id, ask)}${sure ? '' : ` ${envoyFeel(c[0], c[1])}`}</button>`
      }
      h += `</div>`
      if (compose.to === f.id && envoys[f.id] === undefined) h += composeHtml(r, f.id)
      h += `</div>`
    }
    if (gone.length > 0) h += `<h4>무너진 나라</h4><p class="mute">${gone.map((f) => `${emblem(f.id, 'fem')}${esc(f.name)}`).join(' · ')}</p>`
    return h
  }

  /** 사신 단추의 이름 — 깨기는 무엇을 깨는지 (형: "약조는 무슨약조를 했엇고 뭘 깨는지 알아야 할거같은데") */
  function askLabel(r: Realm, to: string, ask: Ask): string {
    if (ask !== 'break') return ASK_NAME[ask]
    return relationOf(r, me(), to).state === 'ally' ? '동맹 깨기' : '화친 깨기'
  }

  /** 깨기 다짐 — 지금 맺은 것 · 깨면 무엇이 되는지 */
  function breakHint(r: Realm, to: string): string {
    const rel = relationOf(r, me(), to)
    const name = r.factions[to]?.name ?? ''
    const now = rel.state === 'ally'
      ? `지금 ${josa(name, '과', '와')} 동맹이다 — 서로 안 치고, 함께 치자·지원·군대 빌리기를 주고받는다.`
      : `지금 ${josa(name, '과', '와')} 화친이다${rel.until !== null ? ` (${Math.max(0, rel.until - r.season)}계절 남음)` : ''} — 서로 안 치고 장터가 선다.`
    return `${now} 깨면 중립이 되고, ${name}의 호감이 크게 깎이며, 다른 나라들도 우리를 덜 믿는다.${rel.state === 'ally' ? ' 서로 빌려준 군대는 돌아간다.' : ''}`
  }

  /** 사신의 자세한 것 — 교역·선물·지원·조공은 무엇을 얼마나, 함께 치자는 어디를, 군대 빌리기는 어느 고을로, 약조 깨기는 다짐 */
  function composeHtml(r: Realm, to: string): string {
    const ask = compose.ask
    const need = ASK_NEEDS[ask]
    const st = r.stock[me()] ?? { grain: 0, iron: 0 }
    let h = `<div class="trade"><div class="mute">${esc(ask === 'break' ? breakHint(r, to) : (ASK_HINT[ask] ?? ''))}</div>`
    let ok = true
    if (need === 'goods') {
      const sides = ask === 'trade' ? (['give', 'take'] as const) : ask === 'gift' ? (['give'] as const) : (['take'] as const)
      for (const side of sides) {
        h += `<div class="tr2"><span>${side === 'give' ? '준다' : '받는다'}</span>`
        // 다섯 물건 (땅마다 나는 것 — 곡식·철·소금·나무·말)
        for (const res of GOODS) {
          h += `<span class="stepper sm">${icon(GOOD_ICON[res])}`
          h += `<button data-act="cq" data-side="${side}" data-res="${res}" data-d="${-GOOD_STEP[res]}">−</button><b>${compose[side][res]}</b>`
          h += `<button data-act="cq" data-side="${side}" data-res="${res}" data-d="${GOOD_STEP[res]}">+</button></span>`
        }
        h += `</div>`
      }
      ok = GOODS.every((g) => compose.give[g] <= goodOf(st, g)) && GOODS.some((g) => compose.give[g] + compose.take[g] > 0)
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
    const c = envoyChanceFor(r, me(), to, ask, compose.give, compose.take, escort[to] || undefined)
    h += `<button class="btn on" data-act="envoy" data-to="${to}" data-ask="${ask}" ${ok ? '' : 'disabled'}>${ask === 'break' ? '정말 깬다' : '사신을 보낸다'}${sure ? '' : ` ${envoyFeel(c[0], c[1])}`}</button></div>`
    return h
  }

  // ───────── 공작 (형: "다양한 외교나 공작이 가능 해야하는거 아님?")
  /**
   * 우리 쪽에서 짐작을 말하는 사람 — 지략이 가장 높은 우리 장수 (군주도 든다). 화면은 판이 아는 것을 내레이션하지 않고 이 사람의 입으로 짐작한다
   * (형 2026-10-20: "전지적작가시점에서 정보전달하면안된다니까? 주변정보나 인물의 발언 같은걸로 해야해")
   */
  function advisor(r: Realm): Hero | undefined {
    return sorted(Object.values(r.heroes)).filter((h) => h.faction === me() && h.status !== 'dead' && h.status !== 'captive')
      .sort((a, b) => b.ryak - a.ryak || (a.id < b.id ? -1 : 1))[0]
  }
  /** 사람의 말 한 줄 — 얼굴 · 이름 · 따옴표 */
  function said(h: Hero | undefined, text: string, who?: string, face?: string): string {
    return `<span class="said">${face ?? bust(h, 'sface')}<span><i>${esc(who ?? (h !== undefined ? `${h.name}의 짐작` : '신하의 짐작'))}</i><q>${tx(text)}</q></span></span>`
  }
  /** 그 나라 속을 들은 말 — 첩자가 전했나, 동맹이 귀띔했나 (readsMind 일 때만) */
  function heardHtml(r: Realm, f: string, text: string): string {
    const ally = relationOf(r, me(), f).state === 'ally'
    const lord = r.heroes[r.factions[f]?.ruler ?? rulerId(f)]
    return `<div class="why">${ally ? said(lord, text, `동맹 ${r.factions[f]?.name ?? ''}의 귀띔`) : said(undefined, text, '심어 둔 첩자가 전한 말', icon('status-spy', 'sface'))}</div>`
  }

  /** 그 나라 속을 읽나 — 그 나라 땅에 우리 첩자가 있거나 동맹이다. 아니면 속셈은 안 보인다 */
  function readsMind(r: Realm, f: string): boolean {
    if (relationOf(r, me(), f).state === 'ally') return true
    return (r.spies?.[me()] ?? []).some((s) => s.until >= r.season && r.nodes[s.node]?.owner === f)
  }

  /** 직접 쏘기 — 한 계절에 한 적장은 한 번만 쏜다 (거뒀다 다시 걸어도 쏜 결과가 남는다) */
  function shootHtml(i: number, o: Extract<Order, { kind: 'plot' }>): string {
    const hand = o.hand ?? (o.hero !== undefined ? hands[o.hero] : undefined)
    // 건너뛰기 — 자객 솜씨로 굴린다. 진짜 지붕을 보고 맡겼으면 조금 덜 산다 (plotSkipSeenMul)
    if (hand?.result === 'skip') return `<div class="banner">${HAND_NAME.skip} · 자객의 솜씨에 달렸다${hand.seen === true ? ' · 지붕을 보고 물러난 뒤라 적이 조금 더 깨어 있다' : ''}</div>`
    if (hand !== undefined) return `<div class="banner ${hand.result === 'dead' || hand.result === 'wounded' ? 'good' : 'bad'}">직접 쐈다 · ${HAND_NAME[hand.result]}${hand.alarm ? ' · 들켰다' : ''} · 이번 계절엔 다시 못 쏜다</div>`
    return `<button class="btn on wide" data-act="shoot" data-i="${i}">${icon('unit-archer')} 직접 쏜다 · 밤 지붕 위로</button><p class="mute">들어가면 먼저 연습해 볼 수 있다. 진짜는 한 번만 쏜다. 안 쏘거나 건너뛰면 자객이 알아서 한다.</p>`
  }

  /** 맺은 나라를 노리는 공작 — 들키면 무엇이 깨지나 (형: "동맹한테 뭐 보내면 발각시 동맹 깨진다느니 그런거 있어야") */
  function pactWarn(r: Realm, target: string, op: PlotOp): string {
    const s = relationOf(r, me(), target).state
    if (s !== 'ally' && s !== 'truce') return ''
    const steps = op === 'assassin' ? 2 : 1
    const to = s === 'ally' ? (steps === 2 ? '중립' : '화친') : (steps === 2 ? '전쟁' : '중립')
    return ` <span class="pwarn">${REL_NAME[s]} — 보낸 게 드러나면 ${to}으로${op === 'assassin' ? '(두 칸)' : ''}</span>`
  }

  function plotSheet(r: Realm): string {
    const max = P.realm.plotsPerSeason
    let h = `<p class="mute">몰래 하는 일. 한 계절에 ${max}개까지. 보낸 게 드러나면 그 나라와 사이가 한 칸 나빠진다 — 동맹은 화친으로, 화친은 중립으로, 중립은 전쟁으로 (암살은 두 칸). 지략 높은 장수가 있으면 잘 된다.</p>`
    for (const [i, o] of plots.entries()) {
      if (o.kind !== 'plot') continue
      const where = o.node !== undefined ? r.nodes[o.node]?.name : o.other !== undefined ? `${r.factions[o.target]?.name} ↔ ${r.factions[o.other]?.name}` : r.factions[o.target]?.name
      const target = o.hero !== undefined ? r.heroes[o.hero]?.name : where
      h += `<div class="banner good">${PLOT_NAME[o.op]} · ${esc(target ?? '')}<button class="btn ghost sm" data-act="unplot" data-i="${i}">거둔다</button></div>`
      // 암살은 직접 쏠 수 있다 — 밤 판 (SNIPE §0). 안 쏘면 굴림. 암살 칸을 펼쳤으면 고른 적장 바로 밑에 띄운다
      if (o.op === 'assassin' && plotOpen !== 'assassin') h += shootHtml(i, o)
    }
    const full = plots.length >= max || handsFull(r)
    const st = left()
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
        const targets = plotTargets(realm!, me(), op).filter((t) => knows(realm!, me(), t.target)) // 아는 나라에만 (발견)
        // 들키면 누가 보냈는지 드러날 수 있다 — 드러나면 그 나라와 크게 틀어지고 다른 나라도 우리를 덜 믿는다
        if (targets[0] !== undefined) {
          const ex = exposeChance(realm!, me(), targets[0].target, targets[0].node, op === 'assassin' ? agent : undefined)
          h += `<div class="mute">들켜도 누가 보냈는지 숨길 길 ${plotFeel(1 - ex, 1 - ex)} · 드러나면 그 나라와 크게 틀어지고 다른 나라들도 우리를 덜 믿는다.</div>`
        }
        if (op === 'assassin') {
          h += `<img class="plimg" src="${ART}event/event-assassin-archer.jpg" alt="">`
          h += `<div class="mute">누구를 보내나</div><div class="fpick"><button class="${agent === null ? 'on' : ''}" data-act="pagent" data-id="" aria-label="고용 자객">${icon('unit-archer', 'fp')}</button>`
          for (const id of agents.slice(0, 5)) h += `<button class="${agent === id ? 'on' : ''}" data-act="pagent" data-id="${id}" aria-label="${esc(r.heroes[id]?.name ?? id)}">${bust(r.heroes[id], 'fp')}</button>`
          h += `</div>`
          // 누가 가느냐가 곧 무엇을 걸었느냐다 (형이 고름: "자객 기본 · 장수는 도박")
          if (agent === null) h += `<div class="mute">고용 자객 — 들켜 잡혀도 값만 잃는다. 장수는 안 잃는다.</div>`
          else h += `<div class="mute">${esc(josa(r.heroes[agent]?.name ?? '', '이', '가'))} 가면 화살이 ${assassinArrows(realm!, agent) - P.night.arrows}발 더 있다. 들키면 몸을 빼야 한다. 빠져나올 길 ${plotFeel(escapeChance(realm!, agent), escapeChance(realm!, agent))} · 못 빠지면 잡힌다.</div>`
          if (agents.length === 0) h += `<div class="mute">보낼 장수가 없다. 군대를 안 이끌고 쉬는 장수만 자객이 된다.</div>`
          // 자객의 활 — 계단으로 오른다 (형: "완만한 성장이 아니라 계단적 성장")
          const bt = assassinBow(realm!, me())
          const bu = bowUpCost(realm!, me())
          const buying = musters.some((o) => o.kind === 'bowUp')
          h += `<div class="frow"><span class="mute">자객의 활 · <b>${esc(BOW_NAME[bt] ?? '')}</b></span>`
          if (bu !== null) h += `<button class="btn sm ${buying ? 'on' : ''}" data-act="bowup" ${buying || (st.grain >= bu.grain && st.iron >= bu.iron) ? '' : 'disabled'}>${buying ? '올리는 중 · 취소' : `${esc(josa(BOW_NAME[bu.to] ?? '', '으로', '로'))} · 곡식 ${bu.grain} · 철 ${bu.iron}`}</button>`
          h += `</div><p class="mute">활이 한 단계 오를 때마다 화살이 빨라지고 세지고 덜 떨린다. 직접 쏘지 않을 때도 더 잘 된다.</p>`
        }
        if (targets.length === 0) h += `<div class="mute">지금은 노릴 데가 없다.${op === 'bribe' || op === 'spy' ? ' 아는 마을이어야 한다. 정찰부터.' : op === 'assassin' ? ' 겨뤄 본 적장만 노릴 수 있다.' : ''}</div>`
        h += `<div class="rows">`
        for (const t of targets) {
          const hero = t.hero !== undefined ? r.heroes[t.hero] : undefined
          const label = hero !== undefined ? `${hero.name} · ${r.factions[t.target]?.name}` : t.node !== undefined ? `${r.nodes[t.node]?.name} · ${r.factions[t.target]?.name}` : t.other !== undefined ? `${r.factions[t.target]?.name} ↔ ${r.factions[t.other]?.name}` : (r.factions[t.target]?.name ?? '')
          const c = plotChance(realm!, me(), op, t.target, t.node, t.hero, agent)
          const dup = plots.some((p) => p.kind === 'plot' && p.op === op && p.target === t.target && p.node === t.node && p.other === t.other && p.hero === t.hero)
          h += `<button class="row ${dup ? 'on' : ''}" data-act="plot" data-op="${op}" data-target="${t.target}" data-node="${t.node ?? ''}" data-other="${t.other ?? ''}" data-hero="${t.hero ?? ''}" data-agent="${agent ?? ''}" ${(full && !dup) || !afford ? 'disabled' : ''}>`
          h += `${hero !== undefined ? bust(hero, 'rface sm') : emblem(t.target)}<span class="dest">${esc(label)}${pactWarn(r, t.target, op)}</span><span class="win">${plotFeel(c[0], c[1])}</span></button>`
          // 고른 적장 바로 밑에 "직접 쏜다" (형: "직접쏜다버튼이 너무 위에있어서 적군눌러도 반응없는줄 알았음")
          if (dup && op === 'assassin') {
            const i = plots.findIndex((p) => p.kind === 'plot' && p.op === 'assassin' && p.hero === t.hero)
            if (i >= 0) h += shootHtml(i, plots[i] as Extract<Order, { kind: 'plot' }>)
          }
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
    const arrows = assassinArrows(realm, o.agent)
    const bow = assassinBow(realm, me())
    // 판의 배치는 판 시드·계절·대상으로 — 같은 계절 같은 대상이면 같은 밤
    let seed = (realm.seed ^ Math.imul(realm.season + 1, 2654435761)) >>> 0
    for (const ch of o.hero ?? o.target) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0
    const ov = document.createElement('div')
    ov.className = 'nightov'
    ov.innerHTML = `<iframe src="${NIGHT}?seed=${seed}&arrows=${arrows}&bow=${bow}&id=plot-${i}&back=about:blank" title="밤의 암살"></iframe><button class="btn" data-close>닫기</button>`
    root.appendChild(ov)
    const close = (): void => ov.remove()
    ov.querySelector('[data-close]')!.addEventListener('click', close)
    let loads = 0
    ov.querySelector('iframe')!.addEventListener('load', () => { if (++loads > 1) close() }) // "돌아가기"로 틀이 다른 쪽으로 가면 닫는다
  }

  window.addEventListener('message', (ev) => {
    if (ev.origin !== location.origin) return
    // 밤 판의 결과 — 연습은 결과를 안 보낸다 (night-main.ts). skip 은 건너뛰기, seen 이면 진짜 지붕을 본 뒤다
    const m = ev.data as { type?: string; id?: string; result?: Hand['result'] | 'cleared'; alarm?: boolean; seen?: boolean }
    if (m?.type !== 'hanbal.night.result' || typeof m.id !== 'string' || !m.id.startsWith('plot-') || m.result === undefined || m.result === 'cleared') return
    const i = Number(m.id.slice(5))
    const o = plots[i]
    if (o === undefined || o.kind !== 'plot' || o.op !== 'assassin') return
    const hand: Hand = m.result === 'skip' ? { result: 'skip', alarm: false, seen: m.seen === true } : { result: m.result, alarm: m.alarm === true }
    plots = plots.map((p, j) => (j === i ? { ...o, hand } : p))
    if (o.hero !== undefined) hands[o.hero] = hand
    // 건너뛰면 밤 판을 닫는다 (쏜 결과는 밤 판의 "돌아가기"로 닫는다)
    if (m.result === 'skip') root.querySelector('.nightov')?.remove()
    host.onTap('night', m.result)
    paint()
  })

  // ───────── 장수 (docs/realm/HEROES.md §5)
  function heroRow(r: Realm, h: Hero, extra = ''): string {
    const seen = h.faction === me() || heroSeen(realm!, me(), h.id)
    return `<button class="hrow${isRuler(r, h.id) ? ' ruler' : ''}" data-act="hero" data-id="${h.id}">${bust(h)}<span class="hb">`
      + `<b>${nameHtml(h.name)}${isRuler(r, h.id) ? ' <span class="mute">군주</span>' : ''}${seen ? '' : ' <span class="heard">이름만 들었다</span>'}</b><span class="mute">${esc(roleLine(r, h))}</span>`
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
        h += `<div class="btns"><button class="btn ${hired ? 'on' : ''}" data-act="hire" data-id="${w.hero.id}" ${hired || left().grain >= w.price ? '' : 'disabled'}>${hired ? '들인다 · 취소' : `들인다 · 곡식 ${w.price}`}</button></div></div>`
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
    h += `<div class="hn">${nameHtml(x.name)}</div><div class="mute">${emblem(x.faction)}${esc(r.factions[x.faction]?.name ?? '떠돌이')}${isRuler(r, x.id) ? ' 군주' : ''} · ${esc(roleLine(r, x))}</div>`
    h += heroRadar(x, seen, ours)
    h += `<div class="tr3">${traitChips(x, seen)}</div>${traitLines(x, seen)}`
    if (ours) h += growthHtml(r, x)
    // 아는 만큼 — 우리 장수 · 싸워 봤거나 정찰·첩자로 본 장수 · 이름만 들은 장수 (형: "이름 들어본 군주나 적장이랑 싸워본 적장이랑은 구분해야")
    if (!seen) h += `<p class="heardp">이름만 들었다 — 싸워 보거나 정찰하면 능력치와 특성이 보인다.</p>`
    else if (!ours && x.faction !== me()) h += `<p class="mute">싸워 봤거나 정찰로 본 장수 — 본 그대로다.</p>`
    const st = splitTitle(x.name)
    if (st.title !== null) h += `<p class="mute">${esc(st.title)} — ${esc(TITLE_MEAN[st.title] ?? '')}. 칭호이지 성이 아니다 (이 무렵엔 성 없이 이름만 썼다).</p>`
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
          h += `<button class="btn" data-act="lead" data-id="${id}" data-army="${a.id}">${esc(josa(armyName(r, a), '을', '를'))} 이끈다</button>`
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
    let h = `<p class="mute">정찰꾼은 한 계절에 한 곳만 간다. 하나를 고르면 앞서 고른 곳은 풀린다. 다녀오면 그곳의 군세·병종·경계가 보인다.</p>`
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
    const info = nationsOf(r.region ?? 'byeonhan-mini').find((x) => x.id === me())
    const mine = Object.values(r.nodes).filter((n) => n.owner === me())
    const st = r.stock[me()] ?? { grain: 0, iron: 0 }
    let h = `<div class="nhead">${nationFace(me())}<div><h3>${emblem(me())}${esc(r.factions[me()]?.name ?? '')}</h3><p class="mute">${esc(info?.blurb ?? '')}</p>${info !== undefined ? `<p class="mute src">${esc(info.source)}</p>` : ''}</div></div>`
    const need = winNeed(r.region ?? 'byeonhan-mini')
    const held = Object.values(r.factions).filter((x) => r.nodes[x.capital]?.owner === me()).length
    h += `<div class="goal">목표 · 도읍 ${need}곳을 차지한다 (우리 도읍 포함) <b>${held} / ${need}</b></div>`
    h += pathsHtml(r, held, need)
    h += `<div class="grid4"><div>${icon('settle-farm-village')}<b>${mine.length}</b><span>고을</span></div>`
    h += `<div>${icon('good-hemp')}<b>${Math.floor(mine.reduce((s, n) => s + n.hh, 0))}</b><span>집</span></div>`
    h += `<div>${icon('good-rice')}<b>${Math.floor(st.grain)}</b><span>곡식</span></div>`
    h += `<div>${icon('treasure-iron-ingots')}<b>${Math.floor(st.iron)}</b><span>철</span></div></div>`
    const caps2 = Object.values(r.heroes).filter((x) => x.status === 'captive' && x.captor === me())
    if (caps2.length > 0) {
      h += `<h4>사로잡은 장수</h4><div class="caps">`
      for (const x of caps2) h += `<div class="cap">${bust(x, 'cface')}<b>${nameHtml(x.name)}</b><span class="mute">${STAT_NAME.mu} ${x.mu} · ${STAT_NAME.ryak} ${x.ryak} · ${STAT_NAME.chi} ${x.chi} · ${STAT_NAME.deok} ${x.deok}</span></div>`
      h += `</div>`
    }
    h += `<div class="btns"><button class="btn" data-act="help">도움말</button><button class="btn" data-act="log-open">지난 기록</button><button class="btn" data-act="dex-open">도감</button><button class="btn ghost" data-act="newgame">새 판</button><button class="btn ghost" data-act="mute">${muted() ? "소리 켜기" : "소리 끄기"}</button>`
    h += `<a class="btn ghost" href="${(import.meta.env?.BASE_URL ?? '/')}">활터</a>${PRACTICE_READY ? `<a class="btn ghost" href="${PRACTICE}">궁술 연습장</a>` : ''}</div>`
    h += `<div class="btns"><button class="btn ghost" data-act="export">기록 내보내기 <span class="mute">${host.gameCount()}판</span></button></div>`
    return h
  }

  /**
   * 이기는 길 (VICTORY §1) — 정복: 도읍 막대 · 맹주(진왕): 손잡은 나라 막대 + 네 계절 시계.
   * 남이 맹주에 가까우면 그 나라도 한 줄 (우리가 아는 만큼 — 소문으로 들은 것)
   */
  function pathsHtml(r: Realm, held: number, need: number): string {
    if (r.region === 'tutorial') return ''
    const bar = (v: number, of: number, cls = ''): string => `<span class="pbar ${cls}"><i style="width:${Math.max(3, Math.min(100, (v / Math.max(1, of)) * 100))}%"></i></span>`
    const pact = pactOf(r, me())
    const streak = r.suzerain?.[me()]?.streak ?? 0
    const S = P.realm.suzerainSeasons
    const clock = Array.from({ length: S }, (_, i) => `<i class="${i < streak ? 'on' : ''}"></i>`).join('')
    let h = `<div class="paths"><h4>이기는 길</h4>`
    h += `<div class="path"><b>정복</b>${bar(held, need)}<span>도읍 ${held}/${need}</span></div>`
    h += `<div class="path"><b>맹주</b>${bar(pact.have.length, pact.need, 'pact')}<span>손잡은 나라 ${pact.have.length}/${pact.need}</span></div>`
    h += `<div class="path sub"><span class="clock">${clock}</span><span class="mute">${tx(streak > 0 ? `맹약의 해 ${streak}/${S} 계절 — 끊기지 않으면 진왕이 된다` : '아는 나라 절반 넘게와 동맹이나 조공으로 손잡고 (조공국 하나는 있어야) 네 계절을 버티면 진왕이 된다')}</span></div>`
    // 철과 뱃길 — 교역 장부: 올해 철을 바꾼 나라 깃발이 한 줄로 · 셈(나라 수 × 철) 막대
    const io = ironOf(r, me())
    h += `<div class="path"><b>철·뱃길</b>${bar(io.score, io.need, 'iron')}<span>${io.partners.length}나라 · 철 ${io.iron}</span></div>`
    h += `<div class="path sub"><span class="flags">${io.partners.length > 0 ? io.partners.map((f) => emblem(f, 'fem')).join('') : ''}</span><span class="mute">${tx(!io.gate ? '철광이나 포구를 하나는 쥐어야 뱃길이 열린다' : `올해 ${io.minPartners}나라 넘게와 철을 바꾸고, 바꾼 나라 수 × 철이 ${josa(String(io.need), '을', '를')} 넘으면 변진의 쇠가 우리 뱃길로 흐른다`)}</span></div>`
    // 큰 제사 — 사슬(봄·가을 제사를 내리) · 집 막대
    const ri = riteOf(r, me())
    const chain = Array.from({ length: ri.need }, (_, i) => `<i class="${i < ri.chain ? 'on' : ''}" title="${i % 2 === 0 ? '봄' : '가을'}"></i>`).join('')
    h += `<div class="path"><b>큰 제사</b>${bar(ri.hh, ri.hhNeed, 'rite')}<span>집 ${ri.hh.toLocaleString('ko-KR')}/${ri.hhNeed.toLocaleString('ko-KR')}</span></div>`
    h += `<div class="path sub"><span class="clock rite">${chain}</span><span class="mute">${tx(`봄·가을 제사를 한 번도 거르지 않고 ${ri.need}번 지내고, 그해 가을 집이 넉넉하면 큰 제사가 열린다 — 사슬 ${ri.chain}/${ri.need}`)}</span></div>`
    // 남의 철과 뱃길 · 큰 제사 — 소문으로 들은 것 (아는 나라만)
    for (const key of Object.keys(r.pathNear ?? {}).sort()) {
      const [kind, f] = key.split(':') as [string, string]
      if (f === me() || !knows(r, me(), f)) continue
      h += `<div class="path rival">${emblem(f, 'fem')}<span>${tx(kind === 'iron' ? `소문 — ${r.factions[f]?.name ?? ''} 포구로 철이 흐른다. 뱃길을 끊지 않으면 그 나라가 이긴다` : `소문 — ${r.factions[f]?.name ?? ''}의 제사 사슬이 길다. 소도 곁 땅을 흔들지 않으면 큰 제사가 열린다`)}</span></div>`
    }
    // 남의 맹약 — 소문 (아는 나라만)
    for (const f of Object.keys(r.suzerain ?? {}).sort()) {
      if (f === me() || !knows(r, me(), f)) continue
      const s = r.suzerain![f]!
      if (s.streak <= 0) continue
      h += `<div class="path rival">${emblem(f, 'fem')}<span>${tx(`소문 — ${r.factions[f]?.name ?? ''} 군장이 맹약의 해 ${s.streak}/${S} 계절이다. 깨지 않으면 진왕이 된다`)}</span></div>`
    }
    return h + `</div>`
  }

  function helpSheet(): string {
    return `<h3>도움말</h3><div class="help">`
      + `<p><b>한 계절 = 한 턴.</b> 명령을 고르고 다음 계절을 누른다.</p>`
      + `<p><b>봄</b> 씨를 뿌린다. 봄에 심은 집 수만큼 가을에 거둔다. <b>여름</b> 장마. 나루가 막히고 길이 느리다. `
      + `<b>가을</b> 추수. 곡식이 들어온다. <b>겨울</b> 강이 언다. 언 강으로 기습하기 좋다. 고개가 막힌다. 군량이 더 든다.</p>`
      + `<p><b>개척</b> 빈땅은 아무도 안 사는 땅이다. 그 땅을 누르거나 징병 탭 아래에서, 맞닿은 우리 고을 사람을 보낸다. 곡식이 들고, 일군 땅은 빨리 큰다. 군대로 먼저 깃발만 꽂아 둘 수도 있다.</p>`
      + `<p><b>집 · 장정 · 군사</b> 집은 농사짓고 곡식을 낸다. 집 한 채는 다섯 식구 남짓이다. 징병하면 집에서 사내를 뽑는다 — 군사 둘에 집 한 채 몫의 일손이 빠져 그만큼 덜 거둔다. 군사는 움직이고 쳐들어가지만 곡식을 먹는다. 곡식이 떨어지면 사기가 꺾인다. 장정은 뽑히지 않은 사내들로, 적이 오면 돌창·몽둥이를 들고 제 고을만 지킨다(집 둘에 하나꼴 · 수는 많아도 약하다). 해산하면 일손이 집으로 돌아간다.</p>`
      + `<p><b>지도</b> 땅 색과 깃발이 주인. 왼쪽 위 깃발을 누르면 그 나라 땅만 또렷하다. 초록 수는 우리 군사, 붉은 수는 정찰꾼이 본 적 군세, ?는 아직 못 본 곳. ✕는 이번 계절 막힌 길. 보랏빛 화살은 다가오는 적.</p>`
      + `<p><b>판세</b>는 색으로 보인다. 초록이면 이길 듯하고 붉으면 질 듯하다. 두 색이 섞이고 ?가 붙으면 아직 잘 모른다. 정찰하면 또렷해진다.</p>`
      + `<p><b>소도</b> 성스러운 땅이라 아무도 못 친다. 소도 곁 고을을 차지하면 봄·가을에 제사를 지낸다. 봄 제사는 수확을, 가을 제사는 사기를 올린다.</p>`
      + `<p><b>협공</b> 같은 계절에 두 길로 들어가면 한 판으로 싸우고 더 세다.</p>`
      + `<p><b>목표</b> 나라마다 도읍(★)이 하나씩 있다. 판이 클수록 더 많이 쥐어야 한다 — 나라 판의 목표 줄에 몇 곳인지 나온다. 우리 도읍을 빼앗기면 진다.</p></div>`
  }

  // ───────── 고을
  function nodeSheet(r: Realm, id: string): string {
    const n = r.nodes[id]!
    const known = (r.intel[me()] ?? {})[id]
    const ours = n.owner === me()
    const who = n.owner === null ? '주인 없음' : (r.factions[n.owner]?.name ?? '')
    const isCap = Object.values(r.factions).some((f) => f.capital === id)
    const kind = n.kind === 'wild' && n.hh > 0 ? SETTLED_NAME : isCap ? (n.kind === 'port' ? '도읍 · 항구' : '도읍') : NODE_KIND_NAME[n.kind]
    let h = `<div class="an big">${icon(nodeIcon(n), 'nic')}<div><h3>${esc(n.name)}${NODE_NOW[id] !== undefined ? ` <small class="mute">지금의 ${esc(NODE_NOW[id]!)}</small>` : ""}</h3><span class="mute">${emblem(n.owner)}${esc(who)} · ${kind}</span></div></div>`
    if (ours || known?.land) {
      const lines = n.tags.map((t) => TAG_LINE[t]).join(' ')
      if (lines !== '') h += `<p class="story">${esc(lines)}</p>`
      const now = n.tags.map((t) => tagNow(t, seasonOf(r.season))).filter((x) => x !== null).join(' ')
      if (now !== '') h += `<p class="mute">${esc(now)}</p>`
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
      h += `<p class="mute">${tx(`집 ${Math.floor(n.hh).toLocaleString('ko-KR')} · 사람 약 ${Math.round(n.hh * P.realm.peoplePerHH).toLocaleString('ko-KR')}`)}</p>`
      h += `<div class="grid4"><div><b>${Math.floor(n.hh)}</b><span>집</span></div><div><b>${militiaMen(r, id)}</b><span>장정</span></div><div><b>${men}</b><span>군사</span></div><div><b>${draftLimit(r, me(), id)}</b><span>더 뽑을 수</span></div></div>`
      const g = hhGrowth(r, id)
      h += `<p class="mute">다음 계절 집 <b>${g.per >= 0 ? '+' : ''}${g.per}</b>${g.why.length > 0 ? ` · ${g.why.map((w) => GROWTH_WHY[w] ?? w).join(' · ')}` : ''}</p>`
      const guarded = guards.includes(id)
      h += `<div class="btns"><button class="btn on" data-act="tab" data-tab="draft">여기서 징병</button><button class="btn" data-act="mig-here" data-node="${id}">여기로 모으기</button><button class="btn" data-act="mig-out" data-node="${id}">여기서 내보내기</button>`
      h += `<button class="btn ${guarded ? 'on' : ''}" data-act="guard" data-node="${id}" ${guarded || (canGuard(r, me(), id) && left().grain >= guardCost().grain) ? '' : 'disabled'}>경계 강화 · 곡식 ${guardCost().grain}</button></div>`
      h += `<p class="mute">경계를 올리면 기습이 잘 들킨다. 한 계절 동안.</p>`
      // 목책·해자 — 나무로 짓는다 (땅마다 나는 것). 다음 계절에 선다
      const nb = nextBuild(r, id)
      const queued = musters.some((o) => o.kind === 'build' && o.node === id) || (r.builds ?? []).some((b) => b.node === id)
      if (nb !== null) {
        const bc = buildCost(nb)
        const ok = queued || (canBuild(r, me(), id, nb) && left().wood >= bc.wood && left().grain >= bc.grain)
        h += `<div class="btns"><button class="btn ${queued ? 'on' : ''}" data-act="build" data-node="${id}" data-what="${nb}" ${ok ? '' : 'disabled'}>${queued ? `${BUILD_NAME[nb]} 짓는 중` : `${josa(BUILD_NAME[nb], '을', '를')} 두른다 · 나무 ${bc.wood} · 곡식 ${bc.grain}`}</button></div>`
        h += `<p class="mute">${nb === 'palisade' ? '목책을 두르면 지키는 쪽이 세진다.' : '해자를 파면 목책 앞에서 한 번 더 막는다. 겨울엔 얼어 못 막는다.'} 다음 계절에 서고, 한 번 지으면 계속 선다 — 고을을 빼앗기면 빼앗은 나라 것이 된다.</p>`
      }
    }
    // 이 땅에서 나는 것 — 누구 땅이든 보인다 (칠 까닭 · 바꿀 까닭)
    const yl = goodsLine(nodeYield(r, id))
    if (yl !== '') h += `<p class="mute">이 땅에서 나는 것 · ${esc(yl)} (이번 계절)</p>`
    else {
      // 아무도 안 사는 땅 — 일구면 무엇이 나는지 (지도의 흐린 특산 표와 같은 것)
      const sp = nodeSpecials(r, id)
      if (sp.length > 0) h += `<p class="mute">사람이 살면 나는 것 · ${sp.map((g) => `${icon(GOOD_ICON[g])}${GOOD_NAME[g]}`).join(' · ')}</p>`
    }
    // 바닷가 — 고기잡이는 겨울에 쉰다 (지도의 고기 표가 겨울엔 얼어 흐려진다)
    if (n.kind !== 'sodo' && isCoast(r, id)) h += `<p class="mute">${icon('good-dried-fish')}${seasonOf(r.season) === 'winter' ? '겨울 — 바다가 거칠어 고기잡이를 쉰다. 봄에 다시 곡식이 난다.' : '바닷가 — 고기잡이로 곡식이 조금 난다. 겨울엔 쉰다.'}</p>`
    if (!ours && n.kind !== 'sodo' && !(n.kind === 'wild' && n.owner === null && known?.force == null)) {
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
      // 정찰로 본 병종 — 몇 할씩 (형: "정찰하면 '궁수가 많다' 같은 구성이 보이게")
      const sm = seenMix(r, me(), id)
      if (sm !== null) {
        const parts = (Object.entries(sm.mix) as Array<[UnitKind, number]>).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1])
        h += `<p class="mute">병종 · ${parts.map(([k, v]) => `${UNIT_NAME[k]} ${Math.round(v * 10)}할`).join(' · ')}${sm.age > 0 ? ` (${sm.age}계절 전)` : ''}</p>`
      }
      // 척후는 한 계절에 한 곳뿐 — 여러 곳을 누르면 다 가는 줄 알지 않게 (형: "매판 눌러줘야하고 누르면 전부다 정찰 가겠지? 할거라고")
      if (scoutable(r).includes(id)) {
        const there = scout !== '' && scout !== id ? (r.nodes[scout]?.name ?? '') : ''
        h += `<div class="scoutbox"><div class="mute">정찰꾼은 한 계절에 <b>한 곳</b>만 간다. 보내면 이번 계절 이곳의 군세·병종·경계가 보인다.</div>`
        h += `<button class="btn ${scout === id ? 'on' : ''}" data-act="scout" data-node="${id}">${scout === id ? '정찰꾼이 여기로 간다 · 누르면 거둔다' : there !== '' ? `정찰꾼을 ${esc(there)}에서 여기로 돌린다` : '여기로 정찰을 보낸다'}</button></div>`
      }
    }
    // 이 나라와 지금 할 수 있는 것 — 외교 판까지 안 가고 여기서 바로 (형: "타국 마을 누르면 … 얘내랑 할수있는 상호작용만 추려서 보여주고 바로 할수 있게")
    if (!ours && n.owner !== null && n.kind !== 'sodo' && knows(r, me(), n.owner) && r.factions[n.owner] !== undefined) h += nationActs(r, n.owner, id)
    // 여기로 갈 수 있는 우리 군대
    const goers = sorted(Object.values(r.armies)).filter((a) => a.faction === me() && a.march === null && movesOf(r, me(), a).some((m) => m.to === id))
    if (goers.length > 0) {
      h += `<h4>보낼 군대</h4>`
      for (const a of goers) h += `<div class="goer"><span class="gname">${esc(armyName(r, a))} <span class="mute">${headcount(forceOf(r, a))}명</span></span>${moveRows(r, a, id)}</div>`
    }
    return h
  }

  /**
   * 남의 고을을 눌렀을 때 — 그 나라와 이번 계절 할 수 있는 것만 추려서 바로 누르게:
   * 사신(사이에 따라 열리는 것만) · 이 고을에 첩자·매수 · 그 나라에 소문·불 · 이 고을에 있는 적장 암살.
   * 자세히 꾸며야 하는 사신(교역·조공·함께 치자 …)은 외교 판의 그 칸을 열어 준다.
   */
  function nationActs(r: Realm, f: string, node: string): string {
    const fac = r.factions[f]!
    const rel = relationOf(r, me(), f)
    let h = `<div class="nacts"><div class="nah">${emblem(f, 'fem')}<b>${esc(fac.name)}</b><span class="rel ${rel.state}">${REL_NAME[rel.state]}</span>${favorFeel(favorOf(r, me(), f))}</div>`
    // 그 군장의 얼굴 — 우리를 어떻게 보나 (mood.ts)
    const md = moodOf(r, me(), f)
    h += `<div class="moodl ${md.mood}">${moodImg(ART, md.mood)}<div><b>${esc(MOOD_WORD[md.mood])}</b>${said(advisor(r), md.say)}</div></div>`
    // 사신
    const sent = envoys[f]
    if (sent !== undefined) h += `<div class="banner good">사신: ${ASK_NAME[sent.ask]}<button class="btn ghost sm" data-act="unenvoy" data-to="${f}">거둔다</button></div>`
    else {
      h += `<div class="nal">사신</div><div class="btns">`
      for (const ask of envoyOptions(r, me(), f)) {
        const sure = ask === 'gift' || ask === 'break'
        const c = envoyChanceFor(r, me(), f, ask, noGoods(), noGoods(), escort[f] || undefined)
        const needs = ASK_NEEDS[ask] !== undefined
        h += `<button class="btn sm${ask === 'break' ? ' ghost' : ''}" data-act="${needs ? 'compose-go' : 'envoy'}" data-to="${f}" data-ask="${ask}" ${handsFull(r) ? 'disabled' : ''}>${askLabel(r, f, ask)}${sure ? '' : ` ${envoyFeel(c[0], c[1])}`}</button>`
      }
      h += `</div>`
    }
    // 공작 — 이 고을·이 나라를 노리는 것만
    const max = P.realm.plotsPerSeason
    const st = left()
    const rows: string[] = []
    for (const op of PLOT_OPS) {
      if (op === 'sow') continue // 두 나라를 갈라놓는 것은 외교 판에서
      const ts = plotTargets(realm!, me(), op).filter((t) => t.target === f && (t.node === undefined || t.node === node))
      for (const t of ts) {
        const cost = plotCost(op, null)
        const dup = plots.some((p) => p.kind === 'plot' && p.op === op && p.target === t.target && p.node === t.node && p.hero === t.hero)
        const hero = t.hero !== undefined ? r.heroes[t.hero] : undefined
        const c = plotChance(realm!, me(), op, t.target, t.node, t.hero, null)
        const can = dup || (plots.length < max && !handsFull(r) && st.grain >= cost.grain && st.iron >= cost.iron)
        rows.push(`<button class="row ${dup ? 'on' : ''}" data-act="plot" data-op="${op}" data-target="${t.target}" data-node="${t.node ?? ''}" data-other="" data-hero="${t.hero ?? ''}" data-agent="" ${can ? '' : 'disabled'}>`
          + `${hero !== undefined ? bust(hero, 'rface sm') : icon(PLOT_ICON[op], 'nic')}<span class="dest">${PLOT_NAME[op]}${hero !== undefined ? ` · ${esc(hero.name)}` : ''}${pactWarn(r, t.target, op)}</span>`
          + `<span class="sub">${tx(`곡식 ${cost.grain}${cost.iron > 0 ? ` · 철 ${cost.iron}` : ''}`)}</span><span class="win">${plotFeel(c[0], c[1])}</span></button>`)
      }
    }
    if (rows.length > 0) h += `<div class="nal">공작 <span class="mute">한 계절에 ${max}가지 · 지금 ${plots.length}</span></div><div class="rows">${rows.join('')}</div>`
    // 외교 판의 사신 칸 · 공작 칸 — 둘 다 바로 (형: "외교에서 자세히 누르면 공작으로는 안넘어가네")
    h += `<div class="btns"><button class="btn ghost" data-act="nat-diplo" data-to="${f}">사신 자세히</button><button class="btn ghost" data-act="nat-plot" data-to="${f}">공작 자세히</button></div></div>`
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
      if (dead !== undefined && dead.faction !== after.player) cands.push([3, { ev: 'event-sniped-commander', hero: dead, line: `${josa(dead.name, '이', '가')} 쓰러졌다` }])
      // 겨울 기습은 눈 속 매복 그림으로
      const raid = seasonOf(b.season) === 'winter' ? 'event-winter-ambush' : 'event-night-raid'
      if (weAtk && l.ambush === 'success') cands.push([2, { ev: raid, hero: null, line: `${node}에 몰래 들이쳤다` }])
      if (weAtk && l.ambush === 'caught') cands.push([2, { ev: raid, hero: null, line: `${node} 기습이 들켰다` }])
      if (!weAtk && l.ambush === 'success') cands.push([2, { ev: raid, hero: null, line: `${node}에 기습을 당했다` }])
      const lost = cap !== undefined && cap.faction === after.player ? cap : dead !== undefined && dead.faction === after.player ? dead : undefined
      if (lost !== undefined) cands.push([1, { ev: 'event-sniped-commander', hero: lost, line: `${josa(lost.name, '을', '를')} 잃었다` }])
      for (const [k, p] of cands) if (k > rank) { rank = k; best = p }
    }
    // 싸움이 없어도 그 계절의 큰일 하나를 그림으로 (형: "보드게임 특성상 UX 부족한 부분들을 … 애니메이션 · 그림으로 채웠잖아")
    const pl = after.player
    const fn = (f: string): string => after.factions[f]?.name ?? ''
    for (const l of rep.lines) {
      let c: [number, { ev: string; hero: Hero | null; line: string }] | null = null
      if (l.kind === 'relation' && (l.a === pl || l.b === pl)) {
        const other = l.a === pl ? l.b : l.a
        if (l.state === 'ally') c = [0.9, { ev: 'event-alliance-oath', hero: after.heroes[after.factions[other]?.ruler ?? ''] ?? null, line: `${josa(fn(other), '과', '와')} 동맹을 맺었다` }]
        else if (l.state === 'truce') c = [0.8, { ev: 'event-outside-envoy', hero: after.heroes[after.factions[other]?.ruler ?? ''] ?? null, line: `${josa(fn(other), '과', '와')} 화친했다` }]
        else if (l.state === 'war') c = [0.7, { ev: 'event-people-quarrel', hero: null, line: `${josa(fn(other), '과', '와')} 전쟁이다` }]
      } else if (l.kind === 'recruit' && l.faction === pl && after.heroes[l.hero] !== undefined) {
        const ev = l.how === 'persuade' ? 'event-captive-persuade' : 'event-wanderer-arrives'
        c = [0.85, { ev, hero: after.heroes[l.hero]!, line: `${josa(after.heroes[l.hero]!.name, '이', '가')} 우리 장수가 됐다` }]
      } else if (l.kind === 'wanderer' && after.nodes[l.node]?.owner === pl) {
        const w = (after.wanderers ?? []).find((x) => x.hero.id === l.hero)
        if (w !== undefined) c = [0.5, { ev: 'event-wanderer-arrives', hero: w.hero, line: `떠돌이 ${josa(w.hero.name, '이', '가')} ${after.nodes[l.node]?.name ?? ''}에 왔다` }]
      } else if (l.kind === 'rite' && l.faction === pl) {
        c = [0.6, { ev: l.season === 'spring' ? 'event-divination' : 'event-festival', hero: null, line: l.season === 'spring' ? '봄 제사를 지냈다' : '가을 제사를 지냈다' }]
      } else if (l.kind === 'hunger' && l.faction === pl) {
        c = [0.75, { ev: 'event-sky-drought', hero: null, line: '곡식이 바닥났다' }]
      } else if (l.kind === 'settle' && l.faction === pl) {
        c = [0.5, { ev: 'event-expedition-return', hero: null, line: `${josa(after.nodes[l.to]?.name ?? '', "을", "를")} 일구러 떠났다` }]
      } else if (l.kind === 'blocked' && l.why === 'summerFord' && b.armies[l.army]?.faction === pl) {
        c = [0.5, { ev: 'event-monsoon-ford', hero: null, line: '장마에 나루가 막혔다' }]
      } else if (l.kind === 'build' && l.faction === pl && l.done) {
        c = [0.55, { ev: 'event-palisade-build', hero: null, line: `${after.nodes[l.node]?.name ?? ''}에 ${josa(BUILD_NAME[l.what], "이", "가")} 섰다` }]
      } else if (l.kind === 'rumor' && l.viewer === pl) {
        c = [0.45, { ev: 'event-spy-rumor', hero: null, line: `${fn(l.about)}에서 첩보가 왔다` }]
      } else if (l.kind === 'bowUp' && l.faction === pl) {
        c = [0.65, { ev: 'event-bow-forge', hero: null, line: `자객의 활이 ${josa(BOW_NAME[l.tier] ?? '', '이', '가')} 됐다` }]
      } else if (l.kind === 'pledge' && l.from === pl && l.kept) {
        c = [0.8, { ev: 'event-eight-harbours', hero: null, line: `${josa(fn(l.to), '과', '와')} 함께 쳤다` }]
      } else if (l.kind === 'envoy' && l.from === pl && l.accepted && l.ask === 'trade') {
        c = [0.4, { ev: 'event-iron-trade', hero: null, line: `${josa(fn(l.to), '과', '와')} 물건을 바꿨다` }]
      }
      if (c !== null && c[0] > rank) { rank = c[0]; best = c[1] }
    }
    if (best === null) return ''
    return `<div class="scene"><img class="ev" src="${ART}event/${best.ev}.jpg" alt="">${best.hero !== null ? bust(best.hero, 'who') : ''}<div class="brag">${esc(best.line)}</div></div>`
  }

  function modalHtml(r: Realm): string {
    // 이겼어도 계속 두는 판이면 보고가 이어진다 — 도읍을 모두 쥔 계절에 한 번 더 끝 화면
    const endNow = r.outcome && (!r.endless || (r.unified !== undefined && r.unified === r.season - 1))
    if (endNow) {
      if (looking) return ''
      syncRetain(r) // 계승 가신 — 처음이면 솜씨 좋은 셋을 골라 둔다
      return endingHtml(KIT, r, host.history(), retainHtml(DEX_KIT, r))
    }
    if (!showReport || before === null || report === null) return ''
    const season = seasonOf(r.season)
    // 우리가 낀 싸움은 카드로 한 판씩 풀어 보이고, 글 줄에서는 뺀다
    const cards = report.lines.map((l, i) => (l.kind === 'battle' ? battleCard(before!, r, l, me(), ART, i) : ''))
    // 넓어지는 지도 — 모르는 나라 이야기는 들리지 않는다 (줄에 적힌 나라 id 를 훑는다)
    const heard = (l: ReportLine): boolean => r.known === undefined
      || Object.values(l).every((v) => typeof v !== 'string' || r.factions[v] === undefined || knows(r, me(), v))
    // 전쟁 — 우리에게 걸어온 것은 카드로, 남의 나라끼리는 깃발 둘로 (형: "누구랑 누가 전쟁나면 그걸 좀 잘 보여줬음 · 상대가 걸어왔다는걸 알려줘야지")
    type Rel = Extract<ReportLine, { kind: 'relation' }>
    const isWar = (l: ReportLine): l is Rel => l.kind === 'relation' && l.state === 'war'
    const onUs = report.lines.filter((l): l is Rel => isWar(l) && (l.a === me() || l.b === me()) && l.by !== undefined && l.by !== me() && heard(l))
    const between = report.lines.filter((l): l is Rel => isWar(l) && l.a !== me() && l.b !== me() && heard(l))
    const lines = report.lines
      .filter((l, i) => cards[i] === '' && heard(l) && !onUs.includes(l as Rel) && !between.includes(l as Rel))
      .map((l) => ({ l, x: reportText(before!, r, l, me()) }))
      .filter((y): y is { l: ReportLine; x: string } => y.x !== null)
    // 차례 — 나라가 무너졌으면 그것부터, 그다음 싸움 카드, 그다음 소식이 한 줄씩 올라와 쌓인다
    // (형: "한번에 왕창 텍스트 똭 놓지말고 하나씩 올라와서 쌓이게 · 너무빠르게말고 · 한번탭하면 바로 다나오게")
    let t = 0
    let h = `<div class="mcard" data-act="rep-fast"><div class="mt">${icon(SEASON_ICON[season], 'sic')}<b>${esc(seasonLabel(r.season))}</b><span>${esc(SEASON_LINE[season])}</span></div>`
    for (const l of onUs) {
      h += warCard(r, l, t)
      t += FALL_S
    }
    for (const f of fallen(before, r)) {
      h += fallCard(r, f, t)
      t += FALL_S
    }
    for (const l of between) {
      const txt = reportText(before, r, l, me())
      if (txt === null) continue
      const [x, y] = l.by === l.b ? [l.b, l.a] : [l.a, l.b]
      h += `<div class="warbar rv" style="--t:${t}s">${emblem(x, 'fem')}<i>⚔</i>${emblem(y, 'fem')}<span>${tx(txt)}</span></div>`
      t += LINE_S
    }
    if (cards.some((c) => c !== '')) {
      for (const c of cards) {
        if (c === '') continue
        h += `<div class="rv" style="--t:${t}s">${c}</div>`
        t += battleCardSeconds(c)
      }
    } else {
      const sc = sceneOf(before, r, report)
      if (sc !== '') {
        h += `<div class="rv" style="--t:${t}s">${sc}</div>`
        t += LINE_S
      }
    }
    h += `<div class="lines">${lines.length === 0 ? `<p class="mute rv" style="--t:${t}s">조용한 계절이었다.</p>` : lines.map((y, i) => reportRow(r, y.l, y.x, t + i * LINE_S)).join('')}</div>`
    // 아직 길 위의 우리 군대 — 언제 닿나 (형: "그 턴이 다음턴인지 그다음인지 몰라가지고 헷갈림. 왜안오는거야")
    const going = sorted(Object.values(r.armies)).filter((a) => a.faction === me() && a.march !== null)
    if (going.length > 0) {
      h += `<div class="lines">${going.map((a, i) => `<div class="rrow rv" style="--t:${(t + (lines.length + i) * LINE_S).toFixed(2)}s">${icon('unit-spear', 'ri')}<span class="rflow"><span class="nchip">${esc(r.nodes[a.march!.from]?.name ?? '')}</span><i class="ar">➜</i><span class="nchip">${esc(r.nodes[a.march!.to]?.name ?? '')}</span></span>`
        + `<span class="rtx">${tx(`${josa(armyName(r, a), '이', '가')} 가는 중 — ${arriveWhen(r.season, a.march!.left)}`)}</span></div>`).join('')}</div>`
    }
    const tail = asksHtml() + threatsHtml(r)
    if (tail !== '') h += `<div class="rv" style="--t:${(t + Math.max(1, lines.length) * LINE_S).toFixed(2)}s">${tail}</div>`
    return h + `<button class="btn on wide" data-act="rep-close">확인</button></div>`
  }

  /**
   * 우리에게 전쟁을 걸어왔다 — 그 군장의 얼굴 · 성난 탈 · 무엇 때문에 · 속셈 짐작 · 바로 할 수 있는 것.
   */
  function warCard(r: Realm, l: Extract<ReportLine, { kind: 'relation' }>, t: number): string {
    const f = l.by!
    const name = r.factions[f]?.name ?? ''
    const lord = r.heroes[r.factions[f]?.ruler ?? rulerId(f)]
    const why = reportText(before!, r, l, me()) ?? ''
    // 속셈 짐작 — 화면에 보이는 것으로만
    const lands = (x: string): number => Object.values(r.nodes).filter((n) => n.owner === x).length
    const guess = leaderOf(r, f) === me() ? '우리가 앞서간다고 보고 막으려는 듯합니다.' : tookRecently(r, me(), f) ? '빼앗긴 땅을 되찾으려는 겁니다.'
      : lands(f) > lands(me()) ? '우리를 만만하게 보는 모양입니다.' : '우리 땅이 탐나는 모양입니다.'
    let h = `<div class="warc rv" style="--t:${t}s">${bust(lord, 'flord')}${moodImg(ART, 'angry', 'mood wm')}<div class="wb"><b>${emblem(f, 'fem')}<span>${esc(josa(name, '이', '가'))} 전쟁을 걸어왔다</span></b>`
    h += `<span>${tx(why.replace(/^.*?— /, ''))}</span>${said(advisor(r), guess)}`
    h += `<div class="btns"><button class="btn sm${envoys[f]?.ask === 'truce' ? ' on' : ''}" data-act="envoy" data-to="${f}" data-ask="truce">${envoys[f]?.ask === 'truce' ? '화친 사신을 보낸다 · 거두기' : '화친을 청한다'}</button><button class="btn ghost sm" data-act="nat-diplo" data-to="${f}">외교 판</button></div></div></div>`
    return h
  }

  /** 지난 기록 판 (형: "최근로그 확인할수 있어야함. 어디서 조공요구했는지 · 어디서 전쟁선포했는지") — logbook.ts */
  function logSheet(): string {
    const r = realm!
    const hist = host.history()
    const heard = (l: ReportLine): boolean => r.known === undefined
      || Object.values(l).every((v) => typeof v !== 'string' || r.factions[v] === undefined || knows(r, me(), v))
    const rows = logRows(r, hist, me(), logFilter, logNation, heard)
    const nations = logNations(r, hist, me()).filter((f) => knows(r, me(), f))
    return logbookHtml({ esc, emblem: (f, cls) => emblem(f, cls), row: (l, text) => reportRow(r, l, text, 0) }, r, rows, nations, logFilter, logNation)
  }

  /**
   * 보고 한 줄을 그림으로 (형: "눈에 안들어옴. 국가아이콘이라던가 자원아이콘이라던가 화살표 방향 적극이용 · 항상 최선의 전달은 이미지나 애니메이션") —
   * 왼쪽에 무슨 일인지 그림 하나, 가운데에 누가→누구 / 어디→어디 (깃발·고을 그림과 화살표), 그 옆에 글 (낱말 색).
   */
  function reportRow(r: Realm, l: ReportLine, text: string, t: number): string {
    const L = l as unknown as Record<string, unknown>
    const isF = (v: unknown): v is string => typeof v === 'string' && r.factions[v] !== undefined
    const isN = (v: unknown): v is string => typeof v === 'string' && r.nodes[v] !== undefined
    const nchip = (id: string): string => `<span class="nchip">${icon(nodeIcon(r.nodes[id]!), 'nci')}${esc(r.nodes[id]!.name)}</span>`
    const fchip = (f: string): string => emblem(f, 'rem')
    let ic = ''
    switch (l.kind) {
      case 'take': ic = 'settle-besieged'; break
      case 'arrive': ic = 'unit-spear'; break
      case 'sighted': ic = 'status-spy'; break
      case 'battle': ic = 'unit-shield-wall'; break
      case 'harvest': case 'spoil': ic = 'good-rice'; break
      case 'market': ic = 'settle-market'; break
      case 'draft': ic = UNIT_ICON[l.unit]; break
      case 'disband': case 'settle': case 'migrate': ic = 'settle-farm-village'; break
      case 'hunger': ic = 'status-famine'; break
      case 'envoy': case 'answered': case 'ask': ic = 'good-tribute-bell'; break
      case 'recall': ic = l.owner !== undefined ? 'unit-spear' : 'good-tribute-bell'; break
      // 전쟁 줄의 그림은 까닭대로 — 배신만 등 뒤의 칼, 이간·공작은 그 공작 그림, 나머지는 환두대도 (형: "이간도 안했는데 이간 칼 이미지가 뜸")
      case 'relation': ic = l.state === 'war'
        ? (l.why === 'betray' || l.why === 'distrust' ? 'status-betrayal' : l.why === 'sow' ? PLOT_ICON.sow : l.why === 'plot' ? 'status-spy' : 'treasure-ring-sword')
        : l.state === 'ally' ? 'status-alliance' : 'good-tribute-bell'; break
      case 'plot': ic = PLOT_ICON[l.op]; break
      case 'mystery': case 'rumor': case 'confess': ic = 'status-spy'; break
      case 'build': ic = 'settle-palisade'; break
      case 'rite': ic = 'status-good-omen'; break
      case 'blocked': ic = 'settle-pass'; break
      case 'discover': ic = 'settle-beacon'; break
      case 'arm': ic = 'treasure-iron-ingots'; break
      case 'bowUp': ic = 'unit-archer'; break
      case 'suzerain': ic = 'treasure-silla-crown'; break
      case 'grow': case 'bond': case 'awaken': ic = 'status-morale-up'; break
      default: ic = ''
    }
    // 장수 얼굴이 주인공인 줄 — 들임·떠돌이·자람
    const hero = typeof L['hero'] === 'string' ? (r.heroes[L['hero'] as string] ?? (realm!.wanderers ?? []).find((w) => w.hero.id === L['hero'])?.hero) : undefined
    const lead = (l.kind === 'recruit' || l.kind === 'wanderer' || l.kind === 'grow' || l.kind === 'bond' || l.kind === 'awaken') && hero !== undefined
      ? bust(hero, 'rface rl') : ic !== '' ? icon(ic, 'ri') : '<i class="ri dot"></i>'
    // 누가→누구 · 어디→어디
    let flow = ''
    const from = L['from']
    const to = L['to']
    if (l.kind === 'sighted' && isF(L['faction']) && isN(to)) flow = `${fchip(L['faction'] as string)}<i class="ar foe">➜</i>${nchip(to as string)}`
    else if (isN(from) && isN(to)) flow = `${nchip(from)}<i class="ar">➜</i>${nchip(to)}`
    else if (isF(from) && isF(to)) flow = `${fchip(from)}<i class="ar">➜</i>${fchip(to)}`
    else if (isF(L['a']) && isF(L['b'])) {
      const by = L['by']
      const [x, y] = by === L['b'] ? [L['b'] as string, L['a'] as string] : [L['a'] as string, L['b'] as string]
      flow = `${fchip(x)}<i class="ar">${l.kind === 'relation' && l.state === 'war' ? '⚔' : l.kind === 'market' || (l.kind === 'relation' && l.state !== 'war') ? '⇄' : '➜'}</i>${fchip(y)}`
    } else if (l.kind === 'battle' && isF(l.atkFaction) && isF(l.defender)) flow = `${fchip(l.atkFaction)}<i class="ar">⚔</i>${fchip(l.defender)}`
    else if (l.kind === 'take' && isF(l.faction)) flow = `${fchip(l.faction)}<i class="ar">➜</i>${nchip(l.node)}`
    else if (isF(L['faction']) && L['faction'] !== me()) flow = fchip(L['faction'] as string)
    else if (isN(L['node'])) flow = nchip(L['node'] as string)
    // 수가 핵심인 줄은 크게
    const big = l.kind === 'harvest' ? `<b class="rn good">+${Math.round(l.grain)}</b>` : l.kind === 'spoil' ? `<b class="rn good">+${Math.round(l.grain)}</b>` : l.kind === 'draft' ? `<b class="rn">+${l.n}</b>` : ''
    const mute = text.startsWith('소문') ? ' mute' : ''
    return `<div class="rrow rv${mute}" style="--t:${t.toFixed(2)}s">${lead}${flow !== '' ? `<span class="rflow">${flow}</span>` : ''}${big}<span class="rtx">${tx(text)}</span></div>`
  }

  /** 이번 계절에 무너진 나라 — 지난 판엔 땅이 있었는데 이제 없다. 우리가 아는 나라만 */
  function fallen(b: Realm, after: Realm): string[] {
    const has = (x: Realm, f: string): boolean => Object.values(x.nodes).some((n) => n.owner === f)
    return Object.keys(b.factions).sort().filter((f) => f !== after.player && has(b, f) && !has(after, f) && knows(after, me(), f))
  }

  /** 나라가 무너졌다 — 깃발 · 군주 · 누가 도읍을 쥐었나 (형: "나라가 멸망하면 멸망한거 띄워줘야 할듯") */
  function fallCard(r: Realm, f: string, t: number): string {
    const name = r.factions[f]?.name ?? ''
    const cap = r.factions[f]?.capital
    const by = cap !== undefined ? r.nodes[cap]?.owner ?? null : null
    const lord = r.heroes[r.factions[f]?.ruler ?? rulerId(f)]
    const byLine = by === me() ? '우리가 마지막 땅을 쥐었다' : by !== null ? `${josa(r.factions[by]?.name ?? '', '이', '가')} 도읍을 쥐었다` : '땅이 모두 흩어졌다'
    const fate = lord === undefined ? '' : lord.status === 'captive' ? ` · 군주 ${josa(lord.name, '은', '는')} 사로잡혔다` : lord.status === 'dead' ? ` · 군주 ${josa(lord.name, '은', '는')} 죽었다` : ` · 군주 ${josa(lord.name, '은', '는')} 몸을 피했다`
    return `<div class="fall rv" style="--t:${t}s">${bust(lord, 'flord')}<div><b>${emblem(f, 'fem')}<span>${esc(josa(name, '이', '가'))} 무너졌다</span></b><span>${tx(byLine + fate)}</span></div></div>`
  }

  // ───────── 판 바깥 — 첫 화면 · 판 고르기 · 나라 고르기 (front.ts)
  function frontHtml(f: Front): string {
    const links = `<p class="fine"><a class="btn ghost" href="${(import.meta.env?.BASE_URL ?? '/')}">활터</a> ${PRACTICE_READY ? `<a class="btn ghost" href="${PRACTICE}">궁술 연습장</a>` : ''}</p>`
    switch (f.kind) {
      case 'title': {
        // 도감 — 판을 넘어 남는 것 (VISION §5-4). 만난 장수 수를 단추에
        const c = dexCounts(loadDex())
        const dexBtn = `<button class="btn big" data-act="dex-open">도감 <small class="mute">${c.met}/${c.total}</small></button>`
        return titleHtml(KIT, realm, host.savedAt(), links, realm === null && !tutorialOver(), dexBtn)
      }
      case 'dex': return dexHtml(DEX_KIT, f.board, f.sel, f.back === null ? '판으로' : '처음으로')
      case 'boards': return boardHtml(KIT, realm !== null && !realm.outcome, unlockedBoards(realm?.region ?? null))
      case 'nations': return nationsHtml(KIT, f.region)
      case 'detail': return detailHtml(KIT, f.region, f.id, f.region === 'tutorial' ? '' : carryHtml(DEX_KIT))
    }
  }

  // ───────── 그리기
  /**
   * 이번 계절에 정해 둔 명령을 남긴다 (형: "궁술연습장이나 활터 가버리면 그턴에서 내가 해놨던거 다 날아가버리는데") —
   * 다른 화면에 다녀오거나 새로고침해도 같은 판·같은 계절이면 그대로 되살린다. 저장이 안 되는 곳이면 그냥 없이 간다.
   */
  function saveDraft(): void {
    if (realm === null) return
    const d = { seed: realm.seed, season: realm.season, player: realm.player, armyOrders, musters, settles, pick, scout, rite, answers, guards, envoys, plots, heroOrders, persuadeBy, hands }
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
    Object.assign(pick, rec<{ edge: string; ambush: boolean; ration?: Ration }>('pick'))
    for (const p of Object.values(pick)) if (p !== undefined && typeof p.ration === 'string') p.ration = rationExtra(p.ration) ?? P.realm.rationReserve
    Object.assign(answers, rec<boolean>('answers'))
    Object.assign(envoys, rec<Envoy>('envoys'))
    Object.assign(persuadeBy, rec<string>('persuadeBy'))
    Object.assign(hands, rec<Hand>('hands'))
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

  /**
   * 계절이 넘어간다 (형: "턴 넘어갈때 넘어간다는것좀 보여졌음 좋겠네 … 하스스톤은 매번 뭔지 나오고") —
   * 화면 가운데 새 계절 이름이 크게 떴다 사라지고 종이 한 번 울린다. 애니메이션이 끝나면 지운다(타이머 없음).
   */
  function seasonFx(season: number): void {
    const s = seasonOf(season)
    const el = document.createElement('div')
    el.className = `seasonfx ${s}`
    el.innerHTML = `<i class="band" style="background-image:url('${ART}season/season-${s}.jpg')"></i><div>${icon(SEASON_ICON[s], 'sfx-ic')}<b>${esc(seasonLabel(season))}</b><span>${esc(SEASON_LINE[s])}</span></div>`
    el.addEventListener('animationend', () => el.remove(), { once: true })
    root.appendChild(el)
    ding('impactBell_heavy_000', 0.45)
  }

  /** 막혔다 — 화면 위에 까닭과 기록 내보내기 단추를 띄우고, 판 기록에도 남긴다 (형이 보내 주면 그 판을 그대로 다시 돌려 본다) */
  function failNote(e: unknown): void {
    const msg = e instanceof Error ? `${e.message} @ ${(e.stack ?? '').split('\n').slice(1, 3).join(' ').trim()}` : String(e)
    host.onTap('error', msg.slice(0, 300))
    let box = root.querySelector<HTMLElement>('.failbox')
    if (box === null) {
      box = document.createElement('div')
      box.className = 'failbox'
      root.appendChild(box)
    }
    box.innerHTML = `<b>여기서 막혔다.</b><span>${esc(msg.slice(0, 160))}</span>`
      + `<div class="btns"><button class="btn on" data-act="export">기록 내보내기</button><button class="btn ghost" data-act="failclose">닫기</button></div>`
  }

  function paint(): void {
    try {
      paintNow()
    } catch (e) {
      failNote(e)
    }
  }

  /** 마지막으로 깐 지도 글 — 같으면 다시 깔지 않는다 */
  let lastMap = ''

  function paintNow(): void {
    MINE = realm?.player ?? ''
    saveDraft()
    if (realm === null && front === null) front = { kind: 'title' }
    $('.plbox').innerHTML = realm !== null && front === null && prologue !== null ? prologueHtml(KIT, realm, prologue) : ''
    if (realm === null || front !== null) {
      root.classList.add('choosing')
      lastMap = ''
      // 도감은 장수를 누를 때마다 다시 그린다 — 내려 본 자리를 지킨다
      const keepFront = front?.kind === 'dex' ? (root.querySelector('.front.dexp')?.scrollTop ?? 0) : 0
      $('.mapwrap').innerHTML = frontHtml(front!)
      if (keepFront > 0) { const fe = root.querySelector('.front.dexp'); if (fe !== null) fe.scrollTop = keepFront }
      $('.top').innerHTML = ''
      $('.tabs').innerHTML = ''
      $('.legend').innerHTML = ''
      $('.selbar').innerHTML = ''
      $('.roadkey').innerHTML = ''
      $('.tutband').innerHTML = ''
      tutSheet.textContent = ''
      spot.set(undefined, null)
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
    // 지도가 그대로면 다시 깔지 않는다 — 징병 수 ± 처럼 판만 바뀔 때마다 바탕 그림이 깜빡였다 (형: "뒷배경이 너무 깜빡거림")
    const mh = mapPart(r)
    if (mh !== lastMap || first) {
      wrap.innerHTML = mh
      lastMap = mh
    }
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
    paintTut(r)
    const sb = selBarHtml(r)
    $('.selbar').innerHTML = sb
    root.classList.toggle('sel-open', sb !== '')
    $('.roadkey').innerHTML = roadKeyHtml()
    $('.layers').innerHTML = layersOpen ? layersHtml() : ''
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
        case 'people': body = peopleSheet(r); break
        case 'diplo': body = diploSheet(r); break
        case 'scout': body = scoutSheet(r); break
        case 'heroes': body = heroesSheet(r); break
        case 'hero': body = heroSheet(r, sheet.id); break
        case 'nation': body = nationSheet(r); break
        case 'help': body = helpSheet(); break
        case 'log': body = logSheet(); break
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
      // 새 계절의 보고는 계절 띠가 걷힌 뒤에 (형: "계절먼저 넘어가게 보이고 그다음에 천천히 다음꺼 띄워줘라")
      box.classList.toggle('late', !fastNext)
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

  /** 도감에 오른 장수 알림 — 오른쪽 위에 몇 초 (CSS 로 걷히고, 다 걷히면 치운다). 누르면 도감 */
  function dexToast(items: ReturnType<typeof recordDex>): void {
    root.querySelector('.dxtoast')?.remove()
    const html = dexToastHtml(DEX_KIT, items)
    if (html === '') return
    root.insertAdjacentHTML('beforeend', html)
    const el = root.querySelector('.dxtoast')
    el?.addEventListener('animationend', () => el.remove(), { once: true })
  }

  /** 계절을 넘긴다 — 우리 명령(전장의 명령 줄 포함) + AI 명령. 막히면 까닭을 띄운다 */
  function endSeason(prev: Realm, mine: Order[], ai: Order[]): void {
    const all = [...mine, ...ai]
    let res: ReturnType<typeof advance>
    try {
      res = advance(prev, all)
    } catch (e) {
      // 넘기다 막히면 말없이 멈추지 않는다 (형: "지금 하는게임 다음계절로 안넘어가짐") — 까닭을 띄우고 기록에 남긴다
      failNote(e)
      return
    }
    resetTurn()
    sheet = null
    before = prev
    report = res.report
    showReport = true
    realm = res.next
    fresh = new Set(knownOf(res.next, me()).filter((f) => !knows(prev, me(), f)))
    // 계속 둔 판 — 도읍을 모두 쥐면 한 번 더 끝 화면 (하나가 됐다)
    if (res.next.endless === true && res.next.unified === undefined && Object.values(res.next.factions).every((f) => res.next.nodes[f.capital]?.owner === me())) res.next.unified = res.report.season
    // 판을 이기면 다음 판이 열린다 (unlock.ts)
    if (res.next.outcome?.kind === 'win' && prev.outcome == null) markWon(res.next.region ?? 'byeonhan-mini')
    host.onAdvance(res.next, res.report, all, mine)
    dexToast(recordDex(res.next))
    seasonFx(res.next.season)
    if (res.report.lines.some((l) => l.kind === 'battle' && (l.atkFaction === me() || l.defender === me()))) ding('boom_01', 0.35) // 우리가 낀 싸움
    paint()
  }

  // ───────── 폰 뒤로가기 — 웹 페이지 뒤로가 아니라 열린 창부터 닫는다 (형 2026-10-20: "뒤로가기 누르면 … 그냥 웹페이지 뒤로가버리는데")
  // 지킴 칸 하나를 쌓아 두고, 뒤로가기가 그 칸을 걷으면(popstate) 한 겹 닫고 다시 쌓는다. 처음 화면에서 누르면 그때 페이지를 떠난다.
  /** 한 겹 닫는다 — 닫은 게 있으면 true */
  function backOne(): boolean {
    if (root.classList.contains('war-open') || root.querySelector('.wr') !== null) return true // 싸움 중엔 닫지 않는다 (싸움은 끝까지)
    const fail = root.querySelector('.failbox')
    if (fail !== null) { fail.remove(); return true }
    if (front !== null) {
      if (front.kind === 'dex') {
        if (front.sel !== null) front = { ...front, sel: null }
        else front = front.back
      } else if (front.kind === 'detail') front = { kind: 'nations', region: front.region }
      else if (front.kind === 'nations') front = { kind: 'boards' }
      else if (front.kind === 'boards') front = { kind: 'title' }
      else return false // 처음 화면 — 떠난다
      paint()
      return true
    }
    if (prologue !== null) return true
    if (showReport && root.classList.contains('modal-open')) showReport = false
    else if (layersOpen) layersOpen = false
    else if (roadOpen) roadOpen = false
    else if (sheet !== null) sheet = null
    else if (armySel.length > 0) armySel = []
    else front = { kind: 'title' } // 아무것도 안 열려 있으면 처음 화면으로
    paint()
    return true
  }
  try {
    history.replaceState({ realmBase: true }, '')
    history.pushState({ realmGuard: true }, '')
  } catch { /* 막힌 곳 */ }
  addEventListener('popstate', () => {
    if (backOne()) {
      try { history.pushState({ realmGuard: true }, '') } catch { /* 막힌 곳 */ }
    } else history.back()
  })

  // ───────── 손짓 — 한 곳에서 받는다
  root.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act], .nd')
    if (t === null || !root.contains(t)) return
    if (zoom.dragged() && t.closest('.mapwrap') !== null) return // 지도를 끌다 놓은 것 — 누르기가 아니다
    if (t.dataset['act'] === 'bk-fast' || t.dataset['act'] === 'rep-fast') {
      $('.modal').classList.add('fast') // 보고판을 한 번 누르면 끝까지 바로 — 다시 그리지 않는다
      return
    }
    if (t.dataset['act'] === 'zin' || t.dataset['act'] === 'zout') {
      zoom.step(t.dataset['act'] === 'zin' ? 1 : -1)
      return
    }
    if (t.classList.contains('nd') && !t.dataset['act']) {
      // 군대를 고른 채 갈 수 없는 곳을 누르면 고르기만 푼다
      if (armySel.length > 0) {
        armySel = []
        paint()
        return
      }
      host.onTap('node', t.dataset['node']!)
      openSheet({ kind: 'node', id: t.dataset['node']! })
      return
    }
    const d = t.dataset
    host.onTap(d['act'] ?? '', d['tab'] ?? d['node'] ?? d['army'] ?? d['to'] ?? d['id'] ?? d['unit'] ?? '')
    if (realm?.region === 'tutorial') loadTut() // 이 판의 배우기 기록을 먼저 (다시 연 뒤 첫 누름이 기록을 덮지 않게)
    if (realm?.region === 'tutorial' && d['act'] !== undefined && !tut.acts.has(d['act'])) {
      tut.acts.add(d['act'])
      saveTut()
      if (front === null) paintTut(plan()) // 다시 그리지 않는 단추(우리 땅 등)에도 띠가 넘어가게
    }
    if (d['act'] !== undefined && d['act'] !== 'next') ding('click1', 0.18) // 누른 것이 먹었다는 작은 소리
    freshArmy = ''
    const r = realm !== null ? plan() : null
    switch (d['act']) {
      case 'continue': front = null; paint(); return
      case 'fr-new': case 'newgame': front = { kind: 'boards' }; sheet = null; looking = false; paint(); return
      case 'fr-back': front = { kind: 'title' }; paint(); return
      case 'fr-board':
        if (d['v'] === 'tutorial') { host.onNewGame('us', 'tutorial'); return } // 배우는 판은 나라를 고르지 않는다
        front = { kind: 'nations', region: d['v'] as RegionId }; $('.mapwrap').scrollTop = 0; paint(); return
      case 'fr-tutorial': host.onNewGame('us', 'tutorial'); return
      case 'fr-locked': return
      case 'tut-end': markTutorialOver('done'); front = { kind: 'title' }; paint(); return
      case 'fr-nation': if (front !== null && front.kind === 'nations') front = { kind: 'detail', region: front.region, id: d['id']! }; $('.mapwrap').scrollTop = 0; paint(); return
      case 'fr-start': if (front !== null && front.kind === 'detail') host.onNewGame(d['id']!, front.region); return
      case 'fr-again': if (realm !== null) host.onNewGame(realm.player, realm.region ?? 'byeonhan-mini'); return
      case 'fr-look': looking = true; paint(); return
      case 'keep': if (realm !== null) toggleKeep(realm, d['id']!); fastNext = true; paint(); return
      case 'carry-tog': toggleCarry(d['id']!); paint(); return
      case 'dex-open': root.querySelector('.dxtoast')?.remove(); front = { kind: 'dex', board: 'all', sel: null, back: front }; sheet = null; paint(); return
      case 'dex-close': if (front !== null && front.kind === 'dex') front = front.back; paint(); return
      case 'dex-board': if (front !== null && front.kind === 'dex') { front = { ...front, board: d['v'] as DexBoard, sel: null }; root.querySelector('.front.dexp')?.scrollTo(0, 0) } paint(); return
      case 'dex-sel': if (front !== null && front.kind === 'dex') front = { ...front, sel: d['id'] === undefined || d['id'] === front.sel ? null : d['id'] }; paint(); return
      case 'fr-endless': if (realm !== null) { realm.endless = true; looking = false; showReport = false } paint(); return
      case 'pl-next': case 'pl-skip': {
        if (prologue === null) return
        if (d['act'] === 'pl-next' && prologue < PROLOGUE_STEPS - 1) { prologue++; paint(); return }
        // 서막이 걷히고 지도가 열린다 — 한지가 걷히며 본 땅이 번진다
        prologue = null
        root.querySelector('.prologue')?.classList.add('out')
        root.classList.add('opening')
        // 서막이 사라진 뒤 한 번 — 첫 계절을 알린다. 지도는 다시 그릴 때마다 새로 생기니 animationend 대신 한 번 거둔다
        setTimeout(() => { $('.plbox').innerHTML = ''; if (realm !== null) { seasonFx(realm.season); paintTut(plan()) } }, 900)
        setTimeout(() => root.classList.remove('opening'), 3000)
        return
      }
      case 'close': sheet = null; paint(); return
      case 'tab': markSeen(d['tab']!); openSheet({ kind: d['tab'] as 'army' }); return
      case 'help': openSheet({ kind: 'help' }); return
      case 'export': host.onExport(); return
      case 'failclose': root.querySelector('.failbox')?.remove(); return
      case 'mute': try { localStorage.setItem(MUTE_KEY, muted() ? '0' : '1') } catch { /* 저장 못 하는 곳 */ } break
      case 'focus': focus = focus === d['id'] ? null : d['id']!; break
      case 'rep-close': showReport = false; paint(); return
      case 'next': {
        if (realm === null || (realm.outcome && !realm.endless)) return
        const orders = ordersNow()
        const ai = aiOrders(realm)
        const prev = realm
        fastNext = false
        // 우리가 낄 싸움이 있으면 전장이 먼저 열린다 — 합마다 직접 지휘하고, 그 명령으로 넘긴다 (battlefield.ts)
        const finish = (tactics: Record<string, Tactic>): void => {
          const cmds: Order[] = Object.entries(tactics).map(([key, t]) => ({ kind: 'command', key, cmds: t.cmds }))
          endSeason(prev, [...orders, ...cmds], ai)
        }
        try {
          if (openWar(root, prev, [...orders, ...ai], { art: ART, me: me(), ding, done: finish })) return
        } catch (e) {
          failNote(e)
          return
        }
        endSeason(prev, orders, ai)
        return
      }
      case 'open':
        if (openArmy === d['army'] && armyMode === d['mode']) openArmy = ''
        else { openArmy = d['army']!; armyMode = d['mode'] as 'move' | 'split'; split = { take: {}, hero: false, edge: null, ambush: false } }
        break
      case 'tok': {
        // 같은 고을에 머무는 말을 더 누르면 함께 골라진다. 다른 고을·길 위의 말이면 그것만
        const id = d['army']!
        const x = r?.armies[id]
        const sameNode = (y: string): boolean => r?.armies[y]?.at === x?.at && r?.armies[y]?.march === null
        if (armySel.includes(id)) armySel = armySel.filter((y) => y !== id)
        else if (x !== undefined && x.march === null && armySel.length > 0 && armySel.every(sameNode)) armySel = [...armySel, id]
        else armySel = [id]
        break
      }
      case 'selclose': armySel = []; break
      case 'roadkey': roadOpen = !roadOpen; break
      case 'log-open': openSheet({ kind: 'log' }); return
      case 'log-f': logFilter = d['v'] as LogFilter; break
      case 'log-n': logNation = d['id'] ? d['id'] : null; break
      case 'layers': layersOpen = !layersOpen; break
      case 'layer': toggleLayer(d['v'] as LayerId); break
      case 'nat-plot':
        diploMode = 'plot'
        sheet = { kind: 'diplo' }
        paint()
        break
      case 'compose-go': case 'nat-diplo': {
        // 고을 판에서 자세히 꾸며야 하는 사신 — 외교 판의 그 나라 칸을 열어 준다
        diploMode = 'envoy'
        if (d['act'] === 'compose-go') compose = { ...NO_COMPOSE, give: noGoods(), take: noGoods(), to: d['to']!, ask: d['ask'] as Ask }
        sheet = { kind: 'diplo' }
        paint()
        requestAnimationFrame(() => $('.sheet').querySelector<HTMLElement>(d['act'] === 'compose-go' ? '.trade' : `[data-to="${d['to']}"]`)?.scrollIntoView({ block: 'center' }))
        return
      }
      case 'home': {
        // 우리 도읍으로 지도를 옮긴다 (형: "내나라가 지도상에서 정확히 어딘지 가늠이 안됨")
        const wrap = $('.mapwrap')
        const cap = realm !== null ? realm.factions[me()]?.capital : undefined
        const el = cap !== undefined ? wrap.querySelector<HTMLElement>(`.nd[data-node="${cap}"]`) : null
        const map = wrap.querySelector<HTMLElement>('.map')
        // 지도 끝 너머(구름 그림이 삐져나온 자리)까지 밀지 않는다
        const cl = (v: number, max: number): number => Math.max(0, Math.min(v, max))
        if (el !== null && map !== null) {
          wrap.scrollTo({
            left: cl(map.offsetLeft + el.offsetLeft - wrap.clientWidth / 2, map.offsetLeft + map.offsetWidth - wrap.clientWidth),
            top: cl(map.offsetTop + el.offsetTop - wrap.clientHeight / 2, map.offsetTop + map.offsetHeight - wrap.clientHeight),
            behavior: 'smooth',
          })
        }
        return
      }
      case 'jump': $('.sheet').querySelector(`#${d['to']}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return
      case 'selmerge': {
        // 고른 군대를 하나로 — 장수가 이끄는 군대로 모은다
        if (r === null) break
        const into = armySel.find((id) => r.armies[id]?.hero != null) ?? armySel[0]!
        const os: Order[] = armySel.filter((id) => id !== into).map((id) => ({ kind: 'merge', army: id, into }))
        if (os.length === 0) break
        armyOrders = [...armyOrders, ...os]
        for (const o of os) if (o.kind === 'merge') delete pick[o.army]
        armySel = [into]
        break
      }
      case 'go': {
        // 지도에서 고른 곳으로 — 싸울 곳이면 군대 판을 열어 어떻게 칠지 고르게 한다. 제 고을(머문다)이나 같은 곳을 다시 누르면 머문다
        const edge = d['edge'] ?? ''
        if (armySel.length === 0 || r === null) break
        const army = armySel[0]!
        if (edge === '' || armySel.every((id) => pick[id]?.edge === edge)) {
          for (const id of armySel) delete pick[id]
          armySel = []
          break
        }
        for (const id of armySel) pick[id] = { edge, ambush: false }
        const m = movesOf(r, me(), r.armies[army]!).find((x) => x.edge.id === edge)
        if (m?.hostile === true) {
          openArmy = army
          armyMode = 'move'
          armySel = []
          sheet = { kind: 'army' } // openSheet 은 같은 판이면 닫는다 — 여기선 늘 연다
          paint()
          requestAnimationFrame(() => $('.sheet').querySelector<HTMLElement>('.row.mv.on')?.scrollIntoView({ block: 'center' }))
          return
        }
        armySel = []
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
      case 'ap': {
        // 진군 방식 — 대로가 아니면 숨어 간다
        const p = pick[d['army']!]
        if (p !== undefined) {
          p.approach = d['v'] as Approach
          p.ambush = p.approach !== 'road'
        }
        break
      }
      case 'ration': {
        const p = pick[d['army']!]
        const a = r?.armies[d['army']!]
        if (p === undefined || a === undefined || r === null) break
        const m = movesOf(r, me(), a).find((x) => x.edge.id === p.edge)
        const cur = rationExtraOf(r, a, m?.seasons ?? 1, p.ration)
        const v = d['v']
        p.ration = v === 'full' ? P.realm.rationReserve : Math.max(0, Math.min(P.realm.rationMaxExtra, cur + (v === 'more' ? 1 : -1)))
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
        // 병종 하나씩 — 그 병종 가운데 가장 낮은 무장을 한 단계
        const army = d['army']!
        const unit = d['unit'] as UnitKind
        const same = (o: Order): boolean => o.kind === 'arm' && o.army === army && o.unit === unit
        musters = musters.some(same) ? musters.filter((o) => !same(o)) : [...musters, { kind: 'arm', army, unit }]
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
        const lim = draftLimit(r!, me(), node, draftUnit[node] ?? 'spear')
        draftN[node] = Math.max(0, Math.min(lim, (draftN[node] ?? Math.min(lim, 20)) + Number(d['d'])))
        break
      }
      case 'draft': {
        const node = d['node']!
        const n = draftN[node] ?? Math.min(draftLimit(r!, me(), node, draftUnit[node] ?? 'spear'), 20)
        // 철을 들이기로 했어도 남은 철이 모자라면 그냥 뽑는다 — 미리 알린다
        const ironOk = draftIron[node] === true && (draftIronCost(r!, me(), n, draftUnit[node] ?? 'spear')?.iron ?? Infinity) <= left().iron
        if (draftIron[node] === true && !ironOk) note = '철이 모자라 쇠 무기 없이 뽑는다.'
        if (n > 0) musters = [...musters, { kind: 'draft', faction: me(), node, unit: draftUnit[node] ?? 'spear', n, ...(ironOk ? { iron: true as const } : {}) }]
        delete draftN[node]
        break
      }
      case 'undraft': musters = musters.filter((_, i) => i !== Number(d['i'])); break
      case 'sfrom': settleFrom[d['node']!] = d['from']!; delete settleN[d['node']!]; break
      case 'sn': {
        const to = d['node']!
        const from = settleFromOf(r!, to)
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
      case 'mig-auto': {
        // 켜고 끄기는 명령 — 계절 처음의 판과 같아지면 명령을 거둔다. 켜면 이번 계절 직접 옮긴 것은 거둔다 (자동이 맡는다)
        const want = d['v'] === '1'
        if (want) settles = settles.filter((o) => o.kind !== 'migrate')
        setAutoMig(want)
        break
      }
      case 'mig-from': migFrom = d['node']!; migN = 0; break
      case 'mig-to': migTo = d['node']!; migN = 0; break
      case 'mig-n': migN = Math.max(0, Math.min(Number(d['lim']), Number(d['cur']) + Number(d['d']))); break
      case 'migrate': {
        const n = Number(d['n'])
        if (n > 0) {
          settles = [...settles, { kind: 'migrate', faction: me(), from: d['from']!, to: d['to']!, n }]
          setAutoMig(false) // 직접 나눴으면 자동 분배는 꺼진다 — 다시 누를 수 있다
        }
        migN = 0
        break
      }
      case 'mig-here': case 'mig-out': {
        // 고을 판에서 — 이주 칸을 열고 그 고을을 받을(보낼) 곳으로 둔다
        if (d['act'] === 'mig-here') migTo = d['node']!
        else migFrom = d['node']!
        migN = 0
        sheet = { kind: 'people' }
        paint()
        requestAnimationFrame(() => $('.sheet').querySelector('#sec-move')?.scrollIntoView({ block: 'start' }))
        return
      }
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
        compose = { ...NO_COMPOSE, give: noGoods(), take: noGoods(), to: same ? '' : d['to']!, ask: d['ask'] as Ask }
        break
      }
      case 'cq': {
        const side = d['side'] as 'give' | 'take'
        const res = d['res'] as Good
        compose[side][res] = Math.max(0, compose[side][res] + Number(d['d']))
        break
      }
      case 'ctarget': compose.target = compose.target === d['node'] ? '' : d['node']!; break
      case 'envoy': {
        fastNext = true // 보고판에서 눌렀으면 다시 그릴 때 처음부터 돌리지 않는다
        const ask = d['ask'] as Ask
        const to = d['to']!
        const detailed = compose.to === to && compose.ask === ask
        if (envoys[to]?.ask === ask) delete envoys[to]
        else {
          envoys[to] = {
            kind: 'envoy', from: me(), to, ask,
            give: detailed ? { ...compose.give } : noGoods(),
            take: detailed ? { ...compose.take } : noGoods(),
            ...(escort[to] !== undefined && escort[to] !== '' ? { hero: escort[to] } : {}),
            ...(detailed && compose.target !== '' ? { target: compose.target } : {}),
          }
        }
        compose = { ...NO_COMPOSE, give: noGoods(), take: noGoods() }
        break
      }
      case 'unenvoy': delete envoys[d['to']!]; break
      case 'escort': escort[d['to']!] = d['id'] ?? ''; break
      case 'deeds': { const t = d['to']!; if (deedsOpen.has(t)) deedsOpen.delete(t); else deedsOpen.add(t); break }
      case 'build': {
        const node = d['node']!
        const same = (o: Order): boolean => o.kind === 'build' && o.node === node
        musters = musters.some(same) ? musters.filter((o) => !same(o)) : [...musters, { kind: 'build', faction: me(), node, what: d['what'] as 'palisade' | 'moat' }]
        break
      }
      case 'dmode': diploMode = d['v'] as 'envoy' | 'plot' | 'scout'; break
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
        else if (plots.length < P.realm.plotsPerSeason) plots = [...plots, k.hero !== undefined && hands[k.hero] !== undefined ? { ...o, hand: hands[k.hero]! } as Order : o]
        break
      }
      case 'unplot': plots = plots.filter((_, i) => i !== Number(d['i'])); break
      case 'shoot': {
        const o = plots[Number(d['i'])]
        if (o?.kind === 'plot' && o.hero !== undefined && hands[o.hero] !== undefined) break // 한 번만
        openNight(Number(d['i']))
        return
      }
      case 'pagent': plotAgent = d['id'] ? d['id'] : null; break
      case 'bowup': musters = musters.some((o) => o.kind === 'bowUp') ? musters.filter((o) => o.kind !== 'bowUp') : [...musters, { kind: 'bowUp', faction: me() }]; break
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
    show(r, b, rep, fresh = false) {
      realm = r
      before = b
      report = rep
      showReport = rep !== null
      front = fresh ? null : { kind: 'title' }
      prologue = fresh ? 0 : null
      looking = false
      resetTurn()
      restoreDraft()
      loadSeen()
      if (r !== null) recordDex(r) // 열 때 한 번 — 알림 없이 (이 판에서 이미 본 장수)
      sheet = null
      paint()
    },
  }
}
