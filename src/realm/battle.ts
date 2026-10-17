/**
 * 전투 판정 — 전투력 · 승률 · 결과 다섯 칸 · 기습 (docs/realm/SYSTEMS.md §3 · §4)
 *
 * 전부 순수 함수다. 굴림은 밖에서 core/rng.ts 의 roll() 로 만들어 넣는다 —
 * 그래야 같은 함수로 화면의 "확률 막대"(굴리기 전)와 판정(굴린 뒤)을 함께 낸다.
 * src/sim/ 과 같은 금지를 받는다: Math.random · Date.now · DOM (BUILD §1-1).
 */
import { P } from '../tune/params.ts'

/** 병종 (SYSTEMS §4-1). 기병은 부여·고구려만, 쇠뇌수는 바깥 세력만 쓴다 — 누가 쓰는지는 데이터가 정한다. */
export type UnitKind = 'spear' | 'bow' | 'pike' | 'shield' | 'horse' | 'crossbow' | 'boat'

/** 장비 단계 E (SYSTEMS §4-2) */
export type Equip = 'stone' | 'bronze' | 'ironTip' | 'iron' | 'leather' | 'ringSword'

/** 한쪽 군대의 판정 입력. 병력 구성은 비율이 아니라 사람 수로 둔다 — 합이 곧 N 이다. */
export interface Force {
  readonly mix: Readonly<Partial<Record<UnitKind, number>>>
  readonly equip: Equip
  /** 이끄는 장수의 무(武) 1~10. 장수가 없으면 1. */
  readonly mu: number
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
}

export const OPEN_FIELD: Field = { fort: 1, crossing: false, ambush: 'none', snipeAtk: 1, snipeDef: 1 }

/**
 * 상성 표 — 행이 이기면 ×counterUp, 지면 ×counterDown (SYSTEMS §4-1).
 * '트인 땅'·'숲' 같은 지형 조건은 R1 에 아직 없다 — 지형 꼬리표가 들어오는 R4 에서 판에 따라 끈다.
 */
const BEATS: Readonly<Record<UnitKind, readonly UnitKind[]>> = {
  spear: ['horse'],
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
export function leadMul(mu: number): number {
  return P.realm.leadBase + P.realm.leadPerMu * mu
}

/**
 * 전투력 F = N × E × L × M × T × S × X × 상성 (SYSTEMS §4-2)
 * `side` 가 어느 쪽인지에 따라 자리(Field)의 배수가 붙는다.
 */
export function power(me: Force, foe: Force, field: Field, side: 'atk' | 'def'): number {
  const R = P.realm
  let f = headcount(me) * equipMul(me.equip) * leadMul(me.mu) * me.morale * counterMul(me, foe)
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
  return headcount(f) * equipMul(f.equip) * leadMul(f.mu) * f.morale
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
