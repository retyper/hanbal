/**
 * 구미호 그림 — 숲 산길 판에만 늦게 불러온다 (이 모듈을 불러도 그림 요청은 없다 · tiger-art.ts 와 같은 길).
 * 그림은 tools/bake-gumiho.mjs 가 Codex 72 자세 두 장(여인 · 반여우 · 2×2 네 자세)과 꼬리 아홉(Codex 67 · 셋째만 Codex 72)을 잘라 줄인 것.
 * 자세 그림은 모두 같은 몫(원본 0.8)으로 구웠고 발 자리(feet)에 맞춰 그린다 · 관절 자리는 HAEBI_GUMIHO.rig.poses (판정과 같은 점).
 */
const DIR = 'raid/giants/gumiho/'
export const GUMIHO_POSE_ART = ['woman-0', 'woman-1', 'woman-2', 'woman-3', 'fox-0', 'fox-1', 'fox-2', 'fox-3'] as const
export const GUMIHO_TAIL_ART = ['tail-1', 'tail-2', 'tail-3', 'tail-4', 'tail-5', 'tail-6', 'tail-7', 'tail-8', 'tail-9'] as const
export const GUMIHO_PIECES = [...GUMIHO_POSE_ART, ...GUMIHO_TAIL_ART] as const
export type GumihoPiece = typeof GUMIHO_PIECES[number]
export type GumihoPoseArt = typeof GUMIHO_POSE_ART[number]
export type GumihoTailArt = typeof GUMIHO_TAIL_ART[number]
export const GUMIHO_ART = Object.fromEntries(GUMIHO_PIECES.map(p => [p, `${DIR}${p}.png`])) as Readonly<Record<GumihoPiece, string>>
/** 구운 그림: 원본에서 잘라 낸 자리 [x, y, w, h] · 구운 크기 [w, h] · 자세는 발 자리 [x, y] (tools/bake-gumiho.mjs 출력) */
export const GUMIHO_SOURCE: Readonly<Record<GumihoPiece, { readonly crop: readonly [number, number, number, number]; readonly size: readonly [number, number]; readonly feet?: readonly [number, number] }>> = {
  'woman-0': { crop: [55, 49, 473, 575], size: [378, 460], feet: [194, 456] },
  'woman-1': { crop: [614, 6, 527, 618], size: [422, 494], feet: [239, 490] },
  'woman-2': { crop: [6, 654, 567, 614], size: [454, 491], feet: [233, 487] },
  'woman-3': { crop: [562, 639, 674, 631], size: [539, 505], feet: [251, 501] },
  'fox-0': { crop: [54, 40, 477, 584], size: [382, 467], feet: [200, 462] },
  'fox-1': { crop: [609, 0, 533, 626], size: [426, 501], feet: [241, 496] },
  'fox-2': { crop: [8, 648, 567, 619], size: [454, 495], feet: [233, 490] },
  'fox-3': { crop: [561, 630, 675, 641], size: [540, 513], feet: [251, 508] },
  'tail-1': { crop: [235, 131, 590, 1227], size: [177, 368] },
  'tail-2': { crop: [106, 188, 1324, 640], size: [397, 192] },
  'tail-3': { crop: [162, 123, 890, 1053], size: [267, 316] },
  'tail-4': { crop: [253, 153, 700, 998], size: [210, 299] },
  'tail-5': { crop: [209, 131, 821, 1022], size: [246, 307] },
  'tail-6': { crop: [411, 142, 1132, 640], size: [340, 192] },
  'tail-7': { crop: [143, 123, 932, 1048], size: [280, 314] },
  'tail-8': { crop: [295, 157, 727, 991], size: [218, 297] },
  'tail-9': { crop: [193, 143, 878, 940], size: [263, 282] },
}
/** 꼬리 그림의 뿌리(굵은 끝) · 끝(가는 끝) — 구운 그림 px · 그리는 쪽이 이 줄을 꼬리 뼈에 맞춘다 */
export const GUMIHO_TAIL_BONE: Readonly<Record<GumihoTailArt, { readonly base: readonly [number, number]; readonly tip: readonly [number, number] }>> = {
  'tail-1': { base: [85, 365], tip: [173, 5] },
  'tail-2': { base: [345, 188], tip: [5, 148] },
  'tail-3': { base: [116, 310], tip: [3, 95] },
  'tail-4': { base: [99, 295], tip: [14, 5] },
  'tail-5': { base: [114, 300], tip: [39, 5] },
  'tail-6': { base: [30, 175], tip: [338, 20] },
  'tail-7': { base: [90, 305], tip: [275, 75] },
  'tail-8': { base: [70, 290], tip: [213, 5] },
  'tail-9': { base: [72, 275], tip: [257, 5] },
}
const pending = new WeakMap<Map<string, HTMLImageElement>, Promise<boolean>>()
export const gumihoArtReady = (images: ReadonlyMap<string, HTMLImageElement>) => GUMIHO_PIECES.every(key => { const i = images.get(GUMIHO_ART[key]), d = GUMIHO_SOURCE[key].size; return !!i && i.complete && (i.naturalWidth || i.width) === d[0] && (i.naturalHeight || i.height) === d[1] })
/** 숲 산길 출전 전에 미리 데운다. 실패하면 false 이고 일부만 넣지 않는다. */
export function prewarmGumihoArt(stage: string, images: Map<string, HTMLImageElement>, base: string, make: () => HTMLImageElement = () => new Image()): Promise<boolean> {
  if (stage !== 'forest' || gumihoArtReady(images)) return Promise.resolve(true)
  const prior = pending.get(images); if (prior) return prior
  const job = Promise.all(GUMIHO_PIECES.map(key => new Promise<readonly [string, HTMLImageElement]>((resolve, reject) => {
    const img = make(), path = GUMIHO_ART[key]
    img.onload = () => { void (async () => { try { await img.decode?.(); const d = GUMIHO_SOURCE[key].size; if ((img.naturalWidth || img.width) !== d[0] || (img.naturalHeight || img.height) !== d[1]) throw Error('gumiho-native-size'); resolve([path, img]) } catch (e) { reject(e) } })() }
    img.onerror = () => reject(Error('gumiho-art-load')); img.src = base + path
  }))).then(items => { for (const [path, img] of items) images.set(path, img); return true }, () => false).finally(() => pending.delete(images))
  pending.set(images, job); return job
}
