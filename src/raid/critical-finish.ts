import type { Effect, Missile, MobKind } from './haebi.ts'
export interface FinishTuning { readonly life: number; readonly hold: number; readonly holdScale: number; readonly fadeAt: number; readonly starAt: number; readonly distance: number; readonly lift: number; readonly endScale: number; readonly spin: number; readonly trailAlpha: number; readonly trailOffsets: readonly number[]; readonly maxBodies: number; readonly lowMaxBodies: number }
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
export function criticalFinishPoses(e: FinishEvent, elapsed: number, p: FinishTuning, low = false): readonly FinishPose[] {
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= p.life || p.life <= p.hold) return []
  // 「둑」 멈춤 동안은 맞은 자리에서 부푼다 · 「팡」 뒤엔 빨리 떠서 느려지며(ease-out) 멀리 · 높이 · 작아지고 · fadeAt 뒤 옅어지며 별이 반짝
  const pose = (age: number, alpha: number): FinishPose => {
    if (age < p.hold) return { x: e.x, y: e.y, rotation: 0, scale: 1 + (p.holdScale - 1) * Math.sin(Math.PI * age / p.hold), alpha }
    const q = Math.max(0, Math.min(1, (age - p.hold) / (p.life - p.hold))), ease = 1 - (1 - q) ** 3
    const fade = q < p.fadeAt ? 1 : Math.max(0, (1 - q) / (1 - p.fadeAt))
    return { x: e.x + e.direction * p.distance * ease, y: e.y - p.lift * Math.sin(Math.min(1, q * 1.25) * Math.PI * .5) * (1 - q * .35), rotation: e.direction * p.spin * q, scale: 1 - (1 - p.endScale) * ease, alpha: alpha * fade, star: q > p.starAt ? (q - p.starAt) / (1 - p.starAt) : 0 }
  }
  const trails = low ? [] : p.trailOffsets.filter(delay => elapsed - delay > p.hold).map(delay => pose(elapsed - delay, p.trailAlpha))
  return [...trails, pose(elapsed, 1)]
}
interface Flight { readonly effect: Effect; readonly event: FinishEvent; readonly bornAt: number }
interface ViewState { readonly seen: WeakSet<Effect>; readonly handled: WeakSet<Effect>; flights: Flight[]; time: number }
const views = new WeakMap<object, ViewState>()
export function criticalFinishFrames(run: object, fx: readonly Effect[], time: number, playing: boolean, low: boolean, p: FinishTuning) {
  if (!Number.isFinite(time)) { views.delete(run); return [] }
  let v = views.get(run)
  // Terminal/ending drops moving copies, but a consumed corpse must stay suppressed.
  // Do not compare the ending clock with active view time or reset handled/seen here.
  if (!playing) { if (v) v.flights = []; return [] }
  if (!v || time < v.time) { v = { seen: new WeakSet(), handled: new WeakSet(), flights: [], time }; views.set(run, v) }
  v.time = time; v.flights = v.flights.filter(f => time - f.bornAt < p.life)
  const cap = Math.max(0, Math.floor(low ? p.lowMaxBodies : p.maxBodies))
  for (const effect of fx) if (!v.seen.has(effect)) {
    v.seen.add(effect); const event = criticalFinishEvent(effect)
    if (event && v.flights.length < cap) { v.flights.push({ effect, event, bornAt: time }); v.handled.add(effect) }
  }
  // Retain copied cosmetics after the simulator removes the short-lived FX. Low mode draws one body, no trails.
  return v.flights.slice(-cap || v.flights.length).map(f => ({ event: f.event, poses: criticalFinishPoses(f.event, time - f.bornAt, p, low) }))
}
export const criticalFinishHandled = (run: object, f: Effect) => views.get(run)?.handled.has(f) ?? false
export function drawCriticalFinishFrames(ctx: CanvasRenderingContext2D, frames: ReturnType<typeof criticalFinishFrames>, drawMob: (mob: MobKind, face: number) => void, star?: { readonly size: number; readonly color: string }) {
  for (const { event, poses } of frames) for (const pose of poses) {
    ctx.save(); ctx.translate(pose.x, pose.y); ctx.rotate(pose.rotation); ctx.scale(pose.scale, pose.scale); ctx.globalAlpha *= pose.alpha
    drawMob(event.mob, event.face); ctx.restore()
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
