import { P, HAEBI_END as E, HAEBI_ANIM as RA } from '../tune/params.ts'
import { planAttackCell } from '../raid/attack-plan.ts'
import { fallCells, koFrame } from '../raid/ko.ts'
import { idlePlan, idleSeed, planFrame, usablePlan, type IdlePlan } from '../raid/hero-idle.ts'
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
  /** 도트 띠(anim-px)의 서기 계획·씨앗 (raid/hero-idle.ts · 열전과 같은 서기 · cells 는 본 띠+덧 띠) · 쓰러지는 칸 차례 (raid/ko.ts · 없으면 hit → dead) */
  plan?: IdlePlan
  seed?: number
  fall?: readonly number[]
}
export const LEGACY_ATLAS: FighterAtlas = {
  cells: 20, idle: [0,1,2,3], attack: [12,13,14,15,16,17], windup: [12,13],
  guard: [13], stagger: [18], hit: 18, dead: 19,
}
/**
 * 도트 띠(public/realm/anim-px/gen-<이름>.png)의 칸 표 — 정규 20칸(LEGACY_ATLAS · 본 띠는 늘 20칸)에 띠마다 서기 계획·쓰러지는 칸을 얹는다 (열전과 같은 표 · HAEBI_IDLE.plans).
 * 20 칸부터는 덧 띠(gen-<이름>-x.png) — companion = false 면 아직 안 와서 그 칸을 뺀 계획 (쓰러짐 18 → 19 · 버릇 없음)
 */
export function pxAtlas(name: string, companion = true): FighterAtlas {
  const full = idlePlan(`anim-px/gen-${name}.png`)
  if (!full) return LEGACY_ATLAS
  const plan = usablePlan(full, companion)
  return { ...LEGACY_ATLAS, plan, seed: idleSeed(name), ...(plan.fall ? { fall: plan.fall } : {}) }
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

/**
 * Pure presentation: event reactions override rush, then settle into grounded stagger.
 * endAge 끝난 뒤 ms — 쓰러짐(dead)은 맞은 멈춤(HAEBI_END.defeat.freeze) 뒤 쓰러지는 칸을 차례로 (raid/ko.ts · 열전 KO 와 같은 박자) · 없으면 바로 누운 칸
 */
export function fighterMotion(atlas: FighterAtlas, anim: FighterAnim, now: number, rush: boolean,
  ending: 'dead' | 'hurt' | null = null, endAge?: number, calm = false): { frame: number; dx: number } {
  const R = P.duel, age = Math.max(0, now - anim.t0)
  if (ending === 'dead' && endAge !== undefined) return { frame: koFrame(fallCells(atlas.fall, atlas.hit, atlas.dead), endAge / 1000 - E.defeat.freeze), dx: 0 }
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
  if (anim.kind === 'attack' && atlas.plan?.attack && age < R.fighterAttackMs) {
    // 띠의 공격 계획 — 맞힘 칸이 예전 맞힘 칸(정규 띠 15)이 보이던 때에 서게 (그 앞은 줄이고 · 뒤는 남은 시간 안에 · 모자라면 마지막 칸)
    const at = atlas.attack.indexOf(RA.roles.strike.contact), hitAt = (at >= 0 ? at : Math.floor(atlas.attack.length / 2)) / atlas.attack.length * R.fighterAttackMs
    // 그린 공격은 칸 안에서 몸이 내닫는다 — 코드 런지(dx)를 겹치지 않는다
    return { frame: planAttackCell(atlas.plan.attack, age / 1000, hitAt / 1000, R.fighterAttackMs / 1000) ?? atlas.plan.attack.cells[atlas.plan.attack.cells.length - 1]!, dx: 0 }
  }
  if (anim.kind === 'attack' && age < R.fighterAttackMs) {
    const i = Math.min(atlas.attack.length - 1, Math.floor(age / R.fighterAttackMs * atlas.attack.length))
    return { frame: atlas.attack[i]!, dx: R.fighterLunge * Math.sin(Math.min(1, age / R.fighterLungeMs) * Math.PI) }
  }
  // 서기 계획(도트 띠) — 움직임 줄이기(calm)면 base 칸만 (열전과 같다)
  if (atlas.plan) return { frame: planFrame(atlas.plan, atlas.seed ?? 0, now / 1000, calm), dx: 0 }
  return { frame: atlas.idle[Math.floor(now / (atlas.idleMs ?? R.fighterIdleMs)) % atlas.idle.length]!, dx: 0 }
}
