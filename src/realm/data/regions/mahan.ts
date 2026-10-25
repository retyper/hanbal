/**
 * 캠페인 1장 「온조, 마한을 아우르다」 — 1:1 로 제대로 붙는 첫 판 (형 2026-10-25: "지금 튜토리얼은 0장으로 두고 1장은 1:1로 제대로 싸워보게").
 *
 * 『삼국사기』 백제본기 온조왕 — 26년 가을, 마한이 날로 약해지자 왕은 "남이 먼저 차지하기 전에" 하고 사냥을 핑계로 군사를 내어
 * 마한을 습격해 그 국읍을 아울렀다. 원산·금현 두 성만이 굳게 지키다가 27년 여름에 항복했다.
 * 배우는 판(0장 형제의 강)과 달리 상대가 먼저 친다 — 마한은 크고(고을이 더 많고 쇠도 있다) 백제는 작지만 날래다.
 *
 * 땅은 실제 한강 아래에서 차령 남쪽까지 — 삼한 남부 판의 조각을 좁게 잘라 쓴다 (mahan-geo.ts).
 * 이김: 목지 도읍 · 원산성 · 금현성을 쥔다 (scenario · campaign.ts). 위례 도읍을 잃으면 진다.
 * 고을·장수 id 는 mh- — 다른 판의 같은 이름과 엉키지 않게. 마한은 넓은 판의 목지국 깃발을 그대로 쓴다(id mokji).
 */
import { PEOPLE_SCALE } from '../../migrate.ts'
import { pairKey } from '../../diplomacy.ts'
import { chapterScenario } from '../campaign.ts'
import type { NationInfo } from '../nations.ts'
import type { Army, Faction, Hero, NodeIntel, REdge, Realm, RNode, Stock, Watch } from '../../types.ts'

const node = (id: string, name: string, kind: RNode['kind'], tags: RNode['tags'], owner: string | null, hh: number): RNode =>
  ({ id, name, kind, tags, owner, hh: hh * PEOPLE_SCALE, sown: hh * PEOPLE_SCALE })
const wild = (id: string, name: string, room: number): RNode => ({ id, name, kind: 'wild', tags: [], owner: null, hh: 0, sown: 0, room: room * PEOPLE_SCALE })

/** 고을 자리 [경도, 위도] */
export const MAHAN_PLACES: Readonly<Record<string, readonly [number, number]>> = {
  'mh-wirye-cap': [127.12, 37.53], // 하남 위례성 [설] — 풍납토성 자리
  'mh-hannaru': [126.92, 37.56], // 한강 나루
  'mh-namhan': [127.19, 37.42], // 남한산 기슭
  'mh-sodo': [127.38, 37.68], // 북한강 쪽 산골
  'mh-handeul': [127.03, 37.24], // 한내 들 — 수원·오산 [지음]
  'mh-jinwi': [127.1, 37.04], // 진위 마을 — 평택 진위 [지음]
  'mh-mokji-cap': [127.17, 36.88], // 천안 직산 [설] — 마한 목지국, 진왕의 자리
  'mh-asan': [126.93, 36.85], // 아산만 포구
  'mh-wonsan': [126.8, 36.66], // 원산성 — 예산 [설]
  'mh-geumhyeon': [127.32, 36.62], // 금현성 — 연기·전의 [설]
}

const NODES: RNode[] = [
  // 백제 — 위례에 선 지 스물여섯 해 (작지만 단단하다)
  node('mh-wirye-cap', '위례 도읍', 'capital', ['palisade'], 'baekje', 320),
  node('mh-hannaru', '한강 나루 마을', 'village', ['shallows'], 'baekje', 150),
  node('mh-namhan', '남한산 마을', 'village', ['high'], 'baekje', 140),
  node('mh-sodo', '큰나무 소도', 'sodo', ['sodo'], null, 0),
  wild('mh-handeul', '한내 들', 160),
  // 마한 — 진왕의 목지국이 이끄는 큰 나라. 고을이 많다
  node('mh-jinwi', '진위 마을', 'village', [], 'mokji', 150),
  node('mh-mokji-cap', '목지 도읍', 'capital', ['palisade'], 'mokji', 360),
  node('mh-asan', '아산만 포구', 'port', [], 'mokji', 170),
  node('mh-wonsan', '원산성', 'fort', ['palisade', 'high'], 'mokji', 160),
  node('mh-geumhyeon', '금현성', 'fort', ['palisade', 'pines'], 'mokji', 150),
]

const e = (id: string, a: string, b: string, kind: REdge['kind'], tags: REdge['tags'] = []): REdge => ({ id, a, b, kind, tags })
const EDGES: REdge[] = [
  e('h01', 'mh-wirye-cap', 'mh-hannaru', 'field'),
  e('h02', 'mh-wirye-cap', 'mh-namhan', 'ford'), // 한강을 건너 남한산 기슭
  e('h03', 'mh-wirye-cap', 'mh-sodo', 'forest'),
  e('h04', 'mh-namhan', 'mh-handeul', 'field'),
  e('h05', 'mh-hannaru', 'mh-handeul', 'field'),
  e('h06', 'mh-handeul', 'mh-jinwi', 'field'), // 두 나라의 경계 — 마한이 올라오는 길
  e('h07', 'mh-jinwi', 'mh-mokji-cap', 'field'),
  e('h08', 'mh-hannaru', 'mh-asan', 'sea'), // 바닷길 — 서해 갯가를 따라 아산만으로
  e('h09', 'mh-mokji-cap', 'mh-asan', 'field'),
  e('h10', 'mh-asan', 'mh-wonsan', 'field'),
  e('h11', 'mh-mokji-cap', 'mh-geumhyeon', 'forest'),
  e('h12', 'mh-wonsan', 'mh-geumhyeon', 'pass'), // 차령 고개
  e('h13', 'mh-namhan', 'mh-geumhyeon', 'pass'), // 산줄기를 타고 내려가는 먼 길
]

const FACTIONS: Faction[] = [
  { id: 'baekje', name: '백제', capital: 'mh-wirye-cap', equip: 'ironTip', ruler: 'mh-onjo', mind: 'player' },
  // 마한은 먼저 친다 — 백제를 제 울타리 안 작은 나라로 본다
  { id: 'mokji', name: '마한', capital: 'mh-mokji-cap', equip: 'ironTip', ruler: 'mh-jinwang', mind: 'greedy' },
]

const STOCK: Record<string, Stock> = {
  baekje: { grain: 360, iron: 20, salt: 10, wood: 40, horse: 4 },
  mokji: { grain: 420, iron: 20, salt: 20, wood: 40, horse: 4 },
}

const h = (
  id: string, name: string, faction: string, look: 'g' | 'w',
  [mu, tong, ryak, chi, deok, uiri]: readonly [number, number, number, number, number, number],
  traits: readonly string[], at: string | null = null,
): Hero => ({ id, name, faction, mu, tong, ryak, chi, deok, uiri, traits, look, status: 'free', captor: null, at, post: null })

// 온조 · 을음(온조왕 2년 우보로 삼은 족부) · 오간·마려(열 신하) · 소서노(온조의 어머니, 백제본기 주석)는 사서의 사람.
// 마한의 진왕과 장수들은 지어낸 이름 (사서는 이름을 남기지 않았다)
const HEROES: Hero[] = [
  h('mh-onjo', '온조', 'baekje', 'g', [6, 7, 7, 6, 8, 9], ['charm'], 'mh-wirye-cap'),
  h('mh-eureum', '을음', 'baekje', 'g', [6, 6, 8, 6, 5, 9], ['careful']),
  h('mh-ogan', '오간', 'baekje', 'g', [7, 6, 5, 4, 5, 8], ['archer', 'nighteye']),
  h('mh-soseono', '소서노', 'baekje', 'w', [3, 5, 7, 8, 8, 10], ['farmer'], 'mh-wirye-cap'),
  h('mh-jinwang', '진왕 진하', 'mokji', 'w', [4, 6, 7, 7, 8, 9], ['charm'], 'mh-mokji-cap'),
  h('mh-mahan-1', '신지 큰돌', 'mokji', 'g', [7, 6, 5, 4, 4, 8], ['ironhand']),
  h('mh-mahan-2', '원산 지기 달래', 'mokji', 'w', [6, 6, 6, 5, 6, 9], ['mountain']),
  h('mh-mahan-3', '읍차 금바위', 'mokji', 'g', [6, 5, 5, 5, 4, 7], ['careful']),
]

const a = (id: string, faction: string, hero: string | null, at: string, mix0: Army['mix'], equip: Army['equip']): Army => {
  const mix = Object.fromEntries(Object.entries(mix0).map(([k, n]) => [k, (n ?? 0) * PEOPLE_SCALE])) as Army['mix']
  return { id, faction, hero, mix, equip, kit: Object.fromEntries(Object.entries(mix).map(([k, n]) => [k, { [equip]: n }])), morale: 1, at, march: null }
}

const ARMIES: Army[] = [
  a('a-mh-us', 'baekje', 'mh-ogan', 'mh-wirye-cap', { spear: 80, bow: 50, shield: 20, horse: 10 }, 'ironTip'),
  a('a-mh-us2', 'baekje', 'mh-eureum', 'mh-namhan', { spear: 40, bow: 30 }, 'ironTip'),
  // 마한 — 군사는 더 많지만 여러 성에 흩어져 있다. 진위로 올라오는 무리가 먼저 친다
  a('a-mh-front', 'mokji', 'mh-mahan-1', 'mh-jinwi', { spear: 70, bow: 40, shield: 10 }, 'ironTip'),
  a('a-mh-cap', 'mokji', null, 'mh-mokji-cap', { spear: 50, bow: 30 }, 'bronze'),
  a('a-mh-wonsan', 'mokji', 'mh-mahan-2', 'mh-wonsan', { spear: 40, bow: 40 }, 'bronze'),
  a('a-mh-geum', 'mokji', 'mh-mahan-3', 'mh-geumhyeon', { spear: 40, bow: 30 }, 'bronze'),
]

const byId = <T extends { id: string }>(xs: readonly T[]): Record<string, T> => Object.fromEntries(xs.map((x) => [x.id, structuredClone(x)]))

export const MAHAN_NATION_IDS: readonly string[] = ['baekje']

/** 1장 나라 소개 — 그 시대(서기 8년) 그대로 */
export const MAHAN_NATIONS: readonly NationInfo[] = [
  {
    id: 'baekje', name: '백제', place: '하남 위례성 — 풍납토성 (설)',
    blurb: '졸본에서 내려온 온조가 세운 지 스물여섯 해. 땅은 한강 아래 몇 고을뿐이지만 쇠촉 화살과 날랜 군사가 있다.',
    source: '『삼국사기』 백제본기 — 온조왕 26년 "마한이 점점 약해지고 위아래 마음이 갈라졌으니 남에게 먹히기 전에 우리가 아우르자."',
    bars: { army: 3, grain: 3, militia: 3, terrain: 3 },
  },
  {
    id: 'mokji', name: '마한', place: '목지국 — 천안 직산 (설)',
    blurb: '쉰 남짓 나라를 거느린 진왕의 마한. 고을과 성이 많고 백제를 제 울타리 안 작은 나라로 본다. 그러나 위아래 마음이 갈라졌다.',
    source: '『삼국사기』 백제본기 — 온조왕 27년 원산·금현 두 성이 항복하니 그 백성을 한산 북쪽으로 옮겼다. 마한이 마침내 없어졌다.',
    bars: { army: 4, grain: 4, militia: 3, terrain: 3 },
  },
]

/** 1장을 연다 — 우리는 언제나 백제(온조) */
export function startMahan(seed: number): Realm {
  const nodes = byId(NODES)
  const edges = byId(EDGES)
  // 두 나라는 서로 잘 안다 — 땅은 처음부터 다 보인다
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
    player: 'baekje',
    stock,
    // 처음부터 싸우는 사이 — 1:1 로 붙는 장이다
    relations: { [pairKey('baekje', 'mokji')]: { state: 'war', until: null } },
    outcome: null,
    scale: PEOPLE_SCALE,
    region: 'mahan',
    scenario: chapterScenario('mahan'),
  }
}
