import { P } from '../tune/params.ts'
import { GENERATED_DUEL_KEYS } from '../realm/data/duelGenerated.ts'
import { DRAWN_IDLE } from '../realm/data/drawnIdle.ts'
import { FULL20_ATLASES } from '../realm/data/full20Generated.ts'
import { AWAKENED_ATLASES } from '../realm/data/awakenedSpritesGenerated.ts'

export type FighterKind = 'idle' | 'windup' | 'attack' | 'guard' | 'hit' | 'stagger'
export interface FighterAnim { kind: FighterKind; t0: number }
export interface FighterAtlas {
  cells: number
  idle: readonly number[]
  idleMs?: number
  attack: readonly number[]
  windup: readonly number[]
  guard: readonly number[]
  stagger: readonly number[]
  hit: number
  dead: number
}
export const LEGACY_ATLAS: FighterAtlas = {
  cells: 20, idle: [0,1,2,3], attack: [12,13,14,15,16,17], windup: [12,13],
  guard: [13], stagger: [18], hit: 18, dead: 19,
}
// Source pose 7 has an incomplete spear; it is deliberately never selected.
const BASE_DUEL_ATLASES: Readonly<Record<string, FighterAtlas>> = {
  ...Object.fromEntries(GENERATED_DUEL_KEYS.map(key => [key, {
    cells: key==='eomni'?18:16, idle: key==='eomni'?[16,17,16,17]:[0], idleMs: key==='eomni'?650:undefined, attack: [5,6,7,8,9,0], windup: [0,6],
    guard: [11,10], stagger: [12,13], hit: 14, dead: 15,
  }])),
  aryeong: { cells: 19, idle: [16,17,18,17], idleMs: 650, attack: [5,10,7,8,9,0], windup: [0,10],
    guard: [11,10], stagger: [12,13], hit: 14, dead: 15 },
  soseono: { cells: 19, idle: [16,17,18,17], idleMs:650, attack: [5,10,7,8,9,0], windup: [0,10],
    guard: [11,10], stagger: [12,13], hit: 14, dead: 15 },
  heo: { cells: 19, idle: [16,17,18,17], idleMs:650, attack: [5,10,7,8,9,0], windup: [0,10],
    guard: [11,10], stagger: [12,13], hit: 14, dead: 15 },
  gamsil: { cells: 19, idle: [16,17,18,17], idleMs:650, attack: [5,10,7,8,9,0], windup: [0,10],
    guard: [11,10], stagger: [12,13], hit: 14, dead: 15 },
}

export const DUEL_ATLASES: Readonly<Record<string,FighterAtlas>> = Object.fromEntries(
  Object.entries({...BASE_DUEL_ATLASES,...(DRAWN_IDLE.haebi?{haebi:LEGACY_ATLAS}:{}),...FULL20_ATLASES,...AWAKENED_ATLASES}).map(([key,atlas])=>{
    const layout=DRAWN_IDLE[key]
    return [key,layout?{...atlas,cells:layout.cells,idle:layout.frames,idleMs:650}:atlas]
  }))

/** Pure presentation: event reactions override rush, then settle into grounded stagger. */
export function fighterMotion(atlas: FighterAtlas, anim: FighterAnim, now: number, rush: boolean,
  ending: 'dead' | 'hurt' | null = null): { frame: number; dx: number } {
  const R = P.duel, age = Math.max(0, now - anim.t0)
  if (ending !== null) return { frame: ending === 'dead' ? atlas.dead : atlas.hit, dx: 0 }
  if (anim.kind === 'hit' && age < R.fighterHitMs) {
    const decay = 1 - age / R.fighterHitMs
    return { frame: atlas.hit, dx: -R.fighterRecoil * decay * (1 + 0.25 * Math.sin(age / R.fighterJoltMs)) }
  }
  if (anim.kind === 'guard' && age < R.fighterGuardMs) {
    const i = Math.min(atlas.guard.length - 1, Math.floor(age / R.fighterGuardMs * atlas.guard.length))
    return { frame: atlas.guard[i]!, dx: -R.fighterBlockRecoil * (1 - age / R.fighterGuardMs) }
  }
  if (rush) return { frame: atlas.stagger[Math.floor(now / R.fighterStaggerMs) % atlas.stagger.length]!, dx: 0 }
  if (anim.kind === 'windup') return { frame: atlas.windup[age < R.fighterWindupMs ? 0 : atlas.windup.length - 1]!, dx: 0 }
  if (anim.kind === 'attack' && age < R.fighterAttackMs) {
    const i = Math.min(atlas.attack.length - 1, Math.floor(age / R.fighterAttackMs * atlas.attack.length))
    return { frame: atlas.attack[i]!, dx: R.fighterLunge * Math.sin(Math.min(1, age / R.fighterLungeMs) * Math.PI) }
  }
  return { frame: atlas.idle[Math.floor(now / (atlas.idleMs ?? R.fighterIdleMs)) % atlas.idle.length]!, dx: 0 }
}
