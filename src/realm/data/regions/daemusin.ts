/**
 * 캠페인 5장 「대무신왕, 부여를 치다」 (docs/realm/CAMPAIGN.md §1 · 형 2026-11-03: "4장 5장도 캠페인 만들어줘").
 *
 * 『삼국사기』 고구려본기 대무신왕 4·5년 — 4년 겨울 왕이 부여를 치러 나섰다. 비류수 가에서 불을 때지 않아도 밥이 되는 솥을 얻고,
 * 이물림에서 금도장과 병기를 얻었다. 북명 사람 괴유와 적곡 사람 마로가 따랐다. 5년 봄 부여 남쪽에 이르니 땅이 진흙 수렁이었다.
 * 부여왕 대소가 쳐들어오다 말이 수렁에 빠져 괴유에게 목이 베였다. 그러나 고구려군도 에워싸여 굶주리다 큰 안개 속에 빠져나왔다.
 *
 * 판 위의 나라는 고구려와 부여 둘뿐 — 그 사이는 임자 없는 들과 숲이다 (형 11-03: "되도록이면 주변국 없는 상태로").
 * 수렁: 부여 도읍 앞 길은 갈대 덮인 여울 — 장마(7·8월)엔 물이 불어 건너지 못하고(calendar.blockedWhy), 갈대에 숨어 들기 좋다.
 * 이김: 부여 도읍을 쥐고 대소왕을 쓰러뜨린다(사로잡거나 베거나). 땅은 국내(지안)에서 송화강 가 부여(지린)까지. 고을·장수 id 는 dm-.
 */
import { PEOPLE_SCALE } from '../../migrate.ts'
import { pairKey } from '../../diplomacy.ts'
import { chapterScenario } from '../campaign.ts'
import type { NationInfo } from '../nations.ts'
import type { Army, Faction, Hero, NodeIntel, REdge, Realm, RNode, Stock, Watch } from '../../types.ts'

const node = (id: string, name: string, kind: RNode['kind'], tags: RNode['tags'], owner: string | null, hh: number): RNode =>
  ({ id, name, kind, tags, owner, hh: hh * PEOPLE_SCALE, sown: hh * PEOPLE_SCALE })
const wild = (id: string, name: string, room: number, tags: RNode['tags'] = []): RNode => ({ id, name, kind: 'wild', tags, owner: null, hh: 0, sown: 0, room: room * PEOPLE_SCALE })

/** 고을 자리 [경도, 위도] */
export const DAEMUSIN_PLACES: Readonly<Record<string, readonly [number, number]>> = {
  'dm-gungnae-cap': [126.18, 41.13], // 국내 위나암성 — 지린 지안 [설]
  'dm-jolbon': [125.4, 41.32], // 졸본 옛 도읍 — 환런 [설]
  'dm-biryusu': [125.95, 41.85], // 비류수(혼강) 가 — 솥을 얻은 곳 [지음]
  'dm-imul': [126.2, 42.45], // 이물림 — 금도장과 병기를 얻은 숲 [지음]
  'dm-bukmyeong': [126.95, 42.9], // 북명 — 괴유의 고장 [지음]
  'dm-jeokgok': [125.75, 42.85], // 적곡 — 마로의 고장 [지음]
  'dm-mire': [126.45, 43.45], // 부여 남쪽 진흙 수렁 [지음]
  'dm-buyeo-cap': [126.55, 43.85], // 부여 도읍 — 지린 동단산 [설]
  'dm-buyeo-west': [125.85, 43.6], // 부여 서쪽 목장 마을 [지음]
  'dm-buyeo-east': [127.1, 43.75], // 부여 동쪽 송화강 마을 [지음]
}

const NODES: RNode[] = [
  // 고구려 — 국내로 도읍을 옮긴 지 스무 해 가까이. 옛 도읍 졸본까지 두 고을
  node('dm-gungnae-cap', '국내 도읍', 'capital', ['high', 'palisade'], 'goguryeo', 260),
  node('dm-jolbon', '졸본 옛 도읍', 'village', ['high'], 'goguryeo', 120),
  // 임자 없는 들과 숲 — 부여로 가는 길
  wild('dm-biryusu', '비류수 가', 120),
  wild('dm-imul', '이물림', 100, ['pines']),
  wild('dm-bukmyeong', '북명 들', 110),
  wild('dm-jeokgok', '적곡 골', 100),
  wild('dm-mire', '부여 남쪽 수렁', 80, ['reeds', 'fog']),
  // 부여 — 송화강 가의 오랜 나라
  node('dm-buyeo-cap', '부여 도읍', 'capital', ['palisade'], 'buyeo', 280),
  node('dm-buyeo-west', '부여 서쪽 목장', 'village', ['pasture'], 'buyeo', 120),
  node('dm-buyeo-east', '송화강 마을', 'village', ['shallows'], 'buyeo', 100),
]

const e = (id: string, a: string, b: string, kind: REdge['kind'], tags: REdge['tags'] = []): REdge => ({ id, a, b, kind, tags })
const EDGES: REdge[] = [
  e('d01', 'dm-gungnae-cap', 'dm-jolbon', 'forest'),
  e('d02', 'dm-gungnae-cap', 'dm-biryusu', 'forest'),
  e('d03', 'dm-jolbon', 'dm-biryusu', 'ford'), // 비류수를 거슬러
  e('d04', 'dm-biryusu', 'dm-imul', 'forest'),
  e('d05', 'dm-biryusu', 'dm-jeokgok', 'field'),
  e('d06', 'dm-imul', 'dm-bukmyeong', 'forest'),
  e('d07', 'dm-imul', 'dm-mire', 'field'),
  e('d08', 'dm-jeokgok', 'dm-buyeo-west', 'field'),
  e('d09', 'dm-bukmyeong', 'dm-buyeo-east', 'field'),
  e('d10', 'dm-mire', 'dm-buyeo-cap', 'ford', ['reeds']), // 진흙 수렁 — 장마엔 못 건넌다
  e('d11', 'dm-buyeo-west', 'dm-buyeo-cap', 'field'),
  e('d12', 'dm-buyeo-east', 'dm-buyeo-cap', 'field'),
  e('d13', 'dm-jeokgok', 'dm-mire', 'field'),
]

const FACTIONS: Faction[] = [
  { id: 'goguryeo', name: '고구려', capital: 'dm-gungnae-cap', equip: 'ironTip', ruler: 'dm-daemusin', mind: 'player' },
  { id: 'buyeo', name: '부여', capital: 'dm-buyeo-cap', equip: 'ironTip', ruler: 'dm-daeso', mind: 'greedy' },
]

const STOCK: Record<string, Stock> = {
  goguryeo: { grain: 420, iron: 20, wood: 40, horse: 12 },
  buyeo: { grain: 360, iron: 15, wood: 30, horse: 16 },
}

const h = (
  id: string, name: string, faction: string, look: 'g' | 'w',
  [mu, tong, ryak, chi, deok, uiri]: readonly [number, number, number, number, number, number],
  traits: readonly string[], at: string | null = null,
): Hero => ({ id, name, faction, mu, tong, ryak, chi, deok, uiri, traits, look, status: 'free', captor: null, at, post: null })

// 대무신왕 · 괴유 · 마로 · 대소는 사서의 사람 (괴유·마로는 사서로는 가는 길에 따랐다 — 판에서는 처음부터 함께 간다).
// 궁수 미르와 부여의 두 장수는 지어낸 사람
const HEROES: Hero[] = [
  h('dm-daemusin', '대무신왕', 'goguryeo', 'g', [8, 8, 8, 6, 7, 9], ['charm'], 'dm-gungnae-cap'),
  h('dm-gwaeyu', '괴유', 'goguryeo', 'g', [10, 6, 4, 3, 5, 10], ['ironhand']),
  h('dm-maro', '마로', 'goguryeo', 'g', [7, 6, 6, 4, 5, 9], ['mountain']),
  h('dm-mir', '궁수 미르', 'goguryeo', 'w', [7, 6, 5, 4, 5, 8], ['archer']),
  h('dm-daeso', '대소', 'buyeo', 'g', [7, 6, 5, 5, 3, 6], ['glutton'], 'dm-buyeo-cap'),
  h('dm-buyeo-1', '마가 너른', 'buyeo', 'g', [7, 7, 5, 4, 4, 7], ['ironhand']),
  h('dm-buyeo-2', '사냥꾼 다래', 'buyeo', 'w', [6, 5, 6, 4, 5, 7], ['archer']),
]

const a = (id: string, faction: string, hero: string | null, at: string, mix0: Army['mix'], equip: Army['equip']): Army => {
  const mix = Object.fromEntries(Object.entries(mix0).map(([k, n]) => [k, (n ?? 0) * PEOPLE_SCALE])) as Army['mix']
  return { id, faction, hero, mix, equip, kit: Object.fromEntries(Object.entries(mix).map(([k, n]) => [k, { [equip]: n }])), morale: 1, at, march: null }
}

const ARMIES: Army[] = [
  // 고구려 — 부여를 치러 나설 무리. 괴유가 앞장선다
  a('a-dm-us', 'goguryeo', 'dm-gwaeyu', 'dm-gungnae-cap', { spear: 70, bow: 50, horse: 25 }, 'ironTip'),
  a('a-dm-us2', 'goguryeo', 'dm-maro', 'dm-gungnae-cap', { spear: 40, bow: 30 }, 'ironTip'),
  a('a-dm-jolbon', 'goguryeo', 'dm-mir', 'dm-jolbon', { spear: 20, bow: 20 }, 'ironTip'),
  a('a-dm-guard', 'goguryeo', null, 'dm-gungnae-cap', { spear: 25, bow: 25 }, 'ironTip'), // 도읍을 지키는 무리 — 왕이 멀리 나가도 산성은 남는다
  // 부여 — 말이 많다. 군사는 도읍과 두 마을에 흩어져 있다
  a('a-dm-buyeo', 'buyeo', 'dm-buyeo-1', 'dm-buyeo-cap', { spear: 50, bow: 25, horse: 25 }, 'ironTip'),
  a('a-dm-buyeo-cap', 'buyeo', null, 'dm-buyeo-cap', { spear: 25, bow: 15 }, 'bronze'),
  a('a-dm-buyeo-west', 'buyeo', 'dm-buyeo-2', 'dm-buyeo-west', { spear: 20, bow: 15, horse: 10 }, 'bronze'),
]

const byId = <T extends { id: string }>(xs: readonly T[]): Record<string, T> => Object.fromEntries(xs.map((x) => [x.id, structuredClone(x)]))

export const DAEMUSIN_NATION_IDS: readonly string[] = ['goguryeo']

/** 5장 나라 소개 — 그 시대(기원후 22년) 그대로 */
export const DAEMUSIN_NATIONS: readonly NationInfo[] = [
  {
    id: 'goguryeo', name: '고구려', place: '국내 위나암성: 지린 지안 (설)',
    blurb: '주몽의 손자 무휼이 다스리는 압록강 골짜기의 나라. 땅은 국내와 옛 도읍 졸본뿐이지만 산성이 높고 장수가 날래다. 부여까지는 멀다.',
    source: '『삼국사기』 고구려본기: 대무신왕은 나면서부터 슬기롭고 자라서는 씩씩하며 큰 꾀가 있었다. 4년 겨울 12월 군사를 내어 부여를 쳤다.',
    bars: { army: 3, grain: 3, militia: 3, terrain: 4 },
  },
  {
    id: 'buyeo', name: '부여', place: '송화강 가: 지린 (설)',
    blurb: '대소왕의 부여. 말이 많고 들이 넓다. 고구려를 제 아래로 여겨 왔다. 도읍 남쪽은 진흙 수렁이라 장마철엔 건너기 어렵다.',
    source: '『삼국사기』 고구려본기: 부여왕 대소가 온 나라 군사를 내어 나오다가, 말이 진흙 수렁에 빠져 나오지 못하자 괴유가 칼을 빼어 목을 베었다.',
    bars: { army: 4, grain: 3, militia: 3, terrain: 3 },
  },
]

/** 5장을 연다 — 우리는 언제나 고구려(대무신왕) */
export function startDaemusin(seed: number): Realm {
  const nodes = byId(NODES)
  const edges = byId(EDGES)
  // 두 나라는 서로 잘 안다 — 땅은 처음부터 다 보인다 (안개는 startRegion 이 다시 덮는다)
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
    player: 'goguryeo',
    stock,
    // 처음부터 싸우는 사이 — 대무신왕이 부여를 치러 나선다
    relations: { [pairKey('goguryeo', 'buyeo')]: { state: 'war', until: null } },
    outcome: null,
    scale: PEOPLE_SCALE,
    region: 'daemusin',
    scenario: chapterScenario('daemusin'),
  }
}
