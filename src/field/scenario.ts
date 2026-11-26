/**
 * 시험·벤치용 시작 판 (본편 Side 에서 LiveSetup 을 짓는 liveSetupOf 는 L 카드가 만든다).
 * 한 편 사람 수 men 을 앞줄 절반 · 활 4분의 1 · 기병 4분의 1 로 나눈 같은 두 편. 맵은 기본 대로(meet).
 */
import { ambushMap, crossMap, highMap, meetMap, mvpMap, stakeMap } from './map.ts'
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
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
  // 적 사람 수는 씨앗으로 mvpFoeMenPermille ± mvpFoeMenSpreadPermille (진이 자리를 다시 잡아 시작 흩음이 지워지므로 판마다 다른 것은 이것)
  const pm = P.field.mvpFoeMenPermille + Math.round((roll(seed, 0, 'mvp:foe') * 2 - 1) * P.field.mvpFoeMenSpreadPermille)
  const n = Math.round(men * pm / 1000), front = Math.trunc(n / 2), bows = Math.trunc(n / 4), horse = n - front - bows
  const kinds = (sd: LiveSide): LiveSide => ({ ...sd, form: 0, kinds: { spear: sd.men.front, bow: sd.men.bows, horse: sd.men.horse } })
  return { ...su, sides: [kinds(su.sides[0]), kinds({ ...su.sides[1], men: { front, bows, horse } })], mvp: true }
}

/** 실험실(lab.html)의 땅 — 평지(시험판 대로) · 높은 터 · 개울 · 목책 · 밤 기습 먹힘 · 기습 들킴 (map.ts 에 있는 것 그대로) */
export type LabMap = 'meet' | 'high' | 'cross' | 'stake' | 'ambushOk' | 'ambushBad'
export const LAB_MAPS: readonly LabMap[] = ['meet', 'high', 'cross', 'stake', 'ambushOk', 'ambushBad']
/** 실험실의 한 편 — 자리 1 가운데(앞줄 병종) · 2 뒷줄(활 병종) · 3·4 날개(기병 · 사람 수는 둘이 반씩) · 5 대장(장수) */
export interface LabSide { front: { kind: 'spear' | 'pike' | 'shield'; men: number }; bows: { kind: 'bow' | 'crossbow'; men: number }; horse: number }
/** 실험실 판 짜임 (기록에 그대로 남는다) — spread: 적 사람 수가 씨앗으로 흔들리는 폭(천분율) */
export interface LabConfig { v: 1; map: LabMap; sides: [LabSide, LabSide]; tricks: boolean; spread: number; seed: number }
/** 묶음 단추 — 고른 군 · 보병 많은 군 · 기병 많은 군 · 수가 적은 군(800) */
export const LAB_PRESETS: Readonly<Record<'even' | 'foot' | 'horse' | 'small', LabSide>> = {
  even: { front: { kind: 'spear', men: 600 }, bows: { kind: 'bow', men: 300 }, horse: 300 },
  foot: { front: { kind: 'spear', men: 800 }, bows: { kind: 'bow', men: 200 }, horse: 200 },
  horse: { front: { kind: 'spear', men: 400 }, bows: { kind: 'bow', men: 300 }, horse: 500 },
  small: { front: { kind: 'spear', men: 400 }, bows: { kind: 'bow', men: 200 }, horse: 200 },
}
export const LAB_DEFAULT: LabConfig = { v: 1, map: 'meet', sides: [LAB_PRESETS.even, LAB_PRESETS.even], tricks: false, spread: 100, seed: 7 }

export function labMap(m: LabMap): FieldMap {
  switch (m) {
    case 'high': return highMap()
    case 'cross': return crossMap()
    case 'stake': return stakeMap()
    case 'ambushOk': return ambushMap(true)
    case 'ambushBad': return ambushMap(false)
    default: return mvpMap()
  }
}

/** 실험실 판 — 짠 대로 두 편을 세우고 시험판 규칙(고르고 오른쪽 누름 · 명령 없으면 제자리)으로 · 적 사람 수는 씨앗으로 ± spread 천분율 */
export function labSetup(cfg: LabConfig, seed: number = cfg.seed): LiveSetup {
  const su = plainSetup(seed, 1200, true, labMap(cfg.map))
  const k = 1000 + Math.round((roll(seed, 0, 'lab:foe') * 2 - 1) * cfg.spread)
  const side = (base: LiveSide, l: LabSide, mul: number): LiveSide => {
    const front = Math.max(0, Math.round(l.front.men * mul / 1000)), bows = Math.max(0, Math.round(l.bows.men * mul / 1000)), horse = Math.max(0, Math.round(l.horse * mul / 1000))
    return { ...base, form: 0, men: { front, bows, horse }, kinds: { [l.front.kind]: front, [l.bows.kind]: bows, horse } }
  }
  return { ...su, key: `lab:${cfg.map}:${seed}`, sides: [side(su.sides[0], cfg.sides[0], 1000), side(su.sides[1], cfg.sides[1], k)], mvp: true, mvpTricks: cfg.tricks }
}
