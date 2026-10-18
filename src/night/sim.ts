/**
 * 밤의 암살판 — 판의 흐름 (docs/realm/SNIPE.md §0)
 *
 * 활의 손맛은 활터의 것을 **그대로 빌린다**: 당김·떨림·빨간 바는 sim/bow.ts stepArcher, 탄도는
 * sim/ballistics.ts stepArrows. 활터의 과녁(w.targets)은 비워 두고, 밤의 형체·불·담·창호지에
 * 화살이 닿는 일만 여기서 판정한다 — 그래서 활터 코드는 한 줄도 안 바뀐다.
 *
 * 결정론 (A1): 시계는 틱뿐, 굴림은 layout 의 이름 붙은 주사위뿐. 같은 시드 · 같은 입력 열 = 같은 결과.
 * 숫자는 P.night (tune/params.ts).
 */
import { clamp01, distSqPointSegment, valueNoise } from '../core/math.ts'
import { P } from '../tune/params.ts'
import { stepArrows } from '../sim/ballistics.ts'
import { stepArcher } from '../sim/bow.ts'
import { cancelDraw, createWorld } from '../sim/world.ts'
import type { InputFrame, StageDef, World } from '../sim/types.ts'
import { bakeScene, STAGE_COUNT, type Figure, type Light, type Scene } from './layout.ts'

export type Phase = 'play' | 'move' | 'rise' | 'chief' | 'alarm' | 'end'

/** 꽂힌 살 — 형체에 꽂혔으면 그 형체의 발을 기준으로 (쓰러질 때 같이 눕는다) */
export interface Stuck {
  x: number
  y: number
  angle: number
  fig: number
}

export type NightEventKind =
  | 'head' | 'body' | 'leg' // 보초를 맞혔다
  | 'chief' // 적장을 맞혔다
  | 'ground' | 'wall' | 'tile' | 'paper' | 'lamp' // 살이 맞은 곳 (소리)
  | 'notice' // 보초가 시체를 알아챘다
  | 'drum' // 경보
  | 'stage' // 다음 판
  | 'rise' // 적장 그림자가 일어선다
  | 'flee' // 적장이 촛불을 끄고 사라졌다

export interface NightEvent {
  readonly t: NightEventKind
  readonly x: number
  readonly y: number
}

export interface NightResult {
  readonly result: 'dead' | 'wounded' | 'fled' | 'withdrew' | 'cleared'
  readonly alarm: boolean
  readonly arrowsLeft: number
  /** 닿은 판 (0 부터) */
  readonly stage: number
}

/** 연습장 (형: "궁술연습장도 만들어서 아무때나 해볼수 있게") — 판 하나만 · 화살 무한 · 게이지는 켜고 끈다 */
export interface Practice {
  readonly stage: number
  readonly alarm: boolean
  readonly infinite: boolean
}

export interface NightOpts {
  readonly seed: number
  readonly arrows?: number
  readonly practice?: Practice
}

export interface Night {
  readonly seed: number
  readonly practice: Practice | null
  readonly w: World
  scene: Scene
  stage: number
  phase: Phase
  /** 지금 phase 가 시작된 틱 */
  phaseAt: number
  tick: number
  /** 발각 게이지 0..1 — 1 이면 경보 */
  alarm: number
  stuck: Stuck[]
  events: NightEvent[]
  result: NightResult | null
  /** 적장이 선 틱 — 그 뒤에 쏜 살이 빗나가면 달아난다 */
  chiefUp: number
  /** 쏜 살 · 맞힌 살 · 머리 — 연습장 기록 */
  shots: number
  hits: number
  heads: number
  /** 창호지를 이미 찢은 살 (한 살에 한 번만 소리) — 살이 사라지면 지운다 */
  readonly tore: Set<number>
}

/** 이 무한 화살 수 밑으로 내려가면 다시 채운다 (연습장) */
const INFINITE = 999

function stageDef(seed: number, arrows: number): StageDef {
  const g = -P.night.roofHeight
  // 궁수 발밑(지붕)은 0, 처마 끝(x 2) 너머는 마당 — 활터의 꺾은선 땅 그대로 (sim/terrain.ts)
  return {
    id: 'night', seed, arrows, targetScore: 0, wind: 0, targets: [],
    ground: [{ x: 2, y: 0 }, { x: 2.3, y: g }, { x: 400, y: g }],
  }
}

export function createNight(o: NightOpts): Night {
  const lv = P.night.stat
  const practice = o.practice ?? null
  const arrows = practice?.infinite === true ? INFINITE : Math.max(1, Math.round(o.arrows ?? P.night.arrows))
  const w = createWorld(stageDef(o.seed, arrows), { str: lv, steady: lv, stamina: lv, focus: lv }, 'basic')
  const stage = practice !== null ? practice.stage : 0
  return {
    seed: o.seed, practice, w, scene: bakeScene(o.seed, stage), stage, phase: 'play', phaseAt: 0, tick: 0,
    alarm: 0, stuck: [], events: [], result: null, chiefUp: -1, shots: 0, hits: 0, heads: 0, tore: new Set(),
  }
}

// ───────────────────────── 형체의 몸 (판정과 그리기가 같은 식을 쓴다) ─────────────────────────

export interface Parts {
  hx: number; hy: number; hr: number
  t0x: number; t0y: number; t1x: number; t1y: number; tr: number
  l0x: number; l0y: number; l1x: number; l1y: number; lr: number
}

export const newParts = (): Parts => ({ hx: 0, hy: 0, hr: 0, t0x: 0, t0y: 0, t1x: 0, t1y: 0, tr: 0, l0x: 0, l0y: 0, l1x: 0, l1y: 0, lr: 0 })

/** 선 몸의 자리 — `rise` 0 = 앉음, 1 = 섬 (적장이 일어서는 동안 사이) */
export function partsOf(f: Figure, out: Parts, rise = f.pose === 'sit' ? 0 : 1): Parts {
  const s = f.size
  const lerp = (a: number, b: number): number => a + (b - a) * rise
  out.hr = P.night.headR * s
  out.tr = P.night.torsoR * s
  out.lr = P.night.legR * s
  // 몸통 캡슐의 위 끝(t1y + tr)이 머리 원의 아래 끝(hy − hr)보다 낮아야 머리를 노릴 틈이 생긴다
  out.hx = f.x
  out.hy = f.y + lerp(1.16, 1.6) * s
  out.t0x = f.x
  out.t0y = f.y + lerp(0.52, 0.92) * s
  out.t1x = f.x
  out.t1y = f.y + lerp(0.82, 1.24) * s
  out.l0x = f.x
  out.l0y = f.y + 0.05 * s
  // 앉으면 무릎이 앞으로 나온다
  out.l1x = f.x + lerp(0.36 * f.facing, 0) * s
  out.l1y = f.y + lerp(0.45, 0.86) * s
  return out
}

/** 서 있는 몸의 무게중심 높이 — 시체가 보이는가를 이 점의 밝기로 잰다 */
const CHEST = 0.6

// ───────────────────────── 빛 ─────────────────────────

export function lightRadius(l: Light): number {
  switch (l.kind) {
    case 'torch': return P.night.lightTorch
    case 'lantern': return P.night.lightLantern
    case 'fire': return P.night.lightFire
    case 'candle': return P.night.lightCandle
  }
}

/** 불꽃의 깜빡임 0..1 근처 — 틱만 본다 (결정론) */
export function flicker(l: Light, tick: number): number {
  const t = tick / P.sim.hz
  return 1 - P.night.flickerAmp * 0.5 + P.night.flickerAmp * 0.5 * valueNoise(t * P.night.flickerFreq, 0x2f1 + l.id * 97)
}

/** 이 자리의 밝기 0..1 — 켜진 불 가운데 가장 밝은 것 */
export function lightAt(scene: Scene, x: number, y: number, tick: number): number {
  let best = 0
  for (const l of scene.lights) {
    if (!l.lit) continue
    const r = lightRadius(l)
    const d = Math.hypot(x - l.x, y - l.y)
    if (d >= r) continue
    const v = Math.pow(1 - d / r, 1.3) * flicker(l, tick)
    if (v > best) best = v
  }
  return best
}

// ───────────────────────── 한 틱 ─────────────────────────

const dt = (): number => 1 / P.sim.hz
const secs = (n: Night, from: number): number => (n.tick - from) / P.sim.hz

function setPhase(n: Night, p: Phase): void {
  n.phase = p
  n.phaseAt = n.tick
}

function finish(n: Night, result: NightResult['result']): void {
  if (n.result !== null) return
  n.result = { result, alarm: n.alarm >= 1, arrowsLeft: n.practice?.infinite === true ? 0 : n.w.arrowsLeft, stage: n.stage }
  cancelDraw(n.w)
  setPhase(n, 'end')
}

/** 소리 — 가장 가까운 살아 있는 보초가 듣는 만큼 게이지에 */
function noise(n: Night, amount: number, x: number): void {
  if (amount <= 0 || n.practice?.alarm === false) return
  let prox = -1
  for (const f of n.scene.figures) {
    if (!f.alive || f.role !== 'guard') continue
    const p = clamp01(1 - Math.abs(f.x - x) / P.night.hearRange)
    if (p > prox) prox = p
  }
  if (prox < 0) return // 들을 보초가 없다
  n.alarm += amount * (P.night.hearFloor + (1 - P.night.hearFloor) * prox)
}

function movePatrols(n: Night): void {
  const t = n.tick / P.sim.hz
  for (const f of n.scene.figures) {
    if (!f.alive || f.patrol === null || f.watching > 0) continue
    const span = Math.max(0.1, f.patrol.x1 - f.patrol.x0)
    // 왕복 — 0..2 를 도는 삼각파
    const u = (f.patrol.phase * 2 + (t * f.patrol.speed) / span) % 2
    const back = u > 1
    f.x = f.patrol.x0 + span * (back ? 2 - u : u)
    f.facing = back ? -1 : 1
  }
  // 든 불은 사람을 따라간다 — 쓰러지면 땅에 떨어진다
  for (const l of n.scene.lights) {
    if (l.carrier < 0) continue
    const f = n.scene.figures[l.carrier]
    if (f === undefined) continue
    if (f.alive) {
      l.x = f.x + 0.32 * f.facing
      l.y = f.y + 1.02 * f.size
    } else {
      l.y = n.scene.ground + 0.15
    }
  }
}

const parts = newParts()

/** 점이 형체의 어디에 들었나 */
function zoneAt(f: Figure, x: number, y: number, rise: number): 'head' | 'body' | 'leg' | null {
  partsOf(f, parts, f.role === 'chief' ? rise : undefined)
  if ((x - parts.hx) ** 2 + (y - parts.hy) ** 2 <= parts.hr * parts.hr) return 'head'
  if (distSqPointSegment(x, y, parts.t0x, parts.t0y, parts.t1x, parts.t1y) <= parts.tr * parts.tr) return 'body'
  if (distSqPointSegment(x, y, parts.l0x, parts.l0y, parts.l1x, parts.l1y) <= parts.lr * parts.lr) return 'leg'
  return null
}

/** 살 하나의 이번 틱 선분을 앞에서부터 훑는다. 무엇에 닿았으면 참 */
function sweep(n: Night, ax: number, ay: number, bx: number, by: number, angle: number, tore: Set<number>, id: number): 'hit' | 'stop' | null {
  const sc = n.scene
  const len = Math.hypot(bx - ax, by - ay)
  const steps = Math.max(1, Math.ceil(len / 0.05))
  const rise = n.phase === 'rise' ? clamp01(secs(n, n.phaseAt) / P.night.chiefRise) : n.phase === 'chief' ? 1 : 0
  const chiefShown = n.phase === 'rise' || n.phase === 'chief'
  for (let i = 0; i <= steps; i++) {
    const x = ax + ((bx - ax) * i) / steps
    const y = ay + ((by - ay) * i) / steps
    // 사람
    for (const f of sc.figures) {
      if (!f.alive) continue
      if (f.role === 'chief' && !chiefShown) continue
      const z = zoneAt(f, x, y, rise)
      if (z === null) continue
      f.alive = false
      f.downAt = n.tick
      f.hitZone = z
      n.stuck.push({ x: x - f.x, y: y - f.y, angle, fig: f.id })
      n.hits++
      if (z === 'head') n.heads++
      if (f.role === 'chief') {
        n.events.push({ t: 'chief', x, y })
        finish(n, z === 'head' ? 'dead' : 'wounded')
      } else {
        n.events.push({ t: z, x, y })
        noise(n, z === 'head' ? 0 : z === 'body' ? P.night.noiseGroan : P.night.noiseScream, f.x)
      }
      return 'hit'
    }
    // 불 — 맞히면 꺼진다 (창호지 뒤 촛불은 문 너머라 안 닿는다)
    for (const l of sc.lights) {
      if (!l.lit || l.kind === 'candle') continue
      const r = l.kind === 'fire' ? 0.35 : 0.17
      if ((x - l.x) ** 2 + (y - l.y) ** 2 > r * r) continue
      if (l.kind === 'fire') break // 모닥불은 살 하나로 안 꺼진다 — 땅에 꽂히는 것과 같다
      l.lit = false
      n.events.push({ t: 'lamp', x, y })
      noise(n, P.night.noiseLamp, x)
      n.stuck.push({ x, y, angle, fig: -1 })
      return 'stop'
    }
    // 담·기둥·기와
    for (const s of sc.solids) {
      if (x < s.x0 || x > s.x1 || y < s.y0 || y > s.y1) continue
      const t = s.kind === 'tile' ? 'tile' : 'wall'
      n.events.push({ t, x, y })
      noise(n, s.kind === 'tile' ? P.night.noiseTile : P.night.noiseWall, x)
      n.stuck.push({ x, y, angle, fig: -1 })
      return 'stop'
    }
    // 창호지 — 뚫고 지나간다. 적장이 서기 전이면 찢는 소리가 난다
    const d = sc.door
    if (d !== null && !tore.has(id) && x >= d.x0 && x <= d.x1 && y >= d.y0 && y <= d.y1) {
      tore.add(id)
      if (!chiefShown) {
        n.events.push({ t: 'paper', x, y })
        noise(n, P.night.noisePaper, x)
      }
    }
  }
  return null
}

/** 빛 안의 시체를 앞을 보는 보초가 본다 */
function watch(n: Night): number {
  if (n.practice?.alarm === false) return 0
  const sc = n.scene
  let rise = 0
  for (const g of sc.figures) {
    if (!g.alive || g.role !== 'guard') continue
    let sees: Figure | null = null
    for (const c of sc.figures) {
      if (c.alive || c.role !== 'guard') continue
      const dx = c.x - g.x
      if (Math.abs(dx) > P.night.sightRange || dx * g.facing < -0.5) continue
      if (lightAt(sc, c.x, c.y + CHEST, n.tick) < P.night.corpseLight) continue
      sees = c
      break
    }
    if (sees === null) {
      g.watching = 0
      continue
    }
    const before = g.watching
    g.watching += dt()
    g.facing = sees.x >= g.x ? 1 : -1
    if (before < P.night.noticeDelay && g.watching >= P.night.noticeDelay) n.events.push({ t: 'notice', x: g.x, y: g.y + 1.9 })
    if (g.watching >= P.night.noticeDelay) rise += P.night.corpseRate * dt()
  }
  return rise
}

function anyFlying(w: World): boolean {
  for (const a of w.arrows) if (a.alive && a.outcome === 'flying') return true
  return false
}

const missSet = new Set<number>()

/** 다음 판으로 — 화살 잔량과 게이지(조금 가라앉힌 채)는 따라간다 */
function nextStage(n: Night): void {
  n.stage++
  n.scene = bakeScene(n.seed, n.stage)
  n.stuck = []
  n.alarm *= P.night.alarmCarry
  for (const a of n.w.arrows) a.alive = false
  n.tore.clear()
  n.events.push({ t: 'stage', x: 0, y: 0 })
  setPhase(n, 'play')
}

export function stepNight(n: Night, input: InputFrame): void {
  const w = n.w
  n.tick++
  w.tick++
  w.elapsed += w.dt
  const evStart = w.events.length
  const shooting = n.phase === 'play' || n.phase === 'rise' || n.phase === 'chief'
  if (shooting) stepArcher(w, input)
  else cancelDraw(w)
  stepArrows(w)

  // 이번 틱에 땅에 닿아 사라진 살 — 그 마지막 선분도 훑어야 땅 바로 위의 형체를 맞힌다
  missSet.clear()
  for (let i = evStart; i < w.events.length; i++) {
    const ev = w.events[i]
    if (ev === undefined) continue
    if (ev.t === 'miss') missSet.add(ev.arrow)
    if (ev.t === 'release') {
      n.shots++
      if (n.practice?.infinite === true && w.arrowsLeft < INFINITE) w.arrowsLeft = INFINITE
    }
  }

  movePatrols(n)

  const alarmBefore = n.alarm
  for (const a of w.arrows) {
    const landed = missSet.has(a.id)
    if (!a.alive && !landed) n.tore.delete(a.id) // 풀의 자리가 다시 쓰일 때 옛 살의 찢음이 남지 않게
    if (!landed && !(a.alive && a.outcome === 'flying')) continue
    const angle = Math.atan2(a.vy, a.vx)
    const got = sweep(n, a.px, a.py, a.x, a.y, angle, n.tore, a.id)
    if (got !== null) {
      a.alive = false
      a.outcome = 'hit'
    } else if (landed) {
      // 처마 안쪽(지붕)에 떨어지면 기와 소리, 마당이면 흙
      const roof = a.x < 2.2
      n.events.push({ t: roof ? 'tile' : 'ground', x: a.x, y: a.y })
      noise(n, roof ? P.night.noiseTile : P.night.noiseGround, a.x)
      n.stuck.push({ x: a.x, y: a.y, angle, fig: -1 })
    }
    // 적장이 선 뒤에 쏜 살이 적장을 못 맞히고 끝났다 → 촛불을 끄고 사라진다
    if (n.phase === 'chief' && (got === 'stop' || (got === null && (landed || !a.alive)))) {
      const launched = n.tick - Math.round(a.age * P.sim.hz)
      if (launched >= n.chiefUp) flee(n)
    }
  }
  n.alarm += watch(n)
  // 가라앉는 것은 판이 도는 동안만 — 북이 울린 뒤에는 그대로 (결과에 경보가 남아야 한다)
  if (n.alarm === alarmBefore && shooting && n.alarm < 1) n.alarm = Math.max(0, n.alarm - P.night.alarmDecay * dt())

  if (n.result !== null) return
  const sc = n.scene
  const guardsLeft = sc.figures.some((f) => f.role === 'guard' && f.alive)

  switch (n.phase) {
    case 'play':
      if (n.alarm >= 1) {
        n.alarm = 1
        n.events.push({ t: 'drum', x: 0, y: 0 })
        setPhase(n, 'alarm')
        cancelDraw(w)
        break
      }
      if (!guardsLeft) {
        if (sc.figures.some((f) => f.role === 'chief')) {
          n.events.push({ t: 'rise', x: 0, y: 0 })
          setPhase(n, 'rise')
        } else if (n.practice !== null || n.stage >= STAGE_COUNT - 1) {
          if (!anyFlying(w)) finish(n, 'cleared')
        } else {
          setPhase(n, 'move')
        }
        break
      }
      if (outOfArrows(n)) finish(n, 'withdrew')
      break
    case 'move':
      if (secs(n, n.phaseAt) >= P.night.moveTime) nextStage(n)
      break
    case 'rise':
      if (secs(n, n.phaseAt) >= P.night.chiefRise) {
        setPhase(n, 'chief')
        n.chiefUp = n.tick
      }
      break
    case 'chief':
      if (secs(n, n.phaseAt) >= P.night.chiefPatience || outOfArrows(n)) flee(n)
      break
    case 'alarm':
      if (secs(n, n.phaseAt) >= P.night.alarmTime) finish(n, 'fled')
      break
    case 'end':
      break
  }
}

function outOfArrows(n: Night): boolean {
  const a = n.w.archer
  return n.w.arrowsLeft <= 0 && !anyFlying(n.w) && a.phase !== 'drawing' && a.phase !== 'full'
}

function flee(n: Night): void {
  if (n.result !== null) return
  for (const l of n.scene.lights) if (l.kind === 'candle') l.lit = false
  n.events.push({ t: 'flee', x: 0, y: 0 })
  finish(n, 'fled')
}

/** 적장 그림자가 얼마나 일어섰나 0..1 — 그리기용 */
export function chiefRise(n: Night): number {
  if (n.phase === 'rise') return clamp01(secs(n, n.phaseAt) / P.night.chiefRise)
  if (n.phase === 'chief') return 1
  return n.result !== null && n.result.result !== 'fled' && n.stage === STAGE_COUNT - 1 && n.chiefUp >= 0 ? 1 : 0
}

/** 쓰러지는 몸의 기울기 0..1 */
export function fallOf(n: Night, f: Figure): number {
  return f.downAt < 0 ? 0 : clamp01(secs(n, f.downAt) / 0.45)
}

/** 다음 판으로 넘어가는 중이면 0..1 */
export function moveProgress(n: Night): number {
  return n.phase === 'move' ? clamp01(secs(n, n.phaseAt) / P.night.moveTime) : 0
}
