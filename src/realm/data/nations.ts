/**
 * 나라 고르기 화면의 글 (docs/realm/FLOW.md §3) — 화면은 이것만 읽는다. 숫자의 참값은 regions/byeonhan-mini.ts.
 * 막대는 1~5. 합이 비슷하게 — 갯마을만 일부러 낮다 (어려움).
 */
export interface NationInfo {
  readonly id: string
  readonly name: string
  /** 비정된 자리 (설이면 "설") */
  readonly place: string
  /** 한 줄 소개 — 잘하는 것과 약한 것 */
  readonly blurb: string
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
    name: '구야국',
    place: '김해',
    blurb: '쇠를 캐는 큰 나라. 군사가 가장 많다. 바닷가 국읍이 열려 있고 이웃이 많다.',
    bars: { army: 5, grain: 2, militia: 3, terrain: 2 },
  },
  {
    id: 'anya',
    name: '안야국',
    place: '함안',
    blurb: '산성과 언덕 위 국읍. 들어오는 길이 고개뿐이다. 곡식이 모자란다.',
    bars: { army: 3, grain: 2, militia: 3, terrain: 5 },
  },
  {
    id: 'miri',
    name: '미리미동국',
    place: '밀양 (설)',
    blurb: '낙동강 가의 곡창. 집이 많아 장정이 두껍다. 군대는 작다.',
    bars: { army: 2, grain: 5, militia: 5, terrain: 2 },
  },
  {
    id: 'goja',
    name: '고자미동국',
    place: '고성 (설)',
    blurb: '남해 포구. 수군을 쓰고 배로 교역한다. 뭍이 좁다.',
    bars: { army: 3, grain: 3, militia: 3, terrain: 3 },
  },
  {
    id: 'dokro',
    name: '독로국',
    place: '동래 (설)',
    blurb: '왜와 경계를 맞댄 포구. 철과 곡식이 바다로 들어온다. 장수가 세다. 땅은 하나뿐이다.',
    bars: { army: 3, grain: 4, militia: 3, terrain: 2 },
  },
  {
    id: 'us',
    name: '갯마을',
    place: '이름 없는 작은 나라',
    blurb: '가장 작은 나라. 군장이 신궁이다. 어렵다.',
    bars: { army: 1, grain: 2, militia: 1, terrain: 2 },
    hard: true,
  },
]
