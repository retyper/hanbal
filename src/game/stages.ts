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
import { BASE_SCORE, CAMPAIGN_STAGES, angularSize, arrowFloor, specOf } from './stagekit.ts'
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
const CHAPTER_NAMES: readonly string[] = ['거리와 낙차', '연쇄', '바람과 이동', '관통과 조합', '곡사']

interface Layout {
  /** 이 판에서 무엇을 배우는가. 한 판에 하나씩. */
  teach: string
  arrows: number
  /** 땅의 꺾은선 (sim/terrain.ts). 없으면 평지. 과녁 y는 그 자리 땅에서 잰 높이다. */
  ground?: { x: number; y: number }[]
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
  // ★ 언덕 (2026-09-03, 형: "언덕이랑 높낮이차"). 가운데 과녁이 4.2m 허공에 뜬 대신 **언덕 위**에 선다.
  { teach: '높이 차가 커진다 — 언덕 위를 겨눈다', arrows: 7, hits: 3, ground: [{ x: 4, y: 0 }, { x: 12, y: 0.3 }, { x: 20, y: 1.9 }, { x: 24, y: 1.0 }, { x: 30, y: 0 }], spots: [{ x: 15, y: 1.5 }, { x: 20, y: 1.6 }, { x: 25, y: 2.0 }] },
  { teach: '더 멀리. 만작이 왜 필요한지 알게 된다', arrows: 7, hits: 3, spots: [{ x: 22, y: 1.7 }, { x: 27, y: 3.0 }, { x: 32, y: 2.2 }] },
  { teach: '낮은 과녁 — 아래로도 겨눌 수 있다', arrows: 7, hits: 3, spots: [{ x: 18, y: 0.6 }, { x: 24, y: 2.4 }, { x: 30, y: 1.1 }] },
  // ★ 화약통 소개 (docs/GAP.md — 앵그리버드: "한 발이 구조를 무너뜨린다").
  // 화살 4 · 과녁 4 — 하나씩 쏘면 **한 발도 못 빗나가야** 겨우 깬다. 통을 터뜨리면 한 발이다.
  // 여기서는 벌하지 않고 가르친다. 조이는 건 16판부터.
  { teach: '화약통 — 터뜨리면 둘레가 같이 간다', arrows: 4, hits: 3, spots: [{ x: 20, y: 1.8, kind: 'barrel' }, { x: 22.15, y: 1.8 }, { x: 21.07, y: 3.66 }, { x: 18.93, y: 3.66 }] },
  { teach: '챕터 1 종합', arrows: 8, hits: 4, spots: [{ x: 16, y: 0.9 }, { x: 22, y: 3.6 }, { x: 28, y: 1.7 }, { x: 34, y: 2.8 }] },

  // ── 챕터 2 — 공중 과녁과 연쇄 ────────────────────────────────
  { teach: '공중 과녁은 맞으면 떨어진다', arrows: 6, hits: 2, spots: [{ x: 16, y: 5.0, kind: 'aerial' }, { x: 16, y: 1.6 }] },
  { teach: '떨어지는 과녁이 아래를 친다 — 연쇄', arrows: 6, hits: 2, spots: [{ x: 18, y: 5.4, kind: 'aerial' }, { x: 18, y: 3.2 }, { x: 18, y: 1.4 }] },
  { teach: '한 발로 여럿. 순서를 설계한다', arrows: 6, hits: 3, spots: [{ x: 20, y: 6.0, kind: 'aerial' }, { x: 20, y: 4.2 }, { x: 20, y: 2.6 }, { x: 20, y: 1.2 }] },
  { teach: '연쇄 기둥이 둘', arrows: 7, hits: 4, spots: [{ x: 15, y: 5.2, kind: 'aerial' }, { x: 15, y: 2.8 }, { x: 24, y: 5.6, kind: 'aerial' }, { x: 24, y: 3.0 }] },
  { teach: '연쇄 사이를 벌린다 — 조준이 정확해야 이어진다', arrows: 7, hits: 3, spots: [{ x: 22, y: 6.4, kind: 'aerial' }, { x: 22, y: 4.0 }, { x: 22, y: 1.8 }] },
  // ★ 통은 적으로 변환되지 않는다 (convertToFoes). 그래서 이 판은 **사수 셋 + 화약통**이다 —
  // 사수는 두세 발을 버티지만 폭발에는 한 번에 죽는다. 스나이퍼 게임의 '환경 처치'다.
  { teach: '사수 곁의 화약통 — 사람보다 통을 노려라', arrows: 3, hits: 3, spots: [{ x: 22, y: 1.9, kind: 'barrel' }, { x: 24.15, y: 1.9 }, { x: 23.07, y: 3.76 }, { x: 20.93, y: 3.76 }] },
  { teach: '언덕 위의 높은 연쇄 — 화살이 올라가는 데 시간이 걸린다', arrows: 7, hits: 3, ground: [{ x: 6, y: 0 }, { x: 18, y: 0.6 }, { x: 26, y: 2.4 }, { x: 34, y: 0.8 }, { x: 40, y: 0 }], spots: [{ x: 26, y: 5.4, kind: 'aerial' }, { x: 26, y: 3.2 }, { x: 26, y: 1.4 }] },
  { teach: '작은 연쇄 알갱이', arrows: 7, hits: 4, spots: [{ x: 21, y: 6.0, kind: 'aerial' }, { x: 21, y: 4.4, size: 0.8 }, { x: 21, y: 3.0, size: 0.8 }, { x: 21, y: 1.6, size: 0.8 }] },
  // ★ 통이 둘 — 화살은 정답 두 발 + 여유. 하나씩 쏘면 절대 모자란다.
  { teach: '통이 둘이다. 한 발씩 나눠 쓴다', arrows: 3, hits: 4, spots: [{ x: 17, y: 1.9, kind: 'barrel' }, { x: 18.07, y: 3.76 }, { x: 15.93, y: 3.76 }, { x: 27, y: 1.9, kind: 'barrel' }, { x: 28.07, y: 3.76 }, { x: 25.93, y: 3.76 }] },
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
  // 골짜기 — 바람이 부는 판에 땅이 내려앉는다. 골 건너의 과녁은 낙차를 두 번 읽어야 한다.
  { teach: '바람이 분다 — 골짜기 건너로 밀린다', arrows: 7, hits: 3, wind: 2.5, ground: [{ x: 5, y: 0 }, { x: 14, y: -0.2 }, { x: 22, y: -1.6 }, { x: 30, y: 0.4 }, { x: 36, y: 1.4 }, { x: 42, y: 0.6 }], spots: [{ x: 20, y: 1.8 }, { x: 26, y: 2.8 }, { x: 32, y: 2.0 }] },
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
  // ★ 36판+ 셋에 하나는 정예(명중률 2배)다. 그래도 통 한 발이면 셋이 같이 간다 —
  // **깊어질수록 통의 값이 커진다.** 이게 이 메커닉의 성장 곡선이다.
  { teach: '깊은 곳에서도 답은 하나 — 통', arrows: 3, hits: 3, spots: [{ x: 24, y: 2.0, kind: 'barrel' }, { x: 26.15, y: 2.0 }, { x: 25.07, y: 3.86 }, { x: 22.93, y: 3.86 }] },
  { teach: '멀리 + 바람 + 이동', arrows: 8, hits: 4, wind: 4.0, spots: [{ x: 26, y: 2.0, kind: 'moving', ampY: 1.6, freq: 0.35 }, { x: 33, y: 3.4 }, { x: 39, y: 2.2 }, { x: 20, y: 1.4 }] },
  { teach: '큰 연쇄 — 한 발로 화면을 무너뜨린다', arrows: 8, hits: 5, spots: [{ x: 22, y: 7.6, kind: 'aerial' }, { x: 22, y: 5.8 }, { x: 22, y: 4.2 }, { x: 22, y: 2.8 }, { x: 22, y: 1.4 }] },
  { teach: '챕터 4 종합 — 지금까지 배운 전부', arrows: 8, hits: 5, wind: -3.5, spots: [{ x: 18, y: 6.4, kind: 'aerial' }, { x: 18, y: 3.6, kind: 'pierceable' }, { x: 25, y: 3.6, kind: 'pierceable' }, { x: 31, y: 2.0, kind: 'moving', ampX: 2.2, freq: 0.3 }, { x: 37, y: 3.2 }] },
  // ── 챕터 5 — 곡사 (형: "더 멀리 쏘는 스테이지 — 멋지게 곡사로") ────────
  // 정조준 사거리(~20m)를 훌쩍 넘긴다. 만작 초속 ~60m/s의 최대 사거리는 320m이므로
  // 55~115m는 전부 닿되, **위로 겨눠 포물선을 그려야만** 닿는 거리다. 반경은 각크기
  // 곡선이 거리에 비례해 키우니 저작은 x만 밀면 된다. 낙하 시간이 1~2초라 화살을
  // 눈으로 좇는 맛이 이 챕터의 상품이다.
  { teach: '멀다. 과녁이 아니라 하늘에 쏜다', arrows: 6, hits: 1, spots: [{ x: 58, y: 1.8 }] },
  { teach: '떨어지는 각을 몸에 새긴다', arrows: 7, hits: 2, spots: [{ x: 55, y: 2.2 }, { x: 74, y: 1.6 }] },
  { teach: '하늘에서 연쇄를 떨어뜨린다', arrows: 7, hits: 2, spots: [{ x: 64, y: 7.4, kind: 'aerial' }, { x: 64, y: 2.0 }] },
  { teach: '먼 화살일수록 바람을 오래 맞는다', arrows: 8, hits: 2, wind: 4, spots: [{ x: 62, y: 2.0 }, { x: 80, y: 2.6 }] },
  { teach: '멀고 작다 — 만작이 아니면 흔들린다', arrows: 8, hits: 2, spots: [{ x: 70, y: 2.0, size: 0.8 }, { x: 88, y: 2.8, size: 0.8 }] },
  // ★ 곡사 + 통. 62m 밖의 통을 포물선으로 맞혀야 한다 — 이 챕터가 가르친 것과 화약이 만난다.
  { teach: '먼 통 하나가 셋을 끊는다 — 하늘로 겨눠라', arrows: 4, hits: 3, spots: [{ x: 62, y: 2.3, kind: 'barrel' }, { x: 64.15, y: 2.3 }, { x: 63.08, y: 4.16 }, { x: 60.92, y: 4.16 }] },
  { teach: '역풍의 곡사 — 깃발을 두 번 봐라', arrows: 8, hits: 2, wind: -5, spots: [{ x: 68, y: 2.2 }, { x: 84, y: 1.8 }] },
  { teach: '먼 곳에서 움직인다 — 낙하 시간만큼 앞을 본다', arrows: 8, hits: 2, spots: [{ x: 72, y: 2.6, kind: 'moving', size: 1.2, ampX: 3.0, freq: 0.18 }, { x: 58, y: 1.8 }] },
  { teach: '극원거리 — 화살이 뜬 채로 두 번 숨 쉰다', arrows: 9, hits: 2, spots: [{ x: 92, y: 2.2 }, { x: 112, y: 2.8 }] },
  { teach: '챕터 5 종합 — 온 마당이 사정거리다', arrows: 9, hits: 3, spots: [{ x: 48, y: 2.0 }, { x: 76, y: 6.8, kind: 'aerial' }, { x: 104, y: 2.4 }] },
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
  if (layout.ground !== undefined) stage.ground = layout.ground
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
  if (i < 0) return withArrowFloor(STAGES[0] as StageDef)
  // ★ 10판마다 보스가 저작 판을 밀어내고 선다 (docs/RUN.md 3장). 여정의 마디다.
  if ((i + 1) % BOSS_EVERY === 0) return withArrowFloor(bossStage(i))
  const base = i < STAGES.length ? (STAGES[i] as StageDef) : endlessStage(i)
  // ★ 10판을 넘으면 과녁만 있는 세상이 끝난다 — 적 궁수가 판에 선다 (docs/RUN.md 6장).
  //   "1~9까지는 과녁이어도, 10 이후부터는 나를 공격하게 해줘"(형).
  return withArrowFloor(i + 1 > BOSS_EVERY ? convertToFoes(base, i) : base)
}

/**
 * ★ **화살은 적보다 반드시 한 발 많다** (형, 2026-09-01: "어떤 상황에서도 게임 시작했을 때
 * 화살 수는 아무리 적어도 적 수보다 1개 더 많아야 해").
 *
 * 이 규칙은 저작보다 위에 선다. 그래서 판을 내보내는 **마지막 문**인 여기에 건다 —
 * 저작 40판·무한 생성·보스·전환(convertToFoes) 중 어느 길로 만들어졌든 전부 이 문을 지난다.
 * 각자의 자리에 따로 걸면 반드시 하나를 빠뜨리고, 빠뜨린 그 하나가 "이길 수 없는 판"이 된다.
 *
 * 이게 무엇을 이기는가:
 *   · 저작의 퍽퍽한 발수 (화약 상자 퍼즐판은 정답 발수만 줬다 — docs/GAP.md 1절)
 *   · 무한 구간의 상한 ARROWS_MAX(10) 과 보스판·전환의 Math.min(10, …)
 * 상한을 넘겨서라도 이 바닥을 지킨다. 판이 좀 길어지는 것(C1)과 수학적으로 못 깨는 것 중
 * 무엇이 더 나쁜지는 물어볼 필요가 없다.
 *
 * 기준은 game/progression.ts 의 `arrowFloor` 하나다 — 세는 법이 두 벌이면 언젠가 갈라진다.
 */
function withArrowFloor(stage: StageDef): StageDef {
  const floor = arrowFloor(stage)
  return stage.arrows >= floor ? stage : { ...stage, arrows: floor }
}

/**
 * 11판+ — 과녁의 세계가 끝나고 **전부 적이 된다** (형: "1~10은 과녁이지만 그다음부터는
 * 전부 적이어야"). 저작 판의 배치를 그대로 쓰되 껍데기를 바꾼다:
 *   static·pierceable → 창문의 사수 (look 1) — 높이 떠 있던 과녁 자리가 그대로 '창문'이다
 *   moving            → 숨었다 쏘는 사수 (look 2) — 예고 직전에 나와서 쏘고 도로 숨는다
 *   aerial            → 드론 (look 3) — 떠서 순찰하며 쏜다
 *   bonus             → 보급 그대로. 16판+ 일부는 기력 보급이 된다 (종류는 그림으로 구분)
 * 원본을 절대 고치지 않는다 — STAGES는 공유 객체다.
 *
 * 화살비 조절: 사수 수만큼 개별 발사 주기를 벌리고(firePeriod) 발사 시각을 어긋나게 한다.
 * n명이 있어도 들어오는 화살의 평균 간격은 혼자일 때와 크게 다르지 않게 — 예고를 읽고
 * 대응할 시간이 늘 있어야 한다 (RUN.md '예고 없는 피해는 없다').
 */
function convertToFoes(base: StageDef, i: number): StageDef {
  const n = i + 1
  const rng = makeRng(seedFrom(`hanbal.enemy.${n}`))
  const hp = Math.floor(foeHp(n))
  // 통(bomb)은 사람이 아니라 **환경**이다 — 사수 수에도 안 들어가고 적으로도 안 바뀐다.
  const foes = base.targets.filter(
    (t2) => t2.kind !== 'bonus' && t2.kind !== 'charger' && t2.kind !== 'barrel',
  ).length
  const period = P.enemy.shootEvery * Math.min(2.5, 1 + (foes - 1) * 0.4)
  const specs: TargetSpec[] = []
  let f = 0
  for (const t of base.targets) {
    if (t.kind === 'bonus') {
      // 깊은 판의 보급 일부는 기력이다 — 어느 쪽인지는 그림(화살/십자)이 말한다.
      if (n >= 16 && rng.next() < 0.35) specs.push({ ...t, give: 0, heal: Math.floor(P.enemy.healReward * 0.5) })
      else specs.push(t)
      continue
    }
    if (t.kind === 'charger') { specs.push(t); continue }
    // ★ 화약 상자는 그대로 둔다 (2026-08-31, docs/GAP.md).
    // 형: "화공 화약고 이런거 (…) 이걸 활용한 맵을 만들어야 퍼즐을 풀만할거아냐."
    // 저작된 통까지 사수로 바꿔버리면 11판부터는 폭발이 놓일 자리가 **판 어디에도 없다** —
    // 실제로 그랬고, 그래서 화약 메커닉이 실험장 밖으로 나오지 못했다.
    // 사수는 두세 발을 버티지만 폭발에는 한 번에 죽는다. 통이 곧 이 판의 정답이다.
    if (t.kind === 'barrel') { specs.push(t); continue }
    // 깊이별 정예화 (형: "명중률 높은 적·방어구 입은 적"): 36판+ 셋에 하나 정예,
    // 41판+ 셋에 하나 갑옷(헤드샷만 통한다).
    const elite = n >= 36 && f % 3 === 1
    const armored = n >= 41 && f % 3 === 2
    const fireDelay = P.enemy.windup + 1.5 + (f * period) / Math.max(1, foes)
    const common = { hp, fireDelay, firePeriod: period, score: 120 }
    if (elite) (common as TargetSpec).aimMul = 0.5
    if (armored) (common as TargetSpec).armored = true
    // ★ 반경은 **저작된 것을 물려받는다** (2026-08-31, 형: "5-9에서는 너무 멀어서 화면
    //   벗어나니까"). 예전엔 0.60·0.62·0.65 로 못박았는데, 그러면 stagekit 의 각크기 규칙
    //   (반경 = 각크기 × 거리)이 통째로 죽는다 — 112m 짜리 적이 0.62m면 화면에서 5px다.
    //   그게 5장(곡사, 55~115m)이 "안 보이고 화면 밖"이던 진짜 이유다.
    //   사람은 과녁보다 조금 크게 잡는다(foeR) — 몸통은 판때기보다 넓다.
    //   반경에는 **하한이 있다** (2026-08-31, 형: "창문이 너무 작아서 적이 거의 안보이는").
    //   각크기 규칙은 먼 적을 살리는 규칙이지 가까운 적을 점으로 만드는 규칙이 아니다.
    //   창은 이 r에서 나오므로(render/buildings.ts) r이 작으면 창도 사람도 같이 작아진다.
    const fr = Math.max(P.enemy.foeMinR, (t.r ?? 0.6) * P.enemy.foeR)
    if (t.kind === 'aerial') {
      specs.push({ kind: 'archer', look: 3, x: t.x, y: t.y, r: fr, ampX: 1.4, freq: 0.18, ...common })
    } else if (t.kind === 'moving') {
      specs.push({ kind: 'archer', look: 2, x: t.x, y: t.y, r: fr * 1.08, ...common })
    } else {
      specs.push({ kind: 'archer', look: 1, x: t.x, y: t.y, r: fr, ...common })
    }
    f++
  }
  // ── 금관 사수 — 현상금 (P.enemy.bounty*, 2026-09-02) ──
  // 창의 사수(look 1) 중 하나가 금관을 쓴다. 갑옷 사수는 제외 — 갑옷은 몸통을 막는 물건이라
  // 어차피 머리를 노려야 해서 현상금이 값을 못 한다. 난수는 위 rng 의 **뒤에서** 뽑는다 —
  // 앞의 보급 결정(rng.next)이 바뀌지 않게. 판 번호가 시드라 언제 켜도 같은 판에 같은 관이다.
  let bounty = false
  if (n >= Math.floor(P.enemy.bountyFrom) && rng.next() < P.enemy.bountyChance) {
    const cands: number[] = []
    for (let k = 0; k < specs.length; k++) {
      const sp = specs[k]
      if (sp !== undefined && sp.kind === 'archer' && sp.look === 1 && sp.armored !== true) cands.push(k)
    }
    if (cands.length > 0) {
      const pick = cands[Math.floor(rng.next() * cands.length)]
      if (pick !== undefined) {
        specs[pick] = { ...(specs[pick] as TargetSpec), bounty: true }
        bounty = true
      }
    }
  }
  // 사수는 두세 발을 버틴다 — **사수 하나에 한 발씩** 얹는다. 헤드샷이 절약이다.
  // (예전 ceil(0.6×n)은 사수 셋에 두 발이었다 — 몸통 두 발이 기준이면 셋에 여섯이 필요한
  //  판에 여덟 발이다. 실측으로 12판은 숙련 봇도 0%였다. 상한 10은 C1의 것이라 그대로.)
  return {
    ...base,
    arrows: Math.min(10, base.arrows + foes),
    targets: specs,
    // ★ 힌트도 바꾼다. 저작 판의 teach 는 과녁의 말("공중 과녁은 맞으면 떨어진다")인데,
    //   11판부터 그 자리에 서 있는 건 드론과 사수다. 화면이 하는 첫 설명이 눈앞의 것과
    //   다르면 그 뒤의 설명은 아무도 안 읽는다. 사수 판에는 사수의 말을 쓴다.
    hint: foeHint(n, base, specs) + (bounty ? ' · 금관의 머리엔 현상금' : ''),
  }
}

/**
 * 전환 사수의 체력 — 도입 경사 (P.enemy.convertHpEase*). 11판에서 낮게 시작해
 * convertHpEaseStages 판 동안 convertHp 로 올라오고, 31판부터 ×1.5.
 * 왜 경사인가는 params.ts 의 convertHpEase 주석에 실측과 함께 적었다.
 */
export function foeHp(n: number): number {
  const base = P.enemy.convertHp * (n >= 31 ? 1.5 : 1)
  const span = Math.max(1, Math.floor(P.enemy.convertHpEaseStages))
  const t = Math.min(1, Math.max(0, (n - (BOSS_EVERY + 1)) / span))
  const ease = P.enemy.convertHpEase + (1 - P.enemy.convertHpEase) * t
  return base * ease
}

/**
 * 사수 판의 한 줄 — 무엇이 서 있고 무엇을 먼저 해야 하는가.
 * 첫 사수 판(11)은 규칙을 가르치고, 그 뒤는 그 판의 구성이 말한다. 화약통이 있는 판은
 * 저작된 teach 가 이미 통의 말이라 그대로 둔다 (GAP.md 1절의 퍼즐판).
 */
function foeHint(n: number, base: StageDef, specs: readonly TargetSpec[]): string {
  if (n === BOSS_EVERY + 1) return '적이 활을 든다 — 당기는 쪽을 먼저 쏜다. 머리는 한 발이다'
  if (specs.some((s) => s.kind === 'barrel')) return base.hint ?? ''
  let win = 0
  let hide = 0
  let drone = 0
  for (const s of specs) {
    if (s.kind !== 'archer') continue
    if (s.look === 3) drone++
    else if (s.look === 2) hide++
    else win++
  }
  if (n === BOSS_EVERY + 2) return '체력은 판을 넘어 이어진다 — 맞기 전에 눕힌다'
  if (hide > 0 && drone === 0) return '숨은 사수는 당길 때만 나온다 — 그 틈이 유일하다'
  if (drone > 0 && hide === 0) return '드론은 떠서 돈다 — 멈칫하는 자리를 노린다'
  if (hide > 0 && drone > 0) return '숨는 놈과 나는 놈 — 먼저 당기는 쪽부터'
  if (win >= 3) return `창의 사수 ${win} — 가까운 창부터, 머리를 노린다`
  return '창의 사수 — 당기는 쪽을 먼저, 머리는 한 발이다'
}

/** 보스 주기. 10판 = 여정의 한 마디 (RUN.md). */
export const BOSS_EVERY = 10

/**
 * 체크포인트 — 보스를 잡은 자리 다음 판 (docs/RUN.md · 지도, 2026-08-26).
 *
 * 형: "보스깨면 죽었을때 직전보스 다음스테이지부터 시작하게." 마디는 언제나 순서대로만
 * 열린다 — 30판(3번째 보스)에 닿으려면 그 여정 안에서 10판·20판을 반드시 먼저 지난다
 * (지도로 점프해도 그 지점부터는 다시 순서대로 간다). 그래서 **누적 보스 처치 수
 * (save.bossKills, 줄지 않는다)가 곧 "몇 마디까지 열렸는가"다** — 새 필드가 필요 없다.
 *
 * bossKills=0 → 0(=1-1) · 1 → 10(=2-1) · 2 → 20(=3-1) · … 캠페인을 넘어서도 그대로
 * 이어진다(끝없는 구간도 10판마다 보스라 같은 식이 통한다).
 */
export function checkpointStage(bossKills: number): number {
  const n = Math.floor(bossKills)
  return n > 0 ? n * BOSS_EVERY : 0
}

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
  // ── 보스 로스터 — 마디마다 다른 놈이 온다 (형: "한 번 나온 보스는 좀 안 나와야지").
  //   4종이 순환하고, 한 바퀴 돌 때마다(rank) 체력이 오른다. 같은 놈을 다시 만나는 건
  //   최소 40판 뒤고, 그때는 더 세다.
  const variant = (cycle - 1) % 4
  const rank = Math.floor((cycle - 1) / 4)
  const dmg = Math.max(1, Math.floor(P.enemy.playerDamage))
  const crit = Math.max(1, Math.floor(P.target.bossCritDmg))
  const baseHp = Math.floor(P.target.bossHp) + rank * 2 * dmg
  const id = `${cycle}-10`
  const rng = makeRng(seedFrom(`hanbal.boss.${cycle}`))
  const reach = 40
  const targets: TargetSpec[] = []
  let title = '눈알귀신'
  let hint = '깔리면 끝장이다 — 눈을 쏴라'
  let hitsNeeded: number

  if (variant === 1) {
    // 갑주귀신 — 몸통 무효. 눈에 정확히 crit × N. 조준의 판이다.
    title = '갑주귀신'
    hint = '갑주는 눈을 못 덮는다 — 눈만 통한다'
    const eyeHits = 2 + rank
    targets.push({
      kind: 'boss', x: reach * rng.range(0.84, 0.94), y: rng.range(2.0, 3.0),
      r: 1.6, hp: crit * eyeHits, armored: true, look: 1, score: 200,
    })
    hitsNeeded = eyeHits
  } else if (variant === 2) {
    // 쌍둥이 눈알 — 둘로 갈라진 위협. 어느 쪽을 먼저 잡을지가 판단이다.
    title = '쌍눈귀신'
    hint = '둘 다 잡아야 한다 — 가까운 쪽부터'
    // ★ 보스는 헤드샷 한 방에 눕지 않는다 (형: "아무리 보스여도 즉사는 안 되고").
    //   어떤 단위든 체력이 헤드샷 피해보다 확실히 크게 바닥을 깐다.
    const each = Math.max(Math.floor(crit * 1.3), Math.floor(baseHp * 0.55))
    for (let e = 0; e < 2; e++) {
      targets.push({
        kind: 'boss', x: reach * (0.8 + e * 0.13), y: 1.6 + e * 1.6,
        r: 1.15, hp: each, speed: P.target.bossSpeed * (1 + e * 0.25), look: 2, score: 150,
      })
    }
    hitsNeeded = Math.ceil((each * 2) / Math.floor(dmg * 1.1))
  } else if (variant === 3) {
    // 폭주귀신 — 빠르다. 시간이 무기가 아니라 상대의 무기다.
    title = '폭주귀신'
    hint = '빨리 끝내라 — 저놈이 더 빠르다'
    const rushHp = Math.max(Math.floor(crit * 1.3), Math.floor(baseHp * 0.6))
    targets.push({
      kind: 'boss', x: reach * rng.range(0.88, 0.96), y: rng.range(2.0, 3.0),
      r: 1.45, hp: rushHp, speed: P.target.bossSpeed * 2.2, look: 3, score: 200,
    })
    hitsNeeded = Math.ceil(rushHp / Math.floor(dmg * 1.1))
  } else {
    // 눈알귀신 — 첫 관문. 느리게, 그러나 확실하게 온다.
    targets.push({
      kind: 'boss', x: reach * rng.range(0.84, 0.94), y: rng.range(2.0, 3.2),
      r: 1.7, hp: baseHp, score: 150,
    })
    hitsNeeded = Math.ceil(baseHp / Math.floor(dmg * 1.1))
  }

  // 두 번째 마디부터 호위가 붙는다 — 보스만 노리면 호위가 남아 판이 안 끝난다.
  //
  // ★ 2026-08-31 — 호위는 **사람이다.** 형: "보스판에 제발 과녁 좀 없애. 과녁이 대체 왜 있어."
  //   맞는 말이다. 귀신이 걸어오는 판에 과녁판이 세 개 서 있는 건 세계가 깨지는 것이고,
  //   무엇보다 11판부터 이 게임에는 과녁이 없다(convertToFoes) — 보스판만 예외였다.
  //   사수로 바꾸면 "보스만 보지 마라"는 원래 의도가 오히려 살아난다: 저쪽도 쏘기 때문이다.
  //   대신 발사 주기를 넉넉히 벌린다 — 보스를 상대하는 중에 화살비가 오면 그건 예고가 아니라 벌이다.
  const escorts = Math.min(2, cycle - 1)
  for (let e = 0; e < escorts; e++) {
    targets.push({
      kind: 'archer', look: 1, score: 120,
      x: reach * rng.range(0.35, 0.6), y: rng.range(1.2, 4.5), r: 0.6,
      hp: Math.floor(P.enemy.convertHp),
      fireDelay: P.enemy.windup + 3 + e * 2,
      firePeriod: P.enemy.shootEvery * 2.2,
    })
  }
  return {
    id,
    title,
    hint,
    seed: seedFrom(id),
    arrows: Math.min(10, hitsNeeded + 3 + escorts),
    targetScore: need(Math.min(5, hitsNeeded)),
    wind: 0,
    targets,
  }
}

/** 손으로 적은 캠페인의 길이. 이 뒤는 무한 구간이다 (stagekit.CAMPAIGN_STAGES 와 같은 값). */
export const CAMPAIGN = CAMPAIGN_STAGES
