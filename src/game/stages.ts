/**
 * 스테이지 저작 — 챕터 1~4 (40판)
 *
 * ── 난이도 정책 (2026-08-23 전면 개정) ──
 *
 * 사용자 피드백: **"과녁이 너무 작아서 어려운데. 수십단계까지는 쉽게 갈 수 있게 해줘야지."**
 *
 * 이전 정책은 "average 봇 클리어율 55~75%"를 맞추는 것이었고, 그 결과 3판부터 과녁 각크기가
 * h=0.0034까지 조여졌다. 1200px 화면에서 **반경 4px짜리 점**이다.
 * 봇은 각오차(mrad)로만 조준해서 이걸 못 느끼지만, 사람은 화면 픽셀로 조준한다.
 * 즉 봇 클리어율은 **사람의 체감 난이도를 재는 자가 아니었다.**
 *
 * 그리고 이 게임은 공부 사이에 30초씩 하는 게임이다 (GDD 1장 C1·C2).
 * 앞의 수십 판은 "실력을 시험하는 구간"이 아니라 **손에 익히고 성장을 체감하는 구간**이어야 한다.
 *
 * ### 새 정책
 *
 * 1. **난이도의 척도는 화면 반경(px)이다.** 각크기 h는 카메라가 사거리를 화면 폭에 맞추므로
 *    화면 반경 ≈ h × 뷰포트 폭이다. 1280px 기준으로 아래 바닥을 지킨다:
 *      - 1~20판: 화면 반경 **30px 이상** (h ≥ 0.023)
 *      - 21~40판: 화면 반경 **15px 이상** (h ≥ 0.012)
 *    이 바닥 아래로 내려가면 "조준 실력"이 아니라 "안 보이는 것 맞히기"가 된다.
 *
 * 2. **반경을 손으로 적지 않는다.** `hFor(n)` 곡선에서 계산한다.
 *    손으로 적으면 판마다 제각각이 되고, 예전처럼 2판(h=0.029)에서 3판(h=0.0034)으로
 *    8.5배 급락하는 절벽이 생겨도 아무도 눈치채지 못한다.
 *
 * 3. **앞 40판의 난이도는 크기가 아니라 메커닉으로 만든다.**
 *    거리·높이 변화 → 연쇄 → 이동 과녁 → 바람 → 조합. 매 판 새로 배울 게 하나씩 있으면
 *    과녁이 커도 지루하지 않다. 정밀 조준을 요구하는 구간은 40판 이후다.
 *
 * 4. **산포·떨림 계수를 키워 어렵게 만들지 않는다.** (`releaseScatter`·`baseAmp`·`steadyZone`)
 *    그건 "쏘는 대로 안 맞는다"는 문제를 되돌리는 짓이다 — GDD 2장 빨간 바 계약 참조.
 *
 * ### 봇 클리어율 목표 (docs/BALANCE.md와 동기화)
 *   1~10판 95~100% · 11~25판 90~100% · 26~40판 80~95%
 *   숫자가 높은 게 정상이다. 여기서 실력을 가르지 않는다.
 *
 * ── 그 밖의 규칙 ──
 * - 한 판은 화살 5~8발 = 30초~1분 (제약 C1). 여벌 화살을 항상 2발 이상 남긴다.
 * - 제한 시간 없음 (제약 C2 — 시간 압박은 "아무 때나 끊어도 손해 없음"과 어긋난다).
 * - 좌표: 궁수의 손은 (0, 1.4). 과녁 y는 지면(y=0) 기준 높이.
 */
import { clamp } from '../core/math.ts'
import { makeRng, seedFrom } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import type { StageDef, TargetSpec } from '../sim/types.ts'
import { endlessStage } from './endless.ts'
import { BASE_SCORE, CAMPAIGN_STAGES, angularSize, specOf } from './stagekit.ts'
import type { Spot } from './stagekit.ts'

/** k발 명중을 기준선으로 하는 **별 2개 문턱**. 클리어 조건이 아니다 — 클리어는 과녁 전멸이다. */
const need = (k: number): number => BASE_SCORE * k

/** 각크기 곡선에서 실제 반경을 계산한다. 반경을 손으로 적는 일은 없다 (stagekit.ts). */
function mk(n: number, s: Spot): TargetSpec {
  return specOf(angularSize(n), s)
}

/**
 * 챕터의 이름. HUD 머리글과 판 시작 자막이 쓴다.
 *
 * 판마다 이름을 따로 짓지 않는 이유: 앞 40판은 **챕터 단위로** 배우는 게 하나씩이고
 * (teach 는 그 안의 한 걸음이다), 40개의 이름은 지어봐야 서로 구분이 안 된다.
 * 판 하나하나의 성격은 teach 가 자막 둘째 줄로 말한다.
 */
const CHAPTER_NAMES: readonly string[] = ['거리와 낙차', '연쇄', '바람과 이동', '관통과 조합']

interface Layout {
  /** 이 판에서 무엇을 배우는가. 한 판에 하나씩. */
  teach: string
  arrows: number
  /**
   * 보상 기준선이 되는 명중 수. **클리어 조건이 아니다** — 클리어는 과녁을 다 없애는 것이다.
   * 이 점수를 넘긴 만큼 훈련치를 더 받는다 (game/progression.ts).
   */
  hits: number
  wind?: number
  spots: Spot[]
}

/**
 * 40판의 설계. 크기는 hFor()가 정하므로 여기엔 **배치와 메커닉만** 적는다.
 *
 * 챕터 1 (1~10)  당기고 놓기 · 거리와 낙차
 * 챕터 2 (11~20) 공중 과녁과 연쇄 — 이 게임의 쾌감 레이어
 * 챕터 3 (21~30) 이동 과녁 · 첫 바람
 * 챕터 4 (31~40) 관통 · 조합
 */
const LAYOUTS: readonly Layout[] = [
  // ── 챕터 1 — 당김과 놓음 ─────────────────────────────────────
  { teach: '당기고 놓는다. 그것뿐이다.', arrows: 5, hits: 1, spots: [{ x: 8, y: 1.4 }] },
  { teach: '조준점은 손이 아니라 마우스가 정한다', arrows: 5, hits: 1, spots: [{ x: 11, y: 2.6 }] },
  { teach: '과녁이 둘이면 순서를 고른다', arrows: 6, hits: 2, spots: [{ x: 10, y: 1.5 }, { x: 14, y: 2.7 }] },
  { teach: '거리가 늘면 화살이 떨어진다 — 위로 겨눈다', arrows: 6, hits: 2, spots: [{ x: 14, y: 1.6 }, { x: 19, y: 2.8 }] },
  { teach: '셋을 연달아. 빨간 바 안에서 쏘는 리듬', arrows: 7, hits: 3, spots: [{ x: 12, y: 1.7 }, { x: 17, y: 2.9 }, { x: 22, y: 2.1 }] },
  { teach: '높이 차가 커진다 — 낙차를 몸으로 읽는다', arrows: 7, hits: 3, spots: [{ x: 15, y: 1.5 }, { x: 20, y: 4.2 }, { x: 25, y: 2.0 }] },
  { teach: '더 멀리. 만작이 왜 필요한지 알게 된다', arrows: 7, hits: 3, spots: [{ x: 22, y: 1.7 }, { x: 27, y: 3.0 }, { x: 32, y: 2.2 }] },
  { teach: '낮은 과녁 — 아래로도 겨눌 수 있다', arrows: 7, hits: 3, spots: [{ x: 18, y: 0.6 }, { x: 24, y: 2.4 }, { x: 30, y: 1.1 }] },
  { teach: '넷. 화살을 아껴 쓰기 시작한다', arrows: 8, hits: 4, spots: [{ x: 14, y: 1.6 }, { x: 20, y: 3.2 }, { x: 26, y: 1.8 }, { x: 32, y: 2.9 }] },
  { teach: '챕터 1 종합', arrows: 8, hits: 4, spots: [{ x: 16, y: 0.9 }, { x: 22, y: 3.6 }, { x: 28, y: 1.7 }, { x: 34, y: 2.8 }] },

  // ── 챕터 2 — 공중 과녁과 연쇄 ────────────────────────────────
  { teach: '공중 과녁은 맞으면 떨어진다', arrows: 6, hits: 2, spots: [{ x: 16, y: 5.0, kind: 'aerial' }, { x: 16, y: 1.6 }] },
  { teach: '떨어지는 과녁이 아래를 친다 — 연쇄', arrows: 6, hits: 2, spots: [{ x: 18, y: 5.4, kind: 'aerial' }, { x: 18, y: 3.2 }, { x: 18, y: 1.4 }] },
  { teach: '한 발로 여럿. 순서를 설계한다', arrows: 6, hits: 3, spots: [{ x: 20, y: 6.0, kind: 'aerial' }, { x: 20, y: 4.2 }, { x: 20, y: 2.6 }, { x: 20, y: 1.2 }] },
  { teach: '연쇄 기둥이 둘', arrows: 7, hits: 4, spots: [{ x: 15, y: 5.2, kind: 'aerial' }, { x: 15, y: 2.8 }, { x: 24, y: 5.6, kind: 'aerial' }, { x: 24, y: 3.0 }] },
  { teach: '연쇄 사이를 벌린다 — 조준이 정확해야 이어진다', arrows: 7, hits: 3, spots: [{ x: 22, y: 6.4, kind: 'aerial' }, { x: 22, y: 4.0 }, { x: 22, y: 1.8 }] },
  { teach: '공중과 지상을 섞는다', arrows: 7, hits: 4, spots: [{ x: 14, y: 1.5 }, { x: 20, y: 5.8, kind: 'aerial' }, { x: 20, y: 3.0 }, { x: 27, y: 1.9 }] },
  { teach: '높은 연쇄 — 화살이 올라가는 데 시간이 걸린다', arrows: 7, hits: 3, spots: [{ x: 26, y: 7.2, kind: 'aerial' }, { x: 26, y: 4.6 }, { x: 26, y: 2.2 }] },
  { teach: '작은 연쇄 알갱이', arrows: 7, hits: 4, spots: [{ x: 21, y: 6.0, kind: 'aerial' }, { x: 21, y: 4.4, size: 0.8 }, { x: 21, y: 3.0, size: 0.8 }, { x: 21, y: 1.6, size: 0.8 }] },
  { teach: '기둥 셋. 어디부터 무너뜨릴까', arrows: 8, hits: 5, spots: [{ x: 13, y: 4.8, kind: 'aerial' }, { x: 13, y: 2.4 }, { x: 21, y: 5.6, kind: 'aerial' }, { x: 21, y: 2.8 }, { x: 29, y: 5.0, kind: 'aerial' }, { x: 29, y: 2.5 }] },
  { teach: '챕터 2 종합 — 보로로로록', arrows: 8, hits: 5, spots: [{ x: 18, y: 7.0, kind: 'aerial' }, { x: 18, y: 5.0 }, { x: 18, y: 3.2 }, { x: 26, y: 6.0, kind: 'aerial' }, { x: 26, y: 3.8 }, { x: 26, y: 1.8 }] },

  // ── 챕터 3 — 이동 과녁과 바람 ───────────────────────────────
  { teach: '과녁이 위아래로 움직인다 — 느리게', arrows: 6, hits: 2, spots: [{ x: 16, y: 2.6, kind: 'moving', ampY: 1.0, freq: 0.25 }, { x: 22, y: 2.0 }] },
  { teach: '움직이는 과녁은 멈추는 순간이 있다', arrows: 6, hits: 2, spots: [{ x: 18, y: 3.0, kind: 'moving', ampY: 1.6, freq: 0.3 }, { x: 25, y: 2.2, kind: 'moving', ampY: 1.2, freq: 0.22 }] },
  { teach: '좌우로 움직이는 과녁 — 리드 샷', arrows: 7, hits: 3, spots: [{ x: 20, y: 2.4, kind: 'moving', ampX: 2.2, freq: 0.28 }, { x: 27, y: 3.2 }, { x: 14, y: 1.6 }] },
  // 화살 7 -> 8, 빠른 이동 과녁 둘에 크기 +25%: 이 판만 유독 뚫렸다
  // (봇 클리어 81%, 목표 90~100% · 화살 소진 실패 19% · 발당 명중 56%).
  // 빠른 이동 과녁 둘을 한꺼번에 요구하는 유일한 판이다. **움직이는 과녁은 같은 각크기라도
  // 훨씬 어렵다** — 조준점이 멈춰 있지 않기 때문이고, 그 값을 크기로 돌려주는 게
  // 난이도 정책(크기가 아니라 메커닉으로 어렵게 한다)에 맞는 방향이다. endless.ts 도 같은 규칙이다.
  { teach: '빨라진다', arrows: 8, hits: 3, spots: [{ x: 17, y: 2.8, kind: 'moving', size: 1.25, ampY: 1.8, freq: 0.45 }, { x: 24, y: 2.0, kind: 'moving', size: 1.25, ampX: 2.0, freq: 0.4 }, { x: 31, y: 3.0 }] },
  { teach: '움직이는 공중 과녁 — 연쇄까지', arrows: 7, hits: 3, spots: [{ x: 20, y: 5.6, kind: 'aerial' }, { x: 20, y: 3.0, kind: 'moving', ampX: 1.8, freq: 0.3 }, { x: 20, y: 1.4 }] },
  { teach: '바람이 분다 — 오른쪽으로 밀린다', arrows: 7, hits: 3, wind: 2.5, spots: [{ x: 20, y: 1.8 }, { x: 26, y: 2.8 }, { x: 32, y: 2.0 }] },
  // ★ 여기서 처음으로 **왼쪽 바람**이 온다. 예전엔 모든 판의 풍속이 양수라
  //   바람이 언제나 오른쪽으로만 불었다 (형의 지적). 방향이 하나뿐이면 배울 게 없다 —
  //   그건 바람이 아니라 그냥 조준점 보정값이다.
  { teach: '바람은 반대로도 분다 — 깃발을 봐라', arrows: 7, hits: 3, wind: -3.5, spots: [{ x: 22, y: 2.0 }, { x: 29, y: 3.2 }, { x: 35, y: 2.4 }] },
  { teach: '바람 + 낙차', arrows: 7, hits: 3, wind: 4.0, spots: [{ x: 24, y: 5.0 }, { x: 30, y: 1.6 }, { x: 36, y: 3.4 }] },
  { teach: '바람 속의 이동 과녁', arrows: 8, hits: 4, wind: -3.0, spots: [{ x: 18, y: 2.4, kind: 'moving', ampY: 1.4, freq: 0.3 }, { x: 25, y: 3.0 }, { x: 31, y: 1.8, kind: 'moving', ampX: 2.0, freq: 0.25 }, { x: 37, y: 2.6 }] },
  { teach: '챕터 3 종합', arrows: 8, hits: 4, wind: 4.5, spots: [{ x: 19, y: 6.2, kind: 'aerial' }, { x: 19, y: 3.4 }, { x: 27, y: 2.0, kind: 'moving', ampX: 2.4, freq: 0.32 }, { x: 34, y: 3.0 }] },

  // ── 챕터 4 — 관통과 조합 ────────────────────────────────────
  { teach: '관통 과녁 — 화살이 뚫고 지나간다', arrows: 6, hits: 2, spots: [{ x: 16, y: 2.2, kind: 'pierceable' }, { x: 22, y: 2.2, kind: 'pierceable' }] },
  { teach: '일직선으로 세우면 한 발에 여럿', arrows: 6, hits: 3, spots: [{ x: 15, y: 2.0, kind: 'pierceable' }, { x: 21, y: 2.0, kind: 'pierceable' }, { x: 27, y: 2.0, kind: 'pierceable' }] },
  { teach: '비스듬한 일렬 — 각도를 찾는다', arrows: 7, hits: 3, spots: [{ x: 16, y: 1.6, kind: 'pierceable' }, { x: 23, y: 3.0, kind: 'pierceable' }, { x: 30, y: 4.4, kind: 'pierceable' }] },
  { teach: '관통 + 연쇄', arrows: 7, hits: 4, spots: [{ x: 18, y: 5.4, kind: 'aerial' }, { x: 18, y: 3.0, kind: 'pierceable' }, { x: 24, y: 3.0, kind: 'pierceable' }, { x: 24, y: 1.4 }] },
  { teach: '바람 속의 관통', arrows: 7, hits: 3, wind: -3.5, spots: [{ x: 17, y: 2.4, kind: 'pierceable' }, { x: 24, y: 2.4, kind: 'pierceable' }, { x: 31, y: 2.4, kind: 'pierceable' }] },
  { teach: '움직이는 관통줄', arrows: 7, hits: 3, spots: [{ x: 18, y: 2.6, kind: 'pierceable', ampY: 1.2, freq: 0.24 }, { x: 25, y: 2.6, kind: 'pierceable', ampY: 1.2, freq: 0.24 }, { x: 32, y: 2.6, kind: 'pierceable' }] },
  { teach: '두 층 — 위와 아래를 나눠 푼다', arrows: 8, hits: 4, spots: [{ x: 17, y: 5.8, kind: 'aerial' }, { x: 23, y: 5.8, kind: 'aerial' }, { x: 17, y: 2.2 }, { x: 23, y: 2.2 }] },
  { teach: '멀리 + 바람 + 이동', arrows: 8, hits: 4, wind: 4.0, spots: [{ x: 26, y: 2.0, kind: 'moving', ampY: 1.6, freq: 0.35 }, { x: 33, y: 3.4 }, { x: 39, y: 2.2 }, { x: 20, y: 1.4 }] },
  { teach: '큰 연쇄 — 한 발로 화면을 무너뜨린다', arrows: 8, hits: 5, spots: [{ x: 22, y: 7.6, kind: 'aerial' }, { x: 22, y: 5.8 }, { x: 22, y: 4.2 }, { x: 22, y: 2.8 }, { x: 22, y: 1.4 }] },
  { teach: '챕터 4 종합 — 지금까지 배운 전부', arrows: 8, hits: 5, wind: -3.5, spots: [{ x: 18, y: 6.4, kind: 'aerial' }, { x: 18, y: 3.6, kind: 'pierceable' }, { x: 25, y: 3.6, kind: 'pierceable' }, { x: 31, y: 2.0, kind: 'moving', ampX: 2.2, freq: 0.3 }, { x: 37, y: 3.2 }] },
]

function build(layout: Layout, i: number): StageDef {
  const n = i + 1
  const chapter = Math.floor(i / 10) + 1
  const id = `${chapter}-${(i % 10) + 1}`
  const stage: StageDef = {
    id,
    title: CHAPTER_NAMES[chapter - 1] ?? '',
    hint: layout.teach,
    seed: seedFrom(id),
    arrows: layout.arrows,
    targetScore: need(layout.hits),
    wind: layout.wind ?? 0,
    targets: layout.spots.map((s) => mk(n, s)),
  }
  return stage
}

export const STAGES: readonly StageDef[] = LAYOUTS.map(build)

/** 이 판에서 무엇을 배우는가. 디버그·저작용. */
export function stageTeach(index: number): string {
  const l = LAYOUTS[clamp(Math.floor(index), 0, LAYOUTS.length - 1)]
  return l?.teach ?? ''
}

/** 판 번호(1부터)의 과녁 각크기. 밸런스 도구가 화면 반경 바닥을 검사하는 데 쓴다. */
export function stageH(n: number): number {
  return angularSize(n)
}

/**
 * 판 하나. index 는 0부터 세는 전체 판 번호다.
 *
 * ★ **자르지 않는다.** 예전에는 마지막 판으로 clamp 했는데, 그러면 40판을 깬 사람이
 * 4-10을 무한히 다시 푼다 — 형이 본 "일정 스테이지 이후엔 똑같은 과녁만 나온다"가 이거였다.
 * 41판부터는 endless.ts 가 결정론적으로 굽는다 (같은 판 번호 = 언제나 같은 판).
 */
export function getStage(index: number): StageDef {
  const i = Math.floor(index)
  if (i < 0) return STAGES[0] as StageDef
  // ★ 10판마다 보스가 저작 판을 밀어내고 선다 (docs/RUN.md 3장). 여정의 마디다.
  if ((i + 1) % BOSS_EVERY === 0) return bossStage(i)
  if (i < STAGES.length) return STAGES[i] as StageDef
  return endlessStage(i)
}

/** 보스 주기. 10판 = 여정의 한 마디 (RUN.md). */
export const BOSS_EVERY = 10

/**
 * 보스판 (docs/RUN.md 3장) — 거대한 것이 나를 향해 걸어온다.
 *
 * 수치의 논리:
 *  - 체력은 마디가 갈수록 오른다 (10판 6 → 20판 7 → …). 화살은 체력 + 3 —
 *    몸통만 쏘면 세 발의 여유뿐이고, **머리를 맞히는 만큼 여유가 생긴다** (bossCritDmg).
 *  - 시작 x는 사거리의 0.9. bossSpeed 0.55 m/s로 궁수(2.5m)까지 약 60초 —
 *    판 하나의 시간(30초~1분, C1)과 같은 자리다. 늑장은 부리되 무한하지는 않다.
 */
function bossStage(i: number): StageDef {
  const cycle = Math.floor((i + 1) / BOSS_EVERY)
  const hp = Math.min(7, Math.floor(P.target.bossHp) + (cycle - 1))
  // id는 저작 판의 규칙(챕터-판)을 그대로 쓴다 — 옛 '4-10'의 별 기록이 보스에게 이어진다.
  const id = `${cycle}-10`
  const reach = 40
  // 배치 변주는 판 번호가 시드다 (A1). 같은 마디는 언제나 같은 보스판.
  const rng = makeRng(seedFrom(`hanbal.boss.${cycle}`))
  const targets: TargetSpec[] = [
    {
      kind: 'boss',
      x: reach * rng.range(0.84, 0.94),
      y: rng.range(2.0, 3.2),
      r: 1.7,
      hp,
      score: 150,
    },
  ]
  // 두 번째 마디부터 호위가 붙는다 — 보스만 노리면 호위가 남아 판이 안 끝난다.
  const escorts = Math.min(2, cycle - 1)
  for (let e = 0; e < escorts; e++) {
    targets.push({ kind: 'static', x: reach * rng.range(0.35, 0.6), y: rng.range(1.2, 4.5), r: 0.55, score: 80 })
  }
  return {
    id,
    title: '보스',
    hint: '머리가 약점이다 — 정중앙 판정으로 두 발 몫',
    seed: seedFrom(id),
    arrows: Math.min(10, hp + 3 + escorts),
    targetScore: need(Math.min(5, hp)),
    wind: 0,
    targets,
  }
}

/** 손으로 적은 캠페인의 길이. 이 뒤는 무한 구간이다 (stagekit.CAMPAIGN_STAGES 와 같은 값). */
export const CAMPAIGN = CAMPAIGN_STAGES
