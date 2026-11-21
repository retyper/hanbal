/** Native master rebake only. Missing entries deliberately retain their approved base assets. */
export const HERO_HD: Readonly<Record<string, string>> = {
  'anim-px/gen-aw1-haebi.png': 'anim-px/gen-aw1-haebi_hd.png',
  'anim-px/gen-haebi.png': 'anim-px/gen-haebi_hd.png',
  'anim-px/gen-jumong.png': 'anim-px/gen-jumong_hd.png',
}

/** NativeHD atlas stays within4096 before upload: frame order is row-major,20 frames. */
export const HERO_HD_SHEETS: Readonly<Record<string, { cell: readonly [number, number]; cols: number }>> = {
  'anim-px/gen-aw1-haebi_hd.png': { cell: [448, 320], cols: 9 },
  'anim-px/gen-haebi_hd.png': { cell: [400, 320], cols: 10 },
  'anim-px/gen-jumong_hd.png': { cell: [384, 320], cols: 10 },
}
