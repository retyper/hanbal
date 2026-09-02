/**
 * 대장간 — 활 개조 (2026-09-02)
 *
 * 형: **"돈 쓸 곳을 좀 더 많이 마련해봐야 해. 돈을 벌고 싶어지도록."**
 *
 * 스탯(성장 화면)은 **몸**이다. 이건 **활**이다 — 활마다 따로, 영구, 세 부위, 각 3단.
 * 활을 바꾸면 그 활의 개조가 따라온다. "내 각궁은 시위까지 다 갈았다"가 활을 고르는 이유
 * 하나를 더 만든다 (STATUS 2순위 '활 업그레이드'가 이것이다).
 *
 * 규칙은 스탯과 같다: 값은 훈련치, 부분 지불 없음, 줄지 않는다. 다른 것 하나 — 효과는
 * **BowMods 배수**로만 들어간다 (game/bows.ts bowMods 의 마지막 곱). sim은 대장간을 모른다.
 *
 * 부위는 실물이다 (arrows.ts·bows.ts 와 같은 이름 규칙):
 *   시위(弦)   — 줄. 좋은 줄은 되돌아오는 게 빨라 만작에 빨리 닿는다.
 *   활채(弓幹) — 몸통. 반발이 세면 화살이 빠르다 → 피해는 속도의 제곱이라 체감이 가장 크다.
 *   줌통       — 손이 잡는 자리(줌피). 손에 붙으면 빨간 바 아래에서 덜 떨린다.
 */
import type { BowKindId } from './bows.ts'
import { P } from '../tune/params.ts'
import { writeSave, type SaveData } from './save.ts'

export type ForgePart = 'string' | 'limb' | 'grip'

export interface ForgePartDef {
  id: ForgePart
  name: string
  origin: string
  /** 무엇이 좋아지는가 — 한 줄. 화면은 여기에 단수의 % 를 붙인다. */
  hint: string
}

export const FORGE_PARTS: readonly ForgePartDef[] = [
  { id: 'string', name: '시위', origin: '弦', hint: '만작에 더 빨리 닿는다' },
  { id: 'limb', name: '활채', origin: '弓幹', hint: '화살이 빨라진다 — 피해는 속도의 제곱' },
  { id: 'grip', name: '줌통', origin: '줌피', hint: '빨간 바 아래에서 덜 떨린다' },
]

/** bowMods 가 먹는 세 단수. 없으면 전부 0. */
export interface ForgeLevels {
  string: number
  limb: number
  grip: number
}

export const NO_FORGE: Readonly<ForgeLevels> = { string: 0, limb: 0, grip: 0 }

export function forgeMax(): number {
  return Math.max(1, Math.floor(P.forge.maxLevel))
}

const key = (bow: BowKindId, part: ForgePart): string => `${bow}.${part}`

export function forgeLevel(d: SaveData, bow: BowKindId, part: ForgePart): number {
  const v = d.forge[key(bow, part)]
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  return Math.max(0, Math.min(forgeMax(), Math.floor(v)))
}

export function forgeLevels(d: SaveData, bow: BowKindId): ForgeLevels {
  return {
    string: forgeLevel(d, bow, 'string'),
    limb: forgeLevel(d, bow, 'limb'),
    grip: forgeLevel(d, bow, 'grip'),
  }
}

/** `level` → `level+1` 값 (훈련치). 단이 오를수록 비싸다. */
export function forgeCost(level: number): number {
  const l = level > 0 ? Math.floor(level) : 0
  return Math.max(1, Math.floor(P.forge.costBase + P.forge.costStep * l))
}

/** 이 단이 활에 얹는 배수 — 화면의 문장과 bowMods 가 **같은 식**을 쓴다. */
export function forgeMul(part: ForgePart, level: number): number {
  const l = level > 0 ? level : 0
  switch (part) {
    case 'string': return Math.max(0.2, 1 - P.forge.stringDraw * l)
    case 'limb': return 1 + P.forge.limbSpeed * l
    case 'grip': return Math.max(0, 1 - P.forge.gripTremor * l)
  }
}

/** 이 단의 효과를 사람 말로. 0단은 "그대로". */
export function forgeEffect(part: ForgePart, level: number): string {
  const m = forgeMul(part, level)
  const pct = Math.round(Math.abs(1 - m) * 100)
  if (pct === 0) return '그대로'
  switch (part) {
    case 'string': return `만작 시간 ${pct}% 단축`
    case 'limb': return `초속 +${pct}% · 피해 약 +${Math.round((m * m - 1) * 100)}%`
    case 'grip': return `떨림 ${pct}% 감소`
  }
}

/** 못 사는 이유. 살 수 있으면 빈 문자열 (defense.ts 와 같은 문법). */
export function forgeBlocked(d: SaveData, bow: BowKindId, part: ForgePart): string {
  const lv = forgeLevel(d, bow, part)
  if (lv >= forgeMax()) return '더 갈 데가 없다'
  const cost = forgeCost(lv)
  if (d.training < cost) return `훈련치 ${cost} 필요`
  return ''
}

/** 산다. 훈련치를 깎고 단을 올린다. 못 사면 아무것도 안 한다. */
export function buyForge(d: SaveData, bow: BowKindId, part: ForgePart): boolean {
  if (forgeBlocked(d, bow, part) !== '') return false
  const lv = forgeLevel(d, bow, part)
  d.training -= forgeCost(lv)
  d.forge[key(bow, part)] = lv + 1
  writeSave(d)
  return true
}

/** 지금 훈련치로 이 활에 갈 수 있는 부위가 하나라도 있는가. */
export function canForge(d: SaveData, bow: BowKindId): boolean {
  for (const p of FORGE_PARTS) if (forgeBlocked(d, bow, p.id) === '') return true
  return false
}
