/**
 * 나라(realm)의 상태 — 판 하나 (docs/realm/SYSTEMS.md §0 · BUILD §1-2)
 *
 * **JSON 으로 그대로 직렬화되는 평범한 객체**만 쓴다 — 클래스·함수·Map 금지.
 * 그래야 저장·비교·리플레이가 공짜다 (BUILD §1-2). 모음은 배열이 아니라 id 를 열쇠로 한 기록이다.
 *
 * R1 의 범위: 지도 · 세력 · 장수 · 군대 · 정보 · 경계.
 * R1.5 (FLOW, 2026-10-18): 가호·창고(곡식·철) · 징병·해산 · 관계·사신 · 이김·짐. 사건·회유는 R3~R4.
 */
import type { Equip, Kit, Outcome, UnitKind } from './battle.ts'
import type { Source } from './intel.ts'

/** 계절 번호 0 = 첫해 봄. 계절 = 번호 % 4 */
export type SeasonOfYear = 'spring' | 'summer' | 'autumn' | 'winter'

/** 고을 종류 (SYSTEMS §1-1) */
export type NodeKind = 'capital' | 'village' | 'sodo' | 'port' | 'fort' | 'ironMine' | 'wild'

/**
 * 지형 꼬리표 (SYSTEMS §1-2) — 화면에는 숫자가 아니라 문장으로 나간다 (data/prose).
 * 규칙에 걸리는 것만 둔다; 늘릴 때는 SYSTEMS §1-2 표에 먼저 적는다.
 */
export type Tag = 'reeds' | 'shallows' | 'pines' | 'high' | 'palisade' | 'moat' | 'fog' | 'iron' | 'sodo' | 'pasture'

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
  /** 억지로 이주시킨 고을 — 이 계절까지 집이 늘지 않는다 (economy.migrateHouses · 형: "강제이주"). 없으면 없음 */
  uprooted?: number
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
  /** 집 자동 분배를 껐다 (economy.stepMigration). 없으면 켜짐 — 옛 판도 켜짐. AI 는 늘 켜짐 */
  migrateOff?: boolean
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

/**
 * 한 나라의 창고 — 국읍 창고 (SYSTEMS §7-5). 곡식·철에 땅마다 나는 소금·나무·말
 * (형: "자원들도 다각화해야할거같은데 — 뭘하든 돈만쓰면 되는게 맞나" · "갯마을은 철이 안나는 지역인가?").
 * 소금·나무·말은 옛 저장에 없다 — 없으면 0 (economy.goodOf).
 *   소금 — 바닷가에서 난다. 겨울에 곡식이 썩지 않게 하고, 멀리 나간 군대의 양식을 아낀다. 뭍의 나라가 탐낸다
 *   나무 — 솔숲·산·숲길 고을에서 난다. 목책·해자를 짓고, 배(수군)를 만들고, 빈땅을 일군다
 *   말   — 너른 들(목장)에서 난다. 기병을 뽑는다. 변한엔 드물다
 */
export interface Stock {
  grain: number
  iron: number
  salt?: number
  wood?: number
  horse?: number
}

/** 창고의 것 다섯 */
export type Good = 'grain' | 'iron' | 'salt' | 'wood' | 'horse'

/**
 * 사이가 바뀐 까닭 — attack 땅에 군대를 들였다 · betray 화친·동맹을 깨고 쳤다 · distrust 남의 배신을 보고 등 돌렸다 ·
 * plot 공작이 드러났다 · sow 이간에 넘어갔다 · tribute 조공 요구를 거절당했다 · demand 요구를 거절당했다 · break 약조를 깼다 · expire 기한이 끝났다 · envoy 사신이 맺었다
 */
export type RelationWhy = 'attack' | 'betray' | 'distrust' | 'plot' | 'sow' | 'tribute' | 'demand' | 'break' | 'expire' | 'envoy'

/** 판 — 변한 6국 축소판 · 영남 판 (형: "사료대로 키우고 땅도 넓힘" — 2026-10-18) */
export type RegionId = 'byeonhan-mini' | 'yeongnam' | 'south' | 'world'

/** 발견의 길 — 어떻게 그 나라를 알게 됐나 (discovery.ts · 형: "시간지나서 발견국가가 많아지면 확장하는거지 지도도") */
export type DiscoverHow = 'border' | 'envoy' | 'market' | 'war' | 'spy' | 'scout' | 'ally' | 'rumor'

/** 주고받는 몫 — 사신·청·선물. 곡식·철은 늘 있고 나머지는 없으면 0 */
export interface Goods {
  readonly grain: number
  readonly iron: number
  readonly salt?: number
  readonly wood?: number
  readonly horse?: number
}

/**
 * 사신이 청하는 것. 관계마다 할 수 있는 것이 다르다 (diplomacy.envoyOptions):
 *   gift 선물 · joint 함께 치자(동맹) · aid 지원 요청(동맹) · troops 군대 빌리기(동맹) · break 화친·동맹을 깬다
 */
export type EnvoyAsk = 'truce' | 'trade' | 'tribute' | 'alliance' | 'gift' | 'joint' | 'aid' | 'troops' | 'break'

/**
 * 밤 판의 손 — 직접 쏜 결과(dead·wounded·fled·withdrew) 또는 건너뛰기(skip: 자객 솜씨로 굴린다).
 * 건너뛰기의 `seen` 은 진짜 지붕을 본 뒤에 맡겼나 — 그러면 굴림이 plotSkipSeenMul 만큼 준다 (보고 고르는 맛을 막는다)
 */
export interface Hand {
  readonly result: 'dead' | 'wounded' | 'fled' | 'withdrew' | 'skip'
  readonly alarm: boolean
  readonly seen?: boolean
}

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
  /** 사신을 따라 나갔다 — 이 계절까지 자리를 비운다 (맡은 고을에 손이 안 간다) */
  awayUntil?: number
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
  /** 기습으로 들어가는가 — 아니면 정면 (S = 1.0). approach 가 대로가 아니면 참 */
  readonly ambush: boolean
  /** 진군 방식 (tactics.ts) — 없으면 옛 판: ambush 면 밤길, 아니면 대로 */
  readonly approach?: Approach
  /** 계절에 막힌 길을 억지로 간다 — 눈 덮인 고개 · 불어난 나루 (사람·사기를 잃었다) */
  readonly hard?: 'winterPass' | 'summerFord'
}

/**
 * 진군 방식 (형: "강을 도하해 기습 · 대로로 행군 · 산기슭으로 · 절벽을 올라간다" 2026-10-19) — tactics.approachOptions
 *   road 대로 — 드러내 놓고 간다. 기습이 없고 질서 있게 닿는다
 *   night 밤길 — 어둠을 타고 숨어 닿는다 (옛 '기습')
 *   ford 여울 건너기 — 강 있는 길만. 먹히면 성·장정을 건너뛰고, 들키면 물 한가운데서 맞는다
 *   ridge 산기슭 돌기 — 한 계절 더 걸리지만 잘 숨고, 먹히면 뒤를 친다
 *   cliff 절벽 타기 — 산성·높은 터만. 소수 정예일수록 잘 되고, 먹히면 성을 넘는다. 떨어지면 크게 잃는다
 */
export type Approach = 'road' | 'night' | 'ford' | 'ridge' | 'cliff'

/** 챙길 군량 — 가볍게(곡식이 안 들지만 닿자마자 바닥 — 싸울 때 오래 못 버틴다) · 넉넉히(곡식이 든다) */
export type Ration = 'light' | 'full'

/**
 * 싸움의 명령 (tactics.ts — 형: "포켓몬이나 가위바위보식 상성 · 포획시도는 유저가 직접" 2026-10-19)
 *   세모: 돌격 charge > 화살비 volley > 방진 hold > 돌격
 *   한 번씩: 옆치기 flank · 불 fire · 일기토 duel
 *   사로잡기 capture · 물러나기 retreat
 */
export type Cmd = 'charge' | 'hold' | 'volley' | 'flank' | 'fire' | 'duel' | 'capture' | 'retreat'

/** 라운드 하나의 기록 — 화면이 그대로 풀어 보인다. n 은 처음 사람의 몫 0~1, m 은 사기 */
export interface RoundLog {
  readonly a: Cmd
  readonly d: Cmd
  /** 세모에서 이긴 쪽 */
  readonly beat: 'a' | 'd' | null
  /** 이번 라운드에 공격 쪽이 민 몫 0~1 */
  readonly push: number
  readonly na: number
  readonly nd: number
  readonly ma: number
  readonly md: number
  /** 이 라운드의 큰일 */
  readonly ev?: 'capture-ok' | 'capture-fail' | 'duel-win' | 'duel-lose' | 'fire-ok' | 'fire-back' | 'retreat'
  /** ev 를 낸 쪽 */
  readonly by?: 'a' | 'd'
}

/**
 * 플레이어가 고른 싸움 명령 — advance 의 tactics[battleKey] (snipes 와 같은 길).
 * cmds[i] 가 i 라운드의 명령. 모자라면 맡긴다(AI 가 고른다).
 * open 이면 모자란 데서 다음 고를 것을 pending 에 적는다 (전장 화면의 시험 돌림) — 나머지는 맡긴 것으로 끝까지 돈다
 */
export interface Tactic {
  readonly cmds: readonly Cmd[]
  readonly open?: boolean
}

/** 전장 화면이 다음 라운드를 고를 때 보는 것 — 시험 돌림(open)에서만 나온다 */
export interface Pending {
  readonly round: number
  /** 고를 수 있는 명령 */
  readonly options: readonly Cmd[]
  /** 명령마다 우리 세기 (0.4~2 쯤 — 화면은 말·색으로) */
  readonly might: Readonly<Partial<Record<Cmd, number>>>
  /** 사로잡기 확률 — 적장이 없으면 0 (화면은 말·색으로) */
  readonly capture: number
  /** 적의 낌새 — 다음 명령을 이것으로 짐작한다 (틀릴 수 있다) */
  readonly hint: Cmd | null
  /** 우리가 공격 쪽인가 */
  readonly weAtk: boolean
  /** 낌새가 척후·눈으로 본 것인가 (아니면 짐작) */
  readonly seen: boolean
}

/** 싸움이 시작될 때 — 사람 수 · 사기 · 이끄는 장수 (공격, 지킴). 전장 화면이 막대의 처음으로 쓴다 */
export interface BattleStart {
  readonly men: readonly [number, number]
  readonly morale: readonly [number, number]
  readonly heroes: readonly [string | null, string | null]
}

export interface Army {
  readonly id: string
  readonly faction: string
  hero: string | null
  /** 병종별 사람 수 — 합이 병력 N */
  mix: Partial<Record<UnitKind, number>>
  /** @deprecated 옛 화면 값 — 가장 많은 사람이 든 단계 (kit.syncKit 가 다시 셈한다). 판정은 kit 를 쓴다 */
  equip: Equip
  /** 병종마다 무장 — 병종 → 단계 → 사람 수. 병종마다 합 = mix (kit.ts). 없으면 equip 하나로 다 든 것으로 본다 (옛 저장) */
  kit?: Kit
  morale: number
  /** 머무는 고을 (행군 중이면 떠난 고을) */
  at: string
  march: March | null
  /** 남은 군량 (계절치) — 제 땅·동맹 땅에선 다시 찬다. 없으면 넉넉한 것으로 본다 (옛 판) */
  food?: number
  /** 동맹에게 빌려준 군대 — `to` 나라의 `node` 고을로 가서 `until` 계절까지 머물며 지킨다 (diplomacy troops). 그동안 AI 가 마음대로 안 움직인다 */
  lent?: { readonly to: string; readonly node: string; readonly until: number }
}

/** 한 세력이 한 고을에 대해 아는 것 (SYSTEMS §2-1 세 겹 가운데 땅·군세) */
export interface NodeIntel {
  /** 땅 — 한 번 보면 안 낡는다 */
  land: boolean
  /** 군세 — 그때의 참 전투력 · 출처 · u · 본 계절. 없으면 본 적 없음 */
  force: { f0: number; src: Source; u: number; season: number; mix?: Partial<Record<UnitKind, number>> } | null
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
  readonly give: Goods
  readonly take: Goods
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
  /** 이긴 뒤에도 계속 둔다 — 남은 나라까지 (형: "이어서 진행해서 전부 점령하고 싶은 마음도"). 화면의 일이라 판정은 안 바뀐다 */
  endless?: boolean
  /** 계속 둬서 도읍을 모두 쥔 계절 */
  unified?: number
  /** 봄 제사를 지낸 해 (Math.floor(season / 4)) — 나라마다. 그해 가을 수확이 는다 (economy.riteAllowed). 옛 저장에는 없다 */
  blessed?: Record<string, number>
  /** 답을 기다리는 청 (diplomacy.openAsks). 옛 저장에는 없다 */
  asks?: Ask[]
  /** 나라마다 심어 둔 첩자 (plots.ts spy). 옛 저장에는 없다 */
  spies?: Record<string, Spy[]>
  /** 나라마다 자객의 활 단계 0..3 (plots.assassinBow). 옛 저장에는 없다 — 0 */
  assassinBow?: Record<string, number>
  /**
   * 붙잡혔지만 누가 보냈는지 입을 다문 자객 장수 — 장수 id → 보낸 나라 · 잡은 나라 (plots.ts).
   * 계절마다 실토할 수 있다(P.realm.plotConfess). 풀려나거나 죽으면 지운다. 옛 저장에는 없다
   */
  hiddenAgents?: Record<string, { readonly from: string; readonly to: string }>
  /** 지금 떠도는 인재 (heroes.ts) · 이미 나온 명단 id */
  wanderers?: Wanderer[]
  poolUsed?: string[]
  /** 나라마다 능력치를 본 남의 장수 — 싸워 봤거나 정찰·첩자로 봤다 (heroes.heroSeen) */
  met?: Record<string, string[]>
  /**
   * 사람의 눈금 (형: "가구수랑 징병량이 … 실제로 이 시대에 이 수준이었나?" — 위서 동이전: 변진 큰 나라 4~5천 가).
   * 이 판의 가호·군사가 옛 판의 몇 배인가 — 옛 저장(없음 = 1)은 migrate.ts 가 키운다
   */
  scale?: number
  /** 어느 판인가 — 변한 6국 축소판(없으면 이것) · 영남 판 (data/regions/index.ts) */
  region?: RegionId
  /** 짓는 중 — 이 계절 끝에 그 고을 꼬리표가 된다 (economy.applyBuild · stepBuilds) */
  builds?: Array<{ readonly faction: string; readonly node: string; readonly what: BuildWhat; readonly done: number }>
  /**
   * 발견 (2026-10-19) — 나라마다 아는 나라 id (id 순서). 없으면(옛 판 · 변한·영남 판) 모두 안다.
   * 삼한 남부 판은 제 나라와 이웃만 알고 시작한다 (discovery.ts)
   */
  known?: Record<string, string[]>
}

/** 플레이어(또는 AI)가 한 계절에 내리는 명령 */
export type Order =
  | { readonly kind: 'march'; readonly army: string; readonly edge: string; readonly ambush: boolean; readonly approach?: Approach; readonly ration?: Ration }
  /** 전장에서 직접 내린 명령 — 그 판(key)의 라운드마다 (advance 가 tactics 로 받는다 · 판 기록에 남아 다시 돌려도 같다) */
  | { readonly kind: 'command'; readonly key: string; readonly cmds: readonly Cmd[] }
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
  /** 이주 — 제 고을 `from` 의 집 n 을 제 땅으로 이어진 제 고을 `to` 로 억지로 옮긴다. 곡식이 들고 두 고을은 한동안 집이 안 는다 (economy.migrateLimit) */
  | { readonly kind: 'migrate'; readonly faction: string; readonly from: string; readonly to: string; readonly n: number }
  /** 집 자동 분배 켜기·끄기 (Faction.migrateOff) */
  | { readonly kind: 'migrateAuto'; readonly faction: string; readonly on: boolean }
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
      readonly hand?: Hand
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
      readonly give: Goods
      readonly take: Goods
      /** joint — 함께 칠 고을 · troops — 빌린 군대가 지킬 우리 고을 */
      readonly target?: string
      /**
       * 사신과 함께 가는 장수 (형: "장사꾼 장수는 특별히 뭘 할 수 없잖아. 사신 보낼 때 같이 보내는 것도 아니고") —
       * 그 장수의 매력·매혹·장사꾼이 이 사신에 걸린다. 그 계절엔 군대를 못 이끌고 고을도 못 맡는다 (다음 계절에 돌아온다)
       */
      readonly hero?: string
      /** AI 가 보낸 사신의 까닭 (stance.ts) — 보고에 말로 */
      readonly why?: Why
      readonly about?: string
    }
  /** 무장 올리기 (철의 쓰임) — unit 이 있으면 그 병종 가운데 가장 낮은 무장을 한 단계, 없으면 병종마다 그렇게 (economy.armCost · kit.upgradeKind) */
  | { readonly kind: 'arm'; readonly army: string; readonly unit?: UnitKind }
  /** 짓기 (나무의 쓰임) — 제 고을에 목책 또는 (목책이 있으면) 해자. 나무·곡식이 들고 다음 계절부터 선다 (economy.buildCost) */
  | { readonly kind: 'build'; readonly faction: string; readonly node: string; readonly what: BuildWhat }
  /** 자객의 활을 한 단계 올린다 — 곡식·철이 크게 든다 (plots.bowUpCost) */
  | { readonly kind: 'bowUp'; readonly faction: string }

/** 지을 수 있는 것 — 그 고을 꼬리표가 된다 */
export type BuildWhat = 'palisade' | 'moat'

/**
 * 첩보 (형: "속셈은 … 간접정보로 전달받아야함. 첩보로 뭔가 철광이 새로 생겼다거나 그런거") — 첩자가 그 나라에서 듣고 본 것.
 *   hungry 곡식이 바닥나 간다 · hoard 무엇을 쌓는다(good) · settled 새 마을을 일궜다(node) · drafting 군사를 모은다 ·
 *   seekAlly ○○와 손잡으려 한다(other) · seekTruce ○○와 화친을 바란다(other) · armed 무장을 올렸다 · building 무엇을 짓는다(node)
 */
export type RumorFact = 'hungry' | 'hoard' | 'settled' | 'drafting' | 'seekAlly' | 'seekTruce' | 'armed' | 'building'

/** 직접 쏜 저격의 결과 — 판 열쇠(battleKey)마다. R1 에는 저격이 없어 비어 있다 (SNIPE · SYSTEMS §6) */
export type SnipeZone = 'head' | 'body' | 'leg' | 'drum' | 'miss'

/** 보고의 한 줄 — 글은 ui 가 짓는다. 여기는 무슨 일이 있었는지만 */
export type ReportLine =
  | { readonly kind: 'scout'; readonly faction: string; readonly node: string; readonly detected: boolean }
  /** 막힌 길 — lost 가 있으면 억지로 떠나 그만큼 잃었다 (2026-10-19 부터). 없으면 옛 보고: 떠나지 못했다 */
  | { readonly kind: 'blocked'; readonly army: string; readonly edge: string; readonly why: 'winterPass' | 'summerFord'; readonly lost?: number }
  /** 군량이 떨어졌다 — 사기가 꺾이고 lost 명이 빠졌다 */
  | { readonly kind: 'hungry'; readonly army: string; readonly lost: number }
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
      /** 라운드마다 (tactics.ts) — 옛 보고에는 없다 */
      readonly rounds?: readonly RoundLog[]
      /** 앞선 군대의 진군 방식 · 절벽에서 떨어졌나 */
      readonly approach?: Approach
      readonly fell?: boolean
      /** 판의 열쇠 (season.battleKey · 들판이면 fieldKey) */
      readonly key?: string
      /** 시험 돌림(open)에서 멈춘 자리 */
      readonly pending?: Pending
      /** 플레이어가 직접 명령을 낸 판인가 */
      readonly led?: boolean
      readonly start?: BattleStart
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
  /** 집이 옮겨 갔다 — auto 면 붐비는 고을에서 저절로, 아니면 억지 이주 */
  | { readonly kind: 'migrate'; readonly faction: string; readonly from: string; readonly to: string; readonly n: number; readonly auto?: boolean }
  | { readonly kind: 'hunger'; readonly faction: string }
  | { readonly kind: 'envoy'; readonly from: string; readonly to: string; readonly ask: EnvoyAsk; readonly accepted: boolean; readonly why?: Why; readonly about?: string; readonly hero?: string }
  /** 화친·동맹을 맺어 상대 땅으로 가던 군대가 발길을 돌렸다 — `node` 는 가려던 고을 */
  | { readonly kind: 'recall'; readonly faction: string; readonly army: string; readonly node: string }
  /** 함께 치자는 약속을 지켰나 저버렸나 — `from` 이 약속한 나라, `to` 가 약속받은 나라 */
  | { readonly kind: 'pledge'; readonly from: string; readonly to: string; readonly node: string; readonly kept: boolean }
  /** 군대를 빌려줬다 (`army` 가 `to` 의 `node` 를 지키러 간다) · 돌아갔다 (back) */
  | { readonly kind: 'lent'; readonly from: string; readonly to: string; readonly node: string; readonly army: string; readonly back: boolean }
  /** 무장을 올렸다 */
  | { readonly kind: 'arm'; readonly faction: string; readonly army: string; readonly equip: Equip; readonly iron: number; readonly unit?: UnitKind; readonly n?: number }
  /**
   * 두 나라 사이가 바뀌었다. `by` — 먼저 그렇게 만든 나라 (전쟁을 건 쪽 · 깬 쪽), `why` — 까닭
   * (형: "누가 나랑 전쟁나면 상대가 걸어왔다는걸 알려줘야지... 그냥무작정 전쟁이다라 그러면 어떡하냐"). 옛 기록엔 없다
   */
  | { readonly kind: 'relation'; readonly a: string; readonly b: string; readonly state: Relation['state']; readonly by?: string; readonly why?: RelationWhy }
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
  /** 짓기 — 시작했다(done false) · 섰다(done true) */
  | { readonly kind: 'build'; readonly faction: string; readonly node: string; readonly what: BuildWhat; readonly done: boolean }
  /** 겨울에 소금이 모자라 곡식이 썩었다 */
  | { readonly kind: 'spoil'; readonly faction: string; readonly grain: number }
  /** 첩보 — `viewer` 의 첩자가 `about` 나라에서 들은 것 (보는 나라에게만) */
  /** 새 나라를 알게 됐다 — `faction` 이 `nation` 을 `how` 길로 (discovery.ts) */
  | { readonly kind: 'discover'; readonly faction: string; readonly nation: string; readonly how: DiscoverHow }
  | { readonly kind: 'rumor'; readonly viewer: string; readonly about: string; readonly fact: RumorFact; readonly good?: Good; readonly node?: string; readonly other?: string }
  /** 공작의 결과. 당한 쪽이 플레이어면 화면은 들켰을 때만 누가 했는지 보인다 */
  | {
      readonly kind: 'plot'
      readonly faction: string
      readonly op: PlotOp
      readonly target: string
      readonly node?: string
      readonly other?: string
      readonly ok: boolean
      /** 들켰다 — 당한 나라가 일이 있었음을 안다 (경계가 오른다) */
      readonly caught: boolean
      /**
       * 누가 보냈는지까지 드러났다 (caught 일 때만 참일 수 있다) — 그때만 사이·호감이 나빠진다.
       * 옛 줄에는 없다 — 그때는 들킴이 곧 드러남이었다 (caught 와 같다고 본다)
       */
      readonly exposed?: boolean
      /** 암살 — 노린 장수 · 보낸 자객(없으면 고용 자객) · 먹혔으면 다쳤나 죽었나 */
      readonly hero?: string
      readonly agent?: string
      readonly result?: 'wound' | 'kill'
      /** 들킨 자객 장수의 끝 — 도망쳤다 · 사로잡혔다 (고용 자객이면 없다 — 값만 잃는다) */
      readonly agentFate?: 'escaped' | 'captured'
    }
  /** 붙잡혀 입을 다물던 자객 장수가 실토했다 — 이제 누가 보냈는지 안다 (plots.ts) */
  | { readonly kind: 'confess'; readonly hero: string; readonly from: string; readonly to: string }
  /** 자객의 활을 한 단계 올렸다 (plots.bowUp) — 0 단궁 · 1 맥궁 · 2 각궁 · 3 신궁 */
  | { readonly kind: 'bowUp'; readonly faction: string; readonly tier: number }
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
