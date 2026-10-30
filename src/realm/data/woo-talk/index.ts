/**
 * 사람마다의 회유 대사 — 장수 id → 묶음 (docs/realm/MEMORY.md §2 · 만드는 길은 tools/woo-lines-gen.ts).
 * 묶음이 없는 사람(판에서 난 아이 등)은 결 틀(src/ui/realm/woo-lines.ts)로, 군주였던 이는 RULER_HELD 로 떨어진다.
 */
import type { WooBundle } from './types.ts'

export type { WooBundle, WooHeld, WooSpeak } from './types.ts'
export { RULER_GOES, RULER_HELD } from './ruler.ts'

export const WOO_TALK: Readonly<Record<string, WooBundle>> = {}
