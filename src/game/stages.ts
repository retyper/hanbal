/**
 * 챕터 1 — 당김과 놓음 (스테이지 저작)
 *
 * 설계 원칙 (GDD 1장 C1, 6장):
 *   - 한 판은 화살 5~8발 = 30초~1분. 판이 길어지면 "공부 사이에 한 판"이 성립하지 않는다.
 *   - 챕터 1은 새 메커닉을 하나도 얹지 않는다. **거리와 과녁 크기만으로** 난이도를 만든다.
 *   - 바람은 전부 0. 바람은 챕터 4에서 처음 등장한다.
 *   - 제한 시간 없음. 시간 압박은 챕터 3의 메커닉이고, C2(아무 때나 끊어도 손해 없음)에도 어긋난다.
 *
 * 좌표: 궁수의 손은 (0, 1.4). 과녁 y 는 지면(y=0) 기준 높이다.
 *
 * ── 2026-08-23 떨림 재설계 이후: 난이도의 축이 바뀌었다 ──
 *
 * 옛 모델에서 실력은 "떨림 위상을 읽고 최소점에 놓는 것"이었다. 지금은 아니다.
 * 스태미나가 빨간 바(최대치의 55%) 위에 있는 동안 **떨림도 발사 산포도 정확히 0이다**
 * (실측: 안전 구간 발사 각오차 RMS 0.000 mrad). 만작에서 그 안에 놓으면 조준한 자리에 그대로 간다.
 *
 * 그래서 난이도는 이제 두 가지로만 만들어진다:
 *   1. **조준 정확도** — 각크기가 작을수록 정확히 겨눠야 한다.
 *   2. **릴리즈 규율** — 망설이다 바를 넘기면 그때부터 떨린다. 넘긴 만큼 벌받는다.
 *
 * **산포·떨림 계수(releaseScatter·baseAmp·steadyZone)를 키워 어렵게 만들지 않는다.**
 * 그건 사용자가 방금 고치라고 한 문제("쏘는 대로 안 맞는다")를 되돌리는 짓이다.
 * 난이도는 언제나 과녁을 **작고 멀게** 만들어서 낸다.
 *
 * ── 난이도의 유일한 단위: 각크기 h = r / 거리 ──
 *
 * 화살의 오차는 전부 **각도** 오차다(조준·떨림·산포). 그래서 판의 난이도는 반경도 거리도
 * 아니고 둘의 비 h = r/d 하나로 정해진다. 20m의 반경 0.20 과녁과 40m의 반경 0.40 과녁은
 * 정확히 같은 난이도다. 아래 반경은 전부 "원하는 h × 궁수 손에서의 실제 거리"로 역산한 값이다.
 *
 * **h에는 화면 쪽 바닥이 있다.** 카메라가 사거리 전체를 화면 폭에 맞추므로 과녁의 화면 반경은
 * 거리와 무관하게 `h × 뷰포트 폭`이다 — h=0.0021이면 1200px 화면에서 반경 2.5px다.
 * 이보다 작게 가면 과녁이 점이 되어 "조준 실력"이 아니라 "안 보이는 것 맞히기"가 된다.
 * 그래서 챕터 1의 바닥은 h≈0.0021이고, 그 아래의 난이도는 반경이 아니라
 * **화살 수·요구 명중 수·과녁 개수**로 만든다.
 *
 * 헤드리스 실측(`npm run balance`, 재설계 봇 기준) 한 발 명중률 ≈ erf(h / s),
 * s = novice 0.0107 · average 0.0068 · expert 0.0049.
 *   h 0.0040 → avg 46% · 0.0030 → 37% · 0.0021 → 27%
 * (봇의 조준 바닥 오차: novice 22.5cm / average 15cm / expert 10.8cm @30m)
 *
 * ── 난이도의 두 번째 축: 여벌 화살 (화살 수 − 요구 명중 수) ──
 *
 * 같은 명중률이라도 "과녁 3개를 6발로 전부"와 "과녁 4개 중 3개를 6발로"는 다르다.
 * 여벌이 적을수록 클리어율이 명중률에 민감해져 **초보와 숙련의 격차가 벌어진다.**
 * 그래서 챕터 후반은 여벌을 유지한 채 과녁만 작게 간다 — 초보가 벽에 막히지 않게.
 *
 * ── 목표 점수는 "몇 발"의 근사치다 ──
 *
 * `need(k)`는 BASE·k 이지만 링 배수(가장자리 1배 ~ 중심 2배)와 연쇄 콤보(×1.15)가 얹혀서
 * **잘 쏘면 k−1발로도 끝난다** (실측: k=3 판의 절반쯤이 2명중에서 클리어). 이건 버그가 아니라
 * "잘 쏘면 화살이 남는다"는 설계다. 그래서 아래 주석의 "k명중"은 상한이 아니라 기준선이고,
 * 실제 클리어율은 언제나 그보다 관대하다.
 */
import { clamp } from '../core/math.ts'
import { seedFrom } from '../core/rng.ts'
import type { StageDef } from '../sim/types.ts'

/**
 * 과녁 기본 점수. 링 명중도 배수가 곱해지므로 실제 획득 점수는 이보다 크거나 작을 수 있다.
 * 전 과녁을 같은 값으로 두어, 클리어 점수를 "몇 발 맞혀야 하는가"로만 읽히게 한다.
 */
const BASE = 100

/** k발 명중을 기준선으로 하는 클리어 점수. 위 "목표 점수는 근사치다" 참조. */
const need = (k: number): number => BASE * k

/**
 * 1판: 눈높이 정면 8m. 시위를 당기고 놓는 것 말고는 아무것도 요구하지 않는다.
 * h=0.056 — 조준을 반쯤 놓쳐도 맞는다. 배우는 판이므로 클리어율 100%가 맞다.
 * (튜토리얼을 90%로 낮추려면 h를 0.0023까지 조여야 하는데, 그건 첫 판이 아니라 벽이다.)
 */
const S1: StageDef = {
  id: '1-1',
  seed: seedFrom('1-1'),
  arrows: 5,
  targetScore: need(1),
  wind: 0,
  targets: [{ kind: 'static', x: 8, y: 1.4, r: 0.45, score: BASE }],
}

/** 2판: 과녁을 어깨 위로. 조준점은 손이 아니라 마우스가 정한다는 걸 몸으로 알린다. h=0.029 */
const S2: StageDef = {
  id: '1-2',
  seed: seedFrom('1-2'),
  arrows: 5,
  targetScore: need(1),
  wind: 0,
  targets: [{ kind: 'static', x: 11, y: 2.6, r: 0.32, score: BASE }],
}

/**
 * 3판: 여기서부터 진짜 게임이다. 과녁 3개를 6발로 **전부** 맞혀야 한다.
 * 여벌이 3발이라 두 번까지는 실수해도 되지만 세 번째부터는 판이 끝난다.
 * 거리마다 반경을 키워 각크기를 h=0.0034로 통일했다 — 어려워진 이유가 거리가 아니라
 * **한 발의 값이 비싸졌기 때문**임이 읽히게 하려는 것이다.
 */
const S3: StageDef = {
  id: '1-3',
  seed: seedFrom('1-3'),
  arrows: 6,
  targetScore: need(3),
  wind: 0,
  targets: [
    { kind: 'static', x: 10, y: 1.5, r: 0.0340, score: BASE },
    { kind: 'static', x: 13.5, y: 2.7, r: 0.0461, score: BASE },
    { kind: 'static', x: 17, y: 1.9, r: 0.0578, score: BASE },
  ],
}

/** 4판: 같은 요구(3개 전부/6발)에서 거리만 밀고 각크기를 h=0.0031로 조인다. */
const S4: StageDef = {
  id: '1-4',
  seed: seedFrom('1-4'),
  arrows: 6,
  targetScore: need(3),
  wind: 0,
  targets: [
    { kind: 'static', x: 12, y: 1.6, r: 0.0372, score: BASE },
    { kind: 'static', x: 16, y: 2.8, r: 0.0498, score: BASE },
    { kind: 'static', x: 20, y: 2.0, r: 0.0620, score: BASE },
  ],
}

/**
 * 5판: 거리를 20~28m로 밀어 챕터 1의 원거리를 처음 보여준다. h=0.0028.
 * 여기서부터 만작 직후에 놓는 습관이 없으면 눈에 띄게 어려워진다 —
 * 빨간 바를 넘긴 발의 명중률이 넘기지 않은 발보다 확실히 낮은 구간이다.
 */
const S5: StageDef = {
  id: '1-5',
  seed: seedFrom('1-5'),
  arrows: 6,
  targetScore: need(3),
  wind: 0,
  targets: [
    { kind: 'static', x: 20, y: 1.7, r: 0.0560, score: BASE },
    { kind: 'static', x: 24, y: 2.9, r: 0.0673, score: BASE },
    { kind: 'static', x: 28, y: 2.1, r: 0.0784, score: BASE },
  ],
}

/** 6판: 같은 구조에서 거리만 2m씩 밀고 각크기를 h=0.0027로 조인다. */
const S6: StageDef = {
  id: '1-6',
  seed: seedFrom('1-6'),
  arrows: 6,
  targetScore: need(3),
  wind: 0,
  targets: [
    { kind: 'static', x: 22, y: 1.7, r: 0.0594, score: BASE },
    { kind: 'static', x: 26, y: 3.0, r: 0.0708, score: BASE },
    { kind: 'static', x: 30, y: 2.1, r: 0.0810, score: BASE },
  ],
}

/**
 * 7판: 과녁이 4개로 늘고 요구는 3개 그대로다 — **어느 셋을 고를지**가 판단이 된다.
 * 가까운 것이 작고 먼 것이 크다. 각크기는 h=0.00232로 같으니 무엇을 고르든 공평하다.
 */
const S7: StageDef = {
  id: '1-7',
  seed: seedFrom('1-7'),
  arrows: 6,
  targetScore: need(3),
  wind: 0,
  targets: [
    { kind: 'static', x: 20, y: 1.6, r: 0.0464, score: BASE },
    { kind: 'static', x: 24, y: 2.9, r: 0.0558, score: BASE },
    { kind: 'static', x: 28, y: 1.9, r: 0.0650, score: BASE },
    { kind: 'static', x: 32, y: 2.6, r: 0.0743, score: BASE },
  ],
}

/**
 * 8판: 7판과 배치가 완전히 같고 반경만 깎았다 (h=0.0023).
 * 어려워진 이유가 오직 "작아서"임이 눈으로 읽히게 하려는 배치다.
 */
const S8: StageDef = {
  id: '1-8',
  seed: seedFrom('1-8'),
  arrows: 6,
  targetScore: need(3),
  wind: 0,
  targets: [
    { kind: 'static', x: 20, y: 1.6, r: 0.0460, score: BASE },
    { kind: 'static', x: 24, y: 2.9, r: 0.0554, score: BASE },
    { kind: 'static', x: 28, y: 1.9, r: 0.0644, score: BASE },
    { kind: 'static', x: 32, y: 2.6, r: 0.0737, score: BASE },
  ],
}

/**
 * 9판: 챕터 1의 벽. 과녁 4개 중 3개를 22~34m에서, 화살 6발로 (h=0.0021 — 화면 바닥).
 * 여벌은 3발뿐이라 실수 세 번이면 끝난다.
 * 만작 직후에 놓는 습관이 안 잡혔으면 여기서 막힌다.
 */
const S9: StageDef = {
  id: '1-9',
  seed: seedFrom('1-9'),
  arrows: 6,
  targetScore: need(3),
  wind: 0,
  targets: [
    { kind: 'static', x: 22, y: 1.7, r: 0.0462, score: BASE },
    { kind: 'static', x: 26, y: 2.9, r: 0.0548, score: BASE },
    { kind: 'static', x: 30, y: 2.0, r: 0.0630, score: BASE },
    { kind: 'static', x: 34, y: 2.7, r: 0.0716, score: BASE },
  ],
}

/**
 * 10판: 종합. 공중 과녁을 26m 정지 과녁 **바로 위**에 얹었다 —
 * 맞히면 낙하하며 아래를 연쇄로 친다. 한 발로 두 개가 터지는 걸 한 번 보여주고 챕터를 닫는다.
 * 연쇄를 못 찾아도 정지 과녁 3개로 클리어되므로, 발견이 보상이지 관문이 아니다.
 * 공중 과녁만 조금 크게(h=0.0025, 정지는 0.00215) 두었다 — 처음 보는 것을 못 맞히면
 * 배울 기회 자체가 없다. 화살은 7발로 되돌려 마지막 판을 넉넉하게 만든다.
 */
const S10: StageDef = {
  id: '1-10',
  seed: seedFrom('1-10'),
  arrows: 7,
  targetScore: need(3),
  wind: 0,
  targets: [
    { kind: 'static', x: 18, y: 1.6, r: 0.0387, score: BASE },
    { kind: 'static', x: 26, y: 1.8, r: 0.0559, score: BASE },
    { kind: 'static', x: 32, y: 2.4, r: 0.0688, score: BASE },
    { kind: 'aerial', x: 26, y: 6.4, r: 0.0662, score: BASE },
  ],
}

export const STAGES: readonly StageDef[] = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10]

/**
 * 범위를 벗어난 인덱스는 잘라서 준다.
 * 진행도가 챕터 끝을 넘었다고 게임이 죽으면 안 된다 — 다음 챕터가 붙기 전까지의 안전장치.
 */
export function getStage(index: number): StageDef {
  const i = clamp(Math.floor(index), 0, STAGES.length - 1)
  const s = STAGES[i]
  return s ?? S1
}
