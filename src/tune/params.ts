/**
 * 튜닝 상수 단일 출처 (ARCHITECTURE A2)
 *
 * 이 게임의 손맛은 전부 이 파일 안에 있다.
 * 각 값은 메타데이터(범위/단위/설명)를 함께 들고 있고, 라이브 튜닝 콘솔(tune/console.ts)이
 * 이 스펙을 읽어 슬라이더를 자동 생성한다. 새 노브를 추가하면 콘솔 UI가 알아서 늘어난다.
 *
 * 워크플로: 게임을 켜고 ` 키 → 슬라이더로 손맛을 찾음 → [복사] → 이 파일에 붙여넣기 → 커밋.
 *
 * 단위 규약: 거리 m, 시간 s, 각도 rad, 질량 kg. 화면 픽셀 단위는 여기 들어오지 않는다.
 */

export interface Knob {
  readonly v: number
  readonly min: number
  readonly max: number
  readonly step: number
  /** 슬라이더에 표시될 한글 설명. 형이 6주 뒤에 봐도 알아야 한다. */
  readonly label: string
  readonly unit?: string
}

const k = (v: number, min: number, max: number, step: number, label: string, unit?: string): Knob =>
  unit === undefined ? { v, min, max, step, label } : { v, min, max, step, label, unit }

export const SPEC = {
  /** 활과 시위 — 당기는 감각 */
  bow: {
    drawTime: k(0.85, 0.2, 3, 0.05, '만작까지 걸리는 시간', 's'),
    releaseDelay: k(0, 0, 0.12, 0.005, '놓은 뒤 화살이 나가기까지 (0이 정답, 올리면 즉시 반려)', 's'),
    minSpeed: k(18, 5, 60, 1, '최소 당김에서의 화살 초속', 'm/s'),
    maxSpeed: k(62, 20, 140, 1, '만작에서의 화살 초속', 'm/s'),
    /** 장력-속도 곡선. 1이면 선형, >1이면 만작 근처에서 급격히 강해진다(실제 활에 가까움). */
    drawCurve: k(1.6, 0.5, 3, 0.05, '장력 곡선 지수 (클수록 만작이 극적)'),
    /** 시위를 놓는 순간 조준각에 더해지는 무작위 오차. STEADY로 줄어든다. */
    releaseScatter: k(0.011, 0, 0.06, 0.001, '릴리즈 산포 (기본 오차)', 'rad'),
    /** 만작 전에 놓으면 화살이 흔들리며 날아간다 */
    partialDrawPenalty: k(0.55, 0, 2, 0.05, '덜 당기고 쏠 때 정확도 페널티'),
  },

  /** 떨림 — 이 게임의 심장. feel-lens가 가장 먼저 보는 곳 */
  tremor: {
    baseAmp: k(0.0042, 0, 0.03, 0.0002, '기본 떨림 진폭', 'rad'),
    /** 홀드가 이 시간을 넘으면 떨림이 자라기 시작한다 */
    rampStart: k(1.2, 0, 5, 0.1, '떨림이 커지기 시작하는 홀드 시간', 's'),
    rampRate: k(0.9, 0, 4, 0.05, '홀드 지속 시 떨림 증가 속도', '/s'),
    /** 스태미나가 바닥날수록 급격히 떨린다 (지수) */
    fatigueExp: k(2.2, 1, 5, 0.1, '피로 떨림 지수 (클수록 막판에 급격)'),
    fatigueMul: k(3.4, 1, 10, 0.1, '스태미나 0 근처 떨림 배수'),
    /** 2옥타브 노이즈. 느린 흔들림 + 빠른 잔떨림. 하나만 쓰면 사인파처럼 예측돼서 지루하다. */
    slowFreq: k(1.15, 0.2, 4, 0.05, '느린 흔들림 주파수', 'Hz'),
    fastFreq: k(6.8, 2, 20, 0.1, '빠른 잔떨림 주파수', 'Hz'),
    fastRatio: k(0.32, 0, 1, 0.01, '잔떨림 비중 (0=느린 흔들림만)'),
    /** 조준점 흔들림이 화면에서 최소 이 픽셀만큼은 보여야 위상을 읽을 수 있다 (feel-lens 기준) */
    minVisiblePx: k(2.5, 0, 10, 0.1, '최소 가시 진폭 (읽기 검증용)', 'px'),
  },

  /** 스태미나 — 버티는 힘과 붕괴 */
  stamina: {
    max: k(100, 20, 300, 5, '최대 스태미나'),
    drawDrain: k(21, 2, 80, 1, '만작 유지 중 소모 속도', '/s'),
    /** 덜 당기면 덜 힘들다 */
    drainByDraw: k(1.4, 0, 3, 0.05, '당김량에 따른 소모 가중'),
    regen: k(34, 5, 150, 1, '쏘고 나서 회복 속도', '/s'),
    regenDelay: k(0.35, 0, 2, 0.05, '회복 시작까지 딜레이', 's'),
    /** 붕괴 예고. 이 값 아래로 떨어지면 팔이 처지고 떨림이 급증한다.
     *  예고 없는 붕괴는 "게임이 나를 배신했다"가 된다 — feel-lens 자동 반려 사유. */
    collapseWarnAt: k(18, 0, 60, 1, '붕괴 경고 시작 스태미나'),
    collapseWarnMinTime: k(0.5, 0.1, 2, 0.05, '최소 경고 시간 (이보다 짧으면 경고 불충분)', 's'),
  },

  /** 호흡정지 — 숨을 참아 잠깐 안정시키기 */
  steady: {
    tremorMul: k(0.28, 0, 1, 0.01, '호흡정지 중 떨림 배수'),
    staminaDrain: k(2.6, 1, 8, 0.1, '호흡정지 중 스태미나 소모 배수'),
    /** 너무 오래 참으면 오히려 더 떨린다 (실제 사격과 같음) */
    maxHold: k(2.8, 0.5, 8, 0.1, '호흡정지 한계 시간', 's'),
    overholdPenalty: k(2.1, 1, 5, 0.1, '한계 초과 시 떨림 배수'),
    rampIn: k(0.18, 0, 1, 0.01, '호흡정지 효과가 드는 시간', 's'),
  },

  /** 화살 비행 */
  arrow: {
    gravity: k(9.81, 0, 25, 0.1, '중력', 'm/s2'),
    mass: k(0.025, 0.005, 0.1, 0.001, '화살 질량', 'kg'),
    drag: k(0.0021, 0, 0.02, 0.0001, '공기 저항 계수'),
    /** 화살이 속도 방향으로 정렬되는 속도. 낮으면 흔들리며 날아간다. */
    alignRate: k(9, 1, 30, 0.5, '화살촉 정렬 속도', '/s'),
    maxFlightTime: k(8, 2, 30, 0.5, '최대 비행 시간 (넘으면 소멸)', 's'),
  },

  /** 바람 (챕터 4~) */
  wind: {
    maxSpeed: k(6, 0, 25, 0.5, '최대 풍속', 'm/s'),
    gustFreq: k(0.22, 0, 2, 0.01, '돌풍 변화 주파수', 'Hz'),
    gustAmp: k(0.35, 0, 1, 0.01, '돌풍 변동 폭 (평균 대비)'),
    /** 바람은 화살에 힘을 주는 게 아니라 상대속도 항력으로 작용한다. 에너지 주입 금지 (sim-lens A1) */
    effect: k(1, 0, 3, 0.05, '바람 영향 배수'),
  },

  /** 명중 반응 — 손맛 레이어 */
  hit: {
    stopMs: k(42, 0, 120, 1, '명중 히트스톱', 'ms'),
    chainStopMs: k(24, 0, 80, 1, '연쇄 히트스톱', 'ms'),
    shakeAmp: k(4.2, 0, 20, 0.1, '카메라 흔들림 진폭', 'px'),
    shakeDecay: k(11, 2, 40, 0.5, '흔들림 감쇠 속도', '/s'),
    /** 다음 조준 시작 전에 흔들림이 완전히 멎어야 한다 (feel-lens) */
    shakeCutoff: k(0.25, 0.05, 1, 0.01, '흔들림 강제 종료 시간', 's'),
    trailFade: k(2.4, 0.3, 10, 0.1, '화살 궤적 잔상 유지 시간', 's'),
    /** 빗나간 화살의 궤적은 더 오래 남는다. 왜 빗나갔는지 읽어야 학습이 된다 (GDD 8장) */
    missTrailFade: k(4.5, 0.3, 15, 0.1, '빗나간 궤적 유지 시간', 's'),
  },

  /** 연쇄 폭발 */
  chain: {
    comboMul: k(1.15, 1, 2, 0.01, '연쇄 1단계당 점수 배수'),
    fallSpeed: k(7.5, 1, 30, 0.5, '공중 과녁 낙하 초속', 'm/s'),
    hitRadius: k(0.42, 0.1, 2, 0.02, '낙하 중 연쇄 판정 반경', 'm'),
    /** 연쇄가 이어질수록 반음씩 올라간다 */
    pitchStep: k(1.0595, 1, 1.3, 0.0005, '연쇄 사운드 피치 배수'),
    maxParticles: k(240, 40, 1200, 10, '파티클 링버퍼 크기'),
  },

  /** 성장 스탯이 물리에 미치는 영향 */
  growth: {
    strToSpeed: k(0.028, 0, 0.15, 0.001, 'STR 1당 화살 속도 증가율'),
    strToDrawTime: k(0.017, 0, 0.1, 0.001, 'STR 1당 만작 시간 단축율'),
    steadyToTremor: k(0.033, 0, 0.15, 0.001, 'STEADY 1당 떨림 감소율'),
    staminaToMax: k(0.045, 0, 0.2, 0.001, 'STAMINA 1당 최대치 증가율'),
    focusToSteady: k(0.026, 0, 0.15, 0.001, 'FOCUS 1당 호흡정지 효율 증가율'),
    /** 후반 완만화. 스탯 효과는 로그로 감쇠한다 (GDD 4장, balance-lens 검증 대상) */
    diminishAt: k(20, 5, 100, 1, '수확체감 시작 스탯 레벨'),
    diminishRate: k(0.6, 0.1, 1, 0.01, '수확체감 강도'),
  },

  /** 오프라인 축적 (GDD 5장) */
  offline: {
    arrowPerSec: k(1 / 90, 0.001, 0.2, 0.001, '화살 축적 속도', '/s'),
    arrowCap: k(40, 5, 200, 1, '화살 상한'),
    trainingPerSec: k(1 / 180, 0.001, 0.2, 0.001, '훈련치 축적 속도', '/s'),
    trainingCap: k(20, 5, 100, 1, '훈련치 상한'),
    requestPerSec: k(1 / 1500, 0.0001, 0.05, 0.0001, '의뢰 축적 속도', '/s'),
    requestCap: k(4, 1, 20, 1, '의뢰 상한'),
    /** 오프라인 축적을 끈 사람에게 주는 스테이지 보상 상향. balance-lens가 등가성을 검증한다. */
    optOutBonus: k(1.85, 1, 4, 0.05, '오프라인 OFF 시 보상 배수'),
  },

  /** 시뮬레이션 코어 */
  sim: {
    hz: k(120, 30, 240, 30, '고정 스텝 주파수', 'Hz'),
    maxCatchUpSteps: k(8, 1, 30, 1, '한 프레임에 따라잡을 최대 스텝 수'),
  },
} as const

type Spec = typeof SPEC
type Values<T> = { -readonly [K in keyof T]: T[K] extends Knob ? number : Values<T[K]> }

function materialize<T extends object>(spec: T): Values<T> {
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(spec)) {
    out[key] = val !== null && typeof val === 'object' && 'v' in val
      ? (val as Knob).v
      : materialize(val as object)
  }
  return out as Values<T>
}

/**
 * 살아 있는 튜닝 값. 게임 코드는 오직 이것만 읽는다.
 * 튜닝 콘솔이 런타임에 여기를 직접 덮어쓰므로 구조 분해(`const { drawTime } = P.bow`) 하지 말 것 —
 * 값이 고정돼 슬라이더가 안 먹는다.
 */
export const P: Values<Spec> = materialize(SPEC)

/** 콘솔이 쓰는 경로 접근자. 'bow.drawTime' 같은 점 경로. */
export function setParam(path: string, value: number): void {
  const parts = path.split('.')
  const leaf = parts.pop()
  if (leaf === undefined) return
  let node: Record<string, unknown> = P as unknown as Record<string, unknown>
  for (const part of parts) {
    const next = node[part]
    if (next === undefined || typeof next !== 'object') return
    node = next as Record<string, unknown>
  }
  node[leaf] = value
}

export function getParam(path: string): number | undefined {
  let node: unknown = P
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'number' ? node : undefined
}

/** SPEC을 평평한 목록으로. 콘솔 UI 생성용. */
export function flatKnobs(): Array<{ path: string; group: string; knob: Knob }> {
  const out: Array<{ path: string; group: string; knob: Knob }> = []
  for (const [group, section] of Object.entries(SPEC)) {
    for (const [name, knob] of Object.entries(section as Record<string, Knob>)) {
      out.push({ path: `${group}.${name}`, group, knob })
    }
  }
  return out
}
