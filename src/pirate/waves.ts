/**
 * 바다도적 막기 — 물결 표 (docs/realm/SNIPE.md §0-9).
 *
 * 판의 배치는 전부 여기서 굽는다: 시드·세기 → 물결 셋의 「언제 무엇이 어디서」.
 * 손이 쏜 결과만 바깥(sim.ts)에서 들어온다 — 같은 시드면 같은 물결이다 (A1).
 * DOM·시계 없음. 숫자는 P.pirate.
 */
import { makeRng } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import type { ArrowKindId } from '../sim/types.ts'

/** 물결 하나에서 나오는 것 하나 — at 은 그 물결이 열린 뒤의 초 */
export type Spawn =
  | { readonly at: number; readonly what: 'sword'; readonly x: number; readonly speed: number; readonly lane: Lane }
  | { readonly at: number; readonly what: 'shield'; readonly x: number; readonly speed: number }
  | { readonly at: number; readonly what: 'archer'; readonly x: number; readonly delay: number }
  | { readonly at: number; readonly what: 'captain'; readonly x: number; readonly lane: Lane }
  | { readonly at: number; readonly what: 'barrel'; readonly x: number; readonly arrow: ArrowKindId }

/** 산적 판의 세 길 — 0 아랫길(땅) · 1 가운뎃길(비탈 턱) · 2 윗길(능선) */
export type Lane = 0 | 1 | 2

const ramp = (x: number, x1: number, len: number): number => Math.max(0, Math.min(1, (x - (x1 - len)) / len))

/** 길 위의 발 높이 (m) — x 는 궁수에서의 거리. 윗길은 비탈로 가운뎃길 높이까지, 가운뎃길은 비탈로 땅까지 (위치만의 함수 · 결정론) */
export function footY(lane: Lane, x: number): number {
  const R = P.pirate
  if (lane === 0) return 0
  const mid = ramp(x, R.midDropX, R.midDropLen) * R.midY
  return lane === 1 ? mid : mid + ramp(x, R.ridgeDropX, R.ridgeDropLen) * (R.ridgeY - R.midY)
}

export interface Wave {
  readonly spawns: readonly Spawn[]
}

/** 궤짝에 드는 살 — 유엽전(basic)은 늘 쥐고 있으니 뺀다 */
export const BARREL_ARROWS: readonly ArrowKindId[] = ['pierce', 'burst', 'split', 'homing', 'chain', 'heavy', 'scatter', 'rapid']

export const WAVE_COUNT = 3

/** 판의 갈래 — 바다 도적(물·배) · 산적(고갯길·능선) */
export type Mode = 'pirate' | 'bandit'

/** 방패 든 도적 수 — 둘째 물결부터, 칼잡이처럼 세기로 흔들린다 */
export function shieldCount(wave: number, sev: number): number {
  const R = P.pirate
  const base = wave === 1 ? R.shield2 : wave === 2 ? R.shield3 : 0
  const s = Math.max(1, Math.min(3, Math.round(sev))) - 2
  return base === 0 ? 0 : Math.max(0, Math.round(base * (1 + s * R.sevCount)))
}

/** 배 위(바다) · 능선(산적) 궁수의 자리 */
export function archerX(mode: Mode, i: number): number {
  const R = P.pirate
  return mode === 'bandit' ? R.spawnX - R.ridgeX - i * R.archerSpread : R.boatX + i * R.archerSpread
}

/** 세기 1 작은 무리 · 2 보통 · 3 큰 무리 — 칼잡이 수가 ±sevCount 만큼 */
export function swordCount(wave: number, sev: number): number {
  const R = P.pirate
  const base = wave === 0 ? R.count1 : wave === 1 ? R.count2 : R.count3
  const s = Math.max(1, Math.min(3, Math.round(sev))) - 2
  return Math.max(1, Math.round(base * (1 + s * R.sevCount)))
}

/** 물결 셋 — 시드 하나에서 (같은 시드 = 같은 판) */
export function bakeWaves(seed: number, sev: number, mode: Mode = 'pirate'): Wave[] {
  const R = P.pirate
  const rng = makeRng((seed ^ 0x5a17e) >>> 0)
  const out: Wave[] = []
  for (let k = 0; k < WAVE_COUNT; k++) {
    const spawns: Spawn[] = []
    const n = swordCount(k, sev)
    const gap = R.gap * Math.pow(R.gapMul, k)
    const v = R.speed + R.speedStep * k
    let t = 0
    let made = 0
    // 산적 판 — 세 길을 섞어 보낸다 (셋 한 묶음마다 길 셋이 한 번씩 · 순서는 시드). 바다 도적은 늘 아랫길 (난수를 쓰지 않아 옛 물결 그대로)
    let laneBag: Lane[] = []
    const nextLane = (): Lane => {
      if (mode !== 'bandit') return 0
      if (laneBag.length === 0) {
        laneBag = [0, 1, 2]
        for (let i = 2; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); const tmp = laneBag[i]!; laneBag[i] = laneBag[j]!; laneBag[j] = tmp }
      }
      return laneBag.pop()!
    }
    while (made < n) {
      const pair = made + 1 < n && rng.chance(R.pairChance)
      const sp = (): number => v * (1 + (rng.next() * 2 - 1) * R.speedJitter)
      spawns.push({ at: t, what: 'sword', x: R.spawnX, speed: sp(), lane: nextLane() })
      made++
      if (pair) {
        spawns.push({ at: t, what: 'sword', x: R.spawnX + R.pairGap, speed: sp(), lane: nextLane() })
        made++
      }
      t += gap * (0.8 + rng.next() * 0.4)
    }
    const span = t
    // 배 위 궁수 — 둘째·셋째 물결이 열리자마자 배에 선다
    const na = k === 1 ? R.archers2 : k === 2 ? R.archers3 : 0
    for (let i = 0; i < na; i++) spawns.push({ at: 0, what: 'archer', x: archerX(mode, i), delay: i * R.archerStagger })
    // 방패 든 도적 — 칼잡이 사이사이 (칼잡이 수는 그대로, 방패는 더 온다)
    const ns = shieldCount(k, sev)
    for (let i = 0; i < ns; i++) spawns.push({ at: span * ((i + 0.5) / ns), what: 'shield', x: R.spawnX, speed: v * R.shieldSpeedMul })
    // 두목 — 셋째 물결 가운데쯤
    if (k === 2) spawns.push({ at: span * R.captainAt, what: 'captain', x: R.spawnX, lane: mode === 'bandit' ? (Math.round(R.chiefLane) as Lane) : 0 })
    // 궤짝 — 물결 안에 고루, 무엇이 들었나는 시드로 (같은 물결에 같은 살이 겹치지 않게)
    const bag = [...BARREL_ARROWS]
    for (let i = 0; i < R.barrels; i++) {
      const j = Math.floor(rng.next() * bag.length)
      const arrow = bag.splice(j, 1)[0] ?? 'pierce'
      const at = span * ((i + 0.3 + rng.next() * 0.4) / Math.max(1, R.barrels))
      spawns.push({ at, what: 'barrel', x: R.spawnX + 1, arrow })
    }
    spawns.sort((a, b) => a.at - b.at)
    out.push({ spawns })
  }
  return out
}

/** 포구를 맡은 장수의 무예 → 궁수 근력 레벨 (당김이 빨라진다) · 다른 스탯은 바탕 */
export function archerStr(mu: number): number {
  const R = P.pirate
  return Math.max(0, R.stat + Math.max(0, mu - R.muBase) * R.muStat)
}

/** 포구 경계(0~1) → 목책 수 */
export function palisadeLives(alert: number): number {
  const R = P.pirate
  return Math.round(R.lives) + (alert >= R.watchLife ? 1 : 0)
}
