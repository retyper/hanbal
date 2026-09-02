/**
 * 판 보상 — 별 셋과 변동 보상 (docs/HOOK.md ★3 · ★4)
 *
 * 클리어 조건이 "과녁을 다 없애는 것"으로 바뀌면서(sim/world.ts evaluateEnd) 점수는
 * **문턱이 아니라 보상의 크기**가 됐다. 이 파일이 그 환산을 맡는다.
 *
 * ── 별 셋: 재도전의 이유 ──
 *   ★    클리어 (과녁을 다 없앴다)
 *   ★★   점수 기준선 × STAR2_MUL 도달 — 링 배수·연쇄가 얹혀야 닿는다
 *   ★★★  무손실 — 빗나간 화살이 하나도 없다
 * 별은 단조롭게 쌓인다. ★★을 받았는데 ★이 없는 상태는 만들지 않는다 — 그러면 별이
 * "몇 개인가"가 아니라 "어느 것인가"가 되어 한눈에 안 읽힌다.
 *
 * ── 변동 보상: 왜 이게 사행성이 아닌가 ──
 * 슬롯머신의 재미 부분(변동 비율 보상)만 가져오고 돈이 걸리는 부분은 버렸다 (HOOK 2장).
 * 뽑기·구매·확률 공개 같은 건 여기 없다. **가끔 더 나오는 훈련치**가 전부다.
 *
 * ── 그리고 운이 실력을 덮으면 안 된다 (HOOK 4장) ──
 * 그래서 보너스는 **곱셈 상한이 있고, 클리어한 판에서만, 바닥을 깎지 않는 방향으로만** 붙는다.
 *   · 기대 기여    : 소계의 +14.4%
 *   · 최대 한 판   : 소계의 2.5배 (확률 4%)
 *   · 실력의 폭    : 못한 판 2 → 잘한 판 약 29 (14배)
 * 즉 운의 폭(1~2.5배)이 실력의 폭(14배)을 덮지 못한다. 이게 이 파일의 유일한 밸런스 주장이다.
 *
 * ARCHITECTURE A1: 여기서 Math.random을 쓰지 않는다. `rng`는 반드시 시드 RNG다.
 */
import type { Rng } from '../core/rng.ts'
import type { StageDef } from '../sim/types.ts'
import { P } from '../tune/params.ts'

// ─────────────────────────── 계약 ───────────────────────────

/** 판 하나의 결과. game/loop.ts가 sim 이벤트를 세어 만든다. */
export interface RunStats {
  cleared: boolean
  score: number
  /** 실제로 소모한 화살 */
  arrowsUsed: number
  /** 이 판에 지급된 화살 */
  arrowsGiven: number
  /** 명중 수 (hit 이벤트). 관통·분열·사슬 때문에 shots보다 클 수 있다. */
  hits: number
  /** 쏜 발수 */
  shots: number
  /**
   * 아무것도 못 맞히고 사라진 **쏜 화살**의 수 (miss 이벤트).
   *
   * 축은 '쏜 발'이다. 분열 자식은 지급된 화살이 아니라 그 한 발의 결과물이라 여기 안 들어간다
   * (ballistics.ts가 자식의 착지에는 아예 miss를 뱉지 않는다). 넣으면 분모(shots)보다 커진다.
   *
   * 무손실을 `hits >= shots`로 재면 **거짓 양성이 난다** — 관통 살로 셋을 꿰뚫고 한 발을
   * 완전히 흘려도 hits 3 ≥ shots 2 라 무손실이 된다. 빗나간 것을 직접 세는 게 유일하게 옳다.
   */
  misses: number
  /** 이 판에서 이어간 최고 연쇄 수 */
  bestChain: number
  /** 정중앙 명중 수 (명중도 ≥ P.hit.bullseyeAcc) */
  bullseyes: number
  /** 금관 사수를 **머리로** 눕힌 수 (bounty 이벤트). 몸통으로 눕히면 안 센다. */
  bounties: number
}

export interface Reward {
  /** 이번 판이 준 훈련치 총합 (보너스 포함) */
  training: number
  /** 0~3 */
  stars: number
  /** 화면에 뜨는 위업 이름. 짧은 한글. */
  feats: readonly string[]
  /** 그중 변동 보너스로 들어온 몫. 0이면 이번 판은 평범했다. */
  bonus: number
}

/**
 * 정중앙 판정 문턱 (명중도 0..1, 1이 정중심).
 *
 * 단일 출처는 `P.hit.bullseyeAcc`다 (A2). 여기서 상수로 복사해 두면 손맛 쪽(render/effects.ts의
 * 크리티컬)과 보상 쪽이 갈라져, "정중앙!"이 터졌는데 정중앙으로 안 세어지는 판이 생긴다.
 * 함수인 이유도 그것이다 — 튜닝 콘솔이 P를 런타임에 덮어쓰므로 값을 붙잡아두면 안 된다.
 */
export function bullseyeAcc(): number {
  return P.hit.bullseyeAcc
}

export const STAR_MAX = 3

// ─────────────────────── 조율 상수 ───────────────────────
//
// 손맛(m/s·rad)이 아니라 경제 곡선이라 params.ts에 아직 올리지 않았다.
// TODO(params): src/tune/params.ts → P.reward.*  (밸런스 시뮬로 40판 누적 훈련치를 재고 나서)

/** 점수 기준선(targetScore)을 정확히 맞췄을 때 나오는 훈련치. */
const SCORE_TRAIN = 4
/**
 * 점수 비율의 상한. 없으면 후반 연쇄 판에서 점수가 기준선의 6~7배까지 나와
 * 훈련치가 판 하나에서 폭발한다 — 성장 곡선(GDD 4장)이 통째로 무의미해진다.
 */
const SCORE_RATIO_CAP = 2.5
/** 별 하나당 훈련치. 별의 주 용도는 해금이고 훈련치는 덤이다. */
const STAR_TRAIN = 1

/** 위업 지급액. 전부 실력의 결과라 운과 섞이지 않는다. */
const FEAT_BULLSEYE = 2
const FEAT_BULLSEYE_MANY = 3
const FEAT_CHAIN = 2
const FEAT_CHAIN_BIG = 4
const FEAT_MULTI = 2
const FEAT_FLAWLESS = 3
const FEAT_SPARE = 1
/**
 * 현상금 — 금관 사수 헤드샷 (2026-09-02, 형: "돈을 벌고 싶어지도록"). 위업 중 가장 크다.
 * 판 평균 훈련치(~16)의 절반 남짓 — 한 발이 판 하나의 값을 반쯤 더 만든다. 이게 "벌었다"의 크기다.
 */
const FEAT_BOUNTY = 8

/** 위업 문턱 */
const CHAIN_FEAT_AT = 4
const CHAIN_BIG_AT = 6
const BULLSEYE_MANY_AT = 3
/** 여벌을 이만큼 남기고 깼으면 잘 쏜 것이다 */
const SPARE_AT = 2

/** 변동 보상. 큰 쪽을 먼저 굴린다(구간이 겹치지 않게). */
const BONUS_BIG_P = 0.04
const BONUS_BIG_MUL = 1.5
const BONUS_SMALL_P = 0.14
const BONUS_SMALL_MUL = 0.6

const FEAT_BONUS_SMALL = '좋은 화살촉'
const FEAT_BONUS_BIG = '명궁의 화살통'

/** 갈림길 '바람골' 표시 (game/forks.ts). 배수 자체는 forks.ts의 WIND_TRAIN_MUL이 정답이다. */
const FEAT_FORK_WIND = '바람골 보너스'

// ─────────────────────────── 별 ───────────────────────────

/** 빗나간 화살이 하나도 없는가. 판정의 근거는 miss 이벤트 수 하나뿐이다 (RunStats.misses 주석). */
function flawless(r: RunStats): boolean {
  return r.shots > 0 && r.misses === 0
}

/**
 * ★★의 점수 문턱. `stage.targetScore × 이 값`.
 *
 * 왜 1이 아닌가: targetScore = 100 × 요구 명중수 이고, 클리어 = 과녁 전멸이라
 * **깨면 점수가 반드시 targetScore 이상**이다. 배수가 1이면 ★★는 클리어의 다른 이름일 뿐이고,
 * 별이 눈금이 아니라 상수가 된다 (실측 ★★ 획득률 99.4% — docs/BALANCE.md).
 * 링 배수(최대 2배)와 연쇄가 얹혀야 닿는 자리에 둬야 "다시 해서 별을 채운다"가 성립한다.
 */
const STAR2_MUL = 1.6

/**
 * 별 개수. 클리어하지 못한 판은 0이다 — 점수만 채우고 과녁을 남긴 판에 별을 주면
 * "판을 끝내는 것"과 "점수를 버는 것"이 다시 갈라진다.
 */
export function starsOf(stage: StageDef, r: RunStats): number {
  if (!r.cleared) return 0
  let s = 1
  if (stage.targetScore <= 0 || r.score >= stage.targetScore * STAR2_MUL) s++
  if (flawless(r)) s++
  return s
}

// ─────────────────────────── 채점 ───────────────────────────

/**
 * 판이 끝났다. 훈련치·별·위업을 매긴다. **세이브를 건드리지 않는다** —
 * 저장은 부르는 쪽(game/progression.ts)의 일이고, 이 함수는 같은 입력에 같은 답만 낸다.
 *
 * `rng`는 **판마다 상태가 앞으로 나아가는 스트림**이어야 한다. 스테이지 시드로 매번 새로
 * 만들면 같은 판을 다시 깰 때 보너스가 똑같이 나와, 대박 나오는 판만 반복하는 구멍이 생긴다.
 *
 * `trainMul` — 갈림길 '바람골'(game/forks.ts)을 골랐을 때만 1보다 크다. 기준선·위업·변동
 * 보상을 전부 합친 뒤에 곱한다 — 어려움을 감수한 판이 훈련치 전체에서 값을 봐야 하고,
 * 일부 항목만 곱하면 "정확히 왜 더 받았는지" 체감이 흐려진다.
 */
export function gradeRun(rng: Rng, stage: StageDef, r: RunStats, trainMul = 1): Reward {
  const stars = starsOf(stage, r)
  const score = r.score > 0 ? r.score : 0

  // ── 예측 가능한 바닥 ──
  // 실패해도 0을 주지 않는다. "손해 본 판"이 있으면 아무 때나 못 끊는다 (C2).
  let base = r.cleared ? P.progression.trainClear : P.progression.trainFail
  const ratio = stage.targetScore > 0 ? score / stage.targetScore : 0
  base += SCORE_TRAIN * (ratio < SCORE_RATIO_CAP ? ratio : SCORE_RATIO_CAP)
  base += STAR_TRAIN * stars

  // ── 위업 ──
  // 판이 끝날 때 한 번만 도는 경로라 배열을 만들어도 A5에 걸리지 않는다.
  const feats: string[] = []
  let extra = 0

  if (r.bullseyes >= BULLSEYE_MANY_AT) {
    feats.push(`정중앙 ${r.bullseyes}`)
    extra += FEAT_BULLSEYE_MANY
  } else if (r.bullseyes > 0) {
    feats.push('정중앙')
    extra += FEAT_BULLSEYE
  }

  if (r.bestChain >= CHAIN_BIG_AT) {
    feats.push(`대콤보 ${r.bestChain}`)
    extra += FEAT_CHAIN_BIG
  } else if (r.bestChain >= CHAIN_FEAT_AT) {
    feats.push(`${r.bestChain}콤보`)
    extra += FEAT_CHAIN
  }

  // 한 발이 여럿을 쓰러뜨렸다 — 관통·분열·연쇄의 쾌감을 이름으로 붙잡아둔다.
  if (r.hits > r.shots) {
    feats.push('한 발에 여럿')
    extra += FEAT_MULTI
  }

  if (r.cleared && flawless(r)) {
    feats.push('무손실')
    extra += FEAT_FLAWLESS
  }

  if (r.cleared && r.arrowsGiven - r.arrowsUsed >= SPARE_AT) {
    feats.push('여벌을 남겼다')
    extra += FEAT_SPARE
  }

  // 현상금은 클리어와 무관하다 — 머리를 맞힌 그 순간 번 것이다. 죽어도 가져간다.
  if (r.bounties > 0) {
    feats.push(r.bounties > 1 ? `현상금 ×${r.bounties}` : '현상금')
    extra += FEAT_BOUNTY * r.bounties
  }

  // ── 변동 보상 ──
  // 클리어한 판에서만 굴린다. 실패에도 대박이 나오면 "빨리 지고 다시 켜기"가 최적해가 된다.
  const subtotal = base + extra
  let bonus = 0
  if (r.cleared) {
    const roll = rng.next()
    if (roll < BONUS_BIG_P) {
      bonus = Math.round(subtotal * BONUS_BIG_MUL)
      feats.push(FEAT_BONUS_BIG)
    } else if (roll < BONUS_BIG_P + BONUS_SMALL_P) {
      bonus = Math.round(subtotal * BONUS_SMALL_MUL)
      feats.push(FEAT_BONUS_SMALL)
    }
  }

  if (r.cleared && trainMul > 1) feats.push(FEAT_FORK_WIND)

  // 바닥은 1이다. 0이 뜨는 판이 있으면 그 판은 "안 한 것보다 못한 판"이 된다 (C2).
  const total = Math.floor((subtotal + bonus) * (r.cleared ? trainMul : 1))
  return { training: total > 1 ? total : 1, stars, feats, bonus }
}

/**
 * 한 줄로 읽는 결과. 판이 끝나면 토스트로 이걸 흘린다 — 결과 화면에 가두지 않는다 (C1).
 * 별은 채운 만큼 ★, 나머지는 ☆.
 */
export function rewardLine(r: Reward): string {
  let s = ''
  for (let i = 0; i < STAR_MAX; i++) s += i < r.stars ? '★' : '☆'
  let line = `${s} 훈련치 +${r.training}`
  if (r.feats.length > 0) line += ` · ${r.feats.join(' · ')}`
  return line
}
