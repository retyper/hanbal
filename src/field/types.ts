/**
 * 전장(field) 자료 꼴 — 정수만 (docs/realm/battle-study/22-design-code-reality.md §2 · 40-cards.md F1a)
 *
 * 좌표 (u, v) 는 정수 격자다: u = 우리 쪽에서 적 쪽으로 가는 길이 · v = 폭. 1칸 = P.field.unit 단위.
 * 그리기는 이 값을 읽기만 한다. 부동소수·삼각함수는 이 폴더의 sim 쪽 파일에 들이지 않는다 (tests/field/purity.test.ts).
 */

/** 본편 tactics.ts 의 Grp 와 같은 낱말 */
export type Grp = 'front' | 'bows' | 'horse'
export const GRPS: readonly Grp[] = ['front', 'bows', 'horse']

/** 입력의 g: 0 앞줄 · 1 활 · 2 기병 · 3 장수 */
export type InputGroup = 0 | 1 | 2 | 3
/** 입력의 op: 0 = 그 무리를 (u, v) 로 보냄(손으로 몰기) · 1 = 손을 떼고 임시 AI 에 맡김 (자세·비기 같은 갈래는 뒤 카드가 더한다) */
export const OP_MOVE = 0
export const OP_AUTO = 1

export type EndWhy = 'morale' | 'men' | 'time' | 'retreat' | 'invalid'

export interface Point { u: number; v: number }

/** 대 = 몸. 무리마다 4개 이하로 고정하고 대당 사람 수가 바뀐다 (한 편 사람 수 p90 1,305 · 최대 2,097) */
export interface Squad {
  id: number
  side: 0 | 1
  grp: Grp
  /** 본편 병종 이름표 (그림·말에 쓴다. 이 sim 은 grp 만 본다) */
  kind: string
  men: number
  menMax: number
  /** 이번 달 새로 뽑은 사람 수 (금빛으로 보인다) */
  fresh: number
  u: number
  v: number
  goal: Point | null
  /** 손으로 몰고 있으면 1 (임시 AI 가 목표를 안 바꾼다) */
  manual: 0 | 1
  /** 지금 노리는 적 대의 id · 없으면 -1 */
  target: number
  hp: number
  /** 0~1000 */
  morale: number
}

/** 장수 (내용은 F4a 가 채운다 — 지금은 자리와 걸음만) */
export interface Hero {
  side: 0 | 1
  id: string
  u: number
  v: number
  goal: Point | null
  /** 붙어 있는 무리 (0~2) · 없으면 -1 */
  grp: number
  /** 쓰러져 못 움직이는 남은 틱 */
  stun: number
  hp: number
}

export interface FieldInput { tick: number; g: InputGroup; op: number; u: number; v: number }

export interface LiveSide {
  men: Readonly<Record<Grp, number>>
  /** 이번 달 새로 뽑은 사람 수 (무리별 · 없으면 0) */
  fresh?: Readonly<Partial<Record<Grp, number>>>
  F: number
  /** 0~1000 */
  morale: number
  hero: { id: string; mu: number } | null
  player: boolean
  seen: boolean
}

/** 지도 — F1a 는 길이와 폭뿐 (지형·마디·진영은 F2a) */
export interface FieldMap { v: 1; u: number; w: number }

export interface LiveSetup {
  v: 1
  key: string
  seed: number
  map: FieldMap
  sides: readonly [LiveSide, LiveSide]
  night: boolean
}

export interface FieldLog {
  /** 한 때에 무리당 입력 상한을 넘어 버린 수 */
  dropped: number
  /** 받아들인 입력 (재생·기록용) */
  accepted: FieldInput[]
}

export interface FieldState {
  tick: number
  seed: number
  map: FieldMap
  squads: Squad[]
  heroes: Hero[]
  /** 이번 때에 무리별(0~3)로 받은 입력 수 */
  used: [number, number, number, number]
  end: EndWhy | null
  log: FieldLog
}
