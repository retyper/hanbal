import { relicSum } from '../realm/relics.ts'
import type { Hero } from '../realm/types.ts'

/** 손 겨루기도 자동 겨루기와 같은 유물 무예를 쓴다. 장수의 기본 능력치는 바꾸지 않는다. */
export const duelMuOf = (hero: Pick<Hero, 'mu' | 'relics' | 'relicLv'>): number =>
  hero.mu + relicSum(hero, 'duel')
