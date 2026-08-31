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
  /**
   * 이름. **실제 국궁에서 쓰는 화살 이름을 쓴다.**
   *
   * 예전엔 '폭발 살'·'분열 살'처럼 효과에 '살'을 붙인 조어였다. 형의 지적:
   * "화살 이름들이 그게 현실적으로 쓰는 말인가?" — 아니었다.
   * ('살'은 국궁에서 화살을 부르는 진짜 말이 맞다. 문제는 앞에 붙인 효과 이름 쪽이었다.)
   *
   * 이제 실제로 있던 살들을 가져다 붙였다. 없는 효과(유도)만 옛 문헌의 표현을 빌린다.
   * 효과와 이름이 억지로 안 맞으면 이름을 고르는 게 아니라 **효과를 그 이름에 맞춘다** —
   * 애기살이 관통인 건 실제로 애기살이 관통력으로 유명했기 때문이다.
   */
  name: string
  /** 한자·유래 한 줄. 이름만으로는 뭔지 모르는 사람을 위한 자막이다. */
  origin: string
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
    name: '유엽전',
    origin: '柳葉箭 · 버들잎 촉',
    desc: '가장 흔히 쓰는 살. 별난 것이 없다.',
  },
  {
    id: 'burst',
    name: '화전',
    origin: '火箭 · 불화살',
    desc: '떨어진 자리에서 터진다 — 빗나가 땅에 꽂혀도. 발치에 떨어뜨리면 나도 다친다.',
  },
  {
    id: 'chain',
    name: '명적',
    origin: '鳴鏑 · 우는살',
    desc: `울며 날아 다음 과녁으로 옮겨 붙는다. 최대 ${arrowFx('chain').chainBounces}번.`,
  },
  {
    id: 'split',
    name: '세전',
    origin: '細箭 · 가는 살',
    desc: `맞으면 ${arrowFx('split').splitCount}발로 갈라진다.`,
  },
  {
    id: 'homing',
    name: '신전',
    origin: '神箭 · 빗나가지 않는 살',
    desc: '앞쪽 가장 가까운 과녁으로 살짝 휜다.',
  },
  {
    id: 'pierce',
    // 애기살(편전)은 통아에 얹어 쏘는 짧은 살이다. 조선의 비기로 불릴 만큼
    // 사거리와 갑옷 관통이 유명했다 — 효과를 이름에 맞춘 게 아니라 이름이 효과였다.
    // 2026-08-25: 물리를 질량·단면적에서 파생시키니(sim/arrowfx.ts) 그 명성이 그대로 나왔다 —
    // 가벼워서 가장 빠르고, 가늘어서 단면밀도가 가장 높다.
    name: '애기살',
    origin: '片箭 · 통아에 얹어 쏘는 짧은 살',
    desc: `가장 빠르고 곧게 난다. 갑옷을 뚫는다. 과녁도 최대 ${arrowFx('pierce').pierceExtra}개 더 뚫는다.`,
  },
  {
    id: 'heavy',
    // 원안(HOOK.md)의 '점수 2배'는 밸런스 시뮬에서 전 판 지배로 판명나 빠졌다.
    // 2026-08-25, 형의 반려로 **갑옷의 열쇠**가 붙었다 (sim/arrowfx.ts armorPierce).
    // 여섯 냥짜리 전쟁용 살이 판금을 못 뚫으면 그 살은 존재할 이유가 없다.
    // 이게 이 살의 정체성이다 — 설명에서 **맨 앞에** 온다.
    name: '육량전',
    origin: '六兩箭 · 여섯 냥짜리 무거운 살',
    desc: `가장 무겁고 가장 아프다. 갑옷을 뚫는다. 느리지만 깊이 뚫고(최대 ${arrowFx('heavy').pierceExtra}개 더) 바람에 덜 밀린다.`,
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
