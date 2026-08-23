/**
 * 판 시작 전 3택 (docs/HOOK.md ★1)
 *
 * 이 파일의 유일한 책임: **해금된 화살 중에서 서로 다른 3장을 시드 난수로 뽑는다.**
 * 무엇이 해금됐는지는 모른다 — 목록을 받기만 한다 (해금 판정은 다른 담당).
 *
 * ★ Math.random을 쓰지 않는 이유는 여기가 sim이어서가 아니다(game 레이어다).
 *   같은 시드가 같은 3택을 내야 밸런스 시뮬(tools/balance-sim.ts)이 "화살별 클리어율"을
 *   잴 수 있기 때문이다. 화살마다 결과가 달라지는지는 HOOK.md 4장의 검증 기준 1번이고,
 *   3택이 매번 달라지면 그 수치를 아예 못 만든다.
 *
 * ★ 호출자에게: **w.rng를 그대로 넘기지 마라.** 드래프트가 sim 스트림을 한 칸 밀면
 *   같은 시드의 같은 판이 다른 판이 된다 (A1). `rng.fork()` 로 뽑은 하위 스트림이나
 *   판마다 전진하는 별도 시드를 넘긴다 (보고서 참조).
 */
import { clamp01, lerp } from '../core/math.ts'
import type { Rng } from '../core/rng.ts'
import { ARROW_KINDS, type ArrowKindId } from './arrows.ts'

export interface DraftOffer {
  kinds: readonly ArrowKindId[]
  rerolled: boolean
}

/** 한 번에 보여주는 카드 수. 3보다 많으면 고르는 게 아니라 읽는 게 된다 (제약 C1). */
export const DRAFT_SIZE = 3

/**
 * 가중치가 [초반값 → 후반값]으로 옮겨가는 데 걸리는 판 수.
 * 20판이면 챕터 2가 끝날 무렵 후반 성향에 거의 닿는다.
 */
// TODO(params): draft.rampStages
const RAMP_STAGES = 20

/**
 * [초반 가중치, 후반 가중치]. 최대비가 1.8:1을 넘지 않는다 — **과하게 하지 않는다.**
 * 세게 걸면 "3택"이 아니라 "정해진 카드 + 들러리 2장"이 되고, 그러면 판마다 결과가
 * 달라진다는 이 시스템의 존재 이유가 사라진다.
 *
 * 초반이 높은 것(폭발·유도)은 **한 번 쏘면 무슨 일이 일어났는지 눈으로 바로 보이는** 화살이고,
 * 후반이 높은 것(분열·사슬·무거운)은 배치를 읽고 골라야 값을 하는 화살이다.
 */
// TODO(params): draft.weight* (7종 × 2값. 노브로 뺄지 여기 둘지는 밸런스 시뮬 결과를 보고 정한다)
const WEIGHT: Record<ArrowKindId, readonly [number, number]> = {
  // 기본 살은 카드로 나오지 않는다. 건너뛰기가 곧 기본 살이라 카드로도 내면 같은 선택지가 둘이 된다.
  basic: [0, 0],
  burst: [1.35, 0.95],
  homing: [1.25, 0.95],
  pierce: [1.0, 1.1],
  chain: [0.85, 1.25],
  split: [0.8, 1.3],
  heavy: [0.75, 1.2],
}

/** 알 수 없는 id(예전 세이브·손상)를 조용히 거르기 위한 집합. 모듈 로드 때 한 번 만든다. */
const KNOWN = new Set<string>(ARROW_KINDS.map((k) => k.id))

function weightOf(id: ArrowKindId, stageIndex: number): number {
  const w = WEIGHT[id]
  const t = RAMP_STAGES > 0 ? clamp01(stageIndex / RAMP_STAGES) : 1
  return lerp(w[0], w[1], t)
}

/**
 * 카드로 오를 수 있는 후보를 고른다. 중복·미지의 id·기본 살을 걷어낸다.
 * (중복 제거는 방어가 아니라 필수다 — 같은 화살이 3장 나오면 그건 3택이 아니다.)
 */
function candidates(unlocked: readonly ArrowKindId[]): ArrowKindId[] {
  const out: ArrowKindId[] = []
  for (let i = 0; i < unlocked.length; i++) {
    const id = unlocked[i]
    if (id === undefined || id === 'basic') continue
    if (!KNOWN.has(id)) continue
    if (out.indexOf(id) >= 0) continue
    out.push(id)
  }
  return out
}

/**
 * 해금된 화살에서 최대 3장. 해금이 모자라면 있는 만큼만 준다 (0장도 정상이다 —
 * 그 경우 화면을 띄우지 않고 기본 살로 바로 시작한다. ui/draft.ts가 처리한다).
 *
 * @param stageIndex 0부터. 세이브의 save.stageIndex와 같은 축이다.
 */
export function rollDraft(
  rng: Rng,
  unlocked: readonly ArrowKindId[],
  stageIndex: number,
): DraftOffer {
  // 판 시작에 한 번만 도는 함수다. 여기서의 배열 두 개는 핫 루프 할당이 아니다 (A5).
  const pool = candidates(unlocked)
  const weights: number[] = []
  let total = 0
  for (let i = 0; i < pool.length; i++) {
    const id = pool[i]
    // 가중치 0인 화살은 애초에 후보에서 빠지지만, 노브가 0으로 내려가도 뽑기가 멈추지 않게 바닥을 둔다.
    const w = id === undefined ? 0 : Math.max(weightOf(id, stageIndex), 1e-6)
    weights.push(w)
    total += w
  }

  const kinds: ArrowKindId[] = []
  const want = pool.length < DRAFT_SIZE ? pool.length : DRAFT_SIZE
  for (let n = 0; n < want; n++) {
    // 비복원 추출. 뽑은 칸의 가중치를 0으로 눕히고 합계에서 뺀다 — 배열을 다시 만들지 않는다.
    let r = rng.next() * total
    let picked = -1
    for (let i = 0; i < pool.length; i++) {
      const w = weights[i]
      if (w === undefined || w <= 0) continue
      r -= w
      if (r <= 0) {
        picked = i
        break
      }
    }
    // 부동소수점 누적으로 r이 끝까지 안 떨어질 수 있다. 마지막 살아있는 칸으로 떨어뜨린다.
    if (picked < 0) {
      for (let i = pool.length - 1; i >= 0; i--) {
        const w = weights[i]
        if (w !== undefined && w > 0) {
          picked = i
          break
        }
      }
    }
    if (picked < 0) break
    const id = pool[picked]
    const w = weights[picked]
    if (id === undefined || w === undefined) break
    kinds.push(id)
    weights[picked] = 0
    total -= w
  }

  return { kinds, rerolled: false }
}

/**
 * 같은 규칙으로 다시 뽑되 `rerolled`를 세운다. 후보가 4개 이상이면 **한 번만** 재시도해
 * 직전과 완전히 같은 손패가 나오는 걸 피한다 (다시 뽑았는데 그대로면 버튼이 고장 나 보인다).
 * 무한 재시도는 하지 않는다 — 결정론이 걸린 난수를 결과가 마음에 들 때까지 돌리는 건
 * 시드가 판을 정한다는 약속을 깨는 짓이다.
 */
export function rerollDraft(
  rng: Rng,
  unlocked: readonly ArrowKindId[],
  stageIndex: number,
  prev: DraftOffer,
): DraftOffer {
  let next = rollDraft(rng, unlocked, stageIndex)
  if (candidates(unlocked).length > DRAFT_SIZE && sameSet(next.kinds, prev.kinds)) {
    next = rollDraft(rng, unlocked, stageIndex)
  }
  return { kinds: next.kinds, rerolled: true }
}

function sameSet(a: readonly ArrowKindId[], b: readonly ArrowKindId[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const id = a[i]
    if (id === undefined || b.indexOf(id) < 0) return false
  }
  return true
}

/**
 * 이 손패로 화면을 띄울 값이 있는가. 0장이면 고를 게 없으니 화면을 띄우지 않는다 —
 * 아무것도 못 고르는 패널을 한 번 닫게 만드는 건 "탭 복귀 3초 안에 첫 발"(C1)을 갉아먹는 짓이다.
 */
export function draftNeeded(offer: DraftOffer): boolean {
  return offer.kinds.length > 0
}
