/**
 * 나라(realm)의 상태 — 판 하나 (docs/realm/SYSTEMS.md §0 · BUILD §1-2)
 *
 * **JSON 으로 그대로 직렬화되는 평범한 객체**만 쓴다 — 클래스·함수·Map 금지.
 * 그래야 저장·비교·리플레이가 공짜다 (BUILD §1-2). 모음은 배열이 아니라 id 를 열쇠로 한 기록이다.
 *
 * R1 의 범위: 지도 · 세력 · 장수 · 군대 · 정보 · 경계. 고을의 경제(가호·창고)·사건·회유는 R3~R4 에서 더한다.
 */
import type { Equip, Outcome, UnitKind } from './battle.ts'
import type { Source } from './intel.ts'

/** 계절 번호 0 = 첫해 봄. 계절 = 번호 % 4 */
export type SeasonOfYear = 'spring' | 'summer' | 'autumn' | 'winter'

/** 고을 종류 (SYSTEMS §1-1) */
export type NodeKind = 'capital' | 'village' | 'sodo' | 'port' | 'fort' | 'ironMine'

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
}

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
}

/** 플레이어(또는 AI)가 한 계절에 내리는 명령 */
export type Order =
  | { readonly kind: 'march'; readonly army: string; readonly edge: string; readonly ambush: boolean }
  | { readonly kind: 'scout'; readonly faction: string; readonly node: string; readonly hero: string | null }

/** 직접 쏜 저격의 결과 — 판 열쇠(battleKey)마다. R1 에는 저격이 없어 비어 있다 (SNIPE · SYSTEMS §6) */
export type SnipeZone = 'head' | 'body' | 'leg' | 'drum' | 'miss'

/** 보고의 한 줄 — 글은 ui 가 짓는다. 여기는 무슨 일이 있었는지만 */
export type ReportLine =
  | { readonly kind: 'scout'; readonly faction: string; readonly node: string; readonly detected: boolean }
  | { readonly kind: 'blocked'; readonly army: string; readonly edge: string; readonly why: 'winterPass' | 'summerFord' }
  | { readonly kind: 'arrive'; readonly army: string; readonly node: string }
  | { readonly kind: 'take'; readonly faction: string; readonly node: string }
  | {
      readonly kind: 'battle'
      readonly node: string
      readonly attacker: string
      readonly defender: string
      readonly ambush: 'none' | 'success' | 'caught'
      readonly p: number
      readonly outcome: Outcome
      readonly captured: string | null
      readonly killed: string | null
    }

export interface Report {
  readonly season: number
  readonly lines: readonly ReportLine[]
}
