/**
 * 캠페인 — 삼국의 새벽 (docs/realm/CAMPAIGN.md). 장은 배우는 차례로 연다: 형제의 강 → 주몽 → …
 * 장마다 판(region) 하나와 그 장의 목표(Scenario). 판이 아직 없는 장은 `region: null` — 화면에 "짓는 중"으로 보인다.
 * 뿌리는 『삼국사기』·『삼국유사』가 먼저.
 */
import type { RegionId, Scenario } from '../types.ts'

export interface Chapter {
  readonly id: string
  /** 몇째 장 */
  readonly n: number
  readonly region: RegionId | null
  /** 우리 나라 — 장은 나라를 고르지 않는다 */
  readonly nation: string
  readonly name: string
  readonly era: string
  /** 주인공 */
  readonly hero: string
  readonly hook: string
  /** 이 장의 목표를 한 줄로 (카드 펼침) */
  readonly goal: string
  readonly art: string
  /** 사서는 이렇게 적었다 — 장을 이기면 끝 화면에 */
  readonly source: string
  readonly scenario: Scenario
}

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'brothers', n: 1, region: 'tutorial', nation: 'baekje', name: '형제의 강', era: '기원전 18년 · 한강', hero: '온조',
    hook: '졸본을 떠나온 두 형제. 형은 바다로, 아우는 강으로 — 한강의 주인은 하나다.',
    goal: '형 비류의 미추홀 도읍을 쥔다',
    art: 'keyart/tutorial.jpg',
    source: '『삼국사기』 백제본기 — 온조는 하남 위례성에 도읍하고, 비류는 미추홀에 가 살았다.',
    scenario: { id: 'brothers', win: [{ kind: 'hold', nodes: ['tut-michuhol-cap'] }] },
  },
  {
    id: 'jumong', n: 2, region: 'jumong', nation: 'goguryeo', name: '주몽, 졸본에 서다', era: '기원전 37년 · 졸본', hero: '주몽',
    hook: '동부여를 빠져나온 활 잘 쏘는 사내. 비류수 가에 나라를 세우자 송양왕이 활 솜씨를 겨루자 한다.',
    goal: '비류국 송양이 스스로 따르게 하고, 행인국과 북옥저 도읍을 쥔다',
    art: 'keyart/jumong.jpg',
    source: '『삼국사기』 고구려본기 — 송양이 나라를 들어 항복하니 그 땅을 다물도라 하였다.',
    scenario: { id: 'jumong', win: [{ kind: 'submit', factions: ['biryuna'], how: 'either' }, { kind: 'hold', nodes: ['jm-haengin-cap', 'jm-okjeo-cap'] }] },
  },
]

/** 장의 목표를 판에 얹을 꼴로 — 판마다 제 것을 가진다 (marks 가 판마다 쌓인다) */
export function chapterScenario(id: string): Scenario {
  const c = CHAPTERS.find((x) => x.id === id)
  if (c === undefined) throw new Error(`없는 장: ${id}`)
  return { ...c.scenario, win: c.scenario.win.map((g) => ({ ...g })) }
}

/** 이 판(region)이 어느 장인가 — 장이 아니면 undefined */
export function chapterOfRegion(region: RegionId): Chapter | undefined {
  return CHAPTERS.find((c) => c.region === region)
}
