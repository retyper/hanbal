/**
 * 나라 고르기 화면의 글 (docs/realm/FLOW.md §3) — 화면은 이것만 읽는다. 숫자의 참값은 regions/byeonhan-mini.ts.
 * 막대는 1~5. 합이 비슷하게 — 골포국만 일부러 낮다 (어려움).
 *
 * **이름은 우리 역사책이 먼저다** (형: "가장 중요한 건 한국사 기록이야" — 2026-10-18).
 * `source` 는 그 이름이 나오는 우리 책, 그리고 곁들여 중국 책 위서 동이전의 이름. 자리가 학설이면 "설".
 */
export interface NationInfo {
  readonly id: string
  readonly name: string
  /** 비정된 자리 (설이면 "설") */
  readonly place: string
  /** 한 줄 소개 — 잘하는 것과 약한 것 */
  readonly blurb: string
  /** 이름의 근거 — 우리 책 먼저, 위서는 곁들임 */
  readonly source: string
  readonly bars: {
    readonly army: 1 | 2 | 3 | 4 | 5
    readonly grain: 1 | 2 | 3 | 4 | 5
    readonly militia: 1 | 2 | 3 | 4 | 5
    readonly terrain: 1 | 2 | 3 | 4 | 5
  }
  readonly hard?: boolean
}

export const NATIONS: readonly NationInfo[] = [
  {
    id: 'guya',
    name: '가락국',
    place: '김해',
    blurb: '쇠를 캐는 큰 나라. 군사가 가장 많다. 바닷가 도읍이 열려 있고 이웃이 많다.',
    source: '『삼국유사』 가락국기: 수로왕의 나라, 뒤의 금관가야. 위서에는 구야국.',
    bars: { army: 5, grain: 2, militia: 3, terrain: 2 },
  },
  {
    id: 'anya',
    name: '아라국',
    place: '함안',
    blurb: '산성과 언덕 위 도읍. 들어오는 길이 고개뿐이다. 곡식이 모자란다.',
    source: '『삼국사기』 지리지. 함안은 "본래 아시량국, 아나가야라고도 한다". 위서에는 안야국.',
    bars: { army: 3, grain: 2, militia: 3, terrain: 5 },
  },
  {
    id: 'miri',
    name: '추화국',
    place: '밀양 (설)',
    blurb: '낙동강 가의 곡창. 집이 많아 장정이 두껍다. 군대는 작다.',
    source: '『삼국사기』 지리지. 밀양은 "본래 추화군". 나라 이름으로 쓴 것은 설이다. 위서의 미리미동국을 밀양으로 보는 설이 있다.',
    bars: { army: 2, grain: 5, militia: 5, terrain: 2 },
  },
  {
    id: 'goja',
    name: '고자국',
    place: '고성',
    blurb: '남해 항구. 수군을 쓰고 배로 교역한다. 뭍이 좁다.',
    source: '『삼국사기』 지리지. 고성은 "본래 고자군". 포상팔국의 고사포, 뒤의 소가야. 위서에는 고자미동국.',
    bars: { army: 3, grain: 3, militia: 3, terrain: 3 },
  },
  {
    id: 'dokro',
    name: '거칠산국',
    place: '동래',
    blurb: '바다 건너와 맞댄 항구. 철과 곡식이 바다로 들어온다. 장수가 세다. 땅은 하나뿐이다.',
    source: '『삼국사기』 거도전: 신라 장수 거도가 친 나라. 지리지에 동래는 "본래 거칠산군". 위서의 독로국으로 보는 설이 있다.',
    bars: { army: 3, grain: 4, militia: 3, terrain: 2 },
  },
  {
    id: 'us',
    name: '골포국',
    place: '마산 (설)',
    blurb: '가장 작은 나라. 땅은 좁아도 매눈의 활 솜씨는 바다 건너까지 알려졌다. 어렵다.',
    source: '『삼국사기』 물계자전·나해이사금: 바닷가 여덟 나라(포상팔국)의 하나. 포상팔국은 가야를 함께 쳤다.',
    bars: { army: 1, grain: 2, militia: 1, terrain: 2 },
    hard: true,
  },
]
