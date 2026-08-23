/**
 * 화살 종류 — 40판을 "40판 × 화살 조합"으로 만드는 장치 (docs/HOOK.md ★1)
 *
 * 이 파일이 들고 있는 건 **화면에 보이는 것**뿐이다: 이름과 한 줄 설명.
 * 계약(`ArrowKindId`)과 효과 수치(`ArrowFx`)는 sim의 것이다 —
 *   · `src/sim/types.ts`   : 화살이 자기 종류를 들고 다녀야 하므로 계약은 sim에 있다
 *   · `src/sim/arrowfx.ts` : 효과판. 숫자의 단일 출처는 `tune/params.ts`의 `arrowkind` 그룹 (A2)
 * 레이어 방향이 core ← sim ← game 이라(A1) game이 sim의 몸통에 손을 뻗을 수는 없고,
 * 반대로 sim이 이 파일의 한글 이름을 알 필요도 없다. 그래서 여기서 re-export만 한다.
 *
 * **해금 조건 문구는 여기 없다.** 조건을 판정하는 쪽은 `game/unlocks.ts`이고, 문구를 두 곳에
 * 두면 문턱을 튜닝하는 순간 한쪽이 조용히 거짓말을 한다. 화면은 `unlockHintFor(id)`를 쓴다.
 */
import { arrowFx } from '../sim/arrowfx.ts'
import type { ArrowKindId } from '../sim/types.ts'

export type { ArrowKindId } from '../sim/types.ts'
export type { ArrowFx } from '../sim/arrowfx.ts'
export { arrowFx } from '../sim/arrowfx.ts'

export interface ArrowKind {
  id: ArrowKindId
  /** 한글 이름. 국궁의 '살'을 붙여 통일한다 (A8 — 게임 용어는 GDD 표기를 따른다). */
  name: string
  /** 한 줄 설명. 카드에서 읽고 바로 고를 수 있어야 한다 — 효과가 즉시 이해돼야 한다. */
  desc: string
}

/**
 * 설명문의 숫자는 **효과판에서 뽑는다.** 손으로 적으면 튜닝 한 번에 화면이 거짓말을 하게 된다
 * (ui/growth.ts가 물리 계수에서 문장을 뽑는 것과 같은 규칙).
 * 거리(m)는 적지 않는다 — 플레이어에게 2.2m는 아무 의미가 없다. 개수와 배수만 적는다.
 *
 * 순서 = 대체로 해금되는 순서. 수집 화면과 결이 맞는다.
 */
export const ARROW_KINDS: readonly ArrowKind[] = [
  {
    id: 'basic',
    name: '기본 살',
    desc: '효과 없는 곧은 살.',
  },
  {
    id: 'burst',
    name: '폭발 살',
    desc: '맞은 자리 둘레의 과녁을 같이 친다.',
  },
  {
    id: 'chain',
    name: '사슬 살',
    desc: `맞으면 다음 과녁으로 튄다. 최대 ${arrowFx('chain').chainBounces}번.`,
  },
  {
    id: 'split',
    name: '분열 살',
    desc: `맞으면 ${arrowFx('split').splitCount}발로 갈라진다.`,
  },
  {
    id: 'homing',
    name: '유도 살',
    desc: '앞쪽 가장 가까운 과녁으로 살짝 휜다.',
  },
  {
    id: 'pierce',
    name: '관통 살',
    desc: `과녁을 뚫고 지나간다. 최대 ${arrowFx('pierce').pierceExtra}개 더.`,
  },
  {
    id: 'heavy',
    // 원안(HOOK.md)의 '점수 2배'는 밸런스 시뮬에서 전 판 지배로 판명나 빠졌다.
    // 지금의 정체성은 '가장 깊은 관통 + 바람에 안 밀림 + 느림'이다 (params.ts arrowkind 주석).
    name: '무거운 살',
    desc: `느리다. 대신 깊이 뚫고(최대 ${arrowFx('heavy').pierceExtra}개 더) 바람에 덜 밀린다.`,
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

/** 이 화살의 이름. HUD가 매 프레임 부를 수 있으므로 문자열을 만들지 않는다 (A5). */
export function arrowName(id: ArrowKindId): string {
  return BY_ID[id]?.name ?? ''
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
