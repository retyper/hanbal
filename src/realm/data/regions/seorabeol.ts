/**
 * 캠페인 3장 「서라벌 여섯 마을」 (docs/realm/CAMPAIGN.md §1 · 형 2026-10-25: "3장도 얼른 하고싶다").
 *
 * 『삼국사기』 신라본기 시조 혁거세 거서간 · 『삼국유사』 기이편 신라시조 혁거세왕 — 진한 땅에 여섯 마을이 있었다.
 * 알천 양산촌·돌산 고허촌·취산 진지촌·무산 대수촌·금산 가리촌·명활산 고야촌. 고허촌장 소벌공이 양산 기슭 나정 곁에서
 * 알에서 난 아이를 거두어 길렀고, 열세 살에 여섯 마을이 그를 임금으로 받들었다. 알영은 알영 우물가에서 계룡의 옆구리로 났다.
 * 혁거세 8년 왜인이 변경을 넘보다 그의 덕을 듣고 돌아갔다.
 *
 * 칼을 덜 뽑는 장 — 마을을 치면 다른 마을들의 마음이 식는다 (scenario.fewerSwords). 사신·선물·혼인으로 모은다.
 * 이김: 여섯 마을이 모두 따른다(동맹이든 조공이든). 땅은 지금의 경주시 언저리 — 여섯 부의 자리 [설].
 * 고을·장수 id 는 sr- · 여섯 마을의 촌장 이름은 『삼국유사』의 것.
 */
import { PEOPLE_SCALE } from '../../migrate.ts'
import { pairKey } from '../../diplomacy.ts'
import { chapterScenario } from '../campaign.ts'
import type { NationInfo } from '../nations.ts'
import type { Army, Faction, Hero, NodeIntel, REdge, Realm, Relation, RNode, Stock, Watch } from '../../types.ts'

const node = (id: string, name: string, kind: RNode['kind'], tags: RNode['tags'], owner: string | null, hh: number): RNode =>
  ({ id, name, kind, tags, owner, hh: hh * PEOPLE_SCALE, sown: hh * PEOPLE_SCALE })
const wild = (id: string, name: string, room: number): RNode => ({ id, name, kind: 'wild', tags: [], owner: null, hh: 0, sown: 0, room: room * PEOPLE_SCALE })

/** 여섯 마을 — 이 장의 목표가 이 나라들을 센다 */
export const SEORA_VILLAGES: readonly string[] = ['sr-yangsan', 'sr-goheo', 'sr-jinji', 'sr-daesu', 'sr-gari', 'sr-goya']

/** 고을 자리 [경도, 위도] — 여섯 부의 자리는 지금의 경주 언저리로 짚은 것 [설] */
export const SEORA_PLACES: Readonly<Record<string, readonly [number, number]>> = {
  'sr-najeong-cap': [129.215, 35.82], // 나정 — 혁거세가 난 우물 (탑동)
  'sr-yangsan-cap': [129.25, 35.88], // 알천 양산촌 — 급량부 (알천 가)
  'sr-goheo-cap': [129.18, 35.71], // 돌산 고허촌 — 사량부 (남산 서남)
  'sr-jinji-cap': [129.36, 35.75], // 취산 진지촌 — 본피부 (남산 동쪽 · 토함산 아래)
  'sr-daesu-cap': [129.06, 35.84], // 무산 대수촌 — 모량부 (서쪽 골)
  'sr-gari-cap': [129.2, 35.99], // 금산 가리촌 — 한기부 (북쪽 들)
  'sr-goya-cap': [129.34, 35.88], // 명활산 고야촌 — 습비부 (명활산 동쪽)
  'sr-aryeong': [129.2, 35.77], // 알영 우물 — 사량리 [설]
  'sr-toham': [129.4, 35.8], // 토함산 소도
  'sr-hyeongsan': [129.33, 36.02], // 형산강 하구 들
  // 왜인은 뭍에 진을 치지 않는다 — 앞바다 작은 섬에 머물며 배로 건너와 노략한다 (형 10-25: "본토 말고 가까운 섬에 진치고 있다는 설정") (지음)
  'sr-wae-camp': [129.58, 35.8], // 동해 앞바다 작은 섬 (바탕 그림의 섬 자리)
  'sr-shore': [129.45, 35.75], // 토함산 동남쪽 바닷가 — 왜인 배가 닿는 곳
}

const NODES: RNode[] = [
  // 서라벌 — 나정에 선 어린 임금. 땅은 한 고을
  node('sr-najeong-cap', '나정 도읍', 'capital', ['palisade'], 'saro', 160),
  // 여섯 마을 — 저마다 촌장이 다스린다
  node('sr-yangsan-cap', '양산 마을', 'capital', ['shallows'], 'sr-yangsan', 130),
  node('sr-goheo-cap', '고허 마을', 'capital', ['high'], 'sr-goheo', 140),
  node('sr-jinji-cap', '진지 마을', 'capital', ['pines'], 'sr-jinji', 120),
  node('sr-daesu-cap', '대수 마을', 'capital', ['pines'], 'sr-daesu', 120),
  node('sr-gari-cap', '가리 마을', 'capital', [], 'sr-gari', 130),
  node('sr-goya-cap', '고야 마을', 'capital', ['high'], 'sr-goya', 120),
  // 빈땅·소도
  wild('sr-aryeong', '알영 우물 들', 120),
  node('sr-toham', '토함산 소도', 'sodo', ['sodo'], null, 0),
  wild('sr-hyeongsan', '형산강 들', 140),
  wild('sr-shore', '동해 바닷가', 80),
  // 바다 건너 온 왜인 — 앞바다 섬에 머물며 배로 건너와 마을들을 넘본다
  node('sr-wae-camp', '앞바다 왜인 섬', 'fort', ['palisade'], 'sr-wae', 90),
]

const e = (id: string, a: string, b: string, kind: REdge['kind'], tags: REdge['tags'] = []): REdge => ({ id, a, b, kind, tags })
const EDGES: REdge[] = [
  e('r01', 'sr-najeong-cap', 'sr-yangsan-cap', 'field'),
  e('r02', 'sr-najeong-cap', 'sr-aryeong', 'field'),
  e('r03', 'sr-aryeong', 'sr-goheo-cap', 'field'),
  e('r04', 'sr-najeong-cap', 'sr-daesu-cap', 'forest'),
  e('r05', 'sr-yangsan-cap', 'sr-goya-cap', 'ford'), // 알천을 건너
  e('r06', 'sr-yangsan-cap', 'sr-gari-cap', 'field'),
  e('r07', 'sr-gari-cap', 'sr-hyeongsan', 'field'),
  e('r08', 'sr-goya-cap', 'sr-hyeongsan', 'field'),
  e('r09', 'sr-goya-cap', 'sr-toham', 'pass'),
  e('r10', 'sr-toham', 'sr-jinji-cap', 'forest'),
  e('r11', 'sr-goheo-cap', 'sr-jinji-cap', 'pass'), // 남산을 돌아
  e('r12', 'sr-daesu-cap', 'sr-goheo-cap', 'forest'),
  e('r13', 'sr-daesu-cap', 'sr-gari-cap', 'pass'),
  e('r14', 'sr-jinji-cap', 'sr-shore', 'pass'), // 토함산 동쪽 고개 너머 바닷가
  e('r15', 'sr-toham', 'sr-shore', 'forest'),
  e('r16', 'sr-shore', 'sr-wae-camp', 'sea'), // 왜인의 배가 오가는 뱃길
]

const FACTIONS: Faction[] = [
  { id: 'saro', name: '서라벌', capital: 'sr-najeong-cap', equip: 'bronze', ruler: 'sr-hyeokgeose', mind: 'player' },
  { id: 'sr-yangsan', name: '양산촌', capital: 'sr-yangsan-cap', equip: 'bronze', ruler: 'sr-alpyeong', mind: 'cautious' },
  { id: 'sr-goheo', name: '고허촌', capital: 'sr-goheo-cap', equip: 'bronze', ruler: 'sr-sobeol', mind: 'cautious' },
  { id: 'sr-jinji', name: '진지촌', capital: 'sr-jinji-cap', equip: 'bronze', ruler: 'sr-jibaekho', mind: 'cautious' },
  { id: 'sr-daesu', name: '대수촌', capital: 'sr-daesu-cap', equip: 'bronze', ruler: 'sr-guryema', mind: 'cautious' },
  { id: 'sr-gari', name: '가리촌', capital: 'sr-gari-cap', equip: 'bronze', ruler: 'sr-jita', mind: 'cautious' },
  { id: 'sr-goya', name: '고야촌', capital: 'sr-goya-cap', equip: 'bronze', ruler: 'sr-hojin', mind: 'cautious' },
  { id: 'sr-wae', name: '왜인', capital: 'sr-wae-camp', equip: 'ironTip', ruler: 'sr-wae-ruler', mind: 'greedy' },
]

const STOCK: Record<string, Stock> = {
  saro: { grain: 300, iron: 10, salt: 10, wood: 30 },
  'sr-yangsan': { grain: 160, iron: 0, wood: 20 },
  'sr-goheo': { grain: 170, iron: 0, wood: 20 },
  'sr-jinji': { grain: 140, iron: 0, wood: 30 },
  'sr-daesu': { grain: 140, iron: 0, wood: 30 },
  'sr-gari': { grain: 170, iron: 0, wood: 20 },
  'sr-goya': { grain: 140, iron: 0, wood: 20 },
  'sr-wae': { grain: 120, iron: 10, wood: 10 },
}

const h = (
  id: string, name: string, faction: string, look: 'g' | 'w',
  [mu, tong, ryak, chi, deok, uiri]: readonly [number, number, number, number, number, number],
  traits: readonly string[], at: string | null = null,
): Hero => ({ id, name, faction, mu, tong, ryak, chi, deok, uiri, traits, look, status: 'free', captor: null, at, post: null })

// 혁거세·알영·호공·여섯 촌장은 사서의 사람 (호공은 혁거세 38년 마한에 사신으로 간 신하). 단비·마을의 여인 장수·왜인은 지어낸 사람
const HEROES: Hero[] = [
  h('sr-hyeokgeose', '혁거세', 'saro', 'g', [6, 6, 7, 7, 9, 10], ['charm'], 'sr-najeong-cap'),
  h('sr-aryeong', '알영', 'saro', 'w', [3, 5, 7, 8, 9, 10], ['farmer'], 'sr-najeong-cap'),
  h('sr-hogong', '호공', 'saro', 'g', [4, 4, 7, 6, 8, 9], ['trader']),
  h('sr-danbi', '나정 지기 단비', 'saro', 'w', [7, 6, 5, 4, 5, 9], ['archer']),
  h('sr-alpyeong', '촌장 알평', 'sr-yangsan', 'g', [5, 5, 6, 6, 6, 8], ['careful'], 'sr-yangsan-cap'),
  h('sr-sobeol', '촌장 소벌도리', 'sr-goheo', 'g', [5, 6, 6, 7, 7, 9], ['farmer'], 'sr-goheo-cap'),
  h('sr-jibaekho', '촌장 지백호', 'sr-jinji', 'g', [7, 5, 5, 4, 5, 8], ['mountain'], 'sr-jinji-cap'),
  h('sr-guryema', '촌장 구례마', 'sr-daesu', 'g', [6, 5, 5, 5, 4, 8], ['nighteye'], 'sr-daesu-cap'),
  h('sr-jita', '촌장 지타', 'sr-gari', 'g', [4, 5, 6, 7, 6, 8], ['trader'], 'sr-gari-cap'),
  h('sr-hojin', '촌장 호진', 'sr-goya', 'g', [6, 6, 5, 5, 5, 8], ['mountain'], 'sr-goya-cap'),
  h('sr-yangsan-1', '알천 물새', 'sr-yangsan', 'w', [5, 5, 5, 4, 6, 7], ['river']),
  h('sr-goya-1', '명활 달래', 'sr-goya', 'w', [6, 5, 5, 4, 5, 7], ['archer']),
  h('sr-jinji-1', '토함 범이', 'sr-jinji', 'w', [6, 6, 4, 4, 4, 7], ['mountain']),
  h('sr-wae-ruler', '왜인 우두머리', 'sr-wae', 'g', [7, 6, 5, 3, 3, 6], ['ironhand'], 'sr-wae-camp'),
]

const a = (id: string, faction: string, hero: string | null, at: string, mix0: Army['mix'], equip: Army['equip']): Army => {
  const mix = Object.fromEntries(Object.entries(mix0).map(([k, n]) => [k, (n ?? 0) * PEOPLE_SCALE])) as Army['mix']
  return { id, faction, hero, mix, equip, kit: Object.fromEntries(Object.entries(mix).map(([k, n]) => [k, { [equip]: n }])), morale: 1, at, march: null }
}

const ARMIES: Army[] = [
  a('a-sr-us', 'saro', 'sr-danbi', 'sr-najeong-cap', { spear: 40, bow: 30, shield: 10 }, 'bronze'),
  a('a-sr-yangsan', 'sr-yangsan', 'sr-yangsan-1', 'sr-yangsan-cap', { spear: 30, bow: 15 }, 'bronze'),
  a('a-sr-goheo', 'sr-goheo', null, 'sr-goheo-cap', { spear: 30, bow: 15 }, 'bronze'),
  a('a-sr-jinji', 'sr-jinji', 'sr-jinji-1', 'sr-jinji-cap', { spear: 30, bow: 20 }, 'bronze'),
  a('a-sr-daesu', 'sr-daesu', null, 'sr-daesu-cap', { spear: 25, bow: 15 }, 'bronze'),
  a('a-sr-gari', 'sr-gari', null, 'sr-gari-cap', { spear: 25, bow: 15 }, 'bronze'),
  a('a-sr-goya', 'sr-goya', 'sr-goya-1', 'sr-goya-cap', { spear: 30, bow: 20 }, 'bronze'),
  // 왜인 — 앞바다 섬에서 배로 건너와 마을을 넘본다. 마을들을 지켜 주면 마음이 기운다
  a('a-sr-wae', 'sr-wae', 'sr-wae-ruler', 'sr-wae-camp', { spear: 45, bow: 25 }, 'ironTip'),
]

const byId = <T extends { id: string }>(xs: readonly T[]): Record<string, T> => Object.fromEntries(xs.map((x) => [x.id, structuredClone(x)]))

export const SEORA_NATION_IDS: readonly string[] = ['saro']

/** 3장 나라 소개 — 서라벌과 여섯 마을 · 왜인 */
export const SEORA_NATIONS: readonly NationInfo[] = [
  {
    id: 'saro', name: '서라벌', place: '나정 — 경주 탑동 (설)',
    blurb: '알에서 난 열세 살 임금. 땅은 나정 한 고을뿐이고 군사도 적다 — 그러나 여섯 마을이 그를 우러른다. 칼보다 마음으로 모은다.',
    source: '『삼국사기』 신라본기 — 여섯 마을 사람들이 그의 태어남이 신이하다 하여 받들어 길렀고, 열세 살에 임금으로 세웠다. 나라 이름을 서나벌이라 하였다.',
    bars: { army: 2, grain: 3, militia: 2, terrain: 3 },
  },
  {
    id: 'sr-goheo', name: '고허촌', place: '돌산 고허촌 — 남산 서남 (설)',
    blurb: '촌장 소벌도리가 나정 곁에서 알에서 난 아이를 거두어 길렀다. 서라벌에 가장 마음이 가까운 마을.',
    source: '『삼국사기』 신라본기 — 고허촌장 소벌공이 양산 기슭 나정 곁 숲에서 말이 우는 것을 보고 가 보니 큰 알이 있었다.',
    bars: { army: 2, grain: 3, militia: 2, terrain: 3 },
  },
  {
    id: 'sr-wae', name: '왜인', place: '동해 앞바다 작은 섬 (지음)',
    blurb: '바다 건너 와 앞바다 섬에 머무는 무리. 쇠촉이 있고 배로 건너와 바닷가 마을을 넘본다. 마을을 지켜 주면 마을의 마음이 서라벌로 기운다.',
    source: '『삼국사기』 신라본기 — 혁거세 8년 왜인이 군사를 일으켜 변경을 침범하려다, 시조에게 신덕이 있다는 말을 듣고 돌아갔다. 남해 11년 왜인이 병선 100여 척으로 바닷가 민가를 노략했다.',
    bars: { army: 3, grain: 2, militia: 1, terrain: 2 },
  },
]

/** 3장을 연다 — 우리는 언제나 서라벌(혁거세) */
export function startSeorabeol(seed: number): Realm {
  const nodes = byId(NODES)
  const edges = byId(EDGES)
  // 한 골짜기라 서로 다 안다 — 땅은 처음부터 다 보인다
  const intel: Realm['intel'] = {}
  for (const f of FACTIONS) {
    const known: Record<string, NodeIntel> = {}
    for (const n of NODES) known[n.id] = { land: true, force: null, alert: null }
    intel[f.id] = known
  }
  const watch: Record<string, Watch> = {}
  for (const n of NODES) watch[n.id] = { alert: 0, lull: 0 }
  const stock: Record<string, Stock> = {}
  for (const [k, v] of Object.entries(STOCK)) stock[k] = { ...v }
  // 고허촌은 아이를 길러 낸 마을 — 처음부터 화친 · 마음이 따뜻하다. 왜인은 모두와 싸우는 사이
  const relations: Record<string, Relation> = { [pairKey('saro', 'sr-goheo')]: { state: 'truce', until: null, favor: 30 } }
  for (const f of FACTIONS) if (f.id !== 'sr-wae') relations[pairKey(f.id, 'sr-wae')] = { state: 'war', until: null }
  return {
    seed: seed >>> 0,
    season: 0,
    nodes,
    edges,
    factions: byId(FACTIONS),
    heroes: byId(HEROES),
    armies: byId(ARMIES),
    intel,
    watch,
    provoked: [],
    player: 'saro',
    stock,
    relations,
    outcome: null,
    scale: PEOPLE_SCALE,
    region: 'seorabeol',
    scenario: chapterScenario('seorabeol'),
  }
}
