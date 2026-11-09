/**
 * 장수 겨루기 시험판 2판의 셈 (duel.html · docs/realm/council/1109-battle.md).
 *
 * 형 11-09: "화면에는 적장 이미지가 크게 · QTE 로 적이 공격 들어올 위치에 큰 원이 그 터치 영역으로 모임 ·
 * 무예가 높으면 더 불특정하고 빠르게 · 전혀 못 맞추면 내 체력 깎임 · 적당하면 막아 낸 느낌으로 둘 다 그대로 ·
 * 잘 막으면 적이 지쳐 내가 공격 (연타 3초 · 무예 따라 튕겨 냄 · 맞힐수록 덜 튕김) ·
 * 세키로 체간 쌓듯이 · 정확한 타이밍이면 엘든링 패링처럼 바로 치명공격 ·
 * 화면 내 어디든 발생 · 전체 60초 — 비기기도, 차이 있게 갈리기도, KO 승리도".
 *
 *   막기 차례: 적장이 칠 자리(화면 어디든)에 원이 서고 큰 고리가 그 원으로 모인다. 닿는 순간 그 원을 누른다.
 *     못 누름·때 틀림 → 우리 체력 − (적장은 안 지친다) · 막아 냄 → 그대로, 적장 체간 + · 정확 → 그 자리에서 치명공격 + 체간 크게.
 *     형 11-09: "막기를 잘 했으면 적이 지치는 타이밍이 생기고, QTE 를 완벽하게 맞추는 유저가 되면 바로 치명공격".
 *   체간이 가득 차면 → 적장이 비틀거린다 → 3초 연타 (무예만큼 튕겨 내고, 맞힐수록 덜 튕긴다).
 *   끝: 체력이 바닥나면 KO · 60초가 다 되면 남은 체력 차로 판정 (작으면 비김).
 *
 * 결정론 (ARCHITECTURE A1): 틱 하나씩 · 입력은 { 틱, 누른 자리 } 뿐 · 적장의 수와 튕김은 시드 난수. DOM·시계 없음.
 * 그리기(duel-main.ts)는 이 상태를 읽기만 한다.
 */
import { makeRng, type Rng } from '../core/rng.ts'
import { P } from '../tune/params.ts'

/** 누른 자리 — 놀이 칸 위 0~1 */
export interface Tap { readonly x: number; readonly y: number }
export type Phase = 'guard' | 'rush' | 'crit' | 'pause'
export type Judge = 'perfect' | 'good' | 'miss'
export interface Cue {
  readonly id: number
  readonly x: number
  readonly y: number
  readonly t0: number
  readonly hitAt: number
  readonly heavy: boolean
  done: Judge | null
}
export type EvKind = 'cue' | 'perfect' | 'good' | 'miss' | 'crit' | 'break' | 'rushHit' | 'deflect' | 'rushEnd'
export interface DuelEvent {
  readonly t: number
  readonly kind: EvKind
  readonly x?: number
  readonly y?: number
  readonly heavy?: boolean
  /** 누른 때 − 고리가 닿는 때 (틱 · 음수 = 빨랐다 · 못 누름은 막는 폭 끝) */
  readonly off?: number
  readonly dmgMe: number
  readonly dmgFoe: number
}
/** tier = 판의 세기 (0 촌장 ~ 6 천손 · src/realm/tier.ts) · 없으면 1(군장 · 보통) */
export interface DuelOpts { readonly seed: number; readonly muMe: number; readonly muFoe: number; readonly tier?: number }
export type Outcome = 'ko' | 'win' | 'draw' | 'lose' | 'kod'

export interface Duel {
  readonly opts: DuelOpts
  t: number
  readonly end: number
  phase: Phase
  phaseUntil: number
  me: { hp: number }
  foe: { hp: number; posture: number }
  /** 적장 체력 처음 값 (난이도에 따라 다르다 · 막대 그리기용) */
  foeHp0?: number
  cues: Cue[]
  nextCueAt: number
  nextId: number
  rush: { hits: number; deflects: number; lastTap: number }
  events: DuelEvent[]
  /** ko = 적장을 쓰러뜨림 · win = 판정승 · draw · lose = 판정패 · kod = 우리가 쓰러짐 */
  over: null | Outcome
  stats: { perfect: number; good: number; miss: number; crit: number; rushHit: number; deflect: number }
  rng: Rng
}

const D = (): typeof P.duel => P.duel
/** 난이도 — 촌장(0) 값과 천손(6) 값 사이를 고르게 */
const tierK = (d: { opts: DuelOpts }): number => Math.max(0, Math.min(6, d.opts.tier ?? 1)) / 6
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k
export const tierOf = (d: { opts: DuelOpts }) => {
  const R = D(), k = tierK(d)
  return {
    lead: lerp(R.tierLead0, R.tierLead6, k), good: lerp(R.tierGood0, R.tierGood6, k), perfect: lerp(R.tierPerfect0, R.tierPerfect6, k),
    foeHp: lerp(R.tierFoeHp0, R.tierFoeHp6, k), hurt: lerp(R.tierHurt0, R.tierHurt6, k), tire: lerp(R.tierTire0, R.tierTire6, k), deflect: lerp(R.tierDeflect0, R.tierDeflect6, k),
  }
}
const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))

export function createDuel(opts: DuelOpts): Duel {
  const R = D()
  return {
    opts,
    t: 0,
    end: Math.round(R.length),
    phase: 'pause',
    phaseUntil: 40,
    me: { hp: R.hp },
    foe: { hp: Math.round(R.hp * tierOf({ opts }).foeHp), posture: 0 },
    cues: [],
    nextCueAt: 40,
    nextId: 1,
    rush: { hits: 0, deflects: 0, lastTap: -999 },
    events: [],
    over: null,
    stats: { perfect: 0, good: 0, miss: 0, crit: 0, rushHit: 0, deflect: 0 },
    rng: makeRng((opts.seed ^ 0x6475656c) >>> 0),
  }
}

function ev(d: Duel, kind: EvKind, dmgMe: number, dmgFoe: number, at?: { x: number; y: number }, heavy?: boolean, off?: number): void {
  d.me.hp = Math.max(0, d.me.hp - dmgMe)
  d.foe.hp = Math.max(0, d.foe.hp - dmgFoe)
  d.events.push({ t: d.t, kind, dmgMe, dmgFoe, ...(at !== undefined ? { x: at.x, y: at.y } : {}), ...(heavy === true ? { heavy } : {}), ...(off !== undefined ? { off } : {}) })
}

/** 적장 무예가 고리를 빠르게 하는 배수 */
const leadOf = (mu: number): number => Math.max(0.45, 1 - D().leadPerMu * (mu - 5))
/** 우리 장수 무예가 막는 폭을 넓히는 배수 */
const widthOf = (mu: number): number => Math.max(0.5, 1 + D().goodPerMu * (mu - 5))
const hurtOf = (mu: number): number => Math.max(0.5, 1 + D().hitPerMu * (mu - 5))
/** 적장 무예가 높을수록 덜 지친다 */
const tireOf = (mu: number): number => 1 / Math.max(0.5, 1 + D().postureMu * (mu - 5))

function spawnCue(d: Duel, at: number, avoid?: Cue): Cue {
  const R = D()
  const mu = d.opts.muFoe
  // 화면 어디든 — 무예가 높을수록 앞 원에서 멀리 튄다 (더 불특정)
  const jump = clamp(R.spreadBase + R.spreadPerMu * (mu - 5), 0.05, 0.6)
  let x = 0.12 + d.rng.next() * 0.76
  let y = 0.12 + d.rng.next() * 0.76
  const from = avoid ?? d.cues.at(-1)
  if (from !== undefined) {
    const a = d.rng.next() * Math.PI * 2
    const r = 0.18 + jump * (0.5 + d.rng.next() * 0.5)
    x = clamp(from.x + Math.cos(a) * r, 0.12, 0.88)
    y = clamp(from.y + Math.sin(a) * r, 0.12, 0.88)
  }
  const heavy = d.rng.next() < R.heavyChance
  const lead = Math.round(R.lead * leadOf(mu) * tierOf(d).lead * (heavy ? R.heavyLead : 1))
  const c: Cue = { id: d.nextId++, x, y, t0: at - lead, hitAt: at, heavy, done: null }
  d.cues.push(c)
  return c
}

/** 다음 공격(또는 이어치기 둘)을 건다 */
function planAttack(d: Duel, prev: Cue | undefined): void {
  const R = D()
  const mu = d.opts.muFoe
  const lead = Math.round(R.lead * leadOf(mu) * tierOf(d).lead)
  const first = spawnCue(d, d.t + lead, prev)
  let lastAt = first.hitAt
  if (mu >= R.comboMu && !first.heavy && d.rng.next() < R.comboChance * (mu - R.comboMu + 1)) {
    lastAt = spawnCue(d, first.hitAt + Math.round(R.comboGap), first).hitAt
  }
  const gapMul = Math.max(0.4, 1 - R.gapPerMu * (mu - 5))
  d.nextCueAt = lastAt + Math.round((R.gapMin + d.rng.next() * Math.max(0, R.gapMax - R.gapMin)) * gapMul)
}

function startRush(d: Duel): void {
  const R = D()
  d.phase = 'rush'
  d.phaseUntil = d.t + Math.round(R.rushTicks)
  d.cues = []
  d.rush = { hits: 0, deflects: 0, lastTap: -999 }
  ev(d, 'break', 0, 0)
}

function toPause(d: Duel): void {
  d.phase = 'pause'
  d.phaseUntil = d.t + Math.round(D().pauseTicks)
  d.cues = []
}

function judgeCue(d: Duel, c: Cue, j: Judge, off: number): void {
  const R = D()
  c.done = j
  const at = { x: c.x, y: c.y }
  if (j === 'miss') {
    d.stats.miss++
    ev(d, 'miss', Math.round((c.heavy ? R.heavyDmg : R.hitDmg) * hurtOf(d.opts.muFoe) * tierOf(d).hurt), 0, at, c.heavy, off)
    return
  }
  if (j === 'good') {
    d.stats.good++
    d.foe.posture = Math.min(R.posture, d.foe.posture + R.goodPosture * tireOf(d.opts.muFoe) * tierOf(d).tire)
    ev(d, 'good', 0, 0, at, c.heavy, off)
  } else {
    // 정확히 받으면 그 자리에서 치명공격 (엘든링 패링처럼) · 체간도 크게 찬다 · 붉은 큰 공격이면 더 크게
    d.stats.perfect++
    d.stats.crit++
    d.foe.posture = Math.min(R.posture, d.foe.posture + R.perfectPosture * tireOf(d.opts.muFoe) * tierOf(d).tire)
    ev(d, 'perfect', 0, 0, at, c.heavy, off)
    ev(d, 'crit', 0, Math.round(R.critDmg * (c.heavy ? R.critHeavy : 1)), at, c.heavy)
    if (d.foe.hp > 0 && d.foe.posture >= R.posture && d.cues.every((x) => x.done !== null)) { startRush(d); return }
    d.phase = 'crit'
    d.phaseUntil = d.t + Math.round(R.critTicks)
    d.cues = d.cues.filter((x) => x.done === null && x.hitAt > d.phaseUntil + 10)
    return
  }
  if (d.foe.posture >= R.posture && d.cues.every((x) => x.done !== null)) startRush(d)
}

/** 한 틱. tap 은 이 틱에 누른 자리 (없으면 undefined) */
export function stepDuel(d: Duel, tap?: Tap): void {
  if (d.over !== null) return
  const R = D()
  d.t++
  if (d.phase === 'pause' || d.phase === 'crit') {
    if (d.t >= d.phaseUntil) {
      d.phase = 'guard'
      d.nextCueAt = d.t + 10
    }
  } else if (d.phase === 'rush') {
    if (tap !== undefined && d.t - d.rush.lastTap >= R.tapGap) {
      d.rush.lastTap = d.t
      const p = clamp(R.deflectBase + tierOf(d).deflect + R.deflectPerMu * (d.opts.muFoe - 5) - R.deflectPerHit * d.rush.hits, R.deflectMin, R.deflectMax)
      if (d.rng.next() < p) { d.rush.deflects++; d.stats.deflect++; ev(d, 'deflect', 0, 0, tap) }
      else { d.rush.hits++; d.stats.rushHit++; ev(d, 'rushHit', 0, Math.round(R.tapDmg), tap) }
    }
    if (d.t >= d.phaseUntil) {
      d.foe.posture = 0
      ev(d, 'rushEnd', 0, 0)
      toPause(d)
    }
  } else {
    // 막기 차례
    if (d.t >= d.nextCueAt && d.cues.every((c) => c.done !== null)) {
      const prev = d.cues.at(-1)
      d.cues = []
      planAttack(d, prev)
      ev(d, 'cue', 0, 0)
    }
    if (tap !== undefined) {
      const reach = R.radius * R.touchSlop
      let best: Cue | null = null
      for (const c of d.cues) {
        if (c.done !== null || d.t < c.t0) continue
        if (Math.hypot(tap.x - c.x, tap.y - c.y) > reach) continue
        if (best === null || Math.abs(d.t - c.hitAt) < Math.abs(d.t - best.hitAt)) best = c
      }
      if (best !== null) {
        const w = widthOf(d.opts.muMe), ti = tierOf(d)
        const dt = d.t - best.hitAt
        if (dt < -Math.round(R.good * w * ti.good)) judgeCue(d, best, 'miss', dt) // 너무 일찍 — 헛손에 맞는다
        else if (Math.abs(dt) <= Math.max(1, Math.round(R.perfect * w * ti.perfect))) judgeCue(d, best, 'perfect', dt)
        else judgeCue(d, best, 'good', dt)
      }
    }
    if (d.phase === 'guard') {
      const lateW = Math.round(R.good * widthOf(d.opts.muMe) * tierOf(d).good) + R.late // 닿은 뒤로도 막는 폭만큼 + 손가락 늦음
      for (const c of d.cues) if (c.done === null && d.t > c.hitAt + lateW) judgeCue(d, c, 'miss', lateW)
      d.foe.posture = Math.max(0, d.foe.posture - R.postureRecover)
    }
  }
  if (d.foe.hp <= 0) d.over = 'ko'
  else if (d.me.hp <= 0) d.over = 'kod'
  else if (d.t >= d.end) {
    const foe0 = Math.round(R.hp * tierOf(d).foeHp)
    const diff = (d.me.hp / R.hp - d.foe.hp / foe0) * 100 // 남은 몫의 차 (%)
    d.over = diff > R.drawBand ? 'win' : diff < -R.drawBand ? 'lose' : 'draw'
  }
}

/** 막는 폭이 닿은 뒤로 얼마나 가나 (틱) — 그리기가 고리를 안으로 줄이는 길이 */
export const lateWindow = (muMe: number, tier = 1): number => Math.round(D().good * widthOf(muMe) * tierOf({ opts: { seed: 0, muMe, muFoe: 5, tier } }).good) + D().late
/** 막는 폭 (틱) — 일찍은 early 까지 · 늦게는 late 까지 막음 · |off| ≤ perfect 면 정확. 화면이 고리 위에 그리는 폭과 판정(stepDuel)이 같은 셈이다 (형 11-09: 성공 실패가 비직관적) */
export function judgeWindows(muMe: number, tier = 1): { early: number; perfect: number; late: number } {
  const R = D(), w = widthOf(muMe), ti = tierOf({ opts: { seed: 0, muMe, muFoe: 5, tier } })
  return { early: Math.round(R.good * w * ti.good), perfect: Math.max(1, Math.round(R.perfect * w * ti.perfect)), late: Math.round(R.good * w * ti.good) + R.late }
}

/** 맡겼을 때 이길 몫 — 본편 겨루기와 같은 셈 (tactics.ts · tacDuelPerMu) */
export const autoWinChance = (muMe: number, muFoe: number): number =>
  Math.min(0.9, Math.max(0.1, 0.5 + P.realm.tacDuelPerMu * (muMe - muFoe)))
