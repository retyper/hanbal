/**
 * 밤 판의 이름표를 말에 맞춰 — 판 계산(layout · sim)은 한국어 이름을 그대로 두고, 그릴 때만 t() 로 갈아 입힌다.
 * (판 상태에는 말이 들어가지 않는다 — docs/realm/I18N.md)
 */
import { t, type Key } from '../i18n/index.ts'
import { GUARD_NAME } from './layout.ts'

const GUARD_KEYS: readonly Key[] = ['night.guardName0', 'night.guardName1', 'night.guardName2']
const BOW_KEYS: readonly Key[] = ['night.bow0', 'night.bow1', 'night.bow2', 'night.bow3']
/** 판 이름(layout.ts 의 title) → 글 키 */
const STAGE_KEYS: Readonly<Record<string, Key>> = {
  '담장 밖': 'night.stage0', '안뜰': 'night.stage1', '사랑채 앞': 'night.stage2', '과녁만': 'night.stage3',
}

/** 경비 이름 (느슨 · 보통 · 삼엄) */
export const guardName = (i: number): string => (GUARD_KEYS[i] !== undefined ? t(GUARD_KEYS[i]!) : GUARD_NAME[i] ?? '')
/** 활 이름 — 단계 밖이면 맨 아래 단계 */
export const bowName = (tier: number): string => t(BOW_KEYS[tier] ?? BOW_KEYS[0]!)
/** 판 이름 (모르는 것은 그대로) */
export const stageName = (title: string): string => (STAGE_KEYS[title] !== undefined ? t(STAGE_KEYS[title]!) : title)
