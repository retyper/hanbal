/**
 * 나라의 그림 — 누가 어떤 얼굴, 고을이 어떤 기호, 나라가 어떤 깃발 (docs/realm/ART.md · 담기는 tools/realm-plate.ps1)
 *
 * 화면(ui)만 읽는다. 판(realm 상태)에는 그림이 없다 — 그림을 바꿔도 저장·리플레이가 안 흔들린다.
 * 파일은 public/realm/ 아래 이름이다 (굽기 전 원본은 assets_src/realm/, gitignore).
 * 지도 위 자리는 map/spring.jpg (1264×848) 위의 비율 0~1 — 변한 축소판의 [상상 배치]를 낙동강·남강 그림에 얹었다.
 */
import type { NodeKind, RegionId, RNode } from '../types.ts'
import { GEO as YEONGNAM_GEO, yeongnamPos } from './regions/yeongnam.ts'
import { placeOf, worldGeoOf } from './regions/index.ts'

/**
 * 판마다 지도 그림 — 폴더 · 확장자 · 그림 크기(SVG 좌표계) · 고을 기호·글씨 크기 배수 · 가장 큰 배율(cover 의 몇 배, zoom.ts) · 땅빛 둘레 (mapview.ts)
 * 영남 판은 고을이 빽빽해서 기호를 작게, 땅빛을 좁게 둔다.
 */
export const REGION_ART: Readonly<Record<RegionId, { dir: string; ext: string; w: number; h: number; nodeScale: number; labelScale: number; zmax: number; terrR: number; terrBand: number }>> = {
  'byeonhan-mini': { dir: 'map', ext: 'jpg', w: 1264, h: 848, nodeScale: 1, labelScale: 1, zmax: 2.2, terrR: 150, terrBand: 90 },
  yeongnam: { dir: 'map-yeongnam', ext: 'webp', w: 1024, h: 765, nodeScale: 0.34, labelScale: 0.72, zmax: 4, terrR: 50, terrBand: 28 },
  // 삼한 남부 — 조각 넷을 이은 그림(ui/realm/worldmap.ts 가 합친다). 크기는 조각 눈금(1024px = 경도 2.9° · 765px = 위도 2.0°)으로 경도 5.5° × 위도 3.75°
  south: { dir: 'map-world', ext: 'webp', w: 1942, h: 1434, nodeScale: 0.2, labelScale: 0.6, zmax: 6, terrR: 52, terrBand: 28 },
  // 삼한과 북녘 — 조각 열넷. 같은 눈금으로 경도 5.5° × 위도 12.5° (세로로 긴 판 — 내려 가며 본다)
  world: { dir: 'map-world', ext: 'webp', w: 1942, h: 4781, nodeScale: 0.2, labelScale: 0.6, zmax: 6, terrR: 52, terrBand: 28 },
}

/** 장수 id → 명치판 (bust/<이름>.jpg). g- 남자 장수 · w- 여인 · l- 전설 */
export const HERO_BUST: Readonly<Record<string, string>> = {
  chief: 'g-02-goguryeo-archer-prince', // 플레이어 — 활 쏘는 군장 (신궁)
  'guya-1': 'g-11-gaya-iron-general', // 진지렴 거타 — 가락국의 철
  'guya-2': 'g-04-jinhan-giant', // 험측 마루
  'anya-1': 'w-04-gaya-swordswoman', // 신지 아라 — 아라국의 여 신지
  'anya-2': 'w-13-young-archer', // 번예 솔미
  'miri-1': 'g-07-drunk-warrior', // 읍차 갈미 — PLAY §4 의 술꾼
  'goja-1': 'g-03-sea-trader', // 살해 바다쇠
  'dokro-1': 'w-10-pirate-captain', // 읍차 너울 — 왜와 경계를 맞댄 포구
  // 군주 — 장군과 따로 (형: "군주는 따로 있어야 하고 장군이랑 별개여야")
  'us-ruler': 'w-07-shaman-queen', // 읍차 해솔 — 매혹
  'guya-ruler': 'g-01-master-smith', // 진지렴 쇠보 — 쇠의 나라의 대장장이 군주
  'anya-ruler': 'g-06-strategist', // 신지 아단 — 신중
  'miri-ruler': 'w-16-clan-matriarch', // 신지 달래 — 곡창의 여가장
  'goja-ruler': 'g-05-mahan-chieftain', // 험측 바우 — 물길·장사
  'dokro-ruler': 'g-13-baekje-general', // 읍차 가람
  // 둘째 장군들
  'us-1': 'g-09-farmer-conscript',
  'miri-2': 'w-02-goguryeo-lady',
  'goja-2': 'w-17-mahan-pearl-diver',
  'dokro-2': 'g-08-veteran',
  // 떠돌이 인재 스물 (data/heroes-pool.ts) — 여인 열다섯
  'wander-01': 'w-18-jinhan-salt-widow', 'wander-02': 'w-03-goguryeo-archer', 'wander-03': 'w-12-court-dancer',
  'wander-04': 'w-11-assassin', 'wander-05': 'w-15-captive-noble', 'wander-06': 'w-06-buyeo-huntress',
  'wander-07': 'w-19-buyeo-fur-princess', 'wander-08': 'w-22-dongye-tiger-huntress', 'wander-09': 'w-05-baekje-queen',
  'wander-10': 'w-21-baekje-court-dancer', 'wander-11': 'g-16-goguryeo-gaema-commander', 'wander-12': 'g-14-captive-general',
  'wander-13': 'w-14-feast-spy', 'wander-14': 'g-10-buyeo-horse-lord', 'wander-15': 'w-09-byeonhan-smith',
  'wander-16': 'w-20-gaya-smith-daughter', 'wander-17': 'g-12-silla-youth', 'wander-18': 'w-01-silla-princess',
  'wander-19': 'g-15-shaman-man', 'wander-20': 'w-08-mahan-warrior',
  // 영남 판 (data/regions/yeongnam.ts) — 변한 판과 같은 나라는 같은 얼굴. 새 군주 열다섯은 있는 명치판을 나눠 쓴다 (여인이 많다)
  // 영남 판을 위해 새로 받은 여덟 (2026-10-18): 사로 이사금 · 대가야 왕 · 사벌 노장 · 사물 바다 군장 · 우시산 고래잡이 여군장 · 압독 여왕 · 비화가야 무녀 군주 · 이서 여장수
  'saro-ruler': 'g-17-saro-isageum', 'daegaya-ruler': 'g-18-daegaya-king', 'dabeol-ruler': 'g-16-goguryeo-gaema-commander',
  'sabeol-ruler': 'g-19-sabeol-veteran', 'usisan-ruler': 'w-23-usisan-whale-queen', 'bihwa-ruler': 'w-25-bihwa-priestess',
  'jomun-ruler': 'w-06-buyeo-huntress', 'golbeol-ruler': 'w-22-dongye-tiger-huntress', 'apdok-ruler': 'w-24-apdok-queen',
  'iseo-ruler': 'w-12-court-dancer', 'byeokjin-ruler': 'w-20-gaya-smith-daughter', 'gammun-ruler': 'g-15-shaman-man',
  'samul-ruler': 'g-20-samul-sea-lord', 'eumjeup-ruler': 'g-12-silla-youth', 'chopal-ruler': 'g-14-captive-general',
  'saro-1': 'g-08-veteran', 'saro-2': 'w-03-goguryeo-archer', 'daegaya-1': 'w-09-byeonhan-smith', 'sabeol-1': 'w-19-buyeo-fur-princess',
  'dabeol-1': 'g-07-drunk-warrior', 'usisan-1': 'g-01-master-smith', 'jomun-1': 'g-13-baekje-general', 'iseo-1': 'w-26-iseo-tomboy-general',
  'samul-1': 'w-08-mahan-warrior', 'bihwa-1': 'g-10-buyeo-horse-lord', 'eumjeup-1': 'w-01-silla-princess',
  // 삼한 남부 판의 새 군주·장군 (data/regions/south.ts) — 있는 명치판을 나눠 쓴다. 새 얼굴은 그림 줄(인물 — 챗지피티)
  'baekje-ruler': 'g-21-baekje-onnuri', 'mokji-ruler': 'w-27-mokji-jinha', 'michuhol-ruler': 'w-28-michuhol-bira',
  'ungcheon-ruler': 'g-05-mahan-chieftain', 'sangdang-ruler': 'g-01-master-smith', 'geonma-ruler': 'w-17-mahan-pearl-diver',
  'wansan-ruler': 'g-04-jinhan-giant', 'gosaburi-ruler': 'w-14-feast-spy', 'balla-ruler': 'g-15-shaman-man',
  'mujin-ruler': 'w-16-clan-matriarch', 'gampyeong-ruler': 'g-03-sea-trader', 'goryong-ruler': 'w-02-goguryeo-lady',
  'maek-ruler': 'g-10-buyeo-horse-lord', 'siljik-ruler': 'w-18-jinhan-salt-widow', 'haseulla-ruler': 'w-22-dongye-tiger-huntress',
  'baekje-1': 'g-16-goguryeo-gaema-commander', 'mokji-1': 'g-08-veteran', 'wansan-1': 'w-13-young-archer', 'balla-1': 'w-08-mahan-warrior',
  'maek-1': 'w-06-buyeo-huntress', 'haseulla-1': 'g-09-farmer-conscript', 'gampyeong-1': 'w-10-pirate-captain',
  // 삼한과 북녘 판의 새 군주·장군 (data/regions/world.ts) — 있는 명치판을 나눠 쓴다. 새 얼굴은 그림 줄(ART-QUEUE 5c)
  'goguryeo-ruler': 'g-02-goguryeo-archer-prince', 'goguryeo-1': 'g-16-goguryeo-gaema-commander', 'goguryeo-2': 'w-03-goguryeo-archer',
  'biryuna-ruler': 'w-02-goguryeo-lady', 'biryuna-1': 'g-08-veteran', 'yeonna-ruler': 'g-06-strategist', 'yeonna-1': 'w-13-young-archer',
  'hwanna-ruler': 'w-15-captive-noble', 'hwanna-1': 'g-03-sea-trader', 'gwanna-ruler': 'g-01-master-smith', 'gwanna-1': 'g-11-gaya-iron-general',
  'buyeo-ruler': 'g-10-buyeo-horse-lord', 'buyeo-1': 'w-06-buyeo-huntress', 'maga-ruler': 'w-19-buyeo-fur-princess', 'maga-1': 'g-04-jinhan-giant',
  'uga-ruler': 'g-09-farmer-conscript', 'uga-1': 'g-07-drunk-warrior', 'jeoga-ruler': 'g-14-captive-general', 'jeoga-1': 'w-11-assassin',
  'guga-ruler': 'w-16-clan-matriarch', 'guga-1': 'g-12-silla-youth', 'dongokjeo-ruler': 'w-18-jinhan-salt-widow', 'dongokjeo-1': 'g-05-mahan-chieftain',
  'bukokjeo-ruler': 'g-15-shaman-man', 'bukokjeo-1': 'w-17-mahan-pearl-diver', 'bullae-ruler': 'w-22-dongye-tiger-huntress', 'bullae-1': 'g-13-baekje-general',
  'tamna-ruler': 'w-07-shaman-queen', 'tamna-1': 'g-20-samul-sea-lord',
}

/** 나라 id → 깃발 (icon/emblem-*.png) · 지도의 테두리 색 */
export const FACTION_ART: Readonly<Record<string, { emblem: string; color: string }>> = {
  us: { emblem: 'emblem-shell', color: '#9fd18b' },
  guya: { emblem: 'emblem-twinfish', color: '#e0b64a' }, // 쌍어 — 김해
  anya: { emblem: 'emblem-mountain', color: '#d0674f' },
  miri: { emblem: 'emblem-grain', color: '#6fa8dc' },
  goja: { emblem: 'emblem-pine', color: '#4fc1b0' },
  dokro: { emblem: 'emblem-boar', color: '#b48ad8' },
  // 영남 판의 새 나라 열다섯 — 깃발은 나눠 쓰고 색으로 가른다
  saro: { emblem: 'emblem-rooster', color: '#f0d050' },
  daegaya: { emblem: 'emblem-crown', color: '#e88a3c' },
  dabeol: { emblem: 'emblem-cauldron', color: '#8a6a4a' },
  sabeol: { emblem: 'emblem-horse', color: '#5f9ea0' },
  usisan: { emblem: 'emblem-whale', color: '#7f8fa6' },
  bihwa: { emblem: 'emblem-mirror', color: '#c7d36f' },
  jomun: { emblem: 'emblem-ox', color: '#d9a066' },
  golbeol: { emblem: 'emblem-axe', color: '#a05050' },
  apdok: { emblem: 'emblem-toad', color: '#4f8a5f' },
  iseo: { emblem: 'emblem-bow', color: '#9fb7e0' },
  byeokjin: { emblem: 'emblem-stars', color: '#c08bb0' },
  gammun: { emblem: 'emblem-kiln', color: '#6c7f3a' },
  samul: { emblem: 'emblem-sailboat', color: '#3f86c6' },
  eumjeup: { emblem: 'emblem-antler', color: '#e5a3b8' },
  chopal: { emblem: 'emblem-reeds', color: '#b8a0d0' },
  // 삼한 남부 판의 새 나라 열다섯 — 백제 매(매사냥) · 목지 팔주령 · 상당 세형동검 · 무진 고인돌 · 발라 독무덤 · 하슬라 물범(반어피)
  baekje: { emblem: 'emblem-falcon', color: '#c9504a' },
  mokji: { emblem: 'emblem-bells', color: '#d4a03a' },
  michuhol: { emblem: 'emblem-wave', color: '#4a9fd0' },
  ungcheon: { emblem: 'emblem-bear', color: '#8d7a5a' },
  sangdang: { emblem: 'emblem-dagger', color: '#6a8aa0' },
  geonma: { emblem: 'emblem-plough', color: '#b8784a' },
  wansan: { emblem: 'emblem-ginkgo', color: '#7a9a4a' },
  gosaburi: { emblem: 'emblem-egret', color: '#a6a05a' },
  balla: { emblem: 'emblem-jars', color: '#9a4a6a' },
  mujin: { emblem: 'emblem-dolmen', color: '#5a6ab0' },
  gampyeong: { emblem: 'emblem-crab', color: '#3aa08a' },
  goryong: { emblem: 'emblem-snake', color: '#7a5aa0' },
  maek: { emblem: 'emblem-tiger', color: '#a0703a' },
  siljik: { emblem: 'emblem-fish', color: '#5aa0b8' },
  haseulla: { emblem: 'emblem-seal', color: '#c06a8a' },
  // 삼한과 북녘 판 — 고구려 삼족오 · 비류나 말 탄 궁수 · 연나 돌성문 · 환나 현무 · 관나 까마귀 · 부여 사슴 · 구가 개 · 동옥저 작살
  // 마가·우가·저가(말·소·돼지)와 북옥저·불내·탐라는 제 깃발이 아직 없다 — 그림 줄 4c
  goguryeo: { emblem: 'emblem-samjogo', color: '#c43c2c' },
  biryuna: { emblem: 'emblem-horsearcher', color: '#8a5a9a' },
  yeonna: { emblem: 'emblem-stonegate', color: '#6a7a8a' },
  hwanna: { emblem: 'emblem-tortoise', color: '#3a7a6a' },
  gwanna: { emblem: 'emblem-crow', color: '#4a4a5a' },
  buyeo: { emblem: 'emblem-deer', color: '#e8e0c8' },
  maga: { emblem: 'emblem-moon', color: '#b07a3a' },
  uga: { emblem: 'emblem-pine', color: '#7a8a3a' },
  jeoga: { emblem: 'emblem-sodo-bird', color: '#8a5a3a' },
  guga: { emblem: 'emblem-dog', color: '#c0a060' },
  dongokjeo: { emblem: 'emblem-harpoon', color: '#3a8ab0' },
  bukokjeo: { emblem: 'emblem-fish', color: '#2a6a8a' },
  bullae: { emblem: 'emblem-tiger', color: '#d08a3a' },
  tamna: { emblem: 'emblem-sailboat', color: '#5ab0a0' },
}

const KIND_ICON: Readonly<Record<NodeKind, string>> = {
  capital: 'settle-capital',
  village: 'settle-farm-village',
  sodo: 'settle-sodo-village',
  port: 'settle-port-town',
  fort: 'settle-hill-fort',
  ironMine: 'settle-iron-town',
  wild: 'settle-abandoned',
}

/** 빈땅을 일구면 — 섬은 고깃배 마을, 뭍은 작은 마을 */
const SETTLED_ICON: Readonly<Record<string, string>> = {
  'wild-keunseom': 'settle-island-town',
  'wild-dolseom': 'settle-fishing-village',
  'wild-seobu': 'settle-fishing-village',
  'wild-neoreun': 'settle-horse-ranch',
}

/** 고을 기호 — 종류가 바탕, 지형이 다르면 고을마다 바꾼다 */
const NODE_ICON: Readonly<Record<string, string>> = {
  'our-north': 'settle-hamlet',
  'our-east': 'settle-river-town',
  'miri-vil': 'settle-river-town',
  'goja-vil': 'settle-salt-town',
  'anya-vil': 'settle-mountain-hold',
  'n-haseulla-cap': 'settle-dongye', // 하슬라 — 동예의 바닷가 읍락 (과하마 · 물범 가죽)
  'm-baekje-v': 'settle-river-town',
  'm-sodo': 'settle-sodo-village',
  'y-usisan-cap': 'settle-whaling', // 우시산 — 반구대의 고래잡이
}

/**
 * 판마다의 고을 자리 — 넓어지는 지도(삼한 남부 · 삼한과 북녘)는 같은 고을(영남 판의 y-*)도 다른 틀이라 경위도에서 다시 셈한다.
 * 다른 판은 NODE_POS 그대로.
 */
export function nodePos(region: RegionId | undefined, id: string): readonly [number, number] | undefined {
  const g = worldGeoOf(region)
  if (g !== null) {
    const ll = placeOf(region, id)
    return ll !== undefined ? g.pos(ll[0], ll[1]) : undefined
  }
  return NODE_POS[id]
}

export function nodeIcon(n: RNode): string {
  if (n.kind === 'wild') return n.owner === null || n.hh <= 0 ? KIND_ICON.wild : (SETTLED_ICON[n.id] ?? 'settle-hamlet')
  // 마을은 지은 것이 보인다 — 해자 · 목책 (형: "짓기·자원이 지도에 안 보인다")
  if (n.kind === 'village' && NODE_ICON[n.id] === undefined) {
    if (n.tags.includes('moat')) return 'settle-moat'
    if (n.tags.includes('palisade')) return 'settle-palisade'
  }
  return NODE_ICON[n.id] ?? KIND_ICON[n.kind]
}

/** 지도 위 자리 (비율) — 변한 축소판 */
export const NODE_POS: Readonly<Record<string, readonly [number, number]>> = {
  // 첫 판(2026-10-18 시식)은 가운데 넷이 겹쳐 이름이 묻혔다 — 강줄기를 따라 벌렸다
  'miri-cap': [0.62, 0.24],
  'miri-vil': [0.53, 0.36],
  sodo: [0.38, 0.3],
  'anya-fort': [0.3, 0.17],
  'anya-cap': [0.25, 0.5],
  'anya-vil': [0.12, 0.45],
  'goja-cap': [0.2, 0.74],
  'goja-vil': [0.35, 0.72],
  'our-north': [0.41, 0.49],
  'our-cap': [0.5, 0.66],
  'our-east': [0.62, 0.52],
  'guya-vil': [0.74, 0.43],
  'guya-cap': [0.77, 0.66],
  'guya-iron': [0.8, 0.24],
  'dokro-cap': [0.92, 0.6],
  // 빈땅 (2026-10-18, 형: "빈땅도 좀 있고 개척도 좀 해야하고") — 산기슭·강가·바닷가·섬
  'wild-galmae': [0.13, 0.22],
  'wild-beodeul': [0.46, 0.15],
  'wild-gomgol': [0.72, 0.14],
  'wild-neoreun': [0.89, 0.36],
  'wild-seobu': [0.07, 0.65],
  'wild-keunseom': [0.3, 0.87],
  'wild-dolseom': [0.63, 0.82],
  // 영남 판 — 실제 경위도를 지도 그림과 같은 투영으로 (data/regions/yeongnam.ts GEO · tools/yeongnam-sketch.js)
  ...Object.fromEntries(Object.entries(YEONGNAM_GEO).map(([id, [lon, lat]]) => [id, yeongnamPos(lon, lat)])),
}

/** 계절 → 지도 바탕 (같은 땅의 네 철, ART ⑪) */
export const SEASON_MAP = { spring: 'spring', summer: 'summer', autumn: 'autumn', winter: 'winter' } as const

/** 병종 → 아이콘 */
export const UNIT_ICON = {
  spear: 'unit-spear', bow: 'unit-archer', pike: 'unit-pike', shield: 'unit-shield-wall',
  horse: 'unit-buyeo-cavalry', crossbow: 'unit-han-crossbow', boat: 'unit-boatmen',
} as const

/** 계절 → 아이콘 */
export const SEASON_ICON = { spring: 'status-spring', summer: 'status-summer', autumn: 'status-autumn', winter: 'status-winter' } as const
