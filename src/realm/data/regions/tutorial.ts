/**
 * 배우는 판 — 두 나라 1:1 (형 2026-10-19: "맨 위 첫번째 할 게임은 1:1수준으로 여러 기능 익혀가며 쉽게 할수 있어야함.
 * 짜여진대로. 모든기능 하나씩 해볼 수 있게. 적 여장수 포획도 시도하고 이건 튜토리얼급이니 100% 성공하도록").
 *
 * 익숙한 이름으로 (형 2026-10-22: "튜토리얼과 초반게임은 익숙한 고구려 백제 이런걸로 … 안익숙한 이름들 너무많아서 나라 이해하기도 너무 어려웠음").
 * 『삼국사기』 백제본기 시조 온조왕 — 졸본 부여에서 내려온 형제 가운데 형 비류는 바닷가 미추홀에, 아우 온조는 하남 위례성에 자리 잡았다.
 * 땅은 실제 한강 아래(서울–인천) — 삼한 남부 판의 지도 조각(m2)을 좁게 잘라 쓴다 (tutorial-geo.ts). 나라는 그 판의 백제·미추홀이라 깃발·소개가 같다.
 * 백제(우리) 고을 셋 + 소도 + 빈땅 솔뫼 · 미추홀(상대) 마을과 도읍. 갈대울–갯골 마을은 들길로 이어 한 계절에 닿는다.
 * 상대 군대는 여인 장수 해비가 이끈다 — 사로잡기를 배우는 자리. 이 판에서는 우리 쪽 사로잡기가 반드시 된다(season.sideOf).
 * 상대 AI 는 먼저 치지 않는다 (ai.aiOrders). 이김: 미추홀 도읍을 쥐면 (season.checkOutcome).
 * 고을·장수 id 는 tut- — 다른 판의 같은 이름과 엉키지 않게 (지금의 지명 · 명치판 그림이 id 로 붙는다).
 */
import { PEOPLE_SCALE } from '../../migrate.ts'
import { chapterScenario } from '../campaign.ts'
import type { Army, Faction, Hero, NodeIntel, REdge, Realm, RNode, Stock, Watch } from '../../types.ts'

const node = (id: string, name: string, kind: RNode['kind'], tags: RNode['tags'], owner: string | null, hh: number): RNode =>
  ({ id, name, kind, tags, owner, hh: hh * PEOPLE_SCALE, sown: hh * PEOPLE_SCALE })

/** 고을 자리 [경도, 위도] — 한강 아래 */
export const TUTORIAL_PLACES: Readonly<Record<string, readonly [number, number]>> = {
  'tut-wirye-cap': [127.12, 37.53], // 하남 위례성 [설] — 풍납토성 자리
  'tut-acha': [127.22, 37.63], // 아차산 기슭
  'tut-galdae': [126.93, 37.57], // 한강 아래 갈대밭
  'tut-sodo': [127.3, 37.76], // 북한강 쪽 산골
  'tut-solmoe': [127.17, 37.42], // 남한산 기슭 빈땅
  'tut-gaetgol': [126.79, 37.5], // 갯가 마을
  'tut-michuhol-cap': [126.67, 37.44], // 인천 문학산 [설] — 백제본기 비류의 미추홀
}

const NODES: RNode[] = [
  node('tut-wirye-cap', '위례 도읍', 'capital', ['palisade'], 'baekje', 300),
  node('tut-acha', '아차 마을', 'village', ['fog'], 'baekje', 150),
  node('tut-galdae', '갈대울 마을', 'village', ['reeds'], 'baekje', 150),
  node('tut-sodo', '큰나무 소도', 'sodo', ['sodo'], null, 0),
  { id: 'tut-solmoe', name: '솔뫼', kind: 'wild', tags: [], owner: null, hh: 0, sown: 0, room: 150 * PEOPLE_SCALE },
  // 상대 — 작게 (배우는 판이라 이기기 쉬워야 한다)
  node('tut-gaetgol', '갯골 마을', 'village', [], 'michuhol', 120),
  node('tut-michuhol-cap', '미추홀 도읍', 'port', ['palisade'], 'michuhol', 180),
]

const e = (id: string, a: string, b: string, kind: REdge['kind'], tags: REdge['tags'] = []): REdge => ({ id, a, b, kind, tags })
const EDGES: REdge[] = [
  e('e01', 'tut-wirye-cap', 'tut-acha', 'field'),
  e('e02', 'tut-wirye-cap', 'tut-galdae', 'field'),
  e('e07', 'tut-acha', 'tut-sodo', 'forest'),
  e('e34', 'tut-wirye-cap', 'tut-solmoe', 'ford'), // 한강을 건너 남한산 기슭
  e('t01', 'tut-galdae', 'tut-gaetgol', 'field'), // 들길 — 한 계절에 닿는다
  e('e10', 'tut-gaetgol', 'tut-michuhol-cap', 'field'),
]

const FACTIONS: Array<Omit<Faction, 'mind'>> = [
  { id: 'baekje', name: '백제', capital: 'tut-wirye-cap', equip: 'ironTip', ruler: 'tut-onjo' },
  { id: 'michuhol', name: '미추홀', capital: 'tut-michuhol-cap', equip: 'bronze', ruler: 'tut-biryu' },
]

const STOCK: Record<string, Stock> = {
  baekje: { grain: 400, iron: 30, salt: 20, wood: 40 },
  michuhol: { grain: 200, iron: 0, wood: 10 },
}

const h = (
  id: string, name: string, faction: string, look: 'g' | 'w',
  [mu, tong, ryak, chi, deok, uiri]: readonly [number, number, number, number, number, number],
  traits: readonly string[], at: string | null = null,
): Hero => ({ id, name, faction, mu, tong, ryak, chi, deok, uiri, traits, look, status: 'free', captor: null, at, post: null })

// 온조와 함께 내려온 열 신하 가운데 오간·마려 (백제본기) · 비류 · 해비는 지어낸 미추홀의 여인 장수
const HEROES: Hero[] = [
  h('tut-onjo', '온조', 'baekje', 'g', [5, 6, 7, 6, 8, 9], ['charm'], 'tut-wirye-cap'),
  h('tut-ogan', '오간', 'baekje', 'g', [7, 5, 6, 4, 5, 8], ['archer', 'nighteye']),
  h('tut-maryeo', '마려', 'baekje', 'g', [5, 5, 4, 6, 4, 7], ['farmer'], 'tut-wirye-cap'),
  h('tut-biryu', '비류', 'michuhol', 'g', [6, 7, 4, 5, 4, 8], ['smith'], 'tut-michuhol-cap'),
  // 사로잡기를 배우는 상대 장수 — 여인. 무예가 낮아 일기토도 겁낼 것 없다
  h('tut-haebi', '해비', 'michuhol', 'w', [4, 4, 5, 5, 6, 3], ['ironhand']),
]

const a = (id: string, faction: string, hero: string | null, at: string, mix0: Army['mix'], equip: Army['equip']): Army => {
  const mix = Object.fromEntries(Object.entries(mix0).map(([k, n]) => [k, (n ?? 0) * PEOPLE_SCALE])) as Army['mix']
  return { id, faction, hero, mix, equip, kit: Object.fromEntries(Object.entries(mix).map(([k, n]) => [k, { [equip]: n }])), morale: 1, at, march: null }
}

const ARMIES: Army[] = [
  a('a-us', 'baekje', 'tut-ogan', 'tut-galdae', { spear: 90, bow: 40, shield: 20 }, 'ironTip'),
  a('a-guya', 'michuhol', 'tut-haebi', 'tut-gaetgol', { spear: 30, bow: 15 }, 'bronze'),
]

const byId = <T extends { id: string }>(xs: readonly T[]): Record<string, T> => Object.fromEntries(xs.map((x) => [x.id, structuredClone(x)]))

export const TUTORIAL_NATION_IDS: readonly string[] = ['baekje']

/** 배우는 판을 연다 — 우리는 언제나 백제(온조) */
export function startTutorial(seed: number): Realm {
  const factions: Faction[] = FACTIONS.map((f) => ({ ...f, mind: f.id === 'baekje' ? 'player' : 'cautious' }))
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
    player: 'baekje',
    stock,
    relations: {},
    outcome: null,
    scale: PEOPLE_SCALE,
    region: 'tutorial',
    scenario: chapterScenario('brothers'),
  }
}
