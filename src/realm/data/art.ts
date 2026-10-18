/**
 * 나라의 그림 — 누가 어떤 얼굴, 고을이 어떤 기호, 나라가 어떤 깃발 (docs/realm/ART.md · 담기는 tools/realm-plate.ps1)
 *
 * 화면(ui)만 읽는다. 판(realm 상태)에는 그림이 없다 — 그림을 바꿔도 저장·리플레이가 안 흔들린다.
 * 파일은 public/realm/ 아래 이름이다 (굽기 전 원본은 assets_src/realm/, gitignore).
 * 지도 위 자리는 map/spring.jpg (1264×848) 위의 비율 0~1 — 변한 축소판의 [상상 배치]를 낙동강·남강 그림에 얹었다.
 */
import type { NodeKind, RNode } from '../types.ts'

/** 장수 id → 명치판 (bust/<이름>.jpg). g- 남자 장수 · w- 여인 · l- 전설 */
export const HERO_BUST: Readonly<Record<string, string>> = {
  chief: 'g-02-goguryeo-archer-prince', // 플레이어 — 활 쏘는 군장 (신궁)
  'guya-1': 'g-11-gaya-iron-general', // 진지렴 거타 — 구야국의 철
  'guya-2': 'g-04-jinhan-giant', // 험측 마루
  'anya-1': 'w-04-gaya-swordswoman', // 신지 아라 — 안야국의 여 신지
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
}

/** 나라 id → 깃발 (icon/emblem-*.png) · 지도의 테두리 색 */
export const FACTION_ART: Readonly<Record<string, { emblem: string; color: string }>> = {
  us: { emblem: 'emblem-wave', color: '#9fd18b' },
  guya: { emblem: 'emblem-fish', color: '#e0b64a' }, // 쌍어 — 김해
  anya: { emblem: 'emblem-mountain', color: '#d0674f' },
  miri: { emblem: 'emblem-grain', color: '#6fa8dc' },
  goja: { emblem: 'emblem-sun', color: '#4fc1b0' },
  dokro: { emblem: 'emblem-boar', color: '#b48ad8' },
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
}

export function nodeIcon(n: RNode): string {
  if (n.kind === 'wild') return n.owner === null || n.hh <= 0 ? KIND_ICON.wild : (SETTLED_ICON[n.id] ?? 'settle-hamlet')
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
