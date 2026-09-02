/**
 * 활 — 수집 · 숙련 · 궁합 (docs/BOWS.md)
 *
 * 발라트로의 조커에서 가져온 원칙 하나: **활은 숫자가 아니라 규칙을 바꾼다.**
 * "점수 +10%" 같은 활은 여기 없다. 각 활은 물리 채널(당김·초속·떨림·산포·스태미나·바람)
 * 중 하나의 규칙을 크게 바꾸고, 반드시 다른 채널 하나로 대가를 치른다.
 *
 * sim은 이 파일을 모른다. 여기서 (활, 살, 숙련) → BowMods 로 전부 구워서
 * 판 경계에 resetWorld 로 넣는다 (A1 — 판 도중 불변).
 *
 * 이름 규칙은 화살(arrows.ts)과 같다: **실물이 먼저다.** 효과가 이름에 안 맞으면
 * 이름을 고치는 게 아니라 효과를 실물에 맞춘다.
 */
import type { ArrowKindId } from './arrows.ts'
import type { BowMods } from '../sim/types.ts'
import { P } from '../tune/params.ts'
import { clamp01, lerp } from '../core/math.ts'
import { forgeMul, NO_FORGE, type ForgeLevels } from './forge.ts'

export type BowKindId = 'practice' | 'gakgung' | 'longbow' | 'recurve' | 'compound'

export interface BowKind {
  id: BowKindId
  /** 실물의 이름 */
  name: string
  /** 한자·유래 한 줄 — 이름만으로 모르는 사람을 위한 자막 (arrows.ts origin과 같은 역할) */
  origin: string
  /** 장점 한 줄. 활 걸이에서 읽고 바로 고를 수 있어야 한다. */
  perk: string
  /** 대가 한 줄. **반드시 있다** — 대가 없는 활은 이전 활을 함정 선택지로 만든다. */
  cost: string
  /** 궁합 살과 그 효과 한 줄. 없으면 undefined. */
  synergy?: { arrow: ArrowKindId; label: string }
}

export const DEFAULT_BOW: BowKindId = 'practice'

export const BOW_KINDS: readonly BowKind[] = [
  {
    id: 'practice',
    name: '연습궁',
    origin: '나무 민활 · 처음 잡는 활',
    perk: '별난 것이 없다. 그래서 기준이 된다.',
    cost: '없음',
  },
  {
    id: 'gakgung',
    // 물소뿔·소 힘줄·대나무를 겹댄 복합궁. 짧고 효율이 높아 당김이 빠르고 화살이 매섭다.
    name: '각궁',
    origin: '角弓 · 물소뿔 복합궁, 국궁의 활',
    perk: '당김도 빠르고 화살도 매섭다.',
    cost: '예민하다 — 빨간 바 아래에서 더 떨린다.',
    // 편전(片箭)은 각궁에 통아를 얹어야만 쏠 수 있었다. 조선의 비기.
    synergy: { arrow: 'pierce', label: '애기살 → 편전(片箭): 관통 +1' },
  },
  {
    id: 'longbow',
    name: '장궁',
    origin: 'Longbow · 잉글랜드의 전쟁활',
    perk: '화살이 빠르고 무거워 바람을 덜 탄다.',
    cost: '무겁다 — 당김이 느리고, 근력이 모자라면 만작이 줄어든다.',
    synergy: { arrow: 'heavy', label: '육량전 → 전쟁화살: 관통 +1' },
  },
  {
    id: 'recurve',
    name: '리커브',
    origin: 'Recurve · 안정기를 단 현대 양궁',
    perk: '안정기 — 빨간 바 아래에서 덜 떨린다.',
    cost: '표적용 세팅이라 화살이 느리다.',
  },
  {
    id: 'compound',
    name: '컴파운드',
    origin: 'Compound · 도르래가 장력을 받아주는 활',
    perk: '렛오프 — 만작을 오래 유지해도 힘이 덜 빠진다.',
    cost: '도르래를 넘기느라 당김이 굼뜨다.',
  },
]

export function bowKind(id: BowKindId): BowKind {
  for (const b of BOW_KINDS) if (b.id === id) return b
  return BOW_KINDS[0] as BowKind
}

/** 세이브의 문자열이 진짜 활 id인지. 손상된 세이브 방어 (A4). */
export function isBowKindId(v: unknown): v is BowKindId {
  return typeof v === 'string' && BOW_KINDS.some((b) => b.id === v)
}

// ─────────────────────────── 숙련 ───────────────────────────
//
// Cave Story의 무기 성장에서 가져오되 벌(경험치 하락)은 버렸다 — 숙련은 줄지 않는다 (C2).
// 레벨은 장점을 키우지 않고 **대가를 깎는다.** 장점을 키우면 활 간 밸런스가 인플레된다.

/** 숙련 레벨 문턱 (그 활로 맞힌 누적 수). 해금 조건과 같은 원칙 — 깨다 보면 지나가는 값. */
export const MASTERY_HITS: readonly number[] = [30, 90, 200]

export function masteryLevel(hits: number): number {
  let lv = 0
  for (const need of MASTERY_HITS) if (hits >= need) lv++
  return lv
}

/** 숙련이 대가 배수를 중립(1)으로 끌어당긴 값. lv 3 × ease 0.25 = 대가의 75%가 사라진다. */
function eased(cost: number, lv: number): number {
  return lerp(cost, 1, clamp01(lv * P.bowkind.masteryEase))
}

// ─────────────────────────── BowMods 굽기 ───────────────────────────

/**
 * (활, 이번 판의 살, 숙련 레벨) → sim이 먹는 순수 배수 묶음.
 *
 * 궁합도 여기서 판정한다 — sim에 조합표를 두지 않기 위해서다 (docs/BOWS.md 4장).
 * 매 판 경계에서 새로 굽는다: 튜닝 콘솔이 P.bowkind 를 움직인 게 다음 판에 먹는다 (A2).
 */
export function bowMods(bow: BowKindId, arrow: ArrowKindId, lv: number, forge: Readonly<ForgeLevels> = NO_FORGE): BowMods {
  const K = P.bowkind
  const m: BowMods = {
    speedMul: 1,
    drawTimeMul: 1,
    tremorMul: 1,
    scatterMul: 1,
    holdDrainMul: 1,
    maxDrawAdd: 0,
    windMul: 1,
    pierceAdd: 0,
  }
  if (bow === 'gakgung') {
    m.drawTimeMul = K.gakDrawTime
    m.speedMul = K.gakSpeed
    m.tremorMul = eased(K.gakTremor, lv)
  } else if (bow === 'longbow') {
    m.speedMul = K.longSpeed
    m.windMul = K.longWind
    m.drawTimeMul = eased(K.longDrawTime, lv)
    // 만작 페널티는 가산이라 배수 완화와 식이 다르다 — 같은 비율로 0에 접근시킨다.
    m.maxDrawAdd = -K.longMaxDraw * (1 - clamp01(lv * K.masteryEase))
  } else if (bow === 'recurve') {
    m.tremorMul = K.recTremor
    m.scatterMul = K.recScatter
    m.speedMul = eased(K.recSpeed, lv)
  } else if (bow === 'compound') {
    m.holdDrainMul = K.compHoldDrain
    m.drawTimeMul = eased(K.compDrawTime, lv)
  }
  const syn = bowKind(bow).synergy
  if (syn !== undefined && syn.arrow === arrow) m.pierceAdd = Math.floor(K.synergyPierce)
  // ── 대장간 (game/forge.ts) — 마지막에 곱한다. 활의 성격(위)을 바꾸지 않고 그 위에 얹는 개조다.
  //    화면의 문장(forgeEffect)과 같은 식(forgeMul)을 쓴다 — 두 벌이면 어긋난다.
  m.drawTimeMul *= forgeMul('string', forge.string)
  m.speedMul *= forgeMul('limb', forge.limb)
  m.tremorMul *= forgeMul('grip', forge.grip)
  return m
}
