/**
 * 전투 판정 — 전투력 · 승률 · 결과 다섯 칸 · 기습 (docs/realm/SYSTEMS.md §3 · §4)
 *
 * 전부 순수 함수다. 굴림은 밖에서 core/rng.ts 의 roll() 로 만들어 넣는다 —
 * 그래야 같은 함수로 화면의 "확률 막대"(굴리기 전)와 판정(굴린 뒤)을 함께 낸다.
 * src/sim/ 과 같은 금지를 받는다: Math.random · Date.now · DOM (BUILD §1-1).
 */
import { P } from '../tune/params.ts'
import type { EdgeKind } from './types.ts'

/** 병종 (SYSTEMS §4-1). 기병은 부여·고구려만, 쇠뇌병은 바깥 세력만 쓴다 — 누가 쓰는지는 데이터가 정한다. */
export type UnitKind = 'spear' | 'bow' | 'pike' | 'shield' | 'horse' | 'crossbow' | 'boat'

/**
 * 장비 단계 E (SYSTEMS §4-2) — 쓰는 단계는 돌·나무(stone) → 청동(bronze) → 쇠날(ironTip, 날과 촉만 쇠) → 온 쇠(iron, 쇠 날에 쇠비늘 갑옷).
 * 고리칼(ringSword)은 그 위의 정예. 가죽(leather)은 옛 값 — 청동 단계로 친다 (kit.tierOf).
 * 철이 아니면 무엇으로 싸우나: 돌창·나무 방패·뼈촉 화살, 그리고 청동 날 (docs/realm/SYSTEMS §4-2).
 */
export type Equip = 'stone' | 'bronze' | 'ironTip' | 'iron' | 'leather' | 'ringSword'

/**
 * 병종마다 무장 (형: "창병 궁수 방패병 다르지 않나 · 무장해서 뽑으면 그 수도 파악이 되어야") —
 * 병종 → 단계 → 사람 수. 병종마다 단계의 합이 그 병종의 사람 수(mix)와 같다 (kit.ts 가 지킨다).
 */
export type Kit = Partial<Record<UnitKind, Partial<Record<Equip, number>>>>

/** 한쪽 군대의 판정 입력. 병력 구성은 비율이 아니라 사람 수로 둔다 — 합이 곧 N 이다. */
export interface Force {
  readonly mix: Readonly<Partial<Record<UnitKind, number>>>
  /** 병종마다 무장 — 있으면 장비 배수는 사람 수로 가중한 평균 (gearMul). 없으면 equip 하나로 */
  readonly kit?: Kit
  readonly equip: Equip
  /** 이끄는 장수의 지휘 1~10 — 무예와 통솔의 평균 (heroes.commandOf). 장수가 없으면 1. */
  readonly mu: number
  /** 궁수의 힘 배수 — 장수의 궁술·명궁 (heroes.bowMulOf). 없으면 1 */
  readonly bowMul?: number
  /** 사기 0.5 ~ 1.2 */
  readonly morale: number
}

/** 판정의 자리 — 방어측에만 걸리는 것, 공격측에만 걸리는 것. */
export interface Field {
  /** 방어측 지형·성 배수 T (목책 · 높은 터 · 산성 — 겹치면 곱한다). 없으면 1. */
  readonly fort: number
  /** 공격측이 강을 건너는 중인가 */
  readonly crossing: boolean
  /** 기습 S — 성공 · 들킴 · 없음 */
  readonly ambush: 'none' | 'success' | 'caught'
  /** 저격 X — 공격측·방어측 군대 F 전체에 한 번만 곱한다 (SNIPE). 없으면 1. */
  readonly snipeAtk: number
  readonly snipeDef: number
  /** 싸움이 난 길의 종류 — 공격측이 걸어온 길 · 들판 싸움이면 그 길 (병종의 지형 덤 roleMul). 없으면 지형 덤이 없다 */
  readonly edge?: EdgeKind
  /** 방어측이 기습을 당했다 — 방패병이 버틴다 */
  readonly ambushed?: boolean
  /** 포구 싸움 — 지키는 수군이 세다 */
  readonly port?: boolean
}

export const OPEN_FIELD: Field = { fort: 1, crossing: false, ambush: 'none', snipeAtk: 1, snipeDef: 1 }

/**
 * 상성 표 — 행이 이기면 ×counterUp, 지면 ×counterDown (SYSTEMS §4-1).
 * '트인 땅'·'숲' 같은 지형 조건은 R1 에 아직 없다 — 지형 꼬리표가 들어오는 R4 에서 판에 따라 끈다.
 */
// 창 → 방패 → 활 → 창 의 세모가 닫힌다 (창은 방패 벽을 찔러 뚫고, 방패는 화살을 막고, 활은 창병을 멀리서 쏜다)
const BEATS: Readonly<Record<UnitKind, readonly UnitKind[]>> = {
  spear: ['horse', 'shield'],
  bow: ['spear'],
  pike: ['horse'],
  shield: ['bow'],
  horse: ['bow'],
  crossbow: ['shield'],
  boat: [],
}

export function headcount(f: Force): number {
  let n = 0
  for (const v of Object.values(f.mix)) n += v ?? 0
  return n
}

export function equipMul(e: Equip): number {
  const R = P.realm
  switch (e) {
    case 'stone': return R.equipStone
    case 'bronze': return R.equipBronze
    case 'ironTip': return R.equipIronTip
    case 'iron': return R.equipIron
    case 'leather': return R.equipLeather
    case 'ringSword': return R.equipRingSword
  }
}

/**
 * 장비 배수 — 병종마다 무장(kit)이 있으면 사람 수로 가중한 평균. 그 병종의 kit 가 비었으면 equip 하나로 친다.
 * 같은 군대라도 쇠촉 궁수 40 · 돌창 창병 100 이면 그 비율대로 섞인다.
 */
export function gearMul(f: Force): number {
  const n = headcount(f)
  if (n <= 0 || f.kit === undefined) return equipMul(f.equip)
  let s = 0
  for (const [k, c] of Object.entries(f.mix) as Array<[UnitKind, number]>) {
    if (c <= 0) continue
    let tn = 0
    let ts = 0
    for (const [e, m] of Object.entries(f.kit[k] ?? {}) as Array<[Equip, number]>) {
      tn += m
      ts += m * equipMul(e)
    }
    s += c * (tn > 0 ? ts / tn : equipMul(f.equip))
  }
  return s / n
}

/**
 * 병종의 쓰임 — 공수·성·지형에 따라 (형: "창병 궁병 방패병 조합도 · 지형에따라 · 공격인지 방어인지에 따라") —
 *   궁수: 지킬 때 세다 · 성·높은 터 위에서 더 세다 · 숲길에서는 못 쏜다
 *   방패병: 지킬 때 세다 · 기습을 당해도 버틴다
 *   창병: 칠 때 세다 · 들판에서 세다 · 좁은 고갯길에서는 창을 못 휘두른다
 * 병종마다의 배수를 사람 수로 가중한 평균. 길(edge)을 모르면 지형 덤은 없다.
 */
export function roleMul(f: Force, field: Field, side: 'atk' | 'def'): number {
  const R = P.realm
  const n = headcount(f)
  if (n <= 0) return 1
  let s = 0
  for (const [k, c] of Object.entries(f.mix) as Array<[UnitKind, number]>) {
    if (c <= 0) continue
    let m = 1
    if (k === 'bow') {
      if (side === 'def') m *= 1 + R.roleBowDef
      if (side === 'def' && field.fort > 1) m *= 1 + R.roleBowWall
      if (field.edge === 'forest') m *= 1 - R.roleBowForest
    } else if (k === 'shield') {
      if (side === 'def') m *= 1 + R.roleShieldDef
      if (side === 'def' && field.ambushed === true) m *= 1 + R.roleShieldAmbush
    } else if (k === 'spear') {
      if (side === 'atk') m *= 1 + R.roleSpearAtk
      if (field.edge === 'field') m *= 1 + R.roleSpearField
      if (field.edge === 'pass') m *= 1 - R.roleSpearPass
    } else if (k === 'boat') {
      // 수군 — 물 위에서 세고 뭍에서 약하다. 포구를 지킬 때 배를 벽처럼 쓴다
      const e = field.edge
      if (e === 'ford' || e === 'reeds' || e === 'sea' || e === 'mudflat') m *= 1 + R.roleBoatWater
      else if (e !== undefined) m *= 1 - R.roleBoatLand
      if (side === 'def' && field.port === true) m *= 1 + R.roleBoatPort
    }
    s += c * m
  }
  return s / n
}

/** 한 병종이 다른 병종을 만났을 때의 배수 */
function pairMul(a: UnitKind, b: UnitKind): number {
  if (BEATS[a].includes(b)) return P.realm.counterUp
  if (BEATS[b].includes(a)) return P.realm.counterDown
  return 1
}

/**
 * 섞인 군대의 상성 — 내 병종 × 상대 병종의 쌍을 사람 수 비율로 가중 평균한다 (SYSTEMS §4-1).
 * 한쪽이 비었으면 1.
 */
export function counterMul(me: Force, foe: Force): number {
  const nm = headcount(me)
  const nf = headcount(foe)
  if (nm <= 0 || nf <= 0) return 1
  let sum = 0
  for (const [a, ca] of Object.entries(me.mix) as Array<[UnitKind, number]>) {
    for (const [b, cb] of Object.entries(foe.mix) as Array<[UnitKind, number]>) {
      sum += (ca / nm) * (cb / nf) * pairMul(a, b)
    }
  }
  return sum
}

/** 지휘 L = 바탕 + 무 × 계수 */
/** 싸우는 머릿수 — 궁수는 이끄는 장수의 궁술·명궁(bowMul)만큼 더 센다 (HEROES §1 · §2) */
export function fightHead(f: Force): number {
  return headcount(f) + ((f.bowMul ?? 1) - 1) * (f.mix.bow ?? 0)
}

export function leadMul(mu: number): number {
  return P.realm.leadBase + P.realm.leadPerMu * mu
}

/**
 * 전투력 F = N × E × L × M × T × S × X × 상성 × 쓰임 (SYSTEMS §4-2 · roleMul)
 * `side` 가 어느 쪽인지에 따라 자리(Field)의 배수가 붙는다.
 */
export function power(me: Force, foe: Force, field: Field, side: 'atk' | 'def'): number {
  const R = P.realm
  let f = fightHead(me) * gearMul(me) * leadMul(me.mu) * me.morale * counterMul(me, foe) * roleMul(me, field, side)
  if (side === 'def') {
    f *= field.fort * field.snipeDef
  } else {
    if (field.crossing) f *= R.crossing
    if (field.ambush === 'success') f *= R.ambushSuccess
    else if (field.ambush === 'caught') f *= R.ambushCaught
    f *= field.snipeAtk
  }
  return f
}

/**
 * 정보가 다루는 전투력 — 상대·자리를 빼고 군대 자체의 값 (N × E × L × M).
 * 척후가 "120~180" 처럼 보고하는 것은 이것이다. 실제 판정(power)은 여기에 상성·자리를 더 곱한다.
 */
export function strength(f: Force): number {
  return fightHead(f) * gearMul(f) * leadMul(f.mu) * f.morale
}

/** P(공격측 승) = Fa^k / (Fa^k + Fd^k). 둘 다 0 이면 반반. */
export function winChance(fa: number, fd: number): number {
  const k = P.realm.battleK
  const a = Math.pow(Math.max(0, fa), k)
  const d = Math.pow(Math.max(0, fd), k)
  return a + d === 0 ? 0.5 : a / (a + d)
}

export type Outcome = 'rout' | 'win' | 'draw' | 'lose' | 'routed'

/** 결과 다섯 칸의 확률 — 합은 언제나 1 (BUILD §3-1 불변식). 공격측 시점. */
export interface Bins {
  readonly rout: number
  readonly win: number
  readonly draw: number
  readonly lose: number
  readonly routed: number
}

/**
 * 교착 d = drawK · P · (1−P) 를 **양쪽에서 똑같이** 덜어 낸다 (SYSTEMS §4-3 — 검산 반영).
 * 예전처럼 방어 몫에서만 빼면 P > 0.9 에서 칸 합이 깨졌다.
 */
export function bins(p: number): Bins {
  const R = P.realm
  const pc = Math.min(1, Math.max(0, p))
  const d = R.drawK * pc * (1 - pc)
  const a = pc - d / 2
  const df = 1 - pc - d / 2
  return {
    rout: a * R.routShare,
    win: a * (1 - R.routShare),
    draw: d,
    lose: df * (1 - R.routShare),
    routed: df * R.routShare,
  }
}

/** 굴림 r ∈ [0,1) 을 칸에 떨어뜨린다. 칸 순서는 화면 막대의 왼→오와 같다. */
export function pick(b: Bins, r: number): Outcome {
  let acc = b.rout
  if (r < acc) return 'rout'
  acc += b.win
  if (r < acc) return 'win'
  acc += b.draw
  if (r < acc) return 'draw'
  acc += b.lose
  if (r < acc) return 'lose'
  return 'routed'
}

/** 결과에 따른 양쪽 손실 비율 (공격측, 방어측) */
export function losses(o: Outcome): { atk: number; def: number } {
  const R = P.realm
  switch (o) {
    case 'rout': return { atk: R.lossRoutWin, def: R.lossRoutLose }
    case 'win': return { atk: R.lossWin, def: R.lossLose }
    case 'draw': return { atk: R.lossDraw, def: R.lossDraw }
    case 'lose': return { atk: R.lossLose, def: R.lossWin }
    case 'routed': return { atk: R.lossRoutLose, def: R.lossRoutWin }
  }
}

/**
 * 진 쪽 장수의 운명 — 생포를 먼저 굴리고, 남은 몫에서 전사를 굴린다 (SYSTEMS §4-3 · §5-3).
 * 전사 = 바탕 전사 × (1 − 생포) 라 둘의 합이 1 을 넘지 않는다.
 * `bonus` 는 §5-3 의 가산 합 (발 묶음 · 중상 · 퇴로 차단 · 기습 성공 − 날랜 발 …). 결과가 교착이거나 이긴 쪽이면 0.
 */
export function fate(o: Outcome, bonus: number): { capture: number; death: number } {
  const R = P.realm
  const loserRouted = o === 'rout' || o === 'routed'
  const loserBeaten = o === 'win' || o === 'lose'
  if (!loserRouted && !loserBeaten) return { capture: 0, death: 0 }
  const base = loserRouted ? R.captureRout : R.captureLose
  const capture = Math.min(R.captureMax, Math.max(0, base + bonus))
  const death = (loserRouted ? R.deathRout : R.deathLose) * (1 - capture)
  return { capture, death }
}

/** 큰 군대는 잘 안 숨는다 — ambushFreeMen 넘는 100명마다 ambushPerHundred. ambushChance 의 trait 에 빼서 넣는다 */
export function ambushSizePenalty(men: number): number {
  const R = P.realm
  return Math.max(0, men - R.ambushFreeMen) / 100 * R.ambushPerHundred
}

/**
 * 기습 확률 (SYSTEMS §3)
 *   은폐(길·고을·계절) + 략 차이 × 계수 + 특성 보정 + 방심 − 경계 → [ambushMin, ambushMax]
 * 경계·방심은 각자의 상한으로 먼저 자른다 — 둘은 따로 센다.
 */
export function ambushChance(
  conceal: number,
  ryakAtk: number,
  ryakDef: number,
  trait: number,
  lull: number,
  alert: number,
): number {
  const R = P.realm
  const a = Math.min(R.alertMax, Math.max(0, alert))
  const l = Math.min(R.lullMax, Math.max(0, lull))
  const p = conceal + R.ambushPerRyak * (ryakAtk - ryakDef) + trait + l - a
  return Math.min(R.ambushMax, Math.max(R.ambushMin, p))
}
