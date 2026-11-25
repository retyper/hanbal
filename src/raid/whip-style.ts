// 채찍 묶음의 말투 — 같은 트리·같은 칸에서 수치 한 줄만 다르다 (docs/realm/WEAPON-KITS-SPECIAL-20261125.md 5-6)
// crack(딱) = 가는 줄 + 끝 매듭 · noose(올가미) = 줄 끝이 고리. 판을 만들 때 opts.whipStyle 로 넘기고 판 기록에 그대로 남는다 (재생이 같다).
// 어느 장수가 채찍 묶음인가(KIT_BY_SPRITE)는 따로다 — 이 표는 말투만 안다.
export type WhipStyle = 'crack' | 'noose'
const STYLE_BY_SPRITE: Readonly<Record<string, WhipStyle>> = {
  malgalgi: 'crack', 'base-g-44-maga-malgup': 'crack', olddaeso: 'crack',
  bira: 'noose', 'base-w-43-uga-nuri': 'noose', 'base-w-45-tamna-oreumbi': 'noose',
}
export const whipStyleOf = (sprite: string): WhipStyle => STYLE_BY_SPRITE[sprite] ?? 'crack'
export const WHIP_SPRITES = Object.keys(STYLE_BY_SPRITE)
