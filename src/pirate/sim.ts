/**
 * 바다도적 막기 — 판의 규칙 (docs/realm/SNIPE.md §0-9).
 *
 * 활터의 World 하나를 그대로 돌리고(step), 그 둘레에 이 판의 것만 얹는다:
 *   물결이 차례로 나온다(waves.ts) · 도적이 목책에 닿으면 목책이 부서진다 · 궤짝을 맞히면 살이 바뀐다.
 * sim 이다 — Math.random·Date.now·DOM 금지 (A1). 시계는 w.tick 뿐이고 난수는 waves.ts 가 시드로 굽는다.
 *
 * 활터의 판 끝 규칙(과녁이 다 쓰러지면 클리어)은 물결 사이에도 판이 서 있어야 해서 **닻**(땅속 깊이 묻힌
 * 과녁 하나 · 아무 살도 닿지 않는다)으로 막는다. 판의 끝은 여기서 정한다(result).
 */
import { P } from '../tune/params.ts'
import { armArrow, cancelDraw, createWorld, reserveTargets, spawnTarget, step } from '../sim/world.ts'
import type { ArrowKindId, BowMods, InputFrame, StageDef, World } from '../sim/types.ts'
import { archerStr, bakeWaves, palisadeLives, WAVE_COUNT, type Spawn, type Wave } from './waves.ts'

export type Role = 'none' | 'anchor' | 'sword' | 'captain' | 'archer' | 'barrel'

/** 판이 내는 사건 — 화면·소리가 읽고 비운다 */
export type PirateEv =
  | { readonly t: 'wave'; readonly k: number }
  | { readonly t: 'clear'; readonly k: number }
  | { readonly t: 'break'; readonly x: number; readonly left: number; readonly n: number }
  | { readonly t: 'arm'; readonly arrow: ArrowKindId; readonly x: number; readonly y: number }
  | { readonly t: 'unarm' }
  | { readonly t: 'flinch' }
  | { readonly t: 'end'; readonly won: boolean; readonly held: number }

export interface PirateOpts {
  readonly seed: number
  /** 세기 1 작은 무리 · 2 보통 · 3 큰 무리 */
  readonly sev: number
  /** 포구를 맡은 장수의 무예 (없으면 0) */
  readonly mu: number
  /** 포구 경계 0~1 */
  readonly watch: number
  /** 활 (밤 판과 같은 tierBow 로 구운 것) — 없으면 연습궁 */
  readonly bow?: BowMods
  /** 활 한 단계마다 스탯 덤 (밤 판과 같은 몫) */
  readonly bowStat?: number
}

export interface PirateRun {
  readonly w: World
  readonly waves: readonly Wave[]
  /** 지금 물결 (0~2) · 첫 물결 전에는 −1 */
  wave: number
  phase: 'pause' | 'fight' | 'end'
  /** 물결이 열린 뒤 흐른 초 */
  waveT: number
  /** 이 물결에서 다음에 나올 것의 차례 */
  next: number
  /** 쉬는 시간이 남은 초 */
  pauseLeft: number
  lives: number
  readonly livesMax: number
  /** 지금 쥔 궤짝 살 — basic 이면 없다 */
  special: ArrowKindId
  specialLeft: number
  /** 과녁 자리마다 — 무엇인가 · 궤짝의 살 · 궤짝이 뜬 때 */
  readonly role: Role[]
  readonly barrelArrow: ArrowKindId[]
  readonly barrelBorn: number[]
  /** 다 막은 물결 수 */
  held: number
  /** 쏜 수 — 한 발이라도 쐈으면 답이 굳는다 */
  shots: number
  /** 부서진 때 (목책 칸마다 · 그리기가 흔들림에 쓴다) — 아직이면 −1 */
  readonly brokeAt: number[]
  result: { readonly won: boolean; readonly held: number } | null
  readonly events: PirateEv[]
}

/** 화살 풀 — 끝없는 살이지만 풀은 이만큼 (스텝마다 채운다) */
const ARROWS = 120
/** 과녁 자리를 미리 — 물결 하나에 칼잡이 열셋 + 궁수·두목·궤짝 · 쓰러진 자리는 다시 쓴다 */
const TARGET_SLOTS = 40
/** 닻 — 땅속 깊이, 궁수 뒤로 (살이 닿지 않는다) */
const ANCHOR = { x: -60, y: -60 } as const

function stageDef(seed: number): StageDef {
  return {
    id: '3-p1', pair: '', title: '', seed, arrows: ARROWS, targetScore: 0, wind: 0,
    targets: [
      { kind: 'static', x: ANCHOR.x, y: ANCHOR.y, r: 0.3 },
    ],
  }
}

export function createPirate(o: PirateOpts): PirateRun {
  const R = P.pirate
  const lv = R.stat + (o.bowStat ?? 0)
  const str = archerStr(o.mu) + (o.bowStat ?? 0)
  const def = stageDef(o.seed >>> 0)
  const w = createWorld(def, { str, steady: lv, stamina: lv, focus: lv }, 'basic', o.bow)
  reserveTargets(w, TARGET_SLOTS)
  // 판에는 닻만 섰다 — 이제 stage.targets 를 구도 표지로 바꾼다 (resetWorld 를 다시 부르지 않으니 판에는 안 선다)
  w.stage = {
    ...def,
    targets: [
      { kind: 'static', x: R.spawnX + 1, y: R.frameUp, r: 0.5 },
      { kind: 'static', x: R.palisadeX, y: 0.5, r: 0.5 },
    ],
  }
  const role: Role[] = Array.from({ length: w.targets.length }, () => 'none')
  role[0] = 'anchor'
  const lives = palisadeLives(o.watch)
  return {
    w, waves: bakeWaves(o.seed >>> 0, o.sev), wave: -1, phase: 'pause', waveT: 0, next: 0, pauseLeft: R.startDelay,
    lives, livesMax: lives, special: 'basic', specialLeft: 0,
    role, barrelArrow: role.map(() => 'basic'), barrelBorn: role.map(() => 0),
    held: 0, shots: 0, brokeAt: Array.from({ length: lives }, () => -1), result: null, events: [],
  }
}

const now = (w: World): number => w.tick * w.dt

function put(run: PirateRun, s: Spawn): void {
  const w = run.w
  const R = P.pirate
  let t
  let role: Role
  if (s.what === 'sword') {
    t = spawnTarget(w, { kind: 'charger', x: s.x, y: 0, speed: s.speed })
    role = 'sword'
  } else if (s.what === 'archer') {
    t = spawnTarget(w, { kind: 'archer', x: s.x, y: R.boatDeck + R.archerUp, r: R.archerR, firePeriod: R.archerEvery, fireDelay: now(w) + R.archerDelay + s.delay })
    role = 'archer'
  } else if (s.what === 'captain') {
    // 두목 — 쏘지 않는 사람(첫 발을 판 끝 너머로 미룬다) · 몸통 여러 발, 머리는 한 발
    t = spawnTarget(w, { kind: 'archer', x: s.x, y: R.captainR, r: R.captainR, hp: R.captainHp, fireDelay: 1e9, firePeriod: 1e9 })
    role = 'captain'
  } else {
    t = spawnTarget(w, { kind: 'bonus', x: s.x, y: R.barrelY, r: R.barrelR, give: 0 })
    role = 'barrel'
    run.barrelArrow[t.id] = s.arrow
    run.barrelBorn[t.id] = now(w)
  }
  while (run.role.length <= t.id) { run.role.push('none'); run.barrelArrow.push('basic'); run.barrelBorn.push(0) }
  run.role[t.id] = role
}

/** 이 물결의 적이 아직 남았나 (칼잡이·두목·배 궁수) */
function foesLeft(run: PirateRun): boolean {
  const ts = run.w.targets
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]!
    if (!t.alive) continue
    const r = run.role[i]
    if (r === 'sword' || r === 'captain' || r === 'archer') return true
  }
  return false
}

function finish(run: PirateRun, won: boolean): void {
  run.phase = 'end'
  run.result = { won, held: run.held }
  run.events.push({ t: 'end', won, held: run.held })
  cancelDraw(run.w)
}

/** 판의 한 고정 스텝 — 활터 step 하나와 이 판의 규칙 */
export function stepPirate(run: PirateRun, input: InputFrame): void {
  if (run.phase === 'end') return
  const w = run.w
  const R = P.pirate
  const dt = w.dt

  // ── 물결 ──
  if (run.phase === 'pause') {
    run.pauseLeft -= dt
    if (run.pauseLeft <= 0) {
      run.wave++
      run.phase = 'fight'
      run.waveT = 0
      run.next = 0
      run.events.push({ t: 'wave', k: run.wave })
    }
  }
  if (run.phase === 'fight') {
    const sp = run.waves[run.wave]!.spawns
    while (run.next < sp.length && sp[run.next]!.at <= run.waveT) put(run, sp[run.next++]!)
    run.waveT += dt
  }

  // ── 스스로 움직이는 것 — 두목은 걷고, 궤짝은 물결에 밀려와 물가에서 떠 있다 ──
  const time = now(w)
  for (let i = 0; i < w.targets.length; i++) {
    const t = w.targets[i]!
    if (!t.alive) continue
    const r = run.role[i]
    if (r === 'captain') {
      t.x -= R.captainSpeed * dt
      t.baseX = t.x
    } else if (r === 'barrel') {
      if (t.x > R.shoreX + R.barrelR) t.x -= R.barrelSpeed * dt
      t.baseX = t.x
      t.y = t.baseY + Math.sin((time + i) * R.barrelBobHz * Math.PI * 2) * R.barrelBob
      if (time - run.barrelBorn[i]! > R.barrelLife) t.alive = false
    }
  }

  const evStart = w.events.length
  step(w, input)

  // 끝없는 살 · 적 화살은 목숨이 아니라 움찔 (목숨은 목책뿐이다)
  w.arrowsLeft = ARROWS
  w.hp = Math.floor(P.enemy.hpMax)
  if (w.status !== 'playing') w.status = 'playing'
  for (let i = evStart; i < w.events.length; i++) {
    const e = w.events[i]!
    if (e.t === 'release') run.shots++
    else if (e.t === 'player_hit') {
      cancelDraw(w)
      run.events.push({ t: 'flinch' })
    } else if (e.t === 'hit' && run.role[e.targetId] === 'barrel') {
      const a = run.barrelArrow[e.targetId] ?? 'pierce'
      run.special = a
      run.specialLeft = R.specialSec
      armArrow(w, a)
      run.role[e.targetId] = 'none'
      run.events.push({ t: 'arm', arrow: a, x: e.x, y: e.y })
    }
  }
  // 죽은 자리는 역할을 내려놓는다 (다시 쓰일 자리)
  for (let i = 0; i < w.targets.length; i++) if (!w.targets[i]!.alive && run.role[i] !== 'none' && run.role[i] !== 'anchor') run.role[i] = 'none'

  // ── 궤짝 살의 시간 ──
  if (run.special !== 'basic') {
    run.specialLeft -= dt
    if (run.specialLeft <= 0) {
      run.special = 'basic'
      run.specialLeft = 0
      armArrow(w, 'basic')
      run.events.push({ t: 'unarm' })
    }
  }

  // ── 목책 — 닿은 도적은 목책을 부수고 사라진다 ──
  for (let i = 0; i < w.targets.length; i++) {
    const t = w.targets[i]!
    const r = run.role[i]
    if (!t.alive || (r !== 'sword' && r !== 'captain')) continue
    if (t.x > R.palisadeX) continue
    t.alive = false
    run.role[i] = 'none'
    const n = Math.min(run.lives, r === 'captain' ? Math.round(R.captainBreak) : 1)
    for (let k = 0; k < n; k++) run.brokeAt[run.livesMax - run.lives + k] = time
    run.lives -= n
    run.events.push({ t: 'break', x: R.palisadeX, left: run.lives, n })
    if (run.lives <= 0) {
      finish(run, false)
      return
    }
  }

  // ── 물결을 다 막았나 ──
  if (run.phase === 'fight' && run.next >= run.waves[run.wave]!.spawns.length && !foesLeft(run)) {
    run.held = run.wave + 1
    run.events.push({ t: 'clear', k: run.wave })
    if (run.held >= WAVE_COUNT) finish(run, true)
    else {
      run.phase = 'pause'
      run.pauseLeft = R.pause
    }
  }
}
