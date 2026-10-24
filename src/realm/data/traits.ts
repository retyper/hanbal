/**
 * 장수 특성 열여섯 (docs/realm/HEROES.md §2) — 팰월드의 패시브. 화면은 이것만 읽는다; 효과의 숫자는 P.realm.trait*,
 * 효과를 거는 곳은 엔진(heroes.ts · season · economy · diplomacy · battle)이 id 로 찾는다.
 * 등급은 오방색 (SYSTEMS §5-2): 흑 보통 · 백 좋음 · 청 드묾 · 황 귀함 · 적 전설(명장만, 첫판엔 없다).
 */

export type TraitGrade = 'common' | 'good' | 'rare' | 'precious' | 'legend'

export interface TraitInfo {
  readonly id: string
  readonly name: string
  readonly grade: TraitGrade
  /** 나쁜 특성 — 화면이 붉게 */
  readonly bad?: boolean
  /** 한 문장으로 무엇을 하는지 */
  readonly line: string
}

export const TRAITS: readonly TraitInfo[] = [
  { id: 'farmer', name: '농사꾼', grade: 'common', line: '맡은 고을의 가을 수확이 25% 늘어난다' },
  { id: 'mountain', name: '산사람', grade: 'common', line: '고갯길로 기습할 때 숨기 쉽다' },
  { id: 'river', name: '물길잡이', grade: 'common', line: '나루·뱃길로 기습할 때 숨기 쉽다' },
  { id: 'glutton', name: '잔치꾼', grade: 'common', bad: true, line: '군사들과 툭하면 술판을 벌인다 — 이끄는 군대가 곡식을 20% 더 쓴다' },
  { id: 'coward', name: '겁 많음', grade: 'common', bad: true, line: '지면 먼저 달아난다. 안 잡히지만 군대 사기가 더 꺾인다' },
  { id: 'smith', name: '대장장이', grade: 'good', line: '맡은 고을이 계절마다 철을 낸다' },
  { id: 'careful', name: '신중', grade: 'good', line: '맡은 고을의 경계가 늘 높다. 기습을 잘 막는다' },
  { id: 'drinker', name: '술꾼', grade: 'good', line: '매력 +1, 대신 맡은 고을 경계가 느슨하다' },
  { id: 'trader', name: '장사꾼', grade: 'good', line: '교역 사신을 받아 줄 확률이 오른다' },
  { id: 'nighteye', name: '밤눈', grade: 'good', line: '모든 기습에서 숨기 쉽다' },
  { id: 'archer', name: '명궁', grade: 'rare', line: '자객으로 보내면 암살이 잘 된다. 이끄는 군대 궁수도 조금 세다' },
  { id: 'charm', name: '매혹', grade: 'rare', line: '사신을 받아 줄 확률이 크게 오르고, 포로를 빨리 회유한다' },
  { id: 'shaman', name: '무당 핏줄', grade: 'rare', line: '그 나라 제사의 효과가 두 배다' },
  { id: 'ironhand', name: '철의 손', grade: 'precious', line: '맡은 고을에서 뽑는 군사가 철검을 든다' },
  { id: 'hundred', name: '백 사람의 이름', grade: 'precious', line: '맡은 고을의 장정이 1.5배로 선다' },
  { id: 'traitor', name: '반골의 상', grade: 'common', bad: true, line: '충성이 낮으면 적과 내통한다. 사로잡히면 쉽게 넘어온다' },
  { id: 'steadfast', name: '일편단심', grade: 'good', line: '사로잡혀도 옛 주인을 저버리지 않는다. 회유가 거의 먹히지 않는다' },
]

export const TRAIT: Readonly<Record<string, TraitInfo>> = Object.fromEntries(TRAITS.map((t) => [t.id, t]))

/** 오방색 — 등급의 색 */
export const GRADE_COLOR: Readonly<Record<TraitGrade, string>> = {
  common: '#5a5a5a', good: '#e8e2d0', rare: '#3a7bd5', precious: '#d9b336', legend: '#c8402a',
}

export const GRADE_NAME: Readonly<Record<TraitGrade, string>> = {
  common: '보통', good: '좋음', rare: '드묾', precious: '귀함', legend: '전설',
}
