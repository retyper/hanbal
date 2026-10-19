/**
 * 배우는 판 — 두 나라 1:1 (형 2026-10-19: "맨 위 첫번째 할 게임은 1:1수준으로 여러 기능 익혀가며 쉽게 할수 있어야함.
 * 짜여진대로. 모든기능 하나씩 해볼 수 있게. 적 여장수 포획도 시도하고 이건 튜토리얼급이니 100% 성공하도록").
 *
 * 변한 축소판의 지도 그림·고을 자리를 빌린다 (고을 id 가 같으면 art.NODE_POS 의 자리가 그대로 든다).
 * 골포국(우리) 고을 셋 + 소도 + 빈땅 돌섬 · 가락국(상대) 마을과 도읍. 갈대울–봉황 마을은 들길로 이어 한 계절에 닿는다.
 * 상대 군대는 여인 장수 견지 쇠비가 이끈다 — 사로잡기를 배우는 자리. 이 판에서는 우리 쪽 사로잡기가 반드시 된다(season.sideOf).
 * 상대 AI 는 먼저 치지 않는다 (ai.aiOrders). 이김: 가락 도읍을 쥐면 (season.checkOutcome).
 */
import { PEOPLE_SCALE } from '../../migrate.ts'
import type { Army, Faction, Hero, NodeIntel, REdge, Realm, RNode, Stock, Watch } from '../../types.ts'

const node = (id: string, name: string, kind: RNode['kind'], tags: RNode['tags'], owner: string | null, hh: number): RNode =>
  ({ id, name, kind, tags, owner, hh: hh * PEOPLE_SCALE, sown: hh * PEOPLE_SCALE })

const NODES: RNode[] = [
  node('our-cap', '골포 도읍', 'capital', ['palisade'], 'us', 300),
  node('our-north', '안개골 마을', 'village', ['fog'], 'us', 150),
  node('our-east', '갈대울 마을', 'village', ['reeds'], 'us', 150),
  node('sodo', '큰나무 소도', 'sodo', ['sodo'], null, 0),
  { id: 'wild-dolseom', name: '돌섬', kind: 'wild', tags: [], owner: null, hh: 0, sown: 0, room: 150 * PEOPLE_SCALE },
  // 상대 — 작게 (배우는 판이라 이기기 쉬워야 한다)
  node('guya-vil', '봉황 마을', 'village', [], 'guya', 120),
  node('guya-cap', '가락 도읍', 'port', ['palisade'], 'guya', 180),
]

const e = (id: string, a: string, b: string, kind: REdge['kind'], tags: REdge['tags'] = []): REdge => ({ id, a, b, kind, tags })
const EDGES: REdge[] = [
  e('e01', 'our-cap', 'our-north', 'field'),
  e('e02', 'our-cap', 'our-east', 'field'),
  e('e07', 'our-north', 'sodo', 'forest'),
  e('e34', 'our-cap', 'wild-dolseom', 'sea'),
  e('t01', 'our-east', 'guya-vil', 'field'), // 배우는 판만의 들길 — 한 계절에 닿는다
  e('e10', 'guya-vil', 'guya-cap', 'field'),
]

const FACTIONS: Array<Omit<Faction, 'mind'>> = [
  { id: 'us', name: '골포국', capital: 'our-cap', equip: 'ironTip', ruler: 'us-ruler' },
  { id: 'guya', name: '가락국', capital: 'guya-cap', equip: 'bronze', ruler: 'guya-ruler' },
]

const STOCK: Record<string, Stock> = {
  us: { grain: 400, iron: 30, salt: 20, wood: 40 },
  guya: { grain: 200, iron: 0, wood: 10 },
}

const h = (
  id: string, name: string, faction: string, look: 'g' | 'w',
  [mu, tong, ryak, chi, deok, uiri]: readonly [number, number, number, number, number, number],
  traits: readonly string[], at: string | null = null,
): Hero => ({ id, name, faction, mu, tong, ryak, chi, deok, uiri, traits, look, status: 'free', captor: null, at, post: null })

const HEROES: Hero[] = [
  h('us-ruler', '읍차 해솔', 'us', 'w', [3, 5, 6, 6, 8, 9], ['charm'], 'our-cap'),
  h('chief', '살해 매눈', 'us', 'g', [7, 5, 6, 4, 5, 8], ['archer', 'nighteye']),
  h('us-1', '험측 돌개', 'us', 'g', [5, 5, 4, 6, 4, 7], ['farmer'], 'our-cap'),
  h('guya-ruler', '진지렴 쇠보', 'guya', 'g', [6, 7, 4, 5, 4, 8], ['smith'], 'guya-cap'),
  // 사로잡기를 배우는 상대 장수 — 여인. 무예가 낮아 일기토도 겁낼 것 없다
  h('guya-3', '견지 쇠비', 'guya', 'w', [4, 4, 5, 5, 6, 3], ['ironhand']),
]

const a = (id: string, faction: string, hero: string | null, at: string, mix0: Army['mix'], equip: Army['equip']): Army => {
  const mix = Object.fromEntries(Object.entries(mix0).map(([k, n]) => [k, (n ?? 0) * PEOPLE_SCALE])) as Army['mix']
  return { id, faction, hero, mix, equip, kit: Object.fromEntries(Object.entries(mix).map(([k, n]) => [k, { [equip]: n }])), morale: 1, at, march: null }
}

const ARMIES: Army[] = [
  a('a-us', 'us', 'chief', 'our-east', { spear: 90, bow: 40, shield: 20 }, 'ironTip'),
  a('a-guya', 'guya', 'guya-3', 'guya-vil', { spear: 30, bow: 15 }, 'bronze'),
]

const byId = <T extends { id: string }>(xs: readonly T[]): Record<string, T> => Object.fromEntries(xs.map((x) => [x.id, structuredClone(x)]))

export const TUTORIAL_NATION_IDS: readonly string[] = ['us']

/** 배우는 판을 연다 — 우리는 언제나 골포국 */
export function startTutorial(seed: number): Realm {
  const factions: Faction[] = FACTIONS.map((f) => ({ ...f, mind: f.id === 'us' ? 'player' : 'cautious' }))
  const nodes = byId(NODES)
  const edges = byId(EDGES)
  // 작은 판이라 서로 다 안다 — 땅은 처음부터 다 보인다
  const intel: Realm['intel'] = {}
  for (const f of factions) {
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
    factions: byId(factions),
    heroes: byId(HEROES),
    armies: byId(ARMIES),
    intel,
    watch,
    provoked: [],
    player: 'us',
    stock,
    relations: {},
    outcome: null,
    scale: PEOPLE_SCALE,
    region: 'tutorial',
  }
}
