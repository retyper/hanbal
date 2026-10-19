/**
 * 삼한 남부 판 — 넓어지는 지도의 첫 판 (형: "부분부분 만든걸 합쳐가지고 시간지나서 발견국가가 많아지면 확장하는거지 지도도" — 2026-10-19)
 *
 * 땅: 조각 넷(영남 · 마한 · M2 충청·경기 · M3 경북 북부·강원 남부)을 이어 붙인 지도 (south-geo.ts · docs/realm/WORLD-MAP.md).
 * 나라: 영남 판의 스물하나(regions/yeongnam.ts 그대로) + 마한·한강·동해 북쪽의 열다섯.
 * **이름은 우리 역사책이 먼저다** (WORLD §5 규칙 6) — 근거는 data/nations-south.ts 의 source 줄:
 *   백제(위례) · 미추홀 — 『삼국사기』 백제본기 (온조 · 비류)
 *   실직 — 『삼국사기』 신라본기 파사이사금 · 맥국(춘천) — 『삼국사기』 지리지 "삭주는 본래 맥국" · 하슬라(강릉) — 지리지 "명주는 본래 하서량(하슬라)", 동예의 남쪽 읍락
 *   마한의 나라 이름은 우리 책에 거의 안 남았다 — 그 자리는 『삼국사기』 지리지의 "본래 백제 ○○" 고을 이름으로 부르고 [설] 을 단다
 *     (웅천 · 상당 · 완산 · 고사부리 · 발라 · 무진 · 감평 · 고룡), 우리 책에 없는 이름만 위서 마한 54국에서 [위서] 로 (목지국 · 건마국)
 * 발견: 나라마다 제 땅과 이웃만 알고 시작한다 (Realm.known — discovery.ts).
 * 집·품·군사 수는 영남 판처럼 옛 눈금으로 적고 PEOPLE_SCALE 배로 연다.
 */
import { initialKnown } from '../../discovery.ts'
import { PEOPLE_SCALE } from '../../migrate.ts'
import type { Army, Faction, Hero, Mind, NodeIntel, REdge, Realm, RegionId, RNode, Stock, Watch } from '../../types.ts'
import { GEO as YEONGNAM_GEO, YEONGNAM_DATA } from './yeongnam.ts'

/** 새 고을의 실제 자리 [경도, 위도] — 영남 판 고을은 yeongnam.ts 의 GEO 를 쓴다 */
export const SOUTH_GEO: Readonly<Record<string, readonly [number, number]>> = {}
const geo = SOUTH_GEO as Record<string, readonly [number, number]>

const node = (id: string, name: string, kind: RNode['kind'], tags: RNode['tags'], owner: string | null, hh: number, ll: readonly [number, number]): RNode => {
  geo[id] = ll
  return { id, name, kind, tags, owner, hh: hh * PEOPLE_SCALE, sown: hh * PEOPLE_SCALE }
}
const wild = (id: string, name: string, tags: RNode['tags'], room: number, ll: readonly [number, number]): RNode => {
  geo[id] = ll
  return { id, name, kind: 'wild', tags, owner: null, hh: 0, sown: 0, room: room * PEOPLE_SCALE }
}

const NEW_NODES: RNode[] = [
  // ── 한강
  node('m-baekje-cap', '위례 도읍', 'capital', ['palisade'], 'baekje', 450, [127.12, 37.53]), // 하남 위례성 [설] — 『삼국사기』 백제본기 온조
  node('m-baekje-v', '한강 나루 마을', 'village', ['shallows'], 'baekje', 200, [126.92, 37.58]),
  node('m-michuhol-cap', '미추홀 도읍', 'port', [], 'michuhol', 300, [126.68, 37.45]), // 인천 — 백제본기 비류
  node('n-maek-cap', '맥 도읍', 'capital', ['high'], 'maek', 300, [127.73, 37.88]), // 춘천 — 지리지 "삭주는 본래 맥국"
  // ── 경기 남부 · 충청 (마한 북부)
  node('m-mokji-cap', '목지 도읍', 'capital', ['palisade'], 'mokji', 550, [127.17, 36.9]), // 천안 직산 [설] — 위서 목지국, 진왕의 자리
  node('m-mokji-v', '아산만 포구', 'port', [], 'mokji', 200, [126.95, 36.9]),
  node('m-ungcheon-cap', '웅천 도읍', 'capital', ['high'], 'ungcheon', 350, [127.12, 36.46]), // 공주 — 지리지 "본래 백제 웅천"
  node('m-sangdang-cap', '상당 도읍', 'capital', [], 'sangdang', 350, [127.49, 36.64]), // 청주 — 지리지 "본래 백제 상당"
  node('m-sangdang-iron', '국원 철광', 'ironMine', ['iron'], 'sangdang', 120, [127.93, 36.97]), // 충주 — 철이 난다
  node('m-sodo', '마한 소도', 'sodo', ['sodo'], null, 0, [127.05, 36.18]), // 위서 한조: 마한의 소도
  // ── 전라 (마한 남부)
  node('m-geonma-cap', '건마 도읍', 'capital', ['palisade'], 'geonma', 450, [126.96, 35.95]), // 익산 [설] — 위서 건마국 · 지리지 "금마저"
  node('m-geonma-port', '군산 포구', 'port', [], 'geonma', 150, [126.74, 35.97]),
  node('m-wansan-cap', '완산 도읍', 'capital', [], 'wansan', 400, [127.15, 35.82]), // 전주 — 지리지 "본래 백제 완산"
  node('m-gosaburi-cap', '고사부리 도읍', 'capital', [], 'gosaburi', 300, [126.84, 35.62]), // 정읍 고부 — 지리지 "본래 백제 고사부리"
  node('m-balla-cap', '발라 도읍', 'capital', ['palisade'], 'balla', 450, [126.72, 35.02]), // 나주 — 지리지 "본래 백제 발라" (영산강 큰 무덤의 고장)
  node('m-balla-port', '목포 포구', 'port', [], 'balla', 150, [126.47, 34.8]),
  node('m-mujin-cap', '무진 도읍', 'capital', ['high'], 'mujin', 350, [126.92, 35.16]), // 광주 — 지리지 "본래 백제 무진주"
  node('m-gampyeong-cap', '감평 도읍', 'capital', [], 'gampyeong', 300, [127.48, 34.98]), // 순천 — 지리지 "본래 백제 감평"
  node('m-gampyeong-port', '여수 포구', 'port', [], 'gampyeong', 120, [127.66, 34.97]),
  node('m-goryong-cap', '고룡 도읍', 'capital', ['high'], 'goryong', 300, [127.39, 35.41]), // 남원 — 지리지 "본래 백제 고룡"
  // ── 동해 북쪽
  node('n-siljik-cap', '실직 도읍', 'capital', ['palisade'], 'siljik', 300, [129.14, 37.44]), // 삼척 — 신라본기 파사이사금
  node('n-haseulla-cap', '하슬라 읍락', 'capital', [], 'haseulla', 300, [128.88, 37.75]), // 강릉 — 지리지 "하서량(하슬라)", 동예의 남쪽 읍락
  // ── 빈땅
  wild('w-byeokgol', '벽골 들', [], 300, [126.88, 35.8]), // 김제 벽골제
  wild('w-jinan', '진안 고원', ['high', 'pines'], 200, [127.42, 35.79]),
  wild('w-haenam', '해남 끝', [], 180, [126.6, 34.62]),
  wild('w-yeonggwang', '영광 갯가', [], 180, [126.5, 35.28]),
  wild('w-seosan', '서산 갯가', [], 200, [126.45, 36.78]),
  wild('w-hongseong', '홍성 들', [], 200, [126.66, 36.6]),
  wild('w-wonju', '평원 들', [], 200, [127.92, 37.34]),
  wild('w-pyeongchang', '평창 고원', ['pasture', 'high'], 200, [128.39, 37.37]),
  wild('w-uljin', '울진 갯가', [], 150, [129.33, 36.99]),
  wild('w-yeongju', '영주 들', [], 200, [128.62, 36.82]),
]

const e = (id: string, a: string, b: string, kind: REdge['kind'], tags: REdge['tags'] = []): REdge => ({ id, a, b, kind, tags })

/** 새 길 — 금강·영산강·섬진강은 나루로, 노령·차령·소백은 고갯길, 서해·남해는 뱃길 */
const NEW_EDGES: REdge[] = [
  // 한강
  e('s01', 'm-baekje-cap', 'm-baekje-v', 'field'),
  e('s02', 'm-baekje-v', 'm-michuhol-cap', 'field'),
  e('s03', 'm-baekje-cap', 'm-mokji-cap', 'field'),
  e('s04', 'm-michuhol-cap', 'm-mokji-v', 'sea'),
  e('s37', 'n-maek-cap', 'm-baekje-cap', 'ford'), // 북한강
  // 마한 북부
  e('s05', 'm-mokji-cap', 'm-mokji-v', 'field'),
  e('s06', 'm-mokji-cap', 'm-ungcheon-cap', 'field'),
  e('s07', 'm-mokji-cap', 'm-sangdang-cap', 'field'),
  e('s08', 'm-ungcheon-cap', 'm-sangdang-cap', 'field'),
  e('s09', 'm-ungcheon-cap', 'm-sodo', 'forest'),
  e('s10', 'm-sodo', 'm-geonma-cap', 'field'),
  e('s11', 'm-ungcheon-cap', 'm-geonma-cap', 'ford'), // 금강
  e('s32', 'm-sangdang-cap', 'm-sangdang-iron', 'field'),
  e('s50', 'w-seosan', 'm-mokji-v', 'field'),
  e('s51', 'w-hongseong', 'w-seosan', 'field'),
  e('s52', 'w-hongseong', 'm-ungcheon-cap', 'pass'), // 차령
  e('s53', 'w-hongseong', 'm-mokji-cap', 'field'),
  // 마한 남부
  e('s12', 'm-geonma-cap', 'm-geonma-port', 'field'),
  e('s13', 'm-geonma-cap', 'w-byeokgol', 'field'),
  e('s14', 'w-byeokgol', 'm-gosaburi-cap', 'field'),
  e('s15', 'm-geonma-cap', 'm-wansan-cap', 'field'),
  e('s16', 'm-wansan-cap', 'w-byeokgol', 'field'),
  e('s17', 'm-wansan-cap', 'w-jinan', 'pass'),
  e('s18', 'w-jinan', 'm-goryong-cap', 'pass'),
  e('s19', 'm-wansan-cap', 'm-gosaburi-cap', 'field'),
  e('s20', 'm-gosaburi-cap', 'w-yeonggwang', 'field'),
  e('s21', 'm-gosaburi-cap', 'm-mujin-cap', 'pass'), // 노령
  e('s22', 'w-yeonggwang', 'm-balla-cap', 'field'),
  e('s23', 'm-balla-cap', 'm-mujin-cap', 'ford'), // 영산강
  e('s24', 'm-balla-cap', 'm-balla-port', 'field'),
  e('s25', 'm-balla-port', 'w-haenam', 'field'),
  e('s26', 'm-mujin-cap', 'm-gampyeong-cap', 'pass'),
  e('s27', 'm-goryong-cap', 'm-gampyeong-cap', 'forest'), // 섬진강 골짜기
  e('s28', 'm-gampyeong-cap', 'm-gampyeong-port', 'field'),
  // 서해·남해 뱃길
  e('s46', 'm-geonma-port', 'm-mokji-v', 'sea'),
  e('s47', 'm-geonma-port', 'm-balla-port', 'sea'),
  e('s48', 'm-balla-port', 'm-gampyeong-port', 'sea'),
  e('s29', 'm-gampyeong-port', 'y-w-namhae', 'sea'),
  // 영남과 잇는 고개·물길
  e('s30', 'm-gampyeong-cap', 'y-samul-cap', 'ford'), // 섬진강 하구 (하동)
  e('s31', 'm-goryong-cap', 'y-w-sancheong', 'pass'), // 팔량치
  e('s33', 'm-sangdang-cap', 'y-gammun-cap', 'pass'), // 추풍령
  e('s34', 'm-sangdang-iron', 'y-sabeol-cap', 'pass'), // 새재
  e('s44', 'w-yeongju', 'm-sangdang-iron', 'pass'), // 죽령
  e('s43', 'w-yeongju', 'y-jomun-cap', 'field'),
  // 한강 윗줄기 · 동해 북쪽
  e('s35', 'm-sangdang-iron', 'w-wonju', 'field'),
  e('s36', 'w-wonju', 'n-maek-cap', 'field'),
  e('s38', 'w-wonju', 'w-pyeongchang', 'pass'),
  e('s39', 'w-pyeongchang', 'n-haseulla-cap', 'pass'), // 대관령
  e('s40', 'n-haseulla-cap', 'n-siljik-cap', 'field'),
  e('s41', 'n-siljik-cap', 'w-uljin', 'field'),
  e('s42', 'w-uljin', 'y-w-yeongdeok', 'field'),
  e('s45', 'w-uljin', 'w-yeongju', 'pass'), // 태백 넘는 길
]

export interface NationStart {
  readonly faction: Omit<Faction, 'mind'>
  readonly mind: Exclude<Mind, 'player'>
  readonly stock: Stock
}
const st = (grain: number, iron: number, more: Partial<Stock> = {}): Stock => ({ grain, iron, ...more })

const NEW_STARTS: readonly NationStart[] = [
  { faction: { id: 'baekje', name: '백제', capital: 'm-baekje-cap', equip: 'ironTip' }, mind: 'greedy', stock: st(280, 10, { wood: 30 }) },
  { faction: { id: 'mokji', name: '목지국', capital: 'm-mokji-cap', equip: 'ironTip' }, mind: 'cautious', stock: st(320, 10, { salt: 15, wood: 30 }) },
  { faction: { id: 'michuhol', name: '미추홀', capital: 'm-michuhol-cap', equip: 'bronze' }, mind: 'greedy', stock: st(200, 5, { salt: 20, wood: 20 }) },
  { faction: { id: 'ungcheon', name: '웅천국', capital: 'm-ungcheon-cap', equip: 'bronze' }, mind: 'cautious', stock: st(220, 5, { wood: 35 }) },
  { faction: { id: 'sangdang', name: '상당국', capital: 'm-sangdang-cap', equip: 'ironTip' }, mind: 'greedy', stock: st(220, 25, { wood: 30 }) },
  { faction: { id: 'geonma', name: '건마국', capital: 'm-geonma-cap', equip: 'bronze' }, mind: 'cautious', stock: st(300, 5, { salt: 15, wood: 25 }) },
  { faction: { id: 'wansan', name: '완산국', capital: 'm-wansan-cap', equip: 'bronze' }, mind: 'greedy', stock: st(260, 5, { wood: 30 }) },
  { faction: { id: 'gosaburi', name: '고사부리국', capital: 'm-gosaburi-cap', equip: 'bronze' }, mind: 'cautious', stock: st(220, 0, { wood: 25 }) },
  { faction: { id: 'balla', name: '발라국', capital: 'm-balla-cap', equip: 'bronze' }, mind: 'greedy', stock: st(300, 5, { salt: 15, wood: 25 }) },
  { faction: { id: 'mujin', name: '무진국', capital: 'm-mujin-cap', equip: 'bronze' }, mind: 'cautious', stock: st(240, 0, { wood: 35 }) },
  { faction: { id: 'gampyeong', name: '감평국', capital: 'm-gampyeong-cap', equip: 'bronze' }, mind: 'greedy', stock: st(200, 5, { salt: 15, wood: 30 }) },
  { faction: { id: 'goryong', name: '고룡국', capital: 'm-goryong-cap', equip: 'bronze' }, mind: 'cautious', stock: st(200, 0, { wood: 40 }) },
  { faction: { id: 'maek', name: '맥국', capital: 'n-maek-cap', equip: 'bronze' }, mind: 'greedy', stock: st(200, 0, { wood: 35, horse: 4 }) },
  { faction: { id: 'siljik', name: '실직국', capital: 'n-siljik-cap', equip: 'bronze' }, mind: 'cautious', stock: st(200, 5, { salt: 15, wood: 30 }) },
  { faction: { id: 'haseulla', name: '하슬라', capital: 'n-haseulla-cap', equip: 'bronze' }, mind: 'cautious', stock: st(200, 0, { salt: 10, wood: 30, horse: 6 }) },
]

const h = (
  id: string, name: string, faction: string, look: 'g' | 'w',
  [mu, tong, ryak, chi, deok, uiri]: readonly [number, number, number, number, number, number],
  traits: readonly string[], at: string | null = null,
): Hero => ({ id, name, faction, mu, tong, ryak, chi, deok, uiri, traits, look, status: 'free', captor: null, at, post: null })

/** 군주와 장군 — 이름은 지어냈다. 칭호는 위서 한조의 신지·읍차, 동예는 삼로 */
const NEW_HEROES: Hero[] = [
  h('baekje-ruler', '신지 온누리', 'baekje', 'g', [5, 7, 7, 6, 7, 8], ['careful'], 'm-baekje-cap'),
  h('mokji-ruler', '신지 진하', 'mokji', 'w', [3, 5, 7, 7, 8, 9], ['charm'], 'm-mokji-cap'),
  h('michuhol-ruler', '읍차 비라', 'michuhol', 'w', [4, 5, 6, 5, 6, 7], ['trader'], 'm-michuhol-cap'),
  h('ungcheon-ruler', '읍차 곰내', 'ungcheon', 'g', [5, 5, 5, 6, 5, 8], ['mountain'], 'm-ungcheon-cap'),
  h('sangdang-ruler', '읍차 쇠달', 'sangdang', 'g', [6, 6, 5, 5, 4, 7], ['smith'], 'm-sangdang-cap'),
  h('geonma-ruler', '신지 마루', 'geonma', 'w', [3, 5, 6, 8, 7, 8], ['farmer'], 'm-geonma-cap'),
  h('wansan-ruler', '읍차 온산', 'wansan', 'g', [6, 6, 5, 5, 4, 6], ['river'], 'm-wansan-cap'),
  h('gosaburi-ruler', '읍차 바람', 'gosaburi', 'w', [4, 4, 6, 6, 6, 7], ['careful'], 'm-gosaburi-cap'),
  h('balla-ruler', '신지 큰뫼', 'balla', 'g', [5, 6, 5, 6, 6, 8], ['shaman'], 'm-balla-cap'),
  h('mujin-ruler', '읍차 무등', 'mujin', 'w', [4, 5, 6, 6, 7, 8], ['mountain'], 'm-mujin-cap'),
  h('gampyeong-ruler', '읍차 갯벌', 'gampyeong', 'g', [5, 5, 5, 5, 5, 6], ['river'], 'm-gampyeong-cap'),
  h('goryong-ruler', '읍차 구름', 'goryong', 'w', [4, 4, 6, 5, 7, 7], ['charm'], 'm-goryong-cap'),
  h('maek-ruler', '거수 맥돌', 'maek', 'g', [7, 6, 4, 4, 4, 6], ['nighteye'], 'n-maek-cap'),
  h('siljik-ruler', '읍차 물가', 'siljik', 'w', [4, 5, 5, 6, 6, 7], ['trader'], 'n-siljik-cap'),
  h('haseulla-ruler', '삼로 단궁', 'haseulla', 'w', [6, 5, 6, 4, 6, 8], ['archer'], 'n-haseulla-cap'), // 동예 — 박달나무 활
  h('baekje-1', '견지 해루', 'baekje', 'g', [7, 6, 6, 4, 5, 7], ['careful']),
  h('mokji-1', '견지 마한', 'mokji', 'g', [6, 7, 5, 4, 4, 7], []),
  h('michuhol-1', '살해 소금꾼', 'michuhol', 'g', [5, 5, 4, 3, 4, 6], ['river']),
  h('ungcheon-1', '살해 곰', 'ungcheon', 'w', [5, 5, 5, 4, 4, 6], ['mountain']),
  h('sangdang-1', '살해 쇠망치', 'sangdang', 'g', [6, 5, 4, 3, 3, 6], ['ironhand']),
  h('geonma-1', '살해 말발굽', 'geonma', 'g', [6, 5, 4, 4, 4, 6], []),
  h('wansan-1', '살해 완', 'wansan', 'w', [5, 5, 5, 4, 5, 6], ['archer']),
  h('gosaburi-1', '살해 부리', 'gosaburi', 'g', [5, 4, 5, 4, 4, 6], []),
  h('balla-1', '살해 독무덤', 'balla', 'w', [6, 6, 5, 4, 4, 7], ['river']),
  h('mujin-1', '살해 빛고을', 'mujin', 'g', [5, 5, 5, 4, 4, 6], []),
  h('gampyeong-1', '살해 뱃사공', 'gampyeong', 'w', [5, 5, 4, 3, 4, 6], ['river']),
  h('goryong-1', '살해 용', 'goryong', 'g', [6, 5, 4, 3, 4, 6], ['mountain']),
  h('maek-1', '살해 범발', 'maek', 'w', [6, 5, 5, 3, 4, 5], ['nighteye']),
  h('siljik-1', '살해 파도', 'siljik', 'g', [5, 5, 4, 4, 4, 6], ['river']),
  h('haseulla-1', '살해 과하마', 'haseulla', 'g', [6, 5, 4, 3, 4, 6], ['archer']),
]

const a = (id: string, faction: string, hero: string | null, at: string, mix0: Army['mix'], equip: Army['equip'] = 'bronze'): Army => {
  const mix = Object.fromEntries(Object.entries(mix0).map(([k, n]) => [k, (n ?? 0) * PEOPLE_SCALE])) as Army['mix']
  return { id, faction, hero, mix, equip, kit: Object.fromEntries(Object.entries(mix).map(([k, n]) => [k, { [equip]: n }])), morale: 1, at, march: null }
}

const NEW_ARMIES: Army[] = [
  a('a-baekje', 'baekje', 'baekje-1', 'm-baekje-cap', { spear: 90, bow: 50, shield: 10 }, 'ironTip'),
  a('a-mokji', 'mokji', 'mokji-1', 'm-mokji-cap', { spear: 100, bow: 50, shield: 20 }, 'ironTip'),
  a('a-michuhol', 'michuhol', 'michuhol-1', 'm-michuhol-cap', { spear: 60, bow: 30, boat: 15 }),
  a('a-ungcheon', 'ungcheon', 'ungcheon-1', 'm-ungcheon-cap', { spear: 70, bow: 40 }),
  a('a-sangdang', 'sangdang', 'sangdang-1', 'm-sangdang-cap', { spear: 70, bow: 40, shield: 10 }, 'ironTip'),
  a('a-geonma', 'geonma', 'geonma-1', 'm-geonma-cap', { spear: 90, bow: 40, shield: 10 }),
  a('a-wansan', 'wansan', 'wansan-1', 'm-wansan-cap', { spear: 80, bow: 40 }),
  a('a-gosaburi', 'gosaburi', 'gosaburi-1', 'm-gosaburi-cap', { spear: 60, bow: 30 }),
  a('a-balla', 'balla', 'balla-1', 'm-balla-cap', { spear: 90, bow: 50 }),
  a('a-mujin', 'mujin', 'mujin-1', 'm-mujin-cap', { spear: 70, bow: 40 }),
  a('a-gampyeong', 'gampyeong', 'gampyeong-1', 'm-gampyeong-cap', { spear: 60, bow: 30, boat: 10 }),
  a('a-goryong', 'goryong', 'goryong-1', 'm-goryong-cap', { spear: 60, bow: 40 }),
  a('a-maek', 'maek', 'maek-1', 'n-maek-cap', { spear: 60, bow: 40 }),
  a('a-siljik', 'siljik', 'siljik-1', 'n-siljik-cap', { spear: 60, bow: 30 }),
  a('a-haseulla', 'haseulla', 'haseulla-1', 'n-haseulla-cap', { spear: 50, bow: 40, horse: 5 }),
]

const byId = <T extends { id: string }>(xs: readonly T[]): Record<string, T> =>
  Object.fromEntries(xs.map((x) => [x.id, structuredClone(x)]))

const Y = YEONGNAM_DATA
const NODES: readonly RNode[] = [...Y.NODES, ...NEW_NODES]
const EDGES: readonly REdge[] = [...Y.EDGES, ...NEW_EDGES]
const STARTS: readonly NationStart[] = [...Y.NATION_STARTS, ...NEW_STARTS]
const HEROES: readonly Hero[] = [...Y.HEROES, ...NEW_HEROES]
const ARMIES: readonly Army[] = [...Y.ARMIES, ...NEW_ARMIES]

/** 고을마다 실제 자리 [경도, 위도] — 영남 판 고을 + 새 고을 */
export function southGeo(id: string): readonly [number, number] | undefined {
  return SOUTH_GEO[id] ?? YEONGNAM_GEO[id]
}

/** 고를 수 있는 나라 id — 나라 고르기 화면의 순서 */
export const SOUTH_NATION_IDS: readonly string[] = STARTS.map((n) => n.faction.id)

/** 삼한 남부 판의 재료 — 삼한과 북녘 판(world.ts)이 그대로 이어 쓴다 */
export const SOUTH_DATA = { NODES, EDGES, STARTS, HEROES, ARMIES } as const

/** 삼한 남부 판을 연다 — 고른 나라가 플레이어. 나라마다 제 땅과 이웃만 안다 */
export function startSouth(seed: number, player: string): Realm {
  return openDiscoveryBoard(SOUTH_DATA, 'south', seed, player)
}

/** 발견이 있는 판을 연다 (삼한 남부 · 삼한과 북녘) — 고른 나라가 플레이어, 없는 나라면 우리(us) */
export function openDiscoveryBoard(
  data: { readonly NODES: readonly RNode[]; readonly EDGES: readonly REdge[]; readonly STARTS: readonly NationStart[]; readonly HEROES: readonly Hero[]; readonly ARMIES: readonly Army[] },
  region: RegionId, seed: number, player: string,
): Realm {
  const { NODES, EDGES, STARTS, HEROES, ARMIES } = data
  const me = STARTS.some((n) => n.faction.id === player) ? player : 'us'
  const factions: Faction[] = STARTS.map((n) => ({ ...n.faction, mind: n.faction.id === me ? 'player' : n.mind, ruler: `${n.faction.id}-ruler` }))
  const nodes = byId(NODES)
  const edges = byId(EDGES)
  const intel: Realm['intel'] = {}
  for (const f of factions) {
    const known: Record<string, NodeIntel> = {}
    for (const n of NODES) if (n.owner === f.id) known[n.id] = { land: true, force: null, alert: null }
    for (const ed of EDGES) {
      for (const [x, y] of [[ed.a, ed.b], [ed.b, ed.a]] as const) {
        if (nodes[x]?.owner === f.id && known[y] === undefined) known[y] = { land: true, force: null, alert: null }
      }
    }
    intel[f.id] = known
  }
  const watch: Record<string, Watch> = {}
  for (const n of NODES) watch[n.id] = { alert: 0, lull: 0 }
  const stock: Record<string, Stock> = {}
  for (const n of STARTS) stock[n.faction.id] = { ...n.stock }
  const r: Realm = {
    seed: seed >>> 0,
    season: 0,
    nodes,
    edges,
    factions: byId(factions),
    heroes: byId(HEROES),
    armies: byId(ARMIES),
    intel,
    watch,
    provoked: [],
    player: me,
    stock,
    relations: {},
    outcome: null,
    scale: PEOPLE_SCALE,
    region,
  }
  r.known = initialKnown(r)
  return r
}
