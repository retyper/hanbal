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
import type { CardKind } from './data/cards.ts'
import type { CustomId } from './data/customs.ts'

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
  /** 이번 계절 이 고을에서 억지로 내보낸 집 — 한 계절 몫(migrateShare)을 여러 번 나눠 눌러도 넘지 않게 */
  movedOut?: { readonly season: number; readonly n: number }
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
  /** 풍습 (data/customs.ts · CUSTOMS.md §7) — 없으면 제 결의 풍습 둘. 섞임으로 받거나 버리면 여기 적힌다 */
  customs?: CustomId[]
  /**
   * 도읍을 잃고 피한 조정 (형: "내도읍 뺏기자마자 지는건 좀 오바") — since 계절부터 seat 고을에서 버틴다.
   * exileSeasons 안에 도읍을 되찾으면 사라지고, 못 되찾거나 고을을 다 잃으면 진다 (season.stepExile)
   */
  exile?: { since: number; seat: string }
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
  /** 조공하는 사이 — 이 쌍의 한쪽이 `lord` 에게 `until` 계절까지 조공한다 (맹주의 길 — suzerain.ts). 전쟁이 나면 끊긴다 */
  vassal?: { readonly lord: string; readonly until: number }
  /** 두 나라 사이에 있었던 일 — 새것이 뒤, 오래된 것부터 걷는다 (P.realm.deedsKeep). 나라 카드의 "우리 사이에 있었던 일" */
  deeds?: Deed[]
}

/**
 * 나라 사이에 있었던 일 하나 — `by` 가 한 일 (형: "이나라가 나한테 잘못한일 잘한일 … 언제 그랬는지와 함께").
 *   rel 사이가 바뀜(st·why) · take 고을을 빼앗음(n) · yes/no 청을 들어줌·물리침(ask) · gift 선물 ·
 *   kept/broke 함께 치자는 약속을 지킴·어김(n) · plot 공작이 들킴
 */
export interface Deed {
  readonly s: number
  readonly by: string
  readonly k: 'rel' | 'take' | 'yes' | 'no' | 'gift' | 'kept' | 'broke' | 'plot'
  readonly st?: Relation['state']
  readonly why?: RelationWhy
  readonly n?: string
  readonly ask?: string
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
/** 판 — tutorial 은 배우는 1:1 판 (변한 축소판의 지도를 빌린다) */
export type RegionId = 'tutorial' | 'mahan' | 'jumong' | 'seorabeol' | 'byeonhan-mini' | 'yeongnam' | 'south' | 'world'

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
  /**
   * 회유 — resist 는 남은 마음의 벽(림월드의 저항). 계절마다 깎이고, 다 깎인 뒤엔 계절마다 넘어올지 굴린다 (heroes.stepHeroes).
   * left 는 옛 판의 남은 계절 (resist 가 없으면 그대로 센다)
   */
  persuade?: { by: string | null; left: number; resist?: number; tries?: number }
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
  /** 혼인한 짝 (혈통 — heroes.wed · SYSTEMS §5-10). 한 사람은 한 번 */
  spouse?: string
  /** 부모 — 혼인에서 난 자식 장수 */
  parents?: readonly [string, string]
}

/** 사건 카드 한 장 (events.ts · data/cards.ts) — season 계절에 답한다. hero·hero2·node 는 카드에 붙은 사람·고을 */
export interface Card {
  readonly kind: CardKind
  readonly season: number
  readonly hero?: string
  readonly hero2?: string
  readonly node?: string
}

/** 원정 한 번 — back 계절에 돌아와 got 을 푼다 */
export interface Expedition {
  readonly hero: string
  readonly faction: string
  readonly dest: ExpDest
  readonly len: 0 | 1 | 2
  readonly back: number
  readonly got: ExpGot
}
export type ExpDest = 'wa' | 'juho' | 'neukdo' | 'north' | 'hills'
/** 원정에서 얻은 것 — 철 · 곡식 · 떠돌이 장수 · 낯선 재주(특성) · 빈손 */
export type ExpGot =
  | { readonly kind: 'iron' | 'grain'; readonly n: number }
  | { readonly kind: 'wanderer'; readonly hero: string }
  | { readonly kind: 'skill'; readonly trait: string }
  | { readonly kind: 'none' }

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
  /** 뒤따른다 — 같은 고을을 치는 다른 우리 군대 뒤에서 원군으로 몇 합 늦게 들이친다 (형 10-25) */
  readonly follow?: boolean
  /**
   * 떠날 때 그 고을의 주인 (null = 빈땅). 가는 사이 싸우지 않는 다른 나라 땅이 됐으면 들어가지 않고 돌아선다 —
   * 빈땅을 일구러 갔다가 남이 먼저 쥔 땅에 "우리가 군대를 들였다"가 되던 것 (형: "전쟁시도하지 않았는데 왜"). 없으면 옛 판 — 그대로 들어간다
   */
  readonly aim?: string | null
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
/**
 * 군량 — 길 계절에 더해 챙기는 계절 수(0 = 길 계절만, 닿자마자 바닥). 옛 명령의 'light'·'full' 도 받는다 (0 · rationReserve)
 * (형: "군량은 넉넉히랑 안듦 두개밖에 없는데 이거 기본수치로 주고 줄일수 있게 해야할듯")
 */
export type Ration = 'light' | 'full' | number

/**
 * 싸움의 명령 (tactics.ts — 형: "포켓몬이나 가위바위보식 상성 · 포획시도는 유저가 직접" 2026-10-19)
 *   세모: 돌격 charge > 화살비 volley > 방진 hold > 돌격
 *   한 번씩: 옆치기 flank · 불 fire · 장수 겨루기 duel
 *   사로잡기 capture · 물러나기 retreat
 */
export type Cmd =
  // 앞줄(창·방패) — 돌격 · 방진 · 길 트기 · 땅의 수: 여울 막기 · 바위 굴리기 · 성문 깨기 · 배 들이받기
  | 'charge' | 'hold' | 'open' | 'ford' | 'rocks' | 'gate' | 'ram'
  // 활 — 화살비(적 앞줄) · 맞쏘기(적 활) · 불화살 · 높은 곳
  | 'volley' | 'counter' | 'fire' | 'height'
  // 말 — 옆치기 · 돌파 · 추격 · 호위
  | 'flank' | 'punch' | 'pursue' | 'guard'
  // 장수 — 북을 친다(그냥 지휘) · 장수 겨루기 · 적장 사로잡기 · 물러나기 · 그 장수만의 비기(한 판에 한 번 — Art) · 호궤(곳간의 곡식을 풀어 먹인다 — 한 판에 한 번)
  | 'drum' | 'duel' | 'capture' | 'retreat' | 'art' | 'feast'

/**
 * 장수의 비기 — 장수마다 하나, 한 판에 한 번 (형 2026-10-20: "장수스킬 장수가 있건없건 똑같나?? 싸우는 장수의 특별한 액티브 스킬이 있다면
 * 아이콘과 함께 그거라는걸 알게 해줘야함"). 특성이 먼저, 없으면 가장 높은 능력치(7 이상)에서 (heroes.heroArt).
 *   snipe 명궁의 한 발 · rite 진중 굿 · sway 항복 권유 · stand 버텨라 · ambush 샛길 기습 · vanguard 선봉에 선다 · feint 거짓 퇴각 · order 진을 다잡는다 · shout 큰 외침
 */
export type Art = 'snipe' | 'rite' | 'sway' | 'stand' | 'ambush' | 'vanguard' | 'feint' | 'order' | 'shout'

/**
 * 전투 2판 (docs/realm/BATTLE.md §전투 2판 · 형 2026-10-19: "어떤 군대가 창병움직이면 다른애들 가만있냐. 각자 행동 컨트롤") —
 * 군대를 세 무리로 나눠 깃발마다 따로 부린다: 앞줄(창·방패·긴창 · 물 위의 배) · 활(궁수·쇠뇌) · 말(기병).
 */
export type Grp = 'front' | 'bows' | 'horse'

/** 한 합의 명령 — 무리마다 하나 + 장수의 명령 하나. 빠진 무리는 맡긴다 */
export interface RoundOrder {
  readonly front?: Cmd
  readonly bows?: Cmd
  readonly horse?: Cmd
  readonly lead?: Cmd
  /** 장수의 명령을 낼 우리 장수 — 비기·겨루기 (없으면 총대장, 비기는 아직 안 쓴 장수부터) */
  readonly who?: string
  /** 사로잡을 적장 (없으면 적의 총대장) */
  readonly target?: string
}

/**
 * 한 합에서 일어난 일 하나 — 누가(s · g) 몇이(n) 무엇을(c) 누구에게(tg) 해서 어떻게 됐나(res) · 상대가 잃은 사람(tl) · 우리가 잃은 사람(sl).
 * 화면은 이것으로 "우리 기병 120이 왼쪽으로 돌아 적 궁수를 쳤다. 적 궁수 30이 쓰러졌다" 를 짓는다 (prose.roundStory)
 */
export interface Act {
  readonly s: 'a' | 'd'
  readonly g: Grp | 'lead'
  readonly c: Cmd
  readonly n: number
  readonly tg?: Grp | 'lead'
  readonly tl?: number
  readonly sl?: number
  readonly res: 'won' | 'lost' | 'even' | 'hit' | 'blocked' | 'wasted' | 'ok' | 'fail' | 'stall'
  /** 사로잡기 — 적장 곁 호위 */
  readonly guard?: number
  /** 장수의 비기 — c 가 'art' 일 때 무엇 */
  readonly art?: Art
  /** 나선 장수 (비기 · 겨루기 · 사로잡힌 이) */
  readonly hero?: string
}

/** 라운드 하나의 기록 — 화면이 그대로 풀어 보인다. n 은 처음 사람의 몫 0~1, m 은 사기 */
export interface RoundLog {
  /** 이 합 처음에 원군이 닿았다 — 그 쪽 · 닿은 사람 · 기병이 있었나 (tactics.fightRounds · 형: "로한의 기병대 같은 쾌감") */
  readonly relief?: { readonly side: 'a' | 'd'; readonly men: number; readonly horse: boolean }
  /** 그 합의 앞줄 명령(앞줄이 없으면 장수·활·말의 것) — 요약 칩 */
  readonly a: Cmd
  readonly d: Cmd
  /** 세모에서 이긴 쪽 */
  readonly beat: 'a' | 'd' | null
  /** 이번 라운드에 공격 쪽이 민 몫 0~1 (잃은 사람으로) */
  readonly push: number
  readonly na: number
  readonly nd: number
  readonly ma: number
  readonly md: number
  /** 이 라운드의 큰일 */
  readonly ev?: 'capture-ok' | 'capture-fail' | 'duel-win' | 'duel-lose' | 'fire-ok' | 'fire-back' | 'retreat'
  /** ev 를 낸 쪽 */
  readonly by?: 'a' | 'd'
  /** 두 쪽의 무리별 명령 */
  readonly oa?: RoundOrder
  readonly od?: RoundOrder
  /** 이 합에서 일어난 일 — 차례대로 */
  readonly acts?: readonly Act[]
  /** 합이 끝났을 때 무리별 남은 사람 (공격 쪽 · 지킴 쪽) */
  readonly ga?: Readonly<Partial<Record<Grp, number>>>
  readonly gd?: Readonly<Partial<Record<Grp, number>>>
  /** 이 합에 장수를 잃었는데 싸움은 이어진다 — 사로잡힌(taken) · 겨루기에서 쓰러진(fell) 장수 · 지휘를 넘겨받은 장수(chief) */
  readonly lostHero?: { readonly side: 'a' | 'd'; readonly hero: string; readonly how: 'taken' | 'fell'; readonly chief?: string }
}

/**
 * 플레이어가 고른 싸움 명령 — advance 의 tactics[battleKey] (snipes 와 같은 길).
 * cmds[i] 가 i 라운드의 명령 — 무리별 RoundOrder (옛 판의 Cmd 한 개도 받는다: 그 명령을 맞는 무리에 건다). 모자라면 맡긴다(AI 가 고른다).
 * open 이면 모자란 데서 다음 고를 것을 pending 에 적는다 (전장 화면의 시험 돌림) — 나머지는 맡긴 것으로 끝까지 돈다
 */
export interface Tactic {
  readonly cmds: readonly (Cmd | RoundOrder)[]
  readonly open?: boolean
}

/** 전장 화면이 다음 라운드를 고를 때 보는 것 — 시험 돌림(open)에서만 나온다 */
export interface Pending {
  readonly round: number
  /** 우리 무리마다 — 지금 사람 수 · 고를 수 있는 명령 */
  readonly groups: ReadonlyArray<{ readonly g: Grp; readonly men: number; readonly options: readonly Cmd[] }>
  /** 장수의 명령 */
  readonly lead: readonly Cmd[]
  /** 적 무리마다 지금 사람 수 */
  readonly foe: Readonly<Partial<Record<Grp, number>>>
  /** 적이 흔들린다 — 사기가 꺾여 방진이 돌격을 못 받아 낼 지경 (눈에 보인다) */
  readonly foeWaver: boolean
  /** 사로잡기 확률 — 적장이 없으면 0 (화면은 말·색으로) */
  readonly capture: number
  /** 사로잡으러 보낼 날랜 무리 · 적장 곁 호위 (사람 수 — 셀 수 있는 것) */
  readonly squad: number
  readonly escort: number
  /** 적진의 낌새 — 적 앞줄의 다음 명령. 본 것(saw) 또는 들은 것(habit). 없으면 null */
  readonly hint: Cmd | null
  readonly hintSrc?: 'saw' | 'habit'
  /** 우리가 공격 쪽인가 */
  readonly weAtk: boolean
  /** 상대를 보고 있나 (척후·첩자·눈앞) */
  readonly seen: boolean
  /** 우리 장수의 비기 — 장수의 명령에 'art' 가 있으면 그것 */
  readonly art?: Art
  /** 이 싸움의 우리 장수들 — 총대장이 먼저 · 비기 · 썼나 (장수가 여럿이면 누가 나설지 고른다) */
  readonly heroes?: ReadonlyArray<{ readonly id: string; readonly chief: boolean; readonly mu: number; readonly art?: Art; readonly artUsed: boolean }>
  /** 적장들 — 사로잡을 수 있는 몫 (총대장은 호위가 두껍다) */
  readonly foeHeroes?: ReadonlyArray<{ readonly id: string; readonly chief: boolean; readonly p: number }>
  /** 총대장을 잃어 지휘가 흔들린다 — 이 합엔 북과 물러나기뿐 */
  readonly shaken?: boolean
  /** 호궤에 드는 곡식 — 장수의 명령에 'feast' 가 있으면 그 값 */
  readonly feast?: number
  /** 고르기 전 짐작 — 깃발마다 이번 합이 어떻게 될지 (tactics.guessOf · 문명의 싸움 예상처럼) */
  readonly guess?: Guesses
}

/** 깃발 하나를 들면 — 이번 합의 짐작. 낌새가 있으면 「적이 낌새대로 오면」 하나, 없으면 적 앞줄이 낼 수 있는 수마다라 폭이 생긴다 */
export interface Guess {
  /** 우리가 잃을 몫 (이 합 처음 사람 대비) [적을 때, 많을 때] */
  readonly us: readonly [number, number]
  /** 적이 잃을 몫 [적을 때, 많을 때] */
  readonly foe: readonly [number, number]
  /** 이 합 뒤 판세 — 우리 쪽 0..1, 0.5 가 팽팽 [나쁠 때, 좋을 때] */
  readonly edge: readonly [number, number]
}

export interface Guesses {
  /** 무엇을 놓고 셈했나 — hint: 낌새대로 오면 · all: 적이 어떻게 나오든 */
  readonly by: 'hint' | 'all'
  /** 지금 판세 (우리 쪽) */
  readonly edge0: number
  /** 무리(와 장수)마다 깃발마다 — 사로잡기·물러나기·겨루기는 굴림 하나가 판을 갈라 짐작하지 않는다 */
  readonly opts: Readonly<Partial<Record<Grp | 'lead', Readonly<Partial<Record<Cmd, Guess>>>>>>
}

/** 싸움이 시작될 때 — 사람 수 · 사기 · 이끄는 장수 (공격, 지킴). 전장 화면이 막대의 처음으로 쓴다 */
export interface BattleStart {
  readonly men: readonly [number, number]
  readonly morale: readonly [number, number]
  readonly heroes: readonly [string | null, string | null]
  /** 부장 — 총대장 말고 이 싸움에 함께 선 장수 (공격 쪽 · 지킴 쪽) */
  readonly aides?: readonly [readonly string[], readonly string[]]
  /** 병종 — 싸움 이야기가 무리 이름(창병·방패병 …)을 짓는다 */
  readonly mix?: readonly [Readonly<Partial<Record<UnitKind, number>>>, Readonly<Partial<Record<UnitKind, number>>>]
}

/** 싸움이 끝난 까닭 — 이야기의 마지막 줄 */
export type EndWhy = 'captured' | 'men' | 'morale' | 'retreat' | 'share' | 'draw'

/** 개척단 — 고을에서 떠난 백성 몇 가구. 빈땅에 닿으면 마을이 선다 (parties.ts) */
export interface Party {
  readonly id: string
  readonly faction: string
  /** 떠난 고을 */
  readonly home: string
  at: string
  readonly hh: number
  march: { readonly from: string; readonly to: string; readonly edge: string; left: number } | null
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
  /** 이 고을에 닿은 계절 — 같은 계절에 적이 들이치면 원군으로 늦게 붙는다 (season.fight) */
  came?: number
  /** 동맹에게 빌려준 군대 — `to` 나라의 `node` 고을로 가서 `until` 계절까지 머물며 지킨다 (diplomacy troops). 그동안 AI 가 마음대로 안 움직인다 */
  lent?: { readonly to: string; readonly node: string; readonly until: number; readonly arrived?: boolean }
  /** 먼 갈 곳 — 닿을 때까지 계절마다 한 걸음씩 저절로 간다 (goal.ts). 없으면 그냥 선다 */
  goal?: string
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

/**
 * 캠페인 장의 목표 하나 (scenario.ts · CAMPAIGN.md §2)
 *   hold 이 고을들을 쥔다 · submit 이 나라들이 따른다(동맹·조공) · fell 이 장수를 쓰러뜨린다(사로잡음·죽음) ·
 *   event 그 장의 사건을 이룬다 · survive 이만큼 버틴다
 */
export type Goal =
  | { readonly kind: 'hold'; readonly nodes: readonly string[] }
  | { readonly kind: 'submit'; readonly factions: readonly string[]; readonly how: 'ally' | 'tribute' | 'either' }
  | { readonly kind: 'fell'; readonly hero: string }
  | { readonly kind: 'event'; readonly id: string }
  | { readonly kind: 'survive'; readonly seasons: number }

/** 캠페인의 장 — 판을 열 때 얹힌다 (data/campaign.ts). `marks` 는 이룬 사건 id (id 순서) */
export interface Scenario {
  readonly id: string
  readonly win: readonly Goal[]
  /** 기한 — 이 계절 수 안에 이뤄야 한다. 없으면 없음 */
  readonly limit?: number
  marks?: string[]
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
  /** `path` — 어느 길로 끝났나 (정복 · 맹주 · 철과 뱃길 · 큰 제사). 옛 판은 없다 = 정복. `by` — 그 길을 이룬 나라 (남이면 우리가 진다) */
  outcome: { kind: 'win' | 'lose'; season: number; path?: 'conquest' | 'suzerain' | 'ironsea' | 'rite'; by?: string } | null
  /** 이긴 뒤에도 계속 둔다 — 남은 나라까지 (형: "이어서 진행해서 전부 점령하고 싶은 마음도"). 화면의 일이라 판정은 안 바뀐다 */
  endless?: boolean
  /** 계속 둬서 도읍을 모두 쥔 계절 */
  unified?: number
  /** 지난 판에서 따라온 장수 (계승 가신 — legacy.ts · VISION §5-4). 판을 열 때 한 번 정해진다. 옛 저장에는 없다 */
  retainers?: string[]
  /** 난세 단계 1~10 (tier.ts) — 판을 열 때 정해진다. 없으면 1 */
  tier?: number
  /** 그해 가을걷이 배수 — 사건이 건다 (events.ts · economy.harvestModOf). year = Math.floor(season / 4). 옛 저장에는 없다 */
  harvestMod?: Record<string, { year: number; mul: number }>
  /** 이번 계절 우리 나라에 온 사건 카드 (events.ts) · 한 계절 앞서 뽑아 둔 다음 카드 (점괘가 엿본다). 옛 저장에는 없다 */
  card?: Card | null
  cardNext?: Card | null
  /** 혼인의 열매 — due 계절에 자식 장수가 나선다 (heroes.stepHeroes). 옛 저장에는 없다 */
  /** 혼인의 열매 — due 계절에 아이가 나선다 · wed 혼인한 계절 · late 신혼에 떨어져 지내 늦어진 계절 (옛 저장엔 wed·late 가 없다) */
  births?: Array<{ a: string; b: string; faction: string; due: number; wed?: number; late?: number }>
  /**
   * 자라는 아이 — 태어나서 grown 계절까지는 장수가 아니다 (판의 장수 목록에 없다 · 일을 못 맡는다). 때가 되면 장수로 나선다
   * (형 10-24: "태어난 아이는 장수로 바로 쓰지 않고 성장 중으로 · 4계절쯤 지나면 장수로")
   */
  growing?: Array<{ hero: Hero; grown: number }>
  /** 원정 — 지도 바깥 먼 땅으로 간 장수. 결과는 보낼 때 정해진다 (expedition.ts · SYSTEMS §15-4). 옛 저장에는 없다 */
  expeditions?: Expedition[]
  /** 길 위·고을에 선 개척단 (parties.ts) — 옛 저장에는 없다 */
  parties?: Record<string, Party>
  /** 봄 제사를 지낸 해 (Math.floor(season / 4)) — 나라마다. 그해 가을 수확이 는다 (economy.riteAllowed). 옛 저장에는 없다 */
  blessed?: Record<string, number>
  /** 답을 기다리는 청 (diplomacy.openAsks). 옛 저장에는 없다 */
  asks?: Ask[]
  /** 맹약 시계 — 나라마다 맹주의 셈을 채운 계절이 내리 몇인가 · 지난 계절 손잡은 나라 수 (suzerain.ts). 옛 저장에는 없다 */
  suzerain?: Record<string, { streak: number; have: number }>
  /** 교역 장부 — 나라마다 오간 철 (계절 s · 상대 w · 철 n). 네 계절 창 (paths.ts 철과 뱃길). 옛 저장에는 없다 */
  ironBook?: Record<string, Array<{ s: number; w: string; n: number }>>
  /** 제사 사슬 — 나라마다 봄·가을 제사를 내리 지낸 수 (paths.ts 큰 제사). 옛 저장에는 없다 */
  riteChain?: Record<string, number>
  /** 소문을 이미 낸 길 — "iron:<나라>" · "rite:<나라>" (같은 소문을 되풀이하지 않게) */
  pathNear?: Record<string, true>
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
  /** 캠페인의 장 (scenario.ts) — 있으면 이 장의 목표로 이긴다. 자유 판 · 옛 저장에는 없다 */
  scenario?: Scenario
}

/** 플레이어(또는 AI)가 한 계절에 내리는 명령 */
export type Order =
  | { readonly kind: 'march'; readonly army: string; readonly edge: string; readonly ambush: boolean; readonly approach?: Approach; readonly ration?: Ration; readonly follow?: boolean }
  /** 먼 갈 곳을 둔다(node) · 지운다(null) — 그 계절의 첫 걸음은 함께 낸 march 가 간다 (goal.ts) */
  | { readonly kind: 'goal'; readonly army: string; readonly node: string | null }
  /** 서 있는 고을을 친다 — 동맹을 깨는 등으로 그 땅이 싸울 땅이 됐을 때, 길을 나서지 않고 그 자리에서 (형 10-24) */
  | { readonly kind: 'assault'; readonly army: string }
  /** 전장에서 직접 내린 명령 — 그 판(key)의 라운드마다 (advance 가 tactics 로 받는다 · 판 기록에 남아 다시 돌려도 같다) */
  | { readonly kind: 'command'; readonly key: string; readonly cmds: readonly (Cmd | RoundOrder)[] }
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
  /** 회군 — 길 위의 군대를 떠난 고을로 돌린다. 온 만큼 걸려 돌아간다(적어도 한 계절) */
  | { readonly kind: 'turnBack'; readonly army: string }
  /** 개척 — 제 고을 `from` 의 가호 n 을 길로 맞닿은 빈땅 `to` 로 옮긴다. 곡식이 든다 (economy.settleLimit · settleCost) */
  | { readonly kind: 'settle'; readonly faction: string; readonly from: string; readonly to: string; readonly n: number }
  /** 개척단 꾸리기 — 고을 `node` 의 백성을 떼어 낸다. edge 를 주면 바로 그 길로 떠난다 (parties.ts) */
  | { readonly kind: 'party'; readonly faction: string; readonly node: string; readonly edge?: string }
  /** 개척단을 길 하나로 보낸다 */
  | { readonly kind: 'partyGo'; readonly party: string; readonly edge: string }
  /** 백성 배치(사민) — 고을마다 더하고 빼는 집 (합 0) */
  | { readonly kind: 'place'; readonly faction: string; readonly delta: Readonly<Record<string, number>> }
  /** 개척단이 선 우리 고을에 눌러앉는다 — 이주 */
  | { readonly kind: 'partyJoin'; readonly party: string }
  /** 이주 — 제 고을 `from` 의 집 n 을 제 땅으로 이어진 제 고을 `to` 로 억지로 옮긴다. 곡식이 들고 두 고을은 한동안 집이 안 는다 (economy.migrateLimit) */
  | { readonly kind: 'migrate'; readonly faction: string; readonly from: string; readonly to: string; readonly n: number }
  /** 집 자동 분배 켜기·끄기 (Faction.migrateOff) */
  | { readonly kind: 'migrateAuto'; readonly faction: string; readonly on: boolean }
  /** 소도 제사 — 봄·가을에, 소도와 길로 맞닿은 고을을 쥔 나라만. 곡식이 든다 (economy.riteAllowed · riteCost) */
  | { readonly kind: 'rite'; readonly faction: string }
  /** 장의 겨루기 — 밤 판에서 손으로 쏜 결과 (2장 송양의 활쏘기 · scenario.resolveContests) */
  | { readonly kind: 'contest'; readonly faction: string; readonly id: 'archery'; readonly won: boolean }
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
  /** 짝에게 가서 함께 지낸다 — 신방에 들었는데 떨어져 있을 때 (형 10-23: "버튼 하나 눌러서 같이 지내게") */
  | { readonly kind: 'cohabit'; readonly hero: string }
  /** 포로 회유를 시작한다 — 다 될 때까지 계절마다 곡식이 든다. by = 설득을 맡은 우리 장수 (매력·매혹이 빠르기를 정한다) */
  | { readonly kind: 'persuade'; readonly hero: string; readonly by: string | null }
  /** 떠돌이 인재를 들인다 — 그 인재가 머문 고을의 주인만, 곡식 price */
  | { readonly kind: 'hire'; readonly faction: string; readonly hero: string }
  /** 사건 카드의 답 — 고르지 않으면 0 (events.resolveCard) */
  | { readonly kind: 'card'; readonly faction: string; readonly pick: 0 | 1 }
  /** 장수를 지도 바깥 먼 땅으로 원정 보낸다 — len 0 짧게 · 1 보통 · 2 길게 (expedition.ts) */
  | { readonly kind: 'expedition'; readonly faction: string; readonly hero: string; readonly dest: ExpDest; readonly len: 0 | 1 | 2 }
  /** 우리 장수 둘(남녀)을 혼인시킨다 — 잔치 곡식이 들고, 몇 계절 뒤 자식 장수가 나선다 (SYSTEMS §5-10 · 팰 교배) */
  | { readonly kind: 'wed'; readonly faction: string; readonly a: string; readonly b: string }
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
      /** 이 싸움에서 사로잡히거나 쓰러진 장수 모두 (장수가 여럿이면 하나가 아닐 수 있다) */
      readonly captives?: readonly string[]
      readonly fallen?: readonly string[]
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
      /** 앞선 군대가 걸어온 길의 종류 — 싸움 이름(○○나루 싸움 …)에 쓴다. 들판이면 edge 의 종류 */
      readonly via?: EdgeKind
      /** 싸움이 끝난 까닭 */
      readonly endWhy?: EndWhy
    }
  /** 가을 수확 — `blessed` 는 그 가운데 봄 제사로 더 든 몫 */
  | { readonly kind: 'harvest'; readonly faction: string; readonly grain: number; readonly blessed?: number }
  /** 소도 제사 — 봄은 그해 수확, 가을은 군대 사기 */
  | { readonly kind: 'rite'; readonly faction: string; readonly season: 'spring' | 'autumn' }
  /** 장의 겨루기 결과 — with 는 겨룬 나라 */
  | { readonly kind: 'contest'; readonly faction: string; readonly with: string; readonly won: boolean }
  /** 장터 — 화친·동맹인 두 나라가 이번 계절 곡식을 얻었다 (둘 다 grain 씩) */
  | { readonly kind: 'market'; readonly a: string; readonly b: string; readonly grain: number }
  | { readonly kind: 'draft'; readonly faction: string; readonly node: string; readonly unit: UnitKind; readonly n: number; readonly army: string }
  | { readonly kind: 'disband'; readonly army: string; readonly node: string; readonly n: number }
  | { readonly kind: 'settle'; readonly faction: string; readonly from: string; readonly to: string; readonly n: number }
  /** 집이 옮겨 갔다 — auto 면 붐비는 고을에서 저절로, 아니면 억지 이주 */
  | { readonly kind: 'migrate'; readonly faction: string; readonly from: string; readonly to: string; readonly n: number; readonly auto?: boolean; readonly walk?: boolean }
  | { readonly kind: 'place'; readonly faction: string; readonly n: number; readonly to: readonly string[] }
  | { readonly kind: 'cohabit'; readonly faction: string; readonly hero: string; readonly with: string; readonly to: string }
  | { readonly kind: 'hunger'; readonly faction: string }
  | { readonly kind: 'envoy'; readonly from: string; readonly to: string; readonly ask: EnvoyAsk; readonly accepted: boolean; readonly why?: Why; readonly about?: string; readonly hero?: string; readonly node?: string }
  /** 화친·동맹을 맺어 상대 땅으로 가던 군대가 발길을 돌렸다 — `node` 는 가려던 고을 */
  /** 동맹·화친 땅에 약속 없이 머무는 우리 군대를 그 나라가 언짢아한다 (호감 −) */
  | { readonly kind: 'stationed'; readonly faction: string; readonly owner: string; readonly node: string }
  | { readonly kind: 'recall'; readonly faction: string; readonly army: string; readonly node: string; /** 왜 돌아섰나 — 없으면 화친·동맹을 맺어서, owner 면 가는 사이 그 나라 땅이 돼서, why 'order' 면 회군 명령 */ readonly owner?: string; readonly why?: 'order' }
  /** 함께 치자는 약속을 지켰나 저버렸나 — `from` 이 약속한 나라, `to` 가 약속받은 나라 */
  | { readonly kind: 'pledge'; readonly from: string; readonly to: string; readonly node: string; readonly kept: boolean }
  /** 군대를 빌려줬다 (`army` 가 `to` 의 `node` 를 지키러 간다) · 돌아갔다 (back) */
  | { readonly kind: 'lent'; readonly from: string; readonly to: string; readonly node: string; readonly army: string; readonly back: boolean; readonly arrived?: boolean; readonly until?: number; readonly eta?: number }
  /** 무장을 올렸다 */
  | { readonly kind: 'arm'; readonly faction: string; readonly army: string; readonly equip: Equip; readonly iron: number; readonly unit?: UnitKind; readonly n?: number }
  /**
   * 두 나라 사이가 바뀌었다. `by` — 먼저 그렇게 만든 나라 (전쟁을 건 쪽 · 깬 쪽), `why` — 까닭
   * (형: "누가 나랑 전쟁나면 상대가 걸어왔다는걸 알려줘야지... 그냥무작정 전쟁이다라 그러면 어떡하냐"). 옛 기록엔 없다
   */
  | { readonly kind: 'relation'; readonly a: string; readonly b: string; readonly state: Relation['state']; readonly by?: string; readonly why?: RelationWhy }
  /** 도읍이 무너져 조정이 seat 으로 피했다 · until 계절까지 되찾아야 · 또는 피한 곳을 옮겼다(moved) */
  | { readonly kind: 'exile'; readonly faction: string; readonly capital: string; readonly seat: string; readonly until: number; readonly moved?: boolean }
  /** 잃었던 도읍을 되찾았다 */
  | { readonly kind: 'retake'; readonly faction: string; readonly capital: string }
  | { readonly kind: 'end'; readonly outcome: 'win' | 'lose'; readonly faction: string; readonly path?: 'conquest' | 'suzerain' | 'ironsea' | 'rite'; readonly by?: string }
  /** 큰 제사의 사슬 — 우리 것이면 제사철마다, 남의 것이면 가까워졌을 때 소문 (paths.ts) */
  | { readonly kind: 'pathRite'; readonly faction: string; readonly chain: number; readonly need: number; readonly hh: number; readonly hhNeed: number }
  /** 철과 뱃길 — 가까워졌을 때 (우리 것이면 알림, 남의 것이면 소문) */
  | { readonly kind: 'pathIron'; readonly faction: string; readonly partners: number; readonly iron: number; readonly score: number; readonly need: number }
  /** 장터에서 철이 팔렸다 — `from` 이 `to` 에게 철 `iron` 을 곡식 `grain` 에 */
  | { readonly kind: 'ironMarket'; readonly from: string; readonly to: string; readonly iron: number; readonly grain: number }
  /** 맹약 — `faction` 과 손잡은 나라 `have` / 필요한 `need` · 내리 `streak` 계절 (suzerain.ts — 우리 것이면 맹약의 해, 남의 것이면 소문) */
  | { readonly kind: 'suzerain'; readonly faction: string; readonly have: number; readonly need: number; readonly streak: number }
  /** 전쟁 중인 나라에 사신으로 간 장수가 붙잡혔다 */
  | { readonly kind: 'envoyHeld'; readonly from: string; readonly to: string; readonly hero: string }
  /** 우리 고을에 맞닿은 길 위의 남의 군대 — 행군은 보인다 (FLOW §7 #2) */
  /** `suspect` — 우리 고을로 오는 기습을 낌새챘다 (경계·굴림). 못 챘으면 그냥 행군으로 보인다 */
  | { readonly kind: 'sighted'; readonly faction: string; readonly army: string; readonly from: string; readonly to: string; readonly suspect?: boolean }
  /** 새 청이 왔다 — 다음 계절에 답한다 */
  | { readonly kind: 'ask'; readonly ask: Ask }
  /** 청에 답했다 (답이 없어 거절로 친 것도) */
  | { readonly kind: 'answered'; readonly ask: string; readonly yes: boolean; readonly from: string; readonly askKind: AskKind }
  /** 경계 강화 */
  | { readonly kind: 'guard'; readonly faction: string; readonly node: string }
  /** 사로잡혔던 장수가 풀려나 돌아왔다 — 화친(peace) · 잡아 둔 나라의 도읍이 떨어져서(take) */
  | { readonly kind: 'freed'; readonly hero: string; readonly faction: string; readonly from: string; readonly why: 'peace' | 'take' }
  /** 장수가 정예 호위를 거느리고 맡을 고을로 떠났다 (멀리 맡기기) */
  | { readonly kind: 'heroGo'; readonly faction: string; readonly hero: string; readonly from: string; readonly to: string }
  /** 개척단이 떠났다 · 흩어졌다 */
  | { readonly kind: 'party'; readonly faction: string; readonly party: string; readonly node: string; readonly n: number }
  | { readonly kind: 'partyLost'; readonly faction: string; readonly party: string; readonly node: string; readonly n: number }
  /** 가는 빈땅을 `by` 가 먼저 일궜다 — 개척단이 떠나온 곳(back)으로 돌아와 멈춰 선다 (가구는 그대로) */
  | { readonly kind: 'partyBack'; readonly faction: string; readonly party: string; readonly node: string; readonly by: string; readonly back: string; readonly n: number }
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
  /** 회유가 한 걸음 — waver 마음의 벽이 무너졌다(이제부터 넘어올 수도) · refuse 또 고개를 저었다 */
  | { readonly kind: 'persuade'; readonly hero: string; readonly faction: string; readonly step: 'waver' | 'refuse' }
  /** 장수가 자랐다 — 능력치 하나가 한 단계 (HEROES §6) */
  | { readonly kind: 'grow'; readonly hero: string; readonly stat: GrowStat }
  /** 정이 문턱을 넘었다 — 믿는 장수가 됐다 */
  | { readonly kind: 'bond'; readonly hero: string; readonly tier: 'trust' }
  /** 정이 다 차서 특성 하나에 눈떴다 */
  | { readonly kind: 'awaken'; readonly hero: string; readonly trait: string }
  /** 사건 카드의 결과 — 무엇이 얼마나 오갔나 · good 은 운에 맡긴 쪽이 잘됐나 */
  | {
      readonly kind: 'card'; readonly faction: string; readonly card: CardKind; readonly pick: 0 | 1
      readonly grain?: number; readonly iron?: number; readonly hh?: number; readonly good?: boolean; readonly hero?: string; readonly node?: string
    }
  /** 점괘 — 다음 계절 카드를 엿봤다 (card null 이면 조용한 계절). right 는 맞았나 — 화면에는 안 보인다 */
  | { readonly kind: 'omen'; readonly faction: string; readonly card: CardKind | null; readonly right: boolean; readonly shaman: boolean }
  /** 원정을 떠났다 · 돌아왔다 (got 을 풀었다) */
  | { readonly kind: 'expGo'; readonly faction: string; readonly hero: string; readonly dest: ExpDest; readonly back: number }
  | { readonly kind: 'expBack'; readonly faction: string; readonly hero: string; readonly dest: ExpDest; readonly got: ExpGot }
  /** 원정 명령이 계절을 넘길 때 막혔다 (곡식이 다른 데 먼저 쓰였거나 원정 수가 찼다) — 말없이 빠지지 않게 */
  | { readonly kind: 'expStay'; readonly faction: string; readonly hero: string; readonly dest: ExpDest; readonly why: string }
  /** 혼인했다 — due 계절에 아이가 나선다 */
  | { readonly kind: 'wed'; readonly faction: string; readonly a: string; readonly b: string; readonly due: number }
  /** 혼인의 열매 — 자식 장수가 나섰다. surprise = 부모 누구에게도 없던 특성이 터졌다 */
  | { readonly kind: 'birth'; readonly faction: string; readonly hero: string; readonly a: string; readonly b: string; readonly surprise?: string }
  /** 자라던 아이가 다 자라 장수로 나섰다 */
  | { readonly kind: 'grown'; readonly faction: string; readonly hero: string }
  /** 떠돌이 인재가 그 고을에 나타났다 — 고을 주인이 until 계절까지 들일 수 있다 */
  | { readonly kind: 'wanderer'; readonly hero: string; readonly node: string; readonly until: number; readonly price: number }
  /** 맡긴 장수가 고을을 잃어 물러났다 · 사로잡혔다 */
  | {
      readonly kind: 'heroMoved'; readonly hero: string; readonly faction: string; readonly to: string | null; readonly captor: string | null
      /** 어떻게 — fell 지키다 쓰러졌다 · caught 물러나다 붙잡혔다 · slipped 이웃이 없었지만 빠져나왔다 (없으면 옛 꼴: 물러났다/사로잡혔다) */
      readonly fate?: 'fell' | 'caught' | 'slipped'
    }

export interface Report {
  readonly season: number
  readonly lines: readonly ReportLine[]
}
