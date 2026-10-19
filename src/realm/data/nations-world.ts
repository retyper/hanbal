/**
 * 삼한과 북녘 판의 나라 고르기 글 (data/regions/world.ts) — 삼한 남부 서른여섯 + 북녘·탐라 열넷.
 * 이름은 우리 역사책이 먼저, 위서는 곁들임 (WORLD §5 규칙 6). 자리가 학설이면 "설", 지어 앉힌 자리는 "지음". 막대는 1~5.
 * 낙랑·대방은 나라로 넣지 않는다 (WORLD §5 규칙 0).
 */
import type { NationInfo } from './nations.ts'
import { SOUTH_NATIONS } from './nations-south.ts'

const NEW: readonly NationInfo[] = [
  {
    id: 'goguryeo', name: '고구려', place: '집안 국내성',
    blurb: '압록강 가 산성의 나라. 말 탄 궁수와 쇠 화살촉. 다섯 나부를 묶어 가는 계루 왕실.',
    source: '『삼국사기』 고구려본기 — 동명성왕이 졸본에 세우고, 유리왕 22년 국내성으로 옮겼다. 위서의 계루부 [곁들임].',
    bars: { army: 5, grain: 2, militia: 4, terrain: 5 },
  },
  {
    id: 'biryuna', name: '비류나부', place: '혼강 윗줄기 (지음)',
    blurb: '비류수 골짜기의 옛 왕가. 고구려에 묶였지만 제 길을 꿈꾼다. 부여로 가는 숲길을 쥐었다.',
    source: '『삼국사기』 고구려본기 — 동명성왕 2년 비류국 송양이 와서 항복했다. 뒤에 비류나부로 나온다. 위서의 소노부(옛 왕가)로 보는 설.',
    bars: { army: 3, grain: 2, militia: 3, terrain: 4 },
  },
  {
    id: 'yeonna', name: '연나부', place: '압록 윗줄기 (지음)',
    blurb: '재상을 내는 큰 집안. 꾀가 많고 산이 높다. 개마고원으로 옥저와 이어진다.',
    source: '『삼국사기』 고구려본기 — 신대왕 때 연나부 조의 명림답부가 국상이 되었다. 위서의 절노부로 보는 설.',
    bars: { army: 3, grain: 2, militia: 3, terrain: 5 },
  },
  {
    id: 'hwanna', name: '환나부', place: '압록 아랫줄기 (지음)',
    blurb: '압록 하구의 나부. 서북 바깥 길목으로 장사꾼이 드나들어 곡식과 철이 들어온다.',
    source: '『삼국사기』 고구려본기 — 태조왕 때 환나부가 나온다. 위서의 순노부로 보는 설. 자리는 전하지 않는다.',
    bars: { army: 3, grain: 3, militia: 3, terrain: 3 },
  },
  {
    id: 'gwanna', name: '관나부', place: '독로강 강계 (지음)',
    blurb: '적유령 쇠골을 쥔 쇠의 나부. 청천강 들로 내려가는 고개를 지킨다.',
    source: '『삼국사기』 고구려본기 — 태조왕 20년 관나부 패자 달가가 조나를 쳤다. 위서의 관노부.',
    bars: { army: 4, grain: 1, militia: 3, terrain: 4 },
  },
  {
    id: 'buyeo', name: '부여', place: '길림 (설)',
    blurb: '송화강 들의 오랜 왕국. 말과 흰 옷의 나라. 네 가가 사방을 나눠 다스려 왕의 힘이 늘 흔들린다.',
    source: '『삼국유사』 북부여·동부여 — 해모수·해부루·금와. 『삼국사기』 고구려본기 — 대소왕이 고구려와 다퉜다.',
    bars: { army: 4, grain: 4, militia: 4, terrain: 2 },
  },
  {
    id: 'maga', name: '마가', place: '부여 서북 들 (지음)',
    blurb: '말을 맡은 가. 말이 가장 많고 날래다. 곡식은 넉넉지 않다.',
    source: '위서 동이전 부여전 — 마가·우가·저가·구가가 사출도를 나눠 맡았다 [위서]. 우리 책에는 가의 이름이 남지 않았다.',
    bars: { army: 3, grain: 2, militia: 2, terrain: 2 },
  },
  {
    id: 'uga', name: '우가', place: '부여 서남 들 (지음)',
    blurb: '소를 맡은 가. 들이 넓어 곡식이 넉넉하다. 고구려로 가는 휘발하 골짜기와 맞닿았다.',
    source: '위서 동이전 부여전 — 사출도의 우가 [위서].',
    bars: { army: 2, grain: 4, militia: 3, terrain: 2 },
  },
  {
    id: 'jeoga', name: '저가', place: '부여 동쪽 숲 (지음)',
    blurb: '돼지를 맡은 가. 장광재령 숲속 사냥꾼들. 목단강 숲길로 옥저와 이어진다.',
    source: '위서 동이전 부여전 — 사출도의 저가 [위서].',
    bars: { army: 3, grain: 2, militia: 3, terrain: 4 },
  },
  {
    id: 'guga', name: '구가', place: '송화강 북쪽 (지음)',
    blurb: '개를 맡은 가. 송화강 너머 가장 먼 들. 말이 있고 밤길에 밝다.',
    source: '위서 동이전 부여전 — 사출도의 구가 [위서].',
    bars: { army: 2, grain: 3, militia: 2, terrain: 3 },
  },
  {
    id: 'dongokjeo', name: '동옥저', place: '함흥 (설)',
    blurb: '동해 바닷가의 기름진 땅. 소금과 물고기가 넉넉하다. 큰 왕 없이 읍락마다 장수가 있다.',
    source: '『삼국사기』 고구려본기 — 태조왕 4년 동옥저를 쳐서 성읍으로 삼았다. 위서 동옥저전 [곁들임].',
    bars: { army: 2, grain: 4, militia: 3, terrain: 3 },
  },
  {
    id: 'bukokjeo', name: '북옥저', place: '두만강 아래 (설)',
    blurb: '두만강 가 숲과 바닷가. 겨울이 길고 춥다. 백두산 기슭과 해란강 들이 이웃이다.',
    source: '『삼국사기』 고구려본기 — 동명성왕 10년 북옥저를 쳐서 성읍으로 삼았다.',
    bars: { army: 2, grain: 2, militia: 2, terrain: 4 },
  },
  {
    id: 'bullae', name: '불내', place: '원산·안변 (설)',
    blurb: '동예의 큰 읍락. 키 작은 과하마와 박달나무 활(단궁)의 고장. 손잡은 나라는 자객의 활이 싸게 오른다.',
    source: '위서 동이전 예전 — 불내예, 과하마·반어피·단궁 [위서]. 『삼국사기』 신라본기 남해차차웅 16년 북명 사람이 예왕의 도장을 바쳤다.',
    bars: { army: 3, grain: 3, militia: 3, terrain: 3 },
  },
  {
    id: 'tamna', name: '탐라', place: '제주',
    blurb: '바다 건너 큰 섬. 뱃길로만 닿는다. 작지만 아무도 쉽게 건너오지 못한다.',
    source: '『삼국사기』 백제본기 문주왕 2년 탐라국이 방물을 바쳤다 (시대는 뒤). 『고려사』 지리지 — 고을나·양을나·부을나 세 사람이 땅에서 솟았다. 위서의 주호 [곁들임].',
    bars: { army: 1, grain: 2, militia: 2, terrain: 5 },
  },
]

export const WORLD_NATIONS: readonly NationInfo[] = [...SOUTH_NATIONS, ...NEW]
