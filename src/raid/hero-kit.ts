import { genArtOf } from '../realm/data/art.ts'
import { KIT_BY_SPRITE } from './kit-table.ts'
import type { Kit } from './haebi.ts'

/** 전투 그림 키 → 열전 무기 묶음. 표(전투 원장 210명)에 없으면 그림 결로: 활 그림이면 활 · 창 결이면 창 · 그 밖은 칼 */
export function kitOfSprite(key: string): Kit {
  const k = KIT_BY_SPRITE[key]
  if (k) return k
  const a = genArtOf(key)
  return a.bow ? 'bow' : /spear|pike|mount/.test(a.kind) ? 'spear' : 'sword'
}
