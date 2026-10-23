/**
 * 풍습 — 나라의 결 (docs/realm/CUSTOMS.md §7 · 2026-10-23 회의 결정).
 *
 * 나라 사이의 차이를 핏줄이 아니라 **땅·생업·제도·교류**로 낸다. 결(문화권)마다 사서에 적힌 풍습 둘 — 좋은 것에는 늘 값이 붙는다.
 * 뿌리는 우리 책이 먼저(『삼국사기』·『삼국유사』), 『삼국지』 위서 동이전은 곁들임. 늦은 것(개마·판갑)은 넣지 않는다.
 *
 * 나라의 풍습은 `Faction.customs` — 없으면 제 결의 풍습 둘 (옛 판도 그대로 열린다). 셈은 `hasCustom` 하나로만 묻는다.
 * `live` 가 false 인 풍습은 아직 규칙이 걸리지 않았다 — 화면에도 안 보인다 (짓는 차례 wave).
 * 판(realm)은 산 판인지 모른다 — `pack` 은 화면의 잠금에만 쓴다 (MONEY.md §3).
 */
import { P } from '../../tune/params.ts'
import type { Realm } from '../types.ts'

/** 결 — 사서가 한 묶음으로 적은 사람들 */
export type Kyeol = 'goguryeo' | 'buyeo' | 'okjeo' | 'ye' | 'mahan' | 'byeonhan' | 'jinhan' | 'baekje' | 'juho' | 'other'

export type CustomId =
  | 'chaekhwa' | 'byeoljeom' // 동예
  | 'jwasik' | 'bugyeong' // 고구려
  | 'guseul' | 'maljangrye' // 마한
  | 'sogeum' | 'hanmudeom' // 옥저
  | 'yeonggo' | 'baljeom' // 부여
  | 'deongisoe' | 'girbikyeo' // 변한
  | 'yeoseotmaeul' | 'itgeum' // 진한
  | 'tteodori' | 'byeonon' // 백제
  | 'baejangsa' | 'seomjikigi' // 주호

/** 층 — 어느 길로 잘 건너오나 (도읍 쥐기=제도 · 혼인=집안·신앙 · 손잡기=물질) */
export type CustomLayer = 'rule' | 'family' | 'matter'

export interface CustomDef {
  readonly id: CustomId
  readonly kyeol: Kyeol
  /** 카드 큰 제목 — 쉬운 말 (교과서 낱말인 영고·책화·덩이쇠만 그대로) */
  readonly name: string
  /** 무엇이 되나 — 한 줄 */
  readonly does: string
  /** 무엇을 내주나 — 한 줄 */
  readonly cost: string
  /** 사서 한 줄 */
  readonly source: string
  readonly layer: CustomLayer
  /** 연대기가 나라 이름을 지을 때 쓰는 씨앗 낱말 — "소금과 별의 나라" */
  readonly seed: string
  readonly pack: 'base'
  readonly wave: 1 | 2 | 3
  /** 규칙이 판에 걸렸나 */
  readonly live: boolean
}

export const CUSTOMS: readonly CustomDef[] = [
  {
    id: 'chaekhwa', kyeol: 'ye', name: '책화', layer: 'rule', seed: '경계', pack: 'base', wave: 1, live: false,
    does: '우리 땅에 쳐들어온 적군은 첫 합에서 사기가 깎인다',
    cost: '우리 군대가 남의 땅으로 나가면 군량이 더 든다',
    source: '『삼국지』 위서 예전 — 읍락이 서로 침범하면 사람·소·말로 물어내게 하니, 이를 책화라 한다',
  },
  {
    id: 'byeoljeom', kyeol: 'ye', name: '별점', layer: 'family', seed: '별', pack: 'base', wave: 1, live: false,
    does: '봄에 그해 가을걷이(풍년·흉년)를 미리 안다',
    cost: '흉년이 보이면 백성이 먼저 흔들려 그해 징병이 준다',
    source: '『삼국지』 위서 예전 — 새벽에 별자리를 살펴 그해 풍흉을 미리 안다 · 시월에 하늘에 제사하니 무천이라 한다',
  },
  {
    id: 'jwasik', kyeol: 'goguryeo', name: '거둬먹기', layer: 'rule', seed: '산', pack: 'base', wave: 1, live: false,
    does: '조공하는 나라가 가을마다 곡식을 바치고, 새로 앗은 고을의 곳간을 거둔다',
    cost: '우리 고을 가을걷이가 준다 — 좋은 밭이 없다',
    source: '『삼국지』 위서 고구려전 — 대가들은 농사짓지 않고, 좌식자 만여 명에게 하호가 쌀·물고기·소금을 멀리서 져 온다',
  },
  {
    id: 'bugyeong', kyeol: 'goguryeo', name: '흩어진 창고', layer: 'matter', seed: '곳간', pack: 'base', wave: 1, live: false,
    does: '도읍이 털리거나 불화살을 맞아도 곡식을 덜 잃는다',
    cost: '곡식이 고을마다 흩어져 있다 — 변두리 고을을 빼앗기면 그 몫도 넘어간다',
    source: '『삼국지』 위서 고구려전 — 큰 창고가 없고 집집마다 작은 창고를 두니 부경이라 한다',
  },
  {
    id: 'guseul', kyeol: 'mahan', name: '구슬', layer: 'matter', seed: '구슬', pack: 'base', wave: 1, live: true,
    does: '선물로 오르는 호감이 크다',
    cost: '쇠를 귀히 여기지 않아 쇠를 싸게 친다',
    source: '『삼국지』 위서 한전 — 구슬을 재보로 여기고, 금·은·비단은 보배로 여기지 않는다',
  },
  {
    id: 'maljangrye', kyeol: 'mahan', name: '말 장례', layer: 'family', seed: '무덤', pack: 'base', wave: 1, live: false,
    does: '장수가 죽으면 장례에 소·말을 바쳐 집안 장수의 정이 크게 오른다',
    cost: '말을 타지 않아 기병을 뽑지 못한다 — 이 풍습을 버려야 기병이 열린다',
    source: '『삼국지』 위서 한전 — 소와 말을 탈 줄 모르고, 소와 말은 장례에 다 쓴다',
  },
  {
    id: 'sogeum', kyeol: 'okjeo', name: '소금', layer: 'matter', seed: '소금', pack: 'base', wave: 1, live: false,
    does: '소금이 넉넉하고 소금을 비싸게 판다',
    cost: '큰 나라가 소금을 노린다 — 조공을 하면 거둬 가는 몫이 크다',
    source: '『삼국지』 위서 동옥저전 — 대가를 보내 맥포·물고기·소금·바다 먹거리를 천 리나 져 나르게 하고 종처럼 부렸다',
  },
  {
    id: 'hanmudeom', kyeol: 'okjeo', name: '한무덤', layer: 'family', seed: '뼈', pack: 'base', wave: 2, live: false,
    does: '장수가 죽은 고을을 되찾아 뼈를 거두면 집안 장수의 정이 크게 오른다',
    cost: '장례 한 계절 동안 그 집안 장수는 군대를 이끌지 못한다',
    source: '『삼국지』 위서 동옥저전 — 큰 나무 곽을 만들어 온 집안이 한 곽을 쓴다',
  },
  {
    id: 'yeonggo', kyeol: 'buyeo', name: '영고', layer: 'family', seed: '북', pack: 'base', wave: 2, live: false,
    does: '겨울 제사 동안 옥사를 멈추고 죄수를 푼다 — 회유가 빨라지고 민심이 오른다',
    cost: '그 겨울엔 군대가 잔치에 돌아와 출정하지 못한다',
    source: '『삼국지』 위서 부여전 — 정월에 하늘에 제사하고 크게 모이니 영고라 한다. 이때 형옥을 멈추고 죄수를 푼다',
  },
  {
    id: 'baljeom', kyeol: 'buyeo', name: '발굽점', layer: 'rule', seed: '발굽', pack: 'base', wave: 2, live: false,
    does: '큰 싸움 전에 이길 낌새가 한 단계 또렷해진다',
    cost: '점칠 때마다 곡식이 들고, 흉이 나오면 사기가 깎인 채 싸운다',
    source: '『삼국지』 위서 부여전 — 싸울 일이 있으면 소를 잡아 발굽으로 점친다. 벌어지면 흉, 붙으면 길',
  },
  {
    id: 'deongisoe', kyeol: 'byeonhan', name: '덩이쇠', layer: 'matter', seed: '쇠', pack: 'base', wave: 2, live: false,
    does: '징병값과 고용값을 쇠로 낼 수 있다',
    cost: '쇠를 돈으로 쓴 만큼 무장할 쇠가 준다 · 쌓인 쇠를 이웃이 탐낸다',
    source: '『삼국지』 위서 변진전 — 나라에서 쇠가 나 한·예·왜가 다 가져가고, 저자에서는 쇠를 돈처럼 쓴다',
  },
  {
    id: 'girbikyeo', kyeol: 'byeonhan', name: '길 비켜 주기', layer: 'rule', seed: '길', pack: 'base', wave: 2, live: false,
    does: '사신과 장사꾼이 막히지 않아 교역과 사신이 잘 먹힌다',
    cost: '남의 정탐꾼도 잘 들어온다',
    source: '『삼국지』 위서 변진전 — 길 가는 이가 서로 만나면 다 멈춰 서서 길을 비켜 준다',
  },
  {
    id: 'yeoseotmaeul', kyeol: 'jinhan', name: '여섯 마을의 뜻', layer: 'rule', seed: '마을', pack: 'base', wave: 3, live: false,
    does: '싸우기 전에 여섯 마을에 묻는다 — 사기와 민심이 높고 사신이 잘 먹힌다',
    cost: '물은 싸움은 한 계절 늦게 시작하고, 화친을 깨고 치지 못한다',
    source: '『삼국유사』 기이 신라시조 혁거세왕 — 여섯 마을 촌장이 알천 언덕에 모여 임금을 세웠다',
  },
  {
    id: 'itgeum', kyeol: 'jinhan', name: '잇금', layer: 'family', seed: '잇자국', pack: 'base', wave: 3, live: false,
    does: '군주가 죽어도 덕 높은 장수가 이어받는다',
    cost: '누가 이을지는 덕이 정한다 — 집안이 바뀌면 옛 집안의 정이 흔들린다',
    source: '『삼국사기』 신라본기 유리이사금 — 떡을 깨물어 잇자국이 많은 이를 임금으로 세웠다',
  },
  {
    id: 'tteodori', kyeol: 'baekje', name: '떠돌이 받기', layer: 'family', seed: '나그네', pack: 'base', wave: 3, live: false,
    does: '떠돌이 장수가 자주 오고 고용값이 싸다',
    cost: '새로 온 장수는 정이 낮게 시작한다',
    source: '『삼국사기』 백제본기 온조왕 — 열 신하가 도와 십제라 했고, 뒤에 백성이 즐겨 따라 백제라 고쳤다',
  },
  {
    id: 'byeonon', kyeol: 'baekje', name: '벼논', layer: 'matter', seed: '벼', pack: 'base', wave: 3, live: false,
    does: '남쪽 고을에 벼논을 열면 이듬해부터 가을걷이가 크게 는다',
    cost: '여는 해에는 물 대는 일에 장정이 묶인다',
    source: '『삼국사기』 백제본기 다루왕 6년 — 나라 남쪽 고을에 처음으로 벼논을 만들게 했다',
  },
  {
    id: 'baejangsa', kyeol: 'juho', name: '배 장사', layer: 'matter', seed: '배', pack: 'base', wave: 3, live: false,
    does: '뱃길 교역 값이 크다',
    cost: '겨울에는 뱃길 교역이 끊긴다',
    source: '『삼국지』 위서 한전 — 주호는 마한 서쪽 바다 큰 섬에 있어, 배를 타고 오가며 한과 사고판다',
  },
  {
    id: 'seomjikigi', kyeol: 'juho', name: '섬 지키기', layer: 'rule', seed: '섬', pack: 'base', wave: 3, live: false,
    does: '겨울 바다는 아무도 건너오지 못하고, 섬 고을을 지킬 때 덤을 받는다',
    cost: '뭍으로 낸 군대는 겨울에 돌아오지 못한다',
    source: '『삼국지』 위서 한전 주호조 — 큰 섬에 살며 배를 탄다',
  },
]

const BY_ID: Readonly<Record<string, CustomDef>> = Object.fromEntries(CUSTOMS.map((c) => [c.id, c]))
export const customDef = (id: CustomId): CustomDef => BY_ID[id]!

/** 나라 → 결. 없는 나라(지어낸 나라·바깥)는 other */
export const KYEOL_OF: Readonly<Record<string, Kyeol>> = {
  goguryeo: 'goguryeo', biryuna: 'goguryeo', yeonna: 'goguryeo', hwanna: 'goguryeo', gwanna: 'goguryeo',
  buyeo: 'buyeo', maga: 'buyeo', uga: 'buyeo', jeoga: 'buyeo', guga: 'buyeo',
  dongokjeo: 'okjeo', bukokjeo: 'okjeo',
  bullae: 'ye', maek: 'ye', siljik: 'ye', haseulla: 'ye',
  mokji: 'mahan', ungcheon: 'mahan', sangdang: 'mahan', geonma: 'mahan', wansan: 'mahan', gosaburi: 'mahan', balla: 'mahan', mujin: 'mahan', gampyeong: 'mahan', goryong: 'mahan',
  guya: 'byeonhan', daegaya: 'byeonhan', anya: 'byeonhan', goja: 'byeonhan', dokro: 'byeonhan', us: 'byeonhan', samul: 'byeonhan', chopal: 'byeonhan', byeokjin: 'byeonhan', miri: 'byeonhan',
  saro: 'jinhan', dabeol: 'jinhan', sabeol: 'jinhan', jomun: 'jinhan', golbeol: 'jinhan', apdok: 'jinhan', iseo: 'jinhan', usisan: 'jinhan', eumjeup: 'jinhan', bihwa: 'jinhan', gammun: 'jinhan',
  baekje: 'baekje', michuhol: 'baekje',
  tamna: 'juho',
}

/** 결의 이름과 사서 한 문장(동사로) — 나라 고르기·나라 판 카드 (회의 결정 짓는 차례 1) */
export const KYEOL_INFO: Readonly<Record<Kyeol, { name: string; line: string }>> = {
  goguryeo: { name: '고구려의 결', line: '대가들은 농사짓지 않는다 — 하호가 곡식과 소금을 져 온다' },
  buyeo: { name: '부여의 결', line: '겨울이면 옥사를 멈추고 죄수를 푼다 · 싸우기 전에 소 발굽으로 점친다' },
  okjeo: { name: '옥저의 결', line: '소금과 물고기를 천 리나 져 나른다 · 온 집안이 한 곽에 묻힌다' },
  ye: { name: '동예의 결', line: '남의 땅을 밟으면 소와 말로 물어낸다 · 새벽 별로 풍흉을 안다' },
  mahan: { name: '마한의 결', line: '소와 말은 타지 않고 장례에 바친다 · 금보다 구슬을 귀히 여긴다' },
  byeonhan: { name: '변한의 결', line: '쇠가 곧 돈이다 · 길에서 만나면 멈춰 서서 길을 비켜 준다' },
  jinhan: { name: '진한의 결', line: '여섯 마을이 모여 한 임금을 세웠다 · 잇자국이 많은 이가 왕이 된다' },
  baekje: { name: '백제의 결', line: '열 신하와 함께 남으로 내려왔다 · 남쪽 고을에 처음 벼논을 열었다' },
  juho: { name: '주호의 결', line: '큰 섬에 살며 배를 타고 한과 사고판다' },
  other: { name: '', line: '' },
}

export const kyeolOf = (nation: string): Kyeol => KYEOL_OF[nation] ?? 'other'

/** 제 결의 풍습 둘 (규칙이 걸린 것만) */
export function nativeCustoms(nation: string): CustomId[] {
  const k = kyeolOf(nation)
  return CUSTOMS.filter((c) => c.kyeol === k && c.live).map((c) => c.id)
}

/** 그 나라의 풍습 — 판에 적힌 것이 없으면 제 결의 것 (옛 판도 그대로) */
export function customsOf(r: Realm, faction: string): readonly CustomId[] {
  return r.factions[faction]?.customs ?? nativeCustoms(faction)
}

/** 셈은 이것 하나로만 묻는다 — 풍습을 통째로 끄면(customsOn 0) 늘 거짓 (짝 씨앗 측정) */
export function hasCustom(r: Realm, faction: string | null | undefined, id: CustomId): boolean {
  if (faction == null || P.realm.customsOn < 0.5 || !BY_ID[id]?.live) return false
  return customsOf(r, faction).includes(id)
}
