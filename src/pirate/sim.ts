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
import { armArrow, armBow, cancelDraw, createWorld, reserveTargets, spawnTarget, step } from '../sim/world.ts'
import type { ArrowKindId, BowMods, InputFrame, StageDef, World } from '../sim/types.ts'
import { drawTimeFor } from '../night/sim.ts'
import { archerStr, bakeWaves, palisadeLives, WAVE_COUNT, type Mode, type Spawn, type Wave } from './waves.ts'

export type Role = 'none' | 'anchor' | 'sword' | 'shield' | 'captain' | 'archer' | 'barrel'

/** 물결 사이에 고르는 것 — 늘 이 셋 (난수 없음) */
export type PickId = 'fire' | 'repair' | 'draw'
export const PICKS: readonly PickId[] = ['fire', 'repair', 'draw']
/** 화전 한 물결의 살 (궤짝의 화전과 같다) */
const FIRE: ArrowKindId = 'burst'

/** 판이 내는 사건 — 화면·소리가 읽고 비운다 */
export type PirateEv =
  | { readonly t: 'wave'; readonly k: number }
  | { readonly t: 'clear'; readonly k: number }
  | { readonly t: 'break'; readonly x: number; readonly left: number; readonly n: number }
  | { readonly t: 'arm'; readonly arrow: ArrowKindId; readonly x: number; readonly y: number }
  | { readonly t: 'unarm' }
  | { readonly t: 'pick' }
  | { readonly t: 'picked'; readonly id: PickId }
  | { readonly t: 'shield_break'; readonly x: number; readonly y: number }
  | { readonly t: 'flinch' }
  | { readonly t: 'end'; readonly won: boolean; readonly held: number; readonly perfect: boolean }

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
  /** 판의 갈래 — 없으면 바다 도적 */
  readonly mode?: Mode
}

export interface PirateRun {
  readonly w: World
  readonly mode: Mode
  readonly waves: readonly Wave[]
  /** 지금 물결 (0~2) · 첫 물결 전에는 −1 */
  wave: number
  phase: 'pause' | 'fight' | 'pick' | 'end'
  /** 물결이 열린 뒤 흐른 초 */
  waveT: number
  /** 이 물결에서 다음에 나올 것의 차례 */
  next: number
  /** 쉬는 시간이 남은 초 */
  pauseLeft: number
  lives: number
  livesMax: number
  /** 목책 바탕 수 — 고쳐서 늘어도 이 +1 까지 */
  readonly livesBase: number
  /** 물결 사이 고르기 — 남은 초 · 고른 것들 (판 기록) */
  pickLeft: number
  readonly picks: PickId[]
  /** 이 물결 내내 화전 (화전 한 물결을 골랐다) */
  fireWave: boolean
  /** 몸통을 더 맞아도 되는 수가 남은 방패 (자리마다) */
  readonly shieldLeft: number[]
  /** 부서진 목책 수 (고쳐도 줄지 않는다 · 흠 없이 막았나) */
  broken: number
  /** 물결 셋을 다 막고 목책이 한 칸도 안 부서졌다 — 두목을 사로잡는다 */
  perfect: boolean
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
  const mode: Mode = o.mode ?? 'pirate'
  const role: Role[] = Array.from({ length: w.targets.length }, () => 'none')
  role[0] = 'anchor'
  const lives = palisadeLives(o.watch)
  return {
    w, mode, waves: bakeWaves(o.seed >>> 0, o.sev, mode), wave: -1, phase: 'pause', waveT: 0, next: 0, pauseLeft: R.startDelay,
    lives, livesMax: lives, livesBase: lives, pickLeft: 0, picks: [], fireWave: false, shieldLeft: role.map(() => 0), broken: 0, perfect: false,
    special: 'basic', specialLeft: 0,
    role, barrelArrow: role.map(() => 'basic'), barrelBorn: role.map(() => 0),
    held: 0, shots: 0, brokeAt: Array.from({ length: lives }, () => -1), result: null, events: [],
  }
}

const now = (w: World): number => w.tick * w.dt

function shieldAt(run: PirateRun, id: number, n: number): void {
  while (run.shieldLeft.length <= id) run.shieldLeft.push(0)
  run.shieldLeft[id] = n
}

function put(run: PirateRun, s: Spawn): void {
  const w = run.w
  const R = P.pirate
  let t
  let role: Role
  if (s.what === 'sword') {
    t = spawnTarget(w, { kind: 'charger', x: s.x, y: 0, speed: s.speed })
    role = 'sword'
  } else if (s.what === 'shield') {
    // 방패 든 도적 — 두목처럼 걷는 사람(archer 꼴) · 방패가 몸통을 막는다. 몸통 shieldHits 번에 방패가 깨지고 머리는 한 발
    t = spawnTarget(w, { kind: 'archer', x: s.x, y: R.shieldR, r: R.shieldR, hp: 1, armored: true, fireDelay: 1e9, firePeriod: 1e9 })
    t.armorHp = 1e6 // 방패는 맞은 수로만 깨진다 (아래 stepPirate)
    t.armorMax = 1e6
    t.speed = s.speed
    role = 'shield'
    shieldAt(run, t.id, R.shieldHits)
  } else if (s.what === 'archer') {
    const deck = run.mode === 'bandit' ? R.ridgeDeck : R.boatDeck
    t = spawnTarget(w, { kind: 'archer', x: s.x, y: deck + R.archerUp, r: R.archerR, firePeriod: R.archerEvery, fireDelay: now(w) + R.archerDelay + s.delay })
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
    if (r === 'sword' || r === 'shield' || r === 'captain' || r === 'archer') return true
  }
  return false
}

function finish(run: PirateRun, won: boolean): void {
  run.phase = 'end'
  run.result = { won, held: run.held }
  run.perfect = won && run.held >= WAVE_COUNT && run.broken === 0
  run.events.push({ t: 'end', won, held: run.held, perfect: run.perfect })
  cancelDraw(run.w)
}

/** 목책 하나 고친다 — 부서진 것이 있으면 그것을, 없으면 바탕 +1 까지 한 칸 더 */
function addLife(run: PirateRun): void {
  if (run.lives >= run.livesBase + 1) return
  if (run.lives < run.livesMax) run.brokeAt[run.livesMax - run.lives - 1] = -1
  else { run.livesMax++; run.brokeAt.push(-1) }
  run.lives++
}

/** 물결 사이 고르기 — 화면이 누르거나 (고르는 중에만) 시간이 다 되어 저절로 부른다 */
export function pickBoon(run: PirateRun, id: PickId): void {
  if (run.phase !== 'pick') return
  const R = P.pirate
  run.picks.push(id)
  if (id === 'fire') run.fireWave = true
  else if (id === 'repair') for (let i = 0; i < Math.round(R.pickLife); i++) addLife(run)
  else armBow(run.w, { ...run.w.bow, drawTimeMul: run.w.bow.drawTimeMul * R.pickDrawMul })
  run.events.push({ t: 'picked', id })
  run.phase = 'pause'
  run.pauseLeft = R.pause
}

/** 판의 한 고정 스텝 — 활터 step 하나와 이 판의 규칙 */
export function stepPirate(run: PirateRun, input: InputFrame & { readonly cap?: number; readonly cancel?: boolean }): void {
  if (run.phase === 'end') return
  const w = run.w
  const R = P.pirate
  const dt = w.dt

  // ── 물결 사이 고르기 — 판이 멈춘다 (시간만 흐른다 · 다 되면 첫째) ──
  if (run.phase === 'pick') {
    run.pickLeft -= dt
    // 궤짝 살의 시간은 고르는 동안에도 흐른다 (쉬는 틈이 살을 늘려 주지 않는다)
    if (run.special !== 'basic') {
      run.specialLeft -= dt
      if (run.specialLeft <= 0) { run.special = 'basic'; run.specialLeft = 0; armArrow(w, 'basic'); run.events.push({ t: 'unarm' }) }
    }
    if (run.pickLeft <= 0) pickBoon(run, PICKS[0]!)
    return
  }

  // ── 물결 ──
  if (run.phase === 'pause') {
    run.pauseLeft -= dt
    if (run.pauseLeft <= 0) {
      run.wave++
      run.phase = 'fight'
      run.waveT = 0
      run.next = 0
      run.events.push({ t: 'wave', k: run.wave })
      if (run.fireWave) { run.special = FIRE; run.specialLeft = R.specialSec; armArrow(w, FIRE); run.events.push({ t: 'arm', arrow: FIRE, x: R.palisadeX, y: 1 }) }
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
    } else if (r === 'shield') {
      t.x -= t.speed * dt
      t.baseX = t.x
    } else if (r === 'barrel') {
      if (t.x > R.shoreX + R.barrelR) t.x -= R.barrelSpeed * dt
      t.baseX = t.x
      t.y = t.baseY + (run.mode === 'bandit' ? 0 : 1) * Math.sin((time + i) * R.barrelBobHz * Math.PI * 2) * R.barrelBob
      if (time - run.barrelBorn[i]! > R.barrelLife) t.alive = false
    }
  }

  // 당겨 쏘기(night/input.ts · 형 11-11: 디펜스 때 쏘는 방식이 암살 때와 정반대라 짜증) — 끈 몫(cap)이 당김의 상한 · 고리 안에서 놓으면 그만둔다 (night/sim.ts shootStep 과 같은 셈)
  {
    const a = w.archer
    if (input.cancel === true) cancelDraw(w)
    const cap = input.cap
    if (cap !== undefined && cap < 1 && (a.phase === 'drawing' || a.phase === 'full')) {
      const lim = drawTimeFor(w, cap) - w.dt
      if (a.phase === 'full') { a.phase = 'drawing'; a.holdTime = 0 }
      if (a.drawTime > lim) a.drawTime = lim > 0 ? lim : 0
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
    else if (e.t === 'hit' && run.role[e.targetId] === 'shield' && !e.head) {
      // 몸통은 방패가 받는다 — 정해진 수만큼 맞으면 방패가 깨지고, 그 뒤엔 몸통도 통한다
      const id = e.targetId
      const left = (run.shieldLeft[id] ?? 0) - 1
      run.shieldLeft[id] = left
      const t = w.targets[id]!
      if (left <= 0 && t.alive && t.armored) {
        t.armored = false
        t.armorHp = 0
        t.armorMax = 0
        w.events.push({ t: 'armor_break', x: t.x, y: t.y })
        run.events.push({ t: 'shield_break', x: t.x, y: t.y })
      }
    }
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
    // 화전 한 물결 — 이 물결 내내 화전이 이어진다 (궤짝 살을 쥐고 있던 틈이 지나면 다시 화전)
    if (run.fireWave && run.special === FIRE) run.specialLeft = R.specialSec
    else run.specialLeft -= dt
    if (run.specialLeft <= 0) {
      const back: ArrowKindId = run.fireWave ? FIRE : 'basic'
      run.special = back
      run.specialLeft = back === 'basic' ? 0 : R.specialSec
      armArrow(w, back)
      run.events.push(back === 'basic' ? { t: 'unarm' } : { t: 'arm', arrow: back, x: R.palisadeX, y: 1 })
    }
  }

  // ── 목책 — 닿은 도적은 목책을 부수고 사라진다 ──
  for (let i = 0; i < w.targets.length; i++) {
    const t = w.targets[i]!
    const r = run.role[i]
    if (!t.alive || (r !== 'sword' && r !== 'shield' && r !== 'captain')) continue
    if (t.x > R.palisadeX) continue
    t.alive = false
    run.role[i] = 'none'
    const n = Math.min(run.lives, r === 'captain' ? Math.round(R.captainBreak) : 1)
    for (let k = 0; k < n; k++) run.brokeAt[run.livesMax - run.lives + k] = time
    run.lives -= n
    run.broken += n
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
      // 화전 한 물결은 끝났다 · 판이 멈추고 셋 가운데 하나를 고른다
      if (run.fireWave) { run.fireWave = false; run.special = 'basic'; run.specialLeft = 0; armArrow(w, 'basic'); run.events.push({ t: 'unarm' }) }
      cancelDraw(w)
      run.phase = 'pick'
      run.pickLeft = R.pickAutoS
      run.events.push({ t: 'pick' })
    }
  }
}
