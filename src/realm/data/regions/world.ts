/**
 * 삼한과 북녘 판 — 넓어지는 지도의 둘째 판: 탐라에서 부여의 들까지 (형: "고구려도 엄연한 우리역사 … 꼭 넣어야함" — 2026-10-19)
 *
 * 땅: 조각 열넷을 이은 지도 (world-geo.ts · docs/realm/WORLD-MAP.md §2-2).
 * 나라: 삼한 남부 판의 서른여섯(south.ts 그대로) + 북녘·탐라의 열넷 (WORLD-MAP §3 — 쪼개서 넣는다).
 * **이름은 우리 역사책이 먼저다** (WORLD §5 규칙 6) — 근거는 data/nations-world.ts 의 source 줄:
 *   고구려(계루 왕실 · 국내성) · 비류나부 · 연나부 · 환나부 · 관나부 — 『삼국사기』 고구려본기의 나부 이름 (위서의 소노·절노·순노·관노는 곁들임)
 *   부여 — 『삼국유사』 북부여·동부여 · 『삼국사기』 고구려본기(금와·대소). 마가·우가·저가·구가는 위서 부여전 [위서]
 *   동옥저 — 『삼국사기』 고구려본기 태조왕 4년 · 북옥저 — 동명성왕 10년
 *   불내(동예) — 위서 동이전 예전의 불내예 [위서] · 탐라 — 『삼국사기』 백제본기 문주왕 2년 · 『고려사』 지리지 삼성 이야기
 * 낙랑·대방은 **땅으로도 나라로도 그리지 않는다** (WORLD §5 규칙 0). 대동강·재령의 들은 임자 없는 빈땅이고,
 * 서북 바깥 길목은 압록 하구 환나부의 바깥 교역(income)으로만 남는다.
 * 고을 자리는 오늘 지명에 맞춘 설이다 — 나부·가의 자리는 전하지 않아 지어 앉혔다 [설].
 */
import { PEOPLE_SCALE } from '../../migrate.ts'
import type { Army, Hero, REdge, Realm, RNode, Stock } from '../../types.ts'
import { SOUTH_DATA, openDiscoveryBoard, southGeo, type NationStart } from './south.ts'

/** 새 고을의 실제 자리 [경도, 위도] — 남부 판 고을은 southGeo */
export const NORTH_GEO: Readonly<Record<string, readonly [number, number]>> = {}
const geo = NORTH_GEO as Record<string, readonly [number, number]>

const node = (id: string, name: string, kind: RNode['kind'], tags: RNode['tags'], owner: string | null, hh: number, ll: readonly [number, number]): RNode => {
  geo[id] = ll
  return { id, name, kind, tags, owner, hh: hh * PEOPLE_SCALE, sown: hh * PEOPLE_SCALE }
}
const wild = (id: string, name: string, tags: RNode['tags'], room: number, ll: readonly [number, number]): RNode => {
  geo[id] = ll
  return { id, name, kind: 'wild', tags, owner: null, hh: 0, sown: 0, room: room * PEOPLE_SCALE }
}

const NEW_NODES: RNode[] = [
  // ── 고구려 (압록 가운데 줄기 · 비류수)
  node('g-gungnae-cap', '국내성 도읍', 'capital', ['palisade', 'high'], 'goguryeo', 600, [126.18, 41.13]), // 집안 — 『삼국사기』 유리왕 22년 국내 천도
  node('g-jolbon', '졸본 산성', 'fort', ['high'], 'goguryeo', 200, [125.4, 41.32]), // 환인 오녀산 — 동명성왕이 처음 도읍한 곳
  node('g-biryu-cap', '비류나 도읍', 'capital', ['pines'], 'biryuna', 350, [125.85, 41.65]), // 비류수 윗줄기 [설] — 동명성왕 2년 비류국 송양
  node('g-yeonna-cap', '연나 도읍', 'capital', ['high'], 'yeonna', 350, [127.05, 41.3]), // 압록 윗줄기 [설]
  node('g-hwanna-cap', '환나 도읍', 'capital', [], 'hwanna', 350, [125.05, 40.6]), // 압록 아랫줄기 [설] — 서북 바깥 길목
  node('g-gwanna-cap', '관나 도읍', 'capital', ['high'], 'gwanna', 300, [126.15, 40.55]), // 독로강 [설]
  node('g-gwanna-iron', '적유령 쇠골', 'ironMine', ['iron', 'high'], 'gwanna', 120, [126.6, 40.85]), // [지어낸 이름]
  // ── 부여 (송화강의 들 — 사출도)
  node('b-buyeo-cap', '부여 도읍', 'capital', ['palisade', 'shallows'], 'buyeo', 650, [126.45, 43.85]), // 길림 [설]
  node('b-maga-cap', '마가 읍락', 'capital', ['pasture'], 'maga', 300, [125.5, 44.6]), // 사출도 [설]
  node('b-uga-cap', '우가 읍락', 'capital', ['pasture'], 'uga', 300, [125.35, 43.6]),
  node('b-jeoga-cap', '저가 읍락', 'capital', ['pines'], 'jeoga', 280, [127.3, 44.2]),
  node('b-guga-cap', '구가 읍락', 'capital', ['pasture'], 'guga', 280, [126.4, 45.05]),
  // ── 옥저 (동해 바닷가)
  node('o-dong-cap', '동옥저 도읍', 'capital', [], 'dongokjeo', 350, [127.53, 39.92]), // 함흥 [설]
  node('o-dong-port', '북청 포구', 'port', [], 'dongokjeo', 150, [128.4, 40.12]),
  node('o-buk-cap', '북옥저 도읍', 'capital', ['pines'], 'bukokjeo', 280, [129.55, 42.3]), // 두만강 아래 [설]
  node('o-buk-port', '어랑 포구', 'port', [], 'bukokjeo', 120, [129.6, 41.35]),
  // ── 동예
  node('d-bullae-cap', '불내 도읍', 'capital', ['palisade', 'pasture'], 'bullae', 320, [127.4, 39.15]), // 원산·안변 [설] — 과하마
  node('d-goseong', '고성 갯마을', 'village', ['pasture'], 'bullae', 150, [128.3, 38.45]),
  // ── 탐라
  node('t-tamna-cap', '탐라 도읍', 'capital', ['palisade'], 'tamna', 250, [126.53, 33.47]), // 제주 — 『고려사』 지리지 삼성혈
  node('t-tamna-v', '한라 기슭 마을', 'village', ['high'], 'tamna', 120, [126.56, 33.31]),
  // ── 빈땅 — 대동강·재령의 들은 임자가 없다 (군현을 땅으로 그리지 않는다)
  wild('w-yeseong', '예성강 나루', ['shallows'], 200, [126.45, 38.15]),
  wild('w-jaeryeong', '재령 들', [], 300, [125.6, 38.45]),
  wild('w-daedong', '대동강 들', [], 400, [125.75, 39.05]),
  wild('w-cheongcheon', '청천강 들', [], 250, [125.9, 39.65]),
  wild('w-cheorwon', '철원 들', ['high'], 200, [127.3, 38.25]),
  wild('w-gaema', '개마고원', ['high', 'pines'], 150, [127.6, 40.75]),
  wild('w-baekdu', '백두산 기슭', ['high', 'pines'], 100, [128.2, 41.85]),
  wild('w-huifa', '휘발하 골짜기', [], 250, [126.3, 42.6]),
  wild('w-haeran', '해란강 들', [], 200, [129.1, 42.95]),
  wild('w-mudan', '목단강 숲', ['pines'], 150, [128.6, 43.8]),
]

const e = (id: string, a: string, b: string, kind: REdge['kind'], tags: REdge['tags'] = []): REdge => ({ id, a, b, kind, tags })

/** 새 길 — 압록·송화·두만은 나루로, 적유령·추가령·마식령·황초령은 고갯길, 탐라는 뱃길 */
const NEW_EDGES: REdge[] = [
  // 남부 판과 잇는다 — 임진강 · 추가령 · 동해 바닷길
  e('k01', 'w-yeseong', 'm-baekje-v', 'ford'), // 임진강
  e('k41', 'w-cheorwon', 'w-yeseong', 'field'),
  e('k40', 'w-cheorwon', 'n-maek-cap', 'field'),
  e('k38', 'd-goseong', 'n-haseulla-cap', 'field'),
  e('k48', 'd-goseong', 'n-maek-cap', 'pass'), // 진부령 쪽
  // 황해·평안의 들
  e('k02', 'w-yeseong', 'w-jaeryeong', 'field'),
  e('k03', 'w-jaeryeong', 'w-daedong', 'field'),
  e('k04', 'w-daedong', 'w-cheongcheon', 'field'),
  e('k42', 'd-bullae-cap', 'w-daedong', 'pass'), // 마식령
  e('k05', 'w-cheongcheon', 'g-hwanna-cap', 'pass'),
  e('k06', 'w-cheongcheon', 'g-gwanna-cap', 'pass'), // 적유령
  // 고구려
  e('k07', 'g-hwanna-cap', 'g-jolbon', 'forest'),
  e('k08', 'g-jolbon', 'g-gungnae-cap', 'pass'),
  e('k09', 'g-jolbon', 'g-biryu-cap', 'field'), // 비류수
  e('k10', 'g-gungnae-cap', 'g-biryu-cap', 'forest'),
  e('k11', 'g-gungnae-cap', 'g-gwanna-cap', 'ford'), // 압록 건너
  e('k12', 'g-gwanna-cap', 'g-gwanna-iron', 'field'),
  e('k13', 'g-gungnae-cap', 'g-yeonna-cap', 'ford'),
  e('k14', 'g-yeonna-cap', 'g-gwanna-iron', 'pass'),
  e('k15', 'g-yeonna-cap', 'w-gaema', 'pass'),
  // 개마고원 · 백두산 · 옥저 · 동예
  e('k16', 'w-gaema', 'o-dong-cap', 'pass'), // 황초령
  e('k17', 'w-gaema', 'w-baekdu', 'pass'),
  e('k31', 'w-baekdu', 'o-buk-cap', 'forest'),
  e('k33', 'o-buk-cap', 'o-buk-port', 'field'),
  e('k34', 'o-buk-port', 'o-dong-port', 'sea'),
  e('k35', 'o-dong-port', 'o-dong-cap', 'field'),
  e('k36', 'o-dong-cap', 'd-bullae-cap', 'field'), // 바닷가 길
  e('k37', 'd-bullae-cap', 'd-goseong', 'field'),
  e('k39', 'd-bullae-cap', 'w-cheorwon', 'pass'), // 추가령
  // 부여로 가는 길
  e('k18', 'g-gungnae-cap', 'w-huifa', 'pass'),
  e('k19', 'g-biryu-cap', 'w-huifa', 'forest'),
  e('k32', 'w-baekdu', 'w-huifa', 'forest'), // 송화강 샘
  e('k20', 'w-huifa', 'b-uga-cap', 'field'),
  e('k21', 'w-huifa', 'b-buyeo-cap', 'field'),
  e('k22', 'b-buyeo-cap', 'b-uga-cap', 'field'),
  e('k23', 'b-buyeo-cap', 'b-maga-cap', 'field'),
  e('k24', 'b-buyeo-cap', 'b-guga-cap', 'ford'), // 송화강
  e('k25', 'b-buyeo-cap', 'b-jeoga-cap', 'forest'),
  e('k26', 'b-maga-cap', 'b-uga-cap', 'field'),
  e('k27', 'b-maga-cap', 'b-guga-cap', 'field'),
  e('k28', 'b-jeoga-cap', 'w-mudan', 'forest'),
  e('k29', 'w-mudan', 'w-haeran', 'pass'),
  e('k30', 'w-haeran', 'o-buk-cap', 'ford'), // 두만강
  // 탐라 — 바닷길
  e('k44', 't-tamna-cap', 't-tamna-v', 'field'),
  e('k45', 't-tamna-cap', 'm-balla-port', 'sea'),
  e('k46', 't-tamna-cap', 'm-gampyeong-port', 'sea'),
]

const st = (grain: number, iron: number, more: Partial<Stock> = {}): Stock => ({ grain, iron, ...more })

const NEW_STARTS: readonly NationStart[] = [
  { faction: { id: 'goguryeo', name: '고구려', capital: 'g-gungnae-cap', equip: 'ironTip' }, mind: 'greedy', stock: st(320, 25, { wood: 40, horse: 8 }) },
  { faction: { id: 'biryuna', name: '비류나부', capital: 'g-biryu-cap', equip: 'bronze' }, mind: 'cautious', stock: st(220, 5, { wood: 40, horse: 4 }) },
  { faction: { id: 'yeonna', name: '연나부', capital: 'g-yeonna-cap', equip: 'bronze' }, mind: 'cautious', stock: st(220, 5, { wood: 40, horse: 4 }) },
  // 서북 바깥 길목 — 압록 하구로 들고 나는 바깥 교역 (군현은 땅으로 그리지 않는다)
  { faction: { id: 'hwanna', name: '환나부', capital: 'g-hwanna-cap', equip: 'bronze', income: { grain: 10, iron: 4 } }, mind: 'greedy', stock: st(240, 10, { wood: 30, horse: 4 }) },
  { faction: { id: 'gwanna', name: '관나부', capital: 'g-gwanna-cap', equip: 'ironTip' }, mind: 'greedy', stock: st(200, 25, { wood: 40 }) },
  { faction: { id: 'buyeo', name: '부여', capital: 'b-buyeo-cap', equip: 'ironTip' }, mind: 'greedy', stock: st(340, 15, { wood: 30, horse: 10 }) },
  { faction: { id: 'maga', name: '마가', capital: 'b-maga-cap', equip: 'bronze' }, mind: 'greedy', stock: st(220, 5, { wood: 20, horse: 12 }) },
  { faction: { id: 'uga', name: '우가', capital: 'b-uga-cap', equip: 'bronze' }, mind: 'cautious', stock: st(260, 5, { wood: 20, horse: 6 }) },
  { faction: { id: 'jeoga', name: '저가', capital: 'b-jeoga-cap', equip: 'bronze' }, mind: 'cautious', stock: st(220, 5, { wood: 45 }) },
  { faction: { id: 'guga', name: '구가', capital: 'b-guga-cap', equip: 'bronze' }, mind: 'cautious', stock: st(220, 5, { wood: 25, horse: 8 }) },
  { faction: { id: 'dongokjeo', name: '동옥저', capital: 'o-dong-cap', equip: 'bronze' }, mind: 'cautious', stock: st(240, 5, { salt: 25, wood: 30 }) },
  { faction: { id: 'bukokjeo', name: '북옥저', capital: 'o-buk-cap', equip: 'bronze' }, mind: 'cautious', stock: st(200, 0, { salt: 15, wood: 40 }) },
  { faction: { id: 'bullae', name: '불내', capital: 'd-bullae-cap', equip: 'bronze' }, mind: 'cautious', stock: st(220, 5, { salt: 15, wood: 30, horse: 8 }) },
  { faction: { id: 'tamna', name: '탐라', capital: 't-tamna-cap', equip: 'bronze' }, mind: 'cautious', stock: st(200, 0, { salt: 20, wood: 20 }) },
]

const h = (
  id: string, name: string, faction: string, look: 'g' | 'w',
  [mu, tong, ryak, chi, deok, uiri]: readonly [number, number, number, number, number, number],
  traits: readonly string[], at: string | null = null,
): Hero => ({ id, name, faction, mu, tong, ryak, chi, deok, uiri, traits, look, status: 'free', captor: null, at, post: null })

/** 군주와 장군 — 이름은 지어냈다. 칭호: 고구려 대가·패자·우태·조의·선인(『삼국사기』) · 부여의 가·견사 · 옥저의 장수 · 동예의 삼로 [위서] */
const NEW_HEROES: Hero[] = [
  h('goguryeo-ruler', '대왕 다물', 'goguryeo', 'g', [7, 7, 6, 5, 6, 8], ['archer'], 'g-gungnae-cap'), // 다물 — 동명성왕 "옛 땅을 되찾는다"
  h('biryuna-ruler', '패자 송비', 'biryuna', 'w', [4, 6, 6, 5, 6, 7], ['charm'], 'g-biryu-cap'),
  h('yeonna-ruler', '우태 명솔', 'yeonna', 'g', [5, 6, 7, 5, 6, 8], ['careful'], 'g-yeonna-cap'),
  h('hwanna-ruler', '패자 가비', 'hwanna', 'w', [4, 5, 6, 6, 6, 7], ['trader'], 'g-hwanna-cap'),
  h('gwanna-ruler', '패자 쇠뫼', 'gwanna', 'g', [6, 6, 5, 5, 4, 7], ['smith'], 'g-gwanna-cap'),
  h('buyeo-ruler', '왕 금하', 'buyeo', 'g', [5, 7, 6, 6, 6, 7], ['careful'], 'b-buyeo-cap'),
  h('maga-ruler', '마가 달리', 'maga', 'w', [6, 6, 5, 4, 5, 7], ['archer'], 'b-maga-cap'),
  h('uga-ruler', '우가 소두', 'uga', 'g', [5, 5, 5, 6, 5, 7], ['farmer'], 'b-uga-cap'),
  h('jeoga-ruler', '저가 멧돌', 'jeoga', 'g', [7, 5, 4, 4, 4, 6], ['mountain'], 'b-jeoga-cap'),
  h('guga-ruler', '구가 누리', 'guga', 'w', [4, 5, 6, 5, 6, 7], ['charm'], 'b-guga-cap'),
  h('dongokjeo-ruler', '장수 소금', 'dongokjeo', 'w', [4, 5, 6, 6, 6, 7], ['trader'], 'o-dong-cap'),
  h('bukokjeo-ruler', '장수 두만', 'bukokjeo', 'g', [6, 5, 5, 4, 4, 7], ['mountain'], 'o-buk-cap'),
  h('bullae-ruler', '삼로 박달', 'bullae', 'w', [6, 5, 6, 4, 6, 8], ['archer'], 'd-bullae-cap'), // 단궁 — 박달나무 활
  h('tamna-ruler', '군장 한라', 'tamna', 'w', [4, 5, 6, 5, 7, 8], ['shaman'], 't-tamna-cap'),
  h('goguryeo-1', '대가 소나', 'goguryeo', 'g', [8, 6, 5, 4, 4, 7], ['mountain']),
  h('goguryeo-2', '조의 활미', 'goguryeo', 'w', [6, 5, 6, 4, 5, 7], ['archer']),
  h('biryuna-1', '선인 물결', 'biryuna', 'g', [6, 5, 4, 4, 4, 6], ['river']),
  h('yeonna-1', '선인 너울', 'yeonna', 'w', [5, 5, 5, 4, 4, 6], ['mountain']),
  h('hwanna-1', '선인 압록', 'hwanna', 'g', [6, 5, 4, 4, 4, 6], ['river']),
  h('gwanna-1', '선인 무쇠', 'gwanna', 'g', [6, 5, 4, 3, 4, 6], ['ironhand']),
  h('buyeo-1', '대사 해달', 'buyeo', 'w', [6, 6, 5, 4, 5, 7], ['archer']),
  h('maga-1', '견사 말굽', 'maga', 'g', [7, 5, 4, 3, 4, 6], []),
  h('uga-1', '견사 누렁소', 'uga', 'g', [6, 5, 4, 3, 4, 6], []),
  h('jeoga-1', '견사 엄니', 'jeoga', 'w', [6, 5, 5, 3, 4, 6], ['nighteye']),
  h('guga-1', '견사 사냥개', 'guga', 'g', [6, 5, 5, 3, 4, 6], ['nighteye']),
  h('dongokjeo-1', '장수 갯돌', 'dongokjeo', 'g', [6, 5, 4, 4, 4, 6], ['river']),
  h('bukokjeo-1', '장수 물범', 'bukokjeo', 'w', [5, 5, 5, 3, 4, 6], ['river']),
  h('bullae-1', '삼로 과하', 'bullae', 'g', [6, 5, 4, 3, 4, 6], []),
  h('tamna-1', '살해 오름', 'tamna', 'g', [5, 5, 4, 4, 4, 6], ['mountain']),
  // 여인 장수 더 (형 2026-10-19: "장수도 여캐 많았으면") — 도읍에 머문다
  h('hwanna-2', '조의 버들', 'hwanna', 'w', [6, 5, 5, 4, 5, 7], ['archer'], 'g-hwanna-cap'),
  h('gwanna-2', '조의 쇠눈', 'gwanna', 'w', [7, 6, 4, 3, 3, 7], ['careful'], 'g-gwanna-cap'),
  h('uga-2', '견사 누리', 'uga', 'w', [3, 4, 5, 7, 7, 7], ['farmer'], 'b-uga-cap'),
  h('dongokjeo-2', '장수 소금비', 'dongokjeo', 'w', [5, 5, 5, 5, 4, 6], ['river'], 'o-dong-cap'),
  h('tamna-2', '살해 오름비', 'tamna', 'w', [5, 4, 5, 4, 6, 6], ['mountain'], 't-tamna-cap'),
]

const a = (id: string, faction: string, hero: string | null, at: string, mix0: Army['mix'], equip: Army['equip'] = 'bronze'): Army => {
  const mix = Object.fromEntries(Object.entries(mix0).map(([k, n]) => [k, (n ?? 0) * PEOPLE_SCALE])) as Army['mix']
  return { id, faction, hero, mix, equip, kit: Object.fromEntries(Object.entries(mix).map(([k, n]) => [k, { [equip]: n }])), morale: 1, at, march: null }
}

/** 고구려·부여는 말 탄 군사가 있다 (battle.ts — 기병은 부여·고구려만) */
const NEW_ARMIES: Army[] = [
  a('a-goguryeo', 'goguryeo', 'goguryeo-1', 'g-gungnae-cap', { spear: 80, bow: 70, horse: 20 }, 'ironTip'),
  a('a-goguryeo-2', 'goguryeo', 'goguryeo-2', 'g-jolbon', { bow: 40, spear: 20 }, 'ironTip'),
  a('a-biryuna', 'biryuna', 'biryuna-1', 'g-biryu-cap', { spear: 60, bow: 40, horse: 5 }),
  a('a-yeonna', 'yeonna', 'yeonna-1', 'g-yeonna-cap', { spear: 60, bow: 40, horse: 5 }),
  a('a-hwanna', 'hwanna', 'hwanna-1', 'g-hwanna-cap', { spear: 60, bow: 40, horse: 5 }),
  a('a-gwanna', 'gwanna', 'gwanna-1', 'g-gwanna-cap', { spear: 60, bow: 40, shield: 10 }, 'ironTip'),
  a('a-buyeo', 'buyeo', 'buyeo-1', 'b-buyeo-cap', { spear: 90, bow: 50, horse: 25 }, 'ironTip'),
  a('a-maga', 'maga', 'maga-1', 'b-maga-cap', { spear: 40, bow: 30, horse: 20 }),
  a('a-uga', 'uga', 'uga-1', 'b-uga-cap', { spear: 60, bow: 30, horse: 8 }),
  a('a-jeoga', 'jeoga', 'jeoga-1', 'b-jeoga-cap', { spear: 60, bow: 40 }),
  a('a-guga', 'guga', 'guga-1', 'b-guga-cap', { spear: 50, bow: 30, horse: 10 }),
  a('a-dongokjeo', 'dongokjeo', 'dongokjeo-1', 'o-dong-cap', { spear: 70, bow: 30, boat: 10 }),
  a('a-bukokjeo', 'bukokjeo', 'bukokjeo-1', 'o-buk-cap', { spear: 50, bow: 40 }),
  a('a-bullae', 'bullae', 'bullae-1', 'd-bullae-cap', { spear: 50, bow: 50, horse: 5 }),
  a('a-tamna', 'tamna', 'tamna-1', 't-tamna-cap', { spear: 40, bow: 30, boat: 15 }),
]

const S = SOUTH_DATA
/** 삼한과 북녘 판의 재료 */
export const WORLD_DATA = {
  NODES: [...S.NODES, ...NEW_NODES] as readonly RNode[],
  EDGES: [...S.EDGES, ...NEW_EDGES] as readonly REdge[],
  STARTS: [...S.STARTS, ...NEW_STARTS] as readonly NationStart[],
  HEROES: [...S.HEROES, ...NEW_HEROES] as readonly Hero[],
  ARMIES: [...S.ARMIES, ...NEW_ARMIES] as readonly Army[],
} as const

/** 고을마다 실제 자리 [경도, 위도] — 남부 판 고을 + 북녘 고을 */
export function worldGeo(id: string): readonly [number, number] | undefined {
  return NORTH_GEO[id] ?? southGeo(id)
}

/** 고를 수 있는 나라 id — 나라 고르기 화면의 순서 (남부 판 나라 다음에 북녘) */
export const WORLD_NATION_IDS: readonly string[] = WORLD_DATA.STARTS.map((n) => n.faction.id)

/** 삼한과 북녘 판을 연다 — 고른 나라가 플레이어. 나라마다 제 땅과 이웃만 안다 */
export function startWorld(seed: number, player: string): Realm {
  return openDiscoveryBoard(WORLD_DATA, 'world', seed, player)
}
