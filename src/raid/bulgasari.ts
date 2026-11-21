/**
 * 57 목책 돌파 거대 보스 「불가사리」 — 판(sim) 쪽 (docs/realm/BOSS.md 불가사리 표 · 쇠를 먹는 설화의 괴물).
 * 몸 준비 → 붉은 바닥 → 타격 → 머리 노출 회복 · 막 1→2→3 · 철갑(등·어깨)이 벗겨지면 살이 드러나고 그 수가 봉인되거나 바뀐다.
 * 이무기·백두 대호와 같은 공통 계약을 쓴다: giant-core 의 접촉·겹침·고정 예고, HAEBI_GIANT 의 막·분노·환경 박자, 닿을 수 있는 3P 빈 원.
 * 목책 돌파 판이라 진짜 목책(palisade.ts)과 얽힌다: 큰 문으로 들어오며 문을 씹어 부수고 · 박치기는 성한 마디에 박혀 멈추고(그 마디가 깎이고 머리가 오래 드러난다) ·
 * 지하 질주는 목책 밑으로 지나 솟는 자리의 마디를 부순다 · 빈 원은 목책을 뚫지 않고 걸어 닿는 곳만 친다.
 * 판정 뼈대(pose)는 한 틱의 순수 셈이고 그림(bulgasari-view.ts)은 같은 뼈를 읽기만 한다.
 * DOM·벽시계·Math.random 없음 — 난수는 판의 seeded random 하나 (수 고르기 · 버티는 박자 · 철편이 비우는 방향).
 */
import { HAEBI_GIANT as G, HAEBI_BULGASARI as B, HAEBI_RUN as C, HAEBI_PALISADE as WL } from '../tune/params.ts'
import { closestPoint, freezeTell, overlaps, pickContact, sweepContact, type Collider, type Contact, type ImugiPose, type PartPose, type Point, type Shape } from './giant-core.ts'
import type { GiantOwner } from './imugi.ts'
import { sweepWall, type Palisade } from './palisade.ts'

export const BULGASARI_PARTS = ['root', 'back', 'shoulder', 'head', 'jaw', 'fore-near', 'fore-far', 'hind-near', 'hind-far', 'tail'] as const
export type BulgasariPartId = typeof BULGASARI_PARTS[number]
/** 따로 체력을 갖는 부위 (몸통 살·뒷다리·꼬리는 본체 그 자체) */
export const BULGASARI_HP = ['head', 'jaw', 'shoulder', 'back', 'fore-near', 'fore-far'] as const
export type BulgasariHp = typeof BULGASARI_HP[number]
export type BulgasariMove = keyof typeof B.moves
export type LegId = 'fore-near' | 'fore-far' | 'hind-near' | 'hind-far'
/** params 의 paw 배열 차례 (앞 가까운 · 앞 먼 · 뒤 가까운 · 뒤 먼) */
export const LEG_ORDER: readonly LegId[] = ['fore-near', 'fore-far', 'hind-near', 'hind-far']
const HP_IDS = new Set<string>(BULGASARI_HP)
export const bulgasariHpOf = (id: BulgasariPartId): BulgasariHp | null => HP_IDS.has(id) ? id as BulgasariHp : null
/** 철갑 — 성하면 본체가 덜 아프고(armorDamage) · 벗겨지면 드러난 살이 더 아프다(exposedDamage) · 벗겨져도 맞는 자리로 남는다 */
export const isArmor = (id: string): id is 'back' | 'shoulder' => id === 'back' || id === 'shoulder'
const PARENT: Record<BulgasariPartId, BulgasariPartId | null> = { root: null, back: 'root', shoulder: 'root', head: 'root', jaw: 'head', 'fore-near': 'root', 'fore-far': 'root', 'hind-near': 'root', 'hind-far': 'root', tail: 'root' }
/** 같은 거리일 때 먼저 맞는 부위 — 약점(머리) · 턱 · 철갑 · 다리 · 꼬리 · 살 */
const RANK: Record<BulgasariPartId, number> = { head: 0, jaw: 1, shoulder: 2, back: 3, 'fore-near': 4, 'fore-far': 5, 'hind-near': 6, 'hind-far': 7, tail: 8, root: 9 }
export const bulgasariRank = (id: BulgasariPartId) => RANK[id]

export interface BulgasariFrame { x: number; y: number; facing: 1 | -1; lift: number; pitch: number; shift: number; head: number; jaw: number; swell: number; shoulder: number; plates: number; tail: number; paw: readonly number[]; sink: number; hop: number; turn: number }
export interface BulgasariLeg { readonly root: Point; readonly paw: Point; readonly lifted: number }
/** 그림이 읽는 뼈 (모두 몸 쪽 좌표: 발 바닥 가운데 0 · 앞 +x · 아래 +y) */
export interface BulgasariSkeleton {
  readonly body: Readonly<{ at: Point; angle: number; swell: number }>
  readonly flesh: Readonly<{ from: Point; to: Point }>
  readonly back: Readonly<{ from: Point; to: Point; at: Point; lift: number }>
  readonly shoulder: Readonly<{ at: Point; angle: number; raise: number }>
  readonly legs: Readonly<Record<LegId, BulgasariLeg>>
  readonly head: Readonly<{ at: Point; angle: number }>
  readonly jaw: Readonly<{ at: Point; angle: number; open: number }>
  readonly mouth: Point
  readonly tail: Readonly<{ at: Point; tip: Point; angle: number }>
}
export interface BulgasariPose extends ImugiPose<BulgasariPartId> { readonly kind: 'bulgasari'; readonly facing: 1 | -1; readonly anchor: Point; readonly sink: number; readonly turn: number; readonly sk: BulgasariSkeleton }
export interface BulgasariWindup { readonly body: number; readonly hold: number; readonly red: number; readonly total: number; readonly use: number }
export interface BulgasariAttack {
  windup: Readonly<BulgasariWindup>; seq: number; move: BulgasariMove; side: 1 | -1; requires: readonly BulgasariHp[]
  shapes: readonly Shape[]; followShapes: readonly Shape[]; sub: number; pending: boolean; hit: boolean; damage: number; recover: number; strike: number; impactAt: number
  /** 시작한 판 나이(돌기·긁기 박자) */
  at: number
  activeShapes?: readonly Shape[]; front?: number
  /** 달리는 수: 앞머리가 지나는 길 · 박힐 목책 마디(차례) · 이미 박혔나 */
  path?: Readonly<{ from: Point; to: Point }>; wall?: number; walled?: boolean
  /** 지하 질주: 띠 시작 · 출현 자리 */
  landing?: Point
  /** 철편 회전: 선 방향(라디안) · 비운 방향 */
  lines?: readonly number[]; empty?: number
  /** 앞발: 내려찍는 자리 · 닿는 목책 마디 */
  slam?: Point; pieces?: readonly number[]
  pull?: number
}
export interface BulgasariMotion { move: BulgasariMove | null; from: BulgasariFrame; prepared: BulgasariFrame; impact: BulgasariFrame; relaxed: BulgasariFrame; current: BulgasariFrame; recoverFrom: BulgasariFrame; recoverSeconds: number; progress: number; blocked: boolean; walk: number; prowlTo: Point | null }
/** 큰 문으로 들어오는 길 — 문 마디 차례(-1 = 목책 없음) · 처음 자리 · 문 앞 · 내려설 자리 · 문이 이미 부서졌나 · 일어난 일 */
export interface BulgasariEntry { gate: number; from: Point; door: Point; to: Point; facing: 1 | -1; gateDown: boolean; burst: boolean; landed: boolean; roared: boolean; chomps: number }
export interface BulgasariState {
  kind: 'bulgasari'; phase: 1 | 2 | 3; state: 'entry' | 'body' | 'hold' | 'tell' | 'strike' | 'recover' | 'roar' | 'prowl' | 'dead'; pattern: BulgasariMove | null
  seq: number; age: number; timer: number; enraged: boolean; last: BulgasariMove | null; recoveryHitUsed: boolean; stagger: number; submerge: number
  windupUses: Partial<Record<BulgasariMove, number>>; brokenSeen: BulgasariHp[]; brokenAt: Partial<Record<BulgasariHp, number>>
  partHP: Record<BulgasariHp, number>; partMax: Record<BulgasariHp, number>; pose: BulgasariPose; motion: BulgasariMotion; attack: BulgasariAttack | null; entry: BulgasariEntry
  environment: { phase: 1 | 2 | 3; shapes: readonly Shape[]; age: number; active: boolean; nextHit: number }
  bounds: { left: number; top: number; right: number; bottom: number }; lastHitPart: BulgasariPartId; poisonPart: BulgasariPartId
  /** 목책에 머리가 박힌 판 나이 (그림 · 쇠 불티) */
  wallHitAt?: number
}
/** 판이 넘겨주는 목책 (목책 돌파 판에만) · smash: 그 마디를 깎는다 (차례 · 피해 · 맞은 가로 자리) */
export interface BulgasariWall { readonly wall?: Palisade; readonly smash?: (index: number, amount: number, x: number) => void }
export interface BulgasariStep extends BulgasariWall { dt: number; tick: number; player: Point; speed: number; dazed: boolean; random: () => number }

const K = B.rig.scale, R = B.rig, M = B.motion, E = B.entry, W = C.width, H = C.height
const point = (x: number, y: number): Point => ({ x, y })
const unit = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => { const t = unit(x); return t * t * (3 - 2 * t) }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const sc = (p: readonly number[]) => point(p[0]! * K, p[1]! * K)
const add = (a: Point, b: Point) => point(a.x + b.x, a.y + b.y)
const sub = (a: Point, b: Point) => point(a.x - b.x, a.y - b.y)
const mid = (a: Point, b: Point) => point((a.x + b.x) / 2, (a.y + b.y) / 2)
const rot = (a: number, p: Point) => point(Math.cos(a) * p.x - Math.sin(a) * p.y, Math.sin(a) * p.x + Math.cos(a) * p.y)
function deepFreeze<V>(v: V): V { if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) { for (const x of Object.values(v)) deepFreeze(x); Object.freeze(v) } return v }
const frozen = (shapes: readonly Shape[]): readonly Shape[] => Object.freeze(shapes.map(freezeTell))
const box = (x: number, y: number, halfX: number, halfY: number, angle = 0): Shape => ({ kind: 'box', center: point(x, y), halfX, halfY, angle })
const toWorld = (anchor: Point, facing: 1 | -1, p: Point) => point(anchor.x + facing * p.x, anchor.y + p.y)
const worldAngle = (facing: 1 | -1, a: number) => facing === 1 ? a : Math.PI - a

type Spec = { readonly lift: number; readonly pitch: number; readonly shift: number; readonly head: number; readonly jaw: number; readonly swell: number; readonly shoulder: number; readonly plates: number; readonly tail: number; readonly paw: readonly number[]; readonly sink: number }
/** params 자세 하나를 실제 크기 자세로 (side -1 이면 앞발 가까운·먼 쪽을 맞바꾼다) */
function frameOf(x: number, y: number, facing: 1 | -1, s: Spec, side: 1 | -1 = 1): BulgasariFrame {
  const paw = s.paw.map(v => v * K)
  if (side === -1) { const [a, b, c, d] = paw; paw[0] = c!; paw[1] = d!; paw[2] = a!; paw[3] = b! }
  return { x, y, facing, lift: s.lift * K, pitch: s.pitch, shift: s.shift * K, head: s.head, jaw: s.jaw, swell: s.swell, shoulder: s.shoulder, plates: s.plates, tail: s.tail, paw, sink: s.sink, hop: 0, turn: 0 }
}
const restAt = (x: number, y: number, facing: 1 | -1) => frameOf(x, y, facing, M.rest)
/** 시험·검수: params 자세 이름으로 실제 크기 자세를 만든다 */
export const bulgasariFrame = (x: number, y: number, facing: 1 | -1, s: Spec, side: 1 | -1 = 1) => frameOf(x, y, facing, s, side)
function blend(a: BulgasariFrame, b: BulgasariFrame, t: number): BulgasariFrame {
  const k = smooth(t), l = (x: number, y: number) => lerp(x, y, k)
  return { x: l(a.x, b.x), y: l(a.y, b.y), facing: a.facing !== b.facing && k < .5 ? a.facing : b.facing, lift: l(a.lift, b.lift), pitch: l(a.pitch, b.pitch), shift: l(a.shift, b.shift), head: l(a.head, b.head), jaw: l(a.jaw, b.jaw),
    swell: l(a.swell, b.swell), shoulder: l(a.shoulder, b.shoulder), plates: l(a.plates, b.plates), tail: l(a.tail, b.tail), paw: a.paw.map((v, i) => l(v, b.paw[i] ?? 0)), sink: l(a.sink, b.sink), hop: l(a.hop, b.hop),
    turn: a.facing !== b.facing ? 1 - Math.abs(2 * k - 1) : l(a.turn, b.turn) }
}

// ── 뼈대 (한 틱의 순수 셈) ──
export interface Broken { readonly has: (id: BulgasariHp) => boolean }
/** 다리 하나의 쉬는 자리 (몸 쪽 좌표 · 먼 쪽은 far 만큼 옮겨 선다) */
export function legRest(id: LegId): { socket: Point; paw: Point } {
  const spec = id.startsWith('fore') ? R.fore : R.hind, far = id.endsWith('far') ? sc(R.far) : point(0, 0)
  return { socket: add(sc(spec.socket), far), paw: add(sc(spec.paw), far) }
}
/** 자세(frame) + 부서진 부위 → 뼈대 (몸 쪽 좌표) — 다리는 한 장 그림이라 길이를 지키며 돌고, 발을 들면 줄어든다(tuckMin) */
export function bulgasariSkeleton(f: BulgasariFrame, broken: Broken): BulgasariSkeleton {
  const piv = sc(R.body.pivot), a = -f.pitch, dy = f.lift - f.hop
  const X = (p: Point) => { const q = rot(a, sub(p, piv)); return point(piv.x + q.x + f.shift, piv.y + q.y + dy) }
  const legs = {} as Record<LegId, BulgasariLeg>
  LEG_ORDER.forEach((id, i) => {
    const r = legRest(id), length = Math.hypot(r.paw.x - r.socket.x, r.paw.y - r.socket.y)
    const limp = (id === 'fore-near' || id === 'fore-far') && broken.has(id) ? 1 : 0
    const root = X(r.socket), target = point(r.paw.x + (f.paw[i * 2] ?? 0) + limp * M.limp.back * K, r.paw.y + (f.paw[i * 2 + 1] ?? 0) - f.hop + limp * M.limp.lift * K)
    const d = Math.hypot(target.x - root.x, target.y - root.y) || 1, k = Math.max(R.tuckMin, Math.min(R.stretch, d / length))
    const paw = point(root.x + (target.x - root.x) / d * length * k, root.y + (target.y - root.y) / d * length * k)
    legs[id] = { root, paw, lifted: Math.max(0, r.paw.y - f.hop - paw.y) }
  })
  const lift = f.plates * R.back.lift * K, up = (p: Point) => point(p.x, p.y - lift)
  const bf = up(X(sc(R.back.from))), bt = up(X(sc(R.back.to)))
  const neck = X(sc(R.neck)), headAngle = a + f.head, inHead = (p: readonly number[]) => add(neck, rot(headAngle, sc(p)))
  const open = broken.has('jaw') ? R.jaw.dangle : unit(f.jaw), jawAngle = headAngle + R.jaw.angle + open * R.jaw.open
  const tailRoot = X(sc(R.tail.root)), tailAngle = a + R.tail.angle + f.tail
  return {
    body: { at: X(sc(R.body.pivot)), angle: a, swell: f.swell }, flesh: { from: X(sc(R.body.from)), to: X(sc(R.body.to)) },
    back: { from: bf, to: bt, at: mid(bf, bt), lift }, shoulder: { at: X(sc(R.shoulder.center)), angle: a - f.shoulder * R.shoulder.raise, raise: f.shoulder },
    legs, head: { at: neck, angle: headAngle }, jaw: { at: inHead(R.head.hinge), angle: jawAngle, open }, mouth: inHead(R.head.mouth),
    tail: { at: tailRoot, tip: add(tailRoot, rot(tailAngle, point(R.tail.length * K, 0))), angle: tailAngle },
  }
}
interface PoseFlags { ownerId: number; tick: number; alive: boolean; targetable: boolean; recovering: boolean; partHP: Readonly<Record<BulgasariHp, number>> }
/** 판정 부위(collider)와 뼈를 함께 — 그림과 판정이 같은 점을 쓴다 */
export function makeBulgasariPose(f: BulgasariFrame, o: PoseFlags): BulgasariPose {
  const broken: Broken = { has: id => o.partHP[id] <= 0 }, sk = bulgasariSkeleton(f, broken), anchor = point(f.x, f.y)
  const W2 = (p: Point) => toWorld(anchor, f.facing, p), A = (a: number) => worldAngle(f.facing, a)
  const visible = o.alive && f.sink < B.sinkHidden, parts: PartPose<BulgasariPartId>[] = []
  const put = (id: BulgasariPartId, start: Point, end: Point, angle: number, collider: Collider, extra?: { mouth: Point }) => {
    const key = bulgasariHpOf(id), damaged = key !== null && o.partHP[key] <= 0, severed = damaged && id !== 'head' && !isArmor(id)
    parts.push({ id, parent: PARENT[id], start, end, angle, mirrorY: f.facing, alive: o.alive, broken: severed, damaged, visible, targetable: visible && !severed && o.targetable, height: 0, widthScale: 1, collider, ...extra })
  }
  const cap = (a: Point, b: Point, r: number): Collider => ({ kind: 'capsule', from: a, to: b, radius: r })
  const f0 = W2(sk.flesh.from), f1 = W2(sk.flesh.to)
  put('root', f0, f1, A(sk.body.angle), cap(f0, f1, R.body.radius * K * (1 + Math.max(0, f.swell) * .08)))
  const b0 = W2(sk.back.from), b1 = W2(sk.back.to)
  put('back', b0, b1, A(sk.body.angle), cap(b0, b1, R.back.radius * K))
  const sh = W2(sk.shoulder.at)
  put('shoulder', sh, sh, A(sk.shoulder.angle), { kind: 'ellipse', center: sh, rx: R.shoulder.radii[0] * K, ry: R.shoulder.radii[1] * K, angle: A(sk.shoulder.angle) })
  const n = W2(sk.head.at), hc = W2(add(sk.head.at, rot(sk.head.angle, sc(R.head.center)))), mouth = W2(sk.mouth)
  put('head', n, mouth, A(sk.head.angle), { kind: 'ellipse', center: hc, rx: R.head.radii[0] * K, ry: R.head.radii[1] * K, angle: A(sk.head.angle) })
  const j0 = W2(sk.jaw.at), j1 = W2(add(sk.jaw.at, rot(sk.jaw.angle, point(R.jaw.length * K, 0))))
  put('jaw', j0, j1, A(sk.jaw.angle), cap(j0, j1, R.jaw.radius * K), { mouth })
  for (const id of LEG_ORDER) { const l = sk.legs[id], r0 = W2(l.root), p = W2(l.paw); put(id, r0, p, A(Math.atan2(l.paw.y - l.root.y, l.paw.x - l.root.x)), cap(r0, p, (id.startsWith('fore') ? R.fore : R.hind).radius * K)) }
  const t0 = W2(sk.tail.at), t1 = W2(sk.tail.tip)
  put('tail', t0, t1, A(sk.tail.angle), cap(t0, t1, R.tail.radius * K))
  return deepFreeze({ kind: 'bulgasari' as const, ownerId: o.ownerId, tick: o.tick, parts, worldGeometry: { parts: parts.map(p => ({ id: p.id, shape: p.collider })), tell: [] as Shape[] }, jawOpen: sk.jaw.open, recovering: o.recovering, facing: f.facing, anchor, sink: f.sink, turn: f.turn, sk })
}
export function bulgasariCollisionBounds(pose: BulgasariPose) {
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
/** 막별 환경 위협 — 가운데 세로 3P 길은 세 막 모두 판 끝까지 빈다 (막1 바깥 철편 · 막2 방사 철편 · 막3 지하 질주 띠) */
export function bulgasariEnvironment(phase: 1 | 2 | 3): BulgasariState['environment'] {
  const v = B.env, e = v.border, side = (W - v.gap) / 4, cx = W / 2, cy = H / 2, reach = Math.hypot(W, H) / 2
  const shapes: Shape[] = phase === 1 ? [{ kind: 'union', shapes: [box(side, e / 2, side, e / 2), box(W - side, e / 2, side, e / 2), box(side, H - e / 2, side, e / 2), box(W - side, H - e / 2, side, e / 2), box(e / 2, H / 2, e / 2, H / 2), box(W - e / 2, H / 2, e / 2, H / 2)] }]
    : phase === 2 ? [{ kind: 'union', shapes: v.radial.map(deg => { const a = deg * Math.PI / 180, r = v.hub + (reach - v.hub) / 2; return box(cx + Math.cos(a) * r, cy + Math.sin(a) * r, (reach - v.hub) / 2, v.lineWidth / 2, a) }) }]
    : [{ kind: 'union', shapes: v.strips.map(([share, width]) => box(share * W, H / 2, width / 2, H / 2)) }]
  return { phase, shapes: frozen(shapes), age: 0, active: false, nextHit: 0 }
}
const flags = (g: BulgasariState, e: GiantOwner, tick: number, planning = false): PoseFlags => ({ ownerId: e.id, tick, alive: e.hp > 0 && g.state !== 'dead', targetable: planning || g.state !== 'entry', recovering: g.state === 'recover', partHP: g.partHP })
const poseOf = (g: BulgasariState, e: GiantOwner, f: BulgasariFrame, tick: number, planning = false) => makeBulgasariPose(f, flags(g, e, tick, planning))
/** 같은 발 자리를 쓰는 자세들을 한 번에 판 안으로 — 옮길 몫 (몸이 판보다 크면 null) */
function shiftInto(g: BulgasariState, e: GiantOwner, frames: readonly BulgasariFrame[], tick: number): Point | null {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  for (const f of frames) { const b = bulgasariCollisionBounds(poseOf(g, e, { ...f, sink: 0 }, tick, true)); left = Math.min(left, b.left); right = Math.max(right, b.right); top = Math.min(top, b.top); bottom = Math.max(bottom, b.bottom) }
  if (right - left > W || bottom - top > H) return null
  return point(left < 0 ? -left : right > W ? W - right : 0, top < 0 ? -top : bottom > H ? H - bottom : 0)
}
const moved = (f: BulgasariFrame, d: Point): BulgasariFrame => ({ ...f, x: f.x + d.x, y: f.y + d.y })
/** 판 안에 판정 부위가 다 들어오게 발 자리를 옮긴다 · 몸이 판보다 크면 null */
export function fitBulgasariFrame(g: BulgasariState, e: GiantOwner, f: BulgasariFrame, tick: number): BulgasariFrame | null {
  const d = shiftInto(g, e, [f], tick); return d && moved(f, d)
}
function fitAll(g: BulgasariState, e: GiantOwner, frames: readonly BulgasariFrame[], tick: number): BulgasariFrame[] | null {
  const d = shiftInto(g, e, frames, tick); return d && frames.map(f => moved(f, d))
}
/** 이 자세의 입 (판 좌표) */
function mouthOf(g: BulgasariState, f: BulgasariFrame): Point {
  const sk = bulgasariSkeleton(f, { has: id => g.partHP[id] <= 0 })
  return toWorld(point(f.x, f.y), f.facing, sk.mouth)
}
/**
 * 큰 문으로 들어오는 길을 세운다 — 입이 문 위에 오도록 문 뒤에 서고(장수 쪽을 본다) · 내려설 자리는 판 안 평소 발 자리.
 * 목책이 없으면(시험) 판 위쪽 가운데에서 내려온다.
 */
function entryPlan(g: BulgasariState, e: GiantOwner, tick: number, wall: Palisade | undefined, playerX: number): BulgasariEntry {
  const gate = wall ? wall.pieces.findIndex(p => p.kind === 'g') : -1, piece = gate >= 0 ? wall!.pieces[gate]! : null
  const gateX = piece ? (piece.x0 + piece.x1) / 2 : W / 2, wallY = wall?.y ?? WL.y, facing: 1 | -1 = playerX < gateX ? -1 : 1
  const reach = mouthOf(g, frameOf(0, 0, facing, M.chomp)).x
  const door = point(gateX - reach, wallY - E.behind * K), from = point(door.x, door.y - E.startAbove * K)
  const land = fitBulgasariFrame(g, e, restAt(door.x + facing * E.lunge * K, B.homeY, facing), tick)
  return { gate, from, door, to: land ? point(land.x, land.y) : point(door.x, B.homeY), facing, gateDown: !piece || piece.hp <= 0, burst: false, landed: false, roared: false, chomps: 0 }
}
export function createBulgasari(e: GiantOwner, tick = 0, wall?: Palisade, playerX: number = e.x): BulgasariState {
  const partMax = Object.fromEntries(BULGASARI_HP.map(id => [id, B.hp * B.parts[id]])) as Record<BulgasariHp, number>, base = restAt(e.x, B.homeY, 1)
  const motion: BulgasariMotion = { move: null, from: base, prepared: base, impact: base, relaxed: base, current: base, recoverFrom: base, recoverSeconds: B.idleRecovery, progress: 0, blocked: false, walk: 0, prowlTo: null }
  const g: BulgasariState = { kind: 'bulgasari', phase: 1, state: 'entry', pattern: null, seq: 0, age: 0, timer: B.entrySeconds, enraged: false, last: null, recoveryHitUsed: false, stagger: 0, submerge: 0,
    windupUses: {}, brokenSeen: [], brokenAt: {}, partHP: { ...partMax }, partMax, pose: makeBulgasariPose(base, { ownerId: e.id, tick, alive: true, targetable: false, recovering: false, partHP: partMax }), motion, attack: null,
    entry: { gate: -1, from: point(e.x, e.y), door: point(e.x, e.y), to: point(e.x, e.y), facing: 1, gateDown: true, burst: false, landed: false, roared: false, chomps: 0 },
    environment: bulgasariEnvironment(1), bounds: { left: 0, top: 0, right: W, bottom: H }, lastHitPart: 'root', poisonPart: 'root' }
  g.entry = entryPlan(g, e, tick, wall, playerX)
  const start = restAt(g.entry.from.x, g.entry.from.y, g.entry.facing), land = restAt(g.entry.to.x, g.entry.to.y, g.entry.facing)
  g.motion = { ...motion, from: start, prepared: start, impact: land, relaxed: land, current: start, recoverFrom: land }
  updateBulgasariPose(g, e, tick); return g
}

// ── 수 ──
const brokenAll = (g: BulgasariState, ids: readonly BulgasariHp[]) => ids.every(id => g.partHP[id] <= 0)
/** 그 수에 있어야 하는 부위 (부서지면 봉인 · 예약된 수도 취소) — 쌍돌진은 등 철갑이 벗겨진 뒤에만 열리고 두 앞발이 다 부서지면 봉인 */
export const REQUIRES: Record<BulgasariMove, (side: 1 | -1) => readonly BulgasariHp[]> = { suction: () => ['jaw'], ram: () => ['shoulder'], stomp: side => [side === 1 ? 'fore-near' : 'fore-far'], burrow: () => ['back'], spin: () => ['back'], double: () => [] }
const usable = (g: BulgasariState, move: BulgasariMove, side: 1 | -1) => REQUIRES[move](side).every(id => g.partHP[id] > 0) && (move !== 'double' || g.partHP.back <= 0 && !brokenAll(g, ['fore-near', 'fore-far']))
const facingTo = (f: BulgasariFrame, target: Point): 1 | -1 => Math.abs(target.x - f.x) < B.turnDeadZone ? f.facing : target.x < f.x ? -1 : 1
const stompSide = (f: BulgasariFrame, target: Point): 1 | -1 => target.y >= f.y - B.moves.stomp.sideBias * K ? 1 : -1
/** 고정 tick 의 수 후보 — 막 · 같은 수 연속 금지 · 거리 · 살아 있는 부위 (난수 없음) */
export function bulgasariCandidates(g: BulgasariState, e: GiantOwner, target: Point): BulgasariMove[] {
  if (e.hp <= 0 || g.state === 'dead') return []
  const f = g.motion.current, d = Math.hypot(target.x - f.x, target.y - f.y), m = B.moves
  return (Object.keys(m) as BulgasariMove[]).filter(move => {
    if (move === g.last || g.phase < m[move].phase) return false
    const side = move === 'stomp' ? stompSide(f, target) : 1
    if (!usable(g, move, side)) return false
    if (move === 'suction') { const mo = mouthOf(g, { ...f, facing: facingTo(f, target) }); return Math.hypot(target.x - mo.x, target.y - mo.y) <= m.suction.reach }
    if (move === 'stomp') { const paw = toWorld(point(f.x, f.y), facingTo(f, target), legRest(side === 1 ? 'fore-near' : 'fore-far').paw); return Math.hypot(target.x - paw.x, target.y - paw.y) <= m.stomp.reach }
    if (move === 'ram' || move === 'double' || move === 'burrow') return d >= m[move].min
    return true
  })
}
export interface BulgasariPlan { move: BulgasariMove; side: 1 | -1; prepared: BulgasariFrame; impact: BulgasariFrame; relaxed: BulgasariFrame; shapes: readonly Shape[]; path?: Readonly<{ from: Point; to: Point }>; wall?: number; slots?: readonly number[]; slam?: Point; pieces?: readonly number[]; landing?: Point; safeSeconds: number }
/** 장수 쪽 각도를 앞(facing)에서 tilt 안으로 */
function aimWithin(from: Point, target: Point, facing: 1 | -1, tilt: number) {
  const local = Math.atan2(target.y - from.y, facing * (target.x - from.x)), a = Math.max(-tilt, Math.min(tilt, local))
  return worldAngle(facing, a)
}
/** 이 모양에 닿는 성한 목책 마디 차례 (덮는 상자가 겹치는 마디만 정밀히 잰다) */
function piecesIn(wall: Palisade | undefined, shape: Shape): number[] {
  if (!wall) return []
  const out: number[] = [], b = boundsOf(shape)
  wall.pieces.forEach((p, i) => { if (p.hp > 0 && p.kind !== 'o' && b.x1 >= p.x0 && b.x0 <= p.x1 && b.y1 >= wall.y - WL.depth && b.y0 <= wall.y + WL.depth && overlaps(shape, box((p.x0 + p.x1) / 2, wall.y, (p.x1 - p.x0) / 2, WL.depth))) out.push(i) })
  return out
}
interface Bounds { x0: number; y0: number; x1: number; y1: number }
/** 모양을 덮는 상자 (넉넉하게 · 이 밖이면 결코 겹치지 않는다) */
function boundsOf(s: Shape): Bounds {
  switch (s.kind) {
    case 'union': return s.shapes.map(boundsOf).reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity })
    case 'capsule': case 'line': { const r = s.kind === 'line' ? s.width / 2 : s.radius; return { x0: Math.min(s.from.x, s.to.x) - r, y0: Math.min(s.from.y, s.to.y) - r, x1: Math.max(s.from.x, s.to.x) + r, y1: Math.max(s.from.y, s.to.y) + r } }
    case 'box': { const c = Math.abs(Math.cos(s.angle)), n = Math.abs(Math.sin(s.angle)), hx = s.halfX * c + s.halfY * n, hy = s.halfX * n + s.halfY * c; return { x0: s.center.x - hx, y0: s.center.y - hy, x1: s.center.x + hx, y1: s.center.y + hy } }
    case 'ellipse': { const r = Math.max(s.rx, s.ry); return { x0: s.center.x - r, y0: s.center.y - r, x1: s.center.x + r, y1: s.center.y + r } }
    case 'annulus': case 'arc': return { x0: s.center.x - s.outer, y0: s.center.y - s.outer, x1: s.center.x + s.outer, y1: s.center.y + s.outer }
    default: return { x0: s.center.x - s.radius, y0: s.center.y - s.radius, x1: s.center.x + s.radius, y1: s.center.y + s.radius }
  }
}
/** 펼친 조각 하나와 그 덮는 상자 */
type Piece = { readonly shape: Shape; readonly b: Bounds }
const flatten = (shapes: readonly Shape[], out: Piece[] = []): Piece[] => { for (const s of shapes) { if (s.kind === 'union') flatten(s.shapes, out); else out.push({ shape: s, b: boundsOf(s) }) } return out }
/** 원(c, r)이 조각에 닿나 — 원·캡슐·상자는 거리로 바로 · 나머지는 giant-core 겹침 셈 (덮는 상자 밖이면 셈 없이 안 닿음) */
function diskTouches(q: Piece, c: Point, r: number): boolean {
  if (c.x + r < q.b.x0 || c.x - r > q.b.x1 || c.y + r < q.b.y0 || c.y - r > q.b.y1) return false
  const s = q.shape
  if (s.kind === 'circle') return Math.hypot(c.x - s.center.x, c.y - s.center.y) <= s.radius + r
  if (s.kind === 'capsule') { const vx = s.to.x - s.from.x, vy = s.to.y - s.from.y, d = vx * vx + vy * vy, t = d ? Math.max(0, Math.min(1, ((c.x - s.from.x) * vx + (c.y - s.from.y) * vy) / d)) : 0; return Math.hypot(c.x - s.from.x - vx * t, c.y - s.from.y - vy * t) <= s.radius + r }
  if (s.kind === 'box') { const dx = c.x - s.center.x, dy = c.y - s.center.y, co = Math.cos(s.angle), si = Math.sin(s.angle), u = Math.max(0, Math.abs(dx * co + dy * si) - s.halfX), v = Math.max(0, Math.abs(dy * co - dx * si) - s.halfY); return Math.hypot(u, v) <= r }
  if (s.kind === 'ellipse') { const q = closestPoint(c, s); return Math.hypot(c.x - q.x, c.y - q.y) <= r }
  if (s.kind === 'cone') {
    // 부채: 꼭짓점이 원 안이면 닿고 · 반지름+r 밖이면 안 닿고 · 부채 각 안이면 닿고 · 아니면 두 가장자리 선분까지 거리
    const dx = c.x - s.center.x, dy = c.y - s.center.y, d = Math.hypot(dx, dy)
    if (d <= r) return true
    if (d > s.radius + r) return false
    if (Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - s.angle), Math.cos(Math.atan2(dy, dx) - s.angle))) <= s.halfAngle) return true
    return [s.angle - s.halfAngle, s.angle + s.halfAngle].some(a => { const ux = Math.cos(a), uy = Math.sin(a), t = Math.max(0, Math.min(s.radius, dx * ux + dy * uy)); return Math.hypot(dx - ux * t, dy - uy * t) <= r })
  }
  return overlaps(s, { kind: 'circle', center: c, radius: r })
}
/** 달리는 수(박치기·쌍돌진)의 길 — 판 밖으로 나가지 않게 줄이고 · 성한 목책 마디에 머리가 닿으면 거기서 멈춘다 */
function chargePlan(g: BulgasariState, e: GiantOwner, from: BulgasariFrame, target: Point, move: 'ram' | 'double', tick: number, wall: Palisade | undefined): BulgasariPlan | null {
  const m = B.moves[move], facing = facingTo(from, target), spec = M[move]
  const prepared = fitBulgasariFrame(g, e, frameOf(from.x, from.y, facing, spec.prepare), tick); if (!prepared) return null
  const m0 = mouthOf(g, prepared), angle = aimWithin(m0, target, facing, m.tilt), dir = point(Math.cos(angle), Math.sin(angle)), full = m.lengthShare * H
  // 발이 floorY 아래로 내려가지 않는 데까지만 (아래 체력 막대·조작부에 몸이 가리지 않게)
  let t = dir.y > 1e-9 ? Math.min(1, (B.floorY - prepared.y) / (dir.y * full)) : 1, blocked: number | undefined
  if (wall) {
    const end = add(m0, point(dir.x * full, dir.y * full)), piece = sweepWall(wall, m0.x, m0.y, end.x, end.y, m.wallR)
    if (piece && dir.y !== 0) {
      const band = WL.depth + m.wallR, edge = m0.y < wall.y ? wall.y - band : wall.y + band
      const tw = Math.max(0, Math.min(1, (edge - m0.y) / (dir.y * full))); if (tw <= t) { t = tw; blocked = wall.pieces.indexOf(piece) }
    } else if (piece) return null
  }
  for (; t >= m.minTravel - 1e-9; t -= .05) {
    const go = point(dir.x * full * t, dir.y * full * t), end = point(prepared.x + go.x, prepared.y + go.y)
    const frames = [frameOf(end.x, end.y, facing, spec.impact), frameOf(end.x, end.y, facing, M.recover)], d = shiftInto(g, e, frames, tick)
    if (!d || d.x !== 0 || d.y !== 0) { blocked = undefined; continue }
    return { move, side: 1, prepared, impact: frames[0]!, relaxed: frames[1]!, path: Object.freeze({ from: m0, to: add(m0, go) }), ...(blocked !== undefined ? { wall: blocked } : {}),
      shapes: frozen([{ kind: 'capsule', from: m0, to: add(m0, go), radius: m.width / 2 }]), safeSeconds: 0 }
  }
  return null
}
/** 몸·자리·붉은 바닥을 붉은빛 앞에 모두 정한다 — 그 뒤엔 따라가거나 돌거나 옮기지 않는다 */
export function planBulgasari(g: BulgasariState, e: GiantOwner, target: Point, move: BulgasariMove, tick: number, wall?: Palisade): BulgasariPlan | null {
  const from = g.motion.current, facing = facingTo(from, target), m = B.moves
  const at = (x: number, y: number, s: Spec, side: 1 | -1 = 1) => frameOf(x, y, facing, s, side)
  if (move === 'suction') {
    const fit = fitAll(g, e, [at(from.x, from.y, M.suction.prepare), at(from.x, from.y, M.suction.impact), at(from.x, from.y, M.recover)], tick); if (!fit) return null
    const mo = mouthOf(g, fit[0]!), angle = aimWithin(mo, target, facing, m.suction.tilt)
    return { move, side: 1, prepared: fit[0]!, impact: fit[1]!, relaxed: fit[2]!, shapes: frozen([{ kind: 'cone', center: mo, radius: m.suction.length, angle, halfAngle: m.suction.halfAngle }]), safeSeconds: 0 }
  }
  if (move === 'ram' || move === 'double') return chargePlan(g, e, from, target, move, tick, wall)
  if (move === 'stomp') {
    const side = stompSide(from, target), leg: LegId = side === 1 ? 'fore-near' : 'fore-far', i = side === 1 ? 0 : 1, s = m.stomp
    let x = from.x, y = from.y
    // 발에서 장수 쪽으로 ahead 안 · 몸이 판 끝에서 밀리면 밀린 자리에서 한 번 더 잰다
    for (let pass = 0; pass < 2; pass++) {
      const rest = toWorld(point(x, y), facing, legRest(leg).paw), local = point(facing * (target.x - rest.x), target.y - rest.y)
      const ahead = Math.max(-s.ahead * .25, Math.min(s.ahead, local.x)), slam = toWorld(point(x, y), facing, add(legRest(leg).paw, point(ahead, 0)))
      const hit = at(x, y, M.stomp.impact, side), paws = [...hit.paw]; paws[i * 2] = (paws[i * 2] ?? 0) + ahead
      const frames = [at(x, y, M.stomp.prepare, side), { ...hit, paw: paws }, at(x, y, M.recover)], d = shiftInto(g, e, frames, tick)
      if (!d) return null
      if (d.x === 0 && d.y === 0) {
        const shape: Shape = { kind: 'ellipse', center: slam, rx: s.ry, ry: s.rx, angle: 0 }
        return { move, side, prepared: frames[0]!, impact: frames[1]!, relaxed: frames[2]!, slam, pieces: Object.freeze(piecesIn(wall, shape)), shapes: frozen([shape]), safeSeconds: 0 }
      }
      x += d.x; y += d.y
    }
    return null
  }
  if (move === 'burrow') {
    const prepared = fitBulgasariFrame(g, e, at(from.x, from.y, M.burrow.prepare), tick); if (!prepared) return null
    const ty = Math.min(B.floorY, target.y), land = fitAll(g, e, [at(target.x, ty, M.burrow.impact), at(target.x, ty, M.recover)], tick); if (!land) return null
    const start = point(prepared.x, prepared.y), end = point(land[0]!.x, land[0]!.y)
    if (Math.hypot(end.x - start.x, end.y - start.y) < m.burrow.min * .5) return null
    const shapes = frozen([{ kind: 'capsule', from: start, to: end, radius: m.burrow.width / 2 }, { kind: 'circle', center: end, radius: m.burrow.radius }])
    return { move, side: 1, prepared, impact: land[0]!, relaxed: land[1]!, path: Object.freeze({ from: start, to: end }), landing: end, pieces: Object.freeze(piecesIn(wall, { kind: 'circle', center: end, radius: m.burrow.radius })), shapes, safeSeconds: m.burrow.red }
  }
  if (move === 'spin') {
    const fit = fitAll(g, e, [at(from.x, from.y, M.spin.prepare), at(from.x, from.y, M.spin.impact), at(from.x, from.y, M.recover)], tick); if (!fit) return null
    const s = m.spin, c = point(fit[0]!.x, fit[0]!.y), first = Math.atan2(target.y - c.y, target.x - c.x)
    const slots = Object.freeze(Array.from({ length: s.slots }, (_, k) => first + k * 2 * Math.PI / s.slots))
    // 비울 방향은 세울 때 seeded 로 고른다 — 여기서는 모든 칸을 붉게 놓고 재 본다(하나를 비우면 더 안전하다)
    return { move, side: 1, prepared: fit[0]!, impact: fit[1]!, relaxed: fit[2]!, slots, shapes: spinShapes(c, slots, -1), safeSeconds: 0 }
  }
  return null
}
/** 철편 선 — 발 자리에서 inner 떨어져 length 만큼 · empty 차례의 방향은 비운다 */
function spinShapes(c: Point, slots: readonly number[], empty: number): readonly Shape[] {
  const s = B.moves.spin, r = s.inner + s.length / 2
  return frozen(slots.filter((_, k) => k !== empty).map(a => box(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, s.length / 2, s.width / 2, a)))
}
/**
 * 닿을 수 있는 3P 빈 원 (imugi.safeLanding 과 같은 격자 · 가까운 차례) — 목책 돌파 판에서는 성한 마디를 뚫고 가야 닿는 자리는 빼고,
 * 성한 마디 띠 안의 자리도 뺀다 (장수가 실제로 걸어 닿는 곳만).
 */
export function bulgasariSafeSpot(shapes: readonly Shape[], env: readonly Shape[], player: Point, speed: number, seconds: number, wall?: Palisade): Point | null {
  const radius = G.playerDiameter * G.safeDiameters / 2, candidates: Point[] = []
  for (let y = radius; y <= H - radius; y += G.safeGrid) for (let x = radius; x <= W - radius; x += G.safeGrid) if (Math.hypot(x - player.x, y - player.y) <= speed * seconds) candidates.push(point(x, y))
  candidates.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y) || a.y - b.y || a.x - b.x)
  // 조각마다 덮는 상자를 한 번 재 두고 · 원·캡슐·상자는 거리로 바로 잰다 (결정 틱이 폰에서 끊기지 않게)
  const pieces = flatten([...shapes, ...env])
  for (const p of candidates) {
    if (wall && sweepWall(wall, player.x, player.y, p.x, p.y, WL.heroR)) continue
    if (pieces.every(q => !diskTouches(q, p, radius))) return p
  }
  return null
}
/** 이 수를 지금 안전하게 쓸 수 있는가 (버팀 없는 가장 짧은 예고로 잰다) */
function feasible(g: BulgasariState, plan: BulgasariPlan, player: Point, speed: number, wall?: Palisade): boolean {
  const m = B.moves[plan.move], seconds = plan.safeSeconds || m.body + m.red
  return bulgasariSafeSpot(plan.shapes, g.environment.shapes, player, speed, seconds, wall) !== null
}
/**
 * 후보에서 난수 하나로 고르고, 그 수를 실제로 세워 본다(몸이 판에 들어가고 피할 길이 있는가) — 안 되면 후보 차례로 다음 수.
 * 빈 후보는 난수를 쓰지 않는다 · 후보를 모두 세워 보지 않아 결정하는 틱이 가볍다.
 */
export function chooseBulgasariPlan(g: BulgasariState, e: GiantOwner, target: Point, speed: number, tick: number, random: () => number, wall?: Palisade): BulgasariPlan | null {
  const moves = bulgasariCandidates(g, e, target); if (!moves.length) return null
  const first = Math.min(moves.length - 1, Math.floor(random() * moves.length))
  for (let k = 0; k < moves.length; k++) { const p = planBulgasari(g, e, target, moves[(first + k) % moves.length]!, tick, wall); if (p && feasible(g, p, target, speed, wall)) return p }
  return null
}
/** 이번 사용의 예고 박자 — 박치기는 앞발 긁기 · 쌍돌진은 몸 수축을 seeded 로 버티고, 다른 수는 두 번째부터 holdChance 로 repeatHold 를 더 버틴다 (난수 하나) */
export function bulgasariWindup(g: BulgasariState, move: BulgasariMove, r: number): Readonly<BulgasariWindup> {
  const m = B.moves[move], use = (g.windupUses[move] ?? 0) + 1
  const hold = move === 'ram' ? r * B.moves.ram.scrape : move === 'double' ? r * B.moves.double.rush : use > 1 && r < B.holdChance ? G.windup.repeatHold : 0
  return Object.freeze({ body: m.body, hold, red: m.red, total: m.body + hold + m.red, use })
}
export function beginBulgasariPlan(g: BulgasariState, e: GiantOwner, plan: BulgasariPlan, tick: number, random: () => number): void {
  const m = B.moves[plan.move], w = bulgasariWindup(g, plan.move, random())
  let shapes = plan.shapes, lines: readonly number[] | undefined, empty: number | undefined
  if (plan.slots) {
    empty = 1 + Math.min(plan.slots.length - 2, Math.floor(random() * (plan.slots.length - 1)))
    shapes = spinShapes(point(plan.prepared.x, plan.prepared.y), plan.slots, empty); lines = Object.freeze(plan.slots.filter((_, k) => k !== empty))
  }
  g.windupUses[plan.move] = w.use; g.last = plan.move; g.pattern = plan.move; g.seq++; g.state = 'body'; g.timer = w.body
  g.motion = { ...g.motion, move: plan.move, from: g.motion.current, prepared: plan.prepared, impact: plan.impact, relaxed: plan.relaxed, recoverFrom: plan.impact, recoverSeconds: m.recover, progress: 0, blocked: false, prowlTo: null }
  g.attack = { windup: w, seq: g.seq, move: plan.move, side: plan.side, requires: REQUIRES[plan.move](plan.side), shapes, followShapes: Object.freeze([]), sub: 0, pending: false, hit: false, damage: m.damage, recover: m.recover, strike: m.strike, impactAt: m.impactAt, at: g.age,
    ...(plan.path ? { path: plan.path, front: 0 } : {}), ...(plan.wall !== undefined ? { wall: plan.wall } : {}), ...(plan.landing ? { landing: plan.landing } : {}), ...(lines ? { lines, empty: empty! } : {}),
    ...(plan.slam ? { slam: plan.slam } : {}), ...(plan.pieces ? { pieces: plan.pieces } : {}), ...(plan.move === 'suction' ? { pull: B.moves.suction.pull } : {}) }
  updateBulgasariPose(g, e, tick)
}
/** 시험·검수용: 이 수를 지금 세운다 (안전하지 않으면 false · 판은 그대로 쉬는 자세로) */
export function beginBulgasariMove(g: BulgasariState, e: GiantOwner, target: Point, move: BulgasariMove, tick: number, speed: number = C.speed, random: () => number = () => 0, wall?: Palisade): boolean {
  const plan = planBulgasari(g, e, target, move, tick, wall)
  if (!plan || !feasible(g, plan, target, speed, wall)) { g.motion = { ...g.motion, blocked: true }; recover(g, B.idleRecovery); return false }
  beginBulgasariPlan(g, e, plan, tick, random); return true
}
/** 쌍돌진 둘째 — 첫 돌진이 끝난 자리에서 장수 쪽으로 다시 겨눠 몸·바닥을 새로 예고한다 · 두 길 밖에 닿을 3P 빈 원이 없으면 하지 않는다 */
function followDouble(g: BulgasariState, e: GiantOwner, input: BulgasariStep): boolean {
  const a = g.attack!
  const plan = chargePlan(g, e, g.motion.current, input.player, 'double', input.tick, input.wall)
  if (!plan) return false
  const m = B.moves.double, seconds = m.followBody + m.followRed
  if (!bulgasariSafeSpot([...a.shapes, ...plan.shapes], g.environment.shapes, input.player, input.speed, seconds, input.wall)) return false
  const w = Object.freeze({ body: m.followBody, hold: 0, red: m.followRed, total: seconds, use: a.windup.use })
  g.motion = { ...g.motion, from: g.motion.current, prepared: plan.prepared, impact: plan.impact, relaxed: plan.relaxed, recoverFrom: plan.impact, progress: 0 }
  Object.assign(a, { windup: w, sub: 1, pending: false, hit: false, walled: false, at: g.age, shapes: plan.shapes, path: plan.path!, front: 0 })
  if (plan.wall !== undefined) a.wall = plan.wall; else delete a.wall
  g.state = 'body'; g.timer = w.body
  return true
}
/** 회복(머리 노출) — 타격 뒤에는 미리 판 안으로 맞춘 회복 자세로 */
function recover(g: BulgasariState, seconds: number, relaxed?: BulgasariFrame) {
  const c = g.motion.current
  g.motion = { ...g.motion, move: null, recoverFrom: c, relaxed: relaxed ?? frameOf(c.x, c.y, c.facing, M.recover), recoverSeconds: seconds, prowlTo: null }
  g.state = 'recover'; g.timer = seconds; g.attack = null; g.recoveryHitUsed = false
}
/** 회복 중 첫 타격 — 움찔하고 회복이 조금 늘어난다 (한 번만) */
export function staggerBulgasari(g: BulgasariState): void {
  if (g.state !== 'recover') return
  g.stagger = B.staggerSeconds; g.timer = Math.min(g.motion.recoverSeconds + B.staggerRecover, g.timer + B.staggerRecover)
}
/** 부위가 처음 0 이 됐다 — 그 부위가 필요한 예약 수는 취소 · 앞으로도 제외 (부서진 순간을 적어 그림이 철갑 조각을 날린다) */
export function breakBulgasariPart(g: BulgasariState, id: BulgasariPartId): boolean {
  const key = bulgasariHpOf(id)
  if (!key || g.partHP[key] > 0 || g.brokenSeen.includes(key)) return false
  g.brokenSeen.push(key); g.brokenAt[key] = g.age; g.stagger = B.staggerSeconds
  const a = g.attack
  if (a && g.state !== 'strike' && (a.requires.includes(key) || a.move === 'double' && brokenAll(g, ['fore-near', 'fore-far']))) recover(g, B.idleRecovery)
  return true
}
export function endBulgasari(g: BulgasariState, e: GiantOwner, tick: number): void { g.state = 'dead'; g.attack = null; g.environment.active = false; updateBulgasariPose(g, e, tick) }
function startProwl(g: BulgasariState, e: GiantOwner, player: Point, tick: number): boolean {
  const f = g.motion.current, dir = player.x < f.x ? -1 : 1, home = Math.abs(f.y - B.homeY) > B.homeBand * B.homePull
  const want = point(home ? f.x + dir * B.prowlNear * K : player.x - dir * B.prowlNear, Math.max(B.homeY - B.homeBand, Math.min(B.homeY + B.homeBand, home ? B.homeY : player.y)))
  const to = fitBulgasariFrame(g, e, restAt(want.x, want.y, f.facing), tick)
  if (!to || Math.hypot(to.x - f.x, to.y - f.y) < B.prowlMin) return false
  g.state = 'prowl'; g.timer = B.prowlSeconds; g.attack = null; g.motion = { ...g.motion, move: null, prowlTo: point(to.x, to.y), from: f }
  return true
}
function decide(g: BulgasariState, e: GiantOwner, input: BulgasariStep) {
  const plan = chooseBulgasariPlan(g, e, input.player, input.speed, input.tick, input.random, input.wall), f = g.motion.current
  const near = plan?.move === 'stomp' || plan?.move === 'suction' || plan?.move === 'spin', away = Math.abs(f.y - B.homeY) > B.homeBand * B.homePull
  if (plan && (near || !away)) { beginBulgasariPlan(g, e, plan, input.tick, input.random); return }
  if (g.state !== 'prowl' && startProwl(g, e, input.player, input.tick)) return
  if (plan) { beginBulgasariPlan(g, e, plan, input.tick, input.random); return }
  // 쓸 수가 없어 쉰다 — 하나만 남은 수(다른 수가 다 봉인됨)는 이 쉼 뒤에 다시 쓸 수 있다 (연달아 쓰는 것이 아니다 · 거대 보스가 영영 멈춰 서지 않게)
  recover(g, B.idleRecovery); g.last = null
}
/** 등장 차례 (몫 k) — 문 쇠붙이 씹기 · 문을 부수고 뛰쳐나옴(그 몸 앞 마디도) · 내려섬 · 포효 */
function stepEntry(g: BulgasariState, input: BulgasariStep, was: number): 'roar' | 'quake' | null {
  const n = g.entry, k = 1 - g.timer / B.entrySeconds, wall = input.wall
  const piece = wall && n.gate >= 0 ? wall.pieces[n.gate] : undefined
  E.chompAt.forEach((c, i) => {
    if (was < c && k >= c && i >= n.chomps) { n.chomps = i + 1; if (piece && piece.hp > 0 && !n.gateDown) input.smash?.(n.gate, Math.min(E.chomp, piece.hp - 1), (piece.x0 + piece.x1) / 2) }
  })
  let cue: 'roar' | 'quake' | null = null
  if (!n.burst && k >= E.burst) {
    n.burst = true; cue = 'quake'
    if (wall) {
      // 문(마지막 문)부터 부수고 · 뛰쳐나오는 몸이 짓밟는 성한 마디(몸 가운데 둘레부터 문까지)도 같이 쓰러진다
      if (piece && piece.hp > 0) input.smash?.(n.gate, piece.hp, (piece.x0 + piece.x1) / 2)
      const half = E.breach * K, x0 = n.door.x + n.facing * E.lunge * K * .5, lo = Math.min(x0 - half, piece?.x0 ?? x0), hi = Math.max(x0 + half, piece?.x1 ?? x0)
      wall.pieces.forEach((p, i) => { if (i !== n.gate && p.kind === 'w' && p.hp > 0 && p.x1 > lo && p.x0 < hi) input.smash?.(i, p.hp, (p.x0 + p.x1) / 2) })
    }
  }
  if (!n.landed && k >= E.land) { n.landed = true; cue = 'quake' }
  if (!n.roared && k >= E.roarAt) { n.roared = true; cue = 'roar' }
  return cue
}
/** 땅을 울리는 순간 (앞발 · 박치기가 목책에 박힘 · 지하 질주 출현 · 쌍돌진 박힘) — 화면이 멈칫·흔들린다 */
function strikeEvents(g: BulgasariState, input: BulgasariStep, was: number): 'quake' | null {
  const a = g.attack, p = g.motion.progress
  if (!a || g.state !== 'strike') return null
  let cue: 'quake' | null = null
  if ((a.move === 'stomp' || a.move === 'burrow') && was < a.impactAt && p >= a.impactAt) {
    cue = 'quake'
    const amount = a.move === 'stomp' ? B.moves.stomp.wallHit : B.moves.burrow.wallHit
    for (const i of a.pieces ?? []) { const piece = input.wall?.pieces[i]; if (piece && piece.hp > 0) input.smash?.(i, amount, (piece.x0 + piece.x1) / 2) }
  }
  if ((a.move === 'ram' || a.move === 'double') && a.wall !== undefined && !a.walled) {
    const travel = B.moves[a.move].travel
    if (was < travel && p >= travel) {
      a.walled = true; cue = 'quake'; g.wallHitAt = g.age
      const piece = input.wall?.pieces[a.wall]
      if (piece && piece.hp > 0) input.smash?.(a.wall, B.moves[a.move].wallHit, Math.max(piece.x0, Math.min(piece.x1, a.path?.to.x ?? (piece.x0 + piece.x1) / 2)))
    }
  }
  return cue
}
/** 준비만 — 장수의 공격이 이 뒤에 들어오고 commitBulgasari 가 다치기 전에 다시 잰다 */
export function stepBulgasari(g: BulgasariState, e: GiantOwner, input: BulgasariStep): 'roar' | 'recovery' | 'quake' | null {
  if (e.hp <= 0 || g.state === 'dead') { endBulgasari(g, e, input.tick); return null }
  const was = g.state === 'strike' ? g.motion.progress : -1, entryWas = g.state === 'entry' ? 1 - g.timer / B.entrySeconds : 2
  g.age += input.dt; g.enraged = g.age >= G.enrageAfter; g.stagger = Math.max(0, g.stagger - input.dt)
  if (g.state !== 'entry') { g.environment.age += input.dt; g.environment.active = g.environment.age >= G.environmentTell }
  if (input.dazed) { updateBulgasariPose(g, e, input.tick); return null }
  const waiting = g.state === 'body' || g.state === 'hold' || g.state === 'tell', remaining = g.timer - input.dt
  g.timer = Math.max(0, remaining)
  if (g.state === 'prowl') prowl(g, input.dt)
  let cue: 'roar' | 'recovery' | 'quake' | null = null
  if (g.state === 'entry') {
    cue = stepEntry(g, input, entryWas)
    // 등장이 끝나면 내려선 자리의 쉬는 자세 그대로 다음 수를 고른다 (회복 자세로 튀지 않게)
    if (g.timer === 0) { g.motion = { ...g.motion, current: g.motion.impact, from: g.motion.impact }; recover(g, 0, g.motion.impact) }
  } else if (waiting && remaining <= G.windup.epsilon && g.attack) {
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
    if (g.state === 'strike') {
      const a = g.attack
      // 큰 걸음으로 타격이 한 틱에 끝나도 땅을 울리는 일(목책 박힘 · 내려찍기 · 출현)은 빠뜨리지 않는다
      g.motion.progress = 1; cue = strikeEvents(g, input, was)
      g.motion.current = g.motion.impact
      if (a?.move === 'double' && a.sub === 0 && followDouble(g, e, input)) { /* 둘째 돌진 예고 */ }
      else { const stun = a && (a.move === 'ram' || a.move === 'double') && a.walled ? B.moves[a.move].wallStun : 0; recover(g, (a?.recover ?? B.idleRecovery) + stun, g.motion.relaxed); cue ??= 'recovery' }
    } else if (g.state === 'recover' || g.state === 'roar' || g.state === 'prowl') {
      const desired = e.hp / e.max <= G.phaseCuts[1] ? 3 : e.hp / e.max <= G.phaseCuts[0] ? 2 : 1
      if (g.phase < desired) { g.phase = (g.phase + 1) as 2 | 3; g.state = 'roar'; g.timer = B.roarSeconds; g.environment = bulgasariEnvironment(g.phase); g.motion = { ...g.motion, from: g.motion.current, move: null }; cue = 'roar' }
      else decide(g, e, input)
    }
  }
  updateBulgasariPose(g, e, input.tick)
  return cue ?? strikeEvents(g, input, was)
}
function prowl(g: BulgasariState, dt: number) {
  const to = g.motion.prowlTo, f = g.motion.current
  if (!to) { g.timer = 0; return }
  const dx = to.x - f.x, dy = to.y - f.y, d = Math.hypot(dx, dy), step = Math.min(d, B.prowlSpeed * dt)
  if (d < 1e-6) { g.timer = 0; return }
  const facing: 1 | -1 = Math.abs(dx) > 4 ? (dx < 0 ? -1 : 1) : f.facing
  g.motion.current = { ...f, x: f.x + dx / d * step, y: f.y + dy / d * step, facing }
  g.motion.walk += step / (B.prowlStride * K) * Math.PI * 2
  if (step >= d) g.timer = 0
}
/** 걷는 다리 — 대각 두 쌍이 번갈아 (무겁게 · 드는 발은 앞으로 흔들며 든다) */
function walking(f: BulgasariFrame, w: number): BulgasariFrame {
  const W8 = M.walk, paw = f.paw.map((v, i) => { const leg = Math.floor(i / 2), phase = w + (leg === 0 || leg === 3 ? 0 : Math.PI); return v + (i % 2 === 0 ? Math.sin(phase) * W8.swing * K : -Math.max(0, Math.cos(phase)) * W8.raise * K) })
  return { ...f, paw, lift: f.lift + Math.abs(Math.sin(w)) * W8.bob * K, tail: f.tail + Math.sin(w) * W8.tail, head: f.head + Math.sin(w * 2) * W8.head }
}
function entryFrame(g: BulgasariState): BulgasariFrame {
  const n = g.entry, k = 1 - g.timer / B.entrySeconds, rest = (p: Point) => restAt(p.x, p.y, n.facing)
  if (k < E.walk) {
    const u = smooth(k / E.walk), at = point(n.from.x, lerp(n.from.y, n.door.y, u))
    return walking(rest(at), (at.y - n.from.y) / (B.prowlStride * K) * Math.PI * 2)
  }
  if (k < E.burst) {
    const settle = smooth((k - E.walk) / ((E.burst - E.walk) * .3))
    const base = blend(rest(n.door), frameOf(n.door.x, n.door.y, n.facing, n.gateDown ? M.ram.prepare : M.chomp), settle)
    // 문이 섰으면 두 번 씹는다 (턱 벌렸다 닫음) · 이미 부서졌으면 앞발을 긁으며 노려본다
    const bite = n.gateDown ? 0 : Math.max(...E.chompAt.map(c => Math.max(0, 1 - Math.abs(k - c) / .06)))
    const scrape = n.gateDown ? Math.sin((k - E.walk) * B.entrySeconds * Math.PI * 2 * M.ram.scrapeHz) : 0, paw = [...base.paw]
    paw[0] = (paw[0] ?? 0) + scrape * M.ram.scrapeX * K; paw[1] = (paw[1] ?? 0) - Math.max(0, scrape) * M.ram.scrapeY * K
    return { ...base, jaw: n.gateDown ? .35 : Math.max(.15, bite), head: base.head + bite * .08, paw }
  }
  const from = frameOf(n.door.x, n.door.y, n.facing, n.gateDown ? M.ram.prepare : M.chomp)
  if (k < E.land) {
    const u = (k - E.burst) / (E.land - E.burst), lunge = frameOf(n.to.x, n.to.y, n.facing, M.ram.impact), f = blend(from, lunge, u)
    return { ...f, x: lerp(n.door.x, n.to.x, u), y: lerp(n.door.y, n.to.y, u), hop: E.hop * K * Math.sin(Math.PI * u) }
  }
  const u = (k - E.land) / (1 - E.land), landed = frameOf(n.to.x, n.to.y, n.facing, M.ram.impact), roar = frameOf(n.to.x, n.to.y, n.facing, M.roar)
  return u < .5 ? blend(landed, roar, u * 2) : blend(roar, rest(n.to), (u - .5) * 2)
}
function chosenFrame(g: BulgasariState): BulgasariFrame {
  const m = g.motion, a = g.attack
  if (g.state === 'entry') return entryFrame(g)
  const since = a ? g.age - a.at : 0
  if (g.state === 'body' || g.state === 'hold' || g.state === 'tell') {
    let f = g.state === 'body' ? blend(m.from, m.prepared, 1 - g.timer / (a?.windup.body || 1)) : m.prepared
    if (a?.move === 'ram' && g.state === 'hold') {
      // 앞발로 땅을 긁는다 (seeded 버팀 동안) — 가까운 앞발이 앞뒤로
      const s = Math.sin((a.windup.hold - g.timer) * Math.PI * 2 * M.ram.scrapeHz), paw = [...f.paw]
      paw[0] = (paw[0] ?? 0) + s * M.ram.scrapeX * K; paw[1] = (paw[1] ?? 0) - Math.max(0, s) * M.ram.scrapeY * K; f = { ...f, paw }
    } else if (a?.move === 'double' && g.state === 'hold') f = { ...f, swell: f.swell - .25 * Math.abs(Math.sin((a.windup.hold - g.timer) * Math.PI * 6)) }
    if (a?.move === 'spin') {
      // 등 철편을 들고 제자리에서 돈다 — 돌아서는 순간 가로로 눌렸다 펴진다 (판 나이로)
      const turns = since * B.moves.spin.spinHz, phase = turns % 1
      f = { ...f, facing: Math.floor(turns) % 2 === 0 ? m.prepared.facing : (-m.prepared.facing as 1 | -1), turn: 1 - Math.abs(2 * phase - 1) }
    }
    return f
  }
  if (g.state === 'strike' && a) {
    const p = unit(1 - g.timer / a.strike); m.progress = p
    if ((a.move === 'ram' || a.move === 'double') && a.path) {
      const u = unit(p / B.moves[a.move].travel), go = u * u * (3 - 2 * u), f = blend(m.prepared, m.impact, u)
      return { ...f, x: lerp(m.prepared.x, m.impact.x, go), y: lerp(m.prepared.y, m.impact.y, go) }
    }
    if (a.move === 'burrow') {
      if (p < a.impactAt) return { ...m.prepared, sink: 1 }
      const u = (p - a.impactAt) / Math.max(1e-6, 1 - a.impactAt)
      return { ...m.impact, sink: 1 - smooth(u * 1.6) }
    }
    return blend(m.prepared, m.impact, p / Math.max(a.impactAt, 1e-6))
  }
  if (g.state === 'recover') return blend(m.recoverFrom, m.relaxed, 1 - g.timer / Math.max(1e-6, m.recoverSeconds))
  if (g.state === 'roar') { const k = Math.sin(Math.PI * unit(1 - g.timer / B.roarSeconds)), r = frameOf(m.from.x, m.from.y, m.from.facing, M.roar); return blend(m.from, r, k) }
  if (g.state === 'prowl') return walking(restAt(m.current.x, m.current.y, m.current.facing), m.walk)
  return m.current
}
/** 숨·꼬리 흔들림·움찔·절뚝임 — 판 시각(age)만 쓴다 */
function alive(g: BulgasariState, f: BulgasariFrame): BulgasariFrame {
  if (g.state === 'dead') return f
  const b = M.breath, t = g.age, s = g.stagger > 0 ? Math.sin(Math.PI * g.stagger / B.staggerSeconds) : 0
  const lame = (['fore-near', 'fore-far'] as const).some(id => g.partHP[id] <= 0) ? M.limp.sag : 0
  return { ...f, lift: f.lift + Math.sin(t * Math.PI * 2 * b.hz) * b.lift * K, pitch: f.pitch - lame + s * M.stagger.pitch, shift: f.shift + s * M.stagger.shift * K, head: f.head + s * M.stagger.head,
    swell: f.swell + Math.sin(t * Math.PI * 2 * b.hz) * b.swell, tail: f.tail + Math.sin(t * Math.PI * 2 * b.tailHz) * b.tail }
}
export function updateBulgasariPose(g: BulgasariState, e: GiantOwner, tick: number): void {
  const chosen = chosenFrame(g)
  g.motion.current = { ...chosen, hop: 0, turn: 0 }
  const f = alive(g, chosen)
  e.x = f.x; e.y = f.y; g.submerge = f.sink
  const pose = poseOf(g, e, f, tick)
  g.pose = Object.freeze({ ...pose, worldGeometry: Object.freeze({ ...pose.worldGeometry, tell: (g.state === 'tell' || g.state === 'strike') && g.attack ? g.attack.shapes : Object.freeze([]) }) })
  g.bounds = bulgasariCollisionBounds(pose)
  const a = g.attack
  if (!a) return
  a.activeShapes = Object.freeze([])
  if (g.state !== 'strike') { if (a.path) a.front = 0; return }
  const p = g.motion.progress
  if ((a.move === 'ram' || a.move === 'double') && a.path) {
    // 달리는 앞머리가 이번 틱에 지난 토막만 (빨강 = 지나간 길의 합)
    const u = unit(p / B.moves[a.move].travel), go = u * u * (3 - 2 * u), prev = a.front ?? 0, r = B.moves[a.move].width / 2
    const at = (q: number) => point(lerp(a.path!.from.x, a.path!.to.x, q), lerp(a.path!.from.y, a.path!.to.y, q))
    if (go > prev) a.activeShapes = frozen([{ kind: 'capsule', from: at(prev), to: at(go), radius: r }])
    a.front = go
  } else if (a.move === 'burrow' && a.path) {
    // 땅속 앞머리가 띠를 지나며 솟는다 (그 뒤 impactAt 에 출현 원)
    const s = B.moves.burrow, go = unit(p / s.front), prev = a.front ?? 0
    const at = (q: number) => point(lerp(a.path!.from.x, a.path!.to.x, q), lerp(a.path!.from.y, a.path!.to.y, q))
    if (go > prev) a.activeShapes = frozen([{ kind: 'capsule', from: at(prev), to: at(go), radius: s.width / 2 }])
    a.front = go
  }
}
/** 장수 맞음 판정 — 타격 순간 한 번(달리는 수 · 지하 질주 띠는 앞머리가 지난 자리) · 부위가 부서졌으면 없던 일 · 환경은 박자마다 */
export function commitBulgasari(g: BulgasariState, e: GiantOwner, player: Point, hurt: (damage: number) => void, dazed: boolean, push: (dx: number, dy: number) => void): void {
  if (e.hp <= 0 || g.state === 'dead') { g.attack = null; g.environment.active = false; return }
  if (dazed) return
  const a = g.attack, at: Shape = { kind: 'circle', center: point(player.x, player.y), radius: 0 }
  if (g.state === 'strike' && a && !a.hit && a.seq === g.seq && a.requires.every(id => g.partHP[id] > 0)) {
    const scale = g.enraged ? G.enrageDamage : 1
    if ((a.activeShapes ?? []).some(s => overlaps(s, at))) { a.hit = true; hurt(a.damage * scale) }
    else if (a.move !== 'ram' && a.move !== 'double' && a.pending && g.motion.progress >= a.impactAt) {
      a.pending = false
      // 지하 질주의 출현은 원만 (띠는 앞머리가 지날 때 이미 쟀다)
      const shapes = a.move === 'burrow' ? a.shapes.slice(1) : a.shapes
      if (shapes.some(s => overlaps(s, at))) {
        a.hit = true; hurt(a.damage * scale)
        if (a.move === 'suction' && a.pull) { const mo = (a.shapes[0] as { center: Point }).center, dx = mo.x - player.x, dy = mo.y - player.y, d = Math.hypot(dx, dy) || 1, k = Math.min(a.pull, d) / d; push(dx * k, dy * k) }
      }
    }
  }
  if (g.environment.active && g.environment.age >= g.environment.nextHit && g.environment.shapes.some(s => overlaps(s, at))) {
    g.environment.nextHit = g.environment.age + G.environmentEvery; hurt(G.environmentDamage * (g.enraged ? G.enrageDamage : 1))
  }
}
/** 맞을 수 있는 부위 — 부서진 다리·턱은 빠지고 · 머리와 철갑(벗겨지면 드러난 살)은 남는다 */
export function bulgasariLiveParts(g: BulgasariState): readonly PartPose<BulgasariPartId>[] {
  return g.pose.parts.filter(p => { const key = bulgasariHpOf(p.id); return key === null || key === 'head' || isArmor(key) || g.partHP[key] > 0 })
}
/**
 * 철갑은 성하면 armorDamage · 벗겨지면 exposedDamage (머리 배율은 giant-core 그대로).
 * 등 철갑은 몸통을 덮은 껍데기다 — 성한 동안 몸통 살(root)에 닿은 타격도 등 철갑이 받는다(그 체력이 깎인다) · 벗겨지면 몸통 살이 exposedDamage 로 드러난다.
 */
function armorScale<T extends Contact<BulgasariPartId> | null>(g: BulgasariState, c: T): T {
  if (!c) return c
  if (c.partId === 'root') return (g.partHP.back > 0 ? { ...c, partId: 'back', weakScale: B.armorDamage } : { ...c, weakScale: B.exposedDamage }) as T
  if (!isArmor(c.partId)) return c
  return { ...c, weakScale: g.partHP[c.partId] > 0 ? B.armorDamage : B.exposedDamage } as T
}
export const bulgasariContact = (g: BulgasariState, shape: Shape): Contact<BulgasariPartId> | null => armorScale(g, pickContact({ ...g.pose, parts: bulgasariLiveParts(g) }, shape, bulgasariRank))
export const bulgasariSweep = (g: BulgasariState, from: Point, to: Point, radius: number): Contact<BulgasariPartId> | null => armorScale(g, sweepContact({ ...g.pose, parts: bulgasariLiveParts(g) }, from, to, radius, bulgasariRank))
/** 맞은 부위의 체력을 깎는다 · 처음 부서지면 true */
export function damageBulgasariPart(g: BulgasariState, id: BulgasariPartId, amount: number): boolean {
  const key = bulgasariHpOf(id)
  if (key) g.partHP[key] = Math.max(0, g.partHP[key] - amount)
  g.lastHitPart = id
  return breakBulgasariPart(g, id)
}
/** 부서진 부위가 아직 자세에 반영되지 않았다 */
export const bulgasariPoseStale = (g: BulgasariState) => g.pose.parts.some(p => { const key = bulgasariHpOf(p.id); return key !== null && p.damaged !== (g.partHP[key] <= 0) })
