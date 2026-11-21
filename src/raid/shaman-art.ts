/**
 * 불의 무녀 장군 그림 — 불타는 산성 판에만 늦게 불러온다 (이 모듈을 불러도 그림 요청은 없다 · tiger-art.ts 와 같은 길).
 * 그림은 tools/bake-shaman.mjs 가 Codex 72 몸 2×2 판(자세 넷)·부채 팔·방울 팔과 Codex 67 옷자락 둘·허리 장식을 잘라 줄인 것.
 * 자리는 원본 px 로 적는다 — crop·size 로 구운 그림 px 로 바꾼다 (원본을 다시 구워도 자리 값은 그대로 쓴다).
 */
const DIR = 'raid/giants/shaman/'
export const SHAMAN_PIECES = ['body-0', 'body-1', 'body-2', 'body-3', 'glow-0', 'glow-1', 'glow-2', 'glow-3', 'fan-arm', 'bell-arm', 'robe-back', 'robe-front', 'waist'] as const
export type ShamanPiece = typeof SHAMAN_PIECES[number]
export const SHAMAN_ART = Object.fromEntries(SHAMAN_PIECES.map(p => [p, `${DIR}${p}.png`])) as Readonly<Record<ShamanPiece, string>>
export const shamanBody = (key: number) => `body-${key}` as ShamanPiece
export const shamanGlow = (key: number) => `glow-${key}` as ShamanPiece
/** 구운 그림: 원본에서 잘라 낸 자리 [x, y, w, h] · 구운 크기 [w, h] (tools/bake-shaman.mjs 출력) · 몸·빛은 몸 판 px, 나머지는 제 원본 px */
export const SHAMAN_SOURCE: Readonly<Record<ShamanPiece, { readonly crop: readonly [number, number, number, number]; readonly size: readonly [number, number] }>> = {
  'body-0': { crop: [79, 1, 381, 622], size: [381, 622] },
  'body-1': { crop: [620, 7, 540, 616], size: [540, 616] },
  'body-2': { crop: [28, 634, 582, 630], size: [582, 630] },
  'body-3': { crop: [603, 679, 586, 585], size: [586, 585] },
  'glow-0': { crop: [79, 1, 381, 622], size: [191, 311] },
  'glow-1': { crop: [620, 7, 540, 616], size: [270, 308] },
  'glow-2': { crop: [28, 634, 582, 630], size: [291, 315] },
  'glow-3': { crop: [603, 679, 586, 585], size: [293, 293] },
  'fan-arm': { crop: [37, 27, 1703, 846], size: [426, 212] },
  'bell-arm': { crop: [131, 100, 1243, 892], size: [311, 223] },
  'robe-back': { crop: [134, 128, 1063, 965], size: [298, 270] },
  'robe-front': { crop: [142, 130, 1025, 940], size: [287, 263] },
  waist: { crop: [310, 262, 917, 506], size: [156, 86] },
}
/** 자세마다 치마 끝·소매의 불꽃 무늬가 핀 자리 (몸 판 원본 px · x, y 차례 · bake-shaman 이 밝은 주황·노랑 픽셀이 모인 칸에서 고른다) */
export const SHAMAN_FLAMES: readonly (readonly number[])[] = [
  [98, 423, 137, 334, 144, 513, 163, 513, 166, 270, 186, 425, 189, 492, 190, 255, 206, 490, 209, 246, 224, 248, 255, 566, 280, 357, 280, 575, 291, 335, 295, 574, 322, 449, 324, 467, 335, 447, 338, 467, 381, 464, 386, 247, 410, 487, 429, 486, 433, 467, 448, 491],
  [652, 445, 668, 493, 668, 510, 689, 510, 716, 344, 716, 432, 731, 429, 733, 341, 735, 557, 738, 442, 758, 335, 760, 229, 803, 443, 823, 444, 827, 490, 871, 408, 913, 552, 958, 402, 1026, 376, 1047, 247, 1066, 490, 1082, 468, 1087, 202, 1089, 486, 1112, 211, 1131, 289],
  [47, 1060, 53, 1132, 55, 1149, 58, 1048, 77, 1037, 77, 1171, 121, 1126, 140, 1126, 230, 842, 230, 1198, 251, 845, 297, 1170, 299, 1150, 339, 819, 361, 1197, 382, 1192, 386, 1107, 450, 1019, 472, 1153, 500, 1105, 517, 846, 517, 1103, 518, 1086, 561, 839, 582, 753, 585, 774],
  [634, 1126, 649, 1129, 651, 997, 653, 1017, 671, 1106, 695, 931, 738, 1136, 755, 1193, 758, 1127, 780, 1133, 802, 1127, 823, 1103, 825, 1191, 846, 1083, 846, 1172, 864, 1235, 874, 1218, 890, 1215, 891, 1150, 908, 1215, 936, 958, 959, 956, 977, 952, 1023, 886, 1153, 1106, 1173, 1107],
]
/** 원본 px → 구운 그림 px */
export function bakedPoint(piece: ShamanPiece, p: readonly [number, number]): readonly [number, number] {
  const s = SHAMAN_SOURCE[piece]
  return [(p[0] - s.crop[0]) * s.size[0] / s.crop[2], (p[1] - s.crop[1]) * s.size[1] / s.crop[3]]
}
/** 구운 그림 1px 이 원본 몇 px 인가 (몸은 1 · 빛은 2 · 나머지는 1/factor) */
export const sourcePerBaked = (piece: ShamanPiece) => SHAMAN_SOURCE[piece].crop[2] / SHAMAN_SOURCE[piece].size[0]
const pending = new WeakMap<Map<string, HTMLImageElement>, Promise<boolean>>()
export const shamanArtReady = (images: ReadonlyMap<string, HTMLImageElement>) => SHAMAN_PIECES.every(key => { const i = images.get(SHAMAN_ART[key]), d = SHAMAN_SOURCE[key].size; return !!i && i.complete && (i.naturalWidth || i.width) === d[0] && (i.naturalHeight || i.height) === d[1] })
/** 불타는 산성 출전 전에 미리 데운다. 실패하면 false 이고 일부만 넣지 않는다. */
export function prewarmShamanArt(stage: string, images: Map<string, HTMLImageElement>, base: string, make: () => HTMLImageElement = () => new Image()): Promise<boolean> {
  if (stage !== 'fortress' || shamanArtReady(images)) return Promise.resolve(true)
  const prior = pending.get(images); if (prior) return prior
  const job = Promise.all(SHAMAN_PIECES.map(key => new Promise<readonly [string, HTMLImageElement]>((resolve, reject) => {
    const img = make(), path = SHAMAN_ART[key]
    img.onload = () => { void (async () => { try { await img.decode?.(); const d = SHAMAN_SOURCE[key].size; if ((img.naturalWidth || img.width) !== d[0] || (img.naturalHeight || img.height) !== d[1]) throw Error('shaman-native-size'); resolve([path, img]) } catch (e) { reject(e) } })() }
    img.onerror = () => reject(Error('shaman-art-load')); img.src = base + path
  }))).then(items => { for (const [path, img] of items) images.set(path, img); return true }, () => false).finally(() => pending.delete(images))
  pending.set(images, job); return job
}
