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
  /**
   * 화살 풀에서의 자리 번호. **평생 바뀌지 않는다** (풀은 고정 크기라 슬롯이 곧 신원이다).
   *
   * 왜 필요한가: 명중/빗나감 이벤트를 받은 렌더가 "그래서 **어느** 화살이?"를 알아야 한다.
   * 예전엔 좌표로 되짚었는데, 관통 살처럼 맞고도 계속 나는 화살은 명중 순간 아직 'flying'이라
   * 검색에 안 걸리고 **직전 화살의 시체**가 대신 뽑혔다 — 그 시체의 궤적은 궁수의 손에서
   * 시작하므로 화면에는 "손에서 화살이 하나 더 나가는" 것으로 보였다 (실제 재현 확인).
   */
  id: number
  alive: boolean
  /**
   * 이 화살의 종류와 효과판 — **발사 순간에 굳는다.** 판 도중 장전을 바꿔도(armArrow)
   * 이미 날아가는 화살은 제 성질대로 난다. world 수준 fx만 있던 시절에는 장전을 바꾸면
   * 공중의 화살까지 성질이 변했다.
   */
  kind: ArrowKindId
  /** arrowFx(kind)가 주는 공유 객체 참조라 발사마다 할당이 없다 (A5). */
  fx: ArrowFx
  /**
   * 마지막으로 맞힌 과녁 id. **몸집 큰 적(보스 r 1.6)의 재충돌 방지** — 화살이 원 안에
   * 여러 스텝 머무르면 걸음마다 다시 맞아 관통 예산과 사슬 도약을 그 자리에서 다 태웠다
   * (애기살이 적 궁수를 못 뚫고, 명적이 보스 몸속에서 도약을 소진하던 버그의 정체).
   */
  lastHit: number
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
  /** 겹쳐 세운 얇은 과녁. **관통력이 있는 살만** 뚫고 지나간다 (target.ts resolveHit). */
  | 'pierceable'
  /**
   * 돌진 — **궁수 쪽으로 다가온다.** 이 게임에서 유일하게 플레이어를 향해 오는 것.
   *
   * 닿으면 화살을 하나 빼앗고 사라진다. 그게 전부다 — 체력도, 게임 오버도 없다.
   * 왜 거기서 멈추나: 제약 C2("아무 때나 끊어도 손해가 없다")를 지켜야 한다.
   * 시간 압박을 만들되 **자리를 뜬 사람을 벌하지는 않는다** (탭이 숨으면 sim이 통째로 멈춘다, C3).
   */
  | 'charger'
  /**
   * 보급 — 맞히면 화살을 돌려준다.
   *
   * 과녁을 지우는 게 아니라 **자원을 버는** 유일한 과녁이다. 한 발을 써서 한 발 이상을
   * 벌 수 있으니, 늘 "먼저 저걸 쏠까"라는 판단이 생긴다.
   */
  | 'bonus'
  /**
   * 보스 — 10판마다 한 번, **거대한 것이 나를 향해 걸어온다** (docs/RUN.md 3장).
   *
   * 몸통은 여러 발을 받고(hp), 머리(위쪽 작은 원)는 치명타다. 궁수에게 닿으면
   * 그 판을 진다 = 여정 종료. 시간 압박이 아니라 **탄약 압박 + 조준 압박**이다.
   */
  | 'boss'
  /**
   * 적 궁수 — **나에게 활을 쏜다** (docs/RUN.md 6장). shootEvery 주기로, windup 동안
   * 당기는 게 보인 뒤에 쏜다. 예고 없는 피해는 없다 — 빨간 바와 같은 계약이다.
   * 먼저 잡으면 안 맞는다. 그게 이 적이 만드는 우선순위 판단이다.
   */
  | 'archer'

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
  /** 돌진 과녁의 속도 (m/s, 궁수 쪽으로). 다른 종류는 0. */
  speed: number
  /** 보급 과녁이 돌려주는 화살 수. 다른 종류는 0. */
  give: number
  /** 남은 맞을 수 (boss·archer). 다른 종류는 0 — 이 축을 안 쓴다는 뜻이다. */
  hp: number
  /** archer 전용 — 다음 발사 시각 (elapsed 기준). 그 windup 전부터 당기는 게 보인다. */
  fireAt: number
  /** archer 전용 — 갑옷을 입었는가. 몸통은 안 통한다: **헤드샷만이 답이다** (형의 주문). */
  armored: boolean
  /** archer 전용 — 조준 산포 배수. 1보다 작으면 정예다. */
  aimMul: number
  /** 판 시작 시점의 체력 (boss·archer). 체력 바의 분모다. */
  hpMax: number
  /**
   * 겉모습/행동 번호. boss: 0 눈알·1 갑주·2 쌍눈·3 폭주.
   * archer: 0 들판 궁수·1 창문의 사수·2 숨었다 쏘는 사수·3 드론 (11판+ 전환 — 형:
   * "1~10은 과녁이지만 그다음부터는 전부 적이어야").
   */
  look: number
  /**
   * 숨어 있는가 (archer look 2 — 창문에 숨었다가 나와서 쏜다). 숨은 동안은
   * 맞지 않고(엄폐) 쏘지도 않는다. 나오는 타이밍은 발사 예고(windup)에 묶인다.
   */
  hidden: boolean
  /** 개별 발사 주기 (s). 0이면 P.enemy.shootEvery. 무리가 클수록 벌려 화살비를 막는다. */
  firePeriod: number
  /** 체력 보급(bonus)이 돌려주는 기력. 0이면 화살 보급이다. */
  healGive: number
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
  | { t: 'release'; power: number; angle: number; err: number; kind: ArrowKindId }
  /** 붕괴 — 스스로 놓아버림 */
  | { t: 'collapse' }
  /** 붕괴 경고 진입 (렌더/오디오가 예고를 시작) */
  | { t: 'warn_start' }
  /** `arrow`는 화살 풀의 자리 번호 (Arrow.id). 소비자가 **어느 화살인지**를 좌표로 추측하지 않게 한다. */
  | { t: 'hit'; targetId: number; x: number; y: number; score: number; /** 중심 명중도 0..1 */ accuracy: number; chain: number; combo: number; /** 머리(약점) 명중 — 연출은 정중앙이 아니라 헤드샷을 띄운다 */ head: boolean; /** 적(궁수·보스·돌진)인가 — 사람 몸통에는 '정중앙'을 띄우지 않는다 */ foe: boolean; arrow: number }
  /** 연쇄는 화살이 아니라 낙하물·폭발이 일으킨다. 그래서 arrow 가 없다. */
  | { t: 'chain'; targetId: number; x: number; y: number; depth: number }
  /**
   * 폭발이 일어났다. **딸려 죽은 게 하나도 없어도 나간다** — 터진 건 터진 것이다.
   * radius 는 월드 미터. 렌더가 이걸로 불덩이 크기를 정한다.
   */
  | { t: 'burst'; x: number; y: number; radius: number }
  /** 돌진 과녁이 궁수에게 닿았다. 화살 `lost`발을 빼앗겼다. */
  | { t: 'escape'; x: number; y: number; lost: number }
  /** 보급을 맞혔다. hp=true면 기력, 아니면 화살 `gain`발. */
  | { t: 'pickup'; x: number; y: number; gain: number; hp: boolean }
  /** 적 궁수가 시위를 당기기 시작했다 — 예고. 렌더·소리가 이걸로 긴장을 만든다. */
  | { t: 'enemy_draw'; x: number; y: number }
  /** 적 화살이 날았다. */
  | { t: 'enemy_shot'; x: number; y: number }
  /** 적 화살이 과녁에 박혔다 — 과녁 뒤는 엄폐다. */
  | { t: 'deflect'; x: number; y: number }
  | { t: 'enemy_block'; x: number; y: number }
  /**
   * 맞았다. `hp` = 남은 체력. 0이면 이 판이 아니라 **여정이** 끝난다.
   * pin이면 화살이 몸에 박힌 것 — x·y(착탄점)·ang으로 렌더가 그 자리에 화살을 남긴다 (형:
   * "화살이 맞으면 박힌 채로 보여져야").
   */
  | { t: 'player_hit'; hp: number; x: number; y: number; ang: number; pin: boolean }
  | { t: 'miss'; x: number; y: number; arrow: number }
  /**
   * 중(中) — 한 발이 맞아서 연사가 한 칸 올랐다. `n` = 오른 뒤의 연속 수 (1부터).
   *
   * 'hit'과 따로 두는 이유: hit은 **과녁마다** 나가고(관통 한 발이 셋이면 셋),
   * 이건 **화살마다** 한 번이다. 활터의 북은 화살을 세지 과녁을 세지 않는다.
   */
  | { t: 'jung'; n: number }
  /** 몰기 진입/이탈. 연출과 소리가 이 **순간**을 받는다 (상태 자체는 World.molgi에 있다). */
  | { t: 'molgi'; on: boolean }
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
  /** charger 전용 — 궁수 쪽으로 다가오는 속도 (m/s). 없으면 P.target.chargeSpeed */
  speed?: number
  /** bonus 전용 — 맞히면 돌려주는 화살 수. 없으면 1 */
  give?: number
  /** boss·archer 전용 — 맞을 수. 없으면 boss는 P.target.bossHp, archer는 1 */
  hp?: number
  /** boss·archer — 겉모습/행동 번호 */
  look?: number
  /** archer 전용 — 개별 발사 주기 (s) */
  firePeriod?: number
  /** bonus 전용 — 맞히면 채우는 기력. give와 배타적으로 쓴다. */
  heal?: number
  /** archer 전용 — 첫 발사까지의 지연 (s). 없으면 P.enemy.shootEvery */
  fireDelay?: number
  /** archer·boss — 갑옷 (몸통 무효, 헤드샷/눈만 통한다). */
  armored?: boolean
  /** archer 전용 — 조준 산포 배수 (작을수록 정예). */
  aimMul?: number
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
  /**
   * 활의 물리 배수 (docs/BOWS.md). **판 경계에서만 바뀐다** — 판 도중에 바뀌면
   * 같은 시드가 다른 판이 된다 (A1). sim은 활의 이름·궁합·숙련을 모른다 —
   * game/bows.ts 가 그걸 전부 이 숫자 묶음으로 구워서 넣는다.
   */
  bow: BowMods
  /**
   * 활의 겉모습 (game/bows.ts BowKindId 문자열). **렌더만 읽는다** — sim의 어떤 계산에도
   * 들어가지 않는다. BowMods에 안 넣은 이유: 저긴 순수 숫자 묶음이라는 계약이 있다.
   */
  bowSkin: string

  /**
   * 플레이어 체력 (docs/RUN.md 6장). 판 경계에서 game 레이어가 넣고(여정 동안 이어진다),
   * 적의 화살·돌진이 깎는다. 0이 되면 판이 아니라 여정이 끝난다.
   */
  hp: number
  /** 적 화살 풀 (고정 크기, A5). 과녁과도 내 화살과도 부딪히지 않는다 — 오직 나만 노린다. */
  shots: EnemyShot[]

  arrowsLeft: number
  score: number
  /** 현재 연쇄 콤보 수 */
  combo: number

  /**
   * 연속 중(中) 수 — 연달아 맞힌 **화살**의 수 (과녁의 수가 아니다).
   * sim/flow.ts가 이걸로 만작 시간과 스태미나 소모를 깎는다. 실중이면 즉시 0이다.
   */
  flowHits: number
  /** 활도 안 잡고 내 화살도 안 날고 있는 시간 (s). P.flow.coolAfter를 넘으면 중(中)이 한 칸 식는다. */
  flowIdle: number
  /**
   * 몰기(沒技) — 한 순(5발)을 연달아 맞힌 상태. 국궁에서 그 판의 자랑이다.
   * 배수가 하한에 닿는 지점과 같아서 **몰기 = 속도의 천장**이다. 렌더·오디오가 읽는다.
   */
  molgi: boolean
  elapsed: number
  stage: StageDef

  /** 이번 스텝에 발생한 이벤트. 소비자가 읽고 length=0 으로 비운다. */
  events: SimEvent[]
}

/** 적 궁수가 쏜 화살 하나. 내 화살(Arrow)보다 훨씬 단순하다 — 효과도 관통도 없다. */
export interface EnemyShot {
  alive: boolean
  x: number
  y: number
  px: number
  py: number
  vx: number
  vy: number
}

// ───────────────────────────── 모듈 시그니처 ─────────────────────────────
//
// 구현자는 아래 시그니처를 정확히 지킨다. 이름·인자 순서를 바꾸면 통합이 깨진다.
//
//   sim/world.ts
//     export function createWorld(stage: StageDef, stats: Stats, arrow?: ArrowKindId, bow?: BowMods): World
//     export function step(w: World, input: InputFrame): void   // 정확히 1 고정스텝
//     export function resetWorld(w: World, stage: StageDef, stats: Stats, arrow?: ArrowKindId, bow?: BowMods): void
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

/**
 * 활이 물리에 곱하는 값들. 전부 1(가산은 0)이면 연습궁(중립)이다.
 *
 * 필드가 배수/가산의 평평한 묶음인 이유: sim이 활의 정체성을 알 필요가 없어야
 * 결정론 검증이 "같은 BowMods = 같은 판"으로 끝나기 때문이다 (A1).
 */
export interface BowMods {
  /** 화살 초속 배수 */
  speedMul: number
  /** 만작 도달 시간 배수 (작을수록 빠름) */
  drawTimeMul: number
  /** 빨간 바 아래 떨림 배수. 안전 구간은 이미 0이라 계약을 건드리지 않는다 */
  tremorMul: number
  /** 릴리즈 산포 배수 (같은 이유로 안전 구간 밖에서만 의미가 있다) */
  scatterMul: number
  /** 만작 유지(phase full) 스태미나 소모 배수 — 컴파운드의 렛오프 */
  holdDrainMul: number
  /** 만작 한계 가산 (장궁 음수 — STR로 극복한다) */
  maxDrawAdd: number
  /** 바람(공기 속도) 체감 배수 — 무거운 화살은 덜 밀린다 */
  windMul: number
  /** 궁합의 관통 예산 가산 (각궁×애기살=편전 · 장궁×육량전) */
  pierceAdd: number
}

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
