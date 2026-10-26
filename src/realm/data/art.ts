/**
 * 나라의 그림 — 누가 어떤 얼굴, 고을이 어떤 기호, 나라가 어떤 깃발 (docs/realm/ART.md · 담기는 tools/realm-plate.ps1)
 *
 * 화면(ui)만 읽는다. 판(realm 상태)에는 그림이 없다 — 그림을 바꿔도 저장·리플레이가 안 흔들린다.
 * 파일은 public/realm/ 아래 이름이다 (굽기 전 원본은 assets_src/realm/, gitignore).
 * 지도 위 자리는 map/spring.jpg (1264×848) 위의 비율 0~1 — 변한 축소판의 [상상 배치]를 낙동강·남강 그림에 얹었다.
 */
import type { Good, NodeKind, RegionId, RNode } from '../types.ts'
import type { CustomId } from './customs.ts'
import { GEO as YEONGNAM_GEO, yeongnamPos } from './regions/yeongnam.ts'
import { placeOf, worldGeoOf } from './regions/index.ts'

/**
 * 판마다 지도 그림 — 폴더 · 확장자 · 그림 크기(SVG 좌표계) · 고을 기호·글씨 크기 배수 · 가장 큰 배율(cover 의 몇 배, zoom.ts) · 땅빛 둘레 (mapview.ts)
 * 영남 판은 고을이 빽빽해서 기호를 작게, 땅빛을 좁게 둔다.
 */
export const REGION_ART: Readonly<Record<RegionId, { dir: string; ext: string; w: number; h: number; nodeScale: number; labelScale: number; zmax: number; terrR: number; terrBand: number }>> = {
  'byeonhan-mini': { dir: 'map', ext: 'jpg', w: 1264, h: 848, nodeScale: 0.36, labelScale: 0.9, zmax: 2.2, terrR: 150, terrBand: 90 },
  // 배우는 판 — 한강 아래 (삼한 남부 판의 조각을 좁게 · tutorial-geo.ts). 경도 1.4° × 위도 0.95° 를 조각 눈금의 두 배로
  tutorial: { dir: 'map-world', ext: 'webp', w: 989, h: 727, nodeScale: 0.5, labelScale: 0.85, zmax: 2.5, terrR: 100, terrBand: 60 },
  // 캠페인 2장 — 혼강에서 두만강까지 (삼한과 북녘 판의 조각을 좁게 · jumong-geo.ts). 경도 5.3° × 위도 2.25° 를 조각 눈금 그대로
  // 캠페인 3장 — 경주 골짜기 (seorabeol-geo.ts). 경도 0.8° × 위도 0.65° 를 조각 눈금의 두 배 반으로
  seorabeol: { dir: 'map-world', ext: 'webp', w: 706, h: 622, nodeScale: 0.5, labelScale: 0.8, zmax: 2.5, terrR: 80, terrBand: 48 },
  // 캠페인 1장 — 한강 아래에서 차령까지 (mahan-geo.ts). 경도 1.3° × 위도 1.35° 를 조각 눈금의 두 배로
  mahan: { dir: 'map-world', ext: 'webp', w: 918, h: 1033, nodeScale: 0.45, labelScale: 0.8, zmax: 3, terrR: 90, terrBand: 54 },
  jumong: { dir: 'map-world', ext: 'webp', w: 1871, h: 861, nodeScale: 0.32, labelScale: 0.75, zmax: 5, terrR: 60, terrBand: 34 },
  yeongnam: { dir: 'map-yeongnam', ext: 'webp', w: 1024, h: 765, nodeScale: 0.24, labelScale: 0.55, zmax: 4, terrR: 50, terrBand: 28 },
  // 삼한 남부 — 조각 넷을 이은 그림(ui/realm/worldmap.ts 가 합친다). 크기는 조각 눈금(1024px = 경도 2.9° · 765px = 위도 2.0°)으로 경도 5.5° × 위도 3.75°
  south: { dir: 'map-world', ext: 'webp', w: 1942, h: 1434, nodeScale: 0.2, labelScale: 0.6, zmax: 6, terrR: 52, terrBand: 28 },
  // 삼한과 북녘 — 조각 스물다섯. 같은 눈금으로 경도 13.9° × 위도 12.5° (요동·요서·연해주까지 — 2026-10-20). 기호는 경도 5.5° 판일 때와 같은 크기가 되게 줄인다
  world: { dir: 'map-world', ext: 'webp', w: 4908, h: 4781, nodeScale: 0.079, labelScale: 0.6, zmax: 15, terrR: 52, terrBand: 28 },
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
  'us-ruler': 'w-63-us-haesol', // 읍차 해솔 — 매혹
  'guya-ruler': 'g-69-guya-soebo', // 진지렴 쇠보 — 쇠의 나라의 대장장이 군주
  'anya-ruler': 'g-40-anya-adan', // 신지 아단 — 신중
  'miri-ruler': 'w-64-miri-dallae', // 신지 달래 — 곡창의 여가장
  'goja-ruler': 'g-41-goja-bau', // 험측 바우 — 물길·장사
  'dokro-ruler': 'g-42-dokro-garam', // 읍차 가람
  // 둘째 장군들
  'us-1': 'g-09-farmer-conscript',
  'miri-2': 'w-02-goguryeo-lady',
  'goja-2': 'w-17-mahan-pearl-diver',
  'dokro-2': 'g-08-veteran',
  // 떠돌이 인재 스물 (data/heroes-pool.ts) — 여인 열다섯
  'wander-01': 'w-18-jinhan-salt-widow', 'wander-02': 'w-03-goguryeo-archer', 'wander-03': 'w-12-court-dancer',
  'wander-04': 'w-11-assassin', 'wander-05': 'w-83-gyeonji-beodeul', 'wander-06': 'w-06-buyeo-huntress',
  'wander-07': 'w-19-buyeo-fur-princess', 'wander-08': 'w-22-dongye-tiger-huntress', 'wander-09': 'w-05-baekje-queen',
  'wander-10': 'w-21-baekje-court-dancer', 'wander-11': 'g-61-heomcheuk-bawi', 'wander-12': 'g-88-wander-soeul',
  'wander-13': 'w-14-feast-spy', 'wander-14': 'g-60-eupcha-hangyeol', 'wander-15': 'w-09-byeonhan-smith',
  'wander-16': 'w-20-gaya-smith-daughter', 'wander-17': 'g-12-silla-youth', 'wander-18': 'w-01-silla-princess',
  'wander-19': 'g-15-shaman-man', 'wander-20': 'w-08-mahan-warrior',
  'wander-21': 'w-84-salhae-dallae', 'wander-22': 'w-85-sinji-neoul', 'wander-23': 'g-62-beonye-hanul', 'wander-24': 'g-63-heomcheuk-beogeum', 'wander-25': 'g-84-wander-seoneul', 'wander-26': 'g-85-wander-ure',
  // 영남 판 (data/regions/yeongnam.ts) — 변한 판과 같은 나라는 같은 얼굴. 새 군주 열다섯은 있는 명치판을 나눠 쓴다 (여인이 많다)
  // 영남 판을 위해 새로 받은 여덟 (2026-10-18): 사로 이사금 · 대가야 왕 · 사벌 노장 · 사물 바다 군장 · 우시산 고래잡이 여군장 · 압독 여왕 · 비화가야 무녀 군주 · 이서 여장수
  'saro-ruler': 'g-17-saro-isageum', 'daegaya-ruler': 'g-18-daegaya-king', 'dabeol-ruler': 'g-35-dabeol-dalgu',
  'sabeol-ruler': 'g-19-sabeol-veteran', 'usisan-ruler': 'w-23-usisan-whale-queen', 'bihwa-ruler': 'w-25-bihwa-priestess',
  'jomun-ruler': 'w-59-jomun-irang', 'golbeol-ruler': 'w-60-golbeol-beom', 'apdok-ruler': 'w-24-apdok-queen',
  'iseo-ruler': 'w-61-iseo-sinae', 'byeokjin-ruler': 'w-62-byeokjin-byeol', 'gammun-ruler': 'g-36-gammun-gamdol',
  'samul-ruler': 'g-20-samul-sea-lord', 'eumjeup-ruler': 'g-37-eumjeup-jeup', 'chopal-ruler': 'g-38-chopal-palmae',
  'saro-1': 'g-55-saro-bakdal', 'saro-2': 'w-66-saro-noeul', 'daegaya-1': 'w-75-daegaya-soemoe', 'sabeol-1': 'w-77-sabeol-malgalgi',
  'dabeol-1': 'g-45-dabeol-deulgae', 'usisan-1': 'g-01-master-smith', 'jomun-1': 'g-93-jomun-solgae', 'iseo-1': 'w-26-iseo-tomboy-general',
  'samul-1': 'w-73-samul-sagong', 'bihwa-1': 'g-57-bihwa-neup', 'eumjeup-1': 'w-72-eumjeup-beol',
  // 삼한 남부 판의 새 군주·장군 (data/regions/south.ts) — 있는 명치판을 나눠 쓴다. 새 얼굴은 그림 줄(인물 — 챗지피티)
  // 배우는 판 — 온조 형제와 신하 (tutorial.ts)
  // 캠페인 2장 — 주몽과 세 벗 · 송양 · 대소 (jumong.ts)
  // 주몽 — 챗지피티로 받은 고구려 군주 얼굴을 다시 쓴다 (형 10-23: "전에 것이 챗지피티로 만들어 더 멋있었는데 · 지금 것은 제미나이라 별로 — 나중에 만들어"). 새 얼굴은 ART-QUEUE
  'jm-jumong': 'g-64-jumong', 'jm-oi': 'g-16-goguryeo-gaema-commander', 'jm-mari': 'g-92-goguryeo-mari', 'jm-hyeopbo': 'g-06-strategist',
  'jm-songyang': 'g-91-biryu-songyang', 'jm-songbi': 'w-52-biryuna-songbi', 'jm-daeso': 'g-67-buyeo-daeso', 'jm-haedal': 'w-67-buyeo-haedal',
  'jm-haengin-ruler': 'g-90-haengin-gomok', 'jm-haengin-1': 'w-96-haengin-neoul', 'jm-okjeo-ruler': 'g-34-bukokjeo-duman', 'jm-okjeo-1': 'w-70-bukokjeo-mulbeom',
  // 캠페인 1장 — 온조와 신하들 · 마한의 진왕과 장수 (mahan.ts). 있는 명치판을 나눠 쓴다
  'mh-onjo': 'g-71-baekje-onjo', 'mh-eureum': 'g-73-baekje-eureum', 'mh-ogan': 'g-13-baekje-general', 'mh-soseono': 'l-L2-soseono',
  'mh-jinwang': 'g-76-mokji-jinha', 'mh-mahan-1': 'g-83-mokji-keundol', 'mh-mahan-2': 'w-94-mokji-dallae', 'mh-mahan-3': 'g-86-mokji-geumbawi',
  // 캠페인 3장 — 혁거세·알영·호공 · 여섯 촌장 · 왜인 (seorabeol.ts). 알영은 전설 명치판
  'sr-hyeokgeose': 'g-74-saro-hyeokgeose', 'sr-aryeong': 'l-L7-aryeong', 'sr-hogong': 'g-75-saro-hogong', 'sr-danbi': 'w-90-saro-danbi',
  'sr-alpyeong': 'g-78-saro-alpyeong', 'sr-sobeol': 'g-77-saro-sobeol', 'sr-jibaekho': 'g-79-saro-jibaekho', 'sr-guryema': 'g-80-saro-guryema',
  'sr-jita': 'g-81-saro-jita', 'sr-hojin': 'g-82-saro-hojin', 'sr-yangsan-1': 'w-91-saro-mulsae', 'sr-goya-1': 'w-92-saro-dallae',
  'sr-jinji-1': 'w-93-saro-beomi', 'sr-wae-ruler': 'g-87-wae-chief',
  'tut-onjo': 'g-71-baekje-onjo', 'tut-biryu': 'g-28-goguryeo-damul', 'tut-ogan': 'g-13-baekje-general', 'tut-maryeo': 'g-89-baekje-maryeo', 'tut-haebi': 'w-95-michuhol-haebi',
  'baekje-ruler': 'g-68-baekje-onnuri', 'mokji-ruler': 'w-27-mokji-jinha', 'michuhol-ruler': 'w-28-michuhol-bira',
  'ungcheon-ruler': 'g-22-ungcheon-gomnae', 'sangdang-ruler': 'g-23-sangdang-soedal', 'geonma-ruler': 'w-46-geonma-maru',
  'wansan-ruler': 'g-24-wansan-onsan', 'gosaburi-ruler': 'w-47-gosaburi-baram', 'balla-ruler': 'g-25-balla-keunmoe',
  'mujin-ruler': 'w-48-mujin-mudeung', 'gampyeong-ruler': 'g-26-gampyeong-gaetbeol', 'goryong-ruler': 'w-49-goryong-gureum',
  'maek-ruler': 'g-27-maek-maekdol', 'siljik-ruler': 'w-50-siljik-mulga', 'haseulla-ruler': 'w-51-haseulla-dangung',
  'baekje-1': 'g-53-baekje-haeru', 'mokji-1': 'g-54-mokji-mahan', 'wansan-1': 'w-78-wansan-wan', 'balla-1': 'w-74-balla-dokmudeom',
  'maek-1': 'w-68-maek-beombal', 'haseulla-1': 'g-56-haseulla-gwahama', 'gampyeong-1': 'w-76-gampyeong-baetsagong',
  // 삼한과 북녘 판의 새 군주·장군 (data/regions/world.ts) — 있는 명치판을 나눠 쓴다. 새 얼굴은 그림 줄(ART-QUEUE 5c)
  'goguryeo-ruler': 'g-65-goguryeo-damul', 'goguryeo-1': 'g-49-goguryeo-sona', 'goguryeo-2': 'w-65-goguryeo-hwalmi',
  'biryuna-ruler': 'w-52-biryuna-songbi', 'biryuna-1': 'g-51-biryuna-mulgyeol', 'yeonna-ruler': 'g-29-yeonna-myeongsol', 'yeonna-1': 'w-71-yeonna-neoul',
  'hwanna-ruler': 'w-53-hwanna-gabi', 'hwanna-1': 'g-43-hwanna-amnok', 'gwanna-ruler': 'g-30-gwanna-soemoe', 'gwanna-1': 'g-48-gwanna-musoe',
  'buyeo-ruler': 'g-66-buyeo-geumha', 'buyeo-1': 'w-67-buyeo-haedal', 'maga-ruler': 'w-54-maga-dalli', 'maga-1': 'g-44-maga-malgup',
  'uga-ruler': 'g-32-uga-sodu', 'uga-1': 'g-46-uga-nureongso', 'jeoga-ruler': 'g-33-jeoga-metdol', 'jeoga-1': 'w-69-jeoga-eomni',
  'guga-ruler': 'w-55-guga-nuri', 'guga-1': 'g-47-guga-sanyanggae', 'dongokjeo-ruler': 'w-56-dongokjeo-sogeum', 'dongokjeo-1': 'g-05-mahan-chieftain',
  'bukokjeo-ruler': 'g-34-bukokjeo-duman', 'bukokjeo-1': 'w-70-bukokjeo-mulbeom', 'bullae-ruler': 'w-57-bullae-bakdal', 'bullae-1': 'g-50-bullae-gwaha',
  'tamna-ruler': 'w-58-tamna-halla', 'tamna-1': 'g-52-tamna-oreum',
  // 넓어진 땅 (2026-10-20) — 우산국 우해왕 (울릉도 전설) · 양맥 군장 맥손 · 장수 솔매 · 우산 장수 강치 (그림 줄 5f, 제미나이)
  'usan-ruler': 'g-58-usan-uhae', 'yangmaek-ruler': 'g-59-yangmaek-maekson', 'yangmaek-1': 'w-79-yangmaek-solmae', 'usan-1': 'w-80-usan-gangchi',
  // 여인 장수 더 (형 2026-10-19: "장수도 여캐 많았으면 좋겠으니 챗지피티로") — 판마다 장수 절반쯤이 여인. 아라·고자 둘은 변한 판의 얼굴 그대로
  // 제 얼굴(w-29 ~ w-45, 그림 줄 5d)을 받기 전까지는 있는 명치판을 빌린다 — 받으면 여기만 바꾼다
  'us-2': 'w-29-golpo-janmul', 'guya-3': 'w-30-guya-soebi',
  'dabeol-2': 'w-31-dabeol-dalbit', 'golbeol-2': 'w-32-golbeol-budeul', 'gammun-2': 'w-33-gammun-gamsil', 'chopal-2': 'w-34-chopal-deulme', 'jomun-2': 'w-35-jomun-odi',
  'baekje-2': 'w-36-baekje-maena', 'michuhol-2': 'w-37-michuhol-gaennae', 'sangdang-2': 'w-38-sangdang-bulmae', 'gosaburi-2': 'w-39-gosaburi-galmae', 'mujin-2': 'w-40-mujin-munui',
  'hwanna-2': 'w-41-hwanna-beodeul', 'gwanna-2': 'w-42-gwanna-soenun', 'uga-2': 'w-43-uga-nuri', 'dongokjeo-2': 'w-44-okjeo-sogeumbi', 'tamna-2': 'w-45-tamna-oreumbi',
  // 얼굴이 없던 첫째 장수 열셋 (2026-10-21 밤 챗지피티 격자 둘 — 칸마다 생김새를 적었다)
  'golbeol-1': 'g-60-golbeol-golgae', 'apdok-1': 'g-61-apdok-ap', 'gammun-1': 'g-62-gammun-gamnamu', 'chopal-1': 'g-63-chopal-yeoul',
  'michuhol-1': 'g-64-michuhol-sogeumkkun', 'sangdang-1': 'g-65-sangdang-soemangchi', 'geonma-1': 'g-66-geonma-malbalgup', 'gosaburi-1': 'g-67-gosaburi-buri',
  'mujin-1': 'g-68-mujin-bitgoeul', 'goryong-1': 'g-69-goryong-yong', 'siljik-1': 'g-70-siljik-pado', 'byeokjin-1': 'w-81-byeokjin-byeolbit', 'ungcheon-1': 'w-82-ungcheon-gom',
}

/** 혼인에서 난 아이가 다 자란 얼굴 — 젊은 명치판(그림 줄 K1)에서 성별(look)에 맞춰 id 로 하나 고른다 (어려 보이는 둘은 뺐다 — 형 10-24) */
export const KID_BUST: Readonly<Record<'g' | 'w', readonly string[]>> = {
  g: ['y-g-01', 'y-g-02', 'y-g-03', 'y-g-04', 'y-g-05', 'y-g-06', 'y-g-07', 'y-g-09'],
  w: ['y-w-01', 'y-w-02', 'y-w-03', 'y-w-04', 'y-w-05', 'y-w-06', 'y-w-07', 'y-w-09'],
}
/** 자라는 동안의 얼굴 — 장수로 쓰기엔 어려 보이는 명치판 (형 10-24: "아이 이미지가 너무 어린아이 · 성장 중으로 · 자라면 본래 모습으로 교체") */
export const GROW_BUST: Readonly<Record<'g' | 'w', readonly string[]>> = { g: ['y-g-08'], w: ['y-w-08'] }

export function kidBust(id: string, look: 'g' | 'w'): string | undefined {
  const pool = KID_BUST[look]
  let x = 0
  for (const c of id) x = (x * 31 + c.charCodeAt(0)) >>> 0
  return pool.length > 0 ? pool[x % pool.length] : undefined
}

/** 판의 아이들 — id 만 아는 곳(싸움 기록·고을 판의 말)도 얼굴을 찾게, 화면이 판을 그릴 때 적어 둔다 */
const kidFace = new Map<string, string>()
/** 지금 자라는 얼굴을 단 아이 — 다 자라 장수 목록에 오르면 어른 얼굴로 바꾼다 */
const childFace = new Set<string>()
export function noteGrowing(kids: Iterable<{ readonly id: string; readonly look: 'g' | 'w' }>): void {
  for (const h of kids) {
    if (kidFace.has(h.id)) continue
    const pool = GROW_BUST[h.look]
    let x = 0
    for (const c of h.id) x = (x * 31 + c.charCodeAt(0)) >>> 0
    if (pool.length > 0) { kidFace.set(h.id, pool[x % pool.length]!); childFace.add(h.id) }
  }
}
export function noteKids(heroes: Iterable<{ readonly id: string; readonly look: 'g' | 'w'; readonly parents?: unknown }>): void {
  for (const h of heroes) {
    if (h.parents === undefined || (kidFace.has(h.id) && !childFace.has(h.id))) continue
    childFace.delete(h.id)
    const f = kidBust(h.id, h.look)
    if (f !== undefined) kidFace.set(h.id, f)
  }
}

/** 장수 id → 명치판 이름 (아이도) · 다음 판에 데려온 가문의 아이(`clan-<생김>-<시드>-<판의 id>`)는 난 판의 얼굴 그대로 */
export const bustOf = (id: string): string | undefined => HERO_BUST[id] ?? kidFace.get(id) ?? clanFace(id)
function clanFace(id: string): string | undefined {
  if (!id.startsWith('clan-')) return undefined
  const [, look, , ...rest] = id.split('-')
  return look === 'g' || look === 'w' ? kidBust(rest.join('-'), look) : undefined
}

/**
 * 나라 id → 깃발 (icon/emblem-*.png) · 두 빛 — 축구팀 유니폼처럼 바탕 빛(color: 이름표의 몸 · 땅빛)과 둘째 빛(color2: 이름표의 띠)
 * (형 10-26: "적국 수가 막 7개 넘어가면 어느 나라가 어느 나라인지 전혀 구분이 안 가 … 비슷한 나라들에 색이 겹치면 두 번째 컬러")
 * 한 판에 같이 서는 두 나라는 바탕이 멀거나, 바탕이 가까우면 둘째 빛이 멀어야 한다 — tests/realm/kit-color.test.ts 가 지킨다.
 * 새 나라를 넣으면 `node --experimental-strip-types tools/kit-colors.ts` 가 겹치는 짝과 둘째 빛 후보를 말한다.
 */
/**
 * 나라 깃발 그림 — 나라마다 한 장 (제미나이 Argon 4×4 넷 → tools/cut-flags.py → icon/nflag-<나라>.png · 옛 깃발과 같은 틀).
 * 토템 문양이 곧 그 나라 — 문양을 아주 진한 빛으로 꽉 채우고(빨간 돼지 · 파란 고래) 천은 다른 빛 · 무구 하나씩 (형 10-26: "중앙색이 다 구분되어야 · 빨간 돼지 파란 고래 이런 식으로 · 시뻘겋거나 새파래도 됨").
 * `emblem` 은 옛 깃발 그림(icon/emblem-*) — 화면에는 이 깃발을 쓴다.
 */
export function flagIcon(f: string | null | undefined): string | undefined {
  return f != null && FACTION_ART[f] !== undefined ? `nflag-${f}` : undefined
}

export const FACTION_ART: Readonly<Record<string, { emblem: string; color: string; color2: string }>> = {
  us: { emblem: 'emblem-shell', color: '#9fd18b', color2: '#6a2a7a' },
  guya: { emblem: 'emblem-twinfish', color: '#e0b64a', color2: '#b0202a' }, // 쌍어 — 김해
  anya: { emblem: 'emblem-mountain', color: '#d0674f', color2: '#6cc8f0' },
  miri: { emblem: 'emblem-grain', color: '#6fa8dc', color2: '#f08ab0' },
  goja: { emblem: 'emblem-pine', color: '#4fc1b0', color2: '#f08ab0' },
  dokro: { emblem: 'emblem-boar', color: '#b48ad8', color2: '#1e1a16' },
  // 영남 판의 새 나라 열다섯 — 깃발은 나눠 쓰고 색으로 가른다
  saro: { emblem: 'emblem-rooster', color: '#f0d050', color2: '#1f3f8f' },
  daegaya: { emblem: 'emblem-crown', color: '#e88a3c', color2: '#b0202a' },
  dabeol: { emblem: 'emblem-cauldron', color: '#8a6a4a', color2: '#6a2a7a' },
  sabeol: { emblem: 'emblem-horse', color: '#5f9ea0', color2: '#1e1a16' },
  usisan: { emblem: 'emblem-whale', color: '#7f8fa6', color2: '#f6f1e4' },
  bihwa: { emblem: 'emblem-mirror', color: '#c7d36f', color2: '#e86a1a' },
  jomun: { emblem: 'emblem-ox', color: '#d9a066', color2: '#2f8a3a' },
  golbeol: { emblem: 'emblem-axe', color: '#a05050', color2: '#2f8a3a' },
  apdok: { emblem: 'emblem-toad', color: '#4f8a5f', color2: '#f08ab0' },
  iseo: { emblem: 'emblem-bow', color: '#9fb7e0', color2: '#1e1a16' },
  byeokjin: { emblem: 'emblem-stars', color: '#c08bb0', color2: '#2f8a3a' },
  gammun: { emblem: 'emblem-kiln', color: '#6c7f3a', color2: '#1f3f8f' },
  samul: { emblem: 'emblem-sailboat', color: '#3f86c6', color2: '#f2c230' },
  eumjeup: { emblem: 'emblem-antler', color: '#e5a3b8', color2: '#1f3f8f' },
  chopal: { emblem: 'emblem-reeds', color: '#b8a0d0', color2: '#e86a1a' },
  // 삼한 남부 판의 새 나라 열다섯 — 백제 매(매사냥) · 목지 팔주령 · 상당 세형동검 · 무진 고인돌 · 발라 독무덤 · 하슬라 물범(반어피)
  baekje: { emblem: 'emblem-falcon', color: '#c9504a', color2: '#f2c230' },
  mokji: { emblem: 'emblem-bells', color: '#d4a03a', color2: '#b8e04a' },
  // 3장 여섯 마을 · 왜인 (seorabeol.ts) — 깃발에 해 동그라미는 쓰지 않는다
  'sr-yangsan': { emblem: 'emblem-reeds', color: '#6aa8c8', color2: '#e86a1a' }, 'sr-goheo': { emblem: 'emblem-dolmen', color: '#c8a050', color2: '#1f3f8f' },
  'sr-jinji': { emblem: 'emblem-pine', color: '#4f8a5a', color2: '#6a2a7a' }, 'sr-daesu': { emblem: 'emblem-deer', color: '#a0703a', color2: '#b8e04a' },
  'sr-gari': { emblem: 'emblem-grain', color: '#d8c060', color2: '#b0202a' }, 'sr-goya': { emblem: 'emblem-mountain', color: '#8a6ab0', color2: '#b8e04a' },
  'sr-wae': { emblem: 'emblem-wave', color: '#5a5f6a', color2: '#b8e04a' },
  michuhol: { emblem: 'emblem-wave', color: '#4a9fd0', color2: '#2f8a3a' },
  ungcheon: { emblem: 'emblem-bear', color: '#8d7a5a', color2: '#b8e04a' },
  sangdang: { emblem: 'emblem-dagger', color: '#6a8aa0', color2: '#e86a1a' },
  geonma: { emblem: 'emblem-plough', color: '#b8784a', color2: '#b8e04a' },
  wansan: { emblem: 'emblem-ginkgo', color: '#7a9a4a', color2: '#f6f1e4' },
  gosaburi: { emblem: 'emblem-egret', color: '#a6a05a', color2: '#b0202a' },
  balla: { emblem: 'emblem-jars', color: '#9a4a6a', color2: '#1f3f8f' },
  mujin: { emblem: 'emblem-dolmen', color: '#5a6ab0', color2: '#1e1a16' },
  gampyeong: { emblem: 'emblem-crab', color: '#3aa08a', color2: '#e86a1a' },
  goryong: { emblem: 'emblem-snake', color: '#7a5aa0', color2: '#e86a1a' },
  maek: { emblem: 'emblem-tiger', color: '#a0703a', color2: '#b0202a' },
  siljik: { emblem: 'emblem-fish', color: '#5aa0b8', color2: '#b8e04a' },
  haseulla: { emblem: 'emblem-seal', color: '#c06a8a', color2: '#e86a1a' },
  // 삼한과 북녘 판 — 고구려 삼족오 · 비류나 말 탄 궁수 · 연나 돌성문 · 환나 현무 · 관나 까마귀 · 부여 사슴 · 구가 개 · 동옥저 작살
  // 마가·우가·저가(말·소·돼지)와 북옥저·불내·탐라는 제 깃발이 아직 없다 — 그림 줄 4c
  goguryeo: { emblem: 'emblem-samjogo', color: '#c43c2c', color2: '#1e1a16' },
  yangmaek: { emblem: 'emblem-bow', color: '#7a8a3a', color2: '#1e1a16' }, // 맥궁 — 맥 사람의 활 (요동 태자하)
  usan: { emblem: 'emblem-usan', color: '#2f7fa0', color2: '#6a2a7a' }, // 강치 — 독도 바위 위의 바다사자 (2026-10-20 제미나이)
  biryuna: { emblem: 'emblem-horsearcher', color: '#8a5a9a', color2: '#b8e04a' },
  yeonna: { emblem: 'emblem-stonegate', color: '#6a7a8a', color2: '#2f8a3a' },
  hwanna: { emblem: 'emblem-tortoise', color: '#3a7a6a', color2: '#1f3f8f' },
  gwanna: { emblem: 'emblem-crow', color: '#4a4a5a', color2: '#f2c230' },
  buyeo: { emblem: 'emblem-deer', color: '#e8e0c8', color2: '#1f3f8f' },
  maga: { emblem: 'emblem-maga', color: '#b07a3a', color2: '#1e1a16' },
  uga: { emblem: 'emblem-uga', color: '#7a8a3a', color2: '#f2c230' },
  jeoga: { emblem: 'emblem-jeoga', color: '#8a5a3a', color2: '#6cc8f0' },
  guga: { emblem: 'emblem-dog', color: '#c0a060', color2: '#6cc8f0' },
  dongokjeo: { emblem: 'emblem-harpoon', color: '#3a8ab0', color2: '#1e1a16' },
  bukokjeo: { emblem: 'emblem-bukokjeo', color: '#2a6a8a', color2: '#f08ab0' },
  bullae: { emblem: 'emblem-bullae', color: '#d08a3a', color2: '#1f3f8f' },
  tamna: { emblem: 'emblem-tamna', color: '#5ab0a0', color2: '#b8e04a' },
  haengin: { emblem: 'emblem-moon', color: '#6a8a5a', color2: '#6a2a7a' }, // 캠페인 2장 — 태백산 기슭의 행인국 (초승달)
}

/** 물건의 그림 — 창고 · 사신 · 지도의 특산 표가 함께 쓴다. 나무는 장작 짐 (형: '주고받을 거래에 이상한 소나무국기있음') */
export const GOOD_ICON: Readonly<Record<Good, string>> = { grain: 'good-rice', iron: 'treasure-iron-ingots', salt: 'good-salt', wood: 'good-wood', horse: 'good-horse' }

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
  'm-baekje-v': 'settle-river-town',
  'm-sodo': 'settle-sodo-village',
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

/**
 * 도읍의 갈래 — 군장이 있는 곳은 갈래마다 생김이 다르다 (형: "도읍은 별표가 있기는 하지만 이미지도 좀 달라야 … 사료로 최대한").
 *  - 마한: 국읍마다 천군이 있고 소도에 큰 나무와 솟대 · 집은 초가 흙집이 무덤 꼴 (위서 동이전 한전 "草屋土室 形如冢")
 *  - 진한·변한: 성책을 두르고 나무를 가로로 쌓아 집을 지었다 (변진 "有城柵" · "作屋橫累木") · 변한은 쇠가 난다
 *  - 고구려: 돌로 쌓은 성 · 큰 집 곁의 높은 다락 창고 부경 (고구려전 "無大倉庫 家家自有小倉 名之為桴京")
 *  - 부여: 둥근 목책을 성으로 삼고 궁실 · 창고 · 뇌옥이 있다 (부여전 "作城柵皆員 … 有宮室倉庫牢獄")
 *  - 동예·옥저: 큰 군장 없이 읍락의 어른(삼로)이 다스린다 · 바닷가 (동예전·동옥저전) — 탐라·우산도 바닷가 읍락으로
 * 고을 id 로 가린다 — 도읍은 늘 `-cap` 으로 끝나고, 앞 글자가 판의 갈래다 (m- 마한 · g- 고구려 · b- 부여 · n-/o-/d-/t-/u- 동쪽·바다)
 */
export type CapKin = 'mahan' | 'jinbyeon' | 'goguryeo' | 'buyeo' | 'dongye'
export function capKin(id: string): CapKin {
  if (id.startsWith('m-') || id.startsWith('tut-')) return 'mahan' // 배우는 판 — 한강 아래 백제·미추홀
  if (id.startsWith('g-') || id === 'y-yangmaek-cap') return 'goguryeo' // 양맥 — 압록 가의 맥족, 고구려와 같은 갈래
  if (id.startsWith('b-')) return 'buyeo'
  // 2장 졸본 — 졸본·비류·행인은 맥족 고구려 갈래, 북옥저는 바닷가 읍락 (점검 10-25: 접두 jm- 를 몰라 변한 목책으로 그려졌다)
  if (id === 'jm-okjeo-cap') return 'dongye'
  if (id.startsWith('jm-')) return 'goguryeo'
  if (/^(n|o|d|t|u)-/.test(id)) return 'dongye'
  return 'jinbyeon'
}
/** 도읍 기호 — 목책을 둘렀으면 갈래의 성, 아니면 울 없는 군장 마을. 동예·옥저는 늘 읍락 (목책 그림과 실제가 어긋나지 않게) */
export function capitalIcon(n: RNode): string {
  const kin = capKin(n.id)
  if (kin === 'dongye') return 'capital-dongye'
  return n.tags.includes('palisade') ? `capital-${kin}` : 'capital-open'
}

export function nodeIcon(n: RNode): string {
  if (n.kind === 'capital' || n.id.endsWith('-cap')) return capitalIcon(n)
  if (n.kind === 'wild') return n.owner === null || n.hh <= 0 ? KIND_ICON.wild : (SETTLED_ICON[n.id] ?? (n.tags.includes('pasture') ? 'settle-horse-ranch' : 'settle-hamlet'))
  // 마을은 지은 것이 보인다 — 해자 · 목책 (형: "짓기·자원이 지도에 안 보인다")
  if (n.kind === 'village' && NODE_ICON[n.id] === undefined) {
    if (n.tags.includes('moat')) return 'settle-moat'
    if (n.tags.includes('palisade')) return 'settle-palisade'
    // 말이 나는 들은 목장 마을 — 특산이 그림에서 보이게 (형: "특산품이 다른거라면 이미지마다 명확히")
    if (n.tags.includes('pasture')) return 'settle-horse-ranch'
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
  'dokro-cap': [0.86, 0.53], // 새 바탕(10-25)에선 0.92 가 바다 — 바닷가 산기슭으로
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
/** 풍습·나라 고리·땅 한 수의 그림 (data/customs.ts) — 카드 · 보고 줄 · 처음 터지는 장면 */
export const CUSTOM_ICON: Readonly<Partial<Record<CustomId, string>>> = {
  guseul: 'treasure-glass-beads', deongisoe: 'treasure-iron-ingots', girbikyeo: 'route-caravan',
  yeoseotmaeul: 'settle-hamlet', judge: 'emblem-seal', dalcheon: 'settle-iron-town', sonoe: 'good-crossbow-trigger',
  ireoseom: 'settle-beacon', dalbeol: 'settle-stone-fortress', geumseong: 'settle-besieged', julta: 'ask-truce',
  soebae: 'settle-shipyard', posang: 'emblem-sailboat',
  landIron: 'settle-forge', landPort: 'route-searoute', landReeds: 'settle-reed-ambush', landHigh: 'settle-pass', landPasture: 'settle-horse-ranch', landSodo: 'route-sotdae',
}

export const UNIT_ICON = {
  spear: 'unit-spear', bow: 'unit-archer', pike: 'unit-pike', shield: 'unit-shield-wall',
  horse: 'unit-buyeo-cavalry', crossbow: 'unit-han-crossbow', boat: 'unit-marine', // 수군은 걸어서 싸우는 그림 — 배 탄 그림(unit-boatmen)은 물 위 싸움에서만 (형 10-25)
} as const

/** 계절 → 아이콘 */
export const SEASON_ICON = { spring: 'status-spring', summer: 'status-summer', autumn: 'status-autumn', winter: 'status-winter' } as const
