/**
 * 변한 6국 축소판 — R1 의 판 (docs/realm/BUILD.md §6 · WORLD §4 · FLOW §3)
 *
 * **나라 이름은 우리 역사책이 먼저다** (형: "가장 중요한 건 한국사 기록이야" — 2026-10-18). 『삼국사기』·『삼국유사』의 이름을 쓰고,
 * 위서 동이전 변진조의 이름은 곁들임으로만 (data/nations.ts 의 source):
 *   가락국 (『삼국유사』 가락국기 · 위서 구야국) · 아라국 (『삼국사기』 지리지 함안 "본래 아시량국" · 위서 안야국) ·
 *   추화국 (『삼국사기』 지리지 밀양 "본래 추화군" — 나라 이름은 [설] · 위서 미리미동국) ·
 *   고자국 (『삼국사기』 지리지 고성 "본래 고자군" · 포상팔국의 고사포 · 위서 고자미동국) ·
 *   거칠산국 (『삼국사기』 거도전 · 지리지 동래 "본래 거칠산군" · 위서 독로국[설]) ·
 *   골포국 (『삼국사기』 물계자전·신라본기 나해이사금의 포상팔국 · 지금의 마산[설]).
 * 장수 이름은 지어낸다 — 사료의 칭호만 쓰고 실존 인물은 쓰지 않는다 (BUILD §8 Q6).
 *
 * FLOW §3 (2026-10-18): **여섯 나라 모두 고를 수 있다.** 잘하는 것이 하나씩 다르고 합은 비슷하게 —
 *   가락 군사·철 · 아라 지형 · 추화 곡창·장정 · 고자 바다·교역 · 거칠산 바다 너머 교역·센 장수 · 골포 작은 나라(어려움, 군장이 세다)
 * (판 안의 세력 id 는 옛 이름 그대로다 — guya·anya·miri·goja·dokro·us. 옛 저장과 시험이 그 id 를 쓴다)
 * 숫자(가호·병력·창고)는 봇 대전(tools/realm-sim.ts --as all)으로 맞춘 초안이다. 판의 크기 감은 PLAY §4 대본:
 * 북쪽 읍락 병력 120~180, 큰 나라는 그 두세 배.
 */
import { PEOPLE_SCALE } from '../../migrate.ts'
import type { Army, Faction, Hero, Mind, NodeIntel, REdge, Realm, RNode, Stock, Watch } from '../../types.ts'

// 아래의 집·품·군사 수는 옛 눈금으로 적고 PEOPLE_SCALE 배로 연다 (migrate.ts — 위서 동이전의 규모에 맞춘다)
const node = (id: string, name: string, kind: RNode['kind'], tags: RNode['tags'], owner: string | null, hh: number): RNode =>
  ({ id, name, kind, tags, owner, hh: hh * PEOPLE_SCALE, sown: hh * PEOPLE_SCALE })
const wild = (id: string, name: string, tags: RNode['tags'], room: number): RNode =>
  ({ id, name, kind: 'wild', tags, owner: null, hh: 0, sown: 0, room: room * PEOPLE_SCALE })

const NODES: RNode[] = [
  // 골포국 骨浦 — 포상팔국의 하나 (『삼국사기』 물계자전), 지금의 마산 [설] · 남쪽 바닷가 작은 나라 (도읍 하나 · 마을 둘)
  node('our-cap', '골포 도읍', 'capital', ['palisade'], 'us', 300),
  node('our-north', '안개골 마을', 'village', ['fog'], 'us', 150),
  node('our-east', '갈대울 마을', 'village', ['reeds'], 'us', 150),
  // 가락국 駕洛 — 김해 (『삼국유사』 가락국기 · 위서 구야국) · 고김해만 · 철 · 변한의 큰 나라
  node('guya-cap', '가락 도읍', 'port', ['palisade', 'high'], 'guya', 550),
  node('guya-iron', '붉은산 철광', 'ironMine', ['iron'], 'guya', 150),
  node('guya-vil', '봉황 마을', 'village', [], 'guya', 250),
  // 아라국 阿羅 — 함안 (『삼국사기』 지리지 "본래 아시량국" · 위서 안야국) · 남강 · 산성과 고개로 막힌 땅
  node('anya-cap', '아라 도읍', 'capital', ['palisade', 'high'], 'anya', 450),
  node('anya-fort', '남강 산성', 'fort', ['high'], 'anya', 100),
  node('anya-vil', '솔숲 마을', 'village', ['pines'], 'anya', 250),
  // 추화국 推火 — 밀양 (『삼국사기』 지리지 "본래 추화군" — 나라 이름은 [설] · 위서 미리미동국) · 낙동강 가 농사
  node('miri-cap', '추화 도읍', 'capital', ['palisade', 'moat'], 'miri', 750),
  node('miri-vil', '여울목 마을', 'village', ['reeds', 'shallows'], 'miri', 450),
  // 고자국 古自 — 고성 (『삼국사기』 지리지 "본래 고자군" · 포상팔국 고사포 · 위서 고자미동국) · 남해 포구
  node('goja-cap', '고자 도읍', 'port', ['palisade'], 'goja', 500),
  node('goja-vil', '갯벌 마을', 'village', [], 'goja', 300),
  // 거칠산국 居柒山 — 동래 (『삼국사기』 거도전 · 지리지 "본래 거칠산군" · 위서 독로국[설]) · 바다 건너와 맞댄다
  // 솔숲 — 도읍 뒤 금정산의 솔숲에서 나무가 난다 (봇 대전: 거칠산은 나무가 없어 개척·배가 막혀 짐 11%. 빈땅을 따로 두면 사람이 빠져 도읍이 얇아졌다)
  node('dokro-cap', '거칠산 도읍', 'port', ['palisade', 'pines'], 'dokro', 600),
  // 소도 — 누구의 땅도 아니다. 침범 금지 (SYSTEMS §8-4) [사료]
  node('sodo', '큰나무 소도', 'sodo', ['sodo'], null, 0),
  // 빈땅 — 아무도 안 산다. 사람을 보내 개척하면 품(room)까지 빨리 큰다 (FLOW §2). 나라 사이 길이 여럿이 된다
  wild('wild-galmae', '갈매봉 기슭', ['pines'], 200),
  wild('wild-beodeul', '버들내 들', ['reeds'], 300),
  wild('wild-gomgol', '곰골', ['high'], 150),
  wild('wild-neoreun', '너른벌', ['pasture'], 250), // 낙동강 하구의 너른 들 — 일구면 말을 친다
  wild('wild-seobu', '쇠골 갯가', [], 200),
  wild('wild-keunseom', '큰섬', ['fog'], 180),
  wild('wild-dolseom', '돌섬', [], 150),
]

const e = (id: string, a: string, b: string, kind: REdge['kind'], tags: REdge['tags'] = []): REdge => ({ id, a, b, kind, tags })

/**
 * 길 (2026-10-18 형: "공격루트가 고을사이 너무 단순한거 아님?") — 빈땅 일곱을 사이에 끼워 나라 사이 길을 여럿으로.
 * 가락 국읍이 국읍 셋과 바로 붙어 혼자 셌다 (봇 대전 이김 33%): 골포 뱃길(옛 e04)은 돌섬을 거치고,
 * 철산은 국읍이 아니라 봉황 읍락에 붙고(e11), 철산–거칠산 고개(옛 e13)는 너른벌을, 남강 산성–추화 나루(옛 e18)는 버들내를 거친다.
 * 지운 id 는 다시 쓰지 않는다 — 옛 저장·기록과 섞이지 않게.
 */
const EDGES: REdge[] = [
  e('e01', 'our-cap', 'our-north', 'field'),
  e('e02', 'our-cap', 'our-east', 'field'),
  e('e03', 'our-cap', 'goja-vil', 'sea'),
  e('e05', 'our-north', 'anya-cap', 'field'),
  e('e06', 'our-north', 'miri-vil', 'ford', ['reeds']), // 낙동강 갈대 나루 — PLAY §4 의 그 나루
  e('e07', 'our-north', 'sodo', 'forest'),
  e('e08', 'our-east', 'miri-vil', 'reeds'),
  e('e09', 'our-east', 'guya-vil', 'mudflat'),
  e('e10', 'guya-vil', 'guya-cap', 'field'),
  e('e11', 'guya-vil', 'guya-iron', 'pass'),
  e('e12', 'guya-cap', 'dokro-cap', 'sea'),
  e('e14', 'guya-iron', 'miri-cap', 'forest'),
  e('e15', 'miri-vil', 'miri-cap', 'field'),
  e('e16', 'miri-vil', 'sodo', 'reeds'),
  e('e17', 'anya-cap', 'anya-fort', 'pass'),
  e('e19', 'anya-cap', 'anya-vil', 'forest'),
  e('e20', 'anya-vil', 'goja-cap', 'pass'),
  e('e21', 'goja-cap', 'goja-vil', 'field'),
  // 빈땅을 지나는 길
  e('e22', 'anya-vil', 'wild-galmae', 'forest'),
  e('e23', 'wild-galmae', 'anya-fort', 'pass'),
  e('e24', 'sodo', 'wild-beodeul', 'forest'),
  e('e25', 'miri-cap', 'wild-gomgol', 'pass'),
  e('e26', 'wild-gomgol', 'guya-iron', 'pass'),
  e('e27', 'guya-iron', 'wild-neoreun', 'pass'),
  e('e28', 'wild-neoreun', 'guya-vil', 'field'),
  e('e29', 'wild-neoreun', 'dokro-cap', 'field'),
  e('e30', 'anya-vil', 'wild-seobu', 'field'),
  e('e31', 'wild-seobu', 'goja-cap', 'field'),
  e('e32', 'goja-cap', 'wild-keunseom', 'sea'),
  e('e33', 'goja-vil', 'wild-keunseom', 'sea'),
  e('e34', 'our-cap', 'wild-dolseom', 'sea'),
  e('e35', 'wild-dolseom', 'guya-cap', 'sea'),
  e('e37', 'anya-fort', 'wild-beodeul', 'field'),
  e('e38', 'wild-beodeul', 'miri-cap', 'ford'), // 남강이 낙동강에 드는 나루
]

/** 나라마다: AI 일 때의 성향 · 새 군사의 장비 · 바깥 교역 · 시작 창고 */
interface NationStart {
  readonly faction: Omit<Faction, 'mind'>
  readonly mind: Exclude<Mind, 'player'>
  readonly stock: Stock
}

const NATION_STARTS: readonly NationStart[] = [
  { faction: { id: 'us', name: '골포국', capital: 'our-cap', equip: 'ironTip' }, mind: 'cautious', stock: { grain: 150, iron: 0, salt: 20, wood: 30 } },
  // 시작 창고는 첫 가을까지 군대를 먹일 만큼 (봄·여름·가을 세 계절치 남짓) — 모자라면 첫해부터 굶는다 (봇 대전에서 잡혔다)
  { faction: { id: 'guya', name: '가락국', capital: 'guya-cap', equip: 'iron' }, mind: 'greedy', stock: { grain: 280, iron: 40, salt: 15, wood: 30 } },
  { faction: { id: 'anya', name: '아라국', capital: 'anya-cap', equip: 'ironTip' }, mind: 'cautious', stock: { grain: 210, iron: 10, wood: 40 } },
  { faction: { id: 'miri', name: '추화국', capital: 'miri-cap', equip: 'bronze' }, mind: 'cautious', stock: { grain: 400, iron: 0, wood: 30 } },
  {
    faction: { id: 'goja', name: '고자국', capital: 'goja-cap', equip: 'bronze', income: { grain: 10, iron: 4 } },
    mind: 'greedy',
    stock: { grain: 200, iron: 20, salt: 20, wood: 30 },
  },
  {
    // 「其瀆盧國與倭接界」 — 왜와 거래한다 (FLOW §3)
    faction: { id: 'dokro', name: '거칠산국', capital: 'dokro-cap', equip: 'bronze', income: { grain: 20, iron: 6 } },
    mind: 'greedy',
    stock: { grain: 200, iron: 30, salt: 15, wood: 20, horse: 4 },
  },
]

/**
 * 장수 — 능력치 여섯 (무예·통솔·지략·내정·매력·의리, HEROES §1) · 특성 (data/traits.ts) · 남 g / 여 w.
 * `at` 은 군대 없이 혼자 머무는 고을 (군대를 이끄는 장수는 null — ARMIES 의 hero 로 정해진다).
 */
const h = (
  id: string, name: string, faction: string, look: 'g' | 'w',
  [mu, tong, ryak, chi, deok, uiri]: readonly [number, number, number, number, number, number],
  traits: readonly string[], at: string | null = null,
): Hero => ({ id, name, faction, mu, tong, ryak, chi, deok, uiri, traits, look, status: 'free', captor: null, at, post: null })

const HEROES: Hero[] = [
  // 군주 — 나라마다 따로 (형: "군주는 따로 있어야 하고 장군이랑 별개"). 도읍에 머물고 군대를 이끌지 않는다. 둘은 여인
  h('us-ruler', '읍차 해솔', 'us', 'w', [3, 5, 6, 6, 8, 9], ['charm'], 'our-cap'),
  h('guya-ruler', '진지렴 쇠보', 'guya', 'g', [6, 7, 4, 5, 4, 8], ['smith'], 'guya-cap'), // 「狗邪秦支廉之號」 — 큰 나라 신지의 높임 칭호
  h('anya-ruler', '신지 아단', 'anya', 'g', [4, 6, 8, 5, 5, 9], ['careful'], 'anya-cap'),
  h('miri-ruler', '신지 달래', 'miri', 'w', [2, 4, 4, 9, 7, 8], ['farmer'], 'miri-cap'),
  h('goja-ruler', '험측 바우', 'goja', 'g', [5, 5, 5, 5, 5, 7], ['river', 'trader'], 'goja-cap'),
  h('dokro-ruler', '읍차 가람', 'dokro', 'g', [6, 6, 5, 4, 4, 7], ['trader'], 'dokro-cap'),
  // 장군 — 군대를 이끌거나 고을을 맡는다
  h('chief', '살해 매눈', 'us', 'g', [7, 5, 6, 4, 5, 8], ['archer', 'nighteye']), // 골포국의 활 쏘는 장군 (FLOW §3: 작은 나라는 장수가 세다)
  h('us-1', '험측 돌개', 'us', 'g', [5, 5, 4, 6, 4, 7], ['farmer'], 'our-cap'),
  h('guya-1', '견지 거타', 'guya', 'g', [7, 7, 5, 6, 4, 6], ['ironhand']),
  h('guya-2', '험측 마루', 'guya', 'g', [6, 4, 3, 3, 3, 5], ['glutton']),
  h('anya-1', '견지 아라', 'anya', 'w', [5, 6, 7, 5, 6, 8], ['mountain']),
  h('anya-2', '번예 솔미', 'anya', 'w', [4, 4, 6, 4, 4, 6], ['nighteye']),
  h('miri-1', '읍차 갈미', 'miri', 'g', [4, 4, 4, 5, 5, 4], ['drinker']), // PLAY §4 의 "술꾼" 장수 자리
  h('miri-2', '번예 고운', 'miri', 'w', [3, 4, 6, 7, 6, 6], ['shaman'], 'miri-cap'),
  h('goja-1', '살해 바다쇠', 'goja', 'g', [5, 5, 5, 3, 3, 5], ['river']),
  h('goja-2', '번예 물새', 'goja', 'w', [4, 4, 7, 5, 6, 5], ['charm'], 'goja-cap'),
  h('dokro-1', '살해 너울', 'dokro', 'w', [7, 6, 6, 3, 4, 4], ['river', 'nighteye']), // 거칠산은 장수가 세다 (FLOW §3)
  h('dokro-2', '견지 쇠돌', 'dokro', 'g', [6, 5, 3, 3, 3, 7], ['careful'], 'dokro-cap'),
  // 여인 장수 더 (형 2026-10-19: "장수도 여캐 많았으면") — 도읍에 머문다. 맡기거나 군대를 이끌게 한다
  h('us-2', '살해 잔물', 'us', 'w', [5, 5, 5, 4, 5, 7], ['river'], 'our-cap'),
  h('guya-3', '견지 쇠비', 'guya', 'w', [6, 5, 5, 5, 4, 6], ['ironhand'], 'guya-cap'),
]

/** 나라마다 군주 */
const RULER: Readonly<Record<string, string>> = {
  us: 'us-ruler', guya: 'guya-ruler', anya: 'anya-ruler', miri: 'miri-ruler', goja: 'goja-ruler', dokro: 'dokro-ruler',
}

const a = (id: string, faction: string, hero: string | null, at: string, mix0: Army['mix'], equip: Army['equip'] = 'ironTip'): Army => {
  const mix = Object.fromEntries(Object.entries(mix0).map(([k, n]) => [k, (n ?? 0) * PEOPLE_SCALE])) as Army['mix']
  // 병종마다 무장 — 판 처음엔 모두 그 군대의 장비 하나 (kit.ts)
  return { id, faction, hero, mix, equip, kit: Object.fromEntries(Object.entries(mix).map(([k, n]) => [k, { [equip]: n }])), morale: 1, at, march: null }
}

const ARMIES: Army[] = [
  a('a-us', 'us', 'chief', 'our-cap', { spear: 80, bow: 30, shield: 10 }),
  a('a-guya-1', 'guya', 'guya-1', 'guya-cap', { spear: 110, bow: 50, shield: 30 }, 'iron'),
  a('a-guya-2', 'guya', 'guya-2', 'guya-iron', { spear: 60, bow: 30 }, 'iron'),
  a('a-anya-1', 'anya', 'anya-1', 'anya-cap', { spear: 120, bow: 70, shield: 30 }),
  a('a-anya-2', 'anya', 'anya-2', 'anya-fort', { spear: 30, bow: 30 }),
  a('a-miri', 'miri', 'miri-1', 'miri-vil', { spear: 100, bow: 50, shield: 10 }, 'bronze'),
  a('a-goja', 'goja', 'goja-1', 'goja-cap', { spear: 100, bow: 40, boat: 30 }, 'bronze'),
  a('a-dokro', 'dokro', 'dokro-1', 'dokro-cap', { spear: 80, bow: 40, boat: 30 }, 'bronze'),
]

const byId = <T extends { id: string }>(xs: readonly T[]): Record<string, T> =>
  Object.fromEntries(xs.map((x) => [x.id, structuredClone(x)]))

/** 고를 수 있는 나라 id — 순서는 나라 고르기 화면의 순서 (data/nations.ts 와 같다) */
export const NATION_IDS: readonly string[] = NATION_STARTS.map((n) => n.faction.id)

/**
 * 판 하나를 연다 (FLOW §3) — `player` 가 고른 나라가 플레이어, 나머지는 저마다의 성향으로 AI.
 * 같은 시드 · 같은 나라면 같은 판 (시드는 굴림에만 쓴다).
 */
export function startRealm(seed: number, player: string): Realm {
  const me = NATION_IDS.includes(player) ? player : 'us'
  const factions: Faction[] = NATION_STARTS.map((n) => ({ ...n.faction, mind: n.faction.id === me ? 'player' : n.mind, ruler: RULER[n.faction.id]! }))
  const nodes = byId(NODES)
  const edges = byId(EDGES)
  // 정보: 저마다 제 땅과 그 이웃 길의 땅만 안다. 남의 군세는 모른다 (SYSTEMS §2-1)
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
  for (const n of NATION_STARTS) stock[n.faction.id] = { ...n.stock }
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
    player: me,
    stock,
    relations: {},
    outcome: null,
    scale: PEOPLE_SCALE,
  }
}

/** 골포국으로 여는 판 — 시험들이 쓰는 기본 판 */
export function byeonhanMini(seed: number): Realm {
  return startRealm(seed, 'us')
}
