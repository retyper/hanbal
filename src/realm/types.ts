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
}

/** 나라 사이 관계 (FLOW §4) — 판은 중립에서 시작한다. 화친은 `until` 계절에 끝난다 */
export interface Relation {
  state: 'war' | 'neutral' | 'truce' | 'ally'
  until: number | null
}

/** 한 나라의 창고 — 국읍 창고 (SYSTEMS §7-5 자원 넷 가운데 둘) */
export interface Stock {
  grain: number
  iron: number
}

export type EnvoyAsk = 'truce' | 'trade' | 'tribute' | 'alliance'

export type HeroStatus = 'free' | 'captive' | 'dead'

export interface Hero {
  readonly id: string
  readonly name: string
  faction: string
  /** 무 · 략 · 치 · 덕 (SYSTEMS §5-1) 1~10 */
  readonly mu: number
  readonly ryak: number
  readonly chi: number
  readonly deok: number
  status: HeroStatus
  /** 사로잡힌 곳의 세력 id */
  captor: string | null
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
  | { readonly kind: 'draft'; readonly faction: string; readonly node: string; readonly unit: UnitKind; readonly n: number }
  /** 해산 — 제 고을에 쉬는 군대를 집으로 (사람은 그 고을 가호로 돌아간다) */
  | { readonly kind: 'disband'; readonly army: string }
  /** 개척 — 제 고을 `from` 의 가호 n 을 길로 맞닿은 빈땅 `to` 로 옮긴다. 곡식이 든다 (economy.settleLimit · settleCost) */
  | { readonly kind: 'settle'; readonly faction: string; readonly from: string; readonly to: string; readonly n: number }
  /** 사신 (FLOW §4) — 한 나라가 한 계절에 하나. give 는 보내는 쪽이, take 는 받는 쪽이 내놓는다 */
  | {
      readonly kind: 'envoy'
      readonly from: string
      readonly to: string
      readonly ask: EnvoyAsk
      readonly give: { readonly grain: number; readonly iron: number }
      readonly take: { readonly grain: number; readonly iron: number }
    }

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
    }
  | { readonly kind: 'harvest'; readonly faction: string; readonly grain: number }
  | { readonly kind: 'draft'; readonly faction: string; readonly node: string; readonly unit: UnitKind; readonly n: number; readonly army: string }
  | { readonly kind: 'disband'; readonly army: string; readonly node: string; readonly n: number }
  | { readonly kind: 'settle'; readonly faction: string; readonly from: string; readonly to: string; readonly n: number }
  | { readonly kind: 'hunger'; readonly faction: string }
  | { readonly kind: 'envoy'; readonly from: string; readonly to: string; readonly ask: EnvoyAsk; readonly accepted: boolean }
  | { readonly kind: 'relation'; readonly a: string; readonly b: string; readonly state: Relation['state'] }
  | { readonly kind: 'end'; readonly outcome: 'win' | 'lose'; readonly faction: string }
  /** 우리 고을에 맞닿은 길 위의 남의 군대 — 행군은 보인다 (FLOW §7 #2) */
  | { readonly kind: 'sighted'; readonly faction: string; readonly army: string; readonly from: string; readonly to: string }

export interface Report {
  readonly season: number
  readonly lines: readonly ReportLine[]
}
