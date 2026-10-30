/**
 * 사람마다의 회유 대사 — 장수 id → 묶음 (docs/realm/MEMORY.md §2 · 만드는 길은 tools/woo-lines-gen.ts).
 * 묶음이 없는 사람(판에서 난 아이 등)은 결 틀(src/ui/realm/woo-lines.ts)로, 군주였던 이는 RULER_HELD 로 떨어진다.
 */
import type { WooBundle } from './types.ts'
import { WOO_YEONGNAM } from './yeongnam.ts'
import { WOO_SEORABEOL } from './seorabeol.ts'
import { WOO_JUMONG } from './jumong.ts'
import { WOO_MAHAN } from './mahan.ts'
import { WOO_TUTORIAL } from './tutorial.ts'
import { WOO_BYEONHAN_MINI } from './byeonhan-mini.ts'

export type { WooBundle, WooHeld, WooSpeak } from './types.ts'
export { RULER_GOES, RULER_HELD } from './ruler.ts'

export const WOO_TALK: Readonly<Record<string, WooBundle>> = { ...WOO_BYEONHAN_MINI, ...WOO_TUTORIAL, ...WOO_MAHAN, ...WOO_JUMONG, ...WOO_SEORABEOL, ...WOO_YEONGNAM }
