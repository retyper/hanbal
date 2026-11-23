/**
 * 열전 장수 몸놀림 (62-A · 11-21 형: 「걷는 거랑 공격이 부자연스럽다」) — 그리는 쪽 기억만. 판(haebi.ts)은 읽기만 한다.
 * 숫자는 모두 HAEBI_ANIM(params.ts). 시계는 판 초(s.t) — 같은 판 같은 시각엔 기억을 한 번만 고친다(몸·각성 빛·잔상이 여러 번 물어도).
 *
 * - 공격: 칸마다 다른 시간(휘두름 아주 짧게 · 맞힘 칸 멈춤 · 마무리 천천히) + 적 쪽 런지 · 휘두름 가로 늘임 · 잔상.
 *   판은 공격이 서는 걸음에 곧바로 피해를 주므로 서는 순간이 휘두름이다. 예비는 다음 공격 직전에만(한 번 친 뒤 · 서 있을 때).
 * - 걷기: 걸은 거리로 넘기는 칸(발 미끄러짐 없음 · 공격 중에도 거리를 센다) + 걸음에 맞춘 출렁 · 걷는 쪽 기울기 · 멈출 때 한 박 늦게 서기.
 */
import { HAEBI_ANIM as A, HAEBI_RUN as C } from '../tune/params.ts'
import { KITS, type HaebiRun, type Kit } from './haebi.ts'
import { planFrame, type IdlePlan } from './hero-idle.ts'

/** 공격 칸 역할 한 벌 (params HAEBI_ANIM.roles) */
export type AttackRole = (typeof A.roles)[keyof typeof A.roles]
export const attackRole = (kit: Kit): AttackRole => (A.drawKits as readonly string[]).includes(kit) ? A.roles.draw : A.roles.strike

/** 한 프레임의 장수 그림 — 칸과 그릴 때만 쓰는 몸 변형. 판 좌표·그림자·맞는 자리는 그대로 */
export interface HeroPose {
  frame: number
  /** 그림을 옆으로 옮김(px) · 가로/세로 늘임(발 기준) · 기울기(탄젠트 · 양수면 위가 +x 쪽) · 그릴 방향 */
  dx: number; sx: number; sy: number; lean: number; face: number
  /** 잔상 — 칸 · 개수 · 첫 진하기 · 한 장마다 옮김(px · 부호가 방향) */
  ghostFrame: number; ghosts: number; ghostAlpha: number; ghostStep: number
}
export interface PoseOptions {
  /** 걷기 한 바퀴에 몸이 나아가는 거리(px) · 걷기 칸 수 */
  stride: number; cells: number
  /** 맞은 순간 멈춤 중(RaidFeel.stopped) · 몸 변형 끔(움직임 줄이기 설정·판 끝 연출) · 저사양(잔상 끔) */
  stopped?: boolean; still?: boolean; low?: boolean
  /** 띠의 서기 계획과 씨앗 (hero-idle.ts · 없으면 예전 서기) · calm 움직임 줄이기 — 서기 base 칸만 */
  idle?: { plan: IdlePlan; seed: number } | undefined; calm?: boolean
}

interface Memo {
  t: number; x: number; y: number
  /** 걷기 바퀴(걸은 거리 ÷ stride) · 기울기 · 마지막으로 움직인 판 시각 · 마지막 걸음 칸과 그때 출렁 */
  phase: number; lean: number; movedAt: number; walkFrame: number; walkSy: number
  /** 주 무기 쿨다운(지난 관측) · 마지막으로 친 판 시각 · 그때 적 쪽 · 친 순간 가장 가까운 적 거리의 최댓값 */
  cool: number; struckAt: number; aim: number; reach: number
  /** 맞은 순간 멈춤에 맞힘 칸을 이미 보인 공격(시작 판 시각) · 예비를 마지막으로 보인 판 시각 */
  heldStart: number; anticAt: number
  /** 마지막으로 서기가 아닌 그림(걷기·공격·맞음·시전·예비·멈춰 서기)을 보인 판 시각 — 서기 시계는 여기서부터 · idling 이번 그림이 서기였나 */
  busyAt: number; idling: boolean
}
const memos = new WeakMap<HaebiRun, Memo>()
const fresh = (s: HaebiRun): Memo => ({ t: s.t, x: s.x, y: s.y, phase: 0, lean: 0, movedAt: -Infinity, walkFrame: -1, walkSy: 1,
  cool: primaryCool(s), struckAt: -Infinity, aim: s.face, reach: 0, heldStart: -Infinity, anticAt: -Infinity, busyAt: -Infinity, idling: false })
/** 주 무기 쿨다운 — 쿨다운 칸 이름은 주 무기 이름과 같다(KITS[kit].primary · 방울은 bell) */
function primaryCool(s: HaebiRun) { return s.cool[KITS[s.kit].primary as keyof HaebiRun['cool']] }
/** 판이 겨누는 적(가장 가까운 산 적)과 거리 — 판의 nearest 와 같은 셈(가운데 거리) */
function nearestFoe(s: HaebiRun) {
  let best: HaebiRun['enemies'][number] | null = null, d = Infinity
  for (const e of s.enemies) { if (e.hp <= 0) continue; const k = Math.hypot(e.x - s.x, e.y - s.y); if (k < d) { d = k; best = e } }
  return best ? { x: best.x, d } : null
}
/** 같은 공격의 시작 판 시각 비교 — t 와 attack 이 같은 dt 로 움직여 뜨는 수 오차만 남는다 */
const SAME = 1e-6
/** 서기 칸 (판 시각으로 넘김) */
export const idleFrame = (t: number) => A.idle[Math.floor(t / A.idleTime) % A.idle.length]!
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const easeOut = (k: number) => 1 - (1 - k) * (1 - k)
const smooth = (k: number) => k * k * (3 - 2 * k)

/** 판 시각이 흐를 때만 기억을 고친다 — 새 판·되감기는 새로 · 순간 이동(비기 돌진 등)은 걷기 바퀴를 처음부터 */
function observe(s: HaebiRun, stride: number): Memo {
  let m = memos.get(s)
  if (!m || s.t < m.t) { m = fresh(s); memos.set(s, m); return m }
  if (s.t === m.t) return m
  const dt = s.t - m.t, dx = s.x - m.x, d = Math.hypot(dx, s.y - m.y), jump = d > C.heroPx
  m.phase = jump ? 0 : m.phase + d / stride
  const want = s.moving && !jump ? A.lean * clamp(dx / dt / C.speed, -1, 1) : 0
  m.lean += (want - m.lean) * (1 - Math.exp(-dt / A.leanTau))
  if (s.moving) m.movedAt = s.t
  const cool = primaryCool(s)
  if (cool > m.cool) {
    // 주 무기가 섰다 (쿨다운이 다시 찼다) — 겨눈 쪽과 거리를 적어 둔다 (비기의 attack 은 쿨다운을 건드리지 않아 여기 안 온다)
    const foe = nearestFoe(s)
    m.struckAt = s.t - Math.max(0, A.window - s.attack); m.aim = foe ? Math.sign(foe.x - s.x) || s.face : s.face
    if (foe) m.reach = Math.max(m.reach, foe.d)
  }
  m.cool = cool; m.t = s.t; m.x = s.x; m.y = s.y
  return m
}

/** 공격 칸 — 서고 나서 age 판 초. moving 이면 마무리를 줄이고, 그 뒤는 null(걷기로) */
export function attackFrame(role: AttackRole, age: number, moving = false, held = false): number | null {
  const sw = role.swing.length ? A.swing : 0, c1 = sw + A.contact
  if (age < sw && !held) return role.swing[Math.min(role.swing.length - 1, Math.floor(age / sw * role.swing.length))]!
  if (age < c1) return role.contact
  const end = moving ? Math.min(A.window, c1 + A.moveRecover) : A.window
  if (age >= end) return null
  const k = (age - c1) / (end - c1)
  return role.recover[k < A.recoverSplit || role.recover.length < 2 ? 0 : role.recover.length - 1]!
}

const neutral = (frame: number, face: number, lean: number): HeroPose => ({ frame, dx: 0, sx: 1, sy: 1, lean, face, ghostFrame: -1, ghosts: 0, ghostAlpha: 0, ghostStep: 0 })
/** 판 상태 → 이 프레임의 장수 그림. 기억(걷기 바퀴·기울기·예비)은 판 시각이 흐를 때만 고친다 */
export function heroPose(s: HaebiRun, o: PoseOptions): HeroPose {
  const m = observe(s, o.stride), role = attackRole(s.kit)
  m.idling = false
  const pose = heroPoseOf(s, m, role, o)
  if (!m.idling) m.busyAt = s.t
  if (o.still) { pose.dx = 0; pose.sx = pose.sy = 1; pose.lean = 0; pose.ghosts = 0 }
  if (o.low) pose.ghosts = 0
  return pose
}
function heroPoseOf(s: HaebiRun, m: Memo, role: AttackRole, o: PoseOptions): HeroPose {
  if (s.hurt > 0) return neutral(A.hurtCell, s.face, m.lean)
  if (s.cast?.kind === 'ult') return neutral(A.castCell, s.face, m.lean)
  const age = A.window - s.attack, start = s.t - age, sw = role.swing.length ? A.swing : 0, c1 = sw + A.contact
  // 이번 공격이 주 무기로 선 것이면 그때 적 쪽 · 아니면(비기 끝 등) 판의 방향
  const aim = s.attack > 0 && Math.abs(m.struckAt - start) < SAME ? m.aim : s.face
  if (s.attack > 0 && age < c1) {
    // 맞은 순간 멈춤(49) 동안은 맞힘 칸에 머문다 — 풀린 뒤 휘두름 칸으로 되돌아가지 않게 기억한다
    if (o.stopped) m.heldStart = start
    const held = Math.abs(m.heldStart - start) < SAME
    const frame = attackFrame(role, age, false, held)!, swinging = age < sw && !held
    const reach = swinging ? easeOut(age / sw) : 1, fade = 1 - clamp(age / c1, 0, 1)
    return { frame, dx: aim * A.lunge[s.kit] * reach, sx: 1 + role.stretch * (swinging ? 1 : fade), sy: 1, lean: m.lean, face: aim,
      ghostFrame: role.swing.length ? role.swing[role.swing.length - 1]! : -1, ghosts: role.swing.length ? A.ghosts : 0, ghostAlpha: A.ghostAlpha * fade, ghostStep: -aim * A.ghostGap }
  }
  // 다음 공격 예비 — 한 번 친 뒤 · 서 있고 · 쿨다운 끝 무렵 · 가장 가까운 적이 친 적 있는 거리 안
  const cool = primaryCool(s)
  if (!s.moving && !s.dash && s.state === 'playing' && cool > 0 && cool <= role.anticTime && m.struckAt > -Infinity) {
    const foe = nearestFoe(s)
    if (foe && foe.d <= m.reach * A.anticReach + A.anticPad) {
      const k = 1 - cool / role.anticTime, face = Math.sign(foe.x - s.x) || s.face
      m.anticAt = s.t
      return { ...neutral(role.antic[Math.min(role.antic.length - 1, Math.floor(k * role.antic.length))]!, face, m.lean), dx: -face * A.anticPull * k }
    }
  }
  if (s.attack > 0) {
    const frame = attackFrame(role, age, s.moving)
    if (frame !== null) {
      const back = smooth(clamp((age - c1) / ((s.moving ? Math.min(A.window, c1 + A.moveRecover) : A.window) - c1), 0, 1))
      return { ...neutral(frame, s.face, m.lean), dx: aim * A.lunge[s.kit] * (1 - back) }
    }
  }
  // 예비가 빗나감(쿨다운이 끝났는데 안 침) — 준비 칸에 잠깐 머물다 선다
  if (!s.moving && s.t - m.anticAt < A.anticCancel) return neutral(role.ready, s.face, m.lean)
  if (s.moving) {
    const n = Math.max(1, o.cells), p = m.phase - Math.floor(m.phase)
    const frame = A.walkCell + Math.floor(p * n) % n, sy = 1 - A.bob * (n > A.bobCells ? A.bobRich : 1) * Math.cos(4 * Math.PI * p)
    m.walkFrame = frame; m.walkSy = sy
    return { ...neutral(frame, s.face, m.lean), sy }
  }
  // 멈춤: 한 박 늦게 서기 — 마지막 걸음 칸에 머물며 출렁을 거둔다
  const since = s.t - m.movedAt
  if (m.walkFrame >= 0 && since < A.settle) return { ...neutral(m.walkFrame, s.face, m.lean), sy: 1 + (m.walkSy - 1) * (1 - since / A.settle) }
  m.idling = true
  // 서기 계획이 있는 띠는 쉬기 시작한 뒤 시계로 (멈추자마자 버릇이 튀지 않게) · 없으면 예전 그대로 판 시각
  return neutral(o.idle ? planFrame(o.idle.plan, o.idle.seed, m.busyAt > -Infinity ? s.t - m.busyAt : s.t, o.calm) : idleFrame(s.t), s.face, m.lean)
}
