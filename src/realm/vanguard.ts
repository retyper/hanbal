import { HAEBI_VANGUARD as V } from '../tune/params.ts'
import type { Hero } from './types.ts'
export type Breakthrough = 0 | 1 | 2 | 3
export const isBreakthrough = (x: unknown): x is Breakthrough => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 3
export const canVanguard = (h: Pick<Hero, 'id' | 'ascended'>) => h.id === 'tut-haebi' && h.ascended === true
export function breakthroughReward(n: Breakthrough) { return { power: V.frontPower[n], loss: V.frontLoss[n] } }
export function breakthroughText(n: Breakthrough) {
  const r = breakthroughReward(n)
  return n === 0 ? '돌파 없음 · 추가 효과 없이 본편 합전을 계속합니다. 각성은 유지됩니다.' : `${n}/3 돌파 · 적 앞줄 ${Math.round(r.loss * 100)}% 손실 · 이번 합 아군 앞줄 힘 +${Math.round((r.power - 1) * 100)}%`
}
