/**
 * 챕터 1 — 당김과 놓음 (스테이지 저작)
 *
 * 설계 원칙 (GDD 1장 C1, 6장):
 *   - 한 판은 화살 5~8발 = 30초~1분. 판이 길어지면 "공부 사이에 한 판"이 성립하지 않는다.
 *   - 챕터 1은 새 메커닉을 하나도 얹지 않는다. 거리와 과녁 크기만으로 난이도를 만든다.
 *   - 바람은 전부 0. 바람은 챕터 4에서 처음 등장한다.
 *   - 제한 시간 없음. 시간 압박은 챕터 3의 메커닉이고, C2(아무 때나 끊어도 손해 없음)에도 어긋난다.
 *
 * 좌표: 궁수의 손은 (0, 1.4). 과녁 y 는 지면(y=0) 기준 높이다.
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
 * 가장자리 명중 한 발이 실제로 주는 점수. 클리어 점수는 이 값의 배수로만 잡아
 * "몇 발 맞혀야 하는가"로 읽히게 한다. "빗맞았지만 맞긴 맞았다"가 클리어를 막지 않는다.
 *
 * target.ts 의 링 배수는 가장자리 1배 ~ 중심 P.score.ringMulMax 배다. 즉 최악의 명중이 BASE.
 * 예전 값(BASE의 절반)은 링 하한을 0.5배로 가정한 것이라, MIN_HIT*2 판이 한 발로 클리어됐다.
 */
const MIN_HIT = BASE

/** 1~2판: 눈높이 정면. 시위를 당기고 놓는 것 말고는 아무것도 요구하지 않는다. */
const S1: StageDef = {
  id: '1-1',
  seed: seedFrom('1-1'),
  arrows: 5,
  targetScore: MIN_HIT,
  wind: 0,
  targets: [{ kind: 'static', x: 8, y: 1.4, r: 0.6, score: BASE }],
}

/** 과녁을 어깨 위로 올려, 조준점은 손이 아니라 마우스가 정한다는 걸 몸으로 알린다. */
const S2: StageDef = {
  id: '1-2',
  seed: seedFrom('1-2'),
  arrows: 5,
  targetScore: MIN_HIT,
  wind: 0,
  targets: [{ kind: 'static', x: 9, y: 2.4, r: 0.6, score: BASE }],
}

/** 3판: 10m. 여기서부터 화살이 눈에 띄게 아래로 떨어진다. 반경은 아직 넉넉하게. */
const S3: StageDef = {
  id: '1-3',
  seed: seedFrom('1-3'),
  arrows: 5,
  targetScore: MIN_HIT,
  wind: 0,
  targets: [{ kind: 'static', x: 10, y: 1.6, r: 0.55, score: BASE }],
}

/** 4판: 18m. 같은 조준으로 쏘면 반드시 못 미친다 → 위로 겨누는 법을 스스로 찾게 한다. */
const S4: StageDef = {
  id: '1-4',
  seed: seedFrom('1-4'),
  arrows: 6,
  targetScore: MIN_HIT,
  wind: 0,
  targets: [{ kind: 'static', x: 18, y: 1.8, r: 0.55, score: BASE }],
}

/** 5판: 26m. 챕터 1 최장거리. 만작까지 당기지 않으면 아예 닿지 않는 거리다. */
const S5: StageDef = {
  id: '1-5',
  seed: seedFrom('1-5'),
  arrows: 6,
  targetScore: MIN_HIT,
  wind: 0,
  targets: [{ kind: 'static', x: 26, y: 2, r: 0.55, score: BASE }],
}

/** 6판: 과녁 2개. 연속으로 쏘려면 스태미나가 회복될 때까지 기다려야 한다는 걸 처음 겪는다. */
const S6: StageDef = {
  id: '1-6',
  seed: seedFrom('1-6'),
  arrows: 6,
  targetScore: MIN_HIT * 2,
  wind: 0,
  targets: [
    { kind: 'static', x: 12, y: 1.5, r: 0.5, score: BASE },
    { kind: 'static', x: 16, y: 2.6, r: 0.5, score: BASE },
  ],
}

/** 7판: 3개를 거리별로 흩어 놓는다. 거리마다 조준을 다시 잡는 습관을 만든다. */
const S7: StageDef = {
  id: '1-7',
  seed: seedFrom('1-7'),
  arrows: 7,
  targetScore: MIN_HIT * 3,
  wind: 0,
  targets: [
    { kind: 'static', x: 10, y: 1.4, r: 0.55, score: BASE },
    { kind: 'static', x: 15, y: 2.8, r: 0.55, score: BASE },
    { kind: 'static', x: 20, y: 1.8, r: 0.55, score: BASE },
  ],
}

/** 8판: 반경을 절반으로. 거리는 줄여서, 어려워진 이유가 "작아서"임이 분명하게 읽히게 한다. */
const S8: StageDef = {
  id: '1-8',
  seed: seedFrom('1-8'),
  arrows: 7,
  targetScore: MIN_HIT * 2,
  wind: 0,
  targets: [
    { kind: 'static', x: 14, y: 1.6, r: 0.32, score: BASE },
    { kind: 'static', x: 20, y: 2.4, r: 0.32, score: BASE },
  ],
}

/** 9판: 작은 과녁 + 최장거리. 챕터 1에서 호흡정지가 실제로 이득인 첫 판이다. */
const S9: StageDef = {
  id: '1-9',
  seed: seedFrom('1-9'),
  arrows: 8,
  targetScore: MIN_HIT * 2,
  wind: 0,
  targets: [
    { kind: 'static', x: 22, y: 1.7, r: 0.3, score: BASE },
    { kind: 'static', x: 28, y: 2.6, r: 0.3, score: BASE },
  ],
}

/**
 * 10판: 종합. 공중 과녁을 18m 정지 과녁 **바로 위**에 얹었다 —
 * 맞히면 낙하하며 아래를 연쇄로 친다. 한 발로 두 개가 터지는 걸 한 번 보여주고 챕터를 닫는다.
 * 연쇄를 못 찾아도 정지 3개로 클리어되므로, 발견이 보상이지 관문이 아니다.
 */
const S10: StageDef = {
  id: '1-10',
  seed: seedFrom('1-10'),
  arrows: 8,
  targetScore: MIN_HIT * 3,
  wind: 0,
  targets: [
    { kind: 'static', x: 10, y: 1.6, r: 0.42, score: BASE },
    { kind: 'static', x: 18, y: 1.8, r: 0.42, score: BASE },
    { kind: 'static', x: 24, y: 2.2, r: 0.42, score: BASE },
    { kind: 'aerial', x: 18, y: 6.5, r: 0.45, score: BASE },
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
