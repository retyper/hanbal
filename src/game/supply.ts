/**
 * 보급 — 특수살은 해금이 아니라 **재고**다 (docs/RUN.md).
 *
 * 형의 요구 둘에서 나왔다: "처음부터 모두 해금되어 있으면 안 되고" + "특수한 화살들이라
 * 무제한으로 쓰면 안 될 것 같은데, 어떻게 해야 사용될 때 기쁘고 모아뒀다가 바꿔쓸 수 있을까."
 *
 * 답은 셋이다:
 *  1. **재고**: 특수살은 낱개로 세고, 한 판에 장전할 때 1 소모된다. 유엽전만 무한이다.
 *  2. **보스 보급**: 보스를 잡으면 3택 — 그 순간이 유일한 큰 획득처라 선택이 값지다.
 *  3. **깊이가 해금이다**: 몇 번째 보스인가(마디)가 보급 풀을 정한다. 잠긴 칸 목록이
 *     아니라 "더 깊이 가면 더 좋은 살이 나온다"가 수집의 동기가 된다.
 */
import type { ArrowKindId } from './arrows.ts'
import type { Rng } from '../core/rng.ts'

/** 보스 보급 한 번에 주는 발 수. */
export const SUPPLY_COUNT = 3

/**
 * 마디별 보급 풀. 얕은 보스는 기본 3종, 깊어질수록 강한 살이 섞인다.
 * 순서는 화살의 위력 순이 아니라 **배우는 순서**다 (효과가 읽기 쉬운 것부터).
 */
export function supplyPool(cycle: number): readonly ArrowKindId[] {
  const pool: ArrowKindId[] = ['burst', 'chain', 'split']
  if (cycle >= 2) pool.push('pierce')
  if (cycle >= 3) pool.push('heavy')
  // 신전은 마지막 보물이다 — 진짜 유도(homingTurn 2.6)가 된 대가로 가장 깊이 숨는다
  // (형: "확실하게 맞게 하되 얻기는 어렵게"). 넷째 보스 = 40판까지 가야 처음 본다.
  if (cycle >= 4) pool.push('homing')
  return pool
}

/**
 * 보급 3택을 뽑는다. 서로 다른 3종 — 같은 걸 두 장 주면 선택이 아니다.
 * rng는 보상 스트림(runRng)이다. sim의 w.rng를 쓰면 결정론이 깨진다 (A1).
 */
export function rollSupply(rng: Rng, cycle: number): ArrowKindId[] {
  const pool = [...supplyPool(cycle)]
  // 피셔-예이츠 앞 3장. 풀이 3 이하면 전부.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    const t = pool[i] as ArrowKindId
    pool[i] = pool[j] as ArrowKindId
    pool[j] = t
  }
  return pool.slice(0, Math.min(3, pool.length))
}
