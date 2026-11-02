/**
 * 캠페인 4장 「구지봉의 노래」 (docs/realm/CAMPAIGN.md §1 · 형 2026-11-03: "4장 5장도 캠페인 만들어줘 · 시작하자마자 남의 게임 이어서 하는 느낌 들면 안됨").
 *
 * 『삼국유사』 가락국기 — 이 땅엔 아직 나라 이름도 임금도 없고 아홉 간(아도간·여도간·피도간·오도간·유수간·유천간·신천간·오천간·신귀간)이
 * 백성을 거느렸다. 기원후 42년 구지봉에서 「거북아 거북아」를 부르니 하늘에서 금합이 내려와 알 여섯이 들었고, 맨 먼저 난 수로가 왕이 되었다.
 * 아유타국 공주 허황옥이 붉은 돛 배를 타고 와 왕비가 되었다(48년). 바다에서 온 탈해가 왕위를 내놓으라 하다 둔갑 겨루기에 져서 달아났다.
 *
 * 막 선 나라로 시작한다 — 가락은 도읍과 작은 포구뿐, 둘레는 임자 없는 들과 아홉 간의 작은 마을들. 탈해는 바다 건너 섬에 있다가
 * 처음 유예(aiGrace)가 끝나면 배를 타고 망산도 포구로 쳐들어온다. 아홉 간과는 다투지 않는다(늘 화친).
 * 이김: 아홉 간이 모두 따른다(동맹·속국, 또는 그 마을을 쳐서 아우름 — submit.take) · 지난 한 해 안에 다섯 나라와 철을 주고받았다 (paths.ironTrade).
 * 땅은 지금의 김해 언저리 — 아홉 간의 마을 자리는 사서에 없어 지은 것이다 [지음]. 고을·장수 id 는 gj-.
 */
import { PEOPLE_SCALE } from '../../migrate.ts'
import { pairKey } from '../../diplomacy.ts'
import { chapterScenario } from '../campaign.ts'
import type { NationInfo } from '../nations.ts'
import type { Army, Faction, Hero, NodeIntel, REdge, Realm, Relation, RNode, Stock, Wanderer, Watch } from '../../types.ts'

const node = (id: string, name: string, kind: RNode['kind'], tags: RNode['tags'], owner: string | null, hh: number): RNode =>
  ({ id, name, kind, tags, owner, hh: hh * PEOPLE_SCALE, sown: hh * PEOPLE_SCALE })
const wild = (id: string, name: string, room: number): RNode => ({ id, name, kind: 'wild', tags: [], owner: null, hh: 0, sown: 0, room: room * PEOPLE_SCALE })

/** 아홉 간 — 이 장의 목표가 이 나라들을 센다 (가락국기의 차례) */
export const NINE_GAN: readonly string[] = ['gj-ado', 'gj-yeodo', 'gj-pido', 'gj-odo', 'gj-yusu', 'gj-yucheon', 'gj-sincheon', 'gj-ocheon', 'gj-singwi']

/** 고을 자리 [경도, 위도] — 가락 도읍은 구지봉 아래, 아홉 간의 마을은 김해 둘레에 지어 놓았다 [지음] */
export const GUJI_PLACES: Readonly<Record<string, readonly [number, number]>> = {
  'gj-garak-cap': [128.877, 35.243], // 구지봉 아래 — 수로왕의 도읍 [설]
  'gj-ado-cap': [128.85, 35.35], // 아도 마을 (북쪽 골)
  'gj-yeodo-cap': [128.98, 35.33], // 여도 마을 (낙동강 서쪽 언덕)
  'gj-pido-cap': [128.7, 35.2], // 피도 마을 (서남쪽 바닷가 언덕)
  'gj-odo-cap': [128.82, 35.16], // 오도 마을 (남쪽 들)
  'gj-yusu-cap': [129.04, 35.25], // 유수 마을 (낙동강 건너)
  'gj-yucheon-cap': [128.72, 35.38], // 유천 마을 (서북쪽 들)
  'gj-sincheon-cap': [128.6, 35.28], // 신천 마을 (서쪽 산골)
  'gj-ocheon-cap': [128.92, 35.45], // 오천 마을 (낙동강 굽이)
  'gj-singwi-cap': [128.98, 35.13], // 신귀 마을 (강어귀 바닷가)
  'gj-soedun': [128.93, 35.29], // 쇠둑 — 쇠를 캐는 언덕 (지음)
  'gj-reeds': [128.92, 35.19], // 강어귀 갈대밭
  'gj-jinyeong': [128.75, 35.3], // 진영 들
  'gj-sineo': [128.96, 35.24], // 신어산 소도 — 물고기 두 마리의 산
  'gj-mangsan': [128.8, 35.1], // 망산도 포구 — 허황옥의 배가 닿은 곳 [설]
  'gj-hwangsan': [129.02, 35.4], // 황산강 나루 (낙동강의 옛 이름)
  // 탈해는 바다에서 왔다 — 남쪽 큰 섬에 배를 대고 때를 엿본다 (지음)
  'gj-tahae-camp': [128.62, 34.95],
}

const NODES: RNode[] = [
  // 가락 — 구지봉 아래 막 선 나라. 땅은 도읍과 바닷가 포구 하나 (허황옥의 배가 닿고, 탈해의 배도 여기로 온다)
  node('gj-garak-cap', '가락 도읍', 'capital', ['palisade'], 'garak', 160),
  // 아홉 간의 마을 — 저마다 간이 백성을 거느린다. 작다
  node('gj-ado-cap', '아도 마을', 'capital', ['pines'], 'gj-ado', 90),
  node('gj-yeodo-cap', '여도 마을', 'capital', [], 'gj-yeodo', 80),
  node('gj-pido-cap', '피도 마을', 'capital', ['high'], 'gj-pido', 80),
  node('gj-odo-cap', '오도 마을', 'capital', [], 'gj-odo', 90),
  node('gj-yusu-cap', '유수 마을', 'capital', ['shallows'], 'gj-yusu', 80),
  node('gj-yucheon-cap', '유천 마을', 'capital', [], 'gj-yucheon', 80),
  node('gj-sincheon-cap', '신천 마을', 'capital', ['pines'], 'gj-sincheon', 70),
  node('gj-ocheon-cap', '오천 마을', 'capital', ['shallows'], 'gj-ocheon', 70),
  node('gj-singwi-cap', '신귀 마을', 'capital', ['reeds'], 'gj-singwi', 80),
  // 임자 없는 땅 — 쇠둑 · 들 · 소도
  node('gj-soedun', '쇠둑', 'ironMine', ['iron'], null, 0),
  wild('gj-reeds', '강어귀 갈대밭', 120),
  wild('gj-jinyeong', '진영 들', 160),
  node('gj-sineo', '신어산 소도', 'sodo', ['sodo'], null, 0),
  node('gj-mangsan', '망산도 포구', 'port', [], 'garak', 50),
  wild('gj-hwangsan', '황산강 나루 들', 120),
  // 탈해 — 남쪽 섬에 배를 댔다
  node('gj-tahae-camp', '탈해의 섬', 'fort', ['palisade'], 'tahae', 60),
]

const e = (id: string, a: string, b: string, kind: REdge['kind'], tags: REdge['tags'] = []): REdge => ({ id, a, b, kind, tags })
const EDGES: REdge[] = [
  e('g01', 'gj-garak-cap', 'gj-ado-cap', 'field'),
  e('g02', 'gj-garak-cap', 'gj-soedun', 'field'),
  e('g03', 'gj-garak-cap', 'gj-reeds', 'field'),
  e('g04', 'gj-garak-cap', 'gj-odo-cap', 'field'),
  e('g05', 'gj-garak-cap', 'gj-sineo', 'forest'),
  e('g06', 'gj-garak-cap', 'gj-jinyeong', 'field'),
  e('g07', 'gj-soedun', 'gj-yeodo-cap', 'field'),
  e('g08', 'gj-sineo', 'gj-yusu-cap', 'ford'), // 낙동강을 건너
  e('g09', 'gj-reeds', 'gj-singwi-cap', 'reeds'),
  e('g10', 'gj-odo-cap', 'gj-mangsan', 'field'),
  e('g11', 'gj-odo-cap', 'gj-pido-cap', 'pass'),
  e('g12', 'gj-jinyeong', 'gj-yucheon-cap', 'field'),
  e('g13', 'gj-jinyeong', 'gj-sincheon-cap', 'pass'),
  e('g14', 'gj-ado-cap', 'gj-yucheon-cap', 'forest'),
  e('g15', 'gj-ado-cap', 'gj-ocheon-cap', 'field'),
  e('g16', 'gj-yeodo-cap', 'gj-hwangsan', 'field'),
  e('g17', 'gj-hwangsan', 'gj-ocheon-cap', 'field'),
  e('g18', 'gj-hwangsan', 'gj-yusu-cap', 'ford'),
  e('g19', 'gj-pido-cap', 'gj-sincheon-cap', 'forest'),
  e('g20', 'gj-singwi-cap', 'gj-yusu-cap', 'ford'),
  e('g21', 'gj-mangsan', 'gj-tahae-camp', 'sea'), // 탈해의 배가 오는 뱃길
  e('g22', 'gj-garak-cap', 'gj-mangsan', 'field'), // 도읍에서 바닷가 포구로
]

const FACTIONS: Faction[] = [
  { id: 'garak', name: '가락', capital: 'gj-garak-cap', equip: 'ironTip', ruler: 'gj-suro', mind: 'player' },
  { id: 'gj-ado', name: '아도간', capital: 'gj-ado-cap', equip: 'bronze', ruler: 'gj-adogan', mind: 'cautious' },
  { id: 'gj-yeodo', name: '여도간', capital: 'gj-yeodo-cap', equip: 'bronze', ruler: 'gj-yeodogan', mind: 'cautious' },
  { id: 'gj-pido', name: '피도간', capital: 'gj-pido-cap', equip: 'bronze', ruler: 'gj-pidogan', mind: 'cautious' },
  { id: 'gj-odo', name: '오도간', capital: 'gj-odo-cap', equip: 'bronze', ruler: 'gj-odogan', mind: 'cautious' },
  { id: 'gj-yusu', name: '유수간', capital: 'gj-yusu-cap', equip: 'bronze', ruler: 'gj-yusugan', mind: 'cautious' },
  { id: 'gj-yucheon', name: '유천간', capital: 'gj-yucheon-cap', equip: 'bronze', ruler: 'gj-yucheongan', mind: 'cautious' },
  { id: 'gj-sincheon', name: '신천간', capital: 'gj-sincheon-cap', equip: 'bronze', ruler: 'gj-sincheongan', mind: 'cautious' },
  { id: 'gj-ocheon', name: '오천간', capital: 'gj-ocheon-cap', equip: 'bronze', ruler: 'gj-ocheongan', mind: 'cautious' },
  { id: 'gj-singwi', name: '신귀간', capital: 'gj-singwi-cap', equip: 'bronze', ruler: 'gj-singwigan', mind: 'cautious' },
  { id: 'tahae', name: '탈해', capital: 'gj-tahae-camp', equip: 'ironTip', ruler: 'gj-tahae', mind: 'greedy' },
]

const STOCK: Record<string, Stock> = {
  garak: { grain: 320, iron: 40, salt: 10, wood: 30 },
  'gj-ado': { grain: 130, iron: 0, wood: 20 },
  'gj-yeodo': { grain: 120, iron: 0, wood: 20 },
  'gj-pido': { grain: 120, iron: 0, salt: 5, wood: 20 },
  'gj-odo': { grain: 130, iron: 0, wood: 20 },
  'gj-yusu': { grain: 120, iron: 0, wood: 20 },
  'gj-yucheon': { grain: 120, iron: 0, wood: 20 },
  'gj-sincheon': { grain: 110, iron: 0, wood: 30 },
  'gj-ocheon': { grain: 110, iron: 0, wood: 20 },
  'gj-singwi': { grain: 120, iron: 0, salt: 5, wood: 20 },
  tahae: { grain: 140, iron: 10, wood: 30 },
}

const h = (
  id: string, name: string, faction: string, look: 'g' | 'w',
  [mu, tong, ryak, chi, deok, uiri]: readonly [number, number, number, number, number, number],
  traits: readonly string[], at: string | null = null,
): Hero => ({ id, name, faction, mu, tong, ryak, chi, deok, uiri, traits, look, status: 'free', captor: null, at, post: null })

// 수로 · 허황옥 · 탈해 · 아홉 간은 사서의 사람 (간의 얼굴과 나이·성품은 사서에 없어 지었다 · 셋은 여인으로 지었다).
// 가락의 장수 무쇠·다나와 탈해의 뱃사람은 지어낸 사람
const HEROES: Hero[] = [
  h('gj-suro', '수로', 'garak', 'g', [7, 7, 7, 8, 9, 10], ['charm'], 'gj-garak-cap'),
  h('gj-musoe', '쇠둑 지기 무쇠', 'garak', 'g', [8, 6, 5, 4, 5, 9], ['smith']),
  h('gj-dana', '다나', 'garak', 'w', [7, 6, 6, 5, 6, 9], ['archer']),
  h('gj-adogan', '아도간', 'gj-ado', 'g', [5, 6, 6, 7, 7, 9], ['careful'], 'gj-ado-cap'),
  h('gj-yeodogan', '여도간', 'gj-yeodo', 'g', [6, 5, 5, 5, 6, 8], ['farmer'], 'gj-yeodo-cap'),
  h('gj-pidogan', '피도간', 'gj-pido', 'g', [6, 6, 5, 4, 5, 8], ['mountain'], 'gj-pido-cap'),
  h('gj-odogan', '오도간', 'gj-odo', 'g', [5, 5, 6, 6, 6, 8], ['trader'], 'gj-odo-cap'),
  h('gj-yusugan', '유수간', 'gj-yusu', 'g', [6, 5, 5, 5, 5, 8], ['river'], 'gj-yusu-cap'),
  h('gj-yucheongan', '유천간', 'gj-yucheon', 'w', [4, 5, 7, 7, 7, 9], ['farmer'], 'gj-yucheon-cap'),
  h('gj-sincheongan', '신천간', 'gj-sincheon', 'w', [3, 5, 6, 7, 8, 9], ['shaman'], 'gj-sincheon-cap'),
  h('gj-ocheongan', '오천간', 'gj-ocheon', 'g', [7, 5, 4, 4, 5, 8], ['river'], 'gj-ocheon-cap'),
  h('gj-singwigan', '신귀간', 'gj-singwi', 'w', [6, 6, 6, 5, 6, 8], ['river'], 'gj-singwi-cap'),
  h('gj-tahae', '탈해', 'tahae', 'g', [8, 6, 8, 6, 5, 6], ['ironhand'], 'gj-tahae-camp'),
  h('gj-tahae-1', '뱃사람 너울', 'tahae', 'w', [6, 6, 5, 4, 4, 6], ['river']),
]

/** 허황옥 — 아유타국에서 붉은 돛 배로 와 망산도 포구에 머문다. 맞아들이면(떠돌이 들이기) 우리 사람이 된다 */
export const HEO_HWANGOK: Hero = h('gj-heo', '허황옥', 'garak', 'w', [3, 5, 8, 9, 9, 10], ['trader'])

const a = (id: string, faction: string, hero: string | null, at: string, mix0: Army['mix'], equip: Army['equip']): Army => {
  const mix = Object.fromEntries(Object.entries(mix0).map(([k, n]) => [k, (n ?? 0) * PEOPLE_SCALE])) as Army['mix']
  return { id, faction, hero, mix, equip, kit: Object.fromEntries(Object.entries(mix).map(([k, n]) => [k, { [equip]: n }])), morale: 1, at, march: null }
}

const ARMIES: Army[] = [
  // 가락 — 쇠촉을 든 작은 무리. 아홉 간의 마을 어느 하나보다 크다
  a('a-gj-us', 'garak', 'gj-musoe', 'gj-garak-cap', { spear: 50, bow: 30, shield: 10 }, 'ironTip'),
  a('a-gj-us2', 'garak', 'gj-dana', 'gj-garak-cap', { spear: 20, bow: 20 }, 'ironTip'),
  a('a-gj-ado', 'gj-ado', null, 'gj-ado-cap', { spear: 20, bow: 10 }, 'bronze'),
  a('a-gj-yeodo', 'gj-yeodo', null, 'gj-yeodo-cap', { spear: 20, bow: 10 }, 'bronze'),
  a('a-gj-pido', 'gj-pido', null, 'gj-pido-cap', { spear: 20, bow: 10 }, 'bronze'),
  a('a-gj-odo', 'gj-odo', null, 'gj-odo-cap', { spear: 20, bow: 10 }, 'bronze'),
  a('a-gj-yusu', 'gj-yusu', null, 'gj-yusu-cap', { spear: 20, bow: 10 }, 'bronze'),
  a('a-gj-yucheon', 'gj-yucheon', null, 'gj-yucheon-cap', { spear: 15, bow: 10 }, 'bronze'),
  a('a-gj-sincheon', 'gj-sincheon', null, 'gj-sincheon-cap', { spear: 15, bow: 10 }, 'bronze'),
  a('a-gj-ocheon', 'gj-ocheon', null, 'gj-ocheon-cap', { spear: 15, bow: 10 }, 'bronze'),
  a('a-gj-singwi', 'gj-singwi', null, 'gj-singwi-cap', { spear: 15, bow: 10 }, 'bronze'),
  // 탈해의 무리 — 처음 유예가 끝나면 배를 타고 망산도로 건너온다
  a('a-gj-tahae', 'tahae', 'gj-tahae', 'gj-tahae-camp', { spear: 35, bow: 25 }, 'ironTip'),
  a('a-gj-tahae-guard', 'tahae', 'gj-tahae-1', 'gj-tahae-camp', { spear: 15, bow: 10 }, 'ironTip'), // 섬을 지키는 무리
]

const byId = <T extends { id: string }>(xs: readonly T[]): Record<string, T> => Object.fromEntries(xs.map((x) => [x.id, structuredClone(x)]))

export const GUJI_NATION_IDS: readonly string[] = ['garak']

/** 4장 나라 소개 — 가락 · 아도간(아홉 간의 맏이) · 탈해 */
export const GUJI_NATIONS: readonly NationInfo[] = [
  {
    id: 'garak', name: '가락', place: '구지봉: 김해 구산동 (설)',
    blurb: '하늘에서 내린 금빛 알에서 난 임금. 땅은 도읍 한 고을뿐이지만 쇠촉이 있고 곁에 쇠를 캐는 언덕이 있다. 아홉 간의 마음을 모은다.',
    source: '『삼국유사』 가락국기: 아홉 간이 구지봉에서 노래하니 금합에 알 여섯이 내려왔다. 맨 먼저 난 이를 수로라 하고 왕으로 세우니 나라 이름을 대가락이라 하였다.',
    bars: { army: 2, grain: 3, militia: 2, terrain: 3 },
  },
  {
    id: 'gj-ado', name: '아도간', place: '김해 북쪽 골 (지음)',
    blurb: '아홉 간 가운데 맏이. 구지봉에 모여 노래하자고 앞장섰다. 가락에 가장 마음이 가까운 마을.',
    source: '『삼국유사』 가락국기: 아도간·여도간·피도간·오도간·유수간·유천간·신천간·오천간·신귀간, 이 아홉 간이 추장이 되어 백성을 거느렸다.',
    bars: { army: 1, grain: 3, militia: 2, terrain: 3 },
  },
  {
    id: 'tahae', name: '탈해', place: '남쪽 바다의 섬 (지음)',
    blurb: '바다 건너 온 사내. 둔갑술을 부리고 쇠촉 무리를 거느린다. 처음엔 섬에서 때를 엿보다가 배를 타고 건너와 왕위를 내놓으라 한다.',
    source: '『삼국유사』 가락국기: 완하국의 탈해가 바다를 따라 와서 왕위를 빼앗으려 하였다. 매와 독수리, 참새와 새매로 둔갑을 겨루다 지자 엎드려 항복하고 배를 타고 달아났다.',
    bars: { army: 3, grain: 2, militia: 1, terrain: 3 },
  },
]

/** 4장을 연다 — 우리는 언제나 가락(수로) */
export function startGujibong(seed: number): Realm {
  const nodes = byId(NODES)
  const edges = byId(EDGES)
  // 한 고을 둘레라 서로 다 안다 — 땅은 처음부터 다 보인다 (안개는 startRegion 이 다시 덮는다)
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
  // 아홉 간은 수로를 왕으로 맞으려 노래한 사람들 — 맏이 셋은 처음부터 화친, 나머지도 마음이 따뜻하다.
  // 탈해는 가락하고만 다툰다 (아홉 간과는 늘 화친 — 마을이 탈해에게 먹혀 목표가 사라지지 않게)
  const relations: Record<string, Relation> = {}
  NINE_GAN.forEach((g, i) => {
    relations[pairKey('garak', g)] = i < 3 ? { state: 'truce', until: null, favor: 35 } : { state: 'neutral', until: null, favor: 15 }
    relations[pairKey('tahae', g)] = { state: 'truce', until: null }
  })
  relations[pairKey('garak', 'tahae')] = { state: 'war', until: null }
  // 허황옥의 배 — 처음부터 망산도 포구에 닿아 머문다 (사서로는 수로왕 7년 · 장의 짧은 때에 맞춰 앞당겼다)
  const wanderers: Wanderer[] = [{ hero: structuredClone(HEO_HWANGOK), node: 'gj-mangsan', until: 36, price: 80 }]
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
    player: 'garak',
    stock,
    relations,
    wanderers,
    poolUsed: ['gj-heo'],
    outcome: null,
    scale: PEOPLE_SCALE,
    region: 'gujibong',
    scenario: chapterScenario('gujibong'),
  }
}
