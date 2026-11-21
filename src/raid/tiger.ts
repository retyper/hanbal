/**
 * 55 설원 고개 거대 보스 「백두 대호」 — 판(sim) 쪽 (docs/realm/BOSS.md 백두 대호 표 · 11-22 형: 호랑이 그 자체).
 * 몸 준비 → 붉은 바닥 → 타격 → 머리 노출 회복 · 막 1→2→3 · 부위가 부서지면 그 수가 봉인되거나 바뀐다.
 * 이무기(imugi.ts)와 같은 공통 계약을 쓴다: giant-core 의 접촉·겹침·고정 예고, imugi.safeLanding(닿을 수 있는 3P 빈 원), HAEBI_GIANT 의 막·분노·환경 박자.
 * 판정 뼈대(pose)는 한 틱의 순수 셈이고 그림(tiger-view.ts)은 같은 뼈를 읽기만 한다.
 * DOM·벽시계·Math.random 없음 — 난수는 판의 seeded random 하나 (수 고르기 · 덮치기 흔들림 · 진짜 눈 더미).
 */
import { HAEBI_GIANT as G, HAEBI_TIGER as T, HAEBI_RUN as C } from '../tune/params.ts'
import { freezeTell, overlaps, pickContact, sweepContact, type Collider, type Contact, type ImugiPose, type PartPose, type Point, type Shape } from './giant-core.ts'
import { safeLanding, type GiantOwner } from './imugi.ts'

export const TIGER_PARTS = ['root', 'neck', 'head', 'jaw', 'fore-far', 'fore-near', 'hind-far', 'hind-near', 'tail1', 'tail2', 'tail3', 'tail-tip', 'arrows'] as const
export type TigerPartId = typeof TIGER_PARTS[number]
/** 따로 체력을 갖는 부위 (몸통·목은 본체 그 자체 · 꼬리 마디 넷은 꼬리 하나) */
export const TIGER_HP = ['head', 'jaw', 'fore-near', 'fore-far', 'hind-near', 'hind-far', 'tail', 'arrows'] as const
export type TigerHp = typeof TIGER_HP[number]
export type TigerMove = keyof typeof T.moves
export type LegId = 'fore-near' | 'fore-far' | 'hind-near' | 'hind-far'
/** params 의 paw 배열 차례 (앞 가까운 · 앞 먼 · 뒤 가까운 · 뒤 먼) */
export const LEG_ORDER: readonly LegId[] = ['fore-near', 'fore-far', 'hind-near', 'hind-far']
export const tigerHpOf = (id: TigerPartId): TigerHp | null => id === 'root' || id === 'neck' ? null : id.startsWith('tail') ? 'tail' : id as TigerHp
const PARENT: Record<TigerPartId, TigerPartId | null> = { root: null, neck: 'root', head: 'neck', jaw: 'head', 'fore-far': 'root', 'fore-near': 'root', 'hind-far': 'root', 'hind-near': 'root', tail1: 'root', tail2: 'tail1', tail3: 'tail2', 'tail-tip': 'tail3', arrows: 'root' }
/** 같은 거리일 때 먼저 맞는 부위 — 약점(머리) · 턱 · 화살 묶음 · 목 · 다리 · 꼬리 · 몸통 */
const RANK: Record<TigerPartId, number> = { head: 0, jaw: 1, arrows: 2, neck: 3, 'fore-near': 4, 'fore-far': 5, 'hind-near': 6, 'hind-far': 7, 'tail-tip': 8, tail3: 9, tail2: 10, tail1: 11, root: 12 }
export const tigerRank = (id: TigerPartId) => RANK[id]

export interface TigerFrame { x: number; y: number; facing: 1 | -1; lift: number; pitch: number; shift: number; neck: number; head: number; jaw: number; roar: number; tail: readonly number[]; paw: readonly number[]; sink: number; hop: number; turn: number }
export interface TigerLeg { readonly root: Point; readonly joint: Point; readonly paw: Point; readonly up: number; readonly low: number; readonly lifted: number }
/** 그림이 읽는 뼈 (모두 몸 쪽 좌표: 발 바닥 가운데 0 · 앞 +x · 아래 +y) */
export interface TigerSkeleton {
  readonly body: Readonly<{ at: Point; angle: number }>
  readonly legs: Readonly<Record<LegId, TigerLeg>>
  readonly neck: Readonly<{ from: Point; to: Point; angle: number }>
  readonly head: Readonly<{ at: Point; angle: number; roar: number }>
  readonly jaw: Readonly<{ at: Point; angle: number; open: number }>
  readonly mouth: Point
  readonly tail: readonly Point[]
  readonly tailAngles: readonly number[]
  readonly arrows: Readonly<{ at: Point; angle: number }>
}
export interface TigerPose extends ImugiPose<TigerPartId> { readonly kind: 'tiger'; readonly facing: 1 | -1; readonly anchor: Point; readonly sink: number; readonly turn: number; readonly sk: TigerSkeleton }
export interface TigerWindup { readonly body: number; readonly hold: number; readonly red: number; readonly total: number; readonly use: number }
export interface TigerAttack {
  windup: Readonly<TigerWindup>; seq: number; move: TigerMove; side: 1 | -1; requires: readonly TigerHp[]
  shapes: readonly Shape[]; followShapes: readonly Shape[]; sub: number; pending: boolean; hit: boolean; damage: number; recover: number; strike: number; impactAt: number
  activeShapes?: readonly Shape[]; front?: number; lines?: readonly number[]; mounds?: readonly Point[]; real?: number; push?: number; landing?: Point
}
export interface TigerMotion { move: TigerMove | null; from: TigerFrame; prepared: TigerFrame; impact: TigerFrame; relaxed: TigerFrame; current: TigerFrame; recoverFrom: TigerFrame; recoverSeconds: number; progress: number; blocked: boolean; walk: number; prowlTo: Point | null }
export interface TigerState {
  kind: 'tiger'; phase: 1 | 2 | 3; state: 'entry' | 'body' | 'hold' | 'tell' | 'strike' | 'recover' | 'roar' | 'prowl' | 'dead'; pattern: TigerMove | null
  seq: number; age: number; timer: number; enraged: boolean; last: TigerMove | null; recoveryHitUsed: boolean; stagger: number; submerge: number
  windupUses: Partial<Record<TigerMove, number>>; brokenSeen: TigerHp[]; brokenAt: Partial<Record<TigerHp, number>>
  partHP: Record<TigerHp, number>; partMax: Record<TigerHp, number>; pose: TigerPose; motion: TigerMotion; attack: TigerAttack | null
  environment: { phase: 1 | 2 | 3; shapes: readonly Shape[]; age: number; active: boolean; nextHit: number }
  bounds: { left: number; top: number; right: number; bottom: number }; lastHitPart: TigerPartId; poisonPart: TigerPartId
}

const K = T.rig.scale, R = T.rig, M = T.motion, W = C.width, H = C.height
const point = (x: number, y: number): Point => ({ x, y })
const unit = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => { const t = unit(x); return t * t * (3 - 2 * t) }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const sc = (p: readonly number[]) => point(p[0]! * K, p[1]! * K)
function deepFreeze<V>(v: V): V { if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) { for (const x of Object.values(v)) deepFreeze(x); Object.freeze(v) } return v }
const frozen = (shapes: readonly Shape[]): readonly Shape[] => Object.freeze(shapes.map(freezeTell))
const box = (x: number, y: number, halfX: number, halfY: number): Shape => ({ kind: 'box', center: point(x, y), halfX, halfY, angle: 0 })

type Spec = { readonly lift: number; readonly pitch: number; readonly shift: number; readonly neck: number; readonly head: number; readonly jaw: number; readonly roar: number; readonly tail: readonly number[]; readonly paw: readonly number[]; readonly sink: number }
/** params 자세 하나를 실제 크기 자세로 (side -1 이면 앞발 가까운·먼 쪽을 맞바꾼다) */
function frameOf(x: number, y: number, facing: 1 | -1, s: Spec, side: 1 | -1 = 1): TigerFrame {
  const paw = s.paw.map(v => v * K)
  if (side === -1) { const [a, b, c, d] = paw; paw[0] = c!; paw[1] = d!; paw[2] = a!; paw[3] = b! }
  return { x, y, facing, lift: s.lift * K, pitch: s.pitch, shift: s.shift * K, neck: s.neck, head: s.head, jaw: s.jaw, roar: s.roar, tail: [...s.tail], paw, sink: s.sink, hop: 0, turn: 0 }
}
const restAt = (x: number, y: number, facing: 1 | -1) => frameOf(x, y, facing, M.rest)
/** 시험·검수: params 자세 이름으로 실제 크기 자세를 만든다 */
export const tigerFrame = (x: number, y: number, facing: 1 | -1, s: Spec, side: 1 | -1 = 1) => frameOf(x, y, facing, s, side)
function blend(a: TigerFrame, b: TigerFrame, t: number): TigerFrame {
  const k = smooth(t), l = (x: number, y: number) => lerp(x, y, k)
  return { x: l(a.x, b.x), y: l(a.y, b.y), facing: a.facing !== b.facing && k < .5 ? a.facing : b.facing, lift: l(a.lift, b.lift), pitch: l(a.pitch, b.pitch), shift: l(a.shift, b.shift), neck: l(a.neck, b.neck), head: l(a.head, b.head), jaw: l(a.jaw, b.jaw), roar: l(a.roar, b.roar),
    tail: a.tail.map((v, i) => l(v, b.tail[i] ?? 0)), paw: a.paw.map((v, i) => l(v, b.paw[i] ?? 0)), sink: l(a.sink, b.sink), hop: l(a.hop, b.hop), turn: a.facing !== b.facing ? 1 - Math.abs(2 * k - 1) : l(a.turn, b.turn) }
}

// ── 뼈대 (한 틱의 순수 셈) ──
const toWorld = (anchor: Point, facing: 1 | -1, p: Point) => point(anchor.x + facing * p.x, anchor.y + p.y)
const worldAngle = (facing: 1 | -1, a: number) => facing === 1 ? a : Math.PI - a
const rot = (a: number, p: Point) => point(Math.cos(a) * p.x - Math.sin(a) * p.y, Math.sin(a) * p.x + Math.cos(a) * p.y)
const add = (a: Point, b: Point) => point(a.x + b.x, a.y + b.y)
/** 두 마디 다리 — bend +1 이면 관절이 앞(+x) 쪽 · 닿지 못하면 발을 뼈 길이까지 당긴다 */
function ik(root: Point, target: Point, l1: number, l2: number, bend: number) {
  let dx = target.x - root.x, dy = target.y - root.y, d = Math.hypot(dx, dy)
  if (d < 1e-9) { dx = 0; dy = 1; d = 1 }
  const ux = dx / d, uy = dy / d, reach = Math.max(Math.abs(l1 - l2) + 1e-6, Math.min((l1 + l2) * .999, d))
  const a = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach), h = Math.sqrt(Math.max(0, l1 * l1 - a * a))
  const joint = point(root.x + ux * a + bend * uy * h, root.y + uy * a - bend * ux * h), paw = point(root.x + ux * reach, root.y + uy * reach)
  return { joint, paw }
}
export interface Broken { readonly has: (id: TigerHp) => boolean }
/** 자세(frame) + 부서진 부위 → 뼈대 (몸 쪽 좌표) */
export function tigerSkeleton(f: TigerFrame, broken: Broken): TigerSkeleton {
  const hip = sc(R.hip), a = -f.pitch, dx = f.shift, dy = f.lift - f.hop
  const X = (p: Point) => { const q = rot(a, point(p.x - hip.x, p.y - hip.y)); return point(hip.x + q.x + dx, hip.y + q.y + dy) }
  const legs = {} as Record<LegId, TigerLeg>
  LEG_ORDER.forEach((id, i) => {
    const fore = id.startsWith('fore'), spec = fore ? R.fore : R.hind, far = id.endsWith('far') ? sc(R.far) : point(0, 0)
    const limp = broken.has(id) ? 1 : 0, rest = add(sc(spec.paw), far)
    const root = X(add(sc(fore ? R.shoulder : R.hip), far))
    const target = point(rest.x + (f.paw[i * 2] ?? 0) + limp * M.limp.back * K, rest.y + (f.paw[i * 2 + 1] ?? 0) - f.hop + limp * M.limp.lift * K)
    const { joint, paw } = ik(root, target, spec.up * K, spec.low * K, spec.bend)
    legs[id] = { root, joint, paw, up: Math.atan2(joint.y - root.y, joint.x - root.x), low: Math.atan2(paw.y - joint.y, paw.x - joint.x), lifted: Math.max(0, -(paw.y - rest.y)) }
  })
  const neckFrom = X(sc(R.neckBase)), neckAngle = a + R.neck.angle + f.neck, neckTo = add(neckFrom, rot(neckAngle, point(R.neck.length * K, 0)))
  const headAngle = a + R.head.angle + f.head, inHead = (p: readonly number[]) => add(neckTo, rot(headAngle, sc(p)))
  const jawOpen = broken.has('jaw') ? R.jaw.dangle : unit(f.jaw) * (1 - unit(f.roar)), jawAngle = headAngle + R.jaw.angle + jawOpen * R.jaw.open
  const tail: Point[] = [X(sc(R.tailBase))], tailAngles: number[] = []
  let ta = a
  for (let i = 0; i < R.tail.lengths.length; i++) {
    ta += R.tail.rest[i]! + (broken.has('tail') ? M.droop[i]! : f.tail[i] ?? 0)
    tailAngles.push(ta); tail.push(add(tail[i]!, rot(ta, point(R.tail.lengths[i]! * K, 0))))
  }
  return { body: { at: X(sc(R.body.pivot)), angle: a }, legs, neck: { from: neckFrom, to: neckTo, angle: neckAngle }, head: { at: neckTo, angle: headAngle, roar: unit(f.roar) },
    jaw: { at: inHead(R.head.hinge), angle: jawAngle, open: jawOpen }, mouth: inHead(R.head.mouth), tail, tailAngles, arrows: { at: X(sc(R.arrows)), angle: a } }
}
interface PoseFlags { ownerId: number; tick: number; alive: boolean; targetable: boolean; recovering: boolean; partHP: Readonly<Record<TigerHp, number>> }
/** 판정 부위(collider)와 뼈를 함께 — 그림과 판정이 같은 점을 쓴다 */
export function makeTigerPose(f: TigerFrame, o: PoseFlags): TigerPose {
  const broken: Broken = { has: id => o.partHP[id] <= 0 }, sk = tigerSkeleton(f, broken), anchor = point(f.x, f.y)
  const W2 = (p: Point) => toWorld(anchor, f.facing, p), A = (a: number) => worldAngle(f.facing, a)
  const visible = o.alive && f.sink < T.sinkHidden, parts: PartPose<TigerPartId>[] = []
  const put = (id: TigerPartId, start: Point, end: Point, angle: number, collider: Collider, extra?: { mouth: Point }) => {
    const key = tigerHpOf(id), damaged = key !== null && o.partHP[key] <= 0, severed = damaged && id !== 'head', shown = visible && !(id === 'arrows' && damaged)
    parts.push({ id, parent: PARENT[id], start, end, angle, mirrorY: f.facing, alive: o.alive, broken: severed, damaged, visible: shown, targetable: shown && !severed && o.targetable, height: 0, widthScale: 1, collider, ...extra })
  }
  const cap = (a: Point, b: Point, r: number): Collider => ({ kind: 'capsule', from: a, to: b, radius: r })
  const half = R.body.half * K, b0 = W2(add(sk.body.at, rot(sk.body.angle, point(-half, 0)))), b1 = W2(add(sk.body.at, rot(sk.body.angle, point(half, 0))))
  put('root', b0, b1, A(sk.body.angle), cap(b0, b1, R.body.radius * K))
  const n0 = W2(sk.neck.from), n1 = W2(sk.neck.to)
  put('neck', n0, n1, A(sk.neck.angle), cap(n0, n1, R.neck.radius * K))
  const hc = W2(add(sk.head.at, rot(sk.head.angle, sc(R.head.center)))), mouth = W2(sk.mouth)
  put('head', n1, mouth, A(sk.head.angle), { kind: 'ellipse', center: hc, rx: R.head.radii[0] * K, ry: R.head.radii[1] * K, angle: A(sk.head.angle) })
  const j0 = W2(sk.jaw.at), j1 = W2(add(sk.jaw.at, rot(sk.jaw.angle, point(R.jaw.length * K, 0))))
  put('jaw', j0, j1, A(sk.jaw.angle), cap(j0, j1, R.jaw.radius * K), { mouth })
  for (const id of LEG_ORDER) { const l = sk.legs[id], r0 = W2(l.root), p = W2(l.paw); put(id, r0, p, A(Math.atan2(l.paw.y - l.root.y, l.paw.x - l.root.x)), cap(r0, p, (id.startsWith('fore') ? R.fore : R.hind).radius * K)) }
  const tailIds: readonly TigerPartId[] = ['tail1', 'tail2', 'tail3', 'tail-tip']
  tailIds.forEach((id, i) => { const s0 = W2(sk.tail[i]!), s1 = W2(sk.tail[i + 1]!); put(id, s0, s1, A(sk.tailAngles[i]!), cap(s0, s1, R.tail.radius[i]! * K)) })
  const ar = W2(sk.arrows.at)
  put('arrows', ar, ar, A(sk.arrows.angle), cap(ar, ar, R.arrowsRadius * K))
  return deepFreeze({ kind: 'tiger' as const, ownerId: o.ownerId, tick: o.tick, parts, worldGeometry: { parts: parts.map(p => ({ id: p.id, shape: p.collider })), tell: [] as Shape[] }, jawOpen: sk.jaw.open, recovering: o.recovering, facing: f.facing, anchor, sink: f.sink, turn: f.turn, sk })
}
export function tigerCollisionBounds(pose: TigerPose) {
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
function environment(phase: 1 | 2 | 3): TigerState['environment'] {
  const e = T.env.border, s = T.env.side, side = (W - T.env.gap) / 4
  // 막 1 바깥 서리: 위아래 띠는 가운데를 비워 세로 3P 길이 판 끝까지 이어진다
  const shapes: Shape[] = phase === 1 ? [{ kind: 'union', shapes: [box(side, e / 2, side, e / 2), box(W - side, e / 2, side, e / 2), box(side, H - e / 2, side, e / 2), box(W - side, H - e / 2, side, e / 2), box(e / 2, H / 2, e / 2, H / 2), box(W - e / 2, H / 2, e / 2, H / 2)] }]
    : phase === 2 ? [{ kind: 'union', shapes: [box(s / 2, H / 2, s / 2, H / 2), box(W - s / 2, H / 2, s / 2, H / 2)] }]
    : [{ kind: 'union', shapes: T.env.strips.map(([share, width]) => box(share * W, H / 2, width / 2, H / 2)) }]
  return { phase, shapes: frozen(shapes), age: 0, active: false, nextHit: 0 }
}
const flags = (g: TigerState, e: GiantOwner, tick: number, planning = false): PoseFlags => ({ ownerId: e.id, tick, alive: e.hp > 0 && g.state !== 'dead', targetable: planning || g.state !== 'entry', recovering: g.state === 'recover', partHP: g.partHP })
const poseOf = (g: TigerState, e: GiantOwner, f: TigerFrame, tick: number, planning = false) => makeTigerPose(f, flags(g, e, tick, planning))
/** 같은 발 자리를 쓰는 자세들을 한 번에 판 안으로 — 옮길 몫 (몸이 판보다 크면 null) */
function shiftInto(g: TigerState, e: GiantOwner, frames: readonly TigerFrame[], tick: number): Point | null {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  for (const f of frames) { const b = tigerCollisionBounds(poseOf(g, e, { ...f, sink: 0 }, tick, true)); left = Math.min(left, b.left); right = Math.max(right, b.right); top = Math.min(top, b.top); bottom = Math.max(bottom, b.bottom) }
  if (right - left > W || bottom - top > H) return null
  return point(left < 0 ? -left : right > W ? W - right : 0, top < 0 ? -top : bottom > H ? H - bottom : 0)
}
const moved = (f: TigerFrame, d: Point): TigerFrame => ({ ...f, x: f.x + d.x, y: f.y + d.y })
/** 판 안에 판정 부위가 다 들어오게 발 자리를 옮긴다 · 몸이 판보다 크면 null */
export function fitTigerFrame(g: TigerState, e: GiantOwner, f: TigerFrame, tick: number): TigerFrame | null {
  const d = shiftInto(g, e, [f], tick); return d && moved(f, d)
}
/** 제자리 수(후려치기·꼬리·포효·눈사태): 준비·타격·회복 자세를 한 발 자리로 맞춘다 */
function fitAll(g: TigerState, e: GiantOwner, frames: readonly TigerFrame[], tick: number): TigerFrame[] | null {
  const d = shiftInto(g, e, frames, tick); return d && frames.map(f => moved(f, d))
}
export function createTiger(e: GiantOwner, tick = 0): TigerState {
  const partMax = Object.fromEntries(TIGER_HP.map(id => [id, T.hp * T.parts[id]])) as Record<TigerHp, number>, base = restAt(e.x, T.homeY, e.x <= W / 2 ? 1 : -1)
  const motion: TigerMotion = { move: null, from: base, prepared: base, impact: base, relaxed: base, current: base, recoverFrom: base, recoverSeconds: T.idleRecovery, progress: 0, blocked: false, walk: 0, prowlTo: null }
  const g: TigerState = { kind: 'tiger', phase: 1, state: 'entry', pattern: null, seq: 0, age: 0, timer: T.entrySeconds, enraged: false, last: null, recoveryHitUsed: false, stagger: 0, submerge: 0,
    windupUses: {}, brokenSeen: [], brokenAt: {}, partHP: { ...partMax }, partMax, pose: makeTigerPose(base, { ownerId: e.id, tick, alive: true, targetable: false, recovering: false, partHP: partMax }), motion, attack: null,
    environment: environment(1), bounds: { left: 0, top: 0, right: W, bottom: H }, lastHitPart: 'root', poisonPart: 'root' }
  const fit = fitTigerFrame(g, e, base, tick) ?? base
  g.motion = { ...motion, from: fit, prepared: fit, impact: fit, relaxed: fit, current: fit, recoverFrom: fit }
  updateTigerPose(g, e, tick); return g
}

// ── 수 ──
const brokenAny = (g: TigerState, ids: readonly TigerHp[]) => ids.some(id => g.partHP[id] <= 0)
export const REQUIRES: Record<TigerMove, (side: 1 | -1) => readonly TigerHp[]> = { swipe: side => [side === 1 ? 'fore-near' : 'fore-far'], tail: () => ['tail'], pounce: () => [], roar: () => ['jaw'], dive: () => [], avalanche: () => [] }
const pawRest = (id: LegId) => { const spec = id.startsWith('fore') ? R.fore : R.hind; return add(sc(spec.paw), id.endsWith('far') ? sc(R.far) : point(0, 0)) }
const facingTo = (f: TigerFrame, target: Point): 1 | -1 => Math.abs(target.x - f.x) < T.turnDeadZone ? f.facing : target.x < f.x ? -1 : 1
/** 고정 tick 의 수 후보 — 막 · 같은 수 연속 금지 · 거리 · 앞뒤 · 살아 있는 부위 (난수 없음) */
export function tigerCandidates(g: TigerState, e: GiantOwner, target: Point): TigerMove[] {
  if (e.hp <= 0 || g.state === 'dead') return []
  const f = g.motion.current
  return (Object.keys(T.moves) as TigerMove[]).filter(move => {
    if (move === g.last || g.phase < T.moves[move].phase) return false
    const facing = move === 'tail' ? f.facing : facingTo(f, target)
    if (move === 'swipe') {
      const side = swipeSide(f, target), paw = toWorld(point(f.x, f.y), facing, pawRest(side === 1 ? 'fore-near' : 'fore-far'))
      return !brokenAny(g, REQUIRES.swipe(side)) && Math.hypot(target.x - paw.x, target.y - paw.y) <= T.moves.swipe.reach && (target.x - f.x) * facing > -T.moves.swipe.radius / 2
    }
    if (move === 'tail') { const base = toWorld(point(f.x, f.y), f.facing, sc(R.tailBase)); return !brokenAny(g, REQUIRES.tail(1)) && (target.x - f.x) * f.facing < 0 && Math.hypot(target.x - base.x, target.y - base.y) <= T.moves.tail.reach }
    if (move === 'pounce') { const d = Math.hypot(target.x - f.x, target.y - f.y); return d >= T.moves.pounce.min && d <= T.moves.pounce.max + R.fore.paw[0] * K }
    return !brokenAny(g, REQUIRES[move](1))
  })
}
const swipeSide = (f: TigerFrame, target: Point): 1 | -1 => target.y >= f.y - T.moves.swipe.sideBias * K ? 1 : -1
export function tigerWindup(g: TigerState, move: TigerMove, wiggle = 0): Readonly<TigerWindup> {
  const m = T.moves[move], use = (g.windupUses[move] ?? 0) + 1
  const hold = move === 'pounce' ? wiggle : (use - 1) % 2 * G.windup.repeatHold
  return Object.freeze({ body: m.body, hold, red: m.red, total: m.body + hold + m.red, use })
}
export interface TigerPlan { move: TigerMove; side: 1 | -1; prepared: TigerFrame; impact: TigerFrame; relaxed: TigerFrame; shapes: readonly Shape[]; lines?: readonly number[]; mounds?: readonly Point[]; impacts?: readonly TigerFrame[]; relaxes?: readonly TigerFrame[]; safeSeconds: number }
/** 몸·착지·붉은 바닥을 붉은빛 앞에 모두 정한다 — 그 뒤엔 따라가거나 돌거나 옮기지 않는다 */
export function planTiger(g: TigerState, e: GiantOwner, target: Point, move: TigerMove, tick: number): TigerPlan | null {
  const from = g.motion.current, facing = move === 'tail' ? from.facing : facingTo(from, target), m = T.moves, broken: Broken = { has: id => g.partHP[id] <= 0 }
  const at = (x: number, y: number, s: Spec, side: 1 | -1 = 1) => frameOf(x, y, facing, s, side)
  /** 착지하는 수(덮치기·잠행): 착지 자세와 회복 자세를 함께 판 안으로 */
  const landAt = (x: number, y: number, s: Spec) => fitAll(g, e, [at(x, y, s), at(x, y, M.recover)], tick)
  if (move === 'swipe') {
    const side = swipeSide(from, target), leg: LegId = side === 1 ? 'fore-near' : 'fore-far', i = side === 1 ? 0 : 1
    let x = from.x, y = from.y
    // 발에서 장수 쪽 부채(앞 반쪽만) · 몸이 판 끝에서 밀리면 밀린 자리에서 한 번 더 잰다
    for (let pass = 0; pass < 2; pass++) {
      const paw = toWorld(point(x, y), facing, pawRest(leg)), local = point(facing * (target.x - paw.x), target.y - paw.y)
      const back = m.swipe.tilt * m.swipe.backTilt, ang = Math.max(side === 1 ? -back : -m.swipe.tilt, Math.min(side === 1 ? m.swipe.tilt : back, Math.atan2(local.y, local.x)))
      const hit = at(x, y, M.swipe.impact, side), paws = [...hit.paw]
      paws[i * 2] = (paws[i * 2] ?? 0) + Math.cos(ang) * m.swipe.swing * K; paws[i * 2 + 1] = (paws[i * 2 + 1] ?? 0) + Math.max(0, Math.sin(ang)) * m.swipe.swing * K * m.swipe.dip
      const frames = [at(x, y, M.swipe.prepare, side), { ...hit, paw: paws }, at(x, y, M.recover)], d = shiftInto(g, e, frames, tick)
      if (!d) return null
      if (d.x === 0 && d.y === 0) return { move, side, prepared: frames[0]!, impact: frames[1]!, relaxed: frames[2]!, shapes: frozen([{ kind: 'cone', center: paw, radius: m.swipe.radius, angle: worldAngle(facing, ang), halfAngle: m.swipe.halfAngle }]), safeSeconds: 0 }
      x += d.x; y += d.y
    }
    return null
  }
  if (move === 'tail') {
    const fit = fitAll(g, e, [at(from.x, from.y, M.tail.prepare), at(from.x, from.y, M.tail.impact), at(from.x, from.y, M.recover)], tick); if (!fit) return null
    const [prepared, impact, relaxed] = fit as [TigerFrame, TigerFrame, TigerFrame], anchor = point(prepared.x, prepared.y)
    const base = toWorld(anchor, facing, tigerSkeleton(prepared, broken).tail[0]!)
    // 꼬리 끝이 실제로 지나는 자리를 다 덮도록 호를 넓힌다 (빨강 = 실제 피해)
    let inner: number = m.tail.inner, outer: number = m.tail.outer
    for (let k = 0; k <= 8; k++) { const sk = tigerSkeleton(blend(prepared, impact, k / 8), broken), tip = toWorld(anchor, facing, sk.tail[sk.tail.length - 1]!), d = Math.hypot(tip.x - base.x, tip.y - base.y), r = R.tail.radius[3]! * K; inner = Math.min(inner, d - r); outer = Math.max(outer, d + r) }
    return { move, side: 1, prepared, impact, relaxed, shapes: frozen([{ kind: 'arc', center: base, inner: Math.max(0, inner), outer, angle: worldAngle(facing, Math.PI), halfAngle: m.tail.halfAngle }]), safeSeconds: 0 }
  }
  if (move === 'pounce') {
    const prepared = fitTigerFrame(g, e, at(from.x, from.y, M.pounce.prepare), tick); if (!prepared) return null
    const rest = pawRest('fore-near'), start = toWorld(point(prepared.x, prepared.y), facing, rest)
    const v = point(target.x - start.x, target.y - start.y), d = Math.hypot(v.x, v.y) || 1
    const leap = Math.min(m.pounce.max, Math.max(m.pounce.min, d)) * (brokenAny(g, ['hind-near', 'hind-far']) ? m.pounce.brokenLeap : 1)
    const land0 = landAt(start.x + v.x / d * leap - facing * rest.x, start.y + v.y / d * leap - rest.y, M.pounce.impact); if (!land0) return null
    const [impact, relaxed] = land0 as [TigerFrame, TigerFrame], land = toWorld(point(impact.x, impact.y), facing, rest)
    const angle = Math.hypot(land.x - start.x, land.y - start.y) > 1 ? Math.atan2(land.y - start.y, land.x - start.x) : worldAngle(facing, 0)
    return { move, side: 1, prepared, impact, relaxed, shapes: frozen([{ kind: 'ellipse', center: land, rx: m.pounce.rx, ry: m.pounce.ry, angle }]), safeSeconds: m.pounce.red }
  }
  if (move === 'roar') {
    const fit = fitAll(g, e, [at(from.x, from.y, M.roar.prepare), at(from.x, from.y, M.roar.impact), at(from.x, from.y, M.recover)], tick); if (!fit) return null
    const band = m.roar.band * W
    return { move, side: 1, prepared: fit[0]!, impact: fit[1]!, relaxed: fit[2]!, shapes: frozen([box(band / 2, H / 2, band / 2, H / 2), box(W - band / 2, H / 2, band / 2, H / 2)]), safeSeconds: 0 }
  }
  if (move === 'dive') {
    const prepared = fitTigerFrame(g, e, at(from.x, from.y, M.dive.prepare), tick); if (!prepared) return null
    // 눈 더미는 판 아래 끝(체력 막대 자리)까지 내려가지 않는다 · 장수가 더 아래면 원 위쪽이 장수에 닿는다
    const s = m.dive.spread, cx = Math.max(s + m.dive.radius, Math.min(W - s - m.dive.radius, target.x)), cy = Math.min(H - m.dive.radius * m.dive.floor, target.y)
    const mounds: Point[] = [], impacts: TigerFrame[] = [], relaxes: TigerFrame[] = []
    for (const k of [-1, 0, 1]) { const f = landAt(cx + k * s, cy, M.dive.impact); if (!f) return null; impacts.push(f[0]!); relaxes.push(f[1]!); mounds.push(point(f[0]!.x, f[0]!.y)) }
    return { move, side: 1, prepared, impact: impacts[1]!, relaxed: relaxes[1]!, shapes: frozen([{ kind: 'circle', center: mounds[1]!, radius: m.dive.radius }]), mounds: Object.freeze(mounds), impacts, relaxes, safeSeconds: m.dive.red }
  }
  const fit = fitAll(g, e, [at(from.x, from.y, M.avalanche.prepare), at(from.x, from.y, M.avalanche.impact), at(from.x, from.y, M.recover)], tick); if (!fit) return null
  const a = m.avalanche, n = brokenAny(g, ['fore-near', 'fore-far']) ? a.brokenLines : a.lines, step = a.width + a.gap
  const span = (n - 1) * step, toward = target.x < W / 2 ? 1 : -1
  // 줄 셋이면 장수가 가운데 줄 · 둘이면 장수 줄과 판 가운데 쪽 줄 (줄 사이 3P 는 늘 빈다)
  const first = Math.max(a.width / 2, Math.min(W - a.width / 2 - span, n === 3 ? target.x - step : toward === 1 ? target.x : target.x - step))
  const lines = Array.from({ length: n }, (_, k) => first + k * step)
  return { move, side: 1, prepared: fit[0]!, impact: fit[1]!, relaxed: fit[2]!, shapes: frozen(lines.map(x => box(x, H / 2, a.width / 2, H / 2))), lines: Object.freeze(lines), safeSeconds: 0 }
}
/** 이 수를 지금 안전하게 쓸 수 있는가 — 잠행은 어느 더미가 진짜여도 피할 길이 있어야 한다 */
function feasible(g: TigerState, plan: TigerPlan, player: Point, speed: number): boolean {
  const w = tigerWindup(g, plan.move, plan.move === 'pounce' ? T.moves.pounce.wiggle : 0), seconds = plan.safeSeconds || w.total
  if (plan.mounds) return plan.mounds.every(c => safeLanding([{ kind: 'circle', center: c, radius: T.moves.dive.radius }], g.environment.shapes, player, speed, seconds) !== null)
  return safeLanding(plan.shapes, g.environment.shapes, player, speed, seconds) !== null
}
/**
 * 후보에서 난수 하나로 고르고, 그 수를 실제로 세워 본다(몸이 판에 들어가고 피할 길이 있는가) — 안 되면 후보 차례로 다음 수.
 * 빈 후보는 난수를 쓰지 않는다 · 후보를 모두 세워 보지 않아 결정하는 틱이 가볍다 (폰에서 그 틱이 끊기지 않게).
 */
export function chooseTigerPlan(g: TigerState, e: GiantOwner, target: Point, speed: number, tick: number, random: () => number): TigerPlan | null {
  const moves = tigerCandidates(g, e, target); if (!moves.length) return null
  const first = Math.min(moves.length - 1, Math.floor(random() * moves.length))
  for (let k = 0; k < moves.length; k++) { const p = planTiger(g, e, target, moves[(first + k) % moves.length]!, tick); if (p && feasible(g, p, target, speed)) return p }
  return null
}
export function beginTigerPlan(g: TigerState, e: GiantOwner, plan: TigerPlan, tick: number, random: () => number): void {
  const m = T.moves[plan.move], wiggle = plan.move === 'pounce' ? T.moves.pounce.wiggle * random() : 0, w = tigerWindup(g, plan.move, wiggle)
  let { impact, relaxed, shapes } = plan, real: number | undefined
  if (plan.mounds && plan.impacts && plan.relaxes) {
    real = Math.min(2, Math.floor(random() * 3)); impact = plan.impacts[real]!; relaxed = plan.relaxes[real]!
    shapes = frozen([{ kind: 'circle', center: plan.mounds[real]!, radius: T.moves.dive.radius }])
  }
  g.windupUses[plan.move] = w.use; g.last = plan.move; g.pattern = plan.move; g.seq++; g.state = 'body'; g.timer = w.body
  g.motion = { ...g.motion, move: plan.move, from: g.motion.current, prepared: plan.prepared, impact, relaxed, recoverFrom: impact, recoverSeconds: m.recover, progress: 0, blocked: false, prowlTo: null }
  g.attack = { windup: w, seq: g.seq, move: plan.move, side: plan.side, requires: REQUIRES[plan.move](plan.side), shapes, followShapes: Object.freeze([]), sub: 0, pending: false, hit: false, damage: m.damage, recover: m.recover, strike: m.strike, impactAt: m.impactAt,
    ...(plan.lines ? { lines: plan.lines, front: 0 } : {}), ...(plan.mounds ? { mounds: plan.mounds, real: real! } : {}), ...(plan.move === 'pounce' || plan.move === 'dive' ? { landing: point(impact.x, impact.y) } : {}), ...(plan.move === 'roar' ? { push: T.moves.roar.push } : {}) }
  updateTigerPose(g, e, tick)
}
/** 시험·검수용: 이 수를 지금 세운다 (안전하지 않으면 false · 판은 그대로 쉬는 자세로) */
export function beginTigerMove(g: TigerState, e: GiantOwner, target: Point, move: TigerMove, tick: number, speed: number = C.speed, random: () => number = () => 0): boolean {
  const plan = planTiger(g, e, target, move, tick)
  if (!plan || !feasible(g, plan, target, speed)) { g.motion = { ...g.motion, blocked: true }; recover(g, T.idleRecovery); return false }
  beginTigerPlan(g, e, plan, tick, random); return true
}
/** 회복(머리 노출) — 타격 뒤에는 미리 판 안으로 맞춘 회복 자세로 */
function recover(g: TigerState, seconds: number, relaxed?: TigerFrame) {
  const c = g.motion.current
  g.motion = { ...g.motion, move: null, recoverFrom: c, relaxed: relaxed ?? frameOf(c.x, c.y, c.facing, M.recover), recoverSeconds: seconds, prowlTo: null }
  g.state = 'recover'; g.timer = seconds; g.attack = null; g.recoveryHitUsed = false
}
/** 회복 중 첫 타격 — 움찔하고 회복이 조금 늘어난다 (한 번만) */
export function staggerTiger(g: TigerState): void {
  if (g.state !== 'recover') return
  g.stagger = T.staggerSeconds; g.timer = Math.min(g.motion.recoverSeconds + T.staggerRecover, g.timer + T.staggerRecover)
}
/** 부위가 처음 0 이 됐다 — 그 부위가 필요한 예약 수는 취소 · 앞으로도 제외 (부서진 순간을 적어 그림이 터뜨린다) */
export function breakTigerPart(g: TigerState, id: TigerPartId): boolean {
  const key = tigerHpOf(id)
  if (!key || g.partHP[key] > 0 || g.brokenSeen.includes(key)) return false
  g.brokenSeen.push(key); g.brokenAt[key] = g.age; g.stagger = T.staggerSeconds
  if (g.attack && g.attack.requires.includes(key) && g.state !== 'strike') recover(g, T.idleRecovery)
  return true
}
export function endTiger(g: TigerState, e: GiantOwner, tick: number): void { g.state = 'dead'; g.attack = null; g.environment.active = false; updateTigerPose(g, e, tick) }
function startProwl(g: TigerState, e: GiantOwner, player: Point, tick: number): boolean {
  const f = g.motion.current, dir = player.x < f.x ? -1 : 1, home = Math.abs(f.y - T.homeY) > T.homeBand * T.homePull
  const want = point(home ? f.x + dir * T.prowlNear * K : player.x - dir * T.prowlNear, Math.max(T.homeY - T.homeBand, Math.min(T.homeY + T.homeBand, home ? T.homeY : player.y)))
  const to = fitTigerFrame(g, e, { ...restAt(want.x, want.y, f.facing) }, tick)
  if (!to || Math.hypot(to.x - f.x, to.y - f.y) < T.prowlMin) return false
  g.state = 'prowl'; g.timer = T.prowlSeconds; g.attack = null; g.motion = { ...g.motion, move: null, prowlTo: point(to.x, to.y), from: f }
  return true
}
function decide(g: TigerState, e: GiantOwner, input: TigerStep) {
  const plan = chooseTigerPlan(g, e, input.player, input.speed, input.tick, input.random), f = g.motion.current
  const near = plan?.move === 'swipe' || plan?.move === 'tail', away = Math.abs(f.y - T.homeY) > T.homeBand * T.homePull
  if (plan && (near || !away)) { beginTigerPlan(g, e, plan, input.tick, input.random); return }
  if (g.state !== 'prowl' && startProwl(g, e, input.player, input.tick)) return
  if (plan) { beginTigerPlan(g, e, plan, input.tick, input.random); return }
  recover(g, T.idleRecovery)
}
export interface TigerStep { dt: number; tick: number; player: Point; speed: number; dazed: boolean; random: () => number }
/** 준비만 — 장수의 공격이 이 뒤에 들어오고 commitTiger 가 다치기 전에 다시 잰다 */
/** 땅을 울리는 순간 (덮치기 착지 · 잠행 솟구침 · 눈사태 내리찍기 · 등장 착지) — 화면이 멈칫·흔들린다 */
const HEAVY = new Set<TigerMove>(['pounce', 'dive', 'avalanche'])
function landed(g: TigerState, was: number, entryWas: number): boolean {
  if (g.state === 'entry') return entryWas < M.entry.fall && 1 - g.timer / T.entrySeconds >= M.entry.fall
  const a = g.attack
  return !!a && g.state === 'strike' && HEAVY.has(a.move) && was < a.impactAt && g.motion.progress >= a.impactAt
}
export function stepTiger(g: TigerState, e: GiantOwner, input: TigerStep): 'roar' | 'recovery' | 'quake' | null {
  if (e.hp <= 0 || g.state === 'dead') { endTiger(g, e, input.tick); return null }
  const was = g.state === 'strike' ? g.motion.progress : -1, entryWas = g.state === 'entry' ? 1 - g.timer / T.entrySeconds : 2
  g.age += input.dt; g.enraged = g.age >= G.enrageAfter; g.stagger = Math.max(0, g.stagger - input.dt)
  if (g.state !== 'entry') { g.environment.age += input.dt; g.environment.active = g.environment.age >= G.environmentTell }
  if (input.dazed) { updateTigerPose(g, e, input.tick); return null }
  const waiting = g.state === 'body' || g.state === 'hold' || g.state === 'tell', remaining = g.timer - input.dt
  g.timer = Math.max(0, remaining)
  if (g.state === 'prowl') prowl(g, input.dt)
  let cue: 'roar' | 'recovery' | null = null
  if (waiting && remaining <= G.windup.epsilon && g.attack) {
    let carry = Math.max(0, -remaining)
    for (let n = 0; n < 3; n++) {
      const w = g.attack.windup
      if (g.state === 'body' && w.hold > 0) { g.state = 'hold'; g.timer = w.hold - carry }
      else if (g.state === 'body' || g.state === 'hold') { g.state = 'tell'; g.timer = w.red - carry }
      else { g.state = 'strike'; g.timer = g.attack.strike - carry; g.attack.pending = true; break }
      if (g.timer > G.windup.epsilon) break
      carry = Math.max(0, -g.timer)
    }
    g.timer = Math.max(0, g.timer)
  } else if (g.timer === 0) {
    if (g.state === 'strike') { g.motion.current = g.motion.impact; recover(g, g.attack?.recover ?? T.idleRecovery, g.motion.relaxed); cue = 'recovery' }
    else if (g.state === 'entry' || g.state === 'recover' || g.state === 'roar' || g.state === 'prowl') {
      const desired = e.hp / e.max <= G.phaseCuts[1] ? 3 : e.hp / e.max <= G.phaseCuts[0] ? 2 : 1
      if (g.phase < desired) { g.phase = (g.phase + 1) as 2 | 3; g.state = 'roar'; g.timer = T.roarSeconds; g.environment = environment(g.phase); g.motion = { ...g.motion, from: g.motion.current, move: null }; cue = 'roar' }
      else decide(g, e, input)
    }
  }
  updateTigerPose(g, e, input.tick)
  return cue ?? (landed(g, was, entryWas) ? 'quake' : null)
}
function prowl(g: TigerState, dt: number) {
  const to = g.motion.prowlTo, f = g.motion.current
  if (!to) { g.timer = 0; return }
  const dx = to.x - f.x, dy = to.y - f.y, d = Math.hypot(dx, dy), step = Math.min(d, T.prowlSpeed * dt)
  if (d < 1e-6) { g.timer = 0; return }
  const facing: 1 | -1 = Math.abs(dx) > 4 ? (dx < 0 ? -1 : 1) : f.facing
  g.motion.current = { ...f, x: f.x + dx / d * step, y: f.y + dy / d * step, facing }
  g.motion.walk += step / (T.prowlStride * K) * Math.PI * 2
  if (step >= d) g.timer = 0
}
function chosenFrame(g: TigerState): TigerFrame {
  const m = g.motion, a = g.attack
  if (g.state === 'entry') {
    // 하늘에서 내려앉는다: 떨어지는 동안 높이 → 착지 순간 몸이 눌렸다 편다 (기준은 처음 자세 m.from)
    const k = 1 - g.timer / T.entrySeconds, fall = 1 - smooth(k / M.entry.fall), land = k > M.entry.fall ? Math.sin(Math.PI * unit((k - M.entry.fall) / (1 - M.entry.fall))) : 0
    return { ...m.from, hop: T.entryDrop * fall * fall, lift: m.from.lift + land * M.entry.squash * K, pitch: m.from.pitch - land * M.entry.pitch, jaw: land * M.entry.jaw }
  }
  if (g.state === 'body') return blend(m.from, m.prepared, 1 - g.timer / (a?.windup.body || 1))
  if (g.state === 'hold') {
    if (a?.move !== 'pounce') return m.prepared
    const t = a.windup.hold - g.timer
    return { ...m.prepared, shift: m.prepared.shift + Math.sin(t * Math.PI * 2 * M.pounce.wiggleHz) * M.pounce.wiggleShift * K, tail: m.prepared.tail.map((v, i) => v + Math.sin(t * Math.PI * 2 * M.pounce.wiggleHz + i) * M.pounce.wiggleTail) }
  }
  if (g.state === 'tell') return m.prepared
  if (g.state === 'strike' && a) {
    const p = unit(1 - g.timer / a.strike); m.progress = p
    if (a.move === 'pounce') { const f = blend(m.prepared, m.impact, p); return { ...f, hop: T.moves.pounce.hop * K * Math.sin(Math.PI * p), x: lerp(m.prepared.x, m.impact.x, p), y: lerp(m.prepared.y, m.impact.y, p) } }
    if (a.move === 'dive') return { ...m.impact, sink: 1 - smooth(p / Math.max(a.impactAt, 1e-6)) }
    if (a.move === 'avalanche') return blend(m.prepared, m.impact, p / Math.max(a.impactAt, 1e-6))
    return blend(m.prepared, m.impact, p / Math.max(a.impactAt, 1e-6))
  }
  if (g.state === 'recover') return blend(m.recoverFrom, m.relaxed, 1 - g.timer / Math.max(1e-6, m.recoverSeconds))
  if (g.state === 'roar') { const k = Math.sin(Math.PI * unit(1 - g.timer / T.roarSeconds)), r = frameOf(m.from.x, m.from.y, m.from.facing, M.roar.impact); return blend(m.from, r, k) }
  if (g.state === 'prowl') {
    const w = m.walk, paw = m.current.paw.map((_, i) => { const leg = Math.floor(i / 2), phase = w + (leg === 0 || leg === 3 ? 0 : Math.PI); return i % 2 === 0 ? Math.sin(phase) * M.walk.swing * K : -Math.max(0, Math.cos(phase)) * M.walk.raise * K })
    return { ...restAt(m.current.x, m.current.y, m.current.facing), paw, lift: Math.sin(w * 2) * M.walk.bob * K, tail: [Math.sin(w) * M.walk.tail[0], Math.sin(w + 1) * M.walk.tail[1], 0, 0] }
  }
  return m.current
}
/** 숨·꼬리 흔들림·움찔 — 판 시각(age)만 쓴다 */
function alive(g: TigerState, f: TigerFrame): TigerFrame {
  if (g.state === 'dead') return f
  const b = M.breath, t = g.age, s = g.stagger > 0 ? Math.sin(Math.PI * g.stagger / T.staggerSeconds) : 0
  const lame = (['fore-near', 'fore-far'] as const).some(id => g.partHP[id] <= 0) ? M.limp.sag : (['hind-near', 'hind-far'] as const).some(id => g.partHP[id] <= 0) ? -M.limp.sag : 0
  const swing = g.attack?.move === 'tail' && (g.state === 'strike' || g.state === 'tell') ? 0 : 1
  return { ...f, lift: f.lift + Math.sin(t * Math.PI * 2 * b.hz) * b.lift * K, pitch: f.pitch - lame + s * M.stagger.pitch, shift: f.shift + s * M.stagger.shift * K, head: f.head + s * M.stagger.head,
    tail: f.tail.map((v, i) => v + swing * Math.sin(t * Math.PI * 2 * b.tailHz + i * b.tailPhase) * b.tail) }
}
export function updateTigerPose(g: TigerState, e: GiantOwner, tick: number): void {
  const chosen = chosenFrame(g)
  g.motion.current = { ...chosen, hop: 0, turn: 0 }
  const f = alive(g, chosen)
  e.x = f.x; e.y = f.y; g.submerge = f.sink
  const pose = poseOf(g, e, f, tick)
  g.pose = Object.freeze({ ...pose, worldGeometry: Object.freeze({ ...pose.worldGeometry, tell: (g.state === 'tell' || g.state === 'strike') && g.attack ? g.attack.shapes : Object.freeze([]) }) })
  g.bounds = tigerCollisionBounds(pose)
  const a = g.attack
  if (a?.move === 'avalanche' && a.lines) {
    if (g.state === 'strike') {
      // 내리찍은(impactAt) 뒤에야 위에서 눈이 쏟아지기 시작해 남은 시간 동안 판 끝까지 내려온다
      const prev = a.front ?? 0, front = unit((1 - g.timer / a.strike - a.impactAt) / (1 - a.impactAt)) * H, half = T.moves.avalanche.width / 2
      a.activeShapes = front > prev ? frozen(a.lines.map(x => box(x, (prev + front) / 2, half, (front - prev) / 2))) : Object.freeze([]); a.front = front
    } else { a.activeShapes = Object.freeze([]); a.front = 0 }
  }
}
/** 장수 맞음 판정 — 타격 순간 한 번(눈사태는 내려오는 눈 앞머리) · 부위가 부서졌으면 없던 일 · 환경은 박자마다 */
export function commitTiger(g: TigerState, e: GiantOwner, player: Point, hurt: (damage: number) => void, dazed: boolean, push: (dx: number, dy: number) => void): void {
  if (e.hp <= 0 || g.state === 'dead') { g.attack = null; g.environment.active = false; return }
  if (dazed) return
  const a = g.attack, at: Shape = { kind: 'circle', center: point(player.x, player.y), radius: 0 }
  if (g.state === 'strike' && a && !a.hit && a.seq === g.seq && a.requires.every(id => g.partHP[id] > 0)) {
    const scale = g.enraged ? G.enrageDamage : 1
    if (a.move === 'avalanche') { if ((a.activeShapes ?? []).some(s => overlaps(s, at))) { a.hit = true; hurt(a.damage * scale) } }
    else if (a.pending && g.motion.progress >= a.impactAt) {
      a.pending = false
      if (a.shapes.some(s => overlaps(s, at))) {
        a.hit = true; hurt(a.damage * scale)
        if (a.move === 'roar' && a.push) push((player.x < W / 2 ? -1 : 1) * a.push, 0)
      }
    }
  }
  if (g.environment.active && g.environment.age >= g.environment.nextHit && g.environment.shapes.some(s => overlaps(s, at))) {
    g.environment.nextHit = g.environment.age + G.environmentEvery; hurt(G.environmentDamage * (g.enraged ? G.enrageDamage : 1))
  }
}
/** 부서지지 않은(또는 늘 맞는 몸통·목·머리) 부위만 맞는다 */
export function tigerLiveParts(g: TigerState): readonly PartPose<TigerPartId>[] {
  return g.pose.parts.filter(p => { const key = tigerHpOf(p.id); return key === null || key === 'head' || g.partHP[key] > 0 })
}
export const tigerContact = (g: TigerState, shape: Shape): Contact<TigerPartId> | null => pickContact({ ...g.pose, parts: tigerLiveParts(g) }, shape, tigerRank)
export const tigerSweep = (g: TigerState, from: Point, to: Point, radius: number): Contact<TigerPartId> | null => sweepContact({ ...g.pose, parts: tigerLiveParts(g) }, from, to, radius, tigerRank)
/** 맞은 부위의 체력을 깎는다 · 처음 부서지면 true */
export function damageTigerPart(g: TigerState, id: TigerPartId, amount: number): boolean {
  const key = tigerHpOf(id)
  if (key) g.partHP[key] = Math.max(0, g.partHP[key] - amount)
  g.lastHitPart = id
  return breakTigerPart(g, id)
}
/** 부서진 부위가 아직 자세에 반영되지 않았다 */
export const tigerPoseStale = (g: TigerState) => g.pose.parts.some(p => { const key = tigerHpOf(p.id); return key !== null && p.damaged !== (g.partHP[key] <= 0) })
