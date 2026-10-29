/**
 * 삼한 남부 판의 나라 고르기 글 (data/regions/south.ts) — 영남 스물하나 + 새 열다섯.
 * 이름은 우리 역사책이 먼저, 위서는 곁들임 (WORLD §5 규칙 6). 자리가 학설이면 "설". 막대는 1~5.
 */
import type { NationInfo } from './nations.ts'
import { YEONGNAM_NATIONS } from './nations-yeongnam.ts'

const NEW: readonly NationInfo[] = [
  {
    id: 'baekje', name: '백제', place: '서울 송파·하남 (설)',
    blurb: '한강 가 위례의 젊은 나라. 마한 맹주 목지국을 노린다. 북한강 너머 맥국과 맞선다.',
    source: '『삼국사기』 백제본기: 온조가 위례성에 세운 나라. 마한의 한 나라에서 커 갔다. 위서에는 백제국(伯濟國).',
    bars: { army: 4, grain: 3, militia: 3, terrain: 3 },
  },
  {
    id: 'mokji', name: '목지국', place: '천안 직산 (설)',
    blurb: '마한 여러 나라의 맹주. 집이 많고 아산만 포구를 쥐었다. 사방에서 나라들이 둘러싼다.',
    source: '위서 동이전: 진왕이 목지국을 다스린다 [위서]. 『삼국사기』 백제본기의 「마한」이 이 나라로 보는 설이 있다.',
    bars: { army: 4, grain: 4, militia: 4, terrain: 2 },
  },
  {
    id: 'michuhol', name: '미추홀', place: '인천',
    blurb: '바닷가 소금의 나라. 한강 어귀와 서해 뱃길을 쥐었다. 땅이 짜서 곡식이 모자란다.',
    source: '『삼국사기』 백제본기: 비류가 미추홀에 자리 잡았다.',
    bars: { army: 2, grain: 2, militia: 2, terrain: 3 },
  },
  {
    id: 'ungcheon', name: '웅천국', place: '공주 (설)',
    blurb: '금강 가 언덕 위 도읍. 마한 소도가 곁에 있다. 차령을 넘는 길목이다.',
    source: '『삼국사기』 지리지. 공주는 "본래 백제 웅천". 마한 시절 이름은 전하지 않아 고을 이름으로 부른다 [설].',
    bars: { army: 3, grain: 3, militia: 3, terrain: 4 },
  },
  {
    id: 'sangdang', name: '상당국', place: '청주 (설)',
    blurb: '국원(충주) 철광을 쥔 쇠의 나라. 새재·추풍령 너머 진한과 맞닿는다.',
    source: '『삼국사기』 지리지. 청주는 "본래 백제 상당" [설]. 충주는 철이 나던 고장.',
    bars: { army: 4, grain: 2, militia: 3, terrain: 3 },
  },
  {
    id: 'geonma', name: '건마국', place: '익산 (설)',
    blurb: '호남 들판의 큰 나라. 벽골 들과 군산 포구를 끼었다. 곡식이 넉넉하다.',
    source: '위서 동이전의 건마국 [위서]. 『삼국사기』 지리지의 "금마저"(익산)로 보는 설.',
    bars: { army: 3, grain: 5, militia: 4, terrain: 2 },
  },
  {
    id: 'wansan', name: '완산국', place: '전주 (설)',
    blurb: '들판과 진안 고원 사이의 나라. 남원·정읍으로 가는 길이 모인다.',
    source: '『삼국사기』 지리지. 전주는 "본래 백제 완산" [설].',
    bars: { army: 3, grain: 4, militia: 3, terrain: 3 },
  },
  {
    id: 'gosaburi', name: '고사부리국', place: '정읍 고부 (설)',
    blurb: '노령 아래 작은 나라. 영광 갯가로 바다가 열려 있다.',
    source: '『삼국사기』 지리지. 고부는 "본래 백제 고사부리" [설]. 위서의 고비리국으로 보는 설도 있다.',
    bars: { army: 2, grain: 3, militia: 2, terrain: 3 },
  },
  {
    id: 'balla', name: '발라국', place: '나주 (설)',
    blurb: '영산강의 큰 무덤의 나라. 목포 포구로 바다를 쥐었다. 마한 남쪽의 맹주.',
    source: '『삼국사기』 지리지. 나주는 "본래 백제 발라" [설]. 영산강 가 큰 독무덤의 고장.',
    bars: { army: 4, grain: 4, militia: 3, terrain: 2 },
  },
  {
    id: 'mujin', name: '무진국', place: '광주 (설)',
    blurb: '무등산 아래 언덕 위 도읍. 영산강 윗줄기와 노령 고개를 지킨다.',
    source: '『삼국사기』 지리지. 광주는 "본래 백제 무진주" [설].',
    bars: { army: 3, grain: 3, militia: 3, terrain: 4 },
  },
  {
    id: 'gampyeong', name: '감평국', place: '순천 (설)',
    blurb: '남해 바닷가 나라. 여수 포구와 섬진강 하구로 가야와 오간다.',
    source: '『삼국사기』 지리지. 순천은 "본래 백제 감평" [설].',
    bars: { army: 3, grain: 2, militia: 2, terrain: 3 },
  },
  {
    id: 'goryong', name: '고룡국', place: '남원 (설)',
    blurb: '지리산 서쪽 골짜기 나라. 팔량치를 넘으면 가야 땅이다.',
    source: '『삼국사기』 지리지. 남원은 "본래 백제 고룡" [설].',
    bars: { army: 2, grain: 2, militia: 3, terrain: 5 },
  },
  {
    id: 'maek', name: '맥국', place: '춘천',
    blurb: '북한강 산골의 나라. 날랜 군사가 많고 평창 고원에서 말을 친다.',
    source: '『삼국사기』 지리지. 삭주(춘천)는 "본래 맥국".',
    bars: { army: 4, grain: 2, militia: 3, terrain: 4 },
  },
  {
    id: 'siljik', name: '실직국', place: '삼척',
    blurb: '동해 바닷가의 작은 나라. 소금과 물고기로 산다. 울진 갯가로 진한과 이어진다.',
    source: '『삼국사기』 신라본기 파사이사금, 실직국이 와서 항복했다.',
    bars: { army: 2, grain: 2, militia: 2, terrain: 3 },
  },
  {
    id: 'haseulla', name: '하슬라', place: '강릉',
    blurb: '동예의 남쪽 읍락. 과하마(작은 말)와 단궁(박달나무 활), 물범 가죽이 난다. 대관령 너머가 맥국.',
    source: '『삼국사기』 지리지. 명주(강릉)는 "본래 하서량(하슬라)". 동예의 특산(과하마·반어피·단궁)은 위서 동이전 [위서].',
    bars: { army: 3, grain: 2, militia: 3, terrain: 4 },
  },
]

export const SOUTH_NATIONS: readonly NationInfo[] = [...YEONGNAM_NATIONS, ...NEW]
