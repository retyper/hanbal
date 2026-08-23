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
 * ── 난이도의 유일한 단위: 각크기 h = r / 거리 ──
 *
 * 화살의 오차는 전부 **각도** 오차다(떨림·산포·조준). 그래서 판의 난이도는 반경도 거리도
 * 아니고 둘의 비 h = r/d 하나로 정해진다. 20m의 반경 0.20 과녁과 40m의 반경 0.40 과녁은
 * 정확히 같은 난이도다. 아래 반경은 전부 "원하는 h × 거리"로 역산한 값이다.
 *
 * 헤드리스 실측(`npm run balance`) average 봇의 한 발 명중률
 * — 2026-08-23 떨림 예산 재배분(releaseScatter 0.0035→0.0010, onsetAmp 0.18→0.60,
 *   rampStart 1.1→0.4) 뒤 다시 잰 값이다. **옛 표를 그대로 쓰면 판이 통째로 어긋난다.**
 *   난수가 줄고 읽을 수 있는 떨림이 커져서, 같은 h에서 average가 예전보다 잘 맞힌다:
 *   h 0.029 → 100% · 0.0064 → 64% · 0.0050 → 51% · 0.0037 → 38% · 0.0032 → 34%
 *   h 0.0026 → 33% · 0.0024 → 30% · 0.0023 → 30%
 *
 * ── 난이도의 두 번째 축: 여벌 화살 (화살 수 − 요구 명중 수) ──
 *
 * 같은 명중률이라도 "과녁 3개를 5발로 전부"와 "과녁 4개 중 2개를 6발로"는 전혀 다르다.
 * 여벌이 적을수록 클리어율이 명중률에 민감해져 **초보와 숙련의 격차가 벌어진다.**
 * 실측 격차: 여벌 2발(3발/5발) 약 60%p · 여벌 3발(3발/6발) 약 54%p · 여벌 4발(2발/6발) 약 40%p.
 * 그래서 챕터 후반은 "여벌을 넉넉히 주고 과녁을 작게"로 간다 — 초보가 벽에 막히지 않게.
 *
 * 떨림 재배분 뒤 이 격차가 전 판에서 7~13%p 더 벌어졌다(달성 8/10판 → 3/10판).
 * 반경으로는 못 좁힌다 — 격차는 여벌 화살이 정하고, 반경은 average의 높이만 정한다.
 * 여벌을 늘리면 좁아지지만(전 판 +1발에서 6/10판) average가 85.9%로 떠서 목표를 벗어난다.
 * docs/BALANCE.md의 숙제로 남긴다 — 봇 모델(novice가 1.0초를 끄는 습관)이 새 물리에서
 * 옛날보다 훨씬 크게 벌받는 게 격차의 실체이므로, 콘텐츠가 아니라 계측기 쪽 판단이 필요하다.
 *
 * **산포·떨림 계수를 키워 어렵게 만들지 않는다** (docs/BALANCE.md 숙제).
 * 난수를 키우면 실력이 개입할 여지가 사라진다 — feel-lens가 blocker로 잡았던 문제의 재발이다.
 */
import { clamp } from '../core/math.ts'
import { seedFrom } from '../core/rng.ts'
import type { StageDef } from '../sim/types.ts'

/**
 * 과녁 기본 점수. 링 명중도 배수가 곱해지므로 실제 획득 점수는 이보다 크거나 작을 수 있다.
 * 전 과녁을 같은 값으로 두어, 클리어 점수를 "몇 발 맞혀야 하는가"로만 읽히게 한다.
 */
const BASE = 100

/**
 * k발 명중을 요구하는 클리어 점수.
 *
 * target.ts 의 링 배수는 가장자리 1배 ~ 중심 P.score.ringMulMax(2)배이고, 연쇄 콤보가 ×1.15씩
 * 얹힌다. 그래서 BASE·k 는 "가장자리로 k발"과 정확히 같고, 중심을 꿰뚫으면 k발보다 적게 든다.
 * 이 겹침은 버그가 아니라 설계다 — **잘 쏘면 화살이 남는다**가 링 배수의 존재 이유다.
 * 즉 k는 상한이 아니라 기준선이고, 언제나 관대한 쪽으로 틀린다.
 */
const need = (k: number): number => BASE * k

/**
 * 1판: 눈높이 정면 8m. 시위를 당기고 놓는 것 말고는 아무것도 요구하지 않는다.
 * h=0.056 — 조준을 반쯤 놓쳐도 맞는다. 배우는 판이므로 클리어율 100%가 맞다.
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
 * 거리마다 반경을 키워 각크기를 h=0.00637으로 통일했다 — 어려워진 이유가 거리가 아니라
 * **한 발의 값이 비싸졌기 때문**임이 읽히게 하려는 것이다. (실측 average 클리어 92.0% · 한 발 64.4%)
 */
const S3: StageDef = {
  id: '1-3',
  seed: seedFrom('1-3'),
  arrows: 6,
  targetScore: need(3),
  wind: 0,
  targets: [
    { kind: 'static', x: 10, y: 1.5, r: 0.0637, score: BASE },
    { kind: 'static', x: 13.5, y: 2.7, r: 0.0860, score: BASE },
    { kind: 'static', x: 17, y: 1.9, r: 0.1083, score: BASE },
  ],
}

/**
 * 4판: 요구가 뒤집힌다 — 과녁 3개 중 **둘만** 맞히면 되고, 대신 화살이 5발로 줄고
 * 각크기가 h=0.0050으로 조인다. "전부 맞혀라"에서 "확실한 두 발을 골라라"로 바뀌는 판.
 * (실측 average 클리어 76.5% · 한 발 51.3%)
 */
const S4: StageDef = {
  id: '1-4',
  seed: seedFrom('1-4'),
  arrows: 5,
  targetScore: need(2),
  wind: 0,
  targets: [
    { kind: 'static', x: 12, y: 1.6, r: 0.060, score: BASE },
    { kind: 'static', x: 16, y: 2.8, r: 0.080, score: BASE },
    { kind: 'static', x: 20, y: 2.0, r: 0.100, score: BASE },
  ],
}

/**
 * 5판: 같은 요구(3개 중 2개)에 화살 6발. 거리를 20~28m로 밀어 챕터 1의 원거리를 처음 보여준다.
 * h=0.00366. (실측 average 클리어 73.5% · 한 발 38.3%)
 */
const S5: StageDef = {
  id: '1-5',
  seed: seedFrom('1-5'),
  arrows: 6,
  targetScore: need(2),
  wind: 0,
  targets: [
    { kind: 'static', x: 20, y: 1.7, r: 0.0732, score: BASE },
    { kind: 'static', x: 24, y: 2.9, r: 0.0878, score: BASE },
    { kind: 'static', x: 28, y: 2.1, r: 0.1025, score: BASE },
  ],
}

/** 6판: 같은 구조에서 거리만 2m씩 밀고 반경은 그대로 (h=0.00319). (실측 average 클리어 64.5% · 한 발 34.1%) */
const S6: StageDef = {
  id: '1-6',
  seed: seedFrom('1-6'),
  arrows: 6,
  targetScore: need(2),
  wind: 0,
  targets: [
    { kind: 'static', x: 22, y: 1.7, r: 0.0702, score: BASE },
    { kind: 'static', x: 26, y: 3.0, r: 0.0829, score: BASE },
    { kind: 'static', x: 30, y: 2.1, r: 0.0957, score: BASE },
  ],
}

/**
 * 7판: 과녁 4개. 여전히 2개만 맞히면 되므로 **어느 둘을 고를지**가 판단이 된다.
 * 가까운 것이 작고 먼 것이 크다 — 각크기는 h=0.00256으로 같으니 무엇을 고르든 공평하다.
 * (실측 average 클리어 62.5% · 한 발 32.8%)
 */
const S7: StageDef = {
  id: '1-7',
  seed: seedFrom('1-7'),
  arrows: 6,
  targetScore: need(2),
  wind: 0,
  targets: [
    { kind: 'static', x: 20, y: 1.6, r: 0.0512, score: BASE },
    { kind: 'static', x: 24, y: 2.9, r: 0.0614, score: BASE },
    { kind: 'static', x: 28, y: 1.9, r: 0.0717, score: BASE },
    { kind: 'static', x: 32, y: 2.6, r: 0.0819, score: BASE },
  ],
}

/**
 * 8판: 7판과 배치가 완전히 같고 반경만 깎았다 (h=0.00240).
 * 어려워진 이유가 오직 "작아서"임이 눈으로 읽히게 하려는 배치다. (실측 average 클리어 58.0% · 한 발 29.9%)
 */
const S8: StageDef = {
  id: '1-8',
  seed: seedFrom('1-8'),
  arrows: 6,
  targetScore: need(2),
  wind: 0,
  targets: [
    { kind: 'static', x: 20, y: 1.6, r: 0.0480, score: BASE },
    { kind: 'static', x: 24, y: 2.9, r: 0.0576, score: BASE },
    { kind: 'static', x: 28, y: 1.9, r: 0.0672, score: BASE },
    { kind: 'static', x: 32, y: 2.6, r: 0.0768, score: BASE },
  ],
}

/**
 * 9판: 챕터 1의 벽. 과녁 4개 중 **3개**를 22~34m에서, 화살 7발로 (h=0.00230).
 * 여벌은 4발로 넉넉하지만 요구가 하나 늘어 실수 네 번이면 끝난다.
 * 만작 직후에 놓는 습관이 안 잡혔으면 여기서 막힌다. (실측 average 클리어 56.0% · 한 발 30.4%)
 */
const S9: StageDef = {
  id: '1-9',
  seed: seedFrom('1-9'),
  arrows: 7,
  targetScore: need(3),
  wind: 0,
  targets: [
    { kind: 'static', x: 22, y: 1.7, r: 0.0506, score: BASE },
    { kind: 'static', x: 26, y: 2.9, r: 0.0598, score: BASE },
    { kind: 'static', x: 30, y: 2.0, r: 0.0690, score: BASE },
    { kind: 'static', x: 34, y: 2.7, r: 0.0782, score: BASE },
  ],
}

/**
 * 10판: 종합. 공중 과녁을 26m 정지 과녁 **바로 위**에 얹었다 —
 * 맞히면 낙하하며 아래를 연쇄로 친다. 한 발로 두 개가 터지는 걸 한 번 보여주고 챕터를 닫는다.
 * 연쇄를 못 찾아도 정지 과녁 3개로 클리어되므로, 발견이 보상이지 관문이 아니다.
 * 공중 과녁만 조금 크게(h=0.0035, 정지는 0.0030) 두었다 — 처음 보는 것을 못 맞히면
 * 배울 기회 자체가 없다. (실측 average 클리어 61.0% · 한 발 34.6%)
 */
const S10: StageDef = {
  id: '1-10',
  seed: seedFrom('1-10'),
  arrows: 7,
  targetScore: need(3),
  wind: 0,
  targets: [
    { kind: 'static', x: 18, y: 1.6, r: 0.054, score: BASE },
    { kind: 'static', x: 26, y: 1.8, r: 0.078, score: BASE },
    { kind: 'static', x: 32, y: 2.4, r: 0.096, score: BASE },
    { kind: 'aerial', x: 26, y: 6.4, r: 0.093, score: BASE },
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
