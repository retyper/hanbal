/**
 * 시험·벤치용 시작 판 (본편 Side 에서 LiveSetup 을 짓는 liveSetupOf 는 L 카드가 만든다).
 * 한 편 사람 수 men 을 앞줄 절반 · 활 4분의 1 · 기병 4분의 1 로 나눈 같은 두 편. 맵은 기본 대로(meet).
 */
import { meetMap } from './map.ts'
import type { FieldMap, LiveSetup, LiveSide } from './types.ts'

export function plainSetup(seed: number, men: number, withHero = true, map: FieldMap = meetMap()): LiveSetup {
  const front = Math.trunc(men / 2), bows = Math.trunc(men / 4), horse = men - front - bows
  const side = (): LiveSide => ({ men: { front, bows, horse }, F: 0, morale: 700, hero: withHero ? { id: 'hero', mu: 50 } : null, player: false, seen: true })
  return { v: 1, key: `${map.rule}:${seed}:${men}`, seed, map, sides: [{ ...side(), player: true }, side()], night: false }
}
