/**
 * 55 불타는 산성 거대 보스 「불의 무녀 장군」 — 판(sim) 쪽 (docs/realm/BOSS.md 무녀 장군 표 · 무무와 장수를 섞은 창작 인물).
 * 몸 준비 → 붉은 바닥(고정) → 타격 → 머리 노출 회복 · 막 1→2→3 · 부채 팔·방울 팔·허리 장식이 부서지면 그 수가 봉인된다.
 * 사람 꼴이라 뼈 대신 자세 넷(Codex 72 몸 판)을 바꿔 가며 숨·기울임·원무(도는 바퀴)를 얹는다 —
 * 판정 자리는 그 자세 그림의 원본 px(HAEBI_SHAMAN.rig)를 shamanPoint 하나로 옮긴 것이고, 그림(shaman-view.ts)도 같은 변환으로 그린다.
 * 이무기·백두 대호와 같은 공통 계약: giant-core 의 접촉·겹침·고정 예고, imugi.safeLanding(닿을 수 있는 3P 빈 원), HAEBI_GIANT 의 막·분노·환경 박자.
 * DOM·벽시계·Math.random 없음 — 난수는 판의 seeded random 하나 (수 고르기 · 정지 초 · 고리의 빈 곳 · 불기둥 놓임).
 */
import { HAEBI_GIANT as G, HAEBI_SHAMAN as S, HAEBI_RUN as C } from '../tune/params.ts'
import { freezeTell, overlaps, pickContact, sweepContact, type Collider, type Contact, type ImugiPose, type PartPose, type Point, type Shape } from './giant-core.ts'
import type { GiantOwner } from './imugi.ts'

export const SHAMAN_PARTS = ['root', 'skirt', 'head', 'waist', 'fan', 'bell'] as const
export type ShamanPartId = typeof SHAMAN_PARTS[number]
/** 따로 체력을 갖는 부위 (몸통·치마는 본체 그 자체) */
export const SHAMAN_HP = ['head', 'fan', 'bell', 'waist'] as const
export type ShamanHp = typeof SHAMAN_HP[number]
export type ShamanMove = keyof typeof S.moves
export type ShamanKey = 0 | 1 | 2 | 3
export const SHAMAN_MOVES = Object.keys(S.moves) as ShamanMove[]
export const shamanHpOf = (id: ShamanPartId): ShamanHp | null => id === 'root' || id === 'skirt' ? null : id
const PARENT: Record<ShamanPartId, ShamanPartId | null> = { root: null, skirt: 'root', head: 'root', waist: 'root', fan: 'root', bell: 'root' }
/** 같은 거리일 때 먼저 맞는 부위 — 약점(머리) · 부채 팔 · 방울 팔 · 허리 장식 · 몸통 · 치마 */
const RANK: Record<ShamanPartId, number> = { head: 0, fan: 1, bell: 2, waist: 3, root: 4, skirt: 5 }
export const shamanRank = (id: ShamanPartId) => RANK[id]
/** 이 부위가 부서져 있으면 못 쓰는 수 (BOSS.md 「파괴 시 봉인」 · 선회 쌍타는 어느 팔이든) */
export const SHAMAN_REQUIRES: Readonly<Record<ShamanMove, readonly ShamanHp[]>> = { sweep: ['fan'], ring: ['waist'], pillars: ['fan'], chase: ['bell'], twin: ['fan', 'bell'], pulse: ['bell'] }

/** 한 틱의 자세 — key 자세 그림 · lean 앞 숙임 · lift 아래로 px · squash 키 늘임 · spin 원무 바퀴 · turn 돌아섬(가로로 눌림) · flare 옷자락 펼침 · rise 불 속에서 드러난 몫 */
export interface ShamanFrame { x: number; y: number; facing: 1 | -1; key: ShamanKey; lean: number; lift: number; squash: number; spin: number; turn: number; flare: number; rise: number }
export interface ShamanPose extends ImugiPose<ShamanPartId> { readonly kind: 'shaman'; readonly facing: 1 | -1; readonly anchor: Point; readonly frame: Readonly<ShamanFrame> }
export interface ShamanWindup { readonly body: number; readonly hold: number; readonly red: number; readonly total: number; readonly use: number }
/** 한 타 — 붉은 모양 · 붉은 바닥 초 · 몸놀림 초 · 판정 몫 · 피해 · 몸이 그 타 동안 가는 자세(from → to) */
export interface ShamanSub { readonly shapes: readonly Shape[]; readonly red: number; readonly strike: number; readonly impactAt: number; readonly damage: number; readonly from: ShamanFrame; readonly to: ShamanFrame; hit: boolean }
export interface ShamanAttack {
  windup: Readonly<ShamanWindup>; seq: number; move: ShamanMove; requires: readonly ShamanHp[]
  subs: ShamanSub[]; sub: number; shapes: readonly Shape[]; pending: boolean; cut: boolean; recover: number
  /** 화염 맥동: 띠 차례 (왼 → 오른) · 지금 타는 띠 · k 번째 띠부터 남은 붉은 바닥 (이미 탄 띠는 더 붉지 않다) */
  bands?: readonly (readonly Shape[])[]; activeShapes?: readonly Shape[]; tails?: readonly (readonly Shape[])[]
  /** 원무 지연 화선: 빈 곳 방향 · 늦은 불기둥: 원 가운데 · 세 걸음 추격: 발이 지나는 자리(시작 + 줄 끝 셋) */
  gap?: number; centers?: readonly Point[]; path?: readonly Point[]
}
export interface ShamanMotion { move: ShamanMove | null; from: ShamanFrame; prepared: ShamanFrame; relaxed: ShamanFrame; current: ShamanFrame; recoverFrom: ShamanFrame; recoverSeconds: number; progress: number; blocked: boolean; walk: number; stepTo: Point | null }
export interface ShamanState {
  kind: 'shaman'; phase: 1 | 2 | 3; state: 'entry' | 'body' | 'hold' | 'tell' | 'strike' | 'recover' | 'roar' | 'step' | 'dead'; pattern: ShamanMove | null
  seq: number; age: number; timer: number; enraged: boolean; last: ShamanMove | null; recoveryHitUsed: boolean; stagger: number; submerge: number
  windupUses: Partial<Record<ShamanMove, number>>; brokenSeen: ShamanHp[]; brokenAt: Partial<Record<ShamanHp, number>>
  partHP: Record<ShamanHp, number>; partMax: Record<ShamanHp, number>; pose: ShamanPose; motion: ShamanMotion; attack: ShamanAttack | null
  environment: { phase: 1 | 2 | 3; shapes: readonly Shape[]; age: number; active: boolean; nextHit: number }
  bounds: { left: number; top: number; right: number; bottom: number }; lastHitPart: ShamanPartId; poisonPart: ShamanPartId
  /** 그림이 옛 자세를 옅게 지우는 데 쓴다 — 마지막으로 바뀐 자세 · 바뀐 판 시각 (판 셈과 무관) */
  keyNow: ShamanKey; keyFrom: ShamanKey; keyAt: number
}

const W = C.width, H = C.height, K = S.rig.scale, M = S.motion, TAU = Math.PI * 2
const point = (x: number, y: number): Point => ({ x, y })
const unit = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => { const t = unit(x); return t * t * (3 - 2 * t) }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
function deepFreeze<V>(v: V): V { if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) { for (const x of Object.values(v)) deepFreeze(x); Object.freeze(v) } return v }
const frozen = (shapes: readonly Shape[]): readonly Shape[] => Object.freeze(shapes.map(freezeTell))
const box = (x: number, y: number, halfX: number, halfY: number, angle = 0): Shape => ({ kind: 'box', center: point(x, y), halfX, halfY, angle })
/** 가운데 세로 안전 길 [왼, 오른] */
export const shamanLane = (): readonly [number, number] => [W / 2 - S.lane / 2, W / 2 + S.lane / 2]

// ── 자세 → 판 좌표 (판정과 그림이 같은 셈) ──
type XY = readonly [number, number]
type Spec = { readonly key: number; readonly lean: number; readonly lift: number; readonly squash: number; readonly spin: number; readonly flare: number }
/** 가로 몫 — 원무(cos)·돌아섬·키 늘임의 부피 · 0 을 지나면 좌우가 뒤집힌다 */
export const shamanSx = (f: ShamanFrame) => Math.cos(f.spin * TAU) * (1 - f.squash * .5) * (1 - f.turn * .85)
export const shamanSy = (f: ShamanFrame) => 1 + f.squash
/** 자세 그림의 원본 px → 판 좌표: 발 기준 · scale · 가로/세로 몫 · 발을 축으로 기울임 · 좌우 · 들림 (그림은 같은 차례로 캔버스를 옮긴다) */
export function shamanPoint(f: ShamanFrame, p: XY): Point {
  const feet = S.rig.keys[f.key]!.feet, dx = (p[0] - feet[0]) * K * shamanSx(f), dy = (p[1] - feet[1]) * K * shamanSy(f)
  const c = Math.cos(f.lean), s = Math.sin(f.lean)
  return point(f.x + f.facing * (dx * c - dy * s), f.y + f.lift + dx * s + dy * c)
}
function frameOf(x: number, y: number, facing: 1 | -1, s: Spec): ShamanFrame {
  return { x, y, facing, key: s.key as ShamanKey, lean: s.lean, lift: s.lift, squash: s.squash, spin: s.spin, turn: 0, flare: s.flare, rise: 1 }
}
/** 시험·검수: params 자세 이름으로 판 자세를 만든다 */
export const shamanFrame = (x: number, y: number, facing: 1 | -1, s: Spec) => frameOf(x, y, facing, s)
const restAt = (x: number, y: number, facing: 1 | -1) => frameOf(x, y, facing, M.rest)
/** 돌아선 바퀴는 셈에서 지운다 (원무 두 바퀴 뒤 회복에서 거꾸로 두 바퀴 돌지 않게) */
const settled = (f: ShamanFrame): ShamanFrame => ({ ...f, spin: f.spin - Math.floor(f.spin), turn: 0 })
function blend(a: ShamanFrame, b: ShamanFrame, t: number): ShamanFrame {
  const k = smooth(t), l = (x: number, y: number) => lerp(x, y, k), turning = a.facing !== b.facing
  return { x: l(a.x, b.x), y: l(a.y, b.y), facing: turning && k < .5 ? a.facing : b.facing, key: k < S.keySwitch ? a.key : b.key, lean: l(a.lean, b.lean), lift: l(a.lift, b.lift), squash: l(a.squash, b.squash),
    spin: l(a.spin, b.spin), turn: turning ? 1 - Math.abs(2 * k - 1) : l(a.turn, b.turn), flare: l(a.flare, b.flare), rise: l(a.rise, b.rise) }
}
interface PoseFlags { ownerId: number; tick: number; alive: boolean; targetable: boolean; recovering: boolean; partHP: Readonly<Record<ShamanHp, number>> }
/** 판정 부위(collider) — 그림과 같은 점 · 부서진 팔은 그을린 채 남고(안 맞는다) 허리 장식은 떨어져 사라진다 */
export function makeShamanPose(f: ShamanFrame, o: PoseFlags): ShamanPose {
  const rig = S.rig.keys[f.key]!, P = (p: XY) => shamanPoint(f, p), A = f.facing === 1 ? f.lean : -f.lean, sy = shamanSy(f), parts: PartPose<ShamanPartId>[] = []
  const cap = (s: readonly [XY, XY, number]): Collider => ({ kind: 'capsule', from: P(s[0]), to: P(s[1]), radius: s[2] * K })
  const ell = (e: readonly [number, number, number, number]): Collider => ({ kind: 'ellipse', center: P([e[0], e[1]]), rx: e[2] * K, ry: e[3] * K * sy, angle: A })
  const put = (id: ShamanPartId, collider: Collider) => {
    const key = shamanHpOf(id), damaged = key !== null && o.partHP[key] <= 0, severed = damaged && id !== 'head', shown = o.alive && !(id === 'waist' && damaged)
    const [start, end] = collider.kind === 'capsule' ? [collider.from, collider.to] : [collider.center, collider.center]
    parts.push({ id, parent: PARENT[id], start, end, angle: A, mirrorY: f.facing, alive: o.alive, broken: severed, damaged, visible: shown, targetable: shown && !severed && o.targetable && f.rise >= 1, height: 0, widthScale: 1, collider })
  }
  put('root', cap(rig.torso)); put('skirt', cap(rig.skirt)); put('head', ell(rig.head)); put('waist', ell(rig.waist)); put('fan', cap(rig.fan)); put('bell', cap(rig.bell))
  const anchor = point(f.x, f.y)
  return deepFreeze({ kind: 'shaman' as const, ownerId: o.ownerId, tick: o.tick, parts, worldGeometry: { parts: parts.map(p => ({ id: p.id, shape: p.collider })), tell: [] as Shape[] }, jawOpen: 0, recovering: o.recovering, facing: f.facing, anchor, frame: { ...f } })
}
export function shamanCollisionBounds(pose: ShamanPose) {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  for (const p of pose.parts) {
    if (!p.visible) continue
    const c = p.collider
    if (c.kind === 'capsule') { left = Math.min(left, c.from.x - c.radius, c.to.x - c.radius); right = Math.max(right, c.from.x + c.radius, c.to.x + c.radius); top = Math.min(top, c.from.y - c.radius, c.to.y - c.radius); bottom = Math.max(bottom, c.from.y + c.radius, c.to.y + c.radius) }
    else { const rx = Math.hypot(c.rx * Math.cos(c.angle), c.ry * Math.sin(c.angle)), ry = Math.hypot(c.rx * Math.sin(c.angle), c.ry * Math.cos(c.angle)); left = Math.min(left, c.center.x - rx); right = Math.max(right, c.center.x + rx); top = Math.min(top, c.center.y - ry); bottom = Math.max(bottom, c.center.y + ry) }
  }
  return Number.isFinite(left) ? { left, top, right, bottom } : { left: pose.anchor.x, top: pose.anchor.y, right: pose.anchor.x, bottom: pose.anchor.y }
}

// ── 상태 ──
/** 막별 환경 불 — 막1 바깥 불띠 · 막2 끊긴 화선 · 막3 양옆 불벽 (가운데 세로 길은 늘 빈다) */
export function shamanEnvironment(phase: 1 | 2 | 3): ShamanState['environment'] {
  const E = S.env, [laneL] = shamanLane()
  let shapes: Shape[]
  if (phase === 1) {
    const side = (W - E.gap) / 4, b = E.border
    shapes = [{ kind: 'union', shapes: [box(side, b / 2, side, b / 2), box(W - side, b / 2, side, b / 2), box(side, H - b / 2, side, b / 2), box(W - side, H - b / 2, side, b / 2), box(b / 2, H / 2, b / 2, H / 2), box(W - b / 2, H / 2, b / 2, H / 2)] }]
  } else if (phase === 2) {
    const reach = laneL - E.lineGap
    shapes = [{ kind: 'union', shapes: E.lines.flatMap(y => [box(reach / 2, y * H, reach / 2, E.lineWidth / 2), box(W - reach / 2, y * H, reach / 2, E.lineWidth / 2)]) }]
  } else shapes = [{ kind: 'union', shapes: [box(E.walls / 2, H / 2, E.walls / 2, H / 2), box(W - E.walls / 2, H / 2, E.walls / 2, H / 2)] }]
  return { phase, shapes: frozen(shapes), age: 0, active: false, nextHit: 0 }
}
const flags = (g: ShamanState, e: GiantOwner, tick: number, planning = false): PoseFlags => ({ ownerId: e.id, tick, alive: e.hp > 0 && g.state !== 'dead', targetable: planning || g.state !== 'entry', recovering: g.state === 'recover', partHP: g.partHP })
const poseOf = (g: ShamanState, e: GiantOwner, f: ShamanFrame, tick: number, planning = false) => makeShamanPose(f, flags(g, e, tick, planning))
/**
 * 수를 세워 볼 때 쓰는 판정 부위 경계 — shamanCollisionBounds(makeShamanPose(…)) 와 같은 셈 · 같은 값 (부위 그릇을 만들고 얼리지 않아 결정하는 틱이 가볍다)
 */
export function shamanFrameBounds(g: ShamanState, e: GiantOwner, f: ShamanFrame): { left: number; top: number; right: number; bottom: number } {
  if (!(e.hp > 0 && g.state !== 'dead')) return { left: f.x, top: f.y, right: f.x, bottom: f.y }
  const rig = S.rig.keys[f.key]!, A = f.facing === 1 ? f.lean : -f.lean, sy = shamanSy(f)
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  const cap = (s: readonly [XY, XY, number]) => { const a = shamanPoint(f, s[0]), b = shamanPoint(f, s[1]), r = s[2] * K; left = Math.min(left, a.x - r, b.x - r); right = Math.max(right, a.x + r, b.x + r); top = Math.min(top, a.y - r, b.y - r); bottom = Math.max(bottom, a.y + r, b.y + r) }
  const ell = (q: readonly [number, number, number, number]) => { const c = shamanPoint(f, [q[0], q[1]]), rx0 = q[2] * K, ry0 = q[3] * K * sy, rx = Math.hypot(rx0 * Math.cos(A), ry0 * Math.sin(A)), ry = Math.hypot(rx0 * Math.sin(A), ry0 * Math.cos(A)); left = Math.min(left, c.x - rx); right = Math.max(right, c.x + rx); top = Math.min(top, c.y - ry); bottom = Math.max(bottom, c.y + ry) }
  cap(rig.torso); cap(rig.skirt); ell(rig.head); if (g.partHP.waist > 0) ell(rig.waist); cap(rig.fan); cap(rig.bell)
  return { left, top, right, bottom }
}
/** 같은 발 자리를 쓰는 자세들을 한 번에 판 안으로 — 옮길 몫 (몸이 판보다 크면 null) */
function shiftInto(g: ShamanState, e: GiantOwner, frames: readonly ShamanFrame[]): Point | null {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  for (const f of frames) { const b = shamanFrameBounds(g, e, { ...f, rise: 1 }); left = Math.min(left, b.left); right = Math.max(right, b.right); top = Math.min(top, b.top); bottom = Math.max(bottom, b.bottom) }
  if (right - left > W || bottom - top > H) return null
  return point(left < 0 ? -left : right > W ? W - right : 0, top < 0 ? -top : bottom > H ? H - bottom : 0)
}
const moved = (f: ShamanFrame, d: Point): ShamanFrame => ({ ...f, x: f.x + d.x, y: f.y + d.y })
/** 판 안에 판정 부위가 다 들어오게 발 자리를 옮긴다 · 몸이 판보다 크면 null */
export function fitShamanFrame(g: ShamanState, e: GiantOwner, f: ShamanFrame): ShamanFrame | null { const d = shiftInto(g, e, [f]); return d && moved(f, d) }
function fitAll(g: ShamanState, e: GiantOwner, frames: readonly ShamanFrame[]): ShamanFrame[] | null { const d = shiftInto(g, e, frames); return d && frames.map(f => moved(f, d)) }
/** 모양의 둘레 상자 [왼, 위, 오른, 아래] (넉넉하게) */
type Aabb = readonly [number, number, number, number]
function aabb(s: Shape): Aabb {
  if (s.kind === 'box') { const c = Math.abs(Math.cos(s.angle)), n = Math.abs(Math.sin(s.angle)), ex = c * s.halfX + n * s.halfY, ey = n * s.halfX + c * s.halfY; return [s.center.x - ex, s.center.y - ey, s.center.x + ex, s.center.y + ey] }
  if (s.kind === 'capsule' || s.kind === 'line') { const r = s.kind === 'line' ? s.width / 2 : s.radius; return [Math.min(s.from.x, s.to.x) - r, Math.min(s.from.y, s.to.y) - r, Math.max(s.from.x, s.to.x) + r, Math.max(s.from.y, s.to.y) + r] }
  if (s.kind === 'union') return s.shapes.map(aabb).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])])
  const r = s.kind === 'ellipse' ? Math.max(s.rx, s.ry) : s.kind === 'annulus' || s.kind === 'arc' ? s.outer : s.radius
  return [s.center.x - r, s.center.y - r, s.center.x + r, s.center.y + r]
}
const flat = (s: Shape): Shape[] => s.kind === 'union' ? s.shapes.flatMap(flat) : [s]
/**
 * imugi.safeLanding 과 같은 후보 · 같은 차례 · 같은 답 (닿을 수 있는 3P 빈 원) — 둘레 상자가 원과 떨어진 모양은 겹침 셈을 건너뛴다.
 * 겹침(overlaps)은 상자가 닿는 모양에만 그대로 잰다. 상자가 떨어지면 겹칠 수 없으니 답이 바뀌지 않는다.
 */
export function shamanSafeLanding(shapes: readonly Shape[], env: readonly Shape[], player: Point, speed: number, seconds: number): Point | null {
  const radius = G.playerDiameter * G.safeDiameters / 2, margin = 1e-3, parts = [...shapes, ...env].flatMap(flat).map(s => ({ s, b: aabb(s) })), candidates: Point[] = []
  for (let y = radius; y <= H - radius; y += G.safeGrid) for (let x = radius; x <= W - radius; x += G.safeGrid) if (Math.hypot(x - player.x, y - player.y) <= speed * seconds) candidates.push(point(x, y))
  candidates.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y) || a.y - b.y || a.x - b.x)
  for (const p of candidates) {
    const disk: Shape = { kind: 'circle', center: p, radius }
    if (parts.every(({ s, b }) => p.x + radius < b[0] - margin || p.x - radius > b[2] + margin || p.y + radius < b[1] - margin || p.y - radius > b[3] + margin || !overlaps(s, disk))) return p
  }
  return null
}
export function createShaman(e: GiantOwner, tick = 0): ShamanState {
  const partMax = Object.fromEntries(SHAMAN_HP.map(id => [id, S.hp * S.parts[id]])) as Record<ShamanHp, number>, base = { ...restAt(e.x, S.homeY, e.x <= W / 2 ? 1 : -1), rise: 0 }
  const motion: ShamanMotion = { move: null, from: base, prepared: base, relaxed: base, current: base, recoverFrom: base, recoverSeconds: S.idleRecovery, progress: 0, blocked: false, walk: 0, stepTo: null }
  const g: ShamanState = { kind: 'shaman', phase: 1, state: 'entry', pattern: null, seq: 0, age: 0, timer: S.entrySeconds, enraged: false, last: null, recoveryHitUsed: false, stagger: 0, submerge: 1,
    windupUses: {}, brokenSeen: [], brokenAt: {}, partHP: { ...partMax }, partMax, pose: makeShamanPose(base, { ownerId: e.id, tick, alive: true, targetable: false, recovering: false, partHP: partMax }), motion, attack: null,
    environment: shamanEnvironment(1), bounds: { left: 0, top: 0, right: W, bottom: H }, lastHitPart: 'root', poisonPart: 'root', keyNow: 0, keyFrom: 0, keyAt: 0 }
  const fit = fitShamanFrame(g, e, base) ?? base
  g.motion = { ...motion, from: fit, prepared: fit, relaxed: fit, current: fit, recoverFrom: fit }
  updateShamanPose(g, e, tick); return g
}

// ── 수 ──
const brokenAny = (g: ShamanState, ids: readonly ShamanHp[]) => ids.some(id => g.partHP[id] <= 0)
const facingTo = (f: ShamanFrame, target: Point): 1 | -1 => Math.abs(target.x - f.x) < S.turnDeadZone ? f.facing : target.x < f.x ? -1 : 1
/** 고정 tick 의 수 후보 — 막 · 같은 수 연속 금지 · 거리 · 살아 있는 부위 (난수 없음) */
export function shamanCandidates(g: ShamanState, e: GiantOwner, target: Point): ShamanMove[] {
  if (e.hp <= 0 || g.state === 'dead') return []
  const f = g.motion.current, d = Math.hypot(target.x - f.x, target.y - f.y), m = S.moves
  return SHAMAN_MOVES.filter(move => {
    if (move === g.last || g.phase < m[move].phase || brokenAny(g, SHAMAN_REQUIRES[move])) return false
    if (move === 'sweep') return d <= m.sweep.reach
    if (move === 'ring') return d <= m.ring.reach
    if (move === 'twin') return d <= m.twin.reach
    if (move === 'chase') return d >= m.chase.min
    return true
  })
}
/** 난수 둘 — 정지 초 · 모양(고리 빈 곳 방향 · 불기둥 줄의 기울기) */
export interface ShamanRolls { readonly hold: number; readonly shape: number }
export interface ShamanPlan { move: ShamanMove; prepared: ShamanFrame; relaxed: ShamanFrame; hold: number; subs: Omit<ShamanSub, 'hit'>[]; bands?: readonly (readonly Shape[])[]; gap?: number; centers?: readonly Point[]; path?: readonly Point[] }
const holdOf = (move: ShamanMove, roll: number) => { const [a, b] = S.moves[move].hold; return a + (b - a) * unit(roll) }
const sub = (shapes: readonly Shape[], red: number, strike: number, impactAt: number, damage: number, from: ShamanFrame, to: ShamanFrame): Omit<ShamanSub, 'hit'> => ({ shapes: frozen(shapes), red, strike, impactAt, damage, from, to })
/** 화염 맥동의 띠 — 왼쪽부터 · 가운데 세로 길은 뺀다 */
export function shamanBands(): Shape[][] {
  const n = S.moves.pulse.bands, w = W / n, [laneL, laneR] = shamanLane(), out: Shape[][] = []
  for (let k = 0; k < n; k++) {
    const a = k * w, b = a + w, parts: [number, number][] = []
    if (a < laneL) parts.push([a, Math.min(b, laneL)])
    if (b > laneR) parts.push([Math.max(a, laneR), b])
    out.push(parts.filter(([x0, x1]) => x1 - x0 > 1).map(([x0, x1]) => box((x0 + x1) / 2, H / 2, (x1 - x0) / 2, H / 2)))
  }
  return out
}
/** 몸·붉은 바닥을 붉은빛 앞에 모두 정한다 — 그 뒤엔 따라가거나 돌거나 옮기지 않는다 */
export function planShaman(g: ShamanState, e: GiantOwner, target: Point, move: ShamanMove, _tick: number, rolls: ShamanRolls): ShamanPlan | null {
  const from = settled(g.motion.current), facing = facingTo(from, target), m = S.moves, hold = holdOf(move, rolls.hold)
  const at = (x: number, y: number, s: Spec, f: 1 | -1 = facing) => frameOf(x, y, f, s)
  const still = (spec: { prepare: Spec; impact: Spec }) => fitAll(g, e, [at(from.x, from.y, spec.prepare), at(from.x, from.y, spec.impact), at(from.x, from.y, M.recover)])
  if (move === 'sweep') {
    const fit = still(M.sweep); if (!fit) return null
    const [prepared, impact, relaxed] = fit as [ShamanFrame, ShamanFrame, ShamanFrame], c = point(prepared.x + facing * m.sweep.ahead, prepared.y)
    const base = facing === 1 ? 0 : Math.PI, want = Math.atan2(target.y - c.y, target.x - c.x), off = Math.max(-m.sweep.aim, Math.min(m.sweep.aim, Math.atan2(Math.sin(want - base), Math.cos(want - base))))
    return { move, prepared, relaxed, hold, subs: [sub([{ kind: 'cone', center: c, radius: m.sweep.radius, angle: base + off, halfAngle: m.sweep.halfAngle }], m.sweep.red, m.sweep.strike, m.sweep.impactAt, m.sweep.damage, prepared, impact)] }
  }
  if (move === 'ring') {
    const fit = still(M.ring); if (!fit) return null
    const [prepared, impact, relaxed] = fit as [ShamanFrame, ShamanFrame, ShamanFrame], r = m.ring, inner = r.radius - r.width / 2
    // 빈 곳: 안쪽 둘레에서 3P 원이 지나가는 너비 (+ 4px 여유) · 방향은 seeded
    const gapHalf = Math.asin(Math.min(1, (G.playerDiameter * G.safeDiameters / 2 + r.gapPad) / inner)), gap = rolls.shape * TAU
    const shape: Shape = { kind: 'arc', center: point(prepared.x, prepared.y), inner, outer: r.radius + r.width / 2, angle: gap + Math.PI, halfAngle: Math.PI - gapHalf }
    return { move, prepared, relaxed, hold, gap, subs: [sub([shape], r.red, r.strike, r.impactAt, r.damage, prepared, impact)] }
  }
  if (move === 'pillars') {
    const fit = still(M.pillars); if (!fit) return null
    const [prepared, impact, relaxed] = fit as [ShamanFrame, ShamanFrame, ShamanFrame], p = m.pillars, a = rolls.shape * Math.PI
    // 장수 자리를 가운데로 한 줄 셋 · 판 끝에 걸리면 줄째 옮긴다 (원 사이는 그대로)
    const raw = [-1, 0, 1].map(k => point(target.x + Math.cos(a) * p.spread * k, target.y + Math.sin(a) * p.spread * k))
    const fitIn = (v: number[], max: number) => { const lo = Math.min(...v), hi = Math.max(...v); return lo < p.radius ? p.radius - lo : hi > max - p.radius ? max - p.radius - hi : 0 }
    const dx = fitIn(raw.map(c => c.x), W), dy = fitIn(raw.map(c => c.y), H), centers = raw.map(c => point(c.x + dx, c.y + dy))
    return { move, prepared, relaxed, hold, centers: Object.freeze(centers), subs: [sub(centers.map(c => ({ kind: 'circle', center: c, radius: p.radius }) as Shape), p.red, p.strike, p.impactAt, p.damage, prepared, impact)] }
  }
  if (move === 'chase') {
    const c = m.chase, dx = target.x - from.x, dy = target.y - from.y, d = Math.hypot(dx, dy), ux = d > 1 ? dx / d : facing, uy = d > 1 ? dy / d : 0, dir: 1 | -1 = Math.abs(ux) < 1e-6 ? facing : ux < 0 ? -1 : 1
    // 판 끝에 걸리면 줄을 줄인다 — 그래도 안 들어가면 이 수는 쓰지 않는다
    for (let length = c.length; length >= c.minLength - 1e-9; length -= 10) {
      const ends = Array.from({ length: c.steps + 1 }, (_, k) => point(from.x + ux * length * k, from.y + uy * length * k))
      const frames = ends.flatMap((p, k) => k === 0 ? [at(p.x, p.y, M.chase.prepare, dir)] : [at(p.x, p.y, M.chase.prepare, dir), at(p.x, p.y, M.chase.impact, dir)])
      const end = ends[c.steps]!, last = at(end.x, end.y, M.recover, dir), all = [...frames, last]
      if (!all.every(f => { const b = shamanFrameBounds(g, e, f); return b.left >= 0 && b.right <= W && b.top >= 0 && b.bottom <= H })) continue
      const subs = ends.slice(0, -1).map((p, k) => { const q = ends[k + 1]!; return sub([box((p.x + q.x) / 2, (p.y + q.y) / 2, length / 2, c.width / 2, Math.atan2(uy, ux))], k ? c.next : c.red, c.strike, c.impactAt, c.damage, at(p.x, p.y, M.chase.prepare, dir), at(q.x, q.y, M.chase.impact, dir)) })
      return { move, prepared: subs[0]!.from, relaxed: last, hold, path: Object.freeze(ends), subs }
    }
    return null
  }
  if (move === 'twin') {
    const fit = still(M.twin); if (!fit) return null
    const [prepared, impact, relaxed] = fit as [ShamanFrame, ShamanFrame, ShamanFrame], t = m.twin, c = point(prepared.x, prepared.y), angle = facing === 1 ? 0 : Math.PI, half = Math.PI - t.rear
    return { move, prepared, relaxed, hold, subs: [
      sub([{ kind: 'cone', center: c, radius: t.inner, angle, halfAngle: half }], t.red, t.strike, t.impactAt, t.damage[0], prepared, impact),
      sub([{ kind: 'arc', center: c, inner: t.inner, outer: t.outer, angle, halfAngle: half }], t.next, t.strike, t.impactAt, t.damage[1], settled(impact), impact),
    ] }
  }
  const fit = still(M.pulse); if (!fit) return null
  const [prepared, impact, relaxed] = fit as [ShamanFrame, ShamanFrame, ShamanFrame], bands = shamanBands().map(b => frozen(b))
  return { move, prepared, relaxed, hold, bands, subs: [sub(bands.flat(), m.pulse.red, m.pulse.strike, m.pulse.impactAt, m.pulse.damage, prepared, impact)] }
}
/** 첫 타까지의 초 (몸 + 정지 + 붉은 바닥) */
const firstSeconds = (plan: ShamanPlan) => S.moves[plan.move].body + plan.hold + plan.subs[0]!.red
/**
 * 화염 맥동에서 살아남는가 — 가운데 길로 곧장 달릴 때, 띠마다 타는 동안 그 띠 안에 있지 않아야 한다 (띠는 왼쪽부터 · 길은 늘 빈다).
 * 길 밖 모든 판이 타니 3P 빈 원을 한 번에 재지 않고 띠가 타는 때를 잰다.
 */
export function shamanPulseEscape(player: Point, speed: number, first: number): boolean {
  const [laneL, laneR] = shamanLane(), goal = Math.max(laneL + 1, Math.min(laneR - 1, player.x)), n = S.moves.pulse.bands, per = S.moves.pulse.strike / n
  const xAt = (t: number) => player.x + Math.sign(goal - player.x) * Math.min(Math.abs(goal - player.x), speed * t)
  return shamanBands().every((band, k) => {
    const x0 = xAt(first + k * per), x1 = xAt(first + (k + 1) * per), lo = Math.min(x0, x1), hi = Math.max(x0, x1)
    return band.every(b => b.kind !== 'box' || hi < b.center.x - b.halfX || lo > b.center.x + b.halfX)
  })
}
/** 이 수를 지금 안전하게 쓸 수 있는가 — 타마다 닿을 수 있는 3P 빈 원이 환경 불과 겹치지 않아야 한다 (연타는 앞 타의 빈 원에서 다음 빈 원으로) */
function feasible(g: ShamanState, plan: ShamanPlan, player: Point, speed: number): boolean {
  if (plan.move === 'pulse') return shamanPulseEscape(player, speed, firstSeconds(plan))
  let at = player
  for (let k = 0; k < plan.subs.length; k++) {
    const s = plan.subs[k]!, seconds = k ? s.red + plan.subs[k - 1]!.strike : firstSeconds(plan)
    const p = shamanSafeLanding(s.shapes, g.environment.shapes, at, speed, seconds)
    if (!p) return false
    at = p
  }
  return true
}
/** 후보에서 난수 하나로 고르고(+ 정지·모양 난수 둘), 그 수를 실제로 세워 본다 — 안 되면 후보 차례로 다음 수 · 빈 후보는 난수를 쓰지 않는다 */
export function chooseShamanPlan(g: ShamanState, e: GiantOwner, target: Point, speed: number, tick: number, random: () => number): ShamanPlan | null {
  const moves = shamanCandidates(g, e, target); if (!moves.length) return null
  const first = Math.min(moves.length - 1, Math.floor(random() * moves.length)), rolls: ShamanRolls = { hold: random(), shape: random() }
  for (let k = 0; k < moves.length; k++) { const p = planShaman(g, e, target, moves[(first + k) % moves.length]!, tick, rolls); if (p && feasible(g, p, target, speed)) return p }
  return null
}
export function beginShamanPlan(g: ShamanState, e: GiantOwner, plan: ShamanPlan, tick: number): void {
  const m = S.moves[plan.move], use = (g.windupUses[plan.move] ?? 0) + 1, red = plan.subs[0]!.red
  const w: ShamanWindup = Object.freeze({ body: m.body, hold: plan.hold, red, total: m.body + plan.hold + red, use })
  g.windupUses[plan.move] = use; g.last = plan.move; g.pattern = plan.move; g.seq++; g.state = 'body'; g.timer = w.body
  g.motion = { ...g.motion, move: plan.move, from: settled(g.motion.current), prepared: plan.prepared, relaxed: plan.relaxed, recoverFrom: plan.prepared, recoverSeconds: m.recover, progress: 0, blocked: false, stepTo: null }
  g.attack = { windup: w, seq: g.seq, move: plan.move, requires: SHAMAN_REQUIRES[plan.move], subs: plan.subs.map(s => ({ ...s, hit: false })), sub: 0, shapes: plan.subs[0]!.shapes, pending: false, cut: false, recover: m.recover,
    ...(plan.bands ? { bands: Object.freeze(plan.bands), activeShapes: Object.freeze([]), tails: Object.freeze(plan.bands.map((_, k) => Object.freeze(plan.bands!.slice(k).flat()))) } : {}), ...(plan.gap !== undefined ? { gap: plan.gap } : {}), ...(plan.centers ? { centers: plan.centers } : {}), ...(plan.path ? { path: plan.path } : {}) }
  updateShamanPose(g, e, tick)
}
/** 시험·검수용: 이 수를 지금 세운다 (난수 둘을 받아 쓴다 · 안전하지 않으면 false · 판은 쉬는 자세로) */
export function beginShamanMove(g: ShamanState, e: GiantOwner, target: Point, move: ShamanMove, tick: number, speed: number = C.speed, random: () => number = () => 0): boolean {
  const rolls: ShamanRolls = { hold: random(), shape: random() }, plan = planShaman(g, e, target, move, tick, rolls)
  if (!plan || !feasible(g, plan, target, speed)) { g.motion = { ...g.motion, blocked: true }; recover(g, S.idleRecovery); return false }
  beginShamanPlan(g, e, plan, tick); return true
}
/** 회복(머리 노출) — 타격 뒤에는 미리 판 안으로 맞춘 회복 자세로 */
function recover(g: ShamanState, seconds: number, relaxed?: ShamanFrame) {
  const c = settled(g.motion.current)
  g.motion = { ...g.motion, move: null, current: c, recoverFrom: c, relaxed: relaxed ?? frameOf(c.x, c.y, c.facing, M.recover), recoverSeconds: seconds, stepTo: null }
  g.state = 'recover'; g.timer = seconds; g.attack = null; g.recoveryHitUsed = false
}
/** 회복 중 첫 타격 — 움찔하고 회복이 조금 늘어난다 (한 번만) */
export function staggerShaman(g: ShamanState): void {
  if (g.state !== 'recover') return
  g.stagger = S.staggerSeconds; g.timer = Math.min(g.motion.recoverSeconds + S.staggerRecover, g.timer + S.staggerRecover)
}
/** 부위가 처음 0 이 됐다 — 그 부위가 필요한 수는 예약이면 취소 · 치는 중이면 남은 타를 끊는다 · 앞으로도 제외 */
export function breakShamanPart(g: ShamanState, id: ShamanPartId): boolean {
  const key = shamanHpOf(id)
  if (!key || g.partHP[key] > 0 || g.brokenSeen.includes(key)) return false
  g.brokenSeen.push(key); g.brokenAt[key] = g.age; g.stagger = S.staggerSeconds
  if (g.attack && g.attack.requires.includes(key)) { if (g.state === 'strike') g.attack.cut = true; else recover(g, S.idleRecovery) }
  return true
}
export function endShaman(g: ShamanState, e: GiantOwner, tick: number): void { g.state = 'dead'; g.attack = null; g.environment.active = false; updateShamanPose(g, e, tick) }
function startStep(g: ShamanState, e: GiantOwner, player: Point): boolean {
  const f = settled(g.motion.current), dir = player.x < f.x ? -1 : 1, home = Math.abs(f.y - S.homeY) > S.homeBand * S.homePull
  const want = point(home ? f.x + dir * S.stepNear * .5 : player.x - dir * S.stepNear, Math.max(S.homeY - S.homeBand, Math.min(S.homeY + S.homeBand, home ? S.homeY : player.y)))
  const to = fitShamanFrame(g, e, restAt(want.x, want.y, f.facing))
  if (!to || Math.hypot(to.x - f.x, to.y - f.y) < S.stepMin) return false
  g.state = 'step'; g.timer = S.stepSeconds; g.attack = null; g.motion = { ...g.motion, move: null, stepTo: point(to.x, to.y), from: f, current: f }
  return true
}
function decide(g: ShamanState, e: GiantOwner, input: ShamanStep) {
  const plan = chooseShamanPlan(g, e, input.player, input.speed, input.tick, input.random), f = g.motion.current
  const near = plan?.move === 'sweep' || plan?.move === 'twin' || plan?.move === 'ring', away = Math.abs(f.y - S.homeY) > S.homeBand * S.homePull
  if (plan && (near || !away)) { beginShamanPlan(g, e, plan, input.tick); return }
  if (g.state !== 'step' && startStep(g, e, input.player)) return
  if (plan) { beginShamanPlan(g, e, plan, input.tick); return }
  recover(g, S.idleRecovery)
}
export interface ShamanStep { dt: number; tick: number; player: Point; speed: number; dazed: boolean; random: () => number }
/** 땅을 울리는 순간 (불기둥 · 고리가 타오름 · 맥동이 시작 · 등장 마지막 걸음) — 화면이 멈칫·흔들린다 */
const HEAVY = new Set<ShamanMove>(['pillars', 'ring', 'pulse'])
function landed(g: ShamanState, was: number, entryWas: number): boolean {
  if (g.state === 'entry') return entryWas < M.entry.land && 1 - g.timer / S.entrySeconds >= M.entry.land
  const a = g.attack, s = a?.subs[a.sub]
  return !!a && !!s && g.state === 'strike' && a.sub === 0 && HEAVY.has(a.move) && was < s.impactAt && g.motion.progress >= s.impactAt
}
/** 준비만 — 장수의 공격이 이 뒤에 들어오고 commitShaman 이 다치기 전에 다시 잰다 */
export function stepShaman(g: ShamanState, e: GiantOwner, input: ShamanStep): 'roar' | 'recovery' | 'quake' | null {
  if (e.hp <= 0 || g.state === 'dead') { endShaman(g, e, input.tick); return null }
  const was = g.state === 'strike' ? g.motion.progress : -1, entryWas = g.state === 'entry' ? 1 - g.timer / S.entrySeconds : 2
  g.age += input.dt; g.enraged = g.age >= G.enrageAfter; g.stagger = Math.max(0, g.stagger - input.dt)
  if (g.state !== 'entry') { g.environment.age += input.dt; g.environment.active = g.environment.age >= G.environmentTell }
  if (input.dazed) { updateShamanPose(g, e, input.tick); return null }
  const waiting = g.state === 'body' || g.state === 'hold' || g.state === 'tell', remaining = g.timer - input.dt
  g.timer = Math.max(0, remaining)
  if (g.state === 'step') stepMove(g, input.dt)
  let cue: 'roar' | 'recovery' | null = null
  const a = g.attack
  if (waiting && remaining <= G.windup.epsilon && a) {
    let carry = Math.max(0, -remaining)
    for (let n = 0; n < 3; n++) {
      const w = a.windup, s = a.subs[a.sub]!
      if (g.state === 'body' && w.hold > 0) { g.state = 'hold'; g.timer = w.hold - carry }
      else if (g.state === 'body' || g.state === 'hold') { g.state = 'tell'; g.timer = s.red - carry }
      else { g.state = 'strike'; g.timer = s.strike - carry; a.pending = true; g.motion.progress = 0; break }
      if (g.timer > G.windup.epsilon) break
      carry = Math.max(0, -g.timer)
    }
    g.timer = Math.max(0, g.timer)
  } else if (g.timer === 0) {
    if (g.state === 'strike' && a) {
      const s = a.subs[a.sub]!
      g.motion.current = s.to
      if (a.sub + 1 < a.subs.length && !a.cut) { a.sub++; a.shapes = a.subs[a.sub]!.shapes; a.pending = false; g.state = 'tell'; g.timer = a.subs[a.sub]!.red; g.motion.progress = 0 }
      else { recover(g, a.recover, g.motion.relaxed); cue = 'recovery' }
    } else if (g.state === 'entry' || g.state === 'recover' || g.state === 'roar' || g.state === 'step') {
      const desired = e.hp / e.max <= G.phaseCuts[1] ? 3 : e.hp / e.max <= G.phaseCuts[0] ? 2 : 1
      if (g.phase < desired) { g.phase = (g.phase + 1) as 2 | 3; g.state = 'roar'; g.timer = S.roarSeconds; g.environment = shamanEnvironment(g.phase); g.motion = { ...g.motion, from: settled(g.motion.current), move: null }; cue = 'roar' }
      else decide(g, e, input)
    }
  }
  updateShamanPose(g, e, input.tick)
  return cue ?? (landed(g, was, entryWas) ? 'quake' : null)
}
function stepMove(g: ShamanState, dt: number) {
  const to = g.motion.stepTo, f = g.motion.current
  if (!to) { g.timer = 0; return }
  const dx = to.x - f.x, dy = to.y - f.y, d = Math.hypot(dx, dy), step = Math.min(d, S.stepSpeed * dt)
  if (d < 1e-6) { g.timer = 0; return }
  const facing: 1 | -1 = Math.abs(dx) > 4 ? (dx < 0 ? -1 : 1) : f.facing
  g.motion.current = { ...f, x: f.x + dx / d * step, y: f.y + dy / d * step, facing }
  g.motion.walk += step / S.stepStride * Math.PI
  if (step >= d) g.timer = 0
}
function chosenFrame(g: ShamanState): ShamanFrame {
  const m = g.motion, a = g.attack
  if (g.state === 'entry') {
    // 불 속에서 드러나며 걸어 나온다 (from → to 몫) · 마지막 걸음에 몸이 눌렸다 편다
    const E = M.entry, k = 1 - g.timer / S.entrySeconds, u = smooth((k - E.from) / (E.to - E.from)), land = k > E.land ? Math.sin(Math.PI * unit((k - E.land) / (1 - E.land))) : 0
    return { ...m.from, x: m.from.x - m.from.facing * E.walk * (1 - u), rise: u, lean: m.from.lean + (1 - u) * E.lean - land * E.pop.lean, squash: m.from.squash - land * E.pop.squash, lift: m.from.lift + land * E.pop.lift }
  }
  if (g.state === 'body') return blend(m.from, m.prepared, 1 - g.timer / (a?.windup.body || 1))
  if (g.state === 'hold') return m.prepared
  if (g.state === 'tell') {
    if (!a || a.sub === 0) return m.prepared
    // 연타: 앞 타 끝 자세에서 다음 타 준비 자세로 (붉은 바닥 앞쪽에서)
    const s = a.subs[a.sub]!, prev = a.subs[a.sub - 1]!
    return blend(settled(prev.to), s.from, (1 - g.timer / s.red) / M.reprepare)
  }
  if (g.state === 'strike' && a) {
    const s = a.subs[a.sub]!, p = unit(1 - g.timer / s.strike); m.progress = p
    if (a.move === 'chase') { const f = blend(s.from, s.to, p / Math.max(s.impactAt, 1e-6)); return { ...f, x: lerp(s.from.x, s.to.x, smooth(p)), y: lerp(s.from.y, s.to.y, smooth(p)) } }
    if (a.move === 'pulse') { const P = M.pulse, f = blend(s.from, s.to, p * P.raise); return { ...f, lift: f.lift + Math.sin(p * Math.PI * P.shimmer) * P.shimmerLift } }
    if (a.move === 'twin') return { ...blend(s.from, s.to, p / Math.max(s.impactAt, 1e-6)), spin: s.from.spin + (s.to.spin - s.from.spin) * smooth(p) }
    return blend(s.from, s.to, p / Math.max(s.impactAt, 1e-6))
  }
  if (g.state === 'recover') return blend(m.recoverFrom, m.relaxed, 1 - g.timer / Math.max(1e-6, m.recoverSeconds))
  if (g.state === 'roar') { const k = Math.sin(Math.PI * unit(1 - g.timer / S.roarSeconds)), r = frameOf(m.from.x, m.from.y, m.from.facing, M.roar); return blend(m.from, r, k * M.roarSnap) }
  if (g.state === 'step') {
    const c = m.current, w = m.walk, rest = restAt(c.x, c.y, c.facing)
    return { ...rest, lift: -Math.abs(Math.sin(w)) * M.step.bob, lean: M.step.lean, flare: M.step.flare + M.step.flareSway * Math.sin(w) }
  }
  return m.current
}
/** 숨·흔들림·움찔 — 판 시각(age)만 쓴다 */
function alive(g: ShamanState, f: ShamanFrame): ShamanFrame {
  if (g.state === 'dead') return f
  const b = M.breath, t = g.age, s = g.stagger > 0 ? Math.sin(Math.PI * g.stagger / S.staggerSeconds) : 0
  return { ...f, squash: f.squash + Math.sin(t * TAU * b.hz) * b.squash, lean: f.lean + Math.sin(t * TAU * b.leanHz) * b.lean + s * M.stagger.lean, lift: f.lift + s * M.stagger.lift }
}
export function updateShamanPose(g: ShamanState, e: GiantOwner, tick: number): void {
  const chosen = chosenFrame(g)
  g.motion.current = { ...chosen, turn: 0 }
  const f = alive(g, chosen)
  e.x = f.x; e.y = f.y; g.submerge = 1 - f.rise
  if (f.key !== g.keyNow) { g.keyFrom = g.keyNow; g.keyNow = f.key; g.keyAt = g.age }
  const pose = poseOf(g, e, f, tick), a = g.attack
  g.pose = Object.freeze({ ...pose, worldGeometry: Object.freeze({ ...pose.worldGeometry, tell: (g.state === 'tell' || g.state === 'strike') && a ? a.shapes : Object.freeze([]) }) })
  g.bounds = shamanCollisionBounds(pose)
  if (a?.bands && a.tails) {
    // 화염 맥동: 타격 동안 띠가 왼쪽부터 하나씩 탄다 (지금 타는 띠만 판정 · 붉은 바닥은 아직 안 탄 띠와 타는 띠)
    const k = g.state === 'strike' ? Math.min(a.bands.length - 1, Math.floor(g.motion.progress * a.bands.length)) : -1
    a.activeShapes = k >= 0 ? a.bands[k]! : Object.freeze([])
    a.shapes = a.tails[Math.max(0, k)]!
    if (g.state === 'tell' || g.state === 'strike') g.pose = Object.freeze({ ...g.pose, worldGeometry: Object.freeze({ ...g.pose.worldGeometry, tell: a.shapes }) })
  }
}
/** 장수 맞음 판정 — 타마다 한 번 · 고리는 타오르는 동안 · 맥동은 지금 타는 띠 · 필요한 부위가 부서졌으면 없던 일 · 환경은 박자마다 */
export function commitShaman(g: ShamanState, e: GiantOwner, player: Point, hurt: (damage: number) => void, dazed: boolean): void {
  if (e.hp <= 0 || g.state === 'dead') { g.attack = null; g.environment.active = false; return }
  if (dazed) return
  const a = g.attack, at: Shape = { kind: 'circle', center: point(player.x, player.y), radius: 0 }, scale = g.enraged ? G.enrageDamage : 1
  if (g.state === 'strike' && a && a.seq === g.seq && a.requires.every(id => g.partHP[id] > 0)) {
    const s = a.subs[a.sub]!
    if (!s.hit) {
      if (a.move === 'pulse') { if ((a.activeShapes ?? []).some(x => overlaps(x, at))) { s.hit = true; hurt(s.damage * scale) } }
      else if (a.move === 'ring') { if (g.motion.progress >= s.impactAt && s.shapes.some(x => overlaps(x, at))) { s.hit = true; hurt(s.damage * scale) } }
      else if (a.pending && g.motion.progress >= s.impactAt) { a.pending = false; if (s.shapes.some(x => overlaps(x, at))) { s.hit = true; hurt(s.damage * scale) } }
    }
  }
  if (g.environment.active && g.environment.age >= g.environment.nextHit && g.environment.shapes.some(x => overlaps(x, at))) {
    g.environment.nextHit = g.environment.age + G.environmentEvery; hurt(G.environmentDamage * scale)
  }
}
/** 부서지지 않은(또는 늘 맞는 몸통·치마·머리) 부위만 맞는다 */
export function shamanLiveParts(g: ShamanState): readonly PartPose<ShamanPartId>[] {
  return g.pose.parts.filter(p => { const key = shamanHpOf(p.id); return key === null || key === 'head' || g.partHP[key] > 0 })
}
export const shamanContact = (g: ShamanState, shape: Shape): Contact<ShamanPartId> | null => pickContact({ ...g.pose, parts: shamanLiveParts(g) }, shape, shamanRank)
export const shamanSweep = (g: ShamanState, from: Point, to: Point, radius: number): Contact<ShamanPartId> | null => sweepContact({ ...g.pose, parts: shamanLiveParts(g) }, from, to, radius, shamanRank)
/** 맞은 부위의 체력을 깎는다 · 처음 부서지면 true */
export function damageShamanPart(g: ShamanState, id: ShamanPartId, amount: number): boolean {
  const key = shamanHpOf(id)
  if (key) g.partHP[key] = Math.max(0, g.partHP[key] - amount)
  g.lastHitPart = id
  return breakShamanPart(g, id)
}
/** 부서진 부위가 아직 자세에 반영되지 않았다 */
export const shamanPoseStale = (g: ShamanState) => g.pose.parts.some(p => { const key = shamanHpOf(p.id); return key !== null && p.damaged !== (g.partHP[key] <= 0) })
