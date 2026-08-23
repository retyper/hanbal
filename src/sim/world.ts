/**
 * 월드 조립과 고정 스텝 구동 — sim의 지휘자.
 *
 * 이 파일은 물리를 직접 계산하지 않는다. 상태를 소유하고, 매 스텝 정해진 순서로
 * bow → ballistics → target 을 부르고, 판의 시작과 끝을 판정할 뿐이다.
 * 물리가 여기 섞이면 각 시스템을 따로 테스트할 수 없게 된다 (ARCHITECTURE A7).
 */
import { TAU } from '../core/math.ts'
import { makeRng } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { effectiveStats, stepArcher } from './bow.ts'
import { stepArrows } from './ballistics.ts'
import { stepTargets } from './target.ts'
import { TRAIL_POINTS } from './types.ts'
import type {
  ArcherState,
  Arrow,
  InputFrame,
  StageDef,
  Stats,
  Target,
  TargetSpec,
  World,
} from './types.ts'

/**
 * 화살 풀 여유분. 지급 화살 수만큼만 잡으면 뒤 챕터의 관통·연사 기믹에서 판 도중 재할당이 난다.
 * 판 중 할당 0 이 목표다 (ARCHITECTURE A5).
 */
const ARROW_POOL_SLACK = 4

/**
 * 궁수는 화면 왼쪽 지면 위에 선다. 활을 잡은 손은 사람 어깨 높이.
 * 레이아웃 상수라 손맛 노브는 아니지만, params.ts 에 world 그룹이 생기면 그리로 옮긴다.
 */
const ARCHER_X = 0
const ARCHER_HAND_Y = 1.4

/**
 * TargetSpec 이 반경·점수를 생략했을 때의 폴백.
 * 스테이지는 전부 명시하는 걸 원칙으로 하므로 평소엔 쓰이지 않는다.
 */
const FALLBACK_TARGET_R = 0.5
const FALLBACK_TARGET_SCORE = 100

// ───────────────────────────── 생성 ─────────────────────────────

function newArcher(): ArcherState {
  return {
    x: ARCHER_X,
    y: ARCHER_HAND_Y,
    phase: 'idle',
    aimAngle: 0,
    tremorOffset: 0,
    tremorAmp: 0,
    tremorPhase: 0,
    draw: 0,
    drawTime: 0,
    holdTime: 0,
    stamina: 0,
    staminaMax: 0,
    regenLock: 0,
    steadyTime: 0,
    steadyBlend: 0,
    warn: 0,
    strain: 0,
  }
}

function newArrow(): Arrow {
  return {
    alive: false,
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    age: 0,
    pierced: 0,
    outcome: 'expired',
    power: 0,
    // 궤적 버퍼는 화살 하나당 평생 한 번만 만든다. 발사할 때마다 만들면 GC가 프레임을 먹는다.
    trail: new Float32Array(TRAIL_POINTS * 2),
    trailLen: 0,
    trailHead: 0,
  }
}

function newTarget(): Target {
  return {
    id: 0,
    alive: false,
    kind: 'static',
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    r: FALLBACK_TARGET_R,
    baseX: 0,
    baseY: 0,
    ampX: 0,
    ampY: 0,
    freq: 0,
    falling: false,
    chainDepth: 0,
    score: FALLBACK_TARGET_SCORE,
  }
}

// ───────────────────────────── 제자리 초기화 ─────────────────────────────

function resetArcher(a: ArcherState, staminaMax: number): void {
  a.x = ARCHER_X
  a.y = ARCHER_HAND_Y
  a.phase = 'idle'
  a.aimAngle = 0
  a.tremorOffset = 0
  a.tremorAmp = 0
  a.tremorPhase = 0
  a.draw = 0
  a.drawTime = 0
  a.holdTime = 0
  a.staminaMax = staminaMax
  a.stamina = staminaMax
  a.regenLock = 0
  a.steadyTime = 0
  a.steadyBlend = 0
  a.warn = 0
  a.strain = 0
}

/**
 * 탭 이탈로 판이 멈출 때, 당기던 시위를 **발사 없이** 되돌린다.
 * 제약 C2: 아무 때나 끊어도 손해가 없다 — 공부하러 떠나는 순간에 게임이 화살을 태우면 안 된다.
 * (스텝 경계 밖에서 상태를 쓰는 함수다. M2에서 리플레이 녹화가 붙으면 입력 이벤트로 기록해야 A1이 유지된다.)
 */
export function cancelDraw(w: World): void {
  const a = w.archer
  if (a.phase !== 'drawing' && a.phase !== 'full') return
  // recovering 으로 둔다 — 버튼을 한 번 떼야 다시 잡는다 (bow.ts 의 연사 방지 규칙 재사용).
  a.phase = 'recovering'
  a.draw = 0
  a.drawTime = 0
  a.holdTime = 0
  a.steadyTime = 0
  a.steadyBlend = 0
  a.tremorAmp = 0
  a.tremorOffset = 0
}

/**
 * 판을 넘긴 그 눌림이 다음 판의 첫 발로 새지 않게, 버튼을 한 번 떼야 잡히는 상태로 둔다.
 * (bow.ts 의 `recovering && !drawing → idle` 규칙을 그대로 재사용한다 — 새 상태 필드가 필요 없다.)
 */
export function requireFreshPress(w: World): void {
  w.archer.phase = 'recovering'
}

/**
 * 자리를 비운 동안 팔은 쉬었다. 복귀 첫 클릭이 스태미나 부족으로 조용히 삼켜지면
 * "탭 복귀 후 3초 안에 첫 발"(C1)이 깨진다. 실시간을 sim으로 몰아 돌리지 않고(A3),
 * 스텝 밖에서 상태만 되돌린다.
 * (cancelDraw 와 같이, M2에서 리플레이 녹화가 붙으면 반드시 입력 이벤트로 기록해야 A1이 유지된다.)
 */
export function restArcher(w: World): void {
  w.archer.stamina = w.archer.staminaMax
  w.archer.regenLock = 0
}

function resetArrow(a: Arrow): void {
  a.alive = false
  a.x = 0
  a.y = 0
  a.px = 0
  a.py = 0
  a.vx = 0
  a.vy = 0
  a.angle = 0
  a.age = 0
  a.pierced = 0
  a.outcome = 'expired'
  a.power = 0
  // trail 버퍼 자체는 재사용한다(할당 0). 다만 내용물까지 지운다 —
  // trailLen=0 이라 렌더는 안 읽지만, 남은 이전 판 좌표가 월드 해시를 흔들어
  // 리플레이 검증이 "같은 판인데 다르다"고 오판한다. 판당 1회라 비용은 없다.
  a.trail.fill(0)
  a.trailLen = 0
  a.trailHead = 0
}

function loadTarget(t: Target, id: number, spec: TargetSpec): void {
  t.id = id
  t.alive = true
  t.kind = spec.kind
  t.x = spec.x
  t.y = spec.y
  t.px = spec.x
  t.py = spec.y
  t.vx = 0
  t.vy = 0
  t.r = spec.r ?? FALLBACK_TARGET_R
  t.baseX = spec.x
  t.baseY = spec.y
  t.ampX = spec.ampX ?? 0
  t.ampY = spec.ampY ?? 0
  t.freq = spec.freq ?? 0
  t.falling = false
  t.chainDepth = 0
  t.score = spec.score ?? FALLBACK_TARGET_SCORE
}

function clearTarget(t: Target): void {
  t.alive = false
  t.falling = false
  t.chainDepth = 0
  t.vx = 0
  t.vy = 0
}

/** 풀은 늘리기만 한다. 줄이면 다음 판에서 다시 할당이 난다. */
function growArrows(w: World, want: number): void {
  while (w.arrows.length < want) w.arrows.push(newArrow())
}

function growTargets(w: World, want: number): void {
  while (w.targets.length < want) w.targets.push(newTarget())
}

// ───────────────────────────── 공개 API ─────────────────────────────

export function createWorld(stage: StageDef, stats: Stats): World {
  const w: World = {
    tick: 0,
    dt: 1 / P.sim.hz,
    rng: makeRng(stage.seed),
    status: 'playing',
    archer: newArcher(),
    stats: { str: stats.str, steady: stats.steady, stamina: stats.stamina, focus: stats.focus },
    arrows: [],
    targets: [],
    wind: 0,
    windPhase: 0,
    arrowsLeft: stage.arrows,
    score: 0,
    combo: 0,
    elapsed: 0,
    stage,
    events: [],
  }
  // 풀 할당과 초기화는 resetWorld 한 곳에만 둔다. 두 벌로 갈라지면 반드시 어긋난다.
  resetWorld(w, stage, stats)
  return w
}

/**
 * 판 재시작. **새 World 를 만들지 않는다.**
 * R 키 연타로 매번 객체를 새로 만들면 GC 가 프레임을 끊어먹는다 (A5).
 */
export function resetWorld(w: World, stage: StageDef, stats: Stats): void {
  const derived = effectiveStats(stats)

  w.tick = 0
  // hz 는 튜닝 콘솔에서 바뀔 수 있다. 판 시작마다 다시 읽어야 슬라이더가 먹는다.
  w.dt = 1 / P.sim.hz
  // 같은 시드 = 같은 판 (A1). Rng 객체를 새로 만들지 않고 상태만 되감는다.
  w.rng.restore(stage.seed)
  w.status = 'playing'
  w.stage = stage

  w.stats.str = stats.str
  w.stats.steady = stats.steady
  w.stats.stamina = stats.stamina
  w.stats.focus = stats.focus
  resetArcher(w.archer, derived.staminaMax)

  growArrows(w, stage.arrows + ARROW_POOL_SLACK)
  for (let i = 0; i < w.arrows.length; i++) {
    const a = w.arrows[i]
    if (a !== undefined) resetArrow(a)
  }

  const specs = stage.targets
  growTargets(w, specs.length)
  for (let i = 0; i < w.targets.length; i++) {
    const t = w.targets[i]
    if (t === undefined) continue
    const spec = specs[i]
    if (spec === undefined) clearTarget(t)
    else loadTarget(t, i, spec)
  }

  w.wind = 0
  w.windPhase = 0
  w.arrowsLeft = stage.arrows
  w.score = 0
  w.combo = 0
  w.elapsed = 0
  w.events.length = 0
}

/**
 * 정확히 1 고정스텝. 호출 순서가 결과를 바꾼다 — 궁수가 쏜 화살이 같은 스텝에 날고,
 * 그 화살이 같은 스텝에 과녁을 친다. 순서를 뒤집으면 한 스텝씩 밀린 반응이 되어 손맛이 죽는다.
 *
 * arrowsLeft 는 **여기서 건드리지 않는다.** 감소는 ballistics.spawnArrow 가 풀에서 화살을
 * 실제로 꺼내는 데 성공한 시점에만 일어난다. 발사 실패(풀 고갈)에 잔량이 줄면 안 되기 때문.
 */
export function step(w: World, input: InputFrame): void {
  const playing = w.status === 'playing'
  // 이번 스텝에 새로 생긴 이벤트만 훑기 위한 표식. 소비자가 아직 안 비웠을 수 있어
  // 배열 전체를 보면 지난 스텝 miss 로 콤보를 두 번 끊게 된다.
  const evStart = w.events.length

  w.tick++
  w.elapsed += w.dt

  // 바람은 읽을 수 있어야 한다. 매 스텝 난수로 흔들면 실력이 아니라 운이 된다.
  // 부드러운 주기 변동만 주어, 깃발을 보고 기다렸다 쏘는 판단이 성립하게 한다.
  w.windPhase += w.dt
  w.wind =
    w.stage.wind *
    (1 + Math.sin(w.windPhase * TAU * P.wind.gustFreq) * P.wind.gustAmp) *
    P.wind.effect

  // 판이 끝나도 화살·과녁 물리는 계속 돈다. 마지막 화살의 연쇄가 잘리면 손맛이 죽는다.
  // 대신 궁수 입력과 종료 판정은 건너뛴다 → stage_end 는 전이 시점 1회뿐이다.
  if (playing) stepArcher(w, input)
  stepArrows(w)
  stepTargets(w)

  // 명중 없이 소멸한 화살은 연쇄를 끊는다.
  for (let i = evStart; i < w.events.length; i++) {
    const ev = w.events[i]
    if (ev !== undefined && ev.t === 'miss') w.combo = 0
  }

  if (playing) evaluateEnd(w)
}

// ───────────────────────────── 종료 판정 ─────────────────────────────

/** 아직 결과가 뒤집힐 수 있는 화살이 남았는가. 착지 후 잔상만 남은 화살은 세지 않는다. */
function anyArrowInPlay(w: World): boolean {
  for (let i = 0; i < w.arrows.length; i++) {
    const a = w.arrows[i]
    if (a !== undefined && a.alive && a.outcome === 'flying') return true
  }
  return false
}

/** 낙하 중인 공중 과녁은 아래를 연쇄로 칠 수 있다. 끝난 게 아니다. */
function anyTargetFalling(w: World): boolean {
  for (let i = 0; i < w.targets.length; i++) {
    const t = w.targets[i]
    if (t !== undefined && t.alive && t.falling) return true
  }
  return false
}

/**
 * 결과가 더 뒤집힐 여지가 없는가. 판 종료 정산은 이게 true가 된 뒤에 한다.
 *
 * 왜: evaluateEnd는 클리어를 **즉시** 판정한다(마지막 순간에 목표를 넘겼는데 시간 초과로
 * 실패하면 배신감이 남기 때문). 그래서 status가 넘어간 뒤에도 화살과 낙하 과녁은 계속 돌고
 * 점수가 더 오른다 — 그 프레임에 스냅샷을 뜨면 연쇄 점수가 통째로 기록에서 빠진다.
 */
export function isSettled(w: World): boolean {
  return !anyArrowInPlay(w) && !anyTargetFalling(w)
}

function endStage(w: World, cleared: boolean): void {
  w.status = cleared ? 'cleared' : 'failed'
  w.events.push({ t: 'stage_end', cleared, score: w.score })
}

function evaluateEnd(w: World): void {
  // 클리어를 먼저 본다. 마지막 순간에 목표를 넘겼는데 시간 초과로 실패하면 배신감이 남는다.
  if (w.score >= w.stage.targetScore) {
    endStage(w, true)
    return
  }

  const limit = w.stage.timeLimit
  if (limit !== undefined && w.elapsed >= limit) {
    endStage(w, false)
    return
  }

  // 화살이 다 떨어져도 날아가는 중이거나 연쇄가 진행 중이면 아직 실패가 아니다.
  if (w.arrowsLeft <= 0 && !anyArrowInPlay(w) && !anyTargetFalling(w)) {
    endStage(w, false)
  }
}
