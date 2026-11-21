/**
 * 백두 대호 부위 그림 — 설원 판에만 늦게 불러온다 (이 모듈을 불러도 그림 요청은 없다 · imugi-art.ts 와 같은 길).
 * 그림은 tools/bake-tiger.mjs 가 Codex 69 원본(D:/에셋창고/codex69/boss_sangun_*.png)을 잘라 줄인 것.
 * 관절 자리는 원본 px 로 적는다 — crop·size 로 구운 그림 px 로 바꾼다 (원본을 다시 구워도 관절 값은 그대로 쓴다).
 */
const DIR = 'raid/giants/tiger/'
export const TIGER_PIECES = ['body', 'head', 'head-roar', 'jaw', 'neck', 'fore-near-upper', 'fore-near-lower', 'fore-far-upper', 'fore-far-lower', 'hind-near-upper', 'hind-near-lower', 'hind-far-upper', 'hind-far-lower', 'tail-seg', 'tail-tip', 'arrows'] as const
export type TigerPiece = typeof TIGER_PIECES[number]
export const TIGER_ART = Object.fromEntries(TIGER_PIECES.map(p => [p, `${DIR}${p}.png`])) as Readonly<Record<TigerPiece, string>>
/** 구운 그림: 원본에서 잘라 낸 자리 [x, y, w, h] · 구운 크기 [w, h] (tools/bake-tiger.mjs 출력) */
export const TIGER_SOURCE: Readonly<Record<TigerPiece, { readonly crop: readonly [number, number, number, number]; readonly size: readonly [number, number] }>> = {
  body: { crop: [4, 9, 1768, 868], size: [1061, 521] },
  head: { crop: [0, 0, 1347, 1166], size: [674, 583] },
  'head-roar': { crop: [6, 0, 1326, 1166], size: [663, 583] },
  jaw: { crop: [139, 105, 1279, 833], size: [512, 333] },
  neck: { crop: [100, 13, 1146, 1136], size: [458, 454] },
  'fore-near-upper': { crop: [37, 14, 1174, 1165], size: [399, 396] },
  'fore-near-lower': { crop: [112, 20, 993, 1127], size: [338, 383] },
  'fore-far-upper': { crop: [48, 5, 1057, 1193], size: [359, 406] },
  'fore-far-lower': { crop: [127, 7, 923, 1180], size: [314, 401] },
  'hind-near-upper': { crop: [112, 2, 1147, 1164], size: [390, 396] },
  'hind-near-lower': { crop: [128, 8, 849, 1149], size: [289, 391] },
  'hind-far-upper': { crop: [9, 18, 1246, 1164], size: [424, 396] },
  'hind-far-lower': { crop: [171, 26, 857, 1118], size: [291, 380] },
  'tail-seg': { crop: [28, 44, 2114, 625], size: [719, 213] },
  'tail-tip': { crop: [54, 50, 1445, 934], size: [491, 318] },
  arrows: { crop: [171, 8, 1191, 1008], size: [429, 363] },
}
type XY = readonly [number, number]
/**
 * 관절 자리 (원본 px · 그림 메타데이터) — bone: 뼈 하나에 붙는 조각(from 이 뼈 시작 · to 가 끝 · 크기는 뼈 길이로 · thick 은 굵기 몫)
 * pin: 한 점에 붙는 조각(pivot · scale 은 원본 1px 의 뼈대 단위 · turn 은 그림 자체의 기울기) · slices: 꼬리 마디가 나눠 쓰는 꼬리 그림 가로 구간
 */
export const TIGER_SOCKETS = {
  body: { pivot: [888, 470] as XY, scale: .275, turn: 0 },
  head: { pivot: [430, 650] as XY, scale: .17, turn: 0 },
  'head-roar': { pivot: [430, 650] as XY, scale: .17, turn: 0 },
  jaw: { pivot: [430, 400] as XY, scale: .108, turn: -.05 },
  arrows: { pivot: [430, 770] as XY, scale: .095, turn: -.25 },
  neck: { from: [430, 820] as XY, to: [1040, 330] as XY, thick: 1 },
  'fore-near-upper': { from: [480, 330] as XY, to: [1060, 1010] as XY, thick: 1 },
  'fore-near-lower': { from: [440, 190] as XY, to: [790, 1110] as XY, thick: 1 },
  'fore-far-upper': { from: [430, 330] as XY, to: [880, 1060] as XY, thick: 1 },
  'fore-far-lower': { from: [470, 170] as XY, to: [760, 1140] as XY, thick: 1 },
  'hind-near-upper': { from: [820, 360] as XY, to: [640, 1040] as XY, thick: 1 },
  'hind-near-lower': { from: [480, 170] as XY, to: [700, 1140] as XY, thick: 1 },
  'hind-far-upper': { from: [430, 330] as XY, to: [1080, 840] as XY, thick: 1 },
  'hind-far-lower': { from: [560, 150] as XY, to: [780, 1110] as XY, thick: 1 },
  'tail-seg': { slices: [[60, 880], [660, 1480], [1260, 2120]] as readonly XY[], axisY: [330, 300, 270] as readonly number[], thick: 1 },
  'tail-tip': { from: [210, 640] as XY, to: [1000, 560] as XY, thick: 1 },
} as const
/** 원본 px → 구운 그림 px */
export function bakedPoint(piece: TigerPiece, p: readonly [number, number]): readonly [number, number] {
  const s = TIGER_SOURCE[piece]
  return [(p[0] - s.crop[0]) * s.size[0] / s.crop[2], (p[1] - s.crop[1]) * s.size[1] / s.crop[3]]
}
const pending = new WeakMap<Map<string, HTMLImageElement>, Promise<boolean>>()
export const tigerArtReady = (images: ReadonlyMap<string, HTMLImageElement>) => TIGER_PIECES.every(key => { const i = images.get(TIGER_ART[key]), d = TIGER_SOURCE[key].size; return !!i && i.complete && (i.naturalWidth || i.width) === d[0] && (i.naturalHeight || i.height) === d[1] })
/** 설원 출전 전에 미리 데운다. 실패하면 false 이고 일부만 넣지 않는다. */
export function prewarmTigerArt(stage: string, images: Map<string, HTMLImageElement>, base: string, make: () => HTMLImageElement = () => new Image()): Promise<boolean> {
  if (stage !== 'snow' || tigerArtReady(images)) return Promise.resolve(true)
  const prior = pending.get(images); if (prior) return prior
  const job = Promise.all(TIGER_PIECES.map(key => new Promise<readonly [string, HTMLImageElement]>((resolve, reject) => {
    const img = make(), path = TIGER_ART[key]
    img.onload = () => { void (async () => { try { await img.decode?.(); const d = TIGER_SOURCE[key].size; if ((img.naturalWidth || img.width) !== d[0] || (img.naturalHeight || img.height) !== d[1]) throw Error('tiger-native-size'); resolve([path, img]) } catch (e) { reject(e) } })() }
    img.onerror = () => reject(Error('tiger-art-load')); img.src = base + path
  }))).then(items => { for (const [path, img] of items) images.set(path, img); return true }, () => false).finally(() => pending.delete(images))
  pending.set(images, job); return job
}
