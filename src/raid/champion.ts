import { HAEBI_RUN as C, HAEBI_CHAMPION as B, HAEBI_STAGES as ST } from '../tune/params.ts'
import type { HaebiRun, Mob, MobKind } from './haebi.ts'

export type ChampionPattern = 'dash' | 'slam' | 'fan' | 'summon' | 'guard'
export interface SpawnView { left: number; top: number; right: number; bottom: number }
export interface ChampionState {
  mode: 'enter' | 'chase' | 'tell' | 'dash' | 'guard' | 'roar'
  t: number; cycle: number; dx: number; dy: number; range: number; radius: number
  startX: number; startY: number; remaining: number; dashHit: boolean; waveDone: boolean; recoveryHitUsed: boolean
}
export interface ChampionHooks {
  hurt: (damage: number) => void
  fan: (angle: number) => void
  summon: (kind: MobKind, x: number, y: number) => void
  cue: (kind: 'enter' | 'roar' | 'recovery') => void
}
const world: SpawnView = { left: 0, top: 0, right: C.width, bottom: C.height }
/** Reject malformed/tiny injected bounds rather than spawning beside a forged player-sized viewport. */
export function spawnView(view?: SpawnView): SpawnView {
  if (!view || !Object.values(view).every(Number.isFinite)) return world
  const v = { left: Math.max(0, view.left), top: Math.max(0, view.top), right: Math.min(C.width, view.right), bottom: Math.min(C.height, view.bottom) }
  return v.right - v.left >= C.width * B.minViewShare && v.bottom - v.top >= C.height * B.minViewShare ? v : world
}
export const championStage = (s: HaebiRun) => B.stages[s.stage as keyof typeof B.stages] ?? B.stages.forest
export function initChampion(s: HaebiRun, e: Mob) {
  if (s.mode !== 'stage' || e.kind !== 'elite' && e.kind !== 'boss') return
  const stage = championStage(s), elapsed = s.t / ST[s.stage].length - C.eliteEvery * 2
  const late = elapsed <= 1e-6 ? 1 : 1 + (stage.eliteLateScale - 1) * Math.min(1, elapsed / B.eliteLateRamp)
  const scale = e.kind === 'boss' ? stage.bossHp : stage.eliteHp * late
  e.hp *= scale; e.max *= scale; e.bornAt = s.t; e.phase = 1; e.pattern = null; e.patternSeq = 0; e.recovery = 0
  e.champion = { mode: 'enter', t: B.entrySeconds, cycle: 0, dx: 1, dy: 0, range: B.dashRange, radius: B.slamRadius, startX: e.x, startY: e.y, remaining: 0, dashHit: false, waveDone: false, recoveryHitUsed: false }
}
export function championDamageScale(e: Mob, origin: { x: number; y: number } | null) {
  if (!e.champion) return 1
  if (e.recovery! > 0) return B.recoveryDamage
  if (e.champion.mode !== 'guard' || !origin) return 1
  const side = (origin.x - e.x) * e.champion.dx + (origin.y - e.y) * e.champion.dy
  return side === 0 ? 1 : side > 0 ? B.guardFront : B.guardRear
}
export function segmentDistance(x: number, y: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1, k = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(x - x1 - k * dx, y - y1 - k * dy)
}
export function championFanAngles(e: Mob) {
  const c = e.champion!, count = B.fanCount, angle = Math.atan2(c.dy, c.dx)
  return Array.from({ length: count }, (_, i) => angle + (i - (count - 1) / 2) * B.fanSpread / (count - 1))
}
export const championWindup = (pattern: ChampionPattern | null | undefined) => pattern === 'dash' ? B.dashWind : pattern === 'slam' ? B.slamWind : pattern === 'fan' ? B.fanWind : pattern === 'summon' ? B.summonWind : 0
/** 공격·돌진이 끝나 비틀거림(회복 틈)으로 — 판 끝에 박힌 돌진 · 56-C 목책에 박힌 돌진도 같은 길 */
export function championRecover(e: Mob, hooks: Pick<ChampionHooks, 'cue'>) {
  const c = e.champion!
  e.wind = 0; e.recovery = B.recoverySeconds; c.recoveryHitUsed = false; c.mode = 'chase'; hooks.cue('recovery')
}
/** walk: 걸어갈 자리 (56-C 목책 판에서 문으로 돌 때 · 없으면 장수) — 겨눔·공격 거리는 늘 장수 */
export function stepChampion(s: HaebiRun, e: Mob, dt: number, hooks: ChampionHooks, walk?: { x: number; y: number } | null) {
  const c = e.champion!
  if (e.hp <= 0 || s.state !== 'playing') return
  const recover = () => championRecover(e, hooks)
  const summon = (count: number) => { for (let i = 0; i < count; i++) { const a = i * Math.PI * 2 / count; hooks.summon(championStage(s).minion, e.x + Math.cos(a) * B.summonRadius, e.y + Math.sin(a) * B.summonRadius) } }
  if (e.recovery! > 0) { e.recovery = Math.max(0, e.recovery! - dt); return }
  if (c.mode === 'enter') {
    c.t -= dt
    const tx = walk?.x ?? s.x, ty = walk?.y ?? s.y
    const d = Math.hypot(tx - e.x, ty - e.y) || 1, speed = C.mobSpeed + s.t * C.speedTimeScale
    e.x += (tx - e.x) / d * speed * dt; e.y += (ty - e.y) / d * speed * dt
    if (c.t <= 0) c.mode = 'chase'
    return
  }
  if (c.mode === 'roar') { c.t -= dt; if (c.t <= 0) { if (e.phase === 3 && !c.waveDone) { c.waveDone = true; summon(B.waveCount) }; c.mode = 'chase' }; return }
  if (c.mode === 'guard') { c.t -= dt; if (c.t <= 0) recover(); return }
  if (c.mode === 'dash') {
    const speed = B.dashSpeed * (e.phase! >= 2 ? B.phaseMove : 1), distance = Math.min(c.remaining, speed * dt), x0 = e.x, y0 = e.y
    const nx = x0 + c.dx * distance, ny = y0 + c.dy * distance
    e.x = Math.max(10, Math.min(C.width - 10, nx)); e.y = Math.max(20, Math.min(C.height - 10, ny)); c.remaining -= distance
    if (!c.dashHit && segmentDistance(s.x, s.y, x0, y0, e.x, e.y) < B.dashWidth) { c.dashHit = true; hooks.hurt(B.dashDamage) }
    if (e.x !== nx || e.y !== ny || c.remaining <= 0) recover()
    return
  }
  if (c.mode === 'tell') {
    e.wind = Math.max(0, e.wind - dt)
    if (e.wind > 0) return
    if (e.pattern === 'dash') { c.mode = 'dash'; c.remaining = c.range; return }
    if (e.pattern === 'slam' && Math.hypot(s.x - e.aimX, s.y - e.aimY) < c.radius) hooks.hurt(B.slamDamage)
    else if (e.pattern === 'fan') for (const a of championFanAngles(e)) hooks.fan(a)
    else if (e.pattern === 'summon') summon(B.summonCount)
    recover(); return
  }
  // One threshold per roar. A large nonlethal hit queues the next threshold instead of skipping phase2.
  const want = e.kind === 'boss' && e.hp / e.max <= .3 ? 3 : e.hp / e.max <= .5 ? 2 : 1
  if (e.phase! < want) { e.phase = (e.phase! + 1) as 2 | 3; c.mode = 'roar'; c.t = B.roarSeconds; e.pattern = null; hooks.cue('roar'); return }
  const x = s.x - e.x, y = s.y - e.y, d = Math.hypot(x, y) || 1
  if (d <= B.attackRange && !e.cd) {
    const patterns = championStage(s).patterns, count = e.phase! >= 2 ? patterns.length : 2
    e.pattern = patterns[c.cycle++ % count]!; e.patternSeq!++; c.dx = x / d; c.dy = y / d; c.startX = e.x; c.startY = e.y
    e.aimX = s.x; e.aimY = s.y; e.cd = B.cooldown / (e.phase! >= 2 ? B.phaseRate : 1)
    if (e.pattern === 'guard') { c.mode = 'guard'; c.t = B.guardSeconds; return }
    c.mode = 'tell'; e.wind = championWindup(e.pattern)
    if (e.pattern === 'dash') {
      const wallX = c.dx > 0 ? (C.width - 10 - e.x) / c.dx : c.dx < 0 ? (10 - e.x) / c.dx : Infinity
      const wallY = c.dy > 0 ? (C.height - 10 - e.y) / c.dy : c.dy < 0 ? (20 - e.y) / c.dy : Infinity
      c.range = Math.max(0, Math.min(B.dashRange, wallX, wallY))
      e.aimX = e.x + c.dx * c.range; e.aimY = e.y + c.dy * c.range; c.dashHit = false
    }
    return
  }
  if (d > 100) {
    const speed = (C.mobSpeed + s.t * C.speedTimeScale) * (e.phase! >= 2 ? B.phaseMove : 1)
    if (walk) { const wx = walk.x - e.x, wy = walk.y - e.y, wd = Math.hypot(wx, wy) || 1; e.x += wx / wd * speed * dt; e.y += wy / wd * speed * dt }
    else { e.x += x / d * speed * dt; e.y += y / d * speed * dt }
  }
}
