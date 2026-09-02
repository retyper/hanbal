/**
 * 명중 반응 레이어 (GDD 7장 · HOOK ★6) — 파티클, 히트스톱, 남는 궤적, 스쿼시&스트레치,
 * 크리티컬 강조, 연쇄 비네트, 콤보 배수, 점수 팝.
 *
 * 규칙은 하나도 안 바뀐다. 피드백만 쌓는다 ("Juice It or Lose It", GDC 2012).
 *
 * ★ 절제 규율 (GDD 7장 · 9장). 새로 붙인 것 전부 아래를 지킨다:
 *   - **조준을 가리는 것은 없다.** 비네트는 화면 가장자리 22%에만 얹히고, 궁수가 시위를
 *     잡는 순간(phase drawing/full) 0.25초 안에 강제로 꺼진다 — 카메라 흔들림의
 *     shakeCutoff와 같은 규율이다.
 *   - 파열 링·스쿼시는 **맞은 과녁 자신의 반경 안팎**에서만 산다. 0.3초면 끝난다.
 *   - 숫자는 popups.ts가 상한을 걸어 관리한다.
 *
 * 전부 고정 크기 버퍼다. push/splice/map 없음, 프레임당 힙 할당 0 (ARCHITECTURE A5).
 * World는 읽기만 하고, events는 읽되 비우지 않는다 (비우는 건 게임 루프).
 */
import { clamp01, damp } from '../core/math.ts'
import { makeRng } from '../core/rng.ts'
import type { Rng } from '../core/rng.ts'
import { P, SPEC } from '../tune/params.ts'
import { TRAIL_POINTS } from '../sim/types.ts'
import type { World } from '../sim/types.ts'
import { THEME, worldToScreenX, worldToScreenY } from './camera.ts'
import type { Camera } from './camera.ts'
import { createPopups, drawPopups, pushPopup, updatePopups } from './popups.ts'
import type { Popups } from './popups.ts'

/** 링버퍼 용량은 런타임에 못 늘린다. 노브의 상한만큼 미리 잡고, 실사용 상한은 P를 따른다. */
const PARTICLE_CAP = SPEC.chain.maxParticles.max
/** 궤적 유령 슬롯 — 한 판 화살이 5~8발이라 8이면 겹치지 않는다 (GDD 6장) */
/** 동시에 남아 있는 시체 수. 넘치면 가장 오래된 것부터 밀어낸다. */
const CORPSES = 12

const GHOSTS = 8
/** 파열 링 슬롯. 한 번의 연쇄가 한꺼번에 8개를 터뜨려도 겹치지 않는다. */
const RINGS = 12
/** 불덩이 슬롯. 한 발이 여럿을 연달아 터뜨려도(관통+폭발) 겹치지 않을 만큼. */
const FIRES = 6
/** 스쿼시 기록 슬롯. scene.ts가 살아남은 과녁(낙하 중 aerial · pierceable)을 눌러 그린다. */
const SQUASH = 12

/**
 * 땅에 박혀 남는 화살 슬롯.
 *
 * 한 판에 8발이 상한이라(GDD 6장) 12면 다 담고도 남는다. 판이 바뀌면 통째로 비운다.
 * **빗나간 화살만 남는다** — 이건 장식이 아니라 "왜 빗나갔는지 읽힌다"(GDD 8장)의 채널이다.
 * 다섯 발이 과녁 아래 나란히 박혀 있으면 조준이 아니라 **낙차를 못 읽고 있다**는 게 보인다.
 */
const STUCK = 12
/** 박힌 화살의 길이 (m)와 굵기 (px). 날아가는 화살보다 짧고 얇다 — 이미 끝난 것이다. */
const STUCK_LEN = 0.55
const STUCK_W = 1.6
const STUCK_ALPHA = 0.4

const KIND_HIT = 0
const KIND_CHAIN = 1
const KIND_MISS = 2
const KIND_CRIT = 3

/** 연출 상수 (개수·px·감쇠). 손맛 시간값은 전부 P에서 읽는다. */
const FX = {
  hitBurst: 16,
  chainBurst: 10,
  missBurst: 7,
  critBurst: 22,
  speed: 5.5,
  missSpeed: 2.2,
  critSpeed: 8.5,
  speedVar: 0.55,
  ttl: 0.5,
  missTtl: 0.32,
  critTtl: 0.72,
  ttlVar: 0.45,
  sizePx: 2.4,
  dragRate: 2.2,
  /**
   * 히트스톱 누적 상한 (ms). 대형 연쇄에서 화면이 멎으면 손맛이 아니라 렉이다.
   * 130 -> 160: 크리티컬 배수(critStopMul)가 붙으면 한 발만으로 88ms라, 130이면
   * 그 뒤에 오는 연쇄가 통째로 잘려 "정중앙이 더 묵직하다"가 사라진다.
   */
  stopCapMs: 160,
  comboTtl: 0.9,
  comboMinShow: 2,
  trailWidthPx: 1.6,
  seed: 0x5eed,

  // ── 크리티컬 (HOOK ★6-3) ──────────────────────────────────────────
  /** 정중앙 문턱은 여기 없다 — 실제 판정은 P.hit.bullseyeAcc 하나를 본다 (A2). */
  /** 정중앙의 히트스톱 배수 */
  critStopMul: 2.1,
  /**
   * 짧은 슬로모 (s)와 그동안의 시간 배수.
   *
   * 왜 sim이 아니라 이펙트 시간축인가: 루프는 **손을 뗀 동안에만** 히트스톱을 건다
   * (loop.ts, 시위가 얼어붙으면 놓은 프레임에 화살이 안 나가므로). 그래서 다음 발을
   * 당기는 중에 터진 정중앙은 sim이 전혀 안 멈춘다 — 그 순간의 "시간이 휘었다"를
   * 만들 수 있는 곳은 이 레이어뿐이다. 조준·시위는 계속 실시간으로 돈다 (입력 지연 0).
   */
  critSlowSec: 0.2,
  critSlowScale: 0.45,
  /** 정중앙에서 자동으로 띄우는 위업 문구 */
  critFeat: '정중앙',

  // ── 스쿼시 & 스트레치 (HOOK ★6-2) ─────────────────────────────────
  /** 눌림이 끝나고 부풀기 시작하는 지점 (수명 비율) */
  squashT: 0.34,
  /** 가로로 퍼지는 양 / 세로로 눌리는 양 */
  squashX: 0.34,
  squashY: 0.26,
  /** 눌린 뒤 한 번 부푸는 양 ("터진다") */
  squashOver: 0.16,
  /** 살아남은 과녁의 눌림 수명 (s) */
  squashTtl: 0.22,
  /** 파열 링 수명 (s) — 즉사한 과녁의 스쿼시를 대신 그린다 */
  ringTtl: 0.3,
  ringCritTtl: 0.42,
  /** 링이 마지막에 퍼지는 배수 */
  ringGrow: 1.15,
  ringW: 2,

  // ── 연쇄 고조 (HOOK ★6-4) ────────────────────────────────────────
  /** 이 연쇄 깊이에서 비네트가 최대 */
  glowDepthFull: 6,
  /** 비네트 최대 불투명도. 이 이상은 배경을 먹는다. */
  glowAlpha: 0.16,
  /** 투명한 중심의 반경 비율 — 화면 안쪽 78%는 손대지 않는다 */
  glowInner: 0.78,
  glowOuter: 1.02,
  /** 평상시 감쇠 / 시위를 잡은 순간의 감쇠 (/s) */
  glowDecay: 2.4,
  glowAimDecay: 12,
  /** 연쇄가 멎고 이만큼 지나면 무조건 끈다 (s). shakeCutoff와 같은 규율. */
  glowCutoff: 1.1,
  /** 콤보 1당 파티클 크기 증가 / 그 상한 */
  chainSizeStep: 0.09,
  chainSizeCap: 8,

  // ── 폭발 (화전) ───────────────────────────────────────────────────
  //
  // 폭발이 "연쇄 이벤트 몇 개"로만 존재하던 걸 실제 사건으로 만든다.
  // 넷이 같이 와야 터진 것으로 읽힌다: 불덩이 · 파편 · 충격파 링 · 화면 정지.
  /** 파편 수·속도·수명. 크리티컬보다 세게 — 이건 내가 만든 사건이 아니라 화살이 만든 사건이다. */
  burstBurst: 30,
  burstSpeed: 11,
  burstTtl: 0.6,
  burstSize: 1.5,
  /** 폭발의 히트스톱 배수. 정중앙(2.1)보다 크다 */
  burstStopMul: 2.6,
  /** 불덩이 수명 (s)과, 최대로 부푸는 시점(수명 비율) */
  fireTtl: 0.34,
  firePeak: 0.28,
  /** 폭발 반경 대비 불덩이의 최대 크기. 1이면 반경 그대로 */
  fireGrow: 0.92,

  // ── 점수 팝 (HOOK ★6-1) ──────────────────────────────────────────
  /** 이 점수에서 팝이 최대 크기·밝기가 된다. 기본 과녁 100점, 링 배수 최대 2배. */
  scoreRef: 420,
} as const
// TODO(params): hit.critStopMul · hit.critSlowSec · hit.critSlowScale
// TODO(params): hit.squashTtl · hit.ringTtl · chain.glowAlpha · chain.glowCutoff

/** 비네트 색 = 강조색(#ffb347). 알파는 globalAlpha로 준다. */
const GLOW_RGB0 = 'rgba(255,179,71,0)'
const GLOW_RGB1 = 'rgba(255,179,71,1)'

/** 콤보 배수 글꼴. 숫자가 주인공이라 계기판 계열 (render/hud.ts와 같은 규칙). */
const COMBO_FONT =
  '700 17px "Bahnschrift","DIN Alternate","Avenir Next Condensed","Malgun Gothic",system-ui,sans-serif'

/** 연쇄 팝의 짧은 정수 문자열. 매 연쇄마다 문자열을 만들지 않는다 (A5). */
const NUM: string[] = []
for (let i = 0; i <= 64; i++) NUM.push(String(i))

export interface Fx {
  readonly cap: number
  /** ── 쓰러진 적 (형: "퍽하고 뜨거나 날아가거나") ──────────────────────
   * 링버퍼. sim이 넘긴 충격(SimEvent 'foe_down')을 여기서 **월드 좌표 물리**로 굴린다:
   * 중력으로 떨어지고, 지면에서 한 번 튀고, 마찰로 멎고, 누운 채 잠시 남았다 사라진다.
   * 판정에 아무 영향이 없으므로 결정론과 무관하다 (A1) — 실시간 dt로 돈다. */
  cHead: number
  cX: Float32Array
  cY: Float32Array
  cVx: Float32Array
  cVy: Float32Array
  cAng: Float32Array
  cSpin: Float32Array
  cR: Float32Array
  /** 쓰러진 자리의 땅 높이 (m). 시체는 여기 눕는다 — 언덕 위에서 죽으면 언덕 위에 (sim/terrain.ts). */
  cG: Float32Array
  /** 쓰러진 뒤 흐른 시간 (s). 음수면 빈 칸이다. */
  cAge: Float32Array
  /** 멎은 뒤 흐른 시간 (s). 0 미만이면 아직 구르는 중. */
  cRest: Float32Array
  cLook: Int8Array

  head: number
  /** 파티클 SoA — 월드 좌표(m)라 카메라가 움직여도 붙어 있는다 */
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
  life: Float32Array
  ttl: Float32Array
  kind: Uint8Array
  /** 크기 배수 — 연쇄가 깊을수록 커진다 */
  sz: Float32Array
  /** 유령 궤적: 화살이 사라진 뒤에도 남는 선 */
  gHead: number
  gPts: Float32Array
  gLen: Int32Array
  gLife: Float32Array
  gTtl: Float32Array
  gMiss: Uint8Array
  /** 파열 링 — 즉사한 과녁의 스쿼시&스트레치 */
  rHead: number
  rX: Float32Array
  rY: Float32Array
  rR: Float32Array
  rLife: Float32Array
  rTtl: Float32Array
  rCrit: Uint8Array
  /** 살아남은 과녁의 눌림 기록. scene.ts가 targetSquash()로 읽어간다. */
  sHead: number
  sId: Int32Array
  sLife: Float32Array
  /** 불덩이 — 폭발이 만드는 채운 원. x, y, 반경(m), 남은 수명. */
  fHead: number
  fX: Float32Array
  fY: Float32Array
  fR: Float32Array
  fLife: Float32Array
  /** 땅에 박혀 남는 화살 (판이 끝날 때까지). x, y, 각도. */
  kHead: number
  kN: number
  kX: Float32Array
  kY: Float32Array
  kA: Float32Array
  /**
   * 몸에 박힌 화살 (형: "맞으면 정확히 박힌 위치에 보여져야"). 과녁 id 기준 상대 좌표라
   * 보스가 움직여도 화살이 몸에 붙어 다닌다. pId<0 = 빈 칸. pId===PLAYER_PIN = 궁수 몸.
   */
  pHead: number
  pId: Int32Array
  pDx: Float32Array
  pDy: Float32Array
  pA: Float32Array
  /** 남은 히트스톱 (s) */
  hitStop: number
  /**
   * '한 발' 순간 0..1 (docs/MEGAHIT.md §2) — **판마다 한 번 보장되는 기대.**
   *
   * 마지막 과녁 하나가 남았는데 내 화살이 날고 있다. 그 비행 동안 시간이 늘어지고
   * 배경이 물러난다. GDD 7장에 "마지막 화살이 결승 과녁으로 향할 때만 슬로모"라는
   * 씨앗이 이미 적혀 있었는데 이름도 없이 묻혀 있었다 — **제목이 곧 훅인데 안 쓰고 있었다.**
   *
   * 실시간 페이싱 값이라 sim 결정론과 무관하다 (히트스톱과 같은 급). 스텝 수는 그대로고
   * 벽시계 배치만 늘어난다.
   *
   * 2026-08-26 (형의 지적): "빠르게 맞추다보면 다른 화살 쏘고 있는데 화면이 계속 느려진 상태다."
   * 원인은 조건이 "판마다 한 번"을 코드로 강제하지 않았다는 것 — 과녁이 하나뿐인 판(1-1)이나
   * 적 1명과 붙는 전투는 **처음부터 끝까지 alive===1**이라 그 판의 모든 발이 슬로모였다.
   * 재시도(빗맞음 후 다시 조준)도 매번 다시 걸렸다. oneShotUsed/oneShotActive가 그걸 막는다:
   * 이 판에서 딱 한 번, 처음 걸리는 발에서만 켜지고 그 발이 끝나면 다시는 안 켜진다.
   */
  oneShot: number
  /** 이번 프레임에 조건이 참인가. 램프는 updateFx가 한다 — 툭 끊으면 슬로모가 아니라 렉이다. */
  oneShotWant: boolean
  /** 이번 판에서 '한 발'을 이미 썼는가. "판마다 한 번"을 실제로 강제하는 값 (아래 pumpEvents 참고). */
  oneShotUsed: boolean
  /** 지금 그 한 번이 진행 중인가 (화살이 아직 날고 있다). */
  oneShotActive: boolean
  /** 직전 프레임의 w.elapsed. 되감기면(판이 바뀌면) oneShotUsed를 새로 푼다. */
  oneShotElapsedPrev: number
  /**
   * 지금의 '한 발'이 실시간으로 몇 초째 진행 중인가. P.render.oneShotMaxSec을 넘기면
   * 강제로 끝낸다 — 빗맞아 화면 밖으로 계속 날아가는 화살은 sim 비행시간이 최대 8초라
   * oneShotScale(0.4)에서 실제로는 20초까지 슬로모가 안 풀렸다(형의 신고, 2026-08-26).
   */
  oneShotRealSec: number
  /** 남은 슬로모 (실시간 s) */
  slow: number
  /** 연쇄 비네트 0..1 과 그 나이 (s) */
  glow: number
  glowAge: number
  /** 궁수가 지금 시위를 잡고 있는가. 비네트를 강제로 끄는 조건이다. */
  aiming: boolean
  comboLife: number
  comboX: number
  comboY: number
  comboText: string
  comboVal: number
  /** sim의 w.combo를 렌더 쪽에서 그대로 따라 센다 (chain 이벤트에는 combo가 없다) */
  comboRun: number
  /** 마지막 명중 지점 — 위업 문구를 띄울 자리 */
  lastX: number
  lastY: number
  pop: Popups
  vig: CanvasGradient | null
  vigW: number
  vigH: number
  lastTick: number
  rng: Rng
}

/** 몸에 박히는 화살 풀 크기. 넘치면 가장 오래된 것부터 밀려난다 (A5: 고정 크기). */
const BODY_PINS = 14
/** pId에 이 값이면 궁수 몸에 박힌 적 화살이다. 과녁 id는 0 이상이라 충돌하지 않는다. */
export const PLAYER_PIN = -2

/**
 * 몸에 화살 하나를 박는다.
 *
 * 착탄점은 히트박스 **가장자리**라 그대로 쓰면 화살이 공중에 떠 보인다 (형의 지적:
 * "몸에 박혀 있어야지, 히트박스 맞은 곳에 멈춰 있으면 떠 있잖아"). 촉을 진행 방향으로
 * 몸 속(반경의 절반)까지 밀어 넣고, 중심에서 너무 벗어나지 않게 자른다 —
 * 그래야 "반은 몸에, 반은 밖에"의 박힌 그림이 된다.
 */
function pinArrow(fx: Fx, id: number, dx: number, dy: number, r: number, ang: number): void {
  const depth = r * 0.55
  let px2 = dx + Math.cos(ang) * depth
  let py2 = dy + Math.sin(ang) * depth
  const len = Math.hypot(px2, py2)
  const cap = r * 0.55
  if (len > cap && len > 0) {
    px2 *= cap / len
    py2 *= cap / len
  }
  const i = fx.pHead % BODY_PINS
  fx.pHead = (fx.pHead + 1) % BODY_PINS
  fx.pId[i] = id
  fx.pDx[i] = px2
  fx.pDy[i] = py2
  fx.pA[i] = ang
}

/** drawFx(ctx, cam) 2인자 호출을 지원하기 위한 현재 인스턴스. 게임에 Fx는 하나뿐이다. */
let active: Fx | null = null

export function createFx(): Fx {
  const f: Fx = {
    cap: PARTICLE_CAP,
    cHead: 0,
    cX: new Float32Array(CORPSES),
    cY: new Float32Array(CORPSES),
    cVx: new Float32Array(CORPSES),
    cVy: new Float32Array(CORPSES),
    cAng: new Float32Array(CORPSES),
    cSpin: new Float32Array(CORPSES),
    cR: new Float32Array(CORPSES),
    cG: new Float32Array(CORPSES),
    cAge: new Float32Array(CORPSES).fill(-1),
    cRest: new Float32Array(CORPSES).fill(-1),
    cLook: new Int8Array(CORPSES),

    head: 0,
    pHead: 0,
    pId: new Int32Array(BODY_PINS).fill(-1),
    pDx: new Float32Array(BODY_PINS),
    pDy: new Float32Array(BODY_PINS),
    pA: new Float32Array(BODY_PINS),
    x: new Float32Array(PARTICLE_CAP),
    y: new Float32Array(PARTICLE_CAP),
    vx: new Float32Array(PARTICLE_CAP),
    vy: new Float32Array(PARTICLE_CAP),
    life: new Float32Array(PARTICLE_CAP),
    ttl: new Float32Array(PARTICLE_CAP),
    kind: new Uint8Array(PARTICLE_CAP),
    sz: new Float32Array(PARTICLE_CAP),
    gHead: 0,
    gPts: new Float32Array(GHOSTS * TRAIL_POINTS * 2),
    gLen: new Int32Array(GHOSTS),
    gLife: new Float32Array(GHOSTS),
    gTtl: new Float32Array(GHOSTS),
    gMiss: new Uint8Array(GHOSTS),
    rHead: 0,
    rX: new Float32Array(RINGS),
    rY: new Float32Array(RINGS),
    rR: new Float32Array(RINGS),
    rLife: new Float32Array(RINGS),
    rTtl: new Float32Array(RINGS),
    rCrit: new Uint8Array(RINGS),
    sHead: 0,
    sId: new Int32Array(SQUASH).fill(-1),
    sLife: new Float32Array(SQUASH),
    fHead: 0,
    fX: new Float32Array(FIRES),
    fY: new Float32Array(FIRES),
    fR: new Float32Array(FIRES),
    fLife: new Float32Array(FIRES),
    kHead: 0,
    kN: 0,
    kX: new Float32Array(STUCK),
    kY: new Float32Array(STUCK),
    kA: new Float32Array(STUCK),
    hitStop: 0,
    oneShot: 0,
    oneShotWant: false,
    oneShotUsed: false,
    oneShotActive: false,
    oneShotElapsedPrev: -1,
    oneShotRealSec: 0,
    slow: 0,
    glow: 0,
    glowAge: 0,
    aiming: false,
    comboLife: 0,
    comboX: 0,
    comboY: 0,
    comboText: '',
    comboVal: 0,
    comboRun: 0,
    lastX: 0,
    lastY: 0,
    pop: createPopups(),
    vig: null,
    vigW: -1,
    vigH: -1,
    lastTick: -1,
    // 렌더 전용 난수. sim 스트림과 분리돼 있어 결정론에 영향이 없다.
    rng: makeRng(FX.seed),
  }
  active = f
  return f
}

function spawn(
  f: Fx, x: number, y: number, n: number, kind: number,
  speed: number, ttl: number, sizeMul: number,
): void {
  const live = P.chain.maxParticles < f.cap ? P.chain.maxParticles : f.cap
  for (let i = 0; i < n; i++) {
    const idx = f.head
    f.head = f.head + 1 >= live ? 0 : f.head + 1
    // 정중앙만 방사형 — 고르게 퍼지는 별 모양이라 난수 뭉치와 한눈에 구분된다.
    const ang = kind === KIND_CRIT
      ? (i / n) * Math.PI * 2 + f.rng.next() * 0.12
      : f.rng.next() * Math.PI * 2
    const sp = speed * (1 - FX.speedVar + f.rng.next() * FX.speedVar * 2)
    f.x[idx] = x
    f.y[idx] = y
    f.vx[idx] = Math.cos(ang) * sp
    f.vy[idx] = Math.sin(ang) * sp
    const t = ttl * (1 - FX.ttlVar + f.rng.next() * FX.ttlVar * 2)
    f.ttl[idx] = t
    f.life[idx] = t
    f.kind[idx] = kind
    f.sz[idx] = sizeMul
  }
}

/** 즉사한 과녁 자리에 파열 링을 남긴다. 눌렸다가 터지는 걸 링 하나로 보여준다. */
function spawnRing(f: Fx, x: number, y: number, r: number, crit: boolean): void {
  const slot = f.rHead
  f.rHead = f.rHead + 1 >= RINGS ? 0 : f.rHead + 1
  const ttl = crit ? FX.ringCritTtl : FX.ringTtl
  f.rX[slot] = x
  f.rY[slot] = y
  f.rR[slot] = r
  f.rTtl[slot] = ttl
  f.rLife[slot] = ttl
  f.rCrit[slot] = crit ? 1 : 0
}

/** 폭발의 불덩이. 링은 테두리라 "터졌다"는 **면**이 없다 — 이게 그 면이다. */
function spawnFire(f: Fx, x: number, y: number, r: number): void {
  const slot = f.fHead
  f.fHead = f.fHead + 1 >= FIRES ? 0 : f.fHead + 1
  f.fX[slot] = x
  f.fY[slot] = y
  f.fR[slot] = r
  f.fLife[slot] = FX.fireTtl
}

/** 살아남은 과녁(낙하 중 aerial · pierceable)의 눌림을 기록한다. scene.ts가 읽어간다. */
function markSquash(f: Fx, id: number): void {
  // 같은 과녁이 연달아 맞으면 새 슬롯을 쓰지 않고 갱신한다 — 관통 과녁에서 슬롯이 마른다.
  for (let i = 0; i < SQUASH; i++) {
    if (f.sId[i] === id && (f.sLife[i] ?? 0) > 0) {
      f.sLife[i] = FX.squashTtl
      return
    }
  }
  const slot = f.sHead
  f.sHead = f.sHead + 1 >= SQUASH ? 0 : f.sHead + 1
  f.sId[slot] = id
  f.sLife[slot] = FX.squashTtl
}

/** 과녁 반경을 이벤트만으로는 알 수 없다. World에서 읽어온다 (읽기 전용, A1). */
function radiusOf(w: World, id: number): number {
  for (let i = 0; i < w.targets.length; i++) {
    const t = w.targets[i]
    if (t !== undefined && t.id === id) return t.r
  }
  return 0.5
}

/**
 * 화살이 죽은 뒤에도 궤적을 남기려면 링버퍼를 복사해 둬야 한다. 화살 풀은 곧 재사용된다.
 *
 * ★ **어느 화살인지는 이벤트가 알려준다** (`SimEvent.arrow` = 풀 자리 번호).
 * 예전엔 좌표로 가장 가까운 시체를 찾았는데, 관통 살처럼 맞고도 계속 나는 화살은
 * 명중 순간 아직 'flying'이라 검색에 안 걸리고 **직전 화살의 시체**가 대신 뽑혔다.
 * 그 시체의 궤적은 궁수의 손에서 시작하므로, 화면에는 먼 과녁을 맞히는 순간
 * "손에서 화살이 하나 더 나가는" 것으로 보였다 (형이 본 그 버그. 재현 확인함).
 */
function captureTrail(f: Fx, w: World, index: number, miss: boolean): void {
  const ar = w.arrows[index]
  if (ar === undefined) return

  const slot = f.gHead
  f.gHead = f.gHead + 1 >= GHOSTS ? 0 : f.gHead + 1
  const n = ar.trailLen < TRAIL_POINTS ? ar.trailLen : TRAIL_POINTS
  const base = slot * TRAIL_POINTS * 2
  // 링버퍼를 오래된 → 최신 순서로 펴서 복사한다.
  for (let j = 0; j < n; j++) {
    const src = ((ar.trailHead - n + j) % TRAIL_POINTS + TRAIL_POINTS) % TRAIL_POINTS
    f.gPts[base + j * 2] = ar.trail[src * 2] ?? 0
    f.gPts[base + j * 2 + 1] = ar.trail[src * 2 + 1] ?? 0
  }
  f.gLen[slot] = n
  // ★ 빗나간 궤적이 더 오래 남아야 왜 빗나갔는지 읽고 배운다 (GDD 8장)
  const ttl = miss ? P.hit.missTrailFade : P.hit.trailFade
  f.gTtl[slot] = ttl
  f.gLife[slot] = ttl
  f.gMiss[slot] = miss ? 1 : 0
}

/** 연쇄 파티클이 커지는 배수. 콤보가 깊을수록 굵어진다 (HOOK ★6-4). */
function chainSize(combo: number): number {
  const n = combo < FX.chainSizeCap ? combo : FX.chainSizeCap
  return 1 + (n > 0 ? n : 0) * FX.chainSizeStep
}

/** 빗나가 땅에 박힌 화살 하나를 남긴다. 각도는 그 화살에서 읽는다 (이벤트가 자리를 알려준다). */
function stickArrow(f: Fx, w: World, index: number, x: number, y: number): void {
  const angle = w.arrows[index]?.angle ?? 0
  const slot = f.kHead
  f.kHead = f.kHead + 1 >= STUCK ? 0 : f.kHead + 1
  if (f.kN < STUCK) f.kN++
  f.kX[slot] = x
  f.kY[slot] = y
  f.kA[slot] = angle
}

export function pumpEvents(fx: Fx, w: World): void {
  // 비네트를 끌 조건은 tick과 무관하게 매 프레임 최신이어야 한다.
  const ph = w.archer.phase
  fx.aiming = ph === 'drawing' || ph === 'full'

  // 판이 바뀌었다 (sim 시계가 되감겼다). 지난 판의 화살이 새 판 땅에 박혀 있으면 안 된다.
  // 히트스톱은 tick을 **멈출** 뿐 되돌리지 않으므로 이 비교는 오작동하지 않는다.
  if (w.tick < fx.lastTick) {
    fx.kHead = 0
    fx.kN = 0
    // 몸에 박힌 화살도 지난 판의 것이다.
    fx.pId.fill(-1)
    fx.pHead = 0
    // ★ 시체도 지난 판의 것이다 (형: "왜 다음스테이지 넘어가도 전판 시체가 남아있냐").
    //   여기 있던 다른 것들은 지우면서 시체만 빠져 있었다.
    fx.cAge.fill(-1)
    fx.cHead = 0
  }

  // 같은 tick을 두 번 그리면 이벤트가 이중 처리된다. events를 비우는 건 게임 루프의 몫이라
  // 여기서는 tick으로만 가드한다.
  if (w.tick === fx.lastTick) return
  fx.lastTick = w.tick

  const ev = w.events
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i]
    if (e === undefined) continue

    if (e.t === 'hit') {
      // 적의 몸통에는 '정중앙'이 없다 — 그건 과녁의 말이다. 적의 크리티컬은 오직 머리다.
      const crit = e.foe ? e.head : e.accuracy >= P.hit.bullseyeAcc
      // 머리 명중은 정중앙이 아니라 **헤드샷**이다 (형: "치명상이라던가 그런 게 떠야지").
      if (e.head) pushPopup(fx.pop, e.x, e.y + 0.8, '헤드샷!', 'crit')
      fx.lastX = e.x
      fx.lastY = e.y
      fx.comboRun = e.combo + 1

      const size = chainSize(e.combo)
      if (crit) {
        spawn(fx, e.x, e.y, FX.critBurst, KIND_CRIT, FX.critSpeed, FX.critTtl, size * 1.25)
        fx.hitStop += P.hit.stopMs * 0.001 * FX.critStopMul
        if (fx.slow < FX.critSlowSec) fx.slow = FX.critSlowSec
      } else {
        spawn(fx, e.x, e.y, FX.hitBurst, KIND_HIT, FX.speed, FX.ttl, size)
        fx.hitStop += P.hit.stopMs * 0.001
      }

      spawnRing(fx, e.x, e.y, radiusOf(w, e.targetId), crit)
      markSquash(fx, e.targetId)
      captureTrail(fx, w, e.arrow, false)

      // 몸에 박기 — 맞고도 서 있는 적(보스·궁수)이면 화살이 그 자리에 남는다.
      for (const tg of w.targets) {
        if (tg.id !== e.targetId) continue
        if (tg.alive && (tg.kind === 'boss' || tg.kind === 'archer')) {
          const ar = w.arrows[e.arrow]
          if (ar !== undefined) pinArrow(fx, tg.id, ar.x - tg.x, ar.y - tg.y, tg.r, ar.angle)
        }
        break
      }

      // ── 피해 팝 (형: "화살이 맞으면 점수가 아니라 데미지가 떠야 하는 거 아냐?
      //    점수는 알아서 계산돼서 클리어 때 나오면 되잖아") ──
      //
      // 옳다. 그리고 지금은 더 옳다 — 피해가 질량과 착탄 속도의 **제곱**을 타게 바뀌었는데
      // (sim/arrowfx.ts), 그 물리가 화면에 한 번도 안 나타나면 배울 수가 없다.
      // 이 숫자가 그 교사다: 가까이서 쏜 육량전 96과 멀리서 쏜 애기살 22가 눈에 다르게 보인다.
      //
      // **체력이 없는 과녁에는 아무 숫자도 안 띄운다.** 과녁은 한 발에 사라지므로
      // 사라지는 것 자체가 피드백이고, 거기 숫자를 얹으면 화면이 숫자로 덮인다 (GDD 7장).
      // 점수는 판이 끝나야 뜻이 생기는 누적값이라 결과 배너의 것이다 (hud.ts).
      //
      // ★ 즉사(execute)는 **아무것도 안 띄운다.**
      //
      // 숫자를 안 띄우는 이유 (형: "몸에 맞았는데 144뜨고 머리맞았는데 70뜨는건뭐냐"):
      // dmg 가 그 순간 남아 있던 체력이라, 이미 몸통샷으로 깎여 있던 적이면 작게 나온다 —
      // 머리가 몸통보다 약해 보이는 거짓 신호가 된다.
      //
      // '즉사!'라는 말도 지웠다 (2026-08-31, 형: "즉사라는 말은 지워. 필요없고 헤드샷이랑 겹쳐").
      // 맞는 말이다 — 같은 사건에 이미 위에서 '헤드샷!'이 떴다. 한 발에 두 마디가 뜨면 둘 다
      // 안 읽힌다. **한 사건에 한 마디**가 이 화면의 규칙이고(바로 아래 정중앙 처리와 같은 규칙),
      // 즉사는 헤드샷이 이미 뜻하는 것이다.
      if (!e.execute && e.dmg > 0) {
        pushPopup(
          fx.pop, e.x, e.y, `${e.dmg}`, crit ? 'crit' : 'score',
          // 로그 스케일 — 큰 한 방과 작은 한 방의 차이가 팝 크기로도 읽힌다.
          clamp01(Math.log1p(e.dmg / 40) / Math.log1p(12)),
        )
      }
      // 헤드샷이 이미 떴으면 정중앙은 겹쳐 띄우지 않는다 — 한 사건에 한 마디.
      if (crit && !e.head) pushPopup(fx.pop, e.x, e.y, FX.critFeat, 'feat')

      if (e.combo >= FX.comboMinShow) {
        // 콤보 문자열은 값이 바뀔 때만 만든다 (A5)
        if (e.combo !== fx.comboVal) {
          fx.comboVal = e.combo
          fx.comboText = `${e.combo}콤보 ×${Math.pow(P.chain.comboMul, e.combo).toFixed(1)}`
        }
        fx.comboX = e.x
        fx.comboY = e.y
        fx.comboLife = FX.comboTtl
      }
    } else if (e.t === 'chain') {
      fx.comboRun++
      fx.lastX = e.x
      fx.lastY = e.y
      const size = chainSize(fx.comboRun)
      spawn(fx, e.x, e.y, FX.chainBurst, KIND_CHAIN, FX.speed, FX.ttl, size)
      spawnRing(fx, e.x, e.y, radiusOf(w, e.targetId), false)
      markSquash(fx, e.targetId)
      fx.hitStop += P.hit.chainStopMs * 0.001

      // 연쇄는 배수가 아니라 **박자**를 보여준다 — 작게, 연달아, 숫자 하나만.
      pushPopup(fx.pop, e.x, e.y, NUM[fx.comboRun] ?? String(fx.comboRun), 'chain')

      const g = clamp01(e.depth / FX.glowDepthFull)
      if (g > fx.glow) fx.glow = g
      fx.glowAge = 0

      if (fx.comboRun >= FX.comboMinShow) {
        if (fx.comboRun !== fx.comboVal) {
          fx.comboVal = fx.comboRun
          fx.comboText = `${fx.comboRun}콤보 ×${Math.pow(P.chain.comboMul, fx.comboRun).toFixed(1)}`
        }
        fx.comboX = e.x
        fx.comboY = e.y
        fx.comboLife = FX.comboTtl
      }
    } else if (e.t === 'miss') {
      // sim이 여기서 콤보를 끊는다 (world.ts). 렌더 카운터도 같이 끊어야 어긋나지 않는다.
      fx.comboRun = 0
      spawn(fx, e.x, e.y, FX.missBurst, KIND_MISS, FX.missSpeed, FX.missTtl, 1)
      captureTrail(fx, w, e.arrow, true)
      stickArrow(fx, w, e.arrow, e.x, e.y)
    } else if (e.t === 'pickup') {
      // 보급 — 얻은 것이 숫자로 튀어야 "벌었다"가 된다. 위업 슬롯을 쓰는 이유는
      // 점수 팝과 같은 자리에서 겹치지 않게 아래에서 올라오기 때문이다 (popups.ts lift).
      pushPopup(fx.pop, e.x, e.y, e.gain > 1 ? `화살 +${e.gain}` : '화살 +1', 'feat')
      spawn(fx, e.x, e.y, FX.hitBurst, KIND_CHAIN, FX.speed, FX.ttl, 1.2)
    } else if (e.t === 'deflect') {
      // 맞불 — 내 화살이 적 화살을 쳐냈다. 불꽃이 크게 튀고 글자가 남아야
      // "방금 그거 내가 한 거다"가 된다. 흔치 않은 순간이라 아끼지 않는다.
      pushPopup(fx.pop, e.x, e.y + 0.6, '쳐냈다!', 'crit')
      spawn(fx, e.x, e.y, FX.hitBurst, KIND_CHAIN, FX.speed * 1.4, FX.ttl, 1.4)
      fx.hitStop += P.hit.stopMs * 0.001
    } else if (e.t === 'enemy_block') {
      // 과녁이 막아줬다 — 작은 먼지. "가려져서 살았다"가 보여야 엄폐가 전술이 된다.
      spawn(fx, e.x, e.y, FX.missBurst, KIND_MISS, FX.missSpeed, FX.missTtl, 0.8)
      // ★ 갑옷은 이제 **깎인다** (2026-08-31, 형: "적 갑옷병은 갑옷도 무적이 아니게").
      //   그래서 말도 달라져야 한다. 예전의 '막혔다'는 끝난 사건이라 "그만 쏴라"로 읽혔다 —
      //   실제로는 진행 중인데도. 남은 비율을 그대로 띄운다: 두들길수록 숫자가 줄고,
      //   그 줄어드는 숫자가 "계속 때리면 벗겨진다"는 규칙을 말없이 가르친다.
      //   left < 0 은 갑옷이 아니라 과녁이 막은 것이다 (world.ts, 적 화살이 판자에 박힘).
      if (e.left < 0) {
        pushPopup(fx.pop, e.x, e.y + 0.5, '막혔다', 'chain')
      } else {
        pushPopup(fx.pop, e.x, e.y + 0.5, `갑옷 ${Math.max(1, Math.round(e.left * 100))}%`, 'chain')
        spawn(fx, e.x, e.y, FX.hitBurst, KIND_CHAIN, FX.speed * 0.7, FX.ttl * 0.7, 0.7)
      }
    } else if (e.t === 'armor_break') {
      // 벗겨졌다 — 여기부터 아무 살이나 통한다. 규칙이 바뀌는 순간이라 크게 알린다.
      pushPopup(fx.pop, e.x, e.y + 0.9, '갑옷 파손!', 'crit')
      spawn(fx, e.x, e.y, FX.hitBurst, KIND_CHAIN, FX.speed * 1.5, FX.ttl * 1.2, 1.5)
      fx.hitStop += P.hit.stopMs * 0.001
    } else if (e.t === 'guard_block') {
      // ── 산 방어가 대신 받았다 (game/defense.ts) ──
      // 이 순간의 뜻은 하나다: **훈련치를 쓴 것이 지금 값을 했다.** 그러니 조용히 지나가면
      // 안 된다. 남은 양을 숫자로 띄운다 — 그게 "언제 또 사야 하는가"를 가르치는 유일한 화면이다.
      const name = e.armor ? '두정갑' : '방패'
      if (e.left <= 0) {
        // 부서졌다. 다음 발부터는 맨몸이다 — 규칙이 바뀌는 순간이라 크게 알린다.
        pushPopup(fx.pop, e.x, e.y + 0.9, `${name} 파손!`, 'crit')
        spawn(fx, e.x, e.y, FX.hitBurst, KIND_CHAIN, FX.speed * 1.5, FX.ttl * 1.2, 1.5)
        fx.hitStop += P.hit.stopMs * 0.001
      } else {
        pushPopup(fx.pop, e.x, e.y + 0.5, `${name} ${Math.max(1, Math.round(e.left * 100))}%`, 'chain')
        spawn(fx, e.x, e.y, FX.missBurst, KIND_MISS, FX.missSpeed, FX.missTtl, 0.9)
      }
    } else if (e.t === 'player_hit') {
      // 맞았다 — 콤보가 끊기고 시간이 잠깐 멈춘다. 남은 체력이 아니라 잃었다는 사실을 띄운다.
      fx.comboRun = 0
      fx.hitStop += P.hit.stopMs * 0.002
      pushPopup(fx.pop, w.archer.x + 1.2, w.archer.y + 1.2, e.hp <= 0 ? '쓰러졌다' : '피격!', 'crit')
      // 쓰러지는 순간은 세상이 느려져야 한다 — 죽음에 무게가 없으면 여정에도 무게가 없다.
      if (e.hp <= 0) {
        fx.slow = 1.1
        fx.hitStop += P.hit.stopMs * 0.004
      }
      // 적 화살이면 궁수 몸에 박힌다 — 정확히 맞은 그 자리에 (형).
      if (e.pin) pinArrow(fx, PLAYER_PIN, e.x - w.archer.x, e.y - w.archer.y, 0.7, e.ang)
    } else if (e.t === 'escape') {
      // 빼앗겼다. 콤보도 여기서 끊긴다 (sim이 이미 끊었다 — 렌더 카운터도 맞춘다).
      fx.comboRun = 0
      if (e.lost > 0) pushPopup(fx.pop, e.x, e.y, `화살 -${e.lost}`, 'crit')
      spawn(fx, e.x, e.y, FX.missBurst, KIND_MISS, FX.critSpeed, FX.missTtl, 1.4)
      fx.hitStop += P.hit.stopMs * 0.001
    } else if (e.t === 'foe_down') {
      // 적이 쓰러졌다 — 시체를 하나 세운다 (형: "죽었을때 없어져버리지 말고").
      spawnCorpse(fx, e.x, e.y, e.vx, e.vy, e.mass, e.look, e.r, e.g)
    } else if (e.t === 'burst') {
      // ★ 폭발. 예전에는 딸려 죽은 과녁의 chain 이벤트만 있어서, 아무것도 안 물리면
      // 폭발이 일어난 흔적이 화면에 하나도 안 남았다 (형의 지적).
      // 불덩이 + 파편 + 충격파 링 + 화면 흔들림 — 넷이 같이 와야 "터졌다"가 된다.
      spawnFire(fx, e.x, e.y, e.radius)
      spawn(fx, e.x, e.y, FX.burstBurst, KIND_CRIT, FX.burstSpeed, FX.burstTtl, FX.burstSize)
      spawnRing(fx, e.x, e.y, e.radius, true)
      fx.hitStop += P.hit.stopMs * 0.001 * FX.burstStopMul
    }
  }

  const cap = FX.stopCapMs * 0.001
  if (fx.hitStop > cap) fx.hitStop = cap

  // ── '한 발' — 마지막 하나를 향해 화살이 난다 ──
  // 조건을 좁게 잡는다. "과녁이 하나 남았다"만으로 걸면 과녁 하나짜리 판(1-1)이나
  // 적 1명짜리 전투가 통째로 슬로모가 된다. **내 화살이 그 하나를 향해 날고 있는 동안**만이다.
  //
  // 그것만으로는 부족했다 (형: "빠르게 맞추다보면 화면이 계속 느려진 상태"). 그 조건은
  // 매 발 다시 참이 될 수 있어서, 1-1류 판이나 재시도(빗맞고 다시 쏨)마다 반복해서 걸렸다.
  // oneShotUsed가 판당 한 번만 켜지게 잠근다 — 판이 바뀌면(시계가 되감기면) 다시 푼다.
  if (w.elapsed < fx.oneShotElapsedPrev) {
    fx.oneShotUsed = false
    fx.oneShotActive = false
  }
  fx.oneShotElapsedPrev = w.elapsed

  let alive = 0
  for (let i = 0; i < w.targets.length; i++) {
    const t = w.targets[i]
    if (t !== undefined && t.alive && !t.falling) alive++
  }
  let flying = false
  if (alive === 1) {
    for (let i = 0; i < w.arrows.length; i++) {
      const a = w.arrows[i]
      if (a !== undefined && a.alive && a.outcome === 'flying' && a.splitDepth <= 0) {
        flying = true
        break
      }
    }
  }
  const rawWant = alive === 1 && flying && w.status === 'playing'
  if (rawWant && !fx.oneShotUsed) {
    if (!fx.oneShotActive) fx.oneShotRealSec = 0
    fx.oneShotActive = true
  } else if (fx.oneShotActive && !rawWant) {
    // 그 발이 끝났다(맞았든 빗나갔든) — 이 판의 한 번을 여기서 소비한다.
    fx.oneShotActive = false
    fx.oneShotUsed = true
  }
  fx.oneShotWant = fx.oneShotActive
}

/** 지금 이펙트 시간이 흐르는 속도. 정중앙 직후에만 1보다 작다. */

/**
 * 적이 쓰러졌다 — 시체를 하나 세운다.
 *
 * 초속은 **운동량 보존의 흉내**다: 화살의 속도 × 질량비 × 전달률. 무거운 살(육량전 mass 2.2)이
 * 가벼운 살보다 몸을 더 밀어낸다 — 형이 말한 "화살맞은 에너지와 물체의 질량에 따라"가 이 줄이다.
 * 위로는 살짝 띄운다(퍽 하고 뜨는 그 한 순간). 가로 속도는 회전으로도 바뀐다.
 */
function spawnCorpse(
  f: Fx, x: number, y: number, vx: number, vy: number, mass: number, look: number, r: number, g: number,
): void {
  const i = f.cHead
  f.cHead = (f.cHead + 1) % CORPSES
  const k = P.render.corpsePush * mass
  let cvx = vx * k
  let cvy = vy * k + P.render.corpseLift
  const sp = Math.hypot(cvx, cvy)
  const max = P.render.corpseMaxV
  if (sp > max) {
    cvx = (cvx / sp) * max
    cvy = (cvy / sp) * max
  }
  f.cX[i] = x
  f.cY[i] = y
  f.cVx[i] = cvx
  f.cVy[i] = cvy
  f.cAng[i] = 0
  f.cSpin[i] = cvx * P.render.corpseSpin
  f.cR[i] = r
  f.cG[i] = g
  f.cAge[i] = 0
  f.cRest[i] = -1
  f.cLook[i] = look
}

/**
 * 시체를 한 프레임 굴린다. 중력 → 지면 충돌(한 번 튀고) → 마찰 → 멎음 → 여운 → 사라짐.
 * 실시간 dt로 돈다: 시체는 판정과 무관하고, sim 시계에 묶으면 히트스톱 동안 공중에 얼어붙는다.
 */
function stepCorpses(f: Fx, dt: number): void {
  const g = P.arrow.gravity
  for (let i = 0; i < CORPSES; i++) {
    const age = f.cAge[i] ?? -1
    if (age < 0) continue
    f.cAge[i] = age + dt
    const rest = f.cRest[i] ?? -1
    if (rest >= 0) {
      // 멎었다 — 누운 채 여운을 센다.
      const nr = rest + dt
      f.cRest[i] = nr
      if (nr > P.render.corpseLinger + P.render.corpseFade) f.cAge[i] = -1
      continue
    }
    let vx = f.cVx[i] ?? 0
    let vy = (f.cVy[i] ?? 0) - g * dt
    let spin = f.cSpin[i] ?? 0
    let x = (f.cX[i] ?? 0) + vx * dt
    let y = (f.cY[i] ?? 0) + vy * dt
    let ang = (f.cAng[i] ?? 0) + spin * dt
    const floor = (f.cG[i] ?? 0) + (f.cR[i] ?? 0.3) * 0.5
    if (y <= floor) {
      y = floor
      if (vy < 0) vy = -vy * P.render.corpseBounce
      // 땅에 끌린다. 가로 속도가 죽으면 회전도 같이 죽는다.
      const drag = Math.exp(-P.render.corpseDrag * dt)
      vx *= drag
      spin *= drag
      if (Math.abs(vx) < 0.25 && vy < 0.4) {
        vx = 0
        vy = 0
        spin = 0
        f.cRest[i] = 0
        // 누웠다. 어느 쪽으로 누울지는 마지막으로 밀린 방향이 정한다.
        ang = ang >= 0 ? Math.PI * 0.5 : -Math.PI * 0.5
      }
    }
    f.cVx[i] = vx
    f.cVy[i] = vy
    f.cSpin[i] = spin
    f.cX[i] = x
    f.cY[i] = y
    f.cAng[i] = ang
  }
}

/** 두 각 사이를 최단 경로로. 팔다리가 가라앉을 때 한 바퀴 돌지 않게. */
function lerpAng(a: number, b: number, t: number): number {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/** 선분 하나. 시체는 전부 이걸로 그린다 — 부위마다 각이 따로 놀아야 뻣뻣하지 않다. */
function limb(
  ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number,
): void {
  ctx.moveTo(x, y)
  ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
}

/**
 * 쓰러진 것을 그린다. **셋이 서로 다르게 죽는다.**
 *
 * 형: "시체가 무슨 빳빳하게 굳어가지고. 사람이 바리케이트냐? 진짜 사람이 죽는 것처럼 만들라고."
 * 맞는 말이었다. 앞 판은 몸 전체를 **한 덩어리로 회전**시켰다 — 그러니 널빤지가 날아갔다.
 *
 * 사람이 죽는 것처럼 보이는 이유는 딱 하나다: **팔다리가 몸통을 안 따라간다.**
 *   · 나는 동안 — 팔다리가 저마다 다른 주기로 휘젓고 몸통보다 늦게 따라온다.
 *   · 땅에 닿은 뒤 — 팔다리가 몸통의 회전과 **무관하게 중력 쪽으로 늘어진다**(settle).
 *     이 한 줄이 "굳은 것"과 "늘어진 것"을 가른다.
 * 좌우 팔·다리의 위상과 목표 각을 일부러 어긋나게 둔다 — 대칭이면 인형이 된다.
 */
function drawCorpses(ctx: CanvasRenderingContext2D, cam: Camera, f: Fx): void {
  const DOWN = Math.PI / 2
  for (let i = 0; i < CORPSES; i++) {
    const age = f.cAge[i] ?? -1
    if (age < 0) continue
    const rest = f.cRest[i] ?? -1
    const fade = rest > P.render.corpseLinger
      ? 1 - (rest - P.render.corpseLinger) / P.render.corpseFade
      : 1
    if (fade <= 0) continue

    const x = worldToScreenX(cam, f.cX[i] ?? 0)
    const y = worldToScreenY(cam, f.cY[i] ?? 0)
    const r = Math.max(3, (f.cR[i] ?? 0.3) * cam.scale)
    const look = f.cLook[i] ?? 0
    // 늘어짐 0..1 — 땅에 닿은 뒤 이 시간에 걸쳐 팔다리가 중력에 진다.
    const settle = rest >= 0 ? clamp01(rest / P.render.corpseLimp) : 0
    // 개체마다 다른 위상. 같은 판에서 둘이 똑같이 죽으면 그건 복사다.
    const ph = i * 1.7
    const spd = Math.hypot(f.cVx[i] ?? 0, f.cVy[i] ?? 0)
    // 휘젓는 폭 — 빠를수록 크고, 가라앉을수록 준다.
    const sw = (1 - settle) * Math.min(0.9, 0.25 + spd * 0.06)
    const ang = f.cAng[i] ?? 0

    ctx.save()
    ctx.globalAlpha = fade
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (look === 3) {
      // ── 드론 — 부러진 틀이 돈다. 사람처럼 눕지 않는다. ──
      ctx.translate(x, y)
      ctx.rotate(ang)
      ctx.strokeStyle = THEME.prop
      ctx.lineWidth = Math.max(1.5, r * 0.26)
      ctx.beginPath()
      ctx.moveTo(-r, 0)
      ctx.lineTo(r * 0.9, r * 0.12)
      // 부러진 로터 한쪽이 꺾여 있다.
      ctx.moveTo(r * 0.5, r * 0.06)
      ctx.lineTo(r * 0.95, -r * 0.5)
      ctx.stroke()
      ctx.fillStyle = THEME.bodyDim
      ctx.fillRect(-r * 0.3, -r * 0.22, r * 0.6, r * 0.44)
      // 죽은 로터 — 멈춘 원 둘.
      ctx.strokeStyle = THEME.bodyDim
      ctx.lineWidth = Math.max(1, r * 0.12)
      ctx.beginPath()
      ctx.arc(-r * 0.8, 0, r * 0.22, 0, Math.PI * 2)
      ctx.arc(r * 0.75, r * 0.1, r * 0.18, 0, Math.PI * 2)
      ctx.stroke()
    } else if (look < 0) {
      // ── 보스(눈알귀신) — 시체가 아니라 **무너진다.** ──
      // 형: "보스 시체도 Y에 점찍어놓은게 말이되냐" — 맞다. 보스는 사람이 아니라
      // 자락을 늘어뜨린 덩어리(scene.ts 'boss')다. 그러니 남는 것도 사람 모양일 수 없다.
      // 가라앉을수록 납작해지고, 노려보던 눈이 감긴다.
      const w = r * (1 + settle * 0.5)
      const h = r * (1 - settle * 0.62)
      ctx.fillStyle = THEME.threatDim
      ctx.beginPath()
      ctx.moveTo(x - w, y + h * 0.2)
      ctx.quadraticCurveTo(x - w * 0.9, y - h, x, y - h * 1.05)
      ctx.quadraticCurveTo(x + w * 0.9, y - h, x + w, y + h * 0.2)
      // 밑단 — 흘러내린 자락. 살아 있을 때의 파도가 멎어 땅에 퍼진 모양이다.
      ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.55, x, y + h * 0.35)
      ctx.quadraticCurveTo(x - w * 0.5, y + h * 0.55, x - w, y + h * 0.2)
      ctx.closePath()
      ctx.fill()
      // 눈 — 감긴다. 다 감기면 선 하나만 남는다.
      const eye = (1 - settle) * r * 0.34
      ctx.strokeStyle = THEME.threat
      ctx.lineWidth = Math.max(1.2, r * 0.09)
      ctx.beginPath()
      if (eye > 1) ctx.ellipse(x, y - h * 0.35, r * 0.34, eye, 0, 0, Math.PI * 2)
      else limb(ctx, x - r * 0.3, y - h * 0.35, 0, r * 0.6)
      ctx.stroke()
    } else {
      // ── 사람 — 머리·몸통·팔 둘·다리 둘. 부위마다 각이 따로 논다. ──
      const up = -Math.PI / 2 + ang            // 엉덩이 → 어깨 방향
      const torso = r * 1.15
      const arm = r * 0.78
      const leg = r * 0.86
      const sx = x + Math.cos(up) * torso      // 어깨
      const sy = y + Math.sin(up) * torso

      ctx.strokeStyle = THEME.bodyDim
      ctx.lineWidth = Math.max(1.4, r * 0.26)
      ctx.beginPath()
      // 몸통
      limb(ctx, x, y, up, torso)
      // 팔 — 나는 동안은 어깨에 매달려 휘젓고, 가라앉으면 땅으로 떨어진다.
      limb(ctx, sx, sy, lerpAng(up + 1.0 + Math.sin(age * 11 + ph) * sw, DOWN - 0.4, settle), arm)
      limb(ctx, sx, sy, lerpAng(up - 1.35 + Math.sin(age * 9 + ph + 2.1) * sw, DOWN + 0.7, settle), arm * 0.92)
      // 다리 — 팔보다 무겁다: 느리게 흔들리고 덜 벌어진다.
      limb(ctx, x, y, lerpAng(up + Math.PI - 0.3 + Math.sin(age * 7 + ph) * sw * 0.7, DOWN + 0.28, settle), leg)
      limb(ctx, x, y, lerpAng(up + Math.PI + 0.22 + Math.sin(age * 6 + ph + 1.3) * sw * 0.7, DOWN - 0.12, settle), leg * 0.94)
      ctx.stroke()
      // 머리 — 어깨 위. 가라앉으면 목이 꺾여 한쪽으로 떨어진다.
      const neck = lerpAng(up, DOWN - 1.1, settle * 0.75)
      ctx.fillStyle = THEME.bodyDim
      ctx.beginPath()
      ctx.arc(sx + Math.cos(neck) * r * 0.38, sy + Math.sin(neck) * r * 0.38, r * 0.3, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }
  ctx.globalAlpha = 1
}

export function fxTimeScale(fx: Fx): number {
  if (fx.slow <= 0) return 1
  // 끝에서 1로 부드럽게 돌아온다. 툭 끊으면 슬로모가 아니라 렉으로 읽힌다.
  const u = clamp01(fx.slow / FX.critSlowSec)
  return 1 + (FX.critSlowScale - 1) * u * u
}

/** '한 발'의 세기 0..1. scene이 배경을 물리고, game/loop.ts가 sim의 벽시계를 늘린다. */
export function oneShotAmount(fx: Fx): number {
  return fx.oneShot
}

export function updateFx(fx: Fx, dtReal: number): void {
  // '한 발' 상한 — 실시간으로 잰다 (MEGAHIT.md §2 "최대 2초"). 빗맞고 화면 밖까지 계속
  // 날아가는 화살은 sim 비행시간이 최대 8초라, oneShotScale(0.4)에서 상한이 없으면
  // 실제로는 20초까지 슬로모가 안 풀렸다 (형: "화살이 멀리 날아가는 도중에도 계속
  // 슬로우 잡힌다"). 상한을 넘기면 그 발은 아직 날고 있어도 여기서 강제로 끝낸다 —
  // 화살 자체는 그냥 정상 속도로 마저 난다, 느려지던 시간만 돌아온다.
  if (fx.oneShotActive) {
    fx.oneShotRealSec += dtReal
    if (fx.oneShotRealSec >= P.render.oneShotMaxSec) {
      fx.oneShotActive = false
      fx.oneShotUsed = true
      // pumpEvents가 다음 프레임에야 이 상태를 볼 것이다 — 여운(oneShotOut) 램프가
      // 한 프레임 안 늦게 지금 바로 시작하도록 want도 같이 내린다.
      fx.oneShotWant = false
    }
  }
  // '한 발' 램프 — 들어갈 땐 빠르게(순간을 놓치면 안 된다), 나올 땐 느리게(여운).
  const want = fx.oneShotWant ? 1 : 0
  const rate = want > fx.oneShot ? P.render.oneShotIn : P.render.oneShotOut
  const step2 = rate > 0 ? dtReal / rate : 1
  fx.oneShot += (want - fx.oneShot) * (step2 < 1 ? step2 : 1)
  if (fx.oneShot < 0.001) fx.oneShot = 0
  // 히트스톱은 sim을 세우는 값이라 언제나 실시간으로 깎인다. 슬로모에 끌려가면 안 된다.
  if (fx.hitStop > 0) {
    fx.hitStop -= dtReal
    if (fx.hitStop < 0) fx.hitStop = 0
  }
  const scale = fxTimeScale(fx)
  if (fx.slow > 0) {
    fx.slow -= dtReal
    if (fx.slow < 0) fx.slow = 0
  }
  // 이펙트 시간축. 파티클·링·팝만 여기에 실린다 — 궤적과 콤보 표시는 읽기용이라 실시간이다.
  const dt = dtReal * scale

  if (fx.comboLife > 0) fx.comboLife -= dtReal

  // ── 연쇄 비네트 ──────────────────────────────────────────────
  if (fx.glow > 0) {
    fx.glowAge += dtReal
    // ★ 시위를 잡는 순간 급히 꺼진다. 다음 발을 겨누는 화면에 물이 들면 안 된다.
    //   나이 컷오프는 카메라 shakeCutoff와 같은 규율 — 연출이 조준보다 오래 살지 못한다.
    if (fx.glowAge >= FX.glowCutoff) fx.glow = 0
    else fx.glow = damp(fx.glow, 0, fx.aiming ? FX.glowAimDecay : FX.glowDecay, dtReal)
    if (fx.glow < 0.004) fx.glow = 0
  }

  updatePopups(fx.pop, dt)
  // 시체는 **실시간**으로 떨어진다. 히트스톱 시간축에 묶으면 공중에 얼어붙는다.
  stepCorpses(fx, dtReal)

  const g = P.arrow.gravity
  const drag = 1 - FX.dragRate * dt
  const k = drag > 0 ? drag : 0
  for (let i = 0; i < fx.cap; i++) {
    const l = fx.life[i] ?? 0
    if (l <= 0) continue
    const nl = l - dt
    fx.life[i] = nl > 0 ? nl : 0
    if (nl <= 0) continue
    const vx = (fx.vx[i] ?? 0) * k
    const vy = (fx.vy[i] ?? 0) * k - g * dt
    fx.vx[i] = vx
    fx.vy[i] = vy
    fx.x[i] = (fx.x[i] ?? 0) + vx * dt
    fx.y[i] = (fx.y[i] ?? 0) + vy * dt
  }

  for (let s = 0; s < RINGS; s++) {
    const l = fx.rLife[s] ?? 0
    if (l <= 0) continue
    const nl = l - dt
    fx.rLife[s] = nl > 0 ? nl : 0
  }

  for (let s = 0; s < FIRES; s++) {
    const l = fx.fLife[s] ?? 0
    if (l <= 0) continue
    const nl = l - dt
    fx.fLife[s] = nl > 0 ? nl : 0
  }

  for (let s = 0; s < SQUASH; s++) {
    const l = fx.sLife[s] ?? 0
    if (l <= 0) continue
    const nl = l - dt
    fx.sLife[s] = nl > 0 ? nl : 0
    if (nl <= 0) fx.sId[s] = -1
  }

  for (let s = 0; s < GHOSTS; s++) {
    const l = fx.gLife[s] ?? 0
    if (l <= 0) continue
    const nl = l - dtReal
    fx.gLife[s] = nl > 0 ? nl : 0
    if (nl <= 0) fx.gLen[s] = 0
  }
}

/** 현재 남은 히트스톱 (ms). 게임 루프가 이만큼 sim 스텝을 미룬다. */
export function hitStopMs(fx: Fx): number {
  return fx.hitStop * 1000
}

// ───────────────────────── scene.ts 가 읽어가는 것 ─────────────────────────

/**
 * 과녁 한 개의 스쿼시 배율. 1,1 이면 아무 일도 없는 상태다.
 *
 * scene.ts 사용법 (drawTargets 안, arc 대신 ellipse):
 * ```ts
 * const sq = targetSquash(fx, t.id)
 * ctx.ellipse(x, y, r * sq.sx, r * sq.sy, 0, 0, Math.PI * 2)
 * ```
 * 즉사하는 과녁은 같은 프레임에 alive=false가 되어 scene이 안 그리므로, 그쪽 몫은
 * effects.ts가 파열 링으로 대신 그린다. 이 함수가 실제로 눌러 그리는 건 **살아남는 과녁** —
 * 낙하 중인 aerial 과 관통 과녁이다.
 *
 * ★ 반환값은 **공유 스크래치**다. 다음 호출 전에 읽어라 (프레임당 할당 0, A5).
 */
export interface Squash {
  readonly sx: number
  readonly sy: number
}

const SQ_OUT = { sx: 1, sy: 1 }

/** 0..1 진행에서의 눌림 세기. squashT에서 정확히 0으로 돌아온다 (튀지 않는다). */
function squashPulse(t: number): number {
  return t < FX.squashT ? Math.sin((Math.PI * t) / FX.squashT) : 0
}

/** squashT 이후의 부풀기. 끝에서 0으로 돌아온다. */
function squashOver(t: number): number {
  if (t < FX.squashT) return 0
  const u = (t - FX.squashT) / (1 - FX.squashT)
  return Math.sin(Math.PI * u)
}

export function targetSquash(fx: Fx, id: number): Squash {
  SQ_OUT.sx = 1
  SQ_OUT.sy = 1
  for (let i = 0; i < SQUASH; i++) {
    if (fx.sId[i] !== id) continue
    const l = fx.sLife[i] ?? 0
    if (l <= 0) continue
    const t = 1 - clamp01(l / FX.squashTtl)
    const sq = squashPulse(t)
    const ov = FX.squashOver * squashOver(t)
    SQ_OUT.sx = 1 + FX.squashX * sq + ov
    SQ_OUT.sy = 1 - FX.squashY * sq + ov
    return SQ_OUT
  }
  return SQ_OUT
}

/** 위업 문구를 띄운다. 좌표를 생략하면 마지막 명중 지점 (game/ui 레이어용). */
export function pushFeat(text: string, x?: number, y?: number, fx?: Fx): void {
  const f = fx ?? active
  if (f === null) return
  pushPopup(f.pop, x ?? f.lastX, y ?? f.lastY, text, 'feat')
}

/** 팝 풀을 직접 쓰고 싶은 쪽을 위한 창구. 없으면 pushFeat만으로 충분하다. */
export function fxPopups(fx: Fx): Popups {
  return fx.pop
}

// ───────────────────────────── 그리기 ─────────────────────────────

function drawVignette(ctx: CanvasRenderingContext2D, f: Fx, w: number, h: number): void {
  if (f.glow <= 0) return
  if (f.vig === null || f.vigW !== w || f.vigH !== h) {
    // 그라디언트는 화면 크기가 바뀔 때만 만든다 (프레임당 할당 0, A5).
    const cx = w * 0.5
    const cy = h * 0.5
    const rad = Math.max(w, h) * 0.72
    const g = ctx.createRadialGradient(cx, cy, rad * FX.glowInner, cx, cy, rad * FX.glowOuter)
    g.addColorStop(0, GLOW_RGB0)
    g.addColorStop(1, GLOW_RGB1)
    f.vig = g
    f.vigW = w
    f.vigH = h
  }
  ctx.globalAlpha = FX.glowAlpha * f.glow
  ctx.fillStyle = f.vig
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 1
}

/** 쓰러진 적. 과녁·화살보다 **먼저** 그린다 — 시체가 살아 있는 것들을 가리면 안 된다. */
export function drawCorpseLayer(ctx: CanvasRenderingContext2D, cam: Camera, fx?: Fx): void {
  const f = fx ?? active
  if (f !== null) drawCorpses(ctx, cam, f)
}

export function drawFx(ctx: CanvasRenderingContext2D, cam: Camera, fx?: Fx): void {
  const f = fx ?? active
  if (f === null) return

  // ── 땅에 박힌 화살 ───────────────────────────────────────────
  // 맨 아래에 그린다. 이건 배경이지 사건이 아니다 — 지난 발의 흔적일 뿐이라
  // 지금 날아가는 화살이나 이펙트를 덮으면 안 된다.
  if (f.kN > 0) {
    ctx.globalAlpha = STUCK_ALPHA
    ctx.strokeStyle = THEME.arrow
    ctx.lineWidth = STUCK_W
    ctx.lineCap = 'butt'
    ctx.beginPath()
    for (let s = 0; s < f.kN; s++) {
      const x = f.kX[s] ?? 0
      const y = f.kY[s] ?? 0
      const a = f.kA[s] ?? 0
      // 박힌 자리에서 **왔던 방향으로** 뻗는다. 대가 땅 밖으로 나와 있는 모양이다.
      const sx = worldToScreenX(cam, x)
      const sy = worldToScreenY(cam, y)
      const ex = worldToScreenX(cam, x - Math.cos(a) * STUCK_LEN)
      const ey = worldToScreenY(cam, y - Math.sin(a) * STUCK_LEN)
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // ── 유령 궤적 ────────────────────────────────────────────────
  ctx.lineWidth = FX.trailWidthPx
  ctx.lineCap = 'round'
  for (let s = 0; s < GHOSTS; s++) {
    const n = f.gLen[s] ?? 0
    const life = f.gLife[s] ?? 0
    if (n < 2 || life <= 0) continue
    const ttl = f.gTtl[s] ?? 1
    const miss = (f.gMiss[s] ?? 0) === 1
    ctx.globalAlpha = clamp01(life / ttl) * (miss ? 0.55 : 0.75)
    ctx.strokeStyle = miss ? THEME.trailMiss : THEME.trailHit
    const base = s * TRAIL_POINTS * 2
    ctx.beginPath()
    for (let j = 0; j < n; j++) {
      const sx = worldToScreenX(cam, f.gPts[base + j * 2] ?? 0)
      const sy = worldToScreenY(cam, f.gPts[base + j * 2 + 1] ?? 0)
      if (j === 0) ctx.moveTo(sx, sy)
      else ctx.lineTo(sx, sy)
    }
    ctx.stroke()
  }

  // ── 불덩이 (폭발) ────────────────────────────────────────────
  // 링보다 먼저. 불덩이는 면이고 링은 그 위를 지나는 충격파다.
  for (let s = 0; s < FIRES; s++) {
    const life = f.fLife[s] ?? 0
    if (life <= 0) continue
    const t = 1 - clamp01(life / FX.fireTtl)
    // 순식간에 부풀었다가 천천히 사그라든다. 커지는 데 오래 걸리면 폭발이 아니라 풍선이다.
    const grow = t < FX.firePeak
      ? t / FX.firePeak
      : 1
    const fade = t < FX.firePeak ? 1 : 1 - (t - FX.firePeak) / (1 - FX.firePeak)
    const rp = (f.fR[s] ?? 1) * cam.scale * FX.fireGrow * grow
    if (rp < 1) continue
    const sx = worldToScreenX(cam, f.fX[s] ?? 0)
    const sy = worldToScreenY(cam, f.fY[s] ?? 0)
    // 겉은 강조색, 속은 흰 심지. 두 겹이면 불덩이로 읽힌다.
    ctx.globalAlpha = fade * 0.5
    ctx.fillStyle = THEME.accent
    ctx.beginPath()
    ctx.arc(sx, sy, rp, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = fade * 0.85
    ctx.fillStyle = THEME.target2
    ctx.beginPath()
    ctx.arc(sx, sy, rp * (1 - t) * 0.45, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // ── 파열 링 (스쿼시 & 스트레치) ────────────────────────────────
  ctx.lineWidth = FX.ringW
  for (let s = 0; s < RINGS; s++) {
    const life = f.rLife[s] ?? 0
    if (life <= 0) continue
    const ttl = f.rTtl[s] ?? 1
    const t = 1 - clamp01(life / ttl)
    const sq = squashPulse(t)
    const ov = squashOver(t)
    // 눌린 뒤 퍼지며 사라진다. 반경은 맞은 과녁 자신의 크기에서 출발한다.
    const grow = t < FX.squashT ? 1 : 1 + FX.ringGrow * Math.pow((t - FX.squashT) / (1 - FX.squashT), 0.55)
    const rp = (f.rR[s] ?? 0.5) * cam.scale * grow
    if (rp < 1) continue
    const rx = rp * (1 + FX.squashX * sq + FX.squashOver * ov)
    const ry = rp * (1 - FX.squashY * sq + FX.squashOver * ov)
    ctx.globalAlpha = (t < FX.squashT ? 1 : 1 - (t - FX.squashT) / (1 - FX.squashT)) * 0.85
    ctx.strokeStyle = (f.rCrit[s] ?? 0) === 1 ? THEME.target2 : THEME.accent
    ctx.beginPath()
    ctx.ellipse(
      worldToScreenX(cam, f.rX[s] ?? 0),
      worldToScreenY(cam, f.rY[s] ?? 0),
      rx, ry, 0, 0, Math.PI * 2,
    )
    ctx.stroke()
  }

  // ── 파티클 ───────────────────────────────────────────────────
  const px = FX.sizePx
  for (let i = 0; i < f.cap; i++) {
    const l = f.life[i] ?? 0
    if (l <= 0) continue
    const t = clamp01(l / (f.ttl[i] ?? 1))
    const kind = f.kind[i] ?? KIND_HIT
    ctx.globalAlpha = t
    ctx.fillStyle = kind === KIND_MISS
      ? THEME.trailMiss
      : kind === KIND_CRIT ? THEME.target2 : kind === KIND_CHAIN ? THEME.target2 : THEME.accent
    const sz = px * (f.sz[i] ?? 1) * (0.4 + t * 0.6)
    ctx.fillRect(
      worldToScreenX(cam, f.x[i] ?? 0) - sz * 0.5,
      worldToScreenY(cam, f.y[i] ?? 0) - sz * 0.5,
      sz, sz,
    )
  }

  // ── 연쇄 비네트 (가장자리만) ──────────────────────────────────
  drawVignette(ctx, f, cam.w, cam.h)

  // ── 콤보 배수 (GDD 7장 절제 원칙: 작게, 연쇄가 일어난 자리 옆에) ──
  if (f.comboLife > 0 && f.comboText !== '') {
    ctx.globalAlpha = clamp01(f.comboLife / FX.comboTtl)
    ctx.fillStyle = THEME.accent
    ctx.font = COMBO_FONT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const rise = (1 - clamp01(f.comboLife / FX.comboTtl)) * 14
    ctx.fillText(f.comboText, worldToScreenX(cam, f.comboX), worldToScreenY(cam, f.comboY) - 12 - rise)
  }

  // ── 점수 팝 (맨 위) ──────────────────────────────────────────
  drawPopups(ctx, cam, f.pop)

  ctx.globalAlpha = 1
}
