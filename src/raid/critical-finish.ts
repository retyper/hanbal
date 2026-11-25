import type { Effect, Missile, MobKind } from './haebi.ts'
export interface FinishTuning { readonly life: number; readonly hold: number; readonly holdScale: number; readonly fadeAt: number; readonly starAt: number; readonly distance: number; readonly lift: number; readonly endScale: number; readonly spin: number; readonly trailAlpha: number; readonly trailOffsets: readonly number[]; readonly maxBodies: number; readonly lowMaxBodies: number
  /** 큰 마무리 (얼었다가 펑) — 없으면 큰 마무리 없이 예전 그대로 */
  readonly bigHold?: number; readonly holdScaleBig?: number; readonly dim?: number; readonly dimColor?: string; readonly flash?: number; readonly flashPart?: number; readonly popLife?: number; readonly popRingFrom?: number; readonly popRingTo?: number; readonly popRingWidth?: number; readonly popRingColor?: string; readonly popDots?: number; readonly popDotDistance?: number; readonly popDotSize?: number
  readonly holdRise?: number; readonly bigRise?: number; readonly bigZoom?: number; readonly zoomIn?: number; readonly zoomOut?: number; readonly bigTrail?: readonly number[]; readonly bigTrailAlpha?: number }
export interface FinishEvent { readonly origin: 'primary'; readonly x: number; readonly y: number; readonly mob: MobKind; readonly face: number; readonly direction: 1 | -1 }
export interface FinishPose { readonly x: number; readonly y: number; readonly rotation: number; readonly scale: number; readonly alpha: number; readonly star?: number }
// One canonical module instance shared by engine and renderer. Nothing is attached to serialized objects.
const primaryShots = new WeakMap<Missile, 1 | -1>(), deaths = new WeakMap<Effect, FinishEvent>()
export function tagPrimaryShot(shot: Missile | undefined) { if (shot) primaryShots.set(shot, shot.vx < 0 ? -1 : 1) }
export const primaryShotDirection = (shot: Missile) => primaryShots.get(shot)
export function tagCriticalFinish(f: Effect, direction: number) {
  if (f.kind !== 'death' || !f.crit || !f.mob || f.mob === 'boss' || f.mob === 'elite' || !Number.isFinite(direction)) return
  deaths.set(f, Object.freeze({ origin: 'primary', x: f.x, y: f.y + 20, mob: f.mob, face: f.face ?? 1, direction: direction < 0 ? -1 : 1 }))
}
export const criticalFinishEvent = (f: Effect) => deaths.get(f)
/** Active presentation seconds supplied by RaidFeel; no RNG, timers, DOM, simulation writes, or asset work. */
const smooth = (x: number) => { const q = Math.max(0, Math.min(1, x)); return q * q * (3 - 2 * q) }
export function criticalFinishPoses(e: FinishEvent, elapsed: number, p: FinishTuning, low = false): readonly FinishPose[] {
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= p.life || p.life <= p.hold) return []
  // 「둑」 멈춤 동안은 맞은 자리에서 부푼다 · 「팡」 뒤엔 빨리 떠서 느려지며(ease-out) 멀리 · 높이 · 작아지고 · fadeAt 뒤 옅어지며 별이 반짝
  const start = p.holdRise ? p.holdScale : 1   // 큰 마무리는 부푼 채로 떠난다
  const pose = (age: number, alpha: number): FinishPose => {
    if (age < p.hold) return { x: e.x, y: e.y, rotation: 0, scale: p.holdRise ? 1 + (p.holdScale - 1) * smooth(age / (p.hold * p.holdRise)) : 1 + (p.holdScale - 1) * Math.sin(Math.PI * age / p.hold), alpha }
    const q = Math.max(0, Math.min(1, (age - p.hold) / (p.life - p.hold))), ease = 1 - (1 - q) ** 3
    const fade = q < p.fadeAt ? 1 : Math.max(0, (1 - q) / (1 - p.fadeAt))
    return { x: e.x + e.direction * p.distance * ease, y: e.y - p.lift * Math.sin(Math.min(1, q * 1.25) * Math.PI * .5) * (1 - q * .35), rotation: e.direction * p.spin * q, scale: start - (start - p.endScale) * ease, alpha: alpha * fade, star: q > p.starAt ? (q - p.starAt) / (1 - p.starAt) : 0 }
  }
  const trails = low ? [] : p.trailOffsets.map((delay, i) => ({ delay, alpha: p.trailAlpha * (1 - i / (p.trailOffsets.length + 1)) })).filter(t => elapsed - t.delay > p.hold).map(t => pose(elapsed - t.delay, t.alpha))   // 낱낱 잔상 · 뒤로 갈수록 옅게
  return [...trails, pose(elapsed, 1)]
}
interface Flight { readonly effect: Effect; readonly event: FinishEvent; readonly bornAt: number; readonly big: boolean }
interface ViewState { readonly seen: WeakSet<Effect>; readonly handled: WeakSet<Effect>; flights: Flight[]; time: number }
const views = new WeakMap<object, ViewState>()
/** 큰 마무리의 자세 값 — 멈춤이 bigHold 로 길고 더 크게 부푼다 (날아가는 길이는 그대로 · 한 번만 만든다) */
const bigTunes = new WeakMap<FinishTuning, FinishTuning>()
const bigTune = (p: FinishTuning): FinishTuning => { let b = bigTunes.get(p); if (!b) { b = { ...p, hold: p.bigHold ?? p.hold, holdScale: p.holdScaleBig ?? p.holdScale, life: p.life - p.hold + (p.bigHold ?? p.hold), ...(p.bigRise !== undefined ? { holdRise: p.bigRise } : {}), trailOffsets: p.bigTrail ?? p.trailOffsets, trailAlpha: p.bigTrailAlpha ?? p.trailAlpha }; bigTunes.set(p, b) } return b }
/** isBig: 이 마무리가 큰 마무리인가 (RaidFeel 이 정한다 · 판은 안 건드린다) */
export function criticalFinishFrames(run: object, fx: readonly Effect[], time: number, playing: boolean, low: boolean, p: FinishTuning, isBig?: (f: Effect) => boolean) {
  if (!Number.isFinite(time)) { views.delete(run); return [] }
  let v = views.get(run)
  // Terminal/ending drops moving copies, but a consumed corpse must stay suppressed.
  // Do not compare the ending clock with active view time or reset handled/seen here.
  if (!playing) { if (v) v.flights = []; return [] }
  if (!v || time < v.time) { v = { seen: new WeakSet(), handled: new WeakSet(), flights: [], time }; views.set(run, v) }
  v.time = time; v.flights = v.flights.filter(f => time - f.bornAt < (f.big ? bigTune(p).life : p.life))
  const cap = Math.max(0, Math.floor(low ? p.lowMaxBodies : p.maxBodies))
  for (const effect of fx) if (!v.seen.has(effect)) {
    v.seen.add(effect); const event = criticalFinishEvent(effect)
    if (event && v.flights.length < cap) { v.flights.push({ effect, event, bornAt: time, big: !!isBig?.(effect) && p.bigHold !== undefined }); v.handled.add(effect) }
  }
  // Retain copied cosmetics after the simulator removes the short-lived FX. Low mode draws one body, no trails.
  return v.flights.slice(-cap || v.flights.length).map(f => { const tune = f.big ? bigTune(p) : p, age = time - f.bornAt; return { event: f.event, poses: criticalFinishPoses(f.event, age, tune, low), big: f.big, age, hold: tune.hold } })
}
export const criticalFinishHandled = (run: object, f: Effect) => views.get(run)?.handled.has(f) ?? false
/**
 * 큰 마무리의 얼어 있는 순간 · 풀리는 순간 그림 — 화면 전체를 한 겹 어둡게(맞은 놈 아래) · 맞은 놈을 하얗게 번쩍 · 풀리면 하얀 테와 낱낱 알갱이.
 * view = 지금 화면(판 좌표) · 판을 읽기만 한다 · filter·그라디언트 없음 · 글자 없음
 */
export interface FinishLook { readonly hero?: (() => void) | undefined; readonly view: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }; readonly p: FinishTuning }
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
export function drawCriticalFinishFrames(ctx: CanvasRenderingContext2D, frames: ReturnType<typeof criticalFinishFrames>, drawMob: (mob: MobKind, face: number, white?: boolean) => void, star?: { readonly size: number; readonly color: string }, look?: FinishLook) {
  const p = look?.p
  // 얼어 있는 동안: 나머지를 가라앉힌다 (한 번만 · 맞은 놈보다 먼저)
  if (look && p?.dim !== undefined) {
    const frozen = frames.some(f => f.big && f.age < f.hold)
    if (frozen) { const v = look.view; ctx.save(); ctx.globalAlpha = p.dim; ctx.fillStyle = p.dimColor ?? '#000'; ctx.fillRect(v.left, v.top, v.right - v.left, v.bottom - v.top); ctx.restore(); look.hero?.() }   // 때린 장수도 밝게 남긴다
  }
  for (const { event, poses, big, age, hold } of frames) for (const pose of poses) {
    ctx.save(); ctx.translate(pose.x, pose.y); ctx.rotate(pose.rotation); ctx.scale(pose.scale, pose.scale); ctx.globalAlpha *= pose.alpha
    drawMob(event.mob, event.face)
    // 하얗게 번쩍 — 같은 몸을 한 번 더 밝게 겹친다 (얼기 시작할 때 가장 세고 flashPart 몫이 지나면 꺼진다)
    if (big && p?.flash !== undefined && age < hold * (p.flashPart ?? .5) && pose === poses.at(-1)) { ctx.globalAlpha *= p.flash * (1 - age / (hold * (p.flashPart ?? .5))); drawMob(event.mob, event.face, true) }   // 몸 전체를 하얗게
    ctx.restore()
  }
  // 풀리는 순간 「펑」: 하얀 테 하나 + 낱낱 알갱이 (햇살·붉은 원 아님)
  if (look && p?.popLife) for (const { event, big, age, hold } of frames) {
    const q = (age - hold) / p.popLife; if (!big || q < 0 || q >= 1) continue
    const ease = 1 - (1 - q) ** 3
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 1 - q; ctx.strokeStyle = p.popRingColor ?? '#fff'; ctx.lineWidth = (p.popRingWidth ?? 4) * (1 - q * .6); ctx.beginPath(); ctx.arc(event.x, event.y, (p.popRingFrom ?? 20) + ((p.popRingTo ?? 120) - (p.popRingFrom ?? 20)) * ease, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = p.popRingColor ?? '#fff'
    for (let i = 0, n = p.popDots ?? 0; i < n; i++) { const a = i * GOLDEN_ANGLE + (event.direction < 0 ? Math.PI : 0), d = (p.popDotDistance ?? 100) * ease * (.55 + .45 * ((i * 7) % n) / Math.max(1, n)), r = (p.popDotSize ?? 4) * (1 - q); ctx.beginPath(); ctx.arc(event.x + Math.cos(a) * d, event.y + Math.sin(a) * d * .8, Math.max(.5, r), 0, Math.PI * 2); ctx.fill() }
    ctx.restore()
  }
  // 「~~」 반짝 별: 날아간 끝에서 네 갈래 빛이 커졌다 사라진다 (본몸 자세에만)
  for (const { poses } of frames) {
    const pose = poses.at(-1); if (!pose?.star || !star) continue
    const k = Math.sin(Math.PI * pose.star), r = star.size * k
    if (r < .5) continue
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k; ctx.fillStyle = star.color; ctx.translate(pose.x, pose.y - 20); ctx.rotate(pose.star * 1.2)
    ctx.beginPath()
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, l = i % 2 ? r * .22 : r; ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l) }
    ctx.closePath(); ctx.fill(); ctx.restore()
  }
}
/**
 * 큰 마무리의 카메라 당김 (화면 전용): 얼어 있는 동안 맞은 놈 쪽으로 zoomIn 초에 bigZoom 배까지 · 풀리면 zoomOut 초에 1배로.
 * 돌려주는 k 는 지금 배율(1 이면 당김 없음) · (x,y) 는 맞은 놈의 몸
 */
export function criticalFinishFocus(frames: ReturnType<typeof criticalFinishFrames>, p: FinishTuning): { x: number; y: number; k: number } | null {
  const zoom = p.bigZoom ?? 1
  if (zoom <= 1) return null
  for (const f of frames) {
    if (!f.big) continue
    const zi = p.zoomIn ?? .05, zo = p.zoomOut ?? .15, out = f.age - f.hold
    const k = f.age < f.hold ? 1 + (zoom - 1) * (1 - (1 - Math.min(1, f.age / zi)) ** 2) : out < zo ? 1 + (zoom - 1) * (1 - out / zo) ** 2 : 1
    if (k > 1) return { x: f.event.x, y: f.event.y - 20, k }
  }
  return null
}
