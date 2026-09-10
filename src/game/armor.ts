/**
 * 갑옷 세 벌 — 고르고, 담금질한다 (2026-09-10)
 *
 * 형: **"캐릭터 방어구도 못생겼고 방어구는 고를 수도, 더 강화시킬 수도 없잖아."**
 *
 * 그동안 갑옷은 두정갑 하나뿐이었고, 판 도중에 겹쳐 입는 것이 전부였다 (game/defense.ts).
 * 이제 셋이다 — 가죽갑(皮甲) · 두정갑(頭釘甲) · 찰갑(札甲). 셋은 **같은 물건의 다른 크기**다:
 * 한 벌의 방어량·겹쳐 입는 상한·값이 전부 같은 배수(P.defense.armorLightMul / HeavyMul)로 움직인다.
 * 무거운 갑옷은 더 받고 더 비싸다. 그것이 선택이다 — 여정 초반의 얇은 지갑엔 가죽이 맞고,
 * 깊은 판의 화살비엔 찰갑이 맞다.
 *
 *   · **장만** — 두정갑·찰갑은 출정 화면에서 훈련치로 한 번 산다 (armorUnlock*). 가죽갑은 처음부터.
 *   · **입기** — 출정 화면에서 고른다 (save.armorKind). 판 도중에 사는 '갑옷'은 **입은 그 벌**이다.
 *   · **담금질** — 대장간에서 벌마다 세 단. 단마다 방어량과 상한이 armorForgePer 만큼 오른다.
 *     값은 활 개조와 같은 곡선(forgeCost) — 같은 지갑이라 "활채를 갈까, 갑옷을 담글까"가 저울이 된다.
 *
 * 렌더는 벌마다 다르게 그린다 (render/stickman.ts — 가죽 조끼 / 천 위의 쇠징 / 엮은 쇠비늘).
 * sim 은 벌을 모른다 — 방어량 숫자만 받는다 (World.armor). 겉모습은 World.armorLook 으로 건넨다.
 */
import { P } from '../tune/params.ts'
import { forgeCost } from './forge.ts'
import { writeSave, type SaveData } from './save.ts'

export type ArmorKindId = 'leather' | 'brigandine' | 'lamellar'

export interface ArmorKind {
  id: ArmorKindId
  name: string
  origin: string
  /** 한 줄 — 무엇이 다른가. */
  hint: string
  /** 렌더의 생김새 번호 (World.armorLook). 0 가죽 · 1 두정 · 2 찰갑. */
  look: number
}

export const ARMOR_KINDS: readonly ArmorKind[] = [
  { id: 'leather', name: '가죽갑', origin: '皮甲', hint: '가볍고 싸다 — 처음부터 있다', look: 0 },
  { id: 'brigandine', name: '두정갑', origin: '頭釘甲', hint: '천 위에 쇠징 — 한 벌이 적 화살 두 발', look: 1 },
  { id: 'lamellar', name: '찰갑', origin: '札甲', hint: '쇠비늘을 엮었다 — 가장 두껍고 가장 비싸다', look: 2 },
]

export const DEFAULT_ARMOR: ArmorKindId = 'leather'

export function isArmorKindId(v: unknown): v is ArmorKindId {
  return v === 'leather' || v === 'brigandine' || v === 'lamellar'
}

export function armorKind(id: ArmorKindId): ArmorKind {
  return ARMOR_KINDS.find((a) => a.id === id) ?? (ARMOR_KINDS[0] as ArmorKind)
}

/** 지금 입는 벌. 세이브가 이상한 값을 들고 있으면 가죽갑. */
export function armorKindOf(d: SaveData): ArmorKindId {
  return isArmorKindId(d.armorKind) && armorOwned(d, d.armorKind) ? d.armorKind : DEFAULT_ARMOR
}

/** 벌의 크기 배수 — 방어량·상한·값이 전부 이걸 탄다. */
export function armorSizeMul(id: ArmorKindId): number {
  return id === 'leather' ? P.defense.armorLightMul : id === 'lamellar' ? P.defense.armorHeavyMul : 1
}

export function armorForgeMax(): number {
  return Math.max(1, Math.floor(P.defense.armorForgeMax))
}

/** 담금질 단수 (0..max). */
export function armorLevel(d: SaveData, id: ArmorKindId): number {
  const v = d.armorForge[id]
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  return Math.max(0, Math.min(armorForgeMax(), Math.floor(v)))
}

/** 담금질이 얹는 배수 — 화면의 문장과 방어량이 같은 식을 쓴다. */
export function armorForgeMul(level: number): number {
  return 1 + P.defense.armorForgePer * Math.max(0, Math.floor(level))
}

/** 한 벌의 방어량 — 벌 크기 × 담금질. */
export function armorPerOf(d: SaveData, id: ArmorKindId = armorKindOf(d)): number {
  return Math.max(1, Math.floor(P.defense.armorPer * armorSizeMul(id) * armorForgeMul(armorLevel(d, id))))
}

/** 겹쳐 입는 상한 — 같은 배수. */
export function armorCapOf(d: SaveData, id: ArmorKindId = armorKindOf(d)): number {
  return Math.max(1, Math.floor(P.defense.armorMax * armorSizeMul(id) * armorForgeMul(armorLevel(d, id))))
}

/** 판 도중에 한 벌 사는 값 (훈련치). 담금질은 값을 안 올린다 — 담금질은 이미 치른 값이다. */
export function armorCostOf(d: SaveData, id: ArmorKindId = armorKindOf(d)): number {
  return Math.max(0, Math.floor(P.defense.armorCost * armorSizeMul(id)))
}

export function armorOwned(d: SaveData, id: ArmorKindId): boolean {
  return id === DEFAULT_ARMOR || d.armorOwned.indexOf(id) >= 0
}

/** 장만하는 값. 가죽갑은 0. */
export function armorUnlockCost(id: ArmorKindId): number {
  return Math.max(0, Math.floor(id === 'brigandine' ? P.defense.armorUnlockMid : id === 'lamellar' ? P.defense.armorUnlockHeavy : 0))
}

/** 왜 못 장만하는가. 빈 문자열이면 된다 (defense.ts · forge.ts 와 같은 문법). */
export function armorUnlockBlocked(d: SaveData, id: ArmorKindId): string {
  if (armorOwned(d, id)) return '이미 있다'
  const cost = armorUnlockCost(id)
  if (d.training < cost) return `훈련치 ${cost} 필요`
  return ''
}

/** 장만한다 — 훈련치를 깎고 곧바로 입는다. 산 사람은 입으려고 산 것이다. */
export function buyArmorKind(d: SaveData, id: ArmorKindId): boolean {
  if (armorUnlockBlocked(d, id) !== '') return false
  d.training -= armorUnlockCost(id)
  d.armorOwned.push(id)
  d.armorKind = id
  writeSave(d)
  return true
}

/** 입는다. 가진 벌만. 다음 여정부터 — 지금 입고 있는 것(runArmor)은 건드리지 않는다. */
export function equipArmor(d: SaveData, id: ArmorKindId): boolean {
  if (!armorOwned(d, id)) return false
  if (d.armorKind === id) return true
  d.armorKind = id
  writeSave(d)
  return true
}

export function armorForgeBlocked(d: SaveData, id: ArmorKindId = armorKindOf(d)): string {
  const lv = armorLevel(d, id)
  if (lv >= armorForgeMax()) return '더 담글 데가 없다'
  const cost = forgeCost(lv)
  if (d.training < cost) return `훈련치 ${cost} 필요`
  return ''
}

/** 담금질 — 입은 벌의 단을 하나 올린다. 활 개조와 같은 값 곡선(forgeCost). */
export function buyArmorForge(d: SaveData, id: ArmorKindId = armorKindOf(d)): boolean {
  if (armorForgeBlocked(d, id) !== '') return false
  const lv = armorLevel(d, id)
  d.training -= forgeCost(lv)
  d.armorForge[id] = lv + 1
  writeSave(d)
  return true
}

/** 담금질 한 줄 — "방어량 30 → 36". */
export function armorForgeEffect(id: ArmorKindId, level: number): string {
  const base = P.defense.armorPer * armorSizeMul(id)
  return `한 벌 ${Math.floor(base * armorForgeMul(level))} · 상한 ${Math.floor(P.defense.armorMax * armorSizeMul(id) * armorForgeMul(level))}`
}
