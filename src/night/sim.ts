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
import { effectiveStats, stepArcher } from '../sim/bow.ts'
import { flowDrawMul } from '../sim/flow.ts'
import { cancelDraw, createWorld } from '../sim/world.ts'
import type { BowMods, InputFrame, StageDef, World } from '../sim/types.ts'
import { bakeScene, guardOf, STAGE_COUNT, type Figure, type Guard, type Light, type Scene } from './layout.ts'

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
  | 'startle' // 그림자가 선 뒤 빗나간 살 — 촛불이 흔들린다 (기다림이 준다)
  | 'ember' // 모닥불에 살이 꽂혔다 (불똥)
  | 'tend' // 보초가 꺼진 불을 붙이러 간다
  | 'relit' // 다시 붙었다

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
  /** 활의 단계 0 단궁 · 1 맥궁 · 2 각궁 · 3 신궁 (형: "계단적 성장") — 없으면 0 */
  readonly bowTier?: number
  /** 경비 0 느슨 · 1 보통 · 2 삼엄 (layout.ts Guard) — 없으면 보통 */
  readonly guard?: number
}

/** 활의 단계 이름 — 화면에 그대로 */
export const BOW_NAME: readonly string[] = ['단궁', '맥궁', '각궁', '신궁']
export const BOW_TIERS = BOW_NAME.length

/**
 * 밤의 입력 — 활터의 InputFrame 에 당겨 쏘기 두 가지를 얹는다 (night/input.ts 가 쓴다).
 * 둘 다 없으면 활터와 똑같이 돈다 (시험·옛 호출자).
 */
export interface NightFrame extends InputFrame {
  /** 끈 길이로 정한 당김의 상한 0..1 (만작 한계에 대한 몫) — 1 이면 활터처럼 만작까지 */
  cap?: number
  /** 고리 안으로 돌아와 놓았다 — 쏘지 않고 활을 내린다 (이 스텝에만 true) */
  cancel?: boolean
}

/** 한 단계마다 한꺼번에 붙는 몫 — 완만하지 않게, 계단으로 */
function tierBow(t: number): BowMods {
  const N = P.night
  return {
    speedMul: 1 + N.tierSpeed * t,
    drawTimeMul: Math.pow(N.tierDraw, t),
    tremorMul: Math.pow(N.tierTremor, t),
    scatterMul: Math.pow(N.tierTremor, t),
    holdDrainMul: 1,
    maxDrawAdd: N.tierMaxDraw * t,
    windMul: 1,
    pierceAdd: 0,
  }
}

const tierOf = (x: number | undefined): number => Math.max(0, Math.min(BOW_TIERS - 1, Math.floor(x ?? 0)))

export interface Night {
  readonly seed: number
  readonly practice: Practice | null
  /** 활의 단계 (BOW_NAME) */
  readonly bowTier: number
  /** 경비 (GUARD_NAME) */
  readonly guard: Guard
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
  /** 적장이 선 틱 — 그 뒤에 쏜 살이 빗나가면 기다림이 준다 */
  chiefUp: number
  /** 적장이 촛불을 끄기까지 남은 기다림 (s) — 빗나간 살마다 chiefMissCut 만큼 준다 */
  chiefLeft: number
  /** 쏜 살 · 맞힌 살 · 머리 — 연습장 기록 */
  shots: number
  hits: number
  heads: number
  /** 창호지를 이미 찢은 살 (한 살에 한 번만 소리) — 살이 사라지면 지운다 */
  readonly tore: Set<number>
}

/** 밤의 형체가 활터 명중 사건에 쓰는 과녁 번호 — 활터 과녁(0 부터)과 안 겹치게 음수로 (NIGHT_TARGET − 형체 번호) */
const NIGHT_TARGET = -1000

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
  const tier = tierOf(o.bowTier)
  const lv = P.night.stat + P.night.tierStat * tier
  const practice = o.practice ?? null
  const arrows = practice?.infinite === true ? INFINITE : Math.max(1, Math.round(o.arrows ?? P.night.arrows) + P.night.tierArrows * tier)
  const w = createWorld(stageDef(o.seed, arrows), { str: lv, steady: lv, stamina: lv, focus: lv }, 'basic', tierBow(tier))
  const stage = practice !== null ? practice.stage : 0
  const guard = guardOf(o.guard ?? 1)
  return {
    seed: o.seed, practice, bowTier: tier, guard, w, scene: bakeScene(o.seed, stage, guard), stage, phase: 'play', phaseAt: 0, tick: 0,
    alarm: 0, stuck: [], events: [], result: null, chiefUp: -1, chiefLeft: P.night.chiefPatience, shots: 0, hits: 0, heads: 0, tore: new Set(),
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
    case 'fire': return P.night.lightFire * (1 - (P.night.fireDim * l.hits) / Math.max(1, P.night.fireHits))
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

/** 순찰의 지금 자리 — 왕복 0..2 삼각파 */
function patrolX(f: Figure): number {
  const p = f.patrol!
  const span = Math.max(0.1, p.x1 - p.x0)
  return p.x0 + span * (f.pu > 1 ? 2 - f.pu : f.pu)
}

function movePatrols(n: Night): void {
  for (const f of n.scene.figures) {
    if (!f.alive || f.patrol === null || f.watching > 0 || f.task !== null) continue
    const span = Math.max(0.1, f.patrol.x1 - f.patrol.x0)
    f.pu = (f.pu + (dt() * f.patrol.speed) / span) % 2
    f.x = patrolX(f)
    f.facing = f.pu > 1 ? -1 : 1
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
      // 활터의 명중 사건을 그대로 낸다 — 활터의 소리(신음·헤드샷)·불꽃·히트스톱·남는 궤적이 이걸 읽는다.
      // 머리는 소리 없이 쓰러진다(신음 없음 = execute) — 밤의 소음 규칙(noise 0)과 같다.
      n.w.events.push({
        t: 'hit', targetId: NIGHT_TARGET - f.id, x, y, score: 0, accuracy: 0, chain: 0, combo: 0,
        head: z === 'head', foe: true, dmg: 0, execute: z === 'head', arrow: id,
      })
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
      hitLight(n, l, x, y)
      if (l.kind !== 'fire') n.stuck.push({ x, y, angle, fig: -1 }) // 모닥불에 든 살은 타 버린다
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

/**
 * 살이 불에 닿았다 — 횃불·등불은 꺼지고, 모닥불은 살 fireHits 개에 사그라든다 (그 전엔 불똥 소리만).
 * 경비가 삼엄하면 불이 꺼지는 것만으로 수상히 여긴다 (darkSuspect)
 */
export function hitLight(n: Night, l: Light, x: number, y: number): void {
  if (l.kind === 'fire') {
    l.hits++
    n.events.push({ t: 'ember', x, y })
    noise(n, P.night.noiseFire, x)
    if (l.hits < P.night.fireHits) return
  }
  l.lit = false
  n.events.push({ t: 'lamp', x, y })
  noise(n, P.night.noiseLamp, x)
  if (n.guard >= 2 && n.practice?.alarm !== false) n.alarm += P.night.darkSuspect
}

/** 경비 단계의 몫 — 느슨 · 보통(1) · 삼엄 */
const byGuard = (n: Night, loose: number, tight: number): number => (n.guard === 0 ? loose : n.guard === 2 ? tight : 1)

/** 이 불을 다시 붙이는 데 걸리는 시간 (s) */
export function relightSecs(n: Night, l: Light): number {
  return P.night.relightTime * (l.kind === 'fire' ? P.night.relightFire : 1) * byGuard(n, P.night.relightLoose, P.night.relightTight)
}

/** 한 걸음 — 닿았으면 참 */
function walkTo(f: Figure, x: number): boolean {
  const step = P.night.patrolSpeed * P.night.tendWalk * dt()
  const d = x - f.x
  if (Math.abs(d) <= step) {
    f.x = x
    return true
  }
  f.facing = d > 0 ? 1 : -1
  f.x += step * f.facing
  return false
}

/**
 * 꺼진 불을 다시 붙인다 (형: "불꺼지면 경비들은 불키러 가야하는거 아님?") — 판이 도는 동안 틱마다.
 *  ① 맡은 보초: 불 옆까지 걸어가(go) · 붙이고(light, 게이지) · 제자리로(back). 시체를 보면 멈춰 선다
 *  ② 아무도 안 맡은 꺼진 불: 든 사람이 살아 있으면 그 자리에서, 아니면 가장 가까운 한가한 보초가 간다
 * 그래서 불을 끄면 보초가 어둠 속으로 혼자 걸어 나온다 — 거기서 쓰러뜨리면 아무도 못 본다.
 * 다 붙이기 전에 쓰러뜨리지 못하면 불이 돌아와 그 옆의 시체가 보인다.
 */
function tendLights(n: Night): void {
  const sc = n.scene
  for (const f of sc.figures) {
    const t = f.task
    if (t === null) continue
    if (!f.alive) {
      f.task = null
      continue
    }
    const l = sc.lights[t.light]
    if (l === undefined) {
      f.task = null
      continue
    }
    if (t.step === 'go') {
      if (f.watching > 0) continue
      if (l.lit) t.step = 'back' // 다른 이가 먼저 붙였다
      else {
        const side = f.x >= l.x ? 1 : -1
        if (walkTo(f, l.x + side * (l.kind === 'fire' ? 0.6 : 0.35))) {
          t.step = 'light'
          t.at = n.tick
          f.facing = l.x >= f.x ? 1 : -1
        }
      }
    } else if (t.step === 'light') {
      if (secs(n, t.at) >= relightSecs(n, l)) {
        l.lit = true
        l.hits = 0
        t.step = 'back'
        n.events.push({ t: 'relit', x: l.x, y: l.y })
      }
    } else if (f.watching === 0 && walkTo(f, f.patrol !== null ? patrolX(f) : t.homeX)) {
      f.task = null
      f.pose = t.homePose
      if (f.patrol === null) f.facing = t.homeFacing
    }
  }
  for (const l of sc.lights) {
    if (l.lit || l.kind === 'candle') continue
    if (sc.figures.some((f) => f.alive && f.task?.light === l.id)) continue
    let who: Figure | null = null
    if (l.carrier >= 0) {
      const c = sc.figures[l.carrier]
      if (c !== undefined && c.alive && c.task === null) who = c
    } else {
      let best = P.night.relightReach
      for (const f of sc.figures) {
        if (!f.alive || f.role !== 'guard' || f.task !== null || f.watching > 0) continue
        const d = Math.abs(f.x - l.x)
        if (d < best) {
          best = d
          who = f
        }
      }
    }
    if (who === null) continue
    const self = l.carrier === who.id
    who.task = { light: l.id, step: self ? 'light' : 'go', at: n.tick, homeX: who.x, homePose: who.pose, homeFacing: who.facing }
    if (who.pose === 'sit') who.pose = 'stand'
    n.events.push({ t: 'tend', x: who.x, y: who.y + 2 * who.size })
  }
}

/** 이 보초가 불을 붙이는 중이면 0..1 (게이지), 붙이러 가는 중이면 0, 아니면 −1 — 그리기용 */
export function tendProgress(n: Night, f: Figure): number {
  const t = f.task
  if (t === null || !f.alive) return -1
  if (t.step === 'go') return 0
  if (t.step === 'back') return -1
  const l = n.scene.lights[t.light]
  return l === undefined ? -1 : clamp01(secs(n, t.at) / relightSecs(n, l))
}

/** 걷고 있나 — 순찰 · 불 붙이러 오가는 길 (그리기의 다리) */
export function walking(f: Figure): boolean {
  if (!f.alive || f.watching > 0) return false
  if (f.task !== null) return f.task.step !== 'light'
  return f.patrol !== null
}

/** 빛 안의 시체를 앞을 보는 보초가 본다 — 불을 붙이는 중인 보초는 불만 본다 */
function watch(n: Night): number {
  if (n.practice?.alarm === false) return 0
  const sc = n.scene
  const sight = P.night.sightRange * byGuard(n, P.night.sightLoose, P.night.sightTight)
  let rise = 0
  for (const g of sc.figures) {
    if (!g.alive || g.role !== 'guard' || g.task?.step === 'light') continue
    let sees: Figure | null = null
    for (const c of sc.figures) {
      if (c.alive || c.role !== 'guard') continue
      const dx = c.x - g.x
      if (Math.abs(dx) > sight || dx * g.facing < -0.5) continue
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
  n.scene = bakeScene(n.seed, n.stage, n.guard)
  n.stuck = []
  n.alarm *= P.night.alarmCarry
  for (const a of n.w.arrows) a.alive = false
  n.tore.clear()
  n.events.push({ t: 'stage', x: 0, y: 0 })
  setPhase(n, 'play')
}

/** 당김이 `f`(만작 한계에 대한 몫)에 닿는 drawTime — bow.ts 의 당김 곡선(스무스스텝 → drawEase)을 거꾸로 푼다 */
function drawTimeFor(w: World, f: number): number {
  const full = P.bow.drawTime * effectiveStats(w.stats).drawTimeMul * w.bow.drawTimeMul * flowDrawMul(w)
  const p = 1 - Math.pow(1 - clamp01(f), 1 / P.bow.drawEase)
  // 스무스스텝 p = 3t² − 2t³ 의 역 (0..1 에서 하나뿐인 근)
  const t = 0.5 - Math.sin(Math.asin(1 - 2 * p) / 3)
  return t * full
}

/**
 * 활 한 스텝 — 활터의 stepArcher 를 그대로 부르고, 밤의 것만 앞뒤에 얹는다 (활터는 한 줄도 안 바뀐다):
 *   ① 그만두기 — 고리 안으로 돌아와 놓으면 쏘지 않고 내린다 (world.cancelDraw)
 *   ② 끈 길이의 상한 — drawTime 을 그 몫에 닿는 자리까지만 두어, 이번 스텝의 당김이 상한을 넘지 않는다.
 *      상한이 1 보다 작으면 만작(phase full)에 들지 않는다 — 덜 당긴 살은 오차가 있다 (빨간 바 계약 ③, partialDrawPenalty)
 *   ③ 밤의 숨 — 당기는 동안 깎인 스태미나의 (1 − staminaDrainMul) 를 돌려준다 (활터의 소모 식은 그대로)
 */
function shootStep(w: World, input: NightFrame): void {
  const a = w.archer
  if (input.cancel === true) cancelDraw(w)
  const cap = input.cap
  if (cap !== undefined && cap < 1 && (a.phase === 'drawing' || a.phase === 'full')) {
    const lim = drawTimeFor(w, cap) - w.dt
    if (a.phase === 'full') {
      a.phase = 'drawing'
      a.holdTime = 0
    }
    if (a.drawTime > lim) a.drawTime = lim > 0 ? lim : 0
  }
  const before = a.stamina
  const wasDrawing = a.phase === 'drawing' || a.phase === 'full'
  stepArcher(w, input)
  if (wasDrawing && a.stamina > 0 && a.stamina < before) a.stamina += (before - a.stamina) * (1 - P.night.staminaDrainMul)
}

export function stepNight(n: Night, input: NightFrame): void {
  const w = n.w
  n.tick++
  w.tick++
  w.elapsed += w.dt
  const evStart = w.events.length
  const shooting = n.phase === 'play' || n.phase === 'rise' || n.phase === 'chief'
  if (shooting) shootStep(w, input)
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
  if (n.phase === 'play') tendLights(n)

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
    // 적장이 선 뒤에 쏜 살이 적장을 못 맞히고 끝났다 → 촛불이 흔들린다 (기다림이 준다 — 다 닳으면 끄고 사라진다)
    if (n.phase === 'chief' && (got === 'stop' || (got === null && (landed || !a.alive)))) {
      const launched = n.tick - Math.round(a.age * P.sim.hz)
      if (launched >= n.chiefUp) {
        n.chiefLeft -= P.night.chiefMissCut
        n.events.push({ t: 'startle', x: 0, y: 0 })
      }
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
        n.chiefLeft = P.night.chiefPatience
      }
      break
    case 'chief':
      n.chiefLeft -= dt()
      if (n.chiefLeft <= 0 || outOfArrows(n)) flee(n)
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

/** 촛불 게이지 — 적장이 남은 기다림 0..1 (그림자가 서는 동안은 1) · 그 밖엔 −1 */
export function chiefCandle(n: Night): number {
  if (n.phase === 'rise') return 1
  if (n.phase === 'chief') return clamp01(n.chiefLeft / P.night.chiefPatience)
  return -1
}

/** 쓰러지는 몸의 기울기 0..1 */
export function fallOf(n: Night, f: Figure): number {
  return f.downAt < 0 ? 0 : clamp01(secs(n, f.downAt) / 0.45)
}

/** 다음 판으로 넘어가는 중이면 0..1 */
export function moveProgress(n: Night): number {
  return n.phase === 'move' ? clamp01(secs(n, n.phaseAt) / P.night.moveTime) : 0
}
