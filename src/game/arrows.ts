/**
 * 화살 종류 — 40판을 "40판 × 화살 조합"으로 만드는 장치 (docs/HOOK.md ★1)
 *
 * 이 파일이 정의하는 건 **무엇을 고르는가**뿐이다. 효과를 실제로 적용하는 건 sim이다
 * (sim/ballistics.ts · sim/target.ts). 여기서 sim을 import하지 않는 이유는 레이어 방향이다:
 * core ← sim ← game (ARCHITECTURE A1). game이 sim의 몸통에 손을 뻗으면 그 화살표가 뒤집힌다.
 *
 * ★ 통합 담당에게 — 아래 수치는 **임시 거처**다. 최종 자리는 둘로 갈린다.
 *   1) `ArrowKindId` → src/sim/types.ts (계약). 화살이 자기 종류를 들고 다녀야 하므로 sim의 것이다.
 *      옮긴 뒤 이 파일은 `export type { ArrowKindId } from '../sim/types.ts'` 로 바뀌면 된다.
 *   2) `ArrowFx`의 숫자 → src/tune/params.ts 의 `arrowkind` 그룹 (A2 단일 출처).
 *      params.ts의 flatKnobs()는 2단(그룹.노브)만 훑으므로 경로는 `arrowkind.pierceExtra` 처럼 평평해야 한다.
 *
 * 수치의 기준자: 이 게임의 과녁 반경은 판이 바뀌어도 대체로 0.4~0.9m다(stages.ts hFor 곡선이
 * 각크기를 유지하기 때문). 연쇄 기둥의 세로 간격은 1.4~2.4m, 기둥 사이 가로 간격은 6~8m다.
 * 폭발 반경·사슬 사거리는 전부 이 세 숫자를 보고 정했다.
 */

export type ArrowKindId = 'basic' | 'pierce' | 'burst' | 'split' | 'homing' | 'chain' | 'heavy'

export interface ArrowKind {
  id: ArrowKindId
  /** 한글 이름. 국궁의 '살'을 붙여 통일한다 (GDD A8 — 게임 용어는 GDD 표기를 따른다). */
  name: string
  /** 한 줄 설명. 카드에서 읽고 바로 고를 수 있어야 한다 — 효과가 즉시 이해돼야 한다. */
  desc: string
  /** 해금 조건 설명 (한글). basic은 빈 문자열. 조건 판정은 해금 담당의 몫이고 여기엔 문구만 있다. */
  unlockHint: string
}

// ───────────────────────────── 효과 명세 ─────────────────────────────

/**
 * 화살 하나가 sim에게 요구하는 것 전부. **종류마다 다른 필드가 아니라 같은 판을 쓴다** —
 * sim이 `if (kind === 'burst')` 같은 분기를 늘리지 않고 `fx.burstRadius > 0` 만 보면 되게.
 * 분기가 늘면 관통+무거움처럼 효과가 겹치는 종류에서 반드시 한쪽이 빠진다.
 *
 * 모든 값은 "효과 없음"이 0(배수는 1)이다. 기본 살은 전 항목이 중립이라 sim의 어느 분기도 타지 않는다.
 */
export interface ArrowFx {
  /** 원래라면 화살이 멈췄을 과녁을 **몇 개 더** 뚫고 지나가는가. 0이면 첫 명중에서 멈춘다. */
  readonly pierceExtra: number
  /** 한 번 뚫을 때 잃는 속도 비율. sim의 기존 식과 같게 `keep = 1 - accuracy * pierceLoss`. */
  readonly pierceLoss: number
  /** 명중 지점에서 이 반경(m) 안의 과녁을 같이 친다. 0이면 폭발하지 않는다. */
  readonly burstRadius: number
  /** 명중 후 갈라지는 자식 화살 수. 0이면 갈라지지 않는다. */
  readonly splitCount: number
  /** 자식 화살이 진행 방향에서 벌어지는 각 (rad). ±로 대칭 배분한다. */
  readonly splitAngle: number
  /** 자식 화살이 물려받는 속도 비율. */
  readonly splitSpeedKeep: number
  /** 초당 최대 선회각 (rad/s). 0이면 유도하지 않는다. */
  readonly homingTurn: number
  /** 이 거리(m) 안의 과녁만 빨아들인다. */
  readonly homingRange: number
  /** 발사 후 이만큼(s) 지나야 유도가 시작된다. 즉시 걸리면 조준이 장식이 된다. */
  readonly homingDelay: number
  /** 진행 방향 기준 이 각(rad) 안의 과녁만 노린다. 뒤로 돌아가지 않게 하는 빗장. */
  readonly homingCone: number
  /** 명중 후 다음 과녁으로 튀는 최대 횟수. 0이면 튀지 않는다. */
  readonly chainBounces: number
  /** 튈 수 있는 최대 거리 (m). */
  readonly chainRange: number
  /** 튈 때 물려받는 속도 비율. */
  readonly chainSpeedKeep: number
  /** 발사 초속 배수. */
  readonly speedMul: number
  /** 공기저항 배수. 무거운 살은 같은 항력에 덜 밀린다 — 바람 판(챕터 3)에서 이게 성격이 된다. */
  readonly dragMul: number
  /** 이 화살이 만든 점수 전부에 곱해진다 (연쇄·폭발로 딸려 죽은 과녁 포함). */
  readonly scoreMul: number
}

/** 효과 없음. 각 종류는 여기서 자기 항목만 덮어쓴다 — 새 필드를 추가해도 전 종류가 자동으로 안전하다. */
const NEUTRAL: ArrowFx = {
  pierceExtra: 0,
  pierceLoss: 0,
  burstRadius: 0,
  splitCount: 0,
  splitAngle: 0,
  splitSpeedKeep: 0,
  homingTurn: 0,
  homingRange: 0,
  homingDelay: 0,
  homingCone: 0,
  chainBounces: 0,
  chainRange: 0,
  chainSpeedKeep: 0,
  speedMul: 1,
  dragMul: 1,
  scoreMul: 1,
}

const FX_BASIC: ArrowFx = NEUTRAL

const FX_PIERCE: ArrowFx = {
  ...NEUTRAL,
  /** 2 = 한 발이 최대 3개를 친다. 일렬 배치(챕터 4)에서 판이 절반으로 접힌다. */
  // TODO(params): arrowkind.pierceExtra
  pierceExtra: 2,
  /**
   * 0.18. 기존 관통 과녁의 손실(P.arrow.pierceSpeedLoss = 0.5)보다 훨씬 작다 —
   * 저건 "뚫으라고 만든 과녁"이고 이건 "안 뚫리는 걸 뚫는" 것이라 손실이 크면
   * 두 번째 과녁이 항상 화살 아래로 떨어져 효과가 표에만 존재하게 된다.
   */
  // TODO(params): arrowkind.pierceLoss
  pierceLoss: 0.18,
}

const FX_BURST: ArrowFx = {
  ...NEUTRAL,
  /**
   * 2.2m. 연쇄 기둥의 세로 간격이 1.4~2.4m라 **위아래 하나는 확실히 물고**,
   * 기둥 사이 간격(6~8m)은 절대 못 넘는다. 이 경계가 "밀집 배치에서 폭발"의 정의다.
   * 3m를 넘기면 조준이 의미를 잃고, 1.5m 아래면 아무것도 안 딸려온다.
   */
  // TODO(params): arrowkind.burstRadius
  burstRadius: 2.2,
}

const FX_SPLIT: ArrowFx = {
  ...NEUTRAL,
  // TODO(params): arrowkind.splitCount
  splitCount: 2,
  /**
   * 0.30 rad(≈17°). 자식이 3m를 더 날면 옆으로 0.9m 벌어진다 — 과녁 반경(~0.5m)의 두 배쯤이라
   * 바로 옆이 아니라 **한 칸 건너**를 노리게 된다. 각이 너무 좁으면 원래 과녁 자리를 다시 지나고,
   * 너무 넓으면 화면 밖으로 나간다.
   */
  // TODO(params): arrowkind.splitAngle
  splitAngle: 0.30,
  // TODO(params): arrowkind.splitSpeedKeep
  splitSpeedKeep: 0.70,
}

const FX_HOMING: ArrowFx = {
  ...NEUTRAL,
  /**
   * 0.50 rad/s. 유도 구간을 0.3초쯤 탄다고 보면 옆으로 약 1.2m를 당겨준다 —
   * 과녁 반경의 2배 남짓. **빗나갈 뻔한 걸 살리는 크기지 조준을 대신하는 크기가 아니다.**
   * 이 값을 1.0 위로 올리면 이동 과녁 판이 통째로 자동조준이 된다.
   */
  // TODO(params): arrowkind.homingTurn
  homingTurn: 0.50,
  // TODO(params): arrowkind.homingRange
  homingRange: 14,
  /** 발사 직후부터 휘면 조준이 아니라 클릭이 되어버린다. 0.12초는 첫 3~6m다. */
  // TODO(params): arrowkind.homingDelay
  homingDelay: 0.12,
  /** 0.60 rad. 이 밖의 과녁은 없는 셈 친다 — 지나친 과녁으로 돌아가면 궤적이 안 읽힌다. */
  // TODO(params): arrowkind.homingCone
  homingCone: 0.60,
}

const FX_CHAIN: ArrowFx = {
  ...NEUTRAL,
  /** 2 = 한 발이 최대 3개. 콤보 배수(P.chain.comboMul)가 그대로 얹히므로 점수는 이보다 크게 뛴다. */
  // TODO(params): arrowkind.chainBounces
  chainBounces: 2,
  /**
   * 7.0m. 기둥 사이 가로 간격(6~8m)을 **아슬아슬하게** 넘는 거리다.
   * 이게 이 화살의 전부다 — 기둥을 붙여 세운 판에서만 화면이 무너진다.
   */
  // TODO(params): arrowkind.chainRange
  chainRange: 7.0,
  // TODO(params): arrowkind.chainSpeedKeep
  chainSpeedKeep: 0.85,
}

const FX_HEAVY: ArrowFx = {
  ...NEUTRAL,
  // TODO(params): arrowkind.heavyPierceExtra
  pierceExtra: 2,
  /** 관통 살의 절반. "관통력 2배"가 개수가 아니라 **덜 느려진다**로도 읽히게. */
  // TODO(params): arrowkind.heavyPierceLoss
  pierceLoss: 0.09,
  /**
   * 0.72. 40판(39m)에서는 낙차를 크게 잡아야 닿는다 — 그게 이 화살의 값이다.
   * 0.6 아래로 내리면 뒤 챕터에서 사거리가 아예 안 나온다 (밸런스 시뮬로 확인할 것).
   */
  // TODO(params): arrowkind.heavySpeedMul
  speedMul: 0.72,
  /** 무거우면 같은 항력에 덜 밀린다. 바람 판(챕터 3)에서 이 하나가 성격이 된다. */
  // TODO(params): arrowkind.heavyDragMul
  dragMul: 0.60,
  // TODO(params): arrowkind.heavyScoreMul
  scoreMul: 2,
}

const FX: Record<ArrowKindId, ArrowFx> = {
  basic: FX_BASIC,
  pierce: FX_PIERCE,
  burst: FX_BURST,
  split: FX_SPLIT,
  homing: FX_HOMING,
  chain: FX_CHAIN,
  heavy: FX_HEAVY,
}

// ───────────────────────────── 목록 ─────────────────────────────

/**
 * 설명문의 숫자는 **상수에서 뽑는다.** 손으로 적으면 튜닝 한 번에 화면이 거짓말을 하게 된다
 * (ui/growth.ts가 물리 계수에서 문장을 뽑는 것과 같은 규칙).
 * 거리(m)는 적지 않는다 — 플레이어에게 2.2m는 아무 의미가 없다. 개수와 배수만 적는다.
 */
export const ARROW_KINDS: readonly ArrowKind[] = [
  {
    id: 'basic',
    name: '기본 살',
    desc: '효과 없는 곧은 살.',
    unlockHint: '',
  },
  {
    id: 'burst',
    name: '폭발 살',
    desc: '맞은 자리 둘레의 과녁을 같이 친다.',
    unlockHint: '한 발로 과녁 2개를 없애면',
  },
  {
    id: 'homing',
    name: '유도 살',
    desc: '앞쪽 가장 가까운 과녁으로 살짝 휜다.',
    unlockHint: '이동 과녁 20회 명중',
  },
  {
    id: 'chain',
    name: '사슬 살',
    desc: `맞으면 다음 과녁으로 튄다. 최대 ${FX_CHAIN.chainBounces}번.`,
    unlockHint: '연쇄 10회 달성',
  },
  {
    id: 'split',
    name: '분열 살',
    desc: `맞으면 ${FX_SPLIT.splitCount}발로 갈라진다.`,
    unlockHint: '한 판을 화살 2발 남기고 클리어',
  },
  {
    id: 'pierce',
    name: '관통 살',
    desc: `과녁을 뚫고 지나간다. 최대 ${FX_PIERCE.pierceExtra}개 더.`,
    unlockHint: '20판 클리어',
  },
  {
    id: 'heavy',
    name: '무거운 살',
    desc: `느리다. 대신 뚫고 지나가고 점수가 ${FX_HEAVY.scoreMul}배.`,
    unlockHint: '정중앙 30회 명중',
  },
]

const BY_ID: Record<ArrowKindId, ArrowKind> = (() => {
  // 모듈 로드 때 한 번. 조회할 때마다 find()로 훑으면 드래프트 화면이 목록을 7번 훑는다.
  const out = {} as Record<ArrowKindId, ArrowKind>
  for (let i = 0; i < ARROW_KINDS.length; i++) {
    const kind = ARROW_KINDS[i]
    if (kind !== undefined) out[kind.id] = kind
  }
  return out
})()

export function arrowKind(id: ArrowKindId): ArrowKind {
  return BY_ID[id]
}

/** 이 화살이 sim에게 요구하는 것. **새 객체를 만들지 않는다** — 핫 루프에서 매 스텝 불려도 된다 (A5). */
export function arrowFx(id: ArrowKindId): ArrowFx {
  return FX[id]
}

/**
 * 세이브에서 읽은 문자열이 진짜 화살 종류인가.
 * 예전 세이브나 손상된 JSON이 `arrowFx('버섯')`으로 들어오면 undefined가 sim까지 흘러간다.
 * 해금 목록을 복원하는 쪽(save.ts)이 이걸로 한 번 거르고 넘긴다.
 */
export function isArrowKindId(v: unknown): v is ArrowKindId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(BY_ID, v)
}

/** 아무것도 안 고르고 시작했을 때의 화살. 건너뛰기(Esc)가 여기로 떨어진다 (제약 C1). */
export const DEFAULT_ARROW: ArrowKindId = 'basic'
