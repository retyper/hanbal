/**
 * 영남 판의 나라 고르기 글 (data/regions/yeongnam.ts) — 이름은 우리 역사책이 먼저, 위서는 곁들임 (WORLD §5 규칙 6).
 * 자리가 학설이면 "설". 막대는 1~5.
 */
import type { NationInfo } from './nations.ts'

export const YEONGNAM_NATIONS: readonly NationInfo[] = [
  {
    id: 'saro', name: '사로국', place: '경주',
    blurb: '동해 쪽 분지의 큰 나라. 토함산 산성과 감포 항구를 쥐었다. 이웃이 많아 사방에서 다툰다.',
    source: '『삼국사기』 신라본기 — 혁거세가 세운 나라, 뒤의 신라. 위서에는 사로국.',
    bars: { army: 5, grain: 4, militia: 4, terrain: 3 },
  },
  {
    id: 'guya', name: '가락국', place: '김해',
    blurb: '쇠를 캐는 바닷가 큰 나라. 물금 철광과 낙동강 하구를 쥐었다.',
    source: '『삼국유사』 가락국기 — 수로왕의 나라, 뒤의 금관가야. 위서에는 구야국.',
    bars: { army: 5, grain: 2, militia: 3, terrain: 3 },
  },
  {
    id: 'daegaya', name: '대가야', place: '고령',
    blurb: '낙동강 서쪽 언덕 위 도읍. 야로 철광이 있고 가야산 소도가 곁에 있다.',
    source: '『삼국사기』 지리지 — 고령은 "본래 대가야국". 『삼국유사』 오가야에도 든다.',
    bars: { army: 4, grain: 3, militia: 3, terrain: 4 },
  },
  {
    id: 'anya', name: '아라국', place: '함안',
    blurb: '산성과 언덕 위 도읍. 남강과 낙동강이 만나는 나루를 지킨다.',
    source: '『삼국사기』 지리지 — 함안은 "본래 아시량국, 아나가야라고도 한다". 위서에는 안야국.',
    bars: { army: 3, grain: 2, militia: 3, terrain: 5 },
  },
  {
    id: 'miri', name: '추화국', place: '밀양 (설)',
    blurb: '낙동강 가의 곡창. 집이 많아 장정이 두껍다. 군대는 작다.',
    source: '『삼국사기』 지리지 — 밀양은 "본래 추화군". 나라 이름으로 쓴 것은 설이다.',
    bars: { army: 2, grain: 5, militia: 5, terrain: 2 },
  },
  {
    id: 'dabeol', name: '다벌국', place: '대구',
    blurb: '금호강과 낙동강 사이 너른 분지. 팔공산을 등졌다. 사방이 열려 있다.',
    source: '『삼국사기』 신라본기 파사이사금 — 비지국·초팔국과 함께 아울렀다는 다벌국. 대구로 보는 설.',
    bars: { army: 3, grain: 4, militia: 3, terrain: 2 },
  },
  {
    id: 'sabeol', name: '사벌국', place: '상주',
    blurb: '북쪽 낙동강 상류의 나라. 말이 조금 있다. 남쪽 나라들과 멀다.',
    source: '『삼국사기』 지리지 — 상주는 첨해왕 때 사벌국을 빼앗아 주로 삼았다.',
    bars: { army: 3, grain: 3, militia: 3, terrain: 3 },
  },
  {
    id: 'dokro', name: '거칠산국', place: '동래',
    blurb: '바다 건너와 맞댄 항구. 기장 포구까지 쥐었다. 철과 곡식이 바다로 들어온다.',
    source: '『삼국사기』 거도전 — 신라 장수 거도가 친 나라. 지리지에 동래는 "본래 거칠산군".',
    bars: { army: 3, grain: 3, militia: 3, terrain: 3 },
  },
  {
    id: 'goja', name: '고자국', place: '고성',
    blurb: '남해 항구. 수군을 쓰고 배로 교역한다. 뭍이 좁다.',
    source: '『삼국사기』 지리지 — 고성은 "본래 고자군". 포상팔국의 고사포, 뒤의 소가야.',
    bars: { army: 3, grain: 3, militia: 3, terrain: 3 },
  },
  {
    id: 'usisan', name: '우시산국', place: '울산',
    blurb: '동해의 쇠 나라. 달천 철광이 있다. 사로와 거칠산 사이에 끼었다.',
    source: '『삼국사기』 거도전 — 거도가 거칠산국과 함께 친 우시산국. 울산으로 본다.',
    bars: { army: 3, grain: 2, militia: 2, terrain: 3 },
  },
  {
    id: 'bihwa', name: '비화가야', place: '창녕',
    blurb: '낙동강 동쪽 늪가의 나라. 나루 셋이 모인다.',
    source: '『삼국유사』 오가야 — 비화가야(지금의 창녕).',
    bars: { army: 3, grain: 3, militia: 3, terrain: 2 },
  },
  {
    id: 'jomun', name: '조문국', place: '의성',
    blurb: '북쪽 언덕의 나라. 너른 들에 말을 친다.',
    source: '『삼국사기』 신라본기 벌휴이사금 — 조문국을 쳐서 아울렀다.',
    bars: { army: 3, grain: 3, militia: 3, terrain: 3 },
  },
  {
    id: 'golbeol', name: '골벌국', place: '영천',
    blurb: '사로와 다벌 사이의 작은 나라. 고개가 많다.',
    source: '『삼국사기』 신라본기 조분이사금 — 골벌국 왕 아음부가 무리를 이끌고 항복했다.',
    bars: { army: 2, grain: 2, militia: 2, terrain: 4 },
  },
  {
    id: 'apdok', name: '압독국', place: '경산',
    blurb: '다벌 동쪽의 들. 이웃이 모두 크다.',
    source: '『삼국사기』 신라본기 파사이사금 — 압독국 왕이 항복했다.',
    bars: { army: 2, grain: 3, militia: 2, terrain: 2 },
  },
  {
    id: 'iseo', name: '이서국', place: '청도',
    blurb: '비슬산 너머 산골 나라. 가지산 소도가 곁에 있다.',
    source: '『삼국사기』 신라본기 유례이사금 — 이서국이 금성을 쳤다.',
    bars: { army: 2, grain: 2, militia: 2, terrain: 4 },
  },
  {
    id: 'byeokjin', name: '벽진국', place: '성주',
    blurb: '가야산 동쪽의 나라. 성산가야라고도 한다.',
    source: '『삼국유사』 오가야 — 성산가야(벽진이라고도 한다).',
    bars: { army: 2, grain: 3, militia: 2, terrain: 3 },
  },
  {
    id: 'gammun', name: '감문국', place: '김천',
    blurb: '서북쪽 고갯마루의 나라. 서쪽 산골로 길이 난다.',
    source: '『삼국사기』 신라본기 조분이사금 — 감문국을 쳐서 군으로 삼았다.',
    bars: { army: 2, grain: 2, militia: 2, terrain: 3 },
  },
  {
    id: 'samul', name: '사물국', place: '사천',
    blurb: '남해 서쪽 끝의 포구. 남해 섬과 진주 들이 곁에 있다.',
    source: '『삼국사기』 지리지 — 사천은 "본래 사물현". 포상팔국의 하나로 본다.',
    bars: { army: 2, grain: 2, militia: 2, terrain: 3 },
  },
  {
    id: 'eumjeup', name: '음즙벌국', place: '안강',
    blurb: '사로 북쪽 들과 영일 포구. 작고 약하다.',
    source: '『삼국사기』 신라본기 파사이사금 — 음즙벌국과 실직곡국이 땅을 다투었다.',
    bars: { army: 2, grain: 2, militia: 2, terrain: 2 },
  },
  {
    id: 'chopal', name: '초팔국', place: '합천 초계',
    blurb: '황강 가의 작은 나라. 서쪽 거창 들로 길이 난다.',
    source: '『삼국사기』 신라본기 파사이사금 — 비지국·다벌국과 함께 아울렀다는 초팔국.',
    bars: { army: 1, grain: 2, militia: 2, terrain: 3 },
  },
  {
    id: 'us', name: '골포국', place: '마산 (설)',
    blurb: '가장 작은 바닷가 나라. 땅은 좁아도 매눈의 활 솜씨는 바다 건너까지 알려졌다. 어렵다.',
    source: '『삼국사기』 물계자전·나해이사금 — 바닷가 여덟 나라(포상팔국)의 하나.',
    bars: { army: 1, grain: 2, militia: 1, terrain: 2 },
    hard: true,
  },
]
