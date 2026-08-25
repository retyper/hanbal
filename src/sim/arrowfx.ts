/**
 * 화살 종류가 sim에게 요구하는 것 (docs/HOOK.md ★1)
 *
 * 왜 game/arrows.ts가 아니라 여기인가: 효과를 실제로 적용하는 건 ballistics·target이고,
 * 레이어 방향은 core ← sim ← game 이다 (ARCHITECTURE A1). sim이 game을 import하면 화살표가
 * 뒤집힌다. 그래서 **숫자와 계약은 sim의 것**이고, game/arrows.ts는 이름·설명·아이콘 같은
 * 화면용 메타데이터만 들고 여기를 re-export한다.
 *
 * 값의 단일 출처는 tune/params.ts의 `arrowkind` 그룹이다 (A2). 이 파일은 그걸 종류별로
 * 재배치할 뿐이고, 스스로 숫자를 갖지 않는다.
 *
 * ★ 설계 규칙: **종류마다 다른 필드가 아니라 전 종류가 같은 판을 쓴다.**
 * sim이 `if (kind === 'burst')` 분기를 늘리지 않고 `fx.burstRadius > 0` 만 보면 되게.
 * 분기가 늘면 관통+무거움처럼 효과가 겹치는 종류에서 반드시 한쪽이 빠진다.
 * 모든 값은 "효과 없음"이 0(배수는 1)이라, 기본 살은 sim의 어느 분기도 타지 않는다.
 */
import { P } from '../tune/params.ts'
import type { ArrowKindId } from './types.ts'

export interface ArrowFx {
  /** 원래라면 화살이 멈췄을 과녁을 **몇 개 더** 뚫는가. 0이면 첫 명중에서 멈춘다. */
  pierceExtra: number
  /** 한 번 뚫을 때 잃는 속도 비율. `keep = 1 - 명중도 × pierceLoss`. */
  pierceLoss: number
  /** 명중 지점에서 이 반경(m) 안의 과녁을 같이 친다. 0이면 폭발하지 않는다. */
  burstRadius: number
  /** 명중 후 갈라지는 자식 화살 수. 0이면 갈라지지 않는다. */
  splitCount: number
  /** 자식이 진행 방향에서 벌어지는 각 (rad). ±로 대칭 배분한다. */
  splitAngle: number
  /** 자식이 물려받는 속도 비율. */
  splitSpeedKeep: number
  /**
   * 질량 (유엽전 = 1). 피해가 **운동에너지**(m·v²)라 target.ts가 이걸 직접 쓴다.
   * 예전의 dmgMul을 대신한다 — 손으로 박은 배수가 아니라 이 살이 실제로 무거운 정도다.
   */
  mass: number
  /**
   * 관통력 = **단면밀도 × 초속** = (m/A)·v. 갑옷과 다중 관통이 둘 다 이걸 탄다.
   * 착탄 속도가 아니라 **초속** 기준이다 — 이 값은 살의 신원이지 그때그때의 상태가 아니다.
   * 거리에 따른 감소는 target.ts가 착탄 속도비를 곱해 반영한다.
   */
  pen: number
  /** 초당 최대 선회각 (rad/s). 0이면 유도하지 않는다. */
  homingTurn: number
  /** 이 거리(m) 안의 과녁만 빨아들인다. */
  homingRange: number
  /** 발사 후 이만큼(s) 지나야 유도가 시작된다. 즉시 걸리면 조준이 장식이 된다. */
  homingDelay: number
  /** 진행 방향 기준 이 각(rad) 안의 과녁만 노린다. 뒤로 돌아가지 않게 하는 빗장. */
  homingCone: number
  /** 명중 후 다음 과녁으로 튀는 최대 횟수. 0이면 튀지 않는다. */
  chainBounces: number
  /** 튈 수 있는 최대 거리 (m). */
  chainRange: number
  /** 튈 때 물려받는 속도 비율. */
  chainSpeedKeep: number
  /** 발사 초속 배수. */
  speedMul: number
  /** 공기저항 배수. 무거운 살은 같은 항력에 덜 밀린다 — 바람 판에서 이게 성격이 된다. */
  dragMul: number
  /** 이 화살이 만든 점수 전부에 곱해진다 (폭발·연쇄로 딸려 죽은 과녁 포함). */
  scoreMul: number
  /**
   * 갑옷을 뚫는가 — 0이면 몸통이 안 통하고(막힌 소리만), >0이면 그 배수로 피해가 들어간다.
   * **이제 손으로 안 정한다.** `pen`이 문턱(P.arrowkind.armorPen)을 넘으면 자동으로 켜진다.
   *
   * ★ 형의 반려 (2026-08-25): *"육량전을 써도 갑옷은 왜 못 뚫는지 이해할 수가 없네."*
   *   옳다. 육량전(六兩箭)은 여섯 냥짜리 **전쟁용 무거운 살**이다. 그게 판금을 못 뚫으면
   *   그 살은 존재할 이유가 없다. 그리고 실제로 교차표에서 육량전은 죽은 카드였다
   *   (62판 중 점수 1등 5판, 애기살은 1판 — docs/MEGAHIT.md 렌즈 ①).
   *
   *   **살마다 '자기만 여는 자물쇠'가 하나씩 있어야 한다.** 갑옷은 육량전의 자물쇠다.
   *   헤드샷은 여전히 더 좋다(즉사) — 육량전은 '머리를 못 맞혀도 답이 있다'는 두 번째 길이다.
   */
  armorPierce: number
}

/**
 * ★ 살의 물리 — **질량과 단면적, 딱 둘만 저작한다.** 나머지는 전부 여기서 파생된다.
 *
 * 형의 물음 (2026-08-25): *"데미지는 화살 속도랑 화살 무게에 따라도 달라지지 않을까 싶음.
 * 관통력도 그렇고. 이걸 어떻게 해야 현실성도 살리면서 적절히 게임적 허용으로 재밌게 만들지."*
 *
 * 그 물음이 정답이었다. 예전 구조는 살마다 speedMul·dragMul·dmgMul·pierceExtra를
 * **손으로 따로** 박았고, 그래서 애기살과 육량전이 우연히 pierceExtra 2로 같은 자리에 앉았다.
 * 육량전에는 피해 2배까지 붙어 있으니 애기살은 제 축에서 완전히 지배당했다 —
 * 실측 교차표에서 **62판 중 점수 1등 0판**, 죽은 카드였다.
 *
 * 이제 저작하는 건 둘뿐이다.
 *   mass    질량 (유엽전 = 1)
 *   caliber 단면적 (유엽전 = 1)
 *
 * 그리고 나머지는 실물의 식을 그대로 탄다.
 *
 *   초속    v = 1/√(m+Mv)   활은 제 림과 시위도 같이 밀어야 한다 — 그 몫이 가상질량 Mv다.
 *   공기저항 ∝ A/m           감속 = ½ρv²Cd·A/m. 무겁고 가늘수록 덜 밀린다.
 *   피해    ∝ m·v²          착탄 시점의 **운동에너지**. 멀수록 준다 (v가 준다).
 *
 * ★ 가상질량(Mv)이 왜 꼭 필요한가 — 처음엔 v = 1/√m 으로 짰다가 실측에서 걸렸다.
 *   그러면 총구 운동에너지가 m·v² = m·(1/m) = **모든 살에서 똑같아진다.**
 *   실제로 재보니 유엽전 64, 애기살 65 — 무게가 피해에 아무 영향이 없었다.
 *   실물의 활은 화살만 미는 게 아니라 **제 림과 시위도 같이 민다.** 그 몫(가상질량)이
 *   고정이라, 무거운 살일수록 활의 에너지를 **더 많이 가져간다** (효율 = m/(m+Mv)).
 *   이건 양궁에서 널리 알려진 사실이고, 동시에 이 게임이 원하는 답이기도 하다:
 *     무거운 살 = 에너지가 크다 (아프고 잘 뚫는다) · 가벼운 살 = 빠르다 (곧게 멀리 간다)
 *   물리를 제대로 쓰니 게임이 원하던 트레이드오프가 **저절로** 나왔다.
 *   관통력  ∝ (m/A)·v        **단면밀도 × 속도**. 갑옷과 다중 관통이 둘 다 이걸 탄다.
 *
 * 이 식들이 왜 좋은가: 세 살이 **하나의 축(질량)** 위 서로 다른 점이 되고,
 * 각자 여는 자물쇠가 자동으로 갈린다. 우연히 같은 자리에 앉는 일이 구조적으로 불가능하다.
 *   애기살(0.55) — 빠르고 곧다 · 단면밀도가 높아 갑옷을 뚫는다 · 피해는 작다
 *   유엽전(1.00) — 기준
 *   육량전(2.40) — 느리고 처진다 · 운동에너지가 커서 아프다 · 굵어도 질량으로 갑옷을 뚫는다
 *
 * ── 게임적 허용 — 일부러 실물과 다르게 한 곳 (형의 물음의 후반부) ──
 *   ① **갑옷은 문턱이지 곡선이 아니다.** 실제 관통은 연속이지만, 플레이어는
 *      "이건 뚫린다/안 뚫린다"를 **알 수 있어야** 한다. 읽히는 규칙이 정확한 곡선보다 낫다.
 *   ② **초속에 상·하한을 건다.** 1/√m 을 그대로 두면 아주 가벼운 살의 탄도가 직선이 되어
 *      조준을 배울 것이 없어진다. 이 게임의 학습 대상이 탄도라서 그걸 지운다.
 *   ③ **효과살(화전·세전·명적·신전)은 질량 1 근처로 묶는다.** 그것들의 정체성은 물리가 아니라
 *      효과다. 물리로 또 갈라놓으면 읽어야 할 축이 둘이 되어 3택이 시험문제가 된다.
 *   ④ **피해에 하한 1.** 0 피해는 "맞았는데 아무 일도 안 일어남"이라 버그로 읽힌다.
 *
 * 왜 params가 아니라 여기 사는가: 이건 손맛 노브가 아니라 **그 살이 무엇인가**다
 * (stickman.ts의 BOW_SKIN과 같은 급). 식의 계수는 params.ts의 arrowkind에 있다 (A2).
 */
interface Body {
  mass: number
  caliber: number
}

const BODY: Readonly<Record<ArrowKindId, Body>> = {
  /** 유엽전 — 기준. 모든 값이 1이다. */
  basic: { mass: 1, caliber: 1 },
  /** 애기살(편전) — 반 길이에 가늘다. 통아가 아니면 아예 못 쏘는 물건이다. */
  pierce: { mass: 0.55, caliber: 0.5 },
  /** 화전 — 심지와 기름을 달아 조금 무겁고 굵다. */
  burst: { mass: 1.15, caliber: 1.25 },
  /** 세전 — 셋으로 갈라지는 만큼 하나하나는 가볍다. */
  split: { mass: 0.85, caliber: 0.95 },
  /** 신전 — 기준과 같다. 이 살의 정체성은 무게가 아니라 유도다. */
  homing: { mass: 1, caliber: 1 },
  /** 명적 — 우는살. 소리통이 달려 굵다. */
  chain: { mass: 1.1, caliber: 1.35 },
  /** 육량전 — 여섯 냥. 이 게임에서 가장 무겁고 가장 굵다. */
  heavy: { mass: 2.4, caliber: 1.35 },
}

function neutral(): ArrowFx {
  return {
    armorPierce: 0,
    pierceExtra: 0,
    pierceLoss: 0,
    burstRadius: 0,
    splitCount: 0,
    splitAngle: 0,
    splitSpeedKeep: 0,
    homingTurn: 0,
    homingRange: 0,
    homingDelay: 0,
    homingCone: 0,
    chainBounces: 0,
    chainRange: 0,
    chainSpeedKeep: 0,
    speedMul: 1,
    dragMul: 1,
    mass: 1,
    pen: 1,
    scoreMul: 1,
  }
}

/**
 * 종류별 효과판. **모듈 로드 때 한 번 만들고 그 뒤로는 제자리에서 갱신만 한다** —
 * 핫 루프가 매 스텝 읽는 객체라 새로 만들면 프레임당 할당 0이 깨진다 (A5).
 */
const TABLE: Record<ArrowKindId, ArrowFx> = {
  basic: neutral(),
  pierce: neutral(),
  burst: neutral(),
  split: neutral(),
  homing: neutral(),
  chain: neutral(),
  heavy: neutral(),
}

function reset(fx: ArrowFx): void {
  fx.armorPierce = 0
  fx.pierceExtra = 0
  fx.pierceLoss = 0
  fx.burstRadius = 0
  fx.splitCount = 0
  fx.splitAngle = 0
  fx.splitSpeedKeep = 0
  fx.homingTurn = 0
  fx.homingRange = 0
  fx.homingDelay = 0
  fx.homingCone = 0
  fx.chainBounces = 0
  fx.chainRange = 0
  fx.chainSpeedKeep = 0
  fx.speedMul = 1
  fx.dragMul = 1
  fx.mass = 1
  fx.pen = 1
  fx.scoreMul = 1
}

/**
 * P의 현재 값으로 효과판을 다시 굽는다. **판이 시작될 때(resetWorld) 한 번만 부른다** —
 * 그래야 라이브 튜닝 콘솔로 노브를 움직인 게 다음 판부터 먹고(A2), 판 도중에 물리가
 * 바뀌어 리플레이가 갈라지는 일은 없다 (A1).
 */
/**
 * 몸(질량·단면적) → 물리 전부. 살마다 손으로 박던 네 값이 여기 한 곳에서 나온다.
 * 어느 살에나 똑같이 걸리므로, 새 살을 만들 때 물리를 잊어버릴 수가 없다.
 */
function bakeBody(fx: ArrowFx, id: ArrowKindId): void {
  const a = P.arrowkind
  const b = BODY[id]
  const m = b.mass
  const A = b.caliber

  fx.mass = m
  // 초속 v ∝ 1/√(m + Mv). 유엽전(m=1)이 1이 되도록 정규화한다.
  // Mv(가상질량)가 있어야 무거운 살이 에너지를 더 가져간다 — 위 주석의 실측 근거.
  const mv = a.virtualMass
  const v = Math.sqrt((1 + mv) / ((m > 0.01 ? m : 0.01) + mv))
  fx.speedMul = v < a.speedLo ? a.speedLo : v > a.speedHi ? a.speedHi : v
  // 공기저항 ∝ A/m. 무겁고 가늘수록 덜 밀린다.
  fx.dragMul = A / m
  // 관통력 = 단면밀도 × 초속.
  fx.pen = (m / A) * fx.speedMul
  // 다중 관통 — 관통력과 운동량이 **둘 다** 기여한다. 애기살은 단면밀도로, 육량전은
  // 운동량으로 뚫는다. 이유가 달라도 결과가 같아야 두 카드가 나란히 산다.
  const mom = m * fx.speedMul
  const extra = (fx.pen - 1) * a.penPerPierce + (mom > 1 ? mom - 1 : 0) * a.momPerPierce
  fx.pierceExtra = extra > 0 ? Math.round(extra) : 0
  // 뚫고 나갈 때 잃는 속도 — 운동량이 클수록 덜 잃는다. 무거운 살이 계속 나아가는 이유다.
  const loss = a.pierceLossBase / (mom > 0.01 ? mom : 0.01)
  fx.pierceLoss = loss > 0.9 ? 0.9 : loss
  // 갑옷 — 문턱이다. 곡선이 아니라 문턱인 이유는 게임적 허용 ①.
  fx.armorPierce = fx.pen >= a.armorPen ? a.armorDmgMul : 0
}

export function refreshArrowFx(): void {
  const a = P.arrowkind

  reset(TABLE.basic)

  const pierce = TABLE.pierce
  reset(pierce)

  const burst = TABLE.burst
  reset(burst)
  burst.burstRadius = a.burstRadius

  const split = TABLE.split
  reset(split)
  split.splitCount = a.splitCount
  split.splitAngle = a.splitAngle
  split.splitSpeedKeep = a.splitSpeedKeep

  const homing = TABLE.homing
  reset(homing)
  homing.homingTurn = a.homingTurn
  homing.homingRange = a.homingRange
  homing.homingDelay = a.homingDelay
  homing.homingCone = a.homingCone

  const chain = TABLE.chain
  reset(chain)
  chain.chainBounces = a.chainBounces
  chain.chainRange = a.chainRange
  chain.chainSpeedKeep = a.chainSpeedKeep

  const heavy = TABLE.heavy
  reset(heavy)
  heavy.scoreMul = a.heavyScoreMul

  // ★ 물리는 **맨 마지막에, 전 종류에** 똑같이 건다 (bakeBody 위의 주석).
  //   위에서 굽는 건 이제 '효과'뿐이다 — 폭발 반경, 갈라짐, 유도, 사슬.
  //   물리를 종류별로 손으로 박던 시절엔 애기살과 육량전이 우연히 같은 자리에 앉았다.
  for (const id in TABLE) bakeBody(TABLE[id as ArrowKindId], id as ArrowKindId)
}

refreshArrowFx()

/**
 * 이 화살이 sim에게 요구하는 것. **새 객체를 만들지 않는다** —
 * 핫 루프에서 매 스텝 불려도 된다 (A5). 모르는 id는 기본 살로 떨어진다.
 */
export function arrowFx(id: ArrowKindId): ArrowFx {
  return TABLE[id] ?? TABLE.basic
}
