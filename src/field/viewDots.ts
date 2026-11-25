/**
 * 대 → 낱낱 점 배치. 점 자리는 sim 상태에 넣지 않는다 — 대 id 와 점 번호로 렌더 전용 해시를 돌려 얻는다.
 * 같은 (id, k) 는 늘 같은 자리다. 사람이 줄면 뒤 번호 점부터 사라진다(앞 번호 점은 그대로).
 */
import { P } from '../tune/params.ts'

/** 32비트 정수 해시 (sim 난수와 따로) */
export function hash2(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15
  return h >>> 0
}
const unit01 = (h: number): number => h / 4294967296

/** 점의 대 안 자리 (칸 단위 · -1~1 에 폭을 곱한 것) */
export function dotOffset(squadId: number, k: number): { du: number; dv: number } {
  return {
    du: (unit01(hash2(squadId * 2 + 1, k)) * 2 - 1) * P.field.spreadUCells,
    dv: (unit01(hash2(squadId * 2 + 2, k)) * 2 - 1) * P.field.spreadVCells,
  }
}

/** 점마다 도는 빠르기·걸음이 겹치지 않게 하는 0~1 몫 */
export const dotPhase = (squadId: number, k: number): number => unit01(hash2(squadId * 2 + 3, k))

/**
 * 한 편의 대별 점 수. men[i] = 대 i 의 사람 수.
 * 대마다 clamp(round(men / menPerDotRef), min, max) → 저사양이면 lowShare‰ → 편 합이 dotsPerSide 를 넘으면 비례로 줄인다. 사람이 있는 대는 최소 1점.
 */
export function sideDotCounts(men: readonly number[], lowShare = 1000): number[] {
  const F = P.field
  const out = men.map(n => {
    if (n <= 0) return 0
    const raw = Math.min(F.dotsPerSquadMax, Math.max(F.dotsPerSquadMin, Math.round(n / F.menPerDotRef)))
    return Math.max(1, Math.round(raw * lowShare / 1000))
  })
  let sum = out.reduce((a, b) => a + b, 0)
  if (sum > F.dotsPerSide) {
    for (let i = 0; i < out.length; i++) if (out[i]! > 0) out[i] = Math.max(1, Math.floor(out[i]! * F.dotsPerSide / sum))
    sum = out.reduce((a, b) => a + b, 0)
    while (sum > F.dotsPerSide) {
      let bi = -1
      for (let i = 0; i < out.length; i++) if (out[i]! > 1 && (bi < 0 || out[i]! > out[bi]!)) bi = i
      if (bi < 0) break
      out[bi]!--; sum--
    }
  }
  return out
}
