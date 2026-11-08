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
  // 캠페인 4장 — 김해 골과 낙동강 어귀 (gujibong-geo.ts). 경도 0.9° × 위도 0.75° 를 조각 눈금의 두 배로
  gujibong: { dir: 'map-world', ext: 'webp', w: 636, h: 574, nodeScale: 0.45, labelScale: 0.8, zmax: 2.5, terrR: 80, terrBand: 48 },
  // 캠페인 5장 — 국내에서 송화강 가 부여까지 (daemusin-geo.ts). 경도 2.4° × 위도 3.3° 를 조각 눈금 그대로 (세로로 긴 판)
  daemusin: { dir: 'map-world', ext: 'webp', w: 847, h: 1262, nodeScale: 0.42, labelScale: 0.75, zmax: 4, terrR: 60, terrBand: 34 },
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
  chief: 'g-94-golpo-maenun', // 살해 매눈 — 골포국의 활 쏘는 장군 · 주몽(g-64)과 판박이던 g-02 를 걷음 (형 11-03)
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
  'wander-13': 'w-14-feast-spy', 'wander-14': 'g-60-eupcha-hangyeol', 'wander-15': 'w-98-byeonhan-danbi',
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
  // 캠페인 4장 — 수로 · 허황옥(전설 명치판) · 가락의 장수 · 아홉 간 · 탈해 (gujibong.ts). 있는 명치판을 나눠 쓴다 · 새 얼굴은 ART-QUEUE 「4·5장 초상」
  'gj-suro': 'g-96-garak-suro', 'gj-heo': 'l-L3-heo-hwangok', 'gj-musoe': 'g-11-gaya-iron-general', 'gj-dana': 'w-04-gaya-swordswoman',
  'gj-adogan': 'g-101-garak-adogan', 'gj-yeodogan': 'g-102-garak-yeodogan', 'gj-pidogan': 'g-103-garak-pidogan', 'gj-odogan': 'g-104-garak-odogan',
  'gj-yusugan': 'g-105-garak-yusugan', 'gj-yucheongan': 'w-99-garak-yucheongan', 'gj-sincheongan': 'w-100-garak-sincheongan', 'gj-ocheongan': 'g-106-garak-ocheongan',
  'gj-singwigan': 'w-101-garak-singwigan', 'gj-tahae': 'g-97-tahae', 'gj-tahae-1': 'w-10-pirate-captain',
  // 캠페인 5장 — 대무신왕 · 괴유 · 마로 · 미르 / 대소(2장과 같은 얼굴) · 부여 장수 (daemusin.ts). 있는 명치판을 나눠 쓴다
  'dm-daemusin': 'g-95-goguryeo-daemusin', 'dm-gwaeyu': 'g-98-goguryeo-gwaeyu', 'dm-maro': 'g-99-goguryeo-maro', 'dm-mir': 'w-97-goguryeo-mir',
  'dm-daeso': 'g-100-buyeo-old-daeso', 'dm-buyeo-1': 'g-10-buyeo-horse-lord', 'dm-buyeo-2': 'w-06-buyeo-huntress',
  'tut-onjo': 'g-71-baekje-onjo', 'tut-biryu': 'g-28-goguryeo-damul', 'tut-ogan': 'g-13-baekje-general', 'tut-malgalgi': 'w-77-sabeol-malgalgi', 'tut-maryeo': 'g-89-baekje-maryeo', 'tut-haebi': 'w-95-michuhol-haebi',
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

/**
 * 자란 아이의 갈래 — 부모에게서 물려받은 특성이 얼굴이 된다 (형 10-29: "자식 영웅들 성체 캐릭터 설정이랑 이미지도 더").
 * 명궁의 아이는 활을 든 얼굴, 대장장이 집 아이는 그을린 얼굴. 설정은 docs/realm/cast/kids.md · 그림 줄은 ART-QUEUE 「자란 아이 얼굴」.
 * 새 얼굴을 받으면 그 갈래 칸에 이름만 넣는다 (파일이 없으면 tests/realm/kid-bust.test.ts 가 막는다).
 */
export type KidLine = 'archer' | 'smith' | 'shaman' | 'river' | 'mountain' | 'village' | 'charm' | 'warrior'
export const KID_LINE: Readonly<Record<KidLine, Readonly<Record<'g' | 'w', readonly string[]>>>> = {
  archer: { g: ['y-g-10', 'y-g-01'], w: ['y-w-02', 'y-w-10'] }, // 사냥꾼 궁수
  smith: { g: ['y-g-04', 'y-g-11'], w: ['y-w-11'] }, // 대장장이 집 아이
  shaman: { g: ['y-g-09', 'y-g-12'], w: ['y-w-09', 'y-w-12'] }, // 무당 핏줄
  river: { g: ['y-g-05', 'y-g-13'], w: ['y-w-05', 'y-w-13'] }, // 물가·바다
  mountain: { g: ['y-g-07', 'y-g-14'], w: ['y-w-07', 'y-w-14'] }, // 산사람
  village: { g: ['y-g-15'], w: ['y-w-01', 'y-w-03', 'y-w-15'] }, // 마을·장터
  charm: { g: ['y-g-06', 'y-g-02', 'y-g-16'], w: ['y-w-06', 'y-w-16'] }, // 귀한 집 미남·미녀
  warrior: { g: ['y-g-03', 'y-g-17'], w: ['y-w-04', 'y-w-17'] }, // 반듯한 젊은 무장
}
/** 특성 → 갈래 (아이의 특성 가운데 앞에서부터 처음 걸리는 것) */
export const LINE_OF_TRAIT: Readonly<Record<string, KidLine>> = {
  archer: 'archer', nighteye: 'archer', smith: 'smith', ironhand: 'smith', shaman: 'shaman', river: 'river', mountain: 'mountain',
  farmer: 'village', trader: 'village', charm: 'charm', steadfast: 'warrior', hundred: 'warrior', careful: 'warrior',
}
const OLD_KID: Readonly<Record<'g' | 'w', readonly string[]>> = {
  g: ['y-g-01', 'y-g-02', 'y-g-03', 'y-g-04', 'y-g-05', 'y-g-06', 'y-g-07', 'y-g-09'],
  w: ['y-w-01', 'y-w-02', 'y-w-03', 'y-w-04', 'y-w-05', 'y-w-06', 'y-w-07', 'y-w-09'],
}
const kidPool = (look: 'g' | 'w'): string[] => [...new Set([...OLD_KID[look], ...Object.values(KID_LINE).flatMap((l) => l[look])])]
/** 혼인에서 난 아이가 다 자란 얼굴 — 갈래가 없으면 이 묶음 전부에서 (어려 보이는 둘은 뺐다 — 형 10-24) */
export const KID_BUST: Readonly<Record<'g' | 'w', readonly string[]>> = { g: kidPool('g'), w: kidPool('w') }
/** 자라는 동안의 얼굴 — 장수로 쓰기엔 어려 보이는 명치판 (형 10-24: "아이 이미지가 너무 어린아이 · 성장 중으로 · 자라면 본래 모습으로 교체") */
export const GROW_BUST: Readonly<Record<'g' | 'w', readonly string[]>> = { g: ['y-g-08'], w: ['y-w-08'] }

/** 아이의 갈래 — 특성 가운데 그 성별 얼굴이 있는 첫 갈래 */
export function kidLine(look: 'g' | 'w', traits: readonly string[] = []): KidLine | undefined {
  for (const t of traits) {
    const l = LINE_OF_TRAIT[t]
    if (l !== undefined && KID_LINE[l][look].length > 0) return l
  }
  return undefined
}

export function kidBust(id: string, look: 'g' | 'w', traits: readonly string[] = []): string | undefined {
  const line = kidLine(look, traits)
  const pool = line !== undefined ? KID_LINE[line][look] : KID_BUST[look]
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
/** 다 자란 아이(부모가 있는 장수)와 가문의 아이(clan-)의 얼굴을 적어 둔다 — 특성으로 갈래를 고른다 */
export function noteKids(heroes: Iterable<{ readonly id: string; readonly look: 'g' | 'w'; readonly parents?: unknown; readonly traits?: readonly string[] }>): void {
  for (const h of heroes) {
    const clan = h.id.startsWith('clan-')
    if ((h.parents === undefined && !clan) || (kidFace.has(h.id) && !childFace.has(h.id))) continue
    childFace.delete(h.id)
    const f = clan ? clanFace(h.id, h.traits) : kidBust(h.id, h.look, h.traits)
    if (f !== undefined) kidFace.set(h.id, f)
  }
}

/** 장수 id → 명치판 이름 (아이도) · 다음 판에 데려온 가문의 아이(`clan-<생김>-<시드>-<판의 id>`)는 난 판의 얼굴 그대로 (특성은 noteKids 로 적어 둔다) */
export const bustOf = (id: string): string | undefined => HERO_BUST[id] ?? kidFace.get(id) ?? clanFace(id)
function clanFace(id: string, traits?: readonly string[]): string | undefined {
  if (!id.startsWith('clan-')) return undefined
  const [, look, , ...rest] = id.split('-')
  return look === 'g' || look === 'w' ? kidBust(rest.join('-'), look, traits) : undefined
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
  if (f == null || FACTION_ART[f] === undefined) return undefined
  return `nflag-${NFLAG_SAME[f] ?? f}`
}
/**
 * 깃발을 빌려 쓰는 나라 — 같은 판에 서지 않는 옛 나라의 깃발을 그대로 (빛도 그 깃발에 맞췄다).
 * 가락 = 금관가야(구야) · 아홉 간과 탈해는 같은 문양의 나라에서 (형 11-02: "나라깃발을 왜 기존껄 안 씀" · 마을마다 깨진 그림이 떴다).
 * 깃발 파일이 없는 나라는 tests/realm/nflag-art.test.ts 가 잡는다
 */
const NFLAG_SAME: Readonly<Record<string, string>> = {
  garak: 'guya', 'gj-ado': 'hwanna', 'gj-yeodo': 'miri', 'gj-pido': 'sr-goya', 'gj-odo': 'geonma', 'gj-yusu': 'siljik',
  'gj-yucheon': 'wansan', 'gj-sincheon': 'byeokjin', 'gj-ocheon': 'gosaburi', 'gj-singwi': 'us', tahae: 'sr-wae',
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
  // 4장 가락 · 아홉 간 · 탈해 (gujibong.ts) — 가락은 쌍어(김해) · 맏이 아도간은 거북(구지가)
  garak: { emblem: 'emblem-twinfish', color: '#e0b64a', color2: '#b0202a' },
  // 아홉 간·탈해는 같은 문양의 옛 나라 깃발을 빌려 쓴다 — 빛도 그 깃발 그대로 (형 11-02: "나라깃발을 왜 기존껄 안 씀") · NFLAG_SAME
  'gj-ado': { emblem: 'emblem-tortoise', color: '#3a7a6a', color2: '#1f3f8f' }, 'gj-yeodo': { emblem: 'emblem-grain', color: '#6fa8dc', color2: '#f08ab0' },
  'gj-pido': { emblem: 'emblem-mountain', color: '#8a6ab0', color2: '#b8e04a' }, 'gj-odo': { emblem: 'emblem-plough', color: '#b8784a', color2: '#b8e04a' },
  'gj-yusu': { emblem: 'emblem-fish', color: '#5aa0b8', color2: '#b8e04a' }, 'gj-yucheon': { emblem: 'emblem-ginkgo', color: '#7a9a4a', color2: '#f6f1e4' },
  'gj-sincheon': { emblem: 'emblem-stars', color: '#c08bb0', color2: '#2f8a3a' }, 'gj-ocheon': { emblem: 'emblem-egret', color: '#a6a05a', color2: '#b0202a' },
  'gj-singwi': { emblem: 'emblem-shell', color: '#9fd18b', color2: '#6a2a7a' }, tahae: { emblem: 'emblem-wave', color: '#5a5f6a', color2: '#b8e04a' },
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
  sodo: 'settle-sodo-grove',
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
  'm-sodo': 'settle-sodo-grove',
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
  chaekhwa: 'good-ox', maljangrye: 'settle-tumuli',
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

/** 병사 동작 그림(public/realm/anim/<병종>.png · 8컷 띠) 한 칸의 가로세로 비 — tools/strip-frames.mjs 가 찍어 준다. 싸움터와 지도 유닛이 같이 쓴다 */
/**
 * 병사 동작 그림 둘째 판(public/realm/anim2/<병종>.png · 20컷: 서기 4 · 걷기 8 · 공격 6 · 움찔 · 쓰러짐) 한 칸의 가로세로 비 — tools/anim-pack.py 가 찍어 준다.
 * 있는 병종만 새 띠로 그린다 (없으면 옛 8컷 띠). 칸이 넓다 — 창이 다 뻗어도 들어가게 (형 10-29)
 */
export const SOL_ANIM2: Readonly<Record<string, number>> = { militia: 168 / 160, spear: 548 / 160, bow: 629 / 160, shield: 317 / 160, pike: 475 / 160, axe: 208 / 160, marine: 372 / 160, horse: 232 / 160, boat: 336 / 160, crossbow: 768 / 160 }
/** 지도 길 위의 이주민 — 지게 진 사람 걷기 8컷 띠 (제미나이 11-03 · assets_src/realm/gemini/migrant · tools/strip-frames.mjs 4x2) · 칸 가로/세로 */
export const MIGRANT_ANIM = { file: 'anim2/migrant.png', nf: 8, ar: 102 / 160 } as const
/** 마을 안 사람 — 걷기 8컷 띠 셋 (광주리 인 아낙 · 괭이 멘 농부 · 물동이 진 아낙 · 제미나이 11-08 · assets_src/realm/gemini/villager · 개척단 띠를 빌리지 않는다 · 형 11-08) */
export const VILLAGER_ANIM = [
  { file: 'anim2/villager-woman.png', nf: 8, ar: 79 / 160 },
  { file: 'anim2/villager-farmer.png', nf: 8, ar: 125 / 160 },
  { file: 'anim2/villager-porter.png', nf: 8, ar: 135 / 160 },
] as const
export const SOL_ANIM_AR: Readonly<Record<string, number>> = { militia: 168 / 160, spear: 167 / 160, shield: 165 / 160, bow: 139 / 160, horse: 157 / 160, boat: 164 / 160, crossbow: 152 / 160, pike: 162 / 160, axe: 144 / 160, marine: 155 / 160 }

/**
 * 장수 동작 그림(public/realm/anim2/gen-<결>.png · 20컷, 병사 v2 띠와 같은 차례: 서기 4 · 걷기 8 · 공격 6 · 움찔 · 쓰러짐) — tools/general-pack.py 가 찍어 준다.
 * ar = 한 칸의 가로세로 비 · body = 서 있는 몸의 키 / 띠 높이 (칼을 치켜든 컷이 더 높으면 1 보다 작다). 형 10-30: "전투할 때 장수 유닛도 추가해 줘"
 * 결 여섯은 장수마다 그리기 전의 원형이다 — 이름난 장수의 제 그림은 docs/realm/GENERAL-SPRITES.md 의 차례대로 GEN_OWN 에 더한다.
 */
export type GenSprite = 'g-sword' | 'g-bow' | 'g-spear' | 'w-spear' | 'w-bow' | 'mount'
export const GEN_ANIM: Readonly<Partial<Record<string, { ar: number; body: number; bow?: true; mount?: true }>>> = {
  'g-sword': { ar: 150 / 160, body: 0.948 }, // 11-03 걷기가 한 자세라 20컷 통째로 다시 (제미나이 4 Argon · tools/assemble-gen20.mjs)
  'g-bow': { ar: 149 / 160, body: 0.948, bow: true }, // 11-03 20컷 다시 (걷기가 한 자세였다)
  'g-spear': { ar: 189 / 160, body: 0.914 }, // 11-03 20컷 다시 (걷기가 한 자세였다)
  'w-spear': { ar: 180 / 160, body: 0.934 }, // 11-04 우하단 두 컷(걷기 8 · 쓰러짐)을 별표 없는 장으로 갈아 끼움
  'w-bow': { ar: 140 / 160, body: 0.968 }, // 11-04 우하단 두 컷(걷기 8 · 쓰러짐)을 별표 없는 장으로 갈아 끼움
  mount: { ar: 246 / 160, body: 0.968, mount: true },
  // 제 그림 (GEN_OWN) — 글 주문만으로 받은 장수 (docs/realm/GENERAL-SPRITES.md)
  jumong: { ar: 140 / 160, body: 0.900, bow: true }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2)
  onjo: { ar: 157 / 160, body: 0.900 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2)
  soseono: { ar: 156 / 160, body: 0.900 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 전투 옷은 더 드러나게 (형 11-08)
  aryeong: { ar: 157 / 160, body: 0.900 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 전투 옷은 더 드러나게 (형 11-08)
  haedal: { ar: 149 / 160, body: 0.900, bow: true }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 전투 옷은 더 드러나게 (형 11-08)
  songbi: { ar: 150 / 160, body: 0.900, bow: true }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 전투 옷은 더 드러나게 (형 11-08)
  hyeokgeose: { ar: 153 / 160, body: 0.906 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2)
  oi: { ar: 159 / 160, body: 0.961 }, // 11-04 제 띠 (u/0 · 깃털 다발 쇠투구·붉은 테 미늘·짧은 수염 · 창)
  mari: { ar: 161 / 160, body: 0.968 }, // 11-04 제 띠 (u/0 · 상투·머리띠·콧등 칼자국·밧줄 타래·푸른 삼베 · 맞음 컷은 창을 둘 쥐고 나와 막기 컷으로 · 찌르기 창끝이 조금 잘림)
  daeso: { ar: 172 / 160, body: 0.900 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2)
  eureum: { ar: 147 / 160, body: 0.907 }, // 11-04 제 띠 (u/0 · 마젠타 바탕 · 검은 관·염소수염·녹색 두루마기·가죽 갑옷·대쪽 두루마리 · 막기 컷은 칼이 휘어 빼고 · 내려베기 칼끝이 살짝 휨)
  ogan: { ar: 162 / 160, body: 0.907, bow: true }, // 11-04 제 띠 (u/0 · 높은 상투·턱수염·쇠 미늘·남색 옷·맥궁 · 첫 장은 병사 베옷을 베끼고 글자 꼬리표 → 「모든 컷 같은 옷」을 못 박아 새 대화로)
  damul: { ar: 147 / 160, body: 0.906, bow: true }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2)
  songyang: { ar: 143 / 160, body: 0.950, bow: true }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2)
  maenun: { ar: 146 / 160, body: 0.955, bow: true }, // 11-04 제 띠 (u/0 · 꿩깃 검은 두건·붉은 두루마기·가죽 미늘·맥궁 · 골포국 살해 매눈)
  hyeopbo: { ar: 163 / 160, body: 0.887 }, // 11-04 제 띠 (u/0 · 검은 머리띠 상투·가는 콧수염·무늬 검은 도포·가죽 갑옷 · 곧은 고리자루 칼 — 첫 판은 휜 칼이라 버림)
  malgalgi: { ar: 165 / 160, body: 0.906 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 전투 옷은 더 드러나게 (형 11-08)
  haebi: { ar: 152 / 160, body: 0.906 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 전투 옷은 더 드러나게 (형 11-08)
  soebi: { ar: 156 / 160, body: 0.906 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 쇠 덩이 묶음 대신 큰 쇠망치
  ara: { ar: 157 / 160, body: 0.906 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2)
  heo: { ar: 145 / 160, body: 0.900 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 갑옷 대신 보석 윗옷·트임 치마 (형: 전투 옷은 더 드러나게)
  gamsil: { ar: 157 / 160, body: 0.906 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 어깨 내린 주황 겉옷·짧은 치마 (형: 전투 옷은 더 드러나게)
  irang: { ar: 164 / 160, body: 0.900 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 문신 팔·구슬 목걸이·가죽 조끼 · 청동 단검 찌르기
  gureum: { ar: 162 / 160, body: 0.900 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 흰 삼베 짧은 윗옷·트임 치마 (형: 전투 옷은 더 드러나게)
  biryu: { ar: 168 / 160, body: 0.963, mount: true }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 말 탄 장수 · 상투·붉은 민소매·큰 망치 내려치기
  geumha: { ar: 175 / 160, body: 0.844, mount: true }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 말 탄 장수 · 흰 털 금테 관·땋은 수염·털 망토·말머리 지팡이 내려치기
  geota: { ar: 183 / 160, body: 0.856, mount: true }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 말 탄 장수 · 상투·높은 목가리개 쇠 미늘·곧은 고리자루 칼 베기
  soebo: { ar: 186 / 160, body: 0.831, mount: true }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 말 탄 장수 · 뾰족 금관 띠·숯 묻은 얼굴·가죽 앞치마·큰 쇠망치 내려치기
  sori: { ar: 280 / 160, body: 0.9375 }, // normal portrait, right-hand dagger, shared four-pose walk
  sogeumbi: { ar: 280 / 160, body: 0.9375 }, // same-hand short downcut, shared four-pose walk
  budeul: { ar: 280 / 160, body: 0.9375 }, // 11-07 original Budeul upper body/knife + shared 4-pose trousers
  gaennae: { ar: 264 / 160, body: 0.9375 }, // 11-07 원초상 기준 · 하체 4실자세/고정 상체 · 공격 뒤발 고정 · 20칸
  beombal: { ar: 280 / 160, body: 0.9375 }, // 11-08 범발 · Codex 정규화 셀(대기·갯내 4실보행 하체·준비/찌르기/피격) + 아틀라스 우하단 쓰러짐 · 뺨 줄무늬는 오른쪽을 보는 몸의 왼뺨(원초상과 같은 쪽)
  hwalmi: { ar: 280 / 160, body: 0.9375, bow: true }, // 11-08 혜미(옛 활미) · 제미나이 u/0 2×2 활 동작(준비·만작·발사) + 피격 + 새 대화 쓰러짐 · 갯내 4실보행 하체 · 교정 초상(점 없음) 기준
  dangung: { ar: 280 / 160, body: 0.9375, bow: true }, // 11-08 단궁 · 제미나이 u/0 2×2(준비·만작·발사·피격 · 칸 선은 지움) + 새 대화 쓰러짐 · 갯내 4실보행 하체(바지는 짙게) · 걷는 동안 긴 두루마기가 무릎 위로 짧아진다
  dalli: { ar: 146 / 160, body: 0.881, bow: true }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 흰 깃털 머리·잿빛 늑대 털 조끼·짧은 가죽 치마·맥궁
  bakdal: { ar: 155 / 160, body: 0.894, bow: true }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 범 가죽 짧은 망토·황토 짧은 윗옷·뼈 구슬 목걸이·큰 맥궁
  noeul: { ar: 153 / 160, body: 0.881, bow: true }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 땋은 머리·주황 짧은 비단 윗옷과 치마·흰 깃 화살통·맥궁
  maehwa: { ar: 143 / 160, body: 0.894, bow: true }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 깃 머리띠·짙은 붉은 짧은 저고리·꿩깃 화살통·맥궁
  gaon: { ar: 151 / 160, body: 0.894 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 흰 털모자·흰 털 짧은 겉옷·흰 술 창 찌르기
  eomni: { ar: 159 / 160, body: 0.900 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 땋은 머리·검은 곰 털 망토·짧은 흰 윗옷·이빨 목걸이·쇠 창 찌르기 · 걷기는 창을 어깨에 멘 아랫줄만
  nuri: { ar: 162 / 160, body: 0.900 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 흰 털 어깨 망토·크림빛 비단 옷·금 목걸이·창 찌르기 · 걷기는 창을 어깨에 멘 아랫줄만
  bira: { ar: 156 / 160, body: 0.900 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 푸른 깃 머리띠·푸른 짧은 조끼·밧줄 타래·조개 목걸이·작살 창 찌르기 · 걷기는 아랫줄만
  soenun: { ar: 280 / 160, body: 0.9375 }, // 11-08 쇠눈 · 제미나이 u/2 2×2(겨눔·찌르기·거둠·피격) + 새 대화 쓰러짐 · 갯내 4실보행 하체(짙은 바지 · 걷는 동안 쇠 정강이받이는 장화로 보인다) · 창 자루는 걷기에도 남긴다
  odi: { ar: 158 / 160, body: 0.900 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 조문 오디(꽃·구슬 올린 머리·흰 보라 비단 옷·누에고치 바구니·보라 술 창 · 찌르기 칸의 창 방향은 다시 구울 거리)
  haesol: { ar: 161 / 160, body: 0.900 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 우산 해솔(솔가지 꽂은 긴 머리·초록 깃 흰 짧은 옷·푸른 구슬·초록 끈 창 찌르기)
  sinneoul: { ar: 163 / 160, body: 0.906 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 신지 너울(젖은 긴 머리·묶어 입은 흰 삼베 윗옷·짧은 바지·그물 주머니·갈고리 작살 · 맨발)
  byeol: { ar: 155 / 160, body: 0.906 }, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2) · 11-08 처음 · 벽진 별(땋은 머리·흰 민소매에 가죽 대장장이 앞치마·맨발·달군 쇠칼 내려치기)
}
/** 제 그림이 있는 장수 (장수 id → gen-<이름>.png 의 이름) */
export const GEN_OWN: Readonly<Record<string, string>> = { 'gwanna-2': 'soenun', 'haseulla-ruler': 'dangung', 'goguryeo-2': 'hwalmi', 'maek-1': 'beombal', 'wander-04': 'sori', 'dongokjeo-2': 'sogeumbi', 'golbeol-2': 'budeul', 'michuhol-2': 'gaennae', 'jm-jumong': 'jumong', 'mh-onjo': 'onjo', 'tut-onjo': 'onjo', 'mh-soseono': 'soseono', 'sr-aryeong': 'aryeong', 'jm-haedal': 'haedal', 'buyeo-1': 'haedal', 'jm-songbi': 'songbi', 'biryuna-ruler': 'songbi', 'sr-hyeokgeose': 'hyeokgeose', 'jm-oi': 'oi', 'jm-mari': 'mari', 'jm-daeso': 'daeso', 'mh-eureum': 'eureum', 'mh-ogan': 'ogan', 'tut-ogan': 'ogan', 'goguryeo-ruler': 'damul', 'jm-songyang': 'songyang', chief: 'maenun', 'jm-hyeopbo': 'hyeopbo', 'tut-malgalgi': 'malgalgi', 'sabeol-1': 'malgalgi', 'tut-haebi': 'haebi', 'guya-3': 'soebi', 'anya-1': 'ara', 'gj-dana': 'ara', 'gj-heo': 'heo', 'gammun-2': 'gamsil', 'jomun-ruler': 'irang', 'goryong-ruler': 'gureum', 'tut-biryu': 'biryu', 'buyeo-ruler': 'geumha', 'guya-1': 'geota', 'guya-ruler': 'soebo', 'maga-ruler': 'dalli', 'bullae-ruler': 'bakdal', 'saro-2': 'noeul', 'wander-02': 'maehwa', 'wander-07': 'gaon', 'jeoga-1': 'eomni', 'guga-ruler': 'nuri', 'michuhol-ruler': 'bira', 'jomun-2': 'odi', 'us-ruler': 'haesol', 'wander-22': 'sinneoul', 'byeokjin-ruler': 'byeol' }
type GenLook = { readonly id?: string; readonly look: 'g' | 'w'; readonly traits: readonly string[]; readonly mu: number; readonly tong: number; readonly ryak: number; readonly chi: number; readonly deok: number }
/**
 * 장수 → 싸움터에 설 그림 (순수). 제 그림이 있으면 그것 · 명궁이면 활 · 통솔이 가장 높고 비기가 날 만큼(tacArtMinStat) 높은 남자는 말 탄 장수 ·
 * 여인은 창 · 남자는 무예가 가장 높으면 언월도, 아니면 환두대도. 장수가 없으면(민병) 환두대도.
 */
export function generalSprite(h: GenLook | null | undefined, minStat = 7): string {
  if (h === null || h === undefined) return 'g-sword'
  const own = h.id !== undefined ? GEN_OWN[h.id] : undefined
  if (own !== undefined) return own
  const w = h.look === 'w'
  if (h.traits.includes('archer')) return w ? 'w-bow' : 'g-bow'
  if (w) return 'w-spear'
  const top = Math.max(h.mu, h.tong, h.ryak, h.chi, h.deok)
  if (h.tong === top && h.tong >= minStat) return 'mount'
  return h.mu === top ? 'g-spear' : 'g-sword'
}
/** 그림이 아직 없는 결은 가까운 결로 (다 구우면 그대로 돌아간다) · bow 면 공격 컷이 활 쏘기(싸움터가 spshot 박자로 돌린다) */
export function genArtOf(kind: string): { kind: string; ar: number; body: number; bow?: true; mount?: true } {
  for (const k of [kind, kind.startsWith('w-') ? 'w-spear' : 'g-sword', 'g-sword']) {
    const a = GEN_ANIM[k]
    if (a !== undefined) return { kind: k, ...a }
  }
  return { kind: 'g-sword', ar: 1, body: 1 }
}

/** 계절 → 아이콘 */
export const SEASON_ICON = { spring: 'status-spring', summer: 'status-summer', autumn: 'status-autumn', winter: 'status-winter' } as const
