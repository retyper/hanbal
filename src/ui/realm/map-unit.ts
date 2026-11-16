import { genArtOf, generalSprite, SOL_ANIM2, SOL_ANIM_AR } from '../../realm/data/art.ts'
import type { Hero } from '../../realm/types.ts'
import type { UnitKind } from '../../realm/battle.ts'

/** One visible unit per army. Callers supply a hero only when intelligence permits it. */
export function mapSquad(kinds: readonly UnitKind[], hero: Hero | undefined, art: string) {
  if (hero) {
    const a = genArtOf(generalSprite(hero))
    return [{ src: `${art}${a.file}`, ar: .8, r: a.ar / .8, general: true }]
  }
  const kind = kinds[0] ?? 'spear', key = kind === 'boat' ? 'marine' : kind
  const ar = SOL_ANIM_AR[key] ?? 1, wide = SOL_ANIM2[key]
  return [wide !== undefined ? { src: `${art}anim2/${key}.png`, ar, r: wide / ar }
    : { src: `${art}anim/${key}.png`, ar }]
}
