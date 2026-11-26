/**
 * 시험·벤치용 시작 판 (본편 Side 에서 LiveSetup 을 짓는 liveSetupOf 는 L 카드가 만든다).
 * 한 편 사람 수 men 을 앞줄 절반 · 활 4분의 1 · 기병 4분의 1 로 나눈 같은 두 편. 맵은 기본 대로(meet).
 */
import { meetMap, mvpMap } from './map.ts'
import type { FieldMap, LiveSetup, LiveSide } from './types.ts'

export function plainSetup(seed: number, men: number, withHero = true, map: FieldMap = meetMap()): LiveSetup {
  const front = Math.trunc(men / 2), bows = Math.trunc(men / 4), horse = men - front - bows
  const side = (): LiveSide => ({ men: { front, bows, horse }, F: 0, morale: 700, hero: withHero ? { id: 'hero', mu: 50 } : null, player: false, seen: true })
  return { v: 1, key: `${map.rule}:${seed}:${men}`, seed, map, sides: [{ ...side(), player: true }, side()], night: false }
}

/**
 * 고르고 오른쪽 누름 시험판 (field.html?mvp) — 넓고 긴 대로(mvpMap) · 병종은 세모 상성 셋만(앞줄 창 · 활 활 · 기병 기병: 창 ▶ 기병 ▶ 활 ▶ 창 · KIND_BEATS) ·
 * 진은 두 편 다 하나로 못 박는다(진 고르기 없음) · 사람 편은 장수를 안 따라 제자리 (LiveSetup.mvp).
 */
export function mvpSetup(seed: number, men: number): LiveSetup {
  const su = plainSetup(seed, men, true, mvpMap())
  const kinds = (sd: LiveSide): LiveSide => ({ ...sd, form: 0, kinds: { spear: sd.men.front, bow: sd.men.bows, horse: sd.men.horse } })
  return { ...su, sides: [kinds(su.sides[0]), kinds(su.sides[1])], mvp: true }
}
