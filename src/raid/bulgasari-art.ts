/**
 * 불가사리 부위 그림 — 목책 돌파 판에만 늦게 불러온다 (이 모듈을 불러도 그림 요청은 없다 · tiger-art.ts 와 같은 길).
 * 그림은 tools/bake-bulgasari.mjs 가 Codex 67 원본(D:/에셋창고/codex67/boss_bulgasari_*.png)을 잘라 줄인 것.
 * 관절 자리는 원본 px 로 적는다 — crop·size 로 구운 그림 px 로 바꾼다 (원본을 다시 구워도 관절 값은 그대로 쓴다).
 */
const DIR = 'raid/giants/bulgasari/'
export const BULGASARI_PIECES = ['body', 'back', 'head', 'jaw', 'shoulder-near', 'shoulder-far', 'fore-near', 'fore-far', 'hind-near', 'hind-far', 'tail'] as const
export type BulgasariPiece = typeof BULGASARI_PIECES[number]
export const BULGASARI_ART = Object.fromEntries(BULGASARI_PIECES.map(p => [p, `${DIR}${p}.png`])) as Readonly<Record<BulgasariPiece, string>>
/** 구운 그림: 원본에서 잘라 낸 자리 [x, y, w, h] · 구운 크기 [w, h] (tools/bake-bulgasari.mjs 출력) */
export const BULGASARI_SOURCE: Readonly<Record<BulgasariPiece, { readonly crop: readonly [number, number, number, number]; readonly size: readonly [number, number] }>> = {
  body: { crop: [80, 68, 1384, 885], size: [858, 549] },
  back: { crop: [65, 72, 1406, 828], size: [872, 513] },
  head: { crop: [130, 77, 1314, 870], size: [657, 435] },
  jaw: { crop: [102, 122, 1312, 771], size: [551, 324] },
  'shoulder-near': { crop: [100, 62, 1337, 906], size: [562, 381] },
  'shoulder-far': { crop: [182, 76, 1172, 875], size: [445, 333] },
  'fore-near': { crop: [235, 41, 1027, 945], size: [514, 473] },
  'fore-far': { crop: [126, 84, 1005, 1043], size: [442, 459] },
  'hind-near': { crop: [343, 46, 874, 942], size: [420, 452] },
  'hind-far': { crop: [203, 73, 749, 1053], size: [315, 442] },
  tail: { crop: [89, 123, 1362, 771], size: [572, 324] },
}
type XY = readonly [number, number]
/**
 * 관절 자리 (원본 px · 그림 메타데이터)
 *  pin: 한 점에 붙는 조각 — pivot 이 뼈 점에 · scale 은 원본 1px 의 뼈대 단위(× rig.scale) · turn 은 그림 자체의 기울기
 *  leg: 다리 한 장 — from 이 어깨·엉덩이 소켓 · to 가 발바닥 (뼈 길이에 맞춰 다리 축으로만 줄고 늘며 굵기는 width 배)
 *  tail: from 꼬리 뿌리 · to 꼬리 끝 (뼈 길이에 맞춰 고르게)
 *  head.lip: 턱을 벌릴 때 머리 그림에서 지우는 아랫입술 다각형 (그 자리에 아래턱 그림이 내려온다)
 */
export const BULGASARI_SOCKETS = {
  body: { pivot: [770, 520] as XY, scale: .3, turn: 0 },
  back: { pivot: [760, 470] as XY, scale: .33, turn: 0 },
  head: { pivot: [470, 560] as XY, scale: .27, turn: 0, lip: [[960, 762], [1045, 770], [1052, 648], [1135, 648], [1142, 770], [1372, 768], [1378, 688], [1452, 688], [1452, 965], [930, 965], [955, 860]] as readonly XY[] },
  /** 아래턱은 머리 그림의 아랫입술보다 굵게 그려졌다 — 엄니 둘로 맞춘 몫(.89)과 자리: 아래턱 (x, y) = 머리 (.89x + 204, .89y + 366) · 다물면 그리지 않는다 */
  jaw: { pivot: [360, 330] as XY, scale: .24, turn: 0, lipFront: [1400, 470] as XY, lipBack: [850, 470] as XY },
  'shoulder-near': { pivot: [760, 520] as XY, scale: .19, turn: 0 },
  'shoulder-far': { pivot: [760, 520] as XY, scale: .18, turn: 0 },
  'fore-near': { from: [560, 300] as XY, to: [1060, 950] as XY, width: 1 },
  'fore-far': { from: [520, 330] as XY, to: [880, 1090] as XY, width: 1 },
  'hind-near': { from: [700, 300] as XY, to: [1000, 950] as XY, width: 1 },
  'hind-far': { from: [560, 320] as XY, to: [700, 1080] as XY, width: 1 },
  tail: { from: [1340, 520] as XY, to: [140, 520] as XY },
} as const
/** 원본 px → 구운 그림 px */
export function bakedPoint(piece: BulgasariPiece, p: readonly [number, number]): readonly [number, number] {
  const s = BULGASARI_SOURCE[piece]
  return [(p[0] - s.crop[0]) * s.size[0] / s.crop[2], (p[1] - s.crop[1]) * s.size[1] / s.crop[3]]
}
/** 원본 1px 이 구운 그림 몇 px 인가 */
export const bakedPerSource = (piece: BulgasariPiece) => BULGASARI_SOURCE[piece].size[0] / BULGASARI_SOURCE[piece].crop[2]
const pending = new WeakMap<Map<string, HTMLImageElement>, Promise<boolean>>()
export const bulgasariArtReady = (images: ReadonlyMap<string, HTMLImageElement>) => BULGASARI_PIECES.every(key => { const i = images.get(BULGASARI_ART[key]), d = BULGASARI_SOURCE[key].size; return !!i && i.complete && (i.naturalWidth || i.width) === d[0] && (i.naturalHeight || i.height) === d[1] })
/** 목책 돌파 출전 전에 미리 데운다. 실패하면 false 이고 일부만 넣지 않는다. */
export function prewarmBulgasariArt(stage: string, images: Map<string, HTMLImageElement>, base: string, make: () => HTMLImageElement = () => new Image()): Promise<boolean> {
  if (stage !== 'palisade' || bulgasariArtReady(images)) return Promise.resolve(true)
  const prior = pending.get(images); if (prior) return prior
  const job = Promise.all(BULGASARI_PIECES.map(key => new Promise<readonly [string, HTMLImageElement]>((resolve, reject) => {
    const img = make(), path = BULGASARI_ART[key]
    img.onload = () => { void (async () => { try { await img.decode?.(); const d = BULGASARI_SOURCE[key].size; if ((img.naturalWidth || img.width) !== d[0] || (img.naturalHeight || img.height) !== d[1]) throw Error('bulgasari-native-size'); resolve([path, img]) } catch (e) { reject(e) } })() }
    img.onerror = () => reject(Error('bulgasari-art-load')); img.src = base + path
  }))).then(items => { for (const [path, img] of items) images.set(path, img); return true }, () => false).finally(() => pending.delete(images))
  pending.set(images, job); return job
}
