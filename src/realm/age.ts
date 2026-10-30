/**
 * 늙었다고 말해도 되는 장수인가 (형 10-30: "흰머리 나지 않은 이상 본인을 늙은이라고 하는 대사는 거의 쓰지 말아야 할 듯. 다 보기엔 대부분 젊어 보여").
 * 쉰이 넘었거나 머리·수염이 센 장수만 스스로를 「늙은이 · 이 늙은 몸 · 노신」이라 부른다. 남이 그 장수를 늙었다고 할 때도 같다.
 * 나이는 docs/realm/cast 에서 뽑은 data/ages.ts (tools/cast-ages.ts) · 설정에 없으면 얼굴(그림)로 · 그것도 없으면(판에서 난 아이 등) 젊다.
 */
import { CAST_AGE, FACE_AGE, type CastAge } from './data/ages.ts'
import { bustOf } from './data/art.ts'

/** 쉰부터 늙었다 */
export const OLD_AGE = 50

/** 그 장수의 설정 나이 (모르면 undefined) */
export function castAge(id: string): CastAge | undefined {
  const own = CAST_AGE[id]
  if (own !== undefined) return own
  const face = bustOf(id)
  return face !== undefined ? (CAST_AGE[face] ?? FACE_AGE[face]) : undefined
}

/** 쉰이 넘었거나 머리가 셌다 — 늙은이 말을 해도 된다 */
export function isOld(h: { readonly id: string }): boolean {
  const a = castAge(h.id)
  return a !== undefined && (a.age >= OLD_AGE || a.grey)
}
