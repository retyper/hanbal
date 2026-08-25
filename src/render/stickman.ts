/**
 * 스틱맨 궁수 (GDD 8장) — 벡터 라인, 관절 5개(어깨/팔꿈치/손목/골반/무릎).
 *
 * 이 파일의 책임은 세 가지다.
 *
 * 1. **떨림을 읽을 수 있게 그린다.** 조준 떨림은 실제로는 0.02 rad 미만이라 화면에서 1px도
 *    안 움직인다. 회전 중심을 앵커(턱)에 두고 P.tremor.minVisiblePx로 표시 배율을 역산해
 *    화면 진폭이 카메라 배율과 무관하게 일정해지도록 한다. 위상은 그대로 보존된다.
 *    화면 진폭 = minVisiblePx × strain^growExp × (STEADY·호흡정지 배수).
 *    **안전 구간(strain=0)에서는 정확히 0이다.** sim이 tremorOffset을 0으로 주므로 곱해도 0 —
 *    "빨간 바 위에서는 조준한 그 자리에 맞는다"는 약속이 화면에서도 흔들림 0으로 보여야 한다.
 * 2. **안전 구간과 위험 구간을 자세로 나눈다.** 세 신호가 서로 잡아먹지 않도록 문법을 갈랐다:
 *      굵기 = 당김·성장(brace/trueFull) · 형태 = 경계선 넘김(strain) · 색 = 붕괴 임박(warn)
 *    strain은 "잠금이 풀린다"(팔꿈치·고개·활 휨이 조금씩 헐거워진다),
 *    warn은 "주저앉는다"(척추·골반·무릎이 무너지고 앞팔이 처지고 색이 물든다).
 *    두 단계가 다른 관절을 쓰기 때문에 "떨리기 시작함"과 "곧 놓쳐버림"이 겹쳐 보이지 않는다.
 * 3. **사법(射法)대로 그린다** — docs/FORM.md. 척추는 수직, 다리는 곧게, 시위손은 턱에 붙고,
 *    활손→노크→팔꿈치가 한 직선이며 팔꿈치는 화살선보다 위에 있다.
 *    sim이 주는 궁수 좌표는 **어깨가 아니라 앵커(턱)** 다 — 화살이 출발하는 점이기도 하다.
 * 4. **만작 한계를 자세로 말한다.** 만작은 1.0이 아니라 이 궁수의 한계(DerivedStats.maxDraw)다.
 *    STR 0이면 0.72에서 팔이 멈춘다. 그래서 자세의 '조여짐'을 draw에 직접 물려,
 *    시위가 안 당겨지는 초보는 영영 어정쩡한 자세에서 멈추고, 진짜 만작(1.0)에 닿은 궁수만
 *    등이 펴진 완성된 실루엣이 된다. effectiveStats()를 부르지 않는 이유는 그게 객체를
 *    만들기 때문이다(A5) — a.draw 하나로 같은 정보가 이미 화면에 있다.
 *
 * 굵기는 전부 cam.scale에 비례한다. 절대 픽셀 상수로 박지 않는다 — 줌이 바뀌어도 비율이 유지된다.
 *
 * ARCHITECTURE A1: World는 읽기만 한다.
 */
import { clamp, clamp01, lerp, smoothstep, TAU } from '../core/math.ts'
import { P } from '../tune/params.ts'
import { effectiveStats } from '../sim/bow.ts'
import type { World } from '../sim/types.ts'
import { THEME, worldToScreenX, worldToScreenY } from './camera.ts'
import type { Camera } from './camera.ts'

/** 체격 (m). 화면 픽셀이 아니라 월드 치수라 카메라 줌을 그대로 따라간다. */
const BODY = {
  armBend: 0.05,
  torso: 0.5,
  neck: 0.1,
  head: 0.135,
  stance: 0.26,
  kneeOut: 0.09,
  legMin: 0.35,
  legMax: 1.1,
  /** 앵커(턱) → 활 그립까지, 화살선을 따른 거리. 만작 화살의 길이이기도 하다. */
  span: 0.62,
  /** 앵커에서 어깨까지 내려오는 거리. 턱 밑 앵커와 어깨의 실제 간격. */
  jawDrop: 0.16,
  /** 어깨가 앵커보다 뒤에 있는 거리. 턱이 앞어깨 위에 오는 사법 자세. */
  shoulderBack: 0.05,
  /** 활 그립이 화살선 아래에 있는 거리. 화살은 그립 위 받침을 지난다. */
  gripDrop: 0.11,
  /** 시위팔 팔꿈치가 앵커 뒤로 가는 거리. 활손→앵커→팔꿈치가 한 직선이 된다. */
  elbowBack: 0.30,
  /** 팔꿈치가 화살선보다 위에 있는 거리. 처지면 '닭날개'가 된다 (docs/FORM.md 2-5). */
  elbowRise: 0.035,
  bowHalf: 0.46,
  bowDrawCurve: 0.5,
  arrowLen: 0.72,
  arrowHead: 0.13,
} as const

/**
 * 선 굵기. 두께는 월드 치수(m) × cam.scale 이라 줌과 함께 자란다.
 * min/max만 픽셀인데, 이건 손맛이 아니라 "이 이하로는 안 보인다"는 화면의 물리적 하한이다.
 *
 * 굵기 위계: 몸통 > 팔다리 > 활 > 화살 > 시위.
 * 활이 몸보다 얇아야 활로 읽히고, 화살은 얇지만 밝아서 눈에 먼저 들어온다 (GDD 8장).
 *
 * 골격 비율은 캐릭터의 신원이라 여기 남는다. **성장이 화면에 드러나는 폭**만
 * P.render 로 올라갔다 (lineBody / lineFullGain / lineTrueFullGain).
 */
/** 체력 바 여운 — hud.ts의 게이지와 같은 계약 (형: 당길 때만 + 2초 뒤 fadeout). */
const HP_LINGER = 2
const HP_FADE = 0.4
let hpSeen = -1e9
let hpLast = -1

const LINE = {
  /**
   * 3 -> 3.6: 실측하니 챕터 1의 뒷판(1-7~1-10)은 720p에서 cam.scale이 26~28이라
   * 굵기가 전부 이 하한에 걸린다. 즉 **이 값이 그 판들의 실제 굵기**다 —
   * 0.105m라는 비율은 거기서 아무 일도 하지 않는다. 3px은 키 50px짜리 실루엣에서 너무 얇았다.
   * 3.6이면 몸통 4.86 / 진짜 만작 5.3px이 되어 배경(#0b0e13)에서 떨어져 나온다.
   */
  minPx: 3.6,
  /**
   * 하한들이 기준으로 삼는 배율. 챕터 1 뒷판 실측(720p에서 26~28)이다. 이보다
   * 멀어지면(곡사 챕터: 8~13) 하한도 **배율에 비례해 같이 줄인다** — 안 줄이면
   * 3.6px 몸통에 4.3px 머리처럼 하한들만 남아 대두 눈사람이 된다 (형의 반려).
   */
  refScale: 26,
  maxPx: 12,
  torsoMul: 1.35,
  limbMul: 1,
  /** 뒤쪽 팔다리는 살짝 얇게 — 원근 */
  backMul: 0.82,
  bowMul: 0.66,
  stringMul: 0.3,
  arrowMul: 0.4,
  /** 시위·화살이 사라지지 않을 픽셀 하한 */
  thinMinPx: 1.2,
  /** 머리 반지름의 하한 (선 굵기 배수). 큰 배율에서는 0.135m가 이보다 크므로 아무 일도 안 한다. */
  headMinMul: 1.2,
} as const

/**
 * 자세. 전부 월드 치수(m)거나 비율이다. 자세의 골격은 여기,
 * **성장이 자세로 드러나는 문턱**(braceFrom / trueFullAt / fullBowCurve / onsetFlash)은 P.render.
 */
const POSE = {
  /** 붕괴 경고에서 등이 더 굽는 양 (m) */
  warnSpine: 0.2,
  /** 진짜 만작에서 등이 펴지고 가슴이 열리는 양 (m) */
  fullArch: 0.07,
  /** 붕괴 임박에서만 골반이 뒤로 빠진다 (m). 그 외에는 어깨 바로 아래다 (FORM.md 2-2). */
  warnHip: 0.1,
  /** 등이 굽으면 척추의 세로 길이가 줄어든다 → 골반이 올라오고 무릎이 더 굽는다 */
  warnCompress: 0.16,
  /** 붕괴 임박에서 활팔 팔꿈치가 굽으며 처진다 */
  warnArm: 2,
  /** 당김이 얕으면 시위팔 팔꿈치가 덜 올라온다 (배수). 초보의 처진 팔꿈치. */
  slouchElbow: 0.18,
  /**
   * 진짜 만작에서 시위팔 팔꿈치가 더 깊이 접힌다 (배수).
   * 실측(scale 28.2): 어깨 뒤 3.6→7.9px · 조준선 아래 2.5→6.5px. 팔이 완전히 접힌 모양이다.
   */
  fullElbow: 1.35,
  /** 무릎이 굽는 양 (배수). 다리는 원래 곧고, 무너질 때만 굽는다 (FORM.md 2-1). */
  slouchKnee: 0.9,
  warnKnee: 1.4,
  /** 고개 기울기 (rad) — 조여질수록 활 쪽으로 붙고, 무너지면 앞으로 떨어진다 */
  braceHeadTilt: 0.22,
  warnHeadDrop: 0.5,
  /** 앞팔 처짐 각 (rad) — 붕괴 경고 */
  warnDroop: 0.11,

  // ── 경계선을 넘은 뒤(strain): "잠금이 풀린다" ────────────────────────
  //
  // 값은 전부 P.render.poseStrain* 로 올라갔다 (A2). 여기 남는 건 왜 그렇게 갈랐는가다.
  //
  // warn과 **다른 관절**을 쓴다. warn이 척추·골반·무릎으로 주저앉는 동안,
  // strain은 조준을 붙들고 있던 잠금(앞팔 팔꿈치·시위팔 팔꿈치·고개 정렬·활 휨)만 헐겁게 한다.
  // 관절이 겹치면 "떨리기 시작함"과 "곧 놓쳐버림"이 한 덩어리로 보여 두 단계가 사라진다.
  // 크기도 warn의 1/3 이하로 둔다 — 이건 붕괴가 아니라 흔들리기 시작한 것뿐이다.
  // (실측 strain 1 → 앞팔굽음 +0.6px·활휨 -3.4px·척추 -1.4px, warn 1 → +3.2/-5.7/골반 +2.8px.
  //  '풀림'과 '무너짐'이 대략 1:3이라 같은 화면에서 두 단계로 읽힌다.)
} as const

/** 어깨(회전 중심)에서 활 끝까지의 반지름. 떨림 지렛대의 실제 길이다. */
const TREMOR_LEVER = Math.hypot(BODY.span, BODY.bowHalf)

/**
 * 표시용 떨림 상한 (rad, 약 26°). 이보다 크게 흔들면 팔이 만화처럼 돌아간다.
 *
 * 0.26 -> 0.45: minVisiblePx의 뜻이 "최소 가시"에서 "최대"(9px)로 뒤집히면서 필요한 각이 커졌다.
 * 챕터 1에서 가장 넓게 잡히는 구도(cam.scale≈26)에서 9px을 내려면 0.45 rad이 필요하다.
 * 0.26으로 두면 그 배율에서 파형의 봉우리가 통째로 눌려 사각파처럼 꺾이고,
 * 영점을 지나는 순간이 '스르륵'이 아니라 '툭'이 되어 위상 읽기가 무너진다.
 *
 * 이 상한이 실제로 일하는 곳은 더 멀리 잡히는 구도(scale 8~15)다 — 거기선 9px에 1.4 rad이
 * 필요해 팔이 풍차가 된다. 상한이 각(rad)인 이유가 그것이다: 화면 px이 아니라 **관절의 한계**다.
 */
const VIS_TREMOR_MAX = 0.45

/** 색을 고르는 이산 문턱. 램프에서 어느 색을 집을지의 판정일 뿐 손맛 노브가 아니다. */
const ON = { warn: 0.02, flash: 0.5, trueFull: 0.5 } as const

/** 경고색 램프. 매 프레임 색 문자열을 만들면 힙 할당이 생긴다 (A5). 미리 만들어 인덱싱한다. */
/**
 * 활 휨의 기하 상수 — 실루엣의 문법이지 손맛 노브가 아니다.
 *
 * ★ 제1원칙 (형의 반려: "손이 활을 안 잡고 붕 떠 있는데다, 당기면 활 잡은 위치가 오히려
 *   손보다 앞으로 나가버려"): **활의 그립은 활손 그 점이다. 당김이 그 자리를 옮기지 않는다.**
 *   당김이 바꾸는 것은 오직 **림 끝이 사수 쪽으로 젖혀지는 깊이**뿐이다 — 실물이 그렇다.
 *   예전엔 호의 정점을 손보다 +u(과녁 쪽)로 밀었고 그 양이 당김에 비례해 커졌다(0.5→1.6배).
 *   그래서 당길수록 활이 손에서 앞으로 도망갔다. 이제 정점 오프셋은 존재하지 않는다.
 *
 * brace    = 시위만 매어도 팁이 그립보다 뒤로 물러 있는 거리 (half 대비). 브레이스 높이.
 * backGain = 당김에 따라 더 젖혀지는 양 (half 대비)
 * squeeze  = 젖혀질수록 팁 사이가 오므라드는 비율
 * ctrlV·ctrlBack = 그립→팁 곡선의 제어점. ctrlBack이 작을수록 그립 근처가 뻣뻣하다(라이저).
 * riser    = 손잡이. 그립에서 위아래로 뻗는 곧은 구간 (half 대비) — 손이 **쥘 것**이 있어야 한다.
 * fist     = 주먹 반지름 (선 굵기 배수). 활손이 활대를, 시위손이 줄을 쥐었음을 점으로 못박는다.
 */
const BOWPOSE = {
  brace: 0.22,
  backGain: 0.4,
  squeeze: 0.16,
  ctrlV: 0.55,
  ctrlBack: 0.14,
  riser: 0.2,
  fist: 0.85,
} as const

/**
 * 릴리즈 팔로스루 — 순수하게 시간의 함수다 (release 시점만 기억한다. 적분 없음 = 프레임률 무관).
 * kick = 반동으로 손이 뒤로 벌어지는 거리(m) · kickT = 반동 한 사이클(s) ·
 * settleT = 손이 제자리로 내려오는 시간(s) · vib = 시위 잔떨림 진폭(m)·주파수(Hz)·감쇠(s).
 */
const FOLLOW = {
  kick: 0.07,
  kickT: 0.16,
  settleT: 0.5,
  restFwd: 0.1,
  restDrop: 0.16,
  vib: 0.028,
  vibHz: 16,
  vibDecay: 0.22,
} as const

/** 렌더 전용 상태 — sim을 건드리지 않는다. 직전 프레임의 단계와 릴리즈 순간의 손 자리. */
const relAnim = {
  prevPhase: 'idle' as string,
  /** 릴리즈 순간 (w.elapsed 기준). 음수면 아직 없음. */
  at: -1,
  hx: 0,
  hy: 0,
}

const BOW_RAMP = ['#d9cba6', '#e0bd8d', '#e8a874', '#ef8f5d', '#f57a4f', '#ff6a45'] as const

/**
 * 활별 겉모습 (docs/BOWS.md). 물리와 무관한 렌더 전용 표 —
 * half=림 길이 배수 · curve=휨 배수 · siyah=각궁 고자(팁 길이, half 비율) ·
 * stab=리커브 안정기 길이(m) · cam=컴파운드 도르래 표시.
 */
interface BowSkin {
  /** 림 길이 배수 */
  half: number
  /** 휨의 깊이 배수 — 당길수록 이만큼 휜다 */
  bend: number
  color: string
  /** 고자(안 휘는 활끝) 길이 (half 비율). 0이면 없음 */
  siyah: number
  /** 고자가 과녁 쪽으로 꺾인 정도 (0=림 방향 그대로, 1=완전히 과녁 방향) */
  siyahFwd: number
  /** 리커브 안정기 길이 (m) */
  stab: number
  /** 컴파운드 캠 표시 */
  cam: number
}
const BOW_SKIN: Record<string, BowSkin> = {
  practice: { half: 1, bend: 0.9, color: '#d9cba6', siyah: 0, siyahFwd: 0, stab: 0, cam: 0 },
  // 각궁 — 물소뿔 복합궁. 짧은 림이 깊게 휘고, 고자는 뻣뻣해 과녁 쪽으로 꺾인 채 남는다.
  gakgung: { half: 0.8, bend: 1.5, color: '#c89a5f', siyah: 0.3, siyahFwd: 0.8, stab: 0, cam: 0 },
  // 잉글리시 롱보우 — 사람 키만 한 한 조각 나무. 길고 완만하게만 휜다.
  longbow: { half: 1.22, bend: 0.55, color: '#b9a27a', siyah: 0, siyahFwd: 0, stab: 0, cam: 0 },
  // 현대 양궁 — 금속 라이저 + 끝만 살짝 뒤집힌 림 + 안정기.
  recurve: { half: 1.05, bend: 1.0, color: '#9fb6c8', siyah: 0.2, siyahFwd: 0.55, stab: 0.5, cam: 0 },
  // 도르래활 — 뻣뻣한 짧은 림. 휨 대신 캠이 돈다.
  compound: { half: 0.86, bend: 0.3, color: '#8fa3b5', siyah: 0, siyahFwd: 0, stab: 0, cam: 1 },
}
const BODY_RAMP = ['#c9d2dc', '#ccc9cf', '#d0bfbd', '#d5b3aa', '#dba798', '#e29a86'] as const

/** 관절 좌표 캐시 (월드 m). 프레임마다 새 객체를 만들지 않기 위한 단일 인스턴스. */
const rig = {
  /**
   * 앵커 = sim이 주는 궁수 좌표. **만작에서 시위 잡은 손이 오는 턱 밑 지점**이고,
   * 동시에 화살이 출발하는 점이다 (docs/FORM.md 2-5).
   * 예전엔 이 점을 어깨로 썼는데, 그러면 만작에서 시위손이 어깨 속으로 접혀 들어가
   * 활을 쏘는 그림이 아니라 웅크린 그림이 된다 — 사용자가 "어정쩡하다"고 한 자세가 이것이었다.
   */
  ax: 0, ay: 0,
  /** 어깨 = 두 팔의 회전축. 앵커에서 아래·뒤로 내린 점이다. 척추의 꼭대기이기도 하다. */
  sx: 0, sy: 0,
  ux: 1, uy: 0,
  vx: 0, vy: 1,
  /**
   * 시위 잡는 손의 그림 좌표. 당기는 동안은 노크와 같지만, **놓은 뒤에는 다르다** —
   * 시위만 튕겨 돌아가고 손은 앵커 곁에 남아 반동으로 살짝 벌어졌다 돌아온다 (형의 지적:
   * "활줄만 튕겨 돌아오고 놓은 팔은 그대로 있어야 하는 거 아냐"). 실제 사법의 팔로스루다.
   */
  hdX: 0, hdY: 0,
  /** 궁수가 바라보는 쪽 (+1 오른쪽 / -1 왼쪽). 등·골반은 조준각이 아니라 이 방향의 반대다. */
  face: 1,
  /** 활손(왼손) = 활의 그립. **당김과 무관하게 이 점이 활대다.** */
  hx: 0, hy: 0,
  nockX: 0, nockY: 0,
  /** 활 반길이 (m) — 스킨 반영. */
  bowHalf: 0,
  /** 시위가 걸린 두 팁이 그립보다 뒤로 물러난 거리 (m). 당길수록 깊어진다. */
  bowBack: 0,
  /** 활이 휜 정도 0..1 (당김 × 성장·strain 보정). */
  bowFlex: 0,
  warn: 0,
  full: 0,
  draw: 0,
  /** 자세가 조여진 정도 0..1. 1 = 진짜 만작의 완성된 자세 */
  brace: 0,
  trueFull: 0,
  /** 잠금이 풀린 정도 0..1. archer.strain을 자세용 곡선에 태운 값 (0 = 안전 구간) */
  unlock: 0,
  /** 만작 진입 섬광 0..1 */
  flash: 0,
}

/**
 * 표시용 떨림 각. 실제 발사각(aimAngle + tremorOffset)은 건드리지 않는다 —
 * 여기서 키우는 건 "보이는 팔"뿐이고, 부호와 위상은 원본 그대로라
 * "흔들림이 중앙을 지날 때 놓기"라는 읽기가 성립한다 (GDD 2장).
 *
 * 역산의 기준은 **최대 진폭**이다. sim의 tremorOffset = baseAmp × strain^growExp × (배수) × wave 이고
 * |wave| ≤ 1 이 파형의 구조로 보장되므로(valueNoise는 [-1,1) 해시 두 개의 lerp),
 * baseAmp를 minVisiblePx로 환산해두면 화면 진폭이 그대로
 *   minVisiblePx × strain^growExp × (STEADY·호흡정지 배수)
 * 가 되고 스태미나 0에서 정확히 minVisiblePx에 닿는다. 노브 이름이 참이 된다.
 *
 * 파고율(RMS)로 나누던 예전 식은 쓰지 않는다. minVisiblePx가 "최소 가시 진폭"이던 시절엔
 * **평균적으로** 그만큼 움직여야 했지만, 지금은 "최대"라서 기준이 봉우리로 바뀌었다.
 * RMS로 정규화하면 봉우리가 2배로 튀어 노브가 다시 거짓말을 한다.
 *
 * warn 부스트도 없앴다. 떨림은 strain만의 채널이어야 두 단계가 구분된다 —
 * warn은 색과 무너지는 자세로 말한다. (경고 시점엔 strain이 이미 0.67 이상이라 충분히 크다.)
 */
function visualTremor(cam: Camera, offset: number): number {
  const rawPx = P.tremor.baseAmp * TREMOR_LEVER * cam.scale
  const gain = rawPx > 1e-6 ? P.tremor.minVisiblePx / rawPx : 1
  // tanh 소프트 클램프 — 단조증가라 위상(영점을 지나는 순간)이 보존된다.
  // 화면 진폭 구간에서는 거의 선형이고, 카메라가 크게 물러났을 때만 부드럽게 눕는다.
  return VIS_TREMOR_MAX * Math.tanh(offset * gain / VIS_TREMOR_MAX)
}

function computeRig(cam: Camera, w: World): void {
  const a = w.archer
  const warn = clamp01(a.warn)
  const d = clamp01(a.draw)
  // 어깨 = sim이 주는 궁수 좌표. 만작 시 노크(화살 꽁무니)가 여기 오므로 화살 생성점과 정확히 맞는다.
  // **어깨는 절대 옮기지 않는다.** 자세의 붕괴는 척추·골반·다리·고개로만 표현한다.
  rig.ax = a.x
  rig.ay = a.y
  rig.warn = warn
  rig.draw = d
  const atFull = a.phase === 'full'
  rig.full = atFull || a.phase === 'collapsing' ? 1 : 0

  // 당김이 곧 자세의 완성도다. maxDraw가 0.72에서 멈추는 초보는 자세도 거기서 멈춘다.
  const braceFrom = P.render.poseBraceFrom
  rig.brace = braceFrom < 1
    ? smoothstep((d - braceFrom) / (1 - braceFrom))
    : 0
  const trueFullAt = P.render.poseTrueFullAt
  rig.trueFull = trueFullAt < 1
    ? smoothstep((d - trueFullAt) / (1 - trueFullAt))
    : 0

  // 빨간 바 위(strain=0)에서는 정확히 0 — 자세도 완전히 잠겨 있어야 "지금 쏘면 맞는다"가 읽힌다.
  // 넘어간 뒤에만 자란다. brace(당김)를 깎지 않고 별도 채널로 두는 이유는,
  // 깎으면 오래 버틴 숙련자가 시위도 못 당기는 초보처럼 보여 만작 한계의 신호가 지워지기 때문이다.
  const strain = clamp01(a.strain)
  rig.unlock = strain > 0 ? Math.pow(strain, P.render.poseStrainOnset) : 0
  // 당기는 동안은 떨리지 않는다. 만작에 '닿는 순간'을 이 섬광이 표시한다.
  // collapsing은 제외한다 — 붕괴 직후에도 holdTime이 0이라, 그대로 두면 벌이 보상처럼 번쩍인다.
  rig.flash = atFull && a.holdTime < P.render.poseOnsetFlash
    ? 1 - a.holdTime / P.render.poseOnsetFlash
    : 0

  const dir = a.aimAngle + visualTremor(cam, a.tremorOffset) - warn * POSE.warnDroop
  const ux = Math.cos(dir)
  const uy = Math.sin(dir)
  rig.ux = ux
  rig.uy = uy
  rig.vx = -uy
  rig.vy = ux
  rig.face = ux >= 0 ? 1 : -1

  // 조준 프레임 기준 "위" = v. 활은 화살에 수직으로 서므로 몸의 상하도 이 축을 따른다.
  const vx = rig.vx
  const vy = rig.vy

  // 어깨는 앵커(턱)에서 아래·뒤로. 이 두 값이 사법의 T자를 만든다 (docs/FORM.md 1).
  rig.sx = a.x - vx * BODY.jawDrop - ux * BODY.shoulderBack
  rig.sy = a.y - vy * BODY.jawDrop - uy * BODY.shoulderBack

  // 활 그립은 화살선보다 조금 아래다 — 화살은 그립 위의 받침을 지나간다.
  // 그래서 활팔은 어깨에서 거의 수평으로 뻗고, 화살만 턱에서 살짝 내려온다. 실제 사법 그대로다.
  rig.hx = a.x + ux * BODY.span - vx * BODY.gripDrop
  rig.hy = a.y + uy * BODY.span - vy * BODY.gripDrop

  // ── 활의 휨 — 그립(활손)은 고정, 림 끝만 사수 쪽으로 젖혀진다 (BOWPOSE 제1원칙) ──
  // 여기서 재는 이유: 노크가 **시위 위에** 있으려면 시위가 어디 걸렸는지를 먼저 알아야 한다.
  const skin = BOW_SKIN[w.bowSkin] ?? (BOW_SKIN['practice'] as BowSkin)
  const flex = d
    * (1 + rig.trueFull * P.render.poseFullBowCurve)
    * (1 - rig.unlock * P.render.poseStrainBow)
  rig.bowFlex = flex
  rig.bowHalf = BODY.bowHalf * skin.half
  // 브레이스(시위만 맨 상태)는 활의 뻣뻣함과 무관한 고정 높이고, 당김분만 뻣뻣함을 탄다.
  rig.bowBack = rig.bowHalf * (BOWPOSE.brace + BOWPOSE.backGain * flex * skin.bend)

  // 노크는 **시위 위**를 오간다. 당김 0이면 시위 그 자리(그립보다 bowBack 뒤)에 있고,
  // 만작이면 앵커(턱)에 정확히 닿는다. maxDraw가 0.72에서 멈추는 초보는 턱 앞에서 멈춘다 —
  // "아직 힘이 모자라다"가 자세로 읽힌다.
  // 예전엔 당김 0의 노크를 그립과 같은 u에 두어 시위가 활보다 앞으로 볼록했다 —
  // 시위를 매지도 않은 활이었다.
  const nockU = BODY.span - rig.bowBack
  rig.nockX = a.x + ux * (1 - d) * nockU
  rig.nockY = a.y + uy * (1 - d) * nockU

  // ── 시위손 (릴리즈 팔로스루) ──
  // ★ 판이 바뀌면 sim 시계(elapsed)가 0으로 되감긴다. 릴리즈 기억을 안 버리면
  //   경과 시간이 음수가 되어 감쇠 exp가 **증폭**으로 뒤집힌다 — 시위가 화면 밖까지
  //   출렁이던 버그의 정체다 (형의 보고). 시계가 뒤로 갔으면 기억을 버린다.
  if (relAnim.at > w.elapsed) relAnim.at = -1
  // 당기는 동안은 시위(노크)를 잡고 있고, 놓는 순간부터는 시위와 헤어진다.
  const drawingNow = a.phase === 'drawing' || a.phase === 'full' || a.phase === 'collapsing'
  if (drawingNow) {
    relAnim.hx = rig.nockX
    relAnim.hy = rig.nockY
    rig.hdX = rig.nockX
    rig.hdY = rig.nockY
  } else {
    if (relAnim.prevPhase === 'drawing' || relAnim.prevPhase === 'full' || relAnim.prevPhase === 'collapsing') {
      relAnim.at = w.elapsed
    }
    const t = relAnim.at >= 0 ? Math.max(0, w.elapsed - relAnim.at) : 1e9
    // 반동: 놓은 자리에서 **뒤로** 벌어졌다가(어깨가 열린다) —
    const kick = t < FOLLOW.kickT ? Math.sin((t / FOLLOW.kickT) * Math.PI) * FOLLOW.kick : 0
    // — settleT에 걸쳐 편한 자리(어깨 앞·아래)로 내려온다.
    const settle = smoothstep(Math.min(1, t / FOLLOW.settleT))
    const restX = rig.sx + ux * FOLLOW.restFwd - vx * FOLLOW.restDrop
    const restY = rig.sy + uy * FOLLOW.restFwd - vy * FOLLOW.restDrop
    rig.hdX = lerp(relAnim.hx - ux * kick, restX, settle)
    rig.hdY = lerp(relAnim.hy - uy * kick, restY, settle)
  }
  relAnim.prevPhase = a.phase
}

/** 활 손 화면 좌표 — HUD가 스태미나 게이지를 활 옆에 붙이는 데 쓴다. */
export function bowHandScreenX(cam: Camera, w: World): number {
  computeRig(cam, w)
  return worldToScreenX(cam, rig.hx)
}

export function bowHandScreenY(cam: Camera, w: World): number {
  computeRig(cam, w)
  return worldToScreenY(cam, rig.hy)
}

function line(
  ctx: CanvasRenderingContext2D, cam: Camera,
  x0: number, y0: number, x1: number, y1: number,
): void {
  ctx.beginPath()
  ctx.moveTo(worldToScreenX(cam, x0), worldToScreenY(cam, y0))
  ctx.lineTo(worldToScreenX(cam, x1), worldToScreenY(cam, y1))
  ctx.stroke()
}

/** 팔·다리는 관절 하나짜리 꺾인 선. bend는 진행방향 왼쪽(+) 기준 오프셋(m). */
function limb(
  ctx: CanvasRenderingContext2D, cam: Camera,
  x0: number, y0: number, x1: number, y1: number, bend: number,
): void {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  const inv = len > 1e-5 ? 1 / len : 0
  const jx = (x0 + x1) * 0.5 - dy * inv * bend
  const jy = (y0 + y1) * 0.5 + dx * inv * bend
  ctx.beginPath()
  ctx.moveTo(worldToScreenX(cam, x0), worldToScreenY(cam, y0))
  ctx.lineTo(worldToScreenX(cam, jx), worldToScreenY(cam, jy))
  ctx.lineTo(worldToScreenX(cam, x1), worldToScreenY(cam, y1))
  ctx.stroke()
}

/** 척추 — 곧은 선이 아니라 굽는 곡선이어야 "등이 굽었다"가 읽힌다. */
function spine(
  ctx: CanvasRenderingContext2D, cam: Camera,
  x0: number, y0: number, x1: number, y1: number, bendX: number,
): void {
  ctx.beginPath()
  ctx.moveTo(worldToScreenX(cam, x0), worldToScreenY(cam, y0))
  ctx.quadraticCurveTo(
    worldToScreenX(cam, (x0 + x1) * 0.5 + bendX), worldToScreenY(cam, (y0 + y1) * 0.5),
    worldToScreenX(cam, x1), worldToScreenY(cam, y1),
  )
  ctx.stroke()
}

export function drawArcher(
  ctx: CanvasRenderingContext2D, cam: Camera, w: World, _alpha: number,
): void {
  // 궁수는 고정 위치라 보간할 이전 상태가 없다(ArcherState에 px/py가 없다). _alpha는 쓰지 않는다.
  computeRig(cam, w)
  const a = w.archer
  const warn = rig.warn
  const brace = rig.brace
  const trueFull = rig.trueFull
  const unlock = rig.unlock

  const face = rig.face
  const ramp = (warn * 5 + 0.5) | 0

  // 굵기는 cam.scale에 비례한다 — 줌이 바뀌어도 스틱맨의 무게감이 유지된다.
  const shrink = clamp(cam.scale / LINE.refScale, 0.35, 1)
  const lw = clamp(cam.scale * P.render.lineBody, LINE.minPx * shrink, LINE.maxPx)
  const thinPx = Math.max(LINE.thinMinPx * shrink, 0.75)
  // ── 굵기 ── **당김은 굵기를 거의 건드리지 않는다.**
  //
  // 형의 반려: "활 당길 때 대체 왜 캐릭터 몸 전체가 두꺼워지는 거고."
  // 옳은 지적이다. 예전엔 만작에서 gain이 1.48까지 올라 **다리·팔·활까지 전부** 48% 굵어졌다.
  // 사람은 시위를 당긴다고 살이 찌지 않는다. GDD 8장이 "굵기 = 당김·성장"이라 적어둔
  // 문법이었지만, 그 문법을 **모든 선에** 적용한 게 잘못이었다 — 그건 신호가 아니라 팽창이다.
  //
  // 당김은 이미 네 곳에서 말하고 있다: 시위의 V, 턱에 닿는 노크, 깊어지는 활의 휨,
  // 접히는 시위팔. 굵기가 그걸 한 번 더 말할 필요가 없다.
  //
  // 남긴 것은 **몸통 하나**다. 만작에서 등과 어깨가 실제로 뭉치는 건 사실이고,
  // 그 자리만 아주 조금 두꺼워지는 건 팽창이 아니라 긴장이다.
  // 성장(진짜 만작)의 시각적 보상은 자세와 색이 진다 — 노크가 턱에 닿고, 팔꿈치가
  // 제 높이로 오고, 활이 더 휘고, 색이 밝아진다 (docs/FORM.md 3-2).
  const torsoGain = 1 + rig.full * P.render.lineFullGain + trueFull * P.render.lineTrueFullGain
  const limbW = lw * LINE.limbMul
  const torsoW = lw * LINE.torsoMul * torsoGain
  const backW = lw * LINE.backMul
  const bowW = lw * LINE.bowMul
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const bodyCol = warn > ON.warn
    ? (BODY_RAMP[ramp] ?? THEME.body)
    : (trueFull > ON.trueFull ? THEME.target2 : THEME.body)

  // ── 몸통·다리·머리 ────────────────────────────────────────────
  //
  // 등이 굽으면 척추의 세로 길이가 줄고 골반이 올라온다 → 무릎이 더 굽는다.
  // 발은 지면(y=0)에 그대로 붙어 있어야 주저앉는 것처럼 읽힌다.
  //
  // ★ 척추는 수직이다 (docs/FORM.md 2-2). 위를 조준하든 아래를 조준하든 굽지 않는다.
  //   골반은 어깨 **바로 아래**에 놓인다 — 예전엔 기본으로 뒤에 offset을 줘서
  //   가만히 서 있어도 몸이 젖혀져 보였고, 그게 "어정쩡하다"의 절반이었다.
  //   굽는 건 붕괴 임박(warn)뿐이고, 그때만 골반이 뒤로 빠진다.
  const compress = warn * POSE.warnCompress
  const hipBack = warn * POSE.warnHip
  const pelvisX = rig.sx - face * hipBack
  const pelvisY = rig.sy - BODY.torso * (1 - compress)
  const legSpan = clamp(pelvisY, BODY.legMin, BODY.legMax)
  const footY = pelvisY - legSpan
  // 다리는 곧게, 어깨너비로 벌린다. 당김이나 긴장으로 자세가 흔들리지 않는다 (FORM.md 2-1).
  const stance = BODY.stance
  const kneeOut = BODY.kneeOut * (1 + warn * POSE.warnKnee)

  // 척추가 굽는 유일한 경우는 붕괴 임박이다 (FORM.md 3-4). 그 외에는 정확히 직선.
  // strain(경계선 넘김)은 척추를 건드리지 않는다 — 그건 떨림과 팔꿈치가 말한다.
  const spineBend = -face * warn * POSE.warnSpine

  ctx.strokeStyle = bodyCol
  ctx.lineWidth = torsoW
  spine(ctx, cam, rig.sx, rig.sy, pelvisX, pelvisY, spineBend)

  // 원근 — 궁수는 오른쪽을 보고, 우리는 궁수의 **오른편**을 본다. 사법상 왼발이 과녁 쪽(앞),
  // 오른발이 뒤이므로 화면에 가까운 건 오른다리(뒤쪽 발)다. 먼 것(왼다리)을 먼저, 어둡게.
  ctx.strokeStyle = THEME.bodyDim
  ctx.lineWidth = backW
  limb(ctx, cam, pelvisX, pelvisY, pelvisX + face * stance, footY, face * kneeOut)
  ctx.strokeStyle = bodyCol
  ctx.lineWidth = limbW
  limb(ctx, cam, pelvisX, pelvisY, pelvisX - face * stance, footY, -face * kneeOut)

  // 머리 — 조여질수록 활 쪽으로 붙고, 경계선을 넘으면 그 정렬이 헐거워지고, 무너지면 앞으로 떨어진다.
  // strain은 '붙어 있던 게 떨어지는' 것이고 warn은 '고개를 떨구는' 것이라 방향이 서로 반대다.
  const tilt = brace * POSE.braceHeadTilt * (1 - unlock * P.render.poseStrainHead)
    + warn * POSE.warnHeadDrop
  const upX = Math.sin(tilt) * rig.ux
  const upY = Math.cos(tilt) + Math.sin(tilt) * rig.uy
  const neckX = rig.sx + upX * BODY.neck
  const neckY = rig.sy + upY * BODY.neck
  const headSpan = BODY.neck + BODY.head
  const headX = rig.sx + upX * headSpan
  const headY = rig.sy + upY * headSpan
  line(ctx, cam, rig.sx, rig.sy, neckX, neckY)
  // 머리는 채운다. 선만으로는 실루엣의 무게중심이 생기지 않는다 (GDD 8장 실루엣 대비).
  // 하한을 2px 상수가 아니라 선 굵기에 묶는다: 굵기가 하한에 걸리는 작은 배율에서
  // 머리 반지름(0.135m×scale)이 선보다 얇아져 목선에 먹혀버렸다. 머리가 없으면 실루엣이 아니다.
  ctx.beginPath()
  ctx.arc(
    worldToScreenX(cam, headX), worldToScreenY(cam, headY),
    Math.max(BODY.head * cam.scale, lw * LINE.headMinMul), 0, Math.PI * 2,
  )
  ctx.fillStyle = bodyCol
  ctx.fill()
  ctx.stroke()

  // ── 활팔 (왼팔 — 먼 쪽이라 어둡고, 활보다 먼저) ──────────────────────────────────────────
  // 덜 조여지면 팔꿈치가 안 펴지고, 경계선을 넘으면 펴져 있던 팔꿈치가 살짝 풀리고,
  // 경고가 오르면 확실히 더 굽으며 처진다(위의 warnDroop). 세 원인이 같은 관절에 다른 크기로 쌓인다.
  // 왼팔은 화면에서 먼 팔이다 — 어둡게, 몸·활·시위팔 아래에 깔린다 (형의 지적).
  ctx.strokeStyle = THEME.bodyDim
  ctx.lineWidth = backW
  // 활팔은 어깨에서 활 그립까지 **곧게** 뻗는다 (FORM.md 2-4). 굽는 건 잠금이 풀렸을 때(strain)와
  // 무너질 때(warn)뿐이다. 당김이 얕다고 앞팔을 굽히지 않는다 — 초보의 미숙함은 시위손이
  // 턱까지 못 오는 것으로 이미 말하고 있고, 여기까지 굽히면 그냥 자세가 틀린 그림이 된다.
  limb(
    ctx, cam, rig.sx, rig.sy, rig.hx, rig.hy,
    -BODY.armBend * (unlock * P.render.poseStrainArm + warn * POSE.warnArm),
  )


  // ── 활 ────────────────────────────────────────────────────────
  //
  // 실물의 원리대로 그린다 (형의 반려: "각궁이 당길 때 이상하게 구겨져 있어").
  //   · 시위를 당기면 **휘는 림이 사수 쪽으로 젖혀지고** 팁 사이가 오므라들며,
  //     활 몸은 과녁 쪽으로 볼록한 호가 된다. 정점은 그립 근처다.
  //   · 각궁의 고자(활끝)는 뿔·나무 심이라 **휘지 않는다** — 당겨도 과녁 쪽으로 꺾인 채
  //     남는다. 반곡의 실루엣은 '휘는 림 + 안 휘는 고자'의 대비가 만든다.
  //   · 스트렁 상태(당김 0)에서도 시위가 팁을 뒤로 당겨 놓았다 (BOWPOSE.brace).
  //   · **그립은 활손 그 점이다.** 당김이 옮기는 건 팁뿐이다 (tools/probe-form.ts가 판정한다).
  // 경고가 오르면 경고색, 경계선을 넘으면 휨이 조금 풀린다 — 붙들고 있지 못한다는 뜻.
  const skin = BOW_SKIN[w.bowSkin] ?? (BOW_SKIN['practice'] as BowSkin)
  const half = rig.bowHalf
  const limbLen = half * (1 - skin.siyah)
  // 림 끝(고자 뿌리) — 당길수록 시위 쪽(-u)으로 젖혀지고 v로는 살짝 오므라든다.
  // **그립은 안 움직인다.** 움직이는 건 이 두 끝뿐이다.
  const limbV = limbLen * (1 - BOWPOSE.squeeze * rig.bowFlex)
  const limbBack = rig.bowBack

  const baseAx = rig.hx + rig.vx * limbV - rig.ux * limbBack
  const baseAy = rig.hy + rig.vy * limbV - rig.uy * limbBack
  const baseBx = rig.hx - rig.vx * limbV - rig.ux * limbBack
  const baseBy = rig.hy - rig.vy * limbV - rig.uy * limbBack

  // 고자 — 림 끝에서 과녁 쪽으로 꺾인 짧은 직선. 시위는 이 끝에 걸린다.
  const syLen = half * skin.siyah
  let tipAx = baseAx
  let tipAy = baseAy
  let tipBx = baseBx
  let tipBy = baseBy
  if (syLen > 0) {
    const f = skin.siyahFwd
    const nA = Math.hypot(1 - f, f) || 1
    tipAx = baseAx + ((rig.vx * (1 - f) + rig.ux * f) / nA) * syLen
    tipAy = baseAy + ((rig.vy * (1 - f) + rig.uy * f) / nA) * syLen
    tipBx = baseBx + ((-rig.vx * (1 - f) + rig.ux * f) / nA) * syLen
    tipBy = baseBy + ((-rig.vy * (1 - f) + rig.uy * f) / nA) * syLen
  }

  // 만작에 닿는 순간만 밝게 튄다. 당김(고요) → 만작(떨림) 전환의 신호.
  ctx.strokeStyle = warn > ON.warn
    ? (BOW_RAMP[ramp] ?? THEME.bow)
    : (rig.flash > ON.flash ? THEME.target2 : skin.color)
  ctx.lineWidth = bowW
  ctx.lineJoin = 'round'
  // 손잡이(라이저) — 그립을 중심으로 위아래로 **곧게** 뻗는 짧은 구간.
  // 손이 쥘 것이 있어야 쥔 그림이 된다. 여기가 활의 원점이고, 당겨도 움직이지 않는다.
  const riserV = half * BOWPOSE.riser
  const risAx = rig.hx + rig.vx * riserV
  const risAy = rig.hy + rig.vy * riserV
  const risBx = rig.hx - rig.vx * riserV
  const risBy = rig.hy - rig.vy * riserV
  // 라이저 끝 → 팁: 밖으로 나가며 사수 쪽으로 젖혀진다. 제어점이 코드보다 앞(+u)이라
  // 호가 과녁 쪽으로 볼록해진다 — 그립이 활의 가장 앞이다.
  const cAv = riserV + (limbV - riserV) * BOWPOSE.ctrlV
  const cU = limbBack * BOWPOSE.ctrlBack
  ctx.beginPath()
  ctx.moveTo(worldToScreenX(cam, tipAx), worldToScreenY(cam, tipAy))
  ctx.lineTo(worldToScreenX(cam, baseAx), worldToScreenY(cam, baseAy))
  ctx.quadraticCurveTo(
    worldToScreenX(cam, rig.hx + rig.vx * cAv - rig.ux * cU),
    worldToScreenY(cam, rig.hy + rig.vy * cAv - rig.uy * cU),
    worldToScreenX(cam, risAx), worldToScreenY(cam, risAy),
  )
  ctx.lineTo(worldToScreenX(cam, risBx), worldToScreenY(cam, risBy))
  ctx.quadraticCurveTo(
    worldToScreenX(cam, rig.hx - rig.vx * cAv - rig.ux * cU),
    worldToScreenY(cam, rig.hy - rig.vy * cAv - rig.uy * cU),
    worldToScreenX(cam, baseBx), worldToScreenY(cam, baseBy),
  )
  ctx.lineTo(worldToScreenX(cam, tipBx), worldToScreenY(cam, tipBy))
  ctx.stroke()

  if (skin.stab > 0) {
    // 리커브의 안정기 — 그립에서 과녁 쪽으로 뻗는 가는 막대.
    ctx.lineWidth = Math.max(lw * LINE.stringMul * 1.4, thinPx)
    ctx.beginPath()
    ctx.moveTo(worldToScreenX(cam, rig.hx), worldToScreenY(cam, rig.hy))
    ctx.lineTo(worldToScreenX(cam, rig.hx + rig.ux * skin.stab), worldToScreenY(cam, rig.hy + rig.uy * skin.stab))
    ctx.stroke()
    ctx.lineWidth = bowW
  }

  // ── 활손(왼손)의 주먹 — **활대를 쥐었다**는 못. ─────────────────────────────
  // 형의 반려: "손이 활을 안 잡고 붕 떠 있다." 선 두 개가 한 점에서 만나는 것만으로는
  // 쥐었다고 안 읽힌다. 라이저 위에 살점이 있어야 한다. 몸색으로 칠해야 손이다.
  ctx.fillStyle = bodyCol
  ctx.beginPath()
  ctx.arc(
    worldToScreenX(cam, rig.hx), worldToScreenY(cam, rig.hy),
    Math.max(limbW * BOWPOSE.fist, thinPx * 1.6), 0, TAU,
  )
  ctx.fill()

  // 시위 — 몸보다 훨씬 얇다. 고자 끝에 걸린다.
  // 당기는 동안만 노크로 꺾인다. 놓으면 **시위만** 제자리로 튕겨 돌아가 잠깐 잔떨림이 남는다 —
  // 손은 위의 팔로스루가 따로 데려간다 (형: "활줄만 튕겨 돌아오고").
  ctx.strokeStyle = rig.flash > ON.flash ? THEME.target2 : THEME.string
  ctx.lineWidth = Math.max(lw * LINE.stringMul, thinPx)
  ctx.beginPath()
  ctx.moveTo(worldToScreenX(cam, tipAx), worldToScreenY(cam, tipAy))
  const strDrawing = a.phase === 'drawing' || a.phase === 'full' || a.phase === 'collapsing'
  if (strDrawing) {
    ctx.lineTo(worldToScreenX(cam, rig.nockX), worldToScreenY(cam, rig.nockY))
  } else {
    const vt = relAnim.at >= 0 ? Math.max(0, w.elapsed - relAnim.at) : 1e9
    if (vt < FOLLOW.vibDecay * 3) {
      // 잔떨림 — 시위 중앙이 u축으로 감쇠 진동한다. 이게 "튕겨 돌아왔다"의 마침표다.
      const amp = FOLLOW.vib * Math.exp(-vt / FOLLOW.vibDecay) * Math.sin(vt * FOLLOW.vibHz * TAU)
      const mx = (tipAx + tipBx) * 0.5 + rig.ux * amp
      const my = (tipAy + tipBy) * 0.5 + rig.uy * amp
      ctx.lineTo(worldToScreenX(cam, mx), worldToScreenY(cam, my))
    }
  }
  ctx.lineTo(worldToScreenX(cam, tipBx), worldToScreenY(cam, tipBy))
  ctx.stroke()

  if (skin.cam > 0) {
    // 컴파운드 — 캠(도르래)과 팁 사이를 가로지르는 케이블. 이게 보여야 "기계 활"로 읽힌다.
    ctx.beginPath()
    ctx.moveTo(worldToScreenX(cam, tipAx), worldToScreenY(cam, tipAy))
    ctx.lineTo(worldToScreenX(cam, tipBx), worldToScreenY(cam, tipBy))
    ctx.stroke()
    const r = Math.max(bowW * 1.6, 2.5 * shrink)
    ctx.fillStyle = skin.color
    ctx.beginPath()
    ctx.arc(worldToScreenX(cam, tipAx), worldToScreenY(cam, tipAy), r, 0, TAU)
    ctx.arc(worldToScreenX(cam, tipBx), worldToScreenY(cam, tipBy), r, 0, TAU)
    ctx.fill()
  }

  // ── 시위팔 (오른팔 — 가까운 쪽이라 밝고, 맨 위에) ─────────────────────────────────────
  // 덜 당겨진 팔은 팔꿈치가 안 접힌다 — 초보가 "어정쩡한 지점에서 멈춘" 그 모양.
  // 진짜 만작에서만 팔꿈치가 어깨 뒤로 깊게 접혀 팔이 완전히 접힌 실루엣이 된다.
  // 오른팔은 보는 사람 쪽 팔이다 — 밝게, 활·시위 위에 얹힌다 (형의 지적).
  ctx.strokeStyle = bodyCol
  ctx.lineWidth = limbW
  //
  // ★ 사법의 핵심 (docs/FORM.md 2-5): 활손 → 노크 → 아랫팔 → 팔꿈치가 **한 직선**이고,
  //   팔꿈치는 화살선보다 **위**에 있다. 아래로 처지면 '닭날개'라 불리는 초보 자세가 된다.
  //   그래서 팔꿈치를 노크에서 화살선 뒤로 곧게 물리고, v축으로 살짝만 들어올린다.
  //   당김이 얕을수록(초보) 이 들어올림이 줄어 팔꿈치가 처진다.
  const elbowRise = BODY.elbowRise
    * lerp(POSE.slouchElbow, 1, brace)
    * lerp(1, POSE.fullElbow, trueFull)
    * (1 - unlock * P.render.poseStrainElbow)
  // 팔은 시위가 아니라 **손**을 따른다 — 놓은 뒤 시위는 튕겨 돌아가도 팔은 남는다.
  const elbowX = rig.hdX - rig.ux * BODY.elbowBack + rig.vx * elbowRise
  const elbowY = rig.hdY - rig.uy * BODY.elbowBack + rig.vy * elbowRise
  ctx.beginPath()
  ctx.moveTo(worldToScreenX(cam, rig.sx), worldToScreenY(cam, rig.sy))
  ctx.lineTo(worldToScreenX(cam, elbowX), worldToScreenY(cam, elbowY))
  ctx.lineTo(worldToScreenX(cam, rig.hdX), worldToScreenY(cam, rig.hdY))
  ctx.stroke()

  // 시위손(오른손)의 주먹 — **줄을 쥐었다**는 못. 당기는 동안은 노크 그 자리이므로
  // 주먹이 시위의 꺾이는 꼭짓점에 정확히 얹힌다. 놓은 뒤에는 시위와 헤어져 팔로스루를 따라간다.
  ctx.fillStyle = bodyCol
  ctx.beginPath()
  ctx.arc(
    worldToScreenX(cam, rig.hdX), worldToScreenY(cam, rig.hdY),
    Math.max(limbW * BOWPOSE.fist, thinPx * 1.6), 0, TAU,
  )
  ctx.fill()


  // ── 물린 화살 · 통아 ──────────────────────────────────────────
  // 몸보다 얇고 밝게. 촉만 강조색 — 강조색은 과녁과 화살에만 (GDD 8장).
  //
  // ★ 애기살(편전)은 **통아에 얹어 쏜다** (docs/BOWS.md). 통아는 화살 길이의 나무 홈통으로,
  //   시위 손에 쥔 채 짧은 살의 활주로가 되고, **쏜 뒤에도 손에 남는다** — 날아가는 건
  //   반 길이의 애기살뿐이다. 그래서 통아는 recovering에도 그린다 (형의 힌트 그대로).
  const pierce = w.arrowKind === 'pierce'
  if (pierce) {
    // 통아 — **애기살을 장전한 동안 언제나 시위 손에 있다** (형: "여전히 안 보이는데" —
    // 예전엔 idle에서 숨겼고, 당길 땐 화살 선과 정확히 겹쳐 안 읽혔다).
    // 당길 땐 화살선과 수평인 활주로, 놓으면 끈에 매달려 손에서 덜렁거리고,
    // 가만히 있을 땐 손에서 아래로 늘어져 있다. 각도는 시간의 순수 함수다.
    const tongDrawing = a.phase === 'drawing' || a.phase === 'full' || a.phase === 'collapsing'
    let tx: number
    let ty: number
    if (tongDrawing) {
      tx = rig.ux
      ty = rig.uy
    } else {
      const t = relAnim.at >= 0 ? Math.max(0, w.elapsed - relAnim.at) : 1e9
      const hang = -Math.PI / 2
      const aim = Math.atan2(rig.uy, rig.ux)
      // 낙하: 조준각 → 매달림. 0.35s에 걸쳐 떨어지고, 그 위에 감쇠 흔들림이 얹힌다.
      const drop = smoothstep(Math.min(1, t / 0.35))
      const swing = Math.exp(-t / 0.6) * Math.sin(t * 7) * 0.5
      const ang = aim + (hang - aim) * drop + swing * drop
      tx = Math.cos(ang)
      ty = Math.sin(ang)
    }
    // 통아는 **외짝 막대**다 (형의 교정). 당길 때 화살이 그 위에 얹히므로 화살선보다
    // 반 굵기 아래(-v)로 비껴 그린다 — 하나여도 화살에 안 묻힌다.
    const under = 0.05
    const ox = -ty * under
    const oy = tx * under
    ctx.lineWidth = Math.max(lw * LINE.arrowMul * 1.6, thinPx * 1.8)
    ctx.strokeStyle = THEME.bow
    line(
      ctx, cam, rig.hdX - ox, rig.hdY - oy,
      rig.hdX + tx * BODY.arrowLen - ox, rig.hdY + ty * BODY.arrowLen - oy,
    )
  }
  if (a.phase !== 'idle' && a.phase !== 'recovering') {
    // 애기살은 반 길이 — 통아 위를 미끄러진다. 보통 살은 제 길이.
    const len = pierce ? BODY.arrowLen * 0.52 : BODY.arrowLen
    const tipX = rig.nockX + rig.ux * len
    const tipY = rig.nockY + rig.uy * len
    ctx.lineWidth = Math.max(lw * LINE.arrowMul, thinPx)
    ctx.strokeStyle = THEME.arrow
    line(ctx, cam, rig.nockX, rig.nockY, tipX, tipY)
    ctx.strokeStyle = THEME.accent
    line(ctx, cam, tipX - rig.ux * BODY.arrowHead, tipY - rig.uy * BODY.arrowHead, tipX, tipY)
  }

  // ── 호흡정지 사선 (P.steady.previewTime) — 숨을 참으면 화살이 갈 길이 보인다 ──
  // 지금 이 순간 놓으면 나갈 각(조준각 + 떨림)을 그대로 적분한다. 산포가 0이 된 세상이라
  // 이 점선은 거짓말을 하지 않는다. steadyBlend로 스며들고 스며 나간다 (즉발 금지, sim과 동일).
  if (a.steadyBlend > 0.02 && (a.phase === 'drawing' || a.phase === 'full')) {
    const d2 = effectiveStats(w.stats)
    const pw = a.draw
    const spd = lerp(P.bow.minSpeed, P.bow.maxSpeed, Math.pow(clamp(pw, 0, 1), P.bow.drawCurve))
      * d2.speedMul * w.fx.speedMul * w.bow.speedMul
    const ang = a.aimAngle + a.tremorOffset
    let vx2 = Math.cos(ang) * spd
    let vy2 = Math.sin(ang) * spd
    let px3 = a.x
    let py3 = a.y
    const dtp = 1 / 60
    const steps = Math.floor(P.steady.previewTime / dtp)
    ctx.fillStyle = THEME.target2
    ctx.globalAlpha = 0.5 * a.steadyBlend
    for (let i2 = 1; i2 <= steps; i2++) {
      const rvx2 = vx2 - w.wind * w.bow.windMul
      const kdrag = P.arrow.drag * w.fx.dragMul * Math.hypot(rvx2, vy2)
      vx2 -= kdrag * rvx2 * dtp
      vy2 -= kdrag * vy2 * dtp
      vy2 -= P.arrow.gravity * dtp
      px3 += vx2 * dtp
      py3 += vy2 * dtp
      if (py3 <= 0) break
      if (i2 % 5 === 0) {
        ctx.beginPath()
        ctx.arc(worldToScreenX(cam, px3), worldToScreenY(cam, py3), 1.6, 0, TAU)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  // ── 체력 바 — 머리 위 (docs/RUN.md 6장 · 형: "전부 바 형태로") ──
  // 궁수 좌표는 앵커(턱)다. 머리 위로 넉넉히 띄워 조준선과 겹치지 않게 한다.
  {
    // 당길 때, 그리고 체력이 방금 변했을 때만 보인다 — 맞은 건 조준 중이 아니어도 알아야 한다.
    if (hpSeen > w.elapsed) hpSeen = -1e9
    const holdingHp = a.phase === 'drawing' || a.phase === 'full' || a.phase === 'collapsing'
    if (holdingHp || w.hp !== hpLast) {
      hpSeen = w.elapsed
      hpLast = w.hp
    }
    const hpA = holdingHp ? 1 : clamp(1 - (w.elapsed - hpSeen - HP_LINGER) / HP_FADE, 0, 1)
    if (hpA > 0) {
    ctx.globalAlpha = hpA
    const hpRatio = w.hp / Math.max(1, Math.floor(P.enemy.hpMax))
    const bx = worldToScreenX(cam, a.x)
    // 1.05m를 픽셀로 바꾸면 저스케일 판에서 21px까지 줄어 조준 표식(픽셀 고정 59px)이
    // 바를 관통했다 (전수조사 겹침 3번). 월드 오프셋에 픽셀 하한 72px를 깐다.
    const by = Math.min(worldToScreenY(cam, a.y + 1.05), worldToScreenY(cam, a.y) - 72)
    const bw = Math.max(34, cam.scale * 1.3)
    ctx.fillStyle = THEME.gaugeBack
    ctx.fillRect(bx - bw / 2, by, bw, 5)
    // 붉음은 이 게임에서 일관되게 경고다 — 가득 찬 체력이 붉으면 만피가 위험으로 읽힌다 (감사).
    ctx.fillStyle = hpRatio > 0.34 ? THEME.gauge : THEME.gaugeWarn
    ctx.fillRect(bx - bw / 2, by, bw * Math.max(0, Math.min(1, hpRatio)), 5)
    ctx.globalAlpha = 1
    }
  }

}

