/**
 * 무한 구간 (41판~) — 판을 **생성한다.**
 *
 * ── 왜 생겼나 ────────────────────────────────────────────────────────────
 * 형의 반려: **"일정 스테이지 이후에는 계속 똑같은 과녁만 나온다."**
 * 그럴 만했다. `getStage()`가 인덱스를 캠페인 마지막 판으로 잘라 버려서, 40판을 깬 사람은
 * 4-10을 무한히 다시 풀고 있었다. 판이 안 늘어난 게 아니라 **같은 판이 반복되고 있었다.**
 *
 * ── 이 파일의 규칙 ──────────────────────────────────────────────────────
 * 1. **무작위가 아니라 결정론이다** (A1). 41판은 누가 언제 켜도 같은 41판이다.
 *    난수는 전부 `seedFrom('...' + 판번호)`에서 나온다 — `Math.random`은 한 번도 안 쓴다.
 *    sim 의 `w.rng`(릴리즈 산포)와는 완전히 분리돼 있다. 여기서 굽는 건 배치일 뿐이다.
 * 2. **난이도는 크기가 아니라 배치로 만든다.** 각크기는 stagekit 의 곡선이 정하고
 *    H_FLOOR 에서 멈춘다 — 형이 "과녁이 너무 작다"고 한 번 반려한 방향으로는 다시 안 간다.
 * 3. **한 바퀴에 모든 테마가 정확히 한 번씩 나온다.** 무작위로 뽑으면 같은 테마가
 *    세 판 연속 나오는 일이 반드시 생기고, 그건 "똑같은 과녁"의 다른 이름이다.
 * 4. 화살 수는 **직접 맞혀야 하는 수(shots)**에서 계산한다. 과녁 수로 계산하면
 *    기둥 하나가 여섯을 무너뜨리는 연쇄 판에서 화살이 남아돈다.
 *
 * ※ 아래 `L` 은 **저작 수치**지 손맛 노브가 아니다 (stages.ts 의 좌표와 같은 성격).
 *   params.ts 는 m/s/rad 단위의 물리·감각 값만 담기로 한 규약이라 배치 비율은 여기 남는다.
 *   그래도 전부 이름을 붙여 둔다 — 식 안에 박힌 0.42 는 6주 뒤의 나에게 아무 뜻이 없다.
 */
import { TAU, clamp } from '../core/math.ts'
import { makeRng, seedFrom } from '../core/rng.ts'
import type { Rng } from '../core/rng.ts'
import type { StageDef } from '../sim/types.ts'
import { BASE_SCORE, CAMPAIGN_STAGES, angularSize, specOf } from './stagekit.ts'
import type { Spot } from './stagekit.ts'

/** 이 판이 요구하는 것. shots = 직접 맞혀야 하는 최소 발수 (연쇄로 딸려 죽는 건 안 센다). */
interface Plan {
  spots: Spot[]
  shots: number
}

interface Theme {
  /** HUD 한 줄. 판이 시작될 때 이름만으로 무엇이 올지 짐작되어야 한다. */
  name: string
  /** 판 시작 자막의 배움 한 줄 — 캠페인 teach와 같은 목소리. 이름만으로는 수수께끼다 (감사). */
  hint: string
  build(rng: Rng, e: number, reach: number): Plan
  /** 평균 풍속 (m/s). 없으면 무풍. */
  wind?(rng: Rng, e: number): number
}

/** 사거리 하한/상한 (m). 캠페인 마지막 판이 x=39 라 그 언저리에서 시작해 조금씩 벌린다. */
const REACH_NEAR = 30
const REACH_FAR = 44
/** 사거리가 REACH_FAR 에 닿는 데 걸리는 판 수. */
const REACH_RAMP = 30

/** 과녁 높이 한계 (m). 위로는 카메라 헤드룸(camera.ts arcHeadroom)이 감당하는 선. */
const Y_LOW = 0.7
const Y_HIGH = 8

/** 화살 지급 한계. 30초~1분 한 판이라는 제약 C1 이 상한을 정한다. */
const ARROWS_MIN = 6
const ARROWS_MAX = 10
/** 직접 맞혀야 하는 수 + 이만큼이 지급량이다. 여벌 2발은 언제나 남긴다 (stages.ts 규칙). */
const ARROWS_SLACK = 2

/**
 * 배치 비율. 전부 **사거리(reach)에 대한 비율**이거나 미터·헤르츠다.
 * 값 하나를 만지면 그 테마 하나만 바뀐다 — 이름이 어느 테마의 것인지 말해준다.
 */
const L = {
  /** 사열 — 첫 과녁이 서는 자리(사거리 비율)와 낮은/높은 줄의 높이대(m) */
  lineFrom: 0.42,
  lineLowMin: 1,
  lineLowMax: 2,
  lineHighMin: 2.8,
  lineHighMax: 4.2,
  lineJitter: 1,
  /** 몇 판마다 과녁이 하나씩 는가 */
  linePerAdd: 9,

  /** 기둥 — 열이 서는 구간, 꼭대기 높이대, 맨 아래 알갱이 높이 */
  towerFrom: 0.4,
  towerSpan: 0.5,
  towerJitter: 0.8,
  towerTopMin: 5.4,
  towerTopMax: 7.4,
  towerFloor: 1.2,
  /**
   * 0.85 -> 1: 알갱이는 연쇄로 딸려 죽으라고 둔 것이지만, 연쇄를 놓친 사람은 이걸 직접 쏴야 한다.
   * 무한 구간 후반에서는 각크기가 이미 바닥이라 거기서 0.85를 더 곱하면 점이 된다.
   */
  towerBeadSize: 1,
  /**
   * 열은 **둘로 고정한다.** 셋으로 늘렸더니 과녁이 12개가 되어 화살(상한 10발)로는
   * 연쇄를 못 읽은 사람이 물리적으로 못 깨고, 한 판이 23초에서 …로 늘어나 C1(30초~1분)도
   * 위태로웠다 (밸런스 시뮬 41+16판 클리어 5%). 난이도는 열 수가 아니라 각크기·사거리가 올린다.
   */
  towerCols: 2,

  /** 진자 — 흔들림 주기(Hz)와 진폭(m) */
  swingFrom: 0.42,
  swingSpan: 0.5,
  swingJitter: 1,
  swingYMin: 1.6,
  swingYMax: 3.6,
  swingFreqBase: 0.24,
  swingFreqStep: 0.006,
  /**
   * 0.22 -> 0.12: 주기가 0.43Hz 까지 오르니 봇의 발당 명중률이 42%로 무너졌다
   * (밸런스 시뮬 41+17판 클리어 20%). 이동 과녁은 "리드 샷을 배우는 판"이지
   * "반응속도를 재는 판"이 아니다 — 빨라지는 건 여기서 멈춘다.
   */
  swingFreqAdd: 0.06,
  /**
   * 움직이는 과녁은 같은 각크기라도 훨씬 어렵다 — 조준점이 멈춰 있지 않기 때문이다.
   * 크기로 그 값을 돌려준다. 이게 없으면 무한 구간 후반의 진자 판이 통째로 벽이 된다
   * (밸런스 시뮬 41+17판 클리어 34%).
   */
  swingSize: 1.3,
  swingFreqVarLo: 0.85,
  swingFreqVarHi: 1.25,
  swingAmpYMin: 1,
  swingAmpYMax: 2,
  swingAmpXMin: 1.4,
  swingAmpXMax: 2.6,
  /**
   * 움직이는 과녁은 **셋에서 멈춘다.** 넷으로 늘렸더니 봇의 발당 명중률이 45%로 떨어져
   * 클리어 20%가 나왔다 (밸런스 시뮬 41+17판). 리드 샷은 하나를 배우면 셋도 맞힌다 —
   * 넷째는 새로 배울 게 없고 화살만 더 먹는다.
   */
  swingCount: 3,
  /** 기준점이 되는 정지 과녁이 서는 자리 (사거리 비율) */
  swingAnchorAt: 0.98,

  /** 관통줄 — 줄이 놓이는 구간과 기울기(m) */
  pierceFrom: 0.4,
  pierceTo: 0.95,
  pierceYMin: 1.4,
  pierceYMax: 2.6,
  /** 줄이 내려갈 수 있는 최대치 / 올라갈 수 있는 최대치 (m) */
  pierceDropMax: 1.2,
  pierceRiseMax: 2.6,
  pierceFourthAt: 20,
  /** 한 발이 줄을 꿰는 판이라 요구 발수는 과녁 수와 무관하다 */
  pierceShots: 2,

  /** 아치 — 포물선이 놓이는 구간과 꼭대기 높이(m) */
  archFrom: 0.32,
  archTo: 1,
  archBase: 1.1,
  archPeakMin: 4.2,
  archPeakMax: 6.4,
  archPerAdd: 14,

  /** 군집 — 뭉치의 중심·반경(m)과 파수꾼 자리 */
  clusterFromMin: 0.45,
  clusterFromMax: 0.62,
  clusterYMin: 2,
  clusterYMax: 3.6,
  clusterRMin: 0.9,
  clusterRMax: 1.7,
  clusterAngleJitter: 0.2,
  clusterBeadSize: 0.9,
  clusterFifthAt: 18,
  guardFrom: 0.85,
  guardStep: 0.12,
  guardYMin: 1,
  guardYMax: 4,
  guardSecondAt: 10,
  /** 뭉치는 두세 발이면 정리된다 (폭발 살이면 한 발) */
  clusterShots: 3,

  /** 계단 — 오르내리는 높이(m) */
  stairFrom: 0.4,
  stairBase: 1,
  stairRiseMin: 4.4,
  stairRiseMax: 6,
  stairFifthAt: 15,

  /** 바람골 — 풍속(m/s)과 과녁이 서는 먼 구간 */
  galeFrom: 0.55,
  galeSpan: 0.45,
  galeYMin: 1.2,
  galeYMax: 4.6,
  galeWindMin: 3,
  galeWindMax: 4.5,
  galeWindStep: 0.05,
  galeWindAdd: 2,
  galeFourthAt: 22,

  /** 고리 — 중심·반경(m) */
  ringCount: 6,
  ringFromMin: 0.55,
  ringFromMax: 0.7,
  ringYMin: 3.2,
  ringYMax: 4.6,
  ringRMin: 1.9,
  ringRMax: 2.7,
  ringBeadSize: 0.9,
  ringCoreSize: 0.8,
  ringCoreAt: 14,

  /** 폭풍 — 종합. 기둥 + 관통 두 장 + 이동 하나 + 바람 */
  stormTowerMin: 0.38,
  stormTowerMax: 0.5,
  stormTopMin: 5.6,
  stormTopMax: 7.2,
  stormFloor: 1.3,
  stormBeadSize: 1,
  stormPierceA: 0.66,
  stormPierceB: 0.82,
  stormPierceYMin: 2,
  stormPierceYMax: 3.4,
  /** 뒤 관통 과녁이 앞보다 내려갈 수 있는 폭 / 올라갈 수 있는 폭 (m) */
  stormPierceDrop: 0.6,
  stormPierceGapMax: 0.9,
  stormMoverAt: 0.95,
  stormMoverYMin: 1.6,
  stormMoverYMax: 3.4,
  stormMoverAmpMin: 1.6,
  stormMoverAmpMax: 2.6,
  stormMoverFreq: 0.28,
  stormMoverFreqStep: 0.005,
  stormMoverFreqAdd: 0.16,
  stormWindMin: 2.5,
  stormWindMax: 4,
  stormWindStep: 0.04,
  stormWindAdd: 1.5,
  /**
   * 관통 두 장을 한 발로 꿰고 기둥을 한 발로 무너뜨리면 네 발이면 된다.
   * 그래도 다섯으로 잡는다 — 종합 판에서 여벌이 0이면 한 번 삐끗한 순간 판이 끝난다.
   */
  stormShots: 5,

  /** 돌진 — 출발 자리(사거리 비율)와 높이(m). 뒤 놈일수록 **안쪽**에서 출발한다 */
  rushFrom: 0.95,
  rushGapMin: 0.09,
  rushGapMax: 0.13,
  rushYMin: 1.4,
  rushYMax: 3.2,
  rushSize: 1.15,
  /** 돌진과 섞어 두는 정지 과녁 — 얘를 먼저 칠지 돌진을 먼저 칠지가 이 판의 판단이다 */
  rushStaticFrom: 0.42,
  rushStaticSpan: 0.3,
  rushStaticYMin: 1.2,
  rushStaticYMax: 3.4,
  /** 몇 판마다 돌진이 하나 는가 */
  rushPerAdd: 12,

  /** 보급 — 뭉치에서 떨어진 자리에 하나. 크기를 조금 키워 "저건 쏘는 게 이득"이 읽히게 */
  supplySize: 1.2,
  supplyYMin: 3.4,
  supplyYMax: 6.2,
  supplyFromMin: 0.5,
  supplyFromMax: 0.9,

  /** 별 2개 문턱 = 요구 발수의 이만큼을 맞혔을 때 (stages.ts 의 need() 와 같은 성격) */
  star2Ratio: 0.8,
} as const

const yc = (v: number): number => clamp(v, Y_LOW, Y_HIGH)

/**
 * 바람의 방향. **양쪽 다 나와야 한다.**
 *
 * 예전엔 풍속이 언제나 양수라 바람이 오른쪽으로만 불었다 (형의 지적:
 * "바람은 왜 항상 오른쪽으로만 부는 거 같냐"). 방향이 하나뿐이면 배울 게 없다 —
 * 그건 바람이 아니라 그냥 조준점에 더하는 상수다. 깃발이 좌우로 눕는 걸 보고
 * 어느 쪽으로 얼마나 겨눌지 정하는 게 이 메커닉의 전부다 (render/scene.ts drawWindFlag).
 */
const windSign = (rng: Rng): number => (rng.chance(0.5) ? 1 : -1)

/** 0..1 을 0에서 시작해 가운데가 최고인 포물선으로. 화살이 그리는 선과 같은 모양이다. */
const arcOf = (t: number): number => 4 * t * (1 - t)

// ───────────────────────────── 테마 ─────────────────────────────
//
// 열 가지. 각각 **다른 것을 요구한다** — 거리, 낙차, 리드 샷, 각도, 순서, 바람.
// 하나가 "이번엔 뭘 해야 하지"를 못 만들면 그건 테마가 아니라 장식이다.

const THEMES: readonly Theme[] = [
  {
    // 가장 기본. 거리와 낙차만으로 판을 만든다. 사이사이의 쉼표 같은 판이다.
    name: '사열',
    hint: '한 줄로 늘어섰다 — 거리부터 읽는다',
    build(rng, e, reach): Plan {
      const n = 3 + Math.min(3, Math.floor(e / L.linePerAdd))
      const spots: Spot[] = []
      const x0 = reach * L.lineFrom
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0
        const high = i % 2 !== 0
        spots.push({
          x: x0 + (reach - x0) * t + rng.range(-L.lineJitter, L.lineJitter),
          // 지그재그. 같은 높이로 세우면 한 번 맞춘 각도를 그대로 반복하게 된다.
          y: yc(high ? rng.range(L.lineHighMin, L.lineHighMax) : rng.range(L.lineLowMin, L.lineLowMax)),
        })
      }
      return { spots, shots: n }
    },
  },
  {
    // 이 게임의 쾌감 레이어 — 공중 과녁을 떨어뜨려 아래를 쓸어버린다 (GDD 7장 보로로로록).
    name: '기둥',
    hint: '꼭대기를 떨어뜨리면 아래가 무너진다',
    build(rng, _e, reach): Plan {
      const cols = L.towerCols
      const spots: Spot[] = []
      for (let c = 0; c < cols; c++) {
        const t = cols > 1 ? c / (cols - 1) : 0.5
        const cx = reach * (L.towerFrom + L.towerSpan * t) + rng.range(-L.towerJitter, L.towerJitter)
        const top = rng.range(L.towerTopMin, L.towerTopMax)
        spots.push({ x: cx, y: yc(top), kind: 'aerial' })
        // 기둥 하나에 알갱이 2~3. 간격이 넓으면 낙하물이 그냥 지나친다 (P.chain.hitRadius).
        const beads = rng.int(2, 3)
        const drop = top - L.towerFloor
        for (let b = 0; b < beads; b++) {
          const bt = (b + 1) / (beads + 1)
          spots.push({ x: cx, y: yc(top - drop * bt), size: L.towerBeadSize })
        }
      }
      // 기둥 하나당 한 발이면 무너진다 — 그게 이 판의 **답**이지 **조건**은 아니다.
      // 연쇄를 못 읽은 사람도 하나씩 쏴서 깰 수 있어야 한다. 열 하나당 한 발만 아껴 준다.
      // (여기서 cols+1 로 잡았다가 밸런스 시뮬에서 41+5판 클리어율 0%가 나왔다 — 화살 소진 100%.)
      return { spots, shots: spots.length - cols }
    },
  },
  {
    // 리드 샷. 멈추는 순간을 기다릴 것인가, 앞을 겨눌 것인가.
    name: '진자',
    hint: '흔들림은 끝에서 잠깐 멈춘다',
    build(rng, e, reach): Plan {
      const n = L.swingCount
      const spots: Spot[] = []
      const speed = L.swingFreqBase + Math.min(L.swingFreqAdd, e * L.swingFreqStep)
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0
        // 세로 흔들림과 가로 흔들림을 섞는다. 한 종류뿐이면 한 가지 보정만 배우고 끝난다.
        const vertical = rng.chance(0.5)
        const ampY = vertical ? rng.range(L.swingAmpYMin, L.swingAmpYMax) : 0
        const s: Spot = {
          x: reach * (L.swingFrom + L.swingSpan * t) + rng.range(-L.swingJitter, L.swingJitter),
          // ★ 진폭까지 포함해 가둔다. 중심만 가두면 아래로 흔들릴 때 과녁이 지면을 뚫는다.
          y: clamp(rng.range(L.swingYMin, L.swingYMax), Y_LOW + ampY, Y_HIGH - ampY),
          kind: 'moving',
          size: L.swingSize,
          freq: speed * rng.range(L.swingFreqVarLo, L.swingFreqVarHi),
        }
        if (vertical) s.ampY = ampY
        else s.ampX = rng.range(L.swingAmpXMin, L.swingAmpXMax)
        spots.push(s)
      }
      // 멈춰 있는 하나를 끼워 넣는다. 화면 전체가 흔들리면 기준점이 없어 리드 샷을 배울 수 없다 —
      // 정지 과녁 하나가 "얼마나 앞을 겨눠야 하는가"의 자가 된다.
      spots.push({
        x: reach * L.swingAnchorAt,
        y: yc(rng.range(L.swingYMin, L.swingYMax)),
      })
      return { spots, shots: spots.length }
    },
  },
  {
    // 각도를 찾는 판. 한 줄로 서 있으면 한 발이 전부를 꿴다.
    name: '관통줄',
    hint: '한 발로 꿰는 각이 숨어 있다',
    build(rng, e, reach): Plan {
      const n = 3 + (e >= L.pierceFourthAt ? 1 : 0)
      const x0 = reach * L.pierceFrom
      const x1 = reach * L.pierceTo
      const y0 = rng.range(L.pierceYMin, L.pierceYMax)
      // 기울기를 준다. 수평으로 세우면 매번 같은 각도라 배울 게 없다.
      const y1 = y0 + rng.range(-L.pierceDropMax, L.pierceRiseMax)
      const spots: Spot[] = []
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0
        spots.push({ x: x0 + (x1 - x0) * t, y: yc(y0 + (y1 - y0) * t), kind: 'pierceable' })
      }
      return { spots, shots: L.pierceShots }
    },
  },
  {
    // 포물선 위에 놓인 과녁들. 화살이 그리는 선과 같은 모양이라 "한 각도로 쓸어담기"가 성립한다.
    name: '아치',
    hint: '걸린 것들을 낙차로 따라간다',
    build(rng, e, reach): Plan {
      const n = 4 + Math.min(2, Math.floor(e / L.archPerAdd))
      const peak = rng.range(L.archPeakMin, L.archPeakMax)
      const x0 = reach * L.archFrom
      const x1 = reach * L.archTo
      const spots: Spot[] = []
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0
        spots.push({ x: x0 + (x1 - x0) * t, y: yc(L.archBase + peak * arcOf(t)) })
      }
      return { spots, shots: n }
    },
  },
  {
    // 뭉친 것과 떨어진 것. 폭발 살이 빛나는 판이고, 아니면 화살을 나눠 써야 한다.
    name: '군집',
    hint: '뭉쳐 있다 — 한가운데가 자리다',
    build(rng, e, reach): Plan {
      const spots: Spot[] = []
      const cx = reach * rng.range(L.clusterFromMin, L.clusterFromMax)
      const cy = rng.range(L.clusterYMin, L.clusterYMax)
      const beads = 4 + (e >= L.clusterFifthAt ? 1 : 0)
      for (let i = 0; i < beads; i++) {
        const a = (i / beads) * TAU + rng.range(-L.clusterAngleJitter, L.clusterAngleJitter)
        const rr = rng.range(L.clusterRMin, L.clusterRMax)
        spots.push({
          x: cx + Math.cos(a) * rr,
          y: yc(cy + Math.sin(a) * rr),
          size: L.clusterBeadSize,
        })
      }
      // 파수꾼 — 뭉치에서 멀리 떨어져 따로 한 발을 요구한다.
      const guards = e >= L.guardSecondAt ? 2 : 1
      for (let i = 0; i < guards; i++) {
        spots.push({
          x: reach * (L.guardFrom + i * L.guardStep),
          y: yc(rng.range(L.guardYMin, L.guardYMax)),
        })
      }
      return { spots, shots: L.clusterShots + guards }
    },
  },
  {
    // 같은 간격으로 올라간다. 낙차를 몸으로 재는 판.
    name: '계단',
    hint: '한 칸씩 오른다, 각도도 한 칸씩',
    build(rng, e, reach): Plan {
      const n = 4 + (e >= L.stairFifthAt ? 1 : 0)
      const up = rng.chance(0.5)
      const x0 = reach * L.stairFrom
      const rise = rng.range(L.stairRiseMin, L.stairRiseMax)
      const spots: Spot[] = []
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0
        const step = up ? t : 1 - t
        spots.push({ x: x0 + (reach - x0) * t, y: yc(L.stairBase + step * rise) })
      }
      return { spots, shots: n }
    },
  },
  {
    // 바람은 매 스텝 흔들리는 게 아니라 주기적으로 변한다 (sim/world.ts). 읽고 기다리는 판.
    name: '바람골',
    hint: '바람이 세다 — 깃발부터 본다',
    wind: (rng, e) =>
      windSign(rng) * (rng.range(L.galeWindMin, L.galeWindMax) + Math.min(L.galeWindAdd, e * L.galeWindStep)),
    build(rng, e, reach): Plan {
      const n = 3 + (e >= L.galeFourthAt ? 1 : 0)
      const spots: Spot[] = []
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0
        spots.push({
          x: reach * (L.galeFrom + L.galeSpan * t),
          y: yc(rng.range(L.galeYMin, L.galeYMax)),
        })
      }
      return { spots, shots: n }
    },
  },
  {
    // 고리. 어느 쪽을 먼저 뚫어도 되지만, 화살이 모자라면 순서가 답이 된다.
    name: '고리',
    hint: '가장자리를 돈다 — 가운데는 비었다',
    build(rng, e, reach): Plan {
      const n = L.ringCount
      const cx = reach * rng.range(L.ringFromMin, L.ringFromMax)
      const cy = rng.range(L.ringYMin, L.ringYMax)
      const rr = rng.range(L.ringRMin, L.ringRMax)
      const phase = rng.range(0, TAU)
      const spots: Spot[] = []
      for (let i = 0; i < n; i++) {
        const a = phase + (i / n) * TAU
        spots.push({
          x: cx + Math.cos(a) * rr,
          y: yc(cy + Math.sin(a) * rr),
          size: L.ringBeadSize,
        })
      }
      // 가운데 하나 — 고리를 다 지우기 전에는 겨누기 어렵다.
      if (e >= L.ringCoreAt) spots.push({ x: cx, y: yc(cy), size: L.ringCoreSize })
      return { spots, shots: spots.length - 1 }
    },
  },
  {
    /**
     * 돌진 — **이 게임에서 유일하게 나를 향해 오는 판.**
     *
     * 정지 과녁 몇과 다가오는 것 몇을 섞는다. 다 지울 화살은 충분하지만
     * **순서를 틀리면 돌진이 먼저 닿는다.** 그 판단 하나가 이 판의 전부다.
     */
    name: '돌진',
    hint: '이쪽으로 온다 — 멀 때가 쉽다',
    build(rng, e, reach): Plan {
      const spots: Spot[] = []
      const rushers = 2 + Math.min(2, Math.floor(e / L.rushPerAdd))
      for (let i = 0; i < rushers; i++) {
        spots.push({
          // 뒤 놈일수록 안쪽에서 출발한다 — 가까운 놈이 먼저 닿으니 도착 시각이 자연히 벌어진다.
          // 사거리 밖에서 출발시키면 맞힐 수 없는 과녁이 생긴다 (경계 테스트가 지키는 불변식).
          x: reach * (L.rushFrom - i * rng.range(L.rushGapMin, L.rushGapMax)),
          y: yc(rng.range(L.rushYMin, L.rushYMax)),
          kind: 'charger',
          size: L.rushSize,
        })
      }
      // 가만히 있는 것들 — 이걸 먼저 칠지가 유혹이다.
      for (let i = 0; i < 2; i++) {
        spots.push({
          x: reach * (L.rushStaticFrom + i * L.rushStaticSpan),
          y: yc(rng.range(L.rushStaticYMin, L.rushStaticYMax)),
        })
      }
      return { spots, shots: spots.length }
    },
  },
  {
    /**
     * 보급 — 화살을 벌 수 있는 판. 높이 매달린 보급을 맞히면 화살이 돌아온다.
     * 화살을 빠듯하게 주는 이유: **보급을 안 쏘면 모자라게** 만들어야 선택이 성립한다.
     */
    name: '보급',
    hint: '맞히면 화살이 돌아온다',
    build(rng, e, reach): Plan {
      const spots: Spot[] = []
      const supplies = 1 + (e >= L.rushPerAdd ? 1 : 0)
      for (let i = 0; i < supplies; i++) {
        spots.push({
          x: reach * rng.range(L.supplyFromMin, L.supplyFromMax),
          y: yc(rng.range(L.supplyYMin, L.supplyYMax)),
          kind: 'bonus',
          size: L.supplySize,
          give: 2,
        })
      }
      const n = 4 + Math.min(2, Math.floor(e / L.linePerAdd))
      const x0 = reach * L.lineFrom
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0
        spots.push({
          x: x0 + (reach - x0) * t,
          y: yc(i % 2 === 0 ? rng.range(L.lineLowMin, L.lineLowMax) : rng.range(L.lineHighMin, L.lineHighMax)),
        })
      }
      // 보급을 되찾는 걸 계산에 넣는다. 안 쏘면 정확히 모자란다.
      return { spots, shots: spots.length - supplies }
    },
  },
  {
    // 열 판에 한 번 오는 종합. 지금까지 배운 게 한꺼번에 온다.
    name: '폭풍',
    hint: '전부 한꺼번에 온다 — 순서를 정하라',
    wind: (rng, e) =>
      windSign(rng) * (rng.range(L.stormWindMin, L.stormWindMax) + Math.min(L.stormWindAdd, e * L.stormWindStep)),
    build(rng, e, reach): Plan {
      const spots: Spot[] = []
      // 기둥 하나
      const cx = reach * rng.range(L.stormTowerMin, L.stormTowerMax)
      const top = rng.range(L.stormTopMin, L.stormTopMax)
      spots.push({ x: cx, y: yc(top), kind: 'aerial' })
      spots.push({ x: cx, y: yc((top + L.stormFloor) * 0.5), size: L.stormBeadSize })
      spots.push({ x: cx, y: yc(L.stormFloor), size: L.stormBeadSize })
      // 관통 두 장
      const py0 = rng.range(L.stormPierceYMin, L.stormPierceYMax)
      spots.push({ x: reach * L.stormPierceA, y: yc(py0), kind: 'pierceable' })
      spots.push({
        x: reach * L.stormPierceB,
        y: yc(py0 + rng.range(-L.stormPierceDrop, L.stormPierceGapMax)),
        kind: 'pierceable',
      })
      // 움직이는 하나
      spots.push({
        x: reach * L.stormMoverAt,
        y: yc(rng.range(L.stormMoverYMin, L.stormMoverYMax)),
        kind: 'moving',
        ampX: rng.range(L.stormMoverAmpMin, L.stormMoverAmpMax),
        freq: L.stormMoverFreq + Math.min(L.stormMoverFreqAdd, e * L.stormMoverFreqStep),
      })
      return { spots, shots: L.stormShots }
    },
  },
]

// ───────────────────────── 테마 순서 ─────────────────────────

/**
 * 한 바퀴(테마 수만큼의 판) 동안 모든 테마가 정확히 한 번씩 나오도록 섞는다.
 *
 * 매 판 독립으로 뽑으면 같은 테마가 세 판 연속 나오는 일이 반드시 생긴다 —
 * 그게 형이 본 "똑같은 과녁만 나온다"의 재발 경로다. 블록 셔플이면 구조적으로 불가능하다.
 */
function shuffledBlock(block: number): number[] {
  const n = THEMES.length
  const order: number[] = []
  for (let i = 0; i < n; i++) order.push(i)
  const rng = makeRng(seedFrom(`hanbal.endless.block.${block}`))
  // Fisher-Yates. 뒤에서부터 뽑아야 분포가 고르다.
  for (let i = n - 1; i > 0; i--) {
    const j = rng.int(0, i)
    const a = order[i] as number
    order[i] = order[j] as number
    order[j] = a
  }
  return order
}

/**
 * 블록 경계 보정까지 마친 순서.
 *
 * 블록의 첫 테마가 직전 블록의 마지막과 같으면 앞의 두 자리를 **맞바꾼다.**
 * (밀어내는 게 아니라 맞바꾸는 게 중요하다 — 밀면 그 테마가 한 블록에 두 번 나온다.)
 * 자리 0·1만 건드리므로 이 블록의 마지막 원소는 변하지 않고, 그래서 다음 블록이
 * 참조하는 "직전 블록의 마지막"은 섞기 직후 값과 언제나 같다 (재귀가 필요 없다).
 */
function blockOrder(block: number): number[] {
  const n = THEMES.length
  const order = shuffledBlock(block)
  if (block > 0) {
    const prevLast = shuffledBlock(block - 1)[n - 1]
    if (order[0] === prevLast) {
      const a = order[0] as number
      order[0] = order[1] as number
      order[1] = a
    }
  }
  return order
}

/** 무한 구간 번호 e(0부터)의 테마 인덱스. */
function themeIndex(e: number): number {
  const n = THEMES.length
  return blockOrder(Math.floor(e / n))[e % n] as number
}

// ───────────────────────── 판 굽기 ─────────────────────────

/** 만든 판을 몇 개 들고 있는다. R 재시작마다 다시 구우면 같은 판인데 객체가 새로 난다 (A5). */
const CACHE = new Map<number, StageDef>()
const CACHE_MAX = 8

function build(index: number): StageDef {
  const e = index - CAMPAIGN_STAGES
  const n = index + 1
  const theme = THEMES[themeIndex(e)] as Theme
  // 배치 난수. 판 번호에서만 나온다 — 같은 판은 언제 켜도 같은 판이다 (A1).
  const rng = makeRng(seedFrom(`hanbal.endless.layout.${index}`))

  const reach = REACH_NEAR + (REACH_FAR - REACH_NEAR) * clamp(e / REACH_RAMP, 0, 1)
  const plan = theme.build(rng, e, reach)
  const h = angularSize(n)

  const chapter = Math.floor(index / 10) + 1
  const id = `${chapter}-${(index % 10) + 1}`
  const shots = clamp(Math.round(plan.shots), 1, ARROWS_MAX)

  return {
    id,
    title: theme.name,
    hint: theme.hint,
    seed: seedFrom(id),
    arrows: clamp(shots + ARROWS_SLACK, ARROWS_MIN, ARROWS_MAX),
    targetScore: BASE_SCORE * Math.max(1, Math.round(shots * L.star2Ratio)),
    wind: theme.wind === undefined ? 0 : theme.wind(rng, e),
    targets: plan.spots.map((s) => specOf(h, s)),
  }
}

/**
 * 41판 이후의 판. index 는 0부터 세는 전체 판 번호다 (40 = 41번째 판).
 * 같은 index 는 캐시가 살아 있는 동안 **같은 객체**를 돌려준다.
 */
export function endlessStage(index: number): StageDef {
  const hit = CACHE.get(index)
  if (hit !== undefined) return hit
  const made = build(index)
  if (CACHE.size >= CACHE_MAX) {
    const oldest = CACHE.keys().next()
    if (oldest.done !== true) CACHE.delete(oldest.value)
  }
  CACHE.set(index, made)
  return made
}

/** 무한 구간의 테마 이름. 디버그·저작용. */
export function endlessThemeName(index: number): string {
  const t = THEMES[themeIndex(index - CAMPAIGN_STAGES)]
  return t?.name ?? ''
}

/** 테마 수. 밸런스 도구가 "한 바퀴"를 몇 판으로 볼지 알아야 한다. */
export const ENDLESS_THEMES = THEMES.length
