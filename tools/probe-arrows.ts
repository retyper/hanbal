/**
 * 화살 6종 프로브 — sim 배선이 실제로 다르게 작동하는가 (docs/HOOK.md 4장 검증 기준 1)
 *
 * 밸런스 시뮬(tools/balance-sim.ts)은 봇의 조준까지 섞여 "왜 달라졌는가"를 못 가른다.
 * 여기서는 **똑같은 각도로 똑같이 한 발**을 쏘고 무슨 일이 벌어지는지만 센다.
 *
 * 실행: node --experimental-strip-types tools/probe-arrows.ts
 */
import { createWorld, step } from '../src/sim/world.ts'
import { spawnArrow } from '../src/sim/ballistics.ts'
import { ARROW_KINDS } from '../src/game/arrows.ts'
import type { ArrowKindId, InputFrame, StageDef, Stats } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 8, focus: 6 }
const IDLE: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false }

/** 밀집 + 일렬 + 공중. 여섯 종류가 각각 다른 것을 물어야 하는 배치다. */
function stage(): StageDef {
  return {
    id: 'probe',
    seed: 0x1234,
    arrows: 4,
    targetScore: 100,
    wind: 0,
    targets: [
      // 일렬 (관통·사슬)
      { kind: 'static', x: 16, y: 2.0, r: 0.5, score: 100 },
      { kind: 'static', x: 19, y: 2.0, r: 0.5, score: 100 },
      { kind: 'static', x: 22, y: 2.0, r: 0.5, score: 100 },
      // 밀집 (폭발)
      { kind: 'static', x: 16, y: 3.4, r: 0.5, score: 100 },
      // 첫 과녁에서 ±0.30rad 방향으로 벌어진 자리 (분열 자식이 노릴 곳)
      { kind: 'static', x: 18.5, y: 2.76, r: 0.5, score: 100 },
      { kind: 'static', x: 18.5, y: 1.24, r: 0.5, score: 100 },
    ],
  }
}

interface Result {
  kind: ArrowKindId
  hits: number
  chains: number
  killed: number
  score: number
  /** 한 발이 만든 화살 수 (분열 자식 포함) */
  arrows: number
  flightM: number
}

function shoot(kind: ArrowKindId, angle: number): Result {
  const w = createWorld(stage(), STATS, kind)
  const a = spawnArrow(w, angle, 1)
  if (a === null) throw new Error('발사 실패')
  const x0 = a.x

  let hits = 0
  let chains = 0
  let arrows = 1
  let far = 0
  for (let i = 0; i < 900; i++) {
    step(w, IDLE)
    let live = 0
    for (const ar of w.arrows) {
      if (ar.alive) {
        live++
        if (ar.x - x0 > far) far = ar.x - x0
      }
    }
    if (live > arrows) arrows = live
    for (const e of w.events) {
      if (e.t === 'hit') hits++
      else if (e.t === 'chain') chains++
    }
    w.events.length = 0
    if (live === 0) break
  }

  let killed = 0
  for (const t of w.targets) if (!t.alive) killed++
  return { kind, hits, chains, killed, score: w.score, arrows, flightM: far }
}

/** 첫 과녁(16, 2.0)을 정확히 겨눈 각. 낙차 때문에 살짝 위를 본다. */
function aimAt(x: number, y: number, kind: ArrowKindId): number {
  // 이분 탐색이 아니라 단순 스윕. 프로브라 정확도보다 재현성이 중요하다.
  let best = 0
  let bestErr = Infinity
  for (let deg = -2; deg <= 20; deg += 0.02) {
    const ang = (deg * Math.PI) / 180
    const w = createWorld(stage(), STATS, kind)
    // 과녁을 전부 지워 궤적만 본다
    for (const t of w.targets) t.alive = false
    const a = spawnArrow(w, ang, 1)
    if (a === null) continue
    for (let i = 0; i < 600; i++) {
      step(w, IDLE)
      if (!a.alive) break
      if (a.x >= x) {
        const err = Math.abs(a.y - y)
        if (err < bestErr) {
          bestErr = err
          best = ang
        }
        break
      }
    }
  }
  return best
}

const pad = (s: string, n: number): string => (s.length >= n ? s : ' '.repeat(n - s.length) + s)

console.log('── 정조준 한 발 (과녁 6개 배치) ─────────────────────────────')
console.log('화살       명중  연쇄  제거/6   점수   최대화살  도달m')
for (const k of ARROW_KINDS) {
  // 종류마다 초속이 다르므로(무거운 살) 각도는 종류별로 다시 찾는다 —
  // 같은 각도를 강요하면 "무거운 살은 안 맞는다"만 재게 된다.
  const r = shoot(k.id, aimAt(16, 2.0, k.id))
  console.log(
    (r.kind + '      ').slice(0, 8),
    pad(String(r.hits), 4),
    pad(String(r.chains), 5),
    pad(String(r.killed), 6),
    pad(String(r.score), 7),
    pad(String(r.arrows), 8),
    pad(r.flightM.toFixed(1), 7),
  )
}

/**
 * 유도 살의 값은 "빗나갈 뻔한 걸 살린다"이고, 위험은 "조준을 대신한다"다.
 * 각오차를 키워가며 **어디까지 살려주는가**를 잰다 — 기본 살과의 차이가 곧 유도의 크기다.
 */
console.log('\n── 조준 오차(mrad)별 명중 여부: 기본 살 vs 유도 살 ──────────')

/** 과녁 하나만 세운 판. "다른 과녁을 대신 맞혔다"가 섞이면 유도의 크기를 못 잰다. */
function lone(): StageDef {
  return {
    id: 'lone',
    seed: 0x1234,
    arrows: 2,
    targetScore: 100,
    wind: 0,
    targets: [{ kind: 'static', x: 20, y: 2.4, r: 0.35, score: 100 }],
  }
}

function loneHit(kind: ArrowKindId, angle: number): boolean {
  const w = createWorld(lone(), STATS, kind)
  const a = spawnArrow(w, angle, 1)
  if (a === null) return false
  for (let i = 0; i < 900; i++) {
    step(w, IDLE)
    for (const e of w.events) if (e.t === 'hit') return true
    w.events.length = 0
    if (!a.alive) break
  }
  return false
}

/** 이 종류로 정확히 맞는 각. 종류마다 초속이 달라 따로 찾는다. */
function loneAim(kind: ArrowKindId): number {
  for (let deg = 0; deg <= 20; deg += 0.005) {
    if (loneHit(kind, (deg * Math.PI) / 180)) return (deg * Math.PI) / 180
  }
  return 0
}

let line1 = 'mrad   '
let line2 = 'basic  '
let line3 = 'homing '
const baseAng = loneAim('basic')
const homeAng = loneAim('homing')
for (let mrad = 0; mrad <= 132; mrad += 12) {
  const off = mrad * 0.001
  line1 += pad(String(mrad), 4)
  line2 += pad(loneHit('basic', baseAng + off) ? 'O' : '.', 4)
  line3 += pad(loneHit('homing', homeAng + off) ? 'O' : '.', 4)
}
console.log(line1)
console.log(line2)
console.log(line3)
console.log('(반경 0.35m · 20m 거리 = 순수 각크기 ±17.5mrad. O 구간의 차이가 유도가 살려주는 폭이다)')
