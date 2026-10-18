/**
 * 변한 6국 축소판 — R1 의 판 (docs/realm/BUILD.md §6 · WORLD §4 · FLOW §3)
 *
 * 나라 이름은 『삼국지』 위지 변진조 원문 그대로 쓴다 (WORLD §5 규칙 6). 자리는 비정이 설이거나
 * 없는 것이 많아 대부분 [상상 배치]다 — 구야국(김해)·안야국(함안)만 비교적 확실하다.
 * 장수 이름은 지어낸다 — 사료의 칭호만 쓰고 실존 인물은 쓰지 않는다 (BUILD §8 Q6).
 *
 * FLOW §3 (2026-10-18): **여섯 나라 모두 고를 수 있다.** 잘하는 것이 하나씩 다르고 합은 비슷하게 —
 *   구야 군사·철 · 안야 지형 · 미리미동 곡창·장정 · 고자미동 바다·교역 · 독로 왜 교역·센 장수 · 갯마을 작은 나라(어려움, 군장이 세다)
 * 숫자(가호·병력·창고)는 봇 대전(tools/realm-sim.ts --as all)으로 맞춘 초안이다. 판의 크기 감은 PLAY §4 대본:
 * 북쪽 읍락 병력 120~180, 큰 나라는 그 두세 배.
 */
import type { Army, Faction, Hero, Mind, NodeIntel, REdge, Realm, RNode, Stock, Watch } from '../../types.ts'

const node = (id: string, name: string, kind: RNode['kind'], tags: RNode['tags'], owner: string | null, hh: number): RNode =>
  ({ id, name, kind, tags, owner, hh, sown: hh })

const NODES: RNode[] = [
  // 갯마을 — 남쪽 바닷가 작은 나라 (국읍 하나 · 읍락 둘, PLAY §4) · 가호 600 (WORLD §4-1)
  node('our-cap', '갯마을 국읍', 'capital', ['palisade'], 'us', 300),
  node('our-north', '안개골 읍락', 'village', ['fog'], 'us', 150),
  node('our-east', '갈대울 읍락', 'village', ['reeds'], 'us', 150),
  // 구야국 狗邪 — 김해, 고김해만 · 철 · 변한의 큰 나라
  node('guya-cap', '구야 국읍', 'port', ['palisade', 'high'], 'guya', 550),
  node('guya-iron', '붉은산 철산', 'ironMine', ['iron'], 'guya', 150),
  node('guya-vil', '봉황 읍락', 'village', [], 'guya', 250),
  // 안야국 安邪 — 함안, 남강 · 산성과 고개로 막힌 땅
  node('anya-cap', '안야 국읍', 'capital', ['palisade', 'high'], 'anya', 450),
  node('anya-fort', '남강 산성', 'fort', ['high'], 'anya', 100),
  node('anya-vil', '솔숲 읍락', 'village', ['pines'], 'anya', 250),
  // 미리미동국 彌離彌凍 — 밀양설, 낙동강 중류 · 강가 농사
  node('miri-cap', '미리미동 국읍', 'capital', ['palisade', 'moat'], 'miri', 750),
  node('miri-vil', '여울목 읍락', 'village', ['reeds', 'shallows'], 'miri', 450),
  // 고자미동국 古資彌凍 — 고성설, 남해 포구
  node('goja-cap', '고자미동 포구', 'port', ['palisade'], 'goja', 500),
  node('goja-vil', '갯벌 읍락', 'village', [], 'goja', 300),
  // 독로국 瀆盧 — 동래설, 「其瀆盧國與倭接界」 왜와 경계를 맞댄다
  node('dokro-cap', '독로 포구', 'port', ['palisade'], 'dokro', 600),
  // 소도 — 누구의 땅도 아니다. 침범 금지 (SYSTEMS §8-4) [사료]
  node('sodo', '큰나무 소도', 'sodo', ['sodo'], null, 0),
]

const e = (id: string, a: string, b: string, kind: REdge['kind'], tags: REdge['tags'] = []): REdge => ({ id, a, b, kind, tags })

const EDGES: REdge[] = [
  e('e01', 'our-cap', 'our-north', 'field'),
  e('e02', 'our-cap', 'our-east', 'field'),
  e('e03', 'our-cap', 'goja-vil', 'sea'),
  e('e04', 'our-cap', 'guya-cap', 'sea'),
  e('e05', 'our-north', 'anya-cap', 'field'),
  e('e06', 'our-north', 'miri-vil', 'ford', ['reeds']), // 낙동강 갈대 나루 — PLAY §4 의 그 나루
  e('e07', 'our-north', 'sodo', 'forest'),
  e('e08', 'our-east', 'miri-vil', 'reeds'),
  e('e09', 'our-east', 'guya-vil', 'mudflat'),
  e('e10', 'guya-vil', 'guya-cap', 'field'),
  e('e11', 'guya-cap', 'guya-iron', 'pass'),
  e('e12', 'guya-cap', 'dokro-cap', 'sea'),
  e('e13', 'guya-iron', 'dokro-cap', 'pass'),
  e('e14', 'guya-iron', 'miri-cap', 'forest'),
  e('e15', 'miri-vil', 'miri-cap', 'field'),
  e('e16', 'miri-vil', 'sodo', 'reeds'),
  e('e17', 'anya-cap', 'anya-fort', 'pass'),
  e('e18', 'anya-fort', 'miri-cap', 'ford'), // 남강이 낙동강에 드는 나루
  e('e19', 'anya-cap', 'anya-vil', 'forest'),
  e('e20', 'anya-vil', 'goja-cap', 'pass'),
  e('e21', 'goja-cap', 'goja-vil', 'field'),
]

/** 나라마다: AI 일 때의 성향 · 새 군사의 장비 · 바깥 교역 · 시작 창고 */
interface NationStart {
  readonly faction: Omit<Faction, 'mind'>
  readonly mind: Exclude<Mind, 'player'>
  readonly stock: Stock
}

const NATION_STARTS: readonly NationStart[] = [
  { faction: { id: 'us', name: '갯마을', capital: 'our-cap', equip: 'ironTip' }, mind: 'cautious', stock: { grain: 150, iron: 0 } },
  // 시작 창고는 첫 가을까지 군대를 먹일 만큼 (봄·여름·가을 세 계절치 남짓) — 모자라면 첫해부터 굶는다 (봇 대전에서 잡혔다)
  { faction: { id: 'guya', name: '구야국', capital: 'guya-cap', equip: 'iron' }, mind: 'greedy', stock: { grain: 280, iron: 40 } },
  { faction: { id: 'anya', name: '안야국', capital: 'anya-cap', equip: 'ironTip' }, mind: 'cautious', stock: { grain: 210, iron: 10 } },
  { faction: { id: 'miri', name: '미리미동국', capital: 'miri-cap', equip: 'bronze' }, mind: 'cautious', stock: { grain: 400, iron: 0 } },
  {
    faction: { id: 'goja', name: '고자미동국', capital: 'goja-cap', equip: 'bronze', income: { grain: 10, iron: 4 } },
    mind: 'greedy',
    stock: { grain: 200, iron: 20 },
  },
  {
    // 「其瀆盧國與倭接界」 — 왜와 거래한다 (FLOW §3)
    faction: { id: 'dokro', name: '독로국', capital: 'dokro-cap', equip: 'bronze', income: { grain: 20, iron: 6 } },
    mind: 'greedy',
    stock: { grain: 200, iron: 30 },
  },
]

const h = (id: string, name: string, faction: string, mu: number, ryak: number, chi: number, deok: number): Hero =>
  ({ id, name, faction, mu, ryak, chi, deok, status: 'free', captor: null })

const HEROES: Hero[] = [
  h('chief', '군장', 'us', 7, 6, 4, 5), // 갯마을의 군장 = 신궁 (FLOW §3: 작은 나라는 군장이 세다)
  h('guya-1', '진지렴 거타', 'guya', 7, 5, 6, 4), // 「狗邪秦支廉之號」 — 큰 나라 신지의 높임 칭호
  h('guya-2', '험측 마루', 'guya', 6, 3, 3, 3),
  h('anya-1', '신지 아라', 'anya', 5, 7, 5, 6),
  h('anya-2', '번예 솔미', 'anya', 4, 6, 4, 4),
  h('miri-1', '읍차 갈미', 'miri', 4, 4, 5, 5), // PLAY §4 의 "술꾼" 장수 자리
  h('goja-1', '살해 바다쇠', 'goja', 5, 5, 3, 3),
  h('dokro-1', '읍차 너울', 'dokro', 7, 6, 3, 4), // 독로는 장수가 세다 (FLOW §3)
]

const a = (id: string, faction: string, hero: string | null, at: string, mix: Army['mix'], equip: Army['equip'] = 'ironTip'): Army =>
  ({ id, faction, hero, mix, equip, morale: 1, at, march: null })

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
  const factions: Faction[] = NATION_STARTS.map((n) => ({ ...n.faction, mind: n.faction.id === me ? 'player' : n.mind }))
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
  }
}

/** 갯마을로 여는 판 — 시험들이 쓰는 기본 판 */
export function byeonhanMini(seed: number): Realm {
  return startRealm(seed, 'us')
}
