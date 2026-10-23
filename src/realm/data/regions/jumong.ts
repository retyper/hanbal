/**
 * 캠페인 2장 「주몽, 졸본에 서다」 (docs/realm/CAMPAIGN.md §1) — 형 2026-10-23: "1장 깼는데 2장 안 열림".
 *
 * 『삼국사기』 고구려본기 동명성왕 — 동부여를 빠져나온 주몽이 엄리대수를 건너 졸본에 나라를 세운다. 오이·마리·협보가 따랐다.
 * 이듬해 비류국 송양이 와서 항복하니 그 땅을 다물도라 하였다(2년). 6년 태백산 동남의 행인국을 치고, 10년 북옥저를 쳤다.
 * 동부여의 왕자 대소는 주몽을 시기해 뒤를 쫓았다 — 이 판에서는 북쪽 진영에서 내려온다.
 *
 * 땅은 실제 혼강·압록 윗줄기에서 두만강 아래까지 — 삼한과 북녘 판의 조각을 좁게 잘라 쓴다 (jumong-geo.ts).
 * 이김: 송양이 따르고(동맹이든 조공이든) 행인국·북옥저 도읍을 쥔다 (scenario · campaign.ts).
 * 고을·장수 id 는 jm- — 다른 판의 같은 이름과 엉키지 않게. 비류국·동부여는 넓은 판의 비류나부·부여 깃발을 그대로 쓴다.
 */
import { PEOPLE_SCALE } from '../../migrate.ts'
import { chapterScenario } from '../campaign.ts'
import type { NationInfo } from '../nations.ts'
import type { Army, Faction, Hero, NodeIntel, REdge, Realm, RNode, Stock, Watch } from '../../types.ts'

const node = (id: string, name: string, kind: RNode['kind'], tags: RNode['tags'], owner: string | null, hh: number): RNode =>
  ({ id, name, kind, tags, owner, hh: hh * PEOPLE_SCALE, sown: hh * PEOPLE_SCALE })
const wild = (id: string, name: string, room: number): RNode => ({ id, name, kind: 'wild', tags: [], owner: null, hh: 0, sown: 0, room: room * PEOPLE_SCALE })

/** 고을 자리 [경도, 위도] */
export const JUMONG_PLACES: Readonly<Record<string, readonly [number, number]>> = {
  'jm-jolbon-cap': [125.4, 41.32], // 환인 오녀산성 — 졸본 [설]
  'jm-heulgol': [125.18, 41.08], // 졸본 아래 혼강 들
  'jm-eomri': [125.22, 41.68], // 엄리대수 나루 — 주몽이 물고기·자라 다리로 건넌 물 [지음]
  'jm-modun': [125.7, 41.1], // 모둔곡 — 재사·무골·묵거를 만난 골짜기 [지음]
  'jm-gungnae': [126.18, 41.13], // 집안 들 — 뒷날의 국내성
  'jm-biryu-cap': [125.98, 41.78], // 비류수 윗줄기 — 송양의 비류국 [지음]
  'jm-biryu-v': [125.68, 42.05], // 비류 골
  'jm-buyeo-camp': [126.3, 42.62], // 동부여의 추격 진영 (지음)
  'jm-gaema': [127.15, 41.15], // 개마고원 들머리
  'jm-haengin-cap': [127.6, 41.78], // 태백산 동남 — 행인국 [설]
  'jm-haengin-v': [128.05, 42.15], // 태백 기슭
  'jm-okjeo-cap': [129.4, 42.25], // 두만강 아래 — 북옥저 [설]
  'jm-okjeo-port': [129.6, 41.4], // 어랑 포구
}

const NODES: RNode[] = [
  // 고구려 — 졸본에 막 선 나라 (작다)
  node('jm-jolbon-cap', '졸본 도읍', 'capital', ['high', 'palisade'], 'goguryeo', 240),
  node('jm-heulgol', '흘골 마을', 'village', ['shallows'], 'goguryeo', 130),
  node('jm-eomri', '엄리 나루', 'village', ['reeds'], 'goguryeo', 90),
  node('jm-modun', '모둔곡 소도', 'sodo', ['sodo'], null, 0),
  wild('jm-gungnae', '국내 들', 160),
  // 비류국 — 송양의 옛 왕가
  node('jm-biryu-cap', '비류 도읍', 'capital', ['palisade', 'high'], 'biryuna', 230),
  node('jm-biryu-v', '비류골 마을', 'village', ['pines'], 'biryuna', 130),
  // 동부여 — 대소의 추격 진영
  node('jm-buyeo-camp', '동부여 진영', 'fort', ['palisade', 'pasture'], 'buyeo', 220),
  // 행인국 · 북옥저
  wild('jm-gaema', '개마 들머리', 110),
  node('jm-haengin-cap', '행인 도읍', 'capital', ['high', 'pines'], 'haengin', 190),
  node('jm-haengin-v', '태백 기슭 마을', 'village', ['pines'], 'haengin', 100),
  node('jm-okjeo-cap', '북옥저 도읍', 'capital', ['pines'], 'bukokjeo', 210),
  node('jm-okjeo-port', '어랑 포구', 'port', [], 'bukokjeo', 110),
]

const e = (id: string, a: string, b: string, kind: REdge['kind'], tags: REdge['tags'] = []): REdge => ({ id, a, b, kind, tags })
const EDGES: REdge[] = [
  e('j01', 'jm-jolbon-cap', 'jm-heulgol', 'field'),
  e('j02', 'jm-jolbon-cap', 'jm-eomri', 'ford'), // 엄리대수
  e('j03', 'jm-jolbon-cap', 'jm-modun', 'forest'),
  e('j04', 'jm-heulgol', 'jm-gungnae', 'field'),
  e('j05', 'jm-modun', 'jm-gungnae', 'forest'),
  e('j06', 'jm-jolbon-cap', 'jm-biryu-cap', 'ford'), // 비류수 — 송양의 땅으로 거슬러 오른다
  e('j07', 'jm-eomri', 'jm-biryu-v', 'forest'),
  e('j08', 'jm-biryu-cap', 'jm-biryu-v', 'forest'),
  e('j09', 'jm-eomri', 'jm-buyeo-camp', 'field'), // 부여에서 내려오는 들길
  e('j10', 'jm-biryu-v', 'jm-buyeo-camp', 'forest'),
  e('j11', 'jm-gungnae', 'jm-gaema', 'pass'),
  e('j12', 'jm-biryu-cap', 'jm-haengin-cap', 'pass'), // 태백산 쪽 고개
  e('j13', 'jm-gaema', 'jm-haengin-cap', 'pass'),
  e('j14', 'jm-haengin-cap', 'jm-haengin-v', 'forest'),
  e('j15', 'jm-haengin-v', 'jm-okjeo-cap', 'forest'),
  e('j16', 'jm-gaema', 'jm-okjeo-port', 'pass'), // 개마고원을 넘어 동해 바닷가로
  e('j17', 'jm-okjeo-port', 'jm-okjeo-cap', 'field'),
]

const FACTIONS: Faction[] = [
  { id: 'goguryeo', name: '고구려', capital: 'jm-jolbon-cap', equip: 'ironTip', ruler: 'jm-jumong', mind: 'player' },
  { id: 'biryuna', name: '비류국', capital: 'jm-biryu-cap', equip: 'bronze', ruler: 'jm-songyang', mind: 'cautious' },
  { id: 'buyeo', name: '동부여', capital: 'jm-buyeo-camp', equip: 'ironTip', ruler: 'jm-daeso', mind: 'greedy' },
  { id: 'haengin', name: '행인국', capital: 'jm-haengin-cap', equip: 'bronze', ruler: 'jm-haengin-ruler', mind: 'cautious' },
  { id: 'bukokjeo', name: '북옥저', capital: 'jm-okjeo-cap', equip: 'bronze', ruler: 'jm-okjeo-ruler', mind: 'cautious' },
]

const STOCK: Record<string, Stock> = {
  goguryeo: { grain: 320, iron: 20, wood: 40, horse: 6 },
  biryuna: { grain: 260, iron: 5, wood: 30, horse: 4 },
  buyeo: { grain: 220, iron: 15, wood: 20, horse: 10 },
  haengin: { grain: 200, iron: 0, wood: 40 },
  bukokjeo: { grain: 200, iron: 0, salt: 15, wood: 40 },
}

const h = (
  id: string, name: string, faction: string, look: 'g' | 'w',
  [mu, tong, ryak, chi, deok, uiri]: readonly [number, number, number, number, number, number],
  traits: readonly string[], at: string | null = null,
): Hero => ({ id, name, faction, mu, tong, ryak, chi, deok, uiri, traits, look, status: 'free', captor: null, at, post: null })

// 오이·마리·협보는 주몽과 함께 동부여를 빠져나온 셋, 송양·대소는 사서의 사람. 행인·북옥저의 군장과 여인 장수들은 지어낸 이름
const HEROES: Hero[] = [
  h('jm-jumong', '주몽', 'goguryeo', 'g', [9, 7, 7, 6, 8, 9], ['archer', 'charm'], 'jm-jolbon-cap'),
  h('jm-oi', '오이', 'goguryeo', 'g', [7, 6, 5, 4, 5, 9], ['mountain']),
  h('jm-mari', '마리', 'goguryeo', 'g', [6, 5, 6, 5, 5, 8], ['river']),
  h('jm-hyeopbo', '협보', 'goguryeo', 'g', [5, 5, 7, 6, 4, 6], ['careful'], 'jm-jolbon-cap'),
  h('jm-songyang', '송양', 'biryuna', 'g', [4, 6, 6, 7, 6, 7], ['careful'], 'jm-biryu-cap'),
  h('jm-songbi', '송비', 'biryuna', 'w', [6, 5, 5, 4, 6, 7], ['archer']),
  h('jm-daeso', '대소', 'buyeo', 'g', [7, 6, 5, 5, 3, 6], ['glutton'], 'jm-buyeo-camp'),
  h('jm-haedal', '해달', 'buyeo', 'w', [7, 6, 5, 4, 4, 7], ['archer']),
  h('jm-haengin-ruler', '군장 고목', 'haengin', 'g', [6, 5, 4, 4, 5, 7], ['mountain'], 'jm-haengin-cap'),
  h('jm-haengin-1', '산지기 너울', 'haengin', 'w', [6, 5, 5, 4, 5, 6], ['nighteye']),
  h('jm-okjeo-ruler', '군장 두만', 'bukokjeo', 'g', [6, 5, 5, 4, 4, 7], ['mountain'], 'jm-okjeo-cap'),
  h('jm-okjeo-1', '물범', 'bukokjeo', 'w', [5, 5, 5, 4, 5, 6], ['river']),
]

const a = (id: string, faction: string, hero: string | null, at: string, mix0: Army['mix'], equip: Army['equip']): Army => {
  const mix = Object.fromEntries(Object.entries(mix0).map(([k, n]) => [k, (n ?? 0) * PEOPLE_SCALE])) as Army['mix']
  return { id, faction, hero, mix, equip, kit: Object.fromEntries(Object.entries(mix).map(([k, n]) => [k, { [equip]: n }])), morale: 1, at, march: null }
}

const ARMIES: Army[] = [
  a('a-jm-us', 'goguryeo', 'jm-oi', 'jm-jolbon-cap', { spear: 70, bow: 60, horse: 10 }, 'ironTip'),
  a('a-jm-us2', 'goguryeo', 'jm-mari', 'jm-heulgol', { spear: 30, bow: 20 }, 'ironTip'),
  a('a-jm-biryu', 'biryuna', 'jm-songbi', 'jm-biryu-cap', { spear: 60, bow: 40 }, 'bronze'),
  // 대소의 추격대 — 처음부터 북쪽 진영에서 내려올 채비 (CAMPAIGN 규칙: 동부여의 추격)
  a('a-jm-buyeo', 'buyeo', 'jm-haedal', 'jm-buyeo-camp', { spear: 60, bow: 40, horse: 25 }, 'ironTip'),
  a('a-jm-haengin', 'haengin', 'jm-haengin-1', 'jm-haengin-cap', { spear: 50, bow: 40 }, 'bronze'),
  a('a-jm-okjeo', 'bukokjeo', 'jm-okjeo-1', 'jm-okjeo-cap', { spear: 50, bow: 40 }, 'bronze'),
]

const byId = <T extends { id: string }>(xs: readonly T[]): Record<string, T> => Object.fromEntries(xs.map((x) => [x.id, structuredClone(x)]))

export const JUMONG_NATION_IDS: readonly string[] = ['goguryeo']

/** 이 장에만 있는 나라의 소개 — 고구려·비류국·동부여·북옥저는 넓은 판의 글을 쓴다 */
export const HAENGIN_NATION: NationInfo = {
  id: 'haengin', name: '행인국', place: '태백산 동남 (설)',
  blurb: '태백산 기슭의 산사람들. 숲이 깊고 고개가 높아 치기 어렵다. 곡식은 모자란다.',
  source: '『삼국사기』 고구려본기 — 동명성왕 6년 오이와 부분노를 보내 태백산 동남의 행인국을 쳐서 그 땅을 성읍으로 삼았다.',
  bars: { army: 2, grain: 1, militia: 3, terrain: 5 },
}

/** 2장을 연다 — 우리는 언제나 고구려(주몽) */
export function startJumong(seed: number): Realm {
  const nodes = byId(NODES)
  const edges = byId(EDGES)
  // 작은 판이라 서로 다 안다 — 땅은 처음부터 다 보인다
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
    relations: {},
    outcome: null,
    scale: PEOPLE_SCALE,
    region: 'jumong',
    scenario: chapterScenario('jumong'),
  }
}
