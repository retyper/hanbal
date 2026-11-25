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
/** 자세 바꿈: u = 0 돌격 · 1 방진 · 2 길 트기 (앞줄 세모 방진 > 돌격 > 길 트기 > 방진) */
export const OP_STANCE = 2
/** 물러남: 그 판을 바로 진 것으로 끝낸다 (g 는 아무거나) */
export const OP_RETREAT = 3
export const STANCE_CHARGE = 0
export const STANCE_HOLD = 1
export const STANCE_OPEN = 2

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
  /** 앞줄 자세 0 돌격 · 1 방진 · 2 길 트기 (활·기병은 무시) */
  stance: 0 | 1 | 2
  /** 처음 사기 · 사기 = morale0 - 잃은 몫 - shock (누적에서 바로 셈하므로 정수 깎임이 쌓이지 않는다) */
  morale0: number
  /** 옆구리·장수 쓰러짐으로 누적된 사기 꺾임 (천분율) */
  shock: number
  /** 시작 자리 (지키는 편은 여기서 leashCells 안에서만 움직인다) */
  homeU: number
  homeV: number
  /** 맞물린 적 대의 id · 없으면 -1 (앞줄이 맞붙는 거리 안의 적 앞줄·기병과 맞물리면 지나쳐 걸을 수 없다 · 손으로 몰면 풀린다) */
  lock: number
  /** 잠든 남은 틱 (먹힌 기습 · 맞으면 0) */
  sleep: number
  /** 옆구리를 맞은 틱 수 (사기는 이것에서 바로 셈해 hz 를 바꿔도 같다) */
  flank: number
  /** 손으로 몰고 있으면 1 (임시 AI 가 목표를 안 바꾼다) */
  manual: 0 | 1
  /** 지금 노리는 적 대의 id · 없으면 -1 */
  target: number
  /** 체력 · 천분의 일 명 단위 (men = hp 를 1000 으로 올림해서 나눈 것) */
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
  /** 손으로 몰고 있으면 1 (아니면 임시 AI 가 제 편 앞줄 곁을 따른다) */
  manual: 0 | 1
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

/** 바닥 종류 — 0 평지 · 1 얕은 물(느림) · 2 깊은 물(못 걸음) · 3 막힘(못 걸음) · 4 높은 터(위에 선 활이 세고, 올라오는 적은 느리다) */
export type Ground = 0 | 1 | 2 | 3 | 4
export const G_PLAIN = 0, G_SHALLOW = 1, G_DEEP = 2, G_BLOCK = 3, G_HIGH = 4

/** 진영 (칸 단위) — axis 0: 줄이 폭(v)으로 퍼지고 뒷줄은 u 쪽 뒤 · axis 1: 줄이 u 로 퍼지고 뒷줄은 v 쪽 뒤 (기습처럼 옆에서 시작) */
export interface Camp {
  u: number
  v: number
  face: 1 | -1
  spread: number
  axis: 0 | 1
  /** 참이면 그 편은 시작 자리에서 leashCells 밖으로는 안 나간다 (지키는 쪽) */
  hold: boolean
  /** 잠든 채 시작하는 시간 (초 · 맞으면 깬다) */
  asleep?: number
}

/** 맵 조각 — 목책 마디와 문 (칸 단위 · hp 를 깎아 길을 여는 규칙은 F2b) */
export interface Piece { id: number; kind: 'stake' | 'gate'; u0: number; v0: number; u1: number; v1: number; hp: number; owner: 0 | 1 }

/** 맵의 규칙 이름 — 지어진 것만 (공성·수상은 mapFor 가 null) · hold 는 평지에서 한 편이 지키는 비교용 */
export type MapRule = 'meet' | 'cross' | 'stake' | 'ambush' | 'high' | 'hold'

/** 지도 — cells[cu * w + cv] 가 칸마다 바닥 종류 (u, w 는 칸 수). JSON 을 거치지 않는다(Uint8Array) */
export interface FieldMap {
  v: 1
  u: number
  w: number
  cells: Uint8Array
  camps: readonly [Camp, Camp]
  pieces: readonly Piece[]
  rule: MapRule
  /** 높은 터를 가진 편 · 없으면 -1 */
  highOwner: -1 | 0 | 1
}

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
  /** 진영이 무너진 편 (적이 진영 자리까지 들어오면 한 번 · 사기가 꺾인다) */
  broken: [0 | 1, 0 | 1]
  end: EndWhy | null
  /** 끝났을 때 이긴 편 · 0 우리 · 1 적 · -1 비김(또는 아직) */
  winner: -1 | 0 | 1
  log: FieldLog
}
