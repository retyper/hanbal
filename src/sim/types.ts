/**
 * 시뮬레이션 계약 (contract)
 *
 * 이 파일이 sim / game / render / input 사이의 유일한 약속이다.
 * 병렬로 작업하는 구현자들은 전부 여기에 맞춰 짠다. 여기를 바꾸려면 먼저 합의한다.
 *
 * 좌표계: 월드는 미터(m). x는 오른쪽 +, **y는 위쪽 +** (수학 좌표계).
 *         화면 좌표(y 아래쪽 +)로의 변환은 render/camera.ts 한 곳에서만 한다.
 * 각도:   라디안. 0 = 오른쪽(+x), 반시계 +.
 */
import type { Rng } from '../core/rng.ts'
import type { ArrowFx } from './arrowfx.ts'

// ───────────────────────────── 입력 ─────────────────────────────

/** 매 스텝 sim에 들어가는 입력 스냅샷. input/ 레이어가 만든다. */
export interface InputFrame {
  /** 조준 목표점 (월드 m). 궁수 손에서 이 점을 향하는 방향이 겨냥각이 된다. */
  aimX: number
  aimY: number
  /** 좌클릭 홀드 = 시위 당김. false로 떨어지는 스텝에 발사된다. */
  drawing: boolean
  /** 우클릭 / Shift = 호흡정지 */
  steady: boolean
}

// ───────────────────────────── 성장 ─────────────────────────────

/** 영구 성장 스탯 (GDD 4장). 레벨 값이며 물리 효과는 tune/params.ts 의 growth가 결정한다. */
export interface Stats {
  /** 근력 — 장력, 화살 속도, 만작 도달 속도 */
  str: number
  /** 정확 — 떨림 진폭 감소 */
  steady: number
  /** 지구력 — 스태미나 최대치·회복. 최대치가 커지면 빨간 바 위의 안전 구간이 그만큼 길어진다 */
  stamina: number
  /** 집중 — 호흡정지 효율 */
  focus: number
}

// ───────────────────────────── 궁수 ─────────────────────────────

export type ArcherPhase =
  /** 대기 — 시위를 잡지 않음 */
  | 'idle'
  /** 당기는 중 (draw < 1) */
  | 'drawing'
  /** 만작 — 위력이 최대. 빨간 바 위라면 오차 0이고, 넘긴 뒤부터 떨림과 싸운다 */
  | 'full'
  /** 붕괴 — 스태미나가 다해 스스로 놓아버림. 발사는 되지만 정확도가 무너진다. */
  | 'collapsing'
  /** 쏜 뒤 회복 */
  | 'recovering'

export interface ArcherState {
  /** 활을 잡은 손 위치 (m) */
  x: number
  y: number
  phase: ArcherPhase

  /** 입력에서 온 겨냥각. 떨림 미포함. (rad) */
  aimAngle: number
  /** 떨림에 의한 각 오프셋. **렌더는 이 값으로 팔과 활을 흔든다.** (rad) */
  tremorOffset: number
  /** 현재 떨림 진폭. HUD 경고·가독성 검증용. (rad) */
  tremorAmp: number
  /** 노이즈 위상 누적 (s). 결정론을 위해 실시간이 아닌 tick 누적으로만 증가한다. */
  tremorPhase: number

  /** 당김 정도 0..1. 1 = 만작 */
  draw: number
  /** 당기기 시작한 뒤 경과 (s) */
  drawTime: number
  /** 만작 도달 후 경과 (s). 연출·계측용이며 떨림에는 쓰이지 않는다 (떨림의 입력은 strain 하나다). */
  holdTime: number

  stamina: number
  staminaMax: number
  /** 회복이 시작되기까지 남은 시간 (s) */
  regenLock: number

  /** 호흡정지 지속 시간 (s) */
  steadyTime: number
  /** 호흡정지 효과 적용도 0..1. 즉발이 아니라 rampIn 동안 스며든다. */
  steadyBlend: number

  /** 붕괴 경고 강도 0..1. **렌더는 이 값으로 팔 처짐·색 변화를 그린다.** */
  warn: number
  /**
   * 빨간 바를 얼마나 넘었는가. 0 = 아직 안전 구간(완벽히 정확), 1 = 스태미나 완전 소진.
   * 떨림과 발사 오차가 전부 이 값에 비례한다. HUD가 이 값으로 경계선 넘김을 표시한다.
   */
  strain: number
}

// ───────────────────────────── 화살 ─────────────────────────────

/**
 * 화살 종류 (docs/HOOK.md ★1). 판 시작 전 3택으로 고르고 그 판 내내 쓴다.
 *
 * **왜 계약(sim)의 것인가**: 효과를 실제로 적용하는 건 ballistics·target이고 레이어 방향은
 * core ← sim ← game 이다 (A1). 이름·설명 같은 화면용 메타데이터만 game/arrows.ts에 남는다.
 * 효과 수치는 sim/arrowfx.ts가 tune/params.ts의 `arrowkind` 그룹에서 굽는다 (A2).
 */
export type ArrowKindId = 'basic' | 'pierce' | 'burst' | 'split' | 'homing' | 'chain' | 'heavy'

export type ArrowOutcome = 'flying' | 'hit' | 'miss' | 'expired'

/** 궤적 링버퍼 길이. 고정 크기 — 프레임당 할당 금지 (ARCHITECTURE A5). */
export const TRAIL_POINTS = 48

export interface Arrow {
  alive: boolean
  x: number
  y: number
  /** 직전 스텝 위치. 렌더 보간 + 터널링 방지 판정에 쓴다. */
  px: number
  py: number
  vx: number
  vy: number
  /** 화살촉 방향 (rad). 속도 방향으로 서서히 정렬된다. */
  angle: number
  age: number
  /** 관통 과녁(kind 'pierceable')을 뚫고 지나간 수 */
  pierced: number
  /**
   * 이 화살이 무언가를 맞힌 횟수 (관통·연쇄·폭발 직격 전부 포함).
   * 소멸할 때 miss를 뱉을지 가르는 값이다 — 셋을 꿰뚫은 한 발이 착지하며 miss를 뱉으면
   * 스스로 콤보를 0으로 만든다.
   */
  struck: number
  /**
   * 화살 종류의 관통(fx.pierceExtra)으로 뚫은 수. `pierced`와 나누는 이유:
   * 관통 과녁은 공짜로 뚫리고 화살 종류의 관통은 예산이 정해져 있다.
   */
  kindPierced: number
  /** 사슬 살이 튄 횟수 (fx.chainBounces 까지) */
  bounces: number
  /** 분열 살의 세대. 0 = 직접 쏜 화살, 1 = 갈라져 나온 자식. 자식은 다시 갈라지지 않는다. */
  splitDepth: number
  /**
   * 이번 스텝에 명중이 요구한 후처리 플래그. target.ts가 세우고 ballistics.ts가 소비한다.
   * **왜 플래그인가**: target.ts가 ballistics.ts를 import하면 순환이 생긴다 (spawn은 저쪽 것).
   */
  splitPending: number
  chainPending: number
  /** 위 플래그가 가리키는 자리 (명중한 과녁의 중심). 화살 자신의 좌표는 이미 그 너머다. */
  pendX: number
  pendY: number
  outcome: ArrowOutcome
  /** 발사 시점의 당김 0..1. 점수·연출에 쓴다. */
  power: number
  /** [x0,y0,x1,y1,...] 링버퍼. 렌더 전용. */
  trail: Float32Array
  trailLen: number
  trailHead: number
}

// ───────────────────────────── 과녁 ─────────────────────────────

export type TargetKind =
  /** 고정 과녁. 링 점수 있음. */
  | 'static'
  /** 좌우/상하 이동 */
  | 'moving'
  /** 공중 부유 — 맞으면 낙하하며 아래를 연쇄로 친다 (GDD 7장) */
  | 'aerial'
  /** 관통 가능. 화살이 뚫고 지나간다. */
  | 'pierceable'

export interface Target {
  id: number
  alive: boolean
  kind: TargetKind
  x: number
  y: number
  px: number
  py: number
  vx: number
  vy: number
  /** 판정 반경 (m) */
  r: number
  /** 이동 과녁의 왕복 중심·진폭·주파수. moving이 아니면 무시. */
  baseX: number
  baseY: number
  ampX: number
  ampY: number
  freq: number
  /** 맞아서 낙하 중인가 (aerial) */
  falling: boolean
  /** 연쇄 깊이. 직격 = 0, 낙하물에 맞은 것 = 1, 그 다음 = 2 ... */
  chainDepth: number
  /** 기본 점수. 링 명중도로 배수가 붙는다. */
  score: number
}

// ───────────────────────────── 이벤트 ─────────────────────────────

/**
 * sim이 뱉는 이벤트. render/audio가 소비한다.
 * **sim은 이벤트를 배열에 push만 하고, 소비자는 읽고 비운다.**
 * sim이 렌더를 직접 호출하는 일은 없다 (ARCHITECTURE A1 레이어 분리).
 */
export type SimEvent =
  | { t: 'draw_start' }
  /** 만작 도달 */
  | { t: 'full_draw' }
  /** 발사. power=당김 0..1, err=릴리즈 총 오차 (rad) */
  | { t: 'release'; power: number; angle: number; err: number }
  /** 붕괴 — 스스로 놓아버림 */
  | { t: 'collapse' }
  /** 붕괴 경고 진입 (렌더/오디오가 예고를 시작) */
  | { t: 'warn_start' }
  | { t: 'hit'; targetId: number; x: number; y: number; score: number; /** 중심 명중도 0..1 */ accuracy: number; chain: number; combo: number }
  | { t: 'chain'; targetId: number; x: number; y: number; depth: number }
  | { t: 'miss'; x: number; y: number }
  | { t: 'stage_end'; cleared: boolean; score: number }

// ───────────────────────────── 스테이지 ─────────────────────────────

export interface TargetSpec {
  kind: TargetKind
  x: number
  y: number
  r?: number
  score?: number
  /** moving 전용 */
  ampX?: number
  ampY?: number
  freq?: number
}

export interface StageDef {
  id: string
  /**
   * 이 판의 이름 한 **단어** ('기둥', '바람골', '연쇄' …). **sim은 한 번도 읽지 않는다** —
   * HUD 머리글과 판 시작 자막이 쓰는 글자다. 스테이지 정의는 저작 데이터 뭉치라
   * 화면용 이름도 여기 같이 산다.
   *
   * ★ 짧아야 한다. 문장을 넣으면 자막이 화면을 가로지른다 — 그건 hint 의 자리다.
   */
  title?: string
  /** 이 판에서 무엇을 배우는가. 판 시작 자막의 둘째 줄. 없으면 안 그린다. */
  hint?: string
  /** 절차 생성·산포 재현을 위한 시드 */
  seed: number
  /** 지급 화살 수 (5~8, GDD 6장) */
  arrows: number
  /**
   * 별 2개의 점수 기준선. **클리어 조건이 아니다** — 클리어는 과녁 전멸이다(world.ts evaluateEnd).
   * game/rewards.ts가 이 값에 STAR2_MUL을 곱해 ★★ 문턱으로 쓰고, 훈련치 환산의 분모로도 쓴다.
   */
  targetScore: number
  /** 평균 풍속 (m/s). 0이면 무풍. */
  wind: number
  targets: readonly TargetSpec[]
  /** 제한 시간 (s). 없으면 무제한. */
  timeLimit?: number
}

// ───────────────────────────── 월드 ─────────────────────────────

export type WorldStatus = 'playing' | 'cleared' | 'failed'

export interface World {
  /** 고정 스텝 카운터. sim 내부의 유일한 시계. Date.now 금지 (A1). */
  tick: number
  /** 스텝 길이 (s). 1 / P.sim.hz. 생성 시 고정된다. */
  dt: number
  rng: Rng
  status: WorldStatus

  archer: ArcherState
  stats: Stats
  /** 고정 크기 풀. 배열 길이는 변하지 않는다 (A5). */
  arrows: Arrow[]
  targets: Target[]

  /** 현재 풍속 (m/s, +x 방향). 돌풍으로 변동. */
  wind: number
  windPhase: number

  /**
   * 이 판에 쓰는 화살 종류. 판 시작 전 드래프트가 정하고 판 내내 바뀌지 않는다 —
   * 그래서 화살마다 들고 다니지 않고 여기 하나만 둔다 (분열 자식도 같은 종류다).
   */
  arrowKind: ArrowKindId
  /** 위 종류의 효과판. arrowFx()가 돌려주는 공유 객체라 매 스텝 읽어도 할당이 없다 (A5). */
  fx: ArrowFx

  arrowsLeft: number
  score: number
  /** 현재 연쇄 콤보 수 */
  combo: number
  elapsed: number
  stage: StageDef

  /** 이번 스텝에 발생한 이벤트. 소비자가 읽고 length=0 으로 비운다. */
  events: SimEvent[]
}

// ───────────────────────────── 모듈 시그니처 ─────────────────────────────
//
// 구현자는 아래 시그니처를 정확히 지킨다. 이름·인자 순서를 바꾸면 통합이 깨진다.
//
//   sim/world.ts
//     export function createWorld(stage: StageDef, stats: Stats, arrow?: ArrowKindId): World
//     export function step(w: World, input: InputFrame): void   // 정확히 1 고정스텝
//     export function resetWorld(w: World, stage: StageDef, stats: Stats, arrow?: ArrowKindId): void
//
//   sim/bow.ts
//     export function stepArcher(w: World, input: InputFrame): void
//     export function effectiveStats(stats: Stats): DerivedStats   // 수확체감 적용된 물리 계수
//
//   sim/ballistics.ts
//     export function stepArrows(w: World): void
//     export function spawnArrow(w: World, angle: number, power: number): Arrow | null
//
//   sim/target.ts
//     export function stepTargets(w: World): void
//     export function resolveHit(w: World, arrow: Arrow, target: Target): void
//
//   render/*  — World를 읽기만 한다. 쓰면 결정론이 깨진다 (A1).
//   input/*   — InputFrame을 만들 뿐, World를 건드리지 않는다.

/** 스탯에서 파생된 물리 계수. bow.ts가 매 스텝 재계산하지 않도록 캐시해서 쓴다. */
export interface DerivedStats {
  /** 화살 속도 배수 */
  speedMul: number
  /** 만작 도달 시간 배수 (작을수록 빠름) */
  drawTimeMul: number
  /** 떨림 진폭 배수 (작을수록 안정) */
  tremorMul: number
  /** 최대 스태미나 */
  staminaMax: number
  /** 호흡정지 효율 배수 */
  steadyMul: number
  /**
   * 이 궁수가 도달할 수 있는 최대 당김 (0..1). 1.0 = 진짜 만작.
   * 초보는 1.0에 못 간다 — STR로 열린다. 성장 화면이 이 값을 보여준다.
   */
  maxDraw: number
}
