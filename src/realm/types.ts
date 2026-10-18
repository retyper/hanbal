/**
 * 나라(realm)의 상태 — 판 하나 (docs/realm/SYSTEMS.md §0 · BUILD §1-2)
 *
 * **JSON 으로 그대로 직렬화되는 평범한 객체**만 쓴다 — 클래스·함수·Map 금지.
 * 그래야 저장·비교·리플레이가 공짜다 (BUILD §1-2). 모음은 배열이 아니라 id 를 열쇠로 한 기록이다.
 *
 * R1 의 범위: 지도 · 세력 · 장수 · 군대 · 정보 · 경계.
 * R1.5 (FLOW, 2026-10-18): 가호·창고(곡식·철) · 징병·해산 · 관계·사신 · 이김·짐. 사건·회유는 R3~R4.
 */
import type { Equip, Outcome, UnitKind } from './battle.ts'
import type { Source } from './intel.ts'

/** 계절 번호 0 = 첫해 봄. 계절 = 번호 % 4 */
export type SeasonOfYear = 'spring' | 'summer' | 'autumn' | 'winter'

/** 고을 종류 (SYSTEMS §1-1) */
export type NodeKind = 'capital' | 'village' | 'sodo' | 'port' | 'fort' | 'ironMine' | 'wild'

/**
 * 지형 꼬리표 (SYSTEMS §1-2) — 화면에는 숫자가 아니라 문장으로 나간다 (data/prose).
 * 규칙에 걸리는 것만 둔다; 늘릴 때는 SYSTEMS §1-2 표에 먼저 적는다.
 */
export type Tag = 'reeds' | 'shallows' | 'pines' | 'high' | 'palisade' | 'moat' | 'fog' | 'iron' | 'sodo'

/** 길 종류 (SYSTEMS §1-1) */
export type EdgeKind = 'field' | 'pass' | 'forest' | 'reeds' | 'ford' | 'sea' | 'mudflat'

export interface RNode {
  readonly id: string
  readonly name: string
  readonly kind: NodeKind
  readonly tags: readonly Tag[]
  /** 다스리는 세력 id. 무주지는 null */
  owner: string | null
  /** 가호 (집 수) — 군사·장정·수확의 원천 (FLOW §2). 징병하면 줄고 해산하면 돌아온다 */
  hh: number
  /** 봄에 심은 가호 — 가을 수확은 이것이 정한다 (FLOW §1: 봄 징병은 그해 농사를 깎는다) */
  sown: number
  /** 빈땅(kind 'wild')만 — 이 땅이 품을 수 있는 가호 상한. 개척해 사람을 보내면 여기까지 빨리 큰다 (economy.settleLimit) */
  readonly room?: number
}

export interface REdge {
  readonly id: string
  readonly a: string
  readonly b: string
  readonly kind: EdgeKind
  readonly tags: readonly Tag[]
}

/** 세력의 머리 — 플레이어인가, 어떤 성향의 AI 인가 (SYSTEMS §11, R1 은 둘만) */
export type Mind = 'player' | 'greedy' | 'cautious'

export interface Faction {
  readonly id: string
  readonly name: string
  readonly mind: Mind
  /** 국읍 고을 id */
  readonly capital: string
  /** 새로 뽑는 군사의 장비 (FLOW §2) */
  readonly equip: Equip
  /** 계절마다 바깥과의 교역으로 들어오는 것 — 독로국의 왜 교역 같은 (FLOW §3). 없으면 0 */
  readonly income?: { readonly grain: number; readonly iron: number }
  /**
   * 군주 — 장수 id (docs/realm/HEROES.md, 형: "군주는 따로 있어야 하고 장군이랑 별개"). 군대를 이끌지 않고 도읍에 머문다.
   * 능력치가 나라 전체에 작게 걸린다 (heroes.rulerOf). 옛 판에는 없다.
   */
  readonly ruler?: string
}

/** 나라 사이 관계 (FLOW §4) — 판은 중립에서 시작한다. 화친은 `until` 계절에 끝난다 */
export interface Relation {
  state: 'war' | 'neutral' | 'truce' | 'ally'
  until: number | null
  /**
   * 호감 −100..100 (외교 둘째판, 2026-10-18 — 형: "외교가 좀 재미없음"). 없으면 0.
   * 선물·받아 준 청·교역·장터·같은 적과 싸움으로 오르고, 들킨 공작·거절·깨진 약속·저버린 부탁으로 내린다 (diplomacy.addFavor)
   */
  favor?: number
  /** 함께 치자는 약속 — `by` 가 `node` 를 `until` 계절까지 친다 (diplomacy.checkPledges) */
  pledges?: Pledge[]
  /** 땅을 앗은 마지막 계절 — 앗은 나라 id 로 (stance.tookRecently: 밀리는 쪽이 화친을 청할 까닭) */
  took?: Record<string, number>
}

/**
 * 속셈의 까닭 (stance.ts) — 남의 나라가 화친·동맹·깨기·청을 꺼내는 까닭. 화면에 말로 보인다.
 * losing 밀린다 · fronts 두 쪽 싸움 · hungry 굶주림 · leader 앞서가는 나라 · commonFoe 같은 적 · favor 가까워짐 ·
 * weak 센 이웃이 두렵다 · strong 제 힘을 믿는다 · surplus 남는 것 · ally 동맹이라 · tooBig 상대가 너무 커졌다 · prey 상대가 만만하다
 */
export type Why =
  | 'losing' | 'fronts' | 'hungry' | 'leader' | 'commonFoe' | 'favor'
  | 'weak' | 'strong' | 'surplus' | 'ally' | 'tooBig' | 'prey'

/** 동맹의 약속 하나 — 지키면 호감 +, 저버리면 호감 크게 − */
export interface Pledge {
  readonly by: string
  readonly node: string
  readonly until: number
}

/** 한 나라의 창고 — 국읍 창고 (SYSTEMS §7-5 자원 넷 가운데 둘) */
export interface Stock {
  grain: number
  iron: number
}

/**
 * 사신이 청하는 것. 관계마다 할 수 있는 것이 다르다 (diplomacy.envoyOptions):
 *   gift 선물 · joint 함께 치자(동맹) · aid 지원 요청(동맹) · troops 군대 빌리기(동맹) · break 화친·동맹을 깬다
 */
export type EnvoyAsk = 'truce' | 'trade' | 'tribute' | 'alliance' | 'gift' | 'joint' | 'aid' | 'troops' | 'break'

export type HeroStatus = 'free' | 'captive' | 'dead'

export interface Hero {
  readonly id: string
  readonly name: string
  faction: string
  /**
   * 능력치 여섯 1~10 (docs/realm/HEROES.md §1 — 화면 이름은 prose.STAT_NAME):
   * 무예 mu · 통솔 tong · 지략 ryak · 내정 chi · 매력 deok · 의리 uiri (나라·주인에 대한 마음 — 낮으면 회유·매수에 넘어간다)
   */
  // 다섯은 자란다 (HEROES §6 — heroes.gainXp). 의리는 타고난다
  mu: number
  tong: number
  ryak: number
  chi: number
  deok: number
  readonly uiri: number
  /** 특성 id (data/traits.ts) — 0~3개 */
  readonly traits: readonly string[]
  /** 남 g · 여 w — 그림 짝짓기와 글에 쓴다 */
  readonly look: 'g' | 'w'
  status: HeroStatus
  /** 사로잡힌 곳의 세력 id */
  captor: string | null
  /**
   * 군대 없이 혼자 머무는 고을 — 군대를 이끄는 동안은 null (자리는 그 군대의 자리).
   * 맡은 고을(post)이 있으면 그 고을이다 (HEROES §3).
   */
  at: string | null
  /** 맡은 고을 — 내정·지략·매력·특성이 그 고을에 걸린다. 없으면 null */
  post: string | null
  /** 회유 중 — 사로잡은 나라가 계절마다 곡식을 내며 설득한다 (HEROES §4-1). by = 맡은 장수 */
  persuade?: { by: string | null; left: number }
  /** 다친 장수 — 이 계절까지 군대를 이끌지 못한다 (암살이 먹혔다, plots.ts) */
  woundedUntil?: number
  /**
   * 정(情) 0~100 — 주인을 얼마나 믿나 (HEROES §6, 형: "장수를 오래쓰면 친밀도? 이런게 올라야 하지 않을까"). 군주는 없다.
   * 없으면 P.realm.bondStart. 섬긴 계절·이긴 싸움으로 오르고 진 싸움으로 준다. 70 이면 믿는 장수, 100 이면 특성 하나에 눈뜬다
   */
  bond?: number
  /** 자라는 능력치마다 쌓인 공 — growNeed 를 채우면 한 단계 오른다 */
  xp?: Partial<Record<GrowStat, number>>
  /** 이 장수가 자라서 오른 단계 (화면이 "얼마나 컸나"를 보인다) */
  grown?: Partial<Record<GrowStat, number>>
  /** 이 나라를 섬긴 계절 */
  served?: number
  /** 정이 다 차서 눈뜬 특성 — 한 번만 */
  awoken?: string
}

/** 자라는 능력치 — 의리는 타고난다 */
export type GrowStat = 'mu' | 'tong' | 'ryak' | 'chi' | 'deok'

/** 떠돌이 인재 — 봄에 어느 고을에 나타나 값을 내면 들어온다 (HEROES §4-2). until 계절이 지나면 떠난다 */
export interface Wanderer {
  readonly hero: Hero
  readonly node: string
  readonly until: number
  readonly price: number
}

/** 행군 중인 군대 — 길 위에 있다. `left` 계절 뒤 `to` 에 닿는다 */
export interface March {
  readonly from: string
  readonly to: string
  readonly edge: string
  left: number
  /** 기습으로 들어가는가 — 아니면 정면 (S = 1.0) */
  readonly ambush: boolean
}

export interface Army {
  readonly id: string
  readonly faction: string
  hero: string | null
  /** 병종별 사람 수 — 합이 병력 N */
  mix: Partial<Record<UnitKind, number>>
  equip: Equip
  morale: number
  /** 머무는 고을 (행군 중이면 떠난 고을) */
  at: string
  march: March | null
  /** 동맹에게 빌려준 군대 — `to` 나라의 `node` 고을로 가서 `until` 계절까지 머물며 지킨다 (diplomacy troops). 그동안 AI 가 마음대로 안 움직인다 */
  lent?: { readonly to: string; readonly node: string; readonly until: number }
}

/** 한 세력이 한 고을에 대해 아는 것 (SYSTEMS §2-1 세 겹 가운데 땅·군세) */
export interface NodeIntel {
  /** 땅 — 한 번 보면 안 낡는다 */
  land: boolean
  /** 군세 — 그때의 참 전투력 · 출처 · u · 본 계절. 없으면 본 적 없음 */
  force: { f0: number; src: Source; u: number; season: number } | null
  /** 경계 — 본 값과 본 계절 */
  alert: { v: number; season: number } | null
}

/** 고을의 경계·방심 (SYSTEMS §3) — 기습의 덧셈 값 */
export interface Watch {
  alert: number
  lull: number
  /** 경계를 강화한 계절 (guard 명령) — 한 고을 한 계절 한 번. 옛 저장에는 없다 */
  guarded?: number
  /** 매수 공작이 먹혀 장정이 서지 않는 마지막 계절 (plots.ts). 옛 저장에는 없다 */
  bribedUntil?: number
}

/**
 * 공작 — 몰래 하는 일 (형: "다양한 외교나 공작이 가능 해야하는거 아님?" — 2026-10-18, plots.ts)
 *   rumor 소문 · sow 이간 · bribe 매수 · burn 방화 · spy 첩자
 */
export type PlotOp = 'rumor' | 'sow' | 'bribe' | 'burn' | 'spy' | 'assassin'

/** 심어 둔 첩자 — `until` 계절까지 그 고을 군세를 계절마다 새로 안다 */
export interface Spy {
  readonly node: string
  readonly until: number
}

/**
 * 남의 나라가 거는 청(請) — 플레이어가 받기·거절로 답한다 (형: "적이 뭔가 거래를 걸어온다거나 동맹요구하거나" — 2026-10-18).
 *   truce · alliance — 화친·동맹을 청한다
 *   trade   — 맞바꿈: `give` 는 그쪽이 주고 `take` 는 우리가 준다
 *   tribute — 그쪽이 조공을 바친다 (`give`). 받으면 화친이 된다
 *   demand  — 그쪽이 조공을 내놓으라 한다 (`take`). 내면 화친, **거절하면 전쟁**
 * `until` 계절 안에 답해야 한다. 답이 없으면 거절로 친다.
 */
/** 청의 갈래 — joint(함께 치자 · node) · aid(곡식을 보태 달라) 는 동맹이 건다 */
export type AskKind = 'truce' | 'trade' | 'tribute' | 'alliance' | 'demand' | 'joint' | 'aid'

export interface Ask {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly kind: AskKind
  readonly give: { readonly grain: number; readonly iron: number }
  readonly take: { readonly grain: number; readonly iron: number }
  readonly until: number
  /** joint — 함께 칠 고을 */
  readonly node?: string
  /** 왜 청하나 (stance.ts) — 까닭이 가리키는 나라는 about */
  readonly why?: Why
  readonly about?: string
}

export interface Realm {
  readonly seed: number
  season: number
  readonly nodes: Record<string, RNode>
  readonly edges: Record<string, REdge>
  readonly factions: Record<string, Faction>
  heroes: Record<string, Hero>
  armies: Record<string, Army>
  /** intel[세력][고을] */
  intel: Record<string, Record<string, NodeIntel>>
  watch: Record<string, Watch>
  /** 플레이어가 먼저 치거나 땅을 뺏은 나라 — 초반 유예가 없다 (ai.ts spared). id 순서. 옛 저장에는 없다 */
  provoked?: string[]
  /** 플레이어의 나라 id (FLOW §3 — 판을 열 때 고른다) */
  readonly player: string
  /** 나라마다 국읍 창고 */
  stock: Record<string, Stock>
  /** 나라 사이 관계 — 열쇠는 diplomacy.pairKey(a, b). 없으면 중립 */
  relations: Record<string, Relation>
  /** 판의 끝 — 플레이어가 이겼나 졌나 (FLOW §7 #1) */
  outcome: { kind: 'win' | 'lose'; season: number } | null
  /** 봄 제사를 지낸 해 (Math.floor(season / 4)) — 나라마다. 그해 가을 수확이 는다 (economy.riteAllowed). 옛 저장에는 없다 */
  blessed?: Record<string, number>
  /** 답을 기다리는 청 (diplomacy.openAsks). 옛 저장에는 없다 */
  asks?: Ask[]
  /** 나라마다 심어 둔 첩자 (plots.ts spy). 옛 저장에는 없다 */
  spies?: Record<string, Spy[]>
  /** 지금 떠도는 인재 (heroes.ts) · 이미 나온 명단 id */
  wanderers?: Wanderer[]
  poolUsed?: string[]
  /** 나라마다 능력치를 본 남의 장수 — 싸워 봤거나 정찰·첩자로 봤다 (heroes.heroSeen) */
  met?: Record<string, string[]>
}

/** 플레이어(또는 AI)가 한 계절에 내리는 명령 */
export type Order =
  | { readonly kind: 'march'; readonly army: string; readonly edge: string; readonly ambush: boolean }
  | { readonly kind: 'scout'; readonly faction: string; readonly node: string; readonly hero: string | null }
  /** 나누기 (SYSTEMS §4-5) — `id` 는 새 군대의 이름 (season.newArmyId). `hero` 면 장수가 별동대를 이끈다 */
  | {
      readonly kind: 'split'
      readonly army: string
      readonly id: string
      readonly take: Readonly<Partial<Record<UnitKind, number>>>
      readonly hero: boolean
    }
  /** 모으기 — `army` 를 `into` 에 붓는다 */
  | { readonly kind: 'merge'; readonly army: string; readonly into: string }
  /** 징병 (FLOW §2) — 그 고을의 가호에서 n 명. 그 고을에 쉬는 제 군대가 있으면 거기 들고, 없으면 새 군대 */
  /** iron — 철을 들여 한 단계 위 장비로 뽑는다 (economy.draftIronCost) */
  | { readonly kind: 'draft'; readonly faction: string; readonly node: string; readonly unit: UnitKind; readonly n: number; readonly iron?: boolean }
  /** 해산 — 제 고을에 쉬는 군대를 집으로 (사람은 그 고을 가호로 돌아간다) */
  | { readonly kind: 'disband'; readonly army: string }
  /** 개척 — 제 고을 `from` 의 가호 n 을 길로 맞닿은 빈땅 `to` 로 옮긴다. 곡식이 든다 (economy.settleLimit · settleCost) */
  | { readonly kind: 'settle'; readonly faction: string; readonly from: string; readonly to: string; readonly n: number }
  /** 소도 제사 — 봄·가을에, 소도와 길로 맞닿은 고을을 쥔 나라만. 곡식이 든다 (economy.riteAllowed · riteCost) */
  | { readonly kind: 'rite'; readonly faction: string }
  /** 청에 답한다 — 받기(yes) · 거절. 답하지 않은 청은 거절로 친다 */
  | { readonly kind: 'answer'; readonly ask: string; readonly yes: boolean }
  /** 경계 강화 — 곡식을 내고 그 고을 경계를 올린다 (economy.canGuard · guardCost). 한 고을 한 계절 한 번 */
  | { readonly kind: 'guard'; readonly faction: string; readonly node: string }
  /** 공작 (plots.ts) — 한 계절에 plotsPerSeason 까지, 같은 대상에 같은 공작은 하나. sow 는 `other`, bribe·spy 는 `node` */
  | {
      readonly kind: 'plot'; readonly faction: string; readonly op: PlotOp; readonly target: string; readonly node?: string; readonly other?: string
      /** 암살(assassin) — 노릴 장수 · 보낼 자객(우리 장수, 혼자 머무는 이). 자객이 없으면 고용 자객 (곡식 더) */
      readonly hero?: string; readonly agent?: string
      /** 밤 판(night.html)에서 손으로 쏜 암살의 결과 — 있으면 굴림 대신 이것 (SNIPE §0-3). 값은 똑같이 든다 */
      readonly hand?: { readonly result: 'dead' | 'wounded' | 'fled' | 'withdrew'; readonly alarm: boolean }
    }
  /** 장수를 고을에 맡긴다 (HEROES §3) — 장수가 그 고을에 있어야 한다. node null 이면 맡은 자리를 떠난다 (그 고을에 혼자 머문다) */
  | { readonly kind: 'assign'; readonly hero: string; readonly node: string | null }
  /** 혼자 머무는 장수가 같은 고을의 장수 없는 군대를 이끈다 */
  | { readonly kind: 'lead'; readonly hero: string; readonly army: string }
  /** 포로 회유를 시작한다 — 다 될 때까지 계절마다 곡식이 든다. by = 설득을 맡은 우리 장수 (매력·매혹이 빠르기를 정한다) */
  | { readonly kind: 'persuade'; readonly hero: string; readonly by: string | null }
  /** 떠돌이 인재를 들인다 — 그 인재가 머문 고을의 주인만, 곡식 price */
  | { readonly kind: 'hire'; readonly faction: string; readonly hero: string }
  /** 사신 (FLOW §4) — 한 나라가 한 계절에 하나. give 는 보내는 쪽이, take 는 받는 쪽이 내놓는다 */
  | {
      readonly kind: 'envoy'
      readonly from: string
      readonly to: string
      readonly ask: EnvoyAsk
      readonly give: { readonly grain: number; readonly iron: number }
      readonly take: { readonly grain: number; readonly iron: number }
      /** joint — 함께 칠 고을 · troops — 빌린 군대가 지킬 우리 고을 */
      readonly target?: string
      /** AI 가 보낸 사신의 까닭 (stance.ts) — 보고에 말로 */
      readonly why?: Why
      readonly about?: string
    }
  /** 무장 올리기 (철의 쓰임) — 제 고을에 쉬는 군대의 장비를 한 단계 (economy.armCost) */
  | { readonly kind: 'arm'; readonly army: string }

/** 직접 쏜 저격의 결과 — 판 열쇠(battleKey)마다. R1 에는 저격이 없어 비어 있다 (SNIPE · SYSTEMS §6) */
export type SnipeZone = 'head' | 'body' | 'leg' | 'drum' | 'miss'

/** 보고의 한 줄 — 글은 ui 가 짓는다. 여기는 무슨 일이 있었는지만 */
export type ReportLine =
  | { readonly kind: 'scout'; readonly faction: string; readonly node: string; readonly detected: boolean }
  | { readonly kind: 'blocked'; readonly army: string; readonly edge: string; readonly why: 'winterPass' | 'summerFord' }
  | { readonly kind: 'arrive'; readonly army: string; readonly node: string }
  | { readonly kind: 'split'; readonly army: string; readonly id: string }
  | { readonly kind: 'merge'; readonly army: string; readonly into: string }
  | { readonly kind: 'take'; readonly faction: string; readonly node: string }
  | {
      readonly kind: 'battle'
      readonly node: string
      /** 앞선 공격 군대 (판의 열쇠) · 함께 친 군대들 (§4-5 협공) */
      readonly attacker: string
      readonly allies: readonly string[]
      readonly pincer: boolean
      readonly defender: string
      readonly ambush: 'none' | 'success' | 'caught'
      readonly p: number
      readonly outcome: Outcome
      readonly captured: string | null
      readonly killed: string | null
      /** 판정에 선 장정 수 — 기습이 먹히면 0 (모이지 못했다) */
      readonly militia: number
      /** 친 나라 — 군대가 흩어져도 남는다 (약속 셈 · diplomacy.checkPledges). 옛 보고에는 없다 */
      readonly atkFaction?: string
      /**
       * 들판 싸움 — 같은 길을 마주 보고 가던 두 군대가 길 위에서 맞붙었다. 성·장정·기습이 없다.
       * 그때 `edge` 는 그 길, `node` 는 공격 쪽이 가던 고을. 고을 싸움이면 false (옛 보고에는 없다)
       */
      readonly field?: boolean
      readonly edge?: string
    }
  /** 가을 수확 — `blessed` 는 그 가운데 봄 제사로 더 든 몫 */
  | { readonly kind: 'harvest'; readonly faction: string; readonly grain: number; readonly blessed?: number }
  /** 소도 제사 — 봄은 그해 수확, 가을은 군대 사기 */
  | { readonly kind: 'rite'; readonly faction: string; readonly season: 'spring' | 'autumn' }
  /** 장터 — 화친·동맹인 두 나라가 이번 계절 곡식을 얻었다 (둘 다 grain 씩) */
  | { readonly kind: 'market'; readonly a: string; readonly b: string; readonly grain: number }
  | { readonly kind: 'draft'; readonly faction: string; readonly node: string; readonly unit: UnitKind; readonly n: number; readonly army: string }
  | { readonly kind: 'disband'; readonly army: string; readonly node: string; readonly n: number }
  | { readonly kind: 'settle'; readonly faction: string; readonly from: string; readonly to: string; readonly n: number }
  | { readonly kind: 'hunger'; readonly faction: string }
  | { readonly kind: 'envoy'; readonly from: string; readonly to: string; readonly ask: EnvoyAsk; readonly accepted: boolean; readonly why?: Why; readonly about?: string }
  /** 화친·동맹을 맺어 상대 땅으로 가던 군대가 발길을 돌렸다 — `node` 는 가려던 고을 */
  | { readonly kind: 'recall'; readonly faction: string; readonly army: string; readonly node: string }
  /** 함께 치자는 약속을 지켰나 저버렸나 — `from` 이 약속한 나라, `to` 가 약속받은 나라 */
  | { readonly kind: 'pledge'; readonly from: string; readonly to: string; readonly node: string; readonly kept: boolean }
  /** 군대를 빌려줬다 (`army` 가 `to` 의 `node` 를 지키러 간다) · 돌아갔다 (back) */
  | { readonly kind: 'lent'; readonly from: string; readonly to: string; readonly node: string; readonly army: string; readonly back: boolean }
  /** 무장을 올렸다 */
  | { readonly kind: 'arm'; readonly faction: string; readonly army: string; readonly equip: Equip; readonly iron: number }
  | { readonly kind: 'relation'; readonly a: string; readonly b: string; readonly state: Relation['state'] }
  | { readonly kind: 'end'; readonly outcome: 'win' | 'lose'; readonly faction: string }
  /** 우리 고을에 맞닿은 길 위의 남의 군대 — 행군은 보인다 (FLOW §7 #2) */
  /** `suspect` — 우리 고을로 오는 기습을 낌새챘다 (경계·굴림). 못 챘으면 그냥 행군으로 보인다 */
  | { readonly kind: 'sighted'; readonly faction: string; readonly army: string; readonly from: string; readonly to: string; readonly suspect?: boolean }
  /** 새 청이 왔다 — 다음 계절에 답한다 */
  | { readonly kind: 'ask'; readonly ask: Ask }
  /** 청에 답했다 (답이 없어 거절로 친 것도) */
  | { readonly kind: 'answered'; readonly ask: string; readonly yes: boolean; readonly from: string; readonly askKind: AskKind }
  /** 경계 강화 */
  | { readonly kind: 'guard'; readonly faction: string; readonly node: string }
  /** 공작의 결과. 당한 쪽이 플레이어면 화면은 들켰을 때만 누가 했는지 보인다 */
  | {
      readonly kind: 'plot'
      readonly faction: string
      readonly op: PlotOp
      readonly target: string
      readonly node?: string
      readonly other?: string
      readonly ok: boolean
      readonly caught: boolean
      /** 암살 — 노린 장수 · 보낸 자객(없으면 고용 자객) · 먹혔으면 다쳤나 죽었나 */
      readonly hero?: string
      readonly agent?: string
      readonly result?: 'wound' | 'kill'
    }
  /** 누가 했는지 모르는 일 — 당한 나라의 눈 (사기가 꺾였다 · 곡식이 탔다 · 장정이 안 나왔다) */
  | { readonly kind: 'mystery'; readonly faction: string; readonly what: 'morale' | 'grain' | 'militia' | 'wound' | 'death'; readonly node?: string; readonly hero?: string }
  /** 장수가 들어왔다 — 회유가 끝났거나 떠돌이를 들였다 */
  | { readonly kind: 'recruit'; readonly hero: string; readonly faction: string; readonly how: 'persuade' | 'wanderer' }
  /** 장수가 자랐다 — 능력치 하나가 한 단계 (HEROES §6) */
  | { readonly kind: 'grow'; readonly hero: string; readonly stat: GrowStat }
  /** 정이 문턱을 넘었다 — 믿는 장수가 됐다 */
  | { readonly kind: 'bond'; readonly hero: string; readonly tier: 'trust' }
  /** 정이 다 차서 특성 하나에 눈떴다 */
  | { readonly kind: 'awaken'; readonly hero: string; readonly trait: string }
  /** 떠돌이 인재가 그 고을에 나타났다 — 고을 주인이 until 계절까지 들일 수 있다 */
  | { readonly kind: 'wanderer'; readonly hero: string; readonly node: string; readonly until: number; readonly price: number }
  /** 맡긴 장수가 고을을 잃어 물러났다 · 사로잡혔다 */
  | { readonly kind: 'heroMoved'; readonly hero: string; readonly faction: string; readonly to: string | null; readonly captor: string | null }

export interface Report {
  readonly season: number
  readonly lines: readonly ReportLine[]
}
