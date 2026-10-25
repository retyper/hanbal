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
    id: 'brothers', n: 0, region: 'tutorial', nation: 'baekje', name: '형제의 강', era: '기원전 18년 · 한강', hero: '온조',
    hook: '졸본을 떠나온 두 형제. 형은 바다로, 아우는 강으로 — 한강의 주인은 하나다.',
    goal: '형 비류의 미추홀 도읍을 쥔다',
    art: 'keyart/tutorial.jpg',
    source: '『삼국사기』 백제본기 — 온조는 하남 위례성에 도읍하고, 비류는 미추홀에 가 살았다.',
    scenario: { id: 'brothers', win: [{ kind: 'hold', nodes: ['tut-michuhol-cap'] }] },
  },
  // 1장 — 배우는 판 다음, 손을 놓고 1:1 로 제대로 붙는다 (형 10-25: "튜토리얼은 0장으로 두고 1장은 1:1로 제대로 싸워보게")
  {
    id: 'mahan', n: 1, region: 'mahan', nation: 'baekje', name: '온조, 마한을 아우르다', era: '8년 · 한강에서 차령까지', hero: '온조',
    hook: '위례에 선 지 스물여섯 해. 남쪽의 큰 나라 마한은 백제를 아직 제 울타리 안 작은 나라로 본다. 온조는 사냥을 간다며 군사를 일으킨다.',
    goal: '마한의 목지 도읍과 원산성·금현성을 쥔다',
    art: 'keyart/mahan.jpg',
    source: '『삼국사기』 백제본기 온조왕 26·27년 — 왕이 사냥한다 하고 마한을 습격해 그 국읍을 아울렀다. 원산·금현 두 성만이 굳게 지키다 이듬해 항복했다.',
    // 기한 열 해 — 마한은 먼저 치고, 버티기만 해서는 이기지 못한다
    scenario: { id: 'mahan', win: [{ kind: 'hold', nodes: ['mh-mokji-cap', 'mh-wonsan', 'mh-geumhyeon'] }], limit: 40 },
  },
  {
    id: 'jumong', n: 2, region: 'jumong', nation: 'goguryeo', name: '주몽, 졸본에 서다', era: '기원전 37년 · 졸본', hero: '주몽',
    hook: '동부여를 빠져나온 활 잘 쏘는 사내. 비류수 가에 나라를 세우자 송양왕이 활 솜씨를 겨루자 한다.',
    goal: '송양의 비류국과 동맹을 맺거나 조공을 받고, 행인국과 북옥저 도읍을 차지한다',
    art: 'keyart/jumong.jpg',
    source: '『삼국사기』 고구려본기 — 송양이 나라를 들어 항복하니 그 땅을 다물도라 하였다.',
    // 기한 열두 해 — 손 놓고 있어도 끝이 온다 (점검 10-25: 기한이 없어 놀고 있어도 지지 않았다)
    scenario: { id: 'jumong', win: [{ kind: 'submit', factions: ['biryuna'], how: 'either' }, { kind: 'hold', nodes: ['jm-haengin-cap', 'jm-okjeo-cap'] }], limit: 48 },
  },
  // 아래는 아직 판이 없는 장 — 카드는 "짓는 중"으로 보인다 (형 10-23: "캠페인 수 너무 적음"). 그림은 표지가 오기 전까지 사건 그림을 빌린다
  {
    id: 'seorabeol', n: 3, region: 'seorabeol', nation: 'saro', name: '서라벌 여섯 마을', era: '기원전 57년 · 경주', hero: '혁거세',
    hook: '나정 곁 붉은 알에서 난 아이. 여섯 마을의 촌장들이 그를 임금으로 받들기로 한다 — 칼 대신 마음으로.',
    goal: '여섯 마을이 모두 따르게 한다 — 동맹이든 조공이든 (마을을 치면 다른 마을의 마음이 식는다)',
    art: 'event/event-golden-egg.jpg',
    source: '『삼국사기』 신라본기 — 여섯 마을 사람들이 혁거세를 받들어 임금으로 삼았다. 『삼국유사』 기이편.',
    // 칼을 덜 뽑는 장 — 마을을 치면 다른 마을들의 마음이 식는다 (scenario.fewerSwords) · 기한 열 해
    scenario: { id: 'seorabeol', win: [{ kind: 'submit', factions: ['sr-yangsan', 'sr-goheo', 'sr-jinji', 'sr-daesu', 'sr-gari', 'sr-goya'], how: 'either' }], limit: 40 },
  },
  {
    id: 'gujibong', n: 4, region: null, nation: 'garak', name: '구지봉의 노래', era: '42년 · 김해', hero: '김수로',
    hook: '「거북아 거북아 머리를 내어라」 — 하늘에서 내린 금빛 알. 바다 건너 탈해가 왕위를 내놓으라 한다.',
    goal: '아홉 간이 모두 따르고, 철을 판 나라가 다섯을 넘는다',
    art: 'event/event-egg-birth.jpg',
    source: '『삼국유사』 가락국기 — 구지봉에서 아홉 간이 노래하니 금합에 알 여섯이 내려왔다.',
    scenario: { id: 'gujibong', win: [] },
  },
  {
    id: 'daemusin', n: 5, region: null, nation: 'goguryeo', name: '대무신왕, 부여를 치다', era: '22년 · 동부여', hero: '대무신왕',
    hook: '할아버지 주몽을 쫓던 그 부여. 봄·여름이면 부여 도읍 앞 들은 말이 빠지는 수렁이 된다.',
    goal: '동부여 도읍을 치고 대소왕을 쓰러뜨린다',
    art: 'event/event-winter-ambush.jpg',
    source: '『삼국사기』 고구려본기 대무신왕 5년 — 부여를 쳐서 괴유가 대소왕의 머리를 베었다.',
    scenario: { id: 'daemusin', win: [] },
  },
  {
    id: 'jamyeonggo', n: 6, region: null, nation: 'goguryeo', name: '자명고', era: '32년 · 낙랑', hero: '호동 왕자',
    hook: '적이 오면 스스로 우는 북. 낙랑 공주의 칼끝이 북을 찢어야 기습이 먹힌다 — 대가가 따른다.',
    goal: '낙랑 도읍을 기습으로 쥔다',
    art: 'event/event-night-raid.jpg',
    source: '『삼국사기』 고구려본기 대무신왕 15년 — 낙랑 공주가 무기고의 북과 뿔피리를 찢었다.',
    scenario: { id: 'jamyeonggo', win: [] },
  },
  {
    id: 'samseonghyeol', n: 7, region: null, nation: 'tamna', name: '삼성혈', era: '아득한 옛날 · 탐라', hero: '고을나',
    hook: '한라산 북쪽 땅에서 솟아난 세 신인. 바다 건너 벽랑국의 세 공주가 상자를 타고 온다.',
    goal: '섬의 마을을 다 모으고 벽랑국 공주와 혼인한다',
    art: 'event/event-whale-hunt.jpg',
    source: '『고려사』 지리지 탐라 — 고·양·부 세 신인이 땅에서 솟아나 활을 쏘아 살 곳을 정했다.',
    scenario: { id: 'samseonghyeol', win: [] },
  },
  {
    id: 'namusaja', n: 8, region: null, nation: 'saro', name: '나무 사자', era: '512년 · 우산국', hero: '이사부',
    hook: '배마다 나무 사자를 싣고 간다. "항복하지 않으면 이 짐승을 풀어 밟아 죽이겠다."',
    goal: '우산국이 싸우지 않고 항복한다',
    art: 'event/event-eight-harbours.jpg',
    source: '『삼국사기』 신라본기 지증왕 13년 — 이사부가 나무 사자로 우산국을 항복시켰다.',
    scenario: { id: 'namusaja', win: [] },
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
