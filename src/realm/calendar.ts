/**
 * 철과 길 — 계절 번호의 철, 철마다 막히는 길 (SYSTEMS §1-1 · §1-3)
 *
 * season.ts 와 economy.ts 가 함께 쓴다. 다른 realm 파일을 부르지 않는다 (고리를 만들지 않으려고 따로 뺐다).
 * 바깥에는 season.ts 가 그대로 다시 내보낸다.
 */
import type { REdge, SeasonOfYear } from './types.ts'

const SEASONS: readonly SeasonOfYear[] = ['spring', 'summer', 'autumn', 'winter']

export function seasonOf(n: number): SeasonOfYear {
  return SEASONS[((n % 4) + 4) % 4]!
}

/** 이 계절에 이 길이 막혔는가 (SYSTEMS §1-1 · §1-3) */
export function blockedWhy(ed: REdge, season: SeasonOfYear): 'winterPass' | 'summerFord' | null {
  if (ed.kind === 'pass' && season === 'winter') return 'winterPass'
  if (ed.kind === 'ford' && season === 'summer') return 'summerFord'
  return null
}
