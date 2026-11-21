/**
 * 55 숲 산길 거대 보스 「구미호」 — 판(sim) 쪽 (docs/realm/BOSS.md 구미호 표 · 성인 여성 · 형: 「섹시한 여성 인간형 보스」).
 * 몸 준비 → 붉은 바닥 → 타격 → 머리 노출 회복 · 막 1 여인(부채) → 막 2 변신(웃음 · 반여우 · 꼬리 아홉이 하나씩) → 막 3.
 * 백두 대호(tiger.ts)와 같은 공통 계약: giant-core 의 접촉·겹침·고정 예고 · imugi.safeLanding(닿을 수 있는 3P 빈 원) · HAEBI_GIANT 의 막·분노·환경 박자.
 * 사람 모양이라 뼈대 대신 그림 자세 넷의 관절 자리(HAEBI_GUMIHO.rig.poses)를 섞어 쓴다 — 판정과 그림(gumiho-view.ts)이 같은 점을 읽는다.
 * 수는 서 있는 자리(발) 둘레의 땅을 친다 · 꼬리 아홉은 따로 맞고 끊어지는 부위 · 환영은 그림일 뿐 맞지도 때리지도 않는다.
 * DOM·벽시계·Math.random 없음 — 난수는 판의 seeded random 하나 (수 고르기 · 버팀 박자 · 진짜 자리 · 빈 통로 쪽).
 */
import { HAEBI_GIANT as G, HAEBI_GUMIHO as F, HAEBI_RUN as C } from '../tune/params.ts'
import { freezeTell, overlaps, pickContact, sweepContact, type Collider, type Contact, type ImugiPose, type PartPose, type Point, type Shape } from './giant-core.ts'
import type { GiantOwner } from './imugi.ts'

export const GUMIHO_TAILS = ['tail1', 'tail2', 'tail3', 'tail4', 'tail5', 'tail6', 'tail7', 'tail8', 'tail9'] as const
export type GumihoTailId = typeof GUMIHO_TAILS[number]
export const GUMIHO_PARTS = ['root', 'torso', 'head', 'fan-arm', 'claw-arm', ...GUMIHO_TAILS] as const
export type GumihoPartId = typeof GUMIHO_PARTS[number]
/** 따로 체력을 갖는 부위 (옷자락·몸통은 본체 그 자체) */
export const GUMIHO_HP = ['head', 'fan-arm', 'claw-arm', ...GUMIHO_TAILS] as const
export type GumihoHp = typeof GUMIHO_HP[number]
export type GumihoMove = keyof typeof F.moves
export type GumihoPoseId = 0 | 1 | 2 | 3
/** 가운데 꼬리 — 부서지면 환영 후 되받기가 봉인된다 */
export const CENTER_TAIL: GumihoTailId = 'tail5'
export const gumihoHpOf = (id: GumihoPartId): GumihoHp | null => id === 'root' || id === 'torso' ? null : id
const isTail = (id: string): id is GumihoTailId => id.startsWith('tail')
const PARENT = Object.fromEntries(GUMIHO_PARTS.map(id => [id, id === 'root' ? null : id === 'torso' || isTail(id) ? 'root' : 'torso'])) as Record<GumihoPartId, GumihoPartId | null>
/** 같은 거리일 때 먼저 맞는 부위 — 약점(머리) · 부채 팔 · 도약 팔 · 꼬리 · 몸통 · 옷자락 */
const RANK = Object.fromEntries(GUMIHO_PARTS.map(id => [id, id === 'head' ? 0 : id === 'fan-arm' ? 1 : id === 'claw-arm' ? 2 : isTail(id) ? 3 + GUMIHO_TAILS.indexOf(id) : id === 'torso' ? 12 : 13])) as Record<GumihoPartId, number>
export const gumihoRank = (id: GumihoPartId) => RANK[id]

/** 한 순간의 몸 — pose 에서 pose2 로 mix 만큼 섞인 그림 자세 · 웅크림 · 앞 기울임 · 뜀 · 꼬리 펼침 · 꼬리마다 더 든 각·길이 몫 · 보임 · 돌아섬 · 반여우 · 나온 꼬리 수 */
export interface GumihoFrame {
  x: number; y: number; facing: 1 | -1; pose: GumihoPoseId; pose2: GumihoPoseId; mix: number
  crouch: number; lean: number; lift: number; spread: number; raise: readonly number[]; reach: readonly number[]
  fade: number; turn: number; fox: number; tails: number
}
export interface GumihoTail { readonly base: Point; readonly tip: Point; readonly angle: number; readonly length: number; readonly shown: number }
/** 그림이 읽는 관절 자리 (판 좌표) */
export interface GumihoSkeleton {
  readonly feet: Point; readonly hip: Point; readonly neck: Point; readonly head: Point
  readonly fanShoulder: Point; readonly fanHand: Point; readonly fanTip: Point; readonly fanRadius: number
  readonly clawShoulder: Point; readonly clawHand: Point; readonly tails: readonly GumihoTail[]
}
export interface GumihoPose extends ImugiPose<GumihoPartId> { readonly kind: 'gumiho'; readonly facing: 1 | -1; readonly anchor: Point; readonly frame: Readonly<GumihoFrame>; readonly sk: GumihoSkeleton }
export interface GumihoWindup { readonly body: number; readonly hold: number; readonly red: number; readonly total: number; readonly use: number }
/** 차례 타격 하나 — 모양마다 그 모양을 내는 꼬리(없으면 null) · 이 차례의 붉은 예고 초 */
export interface GumihoHit { readonly shapes: readonly Shape[]; readonly owners: readonly (GumihoHp | null)[]; readonly red: number }
export interface GumihoAttack {
  windup: Readonly<GumihoWindup>; seq: number; move: GumihoMove; requires: readonly GumihoHp[]; hits: readonly GumihoHit[]; step: number
  /** 지금 차례에서 아직 살아 있는 모양 — 그림과 판정이 같이 읽는다 */
  shapes: readonly Shape[]
  pending: boolean; hit: boolean; damage: number; recover: number; strike: number; impactAt: number; aim: number
  spots?: readonly Point[]; spotFacing?: readonly (1 | -1)[]; real?: number; landing?: Point; lane?: number; slots?: readonly number[]
}
export interface GumihoMotion { move: GumihoMove | null; from: GumihoFrame; prepared: GumihoFrame; impact: GumihoFrame; relaxed: GumihoFrame; current: GumihoFrame; recoverFrom: GumihoFrame; recoverSeconds: number; progress: number; blocked: boolean; walk: number; glideTo: Point | null; blink: GumihoFrame | null }
export interface GumihoState {
  kind: 'gumiho'; phase: 1 | 2 | 3; state: 'entry' | 'body' | 'hold' | 'tell' | 'strike' | 'recover' | 'roar' | 'glide' | 'dead'; pattern: GumihoMove | null
  seq: number; age: number; timer: number; enraged: boolean; last: GumihoMove | null; recoveryHitUsed: boolean; stagger: number
  windupUses: Partial<Record<GumihoMove, number>>; brokenSeen: GumihoHp[]; brokenAt: Partial<Record<GumihoHp, number>>
  partHP: Record<GumihoHp, number>; partMax: Record<GumihoHp, number>; pose: GumihoPose; motion: GumihoMotion; attack: GumihoAttack | null
  environment: { phase: 1 | 2 | 3; shapes: readonly Shape[]; age: number; active: boolean; nextHit: number }
  bounds: { left: number; top: number; right: number; bottom: number }; lastHitPart: GumihoPartId; poisonPart: GumihoPartId
}

const R = F.rig, K = R.scale, M = F.motion, W = C.width, H = C.height, TAU = Math.PI * 2
const point = (x: number, y: number): Point => ({ x, y })
const unit = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => { const t = unit(x); return t * t * (3 - 2 * t) }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
function deepFreeze<V>(v: V): V { if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) { for (const x of Object.values(v)) deepFreeze(x); Object.freeze(v) } return v }
const frozen = (shapes: readonly Shape[]): readonly Shape[] => Object.freeze(shapes.map(freezeTell))
const box = (x: number, y: number, halfX: number, halfY: number): Shape => ({ kind: 'box', center: point(x, y), halfX, halfY, angle: 0 })

// ── 자세 ──
type Spec = { readonly pose: number; readonly crouch: number; readonly lean: number; readonly spread: number }
const NONE: readonly number[] = Object.freeze(GUMIHO_TAILS.map(() => 0)), FULL: readonly number[] = Object.freeze(GUMIHO_TAILS.map(() => 1))
const poseId = (n: number): GumihoPoseId => n === 1 || n === 2 || n === 3 ? n : 0
function frameOf(x: number, y: number, facing: 1 | -1, s: Spec): GumihoFrame {
  const p = poseId(s.pose)
  return { x, y, facing, pose: p, pose2: p, mix: 0, crouch: s.crouch, lean: s.lean, lift: 0, spread: s.spread, raise: NONE, reach: FULL, fade: 1, turn: 0, fox: 0, tails: 0 }
}
/** 시험·검수: params 자세로 실제 크기 자세를 만든다 */
export const gumihoFrame = (x: number, y: number, facing: 1 | -1, s: Spec) => frameOf(x, y, facing, s)
const lead = (f: GumihoFrame) => f.mix < .5 ? f.pose : f.pose2
function blend(a: GumihoFrame, b: GumihoFrame, t: number): GumihoFrame {
  const k = smooth(t), l = (x: number, y: number) => lerp(x, y, k), pa = lead(a), pb = lead(b)
  return { x: l(a.x, b.x), y: l(a.y, b.y), facing: a.facing !== b.facing && k < .5 ? a.facing : b.facing, pose: pa, pose2: pb, mix: pa === pb ? 0 : k,
    crouch: l(a.crouch, b.crouch), lean: l(a.lean, b.lean), lift: l(a.lift, b.lift), spread: l(a.spread, b.spread),
    raise: a.raise.map((v, i) => l(v, b.raise[i] ?? 0)), reach: a.reach.map((v, i) => l(v, b.reach[i] ?? 1)),
    fade: l(a.fade, b.fade), turn: a.facing !== b.facing ? 1 - Math.abs(2 * k - 1) : l(a.turn, b.turn), fox: l(a.fox, b.fox), tails: l(a.tails, b.tails) }
}

// ── 관절 자리 (한 틱의 순수 셈) ──
type Key = 'head' | 'neck' | 'hip' | 'tail' | 'fanShoulder' | 'fanHand' | 'fanTip' | 'clawShoulder' | 'clawHand'
function local(f: GumihoFrame, k: Key): Point { const a = R.poses[f.pose][k], b = R.poses[f.pose2][k]; return point(lerp(a[0], b[0], f.mix) * K, lerp(a[1], b[1], f.mix) * K) }
/** 돌아서는 순간 가로로 눌렸다 펴진다 */
export const gumihoSquash = (f: GumihoFrame) => 1 - f.turn * R.turnSquash
/** 몸 쪽 점(발 가운데 0 · 앞 +x · 아래 +y · 판 px) → 판 좌표: 웅크림(세로 눌림) · 기울임(위로 갈수록 앞으로) · 돌아섬 · 뜀 — 그림도 같은 변환을 쓴다 */
export function gumihoWorld(f: GumihoFrame, p: Point): Point {
  const y = p.y * (1 - f.crouch * R.crouch), x = p.x - y * f.lean
  return point(f.x + f.facing * gumihoSquash(f) * x, f.y + y - f.lift)
}
/** 앞 +x 기준 각 → 판 각 */
export const gumihoAngle = (facing: 1 | -1, a: number) => facing === 1 ? a : Math.PI - a
/** 꼬리 i 가 얼마나 나왔나 (변신 동안 emergeOrder 차례로 0→1) */
export const tailShown = (f: GumihoFrame, i: number) => unit(f.tails - (R.tails.emergeOrder as readonly number[]).indexOf(i))
/** 꼬리 i 의 앞 +x 기준 각 (쉬는 각 ↔ 펼친 각 + 더 든 각) */
const tailLocal = (f: GumihoFrame, i: number) => lerp(R.tails.rest[i]!, R.tails.spread[i]!, f.spread) + (f.raise[i] ?? 0)
export function gumihoSkeleton(f: GumihoFrame): GumihoSkeleton {
  const at = (k: Key) => gumihoWorld(f, local(f, k)), base = local(f, 'tail'), T = R.tails, pa = R.poses[f.pose], pb = R.poses[f.pose2]
  const tails = GUMIHO_TAILS.map((_, i): GumihoTail => {
    const shown = tailShown(f, i), b = gumihoWorld(f, point(base.x + (i - 4) * T.baseStep[0] * K, base.y + (i - 4) * T.baseStep[1] * K))
    const angle = gumihoAngle(f.facing, tailLocal(f, i)), length = T.length[i]! * (f.reach[i] ?? 1) * shown
    return { base: b, tip: point(b.x + Math.cos(angle) * length, b.y + Math.sin(angle) * length), angle, length, shown }
  })
  return { feet: point(f.x, f.y - f.lift), hip: at('hip'), neck: at('neck'), head: at('head'), fanShoulder: at('fanShoulder'), fanHand: at('fanHand'), fanTip: at('fanTip'),
    fanRadius: lerp(pa.fanRadius, pb.fanRadius, f.mix) * K, clawShoulder: at('clawShoulder'), clawHand: at('clawHand'), tails }
}
interface PoseFlags { ownerId: number; tick: number; alive: boolean; targetable: boolean; recovering: boolean; partHP: Readonly<Record<GumihoHp, number>> }
/** 판정 부위(collider)와 관절을 함께 — 그림과 판정이 같은 점을 쓴다 */
export function makeGumihoPose(f: GumihoFrame, o: PoseFlags): GumihoPose {
  const sk = gumihoSkeleton(f), parts = gumihoParts(f, o, sk)
  return deepFreeze({ kind: 'gumiho' as const, ownerId: o.ownerId, tick: o.tick, parts, worldGeometry: { parts: parts.map(p => ({ id: p.id, shape: p.collider })), tell: [] as Shape[] }, jawOpen: 0, recovering: o.recovering, facing: f.facing, anchor: point(f.x, f.y), frame: { ...f }, sk })
}
/** 판정 부위만 (얼리지 않는다 · 수를 세워 볼 때 자세마다 쓴다) */
function gumihoParts(f: GumihoFrame, o: PoseFlags, sk: GumihoSkeleton = gumihoSkeleton(f)): PartPose<GumihoPartId>[] {
  const visible = o.alive && f.fade >= F.fadeHidden, parts: PartPose<GumihoPartId>[] = []
  const put = (id: GumihoPartId, start: Point, end: Point, collider: Collider, out = true) => {
    const key = gumihoHpOf(id), damaged = key !== null && o.partHP[key] <= 0, severed = damaged && id !== 'head', shown = visible && out && !(isTail(id) && damaged)
    parts.push({ id, parent: PARENT[id], start, end, angle: Math.atan2(end.y - start.y, end.x - start.x), mirrorY: f.facing, alive: o.alive, broken: severed, damaged, visible: shown, targetable: shown && !severed && o.targetable, height: f.lift, widthScale: 1, collider })
  }
  const cap = (a: Point, b: Point, r: number): Collider => ({ kind: 'capsule', from: a, to: b, radius: r })
  const skirt = gumihoWorld(f, point(0, -R.robeLift * K))
  put('root', skirt, sk.hip, cap(skirt, sk.hip, R.robeRadius * K))
  put('torso', sk.hip, sk.neck, cap(sk.hip, sk.neck, R.torsoRadius * K))
  put('head', sk.neck, sk.head, { kind: 'ellipse', center: sk.head, rx: R.headRadii[0] * K, ry: R.headRadii[1] * K, angle: 0 })
  put('fan-arm', sk.fanShoulder, sk.fanTip, cap(sk.fanShoulder, sk.fanTip, sk.fanRadius))
  put('claw-arm', sk.clawShoulder, sk.clawHand, cap(sk.clawShoulder, sk.clawHand, R.clawRadius * K))
  GUMIHO_TAILS.forEach((id, i) => { const t = sk.tails[i]!; put(id, t.base, t.tip, cap(t.base, t.tip, Math.max(1, R.tails.radius * t.length)), t.shown >= 1) })
  return parts
}
/** 보이는 판정 부위의 상자 (tails=false 면 꼬리는 빼고) */
export const gumihoCollisionBounds = (pose: GumihoPose, tails = true) => partsBounds(pose.parts, pose.anchor, tails)
function partsBounds(parts: readonly PartPose<GumihoPartId>[], anchor: Point, tails: boolean) {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  for (const p of parts) {
    if (!p.visible || !tails && isTail(p.id)) continue
    const c = p.collider
    if (c.kind === 'capsule') { left = Math.min(left, c.from.x - c.radius, c.to.x - c.radius); right = Math.max(right, c.from.x + c.radius, c.to.x + c.radius); top = Math.min(top, c.from.y - c.radius, c.to.y - c.radius); bottom = Math.max(bottom, c.from.y + c.radius, c.to.y + c.radius) }
    else { const rx = Math.hypot(c.rx * Math.cos(c.angle), c.ry * Math.sin(c.angle)), ry = Math.hypot(c.rx * Math.sin(c.angle), c.ry * Math.cos(c.angle)); left = Math.min(left, c.center.x - rx); right = Math.max(right, c.center.x + rx); top = Math.min(top, c.center.y - ry); bottom = Math.max(bottom, c.center.y + ry) }
  }
  return Number.isFinite(left) ? { left, top, right, bottom } : { left: anchor.x, top: anchor.y, right: anchor.x, bottom: anchor.y }
}

// ── 상태 ──
/** 막별 환경 — 막 1 양옆 숲바람 · 막 2 양옆 꼬리 호 · 막 3 방사 꼬리선 (가운데 세로 3P 는 판 끝까지 늘 빈다) */
function environment(phase: 1 | 2 | 3): GumihoState['environment'] {
  const E = F.env, c = E.crescent
  const shapes: Shape[] = phase === 1 ? [{ kind: 'union', shapes: [box(E.side / 2, H / 2, E.side / 2, H / 2), box(W - E.side / 2, H / 2, E.side / 2, H / 2)] }]
    : phase === 2 ? [{ kind: 'union', shapes: [{ kind: 'arc', center: point(c.x, H / 2), inner: c.inner, outer: c.outer, angle: 0, halfAngle: c.halfAngle }, { kind: 'arc', center: point(W - c.x, H / 2), inner: c.inner, outer: c.outer, angle: Math.PI, halfAngle: c.halfAngle }] }]
    : [{ kind: 'union', shapes: E.rays.map(([top, bottom]): Shape => ({ kind: 'line', from: point(top, 0), to: point(bottom, H), width: E.width })) }]
  return { phase, shapes: frozen(shapes), age: 0, active: false, nextHit: 0 }
}
/** 지금 몸의 겉모습 — 막 1 여인 · 막 2 변신 동안 반여우로 바뀌고 꼬리가 하나씩 · 그 뒤 반여우와 꼬리 아홉 */
function formOf(g: GumihoState): { fox: number; tails: number } {
  if (g.phase === 1) return { fox: 0, tails: 0 }
  if (g.state === 'roar' && g.phase === 2) { const k = 1 - g.timer / F.transformSeconds, T = M.transform; return { fox: smooth((k - T.fox) / T.foxSpan), tails: unit((k - T.tails) / T.tailsSpan) * GUMIHO_TAILS.length } }
  return { fox: 1, tails: GUMIHO_TAILS.length }
}
const flags = (g: GumihoState, e: GiantOwner, tick: number, planning = false): PoseFlags => ({ ownerId: e.id, tick, alive: e.hp > 0 && g.state !== 'dead', targetable: planning || g.state !== 'entry', recovering: g.state === 'recover', partHP: g.partHP })
const poseOf = (g: GumihoState, e: GiantOwner, f: GumihoFrame, tick: number, planning = false) => makeGumihoPose(f, flags(g, e, tick, planning))
/** 세워 볼 자세의 판정 부위 (지금 겉모습 · 보임 · 얼리지 않음) */
const planParts = (g: GumihoState, e: GiantOwner, f: GumihoFrame, tick: number) => { const form = formOf(g); return gumihoParts({ ...f, fade: 1, lift: 0, fox: form.fox, tails: form.tails }, flags(g, e, tick, true)) }
/** 같은 자리를 쓰는 자세들을 한 번에 판 안으로 — 옮길 몫 (몸이 판보다 크면 null) · 꼬리는 지금 나온 만큼 잰다 (tails=false 면 몸만) */
function shiftInto(g: GumihoState, e: GiantOwner, frames: readonly GumihoFrame[], tick: number, tails = true): Point | null {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  for (const f of frames) { const b = partsBounds(planParts(g, e, f, tick), point(f.x, f.y), tails); left = Math.min(left, b.left); right = Math.max(right, b.right); top = Math.min(top, b.top); bottom = Math.max(bottom, b.bottom) }
  if (right - left > W || bottom - top > H) return null
  return point(left < 0 ? -left : right > W ? W - right : 0, top < 0 ? -top : bottom > H ? H - bottom : 0)
}
const moved = (f: GumihoFrame, d: Point): GumihoFrame => ({ ...f, x: f.x + d.x, y: f.y + d.y })
/** 판 안에 판정 부위가 다 들어오게 발 자리를 옮긴다 · 몸이 판보다 크면 null */
export function fitGumihoFrame(g: GumihoState, e: GiantOwner, f: GumihoFrame, tick: number): GumihoFrame | null { const d = shiftInto(g, e, [f], tick); return d && moved(f, d) }
function fitAll(g: GumihoState, e: GiantOwner, frames: readonly GumihoFrame[], tick: number, tails = true): GumihoFrame[] | null { const d = shiftInto(g, e, frames, tick, tails); return d && frames.map(f => moved(f, d)) }
const restAt = (x: number, y: number, facing: 1 | -1) => frameOf(x, y, facing, M.rest)
export function createGumiho(e: GiantOwner, tick = 0): GumihoState {
  const partMax = Object.fromEntries(GUMIHO_HP.map(id => [id, F.hp * (isTail(id) ? F.parts.tail : F.parts[id as 'head' | 'fan-arm' | 'claw-arm'])])) as Record<GumihoHp, number>
  const base = restAt(e.x, F.homeY, e.x <= W / 2 ? 1 : -1)
  const motion: GumihoMotion = { move: null, from: base, prepared: base, impact: base, relaxed: base, current: base, recoverFrom: base, recoverSeconds: F.idleRecovery, progress: 0, blocked: false, walk: 0, glideTo: null, blink: null }
  const g: GumihoState = { kind: 'gumiho', phase: 1, state: 'entry', pattern: null, seq: 0, age: 0, timer: F.entrySeconds, enraged: false, last: null, recoveryHitUsed: false, stagger: 0,
    windupUses: {}, brokenSeen: [], brokenAt: {}, partHP: { ...partMax }, partMax, pose: makeGumihoPose(base, { ownerId: e.id, tick, alive: true, targetable: false, recovering: false, partHP: partMax }), motion, attack: null,
    environment: environment(1), bounds: { left: 0, top: 0, right: W, bottom: H }, lastHitPart: 'root', poisonPart: 'root' }
  const fit = fitGumihoFrame(g, e, base, tick) ?? base
  g.motion = { ...motion, from: fit, prepared: fit, impact: fit, relaxed: fit, current: fit, recoverFrom: fit }
  updateGumihoPose(g, e, tick); return g
}

// ── 수 ──
const alive = (g: GumihoState, id: GumihoHp) => g.partHP[id] > 0
/** 부서진 부위로 봉인된 수 — 부채 팔(찌르기·곡풍) · 도약 팔(도약 베기) · 가운데 꼬리(환영) · 꼬리 셋 모두(순차쓸기) · 꼬리 아홉 모두(지연 찌르기) */
export function gumihoSealed(g: GumihoState, move: GumihoMove): boolean {
  if (move === 'thrust' || move === 'gale') return !alive(g, 'fan-arm')
  if (move === 'leap') return !alive(g, 'claw-arm')
  if (move === 'illusion') return !alive(g, CENTER_TAIL)
  if (move === 'sweep') return F.moves.sweep.tails.every(i => !alive(g, GUMIHO_TAILS[i]!))
  return GUMIHO_TAILS.every(id => !alive(g, id))
}
const REQUIRES: Record<GumihoMove, readonly GumihoHp[]> = { thrust: ['fan-arm'], gale: ['fan-arm'], illusion: [CENTER_TAIL], sweep: [], leap: ['claw-arm'], ninetail: [] }
const facingTo = (f: GumihoFrame, target: Point): 1 | -1 => Math.abs(target.x - f.x) < F.turnDeadZone ? f.facing : target.x < f.x ? -1 : 1
/** 고정 tick 의 수 후보 — 막 · 같은 수 연속 금지 · 거리 · 살아 있는 부위 (난수 없음) */
export function gumihoCandidates(g: GumihoState, e: GiantOwner, target: Point): GumihoMove[] {
  if (e.hp <= 0 || g.state === 'dead') return []
  const f = g.motion.current, d = Math.hypot(target.x - f.x, target.y - f.y)
  return (Object.keys(F.moves) as GumihoMove[]).filter(move => move !== g.last && g.phase >= F.moves[move].phase && !gumihoSealed(g, move) && d <= F.moves[move].reach && (move !== 'leap' || d >= F.moves.leap.min))
}
/** 바라보는 쪽에서 장수 쪽으로 limit 까지만 튼 판 각 */
function aimFrom(from: Point, facing: 1 | -1, target: Point, limit: number): number {
  const base = facing === 1 ? 0 : Math.PI, want = Math.atan2(target.y - from.y, target.x - from.x)
  return base + Math.max(-limit, Math.min(limit, wrap(want - base)))
}
export function gumihoWindup(g: GumihoState, move: GumihoMove, hold = 0): Readonly<GumihoWindup> {
  const m = F.moves[move], use = (g.windupUses[move] ?? 0) + 1, h = Math.max(0, Math.min(hold, G.windup.max - m.body - m.red))
  return Object.freeze({ body: m.body, hold: h, red: m.red, total: m.body + h + m.red, use })
}
const one = (shapes: readonly Shape[], red: number): GumihoHit => Object.freeze({ shapes: frozen(shapes), owners: Object.freeze(shapes.map(() => null)), red })
const cone = (center: Point, radius: number, angle: number, halfAngle: number): Leaf => ({ kind: 'cone', center, radius, angle, halfAngle })
const ray = (o: Point, a: number, from: number, length: number, width: number): Shape => ({ kind: 'line', from: point(o.x + Math.cos(a) * from, o.y + Math.sin(a) * from), to: point(o.x + Math.cos(a) * (from + length), o.y + Math.sin(a) * (from + length)), width })
export interface GumihoPlan {
  move: GumihoMove; prepared: GumihoFrame; impact: GumihoFrame; relaxed: GumihoFrame; hits: readonly GumihoHit[]; aim: number; safeSeconds: number
  /** 난수로 고를 갈래 — 환영: 자리마다 (자세 셋과 함께) · 지연 찌르기: 빈 통로 쪽마다 */
  variants?: readonly (readonly GumihoHit[])[]; prepares?: readonly GumihoFrame[]; impacts?: readonly GumihoFrame[]; relaxes?: readonly GumihoFrame[]
  spots?: readonly Point[]; spotFacing?: readonly (1 | -1)[]; landing?: Point; slotSets?: readonly (readonly number[])[]
}
/** 몸·자리·붉은 바닥을 붉은빛 앞에 모두 정한다 — 그 뒤엔 따라가거나 돌거나 옮기지 않는다 */
export function planGumiho(g: GumihoState, e: GiantOwner, target: Point, move: GumihoMove, tick: number): GumihoPlan | null {
  const from = g.motion.current, facing = facingTo(from, target), m = F.moves, min = (mv: GumihoMove) => F.moves[mv].body + F.moves[mv].red
  const at = (x: number, y: number, s: Spec, f: 1 | -1 = facing) => frameOf(x, y, f, s)
  /** 제자리 수: 준비·타격·회복 자세를 한 발 자리로 */
  const still = (spec: { prepare: Spec; impact: Spec }) => fitAll(g, e, [at(from.x, from.y, spec.prepare), at(from.x, from.y, spec.impact), at(from.x, from.y, M.recover)], tick) as [GumihoFrame, GumihoFrame, GumihoFrame] | null
  if (move === 'thrust' || move === 'gale') {
    const fit = still(M[move]); if (!fit) return null
    const [prepared, impact, relaxed] = fit, o = point(impact.x, impact.y)
    if (move === 'thrust') { const t = m.thrust, a = aimFrom(o, facing, target, t.aimLimit); return { move, prepared, impact, relaxed, hits: [one([ray(o, a, t.from, t.length, t.width)], t.red)], aim: a, safeSeconds: min(move) } }
    const q = m.gale, a = aimFrom(o, facing, target, q.aimLimit)
    return { move, prepared, impact, relaxed, hits: [one(q.rings.map(r => ({ kind: 'arc', center: o, inner: r, outer: r + q.width, angle: a, halfAngle: q.halfAngle })), q.red)], aim: a, safeSeconds: min(move) }
  }
  if (move === 'illusion') {
    const q = m.illusion, s = q.spread
    // 자리 셋(가운데가 지금 자리) — 셋 모두 판 안에 들어오게 가운데를 한 번에 옮긴다 · 자리마다 장수를 본다
    const facings = [-s, 0, s].map(dx => facingTo({ ...from, x: from.x + dx }, target))
    const frames = [-s, 0, s].flatMap((dx, j) => [at(from.x + dx, from.y, M.illusion.prepare, facings[j]), at(from.x + dx, from.y, M.illusion.impact, facings[j]), at(from.x + dx, from.y, M.recover, facings[j])])
    // 자리 셋을 몸으로만 맞춘다 (셋이 판 폭을 거의 다 써서 꼬리까지 넣으면 막 2 부터 못 선다 · 꼬리 끝은 판 밖에 걸칠 수 있다)
    const fit = fitAll(g, e, frames, tick, false); if (!fit) return null
    const spots = [0, 1, 2].map(j => point(fit[j * 3]!.x, fit[j * 3]!.y)), variants: GumihoHit[][] = []
    // 자리마다 몸(꼬리 빼고) — 준비·타격 자세
    const bodies = [0, 1, 2].map(j => [fit[j * 3]!, fit[j * 3 + 1]!].flatMap(f => planParts(g, e, f, tick).filter(p => p.visible && !isTail(p.id)).map(p => p.collider)))
    for (let j = 0; j < 3; j++) {
      const tell = cone(spots[j]!, q.radius, aimFrom(spots[j]!, facings[j]!, target, q.aimLimit), q.halfAngle)
      // 환영(다른 두 자리)의 몸이 진짜의 붉은 바닥에 걸치지 않는다 (붉은 예고는 늘 몸 위에 · 진짜는 환영 위에 그린다)
      for (let i = 0; i < 3; i++) if (i !== j && bodies[i]!.some(c => near(tell, c) && overlaps(tell, c))) return null
      variants.push([one([tell], q.red)])
    }
    return { move, prepared: fit[3]!, impact: fit[4]!, relaxed: fit[5]!, hits: variants[1]!, aim: 0, safeSeconds: q.red, variants, prepares: [0, 1, 2].map(j => fit[j * 3]!), impacts: [0, 1, 2].map(j => fit[j * 3 + 1]!), relaxes: [0, 1, 2].map(j => fit[j * 3 + 2]!), spots, spotFacing: facings }
  }
  if (move === 'sweep') {
    const fit = still(M.sweep); if (!fit) return null
    const [prepared, impact, relaxed] = fit, o = point(impact.x, impact.y), q = m.sweep, a = Math.atan2(target.y - o.y, target.x - o.x)
    // 장수 쪽 반원을 60도씩 차례로 (등 쪽에서 앞쪽으로) · 꼬리가 부서진 차례는 없다 · 뒤쪽 반은 늘 빈다
    const hits = q.tails.map((i, k) => ({ i, k })).filter(({ i }) => alive(g, GUMIHO_TAILS[i]!)).map(({ i, k }) => Object.freeze({ shapes: frozen([cone(o, q.radius, a + (k - 1) * 2 * q.halfAngle * -facing, q.halfAngle)]), owners: Object.freeze([GUMIHO_TAILS[i]!]), red: k === 0 ? q.red : q.follow }))
    if (!hits.length) return null
    return { move, prepared, impact, relaxed, hits: hits.map((h, n) => n === 0 && h.red !== q.red ? Object.freeze({ ...h, red: q.red }) : h), aim: a, safeSeconds: min(move) }
  }
  if (move === 'leap') {
    const q = m.leap, prepared = fitGumihoFrame(g, e, at(from.x, from.y, M.leap.prepare), tick); if (!prepared) return null
    // 착지 발 자리는 판 아래 끝(체력 막대 자리)까지 내려가지 않는다
    const start = point(prepared.x, prepared.y), v = point(target.x - start.x, target.y - start.y), d = Math.hypot(v.x, v.y) || 1, leap = Math.min(q.reach, Math.max(q.min, d)), lx = start.x + v.x / d * leap, ly = Math.min(q.lowest, start.y + v.y / d * leap)
    const land = fitAll(g, e, [at(lx, ly, M.leap.impact), at(lx, ly, M.recover)], tick); if (!land) return null
    const [impact, relaxed] = land as [GumihoFrame, GumihoFrame], landing = point(impact.x, impact.y)
    const a = Math.hypot(landing.x - start.x, landing.y - start.y) > 1 ? Math.atan2(landing.y - start.y, landing.x - start.x) : gumihoAngle(facing, 0)
    return { move, prepared, impact, relaxed, hits: [one([{ kind: 'ellipse', center: landing, rx: q.rx, ry: q.ry, angle: a }], q.red)], aim: a, safeSeconds: q.red, landing }
  }
  // 아홉 꼬리 지연 찌르기: 자리 열(slots) 가운데 장수 쪽 자리에 꼬리 하나 · 빈 통로는 장수 쪽에서 lane 칸 (어느 쪽인지는 begin 의 난수)
  const fit = still(M.ninetail); if (!fit) return null
  const [prepared, impact, relaxed] = fit, o = point(impact.x, impact.y), q = m.ninetail, a = Math.atan2(target.y - o.y, target.x - o.x), step = TAU / q.slots
  const slotSets: number[][] = [], variants: GumihoHit[][] = []
  for (const side of [1, -1]) {
    const lane = side * q.lane, slots = Array.from({ length: q.slots }, (_, k) => k - Math.floor(q.slots / 2) + 1).filter(k => ((k - lane) % q.slots + q.slots) % q.slots !== 0).slice(0, GUMIHO_TAILS.length)
    const owners: GumihoHp[] = [], shapes: Shape[] = []
    slots.forEach((k, i) => { if (alive(g, GUMIHO_TAILS[i]!)) { owners.push(GUMIHO_TAILS[i]!); shapes.push(ray(o, a + k * step, q.from, q.length, q.width)) } })
    if (!shapes.length) return null
    slotSets.push(slots); variants.push([Object.freeze({ shapes: frozen(shapes), owners: Object.freeze(owners), red: q.red })])
  }
  return { move, prepared, impact, relaxed, hits: variants[0]!, aim: a, safeSeconds: min(move), variants, slotSets }
}
// ── 빠른 겹침 (결과는 giant-core overlaps 와 같다 · 확실히 떨어졌거나 확실히 닿은 것만 먼저 가른다) ──
type Leaf = Exclude<Shape, { kind: 'union' }>
const leavesOf = (s: Shape, out: Leaf[] = []): Leaf[] => { if (s.kind === 'union') for (const c of s.shapes) leavesOf(c, out); else out.push(s); return out }
/** 모양을 다 담는 원 */
function bound(s: Leaf): { x: number; y: number; r: number } {
  if (s.kind === 'line' || s.kind === 'capsule') { const r = s.kind === 'line' ? s.width / 2 : s.radius; return { x: (s.from.x + s.to.x) / 2, y: (s.from.y + s.to.y) / 2, r: Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) / 2 + r } }
  if (s.kind === 'box') return { x: s.center.x, y: s.center.y, r: Math.hypot(s.halfX, s.halfY) }
  if (s.kind === 'ellipse') return { x: s.center.x, y: s.center.y, r: Math.max(s.rx, s.ry) }
  return { x: s.center.x, y: s.center.y, r: s.kind === 'arc' || s.kind === 'annulus' ? s.outer : s.radius }
}
const SLACK = 1e-6
/** 두 모양의 담는 원이 닿는가 (아니면 확실히 떨어졌다) */
const near = (a: Leaf, b: Leaf) => { const p = bound(a), q = bound(b); return Math.hypot(p.x - q.x, p.y - q.y) <= p.r + q.r + SLACK }
/** 원판(c, r)과 모양이 닿는가 — 담는 원으로 확실히 먼 것 · 선과 원은 거리로 바로 · 나머지만 overlaps */
function diskHits(s: Leaf, c: Point, r: number, disk: Shape): boolean {
  const b = bound(s); if (Math.hypot(c.x - b.x, c.y - b.y) > r + b.r + SLACK) return false
  if (s.kind === 'line') { const vx = s.to.x - s.from.x, vy = s.to.y - s.from.y, l = vx * vx + vy * vy, k = l > 0 ? unit(((c.x - s.from.x) * vx + (c.y - s.from.y) * vy) / l) : 0, d = Math.hypot(c.x - s.from.x - vx * k, c.y - s.from.y - vy * k); if (d < s.width / 2 + r - SLACK) return true; if (d > s.width / 2 + r + SLACK) return false }
  if (s.kind === 'circle') { const d = Math.hypot(c.x - s.center.x, c.y - s.center.y); if (d < s.radius + r - SLACK) return true; if (d > s.radius + r + SLACK) return false }
  if (s.kind === 'cone' || s.kind === 'arc') {
    // 부채·호: 가운데가 안이면 확실히 닿고 · 반지름 띠 밖이거나 각 밖으로 원판 폭(asin r/d)보다 멀면 확실히 떨어졌다
    const d = Math.hypot(c.x - s.center.x, c.y - s.center.y), inner = s.kind === 'arc' ? s.inner : 0, outer = s.kind === 'arc' ? s.outer : s.radius, off = Math.abs(wrap(Math.atan2(c.y - s.center.y, c.x - s.center.x) - s.angle))
    if (d > outer + r + SLACK || d < inner - r - SLACK) return false
    if (d >= inner + SLACK && d <= outer - SLACK && off <= s.halfAngle - SLACK) return true
    if (d > r + SLACK && off > s.halfAngle + Math.asin(Math.min(1, r / d)) + SLACK) return false
  }
  if (s.kind === 'box') {
    const dx = c.x - s.center.x, dy = c.y - s.center.y, co = Math.cos(s.angle), si = Math.sin(s.angle), u = dx * co + dy * si, v = -dx * si + dy * co
    const d = Math.hypot(Math.max(0, Math.abs(u) - s.halfX), Math.max(0, Math.abs(v) - s.halfY))
    if (d < r - SLACK) return true; if (d > r + SLACK) return false
  }
  return overlaps(s, disk)
}
/** imugi.safeLanding 과 같은 물음(닿을 수 있는 3P 빈 원이 있는가 · 같은 격자 · 같은 겹침)을 빨리 — 있으면 true */
function hasSafeLanding(shapes: readonly Shape[], env: readonly Shape[], player: Point, speed: number, seconds: number): boolean {
  const radius = G.playerDiameter * G.safeDiameters / 2, reach = speed * seconds, all = [...shapes, ...env].flatMap(s => leavesOf(s)), spots: Point[] = []
  for (let y = radius; y <= H - radius; y += G.safeGrid) for (let x = radius; x <= W - radius; x += G.safeGrid) if (Math.hypot(x - player.x, y - player.y) <= reach) spots.push(point(x, y))
  spots.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y) || a.y - b.y || a.x - b.x)
  return spots.some(p => { const disk: Shape = { kind: 'circle', center: p, radius }; return all.every(s => !diskHits(s, p, radius, disk)) })
}
/** 이 수를 지금 안전하게 쓸 수 있는가 — 갈래가 있으면 어느 갈래여도 피할 길이 있어야 한다 */
function feasible(g: GumihoState, plan: GumihoPlan, player: Point, speed: number): boolean {
  const union = (hits: readonly GumihoHit[]) => hits.flatMap(h => h.shapes)
  return (plan.variants ?? [plan.hits]).every(v => hasSafeLanding(union(v), g.environment.shapes, player, speed, plan.safeSeconds))
}
/** 후보에서 난수 하나로 고르고, 그 수를 실제로 세워 본다(몸이 판에 들어가고 피할 길이 있는가) — 안 되면 후보 차례로 다음 수 (빈 후보는 난수를 쓰지 않는다) */
export function chooseGumihoPlan(g: GumihoState, e: GiantOwner, target: Point, speed: number, tick: number, random: () => number): GumihoPlan | null {
  const moves = gumihoCandidates(g, e, target); if (!moves.length) return null
  const first = Math.min(moves.length - 1, Math.floor(random() * moves.length))
  for (let k = 0; k < moves.length; k++) { const p = planGumiho(g, e, target, moves[(first + k) % moves.length]!, tick); if (p && feasible(g, p, target, speed)) return p }
  return null
}
const liveShapes = (g: GumihoState, hit: GumihoHit | undefined): readonly Shape[] => Object.freeze(hit ? hit.shapes.filter((_, i) => { const o = hit.owners[i]; return !o || alive(g, o) }) : [])
/**
 * 수를 세운다 — 버팀(유지) 박자는 여기서 seeded 로 미리 고른다: 도약은 웅크려 0~holdMax 초 · 지연 찌르기는 꼬리를 펼쳐 0~holdMax 초 ·
 * 나머지는 두 번째 쓰임부터 공통 계약대로 표 시간 또는 +repeatHold. 환영은 진짜 자리 · 지연 찌르기는 빈 통로 쪽도 고른다. 붉은빛 뒤엔 바꾸지 않는다.
 */
export function beginGumihoPlan(g: GumihoState, e: GiantOwner, plan: GumihoPlan, tick: number, random: () => number): void {
  const m = F.moves[plan.move], use = (g.windupUses[plan.move] ?? 0) + 1
  const hold = plan.move === 'leap' ? random() * F.moves.leap.holdMax : plan.move === 'ninetail' ? random() * F.moves.ninetail.holdMax : use > 1 && random() < .5 ? G.windup.repeatHold : 0
  const w = gumihoWindup(g, plan.move, hold)
  let { hits, impact, relaxed } = plan, blink: GumihoFrame | null = null, real: number | undefined, lane: number | undefined
  if (plan.move === 'illusion' && plan.variants && plan.impacts && plan.relaxes && plan.prepares) { real = Math.min(2, Math.floor(random() * 3)); hits = plan.variants[real]!; impact = plan.impacts[real]!; relaxed = plan.relaxes[real]!; blink = plan.prepares[real]! }
  if (plan.move === 'ninetail' && plan.variants) { lane = random() < .5 ? 0 : 1; hits = plan.variants[lane]! }
  g.windupUses[plan.move] = w.use; g.last = plan.move; g.pattern = plan.move; g.seq++; g.state = 'body'; g.timer = w.body
  g.motion = { ...g.motion, move: plan.move, from: g.motion.current, prepared: plan.prepared, impact, relaxed, recoverFrom: impact, recoverSeconds: m.recover, progress: 0, blocked: false, glideTo: null, blink }
  g.attack = { windup: w, seq: g.seq, move: plan.move, requires: REQUIRES[plan.move], hits, step: 0, shapes: liveShapes(g, hits[0]), pending: false, hit: false, damage: m.damage, recover: m.recover, strike: m.strike, impactAt: m.impactAt, aim: plan.aim,
    ...(plan.spots ? { spots: plan.spots, spotFacing: plan.spotFacing!, real: real! } : {}), ...(plan.landing ? { landing: plan.landing } : {}), ...(lane !== undefined ? { lane, slots: plan.slotSets![lane]! } : {}) }
  updateGumihoPose(g, e, tick)
}
/** 시험·검수용: 이 수를 지금 세운다 (안전하지 않으면 false · 판은 그대로 쉬는 자세로) */
export function beginGumihoMove(g: GumihoState, e: GiantOwner, target: Point, move: GumihoMove, tick: number, speed: number = C.speed, random: () => number = () => 0): boolean {
  const plan = planGumiho(g, e, target, move, tick)
  if (!plan || !feasible(g, plan, target, speed)) { g.motion = { ...g.motion, blocked: true }; recover(g, F.idleRecovery); return false }
  beginGumihoPlan(g, e, plan, tick, random); return true
}
/** 회복(머리 노출) — 타격 뒤에는 미리 판 안으로 맞춘 회복 자세로 */
function recover(g: GumihoState, seconds: number, relaxed?: GumihoFrame) {
  const c = g.motion.current
  g.motion = { ...g.motion, move: null, recoverFrom: c, relaxed: relaxed ?? frameOf(c.x, c.y, c.facing, M.recover), recoverSeconds: seconds, glideTo: null, blink: null }
  g.state = 'recover'; g.timer = seconds; g.attack = null; g.recoveryHitUsed = false
}
/** 회복 중 첫 타격 — 움찔하고 회복이 조금 늘어난다 (한 번만) */
export function staggerGumiho(g: GumihoState): void {
  if (g.state !== 'recover') return
  g.stagger = F.staggerSeconds; g.timer = Math.min(g.motion.recoverSeconds + F.staggerRecover, g.timer + F.staggerRecover)
}
/** 부위가 처음 0 이 됐다 — 그 부위가 필요한 예약 수는 취소 · 꼬리는 그 꼬리의 모양만 지운다 (부서진 순간을 적어 그림이 터뜨린다) */
export function breakGumihoPart(g: GumihoState, id: GumihoPartId): boolean {
  const key = gumihoHpOf(id)
  if (!key || g.partHP[key] > 0 || g.brokenSeen.includes(key)) return false
  g.brokenSeen.push(key); g.brokenAt[key] = g.age; g.stagger = F.staggerSeconds
  const a = g.attack
  if (a && g.state !== 'strike') {
    a.shapes = liveShapes(g, a.hits[a.step])
    if (a.requires.includes(key) || !a.hits.slice(a.step).some(h => liveShapes(g, h).length)) recover(g, F.idleRecovery)
  } else if (a) a.shapes = liveShapes(g, a.hits[a.step])
  return true
}
export function endGumiho(g: GumihoState, e: GiantOwner, tick: number): void { g.state = 'dead'; g.attack = null; g.environment.active = false; updateGumihoPose(g, e, tick) }
function startGlide(g: GumihoState, e: GiantOwner, player: Point, tick: number): boolean {
  const f = g.motion.current, dir = player.x < f.x ? -1 : 1, home = Math.abs(f.y - F.homeY) > F.homeBand * F.homePull
  const want = point(home ? f.x + dir * F.glideNear / 2 : player.x - dir * F.glideNear, Math.max(F.homeY - F.homeBand, Math.min(F.homeY + F.homeBand, home ? F.homeY : player.y)))
  const to = fitGumihoFrame(g, e, restAt(want.x, want.y, f.facing), tick)
  if (!to || Math.hypot(to.x - f.x, to.y - f.y) < F.glideMin) return false
  g.state = 'glide'; g.timer = F.glideSeconds; g.attack = null; g.motion = { ...g.motion, move: null, glideTo: point(to.x, to.y), from: f }
  return true
}
function decide(g: GumihoState, e: GiantOwner, input: GumihoStep) {
  const plan = chooseGumihoPlan(g, e, input.player, input.speed, input.tick, input.random), f = g.motion.current, away = Math.abs(f.y - F.homeY) > F.homeBand * F.homePull
  // 제 자리에서 멀면(도약 뒤) 둘레를 치는 수는 그 자리에서 · 도약·곡풍은 먼저 제자리로
  if (plan && (!away || plan.move !== 'leap' && plan.move !== 'gale')) { beginGumihoPlan(g, e, plan, input.tick, input.random); return }
  if (g.state !== 'glide' && startGlide(g, e, input.player, input.tick)) return
  if (plan) { beginGumihoPlan(g, e, plan, input.tick, input.random); return }
  recover(g, F.idleRecovery)
}
export interface GumihoStep { dt: number; tick: number; player: Point; speed: number; dazed: boolean; random: () => number }
/** 땅을 울리는 순간 (등장 부채 펼침 · 변신 꼬리 · 도약 착지 · 아홉 꼬리 찌르기) — 화면이 멈칫·흔들린다 */
function quaked(g: GumihoState, was: number, entryWas: number, formWas: number): boolean {
  if (g.state === 'entry') return entryWas < M.entry.open && 1 - g.timer / F.entrySeconds >= M.entry.open
  if (g.state === 'roar' && g.phase === 2) return formWas < M.transform.tails && 1 - g.timer / F.transformSeconds >= M.transform.tails
  const a = g.attack
  return !!a && g.state === 'strike' && (a.move === 'leap' || a.move === 'ninetail') && was < a.impactAt && g.motion.progress >= a.impactAt
}
/** 준비만 — 장수의 공격이 이 뒤에 들어오고 commitGumiho 가 다치기 전에 다시 잰다 */
export function stepGumiho(g: GumihoState, e: GiantOwner, input: GumihoStep): 'roar' | 'recovery' | 'quake' | null {
  if (e.hp <= 0 || g.state === 'dead') { endGumiho(g, e, input.tick); return null }
  const was = g.state === 'strike' ? g.motion.progress : -1, entryWas = g.state === 'entry' ? 1 - g.timer / F.entrySeconds : 2, formWas = g.state === 'roar' && g.phase === 2 ? 1 - g.timer / F.transformSeconds : 2
  g.age += input.dt; g.enraged = g.age >= G.enrageAfter; g.stagger = Math.max(0, g.stagger - input.dt)
  if (g.state !== 'entry') { g.environment.age += input.dt; g.environment.active = g.environment.age >= G.environmentTell }
  if (input.dazed) { updateGumihoPose(g, e, input.tick); return null }
  const waiting = g.state === 'body' || g.state === 'hold' || g.state === 'tell', remaining = g.timer - input.dt
  g.timer = Math.max(0, remaining)
  if (g.state === 'glide') glide(g, input.dt)
  let cue: 'roar' | 'recovery' | null = null
  if (waiting && remaining <= G.windup.epsilon && g.attack) {
    let carry = Math.max(0, -remaining)
    for (let n = 0; n < 3; n++) {
      const a = g.attack, w = a.windup
      if (g.state === 'body' && w.hold > 0) { g.state = 'hold'; g.timer = w.hold - carry }
      else if (g.state === 'body' || g.state === 'hold') { g.state = 'tell'; g.timer = (a.hits[a.step]?.red ?? w.red) - carry }
      else { g.state = 'strike'; g.timer = a.strike - carry; a.pending = true; g.motion.progress = 0; break }
      if (g.timer > G.windup.epsilon) break
      carry = Math.max(0, -g.timer)
    }
    g.timer = Math.max(0, g.timer)
  } else if (g.timer === 0) {
    if (g.state === 'strike' && g.attack) {
      // 다음 차례(세 꼬리 순차쓸기)는 그 꼬리가 다시 들리며 붉은 예고부터 · 꼬리가 부서진 차례는 건너뛴다
      const a = g.attack
      let next = a.step + 1
      while (next < a.hits.length && !liveShapes(g, a.hits[next]).length) next++
      if (next < a.hits.length) { a.step = next; a.shapes = liveShapes(g, a.hits[next]); a.pending = false; a.hit = false; g.state = 'tell'; g.timer = a.hits[next]!.red; g.motion.progress = 0 }
      else { g.motion.current = { ...g.motion.impact, raise: g.pose.frame.raise, reach: g.pose.frame.reach }; recover(g, a.recover, g.motion.relaxed); cue = 'recovery' }
    } else if (g.state === 'entry' || g.state === 'recover' || g.state === 'roar' || g.state === 'glide') {
      const desired = e.hp / e.max <= G.phaseCuts[1] ? 3 : e.hp / e.max <= G.phaseCuts[0] ? 2 : 1
      if (g.phase < desired) { g.phase = (g.phase + 1) as 2 | 3; g.state = 'roar'; g.timer = g.phase === 2 ? F.transformSeconds : F.roarSeconds; g.environment = environment(g.phase); g.motion = { ...g.motion, from: g.motion.current, move: null, glideTo: null, blink: null }; cue = 'roar' }
      else decide(g, e, input)
    }
  }
  updateGumihoPose(g, e, input.tick)
  return cue ?? (quaked(g, was, entryWas, formWas) ? 'quake' : null)
}
function glide(g: GumihoState, dt: number) {
  const to = g.motion.glideTo, f = g.motion.current
  if (!to) { g.timer = 0; return }
  const dx = to.x - f.x, dy = to.y - f.y, d = Math.hypot(dx, dy), step = Math.min(d, F.glideSpeed * dt)
  if (d < 1e-6) { g.timer = 0; return }
  const facing: 1 | -1 = Math.abs(dx) > F.turnDeadZone ? (dx < 0 ? -1 : 1) : f.facing
  g.motion.current = { ...f, x: f.x + dx / d * step, y: f.y + dy / d * step, facing }
  g.motion.walk += step
  if (step >= d) g.timer = 0
}
/** 꼬리 하나를 판 각 world 쪽으로 — 쉬는 각에 더할 몫 (앞 +x 기준 · 가까운 쪽으로 돈다) */
const toward = (f: GumihoFrame, i: number, world: number) => wrap((f.facing === 1 ? world : Math.PI - world) - lerp(R.tails.rest[i]!, R.tails.spread[i]!, f.spread))
function chosenFrame(g: GumihoState): GumihoFrame {
  const m = g.motion, a = g.attack
  if (g.state === 'entry') {
    // 여우불이 모인 뒤 숲에서 걸어 나와(위에서 내려오며 또렷해진다) 부채를 편다
    const k = 1 - g.timer / F.entrySeconds, E = M.entry, walk = unit((k - E.gather) / (E.step - E.gather)), fan = unit((k - E.open) / ((1 - E.open) / 2))
    const f = fan > 0 ? blend(m.from, frameOf(m.from.x, m.from.y, m.from.facing, M.fanOpen), fan) : m.from
    return { ...f, y: f.y - E.rise * (1 - smooth(walk)), fade: unit(walk * 1.6) }
  }
  if (g.state === 'body' && a) {
    const p = 1 - g.timer / (a.windup.body || 1)
    if (a.move === 'illusion' && m.blink) {
      // 몸을 낮추다 blinkAt 에 여우불 속으로 사라져 진짜 자리에서 나타난다 (환영 둘도 이때 나타난다)
      const q = F.moves.illusion, fade = unit(Math.abs(p - q.blinkAt) / q.blinkFade)
      return p < q.blinkAt ? { ...blend(m.from, m.prepared, p / q.blinkAt), fade } : { ...m.blink, fade }
    }
    return blend(m.from, m.prepared, p)
  }
  if (g.state === 'hold' && a) {
    const base = m.blink ?? m.prepared
    if (a.move !== 'leap') return base
    const t = a.windup.hold - g.timer
    return { ...base, crouch: base.crouch + Math.sin(t * TAU * F.moves.leap.wiggleHz) * F.moves.leap.wiggle }
  }
  if (g.state === 'tell') return m.blink ?? m.prepared
  if (g.state === 'strike' && a) {
    const p = unit(1 - g.timer / a.strike), k = p / Math.max(a.impactAt, 1e-6); m.progress = p
    if (a.move === 'leap') {
      // 공중에선 팔을 젖힌 자세 · 착지(impactAt)에 베기 자세 · 높이는 반원
      const air = frameOf(m.prepared.x, m.prepared.y, m.impact.facing, M.leap.air), f = k < 1 ? blend(m.prepared, air, k * 2) : blend(air, m.impact, (k - 1) * 4)
      return { ...f, x: lerp(m.prepared.x, m.impact.x, unit(k)), y: lerp(m.prepared.y, m.impact.y, unit(k)), lift: F.moves.leap.hop * Math.sin(Math.PI * unit(k)) }
    }
    return blend(m.blink ?? m.prepared, m.impact, k)
  }
  if (g.state === 'recover') return blend(m.recoverFrom, m.relaxed, 1 - g.timer / Math.max(1e-6, m.recoverSeconds))
  if (g.state === 'roar') {
    // 막 2 변신: 웃음 자세로 꼬리를 활짝 펼친다 (반여우·꼬리는 formOf) · 막 3: 짧게 웃으며 꼬리를 편다
    const total = g.phase === 2 ? F.transformSeconds : F.roarSeconds, k = 1 - g.timer / total, laugh = frameOf(m.from.x, m.from.y, m.from.facing, M.laugh)
    return g.phase === 2 ? blend(m.from, laugh, k / M.transform.laugh) : blend(m.from, laugh, Math.sin(Math.PI * k) * 2)
  }
  if (g.state === 'glide') {
    const c = m.current, G2 = M.glide
    return { ...restAt(c.x, c.y, c.facing), lean: G2.lean, lift: Math.abs(Math.sin(m.walk / F.glideSpeed * Math.PI * G2.hz)) * G2.bob }
  }
  return m.current
}
/** 숨·꼬리 흔들림·움찔 · 순차쓸기와 지연 찌르기의 꼬리 — 판 시각(age)만 쓴다 */
function lively(g: GumihoState, f: GumihoFrame): GumihoFrame {
  const form = formOf(g)
  if (g.state === 'dead') return { ...f, fox: form.fox, tails: form.tails }
  const b = M.breath, t = g.age, s = g.stagger > 0 ? Math.sin(Math.PI * g.stagger / F.staggerSeconds) : 0, a = g.attack
  const tremble = a?.move === 'ninetail' && (g.state === 'hold' || g.state === 'tell') ? 3 : 1
  const raise = GUMIHO_TAILS.map((_, i) => (f.raise[i] ?? 0) + Math.sin(t * TAU * b.tailHz + i * b.tailPhase) * b.tail * tremble), reach = [...f.reach]
  if (a?.move === 'sweep') {
    // 지금 차례의 꼬리가 들리고(첫 차례는 몸 예고부터 · 다음 차례는 붉은 예고 동안) · 타격에 그 부채를 훑는다 · 앞 차례 꼬리는 제자리로 돌아간다
    const q = F.moves.sweep, dir = -f.facing, tailOf = (h: GumihoHit | undefined) => h?.owners[0] ? GUMIHO_TAILS.indexOf(h.owners[0] as GumihoTailId) : -1
    const hit = a.hits[a.step], i = tailOf(hit), sh = hit?.shapes[0], first = a.step === 0
    if (i >= 0 && sh?.kind === 'cone') {
      if (g.state === 'strike') { const p = smooth(g.motion.progress / Math.max(a.impactAt, 1e-6)); raise[i] = toward(f, i, sh.angle - dir * q.halfAngle + dir * 2 * q.halfAngle * p); reach[i] = M.sweep.reach }
      else {
        const tell = g.state === 'tell' ? 1 - g.timer / Math.max(1e-6, hit!.red) : 0, u = first ? (g.state === 'body' ? (1 - g.timer / (a.windup.body || 1)) / 2 : g.state === 'hold' ? .5 : .5 + tell / 2) : tell
        raise[i] = lerp(raise[i]!, toward(f, i, -Math.PI / 2) * M.sweep.raise, smooth(u))
      }
    }
    const prev = a.hits[a.step - 1], j = tailOf(prev), ps = prev?.shapes[0]
    if (g.state === 'tell' && j >= 0 && ps?.kind === 'cone') { const back = 1 - smooth((1 - g.timer / Math.max(1e-6, hit?.red ?? 1)) * 3); raise[j] = lerp(raise[j]!, toward(f, j, ps.angle + dir * q.halfAngle), back); reach[j] = lerp(1, M.sweep.reach, back) }
  }
  if (a?.move === 'ninetail' && a.slots && g.state === 'strike') {
    // 펼친 꼬리가 제 선 쪽으로 틀며(turn 몫만) 사방을 찌른다 — 빛줄기가 선 끝까지 간다
    const p = smooth(g.motion.progress / Math.max(a.impactAt, 1e-6)), step = TAU / F.moves.ninetail.slots
    a.slots.forEach((k, i) => { raise[i] = lerp(raise[i]!, toward(f, i, a.aim + k * step), p * M.ninetail.turn); reach[i] = lerp(1, M.ninetail.reach, p) })
  }
  return { ...f, crouch: unit(f.crouch + Math.sin(t * TAU * b.hz) * b.crouch + s * M.stagger.crouch), lean: f.lean + s * M.stagger.lean, raise, reach, fox: form.fox, tails: form.tails }
}
export function updateGumihoPose(g: GumihoState, e: GiantOwner, tick: number): void {
  const chosen = chosenFrame(g)
  g.motion.current = { ...chosen, lift: 0, turn: 0, fade: g.state === 'entry' ? chosen.fade : 1 }
  const f = lively(g, chosen)
  e.x = f.x; e.y = f.y
  const pose = poseOf(g, e, f, tick), a = g.attack
  g.pose = Object.freeze({ ...pose, worldGeometry: Object.freeze({ ...pose.worldGeometry, tell: (g.state === 'tell' || g.state === 'strike') && a ? a.shapes : Object.freeze([]) }) })
  g.bounds = gumihoCollisionBounds(pose)
}
/** 장수 맞음 판정 — 타격 순간 한 번(차례마다) · 부위가 부서졌으면 그 모양은 없던 일 · 환경은 박자마다 */
export function commitGumiho(g: GumihoState, e: GiantOwner, player: Point, hurt: (damage: number) => void, dazed: boolean): void {
  if (e.hp <= 0 || g.state === 'dead') { g.attack = null; g.environment.active = false; return }
  if (dazed) return
  const a = g.attack, at: Shape = { kind: 'circle', center: point(player.x, player.y), radius: 0 }
  if (g.state === 'strike' && a && a.pending && !a.hit && a.seq === g.seq && g.motion.progress >= a.impactAt) {
    a.pending = false
    if (a.requires.every(id => alive(g, id)) && liveShapes(g, a.hits[a.step]).some(s => overlaps(s, at))) { a.hit = true; hurt(a.damage * (g.enraged ? G.enrageDamage : 1)) }
  }
  if (g.environment.active && g.environment.age >= g.environment.nextHit && g.environment.shapes.some(s => overlaps(s, at))) {
    g.environment.nextHit = g.environment.age + G.environmentEvery; hurt(G.environmentDamage * (g.enraged ? G.enrageDamage : 1))
  }
}
/** 부서지지 않은(또는 늘 맞는 옷자락·몸통·머리) 부위만 맞는다 */
export function gumihoLiveParts(g: GumihoState): readonly PartPose<GumihoPartId>[] {
  return g.pose.parts.filter(p => { const key = gumihoHpOf(p.id); return key === null || key === 'head' || g.partHP[key] > 0 })
}
/** 맞은 자리가 겹친 꼬리 여럿 안이면 뼈(가운데 줄)가 가장 가까운 꼬리가 맞는다 — 부채처럼 겹친 꼬리가 차례(이름)대로만 끊기지 않게 */
function nearestTail(live: readonly PartPose<GumihoPartId>[], at: Point): GumihoPartId | null {
  let best: GumihoPartId | null = null, bd = Infinity
  for (const p of live) {
    const c = p.collider
    if (!isTail(p.id) || !p.targetable || p.broken || c.kind !== 'capsule') continue
    const v = point(c.to.x - c.from.x, c.to.y - c.from.y), l = v.x * v.x + v.y * v.y, k = l > 0 ? unit(((at.x - c.from.x) * v.x + (at.y - c.from.y) * v.y) / l) : 0, d = Math.hypot(at.x - c.from.x - v.x * k, at.y - c.from.y - v.y * k)
    if (d <= c.radius && d < bd) { bd = d; best = p.id }
  }
  return best
}
export function gumihoContact(g: GumihoState, shape: Shape): Contact<GumihoPartId> | null {
  const live = gumihoLiveParts(g), hit = pickContact({ ...g.pose, parts: live }, shape, gumihoRank)
  if (!hit || !isTail(hit.partId) || hit.distance > 1e-6) return hit
  const best = nearestTail(live, hit.point)
  return !best || best === hit.partId ? hit : pickContact({ ...g.pose, parts: live.filter(p => p.id === best) }, shape, gumihoRank) ?? hit
}
export const gumihoSweep = (g: GumihoState, from: Point, to: Point, radius: number): Contact<GumihoPartId> | null => sweepContact({ ...g.pose, parts: gumihoLiveParts(g) }, from, to, radius, gumihoRank)
/** 맞은 부위의 체력을 깎는다 · 처음 부서지면 true */
export function damageGumihoPart(g: GumihoState, id: GumihoPartId, amount: number): boolean {
  const key = gumihoHpOf(id)
  if (key) g.partHP[key] = Math.max(0, g.partHP[key] - amount)
  g.lastHitPart = id
  return breakGumihoPart(g, id)
}
/** 부서진 부위가 아직 자세에 반영되지 않았다 */
export const gumihoPoseStale = (g: GumihoState) => g.pose.parts.some(p => { const key = gumihoHpOf(p.id); return key !== null && p.damaged !== (g.partHP[key] <= 0) })
