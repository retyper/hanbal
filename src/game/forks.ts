/**
 * 갈림길 2택 (docs/MEGAHIT.md §3) — 판이 끝나면 다음 판을 둘 중에 고른다.
 *
 * 2026-08-26, 형: "왜이렇게 밋밋하고 재미없냐" — MEGAHIT.md §8이 이미 답을 적어뒀다.
 * "지금 여정의 결정: 시작에 활+살통, 보스마다 보급 3택. **10판에 한 번.** 발라트로·StS는
 * **1~2판에 한 번** 결정을 준다. 그게 '한 판 더'의 진짜 엔진이다." 그 구멍을 여기서 메운다.
 *
 * ★ 새 화면을 열지 않는다 (C1). '다음 판' 힌트가 있던 자리에 카드 둘이 대신 선다.
 *   **건너뛰면 왼쪽(바람골)이 기본**이다 — 클릭은 있으면 좋고 없어도 3초 규칙이 안 깨진다.
 *   그래서 이 파일은 순수 함수만 있다. "고르지 않으면 무엇이 되는가"는 loop.ts의 상수 하나다.
 *
 * ★ 보스판에는 안 나온다. 보스는 이미 저작된 대결이고 처치 뒤엔 보급 3택이 따로 있다 —
 *   여기서 또 손대면 그 판의 무게가 갈림길 카드 하나로 희석된다.
 */
import { makeRng, seedFrom } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import type { ArrowKindId } from './arrows.ts'
import { BOSS_EVERY } from './stages.ts'
import type { StageDef, TargetSpec } from '../sim/types.ts'

export interface ForkOption {
  readonly id: 'wind' | 'dense'
  readonly title: string
  readonly desc: string
}

/**
 * MEGAHIT.md §3의 예시 그대로: 바람골(어렵게, 훈련치를 더) vs 밀집(과녁이 늘어, 화살 재고를 더).
 * 위험/보상이 다른 축이어야 한다는 조건도 여기서 지킨다 — 하나는 정확도·바람 읽기,
 * 하나는 탄약 배분·연속 조준으로 요구하는 실력의 결이 다르다.
 */
export const FORK_WIND: ForkOption = { id: 'wind', title: '바람골', desc: '바람이 강해진다 · 훈련치 ×1.15' }
export const FORK_DENSE: ForkOption = { id: 'dense', title: '밀집', desc: '과녁이 붙어 늘어난다 · 화살 재고 +1' }

/** 항상 이 순서 — 왼쪽(바람골)이 "건너뛰면 기본"이 되는 자리다. */
export const FORK_OPTIONS: readonly [ForkOption, ForkOption] = [FORK_WIND, FORK_DENSE]

/** 이 판 번호(1-based)에 갈림길을 보여줄 것인가. 보스판은 이미 저작된 대결이라 뺀다. */
export function hasFork(n: number): boolean {
  return n % BOSS_EVERY !== 0
}

/** 밀집 보상으로 돌아가는 특수살. 매번 애기살만 나오면 두 번째 선택이 지겨워진다 — 판마다 돈다. */
const DENSE_REWARD_POOL: readonly ArrowKindId[] = ['pierce', 'burst', 'chain', 'split', 'homing', 'heavy']

export function denseReward(n: number): ArrowKindId {
  const kind = DENSE_REWARD_POOL[n % DENSE_REWARD_POOL.length]
  return kind ?? 'pierce'
}

/** 바람골이 훈련치에 주는 배수 (P.fork.windTrainMul). gradeRun()에 그대로 곱해 넣는다. */
export function windTrainMul(): number {
  return P.fork.windTrainMul
}

/**
 * 이미 결정론적으로 구워진(getStage) 다음 판에 선택을 얹는다. **순수 함수** — 같은
 * 입력엔 항상 같은 판이 나온다 (A1). sim으로 넘어가기 전, game 레이어에서 한 번만 부른다.
 */
export function applyFork(stage: StageDef, opt: ForkOption, n: number): StageDef {
  if (opt.id === 'wind') {
    const floor = P.fork.windFloor
    return stage.wind >= floor ? stage : { ...stage, wind: floor }
  }
  return applyDense(stage, n)
}

/**
 * 밀집 — 이미 있는 과녁 중 몇을 골라 근처에 복제한다. **새 과녁 종류를 만들지 않는다** —
 * 11판+ 판은 이미 적 궁수·드론 같은 걸로 바뀌어 있는데(convertToFoes), 거기에 낯선
 * 'static' 과녁을 새로 끼워 넣으면 세계관이 깨진다. 있는 걸 복제하면 언제나 어울린다.
 */
function applyDense(stage: StageDef, n: number): StageDef {
  const cloneable = stage.targets.filter((t) => t.kind !== 'bonus' && t.kind !== 'boss' && t.kind !== 'charger')
  if (cloneable.length === 0) return stage

  const rng = makeRng(seedFrom(`hanbal.fork.dense.${n}`))
  const count = Math.min(Math.floor(P.fork.denseExtra), cloneable.length)
  const extra: TargetSpec[] = []
  for (let i = 0; i < count; i++) {
    const base = cloneable[rng.int(0, cloneable.length - 1)]
    if (base === undefined) continue
    const r = base.r ?? 0.3
    // 근처에 붙는다 — "밀집"이지 "흩어짐"이 아니다.
    extra.push({
      ...base,
      x: base.x + (rng.next() - 0.5) * r * P.fork.denseSpreadX,
      y: base.y + (rng.next() - 0.5) * r * P.fork.denseSpreadY,
    })
  }
  if (extra.length === 0) return stage

  const total = stage.targets.length + extra.length
  return {
    ...stage,
    targets: [...stage.targets, ...extra],
    // 는 만큼 화살도 준다 — 안 그러면 밀집이 "화살이 부족해지는 판"이 되어 벌이 아니라 벌칙이 된다.
    arrows: stage.arrows + extra.length,
    // ★★ 문턱도 같은 비율로 는다. 안 그러면 밀집을 고른 판이 별을 공짜로 더 준다.
    targetScore: Math.round((stage.targetScore * total) / stage.targets.length),
  }
}
